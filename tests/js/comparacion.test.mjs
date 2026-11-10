/* Comparación por ítem · F13-T02
   Se corren con `npm test`.

   Qué se prueba acá, según la política del proyecto (lo que da un
   número o lo que la pantalla no muestra):

   - que **plegada no pida nada**: es el pedido explícito de Gustavo, y
     una llamada de más no se ve mirando el celular;
   - que el **rango lo recorte el servidor** (`?months=`), no el cliente;
   - que un mes **sin dato no se dibuje como cero**;
   - la **geometría** del gráfico: el tope del ancho por mes y el grupo
     centrado, que es la corrección de "muy espaciado de un mes al otro".

   No se prueba cómo se ve: eso se mira en el celular. */

import { test, describe, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { geometria, dibujar } from "../../web/src/js/charts/comparacion.js";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..");
const CRLF = new RegExp(String.fromCharCode(13, 10), "g");

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
  <article class="card shell" data-interruptores-propios>
    <div class="cfg-row comp-cabeza">
      <div><b>Comparación por ítem</b><span>Cómo se mueve un ítem de mes a mes.</span></div>
      <button class="toggle" type="button" role="switch" aria-checked="false" id="comp-switch"></button>
    </div>
    <div class="comp-cuerpo" id="comp-cuerpo" hidden>
      <div class="comp-controles">
        <select class="inp" id="comp-item"></select>
        <div class="view-switch" role="group" id="comp-rango">
          <button type="button" data-rango="3">3 m</button>
          <button type="button" class="activa" data-rango="6">6 m</button>
          <button type="button" data-rango="12">12 m</button>
          <button type="button" data-rango="0">Todo</button>
        </div>
      </div>
      <div class="legend"><i class="dot" id="comp-punto"></i><span id="comp-leyenda-serie"></span></div>
      <div class="chart-wrap" id="comp-grafico"></div>
      <div class="comp-sel cg" id="comp-seleccion" hidden></div>
      <div class="chart-foot" id="comp-pie"></div>
      <div class="rows" id="comp-filas"></div>
    </div>
  </article>
</body></html>`;

/** Respuesta de `GET /api/categories/{id}/history`, con la forma exacta
 * del contrato: los importes son texto y un mes sin dato trae `null`. */
const HISTORIAL = {
  category_id: 7,
  name: "Da Vinci",
  type: "expense",
  months: [
    { year: 2026, month: 6, status: "historical", total: "100000.00" },
    { year: 2026, month: 7, status: "historical", total: null },
    { year: 2026, month: 8, status: "open", total: "120000.00" },
    { year: 2026, month: 9, status: "open", total: "125000.00" },
    { year: 2026, month: 10, status: "open", total: "130000.00" },
    { year: 2026, month: 11, status: "open", total: "60000.00" },
  ],
  average: "118750.00",
  maximum: "130000.00",
  minimum: "100000.00",
  last_closed: "130000.00",
  difference: "-70000.00",
  variation: "-53.85",
};

function montar() {
  const dom = new JSDOM(HTML, {
    url: "https://epic-wallet-v2.vercel.app/#/movimientos",
    pretendToBeVisual: true,
  });
  ventanas.push(dom.window);
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.CustomEvent = dom.window.CustomEvent;
  globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
  return dom;
}

async function cargarConDobles() {
  let codigo = readFileSync(resolve(RAIZ, "web", "src", "js", "comparacion.js"), "utf8");
  codigo = codigo.replace(CRLF, String.fromCharCode(10));
  codigo = codigo
    .replace(
      'import { api } from "./api.js";',
      "const api = { get: (...a) => globalThis.__espia.apiGet(...a) };",
    )
    .replace(
      'import { esc, fmt, fmtS } from "./format.js";',
      `import { esc, fmt, fmtS } from "${rutaAbsoluta("format.js")}";`,
    )
    .replace(
      'import { activas as categoriasActivas } from "./cache-categorias.js";',
      "const categoriasActivas = () => globalThis.__espia.categorias();",
    )
    .replace(
      'import { bloqueCargando, error as estadoError, vacio } from "./components/estados.js";',
      `import { bloqueCargando, error as estadoError, vacio } from "${rutaAbsoluta("components", "estados.js")}";`,
    )
    .replace(
      'import { dibujar, etiquetaDeMes } from "./charts/comparacion.js";',
      `import { dibujar, etiquetaDeMes } from "${rutaAbsoluta("charts", "comparacion.js")}";`,
    )
    .replace(
      'import { sincronizar } from "./components/switch.js";',
      "const sincronizar = () => {};",
    );

  const unico = `\n// ${Math.random()}\n`;
  const url = `data:text/javascript;base64,${Buffer.from(codigo + unico, "utf8").toString("base64")}`;
  return import(url);
}

/** Espera a que se vacíe la cola de microtareas: los pedidos de este
 * módulo son `await` sueltos, no devuelven promesa a quien dispara. */
const asentar = () => new Promise((r) => setTimeout(r, 0));

let pedidos = [];

beforeEach(() => {
  pedidos = [];
  globalThis.__espia = {
    apiGet: (ruta) => {
      pedidos.push(ruta);
      return Promise.resolve(structuredClone(HISTORIAL));
    },
    categorias: () =>
      Promise.resolve([
        { id: 7, name: "Da Vinci", type: "expense", active: true },
        { id: 3, name: "Sueldo", type: "income", active: true },
      ]),
  };
});

describe("la tarjeta plegada", () => {
  test("no pide nada a la API hasta que se la prende", async () => {
    montar();
    await cargarConDobles();
    await asentar();

    // El pedido de Gustavo: "no quiero que esté desplegado todo el
    // tiempo". Si la tarjeta pidiera igual, abrir Movimientos costaría
    // una llamada más por cada carga, sin que se note en la pantalla.
    assert.deepEqual(pedidos, []);
  });

  test("el cuerpo arranca oculto y el interruptor lo dice", async () => {
    const dom = montar();
    await cargarConDobles();
    assert.equal(dom.window.document.getElementById("comp-cuerpo").hidden, true);
    assert.equal(
      dom.window.document.getElementById("comp-switch").getAttribute("aria-checked"),
      "false",
    );
  });

  test("al prenderla pide el historial del ítem con el rango por defecto", async () => {
    const dom = montar();
    await cargarConDobles();

    dom.window.document
      .getElementById("comp-switch")
      .dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await asentar();

    assert.equal(dom.window.document.getElementById("comp-cuerpo").hidden, false);
    assert.deepEqual(pedidos, ["/categories/7/history?months=6"]);
  });

  test("apagarla vuelve a ocultar el cuerpo", async () => {
    const dom = montar();
    await cargarConDobles();
    const sw = dom.window.document.getElementById("comp-switch");

    sw.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await asentar();
    sw.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await asentar();

    assert.equal(dom.window.document.getElementById("comp-cuerpo").hidden, true);
    assert.equal(sw.getAttribute("aria-checked"), "false");
  });
});

describe("el rango", () => {
  test("lo recorta el servidor: cada opción manda su propio months", async () => {
    const dom = montar();
    await cargarConDobles();
    const doc = dom.window.document;

    doc.getElementById("comp-switch").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await asentar();

    for (const [rango, esperado] of [
      ["3", "/categories/7/history?months=3"],
      ["12", "/categories/7/history?months=12"],
      // "Todo" es `months=0`: el servidor devuelve el histórico entero.
      ["0", "/categories/7/history?months=0"],
    ]) {
      doc
        .querySelector(`#comp-rango [data-rango="${rango}"]`)
        .dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
      await asentar();
      assert.equal(pedidos.at(-1), esperado);
    }
  });

  test("cambiar de ítem vuelve a pedir, con el rango que estaba puesto", async () => {
    const dom = montar();
    await cargarConDobles();
    const doc = dom.window.document;

    doc.getElementById("comp-switch").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await asentar();

    const sel = doc.getElementById("comp-item");
    sel.value = "3";
    sel.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    await asentar();

    assert.equal(pedidos.at(-1), "/categories/3/history?months=6");
  });

  test("el selector trae las categorías activas, egresos e ingresos", async () => {
    const dom = montar();
    await cargarConDobles();
    const doc = dom.window.document;

    doc.getElementById("comp-switch").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await asentar();

    const opciones = [...doc.querySelectorAll("#comp-item option")].map((o) => o.textContent);
    assert.deepEqual(opciones, ["Da Vinci", "Sueldo"]);
    assert.equal(doc.querySelectorAll("#comp-item optgroup").length, 2);
  });
});

describe("lo que se pinta", () => {
  test("las seis cifras del pie son las que mandó la API, no recalculadas", async () => {
    const dom = montar();
    await cargarConDobles();
    const doc = dom.window.document;

    doc.getElementById("comp-switch").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await asentar();

    const pie = doc.getElementById("comp-pie").textContent;
    assert.match(pie, /\$118\.750/); // promedio
    assert.match(pie, /\$130\.000/); // más caro y último cerrado
    assert.match(pie, /\$100\.000/); // más barato
    assert.match(pie, /−\$70\.000/); // diferencia, con el menos tipográfico
    assert.match(pie, /−53,9%|−53,8%/); // variación
    assert.equal(doc.querySelectorAll("#comp-pie .mini").length, 6);
  });

  test("un mes sin dato aparece como tal en la lista, no como cero", async () => {
    const dom = montar();
    await cargarConDobles();
    const doc = dom.window.document;

    doc.getElementById("comp-switch").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await asentar();

    const filas = doc.getElementById("comp-filas").textContent;
    assert.match(filas, /Sin movimientos de este ítem/);
    // Y el mes en curso se avisa como parcial: compararlo de frente con
    // un mes cerrado es justamente lo que no hay que hacer.
    assert.match(filas, /Mes en curso/);
  });

  test("tocar una barra muestra ese mes, y volver a tocarla lo saca", async () => {
    const dom = montar();
    await cargarConDobles();
    const doc = dom.window.document;

    doc.getElementById("comp-switch").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await asentar();

    const barra = doc.querySelector("#comp-grafico [data-mes='3']");
    assert.ok(barra, "el gráfico tiene que dibujar barras tocables");

    barra.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    const caja = doc.getElementById("comp-seleccion");
    assert.equal(caja.hidden, false);
    assert.match(caja.textContent, /Septiembre 2026/);

    doc
      .querySelector("#comp-grafico [data-mes='3']")
      .dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    assert.equal(doc.getElementById("comp-seleccion").hidden, true);
  });

  test("si la API falla, lo dice y no deja el gráfico vacío", async () => {
    globalThis.__espia.apiGet = () => Promise.reject(new Error("sin red"));
    const dom = montar();
    await cargarConDobles();
    const doc = dom.window.document;

    doc.getElementById("comp-switch").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await asentar();

    assert.match(doc.getElementById("comp-grafico").textContent, /No se pudo cargar/);
  });
});

describe("la geometría del gráfico", () => {
  test("el ancho de cada mes tiene tope: con pocos meses no se separan", async () => {
    // La corrección que pidió Gustavo (2026-11-10): con tres meses y el
    // ancho repartido a secas, cada mes se quedaba con 160 px y las
    // barras terminaban a media pantalla una de la otra.
    for (const n of [1, 2, 3, 6, 12, 18]) {
      const g = geometria(n);
      assert.ok(g.slot <= 68, `con ${n} meses, el ancho por mes pasó de 68 (dio ${g.slot})`);
      // Lo que de verdad se ve: la barra tiene que ser más ancha que el
      // hueco que la separa de la siguiente. Sin el tope, con tres
      // meses el hueco medía el doble que la barra.
      assert.ok(
        g.barra >= g.slot - g.barra,
        `con ${n} meses la barra (${g.barra}) quedó más angosta que el hueco (${g.slot - g.barra})`,
      );
    }
  });

  test("lo que sobra queda como margen a los costados: el grupo va centrado", () => {
    const g = geometria(3);
    const sobra = g.interior - g.slot * 3;
    // El grupo arranca a la mitad de lo que sobra, no pegado al eje.
    assert.ok(Math.abs(g.inicioX - (50 + sobra / 2)) < 0.01);
  });

  test("hasta siete meses entra en la pantalla; con más, crece", () => {
    assert.equal(geometria(7).cabe, true);
    assert.equal(geometria(7).ancho, 400);
    assert.equal(geometria(12).cabe, false);
    assert.ok(geometria(12).ancho > 400);
    assert.ok(geometria(18).ancho > geometria(12).ancho);
  });

  test("cero meses no rompe ni divide por cero", () => {
    assert.doesNotThrow(() => geometria(0));
    assert.equal(dibujar([]), "");
  });
});

describe("el dibujo", () => {
  const meses = [
    { year: 2026, month: 9, total: "100000.00" },
    { year: 2026, month: 10, total: null },
    { year: 2026, month: 11, total: "60000.00", parcial: true },
  ];

  test("un mes sin dato no dibuja barra: dice «sin dato»", () => {
    const svg = dibujar(meses);
    // Dos barras para tres meses: la del medio no existe. Con un cero
    // habría tres, y la del medio se leería como «ese mes no gasté».
    assert.equal((svg.match(/<rect/g) || []).length, 2);
    assert.match(svg, /sin dato/);
  });

  test("publica la escala del texto, como cualquier gráfico del sistema", () => {
    // F13-T01: es lo que hace que la letra se vea igual en los cuatro
    // gráficos.
    assert.match(dibujar(meses), /--escala-grafico:/);
  });

  test("cada barra queda identificada por su posición, para poder tocarla", () => {
    const svg = dibujar(meses);
    assert.match(svg, /data-mes="0"/);
    assert.match(svg, /data-mes="2"/);
    assert.ok(!svg.includes('data-mes="1"'), "el mes sin dato no es tocable");
  });

  test("la línea del promedio se dibuja punteada y con su valor", () => {
    const svg = dibujar(meses);
    assert.match(svg, /stroke-dasharray/);
    assert.match(svg, /prom\./);
  });
});
