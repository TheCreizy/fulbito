import * as common from './common.js'
import * as setPositions from './setPositions.js'
import { getPlayStyleConfig } from '../data/formations.js'

export function selectAction(possibleActions) {
  let goodActions = []
  for (const thisAction of possibleActions) {
    const pts = Math.max(0, Math.round(thisAction.points || 0))
    const tempArray = Array(pts).fill(thisAction.name)
    goodActions = goodActions.concat(tempArray)
  }
  if (goodActions[0] == null) return 'wait'
  return goodActions[common.getRandomNumber(0, goodActions.length - 1)]
}

export function findPossActions(player, team, opposition, ballX, ballY, matchDetails) {
  const possibleActions = populateActionsJSON()
  let params = []
  const { hasBall } = player
  const ballZ = matchDetails.ball.position[2] || 0
  if (hasBall === false) {
    params = playerDoesNotHaveBall(player, ballX, ballY, ballZ, matchDetails)
  } else {
    params = evaluateCarrierDecision(matchDetails, player, team, opposition)
  }
  return populatePossibleActions(possibleActions, player, matchDetails, ...params)
}

function pointToSegmentDist2D(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2
  if (l2 === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2)
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2
  t = Math.max(0.08, Math.min(0.95, t))
  const projX = x1 + t * (x2 - x1)
  const projY = y1 + t * (y2 - y1)
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2)
}

export function scanCarrierEnvironment(matchDetails, player, team, opposition) {
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  const isTopTeam = player.originPOS[1] < (pitchHeight / 2)
  const dir = isTopTeam ? 1 : -1
  const curX = player.currentPOS[0]
  const curY = player.currentPOS[1]
  const goalY = isTopTeam ? pitchHeight : 0
  const distToGoalY = isTopTeam ? (pitchHeight - curY) : curY

  let nearestOppDist = 999
  let nearestOppAheadDist = 999
  let nearbyOppsCount = 0
  let shotBlocked = false

  const oppPlayers = opposition?.players || []
  for (const opp of oppPlayers) {
    if (!common.isOnPitch(opp) || (opp.stunnedTicks || 0) > 0) continue
    const d = common.distance(player.currentPOS, opp.currentPOS)
    if (d < nearestOppDist) nearestOppDist = d
    if (d < 24) nearbyOppsCount++

    const forwardDelta = (opp.currentPOS[1] - curY) * dir
    const lateralDelta = Math.abs(opp.currentPOS[0] - curX)
    if (forwardDelta > -5 && lateralDelta <= Math.max(26, forwardDelta * 0.92)) {
      if (d < nearestOppAheadDist) nearestOppAheadDist = d
    }

    if (opp.position !== 'GK' && d < 65) {
      const segDist = pointToSegmentDist2D(opp.currentPOS[0], opp.currentPOS[1], curX, curY, pitchWidth / 2, goalY)
      if (segDist < 13 && forwardDelta > 0) {
        shotBlocked = true
      }
    }
  }

  const currentIter = matchDetails.iterationCount || 0
  let hasRunnerInBehind = false
  let hasSwitchOption = false
  let hasBetterPositionedMate = false
  let hasBoxTarget = false

  const teamPlayers = team?.players || []
  for (const mate of teamPlayers) {
    if (!common.isOnPitch(mate) || mate.playerID === player.playerID || mate.offside) continue
    const mX = mate.currentPOS[0]
    const mY = mate.currentPOS[1]
    const passDist = common.distance(player.currentPOS, mate.currentPOS)
    if (passDist < 24 || passDist > pitchHeight * 0.52) continue

    const forwardGain = (mY - curY) * dir
    let minOppToMate = 999
    let laneBlocked = false
    for (const opp of oppPlayers) {
      if (!common.isOnPitch(opp) || (opp.stunnedTicks || 0) > 0) continue
      const od = common.distance(mate.currentPOS, opp.currentPOS)
      if (od < minOppToMate) minOppToMate = od
      const sd = pointToSegmentDist2D(opp.currentPOS[0], opp.currentPOS[1], curX, curY, mX, mY)
      if (sd < 12) laneBlocked = true
    }

    const isActivelyRunning = !!(mate.offBallRun && mate.offBallRun.untilIteration > currentIter)
    if (!laneBlocked && forwardGain >= 28 && (isActivelyRunning || minOppToMate > 36)) {
      hasRunnerInBehind = true
    }
    if (!laneBlocked && forwardGain >= 42 && minOppToMate > 28) {
      hasBetterPositionedMate = true
    }
    if (Math.abs(mX - curX) >= 230 && (mX < 185 || mX > pitchWidth - 185) && minOppToMate > 38 && forwardGain > -35) {
      hasSwitchOption = true
    }
    const mateDistToGoalY = isTopTeam ? (pitchHeight - mY) : mY
    if (mateDistToGoalY < 165 && mX >= 195 && mX <= (pitchWidth - 195)) {
      hasBoxTarget = true
    }
  }

  return {
    isTopTeam,
    dir,
    distToGoalY,
    nearestOppDist,
    nearestOppAheadDist,
    nearbyOppsCount,
    shotBlocked,
    hasRunnerInBehind,
    hasSwitchOption,
    hasBetterPositionedMate,
    hasBoxTarget
  }
}

export function evaluateCarrierDecision(matchDetails, player, team, opposition) {
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  const { position, currentPOS, skill } = player
  const role = player.tacticalRole || position
  const styleCfg = getPlayStyleConfig(team?.playStyle, team?.formation)
  const env = scanCarrierEnvironment(matchDetails, player, team, opposition)
  const carrierTicks = (matchDetails.ball.lastCarrierID === player.playerID) ? (matchDetails.ball.carrierTicks || 1) : 1

  // 1. Arquero con pelota
  if (position === 'GK') {
    if (env.nearestOppDist < 28) return [0, 0, 35, 0, 0, 0, 0, 0, 0, 35, 30]
    return [0, 12, 74, 0, 0, 0, 0, 6, 0, 8, 0]
  }

  // 2. Límites de córner
  if (onBottomCornerBoundary(currentPOS, pitchWidth, pitchHeight) || onTopCornerBoundary(currentPOS, pitchWidth)) {
    return [0, 0, 22, 78, 0, 0, 0, 0, 0, 0, 0]
  }

  const inWideChannel = currentPOS[0] < 168 || currentPOS[0] > (pitchWidth - 168)
  const inCentralCorridor = currentPOS[0] >= 185 && currentPOS[0] <= (pitchWidth - 185)
  const dribbleSkill = ((Number(skill.agility) || 70) + (Number(skill.control) || 70)) / 2

  // 3. Desborde por las Bandas y Centros al Área
  if (inWideChannel && env.distToGoalY < 245) {
    if (env.distToGoalY > 95 && env.nearestOppAheadDist > 28) {
      const earlyCross = (env.hasBoxTarget && env.distToGoalY < 165) ? Math.round(16 * styleCfg.crossBoost) : 4
      const throughCut = env.hasRunnerInBehind ? 10 : 4
      return [0, throughCut, 6, earlyCross, 0, 0, 0, 14, 76, 0, 0]
    }
    const crossPts = Math.round((env.hasBoxTarget ? 64 : 46) * styleCfg.crossBoost)
    const gambetaOrCut = dribbleSkill >= 82 ? Math.round(20 * styleCfg.gambetaBoost) : 10
    const backPassPts = env.nearestOppDist < 18 ? 22 : 14
    return [0, 6, backPassPts, crossPts, 0, 0, 0, 4, gambetaOrCut, 0, 0]
  }

  // 4. Dentro del Área Rival y Borde Interno (Definición Realista)
  if (env.distToGoalY <= 178 && inCentralCorridor) {
    if (env.distToGoalY <= 105) {
      return [92, 0, 4, 0, 0, 0, 0, 0, 4, 0, 0]
    }
    if (!env.shotBlocked) {
      const shootPts = skill.shooting >= 80 ? 84 : 70
      return [shootPts, 4, 6, 0, 0, 0, 0, 2, 14, 0, 0]
    }
    const passToOpenMate = env.hasBetterPositionedMate || env.hasRunnerInBehind ? 30 : 18
    const dribbleInBox = Math.round(32 * styleCfg.gambetaBoost)
    return [46, 6, passToOpenMate, 0, 0, 0, 0, 4, dribbleInBox, 0, 0]
  }

  // 5. Puerta del Área / Medialuna (distToGoalY entre 179px y 240px)
  if (env.distToGoalY > 178 && env.distToGoalY <= 240) {
    let edgeShootPts = 0
    if (inCentralCorridor && !env.shotBlocked && skill.shooting >= 78) {
      edgeShootPts = skill.shooting >= 87 ? 38 : 24
      if (styleCfg.id === 'tikiTaka') edgeShootPts = Math.round(edgeShootPts * 0.72)
    }

    if (env.nearestOppAheadDist > 32 && env.nearestOppDist > 20) {
      const throughPts = env.hasRunnerInBehind ? Math.round(22 * styleCfg.throughBoost) : 8
      const switchPts = env.hasSwitchOption ? Math.round(12 * styleCfg.switchBoost) : 6
      return [edgeShootPts, throughPts, switchPts, 0, 0, 0, 0, 12, 58, 0, 0]
    }

    const gambetaPts = (env.nearbyOppsCount <= 1 && dribbleSkill >= 78) ? Math.round(36 * styleCfg.gambetaBoost) : 14
    const throughPts = env.hasRunnerInBehind ? Math.round(28 * styleCfg.throughBoost) : 12
    const passPts = (env.hasSwitchOption || env.hasBetterPositionedMate) ? 28 : 20
    return [edgeShootPts, throughPts, passPts, inWideChannel ? 24 : 4, 0, 0, 0, 8, gambetaPts, 0, 0]
  }

  // 6. Resto del Campo (Prohibido patear desde lejos > 235px, salvo cañonazo rarísimo de especialista libre en 236..265px)
  let rareLongShot = 0
  if (env.distToGoalY <= 265 && inCentralCorridor && !env.shotBlocked && env.nearestOppDist > 36 && skill.shooting >= 91) {
    rareLongShot = 6
  }

  // Si acaba de recibir la pelota (carrierTicks <= 2) y no tiene un rival encima, controla y conduce
  if (carrierTicks <= 2 && env.nearestOppDist > 18) {
    const instantBreakawayPass = (env.hasRunnerInBehind && styleCfg.id === 'directCounter') ? 14 : 4
    return [0, instantBreakawayPass, 4, 0, 0, 0, 0, 26, 66, 0, 0]
  }

  // Si tiene espacio libre adelante (nearestOppAheadDist > 38 y nearestOppDist > 22), avanza con la pelota
  if (env.nearestOppAheadDist > 38 && env.nearestOppDist > 22) {
    let throughInStride = 0
    let passInStride = 6
    if (env.hasRunnerInBehind && carrierTicks >= 3) {
      throughInStride = Math.round(24 * styleCfg.throughBoost)
    }
    if (env.hasSwitchOption && carrierTicks >= 4) {
      passInStride = Math.round(18 * styleCfg.switchBoost)
    } else if (env.hasBetterPositionedMate && carrierTicks >= 5) {
      passInStride = 16
    }
    const carrySprint = Math.max(48, 86 - throughInStride - passInStride)
    return [rareLongShot, throughInStride, passInStride, 0, 0, 0, 0, 14, carrySprint, 0, 0]
  }

  // Duelo 1v1 o presión cercana: Gambeta 1v1, Cambio de Frente, Pase Filtrado o Pausa
  const isDribblerRole = ['CAM', 'LM', 'RM', 'ST'].includes(role) || dribbleSkill >= 80
  if (env.nearbyOppsCount <= 1 && isDribblerRole && env.nearestOppDist >= 13) {
    const gambetaWeight = Math.round((dribbleSkill >= 85 ? 48 : 36) * styleCfg.gambetaBoost)
    const throughWeight = env.hasRunnerInBehind ? Math.round(26 * styleCfg.throughBoost) : 10
    const passWeight = env.hasSwitchOption
      ? Math.round(28 * styleCfg.switchBoost)
      : (env.hasBetterPositionedMate ? 26 : 18)
    return [rareLongShot, throughWeight, passWeight, 0, 0, 0, 0, 10, gambetaWeight, 0, 0]
  }

  const inOwnThird = env.distToGoalY > (pitchHeight * 0.72)
  const clearanceWeight = (inOwnThird && env.nearestOppDist < 15 && !env.hasBetterPositionedMate) ? 14 : 0
  const throughWeight = env.hasRunnerInBehind ? Math.round(26 * styleCfg.throughBoost) : 8
  const passWeight = env.hasSwitchOption
    ? Math.round(48 * styleCfg.switchBoost)
    : 46
  return [rareLongShot, throughWeight, passWeight, 0, 0, 0, 0, 14, 14, clearanceWeight, 0]
}

export function topTeamPlayerHasBall(matchDetails, player, team, opposition) {
  return evaluateCarrierDecision(matchDetails, player, team, opposition)
}

export function bottomTeamPlayerHasBall(matchDetails, player, team, opposition) {
  return evaluateCarrierDecision(matchDetails, player, team, opposition)
}

export function oppositionNearPlayer(oppositionPlayer, spaceX, spaceY) {
  if (!oppositionPlayer || !oppositionPlayer.proxPOS) return false
  const oppositionProximity = [Math.abs(oppositionPlayer.proxPOS[0]), Math.abs(oppositionPlayer.proxPOS[1])]
  return !!(oppositionProximity[0] < spaceX && oppositionProximity[1] < spaceY)
}

export function checkTeamMateSpaceClose(tmateProximity, lowX, highX, lowY, highY) {
  return !!(common.isBetween(tmateProximity[0], lowX, highX) && common.isBetween(tmateProximity[1], lowY, highY))
}

export function checkOppositionAhead(closePlayerPosition, currentPOS) {
  const closePlyX = common.isBetween(closePlayerPosition[0], currentPOS[0] - 4, currentPOS[0] + 4)
  return !!(closePlyX && closePlayerPosition[1] < currentPOS[1])
}

export function checkOppositionBelow(closePlayerPosition, currentPOS) {
  const closePlyX = common.isBetween(closePlayerPosition[0], currentPOS[0] - 4, currentPOS[0] + 4)
  return !!(closePlyX && closePlayerPosition[1] > currentPOS[1])
}

export function playerDoesNotHaveBall(player, ballX, ballY, ballZ, matchDetails) {
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  const { position, currentPOS, originPOS } = player
  if (position === 'GK') return [0, 0, 0, 0, 0, 0, 0, 60, 40, 0, 0]
  if (common.isBetween(ballX, -20, 20) && common.isBetween(ballY, -20, 20)) {
    return noBallNotGK2CloseBall(matchDetails, currentPOS, originPOS, pitchWidth, pitchHeight)
  }
  if (common.isBetween(ballX, -40, 40) && common.isBetween(ballY, -40, 40)) {
    return noBallNotGK4CloseBall(matchDetails, currentPOS, originPOS, pitchWidth, pitchHeight)
  }
  if (common.isBetween(ballX, -80, 80) && common.isBetween(ballY, -80, 80)) {
    if (matchDetails.ball.withPlayer === false) return [0, 0, 0, 0, 0, 0, 0, 60, 40, 0, 0]
    return [0, 0, 0, 0, 0, 40, 0, 30, 30, 0, 0]
  }
  return [0, 0, 0, 0, 0, 10, 0, 50, 30, 0, 0]
}

export function noBallNotGK4CloseBall(matchDetails, currentPOS, originPOS, pitchWidth, pitchHeight) {
  if (originPOS[1] > (pitchHeight / 2)) {
    return noBallNotGK4CloseBallBottomTeam(matchDetails, currentPOS, pitchWidth, pitchHeight)
  }
  if (checkPositionInTopPenaltyBox(currentPOS, pitchWidth, pitchHeight)) {
    if (matchDetails.ball.withPlayer === false) return [0, 0, 0, 0, 0, 0, 0, 20, 80, 0, 0]
    return [0, 0, 0, 0, 28, 22, 6, 14, 30, 0, 0]
  }
  if (matchDetails.ball.withPlayer === false) return [0, 0, 0, 0, 0, 0, 0, 20, 80, 0, 0]
  return [0, 0, 0, 0, 26, 34, 8, 16, 16, 0, 0]
}

export function noBallNotGK4CloseBallBottomTeam(matchDetails, currentPOS, pitchWidth, pitchHeight) {
  if (checkPositionInBottomPenaltyBox(currentPOS, pitchWidth, pitchHeight)) {
    if (matchDetails.ball.withPlayer === false) return [0, 0, 0, 0, 0, 0, 0, 20, 80, 0, 0]
    return [0, 0, 0, 0, 28, 22, 6, 14, 30, 0, 0]
  }
  if (matchDetails.ball.withPlayer === false) return [0, 0, 0, 0, 0, 0, 0, 20, 80, 0, 0]
  return [0, 0, 0, 0, 26, 34, 8, 16, 16, 0, 0]
}

export function noBallNotGK2CloseBall(matchDetails, currentPOS, originPOS, pitchWidth, pitchHeight) {
  if (originPOS[1] > (pitchHeight / 2)) {
    return noBallNotGK2CloseBallBottomTeam(matchDetails, currentPOS, pitchWidth, pitchHeight)
  }
  if (checkPositionInTopPenaltyBox(currentPOS, pitchWidth, pitchHeight)) {
    if (matchDetails.ball.withPlayer === false) return [0, 0, 0, 0, 0, 0, 0, 20, 80, 0, 0]
    return [0, 0, 0, 0, 42, 18, 6, 14, 20, 0, 0]
  }
  if (matchDetails.ball.withPlayer === false) return [0, 0, 0, 0, 0, 0, 0, 20, 80, 0, 0]
  return [0, 0, 0, 0, 56, 22, 10, 6, 6, 0, 0]
}

export function noBallNotGK2CloseBallBottomTeam(matchDetails, currentPOS, pitchWidth, pitchHeight) {
  if (checkPositionInBottomPenaltyBox(currentPOS, pitchWidth, pitchHeight)) {
    if (matchDetails.ball.withPlayer === false) return [0, 0, 0, 0, 0, 0, 0, 20, 80, 0, 0]
    return [0, 0, 0, 0, 44, 18, 6, 16, 16, 0, 0]
  }
  if (matchDetails.ball.withPlayer === false) return [0, 0, 0, 0, 0, 0, 0, 20, 80, 0, 0]
  return [0, 0, 0, 0, 56, 22, 10, 6, 6, 0, 0]
}

export function checkPositionInBottomPenaltyBox(position, pitchWidth, pitchHeight) {
  const yPos = common.isBetween(position[0], (pitchWidth / 4) - 5, pitchWidth - (pitchWidth / 4) + 5)
  const xPos = common.isBetween(position[1], pitchHeight - (pitchHeight / 6) + 5, pitchHeight)
  return !!(yPos && xPos)
}

export function checkPositionInBottomPenaltyBoxClose(position, pitchWidth, pitchHeight) {
  const yPos = common.isBetween(position[0], (pitchWidth / 3) - 5, pitchWidth - (pitchWidth / 3) + 5)
  const xPos = common.isBetween(position[1], (pitchHeight - (pitchHeight / 12) + 5), pitchHeight)
  return !!(yPos && xPos)
}

export function checkPositionInTopPenaltyBox(position, pitchWidth, pitchHeight) {
  const xPos = common.isBetween(position[0], (pitchWidth / 4) - 5, pitchWidth - (pitchWidth / 4) + 5)
  const yPos = common.isBetween(position[1], 0, (pitchHeight / 6) - 5)
  return !!(yPos && xPos)
}

export function checkPositionInTopPenaltyBoxClose(position, pitchWidth, pitchHeight) {
  const xPos = common.isBetween(position[0], (pitchWidth / 3) - 5, pitchWidth - (pitchWidth / 3) + 5)
  const yPos = common.isBetween(position[1], 0, (pitchHeight / 12) - 5)
  return !!(yPos && xPos)
}

export function onBottomCornerBoundary(position, pitchWidth, pitchHeight) {
  return !!(position[1] === pitchHeight && (position[0] === 0 || position[0] === pitchWidth))
}

export function onTopCornerBoundary(position, pitchWidth) {
  return !!(position[1] === 0 && (position[0] === 0 || position[0] === pitchWidth))
}

export function populatePossibleActions(possibleActions, player, matchDetails, a, b, c, d, e, f, g, h, i, j, k) {
  // Delanteros y enganches presionan/interceptan mucho más de lo que se tiran a barrer
  const role = player.tacticalRole || player.position
  let tacklePts = e
  let interceptPts = f
  let slidePts = g
  let runPts = h
  if (role === 'ST' || role === 'CAM' || player.position === 'ST') {
    const shiftedFromTackle = Math.round(tacklePts * 0.58)
    const shiftedFromSlide = Math.round(slidePts * 0.85)
    tacklePts -= shiftedFromTackle
    slidePts -= shiftedFromSlide
    interceptPts += Math.round((shiftedFromTackle + shiftedFromSlide) * 0.6)
    runPts += Math.round((shiftedFromTackle + shiftedFromSlide) * 0.4)
  }
  // Jugador amonestado (con amarilla) se cuida muchísimo más al marcar para no hacerse expulsar
  if ((player.stats?.cards?.yellow || 0) > 0) {
    const cautiousSlide = Math.round(slidePts * 0.85)
    const cautiousTackle = Math.round(tacklePts * 0.40)
    slidePts -= cautiousSlide
    tacklePts -= cautiousTackle
    interceptPts += cautiousSlide + cautiousTackle
  }

  possibleActions[0].points = a
  possibleActions[1].points = b
  possibleActions[2].points = c
  possibleActions[3].points = d
  possibleActions[4].points = tacklePts
  possibleActions[5].points = interceptPts
  possibleActions[6].points = slidePts
  possibleActions[7].points = runPts
  possibleActions[8].points = i
  possibleActions[9].points = j
  possibleActions[10].points = k
  possibleActions = adjustForBallHeight(possibleActions, player, matchDetails)
  possibleActions = normaliseActionObjects(possibleActions)
  return possibleActions
}

function populateActionsJSON() {
  return [
    { name: 'shoot', points: 0 },
    { name: 'throughBall', points: 0 },
    { name: 'pass', points: 0 },
    { name: 'cross', points: 0 },
    { name: 'tackle', points: 0 },
    { name: 'intercept', points: 0 },
    { name: 'slide', points: 0 },
    { name: 'run', points: 0 },
    { name: 'sprint', points: 0 },
    { name: 'cleared', points: 0 },
    { name: 'boot', points: 0 }
  ]
}

function calculateFoulProbability(tackler, carrier, isSlide = false) {
  const role = tackler.tacticalRole || tackler.position
  if (role === 'ST' || tackler.position === 'ST') {
    return isSlide ? 10 : 4
  }
  const tacklerSkill = Number(tackler.skill?.tackling || 60)
  const tacklerPer = Number(tackler.skill?.perception || 60)
  const carrierAgi = Number(carrier.skill?.agility || 65)
  const fatiguePenalty = (Number(tackler.fitness ?? 100) < 50) ? 5 : 0
  const baseChance = isSlide ? 28 : 16
  const skillDiff = (carrierAgi - (tacklerSkill * 0.75 + tacklerPer * 0.25)) * (isSlide ? 0.18 : 0.14)
  const minChance = isSlide ? 14 : 8
  const maxChance = isSlide ? 42 : 26
  return Math.max(minChance, Math.min(maxChance, Math.round(baseChance + skillDiff + fatiguePenalty)))
}

export function resolveTackle(player, team, opposition, matchDetails) {
  matchDetails.iterationLog.push(`Tackle attempted by: ${player.name}`)
  const tackleDetails = {
    injuryHigh: 1500,
    injuryLow: 1400,
    increment: 1
  }
  const index = opposition.players.findIndex(thisPlayer => thisPlayer.playerID === matchDetails.ball.Player)
  if (index === -1) return false
  const thatPlayer = opposition.players[index]
  player.stats.tackles.total++
  const foulProb = calculateFoulProbability(player, thatPlayer, false)
  if (common.getRandomNumber(1, 100) <= foulProb) {
    setFoul(matchDetails, team, player, thatPlayer)
    return true
  }
  if (calcTackleScore(player.skill, 5) > calcRetentionScore(thatPlayer.skill, 5)) {
    setSuccessTackle(matchDetails, team, opposition, player, thatPlayer, tackleDetails)
    return false
  }
  setFailedTackle(matchDetails, player, thatPlayer, tackleDetails)
  return false
}

export function resolveSlide(player, team, opposition, matchDetails) {
  matchDetails.iterationLog.push(`Slide tackle attempted by: ${player.name}`)
  const tackleDetails = {
    injuryHigh: 1500,
    injuryLow: 1400,
    increment: 3
  }
  const index = opposition.players.findIndex(thisPlayer => thisPlayer.playerID === matchDetails.ball.Player)
  if (index === -1) return false
  const thatPlayer = opposition.players[index]
  player.stats.tackles.total++
  const foulProb = calculateFoulProbability(player, thatPlayer, true)
  if (common.getRandomNumber(1, 100) <= foulProb) {
    setFoul(matchDetails, team, player, thatPlayer)
    return true
  }
  if (calcTackleScore(player.skill, 5) > calcRetentionScore(thatPlayer.skill, 5)) {
    setSuccessTackle(matchDetails, team, opposition, player, thatPlayer, tackleDetails)
    return false
  }
  setFailedTackle(matchDetails, player, thatPlayer, tackleDetails)
  return false
}

function setFailedTackle(matchDetails, player, thatPlayer, tackleDetails) {
  matchDetails.iterationLog.push(`Failed tackle by: ${player.name}`)
  player.stats.tackles.off++
  setInjury(matchDetails, player, thatPlayer, tackleDetails.injuryHigh, tackleDetails.injuryLow)
  setPostTacklePosition(matchDetails, thatPlayer, player, tackleDetails.increment)
}

function setSuccessTackle(matchDetails, team, opposition, player, thatPlayer, tackleDetails) {
  setPostTackleBall(matchDetails, team, opposition, player)
  matchDetails.iterationLog.push(`Successful tackle by: ${player.name}`)
  player.stats.tackles.on++
  setInjury(matchDetails, thatPlayer, player, tackleDetails.injuryLow, tackleDetails.injuryHigh)
  setPostTacklePosition(matchDetails, player, thatPlayer, tackleDetails.increment)
}

export function calcTackleScore(skill, diff) {
  return ((parseInt(skill.tackling, 10) + parseInt(skill.strength, 10)) / 2) + common.getRandomNumber(-diff, diff)
}

export function calcRetentionScore(skill, diff) {
  return ((parseInt(skill.agility, 10) + parseInt(skill.strength, 10)) / 2) + common.getRandomNumber(-diff, diff)
}

export function setPostTackleBall(matchDetails, team, opposition, player) {
  player.hasBall = true
  matchDetails.ball.lastTouch.playerName = player.name
  matchDetails.ball.lastTouch.playerID = player.playerID
  matchDetails.ball.lastTouch.teamID = team.teamID
  matchDetails.ball.lastTouch.deflection = false
  matchDetails.ball.position = [player.currentPOS[0], player.currentPOS[1], 0]
  matchDetails.ball.Player = player.playerID
  matchDetails.ball.withPlayer = true
  matchDetails.ball.withTeam = team.teamID
  matchDetails.ball.ballOverIterations = []
  team.intent = 'attack'
  opposition.intent = 'defend'
}

export function setPostTacklePosition(matchDetails, winningPlyr, losePlayer, increment) {
  const [, pitchHeight] = matchDetails.pitchSize
  if (losePlayer.originPOS[1] > pitchHeight / 2) {
    losePlayer.currentPOS[1] = common.upToMin(losePlayer.currentPOS[1] - increment, 0)
    matchDetails.ball.position[1] = common.upToMin(matchDetails.ball.position[1] - increment, 0)
    winningPlyr.currentPOS[1] = common.upToMax(winningPlyr.currentPOS[1] + increment, pitchHeight)
  } else {
    losePlayer.currentPOS[1] = common.upToMax(losePlayer.currentPOS[1] + increment, pitchHeight)
    matchDetails.ball.position[1] = common.upToMax(matchDetails.ball.position[1] + increment, pitchHeight)
    winningPlyr.currentPOS[1] = common.upToMin(winningPlyr.currentPOS[1] - increment, 0)
  }
}

export function setInjury(matchDetails, thatPlayer, player, tackledInjury, tacklerInjury) {
  if (common.isInjured(tackledInjury)) {
    thatPlayer.injured = true
    matchDetails.iterationLog.push(`Player Injured - ${thatPlayer.name}`)
  }
  if (common.isInjured(tacklerInjury)) {
    player.injured = true
    matchDetails.iterationLog.push(`Player Injured - ${player.name}`)
  }
}

export function setFoul(matchDetails, team, player, thatPlayer) {
  matchDetails.iterationLog.push(`Foul against: ${thatPlayer.name} by ${player.name}`)
  player.stats.tackles.fouls++
  if (team.teamID === matchDetails.kickOffTeam.teamID) matchDetails.kickOffTeamStatistics.fouls++
  else matchDetails.secondTeamStatistics.fouls++
  if (Array.isArray(matchDetails.events)) {
    matchDetails.events.push({
      type: 'foul',
      teamID: team.teamID,
      teamName: team.name,
      playerName: player.name,
      victimName: thatPlayer.name,
      iteration: matchDetails.iterationCount || 0,
      half: matchDetails.half,
      deadBall: true
    })
  }
}

export function wasFoul(x, y) {
  const foul = common.getRandomNumber(0, x)
  return common.isBetween(foul, 0, (y / 2) - 1)
}

export function foulIntensity() {
  return common.getRandomNumber(1, 99)
}

export function playerJumps(perception) {
  return common.isBetween(common.getRandomNumber(0, 100), 0, common.getRandomNumber(0, perception))
}

function normaliseActionObjects(actions) {
  const total = actions.reduce((sum, a) => sum + a.points, 0)
  if (total <= 0) return actions
  actions.forEach(a => {
    a.points = Math.round((a.points / total) * 100)
  })
  return actions
}

function adjustForBallHeight(actions, player, matchDetails) {
  const ballZ = matchDetails.ball.position[2] || 0
  const { withPlayer } = matchDetails.ball
  const pitchHeight = matchDetails.pitchSize[1]
  const groundMax = pitchHeight * 0.01
  const aerialMax = pitchHeight * 0.035
  const playerHeightMeters = player.height / 100
  const pitchHeightMeters = pitchHeight / 10
  const reachableHeight = (playerHeightMeters / pitchHeightMeters) * pitchHeight + (player.skill.jumping / 10)
  const settlingFrames = matchDetails.ball.settlingFrames || 0

  if (!withPlayer && ballZ > groundMax) {
    if (ballZ > reachableHeight) {
      actions[0].points = 0
      actions[1].points = 0
      actions[2].points = 0
      actions[3].points = 0
      actions[4].points = 0
      actions[6].points = 0
      actions[9].points += 25
      actions[10].points += 25
      return actions
    }
    const rawFactor = 1 - (ballZ / aerialMax)
    const heightFactor = Math.max(0, Math.min(1, rawFactor))
    actions[0].points *= heightFactor
    actions[1].points *= heightFactor
    actions[2].points *= heightFactor
    actions[3].points *= heightFactor
    actions[9].points += 15 * (1 - heightFactor)
    actions[10].points += 10 * (1 - heightFactor)
    return actions
  }
  if (withPlayer === true && matchDetails.ball.Player === player.playerID && ballZ > groundMax) {
    const rawFactor = 1 - (ballZ / aerialMax)
    const heightFactor = Math.max(0, Math.min(1, rawFactor))
    actions[7].points *= heightFactor
    actions[8].points *= heightFactor * 0.6
    actions[0].points *= 0.85
    actions[1].points *= 0.85
    actions[2].points *= 0.85
    if (settlingFrames > 0) {
      actions[8].points *= 0.2
      actions[1].points *= 0.5
      actions[3].points *= 0.5
      matchDetails.ball.settlingFrames--
    }
    return actions
  }
  return actions
}

export function extractBallActions(moves, type) {
  const ballActions = ['shoot', 'throughBall', 'pass', 'cross', 'cleared', 'boot', 'penalty', 'freekickShot']
  if (type === 'ball') return moves.filter(m => ballActions.includes(m.action))
  if (type === 'movement') return moves.filter(m => !ballActions.includes(m.action))
  return []
}
