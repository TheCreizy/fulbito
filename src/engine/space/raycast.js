/**
 * raycast.js — Líneas de Visión y Raycasting Espacial
 * Detecta pasillos libres hacia el arco, líneas de pase abiertas y conos de bloqueo.
 * Inspirado en open_football_engine/src/match/engine/raycast/space.rs.
 */

function getPos(entity) {
  if (!entity) return { x: 0, y: 0 };
  if (Array.isArray(entity)) return { x: entity[0], y: entity[1] };
  if (Array.isArray(entity.currentPOS)) return { x: entity.currentPOS[0], y: entity.currentPOS[1] };
  return {
    x: entity.x ?? 0,
    y: entity.y ?? 0,
  };
}

/**
 * Proyecta un corredor/cono desde origin en la dirección angle hasta maxDistPx
 * y devuelve la distancia libre de rivales y si el corredor está despejado.
 *
 * @param {Object|Array} origin - Punto de origen {x, y} o [x, y]
 * @param {number} angle - Ángulo en radianes
 * @param {number} maxDistPx - Distancia máxima de proyección en píxeles
 * @param {Array} opponents - Lista de jugadores defensores rivales
 * @param {number} corridorHalfWidthPx - Semiancho del corredor de pase/avance
 * @returns {{ isClear: boolean, clearDistancePx: number, blockerCount: number, firstBlocker: Object|null }}
 */
export function raycastCorridor(origin, angle, maxDistPx, opponents, corridorHalfWidthPx = 18) {
  const orig = getPos(origin);
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  let minBlockerProj = maxDistPx;
  let blockerCount = 0;
  let firstBlocker = null;

  if (!opponents || !Array.isArray(opponents)) {
    return {
      isClear: true,
      clearDistancePx: maxDistPx,
      blockerCount: 0,
      firstBlocker: null,
    };
  }

  for (let i = 0; i < opponents.length; i++) {
    const opp = opponents[i];
    if (!opp || opp.redCard || opp.sentOff || opp.role === 'GK' || opp.position === 'GK') continue;

    const oppPos = getPos(opp);
    const rx = oppPos.x - orig.x;
    const ry = oppPos.y - orig.y;

    // Proyección longitudinal sobre el rayo
    const proj = rx * dirX + ry * dirY;
    if (proj <= 0 || proj > maxDistPx) continue;

    // Distancia perpendicular al eje del rayo (con margen dinámico por habilidad de tackle)
    const perpDist = Math.abs(-rx * dirY + ry * dirX);
    const tacklingSkill = opp.skill?.tackling ?? opp.tackling ?? 70;
    const effectiveRadius = corridorHalfWidthPx + (tacklingSkill / 100) * 6;

    if (perpDist <= effectiveRadius) {
      blockerCount++;
      if (proj < minBlockerProj) {
        minBlockerProj = proj;
        firstBlocker = opp;
      }
    }
  }

  return {
    isClear: blockerCount === 0,
    clearDistancePx: minBlockerProj,
    blockerCount,
    firstBlocker,
  };
}

/**
 * Evalúa si una línea directa de pase entre dos jugadores está limpia
 */
export function isPassingLaneClear(passer, receiver, opponents, laneHalfWidthPx = 16) {
  const pPos = getPos(passer);
  const rPos = getPos(receiver);
  const dx = rPos.x - pPos.x;
  const dy = rPos.y - pPos.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return true;

  const angle = Math.atan2(dy, dx);
  const cast = raycastCorridor(pPos, angle, dist, opponents, laneHalfWidthPx);
  return cast.isClear;
}
