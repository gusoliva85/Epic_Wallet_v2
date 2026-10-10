/* Pruebas de la lista de movimientos del mes · F04-T12
   Se corren con `npm test` (`node --test tests/js/*.test.mjs`).

   Mismo técnica que `config-categorias.test.mjs` y
   `alta-movimiento.test.mjs`: el HTML sale del `index.html` real, se
   doblan `api` (get) y `abrirEdicion` (de `alta-movimiento.js`, para
   no cargar ese módulo entero acá) — lo que hay que controlar para
   simular el servidor sin red de verdad—, y `EVENTO_CAMBIO` se
   reemplaza por su valor literal en vez de importar `barra-mes.js`
   entero, que tiene sus propios efectos de carga.

   Los criterios de aceptación de la tarea, cada uno con su prueba: la
   lista refleja lo cargado y ordena por fecha descendente (ya la
   manda así la API; acá se prueba que el agrupado por día no
   reordena), un mes sin movimientos muestra el estado vacío y no una
   lista en blanco, y un mes histórico no inventa una lista (regla 4).
   "Editar el importe actualiza los totales" es de `alta-movimiento.js`
   (ya probado ahí); acá se prueba que tocar una fila abre esa edición
   con el movimiento correcto. */

import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..");
const INDEX = resolve(RAIZ, "web", "index.html");

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

/** La tarjeta de "Movimientos del mes", recortada del `index.html`
 * que se publica: filtros, y el contenedor `#movimientos-lista`. */
function htmlDeLaVista() {
  const html = readFileSync(INDEX, "utf8");
  const ancla = html.indexOf('id="movimientos-lista"');
  assert.notEqual(ancla, -1, "no se encuentra #movimientos-lista en index.html");
  const desde = html.lastIndexOf('<article class="card shell">', ancla);
  const hasta = html.indexOf("</article>", ancla) + "</article>".length;
  return html.slice(desde, hasta);
}

async function cargarConDobles() {
  let codigo = readFileSync(resolve(RAIZ, "web", "src", "js", "movimientos.js"), "utf8");
  codigo = codigo
    .replace(
      'import { api } from "./api.js";',
      "const api = { get: (...a) => globalThis.__espia.apiGet(...a) };",
    )
    .replace(
      'import { esc } from "./format.js";',
      `import { esc } from "file:///${resolve(RAIZ, "web", "src", "js", "format.js").replace(/\\/g, "/")}";`,
    )
    .replace(
      'import { filaMovimiento, separadorDia, pintarFilas } from "./components/rows.js";',
      `import { filaMovimiento, separadorDia, pintarFilas } from "file:///${resolve(RAIZ, "web", "src", "js", "components", "rows.js").replace(/\\/g, "/")}";`,
    )
    .replace(
      'import { bloqueCargando, error as estadoError, vacio, consolidado } from "./components/estados.js";',
      `import { bloqueCargando, error as estadoError, vacio, consolidado } from "file:///${resolve(RAIZ, "web", "src", "js", "components", "estados.js").replace(/\\/g, "/")}";`,
    )
    .replace(
      'import { EVENTO_CAMBIO } from "./barra-mes.js";',
      'const EVENTO_CAMBIO = "mes:cambiado";',
    )
    .replace(
      'import { categorias as categoriasCacheadas } from "./cache-categorias.js";',
      // La de verdad comparte caché con config-categorias.js y
      // alta-movimiento.js (probado en cache-categorias.test.mjs);
      // acá alcanza con que pida /categories, igual que antes.
      'const categoriasCacheadas = () => globalThis.__espia.apiGet("/categories");',
    )
    .replace(
      'import { abrirEdicion } from "./alta-movimiento.js";',
      "const abrirEdicion = (...a) => globalThis.__espia.abrirEdicion(...a);",
    );

  const unico = `\n// ${Math.random()}\n`;
  const url = `data:text/javascript;base64,${Buffer.from(codigo + unico, "utf8").toString("base64")}`;
  return import(url);
}

const MES_ABIERTO = { id: 7, year: 2026, month: 10, status: "open" };
const MES_HISTORICO = { id: 6, year: 2026, month: 9, status: "historical" };

const CATEGORIAS = [
  { id: 1, name: "Sueldo", type: "income", active: true },
  { id: 2, name: "Alquiler", type: "expense", active: true },
  { id: 3, name: "Gas", type: "expense", active: true },
];

// La API ya las manda del día más nuevo al más viejo (F03-T06).
const MOVIMIENTOS = [
  {
    id: 101,
    category_id: 2,
    transaction_type: "expense",
    amount: "150000.00",
    transaction_date: "2026-10-05",
    description: "Alquiler",
    source: "manual",
  },
  {
    id: 102,
    category_id: 3,
    transaction_type: "expense",
    amount: "15000.00",
    transaction_date: "2026-10-05",
    description: "Gas de octubre",
    source: "manual",
  },
  {
    id: 103,
    category_id: 1,
    transaction_type: "income",
    amount: "500000.00",
    transaction_date: "2026-10-01",
    description: "Sueldo",
    source: "manual",
  },
];

/**
 * Monta la tarjeta de movimientos y carga `movimientos.js` con dobles.
 *
 * @param {object} opciones
 * @param {(path:string)=>Promise<object[]>} [opciones.apiGet]
 */
async function montar({
  apiGet = async (path) =>
    structuredClone(path === "/categories" ? CATEGORIAS : MOVIMIENTOS),
} = {}) {
  const dom = new JSDOM(`<!doctype html><html><body>${htmlDeLaVista()}</body></html>`, {
    url: "https://epic-wallet-v2.vercel.app/#/movimientos",
    pretendToBeVisual: true,
  });
  ventanas.push(dom.window);

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.CustomEvent = dom.window.CustomEvent;

  const llamadas = { apiGet: [], abrirEdicion: [] };
  globalThis.__espia = {
    apiGet: async (...a) => {
      llamadas.apiGet.push(a);
      return apiGet(...a);
    },
    abrirEdicion: (...a) => llamadas.abrirEdicion.push(a),
  };

  const mod = await cargarConDobles();
  return { dom, mod, llamadas };
}

const $ = (dom, id) => dom.window.document.getElementById(id);
const esperar = (ms = 10) => new Promise((listo) => setTimeout(listo, ms));

function cambiarMes(dom, periodo) {
  dom.window.document.dispatchEvent(
    new dom.window.CustomEvent("mes:cambiado", { detail: periodo }),
  );
}

function filas(dom) {
  return [...$(dom, "movimientos-lista").children];
}

// ===================================================================

describe("al cambiar de mes", () => {
  test("pide los movimientos del período con year y month", async () => {
    const { dom, llamadas } = await montar();
    await esperar();
    cambiarMes(dom, MES_ABIERTO);
    await esperar();

    const pedido = llamadas.apiGet.find((a) => a[0].startsWith("/transactions?"));
    assert.ok(pedido, "tiene que haber pedido /transactions");
    assert.match(pedido[0], /year=2026/);
    assert.match(pedido[0], /month=10/);
  });

  test("un mes histórico no pide movimientos y muestra el estado consolidado", async () => {
    const { dom, llamadas } = await montar();
    await esperar();
    cambiarMes(dom, MES_HISTORICO);
    await esperar();

    assert.ok(
      !llamadas.apiGet.some((a) => a[0].startsWith("/transactions?")),
      "un mes histórico no tiene movimientos individuales que pedir (Regla 4)",
    );
    assert.match($(dom, "movimientos-lista").textContent, /consolidad/i);
  });

  test("moverse a otro mes vuelve a pedir la lista", async () => {
    const { dom, llamadas } = await montar();
    await esperar();
    cambiarMes(dom, MES_ABIERTO);
    await esperar();
    cambiarMes(dom, { id: 8, year: 2026, month: 11, status: "open" });
    await esperar();

    const pedidos = llamadas.apiGet.filter((a) => a[0].startsWith("/transactions?"));
    assert.equal(pedidos.length, 2);
    assert.match(pedidos[1][0], /month=11/);
  });
});

describe("la lista", () => {
  test("agrupa por día con un separador, sin reordenar lo que manda la API", async () => {
    const { dom } = await montar();
    await esperar();
    cambiarMes(dom, MES_ABIERTO);
    await esperar();

    const nodos = filas(dom);
    // separador (5 de octubre), fila, fila, separador (1 de octubre), fila
    assert.equal(nodos.length, 5);
    assert.equal(nodos[0].className, "day-sep");
    assert.match(nodos[0].textContent, /5 de octubre/i);
    assert.equal(nodos[3].className, "day-sep");
    assert.match(nodos[3].textContent, /1 de octubre/i);
  });

  test("cada fila trae el nombre real de la categoría", async () => {
    const { dom } = await montar();
    await esperar();
    cambiarMes(dom, MES_ABIERTO);
    await esperar();

    const filaAlquiler = $(dom, "movimientos-lista").querySelector('[data-movimiento="101"]');
    assert.match(filaAlquiler.querySelector(".row-main b").textContent, /Alquiler/);
  });

  test("un mes sin movimientos muestra el estado vacío, no una lista en blanco", async () => {
    const { dom } = await montar({ apiGet: async (path) => (path === "/categories" ? CATEGORIAS : []) });
    await esperar();
    cambiarMes(dom, MES_ABIERTO);
    await esperar();

    assert.equal($(dom, "movimientos-lista").querySelectorAll("[data-movimiento]").length, 0);
    assert.match($(dom, "movimientos-lista").textContent, /todavía no hay movimientos/i);
  });

  test("si la API falla, muestra un error con botón para reintentar", async () => {
    let primera = true;
    const { dom, llamadas } = await montar({
      apiGet: async (path) => {
        if (path === "/categories") return structuredClone(CATEGORIAS);
        if (primera) {
          primera = false;
          throw new Error("sin red");
        }
        return structuredClone(MOVIMIENTOS);
      },
    });
    await esperar();
    cambiarMes(dom, MES_ABIERTO);
    await esperar();

    const reintentar = $(dom, "movimientos-lista").querySelector("[data-reintentar]");
    assert.ok(reintentar, "tiene que haber un botón para reintentar");
  });
});

describe("categorías: autorrecuperación", () => {
  test("si /categories falla (típico al registrarse, sin sesión todavía), un cambio de mes posterior lo reintenta solo", async () => {
    // Al arrancar, `arrancar()` ya dispara un primer pedido de
    // categorías: para la prueba, que falle un par de veces primero.
    let fallosQuedan = 2;
    const { dom, llamadas } = await montar({
      apiGet: async (path) => {
        if (path === "/categories") {
          if (fallosQuedan > 0) {
            fallosQuedan--;
            throw new Error("sin sesión todavía");
          }
          return structuredClone(CATEGORIAS);
        }
        return structuredClone(MOVIMIENTOS);
      },
    });
    await esperar();

    cambiarMes(dom, MES_ABIERTO);
    await esperar();
    cambiarMes(dom, MES_ABIERTO);
    await esperar();
    cambiarMes(dom, MES_ABIERTO);
    await esperar();

    // Nadie tocó un botón de "reintentar": el nombre real aparece
    // solo, en cuanto `/categories` por fin responde bien.
    const fila = $(dom, "movimientos-lista").querySelector('[data-movimiento="101"]');
    assert.match(fila.querySelector(".row-main b").textContent, /Alquiler/);
    assert.ok(
      llamadas.apiGet.filter((a) => a[0] === "/categories").length >= 3,
      "tiene que haber reintentado /categories más de una vez",
    );
  });
});

describe("tocar una fila", () => {
  test("abre la edición con el movimiento correcto", async () => {
    const { dom, llamadas } = await montar();
    await esperar();
    cambiarMes(dom, MES_ABIERTO);
    await esperar();

    $(dom, "movimientos-lista").querySelector('[data-movimiento="101"]').click();

    assert.equal(llamadas.abrirEdicion.length, 1);
    assert.equal(llamadas.abrirEdicion[0][0].id, 101);
    assert.equal(llamadas.abrirEdicion[0][0].description, "Alquiler");
  });
});

describe("filtros", () => {
  test("el tipo, la categoría y el texto combinan en la misma consulta", async () => {
    const { dom, llamadas } = await montar();
    await esperar();
    cambiarMes(dom, MES_ABIERTO);
    await esperar();
    llamadas.apiGet.length = 0;

    $(dom, "mov-filtro-tipo").querySelector('[data-tipo="expense"]').click();
    await esperar();

    /** @type {HTMLSelectElement} */ ($(dom, "mov-categoria")).value = "2";
    $(dom, "mov-categoria").dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    await esperar();

    const ultimo = llamadas.apiGet.at(-1)[0];
    assert.match(ultimo, /type=expense/);
    assert.match(ultimo, /category_id=2/);
  });

  test("buscar espera a que se deje de escribir antes de pedir", async () => {
    const { dom, llamadas } = await montar();
    await esperar();
    cambiarMes(dom, MES_ABIERTO);
    await esperar();
    llamadas.apiGet.length = 0;

    const buscar = /** @type {HTMLInputElement} */ ($(dom, "mov-buscar"));
    buscar.value = "gas";
    buscar.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    await esperar(50); // antes de los 300ms del debounce

    assert.equal(
      llamadas.apiGet.filter((a) => a[0].startsWith("/transactions?")).length,
      0,
      "no tiene que pedir todavía",
    );

    await esperar(350);
    const pedidos = llamadas.apiGet.filter((a) => a[0].startsWith("/transactions?"));
    assert.equal(pedidos.length, 1);
    assert.match(pedidos[0][0], /q=gas/);
  });
});
