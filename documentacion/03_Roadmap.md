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

**Lo que no cambió:** el modelo financiero, las dos naturalezas de mes, las siete pantallas, el diseño «Vidrio Grafito», los seis indicadores, los cinco gráficos, el histórico consolidado, las inversiones, RLS y el login. La aplicación que vas a usar es la misma.

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
| **1** | Sistema de estilo y esqueleto visual | — cerrada | Las 7 pantallas navegables con datos de ejemplo, claro/oscuro |
| **2** | Cuentas de usuario | **4** | Registro, login, cambio de contraseña, cuentas aisladas |
| **3** | Meses y categorías | **5** | Navegación de meses real y categorías administrables |
| **4** | Movimientos | **6** | Alta, edición, baja y listado con recálculo del mes |
| **5** | Indicadores del dashboard | **4** | Los 6 indicadores con datos reales |
| **6** | Gráficos | **5** | Los 5 gráficos |
| **7** | Desglose y detalle de categoría | **3** | Desglose ordenable y movimientos por categoría |
| **8** | Histórico y carga del Excel | **5** | **Acá la aplicación ya te sirve todos los días** |
| **9** | Ahorro acumulado y patrimonio | **4** | Saldo acumulado y patrimonio neto |
| **10** | Inversiones | **5** | Cartera con compra, venta y rendimientos |
| **11** | Cierre del MVP | **5** | Configuración, respaldo, recuperación de contraseña, MVP verificado |

**46 tareas pendientes.** Hasta el final de la Fase 6 —el MVP de la sección 64 del documento general— hay **24**.

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
- El enlace *Olvidé mi contraseña* está apagado porque todavía no hay correo configurado. Lo habilita **F11-T03**.

---

# FASE 2 — Cuentas de usuario

**Objetivo:** cerrar el ciclo de una cuenta sin depender del correo. Registro, entrar, salir, cambiar la contraseña, y cada cuenta viendo sólo lo suyo.

**Al cerrar esta fase:** te registrás desde el celular, entrás, cambiás tu contraseña, y una segunda cuenta de prueba no ve ni un dato de la primera.

> **La confirmación por correo sigue desactivada** en Supabase (Authentication → Providers → Email → *Confirm email* en off), así el registro funciona de inmediato. El correo se configura en **F11-T03**, junto con la recuperación de contraseña.

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

- [~] **F04-T12 · Lista del mes, detalle, edición y baja**
  **Tipo:** Frontend · **Ref:** General §11 · *fusiona F04-T12 y F04-T13*
  **Hacer:** lista de movimientos del mes agrupada por día, con los filtros de la API; al tocar una fila, hoja de detalle con editar y borrar, la baja con confirmación (R11).
  **Aceptación:** · la lista refleja lo cargado y ordena por fecha descendente · editar el importe actualiza los totales · borrar pide confirmación y no se puede deshacer por accidente · un mes sin movimientos muestra el estado vacío, no una lista en blanco.

---

# FASE 5 — Indicadores del dashboard

**Objetivo:** los seis indicadores de la sección 12.2 del documento general, con datos reales.

**Al cerrar esta fase:** abrís la aplicación y ves tu mes de verdad.

- [ ] **F05-T01 · Módulo de cálculos puros**
  **Tipo:** Cálculo · **Ref:** Técnico §7, §7.1 · General §52 · *fusiona F05-T01, F05-T02 y F05-T03*
  **Hacer:** `services/calc.py` con ingresos, gastos, ahorro del mes, tasa de ahorro, ahorro acumulado, total de inversiones y patrimonio; la serie diaria del mes con el ahorro acumulado día a día; y los casos borde obligatorios de la sección 7.1.
  **Aceptación:** · **tasa de ahorro con ingresos en cero devuelve `null`, no un error ni una división** · un mes vacío da ceros · la serie diaria de un mes histórico es `null` · cada función tiene su test y son todas puras: reciben números y devuelven números.

- [ ] **F05-T04 · Servicio y endpoint `/api/dashboard`**
  **Tipo:** Backend · **Ref:** Técnico §9.2 · *fusiona F05-T04, F05-T05 y F05-T06*
  **Hacer:** el contrato central de la sección 9.2 en **una sola llamada** que trae indicadores, serie diaria, últimos seis meses, desglose por categoría y últimos movimientos.
  **Aceptación:** · una sola petición alimenta todo el dashboard · un mes histórico responde con `transactions: null` y sin serie diaria · responde en menos de 400 ms desde la función desplegada.

- [ ] **F05-T07 · Los seis indicadores conectados**
  **Tipo:** Frontend · **Ref:** General §12.2 · *fusiona F05-T07, F05-T08, F05-T09 y F05-T10*
  **Hacer:** las seis tarjetas con datos reales; animación de conteo; estados de carga, error y vacío; formato de importes en pesos argentinos con `tabular-nums` para que las cifras no bailen.
  **Aceptación:** · los seis indicadores muestran lo mismo que la API · con la red caída se ve un error entendible, no una pantalla rota · un mes sin datos muestra ceros con su explicación · las cifras no cambian de ancho al actualizarse.

- [ ] **F05-T11 · Verificación contra el Excel**
  **Tipo:** QA
  **Hacer:** cargar un mes completo del Excel a mano y comparar los seis indicadores con los del Excel, peso por peso.
  **Aceptación:** · los seis coinciden · cualquier diferencia queda explicada o corregida antes de cerrar la fase.

---

# FASE 6 — Gráficos

**Objetivo:** los cinco gráficos de la sección 54, en SVG propio.

**Al cerrar esta fase el MVP de la sección 64 está completo.**

- [ ] **F06-T01 · Utilidades de SVG**
  **Tipo:** Frontend · **Ref:** Técnico §14.3
  **Hacer:** escalas, ejes, grilla, formato de etiquetas y contenedor que se adapta al ancho; las reglas comunes de la sección 14.3.
  **Aceptación:** · un gráfico se dibuja a 390 px y a 1440 px sin deformarse · los colores salen de los tokens, ninguno escrito a mano.

- [ ] **F06-T02 · Gráfico diario del mes**
  **Tipo:** Frontend · **Ref:** Técnico §14.1 · General §13 · *fusiona F06-T02, F06-T03 y F06-T04*
  **Hacer:** barras de ingresos y egresos por día, línea de ahorro acumulado en un segundo eje, modo acumulado conmutable y pie con las cifras del mes.
  **Aceptación:** · los dos ejes están rotulados y no se confunden · el día de hoy se distingue · el modo acumulado y el diario muestran el mismo total al final del mes.

- [ ] **F06-T05 · Últimos seis meses y gastos por categoría**
  **Tipo:** Frontend · **Ref:** General §14, §15 · *fusiona F06-T05 y F06-T06*
  **Hacer:** barras comparadas de los últimos seis meses con el ahorro de cada uno, y el gráfico de gastos por categoría del mes.
  **Aceptación:** · con menos de seis meses cargados muestra los que hay, sin huecos falsos · las categorías se ordenan de mayor a menor.

- [ ] **F06-T07 · Evolución del ahorro y composición patrimonial**
  **Tipo:** Frontend · **Ref:** General §54
  **Hacer:** los dos gráficos restantes. El patrimonial queda con datos de ejemplo hasta la Fase 9, que es la que trae el dato real.
  **Aceptación:** · la evolución del ahorro usa el acumulado real · el patrimonial queda listo para enchufar y marcado como tal.

- [ ] **F06-T09 · Tema, móvil, interacción y mes histórico**
  **Tipo:** Frontend · **Ref:** Técnico §14.3, §13.7 · *fusiona F06-T09, F06-T10, F06-T11 y F06-T12*
  **Hacer:** los cinco gráficos respondiendo al cambio de tema sin recargar; toque y arrastre en móvil para ver el valor de un día; y el mes histórico mostrando un mensaje en lugar del gráfico diario, porque no tiene movimientos individuales.
  **Aceptación:** · cambiar de tema redibuja sin recargar · en el celular se puede leer el valor de un día con el dedo · **el mes histórico no inventa una serie diaria**: explica que es un mes consolidado.

---

# FASE 7 — Desglose y detalle de categoría

**Objetivo:** del total de una categoría poder llegar a los movimientos que lo forman.

- [ ] **F07-T01 · Lógica del desglose y detalle en la API**
  **Tipo:** Cálculo → Backend · **Ref:** General §15, §16 · *fusiona F07-T01 y F07-T02*
  **Hacer:** cálculo del desglose con porcentaje sobre el total y variación contra el mes anterior; endpoint de detalle de categoría que devuelve sus movimientos, o el total consolidado si el mes es histórico.
  **Aceptación:** · los porcentajes suman 100 · una categoría sin movimientos no aparece o aparece en cero, decidido y consistente · el detalle de un mes histórico devuelve el total sin inventar movimientos.

- [ ] **F07-T03 · Panel de desglose con ordenamiento**
  **Tipo:** Frontend · **Ref:** General §15 · *fusiona F07-T03 y F07-T04*
  **Hacer:** panel en el dashboard ordenable por importe, nombre y variación, con la barra proporcional de cada categoría.
  **Aceptación:** · el orden elegido se mantiene al cambiar de mes · en el celular se lee sin desbordar.

- [ ] **F07-T05 · Hoja de detalle de categoría**
  **Tipo:** Frontend · **Ref:** General §16 · *fusiona F07-T05, F07-T06, F07-T07 y F07-T08*
  **Hacer:** hoja inferior con los movimientos de la categoría, accesible también tocando el gráfico de categorías, con editar y borrar desde ahí; y el caso del mes consolidado con su mensaje.
  **Aceptación:** · se llega desde el panel y desde el gráfico · editar desde el detalle actualiza el desglose y los indicadores · el mes consolidado explica por qué no hay lista.

---

# FASE 8 — Histórico y carga del Excel

**Objetivo:** cargar los años de Excel como meses consolidados y poder consultarlos.

**Al cerrar esta fase la aplicación ya te sirve todos los días:** tenés tu histórico adentro, el mes en curso al día y los gráficos con datos reales.

- [ ] **F08-T01 · Lógica de mes histórico y saldo acumulado en cadena**
  **Tipo:** Cálculo · **Ref:** General §18, §19, §50 R4 · *fusiona F08-T01 y F08-T02*
  **Hacer:** validación de un mes histórico (totales no negativos, no pisar un mes con movimientos) y el saldo acumulado encadenado desde el saldo inicial, mes por mes.
  **Aceptación:** · **cargar un mes histórico recalcula el acumulado de todos los meses posteriores**, no sólo el propio · un mes `open` con movimientos no se puede convertir en consolidado sin aviso explícito · el acumulado parte del saldo inicial del perfil.

- [ ] **F08-T03 · Endpoints de meses históricos**
  **Tipo:** Backend · **Ref:** Técnico §9.1 · *fusiona F08-T03, F08-T04 y F08-T05*
  **Hacer:** `POST /api/months/historical` para crear un mes consolidado con sus totales por categoría (`is_manual_summary = true`), `PATCH /api/months/{id}` para corregirlo, y `GET /api/months` devolviendo el saldo acumulado de cada uno.
  **Aceptación:** · un mes consolidado queda con sus totales y sin movimientos · corregir un total propaga el acumulado hacia adelante · los totales por categoría de un mes histórico quedan marcados como manuales.

- [ ] **F08-T06 · Script de carga asistida del histórico**
  **Tipo:** Infra
  **Hacer:** script que toma los totales mes por mes desde un CSV o desde la consola y los carga por la API, mostrando qué va a escribir antes de hacerlo y pudiendo repetirse sin duplicar.
  **Aceptación:** · muestra un resumen y pide confirmación antes de escribir · correrlo dos veces con los mismos datos no duplica nada.

- [ ] **F08-T07 · Vista de historial**
  **Tipo:** Frontend · **Ref:** General §17, §18 · *fusiona F08-T07, F08-T08, F08-T09 y F08-T10*
  **Hacer:** lista de meses con ingresos, gastos, ahorro y acumulado; formulario de carga de un mes histórico con sus totales por categoría; advertencia visible si los totales por categoría no suman el total del mes; y el gráfico de evolución del ahorro.
  **Aceptación:** · se carga un mes histórico completo desde el celular · si las categorías no suman el total, avisa y deja decidir · los meses consolidados se distinguen de los abiertos de un vistazo.

- [ ] **F08-T11 · Carga real del histórico del Excel**
  **Tipo:** QA
  **Hacer:** cargar todos los meses del Excel y verificar contra el Excel el ahorro acumulado final.
  **Aceptación:** · el acumulado final coincide con el del Excel · ningún mes quedó sin cargar.

---

# FASE 9 — Ahorro acumulado y patrimonio

- [ ] **F09-T01 · Lógica del saldo inicial, el acumulado y el patrimonio neto**
  **Tipo:** Cálculo · **Ref:** General §5.2, §5.3, §19, §30 · *fusiona F09-T01 y F09-T02*
  **Hacer:** acumulado desde el saldo inicial y patrimonio neto = ahorros + valor actual de inversiones − pasivos.
  **Aceptación:** · **comprar una inversión no cambia el patrimonio neto**, sólo mueve su composición · sin pasivos el patrimonio es ahorros más inversiones · el saldo inicial se refleja en el primer mes.

- [ ] **F09-T03 · Tabla `liabilities` y `GET /api/patrimony`**
  **Tipo:** Backend · *fusiona F09-T03 y F09-T04*
  **Hacer:** modelo, migración y RLS de `liabilities`; endpoint con la composición patrimonial y su evolución.
  **Aceptación:** · `downgrade` probado · el endpoint devuelve la composición y el total · sin pasivos cargados no falla.

- [ ] **F09-T05 · Saldo inicial y vista de patrimonio**
  **Tipo:** Frontend · **Ref:** General §30 · *fusiona F09-T05, F09-T06 y F09-T07*
  **Hacer:** saldo inicial editable en configuración; vista de patrimonio con la composición y el gráfico de la Fase 6 enchufado; y en el dashboard, distinción clara entre ahorros, inversiones y patrimonio, que es donde más se confunde.
  **Aceptación:** · cambiar el saldo inicial recalcula todo el acumulado · el gráfico patrimonial usa el dato real · se entiende sin leer un manual que el patrimonio no es la suma de los otros dos indicadores.

- [ ] **F09-T08 · Verificación contra el Excel**
  **Tipo:** QA
  **Aceptación:** · el patrimonio y el acumulado coinciden con el Excel.

---

# FASE 10 — Inversiones

**Objetivo:** la cartera, con actualización manual del valor. Las cotizaciones automáticas quedan para después del MVP.

- [ ] **F10-T01 · Lógica de valuación, rendimiento y transferencia patrimonial**
  **Tipo:** Cálculo · **Ref:** General §22, §23, §24, §50 R7, R9 · *fusiona F10-T01, F10-T02 y F10-T03*
  **Hacer:** valor actual, rendimiento absoluto y porcentual, total invertido, resultado de cartera; y la regla de que comprar o vender mueve valor entre ahorros e inversiones sin ser un gasto ni un ingreso.
  **Aceptación:** · **el rendimiento de una inversión no es un ingreso mensual** · comprar no es un gasto de consumo · vender devuelve el valor a los ahorros · el rendimiento porcentual con total invertido en cero devuelve `null`.

- [ ] **F10-T04 · Tabla `investments` y servicio de cartera**
  **Tipo:** Backend · **Ref:** Técnico §6.2, §7.3 · *fusiona F10-T04 y F10-T05*
  **Hacer:** modelo, migración y RLS; servicio con los indicadores de la cartera y las operaciones de compra y venta en una transacción.
  **Aceptación:** · `downgrade` probado · una venta a medias no deja la cartera descuadrada · eliminar una inversión pide confirmación (R10).

- [ ] **F10-T06 · Endpoints de inversiones**
  **Tipo:** Backend · *fusiona F10-T06 y F10-T07*
  **Hacer:** alta, listado, detalle, actualización manual de valor, venta y baja; y la categoría de transferencia excluida del gasto del mes.
  **Aceptación:** · comprar una inversión **no aparece como gasto** en el desglose del mes · actualizar el valor a mano cambia el patrimonio y no el ahorro del mes.

- [ ] **F10-T08 · Vista de cartera**
  **Tipo:** Frontend · **Ref:** General §20, §21 · *fusiona F10-T08, F10-T09, F10-T10 y F10-T11*
  **Hacer:** indicadores de la cartera, tabla de posiciones con su rendimiento, alta de posición, y hoja de detalle con actualización manual del valor y venta.
  **Aceptación:** · se carga una posición y se actualiza su valor desde el celular · el rendimiento se ve en color según el signo · vender pide confirmación y deja el ahorro actualizado.

- [ ] **F10-T12 · Carga real de la cartera**
  **Tipo:** QA
  **Aceptación:** · tus posiciones reales están cargadas y el total coincide con lo que tenés.

---

# FASE 11 — Cierre del MVP

**Objetivo:** lo que falta para que la aplicación esté terminada y tus datos no dependan de una sola copia.

**Al cerrar esta fase el MVP está completo.**

- [ ] **F11-T01 · Configuración**
  **Tipo:** Backend → Frontend · **Ref:** General §42, §48.9 · *reemplaza F14-T01 a F14-T05*
  **Hacer:** tabla `app_settings`, `GET` y `PUT /api/settings`, y la vista de configuración completa: preferencias de la aplicación (tema, formato de importes), sección de cuenta y saldo inicial.
  **Aceptación:** · las preferencias persisten entre sesiones y dispositivos · el saldo inicial se edita desde acá · la vista reúne lo que hoy está disperso.

- [ ] **F11-T02 · Exportación y respaldo**
  **Tipo:** Backend → Frontend · **Ref:** General §58 · Técnico §18 · *reemplaza F14-T06 a F14-T10*
  **Hacer:** `GET /api/export` con todos los datos del usuario en JSON y CSV; botón de descarga en configuración; y **una restauración probada de verdad**, porque un respaldo que nunca se restauró no es un respaldo.
  **Aceptación:** · la exportación trae todo: meses, movimientos, categorías, inversiones y perfil · **se restaura el respaldo en una cuenta limpia y los datos quedan iguales** · la descarga funciona desde el celular.

- [ ] **F11-T03 · Correo, recuperación de contraseña y contraseña nueva**
  **Tipo:** Infra → Frontend · **Ref:** Técnico §8.5, §8.6 · General §48.1.2, §48.1.3 · *reemplaza F16-T12, F16-T13 y F16-T14*
  **Hacer:** SMTP propio en Supabase con las plantillas en español; activar la confirmación por correo; pantalla de *Olvidé mi contraseña* con enlace de un solo uso que vence, **sin revelar si el email tiene cuenta**; pantalla de contraseña nueva; habilitar el enlace apagado del login.
  **Aceptación:** · llega el mail y el enlace deja poner una contraseña nueva · el enlace usado o vencido no sirve otra vez · un email sin cuenta recibe la misma respuesta que uno con cuenta · una cuenta nueva recibe su mail de confirmación.

- [ ] **F11-T04 · Repaso de seguridad**
  **Tipo:** QA · **Ref:** Técnico §17 · *reemplaza F16-T01 a F16-T09*
  **Hacer:** tres cosas y nada más. (1) Reverificar el aislamiento entre cuentas con todos los endpoints que ya existen, que son muchos más que en F02-T14. (2) Cargar un movimiento con etiquetas HTML y JavaScript en la descripción y en el nombre de una categoría, y confirmar que se muestran como texto. (3) Confirmar que el paquete del navegador sólo lleva la URL y la clave anónima de Supabase, y que la clave de servicio y el secreto de JWT no están ahí ni en el repositorio.
  **Aceptación:** · ningún recurso ajeno es accesible en ningún endpoint · el texto con etiquetas se muestra, no se ejecuta · no hay secretos en el frontend ni en el repositorio.
  **Nota de alcance:** no se hace límite de peticiones, ni política de contenido estricta, ni auditoría del historial de Git, ni prueba de carga, ni auditoría formal de accesibilidad. RLS en la base es la defensa que importa acá y ya está activa. Si alguna vez la aplicación se abre a desconocidos, esto se revisa.

- [ ] **F11-T05 · Verificación del MVP y `docs/COMO_FUNCIONA.md`**
  **Tipo:** QA → Doc · *reemplaza F16-T10, F16-T11, F16-T15, F16-T16 y las 18 tareas de documentación de fase*
  **Hacer:** recorrer los 24 criterios de la sección 65 del documento general uno por uno desde el celular y desde la PC, anotando el resultado; y escribir **un solo** `docs/COMO_FUNCIONA.md`: cómo está armada la aplicación, cómo levantarla, el modelo de datos, las decisiones que hay que conocer para tocar el código, y lo que quedó deliberadamente afuera. Sin capturas que haya que mantener, sin cuadros que repitan el código.
  **Aceptación:** · los 24 criterios quedan verificados o con su excepción anotada y aceptada por vos · alguien que nunca vio el proyecto lo levanta siguiendo el documento · el documento entra en una lectura.

---

# Después del MVP

Temas reales del documento general que **no** entran en el MVP. No tienen tareas detalladas a propósito: se detallan cuando les llegue el turno, con lo que se haya aprendido construyendo el resto. Si querés adelantar alguno, decímelo y lo subo.

| Tema | De qué se trata | Por qué puede esperar |
|---|---|---|
| **Cotizaciones automáticas** | Actualizar solo el valor de las inversiones (General §25, §26) | El propio documento general lo condiciona a «si se encuentra una fuente viable». La actualización manual de F10 ya cubre la necesidad |
| **Alertas** | Las cinco reglas analíticas (General §29) | Son útiles pero nada depende de ellas. Con los datos cargados vas a saber mejor qué umbrales querés |
| **Historial salarial y análisis** | Evolución salarial y métricas históricas (General §28, §53) | Dato interesante, no operativo |
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
