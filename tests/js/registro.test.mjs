/* Pruebas de la pantalla de registro · F02-T10
   Se corren con `npm test` (`node --test tests/js/*.test.mjs`).

   Mismo patrón que `acceso.test.mjs`: el HTML sale del `index.html`
   real —una copia en la prueba verificaría la copia—, y se doblan los
   módulos de los que depende (`auth.js`, `router.js`, `nav.js`), no la
   librería de Supabase: eso ya lo prueba `auth.test.mjs`.

   Los criterios de aceptación de la tarea son de comportamiento: que
   una cuenta se cree de punta a punta y entre directo, que contraseñas
   que no coinciden no dejen enviar, y que un email ya registrado no
   revele que existe. Los tres se verifican acá con el DOM de verdad. */

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

/** El HTML de las pantallas de cuenta, recortado del index que se
 * publica. Incluye login y registro: las dos viven dentro del mismo
 * `#acceso` (router.js, bloque de `[data-cuenta]`). */
function htmlDelAcceso() {
  const html = readFileSync(INDEX, "utf8");
  const desde = html.indexOf('<div class="acceso"');
  assert.notEqual(desde, -1, "no se encuentra la pantalla de acceso en index.html");
  const hasta = html.indexOf("<!-- La notificación breve", desde);
  assert.notEqual(hasta, -1, "no se encuentra el final de la pantalla de acceso");
  return html.slice(desde, hasta);
}

/**
 * Monta la pantalla y carga `registro.js` con dobles de `auth.js`,
 * `router.js` y `nav.js`.
 *
 * @param {{respuesta?: object, demora?: number}} opciones
 */
async function montar({
  respuesta = { ok: true, usuario: { id: "u1" } },
  demora = 0,
} = {}) {
  const dom = new JSDOM(
    `<!doctype html><html><body><div class="app"></div>${htmlDelAcceso()}</body></html>`,
    { url: "https://epic-wallet-v2.vercel.app/#/registro", pretendToBeVisual: true },
  );
  ventanas.push(dom.window);

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.location = dom.window.location;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.CustomEvent = dom.window.CustomEvent;

  const llamadas = [];
  const espia = {
    registrarse: async (email, clave) => {
      llamadas.push({ email, clave });
      if (demora) await new Promise((listo) => setTimeout(listo, demora));
      return respuesta;
    },
  };
  const navegaciones = [];

  const registro = await cargarConDobles(espia, navegaciones);
  return { dom, registro, llamadas, navegaciones };
}

/* Mismo truco que en acceso.test.mjs: se reescriben en memoria las
   importaciones de `registro.js` por módulos de datos, en vez de
   registrar un cargador global que afectaría a todo el proceso.
   `conectarOjito` SÍ se deja real —importado del `acceso.js` de
   verdad—: es la misma función que ya prueba `acceso.test.mjs` sobre
   el campo de login, y acá lo que importa es que `registro.js` la
   conecte a sus dos campos, no reprobar la función una vez más. */
async function cargarConDobles(espia, navegaciones) {
  globalThis.__espia = espia;
  globalThis.__navegaciones = navegaciones;

  let codigo = readFileSync(resolve(RAIZ, "web", "src", "js", "registro.js"), "utf8");
  codigo = codigo
    .replace(
      'import { registrarse } from "./auth.js";',
      "const registrarse = (...a) => globalThis.__espia.registrarse(...a);",
    )
    .replace(
      'import { navegar } from "./router.js";',
      "const navegar = (id) => globalThis.__navegaciones.push(id);",
    )
    .replace(
      'import { INICIO, LOGIN } from "./nav.js";',
      'const INICIO = "inicio"; const LOGIN = "login";',
    )
    .replace(
      'import { conectarOjito } from "./acceso.js";',
      `import { conectarOjito } from "file:///${resolve(RAIZ, "web", "src", "js", "acceso.js").replace(/\\/g, "/")}?t=${Math.random()}";`,
    );

  const unico = `
// ${Math.random()}
`;
  const url = `data:text/javascript;base64,${Buffer.from(codigo + unico, "utf8").toString("base64")}`;
  return import(url);
}

const $ = (dom, id) => dom.window.document.getElementById(id);

function completar(
  dom,
  { email = "gustavo@example.com", clave = "clave-larga-123", clave2 = clave } = {},
) {
  $(dom, "registro-email").value = email;
  $(dom, "registro-clave").value = clave;
  $(dom, "registro-clave2").value = clave2;
}

/** Dispara los oyentes de `input` sin depender de un evento de teclado
 * real: lo único que `registro.js` escucha es el evento, no cómo llegó
 * el cambio de valor. */
function tipear(campo) {
  campo.dispatchEvent(new campo.ownerDocument.defaultView.Event("input", { bubbles: true }));
}

function enviar(dom) {
  const form = $(dom, "form-registro");
  const evento = new dom.window.Event("submit", { bubbles: true, cancelable: true });
  form.dispatchEvent(evento);
  return evento;
}

const tick = () => new Promise((listo) => setTimeout(listo, 0));
const esperar = (ms) => new Promise((listo) => setTimeout(listo, ms));

// ===================================================================

describe("crear una cuenta de punta a punta", () => {
  test("con los tres campos completos entra directo al inicio", async () => {
    const { dom, registro, llamadas, navegaciones } = await montar();
    registro.arrancar();
    completar(dom);

    enviar(dom);
    await esperar(450);

    assert.equal(llamadas.length, 1);
    assert.equal(llamadas[0].email, "gustavo@example.com");
    assert.deepEqual(navegaciones, ["inicio"], "no entró directo al dashboard");
  });

  test("borra las dos contraseñas de los campos al entrar", async () => {
    /* Mismo motivo que el login: el formulario sigue en el DOM después
       de navegar, y una contraseña en el valor de un input queda al
       alcance de cualquier extensión. */
    const { dom, registro } = await montar();
    registro.arrancar();
    completar(dom);

    enviar(dom);
    await esperar(450);

    assert.equal($(dom, "registro-clave").value, "");
    assert.equal($(dom, "registro-clave2").value, "");
  });

  test("el email se envía recortado", async () => {
    const { dom, registro, llamadas } = await montar();
    registro.arrancar();
    completar(dom, { email: "  gustavo@example.com  " });

    enviar(dom);
    await esperar(450);

    // `registrarse()` de auth.js ya recorta el email (probado en
    // auth.test.mjs); acá sólo importa que la pantalla no lo recorte
    // mal dos veces, así que se compara con lo que escribió la mano.
    assert.equal(llamadas[0].email.trim(), "gustavo@example.com");
  });

  test("con la confirmación prendida, muestra el aviso en vez de navegar", async () => {
    /* Hoy no pasa porque la confirmación está apagada (F02-T02), pero
       el camino tiene que estar probado para cuando F11-T03 la active
       y auth.js empiece a devolver `falta_confirmar`. */
    const { dom, registro, navegaciones } = await montar({
      respuesta: { ok: true, falta_confirmar: true },
    });
    registro.arrancar();
    completar(dom);

    enviar(dom);
    await esperar(450);

    assert.deepEqual(navegaciones, [], "no tenía que navegar todavía");
    assert.equal($(dom, "form-registro").hidden, true);
    assert.equal($(dom, "registro-confirmar").hidden, false);
    assert.match($(dom, "registro-confirmar").textContent, /correo/i);
  });
});

describe("las contraseñas tienen que coincidir", () => {
  test("distintas: no se envía y se avisa", async () => {
    const { dom, registro, llamadas } = await montar();
    registro.arrancar();
    completar(dom, { clave: "clave-larga-123", clave2: "otra-clave-distinta" });

    enviar(dom);
    await tick();

    assert.equal(llamadas.length, 0, "se envió con las contraseñas distintas");
    const error = $(dom, "registro-error");
    assert.equal(error.hidden, false);
    assert.match(error.textContent, /no coinciden/i);
  });

  test("la nota en vivo avisa mientras se escribe, antes de enviar", async () => {
    const { dom, registro } = await montar();
    registro.arrancar();

    $(dom, "registro-clave").value = "clave-larga-123";
    tipear($(dom, "registro-clave"));
    $(dom, "registro-clave2").value = "clave-larga-124";
    tipear($(dom, "registro-clave2"));

    const nota = $(dom, "registro-coincide");
    assert.match(nota.textContent, /no coinciden/i);

    $(dom, "registro-clave2").value = "clave-larga-123";
    tipear($(dom, "registro-clave2"));
    assert.match(nota.textContent, /coinciden/i);
    assert.doesNotMatch(nota.textContent, /no coinciden/i);
  });

  test("con el segundo campo vacío todavía no hay nada que avisar", async () => {
    /* Las dos cajas en blanco no son un error: todavía no hay nada que
       comparar. Avisar "no coinciden" acá sería ruido antes de que la
       persona termine de escribir. */
    const { dom, registro } = await montar();
    registro.arrancar();

    $(dom, "registro-clave").value = "clave-larga-123";
    tipear($(dom, "registro-clave"));

    assert.equal($(dom, "registro-coincide").textContent.trim(), "");
  });

  test("iguales: se envía", async () => {
    const { dom, registro, llamadas } = await montar();
    registro.arrancar();
    completar(dom, { clave: "clave-larga-123", clave2: "clave-larga-123" });

    enviar(dom);
    await esperar(450);

    assert.equal(llamadas.length, 1);
  });
});

describe("el mínimo de 8 caracteres se valida antes de llamar a la API", () => {
  test("una contraseña corta no dispara la petición", async () => {
    const { dom, registro, llamadas } = await montar();
    registro.arrancar();
    completar(dom, { clave: "corta1", clave2: "corta1" });

    enviar(dom);
    await tick();

    assert.equal(llamadas.length, 0, "llamó a la API con una contraseña de 6 caracteres");
    assert.match($(dom, "registro-error").textContent, /8 caracteres/);
  });
});

describe("el medidor de fortaleza es orientativo, nunca bloqueante", () => {
  test("no se muestra con el campo vacío", async () => {
    const { dom, registro } = await montar();
    registro.arrancar();
    assert.equal($(dom, "registro-fuerza").hidden, true);
  });

  test("aparece al escribir, sin impedir nada por sí mismo", async () => {
    const { dom, registro } = await montar();
    registro.arrancar();

    $(dom, "registro-clave").value = "a";
    tipear($(dom, "registro-clave"));

    assert.equal($(dom, "registro-fuerza").hidden, false);
  });

  test("por debajo del mínimo, dice cuánto falta en vez de «Débil»", async () => {
    /* La validación en vivo del mínimo de 8 caracteres (Hacer, F02-T10):
       orientativa como el resto del medidor, pero concreta. */
    const { dom, registro } = await montar();
    registro.arrancar();

    $(dom, "registro-clave").value = "abc12";
    tipear($(dom, "registro-clave"));

    assert.match($(dom, "registro-fuerza-texto").textContent, /faltan 3/i);
  });

  test("una contraseña de 8 caracteres simples alcanza para enviar", async () => {
    /* El medidor puede decir "Débil" y el envío tiene que funcionar
       igual: el único mínimo real son los 8 caracteres (Técnico §8.9).
       Que la interfaz sugiera una contraseña mejor no es lo mismo que
       exigirla. */
    const { dom, registro, llamadas } = await montar();
    registro.arrancar();
    completar(dom, { clave: "aaaaaaaa", clave2: "aaaaaaaa" });

    enviar(dom);
    await esperar(450);

    assert.equal(llamadas.length, 1, "una contraseña débil pero válida no se pudo enviar");
  });
});

describe("el ojito funciona en los dos campos", () => {
  test("el de la contraseña", async () => {
    const { dom, registro } = await montar();
    registro.arrancar();

    const campo = $(dom, "registro-clave");
    assert.equal(campo.type, "password");
    $(dom, "registro-ojo").click();
    assert.equal(campo.type, "text");
  });

  test("el de repetir, por separado del primero", async () => {
    const { dom, registro } = await montar();
    registro.arrancar();

    const campo1 = $(dom, "registro-clave");
    const campo2 = $(dom, "registro-clave2");
    $(dom, "registro-ojo2").click();

    assert.equal(campo2.type, "text", "el segundo ojito no mostró su campo");
    assert.equal(campo1.type, "password", "el segundo ojito tocó el primer campo");
  });
});

describe("el botón no permite envíos dobles", () => {
  test("tres envíos seguidos producen un solo intento", async () => {
    const { dom, registro, llamadas } = await montar({ demora: 30 });
    registro.arrancar();
    completar(dom);

    enviar(dom);
    enviar(dom);
    enviar(dom);
    await esperar(450);

    assert.equal(llamadas.length, 1, `hubo ${llamadas.length} intentos y tenía que haber 1`);
  });

  test("mientras espera, el botón está deshabilitado y lo dice", async () => {
    const { dom, registro } = await montar({ demora: 60 });
    registro.arrancar();
    completar(dom);

    enviar(dom);
    await tick();

    const boton = $(dom, "registro-enviar");
    assert.equal(boton.disabled, true);
    assert.equal(boton.getAttribute("aria-busy"), "true");
  });
});

describe("los mensajes de error", () => {
  test("un email ya registrado no revela que existe", async () => {
    const { dom, registro } = await montar({
      respuesta: { ok: false, mensaje: "No se pudo crear la cuenta con esos datos." },
    });
    registro.arrancar();
    completar(dom);

    enviar(dom);
    await esperar(450);

    const texto = $(dom, "registro-error").textContent;
    assert.ok(texto.trim().length > 10, "no hay mensaje que revisar");
    assert.doesNotMatch(
      texto,
      /ya existe|ya está registrad|ya tiene cuenta|duplicad/i,
      "el mensaje no puede decir que el email ya tenía cuenta",
    );
  });

  test("un error de servidor pone el foco en el correo, no en la contraseña", async () => {
    /* Mismo criterio que el login: el foco va al dato que conviene
       revisar. "Ya existe" se trata igual que cualquier otro error —
       la pantalla no distingue motivos para no filtrar si el email
       tenía cuenta — así que cae en el mismo default que el foco. */
    const { dom, registro } = await montar({
      respuesta: { ok: false, mensaje: "No se pudo crear la cuenta con esos datos." },
    });
    registro.arrancar();
    completar(dom);

    enviar(dom);
    await esperar(450);

    assert.equal(dom.window.document.activeElement, $(dom, "registro-email"));
  });

  test("una contraseña débil para Supabase pone el foco ahí", async () => {
    const { dom, registro } = await montar({
      respuesta: {
        ok: false,
        mensaje: "La contraseña tiene que tener al menos 8 caracteres.",
        codigo: "weak_password",
      },
    });
    registro.arrancar();
    completar(dom);

    enviar(dom);
    await esperar(450);

    assert.equal(dom.window.document.activeElement, $(dom, "registro-clave"));
  });

  test("la región de error existe vacía desde el principio", async () => {
    const { dom } = await montar();
    const caja = $(dom, "registro-error");
    assert.ok(caja, "la región de error no está en el HTML");
    assert.equal(caja.textContent.trim(), "");
    assert.equal(caja.hidden, true);
  });

  test("al escribir se borra el error anterior", async () => {
    const { dom, registro } = await montar({
      respuesta: { ok: false, mensaje: "Algo no funcionó." },
    });
    registro.arrancar();
    completar(dom);
    enviar(dom);
    await esperar(450);
    assert.equal($(dom, "registro-error").hidden, false);

    tipear($(dom, "registro-email"));
    assert.equal($(dom, "registro-error").hidden, true);
  });
});

describe("los enlaces entre login y registro", () => {
  test("«Iniciá sesión» desde registro navega a login", async () => {
    const { dom, registro, navegaciones } = await montar();
    registro.arrancar();

    $(dom, "registro-ir-login").click();
    assert.deepEqual(navegaciones, ["login"]);
  });

  test("arrancar dos veces no duplica el oyente del enlace", async () => {
    const { dom, registro, navegaciones } = await montar();
    registro.arrancar();
    registro.arrancar();

    $(dom, "registro-ir-login").click();
    assert.deepEqual(navegaciones, ["login"], "el click navegó más de una vez");
  });
});
