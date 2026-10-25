## Rediseño del Motor Fulbito 2.0

## DOCUMENTO MAESTRO DE ARQUITECTURA Y REDISEÑO: MOTOR DE SIMULACIÓN «FULBITO 2.0»

Este documento constituye la hoja de ruta técnica y táctica para refactorizar el núcleo de simulación de

fulbito, integrando la arquitectura modular por máquinas de estados finitos (HFSM), física balística, arbitraje calibrado y evaluación espacial del repositorio de referencia engine, junto con la teoría avanzada de geometría espacial, principios del juego y modelado semántico de los documentos tácticos.

## 1. DIAGNÓSTICO ARQUITECTÓNICO: ¿POR QUÉ FALLA EL MOTOR ACTUAL DE FULBITO?

Al contrastar la estructura actual de fulbito/src/engine/ (engine.js, playerMovement.js, actions.js,

ballMovement.js, teamShape.js, steering.js, setFreekicks.js, coachAI.js) con la arquitectura de engine y los principios tácticos, se identifican seis cuellos de botella estructurales:

- 1. Huecos defensivos y mal marcaje (teamShape.js y playerMovement.js):

- Actualmente, los defensores operan mediante una interpolación elástica hacia una coordenada base de formación o persiguen directamente al portador del balón.

- No existe la distinción táctica entre 1.er Defensor (presión/retardación), 2.º Defensor (cobertura y cierre de líneas de pase) y 3.er Defensor (equilibrio, consolidación y regla del +1 o Spare Man).

- Al carecer de un Contrato de Emparejamiento (Engagement Contract) como el de engine (states/engagement/closing.rs, duel.rs, team/keeper_voice.rs) y de estados diferenciados (holding_line, covering, marking, guarding), dos defensores salen simultáneamente al mismo balón o abandonan su zona sin que el compañero ejecute la permuta o cobertura ni la basculación por centroide.

- 2. Laterales estáticos que no proyectan (formations.js y teamShape.js):

- En fulbito, la posición está acoplada rígidamente al rol (DEF), atando a los laterales a la misma lógica de línea defensiva que los centrales.

- Falta separar la Formación (Estructura en Fase Defensiva) de los Roles y Tareas / Duties (Estructura en Fase Ofensiva: Defend, Support, Attack). Además, no existen los disparadores espaciales de Desdoblamiento Exterior (Overlap) ni Interior (Underlap) que en engine se gestionan mediante defenders/states/overlapping y teamplay/plans/wide.rs.

- 3. Delanteros que frenan o dan un paso atrás en el 1 contra 1 (actions.js y playerMovement.js):

- Este error ocurre por dos colisiones de lógica en fulbito:

- Con balón: En actions.js, el árbol de decisión evalúa opciones de pase antes de comprobar si existe un pasillo libre hacia el arco; al ser el jugador más adelantado y no tener receptores por delante, o al sentir una presión lateral mínima, el delantero frena para descargar hacia atrás en lugar de atacar el espacio libre.

- Sin balón / En recepción: El resorte elástico de teamShape.js y la prevención reactiva del offside tiran del delantero hacia su ancla posicional retrasada cuando supera la línea de la zaga, anulando su impulso vertical.

- En engine, esto se evita mediante Raycasting Espacial (raycast/space.rs), la lógica de


- decisión de tiro/conducción (ops/attacking/forward_shot_decision.rs), la evasión de marca (ops/duels/marker_evasion.rs) y el estado dedicado running_in_behind.

- 4. Exceso de faltas, tarjetas y expulsiones (actions.js y setFreekicks.js):

- En fulbito, la única herramienta defensiva real al entrar en radio de contacto es el tackle directo evaluado a alta frecuencia. Cada entrada fallida tiene una probabilidad plana de falta, y cada falta dispara probabilidades elevadas de tarjeta sin memoria disciplinaria.

- En el fútbol real y en engine (ball/contest/, states/engagement/, team/discipline.rs, officiating/referee.rs), la defensa prioriza la Contención/Retardación (Delay), el Cuerpo a Cuerpo legal (contest/body.rs), el Bloqueo de líneas (pass_block.rs) y la Intercepción (interception.rs). Además, un jugador amonestado reduce drásticamente su agresividad de entrada (discipline.rs) bajo el principio de Restricción (Restraint).

- 5. Pobreza de herramientas, visión y variedad en los jugadores (actions.js):

- Todos los futbolistas toman decisiones con un if/else monolítico, sin explorar el entorno previamente (Scanning), sin considerar su orientación corporal (Body Pose), sin utilizar métricas de valor esperado (xG y xThreat) y sin estados mentales o rasgos individuales (Traits).

- 6. Personalización táctica limitada (TacticsBoard.jsx, formations.js, coachAI.js):

- Las formaciones son coordenadas fijas con pocos modificadores globales. No hay distinción entre las 4 Fases del Continuum Táctico, alturas de bloque (Line of Confrontation vs. Line of Restraint), geometrías de asociación (Triángulos, Diamantes, Caja en Half-Spaces) ni un motor de recomendación/adaptación semántica para el entrenador IA.

## 2. NUEVA ARQUITECTURA DE CARPETAS Y MÓDULOS PARA FULBITO 2.0

Mantendremos el stack web en JavaScript/React (Canvas 2D) de fulbito, pero reestructuraremos por

completo src/engine/ adoptando la separación de responsabilidades de engine.

```
src/engine/
├── core/
│ ├── engine.js # Loop principal (Tick Driver) y orquestación
de fases
│ ├── matchContext.js # Reloj, marcador, clima, momentum y estado
global (ref: flow/context)
│ └── rng.js # Generador pseudoaleatorio
determinista/semillado y utilidades matemáticas
├── space/
│ ├── pitchZones.js # Grilla de las 18 Zonas y los 5 Carriles
Verticales (Bandas, Half-Spaces, Centro)
│ ├── raycast.js # Proyección de conos de visión, líneas de
pase libres y espacio abierto (ref: raycast/space.rs)
│ └── pressureMap.js # Cálculo del Player Pressure Map (PPM) y
Pitch Control local (ref: Gu et al. / PPM)
├── ball/
│ ├── ballPhysics.js # Física 2.5D (X, Y, Z, spin/magnus, bote,
rodamiento y fricción de césped)
│ ├── ballContest.js # Resolución separada: reach, interception,
pass_block, body_duel, aerial_duel, tackle, save
│ └── ballRestarts.js # Leyes de reinicio, saques rápidos, balón
parado y offside (ref: ball/restarts)
├── tactics/
```


```
│ ├── tacticalModel.js # Definición de Sistemas (3, 4 y 5 DEF),
Bloques, Estilos y las 4 Fases del Continuum
│ ├── rolesAndDuties.js # Taxonomía de los 15 Roles funcionales + 3
Duties (Defend, Support, Attack)
│ ├── teamShape.js # Cálculo dinámico de anclas: Basculación por
centroide, Compresión, Amplitud y Línea de Paso
│ ├── plans/ # Planes colectivos (attackPlan.js,
defencePlan.js, blockPlan.js, widePlan.js, restDefence.js)
│ └── semanticDSS.js # Vector de 14 Macro-Atributos, 20
Estrategias Canónicas y Coach AI adaptativo
├── player/
│ ├── playerState.js # Máquina de Estados Finitos Jerárquica
(HFSM) por línea (GK, DEF, MID, FWD)
│ ├── cognition.js # Proceso Cognitivo-Perceptivo: Scanning, FOV
(orientación), Memoria y Lapsos (psychology/lapse)
│ ├── effectiveSkill.js # Compuestos de habilidad, modificadores de
Química (0.85-1.15), fatiga, moral y Traits
│ ├── steering.js # Cinemática con inercia, radio de giro
(agility), sprint ramp y esfuerzo físico
│ ├── strategies/
│ │ ├── goalkeeperStates.js # 14 estados de GK (standing, split_step,
preparing_for_save, coming_out, sweeping, etc.)
│ │ ├── defenderStates.js # 16 estados de DEF (holding_line, covering,
marking, guarding, overlapping, underlapping, etc.)
│ │ ├── midfielderStates.js # 16 estados de MID (creating_space,
box_to_box, switching_play, pressing, carrying, etc.)
│ │ └── forwardStates.js # 15 estados de FWD (running_in_behind,
pinning_cb, false_nine_drop, breakaway, finishing, etc.)
│ └── evaluators/
│ ├── passEvaluator.js # Evaluación multicriterio (xThreat,
geometría de triángulos/diamantes, 3er hombre, riesgo)
│ ├── shotEvaluator.js # Modelo xG (Clear Cut, Half Chance,
Speculative) y decisión de tiro vs. conducción
│ └── duelEvaluator.js # Evasión de marca, regate 1v1, carga física
y contrato de emparejamiento defensivo
└── officiating/
├── referee.js # Árbitro con personalidad (permisividad),
ley de la ventaja, DOGSO/SPA y acumulación
└── discipline.js # Autoprotección de jugadores con amarilla
(Restraint) y faltas tácticas (professional_foul)
```

## 3. REDISEÑO PROFUNDO POR PILARES DEL MOTOR

## PILAR 1: Geometría Espacial, las 18 Zonas, los 5 Carriles y el Mapa de Presión (PPM)

En lugar de mover jugadores sobre un plano vacío con coordenadas arbitrarias, el motor dividirá el campo

en estructuras espaciales consultables en tiempo constante O(1) (space/pitchZones.js), siguiendo la teoría de zonificación y el módulo teamplay/zones.rs y positions/grid.rs de engine:


- 1. Grilla de las 18 Zonas Tácticas (6 filas longitudinales × 3 columnas base):

- Sector de Iniciación (Zonas 1 a 6): Zona 1 (Área propia y salida con GK), Zonas 2 y 3 (Carriles exteriores bajos), Zona 4 (Eje central defensivo / pivote bajo), Zonas 5 y 6 (Interiores defensivos de contención).

- Sector de Creación y Progresión (Zonas 7 a 12): Zonas 7 y 9 (Bandas medias de aceleración), Zona 8 (Eje de distribución intermedio), Zonas 10 y 12 (Half-Spaces medios de gestación), Zona 11 (Pivote alto / reciclaje).

- Sector de Finalización (Zonas 13 a 18): Zonas 13 y 15 (Amplitud extrema en tres cuartos para 1v1 y centros), Zona 14 (Centro neurálgico / Balcón del área), Zonas 16 y 18 (Pasillos interiores profundos para underlaps y cutbacks), y Zona 17 (Zona de definición y remate final).

- 2. Los 5 Carriles Verticales (Vertical Lanes):

- División transversal en: Banda Izquierda (Touchline), Medio Espacio Izquierdo (Left Half-Space), Carril Central (Eje Vertebral), Medio Espacio Derecho (Right Half-Space) y Banda Derecha (Touchline).

- Regla de Ocupación Racional: El motor penalizará en teamShape.js y creating_space que dos compañeros ofensivos ocupen la misma sub-zona y el mismo carril simultáneamente (evitando estructuras paralelas llanas de 180°), forzando escalonamientos a tres alturas para formar Triángulos, Diamantes y Cajas (Box) en los Half-Spaces.

- 3. Mapa de Presión Individual (PPM) y Cono de Espacio Libre (space/pressureMap.js y raycast.js):

- Inspirado en el modelo Player Pressure Map (PPM) y raycast/space.rs de engine, cada jugador con o sin balón calcula su vector de presión Pi ∈[0,1] en función de la distancia, velocidad de cierre y ángulo respecto a su orientación corporal (θpose ) de los rivales cercanos.

- La función raycastOpenCorridor(origin, targetAngle, distance) proyecta un cono hacia adelante para medir los metros libres de oposición antes de decidir si conducir, pasar o temporizar.

## PILAR 2: Solución Definitiva a la Defensa («Huecos, Mal Marcaje y Laterales que no Suben»)

Reemplazaremos la lógica reactiva de playerMovement.js por un sistema coordinado basado en los 7

Principios Defensivos (Delay, Pressure, Compression, Balance, Cover, Consolidation, Restraint) y los módulos teamplay/plans/block.rs, defence.rs, line_step.rs y wide.rs de engine.

## A. Arquitectura del Bloque Defensivo y Basculación Colectiva (tactics/plans/blockPlan.js)

- 1. Línea de Confrontación (Line of Confrontation) y Línea de Restricción (Line of Restraint):

- Todo equipo define dos líneas en el eje longitudinal X (o Y según orientación del canvas):

- Bloque Alto: Zaga a 40-50m del arco propio; confrontación en 3/4 rivales.

- Bloque Medio: Zaga a 20-35m; confrontación en mediocampo.

- Bloque Bajo: Zaga a 5-18m; confrontación en el borde de la Zona 14 propia.

- Ningún defensor ni mediocampista de contención rompe la Línea de Confrontación salvo que se active un Detonante de Presión (Pressing Trigger): pase atrás al arquero rival, control defectuoso (heavy touch), receptor de espaldas al arco o balón encerrado contra la banda.

- 2. Basculación Lateral y Compresión por Centroide:

- En cada tick, el motor calcula el centroide del bloque (xcentroide ,ycentroide ) y aplica el desplazamiento colectivo hacia el sector del balón: Δylat =kbasc ⋅(ybaloˊ n −ycentroide )

- comprimiendo la distancia inter-posicional transversal y reduciendo la distancia entre la línea defensiva y la medular a Δx≤12-15 m (Principio de Compresión).


## B. Contrato de Emparejamiento (Engagement Contract) y Regla del +1 (Spare Man)

Para eliminar para siempre los huecos en la zaga, implementaremos el sistema de asignación de roles

defensivos en tiempo real de engine (defenders/states/common/line_step.rs, covering/mod.rs, holding_line/mod.rs):

- 1. Un solo 1.er Defensor (The Stepper): Mediante un bloqueo de arbitraje interno (activePresserId por línea), solo un defensor tiene permiso para dar el paso adelante (line_step / estado pressing o guarding) para acosar al poseedor o al receptor en el medio espacio.

- 2. Cobertura y Permuta Automática (2.º Defensor): Cuando un central o lateral sale de la línea (line_step), los dos compañeros adyacentes de la zaga entran inmediatamente en estado covering, cerrando el intervalo interior detrás del compañero que salió (reduciendo su separación lateral un 35%). Si el compañero es superado en el 1v1, el 2.º defensor ejecuta el cruce y el 1.er defensor permuta retrocediendo a la posición vacante (Permuta).

- 3. El Hombre Libre (Spare Man / Regla del +1) y Balance (3.er Defensor):

- El motor cuenta cuántos atacantes rivales amenazan la última línea (Natt ). La zaga siempre mantiene Ndef =Natt +1 efectivos consolidados:

- Si el rival ataca con 1 punta: un central fija marca (marking) y el otro actúa como Spare Man libre (covering / holding_line).

- Si el rival ataca con 2 puntas contra línea de 4: el lateral del lado débil (weak-side fullback) se cierra hacia el carril interior (Principio de Balance) o el Pivote Defensivo (MCD) se incrusta entre los centrales (Lavolpiana / duties.rs) para garantizar el 3v2.

(tactics/plans/widePlan.js)

En engine (defenders/states/overlapping/mod.rs, pushingup/mod.rs, teamplay/plans/wide.rs) y en los

manuales tácticos, la proyección de los laterales se gobierna por Fase + Tarea (Duty) + Geometría de Banda:

- 1. Condición de Activación: Cuando el equipo entra en fase de Progresión o Ataque Posicional, los laterales con tarea Support o Attack (y todos los Carrileros en sistemas de 3/5 defensas) desbloquean sus waypoints ofensivos hacia las Zonas 7/9, 13/15 y 16/18.

- 2. Coordinación Extremo-Lateral (Overlap vs. Underlap):

- Desdoblamiento Exterior (Overlap): Si el extremo o interior de esa banda recibe o conduce cerrándose hacia el Half-Space (Zonas 10/12 o 14), el lateral activa el estado overlapping, esprintando por el carril exterior (Touchline, Zonas 13/15) para recibir al espacio y centrar.

- Desdoblamiento Interior (Underlap): Si el extremo fija abierto contra la línea de cal en las Zonas 13/15 atrayendo al lateral rival, el lateral propio ataca el intervalo interior entre el lateral y el central rival (Half-Space, Zonas 16/18) para buscar el pase atrás (Cutback a Zona 4 de remate).

- 3. Seguro de Defensa en Reposo (Rest Defence):

- Antes de que ambos laterales suban a la vez, restDefence.js verifica las preguntas de control táctico: ¿Quedan al menos 3 jugadores sosteniendo la estructura defensiva detrás de la línea del balón?. Si en un 4-3-3 o 4-4-2 el lateral derecho sube en Attack a la Zona 15 y el MCD no está retrasado en la Zona 4/8, el lateral izquierdo limita su subida a la Zona 7/8 como apoyo de reciclaje (Structured / Flexible system) para evitar quedar expuestos al contraataque.

PILAR 3: Solución al Comportamiento de Delanteros y Mediocampistas (Cero

## C. ¿Cómo logramos que los Laterales y Carrileros suban con inteligencia?


## «Pasos Atrás» en el 1v1)

Para erradicar el problema del delantero que retrocede cuando tiene camino libre y dotar a los atacantes

de visión y variedad, rediseñaremos la toma de decisiones ofensiva basándonos en engine/src/match/engine/player/strategies/forwarders/ y common/players/ops/attacking/.

## A. Prioridad de Penetración y Detección de Escapada (Breakaway Override)

Siguiendo el 1.er Principio de Ataque: Penetración ("Al tomar posesión, el primer atacante debe buscar

inmediatamente una oportunidad de penetración: pasar hacia adelante, conducir al espacio o rematar") y el módulo forward_shot_decision.rs de engine:

- 1. Cono de Progresión Libre (raycast.js): Antes de evaluar cualquier pase horizontal o hacia atrás, el portador del balón lanza un raycast en un cono de ±30∘ hacia el arco rival.

- 2. Activación del estado breakaway_dribble: Si un delantero o extremo se encuentra en el último tercio (o tras cruzar la línea de mediocampo en transición rápida) y no hay ningún defensor rival dentro de su cono frontal a menos de 10-12 m, el jugador entra en modo Escapada Mano a Mano:

- Se prohíben por completo los pases hacia atrás o laterales y se apaga cualquier fuerza de atracción hacia su coordenada base de formación.

- Su vector de movimiento apunta directamente hacia el borde del área / punto penal (Zona 17) a velocidad máxima de sprint, preparando el perfil para definir frente al arquero (Goalkeeper-Dependent o Goalkeeper-Independent) o eludirlo si sale a achicar.

## B. Movimientos Sin Balón de los Delanteros (forwardStates.js)

En lugar de flotar estáticamente cerca de su ancla, los delanteros alternarán entre cuatro estados tácticos

dinámicos tomados de engine y de la teoría de finalización:

- 1. pinning_cb (Fijación de Centrales): El "9" se posiciona entre los dos centrales rivales en el límite del fuera de juego, impidiendo que salgan a presionar a la Zona 14 (liberando el balcón del área para el mediapunta).

- 2. running_in_behind (Desmarque de Ruptura en Diagonal): Cuando un compañero con buen atributo de passing y perception levanta la cabeza (Scanning positivo) sin presión inmediata, el delantero no corre en línea recta (fácil de dejar en offside), sino que traza una diagonal desde el punto ciego del central hacia el espacio a su espalda (Zonas 16/17/18). Si llega al límite de la línea defensiva antes del pase, arquea su carrera horizontalmente sobre la línea de habilitación en vez de dar pasos hacia atrás.

- 3. creating_space / false_nine_drop (Apoyo y Tercer Hombre): Si el bloque rival está hundido (Low Block) y no hay espacio a la espalda, el delantero con rol de Segunda Punta / Falso 9 desciende a la Zona 11/14 para recibir al pie, arrastrar al central y activar la combinación de Tercer Hombre con la ruptura diagonal del extremo o interior.

- 4. box_movement (Ataque Coordinado a las 4 Zonas de Remate): Cuando el balón llega a zonas de centro o desborde (Zonas 13, 15, 16, 18), el módulo box_movement.rs asigna dinámicamente 4 destinos distintos a los atacantes que pisan el área para que nunca se encimen:

- Receptor 1 → Zona 1 de Remate (Primer Palo): Anticipación explosiva.

- Receptor 2 → Zona 2 de Remate (Punto Penal): Referencia central de remate.

- Receptor 3 → Zona 3 de Remate (Segundo Palo): Entrada del extremo del lado opuesto cerrando la pinza.

- Receptor 4 → Zona 4 de Remate (Borde del Área / Zona 14): Llegada del mediapunta o mediocentro para el Pase Atrás (Cutback) de altísimo xG (>0.35).


## PILAR 4: Rediseño de Duelos, Arbitraje y Disciplina (Adiós al Exceso de Faltas y Tarjetas)

Para resolver de raíz la lluvia de faltas, amarillas y expulsiones de fulbito, portaremos la arquitectura de

duelos en 3 capas y arbitraje de engine (ball/contest/, states/engagement/, team/discipline.rs, officiating/referee.rs).

```
[ ACERCAMIENTO (closing.rs) ]
│
¿Distancia < R_engagement? ──(No)──► Seguir cerrando línea de pase / Bascular
│
(Sí)
```

[ EVALUACIÓN DE RESTRICCIÓN (Restraint & discipline.rs) ]

- ¿Tiene tarjeta amarilla? (-45% prob. de tackle agresivo)

- falta) • ¿Rival de espaldas o encerrado en banda? ──► CONTENCIÓN / JOCKEY (Sin

- limpio) • ¿En carrera paralela hombro con hombro? ──► CARGA FÍSICA (body.rs - 92%

- ¿Exposición al balón clara y buen ángulo?──► ENTRADA / TACKLE (tackle.rs)

- 1. Separación de Acciones de Disputa (ball/ballContest.js):

- Intercepción (interception.rs) y Bloqueo (pass_block.rs / block.rs): Ocurren sobre la trayectoria del balón usando perception y agility. Tasa de falta: 0%.

- Contención / Jockeying (guarding / Principio de Delay): El defensor se mantiene a 1.2-1.8 m perfilado entre el atacante y el arco, reduciendo la velocidad de avance del rival un 40% y aumentando su presión (PPM) para forzar un mal pase sin arriesgar infracción. Tasa de falta: 0%.

- Disputa Corporal / Carga Hombro con Hombro (contest/body.rs): Cuando atacante y defensor corren emparejados, se confrontan strength y agility (balance). Desplaza o desequilibra al rival legalmente en la gran mayoría de los casos. Tasa de falta: solo 5-8% (cuando hay gran desventaja de agility y exceso de fuerza).

- Entrada / Tackle (contest/tackle.rs): Solo se ejecuta cuando el defensor tiene ventana de contacto limpia al balón o como último recurso. Tiene un cooldown obligatorio por jugador de 45-60 ticks tras un intento para evitar que un mismo jugador tire 5 entradas por segundo.

- 2. Módulo de Autoprotección Disciplinaria (officiating/discipline.js):

- Basado en team/discipline.rs de engine y el 7.º Principio Defensivo (Restraint / Restricción):

- Un jugador con 1 tarjeta amarilla activa el flag isBooked = true, lo que multiplica por 0.45 su propensión a tirarse al piso o cometer entradas de riesgo, priorizando el jockeying y el acompañamiento zonal.

- En el área propia (Zona 1 / Zona 17 rival), los defensores aplican un multiplicador de prudencia de 0.50 para evitar penales infantiles, salvo situación desesperada (ops/defending/panic.rs).

- 3. Motor Arbitral Calibrado (officiating/referee.js):

- Cada partido instancia un árbitro con dos parámetros: strictness (rigurosidad, 0.3-0.8) y advantageTendency (ley de la ventaja).

- Ley de la Ventaja: Si hay falta menor pero el equipo atacante conserva el balón con un corredor abierto de alto xThreat, el árbitro deja seguir.

- Criterio Realista de Tarjetas:


- Falta Común (78-82% de las faltas): Tiro libre sin tarjeta. Se incrementa el contador playerFoulCount.

- Reiteración: A la 3.ª o 4.ª falta acumulada del mismo jugador, amarilla por reiteración.

- Falta Táctica / SPA (professional_foul.rs): Cortar un contraataque claro en transición D A → = Amarilla (probabilidad 85%).

- Roja Directa: Reservada exclusivamente para DOGSO (cortar ocasión manifiesta de gol como último hombre fuera del área) o entradas temerarias extremas (<1.5% de las faltas).

- Meta de Calibración (match/calibration.rs): 16 a 22 faltas totales por partido, 2 a 4 amarillas totales, y ~0.10-0.15 rojas por partido.

## PILAR 5: Inteligencia Artificial Cognitiva, Evaluadores xG/xT y Física 2.5D

Para que los jugadores demuestren visión, ideas, creatividad y variedad en cada partido,

incorporaremos la capa cognitiva y analítica de los documentos teóricos y de engine:

## A. Proceso Cognitivo-Perceptivo (player/cognition.js)

- 1. Orientación Corporal (Body Pose) y Campo Visual (FOV):

- Cada jugador tiene un ángulo de orientación θfacing (hacia donde mira su torso).

- Los pases dentro de su cono frontal (±75∘) tienen bonificación de velocidad de ejecución y precisión; los pases a su espalda (>120∘) requieren girar el cuerpo primero (costando ticks según su atributo agility y control) o sufren penalización de precisión.

- 2. Exploración Visual Previa (Scanning):

- Antes de recibir el balón, el jugador ejecuta chequeos de entorno cuya frecuencia y radio dependen de su atributo perception.

- Un jugador con alto Scanning (ej. un mediocentro o enganche Ídolo/Leyenda) ya tiene precalculado en su memoria (player/memory.rs) dónde están los espacios libres y los rivales antes del primer toque, permitiéndole ejecutar Controles Orientados hacia los Half-Spaces o pases al Tercer Hombre al primer toque.

- 3. Presión, Compostura y Lapsos Cognitivos (psychology/lapse.rs):

- Cuando el Player Pressure Map (PPM) alrededor del poseedor supera un umbral crítico, se contrasta contra la compostura/percepción del jugador y su fatiga. Si falla el chequeo bajo estrés, se activa un micro-lapso (lapse.rs): el jugador pierde visión lejana y prioriza un despeje de pánico (panic.rs) o un pase forzado de menor precisión.

## B. Evaluador Multicriterio de Pases y Remates (evaluators/passEvaluator.js y shotEvaluator.js)

En lugar de elegir al compañero más cercano, cuando un jugador evalúa pasar (passing/evaluator.rs en

engine), califica a cada uno de sus 10 compañeros con una función de utilidad U(target):

Donde:

- ΔxThreat(zi →zj): Ganancia de amenaza esperada al mover el balón entre las 18 Zonas (máxima


- bonificación al romper líneas hacia las Zonas 10, 12, 14 y 17).

- Gtri (i,j) (Geometría de Pase): Bonifica los pases diagonales que forman triángulos o diamantes en los Half-Spaces, y penaliza los pases llanos de 180° paralelos a la línea de presión rival.

- Modalidades de Pase (passing/through_ball.rs, flank.rs, cross.rs): Para cada receptor, el motor evalúa dos puntos de entrega:

- 1. Pase al Pie: Para apoyos de sostén, reciclaje de posesión o pivoteo.

- 2. Pase al Espacio (Through Ball / Lead Pass): Proyectado por delante del vector de carrera del compañero (running_in_behind o overlapping), eligiendo automáticamente entre pase raso tenso, pase filtrado o cambio de orientación aéreo (switching_play) si hay congestión en el carril central.

- Modelo de Calidad de Remate (xG en shotEvaluator.js / ops/attacking/xg.rs):

- Cada potencial disparo calcula su xG en tiempo real según distancia, ángulo a los postes, densidad de piernas rivales en el cono de tiro (bloqueos) y posición del arquero:

- Clear Cut Chance (xG>0.35): Mano a mano o cutback en Zona 17 → Disparo inmediato de alta prioridad.

- Half Chance (xG∈[0.07,0.15]): Se dispara si no hay un compañero con pase claro a una Clear Cut Chance (Extra Pass).

- Speculative Shot (xG<0.03): Los jugadores no malgastan posesión pateando desde 35 metros con defensores delante (respetando el principio de Posesión y Paciencia), salvo que tengan el rasgo Tirador Lejano, alto atributo shooting y espacio libre en la Zona 14 (distance_shooting).

## C. Rasgos Distintivos (Traits) y Modificadores de Química (player/effectiveSkill.js)

Aprovechando las cartas de Leyenda, Ídolo y Plantel y el Sistema de Química ya presentes en el diseño de fulbito, conectaremos traits_bias.rs y skill_composites.rs de engine:

- Multiplicador de Química (μchem ∈[0.85,1.15]): Escala directamente la precisión de pase, el radio de control orientado y la velocidad de reacción en las basculaciones y el scanning.

- Sesgos por Rasgos (Traits Bias): Un jugador con rasgo Playmaker / Enganche incrementa +35% el peso de los pases filtrados (through_ball) en la Zona 14; un Gambeteador incrementa +40% la utilidad de encarar en 1v1 (dribble_duel.rs) en las Zonas 13/15; un Caudillo / Líbero mejora la sincronización del achique de línea (line_step.rs) de toda la defensa.

## PILAR 6: Pizarra Táctica Avanzada, Roles/Duties y Entrenador IA Semántico (DSS)

Transformaremos TacticsBoard.jsx, formations.js y coachAI.js para ofrecer una personalización profunda

pero intuitiva, respaldada por el Modelo de Distancia Semántica del estudio de optimización táctica y el módulo teamplay/coach/ de engine.

## A. Genealogía de Formaciones + Roles y Tareas Individuales (tactics/rolesAndDuties.js)

- 1. Familias de Sistemas (3, 4 y 5 Defensas):

- 3 Defensas: 3-4-3 (Línea / Rombo), 3-5-2 (Doble Pivote + Mediapunta + Carrileros).

- 4 Defensas: 4-4-2 (En línea, Doble Pivote o Rombo 4-1-2-1-2), 4-3-3 (Con Pivote único o Doble Mediapunta), 4-2-3-1 y 4-1-4-1.

- 5 Defensas: 5-3-2 (Líbero de cobertura + 2 Marcadores Centrales + 2 Carrileros) y 5-4-1 (Cerrojo y contragolpe directo).

- 2. Asignación de Rol Funcional + Tarea (Duty) por Jugador: Cada nodo en la pizarra permite elegir su Rol Funcional y su Tarea (Defend, Support, Attack):


- Portero: Portero Clásico (Defend) vs. Portero Cierre / Sweeper Keeper (Support/Attack) que sale a cortar balones largos a la espalda de un bloque alto (keeper_space.rs) e inicia la salida en Zona 1.

- Defensas Centrales: Central Iniciador (Support), Marcador Central (Defend), Líbero Corrector (Cover).

- Bandas Defensivas: Lateral (Defend/Support/Attack) vs. Carrilero de Largo Recorrido (Support/Attack).

- Mediocampo: Pivote Ancla (Defend), Mediocentro Distribuidor (Support), Interior Todoterreno / Box-to-Box (Support/Attack), Mediapunta de Presión (Support), Enganche / Mediapunta Ofensivo (Attack).

- Ataque: Extremo Puro de Banda (Support/Attack), Extremo Invertido hacia Half-Space (Attack), Segunda Punta / Falso 9 (Support), Delantero Centro / "9" de Área (Attack).

## B. Configuración por Fases del Continuum Táctico (tactics/tacticalModel.js)

En la pizarra táctica (TacticsBoard.jsx), el usuario podrá personalizar el comportamiento del equipo en las 4

Fases del Juego (o elegir uno de los Arquetipos Canónicos que preconfiguran estos parámetros automáticamente):

| Fase del Continuum | Parámetros Configurables | Efecto Directo en el Motor |
| --- | --- | --- |
|   | en Fulbito 2.0 | 2D |
| 1. Organización Ofensiva | • Estilo de Salida: En corto | Modifica los pesos de |
|   | desde Zona 1-4 / Mixto / | passEvaluator.js, la distancia |
|   | Directo al 9 | de apoyo de los pivotes y las |
|   |   | carreras de desdoblamiento. |
|   | • Fluidez (Team Shape): |   |
|   | Estructurado ↔ Fluido |   |
|   | • Vía de Progresión: Bandas |   |
|   | (Overlaps) / Medios Espacios |   |
|   | (Caja) / Central |   |
| 2. Transición A → D | • Reacción tras Pérdida: | Activa |
|   | Gegenpressing (Presión 5s) | player/counter_press.rs |
|   | vs. Repliegue Intensivo | durante 5 segundos tras |
|   |   | perder el balón o fuerza |


| Fase del Continuum | Parámetros Configurables | Efecto Directo en el Motor |
| --- | --- | --- |
|   | en Fulbito 2.0 | 2D |
|   |   | vectores inmediatos hacia |
|   |   | campo propio. |
| 3. Organización Defensiva | • Altura del Bloque: Bajo / | Define la Línea de |
|   | Medio / Alto (+ Trampa del | Restricción, la Línea de |
|   | Offside) | Confrontación, el factor de |
|   |   | basculación kbasc y los |
|   |   | umbrales de discipline.js. |
|   | • Sistema de Marcaje: Zonal |   |
|   | Puro / Mixto / Zonal con |   |
|   | Presión / Al Hombre |   |
|   | • Intensidad de Entrada: |   |
|   | Contención (Restraint) / |   |
|   | Normal / Agresiva |   |
| 4. Transición D → A | • Ritmo tras Robo: | En modo vertical, multiplica |
|   | Contraataque Vertical | ×1.8 la utilidad de pases |
|   | Rápido (<10s) vs. Consolidar | profundos y dispara |
|   | y Reciclar Posesión | running_in_behind |
|   |   | instantáneo al recuperar. |

*C. Motor de Decisión por Distancia Semántica (DSS) y coachAI.js (tactics/semanticDSS.js)*

Implementaremos el modelo matemático del artículo Semantic-Space Reasoning in Football Tactics en un

módulo ligero de JavaScript (semanticDSS.js):

- 1. Vector de Estado del Equipo (Vteam ∈[0,1]14): Agregamos los atributos de los 11 jugadores en cancha en las 14 Macro-Dimensiones (A1 Fuerza Ofensiva, A2 Fuerza Defensiva, A3 Creatividad en Mediocampo, A4 Velocidad de Transición, A5 Capacidad de Presión Alta, A6 Uso de Amplitud, A7 Resiliencia Psicológica, A8 Energía Residual / Fatiga en vivo, A9 Moral del Equipo, A10 Gestión del Tiempo, A11 Cohesión Táctica, A12 Base Técnica, A13 Base Física y A14 Química Relacional).

- 2. Emparejamiento con las 20 Estrategias Canónicas (Vstrategy(k) ): Mediante la distancia euclidiana adaptada al contexto del partido (energía restante A8, diferencia de goles y minuto de juego A10 , brecha frente al rival ΔVopp ):

S∗=argSmindadapt (Vteam (t),Vstrategy (S);w(contexto))

- Para el Jugador Humano (en TacticsBoard.jsx): Le muestra un indicador de "Ajuste Táctico (%)" y diagnósticos claros (ej. "Tu plantilla tiene baja energía/físico (A8 ,A13 ) para sostener Gegenpressing; el modelo sugiere Defensa Posicional en Bloque Medio con Contraataque Rápido").


- Para la IA Rival y los Cambios Automáticos (coachAI.js + substitution/sub_scoring.rs): El entrenador de la IA ya no hace cambios fijos ni juega igual los 90 minutos; evalúa cada 10 minutos de juego la distancia semántica dadapt y las métricas del partido (teamplay/coach/match_coach.rs, needs.rs). Si su energía (A8) cae en el segundo tiempo o va ganando por 1 gol al minuto 75, transiciona dinámicamente de High Pressing a Bloque Medio/Bajo con Reciclaje Horizontal y realiza sustituciones (sub_scoring.rs) priorizando piernas frescas en carrileros y pivotes.

## 4. MATRIZ DE TRANSFORMACIÓN DE ARCHIVOS (FULBITO ACTUAL → FULBITO 2.0)

Esta guía detalla exactamente qué hacer con cada archivo actual de fulbito/src/engine/:

| Archivo Actual en fulbito | Acción | Qué Modificar, Reemplazar |
| --- | --- | --- |
|   |   | o Agregar (Inspirado en |
|   |   | engine y Teoría) |
| src/engine/engine.js | Refactorizar | Convertir en un Tick Driver |
|   |   | limpio (como |
|   |   | engine/tick/driver.rs): 1) |
|   |   | Actualizar reloj y fase del |
|   |   | Continuum (phase.rs); 2) |
|   |   | Actualizar mapa de zonas y |
|   |   | presión (PPM); 3) Actualizar |
|   |   | estructura colectiva |
|   |   | (teamShape.js); 4) Procesar |
|   |   | estados cognitivos y HFSM |
|   |   | de los 22 jugadores |
|   |   | (processor.rs); 5) Mover |
|   |   | balón y resolver disputas |
|   |   | (ballPhysics.js / |
|   |   | ballContest.js); 6) Evaluar |
|   |   | arbitraje y telemetría. |
| src/engine/teamShape.js | Reescribir | Reemplazar las anclas |
|   |   | estáticas por un calculador |
|   |   | de Doble Estructura |
|   |   | (Forma Defensiva vs. |
|   |   | Forma Ofensiva por |
|   |   | Roles/Duties). Agregar: |
|   |   | Basculación por Centroide, |
|   |   | Línea de Restricción y |
|   |   | Confrontación, Achique |
|   |   | coordinado (line_step) y |
|   |   | Seguro de Rest Defence |


| Archivo Actual en fulbito | Acción | Qué Modificar, Reemplazar |
| --- | --- | --- |
|   |   | o Agregar (Inspirado en |
|   |   | engine y Teoría) |
|   |   | (regla de 3 atrás). |
| src/engine/playerMovemen | Dividir y Reemplazar | Desacoplar en dos capas |
| t.js |   | como en engine: |
|   |   | 1. Máquina de Estados por |
|   |   | Línea |
|   |   | (player/strategies/*States.j |
|   |   | s): Donde cada jugador |
|   |   | decide su waypoint táctico |
|   |   | según su estado activo |
|   |   | (overlapping, covering, |
|   |   | running_in_behind, |
|   |   | pinning_cb, holding_line, |
|   |   | etc.). |
|   |   | 2. Cinemática Física |
|   |   | (player/steering.js): |
|   |   | Movimiento hacia el |
|   |   | waypoint con inercia real y |
|   |   | orientación corporal. |
| src/engine/actions.js | Dividir y Reemplazar | Eliminar el bloque monolítico |
|   |   | de acciones y dividirlo en: |
|   |   | • evaluators/shotEvaluator.js |
|   |   | (Modelo xG + Breakaway |
|   |   | Override para que los |
|   |   | delanteros nunca retrocedan |
|   |   | en el 1v1). |
|   |   | • evaluators/passEvaluator.js |
|   |   | (Modelo xThreat en 18 |
|   |   | zonas, |


| Archivo Actual en fulbito | Acción | Qué Modificar, Reemplazar |
| --- | --- | --- |
|   |   | o Agregar (Inspirado en |
|   |   | engine y Teoría) |
|   |   | triangulaciones/diamantes, |
|   |   | 3.er hombre y pases al |
|   |   | espacio). |
|   |   | • ball/ballContest.js y |
|   |   | officiating/referee.js (Separar |
|   |   | jockeying, carga física body, |
|   |   | intercepción y tackle con |
|   |   | cooldown). |
| src/engine/ballMovement.j | Mejorar (Upgrade) | Evolucionar a física 2.5D |
| s |   | inspirada en ball/flight/ |
|   |   | (ballistics.rs, aerial.rs, roll.rs): |
|   |   | añadir coordenada de altura |
|   |   | Z y velocidad vertical vz , |
|   |   | efecto Magnus/curva para |
|   |   | centros y tiros libres, bote |
|   |   | realista según |
|   |   | humedad/césped y |
|   |   | predicción del punto de |
|   |   | caída (landing_prediction) |
|   |   | para que los jugadores |
|   |   | ataquen el balón aéreo antes |
|   |   | de que caiga. |
| src/engine/steering.js | Mejorar (Upgrade) | Incorporar de |
|   |   | behaviours/steering.rs y |
|   |   | states/exertion/: rampa de |
|   |   | aceleración de sprint |
|   |   | (sprint_ramp), penalización |
|   |   | de velocidad al girar más de |
|   |   | 90∘ gobernada por agility, y |
|   |   | velocidad de conducción de |
|   |   | balón modulada por control. |
| src/engine/setFreekicks.js | Refactorizar | Integrar las rutinas de balón |
| y setPositions.js |   | parado de |
|   |   | officiating/corner_shape.rs, |
|   |   | restart_shape.rs y |
|   |   | set_pieces.rs: marcaje |


| Archivo Actual en fulbito | Acción | Qué Modificar, Reemplazar |
| --- | --- | --- |
|   |   | o Agregar (Inspirado en |
|   |   | engine y Teoría) |
|   |   | zonal/mixto en córners, |
|   |   | ataque a las 4 zonas del área, |
|   |   | y el duelo psicológico de |
|   |   | penales |
|   |   | (Goalkeeper-Dependent vs. |
|   |   | Goalkeeper-Independent). |
| src/engine/coachAI.js | Reemplazar | Conectar con |
|   |   | tactics/semanticDSS.js y la |
|   |   | lógica de |
|   |   | teamplay/coach/match_coac |
|   |   | h.rs y |
|   |   | substitution/sub_scoring.rs |
|   |   | para que la IA adapte su |
|   |   | bloque, estilo y cambios en |
|   |   | vivo según fatiga (A8 ), |
|   |   | marcador y debilidades del |
|   |   | rival. |
| src/data/formations.js y | Expandir | Ampliar el catálogo a las |
| TacticsBoard.jsx |   | familias de 3, 4 y 5 |
|   |   | defensas, permitir elegir Rol |
|   |   | + Duty en cada nodo, |
|   |   | controles de las 4 Fases del |
|   |   | Juego y un panel visual con |
|   |   | el Radar de Ajuste |
|   |   | Semántico (DSS) de la |
|   |   | plantilla. |

## 5. PLAN DE IMPLEMENTACIÓN PASO A PASO (HOJA DE RUTA)

Para ejecutar este rediseño sin romper la jugabilidad actual de fulbito ni las pantallas de Draft/FUT Draft,

trabajaremos en 5 Fases Incrementales, validando cada etapa con suites de pruebas automatizadas como las de fulbito/tests/ y engine/src/match/engine/tests/:

## Fase 1: Cimientos Espaciales, Física 2.5D y Percepción (space/ + ball/)

- 1. Crear space/pitchZones.js con el mapeo exacto de las 18 Zonas y los 5 Carriles Verticales.

- 2. Implementar space/raycast.js y space/pressureMap.js para calcular el Player Pressure Map (PPM) individual, la orientación corporal (θfacing ) y el cono de espacio libre frontal.

- 3. Actualizar ballMovement.js con trayectorias balísticas 2.5D, predicción de punto de caída


(landingPoint) y fricción de rodamiento.

## Fase 2: Reforma Defensiva, Duelos y Arbitraje Calibrado (Solución a Huecos y Tarjetas)

- 1. Implementar en teamShape.js y tactics/plans/blockPlan.js la Línea de Confrontación, la Línea de Restricción, la Basculación por Centroide y la compresión interlineal (Δx≤12 m).

- 2. Programar el Contrato de Emparejamiento (Engagement Contract) y los estados defensivos (holding_line, covering, marking, guarding, pressing) asegurando que solo un defensor salga al paso (line_step) mientras los demás ejecutan la cobertura y mantienen la regla del +1 (Spare Man).

- 3. Separar en ballContest.js la contención (jockey), la disputa física (body), la intercepción y el tackle (con cooldown), e integrar discipline.js y referee.js para bajar las faltas a ~18-22 por partido y las tarjetas a niveles reales.

## Fase 3: Máquina de Estados Ofensiva, Laterales Proyectados y Evaluadores xG/xT

- 1. Implementar el Breakaway Override y shotEvaluator.js (modelo xG con clasificación Clear Cut, Half Chance y Speculative) para que los delanteros con callejón libre encaren directo al mano a mano sin retroceder jamás.

- 2. Incorporar los estados de forwardStates.js (running_in_behind con diagonales al punto ciego, pinning_cb, false_nine_drop y ataque coordinado a las 4 Zonas de Remate).

- 3. Activar en defenderStates.js y widePlan.js las subidas de laterales y carrileros mediante Overlaps (banda exterior Zonas 13/15) y Underlaps (Half-Spaces Zonas 16/18 para cutbacks), protegidos por la validación de Rest Defence.

- 4. Implementar passEvaluator.js basado en ΔxThreat, geometría de triángulos/diamantes/cajas y combinaciones de Tercer Hombre.

## Fase 4: Cognición, Química, Traits y Personalidad de Jugadores

- 1. Conectar cognition.js (Scanning por perception, memoria espacial y lapse.rs bajo alta presión PPM).

- 2. Integrar en effectiveSkill.js los multiplicadores de Química (μchem ∈[0.85,1.15]) y los sesgos de decisión por Rasgos (Traits) de las cartas Leyenda, Ídolo y Plantel.

## Fase 5: Pizarra Táctica 2.0, Roles/Duties y Motor Semántico DSS (coachAI.js)

- 1. Actualizar formations.js con la genealogía completa de 3, 4 y 5 defensas y añadir el selector de Rol Funcional + Tarea (Defend, Support, Attack) y las instrucciones de las 4 Fases del Continuum en TacticsBoard.jsx.

- 2. Implementar semanticDSS.js con los 14 Macro-Atributos y las 20 Estrategias Canónicas, conectándolo tanto al asistente visual de la pizarra del jugador como al coachAI.js rival para adaptaciones tácticas y sustituciones inteligentes en tiempo real.

- 3. Ejecutar una batería de 200 partidos simulados en headless mode (como baselines/realism-200.json de engine) para calibrar goles promedio (~2.5-2.8 por partido), xG, posesión, pases completados, centros, faltas y tarjetas.

¿Te parece bien esta estructura arquitectónica? Si estás de acuerdo, dime por cuál de las 5 Fases quieres

que empecemos a trabajar (recomiendo arrancar por la Fase 1 + Fase 2 para dejar blindada la grilla espacial, la defensa sin huecos y el nuevo sistema de duelos/arbitraje, o bien atacar directo el movimiento de delanteros y laterales) y pasamos a diseñar e implementar los primeros módulos en código.
