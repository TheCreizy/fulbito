import * as common from './common.js'
import { getEffectiveSkill, hasTrait } from './player/effectiveSkill.js'
import { BALL_PHYSICS } from './ball/ballPhysics.js'

export function isDefenderRole(role) {
  return ['CB', 'LB', 'RB', 'LWB', 'RWB', 'DFC', 'LÍBERO', 'STOP I', 'STOP D', 'LI', 'LD'].includes(role)
}

export function isMidfieldRole(role) {
  return ['CM', 'LM', 'RM', 'CDM', 'CAM', '5 REC', '8 MIX', 'VOL I', 'VOL D', '5 TAPÓN', 'ENG (10)', 'MI', 'MD'].includes(role)
}

export function getPenaltyAreaPosition(matchDetails, isTop) {
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  const minX = 195
  const maxX = pitchWidth - 195 // 485
  const x = common.getRandomNumber(minX, maxX)
  const y = isTop
    ? common.getRandomNumber(55, 145)
    : common.getRandomNumber(pitchHeight - 145, pitchHeight - 55)
  return [x, y]
}

/**
 * Genera un conjunto de posiciones separadas dentro del área penal, garantizando
 * al menos 20px de distancia física entre defensores para evitar amontonamientos.
 */
export function getSpacedPenaltyPositions(matchDetails, isTop, count) {
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  const minX = 205
  const maxX = pitchWidth - 205 // 475
  const minY = isTop ? 65 : (pitchHeight - 145)
  const maxY = isTop ? 145 : (pitchHeight - 65)

  const positions = []
  for (let i = 0; i < count; i++) {
    let placed = false
    for (let attempt = 0; attempt < 35; attempt++) {
      const rx = common.getRandomNumber(minX, maxX)
      const ry = common.getRandomNumber(minY, maxY)
      const tooClose = positions.some(pos => Math.hypot(pos[0] - rx, pos[1] - ry) < 22)
      if (!tooClose) {
        positions.push([rx, ry])
        placed = true
        break
      }
    }
    if (!placed) {
      const col = i % 4
      const row = Math.floor(i / 4)
      const gx = minX + col * 68
      const gy = minY + row * 32
      positions.push([gx, gy])
    }
  }
  return positions
}

export function selectFreekickTaker(team, allowGoalie = false) {
  const active = team.players.filter(p => common.isOnPitch(p) && (allowGoalie || p.position !== 'GK'))
  if (active.length === 0) return team.players.find(common.isOnPitch) || team.players[0]

  const preferredID = team.setPieces?.freekickTakerID
  if (preferredID) {
    const designated = active.find(p => p.id === preferredID || p.playerID === preferredID)
    if (designated) return designated
  }

  const sorted = [...active].sort((a, b) => (b.skill.freekick || b.skill.shooting) - (a.skill.freekick || a.skill.shooting))
  return sorted[0]
}

/**
 * Selección de ejecutor según zona de la falta:
 * 1. Área propia / área chica: Saca el arquero (GK).
 * 2. Detrás de mitad de cancha: Saca un defensor (CB, LB, RB).
 * 3. De mitad de cancha hacia adelante: Saca el especialista asignado.
 */
export function selectFreekickTakerByZone(team, ballPos, pitchHeight) {
  const isTop = team.players[0].originPOS[1] < (pitchHeight / 2)
  const inOwnGoalArea = isTop ? (ballPos[1] <= 165) : (ballPos[1] >= pitchHeight - 165)
  const inOwnHalf = isTop ? (ballPos[1] < pitchHeight / 2) : (ballPos[1] > pitchHeight / 2)

  // 1. Falta dentro del área del arquero: saca el arquero
  if (inOwnGoalArea) {
    const gk = team.players.find(p => p.position === 'GK' && common.isOnPitch(p))
    if (gk) return gk
  }

  // 2. Detrás de la mitad de la cancha: saca un defensor
  if (inOwnHalf) {
    const defenders = team.players.filter(p => (
      common.isOnPitch(p) &&
      p.position !== 'GK' &&
      ['CB', 'LB', 'RB', 'DFC', 'LI', 'LD', 'LÍBERO', 'STOP I', 'STOP D'].includes(p.position || p.tacticalRole)
    ))
    if (defenders.length > 0) {
      defenders.sort((a, b) => (
        ((b.skill?.passing || 70) + (b.skill?.strength || 70)) -
        ((a.skill?.passing || 70) + (a.skill?.strength || 70))
      ))
      return defenders[0]
    }
  }

  // 3. De mitad de cancha para adelante: especialista asignado
  return selectFreekickTaker(team)
}

/**
 * Aplica la táctica completa de tiro libre según zona, atributos y plan táctico.
 * Integra las opciones tácticas en campo propio y ofensivo, barrera defensiva de Open Football
 * y la jugada de distracción/pantalla.
 */
export function applyFreekickTactics(matchDetails, attack, defence, kickPlayer, isTopAttacking) {
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  const ballPos = matchDetails.ball.position
  const targetGoal = isTopAttacking ? [pitchWidth / 2, pitchHeight] : [pitchWidth / 2, 0]
  const distToGoal = common.distance(ballPos, targetGoal)
  const lateralOffset = Math.abs(ballPos[0] - pitchWidth / 2)
  const isFrontal = lateralOffset <= 170

  const isOwnHalf = isTopAttacking ? (ballPos[1] < pitchHeight / 2) : (ballPos[1] > pitchHeight / 2)
  const inOwnBox = isTopAttacking ? (ballPos[1] <= 165) : (ballPos[1] >= pitchHeight - 165)

  matchDetails.ball.isRestart = true
  matchDetails.ball.defendingWall = null
  matchDetails.ball.decoyRunner = null

  const pPassing = Number(kickPlayer.skill?.passing || 70)
  const pPerception = Number(kickPlayer.skill?.perception || 70)
  const pStrength = Number(kickPlayer.skill?.strength || 70)
  const fkSkill = Number(kickPlayer.skill?.freekick || kickPlayer.skill?.shooting || 70)
  const isSpecialist = fkSkill >= 84 || (Array.isArray(kickPlayer.traits) && kickPlayer.traits.includes('lanzador_canonero'))

  // ─────────────────────────────────────────────────────────────────────────────
  // A. FALTA EN CAMPO PROPIO O DENTRO DEL ÁREA DEFENSIVA
  // ─────────────────────────────────────────────────────────────────────────────
  if (inOwnBox || isOwnHalf) {
    // 3 Opciones para el pateador:
    // a) Pase corto a un compañero
    // b) Cambio de frente largo al lateral opuesto
    // c) Pelotazo largo hacia delanteros/extremos

    const canSwitch = pPerception >= 74 && pPassing >= 74
    const roll = common.getRandomNumber(1, 100)

    if (canSwitch && roll <= 28) {
      // Opción b: Cambio de frente
      kickPlayer.action = 'throughBall'
      matchDetails.ball.kickType = 'switch'
      matchDetails.ball.isSwitchOfPlay = true
      matchDetails.iterationLog.push(`Freekick Switch of Play by ${kickPlayer.name} to the opposite flank`)
    } else if (pStrength >= 74 && roll <= 62) {
      // Opción c: Pelotazo largo dirigido hacia los delanteros/extremos
      kickPlayer.action = 'throughBall'
      matchDetails.ball.kickType = 'pass'
      matchDetails.iterationLog.push(`Freekick Long Ball launched forward by ${kickPlayer.name}`)
    } else {
      // Opción a: Pase corto de salida segura
      kickPlayer.action = 'pass'
      matchDetails.ball.kickType = 'pass'
      matchDetails.iterationLog.push(`Freekick Short Pass played by ${kickPlayer.name} to build from the back`)
    }
    return
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // B. FALTA EN CAMPO CONTRARIO (DE MITAD DE CANCHA HACIA ADELANTE)
  // ─────────────────────────────────────────────────────────────────────────────
  const isIndirect = Boolean(matchDetails.ball.isIndirect)

  // 1. Subida de centrales (CBs) a cabecear al área rival (< 420px del arco rival)
  if (distToGoal <= 420) {
    const cbs = attack.players.filter(p => (
      common.isOnPitch(p) &&
      p.playerID !== kickPlayer.playerID &&
      (p.position === 'CB' || p.tacticalRole === 'CB' || p.tacticalRole === 'DFC' || p.tacticalRole === 'LÍBERO' || p.tacticalRole === 'STOP I' || p.tacticalRole === 'STOP D')
    ))
    cbs.sort((a, b) => ((b.skill.jumping || 0) + (Number(b.height) || 180)) - ((a.skill.jumping || 0) + (Number(a.height) || 180)))
    const headingCBs = cbs.slice(0, 2)
    for (const cb of headingCBs) {
      cb.currentPOS = getPenaltyAreaPosition(matchDetails, !isTopAttacking)
      cb.intentPOS = cb.currentPOS.slice()
      matchDetails.iterationLog.push(`CB Header run by: ${cb.name}`)
    }
  }

  // 2. Evaluar jugada de distracción/pantalla (Opción h):
  // Un compañero corre y salta por encima de la pelota sin tocarla para descolocar al arquero y barrera
  const tryDecoy = !isIndirect && distToGoal <= 310 && common.getRandomNumber(1, 100) <= 15
  if (tryDecoy) {
    const decoyCandidate = attack.players.find(p => (
      common.isOnPitch(p) &&
      p.playerID !== kickPlayer.playerID &&
      p.position !== 'GK' &&
      common.distance(p.currentPOS, ballPos) <= 160
    ))
    if (decoyCandidate) {
      matchDetails.ball.decoyRunner = {
        playerID: decoyCandidate.playerID,
        name: decoyCandidate.name
      }
      matchDetails.iterationLog.push(`★ Jugada de distracción: ${decoyCandidate.name} corre y salta sobre la pelota para engañar a la barrera!`)
    }
  }

  // 4. Toma de decisiones del ejecutante (Opciones a-g)
  const canDirectShot = !isIndirect && ((distToGoal <= 265 && isFrontal) || (isSpecialist && distToGoal <= 325 && lateralOffset <= 190))

  if (canDirectShot && (common.getRandomNumber(1, 100) <= 68 || isSpecialist)) {
    // Opción a: Tiro directo al arco
    kickPlayer.action = 'freekickShot'
    matchDetails.ball.kickType = 'freekick'
    matchDetails.iterationLog.push(`Dangerous Direct Freekick for ${attack.name} - Taker: ${kickPlayer.name}`)
  } else if (distToGoal <= 420) {
    // Variantes de centros y jugadas elaboradas en zona de 3/4
    const roll = common.getRandomNumber(1, 100)

    // Buscar compañeros disponibles para jugadas preparadas
    const wideMate = attack.players.find(p => (
      common.isOnPitch(p) &&
      p.playerID !== kickPlayer.playerID &&
      p.position !== 'GK' &&
      Math.abs(p.currentPOS[0] - ballPos[0]) > 45 &&
      common.distance(p.currentPOS, ballPos) <= 150
    ))

    const edgeMate = attack.players.find(p => (
      common.isOnPitch(p) &&
      p.playerID !== kickPlayer.playerID &&
      p.position !== 'GK' &&
      common.distance(p.currentPOS, targetGoal) <= 240 &&
      common.distance(p.currentPOS, ballPos) <= 130
    ))

    if (wideMate && roll <= 18) {
      // Opción c: Tocársela a un compañero abierto para que tire un centro
      kickPlayer.action = 'pass'
      matchDetails.ball.isLayoffCross = true
      matchDetails.iterationLog.push(`Freekick Layoff: ${kickPlayer.name} opens play to ${wideMate.name} for an angled cross!`)
    } else if (edgeMate && (edgeMate.skill?.shooting || 65) >= 76 && roll <= 34) {
      // Opción d: Tocársela a un compañero para que patee desde lejos
      kickPlayer.action = 'pass'
      matchDetails.ball.isLayoffShot = true
      matchDetails.iterationLog.push(`Freekick Layoff: ${kickPlayer.name} rolls it back to ${edgeMate.name} for a long-distance strike!`)
    } else if (pPerception >= 78 && roll <= 46) {
      // Opción e: Intentar pase filtrado directo al área si ve un hueco
      kickPlayer.action = 'throughBall'
      matchDetails.iterationLog.push(`Freekick Through Ball: ${kickPlayer.name} threads a penetrating pass into the box!`)
    } else if (roll <= 58) {
      // Opción g: Pared con un compañero cercano y tiro
      kickPlayer.action = 'pass'
      matchDetails.ball.isGiveAndGo = true
      matchDetails.iterationLog.push(`Freekick Wall Pass: ${kickPlayer.name} initiates a quick one-two to shoot!`)
    } else if (roll <= 70) {
      // Opción f: Simplemente pasársela al jugador más cercano
      kickPlayer.action = 'pass'
      matchDetails.iterationLog.push(`Freekick Short Option: ${kickPlayer.name} plays a simple pass to keep possession.`)
    } else {
      // Opción b: Tirar centro al área (al primer palo, segundo palo o corazón del área)
      kickPlayer.action = 'cross'
      matchDetails.ball.kickType = 'cross'
      const crossVariants = ['near_post', 'far_post', 'penalty_spot']
      matchDetails.ball.crossTargetZone = crossVariants[common.getRandomNumber(0, 2)]
      matchDetails.iterationLog.push(`Crossing Freekick (${matchDetails.ball.crossTargetZone}) for ${attack.name} - Taker: ${kickPlayer.name}`)
    }
  } else {
    kickPlayer.action = 'pass'
    matchDetails.ball.kickType = 'pass'
  }

  // 5. Configurar Barrera Defensiva (siempre al final para no ser pisada)
  if (distToGoal <= 340 && distToGoal >= 90) {
    setupDefendingWall(matchDetails, defence, ballPos, targetGoal, distToGoal, lateralOffset > 150)
  }
}

/**
 * Configuración física de la barrera defensiva (Open Football RestartShape):
 * Se ubica a 65px (distancia reglamentaria de 9.15m) sobre la línea de tiro balón-arco.
 */
function setupDefendingWall(matchDetails, defence, ballPos, targetGoal, distToGoal, isWideAngle) {
  const [pitchWidth] = matchDetails.pitchSize
  const centreGoal = [pitchWidth / 2, targetGoal[1]]
  const goalDist = common.distance(ballPos, centreGoal)
  const dirX = (centreGoal[0] - ballPos[0]) / Math.max(1, goalDist)
  const dirY = (centreGoal[1] - ballPos[1]) / Math.max(1, goalDist)
  const perpX = -dirY
  const perpY = dirX

  const wallDist = 65 // 9.15m en escala de cancha
  const wallCenterX = ballPos[0] + dirX * wallDist
  const wallCenterY = ballPos[1] + dirY * wallDist

  // Seleccionar los mejores defensores altos / de marca para la barrera
  const defCandidates = defence.players.filter(p => common.isOnPitch(p) && p.position !== 'GK')
  defCandidates.sort((a, b) => (
    ((b.skill?.jumping || 70) + (Number(b.height) || 180) + (b.skill?.tackling || 70)) -
    ((a.skill?.jumping || 70) + (Number(a.height) || 180) + (a.skill?.tackling || 70))
  ))

  const wallSize = common.getWallSize(distToGoal, isWideAngle)
  const wallPlayers = defCandidates.slice(0, wallSize)
  matchDetails.ball.defendingWall = wallPlayers

  const halfSpread = (wallSize - 1) / 2
  wallPlayers.forEach((p, idx) => {
    const offset = (idx - halfSpread) * 11 // Espaciado hombro con hombro
    const wx = Math.round(wallCenterX + perpX * offset)
    const wy = Math.round(wallCenterY + perpY * offset)
    p.currentPOS = [wx, wy]
    p.intentPOS = [wx, wy]
  })
}

export function setTopFreekick(matchDetails) {
  common.removeBallFromAllPlayers(matchDetails)
  matchDetails.ball.ballOverIterations = []
  const { kickOffTeam, secondTeam } = matchDetails
  const [, pitchHeight] = matchDetails.pitchSize
  const [, ballY] = matchDetails.ball.position
  const attack = (kickOffTeam.players[0].originPOS[1] < pitchHeight / 2) ? kickOffTeam : secondTeam
  const defence = (kickOffTeam.players[0].originPOS[1] < pitchHeight / 2) ? secondTeam : kickOffTeam

  const kickPlayer = selectFreekickTakerByZone(attack, matchDetails.ball.position, pitchHeight)

  const hundredToHalfway = common.isBetween(ballY, 100, (pitchHeight / 2) + 1)
  const halfwayToLastQtr = common.isBetween(ballY, pitchHeight / 2, pitchHeight - (pitchHeight / 4))
  const upperFinalQtr = common.isBetween(ballY, pitchHeight - (pitchHeight / 4), pitchHeight - (pitchHeight / 6) - 5)
  const lowerFinalQtr = common.isBetween(ballY, pitchHeight - (pitchHeight / 6) - 5, pitchHeight + 1)

  let result
  if (ballY <= 100) result = setTopOneHundredYPos(matchDetails, attack, defence, kickPlayer)
  else if (hundredToHalfway) result = setTopOneHundredToHalfwayYPos(matchDetails, attack, defence, kickPlayer)
  else if (halfwayToLastQtr) result = setTopHalfwayToBottomQtrYPos(matchDetails, attack, defence, kickPlayer)
  else if (upperFinalQtr) result = setTopBottomQtrCentreYPos(matchDetails, attack, defence, kickPlayer)
  else if (lowerFinalQtr) result = setTopLowerFinalQtrBylinePos(matchDetails, attack, defence, kickPlayer)
  else result = setTopHalfwayToBottomQtrYPos(matchDetails, attack, defence, kickPlayer)

  applyFreekickTactics(matchDetails, attack, defence, kickPlayer, true)
  return result
}

export function setBottomFreekick(matchDetails) {
  common.removeBallFromAllPlayers(matchDetails)
  matchDetails.ball.ballOverIterations = []
  const { kickOffTeam, secondTeam } = matchDetails
  const [, pitchHeight] = matchDetails.pitchSize
  const [, ballY] = matchDetails.ball.position
  const attack = (kickOffTeam.players[0].originPOS[1] > pitchHeight / 2) ? kickOffTeam : secondTeam
  const defence = (kickOffTeam.players[0].originPOS[1] > pitchHeight / 2) ? secondTeam : kickOffTeam

  const kickPlayer = selectFreekickTakerByZone(attack, matchDetails.ball.position, pitchHeight)

  const hundredToHalfway = common.isBetween(ballY, (pitchHeight / 2) - 1, pitchHeight - 100)
  const halfwayToLastQtr = common.isBetween(ballY, pitchHeight / 4, pitchHeight / 2)
  const upperFinalQtr = common.isBetween(ballY, (pitchHeight / 6) - 5, pitchHeight / 4)
  const lowerFinalQtr = common.isBetween(ballY, -1, (pitchHeight / 6) - 5)

  let result
  if (ballY >= pitchHeight - 100) result = setBottomOneHundredYPos(matchDetails, attack, defence, kickPlayer)
  else if (hundredToHalfway) result = setBottomOneHundredToHalfwayYPos(matchDetails, attack, defence, kickPlayer)
  else if (halfwayToLastQtr) result = setBottomHalfwayToTopQtrYPos(matchDetails, attack, defence, kickPlayer)
  else if (upperFinalQtr) result = setBottomUpperQtrCentreYPos(matchDetails, attack, defence, kickPlayer)
  else if (lowerFinalQtr) result = setBottomLowerFinalQtrBylinePos(matchDetails, attack, defence, kickPlayer)
  else result = setBottomHalfwayToTopQtrYPos(matchDetails, attack, defence, kickPlayer)

  applyFreekickTactics(matchDetails, attack, defence, kickPlayer, false)
  return result
}

function setTopOneHundredYPos(matchDetails, attack, defence, kickPlayer) {
  kickPlayer.hasBall = true
  matchDetails.ball.lastTouch.deflection = false
  const { ball } = matchDetails
  ball.lastTouch.playerName = kickPlayer.name
  ball.lastTouch.playerID = kickPlayer.playerID
  ball.lastTouch.teamID = attack.teamID
  ball.Player = kickPlayer.playerID
  ball.withPlayer = true
  ball.withTeam = attack.teamID
  ball.direction = 'south'
  for (const player of attack.players) {
    if (!common.isOnPitch(player)) continue
    if (player.playerID === kickPlayer.playerID) {
      player.currentPOS = [ball.position[0], ball.position[1]]
      player.intentPOS = player.currentPOS.slice()
    } else {
      player.currentPOS = player.originPOS.slice()
      player.intentPOS = player.originPOS.slice()
    }
  }
  for (const player of defence.players) {
    if (!common.isOnPitch(player)) continue
    if (player.position === 'GK') {
      player.currentPOS = player.originPOS.slice()
      player.intentPOS = player.originPOS.slice()
    } else {
      player.currentPOS = [player.originPOS[0], common.upToMin(player.originPOS[1] - 100, 0)]
      player.intentPOS = player.currentPOS.slice()
    }
  }
  matchDetails.endIteration = true
  return matchDetails
}

function setBottomOneHundredYPos(matchDetails, attack, defence, kickPlayer) {
  kickPlayer.hasBall = true
  matchDetails.ball.lastTouch.deflection = false
  const { ball, pitchSize } = matchDetails
  const [, pitchHeight] = pitchSize
  ball.lastTouch.playerName = kickPlayer.name
  ball.lastTouch.playerID = kickPlayer.playerID
  ball.lastTouch.teamID = attack.teamID
  ball.Player = kickPlayer.playerID
  ball.withPlayer = true
  ball.withTeam = attack.teamID
  ball.direction = 'north'
  for (const player of attack.players) {
    if (!common.isOnPitch(player)) continue
    if (player.playerID === kickPlayer.playerID) {
      player.currentPOS = [ball.position[0], ball.position[1]]
      player.intentPOS = player.currentPOS.slice()
    } else {
      player.currentPOS = player.originPOS.slice()
      player.intentPOS = player.originPOS.slice()
    }
  }
  for (const player of defence.players) {
    if (!common.isOnPitch(player)) continue
    if (player.position === 'GK') {
      player.currentPOS = player.originPOS.slice()
      player.intentPOS = player.originPOS.slice()
    } else {
      player.currentPOS = [player.originPOS[0], common.upToMax(player.originPOS[1] + 100, pitchHeight)]
      player.intentPOS = player.currentPOS.slice()
    }
  }
  matchDetails.endIteration = true
  return matchDetails
}

function setTopOneHundredToHalfwayYPos(matchDetails, attack, defence, kickPlayer) {
  const { ball } = matchDetails
  const [, pitchHeight] = matchDetails.pitchSize

  kickPlayer.hasBall = true
  ball.lastTouch.playerName = kickPlayer.name
  ball.lastTouch.playerID = kickPlayer.playerID
  ball.lastTouch.teamID = attack.teamID
  ball.lastTouch.deflection = false
  ball.Player = kickPlayer.playerID
  ball.withPlayer = true
  ball.withTeam = attack.teamID
  ball.direction = 'south'

  for (const player of attack.players) {
    if (!common.isOnPitch(player)) continue
    if (player.playerID === kickPlayer.playerID) {
      player.currentPOS = [ball.position[0], ball.position[1]]
    } else if (player.position === 'GK') {
      player.currentPOS = player.originPOS.slice()
    } else if (isDefenderRole(player.tacticalRole || player.position)) {
      const newYPOS = player.originPOS[1] + (ball.position[1] - player.originPOS[1]) + 200
      player.currentPOS = [player.originPOS[0], parseInt(common.upToMax(newYPOS, pitchHeight * 0.5), 10)]
    } else if (isMidfieldRole(player.tacticalRole || player.position)) {
      const newYPOS = player.originPOS[1] + (ball.position[1] - player.originPOS[1]) + 250
      player.currentPOS = [player.originPOS[0], parseInt(common.upToMax(newYPOS, pitchHeight * 0.75), 10)]
    } else {
      const newYPOS = player.originPOS[1] + (ball.position[1] - player.originPOS[1]) + 300
      player.currentPOS = [player.originPOS[0], parseInt(common.upToMax(newYPOS, pitchHeight * 0.9), 10)]
    }
    player.intentPOS = player.currentPOS.slice()
  }
  for (const player of defence.players) {
    if (!common.isOnPitch(player)) continue
    if (['GK'].includes(player.position) || isDefenderRole(player.tacticalRole || player.position)) player.currentPOS = player.originPOS.slice()
    else if (isMidfieldRole(player.tacticalRole || player.position)) {
      player.currentPOS = [player.originPOS[0], parseInt((pitchHeight * 0.75) + 5, 10)]
    } else {
      player.currentPOS = [player.originPOS[0], parseInt(pitchHeight * 0.5, 10)]
    }
    player.intentPOS = player.currentPOS.slice()
  }
  matchDetails.endIteration = true
  return matchDetails
}

function setBottomOneHundredToHalfwayYPos(matchDetails, attack, defence, kickPlayer) {
  const { ball } = matchDetails
  const [, pitchHeight] = matchDetails.pitchSize

  kickPlayer.hasBall = true
  ball.lastTouch.playerName = kickPlayer.name
  ball.lastTouch.playerID = kickPlayer.playerID
  ball.lastTouch.teamID = attack.teamID
  ball.lastTouch.deflection = false
  ball.Player = kickPlayer.playerID
  ball.withPlayer = true
  ball.withTeam = attack.teamID
  ball.direction = 'north'

  for (const player of attack.players) {
    if (!common.isOnPitch(player)) continue
    if (player.playerID === kickPlayer.playerID) {
      player.currentPOS = [ball.position[0], ball.position[1]]
    } else if (player.position === 'GK') {
      player.currentPOS = player.originPOS.slice()
    } else if (isDefenderRole(player.tacticalRole || player.position)) {
      const newYPOS = player.originPOS[1] + (ball.position[1] - player.originPOS[1]) - 200
      player.currentPOS = [player.originPOS[0], parseInt(common.upToMin(newYPOS, pitchHeight * 0.5), 10)]
    } else if (isMidfieldRole(player.tacticalRole || player.position)) {
      const newYPOS = player.originPOS[1] + (ball.position[1] - player.originPOS[1]) - 250
      player.currentPOS = [player.originPOS[0], parseInt(common.upToMin(newYPOS, pitchHeight * 0.25), 10)]
    } else {
      const newYPOS = player.originPOS[1] + (ball.position[1] - player.originPOS[1]) - 300
      player.currentPOS = [player.originPOS[0], parseInt(common.upToMin(newYPOS, pitchHeight * 0.1), 10)]
    }
    player.intentPOS = player.currentPOS.slice()
  }
  for (const player of defence.players) {
    if (!common.isOnPitch(player)) continue
    if (['GK'].includes(player.position) || isDefenderRole(player.tacticalRole || player.position)) player.currentPOS = player.originPOS.slice()
    else if (isMidfieldRole(player.tacticalRole || player.position)) {
      player.currentPOS = [player.originPOS[0], parseInt((pitchHeight * 0.25) - 5, 10)]
    } else {
      player.currentPOS = [player.originPOS[0], parseInt(pitchHeight * 0.5, 10)]
    }
    player.intentPOS = player.currentPOS.slice()
  }
  matchDetails.endIteration = true
  return matchDetails
}

function setTopHalfwayToBottomQtrYPos(matchDetails, attack, defence, kickPlayer) {
  const { ball } = matchDetails
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  kickPlayer.hasBall = true
  ball.lastTouch.playerName = kickPlayer.name
  ball.lastTouch.playerID = kickPlayer.playerID
  ball.lastTouch.teamID = attack.teamID
  ball.lastTouch.deflection = false
  ball.Player = kickPlayer.playerID
  ball.withPlayer = true
  ball.withTeam = attack.teamID
  const ballInCentre = common.isBetween(ball.position[0], (pitchWidth / 4) + 5, (pitchWidth - (pitchWidth / 4) - 5))
  const ballLeft = common.isBetween(ball.position[0], 0, (pitchWidth / 4) + 4)
  ball.direction = ballInCentre ? 'south' : (ballLeft ? 'southeast' : 'southwest')
  kickPlayer.currentPOS = [ball.position[0], ball.position[1]]
  kickPlayer.intentPOS = kickPlayer.currentPOS.slice()

  for (const player of attack.players) {
    if (!common.isOnPitch(player)) continue
    if (player.playerID === kickPlayer.playerID) continue
    if (player.position === 'GK') player.currentPOS = [player.originPOS[0], parseInt(pitchHeight * 0.2, 10)]
    else if (isDefenderRole(player.tacticalRole || player.position)) {
      const maxYPOSCheck = parseInt(common.upToMax(ball.position[1] - 100, pitchHeight * 0.5), 10)
      player.currentPOS = [player.originPOS[0], maxYPOSCheck]
    } else if (isMidfieldRole(player.tacticalRole || player.position)) {
      const maxYPOSCheck = common.upToMax(ball.position[1] + common.getRandomNumber(150, 300), pitchHeight * 0.75)
      player.currentPOS = [player.originPOS[0], parseInt(maxYPOSCheck, 10)]
    } else {
      const maxYPOSCheck = common.upToMax(ball.position[1] + common.getRandomNumber(300, 400), pitchHeight * 0.9)
      player.currentPOS = [player.originPOS[0], parseInt(maxYPOSCheck, 10)]
    }
    player.intentPOS = player.currentPOS.slice()
  }
  for (const player of defence.players) {
    if (!common.isOnPitch(player)) continue
    if (['GK'].includes(player.position) || isDefenderRole(player.tacticalRole || player.position)) {
      player.currentPOS = player.originPOS.slice()
    } else if (isMidfieldRole(player.tacticalRole || player.position)) {
      player.currentPOS = [player.originPOS[0], parseInt(pitchHeight * 0.75, 10)]
    } else {
      player.currentPOS = [player.originPOS[0], parseInt(pitchHeight * 0.5, 10)]
    }
    player.intentPOS = player.currentPOS.slice()
  }
  matchDetails.endIteration = true
  return matchDetails
}

function setBottomHalfwayToTopQtrYPos(matchDetails, attack, defence, kickPlayer) {
  const { ball } = matchDetails
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  kickPlayer.hasBall = true
  ball.lastTouch.playerName = kickPlayer.name
  ball.lastTouch.playerID = kickPlayer.playerID
  ball.lastTouch.teamID = attack.teamID
  ball.lastTouch.deflection = false
  ball.Player = kickPlayer.playerID
  ball.withPlayer = true
  ball.withTeam = attack.teamID
  const ballInCentre = common.isBetween(ball.position[0], (pitchWidth / 4) + 5, (pitchWidth - (pitchWidth / 4) - 5))
  const ballLeft = common.isBetween(ball.position[0], 0, (pitchWidth / 4) + 4)
  ball.direction = ballInCentre ? 'north' : (ballLeft ? 'northeast' : 'northwest')
  kickPlayer.currentPOS = [ball.position[0], ball.position[1]]
  kickPlayer.intentPOS = kickPlayer.currentPOS.slice()

  for (const player of attack.players) {
    if (!common.isOnPitch(player)) continue
    if (player.playerID === kickPlayer.playerID) continue
    if (player.position === 'GK') player.currentPOS = [player.originPOS[0], parseInt(pitchHeight * 0.8, 10)]
    else if (isDefenderRole(player.tacticalRole || player.position)) {
      const maxYPOSCheck = parseInt(common.upToMin(ball.position[1] + 100, pitchHeight * 0.5), 10)
      player.currentPOS = [player.originPOS[0], maxYPOSCheck]
    } else if (isMidfieldRole(player.tacticalRole || player.position)) {
      const maxYPOSCheck = common.upToMin(ball.position[1] - common.getRandomNumber(150, 300), pitchHeight * 0.25)
      player.currentPOS = [player.originPOS[0], parseInt(maxYPOSCheck, 10)]
    } else {
      const maxYPOSCheck = common.upToMin(ball.position[1] - common.getRandomNumber(300, 400), pitchHeight * 0.1)
      player.currentPOS = [player.originPOS[0], parseInt(maxYPOSCheck, 10)]
    }
    player.intentPOS = player.currentPOS.slice()
  }
  for (const player of defence.players) {
    if (!common.isOnPitch(player)) continue
    if (['GK'].includes(player.position) || isDefenderRole(player.tacticalRole || player.position)) {
      player.currentPOS = player.originPOS.slice()
    } else if (isMidfieldRole(player.tacticalRole || player.position)) {
      player.currentPOS = [player.originPOS[0], parseInt(pitchHeight * 0.25, 10)]
    } else {
      player.currentPOS = [player.originPOS[0], parseInt(pitchHeight * 0.5, 10)]
    }
    player.intentPOS = player.currentPOS.slice()
  }
  matchDetails.endIteration = true
  return matchDetails
}

function setTopBottomQtrCentreYPos(matchDetails, attack, defence, kickPlayer) {
  const { ball } = matchDetails
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  kickPlayer.hasBall = true

  ball.lastTouch.playerName = kickPlayer.name
  ball.lastTouch.playerID = kickPlayer.playerID
  ball.lastTouch.teamID = attack.teamID
  ball.lastTouch.deflection = false
  ball.Player = kickPlayer.playerID
  ball.withPlayer = true
  ball.withTeam = attack.teamID
  const ballInCentre = common.isBetween(ball.position[0], (pitchWidth / 4) + 5, (pitchWidth - (pitchWidth / 4) - 5))
  const ballLeft = common.isBetween(ball.position[0], 0, (pitchWidth / 4) + 4)
  ball.direction = ballInCentre ? 'south' : (ballLeft ? 'southeast' : 'southwest')
  kickPlayer.currentPOS = [ball.position[0], ball.position[1]]
  kickPlayer.intentPOS = kickPlayer.currentPOS.slice()

  for (const player of attack.players) {
    if (!common.isOnPitch(player) || player.playerID === kickPlayer.playerID) continue
    if (player.position === 'GK') player.currentPOS = [player.originPOS[0], parseInt(pitchHeight * 0.15, 10)]
    else if (isDefenderRole(player.tacticalRole || player.position)) {
      if (['CB', 'DFC'].includes(player.tacticalRole || player.position)) player.currentPOS = [player.originPOS[0], parseInt(pitchHeight * 0.5, 10)]
      else player.currentPOS = [player.originPOS[0], parseInt(pitchHeight * 0.66, 10)]
    } else {
      player.currentPOS = getPenaltyAreaPosition(matchDetails, false)
    }
    player.intentPOS = player.currentPOS.slice()
  }

  const defOutfield1 = defence.players.filter(p => common.isOnPitch(p) && p.position !== 'GK')
  const spacedPositions1 = getSpacedPenaltyPositions(matchDetails, false, defOutfield1.length)
  let posIdx1 = 0
  for (const player of defence.players) {
    if (!common.isOnPitch(player)) continue
    if (player.position === 'GK') {
      player.currentPOS = player.originPOS.slice()
    } else {
      player.currentPOS = spacedPositions1[posIdx1++] || getPenaltyAreaPosition(matchDetails, false)
    }
    player.intentPOS = player.currentPOS.slice()
  }
  matchDetails.endIteration = true
  return matchDetails
}

function setBottomUpperQtrCentreYPos(matchDetails, attack, defence, kickPlayer) {
  const { ball } = matchDetails
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  kickPlayer.hasBall = true

  ball.lastTouch.playerName = kickPlayer.name
  ball.lastTouch.playerID = kickPlayer.playerID
  ball.lastTouch.teamID = attack.teamID
  ball.lastTouch.deflection = false
  ball.Player = kickPlayer.playerID
  ball.withPlayer = true
  ball.withTeam = attack.teamID
  const ballInCentre = common.isBetween(ball.position[0], (pitchWidth / 4) + 5, (pitchWidth - (pitchWidth / 4) - 5))
  const ballLeft = common.isBetween(ball.position[0], 0, (pitchWidth / 4) + 4)
  ball.direction = ballInCentre ? 'north' : (ballLeft ? 'northeast' : 'northwest')
  kickPlayer.currentPOS = [ball.position[0], ball.position[1]]
  kickPlayer.intentPOS = kickPlayer.currentPOS.slice()

  for (const player of attack.players) {
    if (!common.isOnPitch(player) || player.playerID === kickPlayer.playerID) continue
    if (player.position === 'GK') player.currentPOS = [player.originPOS[0], parseInt(pitchHeight * 0.85, 10)]
    else if (isDefenderRole(player.tacticalRole || player.position)) {
      if (['CB', 'DFC'].includes(player.tacticalRole || player.position)) player.currentPOS = [player.originPOS[0], parseInt(pitchHeight * 0.5, 10)]
      else player.currentPOS = [player.originPOS[0], parseInt(pitchHeight * 0.33, 10)]
    } else {
      player.currentPOS = getPenaltyAreaPosition(matchDetails, true)
    }
    player.intentPOS = player.currentPOS.slice()
  }

  const defOutfield2 = defence.players.filter(p => common.isOnPitch(p) && p.position !== 'GK')
  const spacedPositions2 = getSpacedPenaltyPositions(matchDetails, true, defOutfield2.length)
  let posIdx2 = 0
  for (const player of defence.players) {
    if (!common.isOnPitch(player)) continue
    if (player.position === 'GK') {
      player.currentPOS = player.originPOS.slice()
    } else {
      player.currentPOS = spacedPositions2[posIdx2++] || getPenaltyAreaPosition(matchDetails, true)
    }
    player.intentPOS = player.currentPOS.slice()
  }
  matchDetails.endIteration = true
  return matchDetails
}

function setTopLowerFinalQtrBylinePos(matchDetails, attack, defence, kickPlayer) {
  const { ball } = matchDetails
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  kickPlayer.hasBall = true
  ball.lastTouch.playerName = kickPlayer.name
  ball.lastTouch.playerID = kickPlayer.playerID
  ball.lastTouch.teamID = attack.teamID
  ball.lastTouch.deflection = false
  ball.Player = kickPlayer.playerID
  ball.withPlayer = true
  ball.withTeam = attack.teamID
  const ballLeft = common.isBetween(ball.position[0], 0, (pitchWidth / 4) + 4)
  ball.direction = ballLeft ? 'east' : 'west'
  kickPlayer.currentPOS = [ball.position[0], ball.position[1]]
  kickPlayer.intentPOS = kickPlayer.currentPOS.slice()

  for (const player of attack.players) {
    if (!common.isOnPitch(player) || player.playerID === kickPlayer.playerID) continue
    const { position, originPOS } = player
    if (position === 'GK') player.currentPOS = [originPOS[0], parseInt(pitchHeight * 0.15, 10)]
    else if (['CB', 'LB', 'RB'].includes(position)) {
      if (position === 'CB') player.currentPOS = [originPOS[0], parseInt(pitchHeight * 0.5, 10)]
      else player.currentPOS = [originPOS[0], parseInt(pitchHeight * 0.66, 10)]
    } else player.currentPOS = getPenaltyAreaPosition(matchDetails, false)
    player.intentPOS = player.currentPOS.slice()
  }

  const defOutfield3 = defence.players.filter(p => common.isOnPitch(p) && p.position !== 'GK')
  const spacedPositions3 = getSpacedPenaltyPositions(matchDetails, false, defOutfield3.length)
  let posIdx3 = 0
  for (const player of defence.players) {
    if (!common.isOnPitch(player)) continue
    if (player.position === 'GK') {
      player.currentPOS = player.originPOS.slice()
    } else {
      player.currentPOS = spacedPositions3[posIdx3++] || getPenaltyAreaPosition(matchDetails, false)
    }
    player.intentPOS = player.currentPOS.slice()
  }
  matchDetails.endIteration = true
  return matchDetails
}

function setBottomLowerFinalQtrBylinePos(matchDetails, attack, defence, kickPlayer) {
  const { ball } = matchDetails
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  kickPlayer.hasBall = true
  ball.lastTouch.playerName = kickPlayer.name
  ball.lastTouch.playerID = kickPlayer.playerID
  ball.lastTouch.teamID = attack.teamID
  ball.lastTouch.deflection = false
  ball.Player = kickPlayer.playerID
  ball.withPlayer = true
  ball.withTeam = attack.teamID
  const ballLeft = common.isBetween(ball.position[0], 0, (pitchWidth / 4) + 4)
  ball.direction = ballLeft ? 'east' : 'west'
  kickPlayer.currentPOS = [ball.position[0], ball.position[1]]
  kickPlayer.intentPOS = kickPlayer.currentPOS.slice()

  for (const player of attack.players) {
    if (!common.isOnPitch(player) || player.playerID === kickPlayer.playerID) continue
    const { position, originPOS } = player
    if (position === 'GK') player.currentPOS = [originPOS[0], parseInt(pitchHeight * 0.85, 10)]
    else if (['CB', 'LB', 'RB'].includes(position)) {
      if (position === 'CB') player.currentPOS = [originPOS[0], parseInt(pitchHeight * 0.5, 10)]
      else player.currentPOS = [originPOS[0], parseInt(pitchHeight * 0.33, 10)]
    } else player.currentPOS = getPenaltyAreaPosition(matchDetails, true)
    player.intentPOS = player.currentPOS.slice()
  }

  const defOutfield4 = defence.players.filter(p => common.isOnPitch(p) && p.position !== 'GK')
  const spacedPositions4 = getSpacedPenaltyPositions(matchDetails, true, defOutfield4.length)
  let posIdx4 = 0
  for (const player of defence.players) {
    if (!common.isOnPitch(player)) continue
    if (player.position === 'GK') {
      player.currentPOS = player.originPOS.slice()
    } else {
      player.currentPOS = spacedPositions4[posIdx4++] || getPenaltyAreaPosition(matchDetails, true)
    }
    player.intentPOS = player.currentPOS.slice()
  }
  matchDetails.endIteration = true
  return matchDetails
}


// ============================================================================
// FASE 7: CORNERS TÁCTICOS Y PENALES PSICOLÓGICOS (Fulbito 2.2 §7.4)
// ============================================================================

/**
 * 7.4. Córners Defensivos (Sistema Mixto / Zonal)
 * - 2 guardias zonales en el Primer Palo y área chica (Near Post Zonal Guards)
 * - Los 3 defensores con mayor height + jumping + strength toman marca individual
 * - 1 jugador en la medialuna (Zona 14) para bloqueo de rebote
 * - 1-2 jugadores rápidos adelantados para transición defensiva -> ofensiva
 */
export function setupTacticalCornerMixedZonalDefence(matchDetails, defence, isTop) {
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  const centreX = pitchWidth / 2
  const toDefGoal = (x, depth) => [
    Math.max(25, Math.min(pitchWidth - 25, x)),
    isTop ? depth : (pitchHeight - depth)
  ]

  const defOutfield = defence.players.filter(p => common.isOnPitch(p) && p.position !== 'GK')
  if (defOutfield.length === 0) return

  // Arquero en la línea de meta
  const gk = defence.players.find(p => p.position === 'GK' && common.isOnPitch(p))
  if (gk) {
    gk.currentPOS = toDefGoal(centreX, 10)
    gk.intentPOS = gk.currentPOS.slice()
  }

  // Ordenar por poderío aéreo: height + jumping + strength
  const aerialRanking = [...defOutfield].sort((a, b) => {
    const scoreA = (Number(a.height) || 180) + (a.skill?.jumping || 70) + (a.skill?.strength || 70)
    const scoreB = (Number(b.height) || 180) + (b.skill?.jumping || 70) + (b.skill?.strength || 70)
    return scoreB - scoreA
  })

  // 1. Las 3 torres toman marca individual en punto penal y 2.º palo
  const aerialMarkers = aerialRanking.slice(0, 3)
  const aerialIds = new Set(aerialMarkers.map(p => p.playerID || p.id))

  // 2. Jugadores rápidos para transición / contraataque
  const remainingAfterAerial = defOutfield.filter(p => !aerialIds.has(p.playerID || p.id))
  remainingAfterAerial.sort((a, b) => (Number(b.skill?.speed || 70) + Number(b.skill?.agility || 70)) - (Number(a.skill?.speed || 70) + Number(a.skill?.agility || 70)))
  const outletPlayers = remainingAfterAerial.slice(0, 2)
  const outletIds = new Set(outletPlayers.map(p => p.playerID || p.id))

  // 3. El resto cubre: 2 en primer palo/área chica (Zonales) y 1 en la medialuna (Zona 14)
  const remainingForZones = remainingAfterAerial.filter(p => !outletIds.has(p.playerID || p.id))
  const nearPostGuards = remainingForZones.slice(0, 2)
  const nearPostIds = new Set(nearPostGuards.map(p => p.playerID || p.id))
  const zone14Blocker = remainingForZones.slice(2, 3)[0] || remainingForZones[0]
  const zone14Id = zone14Blocker ? (zone14Blocker.playerID || zone14Blocker.id) : null

  // Posicionamiento de cada grupo
  // A. Guardias zonales en el 1er palo (área chica y poste)
  if (nearPostGuards[0]) {
    nearPostGuards[0].currentPOS = toDefGoal(centreX - 38, 25)
    nearPostGuards[0].intentPOS = nearPostGuards[0].currentPOS.slice()
    nearPostGuards[0].defensiveRole = 'NEAR_POST_ZONAL'
  }
  if (nearPostGuards[1]) {
    nearPostGuards[1].currentPOS = toDefGoal(centreX - 25, 45)
    nearPostGuards[1].intentPOS = nearPostGuards[1].currentPOS.slice()
    nearPostGuards[1].defensiveRole = 'NEAR_POST_ZONAL'
  }

  // B. Marcas en punto penal y segundo palo
  if (aerialMarkers[0]) {
    aerialMarkers[0].currentPOS = toDefGoal(centreX, 105) // Punto penal
    aerialMarkers[0].intentPOS = aerialMarkers[0].currentPOS.slice()
    aerialMarkers[0].defensiveRole = 'MAN_MARK_PENALTY_SPOT'
  }
  if (aerialMarkers[1]) {
    aerialMarkers[1].currentPOS = toDefGoal(centreX + 45, 75) // 2do palo
    aerialMarkers[1].intentPOS = aerialMarkers[1].currentPOS.slice()
    aerialMarkers[1].defensiveRole = 'MAN_MARK_FAR_POST'
  }
  if (aerialMarkers[2]) {
    aerialMarkers[2].currentPOS = toDefGoal(centreX + 20, 95) // Zona de cruce
    aerialMarkers[2].intentPOS = aerialMarkers[2].currentPOS.slice()
    aerialMarkers[2].defensiveRole = 'MAN_MARK_CENTRE_BOX'
  }

  // C. Bloqueador en la medialuna (Zona 14)
  if (zone14Blocker) {
    zone14Blocker.currentPOS = toDefGoal(centreX, 175)
    zone14Blocker.intentPOS = zone14Blocker.currentPOS.slice()
    zone14Blocker.defensiveRole = 'ZONE_14_REBOUND_SHIELD'
  }

  // D. Jugadores de transición rápida adelantados
  if (outletPlayers[0]) {
    outletPlayers[0].currentPOS = toDefGoal(centreX - 70, Math.round(pitchHeight * 0.42))
    outletPlayers[0].intentPOS = outletPlayers[0].currentPOS.slice()
    outletPlayers[0].defensiveRole = 'COUNTER_OUTLET_WIDE'
  }
  if (outletPlayers[1]) {
    outletPlayers[1].currentPOS = toDefGoal(centreX + 70, Math.round(pitchHeight * 0.42))
    outletPlayers[1].intentPOS = outletPlayers[1].currentPOS.slice()
    outletPlayers[1].defensiveRole = 'COUNTER_OUTLET_CENTRAL'
  }

  // Asignar los restantes
  const assigned = new Set([...aerialIds, ...outletIds, ...nearPostIds, zone14Id].filter(Boolean))
  for (const p of defOutfield) {
    if (!assigned.has(p.playerID || p.id)) {
      p.currentPOS = toDefGoal(centreX, 70)
      p.intentPOS = p.currentPOS.slice()
    }
  }
}

/**
 * 7.4. Córners Ofensivos
 * Rutinas coordinadas con comba Magnus atacando:
 * 1. Primer Palo, 2. Punto Penal, 3. Segundo Palo, 4. Borde del Área, más opción en corto.
 */
export function setupTacticalCornerAttacking(matchDetails, attack, cornerCoords, isTop) {
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  const centreX = pitchWidth / 2
  const toDefGoal = (x, depth) => [
    Math.max(25, Math.min(pitchWidth - 25, x)),
    isTop ? depth : (pitchHeight - depth)
  ]

  const isLeftCorner = cornerCoords[0] < pitchWidth / 2
  // Determinación de In-swinger (curva hacia adentro) vs Out-swinger (curva abierta)
  // según el perfil del ejecutante
  const taker = attack.players.find(p => p.action === 'cross' || p.hasBall) || attack.players[1]
  const takerFoot = taker?.preferredFoot || (isLeftCorner ? 'right' : 'left')
  const isInSwinger = (isLeftCorner && takerFoot === 'right') || (!isLeftCorner && takerFoot === 'left')

  if (!matchDetails.ball) matchDetails.ball = {}
  matchDetails.ball.cornerDelivery = {
    type: isInSwinger ? 'IN_SWINGER' : 'OUT_SWINGER',
    magnusSpin: isInSwinger ? (isLeftCorner ? 1.0 : -1.0) : (isLeftCorner ? -1.0 : 1.0)
  }

  return {
    isInSwinger,
    nearPostZone: toDefGoal(centreX - (isLeftCorner ? 40 : -40), 60),
    penaltySpotZone: toDefGoal(centreX, 105),
    farPostZone: toDefGoal(centreX + (isLeftCorner ? 55 : -55), 75),
    edgeBoxZone: toDefGoal(centreX, 180)
  }
}

/**
 * 7.4. Duelo Cognitivo de Penales (Goalkeeper-Dependent vs. Goalkeeper-Independent)
 * 
 * - GOALKEEPER_DEPENDENT (Paradinha / Lectura Perceptiva):
 *   Elegido por pateadores con perception + control >= 82 o rasgos PLAYMAKER / CLINICAL_FINISHER.
 *   Desacelera; si el arquero se vence antes de tiempo, asegura al palo opuesto con 94% de éxito.
 *   Si el arquero tiene alta percepción y aguanta hasta el final, la menor potencia da mayor probabilidad de atajada.
 * 
 * - GOALKEEPER_INDEPENDENT (Potencia y Precisión Biomecánica):
 *   Elegido por pateadores con alto shooting + strength / penalty_taking.
 *   Remate violento a los ángulos o poste. Aun adivinando el lado, el arquero requiere superar un umbral alto.
 * 
 * @param {Object} kicker - Pateador
 * @param {Object} goalkeeper - Arquero
 * @param {Object} options - { rng }
 * @returns {{
 *   scored: boolean,
 *   outcome: 'goal' | 'saved' | 'missed',
 *   kickerName: string,
 *   gkName: string,
 *   kickerDir: string,
 *   gkDir: string,
 *   style: 'GOALKEEPER_DEPENDENT' | 'GOALKEEPER_INDEPENDENT',
 *   details: Object
 * }}
 */
export function resolvePsychologicalPenalty(kicker, goalkeeper, options = {}) {
  const rng = options.rng || Math.random

  const penSkill = Number(kicker.baseSkill?.penalty_taking || kicker.skill?.penalty_taking || 70)
  const shootSkill = Number(kicker.baseSkill?.shooting || kicker.skill?.shooting || 70)
  const controlSkill = Number(kicker.baseSkill?.control || kicker.skill?.control || 70)
  const kickerPer = Number(kicker.baseSkill?.perception || kicker.skill?.perception || 70)

  const gkSaving = Number(goalkeeper.baseSkill?.saving || goalkeeper.skill?.saving || 75)
  const gkPer = Number(goalkeeper.baseSkill?.perception || goalkeeper.skill?.perception || 75)
  const gkAgility = Number(goalkeeper.baseSkill?.agility || goalkeeper.skill?.agility || 75)
  const gkJumping = Number(goalkeeper.baseSkill?.jumping || goalkeeper.skill?.jumping || 75)

  // Selección de Estilo Psicológico
  const hasPlaymakerTrait = hasTrait(kicker, 'PLAYMAKER') || hasTrait(kicker, 'CLINICAL_FINISHER')
  const isHighPerceptionControl = (kickerPer + controlSkill) >= 152 || (kickerPer >= 80 && controlSkill >= 78)
  const style = (hasPlaymakerTrait || isHighPerceptionControl)
    ? 'GOALKEEPER_DEPENDENT'
    : 'GOALKEEPER_INDEPENDENT'

  const directions = ['left', 'center', 'right']

  if (style === 'GOALKEEPER_DEPENDENT') {
    // Arquero se vence antes de tiempo si no tiene paciencia/temple extremo (gkPer < 82)
    const gkPatienceThreshold = 0.82
    const gkPatienceRoll = (gkPer / 100) + (rng() - 0.5) * 0.20
    const gkBitesFeint = gkPatienceRoll < gkPatienceThreshold

    // Si el arquero se vence antes, elige un lado y el pateador lee su movimiento
    const gkBiteDir = directions[Math.floor(rng() * 3)]
    let kickerDir = 'center'
    if (gkBiteDir === 'left') kickerDir = 'right'
    else if (gkBiteDir === 'right') kickerDir = 'left'
    else kickerDir = rng() < 0.5 ? 'left' : 'right'

    if (gkBitesFeint) {
      // 94% de efectividad por engaño total
      const scored = rng() <= 0.94
      return {
        scored,
        outcome: scored ? 'goal' : 'saved',
        kickerName: kicker.name,
        gkName: goalkeeper.name,
        kickerDir,
        gkDir: gkBiteDir,
        style,
        details: { gkBitesFeint: true, technique: 'PARADINHA_DECEPTION' }
      }
    } else {
      // El arquero aguantó de pie hasta el final: la menor potencia del toque colocado permite mayor chance de parada
      const gkDiveDir = kickerDir // Aguanta y va hacia el tiro
      const saveChance = Math.min(68, Math.max(30, (gkSaving * 0.60 + gkPer * 0.40) - (controlSkill * 0.35)))
      const isSaved = (rng() * 100) <= saveChance

      return {
        scored: !isSaved,
        outcome: isSaved ? 'saved' : 'goal',
        kickerName: kicker.name,
        gkName: goalkeeper.name,
        kickerDir,
        gkDir: gkDiveDir,
        style,
        details: { gkBitesFeint: false, technique: 'GK_HELD_GROUND' }
      }
    }
  } else {
    // GOALKEEPER_INDEPENDENT: Potencia y precisión biomecánica
    const chosenDir = directions[Math.floor(rng() * 3)]
    const gkDiveDir = directions[Math.floor(rng() * 3)]

    // Puntería a los ángulos o postes (penSkill + shootSkill)
    const accuracyChance = Math.min(94, 55 + penSkill * 0.32 + shootSkill * 0.12)
    const accuracyRoll = rng() * 100

    if (accuracyRoll > accuracyChance) {
      return {
        scored: false,
        outcome: 'missed',
        kickerName: kicker.name,
        gkName: goalkeeper.name,
        kickerDir: chosenDir,
        gkDir: gkDiveDir,
        style,
        details: { accuracyRoll, accuracyChance, technique: 'POWER_MISSED_WIDE' }
      }
    }

    const sameSide = chosenDir === gkDiveDir
    if (sameSide) {
      // Umbral alto de exigencia biomecánica para el arquero: saving + jumping + agility
      const gkAthleticPower = (gkSaving * 0.45 + gkJumping * 0.35 + gkAgility * 0.20)
      const shotDifficulty = (penSkill * 0.55 + shootSkill * 0.45)
      const saveThreshold = 18 + (gkAthleticPower - shotDifficulty) * 0.50
      const isSaved = (rng() * 100) <= Math.min(58, Math.max(14, saveThreshold))

      return {
        scored: !isSaved,
        outcome: isSaved ? 'saved' : 'goal',
        kickerName: kicker.name,
        gkName: goalkeeper.name,
        kickerDir: chosenDir,
        gkDir: gkDiveDir,
        style,
        details: { sameSide: true, technique: 'POWER_CORNER_SAVE_CHALLENGE' }
      }
    } else {
      // Arquero fue al lado equivocado: gol asegurado ante tiro potente al arco
      return {
        scored: true,
        outcome: 'goal',
        kickerName: kicker.name,
        gkName: goalkeeper.name,
        kickerDir: chosenDir,
        gkDir: gkDiveDir,
        style,
        details: { sameSide: false, technique: 'POWER_WRONG_WAY' }
      }
    }
  }
}
