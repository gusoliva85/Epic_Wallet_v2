# Roadmap de implementación — Epic Wallet 2.0

**Versión:** 2.0 — simplificada
**Fecha:** 07/10/2026
**Reemplaza:** la versión 1.0 del 03/10/2026, de 216 tareas
**Documentos base:** `01_Documento_General.md` (qué) · `02_Documento_Tecnico.md` (cómo) · `mockups/01_Mockup_V1_Grafito_Clasico.html` (diseño aprobado)

---

## Por qué hay una versión 2.0

La versión 1.0 tenía 216 tareas. Después de cuatro días quedaban 37 cerradas (17 %) y el esfuerzo se estaba yendo a andamiaje en lugar de a la aplicación: 7.572 líneas de test contra 1.497 de backend, 18 documentos de cierre de fase proyectados, y el dashboard con datos reales recién en la tarea 98.

Esta aplicación la van a usar **pocas personas conocidas**, cada una viendo sus propios datos de contabilidad. No es un producto público ni maneja dinero de terceros. El plan se recortó a esa escala.

| | v1.0 | v2.0 |
|---|---|---|
| Tareas detalladas | 216 | **83** |
| Tareas pendientes | 179 | **46** |
| Tareas hasta el dashboard con datos reales | 98 | **24** |
| Documentos de cierre de fase | 18 | **1** (`docs/COMO_FUNCIONA.md`) |
| Entornos de base de datos | 2 esquemas + plan de partir en 2 proyectos | **1 esquema** |
| Fase de auditoría de seguridad | 16 tareas | **1 tarea** |

**Lo que no cambió (al momento de escribir esto):** el modelo financiero, las dos naturalezas de mes, las siete pantallas, el diseño «Vidrio Grafito», los seis indicadores, los cinco gráficos, el histórico consolidado, las inversiones, RLS y el login. La aplicación que vas a usar es la misma.

> **Revisado 2026-10-21:** de las siete pantallas de entonces quedan seis — "Análisis" se sacó de la navegación (F11-T01, el mismo día que la tarea de Configuración), a pedido de Gustavo: no le resultaba útil y nunca tuvo más que datos de muestra detrás. Ver la fila de la tabla de "Después del MVP" más abajo.

**Lo que se movió a «Después del MVP»:** cotizaciones automáticas, historial salarial, análisis, alertas, PWA offline y preparación de integraciones. Están descriptas como temas, sin tareas detalladas: detallarlas hoy es escribir algo que se va a reescribir cuando les llegue el turno.

**Los identificadores de tarea no se renumeraron.** Cuando dos tareas de la v1.0 se fusionaron, la tarea nueva conserva el identificador más bajo. Así los commits que ya existen siguen apuntando a algo. Los identificadores que desaparecieron están listados al final.

---

## Cómo se usa este documento

Es la guía de implementación. Ninguna tarea se ejecuta fuera de acá.

| Marca | Significado |
|---|---|
| `- [ ]` | Pendiente |
| `- [~]` | Implementada, esperando tu prueba en la URL de preview |
| `- [x]` | Aprobada por vos |
| `- [!]` | Rechazada; abajo queda la nota de qué falló |

Una tarea pasa a `- [x]` sólo cuando vos lo decís.

### Reglas de ejecución

1. **Una tarea a la vez.** No se adelantan fases.
2. **Dentro de cada tarea: cálculo → backend → frontend.** Primero las funciones puras con sus tests, después el endpoint, después la interfaz.
3. **Se prueba en la URL de preview, desde el celular.** Al terminar te digo qué probar y espero.
4. **Las tareas se escriben cortas:** qué hacer y cómo se verifica. Sin ensayos, sin relato de los errores encontrados. Lo que valga la pena recordar va a `docs/COMO_FUNCIONA.md`.
5. **Este documento es editable por vos.** Tu edición manda sobre lo que yo haya planificado.

### Política de pruebas

Se testea **lo que da un número o protege un dato**:

- toda función de `services/calc.py`, antes del endpoint que la usa;
- el recálculo del mes y la propagación a los saldos posteriores;
- los casos borde: ingresos en cero, mes vacío, mes histórico sin movimientos;
- que una cuenta no pueda leer ni escribir datos de otra;
- que el servidor rechace importes negativos o cero, no sólo el formulario.

**No se testea** la estructura del HTML, los tokens de CSS, el contraste calculado, la configuración del despliegue ni el contenido de la documentación. Eso se verifica mirando la pantalla en el celular, que es lo que ya hacés en cada tarea. No hay exigencia de porcentaje de cobertura.

### Tipo de tarea

`Infra` · `Cálculo` funciones puras y tests · `Backend` modelos, servicios y endpoints · `Frontend` interfaz · `QA` verificación.

---

## Resumen de fases

| Fase | Nombre | Pendientes | Qué queda funcionando |
|---|---|---|---|
| **0** | Puesta en marcha y producción | — cerrada | URL pública, PWA instalable, API respondiendo |
| **1** | Sistema de estilo y esqueleto visual | — cerrada | Las seis pantallas navegables con datos de ejemplo, claro/oscuro |
| **2** | Cuentas de usuario | — cerrada | Registro, login, cambio de contraseña, cuentas aisladas |
| **3** | Meses y categorías | — cerrada | Navegación de meses real y categorías administrables |
| **4** | Movimientos | — cerrada | Alta, edición, baja y listado con recálculo del mes |
| **5** | Indicadores del dashboard | — cerrada | Los 6 indicadores con datos reales |
| **6** | Gráficos | — cerrada | Los 5 gráficos |
| **7** | Desglose y detalle de categoría | — cerrada | Desglose ordenable y movimientos por categoría |
| **8** | Histórico y carga del Excel | **1**, de carga de datos, no bloquea | **Acá la aplicación ya te sirve todos los días** |
| **9** | Ahorro acumulado y patrimonio | **1**, de verificación, no bloquea | Saldo acumulado y patrimonio neto |
| **10** | Inversiones | **1**, de carga de datos, no bloquea | Cartera con compra, venta y rendimientos |
| **11** | Cierre del MVP | **0** | Las cinco hechas. T03 con el correo saliente fuera de alcance; T04 y T05 esperando tu aprobación. Del MVP, 22 de los 24 criterios verificados y 2 con excepción decidida (cotizaciones y alertas, después del MVP) |
| **12** | Apronte de escritorio | **1** (T03) | Layout de escritorio y gestos en el celular aprobados; T02 corregida (el círculo del cambio de tema no corría desde F12-T04) y esperando tu confirmación; T03 queda abierta a propósito, para lo que vaya apareciendo |

**Revisado 2026-10-23** junto con Gustavo: todo lo de las fases 0 a 10 está aprobado (las tres pendientes de carga de datos no cuentan como tareas de código). De la Fase 11, F11-T01 y F11-T02 aprobadas; de la Fase 12, F12-T01 y F12-T04 aprobadas. Quedan **8 tareas** entre las dos fases abiertas.

**Revisado 2026-10-27:** F11-T03 cerrada con el correo saliente fuera de alcance, y F11-T04 y F11-T05 hechas el mismo día. **La Fase 11 queda completa y con ella el MVP**, a falta de tu aprobación. **F12-T02 encontrada y corregida el mismo día** —el cambio de tema hacía el fundido de fábrica del navegador en vez de su círculo, por un espacio en un selector; estuvo roto cuatro días, desde F12-T04— y espera que lo confirmes desde tu navegador. Queda **1 tarea** abierta a propósito: F12-T03, que se llena con lo que encuentres usando la aplicación en la PC. F12-T01 y F12-T04 ya estaban aprobadas. Las tres de carga manual de datos (F08-T11, F09-T08, F10-T12) son tuyas y no cuentan como código.

---

# FASES CERRADAS

El detalle de estas dos fases está en `docs/FASE_00_PUESTA_EN_MARCHA.md` y `docs/FASE_01_SISTEMA_DE_ESTILO.md`, que se conservan tal como se escribieron.

### Fase 0 — Puesta en marcha y producción

| | Tarea |
|---|---|
| `F00-T01` | Repositorio y estructura de carpetas |
| `F00-T02` | Herramientas de Python (ruff, mypy, pytest) |
| `F00-T03` | Tailwind v4 y el paso de build |
| `F00-T04` | Proyecto de Supabase en São Paulo (`sa-east-1`) |
| `F00-T05` | Alembic con esquema explícito |
| `F00-T06` | Primera cuenta en Supabase Auth |
| `F00-T07` | FastAPI mínima con `/api/health` |
| `F00-T08` | Vercel, `vercel.json` y primer despliegue en `gru1` |
| `F00-T09` | Previews por rama |
| `F00-T10` | `index.html` con el fondo y la estética |
| `F00-T11` | Manifest e instalación como PWA |
| `F00-T12` | Documentación de la Fase 0 |

### Fase 1 — Sistema de estilo y esqueleto visual

| | Tarea |
|---|---|
| `F01-T01` | Tokens de diseño |
| `F01-T02` | Base: fondo, ruido y tipografía |
| `F01-T03` | Las dos capas de vidrio (`.shell` y `.cg`) |
| `F01-T04` | Cambio de tema claro/oscuro |
| `F01-T05` | Barra superior |
| `F01-T06` | Navegación inferior y botón flotante |
| `F01-T07` | Enrutador por hash y las siete vistas |
| `F01-T08` | Barra de mes (sin lógica real) |
| `F01-T09` | Tarjetas de indicador |
| `F01-T10` | Filas de lista |
| `F01-T11` | Hoja inferior y cajón lateral |
| `F01-T12` | Avisos, píldoras y notificaciones |
| `F01-T13` | Las siete vistas maquetadas con datos de ejemplo |
| `F01-T14` | Documentación de la Fase 1 |

### Fase 2 — lo ya cerrado

| | Tarea |
|---|---|
| `F02-T01` | Verificación del JWT con JWKS y ES256 |
| `F02-T02` | URLs de redirección y política de contraseñas |
| `F02-T03` | Tabla `profiles`, RLS y migración |
| `F02-T04` | Trigger de perfil y 21 categorías iniciales |
| `F02-T05` | Propagación del token a Postgres para que `auth.uid()` funcione |
| `F02-T06` | `GET`/`PATCH /api/me` y `POST /api/me/bootstrap` |
| `F02-T07` | Toda la API protegida por defecto a nivel de enrutador |
| `F02-T16` | Esquema de producción migrado y permisos de `anon` cerrados |
| `F02-T08` | Supabase Auth en el cliente |
| `F02-T09` | Pantalla de inicio de sesión |
| `F03-T07` | Tabla `categories` y migración *(adelantada en F02-T04)* |

**Dos cosas quedaron dichas y no hechas**, y las recoge el plan nuevo:

- El enlace *Crear cuenta* está en la pantalla de login pero apagado, con «llega en la próxima tarea» a la vista. Lo habilita **F02-T10**.
- El enlace *Olvidé mi contraseña* lo encendió **F11-T03**, pero lleva a un mensaje y no a un formulario: el correo saliente quedó fuera de alcance (decisión de Gustavo, 2026-10-27, ver esa tarea).

---

# FASE 2 — Cuentas de usuario

**Objetivo:** cerrar el ciclo de una cuenta sin depender del correo. Registro, entrar, salir, cambiar la contraseña, y cada cuenta viendo sólo lo suyo.

**Al cerrar esta fase:** te registrás desde el celular, entrás, cambiás tu contraseña, y una segunda cuenta de prueba no ve ni un dato de la primera.

> **La confirmación por correo sigue desactivada** en Supabase (Authentication → Providers → Email → *Confirm email* en off), así el registro funciona de inmediato. Y **queda así**: F11-T03 dejó el correo saliente fuera de alcance, porque mandar un mail necesita un SMTP contratado. El objetivo de esta fase —«cerrar el ciclo de una cuenta sin depender del correo»— terminó siendo el estado definitivo, no el provisorio.

- [x] **F02-T10 · Pantalla de registro**
  **Tipo:** Frontend · **Ref:** Técnico §8.2, §8.3
  **Hacer:** email, contraseña y repetir contraseña con mostrar/ocultar; validación en vivo de que coincidan y del mínimo de 8 caracteres; al enviar, entrada directa al dashboard; un email ya registrado no revela que existe. Habilitar el enlace *Crear cuenta* de la pantalla de login.
  **Aceptación:** · se crea una cuenta de punta a punta desde el celular y entra directo · la cuenta nueva aparece con su dashboard vacío y sus 21 categorías · contraseñas que no coinciden no permiten enviar.

- [x] **F02-T11 · Cambio de contraseña desde la aplicación**
  **Tipo:** Frontend · **Ref:** Técnico §8.3 · General §48.9
  **Hacer:** en configuración, sección de cuenta con el email (sólo lectura), nombre visible editable, y cambio de contraseña pidiendo la actual y la nueva dos veces.
  **Aceptación:** · la contraseña nueva sirve para entrar · con la actual equivocada no se cambia nada · el email no es editable.

- [x] **F02-T12 · Guardia de rutas, cierre de sesión y cliente de API**
  **Tipo:** Frontend · **Ref:** Técnico §9.3, §12.1, §12.3 · *fusiona F02-T12 y F02-T13*
  **Hacer:** separar rutas públicas de privadas, con redirección en los dos sentidos; botón de cerrar sesión que limpia estado y caché; `api.js` con el token en la cabecera, que ante un 401 renueva la sesión y reintenta **una sola vez** y si falla cierra sesión; clase `ApiError` y traducción de los códigos a mensajes en español.
  **Aceptación:** · `#/inversiones` sin sesión lleva al login y `#/login` con sesión lleva al dashboard · al cerrar sesión no queda nada del usuario anterior, ni volviendo atrás · un token vencido se recupera solo · dos 401 seguidos cierran sesión sin bucle.

- [x] **F02-T14 · Aislamiento entre cuentas**
  **Tipo:** QA · **Ref:** Técnico §6.5, §8.2
  **Hacer:** segunda cuenta de prueba con datos propios; verificar desde la interfaz que ninguna ve nada de la otra; y con el token de la segunda intentar leer y escribir por identificador directo los recursos de la primera en todos los endpoints.
  **Aceptación:** · ningún recurso ajeno es accesible, ni pasando su `id` a mano · RLS bloquea incluso salteando el filtro del endpoint · la prueba queda automatizada.

---

# FASE 3 — Meses y categorías

**Objetivo:** que la barra de mes navegue meses reales y las categorías se puedan administrar.

**Al cerrar esta fase:** te movés entre meses de verdad, el mes actual se abre solo, y agregás o renombrás una categoría.

- [x] **F03-T01 · Lógica de meses: identidad, estado y las dos naturalezas**
  **Tipo:** Cálculo · **Ref:** Técnico §6.6 · General §6, §50 R1, R3 · *fusiona F03-T01 y F03-T02*
  **Hacer:** funciones puras de identidad (`año`/`mes`), mes actual según la zona `America/Argentina/Buenos_Aires`, navegación anterior/siguiente con cruce de año, y la resolución de las dos naturalezas: de dónde salen los totales según `status` sea `open` o `historical`.
  **Aceptación:** · diciembre → siguiente da enero del año que viene · un mes futuro se rechaza · un mes `historical` devuelve sus totales de los campos del mes y **`transactions: null`**, distinto de `[]`.

- [x] **F03-T03 · Tabla `months`, repositorio y servicio**
  **Tipo:** Backend · **Ref:** Técnico §6.2 · *fusiona F03-T03 y F03-T04*
  **Hacer:** modelo y migración de `months` con `unique (user_id, year, month)`, RLS y trigger de `updated_at`; repositorio con las consultas; servicio que abre el mes actual si no existe.
  **Aceptación:** · dos meses iguales del mismo usuario se rechazan en la base · el mes actual se crea solo la primera vez y no se duplica · `downgrade` probado.

- [x] **F03-T05 · Endpoints de meses**
  **Tipo:** Backend · **Ref:** Técnico §9.1
  **Hacer:** `GET /api/months` con la lista y `GET /api/months/{id}` con el detalle, respetando las dos naturalezas.
  **Aceptación:** · sin token devuelve 401 · un mes de otro usuario devuelve 404, no 403 · el mes histórico devuelve `transactions: null`.

- [x] **F03-T08 · Categorías: validación, siembra y endpoints**
  **Tipo:** Cálculo → Backend · **Ref:** General §7, §34, §51 · *fusiona F03-T06, F03-T08 y F03-T09*
  **Hacer:** validación de nombre y tipo, con `unique (user_id, type, name)`; verificar que la siembra del trigger de `F02-T04` dejó las 21 categorías en orden; `GET`, `POST`, `PATCH` y `DELETE` de categorías, con `on delete restrict` si tiene histórico.
  **Aceptación:** · dos categorías con el mismo nombre y tipo se rechazan · una categoría con movimientos no se puede borrar y el mensaje lo explica · una categoría de ingreso no sirve para un egreso.

- [x] **F03-T10 · Barra de mes conectada y administración de categorías**
  **Tipo:** Frontend · **Ref:** Técnico §12.2 · *fusiona F03-T10, F03-T11 y F03-T12*
  **Hacer:** la barra de mes consumiendo la API, con flechas deshabilitadas en los extremos y botón «Hoy»; caché por mes en memoria que se invalida al escribir; pantalla de administración de categorías en configuración.
  **Aceptación:** · navegar entre meses no recarga la página · volver a un mes ya visto no vuelve a pedirlo · después de dar de alta un movimiento el mes se vuelve a pedir · se agrega, renombra y archiva una categoría desde el celular.

---

# FASE 4 — Movimientos

**Objetivo:** el corazón de la aplicación. Cargar un gasto en pocos toques y ver el mes actualizarse.

**Al cerrar esta fase:** apretás `+`, cargás un gasto en el celular, y los totales del mes cambian al instante.

- [x] **F04-T01 · Lógica de validación y recálculo del mes**
  **Tipo:** Cálculo · **Ref:** General §8, §37, §51 · *fusiona F04-T01 y F04-T02*
  **Hacer:** validación pura de un movimiento (importe > 0, fecha dentro del mes, categoría del tipo correcto, descripción opcional con límite) y la función de recálculo que, dados los movimientos, devuelve los totales por tipo y por categoría.
  **Aceptación:** · importe cero o negativo se rechaza · una fecha fuera del mes se rechaza · una categoría de ingreso en un egreso se rechaza · el recálculo de un mes sin movimientos da todos los totales en cero, no error.

- [x] **F04-T03 · Tablas `transactions` y `monthly_category_totals`**
  **Tipo:** Backend · **Ref:** Técnico §6.2 · *fusiona F04-T03 y F04-T04*
  **Hacer:** modelos y migración con `numeric(14,2)`, `check (amount > 0)`, `unique (user_id, source, external_id)` para la anti-duplicación futura, `is_manual_summary` en los totales, RLS y triggers.
  **Aceptación:** · un importe negativo lo rechaza la base, no sólo el servicio · `downgrade` probado · los centavos no se redondean solos.

- [x] **F04-T05 · Servicio de recálculo transaccional**
  **Tipo:** Backend · **Ref:** Técnico §7.2
  **Hacer:** servicio que al escribir un movimiento recalcula en **una sola transacción** los totales del mes y los totales por categoría.
  **Aceptación:** · si el recálculo falla, el movimiento no queda guardado a medias · cargar un movimiento deja los totales coherentes con la suma de los movimientos.

- [x] **F04-T06 · Endpoints de movimientos**
  **Tipo:** Backend · **Ref:** Técnico §9.1 · *fusiona F04-T06, F04-T07 y F04-T08*
  **Hacer:** `POST`, `PUT` y `DELETE /api/transactions`, y `GET` con filtros por mes, tipo, categoría, rango de fechas y texto en la descripción.
  **Aceptación:** · cada escritura devuelve los totales nuevos del mes · un movimiento de otro usuario devuelve 404 · los filtros combinan · el borrado queda registrado con su metadata técnica (General §59).

- [x] **F04-T09 · Formulario de alta rápida**
  **Tipo:** Frontend · **Ref:** General §9, §10 · *fusiona F04-T09, F04-T10 y F04-T11*
  **Hacer:** hoja inferior desde el botón `+` con tipo, importe, categoría, fecha (hoy por defecto) y descripción opcional; teclado numérico en el importe; validación en vivo; al guardar, actualización inmediata de los indicadores sin recargar.
  **Aceptación:** · un gasto se carga en menos de cinco toques · el teclado del celular abre en numérico · un importe vacío no permite enviar · los indicadores cambian al guardar.

- [x] **F04-T12 · Lista del mes, detalle, edición y baja**
  **Tipo:** Frontend · **Ref:** General §11 · *fusiona F04-T12 y F04-T13*
  **Hacer:** lista de movimientos del mes agrupada por día, con los filtros de la API; al tocar una fila, hoja de detalle con editar y borrar, la baja con confirmación (R11).
  **Aceptación:** · la lista refleja lo cargado y ordena por fecha descendente · editar el importe actualiza los totales · borrar pide confirmación y no se puede deshacer por accidente · un mes sin movimientos muestra el estado vacío, no una lista en blanco.

---

# FASE 5 — Indicadores del dashboard

**Objetivo:** los seis indicadores de la sección 12.2 del documento general, con datos reales.

**Al cerrar esta fase:** abrís la aplicación y ves tu mes de verdad.

- [x] **F05-T01 · Módulo de cálculos puros**
  **Tipo:** Cálculo · **Ref:** Técnico §7, §7.1 · General §52 · *fusiona F05-T01, F05-T02 y F05-T03*
  **Hacer:** `services/calc.py` con ingresos, gastos, ahorro del mes, tasa de ahorro, ahorro acumulado, total de inversiones y patrimonio; la serie diaria del mes con el ahorro acumulado día a día; y los casos borde obligatorios de la sección 7.1.
  **Aceptación:** · **tasa de ahorro con ingresos en cero devuelve `null`, no un error ni una división** · un mes vacío da ceros · la serie diaria de un mes histórico es `null` · cada función tiene su test y son todas puras: reciben números y devuelven números.

- [x] **F05-T04 · Servicio y endpoint `/api/dashboard`**
  **Tipo:** Backend · **Ref:** Técnico §9.2 · *fusiona F05-T04, F05-T05 y F05-T06*
  **Hacer:** el contrato central de la sección 9.2 en **una sola llamada** que trae indicadores, serie diaria, últimos seis meses y desglose por categoría. *(Los "últimos movimientos" del contrato original se sacaron después: duplicaban la vista Movimientos sin agregar nada.)*
  **Aceptación:** · una sola petición alimenta todo el dashboard · un mes histórico responde con `transactions: null` y sin serie diaria · responde en menos de 400 ms desde la función desplegada.

- [x] **F05-T07 · Los seis indicadores conectados**
  **Tipo:** Frontend · **Ref:** General §12.2 · *fusiona F05-T07, F05-T08, F05-T09 y F05-T10*
  **Hacer:** las seis tarjetas con datos reales; animación de conteo; estados de carga, error y vacío; formato de importes en pesos argentinos con `tabular-nums` para que las cifras no bailen.
  **Aceptación:** · los seis indicadores muestran lo mismo que la API · con la red caída se ve un error entendible, no una pantalla rota · un mes sin datos muestra ceros con su explicación · las cifras no cambian de ancho al actualizarse.

- [x] **F05-T11 · Verificación contra el Excel**
  **Tipo:** QA
  **Hacer:** cargar un mes completo del Excel a mano y comparar los seis indicadores con los del Excel, peso por peso.
  **Aceptación:** · los seis coinciden · cualquier diferencia queda explicada o corregida antes de cerrar la fase.

---

# FASE 6 — Gráficos

**Objetivo:** los cinco gráficos de la sección 54, en SVG propio.

**Al cerrar esta fase el MVP de la sección 64 está completo.**

- [x] **F06-T01 · Utilidades de SVG**
  **Tipo:** Frontend · **Ref:** Técnico §14.3
  **Hacer:** escalas, ejes, grilla, formato de etiquetas y contenedor que se adapta al ancho; las reglas comunes de la sección 14.3.
  **Aceptación:** · un gráfico se dibuja a 390 px y a 1440 px sin deformarse · los colores salen de los tokens, ninguno escrito a mano.

- [x] **F06-T02 · Gráfico diario del mes**
  **Tipo:** Frontend · **Ref:** Técnico §14.1 · General §13 · *fusiona F06-T02, F06-T03 y F06-T04*
  **Hacer:** barras de ingresos y egresos por día, línea de ahorro acumulado en un segundo eje, modo acumulado conmutable y pie con las cifras del mes.
  **Aceptación:** · los dos ejes están rotulados y no se confunden · el día de hoy se distingue · el modo acumulado y el diario muestran el mismo total al final del mes.

- [x] **F06-T05 · Últimos seis meses y gastos por categoría**
  **Tipo:** Frontend · **Ref:** General §14, §15 · *fusiona F06-T05 y F06-T06*
  **Hacer:** barras comparadas de los últimos seis meses con el ahorro de cada uno, y el gráfico de gastos por categoría del mes.
  **Aceptación:** · con menos de seis meses cargados muestra los que hay, sin huecos falsos · las categorías se ordenan de mayor a menor.

- [x] **F06-T07 · Evolución del ahorro y composición patrimonial**
  **Tipo:** Frontend · **Ref:** General §54
  **Hacer:** los dos gráficos restantes. El patrimonial queda con datos de ejemplo hasta la Fase 9, que es la que trae el dato real.
  **Aceptación:** · la evolución del ahorro usa el acumulado real · el patrimonial queda listo para enchufar y marcado como tal.

- [x] **F06-T09 · Tema, móvil, interacción y mes histórico**
  **Tipo:** Frontend · **Ref:** Técnico §14.3, §13.7 · *fusiona F06-T09, F06-T10, F06-T11 y F06-T12*
  **Hacer:** los cinco gráficos respondiendo al cambio de tema sin recargar; toque y arrastre en móvil para ver el valor de un día; y el mes histórico mostrando un mensaje en lugar del gráfico diario, porque no tiene movimientos individuales.
  **Aceptación:** · cambiar de tema redibuja sin recargar · en el celular se puede leer el valor de un día con el dedo · **el mes histórico no inventa una serie diaria**: explica que es un mes consolidado.

---

# FASE 7 — Desglose y detalle de categoría

**Objetivo:** del total de una categoría poder llegar a los movimientos que lo forman.

- [x] **F07-T01 · Lógica del desglose y detalle en la API**
  **Tipo:** Cálculo → Backend · **Ref:** General §15, §16 · *fusiona F07-T01 y F07-T02*
  **Hacer:** cálculo del desglose con porcentaje sobre el total y variación contra el mes anterior; endpoint de detalle de categoría que devuelve sus movimientos, o el total consolidado si el mes es histórico.
  **Aceptación:** · los porcentajes suman 100 · una categoría sin movimientos no aparece o aparece en cero, decidido y consistente · el detalle de un mes histórico devuelve el total sin inventar movimientos.

- [x] **F07-T03 · Panel de desglose con ordenamiento**
  **Tipo:** Frontend · **Ref:** General §15 · *fusiona F07-T03 y F07-T04*
  **Hacer:** panel en el dashboard ordenable por importe, nombre y variación, con la barra proporcional de cada categoría.
  **Aceptación:** · el orden elegido se mantiene al cambiar de mes · en el celular se lee sin desbordar.

- [x] **F07-T05 · Hoja de detalle de categoría**
  **Tipo:** Frontend · **Ref:** General §16 · *fusiona F07-T05, F07-T06, F07-T07 y F07-T08*
  **Hacer:** hoja inferior con los movimientos de la categoría, accesible también tocando el gráfico de categorías, con editar y borrar desde ahí; y el caso del mes consolidado con su mensaje.
  **Aceptación:** · se llega desde el panel y desde el gráfico · editar desde el detalle actualiza el desglose y los indicadores · el mes consolidado explica por qué no hay lista.

---

# FASE 8 — Histórico y carga del Excel

**Objetivo:** cargar los años de Excel como meses consolidados y poder consultarlos.

**Al cerrar esta fase la aplicación ya te sirve todos los días:** tenés tu histórico adentro, el mes en curso al día y los gráficos con datos reales.

- [x] **F08-T01 · Lógica de mes histórico y saldo acumulado en cadena**
  **Tipo:** Cálculo · **Ref:** General §18, §19, §50 R4 · *fusiona F08-T01 y F08-T02*
  **Hacer:** validación de un mes histórico (totales no negativos, no pisar un mes con movimientos) y el saldo acumulado encadenado desde el saldo inicial, mes por mes.
  **Aceptación:** · **cargar un mes histórico recalcula el acumulado de todos los meses posteriores**, no sólo el propio · un mes `open` con movimientos no se puede convertir en consolidado sin aviso explícito · el acumulado parte del saldo inicial del perfil.

- [x] **F08-T03 · Endpoints de meses históricos**
  **Tipo:** Backend · **Ref:** Técnico §9.1 · *fusiona F08-T03, F08-T04 y F08-T05*
  **Hacer:** `POST /api/months/historical` para crear un mes consolidado con sus totales por categoría (`is_manual_summary = true`), `PATCH /api/months/{id}` para corregirlo, y `GET /api/months` devolviendo el saldo acumulado de cada uno.
  **Aceptación:** · un mes consolidado queda con sus totales y sin movimientos · corregir un total propaga el acumulado hacia adelante · los totales por categoría de un mes histórico quedan marcados como manuales.

- [x] **F08-T06 · Script de carga asistida del histórico**
  **Tipo:** Infra
  **Hacer:** script que toma los totales mes por mes desde un CSV o desde la consola y los carga por la API, mostrando qué va a escribir antes de hacerlo y pudiendo repetirse sin duplicar.
  **Aceptación:** · muestra un resumen y pide confirmación antes de escribir · correrlo dos veces con los mismos datos no duplica nada.

- [x] **F08-T07 · Vista de historial**
  **Tipo:** Frontend · **Ref:** General §17, §18 · *fusiona F08-T07, F08-T08, F08-T09 y F08-T10*
  **Hacer:** lista de meses con ingresos, gastos, ahorro y acumulado; formulario de carga de un mes histórico con sus totales por categoría; advertencia visible si los totales por categoría no suman el total del mes; y el gráfico de evolución del ahorro.
  **Aceptación:** · se carga un mes histórico completo desde el celular · si las categorías no suman el total, avisa y deja decidir · los meses consolidados se distinguen de los abiertos de un vistazo.

- [ ] **F08-T11 · Carga real del histórico del Excel**
  **Tipo:** QA
  **Hacer:** cargar todos los meses del Excel y verificar contra el Excel el ahorro acumulado final.
  **Aceptación:** · el acumulado final coincide con el del Excel · ningún mes quedó sin cargar.

---

# FASE 9 — Ahorro acumulado y patrimonio

- [x] **F09-T01 · Lógica del saldo inicial, el acumulado y el patrimonio neto**
  **Tipo:** Cálculo · **Ref:** General §5.2, §5.3, §19, §30 · *fusiona F09-T01 y F09-T02*
  **Hacer:** acumulado desde el saldo inicial y patrimonio neto = ahorros + valor actual de inversiones − pasivos.
  **Aceptación:** · **comprar una inversión no cambia el patrimonio neto**, sólo mueve su composición · sin pasivos el patrimonio es ahorros más inversiones · el saldo inicial se refleja en el primer mes.
  *Ya estaba hecha: `services/calc.py` (`ahorro_acumulado`, `serie_de_ahorro_acumulado`, `patrimonio_neto`) se construyó junto con el resto de los indicadores en F05-T01, con los tres criterios de esta tarea ya cubiertos por `tests/unit/test_calc.py`. Detectado y cerrado el 2026-10-17 al retomar la Fase 9, sin código nuevo.*

- [x] **F09-T03 · Tabla `liabilities` y `GET /api/patrimony`**
  **Tipo:** Backend · *fusiona F09-T03 y F09-T04*
  **Hacer:** modelo, migración y RLS de `liabilities`; endpoint con la composición patrimonial y su evolución.
  **Aceptación:** · `downgrade` probado · el endpoint devuelve la composición y el total · sin pasivos cargados no falla.
  *"Su evolución" no se construyó como serie histórica: el técnico (§14.2) deja la evolución patrimonial completa para una fase posterior, así que el endpoint devuelve una foto de ahora (ahorro, inversiones, pasivos, total y composición), sin navegación de mes. `services/dashboard.py` también pasó a restar pasivos reales (antes era un cero fijo). Migración aplicada contra producción, downgrade probado (bajada y vuelta a subir sin error) y los 5 tests de `tests/api/test_patrimony_endpoint.py` corren contra la base real.*

- [x] **F09-T05 · Saldo inicial y vista de patrimonio**
  **Tipo:** Frontend · **Ref:** General §30 · *fusiona F09-T05, F09-T06 y F09-T07*
  **Hacer:** saldo inicial editable en configuración; vista de patrimonio con la composición y el gráfico de la Fase 6 enchufado; y en el dashboard, distinción clara entre ahorros, inversiones y patrimonio, que es donde más se confunde.
  **Aceptación:** · cambiar el saldo inicial recalcula todo el acumulado · el gráfico patrimonial usa el dato real · se entiende sin leer un manual que el patrimonio no es la suma de los otros dos indicadores.
  *Saldo inicial editable desde Ajustes → Datos laborales ("Editar", hoja de un solo campo). `PATCH /api/me` ahora llama a `recalcular_saldos_acumulados` cuando cambia (antes sólo lo hacían los endpoints de histórico). La vista Patrimonio (ecuación + composición) ya usa `GET /api/patrimony`, sin datos de ejemplo. En el dashboard, la ficha "Total de ahorros" dice "Total acumulado mensual" —texto fijo, a pedido de Gustavo tras probarlo (el primer intento, un `ghost-note` explicando las tres cifras, no sumó y se sacó).*

- [ ] **F09-T08 · Verificación contra el Excel**
  **Tipo:** QA
  **Aceptación:** · el patrimonio y el acumulado coinciden con el Excel.

---

# FASE 10 — Inversiones

**Objetivo:** la cartera, con actualización manual del valor. Las cotizaciones automáticas quedan para después del MVP.

- [x] **F10-T01 · Lógica de valuación, rendimiento y transferencia patrimonial**
  **Tipo:** Cálculo · **Ref:** General §22, §23, §24, §50 R7, R9 · *fusiona F10-T01, F10-T02 y F10-T03*
  **Hacer:** valor actual, rendimiento absoluto y porcentual, total invertido, resultado de cartera; y la regla de que comprar o vender mueve valor entre ahorros e inversiones sin ser un gasto ni un ingreso.
  **Aceptación:** · **el rendimiento de una inversión no es un ingreso mensual** · comprar no es un gasto de consumo · vender devuelve el valor a los ahorros · el rendimiento porcentual con total invertido en cero devuelve `null`.
  *`services/calc.py`: `valor_de_inversion` (por precio unitario o manual, Técnico §6.2), `rendimiento_de_inversion`, `rendimiento_porcentual` (`None` con valor inicial en cero, delega en `variacion_porcentual` — el valor inicial de una inversión nunca es negativo) y `total_invertido`. Comprar/vender no cambia el patrimonio neto: mismo invariante que F09-T01, probado de nuevo en términos de esta tarea. Sin servicio ni endpoint todavía —eso es F10-T04/T06—, así que no hay nada que se vea distinto en la aplicación; lo valida `tests/unit/test_calc.py` (12 tests nuevos).*
  **Revisado 2026-10-20, pisa lo de arriba.** No hay modo de valuación: `valor_de_inversion` se sacó entera. El precio de compra y el precio actual son siempre el importe total que Gustavo carga a mano —nunca nominales por un precio unitario—, así que no hace falta ninguna cuenta para armar el valor de una posición nueva. `rendimiento_de_inversion`, `rendimiento_porcentual` y `total_invertido` no cambian: ya operaban sobre los dos totales. Ver General §20.1/§22 y Técnico §6.2, los tres con su nota de revisión.

- [x] **F10-T04 · Tabla `investments` y servicio de cartera**
  **Tipo:** Backend · **Ref:** Técnico §6.2, §7.3 · *fusiona F10-T04 y F10-T05*
  **Hacer:** modelo, migración y RLS; servicio con los indicadores de la cartera y las operaciones de compra y venta en una transacción.
  **Aceptación:** · `downgrade` probado · una venta a medias no deja la cartera descuadrada · eliminar una inversión pide confirmación (R10).
  *Tabla `investments` aplicada contra producción, `downgrade` probado (bajada y vuelta a subir sin error). `services/investments.py`: `comprar_posicion`, `vender_posicion` (borra de verdad, sin bitácora, General §21) e `indicadores_de_cartera`. A propósito, esto NO crea todavía el movimiento `source='system'` que mueve la plata del ahorro (Regla 7, Técnico §7.3: "el endpoint es uno solo y hace las dos puntas") — eso, la categoría de transferencia y "eliminar pide confirmación" (R10, es de la interfaz) quedan para F10-T06, que es quien arma el endpoint. Probado con `tests/api/test_investments_servicio.py` contra la base real, llamando al servicio directo sin pasar por HTTP (el endpoint todavía no existe) — mismo patrón que F04-T05.*
  **Revisado 2026-10-20, pisa lo de arriba.** Se sacan `valuation_mode`, `current_unit_price`, `price_source` y `price_updated_at` de la tabla (migración `7a3f9c2e1d84`). `initial_value` y `current_value` son siempre el importe total de la posición —precio de compra y precio actual—; `nominal_quantity` queda informativo. `comprar_posicion` ya no recibe modo ni precio unitario, recibe `initial_value` directo.
  **Migración aplicada contra producción el 2026-10-21.** El docstring de la migración decía "sin datos reales que migrar", pero para entonces ya había 13 posiciones cargadas de verdad: se confirmó antes de aplicar que las 4 columnas que se borran no tenían nada real adentro en esas 13 filas (`current_unit_price` era `NULL` en las 13, `valuation_mode` el valor por defecto que el código ya no lee desde este mismo rediseño) — no se perdió ningún número.
  **Aprobada por Gustavo, 2026-10-21** (junto con F10-T08: no tiene pantalla propia que revisar aparte, se probó de hecho usando Cartera). **Sigue pendiente aplicar la migración `7a3f9c2e1d84` contra producción** — bloqueada por el modo automático, hay que correrla a mano.

- [x] **F10-T06 · Endpoints de inversiones**
  **Tipo:** Backend · *fusiona F10-T06 y F10-T07*
  **Hacer:** alta, listado, detalle, actualización manual de valor, venta y baja; y la categoría "Inversiones" (`expense` para comprar, `income` para vender), creada sola la primera vez que hace falta.
  **Aceptación:** · comprar una inversión **sí aparece** como gasto, bajo "Inversiones", en el total del mes y en el desglose por categoría (decisión de Gustavo 2026-10-17, pisa la redacción original de esta tarea y del técnico §7.3: sin esto "no se entiende por qué tenés plata de menos") · vender devuelve el importe como ingreso, misma categoría, tipo `income` · alta y baja de una posición son **opcionales** respecto del ahorro —un flag para cargar una cartera preexistente sin inventar un movimiento que nunca pasó— · actualizar el valor a mano cambia el patrimonio y no el ahorro del mes (eso nunca pasa por `transactions`, es sólo `current_value`).
  *`GET`/`POST`/`PUT`/`DELETE /api/investments`. Sin endpoint de "detalle" por id aparte: `PUT` ya devuelve la posición completa, no hacía falta otro. `GET /api/dashboard` y `GET /api/patrimony` ya leen la cartera real (antes era un cero fijo). Sin nada que probar en el celular todavía —no hay pantalla (F10-T08)—, validado con `tests/api/test_investments_endpoints.py` (14 casos) contra la base real.*
  **Revisado 2026-10-17, el mismo día, segunda vuelta — pisa lo de arriba.** Probando la cartera, Gustavo explicó que lo que deposita en su cuenta de inversión no coincide con lo que termina comprando (queda plata sin invertir, por cobrar). La categoría "Inversiones" **se mantiene**, pero deja de ser automática: el depósito se carga a mano en Movimientos, como cualquier otro movimiento, y comprar/vender en Cartera **no tocan `transactions` bajo ningún caso** — se sacó el flag `affect_savings` entero (ya no hace falta: nunca hay nada que optar). Ver Técnico §7.3 y General §23/§24 (los dos con su nota de revisión) y F10-T08 más abajo.
  **Revisado 2026-10-20, tercera vuelta — pisa el esquema de `AltaDeInversion`/`EdicionDeInversion`.** No hay modo de valuación en el endpoint tampoco: `POST /api/investments` pide `initial_value` (precio de compra, importe total) y `nominal_quantity` (informativo, opcional); `PUT /api/investments/{id}` sólo tiene `current_value` (precio actual) para actualizar el valor, se sacó `current_unit_price`. Ver F10-T01 y F10-T04 más arriba.

- [x] **F10-T08 · Vista de cartera**
  **Tipo:** Frontend · **Ref:** General §20, §21 · *fusiona F10-T08, F10-T09, F10-T10 y F10-T11*
  **Hacer:** indicadores de la cartera, tabla de posiciones con su rendimiento, alta de posición, y hoja de detalle con actualización manual del valor y venta.
  **Aceptación:** · se carga una posición y se actualiza su valor desde el celular · el rendimiento se ve en color según el signo · vender pide confirmación, sin acreditar nada al ahorro — eso se carga aparte, a mano, en Movimientos.
  *Implementado: `cartera.js` pide `GET /api/investments` al entrar a la vista (indicadores y tabla en una sola llamada). Comprar, actualizar el valor y vender nunca tocan `transactions` ni el caché de meses (revisión de F10-T06 del 2026-10-17: la cartera es información, no bitácora de gastos).*
  **Revisado 2026-10-20, pisa lo de arriba.** Sin selector "Cómo se valúa": la hoja de alta siempre pide Nominales (informativo) y Precio de compra (importe total); la hoja de detalle siempre actualiza Precio actual, nunca un precio unitario. La tabla pierde la columna "Fuente" y renombra "Valor inicial"/"Valor actual" a "Precio de compra"/"Precio actual".
  **Ajuste de estética, mismo día.** "Invertido" y "Rendimiento" pasan a tarjetas de color sólido (misma estética que el tablero de Inicio: Invertido en el azul de patrimonio, Rendimiento en verde/rojo según el signo). En la tabla, el detalle y el subtítulo de la tarjeta héroe: el monto queda neutro, sólo el porcentaje lleva el color del signo. Se sacó el `ghost-note` "Cartera, no bitácora".
  **Aprobada por Gustavo, 2026-10-21.**

- [ ] **F10-T12 · Carga real de la cartera**
  **Tipo:** QA
  **Aceptación:** · tus posiciones reales están cargadas y el total coincide con lo que tenés.
  *No es un bloqueante (decisión de Gustavo, 2026-10-21, mismo criterio que F08-T11 y F09-T08): se sigue con la Fase 11 mientras la carga a su ritmo.*

---

# FASE 11 — Cierre del MVP

**Objetivo:** lo que falta para que la aplicación esté terminada y tus datos no dependan de una sola copia.

**Al cerrar esta fase el MVP está completo.**

- [x] **F11-T01 · Configuración**
  **Tipo:** Backend → Frontend · **Ref:** General §42, §48.9 · *reemplaza F14-T01 a F14-T05*
  **Hacer:** tabla `app_settings`, `GET` y `PUT /api/settings`, y la vista de configuración completa: preferencias de la aplicación (tema, formato de importes), sección de cuenta y saldo inicial.
  **Aceptación:** · las preferencias persisten entre sesiones y dispositivos · el saldo inicial se edita desde acá · la vista reúne lo que hoy está disperso.
  *"Formato de importes" se sacó del alcance (decisión de Gustavo, 2026-10-21): no había nada concreto que elegir ahí todavía. El saldo inicial y la sección de cuenta ya estaban resueltos desde F09-T05/F02-T11; lo que faltaba de verdad era que el tema viajara entre dispositivos, no sólo en este navegador.*
  *Tabla `app_settings` clave/valor (`user_id`, `key`, `value jsonb`, único por `(user_id, key)`), migración `c4d8a1e6f352`. `services/settings.py` sólo conoce una clave hoy (`theme`); `GET`/`PUT /api/settings` tipan `theme` como `"light"|"dark"|null`, no el valor libre de la tabla. `PUT` con `theme: null` borra la preferencia (vuelve a seguir el dispositivo). Probado con `tests/api/test_settings_endpoints.py`: las 7 pruebas corrieron contra Supabase real el 2026-10-21 (migración ya aplicada) y pasan.*
  *Frontend: `tema.js` (bloqueante, en el `<head>`) ganó `fijar()` y `preferenciaGuardada()`, reutilizados por `alternar()` — sigue aplicando el tema al instante desde `localStorage`, antes de que haya sesión. `preferencias.js` (nuevo) sincroniza contra la cuenta: si la cuenta ya tiene un tema guardado, manda sobre este dispositivo; si no tiene nada pero el dispositivo sí, sube ese valor en vez de perderlo. Se llama al entrar a Ajustes y al iniciar sesión. El botón rápido de tema de la barra superior (`boton-tema.js`) también persiste ahora, no sólo cambia local. La tarjeta "Preferencias" de Ajustes (`config-preferencias.js`) reemplaza los interruptores de muestra (alertas, cotizaciones, resumen — de funciones que no existen) por un `view-switch` de Claro/Oscuro/Sistema, el único real. Probado en `tests/js/preferencias.test.mjs` y `tests/js/config-preferencias.test.mjs`.*
  **Ajuste de layout, mismo día (Gustavo: "quedó cortado").** El `view-switch` de tres pastillas no entraba al lado de la descripción dentro de `.cfg-row` (fila, pensada para una descripción corta y un interruptor chico al costado). Pasa a columna: descripción arriba, switch abajo, con todo el ancho de la tarjeta.
  **Migración `c4d8a1e6f352` aplicada contra producción el 2026-10-21** (Gustavo, desde su PowerShell). `/api/health` respondió bien después y `tests/api/test_settings_endpoints.py` pasa contra la base real.
  **Aprobada por Gustavo, 2026-10-23.**

- [x] **F11-T02 · Exportación y respaldo**
  **Tipo:** Backend → Frontend · **Ref:** General §58 · Técnico §18 · *reemplaza F14-T06 a F14-T10*
  **Hacer:** `GET /api/export` con todos los datos del usuario en JSON y CSV; botón de descarga en configuración; y **una restauración probada de verdad**, porque un respaldo que nunca se restauró no es un respaldo.
  **Aceptación:** · la exportación trae todo: meses, movimientos, categorías, inversiones y perfil · **se restaura el respaldo en una cuenta limpia y los datos quedan iguales** · la descarga funciona desde el celular.
  *Alcance completo (decisión de Gustavo, 2026-10-21): Técnico §18 decía "sin importación en el MVP", pero el criterio de aceptación de acá siempre pidió una restauración probada — se resolvió la contradicción a favor del roadmap. `GET /api/export` arma el respaldo entero (perfil, categorías, meses, movimientos, inversiones, pasivos, preferencias) en JSON o, con `?format=csv`, un ZIP con un CSV por tabla —el ZIP es de sólo lectura, la reimportación es siempre con el JSON—. `POST /api/import` restaura, pero sólo **en una cuenta limpia** (sin meses, inversiones, pasivos ni preferencias todavía): fusionar un respaldo con datos ya cargados es un problema bastante más difícil y no lo pedía la tarea. Dos pasos sobre el mismo endpoint: `confirm:false` sólo devuelve los conteos para mostrar antes de escribir nada; `confirm:true` recién ahí escribe. Las categorías del respaldo se reconcilian por `(type, name)` contra las 21 que ya trae la cuenta nueva, no se bloquean.*
  *Frontend: la tarjeta "Copia de seguridad" de Ajustes pasa de decorativa a real — "Exportar datos" y "Exportar CSV" descargan con el nombre que manda el servidor; "Importar" abre el selector de archivo, pide la vista previa y la muestra en una hoja antes de confirmar. Una importación exitosa recarga la aplicación entera (cambia casi todo) en vez de invalidar el caché de cada vista por separado. `api.js` ganó `descargar()`, la única llamada que no es JSON.*
  **Migraciones aplicadas el 2026-10-21 y las 7 pruebas de `tests/api/test_respaldo_endpoints.py` corren contra Supabase real, incluida la de punta a punta** (se carga una cuenta con un poco de todo, se exporta, se importa en una cuenta nueva y se compara). Una de las pruebas encontró un bug real de verdad —no del respaldo, de la prueba—: verificaba "la vista previa no escribió nada" pidiendo `GET /api/months` y esperando `[]`, pero ese endpoint abre solo el mes actual si no existe (F03-T10, a propósito); se corrigió la prueba para que verifique que lo único que hay es ese mes en cero, no algo importado.
  **Aprobada por Gustavo, 2026-10-23.**

- [x] **F11-T03 · Correo, recuperación de contraseña y contraseña nueva**
  **Tipo:** Infra → Frontend · **Ref:** Técnico §8.5, §8.6 · General §48.1.2, §48.1.3 · *reemplaza F16-T12, F16-T13 y F16-T14*
  **Hacer:** SMTP propio en Supabase con las plantillas en español; activar la confirmación por correo; pantalla de *Olvidé mi contraseña* con enlace de un solo uso que vence, **sin revelar si el email tiene cuenta**; pantalla de contraseña nueva; habilitar el enlace apagado del login.
  **Aceptación:** · llega el mail y el enlace deja poner una contraseña nueva · el enlace usado o vencido no sirve otra vez · un email sin cuenta recibe la misma respuesta que uno con cuenta · una cuenta nueva recibe su mail de confirmación.

  > **ALCANCE REDUCIDO POR DECISIÓN DE GUSTAVO, 2026-10-27 · el correo saliente queda afuera.**
  >
  > Mandar un mail necesita un SMTP propio, y eso necesita un dominio propio (unos 10–15 dólares al año) o un proveedor con remitente verificado. Se decidió no contratar nada. El servicio de fábrica de Supabase no sirve de reemplazo: son **2 mails por hora para todo el proyecto** y sólo a direcciones del equipo, así que al correo de otro usuario no sale nunca.
  >
  > **Qué hace hoy la pantalla:** `#/recuperar` muestra un mensaje —«por ahora no podemos mandarte un enlace por correo, contactate con quien te dio la cuenta»— y un botón de vuelta al login. No se nombra a nadie: la aplicación es multiusuario y ninguna plantilla escribe un nombre de persona (skill, regla 9). En la práctica ese «quien te dio la cuenta» es Gustavo, y la contraseña se cambia a mano desde el panel de Supabase.
  >
  > **La confirmación por correo queda desactivada**, que es como venía: el registro sigue entrando de inmediato.
  >
  > **Los tres criterios de aceptación que dependen del mail quedan diferidos**, no cumplidos. El que no depende —«un email sin cuenta recibe la misma respuesta que uno con cuenta»— está implementado y probado, listo para cuando se encienda.
  >
  > **Cómo se enciende el día que haya SMTP:** `RECUPERACION_POR_CORREO` en `web/src/js/recuperar.js` pasa a `true` —es una línea— y se hacen los cuatro pasos del panel que están al final de esta entrada. El formulario, `auth.js`, el enlace del correo, la pantalla de contraseña nueva y la guardia de `router.js` ya están escritos y probados; no se borró nada. Las pruebas de `recuperar.test.mjs` fuerzan esa constante a `true` justamente para que la regla de no revelar si un correo tiene cuenta siga cubierta mientras el camino está apagado.

  **Dos rutas públicas nuevas**, `#/recuperar` y `#/nueva-clave` (los nombres son los de la skill §8), con sus tarjetas en `index.html` y sus módulos `recuperar.js` y `nueva-clave.js`. El login ganó el enlace «Olvidé mi contraseña», que estaba sin poner a propósito desde F02-T09.

  **La excepción en la guardia de rutas, que es la decisión de seguridad de la tarea.** `#/nueva-clave` es la única pantalla que cambia la contraseña **sin pedir la anterior** —en Ajustes sí se pide (`config-cuenta.js`), y eso no se toca—, y el enlace del correo **crea una sesión** al canjearse. Sin una salvedad, la pantalla se expulsaría a sí misma en el momento exacto en que empieza a hacer falta («pública con sesión cae en inicio»). Pero abrirla a cualquier sesión sería peor: un teléfono desbloqueado un minuto alcanzaría para cambiar la contraseña sin saber la vieja. Se resolvió con una marca de «recuperación en curso» en `sessionStorage` (`auth.js`), que pone `enlace-correo.js` sólo al encontrar el token en la URL y se suelta en cuanto la contraseña quedó cambiada, o si el enlace se rechaza, o al pedir otro. `router.js` deja ver la ruta con sesión **sólo** con esa marca. Cuatro pruebas en `router.test.mjs` cubren los cuatro cruces de sesión × marca.

  **Las plantillas usan `{{ .TokenHash }}`, no el `{{ .ConfirmationURL }}` de fábrica**, y el motivo es práctico: el cliente está en modo PKCE, y PKCE guarda su verificador en el navegador que **pidió** el enlace. Pedir la recuperación en el celular y abrir el mail en la PC es lo más normal del mundo, y por ese camino fallaría con un error que no dice nada. Un `token_hash` no necesita verificador: vale desde cualquier navegador, una sola vez, y vence. El camino de fábrica igual se acepta (`enlace-correo.js` reconoce el `?code=`), porque una plantilla que quede sin personalizar no puede dejar el enlace muerto en silencio.

  **El token se saca de la URL en cuanto se lee** (`replaceState`): es una credencial de un solo uso y no tiene por qué quedar en el historial del navegador ni viajar en el `Referer`. Y se entrega una sola vez (`tomarEnlacePendiente`), así que un enlace rechazado no se reintenta.

  **Lo que no revela si un correo tiene cuenta.** `recuperar.js` repite el piso de respuesta de 350 ms del login y del registro: mandar un mail de verdad y no mandar nada no tardan lo mismo, y esa diferencia cuenta lo mismo que contaría un texto distinto. El mensaje dice «si hay una cuenta con ese correo…» y no «te mandamos un correo», que sería confirmar que existe. El 429 sí se informa: no dice nada del correo, dice algo de cuántas veces se tocó el botón.

  **Reenvío del correo de confirmación** en la tarjeta de registro (General §48.1.1, «ofrece reenviarlo»): el mail de confirmación es el que más cae en spam y sin reenvío la única salida sería crear otra cuenta. El botón queda apagado un minuto después de cada reenvío, porque el límite de Supabase es por minuto y dos toques seguidos darían un 429 que se lee como si la aplicación estuviera fallando.

  **El medidor de fortaleza y la comparación de «repetir» se mudaron a `clave-ui.js`**, compartidos entre registro y contraseña nueva. Eran los mismos dos y copiarlos habría dado dos lugares donde decir cosas distintas el día que uno se ajuste.

  **Consecuencia en las pruebas de API, resuelta de antemano.** Con la confirmación por correo activada, `POST /auth/v1/signup` **deja de devolver sesión** y `grant_type=password` responde `email_not_confirmed`: de ahí salía el token de doce módulos de `tests/api/`. Nadie va a abrir el mail de `epicwallet.qa.…@example.com`, así que `tests/api/ayudas_auth.py::confirmar_correo` marca el correo de la cuenta de prueba como confirmado con la clave de servicio, igual que lo haría un panel de administración. Toca sólo el uid que la prueba acaba de crear, no borra nada, y es tolerante: sin clave de servicio o con la confirmación apagada no hace nada y todo sigue como antes. Verificado en los dos estados.

  **Bug previo encontrado en el camino, corregido acá porque rompía justo esta tarea.** Varias vistas piden sus datos al cargar sin mirar qué ruta está activa. Sin sesión esas peticiones vuelven 401, y el segundo 401 seguido llamaba a `cerrarSesion()`, que navega al login: abrir `#/registro` directo —o caer en `#/nueva-clave` desde el enlace del correo— llevaba a la persona al login antes de que llegara a escribir nada. `api.js` ahora corta antes de salir a la red cuando no hay token. Con sesión vencida (token presente y rechazado) el reintento y el cierre siguen igual. Sólo se vio con un recorrido real por Playwright contra producción; en jsdom no aparece porque ahí nadie pide datos de verdad.

  **Verificado contra producción, 2026-10-26** (celular 390px, los dos temas, y escritorio a 1280 y 1920): el enlace del login lleva a `#/recuperar` · un correo inexistente recibe exactamente el mismo mensaje que uno válido, sin error a la vista · un enlace inventado deja la pantalla en «este enlace no sirve», con el token ya borrado de la URL · las cuatro pantallas públicas se quedan donde corresponde y no disparan ninguna llamada a la API · ninguna de las dos pantallas nuevas tiene scroll horizontal.

  **La receta del panel de Supabase, para cuando se encienda.** No hay que hacer nada de esto hoy. En este orden:

  1. **SMTP propio** · Project Settings → Authentication → SMTP Settings. Técnico §8.5 recomienda Resend (3.000 mails/mes, 100 por día), **pero su plan gratis sólo manda a tu propia dirección hasta que verifiques un dominio**: para los demás usuarios hace falta el dominio. Sin dominio, la alternativa es un proveedor con verificación de remitente individual (Brevo, 300 mails por día) usando una dirección de Gmail. El servicio de fábrica no entra en la comparación: 2 mails por hora para todo el proyecto y sólo a direcciones del equipo.
  2. **URL Configuration** · Site URL `https://epic-wallet-v2.vercel.app`; Redirect URLs: `https://epic-wallet-v2.vercel.app/**`, `https://*.vercel.app/**` (para las previews) y `http://localhost:3000/**`. Sin esto el enlace falla con *«requested path is invalid»*, que es el error más común de esta parte.
  3. **Email Templates**, en español y con estos enlaces exactos (es de donde sale el `token_hash`):
     - *Reset Password* → `{{ .SiteURL }}/?token_hash={{ .TokenHash }}&type=recovery#/nueva-clave`
     - *Confirm signup* → `{{ .SiteURL }}/?token_hash={{ .TokenHash }}&type=signup#/login`
  4. **Recién al final, activar «Confirm email»** · Authentication → Providers → Email. Es el paso que cambia el registro: una cuenta nueva pasa a ver «revisá tu correo» en vez de entrar directo. Si se activa antes del punto 1, una cuenta nueva queda sin poder entrar hasta que el mail funcione.

  **Qué probar desde el celular el día que se enciendan esos cuatro pasos:** pedir el enlace desde «Olvidé mi contraseña» con tu correo y con uno inventado (tiene que decir lo mismo las dos veces) · abrir el enlace y poner una contraseña nueva · volver a abrir el **mismo** enlace y confirmar que ya no sirve · crear una cuenta de prueba y ver que llega su mail de confirmación y que el reenvío funciona.

  **Qué se probó hoy, 2026-10-27:** el enlace del login lleva a `#/recuperar` y ahí se lee el mensaje, con su botón de vuelta al login y sin formulario a la vista.

- [~] **F11-T04 · Repaso de seguridad**
  **Tipo:** QA · **Ref:** Técnico §17 · *reemplaza F16-T01 a F16-T09*
  **Hacer:** tres cosas y nada más. (1) Reverificar el aislamiento entre cuentas con todos los endpoints que ya existen, que son muchos más que en F02-T14. (2) Cargar un movimiento con etiquetas HTML y JavaScript en la descripción y en el nombre de una categoría, y confirmar que se muestran como texto. (3) Confirmar que el paquete del navegador sólo lleva la URL y la clave anónima de Supabase, y que la clave de servicio y el secreto de JWT no están ahí ni en el repositorio.
  **Aceptación:** · ningún recurso ajeno es accesible en ningún endpoint · el texto con etiquetas se muestra, no se ejecuta · no hay secretos en el frontend ni en el repositorio.
  **Nota de alcance:** no se hace límite de peticiones, ni política de contenido estricta, ni auditoría del historial de Git, ni prueba de carga, ni auditoría formal de accesibilidad. RLS en la base es la defensa que importa acá y ya está activa. Si alguna vez la aplicación se abre a desconocidos, esto se revisa.

  *Hecho 2026-10-27. Los tres puntos verificados, ningún agujero. Falta tu aprobación.*

  **(1) Aislamiento · `tests/api/test_aislamiento_f11.py`, 8 pruebas contra la base real.** Dos cuentas, A con datos y B vacía, y con el token de B se intenta todo lo de A en **los 27 endpoints privados**. Tres formas, porque son tres agujeros distintos: el id ajeno en la dirección (los nueve endpoints que llevan id → **404**, nunca 403, porque un 403 confirmaría que el recurso existe), la colección entera (las diez lecturas sin id, buscando el texto crudo de los datos de A en la respuesta, incluido `GET /api/export`), y el id ajeno **colado en el cuerpo** (un movimiento de B apuntando a una categoría de A → 400). Después de todos los intentos, incluidos los `DELETE`, se vuelve a mirar la cuenta A: intacta — un 404 que igual borra la fila sería peor que no tener aislamiento.

  Dos detalles que valen más que la lista: el 404 del recurso ajeno y el del id inexistente tienen que ser **el mismo 404, cuerpo incluido**, o la diferencia vuelve a contar que el recurso existe; y una prueba compara la lista de endpoints con id contra el OpenAPI y falla si alguien agrega uno, así el barrido no se queda viejo en silencio (es exactamente el agujero que esta tarea vino a cerrar: F02-T14 cubría tres endpoints y la lista nunca creció).

  **(2) Etiquetas en los datos.** Verificado de punta a punta contra producción, no sólo en pruebas: se cargó una categoría llamada `<img src=x onerror="window.__xss=1">Cat` y un movimiento descrito `<script>window.__xss=1</script><b onmouseover=…>Desc`, y se abrió la aplicación en el navegador con esa cuenta. En Inicio y en Movimientos **se leen como texto, tal cual**: no se ejecutó nada, no se inyectó ningún elemento, ningún `<script>` quedó en el documento, cero errores de página. El escapado por componente ya estaba cubierto en `tests/js/` (`rows`, `kpi`, `avisos`, `toast`, con jsdom en modo `runScripts` para que un `onerror` inyectado *pueda* correr); esto es la pasada por la pantalla real que pedía la tarea.

  **(3) Secretos · `tests/unit/test_secretos_fuera_del_frontend.py`, 6 pruebas.** El paquete del navegador lleva sólo la URL y la clave publicable (`sb_publishable_…`, pública por diseño: del otro lado está RLS). Se revisa **todo** `web/`, no sólo el `config.js` generado, por el valor de la clave de servicio y además por su forma (`sb_secret_`, `service_role`) para atrapar una clave que esta máquina no conoce; y se revisa que ni la clave de servicio ni el secreto de JWT estén en **ningún archivo versionado**, comparando valores y no nombres —los nombres sí aparecen en `.env.example`, el README y el Técnico, y tienen que seguir apareciendo—. `.env` no está rastreado.

  Esto existía como `tests/unit/test_config_web.py` y se dio de baja en `9d3f3cc` con los 23 archivos de pruebas de interfaz. La baja estuvo bien para lo que comprobaba del build (que el generador corte, que avise) y se llevó de arrastre lo que no correspondía: una clave de servicio en un `.js` publicado **no se ve mirando la pantalla**, y es el único error de esta lista que no se puede deshacer. Volvió sólo esa parte. *(Nota: `docs/FASE_00_PUESTA_EN_MARCHA.md` §356 seguía nombrando el archivo viejo; corregido.)*

  **Dos cosas encontradas en el camino, ninguna de seguridad, ninguna tocada:**

  - **Al entrar desde cero, las pantallas quedan vacías hasta recargar.** Varias vistas piden sus datos **al importarse**, y eso pasa mientras todavía estás en el login: sin sesión fallan, y nada las vuelve a disparar cuando entrás. El tablero recién se llena si recargás. No es consecuencia del arreglo de `api.js` de F11-T03 — se comparó con y sin ese cambio y el resultado es el mismo—, viene de antes y se nota sólo cuando se entra con la sesión perdida, que con la sesión guardada en el teléfono casi no pasa. El arreglo propio es que cada módulo pida sus datos al activarse su ruta (`epic:ruta`), no al importarse. **Queda para que decidas si entra como tarea.**
  - **Quedaron 58 cuentas de prueba viejas** en Supabase (`…@example.com` y cinco `epicwallet.gemelo.…@example.net`), de corridas cuyo cierre se cortó, cada una con sus 21 categorías sembradas. Las 3 de esta tarea las borré. Las otras **no las toqué**: no son de esta tarea y borrar filas de la base real no se hace de pasada. Si querés, las barro en una pasada aparte — las dos cuentas reales (`goliva@live.com.ar` y `nellybici07@gmail.com`) no se tocan.

  **Qué probar vos:** nada que se vea en pantalla; esta tarea es de pruebas. Si querés comprobarlo a mano, entrá con tu cuenta y cargá un movimiento con la descripción `<b>hola</b>`: tiene que mostrarse con las etiquetas a la vista, como texto.

- [~] **F11-T05 · Verificación del MVP y `docs/COMO_FUNCIONA.md`**
  **Tipo:** QA → Doc · *reemplaza F16-T10, F16-T11, F16-T15, F16-T16 y las 18 tareas de documentación de fase*
  **Hacer:** recorrer los 24 criterios de la sección 65 del documento general uno por uno desde el celular y desde la PC, anotando el resultado; y escribir **un solo** `docs/COMO_FUNCIONA.md`: cómo está armada la aplicación, cómo levantarla, el modelo de datos, las decisiones que hay que conocer para tocar el código, y lo que quedó deliberadamente afuera. Sin capturas que haya que mantener, sin cuadros que repitan el código.
  **Aceptación:** · los 24 criterios quedan verificados o con su excepción anotada y aceptada por vos · alguien que nunca vio el proyecto lo levanta siguiendo el documento · el documento entra en una lectura.

  *Hecho 2026-10-27. **22 de los 24 criterios verificados**; los 2 que faltan son excepciones ya decididas en la revisión v2.0, con su evidencia abajo. Falta tu aprobación.*

  **Cómo se verificó.** Se creó **una** cuenta de prueba con datos realistas —saldo inicial 1.000.000, un sueldo de 2.000.000, tres egresos, dos meses históricos de 2025, dos posiciones de inversión— y se recorrió la aplicación en producción con un navegador real a 390 px y a 1280 px, cargando movimientos **desde la interfaz** (no por la API) donde el criterio lo pedía. La cuenta se borró al terminar; la base quedó con las dos cuentas reales y nada más. Cero errores de página en todo el recorrido.

  | # | Criterio | Resultado |
  |---|---|---|
  | 1 | Iniciar sesión | OK · entra y cae en `#/inicio` |
  | 2 | Abre el mes actual | OK · la barra dice «Octubre 2026 · Mes abierto» sola |
  | 3 | Registrar un gasto rápido | OK · botón `+` → hoja → guardar; los totales cambian |
  | 4 | Registrar un ingreso | OK · mismo camino, con el conmutador en Ingreso |
  | 5 | Total por categoría se actualiza | OK · «Alquiler · 1 movimiento · 65,9% del gasto · $450.000» |
  | 6 | Total de ingresos | OK · 2.000.000 → **2.077.000** tras cargar 77.000 |
  | 7 | Total de gastos | OK · 650.000 → **683.000** tras cargar 33.000 |
  | 8 | Ahorro mensual automático | OK · **1.394.000** = 2.077.000 − 683.000 |
  | 9 | Ahorro acumulado correcto | OK · **3.644.000** = saldo inicial 1.000.000 + 600.000 del histórico + 650.000 + 1.394.000. Tasa de ahorro 67,1% |
  | 10 | Consultar meses anteriores | OK · la barra retrocede a «Julio 2025» y «Hoy» vuelve |
  | 11 | Cargar meses históricos | OK · los dos de 2025 quedan en el historial con sus totales |
  | 12 | Comportamiento diario | OK · el gráfico dibuja barras (son `path`, no `rect`), con eje de días 1–27, eje de importes y la línea de ahorro acumulado en $1,39M |
  | 13 | Últimos seis meses | OK · 11 elementos dibujados en los gráficos del historial |
  | 14 | Movimientos de cada categoría | OK · tocar la fila abre la hoja «Alquiler» con su movimiento, total del mes y última carga |
  | 15 | Gestionar la cartera | OK · las dos posiciones con nominales, invertido, actual y rendimiento |
  | 16 | Rendimiento de cada inversión | OK · por fila (0,0% recién compradas) y en los tres indicadores de cartera |
  | 17 | Calcular el patrimonio | OK · «Ahorro disponible 3.644.000 · Inversiones 800.000 · Pasivos 0 · **Patrimonio neto 4.444.000**» |
  | 18 | Actualización manual de inversiones | OK · la hoja de la posición trae el campo de valor y los botones «Actualizar valor» y «Vender» |
  | 19 | Preparado para proveedor de cotizaciones | **Excepción** · ver abajo |
  | 20 | Alertas básicas | **Excepción** · ver abajo |
  | 21 | Funciona desde Android | OK · 390 px, sin scroll horizontal en ninguna de las seis vistas |
  | 22 | Funciona desde PC | OK · 1280 px: navegación de escritorio visible, barra inferior oculta, 5 KPIs, sin desborde |
  | 23 | Datos protegidos por autenticación | OK · lo cubre F11-T04: una ruta nueva nace protegida, las 8 tablas con RLS y su política, y los 27 endpoints privados barridos con el token de otra cuenta |
  | 24 | Existe backup | OK · «Exportar datos», «Exportar CSV» e «Importar» en Configuración (F11-T02) |

  **Las dos excepciones, con lo que hay de verdad detrás:**

  - **19 · Cotizaciones automáticas.** Movido a «Después del MVP» en la revisión v2.0, y el propio documento general ya lo condicionaba a «si se encuentra una fuente viable». Lo que hay que saber es que la preparación que el Técnico §9.5 y §6.2 describen **no existe**: no hay tabla de cache, no hay `POST /api/investments/refresh-prices`, y las columnas `valuation_mode`, `current_unit_price`, `price_source` y `price_updated_at` se **sacaron** en la migración `7a3f9c2e1d84` al decidir que `initial_value` y `current_value` son siempre el importe total de la posición. Lo que queda preparado es eso: `symbol` y un `current_value` que un proveedor podría escribir. Las variables `PRICE_PROVIDER_ORDER` y `PRICE_REFRESH_COOLDOWN_MINUTES` siguen en `.env.example` sin usarse.
  - **20 · Alertas.** Movido a «Después del MVP» por el mismo criterio: son útiles y nada depende de ellas. El componente **sí existe y está probado** (`components/avisos.js`, cinco severidades, cada una con su icono para que el color no sea el único que diga la gravedad), y la hoja de alertas está en el HTML. Lo que no existe es lo que las genera: `ALERTAS` es una lista vacía. Las cinco reglas analíticas de General §29 esperan a que haya datos suficientes para elegir los umbrales.

  **El documento · `docs/COMO_FUNCIONA.md`.** Escrito para alguien que nunca vio el proyecto: qué es y a qué escala, cómo levantarla con sus variables y comandos, las cuatro capas del backend y las tres reglas del frontend, el modelo de datos con las dos naturalezas de mes y el procedimiento de migración, las decisiones que sorprenden si nadie las cuenta (comprar una inversión no es un gasto, la tasa de ahorro en cero devuelve `null`, el signo lo decide el tipo y no el importe), lo que quedó afuera a propósito, y la política de pruebas con el criterio para decidir si un test se escribe. Sin capturas y sin cuadros que repitan el código. Cada dato se verificó contra el repositorio y contra la base, no se escribió de memoria.

  **Qué probar vos:** abrí la aplicación en el celular y mirá que todo siga en su lugar — el recorrido de arriba ya lo hizo un navegador, pero el ojo es tuyo. Y si vas a tocar el código más adelante, leé `docs/COMO_FUNCIONA.md` y decime qué te quedó sin explicar: es el único criterio de aceptación que yo no puedo verificar.

---

# FASE 12 — Apronte de escritorio

**Objetivo:** la aplicación ya se ve bien en el celular (prioridad del proyecto, General intro) y eso no se toca. Esta fase es sólo el ajuste fino de los mismos puntos de corte de escritorio que ya estaban planificados (skill §5: `lg` ≥960px, `xl` ≥1024px) pero nunca se probaron a fondo en un navegador ancho.

**Por qué existe esta fase:** Gustavo mandó capturas de escritorio (Inicio, Cartera, Ajustes) y pidió revisar si el diseño de escritorio se había tenido en cuenta. Se agrega acá, a pedido suyo, para implementar después de la Fase 11 — no se adelanta.

- [x] **F12-T01 · Dos huecos de layout en escritorio (Inicio y Ajustes)**
  **Tipo:** Frontend · **Ref:** `.claude/skills/epic-wallet-ui/SKILL.md` §5, §11.1
  **Hacer:** corregir los huecos de layout encontrados en una auditoría visual real (Playwright, cuenta de prueba con datos representativos, 1280 y 1920px, los dos temas) contra los seis puntos de corte.
  **Aceptación:** · a 1024px+ ninguna tarjeta de KPI queda sola en una fila con media pantalla vacía al lado · a 960px+ ninguna tarjeta de Ajustes deja un hueco vacío del alto de otra columna · nada de esto cambia una línea de lo que ya se ve en el celular.
  *Encontrado y corregido, 2026-10-21 — ya en `main` y en producción, falta tu aprobación:*
  1. **Inicio, `.kpi-grid` a 1024px+:** la héroe y las tres primeras tarjetas de color (Ingresos, Egresos, Gasto de hoy) llenan la fila justo (3+1+1+1 de 6 columnas), y "Total de ahorros" —la cuarta— quedaba sola en la fila siguiente, angosta, con media fila vacía al lado. Ahora esa cuarta tarjeta ocupa todo el ancho de su fila (`components.css`, regla acotada a exactamente 5 tarjetas, no afecta a Cartera ni a ninguna vista con otra cantidad).
  2. **Inicio, "Gastos por categoría" a 960px+:** estaba sola dentro de un `.grid-2` (grid de dos columnas) sin nada en la segunda columna, dejando vacía la mitad de la pantalla debajo del gráfico. Pasa a tarjeta de ancho completo, como ya son "Comportamiento diario" arriba y los paneles de Historial.
  3. **Ajustes a 960px+:** "Categorías" (hasta 21 filas) y "Copia de seguridad" (3 botones) compartían fila en un `.grid-2` de cinco tarjetas; como una fila de grid toma la altura de su celda más alta, quedaba un hueco vacío del largo de toda la lista al lado de "Copia de seguridad", y después "Sesión" —la quinta tarjeta— caía sola debajo de "Categorías" con el mismo vacío al lado. "Categorías" pasa a ancho completo, fuera del grid; "Copia de seguridad" se empareja con "Sesión", las dos cortas.
  *Verificado con medición real de `getBoundingClientRect()` en Playwright antes de tocar nada —no a simple vista—: `.app{max-width:1240px}` ya funciona bien en las seis vistas a cualquier ancho, así que **no hay un problema general de "todo estirado" por falta de un contenedor máximo**; lo que se veía raro en las capturas eran estos dos huecos puntuales. `npm test` (570/570) sigue en verde, no se tocó ningún archivo de `@media` por debajo de 960px.*
  **Aprobada por Gustavo, 2026-10-23.**

- [~] **F12-T02 · El cambio de tema en escritorio**
  **Tipo:** Frontend (investigación primero) · **Ref:** `tema.js`, skill §6 "Cambio de tema"
  **Hacer:** Gustavo había dicho que el cambio de tema claro/oscuro "no funciona bien" en escritorio, sin más detalle. Los dos temas fijos (sin animar) se revisaron en la auditoría de F12-T01 y los tokens de color se ven bien en los dos — el problema, si existe, está en la **transición** (`document.startViewTransition`, skill §6) o en algún parpadeo puntual al tocar el botón, y eso no se puede confirmar con una captura estática. Reproducir en vivo (grabación de pantalla o cuadro por cuadro con Playwright) tocando el botón de tema en cada vista a 1024px+, anotar qué se ve mal exactamente, y recién ahí corregir.
  **Aceptación:** · se reproduce el problema concreto (no una sospecha) · se corrige sin tocar el celular · Gustavo confirma desde su navegador que ya se ve bien.
  *Investigado 2026-10-21: video y cuadro por cuadro del círculo al tocar el botón, en Inicio a 1280px. Arranca en 0 desde el botón, crece parejo y termina de cubrir la pantalla justo en la esquina más lejana —como está pensado—, sin nada roto a la vista. No se encontró el problema concreto. De paso, con la consola abierta durante esta prueba, apareció un error de JavaScript real que no tiene nada que ver con el tema (ver la nota suelta más abajo, ya corregido). Sigue abierta: falta que Gustavo cuente más detalle de qué vio mal (¿lento? ¿un salto? ¿colores que no correspondían? ¿en qué pantalla?) para poder reproducirlo de verdad.*

  ***Encontrado y corregido 2026-10-27.** El problema concreto apareció, y no era el que se buscaba el 21: el cambio de tema **no estaba haciendo su círculo en ningún dispositivo**. Hacía el fundido cruzado de fábrica del navegador, de 250 ms.*

  **La causa.** Los pseudoelementos de una view transition cuelgan del **elemento raíz**, no de un descendiente suyo. `:root:not([data-transicion-vista])::view-transition-new(root)` los alcanza; con un **espacio** antes del `::` es un selector de descendiente y no matchea nada. El navegador no avisa: descarta la regla en silencio, corre sus animaciones de fábrica, y la pantalla queda *casi* bien — por eso no se vio mirándola.

  **Desde cuándo.** El espacio entró el 2026-10-23 con `162b932` (F12-T04, el deslizo entre vistas), que le agregó el prefijo `:not([data-transicion-vista])` a reglas que hasta entonces eran `::view-transition-old(root)` a secas y funcionaban. Eso explica por qué la investigación del 21 vio el círculo andar: todavía andaba. Estuvo roto cuatro días. **Lo que Gustavo reportó originalmente es anterior al 21 y sigue sin explicación**, así que si al probarlo ahora todavía ves algo raro, es otra cosa y hay que mirarla aparte.

  **Cómo se midió, y es la única forma que funcionó las dos veces.** Leyendo `document.getAnimations()` con la transición ya lista y mirando los nombres: antes del arreglo, cinco animaciones y las cinco con prefijo `-ua-` (`-ua-view-transition-fade-in`, `-ua-mix-blend-mode-plus-lighter`…), ninguna del proyecto. Con el espacio sacado, una sola: `circulo-de-tema`, 900 ms. Confirmado además con un A/B interceptando el CSS servido en producción, y con 12 grabaciones cuadro por cuadro (screencast por CDP) en las seis vistas: el recorrido de luminancia es monótono entre los dos temas, sin un solo fotograma fuera de rango — **no hay destello blanco ni negro**, y tampoco tirones (cero saltos hacia atrás). Lo que sí mostraban esas grabaciones era la pista: la pantalla cambiaba en 50 ms, no en 900.

  **Verificado contra producción 2026-10-27**, en las seis vistas y a 1280 y 390 px: `circulo-de-tema` de 900 ms en las doce combinaciones, cero animaciones de fábrica, cero errores de página.

  **Se agregó una prueba** (`tests/unit/test_view_transition_sin_espacio.py`). Va contra la política de no testear CSS y pasa igual su criterio —la pantalla queda casi bien, así que mirándola no se nota—, y esta trampa ya había picado dos veces: una en `components.css`, donde quedó el comentario de aviso, y esta. Busca el patrón que no puede existir, ignora los comentarios que lo citan a propósito, y lleva su contrapeso para no quedar verde por vacío.

  **Qué probar vos:** tocá el botón de tema en el escritorio y en el celular. Tiene que salir un círculo desde el botón y cubrir la pantalla en poco menos de un segundo. Si lo que ves es un fundido parejo y rápido, el arreglo no llegó; si ves el círculo pero igual no te gusta cómo queda, decime qué y se ajusta (la duración y la curva están en un solo lugar).

  *Bug encontrado de paso, sin relación con el tema ni con escritorio (corregido 2026-10-21): `views/vistas.js` llamaba a `aviso` sin importarlo, y como las alertas de muestra siempre están vacías, el error nunca se veía en pantalla — pero igual se disparaba en consola en cada carga de página, en cualquier dispositivo, y cortaba a la mitad el arranque de esa vista: `conectarControles()` (los conmutadores de ajustes) y `conectarSinConexion()` (la banda de "sin conexión") nunca llegaban a conectarse. Arreglado con el import que faltaba, con una prueba de regresión (`tests/js/vistas.test.mjs`) que lo cubre.*

- [ ] **F12-T03 · El resto, guiado por lo que vayas encontrando**
  **Tipo:** Frontend
  **Hacer:** la auditoría de F12-T01 miró las seis vistas a 1280 y 1920px, pero una revisión automática no reemplaza mirar la pantalla de verdad (criterio del CLAUDE.md). A medida que uses la aplicación desde la PC y encuentres algo —una tarjeta en un lugar que no corresponde, un gráfico que se ve pobre, algo demasiado grande o chico—, lo vas marcando y se agrega acá como una entrada concreta, se corrige y se tacha. Sin lista inventada de antemano.
  **Aceptación:** cada entrada que se agregue acá se marca `[x]` cuando vos confirmás que ya se ve bien.

- [x] **F12-T04 · Navegación por gestos, sólo en el celular**
  **Tipo:** Frontend · **Ref:** `.claude/skills/epic-wallet-ui/SKILL.md` §5, §7
  **Hacer:** deslizar hacia la izquierda o la derecha en cualquier parte de una vista —menos dentro de una tabla o un gráfico, que ya tienen su propio scroll horizontal (skill §9, §11.1)— pasa a la vista siguiente o anterior en el mismo orden que las barras de navegación (`nav.js`), con tope en la primera y la última. Sólo por debajo de los 960px (corte `lg`, donde manda la barra inferior); a partir de ahí no hace nada.
  **Aceptación:** · deslizar sobre contenido común cambia de vista, con tope en los dos extremos · deslizar dentro de una tabla o un gráfico sigue scrolleando esa tabla o gráfico, no cambia de vista · con una hoja abierta, deslizar no navega por debajo · en escritorio (960px+) no pasa nada · el scroll vertical normal de la página no se ve afectado.
  *Hecho 2026-10-23, pendiente de que lo pruebes en el celular de verdad.* Módulo nuevo, `web/src/js/gestos.js`: con la API de **Pointer Events** (no Touch Events, que están en camino de quedar obsoletos, ni una librería — `pointerType === "touch"` ya alcanza para ignorar mouse y trackpad). Al bajar el dedo se guarda la posición; al moverse, en cuanto el recorrido supera 10px en algún eje se decide si el gesto es horizontal o vertical — sólo ahí, y sólo si es horizontal, se le gana al scroll nativo con `preventDefault()`; antes de eso el navegador scrollea como si este archivo no existiera. Al soltar, una función pura (`resolverGesto`, probada sin DOM) decide si el recorrido fue lo bastante largo y horizontal como para cambiar de vista, y a cuál.
  **No sigue el dedo en vivo, cuadro a cuadro**: las seis vistas son secciones independientes (`hidden`/no `hidden`), no un riel con las seis montadas a la vez — animar eso en tiempo real contra el dedo es rehacer el enrutador por un efecto visual. Lo que hace sí tiene transición (ver abajo): al soltar, decide *si* cambiar de vista y en qué sentido, y el contenido se desliza solo, con la View Transitions API.
  **Primera versión (2026-10-23): no navegaba nunca.** Los 14 tests con `PointerEvent` sintéticos contra jsdom pasaban, pero jsdom no tiene un motor de entrada real detrás y no podía ver el problema de verdad: contra producción, con un toque real por CDP (Chrome DevTools Protocol, no un evento armado a mano), el navegador decidía por su cuenta que el arrastre horizontal era un intento de scroll y se quedaba con el gesto —mandaba `pointercancel` después de un solo `pointermove`—, así que `gestos.js` nunca llegaba a ver el `pointerup`. Confirmado por Gustavo probándolo en su celular.
  **La causa era `touch-action`, en cero.** Por defecto (`auto`), el navegador puede reclamar cualquier dirección del gesto para su propio scroll antes de que JavaScript tenga chance de reaccionar. `.app` pasa a `touch-action: pan-y`: el scroll vertical sigue siendo 100% nativo (no pasa por acá), pero el horizontal queda libre para que lo decida este módulo. `.tbl-wrap` y `.chart-wrap` reafirman `touch-action: pan-x` para no perder su propio scroll lateral — es la misma clase de problema que ya se había revertido una vez en el gráfico diario (F06-T09), pero al revés: ahí sobraba la restricción, acá faltaba, y cada uno se corrige donde corresponde sin tocar al otro.
  **Segunda vuelta (2026-10-23, a pedido de Gustavo): transición deslizante.** El gesto ya navegaba pero de golpe ("es directo"). Ahora sólo `main` —las seis vistas— se desliza en el sentido del dedo, como pasar una página; la barra superior, la de mes y el botón `+` quedan fijos y cambian de inmediato. Reutiliza la View Transitions API que ya estaba en uso para el círculo de tema (`tema.js`): `router.js` gana `animarProximaComo(direccion)`, que `gestos.js` llama antes de `navegar()` — opt-in, tocar las barras de navegación de siempre no la usa. `main` pasa a tener su propio `view-transition-name` (`contenido-vista`) sólo durante esa navegación, con animaciones de `translateX` distintas por sentido; `root` (todo lo que no es `main`) se deja sin animar, para que el resto no se mueva.
  **Encontró dos bugs reales en el camino, los dos confirmados con `document.getAnimations()` en vivo, no a ojo:** (1) el deslizo no se veía porque el selector de las animaciones direccionales llevaba un espacio de más —`:root[...] ::view-transition-old(...)` es un combinador descendiente, y estos pseudo-elementos no son descendientes de `:root` en el árbol normal; sin espacio, pegado, es el selector compuesto correcto, mismo patrón con el que ya funciona el círculo de tema. Mientras no coincidía, el navegador seguía con su propio fundido cruzado por defecto en su lugar, sin avisar nada. (2) Investigando esto con la consola abierta apareció otro bug sin relación: `views/vistas.js` llamaba a `aviso` sin importarlo, tirando un `ReferenceError` en cada carga de página (cualquier dispositivo) que cortaba a la mitad `conectarControles()` y `conectarSinConexion()` — corregido aparte, con `tests/js/vistas.test.mjs` cubriéndolo.
  **Verificado con toque real (CDP) contra producción, 2026-10-23**, no sólo con jsdom: deslizar sobre contenido común cambia de vista (`#/inicio` → `#/movimientos`) · el scroll vertical normal sigue funcionando igual (y no navega) · deslizar dentro de la tabla de Historial sigue scrolleando la tabla (`scrollLeft` cambia) y no navega · `document.getAnimations()` durante el gesto muestra las animaciones propias (`vista-sale-izquierda`, `vista-entra-derecha`) corriendo en `::view-transition-old/new(contenido-vista)`, no el fundido por defecto del navegador · capturas en cámara lenta (`Animation.setPlaybackRate` por CDP) muestran la vista vieja saliendo a la izquierda y la nueva entrando desde la derecha, con la barra superior y la de mes quietas.
  Probado en `tests/js/gestos.test.mjs`: la función pura con sus siete casos (avanza, retrocede, tope en los dos extremos, recorrido corto, mayormente vertical, ruta inválida) y el cableado con `PointerEvent` contra jsdom (ignora mouse, ignora tabla/gráfico/campo de texto, ignora con hoja abierta, no hace nada en escritorio, llama a `animarProximaComo` con el sentido correcto) — más la verificación con toque real de arriba, que es la que de verdad importa acá. `npm test` completo: 588/588.
  **Ajuste de ritmo, mismo día (Gustavo: "apenas se nota, necesito que sea más fluido").** Mismo motivo que ya está documentado arriba para el círculo de tema: `--ease` arranca rápido (72% del recorrido a los 32% del tiempo), así que a mitad de camino el ojo ya lo lee como terminado — esta vez le tocó al deslizo. Pasa a `ease-in-out` (reparte el movimiento parejo de punta a punta) y de 420ms a 550ms. Confirmado con `getTiming().duration` en vivo (550ms) y con una captura cuadro por cuadro a velocidad real: la transición ahora se ve repartida en varios cuadros con un reparto parejo entre las dos vistas a mitad de camino, no comprimida en uno o dos cuadros como antes.
  **Optimización, mismo día (Gustavo: "aprieto y se traba todo... va muy lenta").** La sospecha más directa: `main` captura una pantalla entera de tarjetas `.shell`/`.cg` con `backdrop-filter` (skill §3) dos veces (vieja y nueva) para la transición — eso le pide al GPU recalcular el desenfoque de todo a la vez. Mientras dura el deslizo se le saca el blur a esas tarjetas, con el mismo respaldo sólido que ya existe para cuando el navegador no tiene `backdrop-filter` (§3, los tokens `--glass-*-fallback` de siempre, no colores nuevos). De 550ms a 320ms, con `ease-in-out` (lo que ya se corrigió en la vuelta anterior para que el deslizo no se "comiera" el recorrido al principio).
  **Medido, no sólo sentido:** la misma métrica de cuadros por segundo de antes (`requestAnimationFrame` durante el gesto completo) pasó de 9 cuadros con salto (de 64, algunos de hasta 66,7ms — más de un cuadro perdido a 60fps) a 1 cuadro (de 74, de 33,3ms — un solo cuadro justo en el límite). El intervalo promedio bajó de 19,5ms a 16,9ms, prácticamente los 16,7ms ideales de 60fps.
  **Aprobada por Gustavo, 2026-10-23.**

- [ ] **F12-T05 · Cuatro correcciones de uso: scroll, color, orden y conmutadores**
  **Tipo:** Frontend · **Ref:** `.claude/skills/epic-wallet-ui/SKILL.md` §1, §8, §9
  **Hacer:** cuatro cosas que Gustavo encontró usando la aplicación (2026-10-27).

  1. **Scroll vertical sobre un gráfico o una tabla.** `.chart-wrap` y `.tbl-wrap` declaraban `touch-action: pan-x`. El navegador cruza ese valor con el `pan-y` que `.app` pide para los gestos (F12-T04) y el resultado era ningún eje: el dedo apoyado encima movía el gráfico de costado pero ya no scrolleaba la página. Pasan a `pan-x pan-y`, y `.view-switch` también, que tampoco se podía desplazar de costado en el teléfono.
  2. **El gráfico tocaba el borde de la tarjeta.** Primero se probó con relleno, y no alcanzaba: el relleno es parte de lo que se desplaza, así que apenas el dedo movía el gráfico el dibujo pasaba por debajo y tocaba el borde igual (Gustavo lo vio con el gráfico ya corrido). Ahora `.chart-wrap` lleva `margin: 0 14px`: el contenedor entero queda adentro de la tarjeta y el recorte pasa 14 px antes del borde, en cualquier posición del scroll. Vale para el gráfico diario y para el de últimos seis meses.
  3. **Colores con más vida.** Misma paleta y mismos roles, más saturación: los tres semánticos, las cuatro severidades, el acento, los lavados del fondo y las cuatro tarjetas de color. El tope lo pone el contraste, no el gusto: las tarjetas sólidas quedan entre 5,3 y 6,0:1 con blanco. Todo en `tokens.css`, ningún componente tocado.
  4. **«Variación» fuera** del orden de gastos por categoría, front y lógica (el campo `variation` de la API sigue: lo usan las tarjetas de ingresos y egresos).
  5. **Los conmutadores tenían dos dueños.** Cada pantalla marcaba la pastilla elegida y, además, `views/vistas.js` marcaba cualquier `.view-switch` del documento: de ahí salían los estados raros (dos marcadas, o ninguna al volver a pintar). Ahora hay un solo módulo, `components/switch.js`, y la marca es **una pastilla que se desliza** hasta la opción elegida — con vista previa al pasar el puntero, en pantallas con mouse.

  6. **El círculo del cambio de tema arrancaba trabado.** Una view transition saca dos fotos de la pantalla entera y, con una pantalla llena de `.shell`/`.cg`, el GPU recalcula todos los `backdrop-filter` en el primer cuadro. Es el mismo trabado que ya se había corregido para el deslizo entre vistas (F12-T04) y que al cambio de tema le faltaba: ahora `tema.js` marca `data-transicion-tema` mientras dura y `base.css` usa el respaldo sólido de siempre. Las dos barras quedan afuera, que ya son opacas.

  **Aceptación:** · deslizar de arriba abajo con el dedo sobre el gráfico diario y sobre la tabla de Cartera scrollea la página, y de lado a lado sigue moviendo el gráfico o la tabla · al final del scroll del gráfico queda un margen contra el borde de la tarjeta · los colores se ven más vivos en los dos temas · en «Gastos por categoría» quedan dos órdenes · cambiar de opción en cualquier conmutador desliza la pastilla y nunca deja dos marcadas ni ninguna · el círculo del cambio de tema sale parejo desde el primer cuadro.

  `npm test`: 630/630.


- [ ] **F12-T06 · Dos animaciones pedidas: el interruptor y la fila que entra**
  **Tipo:** Frontend · **Ref:** `.claude/skills/epic-wallet-ui/SKILL.md` §8
  **Hacer:** dos pedidos de Gustavo (2026-10-27), los dos con una referencia concreta.

  1. **El interruptor de encendido** (Ajustes → Categorías, y cualquier otro `.toggle`). El pulgar ya se deslizaba con rebote; le faltaban las dos cosas que hacen que se sienta físico: **se estira mientras se mantiene apretado** y **el color del surco se funde en vez de saltar**. Lo segundo no era un descuido de duración: el surco encendido es un degradado, y un degradado no se puede interpolar, así que la transición de `background` no hacía nada. Ahora el color vive en una capa `::after` y lo que se anima es su opacidad.
  2. **La fila del movimiento recién cargado entra animada**: cae desde arriba, empuja al resto de la lista y deja un halo de acento que se apaga — así se ve *cuál* es, aunque la lista ya tenga veinte. `alta-movimiento.js` emite `movimiento:creado` con el id y `movimientos.js` lo marca al pintar; el alto se mide en JavaScript y viaja en `--alto-fila`, porque `height: auto` no se anima.

  **Aceptación:** · apretar un interruptor sin soltar estira el pulgar, y al soltarlo el color del surco se funde junto con el movimiento · cargar un movimiento estando en Movimientos lo muestra entrando en la lista, no simplemente puesto · con un filtro que lo deja afuera, no pasa nada raro.

  Probado en `tests/js/movimientos.test.mjs` (la fila correcta queda marcada, se consume una sola vez, un id que no está no rompe nada). La animación en sí se mira en la pantalla, como el resto de lo visual. `npm test`: 633/633.


---

# Después del MVP

Temas reales del documento general que **no** entran en el MVP. No tienen tareas detalladas a propósito: se detallan cuando les llegue el turno, con lo que se haya aprendido construyendo el resto. Si querés adelantar alguno, decímelo y lo subo.

| Tema | De qué se trata | Por qué puede esperar |
|---|---|---|
| **Cotizaciones automáticas** | Actualizar solo el valor de las inversiones (General §25, §26) | El propio documento general lo condiciona a «si se encuentra una fuente viable». La actualización manual de F10 ya cubre la necesidad |
| **Alertas** | Las cinco reglas analíticas (General §29) | Son útiles pero nada depende de ellas. Con los datos cargados vas a saber mejor qué umbrales querés |
| **Historial salarial y análisis** | Evolución salarial y métricas históricas (General §28, §53) | Dato interesante, no operativo — la pantalla "Análisis" que llegó a existir se sacó el 2026-10-21, sin uso real detrás |
| **PWA offline** | Service worker con caché de lectura y atajos (General §45, Técnico §15.1) | Ya se instala y se abre en modo aplicación desde F00-T11. El offline es comodidad |
| **Integraciones futuras** | Importación de Excel y Mercado Pago (General §60, §61) | Explícitamente fuera del MVP en el documento general. La anti-duplicación ya está en la base desde F04-T03 |

### Lo que se descartó

- **Los dos esquemas de base de datos** (`public` y `dev`) y el plan de partirlos en dos proyectos de Supabase. El proyecto trabaja contra **un solo esquema**. A cambio, el procedimiento de migración es: respaldo primero, migrar después. El esquema `dev` queda en pie sin uso hasta que decidas borrarlo. **Esta es la única simplificación con un riesgo real sobre tus datos, y fue una decisión explícita.**
- **Las pruebas de interfaz con Playwright en CI.** La interfaz se verifica a mano en el celular, tarea por tarea.
- **Las 18 tareas de documentación de cierre de fase.** Una sola, en F11-T05.
- **Las exigencias numéricas** de cobertura del 90 %, Lighthouse ≥ 90 y presupuesto de KB. El objetivo de 400 ms de `/api/dashboard` se conserva porque es el que justificó la región São Paulo.

### Identificadores de la v1.0 que ya no existen

Fusionados en la tarea de identificador más bajo de su grupo, o eliminados por cambio de política:

`F02-T13`, `F02-T15` · `F03-T02`, `F03-T04`, `F03-T06`, `F03-T09`, `F03-T11`, `F03-T12`, `F03-T13` · `F04-T02`, `F04-T04`, `F04-T07`, `F04-T08`, `F04-T10`, `F04-T11`, `F04-T13`, `F04-T14`, `F04-T15` · `F05-T02`, `F05-T03`, `F05-T05`, `F05-T06`, `F05-T08`, `F05-T09`, `F05-T10`, `F05-T12` · `F06-T03`, `F06-T04`, `F06-T06`, `F06-T08`, `F06-T10`, `F06-T11`, `F06-T12`, `F06-T13` · `F07-T02`, `F07-T04`, `F07-T06`, `F07-T07`, `F07-T08`, `F07-T09` · `F08-T02`, `F08-T04`, `F08-T05`, `F08-T08`, `F08-T09`, `F08-T10`, `F08-T12`, `F08-T13` · `F09-T02`, `F09-T04`, `F09-T06`, `F09-T07`, `F09-T09`, `F09-T10` · `F10-T02`, `F10-T03`, `F10-T05`, `F10-T07`, `F10-T09`, `F10-T10`, `F10-T11`, `F10-T13`, `F10-T14` · toda la Fase 11 de cotizaciones, la 12 de análisis, la 13 de alertas, la 14 de configuración (ahora F11-T01 y F11-T02), la 15 de PWA, la 16 de seguridad (ahora F11-T03 a F11-T05) y la 17 de integraciones.

La versión 1.0 completa queda en el historial de Git si alguna vez hace falta recuperar el detalle de alguna.
