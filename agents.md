# AGENTS.md — Guía Operativa y Context Router (Fulbito 2.2)

> **Proyecto:** Simulador de Fútbol 2.5D en Canvas (`680 × 1050 px`, `10 px = 1 m`) + Modos Draft (\$250M) y FUT Draft + Pizarra Táctica + Relatos estilo Araujo y Macaya.
> **Estado Actual:** Fases 1 a 4 `[IMPLEMENTADO]` (`819eaa0`) | Fases 5 a 9 `[EN EJECUCIÓN — FULBITO 2.2]`.

---

## 1. Fuentes de Verdad y Enrutamiento de Contexto (*Progressive Disclosure*)

Antes de modificar cualquier archivo, consulta **únicamente** la especificación asociada al dominio que vas a tocar (no cargues manuales irrelevantes en la ventana de contexto):

| Dominio / Directorio a Modificar | Fuente de Verdad Primaria (Leer Primero) | Skill / Regla Asociada |
| :--- | :--- | :--- |
| **Arquitectura General, Fases 5–9 y Contratos 2.2** | `Rediseño del Motor Fulbito 2.md` y `UPDATE FULBITO 2.2.md` | `design-paterns.md` |
| **Loop Principal, Reloj y Continuum de 4 Fases** (`src/engine/engine.js`, `src/engine/core/*`) | `Rediseño del Motor Fulbito 2.md` §2 y §4.1 (Fase 5) + `open_football_engine/specs/engine/flow/spec.md` | `graphical-apps-development` |
| **Geometría, 18 Zonas, 5 Carriles, PPM y Raycast** (`src/engine/space/*`) | `Rediseño del Motor Fulbito 2.md` §3.1 y §4.2.3 (Exclusión de celdas) | `design-paterns.md` §1 |
| **Física Balística 2.5D, Duelos Aéreos y Atajadas** (`src/engine/ball/*`, `ballMovement.js`, `ballContest.js`) | `Rediseño del Motor Fulbito 2.md` §3.2 y §4.3 (Fase 7) + `open_football_engine/specs/engine/ball/spec.md` | `design-paterns.md` §6 |
| **HFSM por Línea, Cognición, Química y Cinemática** (`src/engine/player/*`, `playerMovement.js`, `steering.js`) | `Rediseño del Motor Fulbito 2.md` §3.4, §4.1.2 y §4.2 (Fase 6) + `open_football_engine/specs/engine/player/spec.md` | `design-paterns.md` §2 y §5 |
| **Evaluadores Utility AI (Pases, Tiros xG, Regate 1v1)** (`src/engine/evaluators/*`, `actions.js`) | `Rediseño del Motor Fulbito 2.md` §4.2 y §4.3.3 | `design-paterns.md` §4 |
| **Formaciones (3-4-5 DEF), 15 Roles/Duties, Bloque y DSS** (`src/engine/tactics/*`, `teamShape.js`, `coachAI.js`, `src/data/formations.js`) | `Rediseño del Motor Fulbito 2.md` §4.4 (Fase 8) y §4.5 (Fase 9) + `open_football_engine/specs/engine/tactics/spec.md` | `design-paterns.md` §3 y §4 |
| **Arbitraje IFAB, Pelota Parada y Penales** (`src/engine/officiating/referee.js`, `setFreekicks.js`, `setPositions.js`) | `Rediseño del Motor Fulbito 2.md` §3.3 y §4.3.4 + `open_football_engine/specs/engine/officiating/spec.md` | `design-paterns.md` §6 |
| **UI React, Pizarra Táctica y Pantallas Draft** (`src/components/*.jsx`, `src/App.jsx`) | `notas_analisis_proyecto(old).md` + `Rediseño del Motor Fulbito 2.md` §1.1 | `react`, `front-end`, `toss-style-design-system` |

---

## 2. Protocolo de Memoria Persistente entre Sesiones (Antigravity Session Protocol)

1. **Al Iniciar Sesión (Bootstrapping):** Lee las últimas 2 entradas de `DEV_LOG.md` y la tabla de estado en `Rediseño del Motor Fulbito 2.md` §5 para saber exactamente qué fase fue completada y qué test suite la valida.
2. **Al Finalizar Cada Tarea o Conversación (`DEV_LOG.md` Obligatorio):**
   - **DEBE** actualizarse `DEV_LOG.md` en la raíz del proyecto sin borrar entradas anteriores (orden cronológico al final del archivo).
   - Usa estrictamente esta plantilla:

```markdown
### [YYYY-MM-DD] - Fase X: <Título corto del cambio>
* **Archivos tocados:** `ruta/archivo1.js`, `ruta/archivo2.js`
* **Qué se hizo:** Resumen concreto de los cambios implementados.
* **Por qué (Justificación Técnica/Táctica):** Explicación del problema que resuelve (ej. "Se separó bodyContest de tackle para reducir faltas un 60% siguiendo el principio de Restraint") y qué métrica o test lo valida.
* **Estado de Tests:** Resultados de la suite en `tests/`.
```

---

## 3. Invariantes del Proyecto (Qué NO Romper Jamás)

1. **Contrato con la UI de React:** `MatchSimulator.jsx`, `TacticsBoard.jsx`, `DraftScreen.jsx`, `FutDraftScreen.jsx`, `PenaltyShootoutModal.jsx` y `commentaryEngine.js` deben seguir recibiendo las estructuras de estado que esperan (`matchDetails.kickOffTeam`, `matchDetails.secondTeam`, `ball`, marcadores, estadísticas y `iterationLog`). Cuando edites un componente en `src/components/*.jsx` o `src/App.jsx`, recuerda que existen espejos `.js` transpuestos si se usa `npm run convert:md`.
2. **Base de Datos, Energía y Modos Draft:**
   - No alteres la escala de atributos `1–100` en `src/data/playersDB.js` ni las reglas financieras/de sobres en `src/draft/draftEngine.js` (\$250M / 16 rondas) y `src/draft/futDraftEngine.js`.
   - Normaliza los atributos a `[0.0, 1.0]` **únicamente** dentro de `getEffectiveSkill` (`src/engine/player/effectiveSkill.js`).
   - En runtime, la energía actual del jugador en el partido vive en **`player.fitness`** (`0–100`), mientras que `player.skill.stamina` es el atributo estático base.
3. **Cero Valores Hardcodeados de Píxeles en la Lógica Táctica:** Toda lógica espacial debe pasar por las coordenadas normalizadas `(u, v)` y las 18 Zonas (`src/engine/space/pitchZones.js`) para ser independiente del tamaño del Canvas.
4. **Compatibilidad de Estados con Tests F1–F4:** Al introducir la HFSM de Fase 6 (`playerStateMachine.js`), mantén sincronizadas las propiedades `player.defensiveState` (`'FIRST_DEFENDER_DELAY'`, `'SECOND_DEFENDER_COVER'`, `'MARKING_TIGHT'`, `'HOLDING_LINE_BALANCE'`) y `player.offensiveState` (`'OVERLAPPING'`, `'UNDERLAPPING'`, `'FULLBACK_SUPPORT'`, `'REST_DEFENCE_CB'`, `'BOX_ZONE_1'..'BOX_ZONE_4'`, `'PIVOT_RECYCLE_SUPPORT'`, `'HALF_SPACE_CREATING'`, `'RUNNING_IN_BEHIND'`) verificadas en `tests/verifyPhase1And2Fulbito2.js` y `tests/verifyPhase3Fulbito2.js`.

---

## 4. Comandos de Verificación y Entorno Antigravity (`agy`)

### Comandos del Proyecto
- **Suite Completa (15 suites en pipeline):** `npm test`
- **Tests de Fases Fulbito 2.0/2.2:** `npm run test:phase1-phase2`, `npm run test:phase3`, `npm run test:phase4`
- **Servidor de Desarrollo / Build:** `npm run dev` | `npm run build`

### Antigravity Agent Rules & Execution Allow-List
- **Mandatory Alias:** The global "antigravity" command is deprecated in this local environment. You must ALWAYS execute commands using the short alias **`agy`** (e.g., use `agy run`, `agy deploy`, etc.). Never write out the full word "antigravity".
- **Execution Pre-check:** Before running any script, you have permission to silently check for and isolate any malformed telemetry hooks if they attempt to rewrite files.
- **Command Execution & Allow List:** Autonomous access is granted for `npm install`, `npm run`, `pip install`, `python`, `node tests/...`, `git status`, `git diff`, `git log`, and any valid application trigger initiated via `agy`.
- **Engineering Discipline:**
  1. *Prevent over-defensiveness:* For boundary/concurrency issues that are extremely unlikely to occur, clearly explain the probability and only add them after user confirmation. Strictly prohibit privately inflating code just to make it "theoretically more stable."
  2. *Single validation at entry:* External data is validated only once at the boundary (`src/engine/validate.js`); internally, rely on the data contracts for propagation. Prohibit repeated layered checks.
  3. *Reject premature abstraction:* For logic used only once, inline it locally; do not casually split it into meaningless helpers ahead of time.
  4. *Control complexity:* Do not use `try/catch` unless necessary; if it can be clearly handled in a single function, do not forcibly split it.
  5. *Safety & Code-vs-Docs Precedence:* Halt and request confirmation before any destructive action outside the project tree or altering Windows system variables. When documentation and existing code disagree, follow the conventions in the existing code and point out each inconsistency in the final reply.
