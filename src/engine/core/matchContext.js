/**
 * matchContext.js — Máquina de Estados de las 4 Fases del Continuum Táctico,
 * Ventanas de Gegenpressing (5s / 100 ticks), Contraataque (8s / 160 ticks) e Índice de Desorden Rival (Fase 5 — Fulbito 2.2).
 */
import { toRelativeUV, DEFAULT_PITCH_BOUNDS } from '../space/pitchZones.js';
import { resolvePlayerLine } from '../teamShape.js';
import { clamp } from './rng.js';

export const TACTICAL_PHASES = {
  ORGANIZACION_OFENSIVA: 'ORGANIZACION_OFENSIVA',
  TRANSICION_ATAQUE_DEFENSA: 'TRANSICION_ATAQUE_DEFENSA',
  ORGANIZACION_DEFENSIVA: 'ORGANIZACION_DEFENSIVA',
  TRANSICION_DEFENSA_ATAQUE: 'TRANSICION_DEFENSA_ATAQUE',
};

export const TRANSITION_SUBMODES = {
  // En TRANSICION_ATAQUE_DEFENSA:
  COUNTER_PRESSING: 'COUNTER_PRESSING',       // Gegenpressing intenso durante 5s (100 ticks)
  INTENSIVE_RETREAT: 'INTENSIVE_RETREAT',     // Repliegue intensivo hacia anclas de bloque (TRACKING_BACK)
  // En TRANSICION_DEFENSA_ATAQUE:
  FAST_COUNTER: 'FAST_COUNTER',               // Contraataque vertical rápido en 2-4 pases (8s / 160 ticks, x1.80 pases filtrados)
  CONSOLIDATE_POSSESSION: 'CONSOLIDATE_POSSESSION', // Pase de seguridad (Safety Pass) para armar Organización Ofensiva
  // En fases organizadas:
  NONE: 'NONE',
};

export const CONTINUUM_CONFIG = {
  TRANSITION_A_TO_D_WINDOW_TICKS: 120,  // 6 segundos tras perder el balón (~120 ticks)
  COUNTER_PRESS_DURATION_TICKS: 100,    // 5 segundos activos de Gegenpressing
  COUNTER_PRESS_MIN_U: 0.45,            // Pérdida en campo rival o zona media-alta (u_loss >= 0.45)
  COUNTER_PRESS_RADIUS_PX: 180,         // Radio de 18m (180px)
  COUNTER_PRESS_MIN_PLAYERS: 3,         // Al menos 3 compañeros cercanos para activar Gegenpressing
  TRANSITION_D_TO_A_WINDOW_TICKS: 160,  // 8 segundos tras recuperar el balón en juego vivo (~160 ticks)
  FAST_COUNTER_THROUGH_MULTIPLIER: 1.80, // Multiplicador x1.80 en utilidad de pases verticales/filtrados
  DISORDER_THRESHOLD: 0.35,             // Índice de desorden rival a partir del cual se dispara FAST_COUNTER
};

function getCoords(entity) {
  if (!entity) return { x: 340, y: 525 };
  if (Array.isArray(entity)) return { x: Number(entity[0]) || 340, y: Number(entity[1]) || 525 };
  if (Array.isArray(entity.currentPOS)) {
    return { x: Number(entity.currentPOS[0]) || 340, y: Number(entity.currentPOS[1]) || 525 };
  }
  if (Array.isArray(entity.position)) {
    return { x: Number(entity.position[0]) || 340, y: Number(entity.position[1]) || 525 };
  }
  return { x: Number(entity.x) || 340, y: Number(entity.y) || 525 };
}

function isPlayerActive(p) {
  if (!p || p.redCard || p.sentOff) return false;
  if (Array.isArray(p.currentPOS) && (p.currentPOS[0] === 'NP' || typeof p.currentPOS[0] !== 'number')) {
    return false;
  }
  return true;
}

function getTeamAttackDir(team, pitchBounds = DEFAULT_PITCH_BOUNDS) {
  const gk = (team?.players || []).find(p => p.position === 'GK' || p.role === 'GK') || team?.players?.[0];
  const originY = gk?.originPOS?.[1] ?? 0;
  return originY < (pitchBounds.height || 1050) / 2 ? 1 : -1;
}

/**
 * Calcula el Índice de Desorden Rival en [0, 1] al momento de recuperar el balón:
 * Mide cuántos defensores/mediocampistas rivales están por delante de la línea de la pelota
 * o fuera de sus zonas de Rest Defence, y si su última línea está adelantada dejando espacio a la espalda.
 */
export function computeOpponentDisorderIndex(defendingTeam, ball, pitchBounds = DEFAULT_PITCH_BOUNDS) {
  const players = (defendingTeam?.players || []).filter(p => isPlayerActive(p) && p.position !== 'GK' && p.role !== 'GK');
  if (!players.length) return 0;

  const defAttackDir = getTeamAttackDir(defendingTeam, pitchBounds);
  const ballCoords = getCoords(ball);
  // Perspectiva del equipo que acaba de perder el balón (defendingTeam):
  // u = 0 es su propio arco, u = 1 es el arco donde estaba atacando
  const ballUVDef = toRelativeUV(ballCoords.x, ballCoords.y, pitchBounds, defAttackDir);

  let aheadOfBallCount = 0;
  let defendersOutOfPosition = 0;
  let defendersBehindBall = 0;
  let sumDefU = 0;
  let defLineCount = 0;

  for (const p of players) {
    const pc = getCoords(p);
    const puv = toRelativeUV(pc.x, pc.y, pitchBounds, defAttackDir);
    const line = resolvePlayerLine(p);

    if (puv.u > ballUVDef.u + 0.02) {
      aheadOfBallCount++;
      if (line === 'DEF') defendersOutOfPosition++;
    } else {
      if (line === 'DEF' || line === 'MID') defendersBehindBall++;
    }

    if (line === 'DEF') {
      sumDefU += puv.u;
      defLineCount++;
    }
  }

  const avgDefLineU = defLineCount > 0 ? sumDefU / defLineCount : 0.25;
  // Espacio libre a la espalda de la defensa rival (si avgDefLineU > 0.35 hay mucho campo para correr)
  const highLineExposure = clamp((avgDefLineU - 0.25) / 0.35, 0, 1);
  // Falta de Rest Defence (< 3 jugadores detrás de la línea de la pelota)
  const restDefencePenalty = defendersBehindBall < 3 ? 0.35 : (defendersBehindBall === 3 ? 0.12 : 0);
  const aheadRatio = aheadOfBallCount / players.length;

  const disorder = clamp(
    0.45 * aheadRatio +
    0.35 * highLineExposure +
    0.20 * clamp(defendersOutOfPosition / 2, 0, 1) +
    restDefencePenalty,
    0.0,
    1.0
  );

  return Number(disorder.toFixed(3));
}

/**
 * Evalúa si el equipo que acaba de perder el balón cumple las condiciones de Gegenpressing (Counter-Press):
 * 1) La táctica/mentalidad lo habilita (offensive, gegenpress, counterPress, highPress o por defecto si no es bloque bajo/defensivo).
 * 2) La pérdida ocurre en campo rival (u_loss >= 0.45).
 * 3) Hay al menos 3 jugadores propios de campo en un radio de 18m (180px) del punto de pérdida.
 */
export function evaluateCounterPressTrigger(losingTeam, lossPos, pitchBounds = DEFAULT_PITCH_BOUNDS) {
  const players = (losingTeam?.players || []).filter(p => isPlayerActive(p) && p.position !== 'GK' && p.role !== 'GK');
  const attackDir = getTeamAttackDir(losingTeam, pitchBounds);
  const lossCoords = getCoords(lossPos);
  const lossUV = toRelativeUV(lossCoords.x, lossCoords.y, pitchBounds, attackDir);

  const mentality = String(losingTeam?.mentality || 'balanced').toLowerCase();
  const transitionRule = String(losingTeam?.tacticalModel?.transitionAToD || losingTeam?.counterPressInstruction || '').toLowerCase();
  const coachInst = String(losingTeam?.coachState?.instruction || 'Normal');

  const isRetreatForced =
    transitionRule === 'retreat' ||
    transitionRule === 'repliegue' ||
    mentality === 'defensive' ||
    coachInst === 'ParkTheBus' ||
    coachInst === 'WasteTime';

  const nearbyPlayers = players
    .map(p => {
      const pc = getCoords(p);
      return {
        player: p,
        distPx: Math.hypot(pc.x - lossCoords.x, pc.y - lossCoords.y),
      };
    })
    .filter(item => item.distPx <= CONTINUUM_CONFIG.COUNTER_PRESS_RADIUS_PX)
    .sort((a, b) => a.distPx - b.distPx);

  const hasEnoughSupport = nearbyPlayers.length >= CONTINUUM_CONFIG.COUNTER_PRESS_MIN_PLAYERS;
  const inHighZone = lossUV.u >= CONTINUUM_CONFIG.COUNTER_PRESS_MIN_U;

  const shouldCounterPress = !isRetreatForced && inHighZone && hasEnoughSupport;
  const presserIds = shouldCounterPress
    ? nearbyPlayers.slice(0, 3).map(item => item.player.id || item.player.playerID)
    : [];

  return {
    shouldCounterPress,
    lossU: Number(lossUV.u.toFixed(3)),
    nearbyCount: nearbyPlayers.length,
    presserIds,
  };
}

/**
 * Evalúa si el equipo que acaba de recuperar el balón debe lanzar un Contraataque Vertical Rápido (FAST_COUNTER)
 * o Consolidar la Posesión (CONSOLIDATE_POSSESSION).
 */
export function evaluateFastCounterTrigger(recoveringTeam, losingTeam, ball, pitchBounds = DEFAULT_PITCH_BOUNDS) {
  const disorderIndex = computeOpponentDisorderIndex(losingTeam, ball, pitchBounds);
  const playStyle = String(recoveringTeam?.playStyle || 'balanced');
  const transitionRule = String(recoveringTeam?.tacticalModel?.transitionDToA || '').toLowerCase();
  const coachInst = String(recoveringTeam?.coachState?.instruction || 'Normal');

  const wantsConsolidation =
    transitionRule === 'consolidate' ||
    coachInst === 'SlowDown' ||
    coachInst === 'WasteTime';

  const wantsVertical =
    transitionRule === 'fast_counter' ||
    transitionRule === 'counter' ||
    playStyle === 'directCounter' ||
    coachInst === 'PushForward' ||
    coachInst === 'AllOutAttack';

  const shouldFastCounter = !wantsConsolidation && (wantsVertical || disorderIndex >= CONTINUUM_CONFIG.DISORDER_THRESHOLD);

  return {
    shouldFastCounter,
    disorderIndex,
    throughMultiplier: shouldFastCounter ? CONTINUUM_CONFIG.FAST_COUNTER_THROUGH_MULTIPLIER : 1.0,
  };
}

/**
 * Inicializa o devuelve el estado de matchContext dentro de matchDetails.
 */
export function ensureMatchContext(matchDetails) {
  if (!matchDetails.tacticalPhase) {
    matchDetails.tacticalPhase = {};
  }
  if (!matchDetails.matchContext) {
    matchDetails.matchContext = {
      currentPossessionTeamId: null,
      possessionStartTick: 0,
      ticksInCurrentPhase: 0,
      lastTurnoverTick: -999,
      lastLossPosition: [340, 525],
      teams: {},
    };
  }
  return matchDetails.matchContext;
}

/**
 * Actualiza tick a tick las 4 Fases del Continuum Táctico para ambos equipos,
 * gestionando las ventanas de Gegenpressing (5s / 100 ticks) y Contraataque (8s / 160 ticks).
 */
export function updateMatchContinuum(matchDetails, pitchBounds = DEFAULT_PITCH_BOUNDS) {
  if (!matchDetails || !matchDetails.kickOffTeam || !matchDetails.secondTeam) return null;

  const ctx = ensureMatchContext(matchDetails);
  const { kickOffTeam, secondTeam, ball } = matchDetails;
  const currentTick = matchDetails.currentTick || matchDetails.iterationCount || 0;
  const isDeadBall = Boolean(ball?.isRestart || (ball?.restartWaitTicks || 0) > 0 || matchDetails.pendingKickoffTeam);

  const koId = kickOffTeam.teamID || kickOffTeam.name || 'kickOffTeam';
  const stId = secondTeam.teamID || secondTeam.name || 'secondTeam';

  for (const [team, tId] of [[kickOffTeam, koId], [secondTeam, stId]]) {
    if (!ctx.teams[tId]) {
      ctx.teams[tId] = {
        teamId: tId,
        phase: TACTICAL_PHASES.ORGANIZACION_DEFENSIVA,
        subMode: TRANSITION_SUBMODES.NONE,
        phaseStartTick: currentTick,
        ticksInPhase: 0,
        lossTick: -999,
        lossPosition: [340, 525],
        lossU: 0.5,
        recoveryTick: -999,
        counterPressers: [],
        disorderIndexAtRecovery: 0,
        passUtilityMultiplier: 1.0,
      };
    }
    team.teamID = team.teamID || tId;
  }

  const activeTeamId = ball?.withTeam || ball?.lastTouch?.teamID || ctx.currentPossessionTeamId;
  if (!activeTeamId) {
    matchDetails.tacticalPhase[koId] = ctx.teams[koId].phase;
    matchDetails.tacticalPhase[stId] = ctx.teams[stId].phase;
    return ctx;
  }

  const possessingTeam = activeTeamId === koId ? kickOffTeam : secondTeam;
  const defendingTeam = activeTeamId === koId ? secondTeam : kickOffTeam;
  const possId = possessingTeam.teamID || (possessingTeam === kickOffTeam ? koId : stId);
  const defId = defendingTeam.teamID || (defendingTeam === kickOffTeam ? koId : stId);

  const possState = ctx.teams[possId];
  const defState = ctx.teams[defId];

  // Si es pelota parada o reinicio en corto, ambos equipos entran directamente en Organización
  if (isDeadBall) {
    ctx.currentPossessionTeamId = possId;
    possState.phase = TACTICAL_PHASES.ORGANIZACION_OFENSIVA;
    possState.subMode = TRANSITION_SUBMODES.NONE;
    possState.counterPressers = [];
    possState.passUtilityMultiplier = 1.0;

    defState.phase = TACTICAL_PHASES.ORGANIZACION_DEFENSIVA;
    defState.subMode = TRANSITION_SUBMODES.NONE;
    defState.counterPressers = [];
    defState.passUtilityMultiplier = 1.0;

    syncTeamAndPlayerFlags(possessingTeam, possState, defendingTeam, defState, matchDetails);
    return ctx;
  }

  // Detectar cambio de posesión en juego vivo (Turnover)
  const isTurnover = ctx.currentPossessionTeamId && ctx.currentPossessionTeamId !== possId;

  if (!ctx.currentPossessionTeamId) {
    ctx.currentPossessionTeamId = possId;
    ctx.possessionStartTick = currentTick;
    possState.phase = TACTICAL_PHASES.ORGANIZACION_OFENSIVA;
    possState.subMode = TRANSITION_SUBMODES.NONE;
    defState.phase = TACTICAL_PHASES.ORGANIZACION_DEFENSIVA;
    defState.subMode = TRANSITION_SUBMODES.NONE;
  } else if (isTurnover) {
    ctx.currentPossessionTeamId = possId;
    ctx.possessionStartTick = currentTick;
    ctx.lastTurnoverTick = currentTick;

    const ballCoords = getCoords(ball);
    ctx.lastLossPosition = [ballCoords.x, ballCoords.y];

    // 1. Equipo que PIERDE el balón -> TRANSICION_ATAQUE_DEFENSA (ventana 6s / 120 ticks)
    const cpEval = evaluateCounterPressTrigger(defendingTeam, ballCoords, pitchBounds);
    defState.phase = TACTICAL_PHASES.TRANSICION_ATAQUE_DEFENSA;
    defState.phaseStartTick = currentTick;
    defState.ticksInPhase = 0;
    defState.lossTick = currentTick;
    defState.lossPosition = [ballCoords.x, ballCoords.y];
    defState.lossU = cpEval.lossU;
    defState.subMode = cpEval.shouldCounterPress
      ? TRANSITION_SUBMODES.COUNTER_PRESSING
      : TRANSITION_SUBMODES.INTENSIVE_RETREAT;
    defState.counterPressers = cpEval.presserIds;
    defState.passUtilityMultiplier = 1.0;

    // 2. Equipo que RECUPERA el balón -> TRANSICION_DEFENSA_ATAQUE (ventana 8s / 160 ticks)
    const fcEval = evaluateFastCounterTrigger(possessingTeam, defendingTeam, ballCoords, pitchBounds);
    possState.phase = TACTICAL_PHASES.TRANSICION_DEFENSA_ATAQUE;
    possState.phaseStartTick = currentTick;
    possState.ticksInPhase = 0;
    possState.recoveryTick = currentTick;
    possState.counterPressers = [];
    possState.disorderIndexAtRecovery = fcEval.disorderIndex;
    possState.subMode = fcEval.shouldFastCounter
      ? TRANSITION_SUBMODES.FAST_COUNTER
      : TRANSITION_SUBMODES.CONSOLIDATE_POSSESSION;
    possState.passUtilityMultiplier = fcEval.throughMultiplier;
  } else {
    // Misma posesión: avanzar relojes de ventana
    possState.ticksInPhase = currentTick - possState.phaseStartTick;
    defState.ticksInPhase = currentTick - defState.phaseStartTick;

    // Expiración de ventana de Transición Defensa -> Ataque (8s = 160 ticks) -> Organización Ofensiva
    if (
      possState.phase === TACTICAL_PHASES.TRANSICION_DEFENSA_ATAQUE &&
      possState.ticksInPhase >= CONTINUUM_CONFIG.TRANSITION_D_TO_A_WINDOW_TICKS
    ) {
      possState.phase = TACTICAL_PHASES.ORGANIZACION_OFENSIVA;
      possState.subMode = TRANSITION_SUBMODES.NONE;
      possState.phaseStartTick = currentTick;
      possState.ticksInPhase = 0;
      possState.passUtilityMultiplier = 1.0;
    }

    // En Transición Ataque -> Defensa:
    // - El Gegenpressing dura exactamente 5s (100 ticks)
    // - La ventana total de transición dura 6s (120 ticks) o se cierra antes si el rival cruza fácil o se consolida el bloque
    if (defState.phase === TACTICAL_PHASES.TRANSICION_ATAQUE_DEFENSA) {
      if (
        defState.subMode === TRANSITION_SUBMODES.COUNTER_PRESSING &&
        defState.ticksInPhase >= CONTINUUM_CONFIG.COUNTER_PRESS_DURATION_TICKS
      ) {
        defState.subMode = TRANSITION_SUBMODES.INTENSIVE_RETREAT;
        defState.counterPressers = [];
      }

      if (defState.ticksInPhase >= CONTINUUM_CONFIG.TRANSITION_A_TO_D_WINDOW_TICKS) {
        defState.phase = TACTICAL_PHASES.ORGANIZACION_DEFENSIVA;
        defState.subMode = TRANSITION_SUBMODES.NONE;
        defState.phaseStartTick = currentTick;
        defState.ticksInPhase = 0;
        defState.counterPressers = [];
      }
    }
  }

  syncTeamAndPlayerFlags(possessingTeam, possState, defendingTeam, defState, matchDetails);
  return ctx;
}

function syncTeamAndPlayerFlags(possessingTeam, possState, defendingTeam, defState, matchDetails) {
  const possId = possessingTeam.teamID || possessingTeam.name || 'kickOffTeam';
  const defId = defendingTeam.teamID || defendingTeam.name || 'secondTeam';

  matchDetails.tacticalPhase[possId] = possState.phase;
  matchDetails.tacticalPhase[defId] = defState.phase;

  possessingTeam.tacticalPhase = possState.phase;
  possessingTeam.transitionSubMode = possState.subMode;
  possessingTeam.passUtilityMultiplier = possState.passUtilityMultiplier;
  possessingTeam.gamePhase = possState.phase === TACTICAL_PHASES.TRANSICION_DEFENSA_ATAQUE
    ? 'AttackingTransition'
    : 'AttackingOrganization';

  defendingTeam.tacticalPhase = defState.phase;
  defendingTeam.transitionSubMode = defState.subMode;
  defendingTeam.passUtilityMultiplier = 1.0;
  defendingTeam.gamePhase = defState.phase === TACTICAL_PHASES.TRANSICION_ATAQUE_DEFENSA
    ? 'DefensiveTransition'
    : 'DefensiveOrganization';

  const presserSet = new Set(defState.counterPressers || []);
  for (const p of defendingTeam.players || []) {
    if (!isPlayerActive(p)) continue;
    const pid = p.id || p.playerID;
    if (defState.phase === TACTICAL_PHASES.TRANSICION_ATAQUE_DEFENSA) {
      if (defState.subMode === TRANSITION_SUBMODES.COUNTER_PRESSING && presserSet.has(pid)) {
        p.transitionState = 'COUNTER_PRESSING';
      } else {
        p.transitionState = 'TRACKING_BACK';
      }
    } else {
      p.transitionState = null;
    }
  }

  for (const p of possessingTeam.players || []) {
    if (!isPlayerActive(p)) continue;
    if (possState.phase === TACTICAL_PHASES.TRANSICION_DEFENSA_ATAQUE) {
      p.transitionState = possState.subMode;
    } else {
      p.transitionState = null;
    }
  }
}
