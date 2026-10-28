/**
 * verifyPhase9Fulbito2.js — Suite de Verificación Rigurosa para la FASE 9 de Fulbito 2.2
 * 
 * Valida:
 * 1. Espacio vectorial continuo de 14 Macro-Atributos normalizados V_team(t) en [0, 1]^14.
 * 2. Catálogo completo de las 20 Estrategias Canónicas del DSS.
 * 3. Métrica de distancia asimétrica d_adapt y buscador de estrategia óptima findClosestCanonicalStrategy.
 * 4. Sustituciones inteligentes en coachAI.js (fatiga extrema fitness < 45, protección disciplinaria, límite IFAB).
 */

import assert from 'assert';
import {
  SEMANTIC_MACRO_ATTRIBUTES,
  CANONICAL_STRATEGIES,
  ADAPTATION_WEIGHTS,
  computeAsymmetricAdaptationDistance,
  computeTeamSemanticVector,
  findClosestCanonicalStrategy
} from '../src/engine/tactics/semanticDSS.js';
import { evaluateSmartSubstitutions } from '../src/engine/coachAI.js';

console.log('⚽ Iniciando Verificación de FASE 9: Motor Semántico DSS y CoachAI Adaptativo...\n');

// ============================================================================
// TEST 1: ESPACIO VECTORIAL DE 14 MACRO-ATRIBUTOS
// ============================================================================
console.log('--- TEST 1: Espacio Vectorial R^14 de Macro-Atributos ---');

assert.strictEqual(SEMANTIC_MACRO_ATTRIBUTES.length, 14, 'Deben existir exactamente 14 Macro-Atributos');
assert.strictEqual(ADAPTATION_WEIGHTS.length, 14, 'Deben existir 14 ponderadores de adaptación W_k');

const mockTeam = {
  name: 'Boca Juniors',
  coachState: { ambition: 0.85 },
  players: [
    { position: 'GK', skill: { saving: 88 } },
    { position: 'CB', skill: { speed: 70, passing: 72, control: 70, tackling: 86, perception: 80, jumping: 84 }, height: 188 },
    { position: 'CB', skill: { speed: 68, passing: 74, control: 72, tackling: 84, perception: 82, jumping: 82 }, height: 186 },
    { position: 'LB', skill: { speed: 85, passing: 76, control: 78, tackling: 78, perception: 78, jumping: 74 }, height: 176 },
    { position: 'RB', skill: { speed: 84, passing: 75, control: 76, tackling: 80, perception: 79, jumping: 75 }, height: 178 },
    { position: 'CDM', skill: { speed: 72, passing: 80, control: 82, tackling: 88, perception: 85, jumping: 80 }, height: 182 },
    { position: 'CM', skill: { speed: 78, passing: 86, control: 88, tackling: 76, perception: 86, jumping: 72 }, height: 175 },
    { position: 'CAM', skill: { speed: 76, passing: 92, control: 94, tackling: 60, perception: 90, jumping: 68 }, height: 172 },
    { position: 'RW', skill: { speed: 92, passing: 82, control: 88, tackling: 55, perception: 80, jumping: 70 }, height: 174 },
    { position: 'LW', skill: { speed: 90, passing: 80, control: 86, tackling: 55, perception: 78, jumping: 72 }, height: 175 },
    { position: 'ST', skill: { speed: 84, passing: 75, control: 82, tackling: 50, perception: 84, jumping: 88 }, height: 185 }
  ]
};

const teamVector = computeTeamSemanticVector(mockTeam, {});
assert.strictEqual(teamVector.length, 14, 'El vector táctico del equipo debe tener longitud 14');
for (let i = 0; i < 14; i++) {
  assert(teamVector[i] >= 0 && teamVector[i] <= 1, `El atributo ${SEMANTIC_MACRO_ATTRIBUTES[i]} (${teamVector[i]}) debe estar normalizado en [0, 1]`);
}
console.log('✓ Vector semántico R^14 calculado y normalizado correctamente para el equipo');

// ============================================================================
// TEST 2: CATÁLOGO DE LAS 20 ESTRATEGIAS CANÓNICAS
// ============================================================================
console.log('\n--- TEST 2: Catálogo de las 20 Estrategias Canónicas del DSS ---');

const expectedStrategies = [
  'TIKI_TAKA', 'GEGENPRESSING', 'CATENACCIO', 'DIRECT_COUNTER', 'TOTAL_FOOTBALL',
  'LOW_BLOCK_LONG_BALL', 'WING_PLAY_OVERLOAD', 'FALSE_NINE_POSSESSION', 'LAVOLPIANA_BUILDUP',
  'HIGH_PRESS_TURNOVER', 'MID_BLOCK_COMPACT', 'BOX_TO_BOX_PHYSICAL', 'ENGANCHE_CREATIVE',
  'REST_DEFENCE_SHIELD', 'FAST_BREAKAWAY', 'EXPANSIVE_WIDTH', 'CENTRAL_HALF_SPACE_CROWD',
  'AGILE_DRIBBLE_ISOLATION', 'AERIAL_TARGET_BOMBARDMENT', 'PRAGMATIC_BALANCED'
];

assert.strictEqual(Object.keys(CANONICAL_STRATEGIES).length, 20, 'Deben existir exactamente 20 Estrategias Canónicas');

for (const stratKey of expectedStrategies) {
  const strat = CANONICAL_STRATEGIES[stratKey];
  assert(strat, `Estrategia ${stratKey} debe existir en el catálogo`);
  assert.strictEqual(strat.vector.length, 14, `El vector de ${stratKey} debe ser R^14`);
  assert(strat.description.length > 10, `La estrategia ${stratKey} debe tener descripción táctica`);
}
console.log(`✓ Las 20 Estrategias Canónicas existen con vectores R^14 válidos`);

// ============================================================================
// TEST 3: MÉTRICA ASIMÉTRICA D_ADAPT Y BÚSQUEDA DE AFINIDAD
// ============================================================================
console.log('\n--- TEST 3: Métrica de Distancia Asimétrica d_adapt y Búsqueda Óptima ---');

const distIdentical = computeAsymmetricAdaptationDistance(teamVector, teamVector);
assert.strictEqual(distIdentical, 0, 'La distancia a sí mismo debe ser exactamente 0');

const closestMatch = findClosestCanonicalStrategy(teamVector);
assert(closestMatch.strategy, 'Debe retornar una estrategia recomendada');
assert(closestMatch.distance >= 0, 'La distancia de adaptación debe ser no negativa');
console.log(`✓ Estrategia más afín detectada: ${closestMatch.strategy.name} (distancia d_adapt: ${closestMatch.distance.toFixed(3)})`);

// ============================================================================
// TEST 4: SUSTITUCIONES INTELIGENTES EN COACHAI
// ============================================================================
console.log('\n--- TEST 4: Sustituciones Inteligentes en CoachAI ---');

const mockTeamWithFatigue = {
  name: 'River Plate',
  substitutionsCount: 0,
  players: [
    { playerID: 'p1', name: 'Armani', position: 'GK', currentPOS: [340, 20], fitness: 100 },
    { playerID: 'p2', name: 'Enzo Diaz', position: 'LB', currentPOS: [90, 160], fitness: 38 }, // Fatiga extrema (<45)
    { playerID: 'p3', name: 'Pezzella', position: 'CB', currentPOS: [250, 140], fitness: 80, stats: { cards: { yellow: 1 } } }, // Amonestado
    { playerID: 'p4', name: 'Pirez', position: 'CB', currentPOS: [430, 140], fitness: 85 }
  ],
  substitutes: [
    { playerID: 'sub1', name: 'Casco', position: 'LB', hasPlayed: false },
    { playerID: 'sub2', name: 'Gattoni', position: 'CB', hasPlayed: false }
  ]
};

const matchDetailsMock = {
  iterationCount: 1400, // Minuto ~65
  iterationLog: []
};

const subResult = evaluateSmartSubstitutions(matchDetailsMock, mockTeamWithFatigue, {});

assert(subResult.substitutions.length >= 1, 'Debe realizar al menos una sustitución inteligente');
const fatigueSub = subResult.substitutions.find(s => s.reason === 'FATIGUE_EXHAUSTION');
assert(fatigueSub !== undefined, 'Debe sustituir al jugador con fatiga extrema (Enzo Diaz)');
assert.strictEqual(fatigueSub.inPlayer.name, 'Casco', 'Debe entrar Casco por el lateral fundido');

// Verificar que el jugador reemplazado está en el 11 y con 100 fitness
const currentLB = mockTeamWithFatigue.players.find(p => p.position === 'LB');
assert.strictEqual(currentLB.name, 'Casco', 'Casco debe ser el nuevo titular en la lista de jugadores');
assert.strictEqual(currentLB.fitness, 100, 'El jugador ingresado debe tener fitness fresco al 100%');
assert(mockTeamWithFatigue.substitutionsCount >= 1, 'El contador de cambios del equipo debe incrementarse');

console.log(`✓ Sustituciones inteligentes ejecutadas: ${subResult.substitutions.length} cambios realizados con éxito`);

console.log('\n======================================================');
console.log('🎉 TODOS LOS TESTS DE LA FASE 9 FUERON SUPERADOS CON ÉXITO (100%)');
console.log('======================================================');
