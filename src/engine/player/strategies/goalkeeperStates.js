/**
 * goalkeeperStates.js — 14 Estados Tácticos y de Decisión de Arquero (Fase 6 — Fulbito 2.2)
 * Inspirado en open_football_engine strategies/goalkeepers/states/.
 */
import { hasTrait } from '../effectiveSkill.js';

export const GK_STATES = {
  GK_STANDING_LINE: 'GK_STANDING_LINE',
  GK_SPLIT_STEP: 'GK_SPLIT_STEP',
  GK_PREPARING_SAVE: 'GK_PREPARING_SAVE',
  GK_COMING_OUT_1V1: 'GK_COMING_OUT_1V1',
  GK_SWEEPING: 'GK_SWEEPING',
  GK_CLAIMING_HIGH_BALL: 'GK_CLAIMING_HIGH_BALL',
  GK_TRACKING_CROSS: 'GK_TRACKING_CROSS',
  GK_PENALTY_READY: 'GK_PENALTY_READY',
  GK_HOLDING_BALL: 'GK_HOLDING_BALL',
  GK_DISTRIBUTING_SHORT: 'GK_DISTRIBUTING_SHORT',
  GK_LAUNCHING_COUNTER: 'GK_LAUNCHING_COUNTER',
  GK_SUPPORT_BACKPASS: 'GK_SUPPORT_BACKPASS',
  GK_GOAL_KICK_SETUP: 'GK_GOAL_KICK_SETUP',
  GK_WASTING_TIME: 'GK_WASTING_TIME',
};

/**
 * Evalúa y devuelve el estado táctico activo del arquero y su objetivo espacial.
 */
export function evaluateGoalkeeperState(player, team, opp, ball, matchDetails, pitchBounds) {
  const goalX = (pitchBounds.width || 680) / 2;
  const isTop = (player.originPOS?.[1] ?? 50) < (pitchBounds.height || 1050) / 2;
  const ownGoalY = isTop ? 30 : (pitchBounds.height || 1050) - 30;

  const ballPos = ball?.position || [340, 525, 0];
  const ballDistToGoal = Math.abs(ballPos[1] - ownGoalY);
  const isBallWithUs = ball?.withTeam === team.teamID;
  const isSweeper = hasTrait(player, 'SWEEPER_KEEPER');
  const ballMoving = (ball?.ballOverIterations?.length || 0) > 0;
  const isPendingShot = ball?.kickType === 'shot' || ball?.kickType === 'freekick';
  const isAerialCross = ball?.isAerialCrossDelivery || ball?.kickType === 'cross';
  const isThroughBall = ball?.kickType === 'through' || ball?.type === 'THROUGH';

  // 1. Con posesión en las manos / en los pies
  if (player.hasBall) {
    if (matchDetails.tacticalPhase?.[team.teamID] === 'TRANSICION_DEFENSA_ATAQUE' || team.transitionSubMode === 'FAST_COUNTER') {
      return { state: GK_STATES.GK_LAUNCHING_COUNTER, targetX: goalX, targetY: ownGoalY, effortMode: 'CRUISING_SUPPORT' };
    }
    return { state: GK_STATES.GK_DISTRIBUTING_SHORT, targetX: goalX, targetY: ownGoalY, effortMode: 'WALKING' };
  }

  // 2. Disparos directos al arco
  if (isPendingShot && ballMoving) {
    if (ballDistToGoal < 180) {
      return { state: GK_STATES.GK_PREPARING_SAVE, targetX: goalX, targetY: ownGoalY + (isTop ? 10 : -10), effortMode: 'SPRINTING' };
    }
    return { state: GK_STATES.GK_SPLIT_STEP, targetX: goalX, targetY: ownGoalY + (isTop ? 12 : -12), effortMode: 'CRUISING_SUPPORT' };
  }

  // 3. Centros aéreos
  if (isAerialCross && ballDistToGoal < 140) {
    return { state: GK_STATES.GK_CLAIMING_HIGH_BALL, targetX: ballPos[0], targetY: ballPos[1], effortMode: 'SPRINTING' };
  }

  // 4. Balones largos / filtrados a la espalda (Sweeper Keeper)
  if (isSweeper && isThroughBall && ballDistToGoal < 260 && !isBallWithUs) {
    return { state: GK_STATES.GK_SWEEPING, targetX: ballPos[0], targetY: ballPos[1], effortMode: 'SPRINTING' };
  }

  // 5. Mano a mano (Breakaway rival)
  const oppCarrier = (opp.players || []).find(op => op.hasBall);
  if (oppCarrier && ballDistToGoal < 190) {
    const advanceY = isTop ? Math.min(ownGoalY + 65, ballPos[1] - 15) : Math.max(ownGoalY - 65, ballPos[1] + 15);
    return { state: GK_STATES.GK_COMING_OUT_1V1, targetX: (goalX + ballPos[0]) / 2, targetY: advanceY, effortMode: 'SPRINTING' };
  }

  // 6. En posesión propia del equipo (acompañar bloque)
  if (isBallWithUs) {
    const advanceY = isSweeper ? (isTop ? 28 : -28) : (isTop ? 12 : -12);
    return { state: GK_STATES.GK_SUPPORT_BACKPASS, targetX: goalX, targetY: ownGoalY + advanceY, effortMode: 'JOGGING_SHAPE' };
  }

  // 7. Estado base bajo los tres palos bisectando el ángulo de tiro
  const bisectX = (goalX * 2 + ballPos[0]) / 3;
  const lineY = ownGoalY + (isTop ? 8 : -8);
  return { state: GK_STATES.GK_STANDING_LINE, targetX: Math.round(bisectX), targetY: Math.round(lineY), effortMode: 'JOGGING_SHAPE' };
}
