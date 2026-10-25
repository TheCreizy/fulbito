// src/engine/player/cognition.js
import { getEffectiveSkill, hasTrait, PLAYER_TRAITS } from './effectiveSkill.js';

/**
 * Actualiza el estado cognitivo-perceptivo de cada jugador en cada tick:
 * 1) Exploración visual previa (Scanning) dependiente de perception + agility.
 * 2) Memoria de compañeros desmarcados para pases al primer toque (Tercer Hombre).
 * 3) Evaluación de estrés bajo presión (PPM) para micro-lapsos (psychology/lapse.rs).
 */
export function updatePlayerCognition(player, arg2, arg3, arg4, arg5) {
  let ownTeam, opposition, currentTick, ppmOverride, rng;
  if (typeof arg2 === 'number') {
    currentTick = arg2;
    ppmOverride = typeof arg3 === 'number' ? arg3 : undefined;
    rng = typeof arg4 === 'function' ? arg4 : Math.random;
  } else {
    ownTeam = arg2;
    opposition = arg3;
    currentTick = typeof arg4 === 'number' ? arg4 : 0;
    rng = typeof arg5 === 'function' ? arg5 : Math.random;
  }

  if (!player.cognition) {
    player.cognition = {
      lastScanTick: -99,
      lastScanIteration: 0,
      scanInterval: 12,
      isPreScanned: false,
      hasLapse: false,
      composureLapseTicks: 0,
      lapseUntilTick: 0,
      visionBonus: 1.0,
    };
  }

  const cog = player.cognition;
  cog.lastScanIteration = currentTick;
  const effPer = getEffectiveSkill(player, 'perception');
  const effAgi = getEffectiveSkill(player, 'agility');
  const effCon = getEffectiveSkill(player, 'control');
  const isPlaymaker = hasTrait(player, PLAYER_TRAITS.PLAYMAKER);

  // 1. Intervalo de rotación cervical (Scanning) antes de recibir o al conducir
  const baseInterval = Math.round(20 * (1.15 - (0.65 * effPer + 0.35 * effAgi)));
  cog.scanInterval = Math.max(3, Math.min(18, isPlaymaker ? baseInterval - 3 : baseInterval));

  const ppm = ppmOverride !== undefined ? ppmOverride : (player.pressurePPM || 0);

  // Si no tiene el balón o tiene presión moderada, actualiza su exploración visual (Scanning)
  if (!player.hasBall || ppm < 0.45) {
    if (currentTick - cog.lastScanTick >= cog.scanInterval) {
      cog.lastScanTick = currentTick;
      cog.isPreScanned = true;
    }
  } else if (currentTick - cog.lastScanTick > cog.scanInterval * 2.2 || ppm > 0.60) {
    // Si lleva mucho tiempo conduciendo acosado sin levantar la cabeza o presión extrema, pierde el pre-scanning
    cog.isPreScanned = false;
  }

  // 2. Evaluación de Micro-Lapso bajo presión intensa (PPM > 0.60)
  if (currentTick < cog.lapseUntilTick) {
    cog.hasLapse = true;
    cog.isPreScanned = false;
  } else {
    cog.hasLapse = false;
    if (player.hasBall && ppm > 0.60) {
      const composure = 0.55 * effPer + 0.45 * effCon + (isPlaymaker ? 0.12 : 0);
      const lapseProb = Math.max(0, (ppm - 0.58) * (1.05 - 0.85 * composure));
      if (rng() < Math.max(0.20, lapseProb)) {
        cog.hasLapse = true;
        cog.composureLapseTicks = 10;
        cog.lapseUntilTick = currentTick + 10;
        cog.isPreScanned = false;
      }
    }
  }

  // 3. Multiplicador cognitivo de visión y velocidad de decisión
  cog.visionBonus = cog.hasLapse
    ? 0.80
    : (cog.isPreScanned ? 1.0 + 0.18 * effPer : 0.95);

  return cog;
}
