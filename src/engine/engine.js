import * as common from './common.js'
import * as setPositions from './setPositions.js'
import * as setVariables from './setVariables.js'
import * as playerMovement from './playerMovement.js'
import * as ballMovement from './ballMovement.js'
import * as validate from './validate.js'
import * as actions from './actions.js'
import { updateTeamEffectiveSkills, updatePlayerEffectiveSkills } from './modifiers.js'
import { getFormationCoordinates } from '../data/formations.js'

export async function initiateGame(team1, team2, pitchDetails) {
  validate.validateArguments(team1, team2, pitchDetails)
  validate.validateTeam(team1)
  validate.validateTeam(team2)
  validate.validatePitch(pitchDetails)
  const matchDetails = setVariables.populateMatchDetails(team1, team2, pitchDetails)
  let kickOffTeam = setVariables.setGameVariables(matchDetails.kickOffTeam)
  const secondTeam = setVariables.setGameVariables(matchDetails.secondTeam)
  kickOffTeam = setVariables.koDecider(kickOffTeam, matchDetails)
  matchDetails.iterationLog.push(`Team to kick off - ${kickOffTeam.name}`)
  matchDetails.iterationLog.push(`Second team - ${secondTeam.name}`)
  setPositions.switchSide(matchDetails, secondTeam)
  const centerY = pitchDetails.pitchHeight / 2
  for (const p of secondTeam.players) {
    if (common.isOnPitch(p)) {
      if (p.currentPOS[1] < centerY + 65) p.currentPOS[1] = centerY + 65
      if (p.intentPOS[1] < centerY + 65) p.intentPOS[1] = centerY + 65
    }
  }
  matchDetails.kickOffTeam = kickOffTeam
  matchDetails.secondTeam = secondTeam
  return matchDetails
}

export async function playIteration(matchDetails) {
  const closestPlayerA = {
    name: '',
    position: 100000
  }
  const closestPlayerB = {
    name: '',
    position: 100000
  }
  validate.validateMatchDetails(matchDetails)
  validate.validateTeamSecondHalf(matchDetails.kickOffTeam)
  validate.validateTeamSecondHalf(matchDetails.secondTeam)
  validate.validatePlayerPositions(matchDetails)

  // Guardar snapshot previo de posiciones para interpolación visual 60fps y transiciones de pelota parada
  matchDetails.prevSnapshot = {
    ball: matchDetails.ball?.position ? matchDetails.ball.position.slice() : [340, 525, 0],
    kickOffTeam: matchDetails.kickOffTeam.players.map(p => (Array.isArray(p.currentPOS) ? p.currentPOS.slice() : ['NP', 'NP'])),
    secondTeam: matchDetails.secondTeam.players.map(p => (Array.isArray(p.currentPOS) ? p.currentPOS.slice() : ['NP', 'NP']))
  }

  matchDetails.iterationCount = (matchDetails.iterationCount || 0) + 1
  matchDetails.iterationLog = []
  matchDetails.iterationLog.push(`Ball start position: ${matchDetails.ball.position}`)

  const { kickOffTeam, secondTeam } = matchDetails
  common.matchInjury(matchDetails, kickOffTeam)
  common.matchInjury(matchDetails, secondTeam)

  // Contabilizar posesión en tiempo real y transiciones de posesión (open-football model)
  const currentTeamWithBall = matchDetails.ball.withTeam || matchDetails.ball.lastTouch?.teamID
  if (currentTeamWithBall === kickOffTeam.teamID) {
    matchDetails.kickOffTeamStatistics.possessionTicks = (matchDetails.kickOffTeamStatistics.possessionTicks || 1) + 1
  } else if (currentTeamWithBall === secondTeam.teamID) {
    matchDetails.secondTeamStatistics.possessionTicks = (matchDetails.secondTeamStatistics.possessionTicks || 1) + 1
  }
  if (currentTeamWithBall) {
    if (matchDetails.lastWithTeam && matchDetails.lastWithTeam !== currentTeamWithBall) {
      matchDetails.turnoverTick = matchDetails.iterationCount
    }
    matchDetails.lastWithTeam = currentTeamWithBall
  }
  matchDetails.turnoverTick = matchDetails.turnoverTick || 0

  matchDetails = ballMovement.moveBall(matchDetails)
  if (matchDetails.endIteration === true) {
    delete matchDetails.endIteration
    return matchDetails
  }

  playerMovement.closestPlayerToBall(closestPlayerA, kickOffTeam, matchDetails)
  playerMovement.closestPlayerToBall(closestPlayerB, secondTeam, matchDetails)
  const koTeamMoves = playerMovement.decideMovement(closestPlayerA, kickOffTeam, secondTeam, matchDetails)
  const stMoves = playerMovement.decideMovement(closestPlayerB, secondTeam, kickOffTeam, matchDetails)
  const koTeamMovesBallMoves = actions.extractBallActions(koTeamMoves, 'ball')
  const koTeamAllOtherMoves = actions.extractBallActions(koTeamMoves, 'movement')
  const stMovesBallMoves = actions.extractBallActions(stMoves, 'ball')
  const stAllOtherMoves = actions.extractBallActions(stMoves, 'movement')
  if (matchDetails.iterationCount % 2 === 0) {
    matchDetails.kickOffTeam = playerMovement.movePlayers(koTeamAllOtherMoves, kickOffTeam, secondTeam, matchDetails)
    matchDetails.secondTeam = playerMovement.movePlayers(stAllOtherMoves, secondTeam, kickOffTeam, matchDetails)
  } else {
    matchDetails.secondTeam = playerMovement.movePlayers(stAllOtherMoves, secondTeam, kickOffTeam, matchDetails)
    matchDetails.kickOffTeam = playerMovement.movePlayers(koTeamAllOtherMoves, kickOffTeam, secondTeam, matchDetails)
  }

  const allBallMoves = [...koTeamMovesBallMoves, ...stMovesBallMoves]
  const validBallMoves = allBallMoves.filter(m => m.player.hasBall === true)
  if (validBallMoves.length > 0) {
    const chosenMove = validBallMoves[common.getRandomNumber(0, validBallMoves.length - 1)]
    const { player } = chosenMove
    const isKickOffTeam = kickOffTeam.players.some(p => p.playerID === player.playerID)
    const team = isKickOffTeam ? kickOffTeam : secondTeam
    const opp = isKickOffTeam ? secondTeam : kickOffTeam
    if (isKickOffTeam) {
      matchDetails.kickOffTeam = playerMovement.executeBallAction(chosenMove, team, opp, matchDetails)
    } else {
      matchDetails.secondTeam = playerMovement.executeBallAction(chosenMove, team, opp, matchDetails)
    }
  }
  if (matchDetails.ball.ballOverIterations.length === 0 || matchDetails.ball.withTeam !== '') {
    playerMovement.checkOffside(kickOffTeam, secondTeam, matchDetails)
  }
  delete matchDetails.endIteration
  matchDetails.iterationLog.push(`Ball end position: ${matchDetails.ball.position}`)
  return matchDetails
}

export async function startSecondHalf(matchDetails) {
  validate.validateMatchDetails(matchDetails)
  validate.validateTeamSecondHalf(matchDetails.kickOffTeam)
  validate.validateTeamSecondHalf(matchDetails.secondTeam)
  validate.validatePlayerPositions(matchDetails)
  const { kickOffTeam, secondTeam } = matchDetails
  setPositions.switchSide(matchDetails, kickOffTeam)
  setPositions.switchSide(matchDetails, secondTeam)
  common.removeBallFromAllPlayers(matchDetails)
  setVariables.resetPlayerPositions(matchDetails)
  setPositions.setBallSpecificGoalScoreValue(matchDetails, matchDetails.secondTeam)
  matchDetails.iterationLog = [`Second Half Started: ${matchDetails.secondTeam.name} to kick offs`]
  matchDetails.kickOffTeam.intent = 'defend'
  matchDetails.secondTeam.intent = 'attack'
  matchDetails.half++
  updateTeamEffectiveSkills(matchDetails.kickOffTeam)
  updateTeamEffectiveSkills(matchDetails.secondTeam)
  return matchDetails
}

/**
 * Inicia el Primer o Segundo Tiempo del Alargue (Tiempo Extra: half = 3 y half = 4).
 */
export async function startExtraTimeHalf(matchDetails) {
  const { kickOffTeam, secondTeam } = matchDetails
  setPositions.switchSide(matchDetails, kickOffTeam)
  setPositions.switchSide(matchDetails, secondTeam)
  common.removeBallFromAllPlayers(matchDetails)
  setVariables.resetPlayerPositions(matchDetails)
  const nextHalf = (matchDetails.half || 2) + 1
  const kickingTeam = (nextHalf % 2 === 1) ? kickOffTeam : secondTeam
  const defendingTeam = (nextHalf % 2 === 1) ? secondTeam : kickOffTeam
  setPositions.setBallSpecificGoalScoreValue(matchDetails, kickingTeam)
  kickingTeam.intent = 'attack'
  defendingTeam.intent = 'defend'
  matchDetails.half = nextHalf
  matchDetails.iterationLog = [`Extra Time Half ${nextHalf - 2} Started: ${kickingTeam.name} to kick off`]
  updateTeamEffectiveSkills(kickOffTeam)
  updateTeamEffectiveSkills(secondTeam)
  return matchDetails
}

/**
 * Actualiza en caliente la formación, mentalidad y ejecutores de pelota parada de un equipo
 * sin perder el estado del partido (respetando en qué mitad de cancha está defendiendo actualmente).
 */
export function applyLiveTactics(matchDetails, teamKey, { formationId, mentalityId, playStyleId, setPieces }) {
  const team = matchDetails[teamKey]
  if (!team) return matchDetails
  const [, pitchHeight] = matchDetails.pitchSize
  const currentSide = (team.players[0].originPOS[1] < pitchHeight / 2) ? 'top' : 'bottom'

  if (formationId) team.formation = formationId
  if (mentalityId) team.mentality = mentalityId
  if (playStyleId) team.playStyle = playStyleId
  if (setPieces) team.setPieces = { ...team.setPieces, ...setPieces }

  const slots = getFormationCoordinates(team.formation || '4-4-2', team.mentality || 'balanced', currentSide)
  team.players.forEach((player, idx) => {
    const slot = slots[idx] || slots[slots.length - 1]
    player.tacticalRole = slot.role
    player.originPOS = slot.coords.slice()
    if (common.isOnPitch(player)) {
      player.intentPOS = slot.coords.slice()
    }
  })

  updateTeamEffectiveSkills(team)
  matchDetails.iterationLog.push(`Tactical change applied by ${team.name}: ${team.formation} (${team.mentality})`)
  return matchDetails
}

/**
 * Realiza un cambio (sustitución) entre un jugador en cancha (fieldIndex: 0..10) y un suplente (benchIndex: 0..4),
 * validando límite de 5 cambios y prohibiendo reemplazar jugadores expulsados con roja.
 */
export function makeSubstitution(matchDetails, teamKey, fieldIndex, benchIndex) {
  const team = matchDetails[teamKey]
  if (!team || !Array.isArray(team.bench)) {
    throw new Error('El equipo no tiene banco de suplentes disponible.')
  }
  const maxSubs = team.maxSubstitutions || 5
  if ((team.substitutionsUsed || 0) >= maxSubs) {
    throw new Error(`Ya se realizaron los ${maxSubs} cambios reglamentarios.`)
  }
  const outgoing = team.players[fieldIndex]
  const incoming = team.bench[benchIndex]
  if (!outgoing || !incoming) {
    throw new Error('Jugador titular o suplente inválido.')
  }
  if (outgoing.sentOff || outgoing.currentPOS[0] === 'NP') {
    throw new Error('No se puede reemplazar a un jugador expulsado con tarjeta roja.')
  }

  const savedOriginPOS = outgoing.originPOS.slice()
  const savedCurrentPOS = outgoing.currentPOS.slice()
  const savedTacticalRole = outgoing.tacticalRole || outgoing.position
  const hadBall = outgoing.hasBall

  // Preparar jugador entrante con coordenadas y estructura de partido
  incoming.playerID = incoming.playerID || incoming.id || common.getRandomNumber(1000000000000, 99999999999999999)
  incoming.baseSkill = incoming.baseSkill || { ...incoming.skill }
  for (const k of Object.keys(incoming.skill)) {
    incoming.skill[k] = Number(incoming.skill[k])
    incoming.baseSkill[k] = Number(incoming.baseSkill[k])
  }
  incoming.tacticalRole = savedTacticalRole
  incoming.originPOS = savedOriginPOS.slice()
  incoming.currentPOS = savedCurrentPOS.slice()
  incoming.intentPOS = savedOriginPOS.slice()
  incoming.action = 'none'
  incoming.offside = false
  incoming.sentOff = false
  incoming.hasBall = hadBall
  incoming.stats = incoming.stats || {
    goals: 0,
    shots: { total: 0, on: 0, off: 0 },
    cards: { yellow: 0, red: 0 },
    passes: { total: 0, on: 0, off: 0 },
    tackles: { total: 0, on: 0, off: 0, fouls: 0 },
    saves: 0
  }

  if (hadBall) {
    matchDetails.ball.Player = incoming.playerID
    matchDetails.ball.lastTouch.playerName = incoming.name
    matchDetails.ball.lastTouch.playerID = incoming.playerID
  }

  // Intercambiar y marcar al saliente como ya sustituido
  outgoing.substitutedOut = true
  outgoing.hasBall = false
  team.players[fieldIndex] = incoming
  team.bench[benchIndex] = outgoing
  team.substitutionsUsed = (team.substitutionsUsed || 0) + 1

  updatePlayerEffectiveSkills(incoming, team)
  updateTeamEffectiveSkills(team)

  matchDetails.iterationLog.push(`Substitution (${team.name}): ${incoming.name} IN for ${outgoing.name}`)
  if (Array.isArray(matchDetails.events)) {
    matchDetails.events.push({
      type: 'substitution',
      teamID: team.teamID,
      teamName: team.name,
      playerIn: incoming.name,
      playerOut: outgoing.name,
      iteration: matchDetails.iterationCount || 0,
      half: matchDetails.half
    })
  }
  return matchDetails
}

/**
 * Simula un penal individual para la tanda de definición por penales post-alargue.
 */
export function simulateShootoutKick(kicker, goalkeeper) {
  const penSkill = Number(kicker.baseSkill?.penalty_taking || kicker.skill?.penalty_taking || 70)
  const shootSkill = Number(kicker.baseSkill?.shooting || kicker.skill?.shooting || 70)
  const gkSaving = Number(goalkeeper.baseSkill?.saving || goalkeeper.skill?.saving || 75)
  const gkPer = Number(goalkeeper.baseSkill?.perception || goalkeeper.skill?.perception || 75)

  const directions = ['left', 'center', 'right']
  const chosenDir = directions[common.getRandomNumber(0, 2)]
  const gkDiveDir = directions[common.getRandomNumber(0, 2)]

  // Probabilidad de que el remate vaya al arco según PEN + SHO
  const accuracyChance = Math.min(96, 52 + (penSkill * 0.36) + (shootSkill * 0.10))
  const accuracyRoll = common.getRandomNumber(1, 100)

  if (accuracyRoll > accuracyChance) {
    return {
      scored: false,
      outcome: 'missed', // Afuera o al travesaño
      kickerName: kicker.name,
      gkName: goalkeeper.name,
      kickerDir: chosenDir,
      gkDir: gkDiveDir
    }
  }

  // Si va al arco, ver si el arquero adivina el palo y alcanza a atajarlo
  const sameSide = chosenDir === gkDiveDir
  const savePower = (gkSaving * 0.65) + (gkPer * 0.35) - (penSkill * 0.35)
  const saveChance = sameSide ? Math.max(18, Math.min(72, savePower)) : Math.max(3, Math.min(14, savePower * 0.2))
  const saveRoll = common.getRandomNumber(1, 100)

  if (saveRoll <= saveChance) {
    return {
      scored: false,
      outcome: 'saved', // Atajado por el arquero
      kickerName: kicker.name,
      gkName: goalkeeper.name,
      kickerDir: chosenDir,
      gkDir: gkDiveDir
    }
  }

  return {
    scored: true,
    outcome: 'goal',
    kickerName: kicker.name,
    gkName: goalkeeper.name,
    kickerDir: chosenDir,
    gkDir: gkDiveDir
  }
}
