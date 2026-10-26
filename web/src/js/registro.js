/* Pantalla de registro · F02-T10
   Referencia: 01_Documento_General.md §48.1.1 · 02_Documento_Tecnico.md §8.3, §8.9
   · skill §8 «Pantallas de cuenta»

   El formulario está en `index.html`, en la misma tarjeta de vidrio que
   el login (`[data-cuenta="registro"]` dentro de `#acceso`). Acá va lo
   que se mueve: los dos ojitos, la validación en vivo de que las
   contraseñas coincidan, el medidor de fortaleza, el estado de carga y
   qué pasa al enviar.

   Reusa de `acceso.js` el patrón del ojito (`conectarOjito`) y de
   `clave-ui.js` el medidor de fortaleza y la comparación de las dos
   contraseñas: es el mismo comportamiento sobre campos distintos, y
   escribirlo dos veces sólo daría dos lugares para que un arreglo
   futuro se aplique en uno y se olvide en el otro. Desde F11-T03 esos
   dos ayudantes los comparte con la pantalla de contraseña nueva.

   Lo que este archivo NO hace, y es a propósito:

   * **No decide si hay que mostrar la pantalla.** Eso es del enrutador
     (`#/registro`) y, cuando exista, de la guardia de F02-T12.
   * **No sabe de Supabase.** Habla con `auth.js`, igual que `acceso.js`.
   * **No construye la pantalla de «revisá tu correo».** El bloque
     `#registro-confirmar` ya está en el HTML desde F02-T10; este
     archivo sólo lo muestra cuando `auth.js` devuelve
     `falta_confirmar`, que es lo que pasa con la confirmación por
     correo activada (F11-T03). Con la confirmación apagada ese camino
     no se usa nunca y el registro entra directo, como antes. */

import { registrarse, reenviarConfirmacion } from "./auth.js";
import { navegar } from "./router.js";
import { INICIO, LOGIN } from "./nav.js";
import { conectarOjito } from "./acceso.js";
import {
  MINIMO_CLAVE,
  mostrarFortaleza as pintarFortaleza,
  actualizarCoincidencia as compararClaves,
  puntuarFortaleza,
} from "./clave-ui.js";

/* Mismo piso que el login y con el mismo motivo: que «ya existe esa
   cuenta» y «cuenta creada» no se distingan por el tiempo de respuesta.
   Crear una fila nueva (más el trigger de perfil y categorías) y
   rechazar un email repetido no tardan lo mismo, y esa diferencia
   cuenta tanto como lo haría un mensaje distinto. */
const PISO_DE_RESPUESTA = 350;

/** @type {HTMLFormElement | null} */
let form = null;

function $(id) {
  return document.getElementById(id);
}

/* El medidor y la comparación viven en `clave-ui.js`; acá quedan sólo
   los envoltorios que saben qué ids tiene esta pantalla. */

function mostrarFortaleza(clave) {
  pintarFortaleza(clave, {
    contenedor: $("registro-fuerza"),
    barra: $("registro-fuerza-barra"),
    texto: $("registro-fuerza-texto"),
  });
}

function actualizarCoincidencia() {
  return compararClaves({
    campo: /** @type {HTMLInputElement | null} */ ($("registro-clave")),
    repetir: /** @type {HTMLInputElement | null} */ ($("registro-clave2")),
    nota: $("registro-coincide"),
  });
}

/* Se re-exporta porque `puntuarFortaleza` era parte de la interfaz de
   este módulo desde F02-T10 y no hay motivo para que quien lo importe
   se tenga que enterar de que se mudó de archivo. */
export { puntuarFortaleza };

// ===================================================================
//  Error y carga — mismo patrón que acceso.js, con los ids de registro
// ===================================================================

/** @param {string | null} mensaje */
export function mostrarError(mensaje) {
  const caja = $("registro-error");
  if (!caja) return;
  caja.textContent = mensaje ?? "";
  caja.hidden = !mensaje;
}

/** @param {boolean} cargando */
export function marcarCargando(cargando) {
  const boton = /** @type {HTMLButtonElement | null} */ ($("registro-enviar"));
  if (!boton) return;
  boton.disabled = cargando;
  boton.classList.toggle("cargando", cargando);
  boton.setAttribute("aria-busy", String(cargando));
}

// ===================================================================
//  Enviar
// ===================================================================

let enviando = false;

async function esperarElPiso(desde) {
  const falta = PISO_DE_RESPUESTA - (Date.now() - desde);
  if (falta > 0) await new Promise((listo) => setTimeout(listo, falta));
}

/* El correo con el que se creó la cuenta, para poder reenviarle la
   confirmación. Se guarda acá y no se vuelve a leer del campo porque
   el campo se puede editar después de enviado: reenviaríamos a una
   dirección distinta de la que quedó registrada. */
let correoPendiente = "";

/** Pasa la tarjeta del formulario al mensaje de «revisá tu correo».
 * Sin tocar `form.hidden`: el formulario se queda en el DOM por si
 * algún día hay que volver a mostrarlo, y ocultarlo entero sería
 * repetir la lógica de visibilidad en dos lugares distintos de este
 * mismo archivo. */
function mostrarConfirmarCorreo(email) {
  correoPendiente = email;
  if (form) form.hidden = true;
  const bloque = $("registro-confirmar");
  if (bloque) bloque.hidden = false;
}

/** Vuelve a mandar el correo de confirmación (General §48.1.1).
 *
 * El botón queda apagado después del primer reenvío: el límite de
 * Supabase es por minuto, y dos toques seguidos darían un 429 que se
 * lee como si la aplicación estuviera fallando. Se reabre al minuto.
 */
let reenviando = false;

async function alReenviar() {
  const boton = /** @type {HTMLButtonElement | null} */ ($("registro-reenviar"));
  const nota = $("registro-reenviado");
  if (!boton || reenviando || !correoPendiente) return;

  reenviando = true;
  boton.disabled = true;
  boton.classList.add("cargando");
  boton.setAttribute("aria-busy", "true");
  if (nota) {
    nota.textContent = "";
    nota.className = "campo-nota";
  }

  const r = await reenviarConfirmacion(correoPendiente);

  boton.classList.remove("cargando");
  boton.setAttribute("aria-busy", "false");
  if (nota) {
    nota.textContent = r.ok
      ? "Listo, te lo mandamos de nuevo."
      : /** @type {any} */ (r).mensaje;
    nota.className = r.ok ? "campo-nota campo-nota--ok" : "campo-nota campo-nota--crit";
  }

  setTimeout(() => {
    reenviando = false;
    boton.disabled = false;
  }, 60_000);
}

/** @param {SubmitEvent} evento */
export async function alEnviar(evento) {
  evento.preventDefault();
  if (enviando) return;

  const email = /** @type {HTMLInputElement} */ ($("registro-email"));
  const clave = /** @type {HTMLInputElement} */ ($("registro-clave"));
  const clave2 = /** @type {HTMLInputElement} */ ($("registro-clave2"));
  if (!email || !clave || !clave2) return;

  mostrarError(null);

  if (!email.value.trim() || !clave.value || !clave2.value) {
    mostrarError("Completá los tres campos.");
    (!email.value.trim() ? email : !clave.value ? clave : clave2).focus();
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
  const desde = Date.now();

  try {
    const r = await registrarse(email.value, clave.value);
    await esperarElPiso(desde);

    if (!r.ok) {
      mostrarError(r.mensaje);
      // Igual que en el login: el foco va al campo que conviene
      // revisar primero, no a cualquiera. Una contraseña débil para
      // Supabase (código que esta pantalla no replica entero del lado
      // del cliente) señala la contraseña; cualquier otro caso —
      // incluido el email ya existente, que no se distingue del resto
      // a propósito— señala el correo, que es el dato más probable de
      // estar mal si no fue la contraseña.
      (r.codigo === "weak_password" ? clave : email).focus();
      return;
    }

    // Las dos contraseñas se borran del campo antes de cualquier otra
    // cosa, mismo motivo que en el login: el formulario sigue en el
    // DOM y una contraseña en el valor de un input queda al alcance de
    // cualquier extensión.
    clave.value = "";
    clave2.value = "";

    if ("falta_confirmar" in r && r.falta_confirmar) {
      mostrarConfirmarCorreo(email.value.trim());
      return;
    }

    // La confirmación está apagada (F02-T02): entra directo. El
    // trigger de Postgres ya le creó el perfil y las 21 categorías
    // (F02-T04) antes de que esta función termine de resolver.
    navegar(INICIO);
  } catch (e) {
    await esperarElPiso(desde);
    mostrarError("Algo no funcionó. Intentá de nuevo en un momento.");
    console.error("registro: error inesperado al crear la cuenta", e);
  } finally {
    enviando = false;
    marcarCargando(false);
  }
}

// ===================================================================

export function arrancar() {
  form = /** @type {HTMLFormElement | null} */ ($("form-registro"));
  if (!form) return;

  // Mismo resguardo que acceso.js: arrancar dos veces no puede
  // duplicar los oyentes.
  if (form.dataset.conectado === "si") return;
  form.dataset.conectado = "si";

  const ojo1 = /** @type {HTMLButtonElement | null} */ ($("registro-ojo"));
  const clave1 = /** @type {HTMLInputElement | null} */ ($("registro-clave"));
  if (ojo1 && clave1) conectarOjito(ojo1, clave1);

  const ojo2 = /** @type {HTMLButtonElement | null} */ ($("registro-ojo2"));
  const clave2 = /** @type {HTMLInputElement | null} */ ($("registro-clave2"));
  if (ojo2 && clave2) conectarOjito(ojo2, clave2);

  if (clave1) {
    clave1.addEventListener("input", () => {
      mostrarFortaleza(clave1.value);
      actualizarCoincidencia();
    });
  }
  if (clave2) {
    clave2.addEventListener("input", actualizarCoincidencia);
  }

  form.addEventListener("submit", alEnviar);
  form.addEventListener("input", () => mostrarError(null));

  const irALogin = $("registro-ir-login");
  irALogin?.addEventListener("click", () => navegar(LOGIN));
  const volverLogin = $("registro-volver-login");
  volverLogin?.addEventListener("click", () => navegar(LOGIN));
  const reenviar = $("registro-reenviar");
  reenviar?.addEventListener("click", () => void alReenviar());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", arrancar);
} else {
  arrancar();
}
