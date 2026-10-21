/* Pruebas de la tarjeta "Copia de seguridad" de Ajustes · F11-T02
   Se corren con `npm test` (`node --test tests/js/*.test.mjs`).

   `api.js` se dobla entero (`descargar`/`post`), igual que en
   `cartera.test.mjs`; `components/sheet.js` se importa real, con
   `?t=` para que cada prueba tenga su propio estado. `URL.createObjectURL`
   y `HTMLAnchorElement.prototype.click` se doblan porque jsdom no
   dispara una descarga de verdad y no hay nada que inspeccionar sin
   interceptarlos.

   Los criterios: exportar pide el archivo y dispara la descarga con
   el nombre que mandó el servidor; elegir un archivo pide la vista
   previa sin escribir nada y la muestra; confirmar repite el pedido
   con `confirm: true` y, si sale bien, recarga la página; un archivo
   que no es JSON, o un error de la API, se avisan sin romper nada. */

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

function htmlDeCopiaDeSeguridad() {
  const html = readFileSync(INDEX, "utf8");
  const ancla = html.indexOf('id="btn-exportar-json"');
  assert.notEqual(ancla, -1, "no se encuentra la tarjeta de Copia de seguridad en index.html");
  return recortarEtiqueta(html, "article", ancla);
}

function htmlDeHojaImportar() {
  const html = readFileSync(INDEX, "utf8");
  const ancla = html.indexOf('id="hoja-importar"');
  assert.notEqual(ancla, -1, "no se encuentra la hoja de importación en index.html");
  return recortarEtiqueta(html, "aside", ancla);
}

async function cargarConDobles() {
  let codigo = readFileSync(resolve(RAIZ, "web", "src", "js", "respaldo.js"), "utf8");
  codigo = codigo
    .replace(
      'import { api, ApiError } from "./api.js";',
      `import { ApiError } from "${rutaAbsoluta("api.js")}";\n` +
        "const api = {\n" +
        "  descargar: (...a) => globalThis.__espia.descargar(...a),\n" +
        "  post: (...a) => globalThis.__espia.apiPost(...a),\n" +
        "};",
    )
    .replace(
      'import { esc } from "./format.js";',
      `import { esc } from "${rutaAbsoluta("format.js")}";`,
    )
    .replace(
      'import { crearHoja } from "./components/sheet.js";',
      `import { crearHoja } from "${rutaAbsoluta("components", "sheet.js")}?t=${Math.random()}";`,
    )
    .replace(
      'import { toast } from "./components/toast.js";',
      "const toast = (...a) => globalThis.__espia.toast(...a);",
    );

  const unico = `\n// ${Math.random()}\n`;
  const url = `data:text/javascript;base64,${Buffer.from(codigo + unico, "utf8").toString("base64")}`;
  return import(url);
}

async function montar({ descargar, apiPost } = {}) {
  const dom = new JSDOM(
    `<!doctype html><html><body>${htmlDeCopiaDeSeguridad()}${htmlDeHojaImportar()}` +
      `<div class="fondo-hoja" id="fondo-hoja"></div></body></html>`,
    { url: "https://epic-wallet-v2.vercel.app/#/config", pretendToBeVisual: true },
  );
  ventanas.push(dom.window);

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.HTMLAnchorElement = dom.window.HTMLAnchorElement;
  globalThis.URL = dom.window.URL;

  const llamadas = { descargar: [], apiPost: [], toasts: [], clicksDeDescarga: [], recargo: 0 };

  // `location.reload` es de sólo lectura en jsdom y no se puede
  // redefinir ahí: se reemplaza el global entero por un objeto
  // liviano propio, que es lo único que `respaldo.js` usa de `location`.
  globalThis.location = {
    reload: () => {
      llamadas.recargo++;
    },
  };

  // Sin esto, cada clic de descarga navegaría de verdad (jsdom avisa
  // "Not implemented: navigation") y además no hay nada que mirar: lo
  // que importa es que se haya armado un enlace con ese nombre.
  const clickOriginal = dom.window.HTMLAnchorElement.prototype.click;
  dom.window.HTMLAnchorElement.prototype.click = function () {
    llamadas.clicksDeDescarga.push({ href: this.href, nombre: this.download });
  };
  dom.window.URL.createObjectURL = () => "blob:prueba";
  dom.window.URL.revokeObjectURL = () => {};

  globalThis.__espia = {
    descargar: async (...a) => {
      llamadas.descargar.push(a);
      return (descargar ?? (async () => ({ blob: new Blob(["x"]), filename: "respaldo.json" })))(...a);
    },
    apiPost: async (...a) => {
      llamadas.apiPost.push(a);
      return (apiPost ?? (async () => ({})))(...a);
    },
    toast: (...a) => llamadas.toasts.push(a),
  };

  const mod = await cargarConDobles();
  return { dom, mod, llamadas, clickOriginal };
}

const $ = (dom, id) => dom.window.document.getElementById(id);
const esperar = (ms = 15) => new Promise((listo) => setTimeout(listo, ms));

function archivoJson(dom, contenido) {
  return new dom.window.File([JSON.stringify(contenido)], "respaldo.json", {
    type: "application/json",
  });
}

/** Simula elegir un archivo en el `<input type="file">`: jsdom no deja
 * asignar `.files` directo (es de sólo lectura), así que se define la
 * propiedad una vez, por archivo, con `Object.defineProperty`. */
function elegirArchivo(dom, archivo) {
  const input = $(dom, "input-importar");
  Object.defineProperty(input, "files", { value: [archivo], configurable: true });
  input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
}

const RESPUESTA_PREVIA = {
  categories: 21,
  months: 2,
  transactions: 1,
  investments: 1,
  liabilities: 0,
  applied: false,
};

// ===================================================================

describe("exportar", () => {
  test("'Exportar datos' pide /export y descarga con el nombre del servidor", async () => {
    const { dom, llamadas } = await montar();
    $(dom, "btn-exportar-json").click();
    await esperar();

    assert.deepEqual(llamadas.descargar[0], ["/export"]);
    assert.equal(llamadas.clicksDeDescarga.length, 1);
    assert.equal(llamadas.clicksDeDescarga[0].nombre, "respaldo.json");
  });

  test("'Exportar CSV' pide el formato csv", async () => {
    const { dom, llamadas } = await montar({
      descargar: async () => ({ blob: new Blob(["x"]), filename: "respaldo.zip" }),
    });
    $(dom, "btn-exportar-csv").click();
    await esperar();

    assert.deepEqual(llamadas.descargar[0], ["/export?format=csv"]);
    assert.equal(llamadas.clicksDeDescarga[0].nombre, "respaldo.zip");
  });

  test("si falla, se avisa sin romper nada", async () => {
    const { ApiError } = await import(rutaAbsoluta("api.js"));
    const { dom, llamadas } = await montar({
      descargar: async () => {
        throw new ApiError({ code: "SIN_RED", message: "No se pudo conectar." });
      },
    });
    $(dom, "btn-exportar-json").click();
    await esperar();

    assert.equal(llamadas.clicksDeDescarga.length, 0);
    assert.equal($(dom, "respaldo-error").hidden, false);
    assert.match($(dom, "respaldo-error").textContent, /conectar/i);
  });
});

describe("elegir un archivo para importar", () => {
  test("pide la vista previa sin confirmar y abre la hoja con los números", async () => {
    const { dom, llamadas } = await montar({
      apiPost: async () => RESPUESTA_PREVIA,
    });
    elegirArchivo(dom, archivoJson(dom, { schema_version: 1 }));
    await esperar();

    assert.equal(llamadas.apiPost.length, 1);
    const [ruta, cuerpo] = llamadas.apiPost[0];
    assert.equal(ruta, "/import");
    assert.equal(cuerpo.confirm, false);

    assert.equal($(dom, "hoja-importar").classList.contains("abierta"), true);
    assert.match($(dom, "importar-vista-previa").textContent, /21/);
    assert.match($(dom, "importar-vista-previa").textContent, /Movimientos/);
  });

  test("un archivo que no es JSON se avisa y no llama a la API", async () => {
    const { dom, llamadas } = await montar();
    const archivo = new dom.window.File(["esto no es json"], "cualquiera.txt");
    elegirArchivo(dom, archivo);
    await esperar();

    assert.equal(llamadas.apiPost.length, 0);
    assert.equal($(dom, "respaldo-error").hidden, false);
    assert.equal($(dom, "hoja-importar").classList.contains("abierta"), false);
  });

  test("si la API rechaza la vista previa, se avisa y no abre la hoja", async () => {
    const { ApiError } = await import(rutaAbsoluta("api.js"));
    const { dom } = await montar({
      apiPost: async () => {
        throw new ApiError({ code: "CONFLICT", message: "Esta cuenta ya tiene datos cargados." });
      },
    });
    elegirArchivo(dom, archivoJson(dom, { schema_version: 1 }));
    await esperar();

    assert.equal($(dom, "hoja-importar").classList.contains("abierta"), false);
    assert.match($(dom, "respaldo-error").textContent, /ya tiene datos/i);
  });
});

describe("confirmar la importación", () => {
  async function abrirConVistaPrevia(dom) {
    elegirArchivo(dom, archivoJson(dom, { schema_version: 1 }));
    await esperar();
  }

  test("repite el pedido con confirm: true y recarga la página", async () => {
    const { dom, llamadas } = await montar({ apiPost: async () => RESPUESTA_PREVIA });
    await abrirConVistaPrevia(dom);

    $(dom, "importar-confirmar").click();
    await esperar();

    assert.equal(llamadas.apiPost.length, 2);
    assert.equal(llamadas.apiPost[1][1].confirm, true);
    assert.match(llamadas.toasts[0][0], /importado/i);
    assert.equal(llamadas.recargo, 1);
  });

  test("si la confirmación falla, el error queda en la hoja y no recarga", async () => {
    const { ApiError } = await import(rutaAbsoluta("api.js"));
    let falla = false;
    const { dom, llamadas } = await montar({
      apiPost: async (...a) => {
        if (falla) throw new ApiError({ code: "CONFLICT", message: "Ya no está limpia." });
        return RESPUESTA_PREVIA;
      },
    });
    await abrirConVistaPrevia(dom);
    falla = true;

    $(dom, "importar-confirmar").click();
    await esperar();

    assert.equal(llamadas.recargo, 0);
    assert.equal($(dom, "hoja-importar").classList.contains("abierta"), true);
    assert.match($(dom, "importar-error").textContent, /no está limpia/i);
  });
});
