"""Repositorio y servicio de meses · F03-T03.

Se prueba contra Postgres real, con cuentas reales de Supabase —mismo
criterio que `test_me.py`—, pero sin pasar por HTTP: todavía no existe
el endpoint (F03-T05), así que se llama al repositorio y al servicio
directamente con una `Session` de `db.sesion_de_usuario(uid)`, que es
la misma sesión con RLS activo que usan los endpoints que sí existen.

Los tres criterios de aceptación de la tarea, cada uno con su prueba:
dos meses iguales del mismo usuario se rechazan en la base, el mes
actual se crea sólo la primera vez, y el `downgrade` ya se probó a
mano contra producción (ver el mensaje del commit) — acá se prueba lo
que sí se puede automatizar.
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
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from tests.api.ayudas_db import escritura, motor_de_pruebas

RAIZ = Path(__file__).resolve().parents[2]
pytestmark = pytest.mark.api


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
ESQUEMA = _del_env("DB_SCHEMA") or "public"

sin_entorno = pytest.mark.skipif(
    not (URL_BASE and SUPABASE and ANON) or str(URL_BASE).startswith("sqlite"),
    reason="hacen falta Postgres y las credenciales de Supabase",
)


def _auth(ruta: str, cuerpo: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    req = urllib.request.Request(
        f"{SUPABASE}/auth/v1{ruta}",
        data=json.dumps(cuerpo).encode(),
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


def _crear_cuenta() -> str:
    """Crea una cuenta real y devuelve su uid. Alcanza con el uid: acá
    no se habla por HTTP, así que no hace falta el token."""
    correo = f"epicwallet.months.{secrets.token_hex(6)}@example.com"
    clave = secrets.token_urlsafe(16)

    estado, cuerpo = _auth("/signup", {"email": correo, "password": clave})
    if estado >= 400:
        motivo = str(cuerpo.get("msg") or cuerpo)
        if "rate limit" in motivo.lower():
            pytest.skip(f"Supabase cortó por límite: {motivo}")
        pytest.fail(f"no se pudo crear la cuenta: {motivo}")

    uid = str(cuerpo.get("id") or cuerpo.get("user", {}).get("id"))
    assert uid and uid != "None", "la cuenta se creó pero no hay uid"
    return uid


@pytest.fixture(scope="module")
def motor():
    return motor_de_pruebas(str(URL_BASE))


@pytest.fixture(scope="module")
def db():
    from api.app.core import db as modulo

    return modulo


@pytest.fixture(scope="module")
def cuentas(motor) -> Iterator[tuple[str, str]]:
    """Dos cuentas para todo el módulo, no una por prueba: el límite
    de registro de Supabase corta si se crean demasiadas seguidas."""
    a = _crear_cuenta()
    b = _crear_cuenta()
    yield a, b
    with escritura(motor) as con:
        con.execute(text("delete from auth.users where id = any(:ids)"), {"ids": [a, b]})


@pytest.fixture
def limpiar_meses(motor, cuentas):
    """Antes de cada prueba, sin meses cargados: cada una arranca de
    cero y no depende de lo que dejó la anterior."""
    a, b = cuentas

    def _limpiar() -> None:
        with escritura(motor) as con:
            con.execute(
                text(f'delete from "{ESQUEMA}".months where user_id = any(:ids)'),
                {"ids": [a, b]},
            )

    _limpiar()
    yield
    _limpiar()


# ===================================================================
#  Crear y buscar
# ===================================================================


@sin_entorno
def test_crear_y_buscar_por_periodo(db, cuentas: tuple[str, str], limpiar_meses) -> None:
    from api.app.repos import months as repos

    a, _ = cuentas
    with db.sesion_de_usuario(a) as sesion:
        creado = repos.crear(sesion, user_id=a, year=2026, month=10, status="open")
        assert creado.id is not None
        assert creado.status == "open"

        encontrado = repos.buscar_por_periodo(sesion, 2026, 10)
        assert encontrado is not None
        assert encontrado.id == creado.id


@sin_entorno
def test_buscar_un_periodo_que_no_existe_da_none(db, cuentas: tuple[str, str], limpiar_meses) -> None:
    from api.app.repos import months as repos

    a, _ = cuentas
    with db.sesion_de_usuario(a) as sesion:
        assert repos.buscar_por_periodo(sesion, 2026, 10) is None


# ===================================================================
#  Dos meses iguales se rechazan en la base
# ===================================================================


@sin_entorno
def test_dos_meses_iguales_del_mismo_usuario_se_rechazan(
    db, cuentas: tuple[str, str], limpiar_meses
) -> None:
    """Criterio de aceptación de la tarea. `months_unique_per_user` es
    quien lo impide, no el repositorio —que no comprueba nada antes de
    insertar—: esto prueba la restricción, no una validación de más."""
    from api.app.repos import months as repos

    a, _ = cuentas
    with db.sesion_de_usuario(a) as sesion:
        repos.crear(sesion, user_id=a, year=2026, month=10, status="open")
        with pytest.raises(IntegrityError):
            repos.crear(sesion, user_id=a, year=2026, month=10, status="open")
        # Postgres abortó la transacción entera con el `insert` que
        # falló; sin este rollback, el `commit()` con el que
        # `sesion_de_usuario` cierra el `with` de afuera fallaría con
        # un error de SQLAlchemy distinto del que esta prueba quiere
        # comprobar.
        sesion.rollback()


@sin_entorno
def test_el_mismo_mes_en_dos_cuentas_distintas_no_choca(
    db, cuentas: tuple[str, str], limpiar_meses
) -> None:
    """La restricción es por usuario, no global: dos cuentas pueden
    tener cada una su octubre 2026."""
    from api.app.repos import months as repos

    a, b = cuentas
    with db.sesion_de_usuario(a) as sesion:
        repos.crear(sesion, user_id=a, year=2026, month=10, status="open")
    with db.sesion_de_usuario(b) as sesion:
        repos.crear(sesion, user_id=b, year=2026, month=10, status="open")  # no debe lanzar


# ===================================================================
#  abrir_mes_actual: se crea una sola vez
# ===================================================================


@sin_entorno
def test_abrir_mes_actual_lo_crea_la_primera_vez(
    db, motor, cuentas: tuple[str, str], limpiar_meses
) -> None:
    import datetime as dt

    from api.app.services import months as servicio

    a, _ = cuentas
    ahora = dt.datetime(2026, 10, 15, 12, 0, tzinfo=servicio.ZONA_APP)

    with db.sesion_de_usuario(a) as sesion:
        mes = servicio.abrir_mes_actual(sesion, a, ahora=ahora)
        assert mes.year == 2026
        assert mes.month == 10
        assert mes.status == "open"
        assert mes.income_total == 0

    with escritura(motor) as con:
        cuantos = con.execute(
            text(f'select count(*) from "{ESQUEMA}".months where user_id = :id'), {"id": a}
        ).scalar()
    assert cuantos == 1


@sin_entorno
def test_abrir_mes_actual_no_duplica_al_llamarse_dos_veces(
    db, motor, cuentas: tuple[str, str], limpiar_meses
) -> None:
    """Criterio de aceptación de la tarea, con las dos llamadas en
    transacciones separadas —como pasaría de verdad entre dos
    peticiones HTTP distintas, no dentro de la misma sesión."""
    import datetime as dt

    from api.app.services import months as servicio

    a, _ = cuentas
    ahora = dt.datetime(2026, 10, 15, 12, 0, tzinfo=servicio.ZONA_APP)

    with db.sesion_de_usuario(a) as sesion:
        primero = servicio.abrir_mes_actual(sesion, a, ahora=ahora)

    with db.sesion_de_usuario(a) as sesion:
        segundo = servicio.abrir_mes_actual(sesion, a, ahora=ahora)

    assert primero.id == segundo.id

    with escritura(motor) as con:
        cuantos = con.execute(
            text(f'select count(*) from "{ESQUEMA}".months where user_id = :id'), {"id": a}
        ).scalar()
    assert cuantos == 1, "abrir_mes_actual duplicó el mes"


# ===================================================================
#  listar y el aislamiento entre cuentas
# ===================================================================


@sin_entorno
def test_listar_ordena_del_mes_mas_nuevo_al_mas_viejo(
    db, cuentas: tuple[str, str], limpiar_meses
) -> None:
    from api.app.repos import months as repos

    a, _ = cuentas
    with db.sesion_de_usuario(a) as sesion:
        repos.crear(sesion, user_id=a, year=2026, month=8, status="historical")
        repos.crear(sesion, user_id=a, year=2026, month=10, status="open")
        repos.crear(sesion, user_id=a, year=2025, month=12, status="historical")

        periodos = [(m.year, m.month) for m in repos.listar(sesion)]
        assert periodos == [(2026, 10), (2026, 8), (2025, 12)]


@sin_entorno
def test_los_meses_de_una_cuenta_no_aparecen_en_la_otra(
    db, cuentas: tuple[str, str], limpiar_meses
) -> None:
    """`repos.listar` no filtra por `user_id` en la consulta (ver su
    docstring): si esto pasa, es RLS haciendo el trabajo, no un
    `where` que alguien podría borrar sin darse cuenta."""
    from api.app.repos import months as repos

    a, b = cuentas
    with db.sesion_de_usuario(a) as sesion:
        repos.crear(sesion, user_id=a, year=2026, month=10, status="open")

    with db.sesion_de_usuario(b) as sesion:
        de_b = repos.listar(sesion)

    assert de_b == [], "una cuenta vio meses de la otra"
