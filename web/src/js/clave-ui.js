/* Los dos ayudantes de un campo de contraseña nueva · F11-T03
   Referencia: `.claude/skills/epic-wallet-ui/SKILL.md` §8 «Pantallas de
   cuenta» · 02_Documento_Tecnico.md §8.9

   El medidor de fortaleza y la validación en vivo de «repetir» nacieron
   en `registro.js` (F02-T10) y la pantalla de contraseña nueva pide
   exactamente los mismos dos. Se mudaron acá en vez de copiarse: son
   reglas de interfaz —cuándo decir «Débil», a partir de cuántos
   caracteres, qué se muestra con el campo vacío— y dos copias terminan
   diciendo cosas distintas el día que una se ajusta.

   Lo que NO hace este archivo: validar el envío. El medidor es
   orientativo (skill §8) y lo único que de verdad bloquea es el mínimo
   de 8 caracteres, que lo chequea cada pantalla en su `alEnviar` —y el
   servidor otra vez, que es el que manda. */

/** El mínimo que exige Supabase (Técnico §8.9). La interfaz lo repite
 * para no gastar una vuelta de red en un error que ya se sabe. */
export const MINIMO_CLAVE = 8;

/**
 * Puntúa una contraseña del 0 al 4. No es criptografía, es una guía.
 *
 * @param {string} clave
 * @returns {0 | 1 | 2 | 3 | 4}
 */
export function puntuarFortaleza(clave) {
  if (!clave) return 0;
  let p = 0;
  if (clave.length >= MINIMO_CLAVE) p++;
  if (clave.length >= 12) p++;
  if (/[a-z]/.test(clave) && /[A-Z]/.test(clave)) p++;
  if (/[0-9]/.test(clave)) p++;
  if (/[^a-zA-Z0-9]/.test(clave)) p++;
  // Cinco criterios posibles, máximo 4: largo por sí solo no alcanza
  // para "fuerte" si no hay ninguna variedad de caracteres.
  return /** @type {0|1|2|3|4} */ (Math.min(p, 4));
}

const NIVELES = [
  { etiqueta: "", color: "" },
  { etiqueta: "Débil", color: "var(--color-crit)" },
  { etiqueta: "Débil", color: "var(--color-crit)" },
  { etiqueta: "Media", color: "var(--color-warn)" },
  { etiqueta: "Fuerte", color: "var(--color-ok)" },
];

/**
 * Pinta la barra y el texto del medidor.
 *
 * Se esconde entero con el campo vacío: una barra en cero no dice nada
 * y ocupa lugar. Y por debajo del mínimo no muestra «Débil», dice
 * cuánto falta — es más útil y es la validación en vivo del mínimo.
 *
 * @param {string} clave
 * @param {{contenedor: HTMLElement | null, barra: HTMLElement | null, texto: HTMLElement | null}} partes
 */
export function mostrarFortaleza(clave, { contenedor, barra, texto }) {
  if (!contenedor || !barra || !texto) return;

  if (!clave) {
    contenedor.hidden = true;
    return;
  }
  contenedor.hidden = false;

  if (clave.length < MINIMO_CLAVE) {
    const faltan = MINIMO_CLAVE - clave.length;
    barra.style.width = `${(clave.length / MINIMO_CLAVE) * 25}%`;
    barra.style.background = "var(--color-crit)";
    texto.textContent = `Falta${faltan === 1 ? "" : "n"} ${faltan}`;
    return;
  }

  const nivel = puntuarFortaleza(clave);
  const { etiqueta, color } = NIVELES[nivel];
  barra.style.width = `${(nivel / 4) * 100}%`;
  barra.style.background = color;
  texto.textContent = etiqueta;
}

/**
 * Dice si las dos contraseñas coinciden y lo escribe en la nota.
 *
 * Con el segundo campo vacío devuelve `true` y no escribe nada: no hay
 * «coincide» ni «no coincide» que decir todavía, y un «no coinciden»
 * apenas se empieza a tipear se lee como un error propio.
 *
 * @param {{campo: HTMLInputElement | null, repetir: HTMLInputElement | null, nota: HTMLElement | null}} partes
 * @returns {boolean}
 */
export function actualizarCoincidencia({ campo, repetir, nota }) {
  if (!campo || !repetir || !nota) return true;

  if (!repetir.value) {
    nota.textContent = "";
    nota.className = "campo-nota";
    return true;
  }

  const coincide = campo.value === repetir.value;
  nota.textContent = coincide ? "Coinciden." : "Las contraseñas no coinciden.";
  nota.className = coincide ? "campo-nota campo-nota--ok" : "campo-nota campo-nota--crit";
  return coincide;
}
