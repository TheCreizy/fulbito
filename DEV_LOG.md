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
