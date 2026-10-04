/* Avisos y píldoras · F01-T12
   Referencia: mockup 01, .alert y .pill

   Un aviso es una tarjeta con severidad: dice que algo pasa y qué
   hacer. Una píldora es una etiqueta de estado o un porcentaje dentro
   de otra cosa.

   Las cuatro severidades son las del sistema. `info` existe además
   para lo que no es un problema sino un dato. */

import { esc } from "../format.js";
import { icono } from "../iconos.js";

/* Lista cerrada, por lo mismo que los colores de las tarjetas: la
   severidad decide una clase, no un valor que entre en un atributo
   `style`. Y porque son éstas: no es un parámetro libre.

   Cada una trae su icono, y eso NO es decoración. El color no puede
   ser el único que diga la gravedad: quien no distingue el rojo del
   ámbar necesita que la forma cambie. */
const SEVERIDADES = {
  ok: { clase: "a-ok", icono: "tilde", nombre: "Todo en orden" },
  warn: { clase: "a-warn", icono: "aviso", nombre: "Atención" },
  pend: { clase: "a-pend", icono: "reloj", nombre: "Pendiente" },
  crit: { clase: "a-crit", icono: "aviso", nombre: "Crítico" },
  info: { clase: "a-info", icono: "info", nombre: "Información" },
};

export const SEVERIDADES_VALIDAS = Object.freeze(Object.keys(SEVERIDADES));

/**
 * Tarjeta de aviso.
 *
 * @param {{severidad?: string, titulo: string, texto?: string}} datos
 */
export function aviso({ severidad = "info", titulo, texto = "" }) {
  const s = SEVERIDADES[severidad] ?? SEVERIDADES.info;

  return (
    `<div class="alert cg ${s.clase}" role="note">` +
    // El icono lleva su nombre, no `aria-hidden`: es lo que dice la
    // gravedad a quien no ve el color. Sin esto, un aviso crítico y
    // uno informativo se leen idénticos.
    `<span class="alert-ico" role="img" aria-label="${esc(s.nombre)}">` +
    `<svg viewBox="0 0 24 24" aria-hidden="true">${icono(s.icono)}</svg>` +
    "</span>" +
    "<div>" +
    `<b>${esc(titulo)}</b>` +
    (texto ? `<p>${esc(texto)}</p>` : "") +
    "</div>" +
    "</div>"
  );
}

/* Las píldoras usan las mismas severidades más `neutral`, que es la
   que no dice nada: un estado sin carga, como «sin movimientos». */
const PILDORAS = new Set([...SEVERIDADES_VALIDAS, "neutral"]);

/**
 * Etiqueta de estado o porcentaje.
 *
 * @param {{texto: string, tipo?: string}} datos
 */
export function pildora({ texto, tipo = "neutral" }) {
  const clase = PILDORAS.has(tipo) ? tipo : "neutral";
  return `<span class="pill ${clase}">${esc(texto)}</span>`;
}
