/* Pruebas del controlador de la vista Historial · F06-T07
   Referencia: 02_Documento_Tecnico.md §9.1, §12.6

   Misma técnica que `dashboard.test.mjs`: `api.get` y el evento del
   enrutador se doblan, `charts/ahorro.js`, `format.js` y
   `components/estados.js` se importan de verdad.

   Lo que puede fallar en silencio y por eso se prueba: el gráfico
   pide los datos recién al entrar a la vista Historial (no antes, no
   por cualquier cambio de ruta), los vuelve a pedir cada vez que se
   vuelve a entrar (no hay caché que pueda quedar vieja), y un fallo de
   red muestra el estado de error con su botón de reintentar en vez de
   dejar el panel roto o en blanco. */

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
  let codigo = readFileSync(resolve(RAIZ, "web", "src", "js", "historial.js"), "utf8");
  codigo = codigo
    .replace(
      'import { api } from "./api.js";',
      "const api = { get: (...a) => globalThis.__espia.apiGet(...a) };",
    )
    .replace(
      'import { esc, fmtK } from "./format.js";',
      `import { esc, fmtK } from "${rutaAbsoluta("format.js")}";`,
    )
    .replace(
      'import { bloqueCargando, error as estadoError } from "./components/estados.js";',
      `import { bloqueCargando, error as estadoError } from "${rutaAbsoluta("components", "estados.js")}";`,
    )
    .replace('import { EVENTO as EVENTO_RUTA } from "./router.js";', 'const EVENTO_RUTA = "epic:ruta";')
    .replace(
      'import { dibujar as dibujarGraficoAhorro } from "./charts/ahorro.js";',
      `import { dibujar as dibujarGraficoAhorro } from "${rutaAbsoluta("charts", "ahorro.js")}";`,
    );

  const unico = `\n// ${Math.random()}\n`;
  const url = `data:text/javascript;base64,${Buffer.from(codigo + unico, "utf8").toString("base64")}`;
  return import(url);
}

function serieBase() {
  return [
    { year: 2026, month: 8, balance: "300000.00" },
    { year: 2026, month: 9, balance: "450000.00" },
    { year: 2026, month: 10, balance: "500000.00" },
  ];
}

const HTML_HISTORIAL = `<!doctype html><html><body>
  <div class="chart-wrap" id="grafico-ahorro"></div>
  <div class="chart-foot" id="ahorro-pie"></div>
</body></html>`;

async function montar({ apiGet } = {}) {
  const dom = new JSDOM(HTML_HISTORIAL, {
    url: "https://epic-wallet-v2.vercel.app/#/historial",
    pretendToBeVisual: true,
  });
  ventanas.push(dom.window);

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.CustomEvent = dom.window.CustomEvent;

  const llamadas = { apiGet: [] };
  globalThis.__espia = {
    apiGet: async (...a) => {
      llamadas.apiGet.push(a);
      return (apiGet ?? (async () => serieBase()))(...a);
    },
  };

  const mod = await cargarConDobles();
  const $$ = (id) => dom.window.document.getElementById(id);
  return { dom, mod, llamadas, grafico: $$("grafico-ahorro"), pie: $$("ahorro-pie") };
}

const esperar = (ms = 10) => new Promise((listo) => setTimeout(listo, ms));

function entrarA(dom, id) {
  dom.window.document.dispatchEvent(new dom.window.CustomEvent("epic:ruta", { detail: { id } }));
}

describe("antes de entrar a Historial", () => {
  test("no pide nada todavía", async () => {
    const { llamadas } = await montar();
    await esperar();
    assert.equal(llamadas.apiGet.length, 0);
  });
});

describe("al entrar a Historial", () => {
  test("pide la serie y dibuja el gráfico con los datos reales", async () => {
    const { dom, grafico, pie, llamadas } = await montar();
    entrarA(dom, "historial");
    await esperar();

    assert.equal(llamadas.apiGet.length, 1);
    assert.equal(llamadas.apiGet[0][0], "/months/savings-evolution");
    assert.match(grafico.innerHTML, /<svg/);
    assert.match(grafico.innerHTML, /Octubre 26/);
  });

  test("el pie muestra el saldo actual (el del mes más reciente) y la cantidad de meses", async () => {
    const { dom, pie } = await montar();
    entrarA(dom, "historial");
    await esperar();

    assert.match(pie.innerHTML, /Saldo actual/);
    assert.match(pie.innerHTML, />\$500k</); // el último punto de serieBase(): 500000
    assert.match(pie.innerHTML, /Meses registrados/);
    assert.match(pie.innerHTML, />3</);
  });

  test("otra ruta que no es historial no dispara ningún pedido", async () => {
    const { dom, llamadas } = await montar();
    entrarA(dom, "inicio");
    await esperar();
    assert.equal(llamadas.apiGet.length, 0);
  });

  test("volver a entrar pide la serie de nuevo — no hay caché que pueda quedar vieja", async () => {
    const { dom, llamadas } = await montar();
    entrarA(dom, "historial");
    await esperar();
    entrarA(dom, "inicio");
    await esperar();
    entrarA(dom, "historial");
    await esperar();
    assert.equal(llamadas.apiGet.length, 2);
  });
});

describe("si falla el pedido", () => {
  test("muestra el estado de error con botón para reintentar, y el pie queda vacío", async () => {
    const { dom, grafico, pie } = await montar({
      apiGet: async () => {
        throw new Error("red caída");
      },
    });
    entrarA(dom, "historial");
    await esperar();

    assert.match(grafico.innerHTML, /No se pudo cargar/);
    assert.ok(grafico.querySelector("[data-reintentar]"));
    assert.equal(pie.innerHTML, "");
  });

  test("el botón de reintentar vuelve a pedir y se recupera", async () => {
    let falla = true;
    const { dom, grafico, llamadas } = await montar({
      apiGet: async () => {
        if (falla) throw new Error("red caída");
        return serieBase();
      },
    });
    entrarA(dom, "historial");
    await esperar();
    assert.equal(llamadas.apiGet.length, 1);

    falla = false;
    grafico.querySelector("[data-reintentar]").click();
    await esperar();

    assert.equal(llamadas.apiGet.length, 2);
    assert.match(grafico.innerHTML, /<svg/);
  });
});
