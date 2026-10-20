import React, { useState } from 'react'
import { FORMATIONS, MENTALITIES, PLAY_STYLES, getPlayStyleConfig, getFormationCoordinates } from '../data/formations.js'
import { getPositionCompatibility, updateTeamEffectiveSkills } from '../engine/modifiers.js'
import { autoSetupTeamFromSquad } from '../draft/draftEngine.js'

export default function TacticsBoard({
  team,
  onUpdateTeam,
  isLiveMatch = false,
  onMakeLiveSubstitution,
  onConfirm,
  confirmLabel = 'Confirmar Pizarra e Ir a la Cancha ⚽',
  secondaryTeamTab = null // { activeTeamIndex, onSwitchTeam, team1Name, team2Name }
}) {
  // Selección para intercambiar jugadores (tipo: 'starter' | 'bench', index: number)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  const formation = FORMATIONS[team.formation] || FORMATIONS['4-4-2']
  const mentality = MENTALITIES[team.mentality] || MENTALITIES.balanced
  const playStyle = getPlayStyleConfig(team.playStyle, team.formation)
  const slots = getFormationCoordinates(team.formation, team.mentality, 'top')

  const recomputeCoordsAndSkills = (
    updatedTeam,
    newFormation = updatedTeam.formation,
    newMentality = updatedTeam.mentality,
    newPlayStyle = updatedTeam.playStyle
  ) => {
    const currentSide = (updatedTeam.players[0]?.originPOS?.[1] > 525) ? 'bottom' : 'top'
    const coords = getFormationCoordinates(newFormation, newMentality, currentSide)
    const clonedPlayers = updatedTeam.players.map((p, idx) => {
      const slot = coords[idx] || coords[coords.length - 1]
      const copy = { ...p, tacticalRole: slot.role }
      if (copy.currentPOS?.[0] !== 'NP') {
        copy.originPOS = slot.coords.slice()
        copy.intentPOS = slot.coords.slice()
        if (!isLiveMatch) copy.currentPOS = slot.coords.slice()
      }
      return copy
    })
    const nextTeam = {
      ...updatedTeam,
      formation: newFormation,
      mentality: newMentality,
      playStyle: newPlayStyle || FORMATIONS[newFormation]?.defaultPlayStyle || 'balanced',
      players: clonedPlayers
    }
    updateTeamEffectiveSkills(nextTeam)
    return nextTeam
  }

  const handleFormationChange = (newFormId) => {
    setErrorMsg('')
    const recommendedStyle = FORMATIONS[newFormId]?.defaultPlayStyle || team.playStyle || 'balanced'
    onUpdateTeam(recomputeCoordsAndSkills(team, newFormId, team.mentality, recommendedStyle))
  }

  const handleMentalityChange = (newMentId) => {
    setErrorMsg('')
    onUpdateTeam(recomputeCoordsAndSkills(team, team.formation, newMentId, team.playStyle))
  }

  const handlePlayStyleChange = (newStyleId) => {
    setErrorMsg('')
    onUpdateTeam(recomputeCoordsAndSkills(team, team.formation, team.mentality, newStyleId))
  }

  const handleSetPieceChange = (key, playerId) => {
    const nextTeam = {
      ...team,
      setPieces: {
        ...team.setPieces,
        [key]: Number(playerId)
      }
    }
    updateTeamEffectiveSkills(nextTeam)
    onUpdateTeam(nextTeam)
  }

  const handleAutoOptimize = () => {
    if (isLiveMatch) return
    const currentSide = (team.players[0]?.originPOS?.[1] > 525) ? 'bottom' : 'top'
    const all16 = [...team.players, ...(team.bench || [])]
    const optimized = autoSetupTeamFromSquad(all16, {
      teamName: team.name,
      primaryColor: team.primaryColor,
      secondaryColor: team.secondaryColor,
      formationId: team.formation,
      mentalityId: team.mentality,
      side: currentSide
    })
    onUpdateTeam(optimized)
    setSelectedSlot(null)
    setErrorMsg('')
  }

  const handleSlotClick = (type, index) => {
    setErrorMsg('')
    if (!selectedSlot) {
      setSelectedSlot({ type, index })
      return
    }
    if (selectedSlot.type === type && selectedSlot.index === index) {
      setSelectedSlot(null)
      return
    }

    // Caso 1: Intercambio entre dos titulares (cambio de puesto táctico en cancha)
    if (selectedSlot.type === 'starter' && type === 'starter') {
      const idxA = selectedSlot.index
      const idxB = index
      const pA = team.players[idxA]
      const pB = team.players[idxB]
      if (pA.sentOff || pB.sentOff) {
        setErrorMsg('No se puede mover de puesto a un jugador expulsado con tarjeta roja.')
        setSelectedSlot(null)
        return
      }
      const nextPlayers = [...team.players]
      nextPlayers[idxA] = { ...pB }
      nextPlayers[idxB] = { ...pA }
      // En partido en vivo, intercambiar también sus posiciones actuales en el campo
      if (isLiveMatch) {
        const tempPos = pA.currentPOS.slice()
        nextPlayers[idxA].currentPOS = tempPos
        nextPlayers[idxB].currentPOS = pB.currentPOS.slice()
      }
      const nextTeam = recomputeCoordsAndSkills({ ...team, players: nextPlayers })
      onUpdateTeam(nextTeam)
      setSelectedSlot(null)
      return
    }

    // Caso 2: Intercambio entre un titular y un suplente
    if (
      (selectedSlot.type === 'starter' && type === 'bench') ||
      (selectedSlot.type === 'bench' && type === 'starter')
    ) {
      const starterIdx = selectedSlot.type === 'starter' ? selectedSlot.index : index
      const benchIdx = selectedSlot.type === 'bench' ? selectedSlot.index : index

      if (isLiveMatch && onMakeLiveSubstitution) {
        try {
          onMakeLiveSubstitution(starterIdx, benchIdx)
          setSelectedSlot(null)
        } catch (err) {
          setErrorMsg(err.message || 'No se pudo realizar el cambio.')
          setSelectedSlot(null)
        }
        return
      }

      // En pre-partido: intercambio libre entre titular y banco
      const nextPlayers = [...team.players]
      const nextBench = [...(team.bench || [])]
      const starter = nextPlayers[starterIdx]
      const sub = nextBench[benchIdx]
      const subShirt = sub.shirtNumber
      nextPlayers[starterIdx] = { ...sub, shirtNumber: starter.shirtNumber }
      nextBench[benchIdx] = { ...starter, shirtNumber: subShirt }

      const nextTeam = recomputeCoordsAndSkills({
        ...team,
        players: nextPlayers,
        bench: nextBench
      })
      onUpdateTeam(nextTeam)
      setSelectedSlot(null)
      return
    }

    setSelectedSlot({ type, index })
  }

  const activeStarters = team.players.filter(p => !p.sentOff)

  return (
    <div className={isLiveMatch ? '' : 'main-container'}>
      {/* Pestañas PvP si ambos jugadores configuran su pizarra */}
      {secondaryTeamTab && (
        <div className="panel" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button
              type="button"
              className={`btn ${secondaryTeamTab.activeTeamIndex === 1 ? 'btn-gold' : 'btn-outline'}`}
              onClick={() => {
                setSelectedSlot(null)
                secondaryTeamTab.onSwitchTeam(1)
              }}
            >
              1️⃣ Pizarra de {secondaryTeamTab.team1Name}
            </button>
            <button
              type="button"
              className={`btn ${secondaryTeamTab.activeTeamIndex === 2 ? 'btn-gold' : 'btn-outline'}`}
              onClick={() => {
                setSelectedSlot(null)
                secondaryTeamTab.onSwitchTeam(2)
              }}
            >
              2️⃣ Pizarra de {secondaryTeamTab.team2Name}
            </button>
          </div>
          <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
            Configurá formación, mentalidad, pelota parada y titulares antes de salir a la cancha
          </span>
        </div>
      )}

      {/* Encabezado de Pizarra */}
      <div className="panel panel-gold" style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: team.primaryColor || '#1d4ed8',
              border: `3px solid ${team.secondaryColor || '#facc15'}`
            }}
          />
          <div>
            <h2 style={{ fontSize: '1.35rem', color: '#fff' }}>
              PIZARRA TÁCTICA • {team.name}
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
              {isLiveMatch
                ? `Cambios realizados: ${team.substitutionsUsed || 0} / ${team.maxSubstitutions || 5} • Hacé clic en un titular y luego en un suplente para hacer un cambio.`
                : 'Hacé clic en cualquier jugador titular y luego en otro titular o suplente para intercambiar su puesto.'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {!isLiveMatch && (
            <button type="button" className="btn btn-outline" onClick={handleAutoOptimize}>
              ✨ Auto-Ordenar Puestos Óptimos
            </button>
          )}
          {onConfirm && (
            <button type="button" className="btn btn-gold btn-lg" onClick={onConfirm}>
              {confirmLabel}
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid #ef4444',
            color: '#fca5a5',
            padding: '0.65rem 1rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            fontWeight: 600,
            fontSize: '0.86rem'
          }}
        >
          ⚠️ {errorMsg}
        </div>
      )}

      <div className="tactics-layout">
        {/* Columna Izquierda: Mini-Cancha Visual + Selectores Tácticos y Pelota Parada */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="panel">
            <h3 style={{ color: '#facc15', fontSize: '0.95rem', marginBottom: '0.6rem' }}>
              ESQUEMA TÁCTICO EN CANCHA ({formation.name})
            </h3>
            <div className="mini-pitch">
              {/* Líneas decorativas de cancha (ARQ abajo atacando hacia arriba) */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '10%',
                  width: '80%',
                  height: '2px',
                  background: 'rgba(255,255,255,0.55)'
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: -36,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  border: '1.5px solid rgba(255,255,255,0.45)'
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: '22%',
                  width: '56%',
                  height: '18%',
                  border: '1.5px solid rgba(255,255,255,0.55)',
                  borderBottom: 'none'
                }}
              />

              {team.players.map((player, idx) => {
                const slot = slots[idx] || slots[0]
                // Orientación estándar PC Fútbol: Arquero abajo (90%), Delanteros arriba (12%), LI a la izquierda y LD a la derecha
                const leftPct = Math.max(8, Math.min(92, (slot.coords[0] / 680) * 100))
                const topPct = Math.max(10, Math.min(91, 96 - (slot.coords[1] / 540) * 86))
                const compat = getPositionCompatibility(player, slot.role)
                const isSelected = selectedSlot?.type === 'starter' && selectedSlot?.index === idx
                const isCaptain = Number(team.setPieces?.captainID) === Number(player.id || player.playerID)

                return (
                  <div
                    key={player.id || player.playerID}
                    className="mini-pitch-node"
                    style={{ left: `${leftPct}%`, top: `${topPct}%`, opacity: player.sentOff ? 0.35 : 1 }}
                    onClick={() => handleSlotClick('starter', idx)}
                  >
                    <div
                      className="node-circle"
                      style={{
                        background: team.primaryColor || '#1d4ed8',
                        color: team.secondaryColor || '#facc15',
                        borderColor: isSelected ? '#facc15' : (compat.factor < 0.8 ? '#ef4444' : '#ffffff'),
                        boxShadow: isSelected ? '0 0 14px #facc15' : undefined
                      }}
                    >
                      {player.shirtNumber || idx + 1}
                      {isCaptain && (
                        <span
                          style={{
                            position: 'absolute',
                            top: -5,
                            right: -6,
                            background: '#facc15',
                            color: '#000',
                            fontSize: '0.55rem',
                            fontWeight: 900,
                            padding: '0 3px',
                            borderRadius: '2px'
                          }}
                        >
                          C
                        </span>
                      )}
                    </div>
                    <div className="node-name-tag">
                      {slot.label}: {player.name.split(' ').slice(-1)[0]}
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ fontSize: '0.73rem', color: '#93c5fd', marginTop: '0.5rem', textAlign: 'center', fontWeight: 700 }}>
              ⬆️ Ataque de abajo (ARQ) hacia arriba (DEL) • LI a la izquierda | LD a la derecha
            </div>
          </div>

          {/* Selectores de Formación, Mentalidad y Pelota Parada */}
          <div className="panel">
            <h3 style={{ color: '#facc15', fontSize: '0.95rem', marginBottom: '0.7rem' }}>
              ⚙️ FORMACIÓN, MENTALIDAD Y PELOTA PARADA
            </h3>

            <div style={{ marginBottom: '0.7rem' }}>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>
                Formación Táctica
              </label>
              <select
                className="select-input"
                value={team.formation}
                onChange={(e) => handleFormationChange(e.target.value)}
              >
                {Object.values(FORMATIONS).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
                {formation.description}
              </div>
            </div>

            <div style={{ marginBottom: '0.7rem' }}>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>
                Mentalidad del Equipo
              </label>
              <select
                className="select-input"
                value={team.mentality}
                onChange={(e) => handleMentalityChange(e.target.value)}
              >
                {Object.values(MENTALITIES).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
                {mentality.description}
              </div>
            </div>

            <div style={{ marginBottom: '0.85rem' }}>
              <label style={{ fontSize: '0.75rem', color: '#facc15', fontWeight: 700, display: 'block', marginBottom: '0.2rem' }}>
                ⚡ Estilo de Juego (Comportamiento IA en Cancha)
              </label>
              <select
                className="select-input"
                value={playStyle.id}
                onChange={(e) => handlePlayStyleChange(e.target.value)}
              >
                {Object.values(PLAY_STYLES).map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: '0.72rem', color: '#93c5fd', marginTop: '0.2rem' }}>
                {playStyle.description}
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid rgba(148,163,184,0.2)', margin: '0.75rem 0' }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: '#facc15', fontWeight: 700, display: 'block', marginBottom: '0.2rem' }}>
                  ©️ Capitán (+PER / -15% fatiga)
                </label>
                <select
                  className="select-input"
                  value={team.setPieces?.captainID || ''}
                  onChange={(e) => handleSetPieceChange('captainID', e.target.value)}
                >
                  {activeStarters.map((p) => (
                    <option key={p.id || p.playerID} value={p.id || p.playerID}>
                      {p.name} (PER {p.baseSkill?.perception || p.skill.perception})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700, display: 'block', marginBottom: '0.2rem' }}>
                  🎯 Pateador de Penales
                </label>
                <select
                  className="select-input"
                  value={team.setPieces?.penaltyTakerID || ''}
                  onChange={(e) => handleSetPieceChange('penaltyTakerID', e.target.value)}
                >
                  {activeStarters.map((p) => (
                    <option key={p.id || p.playerID} value={p.id || p.playerID}>
                      {p.name} (PEN {p.baseSkill?.penalty_taking || p.skill.penalty_taking})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: '#4ade80', fontWeight: 700, display: 'block', marginBottom: '0.2rem' }}>
                  🚀 Tiros Libres Directos
                </label>
                <select
                  className="select-input"
                  value={team.setPieces?.freekickTakerID || ''}
                  onChange={(e) => handleSetPieceChange('freekickTakerID', e.target.value)}
                >
                  {activeStarters.map((p) => (
                    <option key={p.id || p.playerID} value={p.id || p.playerID}>
                      {p.name} (TL {p.baseSkill?.freekick || p.skill.freekick})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: '#c084fc', fontWeight: 700, display: 'block', marginBottom: '0.2rem' }}>
                  🚩 Ejecutor de Córners
                </label>
                <select
                  className="select-input"
                  value={team.setPieces?.cornerTakerID || ''}
                  onChange={(e) => handleSetPieceChange('cornerTakerID', e.target.value)}
                >
                  {activeStarters.map((p) => (
                    <option key={p.id || p.playerID} value={p.id || p.playerID}>
                      {p.name} (PAS {p.baseSkill?.passing || p.skill.passing})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Lista Interactiva de 11 Titulares y 5 Suplentes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* 11 Titulares */}
          <div className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.7rem' }}>
              <h3 style={{ color: '#facc15', fontSize: '1rem' }}>
                🟢 11 TITULARES EN CANCHA
              </h3>
              <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
                Los puestos fuera de posición reducen los atributos efectivos del jugador
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {team.players.map((player, idx) => {
                const slot = slots[idx] || slots[0]
                const compat = getPositionCompatibility(player, slot.role)
                const isSelected = selectedSlot?.type === 'starter' && selectedSlot?.index === idx
                const effectiveRating = Math.round(player.rating * compat.factor * ((player.fitness ?? 100) < 75 ? 0.94 : 1))
                const isCaptain = Number(team.setPieces?.captainID) === Number(player.id || player.playerID)
                const allNaturalPos = Array.isArray(player.positions) && player.positions.length > 0
                  ? player.positions.join(' / ')
                  : player.position

                return (
                  <div
                    key={player.id || player.playerID}
                    onClick={() => handleSlotClick('starter', idx)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '84px 1fr auto auto',
                      alignItems: 'center',
                      gap: '0.65rem',
                      padding: '0.48rem 0.7rem',
                      borderRadius: '2px',
                      background: isSelected ? 'rgba(250, 204, 21, 0.22)' : (idx % 2 === 0 ? '#0a1936' : '#0d2147'),
                      border: isSelected ? '2px solid #facc15' : '1px solid #284678',
                      cursor: 'pointer'
                    }}
                  >
                    <div>
                      <span
                        style={{
                          background: '#02060d',
                          color: '#facc15',
                          fontWeight: 800,
                          fontSize: '0.72rem',
                          padding: '0.18rem 0.42rem',
                          borderRadius: '2px',
                          border: '1px solid #47669c',
                          display: 'inline-block'
                        }}
                      >
                        {slot.label} ({slot.role})
                      </span>
                    </div>

                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>{player.name}</span>
                        {isCaptain && (
                          <span style={{ background: '#facc15', color: '#000', fontSize: '0.64rem', fontWeight: 900, padding: '1px 5px', borderRadius: '2px' }}>
                            CAPITÁN
                          </span>
                        )}
                        {player.stats?.cards?.yellow > 0 && <span title="Tarjeta Amarilla">🟨</span>}
                        {player.sentOff && <span title="Expulsado (Roja)">🟥 EXPULSADO</span>}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        Puestos: <b style={{ color: '#fde047' }}>{allNaturalPos}</b> • {player.specialty} • TL {player.skill.freekick} / PEN {player.skill.penalty_taking}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span className={`compat-badge compat-${compat.status}`}>
                        {Math.round(compat.factor * 100)}% • {compat.label}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: '105px', justifyContent: 'flex-end' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'VT323, monospace', fontWeight: 700, fontSize: '1.25rem', lineHeight: 1, color: compat.factor < 0.8 ? '#f87171' : '#00ff66' }}>
                          OVR {effectiveRating}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                          Físico: {Math.round(player.fitness ?? 100)}%
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 5 Suplentes en el Banco */}
          <div className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
              <h3 style={{ color: '#38bdf8', fontSize: '1rem' }}>
                🪑 BANCO DE SUPLENTES (5 JUGADORES)
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                {isLiveMatch
                  ? `Cambios restantes: ${(team.maxSubstitutions || 5) - (team.substitutionsUsed || 0)}`
                  : 'Seleccioná un suplente y un titular para rotar el once inicial'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {(team.bench || []).map((sub, bIdx) => {
                const isSelected = selectedSlot?.type === 'bench' && selectedSlot?.index === bIdx
                const compatWithSelected = selectedSlot?.type === 'starter'
                  ? getPositionCompatibility(sub, slots[selectedSlot.index]?.role || sub.position)
                  : null
                const subPositions = Array.isArray(sub.positions) && sub.positions.length > 0
                  ? sub.positions.join(' / ')
                  : sub.position

                return (
                  <div
                    key={sub.id || sub.playerID}
                    onClick={() => handleSlotClick('bench', bIdx)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '84px 1fr auto auto',
                      alignItems: 'center',
                      gap: '0.65rem',
                      padding: '0.48rem 0.7rem',
                      borderRadius: '2px',
                      background: isSelected ? 'rgba(56, 189, 248, 0.22)' : '#071226',
                      border: isSelected ? '2px solid #38bdf8' : '1px solid #284678',
                      cursor: 'pointer'
                    }}
                  >
                    <div>
                      <span
                        style={{
                          background: '#02060d',
                          color: '#38bdf8',
                          fontWeight: 800,
                          fontSize: '0.72rem',
                          padding: '0.18rem 0.42rem',
                          borderRadius: '2px',
                          border: '1px solid #1e3a8a',
                          display: 'inline-block'
                        }}
                      >
                        {subPositions}
                      </span>
                    </div>

                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{sub.name}</div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        {sub.specialty} • PAS {sub.skill.passing} • TIR {sub.skill.shooting} • ENT {sub.skill.tackling}
                      </div>
                    </div>

                    <div>
                      {compatWithSelected && (
                        <span className={`compat-badge compat-${compatWithSelected.status}`}>
                          En ese puesto: {Math.round(compatWithSelected.factor * 100)}%
                        </span>
                      )}
                    </div>

                    <div style={{ textAlign: 'right', minWidth: '85px' }}>
                      <div style={{ fontFamily: 'Chakra Petch', fontWeight: 800, fontSize: '0.92rem', color: '#fff' }}>
                        OVR {sub.rating}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#4ade80' }}>
                        Físico: {Math.round(sub.fitness ?? 100)}%
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
