/* Los cuatro estados · F01-T13
   Referencia: 02_Documento_Tecnico.md §12.6

   Ninguna vista muestra una pantalla en blanco. Los cuatro:

     cargando     esqueletos con la FORMA del contenido final
     error        qué pasó y un botón para reintentar
     vacío        texto que explica, no un cero seco
     sin conexión banda arriba y lectura del caché

   Y uno más, que no es un error sino una regla de negocio: el **mes
   consolidado**. Cuando la API devuelve `transactions: null`, la
   interfaz dice que el mes está consolidado y NO muestra una lista
   vacía ni inventa movimientos (regla 4 del documento general). Es
   distinto de «vacío»: vacío es que no hay nada; consolidado es que lo
   que hay son totales. */

import { esc } from "../format.js";
import { icono } from "../iconos.js";

/**
 * Esqueletos de carga.
 *
 * La forma importa: tienen que medir lo mismo que el contenido que
 * viene después. Un esqueleto más bajo hace que la página salte al
 * llegar los datos y se pierda el lugar donde se estaba leyendo.
 *
 * @param {"fila"|"tarjeta"|"grafico"} forma
 * @param {number} cuantos
 */
export function cargando(forma = "fila", cuantos = 3) {
  return Array.from(
    { length: cuantos },
    () =>
      `<div class="esqueleto esqueleto--${forma}" aria-hidden="true"></div>`,
  ).join("");
}

/** Envuelve los esqueletos avisando al lector de que se está cargando. */
export function bloqueCargando(forma = "fila", cuantos = 3) {
  // `aria-busy` y un texto: los esqueletos son decoración y no dicen
  // nada; sin esto, quien no ve la pantalla no sabe que hay algo en
  // camino y cree que la sección está vacía.
  return (
    '<div aria-busy="true" aria-live="polite">' +
    '<span class="solo-lector">Cargando…</span>' +
    cargando(forma, cuantos) +
    "</div>"
  );
}

function estado({ clase, ico, titulo, texto, accion }) {
  return (
    `<div class="estado ${clase}" role="status">` +
    `<span class="estado-ico" aria-hidden="true">` +
    `<svg viewBox="0 0 24 24">${icono(ico)}</svg></span>` +
    `<b>${esc(titulo)}</b>` +
    (texto ? `<p>${esc(texto)}</p>` : "") +
    (accion
      ? `<button class="chip" type="button" data-reintentar>${esc(accion)}</button>`
      : "") +
    "</div>"
  );
}

/** Algo falló. Siempre con una salida: un botón para reintentar. */
export function error(texto = "No se pudieron cargar los datos.") {
  return estado({
    clase: "estado--error",
    ico: "aviso",
    titulo: "No se pudo cargar",
    texto,
    accion: "Reintentar",
  });
}

/** No hay nada. El texto explica qué hacer, no deja un cero seco. */
export function vacio(titulo, texto = "") {
  return estado({ clase: "estado--vacio", ico: "info", titulo, texto });
}

/**
 * Mes consolidado. Texto específico, por la regla 4.
 *
 * No se reusa `vacio()` a propósito: decir «no hay movimientos» de un
 * mes consolidado es falso. Los movimientos existieron; lo que se
 * guarda son los totales.
 */
export function consolidado() {
  return estado({
    clase: "estado--consolidado",
    ico: "info",
    titulo: "Información histórica consolidada",
    texto:
      "De este mes se conservan los totales. Un total histórico no se " +
      "desglosa en movimientos, así que no hay una lista para mostrar.",
  });
}

/**
 * Conecta la banda de «sin conexión».
 *
 * Se escuchan los dos eventos del navegador y además se consulta el
 * estado al arrancar: si la aplicación se abre ya sin conexión, el
 * evento `offline` nunca llega porque no hubo transición.
 */
export function conectarSinConexion(
  banda = document.getElementById("banda-offline"),
) {
  if (!banda) return null;

  const pintar = () => {
    banda.hidden = navigator.onLine;
  };

  window.addEventListener("online", pintar);
  window.addEventListener("offline", pintar);
  pintar();
  return pintar;
}
