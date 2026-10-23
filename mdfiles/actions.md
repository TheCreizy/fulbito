# `actions.js` - Acciones e Interacciones de Jugadores

> **Categoría:** `Comportamiento y Acciones`  
> **Ubicación original:** `src/engine/actions.js`  
> **Líneas de código:** 1178  
> **Tamaño:** 53.10 KB

---

## 📋 Resumen del Módulo

Controla las decisiones e interacciones de los jugadores en posesión o disputa: pases cortos/largos, disparos al arco, regates, centros al área, quites, intercepciones y faltas reglamentarias.

---

## 🧩 Exportaciones y Elementos Principales

- **Línea 5:** `export function selectAction(possibleActions)`
- **Línea 16:** `export function findPossActions(player, team, opposition, ballX, ballY, matchDetails)`
- **Línea 39:** `export function scanCarrierEnvironment(matchDetails, player, team, opposition)`
- **Línea 191:** `export function evaluateCarrierDecision(matchDetails, player, team, opposition)`
- **Línea 569:** `export function topTeamPlayerHasBall(matchDetails, player, team, opposition)`
- **Línea 573:** `export function bottomTeamPlayerHasBall(matchDetails, player, team, opposition)`
- **Línea 577:** `export function oppositionNearPlayer(oppositionPlayer, spaceX, spaceY)`
- **Línea 583:** `export function checkTeamMateSpaceClose(tmateProximity, lowX, highX, lowY, highY)`
- **Línea 587:** `export function checkOppositionAhead(closePlayerPosition, currentPOS)`
- **Línea 592:** `export function checkOppositionBelow(closePlayerPosition, currentPOS)`
- **Línea 597:** `export function playerDoesNotHaveBall(player, ballX, ballY, ballZ, matchDetails)`
- **Línea 638:** `export function noBallNotGK4CloseBall(matchDetails, currentPOS, originPOS, pitchWidth, pitchHeight)`
- **Línea 650:** `export function noBallNotGK4CloseBallBottomTeam(matchDetails, currentPOS, pitchWidth, pitchHeight)`
- **Línea 659:** `export function noBallNotGK2CloseBall(matchDetails, currentPOS, originPOS, pitchWidth, pitchHeight)`
- **Línea 671:** `export function noBallNotGK2CloseBallBottomTeam(matchDetails, currentPOS, pitchWidth, pitchHeight)`
- **Línea 680:** `export function checkPositionInBottomPenaltyBox(position, pitchWidth, pitchHeight)`
- **Línea 686:** `export function checkPositionInBottomPenaltyBoxClose(position, pitchWidth, pitchHeight)`
- **Línea 692:** `export function checkPositionInTopPenaltyBox(position, pitchWidth, pitchHeight)`
- **Línea 698:** `export function checkPositionInTopPenaltyBoxClose(position, pitchWidth, pitchHeight)`
- **Línea 704:** `export function onBottomCornerBoundary(position, pitchWidth, pitchHeight)`
- **Línea 708:** `export function onTopCornerBoundary(position, pitchWidth)`
- **Línea 712:** `export function populatePossibleActions(possibleActions, player, matchDetails, a, b, c, d, e, f, g, h, i, j, k, l = 0)`
- **Línea 815:** `export function resolveTackle(player, team, opposition, matchDetails)`
- **Línea 877:** `export function resolveSlide(player, team, opposition, matchDetails)`
- **Línea 960:** `export function setPostTackleKnockedBall(matchDetails, team, opposition, player, carrier, isSlide = false)`
- **Línea 1029:** `export function calcTackleScore(skill, diff, player = null)`
- **Línea 1035:** `export function calcRetentionScore(skill, diff)`
- **Línea 1039:** `export function setPostTackleBall(matchDetails, team, opposition, player)`
- **Línea 1054:** `export function setPostTacklePosition(matchDetails, winningPlyr, losePlayer, increment)`
- **Línea 1067:** `export function setInjury(matchDetails, thatPlayer, player, isSlide = false)`
- **Línea 1079:** `export function setFoul(matchDetails, team, player, thatPlayer)`
- **Línea 1098:** `export function wasFoul(x, y)`
- **Línea 1103:** `export function foulIntensity()`
- **Línea 1107:** `export function playerJumps(perception)`
- **Línea 1172:** `export function extractBallActions(moves, type)`

### Funciones Internas Notables

| Función | Parámetros | Línea |
| :--- | :--- | :--- |
| `pointToSegmentDist2D` | `px, py, x1, y1, x2, y2` | L29 |
| `applyCoachDirectivesToDecision` | `decision, team, env, player` | L197 |
| `computeBaseCarrierDecision` | `matchDetails, player, team, opposition, env` | L239 |
| `populateActionsJSON` | `ninguno` | L781 |
| `calculateFoulProbability` | `tackler, carrier, isSlide = false` | L798 |
| `setFailedTackle` | `matchDetails, player, thatPlayer, tackleDetails` | L997 |
| `setSuccessTackle` | `matchDetails, team, opposition, player, thatPlayer, tackleDetails` | L1004 |
| `normaliseActionObjects` | `actions` | L1111 |
| `adjustForBallHeight` | `actions, player, matchDetails` | L1120 |

---

## 💻 Código Fuente Completo (`actions.js`)

````javascript
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
  let hasCentralMateOpen = false
  let hasBoxTarget = false
  let hasCutbackOption = false
  let hasOverlapRunnerOutside = false
  let hasSafeBackwardOption = false

  const onLeftFlank = curX < pitchWidth / 2
  const teamPlayers = team?.players || []
  for (const mate of teamPlayers) {
    if (!common.isOnPitch(mate) || mate.playerID === player.playerID || mate.offside) continue
    const mX = mate.currentPOS[0]
    const mY = mate.currentPOS[1]
    const passDist = common.distance(player.currentPOS, mate.currentPOS)
    if (passDist < 24 || passDist > pitchHeight * 0.52) continue

    const forwardGain = (mY - curY) * dir
    const isMateStriker = ['ST', 'EXT'].includes(mate.role) || ['ST', 'EXT'].includes(mate.position) || ['ST', 'EXT'].includes(mate.tacticalRole)
    const corridorHalfWidth = Math.max(16, Math.min(28, passDist * 0.075))
    let minOppToMate = 999
    let laneBlocked = false
    for (const opp of oppPlayers) {
      if (!common.isOnPitch(opp) || (opp.stunnedTicks || 0) > 0) continue
      const od = common.distance(mate.currentPOS, opp.currentPOS)
      if (od < minOppToMate) minOppToMate = od
      const sd = pointToSegmentDist2D(opp.currentPOS[0], opp.currentPOS[1], curX, curY, mX, mY)
      if (sd < corridorHalfWidth) laneBlocked = true
    }

    const isActivelyRunning = !!(mate.offBallRun && mate.offBallRun.untilIteration > currentIter)
    const requiredSep = isMateStriker ? 36 : 28
    if (!laneBlocked && forwardGain >= 28 && ((isActivelyRunning && minOppToMate > 22) || minOppToMate > requiredSep)) {
      hasRunnerInBehind = true
    }
    if (!laneBlocked && forwardGain >= 40 && minOppToMate > 24) {
      hasBetterPositionedMate = true
    }
    const isCentralMate = Math.abs(mX - pitchWidth / 2) <= 140
    if (!laneBlocked && isCentralMate && forwardGain >= 10 && minOppToMate > 24) {
      hasCentralMateOpen = true
    }
    const consecutiveSwitches = matchDetails?.ball?.consecutiveSwitches || 0
    if (consecutiveSwitches < 2 && Math.abs(mX - curX) >= 230 && (mX < 185 || mX > pitchWidth - 185) && minOppToMate > 38 && forwardGain > -35) {
      hasSwitchOption = true
    }
    const mateDistToGoalY = isTopTeam ? (pitchHeight - mY) : mY
    if (mateDistToGoalY < 165 && mX >= 195 && mX <= (pitchWidth - 195)) {
      hasBoxTarget = true
    }

    // Detección de ReleaseOutside (open-football FlankPlay: lateral o compañero desdoblando por fuera)
    const mateOnSameFlank = onLeftFlank ? (mX < curX + 25) : (mX > curX - 25)
    const mateFurtherOutside = onLeftFlank ? (mX < curX) : (mX > curX)
    if (
      mateOnSameFlank &&
      (mateFurtherOutside || mate.offBallRun?.type === 'overlapFlank') &&
      forwardGain >= 18 &&
      !laneBlocked &&
      minOppToMate > 22
    ) {
      hasOverlapRunnerOutside = true
    }

    // Detección de Pase de Seguridad / Circulación limpia hacia atrás (open-football BuildUp & Progression)
    if (forwardGain < -15 && forwardGain > -220 && minOppToMate > 30 && !laneBlocked) {
      hasSafeBackwardOption = true
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

  const inWideZone = curX < 210 || curX > (pitchWidth - 210)
  const inCentralZone = Math.abs(curX - pitchWidth / 2) <= 170
  // Canal libre hacia el arco (Breakaway central / Mano a mano sin defensores de campo adelante)
  // Si superó la última línea de centrales en el carril interior y no tiene rivales de campo adelante
  const isBreakawayAhead = (nearestOutfieldOppAheadDist > 55 || nearestOutfieldOppAheadDist === 999)
  const hasOpenRunway = isBreakawayAhead && inCentralZone && distToGoalY < 380 && (nearestOppAheadDist > 22 || nearestOppAheadDist === 999)
  // Canal libre en banda: extremo o lateral con pista libre para picar hacia el fondo
  const hasFlankRunway = inWideZone &&
    (nearestOppAheadDist > 30 || nearestOppAheadDist === 999)

  return {
    isTopTeam,
    dir,
    distToGoalY,
    nearestOppDist,
    nearestOppAheadDist,
    nearestOutfieldOppAheadDist,
    hasOpenRunway,
    hasFlankRunway,
    nearbyOppsCount,
    shotBlocked,
    hasRunnerInBehind,
    hasSwitchOption,
    hasBetterPositionedMate,
    hasCentralMateOpen,
    hasBoxTarget,
    hasCutbackOption,
    hasOverlapRunnerOutside,
    hasSafeBackwardOption
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
  const isStriker = ['ST', 'EXT'].includes(role) || ['ST', 'EXT'].includes(player.position)
  const isOffensive = team?.mentality === 'offensive'
  const isDefensive = team?.mentality === 'defensive'

  // 0. SAQUE LATERAL DEDICADO: Pase corto y seguro a los compañeros de apoyo
  if (matchDetails.isThrowIn && player.playerID === matchDetails.throwInTakerID) {
    // El ejecutor del lateral busca asociarse de forma limpia con los compañeros de apoyo
    return [0, 30, 70, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  }

  // 0.5 SAQUE DEL MEDIO (KICKOFF RETENTION & BUILD-UP):
  // El receptor del saque del medio NO rifa el balón al campo contrario.
  // Conduce abriendo ángulo, temporiza con pausa y circula en corto hacia defensores o laterales.
  if ((matchDetails.kickoffRetentionTicks || 0) > 0 && position !== 'GK') {
    const pauseWeight = carrierTicks <= 2 ? 30 : 10
    const carryWeight = 30 // Conduce hacia la banda o hacia atrás para perfilarse
    const circulatePassWeight = 100 - pauseWeight - carryWeight
    return [0, 0, circulatePassWeight, 0, 0, 0, 0, carryWeight, 0, 0, 0, pauseWeight]
  }

  // 1. Arquero con pelota
  if (position === 'GK') {
    // Reglas 13 y 16 IFAB: en saque de meta o pelota parada, el arquero NO puede salir conduciendo (0 en run y sprint).
    // Opciones reglamentarias: salida corta por bajo (pass) o saque largo de volea/despeje (boot / throughBall)
    if (matchDetails.ball?.isRestart && matchDetails.ball?.Player === player.playerID) {
      const isDirectStyle = team?.playStyle === 'direct' || team?.playStyle === 'longBall'
      const bootWeight = isDirectStyle ? 55 : 30
      const passWeight = isDirectStyle ? 45 : 70
      return [0, 0, passWeight, 0, 0, 0, 0, 0, 0, 0, bootWeight, 0]
    }
    if (env.nearestOppDist < 28) return [0, 0, 35, 0, 0, 0, 0, 0, 0, 35, 30, 0]
    return [0, 12, 74, 0, 0, 0, 0, 6, 0, 8, 0, 0]
  }

  // 2. Límites de córner
  if (onBottomCornerBoundary(currentPOS, pitchWidth, pitchHeight) || onTopCornerBoundary(currentPOS, pitchWidth)) {
    return [0, 0, 22, 78, 0, 0, 0, 0, 0, 0, 0, 0]
  }

  // 2.5 Devolución de Pared ("One-Two Wall Pass"): el socio de la pared devuelve de primera
  if (
    matchDetails.wallPass &&
    matchDetails.wallPass.wallPartnerID === player.playerID &&
    (matchDetails.iterationCount || 0) <= matchDetails.wallPass.expireIter
  ) {
    return [0, 85, 15, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  }

  const inWideChannel = currentPOS[0] < 210 || currentPOS[0] > (pitchWidth - 210)
  const inCentralCorridor = currentPOS[0] >= 200 && currentPOS[0] <= (pitchWidth - 200)
  const dribbleSkill = ((Number(skill.agility) || 70) + (Number(skill.control) || 70)) / 2

  // 2.6 CANAL LIBRE / SUPERÓ A LOS RIVALES (MANO A MANO HACIA EL GOL)
  // Si el portador tiene el espacio libre adelante o superó a la línea defensiva,
  // NO tocar atrás ni al costado: sprint decidido directo al área/arco rival y tiro
  if (env.hasOpenRunway && position !== 'GK') {
    // Si ya está frente al arquero en el área chica o punto penal (distToGoalY <= 115): remate contundente
    if (env.distToGoalY <= 115) {
      return [92, 0, 0, 0, 0, 0, 0, 0, 8, 0, 0, 0]
    }
    // Ingresando al área penal (116px a 165px): tiro colocado o seguir encarando al arquero
    if (env.distToGoalY <= 165) {
      const shootPts = (skill.shooting >= 80 || isArtillero) ? 68 : 55
      const drivePts = 100 - shootPts
      return [shootPts, 0, 0, 0, 0, 0, 0, 0, drivePts, 0, 0, 0]
    }
    // Carrera libre hacia el área: sprint vertical decidido al 100%
    return [0, 0, 0, 0, 0, 0, 0, 4, 96, 0, 0, 0]
  }

  // 2.7 FLANK RUNWAY (Open Football FlankPlay: Conducción Decidida por la Banda)
  // Si un lateral o extremo tiene carril libre en banda, galopa por la raya hacia el fondo
  // en vez de rifar pases prematuros hacia atrás o hacia el medio
  if (env.hasFlankRunway && position !== 'GK') {
    // Solo tirar centro cuando esté paralelo al área y cerca del punto del penal o pasándolo (distToGoalY <= 135)
    if (env.distToGoalY <= 135 && env.hasBoxTarget) {
      const crossWeight = Math.round(92 * styleCfg.crossBoost)
      const cutbackPts = env.hasCutbackOption ? 52 : 14
      const wingGambeta = Math.round(42 * styleCfg.gambetaBoost)
      return [0, 2, cutbackPts, crossWeight, 0, 0, 0, 4, wingGambeta, 0, 0, 0]
    }
    // Si el lateral desdobla por fuera en velocidad, filtrar el pase al fondo (ReleaseOutside)
    if (env.hasOverlapRunnerOutside) {
      const releaseWeight = Math.round(86 * styleCfg.throughBoost)
      return [0, releaseWeight, 6, 0, 0, 0, 0, 4, 18, 0, 0, 0]
    }
    // Picar decidido por la raya: sprint dominante hacia la línea de fondo para desbordar
    const carrySprint = (isVelocista || styleCfg.id === 'wingPlay') ? 90 : 84
    const carryRun = 8
    const throughCut = env.hasRunnerInBehind ? Math.round(18 * styleCfg.throughBoost) : 2
    return [0, throughCut, 2, 0, 0, 0, 0, carryRun, carrySprint, 0, 0, 0]
  }

  // 3. Desborde por las Bandas: Escalera FlankPlay y Efecto "Bait" hacia el centro
  if (inWideChannel && env.distToGoalY < 320) {
    // RUNG 1: ReleaseOutside - Si el lateral desdobló por fuera, pase al espacio hacia el fondo
    if (env.hasOverlapRunnerOutside) {
      const releaseWeight = Math.round(86 * styleCfg.throughBoost)
      return [0, releaseWeight, 10, 0, 0, 0, 0, 4, 0, 0, 0, 0]
    }

    // EFECTO "BAIT": Si el extremo o lateral arrastra la marca hacia la cal y deja un hueco interior
    // en el carril central con un volante o delantero libre de frente al arco, filtrar el pase directo al área
    if (env.hasCentralMateOpen && !env.shotBlocked && env.distToGoalY > 150) {
      const baitInsideThrough = Math.round(62 * styleCfg.throughBoost)
      return [0, baitInsideThrough, 22, 0, 0, 0, 0, 6, 10, 0, 0, 0]
    }

    // RUNG 2: Deliver - Centro al área SOLO cuando esté paralelo al área y cerca del punto del penal (distToGoalY <= 140)
    if (env.distToGoalY <= 140) {
      const crossWeight = Math.round((env.hasBoxTarget ? 96 : 40) * styleCfg.crossBoost)
      const cutbackPts = env.hasCutbackOption ? 62 : 18
      const wingGambeta = (dribbleSkill >= 76 || isEncarador || isVelocista) ? Math.round(52 * styleCfg.gambetaBoost) : 26
      if (env.distToGoalY <= 95 || env.nearestOppAheadDist <= 15) {
        return [0, 2, cutbackPts, crossWeight, 0, 0, 0, 4, wingGambeta, 0, 0, 0]
      }
      const passInside = env.hasBetterPositionedMate ? 18 : 8
      return [0, 2, passInside, crossWeight, 0, 0, 0, 4, wingGambeta, 0, 0, 0]
    }

    // RUNG 3: DriveByline - En tres cuartos de banda (141px a 320px): ENCARAR, GAMBETEAR Y AVANZAR
    if (env.nearestOppAheadDist > 18) {
      // Espacio libre hacia la línea de fondo: encarar y picar decididamente por la banda hacia el fondo
      const wingAdvance = (isVelocista || styleCfg.id === 'wingPlay') ? 88 : 80
      const throughCut = env.hasRunnerInBehind ? Math.round(20 * styleCfg.throughBoost) : 6
      const passInside = env.hasBetterPositionedMate ? 8 : 4
      const holdPatience = (carrierTicks <= 2 && env.nearestOppDist > 26) ? 8 : 0
      return [0, throughCut, passInside, 0, 0, 0, 0, 6, wingAdvance, 0, 0, holdPatience]
    }

    // Marcador cerrando el paso en la raya: DUELO 1v1 DE GAMBETA, desborde o pared
    const passInside = env.hasBetterPositionedMate ? 28 : 16
    const gambetaPts = (dribbleSkill >= 75 || isVelocista || isEncarador)
      ? Math.round(68 * styleCfg.gambetaBoost)
      : 42
    const throughCut = env.hasRunnerInBehind ? Math.round(28 * styleCfg.throughBoost) : 8
    const holdPatience = (env.nearestOppDist > 20) ? 14 : 4
    return [0, throughCut, passInside, 0, 0, 0, 0, 4, gambetaPts, 0, 0, holdPatience]
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

  // 5. Puerta del Área / Medialuna (distToGoalY entre 179px y 260px)
  if (env.distToGoalY > 178 && env.distToGoalY <= 260) {
    let edgeShootPts = 0
    // Tiros de media distancia de mediocampistas, extremos, delanteros y laterales ofensivos (open-football LongShot model)
    const isFullbackShooter = ['LB', 'RB', 'LWB', 'RWB'].includes(role) && (skill.shooting >= 70 || isLanzador)
    const isMidfieldShooter = ['CAM', 'CM', 'CDM', 'LM', 'RM'].includes(role) || isLanzador || isStriker || isFullbackShooter
    if (inCentralCorridor && !env.shotBlocked && isMidfieldShooter) {
      if (isLanzador || skill.shooting >= 84) {
        edgeShootPts = 78
      } else if (skill.shooting >= 72) {
        edgeShootPts = 62
      } else if (skill.shooting >= 60) {
        edgeShootPts = 46
      }
      if (styleCfg.id === 'tikiTaka' && !isLanzador) edgeShootPts = Math.round(edgeShootPts * 0.82)
    }

    // Delanteros y encaradores: penetración decidida al área o tiro directo
    if ((isEncarador || isStriker) && env.nearbyOppsCount <= 1) {
      const forwardDrive = (dribbleSkill >= 75 || isEncarador) ? 76 : 60
      const effectiveShoot = Math.max(edgeShootPts, isStriker ? 55 : 42)
      return [effectiveShoot, env.hasRunnerInBehind ? 8 : 4, 4, 0, 0, 0, 0, 6, forwardDrive, 0, 0, 0]
    }

    if (env.nearestOppAheadDist > 30) {
      const drivePts = 70
      const throughPts = env.hasRunnerInBehind ? Math.round((styleCfg.id === 'wingPlay' ? 22 : 14) * styleCfg.throughBoost) : 4
      const switchPts = env.hasSwitchOption ? 6 : 2
      return [edgeShootPts, throughPts, switchPts, 0, 0, 0, 0, 8, drivePts, 0, 0, 0]
    }

    const gambetaPts = (env.nearbyOppsCount <= 1 && (dribbleSkill >= 75 || isEncarador)) ? Math.round(48 * styleCfg.gambetaBoost) : 22
    const throughPts = env.hasRunnerInBehind ? Math.round((styleCfg.id === 'wingPlay' ? 38 : 26) * styleCfg.throughBoost) : 10
    const passPts = (env.hasBetterPositionedMate) ? 26 : 16
    const waitPatience = (env.nearestOppDist > 26 && carrierTicks <= 3) ? 14 : 0
    return [edgeShootPts, throughPts, passPts, inWideChannel ? 24 : 4, 0, 0, 0, 6, gambetaPts, 0, 0, waitPatience]
  }

  // 6. Resto del Campo
  let rareLongShot = 0
  // Cañonazo de especialistas o volantes con buen remate desde tres cuartos (distToGoalY <= 295px)
  if (env.distToGoalY <= 295 && inCentralCorridor && !env.shotBlocked && env.nearestOppDist > 22) {
    if (isLanzador && skill.shooting >= 75) rareLongShot = 48
    else if (skill.shooting >= 84) rareLongShot = 34
    else if (skill.shooting >= 74) rareLongShot = 20
  }

  // Zona de tres cuartos (251px a 345px): Encaradores natos o delanteros de desequilibrio (Ronaldo Nazário, Agüero, Messi)
  const canSoloEncarar = isEncarador || (isStriker && dribbleSkill >= 80 && !isArtillero)
  if (env.distToGoalY > 250 && env.distToGoalY <= 345 && canSoloEncarar && !isDefensive) {
    if (env.nearbyOppsCount <= 1 && env.nearestOppAheadDist > 24) {
      const throughCut = env.hasRunnerInBehind ? Math.round(28 * styleCfg.throughBoost) : 8
      const encararSprint = 74
      return [rareLongShot, throughCut, 8, 0, 0, 0, 0, 8, encararSprint, 0, 0, 0]
    }
  }

  // 9 de Área o delantero clásico en mitad de cancha (distToGoalY > 240):
  // Si está marcado o tiene defensores adelante, PISAR LA PELOTA, aguantar y descargar corto a los costados o atrás
  if (isStriker && env.distToGoalY > 240) {
    if (env.nearestOppAheadDist < 42 || env.nearbyOppsCount >= 1) {
      const layoffPass = env.hasBetterPositionedMate ? 54 : 44
      const throughWeight = env.hasRunnerInBehind ? 24 : 12
      const holdPatience = (env.nearestOppDist > 16) ? 32 : 12
      return [0, throughWeight, layoffPass, 0, 0, 0, 0, 10, 6, 0, 0, holdPatience]
    }
  }

  // Transición ofensiva rápida (open-football AttackingTransition model o MENTALIDAD DEFENSIVA):
  // Robar y lanzar verticalmente o pase en profundidad al desmarque
  const passingSkill = Number(skill.passing) || 65
  const isLongPassSpecialist = passingSkill >= 78 || isLanzador || isOrganizador
  const isDirectStyle = styleCfg.id === 'directPlay' || styleCfg.id === 'counterAttack'
  const inOwnHalf = env.distToGoalY > (pitchHeight * 0.48)
  const allowLongBallFromDeep = isLongPassSpecialist || isDirectStyle

  if ((team?.gamePhase === 'AttackingTransition' || isDefensive) && env.distToGoalY > 260) {
    if (env.hasRunnerInBehind) {
      const throughPts = inOwnHalf
        ? (allowLongBallFromDeep ? (isLongPassSpecialist ? 40 : 28) : 8)
        : Math.round(48 * styleCfg.throughBoost)
      const passPts = Math.max(20, 80 - throughPts)
      return [0, throughPts, passPts, 0, 0, 0, 0, 6, 12, 0, 0, 0]
    }
    if (env.hasSwitchOption) {
      return [0, 16, 50, 0, 0, 0, 0, 6, 16, 0, 0, 0]
    }
  }

  // Enganche / Mediapunta (CAM) u Organizador del mediocampo (Riquelme, Gago, Xavi, Redondo):
  // Gran visión de juego: toque asociativo, pases filtrados a la espalda y PAUSA PARA PARAR LA PELOTA
  if (role === 'CAM' || isOrganizador) {
    const rawThrough = (inOwnHalf && !allowLongBallFromDeep) ? 10 : 32
    const throughWeight = env.hasRunnerInBehind ? Math.round(rawThrough * styleCfg.throughBoost) : 10
    const passWeight = (env.hasBetterPositionedMate) ? 46 : 38
    const gambetaWeight = dribbleSkill >= 80 ? 24 : 12
    const pausePatience = (env.nearestOppDist > 24) ? 38 : 10
    return [rareLongShot, throughWeight, passWeight, 0, 0, 0, 0, 10, gambetaWeight, 0, 0, pausePatience]
  }

  // Salida y Gestación Paciente desde Abajo (open-football BuildUp phase o distToGoalY > 360):
  // Circulación segura y pausa para permitir que el bloque avance (solo si no tiene carril abierto para avanzar)
  if (!env.hasFlankRunway && !env.hasOpenRunway && (team?.gamePhase === 'BuildUp' || env.distToGoalY > 360) && (env.nearestOppAheadDist < 42 || !env.hasRunnerInBehind || !allowLongBallFromDeep)) {
    const circulatePass = 64
    const throughPass = (env.hasRunnerInBehind && allowLongBallFromDeep) ? Math.round((isLongPassSpecialist ? 26 : 14) * styleCfg.throughBoost) : 2
    const pausePatience = (env.nearestOppDist > 28) ? 32 : 8
    return [0, throughPass, circulatePass, 0, 0, 0, 0, 14, 6, 0, 0, pausePatience]
  }

  // TEMPORIZACIÓN Y ESCANEO COLECTIVO (open-football min_scan_time model):
  // Si el portador recién recibe la pelota (carrierTicks <= 4) y ningún rival está encima (dist > 25px),
  // "PARA LA PELOTA" (wait) para permitir que los laterales suban y los compañeros tiren diagonales
  // (NO aplica si el carril de banda o frontal está libre para galopar)
  if (carrierTicks <= 4 && env.nearestOppDist > 25 && env.distToGoalY > 210 && !env.hasFlankRunway && !env.hasOpenRunway && env.nearestOppAheadDist < 35) {
    const pauseWeight = (styleCfg.id === 'tikiTaka') ? 22 : 12
    const throughInStride = (env.hasRunnerInBehind && (!inOwnHalf || allowLongBallFromDeep))
      ? Math.round((isLongPassSpecialist ? 24 : 16) * styleCfg.throughBoost)
      : 2
    const passOption = 34
    const carryRun = 30
    return [0, throughInStride, passOption, 0, 0, 0, 0, carryRun, 20, 0, 0, pauseWeight]
  }

  // Si tiene espacio libre adelante (nearestOppAheadDist > 34 y nearestOppDist > 20), avanza con la pelota
  if (env.nearestOppAheadDist > 34 && env.nearestOppDist > 20) {
    let throughInStride = 0
    let passInStride = 10
    if (env.hasRunnerInBehind) {
      if (inOwnHalf && !allowLongBallFromDeep) {
        throughInStride = 2
      } else {
        throughInStride = isLongPassSpecialist
          ? Math.round(28 * styleCfg.throughBoost)
          : (carrierTicks >= 3 ? Math.round(18 * styleCfg.throughBoost) : 6)
      }
    }
    if (env.hasBetterPositionedMate && carrierTicks >= 4) {
      passInStride = 20
    }
    const carrySprint = Math.max(45, 84 - throughInStride - passInStride)
    const holdPatience = (carrierTicks <= 2 && env.nearestOppDist > 32) ? 18 : 0
    return [rareLongShot, throughInStride, passInStride, 0, 0, 0, 0, 14, carrySprint, 0, 0, holdPatience]
  }

  // Duelo 1v1 o presión cercana: Gambeta 1v1, Pase Filtrado o Conducción
  const isDribblerRole = ['CAM', 'LM', 'RM', 'EXT', 'ST', 'LB', 'RB'].includes(role) || dribbleSkill >= 76 || isEncarador
  if (env.nearbyOppsCount <= 1 && isDribblerRole && env.nearestOppDist >= 12) {
    const gambetaWeight = Math.round((dribbleSkill >= 80 || isEncarador ? 58 : 42) * styleCfg.gambetaBoost)
    const throughWeight = (env.hasRunnerInBehind && (!inOwnHalf || allowLongBallFromDeep))
      ? Math.round((styleCfg.id === 'wingPlay' ? 28 : 18) * styleCfg.throughBoost)
      : 6
    const passWeight = env.hasBetterPositionedMate ? 30 : 18
    return [rareLongShot, throughWeight, passWeight, 0, 0, 0, 0, 8, gambetaWeight, 0, 0, 0]
  }

  const inOwnThird = env.distToGoalY > (pitchHeight * 0.72)
  const clearanceWeight = (inOwnThird && env.nearestOppDist < 15 && !env.hasBetterPositionedMate) ? 18 : 0
  const throughWeight = (env.hasRunnerInBehind && allowLongBallFromDeep) ? Math.round(12 * styleCfg.throughBoost) : 3
  const passWeight = 48
  const pausePatience = (env.nearestOppDist > 25 && !inOwnThird) ? 22 : 0
  return [rareLongShot, throughWeight, passWeight, 0, 0, 0, 0, 14, 14, clearanceWeight, 0, pausePatience]
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
  if (position === 'GK') return [0, 0, 0, 0, 0, 0, 0, 60, 40, 0, 0, 0]

  const myTeam = matchDetails.kickOffTeam.players.some(p => p.playerID === player.playerID)
    ? matchDetails.kickOffTeam
    : matchDetails.secondTeam
  const teamHasBall = matchDetails.ball.withPlayer && matchDetails.ball.withTeam === myTeam.teamID

  // 1. NUESTRO EQUIPO TIENE LA PELOTA: prohibido taclear o interceptar a compañeros.
  // Moverse hacia el espacio táctico (intentPOS / BoxSlots / apoyo).
  if (teamHasBall) {
    const hasActiveRun = player.offBallRun && player.offBallRun.untilIteration > (matchDetails.iterationCount || 0)
    if (hasActiveRun) return [0, 0, 0, 0, 0, 0, 0, 15, 85, 0, 0, 0]
    return [0, 0, 0, 0, 0, 0, 0, 75, 25, 0, 0, 0]
  }

  // 2. PELOTA SUELTA: disputan los más cercanos (< 38px)
  const distToBall = Math.hypot(ballX, ballY)
  if (!matchDetails.ball.withPlayer) {
    if (distToBall < 38) return [0, 0, 0, 0, 0, 65, 0, 0, 35, 0, 0, 0]
    return [0, 0, 0, 0, 0, 0, 0, 65, 35, 0, 0, 0]
  }

  // 3. RIVAL CON PELOTA: respetar el rol asignado en defensivePlan (Press, Cover, Mark, HoldZone)
  const defDuty = myTeam.defensivePlan?.duties?.[player.playerID]?.duty || 'HoldZone'
  if (defDuty !== 'Press' && distToBall > 22) {
    // Jugadores en Cover, Mark o HoldZone mantienen su posición/marca en vez de perseguir la pelota
    return [0, 0, 0, 0, 0, 0, 0, 70, 30, 0, 0, 0]
  }

  if (common.isBetween(ballX, -20, 20) && common.isBetween(ballY, -20, 20)) {
    return noBallNotGK2CloseBall(matchDetails, currentPOS, originPOS, pitchWidth, pitchHeight)
  }
  if (common.isBetween(ballX, -40, 40) && common.isBetween(ballY, -40, 40)) {
    return noBallNotGK4CloseBall(matchDetails, currentPOS, originPOS, pitchWidth, pitchHeight)
  }
  return [0, 0, 0, 0, 0, 35, 0, 30, 35, 0, 0, 0]
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

export function populatePossibleActions(possibleActions, player, matchDetails, a, b, c, d, e, f, g, h, i, j, k, l = 0) {
  // Delanteros y enganches presionan/interceptan mucho más de lo que se tiran a barrer
  const role = player.tacticalRole || player.position
  let tacklePts = e
  let interceptPts = f
  let slidePts = g
  let runPts = h
  if (['ST', 'EXT', 'CAM'].includes(role) || ['ST', 'EXT'].includes(player.position)) {
    const shiftedFromTackle = Math.round(tacklePts * 0.58)
    const shiftedFromSlide = Math.round(slidePts * 0.85)
    tacklePts -= shiftedFromTackle
    slidePts -= shiftedFromSlide
    interceptPts += Math.round((shiftedFromTackle + shiftedFromSlide) * 0.6)
    runPts += Math.round((shiftedFromTackle + shiftedFromSlide) * 0.4)
  }
  // Detección de situación de riesgo / último recurso para la barrida:
  // Se tiran al piso cuando la jugada es de riesgo manifiesto de gol (cerca del área propia o último hombre)
  const [, pHeight = 1050] = matchDetails?.pitchSize || [680, 1050]
  const isTopTeamDef = player.originPOS[1] < (pHeight / 2)
  const distToOwnGoal = isTopTeamDef ? player.currentPOS[1] : (pHeight - player.currentPOS[1])
  const isDangerZone = distToOwnGoal < 220
  const ballY = matchDetails?.ball?.position?.[1]
  const isBehindCarrier = ballY != null ? (isTopTeamDef ? (ballY < player.currentPOS[1]) : (ballY > player.currentPOS[1])) : false
  const isHighRiskPlay = isDangerZone || isBehindCarrier

  if (!isHighRiskPlay) {
    // Si la jugada NO es de riesgo extremo, el defensor prefiere entrar de pie o interceptar sin tirarse al piso
    const safeReduction = Math.round(slidePts * 0.70)
    slidePts -= safeReduction
    tacklePts += Math.round(safeReduction * 0.7)
    interceptPts += Math.round(safeReduction * 0.3)
  }

  // Jugador amonestado (con amarilla) se cuida muchísimo más al marcar para no hacerse expulsar
  if ((player.stats?.cards?.yellow || 0) > 0) {
    const cautiousSlide = Math.round(slidePts * 0.88)
    const cautiousTackle = Math.round(tacklePts * 0.40)
    slidePts -= cautiousSlide
    tacklePts -= cautiousTackle
    interceptPts += cautiousSlide + cautiousTackle
  }

  // Regla IFAB: Ejecutor de pelota parada no puede salir conduciendo
  const isRestartCarrier = Boolean(
    matchDetails?.ball?.isRestart &&
    matchDetails?.ball?.Player === player.playerID &&
    !(matchDetails?.kickoffRetentionTicks > 0 && !player.isKickoffPass)
  )
  if (isRestartCarrier) {
    runPts = 0
  }

  possibleActions[0].points = a
  possibleActions[1].points = b
  possibleActions[2].points = c
  possibleActions[3].points = d
  possibleActions[4].points = tacklePts
  possibleActions[5].points = interceptPts
  possibleActions[6].points = slidePts
  possibleActions[7].points = runPts
  possibleActions[8].points = isRestartCarrier ? 0 : i
  possibleActions[9].points = j
  possibleActions[10].points = k
  if (possibleActions[11]) possibleActions[11].points = l
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
    { name: 'boot', points: 0 },
    { name: 'wait', points: 0 }
  ]
}

function calculateFoulProbability(tackler, carrier, isSlide = false) {
  const role = tackler.tacticalRole || tackler.position
  if (['ST', 'EXT'].includes(role) || ['ST', 'EXT'].includes(tackler.position)) {
    return isSlide ? 22 : 10
  }
  const tacklerSkill = Number(tackler.skill?.tackling || 60)
  const tacklerPer = Number(tackler.skill?.perception || 60)
  const carrierAgi = Number(carrier.skill?.agility || 65)
  const fatiguePenalty = (Number(tackler.fitness ?? 100) < 50) ? 6 : 0
  const isCaudillo = Array.isArray(tackler.traits) && tackler.traits.includes('caudillo_fisico')
  const baseChance = isSlide ? 42 : 24
  const skillDiff = (carrierAgi - (tacklerSkill * 0.75 + tacklerPer * 0.25) - (isCaudillo ? 6 : 0)) * (isSlide ? 0.20 : 0.16)
  const minChance = isSlide ? 24 : 12
  const maxChance = isSlide ? 65 : 44
  return Math.max(minChance, Math.min(maxChance, Math.round(baseChance + skillDiff + fatiguePenalty)))
}

export function resolveTackle(player, team, opposition, matchDetails) {
  if (!player || !common.isOnPitch(player) || player.sentOff) return false
  matchDetails.iterationLog.push(`Tackle attempted by: ${player.name}`)
  const tackleDetails = {
    injuryHigh: 1500,
    injuryLow: 1400,
    increment: 1
  }
  const index = opposition.players.findIndex(thisPlayer => thisPlayer.playerID === matchDetails.ball.Player)
  if (index === -1) return false
  const thatPlayer = opposition.players[index]
  if (!player.stats.tackles) player.stats.tackles = { total: 0, on: 0, off: 0, fouls: 0, slides: 0, blocks: 0 }
  player.stats.tackles.total++
  player.slideRecoveryTicks = 0 // Entrada de pie: el jugador NO se tira al piso

  const foulProb = calculateFoulProbability(player, thatPlayer, false)
  if (common.getRandomNumber(1, 100) <= foulProb) {
    setFoul(matchDetails, team, player, thatPlayer)
    return true
  }

  const tackleScore = calcTackleScore(player.skill, 5, player)
  const retentionScore = calcRetentionScore(thatPlayer.skill, 5)

  if (tackleScore > retentionScore) {
    // ENTRADA LIMPIA DE PIE:
    // Modelo open-football KEPT_AT_CONTACT (70% retención limpia en los pies, 30% desvío/punteo)
    player.stats.tackles.on++
    player.stats.tackles.standing = (player.stats.tackles.standing || 0) + 1
    setInjury(matchDetails, thatPlayer, player, false)

    if (common.getRandomNumber(1, 100) <= 70) {
      setSuccessTackle(matchDetails, team, opposition, player, thatPlayer, tackleDetails)
    } else {
      setPostTackleKnockedBall(matchDetails, team, opposition, player, thatPlayer, false)
      setPostTacklePosition(matchDetails, player, thatPlayer, tackleDetails.increment)
      matchDetails.iterationLog.push(`Standing tackle by ${player.name} pokes the ball away cleanly!`)
    }

    if (Array.isArray(matchDetails.events)) {
      matchDetails.events.push({
        type: 'standingTackle',
        outcome: 'won',
        teamID: team.teamID,
        teamName: team.name,
        playerName: player.name,
        victimName: thatPlayer.name,
        iteration: matchDetails.iterationCount || 0,
        half: matchDetails.half
      })
    }
    return false
  }

  // Entrada de pie fallida: no roba el balón pero permanece de pie (no queda congelado en el piso)
  player.stats.tackles.off++
  setInjury(matchDetails, player, thatPlayer, false)
  setPostTacklePosition(matchDetails, thatPlayer, player, tackleDetails.increment)
  matchDetails.iterationLog.push(`Failed standing tackle by: ${player.name} (remains on feet)`)
  return false
}

export function resolveSlide(player, team, opposition, matchDetails) {
  if (!player || !common.isOnPitch(player) || player.sentOff) return false
  matchDetails.iterationLog.push(`Slide tackle attempted by: ${player.name}`)
  const tackleDetails = {
    injuryHigh: 1500,
    injuryLow: 1400,
    increment: 3
  }
  const index = opposition.players.findIndex(thisPlayer => thisPlayer.playerID === matchDetails.ball.Player)
  if (index === -1) return false
  const thatPlayer = opposition.players[index]
  if (!player.stats.tackles) player.stats.tackles = { total: 0, on: 0, off: 0, fouls: 0, slides: 0, blocks: 0 }
  player.stats.tackles.total++
  player.stats.tackles.slides = (player.stats.tackles.slides || 0) + 1

  const foulProb = calculateFoulProbability(player, thatPlayer, true)
  if (common.getRandomNumber(1, 100) <= foulProb) {
    // Al cometer falta barriendo queda unos instantes en el piso
    player.slideRecoveryTicks = 3
    player.stunnedTicks = 3
    setFoul(matchDetails, team, player, thatPlayer)
    return true
  }

  const tackleScore = calcTackleScore(player.skill, 6, player)
  const retentionScore = calcRetentionScore(thatPlayer.skill, 5)

  if (tackleScore > retentionScore) {
    // BARRIDA EXITOSA:
    // Corta la jugada barriendo el césped. Se levanta tras 3 ticks de recuperación
    player.slideRecoveryTicks = 3
    player.stats.tackles.on++
    setInjury(matchDetails, thatPlayer, player, true)

    // En barridas al piso: 25% retiene directamente, 75% barre la pelota suelta o al lateral/córner
    if (common.getRandomNumber(1, 100) <= 25) {
      setSuccessTackle(matchDetails, team, opposition, player, thatPlayer, tackleDetails)
      matchDetails.iterationLog.push(`Spectacular slide tackle won by: ${player.name}`)
    } else {
      setPostTackleKnockedBall(matchDetails, team, opposition, player, thatPlayer, true)
      setPostTacklePosition(matchDetails, player, thatPlayer, tackleDetails.increment)
      matchDetails.iterationLog.push(`Slide tackle by: ${player.name} knocks the ball loose!`)
    }

    if (Array.isArray(matchDetails.events)) {
      matchDetails.events.push({
        type: 'slideTackle',
        outcome: 'won',
        teamID: team.teamID,
        teamName: team.name,
        playerName: player.name,
        victimName: thatPlayer.name,
        iteration: matchDetails.iterationCount || 0,
        half: matchDetails.half
      })
    }
    return false
  }

  // BARRIDA FALLIDA:
  // Se tiró al piso a destiempo, le erró y queda congelado en el piso 5 ticks (expuesto)
  player.slideRecoveryTicks = 5
  player.stunnedTicks = 5
  player.stats.tackles.off++
  setInjury(matchDetails, player, thatPlayer, true)
  setPostTacklePosition(matchDetails, thatPlayer, player, tackleDetails.increment + 2)
  matchDetails.iterationLog.push(`Missed slide tackle by: ${player.name} (exposed on ground!)`)

  if (Array.isArray(matchDetails.events)) {
    matchDetails.events.push({
      type: 'slideTackle',
      outcome: 'missed',
      teamID: team.teamID,
      teamName: team.name,
      playerName: player.name,
      victimName: thatPlayer.name,
      iteration: matchDetails.iterationCount || 0,
      half: matchDetails.half
    })
  }
  return false
}

export function setPostTackleKnockedBall(matchDetails, team, opposition, player, carrier, isSlide = false) {
  player.hasBall = false
  carrier.hasBall = false
  matchDetails.ball.Player = ''
  matchDetails.ball.withPlayer = false
  matchDetails.ball.withTeam = ''
  matchDetails.ball.lastTouch.playerName = player.name
  matchDetails.ball.lastTouch.playerID = player.playerID
  matchDetails.ball.lastTouch.teamID = team.teamID
  matchDetails.ball.lastTouch.deflection = true
  matchDetails.ball.lastTouch.iterations = 0

  const dx = carrier.currentPOS[0] - player.currentPOS[0]
  const dy = carrier.currentPOS[1] - player.currentPOS[1]
  const dist = Math.sqrt(dx * dx + dy * dy) || 1
  const normX = dx / dist
  const normY = dy / dist

  const angleJitter = (common.getRandomNumber(-35, 35) * Math.PI) / 180
  const knockX = normX * Math.cos(angleJitter) - normY * Math.sin(angleJitter)
  const knockY = normX * Math.sin(angleJitter) + normY * Math.cos(angleJitter)

  const knockPower = isSlide ? common.getRandomNumber(90, 150) : common.getRandomNumber(40, 85)
  const targetX = Math.max(10, Math.min(matchDetails.pitchSize[0] - 10, player.currentPOS[0] + knockX * (knockPower * 0.40)))
  const targetY = Math.max(10, Math.min(matchDetails.pitchSize[1] - 10, player.currentPOS[1] + knockY * (knockPower * 0.40)))

  const traj = common.getBallTrajectory(
    [player.currentPOS[0], player.currentPOS[1], 0],
    [targetX, targetY],
    knockPower,
    'loose',
    matchDetails.pitchSize[1]
  )
  matchDetails.ball.ballOverIterations = traj
  matchDetails.ball.position = traj[0] || [targetX, targetY, 0]
}

function setFailedTackle(matchDetails, player, thatPlayer, tackleDetails) {
  matchDetails.iterationLog.push(`Failed tackle by: ${player.name}`)
  player.stats.tackles.off++
  setInjury(matchDetails, player, thatPlayer, tackleDetails.increment >= 3)
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

export function setInjury(matchDetails, thatPlayer, player, isSlide = false) {
  // Riesgo de lesión por impacto de disputa física (Open Football Contact Model)
  const chanceTackled = isSlide ? 7 : 3
  if (common.getRandomNumber(1, 100) <= chanceTackled) {
    common.applyInjury(thatPlayer, 'contact', null, matchDetails)
  }
  const chanceTackler = isSlide ? 2 : 1
  if (common.getRandomNumber(1, 100) <= chanceTackler) {
    common.applyInjury(player, 'contact', null, matchDetails)
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
      actions[7].points += 25
      actions[8].points += 25
      return actions
    }
    const rawFactor = 1 - (ballZ / aerialMax)
    const heightFactor = Math.max(0, Math.min(1, rawFactor))
    actions[0].points *= heightFactor
    actions[1].points *= heightFactor
    actions[2].points *= heightFactor
    actions[3].points *= heightFactor
    actions[7].points += 15 * (1 - heightFactor)
    actions[8].points += 10 * (1 - heightFactor)
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

````
