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
  // --- severidades, para los avisos ---
  tilde: '<path d="M4.5 12.5l5 5 10-11"/>',
  aviso:
    '<path d="M12 3.8L2.6 20.2h18.8L12 3.8z"/><path d="M12 10v4.2"/>' +
    '<circle cx="12" cy="17.4" r="1"/>',
  reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.3l3.4 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.9" r="1"/>',

  // Libro mayor: lo que registra el patrimonio.
  libro:
    '<path d="M6 4h11.5A1.5 1.5 0 0119 5.5v15H7.5A1.5 1.5 0 016 19V4z"/>' +
    '<path d="M9.2 4v16.5"/>',
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
