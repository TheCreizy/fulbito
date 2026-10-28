/**
 * ballContest25D.js — Disputas Aéreas 2.5D y Atajada Balística Tridimensional
 * 
 * Implementa la especificación de Fase 7 de Fulbito 2.2:
 * 1. resolveAerialDuel: Salto de cabeza cuando 8 px <= z <= 42 px en radio de 24 px del landingPoint.
 * 2. resolveGoalkeeperSave25D: Atajada 2.5D con Reach_XY, Reach_Z, screened shot, split-step
 *    y 3 resultados: CLEAN_CATCH, PARRY_SAFE y REBOUND_DANGER.
 */

import { getEffectiveSkill, hasTrait } from '../player/effectiveSkill.js';
import { syncBallState } from './ballPhysics.js';

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
 * Calcula el puntaje aéreo de un jugador según la fórmula 7.1 de Fulbito 2.2:
 * S_aerial = 0.35 * h_hat + 0.35 * jumping + 0.20 * strength + 0.10 * perception + Bonus_carrera
 * 
 * @param {Object} player 
 * @param {Object} ballPos 
 * @param {boolean} isMovingTowardsBall 
 * @returns {number}
 */
export function computeAerialScore(player, ballPos, isMovingTowardsBall = false) {
  if (!player) return 0;

  const rawHeight = Number(player.height) || 180;
  const hHat = clamp((rawHeight - 165) / 35, 0.10, 1.0);

  const jumping = getEffectiveSkill(player, 'jumping');
  const strength = getEffectiveSkill(player, 'strength');
  const perception = getEffectiveSkill(player, 'perception');

  // Bonus de carrera: +0.08 si ataca el balón en movimiento frontal
  let bonusCarrera = 0;
  if (isMovingTowardsBall) {
    bonusCarrera = 0.08;
  } else {
    const pPos = getPos(player);
    const pVel = getVel(player);
    const speed = Math.hypot(pVel.vx, pVel.vy);
    if (speed > 0.8) {
      const toBallX = (ballPos.x ?? ballPos[0] ?? 0) - pPos.x;
      const toBallY = (ballPos.y ?? ballPos[1] ?? 0) - pPos.y;
      const dist = Math.hypot(toBallX, toBallY) || 1;
      const dot = (pVel.vx / speed) * (toBallX / dist) + (pVel.vy / speed) * (toBallY / dist);
      if (dot > 0.4) {
        bonusCarrera = 0.08;
      }
    }
  }

  // Trait bonus
  const traitBonus = hasTrait(player, 'TARGET_MAN') || hasTrait(player, 'AERIAL_THREAT') ? 0.06 : 0;

  return 0.35 * hHat + 0.35 * jumping + 0.20 * strength + 0.10 * perception + bonusCarrera + traitBonus;
}

/**
 * 7.1. Duelo Aéreo de Cabezazo
 * Se activa cuando el balón está en fase descendente con 8 px <= z <= 42 px y ambos convergen en radio 24 px.
 * 
 * @param {Object} attacker - Jugador atacante
 * @param {Object} defender - Jugador defensor
 * @param {Object} ball - Objeto balón
 * @param {Object} options - { goalTargetY, rng, teammates }
 * @returns {{ winner: Object, loser: Object, outcome: string, actionType: string, targetPOS?: number[] }}
 */
export function resolveAerialDuel(attacker, defender, ball, options = {}) {
  syncBallState(ball);
  const rng = options.rng || Math.random;
  const goalTargetY = options.goalTargetY ?? 0;

  const ballPos = { x: ball.x, y: ball.y, z: ball.z };
  const attPos = getPos(attacker);
  const defPos = getPos(defender);

  const distAtt = Math.hypot(ballPos.x - attPos.x, ballPos.y - attPos.y);
  const distDef = Math.hypot(ballPos.x - defPos.x, ballPos.y - defPos.y);

  const scoreAtt = computeAerialScore(attacker, ballPos, distAtt <= 14);
  const scoreDef = computeAerialScore(defender, ballPos, distDef <= 14);

  // Margen estocástico ligero (+/- 0.08)
  const margin = scoreAtt - scoreDef + (rng() - 0.5) * 0.16;

  if (margin >= 0) {
    // GANA ATACANTE
    const distToGoal = Math.abs(attPos.y - goalTargetY);
    const isNearGoal = distToGoal < 220; // Zona de remate (Z16, Z17, Z18)

    if (isNearGoal) {
      // Remate de cabeza al arco
      return {
        winner: attacker,
        loser: defender,
        outcome: 'ATTACKER_HEADER_WIN',
        actionType: 'HEADER_SHOT',
        scoreAtt,
        scoreDef,
        margin
      };
    } else {
      // Peinada / bajada (Flick-on / Knock-down) hacia compañero en Z14/Z17
      return {
        winner: attacker,
        loser: defender,
        outcome: 'ATTACKER_HEADER_WIN',
        actionType: 'FLICK_ON',
        scoreAtt,
        scoreDef,
        margin
      };
    }
  } else {
    // GANA DEFENSOR: Despeje alto y orientado a bandas
    const clearToRight = defPos.x > 340;
    const targetX = clearToRight ? 580 : 100; // Despeje a bandas laterales
    const targetY = defPos.y > 525 ? defPos.y - 180 : defPos.y + 180;

    return {
      winner: defender,
      loser: attacker,
      outcome: 'DEFENDER_CLEAR_WIN',
      actionType: 'DEFENSIVE_CLEARANCE_WIDE',
      targetPOS: [targetX, targetY],
      scoreAtt,
      scoreDef,
      margin
    };
  }
}

/**
 * 7.2. Atajada Balística 2.5D y Control de Rebotes
 * Evalúa estirada tridimensional (Reach_XY, Reach_Z) con screened shot, split-step y 3 salidas:
 * - CLEAN_CATCH: blocaje seguro sin rebote
 * - PARRY_SAFE: desvío seguro a córner o banda
 * - REBOUND_DANGER: rebote corto disputable en Z17
 * 
 * @param {Object} goalie - Arquero
 * @param {Object} ball - Balón
 * @param {number} shotPower - Potencia del remate
 * @param {Object} options - { screenedShot, hasSplitStep, isOneOnOne, rng }
 * @returns {{ outcome: string, reachXY: number, reachZ: number, reboundBall?: Object }}
 */
export function resolveGoalkeeperSave25D(goalie, ball, shotPower = 65, options = {}) {
  syncBallState(ball);
  const rng = options.rng || Math.random;

  const saving = getEffectiveSkill(goalie, 'saving');
  const agility = getEffectiveSkill(goalie, 'agility');
  const jumping = getEffectiveSkill(goalie, 'jumping');
  const perception = getEffectiveSkill(goalie, 'perception');
  const rawHeight = Number(goalie.height) || 188;
  const heightFactor = clamp((rawHeight - 170) / 30, 0.2, 1.0);

  // Visión tapada por tráfico (screened shot)
  const trafficScreenPenalty = options.screenedShot ? 0.22 : 0;
  // Bonificación por Split-Step activo (+15%)
  const splitStepBonus = (options.hasSplitStep || goalie.fsm?.currentState === 'GK_SPLIT_STEP') ? 0.15 : 0;

  // Cálculo de Reach tridimensional en píxeles (escala 10px = 1m)
  // Reach_XY: Envergadura y estirada lateral horizontal (típicamente 22px a 38px)
  const reachXY = (18 + 14 * agility + 10 * heightFactor) * (1 + splitStepBonus - trafficScreenPenalty);
  // Reach_Z: Altura máxima alcanzada en salto con brazos extendidos (típicamente 26px a 46px)
  const reachZ = (22 + 16 * jumping + 12 * heightFactor) * (1 + splitStepBonus);

  // Calidad de la estirada y blocaje
  const effectiveSavingScore = (0.45 * saving + 0.25 * agility + 0.15 * jumping + 0.15 * perception)
    * (1 + splitStepBonus - trafficScreenPenalty);

  const normalizedPower = clamp(shotPower / 100, 0.4, 1.5);

  // Distribución trifurcada balística de Open Football modulada por efectividad del arquero:
  // - PARRY_SAFE: ~36% (desvío a córner)
  // - REBOUND_DANGER: ~30% (rebote vivo en Z17)
  // - CLEAN_CATCH: ~34% (embolse limpio y retención)
  const baseParry = 0.36 + (options.screenedShot ? 0.10 : 0);
  const skillAdvantage = (effectiveSavingScore - normalizedPower);
  const baseRebound = 0.30 + (options.isOneOnOne ? 0.12 : 0) - skillAdvantage * 0.25;

  const clampedParry = Math.max(0.20, Math.min(0.48, baseParry));
  const clampedRebound = Math.max(0.20, Math.min(0.48, baseRebound));

  const roll = rng();

  if (roll < clampedParry) {
    // 1. PARRY_SAFE: Desvío seguro a córner o línea de fondo
    const deflectAngle = (rng() < 0.5 ? -1 : 1) * (0.8 + rng() * 0.4);
    ball.vx = (ball.vx || 2) * 0.5 + Math.cos(deflectAngle) * 5;
    ball.vy = Math.sin(deflectAngle) * 4;
    ball.vz = 1.2 + rng() * 1.5;
    ball.z = Math.min(ball.z + 2, reachZ);
    return {
      outcome: 'PARRY_SAFE',
      reachXY,
      reachZ,
      effectiveSavingScore,
      description: 'Mano salvadora: desvío seguro a córner o costado'
    };
  } else if (roll < clampedParry + clampedRebound) {
    // 2. REBOUND_DANGER: Remate violento o insuficiente blocaje -> rebote disputable en Z17
    ball.ownerId = null;
    ball.withPlayer = false;
    ball.Player = null;
    const reboundDirY = (ball.y < 525) ? 1 : -1;
    ball.vx = (rng() - 0.5) * 4.0;
    ball.vy = reboundDirY * (2.0 + rng() * 3.5);
    ball.vz = 0.5 + rng() * 1.2;
    ball.z = 1.5;
    return {
      outcome: 'REBOUND_DANGER',
      reachXY,
      reachZ,
      effectiveSavingScore,
      description: 'Rebote vivo en el área chica que activa disputa inmediata'
    };
  } else {
    // 3. CLEAN_CATCH: Remate contenido y embolsado limpiamente
    ball.ownerId = goalie.id || goalie.playerID;
    ball.withPlayer = true;
    ball.Player = ball.ownerId;
    ball.vx = 0;
    ball.vy = 0;
    ball.vz = 0;
    ball.z = 0;
    return {
      outcome: 'CLEAN_CATCH',
      reachXY,
      reachZ,
      effectiveSavingScore,
      description: 'Blocaje seguro y embolse limpio sin rebote'
    };
  }
}
