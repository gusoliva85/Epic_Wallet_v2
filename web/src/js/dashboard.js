/* El tablero de Inicio: indicadores (F05-T07), gráfico diario
   (F06-T02), gastos por categoría (F06-T05) y el orden por variación
   del desglose (F07-T03).
   Referencia: 01_Documento_General.md §12.2, §13, §15 ·
   02_Documento_Tecnico.md §9.2, §12.4-§12.6, §14.1

   El gráfico de "últimos seis meses" vivió acá (F06-T05) y se mudó a
   Historial (2026-10-17, pedido de Gustavo): no tenía que estar en el
   tablero de Inicio, y de paso se le sacaron los modos "ahorro" y
   "tasa" — queda siempre en barras. Ver `historial.js`.

   Pide `GET /api/dashboard?year&month` del mes que esté mostrando la
   barra de mes — mismo patrón que `movimientos.js` (F04-T12): un solo
   oyente de `barra-mes.EVENTO_CAMBIO` cubre arrancar, moverse de mes,
   y cualquier alta/edición/baja que invalide el caché de meses. Esa
   ÚNICA llamada alimenta las tarjetas, el gráfico diario y el desglose
   por categoría: por eso viven todos en este mismo archivo y
   comparten `cargando`/`fallo`/`dashboard` — una segunda llamada a
   `/api/dashboard` sólo para uno de ellos duplicaría exactamente lo
   que F05-T04 evitó.

   Cinco tarjetas, las que ya estaban maquetadas desde F01-T13: ahorro
   del mes (héroe), ingresos, egresos, gasto de hoy y total de ahorros.
   La última es el saldo acumulado de TODOS los meses (`savings_balance`
   de la API) — "ahorro del mes" es el del mes en pantalla, ésta es la
   suma de todos; no son la misma cifra apenas hay más de un mes
   cargado. "Patrimonio" (ahorro + inversiones) no vive acá: Gustavo lo
   quiere en la pantalla de Cartera, cuando exista la fase de
   inversiones (F10) — por ahora esta pantalla no muestra esa cifra en
   ningún lado. "Gasto de hoy" sólo tiene sentido mirando el mes actual:
   en cualquier otro mes se apaga con su propia explicación en vez de
   mezclar el día de hoy con un mes que no es éste.

   El gráfico diario (`daily`) es `null` en un mes histórico (Regla 4):
   ahí se muestra el estado de `consolidado()`, nunca una serie
   inventada. Las categorías no tienen ese problema: salen de totales
   por categoría que existen tanto para un mes abierto como uno
   histórico, así que se muestran siempre — sólo cambia el texto de
   cada fila (F06-T05, más abajo).

   "Gastos por categoría" filtra a `type === "expense"`: es un
   desglose de GASTO (General §15), no de todos los movimientos. */

import { api } from "./api.js";
import { esc, fmt, fmtS, fmtK, pct, pctPlano } from "./format.js";
import { tarjetaHeroe, tarjetaMetrica, pintarTarjetas, animarCifras } from "./components/kpi.js";
import { filaCategoria, pintarFilas } from "./components/rows.js";
import { bloqueCargando, error as estadoError, vacio, consolidado } from "./components/estados.js";
import { EVENTO_CAMBIO } from "./barra-mes.js";
import {
  dibujar as dibujarGraficoDiario,
  MODOS as MODOS_DIARIO,
  conectarLectura,
} from "./charts/diario.js";

const $ = (id) => document.getElementById(id);

function subVariacion(valor) {
  return valor == null ? "Primer mes registrado" : `${pct(valor)} vs. mes anterior`;
}

/** "Gasto de hoy" sólo tiene sentido en el mes que se está mirando
 * ahora: un mes abierto pero no actual (o uno histórico) no tiene un
 * "hoy" adentro, y mostrar el gasto de hoy ahí mezclaría dos meses
 * distintos en una sola tarjeta. `null` cuando no aplica. */
function gastoDeHoy(d) {
  if (!d.month.is_current || !d.daily) return null;
  return Number(d.daily.expense[d.daily.days - 1]);
}

function tarjetas(d) {
  const ind = d.indicators;
  const hoy = gastoDeHoy(d);

  return [
    tarjetaHeroe({
      etiqueta: "Ahorro del mes",
      cifra: fmtS(ind.saving),
      sub:
        d.month.saving_rate == null
          ? "Sin ingresos registrados"
          : `Tasa de ahorro ${pctPlano(d.month.saving_rate)} · ingresos menos egresos`,
      porcentaje: d.month.saving_rate == null ? 0 : Number(d.month.saving_rate),
      color: "sav",
    }),
    tarjetaMetrica({
      etiqueta: "Ingresos",
      cifra: fmt(ind.income),
      sub: subVariacion(ind.vs_previous.income),
      tarjeta: "inc",
    }),
    tarjetaMetrica({
      etiqueta: "Egresos",
      cifra: fmt(ind.expense),
      sub: subVariacion(ind.vs_previous.expense),
      tarjeta: "egr",
    }),
    tarjetaMetrica({
      etiqueta: "Gasto de hoy",
      cifra: hoy == null ? "—" : fmt(hoy),
      sub: hoy == null ? "Sólo para el mes actual" : "Total gastado hoy",
      tarjeta: "dia",
    }),
    tarjetaMetrica({
      etiqueta: "Total de ahorros",
      cifra: fmtS(ind.savings_balance),
      sub: "Sin inversiones — ver Patrimonio",
      tarjeta: "pat",
    }),
  ];
}

/** Mismo orden que `tarjetas()`: el valor numérico de verdad detrás de
 * cada cifra, y el formato con el que ya se pintó — así la animación
 * de conteo termina exactamente en el mismo texto que ya está en el
 * HTML. `null` donde no hay nada que contar (el "—" de "Gasto de hoy"
 * fuera del mes actual). */
function valoresParaContar(d) {
  const ind = d.indicators;
  const hoy = gastoDeHoy(d);
  return [
    { valor: Number(ind.saving), formatear: fmtS },
    { valor: Number(ind.income), formatear: fmt },
    { valor: Number(ind.expense), formatear: fmt },
    hoy == null ? null : { valor: hoy, formatear: fmt },
    { valor: Number(ind.savings_balance), formatear: fmtS },
  ];
}

// ===================================================================

let dashboard = null;
let cargando = true;
let fallo = false;
let ultimoPeriodo = null;
let modoDiario = "ambos";
let ordenCategorias = "mayor";

// ===================================================================
//  Gráfico diario (F06-T02)
// ===================================================================

function pintarGrafico() {
  const caja = $("grafico-diario");
  if (!caja) return;

  if (cargando) {
    caja.innerHTML = bloqueCargando("grafico", 1);
    return;
  }
  if (fallo || !dashboard) {
    caja.innerHTML = estadoError("No se pudo cargar el gráfico diario.");
    return;
  }
  if (dashboard.daily == null) {
    // Regla 4: un mes histórico no tiene movimientos individuales que
    // repartir por día, así que no hay serie que dibujar.
    caja.innerHTML = consolidado();
    return;
  }

  caja.innerHTML = dibujarGraficoDiario(dashboard.daily, modoDiario);
  // La lectura táctil (F06-T09) se conecta de nuevo en cada pintada:
  // el `<svg>` de arriba es nuevo cada vez (cambió el modo, el mes, o
  // se reintentó), así que no hay un `<svg>` viejo del que desprender
  // oyentes.
  conectarLectura(caja.querySelector("svg"), dashboard.daily, modoDiario);
}

function conectarModoDiario() {
  const grupo = $("diario-modo");
  grupo?.addEventListener("click", (ev) => {
    const boton = /** @type {HTMLElement} */ (ev.target).closest("button[data-modo]");
    if (!boton || !grupo.contains(boton)) return;
    const modo = boton.dataset.modo;
    if (!MODOS_DIARIO.includes(modo) || modo === modoDiario) return;
    modoDiario = modo;
    pintarGrafico();
  });
}

// ===================================================================
//  Gastos por categoría (F06-T05)
// ===================================================================

/** "DD/MM", sin año: todas las filas son del mismo mes en pantalla. */
function fechaCorta(iso) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function categoriasOrdenadas(categorias, orden) {
  // `[...gastos].sort(...)` y no `.toSorted(...)`: ES2022 (CLAUDE.md),
  // `toSorted` es ES2023.
  const gastos = categorias.filter((c) => c.type === "expense");
  if (orden === "az") return [...gastos].sort((a, b) => a.name.localeCompare(b.name, "es"));
  if (orden === "variacion") {
    // Mayor suba primero. `variation` es `null` cuando la categoría no
    // tuvo total el mes pasado (F07-T01) — sin nada que comparar, no
    // hay "más" ni "menos" que las demás, así que quedan al final y no
    // mezcladas en el medio por un 0 inventado.
    return [...gastos].sort((a, b) => {
      if (a.variation == null && b.variation == null) return 0;
      if (a.variation == null) return 1;
      if (b.variation == null) return -1;
      return Number(b.variation) - Number(a.variation);
    });
  }
  return [...gastos].sort((a, b) => Number(b.total) - Number(a.total));
}

/** Un mes histórico no tiene movimientos individuales (Regla 4): cada
 * categoría tiene su total pero `transaction_count` y `last_date`
 * quedan en 0/`null` — "Total consolidado" lo explica, en vez de un
 * "0 movimientos" que sería verdad en el papel y mentira en espíritu.
 *
 * El pie de la fila acompaña al orden elegido (F07-T03): ordenando
 * por variación, lo que importa ver ahí es justo la variación —la
 * última carga ya no explica por qué quedó en ese lugar de la lista.
 * En los otros dos órdenes sigue siendo la última carga, como antes. */
function filaDeCategoria(c, mesConsolidado) {
  return filaCategoria({
    id: c.category_id,
    nombre: c.name,
    total: fmt(c.total),
    detalle: mesConsolidado
      ? "Total consolidado"
      : `${c.transaction_count} movimiento${c.transaction_count === 1 ? "" : "s"} · ${pctPlano(c.share)} del gasto`,
    participacion: c.share == null ? 0 : Number(c.share),
    pie: ordenCategorias === "variacion" ? pct(c.variation) : c.last_date ? `últ. ${fechaCorta(c.last_date)}` : "—",
  });
}

function pintarCategorias() {
  const caja = $("categorias-inicio");
  if (!caja) return;

  if (cargando) {
    caja.innerHTML = bloqueCargando("fila", 4);
    return;
  }
  if (fallo || !dashboard) {
    caja.innerHTML = estadoError("No se pudieron cargar las categorías.");
    return;
  }

  const gastos = categoriasOrdenadas(dashboard.categories, ordenCategorias);
  if (gastos.length === 0) {
    caja.innerHTML = vacio("Sin gastos este mes", "Cuando cargues un egreso, va a aparecer acá.");
    return;
  }

  pintarFilas(caja, gastos.map((c) => filaDeCategoria(c, dashboard.month.consolidated)));
}

function conectarOrdenCategorias() {
  const grupo = $("categorias-orden");
  grupo?.addEventListener("click", (ev) => {
    const boton = /** @type {HTMLElement} */ (ev.target).closest("button[data-orden]");
    if (!boton || !grupo.contains(boton)) return;
    const orden = boton.dataset.orden;
    if (!["mayor", "az", "variacion"].includes(orden) || orden === ordenCategorias) return;
    ordenCategorias = orden;
    pintarCategorias();
  });
}

// ===================================================================
//  Las tarjetas (F05-T07)
// ===================================================================

function pintar() {
  const caja = $("kpis-inicio");
  if (caja) {
    if (cargando) {
      caja.innerHTML = bloqueCargando("tarjeta", 5);
    } else if (fallo || !dashboard) {
      caja.innerHTML = `<div style="grid-column: 1 / -1">${estadoError("No se pudieron cargar los indicadores.")}</div>`;
    } else {
      pintarTarjetas(caja, tarjetas(dashboard));
      animarCifras(caja, valoresParaContar(dashboard));
    }
  }

  pintarGrafico();
  pintarCategorias();
}

async function cargar(periodo) {
  ultimoPeriodo = periodo;
  cargando = true;
  fallo = false;
  pintar();

  const params = new URLSearchParams({
    year: String(periodo.year),
    month: String(periodo.month),
  });

  try {
    dashboard = await api.get(`/dashboard?${params.toString()}`);
    cargando = false;
  } catch (e) {
    dashboard = null;
    cargando = false;
    fallo = true;
    console.error("dashboard: no se pudieron pedir los indicadores", e);
  }
  pintar();
}

/** Un mismo "reintentar" para las tarjetas y los dos paneles: todos
 * fallan y se recuperan juntos, porque todos salen de la misma
 * llamada. */
function conectarReintentar() {
  const alReintentar = (ev) => {
    if (!/** @type {HTMLElement} */ (ev.target).closest("[data-reintentar]")) return;
    if (ultimoPeriodo) cargar(ultimoPeriodo);
  };
  $("kpis-inicio")?.addEventListener("click", alReintentar);
  $("grafico-diario")?.addEventListener("click", alReintentar);
  $("categorias-inicio")?.addEventListener("click", alReintentar);
}

// ===================================================================

export async function arrancar() {
  const caja = $("kpis-inicio");
  if (!caja) return;
  if (caja.dataset.conectado === "si") return;
  caja.dataset.conectado = "si";

  conectarReintentar();
  conectarModoDiario();
  conectarOrdenCategorias();

  document.addEventListener(EVENTO_CAMBIO, (ev) => {
    cargar(/** @type {CustomEvent} */ (ev).detail);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", arrancar);
} else {
  arrancar();
}
