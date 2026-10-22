import assert from 'assert'
import * as setPositions from '../src/engine/setPositions.js'
import * as setVariables from '../src/engine/setVariables.js'
import * as actions from '../src/engine/actions.js'
import * as playerMovement from '../src/engine/playerMovement.js'
import * as ballMovement from '../src/engine/ballMovement.js'
import * as common from '../src/engine/common.js'
import { PLAYERS_DB } from '../src/data/playersDB.js'
import { FORMATIONS } from '../src/data/formations.js'

console.log('\n======================================================================')
console.log('=== VERIFICACIÓN: CORNERS, PENALES, PELOTAS LARGAS Y CENTROS ===')
console.log('======================================================================\n')

function createTestPlayer(id, name, position, skillOverrides = {}, originPOS = [300, 300]) {
  return {
    id,
    playerID: id,
    name,
    position,
    tacticalRole: position,
    currentPOS: originPOS.slice(),
    originPOS: originPOS.slice(),
    intentPOS: originPOS.slice(),
    hasBall: false,
    offside: false,
    fitness: 100,
    height: 182,
    skill: {
      passing: 70,
      shooting: 70,
      tackling: 70,
      saving: 70,
      agility: 75,
      strength: 75,
      penalty_taking: 78,
      jumping: 75,
      perception: 75,
      control: 75,
      freekick: 70,
      ...skillOverrides
    },
    stats: {
      shots: { total: 0, on: 0, off: 0 },
      passes: { total: 0, on: 0, off: 0 },
      tackles: { total: 0, on: 0, off: 0 },
      saves: 0,
      goals: 0
    }
  }
}

function createTestTeam(teamID, name, isTop = false, pitchSize = [680, 1050]) {
  const [pitchWidth, pitchHeight] = pitchSize
  const yBase = isTop ? 100 : 950
  const yFwd = isTop ? 400 : 650
  return {
    teamID,
    name,
    intent: 'attack',
    mentality: 'balanced',
    gamePhase: 'Attack',
    formation: '4-3-3',
    playStyle: 'balanced',
    players: [
      createTestPlayer(`${teamID}-1`, `Arquero ${name}`, 'GK', { saving: 85, jumping: 80 }, [pitchWidth / 2, isTop ? 15 : pitchHeight - 15]),
      createTestPlayer(`${teamID}-2`, `Lateral D ${name}`, 'RB', { agility: 82 }, [100, isTop ? yBase + 80 : yBase - 80]),
      createTestPlayer(`${teamID}-3`, `Central 1 ${name}`, 'CB', { jumping: 86, height: 188, strength: 84 }, [260, isTop ? yBase + 70 : yBase - 70]),
      createTestPlayer(`${teamID}-4`, `Central 2 ${name}`, 'CB', { jumping: 88, height: 190, strength: 86 }, [420, isTop ? yBase + 70 : yBase - 70]),
      createTestPlayer(`${teamID}-5`, `Lateral I ${name}`, 'LB', { agility: 84 }, [580, isTop ? yBase + 80 : yBase - 80]),
      createTestPlayer(`${teamID}-6`, `Volante Central ${name}`, 'CDM', { passing: 74, strength: 80 }, [pitchWidth / 2, isTop ? yBase + 160 : yBase - 160]),
      createTestPlayer(`${teamID}-7`, `Volante Mixto ${name}`, 'CM', { passing: 76, shooting: 78 }, [220, isTop ? yBase + 200 : yBase - 200]),
      createTestPlayer(`${teamID}-8`, `Enganche ${name}`, 'CAM', { passing: 88, shooting: 82 }, [460, isTop ? yBase + 210 : yBase - 210]),
      createTestPlayer(`${teamID}-9`, `Extremo D ${name}`, 'RM', { agility: 90, passing: 78 }, [110, yFwd]),
      createTestPlayer(`${teamID}-10`, `Delantero Centro ${name}`, 'ST', { shooting: 88, jumping: 85, height: 186 }, [pitchWidth / 2, yFwd]),
      createTestPlayer(`${teamID}-11`, `Extremo I ${name}`, 'LM', { agility: 92, passing: 80 }, [570, yFwd])
    ]
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1: REGLAMENTACIÓN Y GEOMETRÍA DE PENALES
// ─────────────────────────────────────────────────────────────────────────────
console.log('=== TEST 1: REGLAMENTACIÓN Y GEOMETRÍA DE PENALES ===')
{
  const pitchSize = [680, 1050]
  const matchDetails = setVariables.populateMatchDetails(
    createTestTeam('T1', 'Boca Juniors', true, pitchSize),
    createTestTeam('T2', 'River Plate', false, pitchSize),
    { pitchWidth: pitchSize[0], pitchHeight: pitchSize[1], goalWidth: 90 }
  )

  // Ejecutar setTopPenalty (arco superior en Y = 0)
  setPositions.setTopPenalty(matchDetails)
  const penaltySpotTopY = Math.round(1050 * (11 / 105)) // 110px
  assert.strictEqual(matchDetails.ball.position[0], 340, 'Punto penal X debe estar centrado en 340px')
  assert.strictEqual(matchDetails.ball.position[1], penaltySpotTopY, `Punto penal Y debe estar en ${penaltySpotTopY}px (11 metros de la línea de gol)`)

  const taker = matchDetails.ball.Player
  const allPlayers = [...matchDetails.kickOffTeam.players, ...matchDetails.secondTeam.players]
  const fieldPlayers = allPlayers.filter(p => p.playerID !== taker && p.position !== 'GK' && common.isOnPitch(p))

  // Ningún jugador que no sea el pateador ni el arquero debe estar dentro del área penal (Y <= 165)
  // ni dentro del semicírculo de la medialuna (radio 92px desde [340, 110])
  for (const p of fieldPlayers) {
    const distToSpot = common.distance(p.currentPOS, [340, penaltySpotTopY])
    assert(p.currentPOS[1] >= 165, `El jugador ${p.name} no debe invadir el área penal (Y actual: ${p.currentPOS[1]}, mínimo permitido: 165)`)
    assert(distToSpot >= 92, `El jugador ${p.name} debe respetar los 9.15m de distancia (dist actual: ${distToSpot}px, mínimo permitido: 92px)`)
  }
  console.log(`  ✔ Top Penalty: Punto penal ubicado en Y=${penaltySpotTopY}px (11m). 0 jugadores invaden el área o la medialuna.`)

  // Ejecutar setBottomPenalty (arco inferior en Y = 1050)
  setPositions.setBottomPenalty(matchDetails)
  const penaltySpotBottomY = 1050 - penaltySpotTopY // 940px
  assert.strictEqual(matchDetails.ball.position[1], penaltySpotBottomY, `Bottom Penalty Y debe estar en ${penaltySpotBottomY}px (11 metros)`)
  const fieldPlayersBottom = allPlayers.filter(p => p.playerID !== matchDetails.ball.Player && p.position !== 'GK' && common.isOnPitch(p))
  for (const p of fieldPlayersBottom) {
    const distToSpot = common.distance(p.currentPOS, [340, penaltySpotBottomY])
    assert(p.currentPOS[1] <= 1050 - 165, `El jugador ${p.name} no debe invadir el área penal inferior (Y actual: ${p.currentPOS[1]})`)
    assert(distToSpot >= 92, `El jugador ${p.name} debe respetar los 9.15m de la medialuna inferior`)
  }
  console.log(`  ✔ Bottom Penalty: Punto penal en Y=${penaltySpotBottomY}px (11m). 0 invasiones reglamentarias comprobadas.`)
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2: DISTRIBUCIÓN REALISTA DE CÓRNERS (OPEN FOOTBALL CORNER SHAPE)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== TEST 2: DISTRIBUCIÓN REALISTA DE CÓRNERS (OPEN FOOTBALL MODEL) ===')
{
  const pitchSize = [680, 1050]
  const matchDetails = setVariables.populateMatchDetails(
    createTestTeam('T1', 'Boca Juniors', true, pitchSize),
    createTestTeam('T2', 'River Plate', false, pitchSize),
    { pitchWidth: pitchSize[0], pitchHeight: pitchSize[1], goalWidth: 90 }
  )

  // Configurar córner superior izquierdo
  setPositions.setTopLeftCornerPositions(matchDetails)
  const defTeam = (matchDetails.kickOffTeam.players[0].originPOS[1] > 525) ? matchDetails.secondTeam : matchDetails.kickOffTeam
  const attTeam = (defTeam.teamID === matchDetails.kickOffTeam.teamID) ? matchDetails.secondTeam : matchDetails.kickOffTeam

  // A. En defensa: verificar que haya un jugador adelantado de contragolpe (Outlet) cerca de mitad de cancha
  const outletPlayer = defTeam.players.find(p => p.currentPOS[1] >= 400 && p.position !== 'GK')
  assert(outletPlayer != null, 'Debe haber un jugador defensor (Outlet) en mitad de cancha para contraatacar')
  console.log(`  ✔ Delantero defensor adelantado para la contra (Outlet): ${outletPlayer.name} en Y=${outletPlayer.currentPOS[1]}px`)

  // B. En defensa: verificar que haya un jugador en la medialuna (EdgeClearer)
  const edgeClearer = defTeam.players.find(p => p.currentPOS[1] >= 180 && p.currentPOS[1] <= 240 && p.position !== 'GK')
  assert(edgeClearer != null, 'Debe haber un defensor en el borde del área (EdgeClearer) para rechazar balones sueltos')
  console.log(`  ✔ Defensor cuidando el borde del área (EdgeClearer): ${edgeClearer.name} en Y=${edgeClearer.currentPOS[1]}px`)

  // C. En ataque: verificar que 1 jugador espere en la medialuna (EdgeRunner para remate lejano)
  const edgeRunner = attTeam.players.find(p => p.currentPOS[1] >= 185 && p.currentPOS[1] <= 245 && p.position !== 'GK')
  assert(edgeRunner != null, 'Debe haber un atacante en la medialuna (EdgeRunner) para rematar de afuera el rebote')
  console.log(`  ✔ Atacante en la medialuna para cazar el rebote (EdgeRunner): ${edgeRunner.name} en Y=${edgeRunner.currentPOS[1]}px`)

  // D. En ataque: verificar retén defensivo de cobertura (2 jugadores atrás en su propio campo)
  const coverCount = attTeam.players.filter(p => p.currentPOS[1] >= 420 && p.position !== 'GK').length
  assert(coverCount >= 2, `Debe haber al menos 2 jugadores de ataque retenidos atrás cubriendo la contra (encontrados: ${coverCount})`)
  console.log(`  ✔ Retén defensivo de cobertura en ataque: ${coverCount} jugadores cubriendo la contra en campo propio.`)
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3: NERFEO DE PELOTAZOS LARGOS DESDE CAMPO PROPIO Y EXIGENCIA DE HABILIDAD
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== TEST 3: NERFEO DE PELOTAZOS LARGOS DESDE CAMPO PROPIO ===')
{
  const pitchSize = [680, 1050]
  const boca = createTestTeam('T1', 'Boca Juniors', true, pitchSize)
  const river = createTestTeam('T2', 'River Plate', false, pitchSize)
  const matchDetails = setVariables.populateMatchDetails(boca, river, { pitchWidth: 680, pitchHeight: 1050, goalWidth: 90 })

  // Defensor central rústico (passing: 62, sin traits de lanzador) en campo propio (distToGoalY = 700px)
  const defenderRustico = createTestPlayer('CB1', 'Central Rústico', 'CB', { passing: 62 }, [340, 350])
  defenderRustico.originPOS = [340, 200] // Boca ataca hacia abajo (Y = 1050), distToGoalY = 1050 - 350 = 700px (campo propio)
  defenderRustico.hasBall = true
  boca.players[2] = defenderRustico
  boca.gamePhase = 'BuildUp'

  // Delantero desmarcado en campo rival
  boca.players[9].currentPOS = [340, 750] // distToGoalY = 300px
  boca.players[9].offBallRun = { type: 'diagonalRun', untilIteration: 50, targetX: 340, targetY: 820 }

  const possActionsRustico = actions.findPossActions(defenderRustico, boca, river, 0, 0, matchDetails)
  const throughPtsRustico = possActionsRustico.find(a => a.name === 'throughBall')?.points || 0
  const passPtsRustico = possActionsRustico.find(a => a.name === 'pass')?.points || 0

  assert(throughPtsRustico <= 10, `Un defensor rústico en campo propio no debe abusar del pase largo al vacío (puntos: ${throughPtsRustico})`)
  assert(passPtsRustico >= throughPtsRustico * 3, `Un defensor rústico debe priorizar el pase corto/seguro de salida (pase: ${passPtsRustico} vs through: ${throughPtsRustico})`)
  console.log(`  ✔ Central rústico en campo propio: Puntos throughBall: ${throughPtsRustico} | Puntos pass seguro: ${passPtsRustico}`)

  // Defensor especialista lanzador o armador (passing: 88, trait lanzador_canonero)
  const defenderEspecialista = createTestPlayer('CB2', 'Central Especialista', 'CB', { passing: 88 }, [340, 350])
  defenderEspecialista.originPOS = [340, 200]
  defenderEspecialista.traits = ['lanzador_canonero']
  defenderEspecialista.hasBall = true
  boca.players[2] = defenderEspecialista

  const possActionsEspecialista = actions.findPossActions(defenderEspecialista, boca, river, 0, 0, matchDetails)
  const throughPtsEspecialista = possActionsEspecialista.find(a => a.name === 'throughBall')?.points || 0
  assert(throughPtsEspecialista >= 20, `Un central especialista con pase 88 y rasgo lanzador sí puede habilitar en largo (puntos: ${throughPtsEspecialista})`)
  console.log(`  ✔ Central especialista lanzador (Pass 88): Puntos throughBall: ${throughPtsEspecialista} (habilitado como recurso de calidad)`)
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4: PERSECUCIÓN EN SPRINT DE DEFENSORES Y DUELO AÉREO EN CENTROS
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== TEST 4: PERSECUCIÓN EN SPRINT DE DEFENSORES Y DUELOS AÉREOS ===')
{
  const pitchSize = [680, 1050]
  const boca = createTestTeam('T1', 'Boca Juniors', true, pitchSize)
  const river = createTestTeam('T2', 'River Plate', false, pitchSize)
  const matchDetails = setVariables.populateMatchDetails(boca, river, { pitchWidth: 680, pitchHeight: 1050, goalWidth: 90 })

  // Boca tiene la pelota en banda con extremo desbordando
  matchDetails.ball.position = [80, 920, 0]
  matchDetails.ball.withTeam = boca.teamID
  matchDetails.ball.withPlayer = true
  boca.players[8].hasBall = true // Extremo con pelota

  // Delantero centro de Boca pica al área (boxCrash)
  boca.players[9].currentPOS = [340, 880]
  boca.players[9].offBallRun = { type: 'boxSlotEntry', untilIteration: 50, targetX: 340, targetY: 960 }
  boca.attackPlan = { boxSlots: { penaltySpot: boca.players[9].playerID } }

  // Defensor central de River asignado a la marca personal (Mark)
  const defRiver = river.players[2] // CB
  river.defensivePlan = {
    duties: {
      [defRiver.playerID]: { duty: 'Mark', targetID: boca.players[9].playerID }
    }
  }

  // Decidir movimientos de River
  const riverMoves = playerMovement.decideMovement(river.players[0], river, boca, matchDetails)
  const defMove = riverMoves.find(m => m.player.playerID === defRiver.playerID)
  assert.strictEqual(defMove?.action, 'sprint', 'El defensor con marca asignada sobre un atacante que pica al área debe activar sprint')
  console.log(`  ✔ Marcador central acompañando el desmarque al área: Acción = '${defMove.action}' (persigue en sprint sin quedarse parado)`)

  // Simular centros disputados en el área chica/penal entre atacante y defensor
  let defClearances = 0
  let attHeaders = 0
  let gkClaims = 0
  defRiver.currentPOS = [340, 946] // Defensor en proximidad del punto de impacto (a 4px de distancia)

  for (let i = 0; i < 60; i++) {
    matchDetails.ball.isAerialCrossDelivery = true
    matchDetails.ball.kickType = 'cross'
    matchDetails.ball.lastTouch.teamID = boca.teamID
    matchDetails.ball.targetPlayerID = boca.players[9].playerID
    matchDetails.ball.saveChecked = false

    // Defensor de River y Arquero en el área
    const res = ballMovement.thisPlayerIsInProximity(
      matchDetails,
      defRiver,
      [340, 950, 18],
      [340, 950, 18],
      120,
      river
    )
    if (matchDetails.iterationLog.some(l => l.includes('Defensive headed clearance') || l.includes('ball kicked by'))) {
      defClearances++
    }
  }
  console.log(`  ✔ Duelo Aéreo en Centros: En 60 centros con marca cercana, los defensores lograron ${defClearances} despejes de cabeza exitosos.`)
  assert(defClearances > 0, 'Los defensores deben registrar despejes de cabeza en centros disputados')
}

console.log('\n======================================================================')
console.log('=== ¡TODAS LAS VERIFICACIONES DE CORNERS, PENALES Y PASES COMPLETADAS! ===')
console.log('======================================================================\n')
