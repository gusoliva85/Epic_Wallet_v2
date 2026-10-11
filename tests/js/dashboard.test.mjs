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
      'import { esc, fmt, fmtS, pct, pctPlano } from "./format.js";',
      `import { esc, fmt, fmtS, pct, pctPlano } from "${rutaAbsoluta("format.js")}";`,
    )
    .replace(
      'import { tarjetaHeroe, tarjetaMetrica, pintarTarjetas, animarCifras } from "./components/kpi.js";',
      `import { tarjetaHeroe, tarjetaMetrica, pintarTarjetas, animarCifras } from "${rutaAbsoluta("components", "kpi.js")}";`,
    )
    .replace(
      'import { bloqueCargando, error as estadoError, consolidado } from "./components/estados.js";',
      `import { bloqueCargando, error as estadoError, consolidado } from "${rutaAbsoluta("components", "estados.js")}";`,
    )
    .replace(
      'import { EVENTO_CAMBIO } from "./barra-mes.js";',
      'const EVENTO_CAMBIO = "mes:cambiado";',
    )
    .replace(
      'import { dibujar as dibujarGraficoDiario, MODOS as MODOS_DIARIO } from "./charts/diario.js";',
      `import { dibujar as dibujarGraficoDiario, MODOS as MODOS_DIARIO } from "${rutaAbsoluta("charts", "diario.js")}";`,
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
      income: Array(10).fill("0.00"),
      expense: Array(9).fill("0.00").concat(["15000.00"]),
      saving_cumulative: Array(9).fill("0.00").concat(["-15000.00"]),
      income_cumulative: Array(10).fill("0.00"),
      expense_cumulative: Array(9).fill("0.00").concat(["15000.00"]),
      peak_expense: { day: 10, amount: "15000.00" },
      days_without_expense: 9,
    },
    last_six_months: [],
    categories: [],
    recent_transactions: [],
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
    <button type="button" data-modo="acumulado">Acumulado</button>
  </div>
  <div class="chart-wrap" id="grafico-diario"></div>
  <div class="chart-foot" id="pie-diario"></div>
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
    pie: $$("pie-diario"),
    modoDiario: $$("diario-modo"),
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
          ["recent_transactions", null],
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

  test("el pie de cifras muestra el ahorro acumulado hoy, el pico de gasto y los días sin gasto", async () => {
    const { dom, pie } = await montar();
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    const texto = pie.textContent;
    assert.match(texto, /Ahorro acumulado hoy/);
    assert.match(texto, /−\$15\.000/); // saving_cumulative.at(-1) de la base
    assert.match(texto, /Pico de gasto/);
    assert.match(texto, /\$15\.000 · día 10/);
    assert.match(texto, /Días sin gasto9/); // sin separador: .num es el hermano directo de .span
  });

  test("sin gastos todavía, el pico de gasto lo dice en vez de mostrar un día inventado", async () => {
    const { dom, pie } = await montar({
      apiGet: async () => conCambios(respuestaBase(), [["daily.peak_expense", null]]),
    });
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    assert.match(pie.textContent, /Sin gastos todavía/);
  });

  test("el modo por defecto es «ambos»: barras, sin áreas acumuladas", async () => {
    const { dom, grafico } = await montar();
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    assert.ok(grafico.querySelector("rect.bar"), "tiene que haber barras");
    assert.equal(grafico.querySelector("linearGradient"), null, "el modo 'ambos' no es el acumulado");
  });

  test("tocar «Acumulado» redibuja con las áreas, sin barras", async () => {
    const { dom, grafico, modoDiario } = await montar();
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    modoDiario.querySelector('[data-modo="acumulado"]').click();

    assert.equal(grafico.querySelector("rect.bar"), null, "el modo acumulado no dibuja barras");
    assert.ok(grafico.querySelector("linearGradient"), "el modo acumulado dibuja las áreas con gradiente");
  });

  test("volver a «Ambos» redibuja las barras de nuevo", async () => {
    const { dom, grafico, modoDiario } = await montar();
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    modoDiario.querySelector('[data-modo="acumulado"]').click();
    modoDiario.querySelector('[data-modo="ambos"]').click();

    assert.ok(grafico.querySelector("rect.bar"));
  });

  test("tocar el modo que ya está activo no pide nada de nuevo ni rompe", async () => {
    const { dom, grafico, modoDiario } = await montar();
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    modoDiario.querySelector('[data-modo="ambos"]').click();
    assert.ok(grafico.querySelector("rect.bar"));
  });

  test("un mes histórico muestra el estado consolidado, no un gráfico inventado (Regla 4)", async () => {
    const { dom, grafico, pie } = await montar({
      apiGet: async () =>
        conCambios(respuestaBase(), [
          ["month.status", "historical"],
          ["month.consolidated", true],
          ["month.is_current", false],
          ["daily", null],
          ["recent_transactions", null],
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
    assert.equal(pie.innerHTML, "", "sin cifras que no haya — Regla 4");
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
    assert.ok(grafico.querySelector("[data-reintentar]"), "el gráfico también tiene que ofrecer reintentar");
  });

  test("tocar reintentar vuelve a pedir el mismo período", async () => {
    let falla = true;
    const { dom, caja, llamadas } = await montar({
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
    const pedidos = llamadas.apiGet.filter((a) => a[0].startsWith("/dashboard?"));
    assert.equal(pedidos.length, 2);
    assert.match(pedidos[1][0], /month=10/);
  });
});
