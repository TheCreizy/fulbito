# **Response: ESPECIFICACIÓN DE INGENIERÍA E IMPLEMENTACIÓN: FASES 1 Y 2 («FULBITO 2.0»)**

Esta guía técnica está diseñada para ser ejecutada directamente en **AntiGravity IDE** sobre el repositorio fulbito. Contiene la formulación matemática, la arquitectura de datos, los algoritmos de decisión y los módulos de código en JavaScript (ES6) necesarios para implementar la **Fase 1 (Geometría Espacial, Percepción y Física 2.5D)** y la **Fase 2 (Reforma Defensiva, Contrato de Emparejamiento, Duelos en 3 Capas y Arbitraje Calibrado)**, tomando como base la ingeniería del motor en Rust (engine) y los manuales de táctica y analítica avanzada.

## **0\. DIRECTIVAS DE INTEGRACIÓN PARA ANTIGRAVITY IDE**

Al aplicar estos cambios en fulbito/src/engine/, respeta las siguientes invariantes de arquitectura:

> 1. **Compatibilidad con el Renderizador (MatchSimulator.jsx) y Eventos (commentaryEngine.js):** Mantén intacta la firma pública del estado que consume la interfaz en React (players\[\] con { id, x, y, vx, vy, team, role, state, yellowCards, redCard }, ball con { x, y, z, vx, vy, vz, ownerId }, y el array de eventos del partido).  
> 2. **Sistema de Coordenadas Normalizado y Adaptativo:** Para que las fórmulas geométricas funcionen sin importar la resolución del Canvas, el módulo espacial normaliza cualquier coordenada (*x*,*y*) a dimensiones métricas estándar FIFA (*L*\=105 m de largo ×*W*\=68 m de ancho) y provee funciones de conversión bidireccional hacia las dimensiones en píxeles de fulbito.  
> 3. **Normalización de Atributos (0.0 a 1.0):** Los atributos de la base de datos de fulbito (passing, shooting, tackling, agility, strength, control, perception, saving, jumping, height, freekick, penalty\_taking), que operan en escala 1-100, deben normalizarse mediante *a*^=clamp(*a*/100,0.05,0.99) y multiplicarse por el factor de Química *μchem*​∈\[0.85,1.15\] antes de ingresar a las ecuaciones físicas y cognitivas.

## **FASE 1: CIMIENTOS ESPACIALES, PERCEPCIÓN (PPM / RAYCAST) Y FÍSICA 2.5D**

### **1.1. Geometría de las 18 Zonas, los 5 Carriles y Matriz xThreat (src/engine/space/pitchZones.js)**

El campo se divide longitudinalmente en **6 franjas** (2 de Iniciación, 2 de Creación/Progresión y 2 de Finalización) y transversalmente en **3 sectores base** para conformar las **18 Zonas Tácticas**, superponiendo además los **5 Carriles Verticales** (*Touchline Izquierdo*, *Half-Space Izquierdo*, *Carril Central*, *Half-Space Derecho* y *Touchline Derecho*).

#### **Formulación Matemática**

Sea *u*∈\[0,1\] la coordenada longitudinal relativa a la dirección de ataque del equipo (*u*\=0 línea de meta propia, *u*\=1 línea de meta rival) y *v*∈\[0,1\] la coordenada transversal de izquierda a derecha:

Columna *c*\=⌊3*v*⌋∈{0,1,2},Fila *r*\=⌊6*u*⌋∈{0,1,2,3,4,5}  
Zona18​(*u*,*v*)=3*r*\+*c*\+1∈{1,…,18}

Para los **5 Carriles Verticales**, definimos particiones asimétricas que reflejan el ancho real de las bandas y los medios espacios (*Half-Spaces*):

> * **Banda Izquierda (*Left Touchline*):** *v*∈\[0.00,0.18)  
> * **Medio Espacio Izquierdo (*Left Half-Space*):** *v*∈\[0.18,0.38)  
> * **Carril Central (*Central Corridor*):** *v*∈\[0.38,0.62\]  
> * **Medio Espacio Derecho (*Right Half-Space*):** *v*∈(0.62,0.82\]  
> * **Banda Derecha (*Right Touchline*):** *v*∈(0.82,1.00\]

#### **Implementación: src/engine/space/pitchZones.js**

`// src/engine/space/pitchZones.js`

`export const PITCH_METERS = { LENGTH: 105, WIDTH: 68 };`

`export const LANES = {`  
  `LEFT_WING: 0,`  
  `LEFT_HALF_SPACE: 1,`  
  `CENTER: 2,`  
  `RIGHT_HALF_SPACE: 3,`  
  `RIGHT_WING: 4,`  
`};`

`// Valor de Amenaza Esperada (xThreat) para las 18 Zonas (Zonas 1 a 18)`  
`// Zonas 10, 12 (Half-spaces medios), Zona 14 (Balcón del área) y Zona 16-18 (Área) tienen prioridad`  
`export const ZONE_XTHREAT = {`  
  `1: 0.01,  2: 0.015, 3: 0.015, // Iniciación baja`  
  `4: 0.02,  5: 0.03,  6: 0.03,  // Salida y contención`  
  `7: 0.045, 8: 0.055, 9: 0.045, // Mediocampo base`  
  `10: 0.11, 11: 0.09, 12: 0.11, // Half-spaces de gestación y pivote alto`  
  `13: 0.14, 14: 0.24, 15: 0.14, // Bandas 3/4 y Zona 14 (Centro Neurálgico)`  
  `16: 0.32, 17: 0.55, 18: 0.32  // Pasillos de cutback (16, 18) y Zona de Definición (17)`  
`};`

`/**`  
 `* Convierte coordenadas del canvas (x, y) a coordenadas relativas (u, v) en [0, 1]`  
 `* según la dirección de ataque del equipo (attackDir: 1 hacia derecha, -1 hacia izquierda).`  
 `*/`  
`export function toRelativeUV(x, y, pitchBounds, attackDir = 1) {`  
  `const rawU = (x - pitchBounds.minX) / pitchBounds.width;`  
  `const rawV = (y - pitchBounds.minY) / pitchBounds.height;`  
  `const u = attackDir === 1 ? rawU : 1.0 - rawU;`  
  `const v = attackDir === 1 ? rawV : 1.0 - rawV;`  
  `return {`  
    `u: Math.max(0, Math.min(0.9999, u)),`  
    `v: Math.max(0, Math.min(0.9999, v)),`  
  `};`  
`}`

`/**`  
 `* Devuelve el número de Zona Táctica (1 a 18) siguiendo la grilla oficial:`  
 `* Zona 14 = Balcón central del área rival, Zona 17 = Punto penal / Área chica rival.`  
 `*/`  
`export function getTacticalZone18(x, y, pitchBounds, attackDir = 1) {`  
  `const { u, v } = toRelativeUV(x, y, pitchBounds, attackDir);`  
  `const row = Math.floor(u * 6); // 0..5`  
  `const col = Math.floor(v * 3); // 0=Izq, 1=Centro, 2=Der`

  `// Mapeo exacto al Manual Táctico de 18 Zonas:`  
  `const zoneMatrix = [`  
    `[2, 1, 3],    // Fila 0: Área propia (1) y costados defensivos (2, 3)`  
    `[5, 4, 6],    // Fila 1: Eje de salida (4) e interiores defensivos (5, 6)`  
    `[7, 8, 9],    // Fila 2: Bandas medias (7, 9) y eje intermedio (8)`  
    `[10, 11, 12], // Fila 3: Half-spaces medios (10, 12) y eje alto (11)`  
    `[13, 14, 15], // Fila 4: Extremos 3/4 (13, 15) y Zona 14 (Creación / Balcón)`  
    `[16, 17, 18], // Fila 5: Desborde/Cutback (16, 18) y Zona 17 (Remate final)`  
  `];`

  `return zoneMatrix[row][col];`  
`}`

`/**`  
 `* Devuelve cuál de los 5 Carriles Verticales ocupa el punto (x, y).`  
 `*/`  
`export function getVerticalLane(x, y, pitchBounds, attackDir = 1) {`  
  `const { v } = toRelativeUV(x, y, pitchBounds, attackDir);`  
  `if (v < 0.18) return LANES.LEFT_WING;`  
  `if (v < 0.38) return LANES.LEFT_HALF_SPACE;`  
  `if (v <= 0.62) return LANES.CENTER;`  
  `if (v <= 0.82) return LANES.RIGHT_HALF_SPACE;`  
  `return LANES.RIGHT_WING;`  
`}`

`export function getZoneXThreat(x, y, pitchBounds, attackDir = 1) {`  
  `const zone = getTacticalZone18(x, y, pitchBounds, attackDir);`  
  `return ZONE_XTHREAT[zone] || 0.02;`  
`}`

### **1.2. Mapa de Presión Individual (PPM) y Raycasting Espacial (src/engine/space/pressureMap.js y raycast.js)**

Basándonos en el modelo de cuantificación espacial de presión en 8 direcciones y en el módulo raycast/space.rs de engine, el motor necesita medir cuánta presión recibe cada jugador y cuánto espacio libre tiene por delante antes de tomar una decisión.

#### **Formulación Matemática de la Presión (PPM)**

Para un jugador objetivo en la posición p*i*​ con velocidad v*i*​ y orientación corporal *θi*​, cada rival *k* ubicado en p*k*​ con velocidad v*k*​ dentro de un radio de influencia *Rpress*​ genera una presión direccional *pik*​:

*dik*​\=∥p*k*​−p*i*​∥,u*ik*​\=*dik*​p*k*​−p*i*​​

La velocidad de cierre (*closing speed*) del defensor hacia el atacante es *vclose*​\=max(0,−v*k*​⋅u*ik*​), lo que acorta el tiempo estimado de llegada *τik*​:

*pik*​\=exp(−2*σd*2​*dik*2​​)⋅(1+0.35⋅*vmax*​*vclose*​​)⋅*wfrontal*​(*θi*​,u*ik*​)

Donde *wfrontal*​\=1.25 si el defensor acosa dentro del campo visual frontal del poseedor (bloqueando su progresión) y 1.15 si llega por el punto ciego trasero (riesgo de robo por sorpresa). La presión total agregada sobre el jugador *i* es:

PPM*i*​\=1−*k*∈Rivales∏​(1−min(0.95,*pik*​))∈\[0,1\]

#### **Implementación: src/engine/space/pressureMap.js y src/engine/space/raycast.js**

`// src/engine/space/pressureMap.js`

`/**`  
 `* Calcula el Player Pressure Map (PPM) de un jugador (escalar total [0..1] y octantes direccionales)`  
 `* inspirado en el modelo de cuantificación de presión en 8 direcciones.`  
 `*/`  
`export function computePlayerPressure(player, opponents, scaleMetersToPx = 6.0) {`  
  `const sigmaPx = 4.5 * scaleMetersToPx; // ~4.5 metros de radio característico`  
  `const maxRadiusPx = 12.0 * scaleMetersToPx;`  
  `const directional = new Float32Array(8); // 8 sectores de 45 grados`  
  `let survivalProb = 1.0;`  
  `let closestDist = Infinity;`  
  `let closestDefender = null;`

  `const facingCos = Math.cos(player.facingAngle || 0);`  
  `const facingSin = Math.sin(player.facingAngle || 0);`

  `for (let k = 0; k < opponents.length; k++) {`  
    `const opp = opponents[k];`  
    `if (opp.redCard || opp.role === 'GK') continue;`

    `const dx = opp.x - player.x;`  
    `const dy = opp.y - player.y;`  
    `const distSq = dx * dx + dy * dy;`  
    `if (distSq > maxRadiusPx * maxRadiusPx) continue;`

    `const dist = Math.sqrt(distSq) || 0.001;`  
    `if (dist < closestDist) {`  
      `closestDist = dist;`  
      `closestDefender = opp;`  
    `}`

    `const ux = dx / dist;`  
    `const uy = dy / dist;`

    `// Velocidad de cierre del rival hacia el jugador`  
    `const relVx = (opp.vx || 0) - (player.vx || 0);`  
    `const relVy = (opp.vy || 0) - (player.vy || 0);`  
    `const closingSpeed = Math.max(0, -(relVx * ux + relVy * uy));`

    `// Factor de orientación respecto al cuerpo del poseedor`  
    `const dotFacing = ux * facingCos + uy * facingSin;`  
    `const orientationWeight = dotFacing > 0.3 ? 1.25 : (dotFacing < -0.5 ? 1.15 : 1.0);`

    `const basePress = Math.exp(-distSq / (2 * sigmaPx * sigmaPx));`  
    `const p_ik = Math.min(0.95, basePress * (1 + 0.35 * Math.min(1.5, closingSpeed / 4.0)) * orientationWeight);`

    `// Asignar al octante correspondiente (0..7)`  
    `const angle = Math.atan2(dy, dx);`  
    `const octant = ((Math.round((angle / (Math.PI * 2)) * 8) % 8) + 8) % 8;`  
    `directional[octant] = Math.max(directional[octant], p_ik);`

    `survivalProb *= (1.0 - p_ik);`  
  `}`

  `return {`  
    `totalPressure: 1.0 - survivalProb, // [0..1]`  
    `directional,                        // Presión en 8 direcciones alrededor del jugador`  
    `closestDistMeters: closestDist / scaleMetersToPx,`  
    `closestDefender,`  
  `};`  
`}`

`// src/engine/space/raycast.js`

`/**`  
 `` * Proyecta un corredor/cono desde `origin` en la dirección `angle` hasta `maxDistPx` ``  
 `* y devuelve la distancia libre de rivales y si el corredor hacia el arco está despejado.`  
 `* (Adaptado de engine/src/match/engine/raycast/space.rs)`  
 `*/`  
`export function raycastCorridor(origin, angle, maxDistPx, opponents, corridorHalfWidthPx = 18) {`  
  `const dirX = Math.cos(angle);`  
  `const dirY = Math.sin(angle);`  
  `let minBlockerProj = maxDistPx;`  
  `let blockerCount = 0;`  
  `let firstBlocker = null;`

  `for (let i = 0; i < opponents.length; i++) {`  
    `const opp = opponents[i];`  
    `if (opp.redCard || opp.role === 'GK') continue;`

    `const rx = opp.x - origin.x;`  
    `const ry = opp.y - origin.y;`

    `// Proyección longitudinal sobre el rayo`  
    `const proj = rx * dirX + ry * dirY;`  
    `if (proj <= 0 || proj > maxDistPx) continue;`

    `// Distancia perpendicular al eje del rayo (con margen dinámico por velocidad del defensor)`  
    `const perpDist = Math.abs(-rx * dirY + ry * dirX);`  
    `const effectiveRadius = corridorHalfWidthPx + (opp.tackling ? (opp.tackling / 100) * 6 : 4);`

    `if (perpDist <= effectiveRadius) {`  
      `blockerCount++;`  
      `if (proj < minBlockerProj) {`  
        `minBlockerProj = proj;`  
        `firstBlocker = opp;`  
      `}`  
    `}`  
  `}`

  `return {`  
    `isClear: blockerCount === 0,`  
    `clearDistancePx: minBlockerProj,`  
    `blockerCount,`  
    `firstBlocker,`  
  `};`  
`}`

### **1.3. Física Balística 2.5D y Predicción de Caída (src/engine/ballMovement.js)**

Inspirado en engine/src/match/engine/ball/ball/flight/ (ballistics.rs, aerial.rs, roll.rs), el balón pasa de ser una partícula plana 2D a un cuerpo 2.5D con altura *z*, velocidad vertical *vz*​, vector de rotación (*spin* *ωz*​ para efecto Magnus en centros/tiros libres) y predicción analítica del punto de aterrizaje (landingPoint).

#### **Ecuaciones de Movimiento por Tick (Δ*t*)**

> 1. **Fase Aérea (*z*\>0 o *vz*​\>0):**  
   * Gravedad y resistencia aerodinámica:  
     *vz*​(*t*\+Δ*t*)=*vz*​(*t*)−*g*⋅Δ*t*  
   * Fuerza lateral de Magnus (curva por efecto *ωz*​, gobernada por freekick, passing o shooting):  
     a*magnus*​\=*CM*​⋅(*ω*×v*xy*​)⟹*amx*​\=−*CM*​*ωz*​*vy*​,*amy*​\=*CM*​*ωz*​*vx*​  
   * Rebote en el césped (*z*≤0 y *vz*​\<0):  
     *vz*\+​\=−*erestitucio*ˊ*n*​⋅*vz*−​,v*xy*\+​\=*ηbote*​⋅v*xy*−​  
     donde *erestitucio*ˊ*n*​≈0.58 (menor en césped húmedo) y si ∣*vz*\+​∣\<*vumbral*​, el balón entra en fase de rodamiento (*z*\=0,*vz*​\=0).  
> 2. **Fase de Rodamiento (*z*\=0):**  
   * Desaceleración por fricción de césped (roll.rs):  
     v*xy*​(*t*\+Δ*t*)=v*xy*​(*t*)⋅*μgrass*​  
> 3. **Predicción Analítica de Caída (predictLandingPoint):**  
   * Resolviendo *z*0​\+*vz*0​*tvuelo*​−21​*gtvuelo*2​\=0, obtenemos el tiempo exacto hasta el primer bote:  
     *tvuelo*​\=*gvz*0​\+*vz*02​\+2*gz*0​​​  
     Esto permite a los delanteros (cross\_receiving), centrales (aerial\_duel) y arquero (gk\_claim) correr hacia el punto exacto de caída antes de que la pelota baje.

#### **Implementación: Actualización de src/engine/ballMovement.js**

`// src/engine/ballMovement.js (Núcleo 2.5D Balístico)`

`export const BALL_PHYSICS = {`  
  `GRAVITY: 0.28,           // Aceleración gravitatoria por tick`  
  `AIR_DRAG: 0.992,         // Resistencia del aire en vuelo`  
  `GRASS_FRICTION: 0.955,   // Fricción de rodamiento en césped seco`  
  `WET_FRICTION: 0.972,     // Césped mojado: el balón patina más rápido`  
  `BOUNCE_RESTITUTION: 0.56,// Coeficiente de restitución vertical`  
  `BOUNCE_XY_DAMPING: 0.82, // Pérdida horizontal en cada pique`  
  `MAGNUS_COEFF: 0.018,     // Coeficiente de curva por spin`  
`};`

`/**`  
 `* Lanza o golpea el balón en 2.5D especificando vector horizontal, velocidad vertical (loft) y curva (spin).`  
 `*/`  
`export function kickBall25D(ball, vx, vy, vz = 0, spinZ = 0) {`  
  `ball.vx = vx;`  
  `ball.vy = vy;`  
  `ball.vz = vz;`  
  `ball.z = Math.max(0, ball.z || 0);`  
  `ball.spinZ = spinZ; // Positivo = curva a la derecha, Negativo = izquierda`  
  `ball.ownerId = null;`  
  `ball.landingPoint = predictBallLanding(ball);`  
`}`

`/**`  
 `* Predice dónde picará el balón aéreo por primera vez (inspirado en landing_prediction_tests.rs).`  
 `*/`  
`export function predictBallLanding(ball) {`  
  `if ((ball.z || 0) <= 0.1 && (ball.vz || 0) <= 0.1) {`  
    `// Si va al ras del piso, proyectamos punto de frenado corto`  
    `return {`  
      `x: ball.x + ball.vx * 12,`  
      `y: ball.y + ball.vy * 12,`  
      `ticksToLand: 0,`  
      `isAerial: false,`  
    `};`  
  `}`

  `const g = BALL_PHYSICS.GRAVITY;`  
  `const vz = ball.vz || 0;`  
  `const z = Math.max(0, ball.z || 0);`  
  `const disc = vz * vz + 2 * g * z;`  
  `const ticks = (vz + Math.sqrt(Math.max(0, disc))) / g;`

  `// Integración rápida considerando drag y efecto Magnus promedio`  
  `let simX = ball.x;`  
  `let simY = ball.y;`  
  `let svx = ball.vx;`  
  `let svy = ball.vy;`  
  `const spin = ball.spinZ || 0;`  
  `const steps = Math.min(180, Math.ceil(ticks));`

  `for (let i = 0; i < steps; i++) {`  
    `const mx = -BALL_PHYSICS.MAGNUS_COEFF * spin * svy;`  
    `const my = BALL_PHYSICS.MAGNUS_COEFF * spin * svx;`  
    `svx = (svx + mx) * BALL_PHYSICS.AIR_DRAG;`  
    `svy = (svy + my) * BALL_PHYSICS.AIR_DRAG;`  
    `simX += svx;`  
    `simY += svy;`  
  `}`

  `return {`  
    `x: simX,`  
    `y: simY,`  
    `ticksToLand: steps,`  
    `isAerial: (z > 8 || vz > 2.2),`  
  `};`  
`}`

`/**`  
 `* Actualiza la física 2.5D del balón en cada tick de simulación.`  
 `*/`  
`export function updateBallPhysics25D(ball, isWetPitch = false) {`  
  `if (ball.ownerId !== null && ball.ownerId !== undefined) {`  
    `ball.z = 0;`  
    `ball.vz = 0;`  
    `ball.spinZ = 0;`  
    `ball.landingPoint = { x: ball.x, y: ball.y, ticksToLand: 0, isAerial: false };`  
    `return;`  
  `}`

  `const isAirborne = (ball.z || 0) > 0.05 || (ball.vz || 0) > 0.05;`

  `if (isAirborne) {`  
    `// 1. Efecto Magnus (comba en centros, pases largos y tiros libres)`  
    `const spin = ball.spinZ || 0;`  
    `const magX = -BALL_PHYSICS.MAGNUS_COEFF * spin * ball.vy;`  
    `const magY = BALL_PHYSICS.MAGNUS_COEFF * spin * ball.vx;`

    `ball.vx = (ball.vx + magX) * BALL_PHYSICS.AIR_DRAG;`  
    `ball.vy = (ball.vy + magY) * BALL_PHYSICS.AIR_DRAG;`  
    `ball.vz = (ball.vz || 0) - BALL_PHYSICS.GRAVITY;`

    `ball.x += ball.vx;`  
    `ball.y += ball.vy;`  
    `ball.z = (ball.z || 0) + ball.vz;`

    `// 2. Detección de pique contra el césped`  
    `if (ball.z <= 0) {`  
      `ball.z = 0;`  
      `if (Math.abs(ball.vz) > 0.85) {`  
        `ball.vz = -ball.vz * BALL_PHYSICS.BOUNCE_RESTITUTION;`  
        `ball.vx *= BALL_PHYSICS.BOUNCE_XY_DAMPING;`  
        `ball.vy *= BALL_PHYSICS.BOUNCE_XY_DAMPING;`  
        `ball.spinZ *= 0.6;`  
      `} else {`  
        `ball.vz = 0;`  
        `ball.spinZ = 0;`  
      `}`  
    `}`  
    `ball.landingPoint = predictBallLanding(ball);`  
  `} else {`  
    `// 3. Rodamiento sobre el césped`  
    `ball.z = 0;`  
    `ball.vz = 0;`  
    `const friction = isWetPitch ? BALL_PHYSICS.WET_FRICTION : BALL_PHYSICS.GRASS_FRICTION;`  
    `ball.vx *= friction;`  
    `ball.vy *= friction;`

    `if (Math.hypot(ball.vx, ball.vy) < 0.08) {`  
      `ball.vx = 0;`  
      `ball.vy = 0;`  
    `}`  
    `ball.x += ball.vx;`  
    `ball.y += ball.vy;`  
    `ball.landingPoint = { x: ball.x, y: ball.y, ticksToLand: 0, isAerial: false };`  
  `}`  
`}`

## **FASE 2: REFORMA DEFENSIVA, CONTRATO DE EMPAREJAMIENTO, DUELOS EN 3 CAPAS Y ARBITRAJE**

### **2.1. Arquitectura del Bloque, Basculación, Compresión y *Spare Man* (src/engine/teamShape.js)**

Aquí erradicamos el problema de los **huecos defensivos** y la **desconexión entre líneas** de fulbito. Siguiendo los principios de *Compresión, Balance, Cobertura y Consolidación*, y el modelo matemático de Compendio Táctico Integrado junto con teamplay/plans/block.rs de engine:

#### **Reglas Geométricas del Bloque Defensivo**

> 1. Líneas de Referencia (blockHeight):  
   * **Bloque Alto (high):** Línea de Restricción (zaga) a 45 m de la meta propia (*uzaga*​\=0.43); Línea de Confrontación a 75 m (*uconf*​\=0.71).  
   * **Bloque Medio (medium):** Línea de Restricción a 28 m (*uzaga*​\=0.27); Línea de Confrontación a 52 m (*uconf*​\=0.50).  
   * **Bloque Bajo (low):** Línea de Restricción a 14 m (*uzaga*​\=0.13); Línea de Confrontación a 32 m (*uconf*​\=0.30).  
> 2. Compresión Vertical (Δ*xl*ıˊ*neas*​≤12 m): En fase sin balón, la línea de mediocampistas se sitúa a una distancia máxima Δ*xdef*−*mid*​\=11.5 m por delante de la zaga, cerrando la **Zona 14** propia para impedir recepciones entre líneas.  
> 3. Basculación Lateral por Centroide y Balance del Lado Débil: Si el balón está en *ybalo*ˊ*n*​ y el centroide transversal de la formación base es *ycentroide*​:  
>    Δ*ybasc*​\=*kbasc*​⋅(*ybalo*ˊ*n*​−*ycentroide*​),*kbasc*​∈\[0.35,0.55\]  
>    Además, los jugadores del **lado débil** (opuesto al balón) comprimen su separación horizontal hacia el carril central un 30% adicional (Principio de *Balance* para no dejar pasillos internos abiertos).  
> 4. Detonantes de Presión (*Pressing Triggers*): El bloque salta hacia adelante (+8 m en Línea de Confrontación y activación de presión intensa) si detecta: (a) pase atrás del rival, (b) receptor rival de espaldas a nuestro arco (cos*θ*\<−0.3), (c) control largo defectuoso del rival, o (d) poseedor rival encerrado en las bandas (*Touchlines*).

#### **Implementación: Nuevo motor de estructura en src/engine/teamShape.js**

`// src/engine/teamShape.js (Reforma Estructural Completa - Fase 2)`

`export const BLOCK_CONFIGS = {`  
  `low:    { restraintU: 0.14, confrontationU: 0.32, lineSpacingU: 0.10, basculationK: 0.50 },`  
  `medium: { restraintU: 0.27, confrontationU: 0.52, lineSpacingU: 0.11, basculationK: 0.45 },`  
  `high:   { restraintU: 0.43, confrontationU: 0.72, lineSpacingU: 0.12, basculationK: 0.40 },`  
`};`

`/**`  
 `* Evalúa si se activa un Detonante de Presión (Pressing Trigger) en tiempo real.`  
 `*/`  
`export function evaluatePressingTrigger(ballCarrier, ball, pitchBounds, defendingAttackDir) {`  
  `if (!ballCarrier) return false;`

  `// 1. Poseedor encerrado contra la línea de banda (Touchline)`  
  `const relY = (ball.y - pitchBounds.minY) / pitchBounds.height;`  
  `const nearTouchline = relY < 0.12 || relY > 0.88;`

  `// 2. Poseedor perfilado de espaldas hacia el arco que defiende el equipo`  
  `const goalDirX = -defendingAttackDir; // Dirección hacia donde ataca el rival`  
  `const carrierFacingX = Math.cos(ballCarrier.facingAngle || 0);`  
  `const isFacingOwnGoal = (carrierFacingX * goalDirX) < -0.25;`

  `// 3. Control defectuoso (balón separado > 1.8m del cuerpo del poseedor)`  
  `const ballDist = Math.hypot(ball.x - ballCarrier.x, ball.y - ballCarrier.y);`  
  `const isHeavyTouch = ballDist > 14;`

  `return nearTouchline || isFacingOwnGoal || isHeavyTouch;`  
`}`

`/**`  
 `* Calcula las coordenadas objetivo (anclas dinámicas) de todo el bloque defensivo`  
 `* garantizando sincronización de línea, compresión <=12m, basculación y regla del +1.`  
 `*/`  
`export function computeDefensiveBlockTargets(teamPlayers, opponents, ball, pitchBounds, tactics = {}) {`  
  `const attackDir = tactics.attackDir || 1; // 1: defiende lado izq (minX), -1: defiende lado der (maxX)`  
  `const blockType = tactics.blockHeight || 'medium';`  
  `const cfg = BLOCK_CONFIGS[blockType] || BLOCK_CONFIGS.medium;`

  `const ballU = attackDir === 1`  
    `? (ball.x - pitchBounds.minX) / pitchBounds.width`  
    `: (pitchBounds.maxX - ball.x) / pitchBounds.width;`  
  `const ballV = (ball.y - pitchBounds.minY) / pitchBounds.height;`

  `const ballCarrier = opponents.find(o => o.id === ball.ownerId);`  
  `const triggerActive = evaluatePressingTrigger(ballCarrier, ball, pitchBounds, attackDir);`

  `// 1. Calcular altura sincronizada de la última línea defensiva (Línea de Restricción dinámica)`  
  `// La zaga sube con el balón hasta el tope de su bloque, pero retrocede si el balón supera la medular`  
  `const rawLineU = Math.min(cfg.restraintU + (triggerActive ? 0.06 : 0), Math.max(0.09, ballU - 0.16));`

  `// Si un rival sin presión está por lanzar un pase largo (amenaza a la espalda), la zaga hace "Drop Off"`  
  `const unpressuredPasser = ballCarrier && (ballCarrier.pressurePPM || 0) < 0.25 && ballU < 0.65;`  
  `const finalBacklineU = unpressuredPasser ? Math.max(0.10, rawLineU - 0.05) : rawLineU;`

  `// 2. Centroide transversal y vector de Basculación Lateral`  
  `const centerV = 0.5;`  
  `const deltaV = cfg.basculationK * (ballV - centerV);`

  `// 3. Contar delanteros rivales en zona avanzada para Regla del +1 (Spare Man)`  
  `const advancedOpponents = opponents.filter(o => {`  
    `const oppU = attackDir === 1`  
      `? (o.x - pitchBounds.minX) / pitchBounds.width`  
      `: (pitchBounds.maxX - o.x) / pitchBounds.width;`  
    `return oppU < finalBacklineU + 0.14;`  
  `});`

  `const defenders = teamPlayers.filter(p => p.line === 'DEF' && !p.redCard);`  
  `const needPivotDrop = advancedOpponents.length >= defenders.length; // Si hay igualdad numérica, baja el MCD (+1)`

  `const targets = new Map();`

  `for (const player of teamPlayers) {`  
    `if (player.role === 'GK' || player.redCard) continue;`

    `// Coordenada base normalizada de la formación (baseU, baseV en [0, 1])`  
    `const baseU = player.formationBaseU ?? 0.3;`  
    `const baseV = player.formationBaseV ?? 0.5;`

    `let targetU = finalBacklineU;`  
    `if (player.line === 'DEF') {`  
      `// Toda la línea defensiva comparte exactamente la misma coordenada X (línea sincronizada)`  
      `targetU = finalBacklineU;`  
    `} else if (player.line === 'MID') {`  
      `// Si falta el +1 en la zaga y este jugador es el Pivote (MCD), se incrusta entre centrales`  
      `if (needPivotDrop && player.tacticalRole === 'PIVOT') {`  
        `targetU = finalBacklineU + 0.02;`  
      `} else {`  
        `// Compresión vertical estricta (máximo ~11-12m delante de la zaga)`  
        `targetU = Math.min(cfg.confrontationU, finalBacklineU + cfg.lineSpacingU);`  
      `}`  
    `} else {`  
      `// Delanteros en fase defensiva: sobre la Línea de Confrontación para retardar (Delay) y tapar pivotes`  
      `targetU = Math.min(cfg.confrontationU + 0.08, Math.max(finalBacklineU + 0.22, ballU - 0.04));`  
    `}`

    `// Compresión transversal hacia el balón (Principio de Compresión + Balance del lado débil)`  
    `const distFromCenterV = baseV - 0.5;`  
    `const isWeakSide = (ballV < 0.45 && baseV > 0.55) || (ballV > 0.55 && baseV < 0.45);`  
    `const widthCompression = isWeakSide ? 0.62 : 0.78; // El lado débil se cierra un 38% hacia el eje central`

    `const targetV = Math.max(0.08, Math.min(0.92, 0.5 + distFromCenterV * widthCompression + deltaV));`

    `const worldX = attackDir === 1`  
      `? pitchBounds.minX + targetU * pitchBounds.width`  
      `: pitchBounds.maxX - targetU * pitchBounds.width;`  
    `const worldY = pitchBounds.minY + targetV * pitchBounds.height;`

    `targets.set(player.id, { x: worldX, y: worldY, backlineX: worldX, triggerActive });`  
  `}`

  `return targets;`  
`}`

### **2.2. Contrato de Emparejamiento (*Engagement Contract*) y Coberturas/Permutas (src/engine/playerMovement.js)**

El mayor defecto visual y táctico de los motores 2D simples ocurre cuando dos o tres defensores corren como un enjambre hacia el portador del balón, dejando un cráter en el área. En engine (states/engagement/closing.rs, defenders/states/common/line\_step.rs, covering/mod.rs) y en el manual táctico, esto se resuelve asignando en cada tick los roles de **1.er Defensor**, **2.º Defensor** y **3.er Defensor**:

                       `[ POSEEDOR RIVAL CON BALÓN ]`  
                                    `│`  
                   `(Solo 1 asignado por EngagementContract)`  
                                    `▼`  
                     `[ 1.er DEFENSOR: DELAY / PRESS ]`  
                       `(Sale de la línea: line_step)`  
                              `╱           ╲`  
             `(Cierra diagonal)             (Cierra diagonal)`  
                    `▼                               ▼`  
      `[ 2.º DEFENSOR: COVER ]               [ 2.º DEFENSOR: COVER ]`  
     `(Protege espalda y línea de pase)     (Listo para Permuta si el 1º cae)`

#### **Implementación: Asignador de Roles Defensivos (assignDefensiveEngagementRoles)**

`// src/engine/playerMovement.js (Módulo de Coordinación Defensiva: 1er, 2do y 3er Defensor)`

`/**`  
 `* Asigna exactamente:`  
 `* - Un 1.er Defensor por zona de balón (sale a retardar/presionar: 'PRESSING_STEP').`  
 `* - Dos 2.os Defensores en cobertura diagonal detrás de él ('COVERING').`  
 `* - El resto de la línea en equilibrio y vigilancia zonal/individual ('HOLDING_LINE' / 'MARKING').`  
 `*/`  
`export function assignDefensiveEngagementRoles(defendingTeam, opponents, ball, blockTargets, scaleMetersToPx = 6.0) {`  
  `const roles = new Map();`  
  `const activeFieldPlayers = defendingTeam.filter(p => p.role !== 'GK' && !p.redCard);`

  `// 1. Elegir al 1.er Defensor (quien tiene el contrato exclusivo de salir al balón)`  
  `// Priorizamos mediocampistas sobre centrales para no romper la última línea salvo que el balón ya esté en Zona 14/17`  
  `let bestPresser = null;`  
  `let bestScore = Infinity;`

  `for (const player of activeFieldPlayers) {`  
    `const distToBall = Math.hypot(ball.x - player.x, ball.y - player.y);`  
    `const anchor = blockTargets.get(player.id) || player;`  
    `const distFromAnchor = Math.hypot(ball.x - anchor.x, ball.y - anchor.y);`

    `// Penalizar que un Defensa Central salga lejos de su zona salvo urgencia en puerta de área`  
    `const centralPenalty = (player.line === 'DEF' && distFromAnchor > 11 * scaleMetersToPx) ? 85 : 0;`  
    `const score = distToBall + 0.45 * distFromAnchor + centralPenalty;`

    `if (score < bestScore) {`  
      `bestScore = score;`  
      `bestPresser = player;`  
    `}`  
  `}`

  `// 2. Si el 1.er Defensor es un Defensa (hizo line_step), activar Cobertura (2.º Defensor) en sus compañeros de zaga`  
  `const presserAnchor = bestPresser ? blockTargets.get(bestPresser.id) : null;`

  `for (const player of activeFieldPlayers) {`  
    `if (bestPresser && player.id === bestPresser.id) {`  
      `// El 1.er Defensor se posiciona entre el balón y su propio arco a distancia de Jockey (1.5m)`  
      `roles.set(player.id, {`  
        `state: 'FIRST_DEFENDER_DELAY',`  
        `targetX: ball.x,`  
        `targetY: ball.y,`  
      `});`  
      `continue;`  
    `}`

    `const myAnchor = blockTargets.get(player.id) || { x: player.x, y: player.y };`

    `// Verificar si un compañero de la zaga salió al cruce (line_step) y dejó hueco`  
    `if (`  
      `bestPresser &&`  
      `bestPresser.line === 'DEF' &&`  
      `player.line === 'DEF' &&`  
      `presserAnchor &&`  
      `Math.abs(myAnchor.y - presserAnchor.y) < 22 * scaleMetersToPx`  
    `) {`  
      `// Principio de COBERTURA y PERMUTA:`  
      `// El 2.º defensor cierra un 40% hacia el hueco dejado por el 1.er defensor y da 2.5m de profundidad a su espalda`  
      `const coverY = myAnchor.y + 0.42 * (presserAnchor.y - myAnchor.y);`  
      `const coverX = myAnchor.x + (player.attackDir === 1 ? -2.5 : 2.5) * scaleMetersToPx;`

      `roles.set(player.id, {`  
        `state: 'SECOND_DEFENDER_COVER',`  
        `targetX: coverX,`  
        `targetY: coverY,`  
      `});`  
      `continue;`  
    `}`

    `// 3. Evaluar Marcaje Mixto en la zona de influencia (cortar líneas de pase a receptores cercanos)`  
    `let dangerousRunner = null;`  
    `let minRunnerDist = 8.5 * scaleMetersToPx;`

    `for (const opp of opponents) {`  
      `if (opp.id === ball.ownerId || opp.role === 'GK' || opp.redCard) continue;`  
      `const dToAnchor = Math.hypot(opp.x - myAnchor.x, opp.y - myAnchor.y);`  
      `if (dToAnchor < minRunnerDist) {`  
        `minRunnerDist = dToAnchor;`  
        `dangerousRunner = opp;`  
      `}`  
    `}`

    `if (dangerousRunner) {`  
      `// Posicionarse "Goal-Side" (entre el receptor rival y nuestro arco) sin romper la línea de offside`  
      `const goalSideOffset = (player.attackDir === 1 ? -1.8 : 1.8) * scaleMetersToPx;`  
      `const clampedX = player.line === 'DEF'`  
        `? (player.attackDir === 1 ? Math.max(myAnchor.backlineX, dangerousRunner.x + goalSideOffset) : Math.min(myAnchor.backlineX, dangerousRunner.x + goalSideOffset))`  
        `: dangerousRunner.x + goalSideOffset;`

      `roles.set(player.id, {`  
        `state: 'MARKING_TIGHT',`  
        `targetX: clampedX,`  
        `targetY: 0.65 * dangerousRunner.y + 0.35 * myAnchor.y,`  
        `markedOpponentId: dangerousRunner.id,`  
      `});`  
    `} else {`  
      `// 3.er Defensor: Mantener línea sincronizada y Balance zonal`  
      `roles.set(player.id, {`  
        `state: 'HOLDING_LINE_BALANCE',`  
        `targetX: myAnchor.x,`  
        `targetY: myAnchor.y,`  
      `});`  
    `}`  
  `}`

  `return roles;`  
`}`

### **2.3. Resolución de Duelos en 3 Capas (src/engine/ballContest.js)**

En el fulbito actual (actions.js), cada vez que un defensor se acerca al poseedor del balón ejecuta un *tackle* directo con alta probabilidad de falta. En engine (src/match/engine/ball/ball/contest/), las disputas se separan en módulos físicos independientes (interception.rs, pass\_block.rs, body.rs, tackle.rs), logrando que la mayoría de las recuperaciones provengan de **intercepciones**, **bloqueos** y **cargas físicas hombro con hombro** tras retardar al rival (*Delay*).

#### **Matemática de las 3 Capas de Disputa**

> 1. Capa 1 — Intercepción y Bloqueo de Pase (interception / pass\_block — 0% Falta): Cuando el balón viaja suelto (ball.ownerId \=== null) y pasa a una distancia *d*⊥​ de un defensor:  
>    *Rintercept*​\=*Rbase*​⋅(0.65+0.35*a*^*agility*​\+0.35*a*^*tackling*​\+0.30*a*^*perception*​)⋅*μchem*​  
>    Si *d*⊥​≤*Rintercept*​ y la altura del balón *z*≤*Halcance*​(height,jumping), el defensor corta el envío limpiamente sin posibilidad de falta.  
> 2. Capa 2 — Contención (*Jockeying*) y Disputa Corporal Hombro con Hombro (body.rs — 5% Falta): Cuando el 1.er Defensor está a *d*≤1.8 m del portador del balón:  
   * Primero aplica **Retardación (*Delay / Jockey*)**: reduce la velocidad máxima de conducción del atacante un 35% y sube su presión PPM*i*​.  
   * Si ambos corren en paralelo (∣*θdef*​−*θatt*​∣\<55∘), se resuelve un **Duelo de Cuerpo (bodyContest)** confrontando fuerza y equilibrio:  
     *Sdef*​\=0.60*a*^*strengthdef*​\+0.40*a*^*agilitydef*​\+*ϵ*,*Satt*​\=0.55*a*^*strengthatt*​\+0.45*a*^*controlatt*​  
     Si *Sdef*​\>*Satt*​\+0.08, el defensor gana la posición con el cuerpo y toma posesión limpiamente. Solo si el defensor pierde por amplio margen pero fuerza el choque con baja agilidad se cobra carga ilícita (probabilidad neta \<5%).  
> 3. Capa 3 — Entrada al Balón (tackle.rs con Cooldown y Ventana Angular):  
   * Todo jugador tiene un contador tackleCooldownTicks (mínimo **50 ticks** entre entradas).  
   * **Ángulo de Ataque (cos*ϕ*):** Se calcula el ángulo entre el vector (p*att*​−p*def*​) y la dirección de avance del atacante.  
     * Entrada frontal o lateral (cos*ϕ*≤0.35): Alta probabilidad de éxito limpio.  
     * Entrada desde atrás (cos*ϕ*\>0.55): Prohibida automáticamente si el defensor tiene tarjeta amarilla o baja percepción (*Principio de Restricción*); si un defensor agresivo la intenta y falla, la probabilidad de falta e infracción disciplinaria se dispara.

### **2.4. Autoprotección Disciplinaria y Árbitro Calibrado (src/engine/officiating/discipline.js y referee.js)**

Adaptado directamente de engine/src/match/engine/player/strategies/common/team/discipline.rs y officiating/referee.rs, este módulo controla la agresividad previa al duelo y la sanción posterior.

#### **Implementación Completa: src/engine/ballContest.js \+ src/engine/officiating/referee.js**

`// src/engine/officiating/referee.js (Disciplina de Jugador y Árbitro Calibrado)`

`/**`  
 `* Calcula el multiplicador de Restricción (Restraint) de un defensor antes de meter la pierna.`  
 `* Adaptado de engine/src/match/engine/player/strategies/common/team/discipline.rs`  
 `*/`  
`export function getDefenderRestraintMultiplier(defender, isInsideOwnPenaltyBox, approachFromBehind) {`  
  `let multiplier = 1.0;`

  `// 1. Autoprotección si ya tiene Tarjeta Amarilla (-55% de entradas arriesgadas)`  
  `if ((defender.yellowCards || 0) >= 1) {`  
    `multiplier *= 0.45;`  
  `}`

  `// 2. Prudencia extrema dentro del área penal propia (-50% de barridas para evitar penales)`  
  `if (isInsideOwnPenaltyBox) {`  
    `multiplier *= 0.50;`  
  `}`

  `// 3. Penalización severa si llega desde atrás del atacante (riesgo de zancadilla)`  
  `if (approachFromBehind) {`  
    `const perception = (defender.perception || 70) / 100;`  
    `multiplier *= (0.25 + 0.25 * perception);`  
  `}`

  `return multiplier;`  
`}`

`/**`  
 `* Evalúa una falta cometida y decide: Ley de la Ventaja, Tiro Libre/Penal, Amarilla o Roja.`  
 `* Calibrado para promediar 16-22 faltas, 2-4 amarillas y ~0.12 rojas por partido.`  
 `*/`  
`export function adjudicateFoul(referee, defender, attacker, foulContext, rng = Math.random) {`  
  `const strictness = referee?.strictness ?? 0.52; // [0.35 permisivo .. 0.75 estricto]`  
  `defender.foulCount = (defender.foulCount || 0) + 1;`

  `// 1. Ley de la Ventaja: si la falta fue leve en mediocampo y la pelota sigue en poder ofensivo con espacio`  
  `if (`  
    `!foulContext.isInsidePenaltyBox &&`  
    `foulContext.severity < 0.45 &&`  
    `foulContext.attackerTeamKeepsBallWithSpace`  
  `) {`  
    `return { callFoul: false, advantagePlayed: true, card: null };`  
  `}`

  `let card = null;`  
  `const isBooked = (defender.yellowCards || 0) >= 1;`

  `// 2. Evaluación de ROJA DIRECTA (DOGSO: Último hombre en ocasión manifiesta de gol o entrada brutal >0.93)`  
  `if (`  
    `(foulContext.isLastManDOGSO && !foulContext.attemptedBallInBox) ||`  
    `foulContext.severity > (0.94 - strictness * 0.05)`  
  `) {`  
    `card = 'RED';`  
  `}`  
  `// 3. Evaluación de TARJETA AMARILLA`  
  `else {`  
    `let yellowProb = 0.06; // Falta común tiene muy baja probabilidad de tarjeta (solo 6%)`

    `// a) Falta Táctica / Cortar ataque prometedor (SPA / professional_foul.rs)`  
    `if (foulContext.isPromisingCounterAttack) {`  
      `yellowProb += 0.68;`  
    `}`  
    `// b) Entrada por detrás o temeraria`  
    `if (foulContext.approachFromBehind && foulContext.severity > 0.55) {`  
      `yellowProb += 0.35;`  
    `}`  
    `// c) Reiteración de faltas del mismo jugador (3 o más faltas acumuladas)`  
    `if (defender.foulCount >= 3) {`  
      `yellowProb += 0.28 * (defender.foulCount - 2);`  
    `}`

    `yellowProb *= (0.8 + 0.4 * strictness);`

    `// Si ya tiene amarilla, el árbitro exige un umbral un 25% más claro para expulsarlo por doble amarilla`  
    `if (isBooked) {`  
      `yellowProb *= 0.75;`  
    `}`

    `if (rng() < yellowProb) {`  
      `card = isBooked ? 'SECOND_YELLOW_RED' : 'YELLOW';`  
    `}`  
  `}`

  `return {`  
    `callFoul: true,`  
    `advantagePlayed: false,`  
    `isPenalty: Boolean(foulContext.isInsidePenaltyBox),`  
    `card,`  
  `};`  
`}`

`// src/engine/ballContest.js (Sistema de Duelos en 3 Capas: Intercepción, Cuerpo y Tackle)`

`import { getDefenderRestraintMultiplier, adjudicateFoul } from './officiating/referee.js';`

`/**`  
 `* CAPA 1: Intercepción de balón suelto / pase (0% faltas).`  
 `* Usa la fórmula del Compendio Táctico: R_intercept = f(agility, tackling, perception) * mu_chem`  
 `*/`  
`export function tryInterceptLooseBall(player, ball, scaleMetersToPx = 6.0) {`  
  `if (player.redCard || (player.interceptCooldown || 0) > 0) return false;`

  `// Verificar altura alcanzable según altura física y salto`  
  `const maxReachZ = player.role === 'GK' ? 16 : 7.5 + ((player.jumping || 70) / 100) * 5.5;`  
  `if ((ball.z || 0) > maxReachZ) return false;`

  `const agi = (player.agility || 70) / 100;`  
  `const tac = (player.tackling || 70) / 100;`  
  `const per = (player.perception || 70) / 100;`  
  `const chem = player.chemistryMultiplier || 1.0;`

  `const interceptRadiusPx = (1.15 * scaleMetersToPx) * (0.60 + 0.15 * agi + 0.15 * tac + 0.10 * per) * chem;`  
  `const dist = Math.hypot(ball.x - player.x, ball.y - player.y);`

  `if (dist <= interceptRadiusPx) {`  
    `// Si el balón viene demasiado rápido a quemarropa, chequeo de control/reflejos`  
    `const ballSpeed = Math.hypot(ball.vx || 0, ball.vy || 0);`  
    `const controlProb = Math.min(0.98, (0.75 + 0.25 * per) * chem - Math.max(0, (ballSpeed - 9) * 0.05));`

    `if (Math.random() < controlProb) {`  
      `ball.ownerId = player.id;`  
      `ball.vx = player.vx || 0;`  
      `ball.vy = player.vy || 0;`  
      `ball.z = 0;`  
      `ball.vz = 0;`  
      `return true;`  
    `} else {`  
      `// Desvío / bloqueo de pase (pass_block.rs)`  
      `ball.vx *= -0.35;`  
      `ball.vy += (Math.random() - 0.5) * 3.0;`  
      `player.interceptCooldown = 18;`  
      `return false;`  
    `}`  
  `}`  
  `return false;`  
`}`

`/**`  
 `* CAPAS 2 y 3: Disputa contra el portador del balón (Jockey/Delay -> Carga Corporal -> Tackle).`  
 `*/`  
`export function resolveBallCarrierEngagement(defender, attacker, ball, matchContext, rng = Math.random) {`  
  `if ((defender.tackleCooldown || 0) > 0) {`  
    `// Aunque esté en cooldown de entrada, sigue aplicando Retardación (Delay / Jockeying)`  
    `attacker.speedModifier = Math.min(attacker.speedModifier || 1.0, 0.78);`  
    `return { outcome: 'DELAY_JOCKEY' };`  
  `}`

  `const dx = attacker.x - defender.x;`  
  `const dy = attacker.y - defender.y;`  
  `const dist = Math.hypot(dx, dy) || 0.001;`

  `const attDirX = Math.cos(attacker.facingAngle || 0);`  
  `const attDirY = Math.sin(attacker.facingAngle || 0);`  
  `// Si dot > 0.5, el defensor viene corriendo desde atrás del atacante`  
  `const approachDot = (dx / dist) * attDirX + (dy / dist) * attDirY;`  
  `const approachFromBehind = approachDot > 0.50;`

  `const chemDef = defender.chemistryMultiplier || 1.0;`  
  `const chemAtt = attacker.chemistryMultiplier || 1.0;`

  `const defStr = ((defender.strength || 70) / 100) * chemDef;`  
  `const defAgi = ((defender.agility || 70) / 100) * chemDef;`  
  `const defTac = ((defender.tackling || 70) / 100) * chemDef;`  
  `const defPer = ((defender.perception || 70) / 100) * chemDef;`

  `const attStr = ((attacker.strength || 70) / 100) * chemAtt;`  
  `const attAgi = ((attacker.agility || 70) / 100) * chemAtt;`  
  `const attCon = ((attacker.control || 70) / 100) * chemAtt;`

  `// --- CAPA 2: DUELO DE CUERPO HOMBRO CON HOMBRO (body.rs) ---`  
  `if (!approachFromBehind && Math.abs(approachDot) <= 0.50) {`  
    `const bodyScoreDef = 0.60 * defStr + 0.40 * defAgi + (rng() - 0.5) * 0.18;`  
    `const bodyScoreAtt = 0.55 * attStr + 0.45 * attCon;`

    `if (bodyScoreDef > bodyScoreAtt + 0.07) {`  
      `// Robo limpio desplazando con el cuerpo (Sin falta)`  
      `ball.ownerId = defender.id;`  
      `defender.tackleCooldown = 30;`  
      `attacker.tackleCooldown = 35; // Evita re-robo instantáneo en el mismo frame`  
      `return { outcome: 'CLEAN_BODY_WIN' };`  
    `}`

    `// Rarísima vez una carga lateral deriva en falta (solo ~4% si el defensor es muy torpe/lento)`  
    `if (bodyScoreDef < bodyScoreAtt - 0.22 && rng() < 0.04 * (1.1 - defAgi)) {`  
      `defender.tackleCooldown = 50;`  
      `const decision = adjudicateFoul(matchContext.referee, defender, attacker, {`  
        `isInsidePenaltyBox: matchContext.isInsidePenaltyBox,`  
        `severity: 0.30,`  
        `approachFromBehind: false,`  
        `isPromisingCounterAttack: matchContext.isCounterAttack,`  
        `isLastManDOGSO: false,`  
        `attackerTeamKeepsBallWithSpace: false,`  
      `}, rng);`  
      `return { outcome: decision.callFoul ? 'FOUL' : 'ADVANTAGE', decision };`  
    `}`  
  `}`

  `// --- CAPA 3: EVALUACIÓN DE RESTRICCIÓN ANTES DE TIRAR UN TACKLE ---`  
  `const restraint = getDefenderRestraintMultiplier(`  
    `defender,`  
    `matchContext.isInsidePenaltyBox,`  
    `approachFromBehind`  
  `);`

  `// Probabilidad de que el defensor decida meter la pierna en este tick vs seguir en Delay/Jockey`  
  `const attemptTackleProb = 0.28 * (0.6 + 0.4 * defPer) * restraint;`  
  `if (rng() > attemptTackleProb) {`  
    `attacker.speedModifier = Math.min(attacker.speedModifier || 1.0, 0.72); // Frenado por Delay táctico`  
    `return { outcome: 'DELAY_JOCKEY' };`  
  `}`

  `// Ejecuta el Tackle: activar cooldown de 55 ticks para no spamear entradas`  
  `defender.tackleCooldown = 55;`

  `const tackleSkill = 0.65 * defTac + 0.35 * defPer - (approachFromBehind ? 0.20 : 0);`  
  `const evadeSkill = 0.55 * attCon + 0.45 * attAgi;`  
  `const margin = tackleSkill - evadeSkill + (rng() - 0.5) * 0.30;`

  `if (margin >= 0.0) {`  
    `// Entrada ganada limpiamente`  
    `ball.ownerId = defender.id;`  
    `attacker.tackleCooldown = 40;`  
    `return { outcome: 'CLEAN_TACKLE_WIN' };`  
  `}`

  `// El atacante eludió la entrada: ¿hubo contacto de falta o simplemente pasó de largo?`  
  `// En la mayoría de los regates exitosos el defensor queda pagando sin cometer falta`  
  `const foulContactProb = Math.min(`  
    `0.42,`  
    `Math.max(0.08, (0.22 - 0.12 * defTac + (approachFromBehind ? 0.18 : 0)) * restraint)`  
  `);`

  `if (rng() < foulContactProb) {`  
    `const severity = Math.min(1.0, Math.abs(margin) + (approachFromBehind ? 0.25 : 0));`  
    `const decision = adjudicateFoul(matchContext.referee, defender, attacker, {`  
      `isInsidePenaltyBox: matchContext.isInsidePenaltyBox,`  
      `severity,`  
      `approachFromBehind,`  
      `isPromisingCounterAttack: matchContext.isCounterAttack,`  
      `isLastManDOGSO: matchContext.isLastManDOGSO,`  
      `attemptedBallInBox: matchContext.isInsidePenaltyBox && !approachFromBehind,`  
      `attackerTeamKeepsBallWithSpace: false,`  
    `}, rng);`

    `return { outcome: decision.callFoul ? 'FOUL' : 'ADVANTAGE', decision };`  
  `}`

---

