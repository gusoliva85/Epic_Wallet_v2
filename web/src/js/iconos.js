/* Los iconos, como trazo SVG · F01-T09
   Salen del mockup aprobado (constante ICO).

   Van en un módulo y no en cada componente para que el mismo concepto
   —un ingreso, un egreso, el ahorro— se dibuje igual en toda la
   aplicación. Son trazos sin `<svg>` alrededor: quien los usa pone el
   envoltorio con su propio tamaño.

   No se escapan ni pasan por `esc()` a propósito: son constantes de la
   aplicación, no datos. Lo que nunca puede pasar es que un icono venga
   del servidor; para eso está la lista cerrada de `icono()`. */

const TRAZOS = {
  sube: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  baja: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  ahorro:
    '<path d="M4 12a6 6 0 016-6h5l3-2v4a6 6 0 01-2 4.5V17h-3v-2h-3v2H7v-2.2A6 6 0 014 12z"/>',
  caja:
    '<rect x="3" y="4" width="18" height="16" rx="3"/>' +
    '<circle cx="12" cy="12" r="3.6"/><path d="M12 5.5v2M12 16.5v2"/>',
  grafico: '<path d="M3 17l5-6 4 3.5L21 6"/><path d="M15.5 6H21v5.5"/>',
  billetera:
    '<path d="M3 8.5A2.5 2.5 0 015.5 6H19a2 2 0 012 2v9a2 2 0 01-2 2H5.5A2.5 2.5 0 013 16.5v-8z"/>' +
    '<path d="M3 9.5h13.5a1.5 1.5 0 011.5 1.5v3a1.5 1.5 0 01-1.5 1.5H3"/>' +
    '<circle cx="7" cy="12.5" r="1.1"/>',
  porcentaje:
    '<path d="M19 5L5 19"/><circle cx="7.5" cy="7.5" r="2.5"/>' +
    '<circle cx="16.5" cy="16.5" r="2.5"/>',
  calendario:
    '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
};

/** Los nombres válidos. Útil para las pruebas y para no adivinar. */
export const ICONOS = Object.freeze(Object.keys(TRAZOS));

/**
 * Devuelve el trazo de un icono por nombre.
 *
 * Un nombre que no existe devuelve cadena vacía y no `undefined`: así
 * una tarjeta con un icono mal escrito sale sin icono en lugar de
 * mostrar «undefined» dentro del SVG.
 */
export function icono(nombre) {
  return TRAZOS[nombre] ?? "";
}

/* ============================================================
   MARCAS DE AGUA · siluetas de fondo de las tarjetas

   Van en un lienzo de 48×32 y no de 24×24 como los iconos: son el
   doble de anchas porque cada una combina DOS figuras —el signo pesos
   y lo que identifica la tarjeta— y en un cuadrado se pisarían.

   Trazo simple y abierto a propósito: se dibujan muy traslúcidas y
   agrandadas, y un trazo con detalle a esa opacidad se ve como una
   mancha sucia en lugar de una silueta.
   ============================================================ */

/* El signo pesos, a la izquierda del lienzo. Se repite en las cuatro
   porque es lo que dice que la tarjeta habla de dinero. */
const PESOS =
  '<path d="M19.5 10.5c-1.2-1.3-3.1-2.1-5.3-2.1-3.1 0-5.1 1.3-5.1 3.4 0 ' +
  "2.2 1.8 2.9 5.2 3.6 3.5.7 5.7 1.6 5.7 4 0 2.3-2.2 3.8-5.6 3.8-2.3 " +
  '0-4.4-.7-5.7-2"/><path d="M12.5 5v22"/><path d="M16.5 5v22"/>';

const MARCAS = {
  // Ingresos: el dinero que entra.
  "pesos-sube": `${PESOS}<path d="M36 27V9"/><path d="M30 15l6-6 6 6"/>`,
  // Egresos: el que sale.
  "pesos-baja": `${PESOS}<path d="M36 5v18"/><path d="M30 17l6 6 6-6"/>`,
  // Gasto del día: el dinero de una fecha.
  "pesos-dia":
    `${PESOS}<rect x="29" y="9" width="15" height="17" rx="2.5"/>` +
    '<path d="M29 15h15"/><path d="M33.5 6v5"/><path d="M39.5 6v5"/>',
  // Patrimonio: lo que está guardado.
  "pesos-caja":
    `${PESOS}<rect x="29" y="8" width="15" height="18" rx="2.5"/>` +
    '<circle cx="36.5" cy="17" r="4"/><path d="M36.5 11v1.5"/>' +
    '<path d="M36.5 21.5v1.5"/>',
};

/** Los nombres válidos de marca de agua. */
export const MARCAS_VALIDAS = Object.freeze(Object.keys(MARCAS));

/**
 * Devuelve el trazo de una marca de agua por nombre.
 *
 * Igual que `icono()`: un nombre que no existe devuelve cadena vacía,
 * nunca `undefined` dentro del SVG.
 */
export function marca(nombre) {
  return MARCAS[nombre] ?? "";
}
