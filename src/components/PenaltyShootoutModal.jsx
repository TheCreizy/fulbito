import React, { useState, useMemo } from 'react'
import { simulateShootoutKick } from '../engine/engine.js'
import { generatePenaltyShootoutComment } from '../commentary/commentaryEngine.js'

function getOrderedKickers(team) {
  const active = team.players.filter(p => !p.sentOff)
  const preferredId = Number(team.setPieces?.penaltyTakerID)
  return [...active].sort((a, b) => {
    const aId = Number(a.id || a.playerID)
    const bId = Number(b.id || b.playerID)
    if (aId === preferredId) return -1
    if (bId === preferredId) return 1
    return (b.skill.penalty_taking || b.skill.shooting) - (a.skill.penalty_taking || a.skill.shooting)
  })
}

export default function PenaltyShootoutModal({
  team1,
  team2,
  onFinishShootout
}) {
  const kickers1 = useMemo(() => getOrderedKickers(team1), [team1])
  const kickers2 = useMemo(() => getOrderedKickers(team2), [team2])
  const gk1 = team1.players[0]
  const gk2 = team2.players[0]

  const [kicks1, setKicks1] = useState([]) // [{ kicker, outcome, comment }]
  const [kicks2, setKicks2] = useState([])
  const [turn, setTurn] = useState(1) // 1 = team1 patea, 2 = team2 patea
  const [winner, setWinner] = useState(null) // null | { team, score1, score2 }
  const [lastComment, setLastComment] = useState(
    '¡Señoras y señores, hay definición desde el punto del penal! Contame Macaya, ¿quién tiene más temple?'
  )

  const score1 = kicks1.filter(k => k.outcome === 'goal').length
  const score2 = kicks2.filter(k => k.outcome === 'goal').length

  const checkWinnerState = (nextK1, nextK2) => {
    const s1 = nextK1.filter(k => k.outcome === 'goal').length
    const s2 = nextK2.filter(k => k.outcome === 'goal').length
    const n1 = nextK1.length
    const n2 = nextK2.length

    // Tanda regular de 5 penales por lado
    if (n1 <= 5 && n2 <= 5) {
      const rem1 = 5 - n1
      const rem2 = 5 - n2
      if (s1 > s2 + rem2) return { team: team1, score1: s1, score2: s2 }
      if (s2 > s1 + rem1) return { team: team2, score1: s1, score2: s2 }
      return null
    }

    // Muerte súbita (uno y uno cuando ambos ejecutaron la misma cantidad >= 5)
    if (n1 === n2 && n1 >= 5 && s1 !== s2) {
      return {
        team: s1 > s2 ? team1 : team2,
        score1: s1,
        score2: s2
      }
    }
    return null
  }

  const executeSingleKick = (currK1, currK2, currTurn) => {
    if (currTurn === 1) {
      const kicker = kickers1[currK1.length % kickers1.length]
      const res = simulateShootoutKick(kicker, gk2)
      const comm = generatePenaltyShootoutComment(kicker, gk2, res.outcome, team1.name)
      const nextK1 = [...currK1, { kicker: kicker.name, outcome: res.outcome, comment: comm.text }]
      const win = checkWinnerState(nextK1, currK2)
      return { nextK1, nextK2: currK2, nextTurn: 2, commText: `${comm.speaker}: ${comm.text}`, win }
    } else {
      const kicker = kickers2[currK2.length % kickers2.length]
      const res = simulateShootoutKick(kicker, gk1)
      const comm = generatePenaltyShootoutComment(kicker, gk1, res.outcome, team2.name)
      const nextK2 = [...currK2, { kicker: kicker.name, outcome: res.outcome, comment: comm.text }]
      const win = checkWinnerState(currK1, nextK2)
      return { nextK1: currK1, nextK2, nextTurn: 1, commText: `${comm.speaker}: ${comm.text}`, win }
    }
  }

  const handleNextKick = () => {
    if (winner) return
    const step = executeSingleKick(kicks1, kicks2, turn)
    setKicks1(step.nextK1)
    setKicks2(step.nextK2)
    setTurn(step.nextTurn)
    setLastComment(step.commText)
    if (step.win) setWinner(step.win)
  }

  const handleSimulateAll = () => {
    let currK1 = [...kicks1]
    let currK2 = [...kicks2]
    let currTurn = turn
    let win = winner
    let commText = lastComment
    let safety = 0
    while (!win && safety < 40) {
      const step = executeSingleKick(currK1, currK2, currTurn)
      currK1 = step.nextK1
      currK2 = step.nextK2
      currTurn = step.nextTurn
      commText = step.commText
      win = step.win
      safety++
    }
    setKicks1(currK1)
    setKicks2(currK2)
    setTurn(currTurn)
    setLastComment(commText)
    if (win) setWinner(win)
  }

  const renderBadge = (outcome) => {
    if (outcome === 'goal') return '⚽ GOL'
    if (outcome === 'saved') return '🧤 ATAJADO'
    return '❌ AFUERA'
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: '760px' }}>
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <span className="brand-badge">DEFINICIÓN POR PENALES • DESEMPATE OFICIAL</span>
          <h2 style={{ fontSize: '1.75rem', color: '#fff', marginTop: '0.4rem' }}>
            {team1.name} &nbsp; <span style={{ color: '#facc15' }}>{score1} - {score2}</span> &nbsp; {team2.name}
          </h2>
        </div>

        {/* Relato de Araujo / Macaya */}
        <div
          style={{
            background: 'rgba(250, 204, 21, 0.14)',
            border: '1px solid #facc15',
            borderRadius: '8px',
            padding: '0.85rem 1rem',
            marginBottom: '1.1rem',
            fontSize: '0.95rem',
            fontWeight: 600,
            color: '#fef08a',
            textAlign: 'center'
          }}
        >
          🎙️ {lastComment}
        </div>

        {/* Tablero de ejecuciones */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.2rem' }}>
          <div className="panel" style={{ background: '#090d16' }}>
            <h3 style={{ color: '#facc15', fontSize: '0.95rem', marginBottom: '0.6rem' }}>
              {team1.name} ({score1})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {kicks1.map((k, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.82rem',
                    padding: '0.3rem 0.5rem',
                    borderRadius: '5px',
                    background: k.outcome === 'goal' ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)'
                  }}
                >
                  <span><b>#{idx + 1}</b> {k.kicker}</span>
                  <span style={{ fontWeight: 700 }}>{renderBadge(k.outcome)}</span>
                </div>
              ))}
              {kicks1.length === 0 && (
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Aún sin ejecuciones</span>
              )}
            </div>
          </div>

          <div className="panel" style={{ background: '#090d16' }}>
            <h3 style={{ color: '#38bdf8', fontSize: '0.95rem', marginBottom: '0.6rem' }}>
              {team2.name} ({score2})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {kicks2.map((k, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.82rem',
                    padding: '0.3rem 0.5rem',
                    borderRadius: '5px',
                    background: k.outcome === 'goal' ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)'
                  }}
                >
                  <span><b>#{idx + 1}</b> {k.kicker}</span>
                  <span style={{ fontWeight: 700 }}>{renderBadge(k.outcome)}</span>
                </div>
              ))}
              {kicks2.length === 0 && (
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Aún sin ejecuciones</span>
              )}
            </div>
          </div>
        </div>

        {/* Controles o Ganador */}
        {!winner ? (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-gold btn-lg" onClick={handleNextKick}>
              ⚽ Ejecutar Penal ({turn === 1 ? team1.name : team2.name})
            </button>
            <button type="button" className="btn btn-outline btn-lg" onClick={handleSimulateAll}>
              ⚡ Simular Toda la Serie
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#4ade80', marginBottom: '0.85rem' }}>
              🏆 ¡GANADOR POR PENALES: {winner.team.name.toUpperCase()} ({winner.score1} - {winner.score2})!
            </div>
            <button
              type="button"
              className="btn btn-gold btn-lg"
              onClick={() => onFinishShootout(winner)}
            >
              Finalizar y Ver Resumen del Partido
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
