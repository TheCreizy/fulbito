import * as common from './common.js';
import { getEffectiveSkill, hasTrait } from './player/effectiveSkill.js';
import { clamp, angleDiff, rotateAngleTowards } from './core/rng.js';

/**
 * Constantes para Intercepción por Rumbo Constante (Constant-Bearing Interception),
 * desaceleración de balón perdido (Lost-Cause Friction Decay) y Cinemática Biomecánica (Fase 5 — Fulbito 2.2).
 */
export const STEERING_CONFIG = {
  SETTLE_DISTANCE: 18.0,
  LOST_CAUSE_FACTOR: 0.25,
  GRASS_FRICTION: 0.90,
  CONTACT_RADIUS: 2.5,
};

/**
 * Modalidades de Esfuerzo Cinemático (Fase 5.2 — UPDATE FULBITO 2.2.md):
 * Gobernadas por el estado táctico del jugador y conectadas al drenaje proporcional de player.fitness.
 */
export const MOVEMENT_EFFORT = {
  WALKING: { mode: 'WALKING', speedMultiplier: 0.38, fitnessDrainRate: 0.004 },
  JOGGING_SHAPE: { mode: 'JOGGING_SHAPE', speedMultiplier: 0.68, fitnessDrainRate: 0.014 },
  CRUISING_SUPPORT: { mode: 'CRUISING_SUPPORT', speedMultiplier: 0.85, fitnessDrainRate: 0.022 },
  SPRINTING: { mode: 'SPRINTING', speedMultiplier: 1.00, fitnessDrainRate: 0.036 },
  SURGING_BURST: { mode: 'SURGING_BURST', speedMultiplier: 1.12, fitnessDrainRate: 0.045 },
};

/**
 * 1. Rampa Progresiva de Aceleración (sprint_ramp en [0, 1]):
 * Delta_ramp = 0.065 + 0.055 * EffectiveSkill(agility)
 * Un jugador explosivo (agility = 92) alcanza pico en ~8 ticks; uno pesado (agility = 60) tarda ~12 ticks.
 */
export function computeSprintRampStep(player) {
  const effAgility = getEffectiveSkill(player, 'agility');
  return Number((0.065 + 0.055 * effAgility).toFixed(4));
}

export function updatePlayerSprintRamp(player, isAccelerating = true) {
  if (!player) return 0;
  const currentRamp = typeof player.sprintRamp === 'number' ? player.sprintRamp : 0;
  const deltaRamp = computeSprintRampStep(player);

  if (isAccelerating) {
    player.sprintRamp = Number(clamp(currentRamp + deltaRamp, 0.0, 1.0).toFixed(4));
  } else {
    // Desaceleración suave al dejar de esprintar
    player.sprintRamp = Number(clamp(currentRamp - deltaRamp * 1.35, 0.0, 1.0).toFixed(4));
  }
  player.sprintMomentum = player.sprintRamp;
  return player.sprintRamp;
}

/**
 * 2. Penalización Angular por Cambio de Dirección Brusco (Giro > 90° / PI/2) e Inercia Rotacional:
 * Si Delta_theta > PI/2:
 *   mu_turn = 1.0 - (Delta_theta / PI) * (0.65 - 0.35 * EffectiveSkill(agility))
 * Velocidad angular máxima de interpolación de torso:
 *   omega_max = 0.28 + 0.25 * EffectiveSkill(agility) rad/tick
 */
export function computeTurnKinematics(player, desiredAngleRad) {
  const effAgility = getEffectiveSkill(player, 'agility');
  const omegaMax = Number((0.28 + 0.25 * effAgility).toFixed(4));

  const currentFacing = typeof player?.facingAngle === 'number'
    ? player.facingAngle
    : desiredAngleRad;

  const deltaTheta = angleDiff(desiredAngleRad, currentFacing);
  let turnMultiplier = 1.0;

  if (deltaTheta > Math.PI / 2) {
    turnMultiplier = 1.0 - (deltaTheta / Math.PI) * (0.65 - 0.35 * effAgility);
    turnMultiplier = clamp(turnMultiplier, 0.30, 1.0);
  }

  const nextFacingAngle = rotateAngleTowards(currentFacing, desiredAngleRad, omegaMax);
  if (player) {
    player.facingAngle = nextFacingAngle;
    player.lastTurnMultiplier = Number(turnMultiplier.toFixed(4));
  }

  return {
    turnMultiplier: Number(turnMultiplier.toFixed(4)),
    deltaTheta: Number(deltaTheta.toFixed(4)),
    omegaMax,
    nextFacingAngle,
  };
}

/**
 * 3. Velocidad de Conducción con Balón (Carry Speed):
 * mu_carry = 0.84 + 0.12 * EffectiveSkill(control) + (hasTrait(SPEED_DRIBBLER) ? 0.04 : 0)
 */
export function computeCarrySpeedMultiplier(player) {
  const effControl = getEffectiveSkill(player, 'control');
  const traitBonus = hasTrait(player, 'SPEED_DRIBBLER') ? 0.04 : 0.0;
  const muCarry = 0.84 + 0.12 * effControl + traitBonus;
  return Number(clamp(muCarry, 0.80, 1.02).toFixed(4));
}

/**
 * 4. Esfuerzo por Modalidad de Movimiento (movementEffort):
 * Determina el modo cinemático activo y devuelve su multiplicador de velocidad y tasa de desgaste físico.
 */
export function resolveMovementEffort(player, action = 'run') {
  if (!player) return MOVEMENT_EFFORT.JOGGING_SHAPE;

  const offState = String(player.offensiveState || '');
  const defState = String(player.defensiveState || '');
  const transState = String(player.transitionState || '');
  const isBreakaway = Boolean(player.lastShotEval?.isBreakaway);

  if (action === 'wait') {
    player.effortMode = MOVEMENT_EFFORT.WALKING.mode;
    return MOVEMENT_EFFORT.WALKING;
  }

  // Rupturas explosivas (SURGING_BURST: 1.12x)
  const isBurstState =
    isBreakaway ||
    offState === 'OVERLAPPING' ||
    offState === 'UNDERLAPPING' ||
    offState === 'RUNNING_IN_BEHIND' ||
    offState.startsWith('BOX_ZONE_') ||
    transState === 'FAST_COUNTER';

  if (action === 'sprint' && isBurstState) {
    player.effortMode = MOVEMENT_EFFORT.SURGING_BURST.mode;
    return MOVEMENT_EFFORT.SURGING_BURST;
  }

  if (action === 'sprint' || action === 'intercept' || transState === 'COUNTER_PRESSING' || defState === 'FIRST_DEFENDER_DELAY') {
    player.effortMode = MOVEMENT_EFFORT.SPRINTING.mode;
    return MOVEMENT_EFFORT.SPRINTING;
  }

  if (offState && offState !== 'REST_DEFENCE_CB') {
    player.effortMode = MOVEMENT_EFFORT.CRUISING_SUPPORT.mode;
    return MOVEMENT_EFFORT.CRUISING_SUPPORT;
  }

  player.effortMode = MOVEMENT_EFFORT.JOGGING_SHAPE.mode;
  return MOVEMENT_EFFORT.JOGGING_SHAPE;
}

/**
 * Calcula el paso biomecánico efectivo (en px/tick) integrando:
 * - Velocidad punta base por agilidad
 * - Rampa progresiva de sprint (sprintRamp)
 * - Modalidad de esfuerzo (movementEffort)
 * - Penalización angular por giro > 90° (mu_turn)
 * - Penalización de conducción con balón (mu_carry)
 * - Factor de fatiga cuando player.fitness < 45
 */
export function computeBiomechanicalStep(player, desiredAngleRad, action = 'run', tempoMultiplier = 1.0) {
  const agility = Number(player?.skill?.agility ?? 75);
  let maxSprintSpeed = 7.5;
  if (agility >= 94) maxSprintSpeed = 9.5;
  else if (agility >= 86) maxSprintSpeed = 8.5;
  else if (agility >= 76) maxSprintSpeed = 7.5;
  else if (agility < 65) maxSprintSpeed = 5.8;

  const isAccelerating = action === 'sprint' || action === 'intercept';
  const ramp = updatePlayerSprintRamp(player, isAccelerating);
  const effort = resolveMovementEffort(player, action);

  // En modo sprint/burst, la velocidad escala desde el ritmo de crucero hasta el tope según sprintRamp
  const rampFactor = isAccelerating ? (0.55 + 0.45 * ramp) : 1.0;
  let step = maxSprintSpeed * effort.speedMultiplier * rampFactor;

  if (typeof desiredAngleRad === 'number' && !Number.isNaN(desiredAngleRad)) {
    const { turnMultiplier } = computeTurnKinematics(player, desiredAngleRad);
    step *= turnMultiplier;
  }

  if (player?.hasBall) {
    step *= computeCarrySpeedMultiplier(player);
  }

  const fitness = Number(player?.fitness ?? 100);
  if (fitness < 45) {
    const fatigueFactor = 0.62 + clamp((fitness - 20) / 25, 0, 1) * 0.38;
    step *= fatigueFactor;
  }

  step *= tempoMultiplier;
  return Number(Math.max(0.8, step).toFixed(3));
}

/**
 * Calcula el punto más temprano (earliest meeting point) en el que un jugador a velocidad máxima
 * puede interceptar una pelota que rueda perdiendo velocidad por rozamiento del césped.
 */
export function calculateEarliestMeeting(playerPos, maxSpeed, ballPos, ballVel, grassFriction = STEERING_CONFIG.GRASS_FRICTION) {
  const vx = ballVel[0] || 0;
  const vy = ballVel[1] || 0;
  const ballSpeed = Math.sqrt(vx * vx + vy * vy);
  if (ballSpeed < 0.3) {
    return [ballPos[0], ballPos[1]];
  }

  const dirX = vx / ballSpeed;
  const dirY = vy / ballSpeed;
  const k = grassFriction;
  const oneMinusK = 1 - k;

  const stoppingDist = ballSpeed / oneMinusK;
  const maxSteps = 16;
  for (let t = 1; t <= maxSteps; t++) {
    const decay = Math.pow(k, t);
    const decayDist = Math.min(stoppingDist, (ballSpeed * (1 - decay)) / oneMinusK);
    const bx = ballPos[0] + dirX * decayDist;
    const by = ballPos[1] + dirY * decayDist;

    const runCapacity = maxSpeed * t;
    const dx = bx - playerPos[0];
    const dy = by - playerPos[1];
    const distToPredicted = Math.sqrt(dx * dx + dy * dy);

    if (distToPredicted <= runCapacity) {
      return [bx, by];
    }
  }

  return [
    ballPos[0] + dirX * stoppingDist,
    ballPos[1] + dirY * stoppingDist,
  ];
}

/**
 * Intercepción por Rumbo Constante (Constant-Bearing Interception)
 */
export function calculateInterceptMovement(player, matchDetails, maxSpeed) {
  const ball = matchDetails.ball;
  const ballPos = ball.position || [340, 525, 0];
  const playerPos = player.currentPOS;

  let ballVelX = 0;
  let ballVelY = 0;

  if (Array.isArray(ball.ballOverIterations) && ball.ballOverIterations.length > 0) {
    const nextP = ball.ballOverIterations[0];
    ballVelX = nextP[0] - ballPos[0];
    ballVelY = nextP[1] - ballPos[1];
  } else if (Array.isArray(ball.velocity)) {
    ballVelX = ball.velocity[0] || 0;
    ballVelY = ball.velocity[1] || 0;
  }

  const toTargetX = ballPos[0] - playerPos[0];
  const toTargetY = ballPos[1] - playerPos[1];
  const distance = Math.sqrt(toTargetX * toTargetX + toTargetY * toTargetY);

  if (distance < STEERING_CONFIG.CONTACT_RADIUS) {
    return [
      Math.max(-maxSpeed, Math.min(maxSpeed, Math.round(ballVelX))),
      Math.max(-maxSpeed, Math.min(maxSpeed, Math.round(ballVelY))),
    ];
  }

  const losX = toTargetX / distance;
  const losY = toTargetY / distance;
  const along = ballVelX * losX + ballVelY * losY;

  const acrossX = ballVelX - losX * along;
  const acrossY = ballVelY - losY * along;
  const acrossSq = acrossX * acrossX + acrossY * acrossY;
  const speedSq = maxSpeed * maxSpeed;

  let holdX = 0;
  let holdY = 0;

  if (acrossSq >= speedSq) {
    const scale = maxSpeed / Math.sqrt(acrossSq);
    holdX = acrossX * scale;
    holdY = acrossY * scale;
  } else {
    const closingDist = Math.sqrt(speedSq - acrossSq);
    holdX = acrossX + losX * closingDist;
    holdY = acrossY + losY * closingDist;
  }

  const closingRate = Math.sqrt(Math.max(0, speedSq - acrossSq)) - along;
  const lostThreshold = STEERING_CONFIG.LOST_CAUSE_FACTOR * maxSpeed;

  let desiredX = holdX;
  let desiredY = holdY;

  if (closingRate < lostThreshold) {
    const ballHeight = ballPos[2] || 0;
    const grounded = ballHeight < 20 ? 1.0 : Math.max(0, 1.0 - (ballHeight - 20) / 40);

    const rawLost = Math.max(0, Math.min(1.0, 1.0 - (closingRate / lostThreshold)));
    const lostBlend = rawLost * rawLost * (3.0 - 2.0 * rawLost) * grounded;

    if (lostBlend > 0) {
      const meetingPoint = calculateEarliestMeeting(
        playerPos,
        maxSpeed,
        ballPos,
        [ballVelX, ballVelY],
        STEERING_CONFIG.GRASS_FRICTION
      );
      const cutDx = meetingPoint[0] - playerPos[0];
      const cutDy = meetingPoint[1] - playerPos[1];
      const cutDist = Math.sqrt(cutDx * cutDx + cutDy * cutDy);

      if (cutDist > 0) {
        const cutVx = (cutDx / cutDist) * maxSpeed;
        const cutVy = (cutDy / cutDist) * maxSpeed;
        desiredX = holdX + (cutVx - holdX) * lostBlend;
        desiredY = holdY + (cutVy - holdY) * lostBlend;
      }
    }
  }

  const ballSpeed = Math.sqrt(ballVelX * ballVelX + ballVelY * ballVelY);
  const catchable = ballSpeed <= maxSpeed ? 1.0 : (maxSpeed / Math.max(0.1, ballSpeed));
  if (distance < STEERING_CONFIG.SETTLE_DISTANCE) {
    const settleRatio = distance / STEERING_CONFIG.SETTLE_DISTANCE;
    const settleBlend = 1.0 - (1.0 - settleRatio) * catchable;
    desiredX = ballVelX + (desiredX - ballVelX) * settleBlend;
    desiredY = ballVelY + (desiredY - ballVelY) * settleBlend;
  }

  // Aplicar cinemática de rotación corporal (mu_turn) si el jugador tiene orientación previa
  const desiredAngle = Math.atan2(desiredY, desiredX);
  const { turnMultiplier } = computeTurnKinematics(player, desiredAngle);
  desiredX *= turnMultiplier;
  desiredY *= turnMultiplier;

  const finalDx = Math.max(-maxSpeed, Math.min(maxSpeed, Math.round(desiredX)));
  const finalDy = Math.max(-maxSpeed, Math.min(maxSpeed, Math.round(desiredY)));

  const [pitchWidth, pitchHeight] = matchDetails.pitchSize;
  const nextX = playerPos[0] + finalDx;
  const nextY = playerPos[1] + finalDy;

  return [
    nextX >= 8 && nextX <= pitchWidth - 8 ? finalDx : 0,
    nextY >= 8 && nextY <= pitchHeight - 8 ? finalDy : 0,
  ];
}

/**
 * Desplazamiento vectorial suave hacia un objetivo estático o posicional con:
 * - Penalización angular biomecánica en giros > 90° e interpolación de facingAngle.
 * - Desaceleración suave cuadrática (Arrive Steering) en distancias cortas (< 18px).
 * - Fuerza de repulsión entre compañeros (Separation) para evitar aglomeraciones.
 */
export function steerTowardsTarget(player, targetPOS, step, team, pitchSize) {
  const dx = targetPOS[0] - player.currentPOS[0];
  const dy = targetPOS[1] - player.currentPOS[1];
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 2) return [0, 0];

  const desiredAngle = Math.atan2(dy, dx);
  const { turnMultiplier } = computeTurnKinematics(player, desiredAngle);

  let effectiveStep = step * turnMultiplier;
  if (dist < 18) {
    const ratio = dist / 18;
    effectiveStep = Math.max(0.6, effectiveStep * ratio * ratio);
  }

  let vx = (dx / dist) * Math.min(effectiveStep, dist);
  let vy = (dy / dist) * Math.min(effectiveStep, dist);

  if (dist > 12 && team && Array.isArray(team.players)) {
    for (const mate of team.players) {
      if (!common.isOnPitch(mate) || mate.playerID === player.playerID) continue;
      const mx = player.currentPOS[0] - mate.currentPOS[0];
      const my = player.currentPOS[1] - mate.currentPOS[1];
      const mDist = Math.hypot(mx, my);
      if (mDist > 0 && mDist < 28) {
        const push = ((28 - mDist) / 28) * 1.2;
        vx += (mx / mDist) * push;
        vy += (my / mDist) * push;
      }
    }
  }

  let finalDx = Math.max(-step, Math.min(step, Math.round(vx)));
  let finalDy = Math.max(-step, Math.min(step, Math.round(vy)));

  if (finalDx === 0 && finalDy === 0 && dist >= 2) {
    if (Math.abs(dx) >= Math.abs(dy)) {
      finalDx = dx > 0 ? 1 : -1;
    } else {
      finalDy = dy > 0 ? 1 : -1;
    }
  }
  const nextX = player.currentPOS[0] + finalDx;
  const nextY = player.currentPOS[1] + finalDy;
  return [
    nextX >= 8 && nextX <= pitchSize[0] - 8 ? finalDx : 0,
    nextY >= 8 && nextY <= pitchSize[1] - 8 ? finalDy : 0,
  ];
}
