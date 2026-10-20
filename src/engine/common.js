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
  const ballInPenaltyBoxX = isBetween(item[0], (matchWidth / 4) + 5, matchWidth - (matchWidth / 4) - 5)
  const ballInTopPenaltyBoxY = isBetween(item[1], -1, (matchHeight / 6) + 7)
  return !!(ballInPenaltyBoxX && ballInTopPenaltyBoxY)
}

export function inBottomPenalty(matchDetails, item) {
  const [matchWidth, matchHeight] = matchDetails.pitchSize
  const ballInPenaltyBoxX = isBetween(item[0], (matchWidth / 4) + 5, matchWidth - (matchWidth / 4) - 5)
  const ballInBottomPenaltyBoxY = isBetween(item[1], matchHeight - (matchHeight / 6) - 7, matchHeight + 1)
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

export function isInjured(x) {
  if (x === 23) return true
  return getRandomNumber(0, x) === 23
}

export function matchInjury(matchDetails, team) {
  const activePlayers = team.players.filter(isOnPitch)
  if (activePlayers.length === 0) return
  const player = activePlayers[getRandomNumber(0, activePlayers.length - 1)]
  // Mayor cansancio incrementa levemente el riesgo de lesión
  const fatigueRisk = player.fitness < 45 ? 22000 : 40000
  if (isInjured(fatigueRisk)) {
    player.injured = true
    matchDetails.iterationLog.push(`Player Injured - ${player.name}`)
  }
}

export function isEven(n) {
  return n % 2 === 0
}

export function isOdd(n) {
  return Math.abs(n % 2) === 1
}

export function distance(pos1, pos2) {
  const dx = pos1[0] - pos2[0]
  const dy = pos1[1] - pos2[1]
  return Math.sqrt(dx * dx + dy * dy)
}
