/* Autenticación · F02-T08
   Referencia: 02_Documento_Tecnico.md §8.7 y §8.11

   Este archivo es el único lugar del frontend que sabe de Supabase.
   Todo lo demás le pide un token o le pregunta si hay sesión; nadie
   más toca `localStorage`, ni arma cabeceras, ni sabe cómo se renueva
   nada. Cuando algún día haya que cambiar de proveedor, se cambia acá.

   POR QUÉ UNA LIBRERÍA Y NO SEIS `fetch`

   La API de GoTrue son seis endpoints simples y la tentación de
   escribirlos a mano fue real: serían unas doscientas líneas y cuatro
   kilobytes en vez de cien. Lo que no es simple es lo de alrededor, y
   es justo lo que pide el criterio de aceptación: renovar el token
   antes de que venza sin que el usuario note nada, sin pedir dos
   renovaciones a la vez cuando llegan dos peticiones juntas, y sin que
   dos pestañas abiertas se pisen la sesión. Eso ya está resuelto y
   probado en `@supabase/auth-js`.

   La librería está empaquetada en `vendor/auth-js.js` porque el
   proyecto no usa empaquetador y la CSP no deja traerla de un CDN; el
   porqué completo está en `scripts/preparar-auth.mjs`.

   DE DÓNDE SALEN LA URL Y LA CLAVE

   De `window.EPIC_WALLET`, que define `web/public/config.js`, generado
   en el build a partir del entorno. No se importa un módulo de
   configuración porque este archivo también corre en las pruebas, y un
   `import` de algo que sólo existe después del build las ataría al
   build. Un global que se puede poner a mano es más fácil de probar.

   La clave que va ahí es la **anónima**, que está pensada para viajar
   en el navegador: no da acceso a nada por sí sola, porque del otro
   lado está RLS. La clave de servicio no entra nunca, y hay una prueba
   que lo verifica sobre los archivos publicados. */

import { GoTrueClient } from "./vendor/auth-js.js";

/* Nombre de la entrada en `localStorage`. Lleva el proyecto adentro
   para que dos aplicaciones en el mismo dominio no se pisen, y para
   que cambiarlo invalide las sesiones viejas si alguna vez hace
   falta. */
const CLAVE_DE_SESION = "epic-wallet-auth";

/* Margen con el que se pide el token nuevo antes de que venza. La
   librería renueva sola, pero `token()` además lo fuerza si lo que
   tiene en mano está por vencerse: una petición que sale con un token
   que vence en dos segundos puede llegar vencida. */
const MARGEN_DE_RENOVACION = 60; // segundos

/** Mensajes para el usuario.
 *
 * Están acá y no en la pantalla por una razón concreta del criterio de
 * aceptación de F02-T09: **ninguno revela si el email existe.**
 * Supabase responde distinto para «no existe» y «contraseña
 * equivocada», y pasar eso tal cual a la pantalla convierte el
 * formulario de ingreso en un verificador de cuentas. Los dos casos
 * dicen lo mismo.
 */
const MENSAJES = {
  credenciales: "El email o la contraseña no son correctos.",
  sin_confirmar: "Falta confirmar la cuenta. Revisá tu correo.",
  demasiados: "Demasiados intentos. Esperá un momento y volvé a probar.",
  red: "No se pudo conectar. Revisá tu conexión e intentá de nuevo.",
  debil: "La contraseña tiene que tener al menos 8 caracteres.",
  ya_existe: "No se pudo crear la cuenta con esos datos.",
  generico: "Algo no funcionó. Intentá de nuevo en un momento.",
};

/** Traduce un error de Supabase a algo que se le pueda mostrar a una
 * persona, sin filtrar qué cuentas existen.
 *
 * @param {unknown} error
 * @returns {string}
 */
export function mensajeDeError(error) {
  if (!error) return MENSAJES.generico;

  const e = /** @type {any} */ (error);

  // Tres nombres para lo mismo, y hace falta mirar los tres: GoTrue
  // manda `error_code` en el cuerpo, la librería lo expone a veces como
  // `code`, y cuando no lo reconoce no lo expone en ninguno. Se vio en
  // las pruebas: un `user_not_found` llegaba sin código y caía en el
  // mensaje genérico, que es el peor de los dos mundos —no ayuda al
  // usuario y además suena a falla nuestra.
  const codigo = String(e.code ?? e.error_code ?? e.error ?? "");
  const estado = Number(e.status ?? 0);
  const texto = String(e.message ?? e.msg ?? "").toLowerCase();

  // Los dos casos que no se distinguen a propósito: «no existe el
  // usuario» y «contraseña incorrecta» comparten respuesta.
  //
  // GoTrue hoy ya contesta `invalid_credentials` para los dos, pero eso
  // es una decisión suya que puede cambiar, y la que no tiene que
  // cambiar es la nuestra. Por eso `user_not_found` sigue en la lista.
  if (
    codigo === "invalid_credentials" ||
    codigo === "user_not_found" ||
    texto.includes("invalid login credentials") ||
    texto.includes("invalid credentials") ||
    texto.includes("user not found")
  ) {
    return MENSAJES.credenciales;
  }

  if (codigo === "email_not_confirmed" || texto.includes("not confirmed")) {
    return MENSAJES.sin_confirmar;
  }
  if (estado === 429 || codigo === "over_request_rate_limit") {
    return MENSAJES.demasiados;
  }
  if (codigo === "weak_password" || texto.includes("password should be at least")) {
    return MENSAJES.debil;
  }
  // «Ya registrado» tampoco se dice: sería la misma filtración por la
  // puerta del registro.
  if (codigo === "user_already_exists" || texto.includes("already registered")) {
    return MENSAJES.ya_existe;
  }
  // Sin `status` y sin `code` casi siempre es la red: `fetch` falló
  // antes de llegar.
  if (!estado && !codigo) return MENSAJES.red;

  return MENSAJES.generico;
}

/** La configuración que dejó el build.
 * @returns {{url: string, anon: string}}
 */
function configuracion() {
  const c = /** @type {any} */ (globalThis).EPIC_WALLET ?? {};
  const url = String(c.supabaseUrl ?? "").trim();
  const anon = String(c.supabaseAnonKey ?? "").trim();
  if (!url || !anon) {
    throw new Error(
      "Falta la configuración de Supabase. `web/public/config.js` lo genera " +
        "el build a partir de SUPABASE_URL y SUPABASE_ANON_KEY.",
    );
  }
  return { url, anon };
}

/* El cliente se crea la primera vez que alguien lo pide y no al
   importar el módulo. Si se creara al importar, cualquier archivo que
   importe algo de acá —aunque sea sólo `mensajeDeError`— reventaría
   cuando falta la configuración, y en las pruebas haría falta el
   global siempre. */
let cliente = /** @type {GoTrueClient | null} */ (null);

/** @returns {GoTrueClient} */
export function clienteDeAuth() {
  if (cliente) return cliente;
  const { url, anon } = configuracion();
  cliente = new GoTrueClient({
    url: `${url.replace(/\/+$/, "")}/auth/v1`,
    headers: { apikey: anon, Authorization: `Bearer ${anon}` },

    // Los tres que hacen al criterio de aceptación.
    //
    // `persistSession` guarda en `localStorage`, que sobrevive a
    // recargar y a cerrar la aplicación instalada —`sessionStorage` no
    // sobreviviría a lo segundo—.
    persistSession: true,
    storageKey: CLAVE_DE_SESION,

    // `autoRefreshToken` pone el temporizador que renueva antes del
    // vencimiento. Es lo que hace que el usuario no note nada.
    autoRefreshToken: true,

    // Y esto es lo que lee el token del enlace cuando se vuelve de un
    // correo de recuperación (F16-T13). Va en `true` desde ahora para
    // que la sesión de ese enlace no se pierda en silencio.
    detectSessionInUrl: true,
    flowType: "pkce",
  });
  return cliente;
}

/** Sólo para las pruebas: olvida el cliente creado.
 *
 * Existe porque el cliente es un singleton por módulo y en una suite
 * hay que poder cambiar la configuración entre casos. No lo usa nada de
 * la aplicación.
 */
export function _reiniciar() {
  cliente = null;
}

// ===================================================================
//  Entrar, salir, registrarse
// ===================================================================

/**
 * @typedef {{ok: true, usuario: {id: string, email: string | null}}} Exito
 * @typedef {{ok: false, mensaje: string, codigo?: string}} Falla
 */

/** @param {unknown} error @returns {Falla} */
function falla(error) {
  return {
    ok: false,
    mensaje: mensajeDeError(error),
    codigo: String(/** @type {any} */ (error)?.code ?? "") || undefined,
  };
}

/** @param {{id: string, email?: string | null}} u @returns {Exito} */
function exito(u) {
  return { ok: true, usuario: { id: u.id, email: u.email ?? null } };
}

/**
 * Crea una cuenta y deja la sesión abierta.
 *
 * Entra directo al tablero porque la confirmación por correo está
 * apagada (se activa en F16-T12). Cuando se active, `data.session`
 * llega en `null` y hay que mandar a «revisá tu correo»; el `if` de
 * abajo ya distingue los dos casos para que ese cambio no obligue a
 * tocar esto.
 *
 * @param {string} email
 * @param {string} clave
 * @returns {Promise<Exito | Falla | {ok: true, falta_confirmar: true}>}
 */
export async function registrarse(email, clave) {
  try {
    const { data, error } = await clienteDeAuth().signUp({
      email: email.trim(),
      password: clave,
    });
    if (error) return falla(error);
    if (!data.session) return { ok: true, falta_confirmar: true };
    return exito(data.user ?? { id: "" });
  } catch (e) {
    return falla(e);
  }
}

/**
 * @param {string} email
 * @param {string} clave
 * @returns {Promise<Exito | Falla>}
 */
export async function entrar(email, clave) {
  try {
    const { data, error } = await clienteDeAuth().signInWithPassword({
      email: email.trim(),
      password: clave,
    });
    if (error) return falla(error);
    return exito(data.user);
  } catch (e) {
    return falla(e);
  }
}

/**
 * Cierra la sesión y borra lo guardado.
 *
 * No devuelve el error al que llama: si el servidor no contesta, la
 * sesión local se borra igual. Un «cerrar sesión» que falla y deja al
 * usuario adentro es peor que uno que cierra de más.
 *
 * @returns {Promise<void>}
 */
export async function salir() {
  try {
    await clienteDeAuth().signOut();
  } catch {
    // Ignorado a propósito, ver arriba.
  }
  try {
    globalThis.localStorage?.removeItem(CLAVE_DE_SESION);
  } catch {
    // `localStorage` puede no estar (modo privado, o jsdom sin
    // almacenamiento). No es motivo para dejar de cerrar sesión.
  }
}

/**
 * Pide el correo para restablecer la contraseña.
 *
 * Devuelve `ok` incluso cuando el email no existe, y no es un
 * descuido: contestar distinto convertiría esta pantalla en un
 * verificador de cuentas. Supabase ya responde igual en los dos casos;
 * acá se mantiene.
 *
 * @param {string} email
 * @param {string} [volverA] URL a la que lleva el enlace del correo.
 * @returns {Promise<{ok: true} | Falla>}
 */
export async function recuperarClave(email, volverA) {
  try {
    const { error } = await clienteDeAuth().resetPasswordForEmail(email.trim(), {
      redirectTo: volverA ?? `${globalThis.location?.origin ?? ""}/#/clave-nueva`,
    });
    // Un 429 sí se informa: es útil saber que hay que esperar.
    if (error && Number(/** @type {any} */ (error).status) === 429) return falla(error);
    return { ok: true };
  } catch (e) {
    return falla(e);
  }
}

/**
 * Cambia la contraseña o el email de la sesión abierta.
 *
 * @param {{password?: string, email?: string}} cambios
 * @returns {Promise<Exito | Falla>}
 */
export async function actualizarUsuario(cambios) {
  try {
    const { data, error } = await clienteDeAuth().updateUser(cambios);
    if (error) return falla(error);
    return exito(data.user);
  } catch (e) {
    return falla(e);
  }
}

// ===================================================================
//  El token
// ===================================================================

/**
 * El token con el que hablarle a nuestra API, renovado si hace falta.
 *
 * Devuelve `null` cuando no hay sesión, y el que llama decide qué
 * hacer con eso. No redirige ni lanza: esta función no sabe si quien
 * la llama está pintando una pantalla o haciendo una petición de
 * fondo.
 *
 * Por qué fuerza la renovación en vez de confiar en el temporizador:
 * el temporizador de la librería no corre mientras la pestaña está
 * dormida, y al volver puede haber un token vencido o a punto. Con un
 * margen de un minuto, lo que sale a la red siempre tiene vida por
 * delante.
 *
 * @returns {Promise<string | null>}
 */
export async function token() {
  let sesion;
  try {
    const { data, error } = await clienteDeAuth().getSession();
    if (error) return null;
    sesion = data.session;
  } catch {
    return null;
  }
  if (!sesion) return null;

  const vence = Number(sesion.expires_at ?? 0);
  const ahora = Math.floor(Date.now() / 1000);
  if (vence && vence - ahora > MARGEN_DE_RENOVACION) {
    return sesion.access_token;
  }

  // Está vencido o por vencer. `refreshSession` de la librería
  // deduplica las llamadas simultáneas, así que dos peticiones a la vez
  // no piden dos renovaciones.
  try {
    const { data, error } = await clienteDeAuth().refreshSession();
    if (error || !data.session) return null;
    return data.session.access_token;
  } catch {
    return null;
  }
}

/**
 * Las cabeceras para una petición a nuestra API, o `null` sin sesión.
 *
 * Está acá para que ningún otro archivo tenga que saber que el token
 * va en `Authorization: Bearer`.
 *
 * @returns {Promise<{Authorization: string} | null>}
 */
export async function cabeceras() {
  const t = await token();
  return t ? { Authorization: `Bearer ${t}` } : null;
}

/**
 * El usuario de la sesión guardada, sin ir a la red.
 *
 * Sirve para decidir qué pantalla mostrar al arrancar sin esperar una
 * petición. Que haya sesión guardada no garantiza que siga siendo
 * válida; de eso se encarga el 401 de la API.
 *
 * @returns {Promise<{id: string, email: string | null} | null>}
 */
export async function usuarioActual() {
  try {
    const { data } = await clienteDeAuth().getSession();
    const u = data.session?.user;
    return u ? { id: u.id, email: u.email ?? null } : null;
  } catch {
    return null;
  }
}

/** @returns {Promise<boolean>} */
export async function haySesion() {
  return (await usuarioActual()) !== null;
}

/**
 * Avisa cuando la sesión cambia: entrar, salir, token renovado.
 *
 * Incluye los cambios hechos en **otra pestaña**, porque la librería
 * escucha el `storage` del navegador. Es lo que evita que cerrar
 * sesión en una pestaña deje la otra creyendo que sigue adentro.
 *
 * @param {(estado: {hay: boolean, usuario: {id: string, email: string | null} | null}) => void} alCambiar
 * @returns {() => void} para dejar de escuchar
 */
export function alCambiarLaSesion(alCambiar) {
  const { data } = clienteDeAuth().onAuthStateChange((_evento, sesion) => {
    const u = sesion?.user;
    alCambiar({
      hay: Boolean(sesion),
      usuario: u ? { id: u.id, email: u.email ?? null } : null,
    });
  });
  return () => data.subscription.unsubscribe();
}

export const _interno = { CLAVE_DE_SESION, MARGEN_DE_RENOVACION, MENSAJES };
