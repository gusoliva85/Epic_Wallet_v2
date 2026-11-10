/* Comparación por ítem · F13-T02
   Referencia: 01_Documento_General.md §14 · 02_Documento_Tecnico.md §9.1
   Mockup aprobado por Gustavo el 2026-11-10.

   La tarjeta plegable de la vista Movimientos: se elige un ítem y un
   rango (3, 6, 12 meses o todo el histórico) y se ve cómo se movió mes
   a mes — gráfico, seis cifras y la lista con la variación de cada mes
   contra el anterior.

   CUATRO DECISIONES

   1. **Arranca plegada y no pide nada hasta que se la prende.** Es una
      consulta puntual, no algo que tenga que estar abierto todo el
      tiempo (pedido expreso de Gustavo). Mientras está plegada no hay
      ni una llamada a la API: la vista Movimientos sigue costando lo
      mismo que antes de que esta tarjeta existiera.

   2. **El rango lo recorta el servidor** (`?months=`), no el cliente.
      Así "todo el histórico" no trae veinte meses para dibujar tres.

   3. **El frontend no calcula nada.** Las seis cifras del pie y la
      variación de cada mes vienen de `services/calc.py`; acá sólo se
      formatean. Es la regla del proyecto, y acá importa especialmente:
      un promedio calculado en dos lugares son dos promedios distintos
      el día que uno de los dos cambie.

   4. **El último mes de la serie es el mes en curso.** La API devuelve
      los meses del usuario del más viejo al más nuevo, y el más nuevo
      es siempre el mes actual (se abre solo). Va más tenue en el
      gráfico y la lista aclara que es parcial. */

import { api } from "./api.js";
import { esc, fmt, fmtS } from "./format.js";
import { activas as categoriasActivas } from "./cache-categorias.js";
import { bloqueCargando, error as estadoError, vacio } from "./components/estados.js";
import { dibujar, etiquetaDeMes } from "./charts/comparacion.js";
import { sincronizar } from "./components/switch.js";

const $ = (id) => document.getElementById(id);

const MESES_LARGOS = new Intl.DateTimeFormat("es-AR", {
  month: "long",
  timeZone: "America/Argentina/Buenos_Aires",
});

/** «Octubre 2026», con el año pegado aparte — mismo criterio que
 * `barra-mes.js`: pidiendo mes y año juntos, `es-AR` mete un «de» que
 * no entra en una pantalla angosta. */
function mesLargo({ year, month }) {
  const texto = MESES_LARGOS.format(new Date(Date.UTC(year, month - 1, 1, 12)));
  return `${texto.charAt(0).toUpperCase()}${texto.slice(1)} ${year}`;
}

/* ------------------------------------------------------------ estado */

let abierta = false;
let itemElegido = null;
let rango = 6;
let seleccion = null;
let datos = null;
let cargando = false;
let fallo = false;

/* ------------------------------------------------------------- piezas */

/** Una celda del pie. `null` se muestra como «—» y nunca como cero: un
 * cero ahí diría «no gastó nada», y lo que pasa es que no hay con qué
 * calcularla todavía. */
function celda(etiqueta, cifra, pie = "") {
  return (
    '<div class="mini cg">' +
    `<span>${esc(etiqueta)}</span>` +
    `<b class="num">${esc(cifra)}</b>` +
    (pie ? `<span style="text-transform: none; letter-spacing: 0">${esc(pie)}</span>` : "") +
    "</div>"
  );
}

function porcentaje(valor) {
  if (valor === null || valor === undefined) return "—";
  const n = Number(valor);
  const signo = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${signo}${Math.abs(n).toFixed(1).replace(".", ",")}%`;
}

/** Los dos meses que comparan la diferencia y la variación: los dos
 * últimos con dato. Se arma acá sólo para el texto del pie — las dos
 * cifras ya vienen calculadas del servidor. */
function parDeMeses(meses) {
  const conDato = meses.filter((m) => m.total !== null);
  if (conDato.length < 2) return "hace falta un mes más";
  const actual = conDato.at(-1);
  const previo = conDato.at(-2);
  return `${mesLargo(actual)} vs ${mesLargo(previo)}${actual.parcial ? " · parcial" : ""}`;
}

function pie(d) {
  const meses = d.months;
  const cerrados = meses.filter((m) => m.total !== null && !m.parcial);
  const ultimoCerrado = cerrados.at(-1);
  const mesDe = (valor) => {
    const m = cerrados.find((c) => c.total === valor);
    return m ? mesLargo(m) : "";
  };
  const par = parDeMeses(meses);

  return [
    celda(
      "Promedio",
      d.average === null ? "—" : fmt(d.average),
      `${cerrados.length} ${cerrados.length === 1 ? "mes cerrado" : "meses cerrados"}`,
    ),
    celda(
      "Último cerrado",
      d.last_closed === null ? "—" : fmt(d.last_closed),
      ultimoCerrado ? mesLargo(ultimoCerrado) : "",
    ),
    celda("Más caro", d.maximum === null ? "—" : fmt(d.maximum), mesDe(d.maximum)),
    celda("Más barato", d.minimum === null ? "—" : fmt(d.minimum), mesDe(d.minimum)),
    celda("Diferencia en pesos", d.difference === null ? "—" : fmtS(d.difference), par),
    celda("Variación", porcentaje(d.variation), par),
  ].join("");
}

/** Una fila por mes, del más nuevo al más viejo, con su variación
 * contra el mes anterior. La variación de la fila se calcula con los
 * dos valores que ya están en pantalla —no es un dato financiero
 * nuevo, es la misma resta que el pie ya trae del servidor para el
 * último par—; el resto de las cifras no se toca. */
function filas(meses) {
  const alReves = [...meses].reverse();

  return alReves
    .map((m, i) => {
      const anterior = alReves[i + 1];
      const titulo = mesLargo(m);

      if (m.total === null) {
        return (
          '<div class="row cg" style="--c: var(--color-ink-4)">' +
          '<span class="row-ico" aria-hidden="true">—</span>' +
          `<span class="row-main"><b>${esc(titulo)}</b>` +
          "<span>Sin movimientos de este ítem</span></span>" +
          '<span class="row-val"><b class="num">—</b></span>' +
          "</div>"
        );
      }

      const actual = Number(m.total);
      const previo = anterior && anterior.total !== null ? Number(anterior.total) : null;
      const delta = previo ? ((actual - previo) / Math.abs(previo)) * 100 : null;

      const detalle = m.parcial
        ? "Mes en curso · todavía parcial"
        : delta === null
          ? "Sin mes anterior con qué comparar"
          : `${porcentaje(delta)} contra ${mesLargo(anterior)}`;

      const tipo = delta === null ? "neutral" : delta > 0.5 ? "crit" : delta < -0.5 ? "ok" : "neutral";

      return (
        '<div class="row cg" style="--c: var(--color-egr)">' +
        `<span class="row-ico" aria-hidden="true">${esc(etiquetaDeMes(m).slice(0, 3))}</span>` +
        `<span class="row-main"><b>${esc(titulo)}</b><span>${esc(detalle)}</span></span>` +
        '<span class="row-val">' +
        `<b class="num">${esc(fmt(m.total))}</b>` +
        (delta === null ? "" : `<span><span class="pill ${tipo}">${porcentaje(delta)}</span></span>`) +
        "</span></div>"
      );
    })
    .join("");
}

/* ------------------------------------------------------------ pintado */

function pintarPliegue() {
  const sw = $("comp-switch");
  if (!sw) return;
  sw.setAttribute("aria-checked", String(abierta));
  sw.setAttribute(
    "aria-label",
    abierta ? "Ocultar la comparación por ítem" : "Mostrar la comparación por ítem",
  );
  const cuerpo = $("comp-cuerpo");
  if (cuerpo) cuerpo.hidden = !abierta;
}

function pintar() {
  if (!abierta) return;

  const grafico = $("comp-grafico");
  const pieCaja = $("comp-pie");
  const filasCaja = $("comp-filas");
  const sel = $("comp-seleccion");
  if (!grafico || !pieCaja || !filasCaja) return;

  if (cargando) {
    grafico.innerHTML = bloqueCargando("grafico", 1);
    pieCaja.innerHTML = "";
    filasCaja.innerHTML = "";
    if (sel) sel.hidden = true;
    return;
  }
  if (fallo || !datos) {
    grafico.innerHTML = estadoError("No se pudo cargar la comparación de este ítem.");
    pieCaja.innerHTML = "";
    filasCaja.innerHTML = "";
    if (sel) sel.hidden = true;
    return;
  }

  const meses = datos.months;
  const conDato = meses.filter((m) => m.total !== null);

  if (!conDato.length) {
    grafico.innerHTML = vacio(
      "Todavía no hay nada para comparar",
      "Este ítem no tiene movimientos en el rango elegido.",
    );
    pieCaja.innerHTML = "";
    filasCaja.innerHTML = "";
    if (sel) sel.hidden = true;
    return;
  }

  const color = datos.type === "income" ? "var(--color-inc)" : "var(--color-egr)";
  grafico.innerHTML = dibujar(meses, { seleccion, color });
  pieCaja.innerHTML = pie(datos);
  filasCaja.innerHTML = filas(meses);

  const punto = $("comp-punto");
  if (punto) punto.style.background = color;
  const serie = $("comp-leyenda-serie");
  if (serie) serie.textContent = datos.type === "income" ? "Ingreso del mes" : "Gasto del mes";

  if (sel) {
    const m = seleccion === null ? null : meses[seleccion];
    if (!m || m.total === null) {
      sel.hidden = true;
      sel.innerHTML = "";
    } else {
      const anterior = [...meses.slice(0, seleccion)].reverse().find((x) => x.total !== null);
      const previo = anterior ? Number(anterior.total) : null;
      const delta = previo ? ((Number(m.total) - previo) / Math.abs(previo)) * 100 : null;
      sel.hidden = false;
      sel.innerHTML =
        `<b class="num">${esc(mesLargo(m))} · ${esc(fmt(m.total))}</b>` +
        `<span>${esc(
          m.parcial
            ? "mes en curso, parcial"
            : delta === null
              ? "sin mes anterior con qué comparar"
              : `${porcentaje(delta)} contra ${mesLargo(anterior)}`,
        )}</span>`;
    }
  }
}

/* ------------------------------------------------------------- datos */

async function cargar() {
  if (!itemElegido) return;
  cargando = true;
  fallo = false;
  seleccion = null;
  pintar();

  try {
    const d = await api.get(`/categories/${itemElegido}/history?months=${rango}`);
    // El más nuevo de la serie es el mes en curso (decisión 4). Se
    // marca acá y no en el servidor: es una cuestión de presentación,
    // y el contrato ya dice qué mes es cada uno.
    d.months = d.months.map((m, i) => ({ ...m, parcial: i === d.months.length - 1 }));
    datos = d;
    cargando = false;
  } catch (e) {
    datos = null;
    cargando = false;
    fallo = true;
    console.error("comparación: no se pudo pedir el historial del ítem", e);
  }
  pintar();
}

/** Llena el selector con las categorías activas, egresos primero. Una
 * sola vez: la lista no cambia mientras la pantalla está abierta, y
 * `cache-categorias.js` ya evita el pedido repetido. */
async function llenarSelector() {
  const sel = $("comp-item");
  if (!sel || sel.options.length) return;

  let lista = [];
  try {
    lista = await categoriasActivas();
  } catch (e) {
    console.error("comparación: no se pudieron pedir las categorías", e);
    return;
  }

  const grupo = (titulo, items) =>
    items.length
      ? `<optgroup label="${esc(titulo)}">` +
        items.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("") +
        "</optgroup>"
      : "";

  sel.innerHTML =
    grupo(
      "Egresos",
      lista.filter((c) => c.type === "expense"),
    ) +
    grupo(
      "Ingresos",
      lista.filter((c) => c.type === "income"),
    );

  itemElegido = sel.value ? Number(sel.value) : null;
}

/* ------------------------------------------------------------ armado */

export async function arrancar() {
  const sw = $("comp-switch");
  if (!sw) return;
  if (sw.dataset.conectado === "si") return;
  sw.dataset.conectado = "si";

  pintarPliegue();

  sw.addEventListener("click", async () => {
    abierta = !abierta;
    pintarPliegue();
    if (!abierta) return;

    await llenarSelector();
    // La pastilla del rango se mide recién cuando el grupo es visible:
    // oculto mide 0 y quedaría apoyada en el borde izquierdo.
    sincronizar($("comp-rango"));
    if (!datos) await cargar();
    else pintar();
  });

  $("comp-item")?.addEventListener("change", (ev) => {
    itemElegido = Number(/** @type {HTMLSelectElement} */ (ev.target).value);
    datos = null;
    cargar();
  });

  $("comp-rango")?.addEventListener("click", (ev) => {
    const boton = /** @type {HTMLElement} */ (ev.target).closest("[data-rango]");
    if (!boton) return;
    rango = Number(boton.dataset.rango);
    datos = null;
    cargar();
  });

  // Tocar una barra muestra ese mes contra el anterior, y volver a
  // tocarla lo saca: es la forma de ver un valor en un teléfono, donde
  // no hay puntero que pueda quedarse encima.
  $("comp-grafico")?.addEventListener("click", (ev) => {
    const barra = /** @type {HTMLElement} */ (ev.target).closest("[data-mes]");
    if (!barra) return;
    const i = Number(barra.dataset.mes);
    seleccion = seleccion === i ? null : i;
    pintar();
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", arrancar);
  } else {
    arrancar();
  }
}
