/* Datos de ejemplo de las siete vistas · F01-T13

   TODO en un solo archivo a propósito. Cuando exista `/api/dashboard`
   (fase 3), reemplazar esto es borrar este archivo y cambiar de dónde
   lee cada vista: ninguna vista inventa un número por su cuenta.

   Los importes vienen como STRINGS ya formateados, igual que los va a
   mandar el backend: el frontend sólo formatea y nunca calcula. Si acá
   hubiera números, las vistas se acostumbrarían a hacer cuentas y
   después habría que sacarlas.

   Los valores son de octubre de 2026 y son inventados. Cada pantalla
   lo dice: una cifra creíble sin aclaración se puede tomar por un dato
   real. */

export const MES = "Octubre 2026";

export const RESUMEN = {
  ingresos: "$2.105.000",
  egresos: "$820.700",
  ahorro: "$1.284.300",
  tasa: "61,0%",
  gastoHoy: "$55.100",
  patrimonio: "$14.902.500",
};

export const MOVIMIENTOS = [
  {
    id: 1,
    dia: "04",
    tipo: "egreso",
    categoria: "Supermercado",
    importe: "$48.300",
    descripcion: "Compra semanal",
  },
  {
    id: 2,
    dia: "04",
    tipo: "egreso",
    categoria: "Transporte",
    importe: "$6.800",
    descripcion: "",
  },
  {
    id: 3,
    dia: "03",
    tipo: "egreso",
    categoria: "Servicios",
    importe: "$18.400",
    descripcion: "Luz",
  },
  {
    id: 4,
    dia: "02",
    tipo: "egreso",
    categoria: "Ocio",
    importe: "$32.000",
    descripcion: "Cine y cena",
  },
  {
    id: 5,
    dia: "01",
    tipo: "ingreso",
    categoria: "Sueldo",
    importe: "$2.050.000",
    descripcion: "Septiembre",
  },
  {
    id: 6,
    dia: "01",
    tipo: "egreso",
    categoria: "Alquiler",
    importe: "$520.000",
    descripcion: "",
  },
  {
    id: 7,
    dia: "01",
    tipo: "ingreso",
    categoria: "Venta",
    importe: "$55.000",
    descripcion: "Bici usada",
  },
  {
    id: 8,
    dia: "01",
    tipo: "egreso",
    categoria: "Supermercado",
    importe: "$144.900",
    descripcion: "Mensual",
  },
];

export const CATEGORIAS = [
  {
    id: "alquiler",
    nombre: "Alquiler",
    total: "$520.000",
    cantidad: 1,
    porcentaje: "63,4",
    participacion: 100,
    ultimo: "01/10",
  },
  {
    id: "supermercado",
    nombre: "Supermercado",
    total: "$193.200",
    cantidad: 4,
    porcentaje: "23,5",
    participacion: 37.2,
    ultimo: "04/10",
  },
  {
    id: "transporte",
    nombre: "Transporte",
    total: "$61.500",
    cantidad: 9,
    porcentaje: "7,5",
    participacion: 11.8,
    ultimo: "04/10",
  },
  {
    id: "servicios",
    nombre: "Servicios",
    total: "$46.000",
    cantidad: 3,
    porcentaje: "5,6",
    participacion: 8.8,
    ultimo: "03/10",
  },
];

/* Mes en curso primero. El tipo importa: un mes consolidado no tiene
   movimientos individuales y la interfaz no los puede inventar
   (regla 4 del documento general). */
export const HISTORIAL = [
  {
    mes: "Octubre 2026",
    ingresos: "$2.105.000",
    egresos: "$820.700",
    ahorro: "$1.284.300",
    tasa: "61,0%",
    tipo: "abierto",
  },
  {
    mes: "Septiembre 2026",
    ingresos: "$1.980.000",
    egresos: "$937.400",
    ahorro: "$1.042.600",
    tasa: "52,7%",
    tipo: "transaccional",
  },
  {
    mes: "Agosto 2026",
    ingresos: "$1.980.000",
    egresos: "$1.104.200",
    ahorro: "$875.800",
    tasa: "44,2%",
    tipo: "transaccional",
  },
  {
    mes: "Julio 2026",
    ingresos: "$1.820.000",
    egresos: "$1.236.900",
    ahorro: "$583.100",
    tasa: "32,0%",
    tipo: "consolidado",
  },
  {
    mes: "Junio 2026",
    ingresos: "$1.820.000",
    egresos: "$988.300",
    ahorro: "$831.700",
    tasa: "45,7%",
    tipo: "consolidado",
  },
  {
    mes: "Mayo 2026",
    ingresos: "$1.650.000",
    egresos: "$1.012.500",
    ahorro: "$637.500",
    tasa: "38,6%",
    tipo: "consolidado",
  },
];

export const INVERSIONES = [
  {
    id: "al30",
    nombre: "AL30",
    nominales: "1.200",
    inicial: "$1.740.000",
    actual: "$2.016.000",
    rendimiento: "+15,9%",
    fuente: "Cotización",
  },
  {
    id: "gd30",
    nombre: "GD30",
    nominales: "800",
    inicial: "$1.280.000",
    actual: "$1.374.400",
    rendimiento: "+7,4%",
    fuente: "Cotización",
  },
  {
    id: "pf",
    nombre: "Plazo fijo UVA",
    nominales: "—",
    inicial: "$2.000.000",
    actual: "$2.284.000",
    rendimiento: "+14,2%",
    fuente: "Manual",
  },
  {
    id: "usd",
    nombre: "Dólares",
    nominales: "520",
    inicial: "$598.000",
    actual: "$665.600",
    rendimiento: "+11,3%",
    fuente: "Cotización",
  },
];

export const CARTERA = {
  valor: "$6.340.000",
  invertido: "$5.618.000",
  rendimiento: "+12,8%",
  posiciones: "4",
};

export const PATRIMONIO = {
  ahorro: "$8.562.500",
  inversiones: "$6.340.000",
  pasivos: "$0",
  total: "$14.902.500",
  liquido: "57,5%",
  invertido: "42,5%",
};

export const SALARIOS = [
  { desde: "Enero 2026", importe: "$1.420.000", variacion: "—" },
  { desde: "Abril 2026", importe: "$1.650.000", variacion: "+16,2%" },
  { desde: "Julio 2026", importe: "$1.820.000", variacion: "+10,3%" },
  { desde: "Septiembre 2026", importe: "$1.980.000", variacion: "+8,8%" },
];

export const METRICAS = [
  { nombre: "Ahorro promedio mensual", valor: "$875.800" },
  { nombre: "Mejor mes", valor: "Octubre 2026 · $1.284.300" },
  { nombre: "Peor mes", valor: "Julio 2026 · $583.100" },
  { nombre: "Tasa de ahorro promedio", valor: "45,7%" },
  { nombre: "Gasto promedio mensual", valor: "$1.016.700" },
  { nombre: "Meses registrados", valor: "6" },
];

export const SEIS_MESES = [
  { mes: "May", ingresos: "$1,65M", egresos: "$1,01M", ahorro: "$638k" },
  { mes: "Jun", ingresos: "$1,82M", egresos: "$988k", ahorro: "$832k" },
  { mes: "Jul", ingresos: "$1,82M", egresos: "$1,24M", ahorro: "$583k" },
  { mes: "Ago", ingresos: "$1,98M", egresos: "$1,10M", ahorro: "$876k" },
  { mes: "Sep", ingresos: "$1,98M", egresos: "$937k", ahorro: "$1,04M" },
  { mes: "Oct", ingresos: "$2,11M", egresos: "$821k", ahorro: "$1,28M" },
];

export const PIE_DIARIO = [
  { etiqueta: "Promedio diario", valor: "$27.356" },
  { etiqueta: "Día más alto", valor: "$520.000" },
  { etiqueta: "Días sin gasto", valor: "1" },
  { etiqueta: "Proyección a 30 días", valor: "$820.700" },
  { etiqueta: "Ahorro de hoy", valor: "$1.284.300" },
  { etiqueta: "Máximo del mes", valor: "$1.339.400" },
];

/* Las categorías de configuración, con su estado. Se desactivan, nunca
   se borran si tienen histórico. */
export const PREFERENCIAS = [
  {
    id: "alertas",
    nombre: "Alertas analíticas",
    detalle: "Avisos de comportamiento del gasto.",
    activa: true,
  },
  {
    id: "cotizaciones",
    nombre: "Actualizar cotizaciones",
    detalle: "Una vez por día, al abrir la aplicación.",
    activa: true,
  },
  {
    id: "resumen",
    nombre: "Resumen al cerrar el mes",
    detalle: "Un repaso de cómo terminó el mes.",
    activa: false,
  },
];

export const LABORALES = [
  { nombre: "Sueldo actual", valor: "$1.980.000" },
  { nombre: "Vigente desde", valor: "Septiembre 2026" },
  { nombre: "Saldo inicial del sistema", valor: "$4.200.000" },
  { nombre: "Primer mes registrado", valor: "Mayo 2026" },
];

export const ALERTAS = [
  {
    severidad: "crit",
    titulo: "Gastaste más de lo que ingresaste",
    texto:
      "En lo que va del mes los egresos superan a los ingresos por $31.400.",
  },
  {
    severidad: "warn",
    titulo: "Supermercado va camino a duplicarse",
    texto: "Lleva $193.200 contra $104.900 del mes pasado a esta altura.",
  },
  {
    severidad: "pend",
    titulo: "Falta cargar el alquiler",
    texto: "Se carga todos los meses alrededor del día 1 y todavía no está.",
  },
  {
    severidad: "ok",
    titulo: "Vas mejor que el mes pasado",
    texto: "La tasa de ahorro subió 8,4 puntos respecto de septiembre.",
  },
  {
    severidad: "info",
    titulo: "Octubre todavía está abierto",
    texto: "Los totales van a cambiar hasta que termine el mes.",
  },
];
