/* Evolución del ahorro acumulado · F06-T07
   Referencia: 01_Documento_General.md §54 (Gráfico 4) · 02_Documento_Tecnico.md §9.1

   Pide `GET /api/months/savings-evolution` cada vez que se entra a la
   vista Historial (evento `epic:ruta` de `router.js`). A diferencia
   del tablero de Inicio, esta serie no depende del mes que esté
   mostrando la barra de mes —es el acumulado real de TODA la cuenta—,
   así que no escucha `barra-mes.EVENTO_CAMBIO`. Se vuelve a pedir en
   cada entrada a la vista, sin cachear: así un movimiento cargado en
   otra vista durante la misma sesión se refleja sin recargar la
   página, al costo de un pedido liviano por visita.

   La tabla de meses (`#historial-tabla`) sigue con datos de muestra:
   conectarla —y el alta de un mes histórico— es de F08-T07. Esta
   tarea sólo conecta el gráfico de evolución; su criterio de
   aceptación es justo ése, "la evolución del ahorro usa el acumulado
   real". */

import { api } from "./api.js";
import { esc, fmtK } from "./format.js";
import { bloqueCargando, error as estadoError } from "./components/estados.js";
import { EVENTO as EVENTO_RUTA } from "./router.js";
import { dibujar as dibujarGraficoAhorro } from "./charts/ahorro.js";

const $ = (id) => document.getElementById(id);

let serie = null;
let cargando = true;
let fallo = false;

function pintarPie(contenedor, datos) {
  const ultimo = datos.at(-1);
  contenedor.innerHTML =
    `<div class="mini cg"><span>Saldo actual</span><b class="num">${esc(fmtK(ultimo ? ultimo.balance : 0))}</b></div>` +
    `<div class="mini cg"><span>Meses registrados</span><b class="num">${esc(datos.length)}</b></div>`;
}

function pintar() {
  const caja = $("grafico-ahorro");
  const pie = $("ahorro-pie");
  if (!caja) return;

  if (cargando) {
    caja.innerHTML = bloqueCargando("grafico", 1);
    if (pie) pie.innerHTML = "";
    return;
  }
  if (fallo || !serie) {
    caja.innerHTML = estadoError("No se pudo cargar la evolución del ahorro.");
    if (pie) pie.innerHTML = "";
    return;
  }

  caja.innerHTML = dibujarGraficoAhorro(serie);
  if (pie) pintarPie(pie, serie);
}

async function cargar() {
  cargando = true;
  fallo = false;
  pintar();

  try {
    serie = await api.get("/months/savings-evolution");
    cargando = false;
  } catch (e) {
    serie = null;
    cargando = false;
    fallo = true;
    console.error("historial: no se pudo pedir la evolución del ahorro", e);
  }
  pintar();
}

function conectarReintentar() {
  $("grafico-ahorro")?.addEventListener("click", (ev) => {
    if (!/** @type {HTMLElement} */ (ev.target).closest("[data-reintentar]")) return;
    cargar();
  });
}

export function arrancar() {
  const caja = $("grafico-ahorro");
  if (!caja) return;
  if (caja.dataset.conectado === "si") return;
  caja.dataset.conectado = "si";

  conectarReintentar();

  document.addEventListener(EVENTO_RUTA, (ev) => {
    if (/** @type {CustomEvent} */ (ev).detail.id === "historial") cargar();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", arrancar);
} else {
  arrancar();
}
