/* Conecta los botones de tema que haya en la página.
   Separado de tema.js porque este sí puede esperar al DOM: el otro
   tiene que correr antes del primer pintado.

   Cualquier elemento con `data-tema` funciona como interruptor, así
   que cuando la barra superior lo tenga (F01-T05) no hay que tocar
   este archivo. */

const SOL =
  '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4' +
  'M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
const LUNA = '<path d="M20 13.5A8 8 0 1110.5 4a6.5 6.5 0 009.5 9.5z"/>';

function pintar(boton) {
  const oscuro = window.EpicTema.actual() === "dark";
  // Se muestra el icono de lo que va a pasar al tocarlo, no del estado
  // actual: es lo que la gente espera de un interruptor.
  boton.querySelector("svg").innerHTML = oscuro ? SOL : LUNA;
  boton.setAttribute(
    "aria-label",
    oscuro ? "Cambiar a tema claro" : "Cambiar a tema oscuro",
  );
  boton.setAttribute("aria-pressed", String(oscuro));
}

function conectar() {
  const botones = document.querySelectorAll("[data-tema]");
  botones.forEach((boton) => {
    pintar(boton);
    boton.addEventListener("click", () => {
      window.EpicTema.alternar();
      botones.forEach(pintar);
    });
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", conectar);
} else {
  conectar();
}
