import * as common from './common.js'
import * as setVariables from './setVariables.js'
import * as setFreekicks from './setFreekicks.js'
import { getPlayStyleConfig } from '../data/formations.js'

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

function selectThrowInTaker(team) {
  const active = team.players.filter(p => common.isOnPitch(p) && p.position !== 'GK')
  return active[Math.min(4, active.length - 1)] || team.players[0]
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
  for (let playerNum = 0; playerNum < 11; playerNum++) {
    const attP = attack.players[playerNum]
    const defP = defence.players[playerNum]
    if (common.isOnPitch(attP)) {
      if (playerNum < 5) attP.currentPOS = attP.originPOS.slice()
      else attP.currentPOS = isTop ? common.getRandomTopPenaltyPosition(matchDetails) : common.getRandomBottomPenaltyPosition(matchDetails)
    }
    if (common.isOnPitch(defP)) {
      if (playerNum < 5) defP.currentPOS = defP.originPOS.slice()
      else defP.currentPOS = isTop ? common.getRandomTopPenaltyPosition(matchDetails) : common.getRandomBottomPenaltyPosition(matchDetails)
    }
  }
  taker.currentPOS = cornerCoords.slice()
  const supportAtt = attack.players.find(p => common.isOnPitch(p) && p.playerID !== taker.playerID && p.position !== 'GK')
  if (supportAtt) supportAtt.currentPOS = supportAttackCoords.slice()
  const supportDef = defence.players.find(p => common.isOnPitch(p) && p.position !== 'GK')
  if (supportDef) supportDef.currentPOS = supportDefCoords.slice()

  matchDetails.ball.position = [cornerCoords[0], cornerCoords[1], 0]
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
  return setupCornerPositions(matchDetails, attack, defence, [pitchWidth, 0], [pitchWidth - 10, 20], [pitchWidth - 12, 10], true)
}

export function setTopLeftCornerPositions(matchDetails) {
  common.removeBallFromAllPlayers(matchDetails)
  const [, pitchHeight] = matchDetails.pitchSize
  const kickOffTeamKeepYPos = matchDetails.kickOffTeam.players[0].originPOS[1]
  const halfPitchSize = pitchHeight / 2
  const attack = (kickOffTeamKeepYPos > halfPitchSize) ? matchDetails.kickOffTeam : matchDetails.secondTeam
  const defence = (kickOffTeamKeepYPos > halfPitchSize) ? matchDetails.secondTeam : matchDetails.kickOffTeam
  return setupCornerPositions(matchDetails, attack, defence, [0, 0], [10, 20], [12, 10], true)
}

export function setBottomLeftCornerPositions(matchDetails) {
  common.removeBallFromAllPlayers(matchDetails)
  const [, pitchHeight] = matchDetails.pitchSize
  const kickOffTeamKeepYPos = matchDetails.kickOffTeam.players[0].originPOS[1]
  const halfPitchSize = pitchHeight / 2
  const attack = (kickOffTeamKeepYPos < halfPitchSize) ? matchDetails.kickOffTeam : matchDetails.secondTeam
  const defence = (kickOffTeamKeepYPos < halfPitchSize) ? matchDetails.secondTeam : matchDetails.kickOffTeam
  return setupCornerPositions(matchDetails, attack, defence, [0, pitchHeight], [10, pitchHeight - 20], [12, pitchHeight - 10], false)
}

export function setBottomRightCornerPositions(matchDetails) {
  common.removeBallFromAllPlayers(matchDetails)
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  const kickOffTeamKeepYPos = matchDetails.kickOffTeam.players[0].originPOS[1]
  const halfPitchSize = pitchHeight / 2
  const attack = (kickOffTeamKeepYPos < halfPitchSize) ? matchDetails.kickOffTeam : matchDetails.secondTeam
  const defence = (kickOffTeamKeepYPos < halfPitchSize) ? matchDetails.secondTeam : matchDetails.kickOffTeam
  return setupCornerPositions(matchDetails, attack, defence, [pitchWidth, pitchHeight], [pitchWidth - 10, pitchHeight - 20], [pitchWidth - 12, pitchHeight - 10], false)
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
  place = (place - 30 < 0) ? 30 : place
  place = (place + 10 > pitchHeight + 1) ? (pitchHeight - 10) : place
  const taker = selectThrowInTaker(attack)
  const movement = taker.originPOS[1] - place
  const oppMovement = 0 - movement

  matchDetails.ball.ballOverIterations = []
  matchDetails.ball.withPlayer = true
  matchDetails.ball.Player = taker.playerID
  matchDetails.ball.withTeam = attack.teamID
  matchDetails.ball.lastTouch.deflection = false
  matchDetails.iterationLog.push(`Throw in to - ${attack.name}`)
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

  setPlayerPositions(matchDetails, attack, movement)
  setPlayerPositions(matchDetails, defence, oppMovement)

  const throwX = isLeft ? 0 : pitchWidth
  matchDetails.ball.position = [throwX, place, 0]
  taker.currentPOS = [throwX, place]
  taker.hasBall = true
  matchDetails.ball.lastTouch.playerName = taker.name
  matchDetails.ball.lastTouch.playerID = taker.playerID
  matchDetails.ball.lastTouch.teamID = attack.teamID
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
  kicker.hasBall = true
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
      const proximityToBall = Math.abs(ballToPlayerX) + Math.abs(ballToPlayerY)
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
      matchDetails.events.push({
        type,
        teamID: matchDetails.kickOffTeam.teamID,
        teamName: matchDetails.kickOffTeam.name,
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
      matchDetails.events.push({
        type,
        teamID: matchDetails.secondTeam.teamID,
        teamName: matchDetails.secondTeam.name,
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
  const tempArray = [pitchWidth / 2, Math.round(pitchHeight / 6)]
  const shootArray = [pitchWidth / 2, common.round(pitchHeight / 17.5, 0)]
  if (common.isOnPitch(defence.players[0])) {
    defence.players[0].currentPOS = defence.players[0].originPOS.slice()
  }
  setPlayerPenaltyPositions(tempArray, attack, defence, shootArray)
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
  const tempArray = [pitchWidth / 2, Math.round(pitchHeight - (pitchHeight / 6))]
  const shootArray = [pitchWidth / 2, pitchHeight - common.round(pitchHeight / 17.5, 0)]
  if (common.isOnPitch(defence.players[0])) {
    defence.players[0].currentPOS = defence.players[0].originPOS.slice()
  }
  setPlayerPenaltyPositions(tempArray, attack, defence, shootArray)
  setBallSpecificPenaltyValue(matchDetails, shootArray, attack)
  matchDetails.ball.direction = 'south'
  attack.intent = 'attack'
  defence.intent = 'defend'
  matchDetails.endIteration = true
  return matchDetails
}

function setPlayerPenaltyPositions(tempArray, attack, defence, shootArray) {
  let oppxpos = -10
  let teamxpos = -9
  const ballY = shootArray[1]
  for (const num of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    if (num !== 10 && common.isOnPitch(attack.players[num])) {
      attack.players[num].currentPOS = tempArray.slice()
      attack.players[num].currentPOS[0] += teamxpos
      if (attack.players[num].currentPOS[1] > ballY) attack.players[num].currentPOS[1] = ballY
    }
    if (common.isOnPitch(defence.players[num])) {
      defence.players[num].currentPOS = tempArray.slice()
      defence.players[num].currentPOS[0] += oppxpos
    }
    oppxpos += 2
    teamxpos += 2
  }
}

function setBallSpecificPenaltyValue(matchDetails, shootArray, attack) {
  const taker = selectPenaltyTaker(attack)
  if (common.isOnPitch(attack.players[0])) {
    attack.players[0].currentPOS = attack.players[0].originPOS.slice()
  }
  taker.currentPOS = shootArray.slice()
  taker.hasBall = true
  taker.action = 'penalty'
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
    // Gol en contra o rebote: asignar al delantero o último jugador activo del equipo que anotó
    const active = matchDetails.kickOffTeam.players.filter(common.isOnPitch)
    const fallbackScorer = active[active.length - 1] || matchDetails.kickOffTeam.players[0]
    scorer = fallbackScorer.name
    fallbackScorer.stats.goals++
  } else {
    matchDetails.kickOffTeam.players[thisIndex].stats.goals++
  }

  matchDetails.iterationLog.push(`Goal Scored by - ${scorer} - (${matchDetails.kickOffTeam.name})`)
  if (Array.isArray(matchDetails.events)) {
    matchDetails.events.push({
      type: 'goal',
      teamID: matchDetails.kickOffTeam.teamID,
      teamName: matchDetails.kickOffTeam.name,
      playerName: scorer,
      iteration: matchDetails.iterationCount || 0,
      half: matchDetails.half
    })
  }

  matchDetails.ball.lastTouch.playerName = ''
  matchDetails.ball.lastTouch.playerID = ''
  matchDetails.ball.lastTouch.teamID = ''
  common.removeBallFromAllPlayers(matchDetails)
  setVariables.resetPlayerPositions(matchDetails)
  setBallSpecificGoalScoreValue(matchDetails, matchDetails.secondTeam)
  matchDetails.secondTeam.intent = 'attack'
  matchDetails.kickOffTeam.intent = 'defend'
  matchDetails.kickOffTeamStatistics.goals++
  matchDetails.endIteration = true
  return matchDetails
}

export function setSecondTeamGoalScored(matchDetails) {
  let scorer = matchDetails.ball.lastTouch.playerName
  let thisIndex = matchDetails.secondTeam.players.findIndex(thisPlayer => thisPlayer.name === scorer)
  if (thisIndex === -1) {
    const active = matchDetails.secondTeam.players.filter(common.isOnPitch)
    const fallbackScorer = active[active.length - 1] || matchDetails.secondTeam.players[0]
    scorer = fallbackScorer.name
    fallbackScorer.stats.goals++
  } else {
    matchDetails.secondTeam.players[thisIndex].stats.goals++
  }

  matchDetails.iterationLog.push(`Goal Scored by - ${scorer} - (${matchDetails.secondTeam.name})`)
  if (Array.isArray(matchDetails.events)) {
    matchDetails.events.push({
      type: 'goal',
      teamID: matchDetails.secondTeam.teamID,
      teamName: matchDetails.secondTeam.name,
      playerName: scorer,
      iteration: matchDetails.iterationCount || 0,
      half: matchDetails.half
    })
  }

  matchDetails.ball.lastTouch.playerName = ''
  matchDetails.ball.lastTouch.playerID = ''
  matchDetails.ball.lastTouch.teamID = ''
  common.removeBallFromAllPlayers(matchDetails)
  setVariables.resetPlayerPositions(matchDetails)
  setBallSpecificGoalScoreValue(matchDetails, matchDetails.kickOffTeam)
  matchDetails.kickOffTeam.intent = 'attack'
  matchDetails.secondTeam.intent = 'defend'
  matchDetails.secondTeamStatistics.goals++
  matchDetails.endIteration = true
  return matchDetails
}

export function setBallSpecificGoalScoreValue(matchDetails, concedingTeam) {
  matchDetails.ball.position = [matchDetails.pitchSize[0] / 2, matchDetails.pitchSize[1] / 2, 0]
  matchDetails.ball.ballOverIterations = []
  matchDetails.ball.withPlayer = true
  matchDetails.ball.withTeam = concedingTeam.teamID

  const activeField = concedingTeam.players.filter((p, idx) => idx > 0 && common.isOnPitch(p))
  const kicker = activeField[activeField.length - 1] || concedingTeam.players.find(common.isOnPitch) || concedingTeam.players[0]
  const waiter = activeField[activeField.length - 2] || kicker

  kicker.currentPOS = [matchDetails.ball.position[0], matchDetails.ball.position[1]]
  kicker.hasBall = true
  matchDetails.ball.lastTouch.playerName = kicker.name
  matchDetails.ball.lastTouch.playerID = kicker.playerID
  matchDetails.ball.lastTouch.teamID = concedingTeam.teamID
  matchDetails.ball.lastTouch.deflection = false
  matchDetails.ball.Player = kicker.playerID
  if (waiter && waiter.playerID !== kicker.playerID) {
    waiter.currentPOS = [matchDetails.ball.position[0] + 20, matchDetails.ball.position[1]]
  }
}

function tryGoalLineSave(matchDetails, defendingTeam) {
  if (matchDetails.ball?.saveChecked) return false
  matchDetails.ball.saveChecked = true
  const goalie = defendingTeam?.players?.[0]
  if (!goalie || !common.isOnPitch(goalie)) return false
  const saving = Number(goalie.skill?.saving || 72)
  const perception = Number(goalie.skill?.perception || 70)
  const gkScore = (saving * 0.72 + perception * 0.28)
  const saveRoll = common.getRandomNumber(42, 124)
  if (gkScore >= saveRoll) {
    setGoalieHasBall(matchDetails, goalie)
    goalie.stats.saves = (goalie.stats.saves || 0) + 1
    matchDetails.iterationLog.push(`Ball saved by ${goalie.name}`)
    if (Array.isArray(matchDetails.events)) {
      matchDetails.events.push({
        type: 'save',
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

  if (bXPOS < 0 && kickteamID === KOTid) return setLeftSecondTeamThrowIn(matchDetails, ballIntended)
  if (bXPOS < 0 && kickteamID !== KOTid) return setLeftKickOffTeamThrowIn(matchDetails, ballIntended)
  if (bXPOS > pitchWidth && kickteamID === KOTid) return setRightSecondTeamThrowIn(matchDetails, ballIntended)
  if (bXPOS > pitchWidth && kickteamID !== KOTid) return setRightKickOffTeamThrowIn(matchDetails, ballIntended)

  if (bYPOS < 0) {
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
  for (const thisPlayer of team.players) {
    if (!thisPlayer.originPOS) throw new Error('Each player must have an origin position set')
    thisPlayer.originPOS[1] = matchDetails.pitchSize[1] - thisPlayer.originPOS[1]
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
    if (ticksSinceTurnover <= 25 && ticksSinceTurnover >= 0) {
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

export function setIntentPosition(matchDetails, closestPlayer) {
  if (!closestPlayer) return
  const { ball, kickOffTeam, secondTeam } = matchDetails
  const kickOffTeamCheck = kickOffTeam.players.find(thisPlayer => thisPlayer.playerID === ball.Player)
  const secondTeamCheck = secondTeam.players.find(thisPlayer => thisPlayer.playerID === ball.Player)
  const kickTeam = kickOffTeamCheck ? kickOffTeam : (secondTeamCheck ? secondTeam : 'none')
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
  for (const player of thisTeam.players) {
    if (!common.isOnPitch(player)) continue
    const baseX = player.originPOS[0]
    const baseY = player.originPOS[1]
    const diffX = ball.position[0] - player.currentPOS[0]
    const diffY = ball.position[1] - player.currentPOS[1]
    const distance = Math.sqrt(diffX * diffX + diffY * diffY)

    if (ball.isPendingPass && ball.targetPlayerID === player.playerID && Array.isArray(ball.targetPOS)) {
      player.intentPOS = [ball.targetPOS[0], ball.targetPOS[1]]
      continue
    }

    if (closestPlayer && player.playerID === closestPlayer.playerID) {
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

    const role = player.tacticalRole || player.position
    const isWide = ['LM', 'RM', 'LB', 'RB'].includes(role)
    const compressX = (ball.position[0] - baseX) * (isWide ? 0.08 : 0.16)
    const compressY = (ball.position[1] - baseY) * 0.15
    player.intentPOS = [
      baseX + compressX,
      baseY + compressY
    ]
  }
}

function setDefenceRelativePos(matchDetails, defendingTeam, closestPlayer, attackingTeam) {
  const { ball, pitchSize } = matchDetails
  const [pitchWidth, pitchHeight] = pitchSize
  const isTopTeam = defendingTeam.players[0].originPOS[1] < (pitchHeight / 2)
  const mentality = defendingTeam.mentality || 'balanced'
  const distBallToOwnGoalY = isTopTeam ? ball.position[1] : (pitchHeight - ball.position[1])

  // Cálculo del Bloque Defensivo Colectivo
  let cbBaseDist = 115
  let lineSpread = 65
  if (mentality === 'defensive') {
    cbBaseDist = 90 + Math.min(130, distBallToOwnGoalY * 0.22)
    lineSpread = 50
  } else if (mentality === 'offensive') {
    cbBaseDist = 165 + Math.min(190, distBallToOwnGoalY * 0.32)
    lineSpread = 72
  } else {
    cbBaseDist = 120 + Math.min(160, distBallToOwnGoalY * 0.26)
    lineSpread = 60
  }

  // 1. Asignar Presser exclusivo: jugador de campo más cercano a la pelota
  let presser = null
  let minPresserDist = 999
  for (const p of defendingTeam.players) {
    if (!common.isOnPitch(p) || p.position === 'GK') continue
    const d = common.distance(p.currentPOS, ball.position)
    if (d < minPresserDist) {
      minPresserDist = d
      presser = p
    }
  }

  // 2. Asignar Cover exclusivo: segundo jugador de campo más cercano al presser
  let cover = null
  let minCoverDist = 999
  if (presser) {
    for (const p of defendingTeam.players) {
      if (!common.isOnPitch(p) || p.position === 'GK' || p.playerID === presser.playerID) continue
      const d = common.distance(p.currentPOS, presser.currentPOS)
      if (d < minCoverDist) {
        minCoverDist = d
        cover = p
      }
    }
  }

  // 3. Obtener BoxSlots rivales para asignar marcas personales (Markers)
  const oppAttackPlan = attackingTeam?.attackPlan || {}
  const markedOppIDs = [oppAttackPlan.penaltySpotID, oppAttackPlan.nearPostID].filter(Boolean)

  for (const player of defendingTeam.players) {
    if (!common.isOnPitch(player)) continue
    player.offBallRun = null
    const baseX = player.originPOS[0]
    const role = player.tacticalRole || player.position

    // Arquero
    if (player.position === 'GK') {
      const gkDist = Math.max(22, Math.min(75, distBallToOwnGoalY * 0.15))
      const gkY = isTopTeam ? gkDist : (pitchHeight - gkDist)
      const gkX = Math.max(pitchSize[0] / 2 - 40, Math.min(pitchSize[0] / 2 + 40, ball.position[0] * 0.25 + (pitchSize[0] / 2) * 0.75))
      player.intentPOS = [gkX, gkY]
      continue
    }

    // A. PRESSER: Sale a presionar al portador goal-side
    if (presser && player.playerID === presser.playerID) {
      const goalDirY = isTopTeam ? -1 : 1
      const pressX = ball.position[0] * 0.85 + player.currentPOS[0] * 0.15
      const pressY = ball.position[1] + goalDirY * 12
      player.intentPOS = [
        Math.max(25, Math.min(pitchWidth - 25, pressX)),
        isTopTeam ? Math.max(25, pressY) : Math.min(pitchHeight - 25, pressY)
      ]
      continue
    }

    // B. COVER: Cobertura escalonada unos 24px detrás del presser
    if (cover && player.playerID === cover.playerID) {
      const goalDirY = isTopTeam ? -1 : 1
      const coverX = presser.currentPOS[0] * 0.6 + baseX * 0.4
      const coverY = presser.currentPOS[1] + goalDirY * 26
      player.intentPOS = [
        Math.max(30, Math.min(pitchWidth - 30, coverX)),
        isTopTeam ? Math.max(45, coverY) : Math.min(pitchHeight - 45, coverY)
      ]
      continue
    }

    // C. MARKERS: Defensores CBs tomando la marca personal en el área
    if (role === 'CB' && markedOppIDs.length > 0 && distBallToOwnGoalY < 280) {
      const targetOppID = markedOppIDs.shift()
      const oppPlayer = attackingTeam?.players?.find(op => op.playerID === targetOppID)
      if (oppPlayer && common.isOnPitch(oppPlayer)) {
        const goalDirY = isTopTeam ? -1 : 1
        const markX = oppPlayer.currentPOS[0]
        const markY = oppPlayer.currentPOS[1] + goalDirY * 12
        player.intentPOS = [
          Math.max(35, Math.min(pitchWidth - 35, markX)),
          isTopTeam ? Math.max(35, markY) : Math.min(pitchHeight - 35, markY)
        ]
        continue
      }
    }

    // D. HOLD ZONE: Mantener el bloque defensivo
    const isWide = ['LM', 'RM', 'LB', 'RB'].includes(role)
    let roleDistFromOwnGoal = cbBaseDist
    if (role === 'CB') roleDistFromOwnGoal = cbBaseDist
    else if (role === 'LB' || role === 'RB') roleDistFromOwnGoal = cbBaseDist + 16
    else if (role === 'CM') roleDistFromOwnGoal = cbBaseDist + lineSpread
    else if (role === 'LM' || role === 'RM') roleDistFromOwnGoal = cbBaseDist + lineSpread + 20
    else if (role === 'CAM') roleDistFromOwnGoal = cbBaseDist + lineSpread * 1.6
    else if (role === 'ST') roleDistFromOwnGoal = cbBaseDist + lineSpread * 2.2

    const targetY = isTopTeam
      ? Math.max(30, Math.min(pitchHeight - 45, roleDistFromOwnGoal))
      : Math.min(pitchHeight - 30, Math.max(45, pitchHeight - roleDistFromOwnGoal))

    const compressX = (ball.position[0] - baseX) * (isWide ? 0.14 : 0.24)
    player.intentPOS = [
      Math.max(25, Math.min(pitchSize[0] - 25, baseX + compressX)),
      targetY
    ]
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

function setAttackRelativePos(matchDetails, kickingTeam, defendingTeam) {
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

  // 1. Identificar portador del balón
  const carrier = kickingTeam.players.find(p => p.hasBall)
  const carrierID = carrier ? carrier.playerID : null

  // 2. Construir AttackPlan con Roles Exclusivos (open-football model)
  // BoxSlots: NearPost, PenaltySpot, FarPost, CutbackEdge
  const boxSlots = {
    nearPost: null,
    penaltySpot: null,
    farPost: null,
    cutbackEdge: null
  }
  const slotTargets = {
    nearPost: [
      ballOnLeftWing ? 275 : (ballOnRightWing ? 405 : (pitchWidth / 2 - 35)),
      clampOnsideY(isTopTeam ? pitchHeight - 74 : 74)
    ],
    penaltySpot: [
      340,
      clampOnsideY(isTopTeam ? pitchHeight - 110 : 110)
    ],
    farPost: [
      ballOnLeftWing ? 425 : (ballOnRightWing ? 255 : (pitchWidth / 2 + 35)),
      clampOnsideY(isTopTeam ? pitchHeight - 88 : 88)
    ],
    cutbackEdge: [
      ballOnLeftWing ? 365 : 315,
      clampOnsideY(isTopTeam ? pitchHeight - 165 : 165)
    ]
  }

  // Asignar candidatos a los BoxSlots:
  const availableAttackers = kickingTeam.players.filter(
    p => common.isOnPitch(p) && p.position !== 'GK' && p.playerID !== carrierID
  )

  const stPlayers = availableAttackers.filter(p => (p.tacticalRole || p.position) === 'ST')
  const camPlayers = availableAttackers.filter(p => (p.tacticalRole || p.position) === 'CAM')
  const wingers = availableAttackers.filter(p => ['LM', 'RM'].includes(p.tacticalRole || p.position))

  // PenaltySpot (9 de área principal)
  if (stPlayers.length > 0) {
    boxSlots.penaltySpot = stPlayers[0]
  }
  // CutbackEdge (CAM / Enganche o volante con llegada)
  if (camPlayers.length > 0) {
    boxSlots.cutbackEdge = camPlayers[0]
  } else if (stPlayers.length > 1) {
    boxSlots.cutbackEdge = stPlayers[1]
  }
  // NearPost & FarPost
  for (const w of wingers) {
    const isWingerOnBallFlank = (ballOnLeftWing && w.originPOS[0] < pitchWidth / 2) ||
                               (ballOnRightWing && w.originPOS[0] >= pitchWidth / 2)
    if (isWingerOnBallFlank && !boxSlots.nearPost) {
      boxSlots.nearPost = w
    } else if (!isWingerOnBallFlank && !boxSlots.farPost) {
      boxSlots.farPost = w
    }
  }
  if (!boxSlots.nearPost && stPlayers.length > 1 && boxSlots.cutbackEdge !== stPlayers[1]) {
    boxSlots.nearPost = stPlayers[1]
  }

  // Guardar en kickingTeam.attackPlan para acceso diagnóstico/evaluación
  kickingTeam.attackPlan = {
    nearPostID: boxSlots.nearPost?.playerID,
    penaltySpotID: boxSlots.penaltySpot?.playerID,
    farPostID: boxSlots.farPost?.playerID,
    cutbackEdgeID: boxSlots.cutbackEdge?.playerID
  }

  // 3. NearSupport (Apoyo cercano para descargar el juego)
  let nearSupportPlayer = null
  let minSupportDist = 999
  if (carrier) {
    for (const p of availableAttackers) {
      const role = p.tacticalRole || p.position
      if (['CM', 'CDM', 'LB', 'RB'].includes(role) && p !== boxSlots.cutbackEdge) {
        const d = common.distance(p.currentPOS, carrier.currentPOS)
        if (d < minSupportDist && d > 20) {
          minSupportDist = d
          nearSupportPlayer = p
        }
      }
    }
  }

  // 4. RestDefence (defensa de reposo para custodiar la contra)
  const onLeftFlank = ball.position[0] < pitchWidth / 2
  const oppositeFullbackRole = onLeftFlank ? 'RB' : 'LB'
  const restDefencePlayers = availableAttackers.filter(p => {
    const role = p.tacticalRole || p.position
    return role === 'CB' || role === oppositeFullbackRole
  })

  let activeDiagonalRunners = kickingTeam.players.filter(
    p => common.isOnPitch(p) && p.offBallRun && p.offBallRun.untilIteration > currentIter && p.offBallRun.type === 'diagonalInBehind'
  ).length

  // 5. Asignar intentPOS a cada jugador
  for (const player of kickingTeam.players) {
    if (!common.isOnPitch(player) || player.position === 'GK') continue
    if (player.hasBall) {
      player.offBallRun = null
      continue
    }

    const baseX = player.originPOS[0]
    const baseY = player.originPOS[1]
    const role = player.tacticalRole || player.position
    const isWide = ['LM', 'RM', 'LB', 'RB'].includes(role)
    const hasTrait = (t) => Array.isArray(player.traits) && player.traits.includes(t)

    // A. ¿Ocupa un BoxSlot en situación de ataque o centro?
    let assignedSlotKey = null
    if (isAttackingPhase) {
      if (boxSlots.nearPost && boxSlots.nearPost.playerID === player.playerID) assignedSlotKey = 'nearPost'
      else if (boxSlots.penaltySpot && boxSlots.penaltySpot.playerID === player.playerID) assignedSlotKey = 'penaltySpot'
      else if (boxSlots.farPost && boxSlots.farPost.playerID === player.playerID) assignedSlotKey = 'farPost'
      else if (boxSlots.cutbackEdge && boxSlots.cutbackEdge.playerID === player.playerID) assignedSlotKey = 'cutbackEdge'
    }

    if (assignedSlotKey) {
      const finishTarget = slotTargets[assignedSlotKey]
      // Wait Target vs Finish Target: si la pelota todavía está a más de 250px del arco rival,
      // esperan en la puerta del área (wait_target) para no quedar en offside ni estáticos
      if (distBallToGoalY > 250 && !wingCrossSituation) {
        const waitDepth = assignedSlotKey === 'cutbackEdge' ? 215 : 185
        const waitY = clampOnsideY(isTopTeam ? pitchHeight - waitDepth : waitDepth)
        player.intentPOS = [finishTarget[0], waitY]
      } else {
        // En fase de definición rompen hacia su slot
        player.offBallRun = {
          type: 'boxSlotEntry',
          slot: assignedSlotKey,
          targetX: finishTarget[0],
          targetY: finishTarget[1],
          untilIteration: currentIter + 6
        }
        player.intentPOS = [finishTarget[0], finishTarget[1]]
      }
      continue
    }

    // B. NearSupport: posicionarse de apoyo unos 30-45px detrás de la pelota
    if (nearSupportPlayer && nearSupportPlayer.playerID === player.playerID && carrier) {
      const supportX = Math.max(40, Math.min(pitchWidth - 40, carrier.currentPOS[0] + (carrier.currentPOS[0] < pitchWidth / 2 ? 15 : -15)))
      const supportY = clampOnsideY(carrier.currentPOS[1] - dir * 35)
      player.intentPOS = [supportX, supportY]
      continue
    }

    // C. RestDefence: mantener bloque de seguridad
    if (restDefencePlayers.some(rp => rp.playerID === player.playerID)) {
      const restDepthFromOwnGoal = (kickingTeam.mentality === 'offensive' ? 240 : (kickingTeam.mentality === 'defensive' ? 140 : 190))
      const safeOwnY = isTopTeam
        ? Math.max(60, Math.min(pitchHeight - 120, restDepthFromOwnGoal))
        : Math.min(pitchHeight - 60, Math.max(120, pitchHeight - restDepthFromOwnGoal))
      const compressX = (ball.position[0] - baseX) * (isWide ? 0.08 : 0.16)
      player.intentPOS = [
        Math.max(45, Math.min(pitchWidth - 45, baseX + compressX)),
        safeOwnY
      ]
      continue
    }

    // D. Lateral ofensivo con libertad de subida en la banda del balón
    if ((role === 'LB' || role === 'RB') && !restDefencePlayers.some(rp => rp.playerID === player.playerID)) {
      const hasLateralOfensivo = hasTrait('lateral_ofensivo')
      const targetDepth = distBallToGoalY < 240
        ? (hasLateralOfensivo ? 155 : 205)
        : Math.max(220, distBallToGoalY + 55)
      const rawLatY = isTopTeam ? (pitchHeight - targetDepth) : targetDepth
      const latY = clampOnsideY(rawLatY)
      const flankMargin = styleCfg.id === 'wingPlay' || hasLateralOfensivo ? 50 : 66
      const latX = baseX < pitchWidth / 2 ? flankMargin : (pitchWidth - flankMargin)
      player.intentPOS = [latX, latY]
      continue
    }

    // E. Mantener desmarques activos previos
    if (player.offBallRun && player.offBallRun.untilIteration > currentIter) {
      const safeRunY = clampOnsideY(player.offBallRun.targetY)
      player.intentPOS = [player.offBallRun.targetX, safeRunY]
      continue
    }
    player.offBallRun = null

    // F. Posición táctica base con amplitud (WideHolders)
    const widthFactor = isWide ? 0.0 : (styleCfg.id === 'wingPlay' ? 0.04 : 0.08)
    const compressX = (ball.position[0] - baseX) * widthFactor
    let tacticalX = baseX + compressX
    if (isWide) {
      const leftSide = baseX < pitchWidth / 2
      tacticalX = leftSide ? Math.min(65, baseX) : Math.max(pitchWidth - 65, baseX)
    }

    const isOffensive = kickingTeam.mentality === 'offensive'
    const isDefensive = kickingTeam.mentality === 'defensive'
    let roleAdvance = isOffensive ? 245 : (isDefensive ? 135 : 195)
    if (role === 'LM' || role === 'RM') roleAdvance = hasTrait('velocista_banda') ? 315 : (isOffensive ? 300 : 280)
    else if (role === 'CM') roleAdvance = isOffensive ? 280 : (isDefensive ? 195 : 240)
    const ballShift = (ball.position[1] - baseY) * 0.48
    const defaultY = clampOnsideY(baseY + (dir * roleAdvance) + ballShift)
    const defaultX = common.upToMax(common.upToMin(tacticalX, 28), pitchWidth - 28)

    // G. Evaluar inicio de un nuevo Desmarque Dinámico (Off-Ball Run)
    const roll = common.getRandomNumber(1, 100)
    const diagonalChance = Math.round(14 * (styleCfg.throughBoost || 1.1))
    const overlapChance = Math.round(16 * (styleCfg.switchBoost || 1.1))
    const showChance = styleCfg.id === 'tikiTaka' ? 22 : 13

    if ((role === 'ST' || role === 'LM' || role === 'RM') && activeDiagonalRunners < 2 && roll <= diagonalChance) {
      const rawDeepY = isTopTeam ? Math.max(defaultY + 75, onsideLimitY - 4) : Math.min(defaultY - 75, onsideLimitY + 4)
      const runTargetY = clampOnsideY(rawDeepY)
      const preferredX = role === 'ST'
        ? findOpenPocketX(defaultX, defendingTeam, runTargetY, pitchWidth)
        : (baseX < pitchWidth / 2 ? common.getRandomNumber(115, 220) : common.getRandomNumber(pitchWidth - 220, pitchWidth - 115))
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
      const flankX = baseX < pitchWidth / 2 ? common.getRandomNumber(42, 78) : common.getRandomNumber(pitchWidth - 78, pitchWidth - 42)
      const advanceFromBall = dir * common.getRandomNumber(90, 175)
      const flankY = clampOnsideY(ball.position[1] + advanceFromBall)
      player.offBallRun = {
        type: 'overlapFlank',
        targetX: flankX,
        targetY: flankY,
        untilIteration: currentIter + common.getRandomNumber(11, 16)
      }
      player.intentPOS = [flankX, flankY]
      continue
    }

    if ((role === 'CAM' || role === 'CM') && roll > (diagonalChance + overlapChance) && roll <= (diagonalChance + overlapChance + showChance)) {
      const supportY = clampOnsideY(ball.position[1] + dir * common.getRandomNumber(55, 115))
      const pocketX = findOpenPocketX(defaultX, defendingTeam, supportY, pitchWidth)
      player.offBallRun = {
        type: 'showBetweenLines',
        targetX: pocketX,
        targetY: supportY,
        untilIteration: currentIter + common.getRandomNumber(8, 12)
      }
      player.intentPOS = [pocketX, supportY]
      continue
    }

    player.intentPOS = [defaultX, defaultY]
  }
}
