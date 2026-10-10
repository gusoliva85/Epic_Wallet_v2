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
import {
  tarjetaHeroe,
  tarjetaMetrica,
  pintarTarjetas,
} from "../components/kpi.js";
import {
  filaMovimiento,
  filaCategoria,
  separadorDia,
  pintarFilas,
} from "../components/rows.js";
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

/* ------------------------------------------------------------ inicio */

function inicio() {
  pintarTarjetas($("kpis-inicio"), [
    // Sin pie de ingresos/egresos: las dos tarjetas de color de abajo
    // ya los muestran, y repetirlos acá era la misma cifra dos veces.
    tarjetaHeroe({
      etiqueta: "Ahorro del mes",
      cifra: D.RESUMEN.ahorro,
      sub: `${D.RESUMEN.tasa} de los ingresos del mes`,
      porcentaje: 61,
      color: "sav",
    }),
    tarjetaMetrica({
      etiqueta: "Ingresos",
      cifra: D.RESUMEN.ingresos,
      sub: "4 movimientos",
      tarjeta: "inc",
    }),
    tarjetaMetrica({
      etiqueta: "Egresos",
      cifra: D.RESUMEN.egresos,
      sub: "37 movimientos",
      tarjeta: "egr",
    }),
    tarjetaMetrica({
      etiqueta: "Gasto de hoy",
      cifra: D.RESUMEN.gastoHoy,
      sub: "2 movimientos",
      tarjeta: "dia",
    }),
    tarjetaMetrica({
      etiqueta: "Patrimonio",
      cifra: D.RESUMEN.patrimonio,
      sub: "Ahorro e inversiones",
      tarjeta: "pat",
    }),
  ]);

  escribir(
    "pie-diario",
    D.PIE_DIARIO.map(
      (x) =>
        `<div class="mini cg"><span>${esc(x.etiqueta)}</span><b class="num">${esc(x.valor)}</b></div>`,
    ).join(""),
  );

  escribir(
    "pie-seis",
    D.SEIS_MESES.map(
      (m) =>
        `<div class="mini cg"><span>${esc(m.mes)}</span>` +
        `<b class="num">${esc(m.ahorro)}</b>` +
        `<span style="text-transform: none; letter-spacing: 0">${esc(m.ingresos)} / ${esc(m.egresos)}</span></div>`,
    ).join(""),
  );

  pintarFilas(
    $("categorias-inicio"),
    D.CATEGORIAS.map((c) =>
      filaCategoria({
        id: c.id,
        nombre: c.nombre,
        total: c.total,
        detalle: `${c.cantidad} movimiento${c.cantidad === 1 ? "" : "s"} · ${c.porcentaje}% del gasto`,
        participacion: c.participacion,
        pie: `últ. ${c.ultimo}`,
      }),
    ),
  );

  /* Los cinco más recientes. Cinco y no cuatro porque con cuatro el
     panel queda con puros egresos, y entonces no se ve la diferencia
     de signo y color entre un ingreso y un egreso, que es la mitad de lo
     que este panel tiene que mostrar. */
  pintarFilas(
    $("movimientos-inicio"),
    filasDeMovimientos(D.MOVIMIENTOS.slice(0, 5)),
  );
}

/* ------------------------------------------------------- movimientos */

/** Filas agrupadas por día, con su separador. */
function filasDeMovimientos(lista) {
  const salida = [];
  let dia = null;
  for (const m of lista) {
    if (m.dia !== dia) {
      dia = m.dia;
      salida.push(separadorDia(`${dia} de octubre 2026`));
    }
    salida.push(
      filaMovimiento({
        id: m.id,
        tipo: m.tipo,
        categoria: m.categoria,
        importe: m.importe,
        fecha: `${m.dia}/10/2026`,
        descripcion: m.descripcion,
        origen: "manual",
      }),
    );
  }
  return salida;
}

// La lista de `#movimientos-lista` y el filtro `#mov-categoria`:
// F04-T12 los reemplazó por datos reales de `GET /api/transactions` y
// `GET /api/categories`, pintados por `movimientos.js`. Ya no hay
// nada de muestra que escribir acá — mismo caso que las categorías de
// `config()`, más abajo.

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

function patrimonio() {
  escribir(
    "patrimonio-ecuacion",
    ficha("Ahorro disponible", D.PATRIMONIO.ahorro) +
      ficha("Inversiones", D.PATRIMONIO.inversiones) +
      ficha("Pasivos", D.PATRIMONIO.pasivos) +
      ficha("Patrimonio neto", D.PATRIMONIO.total, true),
  );

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
  inicio();
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
   la vez — la de muestra y la real. Las de `#movimientos-inicio` (el
   tablero) siguen siendo de muestra hasta la Fase 5 y mantienen este
   stub. */
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
