/* Pruebas de las utilidades de gráficos SVG · F06-T01
   Referencia: 02_Documento_Tecnico.md §14.3

   Lo que un gráfico se vea bien a 390 px o a 1440 px es visual y se
   revisa mirando la pantalla, no acá (CLAUDE.md: "no se testea la
   estructura del HTML"). Lo que SÍ da un número y se prueba: la
   escala del eje (`escalaRedonda`), que un gasto chico no desaparezca
   del gráfico (`alturaDeBarra`), y que las etiquetas —que van a traer
   nombres de categoría que escribió el usuario, en F06-T05— se
   escapen antes de entrar al SVG. */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  escalaRedonda,
  alturaDeBarra,
  trazoBarraRedondeada,
  etiquetaSvg,
  grilla,
  ejeDeCategorias,
  idUnico,
} from "../../web/src/js/charts/svg.js";

describe("escalaRedonda", () => {
  test("cero o negativo da una escala mínima de 1, nunca cero", () => {
    // Un eje en cero dividiría por cero en `alturaDeBarra` y en todo
    // lo que dibuje el gráfico después.
    assert.equal(escalaRedonda(0), 1);
    assert.equal(escalaRedonda(-500), 1);
  });

  test("redondea hacia arriba al primer paso que alcanza", () => {
    assert.equal(escalaRedonda(950), 1000); // 0,95 · 10^3 → paso 1
    assert.equal(escalaRedonda(1100), 1200); // 1,1 · 10^3 → paso 1,2
    assert.equal(escalaRedonda(4_900_000), 5_000_000);
  });

  test("un valor que ya cae justo en un paso no sube de más", () => {
    assert.equal(escalaRedonda(2500), 2500);
    assert.equal(escalaRedonda(2_000_000), 2_000_000);
  });

  test("NaN no rompe el gráfico: cae en el mínimo", () => {
    assert.equal(escalaRedonda(NaN), 1);
  });
});

describe("alturaDeBarra", () => {
  test("un gasto chico nunca da menos de 1,5 px: así no desaparece", () => {
    assert.equal(alturaDeBarra(1, 1_000_000, 200), 1.5);
  });

  test("un valor en cero da cero: no hay barra que dibujar", () => {
    assert.equal(alturaDeBarra(0, 1000, 200), 0);
  });

  test("proporcional al máximo del eje", () => {
    assert.equal(alturaDeBarra(500, 1000, 200), 100);
    assert.equal(alturaDeBarra(1000, 1000, 200), 200);
  });

  test("una escala en cero no divide por cero", () => {
    assert.equal(alturaDeBarra(500, 0, 200), 0);
  });
});

describe("trazoBarraRedondeada", () => {
  test("empieza y termina en la base, línea recta abajo", () => {
    // El borde de abajo tiene que quedar recto, apoyado en el eje: una
    // barra con las cuatro esquinas iguales parece flotar.
    const d = trazoBarraRedondeada(10, 50, 20, 100, 4);
    assert.match(d, /^M10\.0 150\.0/, "arranca en la base (yTope + alto)");
    assert.match(d, /L30\.0 150\.0 Z$/, "termina en la base, sin curva");
  });

  test("el radio se recorta si no entra en el ancho o el alto", () => {
    // Un radio de 20 en una barra de 6 de ancho desbordaría: tiene que
    // quedar en 3 (la mitad del ancho), o la curva se superpondría.
    const d = trazoBarraRedondeada(0, 0, 6, 100, 20);
    assert.match(d, /Q0\.0 0\.0 3\.0 0\.0/);
  });

  test("con radio cero, es un rectángulo derecho (cuatro esquinas sin curva)", () => {
    const d = trazoBarraRedondeada(0, 0, 10, 50, 0);
    assert.ok(!d.includes("Q"), "sin curvas Q cuando el radio es cero");
  });

  test("una barra de alto cero no rompe (el radio no puede ser mayor que el alto)", () => {
    assert.doesNotThrow(() => trazoBarraRedondeada(0, 100, 10, 0, 4));
  });
});

describe("etiquetaSvg", () => {
  test("lleva el viewBox con el ancho y el alto pedidos, y ningún tamaño fijo", () => {
    const svg = etiquetaSvg(760, 262);
    assert.match(svg, /viewBox="0 0 760 262"/);
    assert.ok(!/width="\d/.test(svg), "no tiene que fijar un ancho en píxeles");
    assert.ok(!/height="\d/.test(svg), "no tiene que fijar un alto en píxeles");
  });

  test("lleva role img, para que un lector lo anuncie como una imagen", () => {
    assert.match(etiquetaSvg(100, 100), /role="img"/);
  });
});

describe("grilla", () => {
  test("una línea y una etiqueta por paso, cinco con el valor por defecto", () => {
    const svg = grilla({ x: 50, y: 10, ancho: 600, alto: 200, maximo: 1000 });
    assert.equal((svg.match(/<line/g) || []).length, 5);
    assert.equal((svg.match(/<text/g) || []).length, 5);
  });

  test("la etiqueta de cada línea pasa por el formato pedido", () => {
    const svg = grilla({
      x: 0,
      y: 0,
      ancho: 100,
      alto: 100,
      maximo: 100,
      formatear: (n) => `#${n}#`,
      pasos: 1,
    });
    assert.match(svg, />#0#</);
    assert.match(svg, />#100#</);
  });

  test("una etiqueta con caracteres de HTML se escapa", () => {
    const svg = grilla({
      x: 0,
      y: 0,
      ancho: 100,
      alto: 100,
      maximo: 10,
      formatear: () => "<script>window.ejecuto=true</script>",
    });
    assert.ok(!svg.includes("<script>"), "el texto crudo no puede entrar sin escapar");
    assert.match(svg, /&lt;script&gt;/);
  });
});

describe("ejeDeCategorias", () => {
  test("con pocas etiquetas, entran todas", () => {
    const svg = ejeDeCategorias(["Ene", "Feb", "Mar"], { x: 0, ancho: 300, y: 20 });
    assert.equal((svg.match(/<text/g) || []).length, 3);
  });

  test("con muchas, salta de a varias pero la última siempre queda", () => {
    const dias = Array.from({ length: 31 }, (_, i) => String(i + 1));
    const svg = ejeDeCategorias(dias, { x: 0, ancho: 700, y: 20 });
    const cantidad = (svg.match(/<text/g) || []).length;
    assert.ok(cantidad < 31, "31 etiquetas amontonadas no se pueden leer");
    assert.match(svg, />31</, "la última etiqueta (día 31) tiene que quedar");
  });

  test("con todas:true no salta ninguna, aunque haya muchas (F06-T02)", () => {
    // El gráfico diario las quiere todas, sin saltear — es lo que pidió
    // Gustavo, a diferencia del comportamiento por defecto de arriba.
    const dias = Array.from({ length: 31 }, (_, i) => String(i + 1));
    const svg = ejeDeCategorias(dias, { x: 0, ancho: 700, y: 20, todas: true });
    assert.equal((svg.match(/<text/g) || []).length, 31);
  });

  test("sin etiquetas no rompe, no dibuja nada", () => {
    assert.equal(ejeDeCategorias([], { x: 0, ancho: 100, y: 20 }), "");
  });

  test("un nombre de categoría con HTML se escapa", () => {
    // F06-T05 va a pasar nombres de categoría acá, y esos los escribe
    // el usuario.
    const svg = ejeDeCategorias(['<img src=x onerror="window.ejecuto=true">'], {
      x: 0,
      ancho: 100,
      y: 20,
    });
    assert.ok(!svg.includes("<img"));
  });

  test("centradoEnSlot ubica cada etiqueta al medio de su franja", () => {
    const svg = ejeDeCategorias(["a", "b"], { x: 0, ancho: 200, y: 20, centradoEnSlot: true });
    assert.match(svg, /x="50\.0"/); // franja de 100: centro en 50
    assert.match(svg, /x="150\.0"/); // segunda franja: centro en 150
  });
});

describe("idUnico", () => {
  test("dos llamadas nunca dan el mismo id", () => {
    const a = idUnico();
    const b = idUnico();
    assert.notEqual(a, b);
  });

  test("usa el prefijo pedido", () => {
    assert.match(idUnico("gradiente"), /^gradiente\d+$/);
  });
});
