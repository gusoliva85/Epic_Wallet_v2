/* Los indicadores del tablero · F05-T07
   Referencia: 01_Documento_General.md §12.2 · 02_Documento_Tecnico.md §9.2, §12.4-§12.6

   Reemplaza en `#kpis-inicio` los datos de muestra que pintaba
   `views/vistas.js` desde F01-T13. Pide `GET /api/dashboard?year&month`
   del mes que esté mostrando la barra de mes — mismo patrón que
   `movimientos.js` (F04-T12): un solo oyente de `barra-mes.EVENTO_CAMBIO`
   cubre arrancar, moverse de mes, y cualquier alta/edición/baja que
   invalide el caché de meses (la invalidación hace que la barra vuelva
   a pedir la lista y dispare el evento de nuevo).

   Cinco tarjetas, las que ya estaban maquetadas desde F01-T13: ahorro
   del mes (héroe), ingresos, egresos, gasto de hoy y patrimonio. De
   los seis indicadores de General §12.2 no hay tarjeta propia para
   "total de ahorros": en el mes en curso es la misma cifra que "ahorro
   del mes" (decisión de Gustavo, F05-T07 — repetirla en otra tarjeta
   no agregaba información), y "total de inversiones" entra en el
   subtítulo de patrimonio, en cero hasta F10. "Gasto de hoy" sólo
   tiene sentido mirando el mes actual: en cualquier otro mes se apaga
   con su propia explicación en vez de mezclar el día de hoy con un mes
   que no es éste. */

import { api } from "./api.js";
import { fmt, fmtS, pct, pctPlano } from "./format.js";
import { tarjetaHeroe, tarjetaMetrica, pintarTarjetas, animarCifras } from "./components/kpi.js";
import { bloqueCargando, error as estadoError } from "./components/estados.js";
import { EVENTO_CAMBIO } from "./barra-mes.js";

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
      sub: hoy == null ? "Sólo para el mes actual" : `Promedio diario ${fmt(Number(ind.expense) / d.daily.days)}`,
      tarjeta: "dia",
    }),
    tarjetaMetrica({
      etiqueta: "Patrimonio",
      cifra: fmtS(ind.net_worth),
      sub: "Ahorro e inversiones",
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
    { valor: Number(ind.net_worth), formatear: fmtS },
  ];
}

// ===================================================================

let dashboard = null;
let cargando = true;
let fallo = false;
let ultimoPeriodo = null;

function pintar() {
  const caja = $("kpis-inicio");
  if (!caja) return;

  if (cargando) {
    caja.innerHTML = bloqueCargando("tarjeta", 5);
    return;
  }
  if (fallo || !dashboard) {
    caja.innerHTML = `<div style="grid-column: 1 / -1">${estadoError("No se pudieron cargar los indicadores.")}</div>`;
    return;
  }

  pintarTarjetas(caja, tarjetas(dashboard));
  animarCifras(caja, valoresParaContar(dashboard));
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

function conectarReintentar() {
  $("kpis-inicio")?.addEventListener("click", (ev) => {
    if (!/** @type {HTMLElement} */ (ev.target).closest("[data-reintentar]")) return;
    if (ultimoPeriodo) cargar(ultimoPeriodo);
  });
}

// ===================================================================

export async function arrancar() {
  const caja = $("kpis-inicio");
  if (!caja) return;
  if (caja.dataset.conectado === "si") return;
  caja.dataset.conectado = "si";

  conectarReintentar();

  document.addEventListener(EVENTO_CAMBIO, (ev) => {
    cargar(/** @type {CustomEvent} */ (ev).detail);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", arrancar);
} else {
  arrancar();
}
