/* Pruebas del tablero de Inicio: tarjetas (F05-T07) y gráfico diario
   (F06-T02). Se corren con `npm test` (`node --test tests/js/*.test.mjs`).

   Misma técnica que `movimientos.test.mjs`: el módulo se carga con
   `api.get` doblado (para no depender de una red de verdad) y
   `EVENTO_CAMBIO` reemplazado por su valor literal, en vez de importar
   `barra-mes.js` entero. `kpi.js`, `format.js`, `estados.js` y
   `charts/diario.js` SÍ se importan de verdad: son los que deciden qué
   cifra va en qué tarjeta y cómo se dibuja el gráfico, y es justo lo
   que estas pruebas tienen que proteger.

   Los criterios de aceptación, cada uno con su prueba: las tarjetas y
   el gráfico muestran lo mismo que la API, un mes sin datos muestra
   ceros con su explicación (no una pantalla en blanco ni un error), un
   mes histórico muestra el estado consolidado en vez de inventar una
   serie diaria (Regla 4), y con la red caída se ve un error entendible
   con botón para reintentar. */

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

async function cargarConDobles() {
  let codigo = readFileSync(resolve(RAIZ, "web", "src", "js", "dashboard.js"), "utf8");
  codigo = codigo
    .replace(
      'import { api } from "./api.js";',
      "const api = { get: (...a) => globalThis.__espia.apiGet(...a) };",
    )
    .replace(
      'import { esc, fmt, fmtS, fmtK, pct, pctPlano } from "./format.js";',
      `import { esc, fmt, fmtS, fmtK, pct, pctPlano } from "${rutaAbsoluta("format.js")}";`,
    )
    .replace(
      'import { tarjetaHeroe, tarjetaMetrica, pintarTarjetas, animarCifras } from "./components/kpi.js";',
      `import { tarjetaHeroe, tarjetaMetrica, pintarTarjetas, animarCifras } from "${rutaAbsoluta("components", "kpi.js")}";`,
    )
    .replace(
      'import { filaCategoria, pintarFilas } from "./components/rows.js";',
      `import { filaCategoria, pintarFilas } from "${rutaAbsoluta("components", "rows.js")}";`,
    )
    .replace(
      'import { bloqueCargando, error as estadoError, vacio, consolidado } from "./components/estados.js";',
      `import { bloqueCargando, error as estadoError, vacio, consolidado } from "${rutaAbsoluta("components", "estados.js")}";`,
    )
    .replace(
      'import { EVENTO_CAMBIO } from "./barra-mes.js";',
      'const EVENTO_CAMBIO = "mes:cambiado";',
    )
    .replace(
      'import {\n  dibujar as dibujarGraficoDiario,\n  MODOS as MODOS_DIARIO,\n  conectarLectura,\n} from "./charts/diario.js";',
      `import { dibujar as dibujarGraficoDiario, MODOS as MODOS_DIARIO, conectarLectura } from "${rutaAbsoluta("charts", "diario.js")}";`,
    )
    .replace(
      'import { dibujar as dibujarGraficoSeis, MODOS as MODOS_SEIS, etiquetaDeMes } from "./charts/seis.js";',
      `import { dibujar as dibujarGraficoSeis, MODOS as MODOS_SEIS, etiquetaDeMes } from "${rutaAbsoluta("charts", "seis.js")}";`,
    );

  const unico = `\n// ${Math.random()}\n`;
  const url = `data:text/javascript;base64,${Buffer.from(codigo + unico, "utf8").toString("base64")}`;
  return import(url);
}

const MES_ACTUAL = { id: 7, year: 2026, month: 10, status: "open" };
const MES_PASADO_ABIERTO = { id: 5, year: 2026, month: 8, status: "open" };

/** Una respuesta de `GET /api/dashboard` completa, con los campos que
 * `dashboard.js` de verdad lee. Cada prueba pisa sólo lo que le
 * importa con `estructuraClonadaCon(...)`. */
function respuestaBase() {
  return {
    month: {
      id: 7,
      year: 2026,
      month: 10,
      label: "Octubre 2026",
      status: "open",
      consolidated: false,
      income_total: "500000.00",
      expense_total: "165000.00",
      saving_total: "335000.00",
      saving_rate: "67.0",
      is_current: true,
    },
    navigation: {
      previous: { year: 2026, month: 9 },
      next: null,
      current: { year: 2026, month: 10 },
    },
    indicators: {
      income: "500000.00",
      expense: "165000.00",
      saving: "335000.00",
      // savings_balance y net_worth deliberadamente distintos: así una
      // prueba que lea el campo equivocado se nota (hoy, con F10 sin
      // existir, la API real los manda siempre iguales).
      savings_balance: "1200000.00",
      investments_value: "150000.00",
      net_worth: "1350000.00",
      vs_previous: { income: "12.0", expense: "-5.0", saving: "31.7" },
    },
    daily: {
      days: 10,
      income: ["500000.00"].concat(Array(9).fill("0.00")),
      expense: Array(9).fill("0.00").concat(["15000.00"]),
      saving_cumulative: Array(9).fill("500000.00").concat(["485000.00"]),
      peak_expense: { day: 10, amount: "15000.00" },
      days_without_expense: 9,
    },
    last_six_months: [
      { year: 2026, month: 8, label: "Agosto 2026", income: "480000.00", expense: "300000.00", saving: "180000.00", saving_rate: "37.5" },
      { year: 2026, month: 9, label: "Septiembre 2026", income: "490000.00", expense: "320000.00", saving: "170000.00", saving_rate: "34.7" },
      { year: 2026, month: 10, label: "Octubre 2026", income: "500000.00", expense: "165000.00", saving: "335000.00", saving_rate: "67.0" },
    ],
    categories: [
      // A propósito, "Gas" pesa más que "Alquiler": así el orden "mayor
      // gasto" (Gas, Alquiler) y el orden "A–Z" (Alquiler, Gas) dan
      // resultados distintos, y una prueba de orden que no mueva nada
      // de verdad no pasa por casualidad.
      {
        category_id: 1,
        name: "Alquiler",
        type: "expense",
        total: "45000.00",
        share: "27.3",
        transaction_count: 2,
        last_date: "2026-10-12",
      },
      {
        category_id: 2,
        name: "Gas",
        type: "expense",
        total: "120000.00",
        share: "72.7",
        transaction_count: 1,
        last_date: "2026-10-05",
      },
      {
        category_id: 3,
        name: "Sueldo",
        type: "income",
        total: "500000.00",
        share: "100.0",
        transaction_count: 1,
        last_date: "2026-10-01",
      },
    ],
    alerts: [],
  };
}

function conCambios(base, cambios) {
  const copia = structuredClone(base);
  for (const [ruta, valor] of cambios) {
    let obj = copia;
    const partes = ruta.split(".");
    for (let i = 0; i < partes.length - 1; i++) obj = obj[partes[i]];
    obj[partes.at(-1)] = valor;
  }
  return copia;
}

const HTML_INICIO = `<!doctype html><html><body>
  <div class="kpi-grid stagger" id="kpis-inicio"></div>
  <div class="view-switch" id="diario-modo">
    <button type="button" class="activa" data-modo="ambos">Ambos</button>
    <button type="button" data-modo="egresos">Egresos</button>
    <button type="button" data-modo="ingresos">Ingresos</button>
  </div>
  <div class="chart-wrap" id="grafico-diario"></div>
  <div class="view-switch" id="seis-modo">
    <button type="button" class="activa" data-modo="barras">Barras</button>
    <button type="button" data-modo="ahorro">Ahorro</button>
    <button type="button" data-modo="tasa">Tasa de ahorro</button>
  </div>
  <div class="chart-wrap" id="grafico-seis"></div>
  <div class="chart-foot" id="pie-seis"></div>
  <div class="view-switch" id="categorias-orden">
    <button type="button" class="activa" data-orden="mayor">Mayor gasto</button>
    <button type="button" data-orden="az">A–Z</button>
  </div>
  <div class="rows" id="categorias-inicio"></div>
</body></html>`;

async function montar({ apiGet } = {}) {
  const dom = new JSDOM(HTML_INICIO, {
    url: "https://epic-wallet-v2.vercel.app/#/inicio",
    pretendToBeVisual: true,
  });
  ventanas.push(dom.window);

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.CustomEvent = dom.window.CustomEvent;
  globalThis.requestAnimationFrame = (fn) => dom.window.requestAnimationFrame(fn);
  // Sin movimiento reducido, cada cifra tarda 900ms en terminar de
  // contar: las pruebas sólo necesitan el valor final, así que se
  // apaga la animación para no tener que esperarla.
  dom.window.matchMedia = () => ({ matches: true });

  const llamadas = { apiGet: [] };
  globalThis.__espia = {
    apiGet: async (...a) => {
      llamadas.apiGet.push(a);
      return (apiGet ?? (async () => respuestaBase()))(...a);
    },
  };

  const mod = await cargarConDobles();
  const $$ = (id) => dom.window.document.getElementById(id);
  return {
    dom,
    mod,
    llamadas,
    caja: $$("kpis-inicio"),
    grafico: $$("grafico-diario"),
    modoDiario: $$("diario-modo"),
    graficoSeis: $$("grafico-seis"),
    pieSeis: $$("pie-seis"),
    modoSeis: $$("seis-modo"),
    categorias: $$("categorias-inicio"),
    ordenCategorias: $$("categorias-orden"),
  };
}

const esperar = (ms = 10) => new Promise((listo) => setTimeout(listo, ms));

function cambiarMes(dom, periodo) {
  dom.window.document.dispatchEvent(new dom.window.CustomEvent("mes:cambiado", { detail: periodo }));
}

function etiquetas(caja) {
  return [...caja.querySelectorAll(".kpi-label")].map((e) => e.textContent);
}

function cifraDe(caja, etiqueta) {
  const tarjeta = [...caja.querySelectorAll(".kpi")].find(
    (t) => t.querySelector(".kpi-label").textContent === etiqueta,
  );
  return tarjeta?.querySelector(".kpi-num").textContent;
}

function subDe(caja, etiqueta) {
  const tarjeta = [...caja.querySelectorAll(".kpi")].find(
    (t) => t.querySelector(".kpi-label").textContent === etiqueta,
  );
  return tarjeta?.querySelector(".kpi-sub").textContent;
}

// ===================================================================

describe("al cambiar de mes", () => {
  test("pide el dashboard del período con year y month", async () => {
    const { dom, llamadas } = await montar();
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    const pedido = llamadas.apiGet.find((a) => a[0].startsWith("/dashboard?"));
    assert.ok(pedido, "tiene que haber pedido /dashboard");
    assert.match(pedido[0], /year=2026/);
    assert.match(pedido[0], /month=10/);
  });

  test("moverse a otro mes vuelve a pedir", async () => {
    const { dom, llamadas } = await montar();
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();
    cambiarMes(dom, { id: 6, year: 2026, month: 9, status: "open" });
    await esperar();

    const pedidos = llamadas.apiGet.filter((a) => a[0].startsWith("/dashboard?"));
    assert.equal(pedidos.length, 2);
    assert.match(pedidos[1][0], /month=9/);
  });
});

describe("las cinco tarjetas", () => {
  test("hay una heroe y cuatro de color, en el orden de F01-T13", async () => {
    const { dom, caja } = await montar();
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    assert.equal(caja.querySelectorAll(".kpi--hero").length, 1);
    assert.deepEqual(etiquetas(caja), ["Ahorro del mes", "Ingresos", "Egresos", "Gasto de hoy", "Total de ahorros"]);
  });

  test("«total de ahorros» es el acumulado de todos los meses, no el del mes en pantalla", async () => {
    // Pedido de Gustavo: el valor de "ahorro del mes" (sólo el mes en
    // pantalla) y el de "total de ahorros" (savings_balance, la suma
    // de todos los meses) tienen que poder ser números distintos — acá
    // el mock los pone distintos a propósito (335.000 vs. 1.200.000)
    // para que un error que confunda los dos campos se note.
    const { dom, caja } = await montar();
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    assert.equal(cifraDe(caja, "Ahorro del mes"), "$335.000");
    assert.equal(cifraDe(caja, "Total de ahorros"), "$1.200.000");
  });

  test("«total de ahorros» no muestra patrimonio (ahorro + inversiones)", async () => {
    // Ese valor se va a mostrar en Cartera cuando exista la fase de
    // inversiones (F10), con otro nombre ("ahorro más inversiones").
    const { dom, caja } = await montar();
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    assert.notEqual(cifraDe(caja, "Total de ahorros"), "$1.350.000", "no tiene que ser net_worth");
  });

  test("cada cifra es la que mandó la API, formateada en pesos", async () => {
    const { dom, caja } = await montar();
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    assert.equal(cifraDe(caja, "Ahorro del mes"), "$335.000");
    assert.equal(cifraDe(caja, "Ingresos"), "$500.000");
    assert.equal(cifraDe(caja, "Egresos"), "$165.000");
    assert.equal(cifraDe(caja, "Total de ahorros"), "$1.200.000", "tiene que ser savings_balance, no net_worth");
  });

  test("ingresos y egresos muestran la variación contra el mes anterior", async () => {
    const { dom, caja } = await montar();
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    assert.equal(subDe(caja, "Ingresos"), "+12,0% vs. mes anterior");
    assert.equal(subDe(caja, "Egresos"), "−5,0% vs. mes anterior");
  });

  test("sin mes anterior, dice que es el primer mes registrado", async () => {
    const { dom, caja } = await montar({
      apiGet: async () =>
        conCambios(respuestaBase(), [
          ["indicators.vs_previous.income", null],
          ["indicators.vs_previous.expense", null],
        ]),
    });
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    assert.equal(subDe(caja, "Ingresos"), "Primer mes registrado");
  });

  test("ingresos en cero: la tasa de ahorro no es un error ni un 0%, es N/A explicado", async () => {
    const { dom, caja } = await montar({
      apiGet: async () => conCambios(respuestaBase(), [["month.saving_rate", null]]),
    });
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    assert.equal(subDe(caja, "Ahorro del mes"), "Sin ingresos registrados");
  });

  test("la tasa de ahorro no antepone signo: es una proporción, no una mejora", async () => {
    const { dom, caja } = await montar();
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    assert.match(subDe(caja, "Ahorro del mes"), /Tasa de ahorro 67,0%/);
    assert.ok(!subDe(caja, "Ahorro del mes").includes("+67"));
  });
});

describe("gasto de hoy", () => {
  test("en el mes actual, muestra el gasto de hoy", async () => {
    const { dom, caja } = await montar();
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    assert.equal(cifraDe(caja, "Gasto de hoy"), "$15.000");
    assert.equal(subDe(caja, "Gasto de hoy"), "Total gastado hoy");
  });

  test("en un mes que no es el actual, no mezcla el día de hoy con ese mes", async () => {
    // El mes en pantalla puede estar abierto (nunca se consolidó) y
    // sin embargo no ser el mes actual: "hoy" no es un día de ESE mes.
    const { dom, caja } = await montar({
      apiGet: async () =>
        conCambios(respuestaBase(), [
          ["month.is_current", false],
          ["daily.days", 31],
        ]),
    });
    await esperar();
    cambiarMes(dom, MES_PASADO_ABIERTO);
    await esperar();

    assert.equal(cifraDe(caja, "Gasto de hoy"), "—");
    assert.equal(subDe(caja, "Gasto de hoy"), "Sólo para el mes actual");
  });

  test("un mes histórico tampoco mezcla el día de hoy (daily es null, Regla 4)", async () => {
    const { dom, caja } = await montar({
      apiGet: async () =>
        conCambios(respuestaBase(), [
          ["month.is_current", false],
          ["month.status", "historical"],
          ["daily", null],
        ]),
    });
    await esperar();
    cambiarMes(dom, { id: 4, year: 2026, month: 7, status: "historical" });
    await esperar();

    assert.equal(cifraDe(caja, "Gasto de hoy"), "—");
  });
});

describe("mes nuevo sin movimientos", () => {
  test("muestra ceros con su explicación, no una pantalla en blanco", async () => {
    const { dom, caja } = await montar({
      apiGet: async () =>
        conCambios(respuestaBase(), [
          ["month.income_total", "0.00"],
          ["month.expense_total", "0.00"],
          ["month.saving_total", "0.00"],
          ["month.saving_rate", null],
          ["indicators.income", "0.00"],
          ["indicators.expense", "0.00"],
          ["indicators.saving", "0.00"],
          ["indicators.savings_balance", "0.00"],
          ["indicators.net_worth", "0.00"],
          ["indicators.vs_previous.income", null],
          ["indicators.vs_previous.expense", null],
          ["daily.expense", Array(10).fill("0.00")],
          ["daily.peak_expense", null],
        ]),
    });
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    assert.equal(caja.querySelectorAll(".kpi").length, 5, "las tarjetas siguen, no desaparecen");
    assert.equal(cifraDe(caja, "Ingresos"), "$0");
    assert.equal(cifraDe(caja, "Gasto de hoy"), "$0");
    assert.equal(subDe(caja, "Ahorro del mes"), "Sin ingresos registrados");
  });
});

describe("el gráfico diario (F06-T02)", () => {
  test("dibuja un svg de verdad en #grafico-diario", async () => {
    const { dom, grafico } = await montar();
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    assert.ok(grafico.querySelector("svg"), "tiene que haber un <svg>");
  });

  test("el modo por defecto es «ambos»: una barra de cada color", async () => {
    const { dom, grafico } = await montar();
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    const barras = [...grafico.querySelectorAll(".bar")];
    assert.equal(barras.length, 2, "un día con ingreso y un día con egreso: dos barras");
  });

  test("tocar «Ingresos» deja sólo esa barra", async () => {
    const { dom, grafico, modoDiario } = await montar();
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    modoDiario.querySelector('[data-modo="ingresos"]').click();

    assert.equal(grafico.querySelectorAll(".bar").length, 1, "sólo el día con ingreso tiene barra");
  });

  test("tocar «Egresos» deja sólo esa barra", async () => {
    const { dom, grafico, modoDiario } = await montar();
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    modoDiario.querySelector('[data-modo="egresos"]').click();

    assert.equal(grafico.querySelectorAll(".bar").length, 1, "sólo el día con egreso tiene barra");
  });

  test("volver a «Ambos» redibuja las dos barras de nuevo", async () => {
    const { dom, grafico, modoDiario } = await montar();
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    modoDiario.querySelector('[data-modo="egresos"]').click();
    modoDiario.querySelector('[data-modo="ambos"]').click();

    assert.equal(grafico.querySelectorAll(".bar").length, 2);
  });

  test("tocar el modo que ya está activo no rompe nada", async () => {
    const { dom, grafico, modoDiario } = await montar();
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    modoDiario.querySelector('[data-modo="ambos"]').click();
    assert.equal(grafico.querySelectorAll(".bar").length, 2);
  });

  test("ya no existe el modo «Acumulado»: Gustavo pidió sacarlo", async () => {
    const { dom, modoDiario } = await montar();
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    assert.equal(modoDiario.querySelector('[data-modo="acumulado"]'), null);
  });

  test("se ven los diez días del eje, ninguno salteado", async () => {
    // Gustavo: antes mostraba sólo 1, 3, 5, 7, 9 — quiere cada día.
    const { dom, grafico } = await montar();
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    const dias = [...grafico.querySelectorAll(".axis-t")]
      .map((t) => t.textContent)
      .filter((t) => /^\d+$/.test(t));
    assert.deepEqual(dias, Array.from({ length: 10 }, (_, i) => String(i + 1)));
  });

  describe("un día con ingreso y egreso a la vez (opción A del mockup aprobado)", () => {
    // La base ya tiene ingreso sólo el día 1 y egreso sólo el día 10;
    // acá se agrega un tercer día con los dos juntos, para probar el
    // centrado dinámico sin tocar esos dos casos de "un solo tipo".
    function conDiaMixto() {
      return conCambios(respuestaBase(), [
        ["daily.income", ["500000.00"].concat(Array(3).fill("0.00")).concat(["30000.00"]).concat(Array(5).fill("0.00"))],
        ["daily.expense", Array(4).fill("0.00").concat(["20000.00"]).concat(Array(4).fill("0.00")).concat(["15000.00"])],
      ]);
      // día 1: sólo ingreso (500000). día 5 (índice 4): ingreso 30000 Y
      // egreso 20000 juntos. día 10: sólo egreso (15000), igual que la base.
    }

    test("ese día dibuja dos barras, una de cada color", async () => {
      const { dom, grafico } = await montar({ apiGet: async () => conDiaMixto() });
      await esperar();
      cambiarMes(dom, MES_ACTUAL);
      await esperar();

      // Día 1 (sólo ingreso) + día 5 (los dos) + día 10 (sólo egreso)
      // = 1 + 2 + 1 = 4 barras en total.
      assert.equal(grafico.querySelectorAll(".bar").length, 4);
    });

    test("un día con un solo tipo usa una barra más ancha que un día con los dos", async () => {
      const { dom, grafico } = await montar({ apiGet: async () => conDiaMixto() });
      await esperar();
      cambiarMes(dom, MES_ACTUAL);
      await esperar();

      const anchos = [...grafico.querySelectorAll(".bar")].map((b) => {
        // El trazo es un <path>, no un <rect>: `trazoBarraRedondeada`
        // siempre arranca en "M<bordeIzq> ..." y termina en
        // "...L<bordeDer> <baseY> Z" (tests/js/svg.test.mjs lo prueba
        // directo); acá alcanza con leer esos dos bordes.
        const d = b.getAttribute("d");
        const izq = Number(d.match(/^M(-?[\d.]+)/)[1]);
        const der = Number(d.match(/L(-?[\d.]+) -?[\d.]+ Z$/)[1]);
        return der - izq;
      });
      // Las dos barras del día mixto (las del medio, más angostas) no
      // pueden ser tan anchas como las de los días de un solo tipo.
      const anchoSolo = Math.max(...anchos);
      const anchoPar = Math.min(...anchos);
      assert.ok(anchoPar < anchoSolo, `par (${anchoPar}) tiene que ser más angosto que solo (${anchoSolo})`);
    });
  });

  test("la línea de ahorro sólo se ve en «ambos» (F06-T02, corrección)", async () => {
    // En "ingresos" o "egresos" el eje izquierdo cambia de escala para
    // esa serie sola; el derecho (ahorro) se quedaba sin actualizarse
    // y los dos lados dejaban de hablar de lo mismo — Gustavo pidió
    // sacarla en esos dos modos.
    const { dom, grafico, modoDiario } = await montar();
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    modoDiario.querySelector('[data-modo="ambos"]').click();
    assert.ok(grafico.querySelector(".lineseries"), "en «ambos» tiene que verse");

    for (const modo of ["ingresos", "egresos"]) {
      modoDiario.querySelector(`[data-modo="${modo}"]`).click();
      assert.equal(grafico.querySelector(".lineseries"), null, `el modo ${modo} no tiene que mostrar la línea`);
      assert.equal(grafico.textContent.includes("AHORRO"), false, `el modo ${modo} no tiene que mostrar su eje`);
    }
  });

  test("un mes histórico muestra el estado consolidado, no un gráfico inventado (Regla 4)", async () => {
    const { dom, grafico } = await montar({
      apiGet: async () =>
        conCambios(respuestaBase(), [
          ["month.status", "historical"],
          ["month.consolidated", true],
          ["month.is_current", false],
          ["daily", null],
        ]),
    });
    await esperar();
    cambiarMes(dom, { id: 4, year: 2026, month: 7, status: "historical" });
    await esperar();

    // No cualquier <svg>: el estado "consolidado" trae su propio
    // ícono en un <svg> (estados.js). Lo que no tiene que existir es
    // el gráfico en sí — sus barras, su línea, su grilla.
    assert.equal(grafico.querySelector(".bar, .lineseries, .gridline"), null, "un mes histórico no inventa una serie diaria");
    assert.match(grafico.textContent, /consolidad/i);
  });

  test("mientras carga, se ve un esqueleto de gráfico, no la pantalla en blanco", async () => {
    let resolver;
    const { dom, grafico } = await montar({
      apiGet: () => new Promise((listo) => (resolver = listo)),
    });
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    assert.ok(grafico.querySelector(".esqueleto--grafico"), "tiene que haber un esqueleto");
    resolver(respuestaBase());
    await esperar();
  });
});

describe("últimos seis meses (F06-T05)", () => {
  test("dibuja el svg, y el pie sólo con los últimos dos meses (no los seis del gráfico)", async () => {
    // Gustavo (F06-T05, corrección): seis tarjetitas en el pie repetían
    // lo que las barras ya muestran y acumulaban demasiada información.
    const { dom, graficoSeis, pieSeis } = await montar();
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    assert.ok(graficoSeis.querySelector("svg"));
    assert.equal(pieSeis.querySelectorAll(".mini").length, 2, "la base trae tres meses; el pie sólo dos");
    assert.match(pieSeis.textContent, /Septiembre 26/);
    assert.match(pieSeis.textContent, /Octubre 26/);
    assert.ok(!pieSeis.textContent.includes("Agosto"), "el mes más viejo no entra en el pie de dos");
  });

  test("con menos de seis meses, el pie muestra sólo los que hay", async () => {
    const { dom, pieSeis } = await montar({
      apiGet: async () => conCambios(respuestaBase(), [["last_six_months", [respuestaBase().last_six_months.at(-1)]]]),
    });
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    assert.equal(pieSeis.querySelectorAll(".mini").length, 1);
  });

  test("tocar «Ahorro» y «Tasa de ahorro» redibuja sin romper", async () => {
    const { dom, graficoSeis, modoSeis } = await montar();
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    modoSeis.querySelector('[data-modo="ahorro"]').click();
    assert.ok(graficoSeis.querySelector("svg"));

    modoSeis.querySelector('[data-modo="tasa"]').click();
    assert.ok(graficoSeis.querySelector("svg"));
    // El mes de octubre de la base tiene saving_rate: "67.0".
    assert.match(graficoSeis.textContent, /67%/);
  });

  test("un mes sin tasa de ahorro (saving_rate: null) no rompe el modo «Tasa»", async () => {
    const { dom, graficoSeis, modoSeis } = await montar({
      apiGet: async () => conCambios(respuestaBase(), [["last_six_months.0.saving_rate", null]]),
    });
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    modoSeis.querySelector('[data-modo="tasa"]').click();
    assert.ok(graficoSeis.querySelector("svg"));
  });
});

describe("gastos por categoría (F06-T05)", () => {
  test("sólo muestra categorías de egreso, nunca las de ingreso", async () => {
    const { dom, categorias } = await montar();
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    const filas = [...categorias.querySelectorAll(".row")];
    assert.equal(filas.length, 2, "Alquiler y Gas — Sueldo (ingreso) queda afuera");
    assert.ok(!categorias.textContent.includes("Sueldo"));
  });

  test("por defecto ordena de mayor a menor gasto", async () => {
    const { dom, categorias } = await montar();
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    const nombres = [...categorias.querySelectorAll(".row-main b")].map((b) => b.textContent);
    assert.deepEqual(nombres, ["Gas", "Alquiler"]); // 120000 > 45000
  });

  test("tocar «A–Z» ordena alfabéticamente", async () => {
    const { dom, categorias, ordenCategorias } = await montar();
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    ordenCategorias.querySelector('[data-orden="az"]').click();

    const nombres = [...categorias.querySelectorAll(".row-main b")].map((b) => b.textContent);
    assert.deepEqual(nombres, ["Alquiler", "Gas"]); // distinto del orden "mayor gasto" de arriba
  });

  test("el detalle trae la cantidad de movimientos y el % del gasto", async () => {
    const { dom, categorias } = await montar();
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    const fila = [...categorias.querySelectorAll(".row")].find((f) => f.textContent.includes("Gas"));
    assert.match(fila.textContent, /1 movimiento/);
    assert.match(fila.textContent, /72,7% del gasto/);
  });

  test("un mes histórico muestra «Total consolidado», no una cantidad inventada (Regla 4)", async () => {
    const { dom, categorias } = await montar({
      apiGet: async () =>
        conCambios(respuestaBase(), [
          ["month.consolidated", true],
          ["month.status", "historical"],
          ["daily", null],
          ["categories.0.transaction_count", 0],
          ["categories.0.last_date", null],
        ]),
    });
    await esperar();
    cambiarMes(dom, { id: 4, year: 2026, month: 7, status: "historical" });
    await esperar();

    const fila = [...categorias.querySelectorAll(".row")].find((f) => f.textContent.includes("Alquiler"));
    assert.match(fila.textContent, /Total consolidado/);
    assert.ok(!fila.textContent.includes("movimiento"));
  });

  test("un mes sin gastos muestra el estado vacío, no una lista en blanco", async () => {
    const { dom, categorias } = await montar({
      apiGet: async () => conCambios(respuestaBase(), [["categories", []]]),
    });
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    assert.equal(categorias.querySelectorAll(".row").length, 0);
    assert.match(categorias.textContent, /sin gastos/i);
  });
});

describe("si la API falla", () => {
  test("muestra un error entendible con botón para reintentar, no rompe la pantalla", async () => {
    const { dom, caja, grafico } = await montar({
      apiGet: async () => {
        throw new Error("sin red");
      },
    });
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    const reintentar = caja.querySelector("[data-reintentar]");
    assert.ok(reintentar, "tiene que haber un botón para reintentar");
    assert.equal(caja.querySelectorAll(".kpi").length, 0);
    assert.ok(grafico.querySelector("[data-reintentar]"), "el gráfico diario también tiene que ofrecer reintentar");
  });

  test("los últimos seis meses y las categorías también muestran su error con reintentar", async () => {
    const { dom, graficoSeis, categorias } = await montar({
      apiGet: async () => {
        throw new Error("sin red");
      },
    });
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    assert.ok(graficoSeis.querySelector("[data-reintentar]"));
    assert.ok(categorias.querySelector("[data-reintentar]"));
  });

  test("tocar reintentar vuelve a pedir el mismo período, y recupera los cuatro paneles", async () => {
    let falla = true;
    const { dom, caja, graficoSeis, categorias, llamadas } = await montar({
      apiGet: async () => {
        if (falla) {
          falla = false;
          throw new Error("sin red");
        }
        return respuestaBase();
      },
    });
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    caja.querySelector("[data-reintentar]").click();
    await esperar();

    assert.equal(caja.querySelectorAll(".kpi").length, 5, "el reintento tiene que haber pintado las tarjetas");
    assert.ok(graficoSeis.querySelector("svg"), "el reintento tiene que haber pintado los últimos seis meses");
    assert.equal(categorias.querySelectorAll(".row").length, 2, "el reintento tiene que haber pintado las categorías");
    const pedidos = llamadas.apiGet.filter((a) => a[0].startsWith("/dashboard?"));
    assert.equal(pedidos.length, 2);
    assert.match(pedidos[1][0], /month=10/);
  });
});
