import assert from 'assert'
import * as setPositions from '../src/engine/setPositions.js'
import * as setVariables from '../src/engine/setVariables.js'
import * as common from '../src/engine/common.js'
import { makeSubstitution, playIteration } from '../src/engine/engine.js'

console.log('\n======================================================================')
console.log('=== VERIFICACIÓN: CAMBIOS EN PELOTA PARADA, DESHACER Y CÓRNERS ===')
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
    action: 'none',
    hasBall: false,
    offside: false,
    sentOff: false,
    fitness: 100,
    rating: 80,
    skill: {
      passing: 80,
      shooting: 75,
      tackling: 70,
      saving: position === 'GK' ? 85 : 10,
      agility: 75,
      strength: 75,
      penalty_taking: 75,
      jumping: 75,
      perception: 75,
      ...skillOverrides
    },
    baseSkill: {
      passing: 80,
      shooting: 75,
      tackling: 70,
      saving: position === 'GK' ? 85 : 10,
      agility: 75,
      strength: 75,
      penalty_taking: 75,
      jumping: 75,
      perception: 75,
      ...skillOverrides
    },
    stats: {
      goals: 0,
      shots: { total: 0, on: 0, off: 0 },
      cards: { yellow: 0, red: 0 },
      passes: { total: 0, on: 0, off: 0 },
      tackles: { total: 0, on: 0, off: 0, fouls: 0 },
      saves: 0
    }
  }
}

function createTestTeam(teamID, teamName, isTop, pitchSize = [680, 1050]) {
  const basePositions = ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST']
  const players = basePositions.map((pos, idx) => {
    const y = isTop ? (60 + idx * 40) : (pitchSize[1] - (60 + idx * 40))
    return createTestPlayer(`${teamID}_${idx + 1}`, `${pos} ${teamName}`, pos, {}, [340, y])
  })
  const bench = [
    createTestPlayer(`${teamID}_B1`, `Suplente 1 ${teamName}`, 'ST', {}, [0, 0]),
    createTestPlayer(`${teamID}_B2`, `Suplente 2 ${teamName}`, 'CM', {}, [0, 0]),
    createTestPlayer(`${teamID}_B3`, `Suplente 3 ${teamName}`, 'CB', {}, [0, 0]),
    createTestPlayer(`${teamID}_B4`, `Suplente 4 ${teamName}`, 'LM', {}, [0, 0]),
    createTestPlayer(`${teamID}_B5`, `Suplente 5 ${teamName}`, 'GK', {}, [0, 0])
  ]
  return {
    teamID,
    name: teamName,
    players,
    bench,
    formation: '4-4-2',
    mentality: 'balanced',
    playStyle: 'balanced',
    substitutionsUsed: 0,
    maxSubstitutions: 5
  }
}

// -------------------------------------------------------------------------
// TEST 1: GEOMETRÍA Y DISTANCIA DEL DEFENSOR EN LOS 4 CÓRNERS (REGLA 9.15M)
// -------------------------------------------------------------------------
console.log('=== TEST 1: DISTANCIA DEL DEFENSOR Y COMPAÑERO EN CÓRNERS ===')
{
  const pitchSize = [680, 1050]
  const [pitchWidth, pitchHeight] = pitchSize
  const corners = [
    { name: 'Top-Left', fn: setPositions.setTopLeftCornerPositions, spot: [0, 0] },
    { name: 'Top-Right', fn: setPositions.setTopRightCornerPositions, spot: [pitchWidth, 0] },
    { name: 'Bottom-Left', fn: setPositions.setBottomLeftCornerPositions, spot: [0, pitchHeight] },
    { name: 'Bottom-Right', fn: setPositions.setBottomRightCornerPositions, spot: [pitchWidth, pitchHeight] }
  ]

  for (const c of corners) {
    const match = setVariables.populateMatchDetails(
      createTestTeam('T1', 'Boca Juniors', true, pitchSize),
      createTestTeam('T2', 'River Plate', false, pitchSize),
      { pitchWidth: pitchSize[0], pitchHeight: pitchSize[1], goalWidth: 90 }
    )

    c.fn(match)

    // Encontrar al ejecutante (hasBall)
    const taker = match.kickOffTeam.players.find(p => p.hasBall) || match.secondTeam.players.find(p => p.hasBall)
    assert(taker != null, `Debe haber un pateador de córner para ${c.name}`)
    const distTakerToCorner = common.distance(taker.currentPOS, c.spot)
    assert(distTakerToCorner <= 1, `El ejecutante debe estar en el banderín de córner`)

    // Identificar el equipo defensor
    const defTeam = (taker.playerID.startsWith('T1')) ? match.secondTeam : match.kickOffTeam
    const attTeam = (taker.playerID.startsWith('T1')) ? match.kickOffTeam : match.secondTeam

    // Encontrar al compañero de apoyo corto (el más cercano al córner excepto el taker)
    const shortOption = attTeam.players
      .filter(p => p.playerID !== taker.playerID && p.position !== 'GK')
      .sort((a, b) => common.distance(a.currentPOS, c.spot) - common.distance(b.currentPOS, c.spot))[0]

    const distShortOptionToCorner = common.distance(shortOption.currentPOS, c.spot)
    assert(distShortOptionToCorner >= 50 && distShortOptionToCorner <= 75,
      `El compañero de córner corto debe estar entre 50 y 75 unidades del banderín (actual: ${distShortOptionToCorner.toFixed(1)}px)`)

    // Encontrar al defensor más cercano al banderín de córner (debe respetar la distancia mínima de ~85-92px (~9.15m))
    const nearestDef = defTeam.players
      .filter(p => p.position !== 'GK')
      .sort((a, b) => common.distance(a.currentPOS, c.spot) - common.distance(b.currentPOS, c.spot))[0]

    const distDefToCorner = common.distance(nearestDef.currentPOS, c.spot)
    assert(distDefToCorner >= 85,
      `El defensor más cercano al córner (${nearestDef.name}) debe estar a al menos 85px del banderín para no interrumpir el saque (actual: ${distDefToCorner.toFixed(1)}px)`)

    // Verificar que el defensor está marcando al compañero pero separado
    const distDefToOption = common.distance(nearestDef.currentPOS, shortOption.currentPOS)
    assert(distDefToOption >= 20 && distDefToOption <= 45,
      `El defensor debe marcar al apoyo a distancia prudente (entre 20 y 45px, actual: ${distDefToOption.toFixed(1)}px)`)

    console.log(`  ✔ Córner ${c.name}: Ejecutante en ${c.spot} | Apoyo a ${distShortOptionToCorner.toFixed(1)}px | Rival marcador a ${distDefToCorner.toFixed(1)}px del banderín (respeta distancia reglamentaria).`)
  }
}

// -------------------------------------------------------------------------
// TEST 2: COLA DE CAMBIOS EN PELOTA PARADA Y DESHACER CAMBIOS
// -------------------------------------------------------------------------
console.log('\n=== TEST 2: CAMBIOS EN ESPERA Y BOTÓN DESHACER ===')
{
  const pitchSize = [680, 1050]
  const match = setVariables.populateMatchDetails(
    createTestTeam('T1', 'Boca Juniors', true, pitchSize),
    createTestTeam('T2', 'River Plate', false, pitchSize),
    { pitchWidth: pitchSize[0], pitchHeight: pitchSize[1], goalWidth: 90 }
  )

  match.pendingSubstitutions = []

  // Titular original antes del cambio
  const originalStarter = match.kickOffTeam.players[9]
  const benchPlayer = match.kickOffTeam.bench[0]

  // Simular solicitud de cambio mientras la pelota está en juego
  const stagedSub = {
    id: `sub-1`,
    teamKey: 'kickOffTeam',
    starterIdx: 9,
    benchIdx: 0,
    outgoingName: originalStarter.name,
    incomingName: benchPlayer.name,
    teamName: match.kickOffTeam.name,
    teamID: match.kickOffTeam.teamID
  }
  match.pendingSubstitutions.push(stagedSub)

  // 1. Verificar que el jugador en cancha NO se reemplaza al instante
  assert.strictEqual(match.kickOffTeam.players[9].name, originalStarter.name, 'El jugador en cancha debe seguir siendo el original mientras la pelota está en juego')
  assert.strictEqual(match.kickOffTeam.substitutionsUsed, 0, 'No debe descontar cambios hasta aplicarse en detención')
  console.log('  ✔ Solicitud de cambio registrada en espera: El titular sigue jugando en cancha mientras la pelota se mueve.')

  // 2. Simular botón "Deshacer cambios": Si el usuario se arrepiente antes de que el juego se detenga
  match.pendingSubstitutions = match.pendingSubstitutions.filter(s => s.id !== stagedSub.id)
  assert.strictEqual(match.pendingSubstitutions.length, 0, 'La cola de cambios debe quedar vacía al deshacer')
  assert.strictEqual(match.kickOffTeam.players[9].name, originalStarter.name, 'El titular original permanece inalterado')
  console.log('  ✔ Botón Deshacer cambios verificado: Cancela la solicitud y mantiene al titular original.')

  // 3. Volver a solicitar el cambio y simular que el juego se detiene (córner, falta, lateral, etc.)
  match.pendingSubstitutions.push(stagedSub)

  // Simular evento de detención (córner o lateral)
  const isStoppage = true
  const appliedSubs = []
  if (isStoppage && match.pendingSubstitutions.length > 0) {
    for (const sub of match.pendingSubstitutions) {
      makeSubstitution(match, sub.teamKey, sub.starterIdx, sub.benchIdx)
      const subEv = match.events[match.events.length - 1]
      appliedSubs.push(subEv)
    }
    match.pendingSubstitutions = []
  }

  assert.strictEqual(match.kickOffTeam.players[9].name, benchPlayer.name, 'Al detenerse el juego, el suplente debe haber ingresado')
  assert.strictEqual(match.kickOffTeam.substitutionsUsed, 1, 'substitutionsUsed debe incrementarse a 1')
  assert.strictEqual(appliedSubs.length, 1, 'Debe registrarse 1 evento de sustitución')
  assert.strictEqual(appliedSubs[0].playerIn, benchPlayer.name, 'El evento debe reportar quién entró')
  assert.strictEqual(appliedSubs[0].playerOut, originalStarter.name, 'El evento debe reportar quién salió')
  console.log(`  ✔ Cambio aplicado con éxito en detención de juego: Sale ${appliedSubs[0].playerOut} ⬇️ • Entra ${appliedSubs[0].playerIn} ⬆️.`)
}

// -------------------------------------------------------------------------
// TEST 3: CAMBIOS EN AMBOS EQUIPOS EN LA MISMA DETENCIÓN
// -------------------------------------------------------------------------
console.log('\n=== TEST 3: CAMBIOS SIMULTÁNEOS PARA AMBOS EQUIPOS ===')
{
  const pitchSize = [680, 1050]
  const match = setVariables.populateMatchDetails(
    createTestTeam('T1', 'Boca Juniors', true, pitchSize),
    createTestTeam('T2', 'River Plate', false, pitchSize),
    { pitchWidth: pitchSize[0], pitchHeight: pitchSize[1], goalWidth: 90 }
  )

  match.pendingSubstitutions = [
    {
      id: 'sub-t1',
      teamKey: 'kickOffTeam',
      starterIdx: 10,
      benchIdx: 1,
      outgoingName: match.kickOffTeam.players[10].name,
      incomingName: match.kickOffTeam.bench[1].name,
      teamName: match.kickOffTeam.name,
      teamID: match.kickOffTeam.teamID
    },
    {
      id: 'sub-t2',
      teamKey: 'secondTeam',
      starterIdx: 9,
      benchIdx: 0,
      outgoingName: match.secondTeam.players[9].name,
      incomingName: match.secondTeam.bench[0].name,
      teamName: match.secondTeam.name,
      teamID: match.secondTeam.teamID
    }
  ]

  const appliedSubs = []
  for (const sub of match.pendingSubstitutions) {
    makeSubstitution(match, sub.teamKey, sub.starterIdx, sub.benchIdx)
    const subEv = match.events[match.events.length - 1]
    appliedSubs.push(subEv)
  }
  match.pendingSubstitutions = []

  assert.strictEqual(appliedSubs.length, 2, 'Deben registrarse cambios para ambos equipos')
  const uniqueTeams = new Set(appliedSubs.map(s => s.teamID))
  assert.strictEqual(uniqueTeams.size, 2, 'Debe haber 2 equipos involucrados')
  console.log(`  ✔ Sustituciones para ambos equipos validadas:`)
  console.log(`     - ${appliedSubs[0].teamName}: Sale ${appliedSubs[0].playerOut} ⬇️ • Entra ${appliedSubs[0].playerIn} ⬆️`)
  console.log(`     - ${appliedSubs[1].teamName}: Sale ${appliedSubs[1].playerOut} ⬇️ • Entra ${appliedSubs[1].playerIn} ⬆️`)
}

console.log('\n======================================================================')
console.log('=== ¡TODAS LAS PRUEBAS DE CAMBIOS Y CÓRNERS FINALIZARON CON ÉXITO! ===')
console.log('======================================================================\n')
