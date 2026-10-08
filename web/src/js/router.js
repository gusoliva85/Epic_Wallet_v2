/* Enrutador por hash · F01-T07
   Referencia: 02_Documento_Tecnico.md §12.1

   Una sola página con siete `<section class="view">`, de las cuales
   una está activa. La navegación cambia el hash, lo que da historial
   del navegador y botón «atrás» sin recargar.

   Por qué hash y no History API con rutas de verdad: con rutas reales
   (`/movimientos`) el servidor tiene que devolver index.html en cada
   una o una recarga da 404. En Vercel eso es una regla de reescritura
   más que mantener, y no compra nada acá: la aplicación es una sola
   pantalla y el hash ya da historial, «atrás» y enlaces que se pueden
   guardar.

   Quien quiera saber la ruta activa no la lee del DOM ni del hash:
   escucha el evento `epic:ruta`. Así la barra superior, la inferior y
   lo que venga después no se ponen de acuerdo entre ellas, sino cada
   una con el enrutador.

   Guardia de rutas · F02-T12. Antes de pintar, se decide si la ruta
   pedida es la que corresponde: una ruta privada sin sesión cae en
   login; una pública (login, registro) con sesión cae en inicio. La
   sesión se pregunta en cada cambio de ruta y no se cachea acá: es una
   lectura local (`getSession()` no toca la red), y cachearla sería
   quedarse con una respuesta vieja justo después de cerrar sesión. */

import { SECCIONES, PUBLICAS, INICIO, LOGIN, esPublica, tituloDeRuta } from "./nav.js";
import { haySesion } from "./auth.js";

// Las siete secciones más las pantallas de cuenta. Las dos barras de
// navegación siguen leyendo sólo `SECCIONES`, así que una pantalla de
// cuenta es alcanzable por URL sin aparecer como una posición más.
const RUTAS = [...SECCIONES.map((s) => s.id), ...PUBLICAS.map((p) => p.id)];

/** Nombre del evento que avisa que cambió la ruta. */
export const EVENTO = "epic:ruta";

/** Lee la ruta del hash. Devuelve `null` si no hay ninguna válida. */
export function rutaActual() {
  // `#/movimientos` → `movimientos`. Sin el hash, o con cualquier cosa
  // que no sea una ruta, devuelve null y decide quien llame.
  const id = location.hash.replace(/^#\/?/, "").split("?")[0];
  return RUTAS.includes(id) ? id : null;
}

let ultima = null;

function pintar(id) {
  // Volver a pintar la vista que ya está activa repetiría la animación
  // de entrada: tocar dos veces la misma posición de la barra haría
  // parpadear la pantalla sin que haya cambiado nada.
  if (id === ultima) return;
  ultima = id;

  document.querySelectorAll(".view").forEach((vista) => {
    const activa = vista.dataset.vista === id;
    vista.classList.toggle("activa", activa);
    // `hidden` y no sólo una clase: una vista inactiva tiene que salir
    // del árbol de accesibilidad y del orden de tabulación, o el
    // lector lee las siete y el tabulador recorre botones invisibles.
    vista.hidden = !activa;
  });

  // Las pantallas de cuenta van encima de la aplicación, no dentro: no
  // tienen barras, ni mes, ni botón de alta. Mientras una está abierta,
  // todo lo de atrás queda `inert` — si no, el tabulador sigue
  // recorriendo la aplicación tapada y el lector de pantalla la lee
  // igual, aunque no se vea nada de ella.
  const publica = esPublica(id);
  const acceso = document.getElementById("acceso");
  const app = document.querySelector(".app");
  if (acceso && app) {
    acceso.hidden = !publica;
    app.inert = publica;
    // `aria-hidden` además de `inert`: hay lectores que todavía no
    // implementan `inert` y sin esto leerían las dos cosas a la vez.
    if (publica) app.setAttribute("aria-hidden", "true");
    else app.removeAttribute("aria-hidden");

    // Dentro de `#acceso` conviven varias tarjetas —login, registro—,
    // igual que las siete vistas conviven dentro de `.app`. La misma
    // regla aplica: la que no está activa lleva `hidden`, no sólo una
    // clase, o el tabulador sigue entrando a sus campos.
    if (publica) {
      acceso.querySelectorAll("[data-cuenta]").forEach((tarjeta) => {
        tarjeta.hidden = tarjeta.dataset.cuenta !== id;
      });
    }
  }

  const titulo = tituloDeRuta(id);
  if (titulo) document.title = titulo;

  // Al cambiar de vista se vuelve arriba. Sin esto, entrar a una
  // sección desde el final de una lista larga la abre por la mitad.
  // `instant` a propósito: un desplazamiento suave de 3000 px tarda
  // segundos y parece que la aplicación se colgó.
  window.scrollTo({ top: 0, behavior: "instant" });

  document.dispatchEvent(new CustomEvent(EVENTO, { detail: { id } }));
}

/**
 * Va a una sección.
 * @param {string} id
 * @param {{reemplazar?: boolean}} opciones `reemplazar` no deja entrada
 *   en el historial: se usa al corregir una ruta inválida, para que
 *   «atrás» no vuelva a ella.
 */
export function navegar(id, { reemplazar = false } = {}) {
  if (!RUTAS.includes(id)) id = INICIO;
  const url = `#/${id}`;

  if (reemplazar) {
    history.replaceState(null, "", url);
    pintar(id);
    return;
  }

  if (location.hash === url) {
    pintar(id);
    return;
  }

  // Asignar el hash y no `pushState`: así el navegador agrega la
  // entrada al historial y emite `hashchange`, que es lo que ya se
  // escucha. Con pushState habría que pintar a mano acá y además en
  // `popstate`, y son dos caminos que se desincronizan.
  location.hash = url;
}

/**
 * Decide qué ruta corresponde mostrar de verdad, según haya o no
 * sesión. Devuelve `id` sin tocar si no hay nada que corregir.
 */
async function resolverDestino(id) {
  const publica = esPublica(id);
  const sesion = await haySesion();
  if (!publica && !sesion) return LOGIN; // privada sin sesión
  if (publica && sesion) return INICIO; // pública con sesión ya puesta
  return id;
}

async function alCambiarElHash() {
  const pedida = rutaActual();
  // Ruta inválida o sin hash: la base para la guardia es inicio, igual
  // que antes de que existiera la guardia.
  const destino = await resolverDestino(pedida ?? INICIO);

  if (destino === pedida) {
    // La ruta del hash es válida y la guardia la deja pasar tal cual.
    pintar(destino);
  } else {
    // O la ruta no existía, o la guardia decidió otra cosa. En los dos
    // casos se corrige el hash sin dejar la ruta vieja en el
    // historial: si no, «atrás» volvería justo a lo que se corrigió.
    navegar(destino, { reemplazar: true });
  }
}

/**
 * Async desde F02-T12: la primera pintada ahora pasa por la guardia de
 * rutas, que pregunta la sesión antes de pintar. Quien llama puede
 * ignorar la promesa (`arrancar()` a secas, como hace `app.js`) o
 * esperarla cuando necesite saber que la primera pintada —con la
 * guardia ya aplicada— terminó, que es lo que hacen las pruebas.
 */
export async function arrancar() {
  // Sólo `hashchange`. Todas las entradas que crea este enrutador son
  // de hash, y el navegador emite `hashchange` tanto al cambiarlo como
  // al recorrer el historial con «atrás» y «adelante». Agregar
  // `popstate` —como sugiere el documento técnico §12.1— no cubre
  // ningún caso más acá: sería una línea que nunca se ejecuta sola, y
  // una que ninguna prueba puede distinguir de su ausencia.
  window.addEventListener("hashchange", alCambiarElHash);

  // La primera pintada espera al DOM si hace falta, y no sólo porque
  // necesite las secciones: las dos barras se conectan en el mismo
  // evento y registraron su escucha antes que ésta, así que ya están
  // oyendo `epic:ruta` cuando se emite. Arrancando antes, la primera
  // ruta se emitiría sin nadie escuchando.
  //
  // La rama de `DOMContentLoaded` no se espera: con los módulos
  // cargados como `type="module"` (y en cualquier DOM ya parseado,
  // como el de las pruebas) `readyState` nunca vale "loading" acá, así
  // que esa rama no se ejecuta en la práctica; no vale la pena
  // complicarla para poder esperarla.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void alCambiarElHash());
  } else {
    await alCambiarElHash();
  }
}
