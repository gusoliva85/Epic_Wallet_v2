---
name: epic-wallet-ui
description: Sistema de diseño "Vidrio Grafito" de Epic Wallet 2.0 — tokens, las dos capas de vidrio, escala tipográfica, componentes y gráficos SVG. Cargar SIEMPRE antes de escribir o modificar cualquier HTML, CSS o JavaScript de interfaz del proyecto, antes de crear un componente o una pantalla nueva, y antes de tocar un gráfico. Es la referencia normativa del frontend aprobado.
---

# Epic Wallet 2.0 · Sistema de diseño "Vidrio Grafito"

**Referencia viva:** `documentacion/mockups/01_Mockup_V1_Grafito_Clasico.html` — mockup aprobado y funcional. Ante cualquier duda, ese archivo manda.
**Documento normativo:** `documentacion/02_Documento_Tecnico.md` §13 y §14.

## Reglas que no se negocian

1. **Ningún valor de color, sombra o radio se escribe fuera de los tokens.** Si hace falta uno nuevo, se agrega al bloque `:root` y a `html[data-theme="dark"]`, nunca suelto en un componente.
2. **Mobile-first de verdad.** Se escribe el CSS de teléfono (390 px) y se agrega lo demás con `min-width`. Nunca al revés.
3. **Sin neón, sin saturaciones altas.** El color significa (ingreso, egreso, ahorro, severidad), no decora.
4. **El gráfico nunca reemplaza los números.** Todo panel con gráfico lleva su pie de cifras.
5. **Todo dato del servidor pasa por `esc()`** antes de entrar en una plantilla.
6. **`prefers-reduced-motion` anula todas las animaciones.** Obligatorio.
7. **Sin framework de UI** y sin librería de gráficos: HTML, CSS (Tailwind + tokens) y JavaScript nativo.
8. Los textos de interfaz van en **español rioplatense** ("cargá", "tocá", "seguís").
9. **La aplicación es multiusuario.** Nunca se escribe un nombre de usuario en el código ni en una plantilla: siempre sale del perfil de la sesión. El saludo del dashboard usa el nombre visible de la cuenta.

## Identidad

Vidrio sobre grafito. Superficies translúcidas con desenfoque y un brillo diagonal, sobre un fondo de lavados radiales fríos y cálidos, con una capa de ruido muy sutil que evita el aspecto plástico.

## 1 · Tokens

Van en `web/src/styles/tokens.css` y se registran en Tailwind con `@theme`.

```css
:root{
  /* fondo y lavados */
  --bg-1:#eff2f5; --bg-2:#e6ecef; --wash-a:#d1dfe8; --wash-b:#ebe4d3;

  /* tinta: 4 niveles de jerarquía */
  --ink:#1c2024;    /* títulos y cifras */
  --ink-2:#4b5157;  /* texto normal */
  --ink-3:#70757c;  /* secundario y etiquetas */
  --ink-4:#8f9398;  /* deshabilitado y ejes */

  /* líneas */
  --line:rgba(28,32,36,.10); --line-2:rgba(28,32,36,.07); --line-strong:rgba(28,32,36,.16);

  /* vidrio */
  --glass-shell-bg:rgba(255,255,255,.52); --glass-shell-blur:22px;
  --glass-shell-fallback:rgba(255,255,255,.92);
  --glass-content-bg:rgba(255,255,255,.68); --glass-content-blur:7px;
  --glass-content-fallback:rgba(255,255,255,.94);
  --glass-in:inset 0 1px 0 rgba(255,255,255,.85),inset 0 0 0 1px rgba(255,255,255,.45);
  --glass-sheen:linear-gradient(120deg,rgba(255,255,255,.55),transparent 45%);

  /* acento: azul grafito */
  --navy:#11181f;
  --accent:#47799c; --accent-2:#335c78; --accent-soft:#dfeaf0; --accent-ring:rgba(71,121,156,.28);

  /* avatar de la cuenta: grafito neutro, lo único de la barra que no es acento */
  --avatar-1:#5c6469; --avatar-2:#33383c;

  /* surco hundido: conmutador de pestañas y de vistas */
  --groove-bg:rgba(20,22,25,.06); --groove-in:inset 0 1px 3px rgba(0,0,0,.08);

  /* velo del fondo con una hoja abierta. El transparente NUNCA es transparent:
     Chrome lo interpola pasando por negro y parpadea al abrir */
  --scrim-0:rgba(10,12,14,0); --scrim:rgba(10,12,14,.34);

  /* semántica financiera */
  --inc:#26886a;  /* ingresos */
  --egr:#bc313e;  /* egresos  */
  --sav:#47799c;  /* ahorro   */

  /* severidad de alertas */
  --ok:#26886a; --warn:#c08e19; --pend:#c56b24; --crit:#bc313e;

  /* mezclas y sombras */
  --mix-tint:#fff; --mix-ink:#1c2024;
  --shadow-rgb:20,22,25;
  --sh-sm:0 1px 2px rgba(var(--shadow-rgb),.06),0 4px 12px -4px rgba(var(--shadow-rgb),.12);
  --sh-md:0 2px 6px rgba(var(--shadow-rgb),.07),0 16px 34px -16px rgba(var(--shadow-rgb),.22);
  --sh-lg:0 4px 16px rgba(var(--shadow-rgb),.09),0 34px 70px -26px rgba(var(--shadow-rgb),.32);

  /* radios y curva */
  --r-btn:13px;   /* botones de icono, avatar, sello de la marca */
  --r-nav:14px; --r-fab:19px; --r-bar:22px; --r-sheet:26px;
  --r-sm:12px; --r-card:20px; --r-lg:24px;
  --ease:cubic-bezier(.32,.72,0,1);
}
html[data-theme="dark"]{
  --bg-1:#0a0d10; --bg-2:#0c1014; --wash-a:#17272e; --wash-b:#262114;
  --ink:#eef0f1; --ink-2:#bcc0c4; --ink-3:#868b91; --ink-4:#5c6166;
  --line:rgba(238,240,241,.10); --line-2:rgba(238,240,241,.06); --line-strong:rgba(238,240,241,.16);
  --glass-shell-bg:rgba(22,25,28,.5); --glass-shell-fallback:rgba(13,15,17,.94);
  --glass-content-bg:rgba(22,25,28,.72); --glass-content-fallback:rgba(13,15,17,.96);
  --glass-in:inset 0 1px 0 rgba(255,255,255,.07),inset 0 0 0 1px rgba(255,255,255,.05);
  --glass-sheen:linear-gradient(120deg,rgba(255,255,255,.07),transparent 45%);
  --navy:#040608;
  --accent:#72a6c6; --accent-2:#93c2dc; --accent-soft:#111f27; --accent-ring:rgba(114,166,198,.3);
  --avatar-1:#474f54; --avatar-2:#2a2e32;
  --groove-bg:rgba(0,0,0,.26); --groove-in:inset 0 1px 3px rgba(0,0,0,.45);
  --scrim-0:rgba(0,0,0,0); --scrim:rgba(0,0,0,.52);
  --inc:#3cb087; --egr:#d8596a; --sav:#72a6c6;
  --ok:#3cb087; --warn:#daa932; --pend:#dc8642; --crit:#d8596a;
  --mix-tint:#181b1e; --mix-ink:#f2f4f5;
  --shadow-rgb:0,0,0;
  --sh-sm:0 1px 2px rgba(0,0,0,.4),0 4px 14px -4px rgba(0,0,0,.5);
  --sh-md:0 2px 8px rgba(0,0,0,.35),0 18px 38px -16px rgba(0,0,0,.55);
  --sh-lg:0 4px 18px rgba(0,0,0,.4),0 40px 80px -28px rgba(0,0,0,.65);
}
```

**El tema oscuro redefine las mismas variables.** Ningún componente conoce el tema; sólo usa tokens. Cambiar de tema no toca una línea de componente.

`color-mix` con `--mix-tint` y `--mix-ink` es el truco que hace que píldoras, iconos y marcas funcionen en ambos temas con una sola regla:

```css
background:color-mix(in srgb,var(--c) 15%,var(--mix-tint));
color:color-mix(in srgb,var(--c) 80%,var(--mix-ink));
```

## 2 · Fondo y ruido

```css
body{
  background:
    radial-gradient(ellipse 52% 34% at 10% -6%,var(--wash-a),transparent 62%),
    radial-gradient(ellipse 42% 28% at 106% 6%,var(--wash-b),transparent 58%),
    radial-gradient(ellipse 38% 26% at 50% 104%,var(--wash-a),transparent 66%),
    linear-gradient(180deg,var(--bg-1),var(--bg-2));
  background-attachment:fixed;
}
/* capa de ruido: una sola, en SVG embebido, nunca una imagen */
body::before{
  content:"";position:fixed;inset:0;z-index:999;pointer-events:none;
  opacity:.035;mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
}
```

## 3 · Las dos capas de vidrio

Toda la profundidad sale de dos clases. **No se inventan variantes.**

| Clase | Uso | Desenfoque |
|---|---|---|
| `.shell` | Contenedores: topbar, tarjetas de KPI, paneles, hojas, navegación | 22 px + saturación 1,15 |
| `.cg` | Contenido dentro de un `.shell`: filas, fichas, campos | 7 px |

```css
.shell{position:relative;overflow:hidden;background:var(--glass-shell-bg);
  backdrop-filter:blur(var(--glass-shell-blur)) saturate(1.15);
  -webkit-backdrop-filter:blur(var(--glass-shell-blur)) saturate(1.15);
  border:1px solid var(--line);box-shadow:var(--glass-in),var(--sh-md)}
.shell::before{content:"";position:absolute;inset:0;background:var(--glass-sheen);pointer-events:none}

.cg{background:var(--glass-content-bg);
  backdrop-filter:blur(var(--glass-content-blur));-webkit-backdrop-filter:blur(var(--glass-content-blur));
  border:1px solid var(--line-2);box-shadow:var(--glass-in)}

/* DEGRADACIÓN OBLIGATORIA: sin esto el texto queda ilegible */
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){
  .shell{background:var(--glass-shell-fallback)}
  .cg{background:var(--glass-content-fallback)!important}
}
```

## 4 · Tipografía

`Outfit` para cifras y títulos (`letter-spacing:-.015em`), `Inter` para todo lo demás. Base **16,5 px / 1,55**. Las cifras llevan `font-variant-numeric:tabular-nums` **siempre**, para que no bailen al actualizarse.

| Rol | Fuente | Tamaño | Peso |
|---|---|---|---|
| Cifra héroe (ahorro del mes, patrimonio) | Outfit | 35 px | 700 |
| Cifra de KPI | Outfit | 27,5 px | 700 |
| Cifra de KPI secundario | Outfit | 23 px | 700 |
| Importe en formulario | Outfit | 33 px | 700 |
| Título de panel | Outfit | 20 px | 700 |
| Título de sección | Outfit | 19 px | 700 |
| Título de hoja | Outfit | 21,5 px | 700 |
| Cifra en ficha `.kv` | Outfit | 16,5 px | 700 |
| Importe en fila | Outfit | 16 px | 700 |
| Nombre en fila | Inter | 15,5 px | 600 |
| Botón | Inter | 15,5 px | 700 |
| Texto base | Inter | 16,5 px | 400 |
| Secundario de fila | Inter | 12 px | 400 |
| Subtítulo de KPI | Inter | 12 px | 400 |
| Etiqueta de KPI | Inter | 10,5 px | 700, mayúsculas, `letter-spacing:.05em` |
| Separador de día / subcabecera | Inter | 10,5 px | 700, mayúsculas, `letter-spacing:.07em` |
| Píldora | Inter | 11 px | 700 |
| Eje de gráfico (valores / días) | Inter | 10 / 9,5 px | 600 |

## 5 · Puntos de corte

| Corte | Ancho | Qué cambia |
|---|---|---|
| base | < 640 px | Una columna. KPI en 2 columnas. Barra inferior de 5. Botón `+` flotante. Detalle en hoja inferior. |
| `sm` | ≥ 640 px | KPI en 4 columnas. |
| `md` | ≥ 720 px | Cabeceras de panel en fila. Gráficos sin scroll horizontal. |
| `lg` | ≥ 960 px | Navegación superior en lugar de la inferior. Paneles en dos columnas. |
| `xl` | ≥ 1024 px | KPI en 6 columnas. Detalle como cajón lateral derecho. |

Áreas táctiles de **44 × 44 px** mínimo. `env(safe-area-inset-bottom)` respetado en navegación y botón flotante.

## 6 · Movimiento

| Gesto | Duración | Curva |
|---|---|---|
| Entrada de vista | 420 ms | `--ease` |
| Entrada de tarjetas (escalonada) | 500 ms, +60 ms por tarjeta | `--ease` |
| Hoja inferior y cajón | 380 ms | `--ease` |
| Hover de tarjeta y fila | 180–220 ms | `--ease` |
| Crecimiento de barras | 750 ms, +11 ms por barra | `--ease` |
| Trazado de líneas | 1400 ms (`stroke-dashoffset`) | `--ease` |
| Conteo de cifras | 900 ms | cúbica de salida |
| Cambio de tema | View Transitions API si existe | — |

```css
@media (prefers-reduced-motion:reduce){*{animation-duration:.01ms!important;transition-duration:.01ms!important}}
```

## 7 · Navegación y vistas

Una sola página con siete `<section class="view" data-vista="...">`. **`web/src/js/router.js` es el único que decide cuál está activa.**

```text
#/inicio  #/movimientos  #/historial  #/inversiones
#/patrimonio  #/analisis  #/config
```

Reglas:

- **Nadie lee la ruta del DOM ni del hash.** Se escucha el evento `epic:ruta` (`import { EVENTO } from "./router.js"`), que llega con `detail.id`. Así las barras no se ponen de acuerdo entre ellas sino cada una con el enrutador, y quedan bien también cuando se llega por «atrás» o por recarga.
- **Para ir a una sección se llama `navegar(id)`**, nunca se toca `location.hash` a mano. `navegar` valida: una ruta que no existe cae en inicio sin dejar entrada en el historial.
- **Las vistas inactivas llevan `hidden`,** que lo pone el enrutador. No alcanza una clase: sin `hidden`, el lector de pantalla lee las siete secciones seguidas y el tabulador recorre los botones de las que no se ven.
- **Hash, no rutas reales.** Con `/movimientos` el servidor tiene que devolver `index.html` en cada ruta o una recarga da 404; el hash ya da historial, «atrás» y enlaces que se pueden guardar.
- **Sólo `hashchange`.** Todas las entradas que crea el enrutador son de hash y el navegador emite `hashchange` tanto al cambiarlo como al recorrer el historial. Agregar `popstate` no cubre ningún caso más: es una línea que nunca se ejecuta sola.
- Al cambiar de vista **se vuelve arriba con `behavior: "instant"`.** Suave, un desplazamiento de miles de píxeles tarda segundos y parece que la aplicación se colgó.
- Una ruta inválida se corrige **reemplazando** la entrada (`replaceState`), no empujando otra: si no, «atrás» vuelve a la ruta mala y de ahí otra vez a inicio, un bucle del que no se sale.

**Las dos barras son navegación, no pestañas.** Marcan con `aria-current="page"`, nunca con `role="tab"` ni `aria-selected`: cambian la URL y el historial, y anunciarlas como un grupo de pestañas le miente a quien usa un lector sobre lo que va a pasar al activarlas.

El comportamiento del enrutador se prueba con jsdom en `tests/js/router.test.mjs` (`npm test`, y también desde `pytest`). Las pruebas que leen el código fuente no sirven acá: recargar en una ruta, volver con «atrás» y caer en inicio son comportamientos, no texto.

## 8 · Componentes

Funciones que reciben datos y devuelven HTML. Sin ciclo de vida, sin estado interno.

### Tarjeta de indicador

```javascript
// héroe: cifra grande + barra de progreso + pie de dos datos
`<article class="kpi kpi--hero shell">
  <div class="kpi-label">${esc(label)}</div>
  <div class="kpi-num" style="color:color-mix(in srgb,${color} 32%,var(--ink))">${value}</div>
  <div class="kpi-sub">${sub}</div>
  <div class="fin-track"><div class="fin-fill" data-w="${pct}"></div></div>
  <div class="fin-foot"><span>${left}</span><span>${right}</span></div>
</article>`

// métrica: etiqueta + icono + cifra + subtítulo
`<article class="kpi kpi-metric shell" style="--c:${color}">
  <div class="kpi-top">
    <div class="kpi-label">${esc(label)}</div>
    <span class="kpi-ico"><svg viewBox="0 0 24 24">${icon}</svg></span>
  </div>
  <div class="kpi-num num">${value}</div><div class="kpi-sub">${sub}</div>
</article>`
```

La barra se anima en el siguiente frame: `requestAnimationFrame(()=>el.style.width=el.dataset.w+'%')`.

### Filas de lista

`components/rows.js`. Dos filas y un separador, dentro de un contenedor `.rows`:

```javascript
filaMovimiento({ id, tipo, categoria, importe, fecha, descripcion, origen })
filaCategoria({ id, nombre, total, detalle, participacion, pie })
separadorDia("04 de octubre 2026")
pintarFilas(contenedor, [ ...filas ])   // escribe y arranca las barras
```

Rejilla de `34px 1fr auto`: marca, contenido, valor. **La fila es un `<button>`**, no un `div` con `onclick`: se abre para ver el detalle, así que tiene que alcanzarse con el tabulador y anunciarse.

**El signo lo decide `tipo`, nunca el valor del importe.** El importe llega ya formateado del backend y sin signo: el frontend sólo formatea y no hace aritmética. Si el signo saliera del texto, un importe que ya trajera un menos saldría con dos.

**Ingreso: `+`, verde y flecha hacia arriba. Egreso: `−`, rojo y flecha hacia abajo.** Los tres a la vez, porque el color no puede ser el único portador. El menos es **U+2212**, no el guión del teclado: el guión es más corto y a otra altura, y al lado de un `+` en una columna de cifras se nota.

Los importes mezclan su color con la tinta (`color-mix` contra `--mix-ink`) y no lo usan puro: el verde y el rojo puros sobre vidrio quedan por debajo del contraste mínimo.

La flecha y las iniciales van `aria-hidden`: la flecha repite el signo y las iniciales repiten el nombre de al lado — sin ocultarlas, el lector dice «AL Alquiler». La barra de participación también: el porcentaje ya está en el detalle.

**`.row-main` lleva `min-width: 0` y ellipsis.** Sin eso, el nombre largo de una categoría empuja el importe fuera de la fila.

#### El foco tiene que ganarle al hover

`:focus-visible` de `base.css` pone el halo con un selector de **menor especificidad** que `.row:hover`, que reemplaza `box-shadow` entero. Al pasar el dedo por una fila enfocada, el halo desaparecía. Por eso `.row:focus-visible` se declara aparte, con el halo **primero** dentro de su propia `box-shadow` — dibujado después de la sombra del vidrio, queda por debajo.

Esto vale para **cualquier componente que redefina `box-shadow` en `:hover`**: hay que repetir el halo en su propio `:focus-visible`.

#### Panel

`.panel` es la superficie que contiene una lista, y es mínima a propósito: la estructura final de cada vista, con cabeceras, conmutadores y pies de cifras, es de F01-T13.

### Pantallas de cuenta

Cuatro pantallas sin sesión, todas con la misma tarjeta de vidrio centrada (`.lock-card.shell`, máximo 372 px) sobre el fondo de lavados:

| Ruta | Pantalla | Campos |
|---|---|---|
| `#/login` | Iniciar sesión | correo, contraseña, enlaces a registro y recuperación |
| `#/registro` | Crear cuenta | correo, contraseña, repetir |
| `#/recuperar` | Olvidé mi contraseña | correo |
| `#/nueva-clave` | Contraseña nueva | contraseña, repetir |

Reglas de los campos de contraseña:

- **Botón de mostrar y ocultar siempre**, con `aria-label` que cambie entre "Mostrar contraseña" y "Ocultar contraseña". Escribir una contraseña a ciegas en un teléfono es la principal causa de errores de tipeo.
- `autocomplete` correcto para que el gestor del teléfono funcione: `current-password` en login, `new-password` en registro y en contraseña nueva.
- En registro y contraseña nueva se pide **repetir**, con validación en vivo de que coincidan.
- Medidor de fortaleza orientativo, nunca bloqueante más allá del mínimo de 8 caracteres.
- **Los mensajes de error nunca revelan si un correo tiene cuenta.** Ante un correo desconocido, la recuperación responde lo mismo que ante uno válido.

```javascript
// el patrón del campo con ojito
`<div class="field">
  <label for="${id}">${esc(label)}</label>
  <div class="pw-wrap">
    <input class="inp" id="${id}" type="password" autocomplete="${autocomplete}">
    <button class="pw-eye" type="button" aria-label="Mostrar contraseña">
      <svg viewBox="0 0 24 24">${ICO.eye}</svg>
    </button>
  </div>
</div>`
```

### Barra superior

`.topbar` es un `.shell` **pegajoso a 8 px del borde**, no a 0: el hueco deja ver el fondo por encima del vidrio y es lo que la hace leer como pieza flotante. Lleva `z-index` o el contenido le pasa por arriba al hacer scroll.

```text
.marca-app      sello + nombre · min-width:0 y ellipsis, o desborda en 320 px
.nav-escritorio pestañas, display:none hasta 960 px (abajo manda .botnav)
.acciones       alertas con .contador · [data-tema] · .avatar → configuración
```

El recuadro de `.boton-icono` y `.avatar` mide 37 px para no desarmar la proporción de la barra; el área táctil llega a los 44 px con un `::after` centrado e invisible. **Si se borra ese `::after`, el botón queda en 37 px** y se falla el toque en el teléfono.

El contador de alertas va `aria-hidden`: la cuenta ya está en el `aria-label` del botón ("Alertas: 4 sin leer"), y si no se oculta el lector la dice dos veces. Con cero alertas el globo se esconde con `[hidden]` — un cero rojo alarma sin motivo.

Las pestañas **se generan desde `SECCIONES` de `web/src/js/nav.js`**, nunca a mano en el HTML: la barra superior, la inferior y el enrutador leen de la misma lista y así no pueden discrepar. Son navegación, no un `tablist`: ver §7.0.

### Navegación del teléfono

`.botnav` es un `.shell` **fijo** abajo, con cinco posiciones en rejilla. Siete no entran: en 390 px darían 53 px cada una y las etiquetas no se leen, así que tres secciones se mudan a la hoja de «Más». El reparto lo decide `en_barra_inferior` en `web/src/js/nav.js`, nunca el HTML.

```text
bottom: calc(10px + env(safe-area-inset-bottom))   ← sin el inset, la fila
                                                     queda bajo la barra
                                                     de gestos y no se toca
min-height: 44px en cada posición                  ← skill §5
.botnav button.activa → color Y fondo              ← el color solo no alcanza
aria-current="page", no aria-selected              ← es navegación, no pestañas
```

La etiqueta usa `corta` ("Movim."), no `label`: con el nombre largo se recorta. Y lleva `nowrap`, porque partida en dos líneas desparejaría las cinco alturas.

`.fab` va abajo a la derecha, **encima** de la barra (`bottom: calc(84px + inset)`): es el alcance natural del pulgar. Desde 960 px la barra inferior desaparece —dos navegaciones serían dos posiciones activas que mantener de acuerdo— pero el botón de alta se queda y sólo baja de altura, porque cargar un movimiento es la acción principal en cualquier tamaño.

**El `.app` lleva 104 px de relleno abajo.** La barra es `fixed`: sin ese hueco tapa las últimas filas y nunca se llega al final de una lista.

### Hoja inferior

El componente completo es de F01-T11. Lo que una hoja necesita para no ser una trampa:

- **Tres formas de cerrar**: toque en el velo, Escape y botón. El listener de Escape va en `document`, no en la hoja: con el foco afuera la hoja no recibe la tecla.
- **`visibility: hidden` cuando está cerrada.** Correrla con `transform` no basta: el tabulador sigue entrando en sus botones invisibles y el foco desaparece de la pantalla. La visibilidad se demora lo que dura la transición (`visibility 0s linear .38s`) o la salida no se ve.
- **El velo cerrado lleva `pointer-events: none`.** Es una capa a pantalla completa: sin eso deja la aplicación entera sin reaccionar.
- **El velo transparente se declara con el mismo color y alfa cero** (`--scrim-0`), nunca `transparent`: animado desde `transparent`, Chrome interpola pasando por negro y se ve un parpadeo oscuro al abrir.
- **Al abrir, el foco entra en el primer accionable; al cerrar, vuelve de donde vino.** Si no, queda en un botón que se acaba de esconder.
- `max-height: 88vh` y `overscroll-behavior: contain`: queda fondo visible —lo que indica que se cierra tocando afuera— y el scroll no arrastra la página de atrás.

### Barra de mes

`.monthbar` es un `.shell` arriba de las vistas: es la cabecera del mes en pantalla y aplica a todas.

```text
‹   Octubre 2026              Hoy  ›
    MES ABIERTO · TRANSACCIONAL
```

Dos reglas de negocio viven acá, no sólo estilo:

- **No hay meses futuros** (General §12.1). En el mes actual la flecha de siguiente va `disabled`, y «Hoy» también, porque no lleva a ninguna parte. Apagado **de verdad**, no mudo: un botón que se ve activo y no responde parece que la aplicación se colgó. Hay además un tope dentro de `mover()`, por si alguien la llama desde otro lado.
- **El subtítulo dice si el mes es transaccional o consolidado** (Regla 4), porque de eso depende lo que se puede hacer en la pantalla.

**El nombre del mes se calcula, nunca se escribe.** Un texto fijo sería mentira el mes que viene. Y se calcula en `America/Argentina/Buenos_Aires`: con la zona del dispositivo, el día 1 o el 31 el título muestra el mes equivocado. Para formatear se pide **sólo el mes** y el año se pega aparte — pidiendo los dos juntos, `es-AR` devuelve «octubre de 2026» y el «de» ocupa lugar en una pantalla angosta.

El título va en una región `aria-live="polite"`: quien no ve la pantalla toca la flecha y, sin eso, no se entera de a qué mes pasó.

### Píldora de acción · `.chip`

Botón chico de acción: las flechas de mes, «Hoy» y, desde F01-T12, los filtros. Variante `.chip.solid` cuando es la acción principal.

El recuadro mide unos 33 px, así que el área táctil llega a 44 con un `::after` centrado. **En `:disabled` ese `::after` se saca** (`content: none`): si se mantuviera, un toque al lado de un botón apagado caería en el apagado y no pasaría nada. El `:hover` y el `:active` llevan `:not(:disabled)`, o un botón apagado se levanta al pasarle el dedo y parece tocable.

### Tarjetas de indicador

`components/kpi.js`. Dos variantes y nada más: **héroe** (cifra grande, barra de progreso, pie de dos datos) para el ahorro del mes y el patrimonio, y **métrica** (etiqueta, icono, cifra, subtítulo) para todo lo demás.

```javascript
tarjetaHeroe({ etiqueta, cifra, sub, porcentaje, pieIzq, pieDer, color })
tarjetaMetrica({ etiqueta, cifra, sub, color, icono })
pintarTarjetas(contenedor, [ ...tarjetas ])   // escribe y arranca las barras
```

- **Todo campo pasa por `esc()`, los seis.** El ejemplo del documento técnico §12.4 escapa `label` y `value` pero no `sub`: un subtítulo puede traer el nombre de una categoría que escribió el usuario, y es una puerta igual que los otros. Lo mismo el pie de la héroe y la cifra.
- **`color` sale de una lista cerrada** (`COLORES_VALIDOS`), no de un string libre: el valor termina dentro de un atributo `style` y la política del sitio admite estilos en línea, así que un color libre sería CSS inyectable. Un nombre inválido cae en el acento.
- **`icono` también es un nombre de `iconos.js`**, no un trazo. Un nombre que no existe devuelve cadena vacía, nunca `undefined` dentro del SVG.
- `porcentaje` se recorta a 0–100: un ahorro negativo daría una barra de ancho negativo y un 140 % desbordaría el surco.
- La barra y el surco van `aria-hidden`: la cifra de arriba ya dice el valor.
- **`pintarTarjetas` escribe todas de una vez.** Con siete asignaciones a `innerHTML` el navegador recalcula el layout siete veces y en un teléfono se ve el salto.

**La barra nace en 0 en el CSS y recibe su ancho en `requestAnimationFrame`.** Puesta directo, la transición no tiene de dónde partir y aparece ya llena. Y tiene que ser `requestAnimationFrame`: una microtarea corre antes del pintado, así que el ancho se junta con el primer render y tampoco se ve crecer. Ojo: **esa diferencia no se puede probar en jsdom**, los dos se ven iguales; por eso `tests/unit/test_kpi.py` la verifica leyendo el código y lo dice.

### Rejilla y entrada escalonada

`.kpi-grid` va **2 → 4 → 6** columnas en los cortes de §5, y `.kpi--hero` ocupa siempre media fila (2 de 2, 2 de 4, 3 de 6) para que la cifra importante conserve su peso.

`.stagger > *` escalona **de a 60 ms, en CSS con `nth-child`**, no con `style` en línea desde JavaScript: el retardo vive con el resto del estilo y un componente no tiene que saber en qué posición lo van a pintar. A partir de la novena el retardo se congela — con 20 filas, la última entraría más de un segundo después y parecería que la pantalla se cuelga por partes.

**El bloque de `prefers-reduced-motion` de `base.css` anula la duración, no el retardo.** Sin anularlo aparte, con movimiento reducido las tarjetas siguen apareciendo de a una, sólo que de golpe.

### Otros

- **`.pill`** en cinco variantes: `ok`, `warn`, `pend`, `crit`, `neutral`.
- **`.alert`** con `--c` por severidad, borde y sombra teñidos.
- **`.view-switch`** conmutador de pastillas dentro de un surco hundido.
- **`.sheet`** hoja inferior en móvil; desde 900 px pasa a cajón lateral (`.sheet`) o modal centrado (`.sheet.center`). Cierra con toque afuera, Escape y botón.
- **`.toast`** con `aria-live="polite"`, cierre automático a 2,6 s.
- **`.toggle`**, **`.cfg-row`**, **`.kv`**, **`.mini`**, **`.ghost-note`**.

## 9 · Gráficos

SVG generado por JavaScript, `viewBox` para escalar, colores por **variable CSS** (`fill="var(--inc)"`) para heredar el tema sin redibujar. Ningún gráfico tiene sentido sin su pie de cifras.

### El gráfico diario — el más importante

Barras de ingresos y egresos por día **más la línea del ahorro acumulado del mes**, con **doble eje**:

```text
Eje X        días del mes (1…día actual)
Eje Y izq.   importe diario → barras (verde ingresos, roja egresos)
Eje Y der.   ahorro del mes acumulado → línea azul grafito 2,7 px
             · punto y etiqueta en el valor de hoy
             · línea de cero punteada si el ahorro se vuelve negativo
             · rótulo "AHORRO" sobre el eje
Modos        Ambos · Egresos · Ingresos · Acumulado
             (la línea de ahorro se mantiene visible en los cuatro)
```

**Por qué doble eje:** el gasto diario se mueve en decenas de miles y el ahorro acumulado en millones. Con un solo eje la línea aplastaría las barras. Esto es un pedido explícito de Gustavo: se ve de un golpe el salto del día del sueldo y cómo el ahorro baja con cada gasto.

```javascript
// la serie que alimenta la línea
const sav=[]; let acc=0;
for(let i=0;i<n;i++){ acc+=inc[i]-exp[i]; sav.push(acc) }
```

### Los demás

| Gráfico | Tipo | Modos |
|---|---|---|
| Últimos seis meses | Barras agrupadas (ingresos, egresos, ahorro) | Barras · Ahorro · Tasa |
| Gastos por categoría | Barras horizontales de mayor a menor | Mayor gasto · A–Z |
| Evolución del ahorro | Área con línea del saldo acumulado | — |
| Composición patrimonial | Barra apilada horizontal | — |
| Evolución salarial | Área con línea | — |

### Reglas comunes

- `niceMax()` para que los ejes caigan en valores redondos.
- Mínimo **1,5 px** de alto en las barras, para que un gasto chico se vea.
- Los `<linearGradient>` llevan **id único** por instancia: si dos gráficos coexisten en el DOM, uno toma el color del otro.
- En móvil `min-width:520px` con scroll horizontal; desde 720 px se ajusta al ancho.
- `role="img"` y `<title>` con el resumen en texto.

## 10 · Formato de importes

El backend manda strings decimales. El frontend **sólo formatea, nunca calcula**.

```javascript
fmt(3491280)    // "$3.491.280"
fmtS(-42000)    // "−$42.000"     (signo menos tipográfico U+2212)
fmtK(3491280)   // "$3,5M"   · fmtK(340000) → "$340k" · negativos con −
pct(31.7)       // "+31,7%"  · null → "N/A"
```

Separador de miles con punto y decimal con coma (es-AR). **Tasa de ahorro con ingresos en cero devuelve `N/A`, nunca 0 % ni error.**

## 11 · Estados

Cada vista implementa los cuatro. **Nunca una pantalla en blanco.**

| Estado | Tratamiento |
|---|---|
| Cargando | Esqueletos con la forma del contenido final (mismas alturas, sin salto de layout) |
| Error | Tarjeta con el mensaje y botón "Reintentar" |
| Vacío | Texto explicativo útil, no ceros secos |
| Cuenta nueva | El dashboard de una cuenta recién creada está vacío a propósito: invita a cargar el primer movimiento, no muestra ceros secos |
| Esperando confirmación | Tras registrarse: "revisá tu correo", con la dirección a la que se envió y un botón de reenviar |
| Enlace vencido | En `#/nueva-clave`, si el enlace ya se usó o venció: explica el problema y ofrece pedir otro |
| Mes consolidado | Texto específico: "Información histórica consolidada" |
| Sin conexión | Banda superior y lectura desde el caché |

**El caso del mes consolidado es una regla de negocio, no un detalle visual:** cuando la API devuelve `transactions: null`, la interfaz dice que el mes es consolidado y **no muestra lista vacía ni inventa movimientos** (Regla 4 del documento general).

## 12 · Accesibilidad

- Contraste mínimo 4,5:1 en ambos temas.
- `aria-label` en todo botón de sólo icono; `aria-live="polite"` en el toast; `aria-expanded` en lo que se expande.
- Foco visible: `box-shadow:0 0 0 4px var(--accent-ring)`.
- Navegación completa por teclado; foco atrapado dentro de una hoja abierta.

## 13 · Qué NO hacer

- No agregar librerías de UI ni de gráficos.
- No escribir colores, sombras ni radios fuera de los tokens.
- No usar `backdrop-filter` sin su bloque `@supports not`.
- No usar `innerHTML` con datos del servidor sin `esc()`.
- No hacer aritmética con dinero en el frontend.
- No inventar movimientos para un mes consolidado.
- No diseñar en escritorio y reducir.
- No neón, no gradientes estridentes, no sombras de color saturado.
- No JavaScript en línea en el HTML (lo bloquea la política de contenido).
