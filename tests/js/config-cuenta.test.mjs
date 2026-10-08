/* Pruebas de la tarjeta de Cuenta en configuración · F02-T11
   Se corren con `npm test` (`node --test tests/js/*.test.mjs`).

   El HTML sale del `index.html` real, igual que `acceso.test.mjs` y
   `registro.test.mjs`. Se doblan `auth.js` (entrar, actualizarUsuario,
   usuarioActual, cabeceras), `components/toast.js` y `fetch` —lo único
   que NO se dobla es `conectarOjito`, que se importa de verdad desde
   `acceso.js`: es la misma función que ya prueba `acceso.test.mjs`
   sobre el campo de login, y acá lo que importa es que se conecte a
   los tres campos de contraseña, no reprobarla.

   Los criterios de aceptación son de comportamiento: que la
   contraseña nueva sirva para entrar (que se llame a
   `actualizarUsuario`), que con la actual equivocada no se cambie
   nada (que `actualizarUsuario` NUNCA se llame), y que el correo no
   se pueda editar (que no haya ningún campo de formulario en esa
   fila). */

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

/** La tarjeta de Cuenta, recortada del `index.html` que se publica. */
function htmlDeCuenta() {
  const html = readFileSync(INDEX, "utf8");
  const desde = html.indexOf("<!-- ======================= CUENTA · F02-T11");
  assert.notEqual(desde, -1, "no se encuentra la tarjeta de Cuenta en index.html");
  const hasta = html.indexOf('<div class="grid-2">', desde);
  assert.notEqual(hasta, -1, "no se encuentra el final de la tarjeta de Cuenta");
  return html.slice(desde, hasta);
}

/**
 * Monta la pantalla y carga `config-cuenta.js` con dobles de
 * `auth.js`, `components/toast.js` y `fetch`.
 *
 * @param {object} opciones
 * @param {{id?:string, email?:string}|null} [opciones.usuario] lo que
 *   devuelve `usuarioActual()`; `null` simula sin sesión.
 * @param {boolean} [opciones.conSesion] si `cabeceras()` devuelve algo.
 * @param {(email:string, clave:string) => Promise<object>} [opciones.entrar]
 * @param {(cambios:object) => Promise<object>} [opciones.actualizarUsuario]
 * @param {(url:string, init:object) => Promise<{ok:boolean, status?:number, json?:()=>Promise<object>}>} [opciones.fetch]
 */
async function montar({
  usuario = { id: "u1", email: "gustavo@example.com" },
  conSesion = true,
  entrar = async () => ({ ok: true, usuario: { id: "u1" } }),
  actualizarUsuario = async () => ({ ok: true, usuario: { id: "u1" } }),
  fetchImpl = async () => ({ ok: true, json: async () => ({ display_name: "Gustavo" }) }),
} = {}) {
  const dom = new JSDOM(`<!doctype html><html><body>${htmlDeCuenta()}</body></html>`, {
    url: "https://epic-wallet-v2.vercel.app/#/config",
    pretendToBeVisual: true,
  });
  ventanas.push(dom.window);

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.CustomEvent = dom.window.CustomEvent;

  const llamadas = { entrar: [], actualizarUsuario: [], fetch: [], toasts: [] };

  globalThis.__espia = {
    usuarioActual: async () => usuario,
    cabeceras: async () => (conSesion ? { Authorization: "Bearer token-de-prueba" } : null),
    entrar: async (...a) => {
      llamadas.entrar.push(a);
      return entrar(...a);
    },
    actualizarUsuario: async (...a) => {
      llamadas.actualizarUsuario.push(a);
      return actualizarUsuario(...a);
    },
  };
  globalThis.fetch = async (...a) => {
    llamadas.fetch.push(a);
    return fetchImpl(...a);
  };
  globalThis.__toasts = llamadas.toasts;

  const config = await cargarConDobles();
  return { dom, config, llamadas };
}

async function cargarConDobles() {
  let codigo = readFileSync(resolve(RAIZ, "web", "src", "js", "config-cuenta.js"), "utf8");
  codigo = codigo
    .replace(
      'import { usuarioActual, entrar, actualizarUsuario, cabeceras } from "./auth.js";',
      "const usuarioActual = (...a) => globalThis.__espia.usuarioActual(...a);\n" +
        "const entrar = (...a) => globalThis.__espia.entrar(...a);\n" +
        "const actualizarUsuario = (...a) => globalThis.__espia.actualizarUsuario(...a);\n" +
        "const cabeceras = (...a) => globalThis.__espia.cabeceras(...a);",
    )
    .replace(
      'import { conectarOjito } from "./acceso.js";',
      `import { conectarOjito } from "file:///${resolve(RAIZ, "web", "src", "js", "acceso.js").replace(/\\/g, "/")}?t=${Math.random()}";`,
    )
    .replace(
      'import { toast } from "./components/toast.js";',
      "const toast = (...a) => globalThis.__toasts.push(a);",
    );

  const unico = `
// ${Math.random()}
`;
  const url = `data:text/javascript;base64,${Buffer.from(codigo + unico, "utf8").toString("base64")}`;
  return import(url);
}

const $ = (dom, id) => dom.window.document.getElementById(id);

function tipear(campo) {
  campo.dispatchEvent(new campo.ownerDocument.defaultView.Event("input", { bubbles: true }));
}

function enviar(dom, idForm) {
  const form = $(dom, idForm);
  const evento = new dom.window.Event("submit", { bubbles: true, cancelable: true });
  form.dispatchEvent(evento);
  return evento;
}

const tick = () => new Promise((listo) => setTimeout(listo, 0));
const esperar = (ms) => new Promise((listo) => setTimeout(listo, ms));

// ===================================================================

describe("el correo es de sólo lectura", () => {
  test("se muestra el de la sesión, y no hay ningún campo para editarlo", async () => {
    const { dom } = await montar({ usuario: { id: "u1", email: "gustavo@example.com" } });
    await esperar(10);

    assert.equal($(dom, "cuenta-email").textContent, "gustavo@example.com");

    // Ningún `<input>`, `<textarea>` ni `[contenteditable]` cerca del
    // correo: si lo hubiera, "de sólo lectura" sería sólo una promesa
    // de JavaScript y no un hecho del HTML.
    const fila = $(dom, "cuenta-email").closest(".kv");
    assert.equal(fila.querySelector("input, textarea, [contenteditable]"), null);
  });

  test("sin sesión no rompe: muestra el guion", async () => {
    const { dom } = await montar({ usuario: null });
    await esperar(10);
    assert.equal($(dom, "cuenta-email").textContent, "—");
  });
});

describe("guardar el nombre visible", () => {
  test("precarga el nombre que ya tenía, pedido a la API", async () => {
    const { dom, llamadas } = await montar({
      fetchImpl: async () => ({ ok: true, json: async () => ({ display_name: "Gustavo Oliva" }) }),
    });
    await esperar(10);

    assert.equal($(dom, "cuenta-nombre").value, "Gustavo Oliva");
    assert.equal(llamadas.fetch[0][0], "/api/me");
    assert.equal(llamadas.fetch[0][1].method, undefined, "la primera llamada es GET, sin method");
  });

  test("guardar manda sólo display_name, recortado", async () => {
    const { dom, llamadas } = await montar();
    await esperar(10);

    $(dom, "cuenta-nombre").value = "  Gustavo  ";
    enviar(dom, "form-nombre");
    await esperar(50);

    const guardado = llamadas.fetch.find((l) => l[1]?.method === "PATCH");
    assert.ok(guardado, "no se llamó a PATCH /api/me");
    assert.equal(guardado[0], "/api/me");
    const cuerpo = JSON.parse(guardado[1].body);
    assert.deepEqual(cuerpo, { display_name: "Gustavo" });
  });

  test("al guardar bien, avisa con un toast", async () => {
    const { dom, llamadas } = await montar();
    await esperar(10);
    enviar(dom, "form-nombre");
    await esperar(50);

    assert.equal(llamadas.toasts.length, 1);
    assert.match(llamadas.toasts[0][0], /nombre/i);
  });

  test("si la API falla, el error queda en la región de alerta", async () => {
    const { dom } = await montar({
      fetchImpl: async (url, init) =>
        init?.method === "PATCH" ? { ok: false, status: 500 } : { ok: true, json: async () => ({}) },
    });
    await esperar(10);
    enviar(dom, "form-nombre");
    await esperar(50);

    const error = $(dom, "nombre-error");
    assert.equal(error.hidden, false);
    assert.equal(error.getAttribute("role"), "alert");
  });

  test("no permite envíos dobles", async () => {
    const { dom, llamadas } = await montar({
      fetchImpl: async (url, init) => {
        if (init?.method === "PATCH") {
          await new Promise((listo) => setTimeout(listo, 30));
          return { ok: true };
        }
        return { ok: true, json: async () => ({}) };
      },
    });
    await esperar(10);

    enviar(dom, "form-nombre");
    enviar(dom, "form-nombre");
    enviar(dom, "form-nombre");
    await esperar(150);

    const guardados = llamadas.fetch.filter((l) => l[1]?.method === "PATCH");
    assert.equal(guardados.length, 1, `hubo ${guardados.length} guardados y tenía que haber 1`);
  });
});

describe("cambiar la contraseña", () => {
  function completar(dom, { actual = "clave-vieja-123", nueva = "clave-nueva-456" } = {}) {
    $(dom, "clave-actual").value = actual;
    $(dom, "clave-nueva").value = nueva;
    $(dom, "clave-nueva2").value = nueva;
  }

  test("con la actual correcta, la nueva se aplica y sirve para entrar", async () => {
    /* "Sirve para entrar" se verifica acá por lo que SÍ se llama:
       `actualizarUsuario({password: ...})` es la llamada real de
       Supabase que cambia la contraseña de la cuenta. */
    const { dom, llamadas } = await montar();
    await esperar(10);
    completar(dom);

    enviar(dom, "form-clave");
    await esperar(50);

    assert.equal(llamadas.entrar.length, 1, "no verificó la contraseña actual");
    assert.deepEqual(llamadas.entrar[0], ["gustavo@example.com", "clave-vieja-123"]);
    assert.equal(llamadas.actualizarUsuario.length, 1);
    assert.deepEqual(llamadas.actualizarUsuario[0], [{ password: "clave-nueva-456" }]);
  });

  test("con la actual equivocada, no se cambia nada", async () => {
    /* El criterio de aceptación central de la tarea: `entrar()` falla
       y `actualizarUsuario` —la llamada que de verdad cambia algo en
       Supabase— no se tiene que llamar ni una vez. */
    const { dom, llamadas } = await montar({
      entrar: async () => ({ ok: false, mensaje: "El email o la contraseña no son correctos." }),
    });
    await esperar(10);
    completar(dom);

    enviar(dom, "form-clave");
    await esperar(50);

    assert.equal(llamadas.actualizarUsuario.length, 0, "cambió la contraseña igual");
    assert.match($(dom, "clave-error").textContent, /actual.*no es correcta/i);
  });

  test("al cambiar bien, borra los tres campos y avisa con un toast", async () => {
    const { dom, llamadas } = await montar();
    await esperar(10);
    completar(dom);

    enviar(dom, "form-clave");
    await esperar(50);

    assert.equal($(dom, "clave-actual").value, "");
    assert.equal($(dom, "clave-nueva").value, "");
    assert.equal($(dom, "clave-nueva2").value, "");
    assert.equal(llamadas.toasts.length, 1);
    assert.match(llamadas.toasts[0][0], /contraseña/i);
  });

  test("las nuevas tienen que coincidir: si no, no se llama a nada", async () => {
    const { dom, llamadas } = await montar();
    await esperar(10);
    completar(dom, { nueva: "clave-nueva-456" });
    $(dom, "clave-nueva2").value = "otra-clave-distinta";

    enviar(dom, "form-clave");
    await tick();

    assert.equal(llamadas.entrar.length, 0, "verificó la actual antes de chequear que coincidan");
    assert.match($(dom, "clave-error").textContent, /no coinciden/i);
  });

  test("la nota en vivo avisa mientras se escribe", async () => {
    const { dom } = await montar();
    await esperar(10);

    $(dom, "clave-nueva").value = "clave-nueva-456";
    tipear($(dom, "clave-nueva"));
    $(dom, "clave-nueva2").value = "otra-cosa";
    tipear($(dom, "clave-nueva2"));

    assert.match($(dom, "clave-coincide").textContent, /no coinciden/i);
  });

  test("la nueva tiene que tener al menos 8 caracteres", async () => {
    const { dom, llamadas } = await montar();
    await esperar(10);
    completar(dom, { nueva: "corta1" });
    $(dom, "clave-nueva2").value = "corta1";

    enviar(dom, "form-clave");
    await tick();

    assert.equal(llamadas.entrar.length, 0);
    assert.match($(dom, "clave-error").textContent, /8 caracteres/);
  });

  test("los tres ojitos son independientes", async () => {
    const { dom } = await montar();
    await esperar(10);

    $(dom, "ojo-nueva").click();
    assert.equal($(dom, "clave-nueva").type, "text");
    assert.equal($(dom, "clave-actual").type, "password", "el ojito de la nueva tocó el de la actual");
    assert.equal($(dom, "clave-nueva2").type, "password", "el ojito de la nueva tocó el de repetir");
  });

  test("no permite envíos dobles", async () => {
    const { dom, llamadas } = await montar({
      entrar: async () => {
        await new Promise((listo) => setTimeout(listo, 30));
        return { ok: true, usuario: { id: "u1" } };
      },
    });
    await esperar(10);
    completar(dom);

    enviar(dom, "form-clave");
    enviar(dom, "form-clave");
    enviar(dom, "form-clave");
    await esperar(150);

    assert.equal(llamadas.entrar.length, 1, `hubo ${llamadas.entrar.length} intentos y tenía que haber 1`);
  });
});
