/* Avisos, píldoras y notificaciones · F01-T12

   Los dos criterios interesantes son de comportamiento: que el lector
   de pantalla pueda anunciar el mensaje y que dos mensajes seguidos no
   se pisen. */

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

async function montar() {
  const dom = new JSDOM(
    `<!doctype html><html><body>
      <div id="caja"></div>
      <div class="toast" id="toast" role="status" aria-live="polite" aria-atomic="true"></div>
    </body></html>`,
    {
      url: "https://epic-wallet-v2.vercel.app/",
      runScripts: "dangerously",
      pretendToBeVisual: true,
    },
  );

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.requestAnimationFrame = (fn) =>
    dom.window.requestAnimationFrame(fn);
  // OJO: no se reemplaza `setTimeout` por el de jsdom. El de jsdom
  // llama al global por dentro, así que apuntar el global al suyo es
  // recursión infinita. El módulo usa el de Node y anda igual: los dos
  // son temporizadores de verdad.

  const avisos = await import(modulo(["components", "avisos.js"]));
  const toastMod = await import(modulo(["components", "toast.js"]));
  return {
    dom,
    avisos,
    toastMod,
    caja: dom.window.document.getElementById("caja"),
    region: dom.window.document.getElementById("toast"),
  };
}

function esperar(ms) {
  return new Promise((listo) => setTimeout(listo, ms));
}

describe("avisos y píldoras", () => {
  beforeEach(() => {
    for (const k of ["window", "document", "requestAnimationFrame"])
      delete globalThis[k];
  });

  test("las cinco severidades dan clases distintas", async () => {
    const { avisos, caja } = await montar();
    const clases = avisos.SEVERIDADES_VALIDAS.map((s) => {
      caja.innerHTML = avisos.aviso({ severidad: s, titulo: "x" });
      return caja.querySelector(".alert").className;
    });
    assert.equal(new Set(clases).size, 5, "hay severidades con la misma clase");
  });

  test("cada severidad tiene su propio icono con nombre", async () => {
    // Criterio del sistema: el color no puede ser el único que diga la
    // gravedad. Quien no distingue el rojo del ámbar necesita que la
    // forma Y el texto cambien.
    const { avisos, caja } = await montar();
    const nombres = [];
    for (const s of avisos.SEVERIDADES_VALIDAS) {
      caja.innerHTML = avisos.aviso({ severidad: s, titulo: "x" });
      const ico = caja.querySelector(".alert-ico");
      assert.equal(ico.getAttribute("role"), "img");
      const etiqueta = ico.getAttribute("aria-label");
      assert.ok(etiqueta, `${s}: el icono no dice qué es`);
      nombres.push(etiqueta);
    }
    // `warn` y `crit` comparten el dibujo del triángulo, pero no el
    // nombre: así se distinguen al leerlos.
    assert.equal(new Set(nombres).size, 5, `nombres repetidos: ${nombres}`);
  });

  test("una severidad que no existe cae en informativa", async () => {
    const { avisos, caja } = await montar();
    caja.innerHTML = avisos.aviso({ severidad: "inventada", titulo: "x" });
    assert.ok(caja.querySelector(".a-info"));
  });

  test("el aviso escapa el titulo y el texto", async () => {
    const { dom, avisos, caja } = await montar();
    dom.window.ejecuto = false;
    caja.innerHTML = avisos.aviso({
      severidad: "crit",
      titulo: '<img src=x onerror="window.ejecuto = true">',
      texto: '<img src=y onerror="window.ejecuto = true">',
    });
    await esperar(30);
    assert.equal(dom.window.ejecuto, false);
    assert.equal(caja.querySelectorAll("img").length, 0);
  });

  test("un aviso sin texto no deja el parrafo vacio", async () => {
    const { avisos, caja } = await montar();
    caja.innerHTML = avisos.aviso({ severidad: "ok", titulo: "Solo título" });
    assert.equal(caja.querySelector(".alert p"), null);
  });

  test("la pildora sale de una lista cerrada", async () => {
    const { avisos, caja } = await montar();
    caja.innerHTML = avisos.pildora({ texto: "x", tipo: "inventado" });
    assert.ok(
      caja.querySelector(".pill.neutral"),
      "un tipo inválido cae en neutral",
    );

    caja.innerHTML = avisos.pildora({ texto: "x", tipo: "crit" });
    assert.ok(caja.querySelector(".pill.crit"));
  });

  test("la pildora escapa su texto", async () => {
    const { dom, avisos, caja } = await montar();
    dom.window.ejecuto = false;
    caja.innerHTML = avisos.pildora({
      texto: '<img src=x onerror="window.ejecuto = true">',
      tipo: "ok",
    });
    await esperar(30);
    assert.equal(dom.window.ejecuto, false);
  });
});

describe("notificación breve", () => {
  beforeEach(() => {
    for (const k of ["window", "document", "requestAnimationFrame"])
      delete globalThis[k];
  });

  test("la region viva existe antes que el mensaje", async () => {
    // Es lo que decide si el lector anuncia o no. Un lector anuncia los
    // CAMBIOS dentro de una región aria-live: si la región se creara
    // junto con el texto, no habría cambio que anunciar.
    const { region } = await montar();
    assert.equal(region.getAttribute("aria-live"), "polite");
    assert.equal(region.getAttribute("role"), "status");
    assert.equal(region.textContent, "", "la región tiene que arrancar vacía");
  });

  test("el mensaje entra en la region, no en un elemento nuevo", async () => {
    const { dom, toastMod, region } = await montar();
    toastMod.toast("Movimiento guardado");
    await esperar(30);
    assert.match(region.textContent, /Movimiento guardado/);
    assert.ok(region.classList.contains("visible"));
    toastMod.limpiarToasts();
  });

  test("el mensaje se va solo", async () => {
    const { dom, toastMod, region } = await montar();
    toastMod.toast("Listo");
    await esperar(30);
    assert.ok(region.classList.contains("visible"));

    await esperar(toastMod.DURACION + 60);
    assert.ok(!region.classList.contains("visible"), "no se fue solo");
    toastMod.limpiarToasts();
  });

  test("dos mensajes seguidos no se superponen", async () => {
    // Criterio de aceptación. Hacen cola: el segundo espera a que el
    // primero termine de irse.
    const { dom, toastMod, region } = await montar();
    toastMod.toast("Primero");
    toastMod.toast("Segundo");
    await esperar(30);

    assert.match(region.textContent, /Primero/);
    assert.ok(!/Segundo/.test(region.textContent), "los dos a la vez");
    assert.equal(
      toastMod.enEspera(),
      1,
      "el segundo tiene que estar esperando",
    );

    await esperar(toastMod.DURACION + toastMod.SALIDA + 90);
    assert.match(region.textContent, /Segundo/, "el segundo nunca llegó");
    toastMod.limpiarToasts();
  });

  test("el segundo espera a que el primero termine de irse", async () => {
    // Si entrara apenas se oculta el primero, los dos se cruzan en
    // pantalla durante la transición.
    const { dom, toastMod, region } = await montar();
    toastMod.toast("Primero");
    toastMod.toast("Segundo");
    await esperar(toastMod.DURACION + 40);

    assert.ok(
      !region.classList.contains("visible"),
      "el primero sigue visible",
    );
    assert.match(
      region.textContent,
      /Primero/,
      "cambió el texto antes de irse",
    );
    toastMod.limpiarToasts();
  });

  test("tres mensajes salen en orden", async () => {
    const { dom, toastMod, region } = await montar();
    for (const m of ["Uno", "Dos", "Tres"]) toastMod.toast(m);
    assert.equal(toastMod.enEspera(), 2);

    const vistos = [];
    for (let i = 0; i < 3; i++) {
      await esperar(40);
      vistos.push(region.textContent.trim());
      await esperar(toastMod.DURACION + toastMod.SALIDA + 40);
    }
    assert.deepEqual(vistos, ["Uno", "Dos", "Tres"]);
    toastMod.limpiarToasts();
  });

  test("el mensaje se escapa", async () => {
    const { dom, toastMod, region } = await montar();
    dom.window.ejecuto = false;
    toastMod.toast('<img src=x onerror="window.ejecuto = true">');
    await esperar(40);
    assert.equal(dom.window.ejecuto, false);
    assert.equal(region.querySelectorAll("img").length, 0);
    toastMod.limpiarToasts();
  });

  test("la severidad cambia el icono y el color", async () => {
    const { dom, toastMod, region } = await montar();
    toastMod.toast("Error", { severidad: "crit" });
    await esperar(40);
    assert.ok(region.classList.contains("t-crit"));
    assert.ok(region.querySelector(".toast-ico svg path"), "falta el icono");
    toastMod.limpiarToasts();
  });

  test("una severidad que no existe no rompe el mensaje", async () => {
    const { dom, toastMod, region } = await montar();
    toastMod.toast("Hola", { severidad: "inventada" });
    await esperar(40);
    assert.match(region.textContent, /Hola/);
    assert.ok(!region.innerHTML.includes("undefined"));
    toastMod.limpiarToasts();
  });

  test("limpiar corta la cola y vacia la region", async () => {
    const { dom, toastMod, region } = await montar();
    toastMod.toast("Uno");
    toastMod.toast("Dos");
    await esperar(40);
    toastMod.limpiarToasts();
    assert.equal(toastMod.enEspera(), 0);
    assert.equal(region.textContent, "");
    assert.ok(!region.classList.contains("visible"));
  });

  test("el icono del mensaje no lo lee el lector", async () => {
    // El texto del mensaje ya lo dice todo; el icono repetiría.
    const { dom, toastMod, region } = await montar();
    toastMod.toast("Guardado");
    await esperar(40);
    assert.equal(
      region.querySelector(".toast-ico").getAttribute("aria-hidden"),
      "true",
    );
    toastMod.limpiarToasts();
  });
});
