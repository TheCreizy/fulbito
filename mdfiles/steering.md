# `steering.js` - Comportamientos de Conducción y Dirección (Steering)

> **Categoría:** `Inteligencia Artificial y Cinemática`  
> **Ubicación:** `src/engine/steering.js`  
> **Líneas de código:** 248  
> **Tamaño:** 9.27 KB

---

## 📋 Resumen del Módulo

Implementa algoritmos de dirección autónoma basados en vehículos de Reynolds (seek, arrive, separate, pursuit) para movimiento fluido y realista de los futbolistas.

---

## 🧩 Exportaciones y Elementos Principales

- **Línea 7:** `export const STEERING_CONFIG =`
- **Línea 24:** `export function calculateEarliestMeeting(playerPos, maxSpeed, ballPos, ballVel, grassFriction = STEERING_CONFIG.GRASS_FRICTION)`
- **Línea 74:** `export function calculateInterceptMovement(player, matchDetails, maxSpeed)`
- **Línea 199:** `export function steerTowardsTarget(player, targetPOS, step, team, pitchSize)`



---

## 💻 Código Fuente JavaScript (`steering.js`)

````javascript
import * as common from './common.js'

/**
 * Constantes para Intercepción por Rumbo Constante (Constant-Bearing Interception)
 * y desaceleración de balón perdido (Lost-Cause Friction Decay), extraídas de open-football-master.
 */
export const STEERING_CONFIG = {
  // Distancia a partir de la cual el jugador ajusta su velocidad a la del balón para recibir asentado:
  SETTLE_DISTANCE: 18.0,
  // Umbral de velocidad de cierre bajo el cual la persecución en línea de mira se considera "causa perdida"
  // y debe cortar hacia el punto de frenado del balón por rozamiento:
  LOST_CAUSE_FACTOR: 0.25,
  // Fricción del césped por tick (coincidente con ballMovement.js):
  GRASS_FRICTION: 0.90,
  // Radio mínimo de contacto (está encima de la pelota):
  CONTACT_RADIUS: 2.5
}

/**
 * Calcula el punto más temprano (earliest meeting point) en el que un jugador a velocidad máxima
 * puede interceptar una pelota que rueda perdiendo velocidad por rozamiento del césped.
 * Resuelve numéricamente la curva de desaceleración v(t) = v0 * friction^t.
 */
export function calculateEarliestMeeting(playerPos, maxSpeed, ballPos, ballVel, grassFriction = STEERING_CONFIG.GRASS_FRICTION) {
  const vx = ballVel[0] || 0
  const vy = ballVel[1] || 0
  const ballSpeed = Math.sqrt(vx * vx + vy * vy)
  if (ballSpeed < 0.3) {
    return [ballPos[0], ballPos[1]]
  }

  const dirX = vx / ballSpeed
  const dirY = vy / ballSpeed
  const k = grassFriction
  const oneMinusK = 1 - k

  // Distancia total hasta detenerse por completo
  const stoppingDist = ballSpeed / oneMinusK

  // Probar en 16 pasos temporales futuros dónde se cruzan las trayectorias
  const maxSteps = 16
  for (let t = 1; t <= maxSteps; t++) {
    const decay = Math.pow(k, t)
    const decayDist = Math.min(stoppingDist, (ballSpeed * (1 - decay)) / oneMinusK)
    const bx = ballPos[0] + dirX * decayDist
    const by = ballPos[1] + dirY * decayDist

    const runCapacity = maxSpeed * t
    const dx = bx - playerPos[0]
    const dy = by - playerPos[1]
    const distToPredicted = Math.sqrt(dx * dx + dy * dy)

    if (distToPredicted <= runCapacity) {
      return [bx, by]
    }
  }

  // Si no la alcanza antes del paso 16, dirigirse al punto de reposo final
  return [
    ballPos[0] + dirX * stoppingDist,
    ballPos[1] + dirY * stoppingDist
  ]
}

/**
 * Intercepción por Rumbo Constante (Constant-Bearing Interception):
 * En lugar de correr en persecución hacia donde está el balón ahora (Seek/Tail-Chase),
 * descompone la velocidad del objetivo en paralela y perpendicular a la línea de mira.
 * Iguala la velocidad transversal y gasta el resto de la capacidad de sprint en cerrar la brecha.
 *
 * Si la velocidad de cierre cae por debajo del umbral de "causa perdida", hace transición suave
 * hacia el punto de corte donde la pelota se frenará por rozamiento (Lost-Cause rescue).
 */
export function calculateInterceptMovement(player, matchDetails, maxSpeed) {
  const ball = matchDetails.ball
  const ballPos = ball.position || [340, 525, 0]
  const playerPos = player.currentPOS

  // 1. Obtener la velocidad real del balón
  let ballVelX = 0
  let ballVelY = 0

  if (Array.isArray(ball.ballOverIterations) && ball.ballOverIterations.length > 0) {
    const nextP = ball.ballOverIterations[0]
    ballVelX = nextP[0] - ballPos[0]
    ballVelY = nextP[1] - ballPos[1]
  } else if (Array.isArray(ball.velocity)) {
    ballVelX = ball.velocity[0] || 0
    ballVelY = ball.velocity[1] || 0
  }

  const toTargetX = ballPos[0] - playerPos[0]
  const toTargetY = ballPos[1] - playerPos[1]
  const distance = Math.sqrt(toTargetX * toTargetX + toTargetY * toTargetY)

  // Si ya está encima del balón, acompañar el movimiento
  if (distance < STEERING_CONFIG.CONTACT_RADIUS) {
    return [
      Math.max(-maxSpeed, Math.min(maxSpeed, Math.round(ballVelX))),
      Math.max(-maxSpeed, Math.min(maxSpeed, Math.round(ballVelY)))
    ]
  }

  // Vector unitario de la línea de mira (Line of Sight)
  const losX = toTargetX / distance
  const losY = toTargetY / distance

  // Proyección de la velocidad del balón sobre la línea de mira (velocidad radial)
  const along = ballVelX * losX + ballVelY * losY

  // Componente transversal de la velocidad del balón (velocidad angular / cross-track)
  const acrossX = ballVelX - losX * along
  const acrossY = ballVelY - losY * along
  const acrossSq = acrossX * acrossX + acrossY * acrossY
  const speedSq = maxSpeed * maxSpeed

  // Rumbo de rumbo constante (Bearing Hold)
  let holdX = 0
  let holdY = 0

  if (acrossSq >= speedSq) {
    // El balón cruza más rápido que la velocidad máxima del jugador: entrega todo el esfuerzo lateral
    const scale = maxSpeed / Math.sqrt(acrossSq)
    holdX = acrossX * scale
    holdY = acrossY * scale
  } else {
    // Iguala la velocidad transversal y aprovecha el remanente para cerrar distancia frontal
    const closingDist = Math.sqrt(speedSq - acrossSq)
    holdX = acrossX + losX * closingDist
    holdY = acrossY + losY * closingDist
  }

  // Tasa de cierre neta por tick
  const closingRate = Math.sqrt(Math.max(0, speedSq - acrossSq)) - along
  const lostThreshold = STEERING_CONFIG.LOST_CAUSE_FACTOR * maxSpeed

  // Evaluación de Causa Perdida (Lost-Cause): si el balón se aleja más rápido de lo que podemos cerrar,
  // calcular el punto de encuentro óptimo por rozamiento en vez de correr en paralelo
  let desiredX = holdX
  let desiredY = holdY

  if (closingRate < lostThreshold) {
    const ballHeight = ballPos[2] || 0
    // Si la pelota vuela alto (z > 20px), no aplicar fricción de césped
    const grounded = ballHeight < 20 ? 1.0 : Math.max(0, 1.0 - (ballHeight - 20) / 40)

    const rawLost = Math.max(0, Math.min(1.0, 1.0 - (closingRate / lostThreshold)))
    const lostBlend = rawLost * rawLost * (3.0 - 2.0 * rawLost) * grounded

    if (lostBlend > 0) {
      const meetingPoint = calculateEarliestMeeting(
        playerPos,
        maxSpeed,
        ballPos,
        [ballVelX, ballVelY],
        STEERING_CONFIG.GRASS_FRICTION
      )
      const cutDx = meetingPoint[0] - playerPos[0]
      const cutDy = meetingPoint[1] - playerPos[1]
      const cutDist = Math.sqrt(cutDx * cutDx + cutDy * cutDy)

      if (cutDist > 0) {
        const cutVx = (cutDx / cutDist) * maxSpeed
        const cutVy = (cutDy / cutDist) * maxSpeed
        desiredX = holdX + (cutVx - holdX) * lostBlend
        desiredY = holdY + (cutVy - holdY) * lostBlend
      }
    }
  }

  // Desaceleración al aproximarse (Settle): viajar con el balón en vez de chocar
  const ballSpeed = Math.sqrt(ballVelX * ballVelX + ballVelY * ballVelY)
  const catchable = ballSpeed <= maxSpeed ? 1.0 : (maxSpeed / Math.max(0.1, ballSpeed))
  if (distance < STEERING_CONFIG.SETTLE_DISTANCE) {
    const settleRatio = (distance / STEERING_CONFIG.SETTLE_DISTANCE)
    const settleBlend = 1.0 - (1.0 - settleRatio) * catchable
    desiredX = ballVelX + (desiredX - ballVelX) * settleBlend
    desiredY = ballVelY + (desiredY - ballVelY) * settleBlend
  }

  const finalDx = Math.max(-maxSpeed, Math.min(maxSpeed, Math.round(desiredX)))
  const finalDy = Math.max(-maxSpeed, Math.min(maxSpeed, Math.round(desiredY)))

  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  const nextX = playerPos[0] + finalDx
  const nextY = playerPos[1] + finalDy

  return [
    (nextX >= 8 && nextX <= pitchWidth - 8) ? finalDx : 0,
    (nextY >= 8 && nextY <= pitchHeight - 8) ? finalDy : 0
  ]
}

/**
 * Desplazamiento vectorial suave hacia un objetivo estático o posicional con:
 * - Desaceleración suave cuadrática (Arrive Steering) en distancias cortas (< 18px).
 * - Fuerza de repulsión entre compañeros (Separation) para evitar aglomeraciones.
 */
export function steerTowardsTarget(player, targetPOS, step, team, pitchSize) {
  const dx = targetPOS[0] - player.currentPOS[0]
  const dy = targetPOS[1] - player.currentPOS[1]
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist < 2) return [0, 0]

  // Desaceleración suave (Arrive Steering inspirado en open-football)
  let effectiveStep = step
  if (dist < 18) {
    const ratio = dist / 18
    effectiveStep = Math.max(0.6, step * ratio * ratio)
  }

  let vx = (dx / dist) * Math.min(effectiveStep, dist)
  let vy = (dy / dist) * Math.min(effectiveStep, dist)

  // Separación suave para mantener líneas de pase y evitar aglomeraciones (solo si no está asentado en destino)
  if (dist > 12 && team && Array.isArray(team.players)) {
    for (const mate of team.players) {
      if (!common.isOnPitch(mate) || mate.playerID === player.playerID) continue
      const mx = player.currentPOS[0] - mate.currentPOS[0]
      const my = player.currentPOS[1] - mate.currentPOS[1]
      const mDist = Math.hypot(mx, my)
      if (mDist > 0 && mDist < 28) {
        const push = ((28 - mDist) / 28) * 1.2
        vx += (mx / mDist) * push
        vy += (my / mDist) * push
      }
    }
  }

  let finalDx = Math.max(-step, Math.min(step, Math.round(vx)))
  let finalDy = Math.max(-step, Math.min(step, Math.round(vy)))

  // Evitar detención prematura por redondeo si aún no llegó al objetivo
  if (finalDx === 0 && finalDy === 0 && dist >= 2) {
    if (Math.abs(dx) >= Math.abs(dy)) {
      finalDx = dx > 0 ? 1 : -1
    } else {
      finalDy = dy > 0 ? 1 : -1
    }
  }
  const nextX = player.currentPOS[0] + finalDx
  const nextY = player.currentPOS[1] + finalDy
  return [
    (nextX >= 8 && nextX <= pitchSize[0] - 8) ? finalDx : 0,
    (nextY >= 8 && nextY <= pitchSize[1] - 8) ? finalDy : 0
  ]
}

````

