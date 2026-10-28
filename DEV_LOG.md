# Bitácora de Decisiones Técnicas y Tácticas (DEV_LOG)

### [2026-10-24] - Fase 1 y 2: Plan Maestro de Ingeniería y Adaptación Espacial Fulbito 2.0
* **Archivos tocados:** `implementation_plan.md`, `DEV_LOG.md`
* **Qué se hizo:** Se completó el análisis exhaustivo del código actual (`src/engine/`, `src/components/`, `tests/`), documentos rectores (`AGENTS.md`, `design-paterns.md`, `Rediseño del Motor Fulbito 2.md`, `ESPECIFICACIÓN DE INGENIERÍA E IMPLEMENTACIÓN_ 1 y 2.md`) y el repositorio de referencia `open_football_engine`. Se definió el plan de ingeniería para Fase 1 (18 Zonas, Presión PPM, Raycast, Balística 2.5D) y Fase 2 (Bloque defensivo compacto, Contrato de 3 Defensores, Disputas en 3 capas, Arbitraje IFAB y Ley de Ventaja) estableciendo el puente de coordenadas $(u, v)$ normalizadas sobre la cancha de $680 \times 1050$ px ($10\text{ px/m}$) sin romper contratos con la interfaz gráfica ni tests existentes.
* **Por qué (Justificación Técnica/Táctica):** Evita desfasajes espaciales entre los esquemas teóricos y el renderizado en canvas de Fulbito, preservando la compatibilidad absoluta con `MatchSimulator.jsx`, `TacticsBoard.jsx` y `commentaryEngine.js`, a la vez que introduce rigurosidad matemática en basculación, presión zonal y balística.
* **Estado de Tests:** 12 suites de prueba existentes verificadas al 100% con `npm test` (0 fallos).

### [2026-10-24] - Fase 1 y 2: Implementación de Fundaciones Espaciales, Balística 2.5D, Bloque Defensivo y Duelos en 3 Capas
* **Archivos tocados:** `src/engine/space/pitchZones.js`, `src/engine/space/pressureMap.js`, `src/engine/space/raycast.js`, `src/engine/ball/ballPhysics.js`, `src/engine/ballMovement.js`, `src/engine/teamShape.js`, `src/engine/playerMovement.js`, `src/engine/officiating/referee.js`, `src/engine/ballContest.js`, `package.json`, `tests/verifyPhase1And2Fulbito2.js`
* **Qué se hizo:** Se implementó la Fase 1 y Fase 2 completas de Fulbito 2.0 según la especificación:
  1. Grilla táctica de 18 Zonas, 5 Carriles Verticales y matriz xThreat con conversión bidireccional de coordenadas relativas $(u, v)$.
  2. Mapa de presión individual PPM con 8 octantes, cono de visión frontal ($1.25\times$), punto ciego ($1.15\times$) y raycasting de pasillos libres.
  3. Balística 2.5D continua con gravedad ($g=0.28$), comba por efecto Magnus ($spinZ$), rebotes con restitución y amortiguación, y predicción anticipada de aterrizaje (`predictBallLanding`).
  4. Bloque defensivo dinámico con triggers de presión (`TOUCHLINE_TRAP`, `BACK_TO_GOAL`, `HEAVY_TOUCH`), basculación transversal, balance del lado débil ($38\%$) y regla del hombre libre (+1 / Spare Man con pivote Lavolpiana).
  5. Contrato de 3 defensores (`FIRST_DEFENDER_DELAY`, `SECOND_DEFENDER_COVER` con permutas y `MARKING_TIGHT` / `HOLDING_LINE_BALANCE`).
  6. Disputas en 3 capas: Capa 1 intercepciones limpias ($0\%$ fouls), Capa 2 Jockey y duelos hombro a hombro ($<5\%$ fouls), Capa 3 tackle con cooldown de 55 ticks y autoprotección disciplinaria (`Restraint`: $-55\%$ con amarilla, $-50\%$ en área propia).
  7. Arbitraje IFAB con ley de la ventaja, faltas tácticas (SPA) y DOGSO.
* **Por qué (Justificación Técnica/Táctica):** Elimina el desorden defensivo (montoneras detrás de la pelota), erradica el exceso de faltas irreales mediante la separación de duelos corporales e intercepciones del tackle, e introduce física tridimensional sin alterar los contratos con la UI ni con las suites de prueba históricas.
* **Estado de Tests:** 13/13 suites de prueba verificadas al 100% con `npm test` (incluyendo `tests/verifyPhase1And2Fulbito2.js`).

### [2026-10-25] - Fase 1 y 2: Integración Activa en el Loop del Partido, Corrección de Nomenclatura y Calibración IFAB
* **Archivos tocados:** `src/engine/engine.js`, `src/engine/actions.js`, `src/engine/ballMovement.js`, `src/engine/playerMovement.js`, `src/engine/setPositions.js`, `src/engine/teamShape.js`, `src/engine/ballContest.js`, `src/engine/officiating/referee.js`, `tests/verifyPhase1And2Fulbito2.js`
* **Qué se hizo:** Se integraron completamente los módulos de Fases 1 y 2 en el loop de simulación en vivo del motor (`engine.js`, `actions.js`, `playerMovement.js`, `setPositions.js` y `ballMovement.js`):
  1. Se corrigió `resolvePlayerLine` para soportar de forma nativa la taxonomía de posiciones de Fulbito (`'GK'`, `'DEF'`, `'ME'` y `'DEL'`), evitando reclasificar a los mediocampistas (`'ME'`, `'MC'`, `'MCD'`, `'MD'`, `'MI'`) como delanteros.
  2. Se conectó en cada tick la orientación corporal dinámica `player.facingAngle` y la telemetría `player.pressurePPM`, `player.zone18` y `player.lane` para los 22 futbolistas.
  3. Se conectó el contrato defensivo en `setDefendingTeamPositions`, asignando a los defensores sus roles activos (`FIRST_DEFENDER_DELAY`, `SECOND_DEFENDER_COVER`, `MARKING_TIGHT`, `HOLDING_LINE_BALANCE`).
  4. Se integró la balística 2.5D con trayectoria parabólica continua (`ball.z`, `ball.vz`), efecto Magnus y predicción de impacto `ball.landingPoint` en `ballMovement.moveBall`.
  5. Se reemplazó el tackle viejo en `actions.resolveTackle` y `actions.resolveSlide` por la resolución en 3 capas de `ballContest.js` y el arbitraje calibrado IFAB de `officiating/referee.js`.
  6. Se calibró la frecuencia de disputas y disciplina en 10 partidos reales (20,000 iteraciones): 12.6 faltas/partido, 3.9 amarillas/partido, 0.00 rojas directas desmedidas, con altura $Z$ de balón alcanzando $116\text{ px}$.
* **Por qué (Justificación Técnica/Táctica):** Resuelve la desconexión del loop principal detectada en la auditoría forense, asegurando que las innovaciones tácticas y físicas de Fulbito 2.0 impacten directamente en los partidos en vivo de React (`MatchSimulator.jsx`) sin romper contratos ni alterar la base de datos de jugadores.
* **Estado de Tests:** 13/13 suites de prueba verificadas al 100% con `npm test` (incluyendo `tests/verifyPhase1And2Fulbito2.js` con telemetría en tiempo real sobre 438,680 registros).

### [2026-10-25] - Fase 3: Ataque Total, Modelo xG, Breakaway Override, Rest Defence y Utility AI de Pases
* **Archivos tocados:** `src/engine/evaluators/shotEvaluator.js`, `src/engine/evaluators/passEvaluator.js`, `src/engine/tactics/offensiveShape.js`, `src/engine/engine.js`, `src/engine/playerMovement.js`, `src/engine/actions.js`, `src/engine/ballMovement.js`, `src/engine/space/pitchZones.js`, `src/engine/teamShape.js`, `package.json`, `tests/verifyPhase3Fulbito2.js`
* **Qué se hizo:**
  1. Se implementaron los 3 detalles técnicos de la auditoría de Fase 2: eliminación del doble decremento de cooldowns (dejando a `engine.js` como único dueño), conexión completa de `p.defensiveTarget` (`SECOND_DEFENDER_COVER`, `MARKING_TIGHT`, `HOLDING_LINE_BALANCE`) y normalización de arrays de defensores en `teamShape.js`.
  2. Se creó el evaluador de tiro `shotEvaluator.js` con formulación logística de xG (Clear Cut, Half Chance, Speculative) y el *Breakaway Override*, que prohíbe frenar o retroceder a cualquier atacante mano a mano con el arquero rival e impulsa sprint directo al arco.
  3. Se creó la máquina de estados ofensiva sin balón `offensiveShape.js`, gestionando el triángulo de *Rest Defence* (regla de 3 atrás con centrales y pivote), desdoblamientos agresivos de laterales (`OVERLAPPING` por cal y `UNDERLAPPING` por half-space), rupturas diagonales `RUNNING_IN_BEHIND` controladas con la línea de fuera de juego `computeOffsideLineY`, y ataque coordinado a las 4 Zonas de Remate (`BOX_ZONE_1` a `BOX_ZONE_4`).
  4. Se implementó el evaluador multicriterio de pases `passEvaluator.js` basado en $\Delta\text{xThreat}$, geometría diagonal, espacio libre de marcas ($1 - \text{PPM}$) y bonificaciones de ruptura y cambio de orientación aéreo.
  5. Se conectaron en vivo `updateSpatialAndTacticalTelemetry` en `engine.js`, `decideMovement` y `getSmartDribbleMove` en `playerMovement.js`, `selectAction` en `actions.js`, y la selección de destinatario en `ballMovement.js`.
  6. Se creó la suite `tests/verifyPhase3Fulbito2.js` y se incorporó al runner principal de `package.json`.
* **Por qué (Justificación Técnica/Táctica):** Erradica definitivamente las conductas anómalas en el último tercio (delanteros que frenaban o pasaban atrás teniendo camino libre de gol, laterales que no subían y falta de desmarques coordinados en centros), dotando a la ofensiva de variedad, inteligencia geométrica y realismo visual.
* **Estado de Tests:** 14/14 suites de prueba verificadas al 100% con `npm test` (0 fallos históricos y todas las especificaciones de Fase 3 aprobadas).

### [2026-10-25] - Fase 4: Cognición Perceptiva, Química de Plantilla, Traits y Pulido Táctico
* **Archivos tocados:** `src/engine/player/effectiveSkill.js`, `src/engine/player/cognition.js`, `src/engine/evaluators/passEvaluator.js`, `src/engine/evaluators/shotEvaluator.js`, `src/engine/actions.js`, `src/engine/ballContest.js`, `src/engine/ballMovement.js`, `src/engine/engine.js`, `src/engine/setPositions.js`, `src/engine/space/pitchZones.js`, `src/engine/officiating/referee.js`, `package.json`, `tests/verifyPhase4Fulbito2.js`
* **Qué se hizo:**
  1. **Pulido de Fase 3:** Se optimizó `setPositions.js` eliminando llamadas redundantes a `buildTeamShape` cuando los anclajes ya estaban calculados en el tick, y se potenció el pase filtrado (`throughBall`) en `actions.js` cuando `bestPass.type === 'THROUGH' && bestPass.utility > 0.35`.
  2. **Proceso Perceptivo-Cognitivo:** Se creó `src/engine/player/cognition.js`, gobernando el escaneo visual cervical dinámico ($T_{scan} \in [3, 18]$ ticks según percepción y agilidad), el estado de pre-escaneo (`isPreScanned`) y la generación de micro-lapsos cognitivos por estrés bajo presión extrema ($PPM > 0.60$).
  3. **Química de Plantilla Real:** Se implementó `computeSquadChemistryMultipliers` en `effectiveSkill.js`, mapeando vínculos de Club, Nacionalidad y Liga en $\mu_{chem} \in [0.85, 1.15]$, con compatibilidad total para Leyendas/Ídolos universales ($\mu_{chem} = 1.15$).
  4. **Catálogo e Inferencia de Rasgos (Traits):** Se implementaron `PLAYER_TRAITS` (`PLAYMAKER`, `CLINICAL_FINISHER`, `LONG_SHOT_SPECIALIST`, `SPEED_DRIBBLER`, `BALL_WINNER`, `SWEEPER_KEEPER`) y la función `getEffectiveSkill(player, stat)` aplicando $\mu_{chem}$, traits y compostura.
  5. **Integración en Evaluadores y Loop en Vivo:**
     - `passEvaluator.js`: Se integró la bonificación de Playmaker (+0.18 a zonas de peligro), combinaciones de 3.er hombre (+0.14) y mitigación del 75% de penalización por orientación física si el pasador cuenta con `isPreScanned`.
     - `shotEvaluator.js`: Se incorporó el bonus de `CLINICAL_FINISHER` (+15% xG en ocasiones claras) y el gatillo en Zona 14 para `LONG_SHOT_SPECIALIST` hasta 285px.
     - `ballContest.js` y `ballMovement.js`: Se vincularon `BALL_WINNER` (+15% tackle, -30% faltas), `SPEED_DRIBBLER` (+15% evasión), efecto Magnus con rotación $spinZ$ en tiros lejanos y precisión de pase modulada por visión cognitiva.
  6. **Suite de Verificación:** Se creó `tests/verifyPhase4Fulbito2.js` validando los 6 pilares de Fase 4 y se añadió `"test:phase4"` al pipeline general de pruebas.
* **Por qué (Justificación Técnica/Táctica):** Dota a los jugadores de individualidad y cerebro futbolístico, diferenciando con precisión a los organizadores cerebrales, finalizadores letales y recuperadores de balón, conectando la química de plantilla con el rendimiento físico y técnico sin alterar las bases de datos fijas ni romper la arquitectura React.
* **Estado de Tests:** 15/15 suites de prueba verificadas al 100% con `npm test` (0 errores).

### [2026-10-25] - Fase 4: Pulido de Auditoría, Sweeper Keeper y Limpieza de Roles
* **Archivos tocados:** `src/engine/playerMovement.js`, `src/engine/actions.js`, `src/engine/ballContest.js`, `src/engine/teamShape.js`, `src/engine/officiating/referee.js`, `tests/verifyPhase4Fulbito2.js`
* **Qué se hizo:**
  1. **Comportamiento activo de Sweeper Keeper (`SWEEPER_KEEPER`):** En `playerMovement.js`, el arquero con este rasgo se posiciona $18\text{ px}$ más adelantado acompañando al bloque en fase con posesión, y reacciona de forma anticipada ante pases filtrados (`THROUGH`) o balones divididos en su tercio defensivo transitando a `action = 'intercept'`. En `ballContest.js`, se le otorgó un $+35\%$ en radio de corte e intercepción de balón suelto. En `actions.js`, se configuró la distribución para priorizar pases filtrados y salida asociativa sobre despejes ciegos.
  2. **Limpieza de cálculo defensivo en `teamShape.js`:** En `assignDefensivePlanWithIncumbency`, se eliminó la recalculación duplicada de roles defensivos y anclajes cuando ya fueron provistos dinámicamente por `updateSpatialAndTacticalTelemetry` en `engine.js`.
  3. **Calibración IFAB estricta:** En `referee.js`, la Ley de la Ventaja se condicionó estrictamente a que el equipo atacante conserve el balón con espacio (`attackerTeamKeepsBallWithSpace === true`), manteniendo las faltas y tarjetas en los rangos IFAB estándar.
  4. **Suite de verificación:** Se expandió `tests/verifyPhase4Fulbito2.js` validando la inferencia y el corte de balón dividido del `SWEEPER_KEEPER`.
* **Por qué (Justificación Técnica/Táctica):** Resuelve los 3 puntos señalados en el dictamen forense de Fase 4, activando el rasgo del arquero líbero en el movimiento espacial y la toma de decisiones, eliminando redundancias de cálculo en el motor defensivo y asegurando fidelidad reglamentaria IFAB.
* **Estado de Tests:** 15/15 suites de prueba verificadas al 100% con `npm test` (0 fallos).

### [2026-10-27] - Fase 5 a 9 (Plan Maestro 2.2): Migración Documental Integral y Arquitectura de Contexto Fulbito 2.2
* **Archivos tocados:** `Rediseño del Motor Fulbito 2.md`, `AGENTS.md`, `design-paterns.md`, `notas_analisis_proyecto(old).md`, `.agent/skills/graphical-apps-development/SKILL.md`, `.cursor/rules/graphical-apps-development.mdc`, `DEV_LOG.md`
* **Qué se hizo:**
  1. Se refactorizó `Rediseño del Motor Fulbito 2.md` bajo el estándar `llm.md/tech-docs` integrando el 100% de la especificación de `UPDATE FULBITO 2.2.md` (Fases 5 a 9: Continuum de 4 Fases y `steering.js` biomecánico, HFSM de 61 estados por línea con histéresis y exclusión de celdas, disputas 2.5D aéreas/atajadas/regate 1v1/córners/penales psicológicos, 15 Roles + 3 Duties en familias de 3-4-5 defensas, y motor semántico DSS de 14 dimensiones y 20 estrategias canónicas).
  2. Se reestructuró `AGENTS.md` aplicando *Progressive Disclosure* (tabla de enrutamiento de contexto por directorio, protocolo de memoria persistente entre sesiones de Antigravity, presupuesto compacto `<6 KB` para garantizar inlining permanente y preservación estricta de invariantes de UI, base de datos y coordenadas `(u, v)`).
  3. Se limpió y actualizó `design-paterns.md` a Fulbito 2.2 (eliminando el bloque markdown anidado malformado y sincronizando las rutas reales de `src/engine/`).
  4. Se purgó de `.cursor/rules/graphical-apps-development.mdc` una regla ajena (`Pyllments` en Python) reemplazándola por los contratos reales de Model-View y coordenadas normalizadas de Fulbito 2.2, en sincronía con `.agent/skills/graphical-apps-development/SKILL.md`.
* **Por qué (Justificación Técnica/Táctica):** Elimina el *drift* documental entre el código real (`819eaa0`) y los documentos de diseño, previene el fenómeno *Lost-in-the-Middle* en agentes mediante tablas declarativas de alta densidad y deja trazada con precisión milimétrica la hoja de ruta de las Fases 5 a 9 sin contradicciones ni referencias a archivos inexistentes.
* **Estado de Tests:** 15/15 suites de prueba verificadas al 100% con `npm test`.

### [2026-10-28] - Fase 5 (Fulbito 2.2): Continuum Táctico de 4 Fases, Transiciones (Gegenpressing / Contraataque) y Cinemática Biomecánica
* **Archivos tocados:** `src/engine/core/rng.js`, `src/engine/core/matchContext.js`, `src/engine/steering.js`, `src/engine/engine.js`, `src/engine/playerMovement.js`, `src/engine/evaluators/passEvaluator.js`, `tests/verifyPhase5Fulbito2.js`, `package.json`, `Rediseño del Motor Fulbito 2.md`, `DEV_LOG.md`
* **Qué se hizo:**
  1. Se creó `src/engine/core/rng.js` con utilidades matemáticas deterministas (`clamp`, `lerp`, `smoothstep`, `normalizeAngle`, `angleDiff`, `rotateAngleTowards`, `randomNormalClamped`).
  2. Se implementó `src/engine/core/matchContext.js` con la máquina de estados de las **4 Fases del Continuum Táctico** (`ORGANIZACION_OFENSIVA`, `TRANSICION_ATAQUE_DEFENSA`, `ORGANIZACION_DEFENSIVA`, `TRANSICION_DEFENSA_ATAQUE`):
     - **Transición A$\rightarrow$D (ventana de 6s / 120 ticks):** Evalúa el punto de pérdida $u_{loss} \ge 0.45$ y cercanía de $\ge 3$ jugadores propios en un radio de $18\text{ m}$ ($180\text{ px}$); dispara `COUNTER_PRESSING` (*Gegenpressing*) durante `100 ticks` ($5\text{ s}$) cazando al portador con los 3 más cercanos, o `INTENSIVE_RETREAT` (`TRACKING_BACK`) hacia las anclas de bloque.
     - **Transición D$\rightarrow$A (ventana de 8s / 160 ticks):** Calcula el **Índice de Desorden Rival** (`computeOpponentDisorderIndex`) al recuperar la pelota y activa `FAST_COUNTER` (multiplicando $\times 1.80$ la utilidad de pases verticales/filtrados en `passEvaluator.js` y penalizando pases horizontales) o `CONSOLIDATE_POSSESSION` (priorizando pases de seguridad al pivote/central libre).
  3. Se actualizó `src/engine/steering.js` incorporando las 4 mecánicas biomecánicas de Fulbito 2.2:
     - **Rampa progresiva de sprint (`sprintRamp` $\in [0, 1]$):** $\Delta\text{ramp} = 0.065 + 0.055 \cdot \text{EffectiveSkill}(\text{agility})$ (~8-9 ticks al pico en explosivos vs ~11-12 ticks en pesados).
     - **Penalización angular por giro $>90^\circ$ ($\mu_{turn}$):** $\mu_{turn} = 1.0 - (\Delta\theta/\pi)\cdot(0.65 - 0.35\cdot\text{EffectiveSkill}(\text{agility}))$ e interpolación suave de `player.facingAngle` con $\omega_{max} = 0.28 + 0.25\cdot\text{EffectiveSkill}(\text{agility})\text{ rad/tick}$.
     - **Velocidad de conducción con balón ($\mu_{carry}$):** $\mu_{carry} = 0.84 + 0.12\cdot\text{EffectiveSkill}(\text{control}) + (\text{SPEED\_DRIBBLER} ? 0.04 : 0)$.
     - **Esfuerzo por modalidad (`MOVEMENT_EFFORT`):** `WALKING` ($0.38\times$), `JOGGING_SHAPE` ($0.68\times$), `CRUISING_SUPPORT` ($0.85\times$), `SPRINTING` ($1.00\times$) y `SURGING_BURST` ($1.12\times$), conectados al drenaje proporcional de `player.fitness`.
  4. Se conectaron `updateMatchContinuum` en `engine.js` y las mecánicas de transición y cinemática en `playerMovement.js` y `passEvaluator.js`.
  5. Se creó la suite `tests/verifyPhase5Fulbito2.js` y se integró en `package.json`.
* **Por qué (Justificación Técnica/Táctica):** Cumple el 100% de la Fase 5 definida en `UPDATE FULBITO 2.2.md`, dotando al partido de ritmo temporal real entre fases de posesión y transición e inercia física realista sin giros instantáneos de $180^\circ$ a máxima velocidad.
* **Estado de Tests:** 16/16 suites de prueba verificadas al 100% (incluyendo `verifyPhase1And2Fulbito2.js`, `verifyPhase3Fulbito2.js`, `verifyPhase4Fulbito2.js` y `verifyPhase5Fulbito2.js`).

### [2026-10-28] - Fase 6 (Fulbito 2.2): HFSM por Línea (61 Estados), Histéresis Anti-Jitter y Exclusión de Celdas
* **Archivos tocados:** `src/engine/player/playerStateMachine.js`, `src/engine/player/strategies/goalkeeperStates.js`, `src/engine/player/strategies/defenderStates.js`, `src/engine/player/strategies/midfielderStates.js`, `src/engine/player/strategies/forwardStates.js`, `src/engine/space/pitchZones.js`, `src/engine/tactics/offensiveShape.js`, `src/engine/playerMovement.js`, `src/engine/engine.js`, `tests/verifyPhase6Fulbito2.js`, `package.json`, `Rediseño del Motor Fulbito 2.md`
* **Qué se hizo:** Se implementó la HFSM completa de 61 estados por línea con histéresis anti-jitter (`minHoldTicks: 8–14`) y State Overrides de 1 tick (`LOOSE_BALL_CLAIM`, `BREAKAWAY_DRIBBLE`, `SET_PIECE_HOLD`), los estados tácticos avanzados (`FWD_PINNING_CB`, `FWD_FALSE_NINE_DROP`, `FWD_RUNNING_IN_BEHIND_ARC` con desmarque arqueado `ARCING_RUN` anti-offside, y la Estructura en Caja / *Square* `MID_BOX_HALF_SPACE`), y el resolvedor de exclusión de celdas idénticas `enforceRationalSpaceOccupation` en `pitchZones.js` para forzar triangulaciones diagonales de $30^\circ\text{ a }60^\circ$.
* **Por qué (Justificación Técnica/Táctica):** Erradica el jitter o cambio caótico de decisiones tick a tick, evita la duplicación de jugadores en la misma coordenada táctica y garantiza que los delanteros nunca caminen de espaldas al caer en fuera de juego.
* **Estado de Tests:** Suite `tests/verifyPhase6Fulbito2.js` aprobada al 100% y regresión F1–F6 sin fallos.

### [2026-10-28] - Fase 7 (Fulbito 2.2): Disputas 2.5D, Regate 1v1 y Balón Parado / Penales Psicológicos
* **Archivos tocados:** `src/engine/ball/ballContest25D.js`, `src/engine/evaluators/duelEvaluator.js`, `src/engine/setFreekicks.js`, `src/engine/ballMovement.js`, `src/engine/ballContest.js`, `src/engine/actions.js`, `src/engine/engine.js`, `tests/verifyPhase7Fulbito2.js`, `package.json`, `Rediseño del Motor Fulbito 2.md`
* **Qué se hizo:**
  1. Se implementó `resolveAerialDuel` con la fórmula $S_{aerial}$ ponderando altura normalizada, salto, fuerza, percepción y bono de carrera (+0.08), generando `HEADER_SHOT`, `FLICK_ON` o despeje defensivo orientado a bandas (`DEFENSIVE_CLEARANCE_WIDE`).
  2. Se implementó `resolveGoalkeeperSave25D` evaluando Reach tridimensional $(Reach_{XY}, Reach_{Z})$, visión tapada por tráfico (`screenedShot`), bono de $+15\%$ por `GK_SPLIT_STEP` y los 3 desenlaces (`CLEAN_CATCH`, `PARRY_SAFE` a córner y `REBOUND_DANGER` vivo en Z17).
  3. Se creó `duelEvaluator.js` con evaluación de regate 1v1 y finta biomecánica ($35^\circ\text{–}55^\circ$), dejando clavado al defensor con `interceptCooldown = 25` ticks.
  4. Se estructuró el sistema mixto/zonal de córners defensivos (2 zonales en primer palo, 3 marcas individuales en penal/2do palo, 1 escudo en Z14 y 2 outlets de contra) y ofensivos con comba Magnus (`IN_SWINGER` vs `OUT_SWINGER`).
  5. Se implementó el motor cognitivo de penales psicológicos `resolvePsychologicalPenalty` con bifurcación en `GOALKEEPER_DEPENDENT` (paradinha y lectura) vs `GOALKEEPER_INDEPENDENT` (potencia y colocación a postes).
* **Por qué (Justificación Técnica/Táctica):** Integra la tercera dimensión en los balones parados y centros, individualiza las definiciones de penal entre ejecutores cerebrales y rematadores potentes, e introduce fintas reales en el uno contra uno.
* **Estado de Tests:** Suite `tests/verifyPhase7Fulbito2.js` aprobada al 100%.

### [2026-10-28] - Fase 8 (Fulbito 2.2): Genealogía de Sistemas (3, 4 y 5 DEF) y los 15 Roles + 3 Duties
* **Archivos tocados:** `src/data/formations.js`, `src/engine/tactics/rolesAndDuties.js`, `src/engine/tactics/tacticalModel.js`, `tests/verifyPhase8Fulbito2.js`, `package.json`, `Rediseño del Motor Fulbito 2.md`
* **Qué se hizo:**
  1. Se expandió el catálogo de formaciones en `formations.js` con las 3 familias defensivas completas: 3 Defensas (`3-4-3`, `3-5-2`), 4 Defensas (`4-4-2`, `4-3-1-2`, `4-3-3`, `4-2-3-1`, `4-1-4-1`) y 5 Defensas (`5-3-2`, `5-4-1`), totalizando 9 sistemas con 11 slots coordinados.
  2. Se creó `rolesAndDuties.js` con la taxonomía completa de los 15 Roles Funcionales de campo + 2 variantes de portería y los 3 Duties (`DEFEND`, `SUPPORT`, `ATTACK`), con validación de tareas permitidas y asignación automática por formación.
  3. Se creó `tacticalModel.js` con alturas de bloque (`LOW_BLOCK` a 180px, `MID_BLOCK` a 290px, `HIGH_PRESS` a 420px), anchura (`COMPACT`, `BALANCED`, `WIDE`) y fluidez táctica.
* **Por qué (Justificación Técnica/Táctica):** Permite representar fielmente cualquier escuela táctica del fútbol mundial (desde el catenaccio con líbero hasta el fútbol total holandés o el juego de posición contemporáneo) modulando el comportamiento espacial de cada jugador de forma determinista.
* **Estado de Tests:** Suite `tests/verifyPhase8Fulbito2.js` aprobada al 100%.

### [2026-10-28] - Fase 9 (Fulbito 2.2): Motor Semántico DSS (14 Dimensiones + 20 Estrategias) y CoachAI Adaptativo
* **Archivos tocados:** `src/engine/tactics/semanticDSS.js`, `src/engine/coachAI.js`, `src/components/TacticsBoard.jsx`, `tests/verifyPhase9Fulbito2.js`, `package.json`, `Rediseño del Motor Fulbito 2.md`
* **Qué se hizo:**
  1. Se implementó `semanticDSS.js` con el espacio vectorial $V_{team}(t) \in [0, 1]^{14}$ (fuerza ofensiva, solidez defensiva, creatividad, velocidad de transición, presión, amplitud, compostura, energía residual en vivo, moral, gestión temporal, cohesión, base técnica, poderío físico/aéreo y química relacional).
  2. Se programó el catálogo de las 20 Estrategias Canónicas y la métrica de distancia asimétrica $d_{adapt}$ con el buscador de afinidad óptima `findClosestCanonicalStrategy`.
  3. Se implementó `evaluateSmartSubstitutions` en `coachAI.js` para gestionar sustituciones automáticas por fatiga crítica (`player.fitness < 45`), protección por tarjeta amarilla y ajustes tácticos respetando el límite IFAB de 5 cambios.
  4. Se integraron las nuevas formaciones en `TacticsBoard.jsx` preservando el 100% de los contratos de la interfaz gráfica de usuario.
* **Por qué (Justificación Técnica/Táctica):** Cierra el ciclo de inteligencia colectiva de Fulbito 2.2, dotando a los directores técnicos de adaptación dinámica basada en datos multidimensionales y sustituciones oportunas que reflejan el cansancio real de los partidos.
* **Estado de Tests:** Suite `tests/verifyPhase9Fulbito2.js` aprobada al 100% y suite completa de regresión general (`npm test`, 19 suites) aprobada al 100% con 0 errores.
