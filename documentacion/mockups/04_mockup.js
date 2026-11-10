/* Mockup de dos propuestas · Comparación por ítem y Vencimientos
   ---------------------------------------------------------------
   NO es código de la aplicación. Vive en `documentacion/mockups/` y se
   mira en el navegador. Usa el CSS compilado de la app para que lo que
   se ve sea lo que se vería de verdad; la lógica de acá es la mínima
   para poder tocar la pantalla y entender la propuesta.

   Lo que se puede probar:
     · elegir un ítem y un rango (3, 6, 12 meses o todo el histórico);
     · tocar una barra para ver ese mes contra el anterior;
     · mover el "hoy simulado" y ver las alertas cambiar de amarillo a
       rojo y desaparecer;
     · prender y apagar el vencimiento de cada ítem, cambiar el día y
       los días de aviso;
     · simular que el pago ya está cargado y ver cómo se apaga la alerta.
*/

/* ============================================================ datos */

const MES_NOMBRES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Los 18 meses del ejemplo, del más viejo al más nuevo. El último
    (noviembre 2026) es el mes abierto y va parcial. */
const MESES = [];
for (let i = 17; i >= 0; i -= 1) {
  const base = 2026 * 12 + 10 - i; // 10 = noviembre (índice 0 = enero)
  MESES.push({ anio: Math.floor(base / 12), mes: base % 12 });
}

const etiquetaMes = (m, largo = false) =>
  !m || m.mes === undefined
    ? "—"
    : largo
    ? `${MES_NOMBRES[m.mes][0].toUpperCase()}${MES_NOMBRES[m.mes].slice(1)} ${m.anio}`
    : `${MES_NOMBRES[m.mes].slice(0, 3)} ${String(m.anio).slice(2)}`;

/* Generador reproducible: el mockup tiene que verse igual cada vez que
   se abre, así que nada de Math.random(). */
function ruidoso(semilla) {
  let s = semilla;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

/** Una serie mensual que arranca en `base` y sube `inflacion` por mes,
    con una dispersión de `variacion`. `saltear` son índices sin dato. */
function serie(base, inflacion, variacion, semilla, saltear = []) {
  const r = ruidoso(semilla);
  return MESES.map((m, i) => {
    if (saltear.includes(i)) return { ...m, valor: null };
    const tendencia = base * (1 + inflacion) ** i;
    const valor = tendencia * (1 + (r() - 0.5) * 2 * variacion);
    return { ...m, valor: Math.round(valor / 500) * 500 };
  });
}

const ITEMS = [
  {
    id: "davinci",
    nombre: "Da Vinci",
    detalle: "Facultad",
    // Enero y febrero no se cursa: dos meses sin dato, a propósito.
    serie: serie(74000, 0.038, 0.01, 7, [7, 8]),
    venc: { activo: true, dia: 15, aviso: 5 },
    pagado: false,
  },
  {
    id: "alquiler",
    nombre: "Alquiler",
    detalle: "Vivienda",
    serie: serie(298000, 0.042, 0.004, 11),
    venc: { activo: true, dia: 10, aviso: 3 },
    pagado: false,
  },
  {
    id: "prepaga",
    nombre: "Prepaga",
    detalle: "Salud",
    serie: serie(74000, 0.04, 0.006, 23),
    venc: { activo: true, dia: 5, aviso: 2 },
    pagado: true, // ya hay un movimiento cargado este mes
  },
  {
    id: "luz",
    nombre: "Luz",
    detalle: "Servicios",
    serie: serie(31000, 0.035, 0.22, 31),
    venc: { activo: true, dia: 8, aviso: 3 },
    pagado: false,
  },
  {
    id: "internet",
    nombre: "Internet",
    detalle: "Servicios",
    serie: serie(27000, 0.036, 0.02, 41),
    venc: { activo: true, dia: 20, aviso: 4 },
    pagado: false,
  },
  {
    id: "super",
    nombre: "Supermercado",
    detalle: "Hogar",
    serie: serie(186000, 0.035, 0.16, 53),
    venc: { activo: false, dia: 1, aviso: 3 },
    pagado: false,
  },
  {
    id: "nafta",
    nombre: "Nafta",
    detalle: "Transporte",
    serie: serie(62000, 0.037, 0.19, 67),
    venc: { activo: false, dia: 1, aviso: 3 },
    pagado: false,
  },
  {
    id: "gimnasio",
    nombre: "Gimnasio",
    detalle: "Salud",
    serie: serie(29000, 0.03, 0.03, 83),
    venc: { activo: false, dia: 1, aviso: 3 },
    pagado: false,
  },
];

/* Estado del mockup */
const estado = {
  item: "davinci",
  rango: 6,
  hoy: 7, // día simulado de noviembre
  filtro: "todos",
  seleccion: null,
  barra: "seis",
  nombreSeccion: "Vencimientos",
  nombreCorto: "Vencim.",
  vista: "inicio",
  abierta: false, // la tarjeta de comparación arranca plegada
};

/* ========================================================== formato */

const esc = (t) =>
  String(t ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

const pesos = (v) =>
  v === null || v === undefined
    ? "—"
    : `$${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(v)}`;

function fmtK(v) {
  const n = Math.abs(v);
  if (n >= 1_000_000) return `$${(v / 1_000_000).toFixed(1).replace(".", ",")} M`;
  if (n >= 1000) return `$${Math.round(v / 1000)} k`;
  return pesos(v);
}

const porcentaje = (v) =>
  `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1).replace(".", ",")}%`;

const $ = (id) => document.getElementById(id);

/* ================================================= el conmutador */
/* Versión mínima de `components/switch.js`: una sola pastilla que se
   desliza. Está copiado a propósito — el mockup no importa módulos de
   la app. */
function prepararSwitches() {
  document.querySelectorAll(".view-switch").forEach((grupo) => {
    if (grupo.querySelector(".vs-ind")) return;
    const ind = document.createElement("span");
    ind.className = "vs-ind";
    ind.setAttribute("aria-hidden", "true");
    grupo.prepend(ind);
    if (typeof ResizeObserver === "function") {
      new ResizeObserver(() => moverPastilla(grupo, false)).observe(grupo);
    }
  });
}

function moverPastilla(grupo, animar = true) {
  const ind = grupo.querySelector(".vs-ind");
  const activo = grupo.querySelector("button.activa") ?? grupo.querySelector("button");
  if (!ind || !activo || !activo.offsetWidth) return;
  if (!animar) ind.classList.add("vs-ind--quieto");
  void ind.offsetWidth;
  ind.style.width = `${activo.offsetWidth}px`;
  ind.style.transform = `translateX(${activo.offsetLeft}px)`;
  grupo.setAttribute("data-listo", "1");
  if (!animar) {
    void ind.offsetWidth;
    ind.classList.remove("vs-ind--quieto");
  }
}

document.addEventListener("click", (ev) => {
  const boton = ev.target.closest?.(".view-switch button");
  if (!boton) return;
  const grupo = boton.closest(".view-switch");
  grupo.querySelectorAll("button").forEach((b) => {
    b.classList.toggle("activa", b === boton);
    b.setAttribute("aria-pressed", String(b === boton));
  });
  moverPastilla(grupo);
});

/* =================================================== navegación */

function secciones() {
  const base = [
    { id: "inicio", label: "Inicio", corta: "Inicio", icono: '<path d="M3 10.5L12 3l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/><path d="M9.5 20v-5.5h5V20"/>' },
    { id: "movimientos", label: "Movimientos", corta: "Movim.", icono: '<path d="M4 7h11M4 7l3-3M4 7l3 3"/><path d="M20 17H9M20 17l-3-3M20 17l-3 3"/>' },
    { id: "historial", label: "Historial", corta: "Historial", icono: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>' },
    {
      id: "vencimientos",
      label: estado.nombreSeccion,
      corta: estado.nombreCorto,
      // Calendario con un signo de atención: no es la campana de la
      // barra superior, que es "lo que ya pasó".
      icono: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M8 3.5v3M16 3.5v3M3.5 10h17"/><path d="M12 13v3"/><circle cx="12" cy="17.6" r=".9"/>',
    },
    { id: "inversiones", label: "Cartera", corta: "Cartera", icono: '<path d="M3 17l5-6 4 3.5L21 6"/><path d="M15.5 6H21v5.5"/>' },
  ];
  return estado.barra === "cinco" ? base.filter((s) => s.id !== "inversiones") : base;
}

function pintarNavegacion() {
  const barra = $("barra-inferior");
  const escritorio = $("nav-escritorio");
  const lista = secciones();

  barra.innerHTML =
    lista
      .map(
        (s) =>
          `<button type="button" data-ir="${s.id}" aria-label="${esc(s.label)}"` +
          `${estado.vista === s.id ? ' class="activa" aria-current="page"' : ""}>` +
          `<svg viewBox="0 0 24 24" aria-hidden="true">${s.icono}</svg>` +
          `<span>${esc(s.corta)}</span></button>`,
      )
      .join("") +
    '<button type="button" data-hoja="mas" aria-label="Más secciones">' +
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/>' +
    '<circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>' +
    "<span>Más</span></button>";

  escritorio.innerHTML = lista
    .map(
      (s) =>
        `<button type="button" data-ir="${s.id}"${estado.vista === s.id ? ' class="activa" aria-current="page"' : ""}>` +
        `${esc(s.label)}</button>`,
    )
    .join("");
}

function navegar(id) {
  estado.vista = id;
  document.querySelectorAll(".view").forEach((v) => {
    const activa = v.dataset.vista === id;
    v.classList.toggle("activa", activa);
    v.hidden = !activa;
  });
  window.scrollTo({ top: 0, behavior: "instant" });
  pintarNavegacion();
  prepararSwitches();
  requestAnimationFrame(() => document.querySelectorAll(".view-switch").forEach((g) => moverPastilla(g, false)));
}

document.addEventListener("click", (ev) => {
  const boton = ev.target.closest?.("[data-ir]");
  if (boton) navegar(boton.dataset.ir);
});

/* ============================================== COMPARACIÓN POR ÍTEM */

function itemActual() {
  return ITEMS.find((i) => i.id === estado.item) ?? ITEMS[0];
}

/** Los meses del rango elegido que tienen dato. El mes abierto va
    siempre, marcado como parcial. */
function datosComparacion() {
  const item = itemActual();
  const n = estado.rango || item.serie.length;
  const recorte = item.serie.slice(Math.max(0, item.serie.length - n));
  return recorte.map((m, i) => ({
    ...m,
    parcial: i === recorte.length - 1,
    // El mes abierto va por la mitad: es lo que lleva gastado hasta hoy.
    valor: m.valor === null ? null : i === recorte.length - 1 ? Math.round((m.valor * estado.hoy) / 30 / 500) * 500 : m.valor,
  }));
}

function escalaRedonda(valor) {
  if (!Number.isFinite(valor) || valor <= 0) return 1;
  const potencia = 10 ** Math.floor(Math.log10(valor));
  const n = valor / potencia;
  return ([1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((p) => n <= p) ?? 10) * potencia;
}

/* El `viewBox` es angosto a propósito (540, no 760 como el gráfico de
   los seis meses): así el dibujo se escala menos en el teléfono y las
   cifras se leen del tamaño en que se escriben. Y el ancho de cada mes
   tiene TOPE —`SLOT_MAX`—, con el grupo centrado: con pocos meses las
   barras quedaban muy separadas entre sí (Gustavo, 2026-11-10). */
function graficoComparacion(datos) {
  const SLOT_MAX = 68;
  /* Hasta siete meses el gráfico ENTRA en la pantalla: el `viewBox`
     mide casi lo que mide la tarjeta, así que la letra se ve del
     tamaño en que se escribe y no hay que arrastrar nada de lado. Con
     más meses, el dibujo crece y la tarjeta desplaza —como el gráfico
     diario—, pero a escala 1: así las cifras siguen legibles en vez de
     achicarse hasta desaparecer. */
  const cabe = datos.length <= 7;
  const ANCHO = cabe ? 400 : 56 * datos.length + 62;
  const ALTO = 238, PL = 50, PR = 12, PT = 26, PB = 28;
  const iw = ANCHO - PL - PR;
  const ih = ALTO - PT - PB;

  const conDato = datos.filter((d) => d.valor !== null);
  const maximo = escalaRedonda(Math.max(...conDato.map((d) => d.valor)));
  const promedio = conDato.reduce((a, d) => a + d.valor, 0) / conDato.length;
  const yDe = (v) => PT + ih - (ih * v) / maximo;

  const slot = Math.min(iw / datos.length, SLOT_MAX);
  const grupo = slot * datos.length;
  const inicioX = PL + (iw - grupo) / 2; // centrado: lo que sobra es margen, no distancia
  const ancho = Math.max(9, Math.min(44, slot * 0.68));

  let svg =
    `<svg viewBox="0 0 ${ANCHO} ${ALTO}" role="img" aria-label="Gasto mensual del ítem" ` +
    `style="min-width:${cabe ? 0 : `${ANCHO}px`}">`;

  // grilla y eje de valores
  for (let i = 0; i <= 4; i += 1) {
    const v = (maximo / 4) * i;
    const y = yDe(v);
    svg += `<line class="gridline" x1="${PL}" y1="${y}" x2="${PL + iw}" y2="${y}"/>`;
    svg += `<text class="comp-eje" x="${PL - 7}" y="${y + 4}" text-anchor="end">${fmtK(v)}</text>`;
  }

  // barras
  datos.forEach((d, i) => {
    const cx = inicioX + slot * i + slot / 2;
    const x = cx - ancho / 2;
    if (d.valor === null) {
      svg += `<text class="comp-mes" x="${cx}" y="${PT + ih - 8}" text-anchor="middle">sin dato</text>`;
    } else {
      const y = yDe(d.valor);
      const alto = Math.max(2, PT + ih - y);
      const elegido = estado.seleccion === i;
      const color = d.parcial ? "var(--color-ink-4)" : "var(--color-egr)";
      svg +=
        `<rect class="bar" data-i="${i}" x="${x}" y="${y}" width="${ancho}" height="${alto}" rx="4"` +
        ` fill="${color}" opacity="${elegido ? 1 : d.parcial ? 0.55 : 0.88}" style="cursor:pointer"/>`;
      if (datos.length <= 7) {
        svg += `<text class="comp-valor" x="${cx}" y="${y - 8}" text-anchor="middle">${fmtK(d.valor)}</text>`;
      }
    }
    const saltea = datos.length > 9 && i % 2 === 1;
    if (!saltea) {
      svg += `<text class="comp-mes" x="${cx}" y="${PT + ih + 18}" text-anchor="middle">${esc(etiquetaMes(d))}</text>`;
    }
  });

  // línea del promedio
  const yp = yDe(promedio);
  svg +=
    `<line x1="${PL}" y1="${yp}" x2="${PL + iw}" y2="${yp}" stroke="var(--color-accent)"` +
    ' stroke-width="1.6" stroke-dasharray="5 4"/>';
  svg += `<text class="comp-eje" x="${PL + iw}" y="${yp - 7}" text-anchor="end">prom. ${fmtK(promedio)}</text>`;

  return svg + "</svg>";
}

function pieComparacion(datos) {
  const conDato = datos.filter((d) => d.valor !== null);
  const cerrados = conDato.filter((d) => !d.parcial);
  const promedio = cerrados.length ? cerrados.reduce((a, d) => a + d.valor, 0) / cerrados.length : 0;
  const maximo = cerrados.length ? Math.max(...cerrados.map((d) => d.valor)) : 0;
  const minimo = cerrados.length ? Math.min(...cerrados.map((d) => d.valor)) : 0;
  const ultimo = cerrados.at(-1)?.valor ?? 0;
  const mesMax = cerrados.find((d) => d.valor === maximo);
  const mesMin = cerrados.find((d) => d.valor === minimo);

  /* Las dos últimas celdas comparan UN mes contra el anterior, no todo
     el período (Gustavo, 2026-11-10): cuánto más o menos se pagó este
     mes contra el pasado, en pesos y en porcentaje. Los dos meses son
     los dos últimos con dato; si el último es el mes abierto, el pie
     lo aclara, porque todavía es parcial. */
  const ultimosDos = conDato.slice(-2);
  const [previo, actual] = ultimosDos.length === 2 ? ultimosDos : [null, conDato.at(-1) ?? null];
  const difPesos = previo && actual ? actual.valor - previo.valor : null;
  const difPorc = previo && actual && previo.valor ? (difPesos / previo.valor) * 100 : null;
  const parDeMeses =
    previo && actual
      ? `${etiquetaMes(actual, true)} vs ${etiquetaMes(previo, true)}${actual.parcial ? " · parcial" : ""}`
      : "hace falta un mes más";

  const celda = (etiqueta, cifra, pie = "", color = "") =>
    `<div class="mini cg"><span>${esc(etiqueta)}</span>` +
    `<b class="num"${color ? ` style="color:${color}"` : ""}>${esc(cifra)}</b>` +
    (pie ? `<span style="text-transform:none;letter-spacing:0">${esc(pie)}</span>` : "") +
    "</div>";

  /* El color de la diferencia mezcla con la tinta, como los importes de
     las filas: el rojo y el verde puros sobre vidrio no llegan al
     contraste mínimo. */
  const tinte =
    difPesos === null
      ? ""
      : difPesos > 0
        ? "color-mix(in srgb, var(--color-egr) 72%, var(--color-ink))"
        : difPesos < 0
          ? "color-mix(in srgb, var(--color-inc) 72%, var(--color-ink))"
          : "";

  return [
    celda("Promedio", pesos(Math.round(promedio)), `${cerrados.length} meses cerrados`),
    celda("Último cerrado", pesos(ultimo), etiquetaMes(cerrados.at(-1), true)),
    celda("Más caro", pesos(maximo), mesMax ? etiquetaMes(mesMax, true) : ""),
    celda("Más barato", pesos(minimo), mesMin ? etiquetaMes(mesMin, true) : ""),
    celda(
      "Diferencia en pesos",
      difPesos === null ? "—" : `${difPesos > 0 ? "+" : difPesos < 0 ? "−" : ""}${pesos(Math.abs(difPesos))}`,
      parDeMeses,
      tinte,
    ),
    celda("Variación", difPorc === null ? "—" : porcentaje(difPorc), parDeMeses, tinte),
  ].join("");
}

function filasComparacion(datos) {
  return datos
    .slice()
    .reverse()
    .map((d, idx, arr) => {
      const anterior = arr[idx + 1];
      if (d.valor === null) {
        return (
          '<div class="row cg" style="--c:var(--color-ink-4)">' +
          '<span class="row-ico" aria-hidden="true">—</span>' +
          `<span class="row-main"><b>${esc(etiquetaMes(d, true))}</b>` +
          "<span>Sin movimientos de este ítem</span></span>" +
          '<span class="row-val"><b class="num">—</b></span></div>'
        );
      }
      const delta =
        anterior && anterior.valor !== null ? ((d.valor - anterior.valor) / anterior.valor) * 100 : null;
      const tipoPill = delta === null ? "neutral" : delta > 0.5 ? "crit" : delta < -0.5 ? "ok" : "neutral";
      const detalle = d.parcial
        ? `Mes en curso · al día ${estado.hoy}`
        : delta === null
          ? "Primer mes del rango"
          : `${porcentaje(delta)} contra ${etiquetaMes(anterior, true)}`;
      return (
        `<div class="row cg" style="--c:var(--color-egr)">` +
        `<span class="row-ico" aria-hidden="true">${esc(etiquetaMes(d).slice(0, 2).toUpperCase())}</span>` +
        `<span class="row-main"><b>${esc(etiquetaMes(d, true))}</b><span>${esc(detalle)}</span></span>` +
        '<span class="row-val">' +
        `<b class="num amt-out">${esc(pesos(d.valor))}</b>` +
        (delta === null ? "" : `<span><span class="pill ${tipoPill}">${porcentaje(delta)}</span></span>`) +
        "</span></div>"
      );
    })
    .join("");
}

/* La tarjeta arranca plegada y nada de adentro se dibuja hasta que se
   prende el interruptor: la comparación es una consulta puntual, no
   algo que tenga que estar abierto todo el tiempo (Gustavo,
   2026-11-10). */
function pintarPliegue() {
  const abierta = estado.abierta;
  const sw = $("comp-switch");
  sw.setAttribute("aria-checked", String(abierta));
  sw.setAttribute(
    "aria-label",
    abierta ? "Ocultar la comparación por ítem" : "Mostrar la comparación por ítem",
  );
  for (const id of ["comp-cuerpo", "comp-card-filas", "comp-nota"]) $(id).hidden = !abierta;
}

function pintarComparacion() {
  if (!estado.abierta) return;
  const sel = $("comp-item");
  if (!sel.options.length) {
    sel.innerHTML = ITEMS.map(
      (i) => `<option value="${i.id}">${esc(i.nombre)} · ${esc(i.detalle)}</option>`,
    ).join("");
    sel.value = estado.item;
  }

  const datos = datosComparacion();
  $("comp-grafico").innerHTML = graficoComparacion(datos);
  $("comp-pie").innerHTML = pieComparacion(datos);
  $("comp-filas").innerHTML = filasComparacion(datos);

  const caja = $("comp-seleccion");
  const d = estado.seleccion === null ? null : datos[estado.seleccion];
  if (!d || d.valor === null) {
    caja.hidden = true;
  } else {
    const anterior = datos[estado.seleccion - 1];
    const delta =
      anterior && anterior.valor !== null ? ((d.valor - anterior.valor) / anterior.valor) * 100 : null;
    caja.hidden = false;
    caja.innerHTML =
      `<b class="num">${esc(etiquetaMes(d, true))} · ${esc(pesos(d.valor))}</b>` +
      `<span>${d.parcial ? "mes en curso, parcial" : delta === null ? "primer mes del rango" : `${porcentaje(delta)} contra ${etiquetaMes(anterior, true)}`}</span>`;
  }
}

$("comp-switch").addEventListener("click", () => {
  estado.abierta = !estado.abierta;
  pintarPliegue();
  pintarComparacion();
  // Los conmutadores de adentro se miden recién cuando son visibles:
  // un grupo oculto mide 0 y la pastilla quedaría apoyada en el borde.
  requestAnimationFrame(() => {
    prepararSwitches();
    document.querySelectorAll(".view-switch").forEach((g) => moverPastilla(g, false));
  });
});

$("comp-item").addEventListener("change", (ev) => {
  estado.item = ev.target.value;
  estado.seleccion = null;
  pintarComparacion();
});

$("comp-rango").addEventListener("click", (ev) => {
  const b = ev.target.closest("button");
  if (!b) return;
  estado.rango = Number(b.dataset.rango);
  estado.seleccion = null;
  pintarComparacion();
});

$("comp-grafico").addEventListener("click", (ev) => {
  const barra = ev.target.closest("[data-i]");
  if (!barra) return;
  const i = Number(barra.dataset.i);
  estado.seleccion = estado.seleccion === i ? null : i;
  pintarComparacion();
});

/* ==================================================== VENCIMIENTOS */

const ICO = {
  tilde: '<path d="M4.5 12.5l5 5 10-11"/>',
  aviso: '<path d="M12 3.8L2.6 20.2h18.8L12 3.8z"/><path d="M12 10v4.2"/><circle cx="12" cy="17.4" r="1"/>',
  reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.3l3.4 2"/>',
};

/** El estado de un ítem contra el día simulado. Devuelve null si el
    ítem no tiene vencimiento habilitado. */
function estadoVencimiento(item) {
  if (!item.venc.activo) return null;
  const dias = item.venc.dia - estado.hoy;

  if (item.pagado) {
    return {
      clave: "pagado",
      severidad: "ok",
      icono: "tilde",
      pill: "ok",
      titulo: "Pagado",
      texto: `Ya hay un movimiento de ${item.nombre} cargado este mes. No avisa hasta el mes que viene.`,
      corto: "Pagado",
      orden: 5,
      alerta: false,
    };
  }
  if (dias < 0) {
    return {
      clave: "vencido",
      severidad: "crit",
      icono: "aviso",
      pill: "crit",
      titulo: `${item.nombre} está vencido`,
      texto: `Venció el ${item.venc.dia} de noviembre, hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? "" : "s"}, y no figura pagado.`,
      corto: `Vencido hace ${Math.abs(dias)} d`,
      orden: 0,
      alerta: true,
    };
  }
  if (dias === 0) {
    return {
      clave: "hoy",
      severidad: "crit",
      icono: "aviso",
      pill: "crit",
      titulo: `${item.nombre} vence hoy`,
      texto: `Hoy es ${item.venc.dia} de noviembre. Todavía no figura pagado.`,
      corto: "Vence hoy",
      orden: 1,
      alerta: true,
    };
  }
  if (dias === 1) {
    return {
      clave: "critico",
      severidad: "crit",
      icono: "aviso",
      pill: "crit",
      titulo: `${item.nombre} vence mañana`,
      texto: `Falta 1 día: vence el ${item.venc.dia} de noviembre.`,
      corto: "Falta 1 día",
      orden: 2,
      alerta: true,
    };
  }
  if (dias <= item.venc.aviso) {
    return {
      clave: "aviso",
      severidad: "warn",
      icono: "reloj",
      pill: "warn",
      titulo: `Faltan ${dias} días para ${item.nombre}`,
      texto: `Vence el ${item.venc.dia} de noviembre. Pediste aviso ${item.venc.aviso} días antes.`,
      corto: `Faltan ${dias} días`,
      orden: 3,
      alerta: true,
    };
  }
  return {
    clave: "programado",
    severidad: "info",
    icono: "reloj",
    pill: "neutral",
    titulo: `${item.nombre} vence el ${item.venc.dia}`,
    texto: `Faltan ${dias} días. Te va a avisar ${item.venc.aviso} días antes.`,
    corto: `En ${dias} días`,
    orden: 4,
    alerta: false,
  };
}

function alertasActivas() {
  return ITEMS.map((i) => ({ item: i, est: estadoVencimiento(i) }))
    .filter((x) => x.est && x.est.alerta)
    .sort((a, b) => a.est.orden - b.est.orden || a.item.venc.dia - b.item.venc.dia);
}

function tarjetaAlerta({ item, est }) {
  const clase = { ok: "a-ok", warn: "a-warn", crit: "a-crit", info: "a-info" }[est.severidad];
  const nombreSev = { ok: "Todo en orden", warn: "Atención", crit: "Crítico", info: "Información" }[est.severidad];
  return (
    `<div class="alert cg ${clase}" role="note" style="margin-bottom:10px">` +
    `<span class="alert-ico" role="img" aria-label="${nombreSev}">` +
    `<svg viewBox="0 0 24 24" aria-hidden="true">${ICO[est.icono]}</svg></span>` +
    `<div><b>${esc(est.titulo)}</b><p>${esc(est.texto)} Estimado: ${esc(pesos(item.serie.at(-1).valor))}.</p></div>` +
    "</div>"
  );
}

function pintarAlertas() {
  const activas = alertasActivas();

  const contador = $("contador-alertas");
  contador.textContent = String(activas.length);
  contador.hidden = activas.length === 0;
  $("btn-campana").setAttribute("aria-label", `Alertas: ${activas.length}`);

  const vacio =
    '<p class="ghost-note" style="margin:0">Nada por vencer en los próximos días. Lo que ya cargaste como pagado no cuenta.</p>';

  $("inicio-alertas").innerHTML = activas.length ? activas.map(tarjetaAlerta).join("") : vacio;

  const caja = $("venc-alertas");
  caja.innerHTML = activas.length
    ? `<div style="margin-bottom:14px">${activas.map(tarjetaAlerta).join("")}</div>`
    : "";
}

function filaVencimiento(item) {
  const est = estadoVencimiento(item);
  const dias = [...Array(31).keys()].map((d) => d + 1);
  const avisos = [1, 2, 3, 5, 7, 10];

  const pill = est
    ? `<span class="pill ${est.pill}">${esc(est.corto)}</span>`
    : '<span class="pill neutral">Sin vencimiento</span>';

  const detalle = item.venc.activo
    ? '<div class="venc-detalle">' +
      `<div class="campo"><label for="dia-${item.id}">Día de vencimiento</label>` +
      `<select class="inp" id="dia-${item.id}" data-dia="${item.id}">` +
      dias.map((d) => `<option value="${d}"${d === item.venc.dia ? " selected" : ""}>${d}</option>`).join("") +
      "</select></div>" +
      `<div class="campo"><label for="av-${item.id}">Avisame antes</label>` +
      `<select class="inp" id="av-${item.id}" data-aviso="${item.id}">` +
      avisos
        .map((d) => `<option value="${d}"${d === item.venc.aviso ? " selected" : ""}>${d} día${d === 1 ? "" : "s"}</option>`)
        .join("") +
      "</select></div>" +
      '<div class="ancho">' +
      `<span class="venc-estado">${pill}` +
      `<span style="font-size:var(--text-sub);color:var(--color-ink-3)">Estimado ${esc(pesos(item.serie.at(-1).valor))} · promedio de los últimos meses</span></span>` +
      `<button class="chip${item.pagado ? "" : " solid"}" type="button" data-pago="${item.id}">` +
      `${item.pagado ? "Deshacer el pago" : "Simular que lo pagué"}</button>` +
      "</div></div>"
    : "";

  return (
    `<div class="venc-item cg">` +
    '<div class="cfg-row">' +
    `<div><b>${esc(item.nombre)}</b><span>${esc(item.detalle)}${item.venc.activo ? ` · vence el ${item.venc.dia} · aviso ${item.venc.aviso} día${item.venc.aviso === 1 ? "" : "s"} antes` : " · no hace falta avisar"}</span></div>` +
    `<button class="toggle" type="button" role="switch" aria-checked="${item.venc.activo}" ` +
    `aria-label="Vencimiento de ${esc(item.nombre)}" data-toggle="${item.id}"></button>` +
    "</div>" +
    detalle +
    "</div>"
  );
}

function pintarVencimientos() {
  const lista = ITEMS.filter((i) => estado.filtro === "todos" || i.venc.activo);
  $("venc-lista").innerHTML = lista.map(filaVencimiento).join("");
}

$("venc-lista").addEventListener("click", (ev) => {
  const t = ev.target.closest("[data-toggle]");
  if (t) {
    const item = ITEMS.find((i) => i.id === t.dataset.toggle);
    item.venc.activo = !item.venc.activo;
    if (!item.venc.activo) item.pagado = false;
    pintarVencimientos();
    pintarAlertas();
    return;
  }
  const p = ev.target.closest("[data-pago]");
  if (p) {
    const item = ITEMS.find((i) => i.id === p.dataset.pago);
    item.pagado = !item.pagado;
    pintarVencimientos();
    pintarAlertas();
  }
});

$("venc-lista").addEventListener("change", (ev) => {
  const d = ev.target.closest("[data-dia]");
  if (d) {
    ITEMS.find((i) => i.id === d.dataset.dia).venc.dia = Number(d.value);
  }
  const a = ev.target.closest("[data-aviso]");
  if (a) {
    ITEMS.find((i) => i.id === a.dataset.aviso).venc.aviso = Number(a.value);
  }
  if (d || a) {
    pintarVencimientos();
    pintarAlertas();
  }
});

$("venc-filtro").addEventListener("click", (ev) => {
  const b = ev.target.closest("button");
  if (!b) return;
  estado.filtro = b.dataset.filtro;
  pintarVencimientos();
});

$("venc-nombre").addEventListener("click", (ev) => {
  const b = ev.target.closest("button");
  if (!b) return;
  estado.nombreSeccion = b.dataset.nombre;
  estado.nombreCorto = b.dataset.corta;
  $("venc-titulo").textContent = b.dataset.nombre;
  pintarNavegacion();
});

$("venc-barra").addEventListener("click", (ev) => {
  const b = ev.target.closest("button");
  if (!b) return;
  estado.barra = b.dataset.barra;
  pintarNavegacion();
});

/* ======================================================= ensayo */

$("dia-hoy").addEventListener("input", (ev) => {
  estado.hoy = Number(ev.target.value);
  $("dia-hoy-txt").textContent = `${estado.hoy} de noviembre`;
  pintarAlertas();
  pintarVencimientos();
  pintarComparacion();
});

$("btn-tema").addEventListener("click", () => {
  const actual = document.documentElement.getAttribute("data-theme");
  const oscuro = actual
    ? actual === "dark"
    : window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.setAttribute("data-theme", oscuro ? "light" : "dark");
});

$("btn-campana").addEventListener("click", () => navegar("vencimientos"));

/* ======================================================= arranque */

pintarNavegacion();
prepararSwitches();
pintarPliegue();
pintarComparacion();
pintarVencimientos();
pintarAlertas();
requestAnimationFrame(() => document.querySelectorAll(".view-switch").forEach((g) => moverPastilla(g, false)));
