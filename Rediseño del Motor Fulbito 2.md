# Rediseño del Motor Fulbito 2.2 — Especificación Técnica Maestra

> **Documento Maestro de Arquitectura, Física Balística, IA Táctica y Modelo Semántico (DSS)**
> **Estado del Proyecto:** Baseline Fase 4 Completada (`819eaa0`) $\rightarrow$ Hoja de Ruta Activa Fases 5 a 9 (Fulbito 2.2)
> **Estándar Documental:** `llm.md/tech-docs` (Alta densidad de tokens, contratos deterministas, cero ambigüedad)

---

## 1. Resumen Arquitectónico e Invariantes del Dominio

**Fulbito 2.2** es un motor determinista de simulación de fútbol en 2.5D basado en ticks de alta frecuencia (`~2000 ticks` por partido de 90 minutos, `~150ms/tick` en velocidad normal x1) sobre HTML5 `<canvas>` (`680 × 1050 px`, escala `10 px = 1 m`). Combina la ingeniería modular del repositorio de referencia en Rust (`open_football_engine/`) con geometría posicional de 18 Zonas, 5 Carriles Verticales, máquinas de estados finitos jerárquicas (HFSM), utilidad esperada ($\text{xG}$, $\Delta\text{xThreat}$) y razonamiento en espacio semántico de 14 dimensiones (DSS).

### 1.1. Invariantes Innegociables (Hard Guardrails)

| Dominio | Invariante / Contrato | Restricción Negativa (Qué NO Hacer) |
| :--- | :--- | :--- |
| **Coordenadas Espaciales** | Toda lógica táctica opera sobre coordenadas normalizadas $(u, v) \in [0.0, 1.0]^2$, las 18 Zonas y los 5 Carriles en `src/engine/space/pitchZones.js` (`u`: avance longitudinal hacia meta rival; `v`: posición transversal de izquierda a derecha). | **PROHIBIDO** hardcodear coordenadas de píxeles absolutos en evaluadores o máquinas de estados tácticas sin pasar por `toRelativeUV` / `fromRelativeUV`. |
| **Atributos y Base de Datos** | `src/data/playersDB.js` mantiene escala entera `1–100` y 4 tiers (`legend`, `idol`, `squad`, `filler`). La normalización a $[0.0, 1.0]$ ocurre **únicamente** dentro de `getEffectiveSkill(player, stat)` en `src/engine/player/effectiveSkill.js`. | **PROHIBIDO** alterar la escala `1–100` en `playersDB.js` o leer stats crudos sin pasar por `getEffectiveSkill`. |
| **Modos Draft y Economía** | `src/draft/draftEngine.js` (\$250M, 16 rondas, sobres de 7 cartas, reroll \$2M, failsafe \$1M/slot) y `src/draft/futDraftEngine.js` mantienen sus reglas financieras intactas. | **PROHIBIDO** alterar precios, presupuestos o probabilidades de sobres al refactorizar el motor del partido. |
| **Contrato con UI React** | `MatchSimulator.jsx`, `TacticsBoard.jsx`, `DraftScreen.jsx`, `FutDraftScreen.jsx`, `PenaltyShootoutModal.jsx` y `commentaryEngine.js` consumen `matchDetails` (`kickOffTeam`, `secondTeam`, `ball`, `iterationLog`, `kickOffTeamStatistics`, `secondTeamStatistics`, `half`). | **PROHIBIDO** renombrar claves públicas de `matchDetails` o eliminar `player.currentPOS = [x, y]` / `ball.position = [x, y, z]`. |
| **Jugadores Expulsados** | Un jugador con tarjeta roja marca `p.redCard = true` y `p.currentPOS = ['NP', 'NP']`. Todo bucle espacial filtra con `common.isOnPitch(p)`. | **PROHIBIDO** usar `Object.defineProperty` con `writable: false` sobre `currentPOS` o incluir expulsados en cálculos de distancia/offside. |

---

## 2. Mapa Topográfico y Estado de Implementación (`src/engine/`)

| Ruta del Módulo | Estado | Fase | Responsabilidad y Contratos Principales |
| :--- | :--- | :--- | :--- |
| `src/engine/engine.js` | `[IMPLEMENTADO + MODIFICAR]` | F1–F4 / F5–F6 | **Tick Driver Maestro.** Orquesta `initiateGame`, `playIteration`, `updateSpatialAndTacticalTelemetry`, tiempos extra y penales. Conectar a `matchContext.js` y `playerStateMachine.js`. |
| `src/engine/core/matchContext.js` | `[IMPLEMENTADO]` | **Fase 5** | Máquina de estados de las **4 Fases del Continuum Táctico**, ventanas temporales de *Gegenpressing* (5s / 100 ticks) y *Contraataque* (8s / 160 ticks), e Índice de Desorden Rival. |
| `src/engine/core/rng.js` | `[IMPLEMENTADO]` | **Fase 5** | Utilidades matemáticas deterministas, distribuciones normales acotadas y clamps. |
| `src/engine/space/pitchZones.js` | `[IMPLEMENTADO]` | F1 / **Fase 6** | Grilla de 18 Zonas (`getTacticalZone18`), 5 Carriles (`getVerticalLane`), `ZONE_XTHREAT`, conversión $(u, v)$ y `enforceRationalSpaceOccupation` (exclusión racional de celdas y geometría de triángulos/cajas). |
| `src/engine/space/pressureMap.js` | `[IMPLEMENTADO]` | Fase 1 | Cálculo del *Player Pressure Map* (`computePlayerPressure`, PPM $\in [0, 1]$) en 8 octantes con cono de visión frontal ($1.25\times$) y punto ciego ($1.15\times$). |
| `src/engine/space/raycast.js` | `[IMPLEMENTADO]` | Fase 1 | Proyección de conos de visión y corredores libres (`raycastCorridor`) para pases, tiros y conducción. |
| `src/engine/ball/ballPhysics.js` | `[IMPLEMENTADO]` | Fase 1 | Balística 2.5D continua: gravedad ($g=0.28$), arrastre, efecto Magnus (`spinZ`), restitución de pique y predicción analítica (`predictBallLanding`). |
| `src/engine/ballMovement.js` | `[IMPLEMENTADO]` | F1–F4 | Integración de trayectoria 2.5D (`moveBall`), resolución de tiros, pases, desvíos, córners, saques y detección de goles. |
| `src/engine/ballContest.js` | `[IMPLEMENTADO]` | F2–F4 / **Fase 7** | Embudo de disputas en suelo en 3 capas: Intercepción ($0\%$ faltas, `interceptCooldown = 18`), Carga Corporal/Jockey ($<5\%$ faltas, `tackleCooldown = 10`) y Tackle con *Restraint*. Conectado con `ballContest25D.js` y `duelEvaluator.js`. |
| `src/engine/ball/ballContest25D.js` | `[IMPLEMENTADO]` | **Fase 7** | `resolveAerialDuel` (cabezazos ofensivos/defensivos y *flick-ons*), `resolveGoalkeeperSave25D` (`CLEAN_CATCH`, `PARRY_SAFE`, `REBOUND_DANGER`) y Reach tridimensional. |
| `src/engine/actions.js` | `[IMPLEMENTADO]` | F1–F7 | Orquestador de decisiones con balón (`selectAction`), conducción, pases, centros, tiros, regate 1v1 (`shouldAttemptDribble`) y delegación de disputas. |
| `src/engine/playerMovement.js` | `[IMPLEMENTADO]` | F1–F6 | Movimiento por tick (`decideMovement`, `getSmartDribbleMove`), rampa de sprint (`sprintRamp`), desgaste de `player.fitness` y conexión con objetivos HFSM. |
| `src/engine/setPositions.js` | `[IMPLEMENTADO]` | Base / F1–F4 | Posicionamiento en saques iniciales (`isRestart`), saques de arco, laterales, córners, penales (`selectPenaltyTaker`), cambio de cancha (`switchSide`) y atribuciones de rebote (`lastShooter`). |
| `src/engine/modifiers.js` | `[IMPLEMENTADO]` | Base | Matriz de compatibilidad posicional (`COMPATIBILITY_MATRIX`, `getPositionCompatibility`), bonus de capitán (`+3 perception`) y modificadores de rendimiento (`updatePlayerEffectiveSkills`). |
| `src/engine/common.js`, `setVariables.js`, `validate.js` | `[IMPLEMENTADO]` | Base | Utilidades matemáticas/geométricas, verificación `isOnPitch(p)`, inicialización de `matchDetails` y validación de esquemas de entrada. |
| `src/engine/officiating/referee.js` | `[IMPLEMENTADO]` | F2 / F4 | Árbitro IFAB con `strictness`, Ley de la Ventaja (`attackerTeamKeepsBallWithSpace`), SPA (falta táctica), DOGSO y acumulación de faltas. |
| `src/engine/player/effectiveSkill.js` | `[IMPLEMENTADO]` | Fase 4 | Química $\mu_{chem} \in [0.85, 1.15]$ (`computeSquadChemistryMultipliers`), catálogo de 6 `PLAYER_TRAITS` (`PLAYMAKER`, `CLINICAL_FINISHER`, `LONG_SHOT_SPECIALIST`, `SPEED_DRIBBLER`, `BALL_WINNER`, `SWEEPER_KEEPER`) y `getEffectiveSkill`. |
| `src/engine/player/cognition.js` | `[IMPLEMENTADO]` | F4 / Fase 6 | Escaneo visual cervical ($T_{scan} \in [3, 18]$ ticks), flag `isPreScanned`, combinaciones de Tercer Hombre y micro-lapsos bajo presión ($PPM > 0.60$). |
| `src/engine/player/playerStateMachine.js` | `[IMPLEMENTADO]` | **Fase 6** | Orquestador HFSM por jugador (`player.fsm`) con histéresis anti-jitter (`minHoldTicks: 8–14`) y *State Overrides* de 1 tick (`LOOSE_BALL_CLAIM`, `BREAKAWAY_DRIBBLE`, `SET_PIECE_HOLD`). |
| `src/engine/player/strategies/goalkeeperStates.js` | `[IMPLEMENTADO]` | **Fase 6** | 14 estados de arquero (`GK_STANDING_LINE`, `GK_SPLIT_STEP`, `GK_COMING_OUT_1V1`, `GK_SWEEPING`, `GK_CLAIMING_HIGH_BALL`, etc.). |
| `src/engine/player/strategies/defenderStates.js` | `[IMPLEMENTADO]` | **Fase 6** | 16 estados de defensa (`DEF_HOLDING_LINE`, `DEF_FIRST_DELAY`, `DEF_SECOND_COVER`, `DEF_SWEEPER_COVER`, `DEF_OVERLAPPING`, `DEF_UNDERLAPPING`, `DEF_INVERTED_FULLBACK`, etc.). |
| `src/engine/player/strategies/midfielderStates.js` | `[IMPLEMENTADO]` | **Fase 6** | 16 estados de mediocampo (`MID_SHIELDING_ZONE14`, `MID_LAVOLPIANA_DROP`, `MID_BOX_HALF_SPACE`, `MID_THIRD_MAN_SUPPORT`, `MID_BOX_TO_BOX_LATE_RUN`, `MID_COUNTER_PRESSING`, etc.). |
| `src/engine/player/strategies/forwardStates.js` | `[IMPLEMENTADO]` | **Fase 6** | 15 estados de ataque (`FWD_PINNING_CB`, `FWD_FALSE_NINE_DROP`, `FWD_RUNNING_IN_BEHIND_ARC` con arqueo anti-offside, `FWD_HOLDING_WIDTH_ISOLATION`, `FWD_BOX_ZONE_1..4`, etc.). |
| `src/engine/evaluators/passEvaluator.js` | `[IMPLEMENTADO + UPGRADE]` | F3–F4 / **Fase 6** | Utilidad multicriterio ($\Delta\text{xThreat}$, PPM, geometría, pases al pie vs `THROUGH` vs `SWITCH`). **Upgrade F6:** Pesos dinámicos según Fase del Continuum y Rol/Duty. |
| `src/engine/evaluators/shotEvaluator.js` | `[IMPLEMENTADO + UPGRADE]` | F3–F4 / **Fase 7** | Modelo logístico de xG (`CLEAR_CUT`, `HALF_CHANCE`, `SPECULATIVE`) y *Breakaway Override*. |
| `src/engine/evaluators/duelEvaluator.js` | `[IMPLEMENTADO]` | **Fase 7** | Evaluación de regate 1v1 y evasión de marca (`marker_evasion` / vector de finta $35^\circ\text{–}55^\circ$ dejando al defensor con `interceptCooldown = 25`). |
| `src/engine/teamShape.js` | `[IMPLEMENTADO]` | F2–F4 | Alturas de bloque, basculación lateral por centroide, compresión, regla del $+1$ (*Spare Man*) y contrato de 3 defensores (`FIRST_DEFENDER_DELAY`, `SECOND_DEFENDER_COVER`, `MARKING_TIGHT`, `HOLDING_LINE_BALANCE`). |
| `src/engine/tactics/offensiveShape.js` | `[IMPLEMENTADO -> INTEGRAR]` | F3 / **Fase 6** | Asigna roles de soporte ofensivo (`OVERLAPPING`, `UNDERLAPPING`, `RUNNING_IN_BEHIND`, `BOX_ZONE_1..4`). Se integrará como proveedor de waypoints dentro de la HFSM en Fase 6. |
| `src/engine/tactics/tacticalModel.js` | `[IMPLEMENTADO]` | **Fase 8** | Configuración de las 4 Fases del Continuum, Bloques (`LOW_BLOCK`, `MID_BLOCK`, `HIGH_PRESS`), Anchuras (`COMPACT`, `BALANCED`, `WIDE`) y Fluidez. |
| `src/engine/tactics/rolesAndDuties.js` | `[IMPLEMENTADO]` | **Fase 8** | Taxonomía de los **15 Roles Funcionales + 3 Duties** (`DEFEND`, `SUPPORT`, `ATTACK`) y sus matrices de modulación. |
| `src/engine/tactics/semanticDSS.js` | `[IMPLEMENTADO]` | **Fase 9** | Vector de **14 Macro-Atributos** $V_{team}(t) \in [0, 1]^{14}$, **20 Estrategias Canónicas** y Distancia Semántica Adaptativa $d_{adapt}$. |
| `src/engine/steering.js` | `[IMPLEMENTADO]` | **Fase 5** | Intercepción por rumbo constante (`calculateInterceptMovement`), rampa de aceleración (`sprintRamp`), inercia rotacional ($>90^\circ$ por `agility`), velocidad de conducción (`control`) y modalidades de esfuerzo (`movementEffort`). |
| `src/engine/setFreekicks.js` | `[IMPLEMENTADO]` | **Fase 7** | Rutinas de córner ofensivo/defensivo (defensa mixta/zonal con 2 guardias al primer palo, ataque a 4 zonas con curva Magnus) y penales psicológicos (`resolvePsychologicalPenalty`). |
| `src/engine/coachAI.js` | `[IMPLEMENTADO]` | **Fase 9** | Escalera de decisión reactiva, integración con directivas del DT y sustituciones inteligentes (`evaluateSmartSubstitutions`). |

---

## 3. Especificación de Fundaciones Construidas (Fases 1 a 4 — `[IMPLEMENTADO]`)

### 3.1. Geometría Espacial: 18 Zonas, 5 Carriles y xThreat (`src/engine/space/pitchZones.js`)

El campo normalizado $(u, v) \in [0, 1]^2$ se divide en **6 filas longitudinales × 3 columnas base = 18 Zonas** y **5 Carriles Verticales**:

- **5 Carriles Verticales (`LANES`):**
  - `0: LEFT_WING` ($v \in [0.00, 0.18)$)
  - `1: LEFT_HALF_SPACE` ($v \in [0.18, 0.38)$)
  - `2: CENTER` ($v \in [0.38, 0.62]$)
  - `3: RIGHT_HALF_SPACE` ($v \in (0.62, 0.82]$)
  - `4: RIGHT_WING` ($v \in (0.82, 1.00]$)
- **Grilla de 18 Zonas y Matriz `ZONE_XTHREAT`:**
  - **Iniciación ($u \in [0.00, 0.33)$):** Fila 0 `[Z2: 0.015, Z1: 0.010, Z3: 0.015]`, Fila 1 `[Z5: 0.030, Z4: 0.020, Z6: 0.030]`.
  - **Creación y Progresión ($u \in [0.33, 0.66)$):** Fila 2 `[Z7: 0.045, Z8: 0.055, Z9: 0.045]`, Fila 3 `[Z10: 0.110, Z11: 0.090, Z12: 0.110]`.
  - **Finalización ($u \in [0.66, 1.00]$):** Fila 4 `[Z13: 0.140, Z14: 0.240, Z15: 0.140]`, Fila 5 `[Z16: 0.320, Z17: 0.550, Z18: 0.320]`.

### 3.2. Balística 2.5D (`src/engine/ball/ballPhysics.js`)

- **Ecuaciones de Estado por Tick:**
  - Gravedad vertical: $g = 0.28\text{ px/tick}^2$.
  - Efecto Magnus lateral por comba (`spinZ`): desvía el vector horizontal $(v_x, v_y)$ perpendicularmente a la trayectoria en centros y tiros libres/lejanos.
  - Bote y restitución: al tocar $z \le 0$, $v_z' = -v_z \cdot e_{restitution}$ y amortiguación horizontal por fricción del césped (`0.90`).
  - Predicción analítica: `predictBallLanding(ball)` calcula el punto exacto $(x_{land}, y_{land}, t_{ticks})$ donde el balón descenderá a altura disputable.

### 3.3. Bloque Defensivo, Duelos en 3 Capas y Arbitraje IFAB (`teamShape.js`, `ballContest.js`, `referee.js`)

- **Contrato de Emparejamiento Defensivo (Mutex por Línea):**
  1. `FIRST_DEFENDER_DELAY`: Exactamente **1** defensor recibe el token de salida (`activePresserId`) para acosar al poseedor en *jockey*.
  2. `SECOND_DEFENDER_COVER`: Los compañeros adyacentes cierran el intervalo interior detrás del 1.er defensor (reduciendo separación lateral un $35\%$) listos para la permuta.
  3. `HOLDING_LINE_BALANCE` y **Regla del $+1$ (*Spare Man*)**: La última línea mantiene siempre $N_{def} = N_{att} + 1$ efectivos consolidados (cerrando al lateral del lado débil un $38\%$ o incrustando al MCD en salida *Lavolpiana*).
- **Embudo de Disputas en Suelo (`ballContest.js`):**
  - **Capa 1 — Intercepción y Bloqueo:** Basado en `perception` + `agility` ($0\%$ faltas).
  - **Capa 2 — Contención (*Jockey*) y Carga Corporal (`bodyContest`):** Ralentiza al portador y disputa hombro con hombro usando `strength` + `agility` ($<5\%$ faltas).
  - **Capa 3 — Entrada (`tackle`):** Cooldown obligatorio `tackleCooldown = 55` ticks. Filtrado por **Restraint** (`-55%` propensión con amarilla previa, `-50%` dentro del área propia).
- **Calibración IFAB (`referee.js`):** Ley de la Ventaja activa solo cuando `attackerTeamKeepsBallWithSpace === true`. Metas validadas: `12–22` faltas/partido, `2–4` amarillas/partido, `<0.15` rojas/partido.

### 3.4. Cognición, Química y Rasgos (`cognition.js`, `effectiveSkill.js`)

- **Frecuencia de Escaneo Visual (`Scanning`):**
  $$T_{scan} = \text{clamp}\left(\text{round}(18 - 14 \cdot \text{EffectiveSkill}(\text{perception})), 3, 18\right)\text{ ticks}$$
  Otorga `player.isPreScanned = true`, mitigando el $75\%$ de la penalización por orientación corporal en pases de primera e identificando combinaciones de Tercer Hombre.
- **Multiplicador de Química ($\mu_{chem}$):**
  $$\mu_{chem} = 0.85 + 0.30 \cdot \text{chemNorm} \in [0.85, 1.15]$$
  Las cartas `legend` tienen $\text{chemNorm} = 1.0 \implies \mu_{chem} = 1.15$.

---

## 4. Especificación Integral de las Nuevas Fases (Fases 5 a 9 — Fulbito 2.2)

### FASE 5: Continuum Táctico de 4 Fases, Transiciones y Cinemática Biomecánica `[IMPLEMENTADO]`

#### 5.1. Máquina de Estados del Partido: Las 4 Fases del Continuum (`src/engine/core/matchContext.js`)

Cada equipo mantiene en `matchDetails.tacticalPhase[teamId]` una de las **4 Fases**:

| Fase del Continuum | Ventana / Condición de Disparo | Comportamiento Colectivo e Impacto en Evaluadores |
| :--- | :--- | :--- |
| **1. `ORGANIZACION_OFENSIVA`** | Posesión consolidada ($>8\text{ s}$ / $>160\text{ ticks}$ tras robo o reinicio en corto). | Despliegue de amplitud en los 5 carriles, subida coordinada de laterales según *Duty* y formación de triángulos/cajas en *Half-Spaces*. |
| **2. `TRANSICION_ATAQUE_DEFENSA`** | Ventana de $0\text{ a }6\text{ s}$ (`120 ticks`) tras perder el balón en $(x_{loss}, y_{loss})$ en `lossTick`. | • **Sub-modo `COUNTER_PRESSING` (*Gegenpressing*):** Si la instrucción es presión tras pérdida, ocurre en campo rival ($u_{loss} \ge 0.45$) y hay $\ge 3$ jugadores propios en radio $\le 18\text{ m}$ ($180\text{ px}$), los 3 más cercanos cazan al poseedor y cierran líneas cortas durante `100 ticks` ($5\text{ s}$).<br>• **Sub-modo `INTENSIVE_RETREAT` (*Repliegue*):** Si no se cumple el umbral, todo el equipo activa `DEF_TRACKING_BACK` hacia sus anclas de bloque detrás de la Línea de Confrontación. |
| **3. `ORGANIZACION_DEFENSIVA`** | Superada la ventana de $6\text{ s}$ sin recuperar o con bloque ya consolidado. | Aplicación estricta de Línea de Confrontación, Línea de Restricción, basculación por centroide y Contrato de 3 Defensores. |
| **4. `TRANSICION_DEFENSA_ATAQUE`** | Ventana de $0\text{ a }8\text{ s}$ (`160 ticks`) tras recuperar el balón en juego vivo. Evalúa el **Índice de Desorden Rival** (defensores rivales delante de la línea del balón o fuera de *Rest Defence*). | • **Sub-modo `FAST_COUNTER` (*Contraataque Vertical*):** Si hay desorden rival o instrucción vertical, multiplica $\times 1.80$ la utilidad de pases verticales/filtrados en `passEvaluator.js`, penaliza pases horizontales y dispara carreras `FWD_RUNNING_IN_BEHIND_ARC` para finalizar en 2–4 pases.<br>• **Sub-modo `CONSOLIDATE_POSSESSION` (*Consolidación*):** Si el bloque rival está armado, prioriza un **Pase de Seguridad (*Safety Pass*)** fuera de la zona de congestión hacia el pivote o central libre. |

#### 5.2. Cinemática Biomecánica e Inercia Rotacional (`src/engine/steering.js`)

1. **Rampa Progresiva de Aceleración (`player.sprintRamp` $\in [0, 1]$):**
   $$\Delta\text{ramp} = 0.065 + 0.055 \cdot \text{EffectiveSkill}(\text{agility})$$
   Un jugador explosivo (`agility = 92`) alcanza velocidad punta en $\sim 8\text{ ticks}$; un jugador pesado (`agility = 60`) tarda $\sim 12\text{ ticks}$.
2. **Penalización Angular por Cambio de Dirección Brusco ($\Delta\theta = |\text{angleDiff}(\theta_{deseado}, \text{player.facingAngle})|$):**
   Si $\Delta\theta > \frac{\pi}{2}$ ($90^\circ$), el jugador desacelera para rotar su centro de gravedad:
   $$\mu_{turn} = 1.0 - \left(\frac{\Delta\theta}{\pi}\right) \cdot \left(0.65 - 0.35 \cdot \text{EffectiveSkill}(\text{agility})\right)$$
   La orientación corporal `player.facingAngle` se interpola con velocidad angular máxima:
   $$\omega_{max} = 0.28 + 0.25 \cdot \text{EffectiveSkill}(\text{agility})\text{ rad/tick}$$
3. **Velocidad de Conducción con Balón (*Carry Speed*):**
   $$\mu_{carry} = 0.84 + 0.12 \cdot \text{EffectiveSkill}(\text{control}) + (\text{hasTrait}(\text{SPEED\_DRIBBLER}) ? 0.04 : 0)$$
4. **Modalidades de Esfuerzo (`movementEffort`) y Drenaje de Energía:**
   - `WALKING`: $0.38\times$ $v_{max}$
   - `JOGGING_SHAPE`: $0.68\times$ $v_{max}$
   - `CRUISING_SUPPORT`: $0.85\times$ $v_{max}$
   - `SPRINTING`: $1.00\times$ $v_{max}$
   - `SURGING_BURST`: $1.12\times$ $v_{max}$ (en rupturas `OVERLAPPING` / `BREAKAWAY`)

---

### FASE 6: Máquinas de Estados Finitos Jerárquicas (HFSM) por Línea y Exclusión de Celdas `[IMPLEMENTADO]`

#### 6.1. Contrato del Orquestador HFSM (`src/engine/player/playerStateMachine.js`)

Cada jugador mantiene la estructura determinista:
```javascript
player.fsm = {
  line: 'GK' | 'DEF' | 'MID' | 'FWD',
  currentState: String,
  ticksInState: Number,
  minHoldTicks: Number, // 8 a 14 ticks (Histéresis Anti-Jitter)
  targetX: Number,
  targetY: Number,
  effortMode: 'WALKING' | 'JOGGING_SHAPE' | 'CRUISING_SUPPORT' | 'SPRINTING' | 'SURGING_BURST'
};
```
- **Histéresis Anti-Jitter:** Ningún estado ordinario transiciona antes de cumplir `ticksInState >= minHoldTicks` (`8–14 ticks`).
- **State Overrides de Prioridad (Interrupción en 1 tick):** `LOOSE_BALL_CLAIM`, `BREAKAWAY_DRIBBLE`, `EMERGENCY_PRESS_STEP`, `SET_PIECE_HOLD`.
- **Invariante de Retrocompatibilidad con Suites F1–F4:** Al actualizar `player.fsm.currentState`, el orquestador debe sincronizar `player.defensiveState` (`'FIRST_DEFENDER_DELAY'`, `'SECOND_DEFENDER_COVER'`, `'MARKING_TIGHT'`, `'HOLDING_LINE_BALANCE'`) y `player.offensiveState` (`'OVERLAPPING'`, `'UNDERLAPPING'`, `'FULLBACK_SUPPORT'`, `'REST_DEFENCE_CB'`, `'BOX_ZONE_1'..'BOX_ZONE_4'`, `'PIVOT_RECYCLE_SUPPORT'`, `'HALF_SPACE_CREATING'`, `'RUNNING_IN_BEHIND'`) para no romper los contratos de `verifyPhase1And2Fulbito2.js` y `verifyPhase3Fulbito2.js`.
- **Invariante de Energía en Runtime (`player.fitness`):** La energía dinámica del jugador en cancha vive en `player.fitness` (`0–100`), mientras que `player.skill.stamina` es su atributo base estático en `playersDB.js`. Todo cálculo de drenaje en `steering.js` o lectura de energía residual $A_8$ en `semanticDSS.js` y `coachAI.js` debe operar sobre `player.fitness ?? player.stamina ?? 100`.

#### 6.2. Catálogo de Estados por Línea (`src/engine/player/strategies/*States.js`)

| Archivo de Estrategia | Estados Sin Balón (Defensivos / Transición A$\rightarrow$D) | Estados Con Posesión Propia / Con Balón |
| :--- | :--- | :--- |
| **`goalkeeperStates.js`** (14 estados) | `GK_STANDING_LINE` (bisectriz de tiro), `GK_SPLIT_STEP` (pre-activación $+15\%$ reflejos), `GK_PREPARING_SAVE`, `GK_COMING_OUT_1V1` (achique en *breakaway*), `GK_SWEEPING` (corte fuera del área), `GK_CLAIMING_HIGH_BALL` (descolgar centros), `GK_TRACKING_CROSS`, `GK_PENALTY_READY`. | `GK_HOLDING_BALL`, `GK_DISTRIBUTING_SHORT` (salida limpia a Z1–Z4), `GK_LAUNCHING_COUNTER` (envío largo tenso en transición D$\rightarrow$A), `GK_SUPPORT_BACKPASS`, `GK_GOAL_KICK_SETUP`, `GK_WASTING_TIME`. |
| **`defenderStates.js`** (16 estados) | `DEF_HOLDING_LINE` (línea sincronizada y achique `line_step`), `DEF_FIRST_DELAY` (1.er defensor en *jockey*), `DEF_SECOND_COVER` (2.º defensor cerrando espalda y permuta), `DEF_MARKING_TIGHT`, `DEF_SWEEPER_COVER` (exclusivo del **Líbero** $3.5\text{ m}$ detrás de los *stoppers*), `DEF_TRACKING_BACK`, `DEF_AERIAL_CLEAR`, `DEF_BOX_CROSS_GUARD`, `DEF_EMERGENCY_BLOCK`. | `DEF_REST_DEFENCE` (triángulo de seguridad detrás de la línea del balón), `DEF_BALL_PLAYING_STEP` (conducción hasta Z4/Z8 para atraer marca), `DEF_FULLBACK_SUPPORT` (apoyo en Z7/Z9), `DEF_INVERTED_FULLBACK` (cierre al *Half-Space* Z8 junto al pivote), `DEF_OVERLAPPING` (banda exterior Z13/Z15), `DEF_UNDERLAPPING` (ruptura interior Z16/Z18 para *cutback*), `DEF_SET_PIECE_ATTACK`. |
| **`midfielderStates.js`** (16 estados) | `MID_SHIELDING_ZONE14` (tapón frente al balcón del área y Z5/Z6), `MID_LAVOLPIANA_DROP` (incrustación entre centrales para el $+1$), `MID_PRESSING_TRIGGER`, `MID_COUNTER_PRESSING` (acoso de 5s tras pérdida), `MID_SHUTTLING_BASCULATION`, `MID_TRACKING_RUNNER`, `MID_REST_DEFENCE_COVER`. | `MID_PIVOT_RECYCLE` (base del diamante detrás de la pelota), `MID_BOX_HALF_SPACE` (**Estructura en Caja / *Square*** en Z10 y Z12 formando cuadrilátero con pivotes en Z8/Z11), `MID_THIRD_MAN_SUPPORT` (apoyo de frente para descarga de primera), `MID_BOX_TO_BOX_LATE_RUN` (llegada desde 2.ª línea a **Zona 4 de Remate**), `MID_SWITCHING_PLAY`, `MID_CARRYING_PROGRESSIVE`, `MID_ROAMING_PLAYMAKER`, `MID_WIDE_SUPPORT`, `MID_EDGE_OF_BOX_WAIT`. |
| **`forwardStates.js`** (15 estados) | `FWD_PRESSING_CB` (curva de presión cerrando pase al central opuesto), `FWD_SCREENING_PIVOT` (sombra de marca sobre el 5 rival), `FWD_COUNTER_PRESS_TRAP`, `FWD_READY_FOR_COUNTER` (descolgado en transición). | 1. `FWD_PINNING_CB`: Fija físicamente a los dos centrales en el límite del *offside* (cuando el balón está en Z7–Z12) para liberar la Zona 14.<br>2. `FWD_FALSE_NINE_DROP`: Ante Bloque Bajo ($u_{zaga} < 0.22$) o rol Falso 9, desciende a Z11/Z14 para superioridad numérica y Tercer Hombre.<br>3. `FWD_RUNNING_IN_BEHIND_ARC`: Diagonal desde punto ciego al espacio. **Regla Anti-Paso Atrás:** Al alcanzar `safeOffsideU` antes del pase, transiciona a un **arqueo horizontal paralelo a la zaga (`ARCING_RUN`)** sin caminar jamás hacia atrás.<br>4. `FWD_HOLDING_WIDTH_ISOLATION` / `FWD_INVERTED_WINGER_CUT`: Amplitud en Z13/Z15 o diagonal al *Half-Space* cuando el lateral hace `DEF_OVERLAPPING`.<br>5. **Ataque al Área:** `FWD_BOX_ZONE_1` (1.er palo), `FWD_BOX_ZONE_2` (Punto penal), `FWD_BOX_ZONE_3` (2.º palo), `FWD_BOX_ZONE_4` (*Cutback* Z14).<br>6. **Con Balón:** `FWD_BREAKAWAY_DRIBBLE`, `FWD_1V1_ISOLATION_DRIBBLE`, `FWD_HOLD_UP_PLAY`. |

#### 6.3. Resolvedor de Exclusión Espacial y Geometría de Triángulos (`enforceRationalSpaceOccupation` en `pitchZones.js`)

Al finalizar la asignación de targets ofensivos en cada tick:
- Si dos jugadores atacantes sin balón caen en la misma celda `(zone18, lane)` o a menos de $11\text{ m}$ ($110\text{ px}$) sobre la misma línea horizontal o vertical respecto al poseedor (ángulos de $0^\circ$ o $180^\circ$ donde un solo rival tapa a ambos), el resolvedor desplaza automáticamente al jugador de soporte hacia el *Half-Space* adyacente libre y escalona su altura longitudinal en $\pm 8\text{ m}$ ($\pm 80\text{ px}$) para formar **triángulos con ángulos diagonales de $30^\circ\text{ a }60^\circ$**.

---

### FASE 7: Disputas 2.5D Completas, Regate 1v1 y Balón Parado / Penales Psicológicos `[IMPLEMENTADO]`

#### 7.1. Duelo Aéreo de Cabezazo (`resolveAerialDuel` en `src/engine/ball/ballContest25D.js`)

Cuando el balón está en fase descendente cerca de su `landingPoint` con altura $8\text{ px} \le z \le 42\text{ px}$ y convergen atacante y defensor dentro del radio de disputa ($24\text{ px}$):
$$S_{aerial}(p) = 0.35 \cdot \hat{h}_{height} + 0.35 \cdot \text{EffectiveSkill}(\text{jumping}) + 0.20 \cdot \text{EffectiveSkill}(\text{strength}) + 0.10 \cdot \text{EffectiveSkill}(\text{perception}) + \text{Bonus}_{carrera}$$
Donde:
- $\hat{h}_{height} = \text{clamp}\left(\frac{\text{height} - 165}{35}, 0.1, 1.0\right)$
- $\text{Bonus}_{carrera} = +0.08$ para el jugador que ataca el balón en movimiento frontal frente al que salta estático.
- **Resultado:**
  - *Gana Atacante:* Remate de cabeza al arco (en Z16/Z17/Z18 buscando pique al suelo o 2.º palo) o **peinada / bajada (*Flick-on / Knock-down*)** hacia un compañero en Z14/Z17.
  - *Gana Defensor:* Despeje de cabeza alto y orientado hacia las bandas, lejos de la Zona 14 central.

#### 7.2. Atajada Balística 2.5D y Control de Rebotes (`resolveGoalkeeperSave25D` en `ballContest25D.js`)

Evalúa la estirada tridimensional $(\text{Reach}_{XY}, \text{Reach}_{Z})$ según `saving`, `agility`, `jumping`, `height`, `perception` (penalizando visión tapada por tráfico en el cono de tiro, *screened shot*) y bonificación `+15%` si ejecutó `GK_SPLIT_STEP`:
1. **`CLEAN_CATCH` (Blocaje Limpio):** Tiro de potencia moderada y `saving + strength` superior al umbral $\implies$ embolsa sin dar rebote.
2. **`PARRY_SAFE` (Desvío Seguro a Córner/Costado):** Tiro potente o esquinado con alto `saving` $\implies$ desvía el vector fuera de los tres palos.
3. **`REBOUND_DANGER` (Rebote Corto Disputable):** Remate violento o menor `saving + strength` $\implies$ pelota viva en Zona 17 que dispara el override `LOOSE_BALL_CLAIM` en los delanteros.

#### 7.3. Duelo de Regate 1v1 y Evasión de Marca (`src/engine/evaluators/duelEvaluator.js`)

Cuando un gambeteador encara en Z13–Z18, evalúa un **Vector de Finta y Cambio de Ritmo** ($35^\circ\text{ a }55^\circ$ hacia el perfil débil del defensor o hacia el *Half-Space* / línea de fondo), confrontando `control + agility` del atacante contra `agility + perception` del defensor. Si gana el duelo, deja al marcador clavado (`interceptCooldown = 25` ticks) y abre ángulo limpio de centro, *cutback* o disparo.

#### 7.4. Balón Parado Táctico y Psicología en Penales (`src/engine/setFreekicks.js` y `PenaltyShootoutModal.jsx`)

- **Córners Defensivos (Sistema Mixto/Zonal):**
  - 2 guardias zonales en el Primer Palo y área chica (*Near Post Zonal Guards*).
  - Los 3 defensores con mayor `height + jumping + strength` toman marca individual sobre las torres rivales en punto penal y 2.º palo.
  - 1 jugador en la medialuna (Zona 14) para bloqueo de rebote y 1–2 jugadores rápidos adelantados para transición D$\rightarrow$A.
- **Córners Ofensivos:** Rutinas con comba Magnus (*in-swinger* cerrado o *out-swinger* abierto) atacando coordinadamente Primer Palo, Punto Penal, Segundo Palo y Borde de Área, más variante en corto.
- **Duelo Cognitivo de Penales (*Goalkeeper-Dependent* vs. *Goalkeeper-Independent*):**
  - **`GOALKEEPER_DEPENDENT` (*Paradinha / Lectura Perceptiva*):** Elegido por pateadores con `perception + control >= 82` o rasgo `PLAYMAKER` / `CLINICAL_FINISHER`. Desacelera en el último paso; si el arquero se vence antes de tiempo, asegura el toque al palo opuesto ($94\%$ de éxito). Si el arquero tiene altísima `perception` y aguanta de pie hasta el final, la menor potencia incrementa la probabilidad de atajada.
  - **`GOALKEEPER_INDEPENDENT` (*Potencia y Precisión Biomecánica*):** Elegido por pateadores con alto `shooting + strength / penalty_taking`. Busca clavar el remate a máxima velocidad en los ángulos superiores o rasos pegados al poste; aun adivinando el lado, el arquero requiere superar un umbral alto de `saving + jumping + agility`.

---

### FASE 8: Genealogía de Sistemas (3, 4 y 5 Defensas) y los 15 Roles + 3 Duties `[IMPLEMENTADO]`

#### 8.1. Catálogo de Formaciones (`src/data/formations.js`)

| Familia Defensiva | Sistemas Incluidos | Estructura Defensiva (Sin Balón) vs. Despliegue Ofensivo (Con Balón) |
| :--- | :--- | :--- |
| **3 Defensas** | `3-4-3` (Línea / Rombo), `3-5-2` | 3 centrales en el fondo; en ataque ocupa los 5 carriles con 2 carrileros profundos y cuadrado interior o doble punta. |
| **4 Defensas** | `4-4-2` (Clásico), `4-3-1-2` (Rombo), `4-3-3`, `4-2-3-1`, `4-1-4-1` | Línea de 4 simétrica sin balón; en posesión muta a salida de 3 (*Rest Defence*) liberando laterales en *Overlap/Underlap* o cerrando un lateral al *Half-Space*. |
| **5 Defensas** | `5-3-2` (Catenaccio con Líbero), `5-4-1` (Cerrojo) | **Líbero corrector** detrás de 2 *Stoppers* + 2 carrileros cerrando banda; transición vertical inmediata hacia las bandas y puntas tras robo. |

#### 8.2. Taxonomía de los 15 Roles Funcionales + 3 Tareas (`src/engine/tactics/rolesAndDuties.js`)

| Línea | Código de Rol | Nombre Táctico | Tareas (`Duties`) Permitidas | Comportamiento Principal en HFSM y Evaluadores |
| :--- | :--- | :--- | :--- | :--- |
| **Portería** | `GK_CLASSIC` | Arquero Clásico | `DEFEND` | Protege los tres palos (`GK_STANDING_LINE`) y prioriza seguridad. |
| **Portería** | `GK_SWEEPER` | Arquero Líbero (*Sweeper Keeper*) | `SUPPORT`, `ATTACK` | Adelanta posición $18\text{–}25\text{ px}$, barre pases largos (`GK_SWEEPING`) e inicia salida asociativa en Z1–Z4. |
| **Defensa** | `CB_STOPPER` | Marcador Central (*Stopper*) | `DEFEND` | Marca férrea sobre el 9/enganche rival y prioridad en duelos físicos y aéreos. |
| **Defensa** | `CB_BALL_PLAYING` | Central Iniciador | `SUPPORT` | Conduce hacia Z4/Z8 (`DEF_BALL_PLAYING_STEP`) para atraer presión y filtrar pases diagonales a los *Half-Spaces*. |
| **Defensa** | `SW_LIBERO` | Líbero Corrector | `DEFEND` (*Cover*), `SUPPORT` | Exclusivo de líneas de 3/5: barre $3.5\text{ m}$ detrás de los *stoppers* (`DEF_SWEEPER_COVER`) o da un paso al medio en posesión. |
| **Defensa** | `FB_FULLBACK` | Lateral | `DEFEND`, `SUPPORT`, `ATTACK` | `DEFEND`: Cierra en *Rest Defence*. `SUPPORT`: Apoyo en Z7/Z9 o interiorizado (`DEF_INVERTED_FULLBACK`). `ATTACK`: `DEF_OVERLAPPING` / `DEF_UNDERLAPPING`. |
| **Defensa** | `WB_WINGBACK` | Carrilero | `SUPPORT`, `ATTACK` | Recorrido completo de banda exterior (Z2/Z3 $\leftrightarrow$ Z13/Z15). |
| **Mediocampo** | `DM_ANCHOR` | Pivote Defensivo / Ancla | `DEFEND` | Custodia Z4/Z8/Z14 propia (`MID_SHIELDING_ZONE14`), nunca supera la línea del balón y ejecuta salida *Lavolpiana* (`MID_LAVOLPIANA_DROP`). |
| **Mediocampo** | `CM_PLAYMAKER_DEEP` | Mediocentro Distribuidor | `SUPPORT` | Eje de circulación (`MID_PIVOT_RECYCLE`), cambios de frente (`SWITCH`) y control de tempo. |
| **Mediocampo** | `CM_BOX_TO_BOX` | Interior Todoterreno | `SUPPORT`, `ATTACK` | Conecta ambas áreas, presiona en transición y llega por sorpresa a la Zona 4 de remate (`MID_BOX_TO_BOX_LATE_RUN`). |
| **Mediocampo** | `AM_PRESSING` | Mediapunta Mixto / Presión | `SUPPORT` | Lidera *Pressing Triggers* sobre el pivote rival y enlaza los *Half-Spaces* (`MID_BOX_HALF_SPACE`). |
| **Mediocampo** | `AM_ENGANCHE` | Enganche / Mediapunta Ofensivo | `ATTACK` | Flota libremente en Zona 14 y *Half-Spaces* 10/12 (`MID_ROAMING_PLAYMAKER`) para filtrar pases o rematar de media distancia. |
| **Delantera** | `WG_WINGER` | Extremo Puro de Banda | `SUPPORT`, `ATTACK` | Fija amplitud en Z13/Z15 (`FWD_HOLDING_WIDTH_ISOLATION`), encara en 1v1 exterior y abastece centros a las 4 zonas. |
| **Delantera** | `WG_INVERTED` | Extremo Invertido | `ATTACK` | Parte desde banda y conduce en diagonal al *Half-Space* y Z14/Z17 (`FWD_INVERTED_WINGER_CUT`), liberando el carril para el lateral. |
| **Delantera** | `ST_FALSE_NINE` | Segunda Punta / Falso 9 | `SUPPORT` | Desciende a Z11/Z14 (`FWD_FALSE_NINE_DROP`) para asociarse y activar al Tercer Hombre. |
| **Delantera** | `ST_TARGET_POACHER` | Delantero Centro / "9" de Área | `ATTACK` | Fija centrales (`FWD_PINNING_CB`), arquea carreras de ruptura (`FWD_RUNNING_IN_BEHIND_ARC`) y ataca el 1.er palo y punto penal. |

---

### FASE 9: Motor Semántico DSS (14 Macro-Atributos + 20 Estrategias Canónicas) y `coachAI.js` `[IMPLEMENTADO]`

#### 9.1. El Espacio Vectorial de 14 Macro-Atributos (`src/engine/tactics/semanticDSS.js`)

En cualquier instante $t$, el motor agrega los atributos ponderados de los 11 jugadores en cancha en el vector $V_{team}(t) \in [0, 1]^{14}$:

| Dimensión | Nombre Semántico | Fórmula / Atributos Fuente |
| :--- | :--- | :--- |
| $A_1$ | *Offensive Strength* (Fuerza Ofensiva) | Media ponderada de `shooting` y `control` de DEL y ME ofensivos. |
| $A_2$ | *Defensive Solidity* (Solidez Defensiva) | Media ponderada de `tackling`, `perception`, `strength` de DEF, MCD y `saving` de GK. |
| $A_3$ | *Midfield Creativity* (Creatividad y Elaboración) | Media ponderada de `passing` y `perception` de mediocampistas e interiores. |
| $A_4$ | *Transition Speed* (Velocidad de Transición) | Media de `speed` / `agility` de extremos, laterales y puntas. |
| $A_5$ | *Pressing Capacity* (Capacidad de Presión / Gegenpressing) | Combinación de `stamina` (`fitness`), `agility` y `tackling` del bloque medio/alto. |
| $A_6$ | *Width Utilization* (Amplitud y Desborde) | Capacidad de recorrido y centro de laterales/carrileros y extremos. |
| $A_7$ | *Psychological Resilience* (Compostura bajo Presión) | Resistencia colectiva a micro-lapsos bajo alto PPM. |
| $A_8$ | *Residual Energy* (Energía Residual en Vivo) | Promedio actual de `fitness / 100` de los 10 jugadores de campo en el tick $t$. |
| $A_9$ | *Team Morale & Momentum* (Moral y Momentum) | Modulado en vivo por diferencia de goles, goles recientes y racha de llegadas. |
| $A_{10}$ | *Time Management* (Gestión Temporal y Control) | Capacidad de retención segura de pelota, pausa y enfriamiento del ritmo. |
| $A_{11}$ | *Tactical Cohesion* (Cohesión y Sincronización) | Capacidad de sostener línea de *offside*, compresión interlineal y basculación. |
| $A_{12}$ | *Technical Base* (Base Técnica Colectiva) | Media global de `control` y `passing` de los 11 titulares. |
| $A_{13}$ | *Physical & Aerial Base* (Potencia Física y Aérea) | Media de `strength`, `jumping` y `height` normalizada. |
| $A_{14}$ | *Squad Chemistry* (Química Relacional) | Media de $\mu_{chem}$ del equipo reescalada a $[0, 1]$. |

#### 9.2. Distancia Semántica Adaptativa ($d_{adapt}$) y las 20 Estrategias Canónicas

El módulo codifica las **20 Estrategias Canónicas** $V_{strategy}^{(1..20)}$ (*Gegenpressing*, *High Pressing*, *Positional Build-up / Tiki-Taka*, *Fluid Half-Space Box*, *Fast Wing Counterattack*, *Direct Target Man Play*, *Balanced Medium Block*, *Compact Low Block / Catenaccio*, *Late Game Time-Wasting Control*, *All-Out Siege*, etc.) y evalúa:

$$d_{adapt}\left(V_{team}(t), V_{strategy}^{(k)}\right) = \sqrt{\sum_{m=1}^{14} w_m(\text{contexto}) \cdot \left(\max\left(0, V_{strategy,m}^{(k)} - V_{team,m}(t)\right)\right)^2 + 0.35 \left(V_{team,m}(t) - V_{strategy,m}^{(k)}\right)^2}$$

- **Asimetría Deliberada:** Tener menos atributo del que exige una estrategia penaliza casi $3\times$ más que tener de sobra (ej. intentar *Gegenpressing* con baja energía $A_8 = 0.30$ dispara $d_{adapt}$ y descarta la estrategia automáticamente).
- **Entrenador IA Vivo (`coachAI.js`) y Sustituciones (`evaluateSmartSubstitutions`):**
  - Preserva las exportaciones existentes (`COACH_INSTRUCTIONS`, `getCoachCoefficients`, `evaluateMatchCoach`, `updateTeamCoachDirectives`) para compatibilidad con `engine.js` y `verifyDefensiveAndBehavioralOpenManager.js`.
  - Re-evalúa $d_{adapt}$ cada 10 minutos simulados (`~220 ticks`) o tras goles/expulsiones.
  - Prioriza sustituir: 1) jugadores con `player.fitness < 45` en puestos de alto desgaste (carrileros, laterales, interiores), 2) defensores amonestados (`yellowCards >= 1`) frente a extremos veloces, y 3) jugadores que desajustan el vector $V_{team}$ respecto al nuevo plan táctico elegido.

---

## 5. Checklist Maestro de Ejecución y Verificación por Fases

| Fase | Estado | Suite de Verificación Automatizada | Criterio de Aceptación Determinista |
| :--- | :--- | :--- | :--- |
| **Fase 1 y 2** | `[IMPLEMENTADO]` | `node tests/verifyPhase1And2Fulbito2.js` | 18 Zonas, PPM en 8 octantes, Raycast, Balística 2.5D ($z, v_z, \text{spinZ}$), Contrato de 3 Defensores, Disputas en 3 capas y Arbitraje IFAB (12–22 faltas/partido). |
| **Fase 3** | `[IMPLEMENTADO]` | `node tests/verifyPhase3Fulbito2.js` | Modelo logístico xG, *Breakaway Override* (cero pasos atrás en 1v1), *Overlaps/Underlaps*, *Rest Defence* y `passEvaluator.js` por $\Delta\text{xThreat}$. |
| **Fase 4** | `[IMPLEMENTADO]` | `node tests/verifyPhase4Fulbito2.js` | Escaneo cognitivo $T_{scan} \in [3, 18]$, micro-lapsos por presión, Química $\mu_{chem} \in [0.85, 1.15]$ y catálogo de 6 *Traits* incluyendo `SWEEPER_KEEPER`. |
| **Fase 5** | `[IMPLEMENTADO]` | `node tests/verifyPhase5Fulbito2.js` | Máquina de las 4 Fases del Continuum en `matchContext.js`, ventanas de *Gegenpressing* (5s) y *Contraataque* (8s), y cinemática en `steering.js` (`sprintRamp`, giro $>90^\circ$, `movementEffort`). |
| **Fase 6** | `[IMPLEMENTADO]` | `node tests/verifyPhase6Fulbito2.js` | Orquestador HFSM con histéresis (`8–14 ticks`), 61 estados en `{goalkeeper,defender,midfielder,forward}States.js`, `FWD_PINNING_CB`, `FWD_FALSE_NINE_DROP`, arqueo anti-offside (`ARCING_RUN`), Caja en *Half-Spaces* y exclusión de celdas (`enforceRationalSpaceOccupation`). |
| **Fase 7** | `[IMPLEMENTADO]` | `node tests/verifyPhase7Fulbito2.js` | Duelo aéreo `resolveAerialDuel`, atajada 2.5D `resolveGoalkeeperSave25D` (3 resultados), regate 1v1 en `duelEvaluator.js`, córners zonales/mixtos y penales `GK-Dependent` vs `GK-Independent`. |
| **Fase 8** | `[IMPLEMENTADO]` | `node tests/verifyPhase8Fulbito2.js` | Familias de 3, 4 y 5 defensas en `formations.js`, los 15 Roles Funcionales + 3 Duties en `rolesAndDuties.js` y `tacticalModel.js`. |
| **Fase 9** | `[IMPLEMENTADO]` | `node tests/verifyPhase9Fulbito2.js` | Vector de 14 Macro-Atributos, 20 Estrategias Canónicas y distancia $d_{adapt}$ en `semanticDSS.js`, `coachAI.js` con sustituciones inteligentes, soporte en `TacticsBoard.jsx` y pipeline integral de tests al 100%. |
