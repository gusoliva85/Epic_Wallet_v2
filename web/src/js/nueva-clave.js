/* Pantalla de contraseña nueva · F11-T03
   Referencia: 01_Documento_General.md §48.1.3 · 02_Documento_Tecnico.md §8.5
   · skill §8 «Pantallas de cuenta»

   Se llega sólo por el enlace del correo de recuperación. El formulario
   está en `index.html` (`[data-cuenta="nueva-clave"]`), con sus tres
   estados ya escritos: verificando, enlace que no sirve, y los dos
   campos.

   ES LA ÚNICA PANTALLA QUE CAMBIA LA CONTRASEÑA SIN PEDIR LA ANTERIOR

   Y está bien que lo haga —quien llega acá justamente no se la
   acuerda—, pero sólo porque para llegar hay que haber abierto un
   enlace que se mandó a la casilla de esa cuenta. Ese es el segundo
   factor de esta pantalla. En `Ajustes` el cambio sí pide la anterior
   (`config-cuenta.js`) porque ahí no hubo ningún enlace de por medio.

   Dos piezas sostienen eso y ninguna es opcional:

   * `enlace-correo.js` marca «recuperación en curso» al encontrar el
     token en la URL;
   * `router.js` deja ver esta ruta con sesión abierta **sólo** con esa
     marca puesta. Sin ella, cualquier sesión olvidada en un teléfono
     desbloqueado sería la forma de cambiar la contraseña salteando el
     chequeo de `Ajustes`.

   POR QUÉ EL CANJE DEL TOKEN SE HACE ACÁ Y NO EN `enlace-correo.js`

   Porque el canje **crea una sesión**, y hacerlo durante el arranque
   lo pondría a correr mientras el enrutador todavía está decidiendo
   qué pantalla pintar — con la guardia de rutas leyendo la sesión en
   el medio. Acá se hace cuando la pantalla ya está en pantalla, que
   además es cuando hay dónde mostrar que algo salió mal. */

import {
  verificarEnlace,
  actualizarUsuario,
  haySesion,
  olvidarRecuperacion,
} from "./auth.js";
import { tomarEnlacePendiente } from "./enlace-correo.js";
import { navegar, EVENTO } from "./router.js";
import { INICIO, RECUPERAR, NUEVA_CLAVE } from "./nav.js";
import { conectarOjito } from "./acceso.js";
import { sincronizarTema } from "./preferencias.js";
import { toast } from "./components/toast.js";
import {
  MINIMO_CLAVE,
  mostrarFortaleza as pintarFortaleza,
  actualizarCoincidencia as compararClaves,
} from "./clave-ui.js";

/** @type {HTMLFormElement | null} */
let form = null;

function $(id) {
  return document.getElementById(id);
}

// ===================================================================
//  Los tres estados de la tarjeta
// ===================================================================

/** @param {"verificando" | "invalido" | "formulario"} cual */
function mostrarEstado(cual) {
  const verificando = $("nueva-verificando");
  const invalido = $("nueva-invalido");
  const bajada = $("nueva-bajada");
  if (verificando) verificando.hidden = cual !== "verificando";
  if (invalido) invalido.hidden = cual !== "invalido";
  if (form) form.hidden = cual !== "formulario";
  // La bajada dice «después de guardarla entrás directo»: con el
  // enlace que no sirve, eso es una promesa que no se va a cumplir.
  if (bajada) bajada.hidden = cual === "invalido";
}

/** @param {string | null} mensaje */
export function mostrarError(mensaje) {
  const caja = $("nueva-error");
  if (!caja) return;
  caja.textContent = mensaje ?? "";
  caja.hidden = !mensaje;
}

/** @param {boolean} cargando */
export function marcarCargando(cargando) {
  const boton = /** @type {HTMLButtonElement | null} */ ($("nueva-enviar"));
  if (!boton) return;
  boton.disabled = cargando;
  boton.classList.toggle("cargando", cargando);
  boton.setAttribute("aria-busy", String(cargando));
}

function mostrarFortaleza(clave) {
  pintarFortaleza(clave, {
    contenedor: $("nueva-fuerza"),
    barra: $("nueva-fuerza-barra"),
    texto: $("nueva-fuerza-texto"),
  });
}

function actualizarCoincidencia() {
  return compararClaves({
    campo: /** @type {HTMLInputElement | null} */ ($("nueva-clave1")),
    repetir: /** @type {HTMLInputElement | null} */ ($("nueva-clave2")),
    nota: $("nueva-coincide"),
  });
}

// ===================================================================
//  Canjear el enlace
// ===================================================================

/* Una sola vez por carga: el token es de un solo uso, así que volver a
   entrar a la ruta no puede intentar canjearlo de nuevo. */
let preparado = false;

/**
 * Deja la tarjeta en el estado que corresponda según lo que haya
 * traído el enlace.
 *
 * Tres caminos, en este orden:
 *
 * 1. **Hay un `token_hash` pendiente** (plantilla con `{{ .TokenHash }}`,
 *    Técnico §8.5): se canjea acá y queda la sesión abierta.
 * 2. **Ya hay sesión** y no hay token: o el canje lo hizo la librería
 *    con la plantilla de fábrica (`?code=…`), o se recargó la página a
 *    mitad del flujo. En los dos casos no hay nada que canjear.
 * 3. **Ninguna de las dos:** el enlace venció, ya se usó, o alguien
 *    escribió la ruta a mano. Se ofrece pedir otro.
 */
export async function preparar() {
  if (preparado) return;
  preparado = true;

  mostrarEstado("verificando");

  const pendiente = tomarEnlacePendiente();
  if (pendiente) {
    const r = await verificarEnlace(pendiente.hash, /** @type {any} */ (pendiente.tipo));
    if (!r.ok) {
      // El token no se reintenta: ya se consumió al pedirlo, y si el
      // servidor lo rechazó, volver a mandarlo da el mismo rechazo.
      olvidarRecuperacion();
      mostrarEstado("invalido");
      return;
    }
    mostrarEstado("formulario");
    $("nueva-clave1")?.focus();
    return;
  }

  if (await haySesion()) {
    mostrarEstado("formulario");
    $("nueva-clave1")?.focus();
    return;
  }

  olvidarRecuperacion();
  mostrarEstado("invalido");
}

// ===================================================================
//  Guardar
// ===================================================================

let enviando = false;

/** @param {SubmitEvent} evento */
export async function alEnviar(evento) {
  evento.preventDefault();
  if (enviando) return;

  const clave = /** @type {HTMLInputElement} */ ($("nueva-clave1"));
  const clave2 = /** @type {HTMLInputElement} */ ($("nueva-clave2"));
  if (!clave || !clave2) return;

  mostrarError(null);

  if (!clave.value || !clave2.value) {
    mostrarError("Completá los dos campos.");
    (!clave.value ? clave : clave2).focus();
    return;
  }
  if (clave.value.length < MINIMO_CLAVE) {
    mostrarError(`La contraseña tiene que tener al menos ${MINIMO_CLAVE} caracteres.`);
    clave.focus();
    return;
  }
  if (clave.value !== clave2.value) {
    mostrarError("Las contraseñas no coinciden.");
    clave2.focus();
    clave2.select();
    return;
  }

  enviando = true;
  marcarCargando(true);

  try {
    const r = await actualizarUsuario({ password: clave.value });

    if (!r.ok) {
      mostrarError(r.mensaje);
      return;
    }

    // Las dos contraseñas se borran del campo antes de cualquier otra
    // cosa, mismo motivo que en el login y el registro: el formulario
    // sigue en el DOM y una contraseña en el valor de un input queda al
    // alcance de cualquier extensión.
    clave.value = "";
    clave2.value = "";

    // La recuperación terminó. Si la marca quedara puesta, recargar
    // más tarde volvería a abrir esta pantalla con la sesión normal, y
    // ahí sí sería un cambio de contraseña sin pedir la anterior.
    olvidarRecuperacion();

    // Mismo punto que en `acceso.js`: el enlace del correo se puede
    // abrir en un dispositivo que nunca vio esta cuenta, así que es
    // acá donde se entera de la preferencia de tema. No se espera.
    void sincronizarTema();

    toast("Contraseña actualizada.");
    navegar(INICIO);
  } catch (e) {
    mostrarError("Algo no funcionó. Intentá de nuevo en un momento.");
    console.error("nueva-clave: error inesperado al guardar", e);
  } finally {
    enviando = false;
    marcarCargando(false);
  }
}

// ===================================================================

export function arrancar() {
  form = /** @type {HTMLFormElement | null} */ ($("form-nueva-clave"));
  if (!form) return;

  if (form.dataset.conectado === "si") return;
  form.dataset.conectado = "si";

  const ojo1 = /** @type {HTMLButtonElement | null} */ ($("nueva-ojo"));
  const clave1 = /** @type {HTMLInputElement | null} */ ($("nueva-clave1"));
  if (ojo1 && clave1) conectarOjito(ojo1, clave1);

  const ojo2 = /** @type {HTMLButtonElement | null} */ ($("nueva-ojo2"));
  const clave2 = /** @type {HTMLInputElement | null} */ ($("nueva-clave2"));
  if (ojo2 && clave2) conectarOjito(ojo2, clave2);

  if (clave1) {
    clave1.addEventListener("input", () => {
      mostrarFortaleza(clave1.value);
      actualizarCoincidencia();
    });
  }
  if (clave2) clave2.addEventListener("input", actualizarCoincidencia);

  form.addEventListener("submit", alEnviar);
  form.addEventListener("input", () => mostrarError(null));

  $("nueva-pedir-otro")?.addEventListener("click", () => {
    // Se suelta la marca antes de irse: lo que quede de este intento no
    // tiene que dejar la puerta entornada para el que viene.
    olvidarRecuperacion();
    navegar(RECUPERAR);
  });

  /* El canje se dispara cuando la ruta se activa, no al importar: el
     módulo se carga en todas las páginas y la gran mayoría de las
     veces esta pantalla no se abre nunca. Se escucha `epic:ruta` y no
     se lee el hash (skill §7). */
  document.addEventListener(EVENTO, (evento) => {
    if (/** @type {CustomEvent} */ (evento).detail?.id === NUEVA_CLAVE) {
      void preparar();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", arrancar);
} else {
  arrancar();
}
