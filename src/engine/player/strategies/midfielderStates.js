/**
 * midfielderStates.js — 16 Estados Tácticos de Mediocampistas (Fase 6 — Fulbito 2.2)
 * Pivotes (5), Interiores (8), Enganches (10) y Volantes Mixtos.
 */
export const MID_STATES = {
  // Sin balón:
  MID_SHIELDING_ZONE14: 'MID_SHIELDING_ZONE14',
  MID_LAVOLPIANA_DROP: 'MID_LAVOLPIANA_DROP',
  MID_PRESSING_TRIGGER: 'MID_PRESSING_TRIGGER',
  MID_COUNTER_PRESSING: 'MID_COUNTER_PRESSING',
  MID_SHUTTLING_BASCULATION: 'MID_SHUTTLING_BASCULATION',
  MID_TRACKING_RUNNER: 'MID_TRACKING_RUNNER',
  MID_REST_DEFENCE_COVER: 'MID_REST_DEFENCE_COVER',
  // Con posesión:
  MID_PIVOT_RECYCLE: 'MID_PIVOT_RECYCLE',
  MID_BOX_HALF_SPACE: 'MID_BOX_HALF_SPACE',
  MID_THIRD_MAN_SUPPORT: 'MID_THIRD_MAN_SUPPORT',
  MID_BOX_TO_BOX_LATE_RUN: 'MID_BOX_TO_BOX_LATE_RUN',
  MID_SWITCHING_PLAY: 'MID_SWITCHING_PLAY',
  MID_CARRYING_PROGRESSIVE: 'MID_CARRYING_PROGRESSIVE',
  MID_ROAMING_PLAYMAKER: 'MID_ROAMING_PLAYMAKER',
  MID_WIDE_SUPPORT: 'MID_WIDE_SUPPORT',
  MID_EDGE_OF_BOX_WAIT: 'MID_EDGE_OF_BOX_WAIT',
};

/**
 * Evalúa y devuelve el estado activo de un mediocampista.
 */
export function evaluateMidfielderState(player, team, opp, ball, matchDetails, pitchBounds) {
  const isBallWithUs = ball?.withTeam === team.teamID;
  const isPivot = (player.tacticalRole || player.role || player.position || '').toUpperCase().includes('CDM') ||
                  (player.tacticalRole || '').toUpperCase().includes('5');
  const isEnganche = (player.tacticalRole || player.role || player.position || '').toUpperCase().includes('CAM') ||
                     (player.tacticalRole || '').toUpperCase().includes('10');

  // A. CON POSESIÓN
  if (isBallWithUs) {
    if (player.hasBall) {
      return {
        state: isEnganche ? MID_STATES.MID_ROAMING_PLAYMAKER : MID_STATES.MID_CARRYING_PROGRESSIVE,
        legacyOffensiveState: 'BALL_CARRIER',
        targetX: player.currentPOS[0],
        targetY: player.currentPOS[1],
        effortMode: 'CRUISING_SUPPORT',
      };
    }

    const offRole = player.offensiveTarget?.state || player.offensiveState;
    if (offRole === 'BOX_ZONE_4') {
      return {
        state: isPivot ? MID_STATES.MID_EDGE_OF_BOX_WAIT : MID_STATES.MID_BOX_TO_BOX_LATE_RUN,
        legacyOffensiveState: offRole,
        targetX: player.offensiveTarget?.targetX,
        targetY: player.offensiveTarget?.targetY,
        effortMode: 'SURGING_BURST',
      };
    }

    if (offRole === 'HALF_SPACE_CREATING') {
      return {
        state: MID_STATES.MID_BOX_HALF_SPACE,
        legacyOffensiveState: offRole,
        targetX: player.offensiveTarget?.targetX ?? player.intentPOS?.[0],
        targetY: player.offensiveTarget?.targetY ?? player.intentPOS?.[1],
        effortMode: 'CRUISING_SUPPORT',
      };
    }

    if (isPivot) {
      return {
        state: MID_STATES.MID_PIVOT_RECYCLE,
        legacyOffensiveState: 'PIVOT_RECYCLE_SUPPORT',
        targetX: player.offensiveTarget?.targetX ?? player.intentPOS?.[0],
        targetY: player.offensiveTarget?.targetY ?? player.intentPOS?.[1],
        effortMode: 'CRUISING_SUPPORT',
      };
    }

    // Estructura en Caja (Box / Square) en Half-Spaces
    return {
      state: MID_STATES.MID_BOX_HALF_SPACE,
      legacyOffensiveState: 'HALF_SPACE_CREATING',
      targetX: player.offensiveTarget?.targetX ?? player.intentPOS?.[0],
      targetY: player.offensiveTarget?.targetY ?? player.intentPOS?.[1],
      effortMode: 'CRUISING_SUPPORT',
    };
  }

  // B. SIN POSESIÓN
  if (player.transitionState === 'COUNTER_PRESSING') {
    return {
      state: MID_STATES.MID_COUNTER_PRESSING,
      legacyDefensiveState: 'FIRST_DEFENDER_DELAY',
      targetX: ball.position?.[0] ?? ball.x,
      targetY: ball.position?.[1] ?? ball.y,
      effortMode: 'SPRINTING',
    };
  }

  const defRole = player.defensiveTarget?.state || player.defensiveState;
  if (defRole === 'FIRST_DEFENDER_DELAY') {
    return {
      state: MID_STATES.MID_PRESSING_TRIGGER,
      legacyDefensiveState: 'FIRST_DEFENDER_DELAY',
      targetX: player.defensiveTarget?.targetX,
      targetY: player.defensiveTarget?.targetY,
      effortMode: 'SPRINTING',
    };
  }

  if (isPivot) {
    return {
      state: MID_STATES.MID_SHIELDING_ZONE14,
      legacyDefensiveState: 'HOLDING_LINE_BALANCE',
      targetX: player.defensiveTarget?.targetX ?? player.originPOS?.[0],
      targetY: player.defensiveTarget?.targetY ?? player.originPOS?.[1],
      effortMode: 'JOGGING_SHAPE',
    };
  }

  return {
    state: MID_STATES.MID_SHUTTLING_BASCULATION,
    legacyDefensiveState: defRole || 'HOLDING_LINE_BALANCE',
    targetX: player.defensiveTarget?.targetX ?? player.originPOS?.[0],
    targetY: player.defensiveTarget?.targetY ?? player.originPOS?.[1],
    effortMode: 'JOGGING_SHAPE',
  };
}
