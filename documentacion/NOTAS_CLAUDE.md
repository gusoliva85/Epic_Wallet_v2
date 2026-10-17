# Notas de Claude — no es un documento que manda

Esto **no** es uno de los tres documentos oficiales (`01_Documento_General.md`,
`02_Documento_Tecnico.md`, `03_Roadmap.md`). Es un apunte mío, para mí,
para no releer todo el historial de conversación cada vez que arranca
una sesión nueva. Gustavo pidió que exista; no lo va a leer en general,
pero sabe que está. Si algo de acá contradice los tres documentos
oficiales o el roadmap, **ganan ellos**, esto está desactualizado y hay
que corregirlo o borrarlo.

Última actualización: sesión del 2026-10-17 (ajuste de los gráficos de
Historial + F09-T01 y F09-T03 cerradas + F09-T05 en `[~]`), rama
`main`. Si el repo ya avanzó más, esto es historia vieja —leer el
roadmap primero, y si alcanza con eso, no hace falta leer el resto de
este archivo.

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

**Fases 0 a 7 completas y aprobadas.** Fase 8 (Histórico y carga del
Excel) tiene **F08-T01, F08-T03, F08-T06 y F08-T07 aprobadas**. Queda
**F08-T11 · Carga real del histórico del Excel** (QA), pero Gustavo
dijo explícitamente (2026-10-17) que **no es un bloqueante** y que
sigamos con lo que viene mientras él la termina a su ritmo. No
preguntar de nuevo por su estado salvo que él lo traiga; no se adelanta
sola a `[x]`, eso lo dice él cuando termine y el acumulado coincida con
el Excel.

**Fase 9 (Ahorro acumulado y patrimonio), toda en la misma sesión
(2026-10-17):** **F09-T01 y F09-T03 aprobadas.** **F09-T05 en `[~]`**,
esperando que Gustavo la pruebe desde el celular: saldo inicial
editable (Ajustes → Datos laborales → "Editar"), la vista Patrimonio
con datos reales, y la aclaración en el dashboard de que "Total de
ahorros" no es el patrimonio. Queda **F09-T08** (QA, verificar contra
el Excel) para cerrar la fase.

**F08-T11 no es una tarea de código: depende de que Gustavo termine de
cargar sus datos reales a mano.** Si se retoma esto, lo que corresponde
es preguntar en qué quedó la carga, no escribir nada nuevo sin que él
lo pida. El contexto completo:

- Gustavo tiene su historial real de enero a septiembre 2026 en
  `documentacion/Backup_2026.csv` (nunca se versiona, ver
  `.gitignore`: `documentacion/*.csv`). Es información financiera
  personal de verdad, no un archivo de prueba.
- Construí `scripts/load_history.py` (F08-T06) para cargarlo
  automático, probado y funcionando — pero Gustavo **no quiso darme
  usuario y contraseña por el chat** para que yo lo corra, y prefirió
  cargarlo él mismo a mano desde la hoja "+ Cargar mes histórico" de
  la vista Historial. Decisión suya, no hay que volver a ofrecerle
  el script salvo que él lo pida.
- Para ayudarlo armé un artifact de referencia con los nueve meses ya
  parseados (ingresos, egresos, categoría por categoría, con
  checklist de progreso en `localStorage`):
  <https://claude.ai/artifact/EBxRLRMYiEAdGZ3c8zE4U8> ("Histórico
  2026"). Si hace falta regenerarlo, el parseo real está en
  `scripts/load_history.py::parsear_csv` / `armar_vista_previa` —
  correrlo a mano con el CSV real da los mismos números.
- **Decisiones ya tomadas sobre nombres de categoría** (no volver a
  preguntarlas): "Da Vincci" (sin nada más) se renombra a la
  categoría existente "Da Vinci"; "Da Vincci + Exámenes" y
  "Da Vincci + Matrícula" quedan como categorías propias, separadas;
  "Sube" queda separada de "Subte" (confirmado explícitamente por
  Gustavo, son cosas distintas para él).
- **`profiles.opening_balance` ($4.140.505) todavía no está puesto.**
  Ya existe el campo en la interfaz (Ajustes → Datos laborales →
  "Editar", F09-T05, 2026-10-17) — sigue pendiente sólo porque nadie
  lo cargó todavía, no porque falte la pantalla. Cuando Gustavo
  termine de cargar el histórico (F08-T11) es el momento natural de
  poner este valor también.
- Gustavo ya cargó **septiembre** (al menos la línea de Sueldo) antes
  de que arreglara el bug del ahorro negativo — revisar que ese mes
  haya quedado completo y no a medias.

**Siguiente paso real cuando se retome:** preguntarle a Gustavo cuántos
meses le quedan y si necesita algo más del lado del código para
seguir cargando. Recién cuando los nueve meses estén cargados y él
confirme que el acumulado final coincide con lo que tiene en el
Excel, F08-T11 se marca `[x]` y arranca la Fase 9.

## Lo que pasó con F08-T07 — vale la pena entenderlo antes de tocar algo parecido

La primera versión de la hoja de carga histórica (totales de
ingresos/egresos/ahorro escritos a mano + una lista fija de
categorías de egreso nada más) la rechazó de punta a punta: "esto no
sirve para nada", "no tengo forma de agregar el sueldo". El rediseño
que quedó aprobado es bien distinto, y es el patrón a seguir si
aparece otra pantalla de carga de totales:

- **Una lista dinámica de líneas, no campos de total fijos.** Cada
  línea es una categoría (de ingreso o de egreso, sin distinguir:
  Sueldo es una categoría más) con su importe. Ingresos, egresos y
  ahorro son de **sólo lectura**, sumados desde las líneas visibles
  —mismo criterio que ya usa `services.transactions.recalcular_mes`
  del lado del servidor para sumar un mes en curso: todo por
  `category_id`, sin que la pantalla decida nada.
- **Crear una categoría nueva, sin salir de la hoja.** El selector de
  cada línea tiene una opción "+ Crear categoría nueva…" que abre un
  mini-formulario (nombre + tipo) **dentro de la misma línea**, llama
  a `POST /api/categories` y vuelve a dejar la línea lista para el
  importe. Nunca se abre una segunda hoja encima: `components/sheet.js`
  comparte `#fondo-hoja` entre todas las hojas, así que dos abiertas a
  la vez rompen el velo (ver más abajo, "Patrones ya establecidos").
- **Precargar un mes que ya existe.** Al elegir en el campo "Mes" un
  período que ya tiene datos, se pide `GET /api/months/{id}` (ahora
  devuelve `categories`, se agregó justo para esto) y se reemplazan
  las líneas en blanco por lo que ya está guardado. Sin esto, volver
  a guardar ese mes sin repetir todas las líneas de antes las pisaba
  en silencio —`repos.monthly_category_totals.reemplazar_manuales`
  borra todas las filas del mes y vuelve a insertar sólo lo que llega
  en el pedido—. Es el bug real que Gustavo encontró con septiembre.
- **El botón "+ Agregar categoría" se bloquea con una línea
  incompleta** (sin categoría elegida, o a medio crear). Evita que se
  acumulen líneas sueltas sin sentido.
- Todo esto vive en `web/src/js/historial.js` (un solo archivo para
  el gráfico de evolución, la tabla y la hoja de carga) y se prueba
  en `tests/js/historial.test.mjs` con el HTML recortado del
  `index.html` real.

**Bug de backend que salió de este mismo feedback:**
`services.months.totales_historicos_son_validos` exigía
`saving_total >= 0`. Está mal: un mes donde se gastó más de lo que
entró da un ahorro negativo, y es un resultado válido (Técnico §7.1),
no un error. Ya está corregido —sólo `income_total` y `expense_total`
no pueden ser negativos—, con tests en los tres niveles (unit, API
real, JS). Si en algún lugar nuevo aparece una validación parecida
sobre un total que puede ser negativo legítimamente (el ahorro, una
variación, un rendimiento), repasar que no se le esté pidiendo `>= 0`
por costumbre.

## Qué se construyó (Fases 5 a 8 — resumen, no el detalle línea por línea)

- **`GET /api/dashboard`** (F05-T04): el contrato único del tablero de
  Inicio. Indicadores, serie diaria, últimos seis meses, desglose por
  categoría —todo en una sola llamada, menos de 400 ms.
- **Los 5 gráficos** (`web/src/js/charts/`), con cambio de tema en
  vivo sin JS (todo color sale de `var(--color-*)`).
- **Desglose y detalle de categoría** (Fase 7): `calc.porcentajes_de_categorias`
  (método del mayor resto, suma exacto 100) y la hoja de detalle que
  se abre tocando una categoría o un movimiento.
- **Historial y carga de meses históricos** (Fase 8):
  - `services/months.py`: `totales_historicos_son_validos`,
    `requiere_confirmacion_para_historico` (F08-T01) y
    `recalcular_saldos_acumulados` (F08-T03) —encadena y guarda
    `opening_balance`/`closing_balance` de **todos** los meses del
    usuario cada vez que se crea o corrige un mes histórico—.
  - `POST /api/months/historical` (crea o actualiza por año/mes) y
    `PATCH /api/months/{id}` (corrige uno ya histórico). Convertir un
    mes `open` con movimientos pide `confirm: true`; los movimientos
    **no se borran**, sólo dejan de leerse (Técnico §6.6, y es ahora
    además una regla propia del proyecto, ver más abajo).
  - `GET /api/months` trae `saving_rate` por mes (calculado por el
    router, `calc.tasa_de_ahorro`, `None` con ingresos en cero).
    `GET /api/months/{id}` trae además `categories` —lo que ya está
    guardado por categoría de ese mes, usado para precargar la hoja.
  - `scripts/load_history.py` (F08-T06): parsea el CSV de la planilla
    y carga por la API real. Probado, pero Gustavo eligió no usarlo
    esta vez (ver arriba).
  - La vista Historial completa (F08-T07): tabla real, gráfico de
    evolución del ahorro (ya desde F06-T07) y la hoja de carga
    rediseñada (ver la sección de arriba).
- **Ahorro acumulado y patrimonio (Fase 9, 2026-10-17):**
  - **F09-T01 ya estaba hecha.** `services/calc.py` (`ahorro_acumulado`,
    `serie_de_ahorro_acumulado`, `total_de_inversiones`,
    `patrimonio_neto`) se construyó de punta a punta en F05-T01, junto
    con el resto de los indicadores — nadie lo había marcado en el
    roadmap. `tests/unit/test_calc.py` ya cubría los tres criterios de
    aceptación. Se detectó al retomar la Fase 9 y se cerró sin escribir
    código nuevo, sólo agregando `calc.total_de_pasivos` (simétrica a
    `total_de_inversiones`) para F09-T03.
  - **`GET /api/patrimony`** (F09-T03): una foto de ahora (sin
    navegación de mes, a diferencia del dashboard) con
    `savings_balance`, `investments_value`, `liabilities_total`,
    `net_worth` y `composition` (`savings_share`/`investments_share`,
    método del mayor resto, suman 100 — o `null` los dos si no hay nada
    que repartir). "Su evolución" del enunciado de la tarea **no** se
    construyó como serie histórica: el técnico (§14.2) deja la
    evolución patrimonial completa para después del MVP.
  - **Tabla `liabilities`** (modelo `Liability`, repo
    `repos/liabilities.py`, migración `52214f48b025`): se crea vacía y
    con RLS, tal cual pide el técnico §6.2 ("preparado, no se usa en
    el MVP") — no tiene endpoint propio de alta/baja, y no lo va a
    tener hasta que haya una pantalla real. `services/dashboard.py`
    pasó a restar pasivos reales de `patrimonio_neto` (antes era un
    cero fijo).
  - El `autogenerate` de esta migración trajo de regalo un montón de
    "foreign key removida/agregada" en `categories`, `months`,
    `transactions`, etc. — **falso positivo conocido** de Alembic
    comparando nombres de esquema calificados contra sin calificar, no
    un cambio real. Se descartó esa parte a mano antes de aplicar. Si
    vuelve a aparecer en la próxima migración, es lo mismo: revisar que
    el `create_table`/`drop_table` de la tabla nueva sea lo único que
    quede.
  - **Saldo inicial y vista de Patrimonio real (F09-T05, misma sesión):**
    `PATCH /api/me` llama a `recalcular_saldos_acumulados` cuando
    `opening_balance` viene en el pedido (antes sólo lo llamaban los
    endpoints de histórico) — es el criterio de aceptación "cambiar el
    saldo inicial recalcula todo el acumulado", probado contra la base
    real en `tests/api/test_me.py`. La hoja de edición vive en Ajustes
    → Datos laborales (botón "Editar"), un solo campo —
    `web/src/js/saldo-inicial.js`—; las otras tres fichas de esa
    tarjeta (sueldo, vigencia, primer mes) siguen siendo de muestra,
    es historial salarial y queda después del MVP. La vista Patrimonio
    (`web/src/js/patrimonio.js`) ya pinta la ecuación y la barra de
    composición con `GET /api/patrimony`, sin "datos de ejemplo" en
    ningún lado; sin ahorro ni inversiones (cuenta nueva) muestra el
    estado vacío, nunca un porcentaje inventado. En el dashboard, la
    ficha "Total de ahorros" dice "Total acumulado mensual" (texto
    fijo): el primer intento —"Sin inversiones — ver Patrimonio" más
    un `ghost-note` al pie de Inicio— no le sirvió a Gustavo ("no
    suma"), y lo sacó. Dos lecciones de la misma ronda de feedback,
    las dos ya aplicadas y conviene no repetir el error: (1) un botón
    `.btn` liso (sin `--principal`) sobre el vidrio translúcido de una
    tarjeta no se distingue de texto — la solución no es "achicarlo",
    es `--principal` (fondo sólido) además de compacto; y (2) `.card`
    no tiene padding propio — `.card-head`/`.kv-grid`/`.rows` traen el
    suyo (14 px), así que cualquier contenido puesto directo en una
    tarjeta (un formulario, un botón suelto) necesita su propio
    envoltorio con ese mismo margen (`.card-body`, agregado para
    Cuenta) o queda pegado al borde.
  - **Tres retoques más de la misma ronda de feedback (2026-10-17):**
    `datos-muestra.js::ALERTAS` quedó vacía a propósito —la campanita
    mostraba "4" sin que hubiera una sola alerta real; el ícono se
    esconde solo con la lista en cero (`conectarAlertas` en
    `views/vistas.js`), no hacía falta tocar nada más—. "Cerrar
    sesión" se mudó de la tarjeta Cuenta a una tarjeta "Sesión" propia,
    al final de Ajustes (después de Copia de seguridad); sigue
    conectado por `config-cuenta.js`, el id no cambió, sólo el lugar
    en el documento —`tests/js/config-cuenta.test.mjs` ahora arma el
    DOM con dos recortes de `index.html`, Cuenta y Sesión, por
    separado—. Y `charts/ahorro.js` (evolución del ahorro) pasó de
    marcar sólo el mes más reciente a marcar **todos**: un punto y su
    valor exacto por mes cargado, no sólo una línea — el último sigue
    con la etiqueta a la izquierda del punto para no salirse del borde
    derecho, los demás centrados arriba del suyo.

## Cosas que NO están hechas y conviene no asumir que sí

- **El histórico real de Gustavo (enero–septiembre 2026) está a medio
  cargar.** Ver la sección de arriba, es lo más importante de esta
  nota.
- **El acumulado del mes en curso puede quedar un paso atrás en
  `GET /api/months`** si se carga un movimiento nuevo sin que se toque
  ningún mes histórico ni el saldo inicial después: `recalcular_saldos_acumulados`
  la llaman los endpoints de histórico y `PATCH /api/me` (F09-T05), pero no
  `services.transactions.recalcular_y_guardar_mes` (F04-T05, ya
  aprobada, decidí no tocarla para no reabrir una tarea cerrada). El
  tablero de Inicio, la evolución del ahorro y Patrimonio no tienen
  este problema: calculan el acumulado al vuelo, siempre en vivo. Si
  esto llega a confundir a Gustavo viendo la tabla de Historial, la
  solución es agregar la misma llamada al final de
  `recalcular_y_guardar_mes`, no rediseñar nada.

## Regla nueva del proyecto: no se eliminan datos reales sin avisar

Gustavo la pidió explícitamente (2026-10-15), después de ver que el
agente corre scripts y migraciones contra la base real. Ya está en
`CLAUDE.md` § "Cosas que no se pueden romper", resumida: **ningún
fix, migración ni script corre un `DELETE`, `TRUNCATE` o `DROP` contra
la base real sin explicar antes qué se va a borrar y esperar
confirmación explícita.** No aplica a cuentas de prueba de QA (se
siguen creando y borrando libremente dentro de una misma tarea) ni a
lo que la aplicación ya le permite hacer a Gustavo desde la interfaz
(borrar un movimiento, vender una inversión).

Consecuencia directa de esto en F08-T06/T07: convertir un mes `open`
con movimientos a histórico **nunca borra esos movimientos** —quedan
en la base, simplemente dejan de leerse (la columna `status` decide
qué se muestra). Cualquier operación nueva que "reemplace" datos
históricos (totales por categoría, por ejemplo) tiene que seguir el
mismo criterio: borrar y reinsertar un resumen derivado está bien
(`monthly_category_totals` ya es así desde F04-T05), borrar datos que
la persona cargó a mano no.

## El "cold-boot 401": un problema del entorno, no de la aplicación

Varias veces, al crear una cuenta de prueba nueva y loguearse por la
UI real (Playwright + Chromium) para hacer QA visual de punta a
punta, las primeras llamadas a la API daban 401 de forma persistente
—ni uno ni varios `page.reload()` lo arreglaban siempre—. **No es un
bug de la aplicación**: los mismos endpoints, con las mismas cuentas,
funcionan sin problema llamados directo por HTTP (`tests/api/`, con
pytest). El problema es específico de levantar el navegador local
contra el cliente de Supabase del frontend.

**Qué hacer cuando bloquea una prueba visual:** no insistir mucho
tiempo con reintentos de login. Armar un harness aislado sin
autenticación —un `.html` suelto en `web/` (nunca commiteado) que
importa los módulos JS reales con datos de prueba fijos— y manejarlo
con Playwright para capturas y chequeos de geometría.

**Actualización de la sesión F08:** esta vez no hubo ninguna
herramienta de navegador disponible, ni siquiera para intentar el
harness de arriba. Toda la verificación de interfaz fue por
comportamiento —`tests/js/*.test.mjs` con jsdom, HTML recortado del
`index.html` real— y toda la verificación visual la hizo Gustavo
directamente en su celular, con comentarios detallados de usabilidad
que terminaron en el rediseño de F08-T07. Funcionó bien como
alternativa completa cuando no hay navegador a mano: tests de
comportamiento + que la persona mire la pantalla de verdad, en vez de
forzar una herramienta de navegador que no está disponible.

## Cosas del entorno que cuestan tiempo si se olvidan

- **Python del proyecto:** `python`/`pytest` del PATH global no tienen
  las dependencias. Siempre `./.venv/Scripts/python.exe -m pytest`
  (o `ruff`/`mypy`), no el `python` pelado.
- **mypy:** correr `mypy api/app` (o archivos puntuales dentro de ahí),
  **no** `mypy .` desde la raíz.
- **JS: usar `npm test`, no `node --test tests/js/*.test.mjs` a mano**
  sin `--test-force-exit` (ya lo tiene el script de `package.json`) —
  `auth.test.mjs` deja vivo un `setInterval` que cuelga el proceso.
- **Build de Tailwind:** `npm run build` hace falta cada vez que se
  toca algo en `web/src/styles/` o se agrega una clase CSS nueva
  usada sólo en HTML/JS. `web/public/app.css` está en `.gitignore`.
- **No correr dos `pytest` completos en paralelo** contra la base
  real: pisan las mismas cuentas de prueba.
- **`documentacion/*.csv` está en `.gitignore`** (agregado en F08):
  cualquier CSV con datos reales que Gustavo deje ahí para una carga
  asistida no se versiona.
- **Scratchpad y QA descartable:** scripts y fixtures temporales se
  escriben, se usan y se borran siempre antes de terminar la tarea —
  nunca se commitean. Cuentas de Supabase de prueba creadas para QA
  se borran con el service role key al terminar.

## Patrones ya establecidos (para no reinventarlos)

- **Capas:** `routers` → `services` (cálculo puro, sin DB) → `repos`
  (consultas, sin decidir nada) → `core`. Un service nuevo se prueba
  con `tests/unit/`, cualquier cosa que toque Postgres de verdad con
  `tests/api/` (marcador `@pytest.mark.api`, `sin_entorno` skip si
  faltan credenciales).
- **RLS en vez de `where user_id = ...` a mano.** Ninguna consulta de
  `repos/` filtra por usuario: `SesionDeUsuario` ya deja a Postgres
  actuando como `auth.uid()` del token.
- **404, nunca 403**, para un recurso de otra cuenta. **`IntegrityError`
  → 409 con mensaje**, nunca un 500 crudo.
- **Las dos naturalezas de mes:** `open` saca sus totales de
  `transactions`; `historical` de sus propios campos y
  `transactions: null` —nunca `[]`, nunca inventado.
  `services/months.py::transacciones_del_mes` es el helper compartido.
- **Frontend nunca calcula dinero** — con una excepción explícita y
  deliberada: una resta trivial sobre dos números que la persona ya
  está escribiendo en la MISMA pantalla (ingresos − egresos = ahorro,
  en la hoja de carga histórica) no es "lógica financiera que viene
  del backend", es formatear lo que ya está ahí. La frontera sigue
  siendo la misma: si el número hay que traerlo de otro lado o
  decidir algo sobre él, va al backend.
- **Porcentajes que tienen que sumar 100 exacto:** método del mayor
  resto (`calc.porcentajes_de_categorias`), no redondeo independiente.
- **Un gráfico de barras/puntos por mes con `preserveAspectRatio="none"`
  nunca reparte `slot = ancho / cantidadDeMeses`.** Con pocos meses
  cargados eso estira el espacio entre uno y el siguiente en vez de
  achicarlo —Gustavo lo reportó dos veces en `charts/seis.js` y
  `charts/ahorro.js` (2026-10-17) antes de que quedara bien—. El
  arreglo: `slot` fijo en el que tendría un semestre completo (`iw / 6`,
  nunca más chico) y el grupo alineado a la derecha (`inicioX = PL + iw
  - slot * n`), así el mes más nuevo no cambia de lugar al cargar uno
  más viejo y lo que sobra con pocos meses es margen vacío, no
  distancia. Mismo criterio para cualquier gráfico nuevo con pocos
  puntos posibles.
- **Dos hojas no andan bien a la vez.** `components/sheet.js` comparte
  `#fondo-hoja`: cerrar la de arriba le saca el velo a la de abajo
  aunque siga abierta. Patrón para "necesito otra acción sin perder
  el contexto de esta hoja": un sub-estado **dentro** de la misma
  hoja (mostrar/ocultar un bloque interno, como la creación de
  categoría en F08-T07), nunca abrir una segunda hoja encima.
- **Git: directo a `main`, no hay ramas `feat/...` en esta sesión.**
  `git push origin main` apenas se cierra o se corrige algo —nunca
  dejar un cierre sólo en commit local.
- **Commits:** `tipo(F0X-TYY): descripción corta en minúscula`,
  terminan con `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
  Un cierre de tarea aprobada es su propio commit: `docs(F0X-TYY):
  cierra la tarea, aprobada`.
- **JS de pantallas reales:** módulos ES nativos, sin bundler. Para
  testear un módulo con dependencias, la técnica es reescribir cada
  línea de `import` por una versión doblada (red/eventos/módulos
  pesados) o por un `import` real apuntando a un `file:///` absoluto
  (formato/componentes puros), cargado como
  `data:text/javascript;base64,...`. Ver `historial.test.mjs` o
  `config-categorias.test.mjs` para el patrón completo —incluido
  cómo doblar `api.post` enrutando por path cuando un mismo módulo
  llama a más de un endpoint. `crearHoja` se importa real pero con
  `?t=${Math.random()}` al final de la URL, para que su estado interno
  no quede compartido entre archivos de test.
- **El HTML de un test se recorta del `index.html` real**, nunca se
  reescribe a mano: así una prueba nota si el `id` que usa el JS deja
  de existir en la plantilla (buscar el ancla con `indexOf`, cortar
  con `lastIndexOf("<section"/"<aside", ancla)` y `indexOf("</section>"/"</aside>", ancla)`).
- **jsdom no implementa varias APIs de geometría SVG/puntero:**
  `getBBox()`, `setPointerCapture()`, `getScreenCTM()`,
  `getBoundingClientRect()`. Cualquier test que dibuje algo que
  dependa de eso necesita mockear esos métodos en el
  `SVGElement.prototype` del `window` de esa prueba.
- **Roadmap:** `[ ]` pendiente → `[~]` implementada, esperando prueba
  → `[x]` sólo cuando Gustavo lo dice explícitamente. Un feedback de
  usabilidad fuerte después de un primer `[x]` puede volver la tarea a
  `[~]` para que la reapruebe sobre la versión corregida —pasó con
  F08-T07, está bien que pase.
- **Antes de tocar datos reales con un script, una migración o un
  fix: explicar qué se va a hacer y esperar que Gustavo diga que sí.**
  Ver la sección de arriba sobre la regla nueva. Si hace falta
  ejecutar algo contra su cuenta real y requiere sus credenciales,
  **no pedírselas por el chat** salvo que él las ofrezca —dejar que
  lo haga él mismo desde la interfaz, aunque sea más lento.
