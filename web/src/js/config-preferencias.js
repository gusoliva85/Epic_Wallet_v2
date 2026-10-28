/* Tarjeta "Preferencias" de Ajustes · F11-T01
   Referencia: 02_Documento_Tecnico.md §9.1 · General §42

   Hasta esta tarea, `#config-preferencias` mostraba interruptores de
   muestra (alertas, cotizaciones, resumen) de funciones que todavía
   no existen (revisado 2026-10-21, a pedido de Gustavo: no tiene
   sentido mostrar un control de algo que no hace nada). La única
   preferencia real hoy es el tema, así que es lo único que queda
   acá — claro, oscuro o el del dispositivo, los tres casos que ya
   resuelve `tema.js`. */

import { EVENTO as EVENTO_RUTA } from "./router.js";
import { sincronizarTema, guardarTema } from "./preferencias.js";
import { activar } from "./components/switch.js";

const $ = (id) => document.getElementById(id);

const OPCIONES = [
  { valor: "light", etiqueta: "Claro" },
  { valor: "dark", etiqueta: "Oscuro" },
  { valor: "sistema", etiqueta: "Sistema" },
];

function valorActual() {
  return window.EpicTema.preferenciaGuardada() ?? "sistema";
}

function marcarActivo() {
  const grupo = $("pref-tema");
  if (!grupo) return;
  const actual = valorActual();
  activar(grupo.querySelector(`button[data-tema="${actual}"]`));
}

function pintar() {
  const caja = $("config-preferencias");
  if (!caja) return;

  // `.cfg-row` es flex en fila a propósito —label a la izquierda,
  // interruptor a la derecha—, pero un `view-switch` de tres pastillas
  // no entra al lado de la descripción sin quedar apretado (Gustavo,
  // 2026-10-21: "quedó cortado"). Acá va en columna: la descripción
  // arriba, el switch abajo, con todo el ancho de la tarjeta.
  caja.innerHTML =
    '<div class="cfg-row cg" style="flex-direction: column; align-items: stretch; gap: 10px">' +
    "<div><b>Tema</b><span>Claro, oscuro o el de tu dispositivo.</span></div>" +
    '<div class="view-switch" role="group" aria-label="Tema" id="pref-tema">' +
    OPCIONES.map((o) => `<button type="button" data-tema="${o.valor}">${o.etiqueta}</button>`).join(
      "",
    ) +
    "</div></div>";

  marcarActivo();
}

async function alElegir(valor) {
  await guardarTema(valor === "sistema" ? null : valor);
  marcarActivo();
}

function conectar() {
  const caja = $("config-preferencias");
  if (!caja) return;
  if (caja.dataset.conectado === "si") return;
  caja.dataset.conectado = "si";

  pintar();

  caja.addEventListener("click", (ev) => {
    const boton = ev.target.closest("button[data-tema]");
    if (boton) alElegir(boton.dataset.tema);
  });

  // Al entrar a Ajustes se reconcilia con lo que tenga guardado la
  // cuenta: es el punto natural para notar que, por ejemplo, se
  // cambió el tema desde otro dispositivo.
  document.addEventListener(EVENTO_RUTA, async (ev) => {
    if (ev.detail.id !== "config") return;
    await sincronizarTema();
    marcarActivo();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", conectar);
} else {
  conectar();
}
