import * as common from './common.js'

/**
 * Tabla de instrucciones del Director Técnico y sus coeficientes de comportamiento.
 * Transcribe directamente la lógica de CoachInstruction y MatchCoach de open-football-master.
 */
export const COACH_INSTRUCTIONS = {
  Normal: {
    name: 'Normal',
    label: 'Equilibrado',
    ambition: 0.50,
    shootingReluctance: 0.0,
    backwardPassPreference: 0.0,
    tempoMultiplier: 1.0,
    minPossessionTicks: 8,
    mentalityEquivalent: 'balanced'
  },
  SlowDown: {
    name: 'SlowDown',
    label: 'Pausar el Juego',
    ambition: 0.30,
    shootingReluctance: 0.30,
    backwardPassPreference: 0.40,
    tempoMultiplier: 0.85,
    minPossessionTicks: 22,
    mentalityEquivalent: 'defensive'
  },
  PushForward: {
    name: 'PushForward',
    label: 'Adelantar Líneas',
    ambition: 0.75,
    shootingReluctance: -0.25,
    backwardPassPreference: -0.20,
    tempoMultiplier: 1.05,
    minPossessionTicks: 5,
    mentalityEquivalent: 'offensive'
  },
  AllOutAttack: {
    name: 'AllOutAttack',
    label: 'Ataque Total',
    ambition: 1.00,
    shootingReluctance: -0.45,
    backwardPassPreference: -0.35,
    tempoMultiplier: 1.15,
    minPossessionTicks: 3,
    mentalityEquivalent: 'offensive'
  },
  WasteTime: {
    name: 'WasteTime',
    label: 'Enfriar el Partido',
    ambition: 0.05,
    shootingReluctance: 0.60,
    backwardPassPreference: 0.70,
    tempoMultiplier: 0.72,
    minPossessionTicks: 28,
    mentalityEquivalent: 'defensive'
  },
  ParkTheBus: {
    name: 'ParkTheBus',
    label: 'Colgarse del Travesaño',
    ambition: 0.10,
    shootingReluctance: 0.40,
    backwardPassPreference: 0.50,
    tempoMultiplier: 0.85,
    minPossessionTicks: 15,
    mentalityEquivalent: 'defensive'
  }
}

/**
 * Obtiene los coeficientes de comportamiento táctico para una instrucción dada.
 */
export function getCoachCoefficients(instructionName) {
  return COACH_INSTRUCTIONS[instructionName] || COACH_INSTRUCTIONS.Normal
}

/**
 * Evalúa la situación de partido y decide la instrucción táctica del Director Técnico
 * mediante la escalera de escalada de open-football-master:
 * - scoreDiff: diferencia de goles (positivo = ganando, negativo = perdiendo)
 * - matchProgress: progreso del tiempo reglamentario (0.0 = inicio, 1.0 = minuto 90)
 * - avgTeamCondition: condición física media (0.0 a 1.0)
 * - redCardsDiff: ventaja/desventaja numérica de jugadores expulsados
 */
export function evaluateMatchCoach(team, oppTeam, matchDetails) {
  const currentIter = matchDetails.iterationCount || 0
  const isKickOff = team.teamID === matchDetails.kickOffTeam.teamID
  const ourStats = isKickOff ? matchDetails.kickOffTeamStatistics : matchDetails.secondTeamStatistics
  const oppStats = isKickOff ? matchDetails.secondTeamStatistics : matchDetails.kickOffTeamStatistics

  const ourGoals = ourStats?.goals || 0
  const oppGoals = oppStats?.goals || 0
  const scoreDiff = ourGoals - oppGoals

  // Progreso del partido basado en 2000 iteraciones (90 minutos)
  const matchProgress = Math.min(1.0, currentIter / 2000)

  // Condición física media de los jugadores de campo
  const outfielders = team.players.filter(p => common.isOnPitch(p) && p.position !== 'GK')
  const totalFitness = outfielders.reduce((acc, p) => acc + (p.fitness || 100), 0)
  const avgFitness = outfielders.length > 0 ? (totalFitness / outfielders.length) / 100 : 1.0

  const ourRedCards = team.players.filter(p => p.sentOff || (p.stats?.cards?.red || 0) > 0).length
  const oppRedCards = oppTeam.players.filter(p => p.sentOff || (p.stats?.cards?.red || 0) > 0).length
  const redCardsDiff = ourRedCards - oppRedCards // > 0: desventaja numérica

  const isLateGame = matchProgress > 0.75   // Pasado el minuto 67
  const isVeryLate = matchProgress > 0.88   // Pasado el minuto 80
  const isFirstHalfEnd = matchProgress > 0.42 && matchProgress < 0.52
  const teamTired = avgFitness < 0.55

  // Escalera de decisión reactiva (Escalation Ladder de open-football)
  let chosenInstruction = 'Normal'

  if (scoreDiff >= 5) {
    // Goleada a favor por 5+ goles: matar el partido por completo
    chosenInstruction = 'WasteTime'
  } else if (scoreDiff >= 3) {
    // Ganando por 3 o 4 goles
    chosenInstruction = isLateGame ? 'WasteTime' : 'SlowDown'
  } else if (scoreDiff === 2) {
    // Ganando por 2 goles
    if (isVeryLate) chosenInstruction = 'WasteTime'
    else if (isLateGame) chosenInstruction = 'SlowDown'
    else chosenInstruction = 'Normal'
  } else if (scoreDiff === 1) {
    // Ganando por 1 gol: no colgarse del travesaño hasta los últimos minutos para evitar empates
    if (matchProgress > 0.92) {
      chosenInstruction = 'ParkTheBus'
    } else if (matchProgress > 0.83 || isFirstHalfEnd || teamTired) {
      chosenInstruction = 'SlowDown'
    } else {
      chosenInstruction = 'Normal'
    }
  } else if (scoreDiff === 0) {
    // Empate: buscar la victoria sobre el final, o regular si el equipo está fundido
    if (isVeryLate) chosenInstruction = 'AllOutAttack'
    else if (isLateGame) chosenInstruction = 'PushForward'
    else if (teamTired) chosenInstruction = 'SlowDown'
    else chosenInstruction = 'Normal'
  } else if (scoreDiff === -1 || scoreDiff === -2) {
    // Perdiendo por 1 o 2: apretar líneas más temprano
    if (isVeryLate || isLateGame) chosenInstruction = 'AllOutAttack'
    else if (matchProgress > 0.55) chosenInstruction = 'PushForward'
    else chosenInstruction = 'Normal'
  } else if (scoreDiff >= -4) {
    // Perdiendo por 3 o 4: adelantar líneas
    chosenInstruction = isLateGame ? 'AllOutAttack' : 'PushForward'
  } else {
    // Perdiendo por 5+: el partido está sentenciado; preservar el orden para no ser goleados aún peor
    chosenInstruction = 'PushForward'
  }

  // Modulador por inferioridad o superioridad numérica
  if (redCardsDiff > 0) {
    // Equipo con 1 o más expulsados: priorizar equilibrio defensivo y contragolpe
    if (scoreDiff >= 1) {
      chosenInstruction = isLateGame ? 'ParkTheBus' : 'SlowDown'
    } else if (scoreDiff === 0) {
      chosenInstruction = 'SlowDown'
    } else if (scoreDiff === -1 && !isVeryLate) {
      chosenInstruction = 'Normal'
    }
  } else if (redCardsDiff < 0) {
    // Con hombre de más: asediar y adelantar líneas
    if (scoreDiff <= 0) {
      chosenInstruction = isLateGame ? 'AllOutAttack' : 'PushForward'
    }
  }

  return chosenInstruction
}

/**
 * Actualiza en cada intervalo táctico (~cada 50 ticks) las directivas técnicas
 * del DT para ambos equipos en el matchDetails.
 */
export function updateTeamCoachDirectives(matchDetails) {
  const currentIter = matchDetails.iterationCount || 0
  const { kickOffTeam, secondTeam } = matchDetails
  if (!kickOffTeam || !secondTeam) return

  // Evaluar cada 50 iteraciones para mantener estabilidad y evitar cambios frenéticos cada tick
  if (currentIter % 50 !== 0 && kickOffTeam.coachState && secondTeam.coachState) {
    return
  }

  // 1. Evaluar Equipo 1
  const instr1 = evaluateMatchCoach(kickOffTeam, secondTeam, matchDetails)
  const cfg1 = getCoachCoefficients(instr1)
  kickOffTeam.coachState = {
    instruction: instr1,
    coefficients: cfg1,
    ambition: cfg1.ambition,
    lastUpdateIter: currentIter
  }
  // Sincronizar la mentalidad efectiva para el motor táctico si no fue forzada manualmente
  if (!kickOffTeam.manualMentalityLock) {
    kickOffTeam.mentality = (instr1 === 'Normal')
      ? (kickOffTeam.initialMentality || 'balanced')
      : cfg1.mentalityEquivalent
  }

  // 2. Evaluar Equipo 2
  const instr2 = evaluateMatchCoach(secondTeam, kickOffTeam, matchDetails)
  const cfg2 = getCoachCoefficients(instr2)
  secondTeam.coachState = {
    instruction: instr2,
    coefficients: cfg2,
    ambition: cfg2.ambition,
    lastUpdateIter: currentIter
  }
  if (!secondTeam.manualMentalityLock) {
    secondTeam.mentality = (instr2 === 'Normal')
      ? (secondTeam.initialMentality || 'balanced')
      : cfg2.mentalityEquivalent
  }
}

/**
 * Evalúa y ejecuta sustituciones inteligentes basadas en:
 * 1. Fatiga crítica (player.fitness < 45)
 * 2. Riesgo disciplinario (tarjeta amarilla y juego de corte)
 * 3. Desajuste táctico
 * 
 * @param {Object} matchDetails - Estado del partido
 * @param {Object} team - Equipo que evalúa sustituciones
 * @param {Object} opposition - Rival
 * @returns {{ substitutions: Array<{ outPlayer: Object, inPlayer: Object, reason: string }> }}
 */
export function evaluateSmartSubstitutions(matchDetails, team, opposition) {
  if (!team || !Array.isArray(team.players)) return { substitutions: [] }

  const currentIter = matchDetails?.iterationCount || 0
  // Permitir evaluación a partir del minuto 55 (~1200 ticks) o si hay fatiga extrema (<40)
  if (currentIter < 1100 && !team.players.some(p => p.fitness !== undefined && p.fitness < 40)) {
    return { substitutions: [] }
  }

  team.substitutionsCount = team.substitutionsCount || 0
  if (team.substitutionsCount >= 5) return { substitutions: [] }

  const activeOutfield = team.players.filter(p => !p.sentOff && !p.subbedOut && p.position !== 'GK' && (p.currentPOS ? common.isOnPitch(p) : true))
  const benchPlayers = (team.substitutes || []).filter(p => !p.hasPlayed && !p.sentOff)

  if (benchPlayers.length === 0) return { substitutions: [] }

  const substitutionsMade = []

  // 1. Detección de jugador con fatiga crítica (fitness < 45)
  const exhaustedPlayer = activeOutfield.find(p => (p.fitness !== undefined && p.fitness < 45))
  if (exhaustedPlayer && team.substitutionsCount < 5) {
    const replacement = benchPlayers.find(p => p.position === exhaustedPlayer.position && !p.hasPlayed) || benchPlayers.find(p => !p.hasPlayed)
    if (replacement) {
      executeSubstitution(team, exhaustedPlayer, replacement, 'FATIGUE_EXHAUSTION', matchDetails)
      substitutionsMade.push({ outPlayer: exhaustedPlayer, inPlayer: replacement, reason: 'FATIGUE_EXHAUSTION' })
    }
  }

  // 2. Detección de riesgo disciplinario (tarjeta amarilla)
  if (team.substitutionsCount < 5) {
    const cardedRiskPlayer = activeOutfield.find(p => (p.stats?.cards?.yellow >= 1) && !substitutionsMade.some(s => (s.outPlayer.playerID || s.outPlayer.id) === (p.playerID || p.id)))
    if (cardedRiskPlayer) {
      const replacement = benchPlayers.find(p => p.position === cardedRiskPlayer.position && !p.hasPlayed) || benchPlayers.find(p => !p.hasPlayed)
      if (replacement) {
        executeSubstitution(team, cardedRiskPlayer, replacement, 'TACTICAL_YELLOW_CARD_PROTECTION', matchDetails)
        substitutionsMade.push({ outPlayer: cardedRiskPlayer, inPlayer: replacement, reason: 'TACTICAL_YELLOW_CARD_PROTECTION' })
      }
    }
  }

  return { substitutions: substitutionsMade }
}

function executeSubstitution(team, outPlayer, inPlayer, reason, matchDetails) {
  outPlayer.hasBall = false
  outPlayer.subbedOut = true
  inPlayer.hasPlayed = true
  inPlayer.currentPOS = outPlayer.currentPOS ? [...outPlayer.currentPOS] : [340, 500]
  inPlayer.intentPOS = [...inPlayer.currentPOS]
  inPlayer.fitness = 100

  const outIdx = team.players.findIndex(p => (p.playerID || p.id) === (outPlayer.playerID || outPlayer.id))
  if (outIdx !== -1) {
    team.players[outIdx] = inPlayer
  }
  team.substitutionsCount = (team.substitutionsCount || 0) + 1

  if (matchDetails?.iterationLog) {
    matchDetails.iterationLog.push(`🔄 Sustitución en ${team.name}: Sale ${outPlayer.name}, entra ${inPlayer.name} (${reason})`)
  }
}
