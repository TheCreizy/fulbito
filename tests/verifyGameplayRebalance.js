import { PLAYERS_DB } from '../src/data/playersDB.js'
import { FORMATIONS, getFormationCoordinates } from '../src/data/formations.js'
import * as engine from '../src/engine/engine.js'
import * as setPositions from '../src/engine/setPositions.js'
import * as common from '../src/engine/common.js'
import * as actions from '../src/engine/actions.js'
import * as ballMovement from '../src/engine/ballMovement.js'

console.log('\n======================================================================')
console.log('=== VERIFICACIÓN: REBALANCEO DE GAMEPLAY (OPEN FOOTBALL MODEL) ===')
console.log('======================================================================\n')

function createTeam(teamID, name, formationId = '4-3-3', playStyle = 'wingPlay', side = 'top') {
  const coords = getFormationCoordinates(formationId, 'balanced', side)
  const formation = FORMATIONS[formationId] || FORMATIONS['4-3-3']
  const players = formation.slots.map((slot, idx) => {
    const dbEntry = PLAYERS_DB[idx + (teamID === 1 ? 1 : 25)] || PLAYERS_DB[1]
    const currentCoords = coords[idx].coords.slice()
    return {
      playerID: `${teamID}_${idx}`,
      name: `${dbEntry.name} (${slot.role})`,
      position: slot.role === 'GK' ? 'GK' : (slot.role.includes('B') ? 'CB' : (slot.role.includes('M') ? 'CM' : 'ST')),
      tacticalRole: slot.role,
      rating: dbEntry.rating || 85,
      fitness: 100,
      injured: false,
      injuryStatus: null,
      forcedOff: false,
      height: dbEntry.height || 180,
      originPOS: currentCoords.slice(),
      currentPOS: currentCoords.slice(),
      intentPOS: currentCoords.slice(),
      action: 'none',
      hasBall: false,
      isMarked: false,
      offside: false,
      stats: {
        cards: { yellow: 0, red: 0 },
        goals: 0,
        tackles: { total: 0, on: 0, off: 0, fouls: 0 },
        passes: { total: 0, on: 0, off: 0 },
        shots: { total: 0, on: 0, off: 0 },
        dribbles: 0,
        saves: 0
      },
      skill: {
        passing: Number(dbEntry.skill?.passing || 80),
        shooting: Number(dbEntry.skill?.shooting || 78),
        tackling: Number(dbEntry.skill?.tackling || 75),
        saving: Number(slot.role === 'GK' ? 85 : 15),
        agility: Number(dbEntry.skill?.agility || 80),
        strength: Number(dbEntry.skill?.strength || 75),
        penalty_taking: Number(dbEntry.skill?.penalty_taking || 75),
        jumping: Number(dbEntry.skill?.jumping || 75),
        perception: Number(dbEntry.skill?.perception || 80),
        control: Number(dbEntry.skill?.control || 80),
        freekick: Number(dbEntry.skill?.freekick || 75)
      },
      baseSkill: {
        passing: Number(dbEntry.skill?.passing || 80),
        shooting: Number(dbEntry.skill?.shooting || 78),
        tackling: Number(dbEntry.skill?.tackling || 75),
        saving: Number(slot.role === 'GK' ? 85 : 15),
        agility: Number(dbEntry.skill?.agility || 80),
        strength: Number(dbEntry.skill?.strength || 75),
        penalty_taking: Number(dbEntry.skill?.penalty_taking || 75),
        jumping: Number(dbEntry.skill?.jumping || 75),
        perception: Number(dbEntry.skill?.perception || 80),
        control: Number(dbEntry.skill?.control || 80),
        freekick: Number(dbEntry.skill?.freekick || 75)
      },
      traits: dbEntry.traits || []
    }
  })

  // Banco de suplentes
  const bench = [12, 13, 14, 15, 16].map((bIdx, i) => {
    const dbEntry = PLAYERS_DB[bIdx + (teamID === 1 ? 40 : 60)] || PLAYERS_DB[2]
    return {
      playerID: `${teamID}_bench_${i}`,
      name: `${dbEntry.name} (Sub)`,
      position: i === 0 ? 'GK' : (i < 3 ? 'CB' : 'ST'),
      tacticalRole: i === 0 ? 'GK' : (i < 3 ? 'CB' : 'ST'),
      rating: dbEntry.rating || 80,
      fitness: 100,
      injured: false,
      injuryStatus: null,
      height: dbEntry.height || 180,
      originPOS: [340, 525],
      currentPOS: [340, 525],
      intentPOS: [340, 525],
      action: 'none',
      hasBall: false,
      substitutedOut: false,
      stats: { cards: { yellow: 0, red: 0 }, goals: 0, tackles: { total: 0, on: 0, off: 0, fouls: 0 }, passes: { total: 0, on: 0, off: 0 }, shots: { total: 0, on: 0, off: 0 }, dribbles: 0 },
      skill: { ...dbEntry.skill },
      baseSkill: { ...dbEntry.skill },
      traits: dbEntry.traits || []
    }
  })

  return {
    teamID,
    name,
    intent: 'attack',
    formation: formationId,
    playStyle,
    mentality: 'balanced',
    players,
    bench,
    substitutionsUsed: 0,
    maxSubstitutions: 5
  }
}

// -----------------------------------------------------------------------------
// TEST 1: Sistema de Lesiones con 3 Grados (Knock, Hurt, Serious)
// -----------------------------------------------------------------------------
console.log('=== TEST 1: SISTEMA DE LESIONES CON 3 GRADOS (OPEN FOOTBALL) ===')
const mockTeam = createTeam(1, 'Test Team', '4-4-2', 'wingPlay', 'top')
const p1 = mockTeam.players[1]
const p2 = mockTeam.players[2]
const p3 = mockTeam.players[3]

const matchDetailsMock = {
  iterationCount: 500,
  half: 1,
  iterationLog: [],
  events: []
}

// 1. Knock
common.applyInjury(p1, 'contact', 'knock', matchDetailsMock, mockTeam)
console.log(`  - Jugador 1 (Knock): ${p1.injuryStatus.name} | Fitness: ${p1.fitness} | canContinue: ${p1.injuryStatus.canContinue}`)
if (p1.injuryStatus.grade !== 'knock' || !p1.injuryStatus.canContinue || p1.fitness >= 100) {
  throw new Error('Fallo en lesión grado Knock')
}
console.log('  ✔ Lesión Knock validada (merma leve, continúa jugando).')

// 2. Hurt
common.applyInjury(p2, 'load', 'hurt', matchDetailsMock, mockTeam)
console.log(`  - Jugador 2 (Hurt): ${p2.injuryStatus.name} | Fitness: ${p2.fitness} | canContinue: ${p2.injuryStatus.canContinue}`)
if (p2.injuryStatus.grade !== 'hurt' || !p2.injuryStatus.canContinue || p2.fitness > 75) {
  throw new Error('Fallo en lesión grado Hurt')
}
console.log('  ✔ Lesión Hurt validada (caída severa de energía, continúa disminuido).')

// 3. Serious
common.applyInjury(p3, 'contact', 'serious', matchDetailsMock, mockTeam)
console.log(`  - Jugador 3 (Serious): ${p3.injuryStatus.name} | canContinue: ${p3.injuryStatus.canContinue}`)
if (p3.injuryStatus.grade !== 'serious' || p3.injuryStatus.canContinue) {
  throw new Error('Fallo en lesión grado Serious')
}

// Comprobar sustitución obligada
matchDetailsMock.kickOffTeam = mockTeam
matchDetailsMock.secondTeam = createTeam(2, 'Rival', '4-4-2', 'wingPlay', 'bottom')
engine.checkSeriousInjurySubstitutions(matchDetailsMock, mockTeam, 'kickOffTeam')
console.log(`  - Sustitución realizada tras lesión grave: ${mockTeam.substitutionsUsed} cambios usados. Titular en cancha: ${mockTeam.players[3].name}`)
if (mockTeam.substitutionsUsed !== 1) {
  throw new Error('La lesión grave no ejecutó la sustitución obligada.')
}
console.log('  ✔ Lesión Serious y sustitución forzada validadas exitosamente.')

// -----------------------------------------------------------------------------
// TEST 2: Atajada del Arquero con Córner y Rebote (No monopolio de retención)
// -----------------------------------------------------------------------------
console.log('\n=== TEST 2: BIFURCACIÓN DE ATAJADAS DEL ARQUERO (CÓRNER Y REBOTE) ===')
const simSaveMatch = {
  pitchSize: [680, 1050, 82],
  iterationCount: 120,
  half: 1,
  iterationLog: [],
  events: [],
  kickOffTeamStatistics: { corners: 0 },
  secondTeamStatistics: { corners: 0 },
  ball: {
    position: [340, 20, 0],
    lastTouch: { playerID: '2_9', teamID: 2 },
    isPendingPass: false
  }
}
const goalieTeam = createTeam(1, 'Defending Team', '4-4-2', 'wingPlay', 'top')
const attackingTeam = createTeam(2, 'Attacking Team', '4-4-2', 'wingPlay', 'bottom')
simSaveMatch.kickOffTeam = goalieTeam
simSaveMatch.secondTeam = attackingTeam
const gk = goalieTeam.players[0]

let cornersAwarded = 0
let reboundsGiven = 0
let catchesCount = 0

// Simular 200 atajadas y medir distribución
for (let i = 0; i < 200; i++) {
  const testMatch = JSON.parse(JSON.stringify(simSaveMatch))
  testMatch.kickOffTeam = goalieTeam
  testMatch.secondTeam = attackingTeam
  testMatch.ball.position = [common.getRandomNumber(290, 390), 15, 0]
  ballMovement.executeGoalkeeperSave(testMatch, gk, goalieTeam, testMatch.ball.position)
  const saveEv = testMatch.events.find(e => e.type === 'save')
  if (saveEv?.outcome === 'corner') cornersAwarded++
  else if (saveEv?.outcome === 'rebound') reboundsGiven++
  else if (saveEv?.outcome === 'catch') catchesCount++
}

console.log(`  En 200 atajadas simuladas: Córners: ${cornersAwarded} | Rebotes: ${reboundsGiven} | Atrapadas: ${catchesCount}`)
if (cornersAwarded === 0 || reboundsGiven === 0 || catchesCount === 0) {
  throw new Error('La atajada del arquero no produce la variedad requerida de córners y rebotes.')
}
console.log('  ✔ Atajadas con desvío a córner y rebote al área chica verificadas con éxito.')

// -----------------------------------------------------------------------------
// TEST 3: Simulación de 5 Partidos Completos (10,000 iteraciones)
// -----------------------------------------------------------------------------
console.log('\n=== TEST 3: SIMULACIÓN DE 5 PARTIDOS COMPLETOS (10,000 TICKS) ===')
let totalCorners = 0
let totalFouls = 0
let totalYellows = 0
let totalReds = 0
let totalPenalties = 0
let totalCrosses = 0
let totalShots = 0
let totalGoals = 0
let totalInjuries = 0
let totalSaves = 0

const PITCH_CONFIG = {
  pitchWidth: 680,
  pitchHeight: 1050,
  goalWidth: 82,
  halfTime: 1000
}

for (let m = 0; m < 5; m++) {
  const teamA = createTeam(1, 'Boca Juniors', '4-3-3', 'wingPlay', 'top')
  const teamB = createTeam(2, 'River Plate', '4-3-1-2', 'tikiTaka', 'bottom')
  let match = await engine.initiateGame(teamA, teamB, PITCH_CONFIG)
  for (let tick = 0; tick < 1000; tick++) {
    match = await engine.playIteration(match)
  }
  match = await engine.startSecondHalf(match)
  for (let tick = 0; tick < 1000; tick++) {
    match = await engine.playIteration(match)
  }

  const evs = match.events || []
  totalCorners += evs.filter(e => e.type === 'corner').length
  totalFouls += evs.filter(e => e.type === 'foul').length
  totalYellows += evs.filter(e => e.type === 'yellowCard').length
  totalReds += evs.filter(e => e.type === 'redCard').length
  totalPenalties += evs.filter(e => e.type === 'penalty').length
  totalCrosses += evs.filter(e => e.type === 'cross').length
  totalShots += evs.filter(e => e.type === 'shot').length
  totalGoals += evs.filter(e => e.type === 'goal').length
  totalInjuries += evs.filter(e => e.type === 'injury').length
  totalSaves += evs.filter(e => e.type === 'save').length
}

console.log('  Estadísticas promedio por partido (5 partidos):')
console.log(`  - Córners por partido: ${(totalCorners / 5).toFixed(1)} (antes: ~0)`)
console.log(`  - Faltas por partido: ${(totalFouls / 5).toFixed(1)} (antes: ~1.5)`)
console.log(`  - Tarjetas Amarillas por partido: ${(totalYellows / 5).toFixed(1)}`)
console.log(`  - Tarjetas Rojas en 5 partidos: ${totalReds}`)
console.log(`  - Penales en 5 partidos: ${totalPenalties}`)
console.log(`  - Centros al área por partido: ${(totalCrosses / 5).toFixed(1)}`)
console.log(`  - Tiros totales por partido: ${(totalShots / 5).toFixed(1)}`)
console.log(`  - Goles por partido: ${(totalGoals / 5).toFixed(1)}`)
console.log(`  - Atajadas por partido: ${(totalSaves / 5).toFixed(1)}`)
console.log(`  - Lesiones en 5 partidos: ${totalInjuries}`)

if (totalCorners < 5) {
  throw new Error(`Córners insuficientes: solo ${totalCorners} en 5 partidos`)
}
if (totalFouls < 15) {
  throw new Error(`Faltas insuficientes: solo ${totalFouls} en 5 partidos`)
}
if (totalYellows < 2) {
  throw new Error(`Tarjetas amarillas insuficientes: solo ${totalYellows} en 5 partidos`)
}
if (totalCrosses < 10) {
  throw new Error(`Centros al área insuficientes: solo ${totalCrosses} en 5 partidos`)
}

console.log('\n=== TEST 4: CONDUCCIÓN DECIDIDA EN BANDA (FLANKPLAY DRIVE BYLINE) ===')
const flankMatch = {
  pitchSize: [680, 1050],
  ball: { lastCarrierID: 'winger1', carrierTicks: 1, position: [80, 500, 0] },
  iterationCount: 100
}
const wingerPlayer = {
  playerID: 'winger1',
  name: 'Caniggia',
  position: 'LM',
  tacticalRole: 'LM',
  hasBall: true,
  currentPOS: [80, 500],
  originPOS: [80, 150],
  height: 175,
  skill: { agility: 88, control: 86, strength: 75, shooting: 78, jumping: 72 },
  traits: ['velocista_banda', 'fenomeno_encarador']
}
const oppTeam = {
  players: [
    { playerID: 'opp_gk', name: 'Rival GK', position: 'GK', currentPOS: [340, 1020], originPOS: [340, 1020], fitness: 100 },
    // Defensor rival a 80px hacia adelante (pista libre en el carril)
    { playerID: 'opp_rb', name: 'Rival RB', position: 'RB', currentPOS: [95, 620], originPOS: [95, 750], fitness: 100 }
  ]
}
const teamFlank = {
  playStyle: 'wingPlay',
  players: [wingerPlayer]
}
const possibleFlankActions = actions.findPossActions(wingerPlayer, teamFlank, oppTeam, 80, 500, flankMatch)
const sprintAction = possibleFlankActions.find(a => a.name === 'sprint')
const passAction = possibleFlankActions.find(a => a.name === 'pass')
console.log(`  - Puntos asignados a sprint por la banda: ${sprintAction.points} | Puntos a pase: ${passAction.points}`)
if (sprintAction.points < 65 || sprintAction.points <= passAction.points) {
  throw new Error(`El extremo no priorizó conducir por la banda con espacio libre (sprint: ${sprintAction.points}, pass: ${passAction.points})`)
}
console.log('  ✔ Extremo prioriza galope y desborde por la cal sobre pase apresurado.')

console.log('\n=== TEST 5: PENALIZACIÓN ACUMULATIVA A CAMBIOS DE FRENTE ===')
const teamSwitch = {
  playStyle: 'wingPlay',
  players: [
    wingerPlayer,
    { playerID: 'winger2', name: 'Messi', position: 'RM', currentPOS: [600, 520], originPOS: [600, 150], fitness: 100 }
  ]
}
const switchMatch0 = {
  pitchSize: [680, 1050],
  ball: { consecutiveSwitches: 0, position: [80, 500, 0] }
}
const switchMatch2 = {
  pitchSize: [680, 1050],
  ball: { consecutiveSwitches: 2, position: [80, 500, 0] }
}
const env0 = actions.scanCarrierEnvironment(switchMatch0, wingerPlayer, teamSwitch, oppTeam)
const env2 = actions.scanCarrierEnvironment(switchMatch2, wingerPlayer, teamSwitch, oppTeam)
console.log(`  - ¿Opción de cambio de frente con 0 cambios previos?: ${env0.hasSwitchOption} | Con 2 cambios previos: ${env2.hasSwitchOption}`)
if (!env0.hasSwitchOption) {
  throw new Error('El motor no detectó la opción de cambio de frente válida.')
}
if (env2.hasSwitchOption) {
  throw new Error('El motor no bloqueó la opción de cambio de frente tras 2 cambios seguidos.')
}
console.log('  ✔ Enfriamiento y penalización acumulativa a cambios de frente consecutivos verificados.')

console.log('\n=== TEST 6: CENTROS AL ÁREA Y CABEZAZOS REALISTAS (HEADER SHOT) ===')
const headerPlayer = {
  playerID: 'st_palermo',
  name: 'Martín Palermo',
  position: 'ST',
  tacticalRole: 'ST',
  height: 188,
  currentPOS: [340, 950],
  originPOS: [340, 950],
  isHeaderChance: true,
  stats: { shots: { total: 0, on: 0, off: 0 } },
  skill: { jumping: 92, strength: 88, shooting: 86, control: 82 },
  traits: ['artillero_area', 'cabeceador_nato']
}
let headerRolls = 0
for (let i = 0; i < 50; i++) {
  headerPlayer.isHeaderChance = true
  const part = ballMovement.setAttackBodyPart([340, 950, 15], 28, headerPlayer)
  if (part === 'head') headerRolls++
}
console.log(`  - Cabezazos registrados en 50 centros dirigidos a Palermo: ${headerRolls}/50 (${(headerRolls / 50 * 100).toFixed(0)}%)`)
if (headerRolls < 35) {
  throw new Error(`Tasa insuficiente de cabezazos para un cabeceador nato: ${headerRolls}/50`)
}
console.log('  ✔ Especialista de área (Palermo) define de cabeza ante centros al área exitosamente.')

console.log('\n=== TEST 7: MANO A MANO TRAS SUPERAR CENTRALES Y DESBORDE PROFUNDO ===')
// 1. Delantero superó a los centrales (los centrales están a 15px DETRÁS de él):
const breakawayMatch = {
  pitchSize: [680, 1050],
  ball: { lastCarrierID: 'st_solo', carrierTicks: 6, position: [340, 750, 0] },
  iterationCount: 200
}
const strikerSolo = {
  playerID: 'st_solo',
  name: 'Ronaldo Nazário',
  position: 'ST',
  tacticalRole: 'ST',
  hasBall: true,
  currentPOS: [340, 750], // Atacando hacia Y = 1050 (distToGoalY = 300)
  originPOS: [340, 490],
  skill: { agility: 92, control: 90, shooting: 94, strength: 84 },
  traits: ['fenomeno_encarador']
}
const oppTrailingDefenders = {
  players: [
    { playerID: 'gk_opp', name: 'Rival GK', position: 'GK', currentPOS: [340, 1025], originPOS: [340, 1025], fitness: 100 },
    // Dos centrales persiguiéndolo por DETRÁS (Y = 735, o sea 15px detrás):
    { playerID: 'cb1', name: 'Central 1', position: 'CB', currentPOS: [332, 735], originPOS: [332, 850], fitness: 100 },
    { playerID: 'cb2', name: 'Central 2', position: 'CB', currentPOS: [348, 735], originPOS: [348, 850], fitness: 100 }
  ]
}
const teamSolo = {
  playStyle: 'directCounter',
  players: [
    strikerSolo,
    { playerID: 'mate1', name: 'Compañero atrás', position: 'CM', currentPOS: [340, 600], originPOS: [340, 300], fitness: 100 }
  ]
}
const envBreakaway = actions.scanCarrierEnvironment(breakawayMatch, strikerSolo, teamSolo, oppTrailingDefenders)
console.log(`  - ¿Detectó canal libre hacia el arco (hasOpenRunway) con centrales a la espalda?: ${envBreakaway.hasOpenRunway}`)
if (!envBreakaway.hasOpenRunway) {
  throw new Error('El delantero superó a los centrales pero el motor no activó canal libre hacia el arco.')
}

const breakawayActions = actions.findPossActions(strikerSolo, teamSolo, oppTrailingDefenders, 340, 750, breakawayMatch)
const sprintBreakaway = breakawayActions.find(a => a.name === 'sprint')
const passBreakaway = breakawayActions.find(a => a.name === 'pass')
console.log(`  - Puntos asignados a sprint hacia el arco: ${sprintBreakaway.points} | Puntos a pase: ${passBreakaway.points}`)
if (sprintBreakaway.points < 85 || passBreakaway.points > 2) {
  throw new Error(`El delantero libre no priorizó sprintar al gol (sprint: ${sprintBreakaway.points}, pass: ${passBreakaway.points})`)
}
console.log('  ✔ Delantero que rompió la línea central encara mano a mano en sprint al 100% sin descargar atrás.')

// 2. Extremo en tres cuartos de banda (distToGoalY = 165px): NO debe centrar temprano, sino desbordar
const deepWingerMatch = {
  pitchSize: [680, 1050],
  ball: { lastCarrierID: 'winger_messi', carrierTicks: 2, position: [50, 885, 0] }, // distToGoalY = 165
  iterationCount: 300
}
const wingerMessi = {
  playerID: 'winger_messi',
  name: 'Lionel Messi',
  position: 'LM',
  tacticalRole: 'LM',
  hasBall: true,
  currentPOS: [50, 885],
  originPOS: [48, 465],
  skill: { agility: 96, control: 96, shooting: 94, passing: 92 },
  traits: ['fenomeno_encarador', 'playmaker_gambeteador']
}
const teamMessi = {
  playStyle: 'wingPlay',
  players: [
    wingerMessi,
    { playerID: 'palermo9', name: 'Palermo', position: 'ST', currentPOS: [340, 950], originPOS: [340, 495], fitness: 100 }
  ]
}
const messiActions = actions.findPossActions(wingerMessi, teamMessi, oppTrailingDefenders, 50, 885, deepWingerMatch)
const messiCross = messiActions.find(a => a.name === 'cross')
const messiSprint = messiActions.find(a => a.name === 'sprint')
console.log(`  - Extremo en 3/4 (distToGoalY=165px): Puntos a centro: ${messiCross.points} | Puntos a desborde/sprint: ${messiSprint.points}`)
if (messiCross.points > 10 || messiSprint.points < 70) {
  throw new Error(`El extremo centró prematuramente en lugar de desbordar (cross: ${messiCross.points}, sprint: ${messiSprint.points})`)
}
console.log('  ✔ Extremo posterga el centro hasta llegar a la altura del punto penal o desbordar la banda.')

console.log('\n======================================================================')
console.log('=== ¡TODAS LAS VERIFICACIONES DE REBALANCEO DE GAMEPLAY SUPERADAS! ===')
console.log('======================================================================\n')
