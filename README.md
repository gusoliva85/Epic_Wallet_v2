# Epic Wallet 2.0

Aplicación personal de gestión financiera. Web responsive y PWA, **pensada primero para el celular** y con un dashboard completo en PC.

Reemplaza la planilla de Excel que vengo usando hace años: conserva su lógica financiera y su simplicidad de uso, y le agrega lo que el Excel no da cómodamente —ver cómo vengo, cómo evolucioné, dónde gasté, cuánto ahorro, cuánto vale mi patrimonio y cómo están mis inversiones.

> **Selecciono una categoría, pongo un importe y sigo con mi día.**

---

## Estado del proyecto

**Fase 0 — Puesta en marcha.** En construcción. El avance tarea por tarea está en [`documentacion/03_Roadmap.md`](documentacion/03_Roadmap.md).

---

## Documentación

Leerla en este orden:

| Documento | Qué contiene |
|---|---|
| [`documentacion/01_Documento_General.md`](documentacion/01_Documento_General.md) | **Qué** hace la aplicación. Especificación funcional completa: modelo financiero, reglas de negocio, pantallas, alcance. |
| [`documentacion/02_Documento_Tecnico.md`](documentacion/02_Documento_Tecnico.md) | **Cómo** se construye. Stack, arquitectura, esquema de datos, contratos de API, sistema de estilo, despliegue y seguridad. |
| [`documentacion/03_Roadmap.md`](documentacion/03_Roadmap.md) | **En qué orden.** 18 fases y 205 tareas con criterios de aceptación. Es la guía obligatoria de implementación. |
| [`documentacion/mockups/01_Mockup_V1_Grafito_Clasico.html`](documentacion/mockups/01_Mockup_V1_Grafito_Clasico.html) | Diseño aprobado. Se abre con doble clic y es funcional. |
| `docs/` | Documentación de cada fase terminada, en lenguaje natural. |

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
├── docs/                     # documentación por fase
└── documentacion/            # especificación funcional, técnica, roadmap y mockups
```

Las cuatro capas del backend (router → service → repo → core) y la regla de que **todo cálculo financiero es una función pura** están explicadas en la sección 5.1 del documento técnico.

---

## Levantar el proyecto

### Requisitos

- Python 3.12 o superior
- Node.js 20 o superior
- Git
- Una cuenta de Supabase y una de Vercel

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

# 5 · Base de datos: aplicar migraciones
alembic upgrade head             # requiere Alembic configurado (F00-T05)

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

Los pasos marcados con una tarea entre paréntesis todavía no están disponibles: se habilitan al completar esa tarea de la Fase 0.

### Variables de entorno

Se copian de `.env.example` y se completan con los valores de tus proyectos de Supabase. La lista completa y qué significa cada una está en la sección 11 del documento técnico.

**Reglas que no se negocian:**

- `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_JWT_SECRET` son secretas: **nunca** llegan al navegador ni al repositorio.
- El frontend sólo conoce `SUPABASE_URL` y `SUPABASE_ANON_KEY`.
- `.env` está en `.gitignore`. Si alguna vez se filtra una clave, se rota.

---

## Entornos

| Entorno | Rama | URL | Base de datos |
|---|---|---|---|
| Producción | `main` | por definir | Supabase producción |
| Preview | cualquier otra rama | URL automática de Vercel por rama | Supabase desarrollo |
| Local | — | `localhost:8000` | Supabase desarrollo o SQLite |

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
   ├─ push → Vercel construye la preview
   ├─ se prueba en el celular con la URL de preview
   │
   ├─ aprobada  → merge a main → producción → se marca [x] en el roadmap
   └─ rechazada → se corrige en la misma rama y vuelve a preview
```

Nada se da por terminado sin probarlo. Nada se implementa junto. Al cerrar todas las tareas de una fase se escribe su documento en `docs/`.

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
# Migraciones
alembic revision --autogenerate -m "F03 meses y categorias"
alembic upgrade head
alembic downgrade -1

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
