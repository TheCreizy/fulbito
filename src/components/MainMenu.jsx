import React, { useState } from 'react'
import { PLAYERS_DB } from '../data/playersDB.js'
import PlayerCard from './PlayerCard.jsx'
import TeamJersey from './TeamJersey.jsx'
import { soundEngine } from '../audio/soundEngine.js'

const CLUB_PRESETS = [
  { name: 'Xeneize Leyendas', primary: '#1d4ed8', secondary: '#facc15' },
  { name: 'Millonario Ídolos', primary: '#ffffff', secondary: '#ef4444' },
  { name: 'Albiceleste 86/22', primary: '#38bdf8', secondary: '#ffffff' },
  { name: 'Ciclón de Boedo', primary: '#1e3a8a', secondary: '#ef4444' },
  { name: 'El Fortín 94', primary: '#ffffff', secondary: '#1d4ed8' },
  { name: 'Pincharreta 68', primary: '#b91c1c', secondary: '#ffffff' },
  { name: 'Rey de Copas', primary: '#dc2626', secondary: '#1e293b' },
  { name: 'La Academia FC', primary: '#0ea5e9', secondary: '#ffffff' }
]

const STAFF_MEMBERS = [
  {
    id: 0,
    role: 'Departamento Médico',
    title: 'Dr. Roberto Galíndez',
    subtitle: 'Jefe de Sanidad y Traumatología',
    avatar: '/assets/avatars/avatar_0.png',
    report: '¡Todo el plantel en óptimas condiciones! Los 200 jugadores de la base de datos están al 100% físico y sin molestias musculares antes del pitazo inicial.'
  },
  {
    id: 1,
    role: 'Secretaría Técnica & Scouting',
    title: 'Prof. Carlos Bilardo (h)',
    subtitle: 'Ojeador Jefe de Divisiones y Fichajes',
    avatar: '/assets/avatars/avatar_1.png',
    report: 'Completé el dossier de los 200 jugadores: 40 Leyendas, 50 Ídolos, 60 de Plantilla y 50 Especialistas de Relleno. Administrá con cautela los $250.0M.'
  },
  {
    id: 2,
    role: 'Gerencia y Finanzas',
    title: 'Dr. Héctor Cámpora',
    subtitle: 'Tesorero & Administrador Contable',
    avatar: '/assets/avatars/avatar_2.png',
    report: 'El presupuesto de $250.0M está debidamente avalado en tesorería. Cada sobre de Draft descontará el valor de mercado fijado por la AFA.'
  },
  {
    id: 3,
    role: 'Preparación Física',
    title: 'Prof. Gabriel Macaya',
    subtitle: 'Preparador Físico Principal',
    avatar: '/assets/avatars/avatar_3.png',
    report: 'Pretemporada finalizada con éxito en Tandil. En el partido el desgaste de cada jugador dependerá de su rol y de la mentalidad táctica que elijas.'
  },
  {
    id: 4,
    role: 'Presidencia de la Institución',
    title: 'Don Alberto J. Armando',
    subtitle: 'Presidente del Club',
    avatar: '/assets/avatars/avatar_4.png',
    report: 'La hinchada llena la cancha todos los domingos y la Comisión Directiva sólo acepta ser campeón. ¡Armá un equipo con personalidad y garra!'
  },
  {
    id: 5,
    role: 'Utilería & Mantenimiento',
    title: 'Don Tito (Canchero)',
    subtitle: 'Intendente del Estadio & Utilería',
    avatar: '/assets/avatars/avatar_5.png',
    report: 'El césped está cortado a 22 mm en damero perfecto y regado para darle pique rápido a la pelota en el Canvas 2D. Las camisetas ya tienen los dorsales cosidos.'
  },
  {
    id: 6,
    role: 'Asesoría Legal & AFA',
    title: 'Tribunal y Asuntos Legales',
    subtitle: 'Apoderados Legales del Club',
    avatar: '/assets/avatars/avatar_6.png',
    report: 'Contratos inscriptos en tiempo y forma en la calle Viamonte. Ningún futbolista arrastra sanciones del torneo anterior para esta fecha inaugural.'
  },
  {
    id: 7,
    role: 'Dirección Técnica',
    title: 'Estrategia & Táctica',
    subtitle: 'Cuerpo Técnico Oficial',
    avatar: '/assets/avatars/avatar_7.png',
    report: 'Recordá que en la Pizarra Táctica podés definir la formación (4-4-2, 4-3-3, 5-3-2), la mentalidad y los lanzadores de penales, tiros libres y córners.'
  }
]

export default function MainMenu({ onStartDraft, onStartFutDraft, onStartQuickMatch }) {
  const [gameMode, setGameMode] = useState('ai') // 'ai' | 'pvp'
  const [team1Config, setTeam1Config] = useState({
    name: 'Xeneize Leyendas',
    primaryColor: '#1d4ed8',
    secondaryColor: '#facc15'
  })
  const [team2Config, setTeam2Config] = useState({
    name: 'Millonario Ídolos',
    primaryColor: '#ffffff',
    secondaryColor: '#ef4444'
  })

  const [activeStaff, setActiveStaff] = useState(null)
  const [showCatalog, setShowCatalog] = useState(false)
  const [tierFilter, setTierFilter] = useState('all')
  const [posFilter, setPosFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const handleModeChange = (mode) => {
    soundEngine.playMenuClick('tab')
    setGameMode(mode)
  }

  const applyPreset = (teamNum, preset) => {
    soundEngine.playMenuClick('normal')
    const cfg = {
      name: preset.name,
      primaryColor: preset.primary,
      secondaryColor: preset.secondary
    }
    if (teamNum === 1) setTeam1Config(cfg)
    else setTeam2Config(cfg)
  }

  const handleStaffClick = (staff) => {
    soundEngine.playStaffSpeech()
    setActiveStaff(staff)
  }

  const handleStartQuick = () => {
    soundEngine.playMenuClick('confirm')
    onStartQuickMatch(gameMode, team1Config, team2Config)
  }

  const handleStartOfficialDraft = () => {
    soundEngine.playMenuClick('confirm')
    onStartDraft(gameMode, team1Config, team2Config)
  }

  const handleStartFutDraft = () => {
    soundEngine.playMenuClick('confirm')
    if (onStartFutDraft) {
      onStartFutDraft(gameMode, team1Config, team2Config)
    }
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
    <div className="pcf-screen-fullscreen">
      <div className="pcf-fullscreen-layout">
        
        {/* =========================================================
            COLUMNA LATERAL: 8 AVATARES 3D DEL STAFF (PC FÚTBOL 6.0 DOCK)
            (Sin contadores a la derecha, 100% interactivos con informes)
           ========================================================= */}
        <aside className="pcf-staff-dock" aria-label="Staff del Club">
          {STAFF_MEMBERS.map((staff) => (
            <button
              key={staff.id}
              type="button"
              className="pcf-staff-card"
              onClick={() => handleStaffClick(staff)}
              title={`Consultar: ${staff.role}`}
            >
              <img
                src={staff.avatar}
                alt={staff.role}
                className="pcf-staff-img"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
              <span className="pcf-staff-tag">{staff.role.split(' ')[0]}</span>
            </button>
          ))}
        </aside>

        {/* =========================================================
            ESPACIO DE TRABAJO PRINCIPAL (PANTALLA COMPLETA & RESPONSIVE)
           ========================================================= */}
        <main className="pcf-workspace-area">
            
            {/* Banner Superior de Bienvenida y Selección de Modo */}
            <section className="pcf-banner-top">
              <div className="pcf-ribbon-gold">
                TEMPORADA OFICIAL • EDICIÓN FÚTBOL DE PRIMERA & PC FÚTBOL
              </div>
              <h1 className="pcf-hero-title">
                SIMULADOR TÁCTICO 2D & DRAFT DE LEYENDAS ($250M)
              </h1>
              <p className="pcf-hero-desc">
                Armá tu plantel de 16 jugadores (11 titulares + 5 suplentes) administrando <b>$250.0M</b> en 16 rondas de sobres,
                ajustá tu pizarra táctica y viví el partido en cancha 2D con los relatos en vivo de <b>Marcelo Araujo</b> y <b>Enrique Macaya Márquez</b>.
              </p>

              {/* Botones de Selección de Modo */}
              <div className="pcf-mode-selector">
                <button
                  type="button"
                  className={`pcf-mode-btn ${gameMode === 'ai' ? 'active' : 'inactive'}`}
                  onClick={() => handleModeChange('ai')}
                >
                  <span>🤖</span>
                  <span>1 Jugador vs IA (DT Virtual)</span>
                </button>
                <button
                  type="button"
                  className={`pcf-mode-btn ${gameMode === 'pvp' ? 'active' : 'inactive'}`}
                  onClick={() => handleModeChange('pvp')}
                >
                  <span>⚔️</span>
                  <span>PvP Local (2 Jugadores • Pass & Play)</span>
                </button>
              </div>
            </section>

            {/* Configuración de Equipos: Equipo 1 y Equipo 2 */}
            <section className="pcf-teams-grid">
              
              {/* EQUIPO 1 (JUGADOR 1) */}
              <div className="pcf-team-card">
                <div className="pcf-team-header">
                  <div className="pcf-team-title" style={{ color: '#facc15' }}>
                    <span>👤</span>
                    <span>EQUIPO 1 (JUGADOR 1)</span>
                  </div>
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: team1Config.primaryColor,
                      border: `2px solid ${team1Config.secondaryColor}`,
                      boxShadow: '0 0 6px rgba(0,0,0,0.6)'
                    }}
                  />
                </div>

                <div className="pcf-team-body">
                  {/* Vista previa de Camiseta Vectorial */}
                  <div className="pcf-jersey-column">
                    <TeamJersey
                      primaryColor={team1Config.primaryColor}
                      secondaryColor={team1Config.secondaryColor}
                      teamName={team1Config.name}
                      size={82}
                    />
                    <div style={{ fontSize: '0.66rem', color: '#94a3b8', marginTop: '0.3rem', fontWeight: 700 }}>
                      TITULAR
                    </div>
                  </div>

                  <div className="pcf-team-inputs">
                    <label className="pcf-label">Nombre del Club</label>
                    <input
                      type="text"
                      className="pcf-text-input"
                      value={team1Config.name}
                      onChange={(e) => setTeam1Config({ ...team1Config, name: e.target.value })}
                    />

                    <div className="pcf-colors-row">
                      <div>
                        <label className="pcf-label">Color Titular</label>
                        <div className="pcf-color-box">
                          <input
                            type="color"
                            className="pcf-color-native-input"
                            value={team1Config.primaryColor}
                            onChange={(e) => setTeam1Config({ ...team1Config, primaryColor: e.target.value })}
                          />
                          <span style={{ fontSize: '0.74rem', fontFamily: 'monospace', color: '#fff' }}>
                            {team1Config.primaryColor.toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="pcf-label">Secundario / Dorsal</label>
                        <div className="pcf-color-box">
                          <input
                            type="color"
                            className="pcf-color-native-input"
                            value={team1Config.secondaryColor}
                            onChange={(e) => setTeam1Config({ ...team1Config, secondaryColor: e.target.value })}
                          />
                          <span style={{ fontSize: '0.74rem', fontFamily: 'monospace', color: '#fff' }}>
                            {team1Config.secondaryColor.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Presets Rápidos */}
                <div className="pcf-presets-container">
                  <div className="pcf-label" style={{ marginBottom: '0.35rem' }}>Presets Rápidos:</div>
                  <div className="pcf-preset-chips">
                    {CLUB_PRESETS.map((p) => (
                      <button
                        key={p.name}
                        type="button"
                        className="pcf-preset-chip"
                        onClick={() => applyPreset(1, p)}
                      >
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: p.primary,
                            border: `1.5px solid ${p.secondary}`
                          }}
                        />
                        <span>{p.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* EQUIPO 2 (RIVAL IA O JUGADOR 2) */}
              <div className="pcf-team-card">
                <div className="pcf-team-header">
                  <div className="pcf-team-title" style={{ color: '#38bdf8' }}>
                    <span>{gameMode === 'pvp' ? '👤' : '🤖'}</span>
                    <span>{gameMode === 'pvp' ? 'EQUIPO 2 (JUGADOR 2)' : 'EQUIPO 2 (RIVAL IA)'}</span>
                  </div>
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: team2Config.primaryColor,
                      border: `2px solid ${team2Config.secondaryColor}`,
                      boxShadow: '0 0 6px rgba(0,0,0,0.6)'
                    }}
                  />
                </div>

                <div className="pcf-team-body">
                  {/* Vista previa de Camiseta Vectorial */}
                  <div className="pcf-jersey-column">
                    <TeamJersey
                      primaryColor={team2Config.primaryColor}
                      secondaryColor={team2Config.secondaryColor}
                      teamName={team2Config.name}
                      size={82}
                    />
                    <div style={{ fontSize: '0.66rem', color: '#94a3b8', marginTop: '0.3rem', fontWeight: 700 }}>
                      {gameMode === 'pvp' ? 'VISITANTE' : 'RIVAL IA'}
                    </div>
                  </div>

                  <div className="pcf-team-inputs">
                    <label className="pcf-label">Nombre del Club</label>
                    <input
                      type="text"
                      className="pcf-text-input"
                      value={team2Config.name}
                      onChange={(e) => setTeam2Config({ ...team2Config, name: e.target.value })}
                    />

                    <div className="pcf-colors-row">
                      <div>
                        <label className="pcf-label">Color Titular</label>
                        <div className="pcf-color-box">
                          <input
                            type="color"
                            className="pcf-color-native-input"
                            value={team2Config.primaryColor}
                            onChange={(e) => setTeam2Config({ ...team2Config, primaryColor: e.target.value })}
                          />
                          <span style={{ fontSize: '0.74rem', fontFamily: 'monospace', color: '#fff' }}>
                            {team2Config.primaryColor.toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="pcf-label">Secundario / Dorsal</label>
                        <div className="pcf-color-box">
                          <input
                            type="color"
                            className="pcf-color-native-input"
                            value={team2Config.secondaryColor}
                            onChange={(e) => setTeam2Config({ ...team2Config, secondaryColor: e.target.value })}
                          />
                          <span style={{ fontSize: '0.74rem', fontFamily: 'monospace', color: '#fff' }}>
                            {team2Config.secondaryColor.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Presets Rápidos */}
                <div className="pcf-presets-container">
                  <div className="pcf-label" style={{ marginBottom: '0.35rem' }}>Presets Rápidos:</div>
                  <div className="pcf-preset-chips">
                    {CLUB_PRESETS.map((p) => (
                      <button
                        key={p.name}
                        type="button"
                        className="pcf-preset-chip"
                        onClick={() => applyPreset(2, p)}
                      >
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: p.primary,
                            border: `1.5px solid ${p.secondary}`
                          }}
                        />
                        <span>{p.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* =========================================================
                BARRA INFERIOR: HERRAMIENTAS Y ACCIONES
                (Botón SQL eliminado por petición del usuario)
               ========================================================= */}
            <div className="pcf-bottom-tools">
              <button
                type="button"
                className="pcf-btn-purple"
                onClick={() => {
                  soundEngine.playMenuClick('tab')
                  setShowCatalog(true)
                }}
              >
                <span>💾</span>
                <span>Ver Base de Datos (200 Jugadores RPG)</span>
              </button>

              {/* Ticker informativo vintage en lugar del botón SQL */}
              <div
                className="pcf-lcd-box"
                style={{
                  fontSize: '0.96rem',
                  letterSpacing: '0.08em',
                  padding: '0.35rem 0.85rem'
                }}
              >
                200 CRACKS EN MEMORIA • PRESUPUESTO OFICIAL $250.0M
              </div>
            </div>

            {/* Botones de Lanzamiento del Partido */}
            <div className="pcf-bottom-actions">
              <button
                type="button"
                className="pcf-btn-emerald-match"
                onClick={handleStartQuick}
              >
                <span style={{ fontSize: '1.45rem' }}>⚡</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '1.05rem', lineHeight: 1.1 }}>PARTIDO RÁPIDO</div>
                  <div style={{ fontSize: '0.70rem', opacity: 0.9, fontWeight: 600 }}>AUTO-DRAFT + PIZARRA</div>
                </div>
              </button>

              <button
                type="button"
                className="pcf-btn-fut-draft"
                onClick={handleStartFutDraft}
              >
                <span style={{ fontSize: '1.45rem' }}>✨</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '1.08rem', lineHeight: 1.1 }}>FUT DRAFT TÁCTICO</div>
                  <div style={{ fontSize: '0.70rem', color: '#e0f2fe', fontWeight: 700 }}>ESTILO FIFA • 11 CANCHA + 5 SUP</div>
                </div>
              </button>

              <button
                type="button"
                className="pcf-btn-gold-draft"
                onClick={handleStartOfficialDraft}
              >
                <span style={{ fontSize: '1.45rem' }}>🏆</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '1.08rem', lineHeight: 1.1 }}>DRAFT CLÁSICO</div>
                  <div style={{ fontSize: '0.70rem', color: '#451a03', fontWeight: 700 }}>$250M • 16 RONDAS DE SOBRES</div>
                </div>
              </button>
            </div>

          </main>
        </div>

      {/* =========================================================
          MODAL DE DIÁLOGO / INFORME DEL STAFF
         ========================================================= */}
      {activeStaff && (
        <div className="modal-backdrop" onClick={() => setActiveStaff(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: '580px', border: '3px solid #facc15' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
              <div
                style={{
                  background: '#040b1a',
                  border: '2px solid #5579ad',
                  padding: '0.35rem',
                  borderRadius: '3px'
                }}
              >
                <img
                  src={activeStaff.avatar}
                  alt={activeStaff.role}
                  style={{ width: 68, height: 90, objectFit: 'contain' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div className="brand-badge" style={{ fontSize: '0.72rem', marginBottom: '0.25rem' }}>
                  {activeStaff.role}
                </div>
                <h2 style={{ fontSize: '1.35rem', color: '#fff', marginBottom: '0.2rem' }}>
                  {activeStaff.title}
                </h2>
                <div style={{ fontSize: '0.82rem', color: '#facc15', fontWeight: 600 }}>
                  {activeStaff.subtitle}
                </div>
              </div>
            </div>

            <div
              style={{
                background: 'rgba(0,0,0,0.45)',
                borderLeft: '4px solid #facc15',
                padding: '0.85rem 1rem',
                fontSize: '0.94rem',
                color: '#e2e8f0',
                lineHeight: 1.5,
                marginBottom: '1.25rem'
              }}
            >
              "{activeStaff.report}"
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-gold btn-sm"
                onClick={() => setActiveStaff(null)}
              >
                ✓ Entendido, Gracias
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL DEL CATÁLOGO DE 200 JUGADORES
         ========================================================= */}
      {showCatalog && (
        <div className="modal-backdrop" onClick={() => setShowCatalog(false)}>
          <div className="modal-content" style={{ maxWidth: '1180px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ color: '#facc15' }}>BASE DE DATOS MAESTRA • 200 JUGADORES</h2>
                <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                  40 Leyendas ($35M-$45M) • 50 Ídolos ($16M-$26M) • 60 Plantilla ($6M-$14M) • 50 Relleno ($1.8M-$2.5M)
                </p>
              </div>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => {
                  soundEngine.playMenuClick('tab')
                  setShowCatalog(false)
                }}
              >
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
                <option value="all">Todas las Categorías ({PLAYERS_DB.length})</option>
                <option value="legend">★ Leyendas ({PLAYERS_DB.filter(p => p.category === 'legend').length})</option>
                <option value="idol">◆ Ídolos ({PLAYERS_DB.filter(p => p.category === 'idol').length})</option>
                <option value="squad">● Plantilla ({PLAYERS_DB.filter(p => p.category === 'squad').length})</option>
                <option value="filler">○ Relleno ({PLAYERS_DB.filter(p => p.category === 'filler').length})</option>
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
