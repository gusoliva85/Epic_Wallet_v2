/* Pantalla de «olvidé mi contraseña» · F11-T03
   Referencia: 01_Documento_General.md §48.1.2 · 02_Documento_Tecnico.md §8.5
   · skill §8 «Pantallas de cuenta»

   El formulario está en `index.html` (`[data-cuenta="recuperar"]`).
   Acá va sólo lo que se mueve: el estado de carga, el mensaje y el
   paso a «si hay una cuenta con ese correo, te llega el enlace».

   LA REGLA DE ESTA PANTALLA, Y ES LA ÚNICA QUE IMPORTA

   **La respuesta es la misma exista o no la cuenta.** Si no, este
   formulario pasa a ser un verificador de cuentas: se escriben correos
   y el que conteste distinto es el que está registrado. `auth.js` ya
   devuelve `ok` en los dos casos; lo que se agrega acá es lo otro que
   los distinguiría —**el tiempo**—, con el mismo piso de respuesta que
   usan el login y el registro. Mandar un mail de verdad y no mandar
   nada no tardan lo mismo.

   El 429 sí se informa, y no rompe la regla: «esperá un momento» no
   dice nada sobre el correo que se escribió, dice algo sobre cuántas
   veces se tocó el botón. */

import { recuperarClave } from "./auth.js";
import { navegar } from "./router.js";
import { LOGIN } from "./nav.js";

/* Mismo piso que `acceso.js` y `registro.js`, por el motivo de arriba. */
const PISO_DE_RESPUESTA = 350;

/** @type {HTMLFormElement | null} */
let form = null;

function $(id) {
  return document.getElementById(id);
}

/** @param {string | null} mensaje */
export function mostrarError(mensaje) {
  const caja = $("recuperar-error");
  if (!caja) return;
  caja.textContent = mensaje ?? "";
  caja.hidden = !mensaje;
}

/** @param {boolean} cargando */
export function marcarCargando(cargando) {
  const boton = /** @type {HTMLButtonElement | null} */ ($("recuperar-enviar"));
  if (!boton) return;
  boton.disabled = cargando;
  boton.classList.toggle("cargando", cargando);
  boton.setAttribute("aria-busy", String(cargando));
}

/** Pasa del formulario al mensaje de enviado. */
function mostrarEnviado() {
  if (form) form.hidden = true;
  const bloque = $("recuperar-listo");
  if (bloque) bloque.hidden = false;
  // El pie con «¿Te acordaste? Iniciá sesión» deja de tener sentido:
  // el bloque de enviado ya lleva su propio botón al login, y dos
  // caminos al mismo lugar uno debajo del otro se leen como dos
  // acciones distintas.
  const pie = form?.parentElement?.querySelector(".acceso-pie");
  if (pie) /** @type {HTMLElement} */ (pie).hidden = true;
}

let enviando = false;

async function esperarElPiso(desde) {
  const falta = PISO_DE_RESPUESTA - (Date.now() - desde);
  if (falta > 0) await new Promise((listo) => setTimeout(listo, falta));
}

/** @param {SubmitEvent} evento */
export async function alEnviar(evento) {
  evento.preventDefault();
  if (enviando) return;

  const email = /** @type {HTMLInputElement} */ ($("recuperar-email"));
  if (!email) return;

  mostrarError(null);

  if (!email.value.trim()) {
    mostrarError("Escribí tu correo.");
    email.focus();
    return;
  }

  enviando = true;
  marcarCargando(true);
  const desde = Date.now();

  try {
    const r = await recuperarClave(email.value);
    await esperarElPiso(desde);

    if (!r.ok) {
      // Hoy sólo llega acá el 429 y los errores de red: `auth.js`
      // devuelve `ok` para todo el resto justamente para no contar si
      // la cuenta existe.
      mostrarError(r.mensaje);
      return;
    }

    mostrarEnviado();
  } catch (e) {
    await esperarElPiso(desde);
    mostrarError("Algo no funcionó. Intentá de nuevo en un momento.");
    console.error("recuperar: error inesperado al pedir el enlace", e);
  } finally {
    enviando = false;
    marcarCargando(false);
  }
}

// ===================================================================

export function arrancar() {
  form = /** @type {HTMLFormElement | null} */ ($("form-recuperar"));
  if (!form) return;

  // Mismo resguardo que las otras pantallas de cuenta: arrancar dos
  // veces no puede duplicar los oyentes.
  if (form.dataset.conectado === "si") return;
  form.dataset.conectado = "si";

  form.addEventListener("submit", alEnviar);
  form.addEventListener("input", () => mostrarError(null));

  $("recuperar-ir-login")?.addEventListener("click", () => navegar(LOGIN));
  $("recuperar-volver-login")?.addEventListener("click", () => navegar(LOGIN));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", arrancar);
} else {
  arrancar();
}
