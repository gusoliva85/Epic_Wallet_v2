/* Pruebas del alta rápida de movimiento · F04-T09
   Se corren con `npm test` (`node --test tests/js/*.test.mjs`).

   Mismo técnica que `config-categorias.test.mjs`: el HTML sale del
   `index.html` real, se doblan `api` (get/post), `toast` e
   `invalidarMeses` —lo que hay que controlar para simular el servidor
   sin red de verdad—, y se importan reales `ApiError` (para que
   `e instanceof ApiError` siga siendo la misma clase que usa el
   módulo), `esc` y `crearHoja` (la misma hoja que prueba
   `sheet.test.mjs`).

   Los criterios de aceptación de la tarea, cada uno con su prueba: el
   teclado numérico del importe (el atributo, no el teclado real, que
   jsdom no puede mostrar), un importe vacío o en cero no deja enviar,
   y los indicadores —hoy, la barra de mes vía `invalidarMeses` y el
   toast con los totales— cambian al guardar. */

import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..");
const INDEX = resolve(RAIZ, "web", "index.html");

const { ApiError } = await import(
  `file:///${resolve(RAIZ, "web", "src", "js", "api.js").replace(/\\/g, "/")}`
);

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

/** Hoy en América/Argentina/Buenos_Aires, formato AAAA-MM-DD — el
 * mismo cálculo que hace el módulo, para comparar contra lo que puso
 * en el campo de fecha. */
const FORMATO_FECHA_ARG = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const HOY = FORMATO_FECHA_ARG.format(new Date());

function htmlDelBoton() {
  const html = readFileSync(INDEX, "utf8");
  const ancla = html.indexOf('id="btn-nuevo"');
  assert.notEqual(ancla, -1, "no se encuentra el botón #btn-nuevo en index.html");
  const desde = html.lastIndexOf("<button", ancla);
  const hasta = html.indexOf("</button>", ancla) + "</button>".length;
  return html.slice(desde, hasta);
}

/** La hoja de alta, recortada del mismo `index.html` que se publica. */
function htmlDeLaHoja() {
  const html = readFileSync(INDEX, "utf8");
  const ancla = html.indexOf('id="hoja-movimiento"');
  assert.notEqual(ancla, -1, "no se encuentra la hoja de movimiento en index.html");
  const desde = html.lastIndexOf("<aside", ancla);
  const hasta = html.indexOf("</aside>", ancla) + "</aside>".length;
  return html.slice(desde, hasta);
}

async function cargarConDobles() {
  let codigo = readFileSync(resolve(RAIZ, "web", "src", "js", "alta-movimiento.js"), "utf8");
  codigo = codigo
    .replace(
      'import { api, ApiError } from "./api.js";',
      `import { ApiError } from "file:///${resolve(RAIZ, "web", "src", "js", "api.js").replace(/\\/g, "/")}";\n` +
        "const api = {\n" +
        "  get: (...a) => globalThis.__espia.apiGet(...a),\n" +
        "  post: (...a) => globalThis.__espia.apiPost(...a),\n" +
        "};",
    )
    .replace(
      'import { esc } from "./format.js";',
      `import { esc } from "file:///${resolve(RAIZ, "web", "src", "js", "format.js").replace(/\\/g, "/")}";`,
    )
    .replace(
      'import { toast } from "./components/toast.js";',
      "const toast = (...a) => globalThis.__espia.toast(...a);",
    )
    .replace(
      'import { crearHoja } from "./components/sheet.js";',
      `import { crearHoja } from "file:///${resolve(RAIZ, "web", "src", "js", "components", "sheet.js").replace(/\\/g, "/")}?t=${Math.random()}";`,
    )
    .replace(
      'import { invalidarMeses } from "./cache-meses.js";',
      "const invalidarMeses = (...a) => globalThis.__espia.invalidarMeses(...a);",
    );

  const unico = `\n// ${Math.random()}\n`;
  const url = `data:text/javascript;base64,${Buffer.from(codigo + unico, "utf8").toString("base64")}`;
  return import(url);
}

const CATEGORIAS_DE_PRUEBA = [
  { id: 1, name: "Sueldo", type: "income", active: true },
  { id: 2, name: "Alquiler", type: "expense", active: true },
  { id: 3, name: "Gas", type: "expense", active: true },
];

/**
 * Monta el botón flotante y la hoja, y carga `alta-movimiento.js` con dobles.
 *
 * @param {object} opciones
 * @param {(path:string)=>Promise<object[]>} [opciones.apiGet]
 * @param {(path:string, datos:object)=>Promise<object>} [opciones.apiPost]
 */
async function montar({
  apiGet = async () => structuredClone(CATEGORIAS_DE_PRUEBA),
  apiPost = async () => ({ transaction: {}, month_totals: {} }),
} = {}) {
  const dom = new JSDOM(
    `<!doctype html><html><body>${htmlDelBoton()}${htmlDeLaHoja()}` +
      `<div class="fondo-hoja" id="fondo-hoja"></div></body></html>`,
    { url: "https://epic-wallet-v2.vercel.app/#/inicio", pretendToBeVisual: true },
  );
  ventanas.push(dom.window);

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.CustomEvent = dom.window.CustomEvent;

  const llamadas = { apiGet: [], apiPost: [], toasts: [], invalidaciones: 0 };
  globalThis.__espia = {
    apiGet: async (...a) => {
      llamadas.apiGet.push(a);
      return apiGet(...a);
    },
    apiPost: async (...a) => {
      llamadas.apiPost.push(a);
      return apiPost(...a);
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
const esperar = (ms = 10) => new Promise((listo) => setTimeout(listo, ms));

function enviar(dom) {
  const form = $(dom, "form-movimiento");
  const evento = new dom.window.Event("submit", { bubbles: true, cancelable: true });
  form.dispatchEvent(evento);
  return evento;
}

function abrir(dom) {
  $(dom, "btn-nuevo").click();
}

// ===================================================================

describe("abrir la hoja", () => {
  test("Egreso elegido y la fecha de hoy, de entrada", async () => {
    const { dom } = await montar();
    await esperar();
    abrir(dom);
    await esperar();

    const hoja = $(dom, "hoja-movimiento");
    assert.equal(hoja.classList.contains("abierta"), true);
    assert.equal(
      hoja.querySelector('[data-tipo="expense"]').classList.contains("activa"),
      true,
    );
    assert.equal($(dom, "movimiento-fecha").value, HOY);
    assert.equal(
      $(dom, "movimiento-fecha").max,
      HOY,
      "no se puede elegir una fecha futura (sin meses futuros, General §12.1)",
    );
  });

  test("el importe abre en teclado numérico", async () => {
    const { dom } = await montar();
    await esperar();
    const campo = $(dom, "movimiento-importe");
    assert.equal(campo.getAttribute("type"), "number");
    assert.equal(campo.getAttribute("inputmode"), "decimal");
  });

  test("pide las categorías activas la primera vez que se abre", async () => {
    const { dom, llamadas } = await montar();
    await esperar();
    abrir(dom);
    await esperar();

    assert.deepEqual(llamadas.apiGet[0], ["/categories?active=true"]);

    const opciones = [...$(dom, "movimiento-categoria").options].map((o) => o.textContent);
    assert.deepEqual(opciones, ["Alquiler", "Gas"], "por defecto, sólo las de egreso");
  });

  test("abrir, cerrar y abrir de nuevo no vuelve a pedir las categorías", async () => {
    const { dom, llamadas } = await montar();
    await esperar();
    abrir(dom); // abre
    await esperar();
    abrir(dom); // cierra (el disparador alterna)
    await esperar();
    abrir(dom); // abre otra vez
    await esperar();

    assert.equal(llamadas.apiGet.length, 1);
  });

  test("cambiar a Ingreso filtra la categoría por tipo", async () => {
    const { dom } = await montar();
    await esperar();
    abrir(dom);
    await esperar();

    $(dom, "hoja-movimiento").querySelector('[data-tipo="income"]').click();

    const opciones = [...$(dom, "movimiento-categoria").options].map((o) => o.textContent);
    assert.deepEqual(opciones, ["Sueldo"]);
  });
});

// ===================================================================

describe("validación antes de enviar", () => {
  test("un importe vacío no deja enviar", async () => {
    const { dom, llamadas } = await montar();
    await esperar();
    abrir(dom);
    await esperar();

    enviar(dom);
    await esperar();

    assert.equal(llamadas.apiPost.length, 0);
    assert.equal($(dom, "movimiento-error").hidden, false);
    assert.match($(dom, "movimiento-error").textContent, /importe/i);
  });

  test("un importe en cero no deja enviar", async () => {
    const { dom, llamadas } = await montar();
    await esperar();
    abrir(dom);
    await esperar();

    $(dom, "movimiento-importe").value = "0";
    enviar(dom);
    await esperar();

    assert.equal(llamadas.apiPost.length, 0);
  });

  test("sin categorías para elegir (la API falló), avisa y no envía", async () => {
    const { dom, llamadas } = await montar({ apiGet: async () => [] });
    await esperar();
    abrir(dom);
    await esperar();

    $(dom, "movimiento-importe").value = "1000";
    enviar(dom);
    await esperar();

    assert.equal(llamadas.apiPost.length, 0);
    assert.match($(dom, "movimiento-error").textContent, /categoría/i);
  });
});

// ===================================================================

describe("guardar", () => {
  test("manda category_id numérico, la fecha, el tipo y el importe con dos decimales", async () => {
    const { dom, llamadas } = await montar();
    await esperar();
    abrir(dom);
    await esperar();

    $(dom, "movimiento-importe").value = "1500.5";
    $(dom, "movimiento-categoria").value = "3"; // Gas
    $(dom, "movimiento-descripcion").value = "  Super  ";
    enviar(dom);
    await esperar();

    assert.equal(llamadas.apiPost.length, 1);
    assert.deepEqual(llamadas.apiPost[0], [
      "/transactions",
      {
        category_id: 3,
        transaction_date: HOY,
        transaction_type: "expense",
        amount: "1500.50",
        description: "Super",
      },
    ]);
  });

  test("con Ingreso elegido, manda transaction_type income", async () => {
    const { dom, llamadas } = await montar();
    await esperar();
    abrir(dom);
    await esperar();
    $(dom, "hoja-movimiento").querySelector('[data-tipo="income"]').click();

    $(dom, "movimiento-importe").value = "500000";
    enviar(dom);
    await esperar();

    assert.equal(llamadas.apiPost[0][1].transaction_type, "income");
  });

  test("después de guardar: cierra la hoja, invalida el caché de meses y avisa con un toast", async () => {
    const { dom, llamadas } = await montar();
    await esperar();
    abrir(dom);
    await esperar();

    $(dom, "movimiento-importe").value = "1000";
    enviar(dom);
    await esperar();

    assert.equal($(dom, "hoja-movimiento").classList.contains("abierta"), false);
    assert.equal(llamadas.invalidaciones, 1);
    assert.equal(llamadas.toasts.length, 1);
    assert.match(llamadas.toasts[0][0], /Alquiler.*egreso cargado/i);
  });

  test("no permite envíos dobles", async () => {
    let enCurso = 0;
    let maximo = 0;
    const { dom } = await montar({
      apiPost: async () => {
        enCurso++;
        maximo = Math.max(maximo, enCurso);
        await esperar(30);
        enCurso--;
        return { transaction: {}, month_totals: {} };
      },
    });
    await esperar();
    abrir(dom);
    await esperar();
    $(dom, "movimiento-importe").value = "1000";

    enviar(dom);
    enviar(dom);
    enviar(dom);
    await esperar(80);

    assert.equal(maximo, 1, "dos envíos casi juntos no tienen que llegar los dos a la API");
  });

  test("si la API rechaza, muestra el mensaje, no cierra la hoja y no invalida el caché", async () => {
    const { dom, llamadas } = await montar({
      apiPost: async () => {
        throw new ApiError({ code: "VALIDATION_ERROR", message: "No se puede cargar un movimiento en un mes futuro." });
      },
    });
    await esperar();
    abrir(dom);
    await esperar();

    $(dom, "movimiento-importe").value = "1000";
    enviar(dom);
    await esperar();

    assert.equal($(dom, "hoja-movimiento").classList.contains("abierta"), true);
    assert.equal(
      $(dom, "movimiento-error").textContent,
      "No se puede cargar un movimiento en un mes futuro.",
    );
    assert.equal(llamadas.invalidaciones, 0);
  });
});
