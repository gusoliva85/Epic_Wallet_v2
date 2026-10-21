/* Vista Cartera: indicadores, tabla, alta y detalle · F10-T08
   Referencia: 01_Documento_General.md §20, §21, §22 · 02_Documento_Tecnico.md
   §9.1 · Roadmap F10-T01 (cálculo), F10-T04/F10-T06 (servicio y
   endpoints), F10-T08 (esta pantalla)

   Una sola llamada a `GET /api/investments` alimenta los indicadores Y
   la tabla, mismo criterio que el tablero de Inicio con
   `GET /api/dashboard` (F05-T04): evita pedir la cartera dos veces
   para pintar dos paneles que ya vienen juntos en la respuesta.

   La cartera es información, no bitácora de gastos (decisión de
   Gustavo, 2026-10-17, revisa F10-T06): comprar, actualizar el valor y
   vender nunca tocan el ahorro del mes. Lo que se deposita en la
   cuenta de inversión se carga aparte, a mano, en Movimientos —acá no
   hay nada que invalidar en `cache-meses.js`, porque nada de esta
   pantalla escribe en `transactions`. */

import { api, ApiError } from "./api.js";
import { esc, fmt, fmtS, pct } from "./format.js";
import { bloqueCargando, error as estadoError, vacio } from "./components/estados.js";
import { tarjetaHeroe, tarjetaMetrica, pintarTarjetas, animarCifras } from "./components/kpi.js";
import { crearHoja } from "./components/sheet.js";
import { toast } from "./components/toast.js";
import { EVENTO as EVENTO_RUTA } from "./router.js";

const $ = (id) => document.getElementById(id);

const ETIQUETA_TIPO = {
  obligacion_negociable: "Obligación Negociable",
  bono: "Bono",
  cedear: "CEDEAR",
  accion: "Acción",
  fci: "FCI",
  otro: "Otro",
};

/* ===================================================================
   Indicadores y tabla
   =================================================================== */

let cartera = null;
let cargando = true;
let fallo = false;

function colorDeSigno(valor) {
  return Number(valor) < 0 ? "amt-out" : "amt-in";
}

/** Mismo orden en `tarjetasDeCartera` y en `valoresParaContar`: la
 * animación de conteo empareja `.kpi-num` por posición (kpi.js,
 * `animarCifras`). */
function tarjetasDeCartera(ind) {
  const posiciones = `${ind.position_count} posición${ind.position_count === 1 ? "" : "es"}`;
  return [
    tarjetaHeroe({
      etiqueta: "Valor de la cartera",
      cifra: fmt(ind.current_value),
      sub: `${pct(ind.return_percentage)} sobre lo invertido`,
      pieIzq: `Invertido ${fmt(ind.total_invested)}`,
      pieDer: posiciones,
      color: "sav",
    }),
    tarjetaMetrica({
      etiqueta: "Invertido",
      cifra: fmt(ind.total_invested),
      sub: "Suma de los valores iniciales",
      color: "accent",
    }),
    tarjetaMetrica({
      etiqueta: "Rendimiento",
      cifra: fmtS(ind.return_amount),
      sub: "Sobre el total de la cartera",
      color: Number(ind.return_amount) < 0 ? "egr" : "inc",
    }),
  ];
}

function valoresParaContar(ind) {
  return [
    { valor: Number(ind.current_value), formatear: fmt },
    { valor: Number(ind.total_invested), formatear: fmt },
    { valor: Number(ind.return_amount), formatear: fmtS },
  ];
}

function pintarIndicadores() {
  const caja = $("kpis-cartera");
  if (!caja) return;

  if (cargando) {
    caja.innerHTML = bloqueCargando("tarjeta", 3);
    return;
  }
  if (fallo || !cartera) {
    caja.innerHTML = `<div style="grid-column: 1 / -1">${estadoError("No se pudo cargar la cartera.")}</div>`;
    return;
  }

  pintarTarjetas(caja, tarjetasDeCartera(cartera.indicators));
  animarCifras(caja, valoresParaContar(cartera.indicators));
}

function pintarTabla() {
  const cuerpo = $("cartera-tabla");
  if (!cuerpo) return;

  if (cargando) {
    cuerpo.innerHTML = `<tr><td colspan="5">${bloqueCargando("fila", 3)}</td></tr>`;
    return;
  }
  if (fallo || !cartera) {
    cuerpo.innerHTML = `<tr><td colspan="5">${estadoError("No se pudo cargar la cartera.")}</td></tr>`;
    return;
  }
  if (cartera.positions.length === 0) {
    cuerpo.innerHTML = `<tr><td colspan="5">${vacio("Sin posiciones todavía", 'Cargá la primera con "+ Inversión", arriba.')}</td></tr>`;
    return;
  }

  cuerpo.innerHTML = cartera.positions
    .map((p) => {
      const nominales = Number(p.nominal_quantity) === 0 ? "—" : Number(p.nominal_quantity).toLocaleString("es-AR", { maximumFractionDigits: 4 });
      return (
        `<tr tabindex="0" data-id="${p.id}" aria-label="Ver el detalle de ${esc(p.symbol)}">` +
        `<td class="pos-nombre"><b>${esc(p.symbol)}</b><span>${esc(p.name)}</span></td>` +
        `<td class="num">${esc(nominales)}</td>` +
        `<td class="num">${esc(fmt(p.initial_value))}</td>` +
        `<td class="num">${esc(fmt(p.current_value))}</td>` +
        `<td class="num ${colorDeSigno(p.return_amount)}">${esc(fmtS(p.return_amount))}` +
        `<br><span style="font-size: var(--text-pill)">${esc(pct(p.return_percentage))}</span></td>` +
        "</tr>"
      );
    })
    .join("");
}

function pintar() {
  pintarIndicadores();
  pintarTabla();
}

async function cargar() {
  cargando = true;
  fallo = false;
  pintar();

  try {
    cartera = await api.get("/investments");
    cargando = false;
  } catch (e) {
    cartera = null;
    cargando = false;
    fallo = true;
    console.error("cartera: no se pudo pedir la cartera", e);
  }
  pintar();
}

function posicionPorId(id) {
  return cartera?.positions.find((p) => String(p.id) === String(id));
}

function conectarReintentar() {
  const alReintentar = (ev) => {
    if (!/** @type {HTMLElement} */ (ev.target).closest("[data-reintentar]")) return;
    cargar();
  };
  $("kpis-cartera")?.addEventListener("click", alReintentar);
  $("cartera-tabla")?.addEventListener("click", alReintentar);
}

/* ===================================================================
   Campos numéricos — dos estilos en la misma pantalla:
   - importe en pesos (precio de compra, precio actual): mismo
     enmascarado de miles que el resto de la aplicación
     (alta-movimiento.js, historial.js, saldo-inicial.js).
   - nominales: decimal de verdad, informativo (hasta 4 cifras,
     Técnico §6.2), sin enmascarado de miles, se lee con `Number()`.
   =================================================================== */

function soloDigitos(texto) {
  return texto.replace(/\D/g, "");
}
function formatearImporte(digitos) {
  return digitos ? Number(digitos).toLocaleString("es-AR") : "";
}
function enmascarar(campo) {
  campo.value = formatearImporte(soloDigitos(campo.value));
}
function numeroImporte(campo) {
  return Number(soloDigitos(campo?.value ?? "")) || 0;
}
function numeroDecimal(campo) {
  const limpio = (campo?.value ?? "").replace(",", ".").trim();
  const n = Number(limpio);
  return Number.isFinite(n) ? n : 0;
}

/* ===================================================================
   Hoja de alta (comprar) · F10-T06
   =================================================================== */

let controlAlta = null;
let guardandoAlta = false;

function mostrarErrorAlta(mensaje) {
  const caja = $("inversion-error");
  if (!caja) return;
  caja.textContent = mensaje ?? "";
  caja.hidden = !mensaje;
}

function marcarCargandoAlta(cargandoAhora) {
  const boton = /** @type {HTMLButtonElement | null} */ ($("inversion-guardar"));
  if (!boton) return;
  boton.disabled = cargandoAhora;
  boton.classList.toggle("cargando", cargandoAhora);
  boton.setAttribute("aria-busy", String(cargandoAhora));
}

function alAbrirAlta() {
  mostrarErrorAlta(null);
  /** @type {HTMLInputElement} */ ($("inversion-simbolo")).value = "";
  /** @type {HTMLInputElement} */ ($("inversion-nombre")).value = "";
  /** @type {HTMLSelectElement} */ ($("inversion-tipo")).value = "otro";
  /** @type {HTMLInputElement} */ ($("inversion-nominales")).value = "";
  /** @type {HTMLInputElement} */ ($("inversion-precio-compra")).value = "";
  $("inversion-simbolo")?.focus();
}

async function alGuardarAlta(evento) {
  evento.preventDefault();
  if (guardandoAlta) return;
  mostrarErrorAlta(null);

  const simbolo = /** @type {HTMLInputElement} */ ($("inversion-simbolo")).value.trim();
  const nombre = /** @type {HTMLInputElement} */ ($("inversion-nombre")).value.trim();
  if (!simbolo || !nombre) {
    mostrarErrorAlta("Completá el símbolo y el nombre.");
    (simbolo ? $("inversion-nombre") : $("inversion-simbolo"))?.focus();
    return;
  }

  const datos = {
    symbol: simbolo,
    name: nombre,
    investment_type: /** @type {HTMLSelectElement} */ ($("inversion-tipo")).value,
    initial_value: `${numeroImporte($("inversion-precio-compra"))}.00`,
    nominal_quantity: String(numeroDecimal($("inversion-nominales"))),
  };

  guardandoAlta = true;
  marcarCargandoAlta(true);
  try {
    await api.post("/investments", datos);
    controlAlta.cerrar();
    await cargar();
    toast(`${simbolo}: posición cargada.`);
  } catch (e) {
    mostrarErrorAlta(
      e instanceof ApiError ? e.message : "No se pudo guardar. Probá de nuevo en un momento.",
    );
    if (!(e instanceof ApiError)) console.error("cartera: error al comprar", e);
  } finally {
    guardandoAlta = false;
    marcarCargandoAlta(false);
  }
}

function conectarAlta() {
  const hoja = $("hoja-inversion");
  const disparador = $("btn-nueva-inversion");
  const form = /** @type {HTMLFormElement | null} */ ($("form-inversion"));
  if (!hoja || !disparador || !form) return;

  controlAlta = crearHoja(hoja, { disparador, alAbrir: alAbrirAlta });
  if (!controlAlta) return;

  $("inversion-precio-compra")?.addEventListener("input", (ev) => {
    enmascarar(/** @type {HTMLInputElement} */ (ev.target));
  });

  form.addEventListener("submit", alGuardarAlta);
  form.addEventListener("input", () => mostrarErrorAlta(null));
}

/* ===================================================================
   Hoja de detalle: actualizar valor y vender · F10-T06
   =================================================================== */

let controlDetalle = null;
let posicionActual = null;
let guardandoValor = false;

function pintarKvDetalle(p) {
  const filas = [
    ["Tipo", ETIQUETA_TIPO[p.investment_type] ?? p.investment_type],
    [
      "Nominales",
      Number(p.nominal_quantity) === 0
        ? "—"
        : Number(p.nominal_quantity).toLocaleString("es-AR", { maximumFractionDigits: 4 }),
    ],
    ["Precio de compra", fmt(p.initial_value)],
    ["Precio actual", fmt(p.current_value)],
    [
      "Rendimiento",
      `${fmtS(p.return_amount)} · ${pct(p.return_percentage)}`,
      colorDeSigno(p.return_amount),
    ],
  ];
  return filas
    .map(
      ([etiqueta, valor, clase]) =>
        `<div class="kv cg"><span>${esc(etiqueta)}</span><b class="num${clase ? ` ${clase}` : ""}">${esc(valor)}</b></div>`,
    )
    .join("");
}

function alAbrirDetalle(p) {
  posicionActual = p;
  mostrarErrorDetalle(null);
  $("inversion-detalle-titulo").textContent = p.symbol;
  $("inversion-detalle-sub").textContent = p.name;
  $("inversion-detalle-kv").innerHTML = pintarKvDetalle(p);
  /** @type {HTMLInputElement} */ ($("inversion-detalle-valor")).value = formatearImporte(
    String(Math.round(Number(p.current_value))),
  );

  controlDetalle.abrir();
}

function mostrarErrorDetalle(mensaje) {
  const caja = $("inversion-detalle-error");
  if (!caja) return;
  caja.textContent = mensaje ?? "";
  caja.hidden = !mensaje;
}

function marcarCargandoDetalle(cargandoAhora) {
  const boton = /** @type {HTMLButtonElement | null} */ ($("inversion-detalle-guardar"));
  if (!boton) return;
  boton.disabled = cargandoAhora;
  boton.classList.toggle("cargando", cargandoAhora);
  boton.setAttribute("aria-busy", String(cargandoAhora));
}

async function alGuardarValor(evento) {
  evento.preventDefault();
  if (guardandoValor || !posicionActual) return;
  mostrarErrorDetalle(null);

  const cambios = { current_value: `${numeroImporte($("inversion-detalle-valor"))}.00` };

  guardandoValor = true;
  marcarCargandoDetalle(true);
  try {
    await api.put(`/investments/${posicionActual.id}`, cambios);
    controlDetalle.cerrar();
    await cargar();
    toast("Valor actualizado.");
  } catch (e) {
    mostrarErrorDetalle(
      e instanceof ApiError ? e.message : "No se pudo guardar. Probá de nuevo en un momento.",
    );
    if (!(e instanceof ApiError)) console.error("cartera: error al actualizar el valor", e);
  } finally {
    guardandoValor = false;
    marcarCargandoDetalle(false);
  }
}

async function alVender() {
  if (!posicionActual) return;
  // R10: la eliminación de una inversión pide confirmación. No
  // acredita nada al ahorro —si entró plata de la venta a tu cuenta,
  // se carga aparte, a mano, en Movimientos.
  const confirmado = window.confirm(`¿Vender ${posicionActual.symbol}? No se puede deshacer.`);
  if (!confirmado) return;

  try {
    await api.del(`/investments/${posicionActual.id}`);
    controlDetalle.cerrar();
    await cargar();
    toast(`${posicionActual.symbol} vendida.`);
  } catch (e) {
    toast(e instanceof ApiError ? e.message : "No se pudo vender. Probá de nuevo.", { severidad: "crit" });
    if (!(e instanceof ApiError)) console.error("cartera: error al vender", e);
  }
}

function conectarDetalle() {
  const hoja = $("hoja-inversion-detalle");
  const form = /** @type {HTMLFormElement | null} */ ($("form-inversion-valor"));
  if (!hoja || !form) return;

  controlDetalle = crearHoja(hoja);
  if (!controlDetalle) return;

  const abrirDesdeFila = (fila) => {
    const p = posicionPorId(fila.getAttribute("data-id"));
    if (p) alAbrirDetalle(p);
  };
  $("cartera-tabla")?.addEventListener("click", (ev) => {
    const fila = /** @type {HTMLElement} */ (ev.target).closest("tr[data-id]");
    if (fila) abrirDesdeFila(fila);
  });
  $("cartera-tabla")?.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter" && ev.key !== " ") return;
    const fila = /** @type {HTMLElement} */ (ev.target).closest("tr[data-id]");
    if (!fila) return;
    ev.preventDefault();
    abrirDesdeFila(fila);
  });

  $("inversion-detalle-valor")?.addEventListener("input", (ev) => {
    enmascarar(/** @type {HTMLInputElement} */ (ev.target));
    mostrarErrorDetalle(null);
  });

  form.addEventListener("submit", alGuardarValor);
  $("inversion-detalle-vender")?.addEventListener("click", alVender);
}

/* ===================================================================
   Arranque
   =================================================================== */

export function arrancar() {
  const caja = $("kpis-cartera");
  if (!caja) return;
  if (caja.dataset.conectado === "si") return;
  caja.dataset.conectado = "si";

  conectarReintentar();
  conectarAlta();
  conectarDetalle();

  document.addEventListener(EVENTO_RUTA, (ev) => {
    if (/** @type {CustomEvent} */ (ev).detail.id === "inversiones") cargar();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", arrancar);
} else {
  arrancar();
}
