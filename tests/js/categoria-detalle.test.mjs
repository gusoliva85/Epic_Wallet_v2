/* Pruebas de la hoja de detalle de categoría · F07-T05
   Se corren con `npm test` (`node --test tests/js/*.test.mjs`).

   Mismo técnica que `movimientos.test.mjs`/`alta-movimiento.test.mjs`:
   el HTML de la hoja sale del `index.html` real; se doblan `api` (get),
   `EVENTO_CAMBIO` y `abrirEdicion` (de `alta-movimiento.js`, para no
   cargar ese módulo entero acá); `format.js`, `components/rows.js`,
   `components/estados.js` y `components/sheet.js` se importan reales
   —`crearHoja` con `?t=` para no compartir su estado entre archivos de
   prueba, mismo motivo que ya usan `alta-movimiento.test.mjs` y
   `config-categorias.test.mjs`.

   Los tres criterios de aceptación de la tarea, cada uno con su
   prueba: se llega tocando una fila de `#categorias-inicio` (el panel,
   que es también "el gráfico" — no hay un SVG aparte para categorías),
   tocar un movimiento abre la edición con ESE movimiento (lo que pasa
   después —que `abrirEdicion` actualice el desglose— ya está probado
   en `alta-movimiento.test.mjs`), y un mes histórico explica por qué
   no hay lista sin dejar de mostrar el total real. */

import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..");
const INDEX = resolve(RAIZ, "web", "index.html");

function rutaAbsoluta(...partes) {
  return `file:///${resolve(RAIZ, "web", "src", "js", ...partes).replace(/\\/g, "/")}`;
}

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

/** La hoja de detalle, recortada del `index.html` que se publica. */
function htmlDeLaHoja() {
  const html = readFileSync(INDEX, "utf8");
  const ancla = html.indexOf('id="hoja-detalle"');
  assert.notEqual(ancla, -1, "no se encuentra #hoja-detalle en index.html");
  const desde = html.lastIndexOf("<aside", ancla);
  const hasta = html.indexOf("</aside>", ancla) + "</aside>".length;
  return html.slice(desde, hasta);
}

async function cargarConDobles() {
  let codigo = readFileSync(resolve(RAIZ, "web", "src", "js", "categoria-detalle.js"), "utf8");
  codigo = codigo
    .replace(
      'import { api } from "./api.js";',
      "const api = { get: (...a) => globalThis.__espia.apiGet(...a) };",
    )
    .replace(
      'import { esc, fmt } from "./format.js";',
      `import { esc, fmt } from "${rutaAbsoluta("format.js")}";`,
    )
    .replace(
      'import { filaMovimiento, pintarFilas } from "./components/rows.js";',
      `import { filaMovimiento, pintarFilas } from "${rutaAbsoluta("components", "rows.js")}";`,
    )
    .replace(
      'import { bloqueCargando, error as estadoError, vacio, consolidado } from "./components/estados.js";',
      `import { bloqueCargando, error as estadoError, vacio, consolidado } from "${rutaAbsoluta("components", "estados.js")}";`,
    )
    .replace(
      'import { crearHoja } from "./components/sheet.js";',
      `import { crearHoja } from "${rutaAbsoluta("components", "sheet.js")}?t=${Math.random()}";`,
    )
    .replace(
      'import { EVENTO_CAMBIO } from "./barra-mes.js";',
      'const EVENTO_CAMBIO = "mes:cambiado";',
    )
    .replace(
      'import { abrirEdicion } from "./alta-movimiento.js";',
      "const abrirEdicion = (...a) => globalThis.__espia.abrirEdicion(...a);",
    );

  const unico = `\n// ${Math.random()}\n`;
  const url = `data:text/javascript;base64,${Buffer.from(codigo + unico, "utf8").toString("base64")}`;
  return import(url);
}

const MES_ABIERTO = { year: 2026, month: 10, status: "open" };
const MES_HISTORICO = { year: 2026, month: 9, status: "historical" };

function detalleBase() {
  return {
    category_id: 2,
    name: "Gas",
    type: "expense",
    total: "25000.00",
    last_date: "2026-10-20",
    transactions: [
      {
        id: 91,
        month_id: 7,
        category_id: 2,
        transaction_date: "2026-10-20",
        transaction_type: "expense",
        amount: "15000.00",
        description: "Gas 2",
        source: "manual",
      },
      {
        id: 90,
        month_id: 7,
        category_id: 2,
        transaction_date: "2026-10-03",
        transaction_type: "expense",
        amount: "10000.00",
        description: "",
        source: "manual",
      },
    ],
  };
}

/** Una fila de `#categorias-inicio` mínima: lo único que
 * `categoria-detalle.js` mira es `data-categoria` y `.row-main b`. */
function filaDeCategoria(id, nombre) {
  return (
    `<button class="row cg" type="button" data-categoria="${id}">` +
    `<span class="row-main"><b>${nombre}</b></span>` +
    "</button>"
  );
}

async function montar({ apiGet } = {}) {
  const dom = new JSDOM(
    `<!doctype html><html><body>` +
      `<div class="rows" id="categorias-inicio">` +
      filaDeCategoria(2, "Gas") +
      filaDeCategoria(1, "Alquiler") +
      "</div>" +
      htmlDeLaHoja() +
      `<div class="fondo-hoja" id="fondo-hoja"></div>` +
      "</body></html>",
    { url: "https://epic-wallet-v2.vercel.app/#/inicio", pretendToBeVisual: true },
  );
  ventanas.push(dom.window);

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.CustomEvent = dom.window.CustomEvent;

  const llamadas = { apiGet: [], abrirEdicion: [] };
  globalThis.__espia = {
    apiGet: async (...a) => {
      llamadas.apiGet.push(a);
      return (apiGet ?? (async () => detalleBase()))(...a);
    },
    abrirEdicion: (...a) => {
      llamadas.abrirEdicion.push(a);
    },
  };

  await cargarConDobles();
  const $$ = (id) => dom.window.document.getElementById(id);
  return {
    dom,
    llamadas,
    categorias: $$("categorias-inicio"),
    hoja: $$("hoja-detalle"),
    titulo: $$("hoja-detalle-titulo"),
    resumen: $$("categoria-detalle-resumen"),
    lista: $$("categoria-detalle-lista"),
  };
}

const esperar = (ms = 10) => new Promise((listo) => setTimeout(listo, ms));

function cambiarMes(dom, periodo) {
  dom.window.document.dispatchEvent(new dom.window.CustomEvent("mes:cambiado", { detail: periodo }));
}

describe("se llega desde el panel de categorías", () => {
  test("tocar una fila abre la hoja con el nombre y pide el detalle de esa categoría", async () => {
    const { dom, categorias, hoja, titulo, llamadas } = await montar();
    cambiarMes(dom, MES_ABIERTO);
    await esperar();

    categorias.querySelector('[data-categoria="2"]').click();
    await esperar();

    assert.ok(hoja.classList.contains("abierta"), "la hoja tiene que quedar abierta");
    assert.equal(titulo.textContent, "Gas");
    assert.equal(llamadas.apiGet.length, 1);
    assert.equal(llamadas.apiGet[0][0], "/categories/2/detail?year=2026&month=10");
  });

  test("tocar otra fila pide el detalle de ESA categoría, no la anterior", async () => {
    const { dom, categorias, titulo, llamadas } = await montar();
    cambiarMes(dom, MES_ABIERTO);
    await esperar();

    categorias.querySelector('[data-categoria="1"]').click();
    await esperar();

    assert.equal(titulo.textContent, "Alquiler");
    assert.equal(llamadas.apiGet[0][0], "/categories/1/detail?year=2026&month=10");
  });
});

describe("un mes abierto", () => {
  test("muestra el total, la última carga y los movimientos, del más nuevo al más viejo", async () => {
    const { dom, categorias, resumen, lista } = await montar();
    cambiarMes(dom, MES_ABIERTO);
    await esperar();

    categorias.querySelector('[data-categoria="2"]').click();
    await esperar();

    assert.match(resumen.textContent, /Total del mes/);
    assert.match(resumen.textContent, /\$25\.000/);
    assert.match(resumen.textContent, /Última carga/);
    assert.match(resumen.textContent, /20\/10\/2026/);

    const filas = [...lista.querySelectorAll(".row")];
    assert.equal(filas.length, 2);
    assert.ok(filas[0].textContent.includes("Gas 2"), "el más nuevo va primero");
    assert.ok(filas[1].textContent.includes("03/10/2026"), "sin descripción, se ve la fecha igual");
  });

  test("una categoría sin movimientos ese mes muestra el estado vacío, no una lista en blanco", async () => {
    const { dom, categorias, lista } = await montar({
      apiGet: async () => ({ ...detalleBase(), total: "0.00", last_date: null, transactions: [] }),
    });
    cambiarMes(dom, MES_ABIERTO);
    await esperar();

    categorias.querySelector('[data-categoria="2"]').click();
    await esperar();

    assert.equal(lista.querySelectorAll(".row").length, 0);
    assert.match(lista.textContent, /sin movimientos/i);
  });
});

describe("un mes histórico", () => {
  test("el total sigue siendo real, pero explica por qué no hay lista (Regla 4)", async () => {
    const { dom, categorias, resumen, lista } = await montar({
      apiGet: async () => ({
        category_id: 2,
        name: "Gas",
        type: "expense",
        total: "45000.00",
        last_date: null,
        transactions: null,
      }),
    });
    cambiarMes(dom, MES_HISTORICO);
    await esperar();

    categorias.querySelector('[data-categoria="2"]').click();
    await esperar();

    assert.match(resumen.textContent, /\$45\.000/, "el total real no desaparece");
    assert.match(lista.textContent, /consolidad/i);
    assert.equal(lista.querySelectorAll(".row").length, 0, "nunca se inventan movimientos");
  });
});

describe("editar un movimiento desde el detalle", () => {
  test("tocar un movimiento cierra esta hoja y abre la edición con ESE movimiento", async () => {
    const { dom, categorias, hoja, lista, llamadas } = await montar();
    cambiarMes(dom, MES_ABIERTO);
    await esperar();

    categorias.querySelector('[data-categoria="2"]').click();
    await esperar();

    lista.querySelector('[data-movimiento="91"]').click();

    assert.ok(!hoja.classList.contains("abierta"), "se cierra antes de editar");
    assert.equal(llamadas.abrirEdicion.length, 1);
    assert.equal(llamadas.abrirEdicion[0][0].id, 91);
    assert.equal(llamadas.abrirEdicion[0][0].description, "Gas 2");
  });
});

describe("si la API falla", () => {
  test("muestra el error con botón para reintentar, y reintentar vuelve a pedir", async () => {
    let falla = true;
    const { dom, categorias, lista, llamadas } = await montar({
      apiGet: async () => {
        if (falla) throw new Error("sin red");
        return detalleBase();
      },
    });
    cambiarMes(dom, MES_ABIERTO);
    await esperar();

    categorias.querySelector('[data-categoria="2"]').click();
    await esperar();

    assert.match(lista.textContent, /no se pudo cargar/i);
    assert.ok(lista.querySelector("[data-reintentar]"));

    falla = false;
    lista.querySelector("[data-reintentar]").click();
    await esperar();

    assert.equal(llamadas.apiGet.length, 2);
    assert.equal(lista.querySelectorAll(".row").length, 2);
  });
});
