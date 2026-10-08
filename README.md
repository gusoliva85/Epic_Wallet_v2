# Epic Wallet 2.0

Aplicación personal de gestión financiera. Web responsive y PWA, **pensada primero para el celular** y con un dashboard completo en PC.

Reemplaza la planilla de Excel que vengo usando hace años: conserva su lógica financiera y su simplicidad de uso, y le agrega lo que el Excel no da cómodamente —ver cómo vengo, cómo evolucioné, dónde gasté, cuánto ahorro, cuánto vale mi patrimonio y cómo están mis inversiones.

> **Selecciono una categoría, pongo un importe y sigo con mi día.**

---

## Estado del proyecto

**Fase 0 — Puesta en marcha.** En construcción. La API ya está en internet: [https://epic-wallet-v2.vercel.app/api/health](https://epic-wallet-v2.vercel.app/api/health) El avance tarea por tarea está en [`documentacion/03_Roadmap.md`](documentacion/03_Roadmap.md).

---

## Documentación

Leerla en este orden:

| Documento | Qué contiene |
|---|---|
| [`documentacion/01_Documento_General.md`](documentacion/01_Documento_General.md) | **Qué** hace la aplicación. Especificación funcional completa: modelo financiero, reglas de negocio, pantallas, alcance. |
| [`documentacion/02_Documento_Tecnico.md`](documentacion/02_Documento_Tecnico.md) | **Cómo** se construye. Stack, arquitectura, esquema de datos, contratos de API, sistema de estilo, despliegue y seguridad. |
| [`documentacion/03_Roadmap.md`](documentacion/03_Roadmap.md) | **En qué orden.** 12 fases y 46 tareas pendientes con criterios de aceptación. Es la guía obligatoria de implementación. |
| [`documentacion/mockups/01_Mockup_V1_Grafito_Clasico.html`](documentacion/mockups/01_Mockup_V1_Grafito_Clasico.html) | Diseño aprobado. Se abre con doble clic y es funcional. |
| `docs/` | `COMO_FUNCIONA.md` (se escribe en F11-T05) y los dos documentos de fase escritos antes de la revisión. |

Si el documento técnico contradice al general en una decisión funcional, gana el general. Si el general propone una tecnología y el técnico decide otra, gana el técnico y la desviación queda registrada en su sección 4.

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | HTML5 · Tailwind CSS v4 · JavaScript (módulos ES) · SVG propio para gráficos · PWA |
| Backend | Python 3.12 · FastAPI · Pydantic v2 · SQLAlchemy 2.0 · Alembic |
| Base de datos | Supabase Postgres (producción) · SQLite (sólo tests) |
| Autenticación | Supabase Auth, con verificación de JWT en el backend |
| Hosting | Vercel: estáticos en el CDN y la API como función Python, mismo dominio |

Sin React, Vue ni Angular. Los detalles y el porqué de cada elección están en el documento técnico.

---

## Estructura

```text
epic-wallet/
├── api/                      # backend (función serverless en Vercel)
│   ├── index.py              # punto de entrada: expone `app`
│   └── app/
│       ├── main.py           # creación de FastAPI, middlewares, errores
│       ├── core/             # configuración, base de datos, seguridad, errores
│       ├── models/           # modelos SQLAlchemy
│       ├── schemas/          # esquemas Pydantic (entrada y salida)
│       ├── repos/            # consultas
│       ├── services/         # reglas de negocio y cálculos
│       │   └── prices/       # proveedores de cotizaciones
│       └── routers/          # un archivo por recurso
├── web/                      # frontend estático
│   ├── index.html
│   ├── manifest.json
│   ├── service-worker.js
│   ├── icons/
│   ├── public/               # CSS compilado (no se versiona)
│   └── src/
│       ├── styles/           # tokens, base y componentes
│       └── js/               # router, api, estado, gráficos, componentes, vistas
├── migrations/               # Alembic
├── scripts/                  # siembra de categorías, carga de histórico, respaldo
├── tests/                    # unit · api · e2e
├── docs/                     # documentación del proyecto
└── documentacion/            # especificación funcional, técnica, roadmap y mockups
```

Las cuatro capas del backend (router → service → repo → core) y la regla de que **todo cálculo financiero es una función pura** están explicadas en la sección 5.1 del documento técnico.

---

## Levantar el proyecto

### Requisitos

- Python 3.12 o superior
- Node.js 20 o superior
- Git
- Una cuenta de Supabase (alcanza **un solo proyecto**) y una de Vercel

### Pasos

```bash
# 1 · Clonar
git clone <url-del-repositorio> epic-wallet
cd epic-wallet

# 2 · Backend: entorno virtual y dependencias
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -e .                 # requiere pyproject.toml (F00-T02)

# 3 · Frontend: dependencias y compilación del CSS
npm install
npm run build                    # genera web/public/app.css minificado

# 4 · Variables de entorno
cp .env.example .env             # y completar los valores (F00-T08)

# 5 · Base de datos: migraciones (respaldo primero, ver abajo)
DB_SCHEMA=public APP_ENV=production alembic upgrade head

# 6 · Levantar
uvicorn api.app.main:app --reload --port 8000    # API en :8000
npm run dev                                      # CSS en modo watch
```

### Sobre el CSS

| Script | Qué hace |
|---|---|
| `npm run build` | Compila `web/src/app.css` a `web/public/app.css` minificado. Es el que corre Vercel. |
| `npm run dev` | Vigila `web/src` y recompila al guardar. |
| `npm run size` | Mide el CSS contra el presupuesto de 50 KB comprimido del documento técnico. |
| `npm run build:debug` | Igual que `build` pero sin minificar, para inspeccionar la salida. |
| `npm run dev:tailwind` | El `--watch` nativo de Tailwind. Ver la nota de abajo. |

`npm run dev` usa `scripts/dev-css.mjs` en lugar del `--watch` de Tailwind porque **el watcher nativo de Tailwind v4 no detecta cambios cuando la ruta del proyecto tiene espacios en Windows** (acá: `D:\_Mis Datos\...`). Se comprobó que no reacciona ni al archivo de entrada ni a los parciales importados, mientras que el build puntual funciona bien. El script propio usa `fs.watch` de Node, sin dependencias nuevas. Si alguna vez se trabaja desde una ruta sin espacios, `npm run dev:tailwind` es equivalente.

El CSS compilado **no se versiona**: lo genera el build.

### Sobre las migraciones

**Hay un solo esquema (`public`), así que una migración toca los datos reales.** Lo que protege es el procedimiento: **respaldo primero, generar y revisar el archivo a mano, aplicar, verificar con `/api/health`, y recién entonces publicar el código.** Toda migración lleva su `downgrade` escrito y revisado.

`DB_SCHEMA` y `APP_ENV` siguen siendo obligatorios y explícitos en todo comando de Alembic: `migrations/env.py` no asume un valor por defecto. Migrar es la operación destructiva del proyecto y que pida ser explícita es deliberado. La aplicación, en cambio, usa `public` por defecto y no necesita que definas nada.

El esquema se crea solo en la primera migración si no existe, y `alembic_version` vive dentro del esquema.

Los pasos marcados con una tarea entre paréntesis todavía no están disponibles: se habilitan al completar esa tarea de la Fase 0.

### Variables de entorno

Se copian de `.env.example` y se completan con los valores de tu proyecto de Supabase. Verificá con `python scripts/check_db.py`, que comprueba todo sin imprimir ningún secreto. La lista completa y qué significa cada una está en la sección 11 del documento técnico.

**Reglas que no se negocian:**

- `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_JWT_SECRET` son secretas: **nunca** llegan al navegador ni al repositorio.
- El frontend sólo conoce `SUPABASE_URL` y `SUPABASE_ANON_KEY`.
- `.env` está en `.gitignore`. Si alguna vez se filtra una clave, se rota.

---

## Entornos

| Entorno | Rama | URL | Base de datos |
|---|---|---|---|
| Producción | `main` | [epic-wallet-v2.vercel.app](https://epic-wallet-v2.vercel.app) | Supabase · esquema `public` |
| Preview | cualquier otra rama | URL automática de Vercel por rama | Supabase · esquema `public` |
| Local | — | `localhost:8000` | Supabase · esquema `public` |

Los tres apuntan al **mismo proyecto de Supabase y al mismo esquema `public`**. La diferencia entre ellos es el código que corre, no los datos.

La separación en dos esquemas (`public` y `dev`) se quitó en la revisión del 07/10/2026: para una aplicación de pocos usuarios conocidos costaba más de lo que protegía. El detalle está en la sección 4.1.1 del documento técnico.

**Consecuencia a tener presente:** una preview escribe sobre los datos reales. Las tareas que prueban escritura usan una **segunda cuenta de prueba**, no la tuya; RLS garantiza que no se cruzan.

Cada push genera una URL de preview. Eso es lo que permite probar cada tarea en el celular en el momento, sin esperar a que termine una fase.

---

## Cómo se trabaja

El roadmap manda. Una tarea a la vez, y cada tarea se implementa en este orden:

```text
1 · Lógica    funciones puras + tests unitarios
2 · Backend   endpoint + tests de API
3 · Frontend  interfaz conectada
```

```text
rama feat/F04-T03-alta-movimiento
   │
   ├─ push → Vercel construye la preview automáticamente
   ├─ se prueba en el celular con la URL de preview
   │
   ├─ aprobada  → merge a main → producción → se marca [x] en el roadmap
   └─ rechazada → se corrige en la misma rama y vuelve a preview
```

### La URL de cada preview

Vercel la arma con un patrón predecible a partir del nombre de la rama:

```text
https://epic-wallet-v2-git-<rama-normalizada>-gusoliva85s-projects.vercel.app
```

La rama se normaliza a minúsculas y con los `/` y `_` convertidos en `-`. Por ejemplo, la rama `feat/F04-T03-alta-movimiento` queda:

```text
https://epic-wallet-v2-git-feat-f04-t03-alta-movimiento-gusoliva85s-projects.vercel.app
```

Si el nombre resulta muy largo, Vercel lo trunca y agrega un hash, así que ante la duda la URL exacta está en el panel del despliegue.

**Cómo saber contra qué está corriendo:** `/api/health` informa el entorno y el esquema activo.

```bash
curl -s https://epic-wallet-v2.vercel.app/api/health | grep db_schema
#   "db_schema":"public"    ← producción, datos reales

curl -s https://epic-wallet-v2-git-<rama>-gusoliva85s-projects.vercel.app/api/health | grep db_schema
#   "db_schema":"public"    ← el único esquema del proyecto
```

`APP_ENV` es lo que distingue un entorno de otro en las variables de Vercel. `DB_SCHEMA` vale `public` en los tres.

**Protección de las previews:** está desactivada (Settings → Deployment Protection → Vercel Authentication → Disabled) para poder abrirlas en el celular sin iniciar sesión en Vercel. Las previews quedan accesibles para quien tenga la URL exacta. Los datos siguen protegidos por el login y por RLS, y las claves viven en variables de entorno del servidor. Si alguna vez se quiere volver a protegerlas, alcanza con reactivar esa opción.

Nada se da por terminado sin probarlo. Nada se implementa junto.

### Estado de las tareas en el roadmap

| Marca | Significado |
|---|---|
| `- [ ]` | Pendiente |
| `- [~]` | Implementada, esperando prueba |
| `- [x]` | Aprobada e integrada |
| `- [!]` | Rechazada, a corregir |

### Convención de commits

```text
feat(F04-T03): alta de movimiento con recálculo del mes
fix(F06-T02): la línea de ahorro no se dibujaba con ahorro negativo
docs(F03): documentación de la fase 3
```

---

## Pruebas

```bash
pytest                      # unitarios y de API
pytest tests/unit -v        # sólo la lógica de cálculo
npx playwright test         # interfaz, a 390 px y 1440 px
ruff check . && ruff format --check .
mypy api
```

Cobertura mínima exigida en `api/app/services/`: 90 %. Toda función de cálculo tiene test antes del endpoint que la usa, y todo bug encontrado deja primero un test que falla.

---

## Comandos útiles

```bash
# Migraciones · RESPALDO PRIMERO: hay un solo esquema y son los datos reales
DB_SCHEMA=public APP_ENV=production alembic revision --autogenerate -m "F03 meses"
DB_SCHEMA=public APP_ENV=production alembic upgrade head
DB_SCHEMA=public APP_ENV=production alembic downgrade -1
DB_SCHEMA=public APP_ENV=production alembic current   # en qué revisión está

# Siembra de datos
python scripts/seed_categories.py        # las 21 categorías iniciales
python scripts/load_history.py --dry-run # carga de histórico, sin escribir

# Respaldo
python scripts/backup.py
```

---

## Seguridad

Contiene información financiera personal. HTTPS siempre, contraseñas gestionadas por Supabase Auth (nunca almacenamos hashes propios), aislamiento por usuario con `user_id` en toda consulta **y** Row Level Security como segunda barrera, validación en el servidor sin excepciones, y consultas siempre parametrizadas.

El detalle completo está en la sección 17 del documento técnico.

---

## Licencia

Proyecto personal privado. Todos los derechos reservados.
