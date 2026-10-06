/* Las siete secciones de la aplicación, en un solo lugar.
   La barra superior (F01-T05), la inferior (F01-T06) y el enrutador
   (F01-T07) leen de acá: si una sección cambia de nombre o de icono,
   se cambia una vez y las tres quedan de acuerdo.

   `corta` es la etiqueta de la barra inferior, donde hay cinco
   posiciones en 390 px y "Movimientos" no entra. `en_barra_inferior`
   marca las cinco que van ahí; las otras dos viven en la hoja "Más".

   Referencia: documentacion/mockups/01_Mockup_V1_Grafito_Clasico.html
   (constante NAV) · Roadmap F01-T05 y F01-T06. */

export const SECCIONES = [
  {
    id: "inicio",
    label: "Inicio",
    corta: "Inicio",
    en_barra_inferior: true,
    icono:
      '<path d="M3 10.5L12 3l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/><path d="M9.5 20v-5.5h5V20"/>',
  },
  {
    id: "movimientos",
    label: "Movimientos",
    corta: "Movim.",
    en_barra_inferior: true,
    icono:
      '<path d="M4 7h11M4 7l3-3M4 7l3 3"/><path d="M20 17H9M20 17l-3-3M20 17l-3 3"/>',
  },
  {
    id: "historial",
    label: "Historial",
    corta: "Historial",
    en_barra_inferior: true,
    icono: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  },
  {
    id: "inversiones",
    label: "Cartera",
    corta: "Cartera",
    en_barra_inferior: true,
    icono: '<path d="M3 17l5-6 4 3.5L21 6"/><path d="M15.5 6H21v5.5"/>',
  },
  {
    id: "patrimonio",
    label: "Patrimonio",
    corta: "Patrimonio",
    en_barra_inferior: false,
    icono:
      '<path d="M3 9.5L12 4l9 5.5"/><path d="M5.5 9.5V19h13V9.5"/>' +
      '<path d="M9 19v-4h6v4"/><path d="M3 21h18"/>',
  },
  {
    id: "analisis",
    label: "Análisis",
    corta: "Análisis",
    en_barra_inferior: false,
    icono: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  },
  {
    id: "config",
    label: "Ajustes",
    corta: "Ajustes",
    en_barra_inferior: false,
    icono:
      '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.2M12 19.3v2.2' +
      'M4.2 7.3l1.9 1.1M17.9 15.6l1.9 1.1M4.2 16.7l1.9-1.1M17.9 8.4l1.9-1.1"/>',
  },
];

/** Las pantallas de cuenta: rutas de verdad, pero fuera de la aplicación.
 *
 * Están acá y no en `SECCIONES` justamente porque **no** son secciones:
 * si entraran en esa lista aparecerían como una posición más en las dos
 * barras de navegación, que es lo último que queremos. Pero sí son
 * rutas —tienen hash, historial y «atrás»—, así que el enrutador tiene
 * que conocerlas.
 *
 * Crecen con las tareas: `registro` en F02-T10, `recuperar` y
 * `nueva-clave` en F16-T13 y F16-T14. Se agregan acá cuando la pantalla
 * existe, no antes: una ruta declarada sin pantalla deja la aplicación
 * en blanco, que es peor que caer en el inicio.
 *
 * Quién puede entrar a cada una lo decide la guardia de F02-T12. Hasta
 * entonces estas pantallas son alcanzables y la aplicación sigue
 * abierta: bloquearla antes de que exista el registro dejaría a todo el
 * mundo afuera.
 */
export const PUBLICAS = [{ id: "login", label: "Iniciar sesión" }];

/** @param {string} id */
export function esPublica(id) {
  return PUBLICAS.some((p) => p.id === id);
}

/** La sección que se abre cuando no hay ninguna indicada o la ruta no existe. */
export const INICIO = "inicio";

/** Busca una sección por id. Devuelve `undefined` si no existe, para que
    quien llame decida: el enrutador cae en el inicio, no explota. */
export function seccion(id) {
  return SECCIONES.find((s) => s.id === id);
}

/** El título de documento de cualquier ruta, de sección o de cuenta. */
export function tituloDeRuta(id) {
  const s = seccion(id) ?? PUBLICAS.find((p) => p.id === id);
  return s ? `${s.label} · Epic Wallet` : null;
}
