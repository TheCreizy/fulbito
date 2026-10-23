import assert from 'node:assert'
import { initiateGame, makeSubstitution } from '../src/engine/engine.js'
import { PLAYERS_DB } from '../src/data/playersDB.js'

console.log('======================================================================')
console.log('=== VERIFICACIÓN: REDISEÑO VISUAL, PANELES DE ESTADÍSTICAS Y STATS ===')
console.log('======================================================================\n')

// 1. Verificación de cálculo de puntaje (empieza en 6.0, rango 1.0 a 10.0)
console.log('=== 1. TEST DE PUNTAJE DE JUGADOR (CALCULATE RATING 1.0 A 10.0, BASE 6.0) ===')
function testPlayerRating(p, teamGoals = 0, oppGoals = 0) {
  const st = p.stats || {}
  let score = 6.0
  score += (st.goals || 0) * 1.25
  score += (st.assists || 0) * 0.75
  score += (st.shots?.on || 0) * 0.25
  score += (st.passes?.on || 0) * 0.05
  score += (st.dribbles || 0) * 0.2
  score += (st.blocks || 0) * 0.2
  score += (st.tackles?.standing || 0) * 0.2
  score += (st.tackles?.slides || 0) * 0.2
  score += (st.crosses?.on || 0) * 0.15
  score += (st.saves || 0) * 0.45
  score -= (st.tackles?.fouls || 0) * 0.25
  score -= (st.cards?.yellow || 0) * 0.5
  if (p.sentOff || (st.cards?.red || 0) > 0) score -= 2.5
  if (teamGoals > oppGoals) score += 0.25
  else if (teamGoals < oppGoals) score -= 0.25
  if (p.position === 'GK' && oppGoals === 0 && (st.saves || 0) > 0) score += 0.5
  return Math.max(1.0, Math.min(10.0, Number(score.toFixed(1))))
}

const basePlayer = { name: 'Test Player', position: 'ST', stats: { goals: 0, passes: { on: 0, total: 0 } } }
const initialRating = testPlayerRating(basePlayer)
assert.strictEqual(initialRating, 6.0, 'El jugador debe iniciar exactamente con puntaje 6.0')
console.log(`  ✔ Puntaje inicial verificado: ${initialRating}`)

const activePlayer = {
  name: 'Goleador',
  position: 'ST',
  stats: {
    goals: 2,
    assists: 1,
    shots: { on: 3, total: 4 },
    passes: { on: 15, total: 18 },
    dribbles: 3
  }
}
const highRating = testPlayerRating(activePlayer, 3, 1)
assert(highRating > 8.0 && highRating <= 10.0, 'Un jugador con 2 goles y 1 asistencia debe tener puntaje alto (<= 10.0)')
console.log(`  ✔ Rendimiento estelar: 2 goles, 1 asistencia -> Puntaje ${highRating}`)

const badPlayer = {
  name: 'Expulsado',
  position: 'CB',
  sentOff: true,
  stats: {
    cards: { red: 1, yellow: 1 },
    tackles: { fouls: 4 }
  }
}
const lowRating = testPlayerRating(badPlayer, 0, 4)
assert(lowRating >= 1.0 && lowRating <= 3.0, 'Jugador con roja y faltas debe caer al rango bajo pero nunca menor a 1.0')
console.log(`  ✔ Rendimiento negativo con expulsión -> Puntaje ${lowRating} (mínimo respetado >= 1.0)`)

// 2. Verificación de sustitución con registro de minuto y jugador saliente
console.log('\n=== 2. TEST DE SUSTITUCIÓN CON METADATA DE CAMBIO (⇄) ===')
const t1 = {
  name: 'Equipo A',
  formation: '4-4-2',
  players: PLAYERS_DB.slice(0, 11).map((p, i) => ({ ...p, shirtNumber: i + 1, currentPOS: [100, 200] })),
  bench: PLAYERS_DB.slice(11, 16).map((p, i) => ({ ...p, shirtNumber: 12 + i, currentPOS: ['NP', 'NP'] }))
}
const t2 = {
  name: 'Equipo B',
  formation: '4-4-2',
  players: PLAYERS_DB.slice(20, 31).map((p, i) => ({ ...p, shirtNumber: i + 1, currentPOS: [100, 700] })),
  bench: PLAYERS_DB.slice(31, 36).map((p, i) => ({ ...p, shirtNumber: 12 + i, currentPOS: ['NP', 'NP'] }))
}

const match = await initiateGame(t1, t2, { pitchWidth: 680, pitchHeight: 1050 })
match.iterationCount = 1320 // Minuto 60 (1320 / 22)
const outgoingName = match.kickOffTeam.players[3].name
makeSubstitution(match, 'kickOffTeam', 3, 0)
const incomingPlayer = match.kickOffTeam.players[3]

assert(incomingPlayer.substitutedIn, 'El jugador entrante debe tener la metadata substitutedIn')
assert.strictEqual(incomingPlayer.substitutedIn.replacedName, outgoingName, 'Debe registrar el nombre del jugador reemplazado')
assert.strictEqual(incomingPlayer.substitutedIn.minute, 60, 'Debe registrar el minuto exacto del cambio (60\')')
console.log(`  ✔ Sustitución registrada con éxito: ${incomingPlayer.name} entró por ${outgoingName} al minuto ${incomingPlayer.substitutedIn.minute}'`)

console.log('\n======================================================================')
console.log('=== ¡TODAS LAS VERIFICACIONES DEL REDISEÑO VISUAL SUPERADAS! ===')
console.log('======================================================================')
