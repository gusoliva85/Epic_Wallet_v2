/* Hoja de detalle de categoría · F07-T05
   Referencia: 01_Documento_General.md §16 · 02_Documento_Tecnico.md §9.1

   Se abre tocando una fila de "Gastos por categoría" en Inicio
   (`#categorias-inicio`, dashboard.js). `#hoja-detalle` era hasta acá
   el stub genérico de `views/vistas.js` — esa hoja queda ahora para
   esto, y `vistas.js` ya no la toca (ver la exclusión que se sacó de
   ahí).

   Pide `GET /api/categories/{id}/detail?year&month` del mes que esté
   mostrando la barra de mes: el total, la última carga y los
   movimientos de esa categoría, con `transactions: null` si el mes es
   histórico (Regla 4) — nunca se inventa una lista.

   Tocar un movimiento del detalle lo abre para editar o borrar
   reusando `alta-movimiento.js::abrirEdicion`, el mismo `#hoja-movimiento`
   que ya usa la vista Movimientos — no hay que reconstruir ese
   formulario acá. Esta hoja se CIERRA antes de abrir esa: el velo y el
   Escape de `components/sheet.js` no están pensados para dos hojas
   abiertas a la vez (sólo una hoja comparte el `#fondo-hoja`), así que
   evitar la pila es más simple que enseñarle eso. Al guardar o borrar,
   `abrirEdicion` ya llama `invalidarMeses()` por su cuenta, así que el
   dashboard (KPIs y panel de categorías) se refresca solo por el mismo
   camino que ya usa `movimientos.js` — esta hoja no tiene que saber
   nada de eso. */

import { api } from "./api.js";
import { esc, fmt } from "./format.js";
import { filaMovimiento, pintarFilas } from "./components/rows.js";
import { bloqueCargando, error as estadoError, vacio, consolidado } from "./components/estados.js";
import { crearHoja } from "./components/sheet.js";
import { EVENTO_CAMBIO } from "./barra-mes.js";
import { abrirEdicion } from "./alta-movimiento.js";

const $ = (id) => document.getElementById(id);

/* "DD/MM/AAAA" — mismo formato que ya usa `movimientos.js` para esta
 * misma clase de dato (su propio `fechaCorta`, no compartido: cada
 * módulo lo arma solo, como ya hace el resto de la aplicación). */
function fechaCorta(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

let periodoActual = null; // { year, month, status }, de barra-mes.EVENTO_CAMBIO
let categoriaAbierta = null; // { id, nombre }
let detalle = null;
let cargando = false;
let fallo = false;
let control = null;

/* Sin `categoria` repetida —la hoja entera es de una sola categoría,
 * que ya dice el título— y sin `descripcion` aparte: la descripción
 * ocupa el lugar de la categoría, y la fecha es lo que de verdad varía
 * fila a fila acá. */
function filaDe(m) {
  return filaMovimiento({
    id: m.id,
    tipo: m.transaction_type === "income" ? "ingreso" : "egreso",
    categoria: m.description || "Sin descripción",
    importe: fmt(m.amount),
    fecha: fechaCorta(m.transaction_date),
    origen: m.source,
  });
}

function pintar() {
  const resumen = $("categoria-detalle-resumen");
  const lista = $("categoria-detalle-lista");
  if (!resumen || !lista) return;

  if (cargando) {
    resumen.innerHTML = "";
    lista.innerHTML = bloqueCargando("fila", 3);
    return;
  }
  if (fallo || !detalle) {
    resumen.innerHTML = "";
    lista.innerHTML = estadoError("No se pudo cargar el detalle de la categoría.");
    return;
  }

  resumen.innerHTML =
    `<div class="mini cg"><span>Total del mes</span><b class="num">${esc(fmt(detalle.total))}</b></div>` +
    `<div class="mini cg"><span>Última carga</span><b class="num">${detalle.last_date ? esc(fechaCorta(detalle.last_date)) : "—"}</b></div>`;

  if (detalle.transactions === null) {
    // Regla 4: un mes consolidado no tiene movimientos individuales,
    // el total de arriba ya es el dato real — lo que no hay es lista.
    lista.innerHTML = consolidado();
  } else if (detalle.transactions.length === 0) {
    lista.innerHTML = vacio("Sin movimientos", "Esta categoría no tuvo movimientos este mes.");
  } else {
    pintarFilas(lista, detalle.transactions.map(filaDe));
  }
}

async function cargar() {
  if (!categoriaAbierta || !periodoActual) return;
  cargando = true;
  fallo = false;
  pintar();

  const params = new URLSearchParams({
    year: String(periodoActual.year),
    month: String(periodoActual.month),
  });

  try {
    detalle = await api.get(`/categories/${categoriaAbierta.id}/detail?${params.toString()}`);
    cargando = false;
  } catch (e) {
    detalle = null;
    cargando = false;
    fallo = true;
    console.error("categoria-detalle: no se pudo pedir el detalle", e);
  }
  pintar();
}

function abrirPara(id, nombre) {
  categoriaAbierta = { id, nombre };
  const tituloEl = $("hoja-detalle-titulo");
  const subEl = $("hoja-detalle-sub");
  if (tituloEl) tituloEl.textContent = nombre;
  if (subEl) subEl.textContent = "Categoría del mes";
  control?.abrir();
  cargar();
}

function conectarFilas() {
  const caja = $("categorias-inicio");
  caja?.addEventListener("click", (ev) => {
    const fila = /** @type {HTMLElement} */ (ev.target).closest("[data-categoria]");
    if (!fila) return;
    const id = Number(fila.getAttribute("data-categoria"));
    // textContent y no innerHTML: lo que se lee del DOM se trata como
    // dato, aunque lo haya escrito esta misma aplicación.
    const nombre = fila.querySelector(".row-main b")?.textContent ?? "Categoría";
    abrirPara(id, nombre);
  });
}

function conectarMovimientos() {
  $("categoria-detalle-lista")?.addEventListener("click", (ev) => {
    const fila = /** @type {HTMLElement} */ (ev.target).closest("[data-movimiento]");
    if (!fila || !detalle?.transactions) return;
    const id = Number(fila.getAttribute("data-movimiento"));
    const movimiento = detalle.transactions.find((m) => m.id === id);
    if (!movimiento) return;
    control?.cerrar();
    abrirEdicion(movimiento);
  });
}

function conectarReintentar() {
  $("categoria-detalle-lista")?.addEventListener("click", (ev) => {
    if (!/** @type {HTMLElement} */ (ev.target).closest("[data-reintentar]")) return;
    cargar();
  });
}

export function arrancar() {
  const hoja = $("hoja-detalle");
  if (!hoja) return;
  if (hoja.dataset.conectado === "si") return;
  hoja.dataset.conectado = "si";

  control = crearHoja(hoja);
  if (!control) return;

  conectarFilas();
  conectarMovimientos();
  conectarReintentar();

  document.addEventListener(EVENTO_CAMBIO, (ev) => {
    periodoActual = /** @type {CustomEvent} */ (ev).detail;
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", arrancar);
} else {
  arrancar();
}
