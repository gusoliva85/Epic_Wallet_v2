/* Administración de categorías · F03-T10
   Referencia: 02_Documento_Tecnico.md §9.1 · F03-T08 (los endpoints)
   · skill §8.1, §11.1 (`.cfg-row`), §12 (el interruptor es un
   `<button role="switch">`, nunca un `div` con `onclick`)

   Una sola hoja (`#hoja-categoria`) para alta y edición: comparten el
   campo de nombre. El tipo sólo se elige al crear — cambiarlo con
   histórico cargado dejaría incoherentes los movimientos que ya usan
   esa categoría (Regla 34), así que el selector se esconde al editar
   y `PATCH` ni siquiera acepta ese campo (Técnico F03-T08).

   El selector de tipo es un `.view-switch`. `views/vistas.js` tiene un
   delegado genérico que también le cambia la clase `activa` a
   cualquier `.view-switch button` del documento, pero no alcanza con
   eso solo: qué tipo quedó elegido es parte de lo que este archivo
   necesita leer al guardar, así que tiene su propio oyente — sin él,
   probar esta pantalla sola (sin cargar `vistas.js`) no podría elegir
   un tipo, y el comportamiento de verdad dependería en secreto de que
   otro módulo esté cargado.

   Archivar no abre la hoja: es el mismo interruptor `role="switch"`
   del resto de los ajustes, un solo toque. Se puede reactivar con el
   mismo botón — "se desactivan, nunca se borran si tienen histórico"
   no es una baja. */

import { api, ApiError } from "./api.js";
import { esc } from "./format.js";
import { toast } from "./components/toast.js";
import { crearHoja } from "./components/sheet.js";
import { bloqueCargando, error as estadoError, vacio } from "./components/estados.js";
import { categorias as categoriasCacheadas, invalidarCategorias } from "./cache-categorias.js";

const $ = (id) => document.getElementById(id);

const ETIQUETA_TIPO = { income: "Ingreso", expense: "Egreso" };

let categorias = [];
/** `null` mientras la hoja está en modo alta; el id de la categoría
 * mientras está en modo edición. */
let editando = null;
let cargandoLista = true;
let fallo = false;

function pintar() {
  const caja = $("config-categorias");
  if (!caja) return;

  if (cargandoLista) {
    caja.innerHTML = bloqueCargando("fila", 3);
    return;
  }
  if (fallo) {
    caja.innerHTML = estadoError("No se pudieron cargar las categorías.");
    return;
  }
  if (categorias.length === 0) {
    caja.innerHTML = vacio(
      "Todavía no hay categorías",
      "Creá la primera con «+ Nueva», arriba.",
    );
    return;
  }

  caja.innerHTML = categorias
    .map(
      (c) =>
        '<div class="cfg-row cg">' +
        // La fila es un botón, no un `div` con `onclick`: se abre para
        // editar, así que tiene que alcanzarse con el tabulador.
        `<button class="cfg-nombre" type="button" data-id="${c.id}">` +
        `<b>${esc(c.name)}</b><span>${esc(ETIQUETA_TIPO[c.type] ?? c.type)}</span>` +
        "</button>" +
        `<button class="toggle" type="button" role="switch" ` +
        `aria-checked="${c.active}" aria-label="${esc(c.name)}" data-id="${c.id}"></button>` +
        "</div>",
    )
    .join("");
}

async function cargar() {
  cargandoLista = true;
  fallo = false;
  pintar();

  try {
    // Misma caché que `movimientos.js` y `alta-movimiento.js`
    // (`cache-categorias.js`): no vuelve a pedir si ya la tienen
    // pedida ellos, ni al revés.
    categorias = await categoriasCacheadas();
    cargandoLista = false;
  } catch (e) {
    categorias = [];
    cargandoLista = false;
    fallo = true;
    console.error("config-categorias: no se pudieron pedir las categorías", e);
  }
  pintar();
}

// ===================================================================
//  La hoja de alta y edición
// ===================================================================

function elegirTipo(tipo) {
  const botones = $("hoja-categoria")?.querySelectorAll(".view-switch button[data-tipo]") ?? [];
  for (const b of botones) b.classList.toggle("activa", b.dataset.tipo === tipo);
}

function tipoElegido() {
  const activo = $("hoja-categoria")?.querySelector(".view-switch button.activa");
  return activo?.dataset.tipo ?? "expense";
}

function mostrarError(mensaje) {
  const caja = $("categoria-error");
  if (!caja) return;
  caja.textContent = mensaje ?? "";
  caja.hidden = !mensaje;
}

function marcarCargando(cargando) {
  const boton = /** @type {HTMLButtonElement | null} */ ($("categoria-guardar"));
  if (!boton) return;
  boton.disabled = cargando;
  boton.classList.toggle("cargando", cargando);
  boton.setAttribute("aria-busy", String(cargando));
}

function abrirAlta(control) {
  editando = null;
  $("hoja-categoria-titulo").textContent = "Nueva categoría";
  /** @type {HTMLInputElement} */ ($("categoria-nombre")).value = "";
  const campoTipo = $("categoria-tipo-campo");
  if (campoTipo) campoTipo.hidden = false;
  elegirTipo("expense");
  mostrarError(null);
  control.abrir();
}

function abrirEdicion(control, categoria) {
  editando = categoria.id;
  $("hoja-categoria-titulo").textContent = "Editar categoría";
  /** @type {HTMLInputElement} */ ($("categoria-nombre")).value = categoria.name;
  const campoTipo = $("categoria-tipo-campo");
  // El tipo no se puede cambiar al editar (Regla 34): el selector ni
  // se muestra, para no insinuar una opción que `PATCH` va a rechazar.
  if (campoTipo) campoTipo.hidden = true;
  mostrarError(null);
  control.abrir();
}

let guardando = false;

async function alGuardar(evento, control) {
  evento.preventDefault();
  if (guardando) return;

  const campo = /** @type {HTMLInputElement} */ ($("categoria-nombre"));
  const nombre = campo.value.trim();
  mostrarError(null);

  if (!nombre) {
    mostrarError("Escribí un nombre.");
    campo.focus();
    return;
  }

  guardando = true;
  marcarCargando(true);

  try {
    if (editando === null) {
      await api.post("/categories", { name: nombre, type: tipoElegido() });
      toast("Categoría creada.");
    } else {
      await api.patch(`/categories/${editando}`, { name: nombre });
      toast("Categoría renombrada.");
    }
    control.cerrar();
    invalidarCategorias();
    await cargar();
  } catch (e) {
    mostrarError(
      e instanceof ApiError ? e.message : "No se pudo guardar. Probá de nuevo en un momento.",
    );
    if (!(e instanceof ApiError)) console.error("config-categorias: error al guardar", e);
  } finally {
    guardando = false;
    marcarCargando(false);
  }
}

// ===================================================================
//  Archivar y reactivar
// ===================================================================

async function archivar(id, activa) {
  try {
    await api.patch(`/categories/${id}`, { active: activa });
    const categoria = categorias.find((c) => c.id === id);
    if (categoria) categoria.active = activa;
    invalidarCategorias();
    toast(activa ? "Categoría reactivada." : "Categoría archivada.");
  } catch (e) {
    // El interruptor ya se movió a ojo (abajo, antes de llamar acá);
    // si la API no lo aceptó, se vuelve a pintar desde `categorias` —
    // que no cambió — y el interruptor queda donde estaba de verdad.
    toast(
      e instanceof ApiError ? e.message : "No se pudo cambiar la categoría.",
      { severidad: "crit" },
    );
    pintar();
  }
}

// ===================================================================

export function arrancar() {
  const caja = $("config-categorias");
  const hoja = $("hoja-categoria");
  const form = /** @type {HTMLFormElement | null} */ ($("form-categoria"));
  if (!caja || !hoja || !form) return;

  if (caja.dataset.conectado === "si") return;
  caja.dataset.conectado = "si";

  const control = crearHoja(hoja);
  if (!control) return;

  $("btn-nueva-categoria")?.addEventListener("click", () => abrirAlta(control));

  for (const b of hoja.querySelectorAll(".view-switch button[data-tipo]")) {
    b.addEventListener("click", () => elegirTipo(b.dataset.tipo));
  }

  form.addEventListener("submit", (ev) => alGuardar(ev, control));
  form.addEventListener("input", () => mostrarError(null));

  caja.addEventListener("click", (ev) => {
    const target = /** @type {HTMLElement} */ (ev.target);

    if (target.closest("[data-reintentar]")) {
      cargar();
      return;
    }

    const nombreBtn = target.closest(".cfg-nombre");
    if (nombreBtn) {
      const categoria = categorias.find((c) => c.id === Number(nombreBtn.getAttribute("data-id")));
      if (categoria) abrirEdicion(control, categoria);
      return;
    }

    const toggleBtn = target.closest(".toggle");
    if (toggleBtn) {
      const activaAhora = toggleBtn.getAttribute("aria-checked") === "true";
      toggleBtn.setAttribute("aria-checked", String(!activaAhora));
      archivar(Number(toggleBtn.getAttribute("data-id")), !activaAhora);
    }
  });

  cargar();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", arrancar);
} else {
  arrancar();
}
