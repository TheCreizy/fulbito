/**
 * duelEvaluator.js — Evaluación de Duelo 1v1, Regate, Finta y Cambio de Ritmo
 * 
 * Implementa la especificación de Fase 7 (7.3) de Fulbito 2.2:
 * - Duelo de regate y evasión de marca en 1v1 (especialmente en Z13-Z18).
 * - Vector de finta y cambio de ritmo (35° a 55° hacia perfil débil, half-space o línea de fondo).
 * - Confrontación: (control + agility + traits) vs (agility + perception + tackling).
 * - En caso de éxito del atacante: deja al defensor clavado con interceptCooldown = 25 ticks
 *   y abre ángulo limpio de centro / disparo / cutback.
 */

import { getEffectiveSkill, hasTrait } from '../player/effectiveSkill.js';

function getPos(entity) {
  if (!entity) return { x: 0, y: 0 };
  if (Array.isArray(entity.currentPOS)) return { x: entity.currentPOS[0], y: entity.currentPOS[1] };
  return { x: entity.x ?? 0, y: entity.y ?? 0 };
}

function getVel(entity) {
  if (!entity) return { vx: 0, vy: 0 };
  if (Array.isArray(entity.velocity)) return { vx: entity.velocity[0], vy: entity.velocity[1] };
  return { vx: entity.vx ?? 0, vy: entity.vy ?? 0 };
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Evalúa si el portador del balón debe intentar un regate 1v1 en su situación actual
 * 
 * @param {Object} attacker - Jugador con balón
 * @param {Object} defender - Defensor más cercano en duelo
 * @param {Object} context - { isInsidePenaltyBox, zoneId, targetGoalY }
 * @returns {boolean}
 */
export function shouldAttemptDribble(attacker, defender, context = {}) {
  if (!attacker || !defender) return false;
  if ((defender.interceptCooldown || 0) > 0) return true; // Defensor ya superado o retrasado

  const attSkill = (getEffectiveSkill(attacker, 'control') + getEffectiveSkill(attacker, 'agility')) / 2;
  const isDribbler = hasTrait(attacker, 'SPEED_DRIBBLER') || hasTrait(attacker, 'FLAIR') || attSkill >= 0.76;

  // En el último tercio (Z13-Z18) o dentro del área, mayor inclinación al 1v1
  const isHighDangerZone = context.isInsidePenaltyBox || (context.zoneId && context.zoneId >= 13);
  return isDribbler || isHighDangerZone;
}

/**
 * Resuelve el duelo de regate 1v1 con finta biomecánica y cambio de ritmo
 * 
 * @param {Object} attacker - Atacante portador
 * @param {Object} defender - Defensor en marcaje/jockey
 * @param {Object} options - { pitchSize, rng, attackDirectionY }
 * @returns {{
 *   success: boolean,
 *   outcome: string,
 *   feintAngleRad: number,
 *   feintAngleDeg: number,
 *   feintVector: { vx: number, vy: number },
 *   defenderCooldown: number,
 *   margin: number
 * }}
 */
export function evaluateDribbleDuel1v1(attacker, defender, options = {}) {
  const rng = options.rng || Math.random;
  const attPos = getPos(attacker);
  const defPos = getPos(defender);
  const attVel = getVel(attacker);

  const attControl = getEffectiveSkill(attacker, 'control');
  const attAgility = getEffectiveSkill(attacker, 'agility');
  const attSpeed = getEffectiveSkill(attacker, 'speed');

  const defAgility = getEffectiveSkill(defender, 'agility');
  const defPerception = getEffectiveSkill(defender, 'perception');
  const defTackling = getEffectiveSkill(defender, 'tackling');

  // Rasgos tácticos y técnicos
  const dribblerBonus = (hasTrait(attacker, 'SPEED_DRIBBLER') || hasTrait(attacker, 'FLAIR')) ? 0.12 : 0;
  const ballWinnerBonus = hasTrait(defender, 'BALL_WINNER') ? 0.08 : 0;

  // Puntuación de evasión vs contención
  const attackerScore = 0.50 * attControl + 0.35 * attAgility + 0.15 * attSpeed + dribblerBonus;
  const defenderScore = 0.40 * defAgility + 0.35 * defPerception + 0.25 * defTackling + ballWinnerBonus;

  // Ángulo de finta biomecánica: entre 35° y 55° (0.61 a 0.96 radianes)
  // Orientado hacia el perfil libre o el Half-Space
  const baseAngleDeg = 35 + rng() * 20; // 35° a 55°
  const attackDirY = options.attackDirectionY ?? (attPos.y < 525 ? 1 : -1);
  const evadeTowardsRight = attPos.x < defPos.x ? false : true;
  const sign = evadeTowardsRight ? 1 : -1;
  const feintAngleRad = (baseAngleDeg * Math.PI / 180) * sign;

  const margin = attackerScore - defenderScore + (rng() - 0.5) * 0.18;

  if (margin >= 0) {
    // ATACANTE GANA EL DUELO: Desborda o quiebra la cintura del defensor
    // Se deja al defensor clavado con interceptCooldown = 25 ticks
    defender.interceptCooldown = 25;
    defender.tackleCooldown = Math.max(defender.tackleCooldown || 0, 16);
    if (defender.speedModifier !== undefined) {
      defender.speedModifier = 0.55;
    }

    // Vector de aceleración en finta
    const burstSpeed = (attSpeed * 2.5 + 2.2);
    const feintVector = {
      vx: Math.sin(feintAngleRad) * burstSpeed,
      vy: Math.cos(feintAngleRad) * burstSpeed * (attackDirY > 0 ? 1 : -1)
    };

    attacker.feintMomentum = 1.25;

    return {
      success: true,
      outcome: 'DRIBBLE_SUCCESS',
      feintAngleRad,
      feintAngleDeg: baseAngleDeg * sign,
      feintVector,
      defenderCooldown: 25,
      attackerScore,
      defenderScore,
      margin
    };
  } else {
    // DEFENSOR CONTIENE O RECUPERA
    const tackleMargin = defenderScore - attackerScore;
    let outcome = 'DRIBBLE_STOPPED';

    if (tackleMargin > 0.15) {
      outcome = 'CLEAN_TACKLE';
      defender.interceptCooldown = 0;
      attacker.interceptCooldown = 10;
    } else {
      outcome = 'DELAY_JOCKEY';
      attacker.speedModifier = 0.70;
    }

    return {
      success: false,
      outcome,
      feintAngleRad,
      feintAngleDeg: baseAngleDeg * sign,
      feintVector: { vx: 0, vy: 0 },
      defenderCooldown: 0,
      attackerScore,
      defenderScore,
      margin
    };
  }
}
