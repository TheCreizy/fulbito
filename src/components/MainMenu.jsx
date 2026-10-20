import React, { useState } from 'react'
import { PLAYERS_DB } from '../data/playersDB.js'
import { downloadPlayersSQLFile } from '../data/exportSQL.js'
import PlayerCard from './PlayerCard.jsx'

const CLUB_PRESETS = [
  { name: 'Xeneize Leyendas', primary: '#1d4ed8', secondary: '#facc15' },
  { name: 'Millonario Ídolos', primary: '#ef4444', secondary: '#ffffff' },
  { name: 'Albiceleste 86/22', primary: '#38bdf8', secondary: '#ffffff' },
  { name: 'Rey de Copas', primary: '#dc2626', secondary: '#1e293b' },
  { name: 'La Academia FC', primary: '#0ea5e9', secondary: '#f8fafc' },
  { name: 'Ciclón de Boedo', primary: '#1e3a8a', secondary: '#ef4444' },
  { name: 'El Fortín 94', primary: '#f8fafc', secondary: '#1d4ed8' },
  { name: 'Pincharrata 68', primary: '#b91c1c', secondary: '#f8fafc' }
]

export default function MainMenu({ onStartDraft, onStartQuickMatch }) {
  const [gameMode, setGameMode] = useState('ai') // 'ai' | 'pvp'
  const [team1Config, setTeam1Config] = useState({
    name: 'Xeneize Leyendas',
    primaryColor: '#1d4ed8',
    secondaryColor: '#facc15'
  })
  const [team2Config, setTeam2Config] = useState({
    name: 'Millonario Ídolos',
    primaryColor: '#ef4444',
    secondaryColor: '#ffffff'
  })

  const [showCatalog, setShowCatalog] = useState(false)
  const [tierFilter, setTierFilter] = useState('all')
  const [posFilter, setPosFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const applyPreset = (teamNum, preset) => {
    const cfg = {
      name: preset.name,
      primaryColor: preset.primary,
      secondaryColor: preset.secondary
    }
    if (teamNum === 1) setTeam1Config(cfg)
    else setTeam2Config(cfg)
  }

  const filteredCatalog = PLAYERS_DB.filter((p) => {
    if (tierFilter !== 'all' && p.category !== tierFilter) return false
    if (posFilter !== 'all') {
      const allPos = Array.isArray(p.positions) ? p.positions : [p.position]
      if (!allPos.includes(posFilter)) return false
    }
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase()
      return p.name.toLowerCase().includes(q) || (p.specialty || '').toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div className="main-container">
      {/* Banner Principal estilo Fútbol de Primera */}
      <div className="panel panel-gold" style={{ marginBottom: '1.35rem', textAlign: 'center', padding: '1.6rem 1.2rem' }}>
        <div style={{ display: 'inline-block', marginBottom: '0.5rem' }} className="brand-badge">
          TEMPORADA OFICIAL • EDICIÓN FÚTBOL DE PRIMERA & PC FÚTBOL
        </div>
        <h1 style={{ fontSize: '2.1rem', color: '#fff', marginBottom: '0.4rem' }}>
          SIMULADOR TÁCTICO 2D & DRAFT DE LEYENDAS ($250M)
        </h1>
        <p style={{ color: '#cbd5e1', maxWidth: '820px', margin: '0 auto 1.25rem', fontSize: '0.95rem' }}>
          Armá tu plantel de 16 jugadores (11 titulares + 5 suplentes) administrando <b>$250.0M</b> en 16 rondas de sobres,
          ajustá tu pizarra táctica y viví el partido en cancha 2D con los relatos en vivo de <b>Marcelo Araujo</b> y <b>Enrique Macaya Márquez</b>.
        </p>

        {/* Selector de Modo de Juego */}
        <div style={{ display: 'inline-flex', gap: '0.75rem', background: '#090d16', padding: '0.4rem', borderRadius: '8px', border: '1px solid rgba(250,204,21,0.35)' }}>
          <button
            type="button"
            className={`btn ${gameMode === 'ai' ? 'btn-gold' : 'btn-outline'}`}
            onClick={() => setGameMode('ai')}
          >
            🤖 1 Jugador vs IA (DT Virtual)
          </button>
          <button
            type="button"
            className={`btn ${gameMode === 'pvp' ? 'btn-gold' : 'btn-outline'}`}
            onClick={() => setGameMode('pvp')}
          >
            ⚔️ PvP Local (2 Jugadores • Pass & Play)
          </button>
        </div>
      </div>

      {/* Configuración de Ambos Equipos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '1.35rem' }}>
        {/* Equipo 1 */}
        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <h2 style={{ fontSize: '1.15rem', color: '#facc15' }}>
              👤 EQUIPO 1 (JUGADOR 1)
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: team1Config.primaryColor,
                  border: `3px solid ${team1Config.secondaryColor}`,
                  display: 'inline-block'
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>
              Nombre del Club
            </label>
            <input
              type="text"
              className="text-input"
              value={team1Config.name}
              onChange={(e) => setTeam1Config({ ...team1Config, name: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>
                Color Titular
              </label>
              <input
                type="color"
                value={team1Config.primaryColor}
                onChange={(e) => setTeam1Config({ ...team1Config, primaryColor: e.target.value })}
                style={{ width: '100%', height: '36px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>
                Color Secundario / Dorsal
              </label>
              <input
                type="color"
                value={team1Config.secondaryColor}
                onChange={(e) => setTeam1Config({ ...team1Config, secondaryColor: e.target.value })}
                style={{ width: '100%', height: '36px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }}
              />
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.35rem' }}>Presets Rápidos:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {CLUB_PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '0.68rem', padding: '0.22rem 0.5rem' }}
                  onClick={() => applyPreset(1, p)}
                >
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: p.primary, border: `1px solid ${p.secondary}` }} />
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Equipo 2 */}
        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <h2 style={{ fontSize: '1.15rem', color: '#38bdf8' }}>
              {gameMode === 'pvp' ? '👤 EQUIPO 2 (JUGADOR 2)' : '🤖 EQUIPO 2 (RIVAL IA)'}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: team2Config.primaryColor,
                  border: `3px solid ${team2Config.secondaryColor}`,
                  display: 'inline-block'
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>
              Nombre del Club
            </label>
            <input
              type="text"
              className="text-input"
              value={team2Config.name}
              onChange={(e) => setTeam2Config({ ...team2Config, name: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>
                Color Titular
              </label>
              <input
                type="color"
                value={team2Config.primaryColor}
                onChange={(e) => setTeam2Config({ ...team2Config, primaryColor: e.target.value })}
                style={{ width: '100%', height: '36px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>
                Color Secundario / Dorsal
              </label>
              <input
                type="color"
                value={team2Config.secondaryColor}
                onChange={(e) => setTeam2Config({ ...team2Config, secondaryColor: e.target.value })}
                style={{ width: '100%', height: '36px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }}
              />
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.35rem' }}>Presets Rápidos:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {CLUB_PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '0.68rem', padding: '0.22rem 0.5rem' }}
                  onClick={() => applyPreset(2, p)}
                >
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: p.primary, border: `1px solid ${p.secondary}` }} />
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Botonera de Inicio y Herramientas */}
      <div className="panel" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setShowCatalog(true)}
          >
            📖 Ver Base de Datos (100 Jugadores RPG)
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={downloadPlayersSQLFile}
          >
            💾 Descargar SQL para Hostinger (MySQL)
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem' }}>
          <button
            type="button"
            className="btn btn-emerald btn-lg"
            onClick={() => onStartQuickMatch(gameMode, team1Config, team2Config)}
          >
            ⚡ Partido Rápido (Auto-Draft + Pizarra)
          </button>
          <button
            type="button"
            className="btn btn-gold btn-lg"
            onClick={() => onStartDraft(gameMode, team1Config, team2Config)}
          >
            🏆 Iniciar Draft Oficial ($250M • 16 Rondas)
          </button>
        </div>
      </div>

      {/* Modal del Catálogo de 100 Jugadores */}
      {showCatalog && (
        <div className="modal-backdrop" onClick={() => setShowCatalog(false)}>
          <div className="modal-content" style={{ maxWidth: '1180px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ color: '#facc15' }}>BASE DE DATOS MAESTRA • 100 JUGADORES</h2>
                <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                  20 Leyendas ($35M-$52M) • 25 Ídolos ($18M-$32M) • 30 Plantilla ($7M-$16M) • 25 Relleno ($2.5M-$6M)
                </p>
              </div>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => setShowCatalog(false)}>
                ✕ Cerrar
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', marginBottom: '1rem' }}>
              <input
                type="text"
                className="text-input"
                placeholder="Buscar jugador o especialidad (ej: Maradona, Palermo, Francotirador)..."
                style={{ maxWidth: '340px' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <select className="select-input" style={{ width: 'auto' }} value={tierFilter} onChange={(e) => setTierFilter(e.target.value)}>
                <option value="all">Todas las Categorías (100)</option>
                <option value="legend">★ Leyendas (20)</option>
                <option value="idol">◆ Ídolos (25)</option>
                <option value="squad">● Plantilla (30)</option>
                <option value="filler">○ Relleno (25)</option>
              </select>
              <select className="select-input" style={{ width: 'auto' }} value={posFilter} onChange={(e) => setPosFilter(e.target.value)}>
                <option value="all">Todas las Posiciones</option>
                <option value="GK">GK - Arqueros</option>
                <option value="CB">CB - Defensores Centrales</option>
                <option value="LB">LB - Laterales Izquierdos</option>
                <option value="RB">RB - Laterales Derechos</option>
                <option value="CM">CM - Mediocampistas Centrales</option>
                <option value="CAM">CAM - Enganches / Mediapuntas (10)</option>
                <option value="LM">LM - Volantes/Extremos Izq.</option>
                <option value="RM">RM - Volantes/Extremos Der.</option>
                <option value="ST">ST - Delanteros</option>
              </select>
            </div>

            <div className="pack-grid-7" style={{ maxHeight: '62vh', overflowY: 'auto', paddingRight: '0.35rem' }}>
              {filteredCatalog.map((player) => (
                <PlayerCard key={player.id} player={player} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
