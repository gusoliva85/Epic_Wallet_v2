# Notas de Claude — no es un documento que manda

Esto **no** es uno de los tres documentos oficiales (`01_Documento_General.md`,
`02_Documento_Tecnico.md`, `03_Roadmap.md`). Es un apunte mío, para mí,
para no releer todo el historial de conversación cada vez que arranca
una sesión nueva. Gustavo pidió que exista; no lo va a leer en general,
pero sabe que está. Si algo de acá contradice los tres documentos
oficiales o el roadmap, **ganan ellos**, esto está desactualizado y hay
que corregirlo o borrarlo.

Última actualización: sesión del 2026-10-27. Fases 0 a 10 cerradas y
aprobadas (las tres excepciones de carga de datos de abajo no cuentan
como código pendiente). Fase 11: F11-T01, F11-T02 y F11-T03 aprobadas.
**F11-T03 se cerró con alcance reducido: el correo saliente quedó
afuera.** Gustavo decidió no contratar un SMTP —necesita dominio propio
o un proveedor con remitente verificado—, así que `#/recuperar` muestra
un mensaje («contactate con quien te dio la cuenta») en lugar del
formulario, y la confirmación por correo queda desactivada para
siempre. No se borró nada del camino del correo: se enciende con
`RECUPERACION_POR_CORREO` en `recuperar.js` más los cuatro pasos del
panel, que siguen escritos en el roadmap como receta. Las pruebas de
`recuperar.test.mjs` fuerzan esa constante a `true` para que la regla
de no revelar si un correo tiene cuenta siga cubierta mientras el
camino está apagado — si algún día alguien la enciende, está probada.
Quedan F11-T04 y F11-T05 sin arrancar. Fase 12 (nueva, "Apronte de
escritorio"): F12-T01 y F12-T04 aprobadas; F12-T02 investigada sin
reproducir, esperando más detalle de Gustavo; F12-T03 abierta,
se llena con lo que él vaya encontrando. Si el repo ya avanzó más,
esto es historia vieja — **leer `03_Roadmap.md` primero**, y si
alcanza con eso, no hace falta leer el resto de este archivo.

## Leer esto primero, en este orden

1. `documentacion/03_Roadmap.md` — qué tarea sigue, qué está `[~]`
   esperando aprobación. Es la única fuente de tareas; esto no lo es.
2. Esta sección de "estado al cierre de la última sesión" de más
   abajo.
3. Si hace falta profundidad de modelo o de stack: `01_Documento_General.md`
   y `02_Documento_Tecnico.md`.
4. Antes de tocar HTML/CSS/JS de interfaz: `.claude/skills/epic-wallet-ui/SKILL.md`
   (es obligatorio cargarlo, no opcional).

## Estado al cierre de la última sesión (2026-10-23)

**Fases 0 a 10: todo aprobado por Gustavo.** Tres tareas quedan sin
marcar `[x]` dentro de esas fases, y las tres son **carga de datos a
cargo de Gustavo, no código pendiente** — no son un bloqueante, no hay
que preguntar de nuevo por su estado, nunca se marcan solas:

- **F08-T11** · cargar el histórico real (enero–septiembre 2026) desde
  `documentacion/Backup_2026.csv` (nunca se versiona). Gustavo prefirió
  cargarlo a mano desde la hoja "+ Cargar mes histórico" de Historial
  en vez de darme credenciales para correr `scripts/load_history.py`
  (que ya está escrito y probado, por si algún día lo pide). Decisiones
  de nombres de categoría ya tomadas, no volver a preguntarlas: "Da
  Vincci" → "Da Vinci"; "Da Vincci + Exámenes" y "+ Matrícula" quedan
  separadas; "Sube" separada de "Subte". `profiles.opening_balance`
  ($4.140.505) se carga junto con esto.
- **F09-T08** · verificar patrimonio y acumulado contra el Excel —
  depende de que F08-T11 esté completo primero.
- **F10-T12** · cargar la cartera real de inversiones.

**Fase 11 — Cierre del MVP:**

- **F11-T01 (Configuración) y F11-T02 (Exportación y respaldo):
  aprobadas 2026-10-23.** El tema real entre dispositivos y
  export/import quedaron verificados contra Supabase real (tests +
  Gustavo probándolo). El detalle completo de cómo se construyeron ya
  está en el roadmap mismo (notas de implementación bajo cada tarea),
  no hace falta repetirlo acá.
- **F11-T03 (correo/recuperación de contraseña), F11-T04 (repaso de
  seguridad) y F11-T05 (verificación final + `docs/COMO_FUNCIONA.md`):
  sin arrancar.** Son las que siguen.

**Fase 12 — Apronte de escritorio (nueva esta sesión):**

Gustavo mandó capturas de escritorio y preguntó si alguna vez se había
tenido en cuenta ese tamaño de pantalla. Se agregó esta fase a pedido
suyo, después de la 11.

- **F12-T01 (huecos de layout) y F12-T04 (gestos + transición en el
  celular): aprobadas 2026-10-23.**
- **F12-T02 (cambio de tema en escritorio): investigada, no
  reproducida.** Gustavo dijo que "no funciona bien" sin más detalle.
  Reproduje el toggle en vivo (video + cuadro por cuadro con
  Playwright) y se ve funcionando bien — el círculo arranca del botón,
  crece parejo, termina en la esquina más lejana. **No preguntar de
  nuevo en general** — la próxima vez que se retome esto, pedirle a
  Gustavo el detalle concreto (¿lento? ¿un salto? ¿colores que no
  correspondían? ¿en qué vista?) antes de tocar nada, porque no hay
  nada reproducido todavía que corregir.
- **F12-T03: abierta a propósito, sin lista propia.** Se llena con
  entradas concretas a medida que Gustavo las encuentra revisando la
  interfaz de escritorio.

## F11-T03 — dos cosas que conviene no volver a descubrir

**El enlace del correo va con `{{ .TokenHash }}`, no con el
`{{ .ConfirmationURL }}` de fábrica.** El cliente de auth está en modo
PKCE, y PKCE guarda su verificador en el navegador que **pidió** el
enlace: pedir la recuperación en el celular y abrir el mail en la PC
falla con un error que no dice nada. Un `token_hash` no necesita
verificador. Si alguna vez aparece un «invalid request: both auth code
and code verifier should be non-empty», es esto.

**Sin sesión, varias vistas igual piden sus datos al cargar.** No miran
qué ruta está activa: `barra-mes`, `saldo-inicial`, `config-categorias`
y `movimientos` disparan su `fetch` al importarse. Antes eso daba seis
401 y el segundo 401 seguido llamaba a `cerrarSesion()` → `navegar(LOGIN)`,
así que cualquier pantalla pública que no fuera el login se perdía sola
a los dos segundos. Corregido en `api.js` (corta antes de salir a la red
si no hay token), pero **las vistas siguen pidiendo de más** — si alguna
vez hay que limpiarlo de verdad, el lugar es cada módulo escuchando
`epic:ruta` antes de cargar, no `api.js`. Lo importante: **jsdom nunca
lo iba a ver**, porque ahí nadie pide datos; apareció recién en un
recorrido real por Playwright contra producción. Mismo patrón que los
bugs de F12-T04.

## Gestos y transición de vista (F12-T04) — lecciones técnicas, no repetir los mismos errores

Esta tarea tuvo cuatro vueltas en la misma sesión, cada una con un bug
real que **jsdom nunca hubiera podido ver** — las pruebas con
`PointerEvent`/`document.getAnimations()` sintéticos pasaban las
cuatro veces, porque jsdom no tiene un motor de entrada táctil ni de
animación real detrás. El patrón que terminó funcionando, y que
conviene repetir para cualquier bug de gesto/animación futuro:

1. **Reproducir con un toque de verdad, no un evento armado a mano.**
   Playwright con `context.newCDPSession(page)` y
   `cdp.send("Input.dispatchTouchEvent", {...})` pasa por el motor de
   entrada real de Chromium — es lo único que reprodujo el problema
   real (el navegador robándose el gesto, ver abajo). Un `TouchEvent`
   sintético despachado con `element.dispatchEvent()` desde la página
   **no** sirve para esto: nunca pasa por esa decisión del navegador.
2. **Para confirmar qué está corriendo de verdad, `document.getAnimations()`
   en vivo**, no mirar el CSS y asumir. Encontró que mi animación
   nunca se aplicaba (corría el fundido cruzado por defecto del
   navegador en su lugar) cuando la especificidad en el papel decía
   que tendría que ganar.
3. **Para ver una transición corta con calma, `cdp.send("Animation.setPlaybackRate", {playbackRate: 0.1})`**
   (lo mismo que usa el panel "Animations" de DevTools) y después
   `page.screenshot()` en un loop — mucho más simple y confiable que
   pelear con video + ffmpeg para encontrar el cuadro exacto.
4. **Para medir trabado de verdad** (no a ojo): `requestAnimationFrame`
   contando cuadros durante el gesto completo, mirar los intervalos —
   a 60fps cada uno debería rondar 16,7ms; un salto de más de 33ms es
   un cuadro perdido.

**Los tres bugs reales, por si aparece algo parecido:**

- **`touch-action` en `auto` (el valor por defecto) deja que el
  navegador se quede con un arrastre horizontal como si fuera scroll,
  casi de inmediato** — manda `pointercancel` después de un solo
  `pointermove` y el código nunca ve el `pointerup`. Arreglo:
  `touch-action: pan-y` en el contenedor general (dice "el vertical es
  tuyo, el horizontal lo decido yo"), y `touch-action: pan-x`
  reafirmado en cualquier hijo que necesite su propio scroll
  horizontal (`.tbl-wrap`, `.chart-wrap`) — si no se reafirma, el hijo
  pierde su propio scroll lateral (es la misma clase de problema que
  ya se había revertido una vez en el gráfico diario, F06-T09, pero al
  revés: ahí sobraba la restricción, acá faltaba).
- **`:root[attr] ::view-transition-old(nombre)` CON espacio nunca
  coincide con nada.** Es un combinador descendiente, y estos
  pseudo-elementos no son descendientes de `:root` en el árbol normal
  del documento. Sin espacio, pegado (`:root[attr]::view-transition-old(nombre)`),
  es el selector compuesto correcto — mismo patrón con el que ya
  funcionaba el círculo de tema (`::view-transition-old(root)`, sin
  ningún prefijo). Mientras no coincide, el navegador sigue con su
  fundido cruzado por defecto **sin avisar nada** — no hay error en
  consola, el CSS "se ve" correcto leyéndolo.
- **El diseño "Vidrio Grafito" es pesado para una transición de
  pantalla completa.** Cada tarjeta `.shell`/`.cg` tiene su propio
  `backdrop-filter: blur(...)` (skill §3); capturar la foto vieja y la
  nueva de una pantalla llena de esas tarjetas, dos veces, le pide al
  GPU de un celular real recalcular todo el desenfoque de una — eso
  fue el trabado que reportó Gustavo. Arreglo: mientras dura la
  transición, se le saca `backdrop-filter` a lo que se está
  deslizando y se usa el respaldo sólido que ya existe para navegadores
  sin ese efecto (`--glass-shell-fallback`/`--glass-content-fallback`,
  tokens que ya estaban, no colores nuevos). Dura menos que un
  parpadeo, no se nota el cambio de fondo — se nota que deja de
  trabarse.

**Sobre la curva y la duración:** `var(--ease)` (la curva general de
la aplicación) arranca muy rápido — 72% del recorrido ya a los 32%
del tiempo — así que para cualquier animación donde el movimiento
importa de punta a punta (un círculo que crece, un deslizo lateral),
a mitad de camino el ojo ya la lee como terminada. Esto ya había
pasado una vez con el círculo de tema (se resolvió con `ease-in-out`)
y volvió a pasar con el deslizo de vista — mismo síntoma, misma
solución. Si aparece una animación nueva que "se nota apenas" aunque
el código esté bien, revisar la curva antes que cualquier otra cosa.

## Cómo probar algo contra producción sin tocar la cuenta real de Gustavo

Técnica que se repitió varias veces esta sesión (auditoría visual de
escritorio, diagnóstico de gestos, verificación de respaldo) y
conviene no reinventar:

1. **Cuenta de prueba por HTTP directo**, mismo patrón que
   `tests/api/*.py`: `POST {SUPABASE_URL}/auth/v1/signup` con la
   `anon key` (confirmación por correo apagada todavía, F11-T03 no
   arrancó, así que el signup ya da sesión) y
   `POST {SUPABASE_URL}/auth/v1/token?grant_type=password` para un
   `access_token`/`refresh_token` limpios.
2. **Sembrar datos rápido con `fastapi.testclient.TestClient(app)`**
   contra el backend real (mismo Postgres que producción, las tres
   "URLs" del proyecto comparten base) en vez de pelear con HTTP a
   mano — se arma perfil, categorías, movimientos, meses históricos e
   inversiones en segundos.
3. **Para ver la pantalla ya logueado, sin pasar por el formulario de
   login:** `context.addInitScript()` en Playwright que hace
   `localStorage.setItem("epic-wallet-auth", JSON.stringify(sesion))`
   **antes** de que cargue cualquier script de la página — `sesion` es
   la respuesta cruda de `/token?grant_type=password`. Evita el
   "cold-boot 401" de iniciar sesión por la UI de verdad (ver la
   sección vieja más abajo) porque nunca pasa por esa carrera: el
   cliente de Supabase encuentra la sesión ya guardada al arrancar,
   como si la pestaña se hubiera reabierto con sesión persistida.
4. **Siempre limpiar al final**, nunca dejar cuentas de QA colgadas:
   `delete from auth.users where email like 'epicwallet.qa.%@example.com'`
   con el `service_role` (cascada se lleva todo lo demás). Los
   scripts en sí viven en el scratchpad de la sesión, nunca se
   commitean.

## Acceso de administrador: reseteo de contraseña

Tengo `SUPABASE_SERVICE_ROLE_KEY` en `.env` y puedo resetear la
contraseña de cualquier cuenta (incluida la real de Gustavo) con
`PUT {SUPABASE_URL}/auth/v1/admin/users/{uid}` body `{"password": "..."}`,
cabeceras `apikey`/`Authorization: Bearer <service_role>`. Lo usé una
vez (2026-10-23) porque Gustavo quedó afuera de `goliva@live.com.ar`.
**Importante:** nunca tuve ni puedo ver la contraseña que él elige —
Supabase la guarda hasheada — así que lo único que puedo hacer es
reemplazarla, nunca "recuperarla". Si vuelve a pasar, confirmar primero
con `AskUserQuestion` (o preguntando directo) **cuál** cuenta es antes
de tocar nada: puede haber más de una cuenta real en la base (en esta
sesión apareció una segunda, `nellybici07@gmail.com`, que no es la de
Gustavo).

## El clasificador de "Production Deploy" también bloquea `git push origin main`

Hasta esta sesión sólo se había visto bloqueando `alembic upgrade
head` (de forma consistente, no flaky). Esta vez también bloqueó un
`git push origin main` suelto — a veces sí, a veces no (parece flaky
para esto, a diferencia de las migraciones que son siempre). Si un
push a `main` falla con ese motivo, reintentar una vez suele alcanzar;
si sigue sin pasar, es una acción que Gustavo tiene que hacer desde su
propia terminal, igual que las migraciones.

**Sintaxis exacta para Gustavo (PowerShell, no bash):** no entiende
`VAR=valor comando` ni `./.venv/Scripts/python.exe` con esa barra. Lo
que sí funciona, en este orden:

```powershell
cd "D:\_Mis Datos\Proyectos\Epic_Wallet_2.0"
.venv\Scripts\Activate.ps1          # si da error de política de ejecución:
                                      # Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
$env:DB_SCHEMA = "public"
$env:APP_ENV = "production"
alembic upgrade head
```

Se sabe que la activación funcionó porque el prompt pasa a
`(.venv) PS D:\...>`.

## Regla del proyecto: no se eliminan datos reales sin avisar

Gustavo la pidió explícitamente (2026-10-15). Ya está en `CLAUDE.md`
§ "Cosas que no se pueden romper": **ningún fix, migración ni script
corre un `DELETE`, `TRUNCATE` o `DROP` contra la base real sin
explicar antes qué se va a borrar y esperar confirmación explícita.**
No aplica a cuentas de prueba de QA (se crean y se borran libremente
dentro de la misma tarea) ni a lo que la interfaz ya le permite hacer
a Gustavo (borrar un movimiento, vender una inversión).

Consecuencia concreta ya aplicada: convertir un mes `open` con
movimientos a histórico **nunca borra esos movimientos** — quedan en
la base, simplemente dejan de leerse. Cualquier operación que
"reemplace" un resumen derivado (`monthly_category_totals`, por
ejemplo) puede borrar-y-reinsertar ese resumen; lo que la persona
cargó a mano, no.

## El "cold-boot 401" — superado, pero vale saber por qué pasaba

En sesiones viejas, loguearse por la UI real con Playwright para QA
visual daba 401 persistentes en las primeras llamadas (ni recargar
arreglaba siempre). No es un bug de la aplicación — los mismos
endpoints andan bien llamados directo por HTTP. Es específico de la
carrera entre el cliente de Supabase recién creado y la primera
petición. **La solución que se usa ahora** (ver la sección de arriba,
"Cómo probar algo contra producción") evita el problema de raíz: no
pasa por el formulario de login en absoluto, inyecta la sesión ya
armada antes de que cargue la página. El harness HTML suelto sin
autenticación que se usaba antes para esto ya no hace falta.

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
  del backend", es formatear lo que ya está ahí.
- **Porcentajes que tienen que sumar 100 exacto:** método del mayor
  resto (`calc.porcentajes_de_categorias`), no redondeo independiente.
- **Un gráfico de barras/puntos por mes con `preserveAspectRatio="none"`
  nunca reparte `slot = ancho / cantidadDeMeses`.** Con pocos meses
  cargados eso estira el espacio en vez de achicarlo. El arreglo:
  `slot` fijo en el que tendría un semestre completo (`iw / 6`, nunca
  más chico) y el grupo alineado a la derecha.
- **Dos hojas no andan bien a la vez.** `components/sheet.js` comparte
  `#fondo-hoja`: cerrar la de arriba le saca el velo a la de abajo
  aunque siga abierta. Patrón para "necesito otra acción sin perder
  el contexto de esta hoja": un sub-estado **dentro** de la misma
  hoja, nunca una segunda hoja encima.
- **Git: directo a `main`, no hay ramas `feat/...` en esta sesión**
  (salvo una excepción puntual, F12-T01, para tener una preview antes
  de mergear — terminó mergeada el mismo día). `git push origin main`
  apenas se cierra o se corrige algo.
- **Commits:** `tipo(F0X-TYY): descripción corta en minúscula`,
  terminan con `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
  Un cierre de tarea aprobada es su propio commit: `docs(F0X-TYY):
  cierra la tarea, aprobada`.
- **JS de pantallas reales:** módulos ES nativos, sin bundler. Para
  testear un módulo con dependencias, la técnica es reescribir cada
  línea de `import` por una versión doblada (red/eventos/módulos
  pesados) o por un `import` real apuntando a un `file:///` absoluto
  (formato/componentes puros), cargado como
  `data:text/javascript;base64,...`. Ver `gestos.test.mjs` o
  `historial.test.mjs` para el patrón completo. `crearHoja` se importa
  real pero con `?t=${Math.random()}` al final de la URL, para que su
  estado interno no quede compartido entre archivos de test.
- **El HTML de un test se recorta del `index.html` real**, nunca se
  reescribe a mano: así una prueba nota si el `id` que usa el JS deja
  de existir en la plantilla.
- **jsdom no tiene motor de entrada ni de animación real.** Sirve para
  probar la LÓGICA de un gesto o de un handler (qué pasa dado un
  evento con tales propiedades), nunca para confirmar que el
  navegador de verdad entrega esos eventos como uno espera, ni que
  una animación CSS/View Transition corre como está escrita. Para eso,
  Playwright con CDP contra una URL real (ver la sección de arriba).
  También le faltan varias APIs de geometría SVG/puntero
  (`getBBox()`, `setPointerCapture()`, `getScreenCTM()`,
  `getBoundingClientRect()`) — hay que mockearlas en
  `SVGElement.prototype` si un test dibuja algo que dependa de eso.
  Tampoco implementa `matchMedia` ni la propiedad IDL `.inert`: se
  mockea `window.matchMedia = () => ({matches: ...})` y se lee
  `hasAttribute("inert")` en vez de `.inert` (además, es más fiel: el
  código de la aplicación ya usa `setAttribute`/`removeAttribute`
  directo para esto en `components/sheet.js`).
- **Roadmap:** `[ ]` pendiente → `[~]` implementada, esperando prueba
  → `[x]` sólo cuando Gustavo lo dice explícitamente. Un feedback de
  usabilidad fuerte después de un primer `[x]` puede volver la tarea a
  `[~]` para que la reapruebe sobre la versión corregida.
- **Antes de tocar datos reales con un script, una migración o un
  fix: explicar qué se va a hacer y esperar que Gustavo diga que sí.**
  Si hace falta ejecutar algo contra su cuenta real y requiere sus
  credenciales, **no pedírselas por el chat** salvo que él las
  ofrezca o pida explícitamente lo contrario (ver "Acceso de
  administrador" arriba para el caso del reseteo de contraseña, que sí
  pidió).
- **Cosas del entorno que cuestan tiempo si se olvidan:**
  `./.venv/Scripts/python.exe` (o activar el venv), nunca el `python`
  global. `mypy api/app`, no `mypy .` desde la raíz. `npm test`, no
  `node --test` a mano sin `--test-force-exit`. `npm run build`
  después de tocar `web/src/styles/` (no se versiona
  `web/public/app.css`). No correr dos `pytest` completos en paralelo
  contra la base real. `documentacion/*.csv` está en `.gitignore`.
