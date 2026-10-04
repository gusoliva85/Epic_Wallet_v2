/* Barra superior · F01-T05

   Pinta las pestañas de escritorio dentro de `#nav-escritorio` y mantiene
   marcada la que corresponde a la sección abierta.

   Las pestañas se generan desde `SECCIONES` en lugar de escribirlas en
   el HTML para que la barra superior, la inferior y el enrutador no
   puedan desincronizarse.

   Qué NO hace todavía: navegar. El enrutador llega en F01-T07; hasta
   entonces un clic sólo marca la pestaña, que es lo que permite ver
   los estados en el teléfono. Cuando exista, `marcar()` se llama desde
   el evento de cambio de ruta y el `click` pasa a cambiar el hash. */

import { SECCIONES, INICIO } from "./nav.js";

function pestanas(contenedor) {
  contenedor.innerHTML = SECCIONES.map(
    (s) =>
      `<button type="button" role="tab" data-ir="${s.id}" ` +
      `aria-selected="false" tabindex="-1">${s.label}</button>`,
  ).join("");
}

function marcar(contenedor, id) {
  contenedor.querySelectorAll("[data-ir]").forEach((b) => {
    const activa = b.dataset.ir === id;
    b.classList.toggle("activa", activa);
    b.setAttribute("aria-selected", String(activa));
    // Una sola pestaña entra en el orden de tabulación: desde ella se
    // recorre el resto con las flechas. Es el patrón de `tablist`, y
    // evita que haya que pasar por siete botones para salir de la barra.
    b.tabIndex = activa ? 0 : -1;
  });
}

function conectar() {
  const contenedor = document.getElementById("nav-escritorio");
  if (!contenedor) return;

  pestanas(contenedor);
  marcar(contenedor, INICIO);

  contenedor.addEventListener("click", (ev) => {
    const boton = ev.target.closest("[data-ir]");
    if (boton) marcar(contenedor, boton.dataset.ir);
  });

  // Flechas entre pestañas, como pide el patrón de `tablist`.
  contenedor.addEventListener("keydown", (ev) => {
    const paso = { ArrowRight: 1, ArrowLeft: -1 }[ev.key];
    if (!paso) return;
    const botones = [...contenedor.querySelectorAll("[data-ir]")];
    const actual = botones.findIndex((b) => b.tabIndex === 0);
    const siguiente =
      botones[(actual + paso + botones.length) % botones.length];
    marcar(contenedor, siguiente.dataset.ir);
    siguiente.focus();
    ev.preventDefault();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", conectar);
} else {
  conectar();
}
