/* Pruebas de la barra de mes · F01-T08, conectada a la API desde F03-T10
   Con jsdom, por el mismo motivo que el enrutador: lo que hay que
   verificar es comportamiento —qué botón queda apagado en qué mes— y
   leer el código fuente no lo verifica.

   `cache-meses.js` se dobla con la técnica de `router.test.mjs`
   (reescribir la línea de `import` antes de cargar el módulo por una
   `data:` URL): así se prueba la barra sola, sin que haga falta un
   `fetch` real ni una cuenta de Supabase. Lo que SÍ es real es el
   contrato: la API manda los meses más nuevo primero (F03-T03), así
   que las listas de prueba están ordenadas así a propósito.

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

const EVENTO_INVALIDADO = "meses:invalidados";

const MESES_DE_PRUEBA = [
  { id: 3, year: 2026, month: 10, status: "open" },
  { id: 2, year: 2026, month: 9, status: "historical" },
  { id: 1, year: 2026, month: 8, status: "historical" },
];

/** La barra, recortada del `index.html` que se publica. Si alguien
 * cambia un id ahí, la prueba tiene que fallar. */
function htmlDeLaBarra() {
  const html = readFileSync(INDEX, "utf8");
  const desde = html.indexOf('<section class="monthbar');
  const hasta = html.indexOf("</section>", desde) + "</section>".length;
  assert.ok(desde > 0, "no se encontró la barra de mes en index.html");
  return html.slice(desde, hasta);
}

/** Carga `barra-mes.js` con `cache-meses.js` doblado por
 * `globalThis.__espia.meses`, sobre el DOM que ya esté montado en
 * `globalThis`. */
async function cargarModulo() {
  let codigo = readFileSync(resolve(RAIZ, "web", "src", "js", "barra-mes.js"), "utf8");
  codigo = codigo.replace(
    'import { meses, EVENTO_INVALIDADO } from "./cache-meses.js";',
    'const meses = (...a) => globalThis.__espia.meses(...a);\n' +
      `const EVENTO_INVALIDADO = "${EVENTO_INVALIDADO}";`,
  );

  const unico = `\n// ${Math.random()}\n`;
  const url = `data:text/javascript;base64,${Buffer.from(codigo + unico, "utf8").toString("base64")}`;
  return import(url);
}

function montarDom() {
  const dom = new JSDOM(
    `<!doctype html><html><body>${htmlDeLaBarra()}</body></html>`,
    { url: "https://epic-wallet-v2.vercel.app/" },
  );

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.CustomEvent = dom.window.CustomEvent;

  const $ = (id) => dom.window.document.getElementById(id);
  return {
    dom,
    titulo: $("mes-titulo"),
    estado: $("mes-estado"),
    anterior: $("mes-anterior"),
    siguiente: $("mes-siguiente"),
    hoy: $("mes-hoy"),
  };
}

/**
 * Monta la barra con `cache-meses.js` doblado.
 *
 * @param {object[]} lista los meses, más nuevo primero — como los
 *   manda la API de verdad.
 * @param {{falla?: boolean}} [opciones] `falla: true` simula que
 *   `meses()` rechaza, como una API caída o sin red.
 */
async function montar(lista, { falla = false } = {}) {
  const refs = montarDom();

  const llamadas = { meses: 0 };
  globalThis.__espia = {
    meses: async () => {
      llamadas.meses++;
      if (falla) throw new Error("sin red");
      return lista;
    },
  };

  const mod = await cargarModulo();
  return { ...refs, mod, llamadas };
}

/** Monta la barra con `meses()` devolviendo una promesa que el
 * llamador controla a mano — es la única forma de observar el estado
 * "todavía no respondió": con una función async normal, no hay forma
 * de garantizar que la prueba mire el DOM antes de que la promesa ya
 * se haya resuelto sola. */
async function montarConPromesaControlada() {
  const refs = montarDom();

  let resolver;
  const promesa = new Promise((listo) => {
    resolver = listo;
  });
  globalThis.__espia = { meses: () => promesa };

  const mod = await cargarModulo();
  return { ...refs, mod, resolver };
}

/** Espera a que la carga inicial termine: el título deja de ser «—». */
function esperarCarga(b, ms = 1000) {
  return new Promise((listo, falla) => {
    const limite = Date.now() + ms;
    const probar = () => {
      if (b.titulo.textContent !== "—") return listo();
      if (Date.now() > limite) return falla(new Error("la barra nunca terminó de cargar"));
      b.dom.window.setTimeout(probar, 5);
    };
    probar();
  });
}

/** Deja correr los eventos pendientes. Para cuando se verifica algo
    después de un await que no tiene una condición propia que esperar. */
function latir(b, ms = 60) {
  return new Promise((listo) => b.dom.window.setTimeout(listo, ms));
}

describe("barra de mes", () => {
  beforeEach(() => {
    for (const k of ["window", "document", "CustomEvent", "__espia"]) delete globalThis[k];
  });

  test("pide la lista de meses una sola vez al arrancar", async () => {
    const b = await montar(MESES_DE_PRUEBA);
    await esperarCarga(b);
    assert.equal(b.llamadas.meses, 1);
  });

  test("arranca mostrando el primero de la lista: el mes actual", async () => {
    const b = await montar(MESES_DE_PRUEBA);
    await esperarCarga(b);
    assert.equal(b.titulo.textContent, b.mod.nombre(MESES_DE_PRUEBA[0]));
  });

  test("el mes se escribe con mayuscula y sin el de", async () => {
    const b = await montar(MESES_DE_PRUEBA);
    assert.equal(b.mod.nombre({ year: 2026, month: 10 }), "Octubre 2026");
    assert.equal(b.mod.nombre({ year: 2026, month: 1 }), "Enero 2026");
  });

  test("mientras carga, las tres flechas quedan apagadas", async () => {
    // Antes de que la promesa de `meses()` resuelva: un botón que se
    // ve activo y no responde todavía parece que la aplicación se
    // colgó.
    const b = await montarConPromesaControlada();
    assert.equal(b.anterior.disabled, true);
    assert.equal(b.siguiente.disabled, true);
    assert.equal(b.hoy.disabled, true);

    // Y deja de estarlo una vez que la respuesta llega.
    b.resolver(MESES_DE_PRUEBA);
    await esperarCarga(b);
    assert.equal(b.siguiente.disabled, true, "en el mes actual, sigue apagada");
    assert.equal(b.anterior.disabled, false, "con más de un mes, ya se puede retroceder");
  });

  // ------------------------------------------------ la regla del futuro

  test("en el mes actual la flecha de siguiente esta apagada", async () => {
    const b = await montar(MESES_DE_PRUEBA);
    await esperarCarga(b);
    assert.equal(b.siguiente.disabled, true);
  });

  test("en el mes actual el boton Hoy esta apagado", async () => {
    const b = await montar(MESES_DE_PRUEBA);
    await esperarCarga(b);
    assert.equal(b.hoy.disabled, true, "ya estamos en el mes actual");
  });

  test("al retroceder se encienden siguiente y Hoy", async () => {
    const b = await montar(MESES_DE_PRUEBA);
    await esperarCarga(b);
    b.anterior.click();
    assert.equal(b.siguiente.disabled, false);
    assert.equal(b.hoy.disabled, false);
  });

  test("no se puede pasar del mes actual ni a los golpes", async () => {
    const b = await montar(MESES_DE_PRUEBA);
    await esperarCarga(b);
    b.anterior.click();
    b.siguiente.click();
    const antes = b.titulo.textContent;
    // La flecha ya está apagada; el click no debería llegar, pero si
    // alguien la enciende por error, el tope sigue valiendo.
    b.siguiente.disabled = false;
    b.siguiente.click();
    assert.equal(b.titulo.textContent, antes, "se pasó a un mes futuro");
    assert.equal(b.titulo.textContent, b.mod.nombre(MESES_DE_PRUEBA[0]));
  });

  // ---------------------------------------------------- mover de mes

  test("retroceder cambia el titulo al mes anterior de la lista", async () => {
    const b = await montar(MESES_DE_PRUEBA);
    await esperarCarga(b);
    b.anterior.click();
    assert.equal(b.titulo.textContent, b.mod.nombre(MESES_DE_PRUEBA[1]));
  });

  test("Hoy vuelve al mes actual desde donde sea", async () => {
    const b = await montar(MESES_DE_PRUEBA);
    await esperarCarga(b);
    b.anterior.click();
    b.anterior.click();
    assert.notEqual(b.titulo.textContent, b.mod.nombre(MESES_DE_PRUEBA[0]));
    b.hoy.click();
    assert.equal(b.titulo.textContent, b.mod.nombre(MESES_DE_PRUEBA[0]));
    assert.equal(b.hoy.disabled, true, "de vuelta en el mes actual, se apaga");
  });

  test("hay un tope para atras: el ultimo mes que mando la API", async () => {
    // Sin tope se retrocede más allá de lo que la API tiene.
    const b = await montar(MESES_DE_PRUEBA);
    await esperarCarga(b);
    for (let i = 0; i < 10; i++) b.anterior.click();
    assert.equal(b.anterior.disabled, true);
    assert.equal(
      b.titulo.textContent,
      b.mod.nombre(MESES_DE_PRUEBA[MESES_DE_PRUEBA.length - 1]),
    );
  });

  test("con un solo mes, las tres flechas de movimiento quedan apagadas", async () => {
    // Una cuenta nueva: `GET /api/months` sólo abrió el mes actual.
    const b = await montar([MESES_DE_PRUEBA[0]]);
    await esperarCarga(b);
    assert.equal(b.anterior.disabled, true);
    assert.equal(b.siguiente.disabled, true);
    assert.equal(b.hoy.disabled, true);
  });

  // -------------------------------------------------------- el estado

  test("el mes actual se anuncia abierto", async () => {
    const b = await montar(MESES_DE_PRUEBA);
    await esperarCarga(b);
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
    const b = await montar(MESES_DE_PRUEBA);
    await esperarCarga(b);
    b.anterior.click();
    assert.match(b.estado.textContent, /consolidado/i);
  });

  test("el cambio de mes se anuncia al lector de pantalla", async () => {
    const b = await montar(MESES_DE_PRUEBA);
    const vivo = b.titulo.closest("[aria-live]");
    assert.ok(vivo, "el título tiene que estar en una región aria-live");
    assert.equal(vivo.getAttribute("aria-live"), "polite");
  });

  test("las flechas de solo icono tienen nombre", async () => {
    const b = await montar(MESES_DE_PRUEBA);
    for (const boton of [b.anterior, b.siguiente]) {
      assert.ok(
        boton.getAttribute("aria-label"),
        "una flecha sin aria-label no dice nada al lector",
      );
    }
  });

  // -------------------------------------------------------- el caché

  test("volver a un mes ya visto no vuelve a pedir la lista", async () => {
    // Toda la lista llega en una sola llamada (F03-T05): moverse entre
    // meses ya conocidos no agrega pedidos nuevos.
    const b = await montar(MESES_DE_PRUEBA);
    await esperarCarga(b);
    b.anterior.click();
    b.siguiente.click();
    b.anterior.click();
    assert.equal(b.llamadas.meses, 1);
  });

  test("invalidar el caché hace que la barra vuelva a pedir la lista", async () => {
    // Criterio de aceptación: "después de dar de alta un movimiento el
    // mes se vuelve a pedir". Todavía no existe el alta de movimientos
    // (fase 4); se simula invalidando el caché directamente, que es lo
    // que esa fase va a hacer.
    const b = await montar(MESES_DE_PRUEBA);
    await esperarCarga(b);
    assert.equal(b.llamadas.meses, 1);

    b.dom.window.document.dispatchEvent(new b.dom.window.CustomEvent(EVENTO_INVALIDADO));
    await latir(b);
    assert.equal(b.llamadas.meses, 2);
  });

  test("después de invalidar, vuelve a mostrar el mes más nuevo", async () => {
    const b = await montar(MESES_DE_PRUEBA);
    await esperarCarga(b);
    b.anterior.click();
    assert.equal(b.titulo.textContent, b.mod.nombre(MESES_DE_PRUEBA[1]));

    b.dom.window.document.dispatchEvent(new b.dom.window.CustomEvent(EVENTO_INVALIDADO));
    await latir(b);
    assert.equal(b.titulo.textContent, b.mod.nombre(MESES_DE_PRUEBA[0]));
  });

  // -------------------------------------------------------- si la API falla

  test("si la API falla, no rompe y deja las flechas apagadas", async () => {
    const b = await montar([], { falla: true });
    await latir(b);
    assert.equal(b.titulo.textContent, "—");
    assert.equal(b.anterior.disabled, true);
    assert.equal(b.siguiente.disabled, true);
    assert.equal(b.hoy.disabled, true);
  });

  // ---------------------------------------------- mes:cambiado (F04-T12)

  test("avisa el mes actual al terminar de cargar", async () => {
    // `movimientos.js` escucha esto para saber qué período pedir:
    // tiene que llegar ya en el primer pintado, sin que haga falta
    // moverse para enterarse. Con `montarConPromesaControlada` el
    // oyente queda puesto ANTES de que `meses()` resuelva — si no,
    // con una `montar()` normal la carga inicial puede terminar antes
    // de que la prueba llegue a escuchar.
    const b = await montarConPromesaControlada();
    let detalle = null;
    b.dom.window.document.addEventListener(b.mod.EVENTO_CAMBIO, (ev) => {
      detalle = ev.detail;
    });
    b.resolver(MESES_DE_PRUEBA);
    await esperarCarga(b);
    assert.deepEqual(detalle, MESES_DE_PRUEBA[0]);
  });

  test("avisa de nuevo al moverse de mes", async () => {
    const b = await montar(MESES_DE_PRUEBA);
    await esperarCarga(b);
    let detalle = null;
    b.dom.window.document.addEventListener(b.mod.EVENTO_CAMBIO, (ev) => {
      detalle = ev.detail;
    });
    b.anterior.click();
    assert.deepEqual(detalle, MESES_DE_PRUEBA[1]);
  });

  test("no avisa nada mientras no hay un mes para mostrar", async () => {
    const b = await montar([], { falla: true });
    let veces = 0;
    b.dom.window.document.addEventListener(b.mod.EVENTO_CAMBIO, () => veces++);
    await latir(b);
    assert.equal(veces, 0);
  });
});
