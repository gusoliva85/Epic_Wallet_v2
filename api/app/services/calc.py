"""Cálculos del dashboard · F05-T01.

Referencia: 02_Documento_Tecnico.md §7, §7.1 · General §12.2, §52

Funciones puras, sin base de datos — mismo criterio que
`services/months.py`, `services/categories.py` y la mitad de
`services/transactions.py`: reciben números (o listas de números) y
devuelven números. Ninguna suma `transactions` ni `months`; eso ya lo
hace `services.transactions.recalcular_mes` (F04-T05) o lo hace quien
llame a estas funciones con lo que haya leído de la base.

Los seis indicadores de General §12.2, cada uno con su función:
ingresos y gastos salen directo de `months.income_total`/
`expense_total` (ya los calcula F04, no hace falta otra función para
sumarlos de nuevo), y los cuatro restantes son los de acá —ahorro del
mes, ahorro acumulado, total de inversiones y patrimonio neto—, más la
tasa de ahorro que acompaña al ahorro del mes y la serie diaria del
gráfico principal (General §13).
"""

from __future__ import annotations

import decimal

from .months import HISTORICO

CENT = decimal.Decimal("0.01")


def money(valor: decimal.Decimal) -> decimal.Decimal:
    """Redondeo contable a dos decimales. Por esto, y no por azar,
    toda esta familia de funciones recibe y devuelve `Decimal`: un
    `float` de por medio arrastra el error de redondeo a cada cálculo
    que lo use después (Técnico §6.1)."""
    return decimal.Decimal(valor).quantize(CENT, rounding=decimal.ROUND_HALF_UP)


def ahorro_del_mes(ingresos: decimal.Decimal, gastos: decimal.Decimal) -> decimal.Decimal:
    """Reglas 5 y 6 del documento general: el ingreso aumenta el
    ahorro, el egreso lo disminuye. Negativo es un resultado válido
    —se gastó más de lo que entró—, no un error que haya que impedir
    acá (Técnico §7.1)."""
    return money(ingresos - gastos)


def participacion(parte: decimal.Decimal, total: decimal.Decimal) -> decimal.Decimal | None:
    """Qué porcentaje es `parte` de `total`. `None` con `total` en
    cero — nunca una división (Técnico §7.1, primera fila). Es la
    forma general detrás de `tasa_de_ahorro` (el ahorro sobre los
    ingresos) y del `share` de cada categoría en el desglose del
    dashboard (F05-T04): la misma cuenta, dos nombres según de dónde
    se la mire."""
    if total == 0:
        return None
    return money(parte / total * 100)


def porcentajes_de_categorias(
    totales: list[decimal.Decimal], total_general: decimal.Decimal
) -> list[decimal.Decimal | None]:
    """El `share` de cada total en `totales` sobre `total_general`, en
    el mismo orden — pero a diferencia de llamar `participacion()` una
    vez por categoría, acá la suma de los porcentajes da EXACTAMENTE
    100,00 (criterio de aceptación de F07-T01, General §15). Redondear
    cada uno por separado puede dejar la suma en 99,99 o 100,01 aunque
    cada individual esté bien redondeado: tres categorías con un
    tercio cada una dan 33,33 + 33,33 + 33,33 = 99,99.

    El método es el del mayor resto (Hare-Niemeyer, el mismo que usan
    varios sistemas electorales para repartir bancas sin perder
    ninguna): cada total se redondea hacia abajo, y el centavo de
    porcentaje que falta para llegar a 100 se reparte, de a uno, entre
    las categorías que más cerca estaban de redondear hacia arriba.

    `None` para todas con `total_general` en cero — nunca una
    división, mismo criterio que `participacion()`."""
    if total_general == 0:
        return [None] * len(totales)

    crudos = [t / total_general * 100 for t in totales]
    pisos = [c.quantize(CENT, rounding=decimal.ROUND_DOWN) for c in crudos]
    restos = [c - p for c, p in zip(crudos, pisos, strict=True)]

    # Cuántos centavos de porcentaje faltan para llegar a 100,00. Nunca
    # negativo ni mayor que `len(totales)`: redondear hacia abajo no
    # puede perder un centavo entero por total. El `max/min` es sólo
    # una red de seguridad para el día en que un histórico (F08) cargue
    # categorías que no sumen justo el total del mes.
    faltan = int((decimal.Decimal("100.00") - sum(pisos)) / CENT)
    faltan = max(0, min(faltan, len(totales)))

    # Los índices con mayor resto se llevan el centavo que falta, uno
    # por uno. `sorted` es estable: un empate en el resto lo resuelve
    # el orden en que llegaron los totales, siempre igual para la
    # misma entrada.
    orden = sorted(range(len(totales)), key=lambda i: restos[i], reverse=True)
    corregidos = set(orden[:faltan])
    resultado: list[decimal.Decimal | None] = [
        piso + CENT if i in corregidos else piso for i, piso in enumerate(pisos)
    ]
    return resultado


def tasa_de_ahorro(
    ingresos: decimal.Decimal, ahorro: decimal.Decimal
) -> decimal.Decimal | None:
    """`None` con ingresos en cero — nunca `0%` ni una división
    (criterio de aceptación de la tarea; Técnico §7.1, primera fila).
    La interfaz es quien decide mostrar «N/A» con ese `None`, acá sólo
    se evita la división por cero."""
    return participacion(ahorro, ingresos)


def variacion_porcentual(
    actual: decimal.Decimal, anterior: decimal.Decimal
) -> decimal.Decimal | None:
    """Cuánto cambió `actual` respecto de `anterior`, en porcentaje —
    el `vs_previous` del contrato del dashboard (Técnico §9.2).
    `None` con `anterior` en cero: no hay variación que calcular desde
    la nada, mismo criterio que el resto de esta familia.

    Se divide por el `abs()` de `anterior` y no por `anterior` tal
    cual: el ahorro de un mes puede ser negativo, y dividir por un
    número negativo invierte el signo del resultado — pasar de
    -$100.000 a -$50.000 es una mejora (el ahorro aumentó) y tiene que
    dar positivo, no negativo.
    """
    if anterior == 0:
        return None
    return money((actual - anterior) / abs(anterior) * 100)


def ahorro_acumulado(
    saldo_inicial: decimal.Decimal, ahorros_mensuales: list[decimal.Decimal]
) -> decimal.Decimal:
    """General §52: saldo inicial más la suma de los ahorros
    mensuales. La cadena mes a mes —qué meses entran en esa lista y
    cómo se propaga al cargar un histórico— es de F08 y F09; acá sólo
    se suma lo que ya le llega armado."""
    return money(saldo_inicial + sum(ahorros_mensuales, decimal.Decimal("0")))


def serie_de_ahorro_acumulado(
    saldo_inicial: decimal.Decimal, ahorros_mensuales: list[decimal.Decimal]
) -> list[decimal.Decimal]:
    """La misma cuenta de `ahorro_acumulado`, pero devuelve el saldo al
    final de CADA mes en vez de sólo el del último: la serie que pide
    el gráfico de evolución del ahorro (General §54, Gráfico 4), un
    punto por mes. `ahorros_mensuales` tiene que venir del más viejo
    al más nuevo —acá sólo se encadena la suma, el orden ya tiene que
    traerlo quien llama."""
    serie: list[decimal.Decimal] = []
    corrida = saldo_inicial
    for ahorro in ahorros_mensuales:
        corrida = money(corrida + ahorro)
        serie.append(corrida)
    return serie


def total_de_inversiones(valores_actuales: list[decimal.Decimal]) -> decimal.Decimal:
    """General §22: "valor actual de cartera", la suma del valor
    actual de cada posición (`valor_de_inversion`, más abajo, valúa
    cada una)."""
    return money(sum(valores_actuales, decimal.Decimal("0")))


def total_invertido(valores_iniciales: list[decimal.Decimal]) -> decimal.Decimal:
    """General §22: la suma del valor inicial de cada posición —lo que
    se puso, no lo que vale hoy. Es la base del "resultado de
    cartera" (`rendimiento_de_inversion` con los dos totales) y del
    rendimiento porcentual de la cartera entera."""
    return money(sum(valores_iniciales, decimal.Decimal("0")))


def rendimiento_de_inversion(
    valor_actual: decimal.Decimal, valor_inicial: decimal.Decimal
) -> decimal.Decimal:
    """General §22: cuánto ganó o perdió la posición, en pesos —la
    misma cuenta sirve para una posición sola o para la cartera entera
    (valor actual total menos invertido total, "resultado de
    cartera"). Regla 9: este número no es un ingreso del mes —nadie lo
    suma a `income_total`—, es un dato de la cartera, aparte del flujo
    mensual de F04/F05."""
    return money(valor_actual - valor_inicial)


def rendimiento_porcentual(
    valor_actual: decimal.Decimal, valor_inicial: decimal.Decimal
) -> decimal.Decimal | None:
    """General §22: el mismo rendimiento, en porcentaje sobre lo
    invertido. `None` con el valor inicial en cero —"si el valor
    inicial es cero, el porcentaje no se calcula", textual del
    documento general—, nunca una división.

    Es la misma cuenta que `variacion_porcentual`: el valor inicial de
    una inversión nunca es negativo (`check (initial_value >= 0)` en
    la base), así que dividir por su `abs()` o por él mismo da
    exactamente lo mismo acá. Se nombra aparte porque es un concepto
    distinto —el rendimiento de una posición, no un mes contra el
    anterior— y así se puede tocar uno sin pensar en el otro."""
    return variacion_porcentual(valor_actual, valor_inicial)


def total_de_pasivos(montos: list[decimal.Decimal]) -> decimal.Decimal:
    """General §5.3: la suma de los pasivos activos. La tabla
    `liabilities` se crea vacía (F09-T03, Técnico §6.2) y no hay
    pantalla para cargar un pasivo en el MVP, así que en la práctica
    esta lista siempre llega vacía y el total da cero — pero
    `patrimonio_neto` ya resta un total de verdad, no un cero fijo,
    así que el día que exista un alta no hace falta tocar ningún
    cálculo."""
    return money(sum(montos, decimal.Decimal("0")))


def patrimonio_neto(
    ahorros: decimal.Decimal,
    inversiones: decimal.Decimal,
    otros_activos: decimal.Decimal = decimal.Decimal("0"),
    pasivos: decimal.Decimal = decimal.Decimal("0"),
) -> decimal.Decimal:
    """General §52: ahorros más inversiones menos pasivos.
    `otros_activos` no está en esa fórmula textual pero sí en el
    técnico (§7); default en cero, así que sin pasivos ni otros
    activos cargados —la cuenta no tiene F09 ni F10 todavía— da
    exactamente ahorros más inversiones, sin que nadie tenga que
    acordarse de pasar ceros a mano."""
    return money(ahorros + inversiones + otros_activos - pasivos)


def serie_de_ahorro_diaria(
    status: str,
    ingresos_por_dia: list[decimal.Decimal],
    egresos_por_dia: list[decimal.Decimal],
) -> list[decimal.Decimal] | None:
    """El ahorro acumulado día a día del mes, para la línea del
    gráfico principal (General §13). `None` para un mes histórico
    —nunca una lista, ni vacía—: no tiene movimientos individuales que
    repartir por día (Regla 4), mismo contrato exacto que
    `services.months.transacciones_del_mes` ya usa para `transactions`
    en el detalle de un mes.

    Las dos listas tienen que venir de igual longitud —un valor por
    día ya transcurrido del mes; si no coinciden, `zip(strict=True)`
    lo rechaza con `ValueError` en vez de truncar en silencio—. Con el
    mes vacío (listas de ceros) el acumulado da cero en todos los
    días, no un error.
    """
    if status == HISTORICO:
        return None

    serie: list[decimal.Decimal] = []
    acumulado = decimal.Decimal("0")
    for ingreso, egreso in zip(ingresos_por_dia, egresos_por_dia, strict=True):
        acumulado += ingreso - egreso
        serie.append(money(acumulado))
    return serie
