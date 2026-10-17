/* Pruebas de la vista Cartera · F10-T08
   Se corren con `npm test` (`node --test tests/js/*.test.mjs`).

   Misma técnica que `alta-movimiento.test.mjs` (dos hojas, POST/PUT/DELETE
   doblados) y `patrimonio.test.mjs`/`dashboard.test.mjs` (el HTML sale del
   `index.html` real, `kpi.js`/`format.js`/`estados.js`/`sheet.js` se
   importan de verdad). `GET /api/investments` trae los indicadores Y la
   tabla en una sola llamada (F10-T06): se dobla una sola vez.

   Los tres criterios de aceptación de la tarea, cada uno con su prueba:
   cargar una posición y actualizar su valor (POST y PUT, los dos modos de
   valuación), el rendimiento en color según el signo (tabla y tarjeta), y
   vender pide confirmación y deja el ahorro actualizado (`window.confirm`,
   `invalidarMeses`). */

import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..");
const INDEX = resolve(RAIZ, "web", "index.html");

function rutaAbsoluta(...partes) {
  return `file:///${resolve(RAIZ, "web", "src", "js", ...partes).replace(/\\/g, "/")}`;
}

const { ApiError } = await import(rutaAbsoluta("api.js"));

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

function recortarEtiqueta(html, etiqueta, ancla) {
  const desde = html.lastIndexOf(`<${etiqueta}`, ancla);
  const hasta = html.indexOf(`</${etiqueta}>`, ancla) + `</${etiqueta}>`.length;
  return html.slice(desde, hasta);
}

function htmlDeCartera() {
  const html = readFileSync(INDEX, "utf8");
  const ancla = html.indexOf('data-vista="inversiones"');
  assert.notEqual(ancla, -1, "no se encuentra la vista Cartera en index.html");
  return recortarEtiqueta(html, "section", ancla);
}

function htmlDeHojaAlta() {
  const html = readFileSync(INDEX, "utf8");
  const ancla = html.indexOf('id="hoja-inversion"');
  assert.notEqual(ancla, -1, "no se encuentra la hoja de alta de inversión en index.html");
  return recortarEtiqueta(html, "aside", ancla);
}

function htmlDeHojaDetalle() {
  const html = readFileSync(INDEX, "utf8");
  const ancla = html.indexOf('id="hoja-inversion-detalle"');
  assert.notEqual(ancla, -1, "no se encuentra la hoja de detalle de inversión en index.html");
  return recortarEtiqueta(html, "aside", ancla);
}

async function cargarConDobles() {
  let codigo = readFileSync(resolve(RAIZ, "web", "src", "js", "cartera.js"), "utf8");
  codigo = codigo
    .replace(
      'import { api, ApiError } from "./api.js";',
      `import { ApiError } from "${rutaAbsoluta("api.js")}";\n` +
        "const api = {\n" +
        "  get: (...a) => globalThis.__espia.apiGet(...a),\n" +
        "  post: (...a) => globalThis.__espia.apiPost(...a),\n" +
        "  put: (...a) => globalThis.__espia.apiPut(...a),\n" +
        "  del: (...a) => globalThis.__espia.apiDel(...a),\n" +
        "};",
    )
    .replace(
      'import { esc, fmt, fmtS, pct } from "./format.js";',
      `import { esc, fmt, fmtS, pct } from "${rutaAbsoluta("format.js")}";`,
    )
    .replace(
      'import { bloqueCargando, error as estadoError, vacio } from "./components/estados.js";',
      `import { bloqueCargando, error as estadoError, vacio } from "${rutaAbsoluta("components", "estados.js")}";`,
    )
    .replace(
      'import { tarjetaHeroe, tarjetaMetrica, pintarTarjetas, animarCifras } from "./components/kpi.js";',
      `import { tarjetaHeroe, tarjetaMetrica, pintarTarjetas, animarCifras } from "${rutaAbsoluta("components", "kpi.js")}";`,
    )
    .replace(
      'import { crearHoja } from "./components/sheet.js";',
      `import { crearHoja } from "${rutaAbsoluta("components", "sheet.js")}?t=${Math.random()}";`,
    )
    .replace(
      'import { toast } from "./components/toast.js";',
      "const toast = (...a) => globalThis.__espia.toast(...a);",
    )
    .replace(
      'import { EVENTO as EVENTO_RUTA } from "./router.js";',
      'const EVENTO_RUTA = "epic:ruta";',
    )
    .replace(
      'import { invalidarMeses } from "./cache-meses.js";',
      "const invalidarMeses = (...a) => globalThis.__espia.invalidarMeses(...a);",
    );

  const unico = `\n// ${Math.random()}\n`;
  const url = `data:text/javascript;base64,${Buffer.from(codigo + unico, "utf8").toString("base64")}`;
  return import(url);
}

/** Dos posiciones: una por cotización con rendimiento positivo, otra
 * manual con rendimiento negativo — cubre los dos modos de valuación y
 * los dos signos a la vez. */
function respuestaBase() {
  return {
    indicators: {
      current_value: "1250000.00",
      total_invested: "1100000.00",
      return_amount: "150000.00",
      return_percentage: "13.6",
      position_count: 2,
    },
    positions: [
      {
        id: 1,
        symbol: "AL30",
        name: "Bonar 2030",
        investment_type: "bono",
        nominal_quantity: "732.0000",
        initial_value: "1000000.00",
        current_unit_price: "1527.530000",
        current_value: "1118151.96",
        valuation_mode: "unit_price",
        return_amount: "118151.96",
        return_percentage: "11.8",
        price_source: null,
        price_updated_at: null,
        active: true,
        created_at: "2026-10-17T00:00:00Z",
        updated_at: "2026-10-17T00:00:00Z",
      },
      {
        id: 2,
        symbol: "DEP",
        name: "Depósito a plazo fijo",
        investment_type: "otro",
        nominal_quantity: "0.0000",
        initial_value: "100000.00",
        current_unit_price: null,
        current_value: "88000.00",
        valuation_mode: "manual",
        return_amount: "-12000.00",
        return_percentage: "-12.0",
        price_source: null,
        price_updated_at: null,
        active: true,
        created_at: "2026-10-17T00:00:00Z",
        updated_at: "2026-10-17T00:00:00Z",
      },
    ],
  };
}

async function montar({ apiGet, apiPost, apiPut, apiDel } = {}) {
  const dom = new JSDOM(
    `<!doctype html><html><body>${htmlDeCartera()}${htmlDeHojaAlta()}${htmlDeHojaDetalle()}` +
      `<div class="fondo-hoja" id="fondo-hoja"></div></body></html>`,
    { url: "https://epic-wallet-v2.vercel.app/#/inversiones", pretendToBeVisual: true },
  );
  ventanas.push(dom.window);

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.CustomEvent = dom.window.CustomEvent;
  globalThis.requestAnimationFrame = (fn) => dom.window.requestAnimationFrame(fn);
  // Sin movimiento reducido, el conteo de cifras tarda 900ms: las
  // pruebas sólo necesitan el valor final (mismo truco que dashboard.test.mjs).
  dom.window.matchMedia = () => ({ matches: true });

  const llamadas = { apiGet: [], apiPost: [], apiPut: [], apiDel: [], toasts: [], invalidaciones: 0 };
  globalThis.__espia = {
    apiGet: async (...a) => {
      llamadas.apiGet.push(a);
      return (apiGet ?? (async () => structuredClone(respuestaBase())))(...a);
    },
    apiPost: async (...a) => {
      llamadas.apiPost.push(a);
      return (apiPost ?? (async () => structuredClone(respuestaBase().positions[0])))(...a);
    },
    apiPut: async (...a) => {
      llamadas.apiPut.push(a);
      return (apiPut ?? (async () => structuredClone(respuestaBase().positions[0])))(...a);
    },
    apiDel: async (...a) => {
      llamadas.apiDel.push(a);
      return (apiDel ?? (async () => ({ amount: "88000.00", affected_savings: true })))(...a);
    },
    toast: (...a) => llamadas.toasts.push(a),
    invalidarMeses: () => {
      llamadas.invalidaciones++;
    },
  };

  const mod = await cargarConDobles();
  return { dom, mod, llamadas };
}

const $ = (dom, id) => dom.window.document.getElementById(id);
const esperar = (ms = 15) => new Promise((listo) => setTimeout(listo, ms));

function entrarA(dom, id) {
  dom.window.document.dispatchEvent(new dom.window.CustomEvent("epic:ruta", { detail: { id } }));
}

function tarjeta(caja, etiqueta) {
  return [...caja.querySelectorAll(".kpi")].find(
    (t) => t.querySelector(".kpi-label")?.textContent === etiqueta,
  );
}

function cifraDe(caja, etiqueta) {
  return tarjeta(caja, etiqueta)?.querySelector(".kpi-num").textContent;
}

function filas(dom) {
  return [...$(dom, "cartera-tabla").querySelectorAll("tr[data-id]")];
}

function enviar(dom, idFormulario) {
  const form = $(dom, idFormulario);
  const evento = new dom.window.Event("submit", { bubbles: true, cancelable: true });
  form.dispatchEvent(evento);
  return evento;
}

async function entrarYEsperar(dom) {
  entrarA(dom, "inversiones");
  await esperar();
}

// ===================================================================

describe("antes de entrar a Cartera", () => {
  test("no pide nada todavía", async () => {
    const { llamadas } = await montar();
    await esperar();
    assert.equal(llamadas.apiGet.length, 0);
  });
});

describe("al entrar a Cartera", () => {
  test("pide /api/investments una sola vez y pinta los tres indicadores", async () => {
    const { dom, llamadas } = await montar();
    await entrarYEsperar(dom);

    assert.deepEqual(llamadas.apiGet, [["/investments"]]);
    const caja = $(dom, "kpis-cartera");
    assert.equal(cifraDe(caja, "Valor de la cartera"), "$1.250.000");
    assert.equal(cifraDe(caja, "Invertido"), "$1.100.000");
    assert.equal(cifraDe(caja, "Rendimiento"), "$150.000");
  });

  test("otra ruta que no es inversiones no dispara ningún pedido", async () => {
    const { dom, llamadas } = await montar();
    entrarA(dom, "inicio");
    await esperar();
    assert.equal(llamadas.apiGet.length, 0);
  });

  test("volver a entrar pide todo de nuevo", async () => {
    const { dom, llamadas } = await montar();
    await entrarYEsperar(dom);
    entrarA(dom, "inicio");
    await esperar();
    await entrarYEsperar(dom);
    assert.equal(llamadas.apiGet.length, 2);
  });

  test("si falla el pedido, los dos paneles muestran el error con botón para reintentar", async () => {
    const { dom } = await montar({
      apiGet: async () => {
        throw new Error("red caída");
      },
    });
    await entrarYEsperar(dom);

    assert.match($(dom, "kpis-cartera").innerHTML, /No se pudo cargar/);
    assert.match($(dom, "cartera-tabla").innerHTML, /No se pudo cargar/);
    assert.ok($(dom, "kpis-cartera").querySelector("[data-reintentar]"));
  });

  test("reintentar vuelve a pedir la cartera", async () => {
    let falla = true;
    const { dom, llamadas } = await montar({
      apiGet: async () => {
        if (falla) throw new Error("red caída");
        return structuredClone(respuestaBase());
      },
    });
    await entrarYEsperar(dom);
    falla = false;

    $(dom, "kpis-cartera").querySelector("[data-reintentar]").click();
    await esperar();

    assert.equal(llamadas.apiGet.length, 2);
    assert.match(cifraDe($(dom, "kpis-cartera"), "Valor de la cartera"), /\$1\.250\.000/);
  });

  test("sin posiciones, la tabla muestra el estado vacío y no una fila inventada", async () => {
    const { dom } = await montar({
      apiGet: async () => ({
        indicators: {
          current_value: "0.00",
          total_invested: "0.00",
          return_amount: "0.00",
          return_percentage: null,
          position_count: 0,
        },
        positions: [],
      }),
    });
    await entrarYEsperar(dom);

    assert.equal(filas(dom).length, 0);
    assert.match($(dom, "cartera-tabla").textContent, /Sin posiciones todavía/);
  });
});

describe("la tabla de posiciones", () => {
  test("una fila por posición, con sus nominales, valores y fuente", async () => {
    const { dom } = await montar();
    await entrarYEsperar(dom);

    const [al30, dep] = filas(dom);
    assert.match(al30.textContent, /AL30/);
    assert.match(al30.textContent, /Bonar 2030/);
    assert.match(al30.textContent, /732/);
    assert.match(al30.textContent, /Cotización/);

    assert.match(dep.textContent, /DEP/);
    assert.match(dep.textContent, /Manual/);
    // Sin nominales reales (valuación manual): "—", nunca "0".
    assert.match(dep.querySelectorAll("td")[1].textContent, /^—$/);
  });

  test("el rendimiento se ve en color según el signo, en la fila y en la tarjeta", async () => {
    const { dom } = await montar();
    await entrarYEsperar(dom);

    const [al30, dep] = filas(dom);
    const celdaAl30 = al30.querySelectorAll("td")[4];
    const celdaDep = dep.querySelectorAll("td")[4];
    assert.ok(celdaAl30.classList.contains("amt-in"), "rendimiento positivo: amt-in");
    assert.ok(celdaDep.classList.contains("amt-out"), "rendimiento negativo: amt-out");

    // Rendimiento total de la cartera (positivo en respuestaBase): la
    // tarjeta usa el color "inc", nunca el "egr" de un rendimiento negativo.
    const estiloTarjeta = tarjeta($(dom, "kpis-cartera"), "Rendimiento").getAttribute("style");
    assert.match(estiloTarjeta, /--c:var\(--color-inc\)/);
  });

  test("con la cartera entera en rojo, la tarjeta de Rendimiento usa el color egr", async () => {
    const { dom } = await montar({
      apiGet: async () => {
        const r = structuredClone(respuestaBase());
        r.indicators.return_amount = "-50000.00";
        return r;
      },
    });
    await entrarYEsperar(dom);

    const estiloTarjeta = tarjeta($(dom, "kpis-cartera"), "Rendimiento").getAttribute("style");
    assert.match(estiloTarjeta, /--c:var\(--color-egr\)/);
  });
});

// ===================================================================
//  Alta (comprar) · F10-T06
// ===================================================================

describe("abrir la hoja de alta", () => {
  test("arranca limpia, en modo 'por cotización' y con Restar del ahorro encendido", async () => {
    const { dom } = await montar();
    await entrarYEsperar(dom);

    $(dom, "btn-nueva-inversion").click();
    await esperar();

    assert.equal($(dom, "hoja-inversion").classList.contains("abierta"), true);
    assert.equal($(dom, "inversion-simbolo").value, "");
    assert.equal(
      $(dom, "inversion-modo").querySelector('[data-modo="unit_price"]').classList.contains("activa"),
      true,
    );
    assert.equal($(dom, "inversion-campos-cotizacion").hidden, false);
    assert.equal($(dom, "inversion-campo-manual").hidden, true);
    assert.equal($(dom, "inversion-afecta-ahorro").getAttribute("aria-checked"), "true");
  });

  test("cambiar a 'valor manual' muestra el campo de valor y esconde nominales/precio", async () => {
    const { dom } = await montar();
    await entrarYEsperar(dom);
    $(dom, "btn-nueva-inversion").click();
    await esperar();

    $(dom, "inversion-modo").querySelector('[data-modo="manual"]').click();

    assert.equal($(dom, "inversion-campos-cotizacion").hidden, true);
    assert.equal($(dom, "inversion-campo-manual").hidden, false);
  });

  test("el valor manual separa los miles; nominales y precio no", async () => {
    const { dom } = await montar();
    await entrarYEsperar(dom);
    $(dom, "btn-nueva-inversion").click();
    await esperar();

    const valorManual = /** @type {HTMLInputElement} */ ($(dom, "inversion-valor-manual"));
    valorManual.value = "150000";
    valorManual.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    assert.equal(valorManual.value, "150.000");

    const nominales = /** @type {HTMLInputElement} */ ($(dom, "inversion-nominales"));
    nominales.value = "732.5";
    nominales.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    assert.equal(nominales.value, "732.5", "nominales no lleva el enmascarado de miles");
  });

  test("falta el símbolo o el nombre: no envía nada", async () => {
    const { dom, llamadas } = await montar();
    await entrarYEsperar(dom);
    $(dom, "btn-nueva-inversion").click();
    await esperar();

    enviar(dom, "form-inversion");
    await esperar();

    assert.equal(llamadas.apiPost.length, 0);
    assert.equal($(dom, "inversion-error").hidden, false);
  });
});

describe("guardar el alta", () => {
  async function completarComun(dom) {
    $(dom, "btn-nueva-inversion").click();
    await esperar();
    $(dom, "inversion-simbolo").value = "AL30";
    $(dom, "inversion-nombre").value = "Bonar 2030";
  }

  test("modo por cotización: manda nominal_quantity y current_unit_price, no manual_value", async () => {
    const { dom, llamadas } = await montar();
    await entrarYEsperar(dom);
    await completarComun(dom);

    $(dom, "inversion-nominales").value = "732";
    $(dom, "inversion-precio").value = "1527.53";
    enviar(dom, "form-inversion");
    await esperar();

    assert.equal(llamadas.apiPost.length, 1);
    const [ruta, datos] = llamadas.apiPost[0];
    assert.equal(ruta, "/investments");
    assert.equal(datos.symbol, "AL30");
    assert.equal(datos.valuation_mode, "unit_price");
    assert.equal(datos.nominal_quantity, "732");
    assert.equal(datos.current_unit_price, "1527.53");
    assert.equal(datos.manual_value, undefined);
    assert.equal(datos.affect_savings, true);
  });

  test("modo manual: manda manual_value, no nominal_quantity ni current_unit_price", async () => {
    const { dom, llamadas } = await montar();
    await entrarYEsperar(dom);
    await completarComun(dom);

    $(dom, "inversion-modo").querySelector('[data-modo="manual"]').click();
    $(dom, "inversion-valor-manual").value = "150000";
    enviar(dom, "form-inversion");
    await esperar();

    const [, datos] = llamadas.apiPost[0];
    assert.equal(datos.valuation_mode, "manual");
    assert.equal(datos.manual_value, "150000.00");
    assert.equal(datos.nominal_quantity, undefined);
    assert.equal(datos.current_unit_price, undefined);
  });

  test("apagar 'Restar del ahorro' lo manda en false", async () => {
    const { dom, llamadas } = await montar();
    await entrarYEsperar(dom);
    await completarComun(dom);

    $(dom, "inversion-afecta-ahorro").setAttribute("aria-checked", "false");
    $(dom, "inversion-nominales").value = "10";
    $(dom, "inversion-precio").value = "100";
    enviar(dom, "form-inversion");
    await esperar();

    assert.equal(llamadas.apiPost[0][1].affect_savings, false);
  });

  test("después de comprar: cierra la hoja, invalida el caché de meses, recarga la cartera y avisa", async () => {
    const { dom, llamadas } = await montar();
    await entrarYEsperar(dom);
    await completarComun(dom);

    $(dom, "inversion-nominales").value = "10";
    $(dom, "inversion-precio").value = "100";
    enviar(dom, "form-inversion");
    await esperar();

    assert.equal($(dom, "hoja-inversion").classList.contains("abierta"), false);
    assert.equal(llamadas.invalidaciones, 1);
    assert.equal(llamadas.apiGet.length, 2, "recarga /api/investments después de comprar");
    assert.match(llamadas.toasts[0][0], /AL30/);
  });

  test("si la API rechaza, muestra el mensaje y no cierra la hoja", async () => {
    const { dom, llamadas } = await montar({
      apiPost: async () => {
        throw new ApiError({ code: "VALIDATION_ERROR", message: "Ya existe una posición con ese símbolo." });
      },
    });
    await entrarYEsperar(dom);
    await completarComun(dom);
    $(dom, "inversion-nominales").value = "10";
    $(dom, "inversion-precio").value = "100";

    enviar(dom, "form-inversion");
    await esperar();

    assert.equal($(dom, "hoja-inversion").classList.contains("abierta"), true);
    assert.equal($(dom, "inversion-error").textContent, "Ya existe una posición con ese símbolo.");
    assert.equal(llamadas.invalidaciones, 0);
  });
});

// ===================================================================
//  Detalle: actualizar valor y vender · F10-T06
// ===================================================================

async function abrirDetalle(dom, { conClick = true } = {}) {
  const fila = filas(dom)[0]; // AL30, valuation_mode: unit_price
  if (conClick) {
    fila.click();
  } else {
    fila.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  }
  await esperar();
}

describe("abrir el detalle de una posición", () => {
  test("un click en la fila abre la hoja con los datos de esa posición", async () => {
    const { dom } = await montar();
    await entrarYEsperar(dom);
    await abrirDetalle(dom);

    assert.equal($(dom, "hoja-inversion-detalle").classList.contains("abierta"), true);
    assert.equal($(dom, "inversion-detalle-titulo").textContent, "AL30");
    assert.equal($(dom, "inversion-detalle-sub").textContent, "Bonar 2030");
    assert.match($(dom, "inversion-detalle-kv").textContent, /Nominales/);
    assert.match($(dom, "inversion-detalle-kv").textContent, /732/);
  });

  test("Enter en la fila también abre el detalle (teclado, sin botón dentro de la celda)", async () => {
    const { dom } = await montar();
    await entrarYEsperar(dom);
    await abrirDetalle(dom, { conClick: false });

    assert.equal($(dom, "hoja-inversion-detalle").classList.contains("abierta"), true);
  });

  test("valuación por cotización: muestra el campo de precio, no el de valor", async () => {
    const { dom } = await montar();
    await entrarYEsperar(dom);
    await abrirDetalle(dom);

    assert.equal($(dom, "inversion-detalle-campo-precio").hidden, false);
    assert.equal($(dom, "inversion-detalle-campo-valor").hidden, true);
    // "1527.530000" del servidor, sin ceros de más para editar.
    assert.equal($(dom, "inversion-detalle-precio").value, "1527.53");
  });

  test("valuación manual: muestra el campo de valor, no el de precio", async () => {
    const { dom } = await montar();
    await entrarYEsperar(dom);
    filas(dom)[1].click(); // DEP, valuation_mode: manual
    await esperar();

    assert.equal($(dom, "inversion-detalle-campo-precio").hidden, true);
    assert.equal($(dom, "inversion-detalle-campo-valor").hidden, false);
    assert.equal($(dom, "inversion-detalle-valor").value, "88.000");
  });
});

describe("actualizar el valor", () => {
  test("modo por cotización: PUT con current_unit_price, y no invalida el caché de meses", async () => {
    const { dom, llamadas } = await montar();
    await entrarYEsperar(dom);
    await abrirDetalle(dom);

    $(dom, "inversion-detalle-precio").value = "1600";
    enviar(dom, "form-inversion-valor");
    await esperar();

    assert.equal(llamadas.apiPut.length, 1);
    assert.equal(llamadas.apiPut[0][0], "/investments/1");
    assert.deepEqual(llamadas.apiPut[0][1], { current_unit_price: "1600" });
    assert.equal(llamadas.invalidaciones, 0, "actualizar el valor a mano no toca el ahorro");
    assert.equal($(dom, "hoja-inversion-detalle").classList.contains("abierta"), false);
  });

  test("modo manual: PUT con current_value en pesos con .00", async () => {
    const { dom, llamadas } = await montar();
    await entrarYEsperar(dom);
    filas(dom)[1].click(); // DEP, manual
    await esperar();

    $(dom, "inversion-detalle-valor").value = "95000";
    enviar(dom, "form-inversion-valor");
    await esperar();

    assert.deepEqual(llamadas.apiPut[0][1], { current_value: "95000.00" });
  });

  test("si la API rechaza, muestra el error y no cierra la hoja", async () => {
    const { dom, llamadas } = await montar({
      apiPut: async () => {
        throw new ApiError({ code: "NOT_FOUND", message: "No se encontró la posición." });
      },
    });
    await entrarYEsperar(dom);
    await abrirDetalle(dom);

    $(dom, "inversion-detalle-precio").value = "1600";
    enviar(dom, "form-inversion-valor");
    await esperar();

    assert.equal($(dom, "hoja-inversion-detalle").classList.contains("abierta"), true);
    assert.equal($(dom, "inversion-detalle-error").textContent, "No se encontró la posición.");
    assert.equal(llamadas.invalidaciones, 0);
  });
});

describe("vender (Regla 10: pide confirmación)", () => {
  test("sin confirmar, no borra nada", async () => {
    const { dom, llamadas } = await montar();
    await entrarYEsperar(dom);
    await abrirDetalle(dom);
    dom.window.confirm = () => false;

    $(dom, "inversion-detalle-vender").click();
    await esperar();

    assert.equal(llamadas.apiDel.length, 0);
    assert.equal($(dom, "hoja-inversion-detalle").classList.contains("abierta"), true);
  });

  test("confirmado: vende, cierra la hoja, invalida el caché de meses y avisa cuánto se acreditó", async () => {
    const { dom, llamadas } = await montar({
      apiDel: async () => ({ amount: "1118151.96", affected_savings: true }),
    });
    await entrarYEsperar(dom);
    await abrirDetalle(dom);
    dom.window.confirm = () => true;

    $(dom, "inversion-detalle-vender").click();
    await esperar();

    assert.deepEqual(llamadas.apiDel[0], ["/investments/1"]);
    assert.equal($(dom, "hoja-inversion-detalle").classList.contains("abierta"), false);
    assert.equal(llamadas.invalidaciones, 1, "vender deja el ahorro actualizado");
    assert.equal(llamadas.apiGet.length, 2, "recarga la cartera después de vender");
    assert.match(llamadas.toasts[0][0], /AL30/);
    assert.match(llamadas.toasts[0][0], /1\.118\.152/);
  });

  test("si la API rechaza, avisa con un toast de error y no cierra la hoja", async () => {
    const { dom, llamadas } = await montar({
      apiDel: async () => {
        throw new ApiError({ code: "NOT_FOUND", message: "No se encontró la posición." });
      },
    });
    await entrarYEsperar(dom);
    await abrirDetalle(dom);
    dom.window.confirm = () => true;

    $(dom, "inversion-detalle-vender").click();
    await esperar();

    assert.equal($(dom, "hoja-inversion-detalle").classList.contains("abierta"), true);
    assert.equal(llamadas.invalidaciones, 0);
    assert.deepEqual(llamadas.toasts[0][1], { severidad: "crit" });
  });
});
