/* Filas de lista · F01-T10
   Referencia: mockup 01, .row · SKILL.md §8

   Dos filas y un separador:

     filaMovimiento   icono de dirección, categoría, fecha y
                      descripción, importe con signo y color.
     filaCategoria    inicial, nombre, cantidad y porcentaje, barra de
                      participación y total.
     separadorDia     la cabecera de un grupo de movimientos.

   Las dos filas son `<button>`: se abren para ver el detalle, así que
   tienen que alcanzarse con el tabulador y mostrar el foco. Un `div`
   con `onclick` no se alcanza y no lo anuncia el lector.

   El importe llega ya formateado del backend. El frontend sólo
   formatea y nunca calcula (General, regla del cliente), así que acá
   no se hace aritmética: el signo lo decide `tipo`, no el valor. */

import { esc } from "../format.js";
import { icono } from "../iconos.js";

/* Signo menos tipográfico (U+2212), no el guión del teclado. El guión
   es más corto y a la altura equivocada: al lado de un `+` en una
   columna de cifras, se nota. */
const MENOS = "−";

/**
 * Fila de movimiento.
 *
 * El color no es el único que dice si entra o sale: va además el signo
 * y la flecha. Es regla del sistema, y sin eso un ingreso y un egreso
 * se confunden para quien no distingue el verde del rojo.
 *
 * @param {{id: string|number, tipo: "ingreso"|"egreso", categoria: string,
 *          importe: string, fecha: string, descripcion?: string,
 *          origen?: string}} m
 */
export function filaMovimiento({
  id,
  tipo,
  categoria,
  importe,
  fecha,
  descripcion = "",
  origen = "",
}) {
  const entra = tipo === "ingreso";
  const detalle = descripcion
    ? `${esc(fecha)} · ${esc(descripcion)}`
    : esc(fecha);

  return (
    `<button class="row cg" type="button" data-movimiento="${esc(id)}" ` +
    `style="--c:var(--color-${entra ? "inc" : "egr"})">` +
    // aria-hidden: la flecha repite lo que ya dice el signo del importe.
    `<span class="row-ico" aria-hidden="true">` +
    `<svg viewBox="0 0 24 24">${icono(entra ? "sube" : "baja")}</svg>` +
    "</span>" +
    '<span class="row-main">' +
    `<b>${esc(categoria)}</b><span>${detalle}</span>` +
    "</span>" +
    '<span class="row-val">' +
    `<b class="num ${entra ? "amt-in" : "amt-out"}">` +
    `${entra ? "+" : MENOS}${esc(importe)}</b>` +
    `<span>${esc(origen)}</span>` +
    "</span>" +
    "</button>"
  );
}

/**
 * Fila de categoría, con barra de participación.
 *
 * `participacion` es cuánto se llena la barra (0–100), relativo a la
 * categoría que más gastó. Se recorta igual que en las tarjetas: un
 * valor fuera de rango daría una barra negativa o desbordada.
 *
 * @param {{id: string|number, nombre: string, total: string,
 *          detalle?: string, participacion?: number, pie?: string,
 *          color?: string}} c
 */
export function filaCategoria({
  id,
  nombre,
  total,
  detalle = "",
  participacion = 0,
  pie = "",
}) {
  const ancho = Math.min(100, Math.max(0, Number(participacion) || 0));

  return (
    `<button class="row cg" type="button" data-categoria="${esc(id)}" ` +
    'style="--c:var(--color-egr)">' +
    // Las iniciales son un adorno que repite el nombre de al lado: si
    // no se ocultan, el lector dice «AL Alquiler».
    `<span class="row-ico" aria-hidden="true">${esc(inicial(nombre))}</span>` +
    '<span class="row-main">' +
    `<b>${esc(nombre)}</b><span>${esc(detalle)}</span>` +
    // La barra es decoración: el porcentaje ya está en el detalle.
    '<span class="cat-track" aria-hidden="true">' +
    `<i class="cat-fill" data-ancho="${ancho}"></i>` +
    "</span>" +
    "</span>" +
    '<span class="row-val">' +
    `<b class="num amt-out">${esc(total)}</b><span>${esc(pie)}</span>` +
    "</span>" +
    "</button>"
  );
}

/**
 * Las dos primeras letras del nombre, en mayúscula.
 *
 * Se exporta porque es la única parte de la fila que transforma el
 * dato en lugar de mostrarlo, y conviene poder probarla sola.
 */
export function inicial(nombre) {
  return String(nombre ?? "")
    .trim()
    .slice(0, 2)
    .toUpperCase();
}

/** Cabecera de un grupo de movimientos: «04 de octubre 2026». */
export function separadorDia(texto) {
  return `<div class="day-sep">${esc(texto)}</div>`;
}

/**
 * Anima las barras de participación que haya dentro de `raiz`.
 *
 * Igual que las barras de las tarjetas: nacen en 0 y reciben el ancho
 * al frame siguiente, o la transición no tiene de dónde partir.
 */
export function animarParticipacion(raiz = document) {
  const barras = raiz.querySelectorAll(".cat-fill[data-ancho]");
  if (!barras.length) return;

  requestAnimationFrame(() => {
    barras.forEach((b) => {
      b.style.width = `${b.dataset.ancho}%`;
    });
  });
}

/**
 * Pinta una lista de filas y arranca las barras.
 *
 * De una sola vez, por el mismo motivo que las tarjetas: una
 * asignación a `innerHTML` por fila recalcula el layout una vez por
 * fila, y una lista de movimientos de un mes tiene decenas.
 */
export function pintarFilas(contenedor, filas) {
  if (!contenedor) return;
  contenedor.innerHTML = filas.join("");
  animarParticipacion(contenedor);
}
