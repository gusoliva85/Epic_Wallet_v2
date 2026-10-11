/* Pruebas del gráfico de evolución del ahorro acumulado · F06-T07
   Referencia: 01_Documento_General.md §54 · 02_Documento_Tecnico.md §14.3

   El criterio de aceptación de la tarea es "la evolución del ahorro
   usa el acumulado real" — ya lo prueba el backend
   (`tests/api/test_months_endpoints.py`). Acá lo que puede fallar en
   silencio es la parte de dibujo: un saldo que cruza a negativo tiene
   que verse cruzando el cero, no clavado ahí, y un solo mes no tiene
   que romper el gráfico. */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { dibujar } from "../../web/src/js/charts/ahorro.js";

function punto({ year = 2026, month = 10, balance = "500000.00" }) {
  return { year, month, balance };
}

describe("con un solo mes", () => {
  test("no rompe y dibuja un único punto", () => {
    const svg = dibujar([punto({})]);
    assert.equal((svg.match(/punto-brillante/g) || []).length, 1);
    // Un solo punto no forma un área: no hay dos extremos que cerrar.
    assert.equal((svg.match(/class="areafill" d/g) || []).length, 0);
  });
});

describe("sin meses", () => {
  test("no rompe (defensivo: en la práctica siempre hay al menos el mes actual)", () => {
    assert.doesNotThrow(() => dibujar([]));
  });
});

describe("con varios meses, todos con saldo positivo", () => {
  test("una sola línea continua, sin línea de cero punteada", () => {
    const serie = [
      punto({ month: 8, balance: "300000.00" }),
      punto({ month: 9, balance: "450000.00" }),
      punto({ month: 10, balance: "500000.00" }),
    ];
    const svg = dibujar(serie);
    assert.equal((svg.match(/class="lineseries"/g) || []).length, 1);
    assert.equal((svg.match(/class="areafill" d/g) || []).length, 1);
    assert.doesNotMatch(svg, /stroke-dasharray/);
  });

  test("el punto brillante y su etiqueta quedan en el mes más reciente, no en el primero", () => {
    const serie = [punto({ month: 8, balance: "100000.00" }), punto({ month: 10, balance: "900000.00" })];
    const svg = dibujar(serie);
    // El valor del último punto ($900.000 → "$900k") tiene que
    // aparecer como etiqueta; el del primero, no.
    assert.match(svg, />\$900k</);
    assert.doesNotMatch(svg, />\$100k</);
  });
});

describe("el saldo puede cruzar a negativo", () => {
  test("con un mínimo negativo aparece la línea de cero punteada", () => {
    const serie = [punto({ month: 9, balance: "50000.00" }), punto({ month: 10, balance: "-30000.00" })];
    const svg = dibujar(serie);
    assert.match(svg, /stroke-dasharray/);
  });

  test("el punto negativo queda más abajo en pantalla que uno positivo (Y crece hacia abajo)", () => {
    const serie = [punto({ month: 9, balance: "200000.00" }), punto({ month: 10, balance: "-50000.00" })];
    const svg = dibujar(serie);
    const cys = [...svg.matchAll(/cy="([\d.]+)"/g)].map((m) => Number(m[1]));
    // El único `cy` dibujado es el del último mes (negativo): tiene
    // que estar por debajo de donde cae la línea de cero.
    const [yCero] = [...svg.matchAll(/y1="([\d.]+)"[^>]*stroke-dasharray/g)].map((m) => Number(m[1]));
    assert.ok(cys[0] > yCero, "el punto negativo tiene que quedar debajo de la línea de cero");
  });
});

describe("las etiquetas del eje", () => {
  test("mes completo y año, igual que el gráfico de los últimos seis meses", () => {
    const svg = dibujar([punto({ year: 2026, month: 10 })]);
    assert.match(svg, />Octubre 26</);
  });
});
