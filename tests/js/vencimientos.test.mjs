/* Vencimientos · F13-T03
   Se corren con `npm test`.

   Lo que se prueba, según la política del proyecto: lo que decide **si
   una alerta aparece y cuántas**, y lo que se le manda al servidor al
   tocar un interruptor. Nada de esto se ve mirando la pantalla: una
   alerta que no salió no se nota, y un `PUT` que manda el día
   equivocado deja el vencimiento mal configurado en silencio.

   Cómo se ve cada tarjeta, el color y los márgenes se miran en el
   celular, como el resto de lo visual. */

import { test, describe, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..");
const CRLF = new RegExp(String.fromCharCode(13, 10), "g");

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

const HTML = `<!doctype html><html><body>
  <button id="btn-alertas"><span class="contador" id="contador-alertas" hidden></span></button>
  <div class="hoja-cuerpo" id="alertas-lista"></div>

  <article class="card shell" id="tarjeta-vencimientos" hidden>
    <div class="avisos" id="vencimientos-inicio"></div>
  </article>

  <div class="avisos" id="vencimientos-alertas"></div>
  <article class="card shell" data-interruptores-propios>
    <div class="view-switch" role="group" id="venc-filtro">
      <button type="button" class="activa" data-filtro="todos">Todos</button>
      <button type="button" data-filtro="activos">Con vencimiento</button>
    </div>
    <div class="venc-lista" id="venc-lista"></div>
  </article>

  <div id="toast" aria-live="polite"></div>
</body></html>`;

/** Lo que devuelve `GET /api/dues`, con la forma del contrato: el
 * estado y los días que faltan los decide el servidor. */
const ITEMS = [
  {
    category_id: 1,
    name: "Alquiler",
    enabled: true,
    due_day: 10,
    notice_days: 3,
    state: "soon",
    severity: "warn",
    days_left: 3,
    alert: true,
    paid: false,
    estimated: "530000.00",
  },
  {
    category_id: 2,
    name: "Luz",
    enabled: true,
    due_day: 8,
    notice_days: 3,
    state: "tomorrow",
    severity: "crit",
    days_left: 1,
    alert: true,
    paid: false,
    estimated: "43000.00",
  },
  {
    category_id: 3,
    name: "Prepaga",
    enabled: true,
    due_day: 5,
    notice_days: 2,
    state: "paid",
    severity: "ok",
    days_left: -2,
    alert: false,
    paid: true,
    estimated: "96000.00",
  },
  {
    category_id: 4,
    name: "Supermercado",
    enabled: false,
    due_day: 10,
    notice_days: 3,
    state: null,
    severity: null,
    days_left: null,
    alert: false,
    paid: false,
    estimated: "328000.00",
  },
];

function montar(hash = "#/vencimientos") {
  const dom = new JSDOM(HTML, {
    url: `https://epic-wallet-v2.vercel.app/${hash}`,
    pretendToBeVisual: true,
  });
  ventanas.push(dom.window);
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.CustomEvent = dom.window.CustomEvent;
  globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
  return dom;
}

async function cargarConDobles() {
  let codigo = readFileSync(resolve(RAIZ, "web", "src", "js", "vencimientos.js"), "utf8");
  codigo = codigo.replace(CRLF, String.fromCharCode(10));
  codigo = codigo
    .replace(
      'import { api } from "./api.js";',
      "const api = {\n" +
        "  get: (...a) => globalThis.__espia.apiGet(...a),\n" +
        "  put: (...a) => globalThis.__espia.apiPut(...a),\n" +
        "};",
    )
    .replace(
      'import { esc, fmt } from "./format.js";',
      `import { esc, fmt } from "${rutaAbsoluta("format.js")}";`,
    )
    .replace(
      'import { aviso, pildora } from "./components/avisos.js";',
      `import { aviso, pildora } from "${rutaAbsoluta("components", "avisos.js")}";`,
    )
    .replace(
      'import { bloqueCargando, error as estadoError } from "./components/estados.js";',
      `import { bloqueCargando, error as estadoError } from "${rutaAbsoluta("components", "estados.js")}";`,
    )
    .replace(
      'import { toast } from "./components/toast.js";',
      "const toast = (...a) => globalThis.__espia.toast(...a);",
    )
    // `dashboard.js` no se carga: lo único que se le importa es el
    // nombre del evento, y cargarlo entero arrastraría la API.
    .replace(
      'import { EVENTO_VENCIMIENTOS } from "./dashboard.js";',
      'const EVENTO_VENCIMIENTOS = "vencimientos:alertas";',
    )
    // Lo mismo con el nombre del evento de ruta: cargar `router.js`
    // arrastraría la sesión de Supabase.
    .replace(
      'import { EVENTO as EVENTO_RUTA } from "./router.js";',
      'const EVENTO_RUTA = "epic:ruta";',
    );

  const unico = `\n// ${Math.random()}\n`;
  const url = `data:text/javascript;base64,${Buffer.from(codigo + unico, "utf8").toString("base64")}`;
  return import(url);
}

const asentar = () => new Promise((r) => setTimeout(r, 0));

let puestos = [];
let avisados = [];

beforeEach(() => {
  puestos = [];
  avisados = [];
  globalThis.__espia = {
    apiGet: () => Promise.resolve(structuredClone(ITEMS)),
    apiPut: (ruta, cuerpo) => {
      puestos.push({ ruta, cuerpo });
      const id = Number(ruta.split("/").at(-1));
      const item = structuredClone(ITEMS.find((i) => i.category_id === id));
      // El servidor devuelve el ítem ya recalculado. Acá alcanza con
      // reflejar lo que se mandó: lo que importa es que el módulo pinte
      // la RESPUESTA y no lo que supuso.
      Object.assign(item, cuerpo);
      item.state = cuerpo.enabled ? item.state : null;
      item.alert = cuerpo.enabled ? item.alert : false;
      return Promise.resolve(item);
    },
    toast: (mensaje, opciones) => avisados.push({ mensaje, opciones }),
  };
});

describe("la lista de ítems", () => {
  test("en otra vista no pide nada, y al entrar a la sección sí", async () => {
    // Vencimientos no es la vista de arranque: pedir la lista en cada
    // carga de página sería una llamada de más, y en el login —sin
    // sesión— un error en la consola. Las alertas del tablero no
    // dependen de esto: vienen con el dashboard.
    const dom = montar("#/inicio");
    await cargarConDobles();
    await asentar();
    assert.equal(dom.window.document.querySelectorAll("#venc-lista [data-item]").length, 0);

    dom.window.document.dispatchEvent(
      new dom.window.CustomEvent("epic:ruta", { detail: { id: "vencimientos" } }),
    );
    await asentar();
    assert.equal(dom.window.document.querySelectorAll("#venc-lista [data-item]").length, 4);
  });

  test("abriendo la página directo en la sección, pide los ítems al arrancar", async () => {
    const dom = montar();
    await cargarConDobles();
    await asentar();

    const filas = dom.window.document.querySelectorAll("#venc-lista [data-item]");
    assert.equal(filas.length, 4);
  });

  test("un ítem prendido muestra su día y su aviso; uno apagado no", async () => {
    const dom = montar();
    await cargarConDobles();
    await asentar();
    const doc = dom.window.document;

    assert.ok(doc.querySelector('[data-item="1"] [data-dia="1"]'), "el prendido tiene día");
    assert.ok(doc.querySelector('[data-item="1"] [data-aviso="1"]'), "el prendido tiene aviso");
    assert.equal(
      doc.querySelector('[data-item="4"] [data-dia="4"]'),
      null,
      "el apagado no muestra la configuración",
    );
  });

  test("el día y el aviso que vienen del servidor quedan seleccionados", async () => {
    const dom = montar();
    await cargarConDobles();
    await asentar();
    const doc = dom.window.document;

    assert.equal(doc.querySelector('[data-dia="1"]').value, "10");
    assert.equal(doc.querySelector('[data-aviso="1"]').value, "3");
  });

  test("el filtro «con vencimiento» deja afuera los apagados", async () => {
    const dom = montar();
    await cargarConDobles();
    await asentar();
    const doc = dom.window.document;

    doc
      .querySelector('#venc-filtro [data-filtro="activos"]')
      .dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));

    const ids = [...doc.querySelectorAll("#venc-lista [data-item]")].map((e) => e.dataset.item);
    assert.deepEqual(ids, ["1", "2", "3"]);
  });

  test("si la API falla, la lista lo dice", async () => {
    globalThis.__espia.apiGet = () => Promise.reject(new Error("sin red"));
    const dom = montar();
    await cargarConDobles();
    await asentar();

    assert.match(dom.window.document.getElementById("venc-lista").textContent, /No se pudieron cargar/);
  });
});

describe("configurar un ítem", () => {
  test("el interruptor manda los tres campos, con el que cambió invertido", async () => {
    const dom = montar();
    await cargarConDobles();
    await asentar();

    dom.window.document
      .querySelector('[data-toggle="4"]')
      .dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await asentar();

    // Los tres juntos y no sólo `enabled`: el `PUT` reemplaza la
    // configuración entera, así que mandar uno solo borraría los otros
    // dos.
    assert.deepEqual(puestos, [
      { ruta: "/dues/4", cuerpo: { enabled: true, due_day: 10, notice_days: 3 } },
    ]);
  });

  test("cambiar el día manda el día nuevo y conserva el aviso", async () => {
    const dom = montar();
    await cargarConDobles();
    await asentar();

    const sel = dom.window.document.querySelector('[data-dia="1"]');
    sel.value = "25";
    sel.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    await asentar();

    assert.deepEqual(puestos.at(-1).cuerpo, { enabled: true, due_day: 25, notice_days: 3 });
  });

  test("cambiar el aviso manda el aviso nuevo y conserva el día", async () => {
    const dom = montar();
    await cargarConDobles();
    await asentar();

    const sel = dom.window.document.querySelector('[data-aviso="2"]');
    sel.value = "7";
    sel.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    await asentar();

    assert.deepEqual(puestos.at(-1).cuerpo, { enabled: true, due_day: 8, notice_days: 7 });
  });

  test("dos toques seguidos al mismo interruptor no mandan dos pedidos", async () => {
    // Sin esto, el segundo toque sale con el estado viejo y el
    // vencimiento termina al revés de lo que se ve en pantalla.
    let resolver;
    globalThis.__espia.apiPut = (ruta, cuerpo) => {
      puestos.push({ ruta, cuerpo });
      return new Promise((r) => {
        resolver = () => r({ ...ITEMS[3], ...cuerpo });
      });
    };

    const dom = montar();
    await cargarConDobles();
    await asentar();

    const boton = dom.window.document.querySelector('[data-toggle="4"]');
    boton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    boton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await asentar();

    assert.equal(puestos.length, 1);
    resolver?.();
  });

  test("si el guardado falla, avisa y no deja el interruptor mintiendo", async () => {
    globalThis.__espia.apiPut = () => Promise.reject(new Error("No se pudo guardar."));
    const dom = montar();
    await cargarConDobles();
    await asentar();

    dom.window.document
      .querySelector('[data-toggle="4"]')
      .dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await asentar();

    assert.equal(avisados.length, 1);
    assert.equal(avisados[0].opciones.severidad, "crit");
    // El ítem sigue apagado, como lo devolvió la última lectura buena.
    assert.equal(
      dom.window.document.querySelector('[data-toggle="4"]').getAttribute("aria-checked"),
      "false",
    );
  });
});

describe("las alertas", () => {
  test("arriba de la sección van sólo las que tienen alerta", async () => {
    const dom = montar();
    await cargarConDobles();
    await asentar();

    const caja = dom.window.document.getElementById("vencimientos-alertas");
    // Alquiler y Luz. Prepaga está pagada y Supermercado apagado: no
    // avisan. Es la regla que pidió Gustavo — lo que ya está cargado no
    // se cuenta.
    assert.equal(caja.querySelectorAll(".alert").length, 2);
    assert.match(caja.textContent, /Alquiler/);
    assert.match(caja.textContent, /Luz/);
    assert.ok(!caja.textContent.includes("Prepaga"));
  });

  test("el globo de la campanita cuenta las alertas, y con cero se esconde", async () => {
    const dom = montar();
    const modulo = await cargarConDobles();
    await asentar();
    const doc = dom.window.document;

    const contador = doc.getElementById("contador-alertas");
    assert.equal(contador.textContent, "2");
    assert.equal(contador.hidden, false);

    modulo.pintarAlertasGlobales([]);
    assert.equal(contador.hidden, true);
    assert.equal(doc.getElementById("tarjeta-vencimientos").hidden, true);
  });

  test("la tarjeta del tablero aparece sólo si hay algo por vencer", async () => {
    const dom = montar();
    const modulo = await cargarConDobles();
    await asentar();
    const doc = dom.window.document;

    assert.equal(doc.getElementById("tarjeta-vencimientos").hidden, false);
    assert.equal(doc.querySelectorAll("#vencimientos-inicio .alert").length, 2);
    assert.match(doc.getElementById("vencimientos-inicio").textContent, /Faltan 3 días/);
  });

  test("el evento del dashboard pinta las alertas sin pedir nada", async () => {
    const dom = montar();
    await cargarConDobles();
    await asentar();
    const doc = dom.window.document;

    doc.dispatchEvent(
      new dom.window.CustomEvent("vencimientos:alertas", {
        detail: [
          {
            category_id: 9,
            name: "Internet",
            state: "overdue",
            severity: "crit",
            days_left: -2,
            due_day: 20,
            estimated: "48000.00",
          },
        ],
      }),
    );

    assert.equal(doc.getElementById("contador-alertas").textContent, "1");
    assert.match(doc.getElementById("vencimientos-inicio").textContent, /Internet está vencido/);
    assert.match(doc.getElementById("vencimientos-inicio").textContent, /hace 2 días/);
  });

  test("la hoja de la campanita muestra lo mismo que el globo cuenta", async () => {
    // Si el globo dijera «2» y la hoja estuviera vacía, la campanita
    // sería una alarma sin contenido.
    const dom = montar();
    await cargarConDobles();
    await asentar();

    const hoja = dom.window.document.getElementById("alertas-lista");
    assert.equal(hoja.querySelectorAll(".alert").length, 2);
  });

  test("un vencimiento crítico y uno de atención no se pintan igual", async () => {
    const dom = montar();
    await cargarConDobles();
    await asentar();

    const clases = [...dom.window.document.querySelectorAll("#vencimientos-alertas .alert")].map(
      (e) => e.className,
    );
    assert.ok(clases.some((c) => c.includes("a-warn")), "el que falta 3 días va en atención");
    assert.ok(clases.some((c) => c.includes("a-crit")), "el que vence mañana va en crítico");
  });
});
