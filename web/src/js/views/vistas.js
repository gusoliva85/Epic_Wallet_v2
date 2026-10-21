/* Contenido de las siete vistas · F01-T13

   Un módulo por vista sería más prolijo, pero hoy cada uno sería diez
   líneas que leen de `datos-muestra.js` y escriben en un contenedor.
   Se separan cuando tengan lógica propia: en la fase 3 inicio pide el
   tablero, en la 4 movimientos filtra, en la 6 cartera actualiza
   cotizaciones. Mientras tanto, verlas juntas hace evidente que ninguna
   inventa un número por su cuenta.

   Lo que NO hace esta tarea: ningún filtro, ningún conmutador y ningún
   gráfico funcionan todavía. Están maquetados y en su lugar; la lógica
   es de las fases que les corresponden. */

import { esc } from "../format.js";
import { crearHoja } from "../components/sheet.js";
import { conectarSinConexion } from "../components/estados.js";
import * as D from "../datos-muestra.js";

const $ = (id) => document.getElementById(id);

function escribir(id, html) {
  const caja = $(id);
  if (caja) caja.innerHTML = html;
}

// La vista Inicio (#kpis-inicio/#grafico-diario/#categorias-inicio) y
// la lista de `#movimientos-lista` con su filtro `#mov-categoria`:
// todo eso son datos reales desde F05-T07, F06-T02 (dashboard.js) y
// F04-T12 (movimientos.js). Ya no hay nada de muestra que escribir
// para ninguno de los dos — mismo caso que las categorías de
// `config()`, más abajo. "Últimos movimientos" (la sección que
// faltaba acá) se sacó del dashboard después de F06-T07: duplicaba
// esta misma lista sin aportar nada (General §55).

/* La vista Historial (tabla #historial-tabla, #grafico-seis y la
   carga de un mes histórico) tiene datos reales desde F08-T07
   (historial.js); el gráfico de últimos seis meses se mudó acá desde
   Inicio el 2026-10-17. Ya no hay nada de muestra que escribir acá —
   mismo caso que Inicio y Movimientos, más arriba. */

/* La vista Cartera (indicadores, tabla, alta y detalle) tiene datos
   reales desde F10-T08 (`cartera.js`, `GET /api/investments`). Ya no
   hay nada de muestra que escribir acá — mismo caso que Inicio,
   Movimientos, Historial y Patrimonio, más arriba. */

/* La vista Patrimonio (ecuación, composición y su pie) tiene datos
   reales desde F09-T05 (`patrimonio.js`, `GET /api/patrimony`). Ya no
   hay nada de muestra que escribir acá — mismo caso que Inicio,
   Movimientos e Historial, más arriba. `ficha()` se queda, la sigue
   usando `analisis()` más abajo. */

function ficha(nombre, valor, total = false) {
  return (
    `<div class="kv cg${total ? " kv--total" : ""}">` +
    `<span>${esc(nombre)}</span><b class="num">${esc(valor)}</b></div>`
  );
}

/* ---------------------------------------------------------- análisis */

function analisis() {
  escribir(
    "analisis-salarios",
    D.SALARIOS.map(
      (s) =>
        '<div class="row cg" style="cursor: default; grid-template-columns: 1fr auto">' +
        `<span class="row-main"><b>${esc(s.desde)}</b><span>Sueldo vigente desde este mes</span></span>` +
        `<span class="row-val"><b class="num">${esc(s.importe)}</b><span>${esc(s.variacion)}</span></span>` +
        "</div>",
    ).join(""),
  );

  escribir(
    "analisis-metricas",
    D.METRICAS.map((m) => ficha(m.nombre, m.valor)).join(""),
  );
}

/* La vista Ajustes: "Categorías" tiene datos reales desde F03-T10
   (config-categorias.js) y "Preferencias" desde F11-T01
   (config-preferencias.js, el tema real). Ya no hay nada de muestra
   que escribir para ninguna de las dos — mismo caso que Inicio,
   Movimientos, Historial, Patrimonio y Cartera, más arriba.

   "Datos laborales" (#config-laborales): desde F09-T05 lo pinta
   `saldo-inicial.js` — tres fichas siguen siendo de muestra
   (historial salarial, después del MVP) y una es real (el saldo
   inicial). */

/* ------------------------------------------------------------ armado */

export function pintarVistas() {
  analisis();
}

/** Los interruptores de ajustes y los conmutadores, sin lógica real.
    Cambian de estado para poder verlos; lo que hacen es de su fase. */
function conectarControles() {
  document.addEventListener("click", (ev) => {
    const sw = ev.target.closest(".toggle");
    // Las categorías tienen datos reales desde F03-T10: su propio
    // interruptor (config-categorias.js) llama a la API y pinta de
    // nuevo; si este delegado genérico lo tocara también, el segundo
    // cambio de `aria-checked` dejaría el botón mintiendo sobre el
    // estado real.
    if (sw && !sw.closest("#config-categorias")) {
      sw.setAttribute(
        "aria-checked",
        sw.getAttribute("aria-checked") !== "true",
      );
      return;
    }
    if (sw) return;
    const boton = ev.target.closest(".view-switch button");
    if (boton) {
      for (const otro of boton.parentElement.children)
        otro.classList.remove("activa");
      boton.classList.add("activa");
    }
  });
}

/* Las alertas viven en una hoja que abre la campanita de la barra
   superior, no en el tablero. En el tablero competían con los
   indicadores y empujaban el resto de la pantalla hacia abajo; acá
   están cuando se las busca.

   El contador de la campanita sale de la misma lista: escrito a mano
   diría un número y la hoja mostraría otro. */
function conectarAlertas() {
  const hoja = $("hoja-alertas");
  const disparador = $("btn-alertas");
  const control = hoja && crearHoja(hoja, { disparador });
  if (!control) return;

  escribir("alertas-lista", D.ALERTAS.map(aviso).join(""));

  const contador = $("contador-alertas");
  if (contador) {
    contador.textContent = String(D.ALERTAS.length);
    // Sin alertas no se muestra el globo: un cero rojo alarma sin
    // motivo.
    contador.hidden = D.ALERTAS.length === 0;
  }
  disparador?.setAttribute(
    "aria-label",
    D.ALERTAS.length === 1
      ? "Alertas: 1 sin leer"
      : `Alertas: ${D.ALERTAS.length} sin leer`,
  );
}

function conectar() {
  pintarVistas();
  conectarAlertas();
  conectarControles();
  conectarSinConexion();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", conectar);
} else {
  conectar();
}
