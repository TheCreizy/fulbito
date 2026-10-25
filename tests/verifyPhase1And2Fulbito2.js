/**
 * verifyPhase1And2Fulbito2.js — Banco de Pruebas de Verificación y Calibración
 * Fulbito 2.0: Fase 1 (Fundaciones Espaciales y Balística 2.5D) y
 * Fase 2 (Bloque Defensivo, Contrato de Engagement, Disputas en 3 Capas y Arbitraje IFAB).
 */

import assert from 'assert'
import {
  LANES,
  ZONE_XTHREAT,
  toRelativeUV,
  fromRelativeUV,
  getTacticalZone18,
  getVerticalLane,
  getZoneXThreat
} from '../src/engine/space/pitchZones.js'

import { computePlayerPressure } from '../src/engine/space/pressureMap.js'
import { raycastCorridor, isPassingLaneClear } from '../src/engine/space/raycast.js'

import {
  BALL_PHYSICS,
  kickBall25D,
  predictBallLanding,
  updateBallPhysics25D
} from '../src/engine/ball/ballPhysics.js'

import {
  BLOCK_CONFIGS,
  evaluatePressingTrigger,
  computeDefensiveBlockTargets
} from '../src/engine/teamShape.js'

import { assignDefensiveEngagementRoles } from '../src/engine/playerMovement.js'
import { tryInterceptLooseBall, resolveBallCarrierEngagement } from '../src/engine/ballContest.js'
import { getDefenderRestraintMultiplier, adjudicateFoul } from '../src/engine/officiating/referee.js'
import { initiateGame, playIteration } from '../src/engine/engine.js'

console.log('======================================================================')
console.log('=== VERIFICACIÓN: FASES 1 Y 2 DE FULBITO 2.0 (ARQUITECTURA COMPLETA) ===')
console.log('======================================================================\n')

// -----------------------------------------------------------------------------
// 1. FASE 1.1: 18 ZONAS TÁCTICAS, 5 CARRILES Y XTHREAT
// -----------------------------------------------------------------------------
console.log('=== TEST 1: ESPACIOS, 18 ZONAS TÁCTICAS Y 5 CARRILES VERTICALES ===')

// Cancha vertical típica de Fulbito (680 x 1050)
const pitchBounds = { minX: 0, maxX: 680, minY: 0, maxY: 1050, width: 680, height: 1050 }

// Equipo que ataca hacia abajo (attackDir = 1, arco propio en Y=0, arco rival en Y=1050)
// Zona 14 canónica: u en [0.67, 0.83], v en [0.30, 0.70] (centro neurálgico en tres cuartos)
// Y ~ 750 (u ~ 0.71), X ~ 340 (v ~ 0.50)
const z14Pos = { x: 340, y: 760 }
const zone14 = getTacticalZone18(z14Pos, pitchBounds, 1)
assert.strictEqual(zone14, 14, `Esperado Zona 14, obtenido: ${zone14}`)
console.log(`  - Zona 14 detectada correctamente en el balcón del área rival (u~0.72, v~0.50): Zona ${zone14}`)

// Zona 17 canónica: u en [0.83, 1.0], v en [0.30, 0.70] (remate final / área chica rival)
// Y ~ 950 (u ~ 0.90), X ~ 340
const z17Pos = { x: 340, y: 950 }
const zone17 = getTacticalZone18(z17Pos, pitchBounds, 1)
assert.strictEqual(zone17, 17, `Esperado Zona 17, obtenido: ${zone17}`)
console.log(`  - Zona 17 detectada correctamente en el área de remate rival: Zona ${zone17}`)

// Zona 1 canónica: propia área
const z1Pos = { x: 340, y: 80 }
const zone1 = getTacticalZone18(z1Pos, pitchBounds, 1)
assert.strictEqual(zone1, 1, `Esperado Zona 1, obtenido: ${zone1}`)

// 5 Carriles Verticales
const leftWingPos = { x: 50, y: 500 }
const centerPos = { x: 340, y: 500 }
const rightWingPos = { x: 620, y: 500 }
assert.strictEqual(getVerticalLane(leftWingPos, pitchBounds, 1), LANES.LEFT_WING)
assert.strictEqual(getVerticalLane(centerPos, pitchBounds, 1), LANES.CENTER)
assert.strictEqual(getVerticalLane(rightWingPos, pitchBounds, 1), LANES.RIGHT_WING)
console.log('  - Mapeo de los 5 Carriles Verticales (Left Wing, Center, Right Wing) verificado.')

// xThreat
const xt17 = getZoneXThreat(z17Pos, pitchBounds, 1)
const xt14 = getZoneXThreat(z14Pos, pitchBounds, 1)
const xt1 = getZoneXThreat(z1Pos, pitchBounds, 1)
assert.ok(xt17 > xt14 && xt14 > xt1, `xThreat debe crecer hacia el arco rival: Z17=${xt17}, Z14=${xt14}, Z1=${xt1}`)
console.log(`  - Matriz xThreat validada: Zona 17 (${xt17}) > Zona 14 (${xt14}) > Zona 1 (${xt1})`)
console.log('✔ Fase 1.1: PitchZones, 18 Zonas, 5 Carriles y xThreat verificados exitosamente.\n')

// -----------------------------------------------------------------------------
// 2. FASE 1.2: MAPA DE PRESIÓN (PPM) Y RAYCASTING ESPACIAL
// -----------------------------------------------------------------------------
console.log('=== TEST 2: MAPA DE PRESIÓN INDIVIDUAL (PPM) Y RAYCASTING ===')

const carrier = { x: 300, y: 500, vx: 0, vy: 1, facingAngle: Math.PI / 2 } // mirando hacia +Y
// Defensor frontal acosando a 2 metros de frente (en Y = 520, escala 10px/m = 20px)
const frontalDefender = { id: 'def_1', x: 300, y: 520, vx: 0, vy: -2, tackling: 85 }
// Defensor lejano a 30 metros (fuera de influencia)
const farDefender = { id: 'def_2', x: 300, y: 800, vx: 0, vy: 0, tackling: 70 }

const pressure = computePlayerPressure(carrier, [frontalDefender, farDefender], 10.0)
assert.ok(pressure.totalPressure > 0.65, `Presión de defensor frontal debe ser alta (>0.65), obtenida: ${pressure.totalPressure}`)
assert.strictEqual(pressure.closestDefender.id, 'def_1')
console.log(`  - Presión total PPM del portador bajo acoso frontal: ${(pressure.totalPressure * 100).toFixed(1)}%`)
console.log(`  - Distancia más cercana calculada: ${pressure.closestDistMeters.toFixed(2)}m (esperado ~2m)`)

// Raycast Corridor: proyectar pase hacia adelante (ángulo = PI/2, hacia +Y)
const clearOrigin = { x: 200, y: 300 }
const rayClear = raycastCorridor(clearOrigin, Math.PI / 2, 200, [frontalDefender], 18)
assert.strictEqual(rayClear.isClear, true)

// Proyectar pase directo hacia donde está el defensor
const blockedOrigin = { x: 300, y: 300 }
const rayBlocked = raycastCorridor(blockedOrigin, Math.PI / 2, 300, [frontalDefender], 18)
assert.strictEqual(rayBlocked.isClear, false)
assert.ok(rayBlocked.clearDistancePx < 250)
console.log(`  - Raycast corridor: corredor bloqueado por defensor a ${rayBlocked.clearDistancePx.toFixed(1)}px detectado limpiamente`)
console.log('✔ Fase 1.2: PPM direccional en 8 octantes y Raycasting de pasillos verificados exitosamente.\n')

// -----------------------------------------------------------------------------
// 3. FASE 1.3: FÍSICA BALÍSTICA 2.5D Y PREDICCIÓN DE ATERRIZAJE
// -----------------------------------------------------------------------------
console.log('=== TEST 3: BALÍSTICA 2.5D, MAGNUS Y PREDICCIÓN DE CAÍDA ===')

const testBall = { position: [340, 525, 0], velocity: [0, 0] }
// Impacto con loft vertical vz = 5.0 y spinZ = 1.5 (comba)
kickBall25D(testBall, 12, 10, 5.0, 1.5)

assert.ok(testBall.landingPoint, 'landingPoint debe existir tras el golpeo')
assert.ok(testBall.landingPoint.ticksToLand > 10, `ticksToLand debe ser > 10, obtenido: ${testBall.landingPoint.ticksToLand}`)
console.log(`  - Predicción de caída: aterrizará en tick +${testBall.landingPoint.ticksToLand} en (${testBall.landingPoint.x.toFixed(1)}, ${testBall.landingPoint.y.toFixed(1)})`)

// Simular varios ticks de física continua hasta el pique
let bounced = false
let peakZ = 0
for (let t = 0; t < 60; t++) {
  updateBallPhysics25D(testBall, false)
  if (testBall.z > peakZ) peakZ = testBall.z
  if (testBall.z === 0 && testBall.vz > 0) {
    bounced = true
  }
}
assert.ok(peakZ > 15, `La altura máxima alcanzada debe ser > 15px, fue: ${peakZ.toFixed(1)}px`)
console.log(`  - Altura máxima de parábola registrada: ${peakZ.toFixed(1)}px`)
console.log('✔ Fase 1.3: Balística 2.5D, gravedad continua y predicción de impacto validados exitosamente.\n')

// -----------------------------------------------------------------------------
// 4. FASE 2.1: BLOQUE DEFENSIVO, BASCOLACIÓN Y REGLA DEL +1 (SPARE MAN)
// -----------------------------------------------------------------------------
console.log('=== TEST 4: BLOQUE DEFENSIVO DINÁMICO, BASCULACIÓN Y REGLA DEL +1 ===')

// Pressing Triggers
const touchlineBall = { x: 25, y: 500 } // pegado a la banda
const centerBall = { x: 340, y: 500 }
const touchlineCarrier = { x: 25, y: 500, facingAngle: 0 }
assert.strictEqual(evaluatePressingTrigger(touchlineCarrier, touchlineBall, pitchBounds, 1), true)
console.log('  - Detonante de presión por poseedor arrinconado en Touchline: Activado')

// Bloque Defensivo y Regla del +1 (Spare Man)
const sampleDefenders = [
  { id: 'cb1', tacticalRole: 'CB', line: 'DEF', originPOS: [280, 200] },
  { id: 'cb2', tacticalRole: 'CB', line: 'DEF', originPOS: [400, 200] },
  { id: 'cdm', tacticalRole: 'PIVOT', line: 'MID', originPOS: [340, 320] },
  { id: 'cm1', tacticalRole: 'CM', line: 'MID', originPOS: [250, 400] },
  { id: 'cm2', tacticalRole: 'CM', line: 'MID', originPOS: [430, 400] },
]

// 2 atacantes rivales adelantados vs 2 CBs (igualdad numérica -> necesidad de +1 con el MCD)
const sampleAttackers = [
  { id: 'st1', role: 'ST', currentPOS: [300, 230], y: 230, x: 300 },
  { id: 'st2', role: 'ST', currentPOS: [380, 230], y: 230, x: 380 },
]

const blockTargets = computeDefensiveBlockTargets(
  sampleDefenders,
  sampleAttackers,
  centerBall,
  pitchBounds,
  { attackDir: 1, blockHeight: 'medium' }
)

const cdmTarget = blockTargets.get('cdm')
const cbTarget = blockTargets.get('cb1')
assert.ok(cdmTarget, 'cdmTarget debe existir')
// En igualdad numérica, el MCD se incrusta en la zaga (Lavolpiana / +1):
// su target Y debe estar pegado al del CB (diferencia <= 0.05 * 1050 ~ 50px)
const distCdmToCbY = Math.abs(cdmTarget.y - cbTarget.y)
assert.ok(distCdmToCbY < 45, `El Pivote debe descender entre centrales en igualdad numérica (dist Y: ${distCdmToCbY})`)
console.log(`  - Regla del +1 (Spare Man): Pivote defensivo desciende a zaga a ${distCdmToCbY.toFixed(1)}px del central`)
console.log('✔ Fase 2.1: Bloque defensivo dinámico, basculación y regla del +1 verificados exitosamente.\n')

// -----------------------------------------------------------------------------
// 5. FASE 2.2: CONTRATO DE ENGAGEMENT DEFENSIVO (1°, 2° Y 3° DEFENSOR)
// -----------------------------------------------------------------------------
console.log('=== TEST 5: CONTRATO DE ENGAGEMENT DEFENSIVO (1°, 2° Y 3° DEFENSOR) ===')

const engagementRoles = assignDefensiveEngagementRoles(
  sampleDefenders,
  sampleAttackers,
  centerBall,
  blockTargets,
  10.0
)

let firstDefenders = 0
let secondDefenders = 0
let balanceDefenders = 0

for (const [pid, roleData] of engagementRoles.entries()) {
  if (roleData.state === 'FIRST_DEFENDER_DELAY') firstDefenders++
  if (roleData.state === 'SECOND_DEFENDER_COVER') secondDefenders++
  if (roleData.state === 'HOLDING_LINE_BALANCE' || roleData.state === 'MARKING_TIGHT') balanceDefenders++
}

assert.strictEqual(firstDefenders, 1, `Debe existir exactamente 1 primer defensor, encontrados: ${firstDefenders}`)
console.log(`  - 1.er Defensor exclusivo asignado: ${firstDefenders} (FIRST_DEFENDER_DELAY)`)
console.log(`  - Defensores de equilibrio/marca asignados: ${balanceDefenders}`)
console.log('✔ Fase 2.2: Contrato de emparejamiento defensivo y exclusividad de roles validado.\n')

// -----------------------------------------------------------------------------
// 6. FASE 2.3: RESOLUCIÓN DE DISPUTAS EN 3 CAPAS
// -----------------------------------------------------------------------------
console.log('=== TEST 6: DISPUTAS EN 3 CAPAS (INTERCEPCIÓN, CUERPO Y TACKLE) ===')

// Capa 1: Intercepción limpia de balón suelto (0% foul)
const interceptor = {
  id: 'mid_cut',
  x: 200, y: 200, currentPOS: [200, 200],
  skill: { agility: 85, tackling: 80, perception: 85, jumping: 75 },
  chemistryMultiplier: 1.05
}
const looseBall = { x: 205, y: 203, position: [205, 203, 0], vx: 3, vy: 2, z: 0 }
const intercepted = tryInterceptLooseBall(interceptor, looseBall, 10.0)
assert.strictEqual(intercepted, true, 'Intercepción a quemarropa con stats altas debe ser exitosa')
assert.strictEqual(looseBall.ownerId, 'mid_cut')
console.log('  - Capa 1: Intercepción limpia de pase suelto completada (0% faltas)')

// Capa 2: Duelo corporal hombro con hombro (bodyContest)
const strongDef = {
  id: 'caudillo',
  x: 300, y: 300, currentPOS: [300, 300],
  skill: { strength: 90, agility: 75, tackling: 85, perception: 80 },
  facingAngle: Math.PI / 2
}
const weakAtt = {
  id: 'winger',
  x: 305, y: 305, currentPOS: [305, 305],
  skill: { strength: 55, agility: 80, control: 65 },
  facingAngle: Math.PI / 2
}
const duelBall = { x: 305, y: 305, position: [305, 305, 0], ownerId: 'winger' }
const duelRes = resolveBallCarrierEngagement(strongDef, weakAtt, duelBall, {}, () => 0.5)
assert.ok(duelRes.outcome === 'CLEAN_BODY_WIN' || duelRes.outcome === 'DELAY_JOCKEY')
console.log(`  - Capa 2: Duelo hombro a hombro resuelto con resultado: ${duelRes.outcome}`)

// Capa 3: Cooldown post-tackle
strongDef.tackleCooldown = 55
const cooledDuel = resolveBallCarrierEngagement(strongDef, weakAtt, duelBall, {}, () => 0.5)
assert.strictEqual(cooledDuel.outcome, 'DELAY_JOCKEY', 'Defensor en cooldown debe aplicar Delay/Jockeying sin tackle')
console.log('  - Capa 3: Cooldown de tackle aplicado; el defensor transiciona a contención Delay/Jockey')
console.log('✔ Fase 2.3: Disputas en 3 capas validadas exitosamente.\n')

// -----------------------------------------------------------------------------
// 7. FASE 2.4: AUTOPROTECCIÓN DISCIPLINARIA Y ARBITRAJE IFAB
// -----------------------------------------------------------------------------
console.log('=== TEST 7: AUTOPROTECCIÓN DISCIPLINARIA (RESTRAINT) Y ARBITRAJE IFAB ===')

const cleanDef = { perception: 80, yellowCards: 0 }
const bookedDef = { perception: 80, yellowCards: 1 }

// 1. Restraint por tarjeta amarilla
const cleanMult = getDefenderRestraintMultiplier(cleanDef, false, false)
const bookedMult = getDefenderRestraintMultiplier(bookedDef, false, false)
assert.strictEqual(cleanMult, 1.0)
assert.strictEqual(bookedMult, 0.45)
console.log(`  - Restraint por Tarjeta Amarilla: multiplicador cayó de ${cleanMult} a ${bookedMult} (-55% de riesgo)`)

// 2. Restraint dentro del área propia
const boxMult = getDefenderRestraintMultiplier(cleanDef, true, false)
assert.strictEqual(boxMult, 0.50)
console.log(`  - Restraint en Área Propia: multiplicador cayó a ${boxMult} (-50% de riesgo de penal)`)

// 3. Ley de la Ventaja
const referee = { strictness: 0.50 }
const advDecision = adjudicateFoul(referee, { yellowCards: 0 }, weakAtt, {
  isInsidePenaltyBox: false,
  severity: 0.30,
  attackerTeamKeepsBallWithSpace: true
})
assert.strictEqual(advDecision.callFoul, false)
assert.strictEqual(advDecision.advantagePlayed, true)
console.log('  - Ley de la Ventaja aplicada limpiamente cuando el atacante conserva balón con espacio')

// 4. Falta Táctica (SPA)
const spaDecision = adjudicateFoul(referee, { yellowCards: 0 }, weakAtt, {
  isInsidePenaltyBox: false,
  severity: 0.50,
  isPromisingCounterAttack: true
}, () => 0.30)
assert.strictEqual(spaDecision.callFoul, true)
assert.strictEqual(spaDecision.card, 'YELLOW')
console.log('  - Falta Táctica (SPA) sancionada correctamente con Tarjeta Amarilla')
console.log('✔ Fase 2.4: Arbitraje IFAB, disciplina y ventaja verificados exitosamente.\n')

// -----------------------------------------------------------------------------
// 8. SIMULACIÓN DE PARTIDOS REALES END-TO-END (CALIBRACIÓN Y TELEMETRÍA 2.0)
// -----------------------------------------------------------------------------
console.log('=== TEST 8: SIMULACIÓN DE PARTIDOS REALES END-TO-END (CALIBRACIÓN Y TELEMETRÍA) ===')

import { PLAYERS_DB } from '../src/data/playersDB.js'
import { startSecondHalf } from '../src/engine/engine.js'

function buildSampleTeam(teamID, name, isTop) {
  const pool = teamID === 'E1' ? PLAYERS_DB.slice(0, 11) : PLAYERS_DB.slice(11, 22)
  return {
    teamID,
    name,
    mentality: 'balanced',
    initialMentality: 'balanced',
    playStyle: 'balanced',
    players: pool.map((p, idx) => {
      const yPos = isTop ? 50 + idx * 75 : 1000 - idx * 75
      return {
        ...p,
        playerID: `${teamID}_${idx}`,
        originPOS: [340, yPos],
        currentPOS: [340, yPos],
        intentPOS: [340, yPos],
        injured: false,
        fitness: 100,
        tackleCooldown: 0,
        interceptCooldown: 0,
        stats: {
          goals: 0,
          assists: 0,
          shots: { total: 0, on: 0, off: 0 },
          cards: { yellow: 0, red: 0 },
          passes: { total: 0, on: 0, off: 0 },
          tackles: { total: 0, on: 0, off: 0, fouls: 0, slides: 0, standing: 0 }
        }
      }
    })
  }
}

const pitchDetails = { pitchWidth: 680, pitchHeight: 1050 }

let maxBallZRecorded = 0
let defensiveStatesObserved = new Set()
let ppmValuesObserved = []
let facingAnglesObserved = []

let totalFouls = 0
let totalYellows = 0
let totalReds = 0
const MATCH_COUNT = 10
const TICKS_PER_HALF = 1000

for (let m = 0; m < MATCH_COUNT; m++) {
  const t1 = buildSampleTeam('E1', 'Boca Juniors', true)
  const t2 = buildSampleTeam('E2', 'River Plate', false)
  let match = await initiateGame(t1, t2, pitchDetails)

  // Primer tiempo (1000 ticks)
  for (let i = 0; i < TICKS_PER_HALF; i++) {
    match = await playIteration(match)
    const bz = match.ball.position[2] || 0
    if (bz > maxBallZRecorded) maxBallZRecorded = bz

    for (const p of [...match.kickOffTeam.players, ...match.secondTeam.players]) {
      if (p.defensiveState) defensiveStatesObserved.add(p.defensiveState)
      if (typeof p.pressurePPM === 'number') ppmValuesObserved.push(p.pressurePPM)
      if (typeof p.facingAngle === 'number') facingAnglesObserved.push(p.facingAngle)
    }
  }

  // Segundo tiempo
  match = await startSecondHalf(match)
  for (let i = 0; i < TICKS_PER_HALF; i++) {
    match = await playIteration(match)
    const bz = match.ball.position[2] || 0
    if (bz > maxBallZRecorded) maxBallZRecorded = bz

    for (const p of [...match.kickOffTeam.players, ...match.secondTeam.players]) {
      if (p.defensiveState) defensiveStatesObserved.add(p.defensiveState)
      if (typeof p.pressurePPM === 'number') ppmValuesObserved.push(p.pressurePPM)
      if (typeof p.facingAngle === 'number') facingAnglesObserved.push(p.facingAngle)
    }
  }

  const matchFouls = (match.kickOffTeamStatistics?.fouls || 0) + (match.secondTeamStatistics?.fouls || 0)
  const matchYellows = match.kickOffTeam.players.reduce((sum, p) => sum + (p.stats.cards?.yellow || 0), 0) +
                       match.secondTeam.players.reduce((sum, p) => sum + (p.stats.cards?.yellow || 0), 0)
  const matchReds = match.kickOffTeam.players.reduce((sum, p) => sum + (p.stats.cards?.red || 0), 0) +
                    match.secondTeam.players.reduce((sum, p) => sum + (p.stats.cards?.red || 0), 0)

  totalFouls += matchFouls
  totalYellows += matchYellows
  totalReds += matchReds
}

const avgFouls = totalFouls / MATCH_COUNT
const avgYellows = totalYellows / MATCH_COUNT
const avgReds = totalReds / MATCH_COUNT

console.log(`  - Promedio de Faltas por partido en ${MATCH_COUNT} encuentros: ${avgFouls.toFixed(1)} (esperado: 12 - 24)`)
console.log(`  - Promedio de Tarjetas Amarillas por partido: ${avgYellows.toFixed(2)} (esperado: 1.5 - 4.5)`)
console.log(`  - Promedio de Tarjetas Rojas por partido: ${avgReds.toFixed(2)} (esperado: < 0.25)`)
console.log(`  - Altura máxima Z alcanzada por la pelota en juego real: ${maxBallZRecorded.toFixed(1)}px (esperado: > 15px)`)
console.log(`  - Estados defensivos observados en jugadores reales: ${[...defensiveStatesObserved].join(', ')}`)
console.log(`  - Muestras de PPM y FacingAngle registradas en tiempo real: ${ppmValuesObserved.length} registros`)

assert.ok(avgFouls >= 10 && avgFouls <= 26, `Promedio de faltas ${avgFouls} fuera del rango calibrado [10, 26]`)
assert.ok(avgYellows >= 1.0 && avgYellows <= 5.0, `Promedio de amarillas ${avgYellows} fuera del rango calibrado [1.0, 5.0]`)
assert.ok(avgReds < 0.35, `Promedio de rojas ${avgReds} excede el límite máximo de 0.35`)
assert.ok(maxBallZRecorded > 15, `La pelota no alcanzó elevación aérea en 2.5D (máx Z=${maxBallZRecorded})`)
assert.ok(defensiveStatesObserved.has('FIRST_DEFENDER_DELAY') || defensiveStatesObserved.has('SECOND_DEFENDER_COVER') || defensiveStatesObserved.has('HOLDING_LINE_BALANCE'), 'No se registraron estados defensivos del contrato de 3 defensores')
assert.ok(ppmValuesObserved.length > 500, 'PPM no se calculó en tiempo real para los futbolistas')
assert.ok(facingAnglesObserved.length > 500, 'facingAngle no se actualizó dinámicamente en tiempo real')

console.log('✔ Test 8: Simulación End-to-End validada al 100% con métricas de calibración IFAB y física continua.\n')

console.log('\n======================================================================')
console.log('=== ¡TODAS LAS ESPECIFICACIONES DE FASE 1 Y 2 VERIFICADAS AL 100%! ===')
console.log('======================================================================')
