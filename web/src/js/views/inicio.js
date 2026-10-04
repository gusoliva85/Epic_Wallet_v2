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

function conectar() {
  pintarTarjetas(document.getElementById("kpis-inicio"), MUESTRA);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", conectar);
} else {
  conectar();
}

export { MUESTRA };
