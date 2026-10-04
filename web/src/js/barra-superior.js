/* Barra superior · F01-T05, navegación real desde F01-T07

   Pinta las posiciones de escritorio dentro de `#nav-escritorio` y
   mantiene marcada la de la ruta activa.

   Se generan desde `SECCIONES` en lugar de escribirlas en el HTML para
   que la barra superior, la inferior y el enrutador no puedan
   desincronizarse.

   Nota sobre semántica: hasta F01-T06 esto era un `tablist`. Dejó de
   serlo en F01-T07: cambian la URL y el historial del navegador, y eso
   es navegación. Un grupo de pestañas no se puede marcar, ni volver
   atrás con el botón del navegador. Por eso ahora es un `nav` con
   `aria-current` y se recorre con el tabulador, como cualquier
   navegación. */

import { SECCIONES } from "./nav.js";
import { navegar, rutaActual, EVENTO } from "./router.js";

function posiciones(contenedor) {
  contenedor.innerHTML = SECCIONES.map(
    (s) => `<button type="button" data-ir="${s.id}">${s.label}</button>`,
  ).join("");
}

function marcar(contenedor, id) {
  contenedor.querySelectorAll("[data-ir]").forEach((b) => {
    const activa = b.dataset.ir === id;
    b.classList.toggle("activa", activa);
    if (activa) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
}

function conectar() {
  const contenedor = document.getElementById("nav-escritorio");
  if (!contenedor) return;

  posiciones(contenedor);
  marcar(contenedor, rutaActual());

  contenedor.addEventListener("click", (ev) => {
    const boton = ev.target.closest("[data-ir]");
    if (boton) navegar(boton.dataset.ir);
  });

  // La marca la decide el enrutador y no el clic: así queda bien
  // también cuando se llega por «atrás», por recarga o desde la otra
  // barra.
  document.addEventListener(EVENTO, (ev) => marcar(contenedor, ev.detail.id));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", conectar);
} else {
  conectar();
}
