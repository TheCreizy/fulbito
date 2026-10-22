// Motor de FUT Draft Táctico (Estilo FIFA Ultimate Team)
// Elección de formación, Selección de Capitán (5 Leyendas en 5 posiciones distintas),
// Probabilidades de categoría por sobre, 2 Rerolls y 12 puestos de Suplentes/Reservas.

import { PLAYERS_DB, clonePlayerForTeam } from '../data/playersDB.js'
import { FORMATIONS, getFormationCoordinates } from '../data/formations.js'
import { getPositionCompatibility, updateTeamEffectiveSkills } from '../engine/modifiers.js'

export const FUT_DRAFT_FORMATIONS = ['4-4-2', '4-3-1-2', '4-3-3', '4-2-3-1', '3-5-2', '5-3-2']

// Probabilidades de aparición de categoría en cada tirada de sobre
// Jerarquía balanceada y pareja: Plantel (28%) > Ídolo (26%) > Leyenda (24%) > Relleno (22%)
export const CATEGORY_PROBABILITIES = {
  squad: 0.28,   // 28% chance de sobre verde de Plantilla (la más alta)
  idol: 0.26,    // 26% chance de sobre púrpura de Ídolo
  legend: 0.24,  // 24% chance de sobre dorado de Leyenda
  filler: 0.22   // 22% chance de sobre plateado de Relleno (la menor)
}

export const TIER_CONFIG_INFO = {
  legend: {
    id: 'legend',
    name: 'Leyenda',
    plural: 'Leyendas',
    badge: '👑 LEYENDA',
    color: '#f59e0b',
    border: '#f59e0b',
    bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(180, 83, 9, 0.35) 100%)',
    range: 'OVR 93-99'
  },
  idol: {
    id: 'idol',
    name: 'Ídolo',
    plural: 'Ídolos',
    badge: '💎 ÍDOLO',
    color: '#a855f7',
    border: '#a855f7',
    bg: 'linear-gradient(135deg, rgba(168, 85, 247, 0.25) 0%, rgba(88, 28, 135, 0.35) 100%)',
    range: 'OVR 82-89'
  },
  squad: {
    id: 'squad',
    name: 'Plantilla',
    plural: 'Plantilla',
    badge: '🛡️ PLANTILLA',
    color: '#10b981',
    border: '#10b981',
    bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(6, 78, 59, 0.35) 100%)',
    range: 'OVR 72-79'
  },
  filler: {
    id: 'filler',
    name: 'Relleno',
    plural: 'Relleno',
    badge: '⚙️ RELLENO ESPECIALISTA',
    color: '#94a3b8',
    border: '#94a3b8',
    bg: 'linear-gradient(135deg, rgba(148, 163, 184, 0.25) 0%, rgba(51, 65, 85, 0.35) 100%)',
    range: 'OVR 74-78 (Pico 84-92)'
  }
}

// 12 Puestos de Banco en FUT Draft (5 Suplentes Directos + 7 Reservas, total 23 jugadores por equipo)
export const TOTAL_BENCH_COUNT = 12

export const BENCH_SLOTS = [
  // 5 Suplentes Directos
  { index: 0, label: 'ARQ SUP', role: 'GK', section: 'sub', desc: 'Arquero Suplente' },
  { index: 1, label: 'DEF SUP', role: 'CB', section: 'sub', desc: 'Defensor Central/Lateral' },
  { index: 2, label: 'MED SUP', role: 'CM', section: 'sub', desc: 'Volante / Mediocentro' },
  { index: 3, label: 'DEL SUP', role: 'ST', section: 'sub', desc: 'Delantero / Extremo' },
  { index: 4, label: 'COMODÍN', role: 'ANY', section: 'sub', desc: 'Relevo Polifuncional' },

  // 7 Reservas
  { index: 5, label: 'RES DEF 1', role: 'CB', section: 'res', desc: 'Reserva Defensiva' },
  { index: 6, label: 'RES MED 1', role: 'CM', section: 'res', desc: 'Reserva Mediocampo' },
  { index: 7, label: 'RES DEL 1', role: 'ST', section: 'res', desc: 'Reserva Delantera' },
  { index: 8, label: 'RES DEF 2', role: 'LB', section: 'res', desc: 'Reserva Lateral' },
  { index: 9, label: 'RES MED 2', role: 'CAM', section: 'res', desc: 'Reserva Creativa' },
  { index: 10, label: 'RES DEL 2', role: 'ST', section: 'res', desc: 'Reserva Ofensiva' },
  { index: 11, label: 'RES LIBRE', role: 'ANY', section: 'res', desc: 'Reserva Libre' }
]

/**
 * Devuelve 5 formaciones aleatorias sin repetir para la selección inicial.
 */
export function getFormationChoices(count = 5) {
  const shuffled = [...FUT_DRAFT_FORMATIONS].sort(() => 0.5 - Math.random())
  const selectedIds = shuffled.slice(0, Math.min(count, shuffled.length))
  return selectedIds.map(id => FORMATIONS[id])
}

/**
 * Agrupa posiciones en líneas generales para comodines y filtros ampliados.
 */
export function getLineFromRole(role) {
  if (role === 'GK') return 'GK'
  if (['CB', 'LB', 'RB'].includes(role)) return 'DEF'
  if (['CM', 'CAM', 'LM', 'RM'].includes(role)) return 'MID'
  if (['ST'].includes(role)) return 'ATT'
  return 'ANY'
}

/**
 * Verifica si un jugador puede jugar en el rol especificado
 * (como posición principal o secundaria natural).
 */
export function isPlayerCompatibleWithRole(player, targetRole) {
  if (targetRole === 'ANY') return true
  if (player.position === targetRole) return true
  if (Array.isArray(player.positions) && player.positions.includes(targetRole)) return true

  // Para roles de línea (DEF, MID, ATT) en el banco de suplentes
  const pLine = getLineFromRole(player.position)
  if (targetRole === 'DEF' && pLine === 'DEF') return true
  if (targetRole === 'MID' && pLine === 'MID') return true
  if (targetRole === 'ATT' && pLine === 'ATT') return true

  return false
}

/**
 * Sortea la categoría de sobre en base a las probabilidades de FUT Draft.
 * Jerarquía: Plantilla (28%) > Ídolo (26%) > Leyenda (24%) > Relleno (22%)
 */
export function rollCategoryByProbability() {
  const roll = Math.random()
  let cumulative = 0

  cumulative += CATEGORY_PROBABILITIES.squad
  if (roll <= cumulative) return 'squad'

  cumulative += CATEGORY_PROBABILITIES.idol
  if (roll <= cumulative) return 'idol'

  cumulative += CATEGORY_PROBABILITIES.legend
  if (roll <= cumulative) return 'legend'

  return 'filler'
}

/**
 * Genera el Sobre del Capitán:
 * Exactamente 5 Leyendas (OVR 93-99), cada una en una posición/línea diferente:
 * 1. Delantero Centro (ST)
 * 2. Mediocampista Central (CM)
 * 3. Enganche / Extremo (CAM, LM, RM)
 * 4. Defensor Central o Lateral (CB, LB, RB)
 * 5. Arquero (GK)
 */
export function getCaptainChoices(unavailableIdsSet = new Set()) {
  const allLegends = PLAYERS_DB.filter(p => p.category === 'legend' && !unavailableIdsSet.has(p.id))

  const lines = [
    { label: 'Delantero de Área', exactPositions: ['ST'] },
    { label: 'Mediocampista Central', exactPositions: ['CM'] },
    { label: 'Enganche / Extremo', exactPositions: ['LM', 'RM'] },
    { label: 'Defensor / Lateral', exactPositions: ['CB', 'LB', 'RB'] },
    { label: 'Arquero Legendario', exactPositions: ['GK'] }
  ]

  const selectedLegends = []
  const usedCaptainIds = new Set()
  const usedPositions = new Set()

  lines.forEach(line => {
    const candidates = allLegends.filter(p => {
      if (usedCaptainIds.has(p.id)) return false
      if (usedPositions.has(p.position)) return false
      return line.exactPositions.includes(p.position)
    })

    if (candidates.length > 0) {
      const chosen = candidates[Math.floor(Math.random() * candidates.length)]
      usedCaptainIds.add(chosen.id)
      usedPositions.add(chosen.position)
      selectedLegends.push({
        ...clonePlayerForTeam(chosen),
        captainLine: line.label
      })
    }
  })

  // Si aún faltasen para 5, completar con cualquier leyenda de posición no repetida
  if (selectedLegends.length < 5) {
    const remainingLegends = allLegends.filter(p => !usedCaptainIds.has(p.id))
    for (const leg of remainingLegends) {
      if (selectedLegends.length >= 5) break
      if (!usedPositions.has(leg.position)) {
        usedCaptainIds.add(leg.id)
        usedPositions.add(leg.position)
        selectedLegends.push(clonePlayerForTeam(leg))
      }
    }
  }

  // Fallback final
  if (selectedLegends.length < 5) {
    const remainingLegends = allLegends.filter(p => !usedCaptainIds.has(p.id))
    for (const leg of remainingLegends) {
      if (selectedLegends.length >= 5) break
      usedCaptainIds.add(leg.id)
      selectedLegends.push(clonePlayerForTeam(leg))
    }
  }

  return selectedLegends.sort((a, b) => b.rating - a.rating)
}

/**
 * Genera 5 cartas candidatas del tier sorteado para la posición elegida.
 * Garantiza que las 5 cartas pertenezcan a esa categoría monomarca.
 */
export function getCandidatesForPositionAndCategory(role, category, unavailableIdsSet = new Set()) {
  // 1. Filtrar jugadores de esa categoría exacta compatibles con el rol
  let pool = PLAYERS_DB.filter(p => {
    if (unavailableIdsSet.has(p.id)) return false
    if (p.category !== category) return false
    return isPlayerCompatibleWithRole(p, role)
  })

  // 2. Si hay menos de 5 disponibles (ej: puestos específicos como GK leyenda o RB leyenda ya elegidos):
  // Ampliar primero a la misma línea dentro de esa categoría
  if (pool.length < 5) {
    const roleLine = getLineFromRole(role)
    const linePool = PLAYERS_DB.filter(p => {
      if (unavailableIdsSet.has(p.id)) return false
      if (p.category !== category) return false
      if (pool.some(c => c.id === p.id)) return false
      return roleLine === 'ANY' ? true : getLineFromRole(p.position) === roleLine
    })
    const needed = 5 - pool.length
    pool = [...pool, ...linePool.slice(0, needed)]
  }

  // 3. Si aún faltasen jugadores para 5 (agotamiento extremo de esa categoría en ese sector):
  // Completar con jugadores compatibles del rol en la categoría adyacente más cercana
  if (pool.length < 5) {
    const adjacentCats = category === 'legend'
      ? ['idol', 'squad']
      : (category === 'idol' ? ['legend', 'squad'] : (category === 'squad' ? ['idol', 'filler'] : ['squad', 'idol']))

    for (const adjCat of adjacentCats) {
      if (pool.length >= 5) break
      const adjPool = PLAYERS_DB.filter(p => {
        if (unavailableIdsSet.has(p.id)) return false
        if (p.category !== adjCat) return false
        if (pool.some(c => c.id === p.id)) return false
        return isPlayerCompatibleWithRole(p, role)
      })
      const needed = 5 - pool.length
      pool = [...pool, ...adjPool.slice(0, needed)]
    }
  }

  // Si aún faltaran:
  if (pool.length < 5) {
    const remaining = PLAYERS_DB.filter(p => !unavailableIdsSet.has(p.id) && !pool.some(c => c.id === p.id))
    const needed = 5 - pool.length
    pool = [...pool, ...remaining.slice(0, needed)]
  }

  // Barajar suavemente para que no salgan siempre en el mismo orden
  const shuffled = [...pool].sort(() => 0.5 - Math.random())
  const finalFive = shuffled.slice(0, 5).map(clonePlayerForTeam)

  // Ordenar el sobre de mayor a menor rating
  return finalFive.sort((a, b) => b.rating - a.rating || b.price - a.price)
}

/**
 * Selección de IA para FUT Draft: evalúa rating, compatibilidad y atributos.
 */
export function selectAIFutDraftCard(candidates, targetRole = 'ANY') {
  if (!candidates || candidates.length === 0) return null
  let best = candidates[0]
  let bestScore = -1

  for (const c of candidates) {
    const compat = targetRole === 'ANY' ? { factor: 1.0 } : getPositionCompatibility(c, targetRole)
    const primaryBonus = c.position === targetRole ? 1.04 : 1.0
    const noise = 0.96 + Math.random() * 0.08
    const score = c.rating * compat.factor * primaryBonus * noise
    if (score > bestScore) {
      bestScore = score
      best = c
    }
  }

  return best
}

/**
 * Encuentra el siguiente slot vacío para la IA:
 * Prioriza primero los 11 titulares de arco a delantera, luego los 12 suplentes.
 */
export function getNextEmptyAISlot(formationSlots, starters, bench) {
  // Primero revisar titulares
  for (let i = 0; i < 11; i++) {
    if (!starters[i]) {
      return { type: 'starter', index: i, role: formationSlots[i].role, label: formationSlots[i].label }
    }
  }
  // Luego suplentes
  for (let i = 0; i < TOTAL_BENCH_COUNT; i++) {
    if (!bench[i]) {
      return { type: 'bench', index: i, role: BENCH_SLOTS[i].role, label: BENCH_SLOTS[i].label }
    }
  }
  return null
}

/**
 * Asigna al Capitán elegido al slot titular más adecuado de la formación.
 */
export function placeCaptainInFormation(captainPlayer, formationSlots, currentStarters) {
  // 1. Buscar si hay un slot exacto con su posición principal
  for (let i = 0; i < 11; i++) {
    if (!currentStarters[i] && formationSlots[i].role === captainPlayer.position) {
      return i
    }
  }

  // 2. Buscar si hay un slot compatible con sus posiciones secundarias
  const allPositions = Array.isArray(captainPlayer.positions) ? captainPlayer.positions : [captainPlayer.position]
  for (let i = 0; i < 11; i++) {
    if (!currentStarters[i] && allPositions.includes(formationSlots[i].role)) {
      return i
    }
  }

  // 3. Si no, buscar por línea general (GK, DEF, MID, ATT)
  const capLine = getLineFromRole(captainPlayer.position)
  for (let i = 0; i < 11; i++) {
    if (!currentStarters[i] && getLineFromRole(formationSlots[i].role) === capLine) {
      return i
    }
  }

  // 4. Fallback al primer slot vacío
  for (let i = 0; i < 11; i++) {
    if (!currentStarters[i]) return i
  }

  return 0
}

/**
 * Construye el objeto de equipo oficial a partir del FUT Draft completado.
 * Admite 11 titulares + 12 suplentes/reservas y fija el Capitán oficial.
 */
export function buildTeamFromFutDraft(formationId, startersArray, benchArray, teamConfig = {}, customCaptainId = null) {
  const teamName = teamConfig.name || 'Mi Equipo FUT'
  const primaryColor = teamConfig.primaryColor || '#1d4ed8'
  const secondaryColor = teamConfig.secondaryColor || '#facc15'
  const mentalityId = teamConfig.mentalityId || 'balanced'
  const playStyleId = teamConfig.playStyleId || FORMATIONS[formationId]?.defaultPlayStyle || 'balanced'

  const slots = getFormationCoordinates(formationId, mentalityId, 'top')
  const starters = startersArray.map((p, idx) => {
    const cloned = clonePlayerForTeam(p)
    const slot = slots[idx] || slots[0]
    cloned.tacticalRole = slot.role
    cloned.currentPOS = slot.coords.slice()
    cloned.originPOS = slot.coords.slice()
    cloned.intentPOS = slot.coords.slice()
    cloned.shirtNumber = idx + 1
    return cloned
  })

  const bench = benchArray.map((p, idx) => {
    const cloned = clonePlayerForTeam(p)
    cloned.shirtNumber = 12 + idx
    cloned.currentPOS = [0, 0]
    cloned.originPOS = [0, 0]
    cloned.intentPOS = [0, 0]
    return cloned
  })

  // Capitán y Pelota Parada automáticos
  const designatedCaptainID = customCaptainId || starters.find(p => p.isCaptain)?.id || starters[0]?.id

  const byPenalties = [...starters].sort((a, b) => b.skill.penalty_taking - a.skill.penalty_taking)
  const fieldStarters = starters.filter((_, idx) => idx > 0)
  const byFreekicks = [...fieldStarters].sort((a, b) => b.skill.freekick - a.skill.freekick)
  const byCorners = [...fieldStarters].sort((a, b) => b.skill.passing - a.skill.passing)

  const avgRating = Math.round(starters.reduce((sum, p) => sum + Number(p.rating), 0) / 11)

  const teamObject = {
    name: teamName,
    rating: avgRating,
    primaryColor,
    secondaryColor,
    formation: formationId,
    mentality: mentalityId,
    playStyle: playStyleId,
    substitutionsUsed: 0,
    maxSubstitutions: 5,
    setPieces: {
      captainID: designatedCaptainID,
      penaltyTakerID: byPenalties[0]?.id,
      freekickTakerID: byFreekicks[0]?.id,
      cornerTakerID: byCorners[0]?.id
    },
    players: starters,
    bench
  }

  updateTeamEffectiveSkills(teamObject)
  return teamObject
}
