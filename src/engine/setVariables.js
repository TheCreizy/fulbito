import * as common from './common.js'
import { updateTeamEffectiveSkills } from './modifiers.js'

export function resetPlayerPositions(matchDetails) {
  for (const player of matchDetails.kickOffTeam.players) {
    if (common.isOnPitch(player)) {
      player.currentPOS = player.originPOS.slice()
      player.intentPOS = player.originPOS.slice()
    } else {
      player.currentPOS = ['NP', 'NP']
    }
  }
  for (const player of matchDetails.secondTeam.players) {
    if (common.isOnPitch(player)) {
      player.currentPOS = player.originPOS.slice()
      player.intentPOS = player.originPOS.slice()
    } else {
      player.currentPOS = ['NP', 'NP']
    }
  }
}

export function setGameVariables(team) {
  team.players.forEach((player, idx) => {
    player.playerID = player.playerID || player.id || common.getRandomNumber(1000000000000, 99999999999999999)
    player.shirtNumber = player.shirtNumber || (idx + 1)
    player.baseSkill = { ...player.skill }
    // Convertir todos los skills a números por seguridad
    for (const k of Object.keys(player.skill)) {
      player.skill[k] = Number(player.skill[k])
      player.baseSkill[k] = Number(player.baseSkill[k])
    }
    player.originPOS = player.currentPOS.slice()
    player.intentPOS = player.currentPOS.slice()
    player.action = 'none'
    player.offside = false
    player.hasBall = false
    player.sentOff = false
    player.stats = {
      goals: 0,
      shots: {
        total: 0,
        on: 0,
        off: 0
      },
      cards: {
        yellow: 0,
        red: 0
      },
      passes: {
        total: 0,
        on: 0,
        off: 0
      },
      tackles: {
        total: 0,
        on: 0,
        off: 0,
        fouls: 0
      },
      saves: 0
    }
  })
  team.intent = 'none'
  team.teamID = team.teamID || common.getRandomNumber(1000000000000, 99999999999999999)
  team.substitutionsUsed = team.substitutionsUsed || 0
  team.maxSubstitutions = team.maxSubstitutions || 5
  updateTeamEffectiveSkills(team)
  return team
}

export function koDecider(team1, matchDetails) {
  const activeFieldPlayers = team1.players
    .map((p, idx) => ({ p, idx }))
    .filter(item => item.idx > 0 && common.isOnPitch(item.p))

  const kickOffIdx = activeFieldPlayers.length > 0
    ? activeFieldPlayers[activeFieldPlayers.length - 1].idx
    : 9
  const waitingIdx = activeFieldPlayers.length > 1
    ? activeFieldPlayers[activeFieldPlayers.length - 2].idx
    : 10

  matchDetails.ball.withPlayer = true
  matchDetails.ball.Player = team1.players[kickOffIdx].playerID
  matchDetails.ball.withTeam = team1.teamID
  team1.intent = 'attack'
  team1.players[kickOffIdx].currentPOS = [matchDetails.ball.position[0], matchDetails.ball.position[1]]
  team1.players[kickOffIdx].intentPOS = [matchDetails.ball.position[0], matchDetails.ball.position[1]]
  team1.players[kickOffIdx].hasBall = true
  team1.players[kickOffIdx].action = 'pass'
  team1.players[kickOffIdx].isKickoffPass = true
  matchDetails.ball.lastTouch.playerName = team1.players[kickOffIdx].name
  matchDetails.ball.lastTouch.playerID = team1.players[kickOffIdx].playerID
  matchDetails.ball.lastTouch.teamID = team1.teamID
  matchDetails.ball.lastTouch.deflection = false
  matchDetails.ball.lastTouch.iterations = 0
  matchDetails.ball.ballOverIterations = []

  if (team1.players[waitingIdx] && common.isOnPitch(team1.players[waitingIdx])) {
    team1.players[waitingIdx].currentPOS = [matchDetails.ball.position[0] + 18, matchDetails.ball.position[1]]
    team1.players[waitingIdx].intentPOS = [matchDetails.ball.position[0] + 18, matchDetails.ball.position[1]]
  }
  return team1
}

export function populateMatchDetails(team1, team2, pitchDetails) {
  return {
    matchID: common.getRandomNumber(1000000000000, 99999999999999999),
    kickOffTeam: team1,
    secondTeam: team2,
    pitchSize: [pitchDetails.pitchWidth, pitchDetails.pitchHeight, pitchDetails.goalWidth || 90],
    ball: {
      position: [pitchDetails.pitchWidth / 2, pitchDetails.pitchHeight / 2, 0],
      withPlayer: true,
      Player: '',
      withTeam: '',
      direction: 'south',
      ballOverIterations: [],
      lastTouch: {
        playerName: '',
        playerID: '',
        teamID: '',
        bodyPart: '',
        deflection: false,
        iterations: 0
      }
    },
    half: 1,
    iterationCount: 0,
    events: [], // Eventos estructurados para UI y relatos (goles, tarjetas, cambios, lesiones)
    kickOffTeamStatistics: {
      goals: 0,
      shots: {
        total: 0,
        on: 0,
        off: 0
      },
      passesTotal: 0,
      passesCompleted: 0,
      possessionTicks: 1,
      corners: 0,
      freekicks: 0,
      penalties: 0,
      fouls: 0
    },
    secondTeamStatistics: {
      goals: 0,
      shots: {
        total: 0,
        on: 0,
        off: 0
      },
      passesTotal: 0,
      passesCompleted: 0,
      possessionTicks: 1,
      corners: 0,
      freekicks: 0,
      penalties: 0,
      fouls: 0
    },
    iterationLog: []
  }
}
