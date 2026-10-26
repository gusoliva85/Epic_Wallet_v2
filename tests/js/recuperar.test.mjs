/* Pruebas de la pantalla de «olvidé mi contraseña» · F11-T03
   Se corren con `npm test`.

   Mismo patrón que `acceso.test.mjs` y `registro.test.mjs`: el HTML
   sale del `index.html` real —una copia en la prueba verificaría la
   copia— y se doblan los módulos de los que depende.

   De los cuatro criterios de aceptación de la tarea, el que vive en
   esta pantalla es uno solo y es el que se prueba acá: **un correo sin
   cuenta recibe la misma respuesta que uno con cuenta.** Los otros
   tres —que llegue el mail, que el enlace deje poner la contraseña
   nueva, que el usado no sirva otra vez— no se pueden verificar en
   jsdom: dependen del SMTP y del servidor, y se prueban contra el
   proyecto real. */

import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..");
const INDEX = resolve(RAIZ, "web", "index.html");

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

/** El bloque de pantallas de cuenta, recortado del index que se
 * publica: así la prueba se entera si un `id` que usa el JS deja de
 * existir en la plantilla. */
function htmlDelAcceso() {
  const html = readFileSync(INDEX, "utf8");
  const desde = html.indexOf('<div class="acceso"');
  assert.notEqual(desde, -1, "no se encuentra la pantalla de acceso en index.html");
  const hasta = html.indexOf("<!-- La notificación breve", desde);
  assert.notEqual(hasta, -1, "no se encuentra el final de la pantalla de acceso");
  return html.slice(desde, hasta);
}

/**
 * @param {{respuesta?: object}} opciones
 */
async function montar({ respuesta = { ok: true } } = {}) {
  const dom = new JSDOM(
    `<!doctype html><html><body><div class="app"></div>${htmlDelAcceso()}</body></html>`,
    { url: "https://epic-wallet-v2.vercel.app/#/recuperar", pretendToBeVisual: true },
  );
  ventanas.push(dom.window);

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.location = dom.window.location;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.CustomEvent = dom.window.CustomEvent;

  const llamadas = [];
  const navegaciones = [];
  globalThis.__espia = {
    recuperarClave: async (email) => {
      llamadas.push(email);
      return respuesta;
    },
  };
  globalThis.__navegaciones = navegaciones;

  let codigo = readFileSync(resolve(RAIZ, "web", "src", "js", "recuperar.js"), "utf8");
  codigo = codigo
    .replace(
      'import { recuperarClave } from "./auth.js";',
      "const recuperarClave = (...a) => globalThis.__espia.recuperarClave(...a);",
    )
    .replace(
      'import { navegar } from "./router.js";',
      "const navegar = (id) => globalThis.__navegaciones.push(id);",
    )
    .replace('import { LOGIN } from "./nav.js";', 'const LOGIN = "login";');

  const unico = `\n// ${Math.random()}\n`;
  const url = `data:text/javascript;base64,${Buffer.from(codigo + unico, "utf8").toString("base64")}`;
  const modulo = await import(url);
  return { dom, recuperar: modulo, llamadas, navegaciones };
}

const $ = (dom, id) => dom.window.document.getElementById(id);

/** Completa el correo y envía, esperando a que el piso de respuesta
 * (350 ms) se cumpla. */
async function enviar(dom, email = "gustavo@example.com") {
  $(dom, "recuperar-email").value = email;
  $(dom, "form-recuperar").dispatchEvent(
    new dom.window.Event("submit", { bubbles: true, cancelable: true }),
  );
  await new Promise((listo) => setTimeout(listo, 500));
}

// ===================================================================

describe("recuperación de contraseña", () => {
  test("pide el enlace y muestra el mensaje de enviado", async () => {
    const { dom, recuperar, llamadas } = await montar();
    recuperar.arrancar();

    await enviar(dom);

    assert.deepEqual(llamadas, ["gustavo@example.com"]);
    assert.equal($(dom, "recuperar-listo").hidden, false, "no se mostró el mensaje");
    assert.equal($(dom, "form-recuperar").hidden, true, "el formulario sigue visible");
  });

  /* EL CRITERIO DE ACEPTACIÓN DE LA TAREA.

     `auth.js` ya devuelve `ok` cuando el correo no tiene cuenta, así
     que lo que se verifica acá es que la PANTALLA no agregue ninguna
     diferencia por su cuenta: mismo bloque visible, mismo texto. */
  test("un correo sin cuenta recibe exactamente la misma respuesta", async () => {
    const conCuenta = await montar();
    conCuenta.recuperar.arrancar();
    await enviar(conCuenta.dom, "gustavo@example.com");
    const textoConCuenta = $(conCuenta.dom, "recuperar-listo").textContent.trim();

    const sinCuenta = await montar();
    sinCuenta.recuperar.arrancar();
    await enviar(sinCuenta.dom, "nadie@example.com");
    const textoSinCuenta = $(sinCuenta.dom, "recuperar-listo").textContent.trim();

    assert.equal($(sinCuenta.dom, "recuperar-listo").hidden, false);
    assert.equal($(sinCuenta.dom, "recuperar-error").hidden, true, "no puede haber error");
    assert.equal(textoSinCuenta, textoConCuenta);
    assert.ok(textoSinCuenta.length > 0, "el mensaje no puede estar vacío");
  });

  test("el texto de enviado no afirma que el correo salió", async () => {
    const { dom, recuperar } = await montar();
    recuperar.arrancar();
    await enviar(dom);

    const texto = $(dom, "recuperar-listo").textContent.toLowerCase();
    // «Si hay una cuenta…» y no «te mandamos un correo»: la segunda
    // forma confirma que esa cuenta existe.
    assert.match(texto, /si hay una cuenta/);
  });

  test("con el campo vacío no se llama a la API y se avisa", async () => {
    const { dom, recuperar, llamadas } = await montar();
    recuperar.arrancar();

    await enviar(dom, "");

    assert.deepEqual(llamadas, [], "se llamó a la API con el campo vacío");
    assert.equal($(dom, "recuperar-error").hidden, false);
    assert.equal($(dom, "recuperar-listo").hidden, true);
  });

  test("demasiados intentos sí se informan, y no revelan nada", async () => {
    // El 429 es el único caso que `auth.js` deja pasar como error: no
    // dice nada del correo que se escribió, dice algo de cuántas veces
    // se tocó el botón.
    const { dom, recuperar } = await montar({
      respuesta: { ok: false, mensaje: "Demasiados intentos. Esperá un momento." },
    });
    recuperar.arrancar();

    await enviar(dom);

    assert.equal($(dom, "recuperar-error").hidden, false);
    assert.match($(dom, "recuperar-error").textContent, /Demasiados/);
    assert.equal($(dom, "recuperar-listo").hidden, true, "no puede decir que se envió");
  });

  test("el botón no permite envíos dobles", async () => {
    const { dom, recuperar, llamadas } = await montar();
    recuperar.arrancar();

    const form = $(dom, "form-recuperar");
    $(dom, "recuperar-email").value = "gustavo@example.com";
    const submit = () =>
      form.dispatchEvent(
        new dom.window.Event("submit", { bubbles: true, cancelable: true }),
      );
    submit();
    submit();
    await new Promise((listo) => setTimeout(listo, 500));

    assert.equal(llamadas.length, 1, "se llamó dos veces a la API");
  });

  test("los dos enlaces vuelven al login", async () => {
    const { dom, recuperar, navegaciones } = await montar();
    recuperar.arrancar();

    $(dom, "recuperar-ir-login").click();
    await enviar(dom);
    $(dom, "recuperar-volver-login").click();

    assert.deepEqual(navegaciones, ["login", "login"]);
  });

  test("arrancar dos veces no duplica los oyentes", async () => {
    const { dom, recuperar, llamadas } = await montar();
    recuperar.arrancar();
    recuperar.arrancar();

    await enviar(dom);

    assert.equal(llamadas.length, 1);
  });

  test("el campo de correo tiene su etiqueta asociada", async () => {
    const { dom, recuperar } = await montar();
    recuperar.arrancar();

    const etiqueta = dom.window.document.querySelector(
      'label[for="recuperar-email"]',
    );
    assert.ok(etiqueta, "falta la etiqueta del correo");
  });
});
