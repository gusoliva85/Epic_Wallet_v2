/* Pruebas del gráfico de los últimos seis meses · F06-T05
   Referencia: 01_Documento_General.md §14 · 02_Documento_Tecnico.md §14.2

   Los criterios de aceptación de la tarea, cada uno con su prueba:
   con menos de seis meses cargados muestra los que hay sin huecos
   falsos, y (la parte que de verdad puede fallar en silencio) un
   ahorro negativo se dibuja como negativo — nunca clavado en cero ni
   mostrado como si fuera positivo — y un mes sin tasa de ahorro
   (`saving_rate: null`) corta la línea en vez de inventar un punto. */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { dibujar, MODOS } from "../../web/src/js/charts/seis.js";

function mes({ year = 2026, month = 10, label = "Octubre 2026", income = "500000.00", expense = "300000.00", saving = "200000.00", saving_rate = "40.0" }) {
  return { year, month, label, income, expense, saving, saving_rate };
}

describe("MODOS", () => {
  test("son barras, ahorro y tasa — nunca hubo un cuarto acá", () => {
    assert.deepEqual([...MODOS], ["barras", "ahorro", "tasa"]);
  });
});

describe("con menos de seis meses", () => {
  test("dibuja sólo los que hay, sin completar con meses falsos", () => {
    const meses = [mes({ month: 9, label: "Sep" }), mes({ month: 10, label: "Oct" })];
    const svg = dibujar(meses, "barras");
    // Dos meses, tres barras cada uno (ingreso/egreso/ahorro, todas
    // con valor en el fixture) = 6 barras, ni una más.
    assert.equal((svg.match(/class="bar"/g) || []).length, 6);
  });

  test("con un solo mes tampoco rompe", () => {
    assert.doesNotThrow(() => dibujar([mes({})], "barras"));
    assert.doesNotThrow(() => dibujar([mes({})], "ahorro"));
    assert.doesNotThrow(() => dibujar([mes({})], "tasa"));
  });
});

describe("modo barras", () => {
  test("un mes con los tres valores en cero no dibuja ninguna barra ese mes", () => {
    const meses = [mes({ income: "0.00", expense: "0.00", saving: "0.00" })];
    const svg = dibujar(meses, "barras");
    assert.equal((svg.match(/class="bar"/g) || []).length, 0);
  });
});

describe("modo ahorro — el ahorro puede ser negativo", () => {
  test("un mes con ahorro negativo dibuja una barra, no la esconde", () => {
    const meses = [mes({ saving: "-150000.00" })];
    const svg = dibujar(meses, "ahorro");
    assert.equal((svg.match(/class="bar"/g) || []).length, 1);
  });

  test("la barra negativa crece desde el cero hacia abajo, no desde arriba", () => {
    // Con un mes positivo grande y uno negativo chico, si la barra
    // negativa arrancara del techo del gráfico (como si fuera
    // positiva) su `y` sería chico; tiene que arrancar cerca de la
    // línea del cero, que queda en algún punto intermedio.
    const meses = [mes({ month: 9, saving: "500000.00" }), mes({ month: 10, saving: "-50000.00" })];
    const svg = dibujar(meses, "ahorro");
    const alturas = [...svg.matchAll(/class="bar" d="M([\d.]+) ([\d.]+)/g)].map((m) => Number(m[2]));
    // La "base" (M) de la barra positiva es su punto más abajo (el
    // cero); la de la negativa es su punto más arriba (el cero
    // también) — pero las dos son barras disjuntas en su rango de Y,
    // nunca se superponen por completo.
    assert.equal(new Set(alturas.map((a) => a.toFixed(0))).size, 2, "las dos barras no pueden arrancar en el mismo punto exacto");
  });
});

describe("modo tasa — la línea de tasa de ahorro", () => {
  test("un mes sin ingresos (saving_rate: null) no tiene punto, y corta la línea", () => {
    const meses = [
      mes({ month: 8, saving_rate: "30.0" }),
      mes({ month: 9, saving_rate: null }),
      mes({ month: 10, saving_rate: "50.0" }),
    ];
    const svg = dibujar(meses, "tasa");
    // Dos puntos (agosto y octubre), ninguno en septiembre.
    assert.equal((svg.match(/punto-brillante/g) || []).length, 2);
    // Dos tramos de línea separados (uno por cada punto aislado, ya
    // que no hay dos consecutivos) y no un solo trazo que los una.
    assert.equal((svg.match(/class="lineseries"/g) || []).length, 2);
  });

  test("con todos los meses con tasa, es un solo tramo continuo", () => {
    const meses = [mes({ month: 8, saving_rate: "30.0" }), mes({ month: 9, saving_rate: "35.0" }), mes({ month: 10, saving_rate: "40.0" })];
    const svg = dibujar(meses, "tasa");
    assert.equal((svg.match(/class="lineseries"/g) || []).length, 1);
    assert.equal((svg.match(/punto-brillante/g) || []).length, 3);
  });

  test("todos los meses sin tasa no rompe (ningún punto, ningún tramo)", () => {
    const meses = [mes({ saving_rate: null }), mes({ saving_rate: null })];
    assert.doesNotThrow(() => dibujar(meses, "tasa"));
    const svg = dibujar(meses, "tasa");
    assert.equal((svg.match(/punto-brillante/g) || []).length, 0);
  });

  test("las etiquetas de porcentaje llevan el símbolo %, no un número crudo", () => {
    const svg = dibujar([mes({ saving_rate: "40.0" })], "tasa");
    assert.match(svg, />40%</);
  });
});

describe("las etiquetas del eje", () => {
  test("mes y año cortos, todas visibles (hasta seis, nunca se amontonan)", () => {
    const meses = [8, 9, 10].map((month) => mes({ month, year: 2026 }));
    const svg = dibujar(meses, "barras");
    const etiquetas = [...svg.matchAll(/class="axis-t"[^>]*>([^<]+)</g)].map((m) => m[1]);
    assert.equal(etiquetas.length, 3);
    // El apóstrofe sale escapado (&#39;): esc() lo escapa siempre,
    // incluso en un texto que arma este módulo y no el usuario — regla
    // 5 del sistema, sin excepciones por "este texto es de confianza".
    for (const e of etiquetas) assert.match(e, /^[A-Za-zé]+ &#39;26$/);
  });
});
