/* Pruebas de la hoja y el cajón · F01-T11

   Los cuatro criterios de aceptación son de comportamiento puro: que
   el fondo no haga scroll, que Escape cierre, que el foco quede
   atrapado adentro. Nada de eso se verifica leyendo el código. */

import { test, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..");

function modulo(ruta) {
  return (
    "file:///" +
    resolve(RAIZ, "web", "src", "js", ...ruta).replace(/\\/g, "/") +
    `?t=${Math.random()}`
  );
}

/** Monta una página con contenido de fondo, el velo y una hoja. */
async function montar() {
  const dom = new JSDOM(
    `<!doctype html><html><body>
      <div class="app" id="fondo-app">
        <button id="otro-de-atras" type="button">Atrás</button>
        <button id="disparador" type="button" aria-expanded="false">Abrir</button>
      </div>
      <div class="fondo-hoja" id="fondo-hoja"></div>
      <aside class="hoja" id="hoja" role="dialog" aria-modal="true"
             aria-hidden="true" tabindex="-1">
        <button id="primero" type="button">Primero</button>
        <button id="medio" type="button">Medio</button>
        <button id="ultimo" type="button" data-cerrar>Cerrar</button>
      </aside>
    </body></html>`,
    { url: "https://epic-wallet-v2.vercel.app/", pretendToBeVisual: true },
  );

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;

  // jsdom no hace layout: sin esto, `offsetParent` es null en todos los
  // botones y el filtro de «elementos visibles» los descartaría a
  // todos. Se simula que están a la vista.
  for (const b of dom.window.document.querySelectorAll("button")) {
    Object.defineProperty(b, "offsetParent", {
      get: () => dom.window.document.body,
    });
  }

  const { crearHoja, hojasAbiertas } = await import(
    modulo(["components", "sheet.js"])
  );
  const $ = (id) => dom.window.document.getElementById(id);

  return {
    dom,
    crearHoja,
    hojasAbiertas,
    $,
    hoja: $("hoja"),
    velo: $("fondo-hoja"),
    disparador: $("disparador"),
  };
}

function tecla(dom, key, extra = {}) {
  dom.window.document.dispatchEvent(
    new dom.window.KeyboardEvent("keydown", { key, bubbles: true, ...extra }),
  );
}

describe("hoja inferior y cajón", () => {
  beforeEach(() => {
    for (const k of ["window", "document"]) delete globalThis[k];
  });

  // ------------------------------------------------------ abrir y cerrar

  test("abre y cierra", async () => {
    const b = await montar();
    const h = b.crearHoja(b.hoja, { disparador: b.disparador });

    h.abrir();
    assert.ok(b.hoja.classList.contains("abierta"));
    assert.ok(b.velo.classList.contains("abierto"));
    assert.equal(b.hoja.getAttribute("aria-hidden"), "false");
    assert.equal(b.disparador.getAttribute("aria-expanded"), "true");

    h.cerrar();
    assert.ok(!b.hoja.classList.contains("abierta"));
    assert.equal(b.hoja.getAttribute("aria-hidden"), "true");
    assert.equal(b.disparador.getAttribute("aria-expanded"), "false");
  });

  test("el disparador alterna", async () => {
    const b = await montar();
    b.crearHoja(b.hoja, { disparador: b.disparador });
    b.disparador.click();
    assert.ok(b.hoja.classList.contains("abierta"));
    b.disparador.click();
    assert.ok(!b.hoja.classList.contains("abierta"));
  });

  test("cierra con Escape", async () => {
    // Criterio de aceptación.
    const b = await montar();
    const h = b.crearHoja(b.hoja);
    h.abrir();
    tecla(b.dom, "Escape");
    assert.ok(!h.estaAbierta());
  });

  test("cierra tocando el velo", async () => {
    const b = await montar();
    const h = b.crearHoja(b.hoja);
    h.abrir();
    b.velo.click();
    assert.ok(!h.estaAbierta());
  });

  test("cierra con el boton de cerrar", async () => {
    const b = await montar();
    const h = b.crearHoja(b.hoja);
    h.abrir();
    b.$("ultimo").click();
    assert.ok(!h.estaAbierta());
  });

  test("abrir dos veces no hace nada raro", async () => {
    const b = await montar();
    const h = b.crearHoja(b.hoja, { disparador: b.disparador });
    h.abrir();
    h.abrir();
    h.cerrar();
    assert.ok(!h.estaAbierta());
    assert.equal(b.hojasAbiertas(), 0, "quedó una hoja contada de más");
  });

  // -------------------------------------------- el fondo no hace scroll

  test("el fondo no hace scroll con la hoja abierta", async () => {
    // Criterio de aceptación. `overflow: hidden` en el body NO alcanza:
    // iOS lo ignora para el scroller del documento. Con
    // `position: fixed` el documento deja de desplazarse en todos lados.
    const b = await montar();
    const h = b.crearHoja(b.hoja);
    h.abrir();
    assert.equal(b.dom.window.document.body.style.position, "fixed");
    h.cerrar();
    assert.equal(b.dom.window.document.body.style.position, "");
  });

  test("al cerrar vuelve al lugar donde estaba la pagina", async () => {
    // `position: fixed` hace saltar el documento al principio: hay que
    // acordarse de dónde estaba.
    const b = await montar();
    Object.defineProperty(b.dom.window, "scrollY", {
      value: 850,
      writable: true,
    });
    let devuelto = null;
    b.dom.window.scrollTo = (arg) => {
      devuelto = arg;
    };

    const h = b.crearHoja(b.hoja);
    h.abrir();
    assert.equal(b.dom.window.document.body.style.top, "-850px");
    h.cerrar();
    assert.equal(devuelto?.top, 850);
    assert.equal(
      devuelto?.behavior,
      "instant",
      "suave, al cerrar se ve a la página viajando sola",
    );
  });

  test("con dos hojas el scroll se suelta recien con la ultima", async () => {
    // Si cada hoja lo manejara por su cuenta, abrir un detalle desde
    // dentro de otra hoja soltaría el scroll al cerrar la de arriba.
    const b = await montar();
    const otra = b.dom.window.document.createElement("aside");
    otra.className = "hoja";
    b.dom.window.document.body.append(otra);

    const a = b.crearHoja(b.hoja);
    const c = b.crearHoja(otra);
    a.abrir();
    c.abrir();
    assert.equal(b.hojasAbiertas(), 2);

    c.cerrar();
    assert.equal(
      b.dom.window.document.body.style.position,
      "fixed",
      "soltó el scroll con una hoja todavía abierta",
    );
    a.cerrar();
    assert.equal(b.dom.window.document.body.style.position, "");
  });

  // ------------------------------------------------- el foco no se escapa

  test("al abrir, el foco entra en la hoja", async () => {
    const b = await montar();
    b.crearHoja(b.hoja).abrir();
    assert.equal(b.dom.window.document.activeElement, b.$("primero"));
  });

  test("al cerrar, el foco vuelve de donde vino", async () => {
    const b = await montar();
    const h = b.crearHoja(b.hoja, { disparador: b.disparador });
    b.disparador.focus();
    h.abrir();
    h.cerrar();
    assert.equal(b.dom.window.document.activeElement, b.disparador);
  });

  test("el tabulador no se escapa por el final", async () => {
    // Criterio de aceptación: el foco queda atrapado adentro.
    const b = await montar();
    b.crearHoja(b.hoja).abrir();
    b.$("ultimo").focus();
    tecla(b.dom, "Tab");
    assert.equal(
      b.dom.window.document.activeElement,
      b.$("primero"),
      "desde el último, el tabulador tiene que volver al primero",
    );
  });

  test("el tabulador no se escapa por el principio", async () => {
    const b = await montar();
    b.crearHoja(b.hoja).abrir();
    b.$("primero").focus();
    tecla(b.dom, "Tab", { shiftKey: true });
    assert.equal(b.dom.window.document.activeElement, b.$("ultimo"));
  });

  test("si el foco se fue afuera, vuelve adentro", async () => {
    const b = await montar();
    b.crearHoja(b.hoja).abrir();
    b.$("otro-de-atras").focus();
    tecla(b.dom, "Tab");
    assert.ok(
      b.hoja.contains(b.dom.window.document.activeElement),
      "el foco tiene que volver a la hoja",
    );
  });

  test("con la hoja cerrada el tabulador anda normal", async () => {
    // El atrapado no puede quedar activo siempre: dejaría la aplicación
    // sin tabulador.
    const b = await montar();
    b.crearHoja(b.hoja);
    b.$("otro-de-atras").focus();
    tecla(b.dom, "Tab");
    assert.equal(
      b.dom.window.document.activeElement,
      b.$("otro-de-atras"),
      "con la hoja cerrada, el Tab no tiene que ser interceptado",
    );
  });

  // ------------------------------------------- lo de atrás, fuera de alcance

  test("lo de atras queda inerte mientras la hoja esta abierta", async () => {
    // Es lo que hace que `aria-modal` no sea una promesa vacía: sin
    // esto, el lector de pantalla sigue leyendo la página de atrás.
    const b = await montar();
    const h = b.crearHoja(b.hoja);
    h.abrir();
    assert.ok(b.$("fondo-app").hasAttribute("inert"));
    assert.ok(!b.hoja.hasAttribute("inert"), "la hoja no puede quedar inerte");
    assert.ok(
      !b.velo.hasAttribute("inert"),
      "el velo tiene que seguir recibiendo el toque",
    );
    h.cerrar();
    assert.ok(!b.$("fondo-app").hasAttribute("inert"));
  });

  // ------------------------------------------------------------ robustez

  test("sin hoja o sin velo no explota", async () => {
    // Una hoja necesita las dos cosas. Faltando cualquiera devuelve
    // null en vez de romper: así una vista que todavía no tiene su
    // marcado no tumba el resto de la página.
    const b = await montar();
    assert.equal(b.crearHoja(null), null, "sin hoja");

    // Sin velo en el documento: se lo saca para que el respaldo por
    // id tampoco lo encuentre.
    b.velo.remove();
    const suelta = b.dom.window.document.createElement("aside");
    assert.equal(b.crearHoja(suelta), null, "sin velo");
  });

  test("una hoja sin nada que enfocar no deja el foco afuera", async () => {
    const b = await montar();
    const vacia = b.dom.window.document.createElement("aside");
    vacia.className = "hoja";
    vacia.tabIndex = -1;
    b.dom.window.document.body.append(vacia);

    const h = b.crearHoja(vacia);
    h.abrir();
    assert.equal(b.dom.window.document.activeElement, vacia);
    tecla(b.dom, "Tab");
    assert.equal(b.dom.window.document.activeElement, vacia);
  });
});
