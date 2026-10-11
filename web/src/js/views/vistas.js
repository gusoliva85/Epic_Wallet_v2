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

import { esc, toNum } from "../format.js";
import {
  tarjetaHeroe,
  tarjetaMetrica,
  pintarTarjetas,
} from "../components/kpi.js";
import { aviso, pildora } from "../components/avisos.js";
import { crearHoja } from "../components/sheet.js";
import { conectarSinConexion } from "../components/estados.js";
import { toast } from "../components/toast.js";
import * as D from "../datos-muestra.js";

const $ = (id) => document.getElementById(id);

function escribir(id, html) {
  const caja = $(id);
  if (caja) caja.innerHTML = html;
}

// La vista Inicio (#kpis-inicio/#grafico-diario/#grafico-seis/
// #categorias-inicio) y la lista de `#movimientos-lista` con su
// filtro `#mov-categoria`: todo eso son datos reales desde F05-T07,
// F06-T02/F06-T05 (dashboard.js) y F04-T12 (movimientos.js). Ya no
// hay nada de muestra que escribir para ninguno de los dos — mismo
// caso que las categorías de `config()`, más abajo. "Últimos
// movimientos" (la sección que faltaba acá) se sacó del dashboard
// después de F06-T07: duplicaba esta misma lista sin aportar nada
// (General §55).

/* --------------------------------------------------------- historial */

/* Qué píldora le toca a cada tipo de mes. El tipo no es decorativo:
   decide si la pantalla puede mostrar movimientos (regla 4). */
const TIPO_MES = {
  abierto: { texto: "Abierto", pildora: "info" },
  transaccional: { texto: "Transaccional", pildora: "ok" },
  consolidado: { texto: "Consolidado", pildora: "neutral" },
};

function historial() {
  escribir(
    "historial-tabla",
    D.HISTORIAL.map((m) => {
      const t = TIPO_MES[m.tipo] ?? TIPO_MES.consolidado;
      return (
        "<tr>" +
        `<td>${esc(m.mes)}</td>` +
        `<td class="num">${esc(m.ingresos)}</td>` +
        `<td class="num">${esc(m.egresos)}</td>` +
        `<td class="num">${esc(m.ahorro)}</td>` +
        `<td class="num">${esc(m.tasa)}</td>` +
        `<td>${pildora({ texto: t.texto, tipo: t.pildora })}</td>` +
        "</tr>"
      );
    }).join(""),
  );
}

/* ----------------------------------------------------------- cartera */

function cartera() {
  pintarTarjetas($("kpis-cartera"), [
    tarjetaHeroe({
      etiqueta: "Valor de la cartera",
      cifra: D.CARTERA.valor,
      sub: `${D.CARTERA.rendimiento} sobre lo invertido`,
      porcentaje: 73,
      pieIzq: `Invertido ${D.CARTERA.invertido}`,
      pieDer: `${D.CARTERA.posiciones} posiciones`,
      color: "sav",
    }),
    tarjetaMetrica({
      etiqueta: "Invertido",
      cifra: D.CARTERA.invertido,
      sub: "Suma de los valores iniciales",
      tarjeta: "pat",
    }),
    tarjetaMetrica({
      etiqueta: "Rendimiento",
      cifra: D.CARTERA.rendimiento,
      sub: "Sobre el total de la cartera",
      tarjeta: "inc",
    }),
  ]);

  escribir(
    "cartera-tabla",
    D.INVERSIONES.map(
      (i) =>
        "<tr>" +
        `<td>${esc(i.nombre)}</td>` +
        `<td class="num">${esc(i.nominales)}</td>` +
        `<td class="num">${esc(i.inicial)}</td>` +
        `<td class="num">${esc(i.actual)}</td>` +
        `<td class="num amt-in">${esc(i.rendimiento)}</td>` +
        `<td>${esc(i.fuente)}</td>` +
        "</tr>",
    ).join(""),
  );
}

/* -------------------------------------------------------- patrimonio */

function ficha(nombre, valor, total = false) {
  return (
    `<div class="kv cg${total ? " kv--total" : ""}">` +
    `<span>${esc(nombre)}</span><b class="num">${esc(valor)}</b></div>`
  );
}

/* La barra de composición (líquido vs. invertido) es un dato de
   ejemplo a propósito, hasta F10 (General §54, Gráfico 5; roadmap
   F06-T07): sin inversiones todavía en la base, no hay una segunda
   parte real que mostrar. El aviso de abajo lo deja explícito en
   vez de dejar que se confunda con una cifra real. Los porcentajes
   ya llegan calculados en `D.PATRIMONIO` —acá sólo deciden el ancho
   de su propio segmento, no se suma ni se divide nada. */
function barraDeComposicion() {
  const liquido = toNum(D.PATRIMONIO.liquido);
  const invertido = toNum(D.PATRIMONIO.invertido);
  return (
    '<div class="comp-track">' +
    `<div style="width: ${liquido}%; background: var(--color-sav)"></div>` +
    `<div style="width: ${invertido}%; background: var(--color-accent-2)"></div>` +
    "</div>" +
    '<div class="legend" style="padding-top: 10px">' +
    `<span><i class="dot" style="background: var(--color-sav)"></i>Ahorro líquido <b class="num">${esc(D.PATRIMONIO.ahorro)}</b></span>` +
    `<span><i class="dot" style="background: var(--color-accent-2)"></i>Inversiones <b class="num">${esc(D.PATRIMONIO.inversiones)}</b></span>` +
    "</div>" +
    '<p class="comp-aviso">Datos de ejemplo — se conecta con las inversiones reales en la Fase 9.</p>'
  );
}

function patrimonio() {
  escribir(
    "patrimonio-ecuacion",
    ficha("Ahorro disponible", D.PATRIMONIO.ahorro) +
      ficha("Inversiones", D.PATRIMONIO.inversiones) +
      ficha("Pasivos", D.PATRIMONIO.pasivos) +
      ficha("Patrimonio neto", D.PATRIMONIO.total, true),
  );

  escribir("grafico-composicion", barraDeComposicion());

  escribir(
    "patrimonio-pie",
    `<div class="mini cg"><span>Líquido</span><b class="num">${esc(D.PATRIMONIO.liquido)}</b></div>` +
      `<div class="mini cg"><span>Invertido</span><b class="num">${esc(D.PATRIMONIO.invertido)}</b></div>`,
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

/* ----------------------------------------------------------- ajustes */

function config() {
  // Categorías: F03-T10 las reemplazó por datos reales de
  // `GET /api/categories`, pintados por config-categorias.js. Ya no
  // hay nada de muestra que escribir acá.

  escribir(
    "config-preferencias",
    D.PREFERENCIAS.map(
      (p) =>
        '<div class="cfg-row cg">' +
        `<div><b>${esc(p.nombre)}</b><span>${esc(p.detalle)}</span></div>` +
        `<button class="toggle" type="button" role="switch" ` +
        `aria-checked="${p.activa}" aria-label="${esc(p.nombre)}"></button>` +
        "</div>",
    ).join(""),
  );

  escribir(
    "config-laborales",
    D.LABORALES.map((l) => ficha(l.nombre, l.valor)).join(""),
  );
}

/* ------------------------------------------------------------ armado */

export function pintarVistas() {
  historial();
  cartera();
  patrimonio();
  analisis();
  config();
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

/* La hoja de detalle, que abre cualquier fila de muestra. El
   contenido real de una categoría es de la fase 7, todavía sin
   construir; acá toma el nombre de la fila para que se vea que es ESA
   la que se abrió.

   Las filas de movimiento de `#movimientos-lista` NO pasan por acá
   desde F04-T12: son datos reales y `movimientos.js` tiene su propio
   oyente, scoped a esa lista, que abre `#hoja-movimiento` en modo
   edición. Sin esta exclusión, un toque ahí abriría las dos hojas a
   la vez — la de muestra y la real. */
function conectarDetalle() {
  const hoja = $("hoja-detalle");
  const control = hoja && crearHoja(hoja);
  if (!control) return;

  document.addEventListener("click", (ev) => {
    const fila = ev.target.closest("[data-movimiento], [data-categoria]");
    if (!fila || fila.closest("#movimientos-lista")) return;

    // textContent y no innerHTML: lo que se lee del DOM se trata como
    // dato, aunque lo haya escrito esta misma aplicación.
    const nombre = fila.querySelector(".row-main b")?.textContent ?? "Detalle";
    $("hoja-detalle-titulo").textContent = nombre;
    $("hoja-detalle-sub").textContent = fila.hasAttribute("data-movimiento")
      ? "Movimiento"
      : "Categoría del mes";
    control.abrir();
    toast(nombre);
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
  conectarDetalle();
  conectarSinConexion();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", conectar);
} else {
  conectar();
}
