/* Pruebas de autenticación · F02-T08
   Se corren con `node --test tests/js/` y también desde pytest, que las
   invoca en tests/unit/test_auth_js.py para que `pytest` siga siendo el
   único comando que hay que recordar.

   POR QUÉ CONTRA LA LIBRERÍA DE VERDAD Y NO CONTRA UN DOBLE

   Los tres criterios de aceptación son de comportamiento —la sesión
   sobrevive a recargar y a cerrar la aplicación, el token se renueva
   solo, la clave de servicio no se publica— y los primeros dos no los
   implementa nuestro código: los implementa `@supabase/auth-js`. Una
   prueba contra un doble de la librería verificaría el doble.

   Así que acá se usa el `GoTrueClient` real y se reemplaza **la red**:
   `globalThis.fetch` contesta como contestaría GoTrue. Eso prueba lo
   que de verdad puede fallar, que es nuestra configuración —
   `persistSession`, `storageKey`, `autoRefreshToken`, el margen de
   renovación— y no la librería.

   El `localStorage` es el de jsdom, también real. */

import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..");

const URL_SUPABASE = "https://proyecto-de-prueba.supabase.co";
const CLAVE = "sb_publishable_de_prueba";
const CLAVE_DE_SESION = "epic-wallet-auth";

// ===================================================================
//  Un GoTrue de mentira, pero con las respuestas de verdad
// ===================================================================

/** Arma una sesión con la forma exacta que devuelve GoTrue.
 *
 * `expires_at` en segundos y no en milisegundos: es lo que usa el
 * estándar y lo que lee `auth.js` para decidir si renueva. Con
 * milisegundos la cuenta da setenta mil años de validez y la prueba de
 * renovación pasaría sin renovar nada.
 */
function sesionFalsa({ vence_en = 3600, token = "token-1", refresh = "refresh-1" } = {}) {
  const ahora = Math.floor(Date.now() / 1000);
  return {
    access_token: token,
    token_type: "bearer",
    expires_in: vence_en,
    expires_at: ahora + vence_en,
    refresh_token: refresh,
    user: {
      id: "11111111-2222-3333-4444-555555555555",
      email: "gustavo@example.com",
      aud: "authenticated",
      role: "authenticated",
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
  };
}

/** El servidor de mentira. Guarda qué le pidieron, que es la mitad de
 * lo que las pruebas necesitan comprobar. */
function servidor() {
  const estado = {
    llamadas: [],
    /** Cada entrada: (url, cuerpo) => [codigo, json] */
    respuestas: new Map(),
    contadorDeRefresh: 0,
  };

  estado.fetch = async (entrada, opciones = {}) => {
    const url = String(entrada?.url ?? entrada);
    const metodo = (opciones.method ?? "GET").toUpperCase();
    let cuerpo = null;
    try {
      cuerpo = opciones.body ? JSON.parse(opciones.body) : null;
    } catch {
      cuerpo = opciones.body ?? null;
    }
    estado.llamadas.push({ url, metodo, cuerpo });

    const respuesta = (codigo, datos) =>
      new Response(JSON.stringify(datos), {
        status: codigo,
        headers: { "Content-Type": "application/json" },
      });

    for (const [patron, manejar] of estado.respuestas) {
      if (url.includes(patron)) {
        const [codigo, datos] = manejar(url, cuerpo);
        return respuesta(codigo, datos);
      }
    }

    // Lo que no está configurado se contesta como GoTrue por defecto.
    if (url.includes("grant_type=refresh_token")) {
      estado.contadorDeRefresh += 1;
      return respuesta(
        200,
        sesionFalsa({
          token: `token-renovado-${estado.contadorDeRefresh}`,
          refresh: `refresh-${estado.contadorDeRefresh + 1}`,
        }),
      );
    }
    if (url.includes("grant_type=password")) return respuesta(200, sesionFalsa());
    if (url.includes("/signup")) return respuesta(200, sesionFalsa());
    if (url.includes("/logout")) return respuesta(204, {});
    if (url.includes("/recover")) return respuesta(200, {});
    if (url.includes("/user") && metodo === "PUT")
      return respuesta(200, sesionFalsa().user);
    if (url.includes("/user")) return respuesta(200, sesionFalsa().user);
    return respuesta(404, { message: "no configurado en la prueba" });
  };

  return estado;
}

// ===================================================================
//  Montaje
// ===================================================================

/** Monta el entorno del navegador y carga `auth.js` dentro.
 *
 * @param {{almacenado?: object | null, red?: ReturnType<typeof servidor>, config?: object}} opciones
 */
async function montar({ almacenado = null, red = servidor(), config } = {}) {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://epic-wallet-v2.vercel.app/",
  });

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.location = dom.window.location;
  globalThis.localStorage = dom.window.localStorage;
  globalThis.sessionStorage = dom.window.sessionStorage;
  globalThis.fetch = red.fetch;

  // Lo que deja el build. `undefined` para probar qué pasa sin ella.
  globalThis.EPIC_WALLET =
    config === undefined
      ? { supabaseUrl: URL_SUPABASE, supabaseAnonKey: CLAVE }
      : config;

  // Una sesión ya guardada: es lo que hay después de recargar.
  if (almacenado) {
    dom.window.localStorage.setItem(CLAVE_DE_SESION, JSON.stringify(almacenado));
  }

  // Instancia nueva del módulo en cada prueba: el cliente es un
  // singleton y guardaría la configuración de la prueba anterior.
  const url =
    "file:///" +
    resolve(RAIZ, "web", "src", "js", "auth.js").replace(/\\/g, "/") +
    `?t=${Math.random()}`;
  const auth = await import(url);

  /* `autoRefreshToken: true` deja andando un temporizador que renueva
     el token cada tanto. Es exactamente lo que se quiere en el
     navegador y lo que hace que `node --test` no termine nunca: el
     proceso queda con un `setInterval` vivo por cada cliente creado.
     Se anotan para apagarlos al final.

     Costó encontrarlo porque no falla: la suite pasa y se queda
     colgada, que desde afuera parece una prueba lenta. */
  try {
    aLimpiar.clientes.push(auth.clienteDeAuth());
  } catch {
    // Sin configuración no hay cliente que apagar, y es un caso
    // legítimo que una prueba verifica.
  }
  aLimpiar.ventanas.push(dom.window);

  return { auth, dom, red };
}

const aLimpiar = { clientes: [], ventanas: [] };

after(() => {
  for (const c of aLimpiar.clientes) {
    try {
      c.stopAutoRefresh();
    } catch {
      /* Ya apagado o sin el método: no importa. */
    }
  }
  // jsdom también deja temporizadores propios.
  for (const v of aLimpiar.ventanas) {
    try {
      v.close();
    } catch {
      /* Ídem. */
    }
  }
});

// ===================================================================


describe("la sesión sobrevive", () => {
  test("al recargar: queda guardada y se lee sin tocar la red", async () => {
    const { auth, dom, red } = await montar();

    const r = await auth.entrar("gustavo@example.com", "clave-larga-123");
    assert.equal(r.ok, true, `no entró: ${JSON.stringify(r)}`);

    const guardado = dom.window.localStorage.getItem(CLAVE_DE_SESION);
    assert.ok(guardado, "no guardó la sesión en localStorage");

    // Recargar = módulo nuevo, mismo almacenamiento. Y red que
    // contesta 404 a todo, para probar que no la necesita.
    const redMuerta = servidor();
    redMuerta.respuestas.set("", () => [500, { message: "la red no debería usarse" }]);
    const despues = await montar({
      almacenado: JSON.parse(guardado),
      red: redMuerta,
    });

    assert.equal(await despues.auth.haySesion(), true, "perdió la sesión al recargar");
    const u = await despues.auth.usuarioActual();
    assert.equal(u.email, "gustavo@example.com");
    assert.equal(
      redMuerta.llamadas.length,
      0,
      "fue a la red para leer una sesión que tenía guardada",
    );
    assert.ok(red.llamadas.some((l) => l.url.includes("grant_type=password")));
  });

  test("al cerrar la aplicación instalada: está en localStorage, no en sessionStorage", async () => {
    /* La diferencia no es un detalle. `sessionStorage` se borra cuando
       se cierra la pestaña o la aplicación instalada, así que una
       sesión guardada ahí obligaría a entrar de nuevo cada vez que se
       abre la PWA. Es exactamente el criterio de aceptación, y la única
       forma de verificarlo sin cerrar un navegador de verdad es mirar
       dónde quedó. */
    const { auth, dom } = await montar();
    await auth.entrar("gustavo@example.com", "clave-larga-123");

    assert.ok(
      dom.window.localStorage.getItem(CLAVE_DE_SESION),
      "la sesión no está en localStorage: no sobreviviría a cerrar la app",
    );
    assert.equal(
      dom.window.sessionStorage.getItem(CLAVE_DE_SESION),
      null,
      "la sesión está en sessionStorage, que se borra al cerrar",
    );
  });

  test("salir borra lo guardado", async () => {
    const { auth, dom } = await montar();
    await auth.entrar("gustavo@example.com", "clave-larga-123");
    await auth.salir();

    assert.equal(
      dom.window.localStorage.getItem(CLAVE_DE_SESION),
      null,
      "quedó la sesión guardada después de salir",
    );
    assert.equal(await auth.haySesion(), false);
  });

  test("salir borra lo guardado aunque el servidor falle", async () => {
    /* Un «cerrar sesión» que falla y deja al usuario adentro es peor
       que uno que cierra de más. En un teléfono sin señal, el botón
       tiene que funcionar igual. */
    const red = servidor();
    const { auth, dom } = await montar({ red });
    await auth.entrar("gustavo@example.com", "clave-larga-123");

    red.respuestas.set("/logout", () => [500, { message: "servidor caído" }]);
    await auth.salir();

    assert.equal(dom.window.localStorage.getItem(CLAVE_DE_SESION), null);
  });
});

describe("el token se renueva solo", () => {
  test("uno que está por vencer se cambia antes de usarse", async () => {
    /* El margen es de 60 segundos. Una sesión que vence en 10 tiene que
       renovarse antes de salir a la red: una petición que sale con un
       token de dos segundos de vida puede llegar vencida. */
    const red = servidor();
    const { auth } = await montar({
      almacenado: sesionFalsa({ vence_en: 10, token: "token-viejo" }),
      red,
    });

    const t = await auth.token();

    assert.ok(t, "no devolvió token");
    assert.notEqual(t, "token-viejo", "devolvió el token que estaba por vencer");
    assert.ok(
      red.llamadas.some((l) => l.url.includes("grant_type=refresh_token")),
      "no pidió la renovación",
    );
  });

  test("uno con vida por delante se usa tal cual, sin ir a la red", async () => {
    /* El contrapeso del anterior. Sin esta prueba, un `token()` que
       renovara siempre pasaría la de arriba y haría una petición de más
       por cada llamada. */
    const red = servidor();
    const { auth } = await montar({
      almacenado: sesionFalsa({ vence_en: 3600, token: "token-fresco" }),
      red,
    });

    const t = await auth.token();

    assert.equal(t, "token-fresco");
    assert.equal(
      red.llamadas.filter((l) => l.url.includes("refresh_token")).length,
      0,
      "renovó un token que tenía una hora de vida",
    );
  });

  test("uno ya vencido también se renueva", async () => {
    const red = servidor();
    const { auth } = await montar({
      almacenado: sesionFalsa({ vence_en: -120, token: "token-vencido" }),
      red,
    });

    const t = await auth.token();
    assert.ok(t);
    assert.notEqual(t, "token-vencido");
  });

  test("dos peticiones juntas no piden dos renovaciones", async () => {
    /* Es una de las razones por las que se usa la librería en vez de
       seis `fetch`: dedupica las renovaciones simultáneas. Sin eso, dos
       peticiones a la vez con el token por vencer piden dos tokens, y
       el segundo invalida el refresh del primero. */
    const red = servidor();
    const { auth } = await montar({
      almacenado: sesionFalsa({ vence_en: 5, token: "token-viejo" }),
      red,
    });

    const [a, b, c] = await Promise.all([auth.token(), auth.token(), auth.token()]);

    assert.ok(a && b && c);
    const renovaciones = red.llamadas.filter((l) =>
      l.url.includes("grant_type=refresh_token"),
    ).length;
    assert.ok(
      renovaciones <= 1,
      `pidió ${renovaciones} renovaciones para tres peticiones simultáneas`,
    );
  });

  test("si la renovación falla, devuelve null en vez de un token muerto", async () => {
    const red = servidor();
    red.respuestas.set("grant_type=refresh_token", () => [
      400,
      { error: "invalid_grant", message: "Refresh Token Not Found" },
    ]);
    const { auth } = await montar({
      almacenado: sesionFalsa({ vence_en: 5 }),
      red,
    });

    assert.equal(await auth.token(), null);
  });

  test("sin sesión devuelve null y no revienta", async () => {
    const { auth } = await montar();
    assert.equal(await auth.token(), null);
    assert.equal(await auth.cabeceras(), null);
    assert.equal(await auth.usuarioActual(), null);
    assert.equal(await auth.haySesion(), false);
  });

  test("las cabeceras llevan el token en Bearer", async () => {
    const { auth } = await montar({
      almacenado: sesionFalsa({ vence_en: 3600, token: "abc.def.ghi" }),
    });
    assert.deepEqual(await auth.cabeceras(), { Authorization: "Bearer abc.def.ghi" });
  });
});

describe("los errores no cuentan quién tiene cuenta", () => {
  test("«no existe» y «contraseña mal» dicen lo mismo", async () => {
    /* Criterio de aceptación de F02-T09, pero el mensaje se arma acá.
       Supabase responde distinto en los dos casos, y pasar eso tal cual
       a la pantalla convierte el formulario de ingreso en un
       verificador de cuentas: se prueban mil emails y los que
       contestan «contraseña incorrecta» existen. */
    const { auth } = await montar();

    const noExiste = auth.mensajeDeError({
      code: "user_not_found",
      status: 400,
      message: "User not found",
    });
    const claveMal = auth.mensajeDeError({
      code: "invalid_credentials",
      status: 400,
      message: "Invalid login credentials",
    });

    assert.equal(noExiste, claveMal);
    assert.doesNotMatch(noExiste, /no existe|not found|no encontrad/i);
  });

  test("al entrar, los dos casos dan el mismo mensaje", async () => {
    const mensajes = [];
    for (const error of [
      { code: "user_not_found", status: 400, message: "User not found" },
      { code: "invalid_credentials", status: 400, message: "Invalid login credentials" },
    ]) {
      const red = servidor();
      red.respuestas.set("grant_type=password", () => [400, error]);
      const { auth } = await montar({ red });
      const r = await auth.entrar("alguien@example.com", "lo-que-sea");
      assert.equal(r.ok, false);
      mensajes.push(r.mensaje);
    }
    assert.equal(mensajes[0], mensajes[1]);
  });

  test("«ya registrado» tampoco se dice al crear la cuenta", async () => {
    /* La misma filtración, por la otra puerta: si el registro contesta
       «ese email ya existe», se averigua lo mismo. */
    const red = servidor();
    red.respuestas.set("/signup", () => [
      422,
      { code: "user_already_exists", message: "User already registered" },
    ]);
    const { auth } = await montar({ red });

    const r = await auth.registrarse("gustavo@example.com", "clave-larga-123");
    assert.equal(r.ok, false);
    assert.doesNotMatch(r.mensaje, /ya (existe|est|registrad)/i);
  });

  test("recuperar la contraseña contesta ok incluso si el email no existe", async () => {
    const red = servidor();
    red.respuestas.set("/recover", () => [
      400,
      { code: "user_not_found", message: "User not found" },
    ]);
    const { auth } = await montar({ red });

    const r = await auth.recuperarClave("no-existe@example.com");
    assert.equal(r.ok, true, "contestó distinto para un email que no existe");
  });

  test("pero un 429 sí se informa: sirve saber que hay que esperar", async () => {
    const red = servidor();
    red.respuestas.set("/recover", () => [
      429,
      { status: 429, message: "email rate limit exceeded" },
    ]);
    const { auth } = await montar({ red });

    const r = await auth.recuperarClave("gustavo@example.com");
    assert.equal(r.ok, false);
    assert.match(r.mensaje, /intentos|moment/i);
  });

  test("un fallo de red da un mensaje de red, no uno genérico", async () => {
    const { auth } = await montar({
      red: {
        llamadas: [],
        respuestas: new Map(),
        fetch: async () => {
          throw new TypeError("Failed to fetch");
        },
      },
    });

    const r = await auth.entrar("gustavo@example.com", "clave-larga-123");
    assert.equal(r.ok, false);
    assert.match(r.mensaje, /conect|conexi/i);
  });

  test("ningún mensaje muestra detalles técnicos", async () => {
    const { auth } = await montar();
    for (const m of Object.values(auth._interno.MENSAJES)) {
      assert.doesNotMatch(m, /[Ee]rror \d|null|undefined|40\d|50\d|JWT|token/);
      assert.ok(m.length > 10 && m.endsWith("."), `mensaje raro: ${m}`);
    }
  });
});

describe("la configuración", () => {
  test("sin configuración, el error dice qué falta y dónde", async () => {
    /* Y no revienta al importar: se puede usar `mensajeDeError` sin
       configuración, que es lo que permite mostrar un error en pantalla
       cuando justamente falta la configuración. */
    const { auth } = await montar({ config: null });

    assert.equal(typeof auth.mensajeDeError, "function");
    assert.throws(() => auth.clienteDeAuth(), /configuraci[oó]n de Supabase/i);
  });

  test("le pega a la URL del proyecto, con la clave en la cabecera", async () => {
    const red = servidor();
    const { auth } = await montar({ red });
    await auth.entrar("gustavo@example.com", "clave-larga-123");

    const llamada = red.llamadas.find((l) => l.url.includes("grant_type=password"));
    assert.ok(llamada, "no llamó a GoTrue");
    assert.ok(
      llamada.url.startsWith(`${URL_SUPABASE}/auth/v1/`),
      `URL inesperada: ${llamada.url}`,
    );
  });

  test("una URL con barra al final no genera una doble barra", async () => {
    const red = servidor();
    const { auth } = await montar({
      red,
      config: { supabaseUrl: `${URL_SUPABASE}/`, supabaseAnonKey: CLAVE },
    });
    await auth.entrar("gustavo@example.com", "clave-larga-123");

    const llamada = red.llamadas.find((l) => l.url.includes("grant_type=password"));
    assert.ok(llamada);
    assert.doesNotMatch(llamada.url.replace("https://", ""), /\/\//, llamada.url);
  });
});

describe("avisar cuando la sesión cambia", () => {
  test("avisa al entrar y al salir, también desde otra pestaña", async () => {
    /* Lo de «otra pestaña» es lo que evita que cerrar sesión en una deje
       la otra creyendo que sigue adentro. Lo implementa la librería
       escuchando el evento `storage`; acá se verifica que nuestro
       envoltorio no se coma el aviso. */
    const { auth } = await montar();
    const vistos = [];
    const dejar = auth.alCambiarLaSesion((estado) => vistos.push(estado.hay));

    await auth.entrar("gustavo@example.com", "clave-larga-123");
    await auth.salir();
    dejar();

    assert.ok(vistos.includes(true), `nunca avisó que había sesión: ${vistos}`);
    assert.ok(vistos.includes(false), `nunca avisó que se cerró: ${vistos}`);
  });

  test("dejar de escuchar deja de avisar", async () => {
    const { auth } = await montar();
    let avisos = 0;
    const dejar = auth.alCambiarLaSesion(() => (avisos += 1));
    dejar();
    const antes = avisos;

    await auth.entrar("gustavo@example.com", "clave-larga-123");
    assert.equal(avisos, antes, "siguió avisando después de desuscribirse");
  });
});

describe("registrarse", () => {
  test("con la confirmación apagada, entra directo", async () => {
    const { auth } = await montar();
    const r = await auth.registrarse("nuevo@example.com", "clave-larga-123");
    assert.equal(r.ok, true);
    assert.equal(r.falta_confirmar, undefined);
    assert.equal(await auth.haySesion(), true);
  });

  test("con la confirmación prendida, avisa que falta y no deja sesión", async () => {
    /* Hoy no pasa porque la confirmación está apagada, pero se prende en
       F16-T12 y entonces `signUp` devuelve `session: null`. Esta prueba
       está para que ese cambio no obligue a tocar `auth.js`: cuando
       llegue, el camino ya está probado. */
    const red = servidor();
    red.respuestas.set("/signup", () => [200, { user: sesionFalsa().user, session: null }]);
    const { auth } = await montar({ red });

    const r = await auth.registrarse("nuevo@example.com", "clave-larga-123");
    assert.equal(r.ok, true);
    assert.equal(r.falta_confirmar, true);
    assert.equal(await auth.haySesion(), false);
  });

  test("el email se recorta: un espacio pegado no crea otra cuenta", async () => {
    const red = servidor();
    const { auth } = await montar({ red });
    await auth.registrarse("  gustavo@example.com  ", "clave-larga-123");

    const llamada = red.llamadas.find((l) => l.url.includes("/signup"));
    assert.equal(llamada.cuerpo.email, "gustavo@example.com");
  });
});

describe("cambiar la contraseña o el email", () => {
  test("actualizarUsuario manda el cambio y devuelve el usuario", async () => {
    const red = servidor();
    const { auth } = await montar({
      almacenado: sesionFalsa({ vence_en: 3600 }),
      red,
    });

    const r = await auth.actualizarUsuario({ password: "otra-clave-larga" });
    assert.equal(r.ok, true, JSON.stringify(r));

    const llamada = red.llamadas.find((l) => l.metodo === "PUT" && l.url.includes("/user"));
    assert.ok(llamada, "no llamó a PUT /user");
    assert.equal(llamada.cuerpo.password, "otra-clave-larga");
  });

  test("una contraseña débil da el mensaje del mínimo", async () => {
    const red = servidor();
    red.respuestas.set("/user", () => [
      422,
      { code: "weak_password", message: "Password should be at least 8 characters" },
    ]);
    const { auth } = await montar({
      almacenado: sesionFalsa({ vence_en: 3600 }),
      red,
    });

    const r = await auth.actualizarUsuario({ password: "corta" });
    assert.equal(r.ok, false);
    assert.match(r.mensaje, /8 caracteres/);
  });
});

describe("lo que el resto de la aplicación no tiene que saber", () => {
  test("nadie más toca localStorage ni arma cabeceras de autenticación", async () => {
    /* La regla que mantiene esto en un solo archivo. Si otro módulo
       guardara la sesión o armara el `Bearer` por su cuenta, cambiar de
       proveedor dejaría de ser un cambio local, y un bug de sesión
       habría que buscarlo en varios lados. */
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const base = resolve(RAIZ, "web", "src", "js");

    const archivos = [];
    const recorrer = (dir) => {
      for (const n of readdirSync(dir)) {
        const p = resolve(dir, n);
        if (statSync(p).isDirectory()) {
          if (n !== "vendor") recorrer(p);
        } else if (n.endsWith(".js") && n !== "auth.js") {
          archivos.push(p);
        }
      }
    };
    recorrer(base);

    const culpables = [];
    for (const p of archivos) {
      const texto = readFileSync(p, "utf8");
      if (/epic-wallet-auth|supabaseAnonKey|Bearer \$\{/.test(texto)) {
        culpables.push(p.slice(base.length + 1));
      }
    }

    assert.deepEqual(
      culpables,
      [],
      `estos módulos manejan la sesión por su cuenta: ${culpables}`,
    );
  });
});
