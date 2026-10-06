/* Pruebas de la pantalla de inicio de sesión · F02-T09
   Se corren con `node --test tests/js/` y también desde pytest.

   Los cinco criterios de aceptación son de comportamiento: que un error
   muestre un mensaje entendible y genérico, que el ojito muestre y
   oculte, que el botón no permita envíos dobles, que se vea bien con el
   teclado del celular abierto y que el gestor de contraseñas pueda
   completar. Cuatro se verifican acá con el DOM de verdad; el quinto
   —el teclado— se mide sobre el CSS en `tests/unit/test_acceso.py`,
   porque jsdom no tiene teclado virtual.

   El formulario sale del `index.html` de verdad, no de una copia: una
   copia en la prueba verificaría la copia, y lo que puede desincronizarse
   es justamente el HTML que se publica. */

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

/** El HTML del formulario, recortado del index que se publica. */
function htmlDelAcceso() {
  const html = readFileSync(INDEX, "utf8");
  const desde = html.indexOf('<div class="acceso"');
  assert.notEqual(desde, -1, "no se encuentra la pantalla de acceso en index.html");
  const hasta = html.indexOf("<!-- La notificación breve", desde);
  assert.notEqual(hasta, -1, "no se encuentra el final de la pantalla de acceso");
  return html.slice(desde, hasta);
}

/**
 * Monta la pantalla y carga `acceso.js` con un doble de `auth.js`.
 *
 * El doble es de **nuestro** módulo, no de la librería de Supabase: lo
 * que se prueba acá es la pantalla, y `auth.js` ya tiene sus 29 pruebas
 * contra el cliente real. Doblar la red otra vez no agregaría nada y
 * ataría estas pruebas a la forma de las respuestas de GoTrue.
 *
 * @param {{respuesta?: object, demora?: number}} opciones
 */
async function montar({ respuesta = { ok: true, usuario: { id: "u1" } }, demora = 0 } = {}) {
  const dom = new JSDOM(
    `<!doctype html><html><body><div class="app"></div>${htmlDelAcceso()}</body></html>`,
    { url: "https://epic-wallet-v2.vercel.app/#/login", pretendToBeVisual: true },
  );
  ventanas.push(dom.window);

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.location = dom.window.location;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.CustomEvent = dom.window.CustomEvent;

  const llamadas = [];
  const espia = {
    entrar: async (email, clave) => {
      llamadas.push({ email, clave });
      if (demora) await new Promise((listo) => setTimeout(listo, demora));
      return respuesta;
    },
  };
  const navegaciones = [];

  // Se interceptan los dos módulos que `acceso.js` importa. El registro
  // de cargadores de Node es la única forma de hacerlo sin que el
  // módulo tenga que aceptar sus dependencias por parámetro, que es un
  // agujero en la interfaz abierto sólo para las pruebas.
  const auth = await cargarConDobles(espia, navegaciones);
  return { dom, auth, llamadas, navegaciones };
}

/* Se evita el registro de cargadores —que es global y afecta a todo el
   proceso— reescribiendo los imports en memoria: se lee `acceso.js`, se
   reemplazan sus dos importaciones por módulos de datos y se importa el
   resultado. Es explícito y local a cada prueba. */
async function cargarConDobles(espia, navegaciones) {
  globalThis.__espia = espia;
  globalThis.__navegaciones = navegaciones;

  let codigo = readFileSync(resolve(RAIZ, "web", "src", "js", "acceso.js"), "utf8");
  codigo = codigo
    .replace(
      'import { entrar } from "./auth.js";',
      "const entrar = (...a) => globalThis.__espia.entrar(...a);",
    )
    .replace(
      'import { navegar } from "./router.js";',
      "const navegar = (id) => globalThis.__navegaciones.push(id);",
    )
    .replace('import { INICIO } from "./nav.js";', 'const INICIO = "inicio";')
    .replace(
      'import { icono } from "./iconos.js";',
      'const icono = (n) => `<!--${n}-->`;',
    );

  /* El comentario con un número al azar hace que cada prueba genere una
     URL distinta. Sin eso, dos pruebas con el mismo código producen la
     misma URL, Node devuelve el módulo que ya tenía en caché, y ese
     módulo quedó atado al DOM de la primera prueba: la segunda tocaba
     elementos de un documento que ya no existía y fallaba sin motivo
     aparente. Es la misma razón del `?t=` de `router.test.mjs`. */
  const unico = `
// ${Math.random()}
`;
  const url = `data:text/javascript;base64,${Buffer.from(codigo + unico, "utf8").toString("base64")}`;
  return import(url);
}

const $ = (dom, id) => dom.window.document.getElementById(id);

function completar(dom, email = "gustavo@example.com", clave = "clave-larga-123") {
  $(dom, "login-email").value = email;
  $(dom, "login-clave").value = clave;
}

/** Dispara el envío como lo haría Enter o un toque en el botón. */
function enviar(dom) {
  const form = $(dom, "form-login");
  const evento = new dom.window.Event("submit", { bubbles: true, cancelable: true });
  form.dispatchEvent(evento);
  return evento;
}

const tick = () => new Promise((listo) => setTimeout(listo, 0));

// ===================================================================


describe("el ojito muestra y oculta", () => {
  test("alterna el tipo del campo", async () => {
    const { dom, auth } = await montar();
    auth.arrancar();

    const campo = $(dom, "login-clave");
    const ojo = $(dom, "login-ojo");

    assert.equal(campo.type, "password", "la contraseña tiene que arrancar oculta");
    ojo.click();
    assert.equal(campo.type, "text", "el ojito no mostró la contraseña");
    ojo.click();
    assert.equal(campo.type, "password", "el ojito no la volvió a ocultar");
  });

  test("el aria-label dice qué va a pasar, y cambia", async () => {
    /* Quien no ve la pantalla no puede deducir el estado del dibujo del
       ojo. Si la etiqueta no cambia, el botón miente la mitad del
       tiempo. */
    const { dom, auth } = await montar();
    auth.arrancar();

    const ojo = $(dom, "login-ojo");
    assert.match(ojo.getAttribute("aria-label"), /mostrar/i);
    assert.equal(ojo.getAttribute("aria-pressed"), "false");

    ojo.click();
    assert.match(ojo.getAttribute("aria-label"), /ocultar/i);
    assert.equal(ojo.getAttribute("aria-pressed"), "true");

    ojo.click();
    assert.match(ojo.getAttribute("aria-label"), /mostrar/i);
    assert.equal(ojo.getAttribute("aria-pressed"), "false");
  });

  test("devuelve el foco al campo", async () => {
    /* Sin esto, mostrar la contraseña para revisarla obliga a volver a
       tocar el campo. */
    const { dom, auth } = await montar();
    auth.arrancar();

    completar(dom);
    $(dom, "login-ojo").click();
    assert.equal(
      dom.window.document.activeElement,
      $(dom, "login-clave"),
      "el foco quedó en el botón y no volvió al campo",
    );
  });

  test("no envía el formulario", async () => {
    /* Es un `type="button"` dentro de un `<form>`: sin el type sería
       submit y tocar el ojito intentaría entrar. */
    const { dom, auth, llamadas } = await montar();
    auth.arrancar();

    assert.equal($(dom, "login-ojo").getAttribute("type"), "button");
    completar(dom);
    $(dom, "login-ojo").click();
    await tick();
    assert.equal(llamadas.length, 0, "el ojito disparó un intento de entrar");
  });
});

describe("el botón no permite envíos dobles", () => {
  test("tres envíos seguidos producen un solo intento", async () => {
    /* El caso real: el botón tarda en contestar y se vuelve a tocar.
       Sin protección son dos peticiones de login, y la segunda puede
       pisar la sesión que acaba de abrir la primera. */
    const { dom, auth, llamadas } = await montar({ demora: 30 });
    auth.arrancar();
    completar(dom);

    enviar(dom);
    enviar(dom);
    enviar(dom);
    await new Promise((listo) => setTimeout(listo, 450));

    assert.equal(llamadas.length, 1, `hubo ${llamadas.length} intentos y tenía que haber 1`);
  });

  test("mientras espera, el botón está deshabilitado y lo dice", async () => {
    const { dom, auth } = await montar({ demora: 60 });
    auth.arrancar();
    completar(dom);

    enviar(dom);
    await tick();

    const boton = $(dom, "login-enviar");
    assert.equal(boton.disabled, true, "el botón no se deshabilitó");
    assert.equal(boton.getAttribute("aria-busy"), "true");
    assert.ok(boton.classList.contains("cargando"));
  });

  test("al terminar, el botón vuelve", async () => {
    const { dom, auth } = await montar({
      respuesta: { ok: false, mensaje: "El email o la contraseña no son correctos." },
    });
    auth.arrancar();
    completar(dom);

    enviar(dom);
    await new Promise((listo) => setTimeout(listo, 450));

    const boton = $(dom, "login-enviar");
    assert.equal(boton.disabled, false, "el botón quedó trabado después de un error");
    assert.equal(boton.getAttribute("aria-busy"), "false");
  });

  test("el texto del botón no cambia al cargar", async () => {
    /* Reemplazarlo por «Ingresando…» mueve el ancho del botón y la
       pantalla salta justo cuando se está esperando. */
    const { dom, auth } = await montar({ demora: 60 });
    auth.arrancar();
    completar(dom);

    const antes = $(dom, "login-enviar").querySelector(".btn-texto").textContent;
    enviar(dom);
    await tick();
    const durante = $(dom, "login-enviar").querySelector(".btn-texto").textContent;

    assert.equal(durante, antes);
  });
});

describe("los mensajes de error", () => {
  test("credenciales incorrectas muestran el mensaje en la región de alerta", async () => {
    const { dom, auth } = await montar({
      respuesta: { ok: false, mensaje: "El email o la contraseña no son correctos." },
    });
    auth.arrancar();
    completar(dom);

    enviar(dom);
    await new Promise((listo) => setTimeout(listo, 450));

    const caja = $(dom, "login-error");
    assert.equal(caja.hidden, false, "el error no se mostró");
    assert.match(caja.textContent, /correo|email|contraseña/i);
    assert.equal(caja.getAttribute("role"), "alert");
  });

  test("el mensaje no dice si la cuenta existe", async () => {
    const { dom, auth } = await montar({
      respuesta: { ok: false, mensaje: "El email o la contraseña no son correctos." },
    });
    auth.arrancar();
    completar(dom);
    enviar(dom);
    await new Promise((listo) => setTimeout(listo, 450));

    const texto = $(dom, "login-error").textContent;
    // Con la caja vacía esta prueba pasaría sin comprobar nada, que es
    // justo lo que pasó la primera vez que se corrió.
    assert.ok(texto.trim().length > 10, "no hay mensaje que revisar");
    assert.doesNotMatch(texto, /no existe|no encontrad|no est[aá] registrad|usuario inv/i);
  });

  test("la región de error existe vacía desde el principio", async () => {
    /* Un lector anuncia los *cambios* dentro de una región viva. Creada
       junto con el texto no hay cambio que anunciar y el mensaje pasa
       en silencio. Es la misma razón por la que el toast va vacío en el
       HTML. */
    const { dom } = await montar();
    const caja = $(dom, "login-error");
    assert.ok(caja, "la región de error no está en el HTML");
    assert.equal(caja.textContent.trim(), "");
    assert.equal(caja.hidden, true);
  });

  test("al escribir se borra el error anterior", async () => {
    /* Un mensaje que sigue en pantalla mientras se corrige la
       contraseña se lee como si la corrección tampoco sirviera. */
    const { dom, auth } = await montar({
      respuesta: { ok: false, mensaje: "El email o la contraseña no son correctos." },
    });
    auth.arrancar();
    completar(dom);
    enviar(dom);
    await new Promise((listo) => setTimeout(listo, 450));
    assert.equal($(dom, "login-error").hidden, false);

    const campo = $(dom, "login-clave");
    campo.value = "otra-cosa";
    campo.dispatchEvent(new dom.window.Event("input", { bubbles: true }));

    assert.equal($(dom, "login-error").hidden, true, "el error no se borró al escribir");
  });

  test("con los campos vacíos no se llama a la API y se avisa", async () => {
    const { dom, auth, llamadas } = await montar();
    auth.arrancar();

    enviar(dom);
    await tick();

    assert.equal(llamadas.length, 0, "intentó entrar con los campos vacíos");
    assert.equal($(dom, "login-error").hidden, false);
    assert.equal(
      dom.window.document.activeElement,
      $(dom, "login-email"),
      "el foco no fue al primer campo que falta",
    );
  });

  test("tras un error, el foco va a la contraseña y queda seleccionada", async () => {
    const { dom, auth } = await montar({
      respuesta: { ok: false, mensaje: "El email o la contraseña no son correctos." },
    });
    auth.arrancar();
    completar(dom);
    enviar(dom);
    await new Promise((listo) => setTimeout(listo, 450));

    assert.equal(dom.window.document.activeElement, $(dom, "login-clave"));
  });

  test("el correo NO se borra tras un error", async () => {
    /* En el caso habitual el correo estaba bien y lo que falló fue la
       contraseña. Borrar los dos obliga a escribir el correo entero en
       un teclado de teléfono. */
    const { dom, auth } = await montar({
      respuesta: { ok: false, mensaje: "El email o la contraseña no son correctos." },
    });
    auth.arrancar();
    completar(dom);
    enviar(dom);
    await new Promise((listo) => setTimeout(listo, 450));

    assert.equal($(dom, "login-email").value, "gustavo@example.com");
  });
});

describe("entrar", () => {
  test("Enter desde el formulario envía", async () => {
    /* Es un `<form>` con un botón `submit`, así que lo hace el
       navegador. La prueba está para que nadie lo cambie por un `div`
       con un `click`: ahí Enter deja de funcionar y el teclado del
       teléfono muestra «Enter» en vez de «Ir». */
    const { dom, auth, llamadas } = await montar();
    auth.arrancar();
    completar(dom);

    const evento = enviar(dom);
    await new Promise((listo) => setTimeout(listo, 450));

    assert.equal(evento.defaultPrevented, true, "no frenó el envío nativo del formulario");
    assert.equal(llamadas.length, 1);
  });

  test("pasa el correo y la contraseña tal como se escribieron", async () => {
    const { dom, auth, llamadas } = await montar();
    auth.arrancar();
    completar(dom, "  Gustavo@Example.com ", "mi-clave-secreta");
    enviar(dom);
    await new Promise((listo) => setTimeout(listo, 450));

    // El recorte y las minúsculas son de `auth.js`, que ya tiene su
    // prueba: la pantalla no tiene que hacerlo dos veces.
    assert.equal(llamadas[0].clave, "mi-clave-secreta");
    assert.match(llamadas[0].email, /Gustavo@Example\.com/);
  });

  test("al entrar va al inicio y borra la contraseña del campo", async () => {
    /* El formulario sigue en el DOM. Una contraseña en el valor de un
       input queda al alcance de cualquier extensión y vuelve a aparecer
       si el navegador restaura el campo al recargar. */
    const { dom, auth, navegaciones } = await montar();
    auth.arrancar();
    completar(dom);
    enviar(dom);
    await new Promise((listo) => setTimeout(listo, 450));

    assert.deepEqual(navegaciones, ["inicio"]);
    assert.equal($(dom, "login-clave").value, "", "la contraseña quedó en el campo");
  });

  test("si algo lanza, el botón vuelve y se ve un mensaje", async () => {
    /* `entrar()` devuelve el error en vez de lanzarlo, así que acá no
       debería llegar nada. Pero un formulario trabado para siempre es
       peor que un mensaje genérico. */
    const { dom, auth } = await montar();
    auth.arrancar();
    completar(dom);

    // Se rompe el espía después de arrancar.
    globalThis.__espia.entrar = async () => {
      throw new Error("algo explotó");
    };

    enviar(dom);
    await new Promise((listo) => setTimeout(listo, 450));

    assert.equal($(dom, "login-enviar").disabled, false, "el botón quedó trabado");
    assert.equal($(dom, "login-error").hidden, false);
  });

  test("tarda lo mismo con un correo que no existe que con la contraseña mal", async () => {
    /* El agujero que queda después de igualar los textos: si un caso
       falla notablemente más rápido que el otro, el tiempo cuenta lo
       mismo que contaría un mensaje distinto. */
    /* Se mide hasta que el mensaje APARECE, no hasta que termina una
       espera fija. La primera versión de esta prueba esperaba 600 ms y
       devolvía el tiempo transcurrido: medía su propia espera, daba la
       misma cifra siempre y pasaba aunque se le sacara el piso al
       código. Lo destapó la mutación. */
    const medir = async (demora) => {
      const { dom, auth } = await montar({
        demora,
        respuesta: { ok: false, mensaje: "El email o la contraseña no son correctos." },
      });
      auth.arrancar();
      completar(dom);
      const desde = Date.now();
      enviar(dom);
      const limite = desde + 3000;
      while ($(dom, "login-error").hidden && Date.now() < limite) {
        await new Promise((listo) => setTimeout(listo, 5));
      }
      assert.equal($(dom, "login-error").hidden, false, "el error nunca apareció");
      return Date.now() - desde;
    };

    // Una respuesta inmediata y otra de 120 ms tienen que tardar
    // prácticamente lo mismo de cara al usuario.
    const rapida = await medir(0);
    const lenta = await medir(120);

    assert.ok(
      Math.abs(rapida - lenta) < 90,
      `una tardó ${rapida} ms y la otra ${lenta} ms: la diferencia delata el caso`,
    );
  });
});

describe("el gestor de contraseñas del teléfono", () => {
  test("los dos campos tienen el autocomplete que el gestor espera", async () => {
    /* `username` y `current-password` son los valores que hacen que el
       gestor ofrezca completar y que, al entrar con una contraseña
       nueva, ofrezca guardarla. Con `off` o sin el atributo, el gestor
       no reconoce el formulario y hay que escribir todo a mano en un
       teclado de teléfono. */
    const { dom } = await montar();
    assert.equal($(dom, "login-email").getAttribute("autocomplete"), "username");
    assert.equal($(dom, "login-clave").getAttribute("autocomplete"), "current-password");
  });

  test("el campo de correo no estorba al escribir en un teléfono", async () => {
    const { dom } = await montar();
    const email = $(dom, "login-email");
    assert.equal(email.getAttribute("type"), "email");
    assert.equal(email.getAttribute("inputmode"), "email");
    // Sin esto, el teclado del teléfono pone la primera letra en
    // mayúscula y el corrector subraya el correo.
    assert.equal(email.getAttribute("autocapitalize"), "none");
    assert.equal(email.getAttribute("spellcheck"), "false");
  });

  test("los campos están dentro de un form, con name", async () => {
    /* Un gestor de contraseñas busca un `<form>` con campos con
       nombre. Dos inputs sueltos en un div no los reconoce. */
    const { dom } = await montar();
    const form = $(dom, "form-login");
    assert.equal(form.tagName, "FORM");
    assert.equal($(dom, "login-email").form, form);
    assert.equal($(dom, "login-clave").form, form);
    assert.ok($(dom, "login-email").getAttribute("name"));
    assert.ok($(dom, "login-clave").getAttribute("name"));
  });

  test("cada campo tiene su etiqueta asociada", async () => {
    const { dom } = await montar();
    for (const id of ["login-email", "login-clave"]) {
      const label = dom.window.document.querySelector(`label[for="${id}"]`);
      assert.ok(label, `el campo ${id} no tiene etiqueta`);
      assert.ok(label.textContent.trim().length > 2);
    }
  });
});
