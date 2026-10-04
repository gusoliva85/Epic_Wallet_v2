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

   La hoja es la versión mínima de F01-T06. El componente completo
   —foco atrapado, bloqueo del scroll de fondo, cajón lateral desde
   900 px— es de F01-T11, que la reemplaza. Lo que sí tiene acá es todo
   lo necesario para que no sea una trampa: cierre por toque afuera,
   por Escape y por botón, y devolución del foco al salir. */

import { SECCIONES, INICIO, seccion } from "./nav.js";

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

function crearHoja(hoja, fondo, disparador) {
  let devolverFocoA = null;

  function abrir() {
    devolverFocoA = document.activeElement;
    hoja.classList.add("abierta");
    fondo.classList.add("abierto");
    hoja.setAttribute("aria-hidden", "false");
    disparador.setAttribute("aria-expanded", "true");
    // El primer elemento accionable, no la hoja: así quien navega con
    // teclado entra directo en las opciones.
    hoja.querySelector("button")?.focus();
  }

  function cerrar() {
    if (!hoja.classList.contains("abierta")) return;
    hoja.classList.remove("abierta");
    fondo.classList.remove("abierto");
    hoja.setAttribute("aria-hidden", "true");
    disparador.setAttribute("aria-expanded", "false");
    // Sin esto el foco queda en un botón que se acaba de esconder y el
    // tabulador reaparece al principio de la página.
    devolverFocoA?.focus?.();
    devolverFocoA = null;
  }

  disparador.addEventListener("click", () => {
    if (hoja.classList.contains("abierta")) cerrar();
    else abrir();
  });

  fondo.addEventListener("click", cerrar);
  hoja.querySelector("[data-cerrar]")?.addEventListener("click", cerrar);

  // En `document` y no en la hoja: con el foco devuelto al disparador o
  // perdido, un listener puesto en la hoja no recibe la tecla.
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") cerrar();
  });

  return { abrir, cerrar };
}

/* ----------------------------------------------------------- el armado */

function conectar() {
  const barra = document.getElementById("barra-inferior");
  const hoja = document.getElementById("hoja-mas");
  const fondo = document.getElementById("fondo-hoja");
  if (!barra || !hoja || !fondo) return;

  posiciones(barra);
  marcar(barra, INICIO);
  opciones(hoja.querySelector(".hoja-cuerpo"));

  const control = crearHoja(hoja, fondo, barra.querySelector("[data-hoja]"));

  barra.addEventListener("click", (ev) => {
    const boton = ev.target.closest("[data-ir]");
    if (boton) marcar(barra, boton.dataset.ir);
  });

  // Elegir una sección en la hoja la cierra: dejarla abierta taparía
  // la sección que se acaba de abrir.
  hoja.addEventListener("click", (ev) => {
    if (ev.target.closest("[data-ir]")) control.cerrar();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", conectar);
} else {
  conectar();
}
