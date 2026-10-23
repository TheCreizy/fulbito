import React, { useState, useMemo } from 'react'
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
  TIER_CONFIG_INFO
} from '../draft/futDraftEngine.js'
import { FORMATIONS, getFormationCoordinates } from '../data/formations.js'
import { getPlayerNickname } from '../commentary/commentaryEngine.js'
import { soundEngine } from '../audio/soundEngine.js'
import { TRAIT_DEFINITIONS } from '../data/playersDB.js'

export default function FutDraftScreen({
  gameMode = 'ai',
  team1Config,
  team2Config,
  onDraftComplete,
  onCancel
}) {
  // Fases: 'formation' | 'captain' | 'coinToss' | 'draft'
  const [phase, setPhase] = useState('formation')

  // Formaciones
  const [formationChoicesTeam1] = useState(() => getFormationChoices(5))
  const [formationChoicesTeam2] = useState(() => getFormationChoices(5))
  const [team1FormationId, setTeam1FormationId] = useState(null)
  const [team2FormationId, setTeam2FormationId] = useState(null)
  const [formationStep, setFormationStep] = useState(1) // 1 = Equipo 1, 2 = Equipo 2 (en PvP)

  // Capitán: 5 Leyendas únicas en 5 posiciones distintas
  const [captainChoicesTeam1, setCaptainChoicesTeam1] = useState(null)
  const [captainChoicesTeam2, setCaptainChoicesTeam2] = useState(null)
  const [captainStep, setCaptainStep] = useState(1) // 1 = Equipo 1, 2 = Equipo 2
  const [team1Captain, setTeam1Captain] = useState(null)
  const [team2Captain, setTeam2Captain] = useState(null)

  // Rerolls por equipo (2 por draft)
  const [team1Rerolls, setTeam1Rerolls] = useState(2)
  const [team2Rerolls, setTeam2Rerolls] = useState(2)

  // Turnos en el Draft: 1 o 2
  const [activeTurnTeam, setActiveTurnTeam] = useState(1)
  const [activeViewTeam, setActiveViewTeam] = useState(1) // Cancha visible en pantalla

  // Pestaña activa del banco de suplentes: 'sub' (5 suplentes directos) | 'res' (7 reservas)
  const [activeBenchTab, setActiveBenchTab] = useState('sub')

  // Planteles: 11 titulares (index 0..10) y 12 suplentes/reservas (index 0..11)
  const [team1Starters, setTeam1Starters] = useState(() => new Array(11).fill(null))
  const [team1Bench, setTeam1Bench] = useState(() => new Array(TOTAL_BENCH_COUNT).fill(null))
  const [team2Starters, setTeam2Starters] = useState(() => new Array(11).fill(null))
  const [team2Bench, setTeam2Bench] = useState(() => new Array(TOTAL_BENCH_COUNT).fill(null))

  // IDs de jugadores ya elegidos (evita duplicados en todo el partido)
  const [usedIds, setUsedIds] = useState(() => new Set())

  // Modal de Sobre de 5 candidatos
  const [packModal, setPackModal] = useState(null) // { slotType, slotIndex, role, label, drawnTier, candidates }

  // Notificación de última elección de la IA
  const [lastAIPickNotice, setLastAIPickNotice] = useState(null)
  const [coinTossWinner, setCoinTossWinner] = useState(null)

  // -------------------------------------------------------------------------
  // FASE 1: Selección de Formación
  // -------------------------------------------------------------------------
  const handleSelectFormation = (fId) => {
    soundEngine.playMenuClick('confirm')
    if (formationStep === 1) {
      setTeam1FormationId(fId)
      if (gameMode === 'pvp') {
        setFormationStep(2)
      } else {
        const aiChoice = formationChoicesTeam2[Math.floor(Math.random() * formationChoicesTeam2.length)].id
        setTeam2FormationId(aiChoice)
        // Generar sobre de capitán para Equipo 1 y pasar a Fase Capitán
        const capPicks = getCaptainChoices(usedIds)
        setCaptainChoicesTeam1(capPicks)
        setPhase('captain')
        setCaptainStep(1)
      }
    } else {
      setTeam2FormationId(fId)
      // En PvP: preparar sobre de capitán para Equipo 1
      const capPicks1 = getCaptainChoices(usedIds)
      setCaptainChoicesTeam1(capPicks1)
      setPhase('captain')
      setCaptainStep(1)
    }
  }

  // -------------------------------------------------------------------------
  // FASE 2: Selección del Capitán (5 Leyendas en 5 posiciones distintas)
  // -------------------------------------------------------------------------
  const handlePickCaptain = (captainLegend) => {
    soundEngine.playMenuClick('confirm')
    const nextUsed = new Set(usedIds)
    nextUsed.add(captainLegend.id)
    setUsedIds(nextUsed)

    const isStep1 = captainStep === 1
    const targetFormationId = isStep1 ? team1FormationId : team2FormationId
    const formSlots = FORMATIONS[targetFormationId]?.slots || FORMATIONS['4-4-2'].slots

    if (isStep1) {
      setTeam1Captain(captainLegend)
      // Asignar al Capitán en el slot correspondiente de su formación
      const starterIdx = placeCaptainInFormation(captainLegend, formSlots, team1Starters)
      const nextStarters = [...team1Starters]
      nextStarters[starterIdx] = { ...captainLegend, isCaptain: true }
      setTeam1Starters(nextStarters)

      if (gameMode === 'pvp') {
        // En PvP, ahora elige el Capitán el Equipo 2
        const capPicks2 = getCaptainChoices(nextUsed)
        setCaptainChoicesTeam2(capPicks2)
        setCaptainStep(2)
      } else {
        // En vs IA: la IA elige su Capitán al azar entre 5 leyendas
        const capPicksAI = getCaptainChoices(nextUsed)
        const chosenAI = capPicksAI[Math.floor(Math.random() * capPicksAI.length)]
        nextUsed.add(chosenAI.id)
        setUsedIds(new Set(nextUsed))
        setTeam2Captain(chosenAI)

        const aiFormSlots = FORMATIONS[team2FormationId]?.slots || FORMATIONS['4-3-3'].slots
        const aiStarterIdx = placeCaptainInFormation(chosenAI, aiFormSlots, team2Starters)
        const nextAiStarters = [...team2Starters]
        nextAiStarters[aiStarterIdx] = { ...chosenAI, isCaptain: true }
        setTeam2Starters(nextAiStarters)

        setPhase('draft')
        setActiveTurnTeam(1)
        setActiveViewTeam(1)
      }
    } else {
      // PvP: Equipo 2 eligió Capitán -> Pasar a Sorteo de Moneda
      setTeam2Captain(captainLegend)
      const starterIdx = placeCaptainInFormation(captainLegend, formSlots, team2Starters)
      const nextStarters = [...team2Starters]
      nextStarters[starterIdx] = { ...captainLegend, isCaptain: true }
      setTeam2Starters(nextStarters)

      const firstTurn = Math.random() < 0.5 ? 1 : 2
      setCoinTossWinner(firstTurn)
      setActiveTurnTeam(firstTurn)
      setActiveViewTeam(firstTurn)
      setPhase('coinToss')
    }
  }

  // -------------------------------------------------------------------------
  // FASE 3: Sorteo de Moneda (PvP)
  // -------------------------------------------------------------------------
  const handleStartDraftAfterToss = () => {
    soundEngine.playWhistle('short')
    setPhase('draft')
  }

  // -------------------------------------------------------------------------
  // FASE 4: Cancha Interactiva, Modal de Sobre y Reroll
  // -------------------------------------------------------------------------
  const currentTeamConfig = activeTurnTeam === 1 ? team1Config : team2Config
  const currentFormationId = activeViewTeam === 1 ? team1FormationId : team2FormationId
  const currentFormation = FORMATIONS[currentFormationId] || FORMATIONS['4-4-2']
  const currentStarters = activeViewTeam === 1 ? team1Starters : team2Starters
  const currentBench = activeViewTeam === 1 ? team1Bench : team2Bench

  const currentRerolls = activeTurnTeam === 1 ? team1Rerolls : team2Rerolls

  // Conteo de picks (Total: 11 titulares + 12 suplentes/reservas = 23)
  const t1PicksCount = team1Starters.filter(Boolean).length + team1Bench.filter(Boolean).length
  const t2PicksCount = team2Starters.filter(Boolean).length + team2Bench.filter(Boolean).length
  const totalSlotsCount = 11 + TOTAL_BENCH_COUNT // 23
  const isTeam1Complete = t1PicksCount === totalSlotsCount
  const isTeam2Complete = t2PicksCount === totalSlotsCount
  const isDraftFullyComplete = isTeam1Complete && isTeam2Complete

  // Rating promedio dinámico del equipo visto
  const currentViewAvgOvr = useMemo(() => {
    const filled = currentStarters.filter(Boolean)
    if (filled.length === 0) return 0
    return Math.round(filled.reduce((sum, p) => sum + p.rating, 0) / filled.length)
  }, [currentStarters])

  const handleOpenSlotModal = (slotType, slotIndex, role, label) => {
    if (activeViewTeam !== activeTurnTeam) {
      soundEngine.playMenuClick('tab')
      setActiveViewTeam(activeTurnTeam)
      return
    }

    soundEngine.playMenuClick('tab')

    // 1. Sortear la categoría del sobre según las probabilidades
    const drawnTier = rollCategoryByProbability()

    // 2. Obtener 5 candidatos compatibles 100% de esa categoría
    const candidates = getCandidatesForPositionAndCategory(role, drawnTier, usedIds)

    setPackModal({
      slotType,
      slotIndex,
      role,
      label,
      drawnTier,
      candidates
    })
  }

  // Mecánica de Reroll: vuelve a sortear la categoría y genera 5 candidatos nuevos
  const handleRerollPack = () => {
    if (currentRerolls <= 0 || !packModal) return
    soundEngine.playMenuClick('tab')

    if (activeTurnTeam === 1) {
      setTeam1Rerolls(prev => Math.max(0, prev - 1))
    } else {
      setTeam2Rerolls(prev => Math.max(0, prev - 1))
    }

    // Volver a sortear categoría y regenerar cartas
    const newTier = rollCategoryByProbability()
    const newCandidates = getCandidatesForPositionAndCategory(packModal.role, newTier, usedIds)

    setPackModal(prev => ({
      ...prev,
      drawnTier: newTier,
      candidates: newCandidates
    }))
  }

  const handlePickCandidate = (player) => {
    soundEngine.playMenuClick('confirm')
    const nextUsed = new Set(usedIds)
    nextUsed.add(player.id)
    setUsedIds(nextUsed)

    const isTeam1 = activeTurnTeam === 1

    // 1. Asignar jugador en el slot
    if (packModal.slotType === 'starter') {
      if (isTeam1) {
        const next = [...team1Starters]
        next[packModal.slotIndex] = player
        setTeam1Starters(next)
      } else {
        const next = [...team2Starters]
        next[packModal.slotIndex] = player
        setTeam2Starters(next)
      }
    } else {
      if (isTeam1) {
        const next = [...team1Bench]
        next[packModal.slotIndex] = player
        setTeam1Bench(next)
      } else {
        const next = [...team2Bench]
        next[packModal.slotIndex] = player
        setTeam2Bench(next)
      }
    }

    setPackModal(null)

    // 2. Modo vs IA: la IA realiza su pick inmediatamente
    if (gameMode !== 'pvp') {
      const aiFormSlots = FORMATIONS[team2FormationId]?.slots || FORMATIONS['4-3-3'].slots
      const nextAiSlot = getNextEmptyAISlot(aiFormSlots, team2Starters, team2Bench)

      if (nextAiSlot) {
        const aiDrawnTier = rollCategoryByProbability()
        const aiCands = getCandidatesForPositionAndCategory(nextAiSlot.role, aiDrawnTier, nextUsed)
        const aiPick = selectAIFutDraftCard(aiCands, nextAiSlot.role)

        if (aiPick) {
          nextUsed.add(aiPick.id)
          setUsedIds(new Set(nextUsed))
          if (nextAiSlot.type === 'starter') {
            const nextStarters = [...team2Starters]
            nextStarters[nextAiSlot.index] = aiPick
            setTeam2Starters(nextStarters)
          } else {
            const nextBench = [...team2Bench]
            nextBench[nextAiSlot.index] = aiPick
            setTeam2Bench(nextBench)
          }

          const tierInfo = TIER_CONFIG_INFO[aiDrawnTier]
          setLastAIPickNotice({
            playerName: aiPick.name,
            role: nextAiSlot.label,
            rating: aiPick.rating,
            tierBadge: tierInfo?.badge || aiDrawnTier,
            tierColor: tierInfo?.color || '#fff'
          })
        }
      }
    } else {
      // Modo PvP Local: cambiar el turno al otro equipo
      const nextTurn = activeTurnTeam === 1 ? 2 : 1
      setActiveTurnTeam(nextTurn)
      setActiveViewTeam(nextTurn)
    }
  }

  // Finalizar Draft y mandar equipos armados
  const handleCompleteDraft = () => {
    soundEngine.playWhistle('short')
    const t1 = buildTeamFromFutDraft(team1FormationId, team1Starters, team1Bench, team1Config, team1Captain?.id)
    const t2 = buildTeamFromFutDraft(team2FormationId, team2Starters, team2Bench, team2Config, team2Captain?.id)
    onDraftComplete(t1, t2)
  }

  // Autocompletar slots vacíos restantes
  const handleAutoFillRemaining = () => {
    soundEngine.playMenuClick('confirm')
    const currentUsed = new Set(usedIds)

    const fillTeam = (formationId, starters, bench) => {
      const formSlots = FORMATIONS[formationId]?.slots || FORMATIONS['4-4-2'].slots
      const nextStarters = [...starters]
      const nextBench = [...bench]

      for (let i = 0; i < 11; i++) {
        if (!nextStarters[i]) {
          const role = formSlots[i].role
          const tier = rollCategoryByProbability()
          const cands = getCandidatesForPositionAndCategory(role, tier, currentUsed)
          const pick = selectAIFutDraftCard(cands, role)
          if (pick) {
            currentUsed.add(pick.id)
            nextStarters[i] = pick
          }
        }
      }

      for (let i = 0; i < TOTAL_BENCH_COUNT; i++) {
        if (!nextBench[i]) {
          const role = BENCH_SLOTS[i].allowedRoles || BENCH_SLOTS[i].role
          const tier = rollCategoryByProbability()
          const cands = getCandidatesForPositionAndCategory(role, tier, currentUsed)
          const pick = selectAIFutDraftCard(cands, role)
          if (pick) {
            currentUsed.add(pick.id)
            nextBench[i] = pick
          }
        }
      }

      return { nextStarters, nextBench }
    }

    const res1 = fillTeam(team1FormationId, team1Starters, team1Bench)
    setTeam1Starters(res1.nextStarters)
    setTeam1Bench(res1.nextBench)

    const res2 = fillTeam(team2FormationId, team2Starters, team2Bench)
    setTeam2Starters(res2.nextStarters)
    setTeam2Bench(res2.nextBench)

    setUsedIds(new Set(currentUsed))
  }

  // Coordenadas de los slots de la formación activa
  const slotsCoords = useMemo(() => {
    return getFormationCoordinates(currentFormationId, 'balanced', 'top')
  }, [currentFormationId])

  // -------------------------------------------------------------------------
  // RENDER: FASE 1 (Selección de Formación)
  // -------------------------------------------------------------------------
  if (phase === 'formation') {
    const isStep1 = formationStep === 1
    const choosingTeam = isStep1 ? team1Config : team2Config
    const choices = isStep1 ? formationChoicesTeam1 : formationChoicesTeam2

    return (
      <div className="fut-draft-fullscreen">
        <div className="fut-draft-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <span style={{ fontSize: '1.8rem' }}>⚡</span>
            <div>
              <h1 style={{ fontSize: '1.5rem', color: '#facc15', margin: 0, letterSpacing: '0.05em' }}>
                FUT DRAFT TÁCTICO • ELECCIÓN DE FORMACIÓN
              </h1>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                {isStep1 ? `Paso 1: ${choosingTeam.name}` : `Paso 2: ${choosingTeam.name} (Rival)`} • Elegí el esquema táctico con el que armarás tu equipo
              </div>
            </div>
          </div>
          <button type="button" className="btn btn-danger btn-sm" onClick={onCancel}>
            ✕ Cancelar y Volver
          </button>
        </div>

        <div style={{ maxWidth: '1100px', margin: '2rem auto', padding: '0 1rem' }}>
          <div
            style={{
              textAlign: 'center',
              marginBottom: '2rem',
              padding: '1rem',
              background: 'rgba(15, 23, 42, 0.75)',
              borderRadius: '8px',
              border: `2px solid ${choosingTeam.primaryColor || '#facc15'}`
            }}
          >
            <div style={{ fontSize: '0.82rem', color: '#facc15', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              SELECCIÓN PARA
            </div>
            <h2 style={{ fontSize: '1.8rem', color: '#fff', margin: '0.3rem 0' }}>
              {choosingTeam.name}
            </h2>
            <div style={{ fontSize: '0.88rem', color: '#94a3b8' }}>
              Elegí 1 de las 5 formaciones disponibles para esta edición de Draft
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.2rem' }}>
            {choices.map((form) => (
              <div
                key={form.id}
                onClick={() => handleSelectFormation(form.id)}
                style={{
                  background: 'linear-gradient(180deg, #0b1a33 0%, #060e1d 100%)',
                  border: '2px solid #284678',
                  borderRadius: '10px',
                  padding: '1.2rem 1rem',
                  cursor: 'pointer',
                  transition: 'all 0.22s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#facc15'
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = '0 10px 25px rgba(250, 204, 21, 0.25)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#284678'
                  e.currentTarget.style.transform = 'none'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div
                  style={{
                    fontSize: '1.6rem',
                    fontWeight: 900,
                    fontFamily: 'Chakra Petch',
                    color: '#facc15',
                    marginBottom: '0.4rem'
                  }}
                >
                  {form.id}
                </div>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#fff', marginBottom: '0.6rem' }}>
                  {form.name}
                </div>

                {/* Mini vista táctica */}
                <div
                  style={{
                    width: '120px',
                    height: '110px',
                    background: 'rgba(2, 6, 23, 0.85)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '4px',
                    position: 'relative',
                    margin: '0.8rem 0'
                  }}
                >
                  {form.slots.map((s, idx) => {
                    const lPct = Math.max(8, Math.min(92, (s.pos[0] / 680) * 100))
                    const tPct = Math.max(10, Math.min(90, 96 - (s.pos[1] / 540) * 86))
                    return (
                      <div
                        key={idx}
                        style={{
                          position: 'absolute',
                          left: `${lPct}%`,
                          top: `${tPct}%`,
                          transform: 'translate(-50%, -50%)',
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          background: s.role === 'GK' ? '#38bdf8' : '#facc15'
                        }}
                      />
                    )
                  })}
                </div>

                <p style={{ fontSize: '0.74rem', color: '#94a3b8', lineHeight: 1.4, margin: '0.5rem 0' }}>
                  {form.description}
                </p>

                <button
                  type="button"
                  className="btn btn-gold btn-sm"
                  style={{ width: '100%', marginTop: 'auto' }}
                >
                  Elegir {form.id}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // RENDER: FASE 2 (Selección del Capitán: 5 Leyendas en 5 posiciones distintas)
  // -------------------------------------------------------------------------
  if (phase === 'captain') {
    const isStep1 = captainStep === 1
    const choosingTeam = isStep1 ? team1Config : team2Config
    const captainPicks = isStep1 ? captainChoicesTeam1 : captainChoicesTeam2

    return (
      <div className="fut-draft-fullscreen">
        <div className="fut-draft-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <span style={{ fontSize: '1.8rem' }}>👑</span>
            <div>
              <h1 style={{ fontSize: '1.45rem', color: '#facc15', margin: 0, letterSpacing: '0.04em' }}>
                FUT DRAFT • ELECCIÓN DEL CAPITÁN
              </h1>
              <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                Elegí a la leyenda que llevará la cinta. Cada opción juega en una posición diferente.
              </div>
            </div>
          </div>
          <button type="button" className="btn btn-danger btn-sm" onClick={onCancel}>
            ✕ Salir
          </button>
        </div>

        <div style={{ maxWidth: '1100px', margin: '2rem auto', padding: '0 1rem' }}>
          <div
            style={{
              textAlign: 'center',
              marginBottom: '2rem',
              padding: '1.2rem',
              background: 'linear-gradient(180deg, #1e1b4b 0%, #0d0b26 100%)',
              borderRadius: '8px',
              border: '2px solid #f59e0b',
              boxShadow: '0 0 30px rgba(245, 158, 11, 0.25)'
            }}
          >
            <div style={{ fontSize: '0.85rem', color: '#facc15', fontWeight: 900, letterSpacing: '0.12em' }}>
              ★ SOBRE DE CAPITANES ESTELARES ★
            </div>
            <h2 style={{ fontSize: '1.9rem', color: '#fff', margin: '0.4rem 0' }}>
              {choosingTeam.name}
            </h2>
            <div style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>
              Seleccioná a la Leyenda que liderará tu esquema táctico. Se ubicará automáticamente en su puesto titular.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '1rem' }}>
            {(captainPicks || []).map((card) => {
              const nick = getPlayerNickname(card.name)
              const isGK = card.position === 'GK'

              return (
                <div
                  key={card.id}
                  onClick={() => handlePickCaptain(card)}
                  style={{
                    background: 'linear-gradient(180deg, #1a1500 0%, #080700 100%)',
                    border: '2px solid #f59e0b',
                    borderRadius: '10px',
                    padding: '1rem 0.8rem',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'all 0.22s ease',
                    boxShadow: '0 8px 24px rgba(245, 158, 11, 0.2)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-8px) scale(1.03)'
                    e.currentTarget.style.boxShadow = '0 16px 36px rgba(245, 158, 11, 0.45)'
                    e.currentTarget.style.borderColor = '#fff'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'none'
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(245, 158, 11, 0.2)'
                    e.currentTarget.style.borderColor = '#f59e0b'
                  }}
                >
                  <div>
                    {/* Badge de Línea */}
                    {card.captainLine && (
                      <div
                        style={{
                          fontSize: '0.66rem',
                          fontWeight: 900,
                          background: '#facc15',
                          color: '#000',
                          padding: '2px 6px',
                          borderRadius: '3px',
                          textAlign: 'center',
                          marginBottom: '0.6rem',
                          letterSpacing: '0.05em'
                        }}
                      >
                        {card.captainLine.toUpperCase()}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                      <div>
                        <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#facc15', fontFamily: 'Chakra Petch', lineHeight: 1 }}>
                          {card.rating}
                        </div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#38bdf8' }}>
                          {card.position}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 900,
                          padding: '2px 6px',
                          borderRadius: '3px',
                          background: '#f59e0b',
                          color: '#000'
                        }}
                      >
                        LEYENDA
                      </span>
                    </div>

                    <div style={{ fontSize: '1rem', fontWeight: 900, color: '#fff', lineHeight: 1.2, minHeight: '2.4rem' }}>
                      {card.name}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#facc15', fontStyle: 'italic', marginBottom: '0.6rem', whiteSpace: 'normal', wordBreak: 'break-word', minHeight: '2.1rem', lineHeight: 1.25 }}>
                      {nick ? `"${nick}"` : card.specialty}
                    </div>

                    {/* Atributos clave dentro del recuadro */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.22rem', fontSize: '0.67rem', background: '#020617', padding: '0.42rem 0.35rem', borderRadius: '4px', marginBottom: '0.75rem', border: '1px solid #1e293b' }}>
                      {isGK ? (
                        <>
                          <div>ATA: <strong>{card.skill?.saving}</strong></div>
                          <div>AGI: <strong>{card.skill?.agility}</strong></div>
                          <div>SAL: <strong>{card.skill?.jumping}</strong></div>
                          <div>PER: <strong>{card.skill?.perception}</strong></div>
                          <div>PAS: <strong>{card.skill?.passing}</strong></div>
                          <div>FUE: <strong>{card.skill?.strength}</strong></div>
                        </>
                      ) : (
                        <>
                          <div>PAS: <strong>{card.skill?.passing}</strong></div>
                          <div>TIR: <strong>{card.skill?.shooting}</strong></div>
                          <div>ENT: <strong>{card.skill?.tackling}</strong></div>
                          <div>AGI: <strong>{card.skill?.agility}</strong></div>
                          <div>FUE: <strong>{card.skill?.strength}</strong></div>
                          <div>CON: <strong>{card.skill?.control}</strong></div>
                        </>
                      )}
                      <div>TL: <strong>{card.skill?.freekick}</strong></div>
                      <div>PEN: <strong>{card.skill?.penalty_taking}</strong></div>
                      <div>ALT: <strong>{card.height}cm</strong></div>
                    </div>
                    {/* Rasgo distintivo */}
                    {Array.isArray(card.traits) && card.traits.length > 0 && (
                      <div style={{ fontSize: '0.68rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.6rem' }}>
                        <span>{TRAIT_DEFINITIONS?.[card.traits[0]]?.icon || '⭐'}</span>
                        <span style={{ fontWeight: 700 }}>{TRAIT_DEFINITIONS?.[card.traits[0]]?.label || card.traits[0]}</span>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    className="btn btn-gold btn-sm"
                    style={{ width: '100%', fontSize: '0.85rem', fontWeight: 900, padding: '0.45rem 0' }}
                  >
                    👑 Elegir Capitán
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // RENDER: FASE 3 (Sorteo de Moneda PvP)
  // -------------------------------------------------------------------------
  if (phase === 'coinToss') {
    const winnerTeam = coinTossWinner === 1 ? team1Config : team2Config
    return (
      <div className="fut-draft-fullscreen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          className="modal-content"
          style={{
            maxWidth: '520px',
            textAlign: 'center',
            padding: '2.5rem 2rem',
            border: '3px solid #facc15',
            boxShadow: '0 0 30px rgba(250, 204, 21, 0.35)'
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🪙</div>
          <div style={{ fontSize: '0.85rem', color: '#facc15', fontWeight: 800, letterSpacing: '0.1em' }}>
            SORTEO DE SAQUE INICIAL DE DRAFT
          </div>
          <h2 style={{ fontSize: '1.8rem', color: '#fff', margin: '0.5rem 0 1rem' }}>
            ¡La moneda favoreció a {winnerTeam.name}!
          </h2>
          <p style={{ fontSize: '0.92rem', color: '#cbd5e1', lineHeight: 1.5, marginBottom: '2rem' }}>
            Ambos equipos ya tienen su <strong>Capitán</strong> en cancha. El sorteo determinó que <strong>{winnerTeam.name}</strong> tendrá el primer turno para continuar armando las posiciones restantes.
          </p>
          <button
            type="button"
            className="btn btn-gold"
            style={{ fontSize: '1.1rem', padding: '0.75rem 2rem' }}
            onClick={handleStartDraftAfterToss}
          >
            Continuar a la Cancha ➔
          </button>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // RENDER: FASE 4 (Cancha Interactiva y 12 Suplentes / Reservas)
  // -------------------------------------------------------------------------
  return (
    <div className="fut-draft-fullscreen">
      {/* Barra Superior con Controles, Rerolls y Turnos */}
      <div className="fut-draft-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <span style={{ fontSize: '1.6rem' }}>⚡</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h1 style={{ fontSize: '1.35rem', color: '#facc15', margin: 0, letterSpacing: '0.04em' }}>
                FUT DRAFT TÁCTICO
              </h1>
              <span
                style={{
                  background: 'rgba(250, 204, 21, 0.15)',
                  color: '#facc15',
                  padding: '0.15rem 0.5rem',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  borderRadius: '3px',
                  border: '1px solid rgba(250, 204, 21, 0.3)'
                }}
              >
                11 CANCHA + 12 EN BANCO (23 PICKS)
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              Sobres con probabilidad por categoría • 2 Rerolls por equipo
            </div>
          </div>
        </div>

        {/* Indicador central de Turno actual y Rerolls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              background: 'rgba(0, 0, 0, 0.65)',
              padding: '0.4rem 0.9rem',
              borderRadius: '6px',
              border: `2px solid ${currentTeamConfig.primaryColor || '#facc15'}`
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: '#22c55e',
                boxShadow: '0 0 10px #22c55e',
                animation: 'pulse 1.5s infinite'
              }}
            />
            <div>
              <div style={{ fontSize: '0.65rem', color: '#facc15', fontWeight: 800, letterSpacing: '0.05em' }}>
                TURNO DE SELECCIÓN
              </div>
              <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#fff' }}>
                {currentTeamConfig.name} ({activeTurnTeam === 1 ? t1PicksCount : t2PicksCount}/{totalSlotsCount})
              </div>
            </div>
          </div>

          {/* Contador de Rerolls */}
          <div
            style={{
              background: '#040b17',
              border: '1.5px solid #38bdf8',
              borderRadius: '6px',
              padding: '0.35rem 0.75rem',
              textAlign: 'center'
            }}
            title="Podés relanzar el sobre hasta 2 veces si no te convence la categoría o las cartas"
          >
            <div style={{ fontSize: '0.62rem', color: '#38bdf8', fontWeight: 800 }}>REROLLS DISPONIBLES</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 900, color: currentRerolls > 0 ? '#38bdf8' : '#64748b', fontFamily: 'Chakra Petch' }}>
              🎲 {currentRerolls} / 2
            </div>
          </div>
        </div>

        {/* Acciones derecha */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {!isDraftFullyComplete && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleAutoFillRemaining}
              title="Completa automáticamente las posiciones restantes con IA"
            >
              ⚡ Autocompletar
            </button>
          )}

          {isDraftFullyComplete ? (
            <button
              type="button"
              className="btn btn-gold btn-sm"
              style={{ fontSize: '0.95rem', fontWeight: 800, padding: '0.5rem 1.2rem', boxShadow: '0 0 15px rgba(250,204,21,0.5)' }}
              onClick={handleCompleteDraft}
            >
              ⚽ Ir a Pizarra Táctica ➔
            </button>
          ) : (
            <button type="button" className="btn btn-danger btn-sm" onClick={onCancel}>
              ✕ Salir
            </button>
          )}
        </div>
      </div>

      {/* Selector de Cancha: Equipo 1 vs Equipo 2 */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.8rem', padding: '0.5rem 1rem', background: '#040b17', borderBottom: '1px solid #1e293b' }}>
        <button
          type="button"
          onClick={() => setActiveViewTeam(1)}
          style={{
            background: activeViewTeam === 1 ? 'linear-gradient(135deg, #1e3a8a 0%, #172554 100%)' : '#091322',
            color: activeViewTeam === 1 ? '#facc15' : '#94a3b8',
            border: activeViewTeam === 1 ? '2px solid #facc15' : '1px solid #1e293b',
            borderRadius: '4px',
            padding: '0.35rem 1.2rem',
            fontSize: '0.85rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <span>{team1Config.name}</span>
          <span style={{ fontSize: '0.72rem', background: '#020617', padding: '1px 6px', borderRadius: '3px', color: '#38bdf8' }}>
            {team1FormationId} • {t1PicksCount}/{totalSlotsCount}
          </span>
          {activeTurnTeam === 1 && <span style={{ color: '#22c55e', fontSize: '0.75rem' }}>● TU TURNO</span>}
        </button>

        <button
          type="button"
          onClick={() => setActiveViewTeam(2)}
          style={{
            background: activeViewTeam === 2 ? 'linear-gradient(135deg, #1e3a8a 0%, #172554 100%)' : '#091322',
            color: activeViewTeam === 2 ? '#facc15' : '#94a3b8',
            border: activeViewTeam === 2 ? '2px solid #facc15' : '1px solid #1e293b',
            borderRadius: '4px',
            padding: '0.35rem 1.2rem',
            fontSize: '0.85rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <span>{team2Config.name}</span>
          <span style={{ fontSize: '0.72rem', background: '#020617', padding: '1px 6px', borderRadius: '3px', color: '#38bdf8' }}>
            {team2FormationId} • {t2PicksCount}/{totalSlotsCount}
          </span>
          {activeTurnTeam === 2 && <span style={{ color: '#22c55e', fontSize: '0.75rem' }}>● TURNO</span>}
        </button>
      </div>

      {/* Banner de aviso de la IA si acaba de fichar */}
      {lastAIPickNotice && (
        <div
          style={{
            background: 'linear-gradient(90deg, #1e1b4b 0%, #311042 100%)',
            borderBottom: '1px solid #a855f7',
            padding: '0.35rem 1rem',
            fontSize: '0.8rem',
            color: '#e9d5ff',
            textAlign: 'center',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '0.55rem'
          }}
        >
          <span>🤖 <strong>{team2Config.name} (IA)</strong> abrió sobre</span>
          <span style={{ color: lastAIPickNotice.tierColor, fontWeight: 900 }}>[{lastAIPickNotice.tierBadge}]</span>
          <span>y fichó a</span>
          <strong style={{ color: '#facc15' }}>{lastAIPickNotice.playerName}</strong>
          <span>(OVR {lastAIPickNotice.rating} • {lastAIPickNotice.role})</span>
        </div>
      )}

      {/* CUERPO PRINCIPAL: Cancha Vertical + 12 Puestos de Banco */}
      <div style={{ maxWidth: '840px', margin: '0.75rem auto', padding: '0 1rem 2rem' }}>
        {/* Info del equipo actual en pantalla */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#facc15', fontWeight: 800, textTransform: 'uppercase' }}>
              ESQUEMA: {currentFormation.name}
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>
              {activeViewTeam === 1 ? team1Config.name : team2Config.name}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <div style={{ background: '#020617', border: '1px solid #334155', borderRadius: '4px', padding: '0.25rem 0.6rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>MEDIA OVR</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#facc15', fontFamily: 'Chakra Petch' }}>
                {currentViewAvgOvr || '--'}
              </div>
            </div>
            <div style={{ background: '#020617', border: '1px solid #334155', borderRadius: '4px', padding: '0.25rem 0.6rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>FICHADOS</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#38bdf8', fontFamily: 'Chakra Petch' }}>
                {activeViewTeam === 1 ? t1PicksCount : t2PicksCount}/{totalSlotsCount}
              </div>
            </div>
          </div>
        </div>

        {/* CANCHA VERTICAL ESTILO FIFA / PC FÚTBOL */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '560px',
            background: 'linear-gradient(180deg, #063d1e 0%, #084924 50%, #063d1e 100%)',
            borderRadius: '8px',
            border: '3px solid #1e293b',
            boxShadow: 'inset 0 0 40px rgba(0,0,0,0.6), 0 10px 30px rgba(0,0,0,0.5)',
            overflow: 'hidden'
          }}
        >
          {/* Líneas de Césped */}
          <div style={{ position: 'absolute', top: 0, left: '6%', width: '88%', height: '100%', border: '2px solid rgba(255,255,255,0.4)', borderTop: 'none', borderBottom: 'none' }} />
          {/* Área rival (arriba) */}
          <div style={{ position: 'absolute', top: 0, left: '26%', width: '48%', height: '14%', border: '2px solid rgba(255,255,255,0.4)', borderTop: 'none' }} />
          {/* Círculo central */}
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '100px', height: '100px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)' }} />
          <div style={{ position: 'absolute', top: '50%', left: '6%', width: '88%', height: '2px', background: 'rgba(255,255,255,0.4)' }} />
          {/* Área propia (abajo) */}
          <div style={{ position: 'absolute', bottom: 0, left: '26%', width: '48%', height: '14%', border: '2px solid rgba(255,255,255,0.4)', borderBottom: 'none' }} />

          {/* 11 Nodos de Titulares */}
          {slotsCoords.map((slot, idx) => {
            const player = currentStarters[idx]
            const leftPct = Math.max(8, Math.min(92, (slot.coords[0] / 680) * 100))
            const topPct = Math.max(10, Math.min(91, 96 - (slot.coords[1] / 540) * 86))
            const isTurnForThisTeam = activeViewTeam === activeTurnTeam
            const isCaptain = player?.isCaptain

            return (
              <div
                key={idx}
                style={{
                  position: 'absolute',
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: 10
                }}
              >
                {player ? (
                  // Slot ocupado
                  <div
                    style={{
                      background: 'linear-gradient(180deg, #091a36 0%, #030a17 100%)',
                      border: isCaptain
                        ? '2px solid #facc15'
                        : `2px solid ${player.category === 'legend' ? '#f59e0b' : (player.category === 'idol' ? '#a855f7' : (player.category === 'squad' ? '#10b981' : '#94a3b8'))}`,
                      borderRadius: '6px',
                      padding: '0.25rem 0.45rem',
                      minWidth: '68px',
                      textAlign: 'center',
                      boxShadow: isCaptain ? '0 0 16px rgba(250,204,21,0.6)' : '0 4px 12px rgba(0,0,0,0.6)',
                      position: 'relative'
                    }}
                  >
                    {isCaptain && (
                      <span
                        style={{
                          position: 'absolute',
                          top: -7,
                          right: -7,
                          background: '#facc15',
                          color: '#000',
                          fontSize: '0.58rem',
                          fontWeight: 900,
                          padding: '1px 4px',
                          borderRadius: '3px',
                          boxShadow: '0 2px 5px rgba(0,0,0,0.5)'
                        }}
                        title="Capitán del Equipo"
                      >
                        ©️
                      </span>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.2rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#facc15', fontFamily: 'Chakra Petch' }}>
                        {player.rating}
                      </span>
                      <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8' }}>
                        {slot.role}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '75px' }}>
                      {player.name.split(' ').slice(-1)[0]}
                    </div>
                  </div>
                ) : (
                  // Slot vacío
                  <button
                    type="button"
                    onClick={() => handleOpenSlotModal('starter', idx, slot.role, slot.label)}
                    disabled={!isTurnForThisTeam}
                    style={{
                      background: isTurnForThisTeam ? 'linear-gradient(135deg, rgba(250, 204, 21, 0.25) 0%, rgba(202, 138, 4, 0.35) 100%)' : 'rgba(15, 23, 42, 0.7)',
                      border: isTurnForThisTeam ? '2px dashed #facc15' : '1px dashed #64748b',
                      borderRadius: '6px',
                      padding: '0.35rem 0.5rem',
                      color: isTurnForThisTeam ? '#facc15' : '#64748b',
                      cursor: isTurnForThisTeam ? 'pointer' : 'not-allowed',
                      textAlign: 'center',
                      minWidth: '66px',
                      transition: 'all 0.2s ease',
                      boxShadow: isTurnForThisTeam ? '0 0 12px rgba(250, 204, 21, 0.35)' : 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (isTurnForThisTeam) {
                        e.currentTarget.style.transform = 'scale(1.08)'
                        e.currentTarget.style.borderStyle = 'solid'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (isTurnForThisTeam) {
                        e.currentTarget.style.transform = 'scale(1)'
                        e.currentTarget.style.borderStyle = 'dashed'
                      }
                    }}
                  >
                    <div style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase' }}>
                      {slot.label}
                    </div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 900 }}>
                      + SOBRE
                    </div>
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* 7 PUESTOS DE BANCO DE SUPLENTES (SIN RESERVAS) */}
        <div style={{ marginTop: '1.2rem', background: '#071226', border: '1px solid #1e293b', borderRadius: '8px', padding: '0.8rem 1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#38bdf8' }}>
                🪑 BANCO DE SUPLENTES (7 SOBRES)
              </span>
            </div>

            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              7 futbolistas para las 5 sustituciones oficiales en partido
            </div>
          </div>

          {/* Grilla dinámica de los 7 sobres de suplentes */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
              gap: '0.6rem'
            }}
          >
            {BENCH_SLOTS.map((bSlot) => {
              const sub = currentBench[bSlot.index]
              const isTurnForThisTeam = activeViewTeam === activeTurnTeam

              return (
                <div key={bSlot.index}>
                  {sub ? (
                    <div
                      style={{
                        background: 'linear-gradient(180deg, #091a36 0%, #030a17 100%)',
                        border: `1.5px solid ${sub.category === 'legend' ? '#f59e0b' : (sub.category === 'idol' ? '#a855f7' : (sub.category === 'squad' ? '#10b981' : '#94a3b8'))}`,
                        borderRadius: '6px',
                        padding: '0.35rem 0.5rem',
                        textAlign: 'center'
                      }}
                      title={bSlot.desc}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#facc15', fontFamily: 'Chakra Petch' }}>
                          {sub.rating}
                        </span>
                        <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8' }}>
                          {sub.position}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {sub.name.split(' ').slice(-1)[0]}
                      </div>
                      <div style={{ fontSize: '0.62rem', color: '#64748b' }}>
                        {bSlot.label}
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenSlotModal('bench', bSlot.index, bSlot.allowedRoles || bSlot.role, bSlot.label)}
                      disabled={!isTurnForThisTeam}
                      title={bSlot.desc}
                      style={{
                        width: '100%',
                        background: isTurnForThisTeam ? 'rgba(56, 189, 248, 0.15)' : 'rgba(15, 23, 42, 0.7)',
                        border: isTurnForThisTeam ? '1.5px dashed #38bdf8' : '1px dashed #64748b',
                        borderRadius: '6px',
                        padding: '0.5rem 0.3rem',
                        color: isTurnForThisTeam ? '#38bdf8' : '#64748b',
                        cursor: isTurnForThisTeam ? 'pointer' : 'not-allowed',
                        textAlign: 'center',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ fontSize: '0.65rem', fontWeight: 800 }}>{bSlot.label}</div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 900, marginTop: '2px' }}>+ SOBRE</div>
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* MODAL DE APERTURA DE SOBRE CON REROLL */}
      {packModal && (() => {
        const tierInfo = TIER_CONFIG_INFO[packModal.drawnTier] || TIER_CONFIG_INFO.squad

        return (
          <div className="modal-backdrop" onClick={() => setPackModal(null)}>
            <div
              className="modal-content"
              style={{
                maxWidth: '1050px',
                border: `3px solid ${tierInfo.border}`,
                boxShadow: `0 0 35px ${tierInfo.color}44`,
                padding: '1.5rem',
                background: 'linear-gradient(180deg, #071226 0%, #020712 100%)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.6rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <span
                      style={{
                        background: tierInfo.bg,
                        color: tierInfo.color,
                        fontSize: '0.82rem',
                        fontWeight: 900,
                        padding: '0.3rem 0.75rem',
                        borderRadius: '4px',
                        border: `1.5px solid ${tierInfo.border}`,
                        letterSpacing: '0.08em'
                      }}
                    >
                      {tierInfo.badge} ({tierInfo.range})
                    </span>
                    <h2 style={{ fontSize: '1.4rem', color: '#fff', margin: 0 }}>
                      SOBRE PARA: {packModal.label} ({Array.isArray(packModal.role) ? packModal.role.join('/') : packModal.role})
                    </h2>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: '#cbd5e1', margin: '0.35rem 0 0' }}>
                    Para: <strong>{currentTeamConfig.name}</strong> • Sorteaste categoría <strong>{tierInfo.name}</strong>. Compará los atributos y elegí tu carta.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  {/* Botón de Reroll */}
                  <button
                    type="button"
                    onClick={handleRerollPack}
                    disabled={currentRerolls <= 0}
                    style={{
                      background: currentRerolls > 0 ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : '#1e293b',
                      color: currentRerolls > 0 ? '#fff' : '#64748b',
                      border: currentRerolls > 0 ? '1.5px solid #38bdf8' : '1px solid #334155',
                      padding: '0.45rem 0.9rem',
                      borderRadius: '4px',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      cursor: currentRerolls > 0 ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      transition: 'all 0.15s ease'
                    }}
                    title={currentRerolls > 0 ? 'Vuelve a sortear la categoría y genera 5 cartas nuevas' : 'No te quedan más rerolls en este draft'}
                  >
                    <span>🎲</span>
                    <span>REROLL SOBRE ({currentRerolls} restantes)</span>
                  </button>

                  
                </div>
              </div>

              {/* Grid de 5 Cartas de la categoría sorteada */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '0.85rem' }}>
                {packModal.candidates.map((card) => {
                  const nick = getPlayerNickname(card.name)
                  const isGK = card.position === 'GK'

                  return (
                    <div
                      key={card.id}
                      onClick={() => handlePickCandidate(card)}
                      style={{
                        background: 'linear-gradient(180deg, #0b1a33 0%, #040914 100%)',
                        border: `2px solid ${tierInfo.border}`,
                        borderRadius: '8px',
                        padding: '0.9rem 0.7rem',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 6px 16px rgba(0,0,0,0.6)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-6px) scale(1.03)'
                        e.currentTarget.style.boxShadow = `0 12px 28px ${tierInfo.color}55`
                        e.currentTarget.style.borderColor = '#ffffff'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'none'
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.6)'
                        e.currentTarget.style.borderColor = tierInfo.border
                      }}
                    >
                      <div>
                        {/* Cabecera Carta */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                          <div>
                            <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#facc15', fontFamily: 'Chakra Petch', lineHeight: 1 }}>
                              {card.rating}
                            </div>
                            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#38bdf8' }}>
                              {card.position}
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: '0.62rem',
                              fontWeight: 800,
                              padding: '1px 5px',
                              borderRadius: '2px',
                              background: tierInfo.color,
                              color: '#000',
                              textTransform: 'uppercase'
                            }}
                          >
                            {card.category}
                          </span>
                        </div>

                        {/* Nombre y Apodo */}
                        <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#fff', lineHeight: 1.2, minHeight: '2.2rem' }}>
                          {card.name}
                        </div>
                        <div style={{ fontSize: '0.66rem', color: '#facc15', fontStyle: 'italic', marginBottom: '0.5rem', whiteSpace: 'normal', wordBreak: 'break-word', minHeight: '1.9rem', lineHeight: 1.25 }}>
                          {nick ? `"${nick}"` : card.specialty}
                        </div>

                        {/* Posiciones Secundarias */}
                        <div style={{ display: 'flex', gap: '0.2rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                          {(card.positions || [card.position]).map(pos => (
                            <span
                              key={pos}
                              style={{
                                fontSize: '0.62rem',
                                fontWeight: 700,
                                background: pos === packModal.role ? '#22c55e' : '#1e293b',
                                color: pos === packModal.role ? '#000' : '#cbd5e1',
                                padding: '1px 4px',
                                borderRadius: '2px'
                              }}
                            >
                              {pos}
                            </span>
                          ))}
                        </div>

                        {/* Atributos clave dentro del recuadro */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.2rem', fontSize: '0.64rem', background: '#020617', padding: '0.38rem 0.3rem', borderRadius: '4px', marginBottom: '0.6rem', border: '1px solid #1e293b' }}>
                          {isGK ? (
                            <>
                              <div>ATA: <strong>{card.skill?.saving}</strong></div>
                              <div>AGI: <strong>{card.skill?.agility}</strong></div>
                              <div>SAL: <strong>{card.skill?.jumping}</strong></div>
                              <div>PER: <strong>{card.skill?.perception}</strong></div>
                              <div>PAS: <strong>{card.skill?.passing}</strong></div>
                              <div>FUE: <strong>{card.skill?.strength}</strong></div>
                            </>
                          ) : (
                            <>
                              <div>PAS: <strong>{card.skill?.passing}</strong></div>
                              <div>TIR: <strong>{card.skill?.shooting}</strong></div>
                              <div>ENT: <strong>{card.skill?.tackling}</strong></div>
                              <div>AGI: <strong>{card.skill?.agility}</strong></div>
                              <div>FUE: <strong>{card.skill?.strength}</strong></div>
                              <div>CON: <strong>{card.skill?.control}</strong></div>
                            </>
                          )}
                          <div>TL: <strong>{card.skill?.freekick}</strong></div>
                          <div>PEN: <strong>{card.skill?.penalty_taking}</strong></div>
                          <div>ALT: <strong>{card.height}cm</strong></div>
                        </div>

                        {/* Rasgo distintivo */}
                        {Array.isArray(card.traits) && card.traits.length > 0 && (
                          <div style={{ fontSize: '0.64rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.2rem', marginBottom: '0.6rem' }}>
                            <span>{TRAIT_DEFINITIONS?.[card.traits[0]]?.icon || '⭐'}</span>
                            <span style={{ fontWeight: 700 }}>{TRAIT_DEFINITIONS?.[card.traits[0]]?.label || card.traits[0]}</span>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        className="btn btn-gold btn-sm"
                        style={{ width: '100%', fontSize: '0.78rem', fontWeight: 800, padding: '0.35rem 0' }}
                      >
                        Fichar Carta
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
