/**
 * ballContest.js — Sistema de Duelos y Disputas en 3 Capas
 * Capa 1: Intercepciones de balón suelto y bloqueo de líneas (0% faltas)
 * Capa 2: Contención (Delay / Jockey) y forcejeo hombro con hombro (bodyContest, <5% faltas)
 * Capa 3: Entrada al balón (Tackle) gobernada por autoprotección (Restraint) y cooldown
 * Inspirado en open_football_engine/src/match/engine/ball/contest/ (interception, pass_block, body, tackle).
 */

import { getDefenderRestraintMultiplier, adjudicateFoul } from './officiating/referee.js';

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

/**
 * CAPA 1: Intercepción de balón suelto / pase (0% faltas)
 * @param {Object} player - Jugador interceptor
 * @param {Object} ball - Balón
 * @param {number} scaleMetersToPx - Escala de conversión (default 10.0)
 * @returns {boolean} True si interceptó y controló el balón
 */
export function tryInterceptLooseBall(player, ball, scaleMetersToPx = 10.0) {
  if (!player || player.redCard || player.sentOff || (player.interceptCooldown || 0) > 0) return false;

  const pPos = getPos(player);
  const pVel = getVel(player);
  const ballPos = getPos(ball);
  const ballZ = ball.z ?? (Array.isArray(ball.position) ? ball.position[2] : 0) ?? 0;

  // Altura alcanzable según rol y atributo de salto
  const jumpingSkill = player.skill?.jumping ?? player.jumping ?? 70;
  const isGK = player.role === 'GK' || player.position === 'GK';
  const maxReachZ = isGK ? 20 : 8.0 + (jumpingSkill / 100) * 6.0;
  if (ballZ > maxReachZ) return false;

  const agi = (player.skill?.agility ?? player.agility ?? 70) / 100;
  const tac = (player.skill?.tackling ?? player.tackling ?? 70) / 100;
  const per = (player.skill?.perception ?? player.perception ?? 70) / 100;
  const chem = player.chemistryMultiplier || 1.0;

  const interceptRadiusPx = (1.25 * scaleMetersToPx) * (0.60 + 0.15 * agi + 0.15 * tac + 0.10 * per) * chem;
  const dist = Math.hypot(ballPos.x - pPos.x, ballPos.y - pPos.y);

  if (dist <= interceptRadiusPx) {
    const ballVx = ball.vx ?? (Array.isArray(ball.velocity) ? ball.velocity[0] : 0);
    const ballVy = ball.vy ?? (Array.isArray(ball.velocity) ? ball.velocity[1] : 0);
    const ballSpeed = Math.hypot(ballVx, ballVy);
    const controlProb = Math.min(0.98, (0.75 + 0.25 * per) * chem - Math.max(0, (ballSpeed - 9) * 0.05));

    if (Math.random() < controlProb) {
      ball.ownerId = player.id || player.playerID;
      ball.withPlayer = true;
      ball.Player = ball.ownerId;
      ball.vx = pVel.vx;
      ball.vy = pVel.vy;
      ball.z = 0;
      ball.vz = 0;
      if (Array.isArray(ball.position)) {
        ball.position[0] = pPos.x;
        ball.position[1] = pPos.y;
        ball.position[2] = 0;
      }
      if (Array.isArray(ball.velocity)) {
        ball.velocity[0] = pVel.vx;
        ball.velocity[1] = pVel.vy;
      }
      return true;
    } else {
      // Bloqueo / desvío parcial del pase
      ball.vx = (ball.vx || 0) * -0.35;
      ball.vy = (ball.vy || 0) + (Math.random() - 0.5) * 3.0;
      if (Array.isArray(ball.velocity)) {
        ball.velocity[0] = ball.vx;
        ball.velocity[1] = ball.vy;
      }
      player.interceptCooldown = 18;
      return false;
    }
  }

  return false;
}

/**
 * CAPAS 2 y 3: Disputa contra el portador del balón (Jockey/Delay -> Carga Corporal -> Tackle)
 *
 * @param {Object} defender - Defensor
 * @param {Object} attacker - Poseedor del balón
 * @param {Object} ball - Balón
 * @param {Object} matchContext - Contexto táctico y de arbitraje
 * @param {Function} rng - Generador pseudoaleatorio
 * @returns {{ outcome: string, decision?: Object }}
 */
export function resolveBallCarrierEngagement(defender, attacker, ball, matchContext = {}, rng = Math.random) {
  if (!defender || !attacker) return { outcome: 'NONE' };

  if ((defender.tackleCooldown || 0) > 0) {
    // Retardación activa (Jockey) durante el tiempo de recarga
    attacker.speedModifier = Math.min(attacker.speedModifier || 1.0, 0.78);
    return { outcome: 'DELAY_JOCKEY' };
  }

  const defPos = getPos(defender);
  const attPos = getPos(attacker);
  const attVel = getVel(attacker);

  const dx = attPos.x - defPos.x;
  const dy = attPos.y - defPos.y;
  const dist = Math.hypot(dx, dy) || 0.001;

  const facingAngle = attacker.facingAngle ?? Math.atan2(attVel.vy, attVel.vx || 0.0001);
  const attDirX = Math.cos(facingAngle);
  const attDirY = Math.sin(facingAngle);

  // Si approachDot > 0.5, el defensor persigue desde atrás
  const approachDot = (dx / dist) * attDirX + (dy / dist) * attDirY;
  const approachFromBehind = approachDot > 0.50;

  const chemDef = defender.chemistryMultiplier || 1.0;
  const chemAtt = attacker.chemistryMultiplier || 1.0;

  const defStr = ((defender.skill?.strength ?? defender.strength ?? 70) / 100) * chemDef;
  const defAgi = ((defender.skill?.agility ?? defender.agility ?? 70) / 100) * chemDef;
  const defTac = ((defender.skill?.tackling ?? defender.tackling ?? 70) / 100) * chemDef;
  const defPer = ((defender.skill?.perception ?? defender.perception ?? 70) / 100) * chemDef;

  const attStr = ((attacker.skill?.strength ?? attacker.strength ?? 70) / 100) * chemAtt;
  const attAgi = ((attacker.skill?.agility ?? attacker.agility ?? 70) / 100) * chemAtt;
  const attCon = ((attacker.skill?.control ?? attacker.control ?? 70) / 100) * chemAtt;

  // --- CAPA 2: DUELO DE CUERPO HOMBRO CON HOMBRO (bodyContest) ---
  if (!approachFromBehind && Math.abs(approachDot) <= 0.50) {
    const bodyScoreDef = 0.60 * defStr + 0.40 * defAgi + (rng() - 0.5) * 0.18;
    const bodyScoreAtt = 0.55 * attStr + 0.45 * attCon;

    if (bodyScoreDef > bodyScoreAtt + 0.07) {
      // Quite limpio con el cuerpo (0% falta)
      const defId = defender.id || defender.playerID;
      ball.ownerId = defId;
      ball.withPlayer = true;
      ball.Player = defId;
      defender.tackleCooldown = 10;
      attacker.tackleCooldown = 12;
      if (defender.stats?.tackles) {
        defender.stats.tackles.total = (defender.stats.tackles.total || 0) + 1;
        defender.stats.tackles.standing = (defender.stats.tackles.standing || 0) + 1;
      }
      return { outcome: 'CLEAN_BODY_WIN' };
    }

    // Carga lateral ilícita / empujón cuando el atacante gana la posición
    if (bodyScoreDef < bodyScoreAtt - 0.02 && rng() < 0.52 * (1.15 - defAgi)) {
      defender.tackleCooldown = 6;
      const decision = adjudicateFoul(matchContext.referee, defender, attacker, {
        isInsidePenaltyBox: matchContext.isInsidePenaltyBox,
        severity: 0.35,
        approachFromBehind: false,
        isPromisingCounterAttack: matchContext.isCounterAttack,
        isLastManDOGSO: false,
        attackerTeamKeepsBallWithSpace: false,
      }, rng);
      return { outcome: decision.callFoul ? 'FOUL' : 'ADVANTAGE', decision };
    }
  }

  // --- CAPA 3: EVALUACIÓN DE RESTRICCIÓN (Restraint) ANTES DE TACKLE ---
  const restraint = getDefenderRestraintMultiplier(
    defender,
    matchContext.isInsidePenaltyBox,
    approachFromBehind
  );

  // Probabilidad de intentar la entrada al balón
  const attemptTackleProb = 0.94 * (0.55 + 0.45 * defPer) * restraint;
  if (rng() > attemptTackleProb) {
    attacker.speedModifier = Math.min(attacker.speedModifier || 1.0, 0.72); // Frenado táctico (Delay)
    return { outcome: 'DELAY_JOCKEY' };
  }

  // Ejecución de Tackle
  defender.tackleCooldown = 6;
  if (defender.stats?.tackles) {
    defender.stats.tackles.total = (defender.stats.tackles.total || 0) + 1;
  }

  const tackleSkill = 0.65 * defTac + 0.35 * defPer - (approachFromBehind ? 0.20 : 0);
  const evadeSkill = 0.55 * attCon + 0.45 * attAgi;
  const margin = tackleSkill - evadeSkill + (rng() - 0.5) * 0.30;

  if (margin >= 0.0) {
    // Tackle limpio
    const defId = defender.id || defender.playerID;
    ball.ownerId = defId;
    ball.withPlayer = true;
    ball.Player = defId;
    attacker.tackleCooldown = 8;
    if (defender.stats?.tackles) {
      defender.stats.tackles.on = (defender.stats.tackles.on || 0) + 1;
    }
    return { outcome: 'CLEAN_TACKLE_WIN' };
  }

  // El atacante eludió el tackle: evaluar si hubo infracción (zancadilla o arrastre)
  const foulContactProb = Math.min(
    0.88,
    Math.max(0.55, (0.78 - 0.18 * defTac + (approachFromBehind ? 0.22 : 0)) * restraint)
  );

  if (rng() < foulContactProb) {
    const severity = Math.min(1.0, Math.abs(margin) + (approachFromBehind ? 0.25 : 0));
    const decision = adjudicateFoul(matchContext.referee, defender, attacker, {
      isInsidePenaltyBox: matchContext.isInsidePenaltyBox,
      severity,
      approachFromBehind,
      isPromisingCounterAttack: matchContext.isCounterAttack,
      isLastManDOGSO: matchContext.isLastManDOGSO,
      attemptedBallInBox: matchContext.isInsidePenaltyBox && !approachFromBehind,
      attackerTeamKeepsBallWithSpace: false,
    }, rng);

    return { outcome: decision.callFoul ? 'FOUL' : 'ADVANTAGE', decision };
  }

  return { outcome: 'TACKLE_EVADED' };
}
