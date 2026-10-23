// Sistema de Modificadores Tácticos:
// 1. Química por Puesto (Penalización por jugar fuera de puesto natural)
// 2. Impacto progresivo del Cansancio (fitness) en los atributos
// 3. Bonus pasivo del Capitán en cancha (+3 perception y -15% desgaste físico)

import { isOnPitch } from './common.js'

const COMPATIBILITY_MATRIX = {
  GK:  { GK: 1.00, CB: 0.45, LB: 0.45, RB: 0.45, CDM: 0.45, CM: 0.45, CAM: 0.45, LM: 0.45, RM: 0.45, EXT: 0.45, ST: 0.45 },
  CB:  { GK: 0.45, CB: 1.00, LB: 0.85, RB: 0.85, CDM: 0.86, CM: 0.78, CAM: 0.62, LM: 0.65, RM: 0.65, EXT: 0.45, ST: 0.55 },
  LB:  { GK: 0.45, CB: 0.86, LB: 1.00, RB: 0.80, CDM: 0.80, CM: 0.82, CAM: 0.72, LM: 0.90, RM: 0.74, EXT: 0.72, ST: 0.58 },
  RB:  { GK: 0.45, CB: 0.86, LB: 0.80, RB: 1.00, CDM: 0.80, CM: 0.82, CAM: 0.72, LM: 0.74, RM: 0.90, EXT: 0.72, ST: 0.58 },
  CDM: { GK: 0.45, CB: 0.86, LB: 0.80, RB: 0.80, CDM: 1.00, CM: 0.92, CAM: 0.65, LM: 0.70, RM: 0.70, EXT: 0.45, ST: 0.45 },
  CM:  { GK: 0.45, CB: 0.78, LB: 0.80, RB: 0.80, CDM: 0.92, CM: 1.00, CAM: 0.92, LM: 0.88, RM: 0.88, EXT: 0.70, ST: 0.78 },
  CAM: { GK: 0.45, CB: 0.58, LB: 0.68, RB: 0.68, CDM: 0.65, CM: 0.92, CAM: 1.00, LM: 0.90, RM: 0.90, EXT: 0.90, ST: 0.90 },
  LM:  { GK: 0.45, CB: 0.62, LB: 0.86, RB: 0.72, CDM: 0.70, CM: 0.88, CAM: 0.90, LM: 1.00, RM: 0.85, EXT: 0.92, ST: 0.88 },
  RM:  { GK: 0.45, CB: 0.62, LB: 0.72, RB: 0.86, CDM: 0.70, CM: 0.88, CAM: 0.90, LM: 0.85, RM: 1.00, EXT: 0.92, ST: 0.88 },
  EXT: { GK: 0.45, CB: 0.45, LB: 0.72, RB: 0.72, CDM: 0.45, CM: 0.70, CAM: 0.90, LM: 0.92, RM: 0.92, EXT: 1.00, ST: 0.90 },
  ST:  { GK: 0.45, CB: 0.55, LB: 0.58, RB: 0.58, CDM: 0.45, CM: 0.78, CAM: 0.88, LM: 0.88, RM: 0.88, EXT: 0.90, ST: 1.00 }
}

/**
 * Evalúa la compatibilidad de un jugador (o posición) con un rol táctico de la formación.
 * Soporta jugadores polifuncionales (player.positions = ['ST', 'RM', 'CAM']).
 */
export function getPositionCompatibility(playerOrPos, tacticalSlotRole, extraPositions = null) {
  let naturalPositions = []
  if (playerOrPos && typeof playerOrPos === 'object') {
    if (Array.isArray(playerOrPos.positions) && playerOrPos.positions.length > 0) {
      naturalPositions = playerOrPos.positions
    } else if (playerOrPos.position) {
      naturalPositions = [playerOrPos.position]
    }
  } else if (typeof playerOrPos === 'string') {
    naturalPositions = Array.isArray(extraPositions) && extraPositions.length > 0
      ? Array.from(new Set([playerOrPos, ...extraPositions]))
      : [playerOrPos]
  }
  if (naturalPositions.length === 0) naturalPositions = ['CM']

  let factor = 0
  for (const pos of naturalPositions) {
    if (pos === tacticalSlotRole) {
      factor = 1.0
      break
    }
    const row = COMPATIBILITY_MATRIX[pos] || COMPATIBILITY_MATRIX.CM
    const candidateFactor = row[tacticalSlotRole] ?? 0.78
    if (candidateFactor > factor) {
      factor = candidateFactor
    }
  }

  if (factor >= 0.99) {
    return {
      factor: 1.0,
      status: 'optimal',
      label: 'Puesto Natural (100%)',
      shortLabel: '100%',
      color: '#10b981'
    }
  }
  if (factor >= 0.86) {
    return {
      factor,
      status: 'good',
      label: `Puesto Afín (${Math.round(factor * 100)}%)`,
      shortLabel: `${Math.round(factor * 100)}%`,
      color: '#eab308'
    }
  }
  if (factor >= 0.74) {
    return {
      factor,
      status: 'poor',
      label: `Fuera de Puesto (${Math.round(factor * 100)}%)`,
      shortLabel: `${Math.round(factor * 100)}%`,
      color: '#f97316'
    }
  }
  return {
    factor,
    status: 'bad',
    label: `Inadaptado (${Math.round(factor * 100)}%)`,
    shortLabel: `${Math.round(factor * 100)}%`,
    color: '#ef4444'
  }
}

export function isCaptainOnPitch(team) {
  if (!team || !team.players) return false
  const captainID = team.setPieces?.captainID
  if (!captainID) return false
  return team.players.some(p => (p.id === captainID || p.playerID === captainID) && isOnPitch(p))
}

/**
 * Recalcula los atributos efectivos (player.skill) a partir de player.baseSkill,
 * aplicando:
 * - Factor de puesto (tacticalRole vs natural position)
 * - Penalización por cansancio (fitness < 75) y lesión (injured)
 * - Bonus del Capitán (+3 en perception)
 */
export function updatePlayerEffectiveSkills(player, team) {
  if (!player.baseSkill) {
    player.baseSkill = { ...player.skill }
  }
  const slotRole = player.tacticalRole || player.position
  const compat = getPositionCompatibility(player, slotRole)
  player.positionFactor = compat.factor

  // Curva de cansancio calibrada: entre 70 y 100 rinde al 100%.
  // Por debajo de 70 desciende de forma equilibrada (a 55% de energía rinde al 92%),
  // con un piso de 0.74 si cae hasta el límite de 20%.
  const fitness = Number(player.fitness ?? 100)
  let fatigueFactor = 1.0
  if (fitness < 70) {
    fatigueFactor = Math.max(0.74, 0.74 + ((fitness - 20) / 50) * 0.26)
  }
  if (player.injuryStatus) {
    if (player.injuryStatus.grade === 'knock') {
      fatigueFactor *= 0.95
    } else if (player.injuryStatus.grade === 'hurt') {
      fatigueFactor *= 0.80
    } else if (player.injuryStatus.grade === 'serious') {
      fatigueFactor *= 0.40
    }
  } else if (player.injured) {
    fatigueFactor *= 0.82
  }

  const captainActive = isCaptainOnPitch(team)
  const totalMultiplier = compat.factor * fatigueFactor

  const physicalAndTechKeys = [
    'passing',
    'shooting',
    'tackling',
    'saving',
    'agility',
    'strength',
    'penalty_taking',
    'freekick',
    'jumping',
    'perception',
    'control',
    'heading',
    'cabeza',
    'stamina',
    'resistencia'
  ]

  for (const key of physicalAndTechKeys) {
    const baseVal = Number(player.baseSkill[key] ?? 50)
    // Los penales y tiros libres sufren menos por fuera de puesto que los atributos tácticos
    const multiplier = (key === 'penalty_taking' || key === 'freekick')
      ? (0.85 + 0.15 * compat.factor) * (0.85 + 0.15 * fatigueFactor)
      : totalMultiplier

    let finalVal = Math.round(baseVal * multiplier)
    if (key === 'perception' && captainActive) {
      finalVal += 3
    }
    player.skill[key] = Math.max(15, Math.min(99, finalVal))
  }

  return player
}

export function updateTeamEffectiveSkills(team) {
  if (!team || !team.players) return
  for (const player of team.players) {
    updatePlayerEffectiveSkills(player, team)
  }
}
