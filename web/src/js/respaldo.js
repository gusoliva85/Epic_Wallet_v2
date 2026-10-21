/* Tarjeta "Copia de seguridad" de Ajustes · F11-T02
   Referencia: 02_Documento_Tecnico.md §9.1, §18 · General §58

   Exportar es un solo pedido (`api.descargar`) que dispara la
   descarga del archivo que mandó el servidor, sin tocar su contenido
   —ni el JSON ni el ZIP de CSV pasan por ninguna cuenta del
   frontend—. Importar son dos pedidos al mismo endpoint
   (`POST /api/import`): el primero, sin confirmar, sólo trae la vista
   previa; el segundo, con `confirm: true`, recién ahí escribe. Un
   éxito ahí cambia prácticamente todo —meses, movimientos,
   categorías, inversiones, preferencias—, así que en vez de invalidar
   el caché de cada pantalla una por una, se recarga la página entera:
   es lo único que garantiza que las siete vistas queden al día. */

import { api, ApiError } from "./api.js";
import { esc } from "./format.js";
import { crearHoja } from "./components/sheet.js";
import { toast } from "./components/toast.js";

const $ = (id) => document.getElementById(id);

function mostrarError(mensaje) {
  const caja = $("respaldo-error");
  if (!caja) return;
  caja.textContent = mensaje ?? "";
  caja.hidden = !mensaje;
}

/* ===================================================================
   Exportar
   =================================================================== */

async function descargarArchivo(path) {
  mostrarError(null);
  try {
    const { blob, filename } = await api.descargar(path);
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = filename;
    // Tiene que estar en el documento para que el toque funcione en
    // todos los navegadores de teléfono, no sólo en el escritorio.
    document.body.append(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    mostrarError(e instanceof ApiError ? e.message : "No se pudo exportar. Probá de nuevo en un momento.");
    if (!(e instanceof ApiError)) console.error("respaldo: error al exportar", e);
  }
}

/* ===================================================================
   Importar: elegir archivo → vista previa → confirmar
   =================================================================== */

let controlImportar = null;
let backupPendiente = null;
let confirmando = false;

const ETIQUETAS_VISTA_PREVIA = {
  categories: "Categorías",
  months: "Meses",
  transactions: "Movimientos",
  investments: "Inversiones",
  liabilities: "Pasivos",
};

function pintarVistaPrevia(vista) {
  const caja = $("importar-vista-previa");
  if (!caja) return;
  caja.innerHTML = Object.entries(ETIQUETAS_VISTA_PREVIA)
    .map(
      ([clave, etiqueta]) =>
        `<div class="kv cg"><span>${esc(etiqueta)}</span><b class="num">${esc(vista[clave])}</b></div>`,
    )
    .join("");
}

function mostrarErrorImportar(mensaje) {
  const caja = $("importar-error");
  if (!caja) return;
  caja.textContent = mensaje ?? "";
  caja.hidden = !mensaje;
}

async function leerArchivo(archivo) {
  mostrarError(null);
  let backup;
  try {
    const texto = await archivo.text();
    backup = JSON.parse(texto);
  } catch (e) {
    mostrarError("Ese archivo no es un respaldo válido (no es JSON).");
    return;
  }

  try {
    const vista = await api.post("/import", { backup, confirm: false });
    backupPendiente = backup;
    mostrarErrorImportar(null);
    pintarVistaPrevia(vista);
    controlImportar.abrir();
  } catch (e) {
    mostrarError(e instanceof ApiError ? e.message : "No se pudo leer el respaldo. Probá de nuevo.");
    if (!(e instanceof ApiError)) console.error("respaldo: error al pedir la vista previa", e);
  }
}

function marcarCargandoImportar(cargando) {
  const boton = /** @type {HTMLButtonElement | null} */ ($("importar-confirmar"));
  if (!boton) return;
  boton.disabled = cargando;
  boton.classList.toggle("cargando", cargando);
  boton.setAttribute("aria-busy", String(cargando));
}

async function confirmarImportacion() {
  if (confirmando || !backupPendiente) return;
  mostrarErrorImportar(null);
  confirmando = true;
  marcarCargandoImportar(true);
  try {
    await api.post("/import", { backup: backupPendiente, confirm: true });
    toast("Respaldo importado.");
    // Cambió prácticamente todo: la forma simple y segura de que las
    // siete vistas queden al día es volver a cargar la aplicación
    // entera, no invalidar el caché de cada una por separado.
    location.reload();
  } catch (e) {
    mostrarErrorImportar(
      e instanceof ApiError ? e.message : "No se pudo importar. Probá de nuevo en un momento.",
    );
    if (!(e instanceof ApiError)) console.error("respaldo: error al confirmar la importación", e);
  } finally {
    confirmando = false;
    marcarCargandoImportar(false);
  }
}

/* ===================================================================
   Arranque
   =================================================================== */

export function arrancar() {
  const tarjeta = $("btn-exportar-json");
  if (!tarjeta) return;
  if (tarjeta.dataset.conectado === "si") return;
  tarjeta.dataset.conectado = "si";

  $("btn-exportar-json")?.addEventListener("click", () => descargarArchivo("/export"));
  $("btn-exportar-csv")?.addEventListener("click", () => descargarArchivo("/export?format=csv"));

  const input = /** @type {HTMLInputElement | null} */ ($("input-importar"));
  $("btn-importar")?.addEventListener("click", () => input?.click());
  input?.addEventListener("change", () => {
    const archivo = input.files?.[0];
    input.value = ""; // el mismo archivo se puede volver a elegir después de un error
    if (archivo) leerArchivo(archivo);
  });

  const hoja = $("hoja-importar");
  if (hoja) {
    controlImportar = crearHoja(hoja);
    $("importar-confirmar")?.addEventListener("click", confirmarImportacion);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", arrancar);
} else {
  arrancar();
}
