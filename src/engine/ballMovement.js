import * as common from './common.js'
import * as setPositions from './setPositions.js'
import * as actions from './actions.js'
import { getPlayStyleConfig } from '../data/formations.js'

function getTeamStatisticsObject(matchDetails, team) {
  if (team && team.teamID === matchDetails.kickOffTeam.teamID) {
    return matchDetails.kickOffTeamStatistics
  }
  return matchDetails.secondTeamStatistics
}

export function moveBall(matchDetails) {
  const { ball } = matchDetails
  if (!ball.ballOverIterations || ball.ballOverIterations.length === 0) {
    ball.direction = 'wait'
    if (ball.position.length === 2) ball.position = [ball.position[0], ball.position[1], 0]
    return matchDetails
  }
  const currentPos = ball.position
  const nextPoint = ball.ballOverIterations[0]
  getBallDirection(matchDetails, nextPoint)
  const player = setBPlayer(nextPoint)
  const endPos = resolveBallMovement(player, matchDetails)

  if (matchDetails.endIteration === true) return matchDetails

  const safeEndPos = [
    Number(endPos[0] ?? currentPos[0]),
    Number(endPos[1] ?? currentPos[1]),
    Number(endPos[2] ?? 0)
  ]
  ball.position = safeEndPos
  matchDetails.iterationLog.push(`ball still moving from previous kick: ${safeEndPos}`)
  const lastTeamID = matchDetails.ball.lastTouch.teamID
  matchDetails = setPositions.keepInBoundaries(matchDetails, lastTeamID, safeEndPos)
  return matchDetails
}

export function setBPlayer(ballPos) {
  return {
    name: 'Ball',
    position: 'LB',
    rating: 100,
    skill: {
      passing: 100,
      shooting: 100,
      saving: 100,
      tackling: 100,
      agility: 100,
      strength: 100,
      penalty_taking: 100,
      freekick: 100,
      perception: 100,
      jumping: 100,
      control: 100
    },
    fitness: 100,
    height: 160,
    originPOS: ballPos,
    currentPOS: ballPos,
    injured: false
  }
}

export function ballKicked(matchDetails, team, player) {
  const { position } = matchDetails.ball
  const [, pitchHeight] = matchDetails.pitchSize
  matchDetails.iterationLog.push(`ball kicked by: ${player.name}`)
  matchDetails.ball.lastTouch.playerName = player.name
  matchDetails.ball.lastTouch.playerID = player.playerID
  matchDetails.ball.lastTouch.teamID = team.teamID
  matchDetails.ball.lastTouch.iterations = 0
  let newPos = [0, 0]
  const topTeamDirection = [
    'wait', 'north', 'north', 'north', 'north', 'east', 'east', 'west', 'west',
    'northeast', 'northeast', 'northeast', 'northwest', 'northwest', 'northwest'
  ]
  const bottomTeamDirection = [
    'wait', 'south', 'south', 'south', 'south', 'east', 'east', 'west', 'west',
    'southeast', 'southeast', 'southeast', 'southwest', 'southwest', 'southwest'
  ]
  let power = common.calculatePower(player.skill.strength, pitchHeight)
  const calcHeight = parseInt(player.height, 10) + parseInt((player.skill.jumping || 0), 10)
  const bodyPart = setAttackBodyPart(position, calcHeight)
  matchDetails.ball.lastTouch.bodyPart = bodyPart
  const isHeader = bodyPart === 'head'
  const isVolley = ['stomach', 'back', 'chest', 'shoulder'].includes(bodyPart)
  if (isHeader) {
    matchDetails.iterationLog.push(`Header made by: ${player.name}`)
    power *= 0.7
  } else if (isVolley) {
    matchDetails.iterationLog.push(`Volley kick made by: ${player.name}`)
    power *= 0.9
  }
  let direction
  if (player.originPOS[1] > (pitchHeight / 2)) {
    direction = topTeamDirection[common.getRandomNumber(0, topTeamDirection.length - 1)]
    newPos = getTopKickedPosition(direction, position, power)
  } else {
    direction = bottomTeamDirection[common.getRandomNumber(0, bottomTeamDirection.length - 1)]
    newPos = getBottomKickedPosition(direction, position, power)
  }
  return calcBallMovementOverTime(matchDetails, power, newPos, player, 'kick')
}

export function getTopKickedPosition(direction, position, power) {
  if (direction === 'wait') return newKickedPosition(position, 0, (power / 2), 0, (power / 2))
  if (direction === 'north') return newKickedPosition(position, -20, 20, -power, -(power / 2))
  if (direction === 'east') return newKickedPosition(position, (power / 2), power, -20, 20)
  if (direction === 'west') return newKickedPosition(position, -power, -(power / 2), -20, 20)
  if (direction === 'northeast') return newKickedPosition(position, 0, (power / 2), -power, -(power / 2))
  if (direction === 'northwest') return newKickedPosition(position, -(power / 2), 0, -power, -(power / 2))
  return newKickedPosition(position, -20, 20, -power, -(power / 2))
}

export function getBottomKickedPosition(direction, position, power) {
  if (direction === 'wait') return newKickedPosition(position, 0, (power / 2), 0, (power / 2))
  if (direction === 'south') return newKickedPosition(position, -20, 20, (power / 2), power)
  if (direction === 'east') return newKickedPosition(position, (power / 2), power, -20, 20)
  if (direction === 'west') return newKickedPosition(position, -power, -(power / 2), -20, 20)
  if (direction === 'southeast') return newKickedPosition(position, 0, (power / 2), (power / 2), power)
  if (direction === 'southwest') return newKickedPosition(position, -(power / 2), 0, (power / 2), power)
  return newKickedPosition(position, -20, 20, (power / 2), power)
}

function newKickedPosition(pos, lowX, highX, lowY, highY) {
  return [
    pos[0] + common.getRandomNumber(lowX, highX),
    pos[1] + common.getRandomNumber(lowY, highY)
  ]
}

export function shotMade(matchDetails, team, player) {
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  matchDetails.iterationLog.push(`Shot Made by: ${player.name}`)
  matchDetails.ball.lastTouch.playerName = player.name
  matchDetails.ball.lastTouch.playerID = player.playerID
  matchDetails.ball.lastTouch.teamID = team.teamID
  matchDetails.ball.lastTouch.iterations = 0
  const shotPosition = [0, 0]
  const PlyPos = player.currentPOS
  const attackingTop = player.originPOS[1] > pitchHeight / 2
  const distToGoalLine = attackingTop ? PlyPos[1] : (pitchHeight - PlyPos[1])
  let shotPower = Math.max(
    distToGoalLine + 35,
    common.calculatePower(player.skill.strength, pitchHeight)
  )
  const thisTeamStats = getTeamStatisticsObject(matchDetails, team)

  thisTeamStats.shots.total++
  player.stats.shots.total++
  const calcHeight = parseInt(player.height, 10) + parseInt((player.skill.jumping || 0), 10)
  const bodyPart = setAttackBodyPart(matchDetails.ball.position, calcHeight)
  matchDetails.ball.lastTouch.bodyPart = bodyPart
  const isHeader = bodyPart === 'head'
  const isVolley = ['stomach', 'back', 'chest', 'shoulder'].includes(bodyPart)
  if (isHeader) {
    matchDetails.iterationLog.push(`Header Shot by: ${player.name}`)
    shotPower = Math.max(distToGoalLine + 20, shotPower * 0.82)
  } else if (isVolley) {
    matchDetails.iterationLog.push(`Volley Shot by: ${player.name}`)
    shotPower = Math.max(distToGoalLine + 25, shotPower * 0.92)
  }

  // Penalización leve por distancia si patea desde afuera del área (> 175px)
  const distancePenalty = distToGoalLine > 175 ? Math.round((distToGoalLine - 175) * 0.14) : 0
  let shootingRoll = common.getRandomNumber(18, 92) + distancePenalty
  if (isVolley) shootingRoll += 4
  if (isHeader) shootingRoll += 3

  const centreGoal = pitchWidth / 2
  if (player.skill.shooting >= shootingRoll) {
    thisTeamStats.shots.on++
    player.stats.shots.on++
    shotPosition[0] = common.getRandomNumber(centreGoal - 41, centreGoal + 41)
    matchDetails.iterationLog.push(`Shot On Target at X Position ${shotPosition[0]}`)
    shotPosition[1] = attackingTop ? -1 : (pitchHeight + 1)
    if (Array.isArray(matchDetails.events)) {
      matchDetails.events.push({
        type: 'shot',
        onTarget: true,
        teamID: team.teamID,
        teamName: team.name,
        playerName: player.name,
        iteration: matchDetails.iterationCount || 0,
        half: matchDetails.half
      })
    }
  } else {
    thisTeamStats.shots.off++
    player.stats.shots.off++
    // Los tiros desviados pasan cerca de los palos (nunca hacia el córner ni a mitad de camino)
    const missLeft = common.getRandomNumber(0, 10) > 5
    const maxMissSpread = Math.min(54, Math.max(22, 65 - Math.round((player.skill.shooting || 70) * 0.4)))
    shotPosition[0] = missLeft
      ? common.getRandomNumber(centreGoal - 46 - maxMissSpread, centreGoal - 47)
      : common.getRandomNumber(centreGoal + 47, centreGoal + 46 + maxMissSpread)
    matchDetails.iterationLog.push(`Shot Off Target at X Position ${shotPosition[0]}`)
    shotPosition[1] = attackingTop ? -2 : (pitchHeight + 2)
    if (Array.isArray(matchDetails.events)) {
      matchDetails.events.push({
        type: 'shot',
        onTarget: false,
        teamID: team.teamID,
        teamName: team.name,
        playerName: player.name,
        iteration: matchDetails.iterationCount || 0,
        half: matchDetails.half
      })
    }
  }
  const endPos = calcBallMovementOverTime(matchDetails, shotPower, shotPosition, player, 'shot')
  if (matchDetails.endIteration === true) return endPos
  checkGoalScored(matchDetails)
  return endPos
}

/**
 * Remate directo de tiro libre usando el atributo freekick (FK) del ejecutor.
 */
export function freekickShotMade(matchDetails, team, player) {
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  player.action = 'none'
  matchDetails.iterationLog.push(`Direct Freekick Shot by: ${player.name}`)
  matchDetails.ball.lastTouch.playerName = player.name
  matchDetails.ball.lastTouch.playerID = player.playerID
  matchDetails.ball.lastTouch.teamID = team.teamID
  matchDetails.ball.lastTouch.iterations = 0
  matchDetails.ball.lastTouch.bodyPart = 'foot'

  const fkSkill = Number(player.skill.freekick || player.skill.shooting || 70)
  const shotPower = Math.max(
    pitchHeight * 0.32,
    common.calculatePower(Math.max(player.skill.strength, fkSkill), pitchHeight)
  )
  const thisTeamStats = getTeamStatisticsObject(matchDetails, team)
  thisTeamStats.shots.total++
  player.stats.shots.total++

  const centreGoal = pitchWidth / 2
  const shotPosition = [0, 0]
  const fkRoll = common.getRandomNumber(25, 98)
  if (fkSkill >= fkRoll) {
    thisTeamStats.shots.on++
    player.stats.shots.on++
    shotPosition[0] = common.getRandomNumber(centreGoal - 40, centreGoal + 40)
    matchDetails.iterationLog.push(`Freekick Shot On Target by: ${player.name}`)
    if (player.originPOS[1] > pitchHeight / 2) shotPosition[1] = -1
    else shotPosition[1] = pitchHeight + 1
  } else {
    thisTeamStats.shots.off++
    player.stats.shots.off++
    const left = common.getRandomNumber(0, 10) > 5
    shotPosition[0] = left
      ? common.getRandomNumber(centreGoal - 88, centreGoal - 47)
      : common.getRandomNumber(centreGoal + 47, centreGoal + 88)
    matchDetails.iterationLog.push(`Freekick Shot Off Target by: ${player.name}`)
    if (player.originPOS[1] > pitchHeight / 2) shotPosition[1] = -2
    else shotPosition[1] = pitchHeight + 2
  }

  const endPos = calcBallMovementOverTime(matchDetails, shotPower, shotPosition, player, 'freekick')
  if (matchDetails.endIteration === true) return endPos
  checkGoalScored(matchDetails)
  return endPos
}

export function penaltyTaken(matchDetails, team, player) {
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  player.action = 'none'
  matchDetails.iterationLog.push(`Penalty Taken by: ${player.name}`)
  matchDetails.ball.lastTouch.playerName = player.name
  matchDetails.ball.lastTouch.playerID = player.playerID
  matchDetails.ball.lastTouch.teamID = team.teamID
  matchDetails.ball.lastTouch.iterations = 0
  const calcHeight = parseInt(player.height, 10) + parseInt((player.skill.jumping || 0), 10)
  const bodyPart = setAttackBodyPart(matchDetails.ball.position, calcHeight)
  matchDetails.ball.lastTouch.bodyPart = bodyPart
  const shotPosition = [0, 0]
  const shotPower = common.calculatePower(Math.max(75, player.skill.strength), pitchHeight)
  const attackingTop = player.originPOS[1] > pitchHeight / 2
  const centreGoal = pitchWidth / 2
  const thisTeamStats = getTeamStatisticsObject(matchDetails, team)

  thisTeamStats.shots.total++
  player.stats.shots.total++
  if (player.skill.penalty_taking >= common.getRandomNumber(12, 95)) {
    thisTeamStats.shots.on++
    player.stats.shots.on++
    shotPosition[0] = common.getRandomNumber(centreGoal - 41, centreGoal + 41)
    matchDetails.iterationLog.push(`Shot On Target at X Position ${shotPosition[0]}`)
    shotPosition[1] = attackingTop ? -1 : (pitchHeight + 1)
  } else {
    thisTeamStats.shots.off++
    player.stats.shots.off++
    const left = common.getRandomNumber(0, 10) > 5
    shotPosition[0] = left
      ? common.getRandomNumber(centreGoal - 75, centreGoal - 47)
      : common.getRandomNumber(centreGoal + 47, centreGoal + 75)
    matchDetails.iterationLog.push(`Shot Off Target at X Position ${shotPosition[0]}`)
    shotPosition[1] = attackingTop ? -2 : (pitchHeight + 2)
  }
  const endPos = calcBallMovementOverTime(matchDetails, shotPower, shotPosition, player, 'shot')
  if (matchDetails.endIteration === true) return endPos
  checkGoalScored(matchDetails)
  return endPos
}

export function checkGoalScored(matchDetails) {
  const { ball, kickOffTeam, secondTeam } = matchDetails
  const [pitchWidth, pitchHeight, goalWidth] = matchDetails.pitchSize
  const ballZ = ball.position[2] || 0
  const centreGoal = pitchWidth / 2
  const goalEdge = goalWidth / 2
  const goalX = common.isBetween(ball.position[0], centreGoal - goalEdge, centreGoal + goalEdge)
  const KOGoalie = kickOffTeam.players[0]
  const STGoalie = secondTeam.players[0]
  const ballProx = 9
  const [ballX, ballY] = ball.position
  const nearKOGoalieX = common.isBetween(ballX, KOGoalie.currentPOS[0] - ballProx, KOGoalie.currentPOS[0] + ballProx)
  const nearKOGoalieY = common.isBetween(ballY, KOGoalie.currentPOS[1] - ballProx, KOGoalie.currentPOS[1] + ballProx)
  const nearSTGoalieX = common.isBetween(ballX, STGoalie.currentPOS[0] - ballProx, STGoalie.currentPOS[0] + ballProx)
  const nearSTGoalieY = common.isBetween(ballY, STGoalie.currentPOS[1] - ballProx, STGoalie.currentPOS[1] + ballProx)
  const KOrHeight = KOGoalie.height + KOGoalie.skill.jumping
  const STrHeight = STGoalie.height + STGoalie.skill.jumping
  const KTGSaving = KOGoalie.skill.saving
  const STGSaving = STGoalie.skill.saving

  if (nearKOGoalieX && nearKOGoalieY && ballZ < KOrHeight && KTGSaving > common.getRandomNumber(0, 100)) {
    matchDetails = setPositions.setGoalieHasBall(matchDetails, KOGoalie)
    if (common.inTopPenalty(matchDetails, ball.position) || common.inBottomPenalty(matchDetails, ball.position)) {
      matchDetails.iterationLog.push(`ball saved by ${KOGoalie.name} possesion to ${kickOffTeam.name}`)
      KOGoalie.stats.saves++
      if (Array.isArray(matchDetails.events)) {
        matchDetails.events.push({
          type: 'save',
          teamID: kickOffTeam.teamID,
          teamName: kickOffTeam.name,
          playerName: KOGoalie.name,
          iteration: matchDetails.iterationCount || 0,
          half: matchDetails.half
        })
      }
    }
    matchDetails.endIteration = true
  } else if (nearSTGoalieX && nearSTGoalieY && ballZ < STrHeight && STGSaving > common.getRandomNumber(0, 100)) {
    matchDetails = setPositions.setGoalieHasBall(matchDetails, STGoalie)
    if (common.inTopPenalty(matchDetails, ball.position) || common.inBottomPenalty(matchDetails, ball.position)) {
      matchDetails.iterationLog.push(`ball saved by ${STGoalie.name} possesion to ${secondTeam.name}`)
      STGoalie.stats.saves++
      if (Array.isArray(matchDetails.events)) {
        matchDetails.events.push({
          type: 'save',
          teamID: secondTeam.teamID,
          teamName: secondTeam.name,
          playerName: STGoalie.name,
          iteration: matchDetails.iterationCount || 0,
          half: matchDetails.half
        })
      }
    }
    matchDetails.endIteration = true
  } else if (goalX) {
    const kickOffTeamSide = (kickOffTeam.players[0].originPOS[1] < (pitchHeight / 2)) ? 'top' : 'bottom'
    if (ball.position[1] < 1) {
      if (kickOffTeamSide === 'top') matchDetails = setPositions.setSecondTeamGoalScored(matchDetails)
      else matchDetails = setPositions.setKickOffTeamGoalScored(matchDetails)
    } else if (ball.position[1] >= pitchHeight) {
      if (kickOffTeamSide === 'top') matchDetails = setPositions.setKickOffTeamGoalScored(matchDetails)
      else matchDetails = setPositions.setSecondTeamGoalScored(matchDetails)
    }
  }
}

export function throughBall(matchDetails, team, player) {
  const { pitchSize } = matchDetails
  const [pitchWidth, pitchHeight] = pitchSize
  const ballPos = matchDetails.ball.position
  matchDetails.ball.lastTouch.playerName = player.name
  matchDetails.ball.lastTouch.playerID = player.playerID
  matchDetails.ball.lastTouch.teamID = team.teamID
  matchDetails.ball.lastTouch.iterations = 0
  matchDetails.iterationLog.push(`through ball attempted by: ${player.name}`)
  player.stats.passes.total++
  const teamStats = getTeamStatisticsObject(matchDetails, team)
  teamStats.passesTotal = (teamStats.passesTotal || 0) + 1

  const power = common.calculatePower(player.skill.strength, pitchHeight)
  const maxDist = power * 1.15
  const aTop = player.originPOS[1] > (pitchHeight / 2)
  const dir = aTop ? -1 : 1
  const opposition = (team.teamID === matchDetails.kickOffTeam.teamID) ? matchDetails.secondTeam : matchDetails.kickOffTeam
  const currentIter = matchDetails.iterationCount || 0
  const styleCfg = getPlayStyleConfig(team?.playStyle, team?.formation)
  const teammates = getPlayersInDistance(team, player, pitchSize, opposition, currentIter)
  if (!teammates || teammates.length === 0) return matchDetails

  const candidates = teammates.filter(p => {
    if (p.offside || p.role === 'GK') return false
    const forward = aTop ? ballPos[1] - p.position[1] : p.position[1] - ballPos[1]
    if (forward < 15) return false
    const d = common.distance(ballPos, p.position)
    return d <= maxDist && d >= 32
  })
  if (candidates.length === 0) {
    return ballPassed(matchDetails, team, player)
  }
  candidates.sort((a, b) => tballScoreOption(b, aTop, ballPos, maxDist, styleCfg) - tballScoreOption(a, aTop, ballPos, maxDist, styleCfg))
  const targetPlayer = candidates[0]
  matchDetails.iterationLog.push(`through ball target: ${targetPlayer.name}`)

  // Calcular el punto de encuentro en carrera (al vacío adelante del receptor o hacia su diagonal activa)
  const passDist = common.distance(ballPos, targetPlayer.position)
  let leadX = targetPlayer.position[0]
  let leadY = targetPlayer.position[1]
  if (targetPlayer.offBallRun && targetPlayer.offBallRun.untilIteration > currentIter) {
    leadX = targetPlayer.position[0] + (targetPlayer.offBallRun.targetX - targetPlayer.position[0]) * 0.55
    leadY = targetPlayer.position[1] + (targetPlayer.offBallRun.targetY - targetPlayer.position[1]) * 0.55
  } else {
    const leadDistance = Math.min(72, Math.max(28, passDist * 0.34))
    leadY = targetPlayer.position[1] + (dir * leadDistance)
    if (targetPlayer.position[0] < 165) leadX = Math.max(48, targetPlayer.position[0] - 8)
    else if (targetPlayer.position[0] > pitchWidth - 165) leadX = Math.min(pitchWidth - 48, targetPlayer.position[0] + 8)
  }

  // Asegurar que el pase al vacío no se vaya afuera de la línea de fondo
  leadX = Math.max(28, Math.min(pitchWidth - 28, leadX))
  leadY = Math.max(32, Math.min(pitchHeight - 32, leadY))

  const accuracyFactor = Math.max(0.025, (100 - player.skill.passing) / 100)
  const spread = Math.min(10, passDist * 0.08 * accuracyFactor)
  const finalTarget = [
    common.round(leadX + common.getRandomNumber(-spread, spread), 0),
    common.round(leadY + common.getRandomNumber(-spread, spread), 0)
  ]
  const realTargetPlayer = team.players.find(p => p.playerID === targetPlayer.playerID)
  if (realTargetPlayer) {
    realTargetPlayer.intentPOS = [finalTarget[0], finalTarget[1]]
    matchDetails.ball.targetPlayerID = realTargetPlayer.playerID
    matchDetails.ball.targetPOS = [finalTarget[0], finalTarget[1]]
  }
  if (Array.isArray(matchDetails.events) && passDist > 135) {
    matchDetails.events.push({
      type: 'throughBall',
      teamID: team.teamID,
      teamName: team.name,
      playerName: player.name,
      receiverName: targetPlayer.name,
      iteration: currentIter,
      half: matchDetails.half
    })
  }
  matchDetails.ball.lastTouch.bodyPart = setAttackBodyPart([0, 0, 0], 100)
  const finalDist = common.distance(ballPos, finalTarget)
  return calcBallMovementOverTime(matchDetails, Math.max(power, finalDist * 1.25), finalTarget, player, 'through')
}

function tballScoreOption(p, attackingTop, ballPos, maxDistance, styleCfg) {
  let score = 0
  const d = common.distance(ballPos, p.position)
  const forward = attackingTop ? ballPos[1] - p.position[1] : p.position[1] - ballPos[1]
  score += forward * 1.9
  score += Math.min(55, p.minOppDist || 25) * 1.35
  if (p.offBallRun) {
    score += 75 * (styleCfg?.throughBoost || 1.2)
  }
  if (!p.isMarked) score += 45
  if (p.laneBlocked && d < 210) score -= 85
  if (p.position[0] < 170 || p.position[0] > 510) {
    score += styleCfg?.id === 'wingPlay' ? 42 : 26
  }
  if (['ST', 'LM', 'RM', 'CAM'].includes(p.role)) score += 25
  return score
}

function pointToSegmentDist(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2
  if (l2 === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2)
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2
  t = Math.max(0.08, Math.min(0.95, t))
  const projX = x1 + t * (x2 - x1)
  const projY = y1 + t * (y2 - y1)
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2)
}

function getPlayersInDistance(team, player, pitchSize, opposition = null, currentIter = 0) {
  const [pitchWidth, pitchHeight] = pitchSize
  const playersInDistance = []
  const oppPlayers = opposition?.players || []
  for (const teamPlayer of team.players) {
    if (!common.isOnPitch(teamPlayer)) continue
    if (teamPlayer.playerID !== player.playerID) {
      const onPitchX = common.isBetween(teamPlayer.currentPOS[0], -1, pitchWidth + 1)
      const onPitchY = common.isBetween(teamPlayer.currentPOS[1], -1, pitchHeight + 1)
      if (onPitchX && onPitchY) {
        const playerToPlayerX = player.currentPOS[0] - teamPlayer.currentPOS[0]
        const playerToPlayerY = player.currentPOS[1] - teamPlayer.currentPOS[1]
        const proximityToBall = Math.abs(playerToPlayerX) + Math.abs(playerToPlayerY)
        let isMarked = false
        let laneBlocked = false
        let minOppDist = 999
        for (const opp of oppPlayers) {
          if (!common.isOnPitch(opp) || (opp.stunnedTicks || 0) > 0) continue
          const od = common.distance(teamPlayer.currentPOS, opp.currentPOS)
          if (od < minOppDist) minOppDist = od
          if (od < 20) {
            isMarked = true
          }
          const segDist = pointToSegmentDist(
            opp.currentPOS[0], opp.currentPOS[1],
            player.currentPOS[0], player.currentPOS[1],
            teamPlayer.currentPOS[0], teamPlayer.currentPOS[1]
          )
          if (segDist < 13) {
            laneBlocked = true
          }
        }
        const activeRun = (teamPlayer.offBallRun && teamPlayer.offBallRun.untilIteration > currentIter)
          ? teamPlayer.offBallRun
          : null
        playersInDistance.push({
          id: teamPlayer.playerID,
          playerID: teamPlayer.playerID,
          role: teamPlayer.tacticalRole || teamPlayer.position,
          offside: !!teamPlayer.offside,
          isMarked,
          minOppDist,
          laneBlocked,
          offBallRun: activeRun,
          position: teamPlayer.currentPOS,
          proximity: proximityToBall,
          name: teamPlayer.name
        })
      }
    }
  }
  playersInDistance.sort((a, b) => a.proximity - b.proximity)
  return playersInDistance
}

export function resolveBallMovement(player, matchDetails) {
  const { kickOffTeam, secondTeam } = matchDetails
  const ballPos = matchDetails.ball.position
  const ballPow = matchDetails.ball.power || 60
  const ballPath = matchDetails.ball.ballOverIterations
  if (!ballPath || ballPath.length === 0) return matchDetails.ball.position
  const nextPos = ballPath[0]
  matchDetails.ball.ballOverIterations.shift()
  matchDetails.ball.lastTouch.iterations++
  const checkPos = [common.round(nextPos[0], 0), common.round(nextPos[1], 0), nextPos[2] || 0]
  const playerInfo1 = setPositions.closestPlayerToPosition(player, kickOffTeam, checkPos)
  const playerInfo2 = setPositions.closestPlayerToPosition(player, secondTeam, checkPos)
  const isTeam1Closer = playerInfo1.proxToBall <= playerInfo2.proxToBall
  const thisPlayer = isTeam1Closer ? playerInfo1.thePlayer : playerInfo2.thePlayer
  const thisTeam = isTeam1Closer ? kickOffTeam : secondTeam

  if (thisPlayer) thisPlayerIsInProximity(matchDetails, thisPlayer, ballPos, nextPos, ballPow, thisTeam)
  matchDetails.ball.position = nextPos
  return [common.round(nextPos[0], 2), common.round(nextPos[1], 2), common.round(nextPos[2] || 0, 2)]
}

export function thisPlayerIsInProximity(matchDetails, thisPlayer, thisPOS, thisPos, power, thisTeam) {
  if (!common.isOnPitch(thisPlayer)) return thisPOS
  const lastTouchPlayer = thisPlayer.playerID === matchDetails.ball.lastTouch.playerID
  const ballRecentlyKicked = matchDetails.ball.lastTouch.iterations < 4
  if (lastTouchPlayer && ballRecentlyKicked) return thisPOS
  const checkPos = [common.round(thisPos[0], 0), common.round(thisPos[1], 0), common.round(thisPos[2] || 0, 0)]
  const isGoalie = thisPlayer.position === 'GK'
  let jumpHeight = 10

  const isTeammateOfKicker = matchDetails.ball.lastTouch.teamID === thisTeam.teamID
  const isTargetReceiver = isTeammateOfKicker && matchDetails.ball.targetPlayerID === thisPlayer.playerID
  const proxRadius = isTargetReceiver ? 18 : (isTeammateOfKicker && matchDetails.ball.isPendingPass ? 14 : 8)

  const xPosProx = common.isBetween(thisPlayer.currentPOS[0], thisPos[0] - proxRadius, thisPos[0] + proxRadius)
  const yPosProx = common.isBetween(thisPlayer.currentPOS[1], thisPos[1] - proxRadius, thisPos[1] + proxRadius)
  const goaliexPosProx = common.isBetween(thisPlayer.currentPOS[0], thisPos[0] - 36, thisPos[0] + 36)
  const goalieyPosProx = common.isBetween(thisPlayer.currentPOS[1], thisPos[1] - 28, thisPos[1] + 28)
  const goaliezPodProx = common.isBetween(thisPOS[2] || 0, -1, (thisPlayer.height + thisPlayer.skill.jumping))

  const playerJump = actions.playerJumps(thisPlayer.skill.perception)
  if (playerJump) jumpHeight = common.getRandomNumber(10, Math.max(11, thisPlayer.skill.jumping))
  const calcHeight = (parseInt(thisPlayer.height, 10) + parseInt(jumpHeight, 10)) / 10
  const zPosProx = common.isBetween(thisPos[2] || 0, -1, calcHeight)

  if (isGoalie && goaliexPosProx && goalieyPosProx && goaliezPodProx && !isTeammateOfKicker && !matchDetails.ball.saveChecked) {
    if (common.isBetween(checkPos[2], -1, calcHeight + 4)) {
      matchDetails.ball.saveChecked = true
      const saving = thisPlayer.skill.saving || 70
      if (saving >= common.getRandomNumber(40, 122)) {
        matchDetails.ball.isPendingPass = false
        setBallMovementMatchDetails(matchDetails, thisPlayer, thisPos, thisTeam)
        matchDetails.iterationLog.push(`Ball saved by ${thisPlayer.name}`)
        thisPlayer.hasBall = true
        matchDetails.ball.lastTouch.deflection = false
        thisPlayer.stats.saves++
        if (Array.isArray(matchDetails.events)) {
          matchDetails.events.push({
            type: 'save',
            teamID: thisTeam.teamID,
            teamName: thisTeam.name,
            playerName: thisPlayer.name,
            iteration: matchDetails.iterationCount || 0,
            half: matchDetails.half
          })
        }
        matchDetails.ball.position[2] = 0
        matchDetails.endIteration = true
        return thisPos
      }
    }
  } else if (xPosProx && yPosProx && zPosProx) {
    if (matchDetails.ball.lastTouch.playerID !== thisPlayer.playerID) {
      // Si es un disparo al arco (shot/freekick), los compañeros del pateador dejan pasar la pelota hacia el arco
      if (
        (matchDetails.ball.kickType === 'shot' || matchDetails.ball.kickType === 'freekick') &&
        matchDetails.ball.lastTouch.teamID === thisTeam.teamID
      ) {
        return thisPOS
      }
      // Si es un pase de un compañero, pero este jugador NO es el destinatario y el destinatario está más adelante, dejarla pasar
      if (
        isTeammateOfKicker &&
        matchDetails.ball.isPendingPass &&
        matchDetails.ball.targetPlayerID &&
        matchDetails.ball.targetPlayerID !== thisPlayer.playerID &&
        matchDetails.ball.ballOverIterations.length > 2
      ) {
        return thisPOS
      }
      // Si es un rival intentando cortar un pase en tránsito, chequear capacidad de intercepción
      if (!isTeammateOfKicker && matchDetails.ball.isPendingPass) {
        const interceptSkill = ((thisPlayer.skill.perception || 60) + (thisPlayer.skill.tackling || 60)) / 2
        if (common.getRandomNumber(0, 135) > interceptSkill) {
          return thisPOS
        }
      }
      const deflectPos = thisPlayer.currentPOS
      const newPOS = resolveDeflection(power, thisPOS, deflectPos, thisPlayer, thisTeam, calcHeight, matchDetails)
      return [common.round(newPOS[0], 2), common.round(newPOS[1], 2)]
    }
  }
}

export function resolveDeflection(power, thisPOS, defPosition, defPlayer, defTeam, calcHeight, matchDetails) {
  const xMovement = (thisPOS[0] - defPosition[0]) ** 2
  const yMovement = (thisPOS[1] - defPosition[1]) ** 2
  const movementDistance = Math.sqrt(xMovement + yMovement)
  let newPower = Math.max(0, power - movementDistance)
  let tempPosition = [0, 0, 0]
  const { direction } = matchDetails.ball
  const isTeammatePass = (
    matchDetails.ball.isPendingPass &&
    matchDetails.ball.lastTouch.teamID === defTeam.teamID
  )

  // Si es un pase de un compañero, el receptor intenta controlarla con su atributo Control
  if (isTeammatePass) {
    if (common.getRandomNumber(0, 100) <= Math.max(65, (defPlayer.skill.control || 70) + 12)) {
      setDeflectionPlayerHasBall(thisPOS[2] || 0, matchDetails, defPlayer, defTeam)
      return defPosition
    }
  }

  if (newPower < 180 || checkIfBallControlled(defPlayer)) {
    if (!isTeammatePass && checkForHandball(thisPOS, calcHeight)) {
      matchDetails.ball.isPendingPass = false
      matchDetails.iterationLog.push(`Handball by ${defPlayer.name}`)
      if (defTeam.name === matchDetails.kickOffTeam.name) setPositions.setSetpieceSecondTeam(matchDetails)
      else setPositions.setSetpieceKickOffTeam(matchDetails)
      return defPosition
    }
    if (checkIfBallControlled(defPlayer)) {
      setDeflectionPlayerHasBall(thisPOS[2] || 0, matchDetails, defPlayer, defTeam)
      return defPosition
    }
    newPower = common.round(newPower / 3, 0)
  }
  matchDetails.ball.isPendingPass = false
  const bodyPart = setDeflectBodyPart(thisPOS, calcHeight)
  matchDetails.ball.lastTouch.bodyPart = bodyPart
  matchDetails.ball.lastTouch.deflection = true
  matchDetails.iterationLog.push(`ball deflected by ${defPlayer.name} ${bodyPart}`)
  defPlayer.hasBall = false
  matchDetails.ball.Player = ''
  matchDetails.ball.withPlayer = false
  matchDetails.ball.withTeam = ''
  tempPosition = setDeflectionDirectionPos(direction, defPosition, newPower)
  const lastTeamID = matchDetails.ball.lastTouch.teamID
  matchDetails = setPositions.keepInBoundaries(matchDetails, lastTeamID, tempPosition)
  const intended = matchDetails.ballIntended
  const lastPOS = intended ? intended.slice() : matchDetails.ball.position.slice()
  delete matchDetails.ballIntended
  matchDetails.endIteration = true
  return lastPOS
}

export function setBallMovementMatchDetails(matchDetails, thisPlayer, thisPos, thisTeam) {
  matchDetails.ball.ballOverIterations = []
  matchDetails.ball.Player = thisPlayer.playerID
  matchDetails.ball.withPlayer = true
  matchDetails.ball.lastTouch.playerName = thisPlayer.name
  matchDetails.ball.lastTouch.playerID = thisPlayer.playerID
  matchDetails.ball.lastTouch.teamID = thisTeam.teamID
  matchDetails.ball.withTeam = thisTeam.teamID
  matchDetails.ball.position = [thisPos[0], thisPos[1], thisPos[2] || 0]
  thisPlayer.currentPOS = [thisPos[0], thisPos[1]]
}

function checkForHandball(thisPOS, calcHeight) {
  if (!calcHeight) return false
  const ratio = (thisPOS[2] || 0) / calcHeight
  if (ratio <= 0.5) return Math.random() < 0.04
  if (ratio <= 0.8) return Math.random() < 0.15
  return Math.random() < 0.08
}

function setAttackBodyPart(thisPOS, calcHeight) {
  const playerHeightInPitchUnits = calcHeight / 10
  const ratio = (thisPOS[2] || 0) / playerHeightInPitchUnits
  const lowerBody = ['left of foot', 'right of foot', 'centre of foot']
  if (ratio <= 0.5) return lowerBody[common.getRandomNumber(0, lowerBody.length - 1)]
  return 'head'
}

function setDeflectBodyPart(thisPOS, calcHeight) {
  const ratio = (thisPOS[2] || 0) / (calcHeight || 20)
  const lowerBody = ['foot', 'shin', 'knee', 'thigh', 'hip', 'bum']
  const midBody = ['stomach', 'back', 'chest', 'shoulder']
  if (!thisPOS[2] || thisPOS[2] === 0) return 'foot'
  if (ratio <= 0.5) return lowerBody[common.getRandomNumber(0, lowerBody.length - 1)]
  if (ratio <= 0.8) return midBody[common.getRandomNumber(0, midBody.length - 1)]
  return 'head'
}

export function setDeflectionDirectionPos(direction, defPosition, newPower) {
  const tempPosition = [defPosition[0], defPosition[1], 0]
  if (direction === 'east' || direction === 'northeast' || direction === 'southeast') {
    if (direction === 'east') tempPosition[1] = common.getRandomNumber(defPosition[1] - 3, defPosition[1] + 3)
    tempPosition[0] = defPosition[0] - (newPower / 2)
  } else if (direction === 'west' || direction === 'northwest' || direction === 'southwest') {
    if (direction === 'west') tempPosition[1] = common.getRandomNumber(defPosition[1] - 3, defPosition[1] + 3)
    tempPosition[0] = defPosition[0] + (newPower / 2)
  }
  if (direction === 'north' || direction === 'northeast' || direction === 'northwest') {
    if (direction === 'north') tempPosition[0] = common.getRandomNumber(defPosition[0] - 3, defPosition[0] + 3)
    tempPosition[1] = defPosition[1] + (newPower / 2)
  } else if (direction === 'south' || direction === 'southeast' || direction === 'southwest') {
    if (direction === 'south') tempPosition[0] = common.getRandomNumber(defPosition[0] - 3, defPosition[0] + 3)
    tempPosition[1] = defPosition[1] - (newPower / 2)
  }
  if (direction === 'wait') {
    tempPosition[0] = defPosition[0] + common.getRandomNumber(-newPower / 2, newPower / 2)
    tempPosition[1] = defPosition[1] + common.getRandomNumber(-newPower / 2, newPower / 2)
  }
  return tempPosition
}

export function setDeflectionPlayerHasBall(ballHeight, matchDetails, defPlayer, defTeam) {
  const wasCross = matchDetails.ball.kickType === 'cross' && matchDetails.ball.lastTouch.teamID === defTeam.teamID
  // Si el último toque era un pase pendiente de un compañero del mismo equipo, registrar pase completado
  if (
    matchDetails.ball.isPendingPass &&
    matchDetails.ball.lastTouch.teamID === defTeam.teamID &&
    matchDetails.ball.lastTouch.playerID !== defPlayer.playerID
  ) {
    const passer = defTeam.players.find(p => p.playerID === matchDetails.ball.lastTouch.playerID)
    if (passer) passer.stats.passes.on++
    const teamStats = getTeamStatisticsObject(matchDetails, defTeam)
    teamStats.passesCompleted = (teamStats.passesCompleted || 0) + 1
  }
  matchDetails.ball.isPendingPass = false

  matchDetails.iterationLog.push(`${defPlayer.name} has the ball`)
  defPlayer.hasBall = true
  matchDetails.ball.lastTouch.playerName = defPlayer.name
  matchDetails.ball.lastTouch.playerID = defPlayer.playerID
  matchDetails.ball.lastTouch.teamID = defTeam.teamID
  matchDetails.ball.lastTouch.deflection = false
  if (defPlayer.offside === true) {
    setDeflectionPlayerOffside(matchDetails, defTeam, defPlayer)
    return matchDetails.ball.position
  }
  matchDetails.ball.ballOverIterations = []
  matchDetails.ball.Player = defPlayer.playerID
  matchDetails.ball.withPlayer = true
  matchDetails.ball.withTeam = defTeam.teamID
  matchDetails.ball.position = [defPlayer.currentPOS[0], defPlayer.currentPOS[1], ballHeight]

  // Si recibe un centro dentro del área rival, intenta definir de primera (cabezazo o volea)
  if (wasCross && defPlayer.position !== 'GK') {
    const [pitchWidth, pitchHeight] = matchDetails.pitchSize
    const attackingTop = defPlayer.originPOS[1] > (pitchHeight / 2)
    const distToGoalY = attackingTop ? defPlayer.currentPOS[1] : (pitchHeight - defPlayer.currentPOS[1])
    if (distToGoalY < 155 && defPlayer.currentPOS[0] > 180 && defPlayer.currentPOS[0] < (pitchWidth - 180)) {
      defPlayer.action = 'shoot'
    }
  }
  matchDetails.endIteration = true
}

export function setDeflectionPlayerOffside(matchDetails, defTeam, defPlayer) {
  defPlayer.offside = false
  defPlayer.hasBall = false
  matchDetails.ball.Player = ''
  matchDetails.ball.withPlayer = false
  matchDetails.ball.withTeam = ''
  matchDetails.iterationLog.push(`${defPlayer.name} is offside. Set piece given`)
  if (Array.isArray(matchDetails.events)) {
    matchDetails.events.push({
      type: 'offside',
      teamID: defTeam.teamID,
      teamName: defTeam.name,
      playerName: defPlayer.name,
      iteration: matchDetails.iterationCount || 0,
      half: matchDetails.half,
      deadBall: true
    })
  }
  if (defTeam.name === matchDetails.kickOffTeam.name) matchDetails = setPositions.setSetpieceSecondTeam(matchDetails)
  else matchDetails = setPositions.setSetpieceKickOffTeam(matchDetails)
}

export function getBallDirection(matchDetails, nextPOS) {
  const thisPOS = matchDetails.ball.position
  const movementX = thisPOS[0] - nextPOS[0]
  const movementY = thisPOS[1] - nextPOS[1]
  if (movementX === 0) {
    if (movementY === 0) matchDetails.ball.direction = 'wait'
    else if (movementY < 0) matchDetails.ball.direction = 'south'
    else if (movementY > 0) matchDetails.ball.direction = 'north'
  } else if (movementY === 0) {
    if (movementX < 0) matchDetails.ball.direction = 'east'
    else if (movementX > 0) matchDetails.ball.direction = 'west'
  } else if (movementX < 0 && movementY < 0) matchDetails.ball.direction = 'southeast'
  else if (movementX > 0 && movementY > 0) matchDetails.ball.direction = 'northwest'
  else if (movementX > 0 && movementY < 0) matchDetails.ball.direction = 'southwest'
  else if (movementX < 0 && movementY > 0) matchDetails.ball.direction = 'northeast'
}

export function ballPassed(matchDetails, team, player) {
  const { pitchSize } = matchDetails
  const [pitchWidth, pitchHeight] = pitchSize
  const ballPos = matchDetails.ball.position

  matchDetails.ball.lastTouch.playerName = player.name
  matchDetails.ball.lastTouch.playerID = player.playerID
  matchDetails.ball.lastTouch.teamID = team.teamID
  matchDetails.ball.lastTouch.iterations = 0
  matchDetails.iterationLog.push(`ball passed by: ${player.name}`)
  player.stats.passes.total++
  const teamStats = getTeamStatisticsObject(matchDetails, team)
  teamStats.passesTotal = (teamStats.passesTotal || 0) + 1

  const power = common.calculatePower(player.skill.strength, pitchHeight)
  const maxDist = power * 1.25
  const opposition = (team.teamID === matchDetails.kickOffTeam.teamID) ? matchDetails.secondTeam : matchDetails.kickOffTeam
  const currentIter = matchDetails.iterationCount || 0
  const styleCfg = getPlayStyleConfig(team?.playStyle, team?.formation)

  const teammates = getPlayersInDistance(team, player, pitchSize, opposition, currentIter)
  if (!teammates || teammates.length === 0) return matchDetails

  let reachable = teammates.filter(p => {
    if (p.offside) return false
    const d = common.distance(ballPos, p.position)
    return d >= 20 && d <= maxDist
  })

  if (reachable.length === 0) {
    reachable = teammates.filter(p => !p.offside)
    if (reachable.length === 0) reachable = teammates
  }

  const aTop = player.originPOS[1] > (pitchHeight / 2)
  const dir = aTop ? -1 : 1
  reachable.sort((a, b) => passScoreOption(b, aTop, ballPos, maxDist, styleCfg, pitchWidth) - passScoreOption(a, aTop, ballPos, maxDist, styleCfg, pitchWidth))
  const targetPlayer = reachable[0]
  matchDetails.iterationLog.push(`Target selected: ${targetPlayer.name}`)

  const passDist = common.distance(ballPos, targetPlayer.position)
  const horizontalSpan = Math.abs(targetPlayer.position[0] - ballPos[0])
  const isSwitchOfPlay = horizontalSpan >= 230 && (targetPlayer.position[0] < 190 || targetPlayer.position[0] > (pitchWidth - 190))

  // Si el compañero está picando al espacio o es un cambio de frente a la banda, adelantar el pase a su carrera
  let aimX = targetPlayer.position[0]
  let aimY = targetPlayer.position[1]
  if (targetPlayer.offBallRun && targetPlayer.offBallRun.untilIteration > currentIter) {
    aimX += (targetPlayer.offBallRun.targetX - targetPlayer.position[0]) * 0.42
    aimY += (targetPlayer.offBallRun.targetY - targetPlayer.position[1]) * 0.42
  } else if (isSwitchOfPlay) {
    aimY = Math.max(35, Math.min(pitchHeight - 35, aimY + dir * 24))
  }

  const accuracyFactor = Math.max(0.02, (100 - player.skill.passing) / 100)
  const spread = Math.min(9, passDist * 0.065 * accuracyFactor)

  const targetX = Math.max(20, Math.min(pitchWidth - 20, aimX + common.getRandomNumber(-spread, spread)))
  const targetY = Math.max(25, Math.min(pitchHeight - 25, aimY + common.getRandomNumber(-spread, spread)))
  const finalTarget = [common.round(targetX, 0), common.round(targetY, 0)]
  const realTargetPlayer = team.players.find(p => p.playerID === targetPlayer.playerID)
  if (realTargetPlayer) {
    realTargetPlayer.intentPOS = [finalTarget[0], finalTarget[1]]
    matchDetails.ball.targetPlayerID = realTargetPlayer.playerID
    matchDetails.ball.targetPOS = [finalTarget[0], finalTarget[1]]
  }

  if (isSwitchOfPlay && Array.isArray(matchDetails.events)) {
    matchDetails.events.push({
      type: 'switchOfPlay',
      teamID: team.teamID,
      teamName: team.name,
      playerName: player.name,
      receiverName: targetPlayer.name,
      iteration: currentIter,
      half: matchDetails.half
    })
  }

  const calcHeight = parseInt(player.height, 10) + parseInt((player.skill.jumping || 0), 10)
  const bodyPart = setAttackBodyPart(matchDetails.ball.position, calcHeight)
  matchDetails.ball.lastTouch.bodyPart = bodyPart
  const kickType = isSwitchOfPlay ? 'switch' : 'pass'
  const kickPow = isSwitchOfPlay
    ? Math.max(power, passDist * 1.35)
    : Math.min(power * 1.15, Math.max(150, passDist * 1.3))
  return calcBallMovementOverTime(matchDetails, kickPow, finalTarget, player, kickType)
}

function passScoreOption(p, aTop, ballPos, maxDistance, styleCfg, pitchWidth = 680) {
  let score = 0
  const d = common.distance(ballPos, p.position)
  const forward = aTop ? ballPos[1] - p.position[1] : p.position[1] - ballPos[1]
  const horizontalSpan = Math.abs(p.position[0] - ballPos[0])
  const isWideTarget = p.position[0] < 185 || p.position[0] > (pitchWidth - 185)
  const isSwitchCandidate = horizontalSpan >= 230 && isWideTarget && !p.isMarked && forward > -45

  // 1. Ganancia vertical o pausa inteligente
  if (forward >= 0) {
    score += forward * 1.65
  } else {
    // Pase atrás (pausa/reciclaje): solo vale la pena si el receptor está libre para limpiar la jugada
    score += (forward * 0.7) + (p.minOppDist > 34 ? 28 : -25)
  }

  // 2. Espacio libre del receptor (no pasarle a un compañero marcado si hay otro libre)
  score += Math.min(55, p.minOppDist || 20) * 1.45
  if (!p.isMarked) score += 50
  else score -= 45

  // 3. Cambio de frente a la banda opuesta libre (no sufre bloqueo de línea raso porque va por arriba)
  if (isSwitchCandidate) {
    score += 78 * (styleCfg?.switchBoost || 1.2)
  } else {
    if (p.laneBlocked) score -= 95
    // Preferir distancias naturales de asociación (65px a 240px) cuando no es cambio de frente
    if (d < 34) score -= 22
    else if (d > 290) score -= (d - 290) * 0.35
  }

  // 4. Compañero tirando un desmarque activo (diagonal, subida por banda o mostrándose entre líneas)
  if (p.offBallRun) {
    score += 58
  }

  // 5. Bonificación según rol y Estilo de Juego
  if (isWideTarget) {
    score += (styleCfg?.id === 'wingPlay' ? 48 : 28)
  }
  if (p.role === 'CAM' && styleCfg?.id === 'tikiTaka') {
    score += 36
  } else if (['LM', 'RM', 'LB', 'RB'].includes(p.role)) {
    score += 18
  } else if (['CAM', 'ST'].includes(p.role)) {
    score += 16
  }
  return score
}

export function ballCrossed(matchDetails, team, player) {
  const { pitchSize } = matchDetails
  const [pitchWidth, pitchHeight] = pitchSize
  const ballPos = matchDetails.ball.position

  matchDetails.ball.lastTouch.playerName = player.name
  matchDetails.ball.lastTouch.playerID = player.playerID
  matchDetails.ball.lastTouch.teamID = team.teamID
  matchDetails.ball.lastTouch.iterations = 0

  matchDetails.iterationLog.push(`ball crossed by: ${player.name}`)
  player.stats.passes.total++
  const teamStats = getTeamStatisticsObject(matchDetails, team)
  teamStats.passesTotal = (teamStats.passesTotal || 0) + 1

  const power = common.calculatePower(player.skill.strength, pitchHeight)
  const aTop = player.originPOS[1] > (pitchHeight / 2)
  const dir = aTop ? -1 : 1
  const opposition = (team.teamID === matchDetails.kickOffTeam.teamID) ? matchDetails.secondTeam : matchDetails.kickOffTeam
  const currentIter = matchDetails.iterationCount || 0
  const teammates = getPlayersInDistance(team, player, pitchSize, opposition, currentIter)

  // Buscar compañeros que estén pisando o cargando el área rival para tirarles el centro a la cabeza/pie
  const boxAttackers = teammates.filter(p => {
    if (p.offside || p.role === 'GK') return false
    const distToGoalY = aTop ? p.position[1] : (pitchHeight - p.position[1])
    return distToGoalY < 225 && p.position[0] >= 175 && p.position[0] <= (pitchWidth - 175)
  })

  let targetX
  let targetY
  let selectedAttacker = null

  if (boxAttackers.length > 0) {
    boxAttackers.sort((a, b) => {
      const distA = aTop ? a.position[1] : (pitchHeight - a.position[1])
      const distB = aTop ? b.position[1] : (pitchHeight - b.position[1])
      const scoreA = (220 - distA) + Math.min(45, a.minOppDist || 20) * 1.4 + (a.offBallRun?.type === 'boxCrash' ? 45 : 0)
      const scoreB = (220 - distB) + Math.min(45, b.minOppDist || 20) * 1.4 + (b.offBallRun?.type === 'boxCrash' ? 45 : 0)
      return scoreB - scoreA
    })
    selectedAttacker = boxAttackers[0]
    targetX = selectedAttacker.offBallRun?.targetX || selectedAttacker.position[0]
    const rawTargetY = selectedAttacker.offBallRun?.targetY || (selectedAttacker.position[1] + dir * 18)
    targetY = aTop
      ? Math.max(42, Math.min(155, rawTargetY))
      : Math.min(pitchHeight - 42, Math.max(pitchHeight - 155, rawTargetY))
  } else {
    // Punto penal / corazón del área si nadie llegó todavía
    targetX = (player.currentPOS[0] < (pitchWidth / 2))
      ? common.getRandomNumber(275, 415)
      : common.getRandomNumber(265, 405)
    targetY = aTop
      ? common.getRandomNumber(58, 125)
      : common.getRandomNumber(pitchHeight - 125, pitchHeight - 58)
  }

  const crossingSkill = player.skill.passing || 70
  const accuracyFactor = Math.max(0.03, (100 - crossingSkill) / 100)
  const crossDist = common.distance(ballPos, [targetX, targetY])
  const spread = Math.min(14, crossDist * 0.10 * accuracyFactor)
  const finalTarget = [
    common.round(targetX + common.getRandomNumber(-spread, spread), 0),
    common.round(targetY + common.getRandomNumber(-spread, spread), 0)
  ]

  if (selectedAttacker) {
    const realTargetPlayer = team.players.find(p => p.playerID === selectedAttacker.playerID)
    if (realTargetPlayer) {
      realTargetPlayer.intentPOS = [finalTarget[0], finalTarget[1]]
      matchDetails.ball.targetPlayerID = realTargetPlayer.playerID
      matchDetails.ball.targetPOS = [finalTarget[0], finalTarget[1]]
    }
  }

  if (Array.isArray(matchDetails.events)) {
    matchDetails.events.push({
      type: 'cross',
      teamID: team.teamID,
      teamName: team.name,
      playerName: player.name,
      receiverName: selectedAttacker?.name || '',
      iteration: currentIter,
      half: matchDetails.half
    })
  }

  const bodyPart = setAttackBodyPart([0, 0, 0], 100)
  matchDetails.ball.lastTouch.bodyPart = bodyPart
  return calcBallMovementOverTime(matchDetails, Math.max(power * 1.15, crossDist * 1.25), finalTarget, player, 'cross')
}

export function calcBallMovementOverTime(matchDetails, power, nextPosition, player, type) {
  const { pitchSize } = matchDetails
  const pitchHeight = pitchSize[1]
  const thisPOS = matchDetails.ball.position
  const trajectory = common.getBallTrajectory(thisPOS, nextPosition, power, type, pitchHeight)
  matchDetails.ball.ballOverIterations = trajectory
  matchDetails.ball.power = power
  matchDetails.ball.kickType = type
  matchDetails.ball.saveChecked = false
  matchDetails.ball.isPendingPass = (type === 'pass' || type === 'through' || type === 'cross' || type === 'switch')
  matchDetails.iterationLog.push('creating new ball movement')
  common.removeBallFromAllPlayers(matchDetails)
  matchDetails.endIteration = true
  return resolveBallMovement(player, matchDetails)
}

function checkIfBallControlled(player) {
  return common.isBetween(common.getRandomNumber(0, 100), 0, player.skill.control)
}
