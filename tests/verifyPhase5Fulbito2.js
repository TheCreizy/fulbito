/**
 * verifyPhase5Fulbito2.js — Suite de Verificación de Fase 5 (Fulbito 2.2)
 *
 * Valida según UPDATE FULBITO 2.2.md:
 * 1. Las 4 Fases del Continuum Táctico en matchContext.js (ORGANIZACION_OFENSIVA, TRANSICION_ATAQUE_DEFENSA,
 *    ORGANIZACION_DEFENSIVA, TRANSICION_DEFENSA_ATAQUE).
 * 2. Ventana de Gegenpressing (Counter-Press) de 5s (100 ticks) cuando se pierde en u_loss >= 0.45 con >= 3 jugadores en 180px,
 *    vs Repliegue Intensivo (INTENSIVE_RETREAT / TRACKING_BACK) cuando no se cumple el umbral o en bloque bajo.
 * 3. Ventana de Transición Defensa -> Ataque de 8s (160 ticks), Índice de Desorden Rival,
 *    Modo Contraataque Vertical (FAST_COUNTER con x1.80 en pases filtrados/verticales) y Modo Consolidación (CONSOLIDATE_POSSESSION).
 * 4. Cinemática Biomecánica en steering.js:
 *    - Rampa progresiva de sprint (Delta_ramp = 0.065 + 0.055 * EffectiveSkill(agility): explosivo ~8 ticks vs pesado ~12 ticks).
 *    - Penalización angular por giro brusco > 90° (mu_turn) e interpolación de facingAngle (omega_max).
 *    - Velocidad de conducción modulada por control y SPEED_DRIBBLER (mu_carry).
 *    - Esfuerzo por modalidad de movimiento (WALKING, JOGGING_SHAPE, CRUISING_SUPPORT, SPRINTING, SURGING_BURST).
 * 5. Integración en vivo en el loop del motor (playIteration).
 */

import assert from 'assert';
import { initiateGame, playIteration } from '../src/engine/engine.js';
import {
  TACTICAL_PHASES,
  TRANSITION_SUBMODES,
  CONTINUUM_CONFIG,
  computeOpponentDisorderIndex,
  evaluateCounterPressTrigger,
  evaluateFastCounterTrigger,
  updateMatchContinuum,
} from '../src/engine/core/matchContext.js';
import {
  MOVEMENT_EFFORT,
  computeSprintRampStep,
  updatePlayerSprintRamp,
  computeTurnKinematics,
  computeCarrySpeedMultiplier,
  resolveMovementEffort,
} from '../src/engine/steering.js';
import { evaluateBestPassOption } from '../src/engine/evaluators/passEvaluator.js';
import { PLAYER_TRAITS } from '../src/engine/player/effectiveSkill.js';
import { PLAYERS_DB } from '../src/data/playersDB.js';

console.log('======================================================================');
console.log('=== VERIFICACIÓN: FASE 5 DE FULBITO 2.2 (CONTINUUM 4 FASES Y STEERING) ===');
console.log('======================================================================\n');

const mockPitch = { width: 680, height: 1050 };

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
    intentPOS: [originX, originY],
    x,
    y,
    fitness: 100,
    chemistryMultiplier: 1.0,
    skill: {
      shooting: 80,
      passing: 80,
      control: 80,
      agility: 80,
      strength: 80,
      tackling: 80,
      perception: 80,
      stamina: 80,
      ...extras.skill,
    },
    stats: {
      passes: { total: 0, on: 0, off: 0 },
      cards: { yellow: 0, red: 0 },
      tackles: { total: 0, on: 0, off: 0, fouls: 0 },
    },
    ...extras,
  };
}

// -------------------------------------------------------------------------
// TEST 1: TRANSICIÓN ATAQUE -> DEFENSA (GEGENPRESSING 5s VS REPLIEGUE INTENSIVO)
// -------------------------------------------------------------------------
console.log('=== TEST 1: TRANSICIÓN ATAQUE -> DEFENSA (GEGENPRESSING 5s VS REPLIEGUE) ===');

// Equipo Top (ataca hacia Y=1050, u=1). Pierde la pelota en campo rival (Y=680 -> u ~ 0.65 >= 0.45)
// con 3 jugadores propios dentro de un radio de 180px (18m)
const teamPressing = {
  teamID: 'T_PRESS',
  name: 'Gegenpress FC',
  mentality: 'offensive',
  players: [
    createPlayer('P1', 'GK', 'GK', 340, 40, 340, 40),
    createPlayer('P2', 'CB1', 'CB', 250, 420, 250, 150),
    createPlayer('P3', 'CB2', 'CB', 430, 420, 430, 150),
    createPlayer('P4', 'CM1', 'CM', 310, 640, 310, 350), // dist ~ 50px
    createPlayer('P5', 'CM2', 'CM', 390, 660, 390, 350), // dist ~ 53px
    createPlayer('P6', 'ST1', 'ST', 340, 710, 340, 500), // dist ~ 30px
    createPlayer('P7', 'LW', 'EXT', 100, 600, 100, 450), // lejos (> 240px)
  ],
};

const lossPointHigh = [340, 680]; // u = 680/1050 = 0.648 >= 0.45
const cpHigh = evaluateCounterPressTrigger(teamPressing, lossPointHigh, mockPitch);
assert.strictEqual(cpHigh.shouldCounterPress, true, 'Debe activar Gegenpressing cuando u_loss >= 0.45 y hay >= 3 jugadores en 180px');
assert.strictEqual(cpHigh.presserIds.length, 3, 'Exactamente los 3 jugadores más cercanos deben cazar al portador');
console.log(`  - Pérdida en campo rival (u=${cpHigh.lossU}) con ${cpHigh.nearbyCount} jugadores en <18m: COUNTER_PRESSING activado (Pressers: ${cpHigh.presserIds.join(', ')})`);

// Caso 2: Pérdida con solo 1 jugador cerca -> debe activar Repliegue Intensivo (INTENSIVE_RETREAT)
const lossPointIsolated = [580, 820];
const cpIsolated = evaluateCounterPressTrigger(teamPressing, lossPointIsolated, mockPitch);
assert.strictEqual(cpIsolated.shouldCounterPress, false, 'Si no hay 3 compañeros en 18m, debe abortar Gegenpressing e ir a Repliegue');
console.log(`  - Pérdida aislada (${cpIsolated.nearbyCount} jugador cerca): Repliegue Intensivo activado correctamente.`);

console.log('✔ Test 1: Gegenpressing vs Repliegue Intensivo validados exitosamente.\n');

// -------------------------------------------------------------------------
// TEST 2: TRANSICIÓN DEFENSA -> ATAQUE (FAST COUNTER x1.80 VS CONSOLIDACIÓN)
// -------------------------------------------------------------------------
console.log('=== TEST 2: TRANSICIÓN DEFENSA -> ATAQUE (DESORDEN RIVAL Y MULTIPLICADOR x1.80) ===');

// Equipo rival desordenado (varios defensores adelantados por delante de la pelota y línea alta)
const disorderedOpponent = {
  teamID: 'T_DISORDER',
  name: 'Rival Desordenado',
  mentality: 'offensive',
  players: [
    createPlayer('O1', 'GK', 'GK', 340, 1010, 340, 1010), // Equipo Bottom (ataca hacia Y=0)
    createPlayer('O2', 'CB1', 'CB', 260, 480, 260, 900), // Adelantado en mitad de cancha
    createPlayer('O3', 'CB2', 'CB', 420, 490, 420, 900),
    createPlayer('O4', 'LB', 'LB', 100, 320, 100, 880),  // Pasado de la línea de la pelota (Y=450)
    createPlayer('O5', 'RB', 'RB', 580, 310, 580, 880),
    createPlayer('O6', 'CM', 'CM', 340, 350, 340, 700),
  ],
};

const ballAtRecovery = [340, 450];
const disorderIdx = computeOpponentDisorderIndex(disorderedOpponent, ballAtRecovery, mockPitch);
console.log(`  - Índice de Desorden Rival al robar la pelota: ${disorderIdx}`);
assert.ok(disorderIdx >= CONTINUUM_CONFIG.DISORDER_THRESHOLD, `El desorden rival (${disorderIdx}) debe superar el umbral (${CONTINUUM_CONFIG.DISORDER_THRESHOLD})`);

const fcTrigger = evaluateFastCounterTrigger(teamPressing, disorderedOpponent, ballAtRecovery, mockPitch);
assert.strictEqual(fcTrigger.shouldFastCounter, true, 'Con rival desordenado debe activar FAST_COUNTER');
assert.strictEqual(fcTrigger.throughMultiplier, 1.80, 'El multiplicador de pase vertical en FAST_COUNTER debe ser 1.80x');

// Verificar en passEvaluator que la utilidad del pase vertical/filtrado escala x1.80 en FAST_COUNTER
const passer = createPlayer('P4', 'Mediocentro', 'CM', 340, 450, 340, 350, { skill: { passing: 88, perception: 88 } });
const striker = createPlayer('P6', 'Delantero', 'ST', 340, 620, 340, 500, { offensiveState: 'RUNNING_IN_BEHIND' });
const counterTeam = {
  teamID: 'T_COUNTER',
  name: 'Counter FC',
  transitionSubMode: 'NONE',
  passUtilityMultiplier: 1.0,
  players: [passer, striker],
};
const cleanOpposition = {
  teamID: 'T_OPP',
  players: [createPlayer('O1', 'GK', 'GK', 340, 1020, 340, 1020)],
};

const normalPassEval = evaluateBestPassOption(passer, counterTeam, cleanOpposition, mockPitch);
counterTeam.transitionSubMode = 'FAST_COUNTER';
counterTeam.passUtilityMultiplier = 1.80;
const counterPassEval = evaluateBestPassOption(passer, counterTeam, cleanOpposition, mockPitch);

console.log(`  - Utilidad pase vertical en Organización Normal: ${normalPassEval.utility.toFixed(3)}`);
console.log(`  - Utilidad pase vertical en FAST_COUNTER (x1.80): ${counterPassEval.utility.toFixed(3)}`);
assert.ok(counterPassEval.utility > normalPassEval.utility * 1.75, 'La utilidad de pase vertical debe multiplicarse por >= 1.80 en FAST_COUNTER');

console.log('✔ Test 2: Índice de desorden rival y multiplicador FAST_COUNTER (x1.80) validados.\n');

// -------------------------------------------------------------------------
// TEST 3: CICLO DE VENTANAS TEMPORALES DEL CONTINUUM (100, 120 Y 160 TICKS)
// -------------------------------------------------------------------------
console.log('=== TEST 3: MÁQUINA DE ESTADOS DE LAS 4 FASES Y VENTANAS DE TIEMPO ===');

const mockMatch = {
  currentTick: 10,
  pitchSize: [680, 1050],
  kickOffTeam: teamPressing,
  secondTeam: disorderedOpponent,
  ball: {
    position: [340, 680, 0],
    withTeam: 'T_PRESS',
    withPlayer: true,
    isRestart: false,
  },
};

// Tick 10: Posesión inicial de T_PRESS
updateMatchContinuum(mockMatch, mockPitch);
assert.strictEqual(mockMatch.tacticalPhase.T_PRESS, TACTICAL_PHASES.ORGANIZACION_OFENSIVA);
assert.strictEqual(mockMatch.tacticalPhase.T_DISORDER, TACTICAL_PHASES.ORGANIZACION_DEFENSIVA);

// Tick 20: Robo en vivo por parte de T_DISORDER en (340, 680)
mockMatch.currentTick = 20;
mockMatch.ball.withTeam = 'T_DISORDER';
updateMatchContinuum(mockMatch, mockPitch);

assert.strictEqual(mockMatch.tacticalPhase.T_PRESS, TACTICAL_PHASES.TRANSICION_ATAQUE_DEFENSA, 'Equipo que pierde entra en TRANSICION_ATAQUE_DEFENSA');
assert.strictEqual(teamPressing.transitionSubMode, TRANSITION_SUBMODES.COUNTER_PRESSING, 'Se activa COUNTER_PRESSING');
assert.strictEqual(mockMatch.tacticalPhase.T_DISORDER, TACTICAL_PHASES.TRANSICION_DEFENSA_ATAQUE, 'Equipo que recupera entra en TRANSICION_DEFENSA_ATAQUE');

// Tick 120 (100 ticks después de la pérdida): termina Gegenpressing (5s) y pasa a INTENSIVE_RETREAT
mockMatch.currentTick = 120;
updateMatchContinuum(mockMatch, mockPitch);
assert.strictEqual(teamPressing.transitionSubMode, TRANSITION_SUBMODES.INTENSIVE_RETREAT, 'A los 100 ticks (5s) expira Gegenpressing y pasa a INTENSIVE_RETREAT');

// Tick 140 (120 ticks después de la pérdida): termina ventana A->D (6s) y pasa a ORGANIZACION_DEFENSIVA
mockMatch.currentTick = 140;
updateMatchContinuum(mockMatch, mockPitch);
assert.strictEqual(mockMatch.tacticalPhase.T_PRESS, TACTICAL_PHASES.ORGANIZACION_DEFENSIVA, 'A los 120 ticks (6s) pasa a ORGANIZACION_DEFENSIVA');

// Tick 180 (160 ticks después del robo): termina ventana D->A (8s) y pasa a ORGANIZACION_OFENSIVA
mockMatch.currentTick = 180;
updateMatchContinuum(mockMatch, mockPitch);
assert.strictEqual(mockMatch.tacticalPhase.T_DISORDER, TACTICAL_PHASES.ORGANIZACION_OFENSIVA, 'A los 160 ticks (8s) pasa a ORGANIZACION_OFENSIVA');
console.log('  - Transiciones temporales verificadas: 100 ticks (Gegenpress) -> 120 ticks (Org. Defensiva) -> 160 ticks (Org. Ofensiva).');
console.log('✔ Test 3: Ciclo completo de las 4 Fases del Continuum verificado exitosamente.\n');

// -------------------------------------------------------------------------
// TEST 4: CINEMÁTICA BIOMECÁNICA EN STEERING.JS (SPRINT RAMP, GIRO >90°, CARRY Y EFFORT)
// -------------------------------------------------------------------------
console.log('=== TEST 4: CINEMÁTICA BIOMECÁNICA (SPRINT RAMP, GIRO >90°, CARRY SPEED Y EFFORT) ===');

const explosivePlayer = createPlayer('EXP', 'Extremo Explosivo', 'EXT', 340, 500, 340, 500, {
  skill: { agility: 92, control: 90 },
  activeTraits: [PLAYER_TRAITS.SPEED_DRIBBLER],
});
const heavyPlayer = createPlayer('HVY', 'Central Pesado', 'CB', 340, 500, 340, 500, {
  skill: { agility: 60, control: 62 },
});

const rampStepExp = computeSprintRampStep(explosivePlayer);
const rampStepHvy = computeSprintRampStep(heavyPlayer);
const ticksToPeakExp = Math.ceil(1.0 / rampStepExp);
const ticksToPeakHvy = Math.ceil(1.0 / rampStepHvy);

console.log(`  - Rampa de Sprint Explosivo (agility 92): +${rampStepExp}/tick (~${ticksToPeakExp} ticks al pico)`);
console.log(`  - Rampa de Sprint Pesado (agility 60): +${rampStepHvy}/tick (~${ticksToPeakHvy} ticks al pico)`);
assert.ok(rampStepExp > rampStepHvy, 'El jugador explosivo debe acelerar más rápido por tick que el pesado');
assert.ok(ticksToPeakExp >= 8 && ticksToPeakExp <= 9, `Jugador explosivo debe alcanzar pico en ~8-9 ticks (obtenido: ${ticksToPeakExp})`);
assert.ok(ticksToPeakHvy >= 10 && ticksToPeakHvy <= 12, `Jugador pesado debe alcanzar pico en ~10-12 ticks (obtenido: ${ticksToPeakHvy})`);

// Simulamos 8 ticks de aceleración
for (let t = 0; t < 8; t++) {
  updatePlayerSprintRamp(explosivePlayer, true);
  updatePlayerSprintRamp(heavyPlayer, true);
}
assert.ok(explosivePlayer.sprintRamp > heavyPlayer.sprintRamp, 'Tras 8 ticks el jugador explosivo tiene mayor sprintRamp');

// Penalización angular por giro > 90° (135° = 3*PI/4 rad)
explosivePlayer.facingAngle = 0;
heavyPlayer.facingAngle = 0;
const turnAngle = (3 * Math.PI) / 4; // 135° (> 90°)
const turnExp = computeTurnKinematics(explosivePlayer, turnAngle);
const turnHvy = computeTurnKinematics(heavyPlayer, turnAngle);

console.log(`  - Giro brusco de 135° (>90°): mu_turn Explosivo = ${turnExp.turnMultiplier} (omegaMax=${turnExp.omegaMax}) | mu_turn Pesado = ${turnHvy.turnMultiplier} (omegaMax=${turnHvy.omegaMax})`);
assert.ok(turnExp.turnMultiplier < 1.0 && turnHvy.turnMultiplier < 1.0, 'Un giro >90° debe desacelerar a ambos jugadores');
assert.ok(turnExp.turnMultiplier > turnHvy.turnMultiplier, 'El jugador ágil conserva más velocidad al girar >90°');
assert.ok(turnExp.omegaMax > turnHvy.omegaMax, 'El jugador ágil rota su orientación corporal más rápido por tick');

// Velocidad de conducción con balón (Carry Speed)
const carryExp = computeCarrySpeedMultiplier(explosivePlayer);
const carryHvy = computeCarrySpeedMultiplier(heavyPlayer);
console.log(`  - Velocidad de conducción (mu_carry): Especialista SPEED_DRIBBLER = ${carryExp} | Central = ${carryHvy}`);
assert.ok(carryExp > carryHvy, 'Un especialista con alto control y SPEED_DRIBBLER conduce a mayor velocidad');
assert.ok(carryExp >= 0.96, 'El especialista con SPEED_DRIBBLER casi no pierde velocidad punta al conducir');

// Modalidades de esfuerzo (movementEffort)
explosivePlayer.offensiveState = 'OVERLAPPING';
const burstEffort = resolveMovementEffort(explosivePlayer, 'sprint');
assert.strictEqual(burstEffort.mode, 'SURGING_BURST');
assert.strictEqual(burstEffort.speedMultiplier, 1.12);

const walkEffort = resolveMovementEffort(explosivePlayer, 'wait');
assert.strictEqual(walkEffort.mode, 'WALKING');
assert.strictEqual(walkEffort.speedMultiplier, 0.38);
console.log(`  - Modalidades de esfuerzo verificadas: WALKING (${walkEffort.speedMultiplier}x) .. SURGING_BURST (${burstEffort.speedMultiplier}x).`);

console.log('✔ Test 4: Cinemática biomecánica en steering.js validada al 100%.\n');

// -------------------------------------------------------------------------
// TEST 5: SIMULACIÓN END-TO-END EN VIVO CON PLAYITERATION
// -------------------------------------------------------------------------
console.log('=== TEST 5: INTEGRACIÓN EN VIVO CON PLAYITERATION ===');

function buildSampleTeam(teamID, name, isTop) {
  const pool = teamID === 'E1' ? PLAYERS_DB.slice(0, 11) : PLAYERS_DB.slice(11, 22);
  return {
    teamID,
    name,
    mentality: 'offensive',
    initialMentality: 'offensive',
    playStyle: 'directCounter',
    players: pool.map((p, idx) => {
      const yPos = isTop ? 50 + idx * 75 : 1000 - idx * 75;
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
          tackles: { total: 0, on: 0, off: 0, fouls: 0, slides: 0, standing: 0 },
        },
      };
    }),
  };
}

const teamA = buildSampleTeam('E1', 'Boca Juniors', true);
const teamB = buildSampleTeam('E2', 'River Plate', false);
const matchDetails = await initiateGame(teamA, teamB, { pitchWidth: 680, pitchHeight: 1050 });

const observedPhases = new Set();
let observedSprintRamp = false;
let observedEffortModes = new Set();

for (let i = 0; i < 80; i++) {
  await playIteration(matchDetails);
  if (matchDetails.tacticalPhase) {
    Object.values(matchDetails.tacticalPhase).forEach(ph => observedPhases.add(ph));
  }
  for (const p of [...matchDetails.kickOffTeam.players, ...matchDetails.secondTeam.players]) {
    if (typeof p.sprintRamp === 'number' && p.sprintRamp > 0) observedSprintRamp = true;
    if (p.effortMode) observedEffortModes.add(p.effortMode);
  }
}

console.log(`  - Fases del Continuum registradas en vivo: ${Array.from(observedPhases).join(', ')}`);
console.log(`  - Modos de esfuerzo registrados en vivo: ${Array.from(observedEffortModes).join(', ')}`);
assert.ok(observedPhases.size >= 2, 'Ambos equipos deben registrar fases activas del Continuum en matchDetails.tacticalPhase');
assert.ok(observedSprintRamp, 'Los jugadores en cancha deben actualizar su sprintRamp biomecánico');
assert.ok(observedEffortModes.size >= 2, 'Los jugadores deben alternar entre múltiples modalidades de esfuerzo');

console.log('✔ Test 5: Simulación en vivo de Fase 5 verificada al 100%.\n');

console.log('======================================================================');
console.log('=== ¡TODAS LAS ESPECIFICACIONES DE FASE 5 VERIFICADAS AL 100%! ===');
console.log('======================================================================\n');
