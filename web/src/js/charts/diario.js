/* Gráfico diario del mes · F06-T02
   Referencia: 02_Documento_Tecnico.md §14.1 · General §13 · skill §9

   Barras de ingresos y egresos por día (eje izquierdo) más la línea
   del ahorro acumulado del mes (eje derecho) — doble eje porque el
   gasto diario se mueve en decenas de miles y el ahorro acumulado en
   millones; con un solo eje la línea aplastaría las barras.

   Cuatro modos: "ambos" muestra las dos barras, "ingresos" y
   "egresos" sólo la suya, y "acumulado" las reemplaza por el área de
   ingresos y egresos acumulados del mes. Esos dos ya vienen sumados
   por el servidor (`daily.income_cumulative`/`expense_cumulative`,
   Técnico §9.2): acá nunca se acumula plata con `float`, sólo se
   dibuja lo que ya mandó la API. La línea de ahorro se mantiene
   visible en los cuatro modos — es lo que responde "cómo viene el mes
   hasta ahora", la pregunta que este gráfico existe para contestar.

   Pura: recibe `daily` (el mismo objeto de `GET /api/dashboard`) y el
   modo, devuelve el string del `<svg>`. No sabe de dónde salió el
   dato ni dónde se va a escribir — eso es trabajo de quien la llama
   (`dashboard.js`). Nunca se llama con un mes histórico: ahí
   `daily` es `null` (Regla 4) y no hay gráfico que dibujar. */

import { toNum, fmtK } from "../format.js";
import { escalaRedonda, alturaDeBarra, etiquetaSvg, grilla, ejeDeCategorias, idUnico } from "./svg.js";

const ANCHO = 760;
const ALTO = 262;
const PL = 52; // margen izquierdo: el eje de valores diarios
const PR = 58; // margen derecho: el eje del ahorro acumulado
const PT = 18;
const PB = 28;

export const MODOS = Object.freeze(["ambos", "egresos", "ingresos", "acumulado"]);

/** La línea de ahorro acumulado y su eje derecho. Se dibuja en los
 * cuatro modos, así que vive aparte de las barras y de las áreas. */
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

  return (
    lineaCero +
    `<path class="lineseries" d="${trazo}" stroke="var(--color-sav)" stroke-width="2.7"/>` +
    // El punto y la etiqueta quedan en el último día de la serie: hoy,
    // cuando se mira el mes actual. Es lo que distingue el día de hoy
    // en el gráfico (criterio de aceptación de la tarea).
    `<circle class="areafill" cx="${x(n - 1).toFixed(1)}" cy="${y(ultimo).toFixed(1)}" r="4.6" fill="var(--color-sav)" stroke="var(--color-bg-1)" stroke-width="2"/>` +
    `<text class="axis-v" x="${(x(n - 1) - 7).toFixed(1)}" y="${(y(ultimo) - 13).toFixed(1)}" text-anchor="end" font-weight="700" fill="var(--color-sav)">${fmtK(ultimo)}</text>` +
    ejeDerecho
  );
}

/** Barras de ingresos y/o egresos, según el modo. */
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
  const anchoBarra = Math.max(3, Math.min(13, slot * (modo === "ambos" ? 0.34 : 0.56)));

  const barra = (cx, valor, color, offset) => {
    if (!valor) return "";
    const alto = alturaDeBarra(valor, maximo, ih);
    return (
      `<rect class="bar" x="${(cx + offset - anchoBarra / 2).toFixed(1)}" y="${(PT + ih - alto).toFixed(1)}" ` +
      `width="${anchoBarra.toFixed(1)}" height="${alto.toFixed(1)}" rx="${Math.min(3.5, anchoBarra / 2.4).toFixed(1)}" fill="${color}"/>`
    );
  };

  let salida = "";
  for (let i = 0; i < n; i++) {
    const cx = PL + slot * i + slot / 2;
    if (modo === "ambos") {
      salida += barra(cx, ingresos[i], "var(--color-inc)", -anchoBarra / 2 - 1);
      salida += barra(cx, egresos[i], "var(--color-egr)", anchoBarra / 2 + 1);
    } else if (mostrarIngreso) {
      salida += barra(cx, ingresos[i], "var(--color-inc)", 0);
    } else {
      salida += barra(cx, egresos[i], "var(--color-egr)", 0);
    }
  }
  return { svg: salida, maximo };
}

/** Modo "Acumulado": área de ingresos y egresos acumulados del mes,
 * ya sumados por el servidor. */
function areasAcumuladas(daily, iw, ih) {
  const ingresos = daily.income_cumulative.map(toNum);
  const egresos = daily.expense_cumulative.map(toNum);
  const n = ingresos.length;
  const maximo = escalaRedonda(Math.max(...ingresos, ...egresos));
  const x = (i) => PL + (iw * i) / (n - 1 || 1);
  const y = (v) => PT + ih - (ih * v) / maximo;
  const linea = (serie) => serie.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = (serie) =>
    `${linea(serie)} L${x(n - 1).toFixed(1)} ${(PT + ih).toFixed(1)} L${PL} ${(PT + ih).toFixed(1)} Z`;

  const idIngreso = idUnico("di");
  const idEgreso = idUnico("de");

  return {
    maximo,
    svg:
      "<defs>" +
      `<linearGradient id="${idIngreso}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--color-inc)" stop-opacity=".3"/><stop offset="1" stop-color="var(--color-inc)" stop-opacity="0"/></linearGradient>` +
      `<linearGradient id="${idEgreso}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--color-egr)" stop-opacity=".3"/><stop offset="1" stop-color="var(--color-egr)" stop-opacity="0"/></linearGradient>` +
      "</defs>" +
      `<path class="areafill" d="${area(egresos)}" fill="url(#${idEgreso})"/>` +
      `<path class="areafill" d="${area(ingresos)}" fill="url(#${idIngreso})"/>` +
      `<path class="lineseries" d="${linea(egresos)}" stroke="var(--color-egr)"/>` +
      `<path class="lineseries" d="${linea(ingresos)}" stroke="var(--color-inc)"/>`,
  };
}

/**
 * El gráfico diario completo: barras (o áreas acumuladas, en el modo
 * "acumulado") más la línea de ahorro con su eje, y el eje de días
 * abajo.
 *
 * @param {object} daily el campo `daily` de `GET /api/dashboard`
 * @param {"ambos"|"egresos"|"ingresos"|"acumulado"} modo
 */
export function dibujar(daily, modo = "ambos") {
  const iw = ANCHO - PL - PR;
  const ih = ALTO - PT - PB;
  const dias = daily.income.map((_, i) => String(i + 1));
  const serieDeAhorro = daily.saving_cumulative.map(toNum);

  const cuerpo = modo === "acumulado" ? areasAcumuladas(daily, iw, ih) : barras(daily, iw, ih, modo);

  return (
    etiquetaSvg(ANCHO, ALTO) +
    grilla({ x: PL, y: PT, ancho: iw, alto: ih, maximo: cuerpo.maximo }) +
    cuerpo.svg +
    lineaDeAhorro(serieDeAhorro, iw, ih) +
    // En modo "acumulado" las áreas van de punta a punta (como una
    // línea), no centradas en una franja por día como las barras: el
    // eje tiene que usar la misma regla, o la etiqueta del día queda
    // corrida respecto de su propio punto en la curva.
    ejeDeCategorias(dias, { x: PL, ancho: iw, y: PT + ih + 18, centradoEnSlot: modo !== "acumulado" }) +
    "</svg>"
  );
}
