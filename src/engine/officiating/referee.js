/**
 * referee.js — Arbitraje Calibrado IFAB, Disciplina y Ley de Ventaja
 * Modela el juicio arbitral, severidad según perfil de colegiado,
 * autoprotección (Restraint), ley de la ventaja, faltas tácticas (SPA) y DOGSO.
 * Inspirado en open_football_engine/src/match/engine/officiating/referee.rs
 * y player/strategies/common/team/discipline.rs.
 */

/**
 * Calcula el multiplicador de Restricción (Restraint) de un defensor antes de meter la pierna.
 * @param {Object} defender - Defensor que evalúa la entrada
 * @param {boolean} isInsideOwnPenaltyBox - Si la acción ocurre dentro de su propia área penal
 * @param {boolean} approachFromBehind - Si la aproximación es por la espalda del rival
 * @returns {number} Multiplicador en (0, 1] que reduce la propensión al tackle arriesgado
 */
export function getDefenderRestraintMultiplier(defender, isInsideOwnPenaltyBox, approachFromBehind) {
  let multiplier = 1.0;

  // 1. Autoprotección si ya tiene Tarjeta Amarilla (-55% de entradas arriesgadas)
  const yellowCards = defender?.stats?.cards?.yellow ?? defender?.yellowCards ?? 0;
  if (yellowCards >= 1) {
    multiplier *= 0.45;
  }

  // 2. Prudencia extrema dentro del área penal propia (-50% de barridas para evitar penales)
  if (isInsideOwnPenaltyBox) {
    multiplier *= 0.50;
  }

  // 3. Penalización severa si llega desde atrás del atacante (riesgo de zancadilla y tarjeta)
  if (approachFromBehind) {
    const perception = (defender?.skill?.perception ?? defender?.perception ?? 70) / 100;
    multiplier *= (0.25 + 0.25 * perception);
  }

  return Math.max(0.05, Math.min(1.0, multiplier));
}

/**
 * Evalúa una falta cometida y decide: Ley de la Ventaja, Tiro Libre/Penal, Amarilla o Roja.
 * Calibrado estadísticamente para 16-22 faltas, 2-4 amarillas y ~0.12 rojas por partido.
 *
 * @param {Object} referee - Perfil del árbitro { strictness, leniency }
 * @param {Object} defender - Jugador infractor
 * @param {Object} attacker - Jugador que recibe la falta
 * @param {Object} foulContext - Contexto espacial y táctico de la infracción
 * @param {Function} rng - Generador pseudoaleatorio [0, 1)
 * @returns {{ callFoul: boolean, advantagePlayed: boolean, isPenalty: boolean, card: string|null }}
 */
export function adjudicateFoul(referee, defender, attacker, foulContext = {}, rng = Math.random) {
  const strictness = referee?.strictness ?? 0.52; // [0.35 permisivo .. 0.75 estricto]
  
  if (defender) {
    defender.foulCount = (defender.foulCount || 0) + 1;
    if (defender.stats?.tackles) {
      defender.stats.tackles.fouls = (defender.stats.tackles.fouls || 0) + 1;
    }
  }

  // 1. Ley de la Ventaja: si la falta fue leve y el equipo atacante conserva el balón con ventaja
  if (
    !foulContext.isInsidePenaltyBox &&
    (foulContext.severity ?? 0.3) < 0.45 &&
    foulContext.attackerTeamKeepsBallWithSpace
  ) {
    return {
      callFoul: false,
      advantagePlayed: true,
      isPenalty: false,
      card: null,
    };
  }

  let card = null;
  const currentYellows = defender?.stats?.cards?.yellow ?? defender?.yellowCards ?? 0;
  const isBooked = currentYellows >= 1;
  const severity = foulContext.severity ?? 0.35;

  // 2. Evaluación de ROJA DIRECTA (DOGSO o violencia desmedida)
  if (
    (foulContext.isLastManDOGSO && !foulContext.attemptedBallInBox) ||
    (severity >= 0.98 && foulContext.approachFromBehind && rng() < 0.10)
  ) {
    card = 'RED';
  }
  // 3. Evaluación de TARJETA AMARILLA
  else {
    let yellowProb = 0.08; // Falta común tiene probabilidad equilibrada (8%)

    // a) Falta Táctica / Cortar ataque prometedor (SPA)
    if (foulContext.isPromisingCounterAttack) {
      yellowProb += 0.32;
    }

    // b) Entrada por detrás o temeraria
    if (foulContext.approachFromBehind && severity > 0.60) {
      yellowProb += 0.18;
    }

    // c) Reiteración de faltas del mismo jugador (3 o más faltas acumuladas)
    const fouls = defender?.foulCount ?? 1;
    if (fouls >= 3) {
      yellowProb += 0.08 * (fouls - 2);
    }

    yellowProb *= (0.75 + 0.25 * strictness);

    // Si ya está amonestado, umbral exigente para la expulsión por doble amarilla
    if (isBooked) {
      yellowProb *= 0.08;
    }

    if (rng() < yellowProb) {
      card = isBooked ? 'SECOND_YELLOW_RED' : 'YELLOW';
    }
  }

  return {
    callFoul: true,
    advantagePlayed: false,
    isPenalty: Boolean(foulContext.isInsidePenaltyBox),
    card,
  };
}
