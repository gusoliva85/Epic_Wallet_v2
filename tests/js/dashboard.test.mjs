/* Pruebas de los seis indicadores del tablero · F05-T07
   Se corren con `npm test` (`node --test tests/js/*.test.mjs`).

   Misma técnica que `movimientos.test.mjs`: el módulo se carga con
   `api.get` doblado (para no depender de una red de verdad) y
   `EVENTO_CAMBIO` reemplazado por su valor literal, en vez de importar
   `barra-mes.js` entero. `kpi.js`, `format.js` y `estados.js` SÍ se
   importan de verdad: son los que deciden qué cifra va en qué tarjeta,
   y es justo lo que estas pruebas tienen que proteger.

   Los criterios de aceptación de la tarea, cada uno con su prueba: los
   seis indicadores muestran lo mismo que la API, un mes sin datos
   muestra ceros con su explicación (no una pantalla en blanco ni un
   error), y con la red caída se ve un error entendible con botón para
   reintentar. */

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
      'import { fmt, fmtS, pct, pctPlano } from "./format.js";',
      `import { fmt, fmtS, pct, pctPlano } from "${rutaAbsoluta("format.js")}";`,
    )
    .replace(
      'import { tarjetaHeroe, tarjetaMetrica, pintarTarjetas, animarCifras } from "./components/kpi.js";',
      `import { tarjetaHeroe, tarjetaMetrica, pintarTarjetas, animarCifras } from "${rutaAbsoluta("components", "kpi.js")}";`,
    )
    .replace(
      'import { bloqueCargando, error as estadoError } from "./components/estados.js";',
      `import { bloqueCargando, error as estadoError } from "${rutaAbsoluta("components", "estados.js")}";`,
    )
    .replace(
      'import { EVENTO_CAMBIO } from "./barra-mes.js";',
      'const EVENTO_CAMBIO = "mes:cambiado";',
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
      savings_balance: "1200000.00",
      investments_value: "0.00",
      net_worth: "1200000.00",
      vs_previous: { income: "12.0", expense: "-5.0", saving: "31.7" },
    },
    daily: {
      days: 10,
      income: Array(10).fill("0.00"),
      expense: Array(9).fill("0.00").concat(["15000.00"]),
      saving_cumulative: Array(10).fill("0.00"),
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

async function montar({ apiGet } = {}) {
  const dom = new JSDOM(
    `<!doctype html><html><body><div class="kpi-grid stagger" id="kpis-inicio"></div></body></html>`,
    {
      url: "https://epic-wallet-v2.vercel.app/#/inicio",
      pretendToBeVisual: true,
    },
  );
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
  return { dom, mod, llamadas, caja: dom.window.document.getElementById("kpis-inicio") };
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

describe("las seis tarjetas", () => {
  test("hay una heroe y cinco de color, en el orden de General §12.2", async () => {
    const { dom, caja } = await montar();
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    assert.equal(caja.querySelectorAll(".kpi--hero").length, 1);
    assert.deepEqual(etiquetas(caja), [
      "Ahorro del mes",
      "Ingresos",
      "Egresos",
      "Total de ahorros",
      "Patrimonio",
      "Gasto de hoy",
    ]);
  });

  test("cada cifra es la que mandó la API, formateada en pesos", async () => {
    const { dom, caja } = await montar();
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    assert.equal(cifraDe(caja, "Ahorro del mes"), "$335.000");
    assert.equal(cifraDe(caja, "Ingresos"), "$500.000");
    assert.equal(cifraDe(caja, "Egresos"), "$165.000");
    assert.equal(cifraDe(caja, "Total de ahorros"), "$1.200.000");
    assert.equal(cifraDe(caja, "Patrimonio"), "$1.200.000");
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
  test("en el mes actual, muestra el gasto de hoy y el promedio diario", async () => {
    const { dom, caja } = await montar();
    await esperar();
    cambiarMes(dom, MES_ACTUAL);
    await esperar();

    assert.equal(cifraDe(caja, "Gasto de hoy"), "$15.000");
    assert.match(subDe(caja, "Gasto de hoy"), /Promedio diario/);
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

    assert.equal(caja.querySelectorAll(".kpi").length, 6, "las seis tarjetas siguen, no desaparecen");
    assert.equal(cifraDe(caja, "Ingresos"), "$0");
    assert.equal(cifraDe(caja, "Gasto de hoy"), "$0");
    assert.equal(subDe(caja, "Ahorro del mes"), "Sin ingresos registrados");
  });
});

describe("si la API falla", () => {
  test("muestra un error entendible con botón para reintentar, no rompe la pantalla", async () => {
    const { dom, caja } = await montar({
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

    assert.equal(caja.querySelectorAll(".kpi").length, 6, "el reintento tiene que haber pintado las tarjetas");
    const pedidos = llamadas.apiGet.filter((a) => a[0].startsWith("/dashboard?"));
    assert.equal(pedidos.length, 2);
    assert.match(pedidos[1][0], /month=10/);
  });
});
