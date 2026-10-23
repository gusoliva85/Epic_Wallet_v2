/* Pruebas de la navegación por gestos (deslizar en el celular) · F12-T04
   Se corren con `npm test` (`node --test tests/js/*.test.mjs`).

   `resolverGesto` es una función pura (números adentro, un id de
   ruta o `null` afuera) y se prueba sin DOM. El resto —qué arranca el
   seguimiento de un toque, cuándo lo corta, cuándo llama a
   `navegar()`— se prueba con jsdom y `PointerEvent` de verdad:
   `pointerType` distingue dedo de mouse, y eso es justo lo que decide
   si el módulo tiene que mirar el gesto o ignorarlo del todo. */

import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..");

function rutaAbsoluta(...partes) {
  return `file:///${resolve(RAIZ, "web", "src", "js", ...partes).replace(/\\/g, "/")}`;
}

// ===================================================================
//  Oyentes de puntero · con jsdom
// ===================================================================

const ventanas = [];
after(() => {
  for (const v of ventanas) {
    try {
      v.close();
    } catch {
      /* ya cerrada */
    }
  }
});

async function cargarConDobles() {
  let codigo = readFileSync(resolve(RAIZ, "web", "src", "js", "gestos.js"), "utf8");
  codigo = codigo
    .replace(
      'import { SECCIONES } from "./nav.js";',
      `import { SECCIONES } from "${rutaAbsoluta("nav.js")}?t=${Math.random()}";`,
    )
    .replace(
      'import { navegar, rutaActual, EVENTO } from "./router.js";',
      "const EVENTO = \"epic:ruta\";\n" +
        "const navegar = (...a) => globalThis.__espia.navegar(...a);\n" +
        "const rutaActual = () => globalThis.__espia.rutaActual();",
    );

  const unico = `\n// ${Math.random()}\n`;
  const url = `data:text/javascript;base64,${Buffer.from(codigo + unico, "utf8").toString("base64")}`;
  return import(url);
}

const HTML = `<!doctype html><html><body>
  <div class="app">
    <section id="libre">contenido comun</section>
    <div class="tbl-wrap"><table><tr><td id="celda">1</td></tr></table></div>
    <div class="chart-wrap"><svg id="svg-grafico"></svg></div>
    <input id="campo" type="text">
  </div>
</body></html>`;

/**
 * @param {object} opciones
 * @param {boolean} [opciones.movil] lo que devuelve `matchMedia(...).matches`
 * @param {string|null} [opciones.rutaInicial]
 */
function montar({ movil = true, rutaInicial = "inicio" } = {}) {
  const dom = new JSDOM(HTML, { pretendToBeVisual: true });
  ventanas.push(dom.window);
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.PointerEvent = dom.window.PointerEvent;
  dom.window.matchMedia = () => ({ matches: movil });

  const llamadas = { navegar: [] };
  globalThis.__espia = {
    navegar: (id) => llamadas.navegar.push(id),
    rutaActual: () => rutaInicial,
  };
  return { dom, llamadas };
}

// ===================================================================
//  resolverGesto · función pura, sin DOM
//
//  Se saca del mismo cargador con dobles —no de un `import` directo
//  del archivo real— porque `gestos.js` importa `router.js` al tope,
//  y éste lee `location` al arrancar: sin una ventana jsdom montada
//  antes, ese `import` solo ya revienta. El resto de esta sección no
//  usa DOM para nada, es sólo la función.
// ===================================================================

montar();
const { resolverGesto } = await cargarConDobles();

describe("resolverGesto", () => {
  test("un deslizo largo hacia la izquierda avanza a la vista siguiente", () => {
    assert.equal(resolverGesto({ dx: -120, dy: 2, actual: "inicio" }), "movimientos");
  });

  test("hacia la derecha retrocede", () => {
    assert.equal(resolverGesto({ dx: 120, dy: 2, actual: "historial" }), "movimientos");
  });

  test("en la primera vista, hacia la derecha no hace nada (tope)", () => {
    assert.equal(resolverGesto({ dx: 120, dy: 0, actual: "inicio" }), null);
  });

  test("en la última vista, hacia la izquierda no hace nada (tope)", () => {
    assert.equal(resolverGesto({ dx: -120, dy: 0, actual: "config" }), null);
  });

  test("un recorrido corto no cuenta, aunque sea bien horizontal", () => {
    assert.equal(resolverGesto({ dx: -30, dy: 0, actual: "inicio" }), null);
  });

  test("un recorrido mayormente vertical no cuenta, aunque sea largo", () => {
    assert.equal(resolverGesto({ dx: -80, dy: 140, actual: "inicio" }), null);
  });

  test("una ruta que no es ninguna de las seis vistas no hace nada", () => {
    assert.equal(resolverGesto({ dx: -120, dy: 0, actual: "login" }), null);
  });
});

function pulso(dom, tipo, { x, y, id = 1, tipoPuntero = "touch" }) {
  return new dom.window.PointerEvent(tipo, {
    clientX: x,
    clientY: y,
    pointerId: id,
    pointerType: tipoPuntero,
    bubbles: true,
    cancelable: true,
  });
}

function deslizar(dom, elemento, { x0, y0, x1, y1, tipoPuntero = "touch" }) {
  elemento.dispatchEvent(pulso(dom, "pointerdown", { x: x0, y: y0, tipoPuntero }));
  elemento.dispatchEvent(pulso(dom, "pointermove", { x: x1, y: y1, tipoPuntero }));
  elemento.dispatchEvent(pulso(dom, "pointerup", { x: x1, y: y1, tipoPuntero }));
}

describe("en el celular", () => {
  test("un deslizo largo a la izquierda sobre contenido común navega a la vista siguiente", async () => {
    const { dom, llamadas } = montar({ movil: true, rutaInicial: "inicio" });
    await cargarConDobles();

    deslizar(dom, dom.window.document.getElementById("libre"), { x0: 300, y0: 200, x1: 150, y1: 205 });

    assert.deepEqual(llamadas.navegar, ["movimientos"]);
  });

  test("con el dedo (mouse), no pasa nada — no es un gesto de teléfono", async () => {
    const { dom, llamadas } = montar({ movil: true, rutaInicial: "inicio" });
    await cargarConDobles();

    deslizar(dom, dom.window.document.getElementById("libre"), {
      x0: 300,
      y0: 200,
      x1: 150,
      y1: 205,
      tipoPuntero: "mouse",
    });

    assert.deepEqual(llamadas.navegar, []);
  });

  test("arrancando adentro de una tabla, no se sigue el gesto: manda el scroll horizontal propio", async () => {
    const { dom, llamadas } = montar({ movil: true, rutaInicial: "inicio" });
    await cargarConDobles();

    deslizar(dom, dom.window.document.getElementById("celda"), { x0: 300, y0: 200, x1: 150, y1: 205 });

    assert.deepEqual(llamadas.navegar, []);
  });

  test("arrancando adentro de un gráfico angosto, tampoco", async () => {
    const { dom, llamadas } = montar({ movil: true, rutaInicial: "inicio" });
    await cargarConDobles();

    deslizar(dom, dom.window.document.getElementById("svg-grafico"), { x0: 300, y0: 200, x1: 150, y1: 205 });

    assert.deepEqual(llamadas.navegar, []);
  });

  test("arrancando en un campo de texto, tampoco", async () => {
    const { dom, llamadas } = montar({ movil: true, rutaInicial: "inicio" });
    await cargarConDobles();

    deslizar(dom, dom.window.document.getElementById("campo"), { x0: 300, y0: 200, x1: 150, y1: 205 });

    assert.deepEqual(llamadas.navegar, []);
  });

  test("con una hoja abierta (.app inert), no se sigue el gesto", async () => {
    const { dom, llamadas } = montar({ movil: true, rutaInicial: "inicio" });
    dom.window.document.querySelector(".app").setAttribute("inert", "");
    await cargarConDobles();

    deslizar(dom, dom.window.document.getElementById("libre"), { x0: 300, y0: 200, x1: 150, y1: 205 });

    assert.deepEqual(llamadas.navegar, []);
  });
});

describe("en escritorio", () => {
  test("el mismo deslizo no navega — es sólo para el celular", async () => {
    const { dom, llamadas } = montar({ movil: false, rutaInicial: "inicio" });
    await cargarConDobles();

    deslizar(dom, dom.window.document.getElementById("libre"), { x0: 300, y0: 200, x1: 150, y1: 205 });

    assert.deepEqual(llamadas.navegar, []);
  });
});
