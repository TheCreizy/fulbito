// src/engine/evaluators/shotEvaluator.js
import { raycastCorridor } from '../space/raycast.js';
import { getTacticalZone18, toRelativeUV, DEFAULT_PITCH_BOUNDS } from '../space/pitchZones.js';

export const SHOT_QUALITY = {
  CLEAR_CUT: 'CLEAR_CUT_CHANCE',     // xG >= 0.32
  HALF_CHANCE: 'HALF_CHANCE',        // 0.07 <= xG < 0.32
  SPECULATIVE: 'SPECULATIVE_SHOT',   // xG < 0.07
};

function getPlayerCoords(p) {
  if (!p) return { x: 340, y: 525 };
  if (Array.isArray(p)) return { x: p[0], y: p[1] };
  if (Array.isArray(p.currentPOS)) return { x: p.currentPOS[0], y: p.currentPOS[1] };
  return { x: p.x ?? 340, y: p.y ?? 525 };
}

/**
 * Calcula el xG (Expected Goals) exacto de un posible disparo desde la posición del jugador
 * y detecta si tiene un corredor libre de escapada 1v1 (Breakaway Override).
 */
export function evaluateShotAndBreakaway(player, ownTeam, opposition, pitchBounds = DEFAULT_PITCH_BOUNDS) {
  const pCoords = getPlayerCoords(player);
  const px = pCoords.x;
  const py = pCoords.y;

  const isTopTeam = player.originPOS
    ? player.originPOS[1] < pitchBounds.height / 2
    : (player.attackDir === 1);
  const attackDir = isTopTeam ? 1 : -1;

  const goalX = 340;
  const goalY = isTopTeam ? pitchBounds.height - 10 : 10;
  const leftPostX = 305;
  const rightPostX = 375;

  const dxGoal = goalX - px;
  const dyGoal = goalY - py;
  const distPx = Math.hypot(dxGoal, dyGoal) || 1;
  const distMeters = distPx / 10.0;
  const angleToGoal = Math.atan2(dyGoal, dxGoal);

  // 1. Ángulo visible entre los dos postes (Teorema del Coseno / Producto Escalar)
  const vLx = leftPostX - px;
  const vLy = goalY - py;
  const vRx = rightPostX - px;
  const vRy = goalY - py;
  const magL = Math.hypot(vLx, vLy) || 1;
  const magR = Math.hypot(vRx, vRy) || 1;
  const cosTheta = Math.max(-1, Math.min(1, (vLx * vRx + vLy * vRy) / (magL * magR)));
  const goalAngleRad = Math.acos(cosTheta);

  // 2. Raycast del cono hacia el arco para contar bloqueadores y medir camino libre
  const opponents = opposition?.players || [];
  const corridor = raycastCorridor(
    { x: px, y: py },
    angleToGoal,
    Math.min(distPx, 240),
    opponents,
    18
  );

  // 3. Verificar posición del arquero rival
  const oppGK = opponents.find(o => o.position === 'GK' || o.role === 'GK');
  let gkOutBonus = 1.0;
  if (oppGK) {
    const gkCoords = getPlayerCoords(oppGK);
    const gkDistFromGoal = Math.hypot(gkCoords.x - goalX, gkCoords.y - goalY);
    if (gkDistFromGoal > 65) gkOutBonus = 1.30; // Arquero achicando lejos de los palos
  }

  // 4. Cálculo logístico de xG
  const logit = -1.15 + 2.65 * goalAngleRad - 0.095 * distMeters;
  const baseXG = 1.0 / (1.0 + Math.exp(-logit));

  const ppm = player.pressurePPM || 0;
  const blockerPenalty = Math.pow(0.70, corridor.blockerCount);
  const pressureFactor = Math.max(0.45, 1.0 - 0.35 * ppm);
  const shootSkill = ((player.stats?.shooting || player.skill?.shooting || player.shooting || 75) / 100);

  const xG = Math.max(0.005, Math.min(0.92, baseXG * blockerPenalty * pressureFactor * gkOutBonus * (0.8 + 0.35 * shootSkill)));

  let quality = SHOT_QUALITY.SPECULATIVE;
  if (xG >= 0.32) quality = SHOT_QUALITY.CLEAR_CUT;
  else if (xG >= 0.07) quality = SHOT_QUALITY.HALF_CHANCE;

  // 5. Detección de BREAKAWAY OVERRIDE (Mano a Mano / Camino Libre)
  const { u } = toRelativeUV(px, py, pitchBounds, attackDir);
  const outfieldDefendersCloserToGoal = opponents.filter(o => {
    if (o.position === 'GK' || o.role === 'GK' || o.redCard || o.sentOff) return false;
    const oCoords = getPlayerCoords(o);
    const dOppGoal = Math.hypot(oCoords.x - goalX, oCoords.y - goalY);
    const lateralDiff = Math.abs(oCoords.x - px);
    return dOppGoal < distPx - 12 && lateralDiff < 110;
  });

  const hasOpenLaneToGoal =
    u >= 0.46 &&
    (corridor.clearDistancePx >= 115 || outfieldDefendersCloserToGoal.length === 0) &&
    ppm < 0.58;

  // 6. Verificar si hay un compañero al lado con el arco aún más libre ("Extra Pass / Sweaty Goal")
  let betterTeammateForTapIn = null;
  if (distPx < 210 && ownTeam?.players) {
    for (const mate of ownTeam.players) {
      if ((mate.id || mate.playerID) === (player.id || player.playerID) || mate.position === 'GK' || mate.role === 'GK') continue;
      const mCoords = getPlayerCoords(mate);
      const dMateGoal = Math.hypot(mCoords.x - goalX, mCoords.y - goalY);
      const dPass = Math.hypot(mCoords.x - px, mCoords.y - py);
      if (dPass < 140 && dMateGoal < distPx - 25 && (mate.pressurePPM || 0) < 0.35) {
        const passAngle = Math.atan2(mCoords.y - py, mCoords.x - px);
        const passCorridor = raycastCorridor({ x: px, y: py }, passAngle, dPass, opponents, 14);
        if (passCorridor.isClear) {
          betterTeammateForTapIn = mate;
          break;
        }
      }
    }
  }

  // 7. Decisión recomendada: 'SHOOT_NOW', 'BREAKAWAY_DRIBBLE', 'EXTRA_PASS' o 'HOLD_OR_PASS'
  const zone18 = getTacticalZone18([px, py], pitchBounds, attackDir);
  let recommendation = 'HOLD_OR_PASS';

  if (betterTeammateForTapIn && xG < 0.48) {
    recommendation = 'EXTRA_PASS';
  } else if (quality === SHOT_QUALITY.CLEAR_CUT && distPx <= 165) {
    recommendation = 'SHOOT_NOW';
  } else if (hasOpenLaneToGoal) {
    // Si está mano a mano pero todavía lejos (>14.5m), corre directo al arco sin frenar ni pasar atrás
    recommendation = distPx <= 145 ? 'SHOOT_NOW' : 'BREAKAWAY_DRIBBLE';
  } else if (quality === SHOT_QUALITY.HALF_CHANCE && distPx <= 195 && corridor.blockerCount <= 1) {
    recommendation = 'SHOOT_NOW';
  } else if (zone18 === 14 && corridor.isClear && shootSkill >= 0.80 && ppm < 0.35 && distPx <= 265) {
    // Especialista de media distancia en Zona 14 (Balcón del área) con cono de tiro despejado
    recommendation = 'SHOOT_NOW';
  }

  return {
    xG,
    quality,
    isBreakaway: hasOpenLaneToGoal,
    recommendation,
    betterTeammateForTapIn,
    targetGoalPoint: { x: goalX, y: goalY },
    distPx,
  };
}
