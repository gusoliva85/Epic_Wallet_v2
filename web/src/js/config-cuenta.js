/* Cuenta: nombre visible y cambio de contraseña · F02-T11
   Referencia: 02_Documento_Tecnico.md §8.3, §9.1 · General §48.9
   · skill §8 «Pantallas de cuenta»

   La tarjeta "Cuenta" de configuración, con dos formularios
   independientes: nombre visible y cambio de contraseña. Comparten la
   tarjeta pero no comparten estado — guardar uno no toca al otro, y
   si uno falla el otro sigue intacto.

   El correo es de sólo lectura y sale de la sesión de Supabase
   (`usuarioActual()`), no de nuestra API: el correo no vive en
   `profiles`, lo gestiona Supabase Auth (Técnico §6.1). El nombre
   visible sí vive en `profiles`, así que su lectura y su escritura
   pasan por `GET`/`PATCH /api/me`.

   Por qué un `fetch` a mano y no un cliente de API: `api.js`, con el
   reintento ante un 401 vencido, es F02-T12 —la tarea siguiente—. Acá
   alcanza con la llamada mínima usando `cabeceras()` de auth.js; el
   día que exista `api.js` esta función se reemplaza por una línea.
   Construir el cliente general antes de que haga falta sería
   adelantar esa tarea.

   El cambio de contraseña va en dos pasos. Supabase no pide la
   contraseña actual para cambiarla —el token ya prueba quién sos—,
   así que si hay que exigirla hay que verificarla a mano: primero se
   intenta `entrar()` con la actual (el mismo camino que el login) y
   sólo si eso funciona se llama a `actualizarUsuario()`. Es el
   criterio de aceptación de la tarea: "con la actual equivocada no se
   cambia nada". */

import { usuarioActual, entrar, actualizarUsuario, cabeceras } from "./auth.js";
import { conectarOjito } from "./acceso.js";
import { toast } from "./components/toast.js";

const MINIMO_CLAVE = 8;

function $(id) {
  return document.getElementById(id);
}

// ===================================================================
//  Cargar lo que hay: correo (de la sesión) y nombre (de la API)
// ===================================================================

async function cargarCuenta() {
  const usuario = await usuarioActual();
  const campoEmail = $("cuenta-email");
  if (campoEmail) campoEmail.textContent = usuario?.email ?? "—";

  const campoNombre = /** @type {HTMLInputElement | null} */ ($("cuenta-nombre"));
  if (!campoNombre) return;

  const cab = await cabeceras();
  // Sin sesión no hay nada que precargar. No es un error que mostrar:
  // la guardia de rutas (F02-T12) es la que decide si esta pantalla
  // debería ser alcanzable sin sesión; acá sólo se evita romper.
  if (!cab) return;

  try {
    const r = await fetch("/api/me", { headers: cab });
    if (!r.ok) return;
    const perfil = await r.json();
    campoNombre.value = perfil.display_name ?? "";
  } catch {
    // Sin red: el campo queda como esté. Si el usuario escribe y
    // guarda, el error de esa llamada ya lo va a avisar.
  }
}

// ===================================================================
//  Guardar el nombre
// ===================================================================

function mostrarErrorNombre(mensaje) {
  const caja = $("nombre-error");
  if (!caja) return;
  caja.textContent = mensaje ?? "";
  caja.hidden = !mensaje;
}

function marcarCargandoNombre(cargando) {
  const boton = /** @type {HTMLButtonElement | null} */ ($("nombre-guardar"));
  if (!boton) return;
  boton.disabled = cargando;
  boton.classList.toggle("cargando", cargando);
  boton.setAttribute("aria-busy", String(cargando));
}

let guardandoNombre = false;

async function alGuardarNombre(evento) {
  evento.preventDefault();
  if (guardandoNombre) return;

  const campo = /** @type {HTMLInputElement | null} */ ($("cuenta-nombre"));
  if (!campo) return;

  mostrarErrorNombre(null);

  // La bandera se levanta antes del primer `await` del intento —el
  // mismo motivo que en `alCambiarClave`—, para que dos envíos casi
  // simultáneos no pasen los dos la guarda antes de que ninguno la
  // marque.
  guardandoNombre = true;
  marcarCargandoNombre(true);

  try {
    const cab = await cabeceras();
    if (!cab) {
      mostrarErrorNombre("Tu sesión no está disponible. Volvé a entrar e intentá de nuevo.");
      return;
    }

    const r = await fetch("/api/me", {
      method: "PATCH",
      headers: { ...cab, "Content-Type": "application/json" },
      // Sólo `display_name`: mandar `opening_balance` acá lo pisaría
      // con `undefined` → el backend lo ignora por `exclude_unset`,
      // pero no hace falta mandarlo ni para eso. Nombre recortado: un
      // nombre de puros espacios el backend lo convierte en null, que
      // es justo "sin nombre visible".
      body: JSON.stringify({ display_name: campo.value.trim() }),
    });

    if (!r.ok) {
      mostrarErrorNombre("No se pudo guardar el nombre. Probá de nuevo en un momento.");
      return;
    }

    toast("Nombre guardado.");
  } catch (e) {
    mostrarErrorNombre("No se pudo guardar el nombre. Probá de nuevo en un momento.");
    console.error("config-cuenta: error al guardar el nombre", e);
  } finally {
    guardandoNombre = false;
    marcarCargandoNombre(false);
  }
}

// ===================================================================
//  Cambiar la contraseña
// ===================================================================

function mostrarErrorClave(mensaje) {
  const caja = $("clave-error");
  if (!caja) return;
  caja.textContent = mensaje ?? "";
  caja.hidden = !mensaje;
}

function marcarCargandoClave(cargando) {
  const boton = /** @type {HTMLButtonElement | null} */ ($("clave-guardar"));
  if (!boton) return;
  boton.disabled = cargando;
  boton.classList.toggle("cargando", cargando);
  boton.setAttribute("aria-busy", String(cargando));
}

/** Misma idea que en registro.js: con el segundo campo vacío todavía
 * no hay nada que comparar, así que no es un error. */
function actualizarCoincidencia() {
  const nueva = /** @type {HTMLInputElement | null} */ ($("clave-nueva"));
  const repetir = /** @type {HTMLInputElement | null} */ ($("clave-nueva2"));
  const nota = $("clave-coincide");
  if (!nueva || !repetir || !nota) return;

  if (!repetir.value) {
    nota.textContent = "";
    nota.className = "campo-nota";
    return;
  }

  const coincide = nueva.value === repetir.value;
  nota.textContent = coincide ? "Coinciden." : "Las contraseñas no coinciden.";
  nota.className = coincide ? "campo-nota campo-nota--ok" : "campo-nota campo-nota--crit";
}

function limpiarCamposClave() {
  const actual = /** @type {HTMLInputElement | null} */ ($("clave-actual"));
  const nueva = /** @type {HTMLInputElement | null} */ ($("clave-nueva"));
  const repetir = /** @type {HTMLInputElement | null} */ ($("clave-nueva2"));
  // Las tres se borran del campo, no sólo las dos nuevas: una
  // contraseña vieja en el valor de un input queda igual de expuesta
  // que una nueva.
  if (actual) actual.value = "";
  if (nueva) nueva.value = "";
  if (repetir) repetir.value = "";
  const nota = $("clave-coincide");
  if (nota) {
    nota.textContent = "";
    nota.className = "campo-nota";
  }
}

let cambiandoClave = false;

async function alCambiarClave(evento) {
  evento.preventDefault();
  if (cambiandoClave) return;

  const actual = /** @type {HTMLInputElement | null} */ ($("clave-actual"));
  const nueva = /** @type {HTMLInputElement | null} */ ($("clave-nueva"));
  const repetir = /** @type {HTMLInputElement | null} */ ($("clave-nueva2"));
  if (!actual || !nueva || !repetir) return;

  mostrarErrorClave(null);

  if (!actual.value || !nueva.value || !repetir.value) {
    mostrarErrorClave("Completá los tres campos.");
    (!actual.value ? actual : !nueva.value ? nueva : repetir).focus();
    return;
  }
  if (nueva.value.length < MINIMO_CLAVE) {
    mostrarErrorClave(`La contraseña nueva tiene que tener al menos ${MINIMO_CLAVE} caracteres.`);
    nueva.focus();
    return;
  }
  if (nueva.value !== repetir.value) {
    mostrarErrorClave("Las contraseñas nuevas no coinciden.");
    repetir.focus();
    repetir.select();
    return;
  }

  // La bandera se levanta ACÁ, antes del primer `await` de todo el
  // intento —`usuarioActual()` incluido—, no después. Puesta después
  // deja una ventana real: tres envíos rápidos pasan los tres la
  // validación síncrona de arriba antes de que ninguno llegue a
  // marcarla, y los tres terminan llamando a `entrar()`. Lo encontró
  // la prueba de envíos dobles, no una revisión a ojo.
  cambiandoClave = true;
  marcarCargandoClave(true);

  try {
    const usuario = await usuarioActual();
    if (!usuario?.email) {
      mostrarErrorClave("Tu sesión no está disponible. Volvé a entrar e intentá de nuevo.");
      return;
    }

    // Paso 1: verificar la actual intentando entrar con ella. Si la
    // sesión sigue siendo válida, `entrar()` de paso la renueva —no
    // hace daño, es la misma cuenta—; si no, no toca la sesión que ya
    // había y acá se corta sin llamar a `actualizarUsuario`.
    const verificacion = await entrar(usuario.email, actual.value);
    if (!verificacion.ok) {
      mostrarErrorClave("La contraseña actual no es correcta.");
      actual.focus();
      actual.select();
      return;
    }

    // Paso 2: recién acá se cambia.
    const r = await actualizarUsuario({ password: nueva.value });
    if (!r.ok) {
      mostrarErrorClave(r.mensaje);
      nueva.focus();
      return;
    }

    limpiarCamposClave();
    toast("Contraseña actualizada.");
  } catch (e) {
    mostrarErrorClave("Algo no funcionó. Intentá de nuevo en un momento.");
    console.error("config-cuenta: error al cambiar la contraseña", e);
  } finally {
    cambiandoClave = false;
    marcarCargandoClave(false);
  }
}

// ===================================================================

export function arrancar() {
  const formNombre = /** @type {HTMLFormElement | null} */ ($("form-nombre"));
  const formClave = /** @type {HTMLFormElement | null} */ ($("form-clave"));
  if (!formNombre || !formClave) return;

  // Mismo resguardo que acceso.js y registro.js: arrancar dos veces no
  // puede duplicar los oyentes.
  if (formNombre.dataset.conectado === "si") return;
  formNombre.dataset.conectado = "si";

  formNombre.addEventListener("submit", alGuardarNombre);
  formNombre.addEventListener("input", () => mostrarErrorNombre(null));

  formClave.addEventListener("submit", alCambiarClave);
  formClave.addEventListener("input", () => mostrarErrorClave(null));

  const ojoActual = /** @type {HTMLButtonElement | null} */ ($("ojo-actual"));
  const campoActual = /** @type {HTMLInputElement | null} */ ($("clave-actual"));
  if (ojoActual && campoActual) conectarOjito(ojoActual, campoActual);

  const ojoNueva = /** @type {HTMLButtonElement | null} */ ($("ojo-nueva"));
  const campoNueva = /** @type {HTMLInputElement | null} */ ($("clave-nueva"));
  if (ojoNueva && campoNueva) conectarOjito(ojoNueva, campoNueva);

  const ojoNueva2 = /** @type {HTMLButtonElement | null} */ ($("ojo-nueva2"));
  const campoNueva2 = /** @type {HTMLInputElement | null} */ ($("clave-nueva2"));
  if (ojoNueva2 && campoNueva2) conectarOjito(ojoNueva2, campoNueva2);

  campoNueva?.addEventListener("input", actualizarCoincidencia);
  campoNueva2?.addEventListener("input", actualizarCoincidencia);

  cargarCuenta();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", arrancar);
} else {
  arrancar();
}
