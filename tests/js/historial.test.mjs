/* Pruebas del controlador de la vista Historial · F06-T07 (gráfico) y
   F08-T07 (tabla y carga de mes histórico, rediseñada a pedido de
   Gustavo: cada línea es una categoría con su importe, Sueldo
   incluido; ingresos/egresos/ahorro se suman solos).

   El HTML sale del `index.html` real, mismo criterio que
   `config-categorias.test.mjs`: la sección Historial y la hoja
   `#hoja-historico` se recortan de ahí, así una prueba nota si el
   `id` que usa `historial.js` deja de existir en la plantilla.

   Se doblan `api` (get/post), `toast`, `cache-meses` (mismo motivo que
   `cache-categorias.js` en `config-categorias.test.mjs`: alcanza con
   que pida `/months`, no hace falta su caché de verdad acá) y
   `cache-categorias`. `ApiError` se importa real —`e instanceof
   ApiError` tiene que seguir siendo la misma clase—, igual que
   `crearHoja`, `format.js`, `components/estados.js` y
   `components/avisos.js`: son puras, y lo que importa es que
   `historial.js` las use bien, no reprobarlas.

   Lo que puede fallar en silencio y por eso se prueba: el gráfico y la
   tabla piden sus datos recién al entrar a Historial y los vuelven a
   pedir cada vez (sin caché vieja); los totales del formulario son
   siempre la suma de las líneas, nunca un campo editable; una línea
   de ingreso (Sueldo) suma a ingresos y una de egreso a egresos;
   crear una categoría nueva sin salir de la hoja la deja elegida y
   lista para escribir el importe; y un 409 del servidor (mes abierto
   con movimientos) se confirma con `window.confirm` antes de
   reintentar con `confirm: true` — cancelar no manda nada. */

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

/** La sección Historial completa (tabla y botón), recortada de verdad. */
function htmlDeHistorial() {
  const html = readFileSync(INDEX, "utf8");
  const ancla = html.indexOf('data-vista="historial"');
  assert.notEqual(ancla, -1, "no se encuentra la vista Historial en index.html");
  const desde = html.lastIndexOf("<section", ancla);
  const hasta = html.indexOf("</section>", ancla) + "</section>".length;
  return html.slice(desde, hasta);
}

/** La hoja de carga de mes histórico, recortada del mismo archivo. */
function htmlDeLaHoja() {
  const html = readFileSync(INDEX, "utf8");
  const ancla = html.indexOf('id="hoja-historico"');
  assert.notEqual(ancla, -1, "no se encuentra la hoja de mes histórico en index.html");
  const desde = html.lastIndexOf("<aside", ancla);
  const hasta = html.indexOf("</aside>", ancla) + "</aside>".length;
  return html.slice(desde, hasta);
}

async function cargarConDobles() {
  let codigo = readFileSync(resolve(RAIZ, "web", "src", "js", "historial.js"), "utf8");
  codigo = codigo
    .replace(
      'import { api, ApiError } from "./api.js";',
      `import { ApiError } from "${rutaAbsoluta("api.js")}";\n` +
        "const api = {\n" +
        "  get: (...a) => globalThis.__espia.apiGet(...a),\n" +
        "  post: (...a) => globalThis.__espia.apiPost(...a),\n" +
        "};",
    )
    .replace(
      'import { esc, fmtK, fmtS, pctPlano } from "./format.js";',
      `import { esc, fmtK, fmtS, pctPlano } from "${rutaAbsoluta("format.js")}";`,
    )
    .replace(
      'import { bloqueCargando, error as estadoError } from "./components/estados.js";',
      `import { bloqueCargando, error as estadoError } from "${rutaAbsoluta("components", "estados.js")}";`,
    )
    .replace(
      'import { pildora } from "./components/avisos.js";',
      `import { pildora } from "${rutaAbsoluta("components", "avisos.js")}";`,
    )
    .replace(
      'import { crearHoja } from "./components/sheet.js";',
      // `?t=` para que el contador de hojas abiertas no se comparta
      // con otros archivos de prueba dentro del mismo proceso.
      `import { crearHoja } from "${rutaAbsoluta("components", "sheet.js")}?t=${Math.random()}";`,
    )
    .replace(
      'import { toast } from "./components/toast.js";',
      "const toast = (...a) => globalThis.__espia.toast(...a);",
    )
    .replace('import { EVENTO as EVENTO_RUTA } from "./router.js";', 'const EVENTO_RUTA = "epic:ruta";')
    .replace(
      'import { dibujar as dibujarGraficoAhorro } from "./charts/ahorro.js";',
      `import { dibujar as dibujarGraficoAhorro } from "${rutaAbsoluta("charts", "ahorro.js")}";`,
    )
    .replace(
      'import { dibujar as dibujarGraficoSeis, etiquetaDeMes } from "./charts/seis.js";',
      `import { dibujar as dibujarGraficoSeis, etiquetaDeMes } from "${rutaAbsoluta("charts", "seis.js")}";`,
    )
    .replace(
      'import { meses as mesesCacheados, invalidarMeses } from "./cache-meses.js";',
      'const mesesCacheados = () => globalThis.__espia.apiGet("/months");\n' +
        "const invalidarMeses = () => globalThis.__espia.invalidarMeses();",
    )
    .replace(
      'import { activas as categoriasActivas, invalidarCategorias } from "./cache-categorias.js";',
      'const categoriasActivas = async () => (await globalThis.__espia.apiGet("/categories")).filter((c) => c.active);\n' +
        "const invalidarCategorias = () => globalThis.__espia.invalidarCategorias();",
    );

  const unico = `\n// ${Math.random()}\n`;
  const url = `data:text/javascript;base64,${Buffer.from(codigo + unico, "utf8").toString("base64")}`;
  return import(url);
}

function serieBase() {
  return [
    { year: 2026, month: 8, balance: "300000.00" },
    { year: 2026, month: 9, balance: "450000.00" },
    { year: 2026, month: 10, balance: "500000.00" },
  ];
}

const MESES_DE_PRUEBA = [
  {
    id: 7,
    year: 2026,
    month: 10,
    status: "open",
    income_total: "600000.00",
    expense_total: "400000.00",
    saving_total: "200000.00",
    closing_balance: "500000.00",
    saving_rate: "33.3",
  },
  {
    id: 6,
    year: 2026,
    month: 9,
    status: "historical",
    income_total: "500000.00",
    expense_total: "350000.00",
    saving_total: "150000.00",
    closing_balance: "300000.00",
    saving_rate: "30.0",
  },
];

const CATEGORIAS_DE_PRUEBA = [
  { id: 1, name: "Sueldo", type: "income", active: true },
  { id: 2, name: "Alquiler", type: "expense", active: true },
  { id: 3, name: "Mascota", type: "expense", active: false },
];

// El detalle del mes id=6 (septiembre 2026, histórico) ya tiene una
// línea de Sueldo cargada — lo que hace falta para probar que abrir
// ese mes de nuevo la precarga en vez de arrancar en blanco.
const DETALLE_MES_6 = {
  ...MESES_DE_PRUEBA[1],
  opening_balance: "0.00",
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
  transactions: null,
  categories: [{ category_id: 1, total_amount: "500000.00" }],
};

let proximoIdCreado = 100;

/**
 * @param {object} opciones
 * @param {(path:string)=>Promise<any>} [opciones.apiGet]
 * @param {(path:string, datos:object)=>Promise<any>} [opciones.apiPostHistorico]
 *   sólo para POST /months/historical — la creación de categorías
 *   (POST /categories) la resuelve `montar` siempre igual, salvo que
 *   se pase explícitamente.
 */
async function montar({ apiGet, apiPostHistorico = async () => ({}), apiPostCategoria } = {}) {
  const html =
    `<!doctype html><html><body>${htmlDeHistorial()}${htmlDeLaHoja()}` +
    `<div class="fondo-hoja" id="fondo-hoja"></div></body></html>`;
  const dom = new JSDOM(html, {
    url: "https://epic-wallet-v2.vercel.app/#/historial",
    pretendToBeVisual: true,
  });
  ventanas.push(dom.window);

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.CustomEvent = dom.window.CustomEvent;
  // `window.confirm` no existe en jsdom: por defecto, "aceptar".
  dom.window.confirm = () => true;

  const resolverGet = (path) => {
    if (path === "/months") return structuredClone(MESES_DE_PRUEBA);
    if (path.startsWith("/months/savings-evolution")) return serieBase();
    if (path === "/categories") return structuredClone(CATEGORIAS_DE_PRUEBA);
    if (path === "/months/6") return structuredClone(DETALLE_MES_6);
    throw new Error(`ruta no esperada en la prueba: ${path}`);
  };

  const crearCategoria = (datos) => ({
    id: proximoIdCreado++,
    active: true,
    sort_order: 99,
    ...datos,
  });

  const llamadas = { apiGet: [], apiPost: [], toasts: [], invalidaciones: 0, invalidacionesCategorias: 0 };
  globalThis.__espia = {
    apiGet: async (...a) => {
      llamadas.apiGet.push(a);
      return (apiGet ?? resolverGet)(...a);
    },
    apiPost: async (ruta, datos) => {
      llamadas.apiPost.push([ruta, datos]);
      if (ruta === "/categories") return (apiPostCategoria ?? crearCategoria)(datos);
      return apiPostHistorico(ruta, datos);
    },
    toast: (...a) => llamadas.toasts.push(a),
    invalidarMeses: () => {
      llamadas.invalidaciones++;
    },
    invalidarCategorias: () => {
      llamadas.invalidacionesCategorias++;
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

function tipear(campo, valor) {
  if (valor !== undefined) campo.value = valor;
  campo.dispatchEvent(new campo.ownerDocument.defaultView.Event("input", { bubbles: true }));
}

function cambiar(campo, valor) {
  if (valor !== undefined) campo.value = valor;
  campo.dispatchEvent(new campo.ownerDocument.defaultView.Event("change", { bubbles: true }));
}

/** Las líneas de la hoja de carga histórica, en orden. */
function lineas(dom) {
  return [...dom.window.document.querySelectorAll("#historico-lineas .hist-linea-wrap")];
}

function selectDe(fila) {
  return fila.querySelector("[data-cat-select]");
}
function importeDe(fila) {
  return fila.querySelector("[data-cat-importe]");
}

function enviar(dom, idForm) {
  const form = $(dom, idForm);
  const evento = new dom.window.Event("submit", { bubbles: true, cancelable: true });
  form.dispatchEvent(evento);
  return evento;
}

function filasTabla(dom) {
  return [...dom.window.document.querySelectorAll("#historial-tabla tr")];
}

// ===================================================================
//  El gráfico de evolución del ahorro · F06-T07
// ===================================================================

describe("antes de entrar a Historial", () => {
  test("no pide nada todavía", async () => {
    const { llamadas } = await montar();
    await esperar();
    assert.equal(llamadas.apiGet.length, 0);
  });
});

describe("al entrar a Historial, el gráfico", () => {
  test("pide la serie y dibuja el gráfico con los datos reales", async () => {
    const { dom, llamadas } = await montar();
    entrarA(dom, "historial");
    await esperar();

    const grafico = $(dom, "grafico-ahorro");
    assert.ok(llamadas.apiGet.some((a) => a[0] === "/months/savings-evolution"));
    assert.match(grafico.innerHTML, /<svg/);
    assert.match(grafico.innerHTML, /Octubre 26/);
  });

  test("el pie muestra el saldo actual y la cantidad de meses", async () => {
    const { dom } = await montar();
    entrarA(dom, "historial");
    await esperar();

    const pie = $(dom, "ahorro-pie");
    assert.match(pie.innerHTML, /Saldo actual/);
    assert.match(pie.innerHTML, />\$500k</);
    assert.match(pie.innerHTML, /Meses registrados/);
  });

  test("otra ruta que no es historial no dispara ningún pedido", async () => {
    const { dom, llamadas } = await montar();
    entrarA(dom, "inicio");
    await esperar();
    assert.equal(llamadas.apiGet.length, 0);
  });

  test("volver a entrar pide todo de nuevo — no hay caché que pueda quedar vieja", async () => {
    const { dom, llamadas } = await montar();
    entrarA(dom, "historial");
    await esperar();
    entrarA(dom, "inicio");
    await esperar();
    entrarA(dom, "historial");
    await esperar();
    assert.equal(llamadas.apiGet.filter((a) => a[0] === "/months/savings-evolution").length, 2);
  });

  test("si falla el pedido, muestra el estado de error con botón para reintentar", async () => {
    const { dom } = await montar({
      apiGet: async (path) => {
        if (path.startsWith("/months/savings-evolution")) throw new Error("red caída");
        return path === "/months" ? structuredClone(MESES_DE_PRUEBA) : [];
      },
    });
    entrarA(dom, "historial");
    await esperar();

    const grafico = $(dom, "grafico-ahorro");
    assert.match(grafico.innerHTML, /No se pudo cargar/);
    assert.ok(grafico.querySelector("[data-reintentar]"));
  });
});

// ===================================================================
//  Últimos seis meses · F06-T05, mudado acá el 2026-10-17
// ===================================================================

describe("al entrar a Historial, los últimos seis meses", () => {
  test("se dibujan a partir de la misma lista de /months, sin un endpoint propio", async () => {
    const { dom, llamadas } = await montar();
    entrarA(dom, "historial");
    await esperar();

    const grafico = $(dom, "grafico-seis");
    assert.match(grafico.innerHTML, /<svg/);
    // Los dos meses de prueba, tres barras cada uno.
    assert.equal(grafico.querySelectorAll(".bar").length, 6);
    assert.ok(llamadas.apiGet.some((a) => a[0] === "/months"));
    assert.ok(!llamadas.apiGet.some((a) => a[0].startsWith("/dashboard")), "no depende de /api/dashboard");
  });

  test("ya no existe el conmutador de modos: siempre son barras", async () => {
    const { dom } = await montar();
    entrarA(dom, "historial");
    await esperar();

    assert.equal($(dom, "seis-modo"), null);
  });

  test("el pie muestra los meses que hay (acá, los dos de prueba)", async () => {
    const { dom } = await montar();
    entrarA(dom, "historial");
    await esperar();

    const pie = $(dom, "pie-seis");
    assert.equal(pie.querySelectorAll(".mini").length, 2);
    assert.match(pie.textContent, /Septiembre 26/);
    assert.match(pie.textContent, /Octubre 26/);
  });

  test("si falla el pedido, muestra el estado de error con botón para reintentar", async () => {
    const { dom } = await montar({
      apiGet: async (path) => {
        if (path === "/months") throw new Error("red caída");
        return path.startsWith("/months/savings-evolution") ? serieBase() : [];
      },
    });
    entrarA(dom, "historial");
    await esperar();

    const grafico = $(dom, "grafico-seis");
    assert.match(grafico.innerHTML, /No se pudo cargar/);
    assert.ok(grafico.querySelector("[data-reintentar]"));
  });
});

// ===================================================================
//  La tabla de meses · F08-T07
// ===================================================================

describe("la tabla de meses", () => {
  test("pinta cada mes con sus totales, la tasa y el estado", async () => {
    const { dom } = await montar();
    entrarA(dom, "historial");
    await esperar();

    const filas = filasTabla(dom);
    assert.equal(filas.length, 2);
    assert.match(filas[0].textContent, /Octubre 2026/);
    assert.match(filas[0].textContent, /33,3%/);
    assert.match(filas[0].textContent, /Abierto/);
    assert.match(filas[1].textContent, /Septiembre 2026/);
    assert.match(filas[1].textContent, /Consolidado/);
  });

  test("una tasa nula muestra N/A, nunca 0% ni un error", async () => {
    const { dom } = await montar({
      apiGet: async (path) =>
        path === "/months"
          ? [{ ...MESES_DE_PRUEBA[0], income_total: "0.00", saving_rate: null }]
          : path.startsWith("/months/savings-evolution")
            ? serieBase()
            : [],
    });
    entrarA(dom, "historial");
    await esperar();

    assert.match(filasTabla(dom)[0].textContent, /N\/A/);
  });

  test("sin meses, muestra un estado explicativo y no una tabla en blanco", async () => {
    const { dom } = await montar({
      apiGet: async (path) => (path.startsWith("/months/savings-evolution") ? serieBase() : []),
    });
    entrarA(dom, "historial");
    await esperar();

    assert.match($(dom, "historial-tabla").textContent, /Todavía no hay meses cargados/);
  });

  test("si falla, el botón de reintentar vuelve a pedir y se recupera", async () => {
    let falla = true;
    const { dom, llamadas } = await montar({
      apiGet: async (path) => {
        if (path === "/months") {
          if (falla) throw new Error("red caída");
          return structuredClone(MESES_DE_PRUEBA);
        }
        return path.startsWith("/months/savings-evolution") ? serieBase() : [];
      },
    });
    entrarA(dom, "historial");
    await esperar();
    assert.match($(dom, "historial-tabla").textContent, /No se pudo cargar/);

    falla = false;
    $(dom, "historial-tabla").querySelector("[data-reintentar]").click();
    await esperar();

    assert.equal(filasTabla(dom).length, 2);
    assert.ok(llamadas.apiGet.filter((a) => a[0] === "/months").length >= 2);
  });
});

// ===================================================================
//  Carga de mes histórico · F08-T07
// ===================================================================

describe("abrir la hoja de carga", () => {
  test("limpia el mes y arranca con una línea en blanco, no vacía", async () => {
    const { dom } = await montar();
    entrarA(dom, "historial");
    await esperar();

    $(dom, "btn-cargar-historico").click();
    await esperar();

    assert.equal($(dom, "hoja-historico").classList.contains("abierta"), true);
    assert.equal($(dom, "historico-periodo").value, "");
    assert.equal(lineas(dom).length, 1);
    assert.equal(selectDe(lineas(dom)[0]).value, "");
  });

  test("cada línea ofrece las categorías activas, de ingreso y de egreso, agrupadas", async () => {
    const { dom } = await montar();
    entrarA(dom, "historial");
    await esperar();
    $(dom, "btn-cargar-historico").click();
    await esperar();

    const select = selectDe(lineas(dom)[0]);
    assert.match(select.innerHTML, /<optgroup label="Ingresos">[\s\S]*Sueldo/);
    assert.match(select.innerHTML, /<optgroup label="Egresos">[\s\S]*Alquiler/);
    assert.doesNotMatch(select.innerHTML, /Mascota/); // está archivada
  });

  test("+ Agregar categoría suma una línea más, una vez elegida la anterior", async () => {
    const { dom } = await montar();
    entrarA(dom, "historial");
    await esperar();
    $(dom, "btn-cargar-historico").click();
    await esperar();

    cambiar(selectDe(lineas(dom)[0]), "2");
    $(dom, "historico-agregar-linea").click();
    assert.equal(lineas(dom).length, 2);
  });

  test("quitar una línea la saca de la lista y de los totales", async () => {
    const { dom } = await montar();
    entrarA(dom, "historial");
    await esperar();
    $(dom, "btn-cargar-historico").click();
    await esperar();

    cambiar(selectDe(lineas(dom)[0]), "2"); // Alquiler
    tipear(importeDe(lineas(dom)[0]), "50000");
    assert.equal($(dom, "historico-total-egresos").textContent, "$50.000");

    lineas(dom)[0].querySelector("[data-quitar]").click();
    assert.equal(lineas(dom).length, 0);
    assert.equal($(dom, "historico-total-egresos").textContent, "$0");
  });
});

describe('"+ Agregar categoría" se bloquea con una línea incompleta', () => {
  test("arranca bloqueado: la primera línea todavía no tiene categoría", async () => {
    const { dom } = await montar();
    entrarA(dom, "historial");
    await esperar();
    $(dom, "btn-cargar-historico").click();
    await esperar();

    assert.equal($(dom, "historico-agregar-linea").disabled, true);
  });

  test("se habilita apenas la línea tiene categoría elegida", async () => {
    const { dom } = await montar();
    entrarA(dom, "historial");
    await esperar();
    $(dom, "btn-cargar-historico").click();
    await esperar();

    cambiar(selectDe(lineas(dom)[0]), "2");
    assert.equal($(dom, "historico-agregar-linea").disabled, false);
  });

  test("se vuelve a bloquear mientras se está creando una categoría nueva", async () => {
    const { dom } = await montar();
    entrarA(dom, "historial");
    await esperar();
    $(dom, "btn-cargar-historico").click();
    await esperar();

    cambiar(selectDe(lineas(dom)[0]), "2");
    cambiar(selectDe(lineas(dom)[0]), "__nueva__");
    assert.equal($(dom, "historico-agregar-linea").disabled, true);
  });

  test("quitar la única línea incompleta vuelve a habilitar el botón", async () => {
    const { dom } = await montar();
    entrarA(dom, "historial");
    await esperar();
    $(dom, "btn-cargar-historico").click();
    await esperar();

    assert.equal($(dom, "historico-agregar-linea").disabled, true);
    lineas(dom)[0].querySelector("[data-quitar]").click();
    assert.equal($(dom, "historico-agregar-linea").disabled, false);
  });
});

describe("precargar un mes que ya tiene datos", () => {
  test("elegir un mes ya cargado reemplaza la línea en blanco por lo que ya tiene", async () => {
    const { dom, llamadas } = await montar();
    entrarA(dom, "historial");
    await esperar();
    $(dom, "btn-cargar-historico").click();
    await esperar();

    cambiar($(dom, "historico-periodo"), "2026-09"); // es el mes id=6, ya histórico
    await esperar();

    assert.ok(llamadas.apiGet.some((a) => a[0] === "/months/6"));
    assert.equal(lineas(dom).length, 1);
    assert.equal(selectDe(lineas(dom)[0]).value, "1"); // Sueldo
    assert.equal($(dom, "historico-total-ingresos").textContent, "$500.000");
  });

  test("elegir un mes que todavía no existe no toca las líneas ya escritas", async () => {
    const { dom, llamadas } = await montar();
    entrarA(dom, "historial");
    await esperar();
    $(dom, "btn-cargar-historico").click();
    await esperar();

    cambiar(selectDe(lineas(dom)[0]), "2"); // Alquiler, a medio llenar
    cambiar($(dom, "historico-periodo"), "2024-01"); // no existe en /months
    await esperar();

    assert.ok(!llamadas.apiGet.some((a) => /^\/months\/\d+$/.test(a[0])), "no pidió ningún detalle");
    assert.equal(lineas(dom).length, 1);
    assert.equal(selectDe(lineas(dom)[0]).value, "2"); // sigue como estaba
  });
});

describe("los totales se suman solos, nunca se escriben a mano", () => {
  test("una línea de ingreso (Sueldo) suma a ingresos, una de egreso a egresos", async () => {
    const { dom } = await montar();
    entrarA(dom, "historial");
    await esperar();
    $(dom, "btn-cargar-historico").click();
    await esperar();

    cambiar(selectDe(lineas(dom)[0]), "1"); // Sueldo, ingreso
    tipear(importeDe(lineas(dom)[0]), "500000");
    $(dom, "historico-agregar-linea").click();
    cambiar(selectDe(lineas(dom)[1]), "2"); // Alquiler, egreso
    tipear(importeDe(lineas(dom)[1]), "320000");

    assert.equal($(dom, "historico-total-ingresos").textContent, "$500.000");
    assert.equal($(dom, "historico-total-egresos").textContent, "$320.000");
    assert.equal($(dom, "historico-total-ahorro").textContent, "$180.000");
  });

  test("el ahorro puede quedar negativo, sin impedirlo", async () => {
    const { dom } = await montar();
    entrarA(dom, "historial");
    await esperar();
    $(dom, "btn-cargar-historico").click();
    await esperar();

    cambiar(selectDe(lineas(dom)[0]), "1");
    tipear(importeDe(lineas(dom)[0]), "100000");
    $(dom, "historico-agregar-linea").click();
    cambiar(selectDe(lineas(dom)[1]), "2");
    tipear(importeDe(lineas(dom)[1]), "400000");

    assert.equal($(dom, "historico-total-ahorro").textContent, "−$300.000");
  });

  test("dos líneas con la misma categoría se suman entre sí", async () => {
    const { dom } = await montar();
    entrarA(dom, "historial");
    await esperar();
    $(dom, "btn-cargar-historico").click();
    await esperar();

    cambiar(selectDe(lineas(dom)[0]), "2");
    tipear(importeDe(lineas(dom)[0]), "30000");
    $(dom, "historico-agregar-linea").click();
    cambiar(selectDe(lineas(dom)[1]), "2");
    tipear(importeDe(lineas(dom)[1]), "20000");

    assert.equal($(dom, "historico-total-egresos").textContent, "$50.000");
  });
});

describe("crear una categoría nueva sin salir de la hoja", () => {
  test("elegir «+ Crear categoría nueva» muestra el mini-formulario y oculta el selector", async () => {
    const { dom } = await montar();
    entrarA(dom, "historial");
    await esperar();
    $(dom, "btn-cargar-historico").click();
    await esperar();

    const fila = lineas(dom)[0];
    cambiar(selectDe(fila), "__nueva__");

    assert.equal(fila.querySelector("[data-modo='elegir']").hidden, true);
    assert.equal(fila.querySelector("[data-modo='crear']").hidden, false);
  });

  test("sin nombre, muestra un error y no llama a la API", async () => {
    const { dom, llamadas } = await montar();
    entrarA(dom, "historial");
    await esperar();
    $(dom, "btn-cargar-historico").click();
    await esperar();

    const fila = lineas(dom)[0];
    cambiar(selectDe(fila), "__nueva__");
    fila.querySelector("[data-nueva-crear]").click();
    await esperar();

    assert.equal(llamadas.apiPost.length, 0);
    assert.equal($(dom, "historico-error").hidden, false);
  });

  test("crear una categoría la deja elegida en la línea, lista para el importe", async () => {
    const { dom, llamadas } = await montar();
    entrarA(dom, "historial");
    await esperar();
    $(dom, "btn-cargar-historico").click();
    await esperar();

    const fila = lineas(dom)[0];
    cambiar(selectDe(fila), "__nueva__");
    tipear(fila.querySelector("[data-nueva-nombre]"), "Gimnasio");
    fila.querySelector("[data-nueva-tipo='income']").click(); // elegida Ingreso
    fila.querySelector("[data-nueva-crear]").click();
    await esperar();

    assert.deepEqual(llamadas.apiPost.at(-1), ["/categories", { name: "Gimnasio", type: "income" }]);
    assert.equal(llamadas.invalidacionesCategorias, 1);
    assert.equal(fila.querySelector("[data-modo='elegir']").hidden, false);
    assert.equal(fila.querySelector("[data-modo='crear']").hidden, true);
    assert.match(selectDe(fila).innerHTML, /selected/);

    // Ya se puede escribir el importe y que cuente como ingreso.
    tipear(importeDe(fila), "15000");
    assert.equal($(dom, "historico-total-ingresos").textContent, "$15.000");
  });

  test("cancelar vuelve al selector sin crear nada", async () => {
    const { dom, llamadas } = await montar();
    entrarA(dom, "historial");
    await esperar();
    $(dom, "btn-cargar-historico").click();
    await esperar();

    const fila = lineas(dom)[0];
    cambiar(selectDe(fila), "__nueva__");
    fila.querySelector("[data-nueva-cancelar]").click();

    assert.equal(llamadas.apiPost.length, 0);
    assert.equal(fila.querySelector("[data-modo='elegir']").hidden, false);
    assert.equal(fila.querySelector("[data-modo='crear']").hidden, true);
  });
});

describe("guardar la carga", () => {
  test("sin elegir el mes, muestra un error y no llama a la API", async () => {
    const { dom, llamadas } = await montar();
    entrarA(dom, "historial");
    await esperar();
    $(dom, "btn-cargar-historico").click();
    await esperar();

    cambiar(selectDe(lineas(dom)[0]), "2");
    tipear(importeDe(lineas(dom)[0]), "300000");

    enviar(dom, "form-historico");
    await esperar();

    assert.equal(llamadas.apiPost.length, 0);
    assert.equal($(dom, "historico-error").hidden, false);
  });

  test("manda los totales armados desde las líneas y cierra avisando", async () => {
    const { dom, llamadas } = await montar();
    entrarA(dom, "historial");
    await esperar();
    $(dom, "btn-cargar-historico").click();
    await esperar();

    tipear($(dom, "historico-periodo"), "2025-06");
    cambiar(selectDe(lineas(dom)[0]), "1"); // Sueldo, ingreso
    tipear(importeDe(lineas(dom)[0]), "500000");
    $(dom, "historico-agregar-linea").click();
    cambiar(selectDe(lineas(dom)[1]), "2"); // Alquiler, egreso
    tipear(importeDe(lineas(dom)[1]), "300000");

    enviar(dom, "form-historico");
    await esperar();

    assert.equal(llamadas.apiPost.length, 1);
    const [ruta, cuerpo] = llamadas.apiPost[0];
    assert.equal(ruta, "/months/historical");
    assert.equal(cuerpo.year, 2025);
    assert.equal(cuerpo.month, 6);
    assert.equal(cuerpo.income_total, "500000.00");
    assert.equal(cuerpo.expense_total, "300000.00");
    assert.equal(cuerpo.saving_total, "200000.00");
    assert.deepEqual(cuerpo.categories, [
      { category_id: 1, total_amount: "500000.00" },
      { category_id: 2, total_amount: "300000.00" },
    ]);

    assert.equal($(dom, "hoja-historico").classList.contains("abierta"), false);
    assert.equal(llamadas.invalidaciones, 1);
    assert.equal(llamadas.toasts.length, 1);
  });

  test("una línea sin categoría elegida, o con importe en cero, no se manda", async () => {
    const { dom, llamadas } = await montar();
    entrarA(dom, "historial");
    await esperar();
    $(dom, "btn-cargar-historico").click();
    await esperar();

    tipear($(dom, "historico-periodo"), "2025-06");
    cambiar(selectDe(lineas(dom)[0]), "1");
    tipear(importeDe(lineas(dom)[0]), "500000");
    $(dom, "historico-agregar-linea").click(); // línea en blanco, sin tocar

    enviar(dom, "form-historico");
    await esperar();

    assert.deepEqual(llamadas.apiPost[0][1].categories, [{ category_id: 1, total_amount: "500000.00" }]);
  });

  test("dos líneas de la misma categoría se mandan sumadas, no se pisan", async () => {
    const { dom, llamadas } = await montar();
    entrarA(dom, "historial");
    await esperar();
    $(dom, "btn-cargar-historico").click();
    await esperar();

    tipear($(dom, "historico-periodo"), "2025-06");
    cambiar(selectDe(lineas(dom)[0]), "2");
    tipear(importeDe(lineas(dom)[0]), "30000");
    $(dom, "historico-agregar-linea").click();
    cambiar(selectDe(lineas(dom)[1]), "2");
    tipear(importeDe(lineas(dom)[1]), "20000");

    enviar(dom, "form-historico");
    await esperar();

    assert.deepEqual(llamadas.apiPost[0][1].categories, [{ category_id: 2, total_amount: "50000.00" }]);
  });

  test("un 409 (mes en curso con movimientos) se confirma y reintenta con confirm:true", async () => {
    let intentos = 0;
    const { dom, llamadas } = await montar({
      apiPostHistorico: async (_ruta, cuerpo) => {
        intentos++;
        if (!cuerpo.confirm) {
          throw new ApiError({ code: "CONFLICT", message: "Ese mes ya tiene movimientos." });
        }
        return {};
      },
    });
    entrarA(dom, "historial");
    await esperar();
    $(dom, "btn-cargar-historico").click();
    await esperar();

    tipear($(dom, "historico-periodo"), "2026-10");
    cambiar(selectDe(lineas(dom)[0]), "1");
    tipear(importeDe(lineas(dom)[0]), "100000");

    // `window.confirm` está doblado para aceptar (ver `montar`).
    enviar(dom, "form-historico");
    await esperar();

    assert.equal(intentos, 2);
    assert.equal(llamadas.toasts.length, 1);
  });

  test("cancelar la confirmación no reintenta ni cierra la hoja", async () => {
    const { dom, llamadas } = await montar({
      apiPostHistorico: async () => {
        throw new ApiError({ code: "CONFLICT", message: "Ese mes ya tiene movimientos." });
      },
    });
    dom.window.confirm = () => false;

    entrarA(dom, "historial");
    await esperar();
    $(dom, "btn-cargar-historico").click();
    await esperar();

    tipear($(dom, "historico-periodo"), "2026-10");
    cambiar(selectDe(lineas(dom)[0]), "1");
    tipear(importeDe(lineas(dom)[0]), "100000");

    enviar(dom, "form-historico");
    await esperar();

    assert.equal(llamadas.apiPost.length, 1, "no reintenta tras cancelar");
    assert.equal($(dom, "hoja-historico").classList.contains("abierta"), true);
    assert.equal(llamadas.toasts.length, 0);
  });
});
