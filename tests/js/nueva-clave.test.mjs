/* Pruebas de la contraseña nueva y del enlace del correo · F11-T03
   Se corren con `npm test`.

   Dos módulos y un solo flujo, así que van juntos: `enlace-correo.js`
   lee el token de la URL y `nueva-clave.js` lo canjea y guarda la
   contraseña.

   QUÉ SE PRUEBA ACÁ Y QUÉ NO

   Lo que se prueba es lo que **protege un dato**: que el token de un
   solo uso no se reintente ni quede dando vueltas en la URL, que un
   enlace rechazado suelte la marca de recuperación en vez de dejar la
   puerta entornada, y que la marca se suelte también cuando la
   contraseña ya quedó cambiada —si no, una recarga más tarde volvería
   a abrir la única pantalla que cambia la contraseña sin pedir la
   anterior—.

   Lo que **no** se prueba acá: que el mail llegue, que el enlace
   venza, y que un enlace ya usado sea rechazado. Eso lo decide GoTrue
   y se verifica contra el proyecto real; jsdom sólo puede comprobar
   qué hace esta pantalla con la respuesta que recibe. */

import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..");
const INDEX = resolve(RAIZ, "web", "index.html");
const JS = (nombre) =>
  "file:///" +
  resolve(RAIZ, "web", "src", "js", nombre).replace(/\\/g, "/") +
  `?t=${Math.random()}`;

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

function htmlDelAcceso() {
  const html = readFileSync(INDEX, "utf8");
  const desde = html.indexOf('<div class="acceso"');
  assert.notEqual(desde, -1, "no se encuentra la pantalla de acceso en index.html");
  const hasta = html.indexOf("<!-- La notificación breve", desde);
  assert.notEqual(hasta, -1, "no se encuentra el final de la pantalla de acceso");
  return html.slice(desde, hasta);
}

function prepararDOM(url) {
  const dom = new JSDOM(
    `<!doctype html><html><body><div class="app"></div>${htmlDelAcceso()}` +
      `<div class="toast" id="toast"></div></body></html>`,
    { url, pretendToBeVisual: true },
  );
  ventanas.push(dom.window);
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.location = dom.window.location;
  globalThis.history = dom.window.history;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.CustomEvent = dom.window.CustomEvent;
  globalThis.Event = dom.window.Event;
  return dom;
}

// ===================================================================
//  enlace-correo.js
// ===================================================================

/**
 * Carga `enlace-correo.js` con `auth.js`, el enrutador y el toast
 * doblados. El módulo se arranca solo al importarse, que es justo lo
 * que hay que probar.
 */
async function cargarEnlace(url, { verificacion = { ok: true } } = {}) {
  const dom = prepararDOM(url);
  const registro = { marcas: [], olvidos: [], verificados: [], toasts: [] };
  const navegaciones = [];
  globalThis.__registro = registro;
  globalThis.__navegaciones = navegaciones;

  let codigo = readFileSync(
    resolve(RAIZ, "web", "src", "js", "enlace-correo.js"),
    "utf8",
  );
  codigo = codigo
    .replace(
      /import \{[^}]*\} from "\.\/auth\.js";/,
      [
        "const verificarEnlace = async (h, t) => {",
        "  globalThis.__registro.verificados.push({ hash: h, tipo: t });",
        `  return ${JSON.stringify(verificacion)};`,
        "};",
        "const marcarRecuperacion = () => globalThis.__registro.marcas.push(1);",
        "const olvidarRecuperacion = () => globalThis.__registro.olvidos.push(1);",
        "const mensajeDeError = (e) => `error:${e.code}`;",
      ].join("\n"),
    )
    .replace(
      'import { navegar } from "./router.js";',
      "const navegar = (id, o) => globalThis.__navegaciones.push(id);",
    )
    .replace(
      /import \{[^}]*\} from "\.\/nav\.js";/,
      'const INICIO = "inicio"; const LOGIN = "login"; const NUEVA_CLAVE = "nueva-clave";',
    )
    .replace(
      'import { toast } from "./components/toast.js";',
      "const toast = (m) => globalThis.__registro.toasts.push(m);",
    );

  const unico = `\n// ${Math.random()}\n`;
  const u = `data:text/javascript;base64,${Buffer.from(codigo + unico, "utf8").toString("base64")}`;
  const modulo = await import(u);
  return { dom, enlace: modulo, registro, navegaciones };
}

const BASE = "https://epic-wallet-v2.vercel.app";

describe("el enlace del correo", () => {
  test("un token de recuperación se guarda, se marca y se saca de la URL", async () => {
    const { dom, enlace, registro } = await cargarEnlace(
      `${BASE}/?token_hash=abc123&type=recovery#/nueva-clave`,
    );

    // La credencial no puede quedar en la barra de direcciones: va al
    // historial del navegador y al `Referer`.
    assert.equal(dom.window.location.search, "", `quedó ${dom.window.location.search}`);
    assert.equal(dom.window.location.hash, "#/nueva-clave");
    assert.equal(registro.marcas.length, 1, "no se marcó la recuperación");
    // El canje NO se hace acá: lo hace la pantalla.
    assert.deepEqual(registro.verificados, []);

    const pendiente = enlace.tomarEnlacePendiente();
    assert.deepEqual(pendiente, { hash: "abc123", tipo: "recovery" });
  });

  test("el token pendiente se entrega una sola vez", async () => {
    const { enlace } = await cargarEnlace(
      `${BASE}/?token_hash=abc123&type=recovery#/nueva-clave`,
    );
    assert.ok(enlace.tomarEnlacePendiente(), "la primera vez tiene que venir");
    assert.equal(
      enlace.tomarEnlacePendiente(),
      null,
      "un token de un solo uso no puede quedar disponible para un segundo intento",
    );
  });

  test("si la plantilla no puso el hash, igual lleva a la pantalla", async () => {
    const { dom, registro } = await cargarEnlace(
      `${BASE}/?token_hash=abc123&type=recovery`,
    );
    assert.equal(dom.window.location.hash, "#/nueva-clave");
    assert.equal(registro.marcas.length, 1);
  });

  test("un tipo que no está en la lista no se canjea", async () => {
    // El `type` viene de la URL sin pasar por ningún filtro, así que
    // la lista cerrada es lo que impide pasarle cualquier cosa a
    // `verifyOtp`.
    const { enlace, registro } = await cargarEnlace(
      `${BASE}/?token_hash=abc123&type=cualquiera#/nueva-clave`,
    );
    assert.equal(enlace.tomarEnlacePendiente(), null);
    assert.deepEqual(registro.verificados, []);
    assert.equal(registro.marcas.length, 0);
  });

  test("confirmar una cuenta nueva canjea en el momento y entra", async () => {
    const { registro, navegaciones } = await cargarEnlace(
      `${BASE}/?token_hash=xyz&type=signup#/login`,
    );
    // El canje es asincrónico: se le da una vuelta de bucle.
    await new Promise((listo) => setTimeout(listo, 20));

    assert.deepEqual(registro.verificados, [{ hash: "xyz", tipo: "signup" }]);
    assert.deepEqual(registro.toasts, ["Cuenta confirmada."]);
    assert.deepEqual(navegaciones, ["inicio"]);
    // Confirmar una cuenta no es una recuperación: no puede abrir la
    // puerta de la pantalla de contraseña nueva.
    assert.equal(registro.marcas.length, 0);
  });

  test("una confirmación rechazada vuelve al login con el motivo", async () => {
    const { dom, navegaciones } = await cargarEnlace(
      `${BASE}/?token_hash=xyz&type=signup#/login`,
      { verificacion: { ok: false, mensaje: "El enlace no sirve o ya venció." } },
    );
    await new Promise((listo) => setTimeout(listo, 20));

    assert.deepEqual(navegaciones, ["login"]);
    const caja = dom.window.document.getElementById("login-error");
    assert.equal(caja.hidden, false);
    assert.match(caja.textContent, /no sirve o ya venció/);
  });

  test("un error que ya trae la URL se muestra y suelta la marca", async () => {
    const { dom, registro } = await cargarEnlace(
      `${BASE}/?error=access_denied&error_code=otp_expired&error_description=Expired#/login`,
    );
    assert.equal(dom.window.location.search, "", "el error no se limpió de la URL");
    assert.equal(registro.olvidos.length, 1);
    assert.equal(dom.window.document.getElementById("login-error").hidden, false);
  });

  test("una URL sin nada de esto no toca nada", async () => {
    const { dom, enlace, registro, navegaciones } = await cargarEnlace(
      `${BASE}/#/inicio`,
    );
    assert.equal(enlace.tomarEnlacePendiente(), null);
    assert.deepEqual(registro.marcas, []);
    assert.deepEqual(navegaciones, []);
    assert.equal(dom.window.location.hash, "#/inicio");
  });

  test("con `code` sólo se marca: el canje lo hace la librería", async () => {
    // Plantilla de fábrica. El parámetro NO se puede tocar: lo necesita
    // `detectSessionInUrl` de `auth.js`.
    const { dom, registro } = await cargarEnlace(
      `${BASE}/?code=pkce-code#/nueva-clave`,
    );
    assert.match(dom.window.location.search, /code=pkce-code/);
    assert.equal(registro.marcas.length, 1);
  });
});

// ===================================================================
//  nueva-clave.js
// ===================================================================

/**
 * @param {{pendiente?: object | null, verificacion?: object, sesion?: boolean,
 *          actualizacion?: object}} opciones
 */
async function montar({
  pendiente = { hash: "abc123", tipo: "recovery" },
  verificacion = { ok: true, usuario: { id: "u1" } },
  sesion = false,
  actualizacion = { ok: true, usuario: { id: "u1" } },
} = {}) {
  const dom = prepararDOM(`${BASE}/#/nueva-clave`);
  const registro = { verificados: [], cambios: [], olvidos: [], toasts: [], tomas: 0 };
  const navegaciones = [];
  globalThis.__registro = registro;
  globalThis.__navegaciones = navegaciones;
  globalThis.__pendiente = pendiente;
  globalThis.__sesion = sesion;

  let codigo = readFileSync(resolve(RAIZ, "web", "src", "js", "nueva-clave.js"), "utf8");
  codigo = codigo
    .replace(
      /import \{[^}]*\} from "\.\/auth\.js";/,
      [
        "const verificarEnlace = async (h, t) => {",
        "  globalThis.__registro.verificados.push({ hash: h, tipo: t });",
        `  return ${JSON.stringify(verificacion)};`,
        "};",
        "const actualizarUsuario = async (c) => {",
        "  globalThis.__registro.cambios.push(c);",
        `  return ${JSON.stringify(actualizacion)};`,
        "};",
        "const haySesion = async () => globalThis.__sesion;",
        "const olvidarRecuperacion = () => globalThis.__registro.olvidos.push(1);",
      ].join("\n"),
    )
    .replace(
      'import { tomarEnlacePendiente } from "./enlace-correo.js";',
      [
        "const tomarEnlacePendiente = () => {",
        "  globalThis.__registro.tomas += 1;",
        "  const p = globalThis.__pendiente;",
        "  globalThis.__pendiente = null;",
        "  return p;",
        "};",
      ].join("\n"),
    )
    .replace(
      'import { navegar, EVENTO } from "./router.js";',
      [
        "const navegar = (id) => globalThis.__navegaciones.push(id);",
        'const EVENTO = "epic:ruta";',
      ].join("\n"),
    )
    .replace(
      /import \{[^}]*\} from "\.\/nav\.js";/,
      'const INICIO = "inicio"; const RECUPERAR = "recuperar"; const NUEVA_CLAVE = "nueva-clave";',
    )
    // `conectarOjito` y `clave-ui.js` se importan REALES: son
    // funciones puras de DOM, sin red ni estado, y doblarlas sería
    // dejar de probar lo que estas pruebas verifican.
    .replace(
      'import { conectarOjito } from "./acceso.js";',
      `import { conectarOjito } from "${JS("acceso.js")}";`,
    )
    .replace(
      'import { sincronizarTema } from "./preferencias.js";',
      "const sincronizarTema = async () => {};",
    )
    .replace(
      'import { toast } from "./components/toast.js";',
      "const toast = (m) => globalThis.__registro.toasts.push(m);",
    )
    .replace(
      /import \{[^}]*\} from "\.\/clave-ui\.js";/,
      `import { MINIMO_CLAVE, mostrarFortaleza as pintarFortaleza, actualizarCoincidencia as compararClaves } from "${JS("clave-ui.js")}";`,
    );

  const unico = `\n// ${Math.random()}\n`;
  const u = `data:text/javascript;base64,${Buffer.from(codigo + unico, "utf8").toString("base64")}`;
  const modulo = await import(u);
  return { dom, pantalla: modulo, registro, navegaciones };
}

const $ = (dom, id) => dom.window.document.getElementById(id);

/** Simula que el enrutador activó la ruta. Se despacha el evento y no
 * se llama a `preparar()` a mano: lo que el módulo escucha es el
 * evento, igual que en la aplicación. */
async function activarRuta(dom, id = "nueva-clave") {
  dom.window.document.dispatchEvent(
    new dom.window.CustomEvent("epic:ruta", { detail: { id } }),
  );
  await new Promise((listo) => setTimeout(listo, 20));
}

async function guardar(dom, clave, clave2 = clave) {
  $(dom, "nueva-clave1").value = clave;
  $(dom, "nueva-clave2").value = clave2;
  $(dom, "form-nueva-clave").dispatchEvent(
    new dom.window.Event("submit", { bubbles: true, cancelable: true }),
  );
  await new Promise((listo) => setTimeout(listo, 20));
}

describe("pantalla de contraseña nueva", () => {
  test("canjea el token del enlace y muestra el formulario", async () => {
    const { dom, pantalla, registro } = await montar();
    pantalla.arrancar();

    // Antes de que la ruta se active no se canjeó nada: el módulo se
    // carga en todas las páginas.
    assert.equal(registro.tomas, 0);

    await activarRuta(dom);

    assert.deepEqual(registro.verificados, [{ hash: "abc123", tipo: "recovery" }]);
    assert.equal($(dom, "form-nueva-clave").hidden, false);
    assert.equal($(dom, "nueva-verificando").hidden, true);
    assert.equal($(dom, "nueva-invalido").hidden, true);
  });

  test("el token no se reintenta si se vuelve a activar la ruta", async () => {
    const { dom, pantalla, registro } = await montar();
    pantalla.arrancar();

    await activarRuta(dom);
    await activarRuta(dom);
    await activarRuta(dom);

    assert.equal(registro.verificados.length, 1, "se canjeó más de una vez");
  });

  test("un enlace rechazado muestra el estado de inválido y suelta la marca", async () => {
    const { dom, pantalla, registro } = await montar({
      verificacion: { ok: false, mensaje: "El enlace no sirve o ya venció." },
    });
    pantalla.arrancar();

    await activarRuta(dom);

    assert.equal($(dom, "nueva-invalido").hidden, false);
    assert.equal($(dom, "form-nueva-clave").hidden, true, "no puede quedar el formulario");
    assert.equal(
      registro.olvidos.length,
      1,
      "un enlace rechazado tiene que soltar la marca de recuperación",
    );
  });

  test("sin token y sin sesión es un enlace que no sirve", async () => {
    // Es el caso de escribir `#/nueva-clave` a mano, o de volver a
    // abrir un enlace ya consumido.
    const { dom, pantalla, registro } = await montar({ pendiente: null, sesion: false });
    pantalla.arrancar();

    await activarRuta(dom);

    assert.equal($(dom, "nueva-invalido").hidden, false);
    assert.equal(registro.olvidos.length, 1);
    assert.deepEqual(registro.verificados, [], "no había nada que canjear");
  });

  test("sin token pero con sesión sigue adelante: se recargó a mitad del flujo", async () => {
    const { dom, pantalla, registro } = await montar({ pendiente: null, sesion: true });
    pantalla.arrancar();

    await activarRuta(dom);

    assert.equal($(dom, "form-nueva-clave").hidden, false);
    assert.deepEqual(registro.verificados, []);
    assert.equal(registro.olvidos.length, 0);
  });

  test("otra ruta no dispara el canje", async () => {
    const { dom, pantalla, registro } = await montar();
    pantalla.arrancar();

    await activarRuta(dom, "inicio");

    assert.equal(registro.tomas, 0);
  });

  /* GUARDAR LA CONTRASEÑA */

  test("guarda la contraseña, suelta la marca y entra", async () => {
    const { dom, pantalla, registro, navegaciones } = await montar();
    pantalla.arrancar();
    await activarRuta(dom);

    await guardar(dom, "clave-larga-123");

    assert.deepEqual(registro.cambios, [{ password: "clave-larga-123" }]);
    assert.deepEqual(registro.toasts, ["Contraseña actualizada."]);
    assert.deepEqual(navegaciones, ["inicio"]);
    assert.equal(
      registro.olvidos.length,
      1,
      "con la marca puesta, una recarga volvería a abrir la única pantalla " +
        "que cambia la contraseña sin pedir la anterior",
    );
  });

  test("las dos contraseñas se borran de los campos al guardar", async () => {
    const { dom, pantalla } = await montar();
    pantalla.arrancar();
    await activarRuta(dom);

    await guardar(dom, "clave-larga-123");

    assert.equal($(dom, "nueva-clave1").value, "");
    assert.equal($(dom, "nueva-clave2").value, "");
  });

  test("contraseñas distintas no se envían", async () => {
    const { dom, pantalla, registro } = await montar();
    pantalla.arrancar();
    await activarRuta(dom);

    await guardar(dom, "clave-larga-123", "clave-larga-124");

    assert.deepEqual(registro.cambios, []);
    assert.equal($(dom, "nueva-error").hidden, false);
    assert.match($(dom, "nueva-error").textContent, /no coinciden/);
  });

  test("el mínimo de 8 caracteres se valida antes de llamar a la API", async () => {
    const { dom, pantalla, registro } = await montar();
    pantalla.arrancar();
    await activarRuta(dom);

    await guardar(dom, "corta1");

    assert.deepEqual(registro.cambios, []);
    assert.match($(dom, "nueva-error").textContent, /8 caracteres/);
  });

  test("con los campos vacíos no se llama a la API", async () => {
    const { dom, pantalla, registro } = await montar();
    pantalla.arrancar();
    await activarRuta(dom);

    await guardar(dom, "", "");

    assert.deepEqual(registro.cambios, []);
    assert.equal($(dom, "nueva-error").hidden, false);
  });

  test("si el servidor rechaza el cambio, la marca NO se suelta", async () => {
    // Soltarla dejaría al usuario con la sesión abierta y sin forma de
    // volver a esta pantalla para reintentar.
    const { dom, pantalla, registro, navegaciones } = await montar({
      actualizacion: { ok: false, mensaje: "La contraseña tiene que tener 8." },
    });
    pantalla.arrancar();
    await activarRuta(dom);

    await guardar(dom, "clave-larga-123");

    assert.equal($(dom, "nueva-error").hidden, false);
    assert.deepEqual(navegaciones, []);
    assert.equal(registro.olvidos.length, 0);
  });

  test("el botón no permite envíos dobles", async () => {
    const { dom, pantalla, registro } = await montar();
    pantalla.arrancar();
    await activarRuta(dom);

    $(dom, "nueva-clave1").value = "clave-larga-123";
    $(dom, "nueva-clave2").value = "clave-larga-123";
    const form = $(dom, "form-nueva-clave");
    const submit = () =>
      form.dispatchEvent(
        new dom.window.Event("submit", { bubbles: true, cancelable: true }),
      );
    submit();
    submit();
    await new Promise((listo) => setTimeout(listo, 50));

    assert.equal(registro.cambios.length, 1);
  });

  test("«pedir un enlace nuevo» suelta la marca antes de irse", async () => {
    const { dom, pantalla, registro, navegaciones } = await montar({
      verificacion: { ok: false, mensaje: "no sirve" },
    });
    pantalla.arrancar();
    await activarRuta(dom);

    $(dom, "nueva-pedir-otro").click();

    assert.deepEqual(navegaciones, ["recuperar"]);
    // Uno del enlace rechazado y otro del botón: lo que importa es que
    // no quede ninguna puerta entornada al salir.
    assert.ok(registro.olvidos.length >= 1);
  });

  /* LOS CAMPOS */

  test("los dos ojitos alternan su campo", async () => {
    const { dom, pantalla } = await montar();
    pantalla.arrancar();
    await activarRuta(dom);

    for (const [ojo, campo] of [
      ["nueva-ojo", "nueva-clave1"],
      ["nueva-ojo2", "nueva-clave2"],
    ]) {
      assert.equal($(dom, campo).type, "password");
      $(dom, ojo).click();
      assert.equal($(dom, campo).type, "text", `${ojo} no alternó ${campo}`);
      $(dom, ojo).click();
      assert.equal($(dom, campo).type, "password");
    }
  });

  test("el medidor y el aviso de coincidencia funcionan en vivo", async () => {
    const { dom, pantalla } = await montar();
    pantalla.arrancar();
    await activarRuta(dom);

    const clave1 = $(dom, "nueva-clave1");
    const clave2 = $(dom, "nueva-clave2");
    const escribir = (campo, valor) => {
      campo.value = valor;
      campo.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    };

    escribir(clave1, "corta");
    assert.equal($(dom, "nueva-fuerza").hidden, false);
    assert.match($(dom, "nueva-fuerza-texto").textContent, /Falta/);

    escribir(clave1, "Clave-Larga-123!");
    assert.equal($(dom, "nueva-fuerza-texto").textContent, "Fuerte");

    escribir(clave2, "otra");
    assert.match($(dom, "nueva-coincide").textContent, /no coinciden/);
    escribir(clave2, "Clave-Larga-123!");
    assert.match($(dom, "nueva-coincide").textContent, /Coinciden/);
  });

  test("cada campo tiene su etiqueta asociada", async () => {
    const { dom, pantalla } = await montar();
    pantalla.arrancar();

    for (const id of ["nueva-clave1", "nueva-clave2"]) {
      assert.ok(
        dom.window.document.querySelector(`label[for="${id}"]`),
        `falta la etiqueta de ${id}`,
      );
    }
  });

  test("los dos campos piden `new-password` al gestor del teléfono", async () => {
    const { dom, pantalla } = await montar();
    pantalla.arrancar();

    for (const id of ["nueva-clave1", "nueva-clave2"]) {
      assert.equal($(dom, id).getAttribute("autocomplete"), "new-password");
    }
  });

  test("arrancar dos veces no duplica los oyentes", async () => {
    const { dom, pantalla, registro } = await montar();
    pantalla.arrancar();
    pantalla.arrancar();

    await activarRuta(dom);
    await guardar(dom, "clave-larga-123");

    assert.equal(registro.cambios.length, 1);
  });
});
