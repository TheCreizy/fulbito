# `playerMovement.js` - Movimiento y Desplazamiento de Jugadores

> **Categoría:** `Física y Cinemática`  
> **Ubicación original:** `src/engine/playerMovement.js`  
> **Líneas de código:** 1184  
> **Tamaño:** 54.92 KB

---

## 📋 Resumen del Módulo

Gestiona la velocidad, aceleración, desaceleración, fatiga acumulada en cada tick, marcación personal o zonal, y desplazamiento hacia las posiciones tácticas dinámicas.

---

## 🧩 Exportaciones y Elementos Principales

- **Línea 8:** `export function decideMovement(closestPlayer, team, opp, matchDetails)`
- **Línea 320:** `export function movePlayers(moves, team, opp, matchDetails)`
- **Línea 398:** `export function executeBallAction(move, team, opp, matchDetails)`
- **Línea 411:** `export function setClosePlayerTakesBall(matchDetails, thisPlayer, team, opp)`
- **Línea 516:** `export function completeSlide(matchDetails, thisPlayer, team, opp)`
- **Línea 538:** `export function completeTackleWhenCloseNoBall(matchDetails, thisPlayer, team, opp)`
- **Línea 582:** `export function closestPlayerActionBallX(ballToPlayerX)`
- **Línea 590:** `export function closestPlayerActionBallY(ballToPlayerY)`
- **Línea 598:** `export function checkProvidedAction(matchDetails, thisPlayer, action, team)`
- **Línea 653:** `export function handleBallPlayerActions(matchDetails, thisPlayer, team, opp, action)`
- **Línea 686:** `export function ballMoved(matchDetails, thisPlayer, team, opp)`
- **Línea 702:** `export function updateInformation(matchDetails, newPosition)`
- **Línea 707:** `export function getMovement(player, action, opposition, ballX, ballY, matchDetails, team)`
- **Línea 852:** `export function getRunMovement(matchDetails, player, ballX, ballY, team, opposition)`
- **Línea 897:** `export function getSprintMovement(matchDetails, player, ballX, ballY, team, opposition)`
- **Línea 972:** `export function closestPlayerToBall(closestPlayer, team, matchDetails)`
- **Línea 997:** `export function checkOffside(team1, team2, matchDetails)`
- **Línea 1029:** `export function team1atBottom(team1, team2, pitchHeight)`
- **Línea 1056:** `export function team1atTop(team1, team2, pitchHeight)`
- **Línea 1115:** `export function resolveMutualPlayerSeparation(matchDetails)`

### Funciones Internas Notables

| Función | Parámetros | Línea |
| :--- | :--- | :--- |
| `tryCarrierGambeta` | `matchDetails, carrier, team, opp, move` | L231 |
| `sendPlayerOff` | `matchDetails, team, thisPlayer, reason = 'red'` | L476 |
| `giveYellowCard` | `matchDetails, team, thisPlayer` | L497 |
| `completeMovement` | `matchDetails, currentPOS, move, player = null` | L560 |
| `getTackleMovement` | `ballX, ballY` | L729 |
| `getSmartDribbleMove` | `matchDetails, player, step, opposition, team` | L744 |
| `getTopMostPlayer` | `team, pitchHeight` | L1003 |
| `getBottomMostPlayer` | `team` | L1016 |
| `offsideYPOS` | `team, side, pitchHeight` | L1083 |

---

## 💻 Código Fuente Completo (`playerMovement.js`)

````javascript
import * as common from './common.js'
import * as ballMovement from './ballMovement.js'
import * as setPositions from './setPositions.js'
import * as actions from './actions.js'
import { isCaptainOnPitch, updatePlayerEffectiveSkills } from './modifiers.js'
import { calculateInterceptMovement, steerTowardsTarget } from './steering.js'

export function decideMovement(closestPlayer, team, opp, matchDetails) {
  const { position, withPlayer, withTeam } = matchDetails.ball
  const teamActions = []
  for (const thisPlayer of team.players) {
    if (common.isOnPitch(thisPlayer)) {
      if ((thisPlayer.stunnedTicks || 0) > 0) {
        thisPlayer.stunnedTicks--
        teamActions.push({ player: thisPlayer, action: 'wait', move: [0, 0] })
        continue
      }
      if ((thisPlayer.gambetaCooldown || 0) > 0) {
        thisPlayer.gambetaCooldown--
      }

      let ballToPlayerX = thisPlayer.currentPOS[0] - position[0]
      let ballToPlayerY = thisPlayer.currentPOS[1] - position[1]
      const possibleActions = actions.findPossActions(thisPlayer, team, opp, ballToPlayerX, ballToPlayerY, matchDetails)
      const lastTouchPlayer = thisPlayer.playerID === matchDetails.ball.lastTouch.playerID
      const ballRecentlyKicked = matchDetails.ball.lastTouch.iterations < 3
      const ballMoving = matchDetails.ball.ballOverIterations.length > 0
      let action
      if (lastTouchPlayer && ballRecentlyKicked && ballMoving) action = 'wait'
      else {
        action = actions.selectAction(possibleActions)
        action = checkProvidedAction(matchDetails, thisPlayer, action, team)
      }

      // Gestión inteligente de conducción: solo forzar descarga si está rodeado por >= 2 rivales
      // o si lleva > 22 ticks y ya no tiene espacio libre adelante.
      if (thisPlayer.hasBall && matchDetails.ball.Player === thisPlayer.playerID) {
        if (matchDetails.ball.lastCarrierID === thisPlayer.playerID) {
          matchDetails.ball.carrierTicks = (matchDetails.ball.carrierTicks || 0) + 1
        } else {
          matchDetails.ball.lastCarrierID = thisPlayer.playerID
          matchDetails.ball.carrierTicks = 1
        }
        const activeOpps = opp.players.filter(
          op => common.isOnPitch(op) && (op.stunnedTicks || 0) <= 0
        )
        const nearbyOpps = activeOpps.filter(
          op => common.distance(thisPlayer.currentPOS, op.currentPOS) < 20
        ).length
        const minOppDist = activeOpps.reduce(
          (minD, op) => Math.min(minD, common.distance(thisPlayer.currentPOS, op.currentPOS)),
          999
        )
        const [pitchWidth, pitchHeight] = matchDetails.pitchSize
        const attackingTop = thisPlayer.originPOS[1] > pitchHeight / 2
        const forwardDir = attackingTop ? -1 : 1
        const distToGoalY = attackingTop ? thisPlayer.currentPOS[1] : (pitchHeight - thisPlayer.currentPOS[1])
        const isWide = thisPlayer.currentPOS[0] < 210 || thisPlayer.currentPOS[0] > pitchWidth - 210

        // Verificar si el jugador tiene canal libre hacia el arco (Breakaway / Mano a mano limpio)
        // Reglas 13, 15 y 16 IFAB: NUNCA activar Breakaway en el ejecutor de una pelota parada
        const isRestartTaker = Boolean(
          matchDetails.ball.isRestart && matchDetails.ball.Player === thisPlayer.playerID
        )
        let nearestOutfieldAhead = 999
        for (const op of activeOpps) {
          if (op.position === 'GK') continue
          const fDelta = (op.currentPOS[1] - thisPlayer.currentPOS[1]) * forwardDir
          const lDelta = Math.abs(op.currentPOS[0] - thisPlayer.currentPOS[0])
          if (fDelta > 0 && lDelta <= Math.max(32, fDelta * 0.95)) {
            const od = common.distance(thisPlayer.currentPOS, op.currentPOS)
            if (od < nearestOutfieldAhead) nearestOutfieldAhead = od
          }
        }
        const isBreakaway = !isRestartTaker && (nearestOutfieldAhead > 55)

        // Rivales que presionan por el frente o costados (los que corren detrás NO deben forzar pase atrás)
        const frontalOpps = activeOpps.filter(op => {
          const d = common.distance(thisPlayer.currentPOS, op.currentPOS)
          const fDelta = (op.currentPOS[1] - thisPlayer.currentPOS[1]) * forwardDir
          return d < 20 && fDelta > -6
        }).length

        // Solo forzar pase o centro si está acorralado de frente o en el fondo de la cal sin salida
        const inCornerEnd = distToGoalY < 75 && isWide
        const isPlaymaker = (thisPlayer.tacticalRole === 'CAM' || thisPlayer.position === 'CAM' ||
          (Array.isArray(thisPlayer.traits) && thisPlayer.traits.includes('organizador_mediocampo')) ||
          Number(thisPlayer.skill?.control || 70) >= 80)
        const maxPatienceTicks = isPlaymaker ? 32 : 24

        // Si el jugador está congelado en wait por tiempo excesivo o acorralado en el fondo
        const isProlongedStall = matchDetails.ball.carrierTicks >= 28 && action === 'wait'
        const mustRelease = !isBreakaway && (
          (inCornerEnd && matchDetails.ball.carrierTicks >= 14) ||
          (frontalOpps >= 2 && matchDetails.ball.carrierTicks >= 18) ||
          (matchDetails.ball.carrierTicks >= maxPatienceTicks && minOppDist < 25) ||
          isProlongedStall
        )

        if (isBreakaway) {
          // Si el delantero superó la línea defensiva en mano a mano claro y está a quemarropa (distToGoalY <= 110), remata.
          // Si está más lejos, NO forzar pase atrás: dejar que continúe en sprint hacia el arquero
          if (distToGoalY <= 110 && common.isBetween(thisPlayer.currentPOS[0], 180, pitchWidth - 180)) {
            action = 'shoot'
          } else if ((action === 'pass' || action === 'run') && nearestOutfieldAhead > 80) {
            // Si el motor intentaba pasar hacia atrás o trotar sin rivales adelante, meter sprint decidido hacia el arco
            action = 'sprint'
          }
        } else if (mustRelease && (action === 'run' || action === 'sprint' || action === 'wait')) {
          if (distToGoalY <= 140 && isWide) action = 'cross'
          else if (distToGoalY <= 115 && common.isBetween(thisPlayer.currentPOS[0], 180, pitchWidth - 180)) action = 'shoot'
          else if (isProlongedStall || (inCornerEnd && minOppDist < 16)) action = (distToGoalY < 200 ? 'cleared' : 'pass')
          else action = 'pass'
          matchDetails.ball.carrierTicks = 0
        }

        // Blindaje estricto de auto-pase / salida conduciendo en pelotas paradas
        if (isRestartTaker) {
          const ballActions = ['shoot', 'throughBall', 'pass', 'cross', 'cleared', 'boot', 'penalty', 'freekickShot']
          if (!ballActions.includes(action)) {
            action = (thisPlayer.action && ballActions.includes(thisPlayer.action)) ? thisPlayer.action : 'pass'
          }
        }
      }

      // Si este jugador es el receptor destino de un pase en vuelo o está haciendo un desmarque activo, corre con sprint
      if (
        matchDetails.ball.isPendingPass &&
        matchDetails.ball.targetPlayerID === thisPlayer.playerID &&
        Array.isArray(matchDetails.ball.targetPOS)
      ) {
        action = 'sprint'
      } else if (
        !thisPlayer.hasBall &&
        withTeam === team.teamID &&
        thisPlayer.position !== 'GK'
      ) {
        // Solo sprint si tiene un desmarque activo (carrera diagonal o pared)
        if (thisPlayer.offBallRun && thisPlayer.offBallRun.untilIteration > (matchDetails.iterationCount || 0)) {
          action = 'sprint'
        }
      } else {
        const [, pitchHeight = 1050] = matchDetails.pitchSize
        const isTopTeamDef = thisPlayer.originPOS[1] < (pitchHeight / 2)
        const myDistToGoalY = isTopTeamDef ? thisPlayer.currentPOS[1] : (pitchHeight - thisPlayer.currentPOS[1])
        const role = thisPlayer.tacticalRole || thisPlayer.position
        const isBacklineDefender = ['CB', 'LB', 'RB', 'LWB', 'RWB', 'DFC', 'LÍBERO', 'STOP I', 'STOP D'].includes(role) ||
          thisPlayer.position === 'CB' || thisPlayer.position === 'LB' || thisPlayer.position === 'RB'

        // RECOVERY SPRINT / TRACKING BACK (Open Manager DefenderTrackingBackState):
        // Si el defensor central o lateral fue superado de espaldas y el rival corre hacia el arco,
        // o la pelota está más cerca del arco propio que el defensor, o el atacante le gana la espalda:
        // el defensor debe CORRER CON TODO (sprint al 100% de velocidad con urgencia 1.5)
        let needsRecoverySprint = false

        if (withTeam !== team.teamID && thisPlayer.position !== 'GK' && isBacklineDefender) {
          const ballDistToGoalY = isTopTeamDef ? position[1] : (pitchHeight - position[1])
          const ballBehindDefender = (ballDistToGoalY < myDistToGoalY + 18) && myDistToGoalY < (pitchHeight * 0.58)

          const oppBeatingDefender = opp.players.some(op => {
            if (!common.isOnPitch(op) || op.position === 'GK') return false
            const opDistToGoalY = isTopTeamDef ? op.currentPOS[1] : (pitchHeight - op.currentPOS[1])
            const lateralDiff = Math.abs(op.currentPOS[0] - thisPlayer.currentPOS[0])
            return opDistToGoalY < myDistToGoalY && lateralDiff < 145 && opDistToGoalY < (pitchHeight * 0.55)
          })

          const distToIntent = Array.isArray(thisPlayer.intentPOS) ? common.distance(thisPlayer.currentPOS, thisPlayer.intentPOS) : 0
          const urgentRepliegue = distToIntent > 30 && myDistToGoalY < (pitchHeight * 0.55)

          if (ballBehindDefender || oppBeatingDefender || urgentRepliegue) {
            needsRecoverySprint = true
          }
        }

        if (needsRecoverySprint) {
          action = 'sprint'
        } else if ((!withPlayer || withTeam !== team.teamID) && closestPlayer.name === thisPlayer.name) {
          // El jugador más cercano de cada equipo busca activamente la pelota suelta o presiona al portador rival
          if (action !== 'tackle' && action !== 'slide' && action !== 'intercept') action = 'sprint'
          ballToPlayerX = closestPlayerActionBallX(ballToPlayerX)
          ballToPlayerY = closestPlayerActionBallY(ballToPlayerY)
        } else if (
          team.gamePhase === 'DefensiveTransition' &&
          (!withPlayer || withTeam !== team.teamID) &&
          common.distance(thisPlayer.currentPOS, position) < 36 &&
          thisPlayer.position !== 'GK'
        ) {
          // Presión inmediata tras pérdida (Counter-Pressing de open-football)
          if (action !== 'tackle' && action !== 'slide' && action !== 'intercept') action = 'sprint'
          ballToPlayerX = closestPlayerActionBallX(ballToPlayerX)
          ballToPlayerY = closestPlayerActionBallY(ballToPlayerY)
        } else if (withTeam !== team.teamID && thisPlayer.position !== 'GK') {
          const defDuty = team.defensivePlan?.duties?.[thisPlayer.playerID]
          const targetThreatID = defDuty?.duty === 'Mark' ? defDuty.targetID : null
          const markedOpp = targetThreatID ? opp.players.find(p => p.playerID === targetThreatID) : null
          const isOppEnteringBox = markedOpp && (markedOpp.offBallRun?.type === 'boxSlotEntry' || markedOpp.offBallRun?.type === 'boxCrash' || markedOpp.isSprinting)

          if (isOppEnteringBox) {
            action = 'sprint'
          } else if (
            (matchDetails.ball.isAerialCrossDelivery || matchDetails.ball.kickType === 'cross') &&
            matchDetails.ball.targetPOS &&
            common.distance(thisPlayer.currentPOS, matchDetails.ball.targetPOS) < 75
          ) {
            action = 'sprint'
          } else if (
            matchDetails.ball.isPendingPass &&
            matchDetails.ball.kickType === 'through' &&
            matchDetails.ball.targetPOS &&
            isBacklineDefender &&
            common.distance(thisPlayer.currentPOS, matchDetails.ball.targetPOS) < 110
          ) {
            action = 'sprint'
          }
        }
      }
      if (action === 'sprint' || action === 'intercept') {
        thisPlayer.isSprinting = true
        thisPlayer.sprintMomentum = Math.min(1.0, (thisPlayer.sprintMomentum || 0) + 0.25)
      } else {
        thisPlayer.isSprinting = false
        thisPlayer.sprintMomentum = Math.max(0, (thisPlayer.sprintMomentum || 0) - 0.25)
      }
      const move = getMovement(thisPlayer, action, opp, ballToPlayerX, ballToPlayerY, matchDetails, team)
      teamActions.push({ player: thisPlayer, action, move })
    }
  }
  return teamActions
}

function tryCarrierGambeta(matchDetails, carrier, team, opp, move) {
  if ((carrier.gambetaCooldown || 0) > 0) return
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  const isTopTeam = carrier.originPOS[1] < (pitchHeight / 2)
  const dir = isTopTeam ? 1 : -1
  const inWideChannel = carrier.currentPOS[0] < 200 || carrier.currentPOS[0] > (pitchWidth - 200)

  // Buscar un defensor rival que le salga al cruce adelante (entre 8px y 30px)
  const candidates = (opp?.players || []).filter(op => {
    if (!common.isOnPitch(op) || op.position === 'GK' || (op.stunnedTicks || 0) > 0) return false
    const d = common.distance(carrier.currentPOS, op.currentPOS)
    if (d < 8 || d > 30) return false
    const forwardDelta = (op.currentPOS[1] - carrier.currentPOS[1]) * dir
    return forwardDelta >= -6
  })
  if (candidates.length === 0 || candidates.length >= 3) return

  const defender = candidates[0]
  const role = carrier.tacticalRole || carrier.position
  const dribbleSkill = ((Number(carrier.skill?.agility) || 70) + (Number(carrier.skill?.control) || 70)) / 2
  const hasTrait = (p, t) => Array.isArray(p?.traits) && p.traits.includes(t)
  const isEncarador = hasTrait(carrier, 'fenomeno_encarador') || hasTrait(carrier, 'playmaker_gambeteador')
  const isVelocista = hasTrait(carrier, 'velocista_banda')
  const isCaudillo = hasTrait(defender, 'caudillo_fisico')

  // En la banda o 1v1 aislado (open-football isolated_wide), mayor incentivo al desborde individual
  const isIsolated1v1 = candidates.length === 1
  let attemptChance = ['CAM', 'LM', 'RM', 'ST', 'LB', 'RB'].includes(role) ? 78 : (dribbleSkill >= 75 ? 65 : 35)
  if (inWideChannel || isIsolated1v1) attemptChance = Math.min(96, attemptChance + 14)
  if (isEncarador) attemptChance = 95
  if (isVelocista) attemptChance = 90
  if (common.getRandomNumber(1, 100) > attemptChance) return

  const encaradorBonus = isEncarador ? 14 : (isVelocista ? 10 : (inWideChannel ? 6 : 0))
  const caudilloBonus = isCaudillo ? 10 : 0
  const isolationBonus = isIsolated1v1 ? 6 : 0

  const atkScore = (Number(carrier.skill?.agility || 70) * 0.54 + Number(carrier.skill?.control || 70) * 0.46) + encaradorBonus + isolationBonus + common.getRandomNumber(-8, 14)
  const defScore = (Number(defender.skill?.tackling || 65) * 0.52 + Number(defender.skill?.perception || 65) * 0.48) + caudilloBonus + common.getRandomNumber(-9, 9)

  if (atkScore >= defScore) {
    // ¡Gambeta exitosa! El defensor queda pagando y el portador gana un paso explosivo al espacio
    defender.stunnedTicks = 5
    carrier.gambetaCooldown = 10
    carrier.lastGambetaIter = matchDetails.iterationCount || 0
    if (!carrier.stats.dribbles) carrier.stats.dribbles = 0
    carrier.stats.dribbles++
    const burstX = move[0] !== 0 ? Math.sign(move[0]) * 6 : (carrier.currentPOS[0] < defender.currentPOS[0] ? -6 : 6)
    const burstY = dir * 6
    carrier.currentPOS = completeMovement(matchDetails, carrier.currentPOS, [burstX, burstY])
    matchDetails.iterationLog.push(`Gambeta by: ${carrier.name} past ${defender.name}`)
    if (Array.isArray(matchDetails.events)) {
      matchDetails.events.push({
        type: 'gambeta',
        teamID: team.teamID,
        teamName: team.name,
        playerName: carrier.name,
        victimName: defender.name,
        iteration: matchDetails.iterationCount || 0,
        half: matchDetails.half
      })
    }
  } else {
    // Si el defensor es un CAUDILLO FÍSICO y tiene ventaja de fuerza, usa el cuerpo (hombro a hombro limpio)
    if (isCaudillo && (Number(defender.skill?.strength || 70) >= Number(carrier.skill?.strength || 65) + 3)) {
      carrier.stunnedTicks = 4
      defender.lastCaudilloIter = matchDetails.iterationCount || 0
      if (!defender.stats.tackles) defender.stats.tackles = { total: 0, on: 0, off: 0, fouls: 0 }
      defender.stats.tackles.total++
      defender.stats.tackles.on++
      actions.setPostTackleBall(matchDetails, opp, team, defender)
      matchDetails.iterationLog.push(`Caudillo body check by: ${defender.name} against ${carrier.name}`)
      if (Array.isArray(matchDetails.events)) {
        matchDetails.events.push({
          type: 'caudilloTackle',
          teamID: opp.teamID,
          teamName: opp.name,
          playerName: defender.name,
          victimName: carrier.name,
          iteration: matchDetails.iterationCount || 0,
          half: matchDetails.half
        })
      }
    } else {
      carrier.gambetaCooldown = 8
    }
  }
}

export function movePlayers(moves, team, opp, matchDetails) {
  const controlRadius = 12
  const challengeRadius = 22
  for (const thisPlayerMove of moves) {
    const thisPlayer = thisPlayerMove.player
    if (!common.isOnPitch(thisPlayer)) continue
    if ((thisPlayer.slideRecoveryTicks || 0) > 0) {
      thisPlayer.slideRecoveryTicks--
      continue
    }
    if ((thisPlayer.stunnedTicks || 0) > 0) {
      thisPlayer.stunnedTicks--
      continue
    }
    const { move, action } = thisPlayerMove
    thisPlayer.currentPOS = completeMovement(matchDetails, thisPlayer.currentPOS, move, thisPlayer)

    // Si este jugador lleva la pelota (dribbling con run/sprint), evaluar gambeta 1v1 y mover la pelota junto con él
    if (thisPlayer.hasBall === true && matchDetails.ball.Player === thisPlayer.playerID) {
      if (action === 'run' || action === 'sprint') {
        tryCarrierGambeta(matchDetails, thisPlayer, team, opp, move)
      }
      matchDetails.ball.position = [thisPlayer.currentPOS[0], thisPlayer.currentPOS[1], 0]
      continue
    }

    const { position, withPlayer, withTeam } = matchDetails.ball
    const xPosition = common.isBetween(thisPlayer.currentPOS[0], position[0] - controlRadius, position[0] + controlRadius)
    const yPosition = common.isBetween(thisPlayer.currentPOS[1], position[1] - controlRadius, position[1] + controlRadius)
    const inChallengeZone = common.isBetween(thisPlayer.currentPOS[0], position[0] - challengeRadius, position[0] + challengeRadius) &&
      common.isBetween(thisPlayer.currentPOS[1], position[1] - challengeRadius, position[1] + challengeRadius)
    const samePositionAsBall = common.isBetween(thisPlayer.currentPOS[0], position[0] - 8, position[0] + 8) &&
      common.isBetween(thisPlayer.currentPOS[1], position[1] - 8, position[1] + 8)
    const isRecentKicker = (
      thisPlayer.playerID === matchDetails.ball.lastTouch.playerID &&
      matchDetails.ball.lastTouch.iterations < 5 &&
      matchDetails.ball.ballOverIterations.length > 0
    )
    if (isRecentKicker) continue
    // Si es un remate al arco en vuelo, lo resuelve thisPlayerIsInProximity / keepInBoundaries (atajada, bloqueo o gol)
    if (
      matchDetails.ball.ballOverIterations.length > 0 &&
      (matchDetails.ball.kickType === 'shot' || matchDetails.ball.kickType === 'freekick')
    ) {
      continue
    }
    // Si la pelota va alta en el aire (z > 12), no se controla simplemente caminando por debajo en movePlayers
    if ((position[2] || 0) > 12 && matchDetails.ball.ballOverIterations.length > 0) continue

    const closeWithPlayer = !!(xPosition && yPosition && withPlayer === false)
    if (inChallengeZone && withTeam !== team.teamID) {
      // Regla IFAB: Durante un saque o reanudación reglamentaria (córner, tiro libre, penal, saque de meta o lateral),
      // ningún rival puede disputar o quitarle el balón al ejecutante antes del tiro.
      if (matchDetails.ball?.isRestart) continue

      const role = thisPlayer.tacticalRole || thisPlayer.position
      const isAttacker = role === 'ST' || role === 'CAM' || thisPlayer.position === 'ST'
      const autoChallengeChance = isAttacker ? 10 : 52
      if (samePositionAsBall) {
        if (withPlayer === true && thisPlayer.hasBall === false && withTeam !== team.teamID) {
          if (action === 'slide' && !isAttacker) matchDetails = completeSlide(matchDetails, thisPlayer, team, opp)
          else if (action === 'tackle' && !isAttacker) matchDetails = completeTackleWhenCloseNoBall(matchDetails, thisPlayer, team, opp)
          else if (common.getRandomNumber(0, 100) < autoChallengeChance) matchDetails = completeTackleWhenCloseNoBall(matchDetails, thisPlayer, team, opp)
        } else if (withPlayer === false) {
          setClosePlayerTakesBall(matchDetails, thisPlayer, team, opp)
        }
      } else if (withPlayer === true && thisPlayer.hasBall === false && withTeam !== team.teamID) {
        if (action === 'slide' && !isAttacker) matchDetails = completeSlide(matchDetails, thisPlayer, team, opp)
        else if (action === 'tackle' && !isAttacker) matchDetails = completeTackleWhenCloseNoBall(matchDetails, thisPlayer, team, opp)
        else if (!isAttacker && common.getRandomNumber(0, 100) < 36) matchDetails = completeTackleWhenCloseNoBall(matchDetails, thisPlayer, team, opp)
      } else if (withPlayer === false && xPosition && yPosition) {
        setClosePlayerTakesBall(matchDetails, thisPlayer, team, opp)
      }
    } else if (closeWithPlayer) setClosePlayerTakesBall(matchDetails, thisPlayer, team, opp)
  }
  return team
}

export function executeBallAction(move, team, opp, matchDetails) {
  if (matchDetails.ball.ballOverIterations.length !== 0) return team
  const { player, action } = move
  handleBallPlayerActions(matchDetails, player, team, opp, action)
  if (!matchDetails.ball.withPlayer) {
    common.removeBallFromAllPlayers(matchDetails)
    matchDetails.ball.Player = ''
    matchDetails.ball.withPlayer = false
    matchDetails.ball.withTeam = ''
  }
  return team
}

export function setClosePlayerTakesBall(matchDetails, thisPlayer, team, opp) {
  if (!common.isOnPitch(thisPlayer)) return
  const offsideVarData = thisPlayer.offsideSnapshot ||
    matchDetails.lastOffsideSnapshot ||
    matchDetails.pendingOffsideSnapshot ||
    matchDetails.ball?.offsideSnapshot ||
    null

  // Cobrar offside únicamente si el jugador estaba adelantado en un pase con snapshot válido
  if (thisPlayer.offside && offsideVarData) {
    thisPlayer.offside = false
    thisPlayer.offsideSnapshot = null
    matchDetails.iterationLog.push(`${thisPlayer.name} is offside`)
    if (Array.isArray(matchDetails.events)) {
      matchDetails.events.push({
        type: 'offside',
        teamID: team.teamID,
        teamName: team.name,
        playerName: thisPlayer.name,
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
    if (team.name === matchDetails.kickOffTeam.name) setPositions.setSetpieceSecondTeam(matchDetails)
    else setPositions.setSetpieceKickOffTeam(matchDetails)
  } else {
    thisPlayer.offside = false
    thisPlayer.offsideSnapshot = null
    // Si venía de un pase pendiente de un compañero, sumar pase completado
    if (
      matchDetails.ball.isPendingPass &&
      matchDetails.ball.lastTouch.teamID === team.teamID &&
      matchDetails.ball.lastTouch.playerID !== thisPlayer.playerID
    ) {
      const passer = team.players.find(p => p.playerID === matchDetails.ball.lastTouch.playerID)
      if (passer) passer.stats.passes.on++
      if (team.teamID === matchDetails.kickOffTeam.teamID) {
        matchDetails.kickOffTeamStatistics.passesCompleted = (matchDetails.kickOffTeamStatistics.passesCompleted || 0) + 1
      } else {
        matchDetails.secondTeamStatistics.passesCompleted = (matchDetails.secondTeamStatistics.passesCompleted || 0) + 1
      }
    }
    matchDetails.ball.isPendingPass = false

    thisPlayer.hasBall = true
    matchDetails.ball.lastTouch.playerName = thisPlayer.name
    matchDetails.ball.lastTouch.playerID = thisPlayer.playerID
    matchDetails.ball.lastTouch.teamID = team.teamID
    matchDetails.ball.lastTouch.deflection = false
    matchDetails.ball.ballOverIterations = []
    matchDetails.ball.position = [thisPlayer.currentPOS[0], thisPlayer.currentPOS[1], 0]
    matchDetails.ball.Player = thisPlayer.playerID
    matchDetails.ball.withPlayer = true
    matchDetails.ball.withTeam = team.teamID
    team.intent = 'attack'
    opp.intent = 'defend'
  }
}

function sendPlayerOff(matchDetails, team, thisPlayer, reason = 'red') {
  if (!thisPlayer || thisPlayer.sentOff) return
  thisPlayer.stats.cards.red++
  thisPlayer.sentOff = true
  thisPlayer.hasBall = false
  thisPlayer.currentPOS = ['NP', 'NP']
  thisPlayer.intentPOS = ['NP', 'NP']
  matchDetails.iterationLog.push(`Red Card - ${thisPlayer.name} (${team.name})`)
  if (Array.isArray(matchDetails.events)) {
    matchDetails.events.push({
      type: 'redCard',
      reason,
      teamID: team.teamID,
      teamName: team.name,
      playerName: thisPlayer.name,
      iteration: matchDetails.iterationCount || 0,
      half: matchDetails.half
    })
  }
}

function giveYellowCard(matchDetails, team, thisPlayer) {
  if (!thisPlayer || thisPlayer.sentOff) return
  thisPlayer.stats.cards.yellow++
  matchDetails.iterationLog.push(`Yellow Card - ${thisPlayer.name} (${team.name})`)
  if (Array.isArray(matchDetails.events)) {
    matchDetails.events.push({
      type: 'yellowCard',
      teamID: team.teamID,
      teamName: team.name,
      playerName: thisPlayer.name,
      iteration: matchDetails.iterationCount || 0,
      half: matchDetails.half
    })
  }
  if (thisPlayer.stats.cards.yellow >= 2) {
    sendPlayerOff(matchDetails, team, thisPlayer, 'secondYellow')
  }
}

export function completeSlide(matchDetails, thisPlayer, team, opp) {
  if (!thisPlayer || !common.isOnPitch(thisPlayer) || thisPlayer.sentOff) return matchDetails
  if (thisPlayer.fitness > 20) {
    thisPlayer.fitness = common.round(Math.max(20, thisPlayer.fitness - 0.35), 4)
  }
  const foul = actions.resolveSlide(thisPlayer, team, opp, matchDetails)
  if (!foul) return matchDetails
  const intensity = actions.foulIntensity()
  matchDetails.pendingFoulPlayer = { name: thisPlayer.name, playerID: thisPlayer.playerID, teamID: team.teamID }
  matchDetails.pendingFoulCard = null
  matchDetails.pendingPenaltyInfractor = thisPlayer.name
  if (common.isBetween(intensity, 44, 94)) {
    giveYellowCard(matchDetails, team, thisPlayer)
    matchDetails.pendingFoulCard = 'yellow'
  } else if (intensity >= 95) {
    sendPlayerOff(matchDetails, team, thisPlayer, 'directRed')
    matchDetails.pendingFoulCard = 'red'
  }
  if (opp.name === matchDetails.kickOffTeam.name) return setPositions.setSetpieceKickOffTeam(matchDetails)
  return setPositions.setSetpieceSecondTeam(matchDetails)
}

export function completeTackleWhenCloseNoBall(matchDetails, thisPlayer, team, opp) {
  if (!thisPlayer || !common.isOnPitch(thisPlayer) || thisPlayer.sentOff) return matchDetails
  if (thisPlayer.fitness > 20) {
    thisPlayer.fitness = common.round(Math.max(20, thisPlayer.fitness - 0.12), 4)
  }
  const foul = actions.resolveTackle(thisPlayer, team, opp, matchDetails)
  if (!foul) return matchDetails
  matchDetails.pendingFoulPlayer = { name: thisPlayer.name, playerID: thisPlayer.playerID, teamID: team.teamID }
  matchDetails.pendingFoulCard = null
  matchDetails.pendingPenaltyInfractor = thisPlayer.name
  const intensity = actions.foulIntensity()
  if (common.isBetween(intensity, 58, 96)) {
    giveYellowCard(matchDetails, team, thisPlayer)
    matchDetails.pendingFoulCard = 'yellow'
  } else if (intensity >= 97) {
    sendPlayerOff(matchDetails, team, thisPlayer, 'directRed')
    matchDetails.pendingFoulCard = 'red'
  }
  if (opp.name === matchDetails.kickOffTeam.name) return setPositions.setSetpieceKickOffTeam(matchDetails)
  return setPositions.setSetpieceSecondTeam(matchDetails)
}

function completeMovement(matchDetails, currentPOS, move, player = null) {
  if (currentPOS[0] !== 'NP') {
    const intendedMovementX = currentPOS[0] + move[0]
    const intendedMovementY = currentPOS[1] + move[1]
    let actualMoveX = 0
    let actualMoveY = 0
    if (intendedMovementX < matchDetails.pitchSize[0] + 1 && intendedMovementX > -1) {
      currentPOS[0] += move[0]
      actualMoveX = move[0]
    }
    if (intendedMovementY < matchDetails.pitchSize[1] + 1 && intendedMovementY > -1) {
      currentPOS[1] += move[1]
      actualMoveY = move[1]
    }
    if (player && player.stats) {
      const stepDistMeters = Math.hypot(actualMoveX, actualMoveY) * 0.1
      player.stats.distanceCovered = common.round((player.stats.distanceCovered || 0) + stepDistMeters, 2)
    }
  }
  return currentPOS
}

export function closestPlayerActionBallX(ballToPlayerX) {
  if (common.isBetween(ballToPlayerX, -30, 30) === false) {
    if (ballToPlayerX > 29) return 29
    return -29
  }
  return ballToPlayerX
}

export function closestPlayerActionBallY(ballToPlayerY) {
  if (common.isBetween(ballToPlayerY, -30, 30) === false) {
    if (ballToPlayerY > 29) return 29
    return -29
  }
  return ballToPlayerY
}

export function checkProvidedAction(matchDetails, thisPlayer, action, team) {
  const ballActions = ['shoot', 'throughBall', 'pass', 'cross', 'cleared', 'boot', 'penalty', 'freekickShot']
  const allActions = [
    'shoot', 'throughBall', 'pass', 'cross', 'tackle', 'intercept', 'slide',
    'run', 'sprint', 'cleared', 'boot', 'penalty', 'freekickShot'
  ]

  const myTeamID = team?.teamID || thisPlayer.teamID || ''

  // Reglas 13, 15 y 16 IFAB (Open Football TakeRestart):
  // El ejecutor de una pelota parada NO puede salir conduciendo/gambeteando la pelota (auto-pase prohibido).
  const isRestartCarrier = Boolean(
    matchDetails.ball.isRestart && thisPlayer.playerID === matchDetails.ball.Player
  )
  if (isRestartCarrier) {
    const providedAction = thisPlayer.action ? thisPlayer.action : 'unassigned'
    if (ballActions.includes(providedAction)) {
      return providedAction
    }
    if (!ballActions.includes(action)) {
      return 'pass'
    }
    return action
  }

  if (thisPlayer.playerID !== matchDetails.ball.Player) {
    if (ballActions.includes(action)) return 'run'
    if (matchDetails.ball.withTeam === myTeamID && ['tackle', 'slide', 'intercept'].includes(action)) {
      return 'run'
    }
  }

  const providedAction = thisPlayer.action ? thisPlayer.action : 'unassigned'
  if (providedAction === 'none') return action
  if (allActions.includes(providedAction)) {
    if (thisPlayer.playerID !== matchDetails.ball.Player) {
      if (ballActions.includes(providedAction)) {
        thisPlayer.action = 'none'
        return 'run'
      }
      if (matchDetails.ball.withTeam === myTeamID && ['tackle', 'slide', 'intercept'].includes(providedAction)) {
        thisPlayer.action = 'none'
        return 'run'
      }
      return providedAction
    }
    if (providedAction === 'tackle' || providedAction === 'slide' || providedAction === 'intercept') {
      action = ballActions[common.getRandomNumber(0, 5)]
      return action
    }
    return providedAction
  }
  return action
}

export function handleBallPlayerActions(matchDetails, thisPlayer, team, opp, action) {
  const ballActions = ['shoot', 'throughBall', 'pass', 'cross', 'cleared', 'boot', 'penalty', 'freekickShot']
  ballMovement.getBallDirection(matchDetails, thisPlayer.currentPOS)
  matchDetails.ball.position = [thisPlayer.currentPOS[0], thisPlayer.currentPOS[1], 0]
  if (ballActions.includes(action)) {
    ballMoved(matchDetails, thisPlayer, team, opp)
    if (action === 'cleared' || action === 'boot') {
      const newPosition = ballMovement.ballKicked(matchDetails, team, thisPlayer)
      updateInformation(matchDetails, newPosition)
    } else if (action === 'pass') {
      const newPosition = ballMovement.ballPassed(matchDetails, team, thisPlayer)
      matchDetails.iterationLog.push(`passed to new position: ${newPosition}`)
      updateInformation(matchDetails, newPosition)
    } else if (action === 'cross') {
      const newPosition = ballMovement.ballCrossed(matchDetails, team, thisPlayer)
      matchDetails.iterationLog.push(`crossed to new position: ${newPosition}`)
      updateInformation(matchDetails, newPosition)
    } else if (action === 'throughBall') {
      const newPosition = ballMovement.throughBall(matchDetails, team, thisPlayer)
      updateInformation(matchDetails, newPosition)
    } else if (action === 'shoot') {
      const newPosition = ballMovement.shotMade(matchDetails, team, thisPlayer)
      updateInformation(matchDetails, newPosition)
    } else if (action === 'freekickShot') {
      const newPosition = ballMovement.freekickShotMade(matchDetails, team, thisPlayer)
      updateInformation(matchDetails, newPosition)
    } else if (action === 'penalty') {
      const newPosition = ballMovement.penaltyTaken(matchDetails, team, thisPlayer)
      updateInformation(matchDetails, newPosition)
    }
  }
}

export function ballMoved(matchDetails, thisPlayer, team, opp) {
  thisPlayer.hasBall = false
  matchDetails.ball.withPlayer = false
  team.intent = 'attack'
  opp.intent = 'attack'
  matchDetails.ball.Player = ''
  matchDetails.ball.withTeam = ''
  matchDetails.ball.isRestart = false
  matchDetails.ball.isGoalKick = false
  matchDetails.ball.isThrowIn = false
  matchDetails.ball.isCornerKick = false
  matchDetails.ball.isOffsideExempt = false
  delete matchDetails.isThrowIn
  delete matchDetails.throwInTakerID
}

export function updateInformation(matchDetails, newPosition) {
  if (matchDetails.endIteration === true || !Array.isArray(newPosition)) return
  matchDetails.ball.position = [newPosition[0], newPosition[1], 0]
}

export function getMovement(player, action, opposition, ballX, ballY, matchDetails, team) {
  const { position } = matchDetails.ball
  const ballActions = ['shoot', 'throughBall', 'pass', 'cross', 'cleared', 'boot', 'penalty', 'freekickShot']
  if (action === 'wait' || ballActions.includes(action)) return [0, 0]
  if (action === 'tackle' || action === 'slide') {
    return getTackleMovement(ballX, ballY)
  }
  if (action === 'intercept') {
    let maxSpeed = player.skill.agility >= 86 ? 8.5 : 7.2
    const tempo = team?.coachState?.coefficients?.tempoMultiplier || 1.0
    maxSpeed *= tempo
    return calculateInterceptMovement(player, matchDetails, maxSpeed)
  }
  if (action === 'run') {
    return getRunMovement(matchDetails, player, ballX, ballY, team, opposition)
  }
  if (action === 'sprint') {
    return getSprintMovement(matchDetails, player, ballX, ballY, team, opposition)
  }
  return [0, 0]
}

function getTackleMovement(ballX, ballY) {
  const move = [0, 0]
  if (ballX > 0) move[0] = -Math.min(4, ballX)
  else if (ballX < 0) move[0] = Math.min(4, -ballX)
  if (ballY > 0) move[1] = -Math.min(4, ballY)
  else if (ballY < 0) move[1] = Math.min(4, -ballY)
  return move
}

/**
 * Conducción inteligente en 7 carriles angulares (-72°, -45°, -22°, 0°, +22°, +45°, +72°):
 * - Si nadie lo marca, avanza decidido hacia el arco o por su carril.
 * - Si es extremo/lateral (o va por la banda), desborda hasta el fondo (distToGoalY < 92) antes de cerrarse.
 * - Si está en mitad de cancha con el centro congestionado, abre la cancha hacia el sector libre.
 */
function getSmartDribbleMove(matchDetails, player, step, opposition, team) {
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  const side = (player.originPOS[1] > pitchHeight / 2) ? 'bottom' : 'top'
  const baseAngle = side === 'bottom' ? -Math.PI / 2 : Math.PI / 2
  const anglesInRad = [
    baseAngle - 1.25,   // -72° diagonal abierta izquierda
    baseAngle - 0.78,   // -45° diagonal suave
    baseAngle - 0.38,   // -22°
    baseAngle,          // 0° frontal hacia el arco / línea de fondo
    baseAngle + 0.38,   // +22°
    baseAngle + 0.78,   // +45° diagonal suave
    baseAngle + 1.25,   // +72° diagonal abierta derecha
    baseAngle - 2.05,   // -118° giro de protección hacia atrás/interior
    baseAngle + 2.05,   // +118° giro de protección hacia atrás/interior
    baseAngle + Math.PI // 180° giro total de desahogo hacia campo propio
  ]

  const role = player.tacticalRole || player.position
  const hasTrait = (traitName) => Array.isArray(player.traits) && player.traits.includes(traitName)
  const isEncarador = hasTrait('fenomeno_encarador') || hasTrait('playmaker_gambeteador') || role === 'ST'
  const isVelocista = hasTrait('velocista_banda')
  const isWidePlayer = ['LM', 'RM', 'LB', 'RB'].includes(role) || isVelocista
  const inWideChannel = player.currentPOS[0] < 175 || player.currentPOS[0] > (pitchWidth - 175)
  const distToGoalY = side === 'bottom' ? player.currentPOS[1] : (pitchHeight - player.currentPOS[1])
  const playStyle = team?.playStyle || 'balanced'

  // Determinar el carril objetivo (desiredX) según el rol, la zona, la personalidad y la congestión rival
  let desiredX = player.originPOS[0]
  // 1. Jugadores de banda (extremos LM/RM, laterales desbordando o en canal lateral):
  // Corren pegados a la cal para estirar la cancha y desbordar.
  // Solo se cierran hacia el área cuando llegan muy cerca del fondo (distToGoalY < 95)
  if (isWidePlayer || inWideChannel) {
    const onLeft = player.currentPOS[0] < (pitchWidth / 2)
    if (distToGoalY < 95) {
      desiredX = onLeft ? 210 : (pitchWidth - 210) // Recorte hacia el área penal
    } else {
      desiredX = onLeft ? 45 : (pitchWidth - 45) // Pegado a la cal desbordando hacia la línea de fondo
    }
  } else if (isEncarador && distToGoalY < 360) {
    // Delanteros centro o mediapuntas centrales encaradores (Ronaldo Nazário, Agüero, etc.): mira directo al arco
    desiredX = (pitchWidth / 2) + common.getRandomNumber(-15, 15)
  } else if (playStyle === 'wingPlay' && distToGoalY > 210) {
    // Volante central en estilo por bandas tiende a abrir la jugada hacia la banda más libre
    const leftOpps = (opposition?.players || []).filter(op => common.isOnPitch(op) && op.currentPOS[0] < 240 && Math.abs(op.currentPOS[1] - player.currentPOS[1]) < 140).length
    const rightOpps = (opposition?.players || []).filter(op => common.isOnPitch(op) && op.currentPOS[0] > pitchWidth - 240 && Math.abs(op.currentPOS[1] - player.currentPOS[1]) < 140).length
    desiredX = leftOpps <= rightOpps ? 120 : (pitchWidth - 120)
  } else if (distToGoalY < 235) {
    // Atacante o volante llegando por el centro en zona de definición: encarar hacia el área
    desiredX = pitchWidth / 2
  } else {
    // En mitad de cancha: si hay congestión en el centro, abrir la cancha hacia el costado más despejado
    const centralCongestion = (opposition?.players || []).filter(
      op => common.isOnPitch(op) && Math.abs(op.currentPOS[0] - player.currentPOS[0]) < 65 &&
        ((side === 'bottom' ? (player.currentPOS[1] - op.currentPOS[1]) : (op.currentPOS[1] - player.currentPOS[1])) > 0) &&
        ((side === 'bottom' ? (player.currentPOS[1] - op.currentPOS[1]) : (op.currentPOS[1] - player.currentPOS[1])) < 110)
    ).length
    if (centralCongestion >= 2) {
      desiredX = player.currentPOS[0] < (pitchWidth / 2) ? 115 : (pitchWidth - 115)
    }
  }

  let bestMove = [0, side === 'bottom' ? -step : step]
  let bestScore = -999999

  for (const ang of anglesInRad) {
    const dx = Math.round(Math.cos(ang) * (step + 1))
    const dy = Math.round(Math.sin(ang) * (step + 1))
    const candX = player.currentPOS[0] + dx
    const candY = player.currentPOS[1] + dy

    if (candX < 18 || candX > pitchWidth - 18 || candY < 15 || candY > pitchHeight - 15) continue

    let minOppDist = 999
    if (opposition && Array.isArray(opposition.players)) {
      for (const opp of opposition.players) {
        if (!common.isOnPitch(opp) || (opp.stunnedTicks || 0) > 0) continue
        const d = common.distance([candX, candY], opp.currentPOS)
        if (d < minOppDist) minOppDist = d
      }
    }

    // Premiar fuertemente ir hacia donde hay espacio libre (esquivar marcas)
    const clearanceScore = Math.min(46, minOppDist) * 1.65
    // Premiar el avance hacia el arco rival; si va hacia atrás o adentro y el frente está tapado, premiar el giro protector
    const forwardProgress = side === 'bottom' ? -dy : dy
    let progressScore = 0
    if (forwardProgress >= 0) {
      progressScore = forwardProgress * (isEncarador ? 9.8 : (team?.mentality === 'offensive' ? 8.2 : 6.8))
    } else {
      const isFrontBlocked = minOppDist < 20 || distToGoalY < 75
      progressScore = isFrontBlocked ? Math.abs(forwardProgress) * 4.2 : forwardProgress * 2.2
    }
    // Afinidad hacia el carril táctico elegido (banda, abrir cancha o encarar al área)
    const xBefore = Math.abs(player.currentPOS[0] - desiredX)
    const xAfter = Math.abs(candX - desiredX)
    const laneScore = (xBefore - xAfter) * 2.8
    const jitter = common.getRandomNumber(-2, 2)

    const total = clearanceScore + progressScore + laneScore + jitter
    if (total > bestScore) {
      bestScore = total
      bestMove = [dx, dy]
    }
  }

  return bestMove
}

export function getRunMovement(matchDetails, player, ballX, ballY, team, opposition) {
  player.isSprinting = false
  player.sprintMomentum = Math.max(0, (player.sprintMomentum || 0) - 0.25)
  if (player.position !== 'GK' && player.fitness > 20) {
    const stamina = Number(player.skill?.stamina ?? player.skill?.resistencia ?? 75)
    const staminaMod = Math.max(0.68, Math.min(1.45, 1.0 - (stamina - 75) * 0.012))
    const captainMultiplier = isCaptainOnPitch(team) ? 0.85 : 1.0
    const mentalityMultiplier = team?.mentality === 'offensive' ? 1.18 : (team?.mentality === 'defensive' ? 0.86 : 1.0)
    const ballCarrierDrain = player.hasBall ? 0.004 : 0.0
    const drain = (0.015 + ballCarrierDrain) * staminaMod * captainMultiplier * mentalityMultiplier
    player.fitness = common.round(Math.max(20, player.fitness - drain), 4)
    if (matchDetails.iterationCount % 35 === 0) updatePlayerEffectiveSkills(player, team)
  }
  let step = player.skill.agility >= 80 ? 3 : 2
  const tempo = team?.coachState?.coefficients?.tempoMultiplier || 1.0
  step *= tempo
  if (player.hasBall) {
    const carrierTicks = (matchDetails.ball.lastCarrierID === player.playerID) ? (matchDetails.ball.carrierTicks || 1) : 1
    const distToGoalY = (player.originPOS[1] > matchDetails.pitchSize[1] / 2) ? player.currentPOS[1] : (matchDetails.pitchSize[1] - player.currentPOS[1])
    // Temporización y escaneo (open-football model): ritmo pausado en posesión para esperar desmarques
    if (carrierTicks <= 4 && distToGoalY > 210) {
      step = Math.max(0.8, step * 0.5)
    }
    return getSmartDribbleMove(matchDetails, player, step, opposition, team)
  }

  // Si nuestro equipo tiene la posesión y el jugador apoya la jugada, avance coordinado sin atropellar
  if (matchDetails.ball.withTeam === team?.teamID && player.position !== 'GK') {
    const distToTarget = Array.isArray(player.intentPOS)
      ? common.distance(player.currentPOS, player.intentPOS)
      : 0
    if (distToTarget > 25) {
      step = player.skill.agility >= 84 ? 3.6 : 3.0
    }
  }

  // Solo ir directo a la pelota si está suelta muy cerca (< 24px) o es el jugador asignado a la presión
  const isClosest = team?.closestPlayerID === player.playerID
  if (!matchDetails.ball.withPlayer && !matchDetails.ball.isPendingPass && (isClosest || Math.hypot(ballX, ballY) < 24)) {
    return steerTowardsTarget(player, matchDetails.ball.position, step, team, matchDetails.pitchSize)
  }
  const target = Array.isArray(player.intentPOS) ? player.intentPOS : player.originPOS
  return steerTowardsTarget(player, target, step, team, matchDetails.pitchSize)
}

export function getSprintMovement(matchDetails, player, ballX, ballY, team, opposition) {
  player.isSprinting = true
  player.sprintMomentum = Math.min(1.0, (player.sprintMomentum || 0) + 0.25)
  if (player.position !== 'GK' && player.fitness > 20) {
    const stamina = Number(player.skill?.stamina ?? player.skill?.resistencia ?? 75)
    const staminaMod = Math.max(0.68, Math.min(1.45, 1.0 - (stamina - 75) * 0.012))
    const captainMultiplier = isCaptainOnPitch(team) ? 0.85 : 1.0
    const mentalityMultiplier = team?.mentality === 'offensive' ? 1.22 : (team?.mentality === 'defensive' ? 0.88 : 1.0)
    const ballCarrierDrain = player.hasBall ? 0.007 : 0.0
    const drain = (0.038 + ballCarrierDrain) * staminaMod * captainMultiplier * mentalityMultiplier
    player.fitness = common.round(Math.max(20, player.fitness - drain), 4)
    if (matchDetails.iterationCount % 35 === 0) updatePlayerEffectiveSkills(player, team)
  }
  // Sprint explosivo: 6.5 a 9.5 px/tick según agilidad
  let baseStep = 6.5
  if (player.skill.agility >= 94) baseStep = 9.5
  else if (player.skill.agility >= 86) baseStep = 8.5
  else if (player.skill.agility >= 76) baseStep = 7.5
  else if (player.skill.agility < 65) baseStep = 5.5

  const tempo = team?.coachState?.coefficients?.tempoMultiplier || 1.0
  const step = (player.fitness < 45
    ? Math.max(3.5, baseStep * (0.60 + ((player.fitness - 20) / 25) * 0.40))
    : baseStep) * tempo

  if (player.hasBall) {
    return getSmartDribbleMove(matchDetails, player, step, opposition, team)
  }

  // Si este jugador es el destinatario de un pase en curso, correr directamente al destino del pase
  if (
    matchDetails.ball.isPendingPass &&
    matchDetails.ball.targetPlayerID === player.playerID &&
    Array.isArray(matchDetails.ball.targetPOS)
  ) {
    return steerTowardsTarget(player, matchDetails.ball.targetPOS, step + 1, team, matchDetails.pitchSize)
  }

  // Si hay un centro o córner en vuelo y este defensor rival sprintea a disputarlo o cubrirlo
  if (
    (matchDetails.ball.isAerialCrossDelivery || matchDetails.ball.kickType === 'cross') &&
    Array.isArray(matchDetails.ball.targetPOS) &&
    matchDetails.ball.lastTouch.teamID !== team.teamID &&
    player.position !== 'GK'
  ) {
    const distToCross = common.distance(player.currentPOS, matchDetails.ball.targetPOS)
    if (distToCross < 85) {
      return steerTowardsTarget(player, matchDetails.ball.targetPOS, step, team, matchDetails.pitchSize)
    }
  }

  // Si hay un pase filtrado largo del rival y este defensor retrocede para cortar la trayectoria
  if (
    matchDetails.ball.isPendingPass &&
    matchDetails.ball.kickType === 'through' &&
    Array.isArray(matchDetails.ball.targetPOS) &&
    matchDetails.ball.lastTouch.teamID !== team.teamID &&
    player.position !== 'GK'
  ) {
    const distToThrough = common.distance(player.currentPOS, matchDetails.ball.targetPOS)
    if (distToThrough < 110) {
      return steerTowardsTarget(player, matchDetails.ball.targetPOS, step, team, matchDetails.pitchSize)
    }
  }

  // Si es el jugador que presiona o disputa pelota suelta cercana, ir hacia el balón
  const isPresser = team?.defensivePlan?.presserID === player.playerID
  const isLooseBallNear = !matchDetails.ball.withPlayer && Math.hypot(ballX, ballY) < 65
  if ((isPresser || isLooseBallNear) && matchDetails.ball.withTeam !== team?.teamID) {
    return steerTowardsTarget(player, matchDetails.ball.position, step, team, matchDetails.pitchSize)
  }
  const target = Array.isArray(player.intentPOS) ? player.intentPOS : player.originPOS
  return steerTowardsTarget(player, target, step, team, matchDetails.pitchSize)
}

export function closestPlayerToBall(closestPlayer, team, matchDetails) {
  let closestPlayerDetails = null
  const { position } = matchDetails.ball
  for (const thisPlayer of team.players) {
    if (!common.isOnPitch(thisPlayer)) continue
    const ballToPlayerX = thisPlayer.currentPOS[0] - position[0]
    const ballToPlayerY = thisPlayer.currentPOS[1] - position[1]
    const proximityToBall = Math.hypot(ballToPlayerX, ballToPlayerY)
    if (proximityToBall < closestPlayer.position) {
      closestPlayer.name = thisPlayer.name
      closestPlayer.position = proximityToBall
      closestPlayerDetails = thisPlayer
    }
  }
  if (!closestPlayerDetails) {
    closestPlayerDetails = team.players.find(common.isOnPitch) || team.players[0]
    closestPlayer.name = closestPlayerDetails.name
    closestPlayer.position = 0
  }
  team.closestPlayerID = closestPlayerDetails.playerID
  closestPlayer.playerID = closestPlayerDetails.playerID
  closestPlayer.thePlayer = closestPlayerDetails
  matchDetails.iterationLog.push(`Closest Player to ball: ${closestPlayerDetails.name}`)
}

export function checkOffside(team1, team2, matchDetails) {
  // El fuera de juego se evalúa de forma reglamentaria en el momento del pase (evaluateOffsideAtKick en ballMovement.js).
  // La comprobación estática sin pase queda desactivada para evitar offsides fantasma sin líneas de VAR.
  return matchDetails
}

function getTopMostPlayer(team, pitchHeight) {
  let player = team.players.find(common.isOnPitch) || team.players[0]
  let topMostPosition = pitchHeight
  for (const thisPlayer of team.players) {
    if (!common.isOnPitch(thisPlayer)) continue
    if (thisPlayer.currentPOS[1] < topMostPosition) {
      topMostPosition = thisPlayer.currentPOS[1]
      player = thisPlayer
    }
  }
  return player
}

function getBottomMostPlayer(team) {
  let player = team.players.find(common.isOnPitch) || team.players[0]
  let btmMostPosition = 0
  for (const thisPlayer of team.players) {
    if (!common.isOnPitch(thisPlayer)) continue
    if (thisPlayer.currentPOS[1] > btmMostPosition) {
      btmMostPosition = thisPlayer.currentPOS[1]
      player = thisPlayer
    }
  }
  return player
}

export function team1atBottom(team1, team2, pitchHeight) {
  const offT1Ypos = offsideYPOS(team2, 'top', pitchHeight)
  const topPlayer = getTopMostPlayer(team1, pitchHeight)
  const topPlayerOffsidePosition = common.isBetween(topPlayer.currentPOS[1], offT1Ypos.pos1, offT1Ypos.pos2)
  if (topPlayerOffsidePosition && topPlayer.hasBall) return
  for (const thisPlayer of team1.players) {
    if (thisPlayer.offsideSnapshot) continue
    thisPlayer.offside = false
    if (!common.isOnPitch(thisPlayer)) continue
    if (common.isBetween(thisPlayer.currentPOS[1], offT1Ypos.pos1, offT1Ypos.pos2)) {
      if (!thisPlayer.hasBall) thisPlayer.offside = true
    }
  }
  const offT2Ypos = offsideYPOS(team1, 'bottom', pitchHeight)
  const btmPlayer = getBottomMostPlayer(team2)
  const btmPlayerOffsidePosition = common.isBetween(btmPlayer.currentPOS[1], offT2Ypos.pos2, offT2Ypos.pos1)
  if (btmPlayerOffsidePosition && btmPlayer.hasBall) return
  for (const thisPlayer of team2.players) {
    if (thisPlayer.offsideSnapshot) continue
    thisPlayer.offside = false
    if (!common.isOnPitch(thisPlayer)) continue
    if (common.isBetween(thisPlayer.currentPOS[1], offT2Ypos.pos2, offT2Ypos.pos1)) {
      if (!thisPlayer.hasBall) thisPlayer.offside = true
    }
  }
}

export function team1atTop(team1, team2, pitchHeight) {
  const offT1Ypos = offsideYPOS(team2, 'bottom', pitchHeight)
  const btmPlayer = getBottomMostPlayer(team1)
  const btmPlayerOffsidePosition = common.isBetween(btmPlayer.currentPOS[1], offT1Ypos.pos2, offT1Ypos.pos1)
  if (btmPlayerOffsidePosition && btmPlayer.hasBall) return
  for (const thisPlayer of team1.players) {
    if (thisPlayer.offsideSnapshot) continue
    thisPlayer.offside = false
    if (!common.isOnPitch(thisPlayer)) continue
    if (common.isBetween(thisPlayer.currentPOS[1], offT1Ypos.pos2, offT1Ypos.pos1)) {
      if (!thisPlayer.hasBall) thisPlayer.offside = true
    }
  }
  const offT2Ypos = offsideYPOS(team1, 'top', pitchHeight)
  const topPlayer = getTopMostPlayer(team2, pitchHeight)
  const topPlayerOffsidePosition = common.isBetween(topPlayer.currentPOS[1], offT2Ypos.pos1, offT2Ypos.pos2)
  if (topPlayerOffsidePosition && topPlayer.hasBall) return
  for (const thisPlayer of team2.players) {
    if (thisPlayer.offsideSnapshot) continue
    thisPlayer.offside = false
    if (!common.isOnPitch(thisPlayer)) continue
    if (common.isBetween(thisPlayer.currentPOS[1], offT2Ypos.pos1, offT2Ypos.pos2)) {
      if (!thisPlayer.hasBall) thisPlayer.offside = true
    }
  }
}

function offsideYPOS(team, side, pitchHeight) {
  const offsideY = {
    pos1: 0,
    pos2: pitchHeight / 2
  }
  for (const thisPlayer of team.players) {
    if (!common.isOnPitch(thisPlayer)) continue
    if (thisPlayer.position === 'GK') {
      const [, position1] = thisPlayer.currentPOS
      offsideY.pos1 = position1
      if (thisPlayer.hasBall) {
        offsideY.pos2 = position1
        return offsideY
      }
    } else if (side === 'top') {
      if (thisPlayer.currentPOS[1] < offsideY.pos2) {
        offsideY.pos2 = thisPlayer.currentPOS[1]
      }
    } else if (side === 'bottom') {
      if (thisPlayer.currentPOS[1] > offsideY.pos2) {
        offsideY.pos2 = thisPlayer.currentPOS[1]
      }
    }
  }
  return offsideY
}

/**
 * Resuelve la separación física / repulsión mutua entre jugadores para evitar que
 * los círculos se superpongan o amontonen (especialmente en saques laterales,
 * pelotas paradas, rechazos y disputas en el centro del campo).
 */
export function resolveMutualPlayerSeparation(matchDetails) {
  if (!matchDetails || !matchDetails.kickOffTeam || !matchDetails.secondTeam) return
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  const onPitchPlayers = []

  for (const p of matchDetails.kickOffTeam.players) {
    if (common.isOnPitch(p)) {
      onPitchPlayers.push({ player: p, teamID: matchDetails.kickOffTeam.teamID, isGK: p.position === 'GK' })
    }
  }
  for (const p of matchDetails.secondTeam.players) {
    if (common.isOnPitch(p)) {
      onPitchPlayers.push({ player: p, teamID: matchDetails.secondTeam.teamID, isGK: p.position === 'GK' })
    }
  }

  const n = onPitchPlayers.length
  if (n < 2) return

  // 2 pasadas de relajación elástica para distribución natural y estable
  for (let iter = 0; iter < 2; iter++) {
    for (let i = 0; i < n; i++) {
      const p1Obj = onPitchPlayers[i]
      const p1 = p1Obj.player
      for (let j = i + 1; j < n; j++) {
        const p2Obj = onPitchPlayers[j]
        const p2 = p2Obj.player

        let dx = p1.currentPOS[0] - p2.currentPOS[0]
        let dy = p1.currentPOS[1] - p2.currentPOS[1]
        let dist = Math.hypot(dx, dy)

        // Distancia mínima requerida entre centros de los círculos (dot radius = 15.5px)
        // Entre compañeros de equipo: 18px (para que se distingan los números y camisetas)
        // Entre rivales: 13px (permite disputa cuerpo a cuerpo dentro de challengeRadius = 22 sin fusionarse)
        // Con el arquero: 24px
        const sameTeam = p1Obj.teamID === p2Obj.teamID
        const hasGK = p1Obj.isGK || p2Obj.isGK
        const minDist = hasGK ? 24 : (sameTeam ? 18 : 13)

        if (dist < minDist) {
          if (dist === 0) {
            dx = (p1.shirtNumber % 2 === 0 ? 1 : -1) * 3
            dy = (p2.shirtNumber % 2 === 0 ? 1 : -1) * 3
            dist = Math.hypot(dx, dy)
          }

          const overlap = minDist - dist
          const pushX = (dx / dist) * overlap * 0.5
          const pushY = (dy / dist) * overlap * 0.5

          p1.currentPOS[0] = Math.max(10, Math.min(pitchWidth - 10, Math.round(p1.currentPOS[0] + pushX)))
          p1.currentPOS[1] = Math.max(10, Math.min(pitchHeight - 10, Math.round(p1.currentPOS[1] + pushY)))

          p2.currentPOS[0] = Math.max(10, Math.min(pitchWidth - 10, Math.round(p2.currentPOS[0] - pushX)))
          p2.currentPOS[1] = Math.max(10, Math.min(pitchHeight - 10, Math.round(p2.currentPOS[1] - pushY)))

          if (p1.hasBall && matchDetails.ball?.Player === p1.playerID) {
            matchDetails.ball.position[0] = p1.currentPOS[0]
            matchDetails.ball.position[1] = p1.currentPOS[1]
          } else if (p2.hasBall && matchDetails.ball?.Player === p2.playerID) {
            matchDetails.ball.position[0] = p2.currentPOS[0]
            matchDetails.ball.position[1] = p2.currentPOS[1]
          }
        }
      }
    }
  }
}

````
