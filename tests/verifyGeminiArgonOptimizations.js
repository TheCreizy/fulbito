import assert from 'node:assert'
import * as actions from '../src/engine/actions.js'
import * as playerMovement from '../src/engine/playerMovement.js'
import * as setPositions from '../src/engine/setPositions.js'
import * as ballMovement from '../src/engine/ballMovement.js'
import * as coachAI from '../src/engine/coachAI.js'
import * as setVariables from '../src/engine/setVariables.js'
import * as engine from '../src/engine/engine.js'
import { PLAYERS_DB } from '../src/data/playersDB.js'

console.log('======================================================================')
console.log('=== VERIFICACIÓN: OPTIMIZACIONES DEL INFORME GEMINI ARGON ===')
console.log('======================================================================\n')

function createMockMatch() {
  const pool = PLAYERS_DB
  const team1 = {
    teamID: 'T1',
    name: 'Boca Legends',
    mentality: 'offensive',
    initialMentality: 'offensive',
    playStyle: 'balanced',
    players: pool.slice(0, 11).map((p, idx) => ({
      ...p,
      playerID: `1_${idx}`,
      currentPOS: [340, 200 + idx * 50],
      originPOS: [340, 200 + idx * 50],
      intentPOS: [340, 200 + idx * 50],
      action: 'none',
      offside: false,
      hasBall: false,
      fitness: 100,
      stats: { passes: { total: 0, on: 0 }, shots: { total: 0, on: 0 }, tackles: { total: 0, on: 0, fouls: 0 }, cards: { yellow: 0, red: 0 } }
    }))
  }
  const team2 = {
    teamID: 'T2',
    name: 'River Idols',
    mentality: 'defensive',
    initialMentality: 'defensive',
    playStyle: 'balanced',
    players: pool.slice(11, 22).map((p, idx) => ({
      ...p,
      playerID: `2_${idx}`,
      currentPOS: [340, 300 + idx * 50],
      originPOS: [340, 300 + idx * 50],
      intentPOS: [340, 300 + idx * 50],
      action: 'none',
      offside: false,
      hasBall: false,
      fitness: 100,
      stats: { passes: { total: 0, on: 0 }, shots: { total: 0, on: 0 }, tackles: { total: 0, on: 0, fouls: 0 }, cards: { yellow: 0, red: 0 } }
    }))
  }
  const match = setVariables.populateMatchDetails(team1, team2, { pitchWidth: 680, pitchHeight: 1050, goalWidth: 90 })
  match.half = 1
  match.iterationCount = 100
  match.events = []
  return match
}

// ======================================================================
// TEST 1: PROHIBIDO TACKLE/SLIDE/INTERCEPT A COMPAÑEROS
// ======================================================================
console.log('=== TEST 1: COMPORTAMIENTO SIN BALÓN CUANDO NUESTRO EQUIPO TIENE POSESIÓN ===')
{
  const match = createMockMatch()
  const carrier = match.kickOffTeam.players[10] // ST
  carrier.hasBall = true
  match.ball.withPlayer = true
  match.ball.withTeam = match.kickOffTeam.teamID
  match.ball.Player = carrier.playerID
  match.ball.position = [340, 700, 0]

  // Compañero a 15px (en el radio que antes recibía tackle 56% y slide 10%)
  const mate = match.kickOffTeam.players[9]
  mate.currentPOS = [340, 685]

  const poss = actions.findPossActions(mate, match.kickOffTeam, match.secondTeam, 0, 15, match)
  const tackleAction = poss.find(a => a.name === 'tackle')?.points || 0
  const slideAction = poss.find(a => a.name === 'slide')?.points || 0
  const interceptAction = poss.find(a => a.name === 'intercept')?.points || 0
  const runAction = poss.find(a => a.name === 'run')?.points || 0

  assert.strictEqual(tackleAction, 0, 'Compañero cercano no debe tener puntos de tackle a su propio equipo')
  assert.strictEqual(slideAction, 0, 'Compañero cercano no debe tener puntos de slide a su propio equipo')
  assert.strictEqual(interceptAction, 0, 'Compañero cercano no debe tener puntos de intercept a su propio equipo')
  assert.ok(runAction > 0, 'Compañero debe tener puntos de movimiento/run para apoyar o buscar espacio')

  console.log('  ✔ Puntos defensivos a compañeros anulados al 100% (tackle=0, slide=0, intercept=0).')
  console.log(`  ✔ Jugador orientado al movimiento táctico: run=${runAction} pts.\n`)
}

// ======================================================================
// TEST 2: SIN CONGELAMIENTO EN BALONES AÉREOS (!withPlayer && ballZ > groundMax)
// ======================================================================
console.log('=== TEST 2: MOVIMIENTO ACTIVO DE JUGADORES EN BALONES AÉREOS ===')
{
  const match = createMockMatch()
  match.ball.withPlayer = false
  match.ball.Player = ''
  match.ball.position = [340, 525, 45] // Balón por el aire a 45px de altura

  const outfielder = match.kickOffTeam.players[5]
  const poss = actions.findPossActions(outfielder, match.kickOffTeam, match.secondTeam, 10, 10, match)
  const clearedAction = poss.find(a => a.name === 'cleared')?.points || 0
  const bootAction = poss.find(a => a.name === 'boot')?.points || 0
  const runOrSprint = (poss.find(a => a.name === 'run')?.points || 0) + (poss.find(a => a.name === 'sprint')?.points || 0)

  assert.strictEqual(clearedAction, 0, 'Jugador sin pelota no debe recibir puntos de cleared en vuelo')
  assert.strictEqual(bootAction, 0, 'Jugador sin pelota no debe recibir puntos de boot en vuelo')
  assert.ok(runOrSprint > 50, 'Jugador de campo debe recibir puntos de run/sprint para buscar la segunda pelota')

  console.log('  ✔ Ningún jugador de campo sin balón sortea acciones exclusivas de pelota (cleared=0, boot=0).')
  console.log(`  ✔ Jugadores corren y sprintean activamente hacia la caída: run+sprint=${runOrSprint} pts.\n`)
}

// ======================================================================
// TEST 3: ESTRUCTURA PRESERVADA DURANTE EL VIAJE DEL PASE
// ======================================================================
console.log('=== TEST 3: PRESERVACIÓN DEL ESQUEMA TÁCTICO MIENTRAS EL PASE VIAJA ===')
{
  const match = createMockMatch()
  const passer = match.kickOffTeam.players[5]
  const receiver = match.kickOffTeam.players[8]
  receiver.currentPOS = [250, 600]

  // Configurar pase en viaje
  match.ball.isPendingPass = true
  match.ball.targetPlayerID = receiver.playerID
  match.ball.targetPOS = [280, 680]
  match.ball.withPlayer = false
  match.ball.Player = ''
  match.ball.withTeam = ''
  match.ball.lastTouch = { teamID: match.kickOffTeam.teamID, playerID: passer.playerID, iterations: 1 }

  setPositions.setIntentPosition(match)

  assert.strictEqual(match.kickOffTeam.gamePhase, 'Progression', 'El equipo pasador debe mantener su fase de ataque/progresión')
  assert.deepStrictEqual(receiver.intentPOS, [280, 680], 'El receptor no debe perder el punto de encuentro del pase')

  console.log(`  - Fase de juego del equipo pasador: ${match.kickOffTeam.gamePhase} (preservada)`)
  console.log(`  - intentPOS del receptor fijado al destino del pase: [${receiver.intentPOS}]`)
  console.log('  ✔ El esquema de ataque no colapsa mientras la pelota viaja.\n')
}

// ======================================================================
// TEST 4: MARCAJE MIXTO ZONAL DE CENTRALES (CB)
// ======================================================================
console.log('=== TEST 4: MARCAJE MIXTO ZONAL DE CENTRALES (CB NO ABANDONA LA CUEVA) ===')
{
  const match = createMockMatch()
  const cb = match.kickOffTeam.players[1]
  cb.tacticalRole = 'CB'
  cb.originPOS = [300, 220]
  cb.currentPOS = [300, 220]

  // Atacante rival a 40 metros de distancia (mitad de cancha Y=550)
  const rivalStriker = match.secondTeam.players[9]
  rivalStriker.currentPOS = [300, 550]
  match.kickOffTeam.defensivePlan = {
    duties: {
      [cb.playerID]: { duty: 'Mark', targetID: rivalStriker.playerID }
    }
  }

  setPositions.setIntentPosition(match)

  // El central NO debe salir corriendo hasta Y=550 porque distOppToGoalY (550) > 290px
  assert.ok(cb.intentPOS[1] < 350, `El central no debe ser arrastrado hasta mitad de cancha (intentPOS Y=${cb.intentPOS[1]})`)

  console.log(`  - Posición del atacante rival: Y = ${rivalStriker.currentPOS[1]}`)
  console.log(`  - intentPOS del central zaguero: Y = ${Math.round(cb.intentPOS[1])} (mantiene la zaga)`)
  console.log('  ✔ Marcaje zonal mixto validado: el central no regala su sector.\n')
}

// ======================================================================
// TEST 5: BANDA SIN COLISIÓN (EXTREMO OCUPA HALF-SPACE ANTE OVERLAP)
// ======================================================================
console.log('=== TEST 5: DESDOBLE EN BANDA (EXTREMO SE CIERRA AL HALF-SPACE) ===')
{
  const match = createMockMatch()
  const fullback = match.kickOffTeam.players[2] // Lateral Izquierdo
  fullback.tacticalRole = 'LB'
  fullback.originPOS = [60, 400]
  fullback.currentPOS = [60, 400]
  const winger = match.kickOffTeam.players[7] // Extremo Izquierdo
  winger.tacticalRole = 'LM'
  winger.originPOS = [50, 600]
  winger.currentPOS = [50, 600]
  const carrier = match.kickOffTeam.players[5]
  carrier.hasBall = true
  match.ball.withPlayer = true
  match.ball.withTeam = match.kickOffTeam.teamID
  match.ball.Player = carrier.playerID
  match.ball.position = [120, 600, 0]

  // Simular AttackPlan con WidePlan activo en banda izquierda
  match.kickOffTeam.attackPlan = {
    boxSlots: {},
    widePlan: {
      active: true,
      ballFlank: 'left',
      overlapRunnerID: fullback.playerID,
      leftHolderID: winger.playerID
    }
  }

  setPositions.setIntentPosition(match)

  assert.strictEqual(winger.intentPOS[0], 115, `El extremo debe cerrarse al half-space interior X=115 (recibió X=${winger.intentPOS[0]})`)
  assert.strictEqual(fullback.intentPOS[0], 38, `El lateral que desdobla debe proyectarse por la cal X=38 (recibió X=${fullback.intentPOS[0]})`)

  console.log(`  - Lateral (overlapRunner): intentPOS X = ${fullback.intentPOS[0]} (carril externo / cal)`)
  console.log(`  - Extremo (Holder): intentPOS X = ${winger.intentPOS[0]} (half-space interior)`)
  console.log('  ✔ Separación perfecta en banda: nunca más colisión a 2px en la raya.\n')
}

// ======================================================================
// TEST 6: PENALIZACIÓN DE LÍNEA DE PASE TAPADA (-260)
// ======================================================================
console.log('=== TEST 6: PENALIZACIÓN DE LÍNEAS DE PASE BLOQUEADAS ===')
{
  const match = createMockMatch()
  const passer = match.kickOffTeam.players[4]
  const targetUnblocked = { position: [340, 400], role: 'CM', isMarked: false, laneBlocked: false, minOppDist: 40 }
  const targetBlocked = { position: [340, 400], role: 'CM', isMarked: false, laneBlocked: true, minOppDist: 40 }
  const styleCfg = { id: 'balanced', throughBoost: 1 }

  const scoreClean = ballMovement.passScoreOption(targetUnblocked, false, [340, 300], 300, styleCfg, 680, passer, match)
  const scoreBlocked = ballMovement.passScoreOption(targetBlocked, false, [340, 300], 300, styleCfg, 680, passer, match)
  const diff = scoreClean - scoreBlocked

  assert.ok(diff >= 250, `La penalización por pase bloqueado debe ser de al menos 250 pts (observada: ${diff})`)
  console.log(`  - Puntaje pase limpio: ${scoreClean} | Puntaje pase bloqueado: ${scoreBlocked}`)
  console.log(`  - Diferencia de penalización: ${diff} pts (aprobado >= 250).`)
  console.log('  ✔ El portador descarta pases hacia piernas rivales.\n')
}

// ======================================================================
// TEST 7: PRESERVACIÓN DE MENTALIDAD INICIAL ANTE DT EN 'NORMAL'
// ======================================================================
console.log('=== TEST 7: PRESERVACIÓN DE LA MENTALIDAD INICIAL DEL EQUIPO ===')
{
  const match = createMockMatch()
  match.kickOffTeam.initialMentality = 'offensive'
  match.kickOffTeam.mentality = 'offensive'
  match.secondTeam.initialMentality = 'defensive'
  match.secondTeam.mentality = 'defensive'
  match.score = [0, 0]
  match.iterationCount = 50

  coachAI.updateTeamCoachDirectives(match)

  assert.strictEqual(match.kickOffTeam.mentality, 'offensive', 'La mentalidad ofensiva inicial debe preservarse ante instrucción Normal')
  assert.strictEqual(match.secondTeam.mentality, 'defensive', 'La mentalidad defensiva inicial debe preservarse ante instrucción Normal')

  console.log(`  - Equipo 1 (DT Normal): mentalidad = ${match.kickOffTeam.mentality} (preservó ofensiva)`)
  console.log(`  - Equipo 2 (DT Normal): mentalidad = ${match.secondTeam.mentality} (preservó defensiva)`)
  console.log('  ✔ coachAI no sobreescribe la táctica elegida en la pizarra inicial.\n')
}

console.log('======================================================================')
console.log('=== ¡TODAS LAS OPTIMIZACIONES DE GEMINI ARGON VERIFICADAS AL 100%! ===')
console.log('======================================================================\n')
