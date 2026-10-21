import * as common from './common.js'

/**
 * Constantes geométricas del bloque de equipo (TeamShape) adaptadas al campo (680 x 1050).
 * Inspirado directamente en el modelo de bloques rígidos deslizantes de open-football-master.
 */
export const SHAPE_CONFIG = {
  // Longitud del bloque en Y (profundidad entre la última línea y los delanteros):
  // 275px (~27.5m) en bloque compacto; 410px (~41m) en bloque estirado de ataque.
  LENGTH_COMPACT: 275,
  LENGTH_STRETCHED: 410,

  // Anchura del bloque en X (amplitud lateral entre extremos/laterales opuestos):
  // 375px (~37.5m) en bloque estrecho; 560px (~56m) a máxima amplitud.
  WIDTH_NARROW: 375,
  WIDTH_WIDE: 560,

  // Standoff defensivo: distancia goal-side entre la pelota y la última línea defensiva.
  STANDOFF_PASSIVE: 200,   // ~20m en repliegue
  STANDOFF_AGGRESSIVE: 130, // ~13m en presión alta

  // Proporción de deslizamiento lateral hacia la banda del balón:
  SLIDE_DEFENDING: 0.55,  // La defensa se vuelca hacia la banda de la pelota
  SLIDE_ATTACKING: 0.30,  // El ataque preserva más amplitud para cambiar de frente

  // Límites de progreso en el campo (0 = propio arco, 1 = arco rival):
  REAR_FLOOR_PROGRESS: 0.055, // La última línea nunca se mete adentro del área chica
  REAR_ATTACK_CEILING: 0.62,  // La defensa en ataque no cruza más allá del 62% del campo
  FRONT_CEILING: 0.93,        // La línea delantera no traspasa la línea de gol

  // Margen de seguridad con las líneas de cal:
  PITCH_MARGIN: 24,

  // Velocidad máxima de desplazamiento del bloque por tick (px/tick):
  // 9.0 px/tick equivale a la velocidad de sprint de la última línea.
  // Evita el "teletransporte" instantáneo del bloque ante pelotazos largos.
  BLOCK_SPEED: 9.0,

  // Salto mayor a 250px se considera reinicio (saque de medio, entretiempo, etc.) y hace snap inmediato:
  BLOCK_SNAP: 250
}

/**
 * Aproximación suave de un valor previo hacia el objetivo limitado por maxStep,
 * o salto directo (snap) si la diferencia supera el umbral de reinicio.
 */
function approach(previous, target, maxStep, snap) {
  if (previous == null || isNaN(previous)) return target
  const delta = target - previous
  if (Math.abs(delta) > snap || Math.abs(delta) <= maxStep) {
    return target
  }
  return previous + Math.sign(delta) * maxStep
}

/**
 * Construye o actualiza el bloque colectivo dinámico (TeamShape) para un equipo.
 * Transforma las coordenadas estáticas de formación en un patrón normalizado (0..1)
 * proyectado en un rectángulo rígido que se desplaza junto con la jugada.
 */
export function buildTeamShape(matchDetails, team, inPossession) {
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  const outfielders = team.players.filter(p => common.isOnPitch(p) && p.position !== 'GK')
  if (outfielders.length === 0) return team.teamShape

  const isTopTeam = team.players[0].originPOS[1] < pitchHeight / 2
  const currentIter = matchDetails.iterationCount || 0

  // 1. Obtener la caja contenedora (bounding box) de la formación base (Pattern Normalization)
  let minDepth = 9999
  let maxDepth = -9999
  let minLat = 9999
  let maxLat = -9999

  for (const p of outfielders) {
    const depthProgress = isTopTeam
      ? p.originPOS[1] / pitchHeight
      : (pitchHeight - p.originPOS[1]) / pitchHeight
    minDepth = Math.min(minDepth, depthProgress)
    maxDepth = Math.max(maxDepth, depthProgress)
    minLat = Math.min(minLat, p.originPOS[0])
    maxLat = Math.max(maxLat, p.originPOS[0])
  }

  const depthSpan = Math.max(0.01, maxDepth - minDepth)
  const latSpan = Math.max(1.0, maxLat - minLat)

  // 2. Determinar la posición y dimensiones objetivo del bloque según el balón y la fase
  const ball = matchDetails.ball.position
  const ballProgress = isTopTeam
    ? ball[1] / pitchHeight
    : (pitchHeight - ball[1]) / pitchHeight

  const mentality = team.mentality || 'balanced'
  const isOffensive = mentality === 'offensive'
  const isDefensive = mentality === 'defensive'
  const ambition = team.coachState != null ? team.coachState.ambition : (isOffensive ? 0.75 : (isDefensive ? 0.25 : 0.50))

  const standoff = SHAPE_CONFIG.STANDOFF_PASSIVE - (SHAPE_CONFIG.STANDOFF_PASSIVE - SHAPE_CONFIG.STANDOFF_AGGRESSIVE) * ambition
  const compactFactor = 1.0 - (ambition * 0.8)
  const length = SHAPE_CONFIG.LENGTH_STRETCHED - (SHAPE_CONFIG.LENGTH_STRETCHED - SHAPE_CONFIG.LENGTH_COMPACT) * compactFactor
  const lengthProgress = length / pitchHeight

  let rearTarget = 0
  if (inPossession) {
    // En ataque el frente del bloque empuja hacia el área rival; el fondo se cuelga detrás
    const frontLeadProgress = 130 / pitchHeight
    const front = Math.min(SHAPE_CONFIG.FRONT_CEILING, ballProgress + frontLeadProgress)
    rearTarget = Math.min(
      SHAPE_CONFIG.REAR_ATTACK_CEILING,
      Math.max(SHAPE_CONFIG.REAR_FLOOR_PROGRESS, front - lengthProgress)
    )
  } else {
    // En defensa la última línea se sitúa goal-side de la pelota respetando el standoff
    const phaseCap = 0.35 + (ambition * 0.25)
    rearTarget = Math.max(
      SHAPE_CONFIG.REAR_FLOOR_PROGRESS,
      Math.min(phaseCap, ballProgress - (standoff / pitchHeight))
    )
  }

  // Inicializar estado previo si no existe
  if (!team.teamShape) {
    team.teamShape = {
      rearProgress: rearTarget,
      centreX: pitchWidth / 2,
      width: SHAPE_CONFIG.WIDTH_NARROW,
      length,
      anchors: {},
      lastUpdateIter: currentIter
    }
  }

  const prev = team.teamShape
  if (prev.lastUpdateIter === currentIter && currentIter > 0) {
    return prev
  }
  prev.lastUpdateIter = currentIter

  const maxStepY = SHAPE_CONFIG.BLOCK_SPEED / pitchHeight
  const maxStepX = SHAPE_CONFIG.BLOCK_SPEED

  // Desplazamiento longitudinal con limitador de velocidad BLOCK_SPEED
  const rearProgress = approach(
    prev.rearProgress,
    rearTarget,
    maxStepY,
    SHAPE_CONFIG.BLOCK_SNAP / pitchHeight
  )
  prev.rearProgress = rearProgress

  // Desplazamiento lateral hacia la banda del balón
  const slide = inPossession ? SHAPE_CONFIG.SLIDE_ATTACKING : SHAPE_CONFIG.SLIDE_DEFENDING
  const pitchCentreX = pitchWidth / 2
  const rawCentreTargetX = pitchCentreX + (ball[0] - pitchCentreX) * slide
  const centreTargetX = Math.max(
    SHAPE_CONFIG.PITCH_MARGIN + 60,
    Math.min(pitchWidth - SHAPE_CONFIG.PITCH_MARGIN - 60, rawCentreTargetX)
  )

  const centreX = approach(
    prev.centreX,
    centreTargetX,
    maxStepX,
    SHAPE_CONFIG.BLOCK_SNAP
  )
  prev.centreX = centreX

  // Ajuste lateral: estrechar en banda para no salirse de la cancha sin perder compacidad
  const teamWidthTarget = inPossession ? 0.85 : (isDefensive ? 0.35 : 0.6)
  const fullWidth = SHAPE_CONFIG.WIDTH_NARROW + (SHAPE_CONFIG.WIDTH_WIDE - SHAPE_CONFIG.WIDTH_NARROW) * teamWidthTarget
  const loX = Math.max(SHAPE_CONFIG.PITCH_MARGIN, centreX - fullWidth * 0.5)
  const hiX = Math.min(pitchWidth - SHAPE_CONFIG.PITCH_MARGIN, centreX + fullWidth * 0.5)
  const effectiveCentreX = (loX + hiX) * 0.5
  const effectiveWidth = Math.max(SHAPE_CONFIG.WIDTH_NARROW * 0.55, hiX - loX)
  prev.width = effectiveWidth

  // 3. Proyectar anclas de cada jugador dentro del bloque rectangular
  const anchors = {}
  for (const p of team.players) {
    if (!common.isOnPitch(p)) continue
    if (p.position === 'GK') {
      // El arquero se posiciona en abanico defensivo goal-side de la última línea
      const distBallToOwnGoalY = isTopTeam ? ball[1] : (pitchHeight - ball[1])
      const gkDist = Math.max(24, Math.min(78, distBallToOwnGoalY * 0.16))
      const gkY = isTopTeam ? gkDist : (pitchHeight - gkDist)
      const gkX = Math.max(
        pitchWidth / 2 - 42,
        Math.min(pitchWidth / 2 + 42, ball[0] * 0.22 + (pitchWidth / 2) * 0.78)
      )
      anchors[p.playerID] = [gkX, gkY]
      continue
    }

    const pDepthProgress = isTopTeam
      ? p.originPOS[1] / pitchHeight
      : (pitchHeight - p.originPOS[1]) / pitchHeight
    const depthFrac = (pDepthProgress - minDepth) / depthSpan
    const latFrac = (p.originPOS[0] - minLat) / latSpan

    const progress = rearProgress + depthFrac * (length / pitchHeight)
    const rawY = isTopTeam ? progress * pitchHeight : pitchHeight - (progress * pitchHeight)
    const anchorY = Math.max(
      SHAPE_CONFIG.PITCH_MARGIN,
      Math.min(pitchHeight - SHAPE_CONFIG.PITCH_MARGIN, rawY)
    )
    const rawX = effectiveCentreX + (latFrac - 0.5) * effectiveWidth
    const anchorX = Math.max(
      SHAPE_CONFIG.PITCH_MARGIN,
      Math.min(pitchWidth - SHAPE_CONFIG.PITCH_MARGIN, rawX)
    )

    anchors[p.playerID] = [anchorX, anchorY]
  }

  prev.anchors = anchors
  return prev
}

/**
 * Puntos de espera (Wait Target) vs llegada/definición (Finish Target) para los 4 BoxSlots del área.
 * Garantiza que los delanteros no se queden parados en la línea de gol ni dentro del área chica,
 * y que ataquen en 4 direcciones convergentes distintas (open-football model).
 */
export function getBoxSlotGeometry(matchDetails, isTopTeam, onsideLimitY) {
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  const ball = matchDetails.ball.position
  const ballOnLeft = ball[0] < pitchWidth / 2
  const dir = isTopTeam ? 1 : -1

  const clampY = (y) => {
    if (isTopTeam) return Math.max(35, Math.min(onsideLimitY, y))
    return Math.min(pitchHeight - 35, Math.max(onsideLimitY, y))
  }

  // Depths from goal line:
  // NearPost: espera a 110px, remata a 65px cruzando al primer palo
  // PenaltySpot: espera a 170px (puerta del área), remata al punto penal a 105px
  // FarPost: espera a 115px bien abierto, remata a 80px cerrándose al segundo palo
  // CutbackEdge: espera a 215px (fuera de la medialuna), remata a 155px
  const goalY = isTopTeam ? pitchHeight : 0

  return {
    nearPost: {
      wait: [
        ballOnLeft ? 260 : (pitchWidth - 260),
        clampY(isTopTeam ? goalY - 110 : 110)
      ],
      finish: [
        ballOnLeft ? 285 : (pitchWidth - 285),
        clampY(isTopTeam ? goalY - 65 : 65)
      ]
    },
    penaltySpot: {
      wait: [
        pitchWidth / 2,
        clampY(isTopTeam ? goalY - 170 : 170)
      ],
      finish: [
        pitchWidth / 2,
        clampY(isTopTeam ? goalY - 105 : 105)
      ]
    },
    farPost: {
      wait: [
        ballOnLeft ? (pitchWidth - 215) : 215,
        clampY(isTopTeam ? goalY - 115 : 115)
      ],
      finish: [
        ballOnLeft ? (pitchWidth - 255) : 255,
        clampY(isTopTeam ? goalY - 80 : 80)
      ]
    },
    cutbackEdge: {
      wait: [
        ballOnLeft ? 370 : 310,
        clampY(isTopTeam ? goalY - 215 : 215)
      ],
      finish: [
        ballOnLeft ? 360 : 320,
        clampY(isTopTeam ? goalY - 155 : 155)
      ]
    }
  }
}

/**
 * Asigna los 4 BoxSlots de ataque y apoyos con Incumbency Bonus para evitar fluctuaciones
 * de roles entre jugadores durante la misma posesión.
 */
export function assignAttackPlanWithIncumbency(kickingTeam, defendingTeam, matchDetails, isTopTeam, onsideLimitY) {
  const carrier = kickingTeam.players.find(p => p.hasBall)
  const carrierID = carrier ? carrier.playerID : null
  const prevSlots = kickingTeam.attackPlan?.boxSlots || {}

  const available = kickingTeam.players.filter(
    p => common.isOnPitch(p) && p.position !== 'GK' && p.playerID !== carrierID
  )

  const slots = ['penaltySpot', 'cutbackEdge', 'nearPost', 'farPost']
  const assigned = {}
  const takenIDs = new Set()

  const geom = getBoxSlotGeometry(matchDetails, isTopTeam, onsideLimitY)

  for (const slotKey of slots) {
    const target = geom[slotKey].finish
    const incumbentID = prevSlots[slotKey]

    let bestPlayer = null
    let bestScore = -9999

    for (const p of available) {
      if (takenIDs.has(p.playerID)) continue
      const role = p.tacticalRole || p.position
      const distToTarget = common.distance(p.currentPOS, target)

      let score = 200 - distToTarget
      if (slotKey === 'penaltySpot') {
        if (role === 'ST') score += 60
        if (role === 'CAM') score += 20
      } else if (slotKey === 'cutbackEdge') {
        if (role === 'CAM') score += 60
        if (role === 'CM' || role === 'ST') score += 30
      } else if (slotKey === 'nearPost') {
        if (role === 'LM' || role === 'RM') score += 40
        if (role === 'ST') score += 35
      } else if (slotKey === 'farPost') {
        if (role === 'LM' || role === 'RM') score += 50
        if (role === 'ST') score += 25
      }

      // INCUMBENCY BONUS: mantener la asignación previa vale 45 puntos
      // para evitar que dos jugadores intercambien carreras a mitad de ataque
      if (incumbentID && incumbentID === p.playerID) {
        score += 45
      }

      if (score > bestScore) {
        bestScore = score
        bestPlayer = p
      }
    }

    if (bestPlayer) {
      assigned[slotKey] = bestPlayer.playerID
      takenIDs.add(bestPlayer.playerID)
    }
  }

  kickingTeam.attackPlan = {
    boxSlots: assigned,
    nearPostID: assigned.nearPost,
    penaltySpotID: assigned.penaltySpot,
    farPostID: assigned.farPost,
    cutbackEdgeID: assigned.cutbackEdge,
    lastUpdateIter: matchDetails.iterationCount || 0
  }

  return kickingTeam.attackPlan
}

/**
 * Asigna los roles defensivos (Press, Cover, Mark, HoldZone) con Incumbency Bonus:
 * - Presser único con bono de continuidad
 * - Cover escalonado con bono de continuidad
 * - Marcas individuales hombre a hombre (Mark) exclusivas y persistentes
 */
export function assignDefensivePlanWithIncumbency(defendingTeam, attackingTeam, matchDetails, isTopTeam) {
  const ball = matchDetails.ball.position
  const prevPlan = defendingTeam.defensivePlan || {}
  const prevDuties = prevPlan.duties || {}

  const outfielders = defendingTeam.players.filter(
    p => common.isOnPitch(p) && p.position !== 'GK'
  )
  if (outfielders.length === 0) return prevPlan

  const takenDefenderIDs = new Set()
  const duties = {}

  // 1. Asignar PRESSER exclusivo (jugador más cercano al balón con bono de incumbencia)
  let bestPresser = null
  let minPresserDist = 9999
  for (const p of outfielders) {
    const d = common.distance(p.currentPOS, ball)
    const effectiveD = d - ((prevPlan.presserID === p.playerID) ? 22 : 0)
    if (effectiveD < minPresserDist) {
      minPresserDist = effectiveD
      bestPresser = p
    }
  }

  if (bestPresser) {
    duties[bestPresser.playerID] = { duty: 'Press' }
    takenDefenderIDs.add(bestPresser.playerID)
  }

  // 2. Asignar COVER exclusivo (segundo hombre goal-side de cobertura con bono de incumbencia)
  let bestCover = null
  let minCoverDist = 9999
  if (bestPresser) {
    for (const p of outfielders) {
      if (takenDefenderIDs.has(p.playerID)) continue
      const d = common.distance(p.currentPOS, bestPresser.currentPOS)
      const effectiveD = d - ((prevPlan.coverID === p.playerID) ? 25 : 0)
      if (effectiveD < minCoverDist) {
        minCoverDist = effectiveD
        bestCover = p
      }
    }
  }

  if (bestCover) {
    duties[bestCover.playerID] = { duty: 'Cover' }
    takenDefenderIDs.add(bestCover.playerID)
  }

  // 3. Marcas personales hombre a hombre (MARK) sobre atacantes peligrosos en área
  const oppSlots = attackingTeam?.attackPlan?.boxSlots || {}
  const targetThreatIDs = [oppSlots.penaltySpot, oppSlots.nearPost, oppSlots.farPost, oppSlots.cutbackEdge].filter(Boolean)

  const markerMap = {}
  for (const threatID of targetThreatIDs) {
    const oppPlayer = attackingTeam.players.find(p => p.playerID === threatID && common.isOnPitch(p))
    if (!oppPlayer) continue

    const prevMarkerID = prevPlan.markerMap?.[threatID]
    let bestMarker = null
    let minMarkerDist = 9999

    for (const p of outfielders) {
      if (takenDefenderIDs.has(p.playerID)) continue
      const role = p.tacticalRole || p.position
      const roleBonus = (role === 'CB' || role === 'DFC' || role === 'LÍBERO' || role === 'STOP I' || role === 'STOP D') ? -30 : 0
      const d = common.distance(p.currentPOS, oppPlayer.currentPOS) + roleBonus
      // Incumbency: si este defensor ya marcaba a este atacante, bono de -35px
      const effectiveD = d - ((prevMarkerID === p.playerID) ? 35 : 0)
      if (effectiveD < minMarkerDist) {
        minMarkerDist = effectiveD
        bestMarker = p
      }
    }

    if (bestMarker && minMarkerDist < 260) {
      duties[bestMarker.playerID] = { duty: 'Mark', targetID: threatID }
      markerMap[threatID] = bestMarker.playerID
      takenDefenderIDs.add(bestMarker.playerID)
    }
  }

  // 4. El resto de defensores y volantes reciben HOLDZONE
  for (const p of outfielders) {
    if (!takenDefenderIDs.has(p.playerID)) {
      duties[p.playerID] = { duty: 'HoldZone' }
    }
  }

  defendingTeam.defensivePlan = {
    duties,
    presserID: bestPresser?.playerID,
    coverID: bestCover?.playerID,
    markerMap,
    lastUpdateIter: matchDetails.iterationCount || 0
  }

  return defendingTeam.defensivePlan
}
