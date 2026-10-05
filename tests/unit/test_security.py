"""Verificación del token de sesión. Corresponde a F02-T01.

`current_user_id` es la única puerta de todo lo privado: si acá entra
algo que no debería, entra en toda la aplicación. Por eso las pruebas
**fabrican tokens de verdad** —con una clave EC propia, firmados y
decodificados como los reales— en lugar de simular la biblioteca. Un
doble de `jwt.decode` probaría el doble, no la verificación.

Los cinco casos que pide la tarea: válido, vencido, firma incorrecta,
audiencia incorrecta y sin el claim `sub`.
"""

from __future__ import annotations

import json
import time
from typing import Any

import jwt
import pytest
from api.app.core import security
from cryptography.hazmat.primitives.asymmetric import ec
from jwt.utils import base64url_encode

AUDIENCIA = "authenticated"
UUID_DE_PRUEBA = "6f1d2b40-0000-4000-8000-000000000001"


# --------------------------------------------------------------- claves


@pytest.fixture(scope="module")
def par_de_claves() -> tuple[Any, Any]:
    """Una clave EC P-256, la misma curva que usa Supabase."""
    privada = ec.generate_private_key(ec.SECP256R1())
    return privada, privada.public_key()


@pytest.fixture(scope="module")
def otra_clave() -> Any:
    """Una segunda clave, para firmar con la que no corresponde."""
    return ec.generate_private_key(ec.SECP256R1())


def _numero_a_base64url(valor: int) -> str:
    largo = (valor.bit_length() + 7) // 8
    return base64url_encode(valor.to_bytes(max(largo, 32), "big")).decode()


@pytest.fixture
def jwks(monkeypatch: pytest.MonkeyPatch, par_de_claves: tuple[Any, Any]) -> None:
    """Hace que el verificador use nuestra clave pública.

    Se reemplaza el cliente de JWKS, no `jwt.decode`: así la firma se
    comprueba de verdad contra una clave que nosotros controlamos, que
    es exactamente lo que pasa en producción con la de Supabase.
    """
    _, publica = par_de_claves
    numeros = publica.public_numbers()
    clave_jwk = {
        "kty": "EC",
        "crv": "P-256",
        "use": "sig",
        "kid": "prueba",
        "x": _numero_a_base64url(numeros.x),
        "y": _numero_a_base64url(numeros.y),
    }

    class ClienteDePrueba:
        def get_signing_key_from_jwt(self, token: str) -> Any:
            return jwt.PyJWK(json.loads(json.dumps(clave_jwk)), algorithm="ES256")

    monkeypatch.setattr(security, "cliente_jwks", lambda: ClienteDePrueba())


def token(
    privada: Any,
    *,
    sub: str | None = UUID_DE_PRUEBA,
    aud: str | None = AUDIENCIA,
    exp: int | None = None,
    extra: dict[str, Any] | None = None,
) -> str:
    """Fabrica un token como los que manda Supabase."""
    ahora = int(time.time())
    carga: dict[str, Any] = {"iat": ahora, "exp": exp if exp is not None else ahora + 3600}
    if sub is not None:
        carga["sub"] = sub
    if aud is not None:
        carga["aud"] = aud
    carga.update(extra or {})
    return jwt.encode(carga, privada, algorithm="ES256", headers={"kid": "prueba"})


# ------------------------------------------------- los cinco casos pedidos


@pytest.mark.unit
@pytest.mark.usefixtures("jwks")
def test_un_token_valido_devuelve_el_usuario(par_de_claves: tuple[Any, Any]) -> None:
    privada, _ = par_de_claves
    payload = security.verificar(token(privada))
    assert payload["sub"] == UUID_DE_PRUEBA


@pytest.mark.unit
@pytest.mark.usefixtures("jwks")
def test_un_token_vencido_se_rechaza(par_de_claves: tuple[Any, Any]) -> None:
    """Y con mensaje propio: el frontend puede renovar la sesión sin
    molestar al usuario, cosa que no haría con una inválida."""
    privada, _ = par_de_claves
    vencido = token(privada, exp=int(time.time()) - 10)

    with pytest.raises(security.ErrorDeApi) as caso:
        security.verificar(vencido)

    assert caso.value.status_code == 401
    assert "expir" in caso.value.message.lower()


@pytest.mark.unit
@pytest.mark.usefixtures("jwks")
def test_un_token_firmado_con_otra_clave_se_rechaza(otra_clave: Any) -> None:
    """Criterio de aceptación: un token manipulado se rechaza por la
    firma. Es el caso que importa: alguien que fabrica un token con el
    uuid de otra persona."""
    ajeno = token(otra_clave, sub="00000000-0000-4000-8000-000000000999")

    with pytest.raises(security.ErrorDeApi) as caso:
        security.verificar(ajeno)

    assert caso.value.status_code == 401


@pytest.mark.unit
@pytest.mark.usefixtures("jwks")
def test_un_token_con_otra_audiencia_se_rechaza(par_de_claves: tuple[Any, Any]) -> None:
    """Supabase emite tokens para varias audiencias. Uno de otro uso,
    aunque esté bien firmado por el mismo proyecto, no sirve acá."""
    privada, _ = par_de_claves

    with pytest.raises(security.ErrorDeApi):
        security.verificar(token(privada, aud="otra-cosa"))


@pytest.mark.unit
@pytest.mark.usefixtures("jwks")
def test_un_token_sin_sub_se_rechaza(par_de_claves: tuple[Any, Any]) -> None:
    """Sin `sub` no hay a quién atribuirle los datos. Dejarlo pasar
    sería trabajar con un usuario vacío."""
    privada, _ = par_de_claves

    with pytest.raises(security.ErrorDeApi):
        security.verificar(token(privada, sub=None))


# ------------------------------------------- lo que la tarea no pedía y falta


@pytest.mark.unit
@pytest.mark.usefixtures("jwks")
@pytest.mark.parametrize("vacio", ["", "   "])
def test_un_sub_vacio_tambien_se_rechaza(par_de_claves: tuple[Any, Any], vacio: str) -> None:
    """`require: ["sub"]` exige que el claim ESTÉ, no que valga algo.

    Un token con `"sub": ""` pasa la verificación de PyJWT y deja al
    backend consultando por un usuario vacío, que es peor que rechazar.
    """
    privada, _ = par_de_claves

    with pytest.raises(security.ErrorDeApi):
        security.verificar(token(privada, sub=vacio))


@pytest.mark.unit
@pytest.mark.usefixtures("jwks")
def test_un_token_sin_vencimiento_se_rechaza(par_de_claves: tuple[Any, Any]) -> None:
    """Sin `exp`, el token vale para siempre. PyJWT lo acepta si no se
    lo exige explícitamente."""
    privada, _ = par_de_claves
    ahora = int(time.time())
    sin_exp = jwt.encode(
        {"iat": ahora, "sub": UUID_DE_PRUEBA, "aud": AUDIENCIA},
        privada,
        algorithm="ES256",
        headers={"kid": "prueba"},
    )

    with pytest.raises(security.ErrorDeApi):
        security.verificar(sin_exp)


@pytest.mark.unit
@pytest.mark.usefixtures("jwks")
def test_un_token_sin_firma_se_rechaza(par_de_claves: tuple[Any, Any]) -> None:
    """El ataque clásico: cambiar el algoritmo a `none` y sacar la
    firma. Se rechaza porque sólo se admite ES256."""
    privada, _ = par_de_claves
    bueno = token(privada)
    cabecera, carga, _firma = bueno.split(".")

    sin_firma = jwt.encode(
        jwt.decode(bueno, options={"verify_signature": False}, audience=AUDIENCIA),
        key="",
        algorithm="none",
    )

    with pytest.raises(security.ErrorDeApi):
        security.verificar(sin_firma)
    # Y el payload manipulado tampoco pasa con la firma vieja.
    with pytest.raises(security.ErrorDeApi):
        security.verificar(f"{cabecera}.{carga}x.{_firma}")


# ------------------------------------------------ el error no cuenta de más


@pytest.mark.unit
@pytest.mark.usefixtures("jwks")
@pytest.mark.parametrize(
    "caso",
    ["otra_clave", "otra_audiencia", "sin_sub", "basura"],
)
def test_el_mensaje_no_filtra_por_que_fallo(
    par_de_claves: tuple[Any, Any], otra_clave: Any, caso: str
) -> None:
    """Criterio de aceptación: el mensaje no filtra detalles internos.

    «Firma incorrecta» o «audiencia equivocada» le dicen a quien está
    probando exactamente qué ajustar. Todos los inválidos dicen lo
    mismo; el detalle va al registro, que sí lo necesita.
    """
    privada, _ = par_de_claves
    malos = {
        "otra_clave": token(otra_clave),
        "otra_audiencia": token(privada, aud="otra"),
        "sin_sub": token(privada, sub=None),
        "basura": "esto.no.es-un-token",
    }

    with pytest.raises(security.ErrorDeApi) as resultado:
        security.verificar(malos[caso])

    mensaje = resultado.value.message.lower()
    assert mensaje == "la sesión no es válida."
    for filtracion in ("signature", "firma", "audience", "audiencia", "sub", "jwks", "es256"):
        assert filtracion not in mensaje, f"el mensaje cuenta de más: {mensaje}"


@pytest.mark.unit
@pytest.mark.usefixtures("jwks")
def test_los_tres_casos_se_distinguen(par_de_claves: tuple[Any, Any]) -> None:
    """Sin sesión, vencida e inválida tienen que ser distinguibles: el
    frontend renueva una y manda a entrar en las otras dos."""
    privada, _ = par_de_claves
    ahora = int(time.time())

    with pytest.raises(security.ErrorDeApi) as vencida:
        security.verificar(token(privada, exp=ahora - 10))
    with pytest.raises(security.ErrorDeApi) as invalida:
        security.verificar("basura")

    assert vencida.value.message != invalida.value.message
    # Y el de «no hay sesión» es el tercero, que pone current_user_id.
    assert "iniciar sesión" not in vencida.value.message


# ------------------------------------------------- las claves, una sola vez


@pytest.mark.unit
def test_las_claves_se_buscan_una_sola_vez_por_proceso(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Criterio de aceptación.

    Un cliente nuevo por petición significa un viaje de red a Supabase
    por petición, y depender de que ese endpoint esté arriba siempre.
    """
    monkeypatch.setattr(security, "_cliente_jwks", None)
    creados = 0

    class ClienteFalso:
        def __init__(self, url: str, **kwargs: Any) -> None:
            nonlocal creados
            creados += 1
            self.url = url
            self.kwargs = kwargs

    monkeypatch.setattr(security, "PyJWKClient", ClienteFalso)

    primero = security.cliente_jwks()
    segundo = security.cliente_jwks()

    assert creados == 1, f"se creó el cliente {creados} veces"
    assert primero is segundo
    assert primero.kwargs["cache_keys"] is True
    assert primero.kwargs["lifespan"] == security.VIDA_DE_LAS_CLAVES


@pytest.mark.unit
def test_la_url_del_jwks_es_la_del_proyecto(monkeypatch: pytest.MonkeyPatch) -> None:
    """Y sin barra doble: `SUPABASE_URL` puede venir con barra final y
    `https://x.supabase.co//auth/...` no responde."""
    monkeypatch.setattr(security, "_cliente_jwks", None)
    capturada = {}

    class ClienteFalso:
        def __init__(self, url: str, **kwargs: Any) -> None:
            capturada["url"] = url

    monkeypatch.setattr(security, "PyJWKClient", ClienteFalso)

    class ConfigFalsa:
        SUPABASE_URL = "https://ejemplo.supabase.co/"

    monkeypatch.setattr(security, "get_settings", lambda: ConfigFalsa())
    security.cliente_jwks()

    assert capturada["url"] == ("https://ejemplo.supabase.co/auth/v1/.well-known/jwks.json")
    assert "//auth" not in capturada["url"]


# ------------------------------------------------ la configuración del algoritmo


@pytest.mark.unit
def test_solo_se_admite_es256() -> None:
    """Admitir más de un algoritmo abre la puerta a que un token venga
    firmado con HMAC usando la clave pública como secreto."""
    assert security.ALGORITMO == "ES256"


@pytest.mark.unit
def test_el_secreto_compartido_no_se_usa_para_verificar() -> None:
    """`SUPABASE_JWT_SECRET` quedó en la configuración como resto de la
    documentación vieja. Si alguien lo usara, bastaría tenerlo para
    fabricar sesiones."""
    fuente = __import__("pathlib").Path(security.__file__).read_text(encoding="utf-8")
    import re

    sin_comentarios = re.sub(r'""".*?"""', "", fuente, flags=re.S)
    sin_comentarios = re.sub(r"^\s*#.*$", "", sin_comentarios, flags=re.M)
    assert "SUPABASE_JWT_SECRET" not in sin_comentarios


# -------------------------------- la dependencia, dentro de una aplicación


def _app_de_prueba() -> Any:
    """Una aplicación mínima con un endpoint privado.

    Se arma acá y no se usa la real para que la prueba falle por la
    autenticación y no por cualquier otra cosa que la aplicación
    necesite para arrancar.
    """
    from api.app.core.errors import registrar_manejadores
    from fastapi import FastAPI

    app = FastAPI()
    registrar_manejadores(app)

    @app.get("/privado")
    async def privado(uid: security.UsuarioActual) -> dict[str, str]:
        return {"uid": uid}

    return app


@pytest.fixture
def cliente() -> Any:
    from fastapi.testclient import TestClient

    return TestClient(_app_de_prueba(), raise_server_exceptions=False)


@pytest.mark.unit
@pytest.mark.usefixtures("jwks")
def test_con_token_valido_el_endpoint_responde(
    cliente: Any, par_de_claves: tuple[Any, Any]
) -> None:
    privada, _ = par_de_claves
    r = cliente.get("/privado", headers={"Authorization": f"Bearer {token(privada)}"})
    assert r.status_code == 200
    assert r.json() == {"uid": UUID_DE_PRUEBA}


@pytest.mark.unit
@pytest.mark.usefixtures("jwks")
@pytest.mark.parametrize(
    "cabeceras",
    [
        pytest.param({}, id="sin cabecera"),
        pytest.param({"Authorization": "Bearer "}, id="bearer vacío"),
        pytest.param({"Authorization": "Bearer    "}, id="sólo espacios"),
        pytest.param({"Authorization": "Basic abc"}, id="otro esquema"),
    ],
)
def test_sin_sesion_responde_401(cliente: Any, cabeceras: dict[str, str]) -> None:
    r = cliente.get("/privado", headers=cabeceras)
    assert r.status_code == 401


@pytest.mark.unit
@pytest.mark.usefixtures("jwks")
def test_el_401_sale_con_la_forma_de_error_de_la_api(cliente: Any) -> None:
    """Por esto `HTTPBearer` va con `auto_error=False`: con `True`,
    FastAPI devuelve su propio 401 sin pasar por los manejadores y la
    respuesta sale con otra forma que todas las demás de la API.
    """
    r = cliente.get("/privado")
    cuerpo = r.json()
    assert "error" in cuerpo, f"el 401 no tiene la forma de la API: {cuerpo}"
    assert cuerpo["error"]["code"] == "UNAUTHENTICATED"
    assert cuerpo["error"]["message"]


@pytest.mark.unit
@pytest.mark.usefixtures("jwks")
def test_un_token_de_otra_persona_no_deja_entrar(cliente: Any, otra_clave: Any) -> None:
    """El caso que de verdad importa: alguien fabrica un token con el
    uuid de otro usuario y lo firma con una clave suya."""
    falso = token(otra_clave, sub="00000000-0000-4000-8000-00000000dead")
    r = cliente.get("/privado", headers={"Authorization": f"Bearer {falso}"})
    assert r.status_code == 401
    assert "dead" not in r.text
