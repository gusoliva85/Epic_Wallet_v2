/* Tarjetas de indicador · F01-T09
   Referencia: 02_Documento_Tecnico.md §12.4 · mockup 01, .kpi

   Funciones que reciben datos y devuelven un string de HTML. Sin ciclo
   de vida ni estado interno, como el resto del catálogo.

   Dos variantes:

     héroe    cifra grande, barra de progreso y pie de dos datos.
              Es el ahorro del mes y el patrimonio.
     métrica  etiqueta, icono, cifra y subtítulo. Todo lo demás.

   TODO dato que entra pasa por `esc()`. El ejemplo del documento
   técnico §12.4 escapa `label` y `value` pero no `sub`: un subtítulo
   es tan del servidor como los otros dos —puede traer el nombre de una
   categoría que escribió el usuario— y acá se escapa también. */

import { esc } from "../format.js";
import { icono } from "../iconos.js";

/* Los colores que puede pedir una tarjeta. Lista cerrada a propósito:
   el valor termina dentro de un atributo `style`, y la política de
   contenido del sitio admite estilos en línea. Con un color libre, un
   dato del servidor podría inyectar CSS. Con esto, lo peor que pasa es
   que una tarjeta salga del color del acento. */
const COLORES = {
  inc: "var(--color-inc)",
  egr: "var(--color-egr)",
  sav: "var(--color-sav)",
  ok: "var(--color-ok)",
  warn: "var(--color-warn)",
  pend: "var(--color-pend)",
  crit: "var(--color-crit)",
  accent: "var(--color-accent)",
};

export const COLORES_VALIDOS = Object.freeze(Object.keys(COLORES));

function color(nombre) {
  return COLORES[nombre] ?? COLORES.accent;
}

/**
 * Tarjeta de métrica: etiqueta, icono, cifra y subtítulo.
 *
 * @param {{etiqueta: string, cifra: string, sub?: string,
 *          color?: string, icono?: string}} datos
 */
export function tarjetaMetrica({
  etiqueta,
  cifra,
  sub = "",
  color: c,
  icono: ico,
}) {
  return (
    `<article class="kpi kpi-metric shell" style="--c:${color(c)}">` +
    '<div class="kpi-top">' +
    `<div class="kpi-label">${esc(etiqueta)}</div>` +
    (ico
      ? `<span class="kpi-ico" aria-hidden="true"><svg viewBox="0 0 24 24">${icono(ico)}</svg></span>`
      : "") +
    "</div>" +
    `<div class="kpi-num num">${esc(cifra)}</div>` +
    `<div class="kpi-sub">${esc(sub)}</div>` +
    "</article>"
  );
}

/**
 * Tarjeta héroe: cifra grande, barra de progreso y pie de dos datos.
 *
 * `porcentaje` es cuánto se llena la barra. Se recorta a 0–100: un
 * ahorro negativo daría una barra de ancho negativo, que el navegador
 * ignora, y un 140 % desbordaría el surco.
 *
 * @param {{etiqueta: string, cifra: string, sub?: string,
 *          porcentaje?: number, pieIzq?: string, pieDer?: string,
 *          color?: string}} datos
 */
export function tarjetaHeroe({
  etiqueta,
  cifra,
  sub = "",
  porcentaje = 0,
  pieIzq = "",
  pieDer = "",
  color: c,
}) {
  const ancho = Math.min(100, Math.max(0, Number(porcentaje) || 0));

  return (
    `<article class="kpi kpi--hero shell" style="--c:${color(c)}">` +
    `<div class="kpi-label">${esc(etiqueta)}</div>` +
    `<div class="kpi-num num">${esc(cifra)}</div>` +
    `<div class="kpi-sub">${esc(sub)}</div>` +
    // El surco es decoración; la cifra de arriba ya dice el valor. Sin
    // aria-hidden, el lector anuncia un progreso que no agrega nada.
    '<div class="fin-track" aria-hidden="true">' +
    `<div class="fin-fill" data-ancho="${ancho}"></div>` +
    "</div>" +
    '<div class="fin-foot">' +
    `<span>${esc(pieIzq)}</span><span>${esc(pieDer)}</span>` +
    "</div>" +
    "</article>"
  );
}

/**
 * Anima las barras de progreso que haya dentro de `raiz`.
 *
 * Se llama DESPUÉS de insertar el HTML. La barra nace en 0 y crece al
 * frame siguiente: puesta directo en su ancho, la transición no tiene
 * de dónde partir y aparece ya llena.
 */
export function animarBarras(raiz = document) {
  const barras = raiz.querySelectorAll(".fin-fill[data-ancho]");
  if (!barras.length) return;

  requestAnimationFrame(() => {
    barras.forEach((b) => {
      b.style.width = `${b.dataset.ancho}%`;
    });
  });
}

/**
 * Pinta una lista de tarjetas en un contenedor y arranca las barras.
 *
 * Las tarjetas se escriben de una sola vez y no una por una: con siete
 * asignaciones a `innerHTML` el navegador recalcula el layout siete
 * veces, y en un teléfono se ve el salto.
 */
export function pintarTarjetas(contenedor, tarjetas) {
  if (!contenedor) return;
  contenedor.innerHTML = tarjetas.join("");
  animarBarras(contenedor);
}
