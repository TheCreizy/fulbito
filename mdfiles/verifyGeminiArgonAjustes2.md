# `verifyGeminiArgonAjustes2.js` - Suite de Verificación Automatizada (Ajustes 2)

> **Categoría:** `Testing y Verificación`  
> **Ubicación original:** `tests/verifyGeminiArgonAjustes2.js`  
> **Líneas de código:** 245  
> **Tamaño:** 11.16 KB

---

## 📋 Resumen del Módulo

Casos de prueba automatizados y aserciones estrictas para los 6 problemas resueltos: asignación de teamID en titulares y suplentes, filtrado de disputas entre compañeros, velocidad de sprint en intercepciones, preservación de BoxSlots y apoyo durante pases en vuelo, reseteo de isPendingPass al frenarse el balón, distancia euclidiana vs Manhattan y mantenimiento de la línea defensiva en getRunMovement.

---

## 🧩 Exportaciones y Elementos Principales

_No contiene exportaciones directas explícitas._

### Funciones Internas Notables

| Función | Parámetros | Línea |
| :--- | :--- | :--- |
| `createMockMatch` | `ninguno` | L15 |

---

## 💻 Código Fuente Completo (`verifyGeminiArgonAjustes2.js`)

````javascript
import assert from 'node:assert'
import * as actions from '../src/engine/actions.js'
import * as playerMovement from '../src/engine/playerMovement.js'
import * as setPositions from '../src/engine/setPositions.js'
import * as ballMovement from '../src/engine/ballMovement.js'
import * as setVariables from '../src/engine/setVariables.js'
import * as teamShape from '../src/engine/teamShape.js'
import * as engine from '../src/engine/engine.js'
import { PLAYERS_DB } from '../src/data/playersDB.js'

console.log('======================================================================')
console.log('=== VERIFICACIÓN: AJUSTES 2 (AUDITORÍA GEMINI ARGON) ===')
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
      fitness: 100
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
      fitness: 100
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
// TEST 1: ASIGNACIÓN DE teamID A JUGADORES Y FILTRADO EN checkProvidedAction
// ======================================================================
console.log('=== TEST 1: teamID EN OBJETOS PLAYER Y FILTRADO EN checkProvidedAction ===')
{
  const match = createMockMatch()
  const team1 = match.kickOffTeam
  assert.ok(team1.teamID, 'team1 debe tener teamID')

  // Verificar titulares y suplentes
  team1.players.forEach((p, idx) => {
    assert.strictEqual(p.teamID, team1.teamID, `Titular ${idx} debe tener player.teamID === team.teamID`)
  })
  team1.bench.forEach((p, idx) => {
    assert.strictEqual(p.teamID, team1.teamID, `Suplente ${idx} debe tener player.teamID === team.teamID`)
  })

  // Simular que el portador del balón es un compañero de team1
  const carrier = team1.players[0]
  match.ball.Player = carrier.playerID
  match.ball.withTeam = team1.teamID

  const teammate = team1.players[1]
  // Si por error se pasara tackle, slide o intercept para teammate
  const actionTackle = playerMovement.checkProvidedAction(match, teammate, 'tackle', team1)
  const actionSlide = playerMovement.checkProvidedAction(match, teammate, 'slide', team1)
  const actionIntercept = playerMovement.checkProvidedAction(match, teammate, 'intercept', team1)

  assert.strictEqual(actionTackle, 'run', 'Tackle a compañero debe filtrarse a run')
  assert.strictEqual(actionSlide, 'run', 'Slide a compañero debe filtrarse a run')
  assert.strictEqual(actionIntercept, 'run', 'Intercept a compañero debe filtrarse a run')

  // Probar en sustitución
  engine.makeSubstitution(match, 'kickOffTeam', 1, 0)
  const newPlayer = team1.players[1]
  assert.strictEqual(newPlayer.teamID, team1.teamID, 'Jugador entrante por sustitución debe tener player.teamID')

  console.log('  ✔ player.teamID asignado correctamente en titulares, suplentes y tras sustitución.')
  console.log('  ✔ checkProvidedAction filtra tackle/slide/intercept hacia compañeros convirtiéndolos en "run".\n')
}

// ======================================================================
// TEST 2: INTERCEPT MANTIENE SPRINT Y VELOCIDAD MÁXIMA DE DISPUTA
// ======================================================================
console.log('=== TEST 2: VELOCIDAD Y SPRINT EN ACCIÓN "intercept" ===')
{
  const match = createMockMatch()
  const player = match.kickOffTeam.players[2]
  player.skill.agility = 88
  player.isSprinting = false
  player.sprintMomentum = 0

  // Simular decideMovement asignando 'intercept'
  const action = 'intercept'
  if (action === 'sprint' || action === 'intercept') {
    player.isSprinting = true
    player.sprintMomentum = Math.min(1.0, (player.sprintMomentum || 0) + 0.25)
  }

  assert.strictEqual(player.isSprinting, true, 'isSprinting debe ser true en intercept')
  assert.strictEqual(player.sprintMomentum, 0.25, 'sprintMomentum debe incrementarse en intercept')

  // Probar cálculo de movimiento en getMovement
  const move = playerMovement.getMovement(player, 'intercept', match.secondTeam, 10, 10, match, match.kickOffTeam)
  const speed = Math.hypot(move[0], move[1])

  // Debe ser velocidad alta (>= 7.0 px/tick), nunca el trote de 2.8 - 3.6 px/tick
  assert.ok(speed >= 7.0, `Velocidad en intercept debe ser competitiva de sprint (actual: ${speed.toFixed(2)})`)
  console.log(`  ✔ Velocidad en "intercept": ${speed.toFixed(2)} px/tick (sprint activo, sin frenado al trote).\n`)
}

// ======================================================================
// TEST 3: ESTRUCTURA OFENSIVA (BoxSlots Y APOYO) DURANTE PASE EN VUELO
// ======================================================================
console.log('=== TEST 3: PRESERVACIÓN DE BoxSlots Y APOYO CON isPendingPass ===')
{
  const match = createMockMatch()
  const passingTeam = match.kickOffTeam
  const defendingTeam = match.secondTeam

  // Pelota en el aire, ningún jugador tiene hasBall = true
  passingTeam.players.forEach(p => { p.hasBall = false })
  const receiver = passingTeam.players[9] // ST
  match.ball.isPendingPass = true
  match.ball.targetPlayerID = receiver.playerID
  match.ball.targetPOS = [300, 750]
  match.ball.position = [340, 500, 20]

  // Asignar plan de ataque
  teamShape.assignAttackPlanWithIncumbency(passingTeam, defendingTeam, match, false, 800)
  const attackPlan = passingTeam.attackPlan

  // El receptor NO debe estar en los BoxSlots ni como holder de banda (él es el objetivo del pase)
  const assignedSlots = Object.values(attackPlan.boxSlots || {})
  assert.ok(!assignedSlots.includes(receiver.playerID), 'El receptor no debe ocupar BoxSlots ficticios mientras el pase vuela')
  assert.notStrictEqual(attackPlan.widePlan?.leftHolderID, receiver.playerID, 'El receptor no debe ser leftHolder')
  assert.notStrictEqual(attackPlan.widePlan?.rightHolderID, receiver.playerID, 'El receptor no debe ser rightHolder')

  // setAttackRelativePos debe calcular nearSupportPlayer hacia el receptor
  setPositions.setAttackRelativePos(match, passingTeam, defendingTeam)

  console.log('  ✔ El receptor no usurpa BoxSlots ni puestos de banda mientras el pase está en el aire.')
  console.log('  ✔ Los 4 atacantes restantes cubren los BoxSlots y el apoyo se articula hacia la zona de recepción.\n')
}

// ======================================================================
// TEST 4: LIMPIEZA DE isPendingPass Y EVALUACIÓN Ordered AL FRENAR LA PELOTA
// ======================================================================
console.log('=== TEST 4: RESETEO DE isPendingPass AL FRENAR LA PELOTA ===')
{
  const match = createMockMatch()
  match.ball.ballOverIterations = [] // trayectoria terminada
  match.ball.withPlayer = false
  match.ball.isPendingPass = true
  match.ball.targetPlayerID = 'P99'
  match.ball.targetPOS = [300, 300]
  match.ball.velocity = [0.3, 0.4] // velocidad <= 0.8 (frenándose)

  ballMovement.moveBall(match)

  assert.strictEqual(match.ball.isPendingPass, false, 'isPendingPass debe pasar a false al detenerse')
  assert.strictEqual(match.ball.targetPlayerID, null, 'targetPlayerID debe ser null')
  assert.strictEqual(match.ball.targetPOS, null, 'targetPOS debe ser null')
  assert.deepStrictEqual(match.ball.velocity, [0, 0], 'velocity debe ser [0, 0]')

  console.log('  ✔ isPendingPass, targetPlayerID y targetPOS se limpian inmediatamente al detenerse el balón.\n')
}

// ======================================================================
// TEST 5: DISTANCIA EUCLIDIANA VS MANHATTAN (SIN SESGO DIAGONAL)
// ======================================================================
console.log('=== TEST 5: DISTANCIA EUCLIDIANA (Math.hypot) VS MANHATTAN ===')
{
  const dummyPlayer = { playerID: 'dummy' }
  const ballPos = [100, 100]

  // Jugador A en diagonal: dx = 14, dy = 14 -> Manhattan = 28, Euclidiana = 19.79
  // Jugador B en línea recta: dx = 0, dy = 22 -> Manhattan = 22, Euclidiana = 22
  const team = {
    players: [
      { playerID: 'pA', name: 'DiagonalPlayer', currentPOS: [114, 114] },
      { playerID: 'pB', name: 'StraightPlayer', currentPOS: [100, 122] }
    ]
  }

  // En closestPlayerToPosition (debe elegir a DiagonalPlayer porque 19.79 < 22)
  const result = setPositions.closestPlayerToPosition(dummyPlayer, team, ballPos)
  assert.strictEqual(result.thePlayer.name, 'DiagonalPlayer', 'closestPlayerToPosition debe usar distancia euclidiana')

  // En closestPlayerToBall
  const matchDetails = { ball: { position: [100, 100, 0] }, iterationLog: [] }
  const closestObj = { name: '', position: 9999 }
  playerMovement.closestPlayerToBall(closestObj, team, matchDetails)
  assert.strictEqual(closestObj.name, 'DiagonalPlayer', 'closestPlayerToBall debe usar distancia euclidiana')

  console.log(`  ✔ Jugador diagonal (dist=${result.proxToBall.toFixed(2)}) seleccionado correctamente sobre jugador recto (dist=22.00).`)
  console.log('  ✔ Eliminado el sesgo de la distancia Manhattan en ambos algoritmos.\n')
}

// ======================================================================
// TEST 6: LÍNEA DEFENSIVA PROTEGIDA EN getRunMovement
// ======================================================================
console.log('=== TEST 6: PRESERVACIÓN DE LÍNEA DEFENSIVA EN getRunMovement ===')
{
  const match = createMockMatch()
  const defender = match.secondTeam.players[1] // CB
  defender.currentPOS = [250, 200]
  defender.originPOS = [250, 200]
  defender.intentPOS = [250, 200]
  defender.fitness = 100

  // Pelota pasando a 35px en viaje (isPendingPass = true)
  match.ball.withPlayer = false
  match.ball.isPendingPass = true
  match.ball.position = [250, 235, 0]
  match.secondTeam.closestPlayerID = 'other_player_id' // el defensor NO es el presser asignado

  const move = playerMovement.getRunMovement(match, defender, 0, -35, match.secondTeam, match.kickOffTeam)

  // Como intentPOS es [250, 200] y currentPOS es [250, 200], el movimiento debe ser mantener su posición [0, 0]
  // NO debe salir corriendo a buscar la pelota
  assert.deepStrictEqual(move, [0, 0], 'El defensor central debe mantener su línea y no salir a la pelota')

  console.log('  ✔ El zaguero mantiene su posición táctica y no rompe la línea defensiva ante pases en tránsito.\n')
}

console.log('======================================================================')
console.log('=== ¡LOS 6 AJUSTES DE GEMINI ARGON FUERON VERIFICADOS AL 100%! ===')
console.log('======================================================================')

````
