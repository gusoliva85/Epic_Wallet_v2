"""Verificación del token de sesión · F02-T01.

Referencia: 02_Documento_Tecnico.md §8.8

Todo endpoint privado depende de `current_user_id`. Esa función es la
**única** puerta de entrada: si devuelve un uuid, hay una sesión válida
de ese usuario y de nadie más.

Por qué ES256 y no un secreto compartido
----------------------------------------
Se comprobó contra el proyecto real en F00-T06: Supabase firma con
claves asimétricas (`alg: ES256`, curva P-256) y publica la pública en
un endpoint JWKS. `SUPABASE_JWT_SECRET` existe en la configuración como
resto de la documentación vieja y **no sirve para verificar nada**.

La diferencia importa: con secreto compartido, el mismo valor firma y
verifica, así que quien lo tenga puede fabricar sesiones. Con claves
asimétricas sólo Supabase puede firmar; el backend únicamente
comprueba. Un secreto filtrado desde acá no permitiría entrar.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Annotated, Final

import jwt
from fastapi import Depends, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from .config import get_settings
from .errors import UNAUTHENTICATED, ErrorDeApi

log = logging.getLogger("epic_wallet")

ALGORITMO: Final = "ES256"
AUDIENCIA: Final = "authenticated"

# Cuánto se guardan las claves del JWKS. Una hora: Supabase no las rota
# seguido, y si rotara, al vencer la caché se vuelven a pedir solas.
VIDA_DE_LAS_CLAVES: Final = 3600

# Tolerancia de reloj, en segundos.
#
# No es una comodidad: sin esto, un token recién emitido se rechaza si
# el reloj del servidor está aunque sea una fracción de segundo
# atrasado respecto del de Supabase. Medido en esta máquina: **0,2
# segundos de desfase bastaban** para que la verificación fallara con
# «The token is not yet valid (iat)».
#
# En producción eso se habría visto como un 401 intermitente justo
# después de entrar, imposible de reproducir a voluntad y fácil de
# atribuir a cualquier otra cosa.
#
# Treinta segundos es el valor habitual. El costo es que un token
# también sigue valiendo treinta segundos después de vencer, lo que
# sobre una hora de vigencia no cambia nada.
TOLERANCIA_DE_RELOJ: Final = 30

# `auto_error=False` a propósito: con `True`, FastAPI devuelve su propio
# 401 sin pasar por el manejador de errores de la aplicación, y la
# respuesta saldría con otra forma que todas las demás.
bearer = HTTPBearer(auto_error=False)

_cliente_jwks: PyJWKClient | None = None


def cliente_jwks() -> PyJWKClient:
    """Un solo cliente para todo el proceso.

    Crearlo en cada petición significaría ir a buscar las claves a
    Supabase en cada petición: un viaje de red extra, y una dependencia
    de que ese endpoint esté disponible en todo momento. Con uno solo y
    caché, se piden una vez por proceso.

    Se crea perezosamente y no al importar el módulo: así importar esto
    no obliga a tener `SUPABASE_URL` configurada, que es lo que permite
    que las pruebas que no tocan autenticación corran sin ella.
    """
    global _cliente_jwks
    if _cliente_jwks is None:
        url = get_settings().SUPABASE_URL.rstrip("/")
        _cliente_jwks = PyJWKClient(
            f"{url}/auth/v1/.well-known/jwks.json",
            cache_keys=True,
            lifespan=VIDA_DE_LAS_CLAVES,
        )
    return _cliente_jwks


def _sin_sesion(detalle: str) -> ErrorDeApi:
    """401 de «no hay sesión»."""
    return ErrorDeApi(status.HTTP_401_UNAUTHORIZED, UNAUTHENTICATED, detalle)


def verificar(token: str) -> dict[str, object]:
    """Comprueba firma, vencimiento y audiencia, y devuelve el payload.

    Los mensajes distinguen tres casos porque el frontend hace cosas
    distintas con cada uno: si la sesión venció, puede renovarla sin
    molestar; si es inválida, tiene que mandar a la pantalla de entrada.

    Lo que **no** hacen es contar por qué un token es inválido. «Firma
    incorrecta», «audiencia equivocada» o «falta el emisor» le dicen a
    quien está probando exactamente qué le falta ajustar. Hacia afuera
    es siempre «sesión inválida»; el detalle va al registro.
    """
    try:
        clave = cliente_jwks().get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            clave.key,
            algorithms=[ALGORITMO],
            audience=AUDIENCIA,
            leeway=TOLERANCIA_DE_RELOJ,
            options={"require": ["exp", "sub"]},
        )
    except jwt.ExpiredSignatureError:
        raise _sin_sesion("La sesión expiró.") from None
    except jwt.PyJWKClientError as exc:
        # No se encontró la clave con la que se firmó. Puede ser un
        # token de otro proyecto, o que Supabase no responda.
        log.warning("No se pudo obtener la clave del JWKS: %s", exc)
        raise _sin_sesion("La sesión no es válida.") from None
    except jwt.InvalidTokenError as exc:
        log.info("Token rechazado: %s: %s", type(exc).__name__, exc)
        raise _sin_sesion("La sesión no es válida.") from None

    sub = payload.get("sub")
    # `require` ya exige que `sub` esté, pero no que valga algo: un
    # token con `"sub": ""` pasaría y dejaría al backend trabajando con
    # un usuario vacío, que es peor que rechazarlo.
    if not isinstance(sub, str) or not sub.strip():
        log.info("Token sin identificador de usuario utilizable")
        raise _sin_sesion("La sesión no es válida.")

    return payload


@dataclass(frozen=True)
class Usuario:
    """Lo que el token dice del usuario de esta petición.

    El correo viene del propio token y no de una consulta a la base: es
    un dato firmado por Supabase, así que es tan confiable como el uuid
    y no cuesta un viaje.
    """

    id: str
    email: str | None = None


async def current_user(
    credencial: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    request: Request,
) -> Usuario:
    """El usuario de la petición. La puerta de todo lo privado."""
    if credencial is None or not credencial.credentials.strip():
        raise _sin_sesion("Hace falta iniciar sesión.")

    payload = verificar(credencial.credentials)
    uid = str(payload["sub"])
    correo = payload.get("email")

    # Queda en el `request` para que el registro de errores pueda decir
    # a qué usuario le pasó, sin tener que pedir la dependencia otra vez.
    request.state.user_id = uid
    return Usuario(id=uid, email=str(correo) if correo else None)


async def current_user_id(usuario: Annotated[Usuario, Depends(current_user)]) -> str:
    """Sólo el uuid, que es lo que necesita casi todo.

    Devuelve `str` y no `UUID` porque es lo que viaja en el token y lo
    que guarda la base; convertirlo acá obligaría a convertirlo de
    vuelta en cada consulta.
    """
    return usuario.id


UsuarioActual = Annotated[str, Depends(current_user_id)]
UsuarioDelToken = Annotated[Usuario, Depends(current_user)]
