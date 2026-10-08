# Documento funcional --- Aplicación personal de gestión financiera

**Versión:** 1.0\
**Fecha:** 03/10/2026\
**Estado:** Especificación funcional inicial para desarrollo\
**Tipo:** Web responsive + PWA\
**Usuario principal:** 1 usuario, con posibilidad de ampliar a pocos
usuarios autenticados

> **Ampliación del 03/10/2026.** La posibilidad de ampliar a varios
> usuarios se adelantó al MVP por pedido expreso: la aplicación incluye
> registro propio con confirmación por correo, recuperación de contraseña
> y aislamiento total entre cuentas. Ver sección 4.1 y el detalle técnico
> en `02_Documento_Tecnico.md` §8.

------------------------------------------------------------------------

## 1. Resumen ejecutivo

El objetivo es transformar el sistema financiero personal que
actualmente se administra en Excel desde hace varios años en una
aplicación web/PWA orientada principalmente a celular, pero con una
experiencia de dashboard completa en PC.

La aplicación no debe intentar replicar visualmente el Excel. Debe
conservar su **lógica financiera y su forma simple de uso**, pero
convertirla en un sistema estructurado que permita:

-   registrar ingresos y egresos;
-   trabajar por mes;
-   registrar el mes actual movimiento por movimiento;
-   conservar los meses anteriores como histórico;
-   mostrar acumulados por categoría;
-   visualizar el comportamiento diario y mensual mediante gráficos;
-   calcular el ahorro mensual y acumulado;
-   mostrar el patrimonio total;
-   mantener una cartera actual de inversiones;
-   actualizar automáticamente, cuando exista una fuente adecuada, el
    valor de mercado de las inversiones;
-   permitir actualizar manualmente las inversiones;
-   mantener un historial salarial/laboral;
-   generar alertas útiles;
-   proteger el acceso mediante usuario y contraseña;
-   funcionar principalmente desde el celular;
-   poder utilizarse cómodamente desde una PC;
-   quedar preparada para futuras integraciones, especialmente Mercado
    Pago.

La aplicación debe priorizar **rapidez de carga, claridad y control de
los datos**. No debe convertirse en un sistema contable complejo.

------------------------------------------------------------------------

# 2. Objetivos

## 2.1 Objetivo principal

Crear una herramienta personal que permita responder rápidamente:

1.  ¿Cuánto ingresé este mes?
2.  ¿Cuánto gasté este mes?
3.  ¿Cuánto ahorré este mes?
4.  ¿Cómo vengo gastando día por día?
5.  ¿En qué categorías se me está yendo el dinero?
6.  ¿Cuál fue mi gasto más reciente?
7.  ¿Cuánto llevo acumulado históricamente?
8.  ¿Cómo evolucionaron mis ingresos y gastos durante los últimos meses?
9.  ¿Cuál es mi patrimonio actual?
10. ¿Cuánto tengo invertido?
11. ¿Cuánto vale actualmente cada inversión?
12. ¿Cuánto gané o perdí sobre cada inversión?
13. ¿Cómo evolucionó mi sueldo?
14. ¿Hay algún comportamiento que amerite una alerta?

## 2.2 Objetivo secundario

Conservar la información histórica de la planilla Excel sin quedar atado
a ella.

El Excel actual representa una fuente histórica y una referencia
conceptual. La aplicación será el sistema principal de gestión a partir
de su puesta en funcionamiento.

------------------------------------------------------------------------

# 3. Principios de diseño funcional

## 3.1 Simplicidad

Registrar un gasto debe requerir pocos datos.

### Gasto mínimo

-   categoría;
-   importe;
-   fecha automática o seleccionable.

### Gasto ampliado

-   categoría;
-   importe;
-   descripción opcional;
-   fecha.

No será obligatorio informar banco, cuenta, tarjeta específica,
comercio, medio de pago ni otros datos financieros complejos.

## 3.2 Registro individual, visualización acumulada

El usuario puede registrar:

-   Carnicería --- \$22.500
-   Carnicería --- \$31.350
-   Carnicería --- \$42.473

La aplicación mostrará el acumulado:

> Carnicería --- \$96.323

pero conservará los movimientos individuales del mes actual.

## 3.3 El mes actual es el centro de la aplicación

Al ingresar al sistema, el usuario verá siempre el mes actual.

El dashboard principal debe responder:

> **¿Cómo estoy financieramente este mes?**

## 3.4 Histórico simplificado

Los meses anteriores podrán conservarse como información mensual
consolidada.

No es obligatorio reconstruir cinco o seis años de movimientos
individuales.

Para la carga inicial del histórico se podrán ingresar:

-   total de ingresos del mes;
-   total de egresos;
-   ahorro;
-   totales por categoría;
-   información laboral/salarial disponible;
-   saldo acumulado cuando corresponda.

El histórico no tendrá que contener cada gasto individual.

## 3.5 No presupuesto

La aplicación **NO** tendrá módulo de presupuestos en la primera
versión.

No habrá:

-   límite mensual por categoría;
-   porcentaje consumido de presupuesto;
-   presupuesto restante;
-   planificación presupuestaria.

## 3.6 Sí habrá alertas

Las alertas serán analíticas, no presupuestarias.

Ejemplos:

-   gasto mensual significativamente superior al promedio;
-   aumento importante de una categoría;
-   ahorro mensual inferior al promedio;
-   comportamiento inusual;
-   inversión sin cotización actualizada;
-   datos que requieren revisión.

------------------------------------------------------------------------

# 4. Alcance

## 4.1 Incluido en la primera versión

-   autenticación;
-   usuario y contraseña;
-   registro de cuentas nuevas desde la aplicación;
-   confirmación de la cuenta por correo;
-   recuperación de contraseña por correo;
-   cambio de contraseña desde la aplicación;
-   aislamiento total entre cuentas;
-   dashboard del mes actual;
-   ingresos;
-   egresos;
-   categorías;
-   movimientos individuales;
-   resumen mensual;
-   histórico mensual;
-   gráficos;
-   últimos movimientos;
-   filtros básicos;
-   ahorro mensual;
-   ahorro acumulado;
-   patrimonio;
-   inversiones actuales;
-   actualización manual de inversiones;
-   preparación para actualización automática de cotizaciones;
-   historial salarial;
-   alertas;
-   configuración;
-   backup/exportación básica;
-   diseño responsive;
-   PWA.

## 4.2 Fuera de la primera versión

-   presupuesto;
-   gestión detallada de tarjetas;
-   múltiples cuentas bancarias;
-   conciliación bancaria;
-   historial detallado de operaciones de inversión;
-   compras/ventas históricas de inversiones;
-   dólar por ahora;
-   múltiples monedas;
-   deudas;
-   cuotas;
-   préstamos;
-   contabilidad formal;
-   facturación;
-   sincronización bancaria genérica;
-   importación del Excel histórico;
-   integración definitiva con Mercado Pago.

Estas funciones pueden incorporarse posteriormente.

------------------------------------------------------------------------

# 5. Modelo financiero

La aplicación manejará tres conceptos separados.

## 5.1 Flujo mensual

``` text
Ingresos
-
Egresos
=
Ahorro del mes
```

## 5.2 Ahorro acumulado

``` text
Saldo anterior
+
Ahorro del mes
=
Nuevo saldo acumulado
```

## 5.3 Patrimonio neto

En el alcance inicial:

``` text
Patrimonio neto
=
Ahorro
+
Valor actual de inversiones
-
Pasivos
```

Como actualmente no existen pasivos pendientes:

``` text
Patrimonio neto
=
Ahorro
+
Inversiones
```

La arquitectura debe dejar el concepto de pasivos preparado para el
futuro, aunque no se muestre inicialmente.

------------------------------------------------------------------------

# 6. Modelo de meses

## 6.1 Mes actual

Es un mes abierto.

Ejemplo:

``` text
Octubre 2026
```

Los movimientos se cargan individualmente.

## 6.2 Mes histórico

Es un mes consolidado.

Ejemplo:

``` text
Septiembre 2026
```

Puede contener:

-   ingresos totales;
-   egresos totales;
-   ahorro;
-   totales por categoría.

No requiere movimientos individuales.

## 6.3 Cierre mensual

No es necesario bloquear el mes de forma irreversible.

Un mes histórico podrá editarse si el usuario detecta un error.

------------------------------------------------------------------------

# 7. Categorías

Las categorías deben ser configurables.

## 7.1 Ingresos iniciales

-   Sueldo
-   Aguinaldo
-   Otros

## 7.2 Egresos iniciales

-   Alquiler
-   Expensas
-   Cochera
-   ABL
-   Gas
-   Luz
-   Internet
-   Da Vinci
-   Tarjeta
-   Tuenti
-   Nafta
-   Subte
-   Mercadería
-   Verdulería
-   Carnicería / Pollería
-   Delivery / Salida
-   Comida Trabajo
-   Otros

La lista debe poder ampliarse.

El usuario podrá:

-   crear categoría;
-   editar categoría;
-   desactivar categoría;
-   reordenar categorías.

No se debe eliminar físicamente una categoría que tenga información
histórica; debe poder desactivarse.

------------------------------------------------------------------------

# 8. Movimientos

## 8.1 Entidad

Cada movimiento individual tendrá:

-   ID;
-   fecha;
-   tipo: ingreso/egreso;
-   categoría;
-   importe;
-   descripción opcional;
-   mes asociado;
-   origen;
-   fecha de creación;
-   fecha de última modificación.

## 8.2 Origen

Valores iniciales:

-   manual;
-   Mercado Pago;
-   importación futura;
-   sistema.

## 8.3 Fecha

Al crear un movimiento desde el dashboard:

-   fecha predeterminada = fecha actual;
-   el usuario puede modificarla.

## 8.4 Importe

Debe ser positivo en el formulario.

El sistema determina si contablemente es ingreso o egreso.

Esto evita errores por introducir manualmente signos.

## 8.5 Descripción

Opcional.

Ejemplos:

``` text
Compra supermercado
Venta de consola
Aguinaldo
Regalo
Reintegro
```

------------------------------------------------------------------------

# 9. Alta de gasto

Flujo:

``` text
Dashboard
   ↓
Botón "+"
   ↓
Nuevo gasto
   ↓
Formulario
```

Campos:

``` text
Categoría
Importe
Descripción opcional
Fecha
```

Botones:

``` text
Cancelar
Guardar
```

Después de guardar:

-   cerrar formulario;
-   recalcular mes;
-   actualizar dashboard;
-   actualizar gráficos;
-   actualizar totales;
-   mostrar confirmación;
-   mostrar el nuevo movimiento como el más reciente.

El formulario debe ser un **modal o una pantalla rápida**, según el
mockup final.

------------------------------------------------------------------------

# 10. Alta de ingreso

Mismo concepto.

Campos:

``` text
Categoría
Importe
Descripción opcional
Fecha
```

Categorías iniciales:

-   Sueldo;
-   Aguinaldo;
-   Otros.

------------------------------------------------------------------------

# 11. Historial de movimientos del mes

Cada categoría debe poder abrirse para ver sus movimientos desde el más
reciente al más antiguo.

Ejemplo:

``` text
CARNICERÍA / POLLERÍA

Total del mes
$114.500

Último movimiento
03/10/2026 — $42.000

Movimientos

03/10  $42.000
28/09  $31.300
22/09  $18.700
15/09  $22.500
```

Para un mes histórico sin movimientos individuales:

``` text
Septiembre 2026
Total: $182.596

Información histórica consolidada.
```

No se deben inventar movimientos para datos históricos que sólo existen
como totales.

------------------------------------------------------------------------

# 12. Dashboard principal

El dashboard debe estar diseñado alrededor del **mes actual**.

## 12.1 Cabecera

Mostrar:

``` text
Octubre 2026
```

Con controles para:

-   mes anterior;
-   mes siguiente;
-   volver al mes actual.

No debe permitirse seleccionar un mes futuro que todavía no exista.

## 12.2 Indicadores principales

Deben mostrarse numéricamente:

### Total ingresado este mes

Suma de todos los ingresos.

### Total gastado este mes

Suma de todos los egresos.

### Ahorro del mes

``` text
Ingresos - Egresos
```

### Total de ahorros

Saldo acumulado.

### Total de inversiones

Valor actual de la cartera.

### Patrimonio neto

``` text
Ahorros + inversiones - pasivos
```

Los indicadores son obligatorios: el gráfico no reemplaza los números.

------------------------------------------------------------------------

# 13. Gráfico diario del mes actual

Debe existir un gráfico principal que muestre el comportamiento del mes
día por día.

Preferencia funcional:

-   eje X = días;
-   eje Y = importe;
-   barras de ingresos;
-   barras de egresos.

Debe permitir identificar rápidamente:

-   días con mayor gasto;
-   días con ingresos;
-   acumulación de gastos;
-   días sin movimientos;
-   comportamiento irregular.

El gráfico no debe ser únicamente acumulativo.

------------------------------------------------------------------------

# 14. Gráfico de últimos seis meses

Debe existir un segundo gráfico de contexto histórico.

Periodo:

``` text
Mes actual + 5 meses anteriores
```

Debe permitir comparar:

-   ingresos;
-   egresos;
-   ahorro.

Los datos deben estar disponibles también numéricamente.

------------------------------------------------------------------------

# 15. Desglose por categoría

Debajo de los gráficos debe aparecer un detalle similar al Excel:

``` text
CATEGORÍA                     TOTAL

Alquiler                      $553.000
Tarjeta                       $306.425
Mercadería                    $217.803
Carnicería / Pollería         $233.888
Delivery / Salida             $262.200
Otros                         $294.820
...
```

Orden predeterminado:

-   mayor gasto primero.

Debe existir posibilidad de ordenar alfabéticamente.

------------------------------------------------------------------------

# 16. Detalle de categoría

Al seleccionar una categoría:

``` text
Mercadería
```

mostrar:

``` text
Total del mes
$217.803

Última carga
03/10/2026

Historial

03/10/2026    $24.300
02/10/2026    $31.500
01/10/2026    $18.700
...
```

La vista debe diferenciar claramente:

-   total;
-   última carga;
-   movimientos individuales.

------------------------------------------------------------------------

# 17. Historial general

Debe existir una sección:

``` text
Historial
```

que muestre todos los meses.

Ejemplo:

``` text
2026

Octubre
Ingresos     $X
Gastos       $X
Ahorro       $X

Septiembre
Ingresos     $X
Gastos       $X
Ahorro       $X

Agosto
Ingresos     $X
Gastos       $X
Ahorro       $X
```

Seleccionar un mes abre su resumen.

------------------------------------------------------------------------

# 18. Carga histórica manual

Como el Excel no se importará inicialmente, la aplicación deberá
permitir cargar meses históricos manualmente.

Para cada mes se podrá registrar:

``` text
Mes
Año
Total ingresos
Total egresos
Ahorro
```

y, opcionalmente:

``` text
Alquiler
Mercadería
Nafta
Tarjeta
...
```

La suma de las categorías podrá utilizarse para validar el total de
egresos.

Si existe diferencia:

> "La suma de las categorías no coincide con el total de egresos."

El usuario podrá corregirla antes de guardar.

## 18.1 Regla fundamental

Los meses históricos pueden ser **consolidados**.

El mes actual es **transaccional**.

Esto es deliberado y constituye una característica del sistema.

------------------------------------------------------------------------

# 19. Ahorro acumulado

Debe existir un saldo inicial.

Ejemplo:

``` text
Saldo inicial
$3.892.869
```

A partir de ahí:

``` text
Saldo acumulado
=
Saldo inicial + suma de ahorros mensuales
```

Debe distinguirse claramente entre:

### Ahorro del mes

``` text
Ingresos - egresos
```

### Total de ahorros

``` text
Saldo acumulado
```

------------------------------------------------------------------------

# 20. Inversiones --- concepto funcional

El módulo de inversiones será deliberadamente simple.

No será un sistema de trading ni una bitácora de operaciones.

Será una **cartera actual**.

El usuario quiere poder:

-   agregar una inversión;
-   editarla;
-   actualizarla;
-   eliminarla cuando ya no la tenga.

No quiere un historial financiero de compras y ventas.

## 20.1 Datos

Cada posición tendrá:

-   ticker/símbolo;
-   nombre;
-   tipo;
-   nominales;
-   valor inicial;
-   valor actual;
-   rendimiento;
-   última actualización;
-   fuente del precio;
-   estado.

## 20.2 Tipos iniciales

-   Obligación Negociable;
-   Bono;
-   CEDEAR;
-   Acción;
-   FCI;
-   Otro.

------------------------------------------------------------------------

# 21. Inversiones sin historial

Ejemplo actual:

``` text
CP410
732 nominales
Valor inicial $1.122.441
Valor actual $1.117.852
```

Si se vende:

``` text
Eliminar CP410
```

Si se compra otra inversión:

``` text
Agregar nueva inversión
```

No se conservará una bitácora de operaciones de compra/venta.

La base puede guardar metadata técnica de modificación para seguridad,
pero no se presentará como historial financiero.

------------------------------------------------------------------------

# 22. Cálculo de inversiones

Si se dispone de precio unitario:

``` text
Valor actual
=
Nominales × Precio actual
```

Si el instrumento se gestiona por un valor actual introducido
directamente:

``` text
Valor actual
=
Valor ingresado manualmente
```

La aplicación debe permitir ambas posibilidades para cubrir instrumentos
con distintas formas de valoración.

## Rendimiento

``` text
Rendimiento
=
Valor actual - Valor inicial
```

## Rendimiento porcentual

``` text
Rendimiento %
=
((Valor actual / Valor inicial) - 1) × 100
```

Si el valor inicial es cero, el porcentaje no se calcula.

## Total invertido

``` text
SUM(valor inicial de todas las posiciones)
```

## Valor actual de cartera

``` text
SUM(valor actual de todas las posiciones)
```

## Resultado de cartera

``` text
Valor actual total - valor inicial total
```

------------------------------------------------------------------------

# 23. Compra de inversión y ahorro

La compra de una inversión no debe aparecer como un gasto de consumo.

Debe tratarse como transferencia patrimonial.

Conceptualmente:

``` text
Ahorro líquido
-$500.000

Cartera
+$500.000
```

La interfaz deberá simplificar esta operación para que el usuario no
tenga que duplicar la carga.

Si el flujo inicial del usuario sigue utilizando una categoría
"Inversiones", la implementación debe evitar que se descuente dos veces
el mismo importe.

------------------------------------------------------------------------

# 24. Venta de inversión

Al eliminar una posición vendida, el sistema debe poder registrar el
importe recuperado.

Conceptualmente:

``` text
Venta
$1.200.000

Cartera
-$1.200.000

Ahorro
+$1.200.000
```

La eliminación debe requerir confirmación.

------------------------------------------------------------------------

# 25. Actualización automática de inversiones

Se investigará y conectará una fuente de cotizaciones adecuada.

Prioridad:

1.  fuente oficial/institucional;
2.  fuente pública estable;
3.  fuente gratuita;
4.  tercero confiable;
5.  actualización manual como fallback.

BYMA ofrece actualmente APIs de Market Data para renta variable, renta
fija y otros instrumentos, incluyendo datos EOD (cierre del día). Su
catálogo actual indica un plan EOD sin costo con 1.000 solicitudes
mensuales, pero también especifica que sus APIs de Market Data están
disponibles para personas jurídicas. Por lo tanto, BYMA es una
referencia institucional válida para el diseño, pero no debe asumirse
que una aplicación personal puede consumir directamente ese servicio sin
comprobar sus condiciones de acceso.

La arquitectura debe desacoplar la fuente:

``` text
Cartera
   ↓
InvestmentPriceProvider
   ↓
Precio actual
   ↓
Valor actual
   ↓
Rendimiento
```

Si el proveedor falla:

``` text
Actualización automática fallida
        ↓
Alerta
        ↓
Actualización manual disponible
```

No se dependerá de una única API.

------------------------------------------------------------------------

# 26. Frecuencia de cotizaciones

No se requiere tiempo real.

Objetivo:

-   tener valores actuales razonablemente actualizados;
-   revisar la cartera mensualmente;
-   mostrar correctamente el rendimiento;
-   evitar consumo innecesario de cuota.

La interfaz podrá tener:

``` text
Actualizar cotizaciones
```

y mostrar:

``` text
Última actualización:
03/10/2026 18:20
```

------------------------------------------------------------------------

# 27. Mercado Pago

Mercado Pago queda como **integración futura** y no bloquea el MVP.

La documentación oficial actual de Mercado Pago contempla un reporte de
todas las transacciones y una API para generar, consultar y descargar
reportes. El reporte contiene operaciones que afectan el dinero y campos
como tipo de transacción, importe y monto neto liquidado.

La documentación también permite generar reportes para un intervalo de
fechas y descargarlos posteriormente como CSV/XLSX.

Por lo tanto, existen dos caminos futuros:

## Camino A --- API

``` text
Aplicación
    ↓
Access Token / autorización
    ↓
Mercado Pago API
    ↓
Reporte
    ↓
Parser
    ↓
Movimientos
```

## Camino B --- archivo

``` text
Mercado Pago
    ↓
CSV/XLSX
    ↓
Aplicación
    ↓
Previsualización
    ↓
Confirmación
    ↓
Movimientos
```

El camino A no debe darse por garantizado para una cuenta personal hasta
comprobar permisos, tipo de cuenta y alcance real de los datos
disponibles.

La integración no forma parte del MVP.

------------------------------------------------------------------------

# 28. Historial salarial

Módulo independiente de movimientos.

## Datos actuales

``` text
Empresa
Cargo
Sueldo actual
```

## Historial

Cada cambio de sueldo puede generar:

``` text
Fecha
Empresa
Cargo
Sueldo
```

Ejemplo:

``` text
01/01/2026
Sofre Digital
Analista Funcional
$2.993.978

01/02/2026
Sofre Digital
Analista Funcional
$3.325.981
```

## Métricas

-   variación absoluta;
-   variación porcentual;
-   fecha del aumento;
-   tiempo entre aumentos;
-   sueldo promedio por año;
-   evolución salarial.

------------------------------------------------------------------------

# 29. Alertas

Las alertas deben ser analíticas, útiles y poco invasivas.

## Alertas iniciales

### Gasto superior al comportamiento habitual

> Este mes llevás un gasto en Mercadería superior al promedio reciente.

### Ahorro bajo

> Tu ahorro de este mes está por debajo de tu promedio reciente.

### Categoría con crecimiento significativo

> El gasto de Delivery / Salida aumentó respecto del promedio reciente.

### Inversión desactualizada

> Hay inversiones sin cotización actualizada.

### Mes sin cargar

> Todavía no hay movimientos registrados para este mes.

No habrá alertas de presupuesto.

------------------------------------------------------------------------

# 30. Patrimonio

La sección de patrimonio debe mostrar:

``` text
Ahorros
+
Inversiones
+
Otros activos futuros
-
Pasivos futuros
=
Patrimonio neto
```

Actualmente:

``` text
Ahorros
+
Inversiones
=
Patrimonio neto
```

Ejemplo conceptual basado en la estructura observada:

``` text
Total ahorros       $8.649.377
Inversiones        $37.714.543
──────────────────────────────
Patrimonio neto    $46.363.920
```

Los números anteriores son solamente ilustrativos de la estructura del
Excel y no constituyen valores actuales de la aplicación.

------------------------------------------------------------------------

# 31. Base de datos

Se utilizará SQLite en la primera versión.

Tablas principales:

``` text
users
months
categories
transactions
monthly_category_totals
employment_history
investments
investment_price_cache
alerts
app_settings
```

------------------------------------------------------------------------

# 32. users

Campos:

``` text
id
username
password_hash
created_at
updated_at
last_login_at
active
```

La contraseña nunca se almacena en texto plano.

En la implementación, las credenciales las administra el proveedor de
autenticación (`auth.users`) y esta tabla queda como perfil del usuario,
con su saldo inicial y sus preferencias. Al crearse una cuenta nueva, un
disparador de la base genera automáticamente su perfil y sus categorías
iniciales. Ver `02_Documento_Tecnico.md` §8.4.

------------------------------------------------------------------------

# 33. months

Campos:

``` text
id
year
month
status
income_total
expense_total
saving_total
opening_balance
closing_balance
created_at
updated_at
```

Restricción:

``` text
UNIQUE(year, month)
```

------------------------------------------------------------------------

# 34. categories

Campos:

``` text
id
name
type
active
sort_order
created_at
updated_at
```

Tipos:

``` text
income
expense
```

Una categoría de ingreso no podrá utilizarse para egresos y viceversa.

------------------------------------------------------------------------

# 35. transactions

Campos:

``` text
id
month_id
category_id
transaction_date
transaction_type
amount
description
source
created_at
updated_at
```

Tipos:

``` text
income
expense
```

Origen:

``` text
manual
mercado_pago
system
import
```

------------------------------------------------------------------------

# 36. monthly_category_totals

Esta tabla permite representar correctamente los meses históricos
cargados de forma consolidada.

Campos:

``` text
id
month_id
category_id
total_amount
is_manual_summary
created_at
updated_at
```

### Mes actual

``` text
is_manual_summary = false
```

El total se obtiene de los movimientos.

### Mes histórico

``` text
is_manual_summary = true
```

El total fue introducido directamente por el usuario.

Esto evita inventar movimientos individuales para meses antiguos.

------------------------------------------------------------------------

# 37. Regla de cálculo de categoría

## Mes actual

``` text
Total categoría
=
SUM(transactions.amount)
```

filtrado por mes y categoría.

## Mes histórico

``` text
Total categoría
=
monthly_category_totals.total_amount
```

------------------------------------------------------------------------

# 38. employment_history

Campos:

``` text
id
company
position
salary
effective_date
created_at
updated_at
```

Permite construir la evolución salarial sin mezclarla con los
movimientos.

------------------------------------------------------------------------

# 39. investments

Campos:

``` text
id
symbol
name
investment_type
nominal_quantity
initial_value
current_unit_price
current_value
return_value
return_percent
price_source
price_updated_at
active
created_at
updated_at
```

`current_value` puede calcularse automáticamente:

``` text
nominal_quantity × current_unit_price
```

pero debe existir la posibilidad de utilizar un valor actual manual
cuando el instrumento lo requiera.

------------------------------------------------------------------------

# 40. investment_price_cache

Esta tabla no representa operaciones de inversión.

Sirve para:

-   cachear cotizaciones;
-   registrar cuándo se actualizó un precio;
-   evitar consultas innecesarias;
-   detectar datos desactualizados;
-   depurar errores.

No habrá una pantalla de historial de operaciones.

------------------------------------------------------------------------

# 41. alerts

Campos:

``` text
id
user_id
alert_type
title
message
severity
created_at
read_at
dismissed_at
```

------------------------------------------------------------------------

# 42. app_settings

Campos conceptuales:

``` text
id
user_id
key
value
```

Permitirá guardar preferencias futuras.

------------------------------------------------------------------------

# 43. Relaciones principales

``` text
users
  │
  ├── months
  │      │
  │      ├── transactions
  │      │       └── categories
  │      │
  │      └── monthly_category_totals
  │              └── categories
  │
  ├── employment_history
  │
  ├── investments
  │
  ├── alerts
  │
  └── app_settings
```

------------------------------------------------------------------------

# 44. Arquitectura tecnológica

## Frontend

Propuesta:

-   HTML5;
-   Tailwind CSS;
-   JavaScript;
-   Chart.js;
-   componentes HTML reutilizables;
-   responsive;
-   PWA.

No se requiere React/Vue/Angular para el MVP.

## Backend

Propuesta:

-   Python;
-   Flask o FastAPI;
-   SQLAlchemy opcional;
-   SQLite.

La decisión Flask/FastAPI puede tomarse al comenzar la implementación.

## Base

SQLite.

------------------------------------------------------------------------

# 45. PWA

La aplicación debe poder instalarse en Android como una aplicación web
progresiva.

Una PWA instalable utiliza un Web App Manifest y puede abrirse como
aplicación independiente. Los service workers pueden utilizarse para
cache y funcionalidades offline.

Componentes:

``` text
manifest.json
service-worker.js
icons
theme
start_url
display
```

La aplicación debe utilizar HTTPS en producción.

------------------------------------------------------------------------

# 46. Responsive

Prioridad:

1.  celular;
2.  tablet;
3.  PC.

No se debe diseñar primero para escritorio y simplemente reducirlo.

El dashboard móvil debe ser cómodo con una sola mano.

En PC se podrá aprovechar el ancho para:

-   gráficos más grandes;
-   tablas;
-   columnas;
-   mayor densidad de información.

------------------------------------------------------------------------

# 47. Navegación

Propuesta:

``` text
Inicio
Movimientos
Historial
Inversiones
Patrimonio
Análisis
Configuración
```

El diseño visual definitivo se definirá posteriormente a partir del
mockup existente.

------------------------------------------------------------------------

# 48. Pantallas principales

## 48.1 Login

``` text
Correo
Contraseña            [mostrar / ocultar]
[Ingresar]

Crear cuenta   ·   Olvidé mi contraseña
```

## 48.1.1 Registro

``` text
Correo
Contraseña            [mostrar / ocultar]
Repetir contraseña
[Crear cuenta]
```

Al enviarse, la aplicación indica que se envió un correo de
confirmación y ofrece reenviarlo. La cuenta nueva nace con sus
categorías iniciales y su mes en curso vacío.

## 48.1.2 Recuperación de contraseña

``` text
Correo
[Enviar enlace]
```

El mensaje de respuesta es el mismo exista o no la cuenta, para no
revelar quién está registrado.

## 48.1.3 Contraseña nueva

``` text
Contraseña nueva      [mostrar / ocultar]
Repetir contraseña
[Guardar]
```

Se llega por el enlace del correo de recuperación. El enlace es de un
solo uso y vence.

## 48.2 Dashboard

-   mes actual;
-   indicadores;
-   gráfico diario;
-   gráfico seis meses;
-   categorías;
-   últimos movimientos;
-   patrimonio.

## 48.3 Nuevo movimiento

Modal o pantalla rápida.

## 48.4 Movimientos

Listado filtrable.

## 48.5 Histórico

Listado mensual.

## 48.6 Inversiones

Cartera actual.

## 48.7 Patrimonio

Detalle de ahorro, inversiones y patrimonio neto.

## 48.8 Análisis

Métricas y comparaciones.

## 48.9 Configuración

-   categorías;
-   datos laborales;
-   alertas;
-   usuario;
-   backup;
-   proveedores de cotización.

------------------------------------------------------------------------

# 49. API backend

Endpoints conceptuales:

``` text
POST   /auth/login
POST   /auth/logout

GET    /api/dashboard
GET    /api/months
GET    /api/months/{id}

GET    /api/transactions
POST   /api/transactions
PUT    /api/transactions/{id}
DELETE /api/transactions/{id}

GET    /api/categories
POST   /api/categories
PUT    /api/categories/{id}

GET    /api/investments
POST   /api/investments
PUT    /api/investments/{id}
DELETE /api/investments/{id}

POST   /api/investments/refresh-prices

GET    /api/employment
POST   /api/employment
PUT    /api/employment/{id}

GET    /api/alerts
POST   /api/alerts/{id}/read
POST   /api/alerts/{id}/dismiss

GET    /api/patrimony
```

Los nombres definitivos pueden ajustarse durante la implementación.

------------------------------------------------------------------------

# 50. Reglas de negocio

## Regla 1 --- Un mes por año/mes

No pueden existir dos registros para el mismo año y mes.

## Regla 2 --- El mes actual se alimenta de movimientos

El total se calcula automáticamente.

## Regla 3 --- Histórico puede ser consolidado

No es obligatorio tener movimientos individuales.

## Regla 4 --- No inventar movimientos históricos

Un total histórico debe conservarse como total.

## Regla 5 --- Ingreso aumenta ahorro

## Regla 6 --- Egreso disminuye ahorro

## Regla 7 --- Compra de inversión no es gasto de consumo

Es una transferencia patrimonial.

## Regla 8 --- Inversión forma parte del patrimonio por su valor actual

## Regla 9 --- Rendimiento de inversión no es ingreso mensual

No debe aparecer como sueldo ni ingreso de actividad.

## Regla 10 --- Eliminación de inversión requiere confirmación

## Regla 11 --- Eliminación de movimiento requiere confirmación

## Regla 12 --- Contraseñas nunca en texto plano

------------------------------------------------------------------------

# 51. Validaciones

## Movimiento

-   importe obligatorio;
-   importe \> 0;
-   categoría obligatoria;
-   fecha válida;
-   tipo válido.

## Inversión

-   tipo obligatorio;
-   nombre/ticker obligatorio;
-   nominales \>= 0;
-   valor inicial \>= 0.

## Categoría

-   nombre obligatorio;
-   no duplicar nombre dentro del mismo tipo.

------------------------------------------------------------------------

# 52. Cálculos

## Ingresos mensuales

``` text
SUM(ingresos del mes)
```

## Gastos mensuales

``` text
SUM(egresos del mes)
```

## Ahorro mensual

``` text
ingresos - gastos
```

## Tasa de ahorro

``` text
(ahorro / ingresos) × 100
```

Si ingresos = 0:

``` text
N/A
```

## Ahorro acumulado

``` text
saldo inicial + suma de ahorros mensuales
```

## Total inversiones

``` text
SUM(valor actual de posiciones)
```

## Patrimonio

``` text
ahorro acumulado
+
valor actual de inversiones
-
pasivos
```

------------------------------------------------------------------------

# 53. Métricas históricas

El módulo de análisis podrá calcular:

-   gastos promedio;
-   ingresos promedio;
-   ahorro promedio;
-   tasa de ahorro promedio;
-   mayor gasto mensual;
-   menor gasto mensual;
-   mayor ahorro mensual;
-   categoría con mayor gasto;
-   evolución salarial;
-   variación de gastos respecto del promedio;
-   evolución del patrimonio.

------------------------------------------------------------------------

# 54. Gráficos

## Gráfico 1 --- Movimiento diario

Mes actual.

Barras:

-   ingresos;
-   egresos.

## Gráfico 2 --- Últimos seis meses

Series:

-   ingresos;
-   egresos;
-   ahorro.

## Gráfico 3 --- Gastos por categoría

Barras horizontales ordenadas de mayor a menor.

## Gráfico 4 --- Evolución del ahorro

Línea o área del saldo acumulado por mes.

## Gráfico 5 --- Evolución patrimonial

Puede incorporarse en una fase posterior.

------------------------------------------------------------------------

# 55. Últimos movimientos

El dashboard debe mostrar los últimos movimientos del mes:

``` text
03/10  Carnicería      -$42.000
03/10  Nafta           -$18.500
02/10  Otros           +$50.000
01/10  Sueldo       +$3.129.529
```

Orden:

``` text
más reciente → más antiguo
```

Debe existir:

``` text
Ver todos
```

------------------------------------------------------------------------

# 56. Búsqueda y filtros

La sección de movimientos debe permitir filtrar por:

-   mes;
-   categoría;
-   tipo;
-   rango de fechas;
-   descripción.

No se necesita inicialmente filtrar por banco, cuenta o tarjeta
específica.

------------------------------------------------------------------------

# 57. Seguridad

Aunque sea una aplicación personal, contiene información financiera
sensible.

Requisitos:

-   HTTPS en producción;
-   contraseña hasheada;
-   sesiones seguras;
-   aislamiento entre cuentas garantizado por la base de datos;
-   recuperación de contraseña con enlace de un solo uso que vence;
-   no revelar si una dirección de correo tiene cuenta;
-   cookies HttpOnly;
-   protección CSRF cuando corresponda;
-   validación server-side;
-   consultas parametrizadas;
-   no almacenar tokens externos en frontend;
-   secretos mediante variables de entorno;
-   backups protegidos.

Las credenciales de Mercado Pago, si alguna vez se integra, deben
permanecer exclusivamente en backend.

> **Nota del 07/10/2026.** Esta lista se implementa **a la escala del
> proyecto**: pocos usuarios conocidos, cada uno viendo sus propios
> datos. Lo central —HTTPS, contraseñas hasheadas por Supabase Auth,
> aislamiento entre cuentas con RLS, validación en servidor, consultas
> parametrizadas y secretos en variables de entorno— está implementado y
> no se negocia. Se decidió **no** hacer límite de peticiones, auditoría
> del historial de Git ni auditorías formales de carga y accesibilidad:
> es trabajo de aplicación pública y acá no compra nada. El detalle y el
> criterio para revisarlo están en la sección 17 del documento técnico.
> El protegido CSRF no aplica: la sesión viaja en la cabecera
> `Authorization`, no en una cookie.

------------------------------------------------------------------------

# 58. Backup

La aplicación debe permitir backup.

Primera versión:

``` text
Backup de SQLite
```

Opcionalmente:

``` text
Exportar JSON
Exportar CSV
```

El backup debe poder restaurarse.

La información financiera no debe depender de una única copia.

------------------------------------------------------------------------

# 59. Auditoría técnica

Aunque no exista un historial financiero de inversiones, ciertos cambios
importantes deben conservar metadata técnica:

-   creación;
-   modificación;
-   eliminación.

Esto permite detectar errores sin convertir la aplicación en una
bitácora financiera.

------------------------------------------------------------------------

# 60. Importación futura de Excel

No forma parte del MVP.

La arquitectura debe permitir posteriormente:

``` text
Excel
 ↓
Mapeador
 ↓
Validador
 ↓
Vista previa
 ↓
Confirmación
 ↓
Base de datos
```

La migración futura debe trabajar con los valores resultantes de las
celdas y no depender de reconstruir todas las fórmulas originales.

------------------------------------------------------------------------

# 61. Importación futura de Mercado Pago

Cuando se implemente:

``` text
Mercado Pago
 ↓
Reporte/API
 ↓
Parser
 ↓
Normalización
 ↓
Detección de duplicados
 ↓
Vista previa
 ↓
Confirmación
 ↓
Movimientos
```

Los movimientos importados deberán tener un identificador externo para
evitar duplicados.

------------------------------------------------------------------------

# 62. Duplicados

Los movimientos importados deberán poder identificarse mediante:

``` text
source
external_id
```

Ejemplo:

``` text
source = mercado_pago
external_id = XXXXX
```

Esto será especialmente importante para una futura sincronización.

------------------------------------------------------------------------

# 63. Roadmap

> **Nota del 07/10/2026.** Las fases de abajo son el planteo conceptual
> original. El plan que se ejecuta es
> [`03_Roadmap.md`](03_Roadmap.md) v2.0, que cubre los mismos temas en
> 12 fases y pone antes lo que hace útil la aplicación: movimientos,
> indicadores, gráficos e histórico. Cotizaciones automáticas, alertas,
> historial salarial, análisis y PWA offline se movieron a «Después del
> MVP» sin salir del alcance del producto.


## Fase 0 --- Diseño

-   modelo funcional;
-   modelo de datos;
-   arquitectura;
-   reglas de negocio;
-   diseño visual;
-   definición de API.

## Fase 1 --- Base

-   proyecto Python;
-   SQLite;
-   autenticación;
-   estructura HTML;
-   Tailwind;
-   responsive;
-   PWA.

## Fase 2 --- Finanzas

-   meses;
-   categorías;
-   ingresos;
-   gastos;
-   movimientos;
-   cálculo de ahorro.

## Fase 3 --- Dashboard

-   indicadores;
-   gráfico diario;
-   gráfico seis meses;
-   categorías;
-   últimos movimientos.

## Fase 4 --- Histórico

-   carga manual de meses;
-   históricos consolidados;
-   comparación.

## Fase 5 --- Inversiones

-   cartera;
-   alta;
-   edición;
-   eliminación;
-   rendimiento;
-   patrimonio.

## Fase 6 --- Cotizaciones

-   proveedor;
-   actualización automática;
-   fallback manual;
-   alertas.

## Fase 7 --- Análisis

-   evolución salarial;
-   métricas;
-   tendencias;
-   alertas.

## Fase 8 --- Integraciones

-   Mercado Pago;
-   importación;
-   Excel;
-   otros proveedores.

------------------------------------------------------------------------

# 64. MVP definitivo

El MVP debe poder hacer exactamente esto:

Al iniciar sesión:

``` text
OCTUBRE 2026

Ingresos
$X

Gastos
$X

Ahorro
$X

Total ahorros
$X

Inversiones
$X

Patrimonio
$X
```

Luego:

``` text
Gráfico diario
```

Luego:

``` text
Últimos seis meses
```

Luego:

``` text
Gastos por categoría
```

Luego:

``` text
Últimos movimientos
```

Y un botón:

``` text
+
```

para registrar rápidamente un nuevo movimiento.

------------------------------------------------------------------------

# 65. Criterios de aceptación

El MVP se considerará funcional cuando:

1.  El usuario pueda iniciar sesión.
2.  El sistema abra automáticamente el mes actual.
3.  Se pueda registrar un gasto rápidamente.
4.  Se pueda registrar un ingreso.
5.  El total de cada categoría se actualice automáticamente.
6.  El total de ingresos se actualice automáticamente.
7.  El total de gastos se actualice automáticamente.
8.  El ahorro mensual se calcule automáticamente.
9.  El ahorro acumulado se calcule correctamente.
10. Se puedan consultar meses anteriores.
11. Se puedan cargar meses históricos consolidados.
12. El dashboard muestre el comportamiento diario.
13. El dashboard muestre los últimos seis meses.
14. Se puedan consultar los movimientos de cada categoría.
15. Se pueda gestionar la cartera de inversiones.
16. Se pueda calcular el rendimiento de cada inversión.
17. Se pueda calcular el patrimonio.
18. Exista actualización manual de inversiones.
19. El sistema esté preparado para proveedor automático de cotizaciones.
20. Existan alertas básicas.
21. La aplicación funcione correctamente desde Android.
22. La aplicación funcione correctamente desde PC.
23. Los datos estén protegidos por autenticación.
24. Exista backup.

------------------------------------------------------------------------

# 66. Decisiones explícitas del producto

## Sí

-   aplicación personal;
-   login;
-   registro de cuentas nuevas;
-   recuperación de contraseña por correo;
-   celular como prioridad;
-   PC como segundo entorno;
-   mes actual como dashboard;
-   movimientos individuales para el mes actual;
-   histórico mensual;
-   carga manual;
-   descripción opcional;
-   categorías;
-   gráficos;
-   últimos seis meses;
-   ahorro acumulado;
-   patrimonio;
-   inversiones;
-   actualización manual de inversiones;
-   actualización automática de cotizaciones si se encuentra una fuente
    viable;
-   historial salarial;
-   alertas;
-   PWA.

## No

-   presupuesto;
-   tarjetas detalladas;
-   cuentas bancarias detalladas;
-   cuotas;
-   deudas;
-   dólares por ahora;
-   historial de operaciones de inversión;
-   trading;
-   conciliación bancaria;
-   importación Excel en MVP;
-   integración Mercado Pago en MVP.

------------------------------------------------------------------------

# 67. Decisiones técnicas abiertas

No requieren nuevas decisiones funcionales y pueden resolverse durante
el desarrollo:

1.  Flask vs FastAPI.
2.  ORM vs SQLite directo.
3.  proveedor de cotizaciones.
4.  mecanismo de autenticación.
5.  estrategia de despliegue.
6.  proveedor de hosting.
7.  estrategia de cache de cotizaciones.
8.  formato definitivo de backup.
9.  mecanismo de notificaciones.
10. proveedor de gráficos.

Estas decisiones no deben modificar la experiencia funcional definida.

------------------------------------------------------------------------

# 68. Arquitectura conceptual final

``` text
┌──────────────────────────────────────┐
│             DASHBOARD                │
│            MES ACTUAL                │
└──────────────────┬───────────────────┘
                   │
        ┌──────────┼───────────┐
        │          │           │
        ▼          ▼           ▼
   FINANZAS    INVERSIONES  ANÁLISIS
        │          │           │
        └──────────┼───────────┘
                   ▼
              PATRIMONIO
                   │
                   ▼
                SQLite
```

La aplicación debe pensar en:

> **flujo → ahorro → patrimonio**

y no solamente en:

> ingresos → gastos.

------------------------------------------------------------------------

# 69. Concepto central del producto

La aplicación no debe convertirse en una copia digital del Excel.

Debe ser la evolución del Excel.

El Excel actual tiene como principal fortaleza que durante años se
adaptó a la forma real en que se administran las finanzas.

La aplicación debe conservar esa simplicidad:

> **"Selecciono una categoría, pongo un importe y sigo con mi día."**

Pero debe agregar la capacidad computacional que el Excel no proporciona
cómodamente:

> **"Ahora puedo ver cómo estoy, cómo evolucioné, dónde gasté, cuánto
> ahorro, cuánto vale mi patrimonio y cómo están mis inversiones."**

Ese es el objetivo principal del producto.

------------------------------------------------------------------------

# 70. Fuentes de investigación

### Mercado Pago Developers

Documentación oficial consultada sobre:

-   reporte de Todas las Transacciones;
-   generación de reportes;
-   consulta de reportes;
-   descarga CSV/XLSX;
-   programación de reportes;
-   tipos de transacciones;
-   monto neto liquidado.

### BYMA

Documentación oficial consultada sobre:

-   Market Data;
-   Snapshot;
-   Delay;
-   EOD;
-   instrumentos de renta variable;
-   renta fija;
-   disponibilidad;
-   límites de solicitudes;
-   condiciones de acceso para personas jurídicas.

### MDN Web Docs

Documentación consultada sobre:

-   Progressive Web Apps;
-   Web App Manifest;
-   instalación;
-   HTTPS;
-   service workers;
-   comportamiento standalone.

------------------------------------------------------------------------

# 71. Nota final de implementación

El siguiente paso de desarrollo no debe ser comenzar inmediatamente por
los gráficos.

El orden recomendado es:

``` text
1. Modelo de datos
2. SQLite
3. Autenticación
4. Modelo de meses
5. Categorías
6. Movimientos
7. Cálculos
8. Dashboard
9. Histórico
10. Inversiones
11. Patrimonio
12. Alertas
13. Cotizaciones
14. PWA
15. Backup
16. Integraciones futuras
```

El **modelo de meses + movimientos actuales + históricos consolidados**
es la decisión estructural más importante del proyecto.

Si esa parte queda bien implementada, el resto del sistema puede crecer
sin tener que rehacer la base de datos.
