/* Pruebas del cliente de API · F02-T12
   Se corren con `npm test` (`node --test tests/js/*.test.mjs`).

   `api.js` no toca el DOM —habla con `fetch` y con auth.js/router.js—,
   así que estas pruebas no montan ningún `JSDOM`: alcanza con doblar
   `fetch` y las tres importaciones (`cabeceras`/`salir` de auth.js,
   `navegar` de router.js, `LOGIN` de nav.js).

   Los criterios de aceptación son de comportamiento, no de forma:
   un token vencido se recupera solo (un 401 reintenta una vez), dos
   401 seguidos cierran sesión sin bucle (nunca un tercer intento), y
   cada código de error de la sección 9.3 del documento técnico tiene
   un mensaje en español listo para mostrar. */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..");

/**
 * Carga `api.js` con `cabeceras`, `salir` y `navegar` doblados.
 *
 * @param {object} opciones
 * @param {object|null} [opciones.cabecerasValor] lo que devuelve
 *   `cabeceras()`; `null` simula sin sesión.
 * @param {(url:string, init:object) => Promise<object>} [opciones.fetchImpl]
 */
async function montar({
  cabecerasValor = { Authorization: "Bearer token-de-prueba" },
  fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({}) }),
} = {}) {
  const llamadas = { fetch: [], salir: 0, navegar: [] };

  globalThis.__espia = {
    cabeceras: async () => cabecerasValor,
    salir: async () => {
      llamadas.salir++;
    },
    navegar: (...a) => {
      llamadas.navegar.push(a);
    },
  };
  globalThis.fetch = async (...a) => {
    llamadas.fetch.push(a);
    return fetchImpl(...a);
  };

  const modulo = await cargarConDobles();
  return { api: modulo.api, cerrarSesion: modulo.cerrarSesion, llamadas };
}

async function cargarConDobles() {
  let codigo = readFileSync(resolve(RAIZ, "web", "src", "js", "api.js"), "utf8");
  codigo = codigo
    .replace(
      'import { cabeceras, salir } from "./auth.js";',
      "const cabeceras = (...a) => globalThis.__espia.cabeceras(...a);\n" +
        "const salir = (...a) => globalThis.__espia.salir(...a);",
    )
    .replace(
      'import { navegar } from "./router.js";',
      "const navegar = (...a) => globalThis.__espia.navegar(...a);",
    )
    .replace('import { LOGIN } from "./nav.js";', 'const LOGIN = "login";');

  const unico = `
// ${Math.random()}
`;
  const url = `data:text/javascript;base64,${Buffer.from(codigo + unico, "utf8").toString("base64")}`;
  return import(url);
}

// ===================================================================

describe("las cuatro formas de pedir", () => {
  test("get agrega el token y pide a /api<path>", async () => {
    const { api, llamadas } = await montar();
    await api.get("/me");

    assert.equal(llamadas.fetch.length, 1);
    const [url, init] = llamadas.fetch[0];
    assert.equal(url, "/api/me");
    assert.equal(init.headers.Authorization, "Bearer token-de-prueba");
    assert.equal(init.method, undefined, "get no manda method");
  });

  test("patch manda el método y el cuerpo en JSON", async () => {
    const { api, llamadas } = await montar();
    await api.patch("/me", { display_name: "Gustavo" });

    const [url, init] = llamadas.fetch[0];
    assert.equal(url, "/api/me");
    assert.equal(init.method, "PATCH");
    assert.equal(init.body, JSON.stringify({ display_name: "Gustavo" }));
    assert.equal(init.headers["Content-Type"], "application/json");
  });

  test("post sin datos no manda un cuerpo", async () => {
    // Para endpoints como /me/bootstrap, que no llevan payload: mandar
    // `JSON.stringify(undefined)` mandaría la cadena "undefined", que
    // Pydantic no va a poder interpretar como JSON vacío.
    const { api, llamadas } = await montar();
    await api.post("/me/bootstrap");

    const [, init] = llamadas.fetch[0];
    assert.equal(init.method, "POST");
    assert.equal(init.body, undefined);
  });

  test("post con datos los manda en JSON", async () => {
    const { api, llamadas } = await montar();
    await api.post("/transactions", { amount: "100.00" });

    const [, init] = llamadas.fetch[0];
    assert.equal(init.body, JSON.stringify({ amount: "100.00" }));
  });

  test("del manda el método DELETE", async () => {
    const { api, llamadas } = await montar();
    await api.del("/transactions/1");

    const [url, init] = llamadas.fetch[0];
    assert.equal(url, "/api/transactions/1");
    assert.equal(init.method, "DELETE");
  });

  test("sin sesión, no manda cabecera de autorización", async () => {
    const { api, llamadas } = await montar({ cabecerasValor: null });
    await api.get("/me");

    assert.equal(llamadas.fetch[0][1].headers.Authorization, undefined);
  });
});

describe("respuestas sin error", () => {
  test("204 devuelve null, sin intentar leer un cuerpo", async () => {
    const { api } = await montar({ fetchImpl: async () => ({ ok: true, status: 204 }) });
    assert.equal(await api.del("/transactions/1"), null);
  });

  test("devuelve el cuerpo tal cual cuando todo sale bien", async () => {
    const { api } = await montar({
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ id: "1" }) }),
    });
    assert.deepEqual(await api.get("/me"), { id: "1" });
  });
});

describe("el formato de error de la sección 9.3", () => {
  test("un error de la API llega con su code, message y details", async () => {
    const { api } = await montar({
      fetchImpl: async () => ({
        ok: false,
        status: 409,
        json: async () => ({
          error: {
            code: "CONFLICT",
            message: "Ya existe un mes para ese año y mes.",
            details: [{ field: "year" }],
          },
        }),
      }),
    });

    await assert.rejects(api.get("/months"), (e) => {
      assert.equal(e.name, "ApiError");
      assert.equal(e.code, "CONFLICT");
      assert.equal(e.message, "Ya existe un mes para ese año y mes.");
      assert.deepEqual(e.details, [{ field: "year" }]);
      assert.equal(e.status, 409);
      return true;
    });
  });

  test("sin cuerpo JSON, cae en el mensaje genérico del código", async () => {
    // Un 500 crudo de la plataforma, antes de llegar a FastAPI.
    const { api } = await montar({
      fetchImpl: async () => ({
        ok: false,
        status: 500,
        json: async () => {
          throw new SyntaxError("Unexpected end of JSON input");
        },
      }),
    });

    await assert.rejects(api.get("/me"), (e) => {
      assert.equal(e.code, "INTERNAL_ERROR");
      assert.match(e.message, /error inesperado/i);
      return true;
    });
  });

  test("sin red, el error es SIN_RED y no uno de la API", async () => {
    const { api } = await montar({
      fetchImpl: async () => {
        throw new TypeError("Failed to fetch");
      },
    });

    await assert.rejects(api.get("/me"), (e) => {
      assert.equal(e.code, "SIN_RED");
      assert.match(e.message, /conectar/i);
      return true;
    });
  });
});

describe("el 401: una renovación, nunca un bucle", () => {
  test("un solo 401 se recupera solo, sin que quien llama note nada", async () => {
    let numero = 0;
    const { api, llamadas } = await montar({
      fetchImpl: async () => {
        numero++;
        if (numero === 1) return { ok: false, status: 401 };
        return { ok: true, status: 200, json: async () => ({ id: "1" }) };
      },
    });

    const resultado = await api.get("/me");
    assert.deepEqual(resultado, { id: "1" });
    assert.equal(llamadas.fetch.length, 2, "tiene que haber reintentado exactamente una vez");
    assert.equal(llamadas.salir, 0, "un 401 que se recupera no tiene que cerrar sesión");
  });

  test("dos 401 seguidos cierran sesión y mandan al login, sin un tercer intento", async () => {
    const { api, llamadas } = await montar({
      fetchImpl: async () => ({ ok: false, status: 401 }),
    });

    await assert.rejects(api.get("/me"), (e) => {
      assert.equal(e.code, "UNAUTHENTICATED");
      return true;
    });

    assert.equal(llamadas.fetch.length, 2, "reintentó más de una vez: esto sí sería el bucle");
    assert.equal(llamadas.salir, 1);
    assert.deepEqual(llamadas.navegar, [["login"]]);
  });
});

describe("cerrarSesion", () => {
  test("limpia la sesión y manda al login", async () => {
    // Es la misma función exportada que usa `request()` al segundo
    // 401 (prueba de arriba) y la que va a usar el botón de "Cerrar
    // sesión" de config-cuenta.js: un solo camino, no dos que puedan
    // desincronizarse.
    const { cerrarSesion, llamadas } = await montar();
    await cerrarSesion();
    assert.equal(llamadas.salir, 1);
    assert.deepEqual(llamadas.navegar, [["login"]]);
  });
});
