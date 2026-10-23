import assert from 'node:assert'
import * as common from '../src/engine/common.js'
import * as setPositions from '../src/engine/setPositions.js'
import * as ballMovement from '../src/engine/ballMovement.js'
import * as setVariables from '../src/engine/setVariables.js'
import * as setFreekicks from '../src/engine/setFreekicks.js'
import * as teamShape from '../src/engine/teamShape.js'
import * as engine from '../src/engine/engine.js'
import { PLAYERS_DB } from '../src/data/playersDB.js'

console.log('======================================================================')
console.log('=== VERIFICACIÓN: AJUSTES 3 (AUDITORÍA GEMINI ARGON) ===')
console.log('======================================================================\n')

function createMockMatch() {
  const pool = PLAYERS_DB
  const team1 = {
    name: 'Boca Legends',
    mentality: 'offensive',
    initialMentality: 'offensive',
    playStyle: 'wingPlay',
    formation: '4-4-2',
    players: pool.slice(0, 11).map((p, idx) => ({
      ...p,
      currentPOS: [340, 200 + idx * 50],
      originPOS: [340, 200 + idx * 50],
      intentPOS: [340, 200 + idx * 50],
      fitness: 100,
      stats: { goals: 0, shots: { total: 0, on: 0, off: 0 }, tackles: { total: 0, off: 0, on: 0 }, passes: { total: 0, on: 0, off: 0 } }
    })),
    bench: pool.slice(11, 16).map(p => ({ ...p, fitness: 100 }))
  }
  const team2 = {
    name: 'River Idols',
    mentality: 'defensive',
    initialMentality: 'defensive',
    playStyle: 'tikiTaka',
    formation: '4-3-1-2',
    players: pool.slice(16, 27).map((p, idx) => ({
      ...p,
      currentPOS: [340, 300 + idx * 50],
      originPOS: [340, 300 + idx * 50],
      intentPOS: [340, 300 + idx * 50],
      fitness: 100,
      stats: { goals: 0, shots: { total: 0, on: 0, off: 0 }, tackles: { total: 0, off: 0, on: 0 }, passes: { total: 0, on: 0, off: 0 } }
    })),
    bench: pool.slice(27, 32).map(p => ({ ...p, fitness: 100 }))
  }
  setVariables.setGameVariables(team1)
  setVariables.setGameVariables(team2)
  const match = setVariables.populateMatchDetails(team1, team2, { pitchWidth: 680, pitchHeight: 1050, goalWidth: 90 })
  match.half = 1
  match.iterationCount = 100
  match.events = []
  return match
}

// ======================================================================
// TEST 1: PROFUNDIDAD REGLAMENTARIA DEL ÁREA DE PENAL (162px / 16.5m)
// ======================================================================
console.log('=== TEST 1: PROFUNDIDAD REGLAMENTARIA DEL ÁREA DE PENAL (common.js) ===')
{
  const match = createMockMatch()
  // Centro del área en X (340)
  // En top penalty: [0, 162] está adentro; Y=160 adentro; Y=170 está claramente afuera (tiro libre, no penal)
  assert.strictEqual(common.inTopPenalty(match, [340, 150]), true, 'Y=150 debe estar adentro del área grande superior')
  assert.strictEqual(common.inTopPenalty(match, [340, 160]), true, 'Y=160 debe estar adentro del área')
  assert.strictEqual(common.inTopPenalty(match, [340, 165]), false, 'Y=165 (en o fuera de la línea) no es penal')
  assert.strictEqual(common.inTopPenalty(match, [340, 170]), false, 'Y=170 debe estar AFUERA del área grande (falta no es penal)')

  // En bottom penalty: [1050 - 162, 1050] = [888, 1050] está adentro; Y=895 adentro; Y=870 está afuera
  assert.strictEqual(common.inBottomPenalty(match, [340, 900]), true, 'Y=900 debe estar adentro del área grande inferior')
  assert.strictEqual(common.inBottomPenalty(match, [340, 895]), true, 'Y=895 debe estar adentro')
  assert.strictEqual(common.inBottomPenalty(match, [340, 880]), false, 'Y=880 debe estar AFUERA del área grande inferior')
  assert.strictEqual(common.inBottomPenalty(match, [340, 870]), false, 'Y=870 debe estar AFUERA del área grande inferior')

  console.log('  ✓ inTopPenalty y inBottomPenalty respetan 162px exactos (16.5 metros reglamentarios).\n')
}

// ======================================================================
// TEST 2: ATRIBUCIÓN DEL GOLEADOR EN REBOTES Y DESVÍOS (setPositions.js)
// ======================================================================
console.log('=== TEST 2: ATRIBUCIÓN DEL GOLEADOR (lastShooter / closestPlayer) ===')
{
  const match = createMockMatch()
  const striker = match.kickOffTeam.players[9] // Por ejemplo el delantero #9
  const lastStarter = match.kickOffTeam.players[10] // El #11 (que antes se llevaba el gol ciegamente)
  striker.stats.goals = 0
  lastStarter.stats.goals = 0

  // Simulamos que el último toque fue de un defensor rival por un rebote fortuito
  match.ball.lastTouch = {
    playerName: 'Defensor Rival',
    playerID: 999,
    teamID: match.secondTeam.teamID
  }
  // Pero el remate fue del delantero (lastShooter registrado)
  match.ball.lastShooter = {
    playerID: striker.playerID,
    playerName: striker.name,
    teamID: match.kickOffTeam.teamID
  }
  match.ball.position = [340, -5, 0]

  setPositions.setKickOffTeamGoalScored(match)

  assert.strictEqual(striker.stats.goals, 1, 'El gol debe atribuirse al delantero que pateó (lastShooter)')
  assert.strictEqual(lastStarter.stats.goals, 0, 'No debe atribuirse ciegamente al jugador de índice 10')
  assert.strictEqual(match.pendingKickoffTeam, 'secondTeam', 'Debe programar saque para el equipo que recibió el gol')
  assert.strictEqual(match.ball.position[1], -12, 'La pelota debe permanecer adentro de la red')

  console.log('  ✓ El gol en rebote se acredita a lastShooter y la pelota reposa en la red.\n')
}

// ======================================================================
// TEST 3: PRIORIDAD DE FALTA / PENAL SOBRE ACCIÓN DE BALÓN (engine.js)
// ======================================================================
console.log('=== TEST 3: PRIORIDAD DE FALTA/PENAL EN engine.playIteration ===')
{
  const match = createMockMatch()
  // Simulamos que durante movePlayers se cobró un penal / falta que encendió match.endIteration = true
  match.endIteration = true
  match.ball.withPlayer = true

  // Al pasar por playIteration, debe cortar la iteración y no ejecutar acciones de balón posteriores
  const result = engine.playIteration(match)
  assert.strictEqual(result.endIteration, undefined, 'endIteration debe ser consumido/limpiado')
  assert.ok(result, 'playIteration retorna el estado inmediatamente tras la detención')

  console.log('  ✓ playIteration respeta endIteration inmediatamente tras movePlayers.\n')
}

// ======================================================================
// TEST 4: ROLES TÁCTICOS EXT, CDM, CAM (setPositions, setFreekicks, teamShape)
// ======================================================================
console.log('=== TEST 4: SOPORTE DE ROLES EXT, CDM, CAM EN DEFENSA Y TIROS LIBRES ===')
{
  const match = createMockMatch()
  assert.strictEqual(setFreekicks.isMidfieldRole('CDM'), true, 'CDM debe ser reconocido como mediocampista en tiros libres')
  assert.strictEqual(setFreekicks.isMidfieldRole('CAM'), true, 'CAM debe ser reconocido como mediocampista en tiros libres')
  assert.strictEqual(setFreekicks.isMidfieldRole('CM'), true, 'CM debe ser mediocampista')
  assert.strictEqual(setFreekicks.isDefenderRole('CB'), true, 'CB debe ser defensor')

  // Verificar que teamShape penaliza a los CBs en presión cuando el balón está a más de 210px
  match.ball.position = [340, 525, 0] // Balón en mitad de cancha (> 210px del arco propio)
  const plan = teamShape.assignDefensivePlanWithIncumbency(
    match.kickOffTeam,
    match.secondTeam,
    match,
    true
  )
  assert.ok(plan, 'teamShape genera plan defensivo')
  const presser = match.kickOffTeam.players.find(p => p.playerID === plan.presserID)
  assert.ok(presser, 'Debe haber un asignado a la presión')
  // Con el balón a 525px, un CB no debería ser el presser teniendo volantes/delanteros disponibles
  assert.notStrictEqual(presser.position, 'CB', 'Un marcador central no debe salir a presionar a mitad de cancha')

  console.log('  ✓ CDM y CAM son mediocampistas en tiros libres y CB preserva la cueva defensiva.\n')
}

// ======================================================================
// TEST 5: SAQUE DE MITAD DE CANCHA (isRestart = true y distancia de pase >= 12)
// ======================================================================
console.log('=== TEST 5: SAQUE INICIAL CON isRestart Y PASE CORTO ASOCIATIVO ===')
{
  const match = createMockMatch()
  setVariables.koDecider(match.kickOffTeam, match)

  assert.strictEqual(match.ball.isRestart, true, 'koDecider debe marcar isRestart = true')
  assert.strictEqual(match.ball.restartWaitTicks, 6, 'koDecider debe asignar restartWaitTicks = 6')

  // Distancia del compañero receptor en el círculo central
  const taker = match.kickOffTeam.players.find(p => p.isKickoffPass) || match.kickOffTeam.players[9]
  const otherPlayers = match.kickOffTeam.players.filter(p => p !== taker)
  const nearestTeammate = otherPlayers.reduce((closest, p) => {
    const d = common.distance(match.ball.position, p.currentPOS)
    return d < closest.d ? { player: p, d } : closest
  }, { player: null, d: Infinity })

  assert.ok(nearestTeammate.d <= 26, `El receptor de saque debe estar a ~24px (actual: ${nearestTeammate.d})`)

  console.log('  ✓ Saque inicial configurado con isRestart, receptor a 24px y pausa visual.\n')
}

// ======================================================================
// TEST 6: MAPEO EXACTO DE SKILLS EN playersDB.js
// ======================================================================
console.log('=== TEST 6: MAPEO DE IDs EN PLAYERS_DB (Crespo, Agüero, Mascherano, Cambiasso) ===')
{
  const p42 = PLAYERS_DB.find(p => p.id === 42)
  const p43 = PLAYERS_DB.find(p => p.id === 43)
  const p133 = PLAYERS_DB.find(p => p.id === 133)
  const p134 = PLAYERS_DB.find(p => p.id === 134)

  assert.ok(p42, 'Jugador ID 42 debe existir')
  assert.ok(p42.name.includes('Crespo'), `ID 42 debe ser Crespo (actual: ${p42.name})`)
  assert.strictEqual(p42.skill.heading, 94, 'Crespo (42) debe tener heading 94')
  assert.strictEqual(p42.skill.stamina, 85, 'Crespo (42) debe tener stamina 85')

  assert.ok(p43, 'Jugador ID 43 debe existir')
  assert.ok(p43.name.includes('Agüero') || p43.name.includes('Aguero'), `ID 43 debe ser Agüero (actual: ${p43.name})`)
  assert.strictEqual(p43.skill.heading, 78, 'Agüero (43) debe tener heading 78')
  assert.strictEqual(p43.skill.stamina, 84, 'Agüero (43) debe tener stamina 84')

  assert.ok(p133, 'Jugador ID 133 debe existir')
  assert.ok(p133.name.includes('Mascherano'), `ID 133 debe ser Mascherano (actual: ${p133.name})`)
  assert.strictEqual(p133.skill.stamina, 94, 'Mascherano (133) debe tener stamina 94')

  assert.ok(p134, 'Jugador ID 134 debe existir')
  assert.ok(p134.name.includes('Cambiasso'), `ID 134 debe ser Cambiasso (actual: ${p134.name})`)
  assert.strictEqual(p134.skill.stamina, 92, 'Cambiasso (134) debe tener stamina 92')

  console.log('  ✓ IDs de jugadores y skills personalizadas sincronizados correctamente.\n')
}

// ======================================================================
// TEST 7: CONTACTO VISUAL DEL ARQUERO EN ATAJADAS Y DIRECCIÓN DE OFFSIDE
// ======================================================================
console.log('=== TEST 7: CONTACTO VISUAL EN ATAJADAS Y PENÚLTIMO DEFENSOR ===')
{
  const match = createMockMatch()
  const goalie = match.kickOffTeam.players[0]
  goalie.originPOS = [340, 20]
  const ballPos = [350, 40, 0]

  ballMovement.executeGoalkeeperSave(match, goalie, match.kickOffTeam, ballPos)

  assert.strictEqual(goalie.currentPOS[0], 350, 'El arquero debe posicionarse sobre la coordenada X del balón en la atajada')
  assert.strictEqual(goalie.currentPOS[1], 40, 'El arquero debe posicionarse sobre la coordenada Y del balón en la atajada')

  // Segundo último defensor excluyendo al arquero cuando hay defensores de campo
  const secondLast = ballMovement.getSecondLastDefender(match.secondTeam, true, match.pitchSize[1])
  assert.ok(secondLast, 'getSecondLastDefender debe retornar un jugador')
  assert.notStrictEqual(secondLast.position, 'GK', 'El penúltimo defensor no debe ser el arquero si hay jugadores de campo')

  console.log('  ✓ Contacto visual en atajadas y cálculo reglamentario de penúltimo defensor correctos.\n')
}

console.log('======================================================================')
console.log('🎉 TODOS LOS TESTS DE VERIFICACIÓN DE AJUSTES 3 PASARON EXITOSAMENTE 🎉')
console.log('======================================================================')
