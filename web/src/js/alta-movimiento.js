/* Alta y edición de movimiento · F04-T09 (alta) y F04-T12 (edición y baja)
   Referencia: 01_Documento_General.md §9, §10, Regla 11 ·
   02_Documento_Tecnico.md §9.1 · skill §8 (hoja inferior), §10 (importes)

   Una sola hoja (#hoja-movimiento) para las dos cosas, mismo criterio
   que `config-categorias.js` con alta y edición de categoría:
   comparten todos los campos, así que separarlas en dos hojas sería
   duplicar el formulario entero para diferenciar un título y un
   botón de borrar.

   La abre el botón flotante #btn-nuevo (alta) o `abrirEdicion()`,
   que llama `movimientos.js` al tocar una fila (edición) — exportada
   para eso, no la usa nadie más. `editando` es `null` en modo alta y
   el movimiento completo en modo edición; se limpia en `alCerrar`,
   nunca en `alAbrir`, porque `alAbrir` también dispara cuando
   `abrirEdicion()` llama a `control.abrir()` después de haber
   preparado todo — si el alta reseteara ahí, pisaría lo que la
   edición acababa de dejar listo.

   Tipo "Egreso" y fecha de hoy quedan puestos de entrada en el alta
   —son los valores más frecuentes—, así que cargar un gasto común es:
   tocar el botón, tocar el importe y escribirlo, elegir la categoría,
   Guardar. Menos de cinco toques, que es el criterio de aceptación de
   F04-T09.

   Dos listas de categorías, no una: el alta sólo ofrece las activas
   (`active=true`, Técnico F04-T06); la edición pide todas, porque un
   movimiento viejo puede tener una categoría ya archivada y el
   selector tiene que poder seguir mostrándola en vez de vaciarse sola.

   Al guardar o borrar, se invalida el caché de meses
   (`cache-meses.js`): es el mismo mecanismo que ya usa la barra de
   mes para refrescarse sola, y que `movimientos.js` escucha (vía
   `barra-mes.EVENTO_CAMBIO`) para volver a pedir la lista — ninguno
   de los dos necesita saber que este módulo existe. */

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

/** Categorías activas, para el alta — pedidas una sola vez y reusadas
 * entre aperturas de la hoja, 21 filas no justifican pedirlas cada vez. */
let categoriasActivasCache = null;

async function categoriasActivas() {
  if (!categoriasActivasCache) {
    try {
      categoriasActivasCache = await api.get("/categories?active=true");
    } catch (e) {
      categoriasActivasCache = [];
      console.error("alta-movimiento: no se pudieron pedir las categorías", e);
    }
  }
  return categoriasActivasCache;
}

/** Todas las categorías (activas e inactivas), para la edición — un
 * movimiento viejo puede referenciar una ya archivada. */
let categoriasTodasCache = null;

async function categoriasTodas() {
  if (!categoriasTodasCache) {
    try {
      categoriasTodasCache = await api.get("/categories");
    } catch (e) {
      categoriasTodasCache = [];
      console.error("alta-movimiento: no se pudieron pedir las categorías (edición)", e);
    }
  }
  return categoriasTodasCache;
}

/** `editando` es `null` en modo alta: la lista que corresponde según
 * el modo. */
let editando = null;
function listaDeCategorias() {
  return editando ? categoriasTodasCache : categoriasActivasCache;
}

function pintarCategorias(tipo) {
  const select = /** @type {HTMLSelectElement | null} */ ($("movimiento-categoria"));
  if (!select) return;
  const conservado = select.value;
  const filtradas = (listaDeCategorias() ?? []).filter((c) => c.type === tipo);
  select.innerHTML = filtradas.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  // Conserva lo elegido si sigue entre las opciones — tanto al
  // cambiar de tipo con la categoría ya puesta, como para no perder
  // la selección que acaba de dejar `abrirEdicion`.
  if (filtradas.some((c) => String(c.id) === conservado)) select.value = conservado;
}

function marcarTipoActivo(tipo) {
  const hoja = $("hoja-movimiento");
  const botones = hoja?.querySelectorAll(".view-switch button[data-tipo]") ?? [];
  for (const b of botones) b.classList.toggle("activa", b.dataset.tipo === tipo);
}

function elegirTipo(tipo) {
  marcarTipoActivo(tipo);
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
  const guardar = /** @type {HTMLButtonElement | null} */ ($("movimiento-guardar"));
  if (guardar) {
    guardar.disabled = cargando;
    guardar.classList.toggle("cargando", cargando);
    guardar.setAttribute("aria-busy", String(cargando));
  }
  // El de borrar no tiene girador propio: alcanza con que no se pueda
  // tocar mientras hay algo en curso, para no mandar dos pedidos a la
  // vez (uno guardando, el otro borrando el mismo movimiento).
  const borrar = /** @type {HTMLButtonElement | null} */ ($("movimiento-borrar"));
  if (borrar) borrar.disabled = cargando;
}

/** Modo alta: título, campos en blanco, Egreso y hoy por defecto.
 * Es el `alAbrir` de la hoja cuando se abre por el botón flotante —
 * nunca cuando la abre `abrirEdicion`, que ya la deja lista antes de
 * llamar a `control.abrir()` (ver la nota del encabezado). */
async function prepararAlta() {
  $("hoja-movimiento-titulo").textContent = "Nuevo movimiento";
  $("movimiento-borrar").hidden = true;
  mostrarError(null);
  /** @type {HTMLInputElement} */ ($("movimiento-importe")).value = "";
  /** @type {HTMLInputElement} */ ($("movimiento-descripcion")).value = "";
  const fecha = /** @type {HTMLInputElement} */ ($("movimiento-fecha"));
  const hoy = hoyArgentina();
  fecha.value = hoy;
  // No hay meses futuros (General §12.1): el selector nativo ni
  // ofrece una fecha que el servidor va a rechazar igual.
  fecha.max = hoy;
  marcarTipoActivo("expense");

  const select = /** @type {HTMLSelectElement} */ ($("movimiento-categoria"));
  select.disabled = true;
  select.innerHTML = '<option value="">Cargando categorías…</option>';
  await categoriasActivas();
  select.disabled = false;
  pintarCategorias("expense");
}

async function alAbrirHoja() {
  if (editando) return; // ya preparado por abrirEdicion()
  await prepararAlta();
}

let control = null;
let guardando = false;

/**
 * Abre la hoja en modo edición, con los datos de `movimiento` ya
 * puestos. La llama `movimientos.js` al tocar una fila.
 *
 * @param {{id:number, category_id:number, transaction_date:string,
 *          transaction_type:string, amount:string, description:?string}} movimiento
 */
export async function abrirEdicion(movimiento) {
  if (!control) return;
  editando = movimiento;
  mostrarError(null);

  $("hoja-movimiento-titulo").textContent = "Editar movimiento";
  $("movimiento-borrar").hidden = false;

  /** @type {HTMLInputElement} */ ($("movimiento-importe")).value = movimiento.amount;
  /** @type {HTMLInputElement} */ ($("movimiento-descripcion")).value = movimiento.description ?? "";
  const fecha = /** @type {HTMLInputElement} */ ($("movimiento-fecha"));
  fecha.value = movimiento.transaction_date;
  fecha.max = hoyArgentina();
  marcarTipoActivo(movimiento.transaction_type);

  const select = /** @type {HTMLSelectElement} */ ($("movimiento-categoria"));
  select.disabled = true;
  select.innerHTML = '<option value="">Cargando categorías…</option>';
  await categoriasTodas();
  select.disabled = false;
  pintarCategorias(movimiento.transaction_type);
  select.value = String(movimiento.category_id);

  control.abrir();
}

async function alGuardar(evento) {
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
  const categoria = (listaDeCategorias() ?? []).find((c) => String(c.id) === campoCategoria.value);
  // Se captura antes de `control.cerrar()`: `alCerrar` limpia
  // `editando`, y para entonces ya hace falta saber qué verbo usar.
  const editandoAhora = editando;

  const datos = {
    category_id: Number(campoCategoria.value),
    transaction_date: campoFecha.value,
    transaction_type: tipo,
    // Dos decimales siempre: lo que manda el servidor en sus
    // respuestas, y lo que espera `numeric(14,2)` del otro lado.
    amount: importe.toFixed(2),
    description: campoDescripcion.value.trim(),
  };

  guardando = true;
  marcarCargando(true);

  try {
    if (editandoAhora) {
      await api.put(`/transactions/${editandoAhora.id}`, datos);
    } else {
      await api.post("/transactions", datos);
    }

    control.cerrar();
    invalidarMeses();
    const verbo = editandoAhora ? "actualizado" : "cargado";
    // `toast()` escapa el mensaje al pintarlo (components/toast.js):
    // acá va el nombre tal cual, sin `esc()` propio, o quedaría
    // escapado dos veces.
    toast(
      categoria
        ? `${categoria.name}: ${ETIQUETA_TIPO[tipo].toLowerCase()} ${verbo}.`
        : `Movimiento ${verbo}.`,
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

/** Regla 11: la baja pide confirmación. `confirm()` nativo, mismo
 * criterio que usa el mockup aprobado — no hay todavía un componente
 * de confirmación propio en la aplicación real. */
async function alBorrar() {
  if (!editando || guardando) return;
  if (!window.confirm("¿Eliminar este movimiento? Se recalcularán los totales del mes.")) {
    return;
  }

  const idBorrado = editando.id;
  guardando = true;
  marcarCargando(true);

  try {
    await api.del(`/transactions/${idBorrado}`);
    control.cerrar();
    invalidarMeses();
    toast("Movimiento borrado.");
  } catch (e) {
    mostrarError(
      e instanceof ApiError ? e.message : "No se pudo borrar. Probá de nuevo en un momento.",
    );
    if (!(e instanceof ApiError)) console.error("alta-movimiento: error al borrar", e);
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

  control = crearHoja(hoja, {
    disparador,
    alAbrir: alAbrirHoja,
    // Nunca en `alAbrir`: ver la nota del encabezado del archivo.
    alCerrar: () => {
      editando = null;
    },
  });
  if (!control) return;

  for (const b of hoja.querySelectorAll(".view-switch button[data-tipo]")) {
    b.addEventListener("click", () => elegirTipo(b.dataset.tipo));
  }

  form.addEventListener("submit", alGuardar);
  form.addEventListener("input", () => mostrarError(null));
  $("movimiento-borrar")?.addEventListener("click", alBorrar);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", arrancar);
} else {
  arrancar();
}
