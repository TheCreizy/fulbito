import assert from 'assert'
import { PLAYERS_DB } from '../src/data/playersDB.js'
import * as setVariables from '../src/engine/setVariables.js'
import * as setPositions from '../src/engine/setPositions.js'
import * as actions from '../src/engine/actions.js'
import * as playerMovement from '../src/engine/playerMovement.js'
import * as ballMovement from '../src/engine/ballMovement.js'
import * as commentaryEngine from '../src/commentary/commentaryEngine.js'
import * as common from '../src/engine/common.js'

console.log('\n=================================================================================')
console.log('=== VERIFICACIÓN: NUEVOS ATRIBUTOS, CANSANCIO DINÁMICO Y DETALLES DE GOL ===')
console.log('=================================================================================\n')

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1: NUEVOS ATRIBUTOS EN LOS 200 JUGADORES (RESISTENCIA Y CABEZA)
// ─────────────────────────────────────────────────────────────────────────────
console.log('=== TEST 1: ATRIBUTOS RESISTENCIA Y CABEZA EN BASE DE DATOS ===')
{
  assert.strictEqual(PLAYERS_DB.length, 200, 'Deben existir 200 jugadores en PLAYERS_DB')

  let missingStamina = 0
  let missingHeading = 0

  for (const p of PLAYERS_DB) {
    const s = p.skill
    if (s.stamina === undefined || s.resistencia === undefined) missingStamina++
    if (s.heading === undefined || s.cabeza === undefined) missingHeading++

    // Alias en español e inglés deben ser exactamente iguales
    assert.strictEqual(s.stamina, s.resistencia, `Alias stamina/resistencia debe coincidir en ${p.name}`)
    assert.strictEqual(s.heading, s.cabeza, `Alias heading/cabeza debe coincidir en ${p.name}`)
    assert(s.stamina >= 50 && s.stamina <= 99, `Resistencia de ${p.name} (${s.stamina}) debe estar en rango 50-99`)
    assert(s.heading >= 35 && s.heading <= 99, `Cabeza de ${p.name} (${s.heading}) debe estar en rango 35-99`)
  }

  assert.strictEqual(missingStamina, 0, 'Todos los 200 jugadores deben tener stamina y resistencia')
  assert.strictEqual(missingHeading, 0, 'Todos los 200 jugadores deben tener heading y cabeza')
  console.log('  ✔ Los 200 jugadores de la base poseen resistencia (RES) y cabeza (CAB) en rangos válidos.')

  // Validación de arquetipos emblemáticos:
  const palermo = PLAYERS_DB.find(p => p.id === 21)
  const passarella = PLAYERS_DB.find(p => p.id === 20)
  const ayala = PLAYERS_DB.find(p => p.id === 30)
  const zanetti = PLAYERS_DB.find(p => p.id === 33)
  const simeone = PLAYERS_DB.find(p => p.id === 36)
  const riquelme = PLAYERS_DB.find(p => p.id === 5)

  assert(palermo.skill.heading >= 98, `Martín Palermo debe tener cabeza de élite (esperado >=98, actual ${palermo.skill.heading})`)
  assert(palermo.traits.includes('cabeceador_nato'), 'Palermo debe tener el trait cabeceador_nato')
  assert(passarella.skill.heading >= 95, `Daniel Passarella debe tener cabeza >= 95 (actual ${passarella.skill.heading})`)
  assert(ayala.skill.heading >= 95, `Roberto Ayala debe tener cabeza >= 95 (actual ${ayala.skill.heading})`)
  assert(zanetti.skill.stamina >= 95, `Javier Zanetti debe ser un tractor de resistencia (actual ${zanetti.skill.stamina})`)
  assert(simeone.skill.stamina >= 95, `Diego Simeone debe tener resistencia >= 95 (actual ${simeone.skill.stamina})`)
  assert(riquelme.skill.stamina <= 72, `Riquelme debe tener menor resistencia continua de repliegue (actual ${riquelme.skill.stamina})`)

  console.log(`  ✔ Arquetipos verificados: Palermo (CAB ${palermo.skill.heading}), Passarella (CAB ${passarella.skill.heading}), Zanetti (RES ${zanetti.skill.stamina}), Riquelme (RES ${riquelme.skill.stamina}).`)
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2: SISTEMA DE CANSANCIO DINÁMICO, DISTANCIA Y ACCIONES
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== TEST 2: CANSANCIO DINÁMICO, DISTANCIA Y ACCIONES FÍSICAS ===')
{
  const pitchSize = [680, 1050]
  const mockTeamA = {
    teamID: 'TA',
    name: 'Boca',
    mentality: 'balanced',
    players: []
  }
  const mockTeamB = {
    teamID: 'TB',
    name: 'River',
    mentality: 'balanced',
    players: []
  }
  const matchDetails = setVariables.populateMatchDetails(mockTeamA, mockTeamB, { pitchWidth: pitchSize[0], pitchHeight: pitchSize[1], goalWidth: 90 })

  function makePlayer(id, name, pos, stamina, fitness = 100) {
    return {
      id,
      playerID: id,
      name,
      position: pos,
      tacticalRole: pos,
      currentPOS: [340, 525],
      originPOS: [340, 525],
      intentPOS: [340, 525],
      fitness,
      skill: {
        agility: 80,
        strength: 75,
        stamina,
        resistencia: stamina,
        heading: 70,
        cabeza: 70,
        tackling: 80
      },
      stats: {
        distanceCovered: 0,
        shots: { total: 0, on: 0, off: 0 },
        passes: { total: 0, on: 0, off: 0 },
        tackles: { total: 0, on: 0, off: 0, fouls: 0, slides: 0, blocks: 0 },
        cards: { yellow: 0, red: 0 }
      }
    }
  }

  // A. Acumulación de distancia recorrida:
  const runner = makePlayer('R1', 'Corredor', 'CM', 80)
  const moves = [{ player: runner, move: [8, 6], action: 'run' }] // desplazamiento = 10px = 1.0 metro
  playerMovement.movePlayers(moves, mockTeamA, mockTeamB, matchDetails)

  assert(runner.stats.distanceCovered > 0.9 && runner.stats.distanceCovered < 1.1, `La distancia recorrida debe acumularse (~1.0m, actual: ${runner.stats.distanceCovered}m)`)
  console.log(`  ✔ Distancia recorrida acumulada correctamente: ${runner.stats.distanceCovered} metros tras 10px de desplazamiento.`)

  // B. Diferenciación de desgaste por Resistencia (Zanetti 98 vs Veterano 55):
  const highStaminaPlayer = makePlayer('Z1', 'Zanetti', 'RB', 98, 100)
  const lowStaminaPlayer = makePlayer('V1', 'Veterano', 'RB', 55, 100)

  // Simular 80 sprints idénticos para ambos jugadores
  for (let i = 0; i < 80; i++) {
    matchDetails.iterationCount = i + 1
    playerMovement.getSprintMovement(matchDetails, highStaminaPlayer, 20, 20, mockTeamA, mockTeamB)
    playerMovement.getSprintMovement(matchDetails, lowStaminaPlayer, 20, 20, mockTeamA, mockTeamB)
  }

  const drainHigh = 100 - highStaminaPlayer.fitness
  const drainLow = 100 - lowStaminaPlayer.fitness
  assert(drainLow > drainHigh * 1.35, `El jugador con baja resistencia (${drainLow.toFixed(1)}%) debe desgastarse notablemente más que el de alta (${drainHigh.toFixed(1)}%)`)
  console.log(`  ✔ Desgaste por resistencia: Jugador con RES 55 perdió ${drainLow.toFixed(1)}% vs RES 98 que perdió solo ${drainHigh.toFixed(1)}% de fitness.`)

  // C. Desgaste extra por acciones de choque (barrida al piso y quite):
  const slideDefender = makePlayer('D1', 'Defensor Barrida', 'CB', 80, 100)
  const carrierOpp = makePlayer('C1', 'Atacante', 'ST', 80, 100)
  carrierOpp.hasBall = true
  matchDetails.ball.Player = carrierOpp.playerID
  matchDetails.ball.position = [carrierOpp.currentPOS[0], carrierOpp.currentPOS[1], 0]

  const fitBeforeSlide = slideDefender.fitness
  playerMovement.completeSlide(matchDetails, slideDefender, mockTeamA, mockTeamB)
  const fitAfterSlide = slideDefender.fitness
  assert(fitAfterSlide < fitBeforeSlide - 0.30, `La barrida al piso debe consumir energía física inmediata (antes ${fitBeforeSlide}, después ${fitAfterSlide})`)
  console.log(`  ✔ Las barridas al piso consumen energía física inmediata (merma de ${(fitBeforeSlide - fitAfterSlide).toFixed(2)}% fitness).`)
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3: MECÁNICA DE CABEZAZO (ELECCIÓN Y EFECTIVIDAD MARTÍN PALERMO)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== TEST 3: ELECCIÓN DE CABEZAZO Y EFECTIVIDAD DE MARTÍN PALERMO ===')
{
  const palermo = {
    name: 'Martín Palermo',
    playerID: 'P9',
    position: 'ST',
    tacticalRole: 'ST',
    originPOS: [340, 120],
    currentPOS: [340, 940],
    height: 188,
    traits: ['artillero_area', 'cabeceador_nato'],
    skill: {
      heading: 99,
      cabeza: 99,
      jumping: 99,
      perception: 97,
      agility: 66,
      strength: 95,
      shooting: 95
    },
    stats: {
      shots: { total: 0, on: 0, off: 0 }
    }
  }

  const shortPlayer = {
    name: 'Petiso Habilidoso',
    playerID: 'W7',
    position: 'LM',
    tacticalRole: 'LM',
    originPOS: [120, 120],
    currentPOS: [120, 940],
    height: 167,
    traits: ['playmaker_gambeteador'],
    skill: {
      heading: 52,
      cabeza: 52,
      jumping: 55,
      perception: 74,
      agility: 96,
      strength: 60,
      shooting: 75
    },
    stats: {
      shots: { total: 0, on: 0, off: 0 }
    }
  }

  // A. Elección de Cabecear vs Patear ante centro aéreo (100 intentos cada uno):
  let palermoHeaders = 0
  let shortHeaders = 0

  for (let i = 0; i < 150; i++) {
    palermo.isHeaderChance = true
    const bodyPalermo = ballMovement.setAttackBodyPart([340, 950, 15], 28, palermo)
    if (bodyPalermo === 'head') palermoHeaders++

    shortPlayer.isHeaderChance = true
    const bodyShort = ballMovement.setAttackBodyPart([340, 950, 15], 22, shortPlayer)
    if (bodyShort === 'head') shortHeaders++
  }

  const palermoHeaderRate = (palermoHeaders / 150) * 100
  const shortHeaderRate = (shortHeaders / 150) * 100

  assert(palermoHeaderRate >= 88, `Palermo debe elegir cabecear en >=88% de los centros aéreos (actual: ${palermoHeaderRate.toFixed(1)}%)`)
  assert(shortHeaderRate <= 50, `El jugador petiso debe preferir bajarla o volear (cabezazo <=50%, actual: ${shortHeaderRate.toFixed(1)}%)`)
  console.log(`  ✔ Elección de cabezazo ante centro: Palermo eligió cabecear el ${palermoHeaderRate.toFixed(1)}% de las veces vs ${shortHeaderRate.toFixed(1)}% del jugador bajo.`)

  // B. Efectividad de Cabezazo a Portería de Martín Palermo dentro del área:
  const pitchSize = [680, 1050]
  const mockTeamA = { teamID: 'TA', name: 'Boca', mentality: 'balanced', players: [palermo] }
  const mockTeamB = { teamID: 'TB', name: 'River', mentality: 'balanced', players: [] }
  const matchDetails = setVariables.populateMatchDetails(mockTeamA, mockTeamB, { pitchWidth: pitchSize[0], pitchHeight: pitchSize[1], goalWidth: 90 })

  palermo.currentPOS = [340, 940] // En el área chica/penal
  matchDetails.ball.position = [340, 940, 18]
  matchDetails.ball.Player = palermo.playerID
  matchDetails.ball.withPlayer = true
  matchDetails.ball.withTeam = mockTeamA.teamID
  palermo.hasBall = true
  palermo.isHeaderChance = true

  let palermoHeaderShotsOnTarget = 0
  const totalShots = 60

  for (let i = 0; i < totalShots; i++) {
    palermo.currentPOS = [340, 940]
    matchDetails.ball.position = [340, 940, 18]
    palermo.isHeaderChance = true
    matchDetails.ball.ballOverIterations = []

    ballMovement.shotMade(matchDetails, mockTeamA, palermo)
    const lastEvent = matchDetails.events[matchDetails.events.length - 1]
    if (lastEvent && lastEvent.isHeader && lastEvent.onTarget) {
      palermoHeaderShotsOnTarget++
    }
  }

  const onTargetRate = (palermoHeaderShotsOnTarget / totalShots) * 100
  assert(onTargetRate >= 80, `Los cabezazos de Palermo en el área deben ir al arco en >=80% de los casos (actual: ${onTargetRate.toFixed(1)}%)`)
  console.log(`  ✔ Efectividad de cabezazo: Palermo acertó al arco el ${onTargetRate.toFixed(1)}% de sus cabezazos en el área chica.`)
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4: DISCRIMINACIÓN DE TIPOS DE GOL EN BANNERS Y RELATOS
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== TEST 4: TIPOS DE GOL (CABEZAZO, POTENTE, A COLOCAR) Y RELATOS ===')
{
  const pitchSize = [680, 1050]
  const mockTeamA = { teamID: 'TA', name: 'Boca Juniors', mentality: 'balanced', players: [] }
  const mockTeamB = { teamID: 'TB', name: 'River Plate', mentality: 'balanced', players: [] }
  const matchDetails = setVariables.populateMatchDetails(mockTeamA, mockTeamB, { pitchWidth: pitchSize[0], pitchHeight: pitchSize[1], goalWidth: 90 })

  const striker = {
    id: 'TA-9',
    playerID: 'TA-9',
    name: 'Martín Palermo',
    position: 'ST',
    currentPOS: [340, 950],
    originPOS: [340, 950],
    stats: { goals: 0 }
  }
  const goalie = {
    id: 'TB-1',
    playerID: 'TB-1',
    name: 'Franco Armani',
    position: 'GK',
    currentPOS: [340, 100],
    originPOS: [340, 100],
    stats: { goals: 0 }
  }
  mockTeamA.players = [striker]
  mockTeamB.players = [goalie]

  // A. Gol de Cabezazo:
  matchDetails.ball.lastTouch = {
    playerName: 'Martín Palermo',
    playerID: striker.playerID,
    teamID: mockTeamA.teamID,
    bodyPart: 'head',
    shotType: 'header',
    goalDetail: 'Cabezazo'
  }

  setPositions.setKickOffTeamGoalScored(matchDetails)
  const goalEvent1 = matchDetails.events.find(e => e.type === 'goal')
  assert(goalEvent1 != null, 'Debe registrarse el evento goal')
  assert.strictEqual(goalEvent1.goalDetail, 'Cabezazo', 'El evento goal debe registrar el tipo de gol "Cabezazo"')
  assert.strictEqual(goalEvent1.shotType, 'header', 'El evento goal debe tener shotType "header"')

  const lastLog = matchDetails.iterationLog[matchDetails.iterationLog.length - 1]
  assert(lastLog.includes('Cabezazo'), `El iterationLog de gol debe detallar el tipo de gol (log: ${lastLog})`)
  console.log(`  ✔ Gol de cabeza registrado con éxito: ${lastLog}`)

  // B. Relatos de Marcelo Araujo y Enrique Macaya Márquez para gol de cabeza:
  matchDetails.iterationLog = [lastLog]
  const stateTracker = { lastCommentTick: -999, recentTypes: [] }
  const comments = commentaryEngine.generateCommentaryForIteration(matchDetails, { kickOff: 0, second: 0 }, "45'", stateTracker)
  const araujoComment = comments.find(c => c.speaker === 'Marcelo Araujo' && c.type === 'goal')
  const macayaComment = comments.find(c => c.speaker === 'Enrique Macaya Márquez' && c.type === 'analysis')

  assert(araujoComment != null, 'Marcelo Araujo debe relatar el gol')
  assert(macayaComment != null, 'Macaya Márquez debe comentar el gol')
  console.log(`  ✔ Relato de Marcelo Araujo: "${araujoComment.text}"`)
  console.log(`  ✔ Análisis de Macaya Márquez: "${macayaComment.text}"`)
  assert(
    araujoComment.text.toLowerCase().includes('cabeza') || araujoComment.text.toLowerCase().includes('frentazo') || araujoComment.text.toLowerCase().includes('martillazo'),
    'El relato de Araujo para un gol de cabeza debe mencionar el cabezazo o frentazo'
  )

  // C. Gol con Fierrazo Potente:
  matchDetails.ball.lastTouch = {
    playerName: 'Martín Palermo',
    playerID: striker.playerID,
    teamID: mockTeamA.teamID,
    bodyPart: 'foot',
    shotType: 'power_shot',
    goalDetail: 'Tiro potente'
  }
  setPositions.setKickOffTeamGoalScored(matchDetails)
  const lastLogPower = matchDetails.iterationLog[matchDetails.iterationLog.length - 1]
  matchDetails.iterationLog = [lastLogPower]
  const stateTrackerPower = { lastCommentTick: -999, recentTypes: [] }
  const commentsPower = commentaryEngine.generateCommentaryForIteration(matchDetails, { kickOff: 1, second: 0 }, "52'", stateTrackerPower)
  const araujoPower = commentsPower.find(c => c.speaker === 'Marcelo Araujo' && c.type === 'goal')
  console.log(`  ✔ Relato de Fierrazo potente: "${araujoPower.text}"`)
  assert(
    araujoPower.text.toLowerCase().includes('fierrazo') || araujoPower.text.toLowerCase().includes('misil') || araujoPower.text.toLowerCase().includes('potente') || araujoPower.text.toLowerCase().includes('tiro potente') || araujoPower.text.toLowerCase().includes('bombazo'),
    'El relato de Araujo para un tiro potente debe reflejar la violencia del remate'
  )
}

console.log('\n=================================================================================')
console.log('=== ¡TODAS LAS VERIFICACIONES DE ATRIBUTOS, CANSANCIO Y GOLES SUPERADAS! ===')
console.log('=================================================================================\n')
