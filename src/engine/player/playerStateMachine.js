/**
 * playerStateMachine.js — Orquestador HFSM con Histéresis Anti-Jitter y State Overrides (Fase 6 — Fulbito 2.2)
 * Gobierna las transiciones de estados jerárquicos para GK, DEF, MID y FWD.
 */
import { resolvePlayerLine } from '../teamShape.js';
import { evaluateGoalkeeperState } from './strategies/goalkeeperStates.js';
import { evaluateDefenderState } from './strategies/defenderStates.js';
import { evaluateMidfielderState } from './strategies/midfielderStates.js';
import { evaluateForwardState } from './strategies/forwardStates.js';

export const STATE_OVERRIDES = {
  LOOSE_BALL_CLAIM: 'LOOSE_BALL_CLAIM',
  BREAKAWAY_DRIBBLE: 'BREAKAWAY_DRIBBLE',
  EMERGENCY_PRESS_STEP: 'EMERGENCY_PRESS_STEP',
  SET_PIECE_HOLD: 'SET_PIECE_HOLD',
};

/**
 * Inicializa o actualiza la máquina de estados finitos jerárquica (player.fsm) para un jugador.
 */
export function updatePlayerStateMachine(player, team, opp, ball, matchDetails, pitchBounds) {
  if (!player || player.redCard || player.sentOff) return null;

  const line = resolvePlayerLine(player);
  if (!player.fsm) {
    player.fsm = {
      line,
      currentState: 'IDLE',
      ticksInState: 0,
      minHoldTicks: 10, // Histéresis estándar: 8 a 14 ticks
      targetX: player.currentPOS?.[0] ?? 340,
      targetY: player.currentPOS?.[1] ?? 525,
      effortMode: 'JOGGING_SHAPE',
    };
  }

  player.fsm.line = line;
  player.fsm.ticksInState = (player.fsm.ticksInState || 0) + 1;

  // 1. Detección de State Overrides de Prioridad (Interrupción en 1 tick)
  let priorityOverride = null;
  const isRestart = Boolean(ball?.isRestart || (ball?.restartWaitTicks || 0) > 0);
  if (isRestart) {
    priorityOverride = STATE_OVERRIDES.SET_PIECE_HOLD;
  } else if (player.hasBall && player.lastShotEval?.isBreakaway) {
    priorityOverride = STATE_OVERRIDES.BREAKAWAY_DRIBBLE;
  } else if (!ball?.withPlayer && !ball?.isPendingPass) {
    const ballPos = ball?.position || [340, 525];
    const distBall = Math.hypot(player.currentPOS[0] - ballPos[0], player.currentPOS[1] - ballPos[1]);
    if (distBall < 25) {
      priorityOverride = STATE_OVERRIDES.LOOSE_BALL_CLAIM;
    }
  }

  // 2. Si no hay override y no se cumplió la histéresis mínima, mantener estado actual
  const isInitial = player.fsm.currentState === 'IDLE';
  const canTransition = isInitial || priorityOverride !== null || player.fsm.ticksInState >= player.fsm.minHoldTicks;

  let stateEval = null;
  if (canTransition) {
    switch (line) {
      case 'GK':
        stateEval = evaluateGoalkeeperState(player, team, opp, ball, matchDetails, pitchBounds);
        break;
      case 'DEF':
        stateEval = evaluateDefenderState(player, team, opp, ball, matchDetails, pitchBounds);
        break;
      case 'MID':
        stateEval = evaluateMidfielderState(player, team, opp, ball, matchDetails, pitchBounds);
        break;
      case 'ATT':
      default:
        stateEval = evaluateForwardState(player, team, opp, ball, matchDetails, pitchBounds);
        break;
    }

    const nextState = priorityOverride || stateEval.state;
    if (nextState !== player.fsm.currentState) {
      player.fsm.currentState = nextState;
      player.fsm.ticksInState = 0;
      // Variación controlada de histéresis anti-jitter (8 a 14 ticks)
      player.fsm.minHoldTicks = 8 + (player.shirtNumber ? player.shirtNumber % 7 : 4);
    }

    if (stateEval.targetX !== undefined && stateEval.targetY !== undefined) {
      player.fsm.targetX = stateEval.targetX;
      player.fsm.targetY = stateEval.targetY;
    }
    player.fsm.effortMode = stateEval.effortMode || player.fsm.effortMode;

    // Sincronización estricta de retrocompatibilidad con tests F1–F4
    if (stateEval.legacyDefensiveState) {
      player.defensiveState = stateEval.legacyDefensiveState;
    }
    if (stateEval.legacyOffensiveState) {
      player.offensiveState = stateEval.legacyOffensiveState;
    }
  }

  return player.fsm;
}
