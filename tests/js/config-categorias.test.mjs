/* Pruebas de la administración de categorías · F03-T10
   Se corren con `npm test` (`node --test tests/js/*.test.mjs`).

   El HTML sale del `index.html` real, igual que `config-cuenta.test.mjs`.
   Se doblan `api` (get/post/patch) y `toast`: son lo que hay que
   controlar para simular las respuestas del servidor sin red de
   verdad. `ApiError` se importa real —mismo motivo que en
   `config-cuenta.test.mjs`: `e instanceof ApiError` tiene que seguir
   siendo la misma clase que usa `config-categorias.js`—, y
   `crearHoja` (de `components/sheet.js`) también se importa real: es
   la misma hoja que prueba `sheet.test.mjs`, y acá lo que importa es
   que se abra con los datos correctos, no reprobar la hoja en sí.

   Los tres criterios de aceptación de la tarea, cada uno con sus
   pruebas: se agrega, se renombra y se archiva una categoría — todo
   con lo que el teléfono puede tocar: un botón, nunca un `div` con
   `onclick`. */

import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..");
const INDEX = resolve(RAIZ, "web", "index.html");

// La misma clase que importa (real) `config-categorias.js` doblado:
// hace falta acá para fabricar un `ApiError` de prueba y comprobar que
// `e instanceof ApiError` elige el mensaje correcto.
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

/** La tarjeta de Categorías, recortada del `index.html` que se publica. */
function htmlDeCategorias() {
  const html = readFileSync(INDEX, "utf8");
  const ancla = html.indexOf("<h2>Categorías</h2>");
  assert.notEqual(ancla, -1, "no se encuentra la tarjeta de Categorías en index.html");
  const desde = html.lastIndexOf('<article class="card shell">', ancla);
  const hasta = html.indexOf("</article>", ancla) + "</article>".length;
  return html.slice(desde, hasta);
}

/** La hoja de alta y edición, recortada del mismo `index.html`. */
function htmlDeLaHoja() {
  const html = readFileSync(INDEX, "utf8");
  const ancla = html.indexOf('id="hoja-categoria"');
  assert.notEqual(ancla, -1, "no se encuentra la hoja de categoría en index.html");
  const desde = html.lastIndexOf("<aside", ancla);
  const hasta = html.indexOf("</aside>", ancla) + "</aside>".length;
  return html.slice(desde, hasta);
}

async function cargarConDobles() {
  let codigo = readFileSync(resolve(RAIZ, "web", "src", "js", "config-categorias.js"), "utf8");
  codigo = codigo
    .replace(
      'import { api, ApiError } from "./api.js";',
      `import { ApiError } from "file:///${resolve(RAIZ, "web", "src", "js", "api.js").replace(/\\/g, "/")}";\n` +
        "const api = {\n" +
        "  get: (...a) => globalThis.__espia.apiGet(...a),\n" +
        "  post: (...a) => globalThis.__espia.apiPost(...a),\n" +
        "  patch: (...a) => globalThis.__espia.apiPatch(...a),\n" +
        "};",
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
      'import { bloqueCargando, error as estadoError, vacio } from "./components/estados.js";',
      `import { bloqueCargando, error as estadoError, vacio } from "file:///${resolve(RAIZ, "web", "src", "js", "components", "estados.js").replace(/\\/g, "/")}";`,
    )
    .replace(
      'import { esc } from "./format.js";',
      `import { esc } from "file:///${resolve(RAIZ, "web", "src", "js", "format.js").replace(/\\/g, "/")}";`,
    )
    .replace(
      'import { categorias as categoriasCacheadas, invalidarCategorias } from "./cache-categorias.js";',
      // La de verdad comparte caché con movimientos.js y
      // alta-movimiento.js (probado en cache-categorias.test.mjs);
      // acá alcanza con que pida /categories, igual que antes.
      'const categoriasCacheadas = () => globalThis.__espia.apiGet("/categories");\n' +
        "const invalidarCategorias = () => globalThis.__espia.invalidarCategorias();",
    );

  const unico = `\n// ${Math.random()}\n`;
  const url = `data:text/javascript;base64,${Buffer.from(codigo + unico, "utf8").toString("base64")}`;
  return import(url);
}

const CATEGORIAS_DE_PRUEBA = [
  { id: 1, name: "Sueldo", type: "income", active: true, sort_order: 1 },
  { id: 2, name: "Supermercado", type: "expense", active: true, sort_order: 2 },
  { id: 3, name: "Mascota", type: "expense", active: false, sort_order: 3 },
];

/**
 * Monta la tarjeta y la hoja, y carga `config-categorias.js` con dobles.
 *
 * @param {object} opciones
 * @param {(path:string)=>Promise<object[]>} [opciones.apiGet]
 * @param {(path:string, datos:object)=>Promise<object>} [opciones.apiPost]
 * @param {(path:string, datos:object)=>Promise<object>} [opciones.apiPatch]
 */
async function montar({
  apiGet = async () => structuredClone(CATEGORIAS_DE_PRUEBA),
  apiPost = async () => ({}),
  apiPatch = async () => ({}),
} = {}) {
  const dom = new JSDOM(
    `<!doctype html><html><body>${htmlDeCategorias()}${htmlDeLaHoja()}` +
      `<div class="fondo-hoja" id="fondo-hoja"></div></body></html>`,
    { url: "https://epic-wallet-v2.vercel.app/#/config", pretendToBeVisual: true },
  );
  ventanas.push(dom.window);

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.CustomEvent = dom.window.CustomEvent;

  const llamadas = { apiGet: [], apiPost: [], apiPatch: [], toasts: [], invalidaciones: 0 };
  globalThis.__espia = {
    apiGet: async (...a) => {
      llamadas.apiGet.push(a);
      return apiGet(...a);
    },
    apiPost: async (...a) => {
      llamadas.apiPost.push(a);
      return apiPost(...a);
    },
    apiPatch: async (...a) => {
      llamadas.apiPatch.push(a);
      return apiPatch(...a);
    },
    toast: (...a) => llamadas.toasts.push(a),
    invalidarCategorias: () => {
      llamadas.invalidaciones++;
    },
  };

  const mod = await cargarConDobles();
  return { dom, mod, llamadas };
}

const $ = (dom, id) => dom.window.document.getElementById(id);
const esperar = (ms = 10) => new Promise((listo) => setTimeout(listo, ms));

function tipear(campo) {
  campo.dispatchEvent(new campo.ownerDocument.defaultView.Event("input", { bubbles: true }));
}

function enviar(dom, idForm) {
  const form = $(dom, idForm);
  const evento = new dom.window.Event("submit", { bubbles: true, cancelable: true });
  form.dispatchEvent(evento);
  return evento;
}

function filas(dom) {
  return [...dom.window.document.querySelectorAll("#config-categorias .cfg-row")];
}

// ===================================================================

describe("la lista de categorías", () => {
  test("pinta el nombre y el tipo de cada una", async () => {
    const { dom } = await montar();
    await esperar();

    const f = filas(dom);
    assert.equal(f.length, 3);
    assert.equal(f[0].querySelector(".cfg-nombre b").textContent, "Sueldo");
    assert.equal(f[0].querySelector(".cfg-nombre span").textContent, "Ingreso");
    assert.equal(f[1].querySelector(".cfg-nombre span").textContent, "Egreso");
  });

  test("cada fila es un botón, no un div con onclick", async () => {
    // Regla de accesibilidad de la aplicación: se abre para editar,
    // así que tiene que alcanzarse con el tabulador.
    const { dom } = await montar();
    await esperar();
    const f = filas(dom);
    assert.equal(f[0].querySelector(".cfg-nombre").tagName, "BUTTON");
  });

  test("el interruptor de archivar refleja si está activa", async () => {
    const { dom } = await montar();
    await esperar();
    const f = filas(dom);
    assert.equal(f[0].querySelector(".toggle").getAttribute("aria-checked"), "true");
    assert.equal(f[2].querySelector(".toggle").getAttribute("aria-checked"), "false");
  });

  test("sin categorías, muestra un estado vacío y no una lista en blanco", async () => {
    const { dom } = await montar({ apiGet: async () => [] });
    await esperar();
    const caja = $(dom, "config-categorias");
    assert.equal(filas(dom).length, 0);
    assert.match(caja.textContent, /no hay categorías/i);
  });

  test("si la API falla, muestra un error con botón para reintentar", async () => {
    let primera = true;
    const { dom, llamadas } = await montar({
      apiGet: async () => {
        if (primera) {
          primera = false;
          throw new Error("sin red");
        }
        return structuredClone(CATEGORIAS_DE_PRUEBA);
      },
    });
    await esperar();

    const caja = $(dom, "config-categorias");
    const reintentar = caja.querySelector("[data-reintentar]");
    assert.ok(reintentar, "tiene que haber un botón para reintentar");

    reintentar.click();
    await esperar();

    assert.equal(llamadas.apiGet.length, 2);
    assert.equal(filas(dom).length, 3, "después de reintentar, se ven las categorías");
  });
});

// ===================================================================

describe("alta de categoría", () => {
  test("+ Nueva abre la hoja vacía, con Egreso elegido por defecto", async () => {
    const { dom } = await montar();
    await esperar();

    $(dom, "btn-nueva-categoria").click();

    const hoja = $(dom, "hoja-categoria");
    assert.equal(hoja.classList.contains("abierta"), true);
    assert.equal($(dom, "hoja-categoria-titulo").textContent, "Nueva categoría");
    assert.equal($(dom, "categoria-nombre").value, "");
    assert.equal($(dom, "categoria-tipo-campo").hidden, false);
    assert.equal(
      hoja.querySelector('[data-tipo="expense"]').classList.contains("activa"),
      true,
    );
  });

  test("sin nombre, muestra un error y no llama a la API", async () => {
    const { dom, llamadas } = await montar();
    await esperar();
    $(dom, "btn-nueva-categoria").click();

    enviar(dom, "form-categoria");
    await esperar();

    assert.equal(llamadas.apiPost.length, 0);
    assert.equal($(dom, "categoria-error").hidden, false);
  });

  test("crear manda el nombre recortado y el tipo elegido", async () => {
    const { dom, llamadas } = await montar();
    await esperar();
    $(dom, "btn-nueva-categoria").click();

    const nombre = /** @type {HTMLInputElement} */ ($(dom, "categoria-nombre"));
    nombre.value = "  Gimnasio  ";
    tipear(nombre);

    const hoja = $(dom, "hoja-categoria");
    hoja.querySelector('[data-tipo="income"]').click();

    enviar(dom, "form-categoria");
    await esperar();

    assert.equal(llamadas.apiPost.length, 1);
    assert.deepEqual(llamadas.apiPost[0], ["/categories", { name: "Gimnasio", type: "income" }]);
  });

  test("después de crear, la hoja se cierra y la lista se vuelve a pedir", async () => {
    const { dom, llamadas } = await montar();
    await esperar();
    $(dom, "btn-nueva-categoria").click();

    $(dom, "categoria-nombre").value = "Gimnasio";
    enviar(dom, "form-categoria");
    await esperar();

    assert.equal($(dom, "hoja-categoria").classList.contains("abierta"), false);
    assert.equal(llamadas.apiGet.length, 2, "la carga inicial más la de después de guardar");
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
        return {};
      },
    });
    await esperar();
    $(dom, "btn-nueva-categoria").click();
    $(dom, "categoria-nombre").value = "Gimnasio";

    enviar(dom, "form-categoria");
    enviar(dom, "form-categoria");
    enviar(dom, "form-categoria");
    await esperar(80);

    assert.equal(maximo, 1, "dos envíos casi juntos no tienen que llegar los dos a la API");
  });

  test("si la API rechaza, muestra el mensaje y no cierra la hoja", async () => {
    const { dom } = await montar({
      apiPost: async () => {
        throw new ApiError({ code: "CONFLICT", message: "Ya existe una categoría con ese nombre." });
      },
    });
    await esperar();
    $(dom, "btn-nueva-categoria").click();
    $(dom, "categoria-nombre").value = "Sueldo";

    enviar(dom, "form-categoria");
    await esperar();

    assert.equal($(dom, "hoja-categoria").classList.contains("abierta"), true);
    assert.equal($(dom, "categoria-error").textContent, "Ya existe una categoría con ese nombre.");
  });
});

// ===================================================================

describe("renombrar una categoría", () => {
  test("tocar el nombre abre la hoja en modo edición, sin el selector de tipo", async () => {
    const { dom } = await montar();
    await esperar();

    filas(dom)[1].querySelector(".cfg-nombre").click();

    assert.equal($(dom, "hoja-categoria-titulo").textContent, "Editar categoría");
    assert.equal($(dom, "categoria-nombre").value, "Supermercado");
    assert.equal($(dom, "categoria-tipo-campo").hidden, true, "el tipo no se puede cambiar al editar");
  });

  test("guardar manda sólo el nombre, nunca el tipo", async () => {
    const { dom, llamadas } = await montar();
    await esperar();
    filas(dom)[1].querySelector(".cfg-nombre").click();

    $(dom, "categoria-nombre").value = "Súper";
    enviar(dom, "form-categoria");
    await esperar();

    assert.equal(llamadas.apiPatch.length, 1);
    assert.deepEqual(llamadas.apiPatch[0], ["/categories/2", { name: "Súper" }]);
  });
});

// ===================================================================

describe("archivar y reactivar", () => {
  test("tocar el interruptor de una categoría activa la archiva", async () => {
    const { dom, llamadas } = await montar();
    await esperar();

    filas(dom)[0].querySelector(".toggle").click();
    await esperar();

    assert.deepEqual(llamadas.apiPatch[0], ["/categories/1", { active: false }]);
    assert.equal(filas(dom)[0].querySelector(".toggle").getAttribute("aria-checked"), "false");
  });

  test("tocar el interruptor de una categoría archivada la reactiva", async () => {
    const { dom, llamadas } = await montar();
    await esperar();

    filas(dom)[2].querySelector(".toggle").click();
    await esperar();

    assert.deepEqual(llamadas.apiPatch[0], ["/categories/3", { active: true }]);
    assert.equal(filas(dom)[2].querySelector(".toggle").getAttribute("aria-checked"), "true");
  });

  test("archivar no abre la hoja", async () => {
    const { dom } = await montar();
    await esperar();
    filas(dom)[0].querySelector(".toggle").click();
    await esperar();
    assert.equal($(dom, "hoja-categoria").classList.contains("abierta"), false);
  });

  test("si la API rechaza, el interruptor vuelve a como estaba", async () => {
    const { dom } = await montar({
      apiPatch: async () => {
        throw new ApiError({ code: "INTERNAL_ERROR" });
      },
    });
    await esperar();

    const toggle = filas(dom)[0].querySelector(".toggle");
    assert.equal(toggle.getAttribute("aria-checked"), "true");
    toggle.click();
    await esperar();

    // Se vuelve a pintar desde la lista, que nunca cambió: el
    // interruptor refleja lo que de verdad quedó guardado.
    assert.equal(filas(dom)[0].querySelector(".toggle").getAttribute("aria-checked"), "true");
  });
});
