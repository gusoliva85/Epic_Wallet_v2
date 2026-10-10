/* Pruebas de la caché de meses · optimización posterior a F04-T12
   Se corren con `npm test` (`node --test tests/js/*.test.mjs`).

   `invalidarMeses()` dispara un evento de `document`, así que esto sí
   necesita `document` — pero no hace falta jsdom entero: un
   `EventTarget` nativo de Node alcanza para `dispatchEvent`.

   Lo que se prueba acá —antes sólo indirectamente, a través de
   `barra-mes.test.mjs`— es el comportamiento nuevo: si el primer
   pedido falla, la caché se limpia sola. Antes se quedaba con el
   pedido rechazado para siempre, y la barra de mes mostraba "—" sin
   recuperarse hasta que algo más la invalidara. */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..");

const docOriginal = globalThis.document;
before(() => {
  globalThis.document = new EventTarget();
  globalThis.CustomEvent = globalThis.CustomEvent ?? class extends Event {};
});
after(() => {
  globalThis.document = docOriginal;
});

async function cargarConDobles() {
  let codigo = readFileSync(resolve(RAIZ, "web", "src", "js", "cache-meses.js"), "utf8");
  codigo = codigo.replace(
    'import { api } from "./api.js";',
    "const api = { get: (...a) => globalThis.__espia.apiGet(...a) };",
  );

  const unico = `\n// ${Math.random()}\n`;
  const url = `data:text/javascript;base64,${Buffer.from(codigo + unico, "utf8").toString("base64")}`;
  return import(url);
}

const MESES = [{ id: 1, year: 2026, month: 10, status: "open" }];

async function montar({ apiGet = async () => structuredClone(MESES) } = {}) {
  const llamadas = { apiGet: [] };
  globalThis.__espia = {
    apiGet: async (...a) => {
      llamadas.apiGet.push(a);
      return apiGet(...a);
    },
  };
  const mod = await cargarConDobles();
  return { mod, llamadas };
}

describe("meses()", () => {
  test("pide /months y las comparte entre llamadas simultáneas", async () => {
    const { mod, llamadas } = await montar();
    const [a, b] = await Promise.all([mod.meses(), mod.meses()]);
    assert.deepEqual(a, b);
    assert.equal(llamadas.apiGet.length, 1);
  });

  test("si el primer pedido falla, el siguiente reintenta en vez de quedar trabado", async () => {
    let primeraVez = true;
    const { mod, llamadas } = await montar({
      apiGet: async () => {
        if (primeraVez) {
          primeraVez = false;
          throw new Error("401, sin sesión todavía");
        }
        return structuredClone(MESES);
      },
    });

    await assert.rejects(() => mod.meses());
    const segunda = await mod.meses();

    assert.deepEqual(segunda, MESES);
    assert.equal(llamadas.apiGet.length, 2);
  });
});

describe("invalidarMeses()", () => {
  test("avisa con el evento y hace que la próxima meses() reintente", async () => {
    const { mod, llamadas } = await montar();
    await mod.meses();

    let avisado = false;
    document.addEventListener(mod.EVENTO_INVALIDADO, () => {
      avisado = true;
    });
    mod.invalidarMeses();
    assert.equal(avisado, true);

    await mod.meses();
    assert.equal(llamadas.apiGet.length, 2);
  });
});
