"""Las 21 categorías con las que nace una cuenta.

Referencia: 01_Documento_General.md §7.1 y §7.2

Esta lista está **dos veces**: acá y en el SQL del trigger de F02-T04.
No es un descuido, es inevitable: el trigger corre dentro de Postgres y
no puede leer Python, y `bootstrap` corre en el backend y no puede
llamar al trigger.

Lo que sí se puede evitar es que se desincronicen sin que nadie se
entere: `tests/unit/test_categorias_iniciales.py` compara las dos
listas contra el documento general y falla si alguna se mueve.
"""

from __future__ import annotations

from typing import Final

# El orden importa: es el que ve el usuario en las listas y el que
# guarda `sort_order`.
INICIALES: Final[tuple[tuple[str, str], ...]] = (
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
