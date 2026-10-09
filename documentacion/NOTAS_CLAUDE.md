# Notas de Claude — no es un documento que manda

Esto **no** es uno de los tres documentos oficiales (`01_Documento_General.md`,
`02_Documento_Tecnico.md`, `03_Roadmap.md`). Es un apunte mío, para mí,
para no releer todo el historial de conversación cada vez que arranca
una sesión nueva. Gustavo pidió que exista; no lo va a leer. Si algo
de acá contradice los tres documentos oficiales o el roadmap, **ganan
ellos**, esto está desactualizado y hay que corregirlo o borrarlo.

Última actualización: commit `6c7ab58` (F04-T01), rama `main`, HEAD de
ese momento. Si el repo ya avanzó más, esto es historia vieja —leer el
roadmap primero.

## Leer esto primero, en este orden

1. `documentacion/03_Roadmap.md` — qué tarea sigue, qué está `[~]`
   esperando aprobación.
2. Esta sección de "estado al cierre de la última sesión" de más
   abajo.
3. Si hace falta profundidad de modelo o de stack: `01_Documento_General.md`
   y `02_Documento_Tecnico.md`.
4. Antes de tocar HTML/CSS/JS de interfaz: `.claude/skills/epic-wallet-ui/SKILL.md`.

## Estado al cierre de la última sesión

**Esperando a Gustavo**, dos cosas sin aprobar todavía:

- `F03-T10` (`[~]`) — barra de mes conectada a la API + administración
  de categorías. Se reportó un bug real en producción (ver más abajo)
  y ya está arreglado y pusheado. Falta que confirme que ahora sí ve
  el mes actual.
- `F04-T01` (`[~]`) — lógica pura de validación y recálculo de
  movimientos (`api/app/services/transactions.py`). Es sólo cálculo,
  no hay nada que mirar en el celular; alcanza con que diga "aprobado"
  para pasar a F04-T03 (las tablas `transactions` y
  `monthly_category_totals`).

**Siguiente tarea cuando apruebe**: `F04-T03` → `F04-T05` → `F04-T06`
→ `F04-T09` → `F04-T12`, en ese orden (cálculo ya hecho → tablas →
servicio de recálculo transaccional → endpoints → formulario de alta
→ lista/detalle/edición/baja). Son las que cierran la Fase 4
("Movimientos"), el corazón de la aplicación.

## El bug de esta sesión: cuentas sin perfil (importa para el futuro)

Gustavo reportó que la barra de mes "no se ve". La causa real **no
era** de cálculo de fecha: su cuenta real (creada desde el panel de
Supabase en F00, antes de que existiera el trigger de F02-T04) **no
tiene fila en `profiles`**. `months.user_id` y `categories.user_id`
referencian `profiles.id`, así que cualquier escritura (`abrir_mes_actual`,
crear una categoría) fallaba con una violación de clave foránea → 500
sin explicación.

Lo diagnostiqué conectándome directo a la base real (mismo
`DATABASE_URL`/`DB_SCHEMA=public` que usan los tests de
`tests/api/`, con `tests/api/ayudas_db.py`) y comparando
`auth.users` contra `public.profiles`. Fue la única forma de encontrarlo:
los tests pasan porque las cuentas de prueba nacen *después* del
trigger y siempre tienen perfil.

**El arreglo** (`api/app/routers/me.py`): la lógica de
`POST /api/me/bootstrap` (crear perfil + sembrar las 21 categorías) se
extrajo a `asegurar_perfil_y_categorias(sesion, usuario)`, reusable, y
ahora también la llaman `GET /api/months` y `GET`/`POST /api/categories`
antes de escribir. Cualquier cuenta sin perfil se autocompleta sola en
el primer pedido — no hace falta que nadie llame a bootstrap a mano.
Tests de regresión reales (perfil borrado a propósito, mismo patrón
que `test_me.py::test_bootstrap_rehace_lo_que_falta`) en
`test_months_endpoints.py` y `test_categories_endpoints.py`.

**Si en el futuro aparece OTRO 500 raro en un endpoint nuevo que
escriba algo con `user_id`**, sospechar primero de esto mismo: ¿la
tabla nueva tiene FK a `profiles.id`? ¿El router llama a
`asegurar_perfil_y_categorias` antes de escribir? Es el mismo patrón
que ya hay que repetir en cada tabla nueva de F04 en adelante
(`transactions` también referencia `profiles.id`).

## Cosas del entorno que cuestan tiempo si se olvidan

- **Python del proyecto:** `python`/`pytest` del PATH global no tienen
  las dependencias. Siempre `./.venv/Scripts/python.exe -m pytest`
  (o `ruff`/`mypy`), no el `python` pelado.
- **mypy:** correr `mypy api/app`, **no** `mypy .` desde la raíz. Con
  un argumento posicional, mypy ignora el `files = ["api/app"]` de
  `pyproject.toml` y encuentra `api/app/main.py` dos veces con dos
  nombres de módulo distintos (`app.main` y `api.app.main`), y falla
  sin que tenga nada que ver con el código. Acotado a `api/app` sale
  limpio.
- **JS: usar `npm test`, no `node --test tests/js/*.test.mjs` a
  mano.** `tests/js/auth.test.mjs` deja vivo un `setInterval` de un
  cliente de Supabase (comentario propio en el archivo, línea ~166);
  sin la flag `--test-force-exit` que ya tiene el script de
  `package.json`, el proceso de Node se queda colgado para siempre
  después de terminar todos los tests. Ya me pasó una vez esta sesión
  (tuve que matar el proceso a mano).
- **Build de Tailwind:** `npm run build` sólo hace falta cuando se
  toca algo en `web/src/styles/` o clases nuevas en el HTML/JS;
  `web/public/app.css` está en `.gitignore`, no se commitea.

## Dato suelto, no urgente: cuentas de prueba huérfanas en producción

Mientras diagnosticaba el bug de arriba, listé `auth.users` en la base
real y hay **decenas** de cuentas `epicwallet.*@example.com`/`.net`
del 2026-10-05, restos de corridas de `tests/api/` cuyo teardown
(`delete from auth.users where id = any(:ids)`) no llegó a correr (la
corrida se habrá cortado a mitad, o se ejecutaron sueltas sin el
fixture completo). No rompen nada —RLS las aísla igual que a cualquier
otra cuenta—, pero ensucian cualquier `select * from auth.users` que
alguien haga a mano para depurar. Si se vuelve molesto, una limpieza
sería: `delete from auth.users where email like 'epicwallet.%@example.%'`.
No lo toqué esta sesión porque no era parte de la tarea.

## Patrones ya establecidos (para no reinventarlos)

- **Capas:** `routers` → `services` (cálculo puro, sin DB) → `repos`
  (consultas, sin decidir nada) → `core`. Un service nuevo se prueba
  con `tests/unit/`, cualquier cosa que toque Postgres de verdad con
  `tests/api/` (marcador `@pytest.mark.api`, `sin_entorno` skip si
  faltan credenciales).
- **RLS en vez de `where user_id = ...` a mano.** Ninguna consulta de
  `repos/` filtra por usuario: `SesionDeUsuario` ya deja a Postgres
  actuando como `auth.uid()` del token. Agregar un filtro propio no
  suma una barrera, suma una línea que puede desalinearse de la que
  de verdad protege.
- **404, nunca 403**, para un recurso de otra cuenta (`_sin_mes`,
  `_sin_categoria`, `_sin_perfil`): no se revela que existe.
- **`IntegrityError` → 409 con mensaje**, nunca un 500 crudo, para las
  violaciones que el frontend puede necesitar explicarle a alguien
  (nombre repetido, borrar algo con histórico).
- **Las dos naturalezas de mes:** `open` saca sus totales de
  `transactions` (cuando exista); `historical` de sus propios campos
  y `transactions: null` —nunca `[]`, nunca inventado.
- **Git:** rama `feat/FXX-TYY-slug` o `fix/...` → commit → merge
  `--no-edit` a `main` con mensaje propio → **`git push origin main`
  siempre**, es instrucción fija de Gustavo (está en la memoria
  persistente del asistente, no sólo acá). Vercel despliega desde
  `main`.
- **Commits:** `tipo(F0X-TYY): descripción corta en minúscula`,
  terminan con `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- **JS de pantallas reales:** módulos ES nativos, sin bundler. Para
  testear un módulo con dependencias (p. ej. `api.js`, `auth.js`), la
  técnica es reescribir la línea de `import` por una versión doblada y
  cargar el archivo resultante como `data:text/javascript;base64,...`
  — ver cualquiera de `tests/js/*.test.mjs` para el patrón exacto
  (`config-cuenta.test.mjs` y `router.test.mjs` son los más completos).
- **Roadmap:** `[ ]` pendiente → `[~]` implementada, esperando prueba
  → `[x]` sólo cuando Gustavo lo dice explícitamente. Nunca marco `[x]`
  yo solo.
