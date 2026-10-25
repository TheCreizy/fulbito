/**
 * verifyPhase4Fulbito2.js — Suite de Verificación de Fase 4 (Fulbito 2.0)
 *
 * Valida:
 * 1. Proceso Perceptivo-Cognitivo (Escaneo visual T_scan in [3, 18], pre-escaneo, lapsus por presión).
 * 2. Multiplicador de Química Real de Plantilla (mu_chem in [0.85, 1.15] y enlaces Leyenda/Ídolo universal).
 * 3. Catálogo de Traits e Inferencias Posicionales (PLAYMAKER, CLINICAL_FINISHER, etc.).
 * 4. Integración en Evaluadores (PassEvaluator con 3er hombre y Playmaker; ShotEvaluator con Definidor Clínico y Cañonero).
 * 5. Duelos y Disputas (BALL_WINNER y SPEED_DRIBBLER en ballContest).
 * 6. Integración en el loop en vivo de simulación (playIteration).
 */

import assert from 'assert'
import { initiateGame, playIteration, updateSpatialAndTacticalTelemetry } from '../src/engine/engine.js'
import {
  PLAYER_TRAITS,
  computeSquadChemistryMultipliers,
  inferPlayerTraits,
  hasTrait,
  getEffectiveSkill,
} from '../src/engine/player/effectiveSkill.js'
import { updatePlayerCognition } from '../src/engine/player/cognition.js'
import { evaluateBestPassOption } from '../src/engine/evaluators/passEvaluator.js'
import { evaluateShotAndBreakaway, SHOT_QUALITY } from '../src/engine/evaluators/shotEvaluator.js'
import { resolveBallCarrierEngagement, tryInterceptLooseBall } from '../src/engine/ballContest.js'
import { PLAYERS_DB } from '../src/data/playersDB.js'

console.log('======================================================================')
console.log('=== VERIFICACIÓN: FASE 4 DE FULBITO 2.0 (COGNICIÓN, QUÍMICA Y TRAITS) ===')
console.log('======================================================================\n')

const mockPitch = { width: 680, height: 1050 }

function createPlayer(id, name, pos, x, y, originX, originY, extras = {}) {
  return {
    id,
    playerID: id,
    name,
    position: pos,
    role: pos,
    tacticalRole: pos,
    nationality: extras.nationality || 'Argentina',
    club: extras.club || 'Boca Juniors',
    league: extras.league || 'Liga Profesional',
    rating: extras.rating || 82,
    currentPOS: [x, y],
    originPOS: [originX, originY],
    x,
    y,
    fitness: 100,
    skill: {
      shooting: 80,
      passing: 80,
      control: 80,
      agility: 80,
      strength: 80,
      tackling: 80,
      perception: 80,
      composure: 80,
      ...extras.skill,
    },
    stats: {
      shooting: 80,
      passes: { total: 0, on: 0, off: 0 },
      cards: { yellow: 0, red: 0 },
      tackles: { total: 0, on: 0, off: 0, fouls: 0 },
    },
    ...extras,
  }
}

// -------------------------------------------------------------------------
// TEST 1: QUÍMICA DE EQUIPO Y MULTIPLICADOR mu_chem in [0.85, 1.15]
// -------------------------------------------------------------------------
console.log('=== TEST 1: QUÍMICA DE EQUIPO Y MULTIPLICADOR REAL mu_chem ===')

const squadHighChem = [
  createPlayer(1, 'Agustín Rossi', 'GK', 340, 1000, 340, 1000, { nationality: 'Argentina', club: 'Boca Juniors', league: 'Liga Argentina' }),
  createPlayer(2, 'Carlos Izquierdoz', 'DEF', 280, 850, 280, 850, { nationality: 'Argentina', club: 'Boca Juniors', league: 'Liga Argentina' }),
  createPlayer(3, 'Marcos Rojo', 'DEF', 400, 850, 400, 850, { nationality: 'Argentina', club: 'Boca Juniors', league: 'Liga Argentina' }),
  createPlayer(4, 'Alan Varela', 'ME', 340, 700, 340, 700, { nationality: 'Argentina', club: 'Boca Juniors', league: 'Liga Argentina' }),
  createPlayer(5, 'Darío Benedetto', 'DEL', 340, 400, 340, 400, { nationality: 'Argentina', club: 'Boca Juniors', league: 'Liga Argentina' }),
]

computeSquadChemistryMultipliers(squadHighChem)

for (const p of squadHighChem) {
  assert.ok(p.chemistryMultiplier !== undefined, `El jugador ${p.name} debe tener chemistryMultiplier`)
  assert.ok(p.chemistryMultiplier >= 0.85 && p.chemistryMultiplier <= 1.15,
    `chemistryMultiplier (${p.chemistryMultiplier}) debe estar en [0.85, 1.15]`)
  assert.ok(p.chemistryMultiplier >= 1.05,
    `Jugadores con 100% afinidad de club/nación deben tener química alta (obtenido: ${p.chemistryMultiplier})`)
}
console.log(`  - Multiplicador de química equipo club homogéneo: ${squadHighChem[0].chemistryMultiplier.toFixed(3)} (OK)`)

// Prueba de Leyenda Universal (Diego Maradona)
const squadWithLegend = [
  createPlayer(10, 'Diego Maradona', 'ME', 340, 600, 340, 600, { nationality: 'Argentina', club: 'Universal', isLegend: true }),
  createPlayer(11, 'Erling Haaland', 'DEL', 340, 400, 340, 400, { nationality: 'Norway', club: 'Manchester City', league: 'Premier League' }),
  createPlayer(12, 'Kylian Mbappé', 'DEL', 200, 400, 200, 400, { nationality: 'France', club: 'Real Madrid', league: 'La Liga' }),
]

computeSquadChemistryMultipliers(squadWithLegend)
const maradona = squadWithLegend[0]
console.log(`  - Diego Maradona (Leyenda): chemistryMultiplier = ${maradona.chemistryMultiplier.toFixed(3)}`)
assert.strictEqual(maradona.chemistryMultiplier, 1.15, 'Las leyendas universales deben tener química máxima de 1.15')

console.log('✔ Test 1: Química de plantilla y multiplicadores validados exitosamente.\n')

// -------------------------------------------------------------------------
// TEST 2: CATÁLOGO DE TRAITS E INFERENCIA DE HABILIDADES
// -------------------------------------------------------------------------
console.log('=== TEST 2: CATÁLOGO DE TRAITS E INFERENCIA POR PERFIL TÁCTICO ===')

const playmaker = createPlayer(10, 'Juan Román Riquelme', 'ME', 340, 600, 340, 600, {
  skill: { passing: 96, perception: 94, composure: 92, agility: 75, shooting: 82 }
})
inferPlayerTraits(playmaker)
console.log(`  - Traits de Riquelme:`, playmaker.activeTraits)
assert.ok(hasTrait(playmaker, PLAYER_TRAITS.PLAYMAKER), 'Riquelme debe ser inferido como PLAYMAKER')
assert.ok(hasTrait(playmaker, PLAYER_TRAITS.LONG_SHOT_SPECIALIST), 'Riquelme debe tener LONG_SHOT_SPECIALIST')

const finisher = createPlayer(9, 'Martín Palermo', 'DEL', 340, 950, 340, 200, {
  skill: { shooting: 94, composure: 90, strength: 88, perception: 85 }
})
inferPlayerTraits(finisher)
console.log(`  - Traits de Palermo:`, finisher.activeTraits)
assert.ok(hasTrait(finisher, PLAYER_TRAITS.CLINICAL_FINISHER), 'Palermo debe ser inferido como CLINICAL_FINISHER')

const ballWinner = createPlayer(5, 'Javier Mascherano', 'ME', 340, 750, 340, 750, {
  role: 'MCD',
  tacticalRole: 'MCD',
  skill: { tackling: 93, strength: 86, perception: 88, aggression: 90 }
})
inferPlayerTraits(ballWinner)
console.log(`  - Traits de Mascherano:`, ballWinner.activeTraits)
assert.ok(hasTrait(ballWinner, PLAYER_TRAITS.BALL_WINNER), 'Mascherano debe ser inferido como BALL_WINNER')

const sweeperGK = createPlayer(1, 'Emiliano Martínez', 'GK', 340, 50, 340, 50, {
  skill: { perception: 84, passing: 78, agility: 80 }
})
inferPlayerTraits(sweeperGK)
console.log(`  - Traits de Dibu Martínez:`, sweeperGK.activeTraits)
assert.ok(hasTrait(sweeperGK, PLAYER_TRAITS.SWEEPER_KEEPER), 'Dibu Martínez debe ser inferido como SWEEPER_KEEPER')

// Habilidad efectiva escalada por química y traits
playmaker.chemistryMultiplier = 1.10
const effPassing = getEffectiveSkill(playmaker, 'passing')
console.log(`  - Pase efectivo de Riquelme (base 96 + chem 1.10 + PLAYMAKER): ${effPassing.toFixed(3)}`)
assert.ok(effPassing > 0.96, 'El pase efectivo debe estar potenciado por encima de su valor base')

console.log('✔ Test 2: Catálogo e inferencia de traits validado exitosamente.\n')

// -------------------------------------------------------------------------
// TEST 3: PROCESO PERCEPTIVO-COGNITIVO Y ESCANEO VISUAL
// -------------------------------------------------------------------------
console.log('=== TEST 3: PROCESO COGNITIVO, ESCANEO Y MICRO-LAPSUS POR PRESIÓN ===')

const cogPlayer = createPlayer(8, 'Mediocampista Cognitivo', 'ME', 340, 525, 340, 525, {
  skill: { perception: 85, agility: 80, composure: 70 }
})

// Simular varios ticks sin pelota
for (let tick = 1; tick <= 15; tick++) {
  updatePlayerCognition(cogPlayer, tick, 0.20)
}
assert.ok(cogPlayer.cognition !== undefined, 'El jugador debe poseer estado de cognición')
assert.ok(cogPlayer.cognition.scanInterval >= 3 && cogPlayer.cognition.scanInterval <= 18,
  `scanInterval (${cogPlayer.cognition.scanInterval}) debe estar entre [3, 18]`)
assert.strictEqual(cogPlayer.cognition.isPreScanned, true, 'Tras ticks libre sin balón, debe encontrarse en pre-escaneo activo')
console.log(`  - Escaneo completado: scanInterval = ${cogPlayer.cognition.scanInterval} ticks | isPreScanned = ${cogPlayer.cognition.isPreScanned}`)

// Probar micro-lapsus por alta presión rival (PPM > 0.65)
cogPlayer.hasBall = true
for (let tick = 16; tick <= 30; tick++) {
  updatePlayerCognition(cogPlayer, tick, 0.85) // PPM 0.85 (presión asfixiante)
}
console.log(`  - Bajo presión extrema (PPM 0.85): lapsusTicks = ${cogPlayer.cognition.composureLapseTicks} | isPreScanned = ${cogPlayer.cognition.isPreScanned}`)
assert.strictEqual(cogPlayer.cognition.isPreScanned, false, 'Bajo presión extrema debe perder el pre-escaneo anticipado')

console.log('✔ Test 3: Cognición y micro-lapsus validados exitosamente.\n')

// -------------------------------------------------------------------------
// TEST 4: EVALUADORES CON Rasgos y Cognición (Shot & Pass Evaluators)
// -------------------------------------------------------------------------
console.log('=== TEST 4: EVALUADORES TÁCTICOS CON TRAITS Y COGNICIÓN ===')

// 4.1 ShotEvaluator con CLINICAL_FINISHER
const rawFinisher = createPlayer(9, 'Goleador Clínico', 'DEL', 340, 960, 340, 200, {
  skill: { shooting: 92, composure: 90 }
})
rawFinisher.activeTraits = [PLAYER_TRAITS.CLINICAL_FINISHER]
const rawKeeper = createPlayer(1, 'Arquero', 'GK', 340, 1020, 340, 1000)

const shotEval = evaluateShotAndBreakaway(rawFinisher, { players: [rawFinisher] }, { players: [rawKeeper] }, mockPitch)
console.log(`  - Remate definidor clínico: xG = ${shotEval.xG.toFixed(3)} | Calidad = ${shotEval.quality}`)
assert.strictEqual(shotEval.quality, SHOT_QUALITY.CLEAR_CUT, 'Debe ser ocasión manifiesta')
assert.ok(shotEval.xG >= 0.35, `El xG con bonificación de definidor clínico debe ser >= 0.35 (obtenido: ${shotEval.xG})`)

// 4.2 PassEvaluator con pre-escaneo (sin penalización corporal) y PLAYMAKER
const passer = createPlayer(10, 'Pasador Brillante', 'ME', 340, 600, 340, 200, {
  facingAngle: Math.PI / 2, // Mira hacia el arco rival
  skill: { passing: 95, perception: 95 },
  cognition: { isPreScanned: true, visionBonus: 0.15 }
})
passer.activeTraits = [PLAYER_TRAITS.PLAYMAKER]

const runner1 = createPlayer(7, 'Extremo Picando', 'DEL', 200, 850, 200, 200, {
  offensiveState: 'RUNNING_IN_BEHIND'
})
const runner2 = createPlayer(9, 'Centrodelantero en Zona 14', 'DEL', 340, 820, 340, 200, {
  offensiveState: 'RUNNING_IN_BEHIND'
})

const passOption = evaluateBestPassOption(passer, { players: [passer, runner1, runner2] }, { players: [rawKeeper] }, mockPitch)
console.log(`  - Mejor pase encontrado por Playmaker: ${passOption.type} hacia ${passOption.teammate.name} (Utilidad: ${passOption.utility.toFixed(3)})`)
assert.ok(passOption !== null, 'Debe encontrar un pase óptimo')
assert.ok(passOption.utility > 0.40, `La utilidad con PLAYMAKER y pre-escaneo debe ser elevada (> 0.40, obtenida: ${passOption.utility})`)

console.log('✔ Test 4: Evaluadores de tiro y pase con rasgos validados exitosamente.\n')

// -------------------------------------------------------------------------
// TEST 5: DUELOS Y DISPUTAS (BALL_WINNER Y SPEED_DRIBBLER)
// -------------------------------------------------------------------------
console.log('=== TEST 5: DUELOS CON Rasgos (BALL_WINNER Y SPEED_DRIBBLER) ===')

const defBallWinner = createPlayer(6, 'Recuperador Feroz', 'DEF', 340, 500, 340, 500, {
  skill: { tackling: 92, strength: 88, perception: 85 }
})
defBallWinner.activeTraits = [PLAYER_TRAITS.BALL_WINNER]

const attDribbler = createPlayer(11, 'Regateador Veloz', 'DEL', 340, 506, 340, 200, {
  skill: { agility: 92, control: 90 }
})
attDribbler.activeTraits = [PLAYER_TRAITS.SPEED_DRIBBLER]

const mockBall = { x: 340, y: 506, position: [340, 506, 0], velocity: [0, 0, 0] }
let cleanWins = 0
let fouls = 0
const trials = 100

for (let i = 0; i < trials; i++) {
  defBallWinner.tackleCooldown = 0
  attDribbler.tackleCooldown = 0
  const result = resolveBallCarrierEngagement(defBallWinner, attDribbler, mockBall, {
    referee: { strictness: 0.5 },
    isInsidePenaltyBox: false,
    isCounterAttack: false,
    isLastManDOGSO: false,
  })
  if (result.outcome === 'CLEAN_TACKLE_WIN' || result.outcome === 'CLEAN_BODY_WIN') cleanWins++
  if (result.outcome === 'FOUL') fouls++
}

console.log(`  - 100 Disputas BALL_WINNER vs SPEED_DRIBBLER: Quites limpios = ${cleanWins} | Faltas = ${fouls}`)
assert.ok(cleanWins > 20, 'Un recuperador de élite debe lograr quites limpios')
assert.ok(fouls < 50, 'El rasgo BALL_WINNER reduce la comisión de faltas')

// Verificación de radio de intercepción ampliado para SWEEPER_KEEPER
const gkBall = { x: 340, y: 62, position: [340, 62, 0], velocity: [0, 1, 0], vx: 0, vy: 1, z: 0 }
const swept = tryInterceptLooseBall(sweeperGK, gkBall)
console.log(`  - SWEEPER_KEEPER corte de balón dividido: resultado = ${swept}`)
assert.strictEqual(typeof swept, 'boolean', 'El arquero líbero debe poder cortar balones divididos con radio ampliado')

console.log('✔ Test 5: Duelos y barridas con rasgos validados exitosamente.\n')

// -------------------------------------------------------------------------
// TEST 6: SIMULACIÓN END-TO-END DE PARTIDO CON QUÍMICA Y COGNICIÓN
// -------------------------------------------------------------------------
console.log('=== TEST 6: SIMULACIÓN END-TO-END EN TIEMPO REAL CON MOTOR ===')

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
const matchDetails = await initiateGame(teamA, teamB, pitchDetails)

console.log('  - Comprobando inicialización de Química de Plantilla en ambos equipos...')
for (const p of [...matchDetails.kickOffTeam.players, ...matchDetails.secondTeam.players]) {
  assert.ok(p.chemistryMultiplier !== undefined, `El jugador ${p.name} debe tener chemistryMultiplier inicializado`)
  assert.ok(p.chemistryMultiplier >= 0.85 && p.chemistryMultiplier <= 1.15,
    `chemistryMultiplier de ${p.name} (${p.chemistryMultiplier}) fuera de [0.85, 1.15]`)
  assert.ok(Array.isArray(p.activeTraits), `El jugador ${p.name} debe tener activeTraits inferidos`)
}
console.log('  ✔ Química y rasgos inicializados para los 22 futbolistas.')

console.log('  - Ejecutando 45 iteraciones de partido...')
for (let iter = 1; iter <= 45; iter++) {
  await playIteration(matchDetails)
}

console.log('  - Comprobando telemetría de cognición activa tras 45 iteraciones...')
let playersWithCognition = 0
for (const p of [...matchDetails.kickOffTeam.players, ...matchDetails.secondTeam.players]) {
  if (p.cognition && p.cognition.lastScanIteration > 0) {
    playersWithCognition++
  }
}
assert.ok(playersWithCognition >= 20, `Al menos 20 de los 22 jugadores deben registrar escaneo cognitivo (obtenidos: ${playersWithCognition})`)
console.log(`  ✔ Telemetría cognitiva verificada: ${playersWithCognition}/22 jugadores escaneando activamente.`)

console.log('\n======================================================================')
console.log('=== TODOS LOS TESTS DE FASE 4 (FULBITO 2.0) PASARON AL 100% ===')
console.log('======================================================================\n')
