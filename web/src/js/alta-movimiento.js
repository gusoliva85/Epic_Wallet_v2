/* Alta rápida de movimiento · F04-T09
   Referencia: 01_Documento_General.md §9, §10 · 02_Documento_Tecnico.md §9.1
   · skill §8 (hoja inferior), §10 (importes)

   La hoja que abre el botón flotante #btn-nuevo. Tipo "Egreso" y
   fecha de hoy quedan puestos de entrada —son los valores más
   frecuentes—, así que cargar un gasto común es: tocar el botón,
   tocar el importe y escribirlo, elegir la categoría, Guardar. Menos
   de cinco toques, que es el criterio de aceptación de la tarea.

   Las categorías se piden una sola vez (`active=true`: una
   desactivada no se ofrece para un movimiento nuevo, aunque el
   servidor no lo exija — Técnico F04-T06) y se filtran en el cliente
   al cambiar de tipo, igual que ya filtra en memoria la categoría
   del mes en `views/vistas.js`.

   Al guardar, se invalida el caché de meses (`cache-meses.js`): es el
   mismo mecanismo que ya usa la barra de mes para refrescarse sola
   sin que este módulo necesite saber que ella existe. El tablero con
   indicadores reales todavía no existe —llega en la Fase 5—, así que
   "los indicadores cambian al guardar" hoy se cumple con lo que sí es
   real: la barra de mes y el toast de confirmación con los totales
   que ya devuelve la propia respuesta de `POST /api/transactions`. */

import { api, ApiError } from "./api.js";
import { esc } from "./format.js";
import { toast } from "./components/toast.js";
import { crearHoja } from "./components/sheet.js";
import { invalidarMeses } from "./cache-meses.js";

const $ = (id) => document.getElementById(id);

const ETIQUETA_TIPO = { income: "Ingreso", expense: "Egreso" };

/* Fecha de hoy en América/Argentina/Buenos_Aires, no la del
   dispositivo: viajando con el teléfono en otra zona, "hoy" tiene que
   seguir siendo el día de la aplicación, el mismo que decide
   `services.months.mes_actual` del lado del servidor. `en-CA` da
   directo el formato AAAA-MM-DD que pide `<input type="date">`. */
const FORMATO_FECHA_ARG = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
function hoyArgentina() {
  return FORMATO_FECHA_ARG.format(new Date());
}

/** Categorías activas, pedidas una sola vez y reusadas entre
 * aperturas de la hoja — 21 filas no justifican pedirlas cada vez. */
let categorias = null;

async function categoriasActivas() {
  if (!categorias) {
    try {
      categorias = await api.get("/categories?active=true");
    } catch (e) {
      categorias = [];
      console.error("alta-movimiento: no se pudieron pedir las categorías", e);
    }
  }
  return categorias;
}

function pintarCategorias(tipo) {
  const select = /** @type {HTMLSelectElement | null} */ ($("movimiento-categoria"));
  if (!select) return;
  const conservado = select.value;
  const filtradas = (categorias ?? []).filter((c) => c.type === tipo);
  select.innerHTML = filtradas.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  // Al editar el tipo con una categoría ya elegida del mismo tipo —no
  // debería pasar, pero cuesta nada conservarla si coincide.
  if (filtradas.some((c) => String(c.id) === conservado)) select.value = conservado;
}

function elegirTipo(tipo) {
  const hoja = $("hoja-movimiento");
  const botones = hoja?.querySelectorAll(".view-switch button[data-tipo]") ?? [];
  for (const b of botones) b.classList.toggle("activa", b.dataset.tipo === tipo);
  pintarCategorias(tipo);
}

function tipoElegido() {
  const activo = $("hoja-movimiento")?.querySelector(".view-switch button.activa");
  return activo?.dataset.tipo ?? "expense";
}

function mostrarError(mensaje) {
  const caja = $("movimiento-error");
  if (!caja) return;
  caja.textContent = mensaje ?? "";
  caja.hidden = !mensaje;
}

function marcarCargando(cargando) {
  const boton = /** @type {HTMLButtonElement | null} */ ($("movimiento-guardar"));
  if (!boton) return;
  boton.disabled = cargando;
  boton.classList.toggle("cargando", cargando);
  boton.setAttribute("aria-busy", String(cargando));
}

async function prepararFormulario() {
  mostrarError(null);
  /** @type {HTMLInputElement} */ ($("movimiento-importe")).value = "";
  /** @type {HTMLInputElement} */ ($("movimiento-descripcion")).value = "";
  const fecha = /** @type {HTMLInputElement} */ ($("movimiento-fecha"));
  const hoy = hoyArgentina();
  fecha.value = hoy;
  // No hay meses futuros (General §12.1): el selector nativo ni
  // ofrece una fecha que el servidor va a rechazar igual.
  fecha.max = hoy;
  elegirTipo("expense");

  const select = /** @type {HTMLSelectElement} */ ($("movimiento-categoria"));
  select.disabled = true;
  select.innerHTML = '<option value="">Cargando categorías…</option>';
  await categoriasActivas();
  select.disabled = false;
  pintarCategorias(tipoElegido());
}

let guardando = false;

async function alGuardar(evento, control) {
  evento.preventDefault();
  if (guardando) return;

  const campoImporte = /** @type {HTMLInputElement} */ ($("movimiento-importe"));
  const campoCategoria = /** @type {HTMLSelectElement} */ ($("movimiento-categoria"));
  const campoFecha = /** @type {HTMLInputElement} */ ($("movimiento-fecha"));
  const campoDescripcion = /** @type {HTMLInputElement} */ ($("movimiento-descripcion"));
  mostrarError(null);

  // `valueAsNumber` da `NaN` con el campo vacío: alcanza con un sólo
  // chequeo para "vacío" y "cero o negativo" a la vez.
  const importe = campoImporte.valueAsNumber;
  if (!Number.isFinite(importe) || importe <= 0) {
    mostrarError("Ingresá un importe mayor a cero.");
    campoImporte.focus();
    return;
  }

  if (!campoCategoria.value) {
    mostrarError("Elegí una categoría.");
    campoCategoria.focus();
    return;
  }

  if (!campoFecha.value) {
    mostrarError("Elegí una fecha.");
    campoFecha.focus();
    return;
  }

  const tipo = tipoElegido();
  const categoria = (categorias ?? []).find((c) => String(c.id) === campoCategoria.value);

  guardando = true;
  marcarCargando(true);

  try {
    await api.post("/transactions", {
      category_id: Number(campoCategoria.value),
      transaction_date: campoFecha.value,
      transaction_type: tipo,
      // Dos decimales siempre: lo que manda el servidor en sus
      // respuestas, y lo que espera `numeric(14,2)` del otro lado.
      amount: importe.toFixed(2),
      description: campoDescripcion.value.trim(),
    });

    control.cerrar();
    invalidarMeses();
    // `toast()` escapa el mensaje al pintarlo (components/toast.js):
    // acá va el nombre tal cual, sin `esc()` propio, o quedaría
    // escapado dos veces.
    toast(
      categoria
        ? `${categoria.name}: ${ETIQUETA_TIPO[tipo].toLowerCase()} cargado.`
        : "Movimiento cargado.",
    );
  } catch (e) {
    mostrarError(
      e instanceof ApiError ? e.message : "No se pudo guardar. Probá de nuevo en un momento.",
    );
    if (!(e instanceof ApiError)) console.error("alta-movimiento: error al guardar", e);
  } finally {
    guardando = false;
    marcarCargando(false);
  }
}

export function arrancar() {
  const hoja = $("hoja-movimiento");
  const disparador = $("btn-nuevo");
  const form = /** @type {HTMLFormElement | null} */ ($("form-movimiento"));
  if (!hoja || !disparador || !form) return;

  if (hoja.dataset.conectado === "si") return;
  hoja.dataset.conectado = "si";

  const control = crearHoja(hoja, { disparador, alAbrir: prepararFormulario });
  if (!control) return;

  for (const b of hoja.querySelectorAll(".view-switch button[data-tipo]")) {
    b.addEventListener("click", () => elegirTipo(b.dataset.tipo));
  }

  form.addEventListener("submit", (ev) => alGuardar(ev, control));
  form.addEventListener("input", () => mostrarError(null));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", arrancar);
} else {
  arrancar();
}
