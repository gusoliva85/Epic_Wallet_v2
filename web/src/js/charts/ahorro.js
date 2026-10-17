/* Gráfico de evolución del ahorro acumulado · F06-T07
   Referencia: 01_Documento_General.md §54 (Gráfico 4) · 02_Documento_Tecnico.md §9.1, §14.3

   Línea con área de relleno del saldo acumulado real, un punto por
   mes — mismo estilo que la línea de ahorro del gráfico diario
   (F06-T02): degradé bajo la línea, único punto brillante con su
   etiqueta en el mes más reciente. El saldo puede cruzar a negativo
   (se gastó más de lo que había acumulado); `ejeConCero` es lo que
   permite dibujarlo así en vez de clavarlo en cero.

   Pura: recibe la serie ya armada por el backend
   (`GET /api/months/savings-evolution`, del mes más viejo al más
   nuevo) y devuelve el string del `<svg>`. No suma nada —el backend ya
   entrega el saldo de cada mes— y no sabe dónde se va a escribir.

   El espacio entre un punto y el siguiente nunca se estira más allá
   del que tendría con un semestre (seis meses) cargado —pedido de
   Gustavo, 2026-10-17: con pocos meses la línea quedaba "muy
   separada"—, y la serie se alinea a la derecha: el mes más reciente
   siempre cae en el mismo lugar, y lo que falta cuando hay menos de
   seis es margen vacío a la izquierda, no distancia entre puntos. Con
   seis meses o más vuelve a repartirse en todo el ancho, como antes. */

import { toNum, fmtK } from "../format.js";
import { ejeConCero, etiquetaSvg, grilla, ejeDeCategorias, idUnico } from "./svg.js";
import { etiquetaDeMes } from "./seis.js";

const ANCHO = 760;
const ALTO = 262;
const PL = 52;
const PR = 16;
const PT = 18;
const PB = 28;

const MESES_DE_REFERENCIA = 6;

/**
 * @param {{year:number, month:number, balance:string}[]} serie del `GET /api/months/savings-evolution`
 */
export function dibujar(serie) {
  const iw = ANCHO - PL - PR;
  const ih = ALTO - PT - PB;
  const n = serie.length;
  const valores = serie.map((p) => toNum(p.balance));
  const eje = ejeConCero(valores, { y: PT, alto: ih });
  const y = eje.yDe;
  const slot = Math.min(iw / Math.max(1, n), iw / MESES_DE_REFERENCIA);
  const inicioX = PL + iw - slot * n;
  const x = (i) => inicioX + slot * i + slot / 2;

  let salida =
    etiquetaSvg(ANCHO, ALTO) +
    grilla({ x: PL, y: PT, ancho: iw, alto: ih, maximo: eje.ymax, minimo: eje.ymin });

  if (n > 0) {
    const idArea = idUnico("ae");
    const trazo = valores.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");

    salida +=
      "<defs>" +
      `<linearGradient id="${idArea}" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="var(--color-sav)" stop-opacity=".32"/>` +
      `<stop offset="1" stop-color="var(--color-sav)" stop-opacity="0"/>` +
      "</linearGradient></defs>";

    // Línea de cero punteada sólo si el saldo llegó a ser negativo:
    // con el piso en cero, repetiría el borde inferior sin decir nada
    // nuevo (mismo criterio que la línea del gráfico diario).
    if (eje.ymin < 0) {
      salida += `<line x1="${PL}" y1="${y(0).toFixed(1)}" x2="${(PL + iw).toFixed(1)}" y2="${y(0).toFixed(1)}" stroke="var(--color-ink-4)" stroke-width="1" stroke-dasharray="3 4" opacity=".6"/>`;
    }

    if (n > 1) {
      const base = (PT + ih).toFixed(1);
      const area = `${trazo} L${x(n - 1).toFixed(1)} ${base} L${x(0).toFixed(1)} ${base} Z`;
      salida += `<path class="areafill" d="${area}" fill="url(#${idArea})"/>`;
    }
    salida += `<path class="lineseries" d="${trazo}" stroke="var(--color-sav)" stroke-width="2.7"/>`;

    // El punto y la etiqueta quedan en el mes más reciente, igual que
    // "hoy" en el gráfico diario: es el saldo que importa de un
    // vistazo, los anteriores ya están en la línea.
    const ultimo = valores[n - 1];
    salida +=
      `<circle class="areafill punto-brillante" cx="${x(n - 1).toFixed(1)}" cy="${y(ultimo).toFixed(1)}" r="4.6" fill="var(--color-sav)" stroke="var(--color-bg-1)" stroke-width="2"/>` +
      `<text class="axis-v" x="${(x(n - 1) - 7).toFixed(1)}" y="${(y(ultimo) - 13).toFixed(1)}" text-anchor="end" font-weight="700" fill="var(--color-sav)">${fmtK(ultimo)}</text>`;
  }

  salida += ejeDeCategorias(serie.map(etiquetaDeMes), {
    x: inicioX,
    ancho: slot * n,
    y: PT + ih + 18,
    centradoEnSlot: true,
  });
  salida += "</svg>";
  return salida;
}
