/* Formato y escape · F01-T09, F05-T07
   Referencia: 02_Documento_Tecnico.md §12.4 y §12.5

   `esc` es de F01-T09. El formato de importes —`toNum`, `fmt`, `fmtS`,
   `fmtK`, `pct`— es de F05-T07: el documento técnico los pone en este
   mismo archivo para que haya un único lugar donde el frontend toca
   los números. El backend manda strings decimales; estas funciones
   sólo formatean, nunca hacen aritmética financiera. */

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

/** El string decimal del backend, como número. `?? 0` y no `|| 0`:
 * acá no hay riesgo del caso del `0` de `esc()` porque un importe
 * ausente tiene que mostrarse como cero de verdad. */
export function toNum(valor) {
  return Number(valor ?? 0);
}

/** "$3.491.280". Separador de miles es-AR, sin decimales —los
 * importes de la aplicación son pesos enteros— y sin signo: el signo
 * es decisión de quien llama (`fmtS`), nunca de `fmt`. */
export function fmt(valor) {
  return "$" + Math.round(Math.abs(toNum(valor))).toLocaleString("es-AR");
}

/** Como `fmt`, con el signo menos tipográfico (U+2212, no el guión del
 * teclado) cuando el importe es negativo. */
export function fmtS(valor) {
  return (toNum(valor) < 0 ? "−" : "") + fmt(valor);
}

/** "$3,5M" · "$340k" · negativos con el mismo signo que `fmtS`. Para
 * pies de gráfico y fichas chicas, donde el importe completo no entra. */
export function fmtK(valor) {
  const n = toNum(valor);
  const signo = n < 0 ? "−" : "";
  const abs = Math.abs(n);
  if (abs >= 1e6) {
    // Un decimal de más a partir de los diez millones: "12,3M" dice
    // más que "12,34M" cuando la cifra ya tiene siete dígitos.
    const decimales = abs >= 1e7 ? 1 : 2;
    return `${signo}$${(abs / 1e6).toFixed(decimales).replace(".", ",")}M`;
  }
  if (abs >= 1e3) return `${signo}$${Math.round(abs / 1e3)}k`;
  return `${signo}$${Math.round(abs)}`;
}

/** Variación porcentual contra un período anterior: siempre con signo
 * ("+31,7%", "−12,0%"), y "N/A" cuando no hay con qué comparar — nunca
 * 0% ni un error. El signo es parte del significado: una variación
 * sin signo no dice si mejoró o empeoró. */
export function pct(valor) {
  if (valor == null) return "N/A";
  const n = toNum(valor);
  const signo = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${signo}${Math.abs(n).toFixed(1).replace(".", ",")}%`;
}

/** Una proporción, no una variación: la tasa de ahorro, la
 * participación de una categoría. `pct()` no sirve acá —antepone un
 * "+" que en una proporción se lee como una mejora que no existe—,
 * así que esta nunca fuerza el "+". El "−" sí se conserva: una tasa de
 * ahorro negativa (se gastó más de lo que entró) es una cifra distinta
 * de una positiva y perderle el signo sería mentir con el número.
 * Mismo "N/A" sin con qué calcularla. */
export function pctPlano(valor) {
  if (valor == null) return "N/A";
  const n = toNum(valor);
  return `${n < 0 ? "−" : ""}${Math.abs(n).toFixed(1).replace(".", ",")}%`;
}
