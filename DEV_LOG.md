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
