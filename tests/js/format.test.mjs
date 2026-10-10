/* Pruebas de formato de importes · F05-T07
   Referencia: 02_Documento_Tecnico.md §12.5

   Funciones puras de texto: no hace falta jsdom, alcanza con
   importarlas directo. El criterio de aceptación de la tarea que vive
   acá es "las cifras no cambian de ancho al actualizarse" —eso lo
   protege `tabular-nums` en CSS, no estas pruebas— y "formato de
   importes en pesos argentinos", que sí es texto y se prueba acá. */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { toNum, fmt, fmtS, fmtK, pct, pctPlano } from "../../web/src/js/format.js";

describe("toNum", () => {
  test("un string decimal del backend se vuelve número", () => {
    assert.equal(toNum("1234.50"), 1234.5);
  });

  test("null o undefined son cero, no NaN", () => {
    // Un importe ausente tiene que mostrarse como cero de verdad, no
    // romper el resto del cálculo de formato con un NaN.
    assert.equal(toNum(null), 0);
    assert.equal(toNum(undefined), 0);
  });
});

describe("fmt", () => {
  test("separador de miles es-AR, sin decimales", () => {
    assert.equal(fmt(3491280), "$3.491.280");
  });

  test("redondea en vez de truncar", () => {
    assert.equal(fmt(999.6), "$1.000");
  });

  test("nunca lleva signo: eso lo decide quien llama", () => {
    assert.equal(fmt(-42000), "$42.000");
  });

  test("el cero se muestra, no desaparece", () => {
    assert.equal(fmt(0), "$0");
    assert.equal(fmt(null), "$0");
  });
});

describe("fmtS", () => {
  test("negativo lleva el menos tipográfico U+2212, no el guión", () => {
    const resultado = fmtS(-42000);
    assert.equal(resultado, "−$42.000");
    assert.notEqual(resultado[0], "-", "tiene que ser U+2212, no el guión del teclado");
  });

  test("positivo no lleva signo", () => {
    assert.equal(fmtS(42000), "$42.000");
  });

  test("cero no lleva signo", () => {
    assert.equal(fmtS(0), "$0");
  });
});

describe("fmtK", () => {
  test("millones con dos decimales bajo los diez millones", () => {
    assert.equal(fmtK(3491280), "$3,49M");
  });

  test("millones con un decimal desde los diez millones", () => {
    assert.equal(fmtK(12_345_000), "$12,3M");
  });

  test("miles sin decimales", () => {
    assert.equal(fmtK(340000), "$340k");
  });

  test("por debajo de mil, el importe entero", () => {
    assert.equal(fmtK(850), "$850");
  });

  test("negativos con el menos tipográfico", () => {
    assert.equal(fmtK(-340000), "−$340k");
  });
});

describe("pct — variación, siempre con signo", () => {
  test("null es N/A, nunca 0% ni un error", () => {
    // Criterio de aceptación de F05-T01/calc.py, repetido acá del lado
    // del formato: sin mes anterior no hay variación que mostrar.
    assert.equal(pct(null), "N/A");
  });

  test("positivo lleva +", () => {
    assert.equal(pct(31.7), "+31,7%");
  });

  test("negativo lleva el menos tipográfico", () => {
    assert.equal(pct(-12), "−12,0%");
  });

  test("cero no lleva signo", () => {
    assert.equal(pct(0), "0,0%");
  });

  test("coma decimal, no punto", () => {
    assert.equal(pct(22.86), "+22,9%");
  });
});

describe("pctPlano — proporción, nunca fuerza signo", () => {
  test("null es N/A", () => {
    assert.equal(pctPlano(null), "N/A");
  });

  test("una tasa de ahorro positiva no lleva +", () => {
    // Es una proporción, no una mejora respecto de algo: antepone "+"
    // leería como una variación que no existe.
    assert.equal(pctPlano(22.9), "22,9%");
  });

  test("una tasa de ahorro negativa sí se distingue, con el menos", () => {
    assert.equal(pctPlano(-12), "−12,0%");
  });
});
