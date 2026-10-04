/* ============================================================
   Tema claro / oscuro
   Referencia: .claude/skills/epic-wallet-ui/SKILL.md §1 y §6

   ESTE ARCHIVO SE CARGA BLOQUEANTE EN EL <head>, a propósito.

   El tema tiene que quedar aplicado ANTES del primer pintado: si no,
   alguien con el teléfono en oscuro ve un fogonazo blanco mientras
   carga. La forma habitual de lograrlo es un script en línea, pero la
   política de contenido del proyecto mantiene `script-src 'self'` sin
   `unsafe-inline` (§17), así que va en un archivo aparte.

   Por lo mismo NO es `type="module"` ni lleva `defer`: ambos difieren
   la ejecución hasta después del parseo, que es justo lo que hay que
   evitar. Pesa menos de 1 KB.
   ============================================================ */
(function () {
  "use strict";

  var CLAVE = "epic-wallet:tema";
  var CLARO = "light";
  var OSCURO = "dark";

  /* Los dos colores de la barra de estado de Android. Tienen que
     coincidir con --color-bg-1 de cada tema. */
  var BARRA = { light: "#f1f2f3", dark: "#0c0d0e" };

  function guardado() {
    try {
      var v = localStorage.getItem(CLAVE);
      return v === CLARO || v === OSCURO ? v : null;
    } catch (e) {
      // Modo privado o almacenamiento bloqueado: se sigue sin recordar.
      return null;
    }
  }

  function delSistema() {
    return window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? OSCURO
      : CLARO;
  }

  /** El tema que corresponde ahora: el elegido, o el del sistema. */
  function efectivo() {
    return guardado() || delSistema();
  }

  function aplicar(tema) {
    document.documentElement.setAttribute("data-theme", tema);

    /* La barra de estado del teléfono acompaña. Se usa un solo meta sin
       `media`: en cuanto el usuario elige, su elección manda por encima
       del esquema del sistema. */
    var meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", BARRA[tema] || BARRA.light);
  }

  /* --- se aplica YA, antes de que se pinte nada --- */
  aplicar(efectivo());

  /* --- API para el botón, que se conecta cuando hay DOM --- */
  window.EpicTema = {
    actual: function () {
      return document.documentElement.getAttribute("data-theme") || efectivo();
    },

    alternar: function () {
      var nuevo = this.actual() === OSCURO ? CLARO : OSCURO;
      try {
        localStorage.setItem(CLAVE, nuevo);
      } catch (e) {
        /* sin almacenamiento, el cambio vale sólo para esta visita */
      }

      var sinMovimiento =
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (document.startViewTransition && !sinMovimiento) {
        document.startViewTransition(function () {
          aplicar(nuevo);
        });
      } else {
        aplicar(nuevo);
      }
      return nuevo;
    },

    /** Vuelve a seguir al sistema: olvida la elección. */
    seguirAlSistema: function () {
      try {
        localStorage.removeItem(CLAVE);
      } catch (e) {
        /* nada que olvidar */
      }
      aplicar(delSistema());
    },
  };

  /* Si el usuario nunca eligió, seguir los cambios del sistema en vivo
     (por ejemplo cuando el teléfono pasa a modo oscuro por horario). */
  if (window.matchMedia) {
    var consulta = window.matchMedia("(prefers-color-scheme: dark)");
    var alCambiar = function () {
      if (!guardado()) aplicar(delSistema());
    };
    if (consulta.addEventListener) consulta.addEventListener("change", alCambiar);
    else if (consulta.addListener) consulta.addListener(alCambiar);
  }
})();
