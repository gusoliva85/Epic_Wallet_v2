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

## 7 · Componentes

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

### Fila de lista

Rejilla `34px 1fr auto`: marca, contenido, valor. Hover `translateX(3px)`.

```javascript
`<button class="row cg" data-tx="${id}" style="--c:var(--${inc?'inc':'egr'})">
  <span class="row-ico"><svg viewBox="0 0 24 24">${inc?ICO.up:ICO.down}</svg></span>
  <span class="row-main"><b>${esc(categoria)}</b><span>${fecha}${desc?' · '+esc(desc):''}</span></span>
  <span class="row-val"><b class="num ${inc?'amt-in':'amt-out'}">${inc?'+':'−'}${fmt(monto)}</b>
    <span>${esc(origen)}</span></span>
</button>`
```

Ingreso en verde con `+`, egreso en rojo con `−`. **El color nunca es el único portador de información**: siempre lleva signo e icono de flecha.

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

### Otros

- **`.pill`** en cinco variantes: `ok`, `warn`, `pend`, `crit`, `neutral`.
- **`.alert`** con `--c` por severidad, borde y sombra teñidos.
- **`.view-switch`** conmutador de pastillas dentro de un surco hundido.
- **`.sheet`** hoja inferior en móvil; desde 900 px pasa a cajón lateral (`.sheet`) o modal centrado (`.sheet.center`). Cierra con toque afuera, Escape y botón.
- **`.toast`** con `aria-live="polite"`, cierre automático a 2,6 s.
- **`.toggle`**, **`.cfg-row`**, **`.kv`**, **`.mini`**, **`.ghost-note`**.

## 8 · Gráficos

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

## 9 · Formato de importes

El backend manda strings decimales. El frontend **sólo formatea, nunca calcula**.

```javascript
fmt(3491280)    // "$3.491.280"
fmtS(-42000)    // "−$42.000"     (signo menos tipográfico U+2212)
fmtK(3491280)   // "$3,5M"   · fmtK(340000) → "$340k" · negativos con −
pct(31.7)       // "+31,7%"  · null → "N/A"
```

Separador de miles con punto y decimal con coma (es-AR). **Tasa de ahorro con ingresos en cero devuelve `N/A`, nunca 0 % ni error.**

## 10 · Estados

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

## 11 · Accesibilidad

- Contraste mínimo 4,5:1 en ambos temas.
- `aria-label` en todo botón de sólo icono; `aria-live="polite"` en el toast; `aria-expanded` en lo que se expande.
- Foco visible: `box-shadow:0 0 0 4px var(--accent-ring)`.
- Navegación completa por teclado; foco atrapado dentro de una hoja abierta.

## 12 · Qué NO hacer

- No agregar librerías de UI ni de gráficos.
- No escribir colores, sombras ni radios fuera de los tokens.
- No usar `backdrop-filter` sin su bloque `@supports not`.
- No usar `innerHTML` con datos del servidor sin `esc()`.
- No hacer aritmética con dinero en el frontend.
- No inventar movimientos para un mes consolidado.
- No diseñar en escritorio y reducir.
- No neón, no gradientes estridentes, no sombras de color saturado.
- No JavaScript en línea en el HTML (lo bloquea la política de contenido).
