/* Pruebas de la barra de mes · F01-T08
   Con jsdom, por el mismo motivo que el enrutador: lo que hay que
   verificar es comportamiento —qué botón queda apagado en qué mes— y
   leer el código fuente no lo verifica.

   Lo que más importa acá es la regla del documento general §12.1: «no
   debe permitirse seleccionar un mes futuro que todavía no existe». */

import { test, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..");
const INDEX = resolve(RAIZ, "web", "index.html");

/** El mes de hoy en hora argentina, calculado igual que el módulo. */
function hoy() {
  const [anio, mes] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
  })
    .format(new Date())
    .split("-")
    .map(Number);
  return { anio, mes };
}

/** Monta la barra de mes tal como está en index.html.
    Se recorta del HTML de verdad y no se escribe otra vez acá: si
    alguien cambia un id en el HTML, la prueba tiene que fallar. */
async function montar() {
  const html = readFileSync(INDEX, "utf8");
  const desde = html.indexOf('<section class="monthbar');
  const hasta = html.indexOf("</section>", desde) + "</section>".length;
  assert.ok(desde > 0, "no se encontró la barra de mes en index.html");

  const dom = new JSDOM(
    `<!doctype html><html><body>${html.slice(desde, hasta)}</body></html>`,
    { url: "https://epic-wallet-v2.vercel.app/" },
  );

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;

  const url =
    "file:///" +
    resolve(RAIZ, "web", "src", "js", "barra-mes.js").replace(/\\/g, "/") +
    `?t=${Math.random()}`;
  const mod = await import(url);

  const $ = (id) => dom.window.document.getElementById(id);
  return {
    dom,
    mod,
    titulo: $("mes-titulo"),
    estado: $("mes-estado"),
    anterior: $("mes-anterior"),
    siguiente: $("mes-siguiente"),
    hoy: $("mes-hoy"),
  };
}

describe("barra de mes", () => {
  beforeEach(() => {
    for (const k of ["window", "document"]) delete globalThis[k];
  });

  test("arranca en el mes de hoy", async () => {
    const b = await montar();
    assert.equal(b.titulo.textContent, b.mod.nombre(hoy()));
  });

  test("el titulo no es un texto fijo", async () => {
    // Escrito a mano, sería mentira el mes que viene.
    const b = await montar();
    // Sin quitar los comentarios, la prueba encuentra el ejemplo que
    // da la explicación del propio módulo y falla sin motivo.
    const fuente = readFileSync(
      resolve(RAIZ, "web", "src", "js", "barra-mes.js"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    assert.ok(
      !/Octubre 20\d\d|Noviembre 20\d\d/.test(fuente),
      "el nombre del mes está escrito a mano en el código",
    );
    assert.match(b.titulo.textContent, /^[A-ZÁÉÍÓÚ]\p{Letter}+ \d{4}$/u);
  });

  test("el mes se escribe con mayuscula y sin el de", async () => {
    const { mod } = await montar();
    assert.equal(mod.nombre({ anio: 2026, mes: 10 }), "Octubre 2026");
    assert.equal(mod.nombre({ anio: 2026, mes: 1 }), "Enero 2026");
  });

  // ------------------------------------------------ la regla del futuro

  test("en el mes actual la flecha de siguiente esta apagada", async () => {
    // Regla del documento general §12.1: no hay meses futuros. Y
    // apagada de verdad, no muda: un botón que se ve activo y no
    // responde parece que la aplicación se colgó.
    const b = await montar();
    assert.equal(b.siguiente.disabled, true);
  });

  test("en el mes actual el boton Hoy esta apagado", async () => {
    const b = await montar();
    assert.equal(b.hoy.disabled, true, "ya estamos en el mes actual");
  });

  test("al retroceder se encienden siguiente y Hoy", async () => {
    const b = await montar();
    b.anterior.click();
    assert.equal(b.siguiente.disabled, false);
    assert.equal(b.hoy.disabled, false);
  });

  test("no se puede pasar del mes actual ni a los golpes", async () => {
    const b = await montar();
    b.anterior.click();
    b.siguiente.click();
    const antes = b.titulo.textContent;
    // La flecha ya está apagada; el click no debería llegar, pero si
    // alguien la enciende por error, el tope sigue valiendo.
    b.siguiente.disabled = false;
    b.siguiente.click();
    assert.equal(b.titulo.textContent, antes, "se pasó a un mes futuro");
    assert.equal(b.titulo.textContent, b.mod.nombre(hoy()));
  });

  // ---------------------------------------------------- mover de mes

  test("retroceder cambia el titulo al mes anterior", async () => {
    const b = await montar();
    const h = hoy();
    const esperado =
      h.mes === 1 ? { anio: h.anio - 1, mes: 12 } : { ...h, mes: h.mes - 1 };
    b.anterior.click();
    assert.equal(b.titulo.textContent, b.mod.nombre(esperado));
  });

  test("retroceder en enero cruza al diciembre anterior", async () => {
    const { mod } = await montar();
    // El cálculo se verifica por índice, que es lo que decide los topes.
    assert.equal(
      mod.indice({ anio: 2026, mes: 1 }) - 1,
      mod.indice({ anio: 2025, mes: 12 }),
    );
  });

  test("Hoy vuelve al mes actual desde donde sea", async () => {
    const b = await montar();
    for (let i = 0; i < 7; i++) b.anterior.click();
    assert.notEqual(b.titulo.textContent, b.mod.nombre(hoy()));
    b.hoy.click();
    assert.equal(b.titulo.textContent, b.mod.nombre(hoy()));
    assert.equal(b.hoy.disabled, true, "de vuelta en el mes actual, se apaga");
  });

  test("hay un tope para atras", async () => {
    // Sin tope se retrocede para siempre a meses que no existen.
    const b = await montar();
    for (let i = 0; i < 200; i++) b.anterior.click();
    assert.equal(b.anterior.disabled, true);
    assert.equal(b.titulo.textContent, b.mod.nombre(b.mod.PRIMER_MES));
  });

  // -------------------------------------------------------- el estado

  test("el mes actual se anuncia transaccional", async () => {
    const b = await montar();
    assert.match(b.estado.textContent, /abierto/i);
    // El texto es corto a propósito: «Mes abierto · transaccional» se
    // corta en la barra de un teléfono de 390 px.
    assert.ok(
      b.estado.textContent.length <= 18,
      `el subtítulo tiene ${b.estado.textContent.length} caracteres y se va a cortar`,
    );
  });

  test("un mes anterior se anuncia consolidado", async () => {
    // Regla 4: en un mes histórico no hay movimientos que listar, y la
    // pantalla cambia por eso.
    const b = await montar();
    b.anterior.click();
    assert.match(b.estado.textContent, /consolidado/i);
  });

  test("el cambio de mes se anuncia al lector de pantalla", async () => {
    const b = await montar();
    const vivo = b.titulo.closest("[aria-live]");
    assert.ok(vivo, "el título tiene que estar en una región aria-live");
    assert.equal(vivo.getAttribute("aria-live"), "polite");
  });

  test("las flechas de solo icono tienen nombre", async () => {
    const b = await montar();
    for (const boton of [b.anterior, b.siguiente]) {
      assert.ok(
        boton.getAttribute("aria-label"),
        "una flecha sin aria-label no dice nada al lector",
      );
    }
  });
});
