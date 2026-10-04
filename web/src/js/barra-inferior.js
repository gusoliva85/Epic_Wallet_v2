/* Barra inferior, botón flotante y hoja de «Más» · F01-T06

   La navegación del teléfono. Cinco posiciones: las cuatro secciones
   que `nav.js` marca con `en_barra_inferior` más el acceso a la hoja
   de «Más», donde viven las otras tres.

   Por qué cinco y no siete: en un teléfono de 390 px, siete posiciones
   dan 53 px de ancho cada una y las etiquetas no se leen. El reparto
   lo decide `nav.js` para que la barra superior, esta y el enrutador
   lean de la misma lista.

   Qué NO hace todavía: navegar. El enrutador llega en F01-T07; hasta
   entonces un toque sólo marca la posición, que es lo que permite ver
   los estados en el teléfono.

   La hoja de «Más» la maneja `components/sheet.js` desde F01-T11: foco
   atrapado, bloqueo del scroll de fondo y, desde 900 px, cajón lateral
   o modal centrado. Acá sólo se arma y se le dice qué la abre. */

import { SECCIONES, seccion } from "./nav.js";
import { navegar, rutaActual, EVENTO } from "./router.js";
import { crearHoja } from "./components/sheet.js";

const FLECHA = '<path d="M9 6l6 6-6 6"/>';
const MAS =
  '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>';

const fijas = SECCIONES.filter((s) => s.en_barra_inferior);
const en_mas = SECCIONES.filter((s) => !s.en_barra_inferior);

/* ------------------------------------------------------------ la barra */

function posiciones(barra) {
  const botones = fijas.map(
    (s) =>
      `<button type="button" data-ir="${s.id}" aria-label="${s.label}">` +
      `<svg viewBox="0 0 24 24" aria-hidden="true">${s.icono}</svg>` +
      `<span>${s.corta}</span></button>`,
  );

  // La quinta posición no es una sección: abre la hoja. Lleva
  // aria-expanded porque despliega algo, y aria-controls para que el
  // lector sepa qué.
  botones.push(
    '<button type="button" data-hoja="mas" aria-label="Más secciones" ' +
      'aria-expanded="false" aria-controls="hoja-mas">' +
      `<svg viewBox="0 0 24 24" aria-hidden="true">${MAS}</svg>` +
      "<span>Más</span></button>",
  );

  barra.innerHTML = botones.join("");
}

function marcar(barra, id) {
  barra.querySelectorAll("[data-ir]").forEach((b) => {
    const activa = b.dataset.ir === id;
    b.classList.toggle("activa", activa);
    // `aria-current` y no `aria-selected`: esto es navegación, no un
    // grupo de pestañas.
    if (activa) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
}

/* ------------------------------------------------------------- la hoja */

function opciones(cuerpo) {
  cuerpo.innerHTML = en_mas
    .map((s) => {
      const d = seccion(s.id);
      return (
        `<button class="hoja-opcion cg" type="button" data-ir="${d.id}">` +
        `<span class="hoja-opcion-ico" aria-hidden="true">` +
        `<svg viewBox="0 0 24 24">${d.icono}</svg></span>` +
        `<b>${d.label}</b>` +
        `<span class="hoja-opcion-flecha" aria-hidden="true">` +
        `<svg viewBox="0 0 24 24">${FLECHA}</svg></span>` +
        "</button>"
      );
    })
    .join("");
}

/* ----------------------------------------------------------- el armado */

function conectar() {
  const barra = document.getElementById("barra-inferior");
  const hoja = document.getElementById("hoja-mas");
  const fondo = document.getElementById("fondo-hoja");
  if (!barra || !hoja || !fondo) return;

  posiciones(barra);
  marcar(barra, rutaActual());
  opciones(hoja.querySelector(".hoja-cuerpo"));

  const control = crearHoja(hoja, {
    fondo,
    disparador: barra.querySelector("[data-hoja]"),
  });

  barra.addEventListener("click", (ev) => {
    const boton = ev.target.closest("[data-ir]");
    if (boton) navegar(boton.dataset.ir);
  });

  // Elegir una sección en la hoja la cierra: dejarla abierta taparía
  // la sección que se acaba de abrir.
  hoja.addEventListener("click", (ev) => {
    const boton = ev.target.closest("[data-ir]");
    if (!boton) return;
    control.cerrar();
    navegar(boton.dataset.ir);
  });

  // La marca la decide el enrutador y no el clic: así queda bien
  // también cuando se llega por «atrás», por recarga o desde la barra
  // de escritorio. Las tres secciones de la hoja no tienen posición
  // propia acá, así que ninguna queda marcada cuando están abiertas:
  // es correcto, no están en la barra.
  document.addEventListener(EVENTO, (ev) => marcar(barra, ev.detail.id));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", conectar);
} else {
  conectar();
}
