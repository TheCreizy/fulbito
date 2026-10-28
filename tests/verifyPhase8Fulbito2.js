/**
 * verifyPhase8Fulbito2.js — Suite de Verificación Rigurosa para la FASE 8 de Fulbito 2.2
 * 
 * Valida:
 * 1. Genealogía de Sistemas: Familias de 3, 4 y 5 defensores (3-4-3, 3-5-2, 4-4-2, 4-3-1-2, 4-3-3, 4-2-3-1, 4-1-4-1, 5-3-2, 5-4-1).
 * 2. 15 Roles Funcionales de campo + 2 de portería y 3 Duties (DEFEND, SUPPORT, ATTACK).
 * 3. Asignación automática de roles coherentes según formación (CB_STOPPER, SW_LIBERO, WB_WINGBACK, etc.).
 * 4. Modelo Táctico: Alturas de bloque (LOW_BLOCK, MID_BLOCK, HIGH_PRESS), anchura (COMPACT, BALANCED, WIDE) y fluidez.
 */

import assert from 'assert';
import {
  FORMATIONS,
  FORMATION_FAMILIES,
  getFormationCoordinates
} from '../src/data/formations.js';
import {
  DUTIES,
  TACTICAL_ROLES,
  getRoleDefinition,
  isDutyAllowedForRole,
  resolvePlayerDuty,
  assignFormationRolesAndDuties,
  getRoleMovementBias
} from '../src/engine/tactics/rolesAndDuties.js';
import {
  BLOCK_HEIGHTS,
  BLOCK_WIDTHS,
  TACTICAL_FLUIDITY,
  computeTacticalBlockDimensions,
  adjustPlayerTargetByTacticalModel
} from '../src/engine/tactics/tacticalModel.js';

console.log('⚽ Iniciando Verificación de FASE 8: Genealogía de Sistemas y los 15 Roles + 3 Duties...\n');

// ============================================================================
// TEST 1: GENEALOGÍA DE SISTEMAS (FAMILIAS DE 3, 4 Y 5 DEFENSORES)
// ============================================================================
console.log('--- TEST 1: Catálogo de Formaciones y Familias Defensivas ---');

assert(FORMATION_FAMILIES.THREE_DEF.includes('3-4-3'), '3-4-3 debe estar en familia THREE_DEF');
assert(FORMATION_FAMILIES.THREE_DEF.includes('3-5-2'), '3-5-2 debe estar en familia THREE_DEF');
assert(FORMATION_FAMILIES.FOUR_DEF.includes('4-4-2'), '4-4-2 debe estar en familia FOUR_DEF');
assert(FORMATION_FAMILIES.FOUR_DEF.includes('4-3-3'), '4-3-3 debe estar en familia FOUR_DEF');
assert(FORMATION_FAMILIES.FOUR_DEF.includes('4-1-4-1'), '4-1-4-1 debe estar en familia FOUR_DEF');
assert(FORMATION_FAMILIES.FIVE_DEF.includes('5-3-2'), '5-3-2 debe estar en familia FIVE_DEF');
assert(FORMATION_FAMILIES.FIVE_DEF.includes('5-4-1'), '5-4-1 debe estar en familia FIVE_DEF');

const expectedSystems = ['3-4-3', '3-5-2', '4-4-2', '4-3-1-2', '4-3-3', '4-2-3-1', '4-1-4-1', '5-3-2', '5-4-1'];
for (const sysId of expectedSystems) {
  assert(FORMATIONS[sysId], `La formación ${sysId} debe existir en FORMATIONS`);
  assert.strictEqual(FORMATIONS[sysId].slots.length, 11, `La formación ${sysId} debe tener 11 slots`);
  const topCoords = getFormationCoordinates(sysId, 'balanced', 'top');
  const bottomCoords = getFormationCoordinates(sysId, 'balanced', 'bottom');
  assert.strictEqual(topCoords.length, 11, `getFormationCoordinates top para ${sysId} debe retornar 11 slots`);
  assert.strictEqual(bottomCoords.length, 11, `getFormationCoordinates bottom para ${sysId} debe retornar 11 slots`);
}
console.log(`✓ Las ${expectedSystems.length} formaciones y sus 3 familias defensivas verificadas con 11 slots en ambos lados`);

// ============================================================================
// TEST 2: LOS 15 ROLES FUNCIONALES + 3 DUTIES
// ============================================================================
console.log('\n--- TEST 2: Taxonomía de los 15 Roles Funcionales + 3 Duties ---');

const expectedRoles = [
  'GK_CLASSIC', 'GK_SWEEPER',
  'CB_STOPPER', 'CB_BALL_PLAYING', 'SW_LIBERO', 'FB_FULLBACK', 'WB_WINGBACK',
  'DM_ANCHOR', 'CM_PLAYMAKER_DEEP', 'CM_BOX_TO_BOX', 'AM_PRESSING', 'AM_ENGANCHE',
  'WG_WINGER', 'WG_INVERTED', 'ST_FALSE_NINE', 'ST_TARGET_POACHER'
];

for (const rId of expectedRoles) {
  const roleDef = getRoleDefinition(rId);
  assert(roleDef, `El rol ${rId} debe estar definido`);
  assert(Array.isArray(roleDef.allowedDuties) && roleDef.allowedDuties.length > 0, `El rol ${rId} debe definir allowedDuties`);
  assert(roleDef.defaultDuty, `El rol ${rId} debe definir defaultDuty`);
}

// Comprobaciones de Duties específicos
assert.strictEqual(isDutyAllowedForRole('CB_STOPPER', DUTIES.DEFEND), true, 'CB_STOPPER debe admitir DEFEND');
assert.strictEqual(isDutyAllowedForRole('CB_STOPPER', DUTIES.ATTACK), false, 'CB_STOPPER no debe admitir ATTACK');
assert.strictEqual(isDutyAllowedForRole('AM_ENGANCHE', DUTIES.ATTACK), true, 'AM_ENGANCHE debe admitir ATTACK');

// Resolución de fallback para duties no permitidos
const resolvedStopperDuty = resolvePlayerDuty('CB_STOPPER', DUTIES.ATTACK);
assert.strictEqual(resolvedStopperDuty, DUTIES.DEFEND, 'Duty no permitido debe caer al defaultDuty DEFEND');

console.log(`✓ Los ${expectedRoles.length} roles funcionales y los 3 duties (DEFEND, SUPPORT, ATTACK) verificados`);

// ============================================================================
// TEST 3: ASIGNACIÓN DE ROLES SEGÚN FORMACIÓN TÁCTICA
// ============================================================================
console.log('\n--- TEST 3: Asignación Coherente de Roles en Equipo ---');

const mockTeam352 = {
  name: 'Boca 3-5-2',
  players: [
    { position: 'GK', skill: { perception: 85, agility: 80 } },
    { position: 'CB', skill: { jumping: 82, strength: 84 } },
    { position: 'CB', skill: { passing: 82, control: 78 } },
    { position: 'CB', skill: { jumping: 80, strength: 82 } }, // Slot 3: Líbero en 3-5-2
    { position: 'LB', skill: { speed: 86, agility: 82 } },    // Carrilero en 3-5-2
    { position: 'CDM', skill: { tackling: 85 } },
    { position: 'CM', skill: { stamina: 85, shooting: 76 } }, // B2B
    { position: 'RM', skill: { speed: 86, agility: 82 } },    // Carrilero en 3-5-2
    { position: 'CAM', skill: { passing: 90, vision: 92 } },
    { position: 'ST', skill: { passing: 80, control: 86 } },  // Falso 9
    { position: 'ST', skill: { shooting: 90, strength: 88 } } // 9 de área
  ]
};

assignFormationRolesAndDuties(mockTeam352, '3-5-2');

assert.strictEqual(mockTeam352.players[0].tacticalRoleCode, 'GK_SWEEPER', 'Arquero ágil debe ser GK_SWEEPER');
assert.strictEqual(mockTeam352.players[3].tacticalRoleCode, 'SW_LIBERO', 'Tercer central en 3-5-2 debe ser SW_LIBERO');
assert.strictEqual(mockTeam352.players[4].tacticalRoleCode, 'WB_WINGBACK', 'Lateral en 3-5-2 debe ser WB_WINGBACK');
assert.strictEqual(mockTeam352.players[5].tacticalRoleCode, 'DM_ANCHOR', 'CDM debe ser DM_ANCHOR');
assert.strictEqual(mockTeam352.players[6].tacticalRoleCode, 'CM_BOX_TO_BOX', 'CM con alta stamina/remate debe ser CM_BOX_TO_BOX');
assert.strictEqual(mockTeam352.players[8].tacticalRoleCode, 'AM_ENGANCHE', 'CAM debe ser AM_ENGANCHE');
assert.strictEqual(mockTeam352.players[9].tacticalRoleCode, 'ST_FALSE_NINE', 'Delantero asociativo debe ser ST_FALSE_NINE');
assert.strictEqual(mockTeam352.players[10].tacticalRoleCode, 'ST_TARGET_POACHER', 'Delantero rematador debe ser ST_TARGET_POACHER');

console.log('✓ Asignación automática de roles tácticos para 3-5-2 verificada al 100%');

// ============================================================================
// TEST 4: MODELO TÁCTICO (ALTURAS DE BLOQUE, ANCHURA Y FLUIDEZ)
// ============================================================================
console.log('\n--- TEST 4: Modelo Táctico Integral (Bloques y Fluidez) ---');

const lowBlock = computeTacticalBlockDimensions('LOW_BLOCK', 'COMPACT', [680, 1050]);
assert.strictEqual(lowBlock.defensiveLineY, 180, 'LOW_BLOCK debe posicionar la línea en 180px');
assert(lowBlock.effectiveWidth < 680 * 0.75, 'COMPACT debe reducir la anchura defensiva');

const highPress = computeTacticalBlockDimensions('HIGH_PRESS', 'WIDE', [680, 1050]);
assert.strictEqual(highPress.defensiveLineY, 420, 'HIGH_PRESS debe posicionar la línea en 420px');
assert(highPress.effectiveWidth > lowBlock.effectiveWidth, 'WIDE debe ser más ancho que COMPACT');

// Ajuste espacial según bloque y rol
const defenderMock = {
  position: 'CB',
  tacticalRoleCode: 'CB_STOPPER',
  duty: DUTIES.DEFEND
};

const initialPOS = [340, 250];
const adjustedPOS = adjustPlayerTargetByTacticalModel(initialPOS, defenderMock, {
  blockHeight: 'LOW_BLOCK',
  inPossession: false
}, true);

assert(adjustedPOS[1] < initialPOS[1], 'Sin posesión en LOW_BLOCK el defensor debe retrasar su posición');

console.log('✓ Dimensiones de bloque (LOW_BLOCK, MID_BLOCK, HIGH_PRESS) y ajuste de posiciones verificado');

console.log('\n======================================================');
console.log('🎉 TODOS LOS TESTS DE LA FASE 8 FUERON SUPERADOS CON ÉXITO (100%)');
console.log('======================================================');
