/* Pruebas del enrutador · F01-T07, guardia de rutas desde F02-T12
   Se corren con `npm test` (`node --test tests/js/*.test.mjs`).

   Por qué con jsdom y no leyendo el archivo como las demás pruebas de
   frontend: los cuatro criterios de aceptación de la tarea son de
   comportamiento —recargar en `#/inversiones`, volver con «atrás»,
   caer en inicio con una ruta inválida, no recargar la página— y una
   prueba que lea el código fuente no puede verificar ninguno. jsdom
   implementa el hash, el historial y `hashchange` de verdad; un doble
   hecho a mano verificaría el doble, no el navegador. */

import { test, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..");

const SECCIONES = [
  "inicio",
  "movimientos",
  "historial",
  "inversiones",
  "patrimonio",
  "analisis",
  "config",
];

/** Carga `router.js` con `haySesion()` doblada por `globalThis.__haySesion`.
 * El resto de sus importaciones (`nav.js`) son datos puros —ninguna
 * `const` global, ningún efecto de lado— así que se dejan reales, con
 * una ruta absoluta y su propio `?t=` para que el caché de módulos de
 * Node no devuelva una instancia compartida entre pruebas. Es el mismo
 * patrón que `conectarOjito` en `registro.test.mjs` y
 * `config-cuenta.test.mjs`: doblar sólo lo que hace falta doblar. */
async function cargarRouterConDobles() {
  let codigo = readFileSync(resolve(RAIZ, "web", "src", "js", "router.js"), "utf8");
  const navUrl =
    "file:///" +
    resolve(RAIZ, "web", "src", "js", "nav.js").replace(/\\/g, "/") +
    `?t=${Math.random()}`;
  codigo = codigo
    .replace(
      'import { SECCIONES, PUBLICAS, INICIO, LOGIN, esPublica, tituloDeRuta } from "./nav.js";',
      `import { SECCIONES, PUBLICAS, INICIO, LOGIN, esPublica, tituloDeRuta } from "${navUrl}";`,
    )
    .replace(
      'import { haySesion } from "./auth.js";',
      "const haySesion = async () => globalThis.__haySesion;",
    );

  const unico = `\n// ${Math.random()}\n`;
  const url = `data:text/javascript;base64,${Buffer.from(codigo + unico, "utf8").toString("base64")}`;
  return import(url);
}

/** Monta un DOM con las siete vistas y devuelve el enrutador cargado
 * en ese contexto. `hash` simula con qué URL se entró.
 *
 * `haySesion` por defecto en `true`: todas las pruebas de este bloque
 * son de cuando la aplicación ya funciona con una cuenta adentro, de
 * antes de que existiera la guardia de rutas (F02-T12). Las pruebas de
 * la guardia en sí ponen `haySesion` explícito, en los dos valores. */
async function montar(hash = "", { haySesion = true } = {}) {
  const vistas = SECCIONES.map(
    (id) => `<section class="view" data-vista="${id}" hidden></section>`,
  ).join("");

  const dom = new JSDOM(
    `<!doctype html><html><head><title>Epic Wallet</title></head>` +
      `<body><main>${vistas}</main></body></html>`,
    {
      url: `https://epic-wallet-v2.vercel.app/${hash}`,
      pretendToBeVisual: true,
    },
  );

  // jsdom no implementa el desplazamiento y avisa por consola en cada
  // llamada. La prueba que verifica el scroll lo reemplaza por el suyo.
  dom.window.scrollTo = () => {};

  // El enrutador es un módulo del navegador: usa `location`, `history`
  // y `document` globales. Se los damos del DOM de jsdom.
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.location = dom.window.location;
  globalThis.history = dom.window.history;
  globalThis.CustomEvent = dom.window.CustomEvent;
  globalThis.__haySesion = haySesion;

  const router = await cargarRouterConDobles();
  await router.arrancar();
  return { dom, router };
}

function activa(dom) {
  const el = dom.window.document.querySelector(".view:not([hidden])");
  return el ? el.dataset.vista : null;
}

/** Espera a que quede activa la vista `id`.
 *
 * Un solo tick NO alcanza: el recorrido del historial de jsdom es
 * asíncrono y tarda un número de ticks que no está garantizado. Con
 * `setTimeout(0)` las pruebas de «atrás» pasaban casi siempre y
 * fallaban una vez cada tres corridas. */
function esperarVista(dom, id, ms = 2000) {
  return new Promise((listo, falla) => {
    const limite = Date.now() + ms;
    const probar = () => {
      if (activa(dom) === id) return listo();
      if (Date.now() > limite) {
        return falla(
          new Error(`la vista nunca pasó a «${id}»; quedó en «${activa(dom)}»`),
        );
      }
      dom.window.setTimeout(probar, 5);
    };
    probar();
  });
}

/** Deja correr los eventos pendientes. Para cuando se verifica que algo
    NO pasa y no hay condición que esperar. */
function latir(dom, ms = 60) {
  return new Promise((listo) => dom.window.setTimeout(listo, ms));
}

describe("enrutador", () => {
  beforeEach(() => {
    for (const k of [
      "window",
      "document",
      "location",
      "history",
      "CustomEvent",
    ])
      delete globalThis[k];
  });

  test("sin hash abre inicio y corrige la URL", async () => {
    const { dom } = await montar("");
    assert.equal(activa(dom), "inicio");
    assert.equal(dom.window.location.hash, "#/inicio");
  });

  test("recargar en #/inversiones abre inversiones", async () => {
    // Criterio de aceptación de la tarea.
    const { dom } = await montar("#/inversiones");
    assert.equal(activa(dom), "inversiones");
  });

  test("cada una de las siete rutas abre su vista", async () => {
    for (const id of SECCIONES) {
      const { dom } = await montar(`#/${id}`);
      assert.equal(activa(dom), id, `#/${id} tenía que abrir ${id}`);
    }
  });

  test("una ruta inválida cae en inicio", async () => {
    // Criterio de aceptación.
    const { dom } = await montar("#/no-existe");
    assert.equal(activa(dom), "inicio");
    assert.equal(
      dom.window.location.hash,
      "#/inicio",
      "la URL también se corrige, no queda la ruta mala a la vista",
    );
  });

  test("la ruta inválida no queda en el historial", async () => {
    // Si se corrigiera asignando el hash en lugar de reemplazar,
    // «atrás» volvería a la ruta mala y de ahí otra vez a inicio: un
    // bucle del que no se sale.
    //
    // Se compara contra entrar por una ruta buena: las dos tienen que
    // dejar el historial del mismo largo.
    const bueno = await montar("#/inicio");
    const malo = await montar("#/no-existe");
    assert.equal(
      malo.dom.window.history.length,
      bueno.dom.window.history.length,
      "corregir una ruta inválida agregó una entrada al historial",
    );
  });

  test("navegar a una ruta inexistente no agrega entradas", async () => {
    // `navegar` valida antes de tocar el hash. Sin esa validación, el
    // hash pasaría por la ruta mala —dejando su entrada— y recién
    // después se corregiría a inicio.
    const { dom, router } = await montar("#/inicio");
    const largo = dom.window.history.length;
    router.navegar("no-existe");
    await esperarVista(dom, "inicio");
    assert.equal(activa(dom), "inicio");
    assert.equal(
      dom.window.history.length,
      largo,
      "la ruta mala dejó una entrada en el historial",
    );
  });

  test("volver a la vista activa no repite la animacion de entrada", async () => {
    // Tocar dos veces la misma posición de la barra no tiene que hacer
    // parpadear la pantalla.
    const { dom, router } = await montar("#/analisis");
    const vistos = [];
    dom.window.document.addEventListener(router.EVENTO, (ev) =>
      vistos.push(ev.detail.id),
    );
    router.navegar("analisis");
    router.navegar("analisis");
    await esperarVista(dom, "analisis");
    assert.deepEqual(
      vistos,
      [],
      "no tenía que volver a pintar la vista activa",
    );
  });

  test("solo una vista queda visible a la vez", async () => {
    const { dom, router } = await montar("#/inicio");
    router.navegar("analisis");
    await esperarVista(dom, "analisis");
    const visibles = dom.window.document.querySelectorAll(
      ".view:not([hidden])",
    );
    assert.equal(visibles.length, 1);
    assert.equal(visibles[0].dataset.vista, "analisis");
  });

  test("las vistas inactivas salen del arbol de accesibilidad", async () => {
    // Sin `hidden`, el lector lee las siete secciones seguidas y el
    // tabulador recorre los botones de las que no se ven.
    const { dom } = await montar("#/historial");
    const ocultas = [...dom.window.document.querySelectorAll(".view[hidden]")];
    assert.equal(ocultas.length, SECCIONES.length - 1);
  });

  test("navegar agrega una entrada al historial y atras vuelve", async () => {
    // Criterio de aceptación: «atrás» vuelve a la vista previa.
    const { dom, router } = await montar("#/inicio");
    router.navegar("movimientos");
    await esperarVista(dom, "movimientos");
    assert.equal(activa(dom), "movimientos");

    dom.window.history.back();
    await esperarVista(dom, "inicio");
    assert.equal(activa(dom), "inicio", "«atrás» tenía que volver a inicio");
  });

  test("atras y adelante recorren tres vistas", async () => {
    const { dom, router } = await montar("#/inicio");
    router.navegar("movimientos");
    await esperarVista(dom, "movimientos");
    router.navegar("config");
    await esperarVista(dom, "config");

    dom.window.history.back();
    await esperarVista(dom, "movimientos");

    dom.window.history.forward();
    await esperarVista(dom, "config");
  });

  test("navegar a la ruta actual no agrega entradas al historial", async () => {
    // Tocar dos veces la misma posición de la barra no tiene que
    // llenar el historial de repetidos.
    const { dom, router } = await montar("#/inicio");
    const largo = dom.window.history.length;
    router.navegar("inicio");
    router.navegar("inicio");
    await latir(dom);
    assert.equal(dom.window.history.length, largo);
  });

  test("navegar a una ruta que no existe cae en inicio", async () => {
    const { dom, router } = await montar("#/config");
    router.navegar("cualquier-cosa");
    await esperarVista(dom, "inicio");
    assert.equal(activa(dom), "inicio");
  });

  test("avisa del cambio de ruta una sola vez", async () => {
    // `hashchange` y `popstate` pueden llegar los dos por el mismo
    // cambio; si se emitiera dos veces, la animación de entrada se
    // vería doble y cada oyente haría su trabajo dos veces.
    const { dom, router } = await montar("#/inicio");
    const vistos = [];
    dom.window.document.addEventListener(router.EVENTO, (ev) =>
      vistos.push(ev.detail.id),
    );
    router.navegar("patrimonio");
    await esperarVista(dom, "patrimonio");
    assert.deepEqual(vistos, ["patrimonio"]);
  });

  test("el aviso lleva el id de la ruta", async () => {
    const { dom, router } = await montar("#/inicio");
    let recibido = null;
    dom.window.document.addEventListener(router.EVENTO, (ev) => {
      recibido = ev.detail.id;
    });
    router.navegar("analisis");
    await esperarVista(dom, "analisis");
    assert.equal(recibido, "analisis");
  });

  test("rutaActual devuelve null cuando el hash no sirve", async () => {
    const { dom, router } = await montar("#/inicio");
    dom.window.history.replaceState(null, "", "#/basura");
    assert.equal(router.rutaActual(), null);
  });

  test("el titulo de la pagina acompana a la vista", async () => {
    const { dom, router } = await montar("#/inicio");
    router.navegar("inversiones");
    await esperarVista(dom, "inversiones");
    assert.match(dom.window.document.title, /Cartera/);
  });

  test("al cambiar de vista se vuelve arriba", async () => {
    // Sin esto, entrar a una sección desde el final de una lista larga
    // la abre por la mitad.
    const { dom, router } = await montar("#/inicio");
    let pedido = null;
    dom.window.scrollTo = (arg) => {
      pedido = arg;
    };
    router.navegar("historial");
    await esperarVista(dom, "historial");
    assert.equal(pedido?.top, 0);
    assert.equal(
      pedido?.behavior,
      "instant",
      "suave, un desplazamiento de miles de píxeles parece que la app se colgó",
    );
  });

  test("la navegacion no recarga la pagina", async () => {
    // Criterio de aceptación. Una recarga perdería el estado en memoria
    // y volvería a pedir todo a la API.
    const { dom, router } = await montar("#/inicio");
    let recargo = false;
    dom.window.addEventListener("beforeunload", () => {
      recargo = true;
    });
    router.navegar("movimientos");
    await esperarVista(dom, "movimientos");
    assert.equal(recargo, false);
  });

  test("las rutas del enrutador son las siete de nav.js", async () => {
    // Si se agregara una sección a nav.js y no al enrutador, su
    // posición en la barra llevaría a inicio sin que nada avise.
    //
    // Se lee sólo el bloque de `SECCIONES`: desde F02-T09 `nav.js`
    // tiene también `PUBLICAS`, con las pantallas de cuenta. Son rutas
    // de verdad —el enrutador las conoce— pero no secciones, y no
    // tienen una posición en ninguna barra.
    const nav = readFileSync(
      resolve(RAIZ, "web", "src", "js", "nav.js"),
      "utf8",
    );
    const bloque = nav.split("export const SECCIONES")[1].split("\n];")[0];
    const ids = [...bloque.matchAll(/id:\s*"([\w-]+)"/g)].map((m) => m[1]);
    assert.deepEqual(ids, SECCIONES);

    for (const id of ids) {
      const { dom } = await montar(`#/${id}`);
      assert.equal(activa(dom), id);
    }
  });
});

/* ===================================================================
   Las pantallas de cuenta dentro de `#acceso` · F02-T10

   `login` y `registro` comparten el mismo `#acceso`: no son dos
   pantallas que el enrutador prenda y apague enteras, son dos
   tarjetas `[data-cuenta]` adentro de una, igual que las siete
   `.view` adentro de `.app`. Lo que hay que probar es que el
   enrutador elige la tarjeta correcta y nunca deja las dos visibles
   ni las dos ocultas. */

/** `haySesion` por defecto en `false`: este bloque prueba sobre todo
 * las pantallas de cuenta, que son las que ve alguien sin sesión. La
 * única prueba que necesita estar adentro con la aplicación pasa
 * `haySesion: true` explícito. */
async function montarConAcceso(hash = "#/login", { haySesion = false } = {}) {
  const vistas = SECCIONES.map(
    (id) => `<section class="view" data-vista="${id}" hidden></section>`,
  ).join("");

  const dom = new JSDOM(
    `<!doctype html><html><head><title>Epic Wallet</title></head>` +
      `<body>` +
      `<div class="app"><main>${vistas}</main></div>` +
      `<div class="acceso" id="acceso" hidden>` +
      `<div class="acceso-card" data-cuenta="login"></div>` +
      `<div class="acceso-card" data-cuenta="registro" hidden></div>` +
      `</div>` +
      `</body></html>`,
    { url: `https://epic-wallet-v2.vercel.app/${hash}`, pretendToBeVisual: true },
  );
  dom.window.scrollTo = () => {};

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.location = dom.window.location;
  globalThis.history = dom.window.history;
  globalThis.CustomEvent = dom.window.CustomEvent;
  globalThis.__haySesion = haySesion;

  const router = await cargarRouterConDobles();
  await router.arrancar();
  return { dom, router };
}

function tarjetaVisible(dom) {
  const el = dom.window.document.querySelector(
    "#acceso .acceso-card[data-cuenta]:not([hidden])",
  );
  return el ? el.dataset.cuenta : null;
}

/** Igual que `esperarVista`, pero para una tarjeta de `#acceso`: ésa
 * no es una `.view` y `activa()` nunca la encontraría. */
function esperarTarjeta(dom, cuenta, ms = 2000) {
  return new Promise((listo, falla) => {
    const limite = Date.now() + ms;
    const probar = () => {
      if (tarjetaVisible(dom) === cuenta) return listo();
      if (Date.now() > limite) {
        return falla(
          new Error(`la tarjeta nunca pasó a «${cuenta}»; quedó en «${tarjetaVisible(dom)}»`),
        );
      }
      dom.window.setTimeout(probar, 5);
    };
    probar();
  });
}

describe("pantallas de cuenta dentro de #acceso", () => {
  beforeEach(() => {
    for (const k of [
      "window",
      "document",
      "location",
      "history",
      "CustomEvent",
    ])
      delete globalThis[k];
  });

  test("en #/login se ve la tarjeta de login y no la de registro", async () => {
    const { dom } = await montarConAcceso("#/login");
    assert.equal(tarjetaVisible(dom), "login");
  });

  test("en #/registro se ve la tarjeta de registro y no la de login", async () => {
    const { dom } = await montarConAcceso("#/registro");
    assert.equal(tarjetaVisible(dom), "registro");
  });

  test("ir de login a registro oculta una y muestra la otra, nunca las dos", async () => {
    const { dom, router } = await montarConAcceso("#/login");
    assert.equal(tarjetaVisible(dom), "login");

    router.navegar("registro");
    await esperarTarjeta(dom, "registro");

    const ocultas = dom.window.document.querySelectorAll(
      "#acceso .acceso-card[data-cuenta][hidden]",
    );
    assert.equal(ocultas.length, 1, "tiene que quedar exactamente una oculta");
    assert.equal(ocultas[0].dataset.cuenta, "login");
  });

  test("#acceso queda oculto y .app deja de ser inert en una ruta de la aplicación", async () => {
    const { dom, router } = await montarConAcceso("#/login");
    const acceso = () => dom.window.document.getElementById("acceso");
    const app = () => dom.window.document.querySelector(".app");

    assert.equal(acceso().hidden, false);
    assert.equal(app().inert, true);

    // Simula que mientras tanto se inició sesión —como pasaría de
    // verdad después de un login— antes de ir a una vista privada. Sin
    // esto la guardia (F02-T12) devolvería la navegación a login en
    // cuanto el `hashchange` la revisara, y la prueba no vería lo que
    // dice probar.
    globalThis.__haySesion = true;
    router.navegar("inicio");
    await esperarVista(dom, "inicio");
    assert.equal(acceso().hidden, true);
    assert.equal(app().inert, false);
  });
});

/* ===================================================================
   Guardia de rutas · F02-T12

   Se prueba sobre el `montar()` principal —el de las siete vistas—,
   sin el DOM de `#acceso`: alcanza con mirar qué `.view` queda activa
   (o ninguna) y a qué hash se corrigió la URL. `pintar()` ya tolera
   que `#acceso`/`.app` no existan (`if (acceso && app)`), así que una
   redirección a "login" en este DOM se ve como "ninguna vista activa,
   hash en #/login" — no hace falta reconstruir la tarjeta de login
   para comprobar hacia dónde la guardia decidió ir. */

describe("guardia de rutas", () => {
  beforeEach(() => {
    for (const k of ["window", "document", "location", "history", "CustomEvent"])
      delete globalThis[k];
  });

  test("una ruta privada sin sesión manda a login", async () => {
    const { dom } = await montar("#/inversiones", { haySesion: false });
    assert.equal(activa(dom), null, "quedó una vista de la aplicación activa sin sesión");
    assert.equal(dom.window.location.hash, "#/login");
  });

  test("con sesión, la misma ruta privada se abre normalmente", async () => {
    const { dom } = await montar("#/inversiones", { haySesion: true });
    assert.equal(activa(dom), "inversiones");
    assert.equal(dom.window.location.hash, "#/inversiones");
  });

  test("login con sesión ya puesta manda al dashboard", async () => {
    const { dom } = await montar("#/login", { haySesion: true });
    assert.equal(activa(dom), "inicio");
    assert.equal(dom.window.location.hash, "#/inicio");
  });

  test("login sin sesión se queda en login", async () => {
    const { dom } = await montar("#/login", { haySesion: false });
    assert.equal(activa(dom), null);
    assert.equal(dom.window.location.hash, "#/login");
  });

  test("una ruta inválida sin sesión cae en login, no en inicio", async () => {
    // Antes de la guardia, cualquier ruta que no existiera caía en
    // inicio. Sin sesión, inicio tampoco es alcanzable: tiene que caer
    // un paso más allá, en login, y no quedarse a mitad de camino.
    const { dom } = await montar("#/esto-no-existe", { haySesion: false });
    assert.equal(activa(dom), null);
    assert.equal(dom.window.location.hash, "#/login");
  });

  test("la redirección no deja la ruta corregida en el historial", async () => {
    // Mismo criterio que la corrección de ruta inválida: "atrás" no
    // puede volver a un lugar al que la guardia ya decidió que no se
    // podía entrar.
    const { dom } = await montar("#/historial", { haySesion: false });
    assert.equal(dom.window.history.length, 1, "la redirección agregó una entrada al historial");
  });

  test("navegar a una ruta privada sin sesión mientras se usa la app también redirige", async () => {
    // No sólo la primera pintada: cualquier cambio de hash pasa por la
    // misma guardia, incluida una sesión que se cerró a mitad de uso.
    const { dom, router } = await montar("#/inicio", { haySesion: true });
    assert.equal(activa(dom), "inicio");

    globalThis.__haySesion = false;
    router.navegar("analisis");
    // `esperarVista` espera que una `.view` se active; acá se espera
    // lo contrario —que la guardia redirija y ninguna quede activa—,
    // así que se sondea el hash a mano en vez de reusarla.
    await new Promise((listo, falla) => {
      const limite = Date.now() + 2000;
      const probar = () => {
        if (dom.window.location.hash === "#/login") return listo();
        if (Date.now() > limite) return falla(new Error("nunca redirigió a login"));
        dom.window.setTimeout(probar, 5);
      };
      probar();
    });
    assert.equal(activa(dom), null);
  });

  test("después de cerrar sesión, «atrás» no vuelve a mostrar la vista privada", async () => {
    // Criterio de aceptación de F02-T12: "al cerrar sesión no queda
    // nada del usuario anterior, ni volviendo atrás". Cerrar sesión
    // deja la sesión en falso y navega a login (lo que hace
    // `cerrarSesion()` de api.js); "atrás" vuelve al hash privado de
    // antes, pero esa vuelta dispara la misma guardia y la manda de
    // nuevo a login, nunca a mostrar la vista.
    const { dom, router } = await montar("#/patrimonio", { haySesion: true });
    assert.equal(activa(dom), "patrimonio");

    // Cerrar sesión: sesión en falso y navegar a login (igual que
    // `cerrarSesion()`, sin importar los dobles de auth.js que usa esa
    // función en api.test.mjs).
    globalThis.__haySesion = false;
    router.navegar("login");
    await new Promise((listo) => dom.window.setTimeout(listo, 20));
    assert.equal(dom.window.location.hash, "#/login");

    dom.window.history.back();
    await new Promise((listo, falla) => {
      const limite = Date.now() + 2000;
      const probar = () => {
        // Vuelve a "patrimonio" en el historial, pero la guardia lo
        // intercepta: nunca llega a pintarse.
        if (dom.window.location.hash === "#/login" && activa(dom) !== "patrimonio") return listo();
        if (Date.now() > limite) return falla(new Error("«atrás» mostró la vista privada"));
        dom.window.setTimeout(probar, 5);
      };
      probar();
    });
    assert.notEqual(activa(dom), "patrimonio");
  });
});
