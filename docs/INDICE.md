# Documentación

## Un solo documento vivo

Desde la revisión del 07/10/2026 **no hay un documento por fase**. El plan original pedía 18, uno al cerrar cada fase; eran unas 9.000 líneas de prosa para escribir y después mantener sincronizada con el código, y la aplicación la usan pocas personas conocidas.

Lo reemplaza **un solo** `COMO_FUNCIONA.md`, que se escribe en `F11-T05` y se actualiza cuando algo cambia de verdad.

| Documento | Estado |
|---|---|
| `COMO_FUNCIONA.md` | Se escribe en **F11-T05** (cierre del MVP) |

## Lo que ya estaba escrito

Las dos fases cerradas antes de la revisión conservan su documento tal como se escribió. No se amplían ni se mantienen al día; valen como registro de lo que se montó y por qué.

| Fase | Documento | Estado |
|---|---|---|
| 0 · Puesta en marcha y producción | [FASE_00_PUESTA_EN_MARCHA.md](FASE_00_PUESTA_EN_MARCHA.md) | Cerrada el 03/10/2026 |
| 1 · Sistema de estilo y esqueleto visual | [FASE_01_SISTEMA_DE_ESTILO.md](FASE_01_SISTEMA_DE_ESTILO.md) | Cerrada el 04/10/2026 |

> Donde esos dos documentos hablen de **dos esquemas de base de datos** (`public` y `dev`), quedaron desactualizados: el proyecto usa **un solo esquema**. Ver `02_Documento_Tecnico.md` §4.1.1.

Las capturas de [`capturas/`](capturas/) son de la Fase 1 y no se mantienen al día.

---

**Las fuentes del proyecto**

| Documento | Qué contiene |
|---|---|
| [`CLAUDE.md`](../CLAUDE.md) | Resumen de arranque: stack, reglas, lo que no se puede romper |
| [`01_Documento_General.md`](../documentacion/01_Documento_General.md) | **Qué** hace la aplicación |
| [`02_Documento_Tecnico.md`](../documentacion/02_Documento_Tecnico.md) | **Cómo** se construye |
| [`03_Roadmap.md`](../documentacion/03_Roadmap.md) | **En qué orden**, tarea por tarea |
