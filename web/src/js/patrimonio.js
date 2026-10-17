/* Vista Patrimonio: la ecuación y la composición, con datos reales ·
   F09-T05
   Referencia: 01_Documento_General.md §5.3, §30 · 02_Documento_Tecnico.md
   §9.1, §14.2 · Roadmap F09-T03 (el endpoint), F09-T05 (esta pantalla)

   `GET /api/patrimony` es una foto de ahora, sin mes que navegar —a
   diferencia del tablero de Inicio—, así que se pide una sola vez al
   entrar a la vista (evento `epic:ruta`), igual que la evolución del
   ahorro en `historial.js`.

   La composición (ahorro líquido vs. inversiones) ya viene en
   porcentajes que suman 100 desde el backend (`calc.porcentajes_de_categorias`,
   método del mayor resto) — acá no se suma ni se divide nada, sólo se
   usa el número para el ancho de cada segmento. Hasta que exista F10,
   `investments_share` siempre llega en "0.0": la barra se ve toda del
   color del ahorro, y es lo correcto, no un error. */

import { api } from "./api.js";
import { esc, fmtS, pctPlano, toNum } from "./format.js";
import { bloqueCargando, error as estadoError, vacio } from "./components/estados.js";
import { EVENTO as EVENTO_RUTA } from "./router.js";

const $ = (id) => document.getElementById(id);

let patrimonio = null;
let cargando = true;
let fallo = false;

function ficha(nombre, valor, total = false) {
  return (
    `<div class="kv cg${total ? " kv--total" : ""}">` +
    `<span>${esc(nombre)}</span><b class="num">${esc(valor)}</b></div>`
  );
}

function pintarEcuacion() {
  const caja = $("patrimonio-ecuacion");
  if (!caja) return;

  if (cargando) {
    caja.innerHTML = bloqueCargando("tarjeta", 4);
    return;
  }
  if (fallo || !patrimonio) {
    caja.innerHTML = estadoError("No se pudo cargar el patrimonio.");
    return;
  }

  caja.innerHTML =
    ficha("Ahorro disponible", fmtS(patrimonio.savings_balance)) +
    ficha("Inversiones", fmtS(patrimonio.investments_value)) +
    ficha("Pasivos", fmtS(patrimonio.liabilities_total)) +
    ficha("Patrimonio neto", fmtS(patrimonio.net_worth), true);
}

function pintarComposicion() {
  const caja = $("grafico-composicion");
  const pie = $("patrimonio-pie");
  if (!caja) return;

  if (cargando) {
    caja.innerHTML = bloqueCargando("grafico", 1);
    if (pie) pie.innerHTML = "";
    return;
  }
  if (fallo || !patrimonio) {
    caja.innerHTML = estadoError("No se pudo cargar la composición.");
    if (pie) pie.innerHTML = "";
    return;
  }

  const { savings_share: ahorroPct, investments_share: inversionesPct } = patrimonio.composition;
  if (ahorroPct == null || inversionesPct == null) {
    // Mismo criterio que una tasa de ahorro con ingresos en cero: sin
    // nada que repartir (ahorro + inversiones <= 0) no hay una barra
    // que tenga sentido, nunca un porcentaje inventado.
    caja.innerHTML = vacio(
      "Todavía no hay nada que repartir",
      "Cuando el ahorro o las inversiones sean positivos, la barra se completa sola.",
    );
    if (pie) pie.innerHTML = "";
    return;
  }

  caja.innerHTML =
    '<div class="comp-track">' +
    `<div style="width: ${toNum(ahorroPct)}%; background: var(--color-sav)"></div>` +
    `<div style="width: ${toNum(inversionesPct)}%; background: var(--color-accent-2)"></div>` +
    "</div>" +
    '<div class="legend" style="padding-top: 10px">' +
    `<span><i class="dot" style="background: var(--color-sav)"></i>Ahorro líquido <b class="num">${esc(fmtS(patrimonio.savings_balance))}</b></span>` +
    `<span><i class="dot" style="background: var(--color-accent-2)"></i>Inversiones <b class="num">${esc(fmtS(patrimonio.investments_value))}</b></span>` +
    "</div>";

  if (pie) {
    pie.innerHTML =
      `<div class="mini cg"><span>Líquido</span><b class="num">${esc(pctPlano(ahorroPct))}</b></div>` +
      `<div class="mini cg"><span>Invertido</span><b class="num">${esc(pctPlano(inversionesPct))}</b></div>`;
  }
}

function pintar() {
  pintarEcuacion();
  pintarComposicion();
}

async function cargar() {
  cargando = true;
  fallo = false;
  pintar();

  try {
    patrimonio = await api.get("/patrimony");
    cargando = false;
  } catch (e) {
    patrimonio = null;
    cargando = false;
    fallo = true;
    console.error("patrimonio: no se pudo pedir el patrimonio", e);
  }
  pintar();
}

function conectarReintentar() {
  const alReintentar = (ev) => {
    if (!/** @type {HTMLElement} */ (ev.target).closest("[data-reintentar]")) return;
    cargar();
  };
  $("patrimonio-ecuacion")?.addEventListener("click", alReintentar);
  $("grafico-composicion")?.addEventListener("click", alReintentar);
}

export function arrancar() {
  const caja = $("patrimonio-ecuacion");
  if (!caja) return;
  if (caja.dataset.conectado === "si") return;
  caja.dataset.conectado = "si";

  conectarReintentar();

  document.addEventListener(EVENTO_RUTA, (ev) => {
    if (/** @type {CustomEvent} */ (ev).detail.id === "patrimonio") cargar();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", arrancar);
} else {
  arrancar();
}
