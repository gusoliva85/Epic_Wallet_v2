/* Pruebas de las filas de lista · F01-T10

   Los tres criterios de aceptación son de comportamiento: el signo y
   el color de cada tipo, la barra que se anima al aparecer y que la
   fila sea un botón alcanzable con el tabulador. Con jsdom se verifica
   lo que se pinta de verdad, no lo que dice el código fuente. */

import { test, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..");

/** Signo menos tipográfico. */
const MENOS = "−";

function modulo(ruta) {
  return (
    "file:///" +
    resolve(RAIZ, "web", "src", "js", ...ruta).replace(/\\/g, "/") +
    `?t=${Math.random()}`
  );
}

async function montar() {
  const dom = new JSDOM(
    `<!doctype html><html><body><div class="rows" id="lista"></div></body></html>`,
    {
      url: "https://epic-wallet-v2.vercel.app/",
      // Para que un <img onerror> inyectado SÍ pueda correr: si jsdom
      // no ejecutara nada, la prueba del escape pasaría sola.
      runScripts: "dangerously",
      pretendToBeVisual: true,
    },
  );

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.requestAnimationFrame = (fn) =>
    dom.window.requestAnimationFrame(fn);

  const rows = await import(modulo(["components", "rows.js"]));
  return { dom, rows, lista: dom.window.document.getElementById("lista") };
}

function esperar(dom, ms = 40) {
  return new Promise((listo) => dom.window.setTimeout(listo, ms));
}

const MOV = {
  id: 7,
  tipo: "egreso",
  categoria: "Supermercado",
  importe: "$48.300",
  fecha: "04/10/2026",
  descripcion: "Compra semanal",
  origen: "manual",
};

describe("filas de lista", () => {
  beforeEach(() => {
    for (const k of ["window", "document", "requestAnimationFrame"])
      delete globalThis[k];
  });

  // ------------------------------------------- el signo y el color

  test("un ingreso va en verde con mas", async () => {
    // Criterio de aceptación.
    const { rows, lista } = await montar();
    rows.pintarFilas(lista, [
      rows.filaMovimiento({ ...MOV, tipo: "ingreso", importe: "$2.050.000" }),
    ]);
    const importe = lista.querySelector(".row-val b");
    assert.ok(
      importe.classList.contains("amt-in"),
      "le falta la clase de ingreso",
    );
    assert.ok(importe.textContent.startsWith("+"), importe.textContent);
  });

  test("un egreso va en rojo con el menos tipografico", async () => {
    // Criterio de aceptación. El menos es U+2212, no el guión del
    // teclado: el guión es más corto y a otra altura, y al lado de un
    // `+` en una columna de cifras se nota.
    const { rows, lista } = await montar();
    rows.pintarFilas(lista, [rows.filaMovimiento(MOV)]);
    const importe = lista.querySelector(".row-val b");
    assert.ok(importe.classList.contains("amt-out"));
    assert.ok(importe.textContent.startsWith(MENOS), importe.textContent);
    assert.ok(
      !importe.textContent.includes("-"),
      "usó el guión en vez del menos",
    );
  });

  test("el color no es el unico que dice si entra o sale", async () => {
    // Regla del sistema. Sin el signo y la flecha, un ingreso y un
    // egreso se confunden para quien no distingue el verde del rojo.
    const { rows, lista } = await montar();
    rows.pintarFilas(lista, [
      rows.filaMovimiento({ ...MOV, tipo: "ingreso" }),
      rows.filaMovimiento({ ...MOV, tipo: "egreso" }),
    ]);
    const [entra, sale] = [...lista.querySelectorAll(".row")];

    // Signo distinto.
    assert.notEqual(
      entra.querySelector(".row-val b").textContent[0],
      sale.querySelector(".row-val b").textContent[0],
    );
    // Y flecha distinta.
    assert.notEqual(
      entra.querySelector(".row-ico svg").innerHTML,
      sale.querySelector(".row-ico svg").innerHTML,
      "las dos direcciones usan el mismo icono",
    );
  });

  test("el tipo decide el signo, no el valor del importe", async () => {
    // El frontend no hace aritmética: el importe llega formateado y
    // sin signo. Si el signo saliera del texto, un importe que ya
    // trajera un menos saldría con dos.
    const { rows, lista } = await montar();
    rows.pintarFilas(lista, [
      rows.filaMovimiento({ ...MOV, tipo: "ingreso", importe: "$1" }),
    ]);
    assert.equal(lista.querySelector(".row-val b").textContent, "+$1");
  });

  // --------------------------------------------- accesible por teclado

  test("la fila es un boton y se alcanza con el tabulador", async () => {
    // Criterio de aceptación. Un div con onclick no se alcanza ni lo
    // anuncia el lector.
    const { rows, lista } = await montar();
    rows.pintarFilas(lista, [rows.filaMovimiento(MOV)]);
    const fila = lista.querySelector(".row");
    assert.equal(fila.tagName, "BUTTON");
    assert.equal(fila.getAttribute("type"), "button");
    assert.ok(fila.tabIndex >= 0, "no entra en el orden de tabulación");
    fila.focus();
    assert.equal(lista.ownerDocument.activeElement, fila);
  });

  test("la fila dice de que movimiento es", async () => {
    const { rows, lista } = await montar();
    rows.pintarFilas(lista, [rows.filaMovimiento(MOV)]);
    assert.equal(lista.querySelector(".row").dataset.movimiento, "7");
  });

  test("la flecha y las iniciales no las lee el lector", async () => {
    // La flecha repite el signo del importe y las iniciales repiten el
    // nombre de al lado: sin ocultarlas, el lector dice «AL Alquiler».
    const { rows, lista } = await montar();
    rows.pintarFilas(lista, [
      rows.filaMovimiento(MOV),
      rows.filaCategoria({ id: "a", nombre: "Alquiler", total: "$1" }),
    ]);
    for (const m of lista.querySelectorAll(".row-ico")) {
      assert.equal(m.getAttribute("aria-hidden"), "true");
    }
  });

  test("la barra de participacion no la lee el lector", async () => {
    // El porcentaje ya está en el detalle de la fila.
    const { rows, lista } = await montar();
    rows.pintarFilas(lista, [
      rows.filaCategoria({
        id: "a",
        nombre: "Alquiler",
        total: "$1",
        participacion: 50,
      }),
    ]);
    assert.equal(
      lista.querySelector(".cat-track").getAttribute("aria-hidden"),
      "true",
    );
  });

  // ------------------------------------------------- fila de categoría

  test("la fila de categoria trae inicial, nombre, detalle, barra y total", async () => {
    const { rows, lista } = await montar();
    rows.pintarFilas(lista, [
      rows.filaCategoria({
        id: "supermercado",
        nombre: "Supermercado",
        total: "$193.200",
        detalle: "4 movimientos · 23,5% del gasto",
        participacion: 37.2,
        pie: "últ. 04/10",
      }),
    ]);
    const f = lista.querySelector(".row");
    assert.equal(f.querySelector(".row-ico").textContent, "SU");
    assert.equal(f.querySelector(".row-main b").textContent, "Supermercado");
    assert.match(
      f.querySelector(".row-main > span").textContent,
      /4 movimientos/,
    );
    assert.ok(f.querySelector(".cat-track .cat-fill"));
    assert.equal(f.querySelector(".row-val b").textContent, "$193.200");
    assert.equal(f.dataset.categoria, "supermercado");
  });

  test("la inicial son dos letras en mayuscula", async () => {
    const { rows } = await montar();
    assert.equal(rows.inicial("Supermercado"), "SU");
    assert.equal(rows.inicial("ñandú"), "ÑA");
    assert.equal(rows.inicial("  Ocio  "), "OC");
    assert.equal(rows.inicial("A"), "A");
    assert.equal(rows.inicial(""), "");
    assert.equal(rows.inicial(null), "", "un nombre nulo no escribe null");
  });

  // ------------------------------------------------- la barra se anima

  test("la barra nace en cero y crece al frame siguiente", async () => {
    // Criterio de aceptación: la barra se anima al aparecer. Puesta
    // directo en su ancho, la transición no tiene de dónde partir.
    const { dom, rows, lista } = await montar();
    rows.pintarFilas(lista, [
      rows.filaCategoria({
        id: "a",
        nombre: "Alquiler",
        total: "$1",
        participacion: 63.4,
      }),
    ]);
    const barra = lista.querySelector(".cat-fill");
    assert.equal(
      barra.style.width,
      "",
      "la barra no tiene que nacer con ancho",
    );
    await esperar(dom);
    assert.equal(barra.style.width, "63.4%");
  });

  test("una participacion fuera de rango se recorta", async () => {
    const { dom, rows, lista } = await montar();
    for (const [pedido, esperado] of [
      [-10, "0%"],
      [180, "100%"],
      ["no", "0%"],
    ]) {
      rows.pintarFilas(lista, [
        rows.filaCategoria({
          id: "a",
          nombre: "x",
          total: "$1",
          participacion: pedido,
        }),
      ]);
      await esperar(dom);
      assert.equal(lista.querySelector(".cat-fill").style.width, esperado);
    }
  });

  test("todas las barras de la lista se animan, no solo la primera", async () => {
    const { dom, rows, lista } = await montar();
    rows.pintarFilas(
      lista,
      [40, 70, 100].map((p, i) =>
        rows.filaCategoria({
          id: i,
          nombre: "x",
          total: "$1",
          participacion: p,
        }),
      ),
    );
    await esperar(dom);
    const anchos = [...lista.querySelectorAll(".cat-fill")].map(
      (b) => b.style.width,
    );
    assert.deepEqual(anchos, ["40%", "70%", "100%"]);
  });

  // ----------------------------------------------------------- el escape

  test("la categoria y la descripcion se escapan", async () => {
    const { dom, rows, lista } = await montar();
    dom.window.ejecuto = false;
    rows.pintarFilas(lista, [
      rows.filaMovimiento({
        ...MOV,
        categoria: '<img src=x onerror="window.ejecuto = true">',
        descripcion: '<img src=y onerror="window.ejecuto = true">',
      }),
    ]);
    await esperar(dom);
    assert.equal(dom.window.ejecuto, false);
    assert.equal(lista.querySelectorAll("img").length, 0);
  });

  test("el importe, el origen y la fecha se escapan", async () => {
    const { dom, rows, lista } = await montar();
    dom.window.ejecuto = false;
    rows.pintarFilas(lista, [
      rows.filaMovimiento({
        ...MOV,
        importe: '<img src=x onerror="window.ejecuto = true">',
        fecha: '<img src=y onerror="window.ejecuto = true">',
        origen: '<img src=z onerror="window.ejecuto = true">',
      }),
    ]);
    await esperar(dom);
    assert.equal(dom.window.ejecuto, false);
    assert.equal(lista.querySelectorAll("img").length, 0);
  });

  test("el id se escapa: va dentro de un atributo", async () => {
    // Sin escapar, un id con una comilla cierra el atributo y permite
    // meter otro, como un onclick.
    const { dom, rows, lista } = await montar();
    dom.window.ejecuto = false;
    rows.pintarFilas(lista, [
      rows.filaMovimiento({
        ...MOV,
        id: '1" onmouseover="window.ejecuto=true',
      }),
    ]);
    const fila = lista.querySelector(".row");
    assert.equal(
      fila.getAttribute("onmouseover"),
      null,
      "entró un atributo ajeno",
    );
    assert.equal(dom.window.ejecuto, false);
  });

  test("todos los campos de la fila de categoria se escapan", async () => {
    const { dom, rows, lista } = await montar();
    dom.window.ejecuto = false;
    const veneno = '<img src=x onerror="window.ejecuto = true">';
    rows.pintarFilas(lista, [
      rows.filaCategoria({
        id: veneno,
        nombre: veneno,
        total: veneno,
        detalle: veneno,
        pie: veneno,
      }),
    ]);
    await esperar(dom);
    assert.equal(dom.window.ejecuto, false);
    assert.equal(lista.querySelectorAll("img").length, 0);
  });

  test("el separador de dia se escapa", async () => {
    const { dom, rows, lista } = await montar();
    dom.window.ejecuto = false;
    rows.pintarFilas(lista, [
      rows.separadorDia('<img src=x onerror="window.ejecuto = true">'),
    ]);
    await esperar(dom);
    assert.equal(dom.window.ejecuto, false);
    assert.equal(lista.querySelectorAll("img").length, 0);
  });

  // ------------------------------------------------------- lo de inicio

  test("las filas de muestra de inicio se pintan todas", async () => {
    const { dom, lista } = await montar();
    lista.id = "movimientos-inicio";
    const otra = dom.window.document.createElement("div");
    otra.id = "categorias-inicio";
    dom.window.document.body.append(otra);

    const vistas = await import(modulo(["views", "vistas.js"]));
    vistas.pintarVistas();
    await esperar(dom);

    // Las cantidades salen de los datos, no escritas a mano: así
    // cambiar la muestra no obliga a tocar la prueba.
    const datos = await import(modulo(["datos-muestra.js"]));
    const enInicio = datos.MOVIMIENTOS.slice(0, 5);
    const dias = new Set(enInicio.map((m) => m.dia)).size;

    assert.equal(lista.querySelectorAll(".row").length, enInicio.length);
    assert.equal(
      lista.querySelectorAll(".day-sep").length,
      dias,
      "un separador por día",
    );
    assert.equal(otra.querySelectorAll(".row").length, datos.CATEGORIAS.length);
  });

  test("la muestra de inicio trae ingresos y egresos", async () => {
    // Si fueran todos del mismo tipo, en el teléfono no se vería la
    // diferencia de signo y color que esta tarea tenía que resolver.
    const { dom, lista } = await montar();
    lista.id = "movimientos-inicio";
    const otra = dom.window.document.createElement("div");
    otra.id = "categorias-inicio";
    dom.window.document.body.append(otra);

    const vistas = await import(modulo(["views", "vistas.js"]));
    vistas.pintarVistas();
    await esperar(dom);

    assert.ok(lista.querySelector(".amt-in"), "falta un ingreso en la muestra");
    assert.ok(lista.querySelector(".amt-out"), "falta un egreso en la muestra");
  });
});
