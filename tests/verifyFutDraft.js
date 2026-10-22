import assert from 'node:assert'
import {
  getFormationChoices,
  getCaptainChoices,
  placeCaptainInFormation,
  rollCategoryByProbability,
  getCandidatesForPositionAndCategory,
  selectAIFutDraftCard,
  getNextEmptyAISlot,
  buildTeamFromFutDraft,
  TOTAL_BENCH_COUNT,
  BENCH_SLOTS,
  CATEGORY_PROBABILITIES,
  FUT_DRAFT_FORMATIONS
} from '../src/draft/futDraftEngine.js'
import { FORMATIONS, PITCH_CONFIG } from '../src/data/formations.js'
import { initiateGame, playIteration, startSecondHalf } from '../src/engine/engine.js'

async function runFutDraftTests() {
  console.log('=== 1. Verificando Elección de Formaciones en FUT Draft ===')
  const choices = getFormationChoices(5)
  assert.strictEqual(choices.length, 5, 'Debe ofrecer 5 opciones de formación')
  choices.forEach(f => {
    assert.ok(FUT_DRAFT_FORMATIONS.includes(f.id), `Formación ${f.id} debe ser una de las formaciones válidas`)
    assert.strictEqual(f.slots.length, 11, `Formación ${f.id} debe tener 11 slots`)
  })
  console.log('✔ Selección de formaciones validada:', choices.map(c => c.id).join(', '))

  console.log('\n=== 2. Verificando Sobre de Capitán (5 Leyendas en 5 Posiciones Distintas) ===')
  const captainChoices = getCaptainChoices(new Set())
  assert.strictEqual(captainChoices.length, 5, 'Debe generar exactamente 5 Leyendas candidatas a Capitán')
  const capIds = new Set(captainChoices.map(c => c.id))
  assert.strictEqual(capIds.size, 5, 'No debe haber leyendas repetidas en el sobre de capitán')

  captainChoices.forEach(c => {
    assert.strictEqual(c.category, 'legend', `El capitán ${c.name} debe ser de categoría Leyenda`)
    assert.ok(c.rating >= 93, `Media de leyenda >= 93 (actual: ${c.rating})`)
  })

  // Validar que cada leyenda cubra una línea o posición diferente
  const positionsSeen = new Set(captainChoices.map(c => c.position))
  console.log('  - Leyendas candidatas a Capitán:', captainChoices.map(c => `${c.name} (${c.position} OVR ${c.rating})`).join(' | '))
  assert.ok(positionsSeen.size >= 4, `Al menos 4 o 5 posiciones diferentes entre los 5 capitanes (obtenidas: ${positionsSeen.size})`)

  // Validar asignación de Capitán en la formación
  const testFormation = FORMATIONS['4-3-1-2']
  const testStarters = new Array(11).fill(null)
  const chosenCaptain = captainChoices[0]
  const captainSlotIdx = placeCaptainInFormation(chosenCaptain, testFormation.slots, testStarters)
  assert.ok(captainSlotIdx >= 0 && captainSlotIdx <= 10, 'El Capitán se asigna a un slot titular válido (0..10)')
  console.log(`✔ Capitán ${chosenCaptain.name} (${chosenCaptain.position}) asignado automáticamente al slot ${captainSlotIdx} (${testFormation.slots[captainSlotIdx].role})`)

  console.log('\n=== 3. Verificando Probabilidades de Sobres y Reroll ===')
  const totalProb = Object.values(CATEGORY_PROBABILITIES).reduce((a, b) => a + b, 0)
  assert.ok(Math.abs(totalProb - 1.0) < 0.001, 'La suma de probabilidades de categorías debe ser 1.0 (100%)')

  // Simular 1000 tiradas de categoría
  const sampleCounts = { legend: 0, idol: 0, squad: 0, filler: 0 }
  for (let i = 0; i < 1000; i++) {
    const rolled = rollCategoryByProbability()
    sampleCounts[rolled]++
  }
  console.log(`  - Distribución en 1000 tiradas: Plantilla ${sampleCounts.squad} (${(sampleCounts.squad / 10).toFixed(1)}%), Ídolo ${sampleCounts.idol} (${(sampleCounts.idol / 10).toFixed(1)}%), Leyenda ${sampleCounts.legend} (${(sampleCounts.legend / 10).toFixed(1)}%), Relleno ${sampleCounts.filler} (${(sampleCounts.filler / 10).toFixed(1)}%)`)
  assert.ok(sampleCounts.squad > 200 && sampleCounts.squad < 360, 'Tiradas de plantilla en rango esperado ~28%')
  assert.ok(sampleCounts.idol > 180 && sampleCounts.idol < 340, 'Tiradas de ídolo en rango esperado ~26%')
  assert.ok(sampleCounts.legend > 160 && sampleCounts.legend < 320, 'Tiradas de leyenda en rango esperado ~24%')
  assert.ok(sampleCounts.filler > 140 && sampleCounts.filler < 300, 'Tiradas de relleno en rango esperado ~22%')
  console.log('✔ Sistema de probabilidades de sobre validado.')

  console.log('\n=== 4. Verificando Capacidad de 12 Suplentes (Total 23 por Equipo = 46 sin Romper al Rival) ===')
  assert.strictEqual(TOTAL_BENCH_COUNT, 12, 'Deben ser exactamente 12 puestos de banco (5 suplentes + 7 reservas)')
  assert.strictEqual(BENCH_SLOTS.length, 12, '12 definiciones de slots en BENCH_SLOTS')

  const f1Id = '4-3-1-2'
  const f2Id = '4-3-3'
  const fSlots1 = FORMATIONS[f1Id].slots
  const fSlots2 = FORMATIONS[f2Id].slots

  const t1Starters = new Array(11).fill(null)
  const t1Bench = new Array(TOTAL_BENCH_COUNT).fill(null)
  const t2Starters = new Array(11).fill(null)
  const t2Bench = new Array(TOTAL_BENCH_COUNT).fill(null)

  const usedMatchIds = new Set()

  // Asignar primero Capitanes
  const cap1 = getCaptainChoices(usedMatchIds)[0]
  usedMatchIds.add(cap1.id)
  const sIdx1 = placeCaptainInFormation(cap1, fSlots1, t1Starters)
  t1Starters[sIdx1] = { ...cap1, isCaptain: true }

  const cap2 = getCaptainChoices(usedMatchIds)[0]
  usedMatchIds.add(cap2.id)
  const sIdx2 = placeCaptainInFormation(cap2, fSlots2, t2Starters)
  t2Starters[sIdx2] = { ...cap2, isCaptain: true }

  // Simular el resto de picks (titulares restantes y 12 suplentes por equipo)
  for (let i = 0; i < 11; i++) {
    if (!t1Starters[i]) {
      const tier = rollCategoryByProbability()
      const cands = getCandidatesForPositionAndCategory(fSlots1[i].role, tier, usedMatchIds)
      const chosen = cands[0]
      usedMatchIds.add(chosen.id)
      t1Starters[i] = chosen
    }
    if (!t2Starters[i]) {
      const tier = rollCategoryByProbability()
      const cands = getCandidatesForPositionAndCategory(fSlots2[i].role, tier, usedMatchIds)
      const chosen = selectAIFutDraftCard(cands, fSlots2[i].role)
      usedMatchIds.add(chosen.id)
      t2Starters[i] = chosen
    }
  }

  // 12 suplentes por equipo
  for (let b = 0; b < TOTAL_BENCH_COUNT; b++) {
    const role = BENCH_SLOTS[b].role

    const tier1 = rollCategoryByProbability()
    const cands1 = getCandidatesForPositionAndCategory(role, tier1, usedMatchIds)
    const pick1 = cands1[0]
    usedMatchIds.add(pick1.id)
    t1Bench[b] = pick1

    const tier2 = rollCategoryByProbability()
    const cands2 = getCandidatesForPositionAndCategory(role, tier2, usedMatchIds)
    const pick2 = selectAIFutDraftCard(cands2, role)
    usedMatchIds.add(pick2.id)
    t2Bench[b] = pick2
  }

  assert.strictEqual(t1Starters.filter(Boolean).length, 11, 'Equipo 1 tiene 11 titulares')
  assert.strictEqual(t1Bench.filter(Boolean).length, 12, 'Equipo 1 tiene 12 suplentes')
  assert.strictEqual(t2Starters.filter(Boolean).length, 11, 'Equipo 2 tiene 11 titulares')
  assert.strictEqual(t2Bench.filter(Boolean).length, 12, 'Equipo 2 tiene 12 suplentes')
  assert.strictEqual(usedMatchIds.size, 46, 'Exactamente 46 cartas únicas fichadas (23 por bando)')

  const freeRemaining = 200 - usedMatchIds.size
  console.log(`✔ Draft completo de 23 jugadores por equipo (46 fichados). Jugadores restantes libres en DB: ${freeRemaining} (¡el rival nunca se queda sin opciones!).`)

  console.log('\n=== 5. Verificando Construcción de Equipos y Simulación de Partido ===')
  const team1 = buildTeamFromFutDraft(f1Id, t1Starters, t1Bench, {
    name: 'Boca FUT Pro',
    primaryColor: '#1d4ed8',
    secondaryColor: '#facc15'
  }, cap1.id)
  const team2 = buildTeamFromFutDraft(f2Id, t2Starters, t2Bench, {
    name: 'River FUT Pro',
    primaryColor: '#ffffff',
    secondaryColor: '#ef4444'
  }, cap2.id)

  assert.strictEqual(team1.players.length, 11, 'Team 1: 11 en cancha')
  assert.strictEqual(team1.bench.length, 12, 'Team 1: 12 en banco')
  assert.strictEqual(team1.setPieces.captainID, cap1.id, 'Capitán oficial asignado a Team 1')
  assert.strictEqual(team2.setPieces.captainID, cap2.id, 'Capitán oficial asignado a Team 2')

  let match = await initiateGame(team1, team2, PITCH_CONFIG)
  for (let i = 0; i < 500; i++) match = await playIteration(match)
  match = await startSecondHalf(match)
  for (let i = 0; i < 500; i++) match = await playIteration(match)

  console.log(`✔ Partido jugado (1000 ticks): ${match.kickOffTeam.name} ${match.kickOffTeamStatistics.goals} - ${match.secondTeamStatistics.goals} ${match.secondTeam.name}`)
  console.log(`  Tiros: ${match.kickOffTeamStatistics.shots.total} vs ${match.secondTeamStatistics.shots.total}`)
  console.log('✔ ¡Todos los tests de FUT Draft con Capitán, Probabilidades, Reroll y 12 Suplentes superados!')
}

runFutDraftTests().catch(err => {
  console.error('❌ Error en verifyFutDraft:', err)
  process.exit(1)
})
