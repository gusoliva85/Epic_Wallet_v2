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

/* Vacía a propósito (Gustavo, 2026-10-17): las alertas son un tema de
   "Después del MVP" (roadmap) — no hay ninguna regla real todavía que
   las genere. Con datos de ejemplo acá, la campanita mostraba "4" sin
   que hubiera una sola alerta de verdad. `conectarAlertas()` ya
   esconde el globo solo cuando la lista está vacía (`contador.hidden
   = D.ALERTAS.length === 0`); no hace falta tocar nada más para que
   quede sin número hasta que exista la fase de alertas. */
export const ALERTAS = [];
