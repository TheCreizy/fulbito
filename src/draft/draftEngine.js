// Motor de Draft por Presupuesto ($280M, 18 Rondas, Sobres de 7 Cartas, Reroll $2M e IA Competitiva)

import { PLAYERS_DB, clonePlayerForTeam } from '../data/playersDB.js'
import { FORMATIONS, getFormationCoordinates } from '../data/formations.js'
import { getPositionCompatibility, updateTeamEffectiveSkills } from '../engine/modifiers.js'

export const INITIAL_BUDGET = 280.0
export const TOTAL_ROUNDS = 18
export const PACK_SIZE = 7
export const REROLL_COST = 2.0
export const MIN_RESERVE_PER_SLOT = 1.8

/**
 * Calcula cuánto es el máximo que un jugador puede gastar en la ronda actual
 * reservando al menos $2.5M (o el costo real de las cartas más baratas restantes)
 * por cada ficha que le falte completar después de esta ronda.
 */
export function getMaxSpendableForRound(currentBudget, currentSquadCount, unavailableIdsSet = null, totalRounds = TOTAL_ROUNDS) {
  const remainingSlotsAfterThis = Math.max(0, totalRounds - currentSquadCount - 1)
  if (remainingSlotsAfterThis === 0) {
    return Math.max(0, Number(currentBudget.toFixed(2)))
  }

  let requiredReserve = remainingSlotsAfterThis * MIN_RESERVE_PER_SLOT
  if (unavailableIdsSet) {
    const availableByPrice = PLAYERS_DB
      .filter(p => !unavailableIdsSet.has(p.id))
      .sort((a, b) => a.price - b.price)
    // Tomamos con margen por si el rival también compra jugadores baratos
    const sliceStart = Math.min(remainingSlotsAfterThis, Math.max(0, availableByPrice.length - remainingSlotsAfterThis - 1))
    const worstCaseCheapSlice = availableByPrice.slice(sliceStart, sliceStart + remainingSlotsAfterThis)
    const dynamicReserve = worstCaseCheapSlice.reduce((sum, p) => sum + p.price, 0)
    requiredReserve = Math.max(requiredReserve, dynamicReserve)
  }

  const maxSpend = currentBudget - requiredReserve
  return Math.max(MIN_RESERVE_PER_SLOT, Number(maxSpend.toFixed(2)))
}

export function canRerollPack(budget, squadCount, alreadyRerolledThisRound, unavailableIdsSet = null) {
  if (alreadyRerolledThisRound) return false
  const budgetAfterReroll = Number((budget - REROLL_COST).toFixed(2))
  const remainingSlotsIncludingThis = Math.max(1, TOTAL_ROUNDS - squadCount)
  if (budgetAfterReroll < remainingSlotsIncludingThis * MIN_RESERVE_PER_SLOT) return false
  const maxSpendAfterReroll = getMaxSpendableForRound(budgetAfterReroll, squadCount, unavailableIdsSet)
  return maxSpendAfterReroll >= MIN_RESERVE_PER_SLOT
}

export function getPositionalCounts(squad) {
  const counts = { GK: 0, DEF: 0, MID: 0, ATT: 0 }
  for (const p of squad) {
    if (p.position === 'GK') counts.GK++
    else if (['CB', 'LB', 'RB'].includes(p.position)) counts.DEF++
    else if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(p.position)) counts.MID++
    else if (['EXT', 'ST'].includes(p.position)) counts.ATT++
  }
  return counts
}

function pickRandomWeighted(pool, roundNumber) {
  if (pool.length === 0) return null
  // Ponderación por categoría según la etapa del Draft
  let weights
  if (roundNumber <= 5) {
    weights = { legend: 32, idol: 36, squad: 22, filler: 10 }
  } else if (roundNumber <= 11) {
    weights = { legend: 16, idol: 30, squad: 36, filler: 18 }
  } else {
    weights = { legend: 8, idol: 20, squad: 40, filler: 32 }
  }

  const weightedPool = pool.map(p => ({
    player: p,
    weight: weights[p.category] || 20
  }))
  const totalWeight = weightedPool.reduce((acc, item) => acc + item.weight, 0)
  let roll = Math.random() * totalWeight
  for (const item of weightedPool) {
    roll -= item.weight
    if (roll <= 0) return item.player
  }
  return weightedPool[weightedPool.length - 1].player
}

/**
 * Genera una mano/sobre de 7 cartas sin repetir jugadores ya elegidos,
 * garantizando variedad posicional y al menos 2 opciones comprables con el presupuesto disponible.
 */
export function generateDraftPack(roundNumber, unavailableIdsSet, currentBudget, currentSquad = []) {
  const availablePool = PLAYERS_DB.filter(p => !unavailableIdsSet.has(p.id))
  const maxSpendable = getMaxSpendableForRound(currentBudget, currentSquad.length, unavailableIdsSet)
  const counts = getPositionalCounts(currentSquad)
  const selected = []
  const selectedIds = new Set()

  const addCard = (card) => {
    if (card && !selectedIds.has(card.id)) {
      selected.push(clonePlayerForTeam(card))
      selectedIds.add(card.id)
      return true
    }
    return false
  }

  // 1. Si no tiene arquero y estamos en ronda >= 3 (o le faltan pocas rondas), garantizar al menos 1 GK comprable
  if (counts.GK === 0 && roundNumber >= 3) {
    const affordableGKs = availablePool.filter(p => p.position === 'GK' && p.price <= maxSpendable)
    if (affordableGKs.length > 0) {
      addCard(affordableGKs[Math.floor(Math.random() * affordableGKs.length)])
    }
  }

  // 2. Garantizar siempre la carta más barata disponible y al menos 2 cartas dentro del presupuesto máximo
  const affordablePool = availablePool
    .filter(p => p.price <= maxSpendable && !selectedIds.has(p.id))
    .sort((a, b) => a.price - b.price)
  if (affordablePool.length > 0) {
    addCard(affordablePool[0])
    const cheapPool = affordablePool.filter(p => p.price <= Math.min(maxSpendable, 10.0) && !selectedIds.has(p.id))
    if (cheapPool.length > 0) {
      addCard(cheapPool[Math.floor(Math.random() * cheapPool.length)])
    }
    while (selected.filter(c => c.price <= maxSpendable).length < 3) {
      const remainingAffordable = availablePool.filter(p => p.price <= maxSpendable && !selectedIds.has(p.id))
      if (remainingAffordable.length === 0) break
      addCard(pickRandomWeighted(remainingAffordable, roundNumber))
    }
  }

  // 3. Completar hasta las 7 cartas del sobre con ponderación por ronda y variedad de puestos
  while (selected.length < PACK_SIZE) {
    const remaining = availablePool.filter(p => !selectedIds.has(p.id))
    if (remaining.length === 0) break
    const candidate = pickRandomWeighted(remaining, roundNumber)
    addCard(candidate)
  }

  // Ordenar el sobre de mayor a menor media para presentación visual limpia
  return selected.sort((a, b) => b.rating - a.rating || b.price - a.price)
}

/**
 * Toma de decisiones inteligente para la IA en el Draft:
 * Equilibra presupuesto restante, posiciones faltantes (GK, DEF, MID, ATT) y calidad de jugador.
 */
export function selectAICardFromPack(pack, aiBudget, aiSquad, roundNumber, unavailableIdsSet = null) {
  const remainingSlots = Math.max(1, TOTAL_ROUNDS - aiSquad.length)
  const remainingAfter = Math.max(0, remainingSlots - 1)
  const minRequiredReserve = Number((remainingAfter * MIN_RESERVE_PER_SLOT).toFixed(2))

  const maxSpendable = getMaxSpendableForRound(aiBudget, aiSquad.length, unavailableIdsSet)
  let affordable = pack.filter(p => p.price <= maxSpendable && p.price <= aiBudget && Number((aiBudget - p.price).toFixed(2)) >= minRequiredReserve)
  if (affordable.length === 0) {
    const strictlyAffordable = pack.filter(p => p.price <= aiBudget).sort((a, b) => a.price - b.price)
    if (strictlyAffordable.length > 0) return strictlyAffordable[0]
    return [...pack].sort((a, b) => a.price - b.price)[0]
  }

  const avgBudgetPerSlot = aiBudget / remainingSlots
  const counts = getPositionalCounts(aiSquad)

  let bestCard = affordable[0]
  let bestScore = -999999

  for (const card of affordable) {
    let score = card.rating * 3.0

    // Evaluación posicional
    if (card.position === 'GK') {
      if (counts.GK === 0) score += (roundNumber >= 10 ? 350 : (roundNumber >= 6 ? 85 : 35))
      else if (counts.GK === 1 && roundNumber >= 12) score += 15
      else score -= 90 // No comprar 3 arqueros
    } else if (['CB', 'LB', 'RB'].includes(card.position)) {
      if (counts.DEF < 4) score += 32
      else if (counts.DEF < 6) score += 10
      else score -= 20
    } else if (['CM', 'CAM', 'LM', 'RM'].includes(card.position)) {
      if (counts.MID < 4) score += 30
      else if (counts.MID < 6) score += 10
      else score -= 20
    } else if (card.position === 'ST') {
      if (counts.ATT < 2) score += 34
      else if (counts.ATT < 4) score += 10
      else score -= 25
    }

    // Gestión inteligente de presupuesto:
    // En las primeras rondas puede darse el gusto de fichar Leyendas/Ídolos,
    // pero cuida que no le quede un promedio menor a $5.5M por jugador para el resto del equipo titular.
    const remainingAfterPick = Math.max(1, remainingSlots - 1)
    const avgAfterPick = (aiBudget - card.price) / remainingAfterPick

    if (roundNumber <= 11 && avgAfterPick < 4.5) {
      score -= (4.5 - avgAfterPick) * 18
    } else if (card.price <= avgBudgetPerSlot * 1.35) {
      score += 14
    }

    if (score > bestScore) {
      bestScore = score
      bestCard = card
    }
  }

  return bestCard
}

/**
 * Organiza automáticamente un plantel de 16 jugadores en 11 titulares + 5 suplentes
 * para la formación y mentalidad elegidas, y asigna Capitán y Pelota Parada óptimos.
 */
export function autoSetupTeamFromSquad(squad16, {
  teamName = 'Equipo',
  primaryColor = '#1d4ed8',
  secondaryColor = '#facc15',
  formationId = '4-4-2',
  mentalityId = 'balanced',
  playStyleId = null,
  side = 'top'
} = {}) {
  const pool = squad16.map(clonePlayerForTeam)
  const slots = getFormationCoordinates(formationId, mentalityId, side)
  const starters = new Array(11).fill(null)
  const usedIds = new Set()

  // 1. Elegir primero el mejor Arquero (slot 0)
  const gks = pool.filter(p => p.position === 'GK').sort((a, b) => b.rating - a.rating)
  const chosenGK = gks[0] || [...pool].sort((a, b) => b.skill.saving - a.skill.saving)[0]
  if (chosenGK) {
    starters[0] = chosenGK
    usedIds.add(chosenGK.id)
  }

  const scorePlayerForSlot = (player, slotRole) => {
    const compat = getPositionCompatibility(player, slotRole)
    const gkPenalty = player.position === 'GK' ? 0.30 : 1.0
    // Pequeño bonus si es su posición primaria exacta para desempatar laterales/bandas
    const primaryBonus = player.position === slotRole ? 1.03 : 1.0
    return player.rating * (compat.factor ** 1.65) * gkPenalty * primaryBonus
  }

  // 2A. Primera pasada: Asignar especialistas naturales (100% compatibilidad), priorizando laterales y bandas
  const slotPriorityOrder = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].sort((a, b) => {
    const rolePriority = { LB: 1, RB: 1, CAM: 2, EXT: 3, LM: 3, RM: 3, CDM: 4, ST: 5, CB: 6, CM: 7 }
    return (rolePriority[slots[a].role] || 9) - (rolePriority[slots[b].role] || 9)
  })

  // Primero coincidencia de posición principal exacta (p.position === slot.role)
  for (const slotIdx of slotPriorityOrder) {
    const slot = slots[slotIdx]
    const exactPrimaryCandidates = pool
      .filter(p => !usedIds.has(p.id) && p.position !== 'GK' && p.position === slot.role)
      .sort((a, b) => b.rating - a.rating)
    if (exactPrimaryCandidates.length > 0) {
      starters[slotIdx] = exactPrimaryCandidates[0]
      usedIds.add(exactPrimaryCandidates[0].id)
    }
  }

  // Luego coincidencia por posición secundaria natural (p.positions incluye slot.role al 100%)
  for (const slotIdx of slotPriorityOrder) {
    if (starters[slotIdx]) continue
    const slot = slots[slotIdx]
    const naturalMultiCandidates = pool
      .filter(p => !usedIds.has(p.id) && p.position !== 'GK' && Array.isArray(p.positions) && p.positions.includes(slot.role))
      .sort((a, b) => b.rating - a.rating)
    if (naturalMultiCandidates.length > 0) {
      starters[slotIdx] = naturalMultiCandidates[0]
      usedIds.add(naturalMultiCandidates[0].id)
    }
  }

  // 2B. Segunda pasada: Completar cualquier slot restante con el mejor jugador disponible
  for (const slotIdx of slotPriorityOrder) {
    if (starters[slotIdx]) continue
    const slot = slots[slotIdx]
    let bestCandidate = null
    let bestEffectiveScore = -1
    for (const candidate of pool) {
      if (usedIds.has(candidate.id)) continue
      const effectiveScore = scorePlayerForSlot(candidate, slot.role)
      if (effectiveScore > bestEffectiveScore) {
        bestEffectiveScore = effectiveScore
        bestCandidate = candidate
      }
    }
    if (bestCandidate) {
      starters[slotIdx] = bestCandidate
      usedIds.add(bestCandidate.id)
    }
  }

  // 2C. Optimización 2-opt: Intercambiar pares de titulares si mejora la suma de compatibilidad global
  let improved = true
  while (improved) {
    improved = false
    for (let i = 1; i < 11; i++) {
      for (let j = i + 1; j < 11; j++) {
        const pI = starters[i]
        const pJ = starters[j]
        if (!pI || !pJ) continue
        const currentSum = scorePlayerForSlot(pI, slots[i].role) + scorePlayerForSlot(pJ, slots[j].role)
        const swappedSum = scorePlayerForSlot(pJ, slots[i].role) + scorePlayerForSlot(pI, slots[j].role)
        if (swappedSum > currentSum + 0.05) {
          starters[i] = pJ
          starters[j] = pI
          improved = true
        }
      }
    }
  }

  // Asignar coordenadas y roles tácticos a los 11 titulares
  starters.forEach((player, idx) => {
    const slot = slots[idx]
    player.tacticalRole = slot.role
    player.currentPOS = slot.coords.slice()
    player.originPOS = slot.coords.slice()
    player.intentPOS = slot.coords.slice()
    player.shirtNumber = idx + 1
  })

  // Los 5 restantes van al banco de suplentes
  const bench = pool
    .filter(p => !usedIds.has(p.id))
    .sort((a, b) => b.rating - a.rating)
    .map((p, idx) => {
      p.shirtNumber = 12 + idx
      p.currentPOS = [0, 0]
      p.originPOS = [0, 0]
      p.intentPOS = [0, 0]
      return p
    })

  // Elegir automáticamente Capitán, Pateador de Penales, Tiros Libres y Córners entre los 11 titulares
  const byCaptaincy = [...starters].sort(
    (a, b) => (b.skill.perception + b.skill.strength + b.rating) - (a.skill.perception + a.skill.strength + a.rating)
  )
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
    playStyle: playStyleId || FORMATIONS[formationId]?.defaultPlayStyle || 'balanced',
    substitutionsUsed: 0,
    maxSubstitutions: 5,
    setPieces: {
      captainID: byCaptaincy[0]?.id,
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
