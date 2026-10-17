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
