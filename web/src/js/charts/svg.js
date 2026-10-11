/* Utilidades de gráficos SVG · F06-T01
   Referencia: 02_Documento_Tecnico.md §14.3 · skill epic-wallet-ui §9

   Las piezas que van a compartir los cinco gráficos de la Fase 6:
   la escala que cae en valores redondos, la etiqueta del `<svg>`
   mismo, la grilla con su eje de valores, el eje de categorías (días,
   meses, lo que haga falta) y el identificador único que necesita
   cada `<linearGradient>` para no pisarle el color a otro gráfico que
   esté en la misma pantalla.

   NINGÚN color se escribe acá. `.gridline`/`.axis-t`/`.axis-v` toman
   el suyo de `components.css`, que usa tokens de tinta; el color de
   cada serie (una barra, una línea) lo decide el gráfico que la
   dibuja, pasando `var(--color-inc))` y análogos — este archivo sólo
   arma la grilla y los ejes, nunca una barra ni una línea. */

import { esc, fmtK } from "../format.js";

let contador = 0;

/**
 * Id único para un `<linearGradient>` (o cualquier otro id que no
 * pueda repetirse dentro del documento). Dos gráficos con la misma
 * gradiente en el DOM a la vez —por ejemplo, al cambiar de vista sin
 * que el anterior se haya desmontado— terminan compartiendo el color
 * del primero que se dibujó.
 *
 * @param {string} prefijo
 */
export function idUnico(prefijo = "g") {
  contador += 1;
  return `${prefijo}${contador}`;
}

/**
 * La escala que hace que los ejes caigan en valores redondos: 1,2 ·
 * 1,5 · 2 · 2,5 · 3 · 4 · 5 · 6 · 8 · 10 veces la potencia de diez más
 * cercana a `valor`. Con `valor` en cero o negativo, el mínimo es 1 —
 * nunca una escala en cero, que dividiría por cero más abajo.
 *
 * @param {number} valor el máximo real de la serie
 * @returns {number} el máximo del eje
 */
export function escalaRedonda(valor) {
  if (!Number.isFinite(valor) || valor <= 0) return 1;
  const potencia = 10 ** Math.floor(Math.log10(valor));
  const n = valor / potencia;
  const pasos = [1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const paso = pasos.find((p) => n <= p) ?? 10;
  return paso * potencia;
}

/**
 * La altura de una barra en píxeles, con el mínimo de 1,5 px que pide
 * la sección 14.3 — sin ese piso, un gasto chico da una barra de 0 px
 * y desaparece del gráfico, que es exactamente lo que no tiene que
 * pasar: un gasto chico tiene que *verse*.
 *
 * @param {number} valor
 * @param {number} escalaMaxima el máximo del eje (de `escalaRedonda`)
 * @param {number} altoDisponible píxeles entre el cero y el techo del gráfico
 */
export function alturaDeBarra(valor, escalaMaxima, altoDisponible) {
  if (!valor || escalaMaxima <= 0) return 0;
  return Math.max(1.5, (altoDisponible * valor) / escalaMaxima);
}

/**
 * La etiqueta de apertura del `<svg>`. El `viewBox` es lo que permite
 * dibujar a 390 px o a 1440 px sin deformarse: el dibujo interno usa
 * siempre las mismas coordenadas (`ancho`×`alto`), y es el navegador
 * el que lo escala para que entre en el contenedor — `.chart-wrap`
 * (`components.css`) es ese contenedor, y decide el tamaño real.
 *
 * @param {number} ancho
 * @param {number} alto
 */
export function etiquetaSvg(ancho, alto) {
  return `<svg viewBox="0 0 ${ancho} ${alto}" preserveAspectRatio="none" role="img">`;
}

/**
 * Grilla horizontal y eje de valores, de 0 a `maximo` en `pasos`
 * saltos (5 líneas con 4 pasos, el valor por defecto). Cada etiqueta
 * pasa por `fmtK` salvo que se pida otro formato — nunca un número
 * crudo, que en millones no se lee.
 *
 * @param {{x:number, y:number, ancho:number, alto:number, maximo:number,
 *          formatear?:(n:number)=>string, pasos?:number}} datos
 */
export function grilla({ x, y, ancho, alto, maximo, formatear = fmtK, pasos = 4 }) {
  let salida = "";
  for (let i = 0; i <= pasos; i++) {
    const posY = y + alto - (alto * i) / pasos;
    const valor = (maximo * i) / pasos;
    salida +=
      `<line class="gridline" x1="${x}" y1="${posY.toFixed(1)}" x2="${(x + ancho).toFixed(1)}" y2="${posY.toFixed(1)}"/>` +
      `<text class="axis-v" x="${(x - 7).toFixed(1)}" y="${(posY + 3.2).toFixed(1)}" text-anchor="end">${esc(formatear(valor))}</text>`;
  }
  return salida;
}

/**
 * El eje de categorías: días del mes, meses, nombres de categoría —
 * lo que `etiquetas` traiga, ya resuelto por quien llama (este módulo
 * no sabe qué es un día ni un mes). Si no entran todas sin pisarse,
 * salta de a dos, tres o cuatro — la última siempre queda, para que
 * el borde del gráfico no quede sin etiqueta.
 *
 * @param {string[]} etiquetas
 * @param {{x:number, ancho:number, y:number, centradoEnSlot?:boolean}} datos
 *   `centradoEnSlot`: cada etiqueta va al centro de su franja
 *   (`ancho/n`) — así dibujan las barras agrupadas por día o por mes.
 *   Sin eso, va distribuida de punta a punta — así dibuja una línea.
 */
export function ejeDeCategorias(etiquetas, { x, ancho, y, centradoEnSlot = false }) {
  const n = etiquetas.length;
  if (n === 0) return "";
  const salto = n > 24 ? 4 : n > 14 ? 3 : n > 8 ? 2 : 1;
  const slot = ancho / n;
  let salida = "";
  etiquetas.forEach((etiqueta, i) => {
    if (i % salto !== 0 && i !== n - 1) return;
    const posX = centradoEnSlot ? x + slot * i + slot / 2 : x + (ancho * i) / (n - 1 || 1);
    salida += `<text class="axis-t" x="${posX.toFixed(1)}" y="${y}" text-anchor="middle">${esc(etiqueta)}</text>`;
  });
  return salida;
}
