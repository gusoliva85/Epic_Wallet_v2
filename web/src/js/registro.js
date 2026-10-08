/* Pantalla de registro · F02-T10
   Referencia: 01_Documento_General.md §48.1.1 · 02_Documento_Tecnico.md §8.3, §8.9
   · skill §8 «Pantallas de cuenta»

   El formulario está en `index.html`, en la misma tarjeta de vidrio que
   el login (`[data-cuenta="registro"]` dentro de `#acceso`). Acá va lo
   que se mueve: los dos ojitos, la validación en vivo de que las
   contraseñas coincidan, el medidor de fortaleza, el estado de carga y
   qué pasa al enviar.

   Reusa de `acceso.js` el patrón del ojito (`conectarOjito`): es el
   mismo comportamiento sobre un campo distinto, y escribirlo dos veces
   sólo daría dos lugares para que un arreglo futuro se aplique en uno y
   se olvide en el otro.

   Lo que este archivo NO hace, y es a propósito:

   * **No decide si hay que mostrar la pantalla.** Eso es del enrutador
     (`#/registro`) y, cuando exista, de la guardia de F02-T12.
   * **No sabe de Supabase.** Habla con `auth.js`, igual que `acceso.js`.
   * **No construye la pantalla de «revisá tu correo».** Hoy la
     confirmación por mail está apagada (F02-T02) y `registrarse()`
     siempre entra directo. El bloque `#registro-confirmar` ya existe en
     el HTML para cuando F11-T03 active el correo; este archivo sólo lo
     muestra si algún día `auth.js` devuelve `falta_confirmar`. */

import { registrarse } from "./auth.js";
import { navegar } from "./router.js";
import { INICIO, LOGIN } from "./nav.js";
import { conectarOjito } from "./acceso.js";

/* Mismo piso que el login y con el mismo motivo: que «ya existe esa
   cuenta» y «cuenta creada» no se distingan por el tiempo de respuesta.
   Crear una fila nueva (más el trigger de perfil y categorías) y
   rechazar un email repetido no tardan lo mismo, y esa diferencia
   cuenta tanto como lo haría un mensaje distinto. */
const PISO_DE_RESPUESTA = 350;

/** Lo único que la interfaz exige antes de llamar a la API: el mínimo
 * de 8 caracteres que configura Supabase (Técnico §8.9). El servidor
 * valida igual, esto es sólo para no esperar una vuelta de red por un
 * error que ya se sabe de antemano. */
const MINIMO_CLAVE = 8;

/** @type {HTMLFormElement | null} */
let form = null;

function $(id) {
  return document.getElementById(id);
}

// ===================================================================
//  Medidor de fortaleza — orientativo, nunca bloqueante
// ===================================================================

/**
 * Puntúa una contraseña del 0 al 4. No es criptografía, es una guía:
 * el único mínimo que de verdad se exige es el de 8 caracteres, y ese
 * se valida aparte.
 *
 * @param {string} clave
 * @returns {0 | 1 | 2 | 3 | 4}
 */
export function puntuarFortaleza(clave) {
  if (!clave) return 0;
  let p = 0;
  if (clave.length >= MINIMO_CLAVE) p++;
  if (clave.length >= 12) p++;
  if (/[a-z]/.test(clave) && /[A-Z]/.test(clave)) p++;
  if (/[0-9]/.test(clave)) p++;
  if (/[^a-zA-Z0-9]/.test(clave)) p++;
  // Cinco criterios posibles, máximo 4: largo por sí solo no alcanza
  // para "fuerte" si no hay ninguna variedad de caracteres.
  return /** @type {0|1|2|3|4} */ (Math.min(p, 4));
}

const NIVELES = [
  { etiqueta: "", color: "" },
  { etiqueta: "Débil", color: "var(--color-crit)" },
  { etiqueta: "Débil", color: "var(--color-crit)" },
  { etiqueta: "Media", color: "var(--color-warn)" },
  { etiqueta: "Fuerte", color: "var(--color-ok)" },
];

/** Pinta la barra y el texto del medidor. Se esconde entero con el
 * campo vacío: una barra en cero no dice nada y ocupa lugar.
 *
 * Por debajo del mínimo no muestra "Débil": dice cuánto falta. Es la
 * validación en vivo del mínimo de 8 caracteres que pide la tarea —
 * orientativa, igual que el resto del medidor, porque lo que de verdad
 * bloquea el envío es el chequeo de `alEnviar`, no esto. */
function mostrarFortaleza(clave) {
  const cont = $("registro-fuerza");
  const barra = $("registro-fuerza-barra");
  const texto = $("registro-fuerza-texto");
  if (!cont || !barra || !texto) return;

  if (!clave) {
    cont.hidden = true;
    return;
  }
  cont.hidden = false;

  if (clave.length < MINIMO_CLAVE) {
    const faltan = MINIMO_CLAVE - clave.length;
    barra.style.width = `${(clave.length / MINIMO_CLAVE) * 25}%`;
    barra.style.background = "var(--color-crit)";
    texto.textContent = `Falta${faltan === 1 ? "" : "n"} ${faltan}`;
    return;
  }

  const nivel = puntuarFortaleza(clave);
  const { etiqueta, color } = NIVELES[nivel];
  barra.style.width = `${(nivel / 4) * 100}%`;
  barra.style.background = color;
  texto.textContent = etiqueta;
}

// ===================================================================
//  Que las dos contraseñas coincidan — en vivo, antes de enviar
// ===================================================================

/**
 * @returns {boolean} si coinciden (o si una de las dos todavía está vacía,
 *   que no es un error, es sólo que no hay nada que comparar aún).
 */
function actualizarCoincidencia() {
  const clave = /** @type {HTMLInputElement | null} */ ($("registro-clave"));
  const clave2 = /** @type {HTMLInputElement | null} */ ($("registro-clave2"));
  const nota = $("registro-coincide");
  if (!clave || !clave2 || !nota) return true;

  if (!clave2.value) {
    nota.textContent = "";
    nota.className = "campo-nota";
    return true;
  }

  const coincide = clave.value === clave2.value;
  nota.textContent = coincide ? "Coinciden." : "Las contraseñas no coinciden.";
  nota.className = coincide ? "campo-nota campo-nota--ok" : "campo-nota campo-nota--crit";
  return coincide;
}

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

/** Pasa la tarjeta del formulario al mensaje de «revisá tu correo».
 * Sin tocar `form.hidden`: el formulario se queda en el DOM por si
 * algún día hay que volver a mostrarlo, y ocultarlo entero sería
 * repetir la lógica de visibilidad en dos lugares distintos de este
 * mismo archivo. */
function mostrarConfirmarCorreo() {
  if (form) form.hidden = true;
  const bloque = $("registro-confirmar");
  if (bloque) bloque.hidden = false;
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
      mostrarConfirmarCorreo();
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
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", arrancar);
} else {
  arrancar();
}
