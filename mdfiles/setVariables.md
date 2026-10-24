# `setVariables.js` - Inicialización y Estado de Variables del Partido

> **Categoría:** `Estado y Variables`  
> **Ubicación:** `src/engine/setVariables.js`  
> **Líneas de código:** 212  
> **Tamaño:** 6.37 KB

---

## 📋 Resumen del Módulo

Establece y reinicia los contadores de tiempo, posesión, saques de mitad de cancha asociativos (isRestart), registro de iteraciones y estadísticas acumuladas de ambos equipos.

---

## 🧩 Exportaciones y Elementos Principales

- **Línea 4:** `export function resetPlayerPositions(matchDetails)`
- **Línea 23:** `export function setGameVariables(team)`
- **Línea 115:** `export function koDecider(team1, matchDetails)`
- **Línea 154:** `export function populateMatchDetails(team1, team2, pitchDetails)`



---

## 💻 Código Fuente JavaScript (`setVariables.js`)

````javascript
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
  team.teamID = team.teamID || common.getRandomNumber(1000000000000, 99999999999999999)
  team.players.forEach((player, idx) => {
    player.playerID = player.playerID || player.id || common.getRandomNumber(1000000000000, 99999999999999999)
    player.teamID = team.teamID
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
      assists: 0,
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
      crosses: {
        total: 0,
        on: 0
      },
      dribbles: 0,
      blocks: 0,
      tackles: {
        total: 0,
        on: 0,
        off: 0,
        fouls: 0,
        slides: 0,
        standing: 0
      },
      saves: 0,
      distanceCovered: 0
    }
  })
  if (Array.isArray(team.bench)) {
    team.bench.forEach((player, idx) => {
      player.playerID = player.playerID || player.id || common.getRandomNumber(1000000000000, 99999999999999999)
      player.teamID = team.teamID
      player.shirtNumber = player.shirtNumber || (idx + 12)
      player.baseSkill = { ...player.skill }
      for (const k of Object.keys(player.skill || {})) {
        player.skill[k] = Number(player.skill[k])
        player.baseSkill[k] = Number(player.baseSkill[k])
      }
      player.originPOS = ['NP', 'NP']
      player.intentPOS = ['NP', 'NP']
      player.currentPOS = ['NP', 'NP']
      player.action = 'none'
      player.offside = false
      player.hasBall = false
      player.sentOff = false
      player.stats = player.stats || {
        goals: 0,
        assists: 0,
        shots: { total: 0, on: 0, off: 0 },
        cards: { yellow: 0, red: 0 },
        passes: { total: 0, on: 0, off: 0 },
        crosses: { total: 0, on: 0 },
        dribbles: 0,
        blocks: 0,
        tackles: { total: 0, on: 0, off: 0, fouls: 0, slides: 0, standing: 0 },
        saves: 0,
        distanceCovered: 0
      }
    })
  }
  team.intent = 'none'
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
  matchDetails.ball.isRestart = true
  matchDetails.ball.restartWaitTicks = 6
  team1.intent = 'attack'
  team1.players[kickOffIdx].currentPOS = [matchDetails.ball.position[0], matchDetails.ball.position[1]]
  team1.players[kickOffIdx].intentPOS = [matchDetails.ball.position[0], matchDetails.ball.position[1]]
  team1.players[kickOffIdx].hasBall = true
  team1.players[kickOffIdx].action = 'pass'
  team1.players[kickOffIdx].isKickoffPass = true
  matchDetails.kickoffRetentionTicks = 16
  matchDetails.turnoverTick = -999
  matchDetails.ball.lastTouch.playerName = team1.players[kickOffIdx].name
  matchDetails.ball.lastTouch.playerID = team1.players[kickOffIdx].playerID
  matchDetails.ball.lastTouch.teamID = team1.teamID
  matchDetails.ball.lastTouch.deflection = false
  matchDetails.ball.lastTouch.iterations = 0
  matchDetails.ball.ballOverIterations = []

  if (team1.players[waitingIdx] && common.isOnPitch(team1.players[waitingIdx])) {
    team1.players[waitingIdx].currentPOS = [matchDetails.ball.position[0] + 24, matchDetails.ball.position[1]]
    team1.players[waitingIdx].intentPOS = [matchDetails.ball.position[0] + 24, matchDetails.ball.position[1]]
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

````

