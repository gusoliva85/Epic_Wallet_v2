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
   una con el enrutador. */

import { SECCIONES, PUBLICAS, INICIO, esPublica, tituloDeRuta } from "./nav.js";

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

function alCambiarElHash() {
  const id = rutaActual();
  if (id) {
    pintar(id);
  } else {
    // Ruta inválida o sin hash: cae en inicio y además corrige la URL,
    // reemplazando para no dejar la ruta mala en el historial.
    navegar(INICIO, { reemplazar: true });
  }
}

export function arrancar() {
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
  const primera = () => alCambiarElHash();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", primera);
  } else {
    primera();
  }
}
