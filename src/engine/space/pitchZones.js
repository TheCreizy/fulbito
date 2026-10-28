/**
 * pitchZones.js — Sistema de Espacios y Zonas Tácticas de Fulbito 2.0
 * Define la grilla canónica de 18 Zonas, los 5 Carriles Verticales (Juego de Posición),
 * matriz xThreat y transformaciones de coordenadas normalizadas (u, v).
 */

export const LANES = {
  LEFT_WING: 0,
  LEFT_HALF_SPACE: 1,
  CENTER: 2,
  RIGHT_HALF_SPACE: 3,
  RIGHT_WING: 4,
};

export const LANE_NAMES = {
  [LANES.LEFT_WING]: 'Left Wing',
  [LANES.LEFT_HALF_SPACE]: 'Left Half-Space',
  [LANES.CENTER]: 'Center',
  [LANES.RIGHT_HALF_SPACE]: 'Right Half-Space',
  [LANES.RIGHT_WING]: 'Right Wing',
};

// Matriz de Amenaza Esperada (xThreat) para las 18 Zonas
export const DEFAULT_PITCH_BOUNDS = {
  minX: 0,
  minY: 0,
  maxX: 680,
  maxY: 1050,
  width: 680,
  height: 1050,
};

export const ZONE_XTHREAT = {
  1: 0.01,  2: 0.015, 3: 0.015, // Iniciación baja
  4: 0.02,  5: 0.03,  6: 0.03,  // Salida y contención
  7: 0.045, 8: 0.055, 9: 0.045, // Mediocampo base
  10: 0.11, 11: 0.09, 12: 0.11, // Half-spaces de gestación y pivote alto
  13: 0.14, 14: 0.24, 15: 0.14, // Bandas 3/4 y Zona 14 (Centro Neurálgico)
  16: 0.32, 17: 0.55, 18: 0.32  // Pasillos de cutback (16, 18) y Zona de Definición (17)
};

const ZONE_MATRIX = [
  [2, 1, 3],    // Fila 0: Área propia (1) y costados defensivos (2, 3)
  [5, 4, 6],    // Fila 1: Eje de salida (4) e interiores defensivos (5, 6)
  [7, 8, 9],    // Fila 2: Bandas medias (7, 9) y eje intermedio (8)
  [10, 11, 12], // Fila 3: Half-spaces medios (10, 12) y eje alto (11)
  [13, 14, 15], // Fila 4: Extremos 3/4 (13, 15) y Zona 14 (Creación / Balcón)
  [16, 17, 18], // Fila 5: Desborde/Cutback (16, 18) y Zona 17 (Remate final)
];

/**
 * Normaliza los límites del campo para admitir objetos pitchBounds o arrays pitchSize [width, height, depth]
 */
export function normalizePitchBounds(pitchBounds) {
  if (!pitchBounds) {
    return { minX: 0, maxX: 680, minY: 0, maxY: 1050, width: 680, height: 1050 };
  }
  if (Array.isArray(pitchBounds)) {
    const w = pitchBounds[0] || 680;
    const h = pitchBounds[1] || 1050;
    return { minX: 0, maxX: w, minY: 0, maxY: h, width: w, height: h };
  }
  return {
    minX: pitchBounds.minX ?? 0,
    maxX: pitchBounds.maxX ?? (pitchBounds.width || 680),
    minY: pitchBounds.minY ?? 0,
    maxY: pitchBounds.maxY ?? (pitchBounds.height || 1050),
    width: pitchBounds.width ?? ((pitchBounds.maxX ?? 680) - (pitchBounds.minX ?? 0)),
    height: pitchBounds.height ?? ((pitchBounds.maxY ?? 1050) - (pitchBounds.minY ?? 0)),
  };
}

/**
 * Convierte coordenadas de canvas a coordenadas relativas (u, v) en [0, 1]
 * u: Progreso longitudinal hacia el arco rival (0 = meta propia, 1 = meta rival)
 * v: Posición transversal relativa al ataque (0 = banda izquierda del atacante, 1 = banda derecha)
 * Soporta firmas (x, y, pitchBounds, attackDir) y (posObjOrArray, pitchBounds, attackDir)
 */
export function toRelativeUV(arg1, arg2, arg3, arg4) {
  let x, y, pitchBounds, attackDir;

  if (typeof arg1 === 'object' && arg1 !== null) {
    if (Array.isArray(arg1)) {
      x = arg1[0];
      y = arg1[1];
    } else {
      x = arg1.x ?? arg1.currentPOS?.[0] ?? 0;
      y = arg1.y ?? arg1.currentPOS?.[1] ?? 0;
    }
    pitchBounds = normalizePitchBounds(arg2);
    attackDir = arg3 ?? 1;
  } else {
    x = Number(arg1) || 0;
    y = Number(arg2) || 0;
    pitchBounds = normalizePitchBounds(arg3);
    attackDir = arg4 ?? 1;
  }

  const isVertical = pitchBounds.height > pitchBounds.width;

  let u, v;
  if (isVertical) {
    // Eje longitudinal es Y (altura)
    const rawLong = (y - pitchBounds.minY) / pitchBounds.height;
    const rawTrans = (x - pitchBounds.minX) / pitchBounds.width;
    u = attackDir === 1 ? rawLong : 1.0 - rawLong;
    v = attackDir === 1 ? rawTrans : 1.0 - rawTrans;
  } else {
    // Eje longitudinal es X (ancho horizontal clásico)
    const rawLong = (x - pitchBounds.minX) / pitchBounds.width;
    const rawTrans = (y - pitchBounds.minY) / pitchBounds.height;
    u = attackDir === 1 ? rawLong : 1.0 - rawLong;
    v = attackDir === 1 ? rawTrans : 1.0 - rawTrans;
  }

  const validU = Number.isFinite(u) ? u : 0.5;
  const validV = Number.isFinite(v) ? v : 0.5;

  return {
    u: Math.max(0, Math.min(0.9999, validU)),
    v: Math.max(0, Math.min(0.9999, validV)),
  };
}

/**
 * Convierte coordenadas relativas (u, v) a coordenadas de canvas (x, y)
 */
export function fromRelativeUV(u, v, pitchBounds, attackDir = 1) {
  const bounds = normalizePitchBounds(pitchBounds);
  const isVertical = bounds.height > bounds.width;

  const validU = Number.isFinite(u) ? u : 0.5;
  const validV = Number.isFinite(v) ? v : 0.5;
  const clampedU = Math.max(0, Math.min(0.9999, validU));
  const clampedV = Math.max(0, Math.min(0.9999, validV));

  if (isVertical) {
    const rawLong = attackDir === 1 ? clampedU : 1.0 - clampedU;
    const rawTrans = attackDir === 1 ? clampedV : 1.0 - clampedV;
    const y = bounds.minY + rawLong * bounds.height;
    const x = bounds.minX + rawTrans * bounds.width;
    return { x, y };
  } else {
    const rawLong = attackDir === 1 ? clampedU : 1.0 - clampedU;
    const rawTrans = attackDir === 1 ? clampedV : 1.0 - clampedV;
    const x = bounds.minX + rawLong * bounds.width;
    const y = bounds.minY + rawTrans * bounds.height;
    return { x, y };
  }
}

/**
 * Devuelve el número de Zona Táctica (1 a 18)
 */
export function getTacticalZone18(arg1, arg2, arg3, arg4) {
  const { u, v } = toRelativeUV(arg1, arg2, arg3, arg4);
  const row = Math.min(5, Math.max(0, Math.floor((Number.isFinite(u) ? u : 0.5) * 6))); // 0..5
  const col = Math.min(2, Math.max(0, Math.floor((Number.isFinite(v) ? v : 0.5) * 3))); // 0..2
  return ZONE_MATRIX[row]?.[col] ?? 14;
}

/**
 * Devuelve cuál de los 5 Carriles Verticales ocupa la posición
 */
export function getVerticalLane(arg1, arg2, arg3, arg4) {
  const { v } = toRelativeUV(arg1, arg2, arg3, arg4);
  if (v < 0.18) return LANES.LEFT_WING;
  if (v < 0.38) return LANES.LEFT_HALF_SPACE;
  if (v <= 0.62) return LANES.CENTER;
  if (v <= 0.82) return LANES.RIGHT_HALF_SPACE;
  return LANES.RIGHT_WING;
}

/**
 * Devuelve el valor de Amenaza Esperada (xThreat) de la zona
 */
export function getZoneXThreat(arg1, arg2, arg3, arg4) {
  const zone = getTacticalZone18(arg1, arg2, arg3, arg4);
  return ZONE_XTHREAT[zone] || 0.02;
}

/**
 * enforceRationalSpaceOccupation (Fase 6 — UPDATE FULBITO 2.2.md §6.3):
 * Verifica la matriz de ocupación espacial de los atacantes sin balón:
 * 1. Prohíbe que dos compañeros ocupen la misma celda (zone18, lane) simultáneamente.
 * 2. Si dos atacantes están a menos de 11m (110px) sobre la misma línea horizontal o vertical respecto al portador
 *    (ángulos llanos de 0° o 180° que permiten a un solo rival tapar a ambos), desplaza automáticamente al jugador de soporte
 *    hacia el carril adyacente (Half-Space libre) y escalona su altura en +-8m (+-80px) para formar triángulos (30° a 60°).
 */
export function enforceRationalSpaceOccupation(attackingPlayers, ball, pitchBounds = DEFAULT_PITCH_BOUNDS, attackDir = 1) {
  if (!Array.isArray(attackingPlayers) || attackingPlayers.length < 2) return;

  const bounds = normalizePitchBounds(pitchBounds);
  const ballX = Array.isArray(ball?.position) ? ball.position[0] : (ball?.x ?? 340);
  const ballY = Array.isArray(ball?.position) ? ball.position[1] : (ball?.y ?? 525);

  const activeAttackers = attackingPlayers.filter(p => {
    if (!p || p.redCard || p.sentOff || p.hasBall) return false;
    if (p.position === 'GK' || p.role === 'GK') return false;
    if (Array.isArray(p.currentPOS) && (p.currentPOS[0] === 'NP' || typeof p.currentPOS[0] !== 'number')) return false;
    return true;
  });

  const occupiedCells = new Map(); // key: `${zone18}_${lane}` -> player

  for (let i = 0; i < activeAttackers.length; i++) {
    const p1 = activeAttackers[i];
    const targetX = p1.offensiveTarget?.targetX ?? (Array.isArray(p1.intentPOS) ? p1.intentPOS[0] : (p1.currentPOS?.[0] ?? 340));
    const targetY = p1.offensiveTarget?.targetY ?? (Array.isArray(p1.intentPOS) ? p1.intentPOS[1] : (p1.currentPOS?.[1] ?? 525));

    const uv1 = toRelativeUV(targetX, targetY, bounds, attackDir);
    const z1 = getTacticalZone18([targetX, targetY], bounds, attackDir);
    const l1 = getVerticalLane([targetX, targetY], bounds, attackDir);
    const cellKey = `${z1}_${l1}`;

    // Conflicto 1: Misma celda exacta
    if (occupiedCells.has(cellKey)) {
      const pPrev = occupiedCells.get(cellKey);
      // El jugador de menor prioridad o soporte se desplaza a un Half-Space vecino
      const shiftV = l1 === LANES.CENTER ? (uv1.v < 0.5 ? 0.30 : 0.70) : (l1 <= LANES.LEFT_HALF_SPACE ? 0.50 : 0.50);
      const shiftU = Math.min(0.92, Math.max(0.15, uv1.u + (i % 2 === 0 ? 0.075 : -0.075)));
      const newPos = fromRelativeUV(shiftU, shiftV, bounds, attackDir);

      if (p1.offensiveTarget) {
        p1.offensiveTarget.targetX = Math.round(newPos.x);
        p1.offensiveTarget.targetY = Math.round(newPos.y);
        p1.offensiveTarget.adjustedByRationalSpace = true;
      }
      p1.intentPOS = [Math.round(newPos.x), Math.round(newPos.y)];
      continue;
    }

    // Conflicto 2: Menos de 110px en línea llana respecto al balón
    for (let j = 0; j < i; j++) {
      const p2 = activeAttackers[j];
      const p2TargetX = p2.offensiveTarget?.targetX ?? (Array.isArray(p2.intentPOS) ? p2.intentPOS[0] : (p2.currentPOS?.[0] ?? 340));
      const p2TargetY = p2.offensiveTarget?.targetY ?? (Array.isArray(p2.intentPOS) ? p2.intentPOS[1] : (p2.currentPOS?.[1] ?? 525));

      const dx = targetX - p2TargetX;
      const dy = targetY - p2TargetY;
      const dist = Math.hypot(dx, dy);

      if (dist < 110) {
        const angBall1 = Math.atan2(targetY - ballY, targetX - ballX);
        const angBall2 = Math.atan2(p2TargetY - ballY, p2TargetX - ballX);
        const diffAng = Math.abs(angBall1 - angBall2);

        // Alineación llana (casi colineales desde el balón: sombra de marca)
        if (diffAng < 0.26 || Math.abs(diffAng - Math.PI) < 0.26) {
          const shiftV = uv1.v < 0.5 ? Math.min(0.85, uv1.v + 0.18) : Math.max(0.15, uv1.v - 0.18);
          const shiftU = Math.min(0.92, Math.max(0.15, uv1.u + (dy >= 0 ? 0.08 : -0.08)));
          const shifted = fromRelativeUV(shiftU, shiftV, bounds, attackDir);

          if (p1.offensiveTarget) {
            p1.offensiveTarget.targetX = Math.round(shifted.x);
            p1.offensiveTarget.targetY = Math.round(shifted.y);
            p1.offensiveTarget.adjustedByTriangleGeometry = true;
          }
          p1.intentPOS = [Math.round(shifted.x), Math.round(shifted.y)];
          break;
        }
      }
    }

    occupiedCells.set(cellKey, p1);
  }
}

