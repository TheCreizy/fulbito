import * as common from './common.js'
import * as setPositions from './setPositions.js'
import * as actions from './actions.js'
import { getPlayStyleConfig } from '../data/formations.js'
import { BALL_PHYSICS, kickBall25D, predictBallLanding, updateBallPhysics25D } from './ball/ballPhysics.js'

export { BALL_PHYSICS, kickBall25D, predictBallLanding, updateBallPhysics25D }

export function getSecondLastDefender(defendingTeam, attackingTop, pitchHeight) {
  const activeDefenders = (defendingTeam?.players || []).filter(common.isOnPitch)
  if (activeDefenders.length < 2) return null

  // Si attackingTop es true, el atacante ataca hacia el arco superior (Y=0).
  // La defensa defiende Y=0. Más cerca de su arco = menor Y.
  // Si attackingTop es false, el atacante ataca hacia el arco inferior (Y=pitchHeight).
  // La defensa defiende Y=pitchHeight. Más cerca de su arco = mayor Y.
  const sorted = [...activeDefenders].sort((a, b) => {
    return attackingTop ? (a.currentPOS[1] - b.currentPOS[1]) : (b.currentPOS[1] - a.currentPOS[1])
  })

  // Si hay defensores de campo detrás o cerca de la línea, la línea del VAR reglamentaria
  // debe trazarse sobre el penúltimo defensor excluyendo al arquero de ser la línea si hay jugadores de campo
  const outfield = sorted.filter(p => p.position !== 'GK' && p.tacticalRole !== 'GK')
  if (outfield.length >= 2) {
    return outfield[0]
  }

  // sorted[0] es el último defensor (habitualmente el arquero)
  // sorted[1] es el penúltimo defensor que marca la línea reglamentaria de offside
  return sorted[1] || outfield[0] || sorted[0]
}

export function evaluateOffsideAtKick(matchDetails, attackingTeam, defendingTeam, passer, targetPlayer, ballPos) {
  if (!matchDetails || !targetPlayer || !defendingTeam || !passer) return null

  // Regla 11 IFAB (Open Football PassOriginRestart::is_offside_exempt):
  // No hay fuera de juego directamente desde un Saque de Esquina, Saque de Banda o Saque de Meta.
  if (
    matchDetails.ball.isCornerKick ||
    matchDetails.ball.isThrowIn ||
    matchDetails.ball.isGoalKick ||
    matchDetails.ball.isOffsideExempt
  ) {
    return null
  }
  const [, pitchHeight] = matchDetails.pitchSize
  const halfwayY = pitchHeight / 2
  // La dirección de ataque se basa de forma confiable en el arquero del equipo atacante (players[0])
  const attackingTop = (attackingTeam?.players?.[0]?.originPOS?.[1] ?? passer.originPOS[1]) > halfwayY

  const secondLastDef = getSecondLastDefender(defendingTeam, attackingTop, pitchHeight)
  if (!secondLastDef) return null

  const defendingLineY = secondLastDef.currentPOS[1]
  const targetY = targetPlayer.currentPOS[1]
  const ballY = ballPos[1]

  // 1. Debe estar en campo contrario (más allá de la línea media)
  const inOpponentHalf = attackingTop ? (targetY < halfwayY) : (targetY > halfwayY)

  // 2. Margen de tolerancia realista (pie/hombro)
  const TOLERANCE = 1.5
  let isOffside = false
  if (inOpponentHalf) {
    if (attackingTop) {
      // Atacando hacia Y=0: más cerca de línea de fondo rival = menor Y
      isOffside = (targetY < defendingLineY - TOLERANCE) && (targetY < ballY - TOLERANCE)
    } else {
      // Atacando hacia Y=pitchHeight: más cerca de línea de fondo rival = mayor Y
      isOffside = (targetY > defendingLineY + TOLERANCE) && (targetY > ballY + TOLERANCE)
    }
  }

  // Snapshot detallado para congelar la jugada en la repetición del VAR
  const playersSnapshot = {
    attacking: (attackingTeam.players || []).map(p => ({
      id: p.playerID || p.id,
      name: p.name,
      shirtNumber: p.shirtNumber,
      pos: Array.isArray(p.currentPOS) ? [...p.currentPOS] : ['NP', 'NP'],
      role: p.tacticalRole || p.position,
      isPasser: (p.playerID || p.id) === (passer.playerID || passer.id),
      isTarget: (p.playerID || p.id) === (targetPlayer.playerID || targetPlayer.id)
    })),
    defending: (defendingTeam.players || []).map(p => ({
      id: p.playerID || p.id,
      name: p.name,
      shirtNumber: p.shirtNumber,
      pos: Array.isArray(p.currentPOS) ? [...p.currentPOS] : ['NP', 'NP'],
      role: p.tacticalRole || p.position,
      isSecondLast: (p.playerID || p.id) === (secondLastDef.playerID || secondLastDef.id)
    }))
  }

  return {
    isOffside,
    passerID: passer.playerID,
    passerName: passer.name,
    passerPOS: [...passer.currentPOS],
    ballPOS: [ballPos[0], ballPos[1]],
    targetPlayerID: targetPlayer.playerID,
    targetPlayerName: targetPlayer.name,
    targetPlayerPOS: [...targetPlayer.currentPOS],
    defendingLineY,
    secondLastDefenderID: secondLastDef.playerID,
    secondLastDefenderName: secondLastDef.name,
    secondLastDefenderPOS: [...secondLastDef.currentPOS],
    attackingTop,
    iteration: matchDetails.iterationCount || 0,
    playersSnapshot
  }
}

export function executeGoalkeeperSave(matchDetails, goalie, goalieTeam, currentBallPos) {
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  const goalieSide = (goalie.originPOS[1] < (pitchHeight / 2)) ? 'top' : 'bottom'
  goalie.stats.saves = (goalie.stats.saves || 0) + 1
  matchDetails.ball.saveChecked = true
  matchDetails.ball.isPendingPass = false
  matchDetails.pendingOffsideSnapshot = null

  // Contacto visual entre el arquero y la pelota en la atajada
  goalie.currentPOS = [
    Math.max(240, Math.min(pitchWidth - 240, Math.round(currentBallPos[0]))),
    goalieSide === 'top' ? Math.max(6, Math.min(55, Math.round(currentBallPos[1]))) : Math.min(pitchHeight - 6, Math.max(pitchHeight - 55, Math.round(currentBallPos[1])))
  ]
  goalie.intentPOS = goalie.currentPOS.slice()

  const ballX = currentBallPos[0]
  const isLeftCorner = ballX < (pitchWidth / 2)

  // Desglose de atajadas inspirado en save.rs de Open Football:
  // - 36% Parry al córner (la pelota es desviada por arriba del travesaño o contra el poste)
  // - 30% Rebote al área chica / punto penal (balón suelto en zona caliente)
  // - 34% Embolsada limpia (el arquero retiene el balón en sus manos)
  const roll = common.getRandomNumber(1, 100)

  if (roll <= 36) {
    matchDetails.iterationLog.push(`Magnificent save by ${goalie.name}! Ball tipped out for a corner`)
    if (Array.isArray(matchDetails.events)) {
      matchDetails.events.push({
        type: 'save',
        outcome: 'corner',
        teamID: goalieTeam.teamID,
        teamName: goalieTeam.name,
        playerName: goalie.name,
        iteration: matchDetails.iterationCount || 0,
        half: matchDetails.half
      })
    }
    // Trayectoria realista de desvío hacia afuera por la línea de fondo / córner
    const cornerTargetY = goalieSide === 'top' ? common.getRandomNumber(-35, -18) : common.getRandomNumber(pitchHeight + 18, pitchHeight + 35)
    const centreGoal = pitchWidth / 2
    const cornerTargetX = isLeftCorner
      ? common.getRandomNumber(Math.max(-20, ballX - 70), Math.min(ballX - 10, centreGoal - 48))
      : common.getRandomNumber(Math.max(ballX + 10, centreGoal + 48), Math.min(pitchWidth + 20, ballX + 70))

    const traj = common.getBallTrajectory(currentBallPos, [cornerTargetX, cornerTargetY], 115, 'deflection', pitchHeight)
    matchDetails.ball.ballOverIterations = traj
    matchDetails.ball.position = traj[0] || [currentBallPos[0], currentBallPos[1], 0]
    matchDetails.ball.lastTouch.playerID = goalie.playerID
    matchDetails.ball.lastTouch.playerName = goalie.name
    matchDetails.ball.lastTouch.teamID = goalieTeam.teamID
    matchDetails.ball.lastTouch.deflection = true
    matchDetails.ball.lastTouch.iterations = 0
    matchDetails.ball.Player = ''
    matchDetails.ball.withPlayer = false
    matchDetails.ball.withTeam = ''
    goalie.hasBall = false
    matchDetails.endIteration = true
    return matchDetails
  } else if (roll <= 66) {
    const reboundTypeRoll = common.getRandomNumber(1, 100)
    let reboundPower = 40
    let targetX = goalie.currentPOS[0]
    let targetY = goalie.currentPOS[1]
    let reboundDesc = ''
    let loftHeight = 10

    if (reboundTypeRoll <= 35) {
      // 1. Rebote corto: pelota suelta viva a pocos metros del arquero en el área chica
      const dropDistanceX = common.getRandomNumber(-20, 20)
      const dropDistanceY = goalieSide === 'top' ? common.getRandomNumber(14, 28) : -common.getRandomNumber(14, 28)
      targetX = Math.max(160, Math.min(pitchWidth - 160, goalie.currentPOS[0] + dropDistanceX))
      targetY = goalieSide === 'top'
        ? Math.max(25, Math.min(100, goalie.currentPOS[1] + dropDistanceY))
        : Math.min(pitchHeight - 25, Math.max(pitchHeight - 100, goalie.currentPOS[1] + dropDistanceY))
      reboundPower = common.getRandomNumber(30, 50)
      loftHeight = common.getRandomNumber(4, 9)
      reboundDesc = '¡Rebote corto en el área chica!'
    } else if (reboundTypeRoll <= 65) {
      // 2. Rebote largo: el arquero manotea o despeja fuerte hacia el punto penal o medialuna
      const dropDistanceX = common.getRandomNumber(-55, 55)
      const dropDistanceY = goalieSide === 'top' ? common.getRandomNumber(55, 110) : -common.getRandomNumber(55, 110)
      targetX = Math.max(140, Math.min(pitchWidth - 140, goalie.currentPOS[0] + dropDistanceX))
      targetY = goalieSide === 'top'
        ? Math.max(80, Math.min(185, goalie.currentPOS[1] + dropDistanceY))
        : Math.min(pitchHeight - 80, Math.max(pitchHeight - 185, goalie.currentPOS[1] + dropDistanceY))
      reboundPower = common.getRandomNumber(70, 105)
      loftHeight = common.getRandomNumber(10, 18)
      reboundDesc = '¡Rebote largo hacia la medialuna del área!'
    } else if (reboundTypeRoll <= 85) {
      // 3. Rebote con altura: la pelota sale bombeada hacia arriba y cae en parábola
      const dropDistanceX = common.getRandomNumber(-30, 30)
      const dropDistanceY = goalieSide === 'top' ? common.getRandomNumber(20, 50) : -common.getRandomNumber(20, 50)
      targetX = Math.max(150, Math.min(pitchWidth - 150, goalie.currentPOS[0] + dropDistanceX))
      targetY = goalieSide === 'top'
        ? Math.max(35, Math.min(130, goalie.currentPOS[1] + dropDistanceY))
        : Math.min(pitchHeight - 35, Math.max(pitchHeight - 130, goalie.currentPOS[1] + dropDistanceY))
      reboundPower = common.getRandomNumber(50, 75)
      loftHeight = common.getRandomNumber(26, 42) // Elevada parábola aérea
      reboundDesc = '¡Pelota elevada que pica tras la atajada del arquero!'
    } else {
      // 4. Rebote lateral / angular: desviada hacia los costados del área
      const toLeft = common.getRandomNumber(0, 10) > 5
      const dropDistanceX = toLeft ? -common.getRandomNumber(45, 85) : common.getRandomNumber(45, 85)
      const dropDistanceY = goalieSide === 'top' ? common.getRandomNumber(25, 60) : -common.getRandomNumber(25, 60)
      targetX = Math.max(110, Math.min(pitchWidth - 110, goalie.currentPOS[0] + dropDistanceX))
      targetY = goalieSide === 'top'
        ? Math.max(40, Math.min(150, goalie.currentPOS[1] + dropDistanceY))
        : Math.min(pitchHeight - 40, Math.max(pitchHeight - 150, goalie.currentPOS[1] + dropDistanceY))
      reboundPower = common.getRandomNumber(55, 85)
      loftHeight = common.getRandomNumber(8, 16)
      reboundDesc = '¡Desvío esquinado hacia el lateral del área!'
    }

    const traj = common.getBallTrajectory(currentBallPos, [targetX, targetY], reboundPower, 'rebound', pitchHeight)
    // Asignar altura z si es un rebote alto
    if (loftHeight > 20 && Array.isArray(traj) && traj.length > 2) {
      const len = traj.length
      for (let k = 0; k < len; k++) {
        const tStep = k / (len - 1)
        traj[k][2] = Math.round(4 * loftHeight * tStep * (1 - tStep))
      }
    }

    matchDetails.ball.ballOverIterations = traj
    matchDetails.ball.position = traj[0] || [currentBallPos[0], currentBallPos[1], 0]
    matchDetails.ball.Player = ''
    matchDetails.ball.withPlayer = false
    matchDetails.ball.withTeam = ''
    matchDetails.ball.lastTouch.playerID = goalie.playerID
    matchDetails.ball.lastTouch.playerName = goalie.name
    matchDetails.ball.lastTouch.teamID = goalieTeam.teamID
    matchDetails.ball.lastTouch.iterations = 0
    matchDetails.ball.lastTouch.deflection = true
    matchDetails.ball.lastReboundIter = matchDetails.iterationCount || 0
    goalie.hasBall = false

    matchDetails.iterationLog.push(`Save by ${goalie.name}! ${reboundDesc}`)
    if (Array.isArray(matchDetails.events)) {
      matchDetails.events.push({
        type: 'save',
        outcome: 'rebound',
        reboundType: reboundDesc,
        teamID: goalieTeam.teamID,
        teamName: goalieTeam.name,
        playerName: goalie.name,
        iteration: matchDetails.iterationCount || 0,
        half: matchDetails.half
      })
    }
    matchDetails.endIteration = true
    return matchDetails
  } else {
    setBallMovementMatchDetails(matchDetails, goalie, currentBallPos, goalieTeam)
    matchDetails.iterationLog.push(`Ball saved and held cleanly by ${goalie.name}`)
    goalie.hasBall = true
    matchDetails.ball.lastTouch.deflection = false
    matchDetails.ball.position[2] = 0
    if (Array.isArray(matchDetails.events)) {
      matchDetails.events.push({
        type: 'save',
        outcome: 'catch',
        teamID: goalieTeam.teamID,
        teamName: goalieTeam.name,
        playerName: goalie.name,
        iteration: matchDetails.iterationCount || 0,
        half: matchDetails.half
      })
    }
    matchDetails.endIteration = true
    return matchDetails
  }
}

function getTeamStatisticsObject(matchDetails, team) {
  if (team && team.teamID === matchDetails.kickOffTeam.teamID) {
    return matchDetails.kickOffTeamStatistics
  }
  return matchDetails.secondTeamStatistics
}

export function moveBall(matchDetails) {
  const { ball, kickOffTeam, secondTeam } = matchDetails
  if (!ball.ballOverIterations || ball.ballOverIterations.length === 0) {
    // Si la pelota aún tiene inercia de rodamiento sobre el césped tras completarse la trayectoria principal
    if (ball.velocity && !ball.withPlayer) {
      const [vx, vy] = ball.velocity
      const speed = Math.sqrt(vx * vx + vy * vy)
      if (speed > 0.8) {
        const grassFriction = 0.90
        let nVx = vx * grassFriction
        let nVy = vy * grassFriction
        const [pitchWidth] = matchDetails.pitchSize
        const curPos = ball.position

        // Amortiguación de inercia lateral cerca de la línea de cal para evitar que pases completados rueden afuera
        if ((curPos[0] < 28 && nVx < 0) || (curPos[0] > pitchWidth - 28 && nVx > 0)) {
          nVx *= 0.2
          if (Math.abs(nVx) < 0.6) nVx = 0
        }

        const nPos = [
          common.round(curPos[0] + nVx, 2),
          common.round(curPos[1] + nVy, 2),
          0
        ]
        ball.velocity = [nVx, nVy]
        ball.position = nPos

        // Si hay un pase en tránsito rodando, actualizar el objetivo dinámico a la posición real rodante
        if (ball.isPendingPass) {
          ball.targetPOS = [nPos[0], nPos[1]]
        }

        // Chequear si un jugador de cualquiera de los dos equipos la intercepta o controla (Ordered)
        const dummyBallPlayer = setBPlayer(nPos)
        const p1 = setPositions.closestPlayerToPosition(dummyBallPlayer, kickOffTeam, nPos)
        const p2 = setPositions.closestPlayerToPosition(dummyBallPlayer, secondTeam, nPos)
        const isT1Closer = p1.proxToBall <= p2.proxToBall
        const ordered = isT1Closer
          ? [{ player: p1.thePlayer, team: kickOffTeam }, { player: p2.thePlayer, team: secondTeam }]
          : [{ player: p2.thePlayer, team: secondTeam }, { player: p1.thePlayer, team: kickOffTeam }]

        for (const candidate of ordered) {
          if (candidate.player && !matchDetails.ball.withPlayer) {
            thisPlayerIsInProximity(matchDetails, candidate.player, curPos, nPos, speed * 10, candidate.team)
            if (matchDetails.ball.withPlayer || matchDetails.endIteration) break
          }
        }
        if (matchDetails.endIteration === true) return matchDetails
        const lastTeamID = ball.lastTouch.teamID
        matchDetails = setPositions.keepInBoundaries(matchDetails, lastTeamID, nPos)
        return matchDetails
      }
      ball.velocity = [0, 0]
      ball.isPendingPass = false
      ball.isAerialCrossDelivery = false
      ball.targetPlayerID = null
      ball.targetPOS = null
    } else if (!ball.withPlayer && ball.isPendingPass) {
      ball.isPendingPass = false
      ball.isAerialCrossDelivery = false
      ball.targetPlayerID = null
      ball.targetPOS = null
    }
    ball.direction = 'wait'
    if (ball.position.length === 2) ball.position = [ball.position[0], ball.position[1], 0]
    return matchDetails
  }
  const currentPos = ball.position
  const nextPoint = ball.ballOverIterations[0]
  getBallDirection(matchDetails, nextPoint)
  const player = setBPlayer(nextPoint)
  const endPos = resolveBallMovement(player, matchDetails)

  if (matchDetails.endIteration === true) return matchDetails

  const safeEndPos = [
    Number(endPos[0] ?? currentPos[0]),
    Number(endPos[1] ?? currentPos[1]),
    Number(endPos[2] ?? 0)
  ]
  ball.position = safeEndPos
  matchDetails.iterationLog.push(`ball still moving from previous kick: ${safeEndPos}`)
  const lastTeamID = matchDetails.ball.lastTouch.teamID
  matchDetails = setPositions.keepInBoundaries(matchDetails, lastTeamID, safeEndPos)
  return matchDetails
}

export function setBPlayer(ballPos) {
  return {
    name: 'Ball',
    position: 'LB',
    rating: 100,
    skill: {
      passing: 100,
      shooting: 100,
      saving: 100,
      tackling: 100,
      agility: 100,
      strength: 100,
      penalty_taking: 100,
      freekick: 100,
      perception: 100,
      jumping: 100,
      control: 100
    },
    fitness: 100,
    height: 160,
    originPOS: ballPos,
    currentPOS: ballPos,
    injured: false
  }
}

export function ballKicked(matchDetails, team, player) {
  const { position } = matchDetails.ball
  const [, pitchHeight] = matchDetails.pitchSize
  matchDetails.iterationLog.push(`ball kicked by: ${player.name}`)
  matchDetails.ball.lastTouch.playerName = player.name
  matchDetails.ball.lastTouch.playerID = player.playerID
  matchDetails.ball.lastTouch.teamID = team.teamID
  matchDetails.ball.lastTouch.iterations = 0
  let newPos = [0, 0]
  const topTeamDirection = [
    'wait', 'north', 'north', 'north', 'north', 'east', 'east', 'west', 'west',
    'northeast', 'northeast', 'northeast', 'northwest', 'northwest', 'northwest'
  ]
  const bottomTeamDirection = [
    'wait', 'south', 'south', 'south', 'south', 'east', 'east', 'west', 'west',
    'southeast', 'southeast', 'southeast', 'southwest', 'southwest', 'southwest'
  ]
  let power = common.calculatePower(player.skill.strength, pitchHeight)
  const calcHeight = parseInt(player.height, 10) + parseInt((player.skill.jumping || 0), 10)
  const bodyPart = setAttackBodyPart(position, calcHeight)
  matchDetails.ball.lastTouch.bodyPart = bodyPart
  const isHeader = bodyPart === 'head'
  const isVolley = ['stomach', 'back', 'chest', 'shoulder'].includes(bodyPart)
  if (isHeader) {
    matchDetails.iterationLog.push(`Header made by: ${player.name}`)
    power *= 0.7
  } else if (isVolley) {
    matchDetails.iterationLog.push(`Volley kick made by: ${player.name}`)
    power *= 0.9
  }
  let direction
  if (player.originPOS[1] > (pitchHeight / 2)) {
    direction = topTeamDirection[common.getRandomNumber(0, topTeamDirection.length - 1)]
    newPos = getTopKickedPosition(direction, position, power)
  } else {
    direction = bottomTeamDirection[common.getRandomNumber(0, bottomTeamDirection.length - 1)]
    newPos = getBottomKickedPosition(direction, position, power)
  }
  const [pitchWidth] = matchDetails.pitchSize
  newPos[0] = Math.max(28, Math.min(pitchWidth - 28, newPos[0]))
  return calcBallMovementOverTime(matchDetails, power, newPos, player, 'kick')
}

export function getTopKickedPosition(direction, position, power) {
  if (direction === 'wait') return newKickedPosition(position, 0, (power / 2), 0, (power / 2))
  if (direction === 'north') return newKickedPosition(position, -20, 20, -power, -(power / 2))
  if (direction === 'east') return newKickedPosition(position, (power / 2), power, -20, 20)
  if (direction === 'west') return newKickedPosition(position, -power, -(power / 2), -20, 20)
  if (direction === 'northeast') return newKickedPosition(position, 0, (power / 2), -power, -(power / 2))
  if (direction === 'northwest') return newKickedPosition(position, -(power / 2), 0, -power, -(power / 2))
  return newKickedPosition(position, -20, 20, -power, -(power / 2))
}

export function getBottomKickedPosition(direction, position, power) {
  if (direction === 'wait') return newKickedPosition(position, 0, (power / 2), 0, (power / 2))
  if (direction === 'south') return newKickedPosition(position, -20, 20, (power / 2), power)
  if (direction === 'east') return newKickedPosition(position, (power / 2), power, -20, 20)
  if (direction === 'west') return newKickedPosition(position, -power, -(power / 2), -20, 20)
  if (direction === 'southeast') return newKickedPosition(position, 0, (power / 2), (power / 2), power)
  if (direction === 'southwest') return newKickedPosition(position, -(power / 2), 0, (power / 2), power)
  return newKickedPosition(position, -20, 20, (power / 2), power)
}

function newKickedPosition(pos, lowX, highX, lowY, highY) {
  return [
    pos[0] + common.getRandomNumber(lowX, highX),
    pos[1] + common.getRandomNumber(lowY, highY)
  ]
}

export function shotMade(matchDetails, team, player) {
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  matchDetails.iterationLog.push(`Shot Made by: ${player.name}`)
  matchDetails.ball.lastTouch.playerName = player.name
  matchDetails.ball.lastTouch.playerID = player.playerID
  matchDetails.ball.lastTouch.teamID = team.teamID
  matchDetails.ball.lastTouch.iterations = 0
  matchDetails.ball.lastShooter = {
    playerID: player.playerID,
    playerName: player.name,
    teamID: team.teamID
  }
  const shotPosition = [0, 0]
  const PlyPos = player.currentPOS
  const attackingTop = player.originPOS[1] > pitchHeight / 2
  const distToGoalLine = attackingTop ? PlyPos[1] : (pitchHeight - PlyPos[1])
  let shotPower = Math.max(
    distToGoalLine + 35,
    common.calculatePower(player.skill.strength, pitchHeight)
  )
  const thisTeamStats = getTeamStatisticsObject(matchDetails, team)

  thisTeamStats.shots.total++
  player.stats.shots.total++
  const calcHeight = parseInt(player.height, 10) + parseInt((player.skill.jumping || 0), 10)
  const bodyPart = setAttackBodyPart(matchDetails.ball.position, calcHeight, player)
  matchDetails.ball.lastTouch.bodyPart = bodyPart
  const isHeader = bodyPart === 'head'
  const isVolley = ['stomach', 'back', 'chest', 'shoulder'].includes(bodyPart)
  const hasTrait = (t) => Array.isArray(player.traits) && player.traits.includes(t)
  if (isHeader) {
    matchDetails.iterationLog.push(`Header Shot by: ${player.name}`)
    const headBoost = (hasTrait('cabeceador_nato') || hasTrait('artillero_area') || (Number(player.skill.jumping) || 70) >= 80) ? 1.15 : 1.0
    shotPower = Math.max(distToGoalLine + 25, shotPower * 0.88 * headBoost)
  } else if (isVolley) {
    matchDetails.iterationLog.push(`Volley Shot by: ${player.name}`)
    shotPower = Math.max(distToGoalLine + 25, shotPower * 0.92)
  }

  matchDetails.ball.lastShotDistance = distToGoalLine

  // Penalización progresiva por distancia fuera del área (> 165px)
  const extraDist = Math.max(0, distToGoalLine - 165)
  const distancePenalty = extraDist > 0
    ? Math.round(extraDist * 0.22 + (extraDist > 75 ? (extraDist - 75) * 0.18 : 0))
    : 0
  let shootingRoll = common.getRandomNumber(20, 94) + distancePenalty
  if (isVolley) shootingRoll += 4

  const headingSkill = Number(player.skill?.heading ?? player.skill?.cabeza ?? player.skill?.shooting ?? 70)
  const jumpingSkill = Number(player.skill?.jumping) || 70
  const perceptionSkill = Number(player.skill?.perception) || 70
  const strengthSkill = Number(player.skill?.strength) || 70
  const rawHeight = Number(player.height) || 175

  let effectiveShotSkill = Number(player.skill?.shooting) || 70
  if (isHeader) {
    // Para cabezazos, el atributo determinante es CABEZA combinado con salto, altura, percepción y fuerza
    const heightBonus = Math.max(-5, (rawHeight - 175) * 0.4)
    const effectiveHeaderRating = (headingSkill * 0.50) + (jumpingSkill * 0.22) + (perceptionSkill * 0.16) + (strengthSkill * 0.12) + heightBonus
    effectiveShotSkill = Math.max(30, Math.min(99, Math.round(effectiveHeaderRating)))

    // Especialistas como Palermo (cabeceador_nato, artillero_area, o gran cabeceo) aumentan drásticamente la efectividad
    if (hasTrait('cabeceador_nato') || headingSkill >= 90) {
      shootingRoll -= 18
      shotPower = Math.max(distToGoalLine + 45, shotPower * 1.20)
    } else if (hasTrait('artillero_area') || jumpingSkill >= 80) {
      shootingRoll -= 10
    } else {
      shootingRoll += 2
    }
  }

  const isSprintingShot = !!(player.isSprinting || (player.sprintMomentum || 0) > 0.35)

  // Física de remate en sprint: +22% potencia pero ligero castigo de puntería (mitigado por control/estrellas)
  if (isSprintingShot) {
    shotPower *= 1.22
    const controlBuffer = Math.max(0, (Number(player.skill.control) || 70) - 78) * 0.5
    const traitBuffer = (hasTrait('fenomeno_encarador') || hasTrait('playmaker_gambeteador')) ? 6 : 0
    const sprintSpread = Math.max(0, 14 - controlBuffer - traitBuffer)
    shootingRoll += sprintSpread
    matchDetails.iterationLog.push(`Explosive sprint shot by: ${player.name} (Power boosted)`)
  }

  if (hasTrait('canonero_media_distancia') || hasTrait('lanzador_canonero')) {
    shotPower *= 1.18
  }
  if (hasTrait('artillero_area') && distToGoalLine <= 180) {
    shootingRoll -= 8
  }

  const centreGoal = pitchWidth / 2
  const isOneOnOne = distToGoalLine <= 145 && Math.abs(PlyPos[0] - centreGoal) < 140
  matchDetails.ball.isOneOnOne = isOneOnOne

  // En mano a mano, los delanteros con buen remate definen con mayor efectividad (open-football OneVOne xG 1.20)
  if (isOneOnOne) {
    shootingRoll = Math.max(10, shootingRoll - 16)
  }

  let shotType = 'close_range'
  let goalDetail = 'Tiro dentro del área'

  if (isHeader) {
    shotType = 'header'
    goalDetail = 'Cabezazo'
  } else if (isVolley) {
    shotType = 'volley'
    goalDetail = 'De volea'
  } else if (distToGoalLine > 210 || hasTrait('canonero_media_distancia') || hasTrait('lanzador_canonero')) {
    shotType = 'long_range'
    goalDetail = 'Bombazo de media distancia'
  } else if (isOneOnOne) {
    shotType = 'finesse'
    goalDetail = 'A colocar'
  } else if (isSprintingShot || (player.skill?.strength || 0) >= 86) {
    shotType = 'power_shot'
    goalDetail = 'Tiro potente'
  } else if (distToGoalLine <= 140) {
    shotType = 'close_range'
    goalDetail = 'Tiro dentro del área'
  }

  matchDetails.ball.lastTouch.shotType = shotType
  matchDetails.ball.lastTouch.goalDetail = goalDetail

  if (effectiveShotSkill >= shootingRoll) {
    thisTeamStats.shots.on++
    player.stats.shots.on++
    if (isOneOnOne) {
      // En mano a mano, el delantero busca colocarla hacia los postes (lejos del centro del arco)
      const aimCorner = common.getRandomNumber(0, 10) > 3
      if (aimCorner) {
        const chooseLeft = common.getRandomNumber(0, 10) > 5
        shotPosition[0] = chooseLeft
          ? common.getRandomNumber(centreGoal - 39, centreGoal - 18)
          : common.getRandomNumber(centreGoal + 18, centreGoal + 39)
      } else {
        shotPosition[0] = common.getRandomNumber(centreGoal - 16, centreGoal + 16)
      }
    } else {
      shotPosition[0] = common.getRandomNumber(centreGoal - 41, centreGoal + 41)
    }
    matchDetails.iterationLog.push(`Shot On Target at X Position ${shotPosition[0]}`)
    shotPosition[1] = attackingTop ? -1 : (pitchHeight + 1)
    if (Array.isArray(matchDetails.events)) {
      matchDetails.events.push({
        type: 'shot',
        onTarget: true,
        teamID: team.teamID,
        teamName: team.name,
        playerName: player.name,
        iteration: matchDetails.iterationCount || 0,
        half: matchDetails.half,
        bodyPart,
        isHeader,
        isVolley,
        shotType,
        goalDetail
      })
    }
  } else {
    thisTeamStats.shots.off++
    player.stats.shots.off++
    // Los tiros desviados pasan cerca de los palos (nunca hacia el córner ni a mitad de camino)
    const missLeft = common.getRandomNumber(0, 10) > 5
    const maxMissSpread = Math.min(54, Math.max(22, 65 - Math.round((player.skill.shooting || 70) * 0.4)))
    shotPosition[0] = missLeft
      ? common.getRandomNumber(centreGoal - 46 - maxMissSpread, centreGoal - 47)
      : common.getRandomNumber(centreGoal + 47, centreGoal + 46 + maxMissSpread)
    matchDetails.iterationLog.push(`Shot Off Target at X Position ${shotPosition[0]}`)
    shotPosition[1] = attackingTop ? -32 : (pitchHeight + 32)
    if (Array.isArray(matchDetails.events)) {
      matchDetails.events.push({
        type: 'shot',
        onTarget: false,
        outcome: 'miss',
        teamID: team.teamID,
        teamName: team.name,
        playerName: player.name,
        iteration: matchDetails.iterationCount || 0,
        half: matchDetails.half,
        bodyPart,
        isHeader,
        isVolley,
        shotType,
        goalDetail
      })
    }
  }
  const endPos = calcBallMovementOverTime(matchDetails, shotPower, shotPosition, player, 'shot')
  if (matchDetails.endIteration === true) return endPos
  checkGoalScored(matchDetails)
  return endPos
}

/**
 * Remate directo de tiro libre usando el atributo freekick (FK) del ejecutor.
 */
export function freekickShotMade(matchDetails, team, player) {
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  player.action = 'none'
  matchDetails.ball.isRestart = false

  // Regla 13 IFAB: Tiro libre indirecto no puede rematarse directo al arco
  if (matchDetails.ball.isIndirect) {
    matchDetails.iterationLog.push(`Indirect freekick: ${player.name} plays into the box instead of shooting directly.`)
    return ballCrossed(matchDetails, team, player)
  }

  // Jugada preparada de distracción / pantalla (Decoy Dummy Run):
  // El señuelo corre y salta por encima de la pelota, descolocando a la barrera y arquero rival
  let decoyBoost = 0
  if (matchDetails.ball.decoyRunner) {
    const decoy = matchDetails.ball.decoyRunner
    matchDetails.iterationLog.push(`★ Jugada preparada: ${decoy.name} amaga y salta sobre el balón distrayendo a la barrera rival!`)
    decoyBoost = 10
    matchDetails.ball.decoyRunner = null
  }

  matchDetails.iterationLog.push(`Direct Freekick Shot by: ${player.name}`)
  matchDetails.ball.lastTouch.playerName = player.name
  matchDetails.ball.lastTouch.playerID = player.playerID
  matchDetails.ball.lastTouch.teamID = team.teamID
  matchDetails.ball.lastTouch.iterations = 0
  matchDetails.ball.lastShooter = {
    playerID: player.playerID,
    playerName: player.name,
    teamID: team.teamID
  }
  matchDetails.ball.lastTouch.bodyPart = 'foot'
  matchDetails.ball.lastTouch.shotType = 'freekick'
  matchDetails.ball.lastTouch.goalDetail = 'Tiro libre'

  const fkSkill = Number(player.skill.freekick || player.skill.shooting || 70) + decoyBoost
  const isCanonero = Array.isArray(player.traits) && (player.traits.includes('canonero_media_distancia') || player.traits.includes('lanzador_canonero'))
  const baseFkPower = Math.max(
    pitchHeight * 0.32,
    common.calculatePower(Math.max(player.skill.strength, fkSkill), pitchHeight)
  )
  const shotPower = isCanonero ? baseFkPower * 1.20 : baseFkPower
  const thisTeamStats = getTeamStatisticsObject(matchDetails, team)
  thisTeamStats.shots.total++
  player.stats.shots.total++

  const targetGoalY = (player.originPOS[1] > pitchHeight / 2) ? 0 : pitchHeight
  const distToGoal = common.distance(matchDetails.ball.position, [pitchWidth / 2, targetGoalY])

  // Verificación de bloqueo de la barrera defensiva (Open Football wall_block_prob)
  if (Array.isArray(matchDetails.ball.defendingWall) && matchDetails.ball.defendingWall.length > 0) {
    const blockProb = common.calculateWallBlockProb(matchDetails.ball.defendingWall, fkSkill, distToGoal)
    if (common.getRandomNumber(1, 100) <= Math.round(blockProb * 100)) {
      matchDetails.iterationLog.push(`¡El tiro libre se estrella en la barrera defensiva! Bloqueado por la defensa.`)
      thisTeamStats.shots.off++
      player.stats.shots.off++
      matchDetails.ball.defendingWall = null
      const deflectPos = [
        matchDetails.ball.position[0] + common.getRandomNumber(-35, 35),
        matchDetails.ball.position[1] + (targetGoalY === 0 ? -45 : 45),
        common.getRandomNumber(0, 15)
      ]
      return calcBallMovementOverTime(matchDetails, shotPower * 0.35, deflectPos, player, 'deflection')
    }
  }
  matchDetails.ball.defendingWall = null

  const centreGoal = pitchWidth / 2
  const shotPosition = [0, 0]
  const fkRoll = common.getRandomNumber(25, 98)
  if (fkSkill >= fkRoll) {
    thisTeamStats.shots.on++
    player.stats.shots.on++
    shotPosition[0] = common.getRandomNumber(centreGoal - 40, centreGoal + 40)
    matchDetails.iterationLog.push(`Freekick Shot On Target by: ${player.name}`)
    if (player.originPOS[1] > pitchHeight / 2) shotPosition[1] = -1
    else shotPosition[1] = pitchHeight + 1
  } else {
    thisTeamStats.shots.off++
    player.stats.shots.off++
    const left = common.getRandomNumber(0, 10) > 5
    shotPosition[0] = left
      ? common.getRandomNumber(centreGoal - 88, centreGoal - 47)
      : common.getRandomNumber(centreGoal + 47, centreGoal + 88)
    matchDetails.iterationLog.push(`Freekick Shot Off Target by: ${player.name}`)
    if (player.originPOS[1] > pitchHeight / 2) shotPosition[1] = -2
    else shotPosition[1] = pitchHeight + 2
  }

  const endPos = calcBallMovementOverTime(matchDetails, shotPower, shotPosition, player, 'freekick')
  if (matchDetails.endIteration === true) return endPos
  checkGoalScored(matchDetails)
  return endPos
}

export function penaltyTaken(matchDetails, team, player) {
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  player.action = 'none'
  matchDetails.iterationLog.push(`Penalty Taken by: ${player.name}`)
  matchDetails.ball.lastTouch.playerName = player.name
  matchDetails.ball.lastTouch.playerID = player.playerID
  matchDetails.ball.lastTouch.teamID = team.teamID
  matchDetails.ball.lastTouch.iterations = 0
  matchDetails.ball.lastShooter = {
    playerID: player.playerID,
    playerName: player.name,
    teamID: team.teamID
  }
  const calcHeight = parseInt(player.height, 10) + parseInt((player.skill.jumping || 0), 10)
  const bodyPart = setAttackBodyPart(matchDetails.ball.position, calcHeight)
  matchDetails.ball.lastTouch.bodyPart = bodyPart
  matchDetails.ball.lastTouch.shotType = 'penalty'
  matchDetails.ball.lastTouch.goalDetail = 'De penal'
  const shotPosition = [0, 0]
  const shotPower = common.calculatePower(Math.max(75, player.skill.strength), pitchHeight)
  const attackingTop = player.originPOS[1] > pitchHeight / 2
  const centreGoal = pitchWidth / 2
  const thisTeamStats = getTeamStatisticsObject(matchDetails, team)

  thisTeamStats.shots.total++
  player.stats.shots.total++
  const isOnTarget = player.skill.penalty_taking >= common.getRandomNumber(12, 95)
  if (Array.isArray(matchDetails.events)) {
    matchDetails.events.push({
      type: 'penaltyKick',
      onTarget: isOnTarget,
      teamID: team.teamID,
      teamName: team.name,
      playerName: player.name,
      iteration: matchDetails.iterationCount || 0,
      half: matchDetails.half
    })
  }
  if (isOnTarget) {
    thisTeamStats.shots.on++
    player.stats.shots.on++
    shotPosition[0] = common.getRandomNumber(centreGoal - 41, centreGoal + 41)
    matchDetails.iterationLog.push(`Shot On Target at X Position ${shotPosition[0]}`)
    shotPosition[1] = attackingTop ? -1 : (pitchHeight + 1)
  } else {
    thisTeamStats.shots.off++
    player.stats.shots.off++
    const left = common.getRandomNumber(0, 10) > 5
    shotPosition[0] = left
      ? common.getRandomNumber(centreGoal - 75, centreGoal - 47)
      : common.getRandomNumber(centreGoal + 47, centreGoal + 75)
    matchDetails.iterationLog.push(`Shot Off Target at X Position ${shotPosition[0]}`)
    shotPosition[1] = attackingTop ? -2 : (pitchHeight + 2)
  }
  const endPos = calcBallMovementOverTime(matchDetails, shotPower, shotPosition, player, 'shot')
  if (matchDetails.endIteration === true) return endPos
  checkGoalScored(matchDetails)
  return endPos
}

export function checkGoalScored(matchDetails) {
  const { ball, kickOffTeam, secondTeam } = matchDetails
  const [pitchWidth, pitchHeight, goalWidth] = matchDetails.pitchSize
  const ballZ = ball.position[2] || 0
  const centreGoal = pitchWidth / 2
  const goalEdge = goalWidth / 2
  const goalX = common.isBetween(ball.position[0], centreGoal - goalEdge, centreGoal + goalEdge)
  const KOGoalie = kickOffTeam.players[0]
  const STGoalie = secondTeam.players[0]
  const ballProx = 24
  const [ballX, ballY] = ball.position
  const nearKOGoalieX = common.isBetween(ballX, KOGoalie.currentPOS[0] - ballProx, KOGoalie.currentPOS[0] + ballProx)
  const nearKOGoalieY = common.isBetween(ballY, KOGoalie.currentPOS[1] - ballProx, KOGoalie.currentPOS[1] + ballProx)
  const nearSTGoalieX = common.isBetween(ballX, STGoalie.currentPOS[0] - ballProx, STGoalie.currentPOS[0] + ballProx)
  const nearSTGoalieY = common.isBetween(ballY, STGoalie.currentPOS[1] - ballProx, STGoalie.currentPOS[1] + ballProx)
  const KOrHeight = KOGoalie.height + KOGoalie.skill.jumping
  const STrHeight = STGoalie.height + STGoalie.skill.jumping
  const KTGSaving = KOGoalie.skill.saving
  const STGSaving = STGoalie.skill.saving

  if (nearKOGoalieX && nearKOGoalieY && ballZ < KOrHeight && KTGSaving > common.getRandomNumber(0, 100)) {
    matchDetails = executeGoalkeeperSave(matchDetails, KOGoalie, kickOffTeam, ball.position)
    matchDetails.endIteration = true
  } else if (nearSTGoalieX && nearSTGoalieY && ballZ < STrHeight && STGSaving > common.getRandomNumber(0, 100)) {
    matchDetails = executeGoalkeeperSave(matchDetails, STGoalie, secondTeam, ball.position)
    matchDetails.endIteration = true
  } else if (goalX) {
    // Regla 13 IFAB (Open Football IndirectFreeKick):
    // Un tiro libre indirecto no puede terminar en gol directo sin que la toque otro jugador.
    if (ball.isIndirect && ball.lastTouch?.playerID === ball.indirectTakerID) {
      matchDetails.iterationLog.push(`Gol directo anulado por ser tiro libre indirecto (Regla 13 IFAB). Saque de arco concedido.`)
      ball.isIndirect = false
      if (ball.position[1] < 1) {
        return setPositions.setTopGoalKick(matchDetails)
      } else {
        return setPositions.setBottomGoalKick(matchDetails)
      }
    }
    ball.isIndirect = false
    const kickOffTeamSide = (kickOffTeam.players[0].originPOS[1] < (pitchHeight / 2)) ? 'top' : 'bottom'
    if (ball.position[1] < 1) {
      if (kickOffTeamSide === 'top') matchDetails = setPositions.setSecondTeamGoalScored(matchDetails)
      else matchDetails = setPositions.setKickOffTeamGoalScored(matchDetails)
    } else if (ball.position[1] >= pitchHeight) {
      if (kickOffTeamSide === 'top') matchDetails = setPositions.setKickOffTeamGoalScored(matchDetails)
      else matchDetails = setPositions.setSecondTeamGoalScored(matchDetails)
    }
  }
}

export function throughBall(matchDetails, team, player) {
  const { pitchSize } = matchDetails
  const [pitchWidth, pitchHeight] = pitchSize
  const ballPos = matchDetails.ball.position
  matchDetails.ball.lastTouch.playerName = player.name
  matchDetails.ball.lastTouch.playerID = player.playerID
  matchDetails.ball.lastTouch.teamID = team.teamID
  matchDetails.ball.lastTouch.iterations = 0
  matchDetails.iterationLog.push(`through ball attempted by: ${player.name}`)
  player.stats.passes.total++
  const teamStats = getTeamStatisticsObject(matchDetails, team)
  teamStats.passesTotal = (teamStats.passesTotal || 0) + 1

  const power = common.calculatePower(player.skill.strength, pitchHeight)
  const maxDist = power * 1.15
  const aTop = player.originPOS[1] > (pitchHeight / 2)
  const dir = aTop ? -1 : 1
  const opposition = (team.teamID === matchDetails.kickOffTeam.teamID) ? matchDetails.secondTeam : matchDetails.kickOffTeam
  const currentIter = matchDetails.iterationCount || 0
  const styleCfg = getPlayStyleConfig(team?.playStyle, team?.formation)
  const teammates = getPlayersInDistance(team, player, pitchSize, opposition, currentIter)
  if (!teammates || teammates.length === 0) return matchDetails

  const candidates = teammates.filter(p => {
    if (p.role === 'GK') return false
    const forward = aTop ? ballPos[1] - p.position[1] : p.position[1] - ballPos[1]
    if (forward < 15) return false
    const d = common.distance(ballPos, p.position)
    return d <= maxDist && d >= 32
  })
  if (candidates.length === 0) {
    return ballPassed(matchDetails, team, player)
  }
  candidates.sort((a, b) => tballScoreOption(b, aTop, ballPos, maxDist, styleCfg) - tballScoreOption(a, aTop, ballPos, maxDist, styleCfg))
  const targetPlayer = candidates[0]
  matchDetails.iterationLog.push(`through ball target: ${targetPlayer.name}`)

  // Gestión de Pared ("One-Two Wall Pass")
  if (
    matchDetails.wallPass &&
    matchDetails.wallPass.wallPartnerID === player.playerID &&
    currentIter <= matchDetails.wallPass.expireIter
  ) {
    const origPasserName = matchDetails.wallPass.passerName
    matchDetails.iterationLog.push(`One-two wall pass by: ${origPasserName} with ${player.name}`)
    if (Array.isArray(matchDetails.events)) {
      matchDetails.events.push({
        type: 'oneTwoPass',
        teamID: team.teamID,
        teamName: team.name,
        playerName: origPasserName,
        receiverName: player.name,
        iteration: currentIter,
        half: matchDetails.half
      })
    }
    matchDetails.wallPass = null
  }

  // Calcular el punto de encuentro en carrera (al vacío adelante del receptor o hacia su diagonal activa)
  const passDist = common.distance(ballPos, targetPlayer.position)
  let leadX = targetPlayer.position[0]
  let leadY = targetPlayer.position[1]
  if (targetPlayer.offBallRun && targetPlayer.offBallRun.untilIteration > currentIter) {
    leadX = targetPlayer.position[0] + (targetPlayer.offBallRun.targetX - targetPlayer.position[0]) * 0.55
    leadY = targetPlayer.position[1] + (targetPlayer.offBallRun.targetY - targetPlayer.position[1]) * 0.55
  } else {
    const leadDistance = Math.min(72, Math.max(28, passDist * 0.34))
    leadY = targetPlayer.position[1] + (dir * leadDistance)
    if (targetPlayer.position[0] < 165) leadX = Math.max(48, targetPlayer.position[0] - 8)
    else if (targetPlayer.position[0] > pitchWidth - 165) leadX = Math.min(pitchWidth - 48, targetPlayer.position[0] + 8)
  }

  // Asegurar que el pase al vacío no se vaya afuera de la línea de fondo
  leadX = Math.max(28, Math.min(pitchWidth - 28, leadX))
  leadY = Math.max(32, Math.min(pitchHeight - 32, leadY))

  const accuracyFactor = Math.max(0.04, (100 - (player.skill.passing || 65)) / 75)
  const isLongBall = passDist > 250
  const spread = Math.min(isLongBall ? 38 : 22, Math.max(8, passDist * (isLongBall ? 0.11 : 0.07) * accuracyFactor))
  const finalTarget = [
    common.round(leadX + common.getRandomNumber(-spread, spread), 0),
    common.round(leadY + common.getRandomNumber(-spread, spread), 0)
  ]
  const realTargetPlayer = team.players.find(p => p.playerID === targetPlayer.playerID)
  if (realTargetPlayer) {
    realTargetPlayer.intentPOS = [finalTarget[0], finalTarget[1]]
    matchDetails.ball.targetPlayerID = realTargetPlayer.playerID
    matchDetails.ball.targetPOS = [finalTarget[0], finalTarget[1]]

    // Evaluar fuera de juego en el instante del pase (Open Football Snapshot)
    const offsideSnap = evaluateOffsideAtKick(matchDetails, team, opposition, player, realTargetPlayer, ballPos)
    if (offsideSnap && offsideSnap.isOffside) {
      realTargetPlayer.offside = true
      realTargetPlayer.offsideSnapshot = offsideSnap
      matchDetails.pendingOffsideSnapshot = offsideSnap
      matchDetails.lastOffsideSnapshot = offsideSnap
      if (matchDetails.ball) matchDetails.ball.offsideSnapshot = offsideSnap
    } else {
      realTargetPlayer.offside = false
      realTargetPlayer.offsideSnapshot = null
      matchDetails.pendingOffsideSnapshot = null
    }
  }
  if (Array.isArray(matchDetails.events) && passDist > 135) {
    matchDetails.events.push({
      type: 'throughBall',
      teamID: team.teamID,
      teamName: team.name,
      playerName: player.name,
      receiverName: targetPlayer.name,
      iteration: currentIter,
      half: matchDetails.half
    })
  }
  matchDetails.ball.lastTouch.bodyPart = setAttackBodyPart([0, 0, 0], 100)
  const finalDist = common.distance(ballPos, finalTarget)
  return calcBallMovementOverTime(matchDetails, Math.max(power, finalDist * 1.25), finalTarget, player, 'through')
}

function tballScoreOption(p, attackingTop, ballPos, maxDistance, styleCfg) {
  let score = 0
  const d = common.distance(ballPos, p.position)
  const forward = attackingTop ? ballPos[1] - p.position[1] : p.position[1] - ballPos[1]
  // Progreso vertical equilibrado (no monopoilzar con forward * 1.9)
  score += forward * 1.15
  score += Math.min(50, p.minOppDist || 25) * 1.4

  const isOverlapRun = p.offBallRun?.type === 'overlapFlank'
  if (isOverlapRun) {
    // Máxima prioridad al desdoble del lateral/extremo hacia el fondo (open-football FlankPlay)
    score += Math.round(90 * (styleCfg?.throughBoost || 1.35))
  } else if (p.offBallRun) {
    score += Math.round(55 * (styleCfg?.throughBoost || 1.25))
  }

  // Penalizar fuertemente pases forzados al 9 entre los centrales si está marcado o pelotazo ciego
  if (p.role === 'ST') {
    if (d > 250) score -= 45 // Penalizar pelotazos largos al 9 desde lejos
    if (p.isMarked || (p.minOppDist != null && p.minOppDist < 26)) {
      score -= 85
    } else if (!p.isMarked && p.minOppDist > 34) {
      score += 35
    }
  }

  if (p.laneBlocked && d < 210) score -= 85

  // Bonificación por apertura a las bandas
  if (p.position[0] < 170 || p.position[0] > 510) {
    score += styleCfg?.id === 'wingPlay' ? 65 : 42
  }

  if (['LM', 'RM', 'EXT', 'LB', 'RB'].includes(p.role)) {
    score += styleCfg?.id === 'wingPlay' ? 35 : 20
  } else if (['ST', 'CAM', 'EXT'].includes(p.role)) {
    score += 20
  }

  return score
}

function pointToSegmentDist(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2
  if (l2 === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2)
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2
  t = Math.max(0.08, Math.min(0.95, t))
  const projX = x1 + t * (x2 - x1)
  const projY = y1 + t * (y2 - y1)
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2)
}

function getPlayersInDistance(team, player, pitchSize, opposition = null, currentIter = 0) {
  const [pitchWidth, pitchHeight] = pitchSize
  const playersInDistance = []
  const oppPlayers = opposition?.players || []
  for (const teamPlayer of team.players) {
    if (!common.isOnPitch(teamPlayer)) continue
    if (teamPlayer.playerID !== player.playerID) {
      const onPitchX = common.isBetween(teamPlayer.currentPOS[0], -1, pitchWidth + 1)
      const onPitchY = common.isBetween(teamPlayer.currentPOS[1], -1, pitchHeight + 1)
      if (onPitchX && onPitchY) {
        const playerToPlayerX = player.currentPOS[0] - teamPlayer.currentPOS[0]
        const playerToPlayerY = player.currentPOS[1] - teamPlayer.currentPOS[1]
        const proximityToBall = Math.abs(playerToPlayerX) + Math.abs(playerToPlayerY)
        let isMarked = false
        let laneBlocked = false
        let minOppDist = 999
        for (const opp of oppPlayers) {
          if (!common.isOnPitch(opp) || (opp.stunnedTicks || 0) > 0) continue
          const od = common.distance(teamPlayer.currentPOS, opp.currentPOS)
          if (od < minOppDist) minOppDist = od
          if (od < 20) {
            isMarked = true
          }
          const segDist = pointToSegmentDist(
            opp.currentPOS[0], opp.currentPOS[1],
            player.currentPOS[0], player.currentPOS[1],
            teamPlayer.currentPOS[0], teamPlayer.currentPOS[1]
          )
          if (segDist < 13) {
            laneBlocked = true
          }
        }
        const activeRun = (teamPlayer.offBallRun && teamPlayer.offBallRun.untilIteration > currentIter)
          ? teamPlayer.offBallRun
          : null
        playersInDistance.push({
          id: teamPlayer.playerID,
          playerID: teamPlayer.playerID,
          role: teamPlayer.tacticalRole || teamPlayer.position,
          offside: !!teamPlayer.offside,
          isMarked,
          minOppDist,
          laneBlocked,
          offBallRun: activeRun,
          position: teamPlayer.currentPOS,
          proximity: proximityToBall,
          name: teamPlayer.name
        })
      }
    }
  }
  playersInDistance.sort((a, b) => a.proximity - b.proximity)
  return playersInDistance
}

export function resolveBallMovement(player, matchDetails) {
  const { kickOffTeam, secondTeam } = matchDetails
  const ballPos = matchDetails.ball.position
  const ballPow = matchDetails.ball.power || 60
  const ballPath = matchDetails.ball.ballOverIterations
  if (!ballPath || ballPath.length === 0) return matchDetails.ball.position
  const nextPos = ballPath[0]
  matchDetails.ball.ballOverIterations.shift()
  matchDetails.ball.lastTouch.iterations++
  const checkPos = [common.round(nextPos[0], 0), common.round(nextPos[1], 0), nextPos[2] || 0]
  const playerInfo1 = setPositions.closestPlayerToPosition(player, kickOffTeam, checkPos)
  const playerInfo2 = setPositions.closestPlayerToPosition(player, secondTeam, checkPos)
  const Ordered = playerInfo1.proxToBall <= playerInfo2.proxToBall
    ? [{ p: playerInfo1.thePlayer, t: kickOffTeam }, { p: playerInfo2.thePlayer, t: secondTeam }]
    : [{ p: playerInfo2.thePlayer, t: secondTeam }, { p: playerInfo1.thePlayer, t: kickOffTeam }]

  for (const item of Ordered) {
    if (item.p && !matchDetails.endIteration) {
      thisPlayerIsInProximity(matchDetails, item.p, ballPos, nextPos, ballPow, item.t)
    }
  }
  matchDetails.ball.velocity = [nextPos[0] - ballPos[0], nextPos[1] - ballPos[1]]
  matchDetails.ball.position = nextPos
  return [common.round(nextPos[0], 2), common.round(nextPos[1], 2), common.round(nextPos[2] || 0, 2)]
}

export function thisPlayerIsInProximity(matchDetails, thisPlayer, thisPOS, thisPos, power, thisTeam) {
  if (!common.isOnPitch(thisPlayer)) return thisPOS
  const lastTouchPlayer = thisPlayer.playerID === matchDetails.ball.lastTouch.playerID
  const ballRecentlyKicked = matchDetails.ball.lastTouch.iterations < 4
  if (lastTouchPlayer && ballRecentlyKicked) return thisPOS
  const checkPos = [common.round(thisPos[0], 0), common.round(thisPos[1], 0), common.round(thisPos[2] || 0, 0)]
  const isGoalie = thisPlayer.position === 'GK'
  let jumpHeight = 10

  const isTeammateOfKicker = matchDetails.ball.lastTouch.teamID === thisTeam.teamID
  const isTargetReceiver = isTeammateOfKicker && matchDetails.ball.targetPlayerID === thisPlayer.playerID
  const isCross = (matchDetails.ball.isAerialCrossDelivery || matchDetails.ball.kickType === 'cross')
  const proxRadius = isCross ? 18 : (isTargetReceiver ? 18 : (isTeammateOfKicker && matchDetails.ball.isPendingPass ? 14 : 9))

  const xPosProx = common.isBetween(thisPlayer.currentPOS[0], thisPos[0] - proxRadius, thisPos[0] + proxRadius)
  const yPosProx = common.isBetween(thisPlayer.currentPOS[1], thisPos[1] - proxRadius, thisPos[1] + proxRadius)
  const goaliexPosProx = common.isBetween(thisPlayer.currentPOS[0], thisPos[0] - 28, thisPos[0] + 28)
  const goalieyPosProx = common.isBetween(thisPlayer.currentPOS[1], thisPos[1] - 22, thisPos[1] + 22)
  const goaliezPodProx = common.isBetween(thisPOS[2] || 0, -1, (thisPlayer.height + thisPlayer.skill.jumping))

  const playerJump = actions.playerJumps(thisPlayer.skill.perception)
  if (playerJump) jumpHeight = common.getRandomNumber(10, Math.max(11, thisPlayer.skill.jumping))
  const calcHeight = (parseInt(thisPlayer.height, 10) + parseInt(jumpHeight, 10)) / 10
  const maxAerialZ = isCross ? (parseInt(thisPlayer.height, 10) + parseInt(jumpHeight, 10) + 35) / 10 : calcHeight
  const zPosProx = common.isBetween(thisPos[2] || 0, -1, maxAerialZ)

  // 1. Corte y salida del arquero en centros o córners
  if (isGoalie && !isTeammateOfKicker && isCross && !matchDetails.ball.saveChecked) {
    const distToGk = common.distance(thisPlayer.currentPOS, [thisPos[0], thisPos[1]])
    const goalieAerialReach = (thisPlayer.height + (thisPlayer.skill.jumping || 70) + 60) / 10
    if (distToGk < 42 && (thisPos[2] || 0) <= goalieAerialReach) {
      matchDetails.ball.saveChecked = true
      matchDetails.ball.isPendingPass = false
      matchDetails.ball.isAerialCrossDelivery = false
      const saving = Number(thisPlayer.skill.saving) || 70
      if (saving >= common.getRandomNumber(30, 95)) {
        const claimRoll = common.getRandomNumber(1, 100)
        if (claimRoll <= 55) {
          setBallMovementMatchDetails(matchDetails, thisPlayer, thisPos, thisTeam)
          thisPlayer.hasBall = true
          matchDetails.ball.position = [thisPlayer.currentPOS[0], thisPlayer.currentPOS[1], 0]
          matchDetails.iterationLog.push(`Goalkeeper ${thisPlayer.name} claims the cross cleanly in the air!`)
          matchDetails.endIteration = true
          return thisPlayer.currentPOS
        } else {
          matchDetails.iterationLog.push(`Goalkeeper ${thisPlayer.name} punches the cross clear!`)
          return ballKicked(matchDetails, thisTeam, thisPlayer)
        }
      }
    }
  }

  if (isGoalie && goaliexPosProx && goalieyPosProx && goaliezPodProx && !isTeammateOfKicker && !matchDetails.ball.saveChecked) {
    if (common.isBetween(checkPos[2], -1, calcHeight + 4)) {
      matchDetails.ball.saveChecked = true
      const saving = thisPlayer.skill.saving || 70
      const isOneOnOneShot = matchDetails.ball.isOneOnOne || false
      const saveFloor = isOneOnOneShot ? 56 : 40
      const saveCeiling = isOneOnOneShot ? 134 : 122
      if (saving >= common.getRandomNumber(saveFloor, saveCeiling)) {
        return executeGoalkeeperSave(matchDetails, thisPlayer, thisTeam, thisPos)
      }
    }
  } else if (xPosProx && yPosProx && zPosProx) {
    if (matchDetails.ball.lastTouch.playerID !== thisPlayer.playerID) {
      // Si es un disparo al arco (shot/freekick), los compañeros del pateador dejan pasar la pelota hacia el arco
      if (
        (matchDetails.ball.kickType === 'shot' || matchDetails.ball.kickType === 'freekick') &&
        matchDetails.ball.lastTouch.teamID === thisTeam.teamID
      ) {
        return thisPOS
      }
      // Si es un pase de un compañero, pero este jugador NO es el destinatario y el destinatario está más adelante, dejarla pasar
      if (
        isTeammateOfKicker &&
        matchDetails.ball.isPendingPass &&
        matchDetails.ball.targetPlayerID &&
        matchDetails.ball.targetPlayerID !== thisPlayer.playerID &&
        matchDetails.ball.ballOverIterations.length > 2
      ) {
        return thisPOS
      }

      // Duelo Aéreo en Centros y Córners (Defensor rival despejando de cabeza)
      if (!isTeammateOfKicker && isCross && thisPlayer.position !== 'GK') {
        const attackingTeam = (thisTeam.teamID === matchDetails.kickOffTeam.teamID) ? matchDetails.secondTeam : matchDetails.kickOffTeam
        const targetAtt = attackingTeam.players.find(p => p.playerID === matchDetails.ball.targetPlayerID)
        const defJump = (Number(thisPlayer.skill.jumping) || 65) * 0.45 + (Number(thisPlayer.height || 180) - 170) * 0.35 + (Number(thisPlayer.skill.strength) || 65) * 0.20 + 16 + common.getRandomNumber(0, 30)
        const attJump = (Number(targetAtt?.skill?.jumping) || 65) * 0.45 + (Number(targetAtt?.height || 180) - 170) * 0.35 + (Number(targetAtt?.skill?.strength) || 65) * 0.20 + common.getRandomNumber(0, 30)
        if (defJump >= attJump) {
          matchDetails.ball.isAerialCrossDelivery = false
          matchDetails.ball.isPendingPass = false
          matchDetails.iterationLog.push(`Defensive headed clearance by ${thisPlayer.name}!`)
          return ballKicked(matchDetails, thisTeam, thisPlayer)
        }
      }

      // BLOQUEO DEFENSIVO DE REMATES AL ARCO (Open Football try_block_shot):
      // Si la pelota es un tiro al arco en vuelo y este defensor está en el corredor de tiro, interpone el cuerpo
      const isShotInFlight = (matchDetails.ball.kickType === 'shot' || matchDetails.ball.kickType === 'freekick')
      if (!isTeammateOfKicker && isShotInFlight && thisPlayer.position !== 'GK') {
        const blockSkill = (Number(thisPlayer.skill.tackling || 60) * 0.45 + Number(thisPlayer.skill.perception || 60) * 0.35 + Number(thisPlayer.skill.strength || 60) * 0.20)
        if (common.getRandomNumber(1, 100) <= Math.min(85, Math.max(25, blockSkill * 0.75))) {
          if (!thisPlayer.stats.blocks) thisPlayer.stats.blocks = 0
          thisPlayer.stats.blocks++
          matchDetails.iterationLog.push(`¡Remate bloqueado con el cuerpo por: ${thisPlayer.name}!`)
          if (Array.isArray(matchDetails.events)) {
            matchDetails.events.push({
              type: 'shotBlocked',
              teamID: thisTeam.teamID,
              teamName: thisTeam.name,
              playerName: thisPlayer.name,
              iteration: matchDetails.iterationCount || 0,
              half: matchDetails.half
            })
          }
          const deflectPos = thisPlayer.currentPOS
          const newPOS = resolveDeflection(power, thisPOS, deflectPos, thisPlayer, thisTeam, calcHeight, matchDetails)
          return [common.round(newPOS[0], 2), common.round(newPOS[1], 2)]
        } else {
          // El tiro supera al defensor sin ser bloqueado
          return thisPOS
        }
      }

      // Si es un rival intentando cortar un pase en tránsito, chequear capacidad de intercepción
      if (!isTeammateOfKicker && matchDetails.ball.isPendingPass) {
        const interceptSkill = ((thisPlayer.skill.perception || 60) + (thisPlayer.skill.tackling || 60)) / 2
        const passCutThreshold = (thisPlayer.position === 'CB' || thisPlayer.position === 'LB' || thisPlayer.position === 'RB') ? 105 : 122
        if (common.getRandomNumber(0, passCutThreshold) > interceptSkill) {
          return thisPOS
        }
      }
      const deflectPos = thisPlayer.currentPOS
      const newPOS = resolveDeflection(power, thisPOS, deflectPos, thisPlayer, thisTeam, calcHeight, matchDetails)
      return [common.round(newPOS[0], 2), common.round(newPOS[1], 2)]
    }
  }
}

export function resolveDeflection(power, thisPOS, defPosition, defPlayer, defTeam, calcHeight, matchDetails) {
  const xMovement = (thisPOS[0] - defPosition[0]) ** 2
  const yMovement = (thisPOS[1] - defPosition[1]) ** 2
  const movementDistance = Math.sqrt(xMovement + yMovement)
  let newPower = Math.max(0, power - movementDistance)
  let tempPosition = [0, 0, 0]
  const { direction } = matchDetails.ball
  const isTeammatePass = (
    matchDetails.ball.isPendingPass &&
    matchDetails.ball.lastTouch.teamID === defTeam.teamID
  )
  if (!isTeammatePass) {
    matchDetails.pendingOffsideSnapshot = null
  }

  // Si es un pase de un compañero, el receptor intenta controlarla con su atributo Control
  if (isTeammatePass) {
    if (common.getRandomNumber(0, 100) <= Math.max(65, (defPlayer.skill.control || 70) + 12)) {
      setDeflectionPlayerHasBall(thisPOS[2] || 0, matchDetails, defPlayer, defTeam)
      return defPosition
    }
  }

  if (newPower < 180 || checkIfBallControlled(defPlayer)) {
    if (!isTeammatePass && checkForHandball(thisPOS, calcHeight)) {
      matchDetails.ball.isPendingPass = false
      matchDetails.iterationLog.push(`Handball by ${defPlayer.name}`)
      if (defTeam.name === matchDetails.kickOffTeam.name) setPositions.setSetpieceSecondTeam(matchDetails)
      else setPositions.setSetpieceKickOffTeam(matchDetails)
      return defPosition
    }
    if (checkIfBallControlled(defPlayer)) {
      setDeflectionPlayerHasBall(thisPOS[2] || 0, matchDetails, defPlayer, defTeam)
      return defPosition
    }
    newPower = common.round(newPower / 3, 0)
  }
  matchDetails.ball.isPendingPass = false
  const bodyPart = setDeflectBodyPart(thisPOS, calcHeight)
  matchDetails.ball.lastTouch.bodyPart = bodyPart
  matchDetails.ball.lastTouch.deflection = true
  matchDetails.ball.lastTouch.playerID = defPlayer.playerID
  matchDetails.ball.lastTouch.playerName = defPlayer.name
  matchDetails.ball.lastTouch.teamID = defTeam.teamID
  matchDetails.ball.lastTouch.iterations = 0
  matchDetails.iterationLog.push(`ball deflected by ${defPlayer.name} ${bodyPart}`)
  defPlayer.hasBall = false
  matchDetails.ball.Player = ''
  matchDetails.ball.withPlayer = false
  matchDetails.ball.withTeam = ''
  tempPosition = setDeflectionDirectionPos(direction, defPosition, newPower)
  const traj = common.getBallTrajectory(defPosition, tempPosition, Math.max(35, newPower), 'deflection', matchDetails.pitchSize[1])
  matchDetails.ball.ballOverIterations = traj
  matchDetails.ball.position = traj[0] || [defPosition[0], defPosition[1], 0]
  matchDetails.endIteration = true
  return traj[0] || defPosition
}

export function setBallMovementMatchDetails(matchDetails, thisPlayer, thisPos, thisTeam) {
  matchDetails.ball.ballOverIterations = []
  matchDetails.ball.Player = thisPlayer.playerID
  matchDetails.ball.withPlayer = true
  matchDetails.ball.lastTouch.playerName = thisPlayer.name
  matchDetails.ball.lastTouch.playerID = thisPlayer.playerID
  matchDetails.ball.lastTouch.teamID = thisTeam.teamID
  matchDetails.ball.withTeam = thisTeam.teamID
  matchDetails.ball.position = [thisPos[0], thisPos[1], thisPos[2] || 0]
  thisPlayer.currentPOS = [thisPos[0], thisPos[1]]
}

function checkForHandball(thisPOS, calcHeight) {
  if (!calcHeight) return false
  const ratio = (thisPOS[2] || 0) / calcHeight
  if (ratio <= 0.5) return Math.random() < 0.04
  if (ratio <= 0.8) return Math.random() < 0.15
  return Math.random() < 0.08
}

export function setAttackBodyPart(thisPOS, calcHeight, player = null) {
  const hasTrait = (t) => Array.isArray(player?.traits) && player.traits.includes(t)
  const isTargetMan = player && ((player.position === 'ST' || player.tacticalRole === 'ST') || hasTrait('artillero_area') || hasTrait('cabeceador_nato'))
  const headingSkill = Number(player?.skill?.heading ?? player?.skill?.cabeza ?? 70)
  const jumpingSkill = Number(player?.skill?.jumping) || 70
  const agilitySkill = Number(player?.skill?.agility) || 70
  const perceptionSkill = Number(player?.skill?.perception) || 70
  const rawHeight = Number(player?.height) || 175
  const heightMeters = rawHeight / 100

  // Si el jugador viene de recibir un centro aéreo en el área o córner
  if (player?.isHeaderChance) {
    player.isHeaderChance = false
    let headChance = 52
    // Atributo Cabeza
    headChance += (headingSkill - 70) * 0.45
    // Altura (jugadores de 185cm+ cabecean con mucha mayor facilidad)
    headChance += (rawHeight - 175) * 0.45
    // Salto
    headChance += (jumpingSkill - 70) * 0.35
    // Percepción / Anticipación
    headChance += (perceptionSkill - 70) * 0.20
    // Agilidad: jugadores muy ágiles y no tan altos tienen versatilidad para volea acrobática
    if (agilitySkill >= 88 && rawHeight < 178) {
      headChance -= 10
    }
    if (isTargetMan) headChance += 14

    headChance = Math.max(15, Math.min(96, Math.round(headChance)))
    if (common.getRandomNumber(1, 100) <= headChance) {
      return 'head'
    }
    return Math.random() < 0.6 ? 'chest' : 'centre of foot'
  }

  const ballZ = thisPOS[2] || 0
  const playerHeightInPitchUnits = (calcHeight || 20) / 10
  const ratio = ballZ / playerHeightInPitchUnits
  const lowerBody = ['left of foot', 'right of foot', 'centre of foot']

  if (ratio <= 0.45) {
    return lowerBody[common.getRandomNumber(0, lowerBody.length - 1)]
  }
  if (ratio > 0.45 && ratio <= 0.85) {
    let midHeadChance = 35 + (headingSkill - 70) * 0.4 + (jumpingSkill - 70) * 0.3 + (rawHeight - 175) * 0.3
    if (hasTrait('cabeceador_nato')) midHeadChance += 22
    if (common.getRandomNumber(1, 100) <= Math.max(10, Math.min(88, midHeadChance))) {
      return 'head'
    }
    return Math.random() < 0.5 ? 'chest' : lowerBody[common.getRandomNumber(0, lowerBody.length - 1)]
  }

  return 'head'
}

function setDeflectBodyPart(thisPOS, calcHeight) {
  const ratio = (thisPOS[2] || 0) / (calcHeight || 20)
  const lowerBody = ['foot', 'shin', 'knee', 'thigh', 'hip', 'bum']
  const midBody = ['stomach', 'back', 'chest', 'shoulder']
  if (!thisPOS[2] || thisPOS[2] === 0) return 'foot'
  if (ratio <= 0.5) return lowerBody[common.getRandomNumber(0, lowerBody.length - 1)]
  if (ratio <= 0.8) return midBody[common.getRandomNumber(0, midBody.length - 1)]
  return 'head'
}

export function setDeflectionDirectionPos(direction, defPosition, newPower) {
  const tempPosition = [defPosition[0], defPosition[1], 0]
  if (direction === 'east' || direction === 'northeast' || direction === 'southeast') {
    if (direction === 'east') tempPosition[1] = common.getRandomNumber(defPosition[1] - 3, defPosition[1] + 3)
    tempPosition[0] = defPosition[0] - (newPower / 2)
  } else if (direction === 'west' || direction === 'northwest' || direction === 'southwest') {
    if (direction === 'west') tempPosition[1] = common.getRandomNumber(defPosition[1] - 3, defPosition[1] + 3)
    tempPosition[0] = defPosition[0] + (newPower / 2)
  }
  if (direction === 'north' || direction === 'northeast' || direction === 'northwest') {
    if (direction === 'north') tempPosition[0] = common.getRandomNumber(defPosition[0] - 3, defPosition[0] + 3)
    tempPosition[1] = defPosition[1] + (newPower / 2)
  } else if (direction === 'south' || direction === 'southeast' || direction === 'southwest') {
    if (direction === 'south') tempPosition[0] = common.getRandomNumber(defPosition[0] - 3, defPosition[0] + 3)
    tempPosition[1] = defPosition[1] - (newPower / 2)
  }
  if (direction === 'wait') {
    tempPosition[0] = defPosition[0] + common.getRandomNumber(-newPower / 2, newPower / 2)
    tempPosition[1] = defPosition[1] + common.getRandomNumber(-newPower / 2, newPower / 2)
  }
  return tempPosition
}

export function setDeflectionPlayerHasBall(ballHeight, matchDetails, defPlayer, defTeam) {
  const wasCross = matchDetails.ball.kickType === 'cross' && matchDetails.ball.lastTouch.teamID === defTeam.teamID
  // Si el último toque era un pase pendiente de un compañero del mismo equipo, registrar pase completado
  if (
    matchDetails.ball.isPendingPass &&
    matchDetails.ball.lastTouch.teamID === defTeam.teamID &&
    matchDetails.ball.lastTouch.playerID !== defPlayer.playerID
  ) {
    const passer = defTeam.players.find(p => p.playerID === matchDetails.ball.lastTouch.playerID)
    if (passer) {
      passer.stats.passes.on++
      if (wasCross) {
        if (!passer.stats.crosses) passer.stats.crosses = { total: 0, on: 0 }
        passer.stats.crosses.on = (passer.stats.crosses.on || 0) + 1
      }
      matchDetails.ball.lastPasserPlayerID = passer.playerID
    }
    const teamStats = getTeamStatisticsObject(matchDetails, defTeam)
    teamStats.passesCompleted = (teamStats.passesCompleted || 0) + 1
  } else if (matchDetails.ball.lastTouch.teamID !== defTeam.teamID) {
    matchDetails.ball.lastPasserPlayerID = null
  }
  matchDetails.ball.isPendingPass = false

  matchDetails.iterationLog.push(`${defPlayer.name} has the ball`)
  defPlayer.hasBall = true
  matchDetails.ball.lastTouch.playerName = defPlayer.name
  matchDetails.ball.lastTouch.playerID = defPlayer.playerID
  matchDetails.ball.lastTouch.teamID = defTeam.teamID
  matchDetails.ball.lastTouch.deflection = false
  if (defPlayer.offside === true) {
    setDeflectionPlayerOffside(matchDetails, defTeam, defPlayer)
    return matchDetails.ball.position
  }
  matchDetails.ball.ballOverIterations = []
  matchDetails.ball.Player = defPlayer.playerID
  matchDetails.ball.withPlayer = true
  matchDetails.ball.withTeam = defTeam.teamID
  matchDetails.ball.position = [defPlayer.currentPOS[0], defPlayer.currentPOS[1], ballHeight]

  // Si recibe un centro dentro del área rival, intenta definir de primera (cabezazo o volea)
  if ((wasCross || matchDetails.ball.isAerialCrossDelivery) && defPlayer.position !== 'GK') {
    const [pitchWidth, pitchHeight] = matchDetails.pitchSize
    const attackingTop = defPlayer.originPOS[1] > (pitchHeight / 2)
    const distToGoalY = attackingTop ? defPlayer.currentPOS[1] : (pitchHeight - defPlayer.currentPOS[1])
    if (distToGoalY < 165 && defPlayer.currentPOS[0] > 175 && defPlayer.currentPOS[0] < (pitchWidth - 175)) {
      defPlayer.action = 'shoot'
      defPlayer.isHeaderChance = true
    }
  }
  matchDetails.endIteration = true
}

export function setDeflectionPlayerOffside(matchDetails, defTeam, defPlayer) {
  const offsideVarData = defPlayer.offsideSnapshot ||
    matchDetails.lastOffsideSnapshot ||
    matchDetails.pendingOffsideSnapshot ||
    matchDetails.ball?.offsideSnapshot ||
    null
  defPlayer.offside = false
  defPlayer.offsideSnapshot = null
  defPlayer.hasBall = false
  matchDetails.ball.Player = ''
  matchDetails.ball.withPlayer = false
  matchDetails.ball.withTeam = ''
  matchDetails.iterationLog.push(`${defPlayer.name} is offside. Set piece given`)
  if (Array.isArray(matchDetails.events)) {
    matchDetails.events.push({
      type: 'offside',
      teamID: defTeam.teamID,
      teamName: defTeam.name,
      playerName: defPlayer.name,
      passerName: offsideVarData?.passerName || 'Compañero',
      iteration: matchDetails.iterationCount || 0,
      half: matchDetails.half,
      deadBall: true,
      varData: offsideVarData
    })
  }
  matchDetails.pendingOffsideSnapshot = null
  matchDetails.lastOffsideSnapshot = null
  if (matchDetails.ball) matchDetails.ball.offsideSnapshot = null
  if (defTeam.name === matchDetails.kickOffTeam.name) matchDetails = setPositions.setSetpieceSecondTeam(matchDetails)
  else matchDetails = setPositions.setSetpieceKickOffTeam(matchDetails)
}

export function getBallDirection(matchDetails, nextPOS) {
  const thisPOS = matchDetails.ball.position
  const movementX = thisPOS[0] - nextPOS[0]
  const movementY = thisPOS[1] - nextPOS[1]
  if (movementX === 0) {
    if (movementY === 0) matchDetails.ball.direction = 'wait'
    else if (movementY < 0) matchDetails.ball.direction = 'south'
    else if (movementY > 0) matchDetails.ball.direction = 'north'
  } else if (movementY === 0) {
    if (movementX < 0) matchDetails.ball.direction = 'east'
    else if (movementX > 0) matchDetails.ball.direction = 'west'
  } else if (movementX < 0 && movementY < 0) matchDetails.ball.direction = 'southeast'
  else if (movementX > 0 && movementY > 0) matchDetails.ball.direction = 'northwest'
  else if (movementX > 0 && movementY < 0) matchDetails.ball.direction = 'southwest'
  else if (movementX < 0 && movementY > 0) matchDetails.ball.direction = 'northeast'
}

export function ballPassed(matchDetails, team, player) {
  const { pitchSize } = matchDetails
  const [pitchWidth, pitchHeight] = pitchSize
  const ballPos = matchDetails.ball.position

  matchDetails.ball.lastTouch.playerName = player.name
  matchDetails.ball.lastTouch.playerID = player.playerID
  matchDetails.ball.lastTouch.teamID = team.teamID
  matchDetails.ball.lastTouch.iterations = 0
  matchDetails.iterationLog.push(`ball passed by: ${player.name}`)
  player.stats.passes.total++
  const teamStats = getTeamStatisticsObject(matchDetails, team)
  teamStats.passesTotal = (teamStats.passesTotal || 0) + 1

  const power = common.calculatePower(player.skill.strength, pitchHeight)
  const maxDist = power * 1.25
  const opposition = (team.teamID === matchDetails.kickOffTeam.teamID) ? matchDetails.secondTeam : matchDetails.kickOffTeam
  const currentIter = matchDetails.iterationCount || 0
  const styleCfg = getPlayStyleConfig(team?.playStyle, team?.formation)

  const teammates = getPlayersInDistance(team, player, pitchSize, opposition, currentIter)
  if (!teammates || teammates.length === 0) return matchDetails

  let reachable = teammates.filter(p => {
    if (p.offside) return false
    const d = common.distance(ballPos, p.position)
    return d >= 12 && d <= maxDist
  })

  // En el saque de mitad de cancha, priorizar el pase de apertura al compañero al lado en el círculo central
  if (player.isKickoffPass) {
    player.isKickoffPass = false
    const closeTeammate = teammates.find(p => common.distance(ballPos, p.position) < 45)
    if (closeTeammate) {
      reachable = [closeTeammate]
    }
  }

  if (reachable.length === 0) {
    reachable = teammates.filter(p => !p.offside)
    if (reachable.length === 0) reachable = teammates
  }

  const aTop = player.originPOS[1] > (pitchHeight / 2)
  const dir = aTop ? -1 : 1
  reachable.sort((a, b) => passScoreOption(b, aTop, ballPos, maxDist, styleCfg, pitchWidth, player, matchDetails) - passScoreOption(a, aTop, ballPos, maxDist, styleCfg, pitchWidth, player, matchDetails))
  const targetPlayer = reachable[0]
  matchDetails.iterationLog.push(`Target selected: ${targetPlayer.name}`)

  const passDist = common.distance(ballPos, targetPlayer.position)
  const horizontalSpan = Math.abs(targetPlayer.position[0] - ballPos[0])
  const forwardDelta = aTop ? ballPos[1] - targetPlayer.position[1] : targetPlayer.position[1] - ballPos[1]
  const isFromWingToWing = (ballPos[0] < 220 && targetPlayer.position[0] > (pitchWidth - 220)) ||
                           (ballPos[0] > (pitchWidth - 220) && targetPlayer.position[0] < 220)
  const isSwitchOfPlay = !matchDetails.isThrowIn && player.position !== 'GK' && horizontalSpan >= 230 && isFromWingToWing

  // Gestión de Pared ("One-Two Wall Pass")
  if (
    matchDetails.wallPass &&
    matchDetails.wallPass.wallPartnerID === player.playerID &&
    currentIter <= matchDetails.wallPass.expireIter
  ) {
    const origPasserName = matchDetails.wallPass.passerName
    matchDetails.iterationLog.push(`One-two wall pass by: ${origPasserName} with ${player.name}`)
    if (Array.isArray(matchDetails.events)) {
      matchDetails.events.push({
        type: 'oneTwoPass',
        teamID: team.teamID,
        teamName: team.name,
        playerName: origPasserName,
        receiverName: player.name,
        iteration: currentIter,
        half: matchDetails.half
      })
    }
    matchDetails.wallPass = null
  } else if (
    !isSwitchOfPlay &&
    passDist >= 40 &&
    passDist <= 165 &&
    forwardDelta >= 15 &&
    !targetPlayer.isMarked &&
    ['CAM', 'ST', 'LM', 'RM', 'CM', 'LB', 'RB', 'LWB', 'RWB'].includes(player.tacticalRole || player.position)
  ) {
    matchDetails.wallPass = {
      passerID: player.playerID,
      passerName: player.name,
      wallPartnerID: targetPlayer.playerID,
      wallPartnerName: targetPlayer.name,
      startIter: currentIter,
      expireIter: currentIter + 22
    }
    player.offBallRun = {
      type: 'wallReturnRun',
      targetX: Math.max(30, Math.min(pitchWidth - 30, targetPlayer.position[0] + (targetPlayer.position[0] >= player.currentPOS[0] ? 35 : -35))),
      targetY: Math.max(30, Math.min(pitchHeight - 30, targetPlayer.position[1] + (dir * 75))),
      untilIteration: currentIter + 22
    }
    player.intentPOS = [player.offBallRun.targetX, player.offBallRun.targetY]
  }

  // Si el compañero está picando al espacio o es un cambio de frente a la banda, adelantar el pase a su carrera
  let aimX = targetPlayer.position[0]
  let aimY = targetPlayer.position[1]
  if (targetPlayer.offBallRun && targetPlayer.offBallRun.untilIteration > currentIter) {
    aimX += (targetPlayer.offBallRun.targetX - targetPlayer.position[0]) * 0.42
    aimY += (targetPlayer.offBallRun.targetY - targetPlayer.position[1]) * 0.42
  } else if (isSwitchOfPlay) {
    aimY = Math.max(35, Math.min(pitchHeight - 35, aimY + dir * 24))
  }

  const accuracyFactor = Math.max(0.02, (100 - player.skill.passing) / 100)
  const spread = Math.min(9, passDist * 0.065 * accuracyFactor)

  const targetX = Math.max(42, Math.min(pitchWidth - 42, aimX + common.getRandomNumber(-spread, spread)))
  const targetY = Math.max(30, Math.min(pitchHeight - 30, aimY + common.getRandomNumber(-spread, spread)))
  const finalTarget = [common.round(targetX, 0), common.round(targetY, 0)]
  const realTargetPlayer = team.players.find(p => p.playerID === targetPlayer.playerID)
  if (realTargetPlayer) {
    realTargetPlayer.intentPOS = [finalTarget[0], finalTarget[1]]
    matchDetails.ball.targetPlayerID = realTargetPlayer.playerID
    matchDetails.ball.targetPOS = [finalTarget[0], finalTarget[1]]

    // Evaluar fuera de juego en el instante del pase (Open Football Snapshot)
    const offsideSnap = evaluateOffsideAtKick(matchDetails, team, opposition, player, realTargetPlayer, ballPos)
    if (offsideSnap && offsideSnap.isOffside) {
      realTargetPlayer.offside = true
      realTargetPlayer.offsideSnapshot = offsideSnap
      matchDetails.pendingOffsideSnapshot = offsideSnap
      matchDetails.lastOffsideSnapshot = offsideSnap
      if (matchDetails.ball) matchDetails.ball.offsideSnapshot = offsideSnap
    } else {
      realTargetPlayer.offside = false
      realTargetPlayer.offsideSnapshot = null
      matchDetails.pendingOffsideSnapshot = null
    }
  }

  if (isSwitchOfPlay && Array.isArray(matchDetails.events)) {
    matchDetails.events.push({
      type: 'switchOfPlay',
      teamID: team.teamID,
      teamName: team.name,
      playerName: player.name,
      receiverName: targetPlayer.name,
      iteration: currentIter,
      half: matchDetails.half
    })
  } else if (player.position === 'GK' && passDist > 160 && Array.isArray(matchDetails.events)) {
    matchDetails.events.push({
      type: 'gkLongPass',
      teamID: team.teamID,
      teamName: team.name,
      playerName: player.name,
      receiverName: targetPlayer.name,
      iteration: currentIter,
      half: matchDetails.half
    })
    matchDetails.iterationLog.push(`Goalkeeper long clearance by: ${player.name}`)
  }

  const calcHeight = parseInt(player.height, 10) + parseInt((player.skill.jumping || 0), 10)
  const bodyPart = setAttackBodyPart(matchDetails.ball.position, calcHeight)
  matchDetails.ball.lastTouch.bodyPart = bodyPart
  const kickType = isSwitchOfPlay ? 'switch' : 'pass'
  const isSprintingPass = !!(player.isSprinting || (player.sprintMomentum || 0) > 0.35)
  const isLanzadorPass = Array.isArray(player.traits) && player.traits.includes('lanzador_canonero')
  let kickPow = isSwitchOfPlay
    ? Math.max(power, passDist * 1.35)
    : Math.min(power * 1.25, Math.max(160, passDist * 1.35))
  if (isSprintingPass || isLanzadorPass) {
    kickPow *= 1.18 // El pase sale más tenso y rápido
  }
  player.isKickoffPass = false
  if (matchDetails.isThrowIn) {
    delete matchDetails.isThrowIn
    delete matchDetails.throwInTakerID
    delete matchDetails.throwInShortMateIDs
  }
  return calcBallMovementOverTime(matchDetails, kickPow, finalTarget, player, kickType)
}

export function passScoreOption(p, aTop, ballPos, maxDistance, styleCfg, pitchWidth = 680, passer = null, matchDetails = null) {
  let score = 0
  const d = common.distance(ballPos, p.position)
  const forward = aTop ? ballPos[1] - p.position[1] : p.position[1] - ballPos[1]

  // En el saque del medio (Kickoff), pase atrás limpio y obligatorio a un mediocampista en campo propio
  if (passer?.isKickoffPass) {
    if (forward < -15 && forward > -280 && p.role !== 'GK') {
      return 600 + (['CM', 'CDM'].includes(p.role) ? 100 : 0) - (p.isMarked ? 150 : 0)
    }
    return -999
  }

  // En fase de Retención y Gestación tras Saque del Medio (Kickoff Retention & Build-Up):
  // El receptor busca circular y armar juego con defensores, laterales o pivote en campo propio.
  // Prohibido rifar balones adelantados a más de 15px hacia campo rival.
  if ((matchDetails?.kickoffRetentionTicks || 0) > 0) {
    if (forward > 15) return -999 // Prohibido rifar el balón al campo contrario
    if (d > 340) return -999 // Permitir pases de seguridad hasta 340px a los centrales (CB), laterales y arquero
    if (['CB', 'LB', 'RB', 'CM', 'CDM', 'GK'].includes(p.role) && !p.isMarked && !p.laneBlocked) {
      const isBackline = ['CB', 'LB', 'RB', 'GK'].includes(p.role)
      return 600 + (isBackline ? 80 : 0) + Math.min(100, (p.minOppDist || 20) * 3) - d * 0.12
    }
    return 120 - d * 0.3
  }

  // Evaluación dedicada para SAQUE LATERAL (Throw-in):
  // Selección inteligente y limpia del receptor sin rifar balones lejanos ni forzados
  if (matchDetails?.isThrowIn) {
    if (d > 195) return -999 // Prohibido rifar balones a más de 20 metros en saque lateral
    if (p.isMarked && (p.minOppDist != null && p.minOppDist < 16)) score -= 220
    if (p.laneBlocked) score -= 180

    const isAssignedShort = matchDetails?.throwInShortMateIDs?.includes(p.playerID)
    if (isAssignedShort) score += 220
    if (d >= 25 && d <= 125 && !p.isMarked) score += 115
    if (forward >= 0) score += Math.min(65, forward * 1.1)
    else score += 35 // Apoyo seguro hacia atrás
    return score
  }

  const horizontalSpan = Math.abs(p.position[0] - ballPos[0])
  const isWideTarget = p.position[0] < 185 || p.position[0] > (pitchWidth - 185)
  const isSwitchCandidate = horizontalSpan >= 230 && isWideTarget && !p.isMarked && forward > -45
  const isLanzador = Array.isArray(passer?.traits) && passer.traits.includes('lanzador_canonero')

  // 1. Ganancia vertical calibrada (no aplasta las opciones laterales ni la pausa asociativa)
  if (forward >= 0) {
    score += Math.min(75, forward * 0.75)
  } else {
    // Pase atrás (pausa / reciclaje inteligente): si el compañero está desmarcado, premiar retención
    if (p.minOppDist > 25) {
      score += 45 + (styleCfg?.id === 'tikiTaka' ? 20 : 0)
    } else {
      score += forward * 0.6 - 15
    }
  }

  // 2. Visión lateral y cambio de lado corto: pase a un compañero libre en la misma franja
  if (Math.abs(forward) < 45 && horizontalSpan >= 55) {
    if (!p.isMarked) score += 55
  }

  // 2.5 Salida limpia y segura desde el fondo: circulación entre defensores, laterales y arquero
  const passerRole = passer?.tacticalRole || passer?.position
  if (p.role === 'GK') {
    if (['CB', 'LB', 'RB', 'CM', 'CDM'].includes(passerRole) && p.minOppDist > 28 && !p.laneBlocked) {
      score += 65
    } else {
      score -= 100
    }
  } else if (['CB', 'LB', 'RB'].includes(passerRole) && ['CB', 'LB', 'RB', 'CM', 'CDM'].includes(p.role) && !p.isMarked && !p.laneBlocked) {
    score += 48
  }

  // 3. Espacio libre del receptor (no pasarle a un compañero marcado si hay otro libre)
  score += Math.min(55, p.minOppDist || 20) * 1.45
  if (!p.isMarked) score += 50
  else score -= 45

  // 4. Cambio de frente calibrado a la banda opuesta libre (recurso puntual, no abuso sistemático)
  if (isSwitchCandidate) {
    const consecutiveSwitches = matchDetails?.ball?.consecutiveSwitches || 0
    let switchPenalty = 0
    if (consecutiveSwitches === 1) switchPenalty = 130
    else if (consecutiveSwitches >= 2) switchPenalty = 460
    score += (isLanzador ? 48 : 28) * (styleCfg?.switchBoost || 0.95) - switchPenalty
    if (p.laneBlocked) score -= 260
  } else {
    if (p.laneBlocked) score -= 260
    // Preferir distancias naturales de asociación (65px a 240px) cuando no es cambio de frente
    if (d < 34) score -= 22
    else if (d > 290) score -= (d - 290) * 0.35
  }

  // 4.5 Efecto "Bait": Si el equipo abre la cancha por la banda y arrastra marcas,
  // el pase interior/filtrado hacia el carril central libre recibe un empuje táctico
  const inCentralLane = Math.abs(p.position[0] - pitchWidth / 2) < 140
  if (inCentralLane && forward > 15 && !p.isMarked && !p.laneBlocked) {
    score += Math.round(48 * (styleCfg?.throughBoost || 1.35))
  }

  // 5. Compañero tirando un desmarque activo (diagonal, subida por banda o mostrándose entre líneas)
  if (p.offBallRun?.type === 'overlapFlank') {
    score += Math.round(85 * (styleCfg?.throughBoost || 1.3))
  } else if (p.offBallRun?.type === 'diagonalCutInside') {
    score += Math.round(78 * (styleCfg?.throughBoost || 1.25))
  } else if (p.offBallRun) {
    score += 62 * (styleCfg?.throughBoost || 1.25)
  }

  // 6. Enganche / Conductor de juego libre: el equipo busca naturalmente a su organizador (Riquelme, etc.)
  if ((p.role === 'CAM' || (Array.isArray(p.traits) && p.traits.includes('organizador_mediocampo'))) && !p.isMarked) {
    score += 50
  }

  // 7. Bonificación según rol y Estilo de Juego
  if (isWideTarget) {
    score += (styleCfg?.id === 'wingPlay' ? 48 : 28)
  }
  if (p.role === 'CAM' && styleCfg?.id === 'tikiTaka') {
    score += 36
  } else if (['LM', 'RM', 'EXT', 'LB', 'RB', 'LWB', 'RWB'].includes(p.role)) {
    const isAttackingFullback = ['LB', 'RB', 'LWB', 'RWB'].includes(p.role) && forward > 15
    score += isAttackingFullback ? 38 : 20
  } else if (['CAM', 'ST', 'EXT'].includes(p.role)) {
    score += 16
  }
  return score
}

export function ballCrossed(matchDetails, team, player) {
  const { pitchSize } = matchDetails
  const [pitchWidth, pitchHeight] = pitchSize
  const ballPos = matchDetails.ball.position

  matchDetails.ball.lastTouch.playerName = player.name
  matchDetails.ball.lastTouch.playerID = player.playerID
  matchDetails.ball.lastTouch.teamID = team.teamID
  matchDetails.ball.lastTouch.iterations = 0

  matchDetails.iterationLog.push(`ball crossed by: ${player.name}`)
  player.stats.passes.total++
  if (!player.stats.crosses) player.stats.crosses = { total: 0, on: 0 }
  player.stats.crosses.total++
  const teamStats = getTeamStatisticsObject(matchDetails, team)
  teamStats.passesTotal = (teamStats.passesTotal || 0) + 1

  const power = common.calculatePower(player.skill.strength, pitchHeight)
  const aTop = player.originPOS[1] > (pitchHeight / 2)
  const dir = aTop ? -1 : 1
  const opposition = (team.teamID === matchDetails.kickOffTeam.teamID) ? matchDetails.secondTeam : matchDetails.kickOffTeam
  const currentIter = matchDetails.iterationCount || 0

  // Gestión de Pared ("One-Two Wall Pass"): el socio devuelve en profundidad
  if (
    matchDetails.wallPass &&
    matchDetails.wallPass.wallPartnerID === player.playerID &&
    currentIter <= matchDetails.wallPass.expireIter
  ) {
    const origPasserName = matchDetails.wallPass.passerName
    matchDetails.iterationLog.push(`One-two wall pass by: ${origPasserName} with ${player.name}`)
    if (Array.isArray(matchDetails.events)) {
      matchDetails.events.push({
        type: 'oneTwoPass',
        teamID: team.teamID,
        teamName: team.name,
        playerName: origPasserName,
        receiverName: player.name,
        iteration: currentIter,
        half: matchDetails.half
      })
    }
    matchDetails.wallPass = null
  }
  const teammates = getPlayersInDistance(team, player, pitchSize, opposition, currentIter)

  // Buscar compañeros que estén pisando o cargando el área rival para tirarles el centro a la cabeza/pie
  const hasTrait = (p, t) => Array.isArray(p.traits) && p.traits.includes(t)
  const isHeaderSpecialist = (p) => (['ST', 'EXT'].includes(p.role) || ['ST', 'EXT'].includes(p.position)) ||
    hasTrait(p, 'artillero_area') ||
    hasTrait(p, 'cabeceador_nato') ||
    ((Number(p.skill?.jumping) || 70) >= 80)

  const boxAttackers = teammates.filter(p => {
    if (p.offside || p.role === 'GK') return false
    const distToGoalY = aTop ? p.position[1] : (pitchHeight - p.position[1])
    return distToGoalY < 225 && p.position[0] >= 175 && p.position[0] <= (pitchWidth - 175)
  })

  let targetX
  let targetY
  let selectedAttacker = null

  if (boxAttackers.length > 0) {
    boxAttackers.sort((a, b) => {
      const distA = aTop ? a.position[1] : (pitchHeight - a.position[1])
      const distB = aTop ? b.position[1] : (pitchHeight - b.position[1])
      const slotBonusA = a.offBallRun?.type === 'boxSlotEntry' ? 65 : (a.offBallRun?.type === 'boxCrash' ? 45 : 0)
      const slotBonusB = b.offBallRun?.type === 'boxSlotEntry' ? 65 : (b.offBallRun?.type === 'boxCrash' ? 45 : 0)
      const targetBonusA = isHeaderSpecialist(a) ? 60 : 0
      const targetBonusB = isHeaderSpecialist(b) ? 60 : 0
      const scoreA = (220 - distA) + Math.min(45, a.minOppDist || 20) * 1.5 + slotBonusA + targetBonusA
      const scoreB = (220 - distB) + Math.min(45, b.minOppDist || 20) * 1.5 + slotBonusB + targetBonusB
      return scoreB - scoreA
    })
    selectedAttacker = boxAttackers[0]
    targetX = selectedAttacker.offBallRun?.targetX || selectedAttacker.position[0]
    const rawTargetY = selectedAttacker.offBallRun?.targetY || (selectedAttacker.position[1] + dir * 14)
    targetY = aTop
      ? Math.max(45, Math.min(155, rawTargetY))
      : Math.min(pitchHeight - 45, Math.max(pitchHeight - 155, rawTargetY))
  } else {
    // Punto penal / corazón del área si nadie llegó todavía
    targetX = common.getRandomNumber(275, 405)
    targetY = aTop
      ? common.getRandomNumber(65, 125)
      : common.getRandomNumber(pitchHeight - 125, pitchHeight - 65)
  }

  // Asegurar que el punto de impacto caiga siempre estrictamente dentro de la caja penal
  targetX = Math.max(210, Math.min(pitchWidth - 210, targetX))

  const isCorner = matchDetails.ball.isCornerKick || false
  const crossingSkill = player.skill.passing || 70
  const accuracyFactor = Math.max(0.04, (100 - crossingSkill) / 75)
  const crossDist = common.distance(ballPos, [targetX, targetY])
  const baseSpread = isCorner ? crossDist * 0.12 : crossDist * 0.08
  const maxSpread = isCorner ? 36 : 24
  const spread = Math.min(maxSpread, Math.max(8, baseSpread * accuracyFactor))
  const finalTarget = [
    common.round(Math.max(200, Math.min(pitchWidth - 200, targetX + common.getRandomNumber(-spread, spread))), 0),
    common.round(aTop
      ? Math.max(40, Math.min(155, targetY + common.getRandomNumber(-spread, spread)))
      : Math.min(pitchHeight - 40, Math.max(pitchHeight - 155, targetY + common.getRandomNumber(-spread, spread))), 0)
  ]

  if (selectedAttacker) {
    const realTargetPlayer = team.players.find(p => p.playerID === selectedAttacker.playerID)
    if (realTargetPlayer) {
      realTargetPlayer.intentPOS = [finalTarget[0], finalTarget[1]]
      matchDetails.ball.targetPlayerID = realTargetPlayer.playerID
      matchDetails.ball.targetPOS = [finalTarget[0], finalTarget[1]]

      const offsideSnap = evaluateOffsideAtKick(matchDetails, team, opposition, player, realTargetPlayer, ballPos)
      if (offsideSnap && offsideSnap.isOffside) {
        realTargetPlayer.offside = true
        realTargetPlayer.offsideSnapshot = offsideSnap
        matchDetails.pendingOffsideSnapshot = offsideSnap
        matchDetails.lastOffsideSnapshot = offsideSnap
        if (matchDetails.ball) matchDetails.ball.offsideSnapshot = offsideSnap
      } else {
        realTargetPlayer.offside = false
        realTargetPlayer.offsideSnapshot = null
        matchDetails.pendingOffsideSnapshot = null
      }
    }
  }

  if (Array.isArray(matchDetails.events)) {
    matchDetails.events.push({
      type: 'cross',
      teamID: team.teamID,
      teamName: team.name,
      playerName: player.name,
      receiverName: selectedAttacker?.name || '',
      iteration: currentIter,
      half: matchDetails.half
    })
  }

  const bodyPart = setAttackBodyPart([0, 0, 0], 100, player)
  matchDetails.ball.lastTouch.bodyPart = bodyPart
  matchDetails.ball.isAerialCrossDelivery = true
  return calcBallMovementOverTime(matchDetails, Math.max(power * 1.15, crossDist * 1.25), finalTarget, player, 'cross')
}

export function calcBallMovementOverTime(matchDetails, power, nextPosition, player, type) {
  // Limpiar estados de offside y snapshots de jugadas previas para evitar falsos offsides residuales
  for (const p of [...(matchDetails.kickOffTeam?.players || []), ...(matchDetails.secondTeam?.players || [])]) {
    p.offside = false
    p.offsideSnapshot = null
  }

  const { pitchSize } = matchDetails
  const pitchHeight = pitchSize[1]
  const thisPOS = matchDetails.ball.position
  const trajectory = common.getBallTrajectory(thisPOS, nextPosition, power, type, pitchHeight)
  matchDetails.ball.ballOverIterations = trajectory
  matchDetails.ball.power = power
  matchDetails.ball.kickType = type
  matchDetails.ball.saveChecked = false

  // Gestión de cambios de frente acumulativos (open-football Cooldown Model)
  if (type === 'switch') {
    matchDetails.ball.consecutiveSwitches = (matchDetails.ball.consecutiveSwitches || 0) + 1
    matchDetails.ball.lastSwitchIter = matchDetails.iterationCount || 0
  } else {
    // Si la pelota se juega en vertical, centro, tiro o despeje, se resetea el contador
    matchDetails.ball.consecutiveSwitches = 0
  }

  if (type === 'cross') {
    matchDetails.ball.isAerialCrossDelivery = true
  } else {
    matchDetails.ball.isAerialCrossDelivery = false
  }
  matchDetails.ball.isRestart = false
  matchDetails.ball.isGoalKick = false
  matchDetails.ball.isThrowIn = false
  matchDetails.ball.isCornerKick = false
  delete matchDetails.isThrowIn
  delete matchDetails.throwInTakerID
  matchDetails.ball.isPendingPass = (type === 'pass' || type === 'through' || type === 'cross' || type === 'switch')
  matchDetails.iterationLog.push('creating new ball movement')
  common.removeBallFromAllPlayers(matchDetails)
  matchDetails.endIteration = true
  return resolveBallMovement(player, matchDetails)
}

function checkIfBallControlled(player) {
  return common.isBetween(common.getRandomNumber(0, 100), 0, player.skill.control)
}
