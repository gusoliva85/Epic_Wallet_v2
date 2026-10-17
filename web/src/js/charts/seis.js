/* Gráfico de los últimos seis meses · F06-T05, mudado a Historial y
   simplificado a pedido de Gustavo (2026-10-17): vivía en el tablero
   de Inicio con tres modos (barras/ahorro/tasa); ahora vive en
   Historial, debajo de la tabla de meses y arriba de la evolución del
   ahorro, y siempre en barras — los otros dos modos se sacaron, no se
   ocultaron.
   Referencia: 01_Documento_General.md §14 · 02_Documento_Tecnico.md §14.2

   Ingreso, egreso y ahorro de cada mes, tres barras angostas una al
   lado de la otra. Mismo estilo que el gráfico diario (F06-T02):
   degradé sutil y esquinas de arriba redondeadas.

   El ahorro de un mes puede ser negativo (se gastó más de lo que
   entró) — se dibuja así, con `ejeConCero`/`tramoDeBarra`: una barra
   que crece hacia abajo del cero en vez de clavarse en cero o
   mostrarse como si fuera positiva.

   Recibe los mismos seis meses que antes (del más viejo al más
   nuevo, entre 1 y 6) — "con menos de seis meses cargados muestra los
   que hay, sin huecos falsos" sigue cumpliéndose solo: nunca se
   completa con meses que no existen. */

import { toNum, fmtK } from "../format.js";
import {
  ejeConCero,
  tramoDeBarra,
  trazoBarraRedondeada,
  etiquetaSvg,
  grilla,
  ejeDeCategorias,
  idUnico,
} from "./svg.js";

const ANCHO = 760;
const ALTO = 262;
const PL = 52;
const PR = 16; // ningún modo acá necesita un eje derecho
const PT = 18;
const PB = 28;

const MESES_LARGOS = new Intl.DateTimeFormat("es-AR", {
  month: "long",
  timeZone: "America/Argentina/Buenos_Aires",
});

/** "Octubre 26" — Gustavo lo pidió completo (F06-T05, corrección): el
 * nombre abreviado ("Oct '26") quedaba menos claro. Con hasta seis
 * meses sigue entrando sin amontonarse. Mediodía UTC, mismo motivo que
 * el resto de la aplicación: a medianoche la zona Argentina corre la
 * fecha al mes anterior. */
export function etiquetaDeMes({ year, month }) {
  const texto = MESES_LARGOS.format(new Date(Date.UTC(year, month - 1, 1, 12)));
  const letra = texto.charAt(0).toUpperCase() + texto.slice(1);
  return `${letra} ${String(year).slice(2)}`;
}

/** Ingreso, egreso y ahorro de cada mes, tres barras angostas una al
 * lado de la otra. El ancho sube hasta 21 px (antes 16) y queda sólo
 * la separación mínima entre barras de un mismo mes — pedido de
 * Gustavo: con seis meses cargados, el hueco entre un mes y el
 * siguiente se veía más grande que las barras mismas. */
function barras(meses, iw, ih) {
  const n = meses.length;
  const slot = iw / n;
  const ancho = Math.max(4, Math.min(21, slot * 0.3));

  const valores = meses.flatMap((m) => [toNum(m.income), toNum(m.expense), toNum(m.saving)]);
  const eje = ejeConCero(valores, { y: PT, alto: ih });

  const idInc = idUnico("si");
  const idEgr = idUnico("se");
  const idSav = idUnico("ss");
  const degrade = (id, color) =>
    `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${color}" stop-opacity=".82"/>` +
    `<stop offset="1" stop-color="${color}" stop-opacity="1"/>` +
    "</linearGradient>";

  const barra = (cx, valor, relleno, offset) => {
    if (!valor) return "";
    const { y, alto } = tramoDeBarra(valor, eje);
    const radio = Math.min(3.5, ancho / 2.2);
    return `<path class="bar" d="${trazoBarraRedondeada(cx + offset - ancho / 2, y, ancho, alto, radio)}" fill="${relleno}"/>`;
  };

  let salida =
    "<defs>" + degrade(idInc, "var(--color-inc)") + degrade(idEgr, "var(--color-egr)") + degrade(idSav, "var(--color-sav)") + "</defs>";

  meses.forEach((m, i) => {
    const cx = PL + slot * i + slot / 2;
    salida += barra(cx, toNum(m.income), `url(#${idInc})`, -ancho - 1);
    salida += barra(cx, toNum(m.expense), `url(#${idEgr})`, 0);
    salida += barra(cx, toNum(m.saving), `url(#${idSav})`, ancho + 1);
  });

  return { svg: salida, maximo: eje.ymax, minimo: eje.ymin };
}

/**
 * El gráfico de los últimos seis meses completo.
 *
 * @param {object[]} ultimosSeisMeses meses del más viejo al más nuevo,
 *   cada uno con `income`/`expense`/`saving` (strings decimales)
 */
export function dibujar(ultimosSeisMeses) {
  const iw = ANCHO - PL - PR;
  const ih = ALTO - PT - PB;
  const etiquetas = ultimosSeisMeses.map(etiquetaDeMes);
  const cuerpo = barras(ultimosSeisMeses, iw, ih);

  return (
    etiquetaSvg(ANCHO, ALTO) +
    grilla({
      x: PL,
      y: PT,
      ancho: iw,
      alto: ih,
      maximo: cuerpo.maximo,
      minimo: cuerpo.minimo,
      formatear: fmtK,
    }) +
    cuerpo.svg +
    ejeDeCategorias(etiquetas, { x: PL, ancho: iw, y: PT + ih + 18, centradoEnSlot: true, todas: true }) +
    "</svg>"
  );
}
