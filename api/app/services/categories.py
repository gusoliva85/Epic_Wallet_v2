"""Lógica de categorías: validación y coincidencia de tipo · F03-T08.

Referencia: 02_Documento_Tecnico.md §6.3, §9.4 · General §34, §37, §51

Funciones puras, sin base de datos — mismo criterio que
`services/months.py`. La restricción de nombre único por tipo
(`categories_unique_name_per_type`) ya la garantiza la base desde
F02-T04; lo que vive acá es lo que la base no puede decidir sola: si
un nombre y un tipo tienen la forma correcta, y si una categoría le
sirve a un movimiento de cierto tipo.

`tipo_coincide` no la usa nada todavía: la va a llamar
`POST`/`PUT /api/transactions` en F04 para no dejar que un ingreso use
una categoría de egreso (Técnico §6.3, fila "Categoría de ingreso no
sirve para egresos"). Se construye ahora, junto con el resto de la
lógica de categorías, para que F04 la encuentre hecha y no reinvente
el `if`.
"""

from __future__ import annotations

TIPOS = ("income", "expense")
LARGO_MAXIMO_NOMBRE = 60


def nombre_valido(name: str) -> bool:
    """1 a 60 caracteres, sin contar los espacios de los bordes
    (Técnico §9.4). Un nombre de puros espacios no es un nombre."""
    limpio = name.strip()
    return 1 <= len(limpio) <= LARGO_MAXIMO_NOMBRE


def tipo_valido(type_: str) -> bool:
    return type_ in TIPOS


def tipo_coincide(categoria_type: str, transaction_type: str) -> bool:
    """Regla 34 del documento general: una categoría de ingreso no le
    sirve a un egreso, y viceversa. Comparación directa porque los dos
    lados usan el mismo vocabulario (`"income"`/`"expense"`); el día
    que dejen de coincidir en forma, esta función es el único lugar
    que hay que tocar.
    """
    return categoria_type == transaction_type
