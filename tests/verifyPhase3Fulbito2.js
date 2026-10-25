/**
 * verifyPhase3Fulbito2.js — Suite de Verificación de Fase 3 (Fulbito 2.0)
 *
 * Valida:
 * 1. Evaluador de Calidad de Remate (xG) y Breakaway Override (delantero mano a mano).
 * 2. Máquina de Estados Ofensiva Sin Balón (Overlaps, Underlaps, Rest Defence y 4 Zonas de Remate).
 * 3. Evaluador Multicriterio de Pases (Utility AI, Delta xThreat, Triangulaciones y Rupturas).
 * 4. Integración activa en tiempo real dentro del loop de simulación (playIteration).
 */

import assert from 'assert'
import { initiateGame, playIteration, updateSpatialAndTacticalTelemetry } from '../src/engine/engine.js'
import { evaluateShotAndBreakaway, SHOT_QUALITY } from '../src/engine/evaluators/shotEvaluator.js'
import { evaluateBestPassOption } from '../src/engine/evaluators/passEvaluator.js'
import { assignOffensiveSupportRoles, computeOffsideLineY } from '../src/engine/tactics/offensiveShape.js'
import { getTacticalZone18, DEFAULT_PITCH_BOUNDS } from '../src/engine/space/pitchZones.js'

console.log('======================================================================')
console.log('=== VERIFICACIÓN: FASE 3 DE FULBITO 2.0 (ATAQUE TOTAL, xG Y UTILITY) ===')
console.log('======================================================================\n')

// Equipos mock para tests unitarios
const mockPitch = { width: 680, height: 1050 }

function createPlayer(id, name, pos, x, y, originX, originY, extras = {}) {
  return {
    id,
    playerID: id,
    name,
    position: pos,
    role: pos,
    tacticalRole: pos,
    currentPOS: [x, y],
    originPOS: [originX, originY],
    x,
    y,
    fitness: 100,
    skill: {
      shooting: 82,
      passing: 84,
      control: 82,
      agility: 80,
      strength: 78,
      tackling: 65,
      perception: 78,
      ...extras.skill,
    },
    stats: {
      shooting: 82,
      passes: { total: 0, on: 0, off: 0 },
      cards: { yellow: 0, red: 0 },
    },
    ...extras,
  }
}

// -------------------------------------------------------------------------
// TEST 1: MODELO xG Y CLASIFICACIÓN DE REMATES
// -------------------------------------------------------------------------
console.log('=== TEST 1: MODELO xG (EXPECTED GOALS) Y CALIDAD DE REMATE ===')

const strikerClose = createPlayer(9, 'Gabriel Batistuta', 'DEL', 340, 960, 340, 200)
const oppGK = createPlayer(1, 'Ubaldo Fillol', 'GK', 340, 1020, 340, 1000)
const oppTeamClose = { players: [oppGK] }
const ownTeamClose = { players: [strikerClose] }

const shotClose = evaluateShotAndBreakaway(strikerClose, ownTeamClose, oppTeamClose, mockPitch)
console.log(`  - xG a quemarropa (dist ${shotClose.distPx.toFixed(1)}px): ${shotClose.xG.toFixed(3)} | Calidad: ${shotClose.quality}`)
assert.strictEqual(shotClose.quality, SHOT_QUALITY.CLEAR_CUT, 'El tiro a quemarropa en Zona 17 debe ser CLEAR_CUT_CHANCE')
assert.ok(shotClose.xG >= 0.32, `xG (${shotClose.xG}) debe ser >= 0.32`)
assert.strictEqual(shotClose.recommendation, 'SHOOT_NOW', 'Debe recomendar disparar de inmediato')

// Tiro especulativo desde campo propio
const strikerFar = createPlayer(9, 'Delantero Lejano', 'DEL', 200, 350, 200, 200)
const oppDefendersFar = [
  oppGK,
  createPlayer(2, 'Central 1', 'DEF', 300, 850, 300, 1000),
  createPlayer(6, 'Central 2', 'DEF', 380, 850, 380, 1000),
]
const shotFar = evaluateShotAndBreakaway(strikerFar, ownTeamClose, { players: oppDefendersFar }, mockPitch)
console.log(`  - xG lejano y escorado (dist ${shotFar.distPx.toFixed(1)}px): ${shotFar.xG.toFixed(4)} | Calidad: ${shotFar.quality}`)
assert.strictEqual(shotFar.quality, SHOT_QUALITY.SPECULATIVE, 'Un tiro desde 70 metros con defensores debe ser SPECULATIVE')
assert.ok(shotFar.xG < 0.07, 'xG lejano debe ser < 0.07')

console.log('✔ Test 1: Modelo xG y categorización de calidad validados exitosamente.\n')

// -------------------------------------------------------------------------
// TEST 2: BREAKAWAY OVERRIDE (MANO A MANO Y CAMINO LIBRE AL ARCO)
// -------------------------------------------------------------------------
console.log('=== TEST 2: BREAKAWAY OVERRIDE (CAMINO LIBRE SIN PASO ATRÁS) ===')

// Delantero escapado en u=0.68 con arquero como único rival por delante
const breakawayStriker = createPlayer(9, 'Claudio Caniggia', 'DEL', 340, 720, 340, 200)
breakawayStriker.pressurePPM = 0.10
const breakawayGK = createPlayer(1, 'Taffarel', 'GK', 340, 1025, 340, 1000)
const beatenDefenders = [
  createPlayer(2, 'Defensor Superado', 'DEF', 340, 600, 340, 1000)
]
const breakawayOppTeam = { players: [breakawayGK, ...beatenDefenders] }
const breakawayOwnTeam = { players: [breakawayStriker] }

const breakawayEval = evaluateShotAndBreakaway(breakawayStriker, breakawayOwnTeam, breakawayOppTeam, mockPitch)
console.log(`  - Breakaway detectado: ${breakawayEval.isBreakaway} | Recomendación: ${breakawayEval.recommendation}`)
assert.strictEqual(breakawayEval.isBreakaway, true, 'Debe activar Breakaway Override al tener camino libre hacia el arco')
assert.strictEqual(breakawayEval.recommendation, 'BREAKAWAY_DRIBBLE', 'A distancia > 145px debe encarar en sprint directo hacia el arco')

console.log('✔ Test 2: Breakaway Override y avance frontal garantizados sin paso atrás.\n')

// -------------------------------------------------------------------------
// TEST 3: REST DEFENCE Y DESDOBLAMIENTO DE LATERALES (OVERLAP / UNDERLAP)
// -------------------------------------------------------------------------
console.log('=== TEST 3: REST DEFENCE (3 ATRÁS) Y DESDOBLAMIENTOS DE LATERALES ===')

const leftBack = createPlayer(3, 'Silvio Marzolini', 'DEF', 80, 520, 80, 250, { position: 'DEF', tacticalRole: 'LB' })
const rightBack = createPlayer(4, 'Cafu', 'DEF', 600, 520, 600, 250, { position: 'DEF', tacticalRole: 'RB' })
const centerBack1 = createPlayer(2, 'Roberto Perfumo', 'DEF', 270, 350, 270, 200, { position: 'DEF', tacticalRole: 'CB' })
const centerBack2 = createPlayer(6, 'Daniel Passarella', 'DEF', 410, 350, 410, 200, { position: 'DEF', tacticalRole: 'CB' })
const pivotMid = createPlayer(5, 'Fernando Redondo', 'ME', 340, 460, 340, 380, { position: 'ME', tacticalRole: 'CDM' })
const wingerLeft = createPlayer(11, 'Kily González', 'ME', 75, 750, 75, 650, { position: 'ME', tacticalRole: 'LM' })
const striker9 = createPlayer(9, 'Mario Kempes', 'DEL', 340, 790, 340, 750, { position: 'DEL', tacticalRole: 'ST' })

const attackingTeamMock = {
  players: [leftBack, rightBack, centerBack1, centerBack2, pivotMid, wingerLeft, striker9]
}
const defendingTeamMock = {
  players: [
    createPlayer(101, 'Rival GK', 'GK', 340, 1020, 340, 1020),
    createPlayer(102, 'Rival DFC 1', 'DEF', 290, 820, 290, 820),
    createPlayer(103, 'Rival DFC 2', 'DEF', 390, 820, 390, 820),
  ]
}

// Pelota en banda izquierda en campo rival (u=0.68)
const ballOnFlank = { x: 70, y: 720, position: [70, 720, 0] }

const offRoles = assignOffensiveSupportRoles(attackingTeamMock, defendingTeamMock, ballOnFlank, mockPitch)

const lbRole = offRoles.get(leftBack.id)
const rbRole = offRoles.get(rightBack.id)
const cb1Role = offRoles.get(centerBack1.id)
const cb2Role = offRoles.get(centerBack2.id)

console.log(`  - Rol Lateral Izquierdo (banda con balón): ${lbRole?.state} -> Target: (${lbRole?.targetX.toFixed(0)}, ${lbRole?.targetY.toFixed(0)})`)
console.log(`  - Rol Lateral Derecho (lado débil): ${rbRole?.state} -> Target: (${rbRole?.targetX.toFixed(0)}, ${rbRole?.targetY.toFixed(0)})`)
console.log(`  - Rest Defence Centrales: CB1=${cb1Role?.state}, CB2=${cb2Role?.state}`)

assert.ok(lbRole?.state === 'OVERLAPPING' || lbRole?.state === 'UNDERLAPPING', 'El lateral del lado activo debe proyectarse en OVERLAP o UNDERLAP')
assert.strictEqual(rbRole?.state, 'FULLBACK_SUPPORT', 'El lateral del lado débil debe sostener el equilibrio en FULLBACK_SUPPORT')
assert.strictEqual(cb1Role?.state, 'REST_DEFENCE_CB', 'El primer central debe sostener la Rest Defence')
assert.strictEqual(cb2Role?.state, 'REST_DEFENCE_CB', 'El segundo central debe sostener la Rest Defence')

console.log('✔ Test 3: Rest Defence y proyecciones de banda coordinadas exitosamente.\n')

// -------------------------------------------------------------------------
// TEST 4: ASIGNACIÓN A LAS 4 ZONAS DE REMATE EN SITUACIÓN DE CENTRO
// -------------------------------------------------------------------------
console.log('=== TEST 4: ASIGNACIÓN COORDINADA A LAS 4 ZONAS DE REMATE (BOX ZONES) ===')

const deepCrossingBall = { x: 60, y: 880, position: [60, 880, 0] } // Desborde profundo en carril exterior
const boxRoles = assignOffensiveSupportRoles(attackingTeamMock, defendingTeamMock, deepCrossingBall, mockPitch)

const assignedStates = [...boxRoles.values()].map(r => r.state)
const boxZoneCount = assignedStates.filter(s => s.startsWith('BOX_ZONE_')).length

console.log(`  - Cantidad de atacantes ocupando las 4 Zonas de Remate: ${boxZoneCount}`)
console.log(`  - Estados ofensivos asignados en situación de centro: ${assignedStates.join(', ')}`)

assert.ok(boxZoneCount >= 2, `Se deben asignar al menos 2 atacantes a las 4 Zonas de Remate (asignados: ${boxZoneCount})`)
assert.ok(assignedStates.includes('BOX_ZONE_1'), 'Debe atacarse la Zona 1 (Primer Palo)')

console.log('✔ Test 4: Ocupación coordinada de las 4 Zonas de Remate verificada.\n')

// -------------------------------------------------------------------------
// TEST 5: EVALUADOR MULTICRITERIO DE PASES (UTILITY AI)
// -------------------------------------------------------------------------
console.log('=== TEST 5: EVALUADOR MULTICRITERIO DE PASES (DELTA xTHREAT Y RUPTURAS) ===')

const passer = createPlayer(10, 'Diego Maradona', 'ME', 340, 620, 340, 520, { skill: { passing: 98, perception: 95 } })
const runnerBehind = createPlayer(9, 'Claudio Caniggia', 'DEL', 420, 760, 420, 750, { offensiveState: 'RUNNING_IN_BEHIND' })
const flatTeammate = createPlayer(8, 'Volante Lateral', 'ME', 200, 620, 200, 520)

const teamWithRunner = {
  players: [passer, runnerBehind, flatTeammate]
}

const passChoice = evaluateBestPassOption(passer, teamWithRunner, defendingTeamMock, mockPitch)
console.log(`  - Mejor pase seleccionado: Destinatario=${passChoice?.teammate?.name} | Tipo=${passChoice?.type} | Utilidad=${passChoice?.utility.toFixed(2)}`)

assert.ok(passChoice != null, 'El evaluador debe retornar una opción de pase válida')
assert.strictEqual(passChoice.teammate.id, runnerBehind.id, 'Debe priorizar el pase progresivo filtrado al delantero en ruptura')

console.log('✔ Test 5: Evaluador de utilidad de pases validado exitosamente.\n')

// -------------------------------------------------------------------------
// TEST 6: SIMULACIÓN EN VIVO END-TO-END (INTEGRACIÓN DEL PARTIDO)
// -------------------------------------------------------------------------
console.log('=== TEST 6: SIMULACIÓN DE PARTIDOS REALES EN VIVO (PLAYITERATION) ===')

import { PLAYERS_DB } from '../src/data/playersDB.js'

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

const teamA = buildSampleTeam('E1', 'Boca Juniors', true)
const teamB = buildSampleTeam('E2', 'River Plate', false)

const pitchDetails = { pitchWidth: 680, pitchHeight: 1050 }
const match = await initiateGame(teamA, teamB, pitchDetails)

let overlappingObserved = false
let underlappingObserved = false
let restDefenceObserved = false
let breakawayOrShotRecorded = false
let totalIterations = 1200

for (let i = 0; i < totalIterations; i++) {
  await playIteration(match)

  const allPlayers = [...match.kickOffTeam.players, ...match.secondTeam.players]
  for (const p of allPlayers) {
    if (p.offensiveState === 'OVERLAPPING') overlappingObserved = true
    if (p.offensiveState === 'UNDERLAPPING') underlappingObserved = true
    if (p.offensiveState === 'REST_DEFENCE_CB') restDefenceObserved = true
    if (p.lastShotEval?.isBreakaway || p.lastShotEval?.recommendation === 'SHOOT_NOW') breakawayOrShotRecorded = true
  }
}

console.log(`  - Estado OVERLAPPING observado en laterales en juego real: ${overlappingObserved}`)
console.log(`  - Estado UNDERLAPPING observado en laterales en juego real: ${underlappingObserved}`)
console.log(`  - Estado REST_DEFENCE_CB observado en centrales en juego real: ${restDefenceObserved}`)
console.log(`  - Evaluaciones de tiro / Breakaways registradas en juego real: ${breakawayOrShotRecorded}`)

assert.ok(restDefenceObserved, 'Los centrales deben mantener la Rest Defence durante el partido en vivo')
assert.ok(overlappingObserved || underlappingObserved, 'Los laterales deben proyectarse en desdoblamiento en partido en vivo')

console.log('✔ Test 6: Integración en vivo con playIteration validada al 100%.\n')

console.log('======================================================================')
console.log('=== ¡TODAS LAS ESPECIFICACIONES DE FASE 3 VERIFICADAS AL 100%! ===')
console.log('======================================================================')
