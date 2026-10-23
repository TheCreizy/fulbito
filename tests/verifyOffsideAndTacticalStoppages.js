import assert from 'node:assert'
import {
  evaluateOffsideAtKick,
  getSecondLastDefender,
  setDeflectionPlayerOffside
} from '../src/engine/ballMovement.js'
import {
  initiateGame,
  makeSubstitution,
  applyLiveTactics
} from '../src/engine/engine.js'
import { getFormationCoordinates } from '../src/data/formations.js'
import { PLAYERS_DB } from '../src/data/playersDB.js'
import { autoSetupTeamFromSquad } from '../src/draft/draftEngine.js'

console.log('======================================================================')
console.log('=== VERIFICACIÓN: SISTEMA DE OFFSIDE (VAR), EXPULSIONES Y REPOINTER ===')
console.log('======================================================================\n')

// 1. Preparar equipos para el test
const squad1 = PLAYERS_DB.slice(0, 16)
const squad2 = PLAYERS_DB.slice(16, 32)

const team1 = autoSetupTeamFromSquad(squad1, {
  teamName: 'Equipo Atacante',
  primaryColor: '#3b82f6',
  secondaryColor: '#facc15',
  formationId: '4-4-2',
  mentalityId: 'attacking',
  side: 'bottom' // Inicia atacando hacia arriba (arco en Y=0)
})

const team2 = autoSetupTeamFromSquad(squad2, {
  teamName: 'Equipo Defensor',
  primaryColor: '#ef4444',
  secondaryColor: '#ffffff',
  formationId: '4-4-2',
  mentalityId: 'balanced',
  side: 'top' // Inicia defendiendo el arco en Y=0
})

const pitchDetails = { pitchWidth: 680, pitchHeight: 1050, goalWidth: 90 }
const matchDetails = await initiateGame(team1, team2, pitchDetails)

// === TEST 1: CÁLCULO DEL PENÚLTIMO DEFENSOR Y OFFSIDE SNAPSHOT (OPEN FOOTBALL MODEL) ===
console.log('=== TEST 1: CÁLCULO DEL PENÚLTIMO DEFENSOR Y OFFSIDE SNAPSHOT ===')

// Team2 defiende el arco superior (Y=0).
// Simulemos la línea defensiva:
// Arquero en Y = 40 (último defensor más cercano a la meta Y=0).
// Central en Y = 280 (penúltimo defensor más cercano a la meta).
// Resto de defensores y mediocampistas más adelantados (Y >= 290).
team2.players[0].currentPOS = [340, 40] // Arquero (último defensor)
team2.players[2].currentPOS = [280, 280] // Central (penúltimo defensor!)
team2.players[1].currentPOS = [120, 290]
team2.players[3].currentPOS = [400, 310]
team2.players[4].currentPOS = [560, 320]
for (let i = 5; i < team2.players.length; i++) {
  team2.players[i].currentPOS = [300, 450 + i * 10]
}

// Atacante atacando hacia Y=0 (attackingTop = true)
const secondLast = getSecondLastDefender(team2, true, 1050)
assert(secondLast != null, 'Debe encontrar al penúltimo defensor')
assert.strictEqual(secondLast.playerID, team2.players[2].playerID, 'El penúltimo defensor debe ser el segundo con menor Y')
console.log(`  - Penúltimo defensor detectado: ${secondLast.name} en Y=${secondLast.currentPOS[1]}`)

// Situación A: Delantero en posición lícita (Y = 320, detrás de la línea de 290)
const passer = team1.players[6] // Mediocampista
passer.currentPOS = [300, 500]
passer.originPOS = [300, 700] // Defiende abajo, ataca hacia Y=0
const strikerOnside = team1.players[9]
strikerOnside.currentPOS = [320, 330] // Habilitado

const snapOnside = evaluateOffsideAtKick(matchDetails, team1, team2, passer, strikerOnside, [300, 500])
assert.strictEqual(snapOnside.isOffside, false, 'El delantero detrás de la línea debe estar habilitado')
console.log('  ✔ Delantero en posición lícita evaluado correctamente (onside).')

// Situación B: Delantero en posición adelantada (Y = 220, más adelantado que la línea de 290 y de la pelota en 500)
const strikerOffside = team1.players[10]
strikerOffside.currentPOS = [350, 220] // Adelantado!

const snapOffside = evaluateOffsideAtKick(matchDetails, team1, team2, passer, strikerOffside, [300, 500])
assert.strictEqual(snapOffside.isOffside, true, 'El delantero por delante de la línea defensiva debe estar en offside')
assert(snapOffside.defendingLineY >= 280, 'Debe registrar la coordenada Y de la línea defensiva')
assert.strictEqual(snapOffside.targetPlayerName, strikerOffside.name, 'Debe registrar el nombre del jugador adelantado')
assert.strictEqual(snapOffside.passerName, passer.name, 'Debe registrar el nombre del pasador')
console.log(`  ✔ Fuera de juego detectado: ${snapOffside.targetPlayerName} adelantado tras pase de ${snapOffside.passerName}`)
console.log(`  ✔ Snapshot VAR generado con datos de líneas: DefendingLineY=${snapOffside.defendingLineY}, BallY=500, AttackerY=220`)

// === TEST 2: SANCIÓN DE OFFSIDE Y TIRO LIBRE INDIRECTO ===
console.log('\n=== TEST 2: SANCIÓN DE OFFSIDE Y GENERACIÓN DE EVENTO VAR ===')
matchDetails.pendingOffsideSnapshot = snapOffside
strikerOffside.offside = true

// Simular cobro de offside al intervenir el delantero
setDeflectionPlayerOffside(matchDetails, team1, strikerOffside)

const offsideEvent = matchDetails.events.find(ev => ev.type === 'offside')
assert(offsideEvent != null, 'Debe registrarse un evento de tipo offside')
assert.strictEqual(offsideEvent.playerName, strikerOffside.name, 'El evento debe contener el nombre del infractor')
assert.strictEqual(offsideEvent.deadBall, true, 'Debe marcarse como pelota parada')
assert(offsideEvent.varData != null, 'Debe incluir los datos varData para la repetición televisiva / VAR')
console.log(`  ✔ Evento offside registrado: ${offsideEvent.playerName} (VAR Data incluido con éxito).`)

// === TEST 3: EXPULSIÓN DEL ARQUERO Y REASIGNACIÓN DE ROLES PARA CUBRIR EL PUESTO ===
console.log('\n=== TEST 3: EXPULSIÓN DE ARQUERO, REASIGNACIÓN TÁCTICA Y CAMBIO REGLAMENTARIO ===')

// Expulsemos al arquero del team1 (índice 0)
const originalGK = team1.players[0]
originalGK.sentOff = true
originalGK.currentPOS = ['NP', 'NP']
originalGK.intentPOS = ['NP', 'NP']
console.log(`  - Arquero titular expulsado con roja: ${originalGK.name} (#${originalGK.shirtNumber})`)

// Verificar que la regla FIFA impida cambiar DIRECTAMENTE al expulsado por un suplente del banco
assert.throws(() => {
  makeSubstitution(matchDetails, 'kickOffTeam', 0, 0)
}, /No se puede reemplazar a un jugador expulsado/i, 'La regla FIFA debe prohibir sustituir directamente al expulsado')
console.log('  ✔ Regla FIFA validada: no se puede sustituir directamente a un jugador expulsado con tarjeta roja.')

// Ahora el DT reasigna puestos: mueve al delantero (índice 9) al arco (índice 0)
const strikerActive = team1.players[9]
console.log(`  - Reasignando tácticamente: Delantero ${strikerActive.name} pasa al arco (slot 0)`)

const coords = getFormationCoordinates(team1.formation, team1.mentality, 'bottom')
const slotGK = coords[0]
const slotST = coords[9]

// Swap de titulares como lo hace la pizarra táctica:
team1.players[0] = { ...strikerActive, tacticalRole: slotGK.role, originPOS: slotGK.coords.slice(), currentPOS: slotGK.coords.slice(), intentPOS: slotGK.coords.slice() }
team1.players[9] = { ...originalGK, tacticalRole: slotST.role, originPOS: slotST.coords.slice(), currentPOS: ['NP', 'NP'], intentPOS: ['NP', 'NP'] }

assert.strictEqual(team1.players[0].tacticalRole, 'GK', 'El jugador en el slot 0 debe tener el rol de GK')
assert.strictEqual(team1.players[0].sentOff, false, 'El nuevo arquero provisional no está expulsado')
assert.strictEqual(team1.players[9].sentOff, true, 'El expulsado reubicado en el slot 9 debe permanecer expulsado')
assert.strictEqual(team1.players[9].currentPOS[0], 'NP', 'El expulsado debe permanecer fuera de la cancha (NP)')
console.log(`  ✔ Puesto del arco cubierto provisionalmente por ${team1.players[0].name} (Rol: ${team1.players[0].tacticalRole}).`)

// Ahora el DT decide cambiar al delantero improvisado en el arco por el arquero suplente del banco (bIdx = 0, suponiendo que es arquero o jugador habilitado)
// Busquemos al arquero suplente en el banco
let benchGKIdx = team1.bench.findIndex(bp => bp.position === 'GK')
if (benchGKIdx === -1) benchGKIdx = 0
const benchKeeper = team1.bench[benchGKIdx]
console.log(`  - Cambiando al arquero improvisado por el suplente ${benchKeeper.name} (${benchKeeper.position})`)

makeSubstitution(matchDetails, 'kickOffTeam', 0, benchGKIdx)
assert.strictEqual(team1.players[0].playerID, benchKeeper.playerID, 'El arquero suplente debe estar ahora en el slot 0')
assert.strictEqual(team1.substitutionsUsed, 1, 'Debe haber consumido 1 cambio reglamentario')
assert.strictEqual(team1.players[9].sentOff, true, 'El equipo debe seguir jugando con un hombre menos en el slot 9')
console.log(`  ✔ Arquero suplente ${team1.players[0].name} ingresó al arco reglamentariamente. Equipo sigue con 10 hombres.`)

// Verificar que applyLiveTactics preserve al expulsado fuera del campo
applyLiveTactics(matchDetails, 'kickOffTeam', { formationId: '4-4-2', mentalityId: 'defensive' })
assert.strictEqual(team1.players[9].currentPOS[0], 'NP', 'applyLiveTactics debe mantener al expulsado en NP')
assert.strictEqual(team1.players[9].sentOff, true, 'applyLiveTactics debe preservar sentOff')
console.log('  ✔ applyLiveTactics preserva al jugador expulsado fuera de cancha.')

// === TEST 4: PERSISTENCIA DEL SNAPSHOT A TRAVÉS DE MÚLTIPLES TICKS Y keepInBoundaries ===
console.log('\n=== TEST 4: PERSISTENCIA DEL SNAPSHOT A TRAVÉS DE MÚLTIPLES TICKS Y keepInBoundaries ===')
import('../src/engine/setPositions.js').then(async ({ keepInBoundaries }) => {
  const { setClosePlayerTakesBall } = await import('../src/engine/playerMovement.js')

  // Reiniciamos un delantero en offside
  const attacker = team1.players[10]
  attacker.offside = true
  attacker.offsideSnapshot = snapOffside
  matchDetails.pendingOffsideSnapshot = snapOffside
  matchDetails.lastOffsideSnapshot = snapOffside

  // Simulamos 5 ticks de vuelo de la pelota dentro de los límites
  for (let tick = 1; tick <= 5; tick++) {
    const ballPosInFlight = [340, 500 - tick * 40, 5]
    keepInBoundaries(matchDetails, team1.teamID, ballPosInFlight)
    assert(matchDetails.pendingOffsideSnapshot != null, `El snapshot no debe ser borrado en el tick ${tick} por keepInBoundaries`)
    assert(attacker.offsideSnapshot != null, `El snapshot del jugador no debe ser borrado en el tick ${tick}`)
  }
  console.log('  ✔ Snapshot de VAR persistió íntegro a través de 5 ticks de vuelo del balón.')

  // Ahora el delantero toma el balón en la jugada
  matchDetails.events = []
  setClosePlayerTakesBall(matchDetails, attacker, team1, team2)

  const varEvent = matchDetails.events.find(e => e.type === 'offside')
  assert(varEvent != null, 'Debe emitirse el evento de offside')
  assert(varEvent.varData != null, 'varData debe existir en el evento')
  assert.strictEqual(varEvent.varData.defendingLineY, snapOffside.defendingLineY, 'defendingLineY debe ser la real del defensor y no 525')
  assert(varEvent.varData.playersSnapshot != null, 'playersSnapshot debe contener los 22 jugadores')
  assert.strictEqual(varEvent.varData.playersSnapshot.attacking.length, 11, 'Snapshot atacante con 11 jugadores')
  assert.strictEqual(varEvent.varData.playersSnapshot.defending.length, 11, 'Snapshot defensor con 11 jugadores')
  console.log('  ✔ Offside sancionado con éxito: varData incluye jugadores congelados y línea defensiva real (no 525).')

  console.log('\n======================================================================')
  console.log('=== ¡TODAS LAS VERIFICACIONES DE OFFSIDE Y TÁCTICA SUPERADAS AL 100%! ===')
  console.log('======================================================================')
})
