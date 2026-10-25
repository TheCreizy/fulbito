// src/engine/tactics/offensiveShape.js
import { toRelativeUV, fromRelativeUV, getVerticalLane, LANES, DEFAULT_PITCH_BOUNDS } from '../space/pitchZones.js';
import { resolvePlayerLine } from '../teamShape.js';

function getPlayerCoords(p) {
  if (!p) return { x: 340, y: 525 };
  if (Array.isArray(p)) return { x: p[0], y: p[1] };
  if (Array.isArray(p.currentPOS)) return { x: p.currentPOS[0], y: p.currentPOS[1] };
  return { x: p.x ?? 340, y: p.y ?? 525 };
}

function getBallCoords(b) {
  if (!b) return { x: 340, y: 525 };
  if (Array.isArray(b)) return { x: b[0], y: b[1] };
  if (Array.isArray(b.position)) return { x: b.position[0], y: b.position[1] };
  return { x: b.x ?? 340, y: b.y ?? 525 };
}

/**
 * Calcula la línea del fuera de juego rival (coordenada Y del penúltimo rival, incluyendo arquero).
 */
export function computeOffsideLineY(opponents, isTopAttacking, pitchBounds = DEFAULT_PITCH_BOUNDS) {
  const ys = (opponents || [])
    .filter(o => !o.redCard && !o.sentOff)
    .map(o => getPlayerCoords(o).y)
    .sort((a, b) => (isTopAttacking ? b - a : a - b)); // Ordenados desde el más cercano a su propia meta

  const secondLastDefenderY = ys.length >= 2 ? ys[1] : (isTopAttacking ? pitchBounds.height - 80 : 80);
  const midfieldY = pitchBounds.height / 2;

  return isTopAttacking
    ? Math.max(midfieldY, secondLastDefenderY)
    : Math.min(midfieldY, secondLastDefenderY);
}

/**
 * Asigna estados y coordenadas objetivo dinámicas (offensiveTarget) para los 10 jugadores de campo
 * del equipo EN POSESIÓN del balón (Fase 3: Overlaps, Underlaps, Rupturas y 4 Zonas de Remate).
 */
export function assignOffensiveSupportRoles(attackingTeam, defendingTeam, ball, pitchBounds = DEFAULT_PITCH_BOUNDS) {
  const players = attackingTeam?.players || [];
  const opponents = defendingTeam?.players || [];
  if (!players.length) return new Map();

  const gk = players.find(p => p.position === 'GK' || p.role === 'GK') || players[0];
  const isTopTeam = gk.originPOS ? gk.originPOS[1] < pitchBounds.height / 2 : true;
  const attackDir = isTopTeam ? 1 : -1;

  const bCoords = getBallCoords(ball);
  const ballUV = toRelativeUV(bCoords.x, bCoords.y, pitchBounds, attackDir);
  const offsideLineY = computeOffsideLineY(opponents, isTopTeam, pitchBounds);
  const offsideUV = toRelativeUV(340, offsideLineY, pitchBounds, attackDir);
  const safeOffsideU = Math.min(0.94, Math.max(0.50, offsideUV.u - 0.018));

  const roles = new Map();

  // 1. Identificar Laterales (fullbacks) vs Centrales en la línea DEF
  const defenders = players.filter(p => resolvePlayerLine(p) === 'DEF' && !p.redCard && !p.sentOff);
  const sortedDefsByX = [...defenders].sort((a, b) => {
    const aX = a.originPOS ? a.originPOS[0] : getPlayerCoords(a).x;
    const bX = b.originPOS ? b.originPOS[0] : getPlayerCoords(b).x;
    return aX - bX;
  });

  const leftBack = sortedDefsByX.length >= 3 ? sortedDefsByX[0] : null;
  const rightBack = sortedDefsByX.length >= 3 ? sortedDefsByX[sortedDefsByX.length - 1] : null;

  // Determinar qué banda es el "lado fuerte" (ball-side) para permitir proyección agresiva
  const ballOnLeftSide = (bCoords.x < pitchBounds.width * 0.55);
  const ballOnRightSide = (bCoords.x >= pitchBounds.width * 0.45);

  // Detectar si estamos en situación de centro / desborde profundo (activar las 4 Zonas de Remate)
  const isCrossingSituation = ballUV.u >= 0.70 && (ballUV.v < 0.28 || ballUV.v > 0.72);
  let boxSlotsAssigned = 0;

  for (const player of players) {
    const pId = player.id || player.playerID;
    if (player.position === 'GK' || player.role === 'GK' || player.redCard || player.sentOff || player.hasBall) continue;

    const line = resolvePlayerLine(player);
    const pCoords = getPlayerCoords(player);
    const originX = player.originPOS ? player.originPOS[0] : pCoords.x;
    const originY = player.originPOS ? player.originPOS[1] : pCoords.y;
    const baseUV = toRelativeUV(originX, originY, pitchBounds, attackDir);

    // --- A. COMPORTAMIENTO DE LATERALES Y CARRILEROS (OVERLAP / UNDERLAP / REST DEFENCE) ---
    if (line === 'DEF') {
      const isLeftBack = leftBack && (player.id || player.playerID) === (leftBack.id || leftBack.playerID);
      const isRightBack = rightBack && (player.id || player.playerID) === (rightBack.id || rightBack.playerID);

      if ((isLeftBack && ballOnLeftSide && ballUV.u >= 0.30) || (isRightBack && ballOnRightSide && ballUV.u >= 0.30)) {
        // Verificar si hay un compañero ofensivo abierto en esa misma banda adelante
        const wingTeammateWide = players.some(m => {
          const mId = m.id || m.playerID;
          if (mId === pId || resolvePlayerLine(m) === 'DEF') return false;
          const mCoords = getPlayerCoords(m);
          return (
            Math.abs(mCoords.x - pCoords.x) < 110 &&
            (mCoords.x < 140 || mCoords.x > 540) &&
            toRelativeUV(mCoords.x, mCoords.y, pitchBounds, attackDir).u > ballUV.u
          );
        });

        const targetU = Math.min(safeOffsideU, Math.max(baseUV.u + 0.26, ballUV.u + 0.12));
        if (wingTeammateWide) {
          // UNDERLAP: El extremo fija abierto en la cal, el lateral rompe por el Half-Space interior (Zonas 10/12 -> 16/18)
          const underlapV = isLeftBack ? (attackDir === 1 ? 0.26 : 0.74) : (attackDir === 1 ? 0.74 : 0.26);
          const pt = fromRelativeUV(targetU, underlapV, pitchBounds, attackDir);
          roles.set(pId, { state: 'UNDERLAPPING', targetX: pt.x, targetY: pt.y });
        } else {
          // OVERLAP: El lateral pasa como una locomotora por la banda exterior (Zonas 13/15)
          const overlapV = isLeftBack ? (attackDir === 1 ? 0.08 : 0.92) : (attackDir === 1 ? 0.92 : 0.08);
          const pt = fromRelativeUV(targetU, overlapV, pitchBounds, attackDir);
          roles.set(pId, { state: 'OVERLAPPING', targetX: pt.x, targetY: pt.y });
        }
        continue;
      }

      if (isLeftBack || isRightBack) {
        // Lateral del lado débil: sube moderadamente al mediocampo (Zonas 7/8/9) cerrándose para dar equilibrio y opción de reciclaje
        const supportU = Math.min(0.56, Math.max(baseUV.u + 0.12, ballUV.u - 0.08));
        const tuckedV = baseUV.v + (0.5 - baseUV.v) * 0.28;
        const pt = fromRelativeUV(supportU, tuckedV, pitchBounds, attackDir);
        roles.set(pId, { state: 'FULLBACK_SUPPORT', targetX: pt.x, targetY: pt.y });
        continue;
      }

      // Centrales (Rest Defence): adelantan la línea hasta mediocampo para sostener el bloque corto
      const cbU = Math.min(0.48, Math.max(baseUV.u, ballUV.u - 0.24));
      const pt = fromRelativeUV(cbU, baseUV.v, pitchBounds, attackDir);
      roles.set(pId, { state: 'REST_DEFENCE_CB', targetX: pt.x, targetY: pt.y });
      continue;
    }

    // --- B. ATAQUE COORDINADO A LAS 4 ZONAS DE REMATE EN SITUACIÓN DE CENTRO ---
    if (isCrossingSituation && (line === 'ATT' || line === 'MID') && boxSlotsAssigned < 4) {
      boxSlotsAssigned++;
      const goalY = isTopTeam ? pitchBounds.height - 15 : 15;
      const dirSign = isTopTeam ? -1 : 1; // Hacia adentro del campo desde la línea de meta
      const ballOnLeftCanvas = bCoords.x < 340;

      let targetX = 340;
      let targetY = goalY + dirSign * 95;

      if (boxSlotsAssigned === 1) {
        // Zona 1 de Remate: Primer Palo (Near Post)
        targetX = ballOnLeftCanvas ? 295 : 385;
        targetY = goalY + dirSign * 58;
      } else if (boxSlotsAssigned === 2) {
        // Zona 2 de Remate: Punto Penal (Penalty Spot)
        targetX = 340;
        targetY = goalY + dirSign * 98;
      } else if (boxSlotsAssigned === 3) {
        // Zona 3 de Remate: Segundo Palo (Far Post)
        targetX = ballOnLeftCanvas ? 395 : 285;
        targetY = goalY + dirSign * 65;
      } else {
        // Zona 4 de Remate: Borde del Área / Cutback (Zona 14)
        targetX = 340 + (ballOnLeftCanvas ? -25 : 25);
        targetY = goalY + dirSign * 165;
      }

      roles.set(pId, { state: `BOX_ZONE_${boxSlotsAssigned}`, targetX, targetY });
      continue;
    }

    // --- C. MEDIOCAMPISTAS: TRIÁNGULOS, HALF-SPACES Y TERCER HOMBRE ---
    if (line === 'MID') {
      // Si es el mediocampista más retrasado, actúa como Pivote de reciclaje detrás del balón (Zona 8/11)
      const isDeepestMid = baseUV.u < 0.42;
      if (isDeepestMid) {
        const pivotU = Math.min(0.66, Math.max(0.32, ballUV.u - 0.10));
        const pivotV = 0.5 + (ballUV.v - 0.5) * 0.45; // Bascula para ofrecer línea de pase segura (Vía de Escape)
        const pt = fromRelativeUV(pivotU, pivotV, pitchBounds, attackDir);
        roles.set(pId, { state: 'PIVOT_RECYCLE_SUPPORT', targetX: pt.x, targetY: pt.y });
      } else {
        // Interiores y Mediapuntas: atacan los Half-Spaces (Zonas 10, 12 y Zona 14) formando diamantes
        const advU = Math.min(safeOffsideU, Math.max(baseUV.u + 0.14, ballUV.u + 0.08));
        // Evitar el mismo carril vertical que el poseedor para abrir ángulo diagonal de triángulo
        let targetV = baseUV.v;
        if (Math.abs(targetV - ballUV.v) < 0.12) {
          targetV = targetV < 0.5 ? 0.28 : 0.72; // Ubicarse en Half-Space
        }
        const pt = fromRelativeUV(advU, targetV, pitchBounds, attackDir);
        roles.set(pId, { state: 'HALF_SPACE_CREATING', targetX: pt.x, targetY: pt.y });
      }
      continue;
    }

    // --- D. DELANTEROS SIN BALÓN: RUPTURA DIAGONAL AL ESPACIO E INTERACCIÓN CON OFFSIDE ---
    if (line === 'ATT') {
      // El delantero ataca la línea de offside rival trazando una diagonal hacia el intervalo libre
      const runU = safeOffsideU;
      // Si el balón viene por banda, el extremo opuesto cierra al segundo palo y el 9 ataca el centro
      let runV = baseUV.v;
      if (Math.abs(baseUV.v - 0.5) < 0.18) {
        // Centrodelantero ("9"): se desmarca ligeramente en diagonal al punto ciego del central
        runV = 0.5 + (ballUV.v < 0.5 ? 0.08 : -0.08);
      } else {
        // Extremo: si el lateral de su banda está haciendo OVERLAP, el extremo se mete al Half-Space interior
        const myFullbackOverlapping = (leftBack && roles.get(leftBack.id || leftBack.playerID)?.state === 'OVERLAPPING' && pCoords.x < 340) ||
                                      (rightBack && roles.get(rightBack.id || rightBack.playerID)?.state === 'OVERLAPPING' && pCoords.x >= 340);
        if (myFullbackOverlapping) {
          runV = baseUV.v < 0.5 ? (attackDir === 1 ? 0.30 : 0.70) : (attackDir === 1 ? 0.70 : 0.30);
        }
      }

      const pt = fromRelativeUV(runU, runV, pitchBounds, attackDir);
      roles.set(pId, { state: 'RUNNING_IN_BEHIND', targetX: pt.x, targetY: pt.y });
    }
  }

  return roles;
}
