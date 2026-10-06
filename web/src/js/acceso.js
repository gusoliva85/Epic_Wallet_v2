/* Pantalla de inicio de sesión · F02-T09
   Referencia: 01_Documento_General.md §48.1 · 02_Documento_Tecnico.md §8.9
   · skill §8 «Pantallas de cuenta»

   El formulario está en `index.html`. Acá va sólo lo que se mueve: el
   ojito, el estado de carga, el mensaje de error y qué pasa al entrar.

   Lo que este archivo NO hace, y es a propósito:

   * **No decide si hay que mostrar la pantalla.** Eso es del enrutador
     (`#/login`) y, cuando exista, de la guardia de F02-T12. Si acá se
     mirara la sesión para mostrarse o esconderse, habría dos lugares
     decidiendo lo mismo y tarde o temprano discreparían.
   * **No sabe de Supabase.** Habla con `auth.js`, que es el único que
     sabe. Los mensajes de error también salen de ahí: están en un solo
     lugar porque hay uno que no se puede equivocar —el de credenciales
     incorrectas— y no conviene tenerlo escrito dos veces. */

import { entrar } from "./auth.js";
import { navegar } from "./router.js";
import { INICIO } from "./nav.js";
import { icono } from "./iconos.js";

/* Lo que se tarda, como mínimo, en contestar «credenciales
   incorrectas». Sin esto, un intento con un correo que no existe falla
   notablemente más rápido que uno con la contraseña mal, y la
   diferencia de tiempo cuenta lo mismo que contaría un mensaje
   distinto: con qué correos hay cuenta. Es el agujero que queda después
   de igualar los textos.

   350 ms es más que la diferencia que se midió y poco para que se note
   al usarlo. */
const PISO_DE_RESPUESTA = 350;

/** @type {HTMLFormElement | null} */
let form = null;

function $(id) {
  return document.getElementById(id);
}

// ===================================================================
//  El ojito
// ===================================================================

/**
 * Conecta un botón de mostrar y ocultar a su campo de contraseña.
 *
 * Escribir una contraseña a ciegas en un teléfono es la principal causa
 * de errores de tipeo, y en una pantalla donde un error de tipeo da
 * «credenciales incorrectas» —el mismo mensaje que una cuenta que no
 * existe— alguien puede llegar a creer que perdió el acceso.
 *
 * @param {HTMLButtonElement} boton
 * @param {HTMLInputElement} campo
 */
export function conectarOjito(boton, campo) {
  const dibujar = () => {
    const visible = campo.type === "text";
    const svg = boton.querySelector("svg");
    // El icono muestra qué va a pasar al tocarlo, no el estado actual:
    // con la contraseña oculta se ofrece «ver», así que va el ojo
    // abierto. Al revés confunde a la mitad de la gente y no hay
    // acuerdo en la industria; lo que no se puede es depender sólo del
    // dibujo, y de eso se ocupa el `aria-label`.
    if (svg) svg.innerHTML = icono(visible ? "ojo_tachado" : "ojo");
    boton.setAttribute(
      "aria-label",
      visible ? "Ocultar contraseña" : "Mostrar contraseña",
    );
    boton.setAttribute("aria-pressed", String(visible));
  };

  boton.addEventListener("click", () => {
    const visible = campo.type === "text";
    campo.type = visible ? "password" : "text";
    dibujar();

    // El foco vuelve al campo y el cursor al final. Sin esto, mostrar
    // la contraseña para revisarla obliga a volver a tocar el campo, y
    // en algunos teclados móviles se pierde el cursor.
    campo.focus();
    const n = campo.value.length;
    try {
      campo.setSelectionRange(n, n);
    } catch {
      // Algunos tipos de campo no admiten selección. No es motivo para
      // que falle el ojito.
    }
  });

  dibujar();
  return { dibujar };
}

// ===================================================================
//  Error y carga
// ===================================================================

/** @param {string | null} mensaje */
export function mostrarError(mensaje) {
  const caja = $("login-error");
  if (!caja) return;
  // `textContent` y no `innerHTML`: el mensaje sale de una lista
  // nuestra, pero este es el camino por el que algún día va a llegar
  // texto del servidor, y acá no hay nada que ganar escribiendo HTML.
  caja.textContent = mensaje ?? "";
  caja.hidden = !mensaje;
}

/**
 * Pone o saca el estado de carga del botón.
 *
 * `disabled` es lo que impide el envío doble, y hace falta además de
 * la bandera de `enviando`: un segundo toque en el medio del primero
 * dispara otro `submit` antes de que nada lo frene.
 *
 * El texto no se reemplaza por «Ingresando…», se deja y se superpone
 * el girador: cambiarlo mueve el ancho del botón y la pantalla salta
 * justo cuando el usuario está esperando.
 *
 * @param {boolean} cargando
 */
export function marcarCargando(cargando) {
  const boton = /** @type {HTMLButtonElement | null} */ ($("login-enviar"));
  if (!boton) return;
  boton.disabled = cargando;
  boton.classList.toggle("cargando", cargando);
  // `aria-busy` para que un lector anuncie que está trabajando: el
  // girador es puramente visual.
  boton.setAttribute("aria-busy", String(cargando));
}

// ===================================================================
//  Entrar
// ===================================================================

let enviando = false;

/** Espera lo que falte para llegar al piso de respuesta. */
async function esperarElPiso(desde) {
  const falta = PISO_DE_RESPUESTA - (Date.now() - desde);
  if (falta > 0) await new Promise((listo) => setTimeout(listo, falta));
}

/** @param {SubmitEvent} evento */
export async function alEnviar(evento) {
  evento.preventDefault();
  if (enviando) return;

  const email = /** @type {HTMLInputElement} */ ($("login-email"));
  const clave = /** @type {HTMLInputElement} */ ($("login-clave"));
  if (!email || !clave) return;

  mostrarError(null);

  // Validación mínima y nuestra, no la del navegador: `novalidate` en
  // el formulario está para que el globo nativo no aparezca con un
  // texto en inglés y en la tipografía del sistema, al lado de un
  // mensaje nuestro en español que dice otra cosa.
  if (!email.value.trim() || !clave.value) {
    mostrarError("Completá el correo y la contraseña.");
    (email.value.trim() ? clave : email).focus();
    return;
  }

  enviando = true;
  marcarCargando(true);
  const desde = Date.now();

  try {
    const r = await entrar(email.value, clave.value);
    await esperarElPiso(desde);

    if (!r.ok) {
      mostrarError(r.mensaje);
      // El foco va a la contraseña y se la selecciona: es lo que hay
      // que volver a escribir en el caso habitual. El correo se deja,
      // que casi siempre estaba bien.
      clave.focus();
      clave.select();
      return;
    }

    // Entró. La contraseña se borra del campo antes de cualquier otra
    // cosa: el formulario sigue en el DOM, y una contraseña en el valor
    // de un input queda al alcance de cualquier extensión y vuelve a
    // aparecer si se recarga con el campo restaurado.
    clave.value = "";
    navegar(INICIO);
  } catch (e) {
    // Acá no debería llegar nada: `entrar()` ya devuelve el error en
    // vez de lanzarlo. Pero si algo lo hace, el usuario tiene que ver
    // algo y el botón tiene que volver: un formulario trabado para
    // siempre es peor que un mensaje genérico.
    await esperarElPiso(desde);
    mostrarError("Algo no funcionó. Intentá de nuevo en un momento.");
    console.error("acceso: error inesperado al entrar", e);
  } finally {
    enviando = false;
    marcarCargando(false);
  }
}

// ===================================================================

export function arrancar() {
  form = /** @type {HTMLFormElement | null} */ ($("form-login"));
  if (!form) return;

  /* Arrancar dos veces no puede duplicar los oyentes.
     Lo destapó una prueba: el módulo se arranca solo al importarse y la
     prueba lo arrancaba de nuevo, con lo que el ojito quedaba con dos
     oyentes, alternaba dos veces por toque y no pasaba nada. Visto así
     parece un problema de la prueba, pero no lo es: un módulo que
     duplica su comportamiento según cuántas veces lo arranquen está
     mal, y en la aplicación el mismo error aparecería el día que algo
     vuelva a llamar a `arrancar` — por ejemplo al rehacer la pantalla
     después de cerrar sesión. */
  if (form.dataset.conectado === "si") return;
  form.dataset.conectado = "si";

  const boton = /** @type {HTMLButtonElement | null} */ ($("login-ojo"));
  const clave = /** @type {HTMLInputElement | null} */ ($("login-clave"));
  if (boton && clave) conectarOjito(boton, clave);

  form.addEventListener("submit", alEnviar);

  // Al escribir se borra el error anterior. Un mensaje que sigue en
  // pantalla mientras se corrige la contraseña se lee como si la
  // corrección tampoco sirviera.
  form.addEventListener("input", () => mostrarError(null));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", arrancar);
} else {
  arrancar();
}
