/* Gráfico diario del mes · F06-T02
   Referencia: 02_Documento_Tecnico.md §14.1 · General §13 · skill §9

   Barras de ingresos y egresos por día (eje izquierdo) más la línea
   del ahorro acumulado del mes (eje derecho) — doble eje porque el
   gasto diario se mueve en decenas de miles y el ahorro acumulado en
   millones; con un solo eje la línea aplastaría las barras.

   Tres modos: "ambos" muestra las dos barras, "ingresos" y "egresos"
   sólo la suya. La línea de ahorro se mantiene visible en los tres —
   es lo que responde "cómo viene el mes hasta ahora", la pregunta que
   este gráfico existe para contestar. (Hubo un cuarto modo,
   "acumulado", que reemplazaba las barras por áreas acumuladas;
   Gustavo pidió sacarlo — F06-T02, corrección.)

   Un vidrio grafito con barras lisas quedaba chato al lado del resto
   de la aplicación, así que las barras llevan un degradé sutil de
   arriba hacia abajo (nunca un color inventado: mismo tono, menos
   opacidad arriba) y sólo las esquinas de arriba redondeadas —una
   barra con las cuatro esquinas iguales parece flotar en vez de
   pararse sobre el eje—, y la línea de ahorro lleva su propia área
   de relleno degradada debajo, el elemento protagonista del gráfico.

   Cada día decide solo cuánto ancho de barra usa (F06-T02, corrección:
   Gustavo aprobó la "opción A" de un mockup con cuatro alternativas).
   Un sueldo entra una vez al mes, no todos los días traen ingreso y
   egreso juntos: reservarle a cada día el espacio de las DOS barras
   aunque sólo existiera una dejaba un hueco vacío. Un solo tipo ese
   día → una barra ancha, centrada en toda su franja. Los dos ese
   día → dos barras finas, una al lado de la otra. Y el eje de abajo
   muestra los días TODOS, sin saltar ninguno.

   Pura: recibe `daily` (el mismo objeto de `GET /api/dashboard`) y el
   modo, devuelve el string del `<svg>`. No sabe de dónde salió el
   dato ni dónde se va a escribir — eso es trabajo de quien la llama
   (`dashboard.js`). Nunca se llama con un mes histórico: ahí
   `daily` es `null` (Regla 4) y no hay gráfico que dibujar. */

import { toNum, fmtK } from "../format.js";
import {
  escalaRedonda,
  alturaDeBarra,
  trazoBarraRedondeada,
  etiquetaSvg,
  grilla,
  ejeDeCategorias,
  idUnico,
} from "./svg.js";

const ANCHO = 760;
const ALTO = 262;
const PL = 52; // margen izquierdo: el eje de valores diarios
const PR = 58; // margen derecho: el eje del ahorro acumulado
const PT = 18;
const PB = 28;

export const MODOS = Object.freeze(["ambos", "egresos", "ingresos"]);

/** La línea de ahorro acumulado, su área de relleno y su eje derecho.
 * Se dibuja en los tres modos, así que vive aparte de las barras. */
function lineaDeAhorro(serie, iw, ih) {
  const n = serie.length;
  const minimo = Math.min(0, ...serie);
  const maximo = Math.max(0, ...serie);
  const techo = maximo > 0 ? escalaRedonda(maximo) : 0;
  const piso = minimo < 0 ? -escalaRedonda(-minimo) : 0;
  const rango = techo - piso || 1;

  const y = (v) => PT + ih - (ih * (v - piso)) / rango;
  const x = (i) => PL + (iw * (i + 0.5)) / n;

  const trazo = serie.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const base = (PT + ih).toFixed(1);
  const area = `${trazo} L${x(n - 1).toFixed(1)} ${base} L${x(0).toFixed(1)} ${base} Z`;
  const ultimo = serie[n - 1];

  // Línea de cero punteada sólo si el ahorro llegó a ser negativo
  // (Técnico §14.1): con el piso en cero, dibujarla sería repetir el
  // borde inferior del gráfico sin decir nada nuevo.
  const lineaCero =
    piso < 0
      ? `<line x1="${PL}" y1="${y(0).toFixed(1)}" x2="${(PL + iw).toFixed(1)}" y2="${y(0).toFixed(1)}" stroke="var(--color-ink-4)" stroke-width="1" stroke-dasharray="3 4" opacity=".6"/>`
      : "";

  let ejeDerecho = "";
  for (let i = 0; i <= 4; i++) {
    const v = piso + (rango * i) / 4;
    ejeDerecho += `<text class="axis-v" x="${(PL + iw + 9).toFixed(1)}" y="${(y(v) + 3.4).toFixed(1)}" fill="var(--color-sav)" opacity=".8">${fmtK(v)}</text>`;
  }
  ejeDerecho += `<text class="axis-t" x="${(PL + iw + 9).toFixed(1)}" y="${PT - 6}" fill="var(--color-sav)" opacity=".9" font-weight="700">AHORRO</text>`;

  const idArea = idUnico("da");

  return (
    "<defs>" +
    `<linearGradient id="${idArea}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="var(--color-sav)" stop-opacity=".32"/>` +
    `<stop offset="1" stop-color="var(--color-sav)" stop-opacity="0"/>` +
    "</linearGradient>" +
    "</defs>" +
    lineaCero +
    `<path class="areafill" d="${area}" fill="url(#${idArea})"/>` +
    `<path class="lineseries" d="${trazo}" stroke="var(--color-sav)" stroke-width="2.7"/>` +
    // El punto y la etiqueta quedan en el último día de la serie: hoy,
    // cuando se mira el mes actual. Es lo que distingue el día de hoy
    // en el gráfico (criterio de aceptación de la tarea).
    `<circle class="areafill punto-brillante" cx="${x(n - 1).toFixed(1)}" cy="${y(ultimo).toFixed(1)}" r="4.6" fill="var(--color-sav)" stroke="var(--color-bg-1)" stroke-width="2"/>` +
    `<text class="axis-v" x="${(x(n - 1) - 7).toFixed(1)}" y="${(y(ultimo) - 13).toFixed(1)}" text-anchor="end" font-weight="700" fill="var(--color-sav)">${fmtK(ultimo)}</text>` +
    ejeDerecho
  );
}

/** Barras de ingresos y/o egresos, según el modo — con un degradé
 * sutil (mismo tono, menos opacidad arriba) y sólo las esquinas de
 * arriba redondeadas.
 *
 * Centrado dinámico por día (Gustavo, F06-T02 — opción A del mockup
 * que aprobó): la plata de un día casi siempre es de un solo tipo —
 * un sueldo una vez al mes, no todos los días traen ingreso y
 * egreso juntos. Reservarle a cada día el espacio de las DOS barras
 * aunque sólo exista una dejaba un hueco vacío donde habría ido la
 * otra, y quedaba feo. Acá cada día decide solo: si tiene un único
 * tipo, una barra ancha y centrada en toda su franja; si tiene los
 * dos, dos barras finas una al lado de la otra, igual que antes. */
function barras(daily, iw, ih, modo) {
  const ingresos = daily.income.map(toNum);
  const egresos = daily.expense.map(toNum);
  const n = ingresos.length;
  const mostrarIngreso = modo === "ambos" || modo === "ingresos";
  const mostrarEgreso = modo === "ambos" || modo === "egresos";
  const maximo = escalaRedonda(
    Math.max(...(mostrarIngreso ? ingresos : [0]), ...(mostrarEgreso ? egresos : [0])),
  );
  const slot = iw / n;
  // Más gruesas que antes a propósito (Gustavo, F06-T02): con muchos
  // días en el mes las barras finitas se perdían en el espacio vacío
  // entre franjas. Los dos TOPES son distintos (26 contra 14) y no el
  // mismo número: en un mes con pocos días la franja es grande y, con
  // un solo tope compartido, "sola" y "par" llegaban las dos al tope y
  // se veían idénticas — justo la distinción que center dinámico
  // necesita para leerse.
  const anchoSola = Math.max(4, Math.min(26, slot * 0.8)); // un solo tipo ese día: toda la franja
  const anchoPar = Math.max(4, Math.min(14, slot * 0.62)); // los dos ese día: una al lado de la otra

  const idIngreso = idUnico("bi");
  const idEgreso = idUnico("be");
  const degrade = (id, color) =>
    `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${color}" stop-opacity=".82"/>` +
    `<stop offset="1" stop-color="${color}" stop-opacity="1"/>` +
    "</linearGradient>";

  const barra = (cx, valor, relleno, ancho, offset) => {
    if (!valor) return "";
    const alto = alturaDeBarra(valor, maximo, ih);
    const radio = Math.min(4, ancho / 2.2);
    return `<path class="bar" d="${trazoBarraRedondeada(cx + offset - ancho / 2, PT + ih - alto, ancho, alto, radio)}" fill="${relleno}"/>`;
  };

  let salida = "<defs>";
  if (mostrarIngreso) salida += degrade(idIngreso, "var(--color-inc)");
  if (mostrarEgreso) salida += degrade(idEgreso, "var(--color-egr)");
  salida += "</defs>";

  for (let i = 0; i < n; i++) {
    const cx = PL + slot * i + slot / 2;
    const hayIngreso = mostrarIngreso && ingresos[i] > 0;
    const hayEgreso = mostrarEgreso && egresos[i] > 0;

    if (hayIngreso && hayEgreso) {
      salida += barra(cx, ingresos[i], `url(#${idIngreso})`, anchoPar, -anchoPar / 2 - 1.5);
      salida += barra(cx, egresos[i], `url(#${idEgreso})`, anchoPar, anchoPar / 2 + 1.5);
    } else if (hayIngreso) {
      salida += barra(cx, ingresos[i], `url(#${idIngreso})`, anchoSola, 0);
    } else if (hayEgreso) {
      salida += barra(cx, egresos[i], `url(#${idEgreso})`, anchoSola, 0);
    }
  }
  return { svg: salida, maximo };
}

/**
 * El gráfico diario completo: barras más la línea de ahorro con su
 * eje, y el eje de días abajo.
 *
 * @param {object} daily el campo `daily` de `GET /api/dashboard`
 * @param {"ambos"|"egresos"|"ingresos"} modo
 */
export function dibujar(daily, modo = "ambos") {
  const iw = ANCHO - PL - PR;
  const ih = ALTO - PT - PB;
  const dias = daily.income.map((_, i) => String(i + 1));
  const serieDeAhorro = daily.saving_cumulative.map(toNum);

  const cuerpo = barras(daily, iw, ih, modo);

  return (
    etiquetaSvg(ANCHO, ALTO) +
    grilla({ x: PL, y: PT, ancho: iw, alto: ih, maximo: cuerpo.maximo }) +
    cuerpo.svg +
    lineaDeAhorro(serieDeAhorro, iw, ih) +
    // `todas: true` (Gustavo, F06-T02): quiere ver cada día del mes
    // en el eje, nunca uno de cada dos.
    ejeDeCategorias(dias, { x: PL, ancho: iw, y: PT + ih + 18, centradoEnSlot: true, todas: true }) +
    "</svg>"
  );
}
