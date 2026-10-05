"""El alta automática de una cuenta · F02-T04.

El criterio de la tarea es «al crear una cuenta nueva aparecen solos su
perfil y sus 21 categorías, **sin pasar por nuestra API**». Así que la
prueba crea una cuenta **de verdad** contra Supabase Auth y después
mira la base. Insertar a mano en `auth.users` probaría otra cosa: lo
que importa es que el camino real —el registro— dispare el trigger.

Las cuentas de prueba usan `example.com`, que la RFC 2606 reserva para
esto y no entrega correo a nadie. Se borran al terminar.
"""

from __future__ import annotations

import json
import os
import re
import secrets
import urllib.error
import urllib.request
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import Engine, text

from tests.api.ayudas_db import escritura, lectura, motor_de_pruebas

RAIZ = Path(__file__).resolve().parents[2]
pytestmark = pytest.mark.api

# Las 21 del documento general §7.1 y §7.2, en su orden.
ESPERADAS: tuple[tuple[str, str], ...] = (
    ("Sueldo", "income"),
    ("Aguinaldo", "income"),
    ("Otros", "income"),
    ("Alquiler", "expense"),
    ("Expensas", "expense"),
    ("Cochera", "expense"),
    ("ABL", "expense"),
    ("Gas", "expense"),
    ("Luz", "expense"),
    ("Internet", "expense"),
    ("Da Vinci", "expense"),
    ("Tarjeta", "expense"),
    ("Tuenti", "expense"),
    ("Nafta", "expense"),
    ("Subte", "expense"),
    ("Mercadería", "expense"),
    ("Verdulería", "expense"),
    ("Carnicería / Pollería", "expense"),
    ("Delivery / Salida", "expense"),
    ("Comida Trabajo", "expense"),
    ("Otros", "expense"),
)


def _del_env(clave: str) -> str | None:
    valor = os.getenv(clave, "").strip()
    if valor:
        return valor
    archivo = RAIZ / ".env"
    if not archivo.exists():
        return None
    m = re.search(rf"^{clave}=(.+)$", archivo.read_text(encoding="utf-8"), re.M)
    return m.group(1).strip() if m else None


URL_BASE = _del_env("DATABASE_URL")
SUPABASE = (_del_env("SUPABASE_URL") or "").rstrip("/")
ANON = _del_env("SUPABASE_ANON_KEY")
ESQUEMA = os.getenv("DB_SCHEMA", "dev").strip() or "dev"

sin_entorno = pytest.mark.skipif(
    not (URL_BASE and SUPABASE and ANON) or str(URL_BASE).startswith("sqlite"),
    reason="hacen falta Postgres y las credenciales de Supabase",
)


@pytest.fixture(scope="module")
def motor() -> Engine:
    assert URL_BASE
    return motor_de_pruebas(str(URL_BASE))


def _registrar(correo: str, clave: str) -> tuple[int, dict[str, Any]]:
    req = urllib.request.Request(
        f"{SUPABASE}/auth/v1/signup",
        data=json.dumps({"email": correo, "password": clave}).encode(),
        headers={
            "apikey": str(ANON),
            "Authorization": f"Bearer {ANON}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


@pytest.fixture
def cuenta_nueva(motor: Engine) -> Iterator[str]:
    """Crea una cuenta por el camino real y la borra al terminar."""
    correo = f"epicwallet.alta.{secrets.token_hex(6)}@example.com"
    estado, cuerpo = _registrar(correo, secrets.token_urlsafe(16))

    if estado >= 400:
        motivo = cuerpo.get("msg") or cuerpo.get("message") or cuerpo
        if "rate limit" in str(motivo).lower():
            pytest.skip(f"Supabase cortó por límite: {motivo}")
        pytest.fail(f"no se pudo crear la cuenta: {motivo}")

    uid = cuerpo.get("id") or cuerpo.get("user", {}).get("id")
    assert uid, f"la respuesta no trae el id del usuario: {cuerpo}"

    yield str(uid)

    # Borrar de auth.users arrastra perfil y categorías por la cascada,
    # que de paso es lo que comprueba la última prueba.
    with escritura(motor) as con:
        con.execute(text("delete from auth.users where id = :id"), {"id": uid})


# ------------------------------------------------------------ el perfil


@sin_entorno
def test_la_cuenta_nueva_tiene_su_perfil(motor: Engine, cuenta_nueva: str) -> None:
    """Sin pasar por nuestra API: nadie llamó a ningún endpoint."""
    with lectura(motor) as con:
        fila = con.execute(
            text(
                f"select username, opening_balance, timezone, active "
                f'from "{ESQUEMA}".profiles where id = :id'
            ),
            {"id": cuenta_nueva},
        ).one_or_none()

    assert fila is not None, "la cuenta se creó pero no tiene perfil"
    assert fila[0], "el perfil quedó sin username"
    assert fila[1] == 0, "la cuenta tiene que arrancar con saldo inicial en cero"
    assert fila[2] == "America/Argentina/Buenos_Aires"
    assert fila[3] is True


@sin_entorno
def test_el_username_sale_del_correo(motor: Engine, cuenta_nueva: str) -> None:
    with lectura(motor) as con:
        username = con.execute(
            text(f'select username from "{ESQUEMA}".profiles where id = :id'),
            {"id": cuenta_nueva},
        ).scalar()
        correo = con.execute(
            text("select email from auth.users where id = :id"), {"id": cuenta_nueva}
        ).scalar()

    assert str(username).startswith(str(correo).split("@")[0])


# -------------------------------------------------------- las 21 categorías


@sin_entorno
def test_la_cuenta_nueva_tiene_sus_21_categorias(motor: Engine, cuenta_nueva: str) -> None:
    """Criterio de aceptación: los nombres coinciden exactamente con los
    del documento general, y en su orden."""
    with lectura(motor) as con:
        filas = [
            (f[0], f[1])
            for f in con.execute(
                text(
                    f'select name, type from "{ESQUEMA}".categories '
                    "where user_id = :id order by sort_order"
                ),
                {"id": cuenta_nueva},
            )
        ]

    assert len(filas) == 21, f"se crearon {len(filas)} categorías y tienen que ser 21"
    assert tuple(filas) == ESPERADAS, (
        "los nombres o el orden no coinciden con el documento general.\n"
        f"  esperado: {ESPERADAS}\n  obtenido: {tuple(filas)}"
    )


@sin_entorno
def test_las_categorias_arrancan_activas(motor: Engine, cuenta_nueva: str) -> None:
    with lectura(motor) as con:
        inactivas = con.execute(
            text(f'select count(*) from "{ESQUEMA}".categories where user_id = :id and not active'),
            {"id": cuenta_nueva},
        ).scalar()
    assert inactivas == 0


@sin_entorno
def test_otros_existe_en_los_dos_tipos(motor: Engine, cuenta_nueva: str) -> None:
    """La restricción única incluye el tipo justamente por esto. Si sólo
    fuera por nombre, la segunda «Otros» rompería el alta de la cuenta
    entera."""
    with lectura(motor) as con:
        tipos = {
            f[0]
            for f in con.execute(
                text(
                    f'select type from "{ESQUEMA}".categories '
                    "where user_id = :id and name = 'Otros'"
                ),
                {"id": cuenta_nueva},
            )
        }
    assert tipos == {"income", "expense"}


# ----------------------------------------------------- nombres repetidos


@sin_entorno
def test_dos_cuentas_con_el_mismo_nombre_de_correo_conviven(motor: Engine) -> None:
    """El caso que el ejemplo del documento técnico no contemplaba.

    `username` sale de la parte de adelante del correo y es único.
    `alguien@live.com` y `alguien@gmail.com` dan el mismo. Sin
    desambiguar, la SEGUNDA cuenta falla al crearse y el registro entero
    se cae con un error que no le dice nada al usuario.
    """
    base = f"epicwallet.gemelo.{secrets.token_hex(5)}"
    creadas: list[str] = []

    try:
        for dominio in ("example.com", "example.net"):
            estado, cuerpo = _registrar(f"{base}@{dominio}", secrets.token_urlsafe(16))
            if estado >= 400:
                motivo = str(cuerpo.get("msg") or cuerpo)
                if "rate limit" in motivo.lower():
                    pytest.skip(f"Supabase cortó por límite: {motivo}")
                pytest.fail(f"la cuenta con {dominio} no se pudo crear: {motivo}")
            uid = cuerpo.get("id") or cuerpo.get("user", {}).get("id")
            creadas.append(str(uid))

        with lectura(motor) as con:
            nombres = [
                f[0]
                for f in con.execute(
                    text(
                        f'select username from "{ESQUEMA}".profiles '
                        "where id = any(:ids) order by created_at"
                    ),
                    {"ids": creadas},
                )
            ]

        assert len(nombres) == 2, "una de las dos cuentas quedó sin perfil"
        assert len(set(nombres)) == 2, f"los dos perfiles quedaron con el mismo nombre: {nombres}"
        assert nombres[0] == base
    finally:
        if creadas:
            with escritura(motor) as con:
                con.execute(
                    text("delete from auth.users where id = any(:ids)"),
                    {"ids": creadas},
                )


# ------------------------------------------------- borrar se lleva todo


@sin_entorno
def test_borrar_la_cuenta_se_lleva_perfil_y_categorias(motor: Engine) -> None:
    """La cascada. Sin ella quedarían 21 filas por cuenta apuntando a un
    usuario que ya no existe."""
    correo = f"epicwallet.borrar.{secrets.token_hex(6)}@example.com"
    estado, cuerpo = _registrar(correo, secrets.token_urlsafe(16))
    if estado >= 400:
        motivo = str(cuerpo.get("msg") or cuerpo)
        if "rate limit" in motivo.lower():
            pytest.skip(f"Supabase cortó por límite: {motivo}")
        pytest.fail(f"no se pudo crear la cuenta: {motivo}")

    uid = str(cuerpo.get("id") or cuerpo.get("user", {}).get("id"))

    with escritura(motor) as con:
        con.execute(text("delete from auth.users where id = :id"), {"id": uid})

    with lectura(motor) as con:
        perfiles = con.execute(
            text(f'select count(*) from "{ESQUEMA}".profiles where id = :id'),
            {"id": uid},
        ).scalar()
        categorias = con.execute(
            text(f'select count(*) from "{ESQUEMA}".categories where user_id = :id'),
            {"id": uid},
        ).scalar()

    assert perfiles == 0
    assert categorias == 0, f"quedaron {categorias} categorías huérfanas"


# ------------------------------------------- la función, bien construida


@sin_entorno
def test_la_funcion_del_trigger_esta_blindada(motor: Engine) -> None:
    """`security definer` sin `search_path` fijo es una puerta: quien
    pueda crear una tabla en un esquema anterior en el camino de
    búsqueda haría que la función escriba en la suya con permisos de
    dueño."""
    with lectura(motor) as con:
        fila = con.execute(
            text(
                "select p.prosecdef, p.proconfig from pg_proc p "
                "join pg_namespace n on n.oid = p.pronamespace "
                "where n.nspname = :e and p.proname = 'crear_perfil_y_categorias'"
            ),
            {"e": ESQUEMA},
        ).one_or_none()

    assert fila is not None, "la función del trigger no existe"
    assert fila[0] is True, "tiene que ser security definer para saltar RLS"
    assert fila[1] and any("search_path=" in c for c in fila[1]), f"no fija search_path: {fila[1]}"


@sin_entorno
def test_el_trigger_lleva_el_esquema_en_el_nombre(motor: Engine) -> None:
    """`auth.users` la comparten los dos esquemas (§4.1.1): cuando
    `public` se migre va a haber dos triggers sobre la misma tabla y los
    nombres no pueden chocar."""
    with lectura(motor) as con:
        nombres = {
            f[0]
            for f in con.execute(
                text(
                    "select tgname from pg_trigger t join pg_class c on c.oid = t.tgrelid "
                    "join pg_namespace n on n.oid = c.relnamespace "
                    "where n.nspname = 'auth' and c.relname = 'users' and not t.tgisinternal"
                )
            )
        }
    assert f"al_crear_usuario_{ESQUEMA}" in nombres, f"triggers encontrados: {nombres}"
