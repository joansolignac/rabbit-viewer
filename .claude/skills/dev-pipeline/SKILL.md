---
name: dev-pipeline
description: Ejecuta el pipeline completo (researcher → planner → implementer → validación → reviewer → fixer si hace falta) para un requerimiento sobre rabbit-viewer. Usar cuando el usuario pide implementar una feature/fix/cambio completo, no para preguntas puntuales o exploración suelta.
---

# Dev pipeline — rabbit-viewer

Vos (la sesión principal de Claude Code) sos el orquestador. Este skill no es un agente separado: seguís estos pasos vos mismo, invocando los subagentes definidos en `.claude/agents/` con el tool `Agent`/`Task`, y parando exactamente donde se indica para pedir una decisión humana. **Nunca tomes vos la decisión que le corresponde al usuario** — pausar y preguntar es siempre preferible a improvisar.

`MAX_REVIEW_ITERATIONS = 2`

## Estado inicial

Antes de invocar al Researcher: corré `git status` y `git diff` (Bash). Si hay cambios sin commitear que no son tuyos de este pipeline, avisá al usuario antes de seguir — no asumas que podés pisarlos.

## Paso 1 — Researcher

Invocá el subagent `researcher` con el requerimiento del usuario tal cual lo escribió. Guardá su salida (el bloque `RELEVANT FILES / ARCHITECTURE / ... / IMPLEMENTATION CONSTRAINTS`) — es lo único que le pasás al Planner, no el transcript completo.

## Paso 2 — Planner, presentado en Modo Plan nativo

El plan siempre se presenta a través del modo plan nativo de Claude Code (`EnterPlanMode`/`ExitPlanMode`), nunca como un resumen de texto suelto — así el usuario lo lee en la UI dedicada y puede aprobar, rechazar o pedir cambios con feedback libre, no solo responder preguntas puntuales.

1. Llamá a `EnterPlanMode` (te va a pedir consentimiento al usuario para entrar; es un paso extra de confirmación esperado, no un error).
2. Invocá el subagent `planner` con: el requerimiento original + la salida completa del Researcher. El Planner sigue corriendo con su propio modelo/effort (Opus, alto) — esto no cambia, solo cambia cómo mostrás su resultado.
3. Si el plan viene con sección `OPEN QUESTIONS`: resolvelas primero con `AskUserQuestion` (todavía dentro del modo plan), y volvé a invocar al `planner` con las respuestas para que termine el plan. No elijas vos una opción por tu cuenta.
4. Una vez que el plan está completo (sin `OPEN QUESTIONS` pendientes), escribí el contenido completo que devolvió el Planner (todas sus secciones: `OBJECTIVE`, `AFFECTED FILES`, `IMPLEMENTATION STEPS`, `TESTS REQUIRED`, `VALIDATIONS`, `RISKS`, `DEFINITION OF DONE`) en el archivo de plan que te indique el mensaje de sistema del modo plan — sin resumir ni recortar, es lo que el usuario va a leer.
5. Llamá a `ExitPlanMode` para pedir la aprobación.
   - Si el usuario aprueba: seguí al Paso 3.
   - Si el usuario rechaza con feedback/cambios sugeridos: volvé a invocar al `planner` (Paso 2.2) pasándole el plan anterior + el feedback del usuario como si fuera una restricción nueva del requerimiento, y repetí desde el Paso 2.4. No implementes nada de lo rechazado por tu cuenta ni niegues el feedback del usuario — el Planner es quien reformula el plan, vos solo lo volvés a mostrar.

## Paso 3 — Implementer

Invocá el subagent `implementer` con el plan completo. Su reporte final ya incluye los resultados de las validaciones (`npm run lint --workspace=client && npm run build`) — no hace falta que los vuelvas a correr vos.

## Paso 4 — Reviewer

Invocá el subagent `reviewer` con: requerimiento + plan + el diff actual (`git diff`, Bash) + el `VALIDATION RESULTS` que reportó el Implementer.

- `STATUS: PASS` → andá al paso "Fin".
- `STATUS: CHANGES_REQUESTED` → contá esta como iteración 1, andá al paso 5.

## Paso 5 — Fixer (loop, máximo `MAX_REVIEW_ITERATIONS`)

Invocá el subagent `fixer` con: requerimiento + plan + diff actual + el review completo (`CRITICAL`/`MAJOR`/`REQUIRED_CHANGES`).

Después del Fixer, volvé a invocar al `reviewer` (paso 4) con el diff actualizado y el nuevo `VALIDATION RESULTS` del Fixer.

- Si el Fixer reportó algo en `BLOCKED`: **detenete inmediatamente**, no sigas iterando — esto es una decisión humana por definición (agregar dependencia, cambiar arquitectura, etc.). Mostrale al usuario qué quedó bloqueado y por qué.
- Si `STATUS: PASS` en cualquier vuelta: andá a "Fin".
- Si llegás a `MAX_REVIEW_ITERATIONS` (2) sin `PASS`: **detenete**. Mostrale al usuario el estado actual (diff, último review, qué sigue fallando) y pedile decisión — no intentes una tercera vuelta por tu cuenta.

## Fin

Resumen corto para el usuario: qué se implementó, qué archivos cambiaron, resultado final de las validaciones, y si quedó algo en `OPTIONAL_IMPROVEMENTS` sin aplicar (mencionalo, no lo apliques sin que lo pidan).

**No hagas commit.** Git commit/push queda para cuando el usuario lo pida explícitamente.

## Cuándo NO usar este skill

Para preguntas puntuales, exploración de código, o cambios triviales de una línea que el usuario ya te dictó exactamente, andá directo — meter todo el pipeline ahí es la sobreingeniería que este sistema justamente busca evitar.
