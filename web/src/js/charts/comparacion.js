/* Gráfico de comparación de un ítem · F13-T02
   Referencia: 01_Documento_General.md §14 · skill epic-wallet-ui §9
   Mockup aprobado: documentacion/mockups/04_Mockup_Comparacion_y_Vencimientos.html

   Una barra por mes con el total de ese ítem, más la línea punteada del
   promedio del período. Mismo estilo que los otros tres gráficos: SVG
   armado acá, grilla y ejes de `svg.js`, colores por variable CSS.

   TRES COSAS PROPIAS DE ESTE GRÁFICO

   1. **El ancho de cada mes tiene tope** (`SLOT_MAX`) y el grupo va
      centrado. Con tres o seis meses y el ancho repartido a secas, las
      barras quedaban a media pantalla una de la otra (Gustavo,
      2026-11-10: "muy espaciado de un mes al otro"). Lo que sobra ahora
      es margen a los costados, no distancia entre barras.

   2. **Hasta siete meses el dibujo ENTRA en la tarjeta** (`viewBox` de
      400) y no hay que arrastrarlo de lado; con más, crece y la tarjeta
      desplaza, como el gráfico diario. La letra se mantiene del mismo
      tamaño en los dos casos porque `etiquetaSvg` publica la escala y
      el CSS la compensa (F13-T01).

   3. **Un mes sin ese ítem no es un cero.** Se escribe "sin dato" en el
      lugar de la barra. Un cero dibujaría una barra en el piso, que se
      lee como "ese mes no gasté", y lo que pasó es que no había nada
      que pagar.

   El último mes de la serie es el mes en curso: va más tenue y la
   pantalla aclara que es parcial. */

import { toNum, fmtK } from "../format.js";
import { escalaRedonda, etiquetaSvg, grilla, idUnico } from "./svg.js";

const ALTO = 238;
const PL = 50;
const PR = 12;
const PT = 26;
const PB = 28;

/** Hasta acá el gráfico entra en la pantalla sin scroll lateral. */
const MESES_QUE_ENTRAN = 7;
/** Ancho del `viewBox` cuando entra, y por mes cuando no. */
const ANCHO_QUE_ENTRA = 400;
const ANCHO_POR_MES = 56;
/** Tope del ancho de cada mes: lo que evita las barras separadas. */
const SLOT_MAX = 68;

const MESES_CORTOS = new Intl.DateTimeFormat("es-AR", {
  month: "short",
  timeZone: "America/Argentina/Buenos_Aires",
});

/** "oct 26". Mediodía UTC, mismo motivo que el resto de la aplicación:
 * a medianoche la zona Argentina corre la fecha al mes anterior. */
export function etiquetaDeMes({ year, month }) {
  const texto = MESES_CORTOS.format(new Date(Date.UTC(year, month - 1, 1, 12)))
    .replace(".", "")
    .slice(0, 3);
  return `${texto} ${String(year).slice(2)}`;
}

/**
 * Calcula la geometría del gráfico: cuánto mide, cuánto ocupa cada mes
 * y dónde arranca el grupo. Pura y exportada para poder probarla sin
 * DOM — es donde vive la decisión 1.
 *
 * @param {number} cantidad cuántos meses se dibujan
 */
export function geometria(cantidad) {
  const n = Math.max(1, cantidad);
  const cabe = n <= MESES_QUE_ENTRAN;
  const ancho = cabe ? ANCHO_QUE_ENTRA : ANCHO_POR_MES * n + PL + PR - 6;
  const interior = ancho - PL - PR;
  const slot = Math.min(interior / n, SLOT_MAX);
  const grupo = slot * n;
  return {
    cabe,
    ancho,
    interior,
    slot,
    // Centrado: lo que sobra queda como margen a los dos lados.
    inicioX: PL + (interior - grupo) / 2,
    barra: Math.max(9, Math.min(44, slot * 0.68)),
  };
}

/**
 * El gráfico completo.
 *
 * @param {{year:number, month:number, total:string|null, parcial?:boolean}[]} meses
 *   del más viejo al más nuevo, con el total ya formateado como texto
 *   decimal (nunca un número: el frontend no hace aritmética de plata,
 *   sólo la convierte para dibujar).
 * @param {{seleccion?: number|null, color?: string}} opciones
 */
export function dibujar(meses, { seleccion = null, color = "var(--color-egr)" } = {}) {
  if (!meses.length) return "";

  const g = geometria(meses.length);
  const ih = ALTO - PT - PB;

  const valores = meses.filter((m) => m.total !== null).map((m) => toNum(m.total));
  const maximo = escalaRedonda(Math.max(0, ...valores));
  const promedio = valores.length
    ? valores.reduce((a, v) => a + v, 0) / valores.length
    : 0;
  const yDe = (v) => PT + ih - (ih * v) / maximo;

  const id = idUnico("cmp");
  let salida =
    etiquetaSvg(g.ancho, ALTO) +
    `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${color}" stop-opacity=".82"/>` +
    `<stop offset="1" stop-color="${color}" stop-opacity="1"/>` +
    "</linearGradient></defs>" +
    grilla({ x: PL, y: PT, ancho: g.interior, alto: ih, maximo });

  meses.forEach((m, i) => {
    const cx = g.inicioX + g.slot * i + g.slot / 2;
    const etiqueta = etiquetaDeMes(m);

    if (m.total === null) {
      // Decisión 3: sin dato, no cero.
      salida += `<text class="axis-t" x="${cx}" y="${PT + ih - 8}" text-anchor="middle">sin dato</text>`;
    } else {
      const valor = toNum(m.total);
      const y = yDe(valor);
      const alto = Math.max(2, PT + ih - y);
      const elegido = seleccion === i;
      // El mes en curso va en tinta y no en el color de la serie: es
      // parcial, y pintarlo igual que los cerrados invita a compararlo
      // de frente con ellos.
      const relleno = m.parcial ? "var(--color-ink-4)" : `url(#${id})`;
      salida +=
        `<rect class="bar" data-mes="${i}" x="${(cx - g.barra / 2).toFixed(1)}" y="${y.toFixed(1)}" ` +
        `width="${g.barra.toFixed(1)}" height="${alto.toFixed(1)}" rx="4" fill="${relleno}" ` +
        `opacity="${elegido ? 1 : m.parcial ? 0.55 : 0.9}"/>`;
      if (meses.length <= MESES_QUE_ENTRAN) {
        salida += `<text class="axis-v" x="${cx}" y="${(y - 8).toFixed(1)}" text-anchor="middle">${fmtK(m.total)}</text>`;
      }
    }

    // Con muchos meses se saltea uno de cada dos, igual que el eje de
    // días del gráfico diario: el último siempre queda.
    const saltea = meses.length > 9 && (meses.length - 1 - i) % 2 === 1;
    if (!saltea) {
      salida += `<text class="axis-t" x="${cx}" y="${PT + ih + 18}" text-anchor="middle">${etiqueta}</text>`;
    }
  });

  if (valores.length) {
    const yp = yDe(promedio);
    salida +=
      `<line x1="${PL}" y1="${yp.toFixed(1)}" x2="${PL + g.interior}" y2="${yp.toFixed(1)}" ` +
      'stroke="var(--color-accent)" stroke-width="1.6" stroke-dasharray="5 4"/>' +
      `<text class="axis-v" x="${PL + g.interior}" y="${(yp - 7).toFixed(1)}" text-anchor="end">` +
      `prom. ${fmtK(String(promedio))}</text>`;
  }

  return salida + "</svg>";
}
