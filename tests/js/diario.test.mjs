/* Pruebas de la lectura táctil del gráfico diario · F06-T09
   Referencia: 02_Documento_Tecnico.md §13.7, §14.3

   `dibujar()` ya está cubierta indirectamente por
   `tests/js/dashboard.test.mjs`; acá sólo lo nuevo de esta tarea: la
   geometría pura (`geometriaDeDias`), el texto que le corresponde a
   cada día (`contenidoDeLectura`) y el cableado del gesto
   (`conectarLectura`).

   El criterio de aceptación es "en el celular se puede leer el valor
   de un día con el dedo" — lo que puede fallar en silencio y la
   pantalla no avisa es justo la geometría: un día de más o de menos
   en la conversión de una coordenada X muestra el valor del día
   EQUIVOCADO, y nada en la pantalla lo delata. */

import { test, describe, mock } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { geometriaDeDias, contenidoDeLectura, conectarLectura } from "../../web/src/js/charts/diario.js";

// 350ms/10px, los mismos valores que RETARDO_MANTENER/UMBRAL_MOVIMIENTO
// en charts/diario.js — no se exportan (son detalle de implementación),
// así que acá se repiten a propósito: si algún día cambian ahí sin
// querer, una prueba que siga esperando los viejos lo nota.
const RETARDO_MANTENER = 350;
const UMBRAL_MOVIMIENTO = 10;

function daily({ dias = 5 } = {}) {
  return {
    days: dias,
    income: Array.from({ length: dias }, (_, i) => (i === 0 ? "500000.00" : "0.00")),
    expense: Array.from({ length: dias }, (_, i) => (i === 2 ? "20000.00" : "10000.00")),
    saving_cumulative: Array.from({ length: dias }, (_, i) => String(500000 - i * 10000)),
  };
}

describe("geometriaDeDias", () => {
  test("x(i) ubica el día i al medio de su franja, de izquierda a derecha", () => {
    const geo = geometriaDeDias(4, "ambos");
    const xs = [0, 1, 2, 3].map(geo.x);
    assert.ok(xs[0] < xs[1] && xs[1] < xs[2] && xs[2] < xs[3], "los días tienen que ir en orden");
  });

  test("indiceDesdeX es la inversa de x(i): tocar el centro de un día da ESE día", () => {
    const geo = geometriaDeDias(10, "ambos");
    for (let i = 0; i < 10; i++) {
      assert.equal(geo.indiceDesdeX(geo.x(i)), i, `falló para el día ${i}`);
    }
  });

  test("una X antes del primer día o después del último se clava en los extremos, no rompe", () => {
    const geo = geometriaDeDias(5, "ambos");
    assert.equal(geo.indiceDesdeX(-1000), 0);
    assert.equal(geo.indiceDesdeX(1e6), 4);
  });

  test("el modo 'ambos' deja menos ancho dibujable que 'egresos' — reserva el eje de la línea", () => {
    const conLinea = geometriaDeDias(10, "ambos");
    const sinLinea = geometriaDeDias(10, "egresos");
    // Con menos ancho dibujable, el mismo día 9 (el último) cae más a
    // la izquierda en "ambos" que en "egresos".
    assert.ok(conLinea.x(9) < sinLinea.x(9));
  });
});

describe("contenidoDeLectura", () => {
  test("modo 'ambos' trae día, ingreso, egreso y ahorro acumulado, en ese orden", () => {
    const lineas = contenidoDeLectura(daily(), "ambos", 2);
    assert.equal(lineas.length, 4);
    assert.match(lineas[0], /Día 03/);
    assert.match(lineas[1], /Ingreso/);
    assert.match(lineas[2], /Egreso/);
    assert.match(lineas[3], /Ahorro acum\./);
  });

  test("modo 'ingresos' no muestra egreso ni ahorro acumulado", () => {
    const lineas = contenidoDeLectura(daily(), "ingresos", 0);
    assert.equal(lineas.length, 2);
    assert.match(lineas[1], /Ingreso/);
    assert.doesNotMatch(lineas.join(" "), /Egreso|Ahorro/);
  });

  test("modo 'egresos' no muestra ingreso ni ahorro acumulado", () => {
    const lineas = contenidoDeLectura(daily(), "egresos", 0);
    assert.equal(lineas.length, 2);
    assert.match(lineas[1], /Egreso/);
    assert.doesNotMatch(lineas.join(" "), /Ingreso|Ahorro/);
  });

  test("el día que muestra es el pedido, no el primero ni el último por descuido", () => {
    const lineas = contenidoDeLectura(daily({ dias: 28 }), "ambos", 27);
    assert.match(lineas[0], /Día 28/);
  });
});

describe("conectarLectura", () => {
  function montarSvg() {
    const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { pretendToBeVisual: true });
    // jsdom no implementa getBBox ni mide layout de verdad: se lo
    // reemplaza por una caja fija, sólo para poder ejercitar el
    // cableado del gesto sin que explote por una API que no existe acá.
    dom.window.SVGElement.prototype.getBBox = () => ({ x: 10, y: 10, width: 80, height: 40 });
    dom.window.SVGElement.prototype.setPointerCapture = () => {};
    const svg = dom.window.document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 760 262");
    // getBoundingClientRect también da 0×0 en jsdom: se simula un
    // ancho real para poder convertir un clientX en una X del viewBox.
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 760, height: 262 });
    dom.window.document.body.append(svg);
    return { dom, svg };
  }

  function puntero(dom, tipo, extra) {
    return new dom.window.PointerEvent(tipo, { clientX: 0, clientY: 0, pointerId: 1, bubbles: true, ...extra });
  }

  test("no rompe con un día (mes recién empezado)", () => {
    const { svg } = montarSvg();
    assert.doesNotThrow(() => conectarLectura(svg, daily({ dias: 1 }), "ambos"));
  });

  test("tocar y mantener quieto (sin moverse) activa la lectura recién tras el retardo", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { dom, svg } = montarSvg();
    conectarLectura(svg, daily({ dias: 10 }), "ambos");
    const grupo = svg.querySelector(".lectura");
    const geo = geometriaDeDias(10, "ambos");
    const xUltimo = geo.x(9);

    svg.dispatchEvent(puntero(dom, "pointerdown", { clientX: xUltimo }));
    assert.equal(grupo.style.display, "none", "no aparece todavía: falta el retardo");

    t.mock.timers.tick(RETARDO_MANTENER - 1);
    assert.equal(grupo.style.display, "none", "un milisegundo antes, tampoco");

    t.mock.timers.tick(1);
    assert.equal(grupo.style.display, "", "cumplido el retardo, aparece");
    assert.match(svg.querySelector(".lectura-texto").textContent, /Día 10/);

    svg.dispatchEvent(puntero(dom, "pointerup"));
    assert.equal(grupo.style.display, "none", "se oculta al soltar");
  });

  test("moverse más del umbral antes del retardo se trata como scroll: nunca aparece", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { dom, svg } = montarSvg();
    conectarLectura(svg, daily({ dias: 10 }), "ambos");
    const grupo = svg.querySelector(".lectura");

    svg.dispatchEvent(puntero(dom, "pointerdown", { clientX: 0, clientY: 0 }));
    t.mock.timers.tick(RETARDO_MANTENER / 2);
    // Un desplazamiento horizontal franco, como el de un dedo
    // deslizando el gráfico al costado.
    svg.dispatchEvent(puntero(dom, "pointermove", { clientX: UMBRAL_MOVIMIENTO + 5, clientY: 0 }));
    t.mock.timers.tick(RETARDO_MANTENER); // de sobra para que el retardo original ya hubiera vencido

    assert.equal(grupo.style.display, "none", "un gesto que se movió de más nunca activa la lectura");
  });

  test("un temblor chico (menos del umbral) no cancela la espera", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { dom, svg } = montarSvg();
    conectarLectura(svg, daily({ dias: 10 }), "ambos");
    const grupo = svg.querySelector(".lectura");

    svg.dispatchEvent(puntero(dom, "pointerdown", { clientX: 0, clientY: 0 }));
    svg.dispatchEvent(puntero(dom, "pointermove", { clientX: UMBRAL_MOVIMIENTO - 2, clientY: 0 }));
    t.mock.timers.tick(RETARDO_MANTENER);

    assert.equal(grupo.style.display, "", "un movimiento chico sigue contando como mantener quieto");
  });

  test("soltar antes de que se cumpla el retardo cancela la espera (nunca llega a aparecer)", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { dom, svg } = montarSvg();
    conectarLectura(svg, daily({ dias: 10 }), "ambos");
    const grupo = svg.querySelector(".lectura");

    svg.dispatchEvent(puntero(dom, "pointerdown", { clientX: 0, clientY: 0 }));
    t.mock.timers.tick(RETARDO_MANTENER / 2);
    svg.dispatchEvent(puntero(dom, "pointerup"));
    t.mock.timers.tick(RETARDO_MANTENER);

    assert.equal(grupo.style.display, "none", "soltar antes de tiempo no deja la lectura pendiente");
  });

  test("una vez activada, arrastrar sin soltar actualiza el día a medida que se mueve", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { dom, svg } = montarSvg();
    conectarLectura(svg, daily({ dias: 10 }), "ambos");
    const geo = geometriaDeDias(10, "ambos");

    svg.dispatchEvent(puntero(dom, "pointerdown", { clientX: geo.x(0), clientY: 0 }));
    t.mock.timers.tick(RETARDO_MANTENER);
    assert.match(svg.querySelector(".lectura-texto").textContent, /Día 01/);

    svg.dispatchEvent(puntero(dom, "pointermove", { clientX: geo.x(5), clientY: 0 }));
    assert.match(svg.querySelector(".lectura-texto").textContent, /Día 06/);
  });

  test("arrastrar sin haber tocado antes (pointermove suelto) no muestra nada", () => {
    const { dom, svg } = montarSvg();
    conectarLectura(svg, daily({ dias: 10 }), "ambos");
    const grupo = svg.querySelector(".lectura");

    svg.dispatchEvent(puntero(dom, "pointermove", { clientX: 100 }));
    assert.equal(grupo.style.display, "none");
  });
});
