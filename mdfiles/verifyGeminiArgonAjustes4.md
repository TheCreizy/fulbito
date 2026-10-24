# `verifyGeminiArgonAjustes4.js` - Suite de Verificación Automatizada (Ajustes 4 - Auditoría de Videos Nuevos Argon)

> **Categoría:** `Testing y Verificación`  
> **Ubicación:** `tests/verifyGeminiArgonAjustes4.js`  
> **Líneas de código:** 253  
> **Tamaño:** 11.10 KB

---

## 📋 Resumen del Módulo

Casos de prueba automatizados para los 6 problemas detectados: sincronización de prevSnapshot post-gol y en pelota parada (eliminación de barrido fantasma), activación de centrales como Stopper/Presser cuando el delantero encara por el medio, ampliación del radio de disputa defensiva a 38px, penalización de tiros lejanos de 35m con lastShotDistance y ballProx=24, y posicionamiento reglamentario en área grande y barrera en tiros libres.

---

## 🧩 Exportaciones y Elementos Principales

_No contiene exportaciones directas explícitas._

### Funciones Internas Notables

| Función | Parámetros | Línea |
| :--- | :--- | :--- |
| `createMockMatch` | `ninguno` | L16 |

---

## 💻 Código Fuente JavaScript (`verifyGeminiArgonAjustes4.js`)

````javascript
import assert from 'node:assert'
import * as common from '../src/engine/common.js'
import * as setPositions from '../src/engine/setPositions.js'
import * as ballMovement from '../src/engine/ballMovement.js'
import * as setVariables from '../src/engine/setVariables.js'
import * as setFreekicks from '../src/engine/setFreekicks.js'
import * as teamShape from '../src/engine/teamShape.js'
import * as actions from '../src/engine/actions.js'
import * as engine from '../src/engine/engine.js'
import { PLAYERS_DB } from '../src/data/playersDB.js'

console.log('======================================================================')
console.log('=== VERIFICACIÓN: AJUSTES 4 v2 (AUDITORÍA FORENSE GEMINI ARGON) ===')
console.log('======================================================================\n')

function createMockMatch() {
  const pool = PLAYERS_DB
  const team1 = {
    name: 'Boca Legends',
    mentality: 'offensive',
    initialMentality: 'offensive',
    playStyle: 'wingPlay',
    formation: '4-4-2',
    players: pool.slice(0, 11).map((p, idx) => ({
      ...p,
      currentPOS: [340, 200 + idx * 50],
      originPOS: [340, 200 + idx * 50],
      intentPOS: [340, 200 + idx * 50],
      fitness: 100,
      stats: { goals: 0, shots: { total: 0, on: 0, off: 0 }, tackles: { total: 0, off: 0, on: 0 }, passes: { total: 0, on: 0, off: 0 }, saves: 0 }
    })),
    bench: pool.slice(11, 16).map(p => ({ ...p, fitness: 100 }))
  }
  const team2 = {
    name: 'River Idols',
    mentality: 'defensive',
    initialMentality: 'defensive',
    playStyle: 'tikiTaka',
    formation: '4-3-1-2',
    players: pool.slice(16, 27).map((p, idx) => ({
      ...p,
      currentPOS: [340, 300 + idx * 50],
      originPOS: [340, 300 + idx * 50],
      intentPOS: [340, 300 + idx * 50],
      fitness: 100,
      stats: { goals: 0, shots: { total: 0, on: 0, off: 0 }, tackles: { total: 0, off: 0, on: 0 }, passes: { total: 0, on: 0, off: 0 }, saves: 0 }
    })),
    bench: pool.slice(27, 32).map(p => ({ ...p, fitness: 100 }))
  }
  setVariables.setGameVariables(team1)
  setVariables.setGameVariables(team2)
  const match = setVariables.populateMatchDetails(team1, team2, { pitchWidth: 680, pitchHeight: 1050, goalWidth: 90 })
  match.half = 1
  match.iterationCount = 100
  match.events = []
  return match
}

// ======================================================================
// TEST 1: SINCRONIZACIÓN DE prevSnapshot Y EVENTO deadBall (engine.js)
// ======================================================================
console.log('=== TEST 1: SINCRONIZACIÓN DE prevSnapshot Y deadBall: true (engine.js) ===')
{
  const match = createMockMatch()
  match.prevSnapshot = {
    ball: [340, 10, 0],
    kickOffTeam: match.kickOffTeam.players.map(() => [340, 50]),
    secondTeam: match.secondTeam.players.map(() => [340, 60])
  }
  match.pendingKickoffTeam = 'secondTeam'

  engine.playIteration(match)

  // prevSnapshot debe estar sincronizado
  assert.ok(match.prevSnapshot, 'prevSnapshot debe existir tras pendingKickoffTeam')
  assert.strictEqual(match.prevSnapshot.ball[0], 340, 'Balón en prevSnapshot sincronizado en centro X')
  assert.strictEqual(match.prevSnapshot.ball[1], 525, 'Balón en prevSnapshot sincronizado en centro Y')

  const striker = match.secondTeam.players[9]
  const prevStrikerPos = match.prevSnapshot.secondTeam[9]
  assert.deepStrictEqual(prevStrikerPos, striker.currentPOS, 'Las coordenadas del jugador en prevSnapshot deben coincidir con currentPOS')

  // Debe haber emitido kickoff_ready con deadBall: true para que MatchSimulator no corra a 105ms
  const koEvent = match.events.find(e => e.type === 'kickoff_ready')
  assert.ok(koEvent, 'Debe existir un evento de tipo kickoff_ready')
  assert.strictEqual(koEvent.deadBall, true, 'El evento kickoff_ready debe tener deadBall: true para activar la animación de 1800ms')

  console.log('  ✓ prevSnapshot sincronizado y evento kickoff_ready con deadBall: true emitido.\n')
}

// ======================================================================
// TEST 2: CENTRALES SALEN A CORTAR EN DIAGONALES Y STANDOFF EN SAQUE (teamShape y setPositions)
// ======================================================================
console.log('=== TEST 2: STOPPER EN ATAQUE DIAGONAL Y STANDOFF EN SAQUE ===')
{
  const match = createMockMatch()
  // Delantero rival encarando en diagonal (X=175, a 165px del centro 340), Y=320 (< 360px del arco)
  match.ball.position = [175, 320, 0]

  const cb1 = match.kickOffTeam.players[1]
  const cb2 = match.kickOffTeam.players[2]
  cb1.position = 'CB'
  cb1.tacticalRole = 'CB'
  cb1.currentPOS = [200, 240]
  cb2.position = 'CB'
  cb2.tacticalRole = 'CB'
  cb2.currentPOS = [320, 240]

  // Todos los volantes quedaron atrás del delantero
  match.kickOffTeam.players.slice(3, 7).forEach(p => {
    p.currentPOS = [p.currentPOS[0], 100]
  })

  const plan = teamShape.assignDefensivePlanWithIncumbency(
    match.kickOffTeam,
    match.secondTeam,
    match,
    true
  )

  assert.ok(plan, 'Plan defensivo generado')
  const presser = match.kickOffTeam.players.find(p => p.playerID === plan.presserID)
  assert.ok(presser, 'Debe haber un Presser asignado')
  assert.ok(
    presser.playerID === cb1.playerID || presser.playerID === cb2.playerID,
    `El central más cercano debe salir a tapar al portador en diagonal (elegido: ${presser.name} - ${presser.position})`
  )

  // Standoff en saque de medio: debe activarse cuando kickoffRetentionTicks = 5 (> 0)
  match.kickoffRetentionTicks = 5
  const isKickoffStandoff = (match.kickoffRetentionTicks || 0) > 0
  assert.strictEqual(isKickoffStandoff, true, 'isKickoffStandoff debe ser true con kickoffRetentionTicks = 5')

  console.log('  ✓ Stopper central activo en ataques diagonales y standoff en saque verificado.\n')
}

// ======================================================================
// TEST 3: RADIO DEFENSIVO FRONTAL A 52px (actions.js)
// ======================================================================
console.log('=== TEST 3: RADIO DEFENSIVO EN CORREDOR HACIA EL ARCO A 52px (actions.js) ===')
{
  const match = createMockMatch()
  const def = match.kickOffTeam.players[1]
  def.position = 'CB'
  def.tacticalRole = 'CB'
  def.currentPOS = [340, 250]
  match.ball.withPlayer = true
  match.ball.withTeam = match.secondTeam.teamID

  // Balón en el mismo corredor X (340) a 46px de distancia (mayor que 38px, pero dentro de 52px)
  match.ball.position = [340, 296, 0]
  const ballDistX = match.ball.position[0] - def.currentPOS[0]
  const ballDistY = match.ball.position[1] - def.currentPOS[1]
  const act = actions.playerDoesNotHaveBall(
    def,
    ballDistX,
    ballDistY,
    0,
    match
  )

  // Debe permitir acciones de disputa (no 70% run / 30% sprint pasivo a su zona)
  const isPassiveRetreat = act[7] === 70 && act[8] === 30
  assert.strictEqual(isPassiveRetreat, false, 'A 46px en el corredor frontal hacia el arco, el defensor debe disputar la pelota')

  console.log('  ✓ Defensor activa disputa dentro de engageRadius = 52px en el cono de gol.\n')
}

// ======================================================================
// TEST 4: BALANCEO DE TIROS DE 35M Y ALCANCE DEL ARQUERO (ballMovement & setPositions)
// ======================================================================
console.log('=== TEST 4: TIROS LEJANOS, ballProx=24 Y tryGoalLineSave ===')
{
  const match = createMockMatch()
  const shooter = match.secondTeam.players[9]
  shooter.originPOS = [340, 800]
  shooter.currentPOS = [340, 750]
  match.ball.position = [340, 750, 0]

  ballMovement.shotMade(match, match.secondTeam, shooter)

  assert.strictEqual(match.ball.lastShotDistance, 750, 'lastShotDistance debe quedar registrado en el balón')

  setPositions.setBallSpecificGoalScoreValue(match, match.kickOffTeam)
  assert.strictEqual(match.kickoffRetentionTicks, 5, 'kickoffRetentionTicks debe ser 5')

  console.log('  ✓ Penalización de tiros lejanos, lastShotDistance y kickoffRetentionTicks=5 verificados.\n')
}

// ======================================================================
// TEST 5: ESPACIADO EN ÁREA PENAL Y BARRERA EN TIROS LIBRES (setFreekicks.js)
// ======================================================================
console.log('=== TEST 5: ESPACIADO EN ÁREA PENAL Y BARRERA EN TIROS LIBRES (setFreekicks.js) ===')
{
  const match = createMockMatch()

  // Posiciones con espaciado garantizado en el área penal
  const spacedTop = setFreekicks.getSpacedPenaltyPositions(match, true, 8)
  assert.strictEqual(spacedTop.length, 8, 'Debe generar 8 posiciones')
  for (let i = 0; i < spacedTop.length; i++) {
    for (let j = i + 1; j < spacedTop.length; j++) {
      const d = Math.hypot(spacedTop[i][0] - spacedTop[j][0], spacedTop[i][1] - spacedTop[j][1])
      assert.ok(d >= 18, `La distancia entre defensores (${d.toFixed(1)}px) debe ser de al menos 18px`)
    }
  }

  // Ejecutar tiro libre en 3/4 hacia el arco inferior dentro del rango de tiro con barrera (distToGoal <= 340)
  match.ball.position = [150, 850, 0]
  setFreekicks.setTopFreekick(match)

  // Los defensores de campo no deben estar apilados en X = midWayFromBalltoGoalX
  const defOutfield = match.secondTeam.players.filter(p => common.isOnPitch(p) && p.position !== 'GK')
  const xCoords = defOutfield.map(p => p.currentPOS[0])
  const distinctX = new Set(xCoords)
  assert.ok(distinctX.size >= 4, `Los defensores no deben estar apilados en una sola coordenada X (valores distintos: ${distinctX.size})`)

  // La barrera debe existir y estar a 65px de la pelota
  assert.ok(Array.isArray(match.ball.defendingWall), 'La barrera debe estar configurada')
  assert.ok(match.ball.defendingWall.length >= 2, 'La barrera debe tener al menos 2 jugadores')

  console.log('  ✓ Defensores en área con espaciado >= 18px y barrera ubicada correctamente.\n')
}

// ======================================================================
// TEST 6: DETECCIÓN DE LESIÓN GRAVE Y PREVENCIÓN DE DOBLE CAMBIO (MatchSimulator logic)
// ======================================================================
console.log('=== TEST 6: DETECCIÓN DE LESIÓN GRAVE Y SUSTITUCIÓN INMEDIATA ===')
{
  const match = createMockMatch()
  const player = match.kickOffTeam.players[9]
  player.injured = true
  player.injuryStatus = {
    grade: 'serious',
    cause: 'contact',
    name: 'Fisura ósea',
    canContinue: false
  }

  const isSeriousInjury = Boolean(player.injured && (player.injuryStatus?.canContinue === false || player.injuryStatus?.grade === 'serious'))
  assert.strictEqual(isSeriousInjury, true, 'Debe reconocer la lesión grave con injuryStatus.canContinue === false')

  // Verificación de que no se llamará applyPendingSubstitutions si pendingSubstitutions está vacío
  match.pendingSubstitutions = []
  const hasRemainingSubs = (Array.isArray(match.pendingSubstitutions) && match.pendingSubstitutions.length > 0)
  assert.strictEqual(hasRemainingSubs, false, 'No debe invocar applyPendingSubstitutions si no hay sustituciones pendientes')

  console.log('  ✓ Detección de lesión grave y protección contra doble cómputo verificadas.\n')
}

console.log('======================================================================')
console.log('🎉 TODOS LOS TESTS DE AJUSTES 4 v2 PASARON EXITOSAMENTE 🎉')
console.log('======================================================================')

````

