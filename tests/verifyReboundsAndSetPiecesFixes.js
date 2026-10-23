import assert from 'assert'
import * as setFreekicks from '../src/engine/setFreekicks.js'
import * as setPositions from '../src/engine/setPositions.js'
import * as setVariables from '../src/engine/setVariables.js'
import * as actions from '../src/engine/actions.js'
import * as playerMovement from '../src/engine/playerMovement.js'
import * as ballMovement from '../src/engine/ballMovement.js'
import * as common from '../src/engine/common.js'
import * as engine from '../src/engine/engine.js'

console.log('\n======================================================================')
console.log('=== VERIFICACIÓN: MEJORAS EN FÍSICA, REBOTES Y REGLAS DE REANUDACIÓN ===')
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
      passing: 75,
      shooting: 75,
      tackling: 70,
      saving: 80,
      agility: 75,
      strength: 75,
      penalty_taking: 78,
      jumping: 75,
      perception: 75,
      control: 75,
      freekick: 75,
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
      freekickTakerID: `${teamID}-10`,
      cornerTakerID: `${teamID}-9`,
      penaltyTakerID: `${teamID}-10`
    },
    players: [
      createTestPlayer(`${teamID}-1`, `Arquero ${name}`, 'GK', { saving: 85, passing: 70, strength: 80 }, [pitchWidth / 2, isTop ? 20 : pitchHeight - 20]),
      createTestPlayer(`${teamID}-2`, `Lateral D ${name}`, 'RB', { agility: 82, passing: 76 }, [100, isTop ? yBase + 80 : yBase - 80]),
      createTestPlayer(`${teamID}-3`, `Central 1 ${name}`, 'CB', { jumping: 86, height: 188, passing: 78 }, [260, isTop ? yBase + 70 : yBase - 70]),
      createTestPlayer(`${teamID}-4`, `Central 2 ${name}`, 'CB', { jumping: 88, height: 190, passing: 74 }, [420, isTop ? yBase + 70 : yBase - 70]),
      createTestPlayer(`${teamID}-5`, `Lateral I ${name}`, 'LB', { agility: 84, passing: 78 }, [580, isTop ? yBase + 80 : yBase - 80]),
      createTestPlayer(`${teamID}-6`, `Volante Central ${name}`, 'CDM', { passing: 78, strength: 82 }, [pitchWidth / 2, isTop ? yBase + 160 : yBase - 160]),
      createTestPlayer(`${teamID}-7`, `Volante Mixto ${name}`, 'CM', { passing: 80, shooting: 80 }, [220, isTop ? yBase + 200 : yBase - 200]),
      createTestPlayer(`${teamID}-8`, `Enganche ${name}`, 'CAM', { passing: 88, shooting: 84 }, [460, isTop ? yBase + 210 : yBase - 210]),
      createTestPlayer(`${teamID}-9`, `Extremo D ${name}`, 'RM', { agility: 90, passing: 82 }, [110, yFwd]),
      createTestPlayer(`${teamID}-10`, `Delantero Centro ${name}`, 'ST', { shooting: 92, freekick: 90, jumping: 85 }, [pitchWidth / 2, yFwd]),
      createTestPlayer(`${teamID}-11`, `Extremo I ${name}`, 'LM', { agility: 92, passing: 82 }, [570, yFwd])
    ]
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1: SAQUES LATERALES SIN AUTO-CONDUCCIÓN (BUG DE LA LÍNEA LATERAL)
// ─────────────────────────────────────────────────────────────────────────────
console.log('=== TEST 1: SAQUES LATERALES SIN AUTO-CONDUCCIÓN (ANTI-DRIBLING) ===')
{
  const pitchSize = [680, 1050]
  const matchDetails = setVariables.populateMatchDetails(
    createTestTeam('T1', 'Boca Juniors', true, pitchSize),
    createTestTeam('T2', 'River Plate', false, pitchSize),
    { pitchWidth: pitchSize[0], pitchHeight: pitchSize[1], goalWidth: 90 }
  )

  let sprintsInThrowIn = 0
  let runsInThrowIn = 0
  let passesInThrowIn = 0

  for (let i = 0; i < 60; i++) {
    setPositions.setLeftKickOffTeamThrowIn(matchDetails, [-5, 450])
    const taker = matchDetails.kickOffTeam.players.find(p => p.playerID === matchDetails.throwInTakerID)
    assert(taker, 'Debe haber un lanzador de lateral asignado')
    assert(taker.hasBall, 'El ejecutor del lateral debe tener el balón')

    // Evaluar la decisión del movimiento en decideMovement
    const moves = playerMovement.decideMovement({ name: taker.name }, matchDetails.kickOffTeam, matchDetails.secondTeam, matchDetails)
    const takerMove = moves.find(m => m.player.playerID === taker.playerID)
    
    if (takerMove.action === 'sprint') sprintsInThrowIn++
    if (takerMove.action === 'run') runsInThrowIn++
    if (takerMove.action === 'pass' || takerMove.action === 'throughBall') passesInThrowIn++
  }

  assert.strictEqual(sprintsInThrowIn, 0, `No debe haber sprints en laterales (se encontraron ${sprintsInThrowIn})`)
  assert.strictEqual(runsInThrowIn, 0, `No debe haber traslados con 'run' en laterales (se encontraron ${runsInThrowIn})`)
  assert.strictEqual(passesInThrowIn, 60, `Todos los laterales deben resolverse con pase/balón jugado`)
  console.log(`  ✔ 60 laterales evaluados: 0 sprints, 0 runs, 60 pases reglamentarios.`)
  console.log(`  ✔ Bug de jugador corriendo por la cal resuelto exitosamente.`)
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2: SAQUE DE ARCO (REGLA 16 IFAB: PROHIBIDO SALIR DRIBLEANDO)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== TEST 2: SAQUE DE ARCO (ANTI-DRIBLING ARQUERO / SALIDA O DESPEJE) ===')
{
  const pitchSize = [680, 1050]
  const matchDetails = setVariables.populateMatchDetails(
    createTestTeam('T1', 'Boca Juniors', true, pitchSize),
    createTestTeam('T2', 'River Plate', false, pitchSize),
    { pitchWidth: pitchSize[0], pitchHeight: pitchSize[1], goalWidth: 90 }
  )

  let gkSprints = 0
  let gkRuns = 0
  let gkShortPasses = 0
  let gkLongBoots = 0

  for (let i = 0; i < 60; i++) {
    setPositions.setTopGoalKick(matchDetails)
    const gk = matchDetails.kickOffTeam.players[0]
    assert(gk.hasBall, 'El arquero debe tener el balón en saque de arco')

    const moves = playerMovement.decideMovement({ name: gk.name }, matchDetails.kickOffTeam, matchDetails.secondTeam, matchDetails)
    const gkMove = moves.find(m => m.player.playerID === gk.playerID)

    if (gkMove.action === 'sprint') gkSprints++
    if (gkMove.action === 'run') gkRuns++
    if (gkMove.action === 'pass') gkShortPasses++
    if (gkMove.action === 'boot' || gkMove.action === 'throughBall') gkLongBoots++
  }

  assert.strictEqual(gkSprints, 0, `El arquero jamás debe salir en sprint en saque de arco`)
  assert.strictEqual(gkRuns, 0, `El arquero jamás debe driblear con 'run' en saque de arco`)
  assert(gkShortPasses > 0, 'Debe haber variantes de salida corta por bajo')
  assert(gkLongBoots > 0, 'Debe haber variantes de saque largo al mediocampo')
  console.log(`  ✔ 60 saques de arco evaluados: 0 sprints, 0 runs.`)
  console.log(`  ✔ Opciones reglamentarias observadas: Salidas cortas: ${gkShortPasses} | Saques largos: ${gkLongBoots}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3: FÍSICA Y TRAYECTORIA DE DESVÍO AL CÓRNER EN ATAJADAS
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== TEST 3: FÍSICA Y TRAYECTORIA DE DESVÍO AL CÓRNER EN ATAJADAS ===')
{
  const pitchSize = [680, 1050]
  const matchDetails = setVariables.populateMatchDetails(
    createTestTeam('T1', 'Boca Juniors', true, pitchSize),
    createTestTeam('T2', 'River Plate', false, pitchSize),
    { pitchWidth: pitchSize[0], pitchHeight: pitchSize[1], goalWidth: 90 }
  )

  const gk = matchDetails.kickOffTeam.players[0]
  gk.currentPOS = [340, 20]
  matchDetails.ball.position = [330, 20, 0]

  let cornerSaveDetected = false
  for (let i = 0; i < 40; i++) {
    matchDetails.events = []
    matchDetails.ball.position = [330, 20, 0]
    ballMovement.executeGoalkeeperSave(matchDetails, gk, matchDetails.kickOffTeam, matchDetails.ball.position)
    const saveEv = matchDetails.events.find(e => e.type === 'save' && e.outcome === 'corner')
    if (saveEv) {
      cornerSaveDetected = true
      assert(Array.isArray(matchDetails.ball.ballOverIterations) && matchDetails.ball.ballOverIterations.length >= 3,
        'El desvío al córner debe generar una trayectoria visual en ballOverIterations')
      assert.strictEqual(matchDetails.ball.lastTouch.teamID, matchDetails.kickOffTeam.teamID,
        'El último toque del desvío al córner debe pertenecer al equipo del arquero')
      assert.strictEqual(matchDetails.ball.lastTouch.deflection, true,
        'El toque debe marcarse como desvío')
      break
    }
  }

  assert(cornerSaveDetected, 'Debe registrarse al menos una atajada con desvío al córner')
  console.log(`  ✔ Atajada al córner genera trayectoria física con desplazamiento real y último toque del arquero.`)
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4: FÍSICA Y VARIEDAD DE REBOTES TRAS ATAJADA
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== TEST 4: FÍSICA Y VARIEDAD DE REBOTES TRAS ATAJADA ===')
{
  const pitchSize = [680, 1050]
  const matchDetails = setVariables.populateMatchDetails(
    createTestTeam('T1', 'Boca Juniors', true, pitchSize),
    createTestTeam('T2', 'River Plate', false, pitchSize),
    { pitchWidth: pitchSize[0], pitchHeight: pitchSize[1], goalWidth: 90 }
  )

  const gk = matchDetails.kickOffTeam.players[0]
  gk.currentPOS = [340, 20]

  let reboundsCount = 0
  let maxBounceZ = 0
  const observedDescriptions = new Set()

  for (let i = 0; i < 80; i++) {
    matchDetails.events = []
    matchDetails.ball.position = [340, 22, 0]
    ballMovement.executeGoalkeeperSave(matchDetails, gk, matchDetails.kickOffTeam, matchDetails.ball.position)
    const reboundEv = matchDetails.events.find(e => e.type === 'save' && e.outcome === 'rebound')
    if (reboundEv) {
      reboundsCount++
      observedDescriptions.add(reboundEv.reboundType)
      assert(Array.isArray(matchDetails.ball.ballOverIterations) && matchDetails.ball.ballOverIterations.length >= 3,
        'El rebote debe tener trayectoria en ballOverIterations')
      assert.strictEqual(matchDetails.ball.withPlayer, false, 'El balón del rebote debe quedar suelto')
      assert.strictEqual(gk.hasBall, false, 'El arquero no retiene el balón en rebote')
      
      for (const pt of matchDetails.ball.ballOverIterations) {
        if ((pt[2] || 0) > maxBounceZ) maxBounceZ = pt[2]
      }
    }
  }

  assert(reboundsCount > 0, 'Debe haber rebotes generados')
  assert(maxBounceZ >= 15, `El rebote debe tener altura parabólica en el eje Z (máx alcanzado: ${maxBounceZ}px)`)
  assert(observedDescriptions.size >= 2, 'Deben registrarse múltiples tipos de rebotes (corto, largo, alto, etc.)')
  console.log(`  ✔ Rebotes verificados: ${reboundsCount} rebotes, altura máxima Z=${maxBounceZ}px.`)
  console.log(`  ✔ Variantes observadas: ${[...observedDescriptions].join(' | ')}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 5: DESVÍO DEFENSIVO EN CENTRO / PELOTA PARADA TERMINA EN CÓRNER
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== TEST 5: DESVÍO DEFENSIVO EN CENTRO TERMINA EN CÓRNER (NO EN SAQUE DE ARCO) ===')
{
  const pitchSize = [680, 1050]
  const matchDetails = setVariables.populateMatchDetails(
    createTestTeam('T1', 'Boca Juniors', true, pitchSize),
    createTestTeam('T2', 'River Plate', false, pitchSize),
    { pitchWidth: pitchSize[0], pitchHeight: pitchSize[1], goalWidth: 90 }
  )

  // Boca (T1) defiende el arco superior (Y=0). River (T2) ataca hacia Y=0.
  // Simulamos un centro de River al área de Boca.
  matchDetails.ball.lastTouch.playerID = 'T2-10' // Delantero de River pateó el centro
  matchDetails.ball.lastTouch.teamID = 'T2'
  matchDetails.ball.direction = 'north'

  const defender = matchDetails.kickOffTeam.players[2] // Central 1 de Boca
  defender.currentPOS = [280, 25]
  defender.skill.control = 0 // Simular rebote/desvío donde no logra amortiguar el balón

  // El defensor intercepta y desvía la pelota hacia el fondo
  matchDetails.ball.position = [280, 25, 10]
  ballMovement.resolveDeflection(300, [280, 25, 10], [280, 25], defender, matchDetails.kickOffTeam, 18, matchDetails)

  assert.strictEqual(matchDetails.ball.lastTouch.playerID, defender.playerID,
    'El último toque tras desvío debe registrarse al defensor')
  assert.strictEqual(matchDetails.ball.lastTouch.teamID, matchDetails.kickOffTeam.teamID,
    'El equipo del último toque debe ser el equipo defensor')
  assert.strictEqual(matchDetails.ball.lastTouch.deflection, true,
    'Debe constar como balón desviado')

  // Cuando la pelota cruza la línea final propia impulsada por el defensor:
  const result = setPositions.keepInBoundaries(matchDetails, matchDetails.ball.lastTouch.teamID, [250, -10])
  const cornerEv = (result.events || []).find(e => e.type === 'corner')
  assert(cornerEv, '¡Al salir por línea de fondo tocada por el defensor DEBE SER CÓRNER y NO SAQUE DE ARCO!')
  console.log(`  ✔ Desvío defensivo sobre línea de fondo adjudicado correctamente como CÓRNER para el atacante.`)
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 6: REMATE / CABEZAZO DESVIADO EMITE EVENTO Y COMENTARIO CLARO
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== TEST 6: REMATE / CABEZAZO DESVIADO CON PROYECCIÓN VISIBLE ===')
{
  const pitchSize = [680, 1050]
  const matchDetails = setVariables.populateMatchDetails(
    createTestTeam('T1', 'Boca Juniors', true, pitchSize),
    createTestTeam('T2', 'River Plate', false, pitchSize),
    { pitchWidth: pitchSize[0], pitchHeight: pitchSize[1], goalWidth: 90 }
  )

  const striker = matchDetails.secondTeam.players[9] // Delantero de River atacando hacia Y=0
  striker.currentPOS = [320, 80]
  striker.skill.shooting = 1 // Forzar remate desviado
  matchDetails.ball.position = [320, 80, 10]

  matchDetails.events = []
  ballMovement.shotMade(matchDetails, matchDetails.secondTeam, striker)
  const missEvent = matchDetails.events.find(e => e.type === 'shot' && e.onTarget === false)
  assert(missEvent, 'Debe registrarse el evento de tiro/cabezazo desviado')
  assert.strictEqual(missEvent.outcome, 'miss', 'El outcome debe ser miss')
  console.log(`  ✔ Remate desviado emite evento claro con outcome: 'miss', evitando falsos saques de arco misteriosos.`)
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 7: DELANTERO CON ESPACIO Y CANAL LIBRE AVANZA EN SPRINT / NO PASA ATRÁS
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== TEST 7: DELANTERO CON ESPACIO AVANZA EN SPRINT TRAS REANUDACIONES ===')
{
  const pitchSize = [680, 1050]
  const matchDetails = setVariables.populateMatchDetails(
    createTestTeam('T1', 'Boca Juniors', true, pitchSize),
    createTestTeam('T2', 'River Plate', false, pitchSize),
    { pitchWidth: pitchSize[0], pitchHeight: pitchSize[1], goalWidth: 90 }
  )

  // 1. Simular primero un saque lateral y un saque de arco para comprobar que los flags queden limpios
  setPositions.setLeftKickOffTeamThrowIn(matchDetails, [-5, 450])
  matchDetails.kickOffTeam = playerMovement.executeBallAction(
    { player: matchDetails.kickOffTeam.players[1], action: 'pass' },
    matchDetails.kickOffTeam,
    matchDetails.secondTeam,
    matchDetails
  )

  setPositions.setTopGoalKick(matchDetails)
  matchDetails.kickOffTeam = playerMovement.executeBallAction(
    { player: matchDetails.kickOffTeam.players[0], action: 'pass' },
    matchDetails.kickOffTeam,
    matchDetails.secondTeam,
    matchDetails
  )

  // 2. Ahora en juego abierto, un delantero recibe en posición ofensiva con espacio adelante
  // Delantero de River atacando hacia el arco superior (Y=0)
  const striker = matchDetails.secondTeam.players[9]
  striker.hasBall = true
  striker.currentPOS = [340, 320] // En 3/4 de cancha
  matchDetails.ball.position = [340, 320, 0]
  matchDetails.ball.Player = striker.playerID
  matchDetails.ball.withPlayer = true
  matchDetails.ball.withTeam = matchDetails.secondTeam.teamID

  // Asegurar que los defensores rivales estén detrás de él o a más de 80px adelante
  for (const def of matchDetails.kickOffTeam.players) {
    if (def.position === 'GK') {
      def.currentPOS = [340, 20]
    } else {
      // Defensores quedaron detrás del delantero (Y > 360) o muy abiertos
      def.currentPOS = [580, 400]
    }
  }

  // Comprobar que en decideMovement el delantero elija 'sprint' (avanzar) y NO 'pass'
  const moves = playerMovement.decideMovement({ name: striker.name }, matchDetails.secondTeam, matchDetails.kickOffTeam, matchDetails)
  const strikerMove = moves.find(m => m.player.playerID === striker.playerID)

  assert.strictEqual(strikerMove.action, 'sprint', `El delantero con canal libre debe avanzar en 'sprint', no pasar atrás ni al costado (eligió: ${strikerMove.action})`)
  console.log(`  ✔ Delantero con espacio libre adelante avanza decidido en 'sprint' hacia el arco rival sin pasar atrás.`)
}

console.log('\n======================================================================')
console.log('=== ¡TODAS LAS CORRECCIONES DE FÍSICA Y REGLAS VALIDADAS CON ÉXITO! ===')
console.log('======================================================================\n')
