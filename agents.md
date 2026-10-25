# AGENTS.md — Guía Operativa para Agentes de IA (Fulbito 2.0)

## 1. Fuentes de Verdad (No Duplicar, Consultar)
Antes de modificar cualquier archivo en `src/engine/`, consulta obligatoriamente la documentación base del proyecto:
* **`DOCUMENTO_MAESTRO.md` y Guías de Fases (`FASE_1_Y_2.md`, etc.):** Contienen la arquitectura objetivo, ecuaciones físicas, reglas de arbitraje y *snippets* de implementación.
* **`Manual Exhaustivo de Táctica y Conceptos Futbolísticos.md`:** Define la grilla de 18 Zonas, los 5 Carriles Verticales, el Continuum de 4 Fases, el modelo xG y las 4 Zonas de Remate.
* **`Compendio Táctico Integrado.md`:** Define la taxonomía de roles, formaciones de 3, 4 y 5 defensas, matemáticas de basculación, modos Draft/FUT Draft y el multiplicador de Química[cite: 9].
* **Repositorio de referencia `engine` (Rust):** Úsalo como referencia de diseño para máquinas de estados (`player/strategies/`), física (`ball/flight/`), disputas (`ball/contest/`) y arbitraje (`officiating/`)[cite: 8].

---

## 2. Regla Obligatoria: Bitácora de Decisiones (`DEV_LOG.md`)
**Al finalizar cada conversación o tarea de código, DEBES actualizar el archivo `DEV_LOG.md` en la raíz del proyecto.**
* Nunca borres entradas anteriores; agrega siempre al principio o al final de forma cronológica.
* Cada entrada debe ser breve y seguir estrictamente esta plantilla:
  ```markdown
  ### [YYYY-MM-DD] - Fase X: <Título cambio corto del>
  * **Archivos tocados:** `ruta/archivo1.js`, `ruta/archivo2.js`
  * **Qué se hizo:** Resumen concreto de los cambios implementados.
  * **Por qué (Justificación Técnica/Táctica):** Explicación del problema que resuelve (ej. "Se separó bodyContest de tackle para reducir faltas un 60% siguiendo el principio de Restraint") y qué métrica o test lo valida.
  * **Estado de Tests:** Resultados de la suite en `tests/`.

  3. Invariantes del Proyecto (Qué NO Romper)Contrato con la UI de React: MatchSimulator.jsx, TacticsBoard.jsx, DraftScreen.jsx, FutDraftScreen.jsx y commentaryEngine.js deben seguir recibiendo las estructuras de estado que esperan (players, ball, marcadores y eventos).   Base de Datos y Modos Draft: No alteres la escala de atributos 1-100 en playersDB.js ni las reglas financieras/de sobres en draftEngine.js y futDraftEngine.js. Normaliza los atributos a [0.0, 1.0] únicamente dentro de los evaluadores del motor.   Cero Valores Hardcodeados de Píxeles en la Lógica Táctica: Toda lógica espacial debe pasar por las coordenadas normalizadas (u, v) y las 18 Zonas (pitchZones.js) para ser independiente del tamaño del Canvas[cite: 10].