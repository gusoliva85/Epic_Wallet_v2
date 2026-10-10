/* Lista de movimientos del mes · F04-T12
   Referencia: 01_Documento_General.md §11 · 02_Documento_Tecnico.md §9.1, §6.6

   Reemplaza los datos de muestra que pintaba `views/vistas.js` desde
   F01-T13. Pide `GET /api/transactions?year&month` del mes que esté
   mostrando la barra de mes — nunca navega sola: escucha
   `barra-mes.EVENTO_CAMBIO`, que se dispara al arrancar, al moverse
   de mes y después de cada invalidación del caché (alta, edición o
   baja de un movimiento), así que un solo oyente cubre los tres
   casos.

   Un mes histórico no tiene movimientos individuales (Regla 4): ni
   siquiera se pide la lista, se muestra el estado de
   `components/estados.js::consolidado()` directo.

   Tocar una fila abre `#hoja-movimiento` en modo edición
   (`alta-movimiento.js::abrirEdicion`), no el `#hoja-detalle`
   genérico que sigue usando `views/vistas.js` para las filas de
   categoría (F07, todavía no construido) y las de muestra del
   tablero (Fase 5). Por eso el oyente de acá va en el contenedor de
   la lista real y no en `document`: así no compite con el genérico. */

import { api } from "./api.js";
import { esc } from "./format.js";
import { filaMovimiento, separadorDia, pintarFilas } from "./components/rows.js";
import { bloqueCargando, error as estadoError, vacio, consolidado } from "./components/estados.js";
import { EVENTO_CAMBIO } from "./barra-mes.js";
import { abrirEdicion } from "./alta-movimiento.js";

const $ = (id) => document.getElementById(id);

const ETIQUETA_TIPO = { income: "ingreso", expense: "egreso" };

/* "04 de octubre 2026", en América/Argentina/Buenos_Aires. */
const FORMATO_DIA = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Argentina/Buenos_Aires",
});

/** `transaction_date` es "AAAA-MM-DD", sin hora. Parsearlo con `new
 * Date(iso)` lo toma como medianoche UTC, y la zona Argentina lo
 * corre al día anterior al formatear — mismo motivo que ya resuelve
 * `barra-mes.js` con el mediodía UTC. */
function fechaSegura(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function tituloDeDia(iso) {
  const texto = FORMATO_DIA.format(fechaSegura(iso));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function fechaCorta(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Formato de pesos sin decimales, mientras no exista `fmt()`
 * (`format.js`, F05-T10). Local a este módulo a propósito: no se
 * exporta, para no competir con la función que F05-T10 va a definir
 * para toda la aplicación. */
function pesos(importeDecimal) {
  const n = Math.round(Number(importeDecimal));
  return `$${n.toLocaleString("es-AR")}`;
}

// ===================================================================
//  Categorías, para mostrar el nombre en cada fila
// ===================================================================

/** Todas (activas e inactivas): un movimiento puede referenciar una
 * ya archivada, y tiene que poder seguir mostrando su nombre. */
let categorias = [];
let categoriasListo = false;
let pedidoCategorias = null;

/**
 * Pide las categorías una sola vez — pero si el primer intento falla
 * (típico al registrarse: `arrancar()` corre en `DOMContentLoaded`,
 * antes de que la sesión nueva exista todavía, y ese primer pedido da
 * 401), vuelve a intentarlo en el siguiente `mes:cambiado` en lugar
 * de quedarse con la lista vacía para siempre. No hace falta que
 * nadie toque un botón de "reintentar": para cuando llega el próximo
 * cambio de mes la sesión ya existe.
 */
function categoriasPorId() {
  if (categoriasListo) return Promise.resolve();
  if (!pedidoCategorias) {
    pedidoCategorias = api
      .get("/categories")
      .then((datos) => {
        categorias = datos;
        categoriasListo = true;
      })
      .catch((e) => {
        categorias = [];
        console.error("movimientos: no se pudieron pedir las categorías", e);
      })
      .finally(() => {
        pedidoCategorias = null;
      });
  }
  return pedidoCategorias;
}

function nombreCategoria(id) {
  return categorias.find((c) => c.id === id)?.name ?? "Categoría";
}

// ===================================================================
//  Estado y pintado
// ===================================================================

let periodo = null; // { id, year, month, status, ... } de barra-mes.js
let lista = [];
let cargando = true;
let fallo = false;

let filtroTipo = "";
let filtroCategoria = "";
let filtroTexto = "";

function filaDe(m) {
  return filaMovimiento({
    id: m.id,
    tipo: m.transaction_type === "income" ? "ingreso" : "egreso",
    categoria: nombreCategoria(m.category_id),
    importe: pesos(m.amount),
    fecha: fechaCorta(m.transaction_date),
    descripcion: m.description ?? "",
    origen: m.source,
  });
}

/** La API ya entrega los movimientos del más nuevo al más viejo
 * (`transactions_month_idx`, Técnico §6.2): alcanza con agrupar en
 * ese mismo orden, sin reordenar acá — así la lista "ordena por fecha
 * descendente", el criterio de aceptación de la tarea. */
function filasAgrupadas() {
  const salida = [];
  let dia = null;
  for (const m of lista) {
    if (m.transaction_date !== dia) {
      dia = m.transaction_date;
      salida.push(separadorDia(tituloDeDia(dia)));
    }
    salida.push(filaDe(m));
  }
  return salida;
}

function pintar() {
  const caja = $("movimientos-lista");
  if (!caja) return;

  if (!periodo || cargando) {
    caja.innerHTML = bloqueCargando("fila", 4);
    return;
  }
  if (periodo.status !== "open") {
    // Regla 4: un mes consolidado no tiene movimientos que listar, y
    // no se inventan — ni siquiera se pidieron.
    caja.innerHTML = consolidado();
    return;
  }
  if (fallo) {
    caja.innerHTML = estadoError("No se pudieron cargar los movimientos.");
    return;
  }
  if (lista.length === 0) {
    caja.innerHTML = vacio(
      "Todavía no hay movimientos",
      "Usá el botón + para cargar el primero de este mes.",
    );
    return;
  }
  pintarFilas(caja, filasAgrupadas());
}

async function cargar() {
  if (!periodo || periodo.status !== "open") {
    cargando = false;
    pintar();
    return;
  }

  cargando = true;
  fallo = false;
  pintar();

  const params = new URLSearchParams({
    year: String(periodo.year),
    month: String(periodo.month),
  });
  if (filtroTipo) params.set("type", filtroTipo);
  if (filtroCategoria) params.set("category_id", filtroCategoria);
  if (filtroTexto.trim()) params.set("q", filtroTexto.trim());

  try {
    lista = await api.get(`/transactions?${params.toString()}`);
    cargando = false;
  } catch (e) {
    lista = [];
    cargando = false;
    fallo = true;
    console.error("movimientos: no se pudieron pedir los movimientos", e);
  }
  pintar();
}

// ===================================================================
//  Filtros: tipo (view-switch), categoría (select) y texto (buscar)
// ===================================================================

function pintarFiltroCategoria() {
  const select = /** @type {HTMLSelectElement | null} */ ($("mov-categoria"));
  if (!select) return;
  const conservado = select.value;
  select.innerHTML =
    '<option value="">Todas las categorías</option>' +
    categorias
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "es"))
      .map((c) => `<option value="${c.id}">${esc(c.name)}</option>`)
      .join("");
  select.value = conservado;
}

function conectarFiltros() {
  const tipoSwitch = $("mov-filtro-tipo");
  tipoSwitch?.addEventListener("click", (ev) => {
    const boton = /** @type {HTMLElement} */ (ev.target).closest("button[data-tipo]");
    if (!boton || !tipoSwitch.contains(boton)) return;
    for (const b of tipoSwitch.children) b.classList.toggle("activa", b === boton);
    filtroTipo = boton.dataset.tipo ?? "";
    cargar();
  });

  $("mov-categoria")?.addEventListener("change", (ev) => {
    filtroCategoria = /** @type {HTMLSelectElement} */ (ev.target).value;
    cargar();
  });

  let temporizador = null;
  $("mov-buscar")?.addEventListener("input", (ev) => {
    filtroTexto = /** @type {HTMLInputElement} */ (ev.target).value;
    clearTimeout(temporizador);
    // Sin esperar a que se deje de escribir, cada tecla dispararía un
    // pedido — con 390 px de teclado tapando la pantalla, además.
    temporizador = setTimeout(cargar, 300);
  });
}

// ===================================================================
//  Abrir una fila: edición (alta-movimiento.js)
// ===================================================================

function conectarFilas() {
  const caja = $("movimientos-lista");
  caja?.addEventListener("click", (ev) => {
    const fila = /** @type {HTMLElement} */ (ev.target).closest("[data-movimiento]");
    if (!fila) return;
    const id = Number(fila.getAttribute("data-movimiento"));
    const movimiento = lista.find((m) => m.id === id);
    if (movimiento) abrirEdicion(movimiento);
  });
}

// ===================================================================

export async function arrancar() {
  const caja = $("movimientos-lista");
  if (!caja) return;
  if (caja.dataset.conectado === "si") return;
  caja.dataset.conectado = "si";

  conectarFiltros();
  conectarFilas();

  // `categoriasPorId()` reintenta sola si el primer pedido falló (ver
  // su comentario): por eso se vuelve a llamar en cada evento, no
  // sólo una vez al arrancar.
  document.addEventListener(EVENTO_CAMBIO, async (ev) => {
    periodo = /** @type {CustomEvent} */ (ev).detail;
    await categoriasPorId();
    pintarFiltroCategoria();
    cargar();
  });

  await categoriasPorId();
  pintarFiltroCategoria();
  if (periodo) cargar();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", arrancar);
} else {
  arrancar();
}
