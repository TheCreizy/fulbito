import * as common from './common.js'
import * as setPositions from './setPositions.js'
import { getPlayStyleConfig } from '../data/formations.js'

export function selectAction(possibleActions) {
  let goodActions = []
  for (const thisAction of possibleActions) {
    const pts = Math.max(0, Math.round(thisAction.points || 0))
    const tempArray = Array(pts).fill(thisAction.name)
    goodActions = goodActions.concat(tempArray)
  }
  if (goodActions[0] == null) return 'wait'
  return goodActions[common.getRandomNumber(0, goodActions.length - 1)]
}

export function findPossActions(player, team, opposition, ballX, ballY, matchDetails) {
  const possibleActions = populateActionsJSON()
  let params = []
  const { hasBall } = player
  const ballZ = matchDetails.ball.position[2] || 0
  if (hasBall === false) {
    params = playerDoesNotHaveBall(player, ballX, ballY, ballZ, matchDetails)
  } else {
    params = evaluateCarrierDecision(matchDetails, player, team, opposition)
  }
  return populatePossibleActions(possibleActions, player, matchDetails, ...params)
}

function pointToSegmentDist2D(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2
  if (l2 === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2)
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2
  t = Math.max(0.08, Math.min(0.95, t))
  const projX = x1 + t * (x2 - x1)
  const projY = y1 + t * (y2 - y1)
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2)
}

export function scanCarrierEnvironment(matchDetails, player, team, opposition) {
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  const isTopTeam = player.originPOS[1] < (pitchHeight / 2)
  const dir = isTopTeam ? 1 : -1
  const curX = player.currentPOS[0]
  const curY = player.currentPOS[1]
  const goalY = isTopTeam ? pitchHeight : 0
  const distToGoalY = isTopTeam ? (pitchHeight - curY) : curY

  let nearestOppDist = 999
  let nearestOppAheadDist = 999
  let nearestOutfieldOppAheadDist = 999
  let nearbyOppsCount = 0
  let shotBlocked = false

  const oppPlayers = opposition?.players || []
  for (const opp of oppPlayers) {
    if (!common.isOnPitch(opp) || (opp.stunnedTicks || 0) > 0) continue
    const d = common.distance(player.currentPOS, opp.currentPOS)
    if (d < nearestOppDist) nearestOppDist = d
    if (d < 24) nearbyOppsCount++

    const forwardDelta = (opp.currentPOS[1] - curY) * dir
    const lateralDelta = Math.abs(opp.currentPOS[0] - curX)
    if (forwardDelta > -5 && lateralDelta <= Math.max(26, forwardDelta * 0.92)) {
      if (d < nearestOppAheadDist) nearestOppAheadDist = d
      if (opp.position !== 'GK' && d < nearestOutfieldOppAheadDist) {
        nearestOutfieldOppAheadDist = d
      }
    }

    if (opp.position !== 'GK' && d < 65) {
      const segDist = pointToSegmentDist2D(opp.currentPOS[0], opp.currentPOS[1], curX, curY, pitchWidth / 2, goalY)
      if (segDist < 13 && forwardDelta > 0) {
        shotBlocked = true
      }
    }
  }

  const currentIter = matchDetails.iterationCount || 0
  let hasRunnerInBehind = false
  let hasSwitchOption = false
  let hasBetterPositionedMate = false
  let hasBoxTarget = false
  let hasCutbackOption = false

  const teamPlayers = team?.players || []
  for (const mate of teamPlayers) {
    if (!common.isOnPitch(mate) || mate.playerID === player.playerID || mate.offside) continue
    const mX = mate.currentPOS[0]
    const mY = mate.currentPOS[1]
    const passDist = common.distance(player.currentPOS, mate.currentPOS)
    if (passDist < 24 || passDist > pitchHeight * 0.52) continue

    const forwardGain = (mY - curY) * dir
    let minOppToMate = 999
    let laneBlocked = false
    for (const opp of oppPlayers) {
      if (!common.isOnPitch(opp) || (opp.stunnedTicks || 0) > 0) continue
      const od = common.distance(mate.currentPOS, opp.currentPOS)
      if (od < minOppToMate) minOppToMate = od
      const sd = pointToSegmentDist2D(opp.currentPOS[0], opp.currentPOS[1], curX, curY, mX, mY)
      if (sd < 12) laneBlocked = true
    }

    const isActivelyRunning = !!(mate.offBallRun && mate.offBallRun.untilIteration > currentIter)
    if (!laneBlocked && forwardGain >= 28 && (isActivelyRunning || minOppToMate > 36)) {
      hasRunnerInBehind = true
    }
    if (!laneBlocked && forwardGain >= 42 && minOppToMate > 28) {
      hasBetterPositionedMate = true
    }
    if (Math.abs(mX - curX) >= 230 && (mX < 185 || mX > pitchWidth - 185) && minOppToMate > 38 && forwardGain > -35) {
      hasSwitchOption = true
    }
    const mateDistToGoalY = isTopTeam ? (pitchHeight - mY) : mY
    if (mateDistToGoalY < 165 && mX >= 195 && mX <= (pitchWidth - 195)) {
      hasBoxTarget = true
    }

    // Detección de Cutback (open-football model: pase de la muerte atrás a 45° a la medialuna o punto penal)
    const isCarrierWideInAttackingThird = distToGoalY < 185 && (curX < 185 || curX > pitchWidth - 185)
    if (isCarrierWideInAttackingThird) {
      const isCutbackZone = mateDistToGoalY >= 80 && mateDistToGoalY <= 195 && mX >= 210 && mX <= (pitchWidth - 210)
      if (!laneBlocked && isCutbackZone && forwardGain <= 20 && forwardGain >= -110) {
        hasCutbackOption = true
      }
    }
  }

  const inCentralLane = Math.abs(curX - pitchWidth / 2) <= 150
  const hasOpenRunway = inCentralLane && distToGoalY < 380 &&
    (nearestOutfieldOppAheadDist > 60 || nearestOutfieldOppAheadDist === 999) &&
    nearestOppDist > 22

  return {
    isTopTeam,
    dir,
    distToGoalY,
    nearestOppDist,
    nearestOppAheadDist,
    nearestOutfieldOppAheadDist,
    hasOpenRunway,
    nearbyOppsCount,
    shotBlocked,
    hasRunnerInBehind,
    hasSwitchOption,
    hasBetterPositionedMate,
    hasBoxTarget,
    hasCutbackOption
  }
}

export function evaluateCarrierDecision(matchDetails, player, team, opposition) {
  const env = scanCarrierEnvironment(matchDetails, player, team, opposition)
  const baseDecision = computeBaseCarrierDecision(matchDetails, player, team, opposition, env)
  return applyCoachDirectivesToDecision(baseDecision, team, env, player)
}

function applyCoachDirectivesToDecision(decision, team, env, player) {
  if (player?.position === 'GK') return decision
  const coachCoeffs = team?.coachState?.coefficients
  if (!coachCoeffs) return decision

  const res = [...decision]
  // 1. Modulación de remate por shootingReluctance (open-football model)
  if (coachCoeffs.shootingReluctance > 0) {
    if (res[0] > 0 && env.distToGoalY > 95) {
      const reduction = Math.round(res[0] * coachCoeffs.shootingReluctance)
      res[0] = Math.max(0, res[0] - reduction)
      res[2] += Math.round(reduction * 0.7) // Pase de circulación
      res[7] += Math.round(reduction * 0.3) // Mantener / esperar
    }
  } else if (coachCoeffs.shootingReluctance < 0) {
    if (env.distToGoalY < 260 && !env.shotBlocked) {
      const shootBoost = Math.abs(Math.round(coachCoeffs.shootingReluctance * 30))
      res[0] += shootBoost
      if (res[2] >= shootBoost) res[2] -= shootBoost
    }
  }

  // 2. Modulación de pases seguros vs verticalidad por backwardPassPreference
  if (coachCoeffs.backwardPassPreference > 0) {
    if (res[8] > 12) {
      const transfer = Math.round(res[8] * Math.min(0.55, coachCoeffs.backwardPassPreference * 0.65))
      res[8] -= transfer
      res[2] += Math.round(transfer * 0.7)
      res[7] += Math.round(transfer * 0.3)
    }
  } else if (coachCoeffs.backwardPassPreference < 0) {
    if (res[2] > 20 && env.distToGoalY < 360) {
      const verticalPush = Math.round(res[2] * Math.abs(coachCoeffs.backwardPassPreference) * 0.45)
      res[2] -= verticalPush
      res[8] += Math.round(verticalPush * 0.6)
      res[1] += Math.round(verticalPush * 0.4)
    }
  }

  return res
}

function computeBaseCarrierDecision(matchDetails, player, team, opposition, env) {
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  const { position, currentPOS, skill } = player
  const role = player.tacticalRole || position
  const styleCfg = getPlayStyleConfig(team?.playStyle, team?.formation)
  const carrierTicks = (matchDetails.ball.lastCarrierID === player.playerID) ? (matchDetails.ball.carrierTicks || 1) : 1

  const hasTrait = (t) => Array.isArray(player.traits) && player.traits.includes(t)
  const isEncarador = hasTrait('fenomeno_encarador') || hasTrait('playmaker_gambeteador')
  const isVelocista = hasTrait('velocista_banda')
  const isOrganizador = hasTrait('organizador_mediocampo')
  const isLanzador = hasTrait('lanzador_canonero') || hasTrait('canonero_media_distancia')
  const isArtillero = hasTrait('artillero_area')
  const isStriker = role === 'ST' || player.position === 'ST'
  const isOffensive = team?.mentality === 'offensive'
  const isDefensive = team?.mentality === 'defensive'

  // 1. Arquero con pelota
  if (position === 'GK') {
    if (env.nearestOppDist < 28) return [0, 0, 35, 0, 0, 0, 0, 0, 0, 35, 30]
    return [0, 12, 74, 0, 0, 0, 0, 6, 0, 8, 0]
  }

  // 2. Límites de córner
  if (onBottomCornerBoundary(currentPOS, pitchWidth, pitchHeight) || onTopCornerBoundary(currentPOS, pitchWidth)) {
    return [0, 0, 22, 78, 0, 0, 0, 0, 0, 0, 0]
  }

  // 2.5 Devolución de Pared ("One-Two Wall Pass"): el socio de la pared devuelve de primera
  if (
    matchDetails.wallPass &&
    matchDetails.wallPass.wallPartnerID === player.playerID &&
    (matchDetails.iterationCount || 0) <= matchDetails.wallPass.expireIter
  ) {
    return [0, 85, 15, 0, 0, 0, 0, 0, 0, 0, 0]
  }

  const inWideChannel = currentPOS[0] < 168 || currentPOS[0] > (pitchWidth - 168)
  const inCentralCorridor = currentPOS[0] >= 185 && currentPOS[0] <= (pitchWidth - 185)
  const dribbleSkill = ((Number(skill.agility) || 70) + (Number(skill.control) || 70)) / 2

  // 2.6 CANAL LIBRE / SUPERÓ A LOS RIVALES (MANO A MANO HACIA EL GOL)
  // Si el portador tiene el espacio libre adelante o superó a la línea defensiva,
  // NO tocar atrás ni al costado: sprint decidido directo al área/arco rival y tiro
  if (env.hasOpenRunway && position !== 'GK') {
    if (env.distToGoalY <= 170 && inCentralCorridor) {
      return [92, 0, 0, 0, 0, 0, 0, 0, 8, 0, 0]
    }
    return [0, 0, 0, 0, 0, 0, 0, 8, 92, 0, 0]
  }

  // 3. Desborde por las Bandas, Circulación y Centros al Área
  if (inWideChannel && env.distToGoalY < 260) {
    // Si todavía está en tres cuartos de banda (175px a 260px):
    if (env.distToGoalY > 175) {
      const earlyCross = env.hasBoxTarget && env.distToGoalY < 220 ? Math.round(34 * styleCfg.crossBoost) : 8
      if (env.nearestOppAheadDist > 22) {
        // Espacio libre adelante por la banda: avanzar hacia la zona de centro o asociarse
        const wingAdvance = (isVelocista || styleCfg.id === 'wingPlay') ? 52 : 44
        const passInside = 32
        const throughCut = env.hasRunnerInBehind ? 16 : 6
        return [0, throughCut, passInside, earlyCross, 0, 0, 0, 14, wingAdvance, 0, 0]
      }
      // Marcador encima en banda: tocar adentro al medio/lateral, meter gambeta o cambio
      const passInside = (env.hasBetterPositionedMate || env.hasSwitchOption) ? 52 : 42
      const gambetaPts = (dribbleSkill >= 78 || isVelocista) ? Math.round(32 * styleCfg.gambetaBoost) : 16
      const throughCut = env.hasRunnerInBehind ? 18 : 6
      return [0, throughCut, passInside, earlyCross, 0, 0, 0, 10, gambetaPts, 0, 0]
    }

    // Ya en el último tercio de la banda (distToGoalY <= 175px):
    if (env.distToGoalY > 120 && env.nearestOppAheadDist > 20) {
      const crossWeight = Math.round((env.hasBoxTarget ? 68 : 48) * styleCfg.crossBoost)
      const passCutback = 22
      const wingDrive = 26
      const gambetaPts = (dribbleSkill >= 80 || isVelocista) ? Math.round(18 * styleCfg.gambetaBoost) : 8
      return [0, 4, passCutback, crossWeight, 0, 0, 0, 6, wingDrive, 0, 0]
    }

    // Zona de fondo (distToGoalY <= 120px) o marcador cerrando el paso:
    // CENTRO AL ÁREA o pase de la muerte (CUTBACK) hacia la medialuna; NUNCA sprint hacia la raya
    const crossWeight = Math.round((env.hasBoxTarget ? 88 : 74) * styleCfg.crossBoost)
    const cutbackPts = env.hasCutbackOption ? 88 : 24
    if (env.hasCutbackOption) {
      return [0, 4, cutbackPts, 40, 0, 0, 0, 4, 0, 0, 0]
    }
    return [0, 2, cutbackPts, crossWeight, 0, 0, 0, 4, 0, 0, 0]
  }

  // 4. Dentro del Área Rival y Borde Interno (Definición Realista)
  if (env.distToGoalY <= 178 && inCentralCorridor) {
    if (env.distToGoalY <= 105) {
      return [94, 0, 3, 0, 0, 0, 0, 0, 3, 0, 0]
    }
    if (!env.shotBlocked) {
      const shootPts = (skill.shooting >= 80 || isArtillero) ? 88 : 74
      return [shootPts, 3, 5, 0, 0, 0, 0, 2, 10, 0, 0]
    }
    const passToOpenMate = env.hasBetterPositionedMate || env.hasRunnerInBehind ? 30 : 18
    const dribbleInBox = (isEncarador || dribbleSkill >= 85) ? 44 : Math.round(28 * styleCfg.gambetaBoost)
    return [48, 6, passToOpenMate, 0, 0, 0, 0, 2, dribbleInBox, 0, 0]
  }

  // 5. Puerta del Área / Medialuna (distToGoalY entre 179px y 240px)
  if (env.distToGoalY > 178 && env.distToGoalY <= 240) {
    let edgeShootPts = 0
    if (inCentralCorridor && !env.shotBlocked && (skill.shooting >= 78 || isLanzador)) {
      edgeShootPts = (skill.shooting >= 87 || isLanzador) ? 44 : 26
      if (styleCfg.id === 'tikiTaka' && !isLanzador) edgeShootPts = Math.round(edgeShootPts * 0.72)
    }

    // Encaradores y 9s (Ronaldo Nazário, Agüero, Messi): prioridad absoluta a romper líneas hacia el área
    if ((isEncarador || isStriker) && env.nearbyOppsCount <= 1) {
      return [edgeShootPts, env.hasRunnerInBehind ? 16 : 6, 8, 0, 0, 0, 0, 8, 74, 0, 0]
    }

    if (env.nearestOppAheadDist > 32 && env.nearestOppDist > 20) {
      const throughPts = env.hasRunnerInBehind ? Math.round(22 * styleCfg.throughBoost) : 8
      const switchPts = env.hasSwitchOption ? Math.round(14 * styleCfg.switchBoost) : 6
      return [edgeShootPts, throughPts, switchPts, 0, 0, 0, 0, 10, 60, 0, 0]
    }

    const gambetaPts = (env.nearbyOppsCount <= 1 && (dribbleSkill >= 78 || isEncarador)) ? Math.round(42 * styleCfg.gambetaBoost) : 16
    const throughPts = env.hasRunnerInBehind ? Math.round(28 * styleCfg.throughBoost) : 12
    const passPts = (env.hasSwitchOption || env.hasBetterPositionedMate) ? 26 : 18
    return [edgeShootPts, throughPts, passPts, inWideChannel ? 24 : 4, 0, 0, 0, 6, gambetaPts, 0, 0]
  }

  // 6. Resto del Campo
  let rareLongShot = 0
  // Cañonazo de especialistas (Verón, Roberto Carlos, Cata Díaz, Franco Sosa, Riquelme)
  if (env.distToGoalY <= 268 && inCentralCorridor && !env.shotBlocked && env.nearestOppDist > 26) {
    if (isLanzador && skill.shooting >= 78) rareLongShot = 22
    else if (skill.shooting >= 91) rareLongShot = 8
  }

  // Zona de tres cuartos (241px a 345px): Solo encaradores natos o delanteros de desequilibrio (Ronaldo Nazário, Agüero, Messi)
  const canSoloEncarar = isEncarador || (isStriker && dribbleSkill >= 84 && !isArtillero)
  if (env.distToGoalY > 240 && env.distToGoalY <= 345 && canSoloEncarar && !isDefensive) {
    if (env.nearbyOppsCount <= 1 && env.nearestOppAheadDist > 26) {
      const throughCut = env.hasRunnerInBehind ? 14 : 4
      const encararSprint = 72
      return [rareLongShot, throughCut, 8, 0, 0, 0, 0, 8, encararSprint, 0, 0]
    }
  }

  // 9 de Área o delantero clásico en mitad de cancha (distToGoalY > 240):
  // Si está marcado o tiene defensores adelante, PISAR LA PELOTA, aguantar y descargar corto a los costados o atrás
  if (isStriker && env.distToGoalY > 240) {
    if (env.nearestOppAheadDist < 42 || env.nearbyOppsCount >= 1) {
      const layoffPass = env.hasBetterPositionedMate || env.hasSwitchOption ? 68 : 58
      const throughWeight = env.hasRunnerInBehind ? 22 : 12
      return [0, throughWeight, layoffPass, 0, 0, 0, 0, 14, 6, 0, 0]
    }
  }

  // Transición ofensiva rápida (open-football AttackingTransition model o MENTALIDAD DEFENSIVA):
  // Robar y lanzar verticalmente o cambiar de frente al compañero con ventaja
  if ((team?.gamePhase === 'AttackingTransition' || isDefensive) && env.distToGoalY > 260) {
    if (env.hasRunnerInBehind) {
      return [0, 58, 26, 0, 0, 0, 0, 6, 10, 0, 0]
    }
    if (env.hasSwitchOption) {
      return [0, 18, 66, 0, 0, 0, 0, 6, 10, 0, 0]
    }
  }

  // Enganche / Mediapunta (CAM) u Organizador del mediocampo (Riquelme, Gago, Xavi, Redondo):
  // Gran visión de juego: toque asociativo, cambios de frente, pases filtrados y paredes
  if (role === 'CAM' || isOrganizador) {
    const throughWeight = env.hasRunnerInBehind ? Math.round(38 * styleCfg.throughBoost) : 18
    const passWeight = (env.hasSwitchOption || env.hasBetterPositionedMate)
      ? Math.round(52 * styleCfg.switchBoost)
      : 48
    const gambetaWeight = dribbleSkill >= 82 ? 18 : 8
    return [rareLongShot, throughWeight, passWeight, 0, 0, 0, 0, 12, gambetaWeight, 0, 0]
  }

  // Salida y Gestación Paciente desde Abajo (open-football BuildUp phase o distToGoalY > 360):
  // Si enfrente está cerrado (nearestOppAheadDist < 40) y no hay desmarque al espacio,
  // tocar en equipo con centrales, laterales o arquero para encontrar el hueco sin apuro
  if ((team?.gamePhase === 'BuildUp' || env.distToGoalY > 360) && env.nearestOppAheadDist < 40 && !env.hasRunnerInBehind) {
    const circulatePass = env.hasSwitchOption ? 58 : 72
    const switchOrThrough = env.hasSwitchOption ? 22 : 8
    return [0, switchOrThrough, circulatePass, 0, 0, 0, 0, 14, 6, 0, 0]
  }

  // Si acaba de recibir la pelota (carrierTicks <= 2) y no tiene un rival encima, controla y conduce
  if (carrierTicks <= 2 && env.nearestOppDist > 18) {
    const instantBreakawayPass = (env.hasRunnerInBehind && (styleCfg.id === 'directCounter' || isDefensive)) ? 22 : 4
    return [0, instantBreakawayPass, 4, 0, 0, 0, 0, 24, 68, 0, 0]
  }

  // Si tiene espacio libre adelante (nearestOppAheadDist > 34 y nearestOppDist > 20), avanza con la pelota
  if (env.nearestOppAheadDist > 34 && env.nearestOppDist > 20) {
    let throughInStride = 0
    let passInStride = 6
    if (env.hasRunnerInBehind && carrierTicks >= 3) {
      throughInStride = Math.round(24 * styleCfg.throughBoost)
    }
    if (env.hasSwitchOption && carrierTicks >= 4) {
      passInStride = Math.round((isLanzador ? 32 : 18) * styleCfg.switchBoost)
    } else if (env.hasBetterPositionedMate && carrierTicks >= 5) {
      passInStride = 16
    }
    const carrySprint = Math.max(48, 86 - throughInStride - passInStride)
    return [rareLongShot, throughInStride, passInStride, 0, 0, 0, 0, 12, carrySprint, 0, 0]
  }

  // Duelo 1v1 o presión cercana: Gambeta 1v1, Cambio de Frente, Pase Filtrado o Conducción
  const isDribblerRole = ['CAM', 'LM', 'RM', 'ST'].includes(role) || dribbleSkill >= 80 || isEncarador
  if (env.nearbyOppsCount <= 1 && isDribblerRole && env.nearestOppDist >= 13) {
    const gambetaWeight = Math.round((dribbleSkill >= 85 || isEncarador ? 52 : 38) * styleCfg.gambetaBoost)
    const throughWeight = env.hasRunnerInBehind ? Math.round(24 * styleCfg.throughBoost) : 10
    const passWeight = env.hasSwitchOption
      ? Math.round(26 * styleCfg.switchBoost)
      : (env.hasBetterPositionedMate ? 24 : 16)
    return [rareLongShot, throughWeight, passWeight, 0, 0, 0, 0, 8, gambetaWeight, 0, 0]
  }

  const inOwnThird = env.distToGoalY > (pitchHeight * 0.72)
  const clearanceWeight = (inOwnThird && env.nearestOppDist < 15 && !env.hasBetterPositionedMate) ? 14 : 0
  const throughWeight = env.hasRunnerInBehind ? Math.round(26 * styleCfg.throughBoost) : 8
  const passWeight = env.hasSwitchOption
    ? Math.round(48 * styleCfg.switchBoost)
    : 46
  return [rareLongShot, throughWeight, passWeight, 0, 0, 0, 0, 14, 14, clearanceWeight, 0]
}

export function topTeamPlayerHasBall(matchDetails, player, team, opposition) {
  return evaluateCarrierDecision(matchDetails, player, team, opposition)
}

export function bottomTeamPlayerHasBall(matchDetails, player, team, opposition) {
  return evaluateCarrierDecision(matchDetails, player, team, opposition)
}

export function oppositionNearPlayer(oppositionPlayer, spaceX, spaceY) {
  if (!oppositionPlayer || !oppositionPlayer.proxPOS) return false
  const oppositionProximity = [Math.abs(oppositionPlayer.proxPOS[0]), Math.abs(oppositionPlayer.proxPOS[1])]
  return !!(oppositionProximity[0] < spaceX && oppositionProximity[1] < spaceY)
}

export function checkTeamMateSpaceClose(tmateProximity, lowX, highX, lowY, highY) {
  return !!(common.isBetween(tmateProximity[0], lowX, highX) && common.isBetween(tmateProximity[1], lowY, highY))
}

export function checkOppositionAhead(closePlayerPosition, currentPOS) {
  const closePlyX = common.isBetween(closePlayerPosition[0], currentPOS[0] - 4, currentPOS[0] + 4)
  return !!(closePlyX && closePlayerPosition[1] < currentPOS[1])
}

export function checkOppositionBelow(closePlayerPosition, currentPOS) {
  const closePlyX = common.isBetween(closePlayerPosition[0], currentPOS[0] - 4, currentPOS[0] + 4)
  return !!(closePlyX && closePlayerPosition[1] > currentPOS[1])
}

export function playerDoesNotHaveBall(player, ballX, ballY, ballZ, matchDetails) {
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  const { position, currentPOS, originPOS } = player
  if (position === 'GK') return [0, 0, 0, 0, 0, 0, 0, 60, 40, 0, 0]
  if (common.isBetween(ballX, -20, 20) && common.isBetween(ballY, -20, 20)) {
    return noBallNotGK2CloseBall(matchDetails, currentPOS, originPOS, pitchWidth, pitchHeight)
  }
  if (common.isBetween(ballX, -40, 40) && common.isBetween(ballY, -40, 40)) {
    return noBallNotGK4CloseBall(matchDetails, currentPOS, originPOS, pitchWidth, pitchHeight)
  }
  if (common.isBetween(ballX, -80, 80) && common.isBetween(ballY, -80, 80)) {
    if (matchDetails.ball.withPlayer === false) return [0, 0, 0, 0, 0, 0, 0, 60, 40, 0, 0]
    return [0, 0, 0, 0, 0, 40, 0, 30, 30, 0, 0]
  }
  return [0, 0, 0, 0, 0, 10, 0, 50, 30, 0, 0]
}

export function noBallNotGK4CloseBall(matchDetails, currentPOS, originPOS, pitchWidth, pitchHeight) {
  if (originPOS[1] > (pitchHeight / 2)) {
    return noBallNotGK4CloseBallBottomTeam(matchDetails, currentPOS, pitchWidth, pitchHeight)
  }
  if (checkPositionInTopPenaltyBox(currentPOS, pitchWidth, pitchHeight)) {
    if (matchDetails.ball.withPlayer === false) return [0, 0, 0, 0, 0, 0, 0, 20, 80, 0, 0]
    return [0, 0, 0, 0, 28, 22, 6, 14, 30, 0, 0]
  }
  if (matchDetails.ball.withPlayer === false) return [0, 0, 0, 0, 0, 0, 0, 20, 80, 0, 0]
  return [0, 0, 0, 0, 26, 34, 8, 16, 16, 0, 0]
}

export function noBallNotGK4CloseBallBottomTeam(matchDetails, currentPOS, pitchWidth, pitchHeight) {
  if (checkPositionInBottomPenaltyBox(currentPOS, pitchWidth, pitchHeight)) {
    if (matchDetails.ball.withPlayer === false) return [0, 0, 0, 0, 0, 0, 0, 20, 80, 0, 0]
    return [0, 0, 0, 0, 28, 22, 6, 14, 30, 0, 0]
  }
  if (matchDetails.ball.withPlayer === false) return [0, 0, 0, 0, 0, 0, 0, 20, 80, 0, 0]
  return [0, 0, 0, 0, 26, 34, 8, 16, 16, 0, 0]
}

export function noBallNotGK2CloseBall(matchDetails, currentPOS, originPOS, pitchWidth, pitchHeight) {
  if (originPOS[1] > (pitchHeight / 2)) {
    return noBallNotGK2CloseBallBottomTeam(matchDetails, currentPOS, pitchWidth, pitchHeight)
  }
  if (checkPositionInTopPenaltyBox(currentPOS, pitchWidth, pitchHeight)) {
    if (matchDetails.ball.withPlayer === false) return [0, 0, 0, 0, 0, 0, 0, 20, 80, 0, 0]
    return [0, 0, 0, 0, 42, 18, 6, 14, 20, 0, 0]
  }
  if (matchDetails.ball.withPlayer === false) return [0, 0, 0, 0, 0, 0, 0, 20, 80, 0, 0]
  return [0, 0, 0, 0, 56, 22, 10, 6, 6, 0, 0]
}

export function noBallNotGK2CloseBallBottomTeam(matchDetails, currentPOS, pitchWidth, pitchHeight) {
  if (checkPositionInBottomPenaltyBox(currentPOS, pitchWidth, pitchHeight)) {
    if (matchDetails.ball.withPlayer === false) return [0, 0, 0, 0, 0, 0, 0, 20, 80, 0, 0]
    return [0, 0, 0, 0, 44, 18, 6, 16, 16, 0, 0]
  }
  if (matchDetails.ball.withPlayer === false) return [0, 0, 0, 0, 0, 0, 0, 20, 80, 0, 0]
  return [0, 0, 0, 0, 56, 22, 10, 6, 6, 0, 0]
}

export function checkPositionInBottomPenaltyBox(position, pitchWidth, pitchHeight) {
  const yPos = common.isBetween(position[0], (pitchWidth / 4) - 5, pitchWidth - (pitchWidth / 4) + 5)
  const xPos = common.isBetween(position[1], pitchHeight - (pitchHeight / 6) + 5, pitchHeight)
  return !!(yPos && xPos)
}

export function checkPositionInBottomPenaltyBoxClose(position, pitchWidth, pitchHeight) {
  const yPos = common.isBetween(position[0], (pitchWidth / 3) - 5, pitchWidth - (pitchWidth / 3) + 5)
  const xPos = common.isBetween(position[1], (pitchHeight - (pitchHeight / 12) + 5), pitchHeight)
  return !!(yPos && xPos)
}

export function checkPositionInTopPenaltyBox(position, pitchWidth, pitchHeight) {
  const xPos = common.isBetween(position[0], (pitchWidth / 4) - 5, pitchWidth - (pitchWidth / 4) + 5)
  const yPos = common.isBetween(position[1], 0, (pitchHeight / 6) - 5)
  return !!(yPos && xPos)
}

export function checkPositionInTopPenaltyBoxClose(position, pitchWidth, pitchHeight) {
  const xPos = common.isBetween(position[0], (pitchWidth / 3) - 5, pitchWidth - (pitchWidth / 3) + 5)
  const yPos = common.isBetween(position[1], 0, (pitchHeight / 12) - 5)
  return !!(yPos && xPos)
}

export function onBottomCornerBoundary(position, pitchWidth, pitchHeight) {
  return !!(position[1] === pitchHeight && (position[0] === 0 || position[0] === pitchWidth))
}

export function onTopCornerBoundary(position, pitchWidth) {
  return !!(position[1] === 0 && (position[0] === 0 || position[0] === pitchWidth))
}

export function populatePossibleActions(possibleActions, player, matchDetails, a, b, c, d, e, f, g, h, i, j, k) {
  // Delanteros y enganches presionan/interceptan mucho más de lo que se tiran a barrer
  const role = player.tacticalRole || player.position
  let tacklePts = e
  let interceptPts = f
  let slidePts = g
  let runPts = h
  if (role === 'ST' || role === 'CAM' || player.position === 'ST') {
    const shiftedFromTackle = Math.round(tacklePts * 0.58)
    const shiftedFromSlide = Math.round(slidePts * 0.85)
    tacklePts -= shiftedFromTackle
    slidePts -= shiftedFromSlide
    interceptPts += Math.round((shiftedFromTackle + shiftedFromSlide) * 0.6)
    runPts += Math.round((shiftedFromTackle + shiftedFromSlide) * 0.4)
  }
  // Jugador amonestado (con amarilla) se cuida muchísimo más al marcar para no hacerse expulsar
  if ((player.stats?.cards?.yellow || 0) > 0) {
    const cautiousSlide = Math.round(slidePts * 0.85)
    const cautiousTackle = Math.round(tacklePts * 0.40)
    slidePts -= cautiousSlide
    tacklePts -= cautiousTackle
    interceptPts += cautiousSlide + cautiousTackle
  }

  possibleActions[0].points = a
  possibleActions[1].points = b
  possibleActions[2].points = c
  possibleActions[3].points = d
  possibleActions[4].points = tacklePts
  possibleActions[5].points = interceptPts
  possibleActions[6].points = slidePts
  possibleActions[7].points = runPts
  possibleActions[8].points = i
  possibleActions[9].points = j
  possibleActions[10].points = k
  possibleActions = adjustForBallHeight(possibleActions, player, matchDetails)
  possibleActions = normaliseActionObjects(possibleActions)
  return possibleActions
}

function populateActionsJSON() {
  return [
    { name: 'shoot', points: 0 },
    { name: 'throughBall', points: 0 },
    { name: 'pass', points: 0 },
    { name: 'cross', points: 0 },
    { name: 'tackle', points: 0 },
    { name: 'intercept', points: 0 },
    { name: 'slide', points: 0 },
    { name: 'run', points: 0 },
    { name: 'sprint', points: 0 },
    { name: 'cleared', points: 0 },
    { name: 'boot', points: 0 }
  ]
}

function calculateFoulProbability(tackler, carrier, isSlide = false) {
  const role = tackler.tacticalRole || tackler.position
  if (role === 'ST' || tackler.position === 'ST') {
    return isSlide ? 10 : 4
  }
  const tacklerSkill = Number(tackler.skill?.tackling || 60)
  const tacklerPer = Number(tackler.skill?.perception || 60)
  const carrierAgi = Number(carrier.skill?.agility || 65)
  const fatiguePenalty = (Number(tackler.fitness ?? 100) < 50) ? 5 : 0
  const isCaudillo = Array.isArray(tackler.traits) && tackler.traits.includes('caudillo_fisico')
  const baseChance = isSlide ? 28 : 16
  const skillDiff = (carrierAgi - (tacklerSkill * 0.75 + tacklerPer * 0.25) - (isCaudillo ? 8 : 0)) * (isSlide ? 0.18 : 0.14)
  const minChance = isSlide ? 12 : 6
  const maxChance = isSlide ? 42 : 26
  return Math.max(minChance, Math.min(maxChance, Math.round(baseChance + skillDiff + fatiguePenalty)))
}

export function resolveTackle(player, team, opposition, matchDetails) {
  matchDetails.iterationLog.push(`Tackle attempted by: ${player.name}`)
  const tackleDetails = {
    injuryHigh: 1500,
    injuryLow: 1400,
    increment: 1
  }
  const index = opposition.players.findIndex(thisPlayer => thisPlayer.playerID === matchDetails.ball.Player)
  if (index === -1) return false
  const thatPlayer = opposition.players[index]
  player.stats.tackles.total++
  const foulProb = calculateFoulProbability(player, thatPlayer, false)
  if (common.getRandomNumber(1, 100) <= foulProb) {
    setFoul(matchDetails, team, player, thatPlayer)
    return true
  }
  if (calcTackleScore(player.skill, 5, player) > calcRetentionScore(thatPlayer.skill, 5)) {
    setSuccessTackle(matchDetails, team, opposition, player, thatPlayer, tackleDetails)
    return false
  }
  setFailedTackle(matchDetails, player, thatPlayer, tackleDetails)
  return false
}

export function resolveSlide(player, team, opposition, matchDetails) {
  matchDetails.iterationLog.push(`Slide tackle attempted by: ${player.name}`)
  const tackleDetails = {
    injuryHigh: 1500,
    injuryLow: 1400,
    increment: 3
  }
  const index = opposition.players.findIndex(thisPlayer => thisPlayer.playerID === matchDetails.ball.Player)
  if (index === -1) return false
  const thatPlayer = opposition.players[index]
  player.stats.tackles.total++
  const foulProb = calculateFoulProbability(player, thatPlayer, true)
  if (common.getRandomNumber(1, 100) <= foulProb) {
    setFoul(matchDetails, team, player, thatPlayer)
    return true
  }
  if (calcTackleScore(player.skill, 5, player) > calcRetentionScore(thatPlayer.skill, 5)) {
    setSuccessTackle(matchDetails, team, opposition, player, thatPlayer, tackleDetails)
    return false
  }
  setFailedTackle(matchDetails, player, thatPlayer, tackleDetails)
  return false
}

function setFailedTackle(matchDetails, player, thatPlayer, tackleDetails) {
  matchDetails.iterationLog.push(`Failed tackle by: ${player.name}`)
  player.stats.tackles.off++
  setInjury(matchDetails, player, thatPlayer, tackleDetails.injuryHigh, tackleDetails.injuryLow)
  setPostTacklePosition(matchDetails, thatPlayer, player, tackleDetails.increment)
}

function setSuccessTackle(matchDetails, team, opposition, player, thatPlayer, tackleDetails) {
  setPostTackleBall(matchDetails, team, opposition, player)
  const isCaudillo = Array.isArray(player.traits) && player.traits.includes('caudillo_fisico')
  if (isCaudillo) {
    player.lastCaudilloIter = matchDetails.iterationCount || 0
    matchDetails.iterationLog.push(`Caudillo tackle by: ${player.name} on ${thatPlayer.name}`)
    if (Array.isArray(matchDetails.events)) {
      matchDetails.events.push({
        type: 'caudilloTackle',
        teamID: team.teamID,
        teamName: team.name,
        playerName: player.name,
        victimName: thatPlayer.name,
        iteration: matchDetails.iterationCount || 0,
        half: matchDetails.half
      })
    }
  } else {
    matchDetails.iterationLog.push(`Successful tackle by: ${player.name}`)
  }
  player.stats.tackles.on++
  setInjury(matchDetails, thatPlayer, player, tackleDetails.injuryLow, tackleDetails.injuryHigh)
  setPostTacklePosition(matchDetails, player, thatPlayer, tackleDetails.increment)
}

export function calcTackleScore(skill, diff, player = null) {
  const isCaudillo = Array.isArray(player?.traits) && player.traits.includes('caudillo_fisico')
  const bonus = isCaudillo ? 7 : 0
  return ((parseInt(skill.tackling, 10) + parseInt(skill.strength, 10)) / 2) + bonus + common.getRandomNumber(-diff, diff)
}

export function calcRetentionScore(skill, diff) {
  return ((parseInt(skill.agility, 10) + parseInt(skill.strength, 10)) / 2) + common.getRandomNumber(-diff, diff)
}

export function setPostTackleBall(matchDetails, team, opposition, player) {
  player.hasBall = true
  matchDetails.ball.lastTouch.playerName = player.name
  matchDetails.ball.lastTouch.playerID = player.playerID
  matchDetails.ball.lastTouch.teamID = team.teamID
  matchDetails.ball.lastTouch.deflection = false
  matchDetails.ball.position = [player.currentPOS[0], player.currentPOS[1], 0]
  matchDetails.ball.Player = player.playerID
  matchDetails.ball.withPlayer = true
  matchDetails.ball.withTeam = team.teamID
  matchDetails.ball.ballOverIterations = []
  team.intent = 'attack'
  opposition.intent = 'defend'
}

export function setPostTacklePosition(matchDetails, winningPlyr, losePlayer, increment) {
  const [, pitchHeight] = matchDetails.pitchSize
  if (losePlayer.originPOS[1] > pitchHeight / 2) {
    losePlayer.currentPOS[1] = common.upToMin(losePlayer.currentPOS[1] - increment, 0)
    matchDetails.ball.position[1] = common.upToMin(matchDetails.ball.position[1] - increment, 0)
    winningPlyr.currentPOS[1] = common.upToMax(winningPlyr.currentPOS[1] + increment, pitchHeight)
  } else {
    losePlayer.currentPOS[1] = common.upToMax(losePlayer.currentPOS[1] + increment, pitchHeight)
    matchDetails.ball.position[1] = common.upToMax(matchDetails.ball.position[1] + increment, pitchHeight)
    winningPlyr.currentPOS[1] = common.upToMin(winningPlyr.currentPOS[1] - increment, 0)
  }
}

export function setInjury(matchDetails, thatPlayer, player, tackledInjury, tacklerInjury) {
  if (common.isInjured(tackledInjury)) {
    thatPlayer.injured = true
    matchDetails.iterationLog.push(`Player Injured - ${thatPlayer.name}`)
  }
  if (common.isInjured(tacklerInjury)) {
    player.injured = true
    matchDetails.iterationLog.push(`Player Injured - ${player.name}`)
  }
}

export function setFoul(matchDetails, team, player, thatPlayer) {
  matchDetails.iterationLog.push(`Foul against: ${thatPlayer.name} by ${player.name}`)
  player.stats.tackles.fouls++
  if (team.teamID === matchDetails.kickOffTeam.teamID) matchDetails.kickOffTeamStatistics.fouls++
  else matchDetails.secondTeamStatistics.fouls++
  if (Array.isArray(matchDetails.events)) {
    matchDetails.events.push({
      type: 'foul',
      teamID: team.teamID,
      teamName: team.name,
      playerName: player.name,
      victimName: thatPlayer.name,
      iteration: matchDetails.iterationCount || 0,
      half: matchDetails.half,
      deadBall: true
    })
  }
}

export function wasFoul(x, y) {
  const foul = common.getRandomNumber(0, x)
  return common.isBetween(foul, 0, (y / 2) - 1)
}

export function foulIntensity() {
  return common.getRandomNumber(1, 99)
}

export function playerJumps(perception) {
  return common.isBetween(common.getRandomNumber(0, 100), 0, common.getRandomNumber(0, perception))
}

function normaliseActionObjects(actions) {
  const total = actions.reduce((sum, a) => sum + a.points, 0)
  if (total <= 0) return actions
  actions.forEach(a => {
    a.points = Math.round((a.points / total) * 100)
  })
  return actions
}

function adjustForBallHeight(actions, player, matchDetails) {
  const ballZ = matchDetails.ball.position[2] || 0
  const { withPlayer } = matchDetails.ball
  const pitchHeight = matchDetails.pitchSize[1]
  const groundMax = pitchHeight * 0.01
  const aerialMax = pitchHeight * 0.035
  const playerHeightMeters = player.height / 100
  const pitchHeightMeters = pitchHeight / 10
  const reachableHeight = (playerHeightMeters / pitchHeightMeters) * pitchHeight + (player.skill.jumping / 10)
  const settlingFrames = matchDetails.ball.settlingFrames || 0

  if (!withPlayer && ballZ > groundMax) {
    if (ballZ > reachableHeight) {
      actions[0].points = 0
      actions[1].points = 0
      actions[2].points = 0
      actions[3].points = 0
      actions[4].points = 0
      actions[6].points = 0
      actions[9].points += 25
      actions[10].points += 25
      return actions
    }
    const rawFactor = 1 - (ballZ / aerialMax)
    const heightFactor = Math.max(0, Math.min(1, rawFactor))
    actions[0].points *= heightFactor
    actions[1].points *= heightFactor
    actions[2].points *= heightFactor
    actions[3].points *= heightFactor
    actions[9].points += 15 * (1 - heightFactor)
    actions[10].points += 10 * (1 - heightFactor)
    return actions
  }
  if (withPlayer === true && matchDetails.ball.Player === player.playerID && ballZ > groundMax) {
    const rawFactor = 1 - (ballZ / aerialMax)
    const heightFactor = Math.max(0, Math.min(1, rawFactor))
    actions[7].points *= heightFactor
    actions[8].points *= heightFactor * 0.6
    actions[0].points *= 0.85
    actions[1].points *= 0.85
    actions[2].points *= 0.85
    if (settlingFrames > 0) {
      actions[8].points *= 0.2
      actions[1].points *= 0.5
      actions[3].points *= 0.5
      matchDetails.ball.settlingFrames--
    }
    return actions
  }
  return actions
}

export function extractBallActions(moves, type) {
  const ballActions = ['shoot', 'throughBall', 'pass', 'cross', 'cleared', 'boot', 'penalty', 'freekickShot']
  if (type === 'ball') return moves.filter(m => ballActions.includes(m.action))
  if (type === 'movement') return moves.filter(m => !ballActions.includes(m.action))
  return []
}
