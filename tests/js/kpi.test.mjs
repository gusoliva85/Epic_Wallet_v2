/* Pruebas de las tarjetas de indicador · F01-T09

   El criterio que importa más es de comportamiento y no de texto: «un
   dato con <script> se muestra como texto y no ejecuta nada». Eso sólo
   se verifica insertando el HTML en un documento de verdad y mirando
   si el script corrió. Una prueba que busque `esc(` en el código no
   sirve: `esc` puede estar llamado y mal. */

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
    `<!doctype html><html><body><div class="kpi-grid stagger" id="rejilla"></div></body></html>`,
    {
      url: "https://epic-wallet-v2.vercel.app/",
      // runScripts: para que un <script> inyectado SÍ pueda ejecutarse.
      // Sin esto, la prueba del escape pasaría porque jsdom no corre
      // scripts, no porque el escape funcione.
      runScripts: "dangerously",
      // pretendToBeVisual: trae requestAnimationFrame.
      pretendToBeVisual: true,
    },
  );

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  // El módulo lo usa sin prefijo, como cualquier código de navegador:
  // ahí `window` y el global son lo mismo, y acá hay que darlo aparte.
  globalThis.requestAnimationFrame = (fn) =>
    dom.window.requestAnimationFrame(fn);

  const kpi = await import(modulo(["components", "kpi.js"]));
  const { esc } = await import(modulo(["format.js"]));
  return {
    dom,
    kpi,
    esc,
    rejilla: dom.window.document.getElementById("rejilla"),
  };
}

function esperar(dom, ms = 40) {
  return new Promise((listo) => dom.window.setTimeout(listo, ms));
}

describe("tarjetas de indicador", () => {
  beforeEach(() => {
    for (const k of ["window", "document", "requestAnimationFrame"])
      delete globalThis[k];
  });

  // ------------------------------------------------------- el escape

  test("un dato con script se muestra como texto y no ejecuta nada", async () => {
    // Criterio de aceptación de la tarea.
    const { dom, kpi, rejilla } = await montar();
    dom.window.ejecuto = false;

    kpi.pintarTarjetas(rejilla, [
      kpi.tarjetaMetrica({
        etiqueta: "<script>window.ejecuto = true</script>",
        cifra: "$1",
        sub: "x",
      }),
    ]);
    await esperar(dom);

    assert.equal(dom.window.ejecuto, false, "el script se ejecutó");
    assert.equal(
      rejilla.querySelectorAll("script").length,
      0,
      "entró una etiqueta script en el documento",
    );
    assert.match(
      rejilla.querySelector(".kpi-label").textContent,
      /<script>/,
      "el dato tiene que verse como texto",
    );
  });

  test("el subtitulo tambien se escapa", async () => {
    // El ejemplo del documento técnico §12.4 escapa `label` y `value`
    // pero NO `sub`. Un subtítulo puede traer el nombre de una
    // categoría que escribió el usuario.
    const { dom, kpi, rejilla } = await montar();
    dom.window.ejecuto = false;
    kpi.pintarTarjetas(rejilla, [
      kpi.tarjetaMetrica({
        etiqueta: "Egresos",
        cifra: "$1",
        sub: '<img src=x onerror="window.ejecuto = true">',
      }),
    ]);
    await esperar(dom);
    assert.equal(dom.window.ejecuto, false);
    assert.equal(rejilla.querySelectorAll("img").length, 0);
  });

  test("la cifra tambien se escapa", async () => {
    // La cifra viene formateada del backend. Es un string como
    // cualquier otro: si no se escapa, es una puerta igual que el
    // subtítulo.
    const { dom, kpi, rejilla } = await montar();
    dom.window.ejecuto = false;
    kpi.pintarTarjetas(rejilla, [
      kpi.tarjetaMetrica({
        etiqueta: "Egresos",
        cifra: '<img src=x onerror="window.ejecuto = true">',
      }),
    ]);
    await esperar(dom);
    assert.equal(dom.window.ejecuto, false);
    assert.equal(rejilla.querySelectorAll("img").length, 0);
  });

  test("la etiqueta de la tarjeta heroe tambien se escapa", async () => {
    const { dom, kpi, rejilla } = await montar();
    dom.window.ejecuto = false;
    kpi.pintarTarjetas(rejilla, [
      kpi.tarjetaHeroe({
        etiqueta: '<img src=x onerror="window.ejecuto = true">',
        cifra: '<img src=y onerror="window.ejecuto = true">',
        sub: '<img src=z onerror="window.ejecuto = true">',
      }),
    ]);
    await esperar(dom);
    assert.equal(dom.window.ejecuto, false);
    assert.equal(rejilla.querySelectorAll("img").length, 0);
  });

  test("el pie de la tarjeta heroe tambien se escapa", async () => {
    const { dom, kpi, rejilla } = await montar();
    dom.window.ejecuto = false;
    kpi.pintarTarjetas(rejilla, [
      kpi.tarjetaHeroe({
        etiqueta: "Ahorro",
        cifra: "$1",
        pieIzq: '<img src=x onerror="window.ejecuto = true">',
        pieDer: '<img src=y onerror="window.ejecuto = true">',
      }),
    ]);
    await esperar(dom);
    assert.equal(dom.window.ejecuto, false);
    assert.equal(rejilla.querySelectorAll("img").length, 0);
  });

  test("una comilla no rompe el atributo de al lado", async () => {
    // Escapando sólo &<> el texto entre etiquetas queda bien, pero una
    // comilla dentro de un atributo lo cierra y abre otro.
    const { esc } = await montar();
    assert.equal(esc('a"b'), "a&quot;b");
    assert.equal(esc("a'b"), "a&#39;b");
  });

  test("el cero no desaparece", async () => {
    // Con `|| ""` en lugar de `?? ""`, un importe de 0 se convierte en
    // cadena vacía. En finanzas, un 0 que desaparece es un error
    // difícil de ver.
    const { esc } = await montar();
    assert.equal(esc(0), "0");
    assert.equal(esc(null), "");
    assert.equal(esc(undefined), "");
  });

  // ------------------------------------------------------ las variantes

  test("la tarjeta de metrica trae etiqueta, cifra, subtitulo e icono", async () => {
    const { kpi, rejilla } = await montar();
    kpi.pintarTarjetas(rejilla, [
      kpi.tarjetaMetrica({
        etiqueta: "Ingresos",
        cifra: "$2.105.000",
        sub: "4 movimientos",
        color: "inc",
        icono: "sube",
      }),
    ]);
    const t = rejilla.querySelector(".kpi");
    assert.equal(t.querySelector(".kpi-label").textContent, "Ingresos");
    assert.equal(t.querySelector(".kpi-num").textContent, "$2.105.000");
    assert.equal(t.querySelector(".kpi-sub").textContent, "4 movimientos");
    assert.ok(t.querySelector(".kpi-ico svg path"), "falta el icono");
  });

  test("la tarjeta heroe trae barra y pie de dos datos", async () => {
    const { kpi, rejilla } = await montar();
    kpi.pintarTarjetas(rejilla, [
      kpi.tarjetaHeroe({
        etiqueta: "Ahorro del mes",
        cifra: "$1.284.300",
        porcentaje: 61,
        pieIzq: "Ingresos",
        pieDer: "Egresos",
      }),
    ]);
    const t = rejilla.querySelector(".kpi--hero");
    assert.ok(t, "falta la variante héroe");
    assert.ok(t.querySelector(".fin-track .fin-fill"), "falta la barra");
    assert.equal(t.querySelectorAll(".fin-foot span").length, 2);
  });

  test("la cifra lleva ancho fijo", async () => {
    // Sin `num`, al actualizarse un importe las cifras cambian de ancho
    // y la tarjeta entera se mueve.
    const { kpi, rejilla } = await montar();
    kpi.pintarTarjetas(rejilla, [
      kpi.tarjetaMetrica({ etiqueta: "x", cifra: "$1" }),
    ]);
    assert.ok(rejilla.querySelector(".kpi-num.num"));
  });

  test("el icono decorativo no lo lee el lector", async () => {
    const { kpi, rejilla } = await montar();
    kpi.pintarTarjetas(rejilla, [
      kpi.tarjetaMetrica({ etiqueta: "x", cifra: "$1", icono: "sube" }),
    ]);
    assert.equal(
      rejilla.querySelector(".kpi-ico").getAttribute("aria-hidden"),
      "true",
    );
  });

  test("la barra de progreso no la lee el lector", async () => {
    // La cifra de arriba ya dice el valor; un progreso anunciado aparte
    // no agrega nada.
    const { kpi, rejilla } = await montar();
    kpi.pintarTarjetas(rejilla, [
      kpi.tarjetaHeroe({ etiqueta: "x", cifra: "$1", porcentaje: 50 }),
    ]);
    assert.equal(
      rejilla.querySelector(".fin-track").getAttribute("aria-hidden"),
      "true",
    );
  });

  test("una tarjeta sin icono no deja el hueco", async () => {
    const { kpi, rejilla } = await montar();
    kpi.pintarTarjetas(rejilla, [
      kpi.tarjetaMetrica({ etiqueta: "x", cifra: "$1" }),
    ]);
    assert.equal(rejilla.querySelector(".kpi-ico"), null);
  });

  test("un icono que no existe no escribe undefined", async () => {
    const { kpi, rejilla } = await montar();
    kpi.pintarTarjetas(rejilla, [
      kpi.tarjetaMetrica({ etiqueta: "x", cifra: "$1", icono: "no-existe" }),
    ]);
    assert.ok(!rejilla.innerHTML.includes("undefined"));
  });

  // --------------------------------------------------------- el color

  test("el color sale de una lista cerrada", async () => {
    // El valor termina dentro de un atributo `style` y la política de
    // contenido admite estilos en línea: con un color libre, un dato
    // del servidor podría inyectar CSS.
    const { kpi, rejilla } = await montar();
    kpi.pintarTarjetas(rejilla, [
      kpi.tarjetaMetrica({
        etiqueta: "x",
        cifra: "$1",
        color: "red; background:url(http://malo/)",
      }),
    ]);
    const estilo = rejilla.querySelector(".kpi").getAttribute("style");
    assert.ok(!estilo.includes("malo"), `entró CSS ajeno: ${estilo}`);
    assert.match(
      estilo,
      /var\(--color-accent\)/,
      "un color inválido cae en el acento",
    );
  });

  test("los colores validos se resuelven a un token", async () => {
    const { kpi, rejilla } = await montar();
    for (const c of kpi.COLORES_VALIDOS) {
      kpi.pintarTarjetas(rejilla, [
        kpi.tarjetaMetrica({ etiqueta: "x", cifra: "$1", color: c }),
      ]);
      const estilo = rejilla.querySelector(".kpi").getAttribute("style");
      assert.match(
        estilo,
        /^--c: ?var\(--color-[\w-]+\)$/,
        `color ${c}: ${estilo}`,
      );
    }
  });

  // ------------------------------------------------------- la barra crece

  test("la barra nace en cero y crece al frame siguiente", async () => {
    // Puesta directo en su ancho, la transición no tiene de dónde
    // partir y la barra aparece ya llena.
    const { dom, kpi, rejilla } = await montar();
    kpi.pintarTarjetas(rejilla, [
      kpi.tarjetaHeroe({ etiqueta: "x", cifra: "$1", porcentaje: 61 }),
    ]);
    const barra = rejilla.querySelector(".fin-fill");
    assert.equal(
      barra.style.width,
      "",
      "la barra no tiene que nacer con ancho",
    );
    await esperar(dom);
    assert.equal(barra.style.width, "61%");
  });

  test("un porcentaje fuera de rango se recorta", async () => {
    // Un ahorro negativo daría una barra de ancho negativo y un 140 %
    // desbordaría el surco.
    const { dom, kpi, rejilla } = await montar();
    for (const [pedido, esperado] of [
      [-30, "0%"],
      [140, "100%"],
      [61.5, "61.5%"],
    ]) {
      kpi.pintarTarjetas(rejilla, [
        kpi.tarjetaHeroe({ etiqueta: "x", cifra: "$1", porcentaje: pedido }),
      ]);
      await esperar(dom);
      assert.equal(rejilla.querySelector(".fin-fill").style.width, esperado);
    }
  });

  test("un porcentaje que no es numero no rompe la barra", async () => {
    const { dom, kpi, rejilla } = await montar();
    kpi.pintarTarjetas(rejilla, [
      kpi.tarjetaHeroe({ etiqueta: "x", cifra: "$1", porcentaje: "no" }),
    ]);
    await esperar(dom);
    assert.equal(rejilla.querySelector(".fin-fill").style.width, "0%");
  });

  // ------------------------------------------------------- la muestra

  test("las tarjetas de muestra de inicio se pintan todas", async () => {
    const { dom, rejilla } = await montar();
    rejilla.id = "kpis-inicio";
    const { MUESTRA } = await import(modulo(["views", "inicio.js"]));
    await esperar(dom);
    assert.equal(MUESTRA.length, 5, "una héroe y cuatro métricas");
    assert.equal(rejilla.querySelectorAll(".kpi").length, 5);
    assert.equal(rejilla.querySelectorAll(".kpi--hero").length, 1);
  });

  // --------------------------------- las cuatro métricas identificables

  async function inicio() {
    const b = await montar();
    b.rejilla.id = "kpis-inicio";
    await import(modulo(["views", "inicio.js"]));
    await esperar(b.dom);
    return b;
  }

  test("las cuatro metricas son las que quedaron", async () => {
    // Se sacan «tasa de ahorro» y «cartera», que no decían nada, y
    // «gasto diario» pasa a ser el gasto de HOY: un promedio del mes no
    // sirve para decidir hoy.
    const { rejilla } = await inicio();
    const etiquetas = [
      ...rejilla.querySelectorAll(".kpi-metric .kpi-label"),
    ].map((e) => e.textContent);
    assert.deepEqual(etiquetas, [
      "Ingresos",
      "Egresos",
      "Gasto de hoy",
      "Patrimonio",
    ]);
  });

  test("las cuatro metricas estan tenidas y con silueta", async () => {
    const { rejilla } = await inicio();
    const metricas = [...rejilla.querySelectorAll(".kpi-metric")];
    assert.equal(metricas.length, 4);
    for (const t of metricas) {
      assert.ok(t.classList.contains("kpi-color"), "no se tiñó");
      const silueta = t.querySelector("svg.kpi-marca");
      assert.ok(silueta, "falta la silueta de fondo");
      assert.equal(silueta.getAttribute("aria-hidden"), "true");
      assert.ok(silueta.querySelector("path"), "la silueta vino vacía");
    }
  });

  test("cada metrica tiene su silueta y su color, sin repetir", async () => {
    // Con la misma silueta o el mismo color, el fondo dejaría de
    // identificarlas, que es para lo que está.
    const { rejilla } = await inicio();
    const metricas = [...rejilla.querySelectorAll(".kpi-metric")];
    const siluetas = metricas.map(
      (t) => t.querySelector(".kpi-marca").innerHTML,
    );
    const colores = metricas.map((t) => t.getAttribute("style"));
    assert.equal(new Set(siluetas).size, 4, "hay siluetas repetidas");
    assert.equal(new Set(colores).size, 4, "hay colores repetidos");
  });

  test("la silueta se pinta antes del texto", async () => {
    // Va primera en el DOM: pintada después, taparía la cifra.
    const { kpi, rejilla } = await montar();
    kpi.pintarTarjetas(rejilla, [
      kpi.tarjetaMetrica({
        etiqueta: "x",
        cifra: "$1",
        color: "inc",
        marca: "pesos-sube",
      }),
    ]);
    const hijos = [...rejilla.querySelector(".kpi").children];
    assert.ok(
      hijos[0].classList.contains("kpi-marca"),
      "la silueta no va primera",
    );
  });

  test("sin marca la tarjeta no se tine ni trae silueta", async () => {
    const { kpi, rejilla } = await montar();
    kpi.pintarTarjetas(rejilla, [
      kpi.tarjetaMetrica({ etiqueta: "x", cifra: "$1" }),
    ]);
    const t = rejilla.querySelector(".kpi");
    assert.ok(!t.classList.contains("kpi-color"));
    assert.equal(t.querySelector(".kpi-marca"), null);
  });

  test("una marca que no existe no tine la tarjeta", async () => {
    const { kpi, rejilla } = await montar();
    kpi.pintarTarjetas(rejilla, [
      kpi.tarjetaMetrica({ etiqueta: "x", cifra: "$1", marca: "no-existe" }),
    ]);
    const t = rejilla.querySelector(".kpi");
    assert.ok(
      !t.classList.contains("kpi-color"),
      "se tiñó con una silueta vacía",
    );
    assert.ok(!rejilla.innerHTML.includes("undefined"));
  });
});
