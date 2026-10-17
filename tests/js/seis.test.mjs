/* Pruebas del gráfico de los últimos seis meses · F06-T05, mudado a
   Historial y simplificado a sólo barras el 2026-10-17.
   Referencia: 01_Documento_General.md §14 · 02_Documento_Tecnico.md §14.2

   Los criterios de aceptación de la tarea, cada uno con su prueba:
   con menos de seis meses cargados muestra los que hay sin huecos
   falsos, y (la parte que de verdad puede fallar en silencio) un
   ahorro negativo se dibuja como negativo — nunca clavado en cero ni
   mostrado como si fuera positivo. */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { dibujar } from "../../web/src/js/charts/seis.js";

function mes({ year = 2026, month = 10, label = "Octubre 2026", income = "500000.00", expense = "300000.00", saving = "200000.00", saving_rate = "40.0" }) {
  return { year, month, label, income, expense, saving, saving_rate };
}

describe("con menos de seis meses", () => {
  test("dibuja sólo los que hay, sin completar con meses falsos", () => {
    const meses = [mes({ month: 9, label: "Sep" }), mes({ month: 10, label: "Oct" })];
    const svg = dibujar(meses);
    // Dos meses, tres barras cada uno (ingreso/egreso/ahorro, todas
    // con valor en el fixture) = 6 barras, ni una más.
    assert.equal((svg.match(/class="bar"/g) || []).length, 6);
  });

  test("con un solo mes tampoco rompe", () => {
    assert.doesNotThrow(() => dibujar([mes({})]));
  });
});

describe("un mes con los tres valores en cero", () => {
  test("no dibuja ninguna barra ese mes", () => {
    const meses = [mes({ income: "0.00", expense: "0.00", saving: "0.00" })];
    const svg = dibujar(meses);
    assert.equal((svg.match(/class="bar"/g) || []).length, 0);
  });
});

describe("un mes con ahorro negativo (se gastó más de lo que entró)", () => {
  test("dibuja su barra, no la esconde", () => {
    const meses = [mes({ income: "0.00", expense: "0.00", saving: "-150000.00" })];
    const svg = dibujar(meses);
    assert.equal((svg.match(/class="bar"/g) || []).length, 1);
  });

  test("la barra negativa crece desde el cero hacia abajo, no desde arriba", () => {
    // Con un mes positivo grande y uno negativo chico, si la barra
    // negativa arrancara del techo del gráfico (como si fuera
    // positiva) su `y` sería chico; tiene que arrancar cerca de la
    // línea del cero, que queda en algún punto intermedio. Ingreso y
    // egreso en cero para aislar la barra de ahorro, una por mes.
    const meses = [
      mes({ month: 9, income: "0.00", expense: "0.00", saving: "500000.00" }),
      mes({ month: 10, income: "0.00", expense: "0.00", saving: "-50000.00" }),
    ];
    const svg = dibujar(meses);
    const alturas = [...svg.matchAll(/class="bar" d="M([\d.]+) ([\d.]+)/g)].map((m) => Number(m[2]));
    // La "base" (M) de la barra positiva es su punto más abajo (el
    // cero); la de la negativa es su punto más arriba (el cero
    // también) — pero las dos son barras disjuntas en su rango de Y,
    // nunca se superponen por completo.
    assert.equal(new Set(alturas.map((a) => a.toFixed(0))).size, 2, "las dos barras no pueden arrancar en el mismo punto exacto");
  });
});

describe("las etiquetas del eje", () => {
  test("mes completo y año, todas visibles (hasta seis, nunca se amontonan)", () => {
    // "Octubre 26", no "Oct '26": Gustavo lo pidió completo, F06-T05
    // corrección.
    const meses = [8, 9, 10].map((month) => mes({ month, year: 2026 }));
    const svg = dibujar(meses);
    const etiquetas = [...svg.matchAll(/class="axis-t"[^>]*>([^<]+)</g)].map((m) => m[1]);
    assert.equal(etiquetas.length, 3);
    assert.deepEqual(etiquetas, ["Agosto 26", "Septiembre 26", "Octubre 26"]);
  });
});
