/* Pruebas del enrutador · F01-T07
   Se corren con `node --test tests/js/` y también desde pytest, que
   las invoca en tests/unit/test_router.py para que `pytest` siga
   siendo el único comando que hay que recordar.

   Por qué con jsdom y no leyendo el archivo como las demás pruebas de
   frontend: los cuatro criterios de aceptación de la tarea son de
   comportamiento —recargar en `#/inversiones`, volver con «atrás»,
   caer en inicio con una ruta inválida, no recargar la página— y una
   prueba que lea el código fuente no puede verificar ninguno. jsdom
   implementa el hash, el historial y `hashchange` de verdad; un doble
   hecho a mano verificaría el doble, no el navegador. */

import { test, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..");

const SECCIONES = [
  "inicio",
  "movimientos",
  "historial",
  "inversiones",
  "patrimonio",
  "analisis",
  "config",
];

/** Monta un DOM con las siete vistas y devuelve el enrutador cargado
    en ese contexto. `hash` simula con qué URL se entró. */
async function montar(hash = "") {
  const vistas = SECCIONES.map(
    (id) => `<section class="view" data-vista="${id}" hidden></section>`,
  ).join("");

  const dom = new JSDOM(
    `<!doctype html><html><head><title>Epic Wallet</title></head>` +
      `<body><main>${vistas}</main></body></html>`,
    {
      url: `https://epic-wallet-v2.vercel.app/${hash}`,
      pretendToBeVisual: true,
    },
  );

  // jsdom no implementa el desplazamiento y avisa por consola en cada
  // llamada. La prueba que verifica el scroll lo reemplaza por el suyo.
  dom.window.scrollTo = () => {};

  // El enrutador es un módulo del navegador: usa `location`, `history`
  // y `document` globales. Se los damos del DOM de jsdom.
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.location = dom.window.location;
  globalThis.history = dom.window.history;
  globalThis.CustomEvent = dom.window.CustomEvent;

  // Cache-buster: cada prueba necesita el módulo con su estado interno
  // en blanco (el enrutador recuerda la última ruta pintada).
  const url =
    "file:///" +
    resolve(RAIZ, "web", "src", "js", "router.js").replace(/\\/g, "/") +
    `?t=${Math.random()}`;
  const router = await import(url);
  router.arrancar();
  return { dom, router };
}

function activa(dom) {
  const el = dom.window.document.querySelector(".view:not([hidden])");
  return el ? el.dataset.vista : null;
}

/** Espera a que quede activa la vista `id`.
 *
 * Un solo tick NO alcanza: el recorrido del historial de jsdom es
 * asíncrono y tarda un número de ticks que no está garantizado. Con
 * `setTimeout(0)` las pruebas de «atrás» pasaban casi siempre y
 * fallaban una vez cada tres corridas. */
function esperarVista(dom, id, ms = 2000) {
  return new Promise((listo, falla) => {
    const limite = Date.now() + ms;
    const probar = () => {
      if (activa(dom) === id) return listo();
      if (Date.now() > limite) {
        return falla(
          new Error(`la vista nunca pasó a «${id}»; quedó en «${activa(dom)}»`),
        );
      }
      dom.window.setTimeout(probar, 5);
    };
    probar();
  });
}

/** Deja correr los eventos pendientes. Para cuando se verifica que algo
    NO pasa y no hay condición que esperar. */
function latir(dom, ms = 60) {
  return new Promise((listo) => dom.window.setTimeout(listo, ms));
}

describe("enrutador", () => {
  beforeEach(() => {
    for (const k of [
      "window",
      "document",
      "location",
      "history",
      "CustomEvent",
    ])
      delete globalThis[k];
  });

  test("sin hash abre inicio y corrige la URL", async () => {
    const { dom } = await montar("");
    assert.equal(activa(dom), "inicio");
    assert.equal(dom.window.location.hash, "#/inicio");
  });

  test("recargar en #/inversiones abre inversiones", async () => {
    // Criterio de aceptación de la tarea.
    const { dom } = await montar("#/inversiones");
    assert.equal(activa(dom), "inversiones");
  });

  test("cada una de las siete rutas abre su vista", async () => {
    for (const id of SECCIONES) {
      const { dom } = await montar(`#/${id}`);
      assert.equal(activa(dom), id, `#/${id} tenía que abrir ${id}`);
    }
  });

  test("una ruta inválida cae en inicio", async () => {
    // Criterio de aceptación.
    const { dom } = await montar("#/no-existe");
    assert.equal(activa(dom), "inicio");
    assert.equal(
      dom.window.location.hash,
      "#/inicio",
      "la URL también se corrige, no queda la ruta mala a la vista",
    );
  });

  test("la ruta inválida no queda en el historial", async () => {
    // Si se corrigiera asignando el hash en lugar de reemplazar,
    // «atrás» volvería a la ruta mala y de ahí otra vez a inicio: un
    // bucle del que no se sale.
    //
    // Se compara contra entrar por una ruta buena: las dos tienen que
    // dejar el historial del mismo largo.
    const bueno = await montar("#/inicio");
    const malo = await montar("#/no-existe");
    assert.equal(
      malo.dom.window.history.length,
      bueno.dom.window.history.length,
      "corregir una ruta inválida agregó una entrada al historial",
    );
  });

  test("navegar a una ruta inexistente no agrega entradas", async () => {
    // `navegar` valida antes de tocar el hash. Sin esa validación, el
    // hash pasaría por la ruta mala —dejando su entrada— y recién
    // después se corregiría a inicio.
    const { dom, router } = await montar("#/inicio");
    const largo = dom.window.history.length;
    router.navegar("no-existe");
    await esperarVista(dom, "inicio");
    assert.equal(activa(dom), "inicio");
    assert.equal(
      dom.window.history.length,
      largo,
      "la ruta mala dejó una entrada en el historial",
    );
  });

  test("volver a la vista activa no repite la animacion de entrada", async () => {
    // Tocar dos veces la misma posición de la barra no tiene que hacer
    // parpadear la pantalla.
    const { dom, router } = await montar("#/analisis");
    const vistos = [];
    dom.window.document.addEventListener(router.EVENTO, (ev) =>
      vistos.push(ev.detail.id),
    );
    router.navegar("analisis");
    router.navegar("analisis");
    await esperarVista(dom, "analisis");
    assert.deepEqual(
      vistos,
      [],
      "no tenía que volver a pintar la vista activa",
    );
  });

  test("solo una vista queda visible a la vez", async () => {
    const { dom, router } = await montar("#/inicio");
    router.navegar("analisis");
    await esperarVista(dom, "analisis");
    const visibles = dom.window.document.querySelectorAll(
      ".view:not([hidden])",
    );
    assert.equal(visibles.length, 1);
    assert.equal(visibles[0].dataset.vista, "analisis");
  });

  test("las vistas inactivas salen del arbol de accesibilidad", async () => {
    // Sin `hidden`, el lector lee las siete secciones seguidas y el
    // tabulador recorre los botones de las que no se ven.
    const { dom } = await montar("#/historial");
    const ocultas = [...dom.window.document.querySelectorAll(".view[hidden]")];
    assert.equal(ocultas.length, SECCIONES.length - 1);
  });

  test("navegar agrega una entrada al historial y atras vuelve", async () => {
    // Criterio de aceptación: «atrás» vuelve a la vista previa.
    const { dom, router } = await montar("#/inicio");
    router.navegar("movimientos");
    await esperarVista(dom, "movimientos");
    assert.equal(activa(dom), "movimientos");

    dom.window.history.back();
    await esperarVista(dom, "inicio");
    assert.equal(activa(dom), "inicio", "«atrás» tenía que volver a inicio");
  });

  test("atras y adelante recorren tres vistas", async () => {
    const { dom, router } = await montar("#/inicio");
    router.navegar("movimientos");
    await esperarVista(dom, "movimientos");
    router.navegar("config");
    await esperarVista(dom, "config");

    dom.window.history.back();
    await esperarVista(dom, "movimientos");

    dom.window.history.forward();
    await esperarVista(dom, "config");
  });

  test("navegar a la ruta actual no agrega entradas al historial", async () => {
    // Tocar dos veces la misma posición de la barra no tiene que
    // llenar el historial de repetidos.
    const { dom, router } = await montar("#/inicio");
    const largo = dom.window.history.length;
    router.navegar("inicio");
    router.navegar("inicio");
    await latir(dom);
    assert.equal(dom.window.history.length, largo);
  });

  test("navegar a una ruta que no existe cae en inicio", async () => {
    const { dom, router } = await montar("#/config");
    router.navegar("cualquier-cosa");
    await esperarVista(dom, "inicio");
    assert.equal(activa(dom), "inicio");
  });

  test("avisa del cambio de ruta una sola vez", async () => {
    // `hashchange` y `popstate` pueden llegar los dos por el mismo
    // cambio; si se emitiera dos veces, la animación de entrada se
    // vería doble y cada oyente haría su trabajo dos veces.
    const { dom, router } = await montar("#/inicio");
    const vistos = [];
    dom.window.document.addEventListener(router.EVENTO, (ev) =>
      vistos.push(ev.detail.id),
    );
    router.navegar("patrimonio");
    await esperarVista(dom, "patrimonio");
    assert.deepEqual(vistos, ["patrimonio"]);
  });

  test("el aviso lleva el id de la ruta", async () => {
    const { dom, router } = await montar("#/inicio");
    let recibido = null;
    dom.window.document.addEventListener(router.EVENTO, (ev) => {
      recibido = ev.detail.id;
    });
    router.navegar("analisis");
    await esperarVista(dom, "analisis");
    assert.equal(recibido, "analisis");
  });

  test("rutaActual devuelve null cuando el hash no sirve", async () => {
    const { dom, router } = await montar("#/inicio");
    dom.window.history.replaceState(null, "", "#/basura");
    assert.equal(router.rutaActual(), null);
  });

  test("el titulo de la pagina acompana a la vista", async () => {
    const { dom, router } = await montar("#/inicio");
    router.navegar("inversiones");
    await esperarVista(dom, "inversiones");
    assert.match(dom.window.document.title, /Cartera/);
  });

  test("al cambiar de vista se vuelve arriba", async () => {
    // Sin esto, entrar a una sección desde el final de una lista larga
    // la abre por la mitad.
    const { dom, router } = await montar("#/inicio");
    let pedido = null;
    dom.window.scrollTo = (arg) => {
      pedido = arg;
    };
    router.navegar("historial");
    await esperarVista(dom, "historial");
    assert.equal(pedido?.top, 0);
    assert.equal(
      pedido?.behavior,
      "instant",
      "suave, un desplazamiento de miles de píxeles parece que la app se colgó",
    );
  });

  test("la navegacion no recarga la pagina", async () => {
    // Criterio de aceptación. Una recarga perdería el estado en memoria
    // y volvería a pedir todo a la API.
    const { dom, router } = await montar("#/inicio");
    let recargo = false;
    dom.window.addEventListener("beforeunload", () => {
      recargo = true;
    });
    router.navegar("movimientos");
    await esperarVista(dom, "movimientos");
    assert.equal(recargo, false);
  });

  test("las rutas del enrutador son las siete de nav.js", async () => {
    // Si se agregara una sección a nav.js y no al enrutador, su
    // posición en la barra llevaría a inicio sin que nada avise.
    const nav = readFileSync(
      resolve(RAIZ, "web", "src", "js", "nav.js"),
      "utf8",
    );
    const ids = [...nav.matchAll(/id:\s*"([\w-]+)"/g)].map((m) => m[1]);
    assert.deepEqual(ids, SECCIONES);

    for (const id of ids) {
      const { dom } = await montar(`#/${id}`);
      assert.equal(activa(dom), id);
    }
  });
});
