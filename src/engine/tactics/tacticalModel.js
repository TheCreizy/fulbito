/**
 * tacticalModel.js — Modelo Táctico Integral de Fulbito 2.2
 * 
 * Modela las alturas de bloque (LOW_BLOCK, MID_BLOCK, HIGH_PRESS),
 * la anchura de ocupación espacial (COMPACT, BALANCED, WIDE)
 * y la fluidez táctica para la genealogía de 3, 4 y 5 defensores.
 */

import { DUTIES, getRoleMovementBias } from './rolesAndDuties.js';

export const BLOCK_HEIGHTS = {
  LOW_BLOCK: {
    id: 'LOW_BLOCK',
    name: 'Bloque Bajo / Repliegue Intensivo',
    defensiveLineYPx: 180,
    pressingLineYPx: 380,
    compactness: 0.85
  },
  MID_BLOCK: {
    id: 'MID_BLOCK',
    name: 'Bloque Medio / Compacto',
    defensiveLineYPx: 290,
    pressingLineYPx: 525,
    compactness: 1.00
  },
  HIGH_PRESS: {
    id: 'HIGH_PRESS',
    name: 'Bloque Alto / Presión Asfixiante',
    defensiveLineYPx: 420,
    pressingLineYPx: 720,
    compactness: 1.15
  }
};

export const BLOCK_WIDTHS = {
  COMPACT: { id: 'COMPACT', widthMultiplier: 0.80 },
  BALANCED: { id: 'BALANCED', widthMultiplier: 1.00 },
  WIDE: { id: 'WIDE', widthMultiplier: 1.20 }
};

export const TACTICAL_FLUIDITY = {
  STRUCTURED: { id: 'STRUCTURED', freedomMultiplier: 0.70 },
  FLUID: { id: 'FLUID', freedomMultiplier: 1.00 },
  VERY_FLUID: { id: 'VERY_FLUID', freedomMultiplier: 1.30 }
};

/**
 * Calcula las dimensiones y líneas del bloque táctico según la configuración
 * 
 * @param {string} blockHeightId 
 * @param {string} blockWidthId 
 * @param {number[]} pitchSize - [width, height]
 * @returns {Object}
 */
export function computeTacticalBlockDimensions(blockHeightId = 'MID_BLOCK', blockWidthId = 'BALANCED', pitchSize = [680, 1050]) {
  const heightConfig = BLOCK_HEIGHTS[blockHeightId] || BLOCK_HEIGHTS.MID_BLOCK;
  const widthConfig = BLOCK_WIDTHS[blockWidthId] || BLOCK_WIDTHS.BALANCED;
  const [pitchWidth, pitchHeight] = pitchSize;

  const baseWidth = pitchWidth * 0.75 * widthConfig.widthMultiplier;

  return {
    blockHeightId: heightConfig.id,
    defensiveLineY: heightConfig.defensiveLineYPx,
    pressingLineY: heightConfig.pressingLineYPx,
    effectiveWidth: Math.min(pitchWidth, baseWidth),
    compactness: heightConfig.compactness
  };
}

/**
 * Ajusta la posición objetivo (u, v / x, y) de un jugador aplicando su rol funcional,
 * duty y la altura de bloque táctico del equipo.
 * 
 * @param {number[]} targetPOS - [x, y]
 * @param {Object} player - Jugador
 * @param {Object} tactics - Configuración táctica { blockHeight, blockWidth, inPossession }
 * @param {boolean} isTopTeam - Si defiende arco Y=0
 * @returns {number[]} Coordenadas ajustadas
 */
export function adjustPlayerTargetByTacticalModel(targetPOS, player, tactics = {}, isTopTeam = true) {
  if (!Array.isArray(targetPOS)) return [340, 525];
  const adjusted = [...targetPOS];

  if (!player || player.position === 'GK') return adjusted;

  const roleBias = getRoleMovementBias(player.tacticalRoleCode, player.duty);
  const forwardBias = roleBias.forwardBiasPx;

  const direction = isTopTeam ? 1 : -1;
  const blockConfig = BLOCK_HEIGHTS[tactics.blockHeight || 'MID_BLOCK'] || BLOCK_HEIGHTS.MID_BLOCK;

  // Si el equipo no tiene el balón, las líneas se ajustan hacia la altura de bloque
  if (!tactics.inPossession) {
    const isDefender = ['CB_STOPPER', 'CB_BALL_PLAYING', 'SW_LIBERO', 'FB_FULLBACK', 'WB_WINGBACK'].includes(player.tacticalRoleCode);
    if (isDefender) {
      const targetBlockY = isTopTeam ? blockConfig.defensiveLineYPx : (1050 - blockConfig.defensiveLineYPx);
      adjusted[1] = adjusted[1] * 0.40 + targetBlockY * 0.60;
    }
  } else {
    // En posesión, aplica el sesgo ofensivo del Rol y Tarea (Duty)
    adjusted[1] += forwardBias * direction * 0.35;
  }

  return adjusted;
}
