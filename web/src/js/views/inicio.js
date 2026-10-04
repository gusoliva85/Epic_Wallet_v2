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
    color: "inc",
    icono: "sube",
  }),
  tarjetaMetrica({
    etiqueta: "Egresos",
    cifra: "$820.700",
    sub: "37 movimientos",
    color: "egr",
    icono: "baja",
  }),
  tarjetaMetrica({
    etiqueta: "Tasa de ahorro",
    cifra: "61,0%",
    sub: "+8,4 pts vs. septiembre",
    color: "ok",
    icono: "porcentaje",
  }),
  tarjetaMetrica({
    etiqueta: "Patrimonio",
    cifra: "$14.902.500",
    sub: "Ahorro e inversiones",
    color: "accent",
    icono: "caja",
  }),
  tarjetaMetrica({
    etiqueta: "Gasto diario",
    cifra: "$27.356",
    sub: "Promedio del mes",
    color: "warn",
    icono: "calendario",
  }),
  tarjetaMetrica({
    etiqueta: "Cartera",
    cifra: "$6.340.000",
    sub: "+12,7% en el año",
    color: "sav",
    icono: "grafico",
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

function conectar() {
  pintarTarjetas(document.getElementById("kpis-inicio"), MUESTRA);
  pintarFilas(document.getElementById("movimientos-inicio"), MOVIMIENTOS);
  pintarFilas(document.getElementById("categorias-inicio"), CATEGORIAS);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", conectar);
} else {
  conectar();
}

export { MUESTRA, MOVIMIENTOS, CATEGORIAS };
