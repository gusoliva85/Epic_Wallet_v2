/* Notificación breve · F01-T12
   Referencia: mockup 01, .toast

       import { toast } from "./components/toast.js";
       toast("Movimiento guardado");
       toast("No se pudo guardar", { severidad: "crit" });

   Dos cosas definen este componente y las dos son fáciles de hacer mal:

   1. La región viva TIENE QUE EXISTIR ANTES del mensaje. Un lector de
      pantalla anuncia los CAMBIOS dentro de una región `aria-live`; si
      la región se crea junto con el texto, no hay cambio que anunciar y
      el mensaje pasa en silencio. Por eso el `<div>` está en el HTML,
      vacío, desde que carga la página.

   2. Dos mensajes seguidos hacen cola, no se pisan. Reemplazar es más
      simple, pero en esta aplicación los mensajes son cosas como
      «movimiento guardado» o «no se pudo guardar»: perder uno es
      perder información que el usuario necesita. */

import { esc } from "../format.js";
import { icono } from "../iconos.js";

/** Cuánto se queda un mensaje en pantalla. Tabla del mockup. */
export const DURACION = 2600;

/** Lo que tarda en desvanecerse. Tiene que coincidir con el CSS, o el
    siguiente mensaje entra encima del que todavía se está yendo. */
export const SALIDA = 300;

const ICONOS = {
  ok: "tilde",
  warn: "aviso",
  pend: "reloj",
  crit: "aviso",
  info: "info",
};

const cola = [];
let mostrando = false;
let temporizador = null;

function elemento() {
  return document.getElementById("toast");
}

function siguiente() {
  const caja = elemento();
  if (!caja) return;

  if (!cola.length) {
    mostrando = false;
    return;
  }

  mostrando = true;
  const { mensaje, severidad } = cola.shift();
  const sev = ICONOS[severidad] ? severidad : "ok";

  caja.className = `toast t-${sev}`;
  caja.innerHTML =
    `<span class="toast-ico" aria-hidden="true">` +
    `<svg viewBox="0 0 24 24">${icono(ICONOS[sev])}</svg></span>` +
    `<span>${esc(mensaje)}</span>`;

  // En el frame siguiente: puesta junto con el contenido, la clase no
  // da transición y el mensaje aparece de golpe.
  requestAnimationFrame(() => caja.classList.add("visible"));

  temporizador = setTimeout(() => {
    caja.classList.remove("visible");
    // Se espera a que termine de irse antes de sacar el siguiente de
    // la cola, o los dos se cruzan en pantalla.
    temporizador = setTimeout(siguiente, SALIDA);
  }, DURACION);
}

/**
 * Muestra un mensaje breve.
 *
 * @param {string} mensaje
 * @param {{severidad?: "ok"|"warn"|"pend"|"crit"|"info"}} opciones
 */
export function toast(mensaje, { severidad = "ok" } = {}) {
  cola.push({ mensaje, severidad });
  if (!mostrando) siguiente();
}

/** Corta todo. Para las pruebas y para cuando se cierra la sesión. */
export function limpiarToasts() {
  clearTimeout(temporizador);
  temporizador = null;
  cola.length = 0;
  mostrando = false;
  const caja = elemento();
  if (caja) {
    caja.classList.remove("visible");
    caja.innerHTML = "";
  }
}

/** Para las pruebas: cuántos mensajes esperan. */
export function enEspera() {
  return cola.length;
}
