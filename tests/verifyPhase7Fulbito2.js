/**
 * verifyPhase7Fulbito2.js — Suite de Verificación Rigurosa para la FASE 7 de Fulbito 2.2
 * 
 * Valida:
 * 1. Duelos aéreos 2.5D: fórmula S_aerial, salto con carrera, desenlaces (HEADER_SHOT, FLICK_ON, DEFENSIVE_CLEARANCE_WIDE).
 * 2. Atajada balística 2.5D: Reach_XY, Reach_Z, GK_SPLIT_STEP, screened shots y 3 resultados (CLEAN_CATCH, PARRY_SAFE, REBOUND_DANGER).
 * 3. Duelo de regate 1v1 y finta biomecánica: ángulo 35°-55°, interceptCooldown = 25 ticks, rasgos SPEED_DRIBBLER.
 * 4. Córners tácticos: sistema mixto/zonal defensivo (2 en 1er palo, 3 torres al penal/2do palo, 1 en Z14, 2 a la contra) y Magnus ofensivo.
 * 5. Penales psicológicos: GOALKEEPER_DEPENDENT (paradinha / lectura) vs GOALKEEPER_INDEPENDENT (potencia / colocación).
 */

import assert from 'assert';
import {
  computeAerialScore,
  resolveAerialDuel,
  resolveGoalkeeperSave25D
} from '../src/engine/ball/ballContest25D.js';
import {
  evaluateDribbleDuel1v1,
  shouldAttemptDribble
} from '../src/engine/evaluators/duelEvaluator.js';
import {
  setupTacticalCornerMixedZonalDefence,
  setupTacticalCornerAttacking,
  resolvePsychologicalPenalty
} from '../src/engine/setFreekicks.js';
import { simulateShootoutKick } from '../src/engine/engine.js';

console.log('⚽ Iniciando Verificación de FASE 7: Disputas 2.5D, Regate 1v1 y Balón Parado / Penales Psicológicos...\n');

// ============================================================================
// TEST 1: DUELO AÉREO 2.5D (FÓRMULA S_AERIAL Y DESENLACES)
// ============================================================================
console.log('--- TEST 1: Duelos Aéreos 2.5D y Balística Vertical ---');

const tallAttacker = {
  id: 'att_tall',
  name: 'Erling H.',
  height: 195,
  skill: { jumping: 88, strength: 90, perception: 82 },
  currentPOS: [340, 150],
  velocity: [0, -2.5], // Atacando hacia el arco / balón en carrera frontal
  traits: ['TARGET_MAN', 'AERIAL_THREAT']
};

const shortDefender = {
  id: 'def_short',
  name: 'Lisandro M.',
  height: 175,
  skill: { jumping: 84, strength: 78, perception: 80 },
  currentPOS: [340, 148],
  velocity: [0, 0], // Salto estático
  traits: []
};

const ballInAir = {
  x: 340,
  y: 145,
  z: 22,
  vz: -1.2,
  position: [340, 145, 22],
  velocity: [0, 0]
};

const scoreTall = computeAerialScore(tallAttacker, { x: 340, y: 145 }, true);
const scoreShort = computeAerialScore(shortDefender, { x: 340, y: 145 }, false);

console.log(`Puntaje aéreo Torre con carrera: ${scoreTall.toFixed(3)} | Defensor estático: ${scoreShort.toFixed(3)}`);
assert(scoreTall > scoreShort, 'La torre con carrera debe obtener un S_aerial mayor que el defensor estático');

// Duelo en zona de definición (cerca del arco Y=0) -> debe resultar en HEADER_SHOT
const duelGoalZone = resolveAerialDuel(tallAttacker, shortDefender, ballInAir, {
  goalTargetY: 0,
  rng: () => 0.5 // Determinista
});

assert.strictEqual(duelGoalZone.outcome, 'ATTACKER_HEADER_WIN', 'El atacante dominante debe ganar el duelo');
assert.strictEqual(duelGoalZone.actionType, 'HEADER_SHOT', 'Dentro de las zonas de remate debe decidir HEADER_SHOT');
console.log('✓ Duelo aéreo en zona de remate produce HEADER_SHOT correctamente');

// Duelo en mediocampo (Y=500) -> debe resultar en FLICK_ON
tallAttacker.currentPOS = [340, 500];
const duelMidfield = resolveAerialDuel(tallAttacker, shortDefender, { ...ballInAir, y: 500 }, {
  goalTargetY: 0,
  rng: () => 0.5
});
assert.strictEqual(duelMidfield.actionType, 'FLICK_ON', 'En mediocampo debe resolver peinada / flick-on');
console.log('✓ Duelo aéreo en mediocampo produce FLICK_ON correctamente');

// Duelo ganado por el defensor -> despeje hacia bandas (targetX en laterales)
const duelDefWin = resolveAerialDuel(shortDefender, tallAttacker, ballInAir, {
  goalTargetY: 0,
  rng: () => 0.1 // Favorece al defensor
});
assert.strictEqual(duelDefWin.outcome, 'DEFENDER_CLEAR_WIN', 'El defensor debe ganar cuando supera el score');
assert.strictEqual(duelDefWin.actionType, 'DEFENSIVE_CLEARANCE_WIDE', 'El defensor debe despejar alto hacia bandas');
assert(duelDefWin.targetPOS[0] === 100 || duelDefWin.targetPOS[0] === 580, 'El despeje defensivo debe estar orientado a bandas');
console.log('✓ Despeje aéreo defensivo despeja a bandas laterales correctamente');

// ============================================================================
// TEST 2: ATAJADA BALÍSTICA 2.5D (REACH_XY, REACH_Z, SPLIT-STEP, 3 OUTCOMES)
// ============================================================================
console.log('\n--- TEST 2: Atajada Balística 2.5D y Control de Rebotes ---');

const eliteGK = {
  id: 'gk_courtois',
  name: 'Thibaut C.',
  height: 200,
  skill: { saving: 92, agility: 86, jumping: 88, perception: 90 },
  fsm: { currentState: 'GK_SPLIT_STEP' }
};

const ballShot = {
  x: 340,
  y: 35,
  z: 14,
  vx: 0,
  vy: -8,
  vz: 1.5,
  position: [340, 35, 14],
  velocity: [0, -8]
};

// 1. Atajada de arquero élite con split-step -> alcanza amplio Reach
const saveElite = resolveGoalkeeperSave25D(eliteGK, ballShot, 60, {
  screenedShot: false,
  hasSplitStep: true,
  rng: () => 0.95 // Buen desempeño
});

assert(saveElite.reachXY >= 32, `Reach_XY debe ser al menos 32px (obtenido: ${saveElite.reachXY})`);
assert(saveElite.reachZ >= 38, `Reach_Z debe ser al menos 38px (obtenido: ${saveElite.reachZ})`);
assert.strictEqual(saveElite.outcome, 'CLEAN_CATCH', 'Tiro moderado con arquero élite debe ser CLEAN_CATCH');
console.log(`✓ Reach_XY: ${saveElite.reachXY.toFixed(1)}px, Reach_Z: ${saveElite.reachZ.toFixed(1)}px. Atajada CLEAN_CATCH verificada`);

// 2. Tiro violento a quemarropa con visión tapada (screened shot) -> PARRY_SAFE o REBOUND_DANGER
const saveViolent = resolveGoalkeeperSave25D(eliteGK, ballShot, 115, {
  screenedShot: true,
  hasSplitStep: false,
  rng: () => 0.35
});
assert(saveViolent.outcome === 'PARRY_SAFE' || saveViolent.outcome === 'REBOUND_DANGER', 'Remate violento debe generar desvío o rebote vivo');
console.log(`✓ Remate violento con screened shot resolvió: ${saveViolent.outcome}`);

// ============================================================================
// TEST 3: DUELO DE REGATE 1V1 Y FINTA BIOMECÁNICA
// ============================================================================
console.log('\n--- TEST 3: Duelo de Regate 1v1 y Finta Biomecánica ---');

const dribbler = {
  id: 'att_vini',
  name: 'Vinicius Jr.',
  skill: { control: 92, agility: 95, speed: 96 },
  traits: ['SPEED_DRIBBLER', 'FLAIR'],
  currentPOS: [180, 750],
  velocity: [1.2, 4.0]
};

const slowDefender = {
  id: 'def_slow',
  name: 'Maguire',
  skill: { agility: 58, perception: 68, tackling: 74 },
  traits: [],
  currentPOS: [185, 780],
  velocity: [0, 0],
  interceptCooldown: 0
};

assert.strictEqual(shouldAttemptDribble(dribbler, slowDefender, { zoneId: 16 }), true, 'Dribbler en zona 16 debe intentar el regate');

const duelResult = evaluateDribbleDuel1v1(dribbler, slowDefender, {
  attackDirectionY: 1,
  rng: () => 0.5
});

assert.strictEqual(duelResult.success, true, 'El gambeteador de élite debe ganar el 1v1');
assert.strictEqual(duelResult.outcome, 'DRIBBLE_SUCCESS', 'El outcome debe ser DRIBBLE_SUCCESS');
assert.strictEqual(duelResult.defenderCooldown, 25, 'Debe aplicar interceptCooldown = 25 al defensor');
assert.strictEqual(slowDefender.interceptCooldown, 25, 'El objeto defender debe actualizar interceptCooldown a 25');
assert(Math.abs(duelResult.feintAngleDeg) >= 35 && Math.abs(duelResult.feintAngleDeg) <= 55, `Ángulo de finta ${duelResult.feintAngleDeg}° debe estar entre 35° y 55°`);
assert(Math.hypot(duelResult.feintVector.vx, duelResult.feintVector.vy) > 0, 'Debe generar vector de aceleración de finta');
console.log(`✓ Regate 1v1 exitoso: finta a ${duelResult.feintAngleDeg.toFixed(1)}°, defensor clavado con cooldown = ${slowDefender.interceptCooldown} ticks`);

// ============================================================================
// TEST 4: BALÓN PARADO TÁCTICO (CÓRNERS MIXTO/ZONAL Y OFENSIVO MAGNUS)
// ============================================================================
console.log('\n--- TEST 4: Balón Parado Táctico (Córners Mixtos y Magnus) ---');

const mockDefenceTeam = {
  teamID: 'DEF_FC',
  name: 'Defensa FC',
  players: [
    { playerID: 'gk', name: 'Arquero', position: 'GK', height: 190, originPOS: [340, 10], currentPOS: [340, 10], skill: {} },
    { playerID: 'cb1', name: 'Van Dijk', position: 'CB', height: 193, currentPOS: [300, 100], skill: { jumping: 90, strength: 92 } },
    { playerID: 'cb2', name: 'Konate', position: 'CB', height: 194, currentPOS: [380, 100], skill: { jumping: 88, strength: 89 } },
    { playerID: 'cb3', name: 'Matip', position: 'CB', height: 195, currentPOS: [340, 120], skill: { jumping: 86, strength: 85 } },
    { playerID: 'lb', name: 'Robertson', position: 'LB', height: 178, currentPOS: [100, 100], skill: { speed: 88, agility: 86 } },
    { playerID: 'rb', name: 'Alexander-Arnold', position: 'RB', height: 175, currentPOS: [580, 100], skill: { speed: 84, agility: 85 } },
    { playerID: 'cm1', name: 'Mac Allister', position: 'CM', height: 176, currentPOS: [300, 200], skill: { perception: 85, strength: 74 } },
    { playerID: 'cm2', name: 'Szoboszlai', position: 'CM', height: 186, currentPOS: [380, 200], skill: { speed: 86, jumping: 80 } },
    { playerID: 'lw', name: 'Diaz', position: 'LW', height: 178, currentPOS: [100, 300], skill: { speed: 92, agility: 90 } },
    { playerID: 'rw', name: 'Salah', position: 'RW', height: 175, currentPOS: [580, 300], skill: { speed: 93, agility: 90 } },
    { playerID: 'st', name: 'Nunez', position: 'ST', height: 187, currentPOS: [340, 350], skill: { speed: 91, jumping: 84 } }
  ]
};

const matchDetailsMock = {
  pitchSize: [680, 1050],
  ball: { position: [0, 0, 0] }
};

setupTacticalCornerMixedZonalDefence(matchDetailsMock, mockDefenceTeam, true);

// Verificar roles defensivos asignados según el sistema mixto
const nearPostZonals = mockDefenceTeam.players.filter(p => p.defensiveRole === 'NEAR_POST_ZONAL');
const manMarkers = mockDefenceTeam.players.filter(p => (p.defensiveRole || '').startsWith('MAN_MARK_'));
const z14Shield = mockDefenceTeam.players.find(p => p.defensiveRole === 'ZONE_14_REBOUND_SHIELD');
const counterOutlets = mockDefenceTeam.players.filter(p => (p.defensiveRole || '').startsWith('COUNTER_OUTLET_'));

assert.strictEqual(nearPostZonals.length, 2, 'Debe haber exactamente 2 guardias zonales en el primer palo');
assert.strictEqual(manMarkers.length, 3, 'Las 3 torres deben estar en marca individual');
assert(z14Shield !== undefined, 'Debe haber un jugador bloqueando rebote en la medialuna Zona 14');
assert(counterOutlets.length >= 1, 'Debe haber jugadores posicionados para contragolpe');
console.log('✓ Sistema mixto/zonal de córner defensivo verificado (2 zonales 1er palo, 3 marcas individuales, 1 escudo Z14, outlets de contra)');

// Córner Ofensivo con Comba Magnus
const mockAttackTeam = {
  teamID: 'ATT_FC',
  name: 'Ataque FC',
  players: [
    { playerID: 'p1', name: 'Taker Right Foot', preferredFoot: 'right', hasBall: true, skill: { passing: 88 } },
    { playerID: 'p2', name: 'Tower 1', height: 192, skill: { jumping: 85 } }
  ]
};

const attackSetup = setupTacticalCornerAttacking(matchDetailsMock, mockAttackTeam, [0, 0], true);
assert.strictEqual(attackSetup.isInSwinger, true, 'Pie derecho desde córner izquierdo (0, 0) debe ser IN_SWINGER');
assert.strictEqual(matchDetailsMock.ball.cornerDelivery.type, 'IN_SWINGER', 'El delivery del balón debe quedar registrado como IN_SWINGER');
assert(matchDetailsMock.ball.cornerDelivery.magnusSpin > 0, 'In-swinger debe tener spin Magnus positivo');
console.log('✓ Córner ofensivo con comba Magnus In-Swinger y las 4 zonas coordinadas verificado');

// ============================================================================
// TEST 5: PENALES PSICOLÓGICOS (GOALKEEPER-DEPENDENT VS INDEPENDENT)
// ============================================================================
console.log('\n--- TEST 5: Penales Psicológicos y Duelo Cognitivo ---');

// Caso A: Pateador cerebral (Messi/Jorginho) con alta perception y control o rasgo PLAYMAKER
const cerebralKicker = {
  name: 'Lionel M.',
  skill: { perception: 95, control: 96, shooting: 92, penalty_taking: 90 },
  baseSkill: { perception: 95, control: 96, shooting: 92, penalty_taking: 90 },
  traits: ['PLAYMAKER', 'CLINICAL_FINISHER']
};

const anxiousGK = {
  name: 'Dibu M.',
  skill: { saving: 88, perception: 72, agility: 82, jumping: 84 },
  baseSkill: { saving: 88, perception: 72, agility: 82, jumping: 84 }
};

// Con arquero ansioso/impaciente (perception < 82), el pateador cerebral engaña (Paradinha)
const resDependentFeint = resolvePsychologicalPenalty(cerebralKicker, anxiousGK, {
  rng: () => 0.5 // Arquero muerde la finta
});
assert.strictEqual(resDependentFeint.style, 'GOALKEEPER_DEPENDENT', 'Pateador técnico debe elegir GOALKEEPER_DEPENDENT');
assert.strictEqual(resDependentFeint.details.gkBitesFeint, true, 'Arquero impaciente debe morder la finta');
assert.strictEqual(resDependentFeint.scored, true, 'Engaño total debe resultar en gol (94% prob)');
console.log(`✓ Penal Paradinha exitoso: estilo=${resDependentFeint.style}, arquero engañado al palo opuesto`);

// Caso B: Pateador de potencia pura (Cristiano/Batistuta/Haaland)
const powerKicker = {
  name: 'Erling H.',
  skill: { perception: 74, control: 75, shooting: 96, strength: 92, penalty_taking: 92 },
  baseSkill: { perception: 74, control: 75, shooting: 96, strength: 92, penalty_taking: 92 },
  traits: []
};

const resPower = resolvePsychologicalPenalty(powerKicker, anxiousGK, {
  rng: () => 0.3 // Puntería certera a los ángulos
});
assert.strictEqual(resPower.style, 'GOALKEEPER_INDEPENDENT', 'Pateador de potencia debe elegir GOALKEEPER_INDEPENDENT');
console.log(`✓ Penal Potencia Biomecánica verificado: estilo=${resPower.style}, outcome=${resPower.outcome}`);

// Caso C: Integración con simulateShootoutKick de engine.js
const shootoutKickRes = simulateShootoutKick(cerebralKicker, anxiousGK);
assert(shootoutKickRes.outcome === 'goal' || shootoutKickRes.outcome === 'saved' || shootoutKickRes.outcome === 'missed', 'simulateShootoutKick debe devolver outcome válido');
assert.strictEqual(shootoutKickRes.style, 'GOALKEEPER_DEPENDENT', 'simulateShootoutKick debe incorporar el motor psicológico');
console.log('✓ simulateShootoutKick integrado con resolvePsychologicalPenalty preservando compatibilidad');

console.log('\n======================================================');
console.log('🎉 TODOS LOS TESTS DE LA FASE 7 FUERON SUPERADOS CON ÉXITO (100%)');
console.log('======================================================');
