/* Saldo inicial editable, en Ajustes → Datos laborales · F09-T05
   Referencia: 02_Documento_Tecnico.md §9.1 · General §30

   La tarjeta "Datos laborales" tiene cuatro fichas; sólo una es real
   acá —"Sueldo actual", "Vigente desde" y "Primer mes registrado" son
   de la fase de historial salarial (después del MVP, roadmap) y
   siguen saliendo de `datos-muestra.js`, sin tocar—. "Saldo inicial
   del sistema" se reemplaza por el valor real de `GET /api/me`, y se
   edita desde la hoja que abre el botón "Editar" de la cabecera.

   Cambiarlo recalcula TODO el acumulado del lado del servidor
   (`services.months.recalcular_saldos_acumulados`, ya disparado por
   `PATCH /api/me` desde esta tarea): acá sólo se manda el número y se
   invalida la caché de meses, para que la tabla de Historial no quede
   mostrando un `closing_balance` viejo si se la visita después. */

import { api, ApiError } from "./api.js";
import { esc, fmtS } from "./format.js";
import { toast } from "./components/toast.js";
import { crearHoja } from "./components/sheet.js";
import { invalidarMeses } from "./cache-meses.js";
import { LABORALES } from "./datos-muestra.js";

const $ = (id) => document.getElementById(id);

const NOMBRE_SALDO = "Saldo inicial del sistema";

function ficha(nombre, valor) {
  return `<div class="kv cg"><span>${esc(nombre)}</span><b class="num">${esc(valor)}</b></div>`;
}

function pintarLaborales(saldoInicial) {
  const caja = $("config-laborales");
  if (!caja) return;
  caja.innerHTML = LABORALES.map((l) =>
    l.nombre === NOMBRE_SALDO ? ficha(l.nombre, fmtS(saldoInicial)) : ficha(l.nombre, l.valor),
  ).join("");
}

let saldoActual = "0";

async function cargarSaldo() {
  try {
    const perfil = await api.get("/me");
    saldoActual = perfil.opening_balance;
  } catch (e) {
    saldoActual = "0";
    console.error("saldo-inicial: no se pudo pedir el perfil", e);
  }
  pintarLaborales(saldoActual);
}

// ===================================================================
//  La hoja de edición — mismo enmascarado que alta-movimiento.js e
//  historial.js: `type="text"` para poder mostrar el "." de miles
//  mientras se escribe.
// ===================================================================

function soloDigitos(texto) {
  return texto.replace(/\D/g, "");
}
function formatearImporte(digitos) {
  return digitos ? Number(digitos).toLocaleString("es-AR") : "";
}
function enmascarar(campo) {
  campo.value = formatearImporte(soloDigitos(campo.value));
}

function mostrarError(mensaje) {
  const caja = $("saldo-inicial-error");
  if (!caja) return;
  caja.textContent = mensaje ?? "";
  caja.hidden = !mensaje;
}

function marcarCargando(cargandoAhora) {
  const boton = /** @type {HTMLButtonElement | null} */ ($("saldo-inicial-guardar"));
  if (!boton) return;
  boton.disabled = cargandoAhora;
  boton.classList.toggle("cargando", cargandoAhora);
  boton.setAttribute("aria-busy", String(cargandoAhora));
}

function alAbrir() {
  mostrarError(null);
  const campo = /** @type {HTMLInputElement} */ ($("saldo-inicial-importe"));
  // El importe actual puede traer decimales ("4140505.00"); el campo
  // sólo edita la parte entera, igual que el resto de los importes de
  // la aplicación (son pesos enteros, Técnico §12.4).
  campo.value = formatearImporte(String(Math.round(Number(saldoActual) || 0)));
  campo.focus();
}

let guardando = false;
let control = null;

async function alGuardar(evento) {
  evento.preventDefault();
  if (guardando) return;
  mostrarError(null);

  const campo = /** @type {HTMLInputElement} */ ($("saldo-inicial-importe"));
  const monto = Number(soloDigitos(campo.value)) || 0;

  guardando = true;
  marcarCargando(true);
  try {
    const perfil = await api.patch("/me", { opening_balance: `${monto}.00` });
    saldoActual = perfil.opening_balance;
    pintarLaborales(saldoActual);
    invalidarMeses();
    control.cerrar();
    toast("Saldo inicial actualizado.");
  } catch (e) {
    mostrarError(
      e instanceof ApiError ? e.message : "No se pudo guardar. Probá de nuevo en un momento.",
    );
    if (!(e instanceof ApiError)) console.error("saldo-inicial: error al guardar", e);
  } finally {
    guardando = false;
    marcarCargando(false);
  }
}

// ===================================================================

export function arrancar() {
  const caja = $("config-laborales");
  const hoja = $("hoja-saldo-inicial");
  const disparador = $("btn-editar-saldo-inicial");
  const form = /** @type {HTMLFormElement | null} */ ($("form-saldo-inicial"));
  if (!caja || !hoja || !disparador || !form) return;

  if (caja.dataset.conectado === "si") return;
  caja.dataset.conectado = "si";

  control = crearHoja(hoja, { disparador, alAbrir });
  if (!control) return;

  $("saldo-inicial-importe")?.addEventListener("input", (ev) => {
    enmascarar(/** @type {HTMLInputElement} */ (ev.target));
  });
  form.addEventListener("submit", alGuardar);
  form.addEventListener("input", () => mostrarError(null));

  pintarLaborales(saldoActual);
  cargarSaldo();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", arrancar);
} else {
  arrancar();
}
