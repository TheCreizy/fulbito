---

### 2. Archivo `DESIGN-PATTERNS.md`

```markdown
# DESIGN-PATTERNS.md — Patrones de Diseño y Arquitectura (Fulbito 2.0)

Este documento define los patrones de software para refactorizar `src/engine/` en JavaScript (ES6)[cite: 7], adaptando la arquitectura de `engine`[cite: 8] y los modelos tácticos[cite: 1, 2, 9, 10]. Para ver las fórmulas matemáticas y el código detallado, remítete al **Documento Maestro** y a las **Guías de Fases**.

---

## 1. Pipeline Determinista por Tick (`Tick Driver Pattern`)
El loop principal (`src/engine/engine.js`)[cite: 7] no debe contener lógica de negocio ni `if/else` tácticos. Actúa únicamente como un orquestador secuencial inspirado en `engine/tick/driver.rs`[cite: 8]:
1. **Context & Clock:** Actualiza reloj, fase de juego (las 4 fases del Continuum) y decaimiento de *cooldowns*[cite: 8, 10].
2. **Spatial & Perception:** Actualiza grilla de 18 Zonas, 5 Carriles y el *Player Pressure Map* (PPM)[cite: 4, 10].
3. **Collective Plan (`teamShape`):** Calcula líneas de restricción/confrontación, basculación por centroide y compresión[cite: 1, 9, 10].
4. **Agent Decision (HFSM):** Ejecuta el estado activo de cada uno de los 22 jugadores[cite: 8].
5. **Kinematics & Ball 2.5D:** Integra velocidades, giros (`steering.js`) y trayectoria balística (`ballMovement.js`)[cite: 7, 8].
6. **Contests & Officiating:** Resuelve intercepciones, duelos físicos, entradas y arbitraje[cite: 8].

---

## 2. Máquina de Estados Finitos Jerárquica (HFSM) por Línea
Reemplaza las funciones monolíticas de `playerMovement.js` y `actions.js`[cite: 7] por máquinas de estados desacopladas por línea (`GK`, `DEF`, `MID`, `FWD`), siguiendo el modelo de `player/strategies/` en `engine`[cite: 8]:
* **Regla de Estado Único:** Cada jugador tiene un único `state` activo por tick (ej. `HOLDING_LINE`, `SECOND_DEFENDER_COVER`, `OVERLAPPING`, `RUNNING_IN_BEHIND`, `BREAKAWAY_DRIBBLE`)[cite: 8].
* **Overrides de Prioridad:** Situaciones críticas (balón suelto muy cercano, mano a mano libre o balón parado) actúan como *State Overrides* (ver `states/overrides/` en `engine`)[cite: 8], cortocircuitando la fuerza elástica hacia la posición base de la formación para evitar que los delanteros retrocedan o frenen en un 1v1.

---

## 3. Contrato de Emparejamiento (`Coordinator / Mutex Pattern`)
Las decisiones defensivas nunca las toma un jugador de forma aislada; las asigna un coordinador de línea (`assignDefensiveEngagementRoles` en Fase 2, inspirado en `states/engagement/` de `engine`)[cite: 8]:
* **Exclusividad del 1.er Defensor:** Solo un jugador obtiene el token de presión directa (`line_step` / *Delay*) sobre el poseedor del balón[cite: 1, 8, 10].
* **Reacción en Cadena (2.º y 3.er Defensor):** La salida del 1.er Defensor obliga automáticamente a los compañeros adyacentes a entrar en estado de *Cobertura/Permuta* y al lado débil a cerrarse en *Balance*, garantizando siempre la regla del $+1$ (*Spare Man*)[cite: 1, 9, 10].

---

## 4. Utility AI para Toma de Decisiones (`Evaluator Pattern`)
Para dotar a los jugadores de visión y variedad, queda prohibido usar árboles `if/else` rígidos para elegir pases, tiros o regates. Se utiliza **Utility AI** (inspirado en `passing/evaluator.rs` y `forward_shot_decision.rs` de `engine`)[cite: 8]:
* Cada acción candidata recibe un puntaje continuo $U \in [0, 1]$ combinando ganancia espacial ($\Delta\text{xThreat}$ en las 18 Zonas), geometría (triángulos/diamantes en *Half-Spaces*), calidad de tiro (**xG**) y riesgo de intercepción/presión (PPM)[cite: 4, 5, 8, 10].
* Para la IA del entrenador (`coachAI.js`)[cite: 7], se aplica el **Patrón de Distancia Semántica (DSS)**: comparar el vector de 14 macro-atributos del equipo ($V_{team}$) contra las 20 plantillas estratégicas ($V_{strategy}$) mediante distancia euclidiana ponderada por fatiga, marcador y minuto[cite: 2].

---

## 5. Decorador de Habilidad Efectiva (`Effective Skill Pattern`)
Ninguna resolución de pase, tiro o duelo debe leer el atributo crudo del jugador directamente de `playersDB.js`[cite: 7]. Todo cálculo debe pasar por un calculador de habilidad efectiva (inspirado en `ops/skill/effective_skill.rs` y `traits_bias.rs` de `engine`)[cite: 8]:
* `Atributo Efectivo = Atributo Base × Multiplicador de Química (0.85 a 1.15) × Factor de Fatiga × Penalización por Orientación Corporal / Presión (PPM) + Sesgo por Rasgo (Trait)`[cite: 4, 8, 9, 10].

---

## 6. Resolución Escalonada de Disputas (`Layered Contest Pattern`)
Para mantener el realismo estadístico, el contacto físico se evalúa en embudo (ver `ballContest.js` y `officiating/referee.js` en Fase 2, basados en `ball/contest/` de `engine`)[cite: 8]:
1. **Intercepción / Bloqueo de línea** (0% faltas)[cite: 8, 9].
2. **Contención (*Delay / Jockey*) y Carga Corporal (`body`)** (desgaste y robo limpio por fuerza/agilidad, $<5\%$ faltas)[cite: 1, 8, 9].
3. **Entrada (*Tackle*) con Cooldown y Restricción (*Restraint*):** Filtrada previamente por `discipline.js` (reducción drástica de riesgo si el defensor ya tiene amarilla o está dentro del área penal)[cite: 1, 8].