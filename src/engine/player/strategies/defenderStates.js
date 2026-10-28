/**
 * defenderStates.js — 16 Estados Tácticos de Defensores (Fase 6 — Fulbito 2.2)
 * Centrales, Líberos, Laterales y Carrileros.
 */
export const DEF_STATES = {
  // Sin balón:
  DEF_HOLDING_LINE: 'DEF_HOLDING_LINE',
  DEF_FIRST_DELAY: 'DEF_FIRST_DELAY',
  DEF_SECOND_COVER: 'DEF_SECOND_COVER',
  DEF_MARKING_TIGHT: 'DEF_MARKING_TIGHT',
  DEF_SWEEPER_COVER: 'DEF_SWEEPER_COVER',
  DEF_TRACKING_BACK: 'DEF_TRACKING_BACK',
  DEF_AERIAL_CLEAR: 'DEF_AERIAL_CLEAR',
  DEF_BOX_CROSS_GUARD: 'DEF_BOX_CROSS_GUARD',
  DEF_EMERGENCY_BLOCK: 'DEF_EMERGENCY_BLOCK',
  DEF_LINE_STEP_OFFSIDE: 'DEF_LINE_STEP_OFFSIDE',
  // Con posesión:
  DEF_REST_DEFENCE: 'DEF_REST_DEFENCE',
  DEF_BALL_PLAYING_STEP: 'DEF_BALL_PLAYING_STEP',
  DEF_FULLBACK_SUPPORT: 'DEF_FULLBACK_SUPPORT',
  DEF_INVERTED_FULLBACK: 'DEF_INVERTED_FULLBACK',
  DEF_OVERLAPPING: 'DEF_OVERLAPPING',
  DEF_UNDERLAPPING: 'DEF_UNDERLAPPING',
};

/**
 * Evalúa y devuelve el estado activo de un defensor manteniendo sincronización
 * con los contratos existentes (player.defensiveState y player.offensiveState).
 */
export function evaluateDefenderState(player, team, opp, ball, matchDetails, pitchBounds) {
  const isBallWithUs = ball?.withTeam === team.teamID;
  const defRole = player.defensiveTarget?.state || player.defensiveState;
  const offRole = player.offensiveTarget?.state || player.offensiveState;
  const isLibero = (player.tacticalRole || player.role || '').toUpperCase().includes('LÍBERO');

  // A. CON POSESIÓN DEL EQUIPO
  if (isBallWithUs) {
    if (offRole === 'OVERLAPPING') {
      return {
        state: DEF_STATES.DEF_OVERLAPPING,
        legacyOffensiveState: 'OVERLAPPING',
        targetX: player.offensiveTarget?.targetX,
        targetY: player.offensiveTarget?.targetY,
        effortMode: 'SURGING_BURST',
      };
    }
    if (offRole === 'UNDERLAPPING') {
      return {
        state: DEF_STATES.DEF_UNDERLAPPING,
        legacyOffensiveState: 'UNDERLAPPING',
        targetX: player.offensiveTarget?.targetX,
        targetY: player.offensiveTarget?.targetY,
        effortMode: 'SURGING_BURST',
      };
    }
    if (offRole === 'FULLBACK_SUPPORT') {
      return {
        state: DEF_STATES.DEF_FULLBACK_SUPPORT,
        legacyOffensiveState: 'FULLBACK_SUPPORT',
        targetX: player.offensiveTarget?.targetX,
        targetY: player.offensiveTarget?.targetY,
        effortMode: 'CRUISING_SUPPORT',
      };
    }
    if (player.hasBall && (player.tacticalRole === 'CB' || player.position === 'CB')) {
      return {
        state: DEF_STATES.DEF_BALL_PLAYING_STEP,
        legacyOffensiveState: 'BALL_PLAYING_CB',
        targetX: player.currentPOS[0],
        targetY: player.currentPOS[1],
        effortMode: 'CRUISING_SUPPORT',
      };
    }
    return {
      state: DEF_STATES.DEF_REST_DEFENCE,
      legacyOffensiveState: 'REST_DEFENCE_CB',
      targetX: player.offensiveTarget?.targetX ?? player.intentPOS?.[0],
      targetY: player.offensiveTarget?.targetY ?? player.intentPOS?.[1],
      effortMode: 'JOGGING_SHAPE',
    };
  }

  // B. SIN BALÓN / EN DEFENSA
  if (player.transitionState === 'TRACKING_BACK') {
    return {
      state: DEF_STATES.DEF_TRACKING_BACK,
      legacyDefensiveState: 'HOLDING_LINE_BALANCE',
      targetX: player.defensiveTarget?.targetX ?? player.originPOS?.[0],
      targetY: player.defensiveTarget?.targetY ?? player.originPOS?.[1],
      effortMode: 'SPRINTING',
    };
  }

  if (defRole === 'FIRST_DEFENDER_DELAY') {
    return {
      state: DEF_STATES.DEF_FIRST_DELAY,
      legacyDefensiveState: 'FIRST_DEFENDER_DELAY',
      targetX: player.defensiveTarget?.targetX,
      targetY: player.defensiveTarget?.targetY,
      effortMode: 'SPRINTING',
    };
  }

  if (defRole === 'SECOND_DEFENDER_COVER') {
    return {
      state: DEF_STATES.DEF_SECOND_COVER,
      legacyDefensiveState: 'SECOND_DEFENDER_COVER',
      targetX: player.defensiveTarget?.targetX,
      targetY: player.defensiveTarget?.targetY,
      effortMode: 'SPRINTING',
    };
  }

  if (defRole === 'MARKING_TIGHT') {
    return {
      state: DEF_STATES.DEF_MARKING_TIGHT,
      legacyDefensiveState: 'MARKING_TIGHT',
      targetX: player.defensiveTarget?.targetX,
      targetY: player.defensiveTarget?.targetY,
      effortMode: 'CRUISING_SUPPORT',
    };
  }

  if (isLibero) {
    return {
      state: DEF_STATES.DEF_SWEEPER_COVER,
      legacyDefensiveState: 'HOLDING_LINE_BALANCE',
      targetX: player.defensiveTarget?.targetX,
      targetY: player.defensiveTarget?.targetY,
      effortMode: 'JOGGING_SHAPE',
    };
  }

  return {
    state: DEF_STATES.DEF_HOLDING_LINE,
    legacyDefensiveState: 'HOLDING_LINE_BALANCE',
    targetX: player.defensiveTarget?.targetX ?? player.originPOS?.[0],
    targetY: player.defensiveTarget?.targetY ?? player.originPOS?.[1],
    effortMode: 'JOGGING_SHAPE',
  };
}
