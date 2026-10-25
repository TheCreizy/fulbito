// src/engine/player/effectiveSkill.js

export const PLAYER_TRAITS = {
  PLAYMAKER: 'PLAYMAKER',
  CLINICAL_FINISHER: 'CLINICAL_FINISHER',
  LONG_SHOT_SPECIALIST: 'LONG_SHOT_SPECIALIST',
  SPEED_DRIBBLER: 'SPEED_DRIBBLER',
  BALL_WINNER: 'BALL_WINNER',
  SWEEPER_KEEPER: 'SWEEPER_KEEPER',
};

/**
 * Calcula el multiplicador de Química [0.85 .. 1.15] para cada jugador del plantel
 * evaluando vínculos de Nacionalidad, Club y Liga con sus compañeros o química de FUT Draft.
 */
export function computeSquadChemistryMultipliers(team) {
  const players = Array.isArray(team) ? team : (team?.players || []);
  if (!players.length) return;

  // Si el equipo ya trae un rating global de química de FUT Draft (0..100)
  const teamBaseChem = typeof team?.chemistry === 'number' ? Math.max(0, Math.min(100, team.chemistry)) / 100 : null;

  for (const player of players) {
    let chemNorm = 0.66; // Base neutral (equivale a mu_chem = 1.05)

    const tier = String(player.tier || '').toLowerCase();
    const isLegend = player.isLegend || tier === 'legend' || (player.rating && player.rating >= 93);

    if (isLegend) {
      chemNorm = 1.0; // Leyendas universales gozan de química perfecta siempre
    } else if (typeof player.chemistry === 'number') {
      chemNorm = Math.max(0, Math.min(10, player.chemistry)) / 10;
    } else if (teamBaseChem !== null) {
      chemNorm = teamBaseChem;
    } else {
      // Cálculo por enlaces de afinidad (Nacionalidad, Club, Liga) entre compañeros
      let linkPoints = 0;
      for (const mate of players) {
        if ((mate.id || mate.playerID) === (player.id || player.playerID)) continue;
        if (player.nationality && mate.nationality && player.nationality === mate.nationality) linkPoints += 1.0;
        if (player.club && mate.club && player.club === mate.club) linkPoints += 1.5;
        if (player.league && mate.league && player.league === mate.league) linkPoints += 0.8;
      }
      // Ídolos aportan vínculo universal positivo
      if (tier === 'idol' || (player.rating && player.rating >= 84)) linkPoints += 2.0;

      chemNorm = Math.max(0.20, Math.min(1.0, 0.35 + linkPoints / 10.0));
    }

    // Mapeo exacto del Compendio Táctico: mu_chem en [0.85, 1.15]
    player.chemistryMultiplier = Number((0.85 + 0.30 * chemNorm).toFixed(3));
    const traits = inferPlayerTraits(player);
    player.activeTraits = traits;
    player.ActiveTraits = traits;
  }
}

/**
 * Combina traits declarados en la carta con traits inferidos por sus picos biomecánicos y Tier.
 */
export function inferPlayerTraits(player) {
  const traits = new Set(Array.isArray(player.traits) ? player.traits : []);
  const s = player.skill || player.stats || player;

  const passing = Number(s.passing ?? player.passing ?? 70);
  const shooting = Number(s.shooting ?? player.shooting ?? 70);
  const tackling = Number(s.tackling ?? player.tackling ?? 70);
  const agility = Number(s.agility ?? player.agility ?? 70);
  const control = Number(s.control ?? s.dribbling ?? player.control ?? 70);
  const perception = Number(s.perception ?? s.vision ?? player.perception ?? 70);
  const strength = Number(s.strength ?? player.strength ?? 70);
  const pos = String(player.position || player.role || '').toUpperCase();

  if (pos === 'GK' || pos === 'POR') {
    if (perception >= 78 || passing >= 70) traits.add(PLAYER_TRAITS.SWEEPER_KEEPER);
    const res = Array.from(traits);
    player.activeTraits = res;
    player.ActiveTraits = res;
    return res;
  }

  if (passing >= 84 && perception >= 82) traits.add(PLAYER_TRAITS.PLAYMAKER);
  if (shooting >= 84 && (pos.includes('DEL') || pos === 'ST' || pos === 'CF' || control >= 80)) traits.add(PLAYER_TRAITS.CLINICAL_FINISHER);
  if (shooting >= 80 && (strength >= 75 || perception >= 80)) traits.add(PLAYER_TRAITS.LONG_SHOT_SPECIALIST);
  if (control >= 84 && agility >= 83) traits.add(PLAYER_TRAITS.SPEED_DRIBBLER);
  if (tackling >= 83 && perception >= 78) traits.add(PLAYER_TRAITS.BALL_WINNER);

  const res = Array.from(traits);
  player.activeTraits = res;
  player.ActiveTraits = res;
  return res;
}

export function hasTrait(player, traitName) {
  if (!player) return false;
  if (!player.activeTraits && !player.ActiveTraits) {
    const traits = inferPlayerTraits(player);
    player.activeTraits = traits;
    player.ActiveTraits = traits;
  }
  const list = player.activeTraits || player.ActiveTraits || [];
  return list.includes(traitName);
}

/**
 * Patrón Effective Skill (DESIGN-PATTERNS.md #5):
 * Devuelve el atributo efectivo normalizado [0.05 .. 1.15] aplicando Química, Fatiga y Compostura/Lapso.
 */
export function getEffectiveSkill(player, statName) {
  const s = player?.skill || player?.stats || player;
  const raw = s?.[statName] ?? player?.[statName] ?? 70;
  const baseNorm = Math.max(0.10, Math.min(0.99, Number(raw) / 100));
  const chem = player?.chemistryMultiplier ?? 1.0;

  // Penalización suave por fatiga acumulada solo cuando el cansancio baja del 65%
  const stamina = player?.fitness ?? player?.stamina ?? player?.condition ?? 100;
  const fatigueFactor = stamina < 65 ? Math.max(0.78, 0.78 + ((stamina / 65) * 0.22)) : 1.0;

  // Penalización si el jugador sufrió un micro-lapso cognitivo por presión extrema en este tick
  const lapsePenalty = player?.cognition?.hasLapse ? 0.82 : 1.0;

  return Math.max(0.08, Math.min(1.18, baseNorm * chem * fatigueFactor * lapsePenalty));
}
