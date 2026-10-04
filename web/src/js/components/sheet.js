/* Hoja inferior y cajón lateral · F01-T11
   Referencia: 02_Documento_Tecnico.md §13.5 y §13.6 · mockup 01

   Una hoja es cualquier panel que se abre encima de la aplicación. En
   el teléfono sube desde abajo; desde 900 px, según su variante, pasa
   a cajón lateral derecho (`.hoja--cajon`, para ver un detalle) o a
   modal centrado (`.hoja--modal`, para un formulario).

   Esto reemplaza la versión mínima que F01-T06 tenía dentro de
   barra-inferior.js. Lo que agrega es lo que convierte una hoja en algo
   usable de verdad: el fondo no hace scroll, el foco no se escapa y lo
   de atrás no se puede tocar ni leer.

       const hoja = crearHoja(document.getElementById("hoja-mas"), {
         disparador: boton,
       });
       hoja.abrir();
*/

/* Lo que puede recibir foco dentro de una hoja. `:not([disabled])` y el
   tabindex negativo importan: un botón apagado o sacado del orden de
   tabulación no puede ser el borde del ciclo, o el foco se queda
   trabado ahí. */
const ENFOCABLES = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/* Cuántas hojas hay abiertas. El scroll se bloquea con la primera y se
   suelta con la última: si cada hoja lo manejara por su cuenta, abrir
   un detalle desde dentro de otra hoja soltaría el scroll al cerrar la
   de arriba. */
let abiertas = 0;
let scrollGuardado = 0;

function bloquearFondo() {
  if (abiertas++ > 0) return;

  scrollGuardado = window.scrollY;

  // `overflow: hidden` en el body NO alcanza: iOS lo ignora para el
  // scroller del documento y el fondo se sigue moviendo detrás de la
  // hoja. Con `position: fixed` el documento deja de desplazarse en
  // todos lados, pero salta al principio, así que hay que acordarse de
  // dónde estaba y devolverlo al cerrar.
  document.body.style.position = "fixed";
  document.body.style.top = `-${scrollGuardado}px`;
  document.body.style.width = "100%";
}

function soltarFondo() {
  if (--abiertas > 0) return;
  abiertas = 0;

  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.width = "";
  // `instant`: con desplazamiento suave, al cerrar se ve a la página
  // viajando sola hasta donde estaba.
  window.scrollTo({ top: scrollGuardado, behavior: "instant" });
}

/** Deja fuera del alcance del teclado y del lector todo lo que no sea
    la hoja. Es lo que hace que `aria-modal` no sea una promesa vacía. */
function aislarFondo(hoja, fondo, aislar) {
  for (const nodo of document.body.children) {
    if (nodo === hoja || nodo === fondo) continue;
    if (aislar) nodo.setAttribute("inert", "");
    else nodo.removeAttribute("inert");
  }
}

/**
 * Convierte un elemento en una hoja.
 *
 * @param {HTMLElement} hoja
 * @param {{disparador?: HTMLElement, fondo?: HTMLElement,
 *          alAbrir?: () => void, alCerrar?: () => void}} opciones
 */
export function crearHoja(hoja, { disparador, fondo, alAbrir, alCerrar } = {}) {
  const velo = fondo ?? document.getElementById("fondo-hoja");
  if (!hoja || !velo) return null;

  let devolverFocoA = null;

  const estaAbierta = () => hoja.classList.contains("abierta");

  function enfocables() {
    return [...hoja.querySelectorAll(ENFOCABLES)].filter(
      // Un elemento escondido no se puede enfocar, y si entra en el
      // ciclo el foco desaparece de la pantalla.
      (el) => el.offsetParent !== null || el === document.activeElement,
    );
  }

  function atraparFoco(ev) {
    if (ev.key !== "Tab" || !estaAbierta()) return;

    const lista = enfocables();
    if (!lista.length) {
      // Sin nada que enfocar, el foco se queda en la hoja en lugar de
      // irse al fondo, que está inerte.
      ev.preventDefault();
      hoja.focus();
      return;
    }

    const primero = lista[0];
    const ultimo = lista[lista.length - 1];
    const actual = document.activeElement;

    if (ev.shiftKey && (actual === primero || !hoja.contains(actual))) {
      ev.preventDefault();
      ultimo.focus();
    } else if (!ev.shiftKey && (actual === ultimo || !hoja.contains(actual))) {
      ev.preventDefault();
      primero.focus();
    }
  }

  function abrir() {
    if (estaAbierta()) return;

    devolverFocoA = document.activeElement;
    bloquearFondo();

    hoja.classList.add("abierta");
    velo.classList.add("abierto");
    hoja.setAttribute("aria-hidden", "false");
    disparador?.setAttribute("aria-expanded", "true");
    aislarFondo(hoja, velo, true);

    // El primer elemento accionable, no la hoja: así quien navega con
    // teclado entra directo en el contenido.
    (enfocables()[0] ?? hoja).focus();
    alAbrir?.();
  }

  function cerrar() {
    if (!estaAbierta()) return;

    hoja.classList.remove("abierta");
    velo.classList.remove("abierto");
    hoja.setAttribute("aria-hidden", "true");
    disparador?.setAttribute("aria-expanded", "false");
    aislarFondo(hoja, velo, false);
    soltarFondo();

    // Se devuelve el foco ANTES de que termine la transición: si no,
    // queda en un botón que se está escondiendo y el tabulador
    // reaparece al principio de la página.
    devolverFocoA?.focus?.();
    devolverFocoA = null;
    alCerrar?.();
  }

  function alternar() {
    if (estaAbierta()) cerrar();
    else abrir();
  }

  disparador?.addEventListener("click", alternar);
  velo.addEventListener("click", () => {
    // Sólo cierra la de más arriba: con dos hojas abiertas, un toque
    // en el velo no tiene que cerrar las dos.
    if (estaAbierta()) cerrar();
  });
  hoja.querySelector("[data-cerrar]")?.addEventListener("click", cerrar);

  // En `document` y no en la hoja: con el foco devuelto al disparador o
  // perdido, un oyente puesto en la hoja no recibe la tecla.
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") cerrar();
  });
  document.addEventListener("keydown", atraparFoco);

  return { abrir, cerrar, alternar, estaAbierta };
}

/** Para las pruebas: cuántas hojas se consideran abiertas. */
export function hojasAbiertas() {
  return abiertas;
}
