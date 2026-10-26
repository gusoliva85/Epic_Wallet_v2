/* Los enlaces que llegan por correo · F11-T03
   Referencia: 02_Documento_Tecnico.md §8.5, §8.6 · 01_Documento_General.md
   §48.1.1, §48.1.3

   Este módulo mira la URL una sola vez, al cargar, y decide qué hacer
   con lo que trajo el enlace del mail. Es el único que sabe cómo viene
   armado ese enlace; `nueva-clave.js` y el enrutador no tienen que
   saberlo.

   POR QUÉ UN MÓDULO APARTE Y NO DENTRO DEL ENRUTADOR

   Porque el enlace del correo **cambia la ruta** antes de que el
   enrutador decida nada. Mezclar las dos cosas sería poner al
   enrutador a leer parámetros de autenticación, y la próxima vez que
   cambie la forma del enlace habría que tocar la pieza que decide qué
   pantalla se ve.

   LAS DOS FORMAS DE ENLACE QUE SE ACEPTAN

   1. **`token_hash` (la que se configura, Técnico §8.5).** La
      plantilla manda a `…/?token_hash=XXX&type=recovery#/nueva-clave`
      y acá se canjea con `verifyOtp`. Vale desde cualquier navegador,
      una sola vez, y vence.

   2. **`code` (la de fábrica, `{{ .ConfirmationURL }}`).** El enlace
      pasa por `/auth/v1/verify` de Supabase y vuelve con `?code=…`.
      Ese canje lo hace sola la librería (`detectSessionInUrl` en
      `auth.js`), así que acá **no se toca el parámetro**: sólo se
      anota que esto es una recuperación, para que la guardia de rutas
      deje entrar a la pantalla.

   La segunda se acepta porque es la que queda si alguna plantilla se
   deja sin personalizar, y dejarla fallar en silencio sería el peor
   resultado posible: un enlace de recuperación que no lleva a ninguna
   parte. Pero tiene un límite real que la primera no tiene —PKCE
   guarda su verificador en el navegador que pidió el enlace, así que
   pedirlo en el celular y abrirlo en la PC no funciona—, y por eso la
   forma recomendada es la primera.

   QUÉ SE LIMPIA DE LA URL Y POR QUÉ

   El `token_hash` se saca de la barra de direcciones en cuanto se lee,
   con `replaceState`: es una credencial de un solo uso y no tiene por
   qué quedar en el historial del navegador, ni viajar en el
   `Referer`, ni aparecer en una captura de pantalla de la URL. */

import {
  verificarEnlace,
  marcarRecuperacion,
  olvidarRecuperacion,
  mensajeDeError,
} from "./auth.js";
import { navegar } from "./router.js";
import { INICIO, LOGIN, NUEVA_CLAVE } from "./nav.js";
import { toast } from "./components/toast.js";

/** Los tipos de enlace que Supabase puede mandar. Lista cerrada: lo
 * que no esté acá no se canjea, para no pasarle a `verifyOtp` un
 * `type` que venga de la URL sin pasar por ningún filtro. */
const TIPOS = [
  "recovery",
  "signup",
  "email",
  "email_change",
  "magiclink",
  "invite",
];

/* Lo que trajo el enlace, guardado hasta que alguien lo consuma.
   `nueva-clave.js` lo pide cuando su pantalla se activa, no antes: si
   se canjeara acá mismo, el canje —que crea una sesión— correría
   mientras el enrutador todavía está decidiendo qué pintar. */
let pendiente = /** @type {{hash: string, tipo: string} | null} */ (null);

/** El `token_hash` que todavía no se canjeó, o `null`.
 *
 * Lo devuelve **y lo olvida**: un token de un solo uso no puede quedar
 * disponible para un segundo intento. Si el canje falla, la pantalla
 * muestra el error y pide un enlace nuevo; no reintenta con el mismo.
 */
export function tomarEnlacePendiente() {
  const p = pendiente;
  pendiente = null;
  return p;
}

/** @param {string} hash @returns {string} */
function hashLimpio(hash) {
  // Un hash que ya es una ruta nuestra se respeta; cualquier otra cosa
  // (vacío, o lo que haya dejado Supabase) se descarta.
  return /^#\/[a-z-]+$/.test(hash) ? hash : "";
}

/** Corrige el hash **sin pintar nada**.
 *
 * `navegar()` del enrutador pinta en el acto, y acá eso sería pintar
 * antes de que la guardia de rutas haya opinado. Lo único que hace
 * falta mientras el enrutador todavía no arrancó es dejar el hash en
 * su lugar: después arranca él, lo lee y decide como siempre.
 *
 * @param {string} id
 */
function fijarRuta(id) {
  try {
    globalThis.history?.replaceState(null, "", `#/${id}`);
  } catch {
    globalThis.location.hash = `#/${id}`;
  }
}

/** Saca de la URL los parámetros de autenticación, dejando la ruta.
 * @param {string[]} nombres
 */
function limpiarURL(nombres) {
  try {
    const url = new URL(globalThis.location.href);
    for (const n of nombres) url.searchParams.delete(n);
    const busqueda = url.searchParams.toString();
    const destino =
      url.pathname + (busqueda ? `?${busqueda}` : "") + globalThis.location.hash;
    globalThis.history?.replaceState(null, "", destino);
  } catch {
    // Sin `history` (o con una URL que no se puede reconstruir) el
    // token queda en la barra de direcciones. Es una molestia, no un
    // motivo para abandonar el flujo.
  }
}

/** Mensaje de error sobre la tarjeta de login, sin importar `acceso.js`
 * —que es dueño del formulario, no de esta caja— para no atar el
 * arranque de este módulo al de aquél. */
function errorEnLogin(mensaje) {
  const caja = globalThis.document?.getElementById("login-error");
  if (!caja) return;
  caja.textContent = mensaje;
  caja.hidden = false;
}

// ===================================================================

/**
 * Lee la URL y prepara el terreno. Devuelve lo que haya que hacer
 * después, para que el que llama decida si lo espera.
 *
 * La parte que importa —marcar la recuperación y corregir el hash— es
 * **sincrónica**, porque tiene que estar hecha antes de que el
 * enrutador pregunte qué ruta corresponde.
 *
 * @returns {Promise<void> | null}
 */
export function arrancar() {
  const loc = globalThis.location;
  if (!loc) return null;

  let params;
  try {
    params = new URL(loc.href).searchParams;
  } catch {
    return null;
  }

  // ── Un enlace que Supabase ya rechazó ───────────────────────────
  // Pasa con la plantilla de fábrica: la verificación la hace el
  // servidor y vuelve con el error en la URL. Hay que leerlo del hash
  // además de la búsqueda, porque según el flujo lo manda en uno o en
  // el otro —y en el caso del hash, encima, se lleva puesta la ruta.
  const hashParams = new URLSearchParams(
    loc.hash.startsWith("#") ? loc.hash.slice(1) : loc.hash,
  );
  // `error_code` es el preciso, pero no siempre viene: `error` solo
  // («access_denied») también significa que el enlace no sirvió.
  const error =
    params.get("error_code") ??
    hashParams.get("error_code") ??
    params.get("error") ??
    hashParams.get("error");
  if (error) {
    olvidarRecuperacion();
    limpiarURL(["error", "error_code", "error_description"]);
    if (!hashLimpio(loc.hash)) fijarRuta(LOGIN);
    errorEnLogin(
      mensajeDeError({
        code: error,
        message:
          params.get("error_description") ??
          hashParams.get("error_description") ??
          "",
      }),
    );
    return null;
  }

  const tipo = params.get("type") ?? "";
  const hash = params.get("token_hash");

  // ── Forma 2: `code`, el canje lo hace la librería ────────────────
  // No se toca el parámetro. Lo único que hace falta es la marca, para
  // que la guardia deje ver la pantalla cuando el canje cree la sesión.
  if (!hash && params.get("code")) {
    if (loc.hash === `#/${NUEVA_CLAVE}` || tipo === "recovery") {
      marcarRecuperacion();
      if (loc.hash !== `#/${NUEVA_CLAVE}`) fijarRuta(NUEVA_CLAVE);
    }
    return null;
  }

  if (!hash || !TIPOS.includes(tipo)) return null;

  limpiarURL(["token_hash", "type"]);

  // ── Recuperación: el canje es de la pantalla ─────────────────────
  if (tipo === "recovery") {
    pendiente = { hash, tipo };
    marcarRecuperacion();
    // La plantilla ya manda a `#/nueva-clave`, pero si alguien la
    // dejó apuntando a la raíz el token igual no se pierde.
    if (loc.hash !== `#/${NUEVA_CLAVE}`) fijarRuta(NUEVA_CLAVE);
    return null;
  }

  // ── Confirmar una cuenta nueva (o un cambio de correo) ───────────
  // Acá sí se canjea en el momento: no hay ninguna pantalla propia
  // esperando este token, el resultado es simplemente que la cuenta
  // quedó confirmada y la sesión abierta.
  return (async () => {
    const r = await verificarEnlace(hash, /** @type {any} */ (tipo));
    if (!r.ok) {
      navegar(LOGIN, { reemplazar: true });
      errorEnLogin(r.mensaje);
      return;
    }
    toast(
      tipo === "email_change" ? "Correo confirmado." : "Cuenta confirmada.",
    );
    navegar(INICIO, { reemplazar: true });
  })();
}

/* Se arranca al importarse, como el resto de los módulos de pantalla,
   y **antes** que `app.js` según el orden del `index.html`: el
   enrutador tiene que encontrar el hash y la marca ya en su lugar. */
void arrancar();
