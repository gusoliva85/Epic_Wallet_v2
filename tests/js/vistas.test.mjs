/* Pruebas de `views/vistas.js::conectar()` · guarda de regresión
   Se corren con `npm test` (`node --test tests/js/*.test.mjs`).

   Este módulo se arranca solo al cargar la página (igual que
   `acceso.js`, `router.js`, etc.): nada lo vuelve a llamar desde una
   prueba, así que el único modo de ejercitar `conectar()` de verdad es
   importarlo con el DOM real ya montado, como hace el navegador.

   Por qué existe esta prueba: `conectarAlertas()` tenía una referencia
   a `aviso` sin importar (`D.ALERTAS.map(aviso)`), y como `D.ALERTAS`
   siempre está vacío (F01-T12, no hay alertas de verdad todavía),
   `.map` nunca llegaba a invocar el callback — pero **nombrarlo ya
   tira `ReferenceError`**, antes de que `.map` decida si lo llama. Eso
   pasaba en cada carga de página, en cualquier vista, y como el error
   no estaba capturado cortaba `conectar()` a la mitad: ni
   `conectarControles()` ni `conectarSinConexion()` llegaban a
   conectarse. No se veía en la pantalla —no hay ninguna alerta que
   mostrar—, sólo en la consola; por eso hacía falta una prueba y no
   alcanzaba con mirar el celular. */

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

const HTML = `<!doctype html><html><body>
  <div class="banda-offline" id="banda-offline" hidden></div>
  <button id="btn-alertas" aria-expanded="false" aria-controls="hoja-alertas">
    <span class="contador" id="contador-alertas"></span>
  </button>
  <aside class="hoja hoja--modal" id="hoja-alertas" tabindex="-1">
    <div class="hoja-cuerpo" id="alertas-lista"></div>
  </aside>
  <div class="fondo-hoja" id="fondo-hoja"></div>
  <div class="view-switch" role="group">
    <button type="button" class="activa" data-modo="a">A</button>
    <button type="button" data-modo="b">B</button>
  </div>
  <button type="button" class="toggle" role="switch" aria-checked="false"></button>
</body></html>`;

async function cargarConDobles() {
  let codigo = readFileSync(resolve(RAIZ, "web", "src", "js", "views", "vistas.js"), "utf8");
  codigo = codigo
    .replace(
      'import { crearHoja } from "../components/sheet.js";',
      `import { crearHoja } from "${rutaAbsoluta("components", "sheet.js")}?t=${Math.random()}";`,
    )
    .replace(
      'import { aviso } from "../components/avisos.js";',
      `import { aviso } from "${rutaAbsoluta("components", "avisos.js")}?t=${Math.random()}";`,
    )
    .replace(
      'import { conectarSinConexion } from "../components/estados.js";',
      `import { conectarSinConexion } from "${rutaAbsoluta("components", "estados.js")}?t=${Math.random()}";`,
    )
    .replace(
      'import * as D from "../datos-muestra.js";',
      `import * as D from "${rutaAbsoluta("datos-muestra.js")}?t=${Math.random()}";`,
    );

  const unico = `\n// ${Math.random()}\n`;
  const url = `data:text/javascript;base64,${Buffer.from(codigo + unico, "utf8").toString("base64")}`;
  return import(url);
}

function montar() {
  const dom = new JSDOM(HTML, { url: "https://epic-wallet-v2.vercel.app/#/inicio", pretendToBeVisual: true });
  ventanas.push(dom.window);
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  // Node ya trae su propio `navigator` global, de sólo lectura:
  // `=` directo tira "Cannot set property navigator". `defineProperty`
  // sí puede reemplazarlo por el de jsdom, que es el que hace falta
  // para poder tocar `onLine` desde la prueba.
  Object.defineProperty(globalThis, "navigator", {
    value: dom.window.navigator,
    configurable: true,
  });
  globalThis.CustomEvent = dom.window.CustomEvent;
  return dom;
}

const $ = (dom, id) => dom.window.document.getElementById(id);

describe("conectar", () => {
  test("no revienta con un ReferenceError al cargar (D.ALERTAS vacío)", async () => {
    montar();
    // Si `conectar()` tira sin capturar, el `import()` de arriba
    // rechaza con ese mismo error: `assert.doesNotReject` es la forma
    // de decir "esto no puede tirar", no sólo "no tira el error X".
    await assert.doesNotReject(() => cargarConDobles());
  });

  test("conectarControles() sigue activo después de conectarAlertas(): el view-switch marca la tarjeta tocada", async () => {
    const dom = montar();
    await cargarConDobles();

    const [a, b] = dom.window.document.querySelectorAll(".view-switch button");
    b.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));

    assert.equal(a.classList.contains("activa"), false);
    assert.equal(b.classList.contains("activa"), true);
  });

  test("conectarSinConexion() sigue activo: la banda reacciona a offline/online", async () => {
    const dom = montar();
    Object.defineProperty(dom.window.navigator, "onLine", { value: true, configurable: true });
    await cargarConDobles();

    assert.equal($(dom, "banda-offline").hidden, true);

    Object.defineProperty(dom.window.navigator, "onLine", { value: false, configurable: true });
    dom.window.dispatchEvent(new dom.window.Event("offline"));
    assert.equal($(dom, "banda-offline").hidden, false);
  });
});
