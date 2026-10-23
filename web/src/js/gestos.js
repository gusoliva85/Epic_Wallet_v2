/* Navegación por gestos, SOLO en el celular · F12-T04
   Referencia: skill §5 (corte `lg`, 960px: ahí la barra inferior le
   deja el lugar a la de escritorio) y §7 (el enrutador es el único
   que decide la ruta).

   Deslizar hacia la izquierda avanza a la vista siguiente; hacia la
   derecha, a la anterior — mismo orden que `SECCIONES` de `nav.js`,
   el único lugar que define «siguiente» para las dos barras y ahora
   también para esto. Con tope: nada pasa deslizando en Inicio hacia
   la derecha o en Ajustes hacia la izquierda.

   QUÉ NO HACE A PROPÓSITO, y por qué:

   - No sigue el dedo con una animación de arrastre. Las seis vistas
     son secciones independientes, no un riel con las seis visibles a
     la vez — montar eso es rehacer el enrutador entero por un efecto
     visual. El gesto sólo decide SI cambiar de vista; una vez que lo
     decide, usa `navegar()` y la entrada ya animada que cada vista
     tiene desde F01-T07/F01-T13 hace el resto.
   - No pisa el scroll vertical de la página: mientras no esté claro
     que el gesto es horizontal, nunca se llama `preventDefault()` y
     el navegador sigue scrolleando como si este archivo no existiera.
   - No pisa el scroll horizontal de una tabla o de un gráfico angosto
     (skill §11.1, §9): si el gesto arranca adentro de `.tbl-wrap` o
     `.chart-wrap`, no se lo sigue en absoluto.
   - No navega con una hoja abierta: con un `.hoja` encima, `.app`
     queda `inert` (components/sheet.js) — es la misma marca que ya
     usa el enrutador para las pantallas de cuenta, y acá alcanza con
     leerla, no hay que duplicar la lista de hojas abiertas.
   - No es `touch-action: none` global: sería matar la inercia nativa
     del scroll en toda la aplicación por un gesto que sólo importa
     cuando se confirma horizontal. Se deja que el navegador decida
     hasta que el propio gesto se aclare. */

import { SECCIONES } from "./nav.js";
import { navegar, rutaActual, EVENTO } from "./router.js";

/* Mismo corte que la skill §5 para `lg`: a partir de 960px manda la
   barra superior y no hay nada que deslizar — es una pantalla ancha,
   no un gesto de teléfono. */
const CONSULTA_MOVIL = "(max-width: 959.98px)";

/* Hace falta cruzar esto en algún eje antes de decidir si el gesto es
   horizontal o vertical. Más chico, un toque tembloroso se decide
   demasiado rápido; más grande, se nota el delay antes de que el
   scroll vertical responda. */
const UMBRAL_EJE = 10;

/* Lo que hay que recorrer en horizontal para que cuente como «quiero
   cambiar de pantalla» y no como un toque que se movió un poco. */
const UMBRAL_LARGO = 70;

/* Cuánto más horizontal que vertical tiene que ser el recorrido
   total para confirmar el cambio de vista en el toque final — more
   laxo que el de arriba a propósito: ese decide temprano si bloquear
   el scroll, éste decide al soltar si de verdad fue un gesto lateral. */
const RELACION_MINIMA = 1.2;

const IDS = SECCIONES.map((s) => s.id);

/**
 * Decide si un gesto terminado tiene que cambiar de vista, y a cuál.
 * Función pura, sin DOM: recibe números y una vista, devuelve un id
 * o `null`. Separada de los oyentes de puntero para poder probarla
 * sin levantar jsdom.
 *
 * @param {{dx: number, dy: number, actual: string | null}} datos
 * @returns {string | null}
 */
export function resolverGesto({ dx, dy, actual }) {
  if (!actual) return null;
  const indice = IDS.indexOf(actual);
  if (indice === -1) return null;
  if (Math.abs(dx) < UMBRAL_LARGO) return null;
  if (Math.abs(dx) < Math.abs(dy) * RELACION_MINIMA) return null;

  // Izquierda (dx negativo) avanza; derecha retrocede — mismo sentido
  // que hojear hacia adelante. Sin vuelta de punta a punta: en los
  // dos bordes, un paso de más no hace nada.
  const destino = dx < 0 ? indice + 1 : indice - 1;
  return destino >= 0 && destino < IDS.length ? IDS[destino] : null;
}

function esMovil() {
  return window.matchMedia ? window.matchMedia(CONSULTA_MOVIL).matches : true;
}

function appInerte() {
  // `.app` queda `inert` con cualquier hoja abierta (components/sheet.js,
  // con `setAttribute` directo, no la propiedad IDL — se lee del mismo
  // modo acá) y también en las pantallas de cuenta (router.js): en los
  // dos casos no corresponde que un deslizo cambie de vista por debajo.
  return Boolean(document.querySelector(".app")?.hasAttribute("inert"));
}

function enZonaPropia(destino) {
  return Boolean(
    destino.closest?.(".tbl-wrap, .chart-wrap, input, textarea, select, [contenteditable]"),
  );
}

/** @type {{ id: number, x0: number, y0: number, eje: "x" | "y" | null } | null} */
let gesto = null;
let vistaActual = rutaActual();

function alPointerDown(ev) {
  if (ev.pointerType !== "touch") return;
  if (!esMovil() || appInerte() || enZonaPropia(ev.target)) return;
  gesto = { id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, eje: null };
}

function alPointerMove(ev) {
  if (!gesto || ev.pointerId !== gesto.id) return;
  const dx = ev.clientX - gesto.x0;
  const dy = ev.clientY - gesto.y0;

  if (!gesto.eje) {
    if (Math.abs(dx) < UMBRAL_EJE && Math.abs(dy) < UMBRAL_EJE) return;
    gesto.eje = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
  }
  // Recién acá, con el eje ya decidido como horizontal, se le gana al
  // navegador: antes de este punto el scroll vertical nativo sigue
  // respondiendo sin que este archivo haya hecho nada todavía.
  if (gesto.eje === "x") ev.preventDefault();
}

function alPointerSuelto(ev) {
  if (!gesto || ev.pointerId !== gesto.id) return;
  const dx = ev.clientX - gesto.x0;
  const dy = ev.clientY - gesto.y0;
  gesto = null;

  const destino = resolverGesto({ dx, dy, actual: vistaActual });
  if (destino) navegar(destino);
}

function alPointerCancelado(ev) {
  if (gesto && ev.pointerId === gesto.id) gesto = null;
}

export function arrancar() {
  document.addEventListener(EVENTO, (ev) => {
    vistaActual = ev.detail.id;
  });
  document.addEventListener("pointerdown", alPointerDown);
  // `{passive:false}`: sin esto el navegador ignora el
  // `preventDefault()` de `alPointerMove` y lo avisa por consola.
  document.addEventListener("pointermove", alPointerMove, { passive: false });
  document.addEventListener("pointerup", alPointerSuelto);
  document.addEventListener("pointercancel", alPointerCancelado);
}

arrancar();
