/**
 * pressureMap.js — Mapa de Presión Individual (PPM) en 8 Direcciones
 * Cuantifica la presión espacial sobre el jugador considerando distancias,
 * velocidad de cierre (closing speed) y orientación corporal (campo visual frontal vs punto ciego).
 */

function getPos(entity) {
  if (!entity) return { x: 0, y: 0 };
  if (Array.isArray(entity.currentPOS)) {
    return { x: entity.currentPOS[0], y: entity.currentPOS[1] };
  }
  return {
    x: entity.x ?? entity.currentPOS?.[0] ?? 0,
    y: entity.y ?? entity.currentPOS?.[1] ?? 0,
  };
}

function getVel(entity) {
  if (!entity) return { vx: 0, vy: 0 };
  if (Array.isArray(entity.velocity)) {
    return { vx: entity.velocity[0], vy: entity.velocity[1] };
  }
  return {
    vx: entity.vx ?? entity.velocity?.[0] ?? 0,
    vy: entity.vy ?? entity.velocity?.[1] ?? 0,
  };
}

/**
 * Calcula el Player Pressure Map (PPM) de un jugador
 * @param {Object} player - Jugador evaluado
 * @param {Array} opponents - Lista de jugadores rivales
 * @param {number} scaleMetersToPx - Escala de píxeles por metro (default 10.0 en Fulbito)
 * @returns {{ totalPressure: number, directional: Float32Array, closestDistMeters: number, closestDefender: Object|null }}
 */
export function computePlayerPressure(player, opponents, scaleMetersToPx = 10.0) {
  const sigmaPx = 4.5 * scaleMetersToPx; // ~4.5 metros de radio característico
  const maxRadiusPx = 12.0 * scaleMetersToPx;
  const directional = new Float32Array(8); // 8 sectores de 45 grados
  let survivalProb = 1.0;
  let closestDist = Infinity;
  let closestDefender = null;

  const pPos = getPos(player);
  const pVel = getVel(player);

  const facingAngle = player.facingAngle ?? Math.atan2(pVel.vy, pVel.vx || 0.0001);
  const facingCos = Math.cos(facingAngle);
  const facingSin = Math.sin(facingAngle);

  if (!opponents || !Array.isArray(opponents)) {
    return {
      totalPressure: 0,
      directional,
      closestDistMeters: 999,
      closestDefender: null,
    };
  }

  for (let k = 0; k < opponents.length; k++) {
    const opp = opponents[k];
    if (!opp || opp.redCard || opp.sentOff || opp.role === 'GK' || opp.position === 'GK') continue;

    const oppPos = getPos(opp);
    const oppVel = getVel(opp);

    const dx = oppPos.x - pPos.x;
    const dy = oppPos.y - pPos.y;
    const distSq = dx * dx + dy * dy;
    if (distSq > maxRadiusPx * maxRadiusPx) continue;

    const dist = Math.sqrt(distSq) || 0.001;
    if (dist < closestDist) {
      closestDist = dist;
      closestDefender = opp;
    }

    const ux = dx / dist;
    const uy = dy / dist;

    // Velocidad de cierre del rival hacia el jugador
    const relVx = oppVel.vx - pVel.vx;
    const relVy = oppVel.vy - pVel.vy;
    const closingSpeed = Math.max(0, -(relVx * ux + relVy * uy));

    // Factor de orientación respecto al cuerpo del poseedor:
    // Frontal (dot > 0.3) -> 1.25x (bloquea la visión y el avance)
    // Trasero / punto ciego (dot < -0.5) -> 1.15x (acoso por sorpresa)
    // Lateral -> 1.0x
    const dotFacing = ux * facingCos + uy * facingSin;
    const orientationWeight = dotFacing > 0.3 ? 1.25 : (dotFacing < -0.5 ? 1.15 : 1.0);

    const basePress = Math.exp(-distSq / (2 * sigmaPx * sigmaPx));
    const p_ik = Math.min(0.95, basePress * (1 + 0.35 * Math.min(1.5, closingSpeed / 4.0)) * orientationWeight);

    // Asignar al octante correspondiente (0..7)
    const angle = Math.atan2(dy, dx);
    const octant = ((Math.round((angle / (Math.PI * 2)) * 8) % 8) + 8) % 8;
    directional[octant] = Math.max(directional[octant], p_ik);

    survivalProb *= (1.0 - p_ik);
  }

  return {
    totalPressure: 1.0 - survivalProb, // [0..1]
    directional,
    closestDistMeters: closestDist / scaleMetersToPx,
    closestDefender,
  };
}
