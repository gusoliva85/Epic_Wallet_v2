"""Carga asistida de meses históricos desde un CSV · F08-T06.

    python scripts/load_history.py --csv documentacion/Backup_2026.csv --year 2026
    python scripts/load_history.py --csv documentacion/Backup_2026.csv --year 2026 --confirmar

Lee un CSV con el formato de la planilla de Gustavo (un bloque por mes,
"Sueldo" como ingreso principal, una fila por categoría de egreso) y lo
carga por la API real (`POST /api/months/historical`, F08-T03) — nunca
escribe directo a la base.

Sin `--confirmar` sólo muestra la vista previa: qué va a escribir, mes
por mes, y qué categorías son nuevas. Es el modo por defecto a
propósito (criterio de aceptación de la tarea: "muestra un resumen y
pide confirmación antes de escribir"). Con `--confirmar` pide además
una contraseña (nunca se guarda ni se loguea) para entrar con la
cuenta real y escribe.

Correrlo dos veces con los mismos datos no duplica nada: crear una
categoría que ya existe no la duplica (se resuelve por nombre antes de
crear), y `POST /api/months/historical` ya es un "crear o actualizar"
sobre el mismo año/mes (F08-T03).

Regla 7 del documento general — comprar una inversión no es un gasto—:
las filas "Inversiones" se excluyen del total de egresos y no se
cargan todavía (no existe la Fase 10). El script las muestra aparte,
nunca las manda a la API.
"""

from __future__ import annotations

import argparse
import csv
import getpass
import io
import json
import sys
import unicodedata
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

RAIZ = Path(__file__).resolve().parent.parent

MESES = {
    "enero": 1,
    "febrero": 2,
    "marzo": 3,
    "abril": 4,
    "mayo": 5,
    "junio": 6,
    "julio": 7,
    "agosto": 8,
    "septiembre": 9,
    "setiembre": 9,
    "octubre": 10,
    "noviembre": 11,
    "diciembre": 12,
}

# Nombre tal cual aparece en la planilla, en minúscula y sin tocar
# acentos (eso ya lo resuelve `normalizar`) -> nombre real que hay que
# buscar o crear. Sólo los casos que `normalizar` no alcanza a arreglar
# por sí sola (un typo, no un acento).
ALIAS_DE_CATEGORIA = {
    "da vincci": "Da Vinci",
}

CENT = Decimal("0.01")


# ===================================================================
#  Parseo puro — sin red, sin IO más que el texto que le pasen
# ===================================================================


@dataclass
class MesHistorico:
    """Un bloque "Mes,<nombre>," ya resuelto a números."""

    year: int
    month: int
    nombre: str
    income_total: Decimal = Decimal("0.00")
    expense_total: Decimal = Decimal("0.00")
    categorias: dict[str, Decimal] = field(default_factory=dict)
    ingresos_extra: dict[str, Decimal] = field(default_factory=dict)
    inversiones: Decimal = Decimal("0.00")

    @property
    def saving_total(self) -> Decimal:
        return self.income_total - self.expense_total


@dataclass
class HistorialParseado:
    saldo_anterior: Decimal | None
    meses: list[MesHistorico]


def parsear_monto(texto: str) -> Decimal:
    """«$ 2,993,978» -> Decimal("2993978.00"). Vacío -> cero."""
    limpio = texto.strip().replace("$", "").replace(" ", "").replace(",", "")
    if not limpio:
        return Decimal("0.00")
    try:
        return Decimal(limpio).quantize(CENT)
    except InvalidOperation:
        raise ValueError(f"no se pudo leer el importe {texto!r}") from None


def normalizar(nombre: str) -> str:
    """Minúscula y sin acentos, para comparar «Mercaderia» con
    «Mercadería» como si fueran el mismo nombre."""
    sin_acentos = unicodedata.normalize("NFKD", nombre).encode("ascii", "ignore").decode("ascii")
    return sin_acentos.strip().lower()


def parsear_csv(texto: str, year: int) -> HistorialParseado:
    """El formato de la planilla: una fila "Saldo anterior,<monto>,"
    antes de todo; después, bloques "Mes,<nombre>," seguidos de una
    fila por categoría. Cada fila de categoría puede traer un importe
    en la columna de ingreso, en la de egreso, o en las dos a la vez
    (es el caso de un ingreso suelto —un reintegro, una venta— anotado
    en la misma fila que un gasto habitual de ese nombre, p. ej.
    "Otros" o "Tarjeta").

    "Inversiones" es la única categoría que no se suma al egreso del
    mes (Regla 7, General §23): queda registrada aparte, para mostrar
    en la vista previa, nunca para mandar a la API.
    """
    saldo_anterior: Decimal | None = None
    meses: list[MesHistorico] = []
    actual: MesHistorico | None = None

    for fila in csv.reader(io.StringIO(texto)):
        columnas = [c.strip() for c in fila] + ["", "", ""]
        etiqueta, col_ingreso, col_egreso = columnas[0], columnas[1], columnas[2]

        if not etiqueta and not col_ingreso and not col_egreso:
            continue

        if etiqueta == "Saldo anterior":
            saldo_anterior = parsear_monto(col_ingreso)
            continue

        if etiqueta == "Mes":
            nombre_mes = col_ingreso.strip().lower()
            if nombre_mes not in MESES:
                raise ValueError(f"no reconozco el mes {col_ingreso!r}")
            actual = MesHistorico(year=year, month=MESES[nombre_mes], nombre=col_ingreso.strip())
            meses.append(actual)
            continue

        if actual is None:
            raise ValueError(f"la fila {fila!r} aparece antes de cualquier «Mes,...»")

        if col_ingreso:
            monto = parsear_monto(col_ingreso)
            actual.income_total += monto
            if not etiqueta.lower().startswith("sueldo"):
                actual.ingresos_extra[etiqueta] = actual.ingresos_extra.get(etiqueta, Decimal("0")) + monto

        if col_egreso:
            monto = parsear_monto(col_egreso)
            if normalizar(etiqueta) == "inversiones":
                actual.inversiones += monto
            else:
                actual.expense_total += monto
                actual.categorias[etiqueta] = actual.categorias.get(etiqueta, Decimal("0")) + monto

    return HistorialParseado(saldo_anterior=saldo_anterior, meses=meses)


def resolver_categoria(etiqueta: str) -> str:
    """El nombre real a buscar o crear para esta etiqueta de la
    planilla: aplica el alias manual si existe, tal cual si no."""
    return ALIAS_DE_CATEGORIA.get(normalizar(etiqueta), etiqueta)


# ===================================================================
#  Vista previa — texto, sin tocar la red
# ===================================================================


def armar_vista_previa(historial: HistorialParseado, existentes: set[str]) -> str:
    """`existentes` son los nombres de categoría de tipo `expense` que
    ya tiene la cuenta, normalizados. Lo que no está ahí se muestra
    como «categoría nueva»."""
    salida: list[str] = []

    if historial.saldo_anterior is not None:
        salida.append(f"Saldo inicial del perfil -> {historial.saldo_anterior:,.2f}")
        salida.append("")

    nuevas: set[str] = set()
    for mes in historial.meses:
        salida.append(f"=== {mes.nombre} {mes.year} ===")
        salida.append(f"  Ingresos:  {mes.income_total:>15,.2f}")
        for etiqueta, monto in mes.ingresos_extra.items():
            salida.append(f"             + {etiqueta}: {monto:,.2f}")
        salida.append(f"  Egresos:   {mes.expense_total:>15,.2f}")
        salida.append(f"  Ahorro:    {mes.saving_total:>15,.2f}")
        if mes.inversiones:
            salida.append(
                f"  (Inversiones de este mes, EXCLUIDAS del egreso: {mes.inversiones:,.2f} "
                "— quedan para cuando exista la Fase 10)"
            )
        salida.append("  Categorías:")
        for etiqueta, monto in sorted(mes.categorias.items(), key=lambda kv: -kv[1]):
            nombre_real = resolver_categoria(etiqueta)
            es_nueva = normalizar(nombre_real) not in existentes
            marca = " (nueva)" if es_nueva else ""
            if es_nueva:
                nuevas.add(nombre_real)
            salida.append(f"    {nombre_real:<28} {monto:>12,.2f}{marca}")
        salida.append("")

    if nuevas:
        salida.append(f"Categorías nuevas a crear ({len(nuevas)}): " + ", ".join(sorted(nuevas)))
    else:
        salida.append("No hace falta crear ninguna categoría nueva.")

    return "\n".join(salida)


# ===================================================================
#  Lo que sí toca la red — login, lectura y escritura por la API
# ===================================================================


def _leer_env() -> dict[str, str]:
    archivo = RAIZ / ".env"
    if not archivo.exists():
        sys.exit("falta .env — copialo de .env.example y completalo")
    datos: dict[str, str] = {}
    for linea in archivo.read_text(encoding="utf-8").splitlines():
        if "=" not in linea or linea.strip().startswith("#"):
            continue
        clave, _, valor = linea.partition("=")
        datos[clave.strip()] = valor.strip().strip("\"'")
    return datos


def _pedir_token(supabase_url: str, anon_key: str) -> str:
    print("\nEntrá con tu cuenta real de Epic Wallet (nunca se guarda la contraseña).")
    correo = input("  Email: ").strip()
    clave = getpass.getpass("  Contraseña: ")

    cuerpo = json.dumps({"email": correo, "password": clave}).encode()
    req = urllib.request.Request(  # noqa: S310
        f"{supabase_url}/auth/v1/token?grant_type=password",
        data=cuerpo,
        headers={
            "apikey": anon_key,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as r:  # noqa: S310
            sesion = json.loads(r.read())
    except urllib.error.HTTPError as e:
        detalle = json.loads(e.read() or b"{}")
        sys.exit(f"no se pudo iniciar sesión: {detalle.get('error_description') or detalle}")

    token = sesion.get("access_token")
    if not token:
        sys.exit("Supabase no devolvió un token de acceso")
    return str(token)


def _api(base_url: str, token: str, metodo: str, ruta: str, cuerpo: dict[str, Any] | None = None) -> Any:
    datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
    req = urllib.request.Request(  # noqa: S310
        f"{base_url}{ruta}",
        data=datos,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method=metodo,
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:  # noqa: S310
            return json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        detalle = json.loads(e.read() or b"{}")
        raise RuntimeError(f"{metodo} {ruta} -> {e.code}: {detalle}") from None


def _categorias_de_egreso(base_url: str, token: str) -> dict[str, int]:
    """Nombre normalizado -> id, sólo las de tipo `expense`."""
    categorias = _api(base_url, token, "GET", "/categories?type=expense")
    return {normalizar(c["name"]): c["id"] for c in categorias}


def _asegurar_categorias(base_url: str, token: str, nombres: set[str], existentes: dict[str, int]) -> None:
    for nombre in sorted(nombres):
        if normalizar(nombre) in existentes:
            continue
        creada = _api(base_url, token, "POST", "/categories", {"name": nombre, "type": "expense"})
        existentes[normalizar(nombre)] = creada["id"]
        print(f"  creada categoría «{nombre}»")


def escribir(base_url: str, token: str, historial: HistorialParseado) -> None:
    if historial.saldo_anterior is not None:
        _api(base_url, token, "PATCH", "/me", {"opening_balance": str(historial.saldo_anterior)})
        print(f"saldo inicial del perfil -> {historial.saldo_anterior:,.2f}")

    existentes = _categorias_de_egreso(base_url, token)
    todas_las_etiquetas = {
        resolver_categoria(etq) for mes in historial.meses for etq in mes.categorias
    }
    _asegurar_categorias(base_url, token, todas_las_etiquetas, existentes)

    for mes in historial.meses:
        categorias = [
            {"category_id": existentes[normalizar(resolver_categoria(etq))], "total_amount": str(monto)}
            for etq, monto in mes.categorias.items()
        ]
        cuerpo = {
            "year": mes.year,
            "month": mes.month,
            "income_total": str(mes.income_total),
            "expense_total": str(mes.expense_total),
            "saving_total": str(mes.saving_total),
            "categories": categorias,
        }
        _api(base_url, token, "POST", "/months/historical", cuerpo)
        print(f"  {mes.nombre} {mes.year}: cargado (ahorro {mes.saving_total:,.2f})")


# ===================================================================
#  CLI
# ===================================================================


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--csv", required=True, type=Path, help="ruta al CSV de la planilla")
    ap.add_argument("--year", required=True, type=int, help="año al que corresponden todos los meses")
    ap.add_argument("--base-url", default="http://localhost:8000/api", help="base de la API")
    ap.add_argument(
        "--confirmar", action="store_true", help="escribe de verdad; sin esto sólo muestra la vista previa"
    )
    args = ap.parse_args()

    if not args.csv.exists():
        sys.exit(f"no existe {args.csv}")
    historial = parsear_csv(args.csv.read_text(encoding="utf-8"), args.year)
    if not historial.meses:
        sys.exit("el CSV no tiene ningún bloque «Mes,...»")

    env = _leer_env()
    supabase_url = env.get("SUPABASE_URL", "").rstrip("/")
    anon_key = env.get("SUPABASE_ANON_KEY", "")
    if not supabase_url or not anon_key:
        sys.exit("faltan SUPABASE_URL / SUPABASE_ANON_KEY en .env")

    token = _pedir_token(supabase_url, anon_key)
    existentes = _categorias_de_egreso(args.base_url, token)

    print("\n" + armar_vista_previa(historial, set(existentes)) + "\n")

    if not args.confirmar:
        print("Vista previa solamente. Volvé a correr con --confirmar para escribir de verdad.")
        return 0

    respuesta = input("¿Confirmás escribir esto en tu cuenta real? [s/N] ").strip().lower()
    if respuesta != "s":
        print("Cancelado, no se escribió nada.")
        return 0

    escribir(args.base_url, token, historial)
    print("\nListo.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
