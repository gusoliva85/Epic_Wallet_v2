/* Pruebas de la caché compartida de categorías · optimización posterior a F04-T12
   Se corren con `npm test` (`node --test tests/js/*.test.mjs`).

   Sin DOM de por medio —el módulo no toca `document`—, así que no
   hace falta jsdom: alcanza con doblar `api.js` y reimportar el
   módulo real por una URL distinta en cada prueba, para que los
   `let` de caché arranquen de cero (los módulos de JavaScript se
   cachean por URL exacta).

   Lo que importa de verdad: un sólo pedido compartido entre
   `categorias()` y `activas()` (la razón de ser de este archivo —
   antes, `config-categorias.js`, `movimientos.js` y
   `alta-movimiento.js` pedían `/categories` cada uno por su cuenta),
   y que un pedido fallido no deje la caché trabada para siempre. */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..");

async function cargarConDobles() {
  let codigo = readFileSync(resolve(RAIZ, "web", "src", "js", "cache-categorias.js"), "utf8");
  codigo = codigo.replace(
    'import { api } from "./api.js";',
    "const api = { get: (...a) => globalThis.__espia.apiGet(...a) };",
  );

  // `unico` fuerza una URL de módulo distinta en cada import: sin
  // esto, Node reusa el módulo ya cacheado de la prueba anterior y
  // los `let pedido` de acá adentro arrastran estado entre pruebas.
  const unico = `\n// ${Math.random()}\n`;
  const url = `data:text/javascript;base64,${Buffer.from(codigo + unico, "utf8").toString("base64")}`;
  return import(url);
}

const CATEGORIAS = [
  { id: 1, name: "Sueldo", type: "income", active: true },
  { id: 2, name: "Alquiler", type: "expense", active: true },
  { id: 3, name: "Gimnasio viejo", type: "expense", active: false },
];

async function montar({ apiGet = async () => structuredClone(CATEGORIAS) } = {}) {
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

describe("categorias()", () => {
  test("pide /categories y devuelve la lista completa", async () => {
    const { mod } = await montar();
    assert.deepEqual(await mod.categorias(), CATEGORIAS);
  });

  test("dos llamadas casi juntas comparten el mismo pedido", async () => {
    const { mod, llamadas } = await montar();
    const [a, b] = await Promise.all([mod.categorias(), mod.categorias()]);
    assert.deepEqual(a, b);
    assert.equal(llamadas.apiGet.length, 1);
  });

  test("una vez resuelta, no vuelve a pedir", async () => {
    const { mod, llamadas } = await montar();
    await mod.categorias();
    await mod.categorias();
    assert.equal(llamadas.apiGet.length, 1);
  });
});

describe("activas()", () => {
  test("filtra las activas sin pedir aparte", async () => {
    const { mod, llamadas } = await montar();
    const activas = await mod.activas();
    assert.deepEqual(
      activas.map((c) => c.name),
      ["Sueldo", "Alquiler"],
    );
    assert.equal(llamadas.apiGet.length, 1, "activas() no agrega un segundo pedido");
  });

  test("categorias() y activas() comparten el mismo pedido", async () => {
    const { mod, llamadas } = await montar();
    await mod.categorias();
    await mod.activas();
    assert.equal(llamadas.apiGet.length, 1);
  });
});

describe("invalidarCategorias()", () => {
  test("la próxima llamada vuelve a pedir", async () => {
    const { mod, llamadas } = await montar();
    await mod.categorias();
    mod.invalidarCategorias();
    await mod.categorias();
    assert.equal(llamadas.apiGet.length, 2);
  });
});

describe("si el pedido falla", () => {
  test("la caché se limpia sola: el siguiente pedido reintenta", async () => {
    // Caso real: `arrancar()` corre apenas carga la página, antes de
    // que una cuenta recién registrada tenga sesión todavía — el
    // primer `/categories` da 401. Sin este comportamiento, la
    // caché quedaba con el pedido rechazado para siempre y nadie
    // volvía a ver categorías en lo que durara la pestaña.
    let primeraVez = true;
    const { mod, llamadas } = await montar({
      apiGet: async () => {
        if (primeraVez) {
          primeraVez = false;
          throw new Error("401, sin sesión todavía");
        }
        return structuredClone(CATEGORIAS);
      },
    });

    await assert.rejects(() => mod.categorias());
    const segunda = await mod.categorias();

    assert.deepEqual(segunda, CATEGORIAS);
    assert.equal(llamadas.apiGet.length, 2, "tuvo que reintentar, no devolver el rechazo de antes");
  });
});
