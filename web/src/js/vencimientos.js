/* Vencimientos · F13-T03
   Referencia: 01_Documento_General.md §29 · 02_Documento_Tecnico.md §9.1
   Mockup aprobado por Gustavo el 2026-11-10.

   Tres lugares, un solo módulo, porque son el mismo tema:

   - la **sección** nueva (lista de ítems, su configuración y las
     alertas de hoy arriba),
   - la **tarjeta del tablero** («Próximos vencimientos»),
   - el **globo de la campanita** de la barra superior.

   DE DÓNDE SALEN LOS DATOS

   La sección pide `GET /api/dues`. El tablero y la campanita NO piden
   nada: usan las alertas que ya vienen dentro de `GET /api/dashboard`
   (`dues_alerts`), que es la única llamada del tablero (CLAUDE.md).
   `dashboard.js` las reemite en `EVENTO_VENCIMIENTOS` y acá se
   escuchan.

   Y cuando se cambia algo en la sección, las alertas globales se
   vuelven a pintar con la respuesta de ese mismo cambio: sin eso, el
   globo seguiría mostrando el número viejo hasta la próxima carga del
   tablero.

   EL ESTADO LO DECIDE EL SERVIDOR. Acá no se calcula ningún día que
   falta: viene en `days_left` y `state`. Con dos dispositivos de
   relojes distintos, calcularlo en el cliente mostraría dos alertas
   diferentes para el mismo vencimiento. */

import { api } from "./api.js";
import { esc, fmt } from "./format.js";
import { aviso, pildora } from "./components/avisos.js";
import { bloqueCargando, error as estadoError } from "./components/estados.js";
import { toast } from "./components/toast.js";
import { EVENTO_VENCIMIENTOS } from "./dashboard.js";
import { EVENTO as EVENTO_RUTA } from "./router.js";

const $ = (id) => document.getElementById(id);

/* Los días que se ofrecen como aviso. No es 1..30 en un selector de
   treinta posiciones: los valores útiles son pocos y un selector corto
   se usa de un toque. */
const AVISOS = [1, 2, 3, 5, 7, 10];

/* El texto de cada estado. El color no es lo único que dice la
   gravedad (skill §8): cada estado tiene su frase y su píldora. */
const TEXTOS = {
  paid: { pill: "ok", corto: "Pagado" },
  overdue: { pill: "crit", corto: "Vencido" },
  today: { pill: "crit", corto: "Vence hoy" },
  tomorrow: { pill: "crit", corto: "Falta 1 día" },
  soon: { pill: "warn", corto: "Por vencer" },
  scheduled: { pill: "neutral", corto: "Programado" },
};

/** La severidad del servidor («ok», «warn», «crit») es la misma del
 * sistema de diseño, así que se usa tal cual en `aviso()`. */
function tituloDeAlerta(a) {
  const dias = Math.abs(a.days_left);
  switch (a.state) {
    case "overdue":
      return `${a.name} está vencido`;
    case "today":
      return `${a.name} vence hoy`;
    case "tomorrow":
      return `${a.name} vence mañana`;
    default:
      return `Faltan ${dias} días para ${a.name}`;
  }
}

function textoDeAlerta(a) {
  const estimado = a.estimated ? ` Estimado: ${fmt(a.estimated)}.` : "";
  switch (a.state) {
    case "overdue": {
      const dias = Math.abs(a.days_left);
      return `Venció el día ${a.due_day}, hace ${dias} ${dias === 1 ? "día" : "días"}, y no figura pagado.${estimado}`;
    }
    case "today":
      return `Hoy es el día ${a.due_day} y todavía no figura pagado.${estimado}`;
    case "tomorrow":
      return `Vence el día ${a.due_day}.${estimado}`;
    default:
      return `Vence el día ${a.due_day}.${estimado}`;
  }
}

function tarjetasDeAlerta(alertas) {
  return alertas
    .map((a) =>
      aviso({
        severidad: a.severity === "crit" ? "crit" : "warn",
        titulo: tituloDeAlerta(a),
        texto: textoDeAlerta(a),
      }),
    )
    .join("");
}

/* ==================================================================
   El tablero y la campanita
   ================================================================== */

/** Pinta la tarjeta del tablero y el globo de la campanita.
 *
 * Exportada para las pruebas y para que la propia sección la llame con
 * la respuesta de un cambio: las alertas globales no pueden quedar
 * esperando la próxima carga del tablero.
 *
 * @param {{category_id:number, name:string, state:string, severity:string,
 *          days_left:number, due_day:number, estimated:string|null}[]} alertas
 */
export function pintarAlertasGlobales(alertas) {
  const tarjeta = $("tarjeta-vencimientos");
  const caja = $("vencimientos-inicio");
  if (tarjeta && caja) {
    // Sin nada por vencer la tarjeta entera desaparece: una tarjeta que
    // dice "no hay nada" ocupa el lugar de la que sí importa.
    tarjeta.hidden = alertas.length === 0;
    caja.innerHTML = tarjetasDeAlerta(alertas);
  }

  const contador = $("contador-alertas");
  if (contador) {
    contador.textContent = String(alertas.length);
    // Con cero, el globo se esconde: un cero rojo alarma sin motivo.
    contador.hidden = alertas.length === 0;
  }
  $("btn-alertas")?.setAttribute(
    "aria-label",
    alertas.length === 1 ? "Alertas: 1 vencimiento" : `Alertas: ${alertas.length} vencimientos`,
  );

  // La hoja que abre la campanita muestra las mismas alertas. Si no se
  // escribiera acá, el globo diría "2" y la hoja estaría vacía.
  const hoja = $("alertas-lista");
  if (hoja) {
    hoja.innerHTML = alertas.length
      ? tarjetasDeAlerta(alertas)
      : '<p class="ghost-note" style="margin: 0">No hay vencimientos próximos. Lo que ya cargaste como pagado no cuenta.</p>';
  }
}

/* ==================================================================
   La sección
   ================================================================== */

let items = [];
let filtro = "todos";
let cargando = false;
let fallo = false;
/** Ítems con un cambio en vuelo, para no mandar dos pedidos del mismo
 * interruptor si se lo toca dos veces rápido. */
const enVuelo = new Set();

function filaDeItem(item) {
  const texto = TEXTOS[item.state] ?? TEXTOS.scheduled;

  const bajada = item.enabled
    ? `Vence el ${item.due_day} · aviso ${item.notice_days} ${item.notice_days === 1 ? "día" : "días"} antes`
    : "Sin vencimiento";

  const opcionesDeDia = Array.from(
    { length: 31 },
    (_, i) =>
      `<option value="${i + 1}"${i + 1 === item.due_day ? " selected" : ""}>${i + 1}</option>`,
  ).join("");

  const opcionesDeAviso = AVISOS.map(
    (d) =>
      `<option value="${d}"${d === item.notice_days ? " selected" : ""}>${d} ${d === 1 ? "día" : "días"}</option>`,
  ).join("");

  const detalle = item.enabled
    ? '<div class="venc-detalle">' +
      `<div class="venc-campo"><label for="venc-dia-${item.category_id}">Día de vencimiento</label>` +
      `<select class="inp" id="venc-dia-${item.category_id}" data-dia="${item.category_id}">${opcionesDeDia}</select></div>` +
      `<div class="venc-campo"><label for="venc-aviso-${item.category_id}">Avisame antes</label>` +
      `<select class="inp" id="venc-aviso-${item.category_id}" data-aviso="${item.category_id}">${opcionesDeAviso}</select></div>` +
      '<div class="venc-estado">' +
      pildora({ texto: etiquetaDeEstado(item), tipo: texto.pill }) +
      (item.estimated
        ? `<span class="venc-nota">Estimado ${esc(fmt(item.estimated))} · lo del mes pasado</span>`
        : '<span class="venc-nota">Sin mes anterior para estimar</span>') +
      "</div></div>"
    : "";

  return (
    `<div class="venc-item cg" data-item="${item.category_id}">` +
    '<div class="cfg-row">' +
    `<div><b>${esc(item.name)}</b><span>${esc(bajada)}</span></div>` +
    `<button class="toggle" type="button" role="switch" aria-checked="${item.enabled}" ` +
    `aria-label="Vencimiento de ${esc(item.name)}" data-toggle="${item.category_id}"></button>` +
    "</div>" +
    detalle +
    "</div>"
  );
}

/** El texto de la píldora: con los días que faltan cuando aplica. */
function etiquetaDeEstado(item) {
  const texto = TEXTOS[item.state] ?? TEXTOS.scheduled;
  if (item.state === "soon") return `Faltan ${item.days_left} días`;
  if (item.state === "overdue") {
    const dias = Math.abs(item.days_left);
    return `Vencido hace ${dias} ${dias === 1 ? "día" : "días"}`;
  }
  if (item.state === "scheduled") return `En ${item.days_left} días`;
  return texto.corto;
}

function pintarSeccion() {
  const lista = $("venc-lista");
  if (!lista) return;

  if (cargando) {
    lista.innerHTML = bloqueCargando("fila", 4);
    return;
  }
  if (fallo) {
    lista.innerHTML = estadoError("No se pudieron cargar tus ítems.");
    return;
  }

  const visibles = filtro === "todos" ? items : items.filter((i) => i.enabled);
  lista.innerHTML = visibles.length
    ? visibles.map(filaDeItem).join("")
    : '<p class="ghost-note" style="margin: 0">Todavía no prendiste ningún vencimiento. Cambiá el filtro a «Todos» y elegí el primero.</p>';

  const alertas = $("vencimientos-alertas");
  if (alertas) alertas.innerHTML = tarjetasDeAlerta(items.filter((i) => i.alert));
}

async function cargar() {
  cargando = true;
  fallo = false;
  pintarSeccion();
  try {
    items = await api.get("/dues");
    cargando = false;
  } catch (e) {
    items = [];
    cargando = false;
    fallo = true;
    console.error("vencimientos: no se pudieron pedir los ítems", e);
  }
  pintarSeccion();
  if (!fallo) pintarAlertasGlobales(items.filter((i) => i.alert));
}

/** Guarda la configuración de un ítem y vuelve a pintar con lo que
 * respondió el servidor — no con lo que se tocó: el estado («faltan 3
 * días», «vence hoy») lo decide el servidor, y adivinarlo acá es
 * exactamente la clase de número inventado que el proyecto no permite. */
async function guardar(categoryId, cambios) {
  const item = items.find((i) => i.category_id === categoryId);
  if (!item || enVuelo.has(categoryId)) return;
  enVuelo.add(categoryId);

  try {
    const guardado = await api.put(`/dues/${categoryId}`, {
      enabled: cambios.enabled ?? item.enabled,
      due_day: cambios.due_day ?? item.due_day,
      notice_days: cambios.notice_days ?? item.notice_days,
    });
    items = items.map((i) => (i.category_id === categoryId ? guardado : i));
    pintarSeccion();
    pintarAlertasGlobales(items.filter((i) => i.alert));
  } catch (e) {
    console.error("vencimientos: no se pudo guardar", e);
    toast(e?.message || "No se pudo guardar el vencimiento.", { severidad: "crit" });
    // Vuelve a pintar para que el interruptor no quede mostrando un
    // estado que no se guardó.
    pintarSeccion();
  } finally {
    enVuelo.delete(categoryId);
  }
}

/* ------------------------------------------------------------ armado */

export async function arrancar() {
  // Las alertas globales se escuchan siempre, aunque la sección no
  // exista en el DOM (una página que sólo tenga el tablero).
  document.addEventListener(EVENTO_VENCIMIENTOS, (ev) => {
    pintarAlertasGlobales(/** @type {CustomEvent} */ (ev).detail ?? []);
  });

  const lista = $("venc-lista");
  if (!lista) return;
  if (lista.dataset.conectado === "si") return;
  lista.dataset.conectado = "si";

  lista.addEventListener("click", (ev) => {
    const destino = /** @type {HTMLElement} */ (ev.target);

    const interruptor = destino.closest("[data-toggle]");
    if (interruptor) {
      const id = Number(interruptor.dataset.toggle);
      const item = items.find((i) => i.category_id === id);
      if (item) guardar(id, { enabled: !item.enabled });
      return;
    }

    if (destino.closest("[data-reintentar]")) cargar();
  });

  lista.addEventListener("change", (ev) => {
    const destino = /** @type {HTMLSelectElement} */ (ev.target);
    if (destino.dataset.dia) {
      guardar(Number(destino.dataset.dia), { due_day: Number(destino.value) });
    } else if (destino.dataset.aviso) {
      guardar(Number(destino.dataset.aviso), { notice_days: Number(destino.value) });
    }
  });

  $("venc-filtro")?.addEventListener("click", (ev) => {
    const boton = /** @type {HTMLElement} */ (ev.target).closest("[data-filtro]");
    if (!boton) return;
    filtro = boton.dataset.filtro;
    pintarSeccion();
  });

  /* La lista se pide la primera vez que se ENTRA a la sección, no al
     cargar la página: Vencimientos no es la vista de arranque, y pedirla
     igual sería una llamada más en cada carga —y un error en la consola
     en la pantalla de login, donde todavía no hay sesión—. Las alertas
     del tablero y la campanita no dependen de esto: vienen con el
     dashboard. */
  document.addEventListener(EVENTO_RUTA, (ev) => {
    const id = /** @type {CustomEvent} */ (ev).detail?.id;
    if (id === "vencimientos" && !items.length && !cargando) cargar();
  });

  // Y si la página se abrió directo en `#/vencimientos`, el evento de
  // ruta ya pasó antes de que este módulo se conectara. Se lee de
  // `window.location` y no del `location` global: así funciona también
  // con el DOM de las pruebas, donde el global no existe.
  const ruta = (window.location?.hash ?? "").replace(/^#\/?/, "").split("?")[0];
  if (ruta === "vencimientos") await cargar();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", arrancar);
  } else {
    arrancar();
  }
}
