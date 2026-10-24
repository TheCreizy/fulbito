import * as common from './common.js'

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
