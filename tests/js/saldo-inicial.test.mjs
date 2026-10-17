/* Pruebas del saldo inicial editable (Ajustes → Datos laborales) ·
   F09-T05. Se corren con `npm test` (`node --test tests/js/*.test.mjs`).

   El HTML sale del `index.html` real, mismo criterio que
   `config-categorias.test.mjs`: la tarjeta "Datos laborales" y la
   hoja `#hoja-saldo-inicial` se recortan de ahí. Se doblan `api`
   (get/patch), `toast` e `invalidarMeses` —lo que hay que controlar
   para simular la API sin red de verdad—; `ApiError` y `crearHoja` se
   importan reales por el mismo motivo que en `config-categorias.js`
   (`instanceof` tiene que seguir siendo la misma clase, y la hoja que
   se prueba es la real). `LABORALES` también se importa real: son
   datos de muestra puros, sin red de por medio.

   El criterio de aceptación central ("cambiar el saldo inicial
   recalcula todo el acumulado") es de backend y se prueba en
   `tests/api/test_me.py`; acá lo que puede fallar en silencio es que
   el campo mande el número que el usuario escribió —sin los puntos de
   miles— y que las otras tres fichas de la tarjeta sigan siendo las
   de muestra, sin tocar. */

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
const { LABORALES } = await import(rutaAbsoluta("datos-muestra.js"));

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

/** La tarjeta "Datos laborales", recortada del `index.html` real. */
function htmlDeLaborales() {
  const html = readFileSync(INDEX, "utf8");
  const ancla = html.indexOf("<h2>Datos laborales</h2>");
  assert.notEqual(ancla, -1, "no se encuentra la tarjeta de Datos laborales en index.html");
  const desde = html.lastIndexOf('<article class="card shell">', ancla);
  const hasta = html.indexOf("</article>", ancla) + "</article>".length;
  return html.slice(desde, hasta);
}

/** La hoja de edición del saldo inicial, recortada del mismo archivo. */
function htmlDeLaHoja() {
  const html = readFileSync(INDEX, "utf8");
  const ancla = html.indexOf('id="hoja-saldo-inicial"');
  assert.notEqual(ancla, -1, "no se encuentra la hoja de saldo inicial en index.html");
  const desde = html.lastIndexOf("<aside", ancla);
  const hasta = html.indexOf("</aside>", ancla) + "</aside>".length;
  return html.slice(desde, hasta);
}

async function cargarConDobles() {
  let codigo = readFileSync(resolve(RAIZ, "web", "src", "js", "saldo-inicial.js"), "utf8");
  codigo = codigo
    .replace(
      'import { api, ApiError } from "./api.js";',
      `import { ApiError } from "${rutaAbsoluta("api.js")}";\n` +
        "const api = {\n" +
        "  get: (...a) => globalThis.__espia.apiGet(...a),\n" +
        "  patch: (...a) => globalThis.__espia.apiPatch(...a),\n" +
        "};",
    )
    .replace(
      'import { esc, fmtS } from "./format.js";',
      `import { esc, fmtS } from "${rutaAbsoluta("format.js")}";`,
    )
    .replace(
      'import { toast } from "./components/toast.js";',
      "const toast = (...a) => globalThis.__espia.toast(...a);",
    )
    .replace(
      'import { crearHoja } from "./components/sheet.js";',
      // `?t=` para que el contador de hojas abiertas no se comparta
      // con otros archivos de prueba dentro del mismo proceso.
      `import { crearHoja } from "${rutaAbsoluta("components", "sheet.js")}?t=${Math.random()}";`,
    )
    .replace(
      'import { invalidarMeses } from "./cache-meses.js";',
      "const invalidarMeses = () => globalThis.__espia.invalidarMeses();",
    )
    .replace(
      'import { LABORALES } from "./datos-muestra.js";',
      `import { LABORALES } from "${rutaAbsoluta("datos-muestra.js")}";`,
    );

  const unico = `\n// ${Math.random()}\n`;
  const url = `data:text/javascript;base64,${Buffer.from(codigo + unico, "utf8").toString("base64")}`;
  return import(url);
}

async function montar({ apiGet = async () => ({ opening_balance: "4140505.00" }), apiPatch } = {}) {
  const html =
    `<!doctype html><html><body>${htmlDeLaborales()}${htmlDeLaHoja()}` +
    `<div class="fondo-hoja" id="fondo-hoja"></div></body></html>`;
  const dom = new JSDOM(html, {
    url: "https://epic-wallet-v2.vercel.app/#/config",
    pretendToBeVisual: true,
  });
  ventanas.push(dom.window);

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.CustomEvent = dom.window.CustomEvent;

  const llamadas = { apiGet: [], apiPatch: [], toasts: [], invalidaciones: 0 };
  globalThis.__espia = {
    apiGet: async (...a) => {
      llamadas.apiGet.push(a);
      return apiGet(...a);
    },
    apiPatch: async (...a) => {
      llamadas.apiPatch.push(a);
      if (apiPatch) return apiPatch(...a);
      return { opening_balance: a[1].opening_balance };
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

function enviar(dom, idForm) {
  const form = $(dom, idForm);
  const evento = new dom.window.Event("submit", { bubbles: true, cancelable: true });
  form.dispatchEvent(evento);
  return evento;
}

// ===================================================================

describe("la tarjeta de Datos laborales", () => {
  test("pinta el saldo inicial real y deja las otras tres fichas como muestra", async () => {
    const { dom } = await montar({ apiGet: async () => ({ opening_balance: "4140505.00" }) });
    await esperar();

    const caja = $(dom, "config-laborales");
    assert.match(caja.textContent, /\$4\.140\.505/);
    for (const l of LABORALES) {
      if (l.nombre === "Saldo inicial del sistema") continue;
      assert.match(caja.textContent, new RegExp(l.valor.replace(/[.,$]/g, "\\$&")));
    }
  });

  test("si falla el pedido, deja las cuatro fichas en cero antes que romper", async () => {
    const { dom } = await montar({
      apiGet: async () => {
        throw new Error("red caída");
      },
    });
    await esperar();

    assert.match($(dom, "config-laborales").textContent, /\$0/);
  });
});

describe("abrir la hoja de edición", () => {
  test("precarga el importe actual, redondeado y con puntos de miles", async () => {
    const { dom } = await montar({ apiGet: async () => ({ opening_balance: "4140505.00" }) });
    await esperar();

    $(dom, "btn-editar-saldo-inicial").click();
    await esperar();

    assert.equal($(dom, "hoja-saldo-inicial").classList.contains("abierta"), true);
    assert.equal($(dom, "saldo-inicial-importe").value, "4.140.505");
  });

  test("escribir en el campo lo enmascara con puntos de miles", async () => {
    const { dom } = await montar();
    await esperar();
    $(dom, "btn-editar-saldo-inicial").click();
    await esperar();

    const campo = $(dom, "saldo-inicial-importe");
    campo.value = "1500000";
    campo.dispatchEvent(new dom.window.Event("input", { bubbles: true }));

    assert.equal(campo.value, "1.500.000");
  });
});

describe("guardar el saldo inicial", () => {
  test("manda el número sin puntos de miles, con dos decimales", async () => {
    const { dom, llamadas } = await montar();
    await esperar();
    $(dom, "btn-editar-saldo-inicial").click();
    await esperar();

    const campo = $(dom, "saldo-inicial-importe");
    campo.value = "1500000";
    campo.dispatchEvent(new dom.window.Event("input", { bubbles: true }));

    enviar(dom, "form-saldo-inicial");
    await esperar(30);

    assert.equal(llamadas.apiPatch.length, 1);
    assert.deepEqual(llamadas.apiPatch[0], ["/me", { opening_balance: "1500000.00" }]);
  });

  test("al guardar bien, cierra la hoja, invalida la caché de meses y avisa con un toast", async () => {
    const { dom, llamadas } = await montar();
    await esperar();
    $(dom, "btn-editar-saldo-inicial").click();
    await esperar();

    enviar(dom, "form-saldo-inicial");
    await esperar(30);

    assert.equal($(dom, "hoja-saldo-inicial").classList.contains("abierta"), false);
    assert.equal(llamadas.invalidaciones, 1);
    assert.equal(llamadas.toasts.length, 1);
    assert.match(llamadas.toasts[0][0], /saldo inicial/i);
  });

  test("la ficha se actualiza con lo que confirmó el servidor", async () => {
    const { dom } = await montar({
      apiPatch: async () => ({ opening_balance: "2000000.00" }),
    });
    await esperar();
    $(dom, "btn-editar-saldo-inicial").click();
    await esperar();

    enviar(dom, "form-saldo-inicial");
    await esperar(30);

    assert.match($(dom, "config-laborales").textContent, /\$2\.000\.000/);
  });

  test("si la API falla, el mensaje del ApiError queda en la región de alerta y la hoja no se cierra", async () => {
    const { dom } = await montar({
      apiPatch: async () => {
        throw new ApiError({ code: "VALIDATION_ERROR", message: "El saldo inicial no es válido." });
      },
    });
    await esperar();
    $(dom, "btn-editar-saldo-inicial").click();
    await esperar();

    enviar(dom, "form-saldo-inicial");
    await esperar(30);

    const error = $(dom, "saldo-inicial-error");
    assert.equal(error.hidden, false);
    assert.match(error.textContent, /no es válido/);
    assert.equal($(dom, "hoja-saldo-inicial").classList.contains("abierta"), true);
  });

  test("no permite envíos dobles", async () => {
    const { dom, llamadas } = await montar({
      apiPatch: async () => {
        await new Promise((listo) => setTimeout(listo, 30));
        return { opening_balance: "500.00" };
      },
    });
    await esperar();
    $(dom, "btn-editar-saldo-inicial").click();
    await esperar();

    enviar(dom, "form-saldo-inicial");
    enviar(dom, "form-saldo-inicial");
    enviar(dom, "form-saldo-inicial");
    await esperar(150);

    assert.equal(llamadas.apiPatch.length, 1, `hubo ${llamadas.apiPatch.length} guardados y tenía que haber 1`);
  });
});
