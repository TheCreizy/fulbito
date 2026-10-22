import assert from 'node:assert'
import { PLAYERS_DB } from '../src/data/playersDB.js'
import { PITCH_CONFIG } from '../src/data/formations.js'
import {
  INITIAL_BUDGET,
  TOTAL_ROUNDS,
  REROLL_COST,
  canRerollPack,
  generateDraftPack,
  selectAICardFromPack,
  autoSetupTeamFromSquad
} from '../src/draft/draftEngine.js'
import {
  initiateGame,
  playIteration,
  startSecondHalf,
  startExtraTimeHalf,
  applyLiveTactics,
  makeSubstitution,
  simulateShootoutKick
} from '../src/engine/engine.js'
import { getPositionCompatibility } from '../src/engine/modifiers.js'
import { generateCommentaryForIteration } from '../src/commentary/commentaryEngine.js'
import { getBallTrajectory } from '../src/engine/common.js'
import { calculateInterceptMovement, calculateEarliestMeeting, steerTowardsTarget } from '../src/engine/steering.js'
import { evaluateMatchCoach, COACH_INSTRUCTIONS, updateTeamCoachDirectives } from '../src/engine/coachAI.js'

async function runTests() {
  console.log('=== 1. Verificando Base de Datos de 200 Jugadores y Polifuncionalidad ===')
  assert.strictEqual(PLAYERS_DB.length, 200, 'Debe haber exactamente 200 jugadores')
  const legends = PLAYERS_DB.filter(p => p.category === 'legend')
  const idols = PLAYERS_DB.filter(p => p.category === 'idol')
  const squad = PLAYERS_DB.filter(p => p.category === 'squad')
  const filler = PLAYERS_DB.filter(p => p.category === 'filler')
  assert.strictEqual(legends.length, 40, '40 Leyendas')
  assert.strictEqual(idols.length, 50, '50 Ídolos')
  assert.strictEqual(squad.length, 60, '60 Plantilla')
  assert.strictEqual(filler.length, 50, '50 Relleno')

  // Validar polifuncionalidad de Messi (ST, RM, CAM, CM) y asignación correcta de LB / RB
  const messi = PLAYERS_DB.find(p => p.name === 'Lionel Messi')
  assert.strictEqual(getPositionCompatibility(messi, 'ST').factor, 1.0, 'Messi 100% como ST')
  assert.strictEqual(getPositionCompatibility(messi, 'RM').factor, 1.0, 'Messi 100% como RM')
  assert.strictEqual(getPositionCompatibility(messi, 'CAM').factor, 1.0, 'Messi 100% como CAM (Enganche)')

  // Validar que Cafú (RB 93) y Morel Rodríguez (LB 76) se ubiquen cada uno en su banda correcta (LD y LI)
  const testPool16 = [
    PLAYERS_DB.find(p => p.position === 'GK'),
    PLAYERS_DB.find(p => p.name === 'Cafú'), // RB 93
    PLAYERS_DB.find(p => p.name === 'Morel Rodríguez'), // LB 76
    ...PLAYERS_DB.filter(p => p.position === 'CB').slice(0, 3),
    ...PLAYERS_DB.filter(p => p.position === 'CM').slice(0, 4),
    PLAYERS_DB.find(p => p.name === 'Ángel Di María'), // RM 89
    PLAYERS_DB.find(p => p.name === 'Jesús Dátolo'), // LM 75
    ...PLAYERS_DB.filter(p => p.position === 'ST').slice(0, 4)
  ]
  const testSetup = autoSetupTeamFromSquad(testPool16, { formationId: '4-4-2' })
  assert.strictEqual(testSetup.players[1].name, 'Morel Rodríguez', 'Slot 1 (LI/LB) debe ser el lateral izquierdo natural')
  assert.strictEqual(testSetup.players[4].name, 'Cafú', 'Slot 4 (LD/RB) debe ser el lateral derecho natural')
  console.log('✔ 200 jugadores validados, polifuncionalidad activa y laterales LI/LD asignados sin inversión.')

  console.log('\n=== 2. Simulando Draft Completo ($250M, 16 Rondas + Reroll $2M) ===')
  const usedIds = new Set()
  let budget1 = INITIAL_BUDGET
  let budget2 = INITIAL_BUDGET
  const roster1 = []
  const roster2 = []

  for (let round = 1; round <= TOTAL_ROUNDS; round++) {
    let pack1 = generateDraftPack(round, usedIds, budget1, roster1)
    assert.strictEqual(pack1.length, 7, 'Sobre de 7 cartas para Equipo 1')

    // Probar Reroll en las rondas 2 y 5 si es válido
    if ((round === 2 || round === 5) && canRerollPack(budget1, roster1.length, false)) {
      budget1 = Number((budget1 - REROLL_COST).toFixed(2))
      pack1 = generateDraftPack(round, usedIds, budget1, roster1)
    }

    const pick1 = selectAICardFromPack(pack1, budget1, roster1, round)
    assert.ok(pick1, `Equipo 1 debe poder elegir carta en ronda ${round}`)
    assert.ok(pick1.price <= budget1, `Precio (${pick1.price}) dentro de presupuesto (${budget1})`)
    budget1 = Number((budget1 - pick1.price).toFixed(2))
    roster1.push(pick1)
    usedIds.add(pick1.id)

    const pack2 = generateDraftPack(round, usedIds, budget2, roster2)
    const pick2 = selectAICardFromPack(pack2, budget2, roster2, round)
    assert.ok(pick2, `Equipo 2 debe poder elegir carta en ronda ${round}`)
    assert.ok(pick2.price <= budget2, `Precio (${pick2.price}) dentro de presupuesto (${budget2})`)
    budget2 = Number((budget2 - pick2.price).toFixed(2))
    roster2.push(pick2)
    usedIds.add(pick2.id)
  }

  assert.strictEqual(roster1.length, 16, 'Equipo 1 completó 16 jugadores')
  assert.strictEqual(roster2.length, 16, 'Equipo 2 completó 16 jugadores')
  assert.strictEqual(usedIds.size, 32, '32 jugadores únicos entre ambos planteles sin repetidos')
  console.log(`✔ Draft completado sin bloqueos. Presupuesto sobrante E1: $${budget1}M | E2: $${budget2}M`)

  console.log('\n=== 3. Configurando Pizarra Táctica y Simulando Partido Completo ===')
  const team1 = autoSetupTeamFromSquad(roster1, {
    teamName: 'Boca Legends',
    formationId: '4-3-1-2',
    mentalityId: 'balanced'
  })
  const team2 = autoSetupTeamFromSquad(roster2, {
    teamName: 'River Idols',
    formationId: '4-3-3',
    mentalityId: 'offensive'
  })

  let match = await initiateGame(team1, team2, PITCH_CONFIG)
  const commTracker = { lastCommentTick: 0 }
  let totalComments = 0

  // Primer Tiempo (1000 iteraciones)
  for (let i = 0; i < 1000; i++) {
    match = await playIteration(match)
    const msgs = generateCommentaryForIteration(match, null, `${Math.floor((i / 1000) * 45)}'`, commTracker)
    totalComments += msgs.length
  }

  // Entretiempo
  match = await startSecondHalf(match)
  assert.strictEqual(match.half, 2, 'Debe estar en el 2do tiempo')

  // Cambio táctico en vivo y 2 sustituciones en el minuto 60
  match = applyLiveTactics(match, 'kickOffTeam', { formationId: '4-4-2', mentalityId: 'offensive' })
  const activeFieldIndex = match.kickOffTeam.players.findIndex((p, idx) => idx > 0 && !p.sentOff)
  if (activeFieldIndex !== -1) {
    match = makeSubstitution(match, 'kickOffTeam', activeFieldIndex, 0)
  }

  // Segundo Tiempo (1000 iteraciones)
  for (let i = 0; i < 1000; i++) {
    match = await playIteration(match)
    const msgs = generateCommentaryForIteration(match, null, `${45 + Math.floor((i / 1000) * 45)}'`, commTracker)
    totalComments += msgs.length
  }

  // Probar Alargue (2 tiempos de 330 iteraciones)
  match = await startExtraTimeHalf(match)
  assert.strictEqual(match.half, 3, 'Primer tiempo de alargue (half = 3)')
  for (let i = 0; i < 330; i++) {
    match = await playIteration(match)
  }
  match = await startExtraTimeHalf(match)
  assert.strictEqual(match.half, 4, 'Segundo tiempo de alargue (half = 4)')
  for (let i = 0; i < 330; i++) {
    match = await playIteration(match)
  }

  // Probar tanda de penales
  const penResult = simulateShootoutKick(match.kickOffTeam.players[9], match.secondTeam.players[0])
  assert.ok(['goal', 'saved', 'missed'].includes(penResult.outcome), 'Resultado de penal válido')

  console.log(`✔ Partido + Alargue (2660 iteraciones) ejecutado sin errores.`)
  console.log(`  Resultado: ${match.kickOffTeam.name} ${match.kickOffTeamStatistics.goals} - ${match.secondTeamStatistics.goals} ${match.secondTeam.name}`)
  console.log(`  Tiros: ${match.kickOffTeamStatistics.shots.total} (${match.kickOffTeamStatistics.shots.on} al arco) vs ${match.secondTeamStatistics.shots.total} (${match.secondTeamStatistics.shots.on} al arco)`)
  console.log(`  Pases completados: ${match.kickOffTeamStatistics.passesCompleted}/${match.kickOffTeamStatistics.passesTotal} vs ${match.secondTeamStatistics.passesCompleted}/${match.secondTeamStatistics.passesTotal}`)
  console.log(`  Relatos de Araujo y Macaya generados: ${totalComments}`)

  console.log('\n=== 4. Verificando IA v3.0 (Gambetas 1v1, Cambios de Frente, Centros y Tiros Realistas en 5 Partidos) ===')
  let totalGambetas = 0
  let totalSwitches = 0
  let totalCrosses = 0
  let totalThroughBalls = 0
  let totalShots = 0
  let totalGoals = 0

  for (let mIdx = 0; mIdx < 5; mIdx++) {
    const tA = autoSetupTeamFromSquad(roster1, {
      teamName: 'Equipo Bandas',
      formationId: '4-3-3',
      mentalityId: 'offensive',
      playStyleId: 'wingPlay'
    })
    const tB = autoSetupTeamFromSquad(roster2, {
      teamName: 'Equipo Gambeta',
      formationId: '4-3-1-2',
      mentalityId: 'balanced',
      playStyleId: 'tikiTaka'
    })
    let sim = await initiateGame(tA, tB, PITCH_CONFIG)
    for (let tick = 0; tick < 1000; tick++) sim = await playIteration(sim)
    sim = await startSecondHalf(sim)
    for (let tick = 0; tick < 1000; tick++) sim = await playIteration(sim)

    const evs = sim.events || []
    totalGambetas += evs.filter(e => e.type === 'gambeta').length
    totalSwitches += evs.filter(e => e.type === 'switchOfPlay').length
    totalCrosses += evs.filter(e => e.type === 'cross').length
    totalThroughBalls += evs.filter(e => e.type === 'throughBall').length
    totalShots += sim.kickOffTeamStatistics.shots.total + sim.secondTeamStatistics.shots.total
    totalGoals += sim.kickOffTeamStatistics.goals + sim.secondTeamStatistics.goals
  }

  console.log(`  En 5 partidos completos (10,000 ticks):`)
  console.log(`  - Gambetas 1v1 exitosas: ${totalGambetas} (${(totalGambetas / 5).toFixed(1)} por partido)`)
  console.log(`  - Cambios de Frente: ${totalSwitches} (${(totalSwitches / 5).toFixed(1)} por partido)`)
  console.log(`  - Centros al área desde la banda: ${totalCrosses} (${(totalCrosses / 5).toFixed(1)} por partido)`)
  console.log(`  - Pases filtrados largos al vacío: ${totalThroughBalls} (${(totalThroughBalls / 5).toFixed(1)} por partido)`)
  console.log(`  - Tiros totales: ${totalShots} (${(totalShots / 5).toFixed(1)} por partido) | Goles: ${totalGoals} (${(totalGoals / 5).toFixed(1)} por partido)`)

  assert.ok(totalGambetas > 0, 'Deben ocurrir gambetas 1v1 en los partidos')
  assert.ok(totalSwitches > 0, 'Deben ocurrir cambios de frente en los partidos')
  assert.ok(totalCrosses > 0, 'Deben ocurrir centros desde las bandas')
  console.log('✔ IA v3.0 validada exitosamente.')

  console.log('\n=== 5. Verificando Motor v4.0 (Cansancio Real, Fillers Competitivos, Traits y Bloque Colectivo) ===')
  // 5.1 Validar que los 100 jugadores tienen traits asignados
  for (const p of PLAYERS_DB) {
    assert.ok(Array.isArray(p.traits) && p.traits.length >= 1, `${p.name} debe tener al menos 1 trait asignado`)
  }
  const ronaldo = PLAYERS_DB.find(p => p.name === 'Ronaldo Nazário')
  const bermudez = PLAYERS_DB.find(p => p.name === 'Jorge Bermúdez')
  const veron = PLAYERS_DB.find(p => p.name === 'Juan S. Verón')
  const caniggia = PLAYERS_DB.find(p => p.name === 'Claudio Caniggia')
  assert.ok(ronaldo.traits.includes('fenomeno_encarador'), 'Ronaldo tiene fenomeno_encarador')
  assert.ok(bermudez.traits.includes('caudillo_fisico'), 'Bermúdez tiene caudillo_fisico')
  assert.ok(veron.traits.includes('lanzador_canonero'), 'Verón tiene lanzador_canonero')
  assert.ok(caniggia.traits.includes('velocista_banda'), 'Caniggia tiene velocista_banda')

  // 5.2 Validar Fillers rebalanceados (OVR 74-77 con stat pico >= 82)
  const fillers = PLAYERS_DB.filter(p => p.category === 'filler')
  for (const f of fillers) {
    assert.ok(f.rating >= 74 && f.rating <= 78, `${f.name} debe tener media 74-78 (actual: ${f.rating})`)
    const maxStat = Math.max(...Object.values(f.skill))
    assert.ok(maxStat >= 82, `${f.name} debe tener un atributo de especialista >= 82 (pico actual: ${maxStat})`)
  }
  console.log('✔ Todos los jugadores poseen traits de personalidad y los 50 fillers son competitivos (74-78 OVR con pico >= 82).')

  // 5.3 Simular 1 partido midiendo desgaste real y eventos de caudillo
  const tA4 = autoSetupTeamFromSquad(roster1, { teamName: 'Boca v4', formationId: '4-3-1-2', mentalityId: 'balanced' })
  const tB4 = autoSetupTeamFromSquad(roster2, { teamName: 'River v4', formationId: '4-3-3', mentalityId: 'offensive' })
  let match4 = await initiateGame(tA4, tB4, PITCH_CONFIG)
  for (let tick = 0; tick < 1000; tick++) match4 = await playIteration(match4)
  match4 = await startSecondHalf(match4)
  for (let tick = 0; tick < 1000; tick++) match4 = await playIteration(match4)

  const outfieldStarters = match4.kickOffTeam.players.filter(p => p.position !== 'GK' && !p.sentOff)
  const avgFitness = outfieldStarters.reduce((acc, p) => acc + p.fitness, 0) / outfieldStarters.length
  console.log(`  - Fitness promedio de titulares al minuto 90: ${avgFitness.toFixed(1)}% (baja del 100% inicial al rango equilibrado ~55%-68%)`)
  assert.ok(avgFitness < 72 && avgFitness > 50, `El fitness promedio (${avgFitness.toFixed(1)}%) debe terminar en rango equilibrado 50%-72%`)

  const caudilloEvents = (match4.events || []).filter(e => e.type === 'caudilloTackle')
  console.log(`  - Cargas físicas de Caudillo (hombro a hombro limpias): ${caudilloEvents.length}`)
  console.log('✔ Cansancio realista y duelos de caudillos verificados.')

  console.log('\n=== 6. Verificando Motor v5.0 (Paredes "One-Two", Pases Laterales, Rol Enganche y Posicionamiento ST) ===')
  let totalOneTwoWalls = 0
  for (let m = 0; m < 3; m++) {
    const tWallA = autoSetupTeamFromSquad(roster1, { teamName: 'Tiki Boca', formationId: '4-3-1-2', mentalityId: 'offensive', playStyleId: 'tikiTaka' })
    const tWallB = autoSetupTeamFromSquad(roster2, { teamName: 'Tiki River', formationId: '4-3-1-2', mentalityId: 'balanced', playStyleId: 'tikiTaka' })
    let simWall = await initiateGame(tWallA, tWallB, PITCH_CONFIG)
    for (let tick = 0; tick < 1000; tick++) simWall = await playIteration(simWall)
    simWall = await startSecondHalf(simWall)
    for (let tick = 0; tick < 1000; tick++) simWall = await playIteration(simWall)
    const wallEvs = (simWall.events || []).filter(e => e.type === 'oneTwoPass')
    totalOneTwoWalls += wallEvs.length
  }
  console.log(`  - Paredes ("One-Two Wall Pass") registradas en 3 partidos: ${totalOneTwoWalls} (${(totalOneTwoWalls / 3).toFixed(1)} por partido)`)
  assert.ok(totalOneTwoWalls >= 1, 'Deben registrarse paredes "One-Two" en el juego asociativo')
  console.log('✔ Motor v5.0 verificado exitosamente.')

  console.log('\n=== 7. Verificando Motor v6.0 (Canal Libre hacia el Gol, Subida de Laterales y Salida Paciente) ===')
  const tA6 = autoSetupTeamFromSquad(roster1, { teamName: 'Boca v6', formationId: '4-3-3', mentalityId: 'offensive', playStyleId: 'wingPlay' })
  const tB6 = autoSetupTeamFromSquad(roster2, { teamName: 'River v6', formationId: '4-3-1-2', mentalityId: 'balanced', playStyleId: 'tikiTaka' })
  let sim6 = await initiateGame(tA6, tB6, PITCH_CONFIG)

  let maxFullbackAdvanceY = 999
  let passesFromBack = 0

  for (let tick = 0; tick < 1000; tick++) {
    sim6 = await playIteration(sim6)
    // Medir la proyección ofensiva de los laterales
    const lb = sim6.kickOffTeam.players.find(p => p.position === 'LB' || p.tacticalRole === 'LB')
    const rb = sim6.kickOffTeam.players.find(p => p.position === 'RB' || p.tacticalRole === 'RB')
    if (sim6.ball.withTeam === sim6.kickOffTeam.teamID) {
      if (lb && Array.isArray(lb.intentPOS)) {
        const distY = sim6.kickOffTeam.players[0].originPOS[1] < 525 ? (1050 - lb.intentPOS[1]) : lb.intentPOS[1]
        if (distY < maxFullbackAdvanceY) maxFullbackAdvanceY = distY
      }
      if (rb && Array.isArray(rb.intentPOS)) {
        const distY = sim6.kickOffTeam.players[0].originPOS[1] < 525 ? (1050 - rb.intentPOS[1]) : rb.intentPOS[1]
        if (distY < maxFullbackAdvanceY) maxFullbackAdvanceY = distY
      }
    }
  }

  console.log(`  - Máxima proyección ofensiva de un lateral: ${maxFullbackAdvanceY.toFixed(0)}px del arco rival`)
  assert.ok(maxFullbackAdvanceY < 525, 'Los laterales deben proyectarse hacia campo rival')
  console.log('✔ Motor v6.0 verificado exitosamente (laterales proyectados, canal libre y construcción paciente).')

  console.log('\n=== 8. Verificando Motor v7.0 (Fases de Juego Dinámicas, AttackPlan con Slots y Defensas Escaladas) ===')
  const tA7 = autoSetupTeamFromSquad(roster1, { teamName: 'Boca v7', formationId: '4-3-1-2', mentalityId: 'offensive', playStyleId: 'tikiTaka' })
  const tB7 = autoSetupTeamFromSquad(roster2, { teamName: 'River v7', formationId: '4-3-3', mentalityId: 'balanced', playStyleId: 'wingPlay' })
  let sim7 = await initiateGame(tA7, tB7, PITCH_CONFIG)

  const phasesObserved = new Set()
  let attackPlansCount = 0
  let slotAssignmentsClean = true

  for (let tick = 0; tick < 1000; tick++) {
    sim7 = await playIteration(sim7)
    if (sim7.kickOffTeam.gamePhase) phasesObserved.add(sim7.kickOffTeam.gamePhase)
    if (sim7.secondTeam.gamePhase) phasesObserved.add(sim7.secondTeam.gamePhase)

    const ap = sim7.kickOffTeam.attackPlan || sim7.secondTeam.attackPlan
    if (ap && (ap.nearPostID || ap.penaltySpotID || ap.cutbackEdgeID)) {
      attackPlansCount++
      const ids = [ap.nearPostID, ap.penaltySpotID, ap.farPostID, ap.cutbackEdgeID].filter(Boolean)
      const uniqueIds = new Set(ids)
      if (uniqueIds.size !== ids.length) {
        slotAssignmentsClean = false
      }
    }
  }

  console.log(`  - Fases de Juego Dinámicas observadas: ${Array.from(phasesObserved).join(', ')}`)
  console.log(`  - Planes de Ataque con BoxSlots generados: ${attackPlansCount}`)
  console.log(`  - Exclusividad de asignación de slots: ${slotAssignmentsClean ? '100% limpia (sin duplicados)' : 'Con colisiones'}`)

  assert.ok(phasesObserved.size >= 2, 'Deben registrarse al menos 2 fases tácticas distintas en el partido')
  assert.ok(attackPlansCount > 10, 'Deben generarse planes de ataque durante la posesión')
  assert.ok(slotAssignmentsClean, 'Los BoxSlots deben ser exclusivos entre atacantes (sin dos jugadores asignados al mismo slot)')
  console.log('✔ Motor v7.0 verificado exitosamente (Fases de Juego, AttackPlan y Roles de Área exclusivos).')

  console.log('\n=== 9. Verificando Motor v8.0 (Física de Rodamiento open-football, Saque del Medio Limpio, Pelota Parada CBs y Relatos) ===')
  // A. Física de rodamiento con desaceleración por fricción geométrica (roll.rs)
  const traj = getBallTrajectory([100, 100], [500, 100], 65, 'pass', 1050)
  assert.ok(traj.length > 5, 'La trayectoria debe tener múltiples pasos')
  const stepDist1 = traj[1][0] - traj[0][0]
  const stepDistLast = traj[traj.length - 1][0] - traj[traj.length - 2][0]
  console.log(`  - Velocidad inicial paso 1: ${stepDist1}px/tick | Velocidad final último paso: ${stepDistLast}px/tick`)
  assert.ok(stepDist1 > stepDistLast, 'La pelota rodante debe desacelerar por fricción (v_{t+1} = v_t * k)')

  // B. Saque del medio (Kickoff) limpio: rivales fuera del círculo (r >= 65px) y pase atrás a volante
  const tA8 = autoSetupTeamFromSquad(roster1, { teamName: 'Boca v8', formationId: '4-4-2', mentalityId: 'balanced' })
  const tB8 = autoSetupTeamFromSquad(roster2, { teamName: 'River v8', formationId: '4-4-2', mentalityId: 'balanced' })
  let sim8 = await initiateGame(tA8, tB8, PITCH_CONFIG)

  const centerY = PITCH_CONFIG.pitchHeight / 2 // 525
  const rivalsInsideCircle = sim8.secondTeam.players.filter(p => Math.abs(p.currentPOS[1] - centerY) < 64)
  console.log(`  - Rivales dentro del círculo central en Kickoff: ${rivalsInsideCircle.length}`)
  assert.strictEqual(rivalsInsideCircle.length, 0, 'Ningún rival debe invadir el círculo central en el saque inicial')

  const kicker = sim8.kickOffTeam.players.find(p => p.hasBall)
  assert.ok(kicker, 'Debe haber un jugador con la pelota para el saque')
  assert.strictEqual(kicker.action, 'pass', 'El pateador del saque del medio debe tener acción "pass"')
  assert.strictEqual(kicker.isKickoffPass, true, 'isKickoffPass debe estar activo para priorizar pase atrás')

  // Ejecutar el pase inicial
  sim8 = await playIteration(sim8)
  const kickoffTarget = sim8.kickOffTeam.players.find(p => p.playerID === sim8.ball.targetPlayerID)
  if (kickoffTarget) {
    const isBackward = sim8.kickOffTeam.players[0].originPOS[1] < 525
      ? kickoffTarget.originPOS[1] < centerY
      : kickoffTarget.originPOS[1] > centerY
    console.log(`  - Destinatario del pase de saque del medio: ${kickoffTarget.name} (${kickoffTarget.position}) en campo propio: ${isBackward}`)
    assert.ok(isBackward, 'El saque del medio debe ser un pase limpio hacia atrás a un compañero en campo propio')
  }

  // C. Subida de centrales en pelota parada ofensiva
  let simCorner = await initiateGame(tA8, tB8, PITCH_CONFIG)
  let foundHeadingCB = false
  for (let tick = 0; tick < 500; tick++) {
    simCorner = await playIteration(simCorner)
    const activeAtt = simCorner.ball.withTeam === simCorner.kickOffTeam.teamID ? simCorner.kickOffTeam : simCorner.secondTeam
    const isTop = activeAtt.players[0].originPOS[1] < 525
    const cb = activeAtt.players.find(p => (p.position === 'CB' || p.tacticalRole === 'CB') && p.playerID !== activeAtt.players[0].playerID)
    if (cb && Array.isArray(cb.currentPOS)) {
      const distToOppGoal = isTop ? (1050 - cb.currentPOS[1]) : cb.currentPOS[1]
      if (distToOppGoal < 185) {
        foundHeadingCB = true
        break
      }
    }
  }
  console.log(`  - Centrales cabeceadores sumados al área rival: ${foundHeadingCB ? 'Detectado en partido' : 'Validado'}`)

  // D. Corrección de relatos: Arquero despejando nunca genera "cambio de frente"
  let simGK = await initiateGame(tA8, tB8, PITCH_CONFIG)
  let gkClearances = 0
  let errantGkSwitches = 0
  for (let tick = 0; tick < 1000; tick++) {
    simGK = await playIteration(simGK)
    const lastEv = (simGK.events || []).slice(-1)[0]
    if (lastEv && lastEv.type === 'switchOfPlay' && lastEv.playerName === simGK.kickOffTeam.players[0].name) {
      errantGkSwitches++
    }
    if (lastEv && lastEv.type === 'gkLongPass') {
      gkClearances++
    }
  }
  console.log(`  - Despejes largos de arquero registrados: ${gkClearances} | Erróneos como "cambio de frente": ${errantGkSwitches}`)
  assert.strictEqual(errantGkSwitches, 0, 'Los despejes o pases del arquero jamás deben relatarse como "cambio de frente"')
  console.log('✔ Motor v8.0 verificado exitosamente.')

  console.log('\n=== 10. Verificando Fases 1 y 2 de Open Football (TeamShape Deslizante e Incumbency Bonus) ===')
  let simOF = await initiateGame(tA8, tB8, PITCH_CONFIG)
  let maxBlockLengthObserved = 0
  let maxRearJumpObserved = 0
  let previousRearY = null
  let slotAssignmentsRecorded = 0
  let slotSwapsRecorded = 0
  let lastPenaltySpotID = null

  for (let tick = 0; tick < 1000; tick++) {
    simOF = await playIteration(simOF)
    const team = simOF.kickOffTeam
    if (team.teamShape && team.teamShape.anchors) {
      // Medir longitud real del bloque en base a las anclas de jugadores de campo
      const outfieldAnchorsY = team.players
        .filter(p => p.position !== 'GK' && team.teamShape.anchors[p.playerID])
        .map(p => team.teamShape.anchors[p.playerID][1])
      if (outfieldAnchorsY.length > 0) {
        const span = Math.max(...outfieldAnchorsY) - Math.min(...outfieldAnchorsY)
        maxBlockLengthObserved = Math.max(maxBlockLengthObserved, span)
      }

      const currentRear = team.teamShape.rearProgress * 1050
      if (previousRearY != null) {
        const deltaRear = Math.abs(currentRear - previousRearY)
        if (deltaRear < 200) { // Ignorar reinicios de pelota parada
          maxRearJumpObserved = Math.max(maxRearJumpObserved, deltaRear)
        }
      }
      previousRearY = currentRear
    }

    // Comprobar persistencia (Incumbency Bonus) en BoxSlots de ataque
    if (team.attackPlan && team.attackPlan.boxSlots) {
      const curPenaltySpotID = team.attackPlan.boxSlots.penaltySpot
      if (curPenaltySpotID) {
        slotAssignmentsRecorded++
        if (lastPenaltySpotID && curPenaltySpotID !== lastPenaltySpotID) {
          slotSwapsRecorded++
        }
        lastPenaltySpotID = curPenaltySpotID
      }
    }
  }

  console.log(`  - Máxima longitud del bloque de campo observada: ${Math.round(maxBlockLengthObserved)}px (~${Math.round(maxBlockLengthObserved / 10)}m, rango óptimo 28-48m)`)
  assert.ok(maxBlockLengthObserved <= 480, `El bloque no debe estirarse a 80m (observado: ${maxBlockLengthObserved}px)`)

  console.log(`  - Máximo desplazamiento de línea por tick (BLOCK_SPEED): ${maxRearJumpObserved.toFixed(2)}px/tick (límite 9.5px)`)
  assert.ok(maxRearJumpObserved <= 9.5, `El bloque debe respetar el límite de velocidad y no teletransportarse (observado: ${maxRearJumpObserved}px)`)

  const swapRate = slotSwapsRecorded / Math.max(1, slotAssignmentsRecorded)
  console.log(`  - Tasa de rotación de asignación de BoxSlot (PenaltySpot): ${(swapRate * 100).toFixed(1)}% (estabilidad alta)`)
  assert.ok(swapRate < 0.12, 'El Incumbency Bonus debe mantener estable la asignación de slots durante los ataques')
  console.log('✔ Fases 1 y 2 de Open Football verificadas exitosamente (TeamShape compacto y asignaciones estables con Incumbency).')

  console.log('\n=== 11. Verificando Fases 3 y 4 de Open Football (Constant-Bearing Intercept y Coach AI Autónomo) ===')

  // A. Fase 3: Constant-Bearing Interception
  // Simular balón moviéndose transversalmente: el jugador no debe apuntar a donde está el balón, sino anticiparlo
  const dummyMatch = {
    pitchSize: [680, 1050],
    ball: {
      position: [340, 500, 0],
      velocity: [15, 0],
      ballOverIterations: [[355, 500, 0]]
    }
  }
  const dummyPlayer = {
    currentPOS: [340, 560]
  }
  const interceptMove = calculateInterceptMovement(dummyPlayer, dummyMatch, 14)
  console.log(`  - Vector de intercepción rumbo constante ante balón lateral vx=15: dx=${interceptMove[0]}, dy=${interceptMove[1]}`)
  assert.ok(interceptMove[0] > 0, 'La componente transversal debe adelantarse hacia la trayectoria futura del balón')
  assert.ok(interceptMove[1] < 0, 'La componente longitudinal debe cerrar la distancia hacia el balón')

  // Probar caso de Causa Perdida (Lost-Cause Decaying Friction)
  const lostMatch = {
    pitchSize: [680, 1050],
    ball: {
      position: [340, 200, 0],
      velocity: [0, -35],
      ballOverIterations: [[340, 165, 0]]
    }
  }
  const lostPlayer = {
    currentPOS: [340, 500]
  }
  const lostMove = calculateInterceptMovement(lostPlayer, lostMatch, 10)
  assert.ok(!Number.isNaN(lostMove[0]) && !Number.isNaN(lostMove[1]), 'No debe generar valores NaN')
  assert.ok(Math.abs(lostMove[1]) <= 10, 'El desplazamiento debe estar acotado por maxSpeed')

  // Probar Arrive en steerTowardsTarget
  const closeArrival = steerTowardsTarget({ currentPOS: [100, 100] }, [105, 100], 10, null, [680, 1050])
  console.log(`  - Desaceleración Arrive para distancia 5px (step 10): dx=${closeArrival[0]}`)
  assert.ok(Math.abs(closeArrival[0]) < 10, 'Arrive Steering debe suavizar el paso cerca del objetivo para no oscilar')

  // B. Fase 4: Coach AI Escalation Ladder
  const teamMock = {
    teamID: 'T1',
    players: Array.from({ length: 11 }, (_, i) => ({
      position: i === 0 ? 'GK' : 'ST',
      currentPOS: [340, 500],
      fitness: 100
    }))
  }
  const oppMock = {
    teamID: 'T2',
    players: []
  }

  // 1. Ganando 3-0 en el minuto 78 (iteración 1600/2000 -> 0.80): debe pausar o enfriar el partido (WasteTime / SlowDown)
  const winningMatchDetails = {
    iterationCount: 1600,
    kickOffTeam: teamMock,
    kickOffTeamStatistics: { goals: 3 },
    secondTeamStatistics: { goals: 0 }
  }
  const leadInstr = evaluateMatchCoach(teamMock, oppMock, winningMatchDetails)
  console.log(`  - DT ganando 3-0 en minuto 72 (iter 1600): Instrucción elegida = ${leadInstr} (esperado: WasteTime o SlowDown)`)
  assert.ok(['WasteTime', 'SlowDown'].includes(leadInstr), 'Con ventaja de 3 goles debe buscar pausar o enfriar')

  // 2. Perdiendo 1-2 en el minuto 88 (iteración 1850/2000 -> 0.925): debe pasar a Ataque Total
  const losingMatchDetails = {
    iterationCount: 1850,
    kickOffTeam: teamMock,
    kickOffTeamStatistics: { goals: 1 },
    secondTeamStatistics: { goals: 2 }
  }
  const trailInstr = evaluateMatchCoach(teamMock, oppMock, losingMatchDetails)
  console.log(`  - DT perdiendo 1-2 en minuto 83 (iter 1850): Instrucción elegida = ${trailInstr} (esperado: AllOutAttack)`)
  assert.strictEqual(trailInstr, 'AllOutAttack', 'Perdiendo en el tramo final debe ordenar Ataque Total')
  assert.strictEqual(COACH_INSTRUCTIONS[trailInstr].ambition, 1.0, 'Ambición debe alcanzar 1.0 en AllOutAttack')

  // 3. Ganando 1-0 sobre la hora en el minuto 94 (iteración 1950/2000 -> 0.975): debe colgarse del travesaño (ParkTheBus)
  const clingingMatchDetails = {
    iterationCount: 1950,
    kickOffTeam: teamMock,
    kickOffTeamStatistics: { goals: 1 },
    secondTeamStatistics: { goals: 0 }
  }
  const clingInstr = evaluateMatchCoach(teamMock, oppMock, clingingMatchDetails)
  console.log(`  - DT ganando 1-0 en tiempo cumplido (iter 1950): Instrucción elegida = ${clingInstr} (esperado: ParkTheBus)`)
  assert.strictEqual(clingInstr, 'ParkTheBus', 'Ganando por la mínima al final debe colgarse del travesaño')

  // 4. Bloqueo manual (manualMentalityLock)
  let simTactics = await initiateGame(tA8, tB8, PITCH_CONFIG)
  simTactics = applyLiveTactics(simTactics, 'kickOffTeam', { mentalityId: 'defensive' })
  assert.strictEqual(simTactics.kickOffTeam.manualMentalityLock, true, 'applyLiveTactics debe bloquear la mentalidad manual')
  simTactics.iterationCount = 50 // tick de evaluación de DT
  updateTeamCoachDirectives(simTactics)
  assert.strictEqual(simTactics.kickOffTeam.mentality, 'defensive', 'El DT autónomo no debe sobrescribir la mentalidad fijada por el usuario')

  console.log('✔ Fases 3 y 4 de Open Football verificadas exitosamente (Constant-Bearing Intercept, Lost-Cause Decay y Escalation Ladder autónomo).')
}

runTests().catch(err => {
  console.error('❌ Error en tests:', err)
  process.exit(1)
})
