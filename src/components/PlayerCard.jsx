import React, { useState } from 'react'
import { POSITION_LABELS_ES } from '../data/playersDB.js'
import { getPlayerNickname } from '../commentary/commentaryEngine.js'

const TIER_CONFIG = {
  legend: { label: '★ Leyenda', className: 'tier-legend' },
  idol: { label: '◆ Ídolo', className: 'tier-idol' },
  squad: { label: '● Plantilla', className: 'tier-squad' },
  filler: { label: '○ Relleno', className: 'tier-filler' }
}

export default function PlayerCard({
  player,
  onSelect,
  disabled = false,
  disabledReason = '',
  compact = false,
  actionLabel = 'Fichar Carta'
}) {
  const [showAllStats, setShowAllStats] = useState(false)
  const tier = TIER_CONFIG[player.category] || TIER_CONFIG.squad
  const nickname = getPlayerNickname(player.name)
  const s = player.skill || {}
  const isGK = player.position === 'GK'

  const cardStats = isGK
    ? [
        { k: 'ATA', v: s.saving },
        { k: 'AGI', v: s.agility },
        { k: 'SAL', v: s.jumping },
        { k: 'PER', v: s.perception },
        { k: 'PAS', v: s.passing },
        { k: 'FUE', v: s.strength },
        { k: 'TL', v: s.freekick },
        { k: 'PEN', v: s.penalty_taking },
        { k: 'ALT', v: `${player.height}cm`, isAlt: true }
      ]
    : [
        { k: 'PAS', v: s.passing },
        { k: 'TIR', v: s.shooting },
        { k: 'ENT', v: s.tackling },
        { k: 'AGI', v: s.agility },
        { k: 'FUE', v: s.strength },
        { k: 'CON', v: s.control },
        { k: 'TL', v: s.freekick },
        { k: 'PEN', v: s.penalty_taking },
        { k: 'ALT', v: `${player.height}cm`, isAlt: true }
      ]

  const allStats = [
    { k: 'Pase (PAS)', v: s.passing },
    { k: 'Tiro (TIR)', v: s.shooting },
    { k: 'Entrada (ENT)', v: s.tackling },
    { k: 'Atajada (ATA)', v: s.saving },
    { k: 'Agilidad (AGI)', v: s.agility },
    { k: 'Fuerza (FUE)', v: s.strength },
    { k: 'Resistencia (RES)', v: s.stamina ?? s.resistencia },
    { k: 'Cabeza (CAB)', v: s.heading ?? s.cabeza },
    { k: 'Salto (SAL)', v: s.jumping },
    { k: 'Percepción (PER)', v: s.perception },
    { k: 'Control (CON)', v: s.control },
    { k: 'Penales (PEN)', v: s.penalty_taking },
    { k: 'Tiro Libre (TL)', v: s.freekick }
  ]

  const getStatClass = (val) => {
    if (val >= 90) return 'card-stat-val stat-elite'
    if (val >= 80) return 'card-stat-val stat-good'
    return 'card-stat-val'
  }

  return (
    <div
      className={`player-card ${tier.className} ${onSelect ? 'clickable' : ''} ${disabled ? 'card-disabled' : ''}`}
      onClick={() => {
        if (!disabled && onSelect) onSelect(player)
      }}
    >
      <div>
        <div className="card-top-row">
          <div className="card-rating-box">
            <span className="card-ovr">{player.rating}</span>
            <span className="card-pos" title={POSITION_LABELS_ES[player.position]}>
              {player.position}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
            <span className="card-price-tag">${player.price.toFixed(1)}M</span>
            <span className="card-tier-label">{tier.label}</span>
          </div>
        </div>

        <div className="card-name">{player.name}</div>
        <div className="card-nickname">
          {nickname ? `"${nickname}"` : `${POSITION_LABELS_ES[player.position]} • ${player.height} cm`}
        </div>

        <div className="card-multi-positions">
          {(Array.isArray(player.positions) && player.positions.length > 0 ? player.positions : [player.position]).map((pos, idx) => (
            <span
              key={pos}
              className={`pos-pill ${idx > 0 ? 'secondary' : ''}`}
              title={POSITION_LABELS_ES[pos] || pos}
            >
              {pos}
            </span>
          ))}
        </div>

        {player.specialty && (
          <div className="card-specialty">
            <span>{player.specialty}</span>
          </div>
        )}

        {!compact && (
          <>
            <div className="card-stats-grid">
              {cardStats.map((st) => (
                <div key={st.k} className="card-stat-item">
                  <span className="card-stat-label">{st.k}</span>
                  <span className={st.isAlt ? 'card-stat-val' : getStatClass(st.v)} style={st.isAlt ? { fontSize: '0.64rem', color: '#f1f5f9' } : undefined}>
                    {st.v}
                  </span>
                </div>
              ))}
            </div>

            {showAllStats && (
              <div
                style={{
                  background: 'rgba(0,0,0,0.68)',
                  padding: '0.45rem',
                  borderRadius: '6px',
                  marginBottom: '0.45rem',
                  fontSize: '0.67rem'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {allStats.map((item) => (
                  <div key={item.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
                    <span style={{ color: '#94a3b8' }}>{item.k}</span>
                    <span className={getStatClass(item.v)}>{item.v}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {!compact && (
        <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.2rem' }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            style={{ padding: '0.28rem 0.45rem', fontSize: '0.66rem' }}
            onClick={(e) => {
              e.stopPropagation()
              setShowAllStats(!showAllStats)
            }}
          >
            {showAllStats ? 'Ocultar' : '11 Stats'}
          </button>
          {onSelect && (
            <button
              type="button"
              className={`btn btn-sm ${disabled ? 'btn-outline' : 'btn-gold'}`}
              style={{ flex: 1, padding: '0.28rem 0.4rem', fontSize: '0.72rem' }}
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation()
                if (!disabled) onSelect(player)
              }}
            >
              {disabled ? (disabledReason || 'Sin Saldo') : actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
