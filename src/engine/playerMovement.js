import * as common from './common.js'
import * as ballMovement from './ballMovement.js'
import * as setPositions from './setPositions.js'
import * as actions from './actions.js'
import { isCaptainOnPitch, updatePlayerEffectiveSkills } from './modifiers.js'

export function decideMovement(closestPlayer, team, opp, matchDetails) {
  const { position, withPlayer, withTeam } = matchDetails.ball
  const teamActions = []
  for (const thisPlayer of team.players) {
    if (common.isOnPitch(thisPlayer)) {
      if ((thisPlayer.stunnedTicks || 0) > 0) {
        thisPlayer.stunnedTicks--
        teamActions.push({ player: thisPlayer, action: 'wait', move: [0, 0] })
        continue
      }
      if ((thisPlayer.gambetaCooldown || 0) > 0) {
        thisPlayer.gambetaCooldown--
      }

      let ballToPlayerX = thisPlayer.currentPOS[0] - position[0]
      let ballToPlayerY = thisPlayer.currentPOS[1] - position[1]
      const possibleActions = actions.findPossActions(thisPlayer, team, opp, ballToPlayerX, ballToPlayerY, matchDetails)
      const lastTouchPlayer = thisPlayer.playerID === matchDetails.ball.lastTouch.playerID
      const ballRecentlyKicked = matchDetails.ball.lastTouch.iterations < 3
      const ballMoving = matchDetails.ball.ballOverIterations.length > 0
      let action
      if (lastTouchPlayer && ballRecentlyKicked && ballMoving) action = 'wait'
      else {
        action = actions.selectAction(possibleActions)
        action = checkProvidedAction(matchDetails, thisPlayer, action)
      }

      // Gestión inteligente de conducción: solo forzar descarga si está rodeado por >= 2 rivales
      // o si lleva > 22 ticks y ya no tiene espacio libre adelante.
      if (thisPlayer.hasBall && matchDetails.ball.Player === thisPlayer.playerID) {
        if (matchDetails.ball.lastCarrierID === thisPlayer.playerID) {
          matchDetails.ball.carrierTicks = (matchDetails.ball.carrierTicks || 0) + 1
        } else {
          matchDetails.ball.lastCarrierID = thisPlayer.playerID
          matchDetails.ball.carrierTicks = 1
        }
        const activeOpps = opp.players.filter(
          op => common.isOnPitch(op) && (op.stunnedTicks || 0) <= 0
        )
        const nearbyOpps = activeOpps.filter(
          op => common.distance(thisPlayer.currentPOS, op.currentPOS) < 20
        ).length
        const minOppDist = activeOpps.reduce(
          (minD, op) => Math.min(minD, common.distance(thisPlayer.currentPOS, op.currentPOS)),
          999
        )
        const [pitchWidth, pitchHeight] = matchDetails.pitchSize
        const attackingTop = thisPlayer.originPOS[1] > pitchHeight / 2
        const distToGoalY = attackingTop ? thisPlayer.currentPOS[1] : (pitchHeight - thisPlayer.currentPOS[1])
        const isWide = thisPlayer.currentPOS[0] < 168 || thisPlayer.currentPOS[0] > pitchWidth - 168
        const inCornerZone = distToGoalY < 135 && isWide
        const mustRelease = inCornerZone || (nearbyOpps >= 2 && matchDetails.ball.carrierTicks >= 5) ||
          (matchDetails.ball.carrierTicks >= 20 && minOppDist < 35)
        if (mustRelease && (action === 'run' || action === 'sprint')) {
          if (distToGoalY < 220 && isWide) action = 'cross'
          else if (distToGoalY < 160 && common.isBetween(thisPlayer.currentPOS[0], 185, pitchWidth - 185)) action = 'shoot'
          else action = 'pass'
          matchDetails.ball.carrierTicks = 0
        }
      }

      // Si este jugador es el receptor destino de un pase en vuelo o está haciendo un desmarque activo, corre con sprint
      if (
        matchDetails.ball.isPendingPass &&
        matchDetails.ball.targetPlayerID === thisPlayer.playerID &&
        Array.isArray(matchDetails.ball.targetPOS)
      ) {
        action = 'sprint'
      } else if (
        !thisPlayer.hasBall &&
        withTeam === team.teamID &&
        thisPlayer.position !== 'GK'
      ) {
        // Solo sprint si tiene un desmarque activo (carrera diagonal o pared)
        if (thisPlayer.offBallRun && thisPlayer.offBallRun.untilIteration > (matchDetails.iterationCount || 0)) {
          action = 'sprint'
        }
      } else if ((!withPlayer || withTeam !== team.teamID) && closestPlayer.name === thisPlayer.name) {
        // El jugador más cercano de cada equipo busca activamente la pelota suelta o presiona al portador rival
        if (action !== 'tackle' && action !== 'slide' && action !== 'intercept') action = 'sprint'
        ballToPlayerX = closestPlayerActionBallX(ballToPlayerX)
        ballToPlayerY = closestPlayerActionBallY(ballToPlayerY)
      } else if (
        team.gamePhase === 'DefensiveTransition' &&
        (!withPlayer || withTeam !== team.teamID) &&
        common.distance(thisPlayer.currentPOS, position) < 36 &&
        thisPlayer.position !== 'GK'
      ) {
        // Presión inmediata tras pérdida (Counter-Pressing de open-football)
        if (action !== 'tackle' && action !== 'slide' && action !== 'intercept') action = 'sprint'
        ballToPlayerX = closestPlayerActionBallX(ballToPlayerX)
        ballToPlayerY = closestPlayerActionBallY(ballToPlayerY)
      }
      if (action === 'sprint') {
        thisPlayer.isSprinting = true
        thisPlayer.sprintMomentum = Math.min(1.0, (thisPlayer.sprintMomentum || 0) + 0.25)
      } else {
        thisPlayer.isSprinting = false
        thisPlayer.sprintMomentum = Math.max(0, (thisPlayer.sprintMomentum || 0) - 0.25)
      }
      const move = getMovement(thisPlayer, action, opp, ballToPlayerX, ballToPlayerY, matchDetails, team)
      teamActions.push({ player: thisPlayer, action, move })
    }
  }
  return teamActions
}

function tryCarrierGambeta(matchDetails, carrier, team, opp, move) {
  if ((carrier.gambetaCooldown || 0) > 0) return
  const [, pitchHeight] = matchDetails.pitchSize
  const isTopTeam = carrier.originPOS[1] < (pitchHeight / 2)
  const dir = isTopTeam ? 1 : -1

  // Buscar un defensor rival que le salga al cruce adelante (entre 11px y 24px)
  const candidates = (opp?.players || []).filter(op => {
    if (!common.isOnPitch(op) || op.position === 'GK' || (op.stunnedTicks || 0) > 0) return false
    const d = common.distance(carrier.currentPOS, op.currentPOS)
    if (d < 10 || d > 24) return false
    const forwardDelta = (op.currentPOS[1] - carrier.currentPOS[1]) * dir
    return forwardDelta >= -4
  })
  if (candidates.length === 0 || candidates.length >= 3) return

  const defender = candidates[0]
  const role = carrier.tacticalRole || carrier.position
  const dribbleSkill = ((Number(carrier.skill?.agility) || 70) + (Number(carrier.skill?.control) || 70)) / 2
  const hasTrait = (p, t) => Array.isArray(p?.traits) && p.traits.includes(t)
  const isEncarador = hasTrait(carrier, 'fenomeno_encarador') || hasTrait(carrier, 'playmaker_gambeteador')
  const isVelocista = hasTrait(carrier, 'velocista_banda')
  const isCaudillo = hasTrait(defender, 'caudillo_fisico')

  let attemptChance = ['CAM', 'LM', 'RM', 'ST'].includes(role) ? 74 : (dribbleSkill >= 78 ? 58 : 25)
  if (isEncarador) attemptChance = 92
  if (isVelocista) attemptChance = 85
  if (common.getRandomNumber(1, 100) > attemptChance) return

  const encaradorBonus = isEncarador ? 12 : (isVelocista ? 8 : 0)
  const caudilloBonus = isCaudillo ? 10 : 0

  const atkScore = (Number(carrier.skill?.agility || 70) * 0.56 + Number(carrier.skill?.control || 70) * 0.44) + encaradorBonus + common.getRandomNumber(-9, 14)
  const defScore = (Number(defender.skill?.tackling || 65) * 0.52 + Number(defender.skill?.perception || 65) * 0.48) + caudilloBonus + common.getRandomNumber(-9, 9)

  if (atkScore >= defScore) {
    // ¡Gambeta exitosa! El defensor queda pagando y el portador gana un paso explosivo al espacio
    defender.stunnedTicks = 5
    carrier.gambetaCooldown = 12
    carrier.lastGambetaIter = matchDetails.iterationCount || 0
    carrier.stats.dribbles = (carrier.stats.dribbles || 0) + 1
    const burstX = move[0] !== 0 ? Math.sign(move[0]) * 5 : (carrier.currentPOS[0] < defender.currentPOS[0] ? -5 : 5)
    const burstY = dir * 5
    carrier.currentPOS = completeMovement(matchDetails, carrier.currentPOS, [burstX, burstY])
    matchDetails.iterationLog.push(`Gambeta by: ${carrier.name} past ${defender.name}`)
    if (Array.isArray(matchDetails.events)) {
      matchDetails.events.push({
        type: 'gambeta',
        teamID: team.teamID,
        teamName: team.name,
        playerName: carrier.name,
        victimName: defender.name,
        iteration: matchDetails.iterationCount || 0,
        half: matchDetails.half
      })
    }
  } else {
    // Si el defensor es un CAUDILLO FÍSICO y tiene ventaja de fuerza, usa el cuerpo (hombro a hombro limpio)
    if (isCaudillo && (Number(defender.skill?.strength || 70) >= Number(carrier.skill?.strength || 65) + 3)) {
      carrier.stunnedTicks = 4
      defender.lastCaudilloIter = matchDetails.iterationCount || 0
      if (!defender.stats.tackles) defender.stats.tackles = { total: 0, on: 0, off: 0, fouls: 0 }
      defender.stats.tackles.total++
      defender.stats.tackles.on++
      actions.setPostTackleBall(matchDetails, opp, team, defender)
      matchDetails.iterationLog.push(`Caudillo body check by: ${defender.name} against ${carrier.name}`)
      if (Array.isArray(matchDetails.events)) {
        matchDetails.events.push({
          type: 'caudilloTackle',
          teamID: opp.teamID,
          teamName: opp.name,
          playerName: defender.name,
          victimName: carrier.name,
          iteration: matchDetails.iterationCount || 0,
          half: matchDetails.half
        })
      }
    } else {
      carrier.gambetaCooldown = 8
    }
  }
}

export function movePlayers(moves, team, opp, matchDetails) {
  const controlRadius = 12
  const challengeRadius = 14
  for (const thisPlayerMove of moves) {
    const thisPlayer = thisPlayerMove.player
    if (!common.isOnPitch(thisPlayer)) continue
    if ((thisPlayer.stunnedTicks || 0) > 0) continue
    const { move, action } = thisPlayerMove
    thisPlayer.currentPOS = completeMovement(matchDetails, thisPlayer.currentPOS, move)

    // Si este jugador lleva la pelota (dribbling con run/sprint), evaluar gambeta 1v1 y mover la pelota junto con él
    if (thisPlayer.hasBall === true && matchDetails.ball.Player === thisPlayer.playerID) {
      if (action === 'run' || action === 'sprint') {
        tryCarrierGambeta(matchDetails, thisPlayer, team, opp, move)
      }
      matchDetails.ball.position = [thisPlayer.currentPOS[0], thisPlayer.currentPOS[1], 0]
      continue
    }

    const { position, withPlayer, withTeam } = matchDetails.ball
    const xPosition = common.isBetween(thisPlayer.currentPOS[0], position[0] - controlRadius, position[0] + controlRadius)
    const yPosition = common.isBetween(thisPlayer.currentPOS[1], position[1] - controlRadius, position[1] + controlRadius)
    const inChallengeZone = common.isBetween(thisPlayer.currentPOS[0], position[0] - challengeRadius, position[0] + challengeRadius) &&
      common.isBetween(thisPlayer.currentPOS[1], position[1] - challengeRadius, position[1] + challengeRadius)
    const samePositionAsBall = common.isBetween(thisPlayer.currentPOS[0], position[0] - 8, position[0] + 8) &&
      common.isBetween(thisPlayer.currentPOS[1], position[1] - 8, position[1] + 8)
    const isRecentKicker = (
      thisPlayer.playerID === matchDetails.ball.lastTouch.playerID &&
      matchDetails.ball.lastTouch.iterations < 5 &&
      matchDetails.ball.ballOverIterations.length > 0
    )
    if (isRecentKicker) continue
    // Si es un remate al arco en vuelo, lo resuelve thisPlayerIsInProximity / keepInBoundaries (atajada, bloqueo o gol)
    if (
      matchDetails.ball.ballOverIterations.length > 0 &&
      (matchDetails.ball.kickType === 'shot' || matchDetails.ball.kickType === 'freekick')
    ) {
      continue
    }
    // Si la pelota va alta en el aire (z > 12), no se controla simplemente caminando por debajo en movePlayers
    if ((position[2] || 0) > 12 && matchDetails.ball.ballOverIterations.length > 0) continue

    const closeWithPlayer = !!(xPosition && yPosition && withPlayer === false)
    if (inChallengeZone && withTeam !== team.teamID) {
      const role = thisPlayer.tacticalRole || thisPlayer.position
      const isAttacker = role === 'ST' || role === 'CAM' || thisPlayer.position === 'ST'
      const autoChallengeChance = isAttacker ? 10 : 52
      if (samePositionAsBall) {
        if (withPlayer === true && thisPlayer.hasBall === false && withTeam !== team.teamID) {
          if (action === 'slide' && !isAttacker) matchDetails = completeSlide(matchDetails, thisPlayer, team, opp)
          else if (action === 'tackle' && !isAttacker) matchDetails = completeTackleWhenCloseNoBall(matchDetails, thisPlayer, team, opp)
          else if (common.getRandomNumber(0, 100) < autoChallengeChance) matchDetails = completeTackleWhenCloseNoBall(matchDetails, thisPlayer, team, opp)
        } else if (withPlayer === false) {
          setClosePlayerTakesBall(matchDetails, thisPlayer, team, opp)
        }
      } else if (withPlayer === true && thisPlayer.hasBall === false && withTeam !== team.teamID) {
        if (action === 'slide' && !isAttacker) matchDetails = completeSlide(matchDetails, thisPlayer, team, opp)
        else if (action === 'tackle' && !isAttacker) matchDetails = completeTackleWhenCloseNoBall(matchDetails, thisPlayer, team, opp)
        else if (!isAttacker && common.getRandomNumber(0, 100) < 36) matchDetails = completeTackleWhenCloseNoBall(matchDetails, thisPlayer, team, opp)
      } else if (withPlayer === false && xPosition && yPosition) {
        setClosePlayerTakesBall(matchDetails, thisPlayer, team, opp)
      }
    } else if (closeWithPlayer) setClosePlayerTakesBall(matchDetails, thisPlayer, team, opp)
  }
  return team
}

export function executeBallAction(move, team, opp, matchDetails) {
  if (matchDetails.ball.ballOverIterations.length !== 0) return team
  const { player, action } = move
  handleBallPlayerActions(matchDetails, player, team, opp, action)
  if (!matchDetails.ball.withPlayer) {
    common.removeBallFromAllPlayers(matchDetails)
    matchDetails.ball.Player = ''
    matchDetails.ball.withPlayer = false
    matchDetails.ball.withTeam = ''
  }
  return team
}

export function setClosePlayerTakesBall(matchDetails, thisPlayer, team, opp) {
  if (!common.isOnPitch(thisPlayer)) return
  if (thisPlayer.offside) {
    matchDetails.iterationLog.push(`${thisPlayer.name} is offside`)
    if (Array.isArray(matchDetails.events)) {
      matchDetails.events.push({
        type: 'offside',
        teamID: team.teamID,
        teamName: team.name,
        playerName: thisPlayer.name,
        iteration: matchDetails.iterationCount || 0,
        half: matchDetails.half,
        deadBall: true
      })
    }
    if (team.name === matchDetails.kickOffTeam.name) setPositions.setSetpieceSecondTeam(matchDetails)
    else setPositions.setSetpieceKickOffTeam(matchDetails)
  } else {
    // Si venía de un pase pendiente de un compañero, sumar pase completado
    if (
      matchDetails.ball.isPendingPass &&
      matchDetails.ball.lastTouch.teamID === team.teamID &&
      matchDetails.ball.lastTouch.playerID !== thisPlayer.playerID
    ) {
      const passer = team.players.find(p => p.playerID === matchDetails.ball.lastTouch.playerID)
      if (passer) passer.stats.passes.on++
      if (team.teamID === matchDetails.kickOffTeam.teamID) {
        matchDetails.kickOffTeamStatistics.passesCompleted = (matchDetails.kickOffTeamStatistics.passesCompleted || 0) + 1
      } else {
        matchDetails.secondTeamStatistics.passesCompleted = (matchDetails.secondTeamStatistics.passesCompleted || 0) + 1
      }
    }
    matchDetails.ball.isPendingPass = false

    thisPlayer.hasBall = true
    matchDetails.ball.lastTouch.playerName = thisPlayer.name
    matchDetails.ball.lastTouch.playerID = thisPlayer.playerID
    matchDetails.ball.lastTouch.teamID = team.teamID
    matchDetails.ball.lastTouch.deflection = false
    matchDetails.ball.ballOverIterations = []
    matchDetails.ball.position = [thisPlayer.currentPOS[0], thisPlayer.currentPOS[1], 0]
    matchDetails.ball.Player = thisPlayer.playerID
    matchDetails.ball.withPlayer = true
    matchDetails.ball.withTeam = team.teamID
    team.intent = 'attack'
    opp.intent = 'defend'
  }
}

function sendPlayerOff(matchDetails, team, thisPlayer, reason = 'red') {
  thisPlayer.stats.cards.red++
  thisPlayer.sentOff = true
  thisPlayer.hasBall = false
  thisPlayer.currentPOS = ['NP', 'NP']
  matchDetails.iterationLog.push(`Red Card - ${thisPlayer.name} (${team.name})`)
  if (Array.isArray(matchDetails.events)) {
    matchDetails.events.push({
      type: 'redCard',
      reason,
      teamID: team.teamID,
      teamName: team.name,
      playerName: thisPlayer.name,
      iteration: matchDetails.iterationCount || 0,
      half: matchDetails.half
    })
  }
}

function giveYellowCard(matchDetails, team, thisPlayer) {
  thisPlayer.stats.cards.yellow++
  matchDetails.iterationLog.push(`Yellow Card - ${thisPlayer.name} (${team.name})`)
  if (Array.isArray(matchDetails.events)) {
    matchDetails.events.push({
      type: 'yellowCard',
      teamID: team.teamID,
      teamName: team.name,
      playerName: thisPlayer.name,
      iteration: matchDetails.iterationCount || 0,
      half: matchDetails.half
    })
  }
  if (thisPlayer.stats.cards.yellow >= 2) {
    sendPlayerOff(matchDetails, team, thisPlayer, 'secondYellow')
  }
}

export function completeSlide(matchDetails, thisPlayer, team, opp) {
  const foul = actions.resolveSlide(thisPlayer, team, opp, matchDetails)
  if (!foul) return matchDetails
  const intensity = actions.foulIntensity()
  if (common.isBetween(intensity, 77, 98)) {
    giveYellowCard(matchDetails, team, thisPlayer)
  } else if ( intensity >= 98) {
    sendPlayerOff(matchDetails, team, thisPlayer, 'directRed')
  }
  if (opp.name === matchDetails.kickOffTeam.name) return setPositions.setSetpieceKickOffTeam(matchDetails)
  return setPositions.setSetpieceSecondTeam(matchDetails)
}

export function completeTackleWhenCloseNoBall(matchDetails, thisPlayer, team, opp) {
  const foul = actions.resolveTackle(thisPlayer, team, opp, matchDetails)
  if (!foul) return matchDetails
  const intensity = actions.foulIntensity()
  if (common.isBetween(intensity, 85, 99)) {
    giveYellowCard(matchDetails, team, thisPlayer)
  } else if (intensity >= 99) {
    sendPlayerOff(matchDetails, team, thisPlayer, 'directRed')
  }
  if (opp.name === matchDetails.kickOffTeam.name) return setPositions.setSetpieceKickOffTeam(matchDetails)
  return setPositions.setSetpieceSecondTeam(matchDetails)
}

function completeMovement(matchDetails, currentPOS, move) {
  if (currentPOS[0] !== 'NP') {
    const intendedMovementX = currentPOS[0] + move[0]
    const intendedMovementY = currentPOS[1] + move[1]
    if (intendedMovementX < matchDetails.pitchSize[0] + 1 && intendedMovementX > -1) currentPOS[0] += move[0]
    if (intendedMovementY < matchDetails.pitchSize[1] + 1 && intendedMovementY > -1) currentPOS[1] += move[1]
  }
  return currentPOS
}

export function closestPlayerActionBallX(ballToPlayerX) {
  if (common.isBetween(ballToPlayerX, -30, 30) === false) {
    if (ballToPlayerX > 29) return 29
    return -29
  }
  return ballToPlayerX
}

export function closestPlayerActionBallY(ballToPlayerY) {
  if (common.isBetween(ballToPlayerY, -30, 30) === false) {
    if (ballToPlayerY > 29) return 29
    return -29
  }
  return ballToPlayerY
}

export function checkProvidedAction(matchDetails, thisPlayer, action) {
  const ballActions = ['shoot', 'throughBall', 'pass', 'cross', 'cleared', 'boot', 'penalty', 'freekickShot']
  const allActions = [
    'shoot', 'throughBall', 'pass', 'cross', 'tackle', 'intercept', 'slide',
    'run', 'sprint', 'cleared', 'boot', 'penalty', 'freekickShot'
  ]
  const providedAction = thisPlayer.action ? thisPlayer.action : 'unassigned'
  if (providedAction === 'none') return action
  if (allActions.includes(providedAction)) {
    if (thisPlayer.playerID !== matchDetails.ball.Player) {
      if (ballActions.includes(providedAction)) {
        thisPlayer.action = 'none'
        return 'run'
      }
      return providedAction
    }
    if (providedAction === 'tackle' || providedAction === 'slide' || providedAction === 'intercept') {
      action = ballActions[common.getRandomNumber(0, 5)]
      return action
    }
    return providedAction
  }
  return action
}

export function handleBallPlayerActions(matchDetails, thisPlayer, team, opp, action) {
  const ballActions = ['shoot', 'throughBall', 'pass', 'cross', 'cleared', 'boot', 'penalty', 'freekickShot']
  ballMovement.getBallDirection(matchDetails, thisPlayer.currentPOS)
  matchDetails.ball.position = [thisPlayer.currentPOS[0], thisPlayer.currentPOS[1], 0]
  if (ballActions.includes(action)) {
    ballMoved(matchDetails, thisPlayer, team, opp)
    if (action === 'cleared' || action === 'boot') {
      const newPosition = ballMovement.ballKicked(matchDetails, team, thisPlayer)
      updateInformation(matchDetails, newPosition)
    } else if (action === 'pass') {
      const newPosition = ballMovement.ballPassed(matchDetails, team, thisPlayer)
      matchDetails.iterationLog.push(`passed to new position: ${newPosition}`)
      updateInformation(matchDetails, newPosition)
    } else if (action === 'cross') {
      const newPosition = ballMovement.ballCrossed(matchDetails, team, thisPlayer)
      matchDetails.iterationLog.push(`crossed to new position: ${newPosition}`)
      updateInformation(matchDetails, newPosition)
    } else if (action === 'throughBall') {
      const newPosition = ballMovement.throughBall(matchDetails, team, thisPlayer)
      updateInformation(matchDetails, newPosition)
    } else if (action === 'shoot') {
      const newPosition = ballMovement.shotMade(matchDetails, team, thisPlayer)
      updateInformation(matchDetails, newPosition)
    } else if (action === 'freekickShot') {
      const newPosition = ballMovement.freekickShotMade(matchDetails, team, thisPlayer)
      updateInformation(matchDetails, newPosition)
    } else if (action === 'penalty') {
      const newPosition = ballMovement.penaltyTaken(matchDetails, team, thisPlayer)
      updateInformation(matchDetails, newPosition)
    }
  }
}

export function ballMoved(matchDetails, thisPlayer, team, opp) {
  thisPlayer.hasBall = false
  matchDetails.ball.withPlayer = false
  team.intent = 'attack'
  opp.intent = 'attack'
  matchDetails.ball.Player = ''
  matchDetails.ball.withTeam = ''
}

export function updateInformation(matchDetails, newPosition) {
  if (matchDetails.endIteration === true || !Array.isArray(newPosition)) return
  matchDetails.ball.position = [newPosition[0], newPosition[1], 0]
}

export function getMovement(player, action, opposition, ballX, ballY, matchDetails, team) {
  const { position } = matchDetails.ball
  const ballActions = ['shoot', 'throughBall', 'pass', 'cross', 'cleared', 'boot', 'penalty', 'freekickShot']
  if (action === 'wait' || ballActions.includes(action)) return [0, 0]
  if (action === 'tackle' || action === 'slide') {
    return getTackleMovement(ballX, ballY)
  }
  if (action === 'intercept') {
    return getInterceptMovement(player, opposition, position, matchDetails.pitchSize)
  }
  if (action === 'run') {
    return getRunMovement(matchDetails, player, ballX, ballY, team, opposition)
  }
  if (action === 'sprint') {
    return getSprintMovement(matchDetails, player, ballX, ballY, team, opposition)
  }
  return [0, 0]
}

function getTackleMovement(ballX, ballY) {
  const move = [0, 0]
  if (ballX > 0) move[0] = -Math.min(4, ballX)
  else if (ballX < 0) move[0] = Math.min(4, -ballX)
  if (ballY > 0) move[1] = -Math.min(4, ballY)
  else if (ballY < 0) move[1] = Math.min(4, -ballY)
  return move
}

function getInterceptMovement(player, opposition, ballPosition, pitchSize) {
  let move = [0, 0]
  const intcptPos = getInterceptPosition(player.currentPOS, opposition, ballPosition, pitchSize)
  const intcptPosX = player.currentPOS[0] - intcptPos[0]
  const intcptPosY = player.currentPOS[1] - intcptPos[1]
  if (intcptPosX === 0) {
    if (intcptPosY === 0) move = [0, 0]
    else if (intcptPosY < 0) move = [0, 1]
    else if (intcptPosY > 0) move = [0, -1]
  } else if (intcptPosY === 0) {
    if (intcptPosX < 0) move = [1, 0]
    else if (intcptPosX > 0) move = [-1, 0]
  } else if (intcptPosX < 0 && intcptPosY < 0) move = [1, 1]
  else if (intcptPosX > 0 && intcptPosY > 0) move = [-1, -1]
  else if (intcptPosX > 0 && intcptPosY < 0) move = [-1, 1]
  else if (intcptPosX < 0 && intcptPosY > 0) move = [1, -1]
  return move
}

function getInterceptPosition(currentPOS, opposition, ballPosition, pitchSize) {
  const BallPlyTraj = getInterceptTrajectory(opposition, ballPosition, pitchSize)
  const intcptPos = getClosestTrajPosition(currentPOS, BallPlyTraj, false)
  if (JSON.stringify(intcptPos) === JSON.stringify(currentPOS)) {
    const index = getClosestTrajPosition(currentPOS, BallPlyTraj, true)
    if (index > 0) return BallPlyTraj[index - 1]
  }
  return intcptPos
}

function getClosestTrajPosition(playerPos, BallPlyTraj, getIndex) {
  let intcptPos = playerPos
  let theDiff = 10000000
  let index = 0
  for (const thisPos of BallPlyTraj) {
    const xDiff = Math.abs(playerPos[0] - thisPos[0])
    const yDiff = Math.abs(playerPos[1] - thisPos[1])
    const totalDiff = xDiff + yDiff
    if (totalDiff < theDiff) {
      theDiff = totalDiff
      intcptPos = thisPos
    }
    if (JSON.stringify(thisPos) === JSON.stringify(playerPos) && getIndex) return index
    index++
  }
  return intcptPos
}

function getInterceptTrajectory(opposition, ballPosition, pitchSize) {
  const [pitchWidth, pitchHeight] = pitchSize
  const playerInformation = setPositions.closestPlayerToPosition(null, opposition, ballPosition)
  const interceptPlayer = playerInformation.thePlayer
  if (!interceptPlayer || !common.isOnPitch(interceptPlayer)) return [ballPosition]
  const targetX = pitchWidth / 2
  const targetY = (interceptPlayer.originPOS[1] < pitchHeight / 2) ? pitchHeight : 0
  const moveX = targetX - interceptPlayer.currentPOS[0]
  const moveY = targetY - interceptPlayer.currentPOS[1]
  const highNum = Math.max(1, Math.abs(moveX) <= Math.abs(moveY) ? Math.abs(moveY) : Math.abs(moveX))
  const xDiff = moveX / highNum
  const yDiff = moveY / highNum
  const POI = [interceptPlayer.currentPOS]
  for (let i = 0; i < Math.round(highNum); i++) {
    const lastArrayPOS = POI.length - 1
    const lastXPOS = POI[lastArrayPOS][0]
    const lastYPOS = POI[lastArrayPOS][1]
    POI.push([common.round(lastXPOS + xDiff, 0), common.round(lastYPOS + yDiff, 0)])
  }
  return POI
}

/**
 * Conducción inteligente en 7 carriles angulares (-72°, -45°, -22°, 0°, +22°, +45°, +72°):
 * - Si nadie lo marca, avanza decidido hacia el arco o por su carril.
 * - Si es extremo/lateral (o va por la banda), desborda hasta el fondo (distToGoalY < 92) antes de cerrarse.
 * - Si está en mitad de cancha con el centro congestionado, abre la cancha hacia el sector libre.
 */
function getSmartDribbleMove(matchDetails, player, step, opposition, team) {
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  const side = (player.originPOS[1] > pitchHeight / 2) ? 'bottom' : 'top'
  const baseAngle = side === 'bottom' ? -Math.PI / 2 : Math.PI / 2
  const anglesInRad = [
    baseAngle - 1.25, // -72° abrir fuerte la cancha a la izquierda
    baseAngle - 0.78, // -45° diagonal abierta
    baseAngle - 0.38, // -22° diagonal suave
    baseAngle,        // 0° frontal hacia el arco / línea de fondo
    baseAngle + 0.38, // +22° diagonal suave
    baseAngle + 0.78, // +45° diagonal abierta
    baseAngle + 1.25  // +72° abrir fuerte la cancha a la derecha
  ]

  const role = player.tacticalRole || player.position
  const hasTrait = (traitName) => Array.isArray(player.traits) && player.traits.includes(traitName)
  const isEncarador = hasTrait('fenomeno_encarador') || hasTrait('playmaker_gambeteador') || role === 'ST'
  const isVelocista = hasTrait('velocista_banda')
  const isWidePlayer = ['LM', 'RM', 'LB', 'RB'].includes(role) || isVelocista
  const inWideChannel = player.currentPOS[0] < 175 || player.currentPOS[0] > (pitchWidth - 175)
  const distToGoalY = side === 'bottom' ? player.currentPOS[1] : (pitchHeight - player.currentPOS[1])
  const playStyle = team?.playStyle || 'balanced'

  // Determinar el carril objetivo (desiredX) según el rol, la zona, la personalidad y la congestión rival
  let desiredX = player.originPOS[0]
  if (isEncarador && distToGoalY < 360) {
    // Delanteros y encaradores (Ronaldo Nazário, Messi, Agüero): fijan la mira directo al corazón del área
    desiredX = (pitchWidth / 2) + common.getRandomNumber(-15, 15)
  } else if (isWidePlayer || inWideChannel || playStyle === 'wingPlay') {
    const onLeft = player.currentPOS[0] < (pitchWidth / 2)
    if (isWidePlayer || inWideChannel) {
      // Corre bien abierto por la banda hasta llegar al fondo (distToGoalY < 92) antes de cerrar al área
      if (distToGoalY < 92) {
        desiredX = onLeft ? 215 : (pitchWidth - 215)
      } else {
        desiredX = onLeft ? 68 : (pitchWidth - 68)
      }
    } else if (distToGoalY > 210) {
      // Volante central en estilo por bandas tiende a abrir la jugada hacia la banda más libre
      const leftOpps = (opposition?.players || []).filter(op => common.isOnPitch(op) && op.currentPOS[0] < 240 && Math.abs(op.currentPOS[1] - player.currentPOS[1]) < 140).length
      const rightOpps = (opposition?.players || []).filter(op => common.isOnPitch(op) && op.currentPOS[0] > pitchWidth - 240 && Math.abs(op.currentPOS[1] - player.currentPOS[1]) < 140).length
      desiredX = leftOpps <= rightOpps ? 120 : (pitchWidth - 120)
    } else {
      desiredX = pitchWidth / 2
    }
  } else if (distToGoalY < 235) {
    // Atacante o volante llegando por el centro en zona de definición: encarar hacia el área
    desiredX = pitchWidth / 2
  } else {
    // En mitad de cancha: si hay congestión en el centro, abrir la cancha hacia el costado más despejado
    const centralCongestion = (opposition?.players || []).filter(
      op => common.isOnPitch(op) && Math.abs(op.currentPOS[0] - player.currentPOS[0]) < 65 &&
        ((side === 'bottom' ? (player.currentPOS[1] - op.currentPOS[1]) : (op.currentPOS[1] - player.currentPOS[1])) > 0) &&
        ((side === 'bottom' ? (player.currentPOS[1] - op.currentPOS[1]) : (op.currentPOS[1] - player.currentPOS[1])) < 110)
    ).length
    if (centralCongestion >= 2) {
      desiredX = player.currentPOS[0] < (pitchWidth / 2) ? 115 : (pitchWidth - 115)
    }
  }

  let bestMove = [0, side === 'bottom' ? -step : step]
  let bestScore = -999999

  for (const ang of anglesInRad) {
    const dx = Math.round(Math.cos(ang) * (step + 1))
    const dy = Math.round(Math.sin(ang) * (step + 1))
    const candX = player.currentPOS[0] + dx
    const candY = player.currentPOS[1] + dy

    if (candX < 18 || candX > pitchWidth - 18 || candY < 15 || candY > pitchHeight - 15) continue

    let minOppDist = 999
    if (opposition && Array.isArray(opposition.players)) {
      for (const opp of opposition.players) {
        if (!common.isOnPitch(opp) || (opp.stunnedTicks || 0) > 0) continue
        const d = common.distance([candX, candY], opp.currentPOS)
        if (d < minOppDist) minOppDist = d
      }
    }

    // Premiar fuertemente ir hacia donde hay espacio libre (esquivar marcas)
    const clearanceScore = Math.min(46, minOppDist) * 1.65
    // Premiar el avance hacia el arco rival (multiplicado para encaradores)
    const forwardProgress = side === 'bottom' ? -dy : dy
    const progressScore = forwardProgress * (isEncarador ? 9.8 : (team?.mentality === 'offensive' ? 8.2 : 6.8))
    // Afinidad hacia el carril táctico elegido (banda, abrir cancha o encarar al área)
    const xBefore = Math.abs(player.currentPOS[0] - desiredX)
    const xAfter = Math.abs(candX - desiredX)
    const laneScore = (xBefore - xAfter) * 2.8
    const jitter = common.getRandomNumber(-2, 2)

    const total = clearanceScore + progressScore + laneScore + jitter
    if (total > bestScore) {
      bestScore = total
      bestMove = [dx, dy]
    }
  }

  return bestMove
}

/**
 * Desplazamiento vectorial suave hacia un punto objetivo con desaceleración Arrive y separación anti-amontonamiento.
 */
function steerTowardsTarget(player, targetPOS, step, team, pitchSize) {
  const dx = targetPOS[0] - player.currentPOS[0]
  const dy = targetPOS[1] - player.currentPOS[1]
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist < 2) return [0, 0]

  // Desaceleración suave (Arrive Steering inspirado en open-football):
  // Si está cerca del destino (< 18px), desacelera cuadráticamente para llegar asentado y perfilado sin jittering
  let effectiveStep = step
  if (dist < 18) {
    const ratio = dist / 18
    effectiveStep = Math.max(0.6, step * ratio * ratio)
  }

  let vx = (dx / dist) * Math.min(effectiveStep, dist)
  let vy = (dy / dist) * Math.min(effectiveStep, dist)

  // Fuerza de separación para evitar aglutinamiento ("racimo de uvas") y mantener líneas de pase abiertas (36px)
  if (team && Array.isArray(team.players)) {
    for (const mate of team.players) {
      if (!common.isOnPitch(mate) || mate.playerID === player.playerID) continue
      const mx = player.currentPOS[0] - mate.currentPOS[0]
      const my = player.currentPOS[1] - mate.currentPOS[1]
      const mDist = Math.sqrt(mx * mx + my * my)
      if (mDist > 0 && mDist < 36) {
        const push = ((36 - mDist) / 36) * 2.2
        vx += (mx / mDist) * push
        vy += (my / mDist) * push
      }
    }
  }

  const finalDx = Math.max(-step, Math.min(step, Math.round(vx)))
  const finalDy = Math.max(-step, Math.min(step, Math.round(vy)))
  const nextX = player.currentPOS[0] + finalDx
  const nextY = player.currentPOS[1] + finalDy
  return [
    (nextX >= 8 && nextX <= pitchSize[0] - 8) ? finalDx : 0,
    (nextY >= 8 && nextY <= pitchSize[1] - 8) ? finalDy : 0
  ]
}

export function getRunMovement(matchDetails, player, ballX, ballY, team, opposition) {
  player.isSprinting = false
  player.sprintMomentum = Math.max(0, (player.sprintMomentum || 0) - 0.25)
  if (player.position !== 'GK' && player.fitness > 20) {
    const captainMultiplier = isCaptainOnPitch(team) ? 0.85 : 1.0
    const mentalityMultiplier = team?.mentality === 'offensive' ? 1.15 : (team?.mentality === 'defensive' ? 0.85 : 1.0)
    const drain = 0.018 * captainMultiplier * mentalityMultiplier
    player.fitness = common.round(Math.max(20, player.fitness - drain), 4)
    if (matchDetails.iterationCount % 35 === 0) updatePlayerEffectiveSkills(player, team)
  }
  let step = player.skill.agility >= 80 ? 3 : 2
  if (player.hasBall) {
    return getSmartDribbleMove(matchDetails, player, step, opposition, team)
  }

  // Si nuestro equipo tiene la posesión y el jugador apoya la jugada, avance coordinado sin atropellar
  if (matchDetails.ball.withTeam === team?.teamID && player.position !== 'GK') {
    const distToTarget = Array.isArray(player.intentPOS)
      ? common.distance(player.currentPOS, player.intentPOS)
      : 0
    if (distToTarget > 25) {
      step = player.skill.agility >= 84 ? 3.6 : 3.0
    }
  }

  // Solo ir directo a la pelota si está suelta muy cerca (< 48px)
  if (!matchDetails.ball.withPlayer && common.isBetween(ballX, -48, 48) && common.isBetween(ballY, -48, 48)) {
    return steerTowardsTarget(player, matchDetails.ball.position, step, team, matchDetails.pitchSize)
  }
  const target = Array.isArray(player.intentPOS) ? player.intentPOS : player.originPOS
  return steerTowardsTarget(player, target, step, team, matchDetails.pitchSize)
}

export function getSprintMovement(matchDetails, player, ballX, ballY, team, opposition) {
  player.isSprinting = true
  player.sprintMomentum = Math.min(1.0, (player.sprintMomentum || 0) + 0.25)
  if (player.position !== 'GK' && player.fitness > 20) {
    const captainMultiplier = isCaptainOnPitch(team) ? 0.85 : 1.0
    const mentalityMultiplier = team?.mentality === 'offensive' ? 1.20 : (team?.mentality === 'defensive' ? 0.90 : 1.0)
    const drain = 0.048 * captainMultiplier * mentalityMultiplier
    player.fitness = common.round(Math.max(20, player.fitness - drain), 4)
    if (matchDetails.iterationCount % 35 === 0) updatePlayerEffectiveSkills(player, team)
  }
  // Sprint explosivo: 6.5 a 9.5 px/tick según agilidad
  let baseStep = 6.5
  if (player.skill.agility >= 94) baseStep = 9.5
  else if (player.skill.agility >= 86) baseStep = 8.5
  else if (player.skill.agility >= 76) baseStep = 7.5
  else if (player.skill.agility < 65) baseStep = 5.5

  const step = player.fitness < 45
    ? Math.max(3.5, baseStep * (0.60 + ((player.fitness - 20) / 25) * 0.40))
    : baseStep

  if (player.hasBall) {
    return getSmartDribbleMove(matchDetails, player, step, opposition, team)
  }

  // Si este jugador es el destinatario de un pase en curso, correr directamente al destino del pase
  if (
    matchDetails.ball.isPendingPass &&
    matchDetails.ball.targetPlayerID === player.playerID &&
    Array.isArray(matchDetails.ball.targetPOS)
  ) {
    return steerTowardsTarget(player, matchDetails.ball.targetPOS, step + 1, team, matchDetails.pitchSize)
  }

  // Si es el jugador que presiona o busca una pelota a menos de 75px, ir hacia la pelota con vector suave
  if (common.isBetween(ballX, -75, 75) && common.isBetween(ballY, -75, 75)) {
    return steerTowardsTarget(player, matchDetails.ball.position, step, team, matchDetails.pitchSize)
  }
  const target = Array.isArray(player.intentPOS) ? player.intentPOS : player.originPOS
  return steerTowardsTarget(player, target, step, team, matchDetails.pitchSize)
}

export function closestPlayerToBall(closestPlayer, team, matchDetails) {
  let closestPlayerDetails = null
  const { position } = matchDetails.ball
  for (const thisPlayer of team.players) {
    if (!common.isOnPitch(thisPlayer)) continue
    const ballToPlayerX = Math.abs(thisPlayer.currentPOS[0] - position[0])
    const ballToPlayerY = Math.abs(thisPlayer.currentPOS[1] - position[1])
    const proximityToBall = ballToPlayerX + ballToPlayerY
    if (proximityToBall < closestPlayer.position) {
      closestPlayer.name = thisPlayer.name
      closestPlayer.position = proximityToBall
      closestPlayerDetails = thisPlayer
    }
  }
  if (!closestPlayerDetails) {
    closestPlayerDetails = team.players.find(common.isOnPitch) || team.players[0]
    closestPlayer.name = closestPlayerDetails.name
    closestPlayer.position = 0
  }
  setPositions.setIntentPosition(matchDetails, closestPlayerDetails)
  matchDetails.iterationLog.push(`Closest Player to ball: ${closestPlayerDetails.name}`)
}

export function checkOffside(team1, team2, matchDetails) {
  const { ball, pitchSize } = matchDetails
  const team1side = (team1.players[0].originPOS[1] < (pitchSize[1] / 2)) ? 'top' : 'bottom'
  if (!ball.withTeam) return matchDetails
  if (team1side === 'bottom') {
    team1atBottom(team1, team2, pitchSize[1])
  } else {
    team1atTop(team1, team2, pitchSize[1])
  }
}

function getTopMostPlayer(team, pitchHeight) {
  let player = team.players.find(common.isOnPitch) || team.players[0]
  let topMostPosition = pitchHeight
  for (const thisPlayer of team.players) {
    if (!common.isOnPitch(thisPlayer)) continue
    if (thisPlayer.currentPOS[1] < topMostPosition) {
      topMostPosition = thisPlayer.currentPOS[1]
      player = thisPlayer
    }
  }
  return player
}

function getBottomMostPlayer(team) {
  let player = team.players.find(common.isOnPitch) || team.players[0]
  let btmMostPosition = 0
  for (const thisPlayer of team.players) {
    if (!common.isOnPitch(thisPlayer)) continue
    if (thisPlayer.currentPOS[1] > btmMostPosition) {
      btmMostPosition = thisPlayer.currentPOS[1]
      player = thisPlayer
    }
  }
  return player
}

export function team1atBottom(team1, team2, pitchHeight) {
  const offT1Ypos = offsideYPOS(team2, 'top', pitchHeight)
  const topPlayer = getTopMostPlayer(team1, pitchHeight)
  const topPlayerOffsidePosition = common.isBetween(topPlayer.currentPOS[1], offT1Ypos.pos1, offT1Ypos.pos2)
  if (topPlayerOffsidePosition && topPlayer.hasBall) return
  for (const thisPlayer of team1.players) {
    thisPlayer.offside = false
    if (!common.isOnPitch(thisPlayer)) continue
    if (common.isBetween(thisPlayer.currentPOS[1], offT1Ypos.pos1, offT1Ypos.pos2)) {
      if (!thisPlayer.hasBall) thisPlayer.offside = true
    }
  }
  const offT2Ypos = offsideYPOS(team1, 'bottom', pitchHeight)
  const btmPlayer = getBottomMostPlayer(team2)
  const btmPlayerOffsidePosition = common.isBetween(btmPlayer.currentPOS[1], offT2Ypos.pos2, offT2Ypos.pos1)
  if (btmPlayerOffsidePosition && btmPlayer.hasBall) return
  for (const thisPlayer of team2.players) {
    thisPlayer.offside = false
    if (!common.isOnPitch(thisPlayer)) continue
    if (common.isBetween(thisPlayer.currentPOS[1], offT2Ypos.pos2, offT2Ypos.pos1)) {
      if (!thisPlayer.hasBall) thisPlayer.offside = true
    }
  }
}

export function team1atTop(team1, team2, pitchHeight) {
  const offT1Ypos = offsideYPOS(team2, 'bottom', pitchHeight)
  const btmPlayer = getBottomMostPlayer(team1)
  const btmPlayerOffsidePosition = common.isBetween(btmPlayer.currentPOS[1], offT1Ypos.pos2, offT1Ypos.pos1)
  if (btmPlayerOffsidePosition && btmPlayer.hasBall) return
  for (const thisPlayer of team1.players) {
    thisPlayer.offside = false
    if (!common.isOnPitch(thisPlayer)) continue
    if (common.isBetween(thisPlayer.currentPOS[1], offT1Ypos.pos2, offT1Ypos.pos1)) {
      if (!thisPlayer.hasBall) thisPlayer.offside = true
    }
  }
  const offT2Ypos = offsideYPOS(team1, 'top', pitchHeight)
  const topPlayer = getTopMostPlayer(team2, pitchHeight)
  const topPlayerOffsidePosition = common.isBetween(topPlayer.currentPOS[1], offT2Ypos.pos1, offT2Ypos.pos2)
  if (topPlayerOffsidePosition && topPlayer.hasBall) return
  for (const thisPlayer of team2.players) {
    thisPlayer.offside = false
    if (!common.isOnPitch(thisPlayer)) continue
    if (common.isBetween(thisPlayer.currentPOS[1], offT2Ypos.pos1, offT2Ypos.pos2)) {
      if (!thisPlayer.hasBall) thisPlayer.offside = true
    }
  }
}

function offsideYPOS(team, side, pitchHeight) {
  const offsideY = {
    pos1: 0,
    pos2: pitchHeight / 2
  }
  for (const thisPlayer of team.players) {
    if (!common.isOnPitch(thisPlayer)) continue
    if (thisPlayer.position === 'GK') {
      const [, position1] = thisPlayer.currentPOS
      offsideY.pos1 = position1
      if (thisPlayer.hasBall) {
        offsideY.pos2 = position1
        return offsideY
      }
    } else if (side === 'top') {
      if (thisPlayer.currentPOS[1] < offsideY.pos2) {
        offsideY.pos2 = thisPlayer.currentPOS[1]
      }
    } else if (side === 'bottom') {
      if (thisPlayer.currentPOS[1] > offsideY.pos2) {
        offsideY.pos2 = thisPlayer.currentPOS[1]
      }
    }
  }
  return offsideY
}
