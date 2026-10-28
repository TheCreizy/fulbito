# DESIGN-PATTERNS.md — Patrones de Diseño y Arquitectura (Fulbito 2.2)

> **Propósito:** Definir los 6 patrones arquitectónicos obligatorios en `src/engine/` (JavaScript ES6 Modules), alineados con `Rediseño del Motor Fulbito 2.md`, `UPDATE FULBITO 2.2.md` y el motor de referencia en Rust (`open_football_engine/`).

---

## 1. Pipeline Determinista por Tick (`Tick Driver Pattern`)

El loop principal (`src/engine/engine.js`) actúa como un orquestador secuencial sin lógica táctica acoplada (inspirado en `open_football_engine` `engine/tick/driver.rs`):

| Paso | Función / Módulo | Responsabilidad en el Tick |
| :--- | :--- | :--- |
| **1. Context & Clock** | `src/engine/core/matchContext.js` `[Fase 5]` + `engine.js` | Actualiza `currentTick`, la fase activa de las **4 Fases del Continuum** (`ORGANIZACION_OFENSIVA`, `TRANSICION_ATAQUE_DEFENSA`, `ORGANIZACION_DEFENSIVA`, `TRANSICION_DEFENSA_ATAQUE`), ventanas de *Gegenpressing* (100 ticks) / *Contraataque* (160 ticks) y decaimiento de cooldowns (`tackleCooldown`, `interceptCooldown`). |
| **2. Spatial & Perception** | `src/engine/space/pitchZones.js`, `pressureMap.js`, `player/cognition.js` | Mapea coordenadas $(u, v)$, `zone18`, `lane`, `zoneXThreat`, calcula el *Player Pressure Map* (`pressurePPM` en 8 octantes) y actualiza el escaneo visual cervical (`updatePlayerCognition`, `isPreScanned`). |
| **3. Collective Plan** | `src/engine/teamShape.js`, `tactics/offensiveShape.js` | Calcula líneas de restricción/confrontación, basculación por centroide, compresión, regla del $+1$ (*Spare Man*), contrato de 3 defensores y exclusión espacial de celdas (`enforceRationalSpaceOccupation` `[Fase 6]`). |
| **4. Agent Decision (HFSM)** | `src/engine/player/playerStateMachine.js` `[Fase 6]` + `evaluators/*` | Ejecuta la máquina de estados por línea (`GK`, `DEF`, `MID`, `FWD`) con histéresis (`minHoldTicks: 8–14`) y *State Overrides* de 1 tick, más selección de acción con balón (`actions.js`). |
| **5. Kinematics & Ball 2.5D** | `src/engine/steering.js` `[Fase 5]`, `playerMovement.js`, `ball/ballPhysics.js`, `ballMovement.js` | Aplica `sprintRamp`, inercia rotacional ($>90^\circ$ por `agility`), velocidad de conducción (`control`), esfuerzo (`movementEffort` drenando `player.fitness`) y trayectoria balística 2.5D ($x, y, z, v_z, \text{spinZ}$). |
| **6. Contests & Officiating** | `src/engine/ballContest.js`, `ball/ballContest25D.js` `[Fase 7]`, `officiating/referee.js` | Resuelve intercepciones, carga física, tackles, duelos aéreos (`resolveAerialDuel`), atajadas 2.5D (`resolveGoalkeeperSave25D`) y arbitraje IFAB (Ley de la Ventaja, SPA, DOGSO). |

---

## 2. Máquina de Estados Finitos Jerárquica (HFSM) por Línea

Desacopla la toma de decisiones posicional en 4 módulos estratégicos (`src/engine/player/strategies/{goalkeeper,defender,midfielder,forward}States.js`) gobernados por `src/engine/player/playerStateMachine.js`:

- **Regla de Estado Único + Histéresis (`minHoldTicks`):** Cada jugador posee `player.fsm = { line, currentState, ticksInState, minHoldTicks, targetX, targetY, effortMode }`. Un estado ordinario se mantiene al menos `8 a 14 ticks` para evitar oscilaciones (*jitter*).
- **Overrides de Prioridad (1 Tick):** Situaciones críticas (`LOOSE_BALL_CLAIM`, `BREAKAWAY_DRIBBLE`, `EMERGENCY_PRESS_STEP`, `SET_PIECE_HOLD`) interrumpen cualquier estado ordinario de inmediato y apagan las fuerzas elásticas hacia el ancla de formación (garantizando cero pasos atrás en el 1v1).
- **Puente de Retrocompatibilidad:** `playerStateMachine.js` sincroniza `player.defensiveState` y `player.offensiveState` con los identificadores requeridos por las suites de Fases 1 a 4.

---

## 3. Contrato de Emparejamiento (`Coordinator / Mutex Pattern`)

Las decisiones defensivas y de ocupación espacial las asigna un coordinador de línea (`assignDefensiveEngagementRoles` en `src/engine/teamShape.js` y `enforceRationalSpaceOccupation` en `src/engine/space/pitchZones.js`):

- **Exclusividad del 1.er Defensor (`FIRST_DEFENDER_DELAY`):** Solo un defensor por línea recibe el token (`activePresserId`) para salir a acosar al portador en *jockey*.
- **Reacción en Cadena (2.º y 3.er Defensor):** La salida del 1.er defensor obliga a los adyacentes a entrar en `SECOND_DEFENDER_COVER` (reduciendo su separación lateral un $35\%$ para permuta) y al lado débil a cerrarse en `HOLDING_LINE_BALANCE` ($38\%$), preservando siempre la regla del $+1$ ($N_{def} = N_{att} + 1$, asistida por `MID_LAVOLPIANA_DROP` o `DEF_SWEEPER_COVER`).
- **Exclusión Espacial Ofensiva:** Ningún par de atacantes sin balón puede ocupar la misma celda `(zone18, lane)` ni formar líneas llanas de $0^\circ / 180^\circ$ a menos de $11\text{ m}$ ($110\text{ px}$); el coordinador desplaza al soporte hacia el *Half-Space* libre escalonando $\pm 8\text{ m}$ para formar triángulos ($30^\circ\text{–}60^\circ$) y cajas (*Box*).

---

## 4. Utility AI y Razonamiento en Espacio Semántico (`Evaluator & DSS Pattern`)

Queda prohibido usar árboles `if/else` rígidos para elegir pases, tiros, regates o tácticas de entrenador:

- **Evaluadores de Jugador (`src/engine/evaluators/`):**
  - `passEvaluator.js`: Maximiza utilidad continua combinando $\Delta\text{xThreat}$ en las 18 Zonas, libertad de presión ($1 - \text{PPM}$), geometría de triángulos/Tercer Hombre, bonificaciones de `PLAYMAKER` y multiplicador $\times 1.80$ en `FAST_COUNTER`.
  - `shotEvaluator.js`: Modelo logístico de **xG** (`CLEAR_CUT >= 0.32`, `HALF_CHANCE >= 0.07`, `SPECULATIVE < 0.07`), *Breakaway Override*, cabezazos aéreos y definición `GK-Dependent` vs `GK-Independent`.
  - `duelEvaluator.js` `[Fase 7]`: Evalúa vectores de finta ($35^\circ\text{–}55^\circ$) confrontando `control + agility` vs `agility + perception`.
- **Distancia Semántica Adaptativa (`src/engine/tactics/semanticDSS.js` y `coachAI.js` `[Fase 9]`):**
  - Agrega los 11 jugadores en el vector de **14 Macro-Atributos** $V_{team}(t) \in [0, 1]^{14}$ y selecciona la estrategia óptima entre las **20 Estrategias Canónicas** minimizando la distancia asimétrica $d_{adapt}(V_{team}, V_{strategy}^{(k)})$ ponderada por energía residual $A_8$ (`player.fitness`), minuto y marcador.

---

## 5. Decorador de Habilidad Efectiva (`Effective Skill Pattern`)

Ninguna resolución de pase, tiro, duelo o cinemática debe leer stats crudos (`1–100`) directamente de `src/data/playersDB.js`. Todo cálculo invoca `getEffectiveSkill(player, statName)` en `src/engine/player/effectiveSkill.js`:

$$\text{EffectiveSkill} = \text{clamp}\left(\text{BaseNorm}_{[0.10, 0.99]} \times \mu_{chem} \times \mu_{fitness} \times \mu_{lapse} + \text{TraitBias}, 0.05, 0.99\right)$$

- Donde $\mu_{chem} \in [0.85, 1.15]$ proviene de `computeSquadChemistryMultipliers(team)` y la compatibilidad al puesto natural / bonus de capitán se gestiona en `src/engine/modifiers.js`.

---

## 6. Resolución Escalonada de Disputas 2D y 2.5D (`Layered Contest Pattern`)

El contacto físico se evalúa en embudo (`src/engine/ballContest.js`, `src/engine/ball/ballContest25D.js` `[Fase 7]` y `src/engine/officiating/referee.js`):

1. **Capa 1 — Intercepción y Bloqueo de Línea:** Basado en `perception` y `agility` (`0%` faltas, `interceptCooldown = 18`). En `SWEEPER_KEEPER`, $+35\%$ de radio de corte en balones divididos.
2. **Capa 2 — Contención (*Jockey*) y Carga Corporal (`bodyContest`):** Desgaste de velocidad y disputa hombro con hombro por `strength` y `agility` (`<5%` faltas, `tackleCooldown = 10`).
3. **Capa 3 — Entrada (`tackle`) con Cooldown y *Restraint*:** Filtrada por `getDefenderRestraintMultiplier` en `officiating/referee.js` (`-55%` riesgo con tarjeta amarilla previa, `-50%` dentro del área penal propia).
4. **Capa 4 — Duelo Aéreo y Atajada 2.5D (`ballContest25D.js` `[Fase 7]`):** Cuando $8\text{ px} \le z \le 42\text{ px}$ cerca de `landingPoint`, confronta $S_{aerial}$ (cabezazo al arco, *flick-on* o despeje a banda); en el arco, `resolveGoalkeeperSave25D` discrimina entre `CLEAN_CATCH`, `PARRY_SAFE` y `REBOUND_DANGER`.
