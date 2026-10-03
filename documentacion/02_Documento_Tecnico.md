# Documento técnico — Epic Wallet 2.0

**Versión:** 1.0
**Fecha:** 03/10/2026
**Estado:** Especificación técnica aprobada para desarrollo
**Documentos relacionados:** `01_Documento_General.md` (qué se construye) · `03_Roadmap.md` (en qué orden) · `mockups/01_Mockup_V1_Grafito_Clasico.html` (diseño aprobado)

---

## 1. Propósito de este documento

`01_Documento_General.md` define **qué** hace la aplicación. Este documento define **cómo** se construye: stack, arquitectura, esquema de datos, contratos de API, sistema de estilo y despliegue.

Regla de precedencia: si este documento contradice al general en una decisión funcional, gana el general. Si el general propone una tecnología y acá se decide otra, gana este documento y la desviación queda registrada en la sección 4.

---

## 2. Principios técnicos

1. **Mobile-first real.** Se desarrolla y prueba primero a 390 px de ancho. El escritorio se gana con `min-width`, nunca se reduce desde escritorio.
2. **Producción desde el día uno.** Cada tarea terminada tiene que ser visible en una URL pública para probarla en el celular. No existe "terminado en local".
3. **Lógica primero, después backend, después frontend.** Cada funcionalidad se implementa en ese orden y se valida en cada paso.
4. **Sin framework de UI.** Nada de React, Vue ni Angular. HTML, CSS (Tailwind) y JavaScript nativo con módulos ES.
5. **Una sola fuente de verdad para los cálculos.** Todo cálculo financiero vive en el backend. El frontend muestra; no recalcula.
6. **Nada se implementa sin probar.** Cada tarea del roadmap tiene criterios de aceptación verificables.
7. **Carga rápida.** Presupuesto: menos de 150 KB de JavaScript y menos de 50 KB de CSS, ambos comprimidos. Primera pintura útil en menos de 1,5 s en 4G.
8. **Los datos son sensibles.** Información financiera personal: HTTPS siempre, validación en servidor, secretos sólo en backend.

---

## 3. Stack definitivo

### Backend

| Componente | Elección | Por qué |
|---|---|---|
| Lenguaje | **Python 3.12** | Pedido del proyecto. Runtime soportado por Vercel. |
| Framework web | **FastAPI** | Async, validación con Pydantic incluida, OpenAPI automática, ASGI nativo en Vercel. Más liviano que Flask para una API pura. |
| Validación | **Pydantic v2** | Esquemas de entrada y salida, errores claros, serialización rápida. |
| Acceso a datos | **SQLAlchemy 2.0** (Core + ORM) | Permite el mismo código contra SQLite y Postgres. Consultas parametrizadas por defecto. |
| Driver Postgres | **psycopg 3** (binary) | Driver recomendado para SQLAlchemy 2.0. |
| Migraciones | **Alembic** | Versionado del esquema, reversible. |
| Autenticación | **Supabase Auth** + verificación de JWT con JWKS (ES256) | No almacenamos hashes propios ni secretos de firma. Ver sección 8. |
| HTTP cliente | **httpx** | Para el proveedor de cotizaciones (async). |
| Fechas | **zoneinfo** (`America/Argentina/Buenos_Aires`) | Sin dependencias externas. |
| Testing | **pytest** + **pytest-asyncio** + **httpx.AsyncClient** | Tests de lógica y de endpoints. |
| Calidad | **ruff** (lint + format) + **mypy** (modo básico) | Un solo binario para lint y formato. |

### Frontend

| Componente | Elección | Por qué |
|---|---|---|
| Marcado | **HTML5**, una sola página con vistas | Igual que el mockup aprobado. Navegación por hash, sin recargas. |
| Estilos | **Tailwind CSS v4** + capa de tokens propia | Pedido del proyecto. Los tokens del mockup se registran en `@theme`. |
| Scripting | **JavaScript ES2022**, módulos nativos | Sin bundler obligatorio; el navegador importa los módulos. |
| Gráficos | **SVG propio** (código del mockup) | Ver sección 4.3. |
| Fuentes | **Outfit** + **Inter** (Google Fonts, `display=swap`, precarga) | Las del mockup aprobado. |
| PWA | **Web App Manifest** + **Service Worker** propio | Instalable en Android, cache offline. |
| Build | **Tailwind CLI** (único paso de build) | Genera un CSS; nada más que compilar. |
| Testing | **Playwright** | Pruebas de interfaz en móvil y escritorio. |

### Infraestructura

| Componente | Elección |
|---|---|
| Hosting del frontend | **Vercel** (estático con CDN) |
| Hosting de la API | **Vercel Python Serverless Functions** (`/api`), mismo proyecto y dominio |
| Base de datos | **Supabase Postgres** — un solo proyecto, dos esquemas (`public` y `dev`) |
| Autenticación | **Supabase Auth** (compartida entre esquemas) |
| Base de datos local de desarrollo | El esquema `dev` del mismo proyecto. **SQLite** sólo para los tests |
| Repositorio y CI | **GitHub** + integración de Vercel (preview por rama, producción en `main`) |
| Backups | Supabase (automáticos) + exportación manual desde la app |

---

## 4. Desviaciones respecto del documento general

Tres decisiones se apartan de lo propuesto en `01_Documento_General.md`. Quedan registradas con su motivo.

### 4.1 SQLite no es la base de producción

El documento general dice "se utilizará SQLite en la primera versión" (sección 31). La elección de infraestructura (Vercel + Supabase) lo impide: **las funciones serverless de Vercel tienen un sistema de archivos efímero y de sólo lectura**, así que un archivo SQLite no puede persistir entre invocaciones. La base de producción es **Postgres en Supabase**.

Qué se conserva:

- El **modelo de datos** de las secciones 31 a 43 del documento general se respeta tabla por tabla y campo por campo.
- **SQLAlchemy** abstrae el motor, así que el mismo código corre contra SQLite y Postgres.
- SQLite queda disponible para correr los tests rápido (`DATABASE_URL=sqlite+pysqlite:///./test.db`).

Riesgo conocido y cómo se mitiga: SQLite y Postgres no se comportan igual en tipos, `ON CONFLICT`, ordenamiento de texto y zonas horarias. Para evitar bugs que sólo aparecen en producción, **el desarrollo normal usa Postgres**, y SQLite se usa sólo para los tests unitarios. Los tests de integración corren contra Postgres.

### 4.1.1 Un solo proyecto de Supabase, dos esquemas

La cuenta de Supabase disponible admite **un único proyecto**, así que producción y desarrollo comparten instancia. La separación se hace con **esquemas de Postgres**, no con proyectos:

| Esquema | Para qué | Quién lo usa |
|---|---|---|
| `public` | Producción: los datos financieros reales | la rama `main` desplegada |
| `dev` | Desarrollo y previews: datos de prueba | la máquina local y las ramas de tarea |

Una sola variable, `DB_SCHEMA`, decide cuál se usa. Ventajas sobre usar SQLite en desarrollo: **mismo motor, misma versión, mismas extensiones y mismo comportamiento de RLS**, así que lo que funciona en desarrollo funciona en producción.

Qué implica, dicho sin vueltas:

- **Supabase Auth es única por proyecto**, así que los usuarios se comparten entre ambos esquemas. Con un solo usuario es irrelevante: el mismo login sirve para los dos.
- **La aislación es lógica, no física.** Un `DROP SCHEMA` mal dado o una migración apuntada al esquema equivocado sí puede tocar producción. Por eso `scripts/check_db.py` falla si `APP_ENV=development` apunta a `public`, y las migraciones exigen que el esquema esté declarado explícitamente.
- **Si el proyecto se pausa** por inactividad (el plan gratuito pausa a los 7 días sin uso), se pausan los dos entornos a la vez.
- El respaldo automático de Supabase cubre toda la instancia, los dos esquemas incluidos.

Cuando el proyecto justifique un segundo entorno aislado de verdad, migrar es crear un proyecto nuevo y correr las migraciones con `DB_SCHEMA=public`: no hay nada en el código atado a esta decisión más que esa variable.

### 4.2 Sin plantillas de servidor

El documento general proponía "componentes HTML reutilizables" servidos por el backend. Con Vercel el frontend se sirve estático desde el CDN y la API va aparte. Los componentes se componen **en el cliente** con funciones que devuelven HTML (exactamente como el mockup). Beneficio: el frontend carga desde el CDN sin arrancar una función Python.

### 4.3 Gráficos con SVG propio en lugar de Chart.js

El documento general propone Chart.js (sección 44). Se decide **mantener el SVG escrito a mano del mockup aprobado** porque:

- Ya está implementado y validado visualmente, incluido el gráfico combinado de barras con la línea de ahorro acumulado y doble eje, que en Chart.js requiere configuración de ejes múltiples y un plugin de tipos mixtos.
- Ahorra unos 70 KB comprimidos, relevante para el presupuesto de la sección 2.
- Hereda el tema claro/oscuro automáticamente porque usa variables CSS como color (`fill="var(--inc)"`), algo que Chart.js no hace sin redibujar.

La especificación completa de cada gráfico está en la sección 14.

---

## 5. Arquitectura

```text
┌───────────────────────────────────────────────────────────────┐
│  NAVEGADOR (Android / escritorio)                             │
│                                                               │
│  index.html  ·  app.css (Tailwind compilado)                  │
│  js/  main.js · router.js · api.js · state.js                 │
│        views/ (inicio, movimientos, historial, inversiones,   │
│                patrimonio, analisis, config)                  │
│        components/ (kpi, rows, charts, sheet, form, toast)    │
│  service-worker.js  ·  manifest.json                          │
└───────────────┬───────────────────────────────────────────────┘
                │ fetch + Authorization: Bearer <JWT>
                ▼
┌───────────────────────────────────────────────────────────────┐
│  VERCEL — misma URL, mismo dominio                            │
│                                                               │
│  /            → estáticos servidos por el CDN                 │
│  /api/*       → función Python (FastAPI, ASGI)                │
│                                                               │
│  ┌─ routers/   validan entrada y devuelven respuestas         │
│  ├─ services/  reglas de negocio y cálculos                   │
│  ├─ repos/     consultas SQLAlchemy                           │
│  └─ core/      config, seguridad, errores, dependencias       │
└───────────────┬───────────────────────────────────────────────┘
                │ psycopg 3 (pool) + verificación de JWT
                ▼
┌───────────────────────────────────────────────────────────────┐
│  SUPABASE                                                     │
│    Postgres  (tablas + RLS por usuario)                       │
│    Auth      (GoTrue: usuarios, contraseñas, JWT)             │
│    Backups   (automáticos del plan)                           │
└───────────────────────────────────────────────────────────────┘
                ▲
                │ httpx (programado o manual)
┌───────────────┴───────────────────────────────────────────────┐
│  PROVEEDOR DE COTIZACIONES (desacoplado, con fallback manual) │
└───────────────────────────────────────────────────────────────┘
```

### 5.1 Las cuatro capas del backend

Cada capa sólo conoce la de abajo. Esto es lo que permite probar la lógica sin base de datos y sin HTTP.

| Capa | Carpeta | Responsabilidad | Qué **no** hace |
|---|---|---|---|
| **Router** | `api/app/routers/` | Rutas, validación con Pydantic, códigos HTTP | No calcula ni consulta la base |
| **Service** | `api/app/services/` | Reglas de negocio, cálculos, validaciones cruzadas | No sabe de HTTP ni escribe SQL |
| **Repo** | `api/app/repos/` | Consultas SQLAlchemy, transacciones | No decide reglas de negocio |
| **Core** | `api/app/core/` | Configuración, JWT, errores, sesión de base | No contiene lógica financiera |

Regla práctica: **todo cálculo financiero es una función pura en `services/calc.py`** que recibe números y devuelve números. Así se testea sin base de datos, y es lo que se implementa primero en cada tarea del roadmap.

---

## 6. Modelo de datos

Implementa las secciones 31 a 43 del documento general. DDL para Postgres (Supabase). Los `CHECK` y `UNIQUE` son parte del contrato, no opcionales.

### 6.1 Convenciones

- Claves primarias `bigint generated always as identity`, salvo `profiles.id` que es `uuid` y referencia a `auth.users`.
- Importes en **`numeric(14,2)`**. Nunca `float`: los centavos no se redondean solos.
- Timestamps `timestamptz`, con `default now()`. La aplicación muestra en `America/Argentina/Buenos_Aires`.
- Todas las tablas de datos del usuario llevan `user_id uuid not null` para que RLS funcione.
- Nombres de tablas y columnas en inglés y `snake_case`; los textos visibles van en español en el frontend.
- Todas las tablas viven en el esquema que indica `DB_SCHEMA` (`public` en producción, `dev` en desarrollo). El DDL de abajo se aplica dentro de ese esquema; `auth.users` es siempre el de Supabase, compartido.

### 6.2 DDL

```sql
-- ============ PERFIL (extiende auth.users de Supabase) ============
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text not null unique,
  display_name  text,
  opening_balance numeric(14,2) not null default 0,   -- saldo inicial de ahorros
  timezone      text not null default 'America/Argentina/Buenos_Aires',
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  last_login_at timestamptz
);

-- ============ MESES ============
create table months (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references profiles(id) on delete cascade,
  year            int  not null check (year between 2000 and 2100),
  month           int  not null check (month between 1 and 12),
  status          text not null default 'open'
                  check (status in ('open','historical')),
  income_total    numeric(14,2) not null default 0,
  expense_total   numeric(14,2) not null default 0,
  saving_total    numeric(14,2) not null default 0,
  opening_balance numeric(14,2) not null default 0,
  closing_balance numeric(14,2) not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint months_unique_per_user unique (user_id, year, month)
);
create index months_user_period_idx on months (user_id, year desc, month desc);

-- ============ CATEGORÍAS ============
create table categories (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references profiles(id) on delete cascade,
  name        text not null,
  type        text not null check (type in ('income','expense')),
  active      boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint categories_unique_name_per_type unique (user_id, type, name)
);
create index categories_user_type_idx on categories (user_id, type, active, sort_order);

-- ============ MOVIMIENTOS (sólo meses transaccionales) ============
create table transactions (
  id               bigint generated always as identity primary key,
  user_id          uuid not null references profiles(id) on delete cascade,
  month_id         bigint not null references months(id) on delete cascade,
  category_id      bigint not null references categories(id) on delete restrict,
  transaction_date date not null,
  transaction_type text not null check (transaction_type in ('income','expense')),
  amount           numeric(14,2) not null check (amount > 0),
  description      text,
  source           text not null default 'manual'
                   check (source in ('manual','mercado_pago','system','import')),
  external_id      text,                      -- anti-duplicados de importaciones
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint transactions_external_unique unique (user_id, source, external_id)
);
create index transactions_month_idx    on transactions (user_id, month_id, transaction_date desc, id desc);
create index transactions_category_idx on transactions (user_id, category_id, transaction_date desc);
create index transactions_search_idx   on transactions (user_id, description);
```

El importe es siempre positivo y el signo lo decide `transaction_type` (sección 8.4 del documento general). El `CHECK (amount > 0)` lo garantiza a nivel de base, no sólo de formulario.

```sql
-- ============ TOTALES POR CATEGORÍA ============
-- Mes en curso: is_manual_summary = false, el total se recalcula desde transactions.
-- Mes histórico: is_manual_summary = true,  el total lo cargó el usuario a mano.
create table monthly_category_totals (
  id                bigint generated always as identity primary key,
  user_id           uuid not null references profiles(id) on delete cascade,
  month_id          bigint not null references months(id) on delete cascade,
  category_id       bigint not null references categories(id) on delete restrict,
  total_amount      numeric(14,2) not null default 0,
  is_manual_summary boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint mct_unique unique (month_id, category_id)
);
create index mct_month_idx on monthly_category_totals (user_id, month_id);

-- ============ HISTORIAL LABORAL ============
create table employment_history (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references profiles(id) on delete cascade,
  company        text not null,
  position       text not null,
  salary         numeric(14,2) not null check (salary >= 0),
  effective_date date not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index employment_user_date_idx on employment_history (user_id, effective_date desc);

-- ============ INVERSIONES (cartera actual, sin bitácora) ============
create table investments (
  id                bigint generated always as identity primary key,
  user_id           uuid not null references profiles(id) on delete cascade,
  symbol            text not null,
  name              text not null,
  investment_type   text not null check (investment_type in
                     ('obligacion_negociable','bono','cedear','accion','fci','otro')),
  nominal_quantity  numeric(18,4) not null default 0 check (nominal_quantity >= 0),
  initial_value     numeric(14,2) not null default 0 check (initial_value >= 0),
  current_unit_price numeric(18,6),           -- null = se valúa por valor manual
  current_value     numeric(14,2) not null default 0,
  valuation_mode    text not null default 'unit_price'
                    check (valuation_mode in ('unit_price','manual')),
  price_source      text,
  price_updated_at  timestamptz,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index investments_user_idx on investments (user_id, active, symbol);

-- ============ CACHE DE COTIZACIONES (no son operaciones) ============
create table investment_price_cache (
  id           bigint generated always as identity primary key,
  symbol       text not null,
  unit_price   numeric(18,6) not null,
  source       text not null,
  as_of        timestamptz not null,
  fetched_at   timestamptz not null default now(),
  raw_payload  jsonb,
  constraint price_cache_unique unique (symbol, source, as_of)
);
create index price_cache_symbol_idx on investment_price_cache (symbol, as_of desc);

-- ============ ALERTAS ============
create table alerts (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references profiles(id) on delete cascade,
  alert_type   text not null,
  title        text not null,
  message      text not null,
  severity     text not null default 'info'
               check (severity in ('info','warning','pending','critical')),
  context      jsonb,                         -- mes, categoría, importes que la originaron
  created_at   timestamptz not null default now(),
  read_at      timestamptz,
  dismissed_at timestamptz
);
create index alerts_user_open_idx on alerts (user_id, dismissed_at, created_at desc);

-- ============ PREFERENCIAS ============
create table app_settings (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references profiles(id) on delete cascade,
  key        text not null,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  constraint app_settings_unique unique (user_id, key)
);

-- ============ PASIVOS (preparado, no se usa en el MVP) ============
create table liabilities (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references profiles(id) on delete cascade,
  name        text not null,
  amount      numeric(14,2) not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
```

La tabla `liabilities` se crea vacía y no se muestra en la interfaz. El cálculo de patrimonio ya la resta (siempre 0), así que incorporar pasivos más adelante no requiere migrar nada ni rehacer el cálculo.

### 6.3 Reglas garantizadas por la base

| Regla del documento general | Cómo se garantiza |
|---|---|
| R1 — Un mes por año/mes | `unique (user_id, year, month)` |
| Importe siempre positivo (8.4) | `check (amount > 0)` |
| Categoría de ingreso no sirve para egresos (34) | Validación en service: `category.type == transaction_type`, más el test correspondiente |
| No duplicar nombre de categoría en el mismo tipo (51) | `unique (user_id, type, name)` |
| No borrar categoría con histórico (7) | `on delete restrict` en `transactions` y `monthly_category_totals` |
| Anti-duplicados de importación (62) | `unique (user_id, source, external_id)` |
| R12 — Contraseñas nunca en texto plano | No almacenamos contraseñas: las gestiona Supabase Auth |

### 6.4 Trigger de `updated_at`

```sql
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- aplicar a cada tabla con updated_at
create trigger trg_touch before update on transactions
  for each row execute function set_updated_at();
-- (ídem: profiles, months, categories, monthly_category_totals,
--        employment_history, investments, liabilities)
```

### 6.5 Row Level Security

RLS se activa en **todas** las tablas de datos de usuario. Es la red de seguridad que hace imposible leer datos de otro usuario incluso si un endpoint tuviera un bug de filtrado.

```sql
alter table profiles                 enable row level security;
alter table months                   enable row level security;
alter table categories                enable row level security;
alter table transactions              enable row level security;
alter table monthly_category_totals   enable row level security;
alter table employment_history        enable row level security;
alter table investments               enable row level security;
alter table alerts                    enable row level security;
alter table app_settings              enable row level security;
alter table liabilities               enable row level security;

-- patrón aplicado a cada tabla (ejemplo con transactions)
create policy own_rows_select on transactions for select using (user_id = auth.uid());
create policy own_rows_insert on transactions for insert with check (user_id = auth.uid());
create policy own_rows_update on transactions for update using (user_id = auth.uid());
create policy own_rows_delete on transactions for delete using (user_id = auth.uid());

-- profiles usa id en lugar de user_id
create policy own_profile on profiles for all using (id = auth.uid()) with check (id = auth.uid());
```

`investment_price_cache` no lleva `user_id` (las cotizaciones son públicas): queda con RLS activo y sin política de escritura, accesible sólo por el backend con la clave de servicio.

### 6.6 Las dos naturalezas de mes

Es **la decisión estructural más importante del proyecto** (sección 71 del documento general). Se resuelve en un único lugar del backend.

| | Mes en curso (`status = 'open'`) | Mes histórico (`status = 'historical'`) |
|---|---|---|
| Origen de los totales | `SUM(transactions.amount)` por tipo | Campos `income_total` / `expense_total` del mes |
| Totales por categoría | Recalculados desde `transactions` | `monthly_category_totals` con `is_manual_summary = true` |
| Movimientos individuales | Sí | **No existen y no se inventan** (R4) |
| Qué devuelve la API | `transactions: [...]` | `transactions: null` |
| Editable | Sí | Sí (sección 6.3 del general: se puede corregir un error) |

El contrato de API es explícito: **`transactions: null` significa "este mes no tiene movimientos individuales"**, distinto de `transactions: []` que sería "los tiene pero están vacíos". El frontend usa esa diferencia para mostrar el mensaje de mes consolidado en lugar de una lista vacía.

---

## 7. Cálculos

Todos viven en `api/app/services/calc.py` como **funciones puras** sin acceso a base de datos. Esto permite testearlos antes de que exista cualquier endpoint, que es el primer paso de cada tarea del roadmap.

```python
# api/app/services/calc.py
from decimal import Decimal, ROUND_HALF_UP

CENT = Decimal("0.01")
def money(v: Decimal) -> Decimal:
    """Redondeo contable a dos decimales."""
    return Decimal(v).quantize(CENT, rounding=ROUND_HALF_UP)

def monthly_saving(income: Decimal, expense: Decimal) -> Decimal:
    return money(income - expense)

def saving_rate(income: Decimal, saving: Decimal) -> Decimal | None:
    """None cuando los ingresos son cero: se muestra N/A, no 0%."""
    if income == 0:
        return None
    return money(saving / income * 100)

def accumulated_balance(opening: Decimal, savings: list[Decimal]) -> Decimal:
    return money(opening + sum(savings, Decimal(0)))

def investment_value(mode: str, nominal: Decimal,
                     unit_price: Decimal | None, manual_value: Decimal) -> Decimal:
    if mode == "unit_price" and unit_price is not None:
        return money(nominal * unit_price)
    return money(manual_value)

def investment_return(current: Decimal, initial: Decimal) -> Decimal:
    return money(current - initial)

def investment_return_pct(current: Decimal, initial: Decimal) -> Decimal | None:
    """None cuando el valor inicial es cero: el porcentaje no se calcula."""
    if initial == 0:
        return None
    return money((current / initial - 1) * 100)

def net_worth(savings: Decimal, investments: Decimal,
              other_assets: Decimal = Decimal(0),
              liabilities: Decimal = Decimal(0)) -> Decimal:
    return money(savings + investments + other_assets - liabilities)

def daily_saving_series(income_by_day: list[Decimal],
                        expense_by_day: list[Decimal]) -> list[Decimal]:
    """Ahorro del mes acumulado día por día: sube con los ingresos y
    baja con cada gasto. Alimenta la línea del gráfico diario."""
    out, acc = [], Decimal(0)
    for inc, exp in zip(income_by_day, expense_by_day):
        acc += inc - exp
        out.append(money(acc))
    return out
```

### 7.1 Casos borde de obligado cumplimiento

| Caso | Resultado esperado |
|---|---|
| Ingresos = 0 al pedir la tasa de ahorro | `null` → la interfaz muestra `N/A`, nunca `0%` ni división por cero |
| Valor inicial = 0 al pedir rendimiento % | `null` → se muestra `—` |
| Mes sin ningún movimiento | Totales en 0, ahorro 0, y se genera la alerta "mes sin cargar" |
| Ahorro negativo (gasté más de lo que ingresé) | Se muestra con signo menos; es un resultado válido, no un error |
| Mes histórico al pedir el gráfico diario | La API no devuelve serie diaria; el frontend muestra el mensaje de mes consolidado |
| Suma de categorías ≠ total de egresos en carga histórica | Advertencia con el texto exacto del documento general; el usuario puede corregir o guardar igual |

### 7.2 Recálculo del mes

Cada alta, edición o baja de movimiento dispara `recalculate_month(month_id)`, **dentro de la misma transacción de base de datos**:

1. Recalcular `income_total`, `expense_total` y `saving_total` desde `transactions`.
2. Regenerar `monthly_category_totals` del mes (sólo filas con `is_manual_summary = false`).
3. Recalcular `closing_balance` del mes y de **todos los meses posteriores** en cadena, porque el saldo acumulado es una suma corrida.
4. Reevaluar las alertas que dependan de ese mes.

Si cualquier paso falla, la transacción se revierte entera: no puede quedar un movimiento guardado con totales viejos.

### 7.3 Compra y venta de inversiones

Regla 7 del documento general: comprar **no es un gasto de consumo**, es una transferencia patrimonial. El patrimonio neto no cambia por el hecho de comprar.

```text
Comprar $500.000:   ahorro líquido −500.000   ·   cartera +500.000   ·   patrimonio igual
Vender  $1.200.000: cartera −1.200.000        ·   ahorro +1.200.000  ·   patrimonio igual
```

Implementación: la operación genera un movimiento con `source = 'system'` y una categoría de tipo transferencia marcada como **excluida del gasto de consumo**, de modo que no aparezca en el desglose de egresos ni infle el gráfico de gastos. El endpoint es uno solo y hace las dos puntas en una transacción, para que el usuario no tenga que cargar nada dos veces y no se descuente el importe por duplicado (sección 23 del general).
---

## 8. Cuentas de usuario, autenticación y sesión

### 8.1 Decisión

Se usa **Supabase Auth** con email y contraseña. El backend **no almacena contraseñas ni hashes**: los gestiona Supabase (bcrypt). Esto cumple la Regla 12 del documento general de la forma más segura posible y nos da hecho el registro, la confirmación de email, la recuperación de contraseña y la rotación de tokens, que de otro modo habría que construir y mantener.

Alternativa descartada: autenticación propia con `passlib[argon2]`, sesión en cookie firmada y envío de mails propio. Más control, pero mucha más superficie de ataque propia y bastante código para un beneficio nulo en este proyecto. **Si en algún momento se quiere migrar a auth propia**, el cambio queda contenido en `core/security.py`, la tabla `profiles` y los tres módulos de frontend de la sección 8.7.

### 8.2 La aplicación es multiusuario

El documento general plantea "1 usuario, con posibilidad de ampliar a pocos usuarios autenticados". Esa posibilidad **se construye desde el MVP**, no se deja para después:

- **Cualquiera puede registrarse** desde la pantalla de registro.
- **Cada cuenta es un mundo aparte**: sus meses, categorías, movimientos, inversiones, historial laboral, alertas y preferencias. Nadie ve los datos de nadie.
- El aislamiento no depende de que los endpoints filtren bien: **Row Level Security** lo garantiza a nivel de base (§6.5). Aunque un endpoint tuviera un bug, Postgres no devolvería filas de otro usuario.

Esto no agrega complejidad al modelo de datos porque **ya estaba previsto**: todas las tablas llevan `user_id` desde el primer día (§6.1). Lo que se agrega es el ciclo de vida de la cuenta: registro, confirmación, recuperación y cambio de contraseña.

### 8.3 Ciclo de vida de una cuenta

```text
REGISTRO
  pantalla de registro (email + contraseña + repetir)
     ↓  supabase.auth.signUp()
  Supabase crea la fila en auth.users con email_confirmed_at = null
     ↓  envía mail de confirmación
  el usuario abre el enlace del mail
     ↓  vuelve a la app con la sesión iniciada
  el trigger de Postgres ya creó su profile y sus 21 categorías
     ↓
  dashboard de su mes actual, vacío y listo para cargar

INICIO DE SESIÓN
  email + contraseña  →  signInWithPassword()  →  access_token + refresh_token

RECUPERACIÓN DE CONTRASEÑA
  pantalla "olvidé mi contraseña" (email)
     ↓  supabase.auth.resetPasswordForEmail(email, { redirectTo })
  Supabase envía el mail con un enlace de un solo uso
     ↓  el usuario abre el enlace → vuelve a /#/nueva-clave con una sesión temporal
  pantalla de contraseña nueva (contraseña + repetir)
     ↓  supabase.auth.updateUser({ password })
  sesión completa, al dashboard

CAMBIO DE CONTRASEÑA ESTANDO ADENTRO
  configuración → contraseña actual + nueva  →  updateUser({ password })
```

### 8.4 Creación automática del perfil y las categorías

Cuando nace una cuenta hay que darle su fila en `profiles` y sus 21 categorías iniciales (las del documento general §7.1 y §7.2). Se hace con un **trigger en Postgres sobre `auth.users`**, no desde el backend.

Por qué el trigger y no el backend: el registro ocurre contra Supabase directamente, sin pasar por nuestra API. Si el perfil se creara en el primer acceso a `/api/...`, una cuenta podría existir sin perfil en el medio, y habría que manejar ese estado en todos los endpoints. El trigger lo vuelve imposible.

```sql
-- Se aplica en el esquema que corresponda (dev o public).
create or replace function crear_perfil_y_categorias()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  nuevas_categorias text[][] := array[
    -- ingresos
    array['Sueldo','income'], array['Aguinaldo','income'], array['Otros','income'],
    -- egresos
    array['Alquiler','expense'], array['Expensas','expense'], array['Cochera','expense'],
    array['ABL','expense'], array['Gas','expense'], array['Luz','expense'],
    array['Internet','expense'], array['Da Vinci','expense'], array['Tarjeta','expense'],
    array['Tuenti','expense'], array['Nafta','expense'], array['Subte','expense'],
    array['Mercadería','expense'], array['Verdulería','expense'],
    array['Carnicería / Pollería','expense'], array['Delivery / Salida','expense'],
    array['Comida Trabajo','expense'], array['Otros','expense']
  ];
  fila text[];
  orden int := 0;
begin
  insert into dev.profiles (id, username, display_name)
  values (
    new.id,
    split_part(new.email, '@', 1),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );

  foreach fila slice 1 in array nuevas_categorias loop
    orden := orden + 1;
    insert into dev.categories (user_id, name, type, sort_order)
    values (new.id, fila[1], fila[2], orden);
  end loop;

  return new;
end $$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function crear_perfil_y_categorias();
```

Tres detalles que importan: `security definer` para que el trigger pueda escribir saltando RLS; `set search_path = ''` para que no sea vulnerable a una tabla intrusa en otro esquema; y `username` derivado del email, con `display_name` editable después. El trigger es **idempotente en la práctica** porque `auth.users` sólo dispara un `insert` por cuenta.

### 8.5 Envío de mails: hace falta un SMTP propio

**Esto es un requisito, no una mejora.** El servicio de mail que Supabase trae de fábrica está pensado sólo para pruebas: limita a unos pocos mails por hora y los manda desde un dominio compartido que suele caer en spam. Con eso, la recuperación de contraseña **no funciona en la práctica**.

Hay que configurar un **SMTP propio** en Supabase (Project Settings → Authentication → SMTP Settings). Opciones gratuitas suficientes para este proyecto:

| Proveedor | Plan gratuito | Nota |
|---|---|---|
| **Resend** | 3.000 mails/mes, 100/día | El más simple de configurar; requiere verificar un dominio o usar su subdominio de pruebas |
| Brevo | 300 mails/día | No pide dominio propio |
| Mailgun | 100 mails/día | Pide tarjeta |

Para un proyecto de un puñado de usuarios, cualquiera alcanza de sobra. **Mientras no esté configurado**, el registro y la recuperación funcionan pero los mails pueden no llegar: la interfaz tiene que decirlo con claridad en lugar de quedarse esperando.

También hay que personalizar las **plantillas de mail** (Authentication → Email Templates) para que digan "Epic Wallet" y estén en español: por defecto llegan en inglés y con el nombre del proyecto de Supabase.

### 8.6 URLs de redirección

Los enlaces de confirmación y de recuperación vuelven a la aplicación, así que Supabase necesita saber a dónde puede redirigir (Authentication → URL Configuration):

| Campo | Valor |
|---|---|
| Site URL | `https://<dominio-de-produccion>` |
| Redirect URLs | `https://<dominio-de-produccion>/**`, `https://*.vercel.app/**` (para las previews), `http://localhost:3000/**` |

Sin esas URLs declaradas, el enlace del mail falla con *"requested path is invalid"*. Es el error más común de esta parte.

### 8.7 Flujo técnico de la sesión

```text
1. El usuario carga index.html (estático, desde el CDN).
2. Ingresa email y contraseña.
3. El frontend llama a Supabase Auth directamente (supabase-js, sólo el módulo de auth).
4. Supabase devuelve access_token (JWT, ~1 h) y refresh_token.
5. El frontend guarda la sesión y la renueva sola antes de que expire.
6. Cada llamada a /api/* envía: Authorization: Bearer <access_token>
7. El backend verifica la firma del JWT y extrae el user_id (claim "sub").
8. El backend abre la conexión a Postgres propagando ese token, así RLS filtra por auth.uid().
```

El frontend suma tres módulos a los de la sección 10: `auth.js` (sesión), y las vistas `registro`, `recuperar` y `nueva-clave`.

### 8.8 Verificación del JWT en el backend

**El proyecto firma con claves asimétricas.** Verificado contra el proyecto real en F00-T06: los tokens vienen con `alg: ES256` y la clave pública se publica en un endpoint JWKS. **No hay secreto compartido que sirva**: `SUPABASE_JWT_SECRET` queda como resto de la configuración y no se usa para verificar.

| Dato | Valor comprobado |
|---|---|
| Algoritmo | `ES256` (ECDSA sobre la curva P-256) |
| Endpoint JWKS | `{SUPABASE_URL}/auth/v1/.well-known/jwks.json` |
| Claves publicadas | 1 · `kty: EC`, `crv: P-256`, `use: sig` |
| Audiencia | `authenticated` |
| Vigencia | 3600 s |

Esto obliga a `PyJWT[crypto]`: sin el extra `crypto` (que trae `cryptography`), PyJWT falla con `MissingCryptographyError` al intentar ES256.

```python
# api/app/core/security.py
import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .config import settings

bearer = HTTPBearer(auto_error=False)

# Un solo cliente para todo el proceso: cachea las claves del JWKS y
# evita ir a buscarlas en cada petición.
_jwks = PyJWKClient(
    f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json",
    cache_keys=True,
    lifespan=3600,
)

async def current_user_id(
    cred: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> str:
    if cred is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sesión requerida")
    try:
        clave = _jwks.get_signing_key_from_jwt(cred.credentials)
        payload = jwt.decode(
            cred.credentials,
            clave.key,
            algorithms=["ES256"],
            audience="authenticated",
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sesión expirada")
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sesión inválida")
    return payload["sub"]
```

Todas las rutas bajo `/api` dependen de `current_user_id`. **No existe endpoint de datos sin autenticación.** Lo único público es `/api/health`.

Dos consecuencias prácticas de usar JWKS:

1. **El arranque en frío de la función tiene que buscar las claves.** Es una petición HTTPS contra Supabase la primera vez; después queda cacheada en el proceso. Si alguna vez molesta, las claves pueden precargarse al iniciar la aplicación.
2. **Si Supabase rota la clave**, el cliente la vuelve a buscar por el `kid` del token. No hay que hacer nada, pero conviene que el caché tenga vencimiento (de ahí el `lifespan`).

Ventaja sobre el secreto compartido: el backend sólo necesita la **clave pública**. Aunque se filtrara la configuración del servidor, nadie podría fabricar un token válido.

### 8.9 Reglas de contraseña

Supabase valida el mínimo del lado del servidor; la interfaz lo refuerza para dar una respuesta inmediata:

- Mínimo **8 caracteres** (se configura en Authentication → Policies).
- Se muestra un medidor de fortaleza orientativo, nunca bloqueante más allá del mínimo.
- El campo tiene **botón de mostrar y ocultar**: escribir una contraseña a ciegas en un teléfono es la principal causa de errores de tipeo.
- En el registro se pide **repetir** la contraseña; en el login, no.
- Nunca se dice si un email existe o no: ante un email desconocido, la recuperación responde lo mismo que ante uno válido ("si la dirección existe, te llega un mail"). Evita que se pueda averiguar quién tiene cuenta.

### 8.10 Protección contra abuso

Al haber registro abierto, hay que acotar el abuso:

- Supabase ya limita los intentos de login y los envíos de mail por dirección IP.
- `scripts/` incluye una consulta para revisar cuentas creadas y sin confirmar, por si hiciera falta limpiar.
- Si en algún momento se quiere **cerrar el registro**, se desactiva en Authentication → Providers → Email → *Allow new users to sign up*, y el frontend oculta el enlace. Es un interruptor, no un cambio de código.

### 8.11 Dónde se guarda la sesión en el cliente

`localStorage` gestionado por `supabase-js`. Se evalúa la alternativa de cookie `HttpOnly` (más resistente a XSS) y se descarta para el MVP porque requiere un endpoint proxy de login en el backend. Como compensación se aplican las mitigaciones de XSS de la sección 17: Content Security Policy estricta y cero `innerHTML` con datos sin escapar.

---

## 9. API REST

Base: `/api`. JSON en todo. Fechas en ISO 8601 (`2026-10-03`). Importes como **string decimal** (`"42000.00"`) para no perder precisión en JavaScript; el frontend los convierte con un helper único.

### 9.1 Endpoints

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/api/health` | Estado del servicio, esquema activo y conectividad con la base. Público. |
| `GET` | `/api/me` | Perfil, saldo inicial, preferencias. |
| `PATCH` | `/api/me` | Actualizar nombre visible y saldo inicial. |
| `POST` | `/api/me/bootstrap` | Red de seguridad: crea el perfil y las 21 categorías si el trigger no corrió. Idempotente. |
| `GET` | `/api/dashboard?year&month` | **Respuesta única del dashboard** (ver 9.2). |
| `GET` | `/api/months` | Lista de meses con sus totales y saldo acumulado. |
| `GET` | `/api/months/{id}` | Detalle de un mes con totales por categoría. |
| `POST` | `/api/months/historical` | Crear o actualizar un mes histórico consolidado. |
| `PATCH` | `/api/months/{id}` | Corregir un mes histórico. |
| `GET` | `/api/transactions` | Filtros: `year`, `month`, `type`, `category_id`, `date_from`, `date_to`, `q`, `limit`, `offset`. |
| `POST` | `/api/transactions` | Alta. Recalcula el mes. |
| `PUT` | `/api/transactions/{id}` | Edición. Recalcula el mes. |
| `DELETE` | `/api/transactions/{id}` | Baja. Recalcula el mes. |
| `GET` | `/api/categories` | Lista con filtro `type` y `active`. |
| `POST` | `/api/categories` | Alta. |
| `PUT` | `/api/categories/{id}` | Edición, activar y desactivar. |
| `PATCH` | `/api/categories/reorder` | Reordenamiento por lote. |
| `GET` | `/api/investments` | Cartera con totales y rendimientos. |
| `POST` | `/api/investments` | Alta de posición. Opcional: descuenta del ahorro. |
| `PUT` | `/api/investments/{id}` | Edición y actualización manual de valor. |
| `DELETE` | `/api/investments/{id}` | Venta. Opcional: devuelve el importe al ahorro. |
| `POST` | `/api/investments/refresh-prices` | Actualiza cotizaciones. Devuelve qué se actualizó y qué falló. |
| `GET` | `/api/employment` | Historial salarial con variaciones calculadas. |
| `POST` | `/api/employment` | Alta de registro laboral. |
| `PUT` | `/api/employment/{id}` | Edición. |
| `DELETE` | `/api/employment/{id}` | Baja. |
| `GET` | `/api/patrimony` | Ahorros, inversiones, pasivos, patrimonio neto y composición. |
| `GET` | `/api/analytics` | Métricas históricas de la sección 53 del general. |
| `GET` | `/api/alerts` | Alertas no descartadas. |
| `POST` | `/api/alerts/evaluate` | Reevalúa y genera alertas. |
| `POST` | `/api/alerts/{id}/read` | Marcar leída. |
| `POST` | `/api/alerts/{id}/dismiss` | Descartar. |
| `GET` | `/api/export?format=json\|csv` | Exportación de respaldo. |
| `GET` | `/api/settings` · `PUT` | Preferencias. |

### 9.2 `GET /api/dashboard` — el contrato central

Una sola llamada alimenta todo el dashboard. Evita seis peticiones en el arranque, que en 4G es la diferencia entre rápido y lento.

```jsonc
{
  "month": {
    "id": 7, "year": 2026, "month": 10,
    "label": "Octubre 2026",
    "status": "open",                    // "open" | "historical"
    "consolidated": false,
    "income_total": "3541280.00",
    "expense_total": "2419425.00",
    "saving_total": "1121855.00",
    "saving_rate": "31.7",               // null si income_total = 0
    "is_current": true
  },
  "navigation": {
    "previous": { "year": 2026, "month": 9 },
    "next": null,                        // null = no hay mes siguiente cargable
    "current": { "year": 2026, "month": 10 }
  },
  "indicators": {
    "income": "3541280.00",
    "expense": "2419425.00",
    "saving": "1121855.00",
    "savings_balance": "8649377.00",
    "investments_value": "37714543.00",
    "net_worth": "46363920.00",
    "vs_previous": { "income": "1.4", "expense": "-16.6", "saving": "90.6" }
  },
  "daily": {                             // null cuando el mes es histórico
    "days": 24,
    "income":  ["3491280.00", "0.00", "..."],
    "expense": ["763400.00", "78200.00", "..."],
    "saving_cumulative": ["2727880.00", "2649680.00", "..."],
    "peak_expense": { "day": 10, "amount": "311225.00" },
    "days_without_expense": 0
  },
  "last_six_months": [
    { "year": 2026, "month": 5, "label": "Junio 2026",
      "income": "4988971.00", "expense": "2690300.00",
      "saving": "2298671.00", "saving_rate": "46.1" }
  ],
  "categories": [
    { "category_id": 10, "name": "Alquiler", "type": "expense",
      "total": "553000.00", "share": "22.9",
      "transaction_count": 1, "last_date": "2026-10-01" }
  ],
  "recent_transactions": [               // null cuando el mes es histórico
    { "id": 148, "date": "2026-10-24", "type": "expense",
      "category_id": 22, "category_name": "Mercadería",
      "amount": "27600.00", "description": "Mercadería", "source": "manual" }
  ],
  "alerts": [
    { "id": 3, "type": "category_above_average", "severity": "warning",
      "title": "Mercadería sobre el promedio",
      "message": "Este mes llevás ..." }
  ]
}
```

`daily.saving_cumulative` es la serie que dibuja **la línea de ahorro sobre el gráfico de barras**, el cambio que pediste sobre el mockup.

Lo que **no** es un endpoint nuestro: registro, confirmación de email, recuperación y cambio de contraseña los atiende **Supabase Auth directamente desde el navegador** (§8.3). No hay un `POST /api/register` ni un `POST /api/forgot-password`: pasar esas operaciones por nuestra API sólo agregaría un intermediario sin aportar nada, y nos obligaría a manejar los mails.

### 9.3 Formato de errores

Uniforme en toda la API, para que el frontend tenga un único camino de manejo:

```jsonc
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "La suma de las categorías no coincide con el total de egresos.",
    "details": [
      { "field": "categories", "expected": "2419425.00", "received": "2401225.00" }
    ]
  }
}
```

| HTTP | `code` | Cuándo |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Datos mal formados o reglas de negocio violadas |
| 401 | `UNAUTHENTICATED` | Falta el token, está vencido o es inválido |
| 403 | `FORBIDDEN` | El recurso existe pero no es del usuario |
| 404 | `NOT_FOUND` | No existe |
| 409 | `CONFLICT` | Mes duplicado, nombre de categoría repetido |
| 422 | `UNPROCESSABLE` | Error de esquema de Pydantic |
| 502 | `UPSTREAM_ERROR` | Falló el proveedor de cotizaciones |
| 500 | `INTERNAL_ERROR` | Lo inesperado. Nunca expone stack trace al cliente. |

### 9.4 Validaciones de entrada

| Entidad | Reglas |
|---|---|
| Movimiento | `amount > 0`; `category_id` existe, está activa y su `type` coincide con `transaction_type`; `transaction_date` válida y dentro del mes indicado; `description` ≤ 500 caracteres |
| Mes histórico | `year`/`month` válidos y no futuros; totales ≥ 0; si vienen categorías, su suma se compara con el total de egresos y se advierte la diferencia |
| Categoría | `name` obligatorio, 1–60 caracteres, único por tipo; `type` ∈ {income, expense} |
| Inversión | `symbol` y `name` obligatorios; `investment_type` del enum; `nominal_quantity ≥ 0`; `initial_value ≥ 0`; si `valuation_mode = unit_price` entonces `current_unit_price` es obligatorio |
| Registro laboral | `company`, `position`, `salary ≥ 0`, `effective_date` válida |

No se permite seleccionar un mes futuro que todavía no exista (sección 12.1 del general): `navigation.next` llega en `null` y el botón se deshabilita.

### 9.5 Proveedor de cotizaciones

Interfaz desacoplada, tal como pide la sección 25 del documento general. Nunca se depende de una sola fuente.

```python
# api/app/services/prices/base.py
from typing import Protocol
from decimal import Decimal
from datetime import datetime

class Quote(TypedDict):
    symbol: str
    unit_price: Decimal
    as_of: datetime
    source: str

class InvestmentPriceProvider(Protocol):
    name: str
    async def get_quotes(self, symbols: list[str]) -> dict[str, Quote]: ...
```

Implementaciones, en orden de intento: `ByMaProvider` → `PublicProvider` → `ManualProvider` (que no consulta nada y deja el valor como está). El orquestador recorre la cadena, cachea en `investment_price_cache`, y **por cada símbolo que no se pudo actualizar genera una alerta** `investment_price_stale`. Nunca falla toda la operación por un símbolo: devuelve `{"updated": [...], "failed": [...]}`.

Advertencia registrada: según su documentación, las APIs de Market Data de BYMA están disponibles para personas jurídicas. **No se asume acceso**: la arquitectura trata la actualización automática como un extra y la carga manual como el camino garantizado.

### 9.6 Límite de frecuencia

No se requiere tiempo real (sección 26). El endpoint de refresco tiene un límite de **una ejecución cada 15 minutos por usuario**, y la interfaz muestra la fecha de última actualización. Así se evita consumir cuota sin necesidad.

---

## 10. Estructura del repositorio

```text
epic-wallet/
├── api/                              # backend (función serverless en Vercel)
│   ├── index.py                      # punto de entrada: expone `app`
│   └── app/
│       ├── main.py                   # creación de FastAPI, middlewares, errores
│       ├── core/
│       │   ├── config.py             # Settings con pydantic-settings
│       │   ├── db.py                 # engine, sesión, propagación del JWT
│       │   ├── security.py           # verificación del JWT
│       │   └── errors.py             # excepciones y handlers
│       ├── models/                   # modelos SQLAlchemy
│       ├── schemas/                  # esquemas Pydantic (entrada/salida)
│       ├── repos/                    # consultas
│       ├── services/
│       │   ├── calc.py               # cálculos puros
│       │   ├── months.py             # recálculo y cierre
│       │   ├── dashboard.py          # armado de la respuesta del dashboard
│       │   ├── investments.py
│       │   ├── analytics.py
│       │   ├── alerts.py
│       │   └── prices/               # proveedores de cotización
│       └── routers/                  # un archivo por recurso
├── web/                              # frontend estático
│   ├── index.html
│   ├── manifest.json
│   ├── service-worker.js
│   ├── icons/
│   ├── src/
│   │   ├── styles/
│   │   │   ├── tokens.css            # tokens del mockup (@theme)
│   │   │   ├── base.css              # fondo, ruido, tipografía
│   │   │   └── components.css        # .shell, .cg, .kpi, .row, .sheet…
│   │   ├── app.css                   # entrada de Tailwind
│   │   └── js/
│   │       ├── main.js               # arranque
│   │       ├── router.js             # navegación por hash
│   │       ├── api.js               # cliente HTTP + manejo de errores
│   │       ├── auth.js               # Supabase Auth
│   │       ├── state.js              # estado y caché en memoria
│   │       ├── format.js             # fmt, fmtK, pct, fechas
│   │       ├── charts/               # daily, six, categories, line, stack
│   │       ├── components/
│   │       └── views/               # login, registro, recuperar, nueva-clave,
│   │                                # inicio, movimientos, historial,
│   │                                # inversiones, patrimonio, analisis, config
│   └── public/                       # CSS compilado y assets
├── migrations/                       # Alembic
├── scripts/
│   ├── seed_categories.py            # categorías iniciales del general
│   ├── seed_demo.py                  # datos de demostración
│   └── load_history.py               # carga asistida de meses históricos
├── tests/
│   ├── unit/                         # calc.py y servicios
│   ├── api/                          # endpoints
│   └── e2e/                          # Playwright
├── docs/                             # documentación por fase (ver roadmap)
├── .env.example
├── package.json                      # Tailwind CLI y scripts
├── pyproject.toml                    # dependencias y config de ruff/mypy
└── vercel.json
```

---

## 11. Configuración y variables de entorno

```ini
# .env.example
# --- Base de datos ---
DATABASE_URL=postgresql+psycopg://postgres.xxxx:PASS@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
DB_SCHEMA=dev                            # dev | public — ver §4.1.1
# sólo para los tests:
# DATABASE_URL=sqlite+pysqlite:///./test.db
# DB_SCHEMA=main

# --- Supabase ---
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...                 # pública, va al frontend
SUPABASE_SERVICE_ROLE_KEY=eyJ...         # SECRETA, sólo backend
SUPABASE_JWT_SECRET=...                  # SECRETA, verifica firmas

# --- Autenticación ---
# URL pública de la app, para armar los enlaces de los mails de
# confirmación y de recuperación de contraseña (§8.6).
PUBLIC_APP_URL=https://epic-wallet.vercel.app

# --- Aplicación ---
APP_ENV=production                       # development | preview | production
APP_TIMEZONE=America/Argentina/Buenos_Aires
ALLOWED_ORIGINS=https://epic-wallet.vercel.app
PRICE_PROVIDER_ORDER=byma,public,manual
PRICE_REFRESH_COOLDOWN_MINUTES=15
LOG_LEVEL=INFO
```

Reglas no negociables:

- `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_JWT_SECRET` **nunca** llegan al navegador ni se escriben en el repositorio.
- El frontend sólo conoce `SUPABASE_URL` y `SUPABASE_ANON_KEY`, inyectadas en el build.
- Se usa el **pooler** de Supabase (puerto 6543, modo transaction) porque las funciones serverless abren y cierran conexiones constantemente y agotarían el límite de conexiones directas.
- `DB_SCHEMA` **nunca** es `public` cuando `APP_ENV=development`: sería trabajar contra los datos reales. `scripts/check_db.py` lo verifica y falla si ocurre.

---

## 12. Frontend

### 12.1 Una página, siete vistas

Igual que el mockup: un solo `index.html` con siete `<section class="view">`, de las cuales una está activa. La navegación cambia el hash (`#/inicio`, `#/movimientos`, …), lo que da historial del navegador y botón "atrás" sin recargar.

```javascript
// web/src/js/router.js
// Rutas públicas (sin sesión) y privadas (con sesión).
const PUBLICAS = ['login','registro','recuperar','nueva-clave'];
const PRIVADAS = ['inicio','movimientos','historial','inversiones',
                  'patrimonio','analisis','config'];
const routes = [...PUBLICAS, ...PRIVADAS];

export function navigate(id, { replace = false } = {}) {
  if (!routes.includes(id)) id = 'inicio';
  const url = `#/${id}`;
  replace ? history.replaceState(null,'',url) : history.pushState(null,'',url);
  render(id);
}

window.addEventListener('popstate', () => render(currentRoute()));
```

### 12.2 Estado y caché

Objeto único en memoria, sin librería. El dashboard se cachea por mes para que volver a un mes ya visto sea instantáneo; cualquier escritura invalida el caché del mes afectado y de los posteriores (porque el saldo acumulado es una suma corrida).

```javascript
// web/src/js/state.js
export const state = {
  user: null,
  view: { year: null, month: null },
  cache: new Map(),              // "2026-10" -> respuesta de /api/dashboard
  categories: [],                // se piden una vez
  ui: { catSort:'amount', dailyMode:'both', sixMode:'bars', movFilter:'all' },
};

export function invalidateFrom(year, month) {
  for (const key of [...state.cache.keys()])
    if (key >= `${year}-${String(month).padStart(2,'0')}`) state.cache.delete(key);
}
```

### 12.3 Cliente de API

Un solo punto de salida: agrega el token, maneja el 401 renovando la sesión y reintentando una vez, y traduce los errores al formato de toast.

```javascript
// web/src/js/api.js
import { getToken, refresh } from './auth.js';

async function request(path, options = {}, retry = true) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type':'application/json',
               Authorization: `Bearer ${await getToken()}`,
               ...options.headers },
  });
  if (res.status === 401 && retry) { await refresh(); return request(path, options, false); }
  const body = res.status === 204 ? null : await res.json();
  if (!res.ok) throw new ApiError(body?.error ?? { code:'INTERNAL_ERROR' });
  return body;
}

export const api = {
  dashboard: (y,m)      => request(`/dashboard?year=${y}&month=${m}`),
  createTransaction: (d) => request('/transactions', { method:'POST', body: JSON.stringify(d) }),
  deleteTransaction: (id)=> request(`/transactions/${id}`, { method:'DELETE' }),
  // …
};
```

### 12.4 Componentes

Funciones que reciben datos y devuelven un string de HTML, igual que el mockup. Sin ciclo de vida ni estado interno.

```javascript
// web/src/js/components/kpi.js
export function kpiMetric({ label, value, sub, color, icon }) {
  return `<article class="kpi kpi-metric shell" style="--c:${color}">
    <div class="kpi-top">
      <div class="kpi-label">${esc(label)}</div>
      <span class="kpi-ico"><svg viewBox="0 0 24 24">${icon}</svg></span>
    </div>
    <div class="kpi-num num">${esc(value)}</div>
    <div class="kpi-sub">${sub}</div>
  </article>`;
}
```

**Regla de seguridad obligatoria:** todo dato que venga del backend pasa por `esc()` antes de entrar en una plantilla. Una descripción de movimiento con `<script>` no puede ejecutarse.

```javascript
// web/src/js/format.js
export const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
```

### 12.5 Manejo de importes

El backend manda strings decimales. El frontend los convierte en un único lugar y nunca hace aritmética financiera: sólo formatea.

```javascript
export const toNum = v => Number(v ?? 0);
export const fmt   = v => '$' + Math.round(Math.abs(toNum(v))).toLocaleString('es-AR');
export const fmtS  = v => (toNum(v) < 0 ? '−' : '') + fmt(v);
export const fmtK  = v => { /* $1,2M · $340k · negativos con − */ };
export const pct   = v => v == null ? 'N/A'
  : (toNum(v) > 0 ? '+' : toNum(v) < 0 ? '−' : '') +
    Math.abs(toNum(v)).toFixed(1).replace('.',',') + '%';
```

### 12.6 Estados de carga, error y vacío

Cada vista implementa los cuatro estados. No se muestra una pantalla en blanco nunca.

| Estado | Tratamiento |
|---|---|
| Cargando | Esqueletos con la forma del contenido final (mismas alturas, para que no salte el layout) |
| Error | Tarjeta con el mensaje y un botón "Reintentar" |
| Vacío | Texto explicativo. Para un mes consolidado, el texto específico: "Información histórica consolidada" |
| Sin conexión | Banda superior "Sin conexión — se muestran los últimos datos guardados" y lectura desde el caché del service worker |

---

## 13. Sistema de estilo

Esta sección es **normativa**: define el estilo aprobado a partir de `mockups/01_Mockup_V1_Grafito_Clasico.html`. Ningún componente nuevo introduce colores, sombras ni radios fuera de estos tokens.

### 13.1 Identidad

Vidrio sobre grafito. Superficies translúcidas con desenfoque y un brillo diagonal, sobre un fondo de lavados radiales fríos y cálidos, con una capa de ruido muy sutil que evita el aspecto plástico. **Sin neón, sin saturaciones altas, sin degradados estridentes.** El color se usa para significar (ingreso, egreso, ahorro, alerta), no para decorar.

### 13.2 Tokens

Se declaran en `web/src/styles/tokens.css` y se registran en Tailwind con `@theme`, de modo que se puedan usar como `bg-shell` o `text-ink-3` además de como `var(--ink-3)`.

```css
@import "tailwindcss";

@theme {
  /* fondo y lavados */
  --color-bg-1: #f1f2f3;  --color-bg-2: #e9ebec;
  --color-wash-a: #d6dee3; --color-wash-b: #e6e2d8;

  /* tinta: 4 niveles de jerarquía */
  --color-ink:   #1c2024;  /* títulos y cifras */
  --color-ink-2: #4b5157;  /* texto normal */
  --color-ink-3: #7c828a;  /* secundario y etiquetas */
  --color-ink-4: #a8adb3;  /* deshabilitado y ejes */

  /* líneas */
  --color-line:        rgba(28,32,36,.10);
  --color-line-2:      rgba(28,32,36,.07);
  --color-line-strong: rgba(28,32,36,.16);

  /* acento */
  --color-accent:   #57768c;
  --color-accent-2: #3e5a6d;
  --color-accent-soft: #e2e9ed;

  /* semántica financiera */
  --color-inc: #2e8067;   /* ingresos */
  --color-egr: #b13c47;   /* egresos  */
  --color-sav: #57768c;   /* ahorro   */

  /* severidad de alertas */
  --color-ok: #2e8067; --color-warn: #ba8c1f;
  --color-pend: #bd6c2c; --color-crit: #b13c47;

  /* radios */
  --radius-sm: 12px; --radius-card: 20px; --radius-lg: 24px;

  /* tipografía */
  --font-display: Outfit, sans-serif;
  --font-sans: Inter, ui-sans-serif, system-ui, sans-serif;

  /* curva de animación */
  --ease-glass: cubic-bezier(.32,.72,0,1);
}
```

Tema oscuro: **las mismas variables redefinidas** bajo `html[data-theme="dark"]`. Ningún componente conoce el tema; sólo usa tokens. Cambiar de tema no toca una sola línea de componente.

```css
html[data-theme="dark"] {
  --color-bg-1: #0c0d0e; --color-bg-2: #0f1011;
  --color-wash-a: #1c2529; --color-wash-b: #221f18;
  --color-ink: #eef0f1; --color-ink-2: #bcc0c4;
  --color-ink-3: #868b91; --color-ink-4: #54585d;
  --color-accent: #7ea3ba; --color-accent-2: #9bc0d4;
  --color-inc: #49a383; --color-egr: #cf6270; --color-sav: #7ea3ba;
  /* …más el resto */
}
```

### 13.3 Las dos capas de vidrio

Toda la profundidad de la interfaz sale de dos clases. No se inventan variantes.

| Clase | Uso | Desenfoque | Fondo (claro) |
|---|---|---|---|
| `.shell` | Contenedores: topbar, tarjetas de KPI, paneles, hojas, navegación | 22 px + saturación 1,15 | `rgba(255,255,255,.52)` |
| `.cg` | Contenido dentro de un `.shell`: filas, fichas, campos | 7 px | `rgba(255,255,255,.68)` |

`.shell` lleva además un brillo diagonal por `::before` y la sombra interior `--glass-in`. **Degradación obligatoria**: `@supports not (backdrop-filter: blur(1px))` reemplaza ambos fondos por versiones opacas, porque sin eso el texto queda ilegible en navegadores sin soporte.

### 13.4 Tipografía

Escala aprobada, ya aumentada respecto del mockup original según tu pedido. Base **16,5 px** con interlineado 1,55.

| Rol | Fuente | Tamaño | Peso |
|---|---|---|---|
| Cifra héroe (ahorro, patrimonio) | Outfit | 35 px | 700 |
| Cifra de KPI | Outfit | 28 px | 700 |
| Cifra de KPI secundario | Outfit | 24 px | 700 |
| Título de panel | Outfit | 20 px | 700 |
| Texto base | Inter | 16,5 px | 400 |
| Nombre en fila de lista | Inter | 15 px | 600 |
| Secundario de fila | Inter | 12,5 px | 400 |
| Etiqueta de KPI | Inter | 11,5 px | 700, mayúsculas, `letter-spacing: .07em` |
| Eje de gráfico | Inter | 10–10,5 px | 600 |

Las cifras usan `font-variant-numeric: tabular-nums` siempre, para que no "bailen" al actualizarse.

### 13.5 Puntos de corte

Mobile-first: el CSS base es el de teléfono y todo lo demás se agrega con `min-width`.

| Corte | Ancho | Qué cambia |
|---|---|---|
| base | < 640 px | Una columna. KPI en 2 columnas. Barra inferior de navegación. Botón `+` flotante. Detalles en hoja inferior. |
| `sm` | ≥ 640 px | KPI en 4 columnas. |
| `md` | ≥ 720 px | Cabeceras de panel en fila. Gráficos sin scroll horizontal. |
| `lg` | ≥ 960 px | Navegación superior en lugar de la inferior. Paneles en dos columnas. |
| `xl` | ≥ 1024 px | KPI en 6 columnas. Panel de detalle como cajón lateral derecho. |

Áreas táctiles de 44 × 44 px como mínimo. Respeto de `env(safe-area-inset-bottom)` en la navegación y el botón flotante.

### 13.6 Movimiento

| Gesto | Duración | Curva |
|---|---|---|
| Entrada de vista | 420 ms | `--ease-glass` |
| Entrada de tarjetas (escalonada) | 500 ms, +60 ms por tarjeta | `--ease-glass` |
| Hoja inferior y cajón | 380 ms | `--ease-glass` |
| Hover de tarjeta y fila | 180–220 ms | `--ease-glass` |
| Crecimiento de barras | 750 ms, +11 ms por barra | `--ease-glass` |
| Trazado de líneas | 1400 ms (`stroke-dashoffset`) | `--ease-glass` |
| Conteo de cifras | 900 ms | cúbica de salida |
| Cambio de tema | View Transitions API si existe | — |

**`@media (prefers-reduced-motion: reduce)` anula todas las animaciones.** Es obligatorio, no opcional.

### 13.7 Accesibilidad

- Contraste mínimo 4,5:1 para texto normal en ambos temas. Se verifica con un script en CI sobre los pares de tokens.
- El color nunca es el único portador de información: ingreso y egreso llevan además signo (`+` / `−`) e icono de flecha.
- Navegación completa por teclado con foco visible (`box-shadow: 0 0 0 4px var(--accent-ring)`).
- `aria-label` en todos los botones de sólo icono; `aria-live="polite"` en el toast; `aria-expanded` en lo que se expande.
- Los gráficos SVG llevan `role="img"` y un `<title>` con el resumen en texto, y debajo están **siempre los números** (requisito de la sección 12.2 del general: el gráfico no reemplaza los números).

---

## 14. Especificación de los gráficos

Cinco gráficos, todos en SVG generado por JavaScript, con `viewBox` para escalar y colores por variable CSS para heredar el tema.

### 14.1 Gráfico diario — barras con línea de ahorro

El principal del dashboard y el único con **doble eje**. Implementa la sección 13 del general más el cambio pedido sobre el mockup.

```text
Eje X        días del mes (1…día actual)
Eje Y izq.   importe diario → barras
             · barra verde  = ingresos del día
             · barra roja   = egresos del día
Eje Y der.   ahorro del mes acumulado → línea
             · línea azul grafito, 2,7 px
             · punto y etiqueta en el valor de hoy
             · línea de cero punteada si el ahorro se vuelve negativo
Modos        Ambos · Egresos · Ingresos · Acumulado
             (la línea de ahorro se mantiene visible en los cuatro)
```

Por qué doble eje: el gasto diario se mueve en decenas de miles y el ahorro acumulado en millones. Con un solo eje la línea aplastaría las barras. La etiqueta "AHORRO" sobre el eje derecho y el color compartido con el token `--color-sav` evitan la confusión.

Lectura que habilita: se ve de un golpe el salto del día del sueldo y cómo el ahorro baja a lo largo del mes con cada gasto; exactamente "cómo va bajando o subiendo el ahorro".

### 14.2 Resto

| Gráfico | Tipo | Series | Modos |
|---|---|---|---|
| Últimos seis meses | Barras agrupadas | Ingresos, egresos, ahorro | Barras · Ahorro · Tasa de ahorro |
| Gastos por categoría | Barras horizontales ordenadas de mayor a menor | Total por categoría | Mayor gasto · A–Z |
| Evolución del ahorro | Área con línea | Saldo acumulado por mes | — |
| Composición patrimonial | Barra apilada horizontal | Ahorro líquido, inversiones | — |
| Evolución salarial | Área con línea | Sueldo por fecha de vigencia | — |

La evolución patrimonial completa queda para una fase posterior, como indica el general.

### 14.3 Reglas comunes

- Ningún gráfico tiene sentido sin su versión numérica al lado: cada panel lleva un pie con las cifras clave.
- Escalas con `niceMax()` para que los ejes caigan en valores redondos.
- Mínimo de 1,5 px de alto en las barras, para que un gasto chico se vea.
- En móvil el `svg` tiene `min-width: 520px` dentro de un contenedor con scroll horizontal; a partir de 720 px se ajusta al ancho.
- Sin librería, sin canvas: SVG en el DOM, accesible e inspeccionable.

---

## 15. PWA

```jsonc
// web/manifest.json
{
  "name": "Epic Wallet",
  "short_name": "Epic Wallet",
  "description": "Gestión financiera personal",
  "start_url": "/?source=pwa",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#f1f2f3",
  "theme_color": "#f1f2f3",
  "lang": "es-AR",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "shortcuts": [
    { "name": "Nuevo gasto",  "url": "/#/nuevo?type=expense" },
    { "name": "Nuevo ingreso","url": "/#/nuevo?type=income" }
  ]
}
```

### 15.1 Estrategias del service worker

| Recurso | Estrategia | Motivo |
|---|---|---|
| `index.html` | Network first, cache de respaldo | Que una versión nueva se tome enseguida |
| CSS, JS, iconos, fuentes | Stale while revalidate | Arranque instantáneo |
| `GET /api/dashboard` | Network first con cache de respaldo | Sin conexión se ven los últimos datos, con el aviso de la sección 12.6 |
| Resto de `GET /api/*` | Network only | Datos que no tiene sentido mostrar viejos |
| `POST`, `PUT`, `DELETE` | Network only | **Nunca se encolan escrituras offline en el MVP** |

Decisión explícita: no hay escritura offline. Encolar un gasto cargado sin conexión y sincronizarlo después abre problemas de duplicados y de orden de recálculo que no valen la pena en la primera versión. Si no hay conexión, el formulario avisa y no guarda. Queda anotado como mejora futura.

El `theme_color` del manifest y el `<meta name="theme-color">` se actualizan al cambiar de tema, para que la barra de estado de Android acompañe.

---

## 16. Despliegue

### 16.1 Un proyecto de Vercel, dos cosas dentro

```jsonc
// vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": "web",
  "regions": ["gru1"],
  "functions": { "api/index.py": { "runtime": "python3.12", "maxDuration": 30 } },
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index" }
  ],
  "headers": [
    { "source": "/(.*)", "headers": [
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "X-Frame-Options", "value": "DENY" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
      { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" }
    ]},
    { "source": "/public/(.*)", "headers": [
      { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
    ]},
    { "source": "/service-worker.js", "headers": [
      { "key": "Cache-Control", "value": "no-cache" }
    ]}
  ]
}
```

```python
# api/index.py — punto de entrada de la función
from app.main import app        # Vercel detecta el ASGI y lo sirve
```

Frontend y API comparten dominio, así que **no hay CORS** en producción. Sólo se configura para desarrollo local.

`"regions": ["gru1"]` fija la función Python en São Paulo, **la misma región donde vive la base de datos y la más cercana a Buenos Aires**. No es un detalle menor: ver §20.1.

### 16.2 Entornos

| Entorno | Rama | URL | Base de datos |
|---|---|---|---|
| Producción | `main` | `epic-wallet.vercel.app` | Supabase · esquema `public` |
| Preview | cualquier otra rama o PR | URL automática por rama | Supabase · esquema `dev` |
| Local | — | `localhost:3000` + `localhost:8000` | Supabase · esquema `dev` |

Los tres entornos apuntan al **mismo proyecto de Supabase** y se diferencian por `DB_SCHEMA` (§4.1.1). En Vercel eso significa cargar `DB_SCHEMA=public` sólo en el entorno de producción, y `DB_SCHEMA=dev` en preview y development.

**Esto es lo que te permite probar en el celular en el momento:** cada push genera una URL de preview; cuando una tarea se aprueba, se integra a `main` y queda en la URL de producción. Nunca hay que esperar al final de una fase para ver algo funcionando.

### 16.3 Flujo de trabajo por tarea

```text
rama feat/F04-T03-alta-movimiento
   │
   ├─ 1. lógica  → funciones puras + tests unitarios (verde en local)
   ├─ 2. backend → endpoint + tests de API
   ├─ 3. frontend→ interfaz conectada
   │
   ├─ push → Vercel construye la preview
   ├─ vos la probás en el celular con la URL de preview
   │
   ├─ aprobada  → merge a main → producción → se marca [x] en el roadmap
   └─ rechazada → se corrige en la misma rama y vuelve a preview
```

### 16.4 Migraciones

Las migraciones **no** corren automáticamente en el despliegue: una migración fallida en una función serverless dejaría la base a medio camino. Se ejecutan a mano desde local contra el entorno correspondiente, antes de integrar el código que las necesita.

```bash
# 1 · generar la migración mirando el esquema de desarrollo
DB_SCHEMA=dev alembic revision --autogenerate -m "F03 meses y categorias"

# 2 · aplicarla en desarrollo y verificar
DB_SCHEMA=dev alembic upgrade head

# 3 · recién entonces, producción
DB_SCHEMA=public APP_ENV=production alembic upgrade head
```

`DB_SCHEMA` es obligatorio y explícito en cada comando de Alembic: no tiene valor por defecto que pueda hacer que una migración caiga en el esquema equivocado. La tabla `alembic_version` vive dentro de cada esquema, así que los dos entornos llevan su propio control de versiones.

Toda migración tiene su `downgrade` probado. Ninguna borra datos sin una copia previa.

### 16.5 Puesta en marcha inicial

Lo que hay que tener antes de la primera línea de lógica de negocio (es la Fase 0 del roadmap):

1. Repositorio en GitHub con la estructura de la sección 10.
2. Un proyecto Supabase con los esquemas `public` y `dev` creados; anotar URL, claves y secreto de JWT.
3. Proyecto en Vercel vinculado al repositorio, con las variables de entorno cargadas en los tres entornos.
4. `/api/health` respondiendo en la URL de producción.
5. `index.html` mínimo con el estilo aplicado, instalable como PWA en el celular.

Recién cuando eso funciona de punta a punta empieza la Fase 1.

---

## 17. Seguridad

Implementa la sección 57 del documento general.

| Requisito | Implementación |
|---|---|
| HTTPS en producción | Vercel lo fuerza, más HSTS por cabecera |
| Contraseñas nunca en texto plano | No las almacenamos: Supabase Auth (bcrypt) |
| Recuperación de contraseña segura | Enlace de un solo uso con vencimiento, enviado por Supabase; nunca se revela si un email tiene cuenta |
| Registro sin enumerar usuarios | El alta y la recuperación responden igual con un email existente o no |
| Aislamiento entre cuentas | `user_id` en toda consulta **y** RLS como segunda barrera; se verifica con un segundo usuario de prueba |
| Sesiones seguras | JWT de vida corta (1 h) con refresh automático |
| Protección CSRF | No aplica con token en cabecera `Authorization` en lugar de cookie de sesión |
| Validación en servidor | Pydantic en toda entrada, más `CHECK` en la base |
| Consultas parametrizadas | SQLAlchemy siempre; **prohibido** construir SQL por concatenación |
| Aislamiento entre usuarios | `user_id` en toda consulta **y** RLS como segunda barrera |
| Tokens externos fuera del frontend | Las claves de proveedores viven sólo en variables de entorno del backend |
| Secretos por entorno | Variables de Vercel; `.env` en `.gitignore`; `.env.example` sin valores |
| Backups protegidos | Supabase automático, más exportación bajo autenticación |
| Protección contra XSS | CSP estricta y `esc()` obligatorio en todo dato del servidor |
| Límite de peticiones | 60 por minuto por usuario; el refresco de cotizaciones, 1 cada 15 minutos |
| Registro sin datos sensibles | Nunca se loguean tokens, contraseñas ni importes con identificación personal |

```text
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' https://fonts.googleapis.com;
  font-src https://fonts.gstatic.com;
  img-src 'self' data:;
  connect-src 'self' https://*.supabase.co;
  frame-ancestors 'none';
  base-uri 'self'
```

La CSP sin `'unsafe-inline'` en `script-src` es la razón por la que no hay JavaScript en línea en el HTML: todo va en módulos.

---

## 18. Respaldo y exportación

Tres niveles, porque "la información financiera no debe depender de una única copia" (sección 58).

1. **Automático de Supabase** — copias diarias del plan, con restauración desde el panel.
2. **Exportación desde la app** — `GET /api/export?format=json` devuelve el estado completo del usuario (perfil, meses, categorías, movimientos, totales consolidados, inversiones, historial laboral, preferencias) con versión de esquema. `format=csv` devuelve un ZIP con un archivo por tabla, para abrir en Excel.
3. **Script local** — `scripts/backup.py` hace `pg_dump` del proyecto Supabase a un archivo local.

La restauración (`POST /api/import`) valida la versión de esquema, muestra una vista previa de qué se va a escribir y pide confirmación. **No se implementa en el MVP**; se deja el endpoint de exportación, que es lo que protege los datos.

---

## 19. Pruebas

| Nivel | Herramienta | Qué cubre | Dónde corre |
|---|---|---|---|
| Unitario | pytest | `calc.py` y servicios con funciones puras. Casos borde de la sección 7.1. | Local y CI, contra SQLite |
| API | pytest + httpx | Cada endpoint: éxito, validación, 401, 403, 404 y aislamiento entre usuarios | CI contra Postgres |
| Interfaz | Playwright | Flujos completos: login, alta de gasto, navegación de meses, venta de inversión | CI, a 390 px y 1440 px |
| Manual | Vos, en el celular | Criterios de aceptación de cada tarea del roadmap | URL de preview |

Reglas: toda función de `calc.py` tiene test antes del endpoint que la usa. Todo bug encontrado deja primero un test que falla. Cobertura mínima exigida en `services/`: 90 %.

Pruebas obligatorias que no pueden faltar:

- El mes histórico devuelve `transactions: null` y la interfaz **no** muestra movimientos inventados.
- Alta de movimiento recalcula el mes y **todos los saldos posteriores**.
- Tasa de ahorro con ingresos en 0 devuelve `null`, no un error.
- Un usuario no puede leer ni escribir datos de otro, ni aunque pase un `id` ajeno.
- Una cuenta recién creada nace con su perfil y sus 21 categorías, sin pasar por nuestra API.
- Dos cuentas distintas no ven nada la una de la otra: meses, movimientos, inversiones ni alertas.
- Comprar una inversión no cambia el patrimonio neto.
- El importe negativo o cero es rechazado por la API, no sólo por el formulario.

---

## 20. Rendimiento

| Métrica | Objetivo |
|---|---|
| JavaScript (comprimido) | < 150 KB |
| CSS (comprimido) | < 50 KB |
| Primera pintura útil en 4G | < 1,5 s |
| Respuesta de `/api/dashboard` | < 400 ms en el percentil 95, medido desde la función |
| Lighthouse móvil (rendimiento y accesibilidad) | ≥ 90 |

Cómo se consigue: una sola llamada para todo el dashboard; caché por mes en memoria; `font-display: swap` con precarga; fondo con `background-attachment: fixed` y una única capa de ruido en SVG embebido en lugar de imágenes; `content-visibility: auto` en los paneles que están fuera de pantalla; estáticos con cache inmutable; pooler de conexiones en Supabase.

### 20.1 Región: todo en São Paulo

La base vive en **`sa-east-1` (São Paulo)**, la región de AWS más cercana a Buenos Aires, y la función de Vercel se fija en **`gru1`** (São Paulo también). Los tres puntos del recorrido —teléfono, función y base— quedan en Sudamérica.

Esto no salió gratis: el proyecto se creó primero en `us-west-2` (Oregón), que es la región por defecto de Supabase, y **la región de un proyecto no se puede cambiar**. Se detectó en la verificación de F00-T04, con la base todavía vacía, y se recreó en São Paulo. Las mediciones, desde Buenos Aires:

| Medición | Oregón (`us-west-2`) | São Paulo (`sa-east-1`) | Mejora |
|---|---|---|---|
| Conexión TCP al pooler | 236 ms | **47 ms** | 5,0× |
| Consulta sobre conexión abierta | 223 ms | **35 ms** | 6,4× |
| Abrir conexión nueva | 665–2.049 ms | **105 ms** | 6–20× |

**Por qué importa tanto:** el costo no es el viaje, es el viaje **multiplicado por consulta**. Con el dashboard haciendo seis consultas, Oregón costaba ~1,3 s sólo de red; São Paulo cuesta ~210 ms. Es la diferencia entre cumplir el objetivo de 400 ms y no acercarse.

**Por qué la función va en `gru1` y no donde esté el usuario:** porque la latencia que se multiplica es la de función → base, no la de usuario → función. El usuario paga un único viaje de ida y vuelta por petición HTTP; la función paga uno por consulta SQL. Poniéndola junto a la base, cada consulta cuesta ~5 ms en lugar de ~35 ms:

```text
Función en gru1, junto a la base (lo elegido):
  teléfono → función   ~40 ms   (una sola vez por petición)
  función  → base      ~5 ms × 6 consultas = 30 ms
  total                ~70 ms   y casi no crece al agregar consultas

Función en otra región (por ejemplo Virginia):
  teléfono → función   ~120 ms
  función  → base      ~130 ms × 6 consultas = 780 ms
  total                ~900 ms  y empeora con cada consulta
```

Los **estáticos no dependen de esto**: el CDN de Vercel los sirve desde el nodo más cercano a Buenos Aires sin importar dónde corra la función.

Qué queda como regla:

1. **`regions: ["gru1"]`** en `vercel.json` (F00-T08). Si alguna vez la base se mueve, esta variable se mueve con ella.
2. **Mantener la respuesta única del dashboard** (§9.2): con cualquier latencia, una llamada es mejor que seis.
3. **Medir el percentil 95 desde la función desplegada**, no desde la máquina de desarrollo.
4. En desarrollo local hay que contar ~35 ms por consulta: es el viaje a São Paulo, no un problema de código.

---

## 21. Convenciones

### Código

- Python: `ruff` para formato y lint; `snake_case`; anotaciones de tipo obligatorias en servicios y repos; `Decimal` para dinero, **nunca `float`**.
- JavaScript: módulos ES; `camelCase`; `const` por defecto; sin dependencias de terceros salvo `supabase-js`.
- CSS: tokens primero, utilidades de Tailwind después, CSS propio sólo para los componentes de vidrio.
- Textos de interfaz en español rioplatense; identificadores de código en inglés.

### Git

```text
feat(F04-T03): alta de movimiento con recálculo del mes
fix(F06-T02): la línea de ahorro no se dibujaba con ahorro negativo
docs(F03): documentación de la fase 3
```

Una rama por tarea, nombrada `feat/F04-T03-descripcion-corta`. Integración a `main` sólo con la tarea aprobada.

### Documentación

Al cerrar cada fase se escribe `docs/FASE_XX_<nombre>.md` con qué se hizo en lenguaje natural, cuadros, ejemplos de uso y fragmentos del código real. Es una tarea del roadmap, no un extra.

---

## 22. Resumen de decisiones

| Tema | Decisión | Dónde se amplía |
|---|---|---|
| Framework backend | FastAPI sobre Vercel Python Functions | 3, 16.1 |
| Base de datos | Supabase Postgres, un proyecto y dos esquemas; SQLite sólo para tests | 4.1, 4.1.1, 6 |
| ORM | SQLAlchemy 2.0 + Alembic | 3, 16.4 |
| Autenticación | Supabase Auth; el JWT se verifica con la clave pública del JWKS (ES256), no con secreto compartido | 8.8 |
| Cuentas | Registro abierto, multiusuario desde el MVP, con confirmación por email | 8.2, 8.3 |
| Perfil y categorías iniciales | Trigger de Postgres sobre `auth.users`, no el backend | 8.4 |
| Envío de mails | SMTP propio obligatorio; el de Supabase sólo sirve para pruebas | 8.5 |
| Aislamiento de datos | `user_id` en consultas + RLS | 6.5 |
| Frontend | Estático, una página, siete vistas, hash routing | 12.1 |
| Estilos | Tailwind v4 con los tokens del mockup | 13 |
| Gráficos | SVG propio, sin Chart.js | 4.3, 14 |
| Gráfico diario | Barras de ingreso y egreso + línea de ahorro acumulado con doble eje | 14.1 |
| Dinero | `numeric(14,2)` en base, `Decimal` en Python, string en JSON | 6.1, 12.5 |
| Dos tipos de mes | `transactions: null` para los consolidados | 6.6 |
| Offline | Lectura sí, escritura no | 15.1 |
| Despliegue | Preview por rama, producción en `main` | 16.2, 16.3 |

---

## 23. Lo que queda fuera del MVP

Confirmado con la sección 4.2 del documento general. La arquitectura lo deja preparado, pero no se construye:

Presupuestos · gestión detallada de tarjetas · múltiples cuentas bancarias · conciliación bancaria · historial de operaciones de inversión · dólar y multimoneda · deudas, cuotas y préstamos · contabilidad formal · facturación · importación del Excel histórico · integración con Mercado Pago · escritura offline · restauración de respaldo desde la app · inicio de sesión con Google u otros proveedores · verificación en dos pasos · roles y permisos · cuentas compartidas entre usuarios.

**El alta de usuarios sí entra en el MVP** (§8.2): registro abierto, confirmación por email y recuperación de contraseña. Era un punto diferido en la primera versión de este documento y se incorporó por pedido expreso.

Qué queda preparado para que incorporarlos no obligue a rehacer nada: la tabla `liabilities` existe y ya se resta en el cálculo de patrimonio; `transactions` tiene `source` y `external_id` para la anti-duplicación de importaciones; el proveedor de cotizaciones es una interfaz con varias implementaciones; `app_settings` guarda preferencias arbitrarias en JSON; y el esquema es multiusuario desde el primer día.
