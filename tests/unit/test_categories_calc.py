"""Lógica de categorías: validación y coincidencia de tipo · F03-T08."""

from __future__ import annotations

import pytest
from api.app.services import categories as servicio


@pytest.mark.unit
@pytest.mark.parametrize("nombre", ["Sueldo", "A", "x" * 60])
def test_nombres_de_largo_valido(nombre: str) -> None:
    assert servicio.nombre_valido(nombre) is True


@pytest.mark.unit
@pytest.mark.parametrize("nombre", ["", "   ", "x" * 61])
def test_nombres_fuera_de_rango(nombre: str) -> None:
    assert servicio.nombre_valido(nombre) is False


@pytest.mark.unit
def test_el_largo_se_mide_sin_los_espacios_de_los_bordes() -> None:
    # Un nombre de puros espacios no es un nombre, aunque mida menos
    # de 60 caracteres.
    assert servicio.nombre_valido("   ") is False
    assert servicio.nombre_valido("  Sueldo  ") is True


@pytest.mark.unit
@pytest.mark.parametrize("tipo", ["income", "expense"])
def test_los_dos_tipos_son_validos(tipo: str) -> None:
    assert servicio.tipo_valido(tipo) is True


@pytest.mark.unit
@pytest.mark.parametrize("tipo", ["", "ingreso", "INCOME", "egreso"])
def test_cualquier_otro_tipo_no_es_valido(tipo: str) -> None:
    assert servicio.tipo_valido(tipo) is False


@pytest.mark.unit
def test_una_categoria_de_ingreso_no_le_sirve_a_un_egreso() -> None:
    # Criterio de aceptación de la tarea (Regla 34 del general).
    assert servicio.tipo_coincide("income", "expense") is False
    assert servicio.tipo_coincide("expense", "income") is False


@pytest.mark.unit
def test_una_categoria_le_sirve_a_un_movimiento_del_mismo_tipo() -> None:
    assert servicio.tipo_coincide("income", "income") is True
    assert servicio.tipo_coincide("expense", "expense") is True
