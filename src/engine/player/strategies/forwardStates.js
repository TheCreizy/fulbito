/**
 * forwardStates.js — 15 Estados Tácticos de Delanteros y Extremos (Fase 6 — Fulbito 2.2)
 * Incluye: FWD_PINNING_CB, FWD_FALSE_NINE_DROP, FWD_RUNNING_IN_BEHIND_ARC (con arqueo anti-offside),
 * FWD_HOLDING_WIDTH_ISOLATION, FWD_BOX_ZONE_1..4, FWD_BREAKAWAY_DRIBBLE, etc.
 */
export const FWD_STATES = {
  // Sin balón (con posesión del equipo):
  FWD_PINNING_CB: 'FWD_PINNING_CB',
  FWD_FALSE_NINE_DROP: 'FWD_FALSE_NINE_DROP',
  FWD_RUNNING_IN_BEHIND_ARC: 'FWD_RUNNING_IN_BEHIND_ARC',
  FWD_HOLDING_WIDTH_ISOLATION: 'FWD_HOLDING_WIDTH_ISOLATION',
  FWD_BOX_ZONE_1: 'FWD_BOX_ZONE_1',
  FWD_BOX_ZONE_2: 'FWD_BOX_ZONE_2',
  FWD_BOX_ZONE_3: 'FWD_BOX_ZONE_3',
  FWD_BOX_ZONE_4: 'FWD_BOX_ZONE_4',
  // Con balón:
  FWD_BREAKAWAY_DRIBBLE: 'FWD_BREAKAWAY_DRIBBLE',
  FWD_1V1_ISOLATION_DRIBBLE: 'FWD_1V1_ISOLATION_DRIBBLE',
  FWD_HOLD_UP_PLAY: 'FWD_HOLD_UP_PLAY',
  // Sin posesión (fase defensiva):
  FWD_PRESSING_CB: 'FWD_PRESSING_CB',
  FWD_SCREENING_PIVOT: 'FWD_SCREENING_PIVOT',
  FWD_COUNTER_PRESS_TRAP: 'FWD_COUNTER_PRESS_TRAP',
  FWD_READY_FOR_COUNTER: 'FWD_READY_FOR_COUNTER',
};

/**
 * Evalúa y devuelve el estado activo de un delantero o extremo.
 */
export function evaluateForwardState(player, team, opp, ball, matchDetails, pitchBounds) {
  const isBallWithUs = ball?.withTeam === team.teamID;
  const isBreakaway = Boolean(player.lastShotEval?.isBreakaway);

  // A. CON BALÓN
  if (player.hasBall) {
    if (isBreakaway) {
      return {
        state: FWD_STATES.FWD_BREAKAWAY_DRIBBLE,
        legacyOffensiveState: 'BALL_CARRIER',
        targetX: player.currentPOS[0],
        targetY: player.currentPOS[1],
        effortMode: 'SURGING_BURST',
      };
    }
    const isWinger = (player.tacticalRole || player.position || '').toUpperCase().includes('EXT');
    if (isWinger) {
      return {
        state: FWD_STATES.FWD_1V1_ISOLATION_DRIBBLE,
        legacyOffensiveState: 'BALL_CARRIER',
        targetX: player.currentPOS[0],
        targetY: player.currentPOS[1],
        effortMode: 'CRUISING_SUPPORT',
      };
    }
    return {
      state: FWD_STATES.FWD_HOLD_UP_PLAY,
      legacyOffensiveState: 'BALL_CARRIER',
      targetX: player.currentPOS[0],
      targetY: player.currentPOS[1],
      effortMode: 'CRUISING_SUPPORT',
    };
  }

  // B. CON POSESIÓN DEL EQUIPO (DESMARQUES Y FIJACIONES)
  if (isBallWithUs) {
    const offRole = player.offensiveTarget?.state || player.offensiveState || '';

    // Asignación de 4 Zonas de Remate
    if (offRole.startsWith('BOX_ZONE_')) {
      const stateMap = {
        BOX_ZONE_1: FWD_STATES.FWD_BOX_ZONE_1,
        BOX_ZONE_2: FWD_STATES.FWD_BOX_ZONE_2,
        BOX_ZONE_3: FWD_STATES.FWD_BOX_ZONE_3,
        BOX_ZONE_4: FWD_STATES.FWD_BOX_ZONE_4,
      };
      return {
        state: stateMap[offRole] || FWD_STATES.FWD_BOX_ZONE_2,
        legacyOffensiveState: offRole,
        targetX: player.offensiveTarget?.targetX,
        targetY: player.offensiveTarget?.targetY,
        effortMode: 'SURGING_BURST',
      };
    }

    // Ruptura diagonal con arqueo anti-offside
    if (offRole === 'RUNNING_IN_BEHIND' || player.isArcingOffside) {
      return {
        state: FWD_STATES.FWD_RUNNING_IN_BEHIND_ARC,
        legacyOffensiveState: 'RUNNING_IN_BEHIND',
        targetX: player.offensiveTarget?.targetX ?? player.intentPOS?.[0],
        targetY: player.offensiveTarget?.targetY ?? player.intentPOS?.[1],
        effortMode: 'SURGING_BURST',
      };
    }

    // Falso 9 / Descenso entre líneas
    if (offRole === 'FALSE_NINE_DROP' || player.tacticalRole === 'F9' || player.tacticalRole === 'CF') {
      return {
        state: FWD_STATES.FWD_FALSE_NINE_DROP,
        legacyOffensiveState: 'HALF_SPACE_CREATING',
        targetX: player.offensiveTarget?.targetX ?? player.intentPOS?.[0],
        targetY: player.offensiveTarget?.targetY ?? player.intentPOS?.[1],
        effortMode: 'CRUISING_SUPPORT',
      };
    }

    // Fijación de centrales rivales (Pinning CB)
    if (player.tacticalRole === 'ST' || player.position === 'DEL' || player.role === 'ST') {
      return {
        state: FWD_STATES.FWD_PINNING_CB,
        legacyOffensiveState: 'RUNNING_IN_BEHIND',
        targetX: player.offensiveTarget?.targetX ?? player.intentPOS?.[0],
        targetY: player.offensiveTarget?.targetY ?? player.intentPOS?.[1],
        effortMode: 'CRUISING_SUPPORT',
      };
    }

    // Extremo fijando amplitud (Holding Width)
    return {
      state: FWD_STATES.FWD_HOLDING_WIDTH_ISOLATION,
      legacyOffensiveState: 'HALF_SPACE_CREATING',
      targetX: player.offensiveTarget?.targetX ?? player.intentPOS?.[0],
      targetY: player.offensiveTarget?.targetY ?? player.intentPOS?.[1],
      effortMode: 'CRUISING_SUPPORT',
    };
  }

  // C. SIN POSESIÓN (FASE DEFENSIVA)
  if (player.transitionState === 'COUNTER_PRESSING') {
    return {
      state: FWD_STATES.FWD_COUNTER_PRESS_TRAP,
      legacyDefensiveState: 'FIRST_DEFENDER_DELAY',
      targetX: ball.position?.[0] ?? ball.x,
      targetY: ball.position?.[1] ?? ball.y,
      effortMode: 'SPRINTING',
    };
  }

  return {
    state: FWD_STATES.FWD_READY_FOR_COUNTER,
    legacyDefensiveState: 'HOLDING_LINE_BALANCE',
    targetX: player.originPOS?.[0],
    targetY: player.originPOS?.[1],
    effortMode: 'JOGGING_SHAPE',
  };
}
