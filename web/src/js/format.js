/* Formato y escape · F01-T09
   Referencia: 02_Documento_Tecnico.md §12.4 y §12.5

   Por ahora sólo `esc`, que es lo que necesitan los componentes. El
   formato de importes —`toNum`, `fmt`, `fmtS`, `fmtK`, `pct`— es de
   F05-T10 y se agrega acá: el documento técnico los pone en este mismo
   archivo para que haya un único lugar donde el frontend toca los
   números. */

/**
 * Convierte un valor en texto seguro para meter en una plantilla.
 *
 * **Regla obligatoria del sistema (skill, regla 5): todo dato que venga
 * del backend pasa por acá antes de entrar en HTML.** Una descripción
 * de movimiento que diga `<script>` tiene que verse como texto, no
 * ejecutarse. El backend no valida el contenido de una descripción, y
 * no debería: el que tiene que no confiar es quien lo pinta.
 *
 * Se escapan cinco caracteres y no tres. Con sólo `&<>` basta para el
 * texto entre etiquetas, pero no para un valor dentro de un atributo:
 * ahí una comilla cierra el atributo y abre otro. Como estas funciones
 * se usan en los dos lugares, se escapan los cinco siempre.
 *
 * @param {unknown} valor
 * @returns {string}
 */
export function esc(valor) {
  // `?? ""` y no `|| ""`: un 0 es un valor legítimo y `||` lo
  // convertiría en cadena vacía. En una aplicación de finanzas, un
  // importe de 0 que desaparece es un error difícil de ver.
  return String(valor ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
}
