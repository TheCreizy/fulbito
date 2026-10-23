// Funciones matemáticas, geométricas y físicas del motor (100% navegador, sin dependencias de Node.js)

export function getRandomNumber(min, max) {
  const low = Math.ceil(Math.min(min, max))
  const high = Math.floor(Math.max(min, max))
  return Math.floor(Math.random() * (high - low + 1)) + low
}

export function round(value, decimals) {
  if (Number.isNaN(Number(value))) return 0
  return Number(`${Math.round(`${value}e${decimals}`)}e-${decimals}`)
}

export function isBetween(num, low, high) {
  return num > low && num < high
}

export function upToMax(num, max) {
  if (num > max) return max
  return num
}

export function upToMin(num, min) {
  if (num < min) return min
  return num
}

export function isOnPitch(player) {
  return (
    player &&
    Array.isArray(player.currentPOS) &&
    player.currentPOS[0] !== 'NP' &&
    !player.sentOff
  )
}

export function getBallTrajectory(thisPOS, newPOS, power, type, pitchHeight) {
  const dx = newPOS[0] - thisPOS[0]
  const dy = newPOS[1] - thisPOS[1]
  const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy))
  const maxPower = pitchHeight * 0.40
  const powerRatio = Math.min(1, Math.max(0.15, power / maxPower))

  // Velocidad real diferenciada por tipo de golpeo (píxeles por tick)
  // Los remates al arco viajan mucho más rápido que un pase corto o un centro bombeado
  let speedPerTick = 22
  let minSteps = 4
  let maxSteps = 22
  if (type === 'shot') {
    speedPerTick = 36 + (powerRatio * 10)
    minSteps = 3
    maxSteps = 14
  } else if (type === 'freekick') {
    speedPerTick = 32 + (powerRatio * 8)
    minSteps = 4
    maxSteps = 16
  } else if (type === 'switch') {
    speedPerTick = 26 + (powerRatio * 6)
    minSteps = 5
    maxSteps = 20
  } else if (type === 'pass') {
    speedPerTick = 22 + (powerRatio * 6)
    minSteps = 3
    maxSteps = 20
  } else if (type === 'through') {
    speedPerTick = 22 + (powerRatio * 6)
    minSteps = 4
    maxSteps = 22
  } else if (type === 'cross') {
    speedPerTick = 19 + (powerRatio * 5)
    minSteps = 5
    maxSteps = 22
  } else if (type === 'kick') {
    speedPerTick = 25 + (powerRatio * 6)
    minSteps = 5
    maxSteps = 22
  } else if (type === 'deflection') {
    speedPerTick = 26 + (powerRatio * 8)
    minSteps = 3
    maxSteps = 10
  } else if (type === 'rebound') {
    speedPerTick = 20 + (powerRatio * 6)
    minSteps = 3
    maxSteps = 8
  }

  const steps = Math.max(minSteps, Math.min(maxSteps, Math.round(dist / speedPerTick)))
  let maxLoftPercent = 0.03
  if (type === 'pass') maxLoftPercent = 0.008
  if (type === 'through') maxLoftPercent = 0.015
  if (type === 'switch') maxLoftPercent = 0.048
  if (type === 'shot') maxLoftPercent = 0.035
  if (type === 'freekick') maxLoftPercent = 0.055
  if (type === 'cross') maxLoftPercent = 0.075
  if (type === 'kick') maxLoftPercent = 0.11
  if (type === 'deflection') maxLoftPercent = 0.045
  if (type === 'rebound') maxLoftPercent = 0.05
  const maxLoftHeight = pitchHeight * maxLoftPercent
  const distRatio = Math.min(1, dist / (pitchHeight * 0.35))
  const maxHeight = maxLoftHeight * Math.max(0.25, distRatio)

  // Inercia y fricción de rodamiento según open-football (roll.rs)
  // En el césped la velocidad decrece geométricamente: v_{t+1} = v_t * decay
  // d(i) = (1 - k^i) / (1 - k^steps)
  const isRolling = (type === 'pass' || type === 'through' || maxHeight < 8)
  const decayFactor = isRolling ? 0.915 : 0.965
  const denom = 1 - Math.pow(decayFactor, steps)

  const trajectory = []
  for (let i = 0; i <= steps; i++) {
    const linearT = i / steps
    const t = denom !== 0 ? (1 - Math.pow(decayFactor, i)) / denom : linearT
    const x = thisPOS[0] + dx * t
    const y = thisPOS[1] + dy * t
    const z = 4 * maxHeight * linearT * (1 - linearT)
    trajectory.push([round(x, 0), round(y, 0), round(z, 0)])
  }
  return trajectory
}

export function calculatePower(strength, pitchHeight) {
  const maxPercent = 0.48
  const maxPower = pitchHeight * maxPercent
  const strengthFactor = Math.sqrt(Math.max(0, Number(strength) || 50) / 100)
  const variance = getRandomNumber(88, 100) / 100
  const power = maxPower * strengthFactor * variance
  return Math.min(power, maxPower)
}

export function aTimesbDividedByC(a, b, c) {
  return (a * (b / sumFrom1toX(c)))
}

export function sumFrom1toX(x) {
  return (x * (x + 1)) / 2
}

export function inTopPenalty(matchDetails, item) {
  const [matchWidth, matchHeight] = matchDetails.pitchSize
  const boxDepthY = Math.round(matchHeight * (16.5 / 105)) - 3 // 162px (adentro de la línea reglamentaria de 165px)
  const ballInPenaltyBoxX = isBetween(item[0], (matchWidth / 4) + 8, matchWidth - (matchWidth / 4) - 8)
  const ballInTopPenaltyBoxY = isBetween(item[1], -1, boxDepthY)
  return !!(ballInPenaltyBoxX && ballInTopPenaltyBoxY)
}

export function inBottomPenalty(matchDetails, item) {
  const [matchWidth, matchHeight] = matchDetails.pitchSize
  const boxDepthY = Math.round(matchHeight * (16.5 / 105)) - 3 // 162px
  const ballInPenaltyBoxX = isBetween(item[0], (matchWidth / 4) + 8, matchWidth - (matchWidth / 4) - 8)
  const ballInBottomPenaltyBoxY = isBetween(item[1], matchHeight - boxDepthY, matchHeight + 1)
  return !!(ballInPenaltyBoxX && ballInBottomPenaltyBoxY)
}

export function getRandomTopPenaltyPosition(matchDetails) {
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  const boundaryX = [Math.round((pitchWidth / 4) + 6), Math.round(pitchWidth - (pitchWidth / 4) - 6)]
  const boundaryY = [12, Math.round((pitchHeight / 6) + 6)]
  return [getRandomNumber(boundaryX[0], boundaryX[1]), getRandomNumber(boundaryY[0], boundaryY[1])]
}

export function getRandomBottomPenaltyPosition(matchDetails) {
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  const boundaryX = [Math.round((pitchWidth / 4) + 6), Math.round(pitchWidth - (pitchWidth / 4) - 6)]
  const boundaryY = [Math.round(pitchHeight - (pitchHeight / 6) + 6), pitchHeight - 12]
  return [getRandomNumber(boundaryX[0], boundaryX[1]), getRandomNumber(boundaryY[0], boundaryY[1])]
}

export function removeBallFromAllPlayers(matchDetails) {
  matchDetails.ball.withPlayer = false
  matchDetails.ball.withTeam = ''
  matchDetails.ball.Player = ''
  for (const player of matchDetails.kickOffTeam.players) {
    player.hasBall = false
  }
  for (const player of matchDetails.secondTeam.players) {
    player.hasBall = false
  }
}

export const INJURY_GRADES = {
  KNOCK: 'knock',
  HURT: 'hurt',
  SERIOUS: 'serious'
}

export const INJURY_CATALOG = {
  knock: [
    { name: 'Contusión en el tobillo', fitnessLoss: 12, canContinue: true },
    { name: 'Golpe intercostal', fitnessLoss: 10, canContinue: true },
    { name: 'Pisotón doloroso', fitnessLoss: 14, canContinue: true },
    { name: 'Choque de rodillas', fitnessLoss: 12, canContinue: true }
  ],
  hurt: [
    { name: 'Sobrecarga en el isquiotibial', fitnessLoss: 32, canContinue: true },
    { name: 'Calambre agudo', fitnessLoss: 36, canContinue: true },
    { name: 'Contractura en el gemelo', fitnessLoss: 30, canContinue: true },
    { name: 'Distensión leve', fitnessLoss: 38, canContinue: true }
  ],
  serious: [
    { name: 'Desgarro fibrilar', fitnessLoss: 65, canContinue: false },
    { name: 'Esguince severo de rodilla', fitnessLoss: 75, canContinue: false },
    { name: 'Tirón agudo incapacitante', fitnessLoss: 60, canContinue: false },
    { name: 'Fisura ósea', fitnessLoss: 80, canContinue: false }
  ]
}

export function applyInjury(player, cause = 'contact', gradeOverride = null, matchDetails = null, team = null) {
  if (!player || player.injuryStatus?.grade === 'serious') return null

  let grade = gradeOverride
  if (!grade) {
    // Open football distribution: Knock ~60%, Hurt ~28%, Serious ~12%
    const roll = getRandomNumber(1, 100)
    if (roll <= 60) grade = 'knock'
    else if (roll <= 88) grade = 'hurt'
    else grade = 'serious'
  }

  const options = INJURY_CATALOG[grade] || INJURY_CATALOG.knock
  const chosen = options[getRandomNumber(0, options.length - 1)]

  player.injured = true
  player.injuryStatus = {
    grade,
    cause, // 'contact' | 'load'
    name: chosen.name,
    fitnessLoss: chosen.fitnessLoss,
    canContinue: chosen.canContinue,
    occurredIter: matchDetails?.iterationCount || 0
  }

  // Descontar fitness
  player.fitness = Math.max(12, (Number(player.fitness ?? 100)) - chosen.fitnessLoss)

  if (matchDetails) {
    const statusLabel = chosen.canContinue ? 'Continúa disminuido' : 'No puede continuar'
    const logMsg = `Player Injured [${grade.toUpperCase()}] - ${player.name}: ${chosen.name} (${statusLabel})`
    matchDetails.iterationLog.push(logMsg)
    if (Array.isArray(matchDetails.events)) {
      matchDetails.events.push({
        type: 'injury',
        grade,
        cause,
        injuryName: chosen.name,
        canContinue: chosen.canContinue,
        teamID: team?.teamID || player.teamID,
        teamName: team?.name || '',
        playerName: player.name,
        iteration: matchDetails.iterationCount || 0,
        half: matchDetails.half
      })
    }
  }

  return player.injuryStatus
}

export function isInjured(x) {
  if (x === 23) return true
  return getRandomNumber(0, x) === 23
}

export function matchInjury(matchDetails, team) {
  const activePlayers = team.players.filter(isOnPitch)
  if (activePlayers.length === 0) return
  const player = activePlayers[getRandomNumber(0, activePlayers.length - 1)]
  // Chequeo de fatiga / carga física acumulada (Load injury)
  // Se activa principalmente en jugadores con cansancio severo (fitness < 50)
  if (player.fitness < 50 && !player.injuryStatus) {
    // Probabilidad calibrada por tick para acumular fatiga
    const fatigueRisk = player.fitness < 35 ? 1200 : 2600
    if (getRandomNumber(1, fatigueRisk) === 23) {
      applyInjury(player, 'load', null, matchDetails, team)
    }
  }
}

export function isEven(n) {
  return n % 2 === 0
}

export function isOdd(n) {
  return Math.abs(n % 2) === 1
}

export function distance(pos1, pos2) {
  if (!Array.isArray(pos1) || !Array.isArray(pos2)) return 9999
  const dx = pos1[0] - pos2[0]
  const dy = pos1[1] - pos2[1]
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Bandas de distancia de tiro libre inspiradas en FreeKickBand de Open Football.
 */
export function getFreeKickBand(distToGoal) {
  if (distToGoal <= 200) return 'Close'
  if (distToGoal <= 260) return 'Mid'
  if (distToGoal <= 320) return 'Long'
  return 'Far'
}

/**
 * Cantidad de jugadores en la barrera según distancia y ángulo (Open Football wall_size_for).
 */
export function getWallSize(distToGoal, isWideAngle = false) {
  const band = getFreeKickBand(distToGoal)
  let base = 2
  if (band === 'Close') base = 6
  else if (band === 'Mid') base = 5
  else if (band === 'Long') base = 4
  else base = 2

  if (isWideAngle && band !== 'Far') {
    base = Math.max(2, base - 1)
  }
  return base
}

/**
 * Probabilidad de que la barrera desvíe o bloquee un tiro libre directo (Open Football wall_block_prob).
 */
export function calculateWallBlockProb(wallPlayers = [], takerFkSkill = 75, distToGoal = 220) {
  const band = getFreeKickBand(distToGoal)
  let baseProb = 0.20
  if (band === 'Close') baseProb = 0.26
  else if (band === 'Mid') baseProb = 0.22
  else if (band === 'Long') baseProb = 0.15
  else baseProb = 0.06

  let avgWallQuality = 70
  if (wallPlayers.length > 0) {
    const sum = wallPlayers.reduce((acc, p) => acc + ((p.skill?.tackling || 70) + (p.skill?.strength || 70) + (p.skill?.jumping || 70)) / 3, 0)
    avgWallQuality = sum / wallPlayers.length
  }
  const wallMod = (avgWallQuality - 70) * 0.002
  const takerMod = (75 - takerFkSkill) * 0.0025
  return Math.max(0.04, Math.min(0.42, baseProb + wallMod + takerMod))
}
