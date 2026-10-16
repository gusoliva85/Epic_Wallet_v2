/* Vista Historial: evolución del ahorro (F06-T07), lista de meses y
   carga de mes histórico (F08-T07).
   Referencia: 01_Documento_General.md §17, §18, §6.3 ·
   02_Documento_Tecnico.md §9.1, §9.4 · skill §8 (hoja), §11.1 (tabla)

   El gráfico pide `GET /api/months/savings-evolution` cada vez que se
   entra a la vista (evento `epic:ruta` de `router.js`), sin cachear:
   a diferencia del tablero de Inicio, esta serie no depende del mes
   que esté mostrando la barra de mes, así que un movimiento cargado
   en otra vista durante la misma sesión se refleja sin recargar la
   página, al costo de un pedido liviano por visita.

   La tabla (`#historial-tabla`) usa la misma caché que la barra de
   mes (`cache-meses.js`, F03-T10): `GET /api/months` ya trae todos
   los meses en una sola llamada, así que no hace falta un pedido
   propio, y cargar un mes histórico invalida esa caché exactamente
   como ya hace un alta de movimiento — las dos pantallas quedan al
   día solas.

   La carga de un mes histórico (F08-T07) ofrece todas las categorías
   de egreso activas, con un importe opcional cada una (General §18).
   El ahorro no se escribe a mano: es ingresos menos egresos, mismo
   criterio que las Reglas 5 y 6 del documento general — acá es una
   resta trivial sobre los dos números que la persona ya está
   escribiendo en esta misma pantalla, no una decisión financiera que
   tenga que venir del backend. */

import { api, ApiError } from "./api.js";
import { esc, fmtK, fmtS, pctPlano } from "./format.js";
import { bloqueCargando, error as estadoError } from "./components/estados.js";
import { aviso, pildora } from "./components/avisos.js";
import { crearHoja } from "./components/sheet.js";
import { toast } from "./components/toast.js";
import { EVENTO as EVENTO_RUTA } from "./router.js";
import { dibujar as dibujarGraficoAhorro } from "./charts/ahorro.js";
import { meses as mesesCacheados, invalidarMeses } from "./cache-meses.js";
import { activas as categoriasActivas } from "./cache-categorias.js";

const $ = (id) => document.getElementById(id);

/* ===================================================================
   Evolución del ahorro acumulado · F06-T07
   =================================================================== */

let serie = null;
let cargando = true;
let fallo = false;

function pintarPie(contenedor, datos) {
  const ultimo = datos.at(-1);
  contenedor.innerHTML =
    `<div class="mini cg"><span>Saldo actual</span><b class="num">${esc(fmtK(ultimo ? ultimo.balance : 0))}</b></div>` +
    `<div class="mini cg"><span>Meses registrados</span><b class="num">${esc(datos.length)}</b></div>`;
}

function pintar() {
  const caja = $("grafico-ahorro");
  const pie = $("ahorro-pie");
  if (!caja) return;

  if (cargando) {
    caja.innerHTML = bloqueCargando("grafico", 1);
    if (pie) pie.innerHTML = "";
    return;
  }
  if (fallo || !serie) {
    caja.innerHTML = estadoError("No se pudo cargar la evolución del ahorro.");
    if (pie) pie.innerHTML = "";
    return;
  }

  caja.innerHTML = dibujarGraficoAhorro(serie);
  if (pie) pintarPie(pie, serie);
}

async function cargar() {
  cargando = true;
  fallo = false;
  pintar();

  try {
    serie = await api.get("/months/savings-evolution");
    cargando = false;
  } catch (e) {
    serie = null;
    cargando = false;
    fallo = true;
    console.error("historial: no se pudo pedir la evolución del ahorro", e);
  }
  pintar();
}

function conectarReintentarGrafico() {
  $("grafico-ahorro")?.addEventListener("click", (ev) => {
    if (!/** @type {HTMLElement} */ (ev.target).closest("[data-reintentar]")) return;
    cargar();
  });
}

/* ===================================================================
   Tabla de meses · F08-T07
   =================================================================== */

/* Sólo el mes. Mismo criterio que `barra-mes.js`: pidiendo mes y año
   juntos, `es-AR` devuelve «octubre de 2026», y el «de» no aporta
   nada en una columna angosta. */
const NOMBRES_MES = new Intl.DateTimeFormat("es-AR", {
  month: "long",
  timeZone: "America/Argentina/Buenos_Aires",
});

function nombreDeMes({ year, month }) {
  // Mediodía UTC: con las 00:00 de un día 1, el corrimiento de la
  // zona argentina lo pasa al mes anterior y el título sale mal.
  const texto = NOMBRES_MES.format(new Date(Date.UTC(year, month - 1, 1, 12)));
  return `${texto.charAt(0).toUpperCase()}${texto.slice(1)} ${year}`;
}

const ESTADO_MES = {
  open: { texto: "Abierto", tipo: "info" },
  historical: { texto: "Consolidado", tipo: "neutral" },
};

let cargandoTabla = true;
let fallaTabla = false;

function filaAncha(html) {
  return `<tr><td colspan="6">${html}</td></tr>`;
}

async function pintarTabla() {
  const cuerpo = $("historial-tabla");
  if (!cuerpo) return;

  if (cargandoTabla) {
    cuerpo.innerHTML = filaAncha(bloqueCargando("fila", 4));
    return;
  }
  if (fallaTabla) {
    cuerpo.innerHTML = filaAncha(estadoError("No se pudo cargar el historial."));
    return;
  }

  const lista = await mesesCacheados().catch(() => []);
  if (!lista.length) {
    cuerpo.innerHTML = filaAncha('<p class="ghost-note">Todavía no hay meses cargados.</p>');
    return;
  }

  cuerpo.innerHTML = lista
    .map((m) => {
      const e = ESTADO_MES[m.status] ?? ESTADO_MES.historical;
      return (
        "<tr>" +
        `<td>${esc(nombreDeMes(m))}</td>` +
        `<td class="num">${esc(fmtS(m.income_total))}</td>` +
        `<td class="num">${esc(fmtS(m.expense_total))}</td>` +
        `<td class="num">${esc(fmtS(m.saving_total))}</td>` +
        `<td class="num">${esc(pctPlano(m.saving_rate))}</td>` +
        `<td>${pildora({ texto: e.texto, tipo: e.tipo })}</td>` +
        "</tr>"
      );
    })
    .join("");
}

async function cargarTabla() {
  cargandoTabla = true;
  fallaTabla = false;
  await pintarTabla();

  try {
    await mesesCacheados();
    cargandoTabla = false;
  } catch (e) {
    cargandoTabla = false;
    fallaTabla = true;
    console.error("historial: no se pudo pedir la lista de meses", e);
  }
  await pintarTabla();
}

function conectarReintentarTabla() {
  $("historial-tabla")?.addEventListener("click", (ev) => {
    if (!/** @type {HTMLElement} */ (ev.target).closest("[data-reintentar]")) return;
    cargarTabla();
  });
}

/* ===================================================================
   Carga de mes histórico · F08-T07
   =================================================================== */

/* Mismo truco de `alta-movimiento.js`: el campo es `type="text"` para
   poder mostrar el "." de miles mientras se escribe. */
function soloDigitos(texto) {
  return texto.replace(/\D/g, "");
}
function formatearImporte(digitos) {
  return digitos ? Number(digitos).toLocaleString("es-AR") : "";
}
function enmascarar(campo) {
  campo.value = formatearImporte(soloDigitos(campo.value));
}
function numeroDe(campo) {
  return Number(soloDigitos(campo?.value ?? "")) || 0;
}

/* AAAA-MM de hoy en América/Argentina/Buenos_Aires, para que el campo
   «Mes» no deje elegir uno que todavía no existió (General §12.1). */
const FORMATO_MES_ARG = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
});
function mesActualArgentina() {
  return FORMATO_MES_ARG.format(new Date()).slice(0, 7);
}

let categoriasDelFormulario = [];

function pintarCategoriasFormulario() {
  const caja = $("historico-categorias");
  if (!caja) return;
  if (!categoriasDelFormulario.length) {
    caja.innerHTML = '<p class="ghost-note">No tenés categorías de egreso activas todavía.</p>';
    return;
  }
  caja.innerHTML = categoriasDelFormulario
    .map(
      (c) =>
        '<div class="cfg-row cg">' +
        `<div><b>${esc(c.name)}</b></div>` +
        `<input class="inp num hist-cat-importe" type="text" inputmode="numeric" ` +
        `placeholder="0" autocomplete="off" aria-label="${esc(c.name)}" data-cat-id="${c.id}">` +
        "</div>",
    )
    .join("");
}

function actualizarAhorroFormulario() {
  const ingresos = numeroDe($("historico-ingresos"));
  const egresos = numeroDe($("historico-egresos"));
  const campo = /** @type {HTMLInputElement | null} */ ($("historico-ahorro"));
  if (campo) campo.value = fmtS(ingresos - egresos);
}

/* Regla textual de General §18: "La suma de las categorías no
   coincide con el total de egresos." Es un aviso, no un bloqueo —el
   criterio de aceptación de la tarea deja decidir, no obliga a que
   coincidan. */
function actualizarAvisoCategorias() {
  const caja = $("historico-aviso");
  if (!caja) return;

  const egresos = numeroDe($("historico-egresos"));
  const sumaCategorias = [...document.querySelectorAll("#historico-categorias [data-cat-id]")].reduce(
    (acc, inp) => acc + numeroDe(/** @type {HTMLInputElement} */ (inp)),
    0,
  );

  if (egresos === 0 && sumaCategorias === 0) {
    caja.innerHTML = "";
    return;
  }
  if (sumaCategorias === egresos) {
    caja.innerHTML = "";
    return;
  }
  caja.innerHTML = aviso({
    severidad: "warn",
    titulo: "La suma de las categorías no coincide con el total de egresos.",
    texto: `Diferencia de ${fmtS(Math.abs(egresos - sumaCategorias))}. Podés corregirla o guardar igual.`,
  });
}

function mostrarErrorFormulario(mensaje) {
  const caja = $("historico-error");
  if (!caja) return;
  caja.textContent = mensaje ?? "";
  caja.hidden = !mensaje;
}

function marcarCargandoFormulario(cargandoAhora) {
  const boton = /** @type {HTMLButtonElement | null} */ ($("historico-guardar"));
  if (!boton) return;
  boton.disabled = cargandoAhora;
  boton.classList.toggle("cargando", cargandoAhora);
  boton.setAttribute("aria-busy", String(cargandoAhora));
}

async function alAbrirFormulario() {
  mostrarErrorFormulario(null);
  $("historico-aviso").innerHTML = "";
  /** @type {HTMLInputElement} */ ($("historico-periodo")).value = "";
  /** @type {HTMLInputElement} */ ($("historico-periodo")).max = mesActualArgentina();
  /** @type {HTMLInputElement} */ ($("historico-ingresos")).value = "";
  /** @type {HTMLInputElement} */ ($("historico-egresos")).value = "";
  actualizarAhorroFormulario();

  const caja = $("historico-categorias");
  if (caja) caja.innerHTML = bloqueCargando("fila", 3);
  try {
    categoriasDelFormulario = (await categoriasActivas()).filter((c) => c.type === "expense");
  } catch (e) {
    categoriasDelFormulario = [];
    console.error("historial: no se pudieron pedir las categorías", e);
  }
  pintarCategoriasFormulario();
}

let control = null;
let guardando = false;

/**
 * Manda la carga a la API. Si el mes ya existe `open` con movimientos,
 * el servidor responde 409 (F08-T01, `requiere_confirmacion_para_historico`):
 * se confirma con `window.confirm()` y, si acepta, se reintenta una
 * sola vez con `confirm: true`. Los movimientos no se borran —sólo
 * dejan de leerse (Técnico §6.6)—, así que el riesgo real de aceptar
 * es sólo ese, y es lo que dice el mensaje del propio servidor.
 */
async function enviarCarga(cuerpo, reintentarConConfirmacion = true) {
  try {
    await api.post("/months/historical", cuerpo);
  } catch (e) {
    if (
      reintentarConConfirmacion &&
      e instanceof ApiError &&
      e.code === "CONFLICT" &&
      window.confirm(`${e.message}\n\n¿Confirmás reemplazarlo por estos totales?`)
    ) {
      return enviarCarga({ ...cuerpo, confirm: true }, false);
    }
    throw e;
  }
}

async function alGuardarHistorico(evento) {
  evento.preventDefault();
  if (guardando) return;
  mostrarErrorFormulario(null);

  const campoPeriodo = /** @type {HTMLInputElement} */ ($("historico-periodo"));
  if (!campoPeriodo.value) {
    mostrarErrorFormulario("Elegí el mes.");
    campoPeriodo.focus();
    return;
  }
  const [year, month] = campoPeriodo.value.split("-").map(Number);

  const ingresos = numeroDe($("historico-ingresos"));
  const egresos = numeroDe($("historico-egresos"));
  const categories = [...document.querySelectorAll("#historico-categorias [data-cat-id]")]
    .map((inp) => ({
      category_id: Number(/** @type {HTMLInputElement} */ (inp).dataset.catId),
      importe: numeroDe(/** @type {HTMLInputElement} */ (inp)),
    }))
    .filter((c) => c.importe > 0)
    .map((c) => ({ category_id: c.category_id, total_amount: `${c.importe}.00` }));

  guardando = true;
  marcarCargandoFormulario(true);

  try {
    await enviarCarga({
      year,
      month,
      income_total: `${ingresos}.00`,
      expense_total: `${egresos}.00`,
      saving_total: `${ingresos - egresos}.00`,
      categories,
    });

    control.cerrar();
    invalidarMeses();
    await cargarTabla();
    toast(`${nombreDeMes({ year, month })}: mes histórico cargado.`);
  } catch (e) {
    mostrarErrorFormulario(
      e instanceof ApiError ? e.message : "No se pudo guardar. Probá de nuevo en un momento.",
    );
    if (!(e instanceof ApiError)) console.error("historial: error al cargar el mes histórico", e);
  } finally {
    guardando = false;
    marcarCargandoFormulario(false);
  }
}

function conectarFormulario() {
  const hoja = $("hoja-historico");
  const disparador = $("btn-cargar-historico");
  const form = /** @type {HTMLFormElement | null} */ ($("form-historico"));
  if (!hoja || !disparador || !form) return;

  control = crearHoja(hoja, { disparador, alAbrir: alAbrirFormulario });
  if (!control) return;

  $("historico-ingresos")?.addEventListener("input", (ev) => {
    enmascarar(/** @type {HTMLInputElement} */ (ev.target));
    actualizarAhorroFormulario();
    actualizarAvisoCategorias();
  });
  $("historico-egresos")?.addEventListener("input", (ev) => {
    enmascarar(/** @type {HTMLInputElement} */ (ev.target));
    actualizarAhorroFormulario();
    actualizarAvisoCategorias();
  });
  $("historico-categorias")?.addEventListener("input", (ev) => {
    const campo = /** @type {HTMLElement} */ (ev.target);
    if (!campo.matches("[data-cat-id]")) return;
    enmascarar(/** @type {HTMLInputElement} */ (campo));
    actualizarAvisoCategorias();
  });

  form.addEventListener("submit", alGuardarHistorico);
  form.addEventListener("input", () => mostrarErrorFormulario(null));
}

/* ===================================================================
   Arranque
   =================================================================== */

export function arrancar() {
  const caja = $("grafico-ahorro");
  if (!caja) return;
  if (caja.dataset.conectado === "si") return;
  caja.dataset.conectado = "si";

  conectarReintentarGrafico();
  conectarReintentarTabla();
  conectarFormulario();

  document.addEventListener(EVENTO_RUTA, (ev) => {
    if (/** @type {CustomEvent} */ (ev).detail.id === "historial") {
      cargar();
      cargarTabla();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", arrancar);
} else {
  arrancar();
}
