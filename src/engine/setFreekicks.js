import * as common from './common.js'

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

export function applyFreekickTactics(matchDetails, attack, defence, kickPlayer, isTopAttacking) {
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  const ballPos = matchDetails.ball.position
  const targetGoal = isTopAttacking ? [pitchWidth / 2, pitchHeight] : [pitchWidth / 2, 0]
  const distToGoal = common.distance(ballPos, targetGoal)
  const lateralOffset = Math.abs(ballPos[0] - pitchWidth / 2)
  const isFrontal = lateralOffset <= 170

  const fkSkill = Number(kickPlayer.skill.freekick || kickPlayer.skill.shooting || 70)
  const isSpecialist = fkSkill >= 84 || (Array.isArray(kickPlayer.traits) && kickPlayer.traits.includes('lanzador_canonero'))

  // 1. Asignar acción según distancia y ángulo (Tiro directo vs Centro vs Pase)
  if ((distToGoal <= 265 && isFrontal) || (isSpecialist && distToGoal <= 315 && lateralOffset <= 200)) {
    kickPlayer.action = 'freekickShot'
    matchDetails.iterationLog.push(`Dangerous Direct Freekick for ${attack.name} - Taker: ${kickPlayer.name}`)
  } else if (distToGoal <= 420) {
    kickPlayer.action = 'cross'
    matchDetails.iterationLog.push(`Crossing Freekick for ${attack.name} - Taker: ${kickPlayer.name}`)
  } else {
    kickPlayer.action = 'pass'
  }

  // 2. Subida de centrales (CB) a cabecear en tiros libres ofensivos (< 420px del arco rival)
  if (distToGoal <= 420) {
    const cbs = attack.players.filter(p => (
      common.isOnPitch(p) &&
      p.playerID !== kickPlayer.playerID &&
      (p.position === 'CB' || p.tacticalRole === 'CB' || p.tacticalRole === 'DFC' || p.tacticalRole === 'LÍBERO' || p.tacticalRole === 'STOP I' || p.tacticalRole === 'STOP D')
    ))
    cbs.sort((a, b) => ((b.skill.jumping || 0) + (Number(b.height) || 180)) - ((a.skill.jumping || 0) + (Number(a.height) || 180)))
    const headingCBs = cbs.slice(0, 2)
    for (const cb of headingCBs) {
      cb.currentPOS = isTopAttacking
        ? common.getRandomBottomPenaltyPosition(matchDetails)
        : common.getRandomTopPenaltyPosition(matchDetails)
      cb.intentPOS = cb.currentPOS.slice()
      matchDetails.iterationLog.push(`CB Header run by: ${cb.name}`)
    }
  }
}

export function setTopFreekick(matchDetails) {
  common.removeBallFromAllPlayers(matchDetails)
  matchDetails.ball.ballOverIterations = []
  const { kickOffTeam, secondTeam } = matchDetails
  const [, pitchHeight] = matchDetails.pitchSize
  const [, ballY] = matchDetails.ball.position
  const attack = (kickOffTeam.players[0].originPOS[1] < pitchHeight / 2) ? kickOffTeam : secondTeam
  const defence = (kickOffTeam.players[0].originPOS[1] < pitchHeight / 2) ? secondTeam : kickOffTeam
  const hundredToHalfway = common.isBetween(ballY, 100, (pitchHeight / 2) + 1)
  const halfwayToLastQtr = common.isBetween(ballY, pitchHeight / 2, pitchHeight - (pitchHeight / 4))
  const upperFinalQtr = common.isBetween(ballY, pitchHeight - (pitchHeight / 4), pitchHeight - (pitchHeight / 6) - 5)
  const lowerFinalQtr = common.isBetween(ballY, pitchHeight - (pitchHeight / 6) - 5, pitchHeight + 1)

  let result
  if (ballY <= 100) result = setTopOneHundredYPos(matchDetails, attack, defence)
  else if (hundredToHalfway) result = setTopOneHundredToHalfwayYPos(matchDetails, attack, defence)
  else if (halfwayToLastQtr) result = setTopHalfwayToBottomQtrYPos(matchDetails, attack, defence)
  else if (upperFinalQtr) result = setTopBottomQtrCentreYPos(matchDetails, attack, defence)
  else if (lowerFinalQtr) result = setTopLowerFinalQtrBylinePos(matchDetails, attack, defence)
  else result = setTopHalfwayToBottomQtrYPos(matchDetails, attack, defence)

  const kickPlayer = attack.players.find(p => p.playerID === matchDetails.ball.Player) || selectFreekickTaker(attack)
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
  const hundredToHalfway = common.isBetween(ballY, (pitchHeight / 2) - 1, pitchHeight - 100)
  const halfwayToLastQtr = common.isBetween(ballY, pitchHeight / 4, pitchHeight / 2)
  const upperFinalQtr = common.isBetween(ballY, (pitchHeight / 6) - 5, pitchHeight / 4)
  const lowerFinalQtr = common.isBetween(ballY, -1, (pitchHeight / 6) - 5)

  let result
  if (ballY >= pitchHeight - 100) result = setBottomOneHundredYPos(matchDetails, attack, defence)
  else if (hundredToHalfway) result = setBottomOneHundredToHalfwayYPos(matchDetails, attack, defence)
  else if (halfwayToLastQtr) result = setBottomHalfwayToTopQtrYPos(matchDetails, attack, defence)
  else if (upperFinalQtr) result = setBottomUpperQtrCentreYPos(matchDetails, attack, defence)
  else if (lowerFinalQtr) result = setBottomLowerFinalQtrBylinePos(matchDetails, attack, defence)
  else result = setBottomHalfwayToTopQtrYPos(matchDetails, attack, defence)

  const kickPlayer = attack.players.find(p => p.playerID === matchDetails.ball.Player) || selectFreekickTaker(attack)
  applyFreekickTactics(matchDetails, attack, defence, kickPlayer, false)
  return result
}

function setTopOneHundredYPos(matchDetails, attack, defence) {
  const kickPlayer = common.isOnPitch(attack.players[0]) ? attack.players[0] : selectFreekickTaker(attack, true)
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
    if (player.playerID === kickPlayer.playerID) player.currentPOS = [ball.position[0], ball.position[1]]
    else player.currentPOS = player.originPOS.slice()
  }
  for (const player of defence.players) {
    if (!common.isOnPitch(player)) continue
    if (player.position === 'GK') player.currentPOS = player.originPOS.slice()
    else player.currentPOS = [player.originPOS[0], common.upToMin(player.originPOS[1] - 100, 0)]
  }
  matchDetails.endIteration = true
  return matchDetails
}

function setBottomOneHundredYPos(matchDetails, attack, defence) {
  const kickPlayer = common.isOnPitch(attack.players[0]) ? attack.players[0] : selectFreekickTaker(attack, true)
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
    if (player.playerID === kickPlayer.playerID) player.currentPOS = [ball.position[0], ball.position[1]]
    else player.currentPOS = player.originPOS.slice()
  }
  for (const player of defence.players) {
    if (!common.isOnPitch(player)) continue
    if (player.position === 'GK') player.currentPOS = player.originPOS.slice()
    else player.currentPOS = [player.originPOS[0], common.upToMax(player.originPOS[1] + 100, pitchHeight)]
  }
  matchDetails.endIteration = true
  return matchDetails
}

function setTopOneHundredToHalfwayYPos(matchDetails, attack, defence) {
  const { ball } = matchDetails
  const [, pitchHeight] = matchDetails.pitchSize
  const goalieToKick = common.isBetween(ball.position[1], 0, (pitchHeight * 0.25) + 1)
  const kickPlayer = (goalieToKick && common.isOnPitch(attack.players[0]))
    ? attack.players[0]
    : selectFreekickTaker(attack)

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
    } else if (['CB', 'LB', 'RB'].includes(player.position)) {
      const newYPOS = player.originPOS[1] + (ball.position[1] - player.originPOS[1]) + 200
      player.currentPOS = [player.originPOS[0], parseInt(common.upToMax(newYPOS, pitchHeight * 0.5), 10)]
    } else if (['CM', 'LM', 'RM'].includes(player.position)) {
      const newYPOS = player.originPOS[1] + (ball.position[1] - player.originPOS[1]) + 250
      player.currentPOS = [player.originPOS[0], parseInt(common.upToMax(newYPOS, pitchHeight * 0.75), 10)]
    } else {
      const newYPOS = player.originPOS[1] + (ball.position[1] - player.originPOS[1]) + 300
      player.currentPOS = [player.originPOS[0], parseInt(common.upToMax(newYPOS, pitchHeight * 0.9), 10)]
    }
  }
  for (const player of defence.players) {
    if (!common.isOnPitch(player)) continue
    if (['GK', 'CB', 'LB', 'RB'].includes(player.position)) player.currentPOS = player.originPOS.slice()
    else if (['CM', 'LM', 'RM'].includes(player.position)) {
      player.currentPOS = [player.originPOS[0], parseInt((pitchHeight * 0.75) + 5, 10)]
    } else {
      player.currentPOS = [player.originPOS[0], parseInt(pitchHeight * 0.5, 10)]
    }
  }
  matchDetails.endIteration = true
  return matchDetails
}

function setBottomOneHundredToHalfwayYPos(matchDetails, attack, defence) {
  const { ball } = matchDetails
  const [, pitchHeight] = matchDetails.pitchSize
  const goalieToKick = common.isBetween(ball.position[1], (pitchHeight * 0.75) + 1, pitchHeight)
  const kickPlayer = (goalieToKick && common.isOnPitch(attack.players[0]))
    ? attack.players[0]
    : selectFreekickTaker(attack)

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
    } else if (['CB', 'LB', 'RB'].includes(player.position)) {
      const newYPOS = player.originPOS[1] + (ball.position[1] - player.originPOS[1]) - 200
      player.currentPOS = [player.originPOS[0], parseInt(common.upToMin(newYPOS, pitchHeight * 0.5), 10)]
    } else if (['CM', 'LM', 'RM'].includes(player.position)) {
      const newYPOS = player.originPOS[1] + (ball.position[1] - player.originPOS[1]) - 250
      player.currentPOS = [player.originPOS[0], parseInt(common.upToMin(newYPOS, pitchHeight * 0.25), 10)]
    } else {
      const newYPOS = player.originPOS[1] + (ball.position[1] - player.originPOS[1]) - 300
      player.currentPOS = [player.originPOS[0], parseInt(common.upToMin(newYPOS, pitchHeight * 0.1), 10)]
    }
  }
  for (const player of defence.players) {
    if (!common.isOnPitch(player)) continue
    if (['GK', 'CB', 'LB', 'RB'].includes(player.position)) player.currentPOS = player.originPOS.slice()
    else if (['CM', 'LM', 'RM'].includes(player.position)) {
      player.currentPOS = [player.originPOS[0], parseInt((pitchHeight * 0.25) - 5, 10)]
    } else {
      player.currentPOS = [player.originPOS[0], parseInt(pitchHeight * 0.5, 10)]
    }
  }
  matchDetails.endIteration = true
  return matchDetails
}

function setTopHalfwayToBottomQtrYPos(matchDetails, attack, defence) {
  const { ball } = matchDetails
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  const kickPlayer = selectFreekickTaker(attack)
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

  for (const player of attack.players) {
    if (!common.isOnPitch(player)) continue
    if (player.playerID === kickPlayer.playerID) continue
    if (player.position === 'GK') player.currentPOS = [player.originPOS[0], parseInt(pitchHeight * 0.2, 10)]
    else if (['CB', 'LB', 'RB'].includes(player.position)) {
      const maxYPOSCheck = parseInt(common.upToMax(ball.position[1] - 100, pitchHeight * 0.5), 10)
      player.currentPOS = [player.originPOS[0], maxYPOSCheck]
    } else if (['CM', 'LM', 'RM'].includes(player.position)) {
      const maxYPOSCheck = common.upToMax(ball.position[1] + common.getRandomNumber(150, 300), pitchHeight * 0.75)
      player.currentPOS = [player.originPOS[0], parseInt(maxYPOSCheck, 10)]
    } else {
      const maxYPOSCheck = common.upToMax(ball.position[1] + common.getRandomNumber(300, 400), pitchHeight * 0.9)
      player.currentPOS = [player.originPOS[0], parseInt(maxYPOSCheck, 10)]
    }
  }
  for (const player of defence.players) {
    if (!common.isOnPitch(player)) continue
    if (['GK', 'CB', 'LB', 'RB'].includes(player.position)) {
      player.currentPOS = player.originPOS.slice()
    } else if (['CM', 'LM', 'RM'].includes(player.position)) {
      player.currentPOS = [player.originPOS[0], parseInt(pitchHeight * 0.75, 10)]
    } else {
      player.currentPOS = [player.originPOS[0], parseInt(pitchHeight * 0.5, 10)]
    }
  }
  matchDetails.endIteration = true
  return matchDetails
}

function setBottomHalfwayToTopQtrYPos(matchDetails, attack, defence) {
  const { ball } = matchDetails
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  const kickPlayer = selectFreekickTaker(attack)
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

  for (const player of attack.players) {
    if (!common.isOnPitch(player)) continue
    if (player.playerID === kickPlayer.playerID) continue
    if (player.position === 'GK') player.currentPOS = [player.originPOS[0], parseInt(pitchHeight * 0.8, 10)]
    else if (['CB', 'LB', 'RB'].includes(player.position)) {
      const maxYPOSCheck = parseInt(common.upToMin(ball.position[1] + 100, pitchHeight * 0.5), 10)
      player.currentPOS = [player.originPOS[0], maxYPOSCheck]
    } else if (['CM', 'LM', 'RM'].includes(player.position)) {
      const maxYPOSCheck = common.upToMin(ball.position[1] - common.getRandomNumber(150, 300), pitchHeight * 0.25)
      player.currentPOS = [player.originPOS[0], parseInt(maxYPOSCheck, 10)]
    } else {
      const maxYPOSCheck = common.upToMin(ball.position[1] - common.getRandomNumber(300, 400), pitchHeight * 0.1)
      player.currentPOS = [player.originPOS[0], parseInt(maxYPOSCheck, 10)]
    }
  }
  for (const player of defence.players) {
    if (!common.isOnPitch(player)) continue
    if (['GK', 'CB', 'LB', 'RB'].includes(player.position)) {
      player.currentPOS = player.originPOS.slice()
    } else if (['CM', 'LM', 'RM'].includes(player.position)) {
      player.currentPOS = [player.originPOS[0], parseInt(pitchHeight * 0.25, 10)]
    } else {
      player.currentPOS = [player.originPOS[0], parseInt(pitchHeight * 0.5, 10)]
    }
  }
  matchDetails.endIteration = true
  return matchDetails
}

function setTopBottomQtrCentreYPos(matchDetails, attack, defence) {
  const { ball } = matchDetails
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  const kickPlayer = selectFreekickTaker(attack)
  kickPlayer.hasBall = true
  // Tiro libre peligroso en la puerta del área: si está en zona frontal, prepara disparo directo (FK)
  const isDirectZone = common.isBetween(ball.position[0], pitchWidth * 0.18, pitchWidth * 0.82)
  if (isDirectZone) {
    kickPlayer.action = 'freekickShot'
    matchDetails.iterationLog.push(`Dangerous Freekick for ${attack.name} - Taker: ${kickPlayer.name}`)
  }

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

  for (const player of attack.players) {
    if (!common.isOnPitch(player) || player.playerID === kickPlayer.playerID) continue
    if (player.position === 'GK') player.currentPOS = [player.originPOS[0], parseInt(pitchHeight * 0.15, 10)]
    else if (['CB', 'LB', 'RB'].includes(player.position)) {
      if (player.position === 'CB') player.currentPOS = [player.originPOS[0], parseInt(pitchHeight * 0.5, 10)]
      else player.currentPOS = [player.originPOS[0], parseInt(pitchHeight * 0.66, 10)]
    } else {
      player.currentPOS = common.getRandomBottomPenaltyPosition(matchDetails)
    }
  }
  let playerSpace = -3
  for (const player of defence.players) {
    if (!common.isOnPitch(player)) continue
    const ballDistanceFromGoalX = ball.position[0] - (pitchWidth / 2)
    const midWayFromBalltoGoalX = parseInt(ball.position[0] - (ballDistanceFromGoalX / 2), 10)
    const ballDistanceFromGoalY = pitchHeight - ball.position[1]
    const midWayFromBalltoGoalY = parseInt(ball.position[1] + (ballDistanceFromGoalY * 0.25), 10)
    if (player.position === 'GK') player.currentPOS = player.originPOS.slice()
    else if (['CB', 'LB', 'RB'].includes(player.position)) {
      player.currentPOS = [
        common.upToMax(common.upToMin(midWayFromBalltoGoalX + playerSpace, 10), pitchWidth - 10),
        common.upToMax(common.upToMin(midWayFromBalltoGoalY, 10), pitchHeight - 10)
      ]
      playerSpace += 2
    } else {
      player.currentPOS = common.getRandomBottomPenaltyPosition(matchDetails)
    }
  }
  matchDetails.endIteration = true
  return matchDetails
}

function setBottomUpperQtrCentreYPos(matchDetails, attack, defence) {
  const { ball } = matchDetails
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  const kickPlayer = selectFreekickTaker(attack)
  kickPlayer.hasBall = true
  const isDirectZone = common.isBetween(ball.position[0], pitchWidth * 0.18, pitchWidth * 0.82)
  if (isDirectZone) {
    kickPlayer.action = 'freekickShot'
    matchDetails.iterationLog.push(`Dangerous Freekick for ${attack.name} - Taker: ${kickPlayer.name}`)
  }

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

  for (const player of attack.players) {
    if (!common.isOnPitch(player) || player.playerID === kickPlayer.playerID) continue
    if (player.position === 'GK') player.currentPOS = [player.originPOS[0], parseInt(pitchHeight * 0.85, 10)]
    else if (['CB', 'LB', 'RB'].includes(player.position)) {
      if (player.position === 'CB') player.currentPOS = [player.originPOS[0], parseInt(pitchHeight * 0.5, 10)]
      else player.currentPOS = [player.originPOS[0], parseInt(pitchHeight * 0.33, 10)]
    } else {
      player.currentPOS = common.getRandomTopPenaltyPosition(matchDetails)
    }
  }
  let playerSpace = -3
  for (const player of defence.players) {
    if (!common.isOnPitch(player)) continue
    const ballDistanceFromGoalX = ball.position[0] - (pitchWidth / 2)
    const midWayFromBalltoGoalX = parseInt(ball.position[0] - (ballDistanceFromGoalX / 2), 10)
    const midWayFromBalltoGoalY = parseInt(ball.position[1] * 0.75, 10)
    if (player.position === 'GK') player.currentPOS = player.originPOS.slice()
    else if (['CB', 'LB', 'RB'].includes(player.position)) {
      player.currentPOS = [
        common.upToMax(common.upToMin(midWayFromBalltoGoalX + playerSpace, 10), pitchWidth - 10),
        common.upToMax(common.upToMin(midWayFromBalltoGoalY, 10), pitchHeight - 10)
      ]
      playerSpace += 2
    } else {
      player.currentPOS = common.getRandomTopPenaltyPosition(matchDetails)
    }
  }
  matchDetails.endIteration = true
  return matchDetails
}

function setTopLowerFinalQtrBylinePos(matchDetails, attack, defence) {
  const { ball } = matchDetails
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  const kickPlayer = selectFreekickTaker(attack)
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

  for (const player of attack.players) {
    if (!common.isOnPitch(player) || player.playerID === kickPlayer.playerID) continue
    const { position, originPOS } = player
    if (position === 'GK') player.currentPOS = [originPOS[0], parseInt(pitchHeight * 0.15, 10)]
    else if (['CB', 'LB', 'RB'].includes(position)) {
      if (position === 'CB') player.currentPOS = [originPOS[0], parseInt(pitchHeight * 0.5, 10)]
      else player.currentPOS = [originPOS[0], parseInt(pitchHeight * 0.66, 10)]
    } else player.currentPOS = common.getRandomBottomPenaltyPosition(matchDetails)
  }
  let playerSpace = common.upToMax(ball.position[1] + 3, pitchHeight - 5)
  for (const player of defence.players) {
    if (!common.isOnPitch(player)) continue
    const { position, originPOS } = player
    const ballDistanceFromGoalX = ball.position[0] - (pitchWidth / 2)
    const midWayFromBalltoGoalX = parseInt(ball.position[0] - (ballDistanceFromGoalX / 2), 10)
    if (position === 'GK') player.currentPOS = originPOS.slice()
    else if (['CB', 'LB', 'RB'].includes(position)) {
      player.currentPOS = [
        common.upToMax(common.upToMin(midWayFromBalltoGoalX, 10), pitchWidth - 10),
        common.upToMax(common.upToMin(playerSpace, 10), pitchHeight - 10)
      ]
      playerSpace -= 2
    } else player.currentPOS = common.getRandomBottomPenaltyPosition(matchDetails)
  }
  matchDetails.endIteration = true
  return matchDetails
}

function setBottomLowerFinalQtrBylinePos(matchDetails, attack, defence) {
  const { ball } = matchDetails
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  const kickPlayer = selectFreekickTaker(attack)
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

  for (const player of attack.players) {
    if (!common.isOnPitch(player) || player.playerID === kickPlayer.playerID) continue
    const { position, originPOS } = player
    if (position === 'GK') player.currentPOS = [originPOS[0], parseInt(pitchHeight * 0.85, 10)]
    else if (['CB', 'LB', 'RB'].includes(position)) {
      if (position === 'CB') player.currentPOS = [originPOS[0], parseInt(pitchHeight * 0.5, 10)]
      else player.currentPOS = [originPOS[0], parseInt(pitchHeight * 0.33, 10)]
    } else player.currentPOS = common.getRandomTopPenaltyPosition(matchDetails)
  }
  let playerSpace = common.upToMin(ball.position[1] - 3, 5)
  for (const player of defence.players) {
    if (!common.isOnPitch(player)) continue
    const { position, originPOS } = player
    const ballDistanceFromGoalX = ball.position[0] - (pitchWidth / 2)
    const midWayFromBalltoGoalX = parseInt(ball.position[0] - (ballDistanceFromGoalX / 2), 10)
    if (position === 'GK') player.currentPOS = originPOS.slice()
    else if (['CB', 'LB', 'RB'].includes(position)) {
      player.currentPOS = [
        common.upToMax(common.upToMin(midWayFromBalltoGoalX, 10), pitchWidth - 10),
        common.upToMax(common.upToMin(playerSpace, 10), pitchHeight - 10)
      ]
      playerSpace += 2
    } else player.currentPOS = common.getRandomTopPenaltyPosition(matchDetails)
  }
  matchDetails.endIteration = true
  return matchDetails
}
