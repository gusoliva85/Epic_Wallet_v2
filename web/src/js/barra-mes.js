/* Barra de mes · F01-T08 (maqueta) → F03-T10 (conectada a la API)
   Referencia: 01_Documento_General.md §12.1 · 02_Documento_Tecnico.md §9.1

   La barra ya no inventa meses: la lista completa sale de
   `GET /api/months` (F03-T05), cacheada en memoria por
   `cache-meses.js` — un alta de movimiento (fase 4) invalida ese
   caché y avisa con `EVENTO_INVALIDADO`; acá alcanza con escucharlo y
   volver a pedir, sin que esta barra sepa nada de movimientos.

   El repositorio entrega los meses en orden `year` desc, `month` desc
   (F03-T03): el índice 0 es siempre el más nuevo, y es el mes actual
   porque `GET /api/months` lo abre si todavía no existe (F03-T10,
   `routers/months.py`). Moverse es mover el índice dentro de esa
   lista — nunca se calcula ni se inventa un período que la API no
   mandó.

   Dos reglas del documento general que se cumplen acá:

   1. «No debe permitirse seleccionar un mes futuro que todavía no
      existe» (§12.1). La flecha de siguiente y el botón «Hoy» se
      apagan en el índice 0: no hay — ni puede haber — un mes más
      nuevo que el primero de la lista.
   2. El mes actual es transaccional y los anteriores están
      consolidados (Regla 4). El subtítulo lo dice, porque cambia lo
      que se puede hacer en la pantalla. */

import { meses, EVENTO_INVALIDADO } from "./cache-meses.js";

/* Sólo el mes. Pidiendo mes y año juntos, `es-AR` devuelve «octubre de
   2026», y la barra muestra «Octubre 2026»: el «de» ocupa lugar en una
   pantalla angosta y no agrega nada. El año se pega aparte. */
const NOMBRES = new Intl.DateTimeFormat("es-AR", {
  month: "long",
  timeZone: "America/Argentina/Buenos_Aires",
});

/** El nombre del mes a partir de lo que manda la API (`year`, `month`). */
function nombre({ year, month }) {
  // Día 1 a mediodía UTC: con las 00:00 de un día 1, el corrimiento de
  // la zona argentina lo pasa al mes anterior y el título muestra el
  // mes equivocado.
  const texto = NOMBRES.format(new Date(Date.UTC(year, month - 1, 1, 12)));
  return `${texto.charAt(0).toUpperCase()}${texto.slice(1)} ${year}`;
}

let lista = [];
let indice = 0;

function pintar(refs) {
  const mes = lista[indice];
  if (!mes) {
    // Sin datos todavía — cargando, o la API falló. Nada que mostrar,
    // y ningún botón puede llevar a un mes que no se conoce.
    refs.titulo.textContent = "—";
    refs.estado.textContent = "—";
    refs.anterior.disabled = true;
    refs.siguiente.disabled = true;
    refs.hoy.disabled = true;
    return;
  }

  refs.titulo.textContent = nombre(mes);
  /* Corto a propósito. «Mes abierto · transaccional» no entra en la
     barra de un teléfono de 390 px y se corta en «TRANSACCIO…», que es
     peor que decir menos. Las dos palabras eran casi sinónimos: la que
     informa es la segunda, y «abierto / consolidado» ya dice lo mismo
     con la mitad de los caracteres. */
  refs.estado.textContent = mes.status === "open" ? "Mes abierto" : "Mes consolidado";

  // Regla 1: no hay meses futuros. El índice 0 es siempre el más nuevo.
  refs.siguiente.disabled = indice === 0;
  // «Hoy» no lleva a ninguna parte si ya estamos en el mes actual.
  refs.hoy.disabled = indice === 0;
  // El último índice es el mes más viejo que la API mandó.
  refs.anterior.disabled = indice >= lista.length - 1;
}

/** @param {number} pasos -1 retrocede un mes (anterior), +1 avanza uno
 * (siguiente) — en índice es al revés, porque el índice 0 es el más
 * nuevo. */
function mover(refs, pasos) {
  const destino = indice - pasos;
  // Cinturón además del botón apagado: si alguien llama a `mover` desde
  // otro lado, el tope sigue valiendo.
  if (destino < 0 || destino >= lista.length) return;
  indice = destino;
  pintar(refs);
}

async function cargar(refs) {
  try {
    lista = await meses();
  } catch (e) {
    lista = [];
    console.error("barra-mes: no se pudo pedir la lista de meses", e);
  }
  indice = 0;
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

  // Apagados hasta que llegue la primera respuesta: un botón que se ve
  // activo y no responde todavía parece que la aplicación se colgó.
  refs.anterior.disabled = true;
  refs.siguiente.disabled = true;
  refs.hoy.disabled = true;

  refs.anterior.addEventListener("click", () => mover(refs, -1));
  refs.siguiente.addEventListener("click", () => mover(refs, +1));
  refs.hoy.addEventListener("click", () => {
    indice = 0;
    pintar(refs);
  });

  // Dar de alta un movimiento (fase 4) invalida el caché y dispara
  // esto: la barra vuelve a pedir la lista sola, sin que nadie tenga
  // que acordarse de llamarla.
  document.addEventListener(EVENTO_INVALIDADO, () => cargar(refs));

  cargar(refs);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", conectar);
} else {
  conectar();
}

// Se exporta para las pruebas: así se verifica el formato del título
// sin depender de una llamada a la API.
export { nombre };
