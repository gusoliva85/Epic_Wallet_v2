# Notas de Claude — no es un documento que manda

Esto **no** es uno de los tres documentos oficiales (`01_Documento_General.md`,
`02_Documento_Tecnico.md`, `03_Roadmap.md`). Es un apunte mío, para mí,
para no releer todo el historial de conversación cada vez que arranca
una sesión nueva. Gustavo pidió que exista; no lo va a leer en general,
pero sabe que está. Si algo de acá contradice los tres documentos
oficiales o el roadmap, **ganan ellos**, esto está desactualizado y hay
que corregirlo o borrarlo.

Última actualización: commit `078b6ad` (F07-T05, recién pedido
aprobación), rama `main`, HEAD de ese momento. Si el repo ya avanzó
más, esto es historia vieja —leer el roadmap primero, y si alcanza con
eso, no hace falta leer el resto de este archivo.

## Leer esto primero, en este orden

1. `documentacion/03_Roadmap.md` — qué tarea sigue, qué está `[~]`
   esperando aprobación. Es la única fuente de tareas; esto no lo es.
2. Esta sección de "estado al cierre de la última sesión" de más
   abajo.
3. Si hace falta profundidad de modelo o de stack: `01_Documento_General.md`
   y `02_Documento_Tecnico.md`.
4. Antes de tocar HTML/CSS/JS de interfaz: `.claude/skills/epic-wallet-ui/SKILL.md`
   (es obligatorio cargarlo, no opcional).

## Estado al cierre de la última sesión

**Fases 0 a 6 completas y aprobadas.** Fase 7 (Desglose y detalle de
categoría) también completa en código; la última tarea,
**`F07-T05` (hoja de detalle de categoría), está `[~]`** —implementada,
pedida la aprobación, todavía sin confirmar por Gustavo porque no pude
cerrar una prueba de punta a punta con navegador real (ver "cold-boot
401" más abajo). El resto de la Fase 7 (`F07-T01`, `F07-T03`) está
`[x]`, aprobada.

**Siguiente tarea cuando Gustavo apruebe F07-T05**: Fase 8 — Histórico
y carga del Excel. Primera tarea: `F08-T03 · Endpoints de meses
históricos` (`POST /api/months/historical`, `PATCH /api/months/{id}`,
y recién ahí `GET /api/months` puede devolver un `closing_balance`
real —ver más abajo por qué hoy esa columna no sirve para nada).
Leer el roadmap para la lista completa y el orden exacto; no asumir
que sigue siendo así si pasó tiempo.

## Qué se construyó (Fases 5, 6 y 7 — resumen, no el detalle línea por línea)

- **`GET /api/dashboard`** (F05-T04): el contrato único del tablero de
  Inicio. Indicadores, serie diaria, últimos seis meses, desglose por
  categoría —todo en una sola llamada, menos de 400 ms. `dashboard.js`
  es el único dueño de esos cuatro contenedores en Inicio; nada más
  les escribe.
- **Los 5 gráficos** (`web/src/js/charts/`): `diario.js`, `seis.js`,
  `ahorro.js`, más `svg.js` con las utilidades compartidas
  (`escalaRedonda`, `ejeConCero`, `tramoDeBarra`, `grilla`,
  `ejeDeCategorias`, etc.). El quinto, "composición patrimonial"
  (Patrimonio → Composición), es una barra apilada simple en
  `views/vistas.js` con **datos de ejemplo a propósito** —marcado
  como tal en pantalla— hasta que exista F10 (inversiones).
- **El cambio de tema ya redibuja los gráficos solo**, sin JS: todo
  color sale de `var(--color-*)` puesto directo en `fill`/`stroke`, y
  eso reacciona en vivo. Lo verifiqué en un navegador real antes de
  dar F06-T09 por andando en esa parte —no hacía falta código nuevo.
- **Lectura táctil del gráfico diario** (F06-T09, dos correcciones):
  mantener el dedo quieto 350 ms muestra el valor del día, centrado en
  el punto tocado (no en una esquina fija del gráfico —si no, con el
  `.chart-wrap` scrolleado hacia el final del mes la etiqueta quedaba
  fuera de lo que se ve). Moverse más de 10 px **antes** de esos 350 ms
  se trata como scroll y no activa nada: `touch-action` se dejó en su
  valor por defecto a propósito, la primera versión lo restringía y le
  sacaba el scroll lateral al navegador —Gustavo lo probó y pidió
  devolverlo. Documentado con detalle en Técnico §14.1 y §14.3.
- **Desglose por categoría** (F07-T01, F07-T03): `calc.porcentajes_de_categorias`
  reemplazó a `participacion()` por categoría suelta —con esa, la suma
  de los `share` de un mismo tipo podía quedar en 99,9 o 100,1 por
  redondeo independiente; ahora usa el método del mayor resto y da
  exactamente 100. Cada categoría también trae `variation` (contra el
  mes anterior, `null` si no había dato). El panel se puede ordenar
  por mayor gasto, A–Z o variación.
- **`GET /api/categories/{id}/detail?year&month`** (F07-T01): total
  del mes, última carga y los movimientos de esa categoría —
  `transactions: null` si el mes es histórico, nunca una lista
  inventada (Regla 4). `year`/`month` son obligatorios, sin default a
  "mes actual" (a diferencia de `/dashboard`).
- **Hoja de detalle de categoría** (F07-T05): `categoria-detalle.js`,
  módulo nuevo. Se abre tocando una fila de `#categorias-inicio` (el
  panel ES el "gráfico de categorías" del General §54 —no hay un SVG
  aparte). Tocar un movimiento ahí adentro **cierra esta hoja y abre
  `alta-movimiento.js::abrirEdicion`** (el mismo formulario que usa la
  vista Movimientos) en vez de reconstruir un editor propio.
  **Importante:** `components/sheet.js` no está pensado para dos hojas
  abiertas a la vez —comparten `#fondo-hoja`, y cerrar la de arriba le
  saca el velo a la de abajo aunque siga abierta; el `Escape` tampoco
  respeta cuál es "la de más arriba"—. Por eso la hoja de categoría se
  cierra ANTES de abrir la de edición, nunca las dos apiladas. Si
  alguna tarea futura necesita de verdad dos hojas a la vez, hay que
  arreglar `sheet.js` primero (darle a cada par hoja/velo su propio
  `fondo`, y que el oyente de `Escape` sólo cierre la última abierta),
  no improvisarlo por tarea.
- **Limpieza de Inicio**: se sacó "Últimos movimientos" (duplicaba la
  vista Movimientos sin aportar nada — pedido directo de Gustavo,
  General §55 actualizado para decirlo) y el cartel "Cifras de
  muestra" (ya quedaba todo con datos reales, el aviso mentía).

## Cosas que NO están hechas y conviene no asumir que sí

- **`months.closing_balance`/`opening_balance` son columnas fantasma.**
  Existen en la base (`server_default='0'`) pero **nada las escribe
  nunca**, en ningún `repo` ni `service`. Quedó así a propósito: F08-T03
  es la tarea que las va a encadenar de verdad. Mientras tanto, el
  saldo acumulado real se calcula al vuelo —`calc.ahorro_acumulado`/
  `calc.serie_de_ahorro_acumulado`, usados por `GET /api/dashboard` y
  por `GET /api/months/savings-evolution` (F06-T07)— a partir de
  `profiles.opening_balance` + la suma de `saving_total` mes a mes.
  **No leer `closing_balance` de la base para nada hasta que F08-T03
  esté hecha.**
- **La tabla de `#historial-tabla` (vista Historial) sigue siendo 100%
  dato de muestra.** Sólo el gráfico de arriba (evolución del ahorro)
  es real, desde F06-T07. Conectar la tabla a `GET /api/months` de
  verdad es trabajo de F08-T07.
- **Composición patrimonial** (Patrimonio → Composición): dato de
  ejemplo marcado como tal, a propósito, hasta F10.

## El "cold-boot 401": un problema del entorno, no de la aplicación

Varias veces esta sesión, al crear una cuenta de prueba nueva y
loguearse por la UI real (Playwright + Chromium) para hacer QA visual
de punta a punta, las primeras llamadas a la API daban 401
("La sesión no es válida") de forma persistente —ni uno ni varios
`page.reload()` lo arreglaban siempre; a veces sí, a veces no, sin
patrón claro—. **No es un bug de la aplicación**: los mismos endpoints,
con las mismas cuentas recién creadas, funcionan sin problema cuando
se los llama directo por HTTP (`tests/api/`, con `pytest`, que corrió
limpio todas las veces). El problema es específico de este entorno
local levantando el navegador contra el cliente de Supabase del
frontend.

**Qué hacer cuando bloquea una prueba visual:** no insistir mucho
tiempo con reintentos de login. En vez de eso, armar un harness
aislado sin autenticación —un `.html` suelto en `web/` (nunca
commiteado) que importa los módulos JS reales (`charts/*.js`,
`components/*.js`, etc.) con datos de prueba fijos, servido por el
mismo `lanzar_local.py`, y manejado con Playwright para capturas y
chequeos de geometría (`getBoundingClientRect`, scroll, overflow).
Esta técnica funcionó bien varias veces esta sesión cuando el login
real no quería cooperar. Si hace falta probar algo que sí necesita la
API real (un endpoint nuevo, por ejemplo), usar `tests/api/` con
`pytest` en vez de UI —ya está probado que ese camino es confiable.

## Cosas del entorno que cuestan tiempo si se olvidan

- **Python del proyecto:** `python`/`pytest` del PATH global no tienen
  las dependencias. Siempre `./.venv/Scripts/python.exe -m pytest`
  (o `ruff`/`mypy`), no el `python` pelado.
- **mypy:** correr `mypy api/app` (o archivos puntuales dentro de ahí),
  **no** `mypy .` desde la raíz —con un argumento posicional mal
  puesto encuentra `api/app/main.py` con dos nombres de módulo
  distintos y falla sin que tenga nada que ver con el código.
- **JS: usar `npm test`, no `node --test tests/js/*.test.mjs` a mano.**
  `tests/js/auth.test.mjs` deja vivo un `setInterval` de un cliente de
  Supabase; sin la flag `--test-force-exit` que ya tiene el script de
  `package.json`, el proceso de Node se queda colgado para siempre.
- **Build de Tailwind:** `npm run build` hace falta cada vez que se
  toca algo en `web/src/styles/` **o se agrega una clase CSS nueva
  usada sólo en HTML/JS** —me pasó más de una vez esta sesión hacer
  QA visual contra un `app.css` viejo y ver colores negros/rotos que
  en realidad ya estaban bien en el código, sólo que sin reconstruir.
  `web/public/app.css` está en `.gitignore`, no se commitea nunca.
- **No correr dos `pytest` completos en paralelo.** Pisan la misma
  base real de Supabase (cuentas/categorías con nombres que pueden
  coincidir, fixtures de módulo compartidas) y salen fallos cruzados
  que no tienen nada que ver con el código —me pasó esta sesión,
  perdí tiempo pensando que había roto algo. Si hace falta confirmar
  un resultado, esperar a que termine la corrida anterior.
- **Scratchpad y QA descartable:** scripts `_qa_temp_*.mjs` y fixtures
  `web/_qa_*_aislado.html` se escriben en la raíz del repo o en
  `web/`, se usan, y se borran siempre antes de terminar la tarea —
  nunca se commitean. Cuentas de Supabase de prueba creadas para QA se
  borran con el service role key al terminar
  (`DELETE {SUPABASE_URL}/auth/v1/admin/users/{uid}`).

## Patrones ya establecidos (para no reinventarlos)

- **Capas:** `routers` → `services` (cálculo puro, sin DB) → `repos`
  (consultas, sin decidir nada) → `core`. Un service nuevo se prueba
  con `tests/unit/`, cualquier cosa que toque Postgres de verdad con
  `tests/api/` (marcador `@pytest.mark.api`, `sin_entorno` skip si
  faltan credenciales).
- **RLS en vez de `where user_id = ...` a mano.** Ninguna consulta de
  `repos/` filtra por usuario: `SesionDeUsuario` ya deja a Postgres
  actuando como `auth.uid()` del token.
- **404, nunca 403**, para un recurso de otra cuenta (`_sin_mes`,
  `_sin_categoria`, `_sin_perfil`): no se revela que existe. Cada
  router repite su propia versión chiquita de este helper —no se
  comparte entre routers aunque el texto sea igual, son tres líneas.
- **`IntegrityError` → 409 con mensaje**, nunca un 500 crudo.
- **Las dos naturalezas de mes:** `open` saca sus totales de
  `transactions`; `historical` de sus propios campos y
  `transactions: null` —nunca `[]`, nunca inventado. El mismo
  contrato se repite en cada endpoint nuevo que devuelva movimientos
  de un mes puntual (`services/months.py::transacciones_del_mes` es
  el helper compartido; acepta `Sequence`, no `list`, justamente para
  poder reusarse con cualquier tipo de lista sin pelearse con mypy).
- **Frontend nunca calcula dinero.** Pasó varias veces esta sesión que
  se agregó una suma del lado del cliente (porcentajes acumulados de
  un gráfico, por ejemplo) y se terminó sacando porque violaba esto —
  si hace falta un número, se agrega al endpoint, no se deriva en JS.
- **Porcentajes que tienen que sumar 100 exacto:** método del mayor
  resto (`calc.porcentajes_de_categorias`), no redondeo independiente
  por ítem. Mismo problema puede aparecer en cualquier desglose nuevo.
- **Git: directo a `main`, no hay ramas `feat/...` en esta sesión.**
  (Una nota vieja de este archivo decía lo contrario —era de antes;
  en la práctica, de F05 en adelante, cada tarea es uno o más commits
  directo a `main`, pusheados con `git push origin main` apenas se
  cierra o se corrige algo. Puede haber un commit de implementación
  y, después de la vuelta de Gustavo, uno o más de corrección, y por
  último uno de cierre cuando aprueba.)
- **Commits:** `tipo(F0X-TYY): descripción corta en minúscula`,
  terminan con `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- **JS de pantallas reales:** módulos ES nativos, sin bundler. Para
  testear un módulo con dependencias, la técnica es reescribir cada
  línea de `import` por una versión doblada (red/eventos/módulos
  pesados) o por un `import` real apuntando a un `file:///` absoluto
  (formato/componentes puros, que sí interesa probar de verdad), y
  cargar el resultado como `data:text/javascript;base64,...`. Ver
  `tests/js/dashboard.test.mjs`, `movimientos.test.mjs` o
  `categoria-detalle.test.mjs` para el patrón completo. `crearHoja`
  (`components/sheet.js`) se importa real pero con `?t=${Math.random()}`
  al final de la URL —si no, su estado interno (`abiertas`, el conteo
  de hojas abiertas) queda compartido entre archivos de test distintos
  dentro del mismo proceso de Node.
- **jsdom no implementa varias APIs de geometría SVG/puntero:**
  `getBBox()`, `setPointerCapture()`, `getScreenCTM()` no existen;
  `getBoundingClientRect()` siempre da 0×0 salvo que se lo pise a
  mano. Cualquier test que dibuje algo que dependa de eso necesita
  mockear esos métodos en el `SVGElement.prototype` del `window` de
  esa prueba (ver `tests/js/diario.test.mjs`, la función `montarSvg`).
- **Roadmap:** `[ ]` pendiente → `[~]` implementada, esperando prueba
  → `[x]` sólo cuando Gustavo lo dice explícitamente. Nunca se marca
  `[x]` sin que él lo apruebe primero.
