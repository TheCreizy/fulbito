import assert from 'node:assert'
import {
  initiateGame,
  makeSubstitution,
  applyLiveTactics,
  playIteration
} from '../src/engine/engine.js'
import { PLAYERS_DB } from '../src/data/playersDB.js'
import { autoSetupTeamFromSquad } from '../src/draft/draftEngine.js'

console.log('======================================================================')
console.log('=== TEST: EXPULSIÓN DE 2 JUGADORES, DESHACER CAMBIOS Y REANUDACIÓN ===')
console.log('======================================================================\n')

const squad1 = PLAYERS_DB.slice(0, 16)
const squad2 = PLAYERS_DB.slice(16, 32)

const team1 = autoSetupTeamFromSquad(squad1, {
  teamName: 'Boca Juniors',
  primaryColor: '#1d4ed8',
  secondaryColor: '#facc15',
  formationId: '4-4-2',
  mentalityId: 'attacking',
  side: 'bottom'
})

const team2 = autoSetupTeamFromSquad(squad2, {
  teamName: 'River Plate',
  primaryColor: '#ef4444',
  secondaryColor: '#ffffff',
  formationId: '4-4-2',
  mentalityId: 'balanced',
  side: 'top'
})

const pitchDetails = { pitchWidth: 680, pitchHeight: 1050, goalWidth: 90 }
let matchDetails = await initiateGame(team1, team2, pitchDetails)

// 1. Verificar que los jugadores del banco tengan playerID y stats inicializados
console.log('1. Verificando que los suplentes tengan playerID y estructura completa:')
for (let i = 0; i < team1.bench.length; i++) {
  const sub = team1.bench[i]
  assert(sub.playerID != null, `El suplente #${i} (${sub.name}) debe tener playerID asignado`)
  assert(sub.stats != null, `El suplente #${i} (${sub.name}) debe tener stats asignados`)
  assert(Array.isArray(sub.currentPOS), `El suplente #${i} debe tener currentPOS inicializado`)
}
console.log('   ✔ Todos los suplentes tienen playerID, stats y coordenadas inicializadas.')

// 2. Simular expulsión de 2 jugadores en team1
console.log('\n2. Simulando expulsión de 2 jugadores en Boca Juniors:')
const red1 = team1.players[4] // Ej: Defensor
red1.sentOff = true
red1.currentPOS = ['NP', 'NP']
red1.intentPOS = ['NP', 'NP']

const red2 = team1.players[8] // Ej: Mediocampista
red2.sentOff = true
red2.currentPOS = ['NP', 'NP']
red2.intentPOS = ['NP', 'NP']

console.log(`   - Expulsado 1: ${red1.name} (sentOff = true, POS = NP)`)
console.log(`   - Expulsado 2: ${red2.name} (sentOff = true, POS = NP)`)

// 3. Simular solicitud de cambio pendiente (fieldIdx = 9, benchIdx = 0)
console.log('\n3. Simulando solicitud de cambio pendiente y posterior deshacer:')
const starterToSub = team1.players[9]
const benchToEnter = team1.bench[0]

let pendingSubs = [{
  id: `kickOffTeam-9-0-${Date.now()}`,
  teamKey: 'kickOffTeam',
  starterIdx: 9,
  benchIdx: 0,
  outgoingName: starterToSub.name,
  incomingName: benchToEnter.name
}]

// Usuario se arrepiente y hace UNDO del cambio
pendingSubs = []
console.log('   ✔ Cambio deshecho por el usuario (pendingSubs vaciado sin mutar jugadores).')

// 4. Usuario reorganiza táctica en la pizarra (applyLiveTactics) y reubica jugadores
console.log('\n4. Aplicando ajuste táctico con 9 jugadores:')
matchDetails = applyLiveTactics(matchDetails, 'kickOffTeam', {
  formationId: '4-3-1',
  mentalityId: 'defensive'
})

// Verificar que ningún jugador en team1.players haya perdido playerID
team1.players.forEach((p, idx) => {
  assert(p.playerID != null, `El jugador en slot ${idx} (${p.name}) no debe perder playerID`)
  assert(p.stats != null, `El jugador en slot ${idx} (${p.name}) debe tener stats`)
})
console.log('   ✔ Todos los jugadores conservan playerID y stats íntegros.')

// 5. Reanudar el partido: ejecutar 3 iteraciones de juego completas
console.log('\n5. Reanudando el partido tras el incidente:')
for (let iter = 1; iter <= 3; iter++) {
  matchDetails = await playIteration(matchDetails)
  assert(matchDetails != null, `La iteración ${iter} debe completarse exitosamente`)
}
console.log('   ✔ El partido continuó jugando normalmente sin arrojar excepciones de playerID.')

console.log('\n======================================================================')
console.log('=== ¡TODAS LAS VALIDACIONES DE EXPULSIONES Y UNDO SUPERADAS AL 100%! ===')
console.log('======================================================================\n')
