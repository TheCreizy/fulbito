import assert from 'assert'
import * as setFreekicks from '../src/engine/setFreekicks.js'
import * as setPositions from '../src/engine/setPositions.js'
import * as setVariables from '../src/engine/setVariables.js'
import * as actions from '../src/engine/actions.js'
import * as playerMovement from '../src/engine/playerMovement.js'
import * as ballMovement from '../src/engine/ballMovement.js'
import * as common from '../src/engine/common.js'

console.log('\n======================================================================')
console.log('=== VERIFICACIÓN: NUEVAS REGLAS Y TÁCTICAS DE PELOTA PARADA ===')
console.log('======================================================================\n')

function createTestPlayer(id, name, position, skillOverrides = {}, originPOS = [340, 525]) {
  return {
    id,
    playerID: id,
    name,
    position,
    tacticalRole: position,
    currentPOS: originPOS.slice(),
    originPOS: originPOS.slice(),
    intentPOS: originPOS.slice(),
    hasBall: false,
    offside: false,
    fitness: 100,
    height: 184,
    skill: {
      passing: 70,
      shooting: 70,
      tackling: 70,
      saving: 70,
      agility: 75,
      strength: 75,
      penalty_taking: 78,
      jumping: 75,
      perception: 75,
      control: 75,
      freekick: 70,
      ...skillOverrides
    },
    stats: {
      shots: { total: 0, on: 0, off: 0 },
      passes: { total: 0, on: 0, off: 0 },
      tackles: { total: 0, on: 0, off: 0, fouls: 0 },
      saves: 0,
      goals: 0
    }
  }
}

function createTestTeam(teamID, name, isTop = false, pitchSize = [680, 1050]) {
  const [pitchWidth, pitchHeight] = pitchSize
  const yBase = isTop ? 100 : 950
  const yFwd = isTop ? 400 : 650
  return {
    teamID,
    name,
    intent: 'attack',
    mentality: 'balanced',
    gamePhase: 'Attack',
    formation: '4-3-3',
    playStyle: 'balanced',
    setPieces: {
      freekickTakerID: `${teamID}-10`, // Especialista asignado: Delantero Centro
      cornerTakerID: `${teamID}-9`,
      penaltyTakerID: `${teamID}-10`
    },
    players: [
      createTestPlayer(`${teamID}-1`, `Arquero ${name}`, 'GK', { saving: 85, passing: 65, strength: 75 }, [pitchWidth / 2, isTop ? 15 : pitchHeight - 15]),
      createTestPlayer(`${teamID}-2`, `Lateral D ${name}`, 'RB', { agility: 82, passing: 76, perception: 78 }, [100, isTop ? yBase + 80 : yBase - 80]),
      createTestPlayer(`${teamID}-3`, `Central 1 ${name}`, 'CB', { jumping: 86, height: 188, strength: 84, passing: 78, perception: 76 }, [260, isTop ? yBase + 70 : yBase - 70]),
      createTestPlayer(`${teamID}-4`, `Central 2 ${name}`, 'CB', { jumping: 88, height: 190, strength: 86, passing: 74 }, [420, isTop ? yBase + 70 : yBase - 70]),
      createTestPlayer(`${teamID}-5`, `Lateral I ${name}`, 'LB', { agility: 84, passing: 78, perception: 80 }, [580, isTop ? yBase + 80 : yBase - 80]),
      createTestPlayer(`${teamID}-6`, `Volante Central ${name}`, 'CDM', { passing: 76, strength: 82, shooting: 78 }, [pitchWidth / 2, isTop ? yBase + 160 : yBase - 160]),
      createTestPlayer(`${teamID}-7`, `Volante Mixto ${name}`, 'CM', { passing: 78, shooting: 80 }, [220, isTop ? yBase + 200 : yBase - 200]),
      createTestPlayer(`${teamID}-8`, `Enganche ${name}`, 'CAM', { passing: 88, shooting: 84, perception: 86 }, [460, isTop ? yBase + 210 : yBase - 210]),
      createTestPlayer(`${teamID}-9`, `Extremo D ${name}`, 'RM', { agility: 90, passing: 82, perception: 82 }, [110, yFwd]),
      createTestPlayer(`${teamID}-10`, `Delantero Centro ${name}`, 'ST', { shooting: 92, freekick: 90, jumping: 85, height: 186 }, [pitchWidth / 2, yFwd]),
      createTestPlayer(`${teamID}-11`, `Extremo I ${name}`, 'LM', { agility: 92, passing: 82 }, [570, yFwd])
    ]
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1: ASIGNACIÓN DE PATEADOR DE FALTA SEGÚN ZONA
// ─────────────────────────────────────────────────────────────────────────────
console.log('=== TEST 1: ASIGNACIÓN DE PATEADOR DE FALTA SEGÚN ZONA ===')
{
  const pitchSize = [680, 1050]
  const teamTop = createTestTeam('T1', 'Boca Juniors', true, pitchSize)

  // Caso 1: Falta dentro del área del arquero (Y=80) ➔ Saca el Arquero (GK)
  const takerInBox = setFreekicks.selectFreekickTakerByZone(teamTop, [340, 80], pitchSize[1])
  assert.strictEqual(takerInBox.position, 'GK', 'En el área chica/defensiva propia debe sacar el arquero')
  console.log(`  ✔ Falta en área defensiva (Y=80): Ejecuta el arquero (${takerInBox.name})`)

  // Caso 2: Falta detrás de mitad de cancha (Y=300, mitad es 525) ➔ Saca un Defensor
  const takerOwnHalf = setFreekicks.selectFreekickTakerByZone(teamTop, [340, 300], pitchSize[1])
  assert(['CB', 'LB', 'RB'].includes(takerOwnHalf.position), 'En campo propio debe sacar un defensor, no el especialista de ataque')
  assert.notStrictEqual(takerOwnHalf.playerID, 'T1-10', 'No debe ejecutar el delantero centro especialista')
  console.log(`  ✔ Falta en campo propio (Y=300): Ejecuta un defensor (${takerOwnHalf.name} - ${takerOwnHalf.position})`)

  // Caso 3: Falta de mitad de cancha para adelante (Y=800) ➔ Saca el especialista asignado
  const takerAttacking = setFreekicks.selectFreekickTakerByZone(teamTop, [340, 800], pitchSize[1])
  assert.strictEqual(takerAttacking.playerID, 'T1-10', 'De mitad de cancha para arriba debe sacar el especialista asignado')
  console.log(`  ✔ Falta en campo rival (Y=800): Ejecuta el especialista asignado (${takerAttacking.name})`)
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2: BLOQUEO ESTRICTO DE AUTO-PASE Y DRIBLING EN PELOTA PARADA
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== TEST 2: BLOQUEO ESTRICTO DE AUTO-PASE (ANTI-DRIBLING EN SAQUES) ===')
{
  const pitchSize = [680, 1050]
  const matchDetails = setVariables.populateMatchDetails(
    createTestTeam('T1', 'Boca Juniors', true, pitchSize),
    createTestTeam('T2', 'River Plate', false, pitchSize),
    { pitchWidth: pitchSize[0], pitchHeight: pitchSize[1], goalWidth: 90 }
  )

  const taker = matchDetails.kickOffTeam.players[2]
  taker.hasBall = true
  matchDetails.ball.Player = taker.playerID
  matchDetails.ball.withPlayer = true
  matchDetails.ball.isRestart = true

  // A. Comprobar que en findPossActions los puntos de conducción (run/sprint) sean exactamente 0
  const poss = actions.findPossActions(taker, matchDetails.kickOffTeam, matchDetails.secondTeam, 0, 0, matchDetails)
  const runAction = poss.find(a => a.name === 'run')
  const sprintAction = poss.find(a => a.name === 'sprint')
  assert.strictEqual(runAction.points, 0, 'Puntos para run deben ser 0 en pelota parada')
  assert.strictEqual(sprintAction.points, 0, 'Puntos para sprint deben ser 0 en pelota parada')
  console.log('  ✔ Acciones de traslado bloqueadas en findPossActions: run = 0 pts | sprint = 0 pts')

  // B. Comprobar que checkProvidedAction prohíbe que el jugador elija 'run' o 'sprint'
  const resolvedAction = playerMovement.checkProvidedAction(matchDetails, taker, 'run')
  assert(['pass', 'cross', 'shoot', 'throughBall', 'cleared', 'boot', 'freekickShot', 'penalty'].includes(resolvedAction),
    `La acción devuelta (${resolvedAction}) debe ser de golpeo de balón, nunca conducción`)
  console.log(`  ✔ checkProvidedAction bloquea auto-pase: acción 'run' convertida en '${resolvedAction}'`)
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3: OPCIONES TÁCTICAS EN TIRO LIBRE (CAMPO PROPIO Y RIVAL)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== TEST 3: VARIANTES TÁCTICAS EN TIROS LIBRES ===')
{
  const pitchSize = [680, 1050]
  const matchDetails = setVariables.populateMatchDetails(
    createTestTeam('T1', 'Boca Juniors', true, pitchSize),
    createTestTeam('T2', 'River Plate', false, pitchSize),
    { pitchWidth: pitchSize[0], pitchHeight: pitchSize[1], goalWidth: 90 }
  )

  // 1. Tiro libre en campo propio: probar 50 ejecuciones y registrar variantes
  const ownHalfActions = new Set()
  for (let i = 0; i < 50; i++) {
    matchDetails.ball.position = [340, 250, 0]
    setFreekicks.setTopFreekick(matchDetails)
    const taker = matchDetails.kickOffTeam.players.find(p => p.playerID === matchDetails.ball.Player)
    ownHalfActions.add(taker.action)
  }
  assert(ownHalfActions.has('pass') || ownHalfActions.has('boot') || ownHalfActions.has('throughBall'),
    'Debe registrar variantes en campo propio (pase, pelotazo o cambio de frente)')
  console.log(`  ✔ Variantes observadas en campo propio: ${[...ownHalfActions].join(', ')}`)

  // 2. Tiro libre en campo rival cerca del área (Y=880): verificar barrera y opciones
  const attackingActions = new Set()
  let dummyRunDetected = false
  for (let i = 0; i < 60; i++) {
    matchDetails.ball.position = [340, 880, 0]
    matchDetails.ball.isIndirect = false
    setFreekicks.setTopFreekick(matchDetails)
    const taker = matchDetails.kickOffTeam.players.find(p => p.playerID === matchDetails.ball.Player)
    attackingActions.add(taker.action)
    if (matchDetails.ball.decoyRunner) dummyRunDetected = true
  }
  assert(attackingActions.has('freekickShot') || attackingActions.has('cross') || attackingActions.has('pass'),
    'Debe registrar variantes en campo contrario')
  assert(matchDetails.ball.defendingWall != null && matchDetails.ball.defendingWall.length >= 4,
    'La barrera defensiva debe estar formada con al menos 4 jugadores en tiro libre frontal')
  console.log(`  ✔ Variantes observadas en campo rival: ${[...attackingActions].join(', ')}`)
  console.log(`  ✔ Barrera defensiva formada correctamente con ${matchDetails.ball.defendingWall.length} defensores.`)
  console.log(`  ✔ Detección de jugada preparada de pantalla/distracción (decoy): ${dummyRunDetected ? 'SÍ (activada)' : 'NO'}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4: JUGADAS PREPARADAS DE CÓRNER
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== TEST 4: JUGADAS PREPARADAS DE CÓRNER ===')
{
  const pitchSize = [680, 1050]
  const matchDetails = setVariables.populateMatchDetails(
    createTestTeam('T1', 'Boca Juniors', true, pitchSize),
    createTestTeam('T2', 'River Plate', false, pitchSize),
    { pitchWidth: pitchSize[0], pitchHeight: pitchSize[1], goalWidth: 90 }
  )

  const routines = new Set()
  for (let i = 0; i < 60; i++) {
    setPositions.setTopLeftCornerPositions(matchDetails)
    if (matchDetails.ball.cornerRoutine) routines.add(matchDetails.ball.cornerRoutine)
  }
  console.log(`  ✔ Rutinas de córner observadas en 60 saques: ${[...routines].join(', ')}`)
  assert(routines.has('cross_near_post') || routines.has('cross_far_post') || routines.has('cross_penalty_spot'),
    'Debe haber centros al primer palo, segundo palo o punto penal')
  assert(routines.has('short_corner') || routines.has('edge_strike'),
    'Debe haber córner corto o pase al balcón del área')
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 5: REGLA 11 IFAB (EXENCIÓN DE OFFSIDE EN CÓRNER, LATERAL Y SAQUE DE ARCO)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== TEST 5: REGLA 11 IFAB (EXENCIÓN DE OFFSIDE EN REANUDACIONES) ===')
{
  const pitchSize = [680, 1050]
  const teamAtt = createTestTeam('T1', 'Boca Juniors', true, pitchSize)
  const teamDef = createTestTeam('T2', 'River Plate', false, pitchSize)
  const matchDetails = setVariables.populateMatchDetails(teamAtt, teamDef, { pitchWidth: 680, pitchHeight: 1050, goalWidth: 90 })

  const passer = teamAtt.players[8]
  const receiver = teamAtt.players[9]
  receiver.currentPOS = [340, 990] // Claramente más adelantado que la defensa rival

  // 1. En juego abierto, debe ser offside
  matchDetails.ball.isCornerKick = false
  matchDetails.ball.isThrowIn = false
  matchDetails.ball.isGoalKick = false
  const openSnap = ballMovement.evaluateOffsideAtKick(matchDetails, teamAtt, teamDef, passer, receiver, [100, 700])
  assert(openSnap && openSnap.isOffside, 'En juego abierto el delantero debe estar en fuera de juego')
  console.log('  ✔ En juego abierto se detecta fuera de juego correctamente.')

  // 2. Desde córner, lateral o saque de arco: EXENTO según Regla 11
  matchDetails.ball.isCornerKick = true
  const cornerSnap = ballMovement.evaluateOffsideAtKick(matchDetails, teamAtt, teamDef, passer, receiver, [0, 1050])
  assert.strictEqual(cornerSnap, null, 'En córner no puede haber fuera de juego (Regla 11 IFAB)')

  matchDetails.ball.isCornerKick = false
  matchDetails.ball.isThrowIn = true
  const throwSnap = ballMovement.evaluateOffsideAtKick(matchDetails, teamAtt, teamDef, passer, receiver, [0, 800])
  assert.strictEqual(throwSnap, null, 'En lateral no puede haber fuera de juego (Regla 11 IFAB)')

  matchDetails.ball.isThrowIn = false
  matchDetails.ball.isGoalKick = true
  const goalKickSnap = ballMovement.evaluateOffsideAtKick(matchDetails, teamAtt, teamDef, passer, receiver, [340, 20])
  assert.strictEqual(goalKickSnap, null, 'En saque de meta no puede haber fuera de juego (Regla 11 IFAB)')
  console.log('  ✔ Regla 11 validada al 100%: 0 fuera de juego en Córners, Laterales y Saques de Arco.')
}

console.log('\n======================================================================')
console.log('=== ¡TODAS LAS NUEVAS REGLAS Y TÁCTICAS DE PELOTA PARADA SUPERADAS! ===')
console.log('======================================================================\n')
