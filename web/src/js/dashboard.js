/* El tablero de Inicio: indicadores (F05-T07) y gráfico diario (F06-T02)
   Referencia: 01_Documento_General.md §12.2, §13 · 02_Documento_Tecnico.md
   §9.2, §12.4-§12.6, §14.1

   Pide `GET /api/dashboard?year&month` del mes que esté mostrando la
   barra de mes — mismo patrón que `movimientos.js` (F04-T12): un solo
   oyente de `barra-mes.EVENTO_CAMBIO` cubre arrancar, moverse de mes,
   y cualquier alta/edición/baja que invalide el caché de meses. Esa
   ÚNICA llamada alimenta las tarjetas Y el gráfico: por eso los dos
   viven en este mismo archivo y comparten `cargando`/`fallo`/
   `dashboard` — una segunda llamada a `/api/dashboard` sólo para el
   gráfico duplicaría exactamente lo que F05-T04 evitó.

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
   inventada. */

import { api } from "./api.js";
import { esc, fmt, fmtS, pct, pctPlano } from "./format.js";
import { tarjetaHeroe, tarjetaMetrica, pintarTarjetas, animarCifras } from "./components/kpi.js";
import { bloqueCargando, error as estadoError, consolidado } from "./components/estados.js";
import { EVENTO_CAMBIO } from "./barra-mes.js";
import { dibujar as dibujarGraficoDiario, MODOS as MODOS_DIARIO } from "./charts/diario.js";

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
      sub: "Acumulado mensual",
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

// ===================================================================
//  Gráfico diario (F06-T02)
// ===================================================================

/** Las cifras del pie del gráfico: sólo las que ya manda la API tal
 * cual (`peak_expense`, `days_without_expense`) o leer el último
 * valor de una serie que el servidor ya sumó — nunca una cuenta nueva
 * del lado del cliente. Sin "promedio diario": esa cifra ya se sacó
 * de la tarjeta "Gasto de hoy" por pedido de Gustavo, y repetirla acá
 * sería lo mismo que evitar en ese otro lugar. */
function pieDiario(daily) {
  const pico = daily.peak_expense;
  return [
    { etiqueta: "Ahorro acumulado hoy", valor: fmtS(daily.saving_cumulative.at(-1)) },
    { etiqueta: "Pico de gasto", valor: pico ? `${fmt(pico.amount)} · día ${pico.day}` : "Sin gastos todavía" },
    { etiqueta: "Días sin gasto", valor: String(daily.days_without_expense) },
  ];
}

function pintarPie(contenedor, items) {
  contenedor.innerHTML = items
    .map(
      ({ etiqueta, valor }) =>
        `<div class="mini cg"><span>${esc(etiqueta)}</span><b class="num">${esc(valor)}</b></div>`,
    )
    .join("");
}

function pintarGrafico() {
  const caja = $("grafico-diario");
  const pie = $("pie-diario");
  if (!caja || !pie) return;

  if (cargando) {
    caja.innerHTML = bloqueCargando("grafico", 1);
    pie.innerHTML = "";
    return;
  }
  if (fallo || !dashboard) {
    caja.innerHTML = estadoError("No se pudo cargar el gráfico diario.");
    pie.innerHTML = "";
    return;
  }
  if (dashboard.daily == null) {
    // Regla 4: un mes histórico no tiene movimientos individuales que
    // repartir por día, así que no hay serie que dibujar.
    caja.innerHTML = consolidado();
    pie.innerHTML = "";
    return;
  }

  caja.innerHTML = dibujarGraficoDiario(dashboard.daily, modoDiario);
  pintarPie(pie, pieDiario(dashboard.daily));
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

/** Un mismo "reintentar" para las tarjetas y para el gráfico: los dos
 * fallan y se recuperan juntos, porque los dos salen de la misma
 * llamada. */
function conectarReintentar() {
  const alReintentar = (ev) => {
    if (!/** @type {HTMLElement} */ (ev.target).closest("[data-reintentar]")) return;
    if (ultimoPeriodo) cargar(ultimoPeriodo);
  };
  $("kpis-inicio")?.addEventListener("click", alReintentar);
  $("grafico-diario")?.addEventListener("click", alReintentar);
}

// ===================================================================

export async function arrancar() {
  const caja = $("kpis-inicio");
  if (!caja) return;
  if (caja.dataset.conectado === "si") return;
  caja.dataset.conectado = "si";

  conectarReintentar();
  conectarModoDiario();

  document.addEventListener(EVENTO_CAMBIO, (ev) => {
    cargar(/** @type {CustomEvent} */ (ev).detail);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", arrancar);
} else {
  arrancar();
}
