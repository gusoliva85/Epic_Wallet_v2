# Epic Wallet 2.0 · cómo funciona

Para alguien que nunca vio el proyecto y tiene que levantarlo y tocar el código.
Se lee de una sentada. Lo que está acá es lo que no se deduce leyendo los
archivos; todo lo demás está en el código y no se repite.

Los tres documentos que mandan siguen siendo `documentacion/01_Documento_General.md`
(qué hace), `documentacion/02_Documento_Tecnico.md` (cómo) y
`documentacion/03_Roadmap.md` (qué sigue). Si algo de acá los contradice, ganan
ellos.

---

## 1 · Qué es, y a qué escala

Una aplicación personal de gestión financiera que reemplaza una planilla de
varios años. Web responsive con PWA, **prioridad celular**.

**Pocos usuarios conocidos**, cada uno con su propia contabilidad. No es un
producto público y no aspira a serlo. Esto no es un detalle de contexto: es el
argumento detrás de casi todas las decisiones raras que vas a encontrar. No hay
bundler, no hay React, no hay librería de gráficos, no hay límite de peticiones,
no hay cola de trabajos. A esta escala, lo simple gana, y lo que se agregó
«porque algún día» está marcado como tal o directamente no está.

El modelo mental es el de la planilla que reemplaza: **el mes es la unidad**. Se
cargan movimientos en el mes abierto, y los meses viejos son totales
consolidados sin movimientos individuales. Todo lo demás —dashboard,
patrimonio, cartera— se deriva de eso.

---

## 2 · Levantarla

Hace falta Python 3.12, Node 20+ y un proyecto de Supabase.

```bash
git clone <repo> && cd Epic_Wallet_2.0
python -m venv .venv && . .venv/Scripts/activate   # en Linux/macOS: .venv/bin/activate
pip install -r requirements.txt
npm install
cp .env.example .env        # y completalo, ver abajo
npm run build               # compila Tailwind y genera web/public/config.js
python scripts/check_db.py  # verifica la conexión y te dice qué falta
cd api && uvicorn app.main:app --reload --port 8000
```

El frontend es estático: se sirve `web/` con cualquier servidor y las llamadas
van a `/api/*`. En desarrollo lo más cómodo es un proxy de `/api` al uvicorn del
puerto 8000.

### Las variables de `.env`

`.env.example` las lista con su explicación. Las que importan:

- `DATABASE_URL` — la cadena de Postgres de Supabase. Usá la del **pooler** para
  la función de Vercel.
- `DB_SCHEMA` — siempre `public`. Hay un solo esquema (ver §4).
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` — públicas, van al navegador.
- `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` — **secretas, sólo backend**.
  Se saltean RLS. `tests/unit/test_secretos_fuera_del_frontend.py` falla si
  alguna aparece en `web/` o en un archivo versionado.
- `APP_ENV`, `APP_TIMEZONE`, `ALLOWED_ORIGINS`, `LOG_LEVEL`.
- `PRICE_PROVIDER_ORDER`, `PRICE_REFRESH_COOLDOWN_MINUTES` — **no se usan**: la
  cotización automática quedó afuera del MVP (§6).

`npm run build` corre `scripts/generar-config.mjs`, que escribe
`web/public/config.js` con la URL y la clave anónima. Ese archivo **no está
versionado** y se regenera en cada build. El generador **rechaza** una clave
secreta puesta por error en `SUPABASE_ANON_KEY`, reconociendo los dos formatos
(`sb_secret_…` y el JWT viejo con `role: service_role`): es el único error de
esta lista que no se puede deshacer, porque una clave de servicio publicada ya
quedó publicada.

### Comandos

```bash
npm run build          # Tailwind → web/public/app.css, y config.js
npm run dev            # Tailwind en watch
npm test               # pruebas de JS (node --test)
pytest                 # pruebas de Python
ruff check . && mypy api/app
python scripts/check_db.py
```

`pytest` corre **contra la base real** las pruebas marcadas `api` (ver §7). No
las corras dos veces en paralelo: las cuentas de prueba se pisan y los fallos
que ves no son del código.

---

## 3 · Cómo está armada

### Backend · `api/app/`

FastAPI con cuatro capas, y la dirección es siempre la misma:

```
routers/  → HTTP: valida la entrada, traduce errores, no calcula nada
services/ → la lógica; calc.py son funciones puras
repos/    → las consultas; nadie más escribe SQL ni toca la sesión
core/     → configuración, conexión, errores, verificación del token
models/   → SQLAlchemy 2.0
schemas/  → Pydantic (entrada y salida de la API)
```

**`services/calc.py` es el corazón y no toca nada.** Quince funciones puras
—`ahorro_del_mes`, `ahorro_acumulado`, `tasa_de_ahorro`, `patrimonio_neto`,
`rendimiento_de_inversion`, `serie_de_ahorro_diaria`…— que reciben `Decimal` y
devuelven `Decimal`. No conocen la base, el request ni la zona horaria. **Todo
cálculo financiero nuevo va ahí, con sus tests, antes de que exista el
endpoint.** Es la única parte del proyecto con cobertura exigente, y es a
propósito: es la única donde un error no se ve mirando la pantalla.

**La sesión se exige en el enrutador, no en cada función.** En `main.py` todo
cuelga de un `APIRouter(dependencies=[Depends(current_user_id)])`; la única ruta
pública es `/api/health`. Así una ruta nueva **nace protegida** sin que nadie se
acuerde. `tests/api/test_api_protegida.py` recorre las rutas registradas —no una
lista escrita a mano— y falla si aparece una sin guardia.

El token se verifica con la clave pública del JWKS de Supabase (**ES256**,
asimétrico). `SUPABASE_JWT_SECRET` quedó en la configuración como resto y no se
usa para verificar.

### Frontend · `web/`

HTML + Tailwind v4 + JavaScript ES2022 con módulos nativos. **Sin React y sin
bundler**: los `<script type="module">` de `index.html` cargan los archivos de
`web/src/js/` tal cual, y el único paso de build es Tailwind. La librería de
auth de Supabase está *vendorizada* en `web/src/js/vendor/auth-js.js`
(`npm run auth:vendor`), para no depender de un CDN en tiempo de ejecución.

Una sola página, **seis vistas** (`inicio`, `movimientos`, `historial`,
`inversiones`, `patrimonio`, `config`) y cuatro pantallas de cuenta (`login`,
`registro`, `recuperar`, `nueva-clave`), con enrutado por **hash**.

Tres reglas del frontend que no son negociables:

1. **Nadie lee la ruta del hash ni del DOM.** `router.js` es el único que
   decide, y avisa con el evento `epic:ruta` (`detail.id`). Para ir a algún lado
   se llama `navegar(id)`, nunca se toca `location.hash`.
2. **Ningún color, sombra ni radio se escribe a mano.** Todo sale de los tokens
   de `web/src/styles/tokens.css`. El tema oscuro redefine las mismas variables;
   ningún componente sabe en qué tema está. El sistema de diseño completo está
   en `.claude/skills/epic-wallet-ui/SKILL.md` y **hay que leerlo antes de tocar
   interfaz**.
3. **Todo dato del servidor pasa por `esc()`** antes de entrar en una plantilla.
   Está probado con jsdom en modo `runScripts`, para que un `onerror` inyectado
   *pueda* correr si el escapado falla.

Los gráficos son SVG propio (`web/src/js/charts/`), sin Chart.js. Y todo panel
con gráfico lleva su pie de cifras: **el gráfico nunca reemplaza los números.**

`api.js` es el único punto de salida hacia el backend: agrega el token, traduce
el formato de error de la API a una excepción, y resuelve el token vencido
reintentando **una sola vez**. Al segundo 401 cierra la sesión. Ningún otro
archivo hace `fetch` a `/api`.

### Despliegue

Vercel. El frontend se sirve estático desde `web/`; `vercel.json` reescribe
`/api/*` a una única función Python (`api/index.py`) en la región `gru1`, al lado
de la base en `sa-east-1` (São Paulo) — el viaje entre función y base es lo que
domina la latencia. Preview por rama, producción en `main`.

---

## 4 · El modelo de datos

Ocho tablas en el esquema `public`, todas con `user_id` y **todas con RLS activo
y su política**. Los nombres de tablas y columnas están en inglés porque los
define el DDL de Postgres; el resto del código está en español.

```
profiles                  una fila por cuenta: nombre visible, saldo inicial, zona
categories                las del usuario, con tipo (income/expense) y orden
months                    un mes: year, month, status, los tres totales, saldos
transactions              un movimiento: fecha, tipo, importe, descripción, origen
monthly_category_totals   el total por categoría y mes
investments               una posición de la cartera
liabilities               pasivos (existe, hoy vacía)
app_settings              preferencias por clave (el tema, por ejemplo)
```

**Importes en `numeric(14,2)` en la base y `Decimal` en Python. Nunca `float`.**
No es una preferencia estética: un `float` en una suma de pesos da un centavo de
diferencia que después no se puede explicar.

### Las dos naturalezas de un mes

Es la decisión que más fácil se rompe sin querer, así que va completa:

- Un mes **`open`** saca sus totales de sus `transactions`. Son los movimientos
  individuales que cargás.
- Un mes **`historical`** saca sus totales de **sus propios campos**, y su
  contrato devuelve **`transactions: null`** — distinto de `[]`. Son los meses
  consolidados que vienen de la planilla vieja: existen los totales, no existen
  los movimientos.

`null` significa «este mes no tiene movimientos que mostrar»; `[]` significaría
«los tiene y son cero». **Nunca se inventan movimientos para un mes
consolidado**, ni para que el gráfico quede más lindo.

### Aislamiento entre cuentas

`user_id` en **toda** consulta **y RLS activo** en cada tabla de datos de
usuario, incluidas las que se agreguen. Es la única exigencia de seguridad que
no se negocia. Hay dos barridos que la verifican contra la base real:
`tests/api/test_aislamiento_entre_cuentas.py` y
`tests/api/test_aislamiento_f11.py`, el segundo sobre los 27 endpoints privados.

Un recurso de otra cuenta devuelve **404, nunca 403**: un 403 confirmaría que el
recurso existe, y que exista ya es un dato ajeno. El 404 del recurso ajeno y el
del id inexistente son **el mismo 404, cuerpo incluido**.

### Migraciones

Hay **un solo esquema**, así que una migración toca los datos reales. El
procedimiento es el que protege los datos, y el orden no se invierte:

```bash
# 1 · respaldo primero (panel de Supabase, o GET /api/export)
# 2 · generar y REVISAR el archivo a mano
DB_SCHEMA=public APP_ENV=production alembic revision --autogenerate -m "F03 meses"
# 3 · aplicar
DB_SCHEMA=public APP_ENV=production alembic upgrade head
# 4 · verificar con /api/health, y recién entonces publicar el código
```

`DB_SCHEMA` y `APP_ENV` van explícitos porque `migrations/env.py` los exige a
propósito: es la diferencia entre migrar a conciencia y migrar por costumbre.
Toda migración lleva su `downgrade` escrito y revisado.

---

## 5 · Decisiones que conviene conocer antes de tocar algo

Las que sorprenden si no te las cuentan:

- **Comprar una inversión no es un gasto** y no cambia el patrimonio neto:
  mueve su composición (sale de ahorro, entra en inversiones). Si alguna vez
  comprar una inversión baja el patrimonio, hay un error.
- **La tasa de ahorro con ingresos en cero devuelve `null`**, no cero ni un
  error. Un mes sin ingresos no tiene tasa de ahorro; inventar un 0 % diría algo
  falso.
- **El dashboard es una sola llamada** (`GET /api/dashboard`), por debajo de
  400 ms. No se agregan llamadas a la pantalla de inicio: se agregan campos a
  ese contrato.
- **No hay bitácora de inversiones.** Vender es un `DELETE` de verdad, porque el
  documento general es explícito en que no se conserva historial de compras y
  ventas. La columna `active` de `investments` no es para eso.
- **El signo de un movimiento lo decide su `transaction_type`, nunca el valor
  del importe.** El importe llega formateado y sin signo; el frontend no hace
  aritmética. El menos es `−` (U+2212), no el guión del teclado.
- **El correo saliente no existe.** No hay SMTP contratado, así que
  `#/recuperar` muestra un mensaje («contactate con quien te dio la cuenta») en
  vez de un formulario, y la confirmación por correo está desactivada. El camino
  completo está escrito y probado detrás de `RECUPERACION_POR_CORREO` en
  `web/src/js/recuperar.js`: se enciende con esa línea más cuatro pasos en el
  panel de Supabase, documentados en F11-T03 del roadmap.
- **Los datos reales que ya están cargados no se tocan.** Ningún fix, migración
  ni script corre un `DELETE`, `TRUNCATE` o `DROP` contra la base real sin
  explicar antes qué se borra y esperar confirmación explícita — nunca como
  efecto secundario de otra cosa. No aplica a las cuentas de prueba que se crean
  y se borran dentro de una misma tarea de QA, ni a lo que la aplicación ya
  permite hacer desde la interfaz.

### Una arista conocida

**Al entrar desde cero, las pantallas quedan vacías hasta recargar.** Varias
vistas piden sus datos *al importarse*, y eso pasa mientras todavía estás en el
login: sin sesión fallan, y nada las vuelve a disparar cuando entrás. Con la
sesión guardada en el teléfono casi no se nota, y está **deliberadamente sin
arreglar**. El arreglo propio es que cada módulo pida sus datos al activarse su
ruta (`epic:ruta`) y no al importarse.

---

## 6 · Lo que quedó deliberadamente afuera

No son olvidos. Cada uno tiene su motivo en el roadmap:

- **Cotización automática de inversiones.** El documento general ya la
  condicionaba a «si se encuentra una fuente viable». La actualización manual
  cubre la necesidad. La preparación que el documento técnico describe —tabla de
  cache, `POST /api/investments/refresh-prices`, columnas de precio unitario— **no
  existe**: esas columnas se sacaron en la migración `7a3f9c2e1d84` al decidir
  que `initial_value` y `current_value` son siempre el importe total de la
  posición. Lo que queda preparado es eso: `symbol` y un `current_value` que un
  proveedor podría escribir.
- **Alertas.** El componente de avisos existe y está probado (cinco
  severidades), pero **nada genera alertas**: la lista está vacía. Las cinco
  reglas analíticas quedaron para cuando haya datos suficientes para elegir los
  umbrales.
- **Análisis, historial salarial, PWA offline completa, integraciones.**
- Y del documento general: presupuesto, tarjetas y cuentas bancarias
  detalladas, cuotas, dólares, trading, conciliación, importación de Excel.

---

## 7 · Qué se testea y qué no

La política es explícita, y leerla ahorra discusiones:

**Se testea lo que da un número o protege un dato.** `services/calc.py`, el
recálculo del mes, los casos borde (ingresos en cero, mes vacío), que una cuenta
no vea los datos de otra, el escapado de HTML, que los secretos no lleguen al
navegador.

**No se testea** la estructura del HTML, los tokens de CSS, el contraste, la
configuración del despliegue ni el contenido de la documentación. Eso se
verifica mirando la pantalla en el celular.

El criterio para decidir, aplicado literal: *si el test falla, ¿me enteré de
algo que la pantalla no me hubiera mostrado?* Si no, el test no se escribe. **No
hay exigencia de cobertura.**

Dónde vive cada cosa:

- `tests/unit/` — funciones puras y lo que no toca la red. Rápido.
- `tests/api/` — marcado `api`: cuentas **reales** de Supabase creadas y
  borradas por el propio módulo, contra la base real. Es la única forma de
  probar RLS, que en un doble no existe.
- `tests/js/` — jsdom, con el HTML recortado del `index.html` real para que una
  prueba se entere si un `id` deja de existir.

Lo que jsdom estructuralmente **no** puede ver —que una pantalla rebote, que un
gráfico dibuje, que una petición salga de verdad— se verifica con un recorrido
real por el navegador contra la URL de preview o de producción. Más de un bug de
este proyecto apareció sólo así.

---

## 8 · Convenciones

- **Tablas y columnas en inglés**, `snake_case`. **El resto del código
  —funciones, clases, variables, docstrings— en español.** Textos visibles y
  documentación en español rioplatense (voseo: «podés», «tenés»).
- Commits: `tipo(F0X-TYY): descripción en minúscula`. Tipos: `feat`, `fix`,
  `docs`, `chore`, `merge`.
- Importes en pesos argentinos con `tabular-nums`, para que las cifras no
  cambien de ancho al actualizarse.
- Zona horaria de presentación: `America/Argentina/Buenos_Aires`. La fecha de un
  movimiento es la del día del usuario, no la de UTC.
- Una tarea del roadmap a la vez, y dentro de la tarea el orden es
  **cálculo → backend → frontend**.
