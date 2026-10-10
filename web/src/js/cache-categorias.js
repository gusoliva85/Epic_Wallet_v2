/* Caché de categorías en memoria · optimización posterior a F04-T12
   Referencia: 02_Documento_Tecnico.md §9.1 · mismo patrón que
   `cache-meses.js`

   Tres pantallas necesitan la lista completa de categorías
   (`config-categorias.js` para administrarlas, `movimientos.js` para
   mostrar el nombre en cada fila, `alta-movimiento.js` para el
   selector del alta y de la edición): sin este caché, cada una la
   pedía por su cuenta y una cuenta recién entrada disparaba el mismo
   `GET /api/categories` dos o tres veces en la misma carga — parte de
   por qué "el mes tarda en cargar" (Gustavo, F04 cerrada).

   `activas()` no pide nada aparte: se filtra en el cliente a partir
   de la misma lista completa, así el alta —que sólo ofrece categorías
   activas— no agrega un segundo pedido con `?active=true`. */

import { api } from "./api.js";

let pedido = null;

/** Todas las categorías (activas e inactivas), pedidas una sola vez.
 * Si el pedido falla se limpia solo, igual que `cache-meses.js`: un
 * 401 al arrancar no deja la lista vacía para siempre. */
export function categorias() {
  if (!pedido) {
    pedido = api.get("/categories").catch((e) => {
      pedido = null;
      throw e;
    });
  }
  return pedido;
}

/** Las activas, derivadas de la misma lista — sin pedido aparte. */
export async function activas() {
  return (await categorias()).filter((c) => c.active);
}

/** Se llama después de crear, renombrar o archivar una categoría. */
export function invalidarCategorias() {
  pedido = null;
}
