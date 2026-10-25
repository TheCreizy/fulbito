// src/engine/evaluators/passEvaluator.js
import { getZoneXThreat, getVerticalLane, toRelativeUV, getTacticalZone18, DEFAULT_PITCH_BOUNDS } from '../space/pitchZones.js';
import { computePlayerPressure } from '../space/pressureMap.js';
import { raycastCorridor } from '../space/raycast.js';
import { hasTrait } from '../player/effectiveSkill.js';

function getPlayerCoords(p) {
  if (!p) return { x: 340, y: 525 };
  if (Array.isArray(p)) {
    const x = typeof p[0] === 'number' ? p[0] : 340;
    const y = typeof p[1] === 'number' ? p[1] : 525;
    return { x, y };
  }
  if (Array.isArray(p.currentPOS)) {
    const x = typeof p.currentPOS[0] === 'number' ? p.currentPOS[0] : 340;
    const y = typeof p.currentPOS[1] === 'number' ? p.currentPOS[1] : 525;
    return { x, y };
  }
  return { x: (typeof p.x === 'number' ? p.x : 340), y: (typeof p.y === 'number' ? p.y : 525) };
}

/**
 * Evalúa todos los compañeros posibles (tanto al pie como al espacio / Through Ball)
 * y devuelve el mejor destino de pase con su coordenada exacta (targetX, targetY) y tipo ('FOOT' | 'THROUGH' | 'SWITCH').
 */
export function evaluateBestPassOption(passer, ownTeam, opposition, pitchBounds = DEFAULT_PITCH_BOUNDS) {
  const passerId = passer.id || passer.playerID;
  const teammates = (ownTeam?.players || []).filter(m => {
    const mid = m.id || m.playerID;
    if (!mid || mid === passerId) return false;
    if (m.redCard || m.sentOff) return false;
    if (Array.isArray(m.currentPOS) && (m.currentPOS[0] === 'NP' || typeof m.currentPOS[0] !== 'number')) return false;
    return true;
  });
  const opponents = (opposition?.players || []).filter(o => {
    if (o.redCard || o.sentOff) return false;
    if (Array.isArray(o.currentPOS) && (o.currentPOS[0] === 'NP' || typeof o.currentPOS[0] !== 'number')) return false;
    return true;
  });
  if (!teammates.length) return null;

  const passerCoords = getPlayerCoords(passer);
  const px = passerCoords.x;
  const py = passerCoords.y;

  const isTopTeam = passer.originPOS
    ? passer.originPOS[1] < pitchBounds.height / 2
    : (passer.attackDir === 1);
  const attackDir = isTopTeam ? 1 : -1;
  const forwardAngle = isTopTeam ? Math.PI / 2 : -Math.PI / 2;

  const passerXThreat = getZoneXThreat(px, py, pitchBounds, attackDir);
  const passerLane = getVerticalLane([px, py], pitchBounds, attackDir);
  const passerUV = toRelativeUV(px, py, pitchBounds, attackDir);

  let bestOption = null;
  let bestScore = -Infinity;

  for (const mate of teammates) {
    if (mate.position === 'GK' && passerUV.u > 0.35) continue; // No volver al arquero desde campo rival

    const mCoords = getPlayerCoords(mate);
    const mx = mCoords.x;
    const my = mCoords.y;

    // Generamos 2 candidatos por compañero: 1) Al pie, 2) Al espacio (Through Ball) si está rompiendo
    const candidates = [{ type: 'FOOT', x: mx + (mate.vx || 0) * 3, y: my + (mate.vy || 0) * 3 }];

    const offState = mate.offensiveState || '';
    const isMakingRun = ['RUNNING_IN_BEHIND', 'OVERLAPPING', 'UNDERLAPPING', 'HALF_SPACE_CREATING'].includes(offState);
    if (isMakingRun || mate.position === 'DEL' || mate.position === 'ST') {
      const leadDist = offState === 'OVERLAPPING' ? 68 : 55;
      const leadY = my + (isTopTeam ? leadDist : -leadDist);
      const leadX = mx + (mx < 200 ? 12 : (mx > 480 ? -12 : 0));
      if (leadY > 35 && leadY < pitchBounds.height - 35) {
        candidates.push({ type: 'THROUGH', x: leadX, y: leadY });
      }
    }

    for (const cand of candidates) {
      const dx = cand.x - px;
      const dy = cand.y - py;
      const distPx = Math.hypot(dx, dy);
      if (distPx < 32 || distPx > 520) continue;

      const passAngle = Math.atan2(dy, dx);
      const corridor = raycastCorridor({ x: px, y: py }, passAngle, distPx, opponents, 15);

      // Cambio de frente real: pase largo de banda a banda opuesta
      const isWingToWing = (px < 220 && cand.x > pitchBounds.width - 220) || (px > pitchBounds.width - 220 && cand.x < 220);
      const isLongSwitch = distPx > 260 && Math.abs(cand.x - px) >= 240 && isWingToWing;
      if (!corridor.isClear && !isLongSwitch && corridor.clearDistancePx < distPx * 0.75) {
        continue;
      }

      // 1. Ganancia de Amenaza Esperada (Delta xThreat)
      const targetXThreat = getZoneXThreat(cand.x, cand.y, pitchBounds, attackDir);
      const deltaXT = targetXThreat - passerXThreat;

      // 2. Presión en el punto de recepción (PPM)
      const targetPPM = computePlayerPressure({ x: cand.x, y: cand.y, vx: mate.vx || 0, vy: mate.vy || 0, facingAngle: forwardAngle }, opponents, 10.0).totalPressure;

      // 3. Geometría de Triangulación / Diagonalidad (premia ángulos entre 20° y 70° hacia adelante)
      const angleDiffFromForward = Math.abs(Math.atan2(Math.sin(passAngle - forwardAngle), Math.cos(passAngle - forwardAngle)));
      let geometryBonus = 0;
      if (angleDiffFromForward >= 0.30 && angleDiffFromForward <= 1.25) {
        geometryBonus = 0.18; // Diagonal óptima de triángulo/diamante
      } else if (angleDiffFromForward > 1.45 && angleDiffFromForward < 1.75) {
        geometryBonus = -0.10; // Pase plano horizontal de 180° (previsible)
      } else if (angleDiffFromForward >= 1.75) {
        // Pase atrás de reciclaje: solo es útil si el pasador está muy presionado (PPM > 0.55)
        geometryBonus = (passer.pressurePPM || 0) > 0.55 ? 0.08 : -0.28;
      }

      // 4. Bonificación por activar desdoblamientos de laterales (Overlaps/Underlaps) y rupturas
      let tacticalBonus = 0;
      if (cand.type === 'THROUGH') tacticalBonus += 0.22;
      if (offState === 'OVERLAPPING' || offState === 'UNDERLAPPING') tacticalBonus += 0.28;
      if (offState.startsWith('BOX_ZONE_')) tacticalBonus += 0.35;
      if (isLongSwitch && targetPPM < 0.25) tacticalBonus += 0.20; // Cambio de orientación al lado débil libre

      // Trait: PLAYMAKER (+0.18 en THROUGH o SWITCH hacia zonas de peligro)
      const candZone = getTacticalZone18([cand.x, cand.y], pitchBounds, attackDir);
      const isDangerZone = [10, 12, 14, 16, 17, 18].includes(candZone);
      if (hasTrait(passer, 'PLAYMAKER') && (cand.type === 'THROUGH' || isLongSwitch) && isDangerZone) {
        tacticalBonus += 0.18;
      }

      // Combinación de Tercer Hombre (+0.14) si el receptor está en zona central/peligro y un 3er compañero ataca el espacio
      if ([10, 11, 12, 14].includes(candZone)) {
        const hasThirdManRunner = teammates.some(t => {
          const tid = t.id || t.playerID;
          const mid = mate.id || mate.playerID;
          if (tid === mid || tid === passerId) return false;
          const tState = t.offensiveState || '';
          if (!['RUNNING_IN_BEHIND', 'OVERLAPPING'].includes(tState)) return false;
          const tc = getPlayerCoords(t);
          return Math.hypot(tc.x - cand.x, tc.y - cand.y) <= 170;
        });
        if (hasThirdManRunner) {
          tacticalBonus += 0.14;
        }
      }

      // 5. Penalización por orientación corporal difícil del pasador (reducida 75% si tiene pre-escaneo cognitivo)
      const facingDiff = Math.abs(Math.atan2(Math.sin(passAngle - (passer.facingAngle || forwardAngle)), Math.cos(passAngle - (passer.facingAngle || forwardAngle))));
      const penaltyBase = facingDiff > 2.1 ? 0.16 : 0;
      const bodyOrientationPenalty = passer.cognition?.isPreScanned ? penaltyBase * 0.25 : penaltyBase;

      const interceptRisk = corridor.isClear ? 0.0 : (isLongSwitch ? 0.15 : 0.45);

      const utility =
        1.85 * deltaXT +
        geometryBonus +
        0.45 * (1.0 - targetPPM) +
        tacticalBonus -
        bodyOrientationPenalty -
        interceptRisk;

      if (utility > bestScore) {
        bestScore = utility;
        bestOption = {
          teammate: mate,
          targetX: cand.x,
          targetY: cand.y,
          type: isLongSwitch ? 'SWITCH' : cand.type,
          utility,
          distPx,
        };
      }
    }
  }

  return bestOption;
}
