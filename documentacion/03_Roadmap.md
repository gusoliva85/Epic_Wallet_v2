# Roadmap de implementación — Epic Wallet 2.0

**Versión:** 1.0
**Fecha:** 03/10/2026
**Documentos base:** `01_Documento_General.md` (qué) · `02_Documento_Tecnico.md` (cómo) · `mockups/01_Mockup_V1_Grafito_Clasico.html` (diseño aprobado)

---

## Cómo se usa este documento

Este archivo es **la guía obligatoria de implementación**. Ninguna tarea se ejecuta fuera de acá, y ninguna fase se adelanta.

### Estado de cada tarea

| Marca | Significado |
|---|---|
| `- [ ]` | **Pendiente.** No se empezó. |
| `- [~]` | **Implementada, esperando tu prueba.** Está en la URL de preview. |
| `- [x]` | **Aprobada por vos.** Integrada a producción. Cerrada. |
| `- [!]` | **Rechazada.** Hay que corregirla; abajo de la tarea queda la nota de qué falló. |

Yo sólo paso una tarea a `- [x]` **después de que vos me digas que está aprobada**. Si la rechazás, la paso a `- [!]`, anoto el motivo y la vuelvo a trabajar.

### Reglas de ejecución

1. **Una tarea a la vez.** Está prohibido implementar varias tareas juntas o adelantar fases.
2. **Orden interno de cada tarea: lógica → backend → frontend.** Primero las funciones puras con sus tests, después el endpoint, después la interfaz. Nunca al revés.
3. **Nada se entrega sin probar.** Cada tarea trae criterios de aceptación verificables. Si no los cumple, no se entrega.
4. **Todo se prueba en la URL de preview, desde el celular.** Por eso la Fase 0 pone producción en marcha antes de cualquier funcionalidad.
5. **Esperar tu aprobación siempre.** Al terminar una tarea te aviso qué probar y cómo, y espero.
6. **Empezamos con un HTML básico sólo con el estilo** (Fase 1) y vamos agregando funcionalidad de a poco encima.
7. **Este documento es editable por vos.** Si cambiás, agregás, reordenás o borrás tareas, me adapto a la versión que esté en el archivo. Tu edición manda sobre lo que yo haya planificado.
8. **Al cerrar cada fase** (todas sus tareas en `- [x]`) hay una última tarea de documentación: escribir `docs/FASE_XX_<nombre>.md` explicando en lenguaje natural qué se hizo, con cuadros, ejemplos de uso y fragmentos del código real.

### Ampliaciones sobre el documento general

El documento general planteaba "1 usuario, con posibilidad de ampliar a pocos usuarios autenticados". Por pedido expreso, **esa ampliación entra en el MVP**: la Fase 2 incluye registro abierto con confirmación por mail, recuperación de contraseña y aislamiento entre cuentas. El detalle técnico está en la sección 8 del documento técnico. La Fase 2 pasó de 10 a 15 tareas, y **la recuperación de contraseña por correo y la configuración del SMTP se diferieron a la Fase 16** (tema 16.4): mientras tanto la confirmación por correo queda desactivada y el registro entra directo.

### Tipo de tarea

`Infra` infraestructura y despliegue · `Lógica` funciones puras y tests · `Backend` modelos, repos, servicios y endpoints · `Frontend` interfaz · `Doc` documentación · `QA` pruebas y verificación.

---

## Resumen de fases

| Fase | Nombre | Tareas | Qué queda funcionando al cerrarla |
|---|---|---|---|
| **0** | Puesta en marcha y producción | 12 | URL pública con el estilo, instalable en el celular, API respondiendo sobre un proyecto Supabase con dos esquemas |
| **1** | Sistema de estilo y esqueleto visual | 14 | Las 7 pantallas navegables con datos de ejemplo, claro/oscuro, mobile-first |
| **2** | Cuentas de usuario y autenticación | 15 | Registro propio, login, cambio de contraseña y multiusuario aislado. El correo se activa en la fase 16 |
| **3** | Meses y categorías | 13 | Navegación de meses real y categorías administrables |
| **4** | Movimientos | 15 | Alta, edición, baja y listado filtrable con recálculo del mes |
| **5** | Cálculos y dashboard de indicadores | 12 | Los 6 indicadores obligatorios con datos reales |
| **6** | Gráficos | 13 | Los 5 gráficos, incluido el diario con línea de ahorro |
| **7** | Desglose y detalle de categoría | 9 | Desglose ordenable y detalle con movimientos por categoría |
| **8** | Historial y carga consolidada | 13 | Historial mensual y carga manual de meses históricos |
| **9** | Ahorro acumulado y patrimonio | 10 | Saldo acumulado y patrimonio neto |
| **10** | Inversiones | 14 | Cartera completa con compra, venta y rendimientos |
| **11** | Cotizaciones automáticas | 10 | Actualización automática con fallback manual |
| **12** | Historial salarial y análisis | 11 | Evolución salarial y métricas históricas |
| **13** | Alertas | 10 | Las 5 alertas analíticas del documento general |
| **14** | Configuración y respaldo | 11 | Preferencias, datos laborales y exportación |
| **15** | PWA completa | 9 | Instalable, offline de lectura, atajos |
| **16** | Seguridad, cierre y recuperación de contraseña | 16 | Los 24 criterios de aceptación del MVP verificados, más el ciclo de correo completo |
| **17** | Preparación de integraciones futuras | 7 | Base lista para Excel y Mercado Pago, sin construirlos |

**Total: 214 tareas.** Las 18 tareas de documentación de cierre de fase están incluidas en esos números.

---

# FASE 0 — Puesta en marcha y producción

**Objetivo:** tener una URL pública, con el estilo aplicado, instalable en el celular y con la API respondiendo, **antes de escribir una sola línea de lógica de negocio**. Es lo que te permite probar cada tarea en el momento.

**Al cerrar esta fase:** abrís un enlace en el celular, ves una pantalla con la estética aprobada y `/api/health` devuelve que la base está conectada.

### Tema 0.1 — Repositorio y estructura

- [x] **F00-T01 · Crear el repositorio y la estructura de carpetas**
  **Tipo:** Infra · **Ref:** Técnico §10
  **Hacer:** repositorio `epic-wallet` en GitHub, rama `main`; estructura completa de la sección 10 del documento técnico con carpetas vacías y un `.gitkeep` en cada una; `.gitignore` para Python, Node, `.env`, `.vercel`, `__pycache__`, `dev.db`; `README.md` con cómo levantar el proyecto.
  **Aceptación:** · el repositorio clona y la estructura coincide con la del documento técnico · `.env` está ignorado · el README explica los pasos de arranque.

- [x] **F00-T02 · Configurar las herramientas de Python**
  **Tipo:** Infra · **Ref:** Técnico §3, §21
  **Hacer:** `pyproject.toml` con dependencias (fastapi, pydantic, pydantic-settings, sqlalchemy, psycopg[binary], alembic, pyjwt, httpx, pytest, pytest-asyncio, ruff, mypy); configuración de `ruff` y `mypy`; entorno virtual; `requirements.txt` generado para Vercel.
  **Aceptación:** · `pip install -e .` funciona · `ruff check .` pasa · `pytest` corre sin tests y no falla.

- [x] **F00-T03 · Configurar Tailwind y el paso de build**
  **Tipo:** Infra · **Ref:** Técnico §3, §13.2
  **Hacer:** `package.json` con `tailwindcss` v4; scripts `build` (compila a `web/public/app.css` minificado) y `dev` (modo watch); `web/src/app.css` importando Tailwind.
  **Aceptación:** · `npm run build` genera el CSS · `npm run dev` recompila al guardar.

### Tema 0.2 — Supabase

- [x] **F00-T04 · Configurar el proyecto de Supabase y sus dos esquemas**
  **Tipo:** Infra · **Ref:** Técnico §4.1.1, §11, §16.2
  **Hacer:** un único proyecto de Supabase en región **São Paulo (`sa-east-1`)**, que es la más cercana a Argentina y **no se puede cambiar después de crear el proyecto** (§20.1); crear dentro los esquemas `public` (producción) y `dev` (desarrollo y previews); anotar la URL, la clave anónima, la clave de servicio y el secreto de JWT; armar el `.env` local con `DB_SCHEMA=dev`; verificar la cadena del **pooler** (puerto 6543) con `python scripts/check_db.py`.
  **Aceptación:** · el proyecto está activo y el host del pooler dice `sa-east-1` · los esquemas `public` y `dev` existen · `scripts/check_db.py` responde TODO EN ORDEN · el script falla si se apunta desarrollo a `public`, lo que confirma la protección de los datos reales.

- [x] **F00-T05 · Configurar Alembic con esquema explícito**
  **Tipo:** Infra · **Ref:** Técnico §16.4, §4.1.1
  **Hacer:** `alembic init migrations`; `env.py` leyendo `DATABASE_URL` y **`DB_SCHEMA` del entorno, sin valor por defecto**, con `version_table_schema` e `include_schemas=True` para que una migración no pueda caer en el esquema equivocado; migración inicial vacía; probar `upgrade head` y `downgrade base` contra el esquema `dev`.
  **Aceptación:** · `DB_SCHEMA=dev alembic upgrade head` corre sin error · `downgrade` vuelve atrás · la tabla `alembic_version` existe **dentro de `dev`** y no en `public` · sin `DB_SCHEMA` definido, Alembic aborta con un mensaje claro en lugar de asumir un esquema.

- [x] **F00-T06 · Crear la primera cuenta**
  **Tipo:** Infra · **Ref:** Técnico §8.2, §4.1.1
  **Hacer:** crear tu cuenta en Supabase Auth con email y contraseña desde el panel (Authentication → Users → Add user), con *Auto Confirm User* activado para no depender todavía del mail; anotar el `user_id` (uuid).
  **Nota:** esta es **la misma cuenta con la que vas a entrar a la aplicación**. Se crea desde el panel porque todavía no existe la pantalla de registro; a partir de **F02-T10** vas a poder crear cuentas desde la aplicación, con confirmación por mail y recuperación de contraseña. Al haber un solo proyecto de Supabase, la autenticación es compartida por los dos esquemas: la misma cuenta sirve en desarrollo y en producción.
  **Aceptación:** · podés iniciar sesión desde el panel de Supabase · tenés el uuid anotado · queda claro que ese uuid es el que usarán las filas de `profiles` de ambos esquemas.

### Tema 0.3 — API mínima en producción

- [x] **F00-T07 · FastAPI mínima con `/api/health`**
  **Tipo:** Backend · **Ref:** Técnico §5.1, §9.1
  **Hacer:** `api/app/core/config.py` con `Settings` (pydantic-settings); `api/app/core/db.py` con engine y sesión; `api/app/main.py` creando la app con los manejadores de error del formato de la sección 9.3; endpoint `GET /api/health` que devuelve versión, entorno y si la base responde; `api/index.py` exponiendo `app`.
  **Aceptación:** · `uvicorn` local responde `{"status":"ok","database":"connected"}` · si la base está caída devuelve `"database":"error"` sin romper · los errores salen en el formato uniforme.

- [x] **F00-T08 · Configurar Vercel y desplegar**
  **Tipo:** Infra · **Ref:** Técnico §16.1
  **Hacer:** proyecto en Vercel vinculado al repositorio; `vercel.json` completo de la sección 16.1 con rewrites, runtime de Python, cabeceras de seguridad y **`regions: ["gru1"]` (São Paulo) para que la función corra junto a la base de datos** (§20.1); variables de entorno cargadas en los tres entornos, con **`DB_SCHEMA=public` sólo en producción** y `DB_SCHEMA=dev` en preview y development; primer despliegue.
  **Aceptación:** · `https://<dominio>/api/health` responde desde internet · las cabeceras de seguridad llegan (verificable con las herramientas del navegador) · los secretos **no** están en el repositorio · la función reporta una latencia a la base por debajo de 50 ms, lo que confirma que está en la misma región.

- [x] **F00-T09 · Previews por rama** · *parcial, el resto diferido a F08-T13*
  **Tipo:** Infra · **Ref:** Técnico §16.2, §16.3
  **Hecho:** se verificó que una rama genera su URL de preview con un patrón predecible; se documentó ese patrón y el flujo de trabajo en el README; `/api/health` informa el esquema activo, que es lo que permite distinguir una preview de producción de un vistazo; se desactivó la protección de previews para poder abrirlas desde el celular.
  **Diferido a F08-T13:** cargar `DB_SCHEMA=dev` y `APP_ENV=preview` en el entorno Preview de Vercel. Hoy no hace falta porque **la base está vacía: no hay datos reales que proteger**. Se configura justo antes de cargar el histórico real, que es cuando la separación empieza a importar.
  **Mientras tanto:** se trabaja contra producción, que ya responde. Si se pushea una rama, su preview va a fallar al arrancar por falta de `DB_SCHEMA`, y eso es deliberado: la protección de arranque prefiere un despliegue roto a escribir en `public` por descuido.

### Tema 0.4 — Primera pantalla visible

- [x] **F00-T10 · `index.html` con el fondo y la estética**
  **Tipo:** Frontend · **Ref:** Técnico §13.1, §13.3
  **Hacer:** `web/index.html` con `<head>` completo (viewport con `viewport-fit=cover`, `theme-color`, precarga de fuentes, CSP); fondo de lavados radiales y capa de ruido; una tarjeta `.shell` de prueba con el logotipo y el nombre; nada de JavaScript todavía.
  **Aceptación:** · la pantalla se ve como el mockup en fondo y tarjeta · se ve bien a 390 px y a 1440 px · sin errores en consola · desplegada y abierta en tu celular.

- [x] **F00-T11 · Manifest e instalación como PWA**
  **Tipo:** Frontend · **Ref:** Técnico §15
  **Hacer:** `manifest.json` de la sección 15; iconos 192, 512 y maskable 512; service worker mínimo que sólo se registra (sin cachear nada aún); enlazar todo desde el HTML.
  **Aceptación:** · Android ofrece "Instalar aplicación" · se abre en modo `standalone` sin barra del navegador · el icono se ve bien en el cajón de aplicaciones · Lighthouse marca la PWA como instalable.

- [x] **F00-T12 · Documentación de la Fase 0**
  **Tipo:** Doc
  **Hacer:** `docs/FASE_00_PUESTA_EN_MARCHA.md`: qué quedó montado y por qué, cuadro de entornos con sus URLs y esquemas, **por qué un solo proyecto de Supabase con dos esquemas y qué implica** (autenticación compartida, aislación lógica y no física, pausa por inactividad), el flujo de trabajo por tarea explicado con un ejemplo concreto, cómo levantar el proyecto en una máquina nueva paso a paso, y dónde vive cada secreto (sin los valores).
  **Aceptación:** · alguien que nunca vio el proyecto lo levanta siguiendo el documento · el cuadro de entornos coincide con la realidad.

---

# FASE 1 — Sistema de estilo y esqueleto visual

**Objetivo:** trasladar el mockup aprobado a la estructura real del proyecto. Las siete pantallas navegan y se ven terminadas, **con datos de ejemplo escritos a mano en el frontend**. Todavía no hay backend de datos.

**Al cerrar esta fase:** navegás las siete secciones en el celular, cambiás entre claro y oscuro, y todo se ve como el mockup con las letras ya agrandadas.

### Tema 1.1 — Tokens y capas de vidrio

- [x] **F01-T01 · Tokens de diseño en Tailwind**
  **Tipo:** Frontend · **Ref:** Técnico §13.2
  **Hacer:** `web/src/styles/tokens.css` con el bloque `@theme` completo (fondo, 4 niveles de tinta, líneas, acento, semántica financiera `--color-inc`/`--color-egr`/`--color-sav`, severidades, radios, fuentes, curva de animación); bloque `html[data-theme="dark"]` redefiniendo todo.
  **Aceptación:** · los tokens se usan como utilidad (`text-ink-3`) y como variable (`var(--color-ink-3)`) · cambiar `data-theme` a mano en el inspector cambia toda la paleta · ningún valor de color queda escrito fuera de este archivo.

- [x] **F01-T02 · Base: fondo, ruido y tipografía**
  **Tipo:** Frontend · **Ref:** Técnico §13.1, §13.4
  **Hacer:** `base.css` con los lavados radiales, `background-attachment: fixed`, la capa de ruido SVG en `::before`, la escala tipográfica de la sección 13.4 con base 16,5 px, Outfit para cifras y títulos, `tabular-nums` en todo lo numérico.
  **Aceptación:** · la escala coincide con la tabla del documento técnico · las cifras no cambian de ancho al actualizarse · el fondo no se repite ni corta al hacer scroll.

- [x] **F01-T03 · Las dos capas de vidrio**
  **Tipo:** Frontend · **Ref:** Técnico §13.3
  **Hacer:** `components.css` con `.shell` (desenfoque 22 px, saturación, brillo diagonal en `::before`, sombra interior) y `.cg` (desenfoque 7 px); bloque `@supports not (backdrop-filter)` con los fondos opacos de respaldo.
  **Aceptación:** · se distingue la jerarquía entre contenedor y contenido · con el desenfoque desactivado el texto sigue legible · funciona en Chrome de Android y en Safari de iOS.

- [x] **F01-T04 · Cambio de tema claro/oscuro**
  **Tipo:** Frontend · **Ref:** Técnico §13.2, §13.6
  **Hacer:** botón en la barra superior; `data-theme` en `<html>`; persistencia en `localStorage`; respeto de `prefers-color-scheme` en la primera visita; transición con View Transitions API cuando el navegador la soporta; actualización del `<meta name="theme-color">`.
  **Aceptación:** · el tema persiste al recargar · la primera visita respeta el sistema · la barra de estado de Android acompaña el cambio · sin destello blanco al cargar en oscuro.

### Tema 1.2 — Estructura y navegación

- [x] **F01-T05 · Barra superior**
  **Tipo:** Frontend · **Ref:** Mockup
  **Hacer:** `.topbar` pegajosa con el logotipo y nombre, navegación de pestañas visible desde 960 px, botón de alertas con contador, botón de tema y avatar que lleva a configuración.
  **Aceptación:** · queda pegada al hacer scroll sin tapar contenido · en móvil no desborda · todos los botones de icono tienen `aria-label`.

- [x] **F01-T06 · Navegación inferior y botón flotante**
  **Tipo:** Frontend · **Ref:** Técnico §13.5
  **Hacer:** `.botnav` de 5 posiciones (Inicio, Movimientos, Historial, Cartera, Más) visible por debajo de 960 px; botón `+` flotante; hoja de "Más" con Patrimonio, Análisis y Configuración; `env(safe-area-inset-bottom)` respetado.
  **Aceptación:** · se alcanza todo con una mano en un teléfono de 390 px · en pantallas con gestos no queda tapado por la barra del sistema · áreas táctiles de 44 px mínimo · desaparece en escritorio.

- [x] **F01-T07 · Enrutador por hash y las siete vistas**
  **Tipo:** Frontend · **Ref:** Técnico §12.1
  **Hacer:** `router.js` con las siete rutas; `<section class="view">` para cada una; activación por hash; botón "atrás" del navegador funcionando; animación de entrada de vista; vuelta al inicio del scroll al cambiar.
  **Aceptación:** · recargar en `#/inversiones` abre inversiones · "atrás" vuelve a la vista previa · una ruta inválida cae en inicio · la navegación no recarga la página.

- [x] **F01-T08 · Barra de mes (sin lógica real)**
  **Tipo:** Frontend · **Ref:** General §12.1
  **Hacer:** `.monthbar` con flechas de anterior y siguiente, título del mes, subtítulo de estado (abierto o consolidado) y botón "Hoy"; por ahora con valores fijos.
  **Aceptación:** · se ve como el mockup · los botones tienen estado deshabilitado visible · el título no se corta en pantallas angostas.

### Tema 1.3 — Componentes del catálogo

- [x] **F01-T09 · Tarjetas de indicador**
  **Tipo:** Frontend · **Ref:** Mockup, Técnico §12.4
  **Hacer:** `components/kpi.js` con las variantes héroe (cifra grande, barra de progreso, pie de dos datos) y métrica (etiqueta, icono, cifra, subtítulo); rejilla de 2 → 4 → 6 columnas; animación escalonada de entrada; función `esc()` aplicada a todo texto.
  **Aceptación:** · la rejilla se comporta en los tres cortes · la animación escalona de a 60 ms · un dato con `<script>` se muestra como texto y no ejecuta nada.

- [x] **F01-T10 · Filas de lista**
  **Tipo:** Frontend · **Ref:** Mockup
  **Hacer:** `components/rows.js` con la fila de movimiento (icono de dirección, categoría, fecha y descripción, importe con signo y color) y la fila de categoría (inicial, nombre, cantidad y porcentaje, barra de participación, total); estados hover y activo.
  **Aceptación:** · ingreso en verde con `+`, egreso en rojo con `−` · la barra de participación se anima al aparecer · la fila es un botón accesible por teclado con foco visible.

- [x] **F01-T11 · Hoja inferior y cajón lateral**
  **Tipo:** Frontend · **Ref:** Técnico §13.5, §13.6
  **Hacer:** `components/sheet.js`; en móvil hoja que sube desde abajo con asa, fondo oscurecido con desenfoque y cierre por toque afuera o Escape; desde 900 px el panel de detalle pasa a cajón lateral derecho y el formulario a modal centrado; bloqueo del scroll de fondo.
  **Aceptación:** · abre y cierra con la curva y duración de la tabla de movimiento · el fondo no hace scroll con la hoja abierta · Escape cierra · el foco queda atrapado dentro mientras está abierta.

- [x] **F01-T12 · Avisos, píldoras y notificaciones**
  **Tipo:** Frontend · **Ref:** Mockup
  **Hacer:** `.alert` en las cuatro severidades; `.pill` para etiquetas de estado y porcentajes; `components/toast.js` con `aria-live="polite"` y cierre automático a los 2,6 s.
  **Aceptación:** · las cuatro severidades se distinguen en claro y en oscuro · el lector de pantalla anuncia el toast · dos toasts seguidos no se superponen.

- [x] **F01-T13 · Las siete vistas maquetadas con datos de ejemplo**
  **Tipo:** Frontend · **Ref:** General §48
  **Hacer:** cada vista con su estructura final y datos fijos: inicio (indicadores, dos paneles de gráfico con un marcador de posición, categorías, últimos movimientos, alertas), movimientos (filtros y lista agrupada por día), historial (tabla), inversiones (indicadores y tabla), patrimonio (ecuación y composición), análisis (métricas y evolución salarial), configuración (categorías, preferencias, datos laborales, respaldo).
  **Aceptación:** · las siete se ven terminadas en el celular · ninguna tiene scroll horizontal salvo las tablas, que lo tienen a propósito · el orden del dashboard es el del mockup aprobado · los cuatro estados (cargando, error, vacío, sin conexión) están maquetados aunque todavía no se disparen.

- [ ] **F01-T14 · Documentación de la Fase 1**
  **Tipo:** Doc
  **Hacer:** `docs/FASE_01_SISTEMA_DE_ESTILO.md`: el sistema de estilo explicado (identidad, cuadro completo de tokens, las dos capas de vidrio con ejemplo de código, escala tipográfica, cortes, movimiento), catálogo de componentes con captura y fragmento de uso de cada uno, y la regla de que ningún componente nuevo introduce valores fuera de los tokens.
  **Aceptación:** · el cuadro de tokens coincide con `tokens.css` · cada componente tiene ejemplo de uso copiable · incluye capturas en claro y en oscuro.

---

# FASE 2 — Cuentas de usuario y autenticación

**Objetivo:** el ciclo de vida completo de una cuenta. Registro propio, confirmación por mail, inicio de sesión, recuperación de contraseña y cambio de contraseña. Cada cuenta con sus datos y sin ver los de nadie.

**Al cerrar esta fase:** te registrás desde el celular, entrás, y cambiás tu contraseña desde la aplicación. Una segunda cuenta de prueba no ve ni un dato de la primera.

> **Lo que depende del correo quedó para el final.** La recuperación de contraseña por mail y la configuración del SMTP se movieron a la **Fase 16** (tema 16.4), por decisión de Gustavo. Consecuencia concreta: en esta fase **la confirmación de cuenta por correo queda desactivada** en Supabase (Authentication → Providers → Email → *Confirm email* en off), así el registro funciona de inmediato sin depender de que lleguen mails. El cambio de contraseña **estando dentro** de la aplicación (F02-T11) sí entra en esta fase: no necesita correo.

**Referencia técnica:** §8 completa del documento técnico.

### Tema 2.1 — Configuración de Supabase Auth

- [ ] **F02-T01 · Verificación del JWT**
  **Tipo:** Lógica → Backend · **Ref:** Técnico §8.8
  **Hacer:** `core/security.py` con la dependencia `current_user_id`, verificando con la **clave pública del endpoint JWKS y algoritmo ES256** (ya comprobado en F00-T06: el proyecto no usa secreto compartido); `PyJWKClient` con caché y vencimiento para no buscar las claves en cada petición; verificación de firma, expiración y audiencia `authenticated`; errores 401 diferenciados entre sesión ausente, vencida e inválida; tests unitarios con tokens fabricados (válido, vencido, firma incorrecta, audiencia incorrecta, sin el claim `sub`).
  **Aceptación:** · los cinco casos de test pasan · un token manipulado se rechaza con `InvalidSignatureError` · el mensaje de error no filtra detalles internos · las claves del JWKS se buscan una sola vez por proceso.

- [ ] **F02-T02 · URLs de redirección y política de contraseñas**
  **Tipo:** Infra · **Ref:** Técnico §8.6, §8.9
  **Hacer:** en Authentication → URL Configuration cargar la Site URL y las Redirect URLs de producción, previews (`https://*.vercel.app/**`) y local (`http://localhost:3000/**`), que ya quedan listas para cuando se active el correo; en Authentication → Policies fijar el mínimo de 8 caracteres; **desactivar la confirmación por correo** (Providers → Email → *Confirm email* en off) para que el registro funcione sin depender de mails; dejar el registro habilitado y anotar dónde se desactiva si alguna vez hace falta.
  **Aceptación:** · una contraseña de 7 caracteres se rechaza del lado del servidor · una cuenta nueva queda confirmada al instante y puede iniciar sesión · las Redirect URLs están cargadas aunque todavía no se usen.

### Tema 2.2 — Backend de cuentas

- [ ] **F02-T03 · Tabla `profiles` y migración**
  **Tipo:** Backend · **Ref:** Técnico §6.2
  **Hacer:** modelo SQLAlchemy y migración para `profiles` con `opening_balance`, `timezone` y la referencia a `auth.users`; RLS activo con la política `own_profile`; trigger de `updated_at`.
  **Aceptación:** · migración aplicada en `dev` · `downgrade` probado · con RLS activo, una consulta con el token de otro usuario no devuelve filas.

- [ ] **F02-T04 · Trigger de creación de perfil y categorías iniciales**
  **Tipo:** Backend · **Ref:** Técnico §8.4 · General §7.1, §7.2
  **Hacer:** migración con la función `crear_perfil_y_categorias()` y su trigger sobre `auth.users`, con `security definer` y `search_path` vacío; inserta la fila de `profiles` y las **21 categorías iniciales** del documento general en su orden; `username` derivado del email.
  **Aceptación:** · al crear una cuenta nueva aparecen solos su perfil y sus 21 categorías, **sin pasar por nuestra API** · los nombres coinciden exactamente con los del documento general · la cuenta arranca con saldo inicial en cero · `downgrade` elimina función y trigger.

- [ ] **F02-T05 · Propagación del token a Postgres**
  **Tipo:** Backend · **Ref:** Técnico §6.5, §8.7
  **Hacer:** en `core/db.py`, abrir la sesión fijando el token del usuario para que `auth.uid()` funcione y RLS filtre; verificar que el pooler en modo transacción no arrastre el estado entre peticiones.
  **Aceptación:** · una consulta sin filtro explícito de `user_id` devuelve sólo las filas del usuario del token · dos peticiones consecutivas de usuarios distintos no se contaminan.

- [ ] **F02-T06 · `GET /api/me`, `PATCH /api/me` y `POST /api/me/bootstrap`**
  **Tipo:** Backend · **Ref:** Técnico §9.1
  **Hacer:** esquemas Pydantic de entrada y salida; lectura del perfil; actualización de nombre visible y saldo inicial; y `bootstrap` como red de seguridad que crea perfil y categorías si el trigger no corrió (idempotente, por si una cuenta se creó desde el panel antes de que existiera el trigger).
  **Aceptación:** · sin token devuelve 401 · con token devuelve tu perfil · el saldo inicial se guarda y se lee · `bootstrap` dos veces seguidas no duplica nada · un texto en el saldo inicial devuelve 422.

- [ ] **F02-T07 · Proteger toda la API**
  **Tipo:** Backend · **Ref:** Técnico §8.8
  **Hacer:** aplicar la dependencia de autenticación a nivel de enrutador para que ninguna ruta nueva pueda nacer desprotegida por olvido; dejar `/api/health` como única excepción; test que recorre todas las rutas registradas y verifica que responden 401 sin token.
  **Aceptación:** · el test de barrido pasa · agregar una ruta nueva sin tocar nada queda protegida por defecto.

### Tema 2.3 — Entrar y registrarse

- [ ] **F02-T08 · Integrar Supabase Auth en el cliente**
  **Tipo:** Frontend · **Ref:** Técnico §8.7, §8.11
  **Hacer:** `auth.js` con `supabase-js` (sólo el módulo de autenticación): `signUp`, `signInWithPassword`, `signOut`, `resetPasswordForEmail`, `updateUser`, lectura del token y renovación automática antes del vencimiento; inyección de `SUPABASE_URL` y la clave anónima en el build.
  **Aceptación:** · la sesión persiste al recargar y al cerrar la aplicación instalada · el token se renueva solo sin que el usuario note nada · la clave de servicio **no** aparece en el paquete del navegador.

- [ ] **F02-T09 · Pantalla de inicio de sesión**
  **Tipo:** Frontend · **Ref:** General §48.1 · Técnico §8.9 · Mockup
  **Hacer:** pantalla con la estética del mockup; campos de email y contraseña; **botón de mostrar y ocultar la contraseña** con su `aria-label`; enlace a *Crear cuenta* (el de *Olvidé mi contraseña* se agrega en F16-T13, cuando el correo esté configurado); estado de carga en el botón; mensajes de error claros que **no revelen si el email existe**; Enter envía; `autocomplete` correcto para que el gestor de contraseñas del teléfono funcione.
  **Aceptación:** · credenciales incorrectas muestran un mensaje entendible y genérico · el ojito muestra y oculta la contraseña · el botón no permite envíos dobles · se ve bien con el teclado del celular abierto · el `autocomplete` deja que el gestor de contraseñas del teléfono complete los campos.

- [ ] **F02-T10 · Pantalla de registro**
  **Tipo:** Frontend · **Ref:** Técnico §8.2, §8.3
  **Hacer:** pantalla con email, contraseña y repetir contraseña, ambos con mostrar y ocultar; medidor de fortaleza orientativo; validación en vivo de que las contraseñas coincidan y del mínimo de 8 caracteres; al enviar, **entrada directa al dashboard** (la confirmación por correo está desactivada, ver la nota de la fase); manejo del caso de email ya registrado sin revelar si existe. Dejar preparada la pantalla de "revisá tu correo" para cuando se active el correo en F16-T12, pero sin usarla todavía.
  **Aceptación:** · se puede crear una cuenta nueva de punta a punta desde el celular y entra directo · la cuenta nueva aparece en su dashboard vacío, con sus 21 categorías listas · contraseñas que no coinciden no permiten enviar · un email ya registrado no revela que existe.

### Tema 2.4 — Recuperar y cambiar la contraseña

- [ ] **F02-T11 · Cambio de contraseña desde la aplicación**
  **Tipo:** Frontend · **Ref:** Técnico §8.3 · General §48.9
  **Hacer:** en configuración, sección de cuenta con el email (sólo lectura), nombre visible editable y cambio de contraseña pidiendo la actual y la nueva dos veces; verificación de la actual antes de cambiarla; aviso de éxito.
  **Aceptación:** · el cambio funciona de punta a punta y la contraseña nueva sirve para entrar · con la contraseña actual equivocada no se cambia nada · el email no es editable.

### Tema 2.5 — Guardias, aislamiento y cierre

- [ ] **F02-T12 · Guardia de rutas y cierre de sesión**
  **Tipo:** Frontend · **Ref:** Técnico §12.1
  **Hacer:** separar rutas públicas (login, registro, recuperar, nueva-clave) de privadas; sin sesión, una ruta privada redirige al login; con sesión, una ruta pública redirige al dashboard; botón de cerrar sesión en configuración con confirmación; limpieza del estado y del caché al salir.
  **Aceptación:** · abrir `#/inversiones` sin sesión lleva al login · abrir `#/login` con sesión lleva al dashboard · al cerrar sesión no queda nada del usuario anterior en memoria ni en `localStorage` · volver atrás después de cerrar sesión no muestra datos.

- [ ] **F02-T13 · Cliente de API con manejo de 401**
  **Tipo:** Frontend · **Ref:** Técnico §9.3, §12.3
  **Hacer:** `api.js` con el token en la cabecera; ante 401 renueva la sesión y reintenta **una sola vez**; si el reintento falla, cierra sesión y avisa; traducción de los códigos de error al texto del toast; clase `ApiError`.
  **Aceptación:** · con un token vencido a mano, la petición se recupera sola · dos 401 seguidos cierran sesión sin bucle infinito · cada código de error muestra un mensaje distinto y en español.

- [ ] **F02-T14 · Aislamiento entre cuentas**
  **Tipo:** QA · **Ref:** Técnico §8.2, §6.5, §19
  **Hacer:** crear una segunda cuenta de prueba; cargar datos distintos en cada una (meses, movimientos, una inversión); verificar desde la interfaz que ninguna ve nada de la otra; y con el token de la segunda intentar leer y escribir por identificador directo los recursos de la primera en **todos** los endpoints existentes.
  **Aceptación:** · ningún recurso de la otra cuenta es accesible, ni pasando su `id` a mano · RLS bloquea incluso si se saltea el filtro del endpoint · la prueba queda automatizada · las categorías de una cuenta no aparecen en la otra.

- [ ] **F02-T15 · Documentación de la Fase 2**
  **Tipo:** Doc
  **Hacer:** `docs/FASE_02_CUENTAS_Y_AUTENTICACION.md`: el diagrama del ciclo de vida de una cuenta (registro, confirmación, login, recuperación, cambio); por qué se usa Supabase Auth y no hashes propios; cómo se verifica el JWT, con el código real; el trigger de perfil y categorías explicado y por qué va en la base y no en el backend; por qué la confirmación por correo quedó desactivada y qué hay que hacer para activarla; cómo RLS actúa de segunda barrera, con el ejemplo del intento de acceso cruzado rechazado; capturas de las pantallas de login y registro; y qué hacer para cerrar el registro si alguna vez se quiere.
  **Aceptación:** · incluye el diagrama del ciclo de vida · incluye el ejemplo de acceso cruzado rechazado · explica el trigger · deja anotado qué falta para activar el correo.

---

# FASE 3 — Meses y categorías

**Objetivo:** el modelo de meses (la decisión estructural más importante del proyecto, sección 71 del general) y las categorías administrables.

**Al cerrar esta fase:** navegás meses reales desde la base, no se puede elegir un mes futuro inexistente, y administrás categorías con activación y reordenamiento.

### Tema 3.1 — Lógica del modelo de meses

- [ ] **F03-T01 · Lógica de identidad y estado del mes**
  **Tipo:** Lógica · **Ref:** General §6, §50 R1 · Técnico §6.6
  **Hacer:** funciones puras: clave de mes a partir de año y mes, etiqueta visible en español, mes actual según la zona horaria de Buenos Aires, comparación y ordenamiento de meses, cálculo del mes anterior y siguiente, y decisión de si un mes es seleccionable (no futuro, o existe en la base); tests con cambio de año (diciembre a enero) y con mes futuro.
  **Aceptación:** · diciembre 2026 + 1 da enero 2027 · un mes futuro nunca es seleccionable · la etiqueta sale "Octubre 2026" · los tests cubren el cruce de año en ambos sentidos.

- [ ] **F03-T02 · Lógica de las dos naturalezas de mes**
  **Tipo:** Lógica · **Ref:** General §18.1, §37 · Técnico §6.6
  **Hacer:** función que, dado un mes y sus datos, decide de dónde salen los totales (de los movimientos si está abierto, de los campos consolidados si es histórico) y devuelve `transactions = None` para los históricos; tests que verifiquen que un mes histórico **nunca** produce movimientos.
  **Aceptación:** · mes abierto suma desde movimientos · mes histórico usa los totales guardados · `transactions` es `None` y no lista vacía · test explícito de la Regla 4 (no inventar movimientos).

### Tema 3.2 — Backend de meses

- [ ] **F03-T03 · Tabla `months` y migración**
  **Tipo:** Backend · **Ref:** Técnico §6.2
  **Hacer:** modelo y migración de `months` con la restricción única por usuario, año y mes, el `CHECK` de estado y los índices; RLS con las cuatro políticas; trigger de `updated_at`.
  **Aceptación:** · intentar insertar el mismo año y mes dos veces da conflicto · `downgrade` probado · RLS verificado con token ajeno.

- [ ] **F03-T04 · Repositorio y servicio de meses**
  **Tipo:** Backend · **Ref:** Técnico §5.1
  **Hacer:** repositorio con las consultas (listar, obtener por período, crear, actualizar totales); servicio con "obtener o crear el mes en curso" y la lógica de navegación (anterior, siguiente, actual); creación automática del mes actual en el primer acceso del mes.
  **Aceptación:** · al entrar un día 1 el mes se crea solo · pedir un mes que no existe no lo crea si es histórico · el servicio no construye SQL a mano.

- [ ] **F03-T05 · `GET /api/months` y `GET /api/months/{id}`**
  **Tipo:** Backend · **Ref:** Técnico §9.1
  **Hacer:** lista de meses ordenada de más reciente a más antiguo con totales y estado; detalle de un mes con sus totales por categoría; 404 si el mes no es del usuario (no 403, para no revelar que existe).
  **Aceptación:** · la lista trae los meses del usuario y sólo esos · el detalle incluye totales por categoría · un id ajeno devuelve 404.

### Tema 3.3 — Categorías

- [ ] **F03-T06 · Lógica de validación de categorías**
  **Tipo:** Lógica · **Ref:** General §7, §51 · Técnico §9.4
  **Hacer:** validaciones puras: nombre obligatorio de 1 a 60 caracteres, sin duplicados dentro del mismo tipo (comparando sin distinguir mayúsculas ni acentos), tipo válido; y la regla de que una categoría de ingreso no puede usarse en un egreso; tests de cada caso.
  **Aceptación:** · "Nafta" y "nafta" se consideran duplicados · "Otros" puede existir en ingreso y en egreso a la vez porque la unicidad es por tipo · el cruce de tipo se rechaza.

- [ ] **F03-T07 · Tabla `categories` y migración**
  **Tipo:** Backend · **Ref:** Técnico §6.2
  **Hacer:** modelo y migración con la restricción única por usuario, tipo y nombre, el `CHECK` de tipo y el índice de orden; RLS; trigger.
  **Aceptación:** · nombre duplicado en el mismo tipo da conflicto · el mismo nombre en tipos distintos se permite · `downgrade` probado.

- [ ] **F03-T08 · Siembra de las categorías iniciales**
  **Tipo:** Backend · **Ref:** General §7.1, §7.2
  **Hacer:** `scripts/seed_categories.py` que inserte las 3 de ingreso (Sueldo, Aguinaldo, Otros) y las 18 de egreso exactamente como las lista el documento general, con su orden; idempotente para poder correrlo dos veces sin duplicar; ejecutarlo en desarrollo y producción.
  **Aceptación:** · las 21 categorías existen con los nombres exactos del documento · correrlo de nuevo no duplica nada · el orden coincide con el del documento.

- [ ] **F03-T09 · Endpoints de categorías**
  **Tipo:** Backend · **Ref:** Técnico §9.1
  **Hacer:** `GET` con filtros de tipo y activas; `POST` de alta; `PUT` de edición y de activar o desactivar; `PATCH /reorder` por lote; impedir el borrado físico cuando hay histórico asociado, devolviendo un mensaje que explique que se puede desactivar.
  **Aceptación:** · desactivar una categoría con movimientos funciona y conserva el histórico · intentar borrarla devuelve 409 con el mensaje explicativo · el reordenamiento persiste.

### Tema 3.4 — Frontend

- [ ] **F03-T10 · Barra de mes conectada**
  **Tipo:** Frontend · **Ref:** General §12.1
  **Hacer:** conectar la barra de mes a `GET /api/months`; flechas que se deshabilitan en los extremos; botón "Hoy" deshabilitado cuando ya estás en el mes actual; subtítulo que dice si el mes está abierto o es histórico; el mes elegido se guarda en el estado y viaja a todas las vistas.
  **Aceptación:** · no se puede avanzar a un mes futuro inexistente · cambiar de mes actualiza todas las vistas abiertas · recargar mantiene el mes elegido.

- [ ] **F03-T11 · Caché de meses e invalidación**
  **Tipo:** Frontend · **Ref:** Técnico §12.2
  **Hacer:** `state.js` con el mapa de caché por mes y la función que invalida desde un mes hacia adelante; carga desde caché cuando el mes ya se visitó.
  **Aceptación:** · volver a un mes visitado es instantáneo y no genera petición · una escritura invalida ese mes y todos los posteriores · el caché se limpia al cerrar sesión.

- [ ] **F03-T12 · Administración de categorías**
  **Tipo:** Frontend · **Ref:** General §7, §48.9
  **Hacer:** en configuración, lista de categorías separadas por tipo con interruptor de activación, alta en hoja inferior, edición de nombre y reordenamiento (arrastrar en escritorio, botones de subir y bajar en móvil); toast de confirmación que aclara que el histórico se conserva al desactivar.
  **Aceptación:** · desactivar una categoría la saca del formulario de alta pero la deja en el histórico · el nombre duplicado muestra el error del backend · el reordenamiento se refleja en el orden del formulario de alta.

- [ ] **F03-T13 · Documentación de la Fase 3**
  **Tipo:** Doc
  **Hacer:** `docs/FASE_03_MESES_Y_CATEGORIAS.md`: el modelo de meses explicado con el cuadro comparativo de las dos naturalezas, por qué es la decisión estructural más importante, qué pasa al navegar a un mes histórico (con captura), las 21 categorías iniciales en un cuadro, y las reglas de unicidad con ejemplos de qué se acepta y qué no.
  **Aceptación:** · incluye el cuadro de las dos naturalezas de mes · explica con ejemplo por qué "Otros" existe dos veces · muestra el contrato `transactions: null`.

---

# FASE 4 — Movimientos

**Objetivo:** el corazón transaccional. Alta, edición, baja y listado filtrable, con recálculo correcto del mes y de todos los saldos posteriores.

**Al cerrar esta fase:** cargás un gasto desde el celular en pocos toques y ves cómo se actualiza todo al instante.

### Tema 4.1 — Lógica

- [ ] **F04-T01 · Lógica de validación de movimientos**
  **Tipo:** Lógica · **Ref:** General §8, §51 · Técnico §9.4
  **Hacer:** validaciones puras: importe mayor a cero (rechazando cero, negativos y texto), categoría activa y del tipo correcto, fecha válida y perteneciente al mes indicado, descripción de hasta 500 caracteres; normalización del importe desde texto con puntos y comas al estilo argentino.
  **Aceptación:** · "42.500,50" se interpreta como 42500.50 · importe cero y negativo se rechazan · una fecha de otro mes se rechaza · una categoría de ingreso en un egreso se rechaza.

- [ ] **F04-T02 · Lógica de recálculo del mes**
  **Tipo:** Lógica · **Ref:** General §9, §52 · Técnico §7.2
  **Hacer:** funciones puras que, dada una lista de movimientos, devuelvan totales de ingreso y egreso, ahorro, totales por categoría y la serie diaria; tests con mes vacío, mes con sólo ingresos, mes con sólo egresos, ahorro negativo y varios movimientos de la misma categoría el mismo día.
  **Aceptación:** · tres gastos de Carnicería dan el acumulado del ejemplo del documento general · mes vacío da todo en cero sin dividir por cero · el ahorro negativo se calcula bien.

### Tema 4.2 — Backend

- [ ] **F04-T03 · Tabla `transactions` y migración**
  **Tipo:** Backend · **Ref:** Técnico §6.2
  **Hacer:** modelo y migración con el `CHECK` de importe positivo, los `CHECK` de tipo y origen, la restricción única de `external_id`, las tres claves foráneas (con `restrict` en categoría) y los tres índices; RLS; trigger.
  **Aceptación:** · insertar importe cero falla a nivel de base · borrar una categoría con movimientos falla a nivel de base · los índices existen.

- [ ] **F04-T04 · Tabla `monthly_category_totals` y migración**
  **Tipo:** Backend · **Ref:** Técnico §6.2, §6.6
  **Hacer:** modelo y migración con la restricción única por mes y categoría y el campo `is_manual_summary`; RLS; trigger.
  **Aceptación:** · no se puede duplicar la misma categoría en el mismo mes · `downgrade` probado.

- [ ] **F04-T05 · Servicio de recálculo transaccional**
  **Tipo:** Backend · **Ref:** Técnico §7.2
  **Hacer:** `services/months.py` con `recalculate_month` que haga los cuatro pasos (totales del mes, totales por categoría respetando los consolidados manuales, saldo de cierre en cadena hacia adelante, reevaluación de alertas) **dentro de una sola transacción**; test que fuerce un error en el último paso y verifique que no quedó nada escrito.
  **Aceptación:** · el recálculo no toca las filas con `is_manual_summary = true` · un fallo revierte todo · el saldo de los meses posteriores se actualiza.

- [ ] **F04-T06 · `POST /api/transactions`**
  **Tipo:** Backend · **Ref:** General §9, §10
  **Hacer:** endpoint de alta con validación completa; creación del mes si no existe; recálculo; respuesta con el movimiento creado y los totales actualizados del mes, para que el frontend no tenga que volver a pedir el dashboard.
  **Aceptación:** · un alta válida devuelve 201 con el movimiento y los totales nuevos · importe cero devuelve 400 con mensaje claro · no se puede cargar un movimiento en un mes histórico (devuelve 409 explicando por qué).

- [ ] **F04-T07 · `PUT` y `DELETE` de movimientos**
  **Tipo:** Backend · **Ref:** General §50 R11
  **Hacer:** edición con revalidación y recálculo, incluyendo el caso de cambio de mes (recalcula los dos); baja con recálculo; 404 ante id ajeno.
  **Aceptación:** · mover un movimiento de octubre a septiembre recalcula ambos meses · borrar recalcula · un id de otro usuario devuelve 404.

- [ ] **F04-T08 · `GET /api/transactions` con filtros**
  **Tipo:** Backend · **Ref:** General §56
  **Hacer:** filtros por año y mes, tipo, categoría, rango de fechas y texto en la descripción; orden del más reciente al más antiguo; paginación por `limit` y `offset`; total de resultados y suma del filtro en la respuesta.
  **Aceptación:** · los filtros se combinan · la búsqueda de texto no distingue mayúsculas ni acentos · la suma del filtro coincide con la de los resultados · un mes histórico devuelve lista vacía con la aclaración de que es consolidado.

### Tema 4.3 — Frontend

- [ ] **F04-T09 · Formulario de alta rápida**
  **Tipo:** Frontend · **Ref:** General §9, §3.1
  **Hacer:** el botón `+` abre el formulario (modal centrado en escritorio, hoja inferior en móvil); selector de egreso o ingreso; campo de importe grande con teclado numérico del sistema; píldoras de categoría que cambian según el tipo; descripción opcional; fecha con el día de hoy por defecto; botones Cancelar y Guardar.
  **Aceptación:** · se carga un gasto en tres toques y una escritura · el foco va al importe al abrir · el teclado del celular no tapa el botón de guardar · cambiar de tipo cambia las categorías.

- [ ] **F04-T10 · Guardado con actualización inmediata**
  **Tipo:** Frontend · **Ref:** General §9
  **Hacer:** al guardar: cerrar el formulario, actualizar totales, categorías, gráficos y últimos movimientos con los datos de la respuesta, invalidar el caché desde ese mes, mostrar el toast de confirmación y dejar el nuevo movimiento primero en la lista; estado de carga en el botón para evitar envíos dobles.
  **Aceptación:** · todo se actualiza sin recargar · el nuevo movimiento aparece primero · pulsar Guardar dos veces rápido no crea dos movimientos · si el mes elegido no era el actual, salta al actual antes de guardar.

- [ ] **F04-T11 · Validación en el formulario**
  **Tipo:** Frontend · **Ref:** General §51
  **Hacer:** validación en el cliente con los mismos criterios del backend, pero **sin reemplazarlo**: mensajes junto al campo, importe obligatorio y positivo, categoría obligatoria; traducción de los errores del servidor al campo correspondiente.
  **Aceptación:** · guardar sin categoría muestra el error sin llamar a la API · un error del servidor se muestra en el campo correcto · el formulario no se vacía cuando falla.

- [ ] **F04-T12 · Lista de movimientos del mes**
  **Tipo:** Frontend · **Ref:** General §55
  **Hacer:** en la vista de movimientos, lista agrupada por día con separadores, orden del más reciente al más antiguo, contador y suma del filtro en el subtítulo, filtros de tipo, categoría y búsqueda de texto con retardo de 300 ms; en el dashboard, los últimos 8 con enlace "Ver todos".
  **Aceptación:** · los separadores de día dicen la fecha completa · la búsqueda no dispara una petición por tecla · "Ver todos" lleva a la vista con el mes mantenido · un mes consolidado muestra el mensaje de histórico y no una lista vacía.

- [ ] **F04-T13 · Detalle, edición y baja**
  **Tipo:** Frontend · **Ref:** General §50 R11
  **Hacer:** tocar un movimiento abre su detalle con importe, tipo, categoría, origen y descripción; botón de editar que reutiliza el formulario precargado; botón de eliminar con confirmación explícita que avisa del recálculo.
  **Aceptación:** · eliminar pide confirmación y se puede cancelar · tras eliminar, los totales y gráficos se actualizan · la edición precarga todos los campos.

- [ ] **F04-T14 · Pruebas de interfaz del flujo de carga**
  **Tipo:** QA · **Ref:** Técnico §19
  **Hacer:** pruebas de Playwright a 390 px y 1440 px: cargar un gasto, verificar que los totales cambian, editarlo, eliminarlo y verificar que vuelven al valor original; filtrar y buscar.
  **Aceptación:** · las pruebas pasan en los dos tamaños · corren en CI · fallan si el recálculo deja de funcionar.

- [ ] **F04-T15 · Documentación de la Fase 4**
  **Tipo:** Doc
  **Hacer:** `docs/FASE_04_MOVIMIENTOS.md`: el flujo de alta con capturas paso a paso, el ejemplo de los tres gastos de Carnicería que se acumulan pero conservan los movimientos individuales, el recálculo explicado con un diagrama de los cuatro pasos y por qué es transaccional, el cuadro de validaciones con qué se acepta y qué no, y el código real del servicio de recálculo comentado.
  **Aceptación:** · incluye el ejemplo de acumulación del documento general · explica por qué el recálculo alcanza a los meses posteriores · muestra el formato de error con un caso real.

---

# FASE 5 — Cálculos y dashboard de indicadores

**Objetivo:** los seis indicadores obligatorios con datos reales y la respuesta única del dashboard.

**Al cerrar esta fase:** al entrar ves tu mes actual con ingresos, egresos, ahorro, total de ahorros, inversiones y patrimonio, todo calculado por el backend.

### Tema 5.1 — Lógica de cálculo

- [ ] **F05-T01 · Módulo de cálculos puros**
  **Tipo:** Lógica · **Ref:** General §52 · Técnico §7
  **Hacer:** `services/calc.py` completo: `money`, `monthly_saving`, `saving_rate`, `accumulated_balance`, `investment_value`, `investment_return`, `investment_return_pct`, `net_worth`, `daily_saving_series`; todo con `Decimal`, nunca `float`.
  **Aceptación:** · cada función tiene test · el redondeo es a dos decimales con medio hacia arriba · no hay un solo `float` en el módulo.

- [ ] **F05-T02 · Casos borde obligatorios**
  **Tipo:** Lógica · **Ref:** Técnico §7.1
  **Hacer:** tests de los seis casos borde del cuadro de la sección 7.1: ingresos en cero para la tasa, valor inicial en cero para el rendimiento, mes sin movimientos, ahorro negativo, mes histórico sin serie diaria, y descuadre de categorías en la carga histórica.
  **Aceptación:** · los seis casos pasan · la tasa con ingresos en cero devuelve `None`, no cero ni excepción · el ahorro negativo no se muestra como positivo.

- [ ] **F05-T03 · Serie diaria y ahorro acumulado**
  **Tipo:** Lógica · **Ref:** General §13 · Técnico §7, §14.1
  **Hacer:** función que arme las tres series del mes (ingreso por día, egreso por día y ahorro acumulado día a día), el día de mayor gasto, la cantidad de días sin movimientos y el promedio diario; tests con días sin movimiento y con el ahorro cruzando a negativo.
  **Aceptación:** · el ahorro acumulado del último día coincide con el ahorro del mes · los días sin movimiento valen cero y no se saltean · la serie tiene exactamente la cantidad de días transcurridos del mes.

### Tema 5.2 — Backend

- [ ] **F05-T04 · Servicio del dashboard**
  **Tipo:** Backend · **Ref:** Técnico §9.2
  **Hacer:** `services/dashboard.py` que arme la respuesta completa de la sección 9.2 con una cantidad mínima de consultas; comparación con el mes anterior; distinción entre mes abierto e histórico (serie diaria y movimientos en `null`).
  **Aceptación:** · la respuesta coincide campo por campo con el contrato documentado · un mes histórico devuelve `daily: null` y `recent_transactions: null` · no más de 6 consultas por petición.

- [ ] **F05-T05 · `GET /api/dashboard`**
  **Tipo:** Backend · **Ref:** Técnico §9.2
  **Hacer:** endpoint con parámetros de año y mes opcionales (sin ellos, el mes actual); esquema Pydantic de salida que documente el contrato; importes serializados como string decimal.
  **Aceptación:** · sin parámetros devuelve el mes actual · los importes salen como string y no pierden centavos · la documentación automática de OpenAPI muestra el esquema completo.

- [ ] **F05-T06 · Rendimiento del dashboard**
  **Tipo:** Backend · **Ref:** Técnico §20
  **Hacer:** medir la respuesta con un mes cargado de 50 movimientos; revisar el plan de consultas y agregar los índices que falten; verificar que no haya consultas en bucle. Medir **desde la función desplegada**, no desde la máquina local: en local se pagan ~35 ms por consulta contra São Paulo (§20.1).
  **Aceptación:** · por debajo de 400 ms en el percentil 95 medido desde la función · sin consultas N+1 · las mediciones quedan anotadas en la documentación de la fase, con la aclaración de local contra desplegado.

### Tema 5.3 — Frontend

- [ ] **F05-T07 · Conectar los seis indicadores**
  **Tipo:** Frontend · **Ref:** General §12.2
  **Hacer:** reemplazar los datos de ejemplo por la respuesta real; las dos tarjetas héroe (ahorro del mes con tasa, y patrimonio con composición) y las cuatro métricas; variación contra el mes anterior en píldora de color.
  **Aceptación:** · los seis indicadores de la sección 12.2 están presentes y son numéricos · la tasa muestra "N/A" cuando no hay ingresos · la variación muestra el signo correcto.

- [ ] **F05-T08 · Animación de conteo y barras**
  **Tipo:** Frontend · **Ref:** Técnico §13.6
  **Hacer:** conteo progresivo de 900 ms en las cifras héroe; animación de las barras de progreso; entrada escalonada de las tarjetas; todo anulado con `prefers-reduced-motion`.
  **Aceptación:** · el conteo no se reinicia al cambiar de vista y volver · con movimiento reducido las cifras aparecen directas · no hay salto de layout mientras cuenta.

- [ ] **F05-T09 · Estados de carga, error y vacío**
  **Tipo:** Frontend · **Ref:** Técnico §12.6
  **Hacer:** esqueletos con la forma final mientras carga; tarjeta de error con botón de reintentar; estado vacío para un mes sin movimientos que invite a cargar el primero.
  **Aceptación:** · no hay salto de layout al pasar de esqueleto a contenido · el reintento funciona sin recargar la página · el mes vacío muestra un mensaje útil, no ceros secos.

- [ ] **F05-T10 · Formato de importes en el cliente**
  **Tipo:** Frontend · **Ref:** Técnico §12.5
  **Hacer:** `format.js` con `toNum`, `fmt`, `fmtS`, `fmtK` y `pct`; separador de miles con punto y decimal con coma al estilo argentino; negativos con el signo menos tipográfico; `fmtK` para los ejes de los gráficos con millones y miles.
  **Aceptación:** · 3491280 se muestra como $3.491.280 · un negativo se ve como −$42.000 · `fmtK` da $3,5M y $340k, y respeta el signo en los negativos · el frontend no hace una sola operación aritmética con dinero.

- [ ] **F05-T11 · Verificación contra el Excel**
  **Tipo:** QA · **Ref:** General §64, §65
  **Hacer:** cargar en producción un mes real tomado de tu planilla y comparar los seis indicadores contra el Excel, cifra por cifra; anotar cualquier diferencia y su causa.
  **Aceptación:** · los seis indicadores coinciden con el Excel al peso · si hay diferencia, está explicada y resuelta · la comparación queda documentada.

- [ ] **F05-T12 · Documentación de la Fase 5**
  **Tipo:** Doc
  **Hacer:** `docs/FASE_05_CALCULOS_Y_DASHBOARD.md`: cada fórmula del documento general con su función de código al lado, el cuadro de casos borde con el resultado esperado, el contrato completo de `/api/dashboard` con un ejemplo real, la comparación con el Excel, y por qué los importes viajan como string.
  **Aceptación:** · incluye las fórmulas de la sección 52 del general traducidas a código · incluye la tabla de comparación con el Excel · explica el uso de `Decimal`.

---

# FASE 6 — Gráficos

**Objetivo:** los cinco gráficos, con el diario de barras **más la línea de ahorro acumulado** que pediste.

**Al cerrar esta fase:** ves de un golpe cómo se mueve el mes día por día y cómo sube o baja tu ahorro.

### Tema 6.1 — Infraestructura de gráficos

- [ ] **F06-T01 · Utilidades de SVG**
  **Tipo:** Frontend · **Ref:** Técnico §14.3
  **Hacer:** `charts/svg.js` con creación del elemento con `viewBox`, `niceMax` para escalas redondas, generadores de rejilla y ejes, identificadores únicos para los degradados (para que dos gráficos en el DOM no se pisen), y el formateador de los ejes.
  **Aceptación:** · dos gráficos coexistiendo mantienen sus propios colores de degradado · las escalas caen en valores redondos · todo texto usa las clases de eje definidas.

- [ ] **F06-T02 · Gráfico diario: barras**
  **Tipo:** Frontend · **Ref:** General §13
  **Hacer:** barras de ingreso y egreso por día, agrupadas; eje X con los días y eje Y izquierdo con importes; mínimo de 1,5 px de alto para que un gasto chico se vea; animación de crecimiento escalonada; modos Ambos, Egresos e Ingresos.
  **Aceptación:** · se distinguen los días de mayor gasto, los días con ingreso y los días sin movimiento · un gasto de $4.800 se ve · el gráfico no es sólo acumulativo.

- [ ] **F06-T03 · Gráfico diario: línea de ahorro con doble eje**
  **Tipo:** Frontend · **Ref:** Técnico §14.1 · **Cambio pedido sobre el mockup**
  **Hacer:** línea del ahorro acumulado del mes sobre las barras, con **eje Y derecho propio** y escala independiente; color del token de ahorro; punto y etiqueta en el valor de hoy; línea de cero punteada si el ahorro se vuelve negativo; rótulo "AHORRO" sobre el eje derecho; la línea se mantiene visible en los cuatro modos.
  **Aceptación:** · se ve claramente cómo el ahorro sube con el sueldo y baja con cada gasto · la línea no aplasta las barras · con ahorro negativo se ve el cruce por cero · la leyenda explica que la línea va por el eje derecho.

- [ ] **F06-T04 · Modo acumulado y pie de cifras**
  **Tipo:** Frontend · **Ref:** General §12.2, §13
  **Hacer:** modo de áreas acumuladas de ingreso y egreso, conservando la línea de ahorro; pie del panel con promedio diario, día más alto, días sin gasto, proyección a 30 días, ahorro acumulado de hoy y máximo del mes con su día.
  **Aceptación:** · los cuatro modos funcionan y recuerdan la elección al cambiar de vista y volver · el pie numérico está siempre, cumpliendo que el gráfico no reemplaza los números.

### Tema 6.2 — Los demás gráficos

- [ ] **F06-T05 · Gráfico de los últimos seis meses**
  **Tipo:** Frontend · **Ref:** General §14
  **Hacer:** barras agrupadas de ingresos, egresos y ahorro para el mes actual más los cinco anteriores; modos Barras, Ahorro y Tasa de ahorro; pie con las cifras de cada mes.
  **Aceptación:** · permite comparar los tres conceptos · los datos están disponibles también como números · con menos de seis meses cargados no se rompe.

- [ ] **F06-T06 · Gráfico de gastos por categoría**
  **Tipo:** Frontend · **Ref:** General §54
  **Hacer:** barras horizontales ordenadas de mayor a menor, con el nombre, la barra y el importe; recorte de nombres largos con puntos suspensivos.
  **Aceptación:** · el orden es de mayor a menor · "Carnicería / Pollería" no rompe el diseño · se lee bien en 390 px.

- [ ] **F06-T07 · Gráfico de evolución del ahorro**
  **Tipo:** Frontend · **Ref:** General §54
  **Hacer:** área con línea del saldo acumulado por mes, con degradado propio y puntos en cada mes; etiqueta del saldo inicial.
  **Aceptación:** · arranca del saldo inicial · los puntos coinciden con los saldos de la tabla de historial.

- [ ] **F06-T08 · Gráfico de composición patrimonial**
  **Tipo:** Frontend · **Ref:** General §30
  **Hacer:** barra apilada horizontal de ahorro líquido e inversiones, con leyenda que incluya importe y porcentaje.
  **Aceptación:** · los porcentajes suman 100 · los importes coinciden con los indicadores.

### Tema 6.3 — Calidad de los gráficos

- [ ] **F06-T09 · Tema y accesibilidad**
  **Tipo:** Frontend · **Ref:** Técnico §13.7, §14.3
  **Hacer:** todos los colores por variable CSS para que el cambio de tema no requiera redibujar; `role="img"` y `<title>` con el resumen en texto; verificación de contraste de las series en ambos temas.
  **Aceptación:** · cambiar de tema actualiza los gráficos sin volver a generarlos · el lector de pantalla lee el resumen · las series se distinguen en claro y en oscuro.

- [ ] **F06-T10 · Comportamiento en móvil**
  **Tipo:** Frontend · **Ref:** Técnico §14.3
  **Hacer:** `min-width` de 520 px con scroll horizontal por debajo de 720 px y ajuste al ancho por encima; indicación visual de que se puede desplazar; sin scroll vertical atrapado.
  **Aceptación:** · en 390 px se desplaza horizontal sin trabar el scroll de la página · en escritorio ocupa el ancho disponible · los días del eje no se superponen.

- [ ] **F06-T11 · Interacción de los gráficos**
  **Tipo:** Frontend · **Ref:** Mockup
  **Hacer:** al tocar o pasar por un día, mostrar el detalle de ese día (ingreso, egreso y ahorro acumulado); al tocar una categoría en el gráfico de categorías, abrir su detalle.
  **Aceptación:** · funciona con toque en móvil y con el puntero en escritorio · el detalle no tapa el dato que se está mirando · es opcional y el gráfico se entiende sin usarlo.

- [ ] **F06-T12 · Mes histórico sin serie diaria**
  **Tipo:** Frontend · **Ref:** General §11, §50 R4
  **Hacer:** cuando el mes es consolidado, el panel diario muestra el mensaje de información histórica consolidada en lugar de un gráfico vacío o inventado; el de seis meses y el de categorías siguen funcionando con los totales.
  **Aceptación:** · ningún gráfico inventa días para un mes consolidado · el mensaje explica por qué no hay detalle diario · los gráficos que sí tienen datos se muestran normalmente.

- [ ] **F06-T13 · Documentación de la Fase 6**
  **Tipo:** Doc
  **Hacer:** `docs/FASE_06_GRAFICOS.md`: cada gráfico con captura, qué pregunta responde y cómo leerlo; explicación detallada del doble eje del gráfico diario y por qué era necesario; el código del generador de la línea de ahorro comentado; por qué se usa SVG propio en lugar de Chart.js, con la comparación de peso.
  **Aceptación:** · incluye captura de los cinco gráficos en claro y oscuro · explica el doble eje con un ejemplo de lectura · documenta la decisión contra Chart.js.
---

# FASE 7 — Desglose y detalle de categoría

**Objetivo:** el desglose tipo Excel y la vista de detalle que distingue total, última carga y movimientos individuales.

**Al cerrar esta fase:** tocás una categoría y ves cuánto llevás, cuándo cargaste por última vez y cada movimiento.

### Tema 7.1 — Backend

- [ ] **F07-T01 · Lógica del desglose**
  **Tipo:** Lógica · **Ref:** General §15, §37
  **Hacer:** función pura que arme el desglose: total por categoría, participación porcentual sobre el gasto, cantidad de movimientos y fecha de la última carga; para meses históricos, el total viene de los consolidados y la cantidad no aplica; orden por mayor gasto y alfabético (respetando acentos y la ñ).
  **Aceptación:** · los porcentajes suman 100 · el orden alfabético pone "Ñ" en su lugar correcto · un mes histórico no reporta cantidad de movimientos.

- [ ] **F07-T02 · Detalle de categoría en la API**
  **Tipo:** Backend · **Ref:** General §16
  **Hacer:** `GET /api/categories/{id}/detail?year&month` que devuelva total del mes, fecha de última carga, cantidad y la lista de movimientos del más reciente al más antiguo; para un mes histórico, `transactions: null` y una marca de que es consolidado.
  **Aceptación:** · el contrato distingue claramente los tres datos (total, última carga, movimientos) · un mes histórico no devuelve movimientos · una categoría sin gasto en el mes devuelve total cero y lista vacía.

- [ ] **F07-T03 · Ordenamiento en el dashboard**
  **Tipo:** Backend · **Ref:** General §15
  **Hacer:** parámetro de orden en `/api/dashboard` para el desglose (mayor gasto por defecto, alfabético como alternativa).
  **Aceptación:** · el orden por defecto es mayor gasto primero, como pide el documento · el alfabético funciona con acentos.

### Tema 7.2 — Frontend

- [ ] **F07-T04 · Panel de desglose conectado**
  **Tipo:** Frontend · **Ref:** General §15
  **Hacer:** conectar el panel a los datos reales; conmutador entre mayor gasto y A–Z; barra de participación animada; cantidad de movimientos y fecha de última carga en el subtítulo de cada fila; total de egresos al pie.
  **Aceptación:** · el conmutador reordena sin volver a pedir datos · la barra se anima al entrar · la suma de las filas coincide con el total de egresos del mes.

- [ ] **F07-T05 · Hoja de detalle de categoría**
  **Tipo:** Frontend · **Ref:** General §16
  **Hacer:** al tocar una categoría, hoja (o cajón en escritorio) con cuatro datos destacados (total del mes, última carga, cantidad, porcentaje) y debajo la lista de movimientos con fecha, descripción e importe; entrada escalonada de las filas.
  **Aceptación:** · la vista diferencia visualmente total, última carga y movimientos individuales · el ejemplo de Mercadería del documento general se reproduce igual · se puede cerrar con Escape y con toque afuera.

- [ ] **F07-T06 · Detalle para mes consolidado**
  **Tipo:** Frontend · **Ref:** General §11, §50 R4
  **Hacer:** cuando el mes es histórico, la hoja muestra el total y el aviso de información histórica consolidada, explicando que un total histórico se conserva como total y no se desglosa en movimientos.
  **Aceptación:** · se reproduce el caso de Septiembre 2026 del documento general · no se muestra ninguna lista vacía engañosa.

- [ ] **F07-T07 · Navegación desde el gráfico de categorías**
  **Tipo:** Frontend · **Ref:** Mockup
  **Hacer:** tocar una barra del gráfico de categorías abre la misma hoja de detalle; coherencia de colores entre gráfico y lista.
  **Aceptación:** · el gráfico y la lista llevan al mismo lugar · los colores coinciden.

- [ ] **F07-T08 · Edición desde el detalle**
  **Tipo:** Frontend · **Ref:** General §50 R11
  **Hacer:** desde la lista del detalle se puede abrir un movimiento, editarlo o eliminarlo; al volver, el detalle y el desglose quedan actualizados.
  **Aceptación:** · eliminar un movimiento desde el detalle actualiza el total de la categoría y el del mes · no hace falta cerrar y reabrir para ver el cambio.

- [ ] **F07-T09 · Documentación de la Fase 7**
  **Tipo:** Doc
  **Hacer:** `docs/FASE_07_DESGLOSE_Y_CATEGORIAS.md`: el desglose con captura y comparación contra el formato del Excel, el detalle de categoría con el ejemplo de Mercadería, la diferencia entre mes transaccional e histórico mostrada con las dos capturas lado a lado, y el contrato del endpoint de detalle.
  **Aceptación:** · incluye las dos capturas comparadas · reproduce los ejemplos del documento general.

---

# FASE 8 — Historial y carga consolidada

**Objetivo:** la sección Historial y la carga manual de meses históricos, que es lo que permite traer los años del Excel sin importarlo.

**Al cerrar esta fase:** cargás un mes histórico con sus totales, lo ves en el historial y lo podés corregir si te equivocaste.

### Tema 8.1 — Lógica

- [ ] **F08-T01 · Lógica de validación de mes histórico**
  **Tipo:** Lógica · **Ref:** General §18
  **Hacer:** validaciones puras: año y mes válidos y no futuros, totales no negativos, ahorro calculado como ingresos menos egresos, y comparación de la suma de categorías contra el total de egresos devolviendo la diferencia; el texto de advertencia exacto del documento general.
  **Aceptación:** · la advertencia dice "La suma de las categorías no coincide con el total de egresos." · la diferencia se informa con su importe · un descuadre no bloquea el guardado, sólo advierte.

- [ ] **F08-T02 · Lógica del saldo acumulado en cadena**
  **Tipo:** Lógica · **Ref:** General §19 · Técnico §7.2
  **Hacer:** función pura que, dado el saldo inicial y la secuencia de ahorros mensuales ordenada, devuelva el saldo acumulado de cada mes; tests con ahorro negativo intercalado y con la inserción de un mes en el medio de la serie.
  **Aceptación:** · insertar un mes en el medio corrige los saldos de todos los posteriores · un ahorro negativo baja el saldo · el saldo del último mes coincide con el total de ahorros.

### Tema 8.2 — Backend

- [ ] **F08-T03 · `POST /api/months/historical`**
  **Tipo:** Backend · **Ref:** General §18
  **Hacer:** endpoint que cree o actualice un mes con estado histórico; guardado de los totales en `months` y de los totales por categoría en `monthly_category_totals` con `is_manual_summary = true`; recálculo del saldo acumulado en cadena; advertencia de descuadre en la respuesta sin impedir el guardado.
  **Aceptación:** · el mes queda con estado histórico · las filas de categoría quedan marcadas como resumen manual · un mes repetido actualiza en lugar de duplicar (Regla 1) · el descuadre llega como advertencia, no como error.

- [ ] **F08-T04 · `PATCH /api/months/{id}`**
  **Tipo:** Backend · **Ref:** General §6.3
  **Hacer:** corrección de un mes histórico (el documento general permite editarlo si se detecta un error); recálculo en cadena; impedir que un mes transaccional se edite por esta vía, porque sus totales salen de los movimientos.
  **Aceptación:** · corregir un mes histórico actualiza los saldos posteriores · intentar editar los totales del mes en curso devuelve 409 con la explicación.

- [ ] **F08-T05 · `GET /api/months` con saldo acumulado**
  **Tipo:** Backend · **Ref:** General §17
  **Hacer:** agregar a la lista el saldo acumulado de cada mes y la tasa de ahorro; agrupación por año en la respuesta para que el frontend no tenga que calcularla.
  **Aceptación:** · el saldo acumulado es correcto mes a mes · la agrupación por año coincide con el formato del documento general.

- [ ] **F08-T06 · Script de carga asistida del histórico**
  **Tipo:** Backend · **Ref:** General §18
  **Hacer:** `scripts/load_history.py` que tome un CSV con mes, año, totales y categorías opcionales y los cargue por lote llamando al mismo servicio que el endpoint; informe de qué se cargó y qué descuadró; modo de prueba que no escribe.
  **Aceptación:** · el modo de prueba muestra qué haría sin tocar la base · los descuadres se listan al final · usa el mismo servicio que la API, sin lógica duplicada.

### Tema 8.3 — Frontend

- [ ] **F08-T07 · Vista de historial**
  **Tipo:** Frontend · **Ref:** General §17
  **Hacer:** tabla de todos los meses agrupados por año, con ingresos, egresos, ahorro, tasa, saldo acumulado y estado; orden del más reciente al más antiguo; tocar un mes lo abre en el dashboard.
  **Aceptación:** · reproduce el formato del documento general · se distingue a simple vista un mes consolidado de uno abierto · tocar un mes cambia el mes activo y lleva al inicio.

- [ ] **F08-T08 · Formulario de carga de mes histórico**
  **Tipo:** Frontend · **Ref:** General §18
  **Hacer:** hoja con mes y año, total de ingresos, total de egresos, ahorro calculado automáticamente y de sólo lectura, y una sección opcional y plegable de totales por categoría; suma en vivo de las categorías mostrada junto al total de egresos.
  **Aceptación:** · el ahorro se recalcula al escribir · la suma de categorías se ve en vivo · no se puede elegir un mes futuro · un mes ya cargado precarga sus valores para corregirlo.

- [ ] **F08-T09 · Advertencia de descuadre**
  **Tipo:** Frontend · **Ref:** General §18
  **Hacer:** cuando la suma de categorías no coincide con el total de egresos, mostrar el mensaje exacto del documento general con la diferencia, y dar las dos salidas: corregir o guardar igual.
  **Aceptación:** · el mensaje es el literal del documento · se ve la diferencia en pesos · se puede guardar igual tras confirmar.

- [ ] **F08-T10 · Gráfico de evolución del ahorro en historial**
  **Tipo:** Frontend · **Ref:** General §54
  **Hacer:** conectar el gráfico de evolución del saldo acumulado con los datos reales, abajo de la tabla.
  **Aceptación:** · los puntos del gráfico coinciden con la columna de saldo acumulado de la tabla.

- [ ] **F08-T13 · Configurar el entorno Preview de Vercel**
  **Tipo:** Infra · **Ref:** Técnico §16.2 · **Viene de F00-T09**
  **Hacer:** en Vercel → Settings → Environment Variables, cargar `DB_SCHEMA=dev` y `APP_ENV=preview` con la casilla **Preview** tildada (y Development también). Son dos variables; el resto ya está. Verificar con `curl <url-de-preview>/api/health | grep db_schema` que diga `dev`.
  **Por qué acá y no antes:** hasta esta fase la base no tiene datos reales, así que no hay nada que proteger y trabajar contra producción alcanza. Desde que se carga el histórico, una preview mal configurada podría escribir sobre datos de verdad.
  **Aceptación:** · la preview de una rama responde `db_schema: dev` · producción sigue respondiendo `public` · se probó una preview desde el celular.

- [ ] **F08-T11 · Carga real del histórico del Excel**
  **Tipo:** QA · **Ref:** General §2.2
  **Hacer:** cargar en producción los meses históricos reales de tu planilla, mes por mes o con el script; verificar que el saldo acumulado final coincide con el del Excel.
  **Aceptación:** · el total de ahorros de la aplicación coincide con el del Excel · los descuadres encontrados quedan anotados con su explicación.

- [ ] **F08-T12 · Documentación de la Fase 8**
  **Tipo:** Doc
  **Hacer:** `docs/FASE_08_HISTORIAL.md`: por qué los meses históricos son consolidados y el mes actual transaccional, el paso a paso de la carga manual con capturas, el caso de descuadre con su mensaje, cómo funciona el recálculo en cadena del saldo (con un ejemplo numérico de insertar un mes en el medio), y el uso del script de carga.
  **Aceptación:** · incluye el ejemplo numérico del recálculo en cadena · documenta el formato del CSV del script.

---

# FASE 9 — Ahorro acumulado y patrimonio

**Objetivo:** distinguir con claridad ahorro del mes de total de ahorros, y mostrar la ecuación patrimonial.

**Al cerrar esta fase:** sabés cuánto ahorraste este mes, cuánto llevás acumulado y cuánto vale todo lo que tenés.

### Tema 9.1 — Lógica y backend

- [ ] **F09-T01 · Lógica del saldo inicial y el acumulado**
  **Tipo:** Lógica · **Ref:** General §19
  **Hacer:** función pura del saldo acumulado a partir del saldo inicial más la suma de los ahorros mensuales hasta un mes dado; tests que verifiquen la distinción entre ahorro del mes y total de ahorros.
  **Aceptación:** · el acumulado hasta el mes actual coincide con el total de ahorros del dashboard · cambiar el saldo inicial desplaza toda la serie.

- [ ] **F09-T02 · Lógica del patrimonio neto**
  **Tipo:** Lógica · **Ref:** General §5.3, §30 · Técnico §7
  **Hacer:** `net_worth` con los cuatro términos (ahorros, inversiones, otros activos, pasivos), donde otros activos y pasivos valen cero pero están en la fórmula; tests que verifiquen que agregar un pasivo baja el patrimonio sin tocar nada más.
  **Aceptación:** · hoy el patrimonio es ahorros más inversiones · sumar un pasivo lo reduce correctamente · la fórmula ya contempla los cuatro términos.

- [ ] **F09-T03 · Tabla `liabilities` y migración**
  **Tipo:** Backend · **Ref:** Técnico §6.2
  **Hacer:** crear la tabla vacía con RLS, sin interfaz; incluirla en el cálculo de patrimonio sumando cero.
  **Aceptación:** · la tabla existe y el cálculo la consulta · no aparece en la interfaz · insertar una fila a mano se refleja en el patrimonio.

- [ ] **F09-T04 · `GET /api/patrimony`**
  **Tipo:** Backend · **Ref:** General §30
  **Hacer:** endpoint con el desglose completo (total de ahorros, valor de inversiones, otros activos, pasivos, patrimonio neto) más la composición en porcentajes y el resultado de la cartera.
  **Aceptación:** · el patrimonio coincide con el indicador del dashboard · los porcentajes de composición suman 100 · con la cartera vacía no divide por cero.

### Tema 9.2 — Frontend

- [ ] **F09-T05 · Saldo inicial en configuración**
  **Tipo:** Frontend · **Ref:** General §19
  **Hacer:** campo de saldo inicial de ahorros en configuración, con aviso de que afecta todo el acumulado histórico y confirmación antes de guardar.
  **Aceptación:** · cambiarlo recalcula el total de ahorros y el patrimonio · pide confirmación explicando el impacto.

- [ ] **F09-T06 · Vista de patrimonio**
  **Tipo:** Frontend · **Ref:** General §30, §48.7
  **Hacer:** la ecuación paso a paso como una lista de términos con signo, el patrimonio neto destacado con conteo animado, y el panel de composición con la barra apilada y su pie de cifras.
  **Aceptación:** · se lee como la ecuación del documento general · los términos en cero se muestran igual, para que la fórmula se entienda completa · las cifras coinciden con el dashboard.

- [ ] **F09-T07 · Distinción clara en el dashboard**
  **Tipo:** Frontend · **Ref:** General §19
  **Hacer:** asegurar que "Ahorro del mes" y "Total de ahorros" se distingan sin ambigüedad: etiquetas, subtítulos y ubicación distintas en la rejilla de indicadores.
  **Aceptación:** · no hay forma de confundir los dos conceptos mirando la pantalla · cada uno dice en su subtítulo qué representa.

- [ ] **F09-T08 · Verificación contra el Excel**
  **Tipo:** QA · **Ref:** General §30
  **Hacer:** comparar total de ahorros, inversiones y patrimonio neto contra la planilla.
  **Aceptación:** · las tres cifras coinciden · cualquier diferencia queda explicada.

- [ ] **F09-T09 · Pruebas de interfaz de patrimonio**
  **Tipo:** QA
  **Hacer:** prueba de Playwright que cambie el saldo inicial y verifique que el patrimonio cambia por el mismo importe.
  **Aceptación:** · la prueba pasa y corre en CI.

- [ ] **F09-T10 · Documentación de la Fase 9**
  **Tipo:** Doc
  **Hacer:** `docs/FASE_09_AHORRO_Y_PATRIMONIO.md`: los tres conceptos separados (flujo mensual, ahorro acumulado, patrimonio neto) con el cuadro de fórmulas, por qué pasivos y otros activos ya están en la ecuación valiendo cero, el ejemplo numérico del documento general, y la verificación contra el Excel.
  **Aceptación:** · incluye el cuadro de los tres conceptos · explica la preparación para pasivos futuros.

---

# FASE 10 — Inversiones

**Objetivo:** la cartera actual, deliberadamente simple: sin trading y sin bitácora de operaciones.

**Al cerrar esta fase:** administrás tus posiciones, ves el rendimiento de cada una y la compra y la venta mueven el ahorro sin descontar dos veces.

### Tema 10.1 — Lógica

- [ ] **F10-T01 · Lógica de valuación**
  **Tipo:** Lógica · **Ref:** General §22
  **Hacer:** `investment_value` con los dos modos (nominales por precio unitario, o valor manual); tests con precio ausente en modo de precio unitario (debe caer a manual sin romper) y con nominales en cero.
  **Aceptación:** · los dos modos de valuación funcionan, como exige el documento · sin precio no se rompe · nominales en cero da valor cero.

- [ ] **F10-T02 · Lógica de rendimiento**
  **Tipo:** Lógica · **Ref:** General §22
  **Hacer:** rendimiento absoluto y porcentual; **valor inicial en cero devuelve `None` y el porcentaje no se calcula**; totales de cartera (invertido, valor actual, resultado).
  **Aceptación:** · con valor inicial cero el porcentaje es `None` y la interfaz muestra "—" · el resultado de la cartera es la suma de los resultados individuales.

- [ ] **F10-T03 · Lógica de transferencia patrimonial**
  **Tipo:** Lógica · **Ref:** General §23, §24, §50 R7, R9 · Técnico §7.3
  **Hacer:** funciones que modelen compra y venta como movimiento entre ahorro y cartera; test clave: **el patrimonio neto no cambia por comprar ni por vender**; y test de que el rendimiento de una inversión no aparece como ingreso mensual (Regla 9).
  **Aceptación:** · comprar deja el patrimonio igual · vender deja el patrimonio igual · el importe no se descuenta dos veces · el rendimiento no se cuenta como ingreso.

### Tema 10.2 — Backend

- [ ] **F10-T04 · Tabla `investments` y migración**
  **Tipo:** Backend · **Ref:** Técnico §6.2
  **Hacer:** modelo y migración con el `CHECK` del tipo de instrumento (los seis del documento general), el modo de valuación, los `CHECK` de no negatividad y el índice; RLS; trigger.
  **Aceptación:** · los seis tipos del documento están en el enum · nominales o valor inicial negativos fallan en la base · `downgrade` probado.

- [ ] **F10-T05 · Servicio de cartera**
  **Tipo:** Backend · **Ref:** General §20, §22
  **Hacer:** servicio que liste la cartera con valores y rendimientos calculados, y los totales; recálculo del valor al cambiar precio, nominales o modo de valuación.
  **Aceptación:** · los totales coinciden con la suma de las posiciones · cambiar el precio actualiza el valor y el rendimiento.

- [ ] **F10-T06 · Endpoints de inversiones**
  **Tipo:** Backend · **Ref:** General §20, §21
  **Hacer:** `GET` de la cartera con totales; `POST` de alta con opción de descontar del ahorro; `PUT` de edición y actualización manual del valor; `DELETE` de venta con opción de devolver el importe al ahorro y confirmación obligatoria.
  **Aceptación:** · el alta con descuento genera el movimiento de transferencia y no un gasto de consumo · la venta sin indicar importe recuperado usa el valor actual · eliminar sin el parámetro de confirmación devuelve 400.

- [ ] **F10-T07 · Categoría de transferencia excluida del gasto**
  **Tipo:** Backend · **Ref:** General §23 · Técnico §7.3
  **Hacer:** categoría de sistema para transferencias patrimoniales, marcada para no contar como gasto de consumo; excluirla del desglose de egresos y del gráfico de gastos; impedir que se use desde el formulario manual.
  **Aceptación:** · comprar una inversión no infla el gasto del mes ni aparece en el desglose · la categoría no se ofrece en el formulario de alta manual · si ya venías usando una categoría "Inversiones" a mano, el sistema evita el doble descuento.

### Tema 10.3 — Frontend

- [ ] **F10-T08 · Indicadores de la cartera**
  **Tipo:** Frontend · **Ref:** General §22
  **Hacer:** cuatro indicadores: valor actual de cartera, total invertido, resultado con porcentaje, y cantidad de posiciones sin cotización al día.
  **Aceptación:** · el valor de cartera coincide con el indicador del dashboard · el resultado muestra signo y color según ganancia o pérdida.

- [ ] **F10-T09 · Tabla de posiciones**
  **Tipo:** Frontend · **Ref:** General §20.1
  **Hacer:** tabla con símbolo, nombre, tipo, nominales, valor inicial, valor actual, rendimiento con barra comparativa, porcentaje, fuente del precio y fecha de actualización; fila de totales; marca visible en las posiciones desactualizadas; scroll horizontal en móvil.
  **Aceptación:** · están los diez datos que pide el documento general · la fila de totales cuadra · se lee en 390 px desplazando.

- [ ] **F10-T10 · Alta de posición**
  **Tipo:** Frontend · **Ref:** General §20, §23
  **Hacer:** hoja con símbolo, nombre, tipo, modo de valuación, nominales, precio unitario o valor manual según el modo, y valor inicial; casilla para descontar el importe del ahorro con la explicación de que es una transferencia y no un gasto.
  **Aceptación:** · el formulario cambia los campos según el modo de valuación · la explicación de la transferencia está visible · al guardar, el patrimonio no cambia.

- [ ] **F10-T11 · Detalle, actualización manual y venta**
  **Tipo:** Frontend · **Ref:** General §21, §24, §50 R10
  **Hacer:** hoja de detalle con todos los datos y el rendimiento; campo de actualización manual del valor actual; botón de venta con confirmación que indique el importe recuperado y que explique que vuelve al ahorro.
  **Aceptación:** · la actualización manual recalcula rendimiento y cartera al instante · la venta pide confirmación · tras vender, el ahorro sube y la cartera baja por el mismo importe.

- [ ] **F10-T12 · Carga real de la cartera**
  **Tipo:** QA
  **Hacer:** cargar en producción tus posiciones reales y verificar que el valor de cartera y el patrimonio coinciden con tus números.
  **Aceptación:** · las cifras coinciden · las posiciones con valuación manual quedan bien configuradas.

- [ ] **F10-T13 · Pruebas de interfaz de inversiones**
  **Tipo:** QA · **Ref:** Técnico §19
  **Hacer:** prueba de Playwright que cree una posición con descuento del ahorro, verifique que el patrimonio no cambió, la venda y verifique que vuelve al estado anterior.
  **Aceptación:** · la prueba pasa · es la red de seguridad de la Regla 7.

- [ ] **F10-T14 · Documentación de la Fase 10**
  **Tipo:** Doc
  **Hacer:** `docs/FASE_10_INVERSIONES.md`: por qué es una cartera y no una bitácora, los dos modos de valuación con ejemplos numéricos, las fórmulas de rendimiento, el diagrama de la transferencia patrimonial en compra y en venta, el caso del doble descuento y cómo se evita, y las reglas 7, 8, 9 y 10 con su implementación.
  **Aceptación:** · incluye el diagrama de la transferencia · muestra con números que el patrimonio no cambia al comprar · explica el caso del valor inicial en cero.

---

# FASE 11 — Cotizaciones automáticas

**Objetivo:** actualización automática con proveedor desacoplado y **la carga manual como camino garantizado**.

**Al cerrar esta fase:** pulsás "Actualizar cotizaciones" y lo que se pueda actualizar se actualiza; lo que no, genera alerta y se puede cargar a mano.

### Tema 11.1 — Arquitectura del proveedor

- [ ] **F11-T01 · Interfaz del proveedor y proveedor manual**
  **Tipo:** Lógica → Backend · **Ref:** General §25 · Técnico §9.5
  **Hacer:** el protocolo `InvestmentPriceProvider`; el `ManualProvider` que no consulta nada y deja los valores como están; el orquestador que recorre la cadena configurada por variable de entorno y devuelve qué se actualizó y qué falló; tests con proveedores simulados, incluido uno que falla.
  **Aceptación:** · un proveedor que falla no rompe la operación completa · el orden se lee de la configuración · con sólo el proveedor manual todo sigue funcionando.

- [ ] **F11-T02 · Tabla `investment_price_cache` y migración**
  **Tipo:** Backend · **Ref:** Técnico §6.2
  **Hacer:** modelo y migración con la restricción única por símbolo, fuente y fecha del dato, el índice por símbolo y fecha, y el campo de carga original en JSON para depuración; dejar claro en el código y en el comentario de la tabla que **no representa operaciones de inversión**.
  **Aceptación:** · no se duplica la misma cotización · la tabla no se expone en ninguna pantalla · el comentario explica su propósito.

- [ ] **F11-T03 · Investigación y proveedor real**
  **Tipo:** Backend · **Ref:** General §25
  **Hacer:** comprobar las condiciones de acceso reales de BYMA y de al menos una fuente pública alternativa; implementar el proveedor que resulte viable; si ninguno es accesible para una cuenta personal, documentarlo y dejar el manual como único camino.
  **Aceptación:** · queda escrito qué fuente se puede usar y con qué límites · **no se asume acceso a BYMA sin comprobarlo** · la aplicación funciona igual si ninguna fuente está disponible.

- [ ] **F11-T04 · `POST /api/investments/refresh-prices`**
  **Tipo:** Backend · **Ref:** General §26
  **Hacer:** endpoint que actualice la cartera, cachee las cotizaciones, recalcule valores y rendimientos, y devuelva las listas de actualizados y fallidos; límite de una ejecución cada 15 minutos por usuario; respetar las posiciones con valuación manual, que no se tocan.
  **Aceptación:** · devuelve qué se actualizó y qué no · el segundo intento dentro de 15 minutos devuelve 429 con el tiempo restante · las posiciones manuales quedan intactas.

- [ ] **F11-T05 · Alerta de cotización desactualizada**
  **Tipo:** Backend · **Ref:** General §29
  **Hacer:** generar la alerta por cada símbolo que no se pudo actualizar, y marcar la posición como desactualizada cuando pasa un umbral configurable de días.
  **Aceptación:** · un símbolo fallido genera su alerta con el detalle · la alerta no se duplica si se reintenta · el umbral es configurable.

### Tema 11.2 — Frontend

- [ ] **F11-T06 · Botón de actualización y estado**
  **Tipo:** Frontend · **Ref:** General §26
  **Hacer:** botón "Actualizar cotizaciones" con estado de carga; fecha y hora de última actualización visible; toast con el resumen de cuántas se actualizaron y cuántas quedaron en manual; deshabilitado con el tiempo restante cuando el límite está activo.
  **Aceptación:** · el botón no se puede pulsar dos veces · se muestra la última actualización como pide el documento · el límite se explica al usuario, no es un error opaco.

- [ ] **F11-T07 · Señal de desactualizado**
  **Tipo:** Frontend · **Ref:** General §29
  **Hacer:** marca visible en las posiciones sin cotización al día, en la tabla y en el detalle; indicador contador en los KPI de la cartera; acceso directo desde la alerta a la posición afectada.
  **Aceptación:** · se identifica de un vistazo qué posición está vieja · desde la alerta se llega a la posición · la fuente y la fecha se muestran siempre.

- [ ] **F11-T08 · Camino manual destacado**
  **Tipo:** Frontend · **Ref:** General §25
  **Hacer:** cuando la actualización automática falla, el detalle ofrece el campo de carga manual con un texto que explique que es el camino alternativo.
  **Aceptación:** · tras un fallo, cargar a mano toma dos toques · el mensaje no suena a error del usuario.

- [ ] **F11-T09 · Prueba con proveedor caído**
  **Tipo:** QA
  **Hacer:** simular la caída del proveedor y verificar el flujo completo: fallo, alerta, actualización manual disponible, aplicación funcionando normalmente.
  **Aceptación:** · el flujo del diagrama del documento general se cumple · ninguna pantalla queda rota por la falta de cotizaciones.

- [ ] **F11-T10 · Documentación de la Fase 11**
  **Tipo:** Doc
  **Hacer:** `docs/FASE_11_COTIZACIONES.md`: la arquitectura desacoplada con el diagrama, el orden de prioridad de fuentes, qué se averiguó de BYMA y qué condiciones tiene, el flujo de fallo con captura, los límites de frecuencia y por qué existen, y cómo agregar un proveedor nuevo con el código de ejemplo.
  **Aceptación:** · documenta las condiciones reales de acceso averiguadas · incluye el ejemplo de cómo sumar un proveedor.
---

# FASE 12 — Historial salarial y análisis

**Objetivo:** el módulo salarial, independiente de los movimientos, y las métricas históricas.

**Al cerrar esta fase:** ves cómo evolucionó tu sueldo y tus promedios de los meses registrados.

### Tema 12.1 — Historial salarial

- [ ] **F12-T01 · Lógica de métricas salariales**
  **Tipo:** Lógica · **Ref:** General §28
  **Hacer:** funciones puras de variación absoluta y porcentual entre registros consecutivos, tiempo en meses entre aumentos, sueldo promedio por año y serie de evolución; tests con un solo registro (sin variación), con dos aumentos el mismo año y con cambio de empresa.
  **Aceptación:** · el primer registro no reporta variación · los meses entre aumentos se calculan bien cruzando años · el promedio anual sólo cuenta los registros vigentes en ese año.

- [ ] **F12-T02 · Tabla `employment_history` y migración**
  **Tipo:** Backend · **Ref:** Técnico §6.2
  **Hacer:** modelo y migración con el `CHECK` de sueldo no negativo y el índice por fecha de vigencia; RLS; trigger.
  **Aceptación:** · `downgrade` probado · RLS verificado.

- [ ] **F12-T03 · Endpoints del historial laboral**
  **Tipo:** Backend · **Ref:** General §28
  **Hacer:** `GET` con las métricas ya calculadas, `POST`, `PUT` y `DELETE`; orden por fecha de vigencia; el registro más reciente se expone como el sueldo actual.
  **Aceptación:** · las variaciones vienen calculadas desde el backend · el sueldo actual es el del registro de vigencia más reciente · está separado de `transactions`, sin mezclarse.

- [ ] **F12-T04 · Vista de evolución salarial**
  **Tipo:** Frontend · **Ref:** General §28
  **Hacer:** gráfico de evolución y lista de registros con cargo, empresa, fecha de vigencia, sueldo y variación en píldora; alta, edición y baja desde la misma pantalla.
  **Aceptación:** · reproduce el ejemplo del documento general · el gráfico y la lista coinciden · no se mezcla con los movimientos del mes.

- [ ] **F12-T05 · Datos laborales en configuración**
  **Tipo:** Frontend · **Ref:** General §48.9
  **Hacer:** bloque con empresa, cargo, sueldo actual y fecha de vigencia, con acceso directo a cargar un nuevo registro.
  **Aceptación:** · los datos actuales coinciden con el último registro · cargar un aumento desde acá actualiza el bloque.

### Tema 12.2 — Análisis

- [ ] **F12-T06 · Lógica de métricas históricas**
  **Tipo:** Lógica · **Ref:** General §53
  **Hacer:** las once métricas de la sección 53: gastos, ingresos y ahorro promedio, tasa de ahorro promedio, mayor y menor gasto mensual, mayor ahorro mensual, categoría con mayor gasto acumulado, evolución salarial, variación de gastos respecto del promedio y evolución del patrimonio; tests con un solo mes cargado.
  **Aceptación:** · las once métricas están · con un solo mes no se divide por cero · la categoría con mayor gasto acumula todos los meses, no sólo el actual.

- [ ] **F12-T07 · `GET /api/analytics`**
  **Tipo:** Backend · **Ref:** General §53
  **Hacer:** endpoint con las once métricas y los datos de la evolución salarial; parámetro opcional de cantidad de meses a considerar.
  **Aceptación:** · las cifras coinciden con las de la vista de historial · el parámetro de ventana funciona.

- [ ] **F12-T08 · Vista de análisis**
  **Tipo:** Frontend · **Ref:** General §48.8
  **Hacer:** indicadores de los promedios principales y tabla con las once métricas; panel de evolución salarial al costado.
  **Aceptación:** · las once métricas se muestran · las cifras coinciden con las otras vistas.

- [ ] **F12-T09 · Variación respecto del promedio**
  **Tipo:** Frontend · **Ref:** General §53
  **Hacer:** mostrar en el análisis y en el dashboard cuánto se desvía el mes actual del promedio reciente, con signo y color.
  **Aceptación:** · el dato es el mismo que alimenta las alertas de comportamiento, sin discrepancias.

- [ ] **F12-T10 · Carga del historial salarial real**
  **Tipo:** QA
  **Hacer:** cargar en producción tus registros laborales reales y verificar las variaciones.
  **Aceptación:** · las variaciones porcentuales coinciden con tu cálculo.

- [ ] **F12-T11 · Documentación de la Fase 12**
  **Tipo:** Doc
  **Hacer:** `docs/FASE_12_SALARIAL_Y_ANALISIS.md`: por qué el historial salarial es un módulo aparte y no movimientos, el cuadro de las métricas salariales con ejemplo numérico, las once métricas históricas con su fórmula, y capturas de las dos vistas.
  **Aceptación:** · incluye el ejemplo del documento general con los dos sueldos de 2026 · lista las once métricas con su fórmula.

---

# FASE 13 — Alertas

**Objetivo:** las cinco alertas analíticas del documento general. **Ninguna de presupuesto.**

**Al cerrar esta fase:** la aplicación te avisa de comportamientos que valen la pena mirar, sin molestar.

### Tema 13.1 — Motor de alertas

- [ ] **F13-T01 · Lógica de las cinco reglas**
  **Tipo:** Lógica · **Ref:** General §29, §3.6
  **Hacer:** funciones puras, una por regla: gasto de categoría sobre el promedio reciente (con proyección al cierre del mes), ahorro del mes bajo el promedio, categoría con crecimiento significativo, inversión sin cotización actualizada y mes sin movimientos cargados; umbrales configurables; tests con pocos meses de historia, donde no debe dispararse nada por falta de base de comparación.
  **Aceptación:** · las cinco reglas están implementadas · **ninguna regla mira presupuestos** porque no existen · con un solo mes de historia no se generan alertas por comparación · los umbrales se leen de configuración.

- [ ] **F13-T02 · Tabla `alerts` y migración**
  **Tipo:** Backend · **Ref:** Técnico §6.2
  **Hacer:** modelo y migración con el `CHECK` de severidad, el campo de contexto en JSON (mes, categoría e importes que la originaron) y el índice de alertas abiertas; RLS; trigger.
  **Aceptación:** · el contexto guarda lo necesario para explicar la alerta · `downgrade` probado.

- [ ] **F13-T03 · Servicio de evaluación**
  **Tipo:** Backend · **Ref:** General §29
  **Hacer:** servicio que evalúe las cinco reglas y genere las alertas nuevas, **sin duplicar** una alerta vigente del mismo tipo y contexto, y que cierre las que dejaron de aplicar; enganche con el recálculo del mes de la Fase 4.
  **Aceptación:** · evaluar dos veces no duplica · si el gasto baja, la alerta se cierra sola · el enganche con el recálculo funciona.

- [ ] **F13-T04 · Endpoints de alertas**
  **Tipo:** Backend · **Ref:** Técnico §9.1
  **Hacer:** `GET` de las no descartadas, `POST /evaluate` para forzar la evaluación, y `POST /{id}/read` y `/{id}/dismiss`.
  **Aceptación:** · las descartadas no vuelven a aparecer · marcar leída no la descarta · la evaluación forzada es idempotente.

### Tema 13.2 — Frontend

- [ ] **F13-T05 · Panel de alertas en el dashboard**
  **Tipo:** Frontend · **Ref:** General §29
  **Hacer:** lista de alertas al final del dashboard con icono por severidad, título y mensaje explicativo con los números que la originaron; entrada escalonada; aclaración de que son analíticas y no de presupuesto.
  **Aceptación:** · cada alerta explica por qué apareció con cifras concretas · las cuatro severidades se distinguen en ambos temas.

- [ ] **F13-T06 · Centro de alertas**
  **Tipo:** Frontend · **Ref:** Mockup
  **Hacer:** hoja desde el botón de la barra superior con el contador; acciones de marcar leídas y descartar; enlace directo al mes, categoría o inversión que originó cada alerta.
  **Aceptación:** · el contador refleja las no leídas · descartar la quita de la lista y del contador · el enlace lleva al contexto correcto.

- [ ] **F13-T07 · Alerta de mes sin cargar**
  **Tipo:** Frontend · **Ref:** General §29
  **Hacer:** cuando el mes en curso no tiene movimientos, mostrar el aviso con una invitación a cargar el primero, integrado con el estado vacío del dashboard.
  **Aceptación:** · aparece sólo si el mes está realmente vacío · desaparece al cargar el primer movimiento · no es invasiva.

- [ ] **F13-T08 · Umbrales en configuración**
  **Tipo:** Frontend · **Ref:** General §48.9
  **Hacer:** interruptores para activar y desactivar cada tipo de alerta y campos para los umbrales (porcentaje de desvío y meses de la ventana de comparación), guardados en `app_settings`.
  **Aceptación:** · desactivar un tipo deja de generarlo · cambiar el umbral se refleja en la siguiente evaluación.

- [ ] **F13-T09 · Verificación con datos reales**
  **Tipo:** QA
  **Hacer:** con el histórico real cargado, revisar que las alertas que aparecen tengan sentido y no sean ruido; ajustar umbrales por defecto si hace falta.
  **Aceptación:** · ninguna alerta es evidentemente falsa · los umbrales por defecto quedan justificados en la documentación.

- [ ] **F13-T10 · Documentación de la Fase 13**
  **Tipo:** Doc
  **Hacer:** `docs/FASE_13_ALERTAS.md`: las cinco reglas con su fórmula y un ejemplo real de cada una, por qué son analíticas y no presupuestarias, cómo se evita la duplicación, los umbrales por defecto con su justificación, y cómo agregar una regla nueva.
  **Aceptación:** · incluye los cinco ejemplos reales · deja explícito que no hay alertas de presupuesto.

---

# FASE 14 — Configuración y respaldo

**Objetivo:** cerrar la sección de configuración y garantizar que los datos no dependan de una sola copia.

**Al cerrar esta fase:** descargás un respaldo completo cuando quieras.

- [ ] **F14-T01 · Tabla `app_settings` y servicio**
  **Tipo:** Backend · **Ref:** Técnico §6.2
  **Hacer:** modelo y migración con la restricción única por usuario y clave; servicio de lectura y escritura con valores por defecto para las claves conocidas; RLS.
  **Aceptación:** · una clave inexistente devuelve su valor por defecto · `downgrade` probado.

- [ ] **F14-T02 · `GET` y `PUT /api/settings`**
  **Tipo:** Backend
  **Hacer:** endpoints de preferencias con validación por clave, para que no se pueda guardar un valor de tipo incorrecto.
  **Aceptación:** · un valor de tipo incorrecto devuelve 400 · las claves desconocidas se rechazan.

- [ ] **F14-T03 · Vista de configuración completa**
  **Tipo:** Frontend · **Ref:** General §48.9
  **Hacer:** las seis secciones que pide el documento: categorías, datos laborales, alertas, usuario, respaldo y proveedores de cotización; organizadas en paneles con la estética del mockup.
  **Aceptación:** · las seis secciones están presentes · todo lo que se muestra es funcional, nada decorativo.

- [ ] **F14-T04 · Preferencias de aplicación**
  **Tipo:** Frontend
  **Hacer:** interruptores de tema (claro, oscuro, seguir al sistema), alertas, actualización automática de cotizaciones y recordatorio de carga; persistidos en el servidor para que valgan en cualquier dispositivo.
  **Aceptación:** · las preferencias sobreviven al cambio de dispositivo · el tema sigue al sistema si se elige esa opción.

- [ ] **F14-T05 · Sección de usuario**
  **Tipo:** Frontend · **Ref:** General §48.9
  **Hacer:** nombre visible, email (de sólo lectura), saldo inicial, cambio de contraseña a través de Supabase Auth y cierre de sesión.
  **Aceptación:** · el cambio de contraseña funciona de punta a punta · el email no es editable.

- [ ] **F14-T06 · Lógica de exportación**
  **Tipo:** Lógica → Backend · **Ref:** General §58 · Técnico §18
  **Hacer:** armado del volcado completo del usuario (perfil, meses, categorías, movimientos, totales consolidados, inversiones, historial laboral, preferencias) con versión de esquema; tests que verifiquen que no falta ninguna tabla y que no se filtran datos de otro usuario.
  **Aceptación:** · el volcado contiene todas las tablas del usuario · lleva versión de esquema para una restauración futura · un volcado de otro usuario es imposible.

- [ ] **F14-T07 · `GET /api/export`**
  **Tipo:** Backend · **Ref:** Técnico §18
  **Hacer:** exportación en JSON y en CSV (ZIP con un archivo por tabla); nombre de archivo con la fecha; requiere autenticación.
  **Aceptación:** · el JSON se puede volver a leer sin pérdida · el CSV abre en Excel con los acentos correctos · sin sesión devuelve 401.

- [ ] **F14-T08 · Respaldo en la interfaz**
  **Tipo:** Frontend · **Ref:** General §58
  **Hacer:** botones de descarga de JSON y CSV con estado de carga; aviso de cuándo fue el último respaldo descargado; explicación de los tres niveles de copia y de cómo restaurar desde el panel de Supabase.
  **Aceptación:** · la descarga funciona desde el celular · el texto explica dónde están las otras copias.

- [ ] **F14-T09 · Script de respaldo local**
  **Tipo:** Infra · **Ref:** Técnico §18
  **Hacer:** `scripts/backup.py` que haga el volcado completo de la base a un archivo local con fecha en el nombre; instrucciones de uso en el README.
  **Aceptación:** · el script corre y genera el archivo · está documentado cómo restaurarlo.

- [ ] **F14-T10 · Prueba de restauración**
  **Tipo:** QA · **Ref:** General §58
  **Hacer:** restaurar un respaldo en el entorno de desarrollo y verificar que los datos quedan íntegros; documentar el procedimiento paso a paso.
  **Aceptación:** · la restauración funciona de verdad, probada · el procedimiento queda escrito · se confirma que el respaldo sirve, no sólo que se descarga.

- [ ] **F14-T11 · Documentación de la Fase 14**
  **Tipo:** Doc
  **Hacer:** `docs/FASE_14_CONFIGURACION_Y_RESPALDO.md`: cada sección de configuración con captura, los tres niveles de respaldo en un cuadro, el formato del volcado con un ejemplo recortado, y el procedimiento de restauración probado paso a paso.
  **Aceptación:** · incluye el procedimiento de restauración verificado · muestra el formato del volcado.

---

# FASE 15 — PWA completa

**Objetivo:** que funcione como una aplicación instalada, con lectura offline.

**Al cerrar esta fase:** la abrís desde el cajón de aplicaciones de Android y sin señal seguís viendo tus últimos datos.

- [ ] **F15-T01 · Service worker con las estrategias definidas**
  **Tipo:** Frontend · **Ref:** Técnico §15.1
  **Hacer:** implementar las cinco estrategias del cuadro: red primero con respaldo para el HTML, revalidación en segundo plano para los estáticos, red primero con respaldo para el dashboard, sólo red para el resto de las lecturas, y **sólo red para las escrituras**; versionado del caché y limpieza de versiones viejas al activarse.
  **Aceptación:** · cada tipo de recurso sigue su estrategia, verificable en las herramientas del navegador · al desplegar una versión nueva se limpia el caché viejo · **ninguna escritura se encola**.

- [ ] **F15-T02 · Lectura offline del dashboard**
  **Tipo:** Frontend · **Ref:** Técnico §12.6
  **Hacer:** sin conexión, servir el último dashboard cacheado con la banda superior de aviso; deshabilitar el botón de alta explicando que necesita conexión.
  **Aceptación:** · en modo avión se ve el último estado con el aviso · intentar cargar un gasto avisa y no pierde lo escrito · al recuperar la conexión la banda desaparece y se refrescan los datos.

- [ ] **F15-T03 · Actualización de la aplicación**
  **Tipo:** Frontend
  **Hacer:** detección de versión nueva y aviso discreto con botón de recargar; que el usuario nunca quede con una versión vieja sin saberlo.
  **Aceptación:** · tras un despliegue aparece el aviso · recargar trae la versión nueva · el aviso no interrumpe lo que se esté haciendo.

- [ ] **F15-T04 · Atajos de aplicación**
  **Tipo:** Frontend · **Ref:** Técnico §15
  **Hacer:** los dos atajos del manifest (nuevo gasto y nuevo ingreso) con su ruta, que abran directamente el formulario con el tipo preseleccionado.
  **Aceptación:** · al mantener pulsado el icono en Android aparecen los dos atajos · cada uno abre el formulario correcto.

- [ ] **F15-T05 · Iconos y pantalla de arranque**
  **Tipo:** Frontend
  **Hacer:** iconos en 192, 512 y maskable con márgenes correctos; colores de fondo y de tema del manifest coherentes con el tema elegido; verificar la pantalla de arranque en Android.
  **Aceptación:** · el icono maskable no se recorta mal en ningún formato · la pantalla de arranque no parpadea en blanco si el tema es oscuro.

- [ ] **F15-T06 · Instalación guiada**
  **Tipo:** Frontend
  **Hacer:** aviso discreto que invite a instalar la aplicación cuando el navegador lo permite, descartable y que no vuelva a aparecer si se descarta.
  **Aceptación:** · aparece sólo si se puede instalar · descartarlo lo silencia definitivamente · no aparece si ya está instalada.

- [ ] **F15-T07 · Auditoría de Lighthouse**
  **Tipo:** QA · **Ref:** Técnico §20
  **Hacer:** auditoría móvil en producción; corregir lo que baje de 90 en rendimiento y accesibilidad; verificar los presupuestos de JavaScript y CSS.
  **Aceptación:** · rendimiento y accesibilidad por encima de 90 · PWA instalable sin advertencias · JavaScript por debajo de 150 KB y CSS por debajo de 50 KB, comprimidos.

- [ ] **F15-T08 · Prueba en dispositivo real**
  **Tipo:** QA
  **Hacer:** instalar en tu teléfono y usarla un día completo: cargar gastos, navegar meses, revisar la cartera, con y sin señal.
  **Aceptación:** · el uso con una mano es cómodo · nada se siente lento · ningún elemento queda tapado por las barras del sistema.

- [ ] **F15-T09 · Documentación de la Fase 15**
  **Tipo:** Doc
  **Hacer:** `docs/FASE_15_PWA.md`: el cuadro de estrategias de caché explicado, por qué no hay escritura offline y qué habría que resolver para habilitarla, cómo instalar en Android con capturas, cómo funciona la actualización de versión, y los resultados de Lighthouse.
  **Aceptación:** · incluye el cuadro de estrategias · documenta la decisión sobre escritura offline y su costo futuro.

---

# FASE 16 — Seguridad, rendimiento y cierre del MVP

**Objetivo:** verificar los 24 criterios de aceptación del documento general y endurecer lo que haga falta.

**Al cerrar esta fase el MVP está terminado.**

- [ ] **F16-T01 · Auditoría de aislamiento entre usuarios**
  **Tipo:** QA · **Ref:** Técnico §17, §19
  **Hacer:** crear un segundo usuario de prueba e intentar, con su token, leer y escribir todos los recursos del primero por identificador directo; verificar que RLS bloquea incluso si un endpoint olvidara filtrar.
  **Aceptación:** · ningún recurso de otro usuario es accesible · la prueba queda automatizada en CI · se verifica que RLS actúa como segunda barrera.

- [ ] **F16-T02 · Cabeceras y política de contenido**
  **Tipo:** Infra · **Ref:** Técnico §17
  **Hacer:** aplicar la política de contenido completa; verificar las cabeceras de seguridad en producción; comprobar que no hay JavaScript en línea que la política bloquee.
  **Aceptación:** · la consola no muestra violaciones de la política · las cabeceras llegan en todas las respuestas · la política no tiene `unsafe-inline` en scripts.

- [ ] **F16-T03 · Auditoría de escapado de datos**
  **Tipo:** QA · **Ref:** Técnico §12.4
  **Hacer:** revisar que todo dato del servidor pase por la función de escapado; probar a cargar un movimiento con etiquetas HTML y JavaScript en la descripción y en el nombre de una categoría.
  **Aceptación:** · el texto se muestra tal cual, sin ejecutarse · no queda ningún punto de inserción sin escapar.

- [ ] **F16-T04 · Límite de peticiones**
  **Tipo:** Backend · **Ref:** Técnico §17
  **Hacer:** límite de 60 peticiones por minuto por usuario, con respuesta 429 que indique cuándo reintentar; verificar que el refresco de cotizaciones mantiene su límite propio.
  **Aceptación:** · el límite se activa y se recupera · el frontend muestra un mensaje entendible, no un error crudo.

- [ ] **F16-T05 · Revisión de secretos**
  **Tipo:** Infra · **Ref:** Técnico §11
  **Hacer:** revisar el historial completo de Git buscando secretos filtrados; confirmar que el paquete del navegador sólo contiene la URL y la clave anónima de Supabase; rotar cualquier clave que haya estado expuesta.
  **Aceptación:** · el historial está limpio · la clave de servicio y el secreto de JWT no aparecen en el frontend · si hubo exposición, la clave fue rotada.

- [ ] **F16-T06 · Validación en servidor sin excepciones**
  **Tipo:** QA · **Ref:** General §51
  **Hacer:** llamar a cada endpoint de escritura con datos inválidos **salteando el frontend**, para confirmar que el servidor valida por sí mismo: importes negativos y cero, categorías de tipo cruzado, fechas fuera del mes, textos excedidos, meses futuros.
  **Aceptación:** · todos los casos se rechazan en el servidor · ninguna validación depende sólo del formulario.

- [ ] **F16-T07 · Rendimiento del dashboard con volumen**
  **Tipo:** QA · **Ref:** Técnico §20
  **Hacer:** sembrar un año completo de datos realistas (unos 600 movimientos) y medir el dashboard, el listado filtrado y el historial; optimizar lo que exceda el objetivo.
  **Aceptación:** · el dashboard por debajo de 400 ms en el percentil 95 · el listado filtrado responde sin demora perceptible · las mediciones quedan documentadas.

- [ ] **F16-T08 · Manejo de errores de punta a punta**
  **Tipo:** QA · **Ref:** Técnico §9.3, §12.6
  **Hacer:** provocar cada escenario de fallo (base caída, token vencido, sin conexión, proveedor de cotizaciones caído, error inesperado) y verificar que la interfaz explica qué pasó y ofrece una salida, sin exponer detalles internos.
  **Aceptación:** · ningún caso muestra una pantalla en blanco ni una traza · todos ofrecen reintentar o una alternativa.

- [ ] **F16-T09 · Accesibilidad**
  **Tipo:** QA · **Ref:** Técnico §13.7
  **Hacer:** recorrer la aplicación completa sólo con teclado; verificar contrastes en ambos temas con un script sobre los pares de tokens; probar con lector de pantalla los flujos de alta de gasto y navegación de meses; comprobar que con movimiento reducido no hay animaciones.
  **Aceptación:** · todo es alcanzable por teclado con foco visible · los contrastes cumplen 4,5:1 · el alta de gasto es usable con lector de pantalla · el movimiento reducido se respeta.

- [ ] **F16-T10 · Verificación de los 24 criterios del MVP**
  **Tipo:** QA · **Ref:** General §65
  **Hacer:** recorrer uno por uno los 24 criterios de aceptación de la sección 65 del documento general y dejar constancia de cada uno con cómo se verificó.
  **Aceptación:** · los 24 están verificados y documentados · si alguno no se cumple, queda registrado con su plan de corrección.

- [ ] **F16-T11 · Verificación del MVP definitivo**
  **Tipo:** QA · **Ref:** General §64
  **Hacer:** comprobar el recorrido exacto de la sección 64: iniciar sesión y ver el mes con los seis indicadores, luego el gráfico diario, luego los seis meses, luego los gastos por categoría, luego los últimos movimientos, y el botón `+` para registrar rápido.
  **Aceptación:** · el orden del dashboard es el del documento general y el del mockup aprobado · el flujo completo se cumple sin desvíos.

### Tema 16.4 — Recuperación de contraseña por correo

Diferido a esta fase por decisión de Gustavo: durante las fases 2 a 15 la confirmación por correo está desactivada y el registro entra directo. Acá se cierra el ciclo completo de la cuenta.

- [ ] **F16-T12 · Configurar un SMTP propio, las plantillas y activar la confirmación**
  **Tipo:** Infra · **Ref:** Técnico §8.5
  **Hacer:** crear cuenta en Resend (o Brevo) y configurar el SMTP en Supabase → Authentication → SMTP Settings; personalizar las plantillas de **confirmación de cuenta** y **recuperación de contraseña** para que estén en español y digan Epic Wallet; volver a activar *Confirm email* en Providers → Email; probar que ambos mails llegan a una dirección real y no caen en spam.
  **Aceptación:** · el mail de confirmación llega en menos de un minuto · el de recuperación también · ambos en español y con el nombre correcto · el remitente no es el dominio compartido de Supabase. **Sin esta tarea la recuperación de contraseña no funciona en la práctica**: el servicio de mail de fábrica de Supabase limita a unos pocos envíos por hora.

- [ ] **F16-T13 · Pantalla de recuperación de contraseña**
  **Tipo:** Frontend · **Ref:** Técnico §8.3, §8.9
  **Hacer:** pantalla con un solo campo de email; al enviar, mensaje de confirmación **idéntico exista o no la cuenta** ("si la dirección existe, te llega un mail"); botón de reenviar con una espera mínima para no permitir ráfagas; enlace para volver al login.
  **Aceptación:** · el mail llega con el enlace de recuperación · el mensaje es el mismo con un email registrado y con uno inventado · no se puede reenviar en ráfaga.

- [ ] **F16-T14 · Pantalla de contraseña nueva**
  **Tipo:** Frontend · **Ref:** Técnico §8.3, §8.6
  **Hacer:** ruta `#/nueva-clave` que recibe la sesión temporal del enlace del mail; campos de contraseña nueva y repetir, con mostrar y ocultar; validación del mínimo y de que coincidan; al guardar, `updateUser({ password })`, aviso de éxito y entrada directa al dashboard; manejo del enlace vencido o ya usado con un mensaje que explique qué hacer.
  **Aceptación:** · el enlace del mail lleva a esta pantalla · la contraseña nueva queda guardada y sirve para entrar · el enlace no se puede reutilizar · un enlace vencido explica el problema y ofrece pedir otro · entrar con la contraseña vieja ya no funciona.

- [ ] **F16-T15 · Revisión final de código**
  **Tipo:** QA · **Ref:** Técnico §19, §21
  **Hacer:** lint y tipado sin advertencias; cobertura de servicios por encima del 90 %; eliminar código muerto, datos de ejemplo y marcadores de posición; revisar que no quede un solo `float` en cálculos de dinero.
  **Aceptación:** · lint y tipado limpios · cobertura cumplida · cero datos de ejemplo en producción · cero `float` en dinero.

- [ ] **F16-T16 · Documentación de la Fase 16 y manual de uso**
  **Tipo:** Doc
  **Hacer:** `docs/FASE_16_CIERRE_MVP.md` con el cuadro de los 24 criterios y cómo se verificó cada uno, los resultados de rendimiento y accesibilidad, y las decisiones de seguridad aplicadas; más `docs/MANUAL_DE_USO.md` explicando en lenguaje natural cómo usar la aplicación en el día a día.
  **Aceptación:** · el cuadro de los 24 criterios está completo · el manual sirve para alguien que nunca vio la aplicación.

---

# FASE 17 — Preparación de integraciones futuras

**Objetivo:** dejar el terreno listo **sin construir** las integraciones. Todo lo de esta fase es arquitectura y documentación.

- [ ] **F17-T01 · Verificar la anti-duplicación de importaciones**
  **Tipo:** Backend · **Ref:** General §62
  **Hacer:** confirmar que la restricción única de origen e identificador externo funciona; test que intente importar el mismo identificador dos veces.
  **Aceptación:** · el segundo intento se rechaza · el mensaje explica que ya existe.

- [ ] **F17-T02 · Esqueleto del canal de importación**
  **Tipo:** Backend · **Ref:** General §60, §61
  **Hacer:** definir las interfaces del canal (mapeador, validador, vista previa, confirmación) **sin implementar ningún origen concreto**; dejar documentado dónde se engancharía un archivo de Excel o un reporte de Mercado Pago.
  **Aceptación:** · las interfaces están definidas y documentadas · no hay ningún endpoint de importación habilitado.

- [ ] **F17-T03 · Investigación de Mercado Pago**
  **Tipo:** Doc · **Ref:** General §27
  **Hacer:** documentar los dos caminos (API de reportes y archivo CSV o XLSX), qué permisos requiere cada uno, qué tipo de cuenta hace falta y qué campos del reporte servirían; **dejar explícito que el camino por API no se da por garantizado para una cuenta personal hasta comprobarlo**.
  **Aceptación:** · los dos caminos están documentados con sus requisitos · queda claro qué hay que verificar antes de comprometerse.

- [ ] **F17-T04 · Plan de importación del Excel**
  **Tipo:** Doc · **Ref:** General §60
  **Hacer:** documentar el flujo del documento general (Excel, mapeador, validador, vista previa, confirmación, base) y la regla de trabajar con los valores resultantes de las celdas, sin reconstruir fórmulas.
  **Aceptación:** · el plan es ejecutable cuando se decida hacerlo · deja claro que no se depende de las fórmulas originales.

- [ ] **F17-T05 · Evaluación de evolución patrimonial**
  **Tipo:** Doc · **Ref:** General §54
  **Hacer:** documentar qué hace falta para el gráfico de evolución patrimonial completo, que el documento general deja para una fase posterior: guardar el valor histórico de la cartera mes a mes, con el costo de almacenamiento que implica.
  **Aceptación:** · queda claro qué cambio de esquema requiere y por qué no se hizo en el MVP.

- [ ] **F17-T06 · Repaso del alcance diferido**
  **Tipo:** Doc · **Ref:** General §4.2, §66
  **Hacer:** revisar la lista de lo que queda fuera del MVP y confirmar que la arquitectura no bloquea ninguno de esos puntos; anotar para cada uno qué habría que tocar.
  **Aceptación:** · ningún punto diferido requiere rehacer la base de datos · cada uno tiene anotado su punto de entrada.

- [ ] **F17-T07 · Documentación de la Fase 17 y cierre**
  **Tipo:** Doc
  **Hacer:** `docs/FASE_17_FUTURO.md` con todo lo investigado y planificado; más una actualización de `docs/INDICE.md` que enlace las diecisiete documentaciones de fase en orden.
  **Aceptación:** · el índice enlaza las diecisiete · cada integración futura tiene su plan escrito.

---

# Control de avance

| Fase | Tareas | Aprobadas | Estado |
|---|---|---|---|
| 0 · Puesta en marcha y producción | 12 | **12** | ✅ **Cerrada** el 03/10/2026 |
| 1 · Sistema de estilo y esqueleto | 14 | 13 | **En curso** · próxima: F01-T14 |
| 2 · Cuentas y autenticación | 15 | 0 | Pendiente |
| 3 · Meses y categorías | 13 | 0 | Pendiente |
| 4 · Movimientos | 15 | 0 | Pendiente |
| 5 · Cálculos y dashboard | 12 | 0 | Pendiente |
| 6 · Gráficos | 13 | 0 | Pendiente |
| 7 · Desglose y categorías | 9 | 0 | Pendiente |
| 8 · Historial y carga consolidada | 13 | 0 | Pendiente |
| 9 · Ahorro y patrimonio | 10 | 0 | Pendiente |
| 10 · Inversiones | 14 | 0 | Pendiente |
| 11 · Cotizaciones | 10 | 0 | Pendiente |
| 12 · Salarial y análisis | 11 | 0 | Pendiente |
| 13 · Alertas | 10 | 0 | Pendiente |
| 14 · Configuración y respaldo | 11 | 0 | Pendiente |
| 15 · PWA | 9 | 0 | Pendiente |
| 16 · Seguridad, cierre y correo | 16 | 0 | Pendiente |
| 17 · Integraciones futuras | 7 | 0 | Pendiente |
| **Total** | **214** | **15** | — |

Este cuadro se actualiza al cerrar cada tarea.

---

# Trazabilidad con el documento general

Verificación de que **ninguna** funcionalidad del documento general quedó afuera.

| Sección del general | Tema | Dónde se implementa |
|---|---|---|
| §3.1 Simplicidad del alta | Gasto mínimo y ampliado | F04-T09 |
| §3.2 Registro individual, vista acumulada | Acumulado por categoría | F04-T02, F07-T01 |
| §3.3 El mes actual es el centro | Dashboard del mes | F03-T10, F05-T07 |
| §3.4 Histórico simplificado | Carga consolidada | F08-T03, F08-T08 |
| §3.5 Sin presupuesto | Ausencia deliberada | Verificado en F13-T01 |
| §3.6 Sí alertas | Cinco reglas analíticas | Fase 13 |
| §5 Modelo financiero | Flujo, acumulado, patrimonio | F05-T01, F09-T01, F09-T02 |
| §6 Modelo de meses | Dos naturalezas | F03-T01, F03-T02 |
| §7 Categorías | Alta, edición, desactivación, reorden | F03-T06 a F03-T12 |
| §8 Movimientos | Entidad completa | F04-T03 |
| §9 Alta de gasto | Flujo y post-guardado | F04-T06, F04-T09, F04-T10 |
| §10 Alta de ingreso | Mismo flujo | F04-T09 |
| §11 Historial del mes por categoría | Detalle de categoría | F07-T02, F07-T05, F07-T06 |
| §12 Dashboard principal | Cabecera e indicadores | F03-T10, F05-T07 |
| §13 Gráfico diario | Barras **más línea de ahorro** | F06-T02, F06-T03, F06-T04 |
| §14 Gráfico de seis meses | Comparación | F06-T05 |
| §15 Desglose por categoría | Ordenable | F07-T01, F07-T04 |
| §16 Detalle de categoría | Total, última carga, movimientos | F07-T05 |
| §17 Historial general | Lista por año | F08-T07 |
| §18 Carga histórica manual | Con validación de descuadre | F08-T01, F08-T03, F08-T09 |
| §19 Ahorro acumulado | Saldo inicial y acumulado | F09-T01, F09-T05 |
| §20 Inversiones | Cartera actual | F10-T04 a F10-T11 |
| §21 Inversiones sin historial | Sin bitácora | F10-T06 |
| §22 Cálculo de inversiones | Dos modos de valuación | F10-T01, F10-T02 |
| §23 Compra y ahorro | Transferencia patrimonial | F10-T03, F10-T07 |
| §24 Venta | Devolución al ahorro | F10-T03, F10-T11 |
| §25 Actualización automática | Proveedor desacoplado | F11-T01, F11-T03 |
| §26 Frecuencia | Sin tiempo real, con límite | F11-T04, F11-T06 |
| §27 Mercado Pago | Integración futura | F17-T03 |
| §28 Historial salarial | Módulo independiente | F12-T01 a F12-T05 |
| §29 Alertas | Las cinco | Fase 13 |
| §30 Patrimonio | Ecuación completa | F09-T04, F09-T06 |
| §31–§43 Modelo de datos | Todas las tablas | F02-T02, F03-T03, F03-T07, F04-T03, F04-T04, F09-T03, F10-T04, F11-T02, F12-T02, F13-T02, F14-T01 |
| §44 Arquitectura | Stack | Fase 0 |
| §45 PWA | Instalable y offline | Fase 15 |
| §46 Responsive | Mobile-first | F01-T06, F01-T13 |
| §47 Navegación | Siete secciones | F01-T07 |
| §48 Pantallas principales | Las nueve, más registro, recuperación y contraseña nueva | Fases 1 a 14 |
| Cuentas de usuario | Registro, cambio de contraseña y aislamiento entre cuentas | F02-T02, T04, T08, T11, T14 · **ampliación pedida sobre el documento general** |
| Confirmación y recuperación por correo | SMTP, plantillas, recuperación y contraseña nueva | F16-T12, T13, T14 · **diferido al final por pedido de Gustavo** |
| §49 API backend | Endpoints | Fases 2 a 14 |
| §50 Reglas de negocio | Las doce | R1 F03-T03 · R2 F04-T05 · R3 F08-T03 · R4 F03-T02, F06-T12, F07-T06 · R5/R6 F05-T01 · R7 F10-T03, F10-T07 · R8 F09-T02 · R9 F10-T03 · R10 F10-T11 · R11 F04-T13 · R12 F02-T01 |
| §51 Validaciones | Movimiento, inversión, categoría | F04-T01, F10-T01, F03-T06, F16-T06 |
| §52 Cálculos | Todas las fórmulas | F05-T01 |
| §53 Métricas históricas | Las once | F12-T06 |
| §54 Gráficos | Los cinco del MVP | Fase 6 |
| §55 Últimos movimientos | Con "ver todos" | F04-T12 |
| §56 Búsqueda y filtros | Los cinco filtros | F04-T08, F04-T12 |
| §57 Seguridad | Los trece requisitos | Fase 16 |
| §58 Backup | Tres niveles | F14-T06 a F14-T10 |
| §59 Auditoría técnica | Metadata de cambios | F04-T03 (campos de fecha) |
| §60 Importación de Excel | Futura | F17-T04 |
| §61–§62 Importación y duplicados | Futura, con base lista | F17-T01, F17-T02 |
| §63 Roadmap original | Reordenado con producción primero | Este documento |
| §64 MVP definitivo | Recorrido exacto | F16-T11 |
| §65 Criterios de aceptación | Los 24 | F16-T10 |
| §66 Decisiones del producto | Sí y no respetados | Verificado por fase |
| §67 Decisiones técnicas abiertas | Las diez, resueltas | `02_Documento_Tecnico.md` |
| §71 Orden recomendado | Respetado, con producción al inicio | Este documento |

---

# Cómo trabajamos a partir de ahora

1. Me decís qué tarea arrancamos (o arrancamos por **F00-T01**).
2. La implemento en el orden lógica → backend → frontend, y la subo a una URL de preview.
3. Te aviso qué probar, cómo probarlo y qué deberías ver.
4. Vos la probás en el celular.
5. Si la aprobás, la marco `- [x]`, la integro a producción y actualizo el cuadro de avance. Si no, la marco `- [!]`, anoto qué falló y la corrijo.
6. Al cerrar todas las tareas de una fase, escribo su documento de fase.

Nunca avanzo a la tarea siguiente sin tu aprobación, y nunca implemento varias tareas juntas.
