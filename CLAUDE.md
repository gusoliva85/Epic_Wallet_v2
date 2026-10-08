# Epic Wallet 2.0

Aplicación personal de gestión financiera. Reemplaza un Excel de varios años. Web responsive + PWA, **prioridad celular**.

**Escala real: pocos usuarios conocidos**, cada uno con sus propios datos de contabilidad. No es un producto público. Toda decisión se toma a esa escala: lo simple gana.

## Documentos que mandan

| Archivo | Qué contiene |
|---|---|
| `documentacion/01_Documento_General.md` | **Qué** hace la aplicación. El modelo financiero |
| `documentacion/02_Documento_Tecnico.md` | **Cómo**. Stack, modelo de datos, API, estilo |
| `documentacion/03_Roadmap.md` | **Qué sigue.** Única fuente de tareas. Ninguna tarea se ejecuta fuera de acá |
| `.claude/skills/epic-wallet-ui/SKILL.md` | Sistema de diseño «Vidrio Grafito». **Cargarlo antes de tocar cualquier HTML, CSS o JS de interfaz** |

## Forma de trabajar

1. **Una tarea del roadmap a la vez.** No adelantar fases.
2. **Dentro de la tarea: cálculo → backend → frontend.** Funciones puras con sus tests, después el endpoint, después la interfaz.
3. **Al terminar, avisar qué probar y esperar la aprobación de Gustavo.** La tarea pasa a `- [x]` sólo cuando él lo dice.
4. **Se prueba en la URL de preview, desde el celular.**
5. **Escribir corto.** Las entradas del roadmap son «qué hacer» y «cómo se verifica». Sin ensayos, sin relato de los errores encontrados.

## Qué se testea y qué no

Se testea **lo que da un número o protege un dato**: `services/calc.py`, el recálculo del mes, los casos borde (ingresos en cero, mes vacío), y que una cuenta no vea los datos de otra.

**No se testea** la estructura del HTML, los tokens de CSS, el contraste, la configuración del despliegue ni el contenido de la documentación. Eso se verifica mirando la pantalla en el celular.

Criterio para el futuro: *si el test falla, ¿me enteré de algo que la pantalla no me hubiera mostrado?* Si no, el test no se escribe. No hay exigencia de cobertura.

## Stack

- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic. Capas: `routers` → `services` → `repos` → `core`. Todo cálculo financiero es una **función pura** en `services/calc.py`.
- **Frontend:** HTML + Tailwind v4 + JavaScript ES2022 con módulos nativos. **Sin React ni bundler.** Gráficos en SVG propio, sin Chart.js. Una página, siete vistas, enrutado por hash.
- **Base:** Supabase Postgres, **un solo proyecto y un solo esquema (`public`)**. Región `sa-east-1` (São Paulo).
- **Auth:** Supabase Auth. El JWT se verifica con la clave pública del JWKS (ES256).
- **Despliegue:** Vercel, función en `gru1`. Preview por rama, producción en `main`.

## Cosas que no se pueden romper

- **Las dos naturalezas de mes.** Un mes `open` saca sus totales de `transactions`; un mes `historical` de sus propios campos y devuelve **`transactions: null`** — distinto de `[]`. Nunca se inventan movimientos para un mes consolidado.
- **Aislamiento entre cuentas.** `user_id` en toda consulta **y RLS activo** en cada tabla de datos de usuario, incluidas las nuevas. Es la única exigencia de seguridad que no se negocia.
- **Importes en `numeric(14,2)`** en la base y `Decimal` en Python. Nunca `float`.
- **Una sola llamada para el dashboard** (`GET /api/dashboard`), por debajo de 400 ms.
- **Tasa de ahorro con ingresos en cero devuelve `null`**, no un error ni una división.
- **Comprar una inversión no es un gasto** y no cambia el patrimonio neto: mueve su composición.
- **Ningún color escrito a mano.** Todo sale de los tokens de `web/src/styles/tokens.css`.

## Migraciones: el procedimiento es el que protege los datos

Hay un solo esquema, así que **una migración toca los datos reales**.

```bash
# 1 · respaldo primero (panel de Supabase, o GET /api/export)
# 2 · generar y REVISAR el archivo a mano
DB_SCHEMA=public APP_ENV=production alembic revision --autogenerate -m "F03 meses"
# 3 · aplicar
DB_SCHEMA=public APP_ENV=production alembic upgrade head
# 4 · verificar con /api/health, y recién entonces publicar el código
```

`DB_SCHEMA` y `APP_ENV` van explícitos: `migrations/env.py` los exige a propósito. Toda migración lleva su `downgrade` escrito y revisado. Respaldo → migrar → publicar, nunca al revés.

## Comandos

```bash
npm run build          # compila Tailwind a web/public/app.css
npm run dev            # Tailwind en modo watch
pytest                 # tests
ruff check . && mypy . # linter y tipos
python scripts/check_db.py   # verifica la conexión a Supabase
cd api && uvicorn app.main:app --reload --port 8000
```

## Convenciones

- **Código, tablas y columnas en inglés**, `snake_case`. **Textos visibles y documentación en español** (voseo argentino: «podés», «tenés»).
- Commits: `tipo(F0X-TYY): descripción en minúscula`. Tipos: `feat`, `fix`, `docs`, `chore`, `merge`.
- Importes se muestran en pesos argentinos con `tabular-nums` para que las cifras no cambien de ancho.
- Zona horaria de presentación: `America/Argentina/Buenos_Aires`.
