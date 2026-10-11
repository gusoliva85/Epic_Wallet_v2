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
 * Un eje que puede cruzar el cero — el ahorro de un mes puede ser
 * negativo (se gastó más de lo que entró), y eso tiene que poder
 * dibujarse sin mentir mostrándolo como si fuera cero o positivo.
 * Techo y piso cada uno con su propia escala redonda (de
 * `escalaRedonda`), y `yDe()` convierte cualquier valor en su posición
 * Y dentro de `[y, y+alto]`. Con puros valores en cero, da un rango de
 * 1 — nunca cero, que dividiría por cero.
 *
 * @param {number[]} valores
 * @param {{y:number, alto:number}} caja el área disponible en pantalla
 */
export function ejeConCero(valores, { y, alto }) {
  const techo = Math.max(0, ...valores);
  const piso = Math.min(0, ...valores);
  const ymax = techo > 0 ? escalaRedonda(techo) : 0;
  const ymin = piso < 0 ? -escalaRedonda(-piso) : 0;
  const rango = ymax - ymin || 1;
  const yDe = (v) => y + alto - (alto * (v - ymin)) / rango;
  return { yDe, yCero: yDe(0), ymax, ymin, rango };
}

/**
 * El tramo `{y, alto}` de una barra que puede ser negativa: crece
 * hacia arriba desde el cero si el valor es positivo, hacia abajo si
 * es negativo — nunca al revés, o un ahorro negativo se vería como
 * positivo. Mismo mínimo de 1,5 px que `alturaDeBarra`, para que un
 * valor chico no desaparezca.
 *
 * @param {number} valor
 * @param {{yDe:(v:number)=>number, yCero:number}} eje de `ejeConCero`
 */
export function tramoDeBarra(valor, eje) {
  if (!valor) return { y: eje.yCero, alto: 0 };
  const y = eje.yDe(valor);
  if (valor > 0) return { y, alto: Math.max(1.5, eje.yCero - y) };
  return { y: eje.yCero, alto: Math.max(1.5, y - eje.yCero) };
}

/**
 * El trazo (`d`) de una barra con sólo las esquinas de ARRIBA
 * redondeadas: el borde inferior queda recto, apoyado en el eje. Con
 * las cuatro esquinas iguales —lo que da un `<rect rx>`— una barra
 * que nace del cero parece flotar en vez de pararse sobre el eje; acá
 * se nota más cuanto más ancha es la barra, que es justo el pedido de
 * F06-T02 (barras más gruesas).
 *
 * @param {number} x borde izquierdo de la barra
 * @param {number} yTope el techo de la barra (el valor más alto, en Y de pantalla)
 * @param {number} ancho
 * @param {number} alto
 * @param {number} radio se recorta solo si no entra en el ancho o el alto
 */
export function trazoBarraRedondeada(x, yTope, ancho, alto, radio) {
  const r = Math.max(0, Math.min(radio, ancho / 2, alto));
  const base = yTope + alto;
  if (r === 0) {
    return `M${x.toFixed(1)} ${base.toFixed(1)} L${x.toFixed(1)} ${yTope.toFixed(1)} L${(x + ancho).toFixed(1)} ${yTope.toFixed(1)} L${(x + ancho).toFixed(1)} ${base.toFixed(1)} Z`;
  }
  return (
    `M${x.toFixed(1)} ${base.toFixed(1)} ` +
    `L${x.toFixed(1)} ${(yTope + r).toFixed(1)} ` +
    `Q${x.toFixed(1)} ${yTope.toFixed(1)} ${(x + r).toFixed(1)} ${yTope.toFixed(1)} ` +
    `L${(x + ancho - r).toFixed(1)} ${yTope.toFixed(1)} ` +
    `Q${(x + ancho).toFixed(1)} ${yTope.toFixed(1)} ${(x + ancho).toFixed(1)} ${(yTope + r).toFixed(1)} ` +
    `L${(x + ancho).toFixed(1)} ${base.toFixed(1)} Z`
  );
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
 * Grilla horizontal y eje de valores, de `minimo` a `maximo` en
 * `pasos` saltos (5 líneas con 4 pasos, el valor por defecto). Cada
 * etiqueta pasa por `fmtK` salvo que se pida otro formato — nunca un
 * número crudo, que en millones no se lee.
 *
 * `minimo` es 0 salvo que se pida otra cosa: la mayoría de los
 * gráficos no cruzan el cero. Cuando sí lo hacen (el ahorro de un mes
 * puede ser negativo), pasarle el `ymin` de `ejeConCero` acá es lo que
 * hace que la grilla quede alineada con las barras — las dos tienen
 * que usar el mismo rango, o la línea del cero de una no cae donde
 * las barras de la otra lo tienen.
 *
 * @param {{x:number, y:number, ancho:number, alto:number, maximo:number,
 *          minimo?:number, formatear?:(n:number)=>string, pasos?:number}} datos
 */
export function grilla({ x, y, ancho, alto, maximo, minimo = 0, formatear = fmtK, pasos = 4 }) {
  const rango = maximo - minimo || 1;
  let salida = "";
  for (let i = 0; i <= pasos; i++) {
    const valor = minimo + (rango * i) / pasos;
    const posY = y + alto - (alto * (valor - minimo)) / rango;
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
 * el borde del gráfico no quede sin etiqueta. `todas: true` apaga el
 * salto (Gustavo, F06-T02: quiere ver cada día del gráfico diario,
 * sin huecos) — queda a criterio de quien llama, porque un eje con
 * muchas más categorías (nombres de categoría, por ejemplo) sí puede
 * necesitar saltar para no amontonarse.
 *
 * @param {string[]} etiquetas
 * @param {{x:number, ancho:number, y:number, centradoEnSlot?:boolean, todas?:boolean}} datos
 *   `centradoEnSlot`: cada etiqueta va al centro de su franja
 *   (`ancho/n`) — así dibujan las barras agrupadas por día o por mes.
 *   Sin eso, va distribuida de punta a punta — así dibuja una línea.
 */
export function ejeDeCategorias(etiquetas, { x, ancho, y, centradoEnSlot = false, todas = false }) {
  const n = etiquetas.length;
  if (n === 0) return "";
  const salto = todas ? 1 : n > 24 ? 4 : n > 14 ? 3 : n > 8 ? 2 : 1;
  const slot = ancho / n;
  let salida = "";
  etiquetas.forEach((etiqueta, i) => {
    if (i % salto !== 0 && i !== n - 1) return;
    const posX = centradoEnSlot ? x + slot * i + slot / 2 : x + (ancho * i) / (n - 1 || 1);
    salida += `<text class="axis-t" x="${posX.toFixed(1)}" y="${y}" text-anchor="middle">${esc(etiqueta)}</text>`;
  });
  return salida;
}
