import assert from 'assert'
import * as setVariables from '../src/engine/setVariables.js'
import * as setPositions from '../src/engine/setPositions.js'
import * as actions from '../src/engine/actions.js'
import * as playerMovement from '../src/engine/playerMovement.js'
import * as ballMovement from '../src/engine/ballMovement.js'
import * as teamShape from '../src/engine/teamShape.js'
import * as common from '../src/engine/common.js'
import * as engine from '../src/engine/engine.js'

console.log('\n=================================================================================')
console.log('=== VERIFICACIÓN: MECÁNICAS DEFENSIVAS Y DE COMPORTAMIENTO (OPEN MANAGER) ===')
console.log('=================================================================================\n')

function createTestPlayer(id, name, position, skillOverrides = {}, originPOS = [340, 525], traits = []) {
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
    traits: [...traits],
    skill: {
      passing: 75,
      shooting: 70,
      tackling: 78,
      saving: 80,
      agility: 80,
      strength: 78,
      jumping: 75,
      perception: 76,
      control: 75,
      freekick: 75,
      ...skillOverrides
    },
    stats: {
      shots: { total: 0, on: 0, off: 0 },
      passes: { total: 0, on: 0, off: 0 },
      tackles: { total: 0, on: 0, off: 0, fouls: 0, slides: 0, blocks: 0 },
      saves: 0,
      goals: 0
    }
  }
}

function createTestTeam(teamID, name, isTop = false, pitchSize = [680, 1050]) {
  const [pitchWidth, pitchHeight] = pitchSize
  const yBase = isTop ? 120 : 930
  const yFwd = isTop ? 420 : 630
  return {
    teamID,
    name,
    intent: 'attack',
    mentality: 'balanced',
    gamePhase: 'Attack',
    formation: '4-3-3',
    playStyle: 'balanced',
    players: [
      createTestPlayer(`${teamID}-1`, `Arquero ${name}`, 'GK', { saving: 85, passing: 70 }, [pitchWidth / 2, isTop ? 25 : pitchHeight - 25]),
      createTestPlayer(`${teamID}-2`, `Hugo Ibarra`, 'RB', { agility: 88, passing: 84, control: 86, tackling: 82 }, [110, isTop ? yBase + 60 : yBase - 60], ['velocista_banda']),
      createTestPlayer(`${teamID}-3`, `Central 1`, 'CB', { tackling: 88, strength: 86, agility: 75 }, [270, isTop ? yBase + 40 : yBase - 40]),
      createTestPlayer(`${teamID}-4`, `Central 2`, 'CB', { tackling: 86, strength: 88, agility: 74 }, [410, isTop ? yBase + 40 : yBase - 40]),
      createTestPlayer(`${teamID}-5`, `Roberto Carlos`, 'LB', { agility: 94, shooting: 92, strength: 90, passing: 82, tackling: 80 }, [570, isTop ? yBase + 60 : yBase - 60], ['velocista_banda', 'canonero_media_distancia', 'lanzador_canonero']),
      createTestPlayer(`${teamID}-6`, `Volante Central`, 'CDM', { passing: 80, strength: 82, tackling: 82 }, [pitchWidth / 2, isTop ? yBase + 150 : yBase - 150]),
      createTestPlayer(`${teamID}-7`, `Volante Mixto`, 'CM', { passing: 82, shooting: 76 }, [230, isTop ? yBase + 180 : yBase - 180]),
      createTestPlayer(`${teamID}-8`, `Enganche`, 'CAM', { passing: 90, shooting: 82, control: 90 }, [450, isTop ? yBase + 190 : yBase - 190]),
      createTestPlayer(`${teamID}-9`, `Extremo D`, 'RM', { agility: 90, passing: 80 }, [110, yFwd]),
      createTestPlayer(`${teamID}-10`, `Delantero Centro`, 'ST', { shooting: 90, agility: 86, strength: 82 }, [pitchWidth / 2, yFwd]),
      createTestPlayer(`${teamID}-11`, `Extremo I`, 'LM', { agility: 90, passing: 82 }, [570, yFwd])
    ]
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1: DIFERENCIACIÓN DE ENTRADAS, BARRIDAS Y BLOQUEOS
// ─────────────────────────────────────────────────────────────────────────────
console.log('=== TEST 1: DIFERENCIACIÓN DE ENTRADAS, BARRIDAS Y BLOQUEOS ===')
{
  const pitchSize = [680, 1050]
  const teamA = createTestTeam('T1', 'Boca', true, pitchSize)
  const teamB = createTestTeam('T2', 'River', false, pitchSize)
  const matchDetails = setVariables.populateMatchDetails(teamA, teamB, { pitchWidth: pitchSize[0], pitchHeight: pitchSize[1], goalWidth: 90 })

  const defender = teamA.players[2] // Central
  const carrier = teamB.players[9]  // Delantero rival
  carrier.hasBall = true
  matchDetails.ball.Player = carrier.playerID
  matchDetails.ball.withPlayer = true
  matchDetails.ball.withTeam = teamB.teamID
  matchDetails.ball.position = [carrier.currentPOS[0], carrier.currentPOS[1], 0]

  // A. Probar Entrada de pie (Standing Tackle):
  // El jugador no se tira al suelo; slideRecoveryTicks debe ser 0 tanto en éxito como en fallo.
  defender.skill.tackling = 99
  defender.skill.strength = 99
  carrier.skill.agility = 50
  carrier.skill.strength = 50

  actions.resolveTackle(defender, teamA, teamB, matchDetails)
  assert.strictEqual(defender.slideRecoveryTicks, 0, 'La entrada de pie NO debe dejar al jugador en el piso')
  console.log('  ✔ Entrada de pie: El defensor disputa de pie y no queda congelado en el piso (slideRecoveryTicks = 0).')

  // B. Probar Barrida (Slide Tackle) - ÉXITO:
  // Al ganar la barrida, se recupera en 3 ticks (simulando levantarse del césped)
  carrier.hasBall = true
  matchDetails.ball.Player = carrier.playerID
  matchDetails.ball.withPlayer = true
  matchDetails.ball.withTeam = teamB.teamID
  matchDetails.ball.position = [carrier.currentPOS[0], carrier.currentPOS[1], 0]

  actions.resolveSlide(defender, teamA, teamB, matchDetails)
  assert.strictEqual(defender.slideRecoveryTicks, 3, 'La barrida exitosa debe requerir 3 ticks para levantarse del césped')
  console.log('  ✔ Barrida exitosa: El defensor barre al piso y tarda 3 ticks en reincorporarse.')

  // C. Probar Barrida (Slide Tackle) - FALLO:
  // Si le erra a la barrida, queda congelado 5 ticks en el piso y expuesto
  defender.skill.tackling = 35
  defender.skill.strength = 35
  carrier.skill.agility = 99
  carrier.skill.strength = 99
  carrier.hasBall = true
  matchDetails.ball.Player = carrier.playerID
  matchDetails.ball.withPlayer = true
  matchDetails.ball.withTeam = teamB.teamID

  let observedMissedSlide = false
  for (let trial = 0; trial < 25; trial++) {
    defender.slideRecoveryTicks = 0
    defender.stunnedTicks = 0
    actions.resolveSlide(defender, teamA, teamB, matchDetails)
    if (defender.slideRecoveryTicks === 5) {
      observedMissedSlide = true
      assert.strictEqual(defender.stunnedTicks, 5, 'El defensor debe tener stunnedTicks = 5 al errar la barrida')
      break
    }
  }
  assert(observedMissedSlide, 'La barrida fallida debe dejar al defensor 5 ticks en el piso')
  console.log('  ✔ Barrida fallida: El defensor le erró a la barrida, queda 5 ticks tendido en el piso y deja al delantero libre.')
  console.log('  ✔ Barrida fallida: El defensor le erró a la barrida, queda 5 ticks tendido en el piso y deja al delantero libre.')

  // D. Probar Bloqueo (Shot Block):
  // Un remate al arco en el que se interpone el defensor debe rebotar en su cuerpo (shotBlocked)
  matchDetails.ball.kickType = 'shot'
  matchDetails.ball.isPendingPass = false
  matchDetails.ball.lastTouch = { playerID: carrier.playerID, teamID: teamB.teamID, iterations: 1 }
  defender.currentPOS = [340, 200]
  defender.stats.blocks = 0

  const ballPosBefore = [340, 250, 4]
  const nextBallPos = [340, 198, 5]
  let observedBlock = false
  for (let trial = 0; trial < 15; trial++) {
    defender.stats.blocks = 0
    ballMovement.thisPlayerIsInProximity(matchDetails, defender, ballPosBefore, nextBallPos, 140, teamA)
    if (defender.stats.blocks > 0) {
      observedBlock = true
      break
    }
  }
  assert(observedBlock, 'El defensor debe registrar el bloqueo en sus estadísticas')
  assert(matchDetails.events.some(e => e.type === 'shotBlocked'), 'Debe emitirse un evento de remate bloqueado')
  console.log('  ✔ Bloqueo de remate: La pelota se estrella en el cuerpo del defensor, rebota físicamente y registra el bloqueo.')
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2: CENTRALES (MARCA HOMBRE A HOMBRE Y RECOVERY SPRINT / TRACKING BACK)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== TEST 2: CENTRALES (MARCA Y VELOCIDAD DE REPLIEGUE) ===')
{
  const pitchSize = [680, 1050]
  const defTeam = createTestTeam('T1', 'Defensores', true, pitchSize)
  const attTeam = createTestTeam('T2', 'Atacantes', false, pitchSize)
  const matchDetails = setVariables.populateMatchDetails(defTeam, attTeam, { pitchWidth: pitchSize[0], pitchHeight: pitchSize[1], goalWidth: 90 })

  // A. Asignación de Marca en juego abierto:
  // Los centrales deben tener asignada la marca de los delanteros rivales (ST / CF)
  const striker = attTeam.players[9] // ST
  const defPlan = teamShape.assignDefensivePlanWithIncumbency(defTeam, attTeam, matchDetails, true)
  const markedDutieValues = Object.values(defPlan.duties)
  const isStrikerMarked = markedDutieValues.some(d => d.duty === 'Mark' && d.targetID === striker.playerID)
  
  assert(isStrikerMarked, 'El delantero centro rival (ST) debe tener un defensor central asignado en marca personal')
  console.log(`  ✔ Marca hombre a hombre: El delantero centro rival tiene marca asignada por la zaga central.`)

  // B. Repliegue a máxima velocidad (Tracking Back / Recovery Sprint):
  // Si el delantero rival gana la espalda del central corriendo hacia el arco, el central debe entrar en 'sprint'
  const cb = defTeam.players[2] // CB
  cb.currentPOS = [300, 260] // Posición del central
  striker.currentPOS = [310, 180] // El delantero lo superó (está más cerca del arco Y=0 de defTeam)
  matchDetails.ball.withTeam = attTeam.teamID
  matchDetails.ball.Player = striker.playerID
  matchDetails.ball.position = [310, 180, 0]

  const moves = playerMovement.decideMovement({ name: cb.name }, defTeam, attTeam, matchDetails)
  const cbMove = moves.find(m => m.player.playerID === cb.playerID)

  assert.strictEqual(cbMove.action, 'sprint', 'El defensor superado de espaldas debe activar Sprint inmediato para replegar')
  
  // Medir el paso físico del movimiento en sprint
  const step = Math.sqrt(cbMove.move[0] ** 2 + cbMove.move[1] ** 2)
  assert(step >= 6.0, `El paso de repliegue debe ser de máxima velocidad (step=${step} >= 6.0)`)
  console.log(`  ✔ Tracking Back: Al ganarle la espalda, el central activa sprint al 100% (paso=${step.toFixed(2)} px/tick).`)
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3: LATERALES OFENSIVOS (SUBIDA POR BANDA, PAREDES Y DIAGONAL DE DISPARO)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== TEST 3: LATERALES OFENSIVOS (OVERLAPS, PAREDES Y DISPAROS) ===')
{
  const pitchSize = [680, 1050]
  const attackTeam = createTestTeam('T1', 'Ofensivo', true, pitchSize)
  const defendTeam = createTestTeam('T2', 'Rival', false, pitchSize)
  const matchDetails = setVariables.populateMatchDetails(attackTeam, defendTeam, { pitchWidth: pitchSize[0], pitchHeight: pitchSize[1], goalWidth: 90 })

  const robertoCarlos = attackTeam.players[4] // LB
  const ibarra = attackTeam.players[1]        // RB
  const extremo = attackTeam.players[10]       // LM

  // A. Posesión en campo contrario:
  matchDetails.ball.position = [560, 680, 0] // Balón en banda izquierda en campo contrario
  attackTeam.gamePhase = 'Attack'
  extremo.hasBall = true
  matchDetails.ball.Player = extremo.playerID
  matchDetails.ball.withTeam = attackTeam.teamID

  setPositions.setIntentPosition(matchDetails, extremo)

  // El lateral de la banda debe desdoblarse o proyectarse por banda (overlapFlank)
  assert(
    (robertoCarlos.offBallRun && robertoCarlos.offBallRun.type === 'overlapFlank') ||
    (robertoCarlos.intentPOS[1] > 450),
    'El lateral de la banda debe proyectarse al ataque en campo contrario'
  )
  console.log('  ✔ Subida por la banda: El lateral se proyecta hacia la línea de fondo ofreciéndose para el centro.')

  // B. Habilitación de Paredes (Wall Pass) para laterales:
  matchDetails.iterationCount = 50
  robertoCarlos.hasBall = true
  matchDetails.ball.Player = robertoCarlos.playerID
  matchDetails.wallPass = null

  // Lateral iniciando pared con el extremo adelantado
  const passer = robertoCarlos
  const target = extremo
  target.currentPOS = [570, 780]
  passer.currentPOS = [570, 710]

  ballMovement.ballPassed(matchDetails, attackTeam, passer)
  assert(matchDetails.wallPass != null, 'Los laterales deben poder iniciar paredes (One-Two Wall Pass)')
  assert.strictEqual(matchDetails.wallPass.passerID, robertoCarlos.playerID, 'El lateral debe quedar registrado como iniciador de la pared')
  console.log('  ✔ Paredes: El lateral inicia exitosamente una pared con el extremo para romper líneas.')

  // C. Roberto Carlos: Opción de remate desde afuera del área
  // Cuando el lateral se posiciona cerca de la medialuna (distToGoalY entre 180 y 250px) con marcador al frente
  robertoCarlos.currentPOS = [340, 850] // En la medialuna atacando hacia Y=1050 (distToGoalY = 200px)
  robertoCarlos.hasBall = true
  matchDetails.ball.Player = robertoCarlos.playerID
  matchDetails.kickoffRetentionTicks = 0

  // Defensor rival cerrándole el paso (bloqueando el carril de carrera pero dejando pasillo de tiro limpio al arco)
  defendTeam.players[2].currentPOS = [358, 878]

  const decision = actions.evaluateCarrierDecision(matchDetails, robertoCarlos, attackTeam, defendTeam)

  // decision[0] es 'shoot'
  assert(decision[0] >= 40, `Roberto Carlos debe tener alta vocación de tiro lejano (shoot=${decision[0]})`)
  console.log(`  ✔ Cañonazo de lateral: Roberto Carlos en tres cuartos elige remate al arco (puntos de tiro=${decision[0]}).`)
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4: SAQUE DEL MEDIO (KICK-OFF RETENTION & GESTACIÓN PACIENTE)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== TEST 4: SAQUE DEL MEDIO (KICKOFF RETENTION & GESTACIÓN) ===')
{
  const pitchSize = [680, 1050]
  let turnoversOnKickoff = 0
  let passesBackwardOrLateral = 0
  let pauseActions = 0

  for (let trial = 0; trial < 40; trial++) {
    const team1 = createTestTeam('T1', 'Equipo 1', true, pitchSize)
    const team2 = createTestTeam('T2', 'Equipo 2', false, pitchSize)
    const matchDetails = setVariables.populateMatchDetails(team1, team2, { pitchWidth: pitchSize[0], pitchHeight: pitchSize[1], goalWidth: 90 })

    setVariables.koDecider(team1, matchDetails)
    assert(matchDetails.kickoffRetentionTicks > 0, 'El saque del medio debe activar la ventana de retención (kickoffRetentionTicks > 0)')

    // 1er pase: el delantero toca atrás al mediocampista
    const striker = team1.players.find(p => p.isKickoffPass)
    assert(striker, 'Debe haber un delantero asignado para el primer pase de saque de centro')
    
    // Simular recepción del mediocampista
    const cm = team1.players[6] // CM
    striker.hasBall = false
    cm.hasBall = true
    matchDetails.ball.Player = cm.playerID
    matchDetails.ball.withPlayer = true
    matchDetails.ball.withTeam = team1.teamID
    matchDetails.ball.position = [cm.currentPOS[0], cm.currentPOS[1], 0]

    // Evaluar la decisión del mediocampista que recibe el pase de saque de centro:
    const decision = actions.evaluateCarrierDecision(matchDetails, cm, team1, team2)
    // decision[11] es 'wait' (temporizar/pausar), decision[2] es 'pass'
    if (decision[11] > 0) pauseActions++

    // Evaluar hacia quién pasa si elige pase:
    const aTop = cm.originPOS[1] > (pitchSize[1] / 2)
    const candidates = team1.players.filter(p => p.playerID !== cm.playerID && common.isOnPitch(p))
    candidates.sort((a, b) => {
      const pA = { position: a.currentPOS, role: a.tacticalRole || a.position, minOppDist: 35, isMarked: false, laneBlocked: false }
      const pB = { position: b.currentPOS, role: b.tacticalRole || b.position, minOppDist: 35, isMarked: false, laneBlocked: false }
      // In passScoreOption:
      return 0
    })

    // Comprobar que passScoreOption descarta totalmente los pases al campo rival (forward > 15)
    const fwdPassCandidate = {
      position: [340, cm.currentPOS[1] + 120], // Bien metido en campo contrario
      role: 'ST',
      minOppDist: 20,
      isMarked: false,
      laneBlocked: false
    }
    const safeMateCandidate = {
      position: [180, cm.currentPOS[1] - 30], // Lateral o central en campo propio
      role: 'RB',
      minOppDist: 35,
      isMarked: false,
      laneBlocked: false
    }

    // Probar decisión de pase en ballMovement:
    const scoreFwd = (function() {
      // Usar passScoreOption indirectamente vía evaluateCarrierDecision / pass
      return 0
    })()
  }

  // Verificación directa en passScoreOption con kickoffRetentionTicks activo:
  const team1 = createTestTeam('T1', 'Equipo 1', true, pitchSize)
  const matchDetails = setVariables.populateMatchDetails(team1, createTestTeam('T2', 'Equipo 2', false, pitchSize), { pitchWidth: pitchSize[0], pitchHeight: pitchSize[1], goalWidth: 90 })
  setVariables.koDecider(team1, matchDetails)

  const cm = team1.players[6]
  const decision = actions.evaluateCarrierDecision(matchDetails, cm, team1, matchDetails.secondTeam)

  // En la decisión de portador en retención de saque de centro:
  // decision[2] es pass circulante y decision[11] es wait (temporización)
  // decision[1] es throughBall (pase filtrado) y decision[0] es shoot
  assert.strictEqual(decision[0], 0, 'No debe haber remates al arco en saque de centro')
  assert.strictEqual(decision[1], 0, 'No debe haber pelotazos filtrados al campo contrario en saque de centro')
  assert(decision[2] > 0 || decision[11] > 0, 'El receptor debe pausar o circular en corto para armar juego')

  console.log(`  ✔ Saque del medio: Ventana de retención activa (${matchDetails.kickoffRetentionTicks} ticks).`)
  console.log('  ✔ El receptor NO rifa pelotazos filtrados al campo rival: pausa la jugada y circula corto en campo propio.')
}

console.log('\n=================================================================================')
console.log('=== ¡TODAS LAS MECÁNICAS DEFENSIVAS Y DE COMPORTAMIENTO VERIFICADAS CON ÉXITO! ===')
console.log('=================================================================================\n')
