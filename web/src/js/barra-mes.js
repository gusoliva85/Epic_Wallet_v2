/* Barra de mes · F01-T08
   Referencia: 01_Documento_General.md §12.1

   Mes anterior, mes siguiente y vuelta al mes actual.

   Qué hace esta tarea: la barra, el título, el subtítulo de estado y
   los estados deshabilitados. Qué NO hace: cambiar de mes. Eso pide
   pedir el mes a la API, invalidar el caché y redibujar todo, y es de
   la fase 3. Las flechas quedan conectadas a `mover()`, que por ahora
   sólo corre el mes en pantalla y vuelve a pintar la barra: alcanza
   para ver en el teléfono que los estados cambian bien en los bordes.

   Dos reglas del documento general que se cumplen acá:

   1. «No debe permitirse seleccionar un mes futuro que todavía no
      existe» (§12.1). La flecha de siguiente se apaga en el mes
      actual. No alcanza con no hacer nada al tocarla: un botón que se
      ve activo y no responde parece que la aplicación se colgó.
   2. El mes actual es transaccional y los anteriores están
      consolidados (Regla 4). El subtítulo lo dice, porque cambia lo
      que se puede hacer en la pantalla. */

/* El primer mes con datos. Hasta que la fase 3 lo traiga de la API, el
   límite de atrás es este: sin tope, se puede retroceder para siempre
   a meses que no existen. */
const PRIMER_MES = { anio: 2020, mes: 1 };

/* Sólo el mes. Pidiendo mes y año juntos, `es-AR` devuelve «octubre de
   2026», y la barra muestra «Octubre 2026»: el «de» ocupa lugar en una
   pantalla angosta y no agrega nada. El año se pega aparte. */
const NOMBRES = new Intl.DateTimeFormat("es-AR", {
  month: "long",
  timeZone: "America/Argentina/Buenos_Aires",
});

/** El mes de hoy. Se calcula y no se escribe a mano: un texto fijo
    sería mentira el mes que viene. */
function hoy() {
  // La fecha del dispositivo puede estar en otra zona; la aplicación
  // razona siempre en hora argentina.
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
  const [anio, mes] = partes.split("-").map(Number);
  return { anio, mes };
}

let actual = hoy();

function nombre({ anio, mes }) {
  // Día 1 a mediodía UTC: con las 00:00 de un día 1, el corrimiento de
  // la zona argentina lo pasa al mes anterior y el título muestra el
  // mes equivocado.
  const texto = NOMBRES.format(new Date(Date.UTC(anio, mes - 1, 1, 12)));
  return `${texto.charAt(0).toUpperCase()}${texto.slice(1)} ${anio}`;
}

function indice({ anio, mes }) {
  return anio * 12 + mes;
}

function esElActual(m) {
  return indice(m) === indice(hoy());
}

function pintar(refs) {
  refs.titulo.textContent = nombre(actual);
  refs.estado.textContent = esElActual(actual)
    ? "Mes abierto · transaccional"
    : "Mes cerrado · consolidado";

  // Regla 1: no hay meses futuros.
  refs.siguiente.disabled = esElActual(actual);
  // «Hoy» no lleva a ninguna parte si ya estamos en el mes actual.
  refs.hoy.disabled = esElActual(actual);
  refs.anterior.disabled = indice(actual) <= indice(PRIMER_MES);
}

function mover(refs, pasos) {
  const destino = { anio: actual.anio, mes: actual.mes + pasos };
  while (destino.mes > 12) {
    destino.mes -= 12;
    destino.anio += 1;
  }
  while (destino.mes < 1) {
    destino.mes += 12;
    destino.anio -= 1;
  }

  // Cinturón además del botón apagado: si alguien llama a `mover` desde
  // otro lado, el tope sigue valiendo.
  if (indice(destino) > indice(hoy())) return;
  if (indice(destino) < indice(PRIMER_MES)) return;

  actual = destino;
  pintar(refs);
}

function conectar() {
  const refs = {
    titulo: document.getElementById("mes-titulo"),
    estado: document.getElementById("mes-estado"),
    anterior: document.getElementById("mes-anterior"),
    siguiente: document.getElementById("mes-siguiente"),
    hoy: document.getElementById("mes-hoy"),
  };
  if (Object.values(refs).some((el) => el === null)) return;

  pintar(refs);

  refs.anterior.addEventListener("click", () => mover(refs, -1));
  refs.siguiente.addEventListener("click", () => mover(refs, +1));
  refs.hoy.addEventListener("click", () => {
    actual = hoy();
    pintar(refs);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", conectar);
} else {
  conectar();
}

// Se exportan para las pruebas: así se verifica el cálculo de meses y
// los topes sin depender de los clics.
export { nombre, indice, PRIMER_MES };
