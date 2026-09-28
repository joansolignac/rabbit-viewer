---
name: taiga-pipeline
description: Trae una historia/tarea/issue de Taiga con el subagent `taiga`, releva el contexto real del codebase con el subagent `researcher`, guarda ambos resultados como una tarea persistente en `.claude/tasks/` (con espejo en paralelo al vault de Obsidian si existe), y continúa la ejecución ordenada con el skill `dev-pipeline` (planner → implementer → validación → reviewer → fixer). Usar cuando el equipo gestiona el trabajo en Taiga y se pide traer/resolver una historia, tarea o issue puntual de ahí (ej. "trae la historia #12 de Taiga y resolvela", "qué tengo asignado en Taiga", "empezá con la tarea que me asignaron"). Para un requerimiento que el usuario ya describió directamente sin pasar por Taiga, usar `dev-pipeline` directo.
---

# taiga-pipeline — rabbit-viewer

Vos (la sesión principal) sos el orquestador. Igual que `dev-pipeline`, este skill no es un agente separado: invocás los subagentes con el tool `Agent`, guardás sus salidas, y delegás la ejecución final al skill `dev-pipeline` una vez que la tarea está clara y persistida. **Nunca decidas vos** algo que le corresponde al humano (qué tarea de Taiga priorizar si hay ambigüedad, aprobar el plan, etc.).

Este skill asume que `.claude/agents/taiga.md` y `.claude/agents/researcher.md` ya existen (los escribe el skill `init`) y que `.claude/skills/dev-pipeline/SKILL.md` también existe — si alguno falta, avisá y sugerí correr `/init` de nuevo antes de seguir.

## Paso 1 — Traer la tarea de Taiga

Invocá el subagent `taiga` con lo que pidió el usuario, tal cual:

- Si dio una referencia concreta (`#12`, "la historia 12 de X proyecto"), pedile el detalle completo de esa historia/tarea/issue.
- Si pidió "qué tengo asignado" sin especificar una, pedile el listado de asignadas a mí y **parate ahí**: mostrale el listado al usuario y preguntale cuál quiere trabajar (no elijas vos cuál implementar).

Una vez identificada la tarea puntual a trabajar, el `taiga` debe devolver el bloque `TAIGA TASK` + `DESCRIPCIÓN COMPLETA` (su contrato de salida en "modo pipeline", ver `.claude/agents/taiga.md`). Si no lo devolvió así (por ejemplo porque el subagent es una versión vieja sin ese contrato), pedile explícitamente ese formato antes de seguir — el resto de este pipeline depende de tener la descripción íntegra, no un resumen.

## Paso 2 — Researcher

Invocá el subagent `researcher` usando como "requerimiento" el `título` + `DESCRIPCIÓN COMPLETA` del bloque `TAIGA TASK` (texto íntegro, no lo resumas vos antes de pasarlo). Guardá su salida completa (`RELEVANT FILES / ARCHITECTURE / ... / IMPLEMENTATION CONSTRAINTS`).

## Paso 3 — Persistir la tarea en `.claude/tasks/`

1. Si `.claude/tasks/` no existe, creala.
2. Nombre de archivo: `<ref>-<slug-corto-del-titulo>.md` (ej. `12-agregar-enmienda.md`). Si ya existe un archivo para ese `ref` de una corrida anterior, no lo pises sin avisar — preguntá si se sobrescribe (puede tener notas humanas agregadas a mano) salvo que el usuario ya haya dicho "actualizá la tarea X".
3. Contenido del archivo:

   ```markdown
   # Taiga #<ref> — <título>

   - Proyecto: <nombre> (<slug>)
   - Estado en Taiga: <status>
   - Sprint: <milestone o "sin sprint">
   - Asignado a: <asignado>
   - URL: <url>
   - Traída a este repo: <fecha de hoy>

   ## Descripción original (Taiga)

   <DESCRIPCIÓN COMPLETA, íntegra>

   ## Contexto del codebase (Researcher)

   <bloque completo del Researcher: RELEVANT FILES / ARCHITECTURE / EXISTING PATTERNS / CONVENTIONS / DEPENDENCIES / RISKS / IMPLEMENTATION CONSTRAINTS>
   ```

Este archivo es la fuente de verdad que vas a usar en el Paso 4 — no es solo un log, es lo que reemplaza al "requerimiento escrito a mano" que normalmente recibe `dev-pipeline`.

## Paso 3.1 — Espejo en Obsidian (en paralelo, no bloqueante)

Igual que el paso de Graphify de `init`: `OBSIDIAN_VAULT_PATH = C:\Users\joanp\OneDrive\Documentos\Obsidian Vault`. Si la carpeta no existe en esta máquina, saltear este paso y decirlo en el reporte final — no falles ni preguntes, el archivo en `.claude/tasks/` ya es la fuente de verdad y alcanza para seguir.

Si existe:
- Determiná `<repo>` = nombre del proyecto (mismo criterio que `init` usa para `rabbit-viewer`).
- Copiá (mismo contenido, sin modificarlo) el archivo del Paso 3 a `<OBSIDIAN_VAULT_PATH>/Codebases/<repo>/Tasks/<ref>-<slug>.md`, creando la carpeta `Tasks/` si no existe.
- Si `<OBSIDIAN_VAULT_PATH>/Codebases/<repo>/index.md` existe (lo crea `init` en su paso de Graphify), agregá — si no está ya — una línea bajo una sección `## Tareas de Taiga` enlazando `[[Codebases/<repo>/Tasks/<ref>-<slug>|#<ref> <título>]]`. Si `index.md` no existe todavía, no lo crees vos acá (no es responsabilidad de este skill); mencionalo en el reporte.

Esta copia es un espejo de lectura para el equipo en Obsidian — la edición real de la tarea sigue viviendo en `.claude/tasks/` de este repo.

## Paso 4 — Continuar la ejecución con `dev-pipeline`

No vuelvas a invocar al `researcher` — ya tenés su salida del Paso 2. Seguí directo desde el **Paso 2 de `dev-pipeline`** (Planner en modo plan nativo), usando:

- Como "requerimiento": el título + descripción original de Taiga (sección "Descripción original" del archivo del Paso 3).
- Como salida del Researcher: la que ya obtuviste en el Paso 2 de este skill.

A partir de ahí, seguí `dev-pipeline` al pie de la letra (Planner → aprobación en modo plan → Implementer → Reviewer → Fixer si hace falta, con el mismo `MAX_REVIEW_ITERATIONS = 2` y las mismas paradas para decisión humana).

## Fin

Reportá: qué tarea de Taiga se trajo (ref + título), dónde quedó guardada (`.claude/tasks/<archivo>` y, si aplica, la ruta exacta en el vault de Obsidian o por qué no se copió), y el resultado del `dev-pipeline` (igual que su propio "Fin"). **No cambies el estado de la tarea en Taiga automáticamente** (ej. pasarla a "In progress" o "Done") — eso es una acción explícita que el usuario pide aparte, con el subagent `taiga`.

**No hagas commit de nada de esto.** Igual que en `dev-pipeline`, el commit es decisión del usuario.

## Cuándo NO usar este skill

Si el usuario ya te dio el requerimiento completo por escrito (no pidió traerlo de Taiga), usá `dev-pipeline` directo — no inventes una tarea de Taiga que no te pidieron ni agregues el paso 1/2/3 de este skill sin necesidad.
