/* Gráfico diario del mes · F06-T02
   Referencia: 02_Documento_Tecnico.md §14.1 · General §13 · skill §9

   Barras de ingresos y egresos por día (eje izquierdo) más la línea
   del ahorro acumulado del mes (eje derecho) — doble eje porque el
   gasto diario se mueve en decenas de miles y el ahorro acumulado en
   millones; con un solo eje la línea aplastaría las barras.

   Tres modos: "ambos" muestra las dos barras, "ingresos" y "egresos"
   sólo la suya. La línea de ahorro —y su eje derecho— sólo se dibuja
   en "ambos" (F06-T02, última corrección): en "ingresos" o "egresos"
   el eje izquierdo ya cambia de escala para mostrar sólo esa serie, y
   el derecho se quedaba mostrando el ahorro de siempre, sin
   actualizarse — los dos lados dejaban de hablar de lo mismo. Más
   simple sacarla que tratar de explicarla ahí. Sin ese eje, el margen
   derecho también se achica (`PR_SIN_LINEA`): no tiene sentido
   reservarle espacio a un eje que no está. (Hubo un cuarto modo,
   "acumulado", que reemplazaba las barras por áreas acumuladas;
   Gustavo pidió sacarlo — F06-T02, corrección anterior.)

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
   `daily` es `null` (Regla 4) y no hay gráfico que dibujar.

   `conectarLectura` (F06-T09) es la excepción a "pura": tiene que
   tocar el DOM del `<svg>` que ya dibujó `dibujar()`, porque tocar y
   arrastrar tiene que mover una guía sin volver a armar el gráfico
   entero en cada movimiento — reconstruir el string completo en cada
   `pointermove` reiniciaría las animaciones de entrada de las barras y
   se vería mal. Quien llama conecta la lectura una vez por cada
   `<svg>` nuevo (`dashboard.js`, después de pintar el gráfico). */

import { toNum, fmtK } from "../format.js";
import {
  escalaRedonda,
  alturaDeBarra,
  trazoBarraRedondeada,
  etiquetaSvg,
  grilla,
  ejeDeCategorias,
  ejeConCero,
  idUnico,
} from "./svg.js";

const ANCHO = 760;
const ALTO = 262;
const PL = 52; // margen izquierdo: el eje de valores diarios
const PR_CON_LINEA = 58; // margen derecho: el eje del ahorro acumulado
const PR_SIN_LINEA = 16; // sin ese eje, alcanza con un respiro chico
const PT = 18;
const PB = 28;

export const MODOS = Object.freeze(["ambos", "egresos", "ingresos"]);

/** La línea de ahorro acumulado, su área de relleno y su eje derecho.
 * Sólo se llama en modo "ambos" (F06-T02, corrección): en "ingresos"
 * o "egresos" el eje izquierdo cambia de escala para esa serie sola,
 * y el derecho se quedaba mostrando el ahorro sin relación con lo que
 * se estaba mirando. */
function lineaDeAhorro(serie, iw, ih) {
  const n = serie.length;
  const eje = ejeConCero(serie, { y: PT, alto: ih });
  const y = eje.yDe;
  const x = (i) => PL + (iw * (i + 0.5)) / n;

  const trazo = serie.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const base = (PT + ih).toFixed(1);
  const area = `${trazo} L${x(n - 1).toFixed(1)} ${base} L${x(0).toFixed(1)} ${base} Z`;
  const ultimo = serie[n - 1];

  // Línea de cero punteada sólo si el ahorro llegó a ser negativo
  // (Técnico §14.1): con el piso en cero, dibujarla sería repetir el
  // borde inferior del gráfico sin decir nada nuevo.
  const lineaCero =
    eje.ymin < 0
      ? `<line x1="${PL}" y1="${y(0).toFixed(1)}" x2="${(PL + iw).toFixed(1)}" y2="${y(0).toFixed(1)}" stroke="var(--color-ink-4)" stroke-width="1" stroke-dasharray="3 4" opacity=".6"/>`
      : "";

  let ejeDerecho = "";
  for (let i = 0; i <= 4; i++) {
    const v = eje.ymin + (eje.rango * i) / 4;
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

/** El ancho dibujable según el modo: con línea de ahorro ("ambos")
 * reserva su eje derecho, sin ella alcanza con un respiro chico.
 * Una sola función para que `dibujar()` y `geometriaDeDias()` —la
 * lectura táctil, F06-T09— nunca puedan desalinearse entre sí. */
function anchoDibujable(modo) {
  return ANCHO - PL - (modo === "ambos" ? PR_CON_LINEA : PR_SIN_LINEA);
}

/**
 * El gráfico diario completo: barras más, sólo en "ambos", la línea
 * de ahorro con su eje; y el eje de días abajo.
 *
 * @param {object} daily el campo `daily` de `GET /api/dashboard`
 * @param {"ambos"|"egresos"|"ingresos"} modo
 */
export function dibujar(daily, modo = "ambos") {
  const mostrarLinea = modo === "ambos";
  const iw = anchoDibujable(modo);
  const ih = ALTO - PT - PB;
  const dias = daily.income.map((_, i) => String(i + 1));

  const cuerpo = barras(daily, iw, ih, modo);
  const linea = mostrarLinea ? lineaDeAhorro(daily.saving_cumulative.map(toNum), iw, ih) : "";

  return (
    etiquetaSvg(ANCHO, ALTO) +
    grilla({ x: PL, y: PT, ancho: iw, alto: ih, maximo: cuerpo.maximo }) +
    cuerpo.svg +
    linea +
    // `todas: true` (Gustavo, F06-T02): quiere ver cada día del mes
    // en el eje, nunca uno de cada dos.
    ejeDeCategorias(dias, { x: PL, ancho: iw, y: PT + ih + 18, centradoEnSlot: true, todas: true }) +
    "</svg>"
  );
}

// ===================================================================
//  Lectura táctil · F06-T09
//
//  Mantener el dedo quieto sobre el gráfico muestra el valor exacto
//  del día debajo: una línea guía más una etiqueta arriba, centrada en
//  el día tocado (no en un punto fijo del gráfico — segunda
//  corrección, F06-T09: con el `.chart-wrap` scrolleado hacia los
//  últimos días del mes, una etiqueta pegada al borde izquierdo del
//  `<svg>` entero quedaba fuera de lo que se ve. Centrada en el toque
//  está siempre a la vista, porque el dedo nunca puede estar en una
//  parte del gráfico que no se ve). Se mide con `getBBox()` y se
//  corrige sólo si se sale por un borde del `viewBox`.
//
//  Primera versión de esta tarea dejaba que CUALQUIER arrastre, desde
//  el primer píxel, activara la lectura — con `touch-action: pan-y`
//  para que ganara el gesto horizontal. Gustavo la probó y pidió
//  arreglarla: así tapaba el scroll lateral del `.chart-wrap` en
//  pantallas angostas, que antes de esta tarea funcionaba (primera
//  corrección, F06-T09). Ahora se distingue la intención con un
//  pequeño retardo:
//
//    el dedo se queda quieto RETARDO_MANTENER ms  → se activa la
//      lectura (toque sostenido)
//    el dedo se mueve más de UMBRAL_MOVIMIENTO px
//      antes de que se cumpla ese tiempo            → se cancela, el
//      navegador recibe el gesto entero y scrollea como siempre
//      (nunca se llama `preventDefault`ni `setPointerCapture` en ese
//      caso, así que no hay nada que "devolverle" al navegador)
//
//  `touch-action` queda en su valor por defecto a propósito: restringirlo
//  de entrada es lo que le sacaba el scroll al navegador sin que este
//  código llegara siquiera a decidir nada.
// ===================================================================

const RETARDO_MANTENER = 350; // ms para distinguir "mantener" de "scrollear"
const UMBRAL_MOVIMIENTO = 10; // px de tolerancia antes de esos 350ms

/**
 * La geometría que necesita la lectura táctil para ubicar un toque:
 * la posición X de cada día (misma cuenta que usa `barras()`) y la
 * conversión inversa, de una X del `<svg>` al día más cercano.
 *
 * Separada de `dibujar()` a propósito: la una dibuja, la otra ubica,
 * y las dos comparten `anchoDibujable()` para no poder desalinearse.
 *
 * @param {number} n cantidad de días (`daily.income.length`)
 * @param {"ambos"|"egresos"|"ingresos"} modo
 */
export function geometriaDeDias(n, modo = "ambos") {
  const iw = anchoDibujable(modo);
  const slot = iw / n;
  return {
    PL,
    PT,
    alto: ALTO - PT - PB,
    ancho: ANCHO,
    x: (i) => PL + slot * i + slot / 2,
    indiceDesdeX: (xSvg) => Math.min(n - 1, Math.max(0, Math.floor((xSvg - PL) / slot))),
  };
}

/**
 * Las líneas de texto que le corresponden al día `i` en el modo
 * dado — pura, nada de DOM: lo que la etiqueta de la lectura táctil
 * tiene que mostrar, en el mismo orden en que se dibujan sus barras.
 *
 * @param {object} daily
 * @param {"ambos"|"egresos"|"ingresos"} modo
 * @param {number} i
 */
export function contenidoDeLectura(daily, modo, i) {
  const lineas = [`Día ${String(i + 1).padStart(2, "0")}`];
  if (modo !== "egresos") lineas.push(`Ingreso ${fmtK(daily.income[i])}`);
  if (modo !== "ingresos") lineas.push(`Egreso ${fmtK(daily.expense[i])}`);
  if (modo === "ambos") lineas.push(`Ahorro acum. ${fmtK(daily.saving_cumulative[i])}`);
  return lineas;
}

const NS_SVG = "http://www.w3.org/2000/svg";
const PAD_ETIQUETA = 7;

/**
 * Conecta la lectura táctil sobre un `<svg>` ya dibujado por
 * `dibujar()`. Se llama una vez por cada vez que el gráfico se vuelve
 * a dibujar (cambia el mes, el modo, se reintenta tras un error):
 * el `<svg>` es nuevo cada vez, así que no hay nada que desconectar
 * de uno anterior.
 *
 * @param {SVGSVGElement} svg
 * @param {object} daily
 * @param {"ambos"|"egresos"|"ingresos"} modo
 */
export function conectarLectura(svg, daily, modo = "ambos") {
  const n = daily.income.length;
  if (!svg || n === 0) return;
  const geo = geometriaDeDias(n, modo);
  // El documento del propio `svg` y no el `document` global: así
  // funciona igual si alguna vez el gráfico vive en otro documento
  // (una prueba con su propio DOM, por ejemplo) y no depende de un
  // global implícito.
  const doc = svg.ownerDocument;

  const grupo = doc.createElementNS(NS_SVG, "g");
  grupo.setAttribute("class", "lectura");
  grupo.setAttribute("aria-hidden", "true");
  grupo.style.display = "none";

  const guia = doc.createElementNS(NS_SVG, "line");
  guia.setAttribute("class", "lectura-guia");
  guia.setAttribute("y1", String(geo.PT));
  guia.setAttribute("y2", String(geo.PT + geo.alto));

  const fondo = doc.createElementNS(NS_SVG, "rect");
  fondo.setAttribute("class", "lectura-fondo");
  fondo.setAttribute("rx", "7");

  const texto = doc.createElementNS(NS_SVG, "text");
  texto.setAttribute("class", "lectura-texto");
  texto.setAttribute("text-anchor", "middle");

  grupo.append(guia, fondo, texto);
  svg.appendChild(grupo);

  function mostrarEn(clientX) {
    const r = svg.getBoundingClientRect();
    if (!r.width) return;
    // `preserveAspectRatio="none"` escala ancho y alto de forma
    // independiente y lineal: una simple regla de tres contra el
    // `viewBox` basta, sin pasar por `getScreenCTM()`. `r.left` ya
    // viene corrido si el `.chart-wrap` está scrolleado, así que esta
    // cuenta da el día correcto sin importar cuánto se haya scrolleado
    // — lo que fallaba (Gustavo, F06-T09, segunda corrección) no era
    // esto, era que la ETIQUETA se dibujaba siempre pegada al borde
    // izquierdo del gráfico entero, y ese borde queda fuera de vista
    // apenas se scrollea hacia los últimos días del mes.
    const xSvg = geo.ancho * ((clientX - r.left) / r.width);
    const i = geo.indiceDesdeX(xSvg);
    const cx = geo.x(i);

    guia.setAttribute("x1", cx.toFixed(1));
    guia.setAttribute("x2", cx.toFixed(1));

    // Arranca centrada en el día tocado —ahí, por definición, está a
    // la vista: es donde está el dedo— y no en un punto fijo del
    // gráfico. Se mide y se corrige después si se sale por algún
    // borde (el `viewBox` entero, no el recorte visible del
    // `.chart-wrap`: con el margen que deja `PAD_ETIQUETA` alcanza,
    // porque el dedo nunca puede estar fuera de lo que se ve).
    texto.setAttribute("x", cx.toFixed(1));
    texto.replaceChildren(
      ...contenidoDeLectura(daily, modo, i).map((linea, k) => {
        const tspan = doc.createElementNS(NS_SVG, "tspan");
        tspan.setAttribute("x", cx.toFixed(1));
        tspan.setAttribute("dy", k === 0 ? "0" : "13");
        tspan.textContent = linea;
        return tspan;
      }),
    );

    grupo.style.display = "";
    texto.setAttribute("y", String(geo.PT + 11));

    // El fondo se mide después de poner el texto: su ancho depende
    // de cuál día quedó, "Día 09" no mide lo mismo que "Día 28". Si
    // la caja medida se sale por la izquierda o la derecha del
    // `viewBox`, se corrige corriendo texto y guiones el desvío
    // justo — la línea guía se queda donde está (sigue marcando el
    // día de verdad), sólo se mueve la etiqueta.
    //
    // El margen es `PAD_ETIQUETA` y no un número aparte: el fondo
    // dibuja `PAD_ETIQUETA` px más allá de la caja del texto de cada
    // lado (más abajo), así que recortar el texto a ese mismo margen
    // es lo que deja el FONDO —no sólo el texto— dentro del `viewBox`.
    // Con un margen más chico el texto quedaba adentro pero el fondo
    // se seguía saliendo unos píxeles.
    let caja = texto.getBBox();
    let corrimiento = 0;
    if (caja.x < PAD_ETIQUETA) corrimiento = PAD_ETIQUETA - caja.x;
    else if (caja.x + caja.width > geo.ancho - PAD_ETIQUETA)
      corrimiento = geo.ancho - PAD_ETIQUETA - (caja.x + caja.width);
    if (corrimiento !== 0) {
      const xCorregida = (cx + corrimiento).toFixed(1);
      texto.setAttribute("x", xCorregida);
      for (const tspan of texto.children) tspan.setAttribute("x", xCorregida);
      caja = texto.getBBox();
    }

    fondo.setAttribute("x", (caja.x - PAD_ETIQUETA).toFixed(1));
    fondo.setAttribute("y", (caja.y - PAD_ETIQUETA).toFixed(1));
    fondo.setAttribute("width", (caja.width + PAD_ETIQUETA * 2).toFixed(1));
    fondo.setAttribute("height", (caja.height + PAD_ETIQUETA * 2).toFixed(1));
  }

  function ocultar() {
    grupo.style.display = "none";
  }

  let activo = false;
  let temporizador = null;
  let inicio = null;

  function cancelarEspera() {
    if (temporizador != null) {
      clearTimeout(temporizador);
      temporizador = null;
    }
  }

  function activar(ev) {
    activo = true;
    // Recién acá, con el toque sostenido ya confirmado: capturar el
    // puntero y frenar el default es lo que mantiene la lectura
    // funcionando aunque el dedo se mueva después (para "arrastrar y
    // leer" una vez activada), sin afectar al scroll de un gesto que
    // ya se descartó como sostenido.
    svg.setPointerCapture(ev.pointerId);
    ev.preventDefault();
    mostrarEn(ev.clientX);
  }

  svg.addEventListener("pointerdown", (ev) => {
    inicio = { x: ev.clientX, y: ev.clientY };
    cancelarEspera();
    temporizador = setTimeout(() => {
      temporizador = null;
      activar(ev);
    }, RETARDO_MANTENER);
  });

  svg.addEventListener("pointermove", (ev) => {
    if (activo) {
      ev.preventDefault();
      mostrarEn(ev.clientX);
      return;
    }
    if (temporizador != null && inicio) {
      const distancia = Math.hypot(ev.clientX - inicio.x, ev.clientY - inicio.y);
      if (distancia > UMBRAL_MOVIMIENTO) {
        // Se movió antes de cumplirse la espera: es un scroll, no un
        // toque sostenido. Nunca se llamó `preventDefault` ni
        // `setPointerCapture`, así que el navegador ya venía
        // procesando el gesto solo y sigue sin que esto lo toque.
        cancelarEspera();
      }
    }
  });

  function soltar() {
    cancelarEspera();
    if (activo) {
      activo = false;
      ocultar();
    }
  }

  svg.addEventListener("pointerup", soltar);
  svg.addEventListener("pointercancel", soltar);
}
