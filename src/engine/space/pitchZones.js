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

  return {
    u: Math.max(0, Math.min(0.9999, u)),
    v: Math.max(0, Math.min(0.9999, v)),
  };
}

/**
 * Convierte coordenadas relativas (u, v) a coordenadas de canvas (x, y)
 */
export function fromRelativeUV(u, v, pitchBounds, attackDir = 1) {
  const bounds = normalizePitchBounds(pitchBounds);
  const isVertical = bounds.height > bounds.width;

  const clampedU = Math.max(0, Math.min(0.9999, u));
  const clampedV = Math.max(0, Math.min(0.9999, v));

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
  const row = Math.min(5, Math.max(0, Math.floor(u * 6))); // 0..5
  const col = Math.min(2, Math.max(0, Math.floor(v * 3))); // 0..2
  return ZONE_MATRIX[row][col];
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
