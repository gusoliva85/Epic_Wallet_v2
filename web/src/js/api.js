/* Cliente de API · F02-T12
   Referencia: 02_Documento_Tecnico.md §9.3, §12.3

   Un solo punto de salida hacia el backend. Agrega el token, traduce
   el formato uniforme de error de la sección 9.3
   (`{"error":{"code","message","details"}}`) a una excepción de
   JavaScript, y resuelve el caso del token vencido sin que quien
   llama tenga que pensarlo: reintenta **una sola vez** después de
   intentar renovar la sesión, y si el segundo intento también da 401,
   cierra la sesión — ahí es donde se corta el bucle, no reintentando
   para siempre.

   Por qué el reintento no fuerza una renovación aparte: `cabeceras()`
   de auth.js ya revisa el vencimiento cada vez que se la llama y
   renueva sola si hace falta (con margen de un minuto). En el caso
   real —la pestaña estuvo dormida y el token venció— esa revisión ya
   renueva el token *antes* de que la petición salga, así que casi
   nunca se llega a ver un 401 por esto. El reintento cubre el resto:
   si el primer 401 fue por otro motivo (la cuenta se cerró desde otro
   lado, por ejemplo), pedir las cabeceras de nuevo no cambia nada y el
   segundo intento da el mismo 401 — y ahí se cierra la sesión, que es
   lo correcto. */

import { cabeceras, salir } from "./auth.js";
import { navegar } from "./router.js";
import { LOGIN } from "./nav.js";

/** Mensajes por código, para cuando el backend no manda uno propio.
 *
 * El backend casi siempre manda su propio `message` ya en español
 * (Técnico §9.3): "La suma de las categorías no coincide...", "No se
 * encontró el recurso.". Estos son el resguardo para lo que no pasa
 * por ese camino: un 401/403/500 que arma el servidor de Vercel antes
 * de llegar a FastAPI, o una respuesta sin cuerpo JSON. */
const MENSAJES = {
  VALIDATION_ERROR: "Los datos no son válidos.",
  UNAUTHENTICATED: "Tu sesión venció. Volvé a entrar.",
  FORBIDDEN: "No tenés acceso a este recurso.",
  NOT_FOUND: "No se encontró el recurso.",
  CONFLICT: "Ya existe algo con esos datos.",
  UNPROCESSABLE: "Los datos enviados no son válidos.",
  UPSTREAM_ERROR: "El proveedor externo no respondió. Probá de nuevo en un momento.",
  INTERNAL_ERROR: "Ocurrió un error inesperado. Volvé a intentar en unos minutos.",
  SIN_RED: "No se pudo conectar. Revisá tu conexión e intentá de nuevo.",
};

/** El error de cualquier llamada a la API. Siempre tiene un `message`
 * en español, listo para mostrar tal cual en un toast o en la región
 * de error de un formulario — nunca hace falta mirar `code` para saber
 * qué decirle a alguien, sólo para decidir un comportamiento (por
 * ejemplo, no reintentar un `VALIDATION_ERROR`). */
export class ApiError extends Error {
  /**
   * @param {{code?: string, message?: string, details?: object[], status?: number}} datos
   */
  constructor({ code, message, details, status } = {}) {
    const codigo = code || "INTERNAL_ERROR";
    super(message || MENSAJES[codigo] || MENSAJES.INTERNAL_ERROR);
    this.name = "ApiError";
    this.code = codigo;
    this.details = details || [];
    this.status = status;
  }
}

/** Cierra la sesión y manda al login. Lo usan dos caminos: el botón de
 * "Cerrar sesión" y el segundo 401 seguido de acá adentro. Los dos
 * tienen que hacer exactamente lo mismo, o uno de ellos dejaría algo a
 * medio cerrar. */
export async function cerrarSesion() {
  await salir();
  navegar(LOGIN);
}

/**
 * @param {string} path empieza con `/`, por ejemplo `/me` — el `/api`
 *   lo agrega esta función.
 * @param {RequestInit} [options]
 * @param {boolean} [reintentar] uso interno, para el segundo intento.
 */
async function request(path, options = {}, reintentar = true) {
  const cab = await cabeceras();

  let res;
  try {
    res = await fetch(`/api${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(cab ?? {}),
        ...options.headers,
      },
    });
  } catch (e) {
    // `fetch` rechaza por falta de red, CORS u otro corte antes de
    // llegar al servidor: no hay respuesta que leer, así que es un
    // caso aparte y no un error de la API.
    throw new ApiError({ code: "SIN_RED", status: 0 });
  }

  if (res.status === 401) {
    if (reintentar) {
      // `cabeceras()` se vuelve a pedir en la llamada recursiva: ver la
      // nota de arriba sobre por qué alcanza con eso.
      return request(path, options, false);
    }
    // Segundo 401 seguido: no hay más vueltas que dar. Se cierra la
    // sesión acá mismo y no sólo se avisa, porque dejar una sesión que
    // el servidor ya no acepta abierta en el cliente es peor que
    // cerrarla de más.
    await cerrarSesion();
    throw new ApiError({ code: "UNAUTHENTICATED", status: 401 });
  }

  if (res.status === 204) return null;

  let cuerpo = null;
  try {
    cuerpo = await res.json();
  } catch {
    // Una respuesta sin cuerpo JSON (por ejemplo, un error 500 crudo
    // de la plataforma antes de que corra FastAPI). `cuerpo` queda en
    // `null` y el `!res.ok` de abajo arma el error con lo que hay: el
    // estado HTTP, nada más.
  }

  if (!res.ok) {
    const error = cuerpo?.error ?? {};
    throw new ApiError({ ...error, status: res.status });
  }

  return cuerpo;
}

/** Las cuatro formas de pedir, listas para usar. Cada endpoint nuevo
 * agrega una línea acá, no un `fetch` suelto en otro archivo: es lo
 * que mantiene el token, el reintento y el formato de error en un solo
 * lugar. */
export const api = {
  /** @param {string} path */
  get: (path) => request(path),
  /** @param {string} path @param {object} datos */
  post: (path, datos) =>
    request(path, { method: "POST", body: datos === undefined ? undefined : JSON.stringify(datos) }),
  /** @param {string} path @param {object} datos */
  patch: (path, datos) => request(path, { method: "PATCH", body: JSON.stringify(datos) }),
  /** @param {string} path */
  del: (path) => request(path, { method: "DELETE" }),
};
