/* Vista de inicio · muestra del catálogo (F01-T09)

   Las cifras de acá son de muestra y están a la vista para poder ver
   las tarjetas en el teléfono: la rejilla en los tres cortes, el
   escalonado de la entrada y la barra que crece. Los datos de verdad
   llegan en la fase 3, cuando exista `/api/dashboard`.

   Se escriben como las va a mandar el backend —strings ya formateados,
   porque el frontend sólo formatea y nunca calcula— para que cambiar a
   datos reales sea cambiar de dónde vienen y nada más. */

import {
  tarjetaHeroe,
  tarjetaMetrica,
  pintarTarjetas,
} from "../components/kpi.js";
import { crearHoja } from "../components/sheet.js";
import { aviso } from "../components/avisos.js";
import { toast } from "../components/toast.js";
import {
  filaMovimiento,
  filaCategoria,
  separadorDia,
  pintarFilas,
} from "../components/rows.js";

/* Octubre 2026, inventado. El aviso de «datos de muestra» está en la
   pantalla: una cifra creíble sin aclaración es peor que una vacía. */
const MUESTRA = [
  tarjetaHeroe({
    etiqueta: "Ahorro del mes",
    cifra: "$1.284.300",
    sub: "61% de los ingresos del mes",
    porcentaje: 61,
    pieIzq: "Ingresos $2.105.000",
    pieDer: "Egresos $820.700",
    color: "sav",
  }),
  tarjetaMetrica({
    etiqueta: "Ingresos",
    cifra: "$2.105.000",
    sub: "4 movimientos",
    tarjeta: "inc",
  }),
  tarjetaMetrica({
    etiqueta: "Egresos",
    cifra: "$820.700",
    sub: "37 movimientos",
    tarjeta: "egr",
  }),
  // Gasto de HOY, no el promedio del mes. El promedio no dice nada
  // para decidir hoy; lo que sirve es cuánto se gastó en el día.
  tarjetaMetrica({
    etiqueta: "Gasto de hoy",
    cifra: "$55.100",
    sub: "2 movimientos",
    tarjeta: "dia",
  }),
  tarjetaMetrica({
    etiqueta: "Patrimonio",
    cifra: "$14.902.500",
    sub: "Ahorro e inversiones",
    tarjeta: "pat",
  }),
];

/* ---- filas de muestra (F01-T10) ----
   Mismo criterio que las tarjetas: cifras inventadas, dichas en la
   pantalla. Sirven para ver en el teléfono el hover, el foco con el
   tabulador, el signo y el color de cada tipo, y la barra de
   participación creciendo. */

const MOVIMIENTOS = [
  separadorDia("04 de octubre 2026"),
  filaMovimiento({
    id: 1,
    tipo: "egreso",
    categoria: "Supermercado",
    importe: "$48.300",
    fecha: "04/10/2026",
    descripcion: "Compra semanal",
    origen: "manual",
  }),
  filaMovimiento({
    id: 2,
    tipo: "egreso",
    categoria: "Transporte",
    importe: "$6.800",
    fecha: "04/10/2026",
    origen: "manual",
  }),
  separadorDia("01 de octubre 2026"),
  filaMovimiento({
    id: 3,
    tipo: "ingreso",
    categoria: "Sueldo",
    importe: "$2.050.000",
    fecha: "01/10/2026",
    descripcion: "Septiembre",
    origen: "manual",
  }),
  filaMovimiento({
    id: 4,
    tipo: "egreso",
    categoria: "Alquiler",
    importe: "$520.000",
    fecha: "01/10/2026",
    origen: "manual",
  }),
];

/* La participación es relativa a la categoría que más gastó, que queda
   en 100. Así se lee de un golpe cuánto pesa cada una respecto de la
   más grande. */
const CATEGORIAS = [
  filaCategoria({
    id: "alquiler",
    nombre: "Alquiler",
    total: "$520.000",
    detalle: "1 movimiento · 63,4% del gasto",
    participacion: 100,
    pie: "últ. 01/10",
  }),
  filaCategoria({
    id: "supermercado",
    nombre: "Supermercado",
    total: "$193.200",
    detalle: "4 movimientos · 23,5% del gasto",
    participacion: 37.2,
    pie: "últ. 04/10",
  }),
  filaCategoria({
    id: "transporte",
    nombre: "Transporte",
    total: "$61.500",
    detalle: "9 movimientos · 7,5% del gasto",
    participacion: 11.8,
    pie: "últ. 04/10",
  }),
  filaCategoria({
    id: "servicios",
    nombre: "Servicios",
    total: "$46.000",
    detalle: "3 movimientos · 5,6% del gasto",
    participacion: 8.8,
    pie: "últ. 03/10",
  }),
];

/* ---- la hoja de detalle (F01-T11) ----
   Abre al tocar una fila. El contenido de verdad llega en la fase 4;
   por ahora toma el nombre de la fila para que se vea que es ESA la
   que se abrió, y para poder probar con el dedo la hoja y con el mouse
   el cajón lateral. */

function conectarDetalle() {
  const hoja = document.getElementById("hoja-detalle");
  if (!hoja) return;

  const control = crearHoja(hoja);
  if (!control) return;

  const titulo = hoja.querySelector("#hoja-detalle-titulo");
  const sub = hoja.querySelector("#hoja-detalle-sub");

  document.addEventListener("click", (ev) => {
    const fila = ev.target.closest("[data-movimiento], [data-categoria]");
    if (!fila) return;

    const esMovimiento = fila.hasAttribute("data-movimiento");
    // textContent y no innerHTML: lo que se lee del DOM se trata como
    // dato, aunque lo haya escrito esta misma aplicación.
    titulo.textContent =
      fila.querySelector(".row-main b")?.textContent ?? "Detalle";
    sub.textContent = esMovimiento ? "Movimiento" : "Categoría del mes";
    control.abrir();
  });
}

/* ---- avisos de muestra (F01-T12) ----
   Los de verdad salen de las reglas de alerta, en la fase 8. Están las
   cinco severidades para poder compararlas de un vistazo en los dos
   temas, que es el criterio de la tarea. */

const AVISOS = [
  aviso({
    severidad: "crit",
    titulo: "Gastaste más de lo que ingresaste",
    texto:
      "En lo que va del mes los egresos superan a los ingresos por $31.400.",
  }),
  aviso({
    severidad: "warn",
    titulo: "Supermercado va camino a duplicarse",
    texto: "Lleva $193.200 contra $104.900 del mes pasado a esta altura.",
  }),
  aviso({
    severidad: "pend",
    titulo: "Falta cargar el alquiler",
    texto: "Se carga todos los meses alrededor del día 1 y todavía no está.",
  }),
  aviso({
    severidad: "ok",
    titulo: "Vas mejor que el mes pasado",
    texto: "La tasa de ahorro subió 8,4 puntos respecto de septiembre.",
  }),
  aviso({
    severidad: "info",
    titulo: "Octubre todavía está abierto",
    texto: "Los totales van a cambiar hasta que termine el mes.",
  }),
];

function conectarAvisos() {
  const caja = document.getElementById("avisos-inicio");
  if (caja) caja.innerHTML = AVISOS.join("");
}

function conectar() {
  pintarTarjetas(document.getElementById("kpis-inicio"), MUESTRA);
  pintarFilas(document.getElementById("movimientos-inicio"), MOVIMIENTOS);
  pintarFilas(document.getElementById("categorias-inicio"), CATEGORIAS);
  conectarDetalle();
  conectarAvisos();

  // Al abrir un detalle se avisa con un mensaje breve. Es provisorio:
  // sirve para probar en el teléfono que dos mensajes seguidos hacen
  // cola en lugar de pisarse. En la fase 4 lo reemplazan los avisos de
  // guardado y de error.
  document.addEventListener("click", (ev) => {
    const fila = ev.target.closest("[data-movimiento], [data-categoria]");
    if (fila)
      toast(fila.querySelector(".row-main b")?.textContent ?? "Detalle");
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", conectar);
} else {
  conectar();
}

export { MUESTRA, MOVIMIENTOS, CATEGORIAS };
