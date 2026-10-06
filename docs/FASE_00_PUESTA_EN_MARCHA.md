# Fase 0 — Puesta en marcha y producción

**Cerrada el:** 03/10/2026
**Tareas:** 12 de 12
**Resultado:** la aplicación está en internet, se instala en el celular como app, y hay una API respondiendo contra una base de datos en São Paulo.

> **https://epic-wallet-v2.vercel.app**

---

## 1. Para qué sirvió esta fase

El roadmap pone la producción **antes** que cualquier funcionalidad. La razón es simple: si cada tarea no se puede probar en el celular el mismo día que se termina, el trabajo se acumula sin verificar y los problemas aparecen todos juntos al final.

Esta fase no construyó ni una pantalla de la aplicación real. Construyó el camino para que, de acá en adelante, cada cosa que se haga esté publicada y probable en minutos.

---

## 2. Qué quedó montado

| | Qué | Dónde |
|---|---|---|
| **Repositorio** | Estructura completa del proyecto, `.gitignore`, `.gitattributes` | [github.com/gusoliva85/Epic_Wallet_v2](https://github.com/gusoliva85/Epic_Wallet_v2) |
| **Backend** | Python 3.12, FastAPI, SQLAlchemy, Alembic, ruff, mypy, pytest | `api/`, `pyproject.toml` |
| **Frontend** | Tailwind CSS v4 con los tokens del sistema Vidrio Grafito | `web/` |
| **Base de datos** | Supabase Postgres 17 en São Paulo, con dos esquemas | — |
| **Migraciones** | Alembic con esquema obligatorio y explícito | `migrations/` |
| **Despliegue** | Vercel: estáticos en el CDN y la API como función Python, mismo dominio | `vercel.json` |
| **PWA** | Manifest, tres iconos y service worker; instalable en Android | `web/manifest.json` |
| **Pruebas** | 36 pruebas automatizadas en verde | `tests/` |

---

## 3. Los entornos

| Entorno | Rama | URL | Esquema de la base |
|---|---|---|---|
| **Producción** | `main` | `epic-wallet-v2.vercel.app` | `public` — los datos reales |
| **Preview** | cualquier otra rama | URL automática por rama | `dev` — datos de prueba *(pendiente, ver §7)* |
| **Local** | — | `localhost:8000` | `dev` |

Los tres apuntan **al mismo proyecto de Supabase**. Lo que los separa es una variable: `DB_SCHEMA`.

Para saber contra qué esquema está corriendo un entorno, se pregunta:

```bash
curl -s https://epic-wallet-v2.vercel.app/api/health
```

```json
{
  "status": "ok",
  "environment": "production",
  "db_schema": "public",
  "database": { "status": "connected", "latency_ms": 125.3, "schema_exists": true },
  "warnings": []
}
```

---

## 4. Un solo proyecto de Supabase, dos esquemas

### Por qué

La cuenta disponible admite **un único proyecto**. En lugar de mezclar datos de prueba con datos reales, se separan con **esquemas de Postgres**: `public` guarda lo real y `dev` lo de prueba.

Se eligió esto antes que usar SQLite en desarrollo porque mantiene el **mismo motor, la misma versión, las mismas extensiones y el mismo comportamiento de seguridad**. Lo que funciona en desarrollo funciona igual en producción; con SQLite aparecerían bugs recién al desplegar.

### Qué implica, sin adornos

**La autenticación es compartida.** Supabase Auth es única por proyecto, así que los usuarios valen para los dos esquemas. Con un usuario es indiferente: el mismo correo y contraseña sirven en ambos.

**El aislamiento es lógico, no físico.** Los dos esquemas viven en la misma base. Un comando apuntado al esquema equivocado sí puede tocar los datos reales. Por eso hay tres protecciones que lo impiden, descritas en la sección 6.

**Si el proyecto se pausa, se pausan los dos.** El plan gratuito de Supabase pausa los proyectos tras siete días sin actividad. Se despiertan solos al volver a usarlos, pero la primera consulta tarda unos segundos.

**El respaldo cubre todo.** Las copias automáticas de Supabase incluyen los dos esquemas.

**Los dos triggers de alta se disparan juntos.** Esto apareció en F02-T16 y no se había previsto. El trigger que crea el perfil y las categorías vive sobre `auth.users`, que es compartida, y cada esquema instala el suyo: `al_crear_usuario_dev` y `al_crear_usuario_public`. Desde que `public` está migrado, **cada registro crea el perfil en los dos esquemas**, sin importar en cuál se registró la persona. Dos consecuencias:

- `public.profiles` acumula las cuentas de prueba. No es una fuga —RLS filtra por `auth.uid()` y cada cuenta sólo se ve a sí misma—, pero la tabla de producción queda con filas que no son de nadie real. Las pruebas de API borran su cuenta de `auth.users` al terminar y el `on delete cascade` se las lleva de los dos esquemas, así que se limpia solo; lo que quede es de registros hechos a mano.
- **Un error en el trigger de un esquema rompe el registro en el otro.** Los dos corren dentro de la misma transacción que el `insert` en `auth.users`: si el de `public` falla, el alta entera falla, aunque la persona se estuviera registrando en `dev`. Conviene tenerlo presente al tocar `crear_perfil_y_categorias`: hay que migrar los dos esquemas o ninguno.

Esto se arregla solo el día que haya dos proyectos de Supabase. Hasta entonces es el precio de compartir `auth.users`, y está anotado en el roadmap como **F17-T08**.

### Cómo se migraría a dos proyectos

Si algún día hace falta separación real: se crea un proyecto nuevo y se corren las migraciones con `DB_SCHEMA=public`. No hay nada más en el código atado a esta decisión.

---

## 5. El flujo de trabajo, con un ejemplo

Así se trabaja cada tarea del roadmap, de principio a fin:

```text
1. Se crea la rama           git checkout -b feat/F04-T03-alta-movimiento
2. Lógica                    funciones puras + tests  (sin base, sin HTTP)
3. Backend                   endpoint + tests de API
4. Frontend                  interfaz conectada
5. Se sube                   git push
6. Se prueba                 en el celular
7. Gustavo aprueba o rechaza
      aprobada  → merge a main → producción → se marca [x] en el roadmap
      rechazada → se corrige en la misma rama y vuelve al paso 6
```

**Ejemplo real de esta fase, F00-T07** (la API con `/api/health`):

1. Rama `feat/F00-T07-api-health`
2. Se escribieron `config.py`, `errors.py` y `db.py`, con sus pruebas
3. Se agregó el endpoint y siete pruebas de API
4. No tenía interfaz, así que se saltó el paso
5. `git push` y merge
6. Verificación: `uvicorn` local respondió 200, y con la base apuntada a un host inexistente informó el error sin caerse
7. Aprobada → quedó en producción

### Las marcas del roadmap

| Marca | Significa |
|---|---|
| `- [ ]` | Pendiente |
| `- [~]` | Implementada, esperando prueba |
| `- [x]` | Aprobada e integrada |
| `- [!]` | Rechazada, a corregir |

### Cuando la tarea trae una migración

El flujo de arriba alcanza mientras la tarea no toque el esquema. Si lo
toca, el orden importa y no es el intuitivo: **primero la base, después
el código.**

```text
1. Comparar           python scripts/comparar_esquemas.py
                      (dev y public tienen que estar en la misma revisión
                       ANTES de empezar; si ya difieren, se arregla eso
                       primero y aparte)

2. Revisar el SQL     DB_SCHEMA=public APP_ENV=production \
                        alembic upgrade head --sql > /tmp/public.sql
                      No toca nada: imprime lo que haría. Se lee.

3. Migrar producción  DB_SCHEMA=public APP_ENV=production alembic upgrade head

4. Comparar otra vez  python scripts/comparar_esquemas.py
                      Tiene que decir «los dos esquemas son iguales».

5. Publicar           git push  (Vercel despliega main)

6. Comprobar          curl -s https://epic-wallet-v2.vercel.app/api/health
```

**Por qué la base va primero.** El código nuevo espera tablas que el
viejo no usa. Si se publica antes de migrar, entre el despliegue y la
migración hay una ventana en la que la aplicación en producción pide
columnas que no existen, y eso el usuario lo ve como error. Al revés no
pasa nada: una tabla que todavía nadie consulta no molesta a nadie.

Lo mismo dicho de otra forma: **las migraciones tienen que ser
compatibles hacia atrás.** Agregar una tabla o una columna que admite
nulos es seguro. Renombrar o borrar una columna que el código viejo
todavía lee no lo es, y necesita dos despliegues: uno que deja de usarla
y otro que la saca.

**El paso 4 no es decorativo.** Lo que más calla cuando falta no son las
tablas —eso se nota enseguida— sino los permisos. Una tabla sin `grant`
a `authenticated` existe, se ve en el panel de Supabase y rechaza todo.
Y RLS con `enable` pero sin `force` deja pasar al dueño de la tabla, así
que la política parece estar y no filtra nada. El comparador mira las
dos cosas.

---

## 6. Las protecciones contra tocar los datos reales

Son tres y nacieron de problemas concretos, no de la teoría.

### En las migraciones

`migrations/env.py` **aborta con código 1** si:

- Falta `DATABASE_URL`
- Falta `DB_SCHEMA` — no tiene valor por defecto a propósito
- `APP_ENV=development` apunta a `public`

```bash
$ alembic upgrade head
  ERROR: DB_SCHEMA no está definida.
  No tiene valor por defecto a propósito: una migración en el esquema
  equivocado tocaría los datos reales.
  Usá:  DB_SCHEMA=dev alembic upgrade head        (desarrollo)
        DB_SCHEMA=public alembic upgrade head     (producción)
```

### En el arranque de la aplicación

`api/app/main.py` **mata el proceso** si:

- `DB_SCHEMA` está vacío sobre Postgres
- Cualquier entorno que no sea producción apunta a `public`
- Producción apunta a un esquema que no sea `public`

El primer caso se agregó **después de verlo pasar**: la primera preview quedó desplegada sin las variables de entorno y respondió con `db_schema: null`. Sin esquema no se fija el `search_path`, y las consultas caen en el que Postgres tenga por defecto, que suele ser `public`. Era el caso más peligroso justamente porque era silencioso.

### En el verificador

`scripts/check_db.py` revisa toda la configuración sin imprimir ningún secreto —sólo presencia, longitud y una huella de 8 caracteres— así que su salida se puede compartir sin riesgo.

```bash
$ python scripts/check_db.py
  [ok]  SUPABASE_URL                   https://xxxx.supabase.co
  [ok]  SUPABASE_ANON_KEY              presente · 46 caracteres · huella 6a7b1f66
  [ok]  región sa-east-1 (São Paulo) · la más cercana a Argentina
  [ok]  DB_SCHEMA                      dev
  [ok]  coherente con APP_ENV=development
  [ok]  conectado en 286 ms · PostgreSQL 17.11
  TODO EN ORDEN
```

---

## 7. Lo que quedó pendiente

| Qué | Dónde se retoma | Por qué se difirió |
|---|---|---|
| Variables del entorno **Preview** en Vercel | **F08-T13** | La base está vacía: no hay datos reales que proteger todavía. Se configura justo antes de cargar el histórico. |
| Recuperación de contraseña por correo y SMTP | **F16-T12 a T14** | Decisión de Gustavo: primero la aplicación, el correo al final. Mientras tanto la confirmación por correo queda desactivada y el registro entra directo. |
| Estrategias de caché del service worker | **F15-T01** | Un service worker que cachee sin estrategia de invalidación deja versiones viejas pegadas. Hoy sólo se registra. |

---

## 8. Cuatro cosas que descubrimos en el camino

Ninguna estaba prevista. Todas cambiaron una decisión.

### La base estaba en Oregón

El proyecto se creó con la región por defecto de Supabase, `us-west-2`. Medido desde Buenos Aires:

| | Oregón | São Paulo | |
|---|---|---|---|
| Conexión al pooler | 236 ms | **47 ms** | 5,0× |
| Una consulta | 223 ms | **35 ms** | 6,4× |
| Abrir conexión nueva | 665–2.049 ms | **105 ms** | 6–20× |

La región de un proyecto **no se puede cambiar**. Como la base estaba vacía, se recreó en São Paulo sin costo. Dos semanas más tarde habría sido una migración.

Lo que importa no es un viaje, es el viaje **multiplicado por consulta**: el dashboard hace seis, así que pasó de ~1,3 s de red a ~210 ms.

Y la función de Vercel se fijó en `gru1` (São Paulo), **junto a la base, no junto al usuario**: la latencia que se multiplica es la de función → base. Resultado medido en producción: **20–50 ms por consulta**.

### Los tokens no se firman como esperábamos

El documento técnico asumía el secreto compartido `HS256`. El proyecto real firma con **`ES256` y clave asimétrica**, publicando la clave pública en un endpoint JWKS. Se descubrió al verificar el primer inicio de sesión.

Consecuencia: `PyJWT` pasó a `PyJWT[crypto]`, y la verificación usa la clave pública en lugar de un secreto. Ventaja inesperada: **el backend sólo necesita la clave pública**, así que ni filtrando la configuración del servidor se podría fabricar un token válido.

### El primer despliegue falló por un import

`api/index.py` hacía `from app.main import app`. En la máquina de desarrollo funciona porque el proyecto se instala con `pip install -e .`; **Vercel sólo instala `requirements.txt`**, así que el paquete no existía y la función devolvía error en todas las rutas.

Es un error que sólo podía aparecer en el despliegue. Se resolvió agregando el directorio al `sys.path`, con el porqué anotado en el archivo para que nadie lo saque pensándolo redundante.

### El watcher de Tailwind no funciona acá

`tailwindcss --watch` no detecta ningún cambio cuando la ruta del proyecto tiene espacios en Windows —y la nuestra los tiene: `D:\_Mis Datos\...`. Ni el archivo de entrada ni los parciales importados.

Se reemplazó por `scripts/dev-css.mjs`, que usa `fs.watch` de Node sin dependencias nuevas: detección en 400 ms, compilación en 195 ms.

---

## 9. Levantar el proyecto en una máquina nueva

### Lo que hace falta

- Python 3.12 o superior
- Node.js 20 o superior
- Git
- Acceso al proyecto de Supabase

### Paso a paso

```bash
# 1 · Clonar
git clone git@github.com:gusoliva85/Epic_Wallet_v2.git epic-wallet
cd epic-wallet

# 2 · Backend
python -m venv .venv
.venv\Scripts\activate            # en Linux o Mac: source .venv/bin/activate
pip install -e ".[dev]"

# 3 · Frontend
npm install
npm run build                      # genera web/public/app.css

# 4 · Variables de entorno
cp .env.example .env               # y completar los 5 valores de Supabase

# 5 · Verificar que la configuración está bien
python scripts/check_db.py         # tiene que decir TODO EN ORDEN

# 6 · Migraciones sobre el esquema de desarrollo
DB_SCHEMA=dev alembic upgrade head

# 7 · Levantar
cd api && uvicorn app.main:app --reload --port 8000
npm run dev                        # en otra terminal: CSS en modo watch
```

Y para comprobar que todo anda:

```bash
pytest                             # 36 pruebas
ruff check . && ruff format --check .
mypy
curl http://localhost:8000/api/health
```

### Las cinco variables de Supabase

| Variable | Dónde se saca |
|---|---|
| `DATABASE_URL` | Panel → **Connect** → *Transaction pooler* (puerto **6543**). Cambiar `postgresql://` por `postgresql+psycopg://` y poner la contraseña real. |
| `SUPABASE_URL` | Project Settings → Data API → *Project URL*. **Sin** `/rest/v1/` al final. |
| `SUPABASE_ANON_KEY` | Project Settings → API Keys → *anon public* |
| `SUPABASE_SERVICE_ROLE_KEY` | Misma pantalla → *service_role* |
| `SUPABASE_JWT_SECRET` | API Keys → *JWT Keys*. **No se usa** para verificar (ver §8), se conserva por compatibilidad. |

---

## 10. Dónde vive cada secreto

Ningún secreto está en el repositorio. Se verificó con una revisión del historial completo de Git.

| Secreto | En desarrollo | En producción | ¿Llega al navegador? |
|---|---|---|---|
| `DATABASE_URL` | `.env` *(ignorado por git)* | Variables de Vercel | **No** |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env` | Variables de Vercel | **No** |
| `SUPABASE_JWT_SECRET` | `.env` | Variables de Vercel | **No** |
| `SUPABASE_ANON_KEY` | `.env` | Variables de Vercel | Sí — es pública por diseño |
| `SUPABASE_URL` | `.env` | Variables de Vercel | Sí — no es secreta |
| Clave SSH del repositorio | `~/.ssh/epic_wallet_deploy` | — | **No** |

`.env` está en `.gitignore`; `.env.example` sí se versiona, con los nombres y la documentación de cada variable pero **sin un solo valor**.

### Dos de ellas las necesita el *build*, no sólo la API

Esto cambió en **F02-T08**. `SUPABASE_URL` y `SUPABASE_ANON_KEY` ya no son sólo del backend: `scripts/generar-config.mjs` las lee durante `npm run build` y escribe `web/public/config.js`, que es de donde las toma el navegador. En Vercel tienen que estar disponibles para **Production, Preview y Development**.

Si faltan, el build **avisa fuerte y sigue**. La primera versión cortaba el build, y la decisión estaba mal: bloqueaba *todos* los despliegues por una variable del frontend, incluido un arreglo urgente de la API que no tiene nada que ver. En un proyecto donde cada tarea se prueba en el teléfono el mismo día, eso cuesta más de lo que evita.

Lo que hay que evitar no es el silencio del build, es que algo quede a medias sin que nadie se entere. Así que cuando faltan: aviso en el log del despliegue, un `config.js` explícitamente vacío que nombra las variables que faltan, y un `console.error` que el navegador muestra. `auth.js` levanta un error con el mismo texto en cuanto algo intenta usarlo. El resto de la aplicación se publica y funciona.

El generador además **rechaza la clave secreta** si alguien la pone en `SUPABASE_ANON_KEY` por error, reconociendo los dos formatos que usa Supabase (`sb_secret_…` y el JWT viejo con `role: service_role`). Es la única equivocación de esta lista que no se puede deshacer: una clave de servicio dentro de un paquete de navegador ya quedó publicada, y rotarla no borra a quién la vio. `tests/unit/test_config_web.py` revisa además todos los archivos de `web/` por si aparece por otro camino.

---

## 11. Las decisiones de esta fase

| Decisión | Por qué |
|---|---|
| Producción antes que funcionalidad | Para poder probar cada tarea en el celular el mismo día |
| Un proyecto de Supabase, dos esquemas | La cuenta admite uno solo, y mezclar datos reales con pruebas no es opción |
| La función de Vercel en São Paulo | La latencia que se multiplica es la de función → base, no la de usuario → función |
| `DB_SCHEMA` sin valor por defecto | Un valor por defecto es exactamente lo que haría que una migración caiga donde no debe |
| Watcher de CSS propio | El de Tailwind no funciona con espacios en la ruta, en Windows |
| Service worker vacío | Cachear sin estrategia de invalidación es peor que no cachear |
| Iconos generados por script | Se regeneran solos si cambia el color de acento, sin depender de un editor |
| Sin `runtime` en `vercel.json` | Fijarlo a mano es causa habitual de despliegues fallidos: el nombre válido cambia entre versiones |

---

## 12. El estado al cerrar

```bash
$ pytest
36 passed

$ ruff check . && mypy
All checks passed!
Success: no issues found in 14 source files

$ curl -s https://epic-wallet-v2.vercel.app/api/health
{"status":"ok","version":"0.1.0","environment":"production","db_schema":"public",
 "database":{"status":"connected","latency_ms":125.3,"schema_exists":true},"warnings":[]}
```

| Medición | Valor |
|---|---|
| CSS comprimido | 8,0 KB — 16% del presupuesto de 50 KB |
| Latencia función → base | 20–50 ms |
| Respuesta de `/api/health` | 0,48 s |
| Pruebas | 36 |

---

## 13. Qué sigue

**Fase 1 — Sistema de estilo y esqueleto visual.** Las siete pantallas de la aplicación, navegables y con el estilo completo, pero con datos de ejemplo escritos a mano. Al terminarla vas a poder recorrer toda la aplicación en el celular, cambiar entre claro y oscuro, y ver cómo va a quedar — aunque todavía no haya nada real detrás.

Son 14 tareas. La primera, F01-T01, completa los tokens de diseño que esta fase dejó esbozados.
