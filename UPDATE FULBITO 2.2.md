# **DOCUMENTO MAESTRO DE ARQUITECTURA Y REDISEÑO: MOTOR DE SIMULACIÓN «FULBITO 2.2» (ESPECIFICACIÓN INTEGRAL DE LO FALTANTE)**

Este documento constituye la hoja de ruta definitiva para completar la transformación de **fulbito** hacia **Fulbito 2.2**, recuperando el **100% del rigor matemático, biomecánico y táctico** concebido en Rediseño del Motor Fulbito 2.md, los tratados tácticos (Manual Exhaustivo de Táctica y Conceptos Futbolísticos.md, Compendio Táctico Integrado.md, Annalizis de futbol, Periodización Táctica y Modelo DSS) y la ingeniería del motor en Rust (engine).  
El objetivo de esta especificación es **erradicar toda simplificación adoptada entre los commits 1d6d549 y 819eaa0** y ordenar en fases atómicas, prolijas y auditables cada componente pendiente antes de escribir una sola línea adicional de código.

## **1\. AUDITORÍA DE ESTADO ACTUAL (BASELINE 819eaa0): ¿QUÉ TENEMOS Y QUÉ NOS FALTA?**

### **1.1. Lo que YA está construido y verificado en el repositorio (819eaa0)**

> 1. **Geometría Base (src/engine/space/pitchZones.js, pressureMap.js, raycast.js):** Mapeo de las 18 Zonas, los 5 Carriles Verticales, matriz ZONE\_XTHREAT, cálculo del *Player Pressure Map* (PPM) en 8 octantes y proyección de conos libres por *raycasting*.  
> 2. **Balística 2.5D (src/engine/ball/ballPhysics.js y ballMovement.js):** Gravedad ($g=0.28$), resistencia del aire, comba por efecto Magnus (spinZ), restitución de pique y predicción analítica del punto de caída (predictBallLanding).  
> 3. **Bloque Defensivo y Arbitraje Base (src/engine/teamShape.js, ballContest.js, officiating/referee.js):** Alturas de bloque, basculación lateral, regla del $+1$ (*Spare Man*), contrato de 3 defensores (FIRST\_DEFENDER\_DELAY, SECOND\_DEFENDER\_COVER, MARKING\_TIGHT, HOLDING\_LINE\_BALANCE), disputas en 3 capas en suelo (intercepción, carga de cuerpo y *tackle* con *cooldown* de 55 ticks) y autoprotección por amarilla (Restraint).  
> 4. **Evaluadores Base (shotEvaluator.js, passEvaluator.js) y Cognición/Química (cognition.js, effectiveSkill.js):** Modelo logístico de xG, *Breakaway Override* básico, evaluador de pases por \$\\Delta\\text{xThreat}\$, frecuencia de *Scanning* (${T}_{scan}\in [3,18]$), micro-lapsos por presión, Química ${\mu }_{chem}\in [0.85,1.15]$ y catálogo de 6 *Traits* incluyendo SWEEPER\_KEEPER.

### **1.2. Radiografía de las 7 Brechas Arquitectónicas que quedaron simplificadas o ausentes**

Al contrastar el repositorio actual (819eaa0) contra la especificación original de Rediseño del Motor Fulbito 2.md y el motor engine, identificamos **7 omisiones críticas**:

> 1. **Brecha 1 — Ausencia de Máquinas de Estados Finitos Jerárquicas (HFSM) reales por línea (playerState.js y strategies/\*States.js):**  
   * En el diseño original establecimos que playerMovement.js y actions.js debían dividirse en máquinas de estados explícitas para GK (14 estados), DEF (16 estados), MID (16 estados) y FWD (15 estados), con contratos de entrada, permanencia (*hysteresis*) y salida como en engine/src/match/engine/player/strategies/.  
   * Hoy en 819eaa0 solo existe offensiveShape.js, que asigna una coordenada \[targetX, targetY\] sin memoria de estado ni transiciones reales.  
> 2. **Brecha 2 — Estados faltantes en Delanteros, Mediocampistas y Exclusión Espacial de Celdas:**  
   * En offensiveShape.js todos los delanteros sin balón caen siempre en RUNNING\_IN\_BEHIND. Faltan los estados **PINNING\_CB** (fijar físicamente a los centrales rivales para liberar la Zona 14), **FALSE\_NINE\_DROP** (descenso a Zona 11/14 frente a bloques bajos para activar combinaciones de Tercer Hombre), **CREATING\_SPACE** (arrastre horizontal de marcas) y el **arqueo horizontal de carrera** sobre la línea de *offside* para no quedar inhabilitado ni retroceder.  
   * En mediocampo falta la **Estructura en Caja (*Box/Square*)** en los *Half-Spaces* (2 pivotes en Zonas 8/11 \+ 2 mediapuntas en Zonas 10/12/14 fijando a 4 defensores) y el **Resolvedor de Colisión de Celdas (zone18, lane)** que prohíbe que dos compañeros ocupen el mismo sub-espacio simultáneamente.  
> 3. **Brecha 3 — Cinemática y Esfuerzo Biomecánico intactos (steering.js sin tocar):**  
   * src/engine/steering.js no recibió ninguna de las mecánicas de engine/src/match/engine/player/behaviours/steering.rs y states/exertion/: falta la **rampa de aceleración de sprint (sprint\_ramp)**, la **inercia rotacional al girar $>9{0}^{\circ }$ gobernada por agility**, la penalización de velocidad al conducir modulada por control y las curvas de esfuerzo por estado (Walking, Jogging, Tracking, Sprinting).  
> 4. **Brecha 4 — Ausencia del Continuum Táctico de 4 Fases y Transiciones (matchContext.js / phase.rs):**  
   * El motor actual solo distingue entre "tener posesión" y "no tener posesión". No existe la máquina de estados de las **4 Fases del Continuum Táctico**:  
     1. *Organización Ofensiva*.  
     2. *Transición Ataque $\rightarrow$ Defensa* (ventana crítica de 5-6 segundos tras la pérdida que dispara **Gegenpressing / counter\_press.rs** o **Repliegue Intensivo**).  
     3. *Organización Defensiva*.  
     4. *Transición Defensa $\rightarrow$ Ataque* (ventana crítica de 8-10 segundos tras el robo que dispara **Contraataque Vertical Rápido** en 2-4 pases o **Consolidación/Reciclaje de Posesión**).  
> 5. **Brecha 5 — Disputas Aéreas (aerial\_duel.rs), Atajadas 2.5D (save.rs) y Evasión 1v1 (dribble\_duel.rs / marker\_evasion.rs):**  
   * Aunque la pelota tiene altura ball.z, cuando cae un centro o envío largo en 819eaa0 no existe un **Duelo Aéreo (resolveAerialDuel)** que confronte height, jumping, strength y perception (*timing* de salto) entre el cabeceador y el marcador o el puñetazo/descolgada del arquero (punching/catching).  
   * Tampoco existe el módulo de **Atajada Balística 2.5D (resolveGoalkeeperSave25D)** que evalúe saving, agility (reacción a quemarropa), jumping (alcance a los ángulos superiores $Z$) y strength (control de rebote vs. despeje a córner/costado).  
> 6. **Brecha 6 — Balón Parado Táctico y Psicología en Penales (setFreekicks.js y setPositions.js sin actualizar):**  
   * Faltan las estructuras de córner ofensivo y defensivo (corner\_shape.rs: marcaje zonal/mixto, hombre al primer palo, hombre al borde del área para rechazos y ataque coordinado a las 4 zonas) y el modelo biomecánico-psicológico de penales (**Goalkeeper-Dependent** vs. **Goalkeeper-Independent**) tanto en el partido como en la tanda de penales.  
> 7. **Brecha 7 — Genealogía de Sistemas (3, 4 y 5 Defensas), los 15 Roles \+ 3 Duties, Pizarra 2.0 y Motor Semántico DSS (coachAI.js):**  
   * Todo el **Pilar 6** (familias de formaciones de 3, 4 y 5 defensas, matriz de los 15 Roles funcionales con tareas Defend/Support/Attack, personalización de las 4 Fases del Continuum en TacticsBoard.jsx y el recomendador/entrenador IA basado en los **14 Macro-Atributos** y las **20 Estrategias Canónicas** por distancia semántica ${d}_{adapt}$) está pendiente de implementación.

## **2\. ARQUITECTURA DEFINITIVA DE ARCHIVOS DE «FULBITO 2.2»**

Esta es la estructura completa que tendrá src/engine/ al concluir las nuevas fases, sin código muerto ni parches duplicados:

Plaintext  
src/engine/  
├── core/  
│   ├── matchContext.js           \# \[NUEVO \- Fase 5\] Reloj, 4 Fases del Continuum, ventana de Gegenpressing/Contraataque y Momentum  
│   └── rng.js                    \# \[NUEVO \- Fase 5\] Utilidades matemáticas, distribuciones normales y clamps  
├── space/  
│   ├── pitchZones.js             \# \[EXISTENTE \+ UPGRADE Fase 6\] \+ Resolvedor de Ocupación Racional y Cajas en Half-Spaces  
│   ├── pressureMap.js            \# \[EXISTENTE\] Player Pressure Map (PPM) en 8 direcciones  
│   └── raycast.js                \# \[EXISTENTE\] Conos de visión y corredores libres  
├── ball/  
│   ├── ballPhysics.js            \# \[EXISTENTE\] Física 2.5D, gravedad, Magnus, bote y predicción de caída  
│   └── ballContest25D.js         \# \[NUEVO \- Fase 7\] Duelo Aéreo (aerial\_duel), Atajada 2.5D (save), Bloqueo de Tiro (block) y Dribble Duel  
├── player/  
│   ├── effectiveSkill.js         \# \[EXISTENTE\] Química (0.85-1.15), fatiga, compostura y catálogo de Traits  
│   ├── cognition.js              \# \[EXISTENTE \+ UPGRADE Fase 6\] Scanning, Memoria de 3er Hombre y Lapsos  
│   ├── playerStateMachine.js     \# \[NUEVO \- Fase 6\] Orquestador HFSM con histéresis (minTicksInState) y State Overrides  
│   └── strategies/  
│       ├── goalkeeperStates.js   \# \[NUEVO \- Fase 6\] 14 estados de GK (standing, split\_step, preparing\_for\_save, coming\_out, sweeping, etc.)  
│       ├── defenderStates.js     \# \[NUEVO \- Fase 6\] 16 estados de DEF (holding\_line, covering, marking, guarding, overlapping, underlapping, etc.)  
│       ├── midfielderStates.js   \# \[NUEVO \- Fase 6\] 16 estados de MID (box\_structure, pivot\_anchor, box\_to\_box, switching\_play, counter\_press, etc.)  
│       └── forwardStates.js      \# \[NUEVO \- Fase 6\] 15 estados de FWD (pinning\_cb, false\_nine\_drop, running\_in\_behind\_arc, breakaway, box\_zone\_1..4, etc.)  
├── evaluators/  
│   ├── passEvaluator.js          \# \[EXISTENTE \+ UPGRADE Fase 6\] \+ Pesos dinámicos según Fase del Continuum y Rol/Duty  
│   ├── shotEvaluator.js          \# \[EXISTENTE \+ UPGRADE Fase 7\] \+ Cabezazos aéreos y definición GK-Dependent vs GK-Independent  
│   └── duelEvaluator.js          \# \[NUEVO \- Fase 7\] Evaluación de regate 1v1 (marker\_evasion y dribble\_duel)  
├── tactics/  
│   ├── tacticalModel.js          \# \[NUEVO \- Fase 8\] Configuración de las 4 Fases del Continuum, Bloques, Fluidez y Estilos  
│   ├── rolesAndDuties.js         \# \[NUEVO \- Fase 8\] Los 15 Roles Funcionales \+ 3 Duties (Defend, Support, Attack) y sus matrices de movimiento  
│   ├── offensiveShape.js         \# \[EXISTENTE \-\> INTEGRAR EN HFSM Fase 6\] Coordinación espacial con exclusión de celdas  
│   └── semanticDSS.js            \# \[NUEVO \- Fase 9\] Vector de 14 Macro-Atributos, 20 Estrategias Canónicas y Distancia Semántica Adaptativa  
├── officiating/  
│   └── referee.js                \# \[EXISTENTE\] Árbitro IFAB, Ley de la Ventaja, DOGSO/SPA y Restraint  
├── engine.js                     \# \[MODIFICAR\] Tick Driver maestro conectado a matchContext y playerStateMachine  
├── steering.js                   \# \[REESCRIBIR \- Fase 5\] Sprint ramp, inercia de giro \>90° por agilidad, velocidad con balón por control y esfuerzo  
├── setFreekicks.js               \# \[REFACTORIZAR \- Fase 7\] Rutinas de córner (zonal/mixto, 4 zonas) y Penales (GK-Dependent vs Independent)  
├── coachAI.js                    \# \[REEMPLAZAR \- Fase 9\] Entrenador vivo gobernado por semanticDSS.js y sub\_scoring.js  
└── ballContest.js                \# \[MODIFICAR \- Fase 7\] Conectar con ballContest25D.js

## **3\. DESGLOSE PROFUNDO DE LO QUE FALTA (DIVIDIDO EN 5 NUEVAS FASES: FASES 5 A 9\)**

Como las **Fases 1 a 4** ya están registradas en tu DEV\_LOG.md y validadas por las suites verifyPhase1And2Fulbito2.js, verifyPhase3Fulbito2.js y verifyPhase4Fulbito2.js, numeraremos las etapas restantes desde la **Fase 5 hasta la Fase 9** para mantener una trazabilidad cronológica limpia en DEV\_LOG.md.

### **FASE 5: EL CONTINUUM TÁCTICO DE 4 FASES, TRANSICIONES (GEGENPRESSING / CONTRAATAQUE) Y CINEMÁTICA BIOMECÁNICA (steering.js)**

Esta fase dota al partido de **ritmo temporal real** (el factor *Tiempo* junto al factor *Espacio* de los manuales tácticos) y corrige la física de desplazamiento de los jugadores.

#### **5.1. Máquina de Estados del Partido: Las 4 Fases del Continuum (src/engine/core/matchContext.js)**

Inspirado en teamplay/tactical/phase.rs y player/counter\_press.rs de engine y en el Capítulo 4 del Manual Táctico:

* Cada equipo mantiene en matchDetails.tacticalPhase\[teamId\] una de las **4 Fases**:  
  1. **ORGANIZACION\_OFENSIVA:** Posesión consolidada ($>8s$ desde la recuperación o reinicio en corto). El equipo despliega amplitud en los 5 carriles y estructura de apoyo/ruptura.  
  2. **TRANSICION\_ATAQUE\_DEFENSA (Ventana de 0 a 6 segundos tras perder el balón — \~120 ticks):**  
     * Se registra el punto exacto de la pérdida $({x}_{loss},{y}_{loss})$ y el tick lossTick.  
     * **Si la táctica del equipo es Gegenpressing (*Counter-Press*)** y la pérdida ocurrió en campo rival (${u}_{loss}\geq 0.45$) con al menos 3 jugadores propios en un radio de $18m$ ($180px$): se activa el estado COUNTER\_PRESSING durante $5segundos$ (100 ticks). Los 3 jugadores más cercanos cazan al nuevo poseedor y cierran las líneas de pase cortas a máxima intensidad antes de que el rival pueda sacar la pelota de la zona de presión.  
     * **Si la táctica es Repliegue Intensivo (o falla el umbral de cercanía):** Todo el equipo activa vectores inmediatos de retroceso (TRACKING\_BACK) hacia sus anclas de bloque antes de intentar presionar.  
  3. **ORGANIZACION\_DEFENSIVA:** Se activa una vez superada la ventana de transición o cuando el bloque ya está consolidado detrás de la Línea de Confrontación.  
  4. **TRANSICION\_DEFENSA\_ATAQUE (Ventana de 0 a 8 segundos tras recuperar el balón en juego vivo — \~160 ticks):**  
     * Al robar la pelota, el motor mide el **Índice de Desorden Rival** (cuántos defensores rivales están por delante de la línea de la pelota o fuera de sus zonas de *Rest Defence*).  
     * **Modo Contraataque Vertical (FAST\_COUNTER):** Si hay espacio a la espalda rival o la instrucción táctica es vertical, durante los próximos $8segundos$ se multiplica $\times 1.80$ la utilidad de pases verticales/filtrados en passEvaluator.js, se penalizan los pases horizontales lentos y los extremos/delanteros disparan carreras inmediatas RUNNING\_IN\_BEHIND a velocidad máxima para finalizar en 2 a 4 pases.  
     * **Modo Consolidación (CONSOLIDATE\_POSSESSION):** Si el rival tiene su bloque armado o el equipo busca bajar el ritmo, el recuperador prioriza un **Pase de Seguridad (*Safety Pass*)** fuera de la zona congestionada hacia el pivote o central libre para iniciar la *Organización Ofensiva*.

#### **5.2. Cinemática Biomecánica e Inercia Rotacional (src/engine/steering.js)**

Reemplaza el movimiento lineal instantáneo de fulbito por el modelo biomecánico de engine (behaviours/steering.rs, sprint\_ramp\_tests.rs, movement\_effort.rs) y de Periodización Táctica (*aceleraciones, frenazos y cambios de dirección*):

> 1. **Rampa Progresiva de Aceleración (sprint\_ramp):**

Un jugador no pasa de $0$ a velocidad máxima en 1 tick. Mantiene una variable player.sprintRamp \\in \[0, 1\] que crece por tick según su aceleración/agilidad:

$$\Delta ramp=0.065+0.055\cdot EffectiveSkill(agility)$$

*   
  De modo que un jugador explosivo (agility \= 92\) alcanza su pico de velocidad en \~8 ticks, mientras que un jugador pesado (agility \= 60\) tarda \~12 ticks.  
> 2. **Penalización Angular por Cambio de Dirección Brusco (Giro $>9{0}^{\circ }$):**  
   * Sea $\Delta \theta =|angleDiff({\theta }_{deseado},player.facingAngle)|$.

Si $\Delta \theta >\frac{\pi }{2}$ ($9{0}^{\circ }$), el jugador debe desacelerar para rotar su centro de gravedad (*frenada y reorientación corporal*):

$${\mu }_{turn}=1.0-\left({\frac{\Delta \theta }{\pi }}\right)\cdot \left({0.65-0.35\cdot EffectiveSkill(agility)}\right)$$

*   
  Además, player.facingAngle se interpola suavemente con una velocidad angular máxima ${\omega }_{max}=0.28+0.25\cdot EffectiveSkill(agility)rad/tick$.  
> 3. **Velocidad de Conducción con Balón (*Carry Speed*):**

Conducir la pelota reduce la velocidad punta salvo en especialistas:

$${\mu }_{carry}=0.84+0.12\cdot EffectiveSkill(control)+(hasTrait(SPEED\_DRIBBLER)?0.04:0)$$

*   
> 4. **Esfuerzo por Modalidad de Movimiento (movementEffort):**  
   * Cada estado asigna una intensidad cinemática: WALKING ($0.38\times$), JOGGING\_SHAPE ($0.68\times$), CRUISING\_SUPPORT ($0.85\times$), SPRINTING ($1.00\times$) o SURGING\_BURST ($1.12\times$ en rupturas OVERLAPPING / BREAKAWAY), drenando la energía (stamina) de forma proporcional al esfuerzo real.

### **FASE 6: MÁQUINAS DE ESTADOS FINITOS JERÁRQUICAS (HFSM) POR LÍNEA, ESTADOS FALTANTES Y GEOMETRÍA COLECTIVA (TRIÁNGULOS, DIAMANTES Y CAJA)**

Esta fase elimina el manejo superficial por etiquetas y construye el verdadero cerebro posicional de engine (src/match/engine/player/strategies/).

#### **6.1. Arquitectura del Orquestador HFSM (src/engine/player/playerStateMachine.js)**

* Cada jugador posee player.fsm \= { line, currentState, ticksInState, minHoldTicks, targetX, targetY, effortMode }.  
* **Histéresis Anti-Jitter (minHoldTicks):** Para evitar que un jugador cambie de idea en cada frame y "vibre" en el lugar, todo estado normal tiene un compromiso mínimo de permanencia de **8 a 14 ticks** antes de reevaluar transiciones ordinarias, pero puede ser interrumpido en **1 tick** por un **State Override de Prioridad** (LOOSE\_BALL\_CLAIM, BREAKAWAY\_DRIBBLE, EMERGENCY\_PRESS\_STEP, SET\_PIECE\_HOLD).

#### **6.2. Las 4 Máquinas de Estados Específicas (src/engine/player/strategies/)**

> 1. **goalkeeperStates.js (Arquero — inspirado en strategies/goalkeepers/states/):**  
   * Estados: GK\_STANDING\_LINE (bajo los tres palos bisectando el ángulo de tiro), GK\_SPLIT\_STEP (pre-activación en el instante previo al remate rival para ganar \$+15\\%\$ de reflejos), GK\_PREPARING\_SAVE, GK\_COMING\_OUT\_1V1 (achique rápido reduciendo ángulo frente a un BREAKAWAY), GK\_SWEEPING (corte fuera del área de SWEEPER\_KEEPER), GK\_CLAIMING\_HIGH\_BALL (salir a descolgar centros en el área chica), GK\_DISTRIBUTING\_SHORT (salida limpia en Zona 1/2/3/4) y GK\_LAUNCHING\_COUNTER (saque largo tenso en transición D$\rightarrow$A).  
> 2. **defenderStates.js (Defensas Centrales, Líberos, Laterales y Carrileros — inspirado en strategies/defenders/states/):**  
   * **Sin balón:** DEF\_HOLDING\_LINE (línea sincronizada y achique para fuera de juego line\_step), DEF\_FIRST\_DELAY (1.er defensor en *jockey*), DEF\_SECOND\_COVER (2.º defensor cerrando espalda y listo para permuta), DEF\_MARKING\_TIGHT (marcaje mixto o al hombre), DEF\_SWEEPER\_COVER (exclusivo del **Líbero** en línea de 5: flota $3.5m$ detrás de los dos *stoppers* barriendo todo pase filtrado), DEF\_TRACKING\_BACK (repliegue intensivo en transición A$\rightarrow$D) y DEF\_AERIAL\_CLEAR.  
   * **Con posesión del equipo:** DEF\_REST\_DEFENCE (triángulo de seguridad detrás de la línea del balón), DEF\_BALL\_PLAYING\_STEP (central iniciador que conduce hasta Zona 4/8 si nadie lo presiona para atraer marca), DEF\_FULLBACK\_SUPPORT (lateral de apoyo en Zona 7/9), DEF\_INVERTED\_FULLBACK (lateral que se cierra al *Half-Space* / Zona 8 junto al pivote), DEF\_OVERLAPPING (desdoblamiento exterior a fondo por banda Zonas 13/15) y DEF\_UNDERLAPPING (ruptura interior por *Half-Space* Zonas 16/18 para *cutback*).  
> 3. **midfielderStates.js (Pivotes, Mediocentros, Interiores y Enganches — inspirado en strategies/midfielders/states/):**  
   * **Sin balón:** MID\_SHIELDING\_ZONE14 (el pivote tapona el balcón del área propia y los *Half-Spaces* 5/6), MID\_LAVOLPIANA\_DROP (incrustación entre centrales para formar el $+1$), MID\_PRESSING\_TRIGGER, MID\_COUNTER\_PRESSING (acoso de 5s tras pérdida) y MID\_SHUTTLING\_BASCULATION.  
   * **Con posesión del equipo:**  
     * MID\_PIVOT\_RECYCLE (vía de escape siempre detrás de la línea de la pelota formando la base del diamante).  
     * MID\_BOX\_HALF\_SPACE (**Estructura en Caja / *Square*** del Manual Táctico: los dos interiores/mediapuntas se posicionan en los *Half-Spaces* Zonas 10 y 12 a espaldas de los volantes rivales, formando un cuadrilátero con los dos pivotes de Zonas 8/11).  
     * MID\_THIRD\_MAN\_SUPPORT (se acerca de frente al receptor para devolver de primera al compañero que rompe en profundidad).  
     * MID\_BOX\_TO\_BOX\_LATE\_RUN (llegada por sorpresa desde segunda línea hacia la **Zona 4 de Remate / Borde del área** para recibir el *cutback* o patear de media distancia).  
> 4. **forwardStates.js (Extremos, Segundas Puntas / Falsos 9 y Delanteros Centro — inspirado en strategies/forwarders/states/):**  
   * **Los 4 Estados Sin Balón que completan el diseño original:**  
     1. **FWD\_PINNING\_CB (Fijación de Centrales):** Cuando la pelota está en creación media (Zonas 7 a 12\) y aún no hay ángulo de pase filtrado, el "9" se planta físicamente entre los dos centrales rivales en el límite del *offside*, fijándolos para que no puedan salir a presionar al enganche en la Zona 14\.  
     2. **FWD\_FALSE\_NINE\_DROP (Descenso entre líneas / Apoyo de Ruptura):** Si el rival defiende en Bloque Bajo (${u}_{zaga}<0.22$) donde no hay espacio a la espalda, o si el jugador tiene rol de *Segunda Punta / Falso 9 / Playmaker*, desciende a la Zona 11/14 para generar superioridad numérica en el medio, arrastrar al central fuera de la cueva y habilitar la diagonal del extremo a su espalda.  
     3. **FWD\_RUNNING\_IN\_BEHIND\_ARC (Ruptura Diagonal \+ Arqueo Anti-Offside):** Traza la diagonal desde el punto ciego del defensor hacia el espacio libre. **Regla de Oro Anti-Paso Atrás:** Si el delantero alcanza safeOffsideU antes de que el pasador suelte el balón, **jamás camina hacia atrás**; transiciona a un **arqueo horizontal paralelo a la línea defensiva (ARCING\_RUN)** manteniendo su velocidad e inercia lista para girar hacia el arco en el instante del pase.  
     4. **FWD\_HOLDING\_WIDTH\_ISOLATION (Fijación de Amplitud):** El extremo se pega a la línea de cal en Zonas 13/15 para estirar horizontalmente a la defensa rival y aislar al lateral en 1v1, o bien se mete en diagonal al *Half-Space* (INVERTED\_WINGER\_CUT) apenas detecta que su propio lateral inició un DEF\_OVERLAPPING.  
   * **En centro/desborde:** FWD\_BOX\_ZONE\_1 (Primer palo), FWD\_BOX\_ZONE\_2 (Punto penal), FWD\_BOX\_ZONE\_3 (Segundo palo) y FWD\_BOX\_ZONE\_4 (*Cutback*).  
   * **Con balón:** FWD\_BREAKAWAY\_DRIBBLE (mano a mano directo al arco), FWD\_1V1\_ISOLATION\_DRIBBLE (encarar al lateral en banda) y FWD\_HOLD\_UP\_PLAY (aguantar de espaldas con strength esperando la subida de los volantes).

#### **6.3. Resolvedor de Exclusión Espacial y Geometría de Triángulos (src/engine/space/pitchZones.js)**

Para cumplir con la Sección 1.3 del Manual Táctico (*Evitar estructuras paralelas de 180°, garantizar Triángulos, Diamantes y Cajas*):

* Al final de la asignación de targets ofensivos en cada tick, la función enforceRationalSpaceOccupation(attackingPlayers, ball, pitchBounds) verifica la matriz de ocupación de las 18 Zonas y los 5 Carriles:  
  * Si dos jugadores sin balón caen en la misma celda (zone18, lane) o a menos de $11m$ ($110px$) sobre la misma línea horizontal o vertical respecto al poseedor (ángulo de $18{0}^{\circ }$ o ${0}^{\circ }$ que permite a un solo rival tapar a ambos), desplaza automáticamente al jugador de soporte hacia el carril adyacente (*Half-Space* libre) y escalona su altura en $\pm 8m$ para formar un **triángulo con ángulos diagonales de $3{0}^{\circ }a6{0}^{\circ }$**.

### **FASE 7: DISPUTAS 2.5D COMPLETAS (DUELOS AÉREOS, ATAJADAS BALÍSTICAS, EVASIÓN 1V1) Y BALÓN PARADO / PENALES PSICOLÓGICOS**

Esta fase completa toda la física de contacto de ball/contest/ de engine y la teoría de balón parado y penales del Manual Táctico.

#### **7.1. Duelo Aéreo de Cabezazo (resolveAerialDuel en src/engine/ball/ballContest25D.js)**

Adaptado de engine/src/match/engine/ball/ball/contest/aerial\_duel.rs y strategies/\*/states/heading/:

* Cuando el balón está en vuelo descendente cerca de su landingPoint con altura $8px\leq z\leq 42px$ y hay al menos un atacante y un defensor dentro del radio de disputa ($24px$):

**Puntaje de Dominio Aéreo (${S}_{aerial}$):**

$${S}_{aerial}(p)=0.35\cdot {\hat{h}}_{height}+0.35\cdot EffectiveSkill(jumping)+0.20\cdot EffectiveSkill(strength)+0.10\cdot EffectiveSkill(perception)+Bonu{s}_{carrera}$$

1.   
   donde ${\hat{h}}_{height}=clamp\left({\frac{height-165}{35},0.1,1.0}\right)$ y el jugador que viene atacando la pelota de frente a la carrera (ej. el 9 entrando al primer/segundo palo o el central saliendo a cortar) recibe un $Bonu{s}_{carrera}=+0.08$ frente al que salta estático.  
   2. **Resolución del Cabezazo:**  
      * **Si gana el Atacante:** Ejecuta un remate de cabeza al arco (si está en Zona 16/17/18, apuntando de pique al suelo o al segundo palo) o una **peinada / bajada de cabeza (*Flick-on / Knock-down*)** hacia un compañero cercano en Zona 14/17.  
      * **Si gana el Defensor:** Ejecuta un despeje de cabeza alto y hacia las bandas (heading/mod.rs) lejos de la Zona 14 central.

#### **7.2. Atajada Balística 2.5D y Control de Rebotes (resolveGoalkeeperSave25D en src/engine/ball/ballContest25D.js)**

Adaptado de engine/src/match/engine/ball/ball/contest/save.rs, reach.rs y Compendio Táctico Integrado:

* Cuando un disparo cruza el plano de la línea de meta o pasa por el radio de acción del arquero:  
  1. **Envergadura de Estirada 2.5D ($Reac{h}_{XY},Reac{h}_{Z}$):**  
     * El alcance lateral depende de saving, agility y height; el alcance vertical a los ángulos altos ($z$ cerca del travesaño) depende de jumping y height.  
     * El tiempo de reacción depende de perception (si el cono de visión del arquero tenía muchos bloqueadores delante, sufre penalización por visión tapada *screened shot*) y de si ejecutó el GK\_SPLIT\_STEP.  
  2. **Tres Resultados Físicos de la Atajada (save.rs):**  
     * **Blocaje Limpio (CLEAN\_CATCH):** Si la potencia del tiro es moderada y la habilidad saving \+ strength supera el umbral, el arquero embolsa la pelota sin dar rebote.  
     * **Desvío Seguro a Córner o Costado (PARRY\_SAFE):** Si el tiro es potente o esquinado pero el arquero tiene alto saving, desvía el vector hacia afuera de los tres palos (córner o banda).  
     * **Rebote Corto Disputable (REBOUND\_DANGER):** Ante un remate violentísimo o arquero con menor saving/strength, la pelota queda viva en la Zona 17 desencadenando el estado LOOSE\_BALL\_CLAIM de los delanteros cazagoles.

#### **7.3. Duelo de Regate 1v1 y Evasión de Marca (dribbleEvaluator.js — dribble\_duel.rs y marker\_evasion.rs)**

* Cuando un extremo o gambeteador (SPEED\_DRIBBLER) encara a su marcador en las Zonas 13, 14, 15, 16, 17 o 18, en lugar de chocar en línea recta contra el defensor, evalúa un **Vector de Finta y Cambio de Ritmo** ($3{5}^{\circ }a5{5}^{\circ }$ hacia el pie débil del defensor o hacia el *Half-Space* / línea de fondo) confrontando control \+ agility del atacante contra agility \+ perception del defensor. Si gana el duelo de finta, deja al defensor clavado (interceptCooldown \= 25\) y abre ángulo limpio de centro, *cutback* o disparo.

#### **7.4. Balón Parado Avanzado y Psicología en Penales (src/engine/setFreekicks.js)**

> 1. **Córners Ofensivos y Defensivos (officiating/corner\_shape.rs):**  
   * **Defensa Mixta/Zonal en Córner:** 2 defensores zonales fijados en el Primer Palo y área chica (*Near Post Zonal Guards* — como destaca la guía táctica para cortar el centro más peligroso), los 3 jugadores con mayor height \+ jumping \+ strength haciendo marcaje individual sobre las torres rivales en el punto penal y segundo palo, 1 jugador en la medialuna (Zona 14\) para bloquear el rebote y 1 o 2 jugadores rápidos adelantados para el contraataque.  
   * **Ataque en Córner:** Ejecución de rutinas con curva Magnus (in-swinger cerrado o out-swinger abierto) atacando coordinadamente Primer Palo, Punto Penal, Segundo Palo y Borde de Área, más opción de córner en corto si no hay superioridad aérea.  
> 2. El Duelo Cognitivo de Penales: *Goalkeeper-Dependent* vs. *Goalkeeper-Independent* (Sección 6.2 del Manual Táctico):  
   * Tanto en penales durante el partido (setFreekicks.js) como en la definición por penales (PenaltyShootoutModal), el pateador elige su estrategia según su perfil biomecánico y cognitivo:  
     * **Enfoque *Goalkeeper-Dependent* (*La Paradinha / Espera Perceptiva*):** Elegido por jugadores con alta **perception \+ control** ($\geq 82$) o rasgo PLAYMAKER / CLINICAL\_FINISHER. El pateador desacelera en el último paso y lee el movimiento anticipado del arquero: si el arquero se vence antes de tiempo, el tirador asegura el pase a la red al palo opuesto (\$94\\%\$ de efectividad), pero si el arquero tiene altísima perception y aguanta de pie hasta el último milisegundo, la menor potencia del remate aumenta la probabilidad de atajada.  
     * **Enfoque *Goalkeeper-Independent* (*Potencia y Precisión Biomecánica Pura*):** Elegido por jugadores con alto **shooting \+ strength / penalty\_taking**. El tirador ignora al arquero y busca clavar un remate potente a uno de los cuadrantes superiores o ángulos bajos; incluso si el arquero adivina el lado, necesita superar un umbral exigente de saving \+ jumping \+ agility para llegar a desviarla.

### **FASE 8: GENEALOGÍA DE SISTEMAS (3, 4 Y 5 DEFENSAS), LOS 15 ROLES FUNCIONALES \+ 3 DUTIES Y PIZARRA TÁCTICA 2.0**

Esta fase implementa el **Capítulo 1 y 2 del Compendio Táctico Integrado**, las responsabilidades de Annalizis de futbol y la matriz de Rediseño del Motor Fulbito 2.md.

#### **8.1. Catálogo Completo de Sistemas de 3, 4 y 5 Defensas (src/data/formations.js)**

Ampliaremos formations.js preservando las formaciones actuales y estructurando las tres grandes familias tácticas con sus coordenadas defensivas (Sin Balón) y sus vectores de despliegue ofensivo (Con Balón):

* **Sistemas con 3 Defensas:**  
  * 3-4-3 (En línea y en Rombo: dinamismo ofensivo y ocupación de los 5 carriles).  
  * 3-5-2 (Doble pivote \+ Enganche \+ 2 Carrileros de largo recorrido \+ 2 Puntas).  
* **Sistemas con 4 Defensas:**  
  * 4-4-2 (Clásico en línea y Variante en Rombo 4-1-2-1-2 estrecho).  
  * 4-3-3 (Con Pivote único \+ 2 Interiores \+ 2 Extremos abiertos \+ 1 Nueve).  
  * 4-2-3-1 (Doble pivote \+ 3 Mediapuntas en *Half-Spaces*/Bandas \+ 1 Nueve) y 4-1-4-1.  
* **Sistemas con 5 Defensas:**  
  * 5-3-2 (**Líbero de cobertura** \+ 2 Marcadores Centrales *Stoppers* \+ 2 Carrileros proyectables \+ 3 Medios \+ 2 Puntas).  
  * 5-4-1 (Cerrojo en bloque bajo con contragolpe directo a las bandas y al único punta).

#### **8.2. Taxonomía de los 15 Roles Funcionales \+ 3 Tareas (Defend, Support, Attack) (src/engine/tactics/rolesAndDuties.js)**

Cada jugador en la formación tiene asignado un **Rol Funcional** y una **Tarea (DEFEND, SUPPORT, ATTACK)** que parametrizan directamente su Máquina de Estados (Fase 6\) y sus pesos en passEvaluator.js y shotEvaluator.js:

> 1. **Línea de Portería:**  
   * GK\_CLASSIC (Defend): Protege los tres palos y prioriza seguridad.  
   * GK\_SWEEPER (Support / Attack): Adelanta su línea $18-25px$, barre pases largos a la espalda de la zaga e inicia salidas rápidas en Zona 1/4.  
> 2. **Línea Defensiva:**  
   * CB\_STOPPER (*Marcador Central* — Defend): Fija marca férrea sobre el 9 o enganche rival y gana duelos físicos/aéreos.  
   * CB\_BALL\_PLAYING (*Central Iniciador* — Support): Conduce hacia Zona 4/8 para atraer presión y filtra pases diagonales a los *Half-Spaces*.  
   * SW\_LIBERO (*Líbero Corrector* — Cover / Support): Exclusivo de defensas de 3/5; guarda la espalda de los *stoppers* y en posesión puede dar un paso al mediocampo como pivote extra.  
   * FB\_FULLBACK (*Lateral* — Defend / Support / Attack): Con Defend cierra en línea de 3 (*Rest Defence*); con Support ofrece apoyo en Zona 7/9; con Attack ejecuta OVERLAPPING / UNDERLAPPING constante.  
   * WB\_WINGBACK (*Carrilero* — Support / Attack): Dueño absoluto de toda la banda exterior de área a área.  
> 3. **Línea de Creación (Mediocampo):**  
   * DM\_ANCHOR (*Pivote Defensivo / Ancla* — Defend): Nunca supera la línea del balón, custodia la Zona 4/8/14 propia y se incrusta entre centrales (*Lavolpiana*) cuando hace falta el $+1$.  
   * CM\_PLAYMAKER\_DEEP (*Mediocentro Distribuidor* — Support): Eje de circulación, cambios de orientación (SWITCH) y reciclaje de posesión.  
   * CM\_BOX\_TO\_BOX (*Interior Todoterreno* — Support / Attack): Conecta ambas áreas, presiona en transición y llega por sorpresa a la Zona 4 de remate (*Cutback*).  
   * AM\_PRESSING (*Mediapunta Mixto / Defensivo* — Support): Lidera los *Pressing Triggers* sobre el pivote rival y enlaza los *Half-Spaces*.  
   * AM\_ENGANCHE (*Mediapunta Ofensivo / Enganche* — Attack): Flota libremente (Roam from Position) en la Zona 14 y los *Half-Spaces* 10/12 para filtrar el último pase o rematar desde el balcón.  
> 4. **Línea de Finalización (Delanteros):**  
   * WG\_WINGER (*Extremo Puro* — Support / Attack): Fija pegado a la banda en Zonas 13/15, encara en 1v1 por fuera y abastece de centros a las 4 zonas del área.  
   * WG\_INVERTED (*Extremo Invertido / Interiorizado* — Attack): Parte desde la banda pero conduce en diagonal hacia el *Half-Space* y la Zona 14/17, liberando el carril exterior para el OVERLAPPING del lateral.  
   * ST\_FALSE\_NINE (*Segunda Punta / Falso 9* — Support): Desciende a Zona 11/14 (FWD\_FALSE\_NINE\_DROP) para asociarse y activar al Tercer Hombre.  
   * ST\_TARGET\_POACHER (*Delantero Centro / "9" de Área* — Attack): Fija a los centrales (FWD\_PINNING\_CB), rompe en diagonal a la espalda (FWD\_RUNNING\_IN\_BEHIND\_ARC) y ataca el primer palo y punto penal.

### **FASE 9: MOTOR DE RECOMENDACIÓN Y ADAPTACIÓN POR DISTANCIA SEMÁNTICA (DSS), ENTRENADOR IA VIVO (coachAI.js) Y CALIBRACIÓN DE 200 PARTIDOS**

Esta fase implementa íntegramente el modelo científico del artículo *Semantic-Space Reasoning in Team Sports* junto con los módulos teamplay/coach/ y substitution/sub\_scoring.rs de engine.

#### **9.1. El Espacio Vectorial de 14 Macro-Atributos y 20 Estrategias Canónicas (src/engine/tactics/semanticDSS.js)**

> 1. Agregación del Vector de Equipo ${V}_{team}(t)\in [0,1{]}^{14}$ en Tiempo Real: En cualquier instante $t$ del partido (o en la Pizarra Táctica antes de empezar), el motor agrega los atributos ponderados por línea de los 11 jugadores en cancha en las **14 Dimensiones Semánticas**:  
   * ${A}_{1}$: Fuerza Ofensiva (*Offensive Strength* — shooting, control de DEL/ME).  
   * ${A}_{2}$: Solidez Defensiva (*Defensive Solidity* — tackling, perception, strength de DEF/MCD/GK).  
   * ${A}_{3}$: Creatividad y Elaboración (*Midfield Creativity* — passing, perception de ME/MCO).  
   * ${A}_{4}$: Velocidad de Transición Vertical (*Transition Speed* — speed, agility de extremos, laterales y puntas).  
   * ${A}_{5}$: Capacidad de Presión y Gegenpressing (*Pressing Capacity* — stamina, agility, tackling de bloque medio/alto).  
   * ${A}_{6}$: Amplitud y Desborde por Bandas (*Width Utilization* — laterales/carrileros y extremos).  
   * ${A}_{7}$: Resiliencia Psicológica y Compostura (*Psychological Resilience* — resistencia a lapse bajo presión PPM).  
   * ${A}_{8}$: Energía Residual en Vivo (*Residual Energy* — promedio actual de stamina de los 10 jugadores de campo).  
   * ${A}_{9}$: Moral y Momentum del Partido (*Team Morale* — modulado en vivo por goles a favor/en contra y racha de llegadas).  
   * ${A}_{10}$: Gestión Temporal y Control de Ritmo (*Time Management* — experiencia, passing seguro y retención).  
   * ${A}_{11}$: Cohesión Táctica y Sincronización (*Tactical Cohesion* — capacidad de sostener línea de *offside* y compresión).  
   * ${A}_{12}$: Base Técnica Colectiva (*Technical Base* — media global de control y passing).  
   * ${A}_{13}$: Potencia Física y Juego Aéreo (*Physical & Aerial Base* — strength, jumping, height).  
   * ${A}_{14}$: Química Relacional (*Squad Chemistry* — media de ${\mu }_{chem}$ normalizada a $[0,1]$).  
> 2. Biblioteca de las 20 Estrategias Canónicas (${V}_{strategy}^{(1..20)}$) y Distancia Semántica Adaptada (${d}_{adapt}$):  
   * Codificaremos los 20 perfiles ideales del paper (incluyendo *Gegenpressing*, *High Pressing*, *Positional Build-up / Tiki-Taka*, *Fluid Half-Space Box*, *Fast Wing Counterattack*, *Direct Target Man Play*, *Balanced Medium Block*, *Compact Low Block / Catenaccio*, *Late Game Time-Wasting Control*, *All-Out Siege*, etc.).

La distancia semántica pondera dinámicamente cada dimensión $m\in \{1..14\}$ según el contexto del partido (energía restante ${A}_{8}$, minuto de juego, estado del marcador \$\\Delta\\text{Score}\$ y brechas frente al vector del equipo rival ${V}_{opp}$):

$${d}_{adapt}\left({{V}_{team},{V}_{strategy}^{(k)}}\right)=\sqrt{\sum\limits_{m=1}^{14}{w}_{m}(contexto)\cdot {\left({\max\limits_{}\left({0,{V}_{strategy,m}^{(k)}-{V}_{team,m}}\right)}\right)}^{2}+0.35{\left({{V}_{team,m}-{V}_{strategy,m}^{(k)}}\right)}^{2}}$$

*   
  (Nótese la asimetría deliberada del paper: **tener menos atributo del que exige una táctica penaliza mucho más que tener de sobra**; por ejemplo, intentar *Gegenpressing* con baja energía ${A}_{8}=0.30$ dispara la distancia y descarta esa estrategia automáticamente).

#### **9.2. Entrenador IA Vivo (src/engine/coachAI.js) y Sustituciones Inteligentes (sub\_scoring)**

* **Adaptación Táctica en Vivo:** Cada 10 minutos de partido simulado (o tras un gol o expulsión), coachAI.js evalúa semanticDSS.js:  
  * Si va perdiendo en el minuto 70 y tiene energía, transiciona a la estrategia óptima de presión alta / ataque directo que mejor explote la debilidad del rival (${V}_{opp}$).  
  * Si va ganando por 1 gol en el minuto 75 y su energía residual ${A}_{8}$ cayó por debajo de $0.50$, repliega a Bloque Medio/Bajo con *Reciclaje Horizontal* o *Contraataque Rápido*.  
* Motor de Sustituciones (evaluateSmartSubstitutions inspirado en substitution/sub\_scoring.rs de engine):  
  * Evalúa a los titulares y al banco de suplentes (bench) priorizando reemplazar a: 1\) jugadores con stamina \< 45 en roles de alto desgaste (carrileros, laterales e interiores), 2\) defensores con **tarjeta amarilla (yellowCards \>= 1\)** si el rival tiene extremos rápidos, y 3\) jugadores con bajo rendimiento o que no encajan con el nuevo plan táctico elegido por el DSS.

#### **9.3. Renovación de TacticsBoard.jsx y Suite de Calibración de 200 Partidos (realism-200)**

* **En TacticsBoard.jsx:**  
  * Selector visual de las familias de formaciones de **3, 4 y 5 defensas**.  
  * Selector rápido de **Rol Funcional \+ Duty (Defend, Support, Attack)** al hacer clic sobre cualquier jugador en la pizarra.  
  * Panel de las **4 Fases del Continuum** (Salida, Transición A\$\\to$D,BloqueDefensivoyTransiciónD$\\to\$A) y tarjeta del **Asistente Táctico DSS** que muestra el **% de Ajuste Semántico** de la táctica elegida con tu plantilla actual y recomienda la mejor estrategia para ganarle al rival.  
* **Suite Final tests/verifyRealismBaseline.js:** Simulación en *headless mode* para validar que todas las estadísticas globales (goles por partido \~2.4-3.0, xG, % de pases, desbordes de laterales, cabezazos, atajadas, faltas y tarjetas) estén en equilibrio competitivo.

## **4\. RESUMEN DEL NUEVO PLAN DE EJECUCIÓN (HOJA DE RUTA ORDENADA)**

Para que no se nos escape absolutamente ningún detalle y podamos auditar cada entrega con la misma exigencia, ejecutaremos lo que falta en este orden estricto:

| Nueva Fase | Nombre y Alcance Técnico | Archivos Principales que Crearemos / Refactorizaremos |
| :---- | :---- | :---- |
| **FASE 5** | **Continuum de 4 Fases, Transiciones (Gegenpressing 5s / Contraataque 8s) y Cinemática Biomecánica** | src/engine/core/matchContext.js, src/engine/steering.js, src/engine/engine.js, tests/verifyPhase5Fulbito2.js |
| **FASE 6** | **Máquinas de Estados (HFSM) por Línea (GK, DEF, MID, FWD), Estados Faltantes (PINNING\_CB, FALSE\_NINE\_DROP, Arqueo Offside, Caja en Half-Spaces) y Exclusión de Celdas** | src/engine/player/playerStateMachine.js, src/engine/player/strategies/{goalkeeper,defender,midfielder,forward}States.js, src/engine/space/pitchZones.js, src/engine/playerMovement.js, tests/verifyPhase6Fulbito2.js |
| **FASE 7** | **Disputas 2.5D (Duelos Aéreos de Cabezazo, Atajadas Balísticas 2.5D, Regate 1v1), Córners Zonales/Mixtos y Psicología en Penales (GK-Dependent vs Independent)** | src/engine/ball/ballContest25D.js, src/engine/evaluators/duelEvaluator.js, src/engine/setFreekicks.js, src/components/PenaltyShootoutModal.jsx, tests/verifyPhase7Fulbito2.js |
| **FASE 8** | **Genealogía de Sistemas (3, 4 y 5 Defensas), los 15 Roles Funcionales \+ 3 Duties (Defend, Support, Attack) y Modelo de las 4 Fases** | src/data/formations.js, src/engine/tactics/rolesAndDuties.js, src/engine/tactics/tacticalModel.js, tests/verifyPhase8Fulbito2.js |
| **FASE 9** | **Motor Semántico DSS (14 Macro-Atributos \+ 20 Estrategias Canónicas), coachAI.js Adaptativo con Sustituciones Inteligentes, Pizarra 2.0 y Calibración Final** | src/engine/tactics/semanticDSS.js, src/engine/coachAI.js, src/components/TacticsBoard.jsx, tests/verifyPhase9Fulbito2.js |

Revisá tranquilo este **Rediseño del Motor Fulbito 2.2** y decime si sentís que ahora sí está **absolutamente todo** con la profundidad y fidelidad que queríamos desde el principio, o si querés que ajustemos o agreguemos alguna mecánica tuya antes de generar la especificación de código de la **Fase 5**.