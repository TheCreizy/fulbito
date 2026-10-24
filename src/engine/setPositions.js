import * as common from './common.js'
import * as setVariables from './setVariables.js'
import * as setFreekicks from './setFreekicks.js'
import { resolveMutualPlayerSeparation } from './playerMovement.js'
import { getPlayStyleConfig } from '../data/formations.js'
import {
  buildTeamShape,
  getBoxSlotGeometry,
  assignAttackPlanWithIncumbency,
  assignDefensivePlanWithIncumbency
} from './teamShape.js'

export function selectCornerTaker(team) {
  const active = team.players.filter(p => common.isOnPitch(p) && p.position !== 'GK')
  if (active.length === 0) return team.players.find(common.isOnPitch) || team.players[0]

  const preferredID = team.setPieces?.cornerTakerID
  if (preferredID) {
    const designated = active.find(p => p.id === preferredID || p.playerID === preferredID)
    if (designated) return designated
  }

  const sorted = [...active].sort((a, b) => b.skill.passing - a.skill.passing)
  return sorted[0]
}

export function selectPenaltyTaker(team) {
  const active = team.players.filter(common.isOnPitch)
  if (active.length === 0) return team.players[0]

  const preferredID = team.setPieces?.penaltyTakerID
  if (preferredID) {
    const designated = active.find(p => p.id === preferredID || p.playerID === preferredID)
    if (designated) return designated
  }

  const sorted = [...active].sort((a, b) => (b.skill.penalty_taking || b.skill.shooting) - (a.skill.penalty_taking || a.skill.shooting))
  return sorted[0]
}

function selectThrowInTaker(team, throwPos) {
  const active = team.players.filter(p => common.isOnPitch(p) && p.position !== 'GK')
  if (active.length === 0) return team.players[0]

  let bestTaker = active[0]
  let bestScore = -9999

  for (const p of active) {
    const role = p.tacticalRole || p.position
    // 1. Distancia física al punto del saque (50% del peso, modelo open-football ThrowIn::pick_thrower)
    const dist = throwPos ? common.distance(p.currentPOS, throwPos) : 100
    const distScore = Math.max(0, 1 - (dist / 320))

    // 2. Afinidad posicional: laterales y carrileros tienen prioridad máxima (35% del peso)
    let positionFit = 0.4
    if (['LB', 'RB', 'LWB', 'RWB', 'LI', 'LD'].includes(role) || p.position === 'LB' || p.position === 'RB') {
      positionFit = 1.0
    } else if (['LM', 'RM', 'WI', 'WD', 'EI', 'ED'].includes(role)) {
      positionFit = 0.8
    } else if (['CM', 'CDM', 'CAM'].includes(role)) {
      positionFit = 0.55
    } else if (['CB', 'DFC', 'LÍBERO', 'STOP I', 'STOP D'].includes(role)) {
      positionFit = 0.35
    } else if (['ST', 'CF'].includes(role)) {
      positionFit = 0.2
    }

    // 3. Habilidad de decisiones, percepción y saque largo (15% del peso)
    const decisionScore = (Number(p.skill?.perception || 70) + Number(p.skill?.passing || 70)) / 200

    const score = (distScore * 0.50) + (positionFit * 0.35) + (decisionScore * 0.15)
    if (score > bestScore) {
      bestScore = score
      bestTaker = p
    }
  }

  return bestTaker
}

export function setGoalieHasBall(matchDetails, thisGoalie) {
  const { kickOffTeam, secondTeam } = matchDetails
  const team = (kickOffTeam.players[0].playerID === thisGoalie.playerID) ? kickOffTeam : secondTeam
  const opposition = (kickOffTeam.players[0].playerID === thisGoalie.playerID) ? secondTeam : kickOffTeam
  thisGoalie.hasBall = true
  matchDetails.ball.lastTouch.playerName = thisGoalie.name
  matchDetails.ball.lastTouch.playerID = thisGoalie.playerID
  matchDetails.ball.lastTouch.teamID = team.teamID
  matchDetails.ball.lastTouch.deflection = false
  matchDetails.ball.position = [thisGoalie.currentPOS[0], thisGoalie.currentPOS[1], 0]
  matchDetails.ball.Player = thisGoalie.playerID
  matchDetails.ball.withPlayer = true
  matchDetails.ball.withTeam = team.teamID
  team.intent = 'attack'
  opposition.intent = 'defend'
  matchDetails.ball.ballOverIterations = []
  return matchDetails
}

function setupCornerPositions(matchDetails, attack, defence, cornerCoords, supportAttackCoords, supportDefCoords, isTop) {
  const taker = selectCornerTaker(attack)
  taker.action = 'cross'
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  const centreX = pitchWidth / 2

  // Función auxiliar para proyectar una posición (x, depth desde la línea de gol defendida)
  const toDefGoalSide = (x, depth) => [
    Math.max(25, Math.min(pitchWidth - 25, x)),
    isTop ? depth : (pitchHeight - depth)
  ]

  // ── 1. ASIGNACIÓN DEL EQUIPO ATACANTE (Attack) ─────────────────────────
  // Identificar centrales cabeceadores (CB) para subirlos al área
  const cbs = attack.players.filter(p => (
    common.isOnPitch(p) &&
    p.playerID !== taker.playerID &&
    (p.position === 'CB' || p.tacticalRole === 'CB' || p.tacticalRole === 'DFC' || p.tacticalRole === 'LÍBERO' || p.tacticalRole === 'STOP I' || p.tacticalRole === 'STOP D')
  ))
  cbs.sort((a, b) => ((b.skill.jumping || 0) + (Number(b.height) || 180)) - ((a.skill.jumping || 0) + (Number(a.height) || 180)))
  const headingCBIds = new Set(cbs.slice(0, 2).map(c => c.playerID))

  // Identificar el pateador de rebotes en la medialuna (EdgeRunner: mejor remate de afuera)
  const edgeRunnerCandidates = attack.players.filter(p => (
    common.isOnPitch(p) &&
    p.playerID !== taker.playerID &&
    p.position !== 'GK' &&
    !headingCBIds.has(p.playerID)
  ))
  edgeRunnerCandidates.sort((a, b) => (Number(b.skill?.shooting || 65) - Number(a.skill?.shooting || 65)))
  const edgeRunner = edgeRunnerCandidates[0]
  const edgeRunnerID = edgeRunner ? edgeRunner.playerID : null

  // Identificar opción de pase corto (ShortOption)
  const shortOption = edgeRunnerCandidates.find(p => p.playerID !== edgeRunnerID)
  const shortOptionID = shortOption ? shortOption.playerID : null

  // Retén de contraataque (Cover): 2 laterales o volantes que se quedan en campo propio
  const coverDefenders = attack.players.filter(p => (
    common.isOnPitch(p) &&
    p.playerID !== taker.playerID &&
    p.position !== 'GK' &&
    !headingCBIds.has(p.playerID) &&
    p.playerID !== edgeRunnerID &&
    p.playerID !== shortOptionID &&
    ['LB', 'RB', 'CDM', 'CM'].includes(p.tacticalRole || p.position)
  )).slice(0, 2)
  const coverIDs = new Set(coverDefenders.map(c => c.playerID))

  // Posicionar atacantes
  const attackBoxPositions = [
    toDefGoalSide(cornerCoords[0] === 0 ? centreX - 55 : centreX + 55, 65), // Primer palo
    toDefGoalSide(centreX, 105),                                             // Punto penal
    toDefGoalSide(cornerCoords[0] === 0 ? centreX + 65 : centreX - 65, 75), // Segundo palo
    toDefGoalSide(centreX - 25, 85),
    toDefGoalSide(centreX + 25, 85)
  ]
  let attBoxIdx = 0

  for (const attP of attack.players) {
    if (!common.isOnPitch(attP) || attP.playerID === taker.playerID) continue
    if (attP.position === 'GK') {
      attP.currentPOS = attP.originPOS.slice()
      attP.intentPOS = attP.originPOS.slice()
    } else if (attP.playerID === shortOptionID) {
      attP.currentPOS = supportAttackCoords.slice()
      attP.intentPOS = supportAttackCoords.slice()
    } else if (attP.playerID === edgeRunnerID) {
      // Medialuna exterior para capturar rebotes y tiros lejanos
      attP.currentPOS = toDefGoalSide(centreX + (cornerCoords[0] === 0 ? 15 : -15), Math.round(pitchHeight * 0.18) + 16)
      attP.intentPOS = attP.currentPOS.slice()
    } else if (coverIDs.has(attP.playerID)) {
      // Retén de cobertura en mitad de cancha para contener la contra
      const coverX = attP.position === 'LB' ? (centreX - 70) : (centreX + 70)
      attP.currentPOS = toDefGoalSide(coverX, Math.round(pitchHeight * 0.46))
      attP.intentPOS = attP.currentPOS.slice()
    } else {
      // Delanteros y centrales cabeceadores cargando el área
      const boxPos = attackBoxPositions[attBoxIdx % attackBoxPositions.length]
      attP.currentPOS = boxPos.slice()
      attP.intentPOS = boxPos.slice()
      attBoxIdx++
    }
  }

  // ── 2. ASIGNACIÓN DEL EQUIPO DEFENSOR (Defence) ─────────────────────────
  // A. Arquero en la línea de gol
  if (common.isOnPitch(defence.players[0])) {
    defence.players[0].currentPOS = toDefGoalSide(centreX, 10)
    defence.players[0].intentPOS = defence.players[0].currentPOS.slice()
  }

  // B. Delantero de contragolpe (Outlet): queda suelto en mitad de cancha
  const defOutfield = defence.players.filter(p => common.isOnPitch(p) && p.position !== 'GK')
  const forwards = defOutfield.filter(p => ['ST', 'CF', 'RW', 'LW'].includes(p.tacticalRole || p.position) || p.position === 'ST')
  forwards.sort((a, b) => (Number(b.skill?.agility || 70) - Number(a.skill?.agility || 70)))
  const outlet = forwards[0] || defOutfield[defOutfield.length - 1]
  const outletID = outlet ? outlet.playerID : null

  // C. Cubrimiento del córner corto (ShortCover)
  const shortCover = defOutfield.find(p => p.playerID !== outletID)
  const shortCoverID = shortCover ? shortCover.playerID : null

  // D. Limpiador de borde del área (EdgeClearer)
  const edgeClearer = defOutfield.find(p => p.playerID !== outletID && p.playerID !== shortCoverID && ['CM', 'CDM', 'CAM'].includes(p.tacticalRole || p.position))
  const edgeClearerID = edgeClearer ? edgeClearer.playerID : null

  // E. Guardas de postes (PostGuards: 2 jugadores)
  const remainingDef = defOutfield.filter(p => p.playerID !== outletID && p.playerID !== shortCoverID && p.playerID !== edgeClearerID)
  const nearPostGuard = remainingDef[0]
  const farPostGuard = remainingDef[1]
  const guardIDs = new Set([nearPostGuard?.playerID, farPostGuard?.playerID].filter(Boolean))

  const isLeftCorner = cornerCoords[0] === 0
  const nearPostX = isLeftCorner ? (centreX - 42) : (centreX + 42)
  const farPostX = isLeftCorner ? (centreX + 42) : (centreX - 42)

  // Zonas de marcaje frente al área chica y punto penal
  const defBoxPositions = [
    toDefGoalSide(nearPostX + (isLeftCorner ? -15 : 15), 52), // Zona primer palo
    toDefGoalSide(centreX, 58),                                // Zona central 6 yardas
    toDefGoalSide(farPostX + (isLeftCorner ? 15 : -15), 55),   // Zona segundo palo
    toDefGoalSide(nearPostX, 98),                              // Banda de penal primer palo
    toDefGoalSide(farPostX, 102),                             // Banda de penal segundo palo
    toDefGoalSide(centreX, 115)                                // Punto penal
  ]
  let defBoxIdx = 0

  for (const defP of defOutfield) {
    if (defP.playerID === outletID) {
      // Delantero esperando para contraatacar en mitad de cancha
      defP.currentPOS = toDefGoalSide(centreX, Math.round(pitchHeight * 0.44))
      defP.intentPOS = defP.currentPOS.slice()
    } else if (defP.playerID === shortCoverID) {
      // Marcador del córner corto
      defP.currentPOS = supportDefCoords.slice()
      defP.intentPOS = supportDefCoords.slice()
    } else if (defP.playerID === edgeClearerID) {
      // Borde del área / medialuna para rechazar balones sueltos
      defP.currentPOS = toDefGoalSide(centreX + (isLeftCorner ? -18 : 18), Math.round(pitchHeight * 0.18) + 12)
      defP.intentPOS = defP.currentPOS.slice()
    } else if (defP.playerID === nearPostGuard?.playerID) {
      // Poste cercano
      defP.currentPOS = toDefGoalSide(nearPostX, 8)
      defP.intentPOS = defP.currentPOS.slice()
    } else if (defP.playerID === farPostGuard?.playerID) {
      // Poste lejano
      defP.currentPOS = toDefGoalSide(farPostX, 8)
      defP.intentPOS = defP.currentPOS.slice()
    } else {
      // Defensores marcando en el corazón del área
      const boxPos = defBoxPositions[defBoxIdx % defBoxPositions.length]
      defP.currentPOS = boxPos.slice()
      defP.intentPOS = boxPos.slice()
      defBoxIdx++
    }
  }

  taker.currentPOS = cornerCoords.slice()
  taker.intentPOS = cornerCoords.slice()
  taker.hasBall = true

  // Jugadas preparadas de córner (Open Football CornerRoutine):
  // 1. Córner Corto (short_corner): toque al apoyo cerca del banderín.
  // 2. Pase al Balcón del Área (edge_strike): pase raso a la medialuna para remate de primera.
  // 3. Centros combados: primer palo (cross_near_post), segundo palo (cross_far_post) o corazón del área (cross_penalty_spot).
  const rollCorner = common.getRandomNumber(1, 100)
  if (shortOptionID && rollCorner <= 20) {
    taker.action = 'pass'
    matchDetails.ball.cornerRoutine = 'short_corner'
    matchDetails.ball.targetPlayerID = shortOptionID
    matchDetails.iterationLog.push(`Short Corner Routine by ${attack.name} - Played short to ${shortOption.name}`)
  } else if (edgeRunnerID && (edgeRunner.skill?.shooting || 65) >= 76 && rollCorner <= 36) {
    taker.action = 'pass'
    matchDetails.ball.cornerRoutine = 'edge_strike'
    matchDetails.ball.targetPlayerID = edgeRunnerID
    matchDetails.iterationLog.push(`Edge of Box Corner Routine by ${attack.name} - Cut back to ${edgeRunner.name}!`)
  } else {
    taker.action = 'cross'
    const crossOptions = ['cross_near_post', 'cross_far_post', 'cross_penalty_spot']
    const chosenRoutine = crossOptions[common.getRandomNumber(0, 2)]
    matchDetails.ball.cornerRoutine = chosenRoutine
    matchDetails.iterationLog.push(`Corner Delivery (${chosenRoutine}) by ${attack.name} - Taker: ${taker.name}`)
  }

  matchDetails.ball.position = [cornerCoords[0], cornerCoords[1], 0]
  matchDetails.ball.isCornerKick = true
  matchDetails.ball.isOffsideExempt = true
  matchDetails.ball.isRestart = true
  setBallSpecificCornerValue(matchDetails, attack, taker)
  matchDetails.endIteration = true
  return matchDetails
}

export function setTopRightCornerPositions(matchDetails) {
  common.removeBallFromAllPlayers(matchDetails)
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  const kickOffTeamKeepYPos = matchDetails.kickOffTeam.players[0].originPOS[1]
  const halfPitchSize = pitchHeight / 2
  const attack = (kickOffTeamKeepYPos > halfPitchSize) ? matchDetails.kickOffTeam : matchDetails.secondTeam
  const defence = (kickOffTeamKeepYPos > halfPitchSize) ? matchDetails.secondTeam : matchDetails.kickOffTeam
  // El apoyo para pase corto se ubica a ~6m del córner ([pitchWidth - 25, 55])
  // El marcador rival se posiciona separado del córner y sobre la marca hacia adentro (~9.15m reglamentarios del banderín: [pitchWidth - 45, 80])
  return setupCornerPositions(matchDetails, attack, defence, [pitchWidth, 0], [pitchWidth - 25, 55], [pitchWidth - 45, 80], true)
}

export function setTopLeftCornerPositions(matchDetails) {
  common.removeBallFromAllPlayers(matchDetails)
  const [, pitchHeight] = matchDetails.pitchSize
  const kickOffTeamKeepYPos = matchDetails.kickOffTeam.players[0].originPOS[1]
  const halfPitchSize = pitchHeight / 2
  const attack = (kickOffTeamKeepYPos > halfPitchSize) ? matchDetails.kickOffTeam : matchDetails.secondTeam
  const defence = (kickOffTeamKeepYPos > halfPitchSize) ? matchDetails.secondTeam : matchDetails.kickOffTeam
  // El apoyo para pase corto se ubica a ~6m del córner ([25, 55])
  // El marcador rival se posiciona separado del córner y sobre la marca hacia adentro (~9.15m reglamentarios del banderín: [45, 80])
  return setupCornerPositions(matchDetails, attack, defence, [0, 0], [25, 55], [45, 80], true)
}

export function setBottomLeftCornerPositions(matchDetails) {
  common.removeBallFromAllPlayers(matchDetails)
  const [, pitchHeight] = matchDetails.pitchSize
  const kickOffTeamKeepYPos = matchDetails.kickOffTeam.players[0].originPOS[1]
  const halfPitchSize = pitchHeight / 2
  const attack = (kickOffTeamKeepYPos < halfPitchSize) ? matchDetails.kickOffTeam : matchDetails.secondTeam
  const defence = (kickOffTeamKeepYPos < halfPitchSize) ? matchDetails.secondTeam : matchDetails.kickOffTeam
  // El apoyo para pase corto se ubica a ~6m del córner ([25, pitchHeight - 55])
  // El marcador rival se posiciona separado del córner y sobre la marca hacia adentro (~9.15m reglamentarios del banderín: [45, pitchHeight - 80])
  return setupCornerPositions(matchDetails, attack, defence, [0, pitchHeight], [25, pitchHeight - 55], [45, pitchHeight - 80], false)
}

export function setBottomRightCornerPositions(matchDetails) {
  common.removeBallFromAllPlayers(matchDetails)
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  const kickOffTeamKeepYPos = matchDetails.kickOffTeam.players[0].originPOS[1]
  const halfPitchSize = pitchHeight / 2
  const attack = (kickOffTeamKeepYPos < halfPitchSize) ? matchDetails.kickOffTeam : matchDetails.secondTeam
  const defence = (kickOffTeamKeepYPos < halfPitchSize) ? matchDetails.secondTeam : matchDetails.kickOffTeam
  // El apoyo para pase corto se ubica a ~6m del córner ([pitchWidth - 25, pitchHeight - 55])
  // El marcador rival se posiciona separado del córner y sobre la marca hacia adentro (~9.15m reglamentarios del banderín: [pitchWidth - 45, pitchHeight - 80])
  return setupCornerPositions(matchDetails, attack, defence, [pitchWidth, pitchHeight], [pitchWidth - 25, pitchHeight - 55], [pitchWidth - 45, pitchHeight - 80], false)
}

function setBallSpecificCornerValue(matchDetails, attack, taker) {
  taker.hasBall = true
  matchDetails.ball.lastTouch.playerName = taker.name
  matchDetails.ball.lastTouch.playerID = taker.playerID
  matchDetails.ball.lastTouch.teamID = attack.teamID
  matchDetails.ball.lastTouch.deflection = false
  matchDetails.ball.ballOverIterations = []
  matchDetails.ball.withPlayer = true
  matchDetails.ball.Player = taker.playerID
  matchDetails.ball.withTeam = attack.teamID
  if (attack.teamID === matchDetails.kickOffTeam.teamID) {
    matchDetails.kickOffTeamStatistics.corners++
  } else {
    matchDetails.secondTeamStatistics.corners++
  }
  matchDetails.iterationLog.push(`Corner to - ${attack.name} (Taker: ${taker.name})`)
  if (Array.isArray(matchDetails.events)) {
    matchDetails.events.push({
      type: 'corner',
      teamID: attack.teamID,
      teamName: attack.name,
      playerName: taker.name,
      iteration: matchDetails.iterationCount || 0,
      half: matchDetails.half,
      deadBall: true
    })
  }
}

function executeThrowInSetup(matchDetails, attack, defence, isLeft, ballIntended) {
  common.removeBallFromAllPlayers(matchDetails)
  let [, place] = ballIntended
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  place = (place - 25 < 0) ? 25 : place
  place = (place + 25 > pitchHeight) ? (pitchHeight - 25) : place

  const throwX = isLeft ? 0 : pitchWidth
  const throwPos = [throwX, place]
  const taker = selectThrowInTaker(attack, throwPos)

  // 1. Asignar la pelota al ejecutor en la línea lateral
  matchDetails.ball.ballOverIterations = []
  matchDetails.ball.withPlayer = true
  matchDetails.ball.Player = taker.playerID
  matchDetails.ball.withTeam = attack.teamID
  matchDetails.ball.position = [throwX, place, 0]
  matchDetails.ball.lastTouch.playerName = taker.name
  matchDetails.ball.lastTouch.playerID = taker.playerID
  matchDetails.ball.lastTouch.teamID = attack.teamID
  matchDetails.ball.lastTouch.deflection = false

  taker.currentPOS = [throwX, place]
  taker.intentPOS = [throwX, place]
  taker.hasBall = true
  taker.action = 'pass'
  matchDetails.ball.isThrowIn = true
  matchDetails.ball.isOffsideExempt = true
  matchDetails.ball.isRestart = true

  matchDetails.iterationLog.push(`Throw in to - ${attack.name} (Taker: ${taker.name})`)
  if (Array.isArray(matchDetails.events)) {
    matchDetails.events.push({
      type: 'throwIn',
      teamID: attack.teamID,
      teamName: attack.name,
      playerName: taker.name,
      iteration: matchDetails.iterationCount || 0,
      half: matchDetails.half,
      deadBall: true
    })
  }

  // 2. Modelo Open Football (RestartShape::plan ThrowIn):
  // NO se resetean las posiciones de los 22 jugadores al fondo de la cancha.
  // Solo se habilitan 2 compañeros en estaciones cortas ("two short options"):
  // - Opción 1: por la banda hacia adelante (+68px de avance, 20px al interior)
  // - Opción 2: apoyo interior / descarga retrasada (-18px, 56px al interior)
  const isAttackingTop = taker.originPOS[1] > (pitchHeight / 2)
  const forwardDir = isAttackingTop ? -1 : 1
  const infieldDir = isLeft ? 1 : -1

  const opt1Pos = [
    Math.max(20, Math.min(pitchWidth - 20, throwX + infieldDir * 22)),
    Math.max(30, Math.min(pitchHeight - 30, place + forwardDir * 68))
  ]
  const opt2Pos = [
    Math.max(35, Math.min(pitchWidth - 35, throwX + infieldDir * 58)),
    Math.max(30, Math.min(pitchHeight - 30, place - forwardDir * 20))
  ]

  const outfieldMates = attack.players.filter(
    p => common.isOnPitch(p) && p.playerID !== taker.playerID && p.position !== 'GK'
  )

  // Asignar los 2 compañeros más cercanos a cada estación corta de apoyo
  if (outfieldMates.length >= 2) {
    const sorted1 = [...outfieldMates].sort((a, b) => common.distance(a.currentPOS, opt1Pos) - common.distance(b.currentPOS, opt1Pos))
    const mate1 = sorted1[0]
    const sorted2 = [...outfieldMates].filter(p => p.playerID !== mate1.playerID).sort((a, b) => common.distance(a.currentPOS, opt2Pos) - common.distance(b.currentPOS, opt2Pos))
    const mate2 = sorted2[0]

    if (mate1) {
      mate1.intentPOS = opt1Pos.slice()
      // Si estaba muy lejos de la jugada, acercarlo suavemente a la zona de apoyo para dar opción limpia
      if (common.distance(mate1.currentPOS, opt1Pos) > 65) {
        mate1.currentPOS = [
          Math.round(mate1.currentPOS[0] * 0.45 + opt1Pos[0] * 0.55),
          Math.round(mate1.currentPOS[1] * 0.45 + opt1Pos[1] * 0.55)
        ]
      }
    }
    if (mate2) {
      mate2.intentPOS = opt2Pos.slice()
      if (common.distance(mate2.currentPOS, opt2Pos) > 65) {
        mate2.currentPOS = [
          Math.round(mate2.currentPOS[0] * 0.45 + opt2Pos[0] * 0.55),
          Math.round(mate2.currentPOS[1] * 0.45 + opt2Pos[1] * 0.55)
        ]
      }
    }
    matchDetails.throwInShortMateIDs = [mate1?.playerID, mate2?.playerID].filter(Boolean)
  }

  // 3. Respetar distancia reglamentaria: rivales a más de 20px del punto de saque
  for (const defP of defence.players) {
    if (!common.isOnPitch(defP) || defP.position === 'GK') continue
    const d = common.distance(defP.currentPOS, throwPos)
    if (d < 22) {
      defP.currentPOS[0] = Math.max(30, Math.min(pitchWidth - 30, throwX + infieldDir * 26))
      defP.intentPOS = defP.currentPOS.slice()
    }
  }

  matchDetails.isThrowIn = true
  matchDetails.throwInTakerID = taker.playerID
  matchDetails.throwInIter = matchDetails.iterationCount || 0
  resolveMutualPlayerSeparation(matchDetails)
  matchDetails.endIteration = true
  return matchDetails
}

export function setLeftKickOffTeamThrowIn(matchDetails, ballIntended) {
  return executeThrowInSetup(matchDetails, matchDetails.kickOffTeam, matchDetails.secondTeam, true, ballIntended)
}

export function setRightKickOffTeamThrowIn(matchDetails, ballIntended) {
  return executeThrowInSetup(matchDetails, matchDetails.kickOffTeam, matchDetails.secondTeam, false, ballIntended)
}

export function setLeftSecondTeamThrowIn(matchDetails, ballIntended) {
  return executeThrowInSetup(matchDetails, matchDetails.secondTeam, matchDetails.kickOffTeam, true, ballIntended)
}

export function setRightSecondTeamThrowIn(matchDetails, ballIntended) {
  return executeThrowInSetup(matchDetails, matchDetails.secondTeam, matchDetails.kickOffTeam, false, ballIntended)
}

export function setBottomGoalKick(matchDetails) {
  const kickOffTeamKeepYPos = matchDetails.kickOffTeam.players[0].originPOS[1]
  const halfPitchSize = matchDetails.pitchSize[1] / 2
  const attack = (kickOffTeamKeepYPos > halfPitchSize) ? matchDetails.kickOffTeam : matchDetails.secondTeam
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  common.removeBallFromAllPlayers(matchDetails)
  setVariables.resetPlayerPositions(matchDetails)
  setPlayerPositions(matchDetails, attack, -80)
  matchDetails.ball.position = [pitchWidth / 2, pitchHeight - 20, 0]
  setBallSpecificGoalKickValue(matchDetails, attack)
  matchDetails.endIteration = true
  return matchDetails
}

export function setTopGoalKick(matchDetails) {
  const kickOffTeamKeepYPos = matchDetails.kickOffTeam.players[0].originPOS[1]
  const halfPitchSize = matchDetails.pitchSize[1] / 2
  const attack = (kickOffTeamKeepYPos > halfPitchSize) ? matchDetails.secondTeam : matchDetails.kickOffTeam
  const [pitchWidth] = matchDetails.pitchSize
  common.removeBallFromAllPlayers(matchDetails)
  setVariables.resetPlayerPositions(matchDetails)
  setPlayerPositions(matchDetails, attack, 80)
  matchDetails.ball.position = [pitchWidth / 2, 20, 0]
  setBallSpecificGoalKickValue(matchDetails, attack)
  matchDetails.endIteration = true
  return matchDetails
}

function setBallSpecificGoalKickValue(matchDetails, attack) {
  const kicker = common.isOnPitch(attack.players[0]) ? attack.players[0] : attack.players.find(common.isOnPitch)
  kicker.currentPOS = [matchDetails.ball.position[0], matchDetails.ball.position[1]]
  kicker.intentPOS = kicker.currentPOS.slice()
  kicker.hasBall = true
  const isDirect = attack?.playStyle === 'direct' || attack?.playStyle === 'longBall' || common.getRandomNumber(1, 100) <= 35
  kicker.action = isDirect ? 'boot' : 'pass'
  matchDetails.ball.isGoalKick = true
  matchDetails.ball.isOffsideExempt = true
  matchDetails.ball.isRestart = true
  matchDetails.ball.lastTouch.playerName = kicker.name
  matchDetails.ball.lastTouch.playerID = kicker.playerID
  matchDetails.ball.lastTouch.teamID = attack.teamID
  matchDetails.ball.lastTouch.deflection = false
  matchDetails.ball.ballOverIterations = []
  matchDetails.ball.withPlayer = true
  matchDetails.ball.Player = kicker.playerID
  matchDetails.ball.withTeam = attack.teamID
  matchDetails.iterationLog.push(`Goal Kick to - ${attack.name}`)
  if (Array.isArray(matchDetails.events)) {
    matchDetails.events.push({
      type: 'goalKick',
      teamID: attack.teamID,
      teamName: attack.name,
      playerName: kicker.name,
      iteration: matchDetails.iterationCount || 0,
      half: matchDetails.half,
      deadBall: true
    })
  }
}

export function closestPlayerToPosition(player, team, position) {
  let currentDifference = 1000000
  const playerInformation = {
    thePlayer: null,
    proxPOS: [0, 0],
    proxToBall: 1000000
  }
  for (const thisPlayer of team.players) {
    if (!common.isOnPitch(thisPlayer)) continue
    if (!player || player.playerID !== thisPlayer.playerID) {
      const ballToPlayerX = thisPlayer.currentPOS[0] - position[0]
      const ballToPlayerY = thisPlayer.currentPOS[1] - position[1]
      const proximityToBall = Math.hypot(ballToPlayerX, ballToPlayerY)
      if (proximityToBall < currentDifference) {
        playerInformation.thePlayer = thisPlayer
        playerInformation.proxPOS = [ballToPlayerX, ballToPlayerY]
        playerInformation.proxToBall = proximityToBall
        currentDifference = proximityToBall
      }
    }
  }
  if (!playerInformation.thePlayer) {
    const fallback = team.players.find(common.isOnPitch) || team.players[0]
    playerInformation.thePlayer = fallback
    playerInformation.proxPOS = [0, 0]
    playerInformation.proxToBall = 0
  }
  return playerInformation
}

export function setSetpieceKickOffTeam(matchDetails) {
  const [, pitchHeight] = matchDetails.pitchSize
  const ballPosition = matchDetails.ball.position.slice()
  const attackingTowardsTop = matchDetails.kickOffTeam.players[0].originPOS[1] > pitchHeight / 2
  const pushSetpieceEvent = (type) => {
    if (Array.isArray(matchDetails.events)) {
      const infractor = matchDetails.pendingPenaltyInfractor || matchDetails.pendingFoulPlayer?.name || null
      matchDetails.events.push({
        type,
        teamID: matchDetails.kickOffTeam.teamID,
        teamName: matchDetails.kickOffTeam.name,
        infractorName: infractor,
        foulPlayer: matchDetails.pendingFoulPlayer?.name,
        foulCard: matchDetails.pendingFoulCard,
        iteration: matchDetails.iterationCount || 0,
        half: matchDetails.half,
        deadBall: true
      })
    }
  }
  if (attackingTowardsTop && common.inTopPenalty(matchDetails, ballPosition)) {
    matchDetails.kickOffTeamStatistics.penalties++
    matchDetails.iterationLog.push(`penalty to: ${matchDetails.kickOffTeam.name}`)
    pushSetpieceEvent('penalty')
    return setTopPenalty(matchDetails)
  }
  if (!attackingTowardsTop && common.inBottomPenalty(matchDetails, ballPosition)) {
    matchDetails.kickOffTeamStatistics.penalties++
    matchDetails.iterationLog.push(`penalty to: ${matchDetails.kickOffTeam.name}`)
    pushSetpieceEvent('penalty')
    return setBottomPenalty(matchDetails)
  }
  if (attackingTowardsTop) {
    matchDetails.kickOffTeamStatistics.freekicks++
    matchDetails.iterationLog.push(`freekick to: ${matchDetails.kickOffTeam.name} [${matchDetails.ball.position}]`)
    pushSetpieceEvent('freekick')
    return setFreekicks.setBottomFreekick(matchDetails, ballPosition)
  }
  matchDetails.kickOffTeamStatistics.freekicks++
  matchDetails.iterationLog.push(`freekick to: ${matchDetails.kickOffTeam.name} [${matchDetails.ball.position}]`)
  pushSetpieceEvent('freekick')
  return setFreekicks.setTopFreekick(matchDetails, ballPosition)
}

export function setSetpieceSecondTeam(matchDetails) {
  const [, pitchHeight] = matchDetails.pitchSize
  const ballPosition = matchDetails.ball.position.slice()
  const attackingTowardsTop = matchDetails.secondTeam.players[0].originPOS[1] > pitchHeight / 2
  const pushSetpieceEvent = (type) => {
    if (Array.isArray(matchDetails.events)) {
      const infractor = matchDetails.pendingPenaltyInfractor || matchDetails.pendingFoulPlayer?.name || null
      matchDetails.events.push({
        type,
        teamID: matchDetails.secondTeam.teamID,
        teamName: matchDetails.secondTeam.name,
        infractorName: infractor,
        foulPlayer: matchDetails.pendingFoulPlayer?.name,
        foulCard: matchDetails.pendingFoulCard,
        iteration: matchDetails.iterationCount || 0,
        half: matchDetails.half,
        deadBall: true
      })
    }
  }
  if (attackingTowardsTop && common.inTopPenalty(matchDetails, ballPosition)) {
    matchDetails.secondTeamStatistics.penalties++
    matchDetails.iterationLog.push(`penalty to: ${matchDetails.secondTeam.name}`)
    pushSetpieceEvent('penalty')
    return setTopPenalty(matchDetails)
  }
  if (!attackingTowardsTop && common.inBottomPenalty(matchDetails, ballPosition)) {
    matchDetails.secondTeamStatistics.penalties++
    matchDetails.iterationLog.push(`penalty to: ${matchDetails.secondTeam.name}`)
    pushSetpieceEvent('penalty')
    return setBottomPenalty(matchDetails)
  }
  if (attackingTowardsTop) {
    matchDetails.secondTeamStatistics.freekicks++
    matchDetails.iterationLog.push(`freekick to: ${matchDetails.secondTeam.name} [${matchDetails.ball.position}]`)
    pushSetpieceEvent('freekick')
    return setFreekicks.setBottomFreekick(matchDetails, ballPosition)
  }
  matchDetails.secondTeamStatistics.freekicks++
  matchDetails.iterationLog.push(`freekick to: ${matchDetails.secondTeam.name} [${matchDetails.ball.position}]`)
  pushSetpieceEvent('freekick')
  return setFreekicks.setTopFreekick(matchDetails, ballPosition)
}

export function setTopPenalty(matchDetails) {
  common.removeBallFromAllPlayers(matchDetails)
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  const kickOffTeamKeepYPos = matchDetails.kickOffTeam.players[0].originPOS[1]
  const halfPitchSize = pitchHeight / 2
  const attack = (kickOffTeamKeepYPos > halfPitchSize) ? matchDetails.kickOffTeam : matchDetails.secondTeam
  const defence = (kickOffTeamKeepYPos > halfPitchSize) ? matchDetails.secondTeam : matchDetails.kickOffTeam
  const penaltySpotDist = Math.round(pitchHeight * (11 / 105))
  const shootArray = [pitchWidth / 2, penaltySpotDist]
  if (common.isOnPitch(defence.players[0])) {
    defence.players[0].currentPOS = defence.players[0].originPOS.slice()
    defence.players[0].intentPOS = defence.players[0].originPOS.slice()
  }
  setPlayerPenaltyPositions(attack, defence, shootArray, true, pitchWidth, pitchHeight)
  setBallSpecificPenaltyValue(matchDetails, shootArray, attack)
  matchDetails.ball.direction = 'north'
  attack.intent = 'attack'
  defence.intent = 'defend'
  matchDetails.endIteration = true
  return matchDetails
}

export function setBottomPenalty(matchDetails) {
  common.removeBallFromAllPlayers(matchDetails)
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  const kickOffTeamKeepYPos = matchDetails.kickOffTeam.players[0].originPOS[1]
  const halfPitchSize = pitchHeight / 2
  const attack = (kickOffTeamKeepYPos > halfPitchSize) ? matchDetails.secondTeam : matchDetails.kickOffTeam
  const defence = (kickOffTeamKeepYPos > halfPitchSize) ? matchDetails.kickOffTeam : matchDetails.secondTeam
  const penaltySpotDist = Math.round(pitchHeight * (11 / 105))
  const shootArray = [pitchWidth / 2, pitchHeight - penaltySpotDist]
  if (common.isOnPitch(defence.players[0])) {
    defence.players[0].currentPOS = defence.players[0].originPOS.slice()
    defence.players[0].intentPOS = defence.players[0].originPOS.slice()
  }
  setPlayerPenaltyPositions(attack, defence, shootArray, false, pitchWidth, pitchHeight)
  setBallSpecificPenaltyValue(matchDetails, shootArray, attack)
  matchDetails.ball.direction = 'south'
  attack.intent = 'attack'
  defence.intent = 'defend'
  matchDetails.endIteration = true
  return matchDetails
}

function setPlayerPenaltyPositions(attack, defence, shootArray, isTop, pitchWidth, pitchHeight) {
  const penaltySpotDist = isTop ? shootArray[1] : (pitchHeight - shootArray[1])
  // Medialuna reglamentaria: radio de 9.15m desde el punto del penal (~92px)
  // Ningún jugador entra al área (16.5m = ~165px) ni a la medialuna (11m + 9.15m = ~202px)
  const minGoalDist = Math.max(175, Math.round(pitchHeight * (17 / 105))) // >= 175px
  const minArcDist = Math.round(pitchHeight * (9.5 / 105)) + 4            // >= 99px
  const centreX = pitchWidth / 2

  const taker = selectPenaltyTaker(attack)
  const activeAtt = attack.players.filter(p => common.isOnPitch(p) && p.position !== 'GK' && p.playerID !== taker.playerID)
  const activeDef = defence.players.filter(p => common.isOnPitch(p) && p.position !== 'GK')

  // Distribuir a los jugadores en abanico semicircular fuera de la medialuna y del área grande
  const totalSlots = activeAtt.length + activeDef.length
  let slotIdx = 0

  const computePlayerCoord = (idx, stagger) => {
    const angle = (Math.PI * 0.10) + ((Math.PI * 0.80) * (idx / Math.max(1, totalSlots - 1)))
    const spreadX = Math.round(centreX + Math.cos(angle) * (minArcDist + 35 + stagger))
    let yDepth = Math.max(minGoalDist + stagger, penaltySpotDist + Math.round(Math.sin(angle) * (minArcDist + 10 + stagger)))
    const distToSpot = Math.sqrt((spreadX - centreX) ** 2 + (yDepth - penaltySpotDist) ** 2)
    if (distToSpot < minArcDist + 2) {
      yDepth = Math.round(penaltySpotDist + Math.sqrt(Math.max(1, (minArcDist + 4) ** 2 - Math.min((minArcDist + 2) ** 2, (spreadX - centreX) ** 2))))
    }
    yDepth = Math.max(minGoalDist, yDepth)
    const y = isTop ? yDepth : (pitchHeight - yDepth)
    return [Math.max(35, Math.min(pitchWidth - 35, spreadX)), y]
  }

  // Intercalar defensores y atacantes a lo largo del arco exterior
  const maxPlayers = Math.max(activeAtt.length, activeDef.length)
  for (let i = 0; i < maxPlayers; i++) {
    if (i < activeDef.length) {
      const defP = activeDef[i]
      defP.currentPOS = computePlayerCoord(slotIdx, i % 2 === 0 ? 0 : 10)
      defP.intentPOS = defP.currentPOS.slice()
      slotIdx++
    }
    if (i < activeAtt.length) {
      const attP = activeAtt[i]
      attP.currentPOS = computePlayerCoord(slotIdx, i % 2 === 0 ? 8 : 16)
      attP.intentPOS = attP.currentPOS.slice()
      slotIdx++
    }
  }
}

function setBallSpecificPenaltyValue(matchDetails, shootArray, attack) {
  const taker = selectPenaltyTaker(attack)
  if (common.isOnPitch(attack.players[0])) {
    attack.players[0].currentPOS = attack.players[0].originPOS.slice()
  }
  taker.currentPOS = shootArray.slice()
  taker.intentPOS = shootArray.slice()
  taker.hasBall = true
  taker.action = 'penalty'
  matchDetails.ball.isRestart = true
  matchDetails.ball.lastTouch.playerName = taker.name
  matchDetails.ball.lastTouch.playerID = taker.playerID
  matchDetails.ball.lastTouch.teamID = attack.teamID
  matchDetails.ball.lastTouch.deflection = false
  matchDetails.ball.position = [shootArray[0], shootArray[1], 0]
  matchDetails.ball.ballOverIterations = []
  matchDetails.ball.Player = taker.playerID
  matchDetails.ball.withPlayer = true
  matchDetails.ball.withTeam = attack.teamID
}

export function setKickOffTeamGoalScored(matchDetails) {
  let scorer = matchDetails.ball.lastTouch.playerName
  let thisIndex = matchDetails.kickOffTeam.players.findIndex(thisPlayer => thisPlayer.name === scorer)
  if (thisIndex === -1) {
    if (matchDetails.ball.lastShooter?.teamID === matchDetails.kickOffTeam.teamID) {
      thisIndex = matchDetails.kickOffTeam.players.findIndex(p => p.playerID === matchDetails.ball.lastShooter.playerID)
    }
    if (thisIndex === -1) {
      const nearest = closestPlayerToPosition(null, matchDetails.kickOffTeam, matchDetails.ball.position)
      const fallbackScorer = nearest.thePlayer || matchDetails.kickOffTeam.players.find(common.isOnPitch) || matchDetails.kickOffTeam.players[0]
      scorer = fallbackScorer.name
      fallbackScorer.stats.goals++
    } else {
      scorer = matchDetails.kickOffTeam.players[thisIndex].name
      matchDetails.kickOffTeam.players[thisIndex].stats.goals++
    }
  } else {
    matchDetails.kickOffTeam.players[thisIndex].stats.goals++
  }

  // Asistencia de gol
  const passAssistID1 = matchDetails.ball?.lastPasserPlayerID
  if (passAssistID1) {
    const assister = matchDetails.kickOffTeam.players.find(p => p.playerID === passAssistID1)
    if (assister && assister.name !== scorer) {
      assister.stats.assists = (assister.stats.assists || 0) + 1
    }
  }
  if (matchDetails.ball) matchDetails.ball.lastPasserPlayerID = null

  const bodyPart = matchDetails.ball.lastTouch.bodyPart || 'foot'
  const isHeader = bodyPart === 'head'
  const shotType = matchDetails.ball.lastTouch.shotType || (isHeader ? 'header' : 'close_range')
  const goalDetail = matchDetails.ball.lastTouch.goalDetail || (isHeader ? 'Cabezazo' : 'Tiro dentro del área')

  matchDetails.iterationLog.push(`Goal Scored by - ${scorer} (${goalDetail}) - (${matchDetails.kickOffTeam.name})`)
  if (Array.isArray(matchDetails.events)) {
    matchDetails.events.push({
      type: 'goal',
      teamID: matchDetails.kickOffTeam.teamID,
      teamName: matchDetails.kickOffTeam.name,
      playerName: scorer,
      iteration: matchDetails.iterationCount || 0,
      half: matchDetails.half,
      bodyPart,
      isHeader,
      shotType,
      goalDetail
    })
  }

  matchDetails.ball.lastTouch.playerName = ''
  matchDetails.ball.lastTouch.playerID = ''
  matchDetails.ball.lastTouch.teamID = ''
  common.removeBallFromAllPlayers(matchDetails)

  // La pelota permanece clavada dentro de la red del arco durante la celebración
  const [, pitchHeight] = matchDetails.pitchSize
  const goalInNetY = matchDetails.ball.position[1] < (pitchHeight / 2) ? -12 : (pitchHeight + 12)
  matchDetails.ball.position = [matchDetails.ball.position[0], goalInNetY, 0]
  matchDetails.ball.ballOverIterations = []
  matchDetails.ball.withPlayer = false
  matchDetails.ball.withTeam = ''
  matchDetails.pendingKickoffTeam = 'secondTeam'
  matchDetails.kickOffTeamStatistics.goals++
  matchDetails.endIteration = true
  return matchDetails
}

export function setSecondTeamGoalScored(matchDetails) {
  let scorer = matchDetails.ball.lastTouch.playerName
  let thisIndex = matchDetails.secondTeam.players.findIndex(thisPlayer => thisPlayer.name === scorer)
  if (thisIndex === -1) {
    if (matchDetails.ball.lastShooter?.teamID === matchDetails.secondTeam.teamID) {
      thisIndex = matchDetails.secondTeam.players.findIndex(p => p.playerID === matchDetails.ball.lastShooter.playerID)
    }
    if (thisIndex === -1) {
      const nearest = closestPlayerToPosition(null, matchDetails.secondTeam, matchDetails.ball.position)
      const fallbackScorer = nearest.thePlayer || matchDetails.secondTeam.players.find(common.isOnPitch) || matchDetails.secondTeam.players[0]
      scorer = fallbackScorer.name
      fallbackScorer.stats.goals++
    } else {
      scorer = matchDetails.secondTeam.players[thisIndex].name
      matchDetails.secondTeam.players[thisIndex].stats.goals++
    }
  } else {
    matchDetails.secondTeam.players[thisIndex].stats.goals++
  }

  // Asistencia de gol
  const passAssistID2 = matchDetails.ball?.lastPasserPlayerID
  if (passAssistID2) {
    const assister = matchDetails.secondTeam.players.find(p => p.playerID === passAssistID2)
    if (assister && assister.name !== scorer) {
      assister.stats.assists = (assister.stats.assists || 0) + 1
    }
  }
  if (matchDetails.ball) matchDetails.ball.lastPasserPlayerID = null

  const bodyPart = matchDetails.ball.lastTouch.bodyPart || 'foot'
  const isHeader = bodyPart === 'head'
  const shotType = matchDetails.ball.lastTouch.shotType || (isHeader ? 'header' : 'close_range')
  const goalDetail = matchDetails.ball.lastTouch.goalDetail || (isHeader ? 'Cabezazo' : 'Tiro dentro del área')

  matchDetails.iterationLog.push(`Goal Scored by - ${scorer} (${goalDetail}) - (${matchDetails.secondTeam.name})`)
  if (Array.isArray(matchDetails.events)) {
    matchDetails.events.push({
      type: 'goal',
      teamID: matchDetails.secondTeam.teamID,
      teamName: matchDetails.secondTeam.name,
      playerName: scorer,
      iteration: matchDetails.iterationCount || 0,
      half: matchDetails.half,
      bodyPart,
      isHeader,
      shotType,
      goalDetail
    })
  }

  matchDetails.ball.lastTouch.playerName = ''
  matchDetails.ball.lastTouch.playerID = ''
  matchDetails.ball.lastTouch.teamID = ''
  common.removeBallFromAllPlayers(matchDetails)

  // La pelota permanece clavada dentro de la red del arco durante la celebración
  const [, pitchHeight] = matchDetails.pitchSize
  const goalInNetY = matchDetails.ball.position[1] < (pitchHeight / 2) ? -12 : (pitchHeight + 12)
  matchDetails.ball.position = [matchDetails.ball.position[0], goalInNetY, 0]
  matchDetails.ball.ballOverIterations = []
  matchDetails.ball.withPlayer = false
  matchDetails.ball.withTeam = ''
  matchDetails.pendingKickoffTeam = 'kickOffTeam'
  matchDetails.secondTeamStatistics.goals++
  matchDetails.endIteration = true
  return matchDetails
}

export function setBallSpecificGoalScoreValue(matchDetails, concedingTeam) {
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  const centerX = pitchWidth / 2
  const centerY = pitchHeight / 2
  matchDetails.ball.position = [centerX, centerY, 0]
  matchDetails.ball.ballOverIterations = []
  matchDetails.ball.withPlayer = true
  matchDetails.ball.withTeam = concedingTeam.teamID
  matchDetails.ball.isRestart = true

  const otherTeam = concedingTeam.teamID === matchDetails.kickOffTeam.teamID ? matchDetails.secondTeam : matchDetails.kickOffTeam
  const isOtherTeamTop = otherTeam.players[0].originPOS[1] < centerY

  // Los rivales deben mantenerse estrictamente fuera del círculo central y en su propio campo
  for (const rival of otherTeam.players) {
    if (!common.isOnPitch(rival)) continue
    if (isOtherTeamTop) {
      if (rival.currentPOS[1] > centerY - 65) rival.currentPOS[1] = centerY - 65
      if (rival.intentPOS[1] > centerY - 65) rival.intentPOS[1] = centerY - 65
    } else {
      if (rival.currentPOS[1] < centerY + 65) rival.currentPOS[1] = centerY + 65
      if (rival.intentPOS[1] < centerY + 65) rival.intentPOS[1] = centerY + 65
    }
  }

  const activeField = concedingTeam.players.filter((p, idx) => idx > 0 && common.isOnPitch(p))
  const kicker = activeField[activeField.length - 1] || concedingTeam.players.find(common.isOnPitch) || concedingTeam.players[0]
  const waiter = activeField[activeField.length - 2] || kicker

  kicker.currentPOS = [centerX, centerY]
  kicker.intentPOS = [centerX, centerY]
  kicker.hasBall = true
  kicker.action = 'pass'
  kicker.isKickoffPass = true
  matchDetails.kickoffRetentionTicks = 5
  matchDetails.turnoverTick = -999
  matchDetails.ball.lastTouch.playerName = kicker.name
  matchDetails.ball.lastTouch.playerID = kicker.playerID
  matchDetails.ball.lastTouch.teamID = concedingTeam.teamID
  matchDetails.ball.lastTouch.deflection = false
  matchDetails.ball.Player = kicker.playerID
  if (waiter && waiter.playerID !== kicker.playerID) {
    waiter.currentPOS = [centerX + 24, centerY]
    waiter.intentPOS = [centerX + 24, centerY]
  }
}

function tryGoalLineSave(matchDetails, defendingTeam) {
  if (matchDetails.ball?.saveChecked) return false
  matchDetails.ball.saveChecked = true
  const goalie = defendingTeam?.players?.[0]
  if (!goalie || !common.isOnPitch(goalie)) return false
  const saving = Number(goalie.skill?.saving || 72)
  const perception = Number(goalie.skill?.perception || 70)
  const shotDist = Number(matchDetails.ball?.lastShotDistance || 140)
  const longShotBonus = shotDist > 205 ? Math.min(22, Math.round((shotDist - 205) * 0.22)) : 0
  const gkScore = (saving * 0.72 + perception * 0.28) + longShotBonus
  const saveRoll = common.getRandomNumber(40, 112)
  if (gkScore >= saveRoll) {
    goalie.stats.saves = (goalie.stats.saves || 0) + 1
    const roll = common.getRandomNumber(1, 100)
    const [pitchWidth, pitchHeight] = matchDetails.pitchSize
    const goalieSide = (goalie.originPOS[1] < (pitchHeight / 2)) ? 'top' : 'bottom'
    const ballX = matchDetails.ball.position[0]
    const isLeftCorner = ballX < (pitchWidth / 2)

    if (roll <= 45) {
      matchDetails.iterationLog.push(`Sensational goal-line save by ${goalie.name}! Ball tipped out for a corner`)
      if (Array.isArray(matchDetails.events)) {
        matchDetails.events.push({
          type: 'save',
          outcome: 'corner',
          teamID: defendingTeam.teamID,
          teamName: defendingTeam.name,
          playerName: goalie.name,
          iteration: matchDetails.iterationCount || 0,
          half: matchDetails.half
        })
      }
      matchDetails.endIteration = true
      if (goalieSide === 'top') {
        if (isLeftCorner) setTopLeftCornerPositions(matchDetails)
        else setTopRightCornerPositions(matchDetails)
      } else {
        if (isLeftCorner) setBottomLeftCornerPositions(matchDetails)
        else setBottomRightCornerPositions(matchDetails)
      }
      return true
    } else if (roll <= 75) {
      const dropDistanceX = common.getRandomNumber(-35, 35)
      const dropDistanceY = goalieSide === 'top' ? common.getRandomNumber(25, 75) : -common.getRandomNumber(25, 75)
      const reboundX = Math.max(120, Math.min(pitchWidth - 120, goalie.currentPOS[0] + dropDistanceX))
      const reboundY = goalieSide === 'top'
        ? Math.max(30, Math.min(160, goalie.currentPOS[1] + dropDistanceY))
        : Math.min(pitchHeight - 30, Math.max(pitchHeight - 160, goalie.currentPOS[1] + dropDistanceY))

      const traj = common.getBallTrajectory(goalie.currentPOS, [reboundX, reboundY], common.getRandomNumber(50, 85), 'rebound', pitchHeight)
      matchDetails.ball.ballOverIterations = traj
      matchDetails.ball.position = traj[0] || [reboundX, reboundY, 0]
      matchDetails.ball.Player = ''
      matchDetails.ball.withPlayer = false
      matchDetails.ball.withTeam = ''
      matchDetails.ball.lastTouch.playerID = goalie.playerID
      matchDetails.ball.lastTouch.playerName = goalie.name
      matchDetails.ball.lastTouch.teamID = defendingTeam.teamID
      matchDetails.ball.lastTouch.iterations = 0
      matchDetails.ball.lastTouch.deflection = true
      matchDetails.ball.lastReboundIter = matchDetails.iterationCount || 0
      goalie.hasBall = false
      matchDetails.iterationLog.push(`Goal-line save by ${goalie.name}! Ball rebounds into play!`)
      if (Array.isArray(matchDetails.events)) {
        matchDetails.events.push({
          type: 'save',
          outcome: 'rebound',
          teamID: defendingTeam.teamID,
          teamName: defendingTeam.name,
          playerName: goalie.name,
          iteration: matchDetails.iterationCount || 0,
          half: matchDetails.half
        })
      }
      matchDetails.endIteration = true
      return true
    } else {
      setGoalieHasBall(matchDetails, goalie)
      matchDetails.iterationLog.push(`Ball saved on the line by ${goalie.name}`)
      if (Array.isArray(matchDetails.events)) {
        matchDetails.events.push({
          type: 'save',
          outcome: 'catch',
          teamID: defendingTeam.teamID,
          teamName: defendingTeam.name,
          playerName: goalie.name,
          iteration: matchDetails.iterationCount || 0,
          half: matchDetails.half
        })
      }
      matchDetails.endIteration = true
      return true
    }
  }
  return false
}

export function keepInBoundaries(matchDetails, kickteamID, ballIntended) {
  const { kickOffTeam, secondTeam } = matchDetails
  const KOTid = kickOffTeam.teamID
  const [pitchWidth, pitchHeight, goalWidth] = matchDetails.pitchSize
  const halfMWidth = parseInt(pitchWidth / 2, 10)
  const leftPost = halfMWidth - parseInt(goalWidth / 2, 10)
  const rightPost = halfMWidth + parseInt(goalWidth / 2, 10)
  const [bXPOS, bYPOS] = ballIntended
  const kickOffTeamSide = (kickOffTeam.players[0].originPOS[1] < (pitchHeight / 2)) ? 'top' : 'bottom'

  const clearOffsideOnOut = () => {
    matchDetails.pendingOffsideSnapshot = null
    matchDetails.lastOffsideSnapshot = null
    if (matchDetails.ball) matchDetails.ball.offsideSnapshot = null
  }

  if (bXPOS < 0 && kickteamID === KOTid) {
    clearOffsideOnOut()
    return setLeftSecondTeamThrowIn(matchDetails, ballIntended)
  }
  if (bXPOS < 0 && kickteamID !== KOTid) {
    clearOffsideOnOut()
    return setLeftKickOffTeamThrowIn(matchDetails, ballIntended)
  }
  if (bXPOS > pitchWidth && kickteamID === KOTid) {
    clearOffsideOnOut()
    return setRightSecondTeamThrowIn(matchDetails, ballIntended)
  }
  if (bXPOS > pitchWidth && kickteamID !== KOTid) {
    clearOffsideOnOut()
    return setRightKickOffTeamThrowIn(matchDetails, ballIntended)
  }

  if (bYPOS < 0) {
    clearOffsideOnOut()
    if (common.isBetween(bXPOS, leftPost, rightPost)) {
      const topDefendingTeam = (kickOffTeamSide === 'top') ? kickOffTeam : secondTeam
      if (tryGoalLineSave(matchDetails, topDefendingTeam)) return matchDetails
      if (kickOffTeamSide === 'top') return setSecondTeamGoalScored(matchDetails)
      if (kickOffTeamSide === 'bottom') return setKickOffTeamGoalScored(matchDetails)
    } else {
      if (bXPOS <= halfMWidth && kickteamID === KOTid) {
        if (kickOffTeamSide === 'top') return setTopLeftCornerPositions(matchDetails)
        if (kickOffTeamSide === 'bottom') return setTopGoalKick(matchDetails)
      }
      if (bXPOS > halfMWidth && kickteamID === KOTid) {
        if (kickOffTeamSide === 'top') return setTopRightCornerPositions(matchDetails)
        if (kickOffTeamSide === 'bottom') return setTopGoalKick(matchDetails)
      }
      if (bXPOS <= halfMWidth && kickteamID !== KOTid) {
        if (kickOffTeamSide === 'top') return setTopGoalKick(matchDetails)
        if (kickOffTeamSide === 'bottom') return setTopLeftCornerPositions(matchDetails)
      }
      if (bXPOS > halfMWidth && kickteamID !== KOTid) {
        if (kickOffTeamSide === 'top') return setTopGoalKick(matchDetails)
        if (kickOffTeamSide === 'bottom') return setTopRightCornerPositions(matchDetails)
      }
    }
  }

  if (bYPOS > pitchHeight) {
    clearOffsideOnOut()
    if (common.isBetween(bXPOS, leftPost, rightPost)) {
      const bottomDefendingTeam = (kickOffTeamSide === 'bottom') ? kickOffTeam : secondTeam
      if (tryGoalLineSave(matchDetails, bottomDefendingTeam)) return matchDetails
      if (kickOffTeamSide === 'top') return setKickOffTeamGoalScored(matchDetails)
      if (kickOffTeamSide === 'bottom') return setSecondTeamGoalScored(matchDetails)
    } else {
      if (bXPOS <= halfMWidth && kickteamID === KOTid) {
        if (kickOffTeamSide === 'top') return setBottomGoalKick(matchDetails)
        if (kickOffTeamSide === 'bottom') return setBottomLeftCornerPositions(matchDetails)
      }
      if (bXPOS > halfMWidth && kickteamID === KOTid) {
        if (kickOffTeamSide === 'top') return setBottomGoalKick(matchDetails)
        if (kickOffTeamSide === 'bottom') return setBottomRightCornerPositions(matchDetails)
      }
      if (bXPOS <= halfMWidth && kickteamID !== KOTid) {
        if (kickOffTeamSide === 'top') return setBottomLeftCornerPositions(matchDetails)
        if (kickOffTeamSide === 'bottom') return setBottomGoalKick(matchDetails)
      }
      if (bXPOS > halfMWidth && kickteamID !== KOTid) {
        if (kickOffTeamSide === 'top') return setBottomRightCornerPositions(matchDetails)
        if (kickOffTeamSide === 'bottom') return setBottomGoalKick(matchDetails)
      }
    }
  }

  matchDetails.ballIntended = ballIntended
  return matchDetails
}

export function setPlayerPositions(matchDetails, team, extra) {
  for (const thisPlayer of team.players) {
    if (!common.isOnPitch(thisPlayer)) continue
    if (thisPlayer.position === 'GK') {
      thisPlayer.currentPOS = thisPlayer.originPOS.slice()
    } else {
      thisPlayer.currentPOS = thisPlayer.originPOS.slice()
      const playerPos = parseInt(thisPlayer.currentPOS[1], 10) + extra
      if (common.isBetween(playerPos, -1, matchDetails.pitchSize[1] + 1)) {
        thisPlayer.currentPOS[1] = playerPos
      }
      thisPlayer.intentPOS = [thisPlayer.originPOS[0], common.upToMax(common.upToMin(playerPos, 0), matchDetails.pitchSize[1])]
    }
  }
}

export function formationCheck(origin, current) {
  const xPos = origin[0] - current[0]
  const yPos = origin[1] - current[1]
  return [xPos, yPos]
}

export function switchSide(matchDetails, team) {
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  for (const thisPlayer of team.players) {
    if (!thisPlayer.originPOS) throw new Error('Each player must have an origin position set')
    thisPlayer.originPOS[0] = pitchWidth - thisPlayer.originPOS[0]
    thisPlayer.originPOS[1] = pitchHeight - thisPlayer.originPOS[1]
    if (common.isOnPitch(thisPlayer)) {
      thisPlayer.currentPOS = thisPlayer.originPOS.slice()
      thisPlayer.intentPOS = thisPlayer.originPOS.slice()
      // En el entretiempo recuperan +10 de fitness (sin volver mágicamente a 100 si estaban exhaustos)
      thisPlayer.fitness = common.round(Math.min(100, thisPlayer.fitness + 10), 2)
    } else {
      thisPlayer.currentPOS = ['NP', 'NP']
    }
  }
  return matchDetails
}

export function computeTeamGamePhase(team, matchDetails, inPossession) {
  if (!team || !Array.isArray(team.players)) return 'MidBlock'
  const [, pitchHeight] = matchDetails.pitchSize
  const isTopTeam = team.players[0].originPOS[1] < (pitchHeight / 2)
  const ballY = matchDetails.ball.position[1]
  const distBallToOwnGoalY = isTopTeam ? ballY : (pitchHeight - ballY)
  const currentIter = matchDetails.iterationCount || 0
  const ticksSinceTurnover = currentIter - (matchDetails.turnoverTick || 0)

  if (inPossession) {
    if ((matchDetails.kickoffRetentionTicks || 0) > 0) {
      return 'BuildUp'
    }
    if (ticksSinceTurnover <= 25 && ticksSinceTurnover >= 0 && (matchDetails.turnoverTick || 0) > 0) {
      return 'AttackingTransition'
    }
    if (distBallToOwnGoalY < pitchHeight * 0.35) {
      return 'BuildUp'
    }
    if (distBallToOwnGoalY > pitchHeight * 0.65) {
      return 'Attack'
    }
    return 'Progression'
  }

  // Sin posesión (Defensa)
  if (ticksSinceTurnover <= 20 && ticksSinceTurnover >= 0) {
    return 'DefensiveTransition'
  }
  const mentality = team.mentality || 'balanced'
  if (mentality === 'offensive' && distBallToOwnGoalY > pitchHeight * 0.40) {
    return 'HighPress'
  }
  if (distBallToOwnGoalY < pitchHeight * 0.35) {
    return 'LowBlock'
  }
  return 'MidBlock'
}

export function setIntentPosition(matchDetails, closestPlayer = null) {
  const { ball, kickOffTeam, secondTeam } = matchDetails
  if (!ball || !kickOffTeam || !secondTeam) return
  const kickOffTeamCheck = kickOffTeam.players.find(thisPlayer => thisPlayer.playerID === ball.Player)
  const secondTeamCheck = secondTeam.players.find(thisPlayer => thisPlayer.playerID === ball.Player)
  let kickTeam = kickOffTeamCheck ? kickOffTeam : (secondTeamCheck ? secondTeam : 'none')

  // Si la pelota viaja por un pase/centro activo, mantener la estructura de ataque y defensa
  if (kickTeam === 'none' && ball.isPendingPass && ball.lastTouch?.teamID) {
    if (ball.lastTouch.teamID === kickOffTeam.teamID) kickTeam = kickOffTeam
    else if (ball.lastTouch.teamID === secondTeam.teamID) kickTeam = secondTeam
  }
  const defendingTeam = (kickTeam === 'none') ? 'none' : (kickTeam.teamID === kickOffTeam.teamID ? secondTeam : kickOffTeam)

  // Asignar GamePhases a ambos equipos (open-football model)
  if (kickTeam !== 'none') {
    kickTeam.gamePhase = computeTeamGamePhase(kickTeam, matchDetails, true)
    defendingTeam.gamePhase = computeTeamGamePhase(defendingTeam, matchDetails, false)
  } else {
    kickOffTeam.gamePhase = computeTeamGamePhase(kickOffTeam, matchDetails, false)
    secondTeam.gamePhase = computeTeamGamePhase(secondTeam, matchDetails, false)
  }

  if (defendingTeam !== 'none') setDefenceRelativePos(matchDetails, defendingTeam, closestPlayer, kickTeam)
  if (kickTeam !== 'none') setAttackRelativePos(matchDetails, kickTeam, defendingTeam)
  if (kickTeam === 'none' && defendingTeam === 'none') {
    setLooseintentPOS(matchDetails, kickOffTeam, closestPlayer)
    setLooseintentPOS(matchDetails, secondTeam, closestPlayer)
  }
}

function setLooseintentPOS(matchDetails, thisTeam, closestPlayer) {
  const { ball } = matchDetails
  buildTeamShape(matchDetails, thisTeam, false)
  const anchors = thisTeam.teamShape?.anchors || {}

  for (const player of thisTeam.players) {
    if (!common.isOnPitch(player)) continue
    const diffX = ball.position[0] - player.currentPOS[0]
    const diffY = ball.position[1] - player.currentPOS[1]
    const distance = Math.sqrt(diffX * diffX + diffY * diffY)

    if (ball.isPendingPass && ball.targetPlayerID === player.playerID && Array.isArray(ball.targetPOS)) {
      player.intentPOS = [ball.targetPOS[0], ball.targetPOS[1]]
      continue
    }

    const isClosest = (thisTeam.closestPlayerID && player.playerID === thisTeam.closestPlayerID) ||
      (closestPlayer && player.playerID === closestPlayer.playerID)
    if (isClosest) {
      player.intentPOS = [ball.position[0], ball.position[1]]
      continue
    }

    if (distance < 95) {
      const pressure = 1 - (distance / 95)
      player.intentPOS = [
        player.currentPOS[0] + diffX * pressure * 0.35,
        player.currentPOS[1] + diffY * pressure * 0.35
      ]
      continue
    }

    const anchor = anchors[player.playerID]
    if (anchor) {
      player.intentPOS = [anchor[0], anchor[1]]
    } else {
      player.intentPOS = [player.originPOS[0], player.originPOS[1]]
    }
  }
}

function setDefenceRelativePos(matchDetails, defendingTeam, closestPlayer, attackingTeam) {
  const { ball, pitchSize } = matchDetails
  const [pitchWidth, pitchHeight] = pitchSize
  const isTopTeam = defendingTeam.players[0].originPOS[1] < (pitchHeight / 2)
  const goalDirY = isTopTeam ? -1 : 1

  // 1. Construir Bloque Deslizante TeamShape con limitador de velocidad BLOCK_SPEED
  buildTeamShape(matchDetails, defendingTeam, false)
  const anchors = defendingTeam.teamShape?.anchors || {}

  // 2. Asignar Plan Defensivo (Press, Cover, Mark, HoldZone) con Incumbency Bonus
  const defPlan = assignDefensivePlanWithIncumbency(defendingTeam, attackingTeam, matchDetails, isTopTeam)
  const duties = defPlan?.duties || {}

  for (const player of defendingTeam.players) {
    if (!common.isOnPitch(player)) continue
    player.offBallRun = null
    const anchor = anchors[player.playerID] || player.originPOS

    // Arquero: anchor del bloque
    if (player.position === 'GK') {
      player.intentPOS = [anchor[0], anchor[1]]
      continue
    }

    const playerDuty = duties[player.playerID] || { duty: 'HoldZone' }

    // A. PRESSER: Sale a presionar al portador goal-side
    if (playerDuty.duty === 'Press') {
      const isKickoffStandoff = (matchDetails.kickoffRetentionTicks || 0) > 0
      const targetBallY = isKickoffStandoff ? (isTopTeam ? (pitchHeight / 2 - 45) : (pitchHeight / 2 + 45)) : ball.position[1]
      const pressX = ball.position[0] * 0.85 + player.currentPOS[0] * 0.15
      const pressY = targetBallY + goalDirY * 12
      player.intentPOS = [
        Math.max(25, Math.min(pitchWidth - 25, pressX)),
        isTopTeam ? Math.max(25, pressY) : Math.min(pitchHeight - 25, pressY)
      ]
      continue
    }

    // B. COVER: Cobertura escalonada unos 24px detrás del presser
    if (playerDuty.duty === 'Cover') {
      const presser = defendingTeam.players.find(p => p.playerID === defPlan.presserID)
      const presserPOS = presser ? presser.currentPOS : ball.position
      const coverX = presserPOS[0] * 0.6 + anchor[0] * 0.4
      const coverY = presserPOS[1] + goalDirY * 26
      player.intentPOS = [
        Math.max(30, Math.min(pitchWidth - 30, coverX)),
        isTopTeam ? Math.max(45, coverY) : Math.min(pitchHeight - 45, coverY)
      ]
      continue
    }

    // C. MARKERS: Marcaje mixto (solo sigue al atacante si está en zona peligrosa y cerca de su sector)
    if (playerDuty.duty === 'Mark' && playerDuty.targetID) {
      const oppPlayer = attackingTeam?.players?.find(op => op.playerID === playerDuty.targetID)
      if (oppPlayer && common.isOnPitch(oppPlayer)) {
        const distOppToGoalY = isTopTeam ? oppPlayer.currentPOS[1] : (pitchHeight - oppPlayer.currentPOS[1])
        const lateralDeviation = Math.abs(oppPlayer.currentPOS[0] - anchor[0])
        // Solo tomar marca personal estricta si el atacante está en el último tercio (< 290px) y en su carril (< 115px)
        if (distOppToGoalY < 290 && lateralDeviation < 115) {
          const markX = oppPlayer.currentPOS[0] * 0.75 + anchor[0] * 0.25
          const markY = oppPlayer.currentPOS[1] + goalDirY * 14
          player.intentPOS = [
            Math.max(35, Math.min(pitchWidth - 35, markX)),
            isTopTeam ? Math.max(32, markY) : Math.min(pitchHeight - 32, markY)
          ]
          continue
        }
      }
    }

    // D. DEFENSIVE LINE & HOLD ZONE: Perfilamiento Goal-Side estricto, contención y corte de diagonales
    const role = player.tacticalRole || player.position
    const isDefenderRole = ['CB', 'LB', 'RB', 'LWB', 'RWB', 'DFC', 'LÍBERO', 'STOP I', 'STOP D'].includes(role) ||
      player.position === 'CB' || player.position === 'LB' || player.position === 'RB'

    if (isDefenderRole) {
      let finalX = anchor[0]
      let finalY = anchor[1]

      // 1. Corte de Diagonales hacia el centro:
      // Si un delantero rival pica en diagonal hacia el centro o el área, el central debe salir a interceptar la línea de pase/carrera
      const cuttingAttacker = attackingTeam?.players?.find(op => {
        if (!common.isOnPitch(op) || op.position === 'GK') return false
        const isAttackerRole = ['ST', 'CF', 'CAM', 'LM', 'RM', 'EXT', 'RW', 'LW'].includes(op.tacticalRole || op.position)
        const isDiagonalRun = op.offBallRun?.type === 'diagonalRun' || op.offBallRun?.type === 'diagonalInBehind' || op.offBallRun?.type === 'diagonalCutInside'
        const distY = isTopTeam ? (op.currentPOS[1] - player.currentPOS[1]) : (player.currentPOS[1] - op.currentPOS[1])
        return isAttackerRole && isDiagonalRun && distY > -40 && distY < 260 && Math.abs(op.currentPOS[0] - player.currentPOS[0]) < 170
      })

      if (cuttingAttacker && ['CB', 'DFC', 'LÍBERO', 'STOP I', 'STOP D'].includes(role)) {
        // Interceptar cerrando la diagonal hacia el centro, manteniendo la separación de la pareja central
        const isLeftCB = anchor[0] < (pitchWidth / 2)
        const sideOffset = isLeftCB ? -14 : 14
        finalX = (cuttingAttacker.currentPOS[0] * 0.65 + (pitchWidth / 2) * 0.35) + sideOffset
        finalY = cuttingAttacker.currentPOS[1] + goalDirY * 14
      } else {
        // 2. Regla Goal-Side estricta:
        // Ningún defensor de la línea puede quedar por delante del delantero rival más profundo de su sector
        const nearbyAttacker = attackingTeam?.players?.find(op => {
          if (!common.isOnPitch(op) || op.position === 'GK') return false
          const isFwd = ['ST', 'CF', 'RW', 'LW', 'CAM', 'LM', 'RM', 'EXT'].includes(op.tacticalRole || op.position) || op.position === 'ST'
          return isFwd && Math.abs(op.currentPOS[0] - anchor[0]) < 135
        })

        if (nearbyAttacker) {
          if (isTopTeam) {
            // Defendiendo arco Y=0: El defensor debe estar siempre más cerca de Y=0 que el atacante
            if (finalY >= nearbyAttacker.currentPOS[1] - 8) {
              finalY = Math.max(30, nearbyAttacker.currentPOS[1] - 12)
            }
          } else {
            // Defendiendo arco Y=pitchHeight: El defensor debe estar siempre más cerca de pitchHeight que el atacante
            if (finalY <= nearbyAttacker.currentPOS[1] + 8) {
              finalY = Math.min(pitchHeight - 30, nearbyAttacker.currentPOS[1] + 12)
            }
          }
        }
      }

      // 3. Temporización y Cierre del Carril Central ante delantero encarando con balón hacia el arco
      if (matchDetails.ball.Player && matchDetails.ball.withTeam === attackingTeam?.teamID) {
        const carrier = attackingTeam.players.find(p => p.playerID === matchDetails.ball.Player)
        if (carrier && common.isOnPitch(carrier)) {
          const carrierToGoalDistY = isTopTeam ? carrier.currentPOS[1] : (pitchHeight - carrier.currentPOS[1])
          const inCarrierCorridor = Math.abs(carrier.currentPOS[0] - finalX) < 75
          const carrierDist = common.distance(player.currentPOS, carrier.currentPOS)

          // Si el delantero viene al arco:
          // A distancia corta (<= 28px) o dentro de zona de peligro (< 220px del arco), el zaguero ACHICA y muerde
          if (carrierToGoalDistY < 330 && inCarrierCorridor) {
            if (carrierDist <= 28 || carrierToGoalDistY < 185) {
              finalX = carrier.currentPOS[0] * 0.75 + (pitchWidth / 2) * 0.25
              finalY = carrier.currentPOS[1] + goalDirY * 8
            } else if (carrierDist < 95) {
              finalX = carrier.currentPOS[0] * 0.70 + (pitchWidth / 2) * 0.30
              finalY = carrier.currentPOS[1] + goalDirY * 16
            }
          }
        }
      }

      player.intentPOS = [
        Math.max(25, Math.min(pitchWidth - 25, finalX)),
        isTopTeam ? Math.max(30, Math.min(pitchHeight - 30, finalY)) : Math.min(pitchHeight - 30, Math.max(30, finalY))
      ]
      continue
    }

    // D. HOLD ZONE general para volantes
    player.intentPOS = [anchor[0], anchor[1]]
  }
}

function computeOnsideLimitY(defendingTeam, isTopTeam, ballY, pitchHeight) {
  if (!defendingTeam || !Array.isArray(defendingTeam.players)) {
    return isTopTeam ? pitchHeight - 60 : 60
  }
  const outfieldY = defendingTeam.players
    .filter(p => common.isOnPitch(p) && p.position !== 'GK')
    .map(p => p.currentPOS[1])
  if (outfieldY.length === 0) return isTopTeam ? pitchHeight - 60 : 60

  if (isTopTeam) {
    const lastDefY = Math.max(...outfieldY)
    return Math.min(pitchHeight - 28, Math.max(lastDefY - 6, ballY))
  }
  const lastDefY = Math.min(...outfieldY)
  return Math.max(28, Math.min(lastDefY + 6, ballY))
}

function findOpenPocketX(preferredX, defendingTeam, targetY, pitchWidth) {
  if (!defendingTeam || !Array.isArray(defendingTeam.players)) return preferredX
  const candidates = [preferredX, preferredX - 38, preferredX + 38, preferredX - 70, preferredX + 70]
  let bestX = preferredX
  let bestClearance = -1
  for (const cx of candidates) {
    const clampedX = Math.max(38, Math.min(pitchWidth - 38, cx))
    let minOppDist = 999
    for (const opp of defendingTeam.players) {
      if (!common.isOnPitch(opp) || opp.position === 'GK') continue
      const d = common.distance([clampedX, targetY], opp.currentPOS)
      if (d < minOppDist) minOppDist = d
    }
    if (minOppDist > bestClearance) {
      bestClearance = minOppDist
      bestX = clampedX
    }
  }
  return bestX
}

export function setAttackRelativePos(matchDetails, kickingTeam, defendingTeam) {
  const { ball, pitchSize } = matchDetails
  const [pitchWidth, pitchHeight] = pitchSize
  const isTopTeam = kickingTeam.players[0].originPOS[1] < (pitchHeight / 2)
  const dir = isTopTeam ? 1 : -1
  const currentIter = matchDetails.iterationCount || 0
  const styleCfg = getPlayStyleConfig(kickingTeam.playStyle, kickingTeam.formation)
  const onsideLimitY = computeOnsideLimitY(defendingTeam, isTopTeam, ball.position[1], pitchHeight)

  const clampOnsideY = (rawY) => {
    if (isTopTeam) return Math.max(35, Math.min(onsideLimitY, rawY))
    return Math.min(pitchHeight - 35, Math.max(onsideLimitY, rawY))
  }

  const distBallToGoalY = isTopTeam ? (pitchHeight - ball.position[1]) : ball.position[1]
  const ballOnLeftWing = ball.position[0] < pitchWidth * 0.35
  const ballOnRightWing = ball.position[0] > pitchWidth * 0.65
  const isAttackingPhase = kickingTeam.gamePhase === 'Attack' || distBallToGoalY < 360
  const wingCrossSituation = distBallToGoalY < 320 && (ballOnLeftWing || ballOnRightWing)

  // 1. Construir Bloque Deslizante de Ataque (TeamShape)
  buildTeamShape(matchDetails, kickingTeam, true)
  const anchors = kickingTeam.teamShape?.anchors || {}

  // 2. Construir AttackPlan con Roles Exclusivos e Incumbency Bonus (BoxSlots + WidePlan)
  const attackPlan = assignAttackPlanWithIncumbency(kickingTeam, defendingTeam, matchDetails, isTopTeam, onsideLimitY)
  const boxSlots = attackPlan.boxSlots || {}
  const widePlan = attackPlan.widePlan || {}
  const slotGeom = getBoxSlotGeometry(matchDetails, isTopTeam, onsideLimitY)

  // 3. Identificar portador del balón
  const carrier = kickingTeam.players.find(p => p.hasBall) ||
    (matchDetails.ball.isPendingPass && matchDetails.ball.targetPlayerID
      ? kickingTeam.players.find(p => p.playerID === matchDetails.ball.targetPlayerID)
      : null)

  // 4. NearSupport (Apoyo cercano para descargar el juego)
  const availableAttackers = kickingTeam.players.filter(
    p => common.isOnPitch(p) && p.position !== 'GK' && p.playerID !== carrier?.playerID
  )
  let nearSupportPlayer = null
  let minSupportDist = 999
  if (carrier) {
    for (const p of availableAttackers) {
      const role = p.tacticalRole || p.position
      const isAssignedSlot = Object.values(boxSlots).includes(p.playerID)
      const isOverlapRunner = widePlan.overlapRunnerID === p.playerID
      if (['CM', 'CDM', 'LB', 'RB'].includes(role) && !isAssignedSlot && !isOverlapRunner) {
        const d = common.distance(p.currentPOS, carrier.currentPOS)
        if (d < minSupportDist && d > 20) {
          minSupportDist = d
          nearSupportPlayer = p
        }
      }
    }
  }

  // 5. RestDefence (defensa de reposo para custodiar la contra)
  const onLeftFlank = ball.position[0] < pitchWidth / 2
  const oppositeFullbackRole = onLeftFlank ? 'RB' : 'LB'
  const restDefencePlayers = availableAttackers.filter(p => {
    const role = p.tacticalRole || p.position
    // Solo los centrales hacen RestDefence obligatoria; el lateral opuesto solo si la mentalidad es defensiva
    const isOppositeFullbackResting = (kickingTeam?.mentality === 'defensive') && (role === oppositeFullbackRole)
    return role === 'CB' || role === 'DFC' || role === 'LÍBERO' || role === 'STOP I' || role === 'STOP D' || isOppositeFullbackResting
  })

  let activeDiagonalRunners = kickingTeam.players.filter(
    p => common.isOnPitch(p) && p.offBallRun && p.offBallRun.untilIteration > currentIter && p.offBallRun.type === 'diagonalInBehind'
  ).length

  // 6. Asignar intentPOS a cada jugador
  for (const player of kickingTeam.players) {
    if (!common.isOnPitch(player) || player.position === 'GK') continue
    if (player.hasBall) {
      player.offBallRun = null
      continue
    }

    if (ball.isPendingPass && ball.targetPlayerID === player.playerID && Array.isArray(ball.targetPOS)) {
      player.intentPOS = [...ball.targetPOS]
      continue
    }

    const anchor = anchors[player.playerID] || player.originPOS
    const role = player.tacticalRole || player.position
    const isWide = ['LM', 'RM', 'LB', 'RB'].includes(role)
    const hasTrait = (t) => Array.isArray(player.traits) && player.traits.includes(t)

    // A. ¿Ocupa un BoxSlot en situación de ataque o centro?
    let assignedSlotKey = null
    if (isAttackingPhase) {
      for (const [k, pid] of Object.entries(boxSlots)) {
        if (pid === player.playerID) {
          assignedSlotKey = k
          break
        }
      }
    }

    if (assignedSlotKey && slotGeom[assignedSlotKey]) {
      const geom = slotGeom[assignedSlotKey]
      // Wait Target vs Finish Target: si la pelota todavía está lejos de la zona de centro o definición,
      // esperan en la puerta del área (wait_target) para llegar en carrera y no en estático (open-football model)
      if (distBallToGoalY > 240 && !wingCrossSituation) {
        player.intentPOS = [geom.wait[0], geom.wait[1]]
      } else {
        // En fase de definición rompen hacia su punto de remate (finish_target)
        player.offBallRun = {
          type: 'boxSlotEntry',
          slot: assignedSlotKey,
          targetX: geom.finish[0],
          targetY: geom.finish[1],
          untilIteration: currentIter + 6
        }
        player.intentPOS = [geom.finish[0], geom.finish[1]]
      }
      continue
    }

    // B. WidePlan: Overlap Runner (lateral desdoblando por la banda hacia el fondo)
    if (widePlan.active && widePlan.overlapRunnerID === player.playerID) {
      const isBallFlankLeft = widePlan.ballFlank === 'left'
      const flankX = isBallFlankLeft ? 38 : (pitchWidth - 38)
      const targetDepth = distBallToGoalY < 260 ? 85 : Math.max(120, distBallToGoalY - 60)
      const rawFlankY = isTopTeam ? (pitchHeight - targetDepth) : targetDepth
      const flankY = clampOnsideY(rawFlankY)
      player.offBallRun = {
        type: 'overlapFlank',
        targetX: flankX,
        targetY: flankY,
        untilIteration: currentIter + 14
      }
      player.intentPOS = [flankX, flankY]
      continue
    }

    // C. WidePlan: Touchline Holder (si el lateral de su banda desdobla por fuera, el extremo se cierra al carril interior)
    if (widePlan.active && (widePlan.leftHolderID === player.playerID || widePlan.rightHolderID === player.playerID)) {
      const isLeft = widePlan.leftHolderID === player.playerID
      const isSameFlankOverlapping = Boolean(
        widePlan.overlapRunnerID &&
        ((isLeft && widePlan.ballFlank === 'left') || (!isLeft && widePlan.ballFlank === 'right'))
      )
      const targetX = isSameFlankOverlapping
        ? (isLeft ? 115 : (pitchWidth - 115)) // Deja el carril externo al lateral y ocupa el half-space
        : (isLeft ? 40 : (pitchWidth - 40)) // Fija amplitud contra la raya
      const advancedY = isTopTeam ? Math.max(anchor[1], ball.position[1] - 30) : Math.min(anchor[1], ball.position[1] + 30)
      const holderY = clampOnsideY(isAttackingPhase ? advancedY : anchor[1])
      player.intentPOS = [targetX, holderY]
      continue
    }

    // C.2 En tácticas abiertas (wingPlay), ambos extremos preservan su pegada a la cal mientras se gesta la jugada
    const isWingPlay = kickingTeam?.playStyle === 'wingPlay'
    if (isAttackingPhase && isWingPlay && (role === 'LM' || role === 'RM' || role === 'EXT') && distBallToGoalY > 165) {
      const isLeft = role === 'LM' || (role === 'EXT' && anchor[0] < pitchWidth / 2)
      const touchlineX = isLeft ? 42 : (pitchWidth - 42)
      const holderY = clampOnsideY(anchor[1])
      player.intentPOS = [touchlineX, holderY]
      continue
    }

    // D. NearSupport: posicionarse de apoyo unos 30-45px detrás de la pelota
    if (nearSupportPlayer && nearSupportPlayer.playerID === player.playerID && carrier) {
      const supportX = Math.max(40, Math.min(pitchWidth - 40, carrier.currentPOS[0] + (carrier.currentPOS[0] < pitchWidth / 2 ? 18 : -18)))
      const supportY = clampOnsideY(carrier.currentPOS[1] - dir * 35)
      player.intentPOS = [supportX, supportY]
      continue
    }

    // E. RestDefence: mantener ancla compacta dentro del TeamShape
    if (restDefencePlayers.some(rp => rp.playerID === player.playerID)) {
      player.intentPOS = [anchor[0], anchor[1]]
      continue
    }

    // F. Mantener desmarques activos previos
    if (player.offBallRun && player.offBallRun.untilIteration > currentIter) {
      const safeRunY = clampOnsideY(player.offBallRun.targetY)
      player.intentPOS = [player.offBallRun.targetX, safeRunY]
      continue
    }
    player.offBallRun = null

    // G. Evaluar inicio de un nuevo Desmarque Dinámico complementario (Off-Ball Run)
    const roll = common.getRandomNumber(1, 100)
    const diagonalChance = Math.round(14 * (styleCfg.throughBoost || 1.1))
    const overlapChance = isWide ? Math.round(34 * (styleCfg.switchBoost || 1.15)) : Math.round(16 * (styleCfg.switchBoost || 1.1))
    const showChance = styleCfg.id === 'tikiTaka' ? 22 : 13

    const isOffensiveShooterFullback = ['LB', 'RB', 'LWB', 'RWB'].includes(role) && (Number(player.skill?.shooting || 60) >= 70 || hasTrait('canonero_media_distancia') || hasTrait('lanzador_canonero'))
    if (isOffensiveShooterFullback && roll <= 28 && distBallToGoalY < 420 && distBallToGoalY > 160) {
      const edgeCutX = anchor[0] < pitchWidth / 2 ? common.getRandomNumber(210, 290) : common.getRandomNumber(pitchWidth - 290, pitchWidth - 210)
      const edgeDist = dir * common.getRandomNumber(60, 130)
      const edgeCutY = clampOnsideY(ball.position[1] + edgeDist)
      player.offBallRun = {
        type: 'diagonalCutInside',
        targetX: edgeCutX,
        targetY: edgeCutY,
        untilIteration: currentIter + common.getRandomNumber(10, 16)
      }
      player.intentPOS = [edgeCutX, edgeCutY]
      continue
    }

    if ((role === 'ST' || role === 'EXT' || role === 'LM' || role === 'RM') && activeDiagonalRunners < 2 && roll <= diagonalChance) {
      const rawDeepY = isTopTeam ? Math.max(anchor[1] + 75, onsideLimitY - 4) : Math.min(anchor[1] - 75, onsideLimitY + 4)
      const runTargetY = clampOnsideY(rawDeepY)
      const preferredX = (role === 'ST' || role === 'EXT')
        ? findOpenPocketX(anchor[0], defendingTeam, runTargetY, pitchWidth)
        : (anchor[0] < pitchWidth / 2 ? common.getRandomNumber(115, 220) : common.getRandomNumber(pitchWidth - 220, pitchWidth - 115))
      player.offBallRun = {
        type: 'diagonalInBehind',
        targetX: preferredX,
        targetY: runTargetY,
        untilIteration: currentIter + common.getRandomNumber(10, 15)
      }
      activeDiagonalRunners++
      player.intentPOS = [preferredX, runTargetY]
      continue
    }

    if (isWide && roll > diagonalChance && roll <= (diagonalChance + overlapChance)) {
      const flankX = anchor[0] < pitchWidth / 2 ? common.getRandomNumber(38, 65) : common.getRandomNumber(pitchWidth - 65, pitchWidth - 38)
      const advanceFromBall = dir * common.getRandomNumber(110, 200)
      const flankY = clampOnsideY(ball.position[1] + advanceFromBall)
      player.offBallRun = {
        type: 'overlapFlank',
        targetX: flankX,
        targetY: flankY,
        untilIteration: currentIter + common.getRandomNumber(12, 18)
      }
      player.intentPOS = [flankX, flankY]
      continue
    }

    if ((role === 'CAM' || role === 'CM' || role === 'CDM') && roll > (diagonalChance + overlapChance) && roll <= (diagonalChance + overlapChance + showChance)) {
      const supportY = clampOnsideY(ball.position[1] + dir * common.getRandomNumber(55, 115))
      const pocketX = findOpenPocketX(anchor[0], defendingTeam, supportY, pitchWidth)
      player.offBallRun = {
        type: 'showBetweenLines',
        targetX: pocketX,
        targetY: supportY,
        untilIteration: currentIter + common.getRandomNumber(8, 12)
      }
      player.intentPOS = [pocketX, supportY]
      continue
    }

    // Por defecto: posicionado en su ancla del bloque deslizante TeamShape
    player.intentPOS = [anchor[0], anchor[1]]
  }
}
