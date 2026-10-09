/* Caché de meses en memoria · F03-T10
   Referencia: 02_Documento_Tecnico.md §9.1 · Roadmap F03-T10

   `GET /api/months` trae TODOS los meses de la cuenta en una sola
   llamada (F03-T05): no hace falta un caché por mes, alcanza con
   guardar esa lista y no volver a pedirla hasta que algo la invalide.
   La barra de mes (barra-mes.js) la usa para moverse entre meses sin
   una llamada por cada flecha — "volver a un mes ya visto no vuelve a
   pedirlo" es gratis así, porque todos los meses llegan juntos desde
   el principio.

   Dar de alta un movimiento (fase 4) va a ser quien llame a
   `invalidarMeses()`, porque ahí cambian los totales del mes abierto.
   Ese aviso se emite como evento de `document` y no como un callback a
   mano: así `invalidarMeses()` no necesita saber que existe una barra
   de mes, y el día de mañana cualquier otra pantalla que dependa de
   los meses puede escuchar el mismo evento sin tocar este archivo. */

import { api } from "./api.js";

export const EVENTO_INVALIDADO = "meses:invalidados";

let pedido = null;

/** La lista de meses, pedida una sola vez y reusada. Dos llamadas
 * simultáneas antes de que la primera responda comparten el mismo
 * pedido en vez de duplicarlo. */
export function meses() {
  if (!pedido) pedido = api.get("/months");
  return pedido;
}

/** Se llama después de escribir algo que cambia un mes: la próxima
 * `meses()` vuelve a pedir la lista en vez de devolver la vieja. */
export function invalidarMeses() {
  pedido = null;
  document.dispatchEvent(new CustomEvent(EVENTO_INVALIDADO));
}
