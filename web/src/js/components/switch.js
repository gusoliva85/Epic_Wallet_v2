/* El conmutador de pastillas · `.view-switch`
   Referencia: skill epic-wallet-ui §8 ("Otros", `.view-switch`) y §11.1

   Un solo módulo dueño del comportamiento de TODOS los conmutadores
   de la aplicación: el del gráfico diario, el del filtro de
   movimientos, el de tipo en el alta, el del tema en Ajustes. Antes
   cada pantalla marcaba la pastilla elegida por su cuenta y, además,
   `views/vistas.js` tenía un delegado genérico que marcaba cualquier
   `.view-switch button` del documento: dos dueños para la misma
   clase. De ahí salían los estados raros que Gustavo venía viendo —
   dos pastillas marcadas a la vez, o ninguna, cuando el módulo
   volvía a pintar su conmutador después de que el delegado ya lo
   había tocado.

   Acá hay un solo dueño y dos funciones públicas:

   - `activar(boton)` marca esa opción dentro de su grupo.
   - `sincronizar(grupo)` vuelve a medir, para cuando un módulo marcó
     la clase `activa` por su cuenta o acaba de escribir el HTML del
     grupo entero.

   LA PASTILLA ES UN SOLO ELEMENTO QUE SE DESLIZA. No es el fondo de
   cada botón encendiéndose y apagándose: es un `<span class="vs-ind">`
   absoluto dentro del surco, que viaja hasta la opción elegida
   (`transform` y `width`, las dos propiedades que el compositor
   anima sin recalcular el layout). Es la animación que pidió
   Gustavo. Pasar el puntero por otra opción la muestra más tenue
   antes de elegirla; al sacarlo vuelve a la real.

   Medir un grupo oculto da 0 (una vista con `hidden`, una hoja sin
   abrir), así que hay un `ResizeObserver` por grupo: cuando aparece,
   se vuelve a medir sin animación. Por eso tampoco hace falta que
   cada hoja avise que se abrió. */

const indicadores = new WeakMap();

/** `true` en un dispositivo con puntero de verdad: la vista previa
 * al pasar por encima no tiene sentido con el dedo, donde "pasar por
 * encima" es ya haber tocado. */
const conPuntero = () =>
  window.matchMedia ? window.matchMedia("(hover: hover)").matches : false;

function botonesDe(grupo) {
  return /** @type {HTMLButtonElement[]} */ ([...grupo.querySelectorAll("button")]);
}

/** Coloca la pastilla sobre `boton`. Con `animar: false` salta sin
 * transición: el primer dibujo y los recálculos por cambio de tamaño
 * no son un cambio de opción y no tienen que verse viajar. */
function mover(grupo, boton, { animar = true, previo = false } = {}) {
  const ind = indicadores.get(grupo);
  if (!ind || !boton) return;

  const ancho = boton.offsetWidth;
  // Grupo oculto (vista con `hidden`, hoja cerrada): no hay nada que
  // medir todavía. El ResizeObserver vuelve a llamar cuando aparezca.
  if (!ancho) {
    grupo.removeAttribute("data-listo");
    return;
  }

  // La primera vez que se posiciona no se anima nunca, aunque quien
  // llame pida animación: la pastilla mide 0 y apoyada en el borde
  // izquierdo, y se vería entrar deslizándose en cada pantalla que se
  // abre.
  const quieto = !animar || !ind.style.width;

  if (quieto) {
    ind.classList.add("vs-ind--quieto");
    // Forzar el reflow es lo que hace que el salto sea un salto: sin
    // esto, el navegador junta el cambio de clase con el de posición
    // en el mismo cuadro y la transición se ejecuta igual.
    void ind.offsetWidth;
  }

  ind.style.width = `${ancho}px`;
  ind.style.transform = `translateX(${boton.offsetLeft}px)`;
  ind.classList.toggle("vs-ind--previo", previo);
  grupo.setAttribute("data-listo", "1");

  if (quieto) {
    void ind.offsetWidth;
    ind.classList.remove("vs-ind--quieto");
  }
}

function activoDe(grupo) {
  return grupo.querySelector("button.activa") ?? botonesDe(grupo)[0] ?? null;
}

/** Crea la pastilla del grupo y lo deja observado. Idempotente: se
 * puede llamar las veces que haga falta. */
function preparar(grupo) {
  let ind = indicadores.get(grupo);
  if (ind && ind.isConnected) return ind;

  ind = document.createElement("span");
  ind.className = "vs-ind";
  // Decoración pura: lo que se anuncia es el estado de cada botón.
  ind.setAttribute("aria-hidden", "true");
  grupo.prepend(ind);
  indicadores.set(grupo, ind);

  if (typeof ResizeObserver === "function") {
    new ResizeObserver(() => mover(grupo, activoDe(grupo), { animar: false })).observe(grupo);
  }

  if (conPuntero()) {
    grupo.addEventListener("pointerover", (ev) => {
      const b = ev.target.closest?.("button");
      if (!b || !grupo.contains(b) || b.disabled) return;
      mover(grupo, b, { previo: !b.classList.contains("activa") });
    });
    grupo.addEventListener("pointerleave", () => mover(grupo, activoDe(grupo)));
  }

  return ind;
}

/**
 * Vuelve a medir un grupo. Para después de escribir su HTML o de
 * marcar `activa` desde el módulo dueño de la pantalla.
 *
 * @param {Element | null | undefined} grupo
 * @param {{animar?: boolean}} opciones
 */
export function sincronizar(grupo, { animar = false } = {}) {
  if (!grupo) return;
  preparar(grupo);
  mover(grupo, activoDe(grupo), { animar });
}

/**
 * Marca una opción dentro de su grupo y desliza la pastilla hasta
 * ella. Es el único lugar donde se escribe la clase `activa` de un
 * conmutador.
 *
 * @param {Element | null | undefined} boton
 */
export function activar(boton) {
  const grupo = boton?.closest?.(".view-switch");
  if (!grupo) return;
  for (const otro of botonesDe(grupo)) {
    const esta = otro === boton;
    otro.classList.toggle("activa", esta);
    otro.setAttribute("aria-pressed", String(esta));
  }
  sincronizar(grupo, { animar: true });
}

/** Prepara y mide todos los conmutadores que haya en el documento. */
export function sincronizarTodos() {
  for (const grupo of document.querySelectorAll(".view-switch")) sincronizar(grupo);
}

export function arrancar() {
  document.addEventListener("click", (ev) => {
    const boton = ev.target.closest?.(".view-switch button");
    if (!boton || boton.disabled) return;
    activar(boton);
  });
  // Un cambio de ancho del grupo lo ve su propio ResizeObserver; esto
  // cubre el caso del grupo que no cambia de ancho pero sí de
  // posición interna (la tipografía recién cargada, por ejemplo).
  window.addEventListener("resize", sincronizarTodos);
  sincronizarTodos();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", arrancar);
  } else {
    arrancar();
  }
}
