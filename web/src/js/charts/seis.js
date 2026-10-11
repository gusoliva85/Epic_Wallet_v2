/* Gráfico de los últimos seis meses · F06-T05
   Referencia: 01_Documento_General.md §14 · 02_Documento_Tecnico.md §14.2

   Tres modos (Técnico §14.2): "barras" compara ingreso, egreso y
   ahorro de cada mes; "ahorro" deja sólo esa barra; "tasa" es la línea
   de la tasa de ahorro, en porcentaje. Mismo estilo que el gráfico
   diario (F06-T02, ya aprobado): degradé sutil y esquinas de arriba
   redondeadas en las barras, área de relleno degradada bajo la línea.

   El ahorro de un mes puede ser negativo (se gastó más de lo que
   entró) — acá SÍ se dibuja así, con `ejeConCero`/`tramoDeBarra`: una
   barra que crece hacia abajo del cero en vez de clavarse en cero o
   mostrarse como si fuera positiva.

   Recibe `ultimosSeisMeses` tal cual lo manda `GET /api/dashboard`
   (`last_six_months`: entre 1 y 6 meses, del más viejo al más nuevo —
   "con menos de seis meses cargados muestra los que hay, sin huecos
   falsos" es el criterio de aceptación de la tarea, y se cumple solo:
   nunca se completa con meses que no existen). `saving_rate` puede
   venir `null` (el mes no tuvo ingresos): ese mes no tiene punto en el
   modo "tasa", nunca se inventa un cero. */

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

export const MODOS = Object.freeze(["barras", "ahorro", "tasa"]);

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

function formatoPorcentaje(v) {
  return `${Math.round(v)}%`;
}

/** Modo "barras": ingreso, egreso y ahorro de cada mes, tres barras
 * angostas una al lado de la otra. */
function barras(meses, iw, ih) {
  const n = meses.length;
  const slot = iw / n;
  const ancho = Math.max(3, Math.min(16, slot * 0.24));

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
    salida += barra(cx, toNum(m.income), `url(#${idInc})`, -ancho - 2);
    salida += barra(cx, toNum(m.expense), `url(#${idEgr})`, 0);
    salida += barra(cx, toNum(m.saving), `url(#${idSav})`, ancho + 2);
  });

  return { svg: salida, maximo: eje.ymax, minimo: eje.ymin };
}

/** Modo "ahorro": una sola barra por mes. */
function soloAhorro(meses, iw, ih) {
  const n = meses.length;
  const slot = iw / n;
  const ancho = Math.max(4, Math.min(34, slot * 0.6));
  const eje = ejeConCero(
    meses.map((m) => toNum(m.saving)),
    { y: PT, alto: ih },
  );

  const idSav = idUnico("as");
  let salida =
    "<defs>" +
    `<linearGradient id="${idSav}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="var(--color-sav)" stop-opacity=".82"/>` +
    `<stop offset="1" stop-color="var(--color-sav)" stop-opacity="1"/>` +
    "</linearGradient></defs>";

  meses.forEach((m, i) => {
    const valor = toNum(m.saving);
    if (!valor) return;
    const cx = PL + slot * i + slot / 2;
    const { y, alto } = tramoDeBarra(valor, eje);
    const radio = Math.min(5, ancho / 2.2);
    salida += `<path class="bar" d="${trazoBarraRedondeada(cx - ancho / 2, y, ancho, alto, radio)}" fill="url(#${idSav})"/>`;
  });

  return { svg: salida, maximo: eje.ymax, minimo: eje.ymin };
}

/** Modo "tasa": la línea de tasa de ahorro, en porcentaje. Los meses
 * con `saving_rate: null` (sin ingresos ese mes) cortan la línea en
 * vez de inventar un punto en cero. */
function tasaDeAhorro(meses, iw, ih) {
  const n = meses.length;
  const slot = iw / n;
  const x = (i) => PL + slot * i + slot / 2;

  const valores = meses.map((m) => (m.saving_rate == null ? null : toNum(m.saving_rate)));
  const eje = ejeConCero(
    valores.filter((v) => v != null),
    { y: PT, alto: ih },
  );
  const y = eje.yDe;

  // Agrupa en tramos continuos: un `null` corta la línea, no la une
  // por encima del hueco.
  const tramos = [];
  let actual = [];
  valores.forEach((v, i) => {
    if (v == null) {
      if (actual.length) tramos.push(actual);
      actual = [];
      return;
    }
    actual.push({ i, v });
  });
  if (actual.length) tramos.push(actual);

  const idArea = idUnico("ta");
  let salida =
    "<defs>" +
    `<linearGradient id="${idArea}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="var(--color-sav)" stop-opacity=".32"/>` +
    `<stop offset="1" stop-color="var(--color-sav)" stop-opacity="0"/>` +
    "</linearGradient></defs>";

  for (const tramo of tramos) {
    const trazo = tramo.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
    if (tramo.length > 1) {
      const base = (PT + ih).toFixed(1);
      const area = `${trazo} L${x(tramo.at(-1).i).toFixed(1)} ${base} L${x(tramo[0].i).toFixed(1)} ${base} Z`;
      salida += `<path class="areafill" d="${area}" fill="url(#${idArea})"/>`;
    }
    salida += `<path class="lineseries" d="${trazo}" stroke="var(--color-sav)" stroke-width="2.7"/>`;
    for (const p of tramo) {
      salida +=
        `<circle class="areafill punto-brillante" cx="${x(p.i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="4.2" fill="var(--color-sav)" stroke="var(--color-bg-1)" stroke-width="2"/>` +
        `<text class="axis-v" x="${x(p.i).toFixed(1)}" y="${(y(p.v) - 11).toFixed(1)}" text-anchor="middle" font-weight="700" fill="var(--color-sav)">${formatoPorcentaje(p.v)}</text>`;
    }
  }

  return { svg: salida, maximo: eje.ymax, minimo: eje.ymin };
}

/**
 * El gráfico de los últimos seis meses completo.
 *
 * @param {object[]} ultimosSeisMeses `last_six_months` de `GET /api/dashboard`
 * @param {"barras"|"ahorro"|"tasa"} modo
 */
export function dibujar(ultimosSeisMeses, modo = "barras") {
  const iw = ANCHO - PL - PR;
  const ih = ALTO - PT - PB;
  const etiquetas = ultimosSeisMeses.map(etiquetaDeMes);

  const cuerpo =
    modo === "ahorro"
      ? soloAhorro(ultimosSeisMeses, iw, ih)
      : modo === "tasa"
        ? tasaDeAhorro(ultimosSeisMeses, iw, ih)
        : barras(ultimosSeisMeses, iw, ih);

  return (
    etiquetaSvg(ANCHO, ALTO) +
    grilla({
      x: PL,
      y: PT,
      ancho: iw,
      alto: ih,
      maximo: cuerpo.maximo,
      minimo: cuerpo.minimo,
      formatear: modo === "tasa" ? formatoPorcentaje : fmtK,
    }) +
    cuerpo.svg +
    ejeDeCategorias(etiquetas, { x: PL, ancho: iw, y: PT + ih + 18, centradoEnSlot: true, todas: true }) +
    "</svg>"
  );
}
