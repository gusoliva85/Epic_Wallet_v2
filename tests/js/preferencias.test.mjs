/* Pruebas de la sincronización del tema con la cuenta · F11-T01
   Se corren con `npm test` (`node --test tests/js/*.test.mjs`).

   `window.EpicTema` no se carga de `tema.js` real —es un script sin
   módulos, pensado para el `<head>`, no para importarse— así que acá
   se dobla con un objeto mínimo que registra lo que se le pide,
   mismo criterio que doblar cualquier otra dependencia externa al
   módulo bajo prueba. `api.js` se dobla igual que en `cartera.test.mjs`.

   Los criterios: la cuenta manda si tiene algo guardado; si no tiene
   nada pero el dispositivo sí, ese valor se sube; sin nada en ningún
   lado, no se hace ninguna escritura; guardar aplica local YA y
   después persiste. */

import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readFileSync } from "node:fs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..");

function rutaAbsoluta(...partes) {
  return `file:///${resolve(RAIZ, "web", "src", "js", ...partes).replace(/\\/g, "/")}`;
}

async function cargarConDobles() {
  let codigo = readFileSync(resolve(RAIZ, "web", "src", "js", "preferencias.js"), "utf8");
  codigo = codigo.replace(
    'import { api } from "./api.js";',
    "const api = {\n" +
      "  get: (...a) => globalThis.__espia.apiGet(...a),\n" +
      "  put: (...a) => globalThis.__espia.apiPut(...a),\n" +
      "};",
  );

  const unico = `\n// ${Math.random()}\n`;
  const url = `data:text/javascript;base64,${Buffer.from(codigo + unico, "utf8").toString("base64")}`;
  return import(url);
}

function montarEpicTema({ guardado = null } = {}) {
  const llamadas = { fijar: [], seguirAlSistema: 0 };
  let actual = guardado ?? "light";
  globalThis.window = {
    EpicTema: {
      preferenciaGuardada: () => guardado,
      actual: () => actual,
      fijar: (tema) => {
        llamadas.fijar.push(tema);
        actual = tema;
        return tema;
      },
      seguirAlSistema: () => {
        llamadas.seguirAlSistema++;
      },
    },
  };
  return llamadas;
}

async function montar({ apiGet, apiPut, guardado = null } = {}) {
  const llamadasEpic = montarEpicTema({ guardado });
  const llamadas = { apiGet: [], apiPut: [] };
  globalThis.__espia = {
    apiGet: async (...a) => {
      llamadas.apiGet.push(a);
      return (apiGet ?? (async () => ({ theme: null })))(...a);
    },
    apiPut: async (...a) => {
      llamadas.apiPut.push(a);
      return (apiPut ?? (async () => ({ theme: null })))(...a);
    },
  };

  const mod = await cargarConDobles();
  return { mod, llamadas, epic: llamadasEpic };
}

after(() => {
  delete globalThis.window;
  delete globalThis.__espia;
});

// ===================================================================
//  sincronizarTema
// ===================================================================

describe("sincronizarTema", () => {
  test("si la cuenta tiene un tema guardado, lo aplica en este dispositivo", async () => {
    const { mod, epic } = await montar({
      apiGet: async () => ({ theme: "dark" }),
      guardado: "light", // el dispositivo tenía otra cosa: la cuenta manda.
    });

    await mod.sincronizarTema();

    assert.deepEqual(epic.fijar, ["dark"]);
  });

  test("si la cuenta no tiene nada pero el dispositivo sí, sube ese valor", async () => {
    const { mod, llamadas } = await montar({
      apiGet: async () => ({ theme: null }),
      guardado: "dark",
    });

    await mod.sincronizarTema();

    assert.equal(llamadas.apiPut.length, 1);
    assert.deepEqual(llamadas.apiPut[0][1], { theme: "dark" });
  });

  test("sin nada guardado en ningún lado, no escribe nada", async () => {
    const { mod, llamadas, epic } = await montar({
      apiGet: async () => ({ theme: null }),
      guardado: null,
    });

    await mod.sincronizarTema();

    assert.equal(llamadas.apiPut.length, 0);
    assert.equal(epic.fijar.length, 0);
  });

  test("si falla el pedido, no rompe: se queda con lo que ya había", async () => {
    const { mod, llamadas } = await montar({
      apiGet: async () => {
        throw new Error("red caída");
      },
      guardado: "dark",
    });

    await assert.doesNotReject(() => mod.sincronizarTema());
    assert.equal(llamadas.apiPut.length, 0);
  });
});

// ===================================================================
//  guardarTema
// ===================================================================

describe("guardarTema", () => {
  test("aplica local y persiste un valor explícito", async () => {
    const { mod, llamadas, epic } = await montar();

    await mod.guardarTema("dark");

    assert.deepEqual(epic.fijar, ["dark"]);
    assert.equal(epic.seguirAlSistema, 0);
    assert.deepEqual(llamadas.apiPut[0][1], { theme: "dark" });
  });

  test("null sigue al sistema, local y en la cuenta", async () => {
    const { mod, llamadas, epic } = await montar();

    await mod.guardarTema(null);

    assert.equal(epic.seguirAlSistema, 1);
    assert.equal(epic.fijar.length, 0);
    assert.deepEqual(llamadas.apiPut[0][1], { theme: null });
  });

  test("si falla el guardado remoto, ya aplicó local y no rompe", async () => {
    const { mod, epic } = await montar({
      apiPut: async () => {
        throw new Error("red caída");
      },
    });

    await assert.doesNotReject(() => mod.guardarTema("dark"));
    assert.deepEqual(epic.fijar, ["dark"]);
  });
});
