/* Pruebas de la tarjeta "Preferencias" de Ajustes · F11-T01
   Se corren con `npm test` (`node --test tests/js/*.test.mjs`).

   `./preferencias.js` se dobla entero —ya tiene sus propias pruebas
   en `preferencias.test.mjs`— mismo criterio que `config-cuenta.js`
   doblando `auth.js`. `window.EpicTema` se dobla con un objeto
   mínimo, igual que en `preferencias.test.mjs`: no es un módulo, es
   el script bloqueante del `<head>`.

   Los criterios: se pinta un botón por opción y el que corresponde
   al tema actual queda marcado; tocar una opción llama a
   `guardarTema` con el valor correcto ("sistema" → `null`); entrar a
   Ajustes sincroniza con la cuenta. */

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

/** El contenedor vacío de la tarjeta "Preferencias", recortado del
 * `index.html` real: esta pantalla pinta todo su contenido por JS. */
function htmlDePreferencias() {
  const html = readFileSync(INDEX, "utf8");
  const ancla = html.indexOf('id="config-preferencias"');
  assert.notEqual(ancla, -1, "no se encuentra #config-preferencias en index.html");
  const desde = html.lastIndexOf('<article class="card shell">', ancla);
  const hasta = html.indexOf("</article>", ancla) + "</article>".length;
  return html.slice(desde, hasta);
}

async function cargarConDobles() {
  let codigo = readFileSync(resolve(RAIZ, "web", "src", "js", "config-preferencias.js"), "utf8");
  codigo = codigo
    .replace(
      'import { EVENTO as EVENTO_RUTA } from "./router.js";',
      'const EVENTO_RUTA = "epic:ruta";',
    )
    .replace(
      'import { sincronizarTema, guardarTema } from "./preferencias.js";',
      "const sincronizarTema = (...a) => globalThis.__espia.sincronizarTema(...a);\n" +
        "const guardarTema = (...a) => globalThis.__espia.guardarTema(...a);",
    )
    .replace(
      'import { activar } from "./components/switch.js";',
      // `?t=` para que cada prueba tenga su propia instancia, atada a
      // su propio `document`.
      `import { activar } from "file:///${resolve(RAIZ, "web", "src", "js", "components", "switch.js").replace(/\\/g, "/")}?t=${Math.random()}";`,
    );

  const unico = `\n// ${Math.random()}\n`;
  const url = `data:text/javascript;base64,${Buffer.from(codigo + unico, "utf8").toString("base64")}`;
  return import(url);
}

async function montar({ guardado = null, sincronizarTema, guardarTema } = {}) {
  const dom = new JSDOM(`<!doctype html><html><body>${htmlDePreferencias()}</body></html>`, {
    url: "https://epic-wallet-v2.vercel.app/#/config",
    pretendToBeVisual: true,
  });
  ventanas.push(dom.window);

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.CustomEvent = dom.window.CustomEvent;
  dom.window.EpicTema = { preferenciaGuardada: () => guardado };

  const llamadas = { sincronizarTema: 0, guardarTema: [] };
  globalThis.__espia = {
    sincronizarTema: async () => {
      llamadas.sincronizarTema++;
      if (sincronizarTema) await sincronizarTema();
    },
    guardarTema: async (...a) => {
      llamadas.guardarTema.push(a);
      if (guardarTema) await guardarTema(...a);
    },
  };

  const mod = await cargarConDobles();
  return { dom, mod, llamadas };
}

const $ = (dom, id) => dom.window.document.getElementById(id);
const esperar = (ms = 10) => new Promise((listo) => setTimeout(listo, ms));

function entrarA(dom, id) {
  dom.window.document.dispatchEvent(new dom.window.CustomEvent("epic:ruta", { detail: { id } }));
}

// ===================================================================

describe("pintar", () => {
  test("un botón por opción: Claro, Oscuro, Sistema", async () => {
    const { dom } = await montar();
    const botones = [...$(dom, "pref-tema").querySelectorAll("button[data-tema]")];
    assert.deepEqual(
      botones.map((b) => b.dataset.tema),
      ["light", "dark", "sistema"],
    );
  });

  test("sin preferencia guardada, marca 'Sistema' como activa", async () => {
    const { dom } = await montar({ guardado: null });
    const activa = $(dom, "pref-tema").querySelector("button.activa");
    assert.equal(activa.dataset.tema, "sistema");
  });

  test("con 'dark' guardado, marca esa opción", async () => {
    const { dom } = await montar({ guardado: "dark" });
    const activa = $(dom, "pref-tema").querySelector("button.activa");
    assert.equal(activa.dataset.tema, "dark");
  });
});

describe("elegir una opción", () => {
  test("Claro guarda 'light'", async () => {
    const { dom, llamadas } = await montar();
    $(dom, "pref-tema").querySelector('[data-tema="light"]').click();
    await esperar();

    assert.deepEqual(llamadas.guardarTema, [["light"]]);
  });

  test("Oscuro guarda 'dark'", async () => {
    const { dom, llamadas } = await montar();
    $(dom, "pref-tema").querySelector('[data-tema="dark"]').click();
    await esperar();

    assert.deepEqual(llamadas.guardarTema, [["dark"]]);
  });

  test("Sistema guarda null, no el string 'sistema'", async () => {
    const { dom, llamadas } = await montar();
    $(dom, "pref-tema").querySelector('[data-tema="sistema"]').click();
    await esperar();

    assert.deepEqual(llamadas.guardarTema, [[null]]);
  });
});

describe("al entrar a Ajustes", () => {
  test("sincroniza con la cuenta", async () => {
    const { dom, llamadas } = await montar();
    entrarA(dom, "config");
    await esperar();

    assert.equal(llamadas.sincronizarTema, 1);
  });

  test("otra ruta no sincroniza", async () => {
    const { dom, llamadas } = await montar();
    entrarA(dom, "inicio");
    await esperar();

    assert.equal(llamadas.sincronizarTema, 0);
  });

  test("después de sincronizar, vuelve a marcar la opción activa", async () => {
    const { dom } = await montar({
      guardado: null,
      sincronizarTema: () => {
        // Simula que la cuenta tenía "dark" guardado y ya se aplicó.
        dom.window.EpicTema.preferenciaGuardada = () => "dark";
      },
    });

    entrarA(dom, "config");
    await esperar();

    const activa = $(dom, "pref-tema").querySelector("button.activa");
    assert.equal(activa.dataset.tema, "dark");
  });
});
