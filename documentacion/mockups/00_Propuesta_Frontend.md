# Propuesta de frontend — Epic Wallet 2.0

**Fecha:** 03/10/2026
**Estado:** 3 mockups funcionales para elegir · pendiente de aprobación
**Base estética:** `Mockup_Vidrio_Grafito.html` (vidrio, grafito, ruido sutil, sin neón)

---

## 1. Qué hay en esta carpeta

| Archivo | Variante | Carácter |
|---|---|---|
| `01_Mockup_V1_Grafito_Clasico.html` | **V1 — Grafito Clásico** | Continuidad directa del mockup de referencia. Tarjetas apiladas, lectura lineal. |
| `02_Mockup_V2_Boveda.html` | **V2 — Bóveda** | El patrimonio como protagonista. Paleta bronce/champán, hojas y teclado de captura. |
| `03_Mockup_V3_Libro_Mayor.html` | **V3 — Libro Mayor** | Densa y data-first. Rail lateral, tablas ordenables, paleta de comandos. |

Los tres son **un solo archivo HTML sin dependencias** (salvo Google Fonts): se abren con doble clic y funcionan.

---

## 2. Lo que las tres variantes tienen en común

Las tres implementan el documento funcional completo, no una maqueta estática:

**Pantallas** — Login · Dashboard del mes · Movimientos · Historial · Inversiones · Patrimonio · Análisis · Configuración.

**Indicadores obligatorios** (sección 12.2) — ingresos, egresos, ahorro del mes, total de ahorros, inversiones y patrimonio neto, siempre numéricos; el gráfico no reemplaza los números.

**Gráficos** (sección 54) — movimiento diario con barras de ingresos y egresos (no sólo acumulativo), últimos seis meses, gastos por categoría ordenados, evolución del ahorro acumulado y evolución salarial.

**Modelo de meses** — el mes en curso es transaccional y se alimenta movimiento por movimiento; los meses históricos son consolidados. Al navegar a un mes histórico las tres variantes **dejan de mostrar movimientos individuales** y lo dicen explícitamente: no se inventan movimientos para datos que sólo existen como total (Regla 4).

**Alta de movimiento funcional** — el botón `+` abre el formulario, valida que el importe sea positivo, guarda, recalcula el mes, actualiza totales, categorías y gráficos, y muestra el nuevo movimiento como el más reciente. Eliminar pide confirmación (Reglas 11 y 10).

**Inversiones como cartera, no bitácora** — alta, actualización manual, actualización automática simulada con fallback, rendimiento absoluto y porcentual, y venta que devuelve el importe al ahorro. Sin historial de compras y ventas.

**Alertas analíticas** — gasto sobre el promedio, ahorro bajo, categoría en alza, inversión sin cotizar. Ninguna de presupuesto.

**Mobile-first real** — cada variante se diseñó primero a ancho de teléfono y después se expande; ninguna es un escritorio reducido. Dark/light con `View Transitions`, áreas táctiles cómodas con una mano y `env(safe-area-inset-*)`.

---

## 3. En qué se diferencian

### V1 — Grafito Clásico
Mismo lenguaje visual que el mockup que te gusta: azul grafito, `Outfit` + `Inter`, tarjetas de vidrio con brillo diagonal.

- **Navegación:** barra inferior de 5 en móvil, barra de pestañas en escritorio.
- **Dashboard:** rejilla de KPI de 2 → 6 columnas con dos tarjetas héroe (Ahorro del mes y Patrimonio).
- **Categorías:** lista con barra de participación, se expande a hoja de detalle.
- **Carga:** modal centrado con campos clásicos y píldoras de categoría.
- **Para quién:** si querés el mínimo salto respecto de lo que ya aprobaste visualmente.

### V2 — Bóveda
Reinterpreta la estética en clave cálida: bronce y champán sobre grafito, `Fraunces` serif para las cifras.

- **Dashboard:** una tarjeta "bóveda" oscura ocupa el primer pliegue con el **patrimonio neto** como número gigante animado, barra de composición y brillo que recorre la superficie.
- **Navegación de meses:** tira horizontal de meses con `scroll-snap`, cada uno mostrando su ahorro.
- **KPI:** carrusel de fichas con sparkline de seis meses dentro de cada una.
- **Categorías:** anillo (donut) con leyenda clicable.
- **Carga:** hoja con **teclado numérico propio** y chips de categoría — dos toques y listo, sin abrir el teclado del sistema.
- **Navegación:** dock flotante con botón de captura central.
- **Para quién:** si el uso real es el celular y querés que registrar un gasto sea lo más rápido posible, con un dashboard que responda primero "cuánto tengo".

### V3 — Libro Mayor
La evolución del Excel sin disfrazarla: densa, tabular, números monoespaciados (`IBM Plex Mono`), paleta de acero verdoso.

- **Navegación:** rail lateral fijo en escritorio con atajos; barra inferior en móvil.
- **Dashboard:** fila única de 6 celdas de estadística con variación contra el mes anterior, y un **banco de trabajo** con un solo gráfico conmutable entre Diario / 6 meses / Categorías / Ahorro acumulado / Salarial.
- **Tablas ordenables** por cualquier columna, con fila de totales y barras de participación en línea.
- **Paleta de comandos (`⌘K`):** escribís `carniceria 42000` y lo guarda directo; también `ir a cartera`, cambio de mes, actualizar cotizaciones. Atajos `←` `→` para meses y `T` para tema.
- **Detalle:** cajón lateral derecho en escritorio, hoja inferior en móvil.
- **Para quién:** si vas a usar mucho la PC, querés ver más datos por pantalla y te resulta natural el orden de planilla.

---

## 4. Cómo se implementaría (independiente de la variante elegida)

Alineado con la sección 44 del documento general: **sin React/Vue/Angular**.

```text
HTML5 + Tailwind CSS + JavaScript (ES módulos)
Chart.js para gráficos
Componentes HTML reutilizables servidos por Jinja/Flask
PWA: manifest.json + service-worker.js
```

**Lo que conviene conservar de estos mockups:**

1. **Los tokens CSS.** Toda la estética vive en variables (`--ink`, `--glass-shell-bg`, `--accent`, `--sh-md`, `--r-card`…) con un bloque `html[data-theme="dark"]` que las redefine. Eso se traslada tal cual a Tailwind como `theme.extend` o se deja como CSS propio junto a Tailwind. El tema claro/oscuro no requiere tocar un solo componente.
2. **Las dos capas de vidrio.** `.shell` (contenedor, blur fuerte) y `.cg` (contenido, blur suave), ambas con `@supports not (backdrop-filter)` para degradar a opaco. Es lo que da la profundidad sin recargar.
3. **El modelo de datos del mockup** (`monthData`, `catBreakdown`, `savingsBalance`, `patrimony`, `invTotals`, `metrics`) es exactamente la forma de las respuestas que debería devolver `GET /api/dashboard` y `GET /api/patrimony`. Sirve como contrato para el backend.
4. **La regla de los dos tipos de mes** está implementada en una sola función: si el mes es consolidado, `txs` es `null` y toda la interfaz reacciona a eso. Conviene mantener esa forma en el backend (`consolidated: true` sin array de movimientos) en lugar de resolverlo en cada pantalla.

**Decisión sobre gráficos.** Los mockups usan SVG escrito a mano (sin librería) para controlar el detalle y evitar dependencias. Para producción el documento propone Chart.js, que es perfectamente válido; si se prefiere mantener el acabado exacto de estos mockups, el código SVG ya está hecho y pesa menos que Chart.js. **Es la única decisión técnica que deja abierta esta propuesta.**

---

## 5. Lo que estos mockups todavía no son

Datos de demostración, no reales. Nada persiste: al recargar se vuelve al estado inicial. No hay backend, autenticación real ni service worker; el login es una transición. Los valores de inversiones y meses históricos son ilustrativos de la estructura observada en el Excel, no cifras actuales.

---

## 6. Qué necesito de vos

1. **Cuál variante** (o qué combinación: por ejemplo la bóveda de V2 con las tablas de V3).
2. **Gráficos:** Chart.js o el SVG propio de los mockups.
3. Si hay algo del documento funcional que al verlo en pantalla quieras cambiar antes de empezar a construir.

Una vez elegida, el orden de construcción sigue la sección 71: modelo de datos → SQLite → autenticación → meses → categorías → movimientos → cálculos → dashboard.
