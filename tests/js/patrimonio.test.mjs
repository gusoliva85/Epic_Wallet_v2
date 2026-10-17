/* Pruebas de la vista Patrimonio · F09-T05
   Se corren con `npm test` (`node --test tests/js/*.test.mjs`).

   El HTML sale del `index.html` real, mismo criterio que
   `historial.test.mjs`: la vista se recorta de ahí, así una prueba
   nota si el `id` que usa `patrimonio.js` deja de existir en la
   plantilla. Se dobla `api.get` (no hay POST/PATCH en esta pantalla,
   es de sólo lectura) y `components/estados.js`/`format.js` se
   importan reales —son puras, lo que importa es que `patrimonio.js`
   las use bien, no reprobarlas.

   Los tres criterios de aceptación de la tarea, los que le tocan a
   esta pantalla: el gráfico patrimonial usa el dato real (no hay
   "datos de ejemplo" en ningún lado) y se entiende sin manual que el
   patrimonio no es ahorro + inversiones sin más —la ecuación muestra
   los cuatro términos, pasivos incluido—. "Cambiar el saldo inicial
   recalcula todo el acumulado" es un criterio de backend, probado en
   `tests/api/test_me.py`. */

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

/** La vista Patrimonio completa, recortada de verdad. */
function htmlDePatrimonio() {
  const html = readFileSync(INDEX, "utf8");
  const ancla = html.indexOf('data-vista="patrimonio"');
  assert.notEqual(ancla, -1, "no se encuentra la vista Patrimonio en index.html");
  const desde = html.lastIndexOf("<section", ancla);
  const hasta = html.indexOf("</section>", ancla) + "</section>".length;
  return html.slice(desde, hasta);
}

async function cargarConDobles() {
  let codigo = readFileSync(resolve(RAIZ, "web", "src", "js", "patrimonio.js"), "utf8");
  codigo = codigo
    .replace(
      'import { api } from "./api.js";',
      "const api = { get: (...a) => globalThis.__espia.apiGet(...a) };",
    )
    .replace(
      'import { esc, fmtS, pctPlano, toNum } from "./format.js";',
      `import { esc, fmtS, pctPlano, toNum } from "${rutaAbsoluta("format.js")}";`,
    )
    .replace(
      'import { bloqueCargando, error as estadoError, vacio } from "./components/estados.js";',
      `import { bloqueCargando, error as estadoError, vacio } from "${rutaAbsoluta("components", "estados.js")}";`,
    )
    .replace('import { EVENTO as EVENTO_RUTA } from "./router.js";', 'const EVENTO_RUTA = "epic:ruta";');

  const unico = `\n// ${Math.random()}\n`;
  const url = `data:text/javascript;base64,${Buffer.from(codigo + unico, "utf8").toString("base64")}`;
  return import(url);
}

function respuestaBase() {
  return {
    savings_balance: "8649377.00",
    investments_value: "0.00",
    liabilities_total: "0.00",
    net_worth: "8649377.00",
    composition: { savings_share: "100.0", investments_share: "0.0" },
  };
}

async function montar({ apiGet } = {}) {
  const dom = new JSDOM(`<!doctype html><html><body>${htmlDePatrimonio()}</body></html>`, {
    url: "https://epic-wallet-v2.vercel.app/#/patrimonio",
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
      return (apiGet ?? (async () => respuestaBase()))(...a);
    },
  };

  const mod = await cargarConDobles();
  return { dom, mod, llamadas };
}

const $ = (dom, id) => dom.window.document.getElementById(id);
const esperar = (ms = 15) => new Promise((listo) => setTimeout(listo, ms));

function entrarA(dom, id) {
  dom.window.document.dispatchEvent(new dom.window.CustomEvent("epic:ruta", { detail: { id } }));
}

// ===================================================================

describe("antes de entrar a Patrimonio", () => {
  test("no pide nada todavía", async () => {
    const { llamadas } = await montar();
    await esperar();
    assert.equal(llamadas.apiGet.length, 0);
  });
});

describe("al entrar a Patrimonio", () => {
  test("pide /api/patrimony y pinta la ecuación con los cuatro términos", async () => {
    const { dom, llamadas } = await montar();
    entrarA(dom, "patrimonio");
    await esperar();

    assert.ok(llamadas.apiGet.some((a) => a[0] === "/patrimony"));
    const ecuacion = $(dom, "patrimonio-ecuacion").textContent;
    assert.match(ecuacion, /Ahorro disponible/);
    assert.match(ecuacion, /Inversiones/);
    assert.match(ecuacion, /Pasivos/);
    assert.match(ecuacion, /Patrimonio neto/);
    assert.match(ecuacion, /\$8\.649\.377/);
  });

  test("otra ruta que no es patrimonio no dispara ningún pedido", async () => {
    const { dom, llamadas } = await montar();
    entrarA(dom, "inicio");
    await esperar();
    assert.equal(llamadas.apiGet.length, 0);
  });

  test("volver a entrar pide todo de nuevo — no hay caché que pueda quedar vieja", async () => {
    const { dom, llamadas } = await montar();
    entrarA(dom, "patrimonio");
    await esperar();
    entrarA(dom, "inicio");
    await esperar();
    entrarA(dom, "patrimonio");
    await esperar();
    assert.equal(llamadas.apiGet.filter((a) => a[0] === "/patrimony").length, 2);
  });

  test("si falla el pedido, muestra el estado de error con botón para reintentar", async () => {
    const { dom } = await montar({
      apiGet: async () => {
        throw new Error("red caída");
      },
    });
    entrarA(dom, "patrimonio");
    await esperar();

    assert.match($(dom, "patrimonio-ecuacion").innerHTML, /No se pudo cargar/);
    assert.ok($(dom, "patrimonio-ecuacion").querySelector("[data-reintentar]"));
    assert.match($(dom, "grafico-composicion").innerHTML, /No se pudo cargar/);
  });
});

describe("la composición (barra apilada, sin datos de ejemplo)", () => {
  test("sin inversiones, la barra es 100% del color del ahorro", async () => {
    const { dom } = await montar();
    entrarA(dom, "patrimonio");
    await esperar();

    const caja = $(dom, "grafico-composicion");
    assert.doesNotMatch(caja.innerHTML, /[Dd]atos de ejemplo/);
    const segmentos = [...caja.querySelectorAll(".comp-track > div")];
    assert.equal(segmentos.length, 2);
    assert.match(segmentos[0].getAttribute("style"), /width:\s*100%/);
    assert.match(segmentos[1].getAttribute("style"), /width:\s*0%/);
  });

  test("el pie muestra los dos porcentajes, con coma decimal (es-AR)", async () => {
    const { dom } = await montar({
      apiGet: async () =>
        structuredClone({
          ...respuestaBase(),
          composition: { savings_share: "57.5", investments_share: "42.5" },
        }),
    });
    entrarA(dom, "patrimonio");
    await esperar();

    const pie = $(dom, "patrimonio-pie").textContent;
    assert.match(pie, /57,5%/);
    assert.match(pie, /42,5%/);
  });

  test("sin nada que repartir (composición en null), muestra el estado vacío y no una barra inventada", async () => {
    const { dom } = await montar({
      apiGet: async () =>
        structuredClone({
          ...respuestaBase(),
          savings_balance: "0.00",
          net_worth: "0.00",
          composition: { savings_share: null, investments_share: null },
        }),
    });
    entrarA(dom, "patrimonio");
    await esperar();

    const caja = $(dom, "grafico-composicion");
    assert.equal(caja.querySelector(".comp-track"), null);
    assert.match(caja.textContent, /no hay nada que repartir/i);
  });

  test("un pasivo cargado se ve en la ecuación, no en la barra de composición", async () => {
    const { dom } = await montar({
      apiGet: async () =>
        structuredClone({
          savings_balance: "500000.00",
          investments_value: "0.00",
          liabilities_total: "120000.00",
          net_worth: "380000.00",
          composition: { savings_share: "100.0", investments_share: "0.0" },
        }),
    });
    entrarA(dom, "patrimonio");
    await esperar();

    assert.match($(dom, "patrimonio-ecuacion").textContent, /\$120\.000/);
    assert.match($(dom, "patrimonio-ecuacion").textContent, /\$380\.000/);
    const segmentos = [...$(dom, "grafico-composicion").querySelectorAll(".comp-track > div")];
    assert.match(segmentos[0].getAttribute("style"), /width:\s*100%/);
  });
});
