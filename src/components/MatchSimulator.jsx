import React, { useState, useEffect, useRef, useCallback } from 'react'
import { PITCH_CONFIG } from '../data/formations.js'
import {
  initiateGame,
  playIteration,
  startSecondHalf,
  startExtraTimeHalf,
  applyLiveTactics,
  makeSubstitution
} from '../engine/engine.js'
import { getPositionCompatibility } from '../engine/modifiers.js'
import { generateCommentaryForIteration } from '../commentary/commentaryEngine.js'
import { soundEngine } from '../audio/soundEngine.js'
import TacticsBoard from './TacticsBoard.jsx'
import PenaltyShootoutModal from './PenaltyShootoutModal.jsx'

const TICKS_PER_HALF = 1000 // 1000 ticks = 45 min
const TICKS_PER_ET_HALF = 330 // 330 ticks = 15 min

function formatMatchMinute(iterationCount, half) {
  if (half === 1) {
    const min = Math.min(45, Math.floor((iterationCount / TICKS_PER_HALF) * 45) + 1)
    return `${min}' 1T`
  }
  if (half === 2) {
    const ticksIn2H = Math.max(0, iterationCount - TICKS_PER_HALF)
    const min = Math.min(90, 45 + Math.floor((ticksIn2H / TICKS_PER_HALF) * 45) + 1)
    return `${min}' 2T`
  }
  if (half === 3) {
    const ticksInET1 = Math.max(0, iterationCount - (TICKS_PER_HALF * 2))
    const min = Math.min(105, 90 + Math.floor((ticksInET1 / TICKS_PER_ET_HALF) * 15) + 1)
    return `${min}' 1T ALARGUE`
  }
  const ticksInET2 = Math.max(0, iterationCount - (TICKS_PER_HALF * 2 + TICKS_PER_ET_HALF))
  const min = Math.min(120, 105 + Math.floor((ticksInET2 / TICKS_PER_ET_HALF) * 15) + 1)
  return `${min}' 2T ALARGUE`
}

const COMMENTARY_BADGES = {
  goal: { label: '⚽ ¡GOL!', bg: '#facc15', color: '#020617' },
  redCard: { label: '🟥 ROJA', bg: '#ef4444', color: '#ffffff' },
  yellowCard: { label: '🟨 AMARILLA', bg: '#eab308', color: '#020617' },
  penalty: { label: '🚨 PENAL', bg: '#dc2626', color: '#ffffff' },
  freekick: { label: '🎯 TIRO LIBRE', bg: '#f97316', color: '#ffffff' },
  foul: { label: '🚩 FALTA', bg: '#ea580c', color: '#ffffff' },
  save: { label: '🧤 ATAJADA', bg: '#10b981', color: '#022c22' },
  miss: { label: '💨 DESVIADO', bg: '#fb7185', color: '#020617' },
  corner: { label: '🚩 CÓRNER', bg: '#38bdf8', color: '#020617' },
  offside: { label: '🚩 OFFSIDE', bg: '#818cf8', color: '#ffffff' },
  sub: { label: '🔄 CAMBIO', bg: '#2dd4bf', color: '#020617' },
  injury: { label: '🚑 LESIÓN', bg: '#f87171', color: '#020617' },
  analysis: { label: '🧠 ANÁLISIS', bg: '#c084fc', color: '#020617' },
  kickoff: { label: '📢 INICIO', bg: '#60a5fa', color: '#020617' },
  play: { label: '⚡ JUGADA', bg: '#475569', color: '#f8fafc' }
}

function buildPitchBannerFromEvent(ev, minuteLabel) {
  if (!ev) return null
  switch (ev.type) {
    case 'goal':
      return {
        type: 'goal',
        icon: '⚽',
        title: `¡GOOOOOL DE ${(ev.teamName || '').toUpperCase()}!`,
        subtitle: `Autor: ${ev.playerName} (${minuteLabel})`,
        duration: 3400
      }
    case 'redCard':
      return {
        type: 'redCard',
        icon: '🟥',
        title: `¡TARJETA ROJA! EXPULSADO ${(ev.playerName || '').toUpperCase()}`,
        subtitle: `${ev.teamName} queda con uno menos (${minuteLabel})`,
        duration: 3000
      }
    case 'yellowCard':
      return {
        type: 'yellowCard',
        icon: '🟨',
        title: `TARJETA AMARILLA PARA ${(ev.playerName || '').toUpperCase()}`,
        subtitle: `Amonestado en ${ev.teamName} (${minuteLabel})`,
        duration: 2400
      }
    case 'penalty':
      return {
        type: 'penalty',
        icon: '🚨',
        title: `¡PENAL PARA ${(ev.teamName || '').toUpperCase()}!`,
        subtitle: `Falta dentro del área sancionada por el árbitro (${minuteLabel})`,
        duration: 3000
      }
    case 'foul':
      return {
        type: 'foul',
        icon: '🚩',
        title: `FALTA DE ${(ev.playerName || '').toUpperCase()}`,
        subtitle: `Infracción sobre ${ev.victimName || 'el rival'} • Tiro libre (${minuteLabel})`,
        duration: 2100
      }
    case 'freekick':
      return {
        type: 'freekick',
        icon: '🎯',
        title: `TIRO LIBRE PARA ${(ev.teamName || '').toUpperCase()}`,
        subtitle: `Pelota parada peligrosa (${minuteLabel})`,
        duration: 2000
      }
    case 'corner':
      return {
        type: 'corner',
        icon: '🚩',
        title: `TIRO DE ESQUINA • ${(ev.teamName || '').toUpperCase()}`,
        subtitle: `Ejecuta: ${ev.playerName || 'el especialista'} (${minuteLabel})`,
        duration: 2100
      }
    case 'throwIn':
      return {
        type: 'throwIn',
        icon: '🙌',
        title: `SAQUE LATERAL • ${(ev.teamName || '').toUpperCase()}`,
        subtitle: `La pelota se fue por la banda (${minuteLabel})`,
        duration: 1650
      }
    case 'goalKick':
      return {
        type: 'goalKick',
        icon: '🥅',
        title: `SAQUE DE ARCO • ${(ev.teamName || '').toUpperCase()}`,
        subtitle: `La pelota salió por línea de fondo (${minuteLabel})`,
        duration: 1750
      }
    case 'offside':
      return {
        type: 'offside',
        icon: '🚩',
        title: `POSICIÓN ADELANTADA • ${(ev.playerName || '').toUpperCase()}`,
        subtitle: `Tiro libre indirecto rival (${minuteLabel})`,
        duration: 2100
      }
    case 'save':
      return {
        type: 'save',
        icon: '🧤',
        title: `¡ATAJADA DE ${(ev.playerName || 'ARQUERO').toUpperCase()}!`,
        subtitle: `Salvada clave para ${ev.teamName} (${minuteLabel})`,
        duration: 2100
      }
    case 'gambeta':
      return {
        type: 'play',
        icon: '⚡',
        title: `¡QUÉ GAMBETA DE ${(ev.playerName || '').toUpperCase()}!`,
        subtitle: `Dejó pagando a ${ev.victimName || 'su marcador'} y encara (${minuteLabel})`,
        duration: 1550
      }
    case 'switchOfPlay':
      return {
        type: 'play',
        icon: '🔄',
        title: `CAMBIO DE FRENTE • ${(ev.playerName || '').toUpperCase()}`,
        subtitle: `Pelotazo cruzado para abrir la cancha con ${ev.receiverName || 'la banda'} (${minuteLabel})`,
        duration: 1550
      }
    default:
      return null
  }
}

function calculatePlayerMatchRating(p, teamGoals, oppGoals) {
  const st = p.stats || {}
  let score = 6.0
  score += (st.goals || 0) * 1.45
  score += (st.shots?.on || 0) * 0.28
  score += (st.passes?.on || 0) * 0.12
  score += (st.dribbles || 0) * 0.28
  score += (st.tackles?.on || 0) * 0.25
  score += (st.saves || 0) * 0.55
  score -= (st.tackles?.fouls || 0) * 0.22
  score -= (st.cards?.yellow || 0) * 0.45
  if (p.sentOff || (st.cards?.red || 0) > 0) score -= 2.2
  if (teamGoals > oppGoals) score += 0.35
  else if (teamGoals < oppGoals) score -= 0.2
  if (p.position === 'GK' && oppGoals === 0) score += 0.75
  return Math.max(3.5, Math.min(10.0, Number(score.toFixed(1))))
}

export default function MatchSimulator({
  initialTeam1,
  initialTeam2,
  gameMode,
  onReturnToMenu,
  onPlayRematch
}) {
  const [match, setMatch] = useState(null)
  const [speed, setSpeed] = useState('x1') // 'paused' | 'x1' | 'x4'
  const [phase, setPhase] = useState('playing') // 'playing' | 'halftime' | 'et_break' | 'fulltime_tied' | 'penalties' | 'finished'
  const [showTacticsModal, setShowTacticsModal] = useState(false)
  const [activeTacticsTeamKey, setActiveTacticsTeamKey] = useState('kickOffTeam')
  const [pitchBanner, setPitchBanner] = useState(null)
  const [goalBanner, setGoalBanner] = useState(null)
  const [penaltyWinner, setPenaltyWinner] = useState(null)
  const [soundMuted, setSoundMuted] = useState(false)
  const [commentaryList, setCommentaryList] = useState([
    {
      id: 'welcome-1',
      minute: "0'",
      speaker: 'Marcelo Araujo',
      type: 'kickoff',
      text: '¡Hola, qué tal, cómo les va! ¡Bienvenidos a Fútbol de Primera! Ya están los equipos en la cancha. Contame Macaya, ¿cómo ves el partido?'
    },
    {
      id: 'welcome-2',
      minute: "0'",
      speaker: 'Enrique Macaya Márquez',
      type: 'analysis',
      text: 'Un partido apasionante, Marcelo. Dos planteles con grandes individualidades que van a definir el trámite abriendo la cancha por las bandas.'
    }
  ])

  const canvasRef = useRef(null)
  const matchRef = useRef(null)
  const commTrackerRef = useRef({ lastCommentTick: 0 })
  const commentaryQueueRef = useRef([])
  const bannerTimeoutRef = useRef(null)
  const animStateRef = useRef({
    startTime: performance.now(),
    durationMs: 145,
    lastBallTrail: []
  })

  // Inicializar el partido al montar
  useEffect(() => {
    let mounted = true
    async function setup() {
      const m = await initiateGame(
        structuredClone(initialTeam1),
        structuredClone(initialTeam2),
        PITCH_CONFIG
      )
      if (!mounted) return
      matchRef.current = m
      setMatch({ ...m })
      soundEngine.playWhistle('long')
    }
    setup()
    return () => {
      mounted = false
    }
  }, [initialTeam1, initialTeam2])

  // Cola dosificadora de relatos para que nunca salgan 3 mensajes al mismo tiempo
  useEffect(() => {
    const drainInterval = speed === 'x4' ? 680 : 1850
    const timer = setInterval(() => {
      if (commentaryQueueRef.current.length > 0) {
        const nextMsg = commentaryQueueRef.current.shift()
        setCommentaryList(prev => [nextMsg, ...prev].slice(0, 80))
      }
    }, drainInterval)
    return () => clearInterval(timer)
  }, [speed])

  const enqueueCommentary = useCallback((msgs) => {
    if (!msgs || msgs.length === 0) return
    for (const msg of msgs) {
      // Los goles y expulsiones salen al instante al tope de la cabina
      if (msg.type === 'goal' || msg.type === 'redCard' || msg.type === 'penalty') {
        setCommentaryList(prev => [msg, ...prev].slice(0, 80))
      } else {
        // Evitar acumular más de 4 mensajes pendientes en cola
        if (commentaryQueueRef.current.length < 4) {
          commentaryQueueRef.current.push(msg)
        }
      }
    }
  }, [])

  const showPitchEventBanner = useCallback((bannerObj) => {
    if (!bannerObj) return
    if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current)
    setPitchBanner(bannerObj)
    bannerTimeoutRef.current = setTimeout(() => {
      setPitchBanner(null)
    }, bannerObj.duration || 2100)
  }, [])

  // Dibujar cancha 2D en el Canvas con interpolación suave 60fps entre prevSnapshot y currentPOS
  const drawPitchInterpolated = useCallback((m, alpha = 1) => {
    const canvas = canvasRef.current
    if (!canvas || !m) return
    const ctx = canvas.getContext('2d')
    const [W, H, goalW] = m.pitchSize
    const t = Math.max(0, Math.min(1, alpha))

    ctx.clearRect(0, 0, W, H)

    // 1. Césped a franjas estilo PC Fútbol 5.0
    const stripeCount = 14
    const stripeH = H / stripeCount
    for (let i = 0; i < stripeCount; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#15803d' : '#166534'
      ctx.fillRect(0, i * stripeH, W, stripeH)
    }

    // 2. Líneas de cal reglamentarias
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.88)'
    ctx.lineWidth = 3
    const pad = 14
    ctx.strokeRect(pad, pad, W - pad * 2, H - pad * 2)

    // Línea de mitad de cancha y círculo central
    ctx.beginPath()
    ctx.moveTo(pad, H / 2)
    ctx.lineTo(W - pad, H / 2)
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(W / 2, H / 2, 72, 0, Math.PI * 2)
    ctx.stroke()

    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(W / 2, H / 2, 4, 0, Math.PI * 2)
    ctx.fill()

    // Áreas grandes y chicas (Superior e Inferior)
    const boxW = W / 2
    const boxX = (W - boxW) / 2
    const boxH = H / 6
    ctx.strokeRect(boxX, pad, boxW, boxH)
    ctx.strokeRect(boxX, H - pad - boxH, boxW, boxH)

    const smallW = W / 3.4
    const smallX = (W - smallW) / 2
    const smallH = H / 14
    ctx.strokeRect(smallX, pad, smallW, smallH)
    ctx.strokeRect(smallX, H - pad - smallH, smallW, smallH)

    // Puntos del penal
    ctx.beginPath()
    ctx.arc(W / 2, pad + H / 11, 3.5, 0, Math.PI * 2)
    ctx.arc(W / 2, H - pad - H / 11, 3.5, 0, Math.PI * 2)
    ctx.fill()

    // Arcos (Superior e Inferior)
    const gLeft = (W - goalW) / 2
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)'
    ctx.fillRect(gLeft, 2, goalW, pad - 2)
    ctx.fillRect(gLeft, H - pad, goalW, pad - 2)
    ctx.strokeStyle = '#facc15'
    ctx.lineWidth = 3.5
    ctx.strokeRect(gLeft, 2, goalW, pad - 2)
    ctx.strokeRect(gLeft, H - pad, goalW, pad - 2)

    // 3. Dibujar Jugadores de Ambos Equipos con interpolación suave
    const renderTeamPlayers = (team, prevPositions) => {
      const primary = team.primaryColor || '#1d4ed8'
      const secondary = team.secondaryColor || '#facc15'
      const captainId = Number(team.setPieces?.captainID)

      team.players.forEach((p, idx) => {
        if (!Array.isArray(p.currentPOS) || p.currentPOS[0] === 'NP' || p.sentOff) return
        const targetX = Number(p.currentPOS[0]) || 0
        const targetY = Number(p.currentPOS[1]) || 0
        const prevPos = prevPositions?.[idx]
        const startX = (Array.isArray(prevPos) && prevPos[0] !== 'NP') ? Number(prevPos[0]) : targetX
        const startY = (Array.isArray(prevPos) && prevPos[0] !== 'NP') ? Number(prevPos[1]) : targetY

        const interpX = startX + (targetX - startX) * t
        const interpY = startY + (targetY - startY) * t
        const x = Math.max(pad + 6, Math.min(W - pad - 6, interpX))
        const y = Math.max(pad + 6, Math.min(H - pad - 6, interpY))

        // Flecha sutil de desmarque (Off-Ball Run) cuando el jugador pica al vacío o proyecta por la banda
        const currentIter = m.iterationCount || 0
        if (!p.hasBall && p.offBallRun && p.offBallRun.untilIteration > currentIter) {
          const rdx = p.offBallRun.targetX - x
          const rdy = p.offBallRun.targetY - y
          const rDist = Math.sqrt(rdx * rdx + rdy * rdy)
          if (rDist > 16) {
            const arrowLen = Math.min(34, rDist * 0.55)
            const endX = x + (rdx / rDist) * arrowLen
            const endY = y + (rdy / rDist) * arrowLen
            ctx.save()
            ctx.beginPath()
            ctx.setLineDash([3, 3])
            ctx.moveTo(x, y)
            ctx.lineTo(endX, endY)
            ctx.strokeStyle = p.offBallRun.type === 'boxCrash'
              ? 'rgba(250, 204, 21, 0.78)'
              : 'rgba(56, 189, 248, 0.72)'
            ctx.lineWidth = 2
            ctx.stroke()
            ctx.restore()
          }
        }

        // Halo dorado si tiene la pelota
        if (p.hasBall) {
          ctx.beginPath()
          ctx.arc(x, y, 18, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(250, 204, 21, 0.35)'
          ctx.fill()
          ctx.strokeStyle = '#facc15'
          ctx.lineWidth = 2.5
          ctx.stroke()
        }

        // Badge fugaz cuando acaba de meter una Gambeta 1v1
        if (currentIter - (p.lastGambetaIter || -99) <= 6) {
          ctx.save()
          ctx.font = '900 9.5px "Chakra Petch", sans-serif'
          ctx.fillStyle = '#facc15'
          ctx.strokeStyle = '#000'
          ctx.lineWidth = 2.5
          ctx.strokeText('★ GAMBETA', x, y - 19)
          ctx.fillText('★ GAMBETA', x, y - 19)
          ctx.restore()
        }

        // Sombra del jugador
        ctx.beginPath()
        ctx.arc(x, y + 3, 12, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.48)'
        ctx.fill()

        // Círculo de camiseta
        ctx.beginPath()
        ctx.arc(x, y, 12, 0, Math.PI * 2)
        ctx.fillStyle = p.position === 'GK' ? '#10b981' : primary
        ctx.fill()
        ctx.lineWidth = 2.5
        ctx.strokeStyle = secondary
        ctx.stroke()

        // Dorsal
        ctx.fillStyle = p.position === 'GK' ? '#052e16' : secondary
        ctx.font = 'bold 11px "Chakra Petch", sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(p.shirtNumber || ''), x, y)

        // Cinta de capitán "C"
        if (Number(p.id || p.playerID) === captainId) {
          ctx.fillStyle = '#facc15'
          ctx.fillRect(x + 7, y - 13, 10, 9)
          ctx.fillStyle = '#000'
          ctx.font = 'bold 8px sans-serif'
          ctx.fillText('C', x + 12, y - 8.5)
        }

        // Indicador de tarjeta amarilla
        if (p.stats?.cards?.yellow > 0) {
          ctx.fillStyle = '#facc15'
          ctx.fillRect(x - 15, y - 13, 6, 9)
        }

        // Barra de energía física debajo del círculo
        const fit = Math.max(0, Math.min(100, Number(p.fitness ?? 100)))
        const barW = 22
        ctx.fillStyle = 'rgba(0,0,0,0.68)'
        ctx.fillRect(x - barW / 2, y + 14, barW, 3.5)
        ctx.fillStyle = fit > 65 ? '#4ade80' : (fit > 40 ? '#facc15' : '#ef4444')
        ctx.fillRect(x - barW / 2, y + 14, (barW * fit) / 100, 3.5)

        // Apellido del jugador
        const lastName = p.name.split(' ').slice(-1)[0]
        ctx.font = '700 10.5px "Chakra Petch", sans-serif'
        ctx.fillStyle = '#ffffff'
        ctx.strokeStyle = 'rgba(0,0,0,0.88)'
        ctx.lineWidth = 2.5
        ctx.strokeText(lastName, x, y + 25)
        ctx.fillText(lastName, x, y + 25)
      })
    }

    renderTeamPlayers(m.kickOffTeam, m.prevSnapshot?.kickOffTeam)
    renderTeamPlayers(m.secondTeam, m.prevSnapshot?.secondTeam)

    // 4. Dibujar la Pelota con diferenciación visual entre TIRO (estela de fuego dorada/roja) y PASE (línea táctica)
    if (m.ball && Array.isArray(m.ball.position)) {
      const targetBX = Number(m.ball.position[0]) || W / 2
      const targetBY = Number(m.ball.position[1]) || H / 2
      const targetBZ = Math.max(0, Number(m.ball.position[2]) || 0)

      const prevBall = m.prevSnapshot?.ball
      const startBX = Array.isArray(prevBall) ? Number(prevBall[0]) : targetBX
      const startBY = Array.isArray(prevBall) ? Number(prevBall[1]) : targetBY
      const startBZ = Array.isArray(prevBall) ? Math.max(0, Number(prevBall[2]) || 0) : targetBZ

      const bx = Math.max(pad, Math.min(W - pad, startBX + (targetBX - startBX) * t))
      const by = Math.max(pad, Math.min(H - pad, startBY + (targetBY - startBY) * t))
      const bz = startBZ + (targetBZ - startBZ) * t

      const isInFlight = Array.isArray(m.ball.ballOverIterations) && m.ball.ballOverIterations.length > 0
      const isShot = m.ball.kickType === 'shot' || m.ball.kickType === 'freekick'
      const isPass = m.ball.kickType === 'pass' || m.ball.kickType === 'through' || m.ball.kickType === 'cross' || m.ball.kickType === 'switch'

      if (isInFlight && isShot) {
        // Estela de potencia visible para diferenciar claramente un TIRO AL ARCO de un pase
        const grad = ctx.createLinearGradient(startBX, startBY, bx, by)
        grad.addColorStop(0, 'rgba(239, 68, 68, 0.15)')
        grad.addColorStop(0.5, 'rgba(249, 115, 22, 0.75)')
        grad.addColorStop(1, 'rgba(250, 204, 21, 0.98)')
        ctx.save()
        ctx.beginPath()
        ctx.moveTo(startBX, startBY - startBZ * 0.4)
        ctx.lineTo(bx, by - bz * 0.45)
        ctx.strokeStyle = grad
        ctx.lineWidth = 6.5
        ctx.lineCap = 'round'
        ctx.stroke()
        ctx.restore()
      } else if (isInFlight && isPass) {
        // Línea punteada sutil de dirección de pase/centro/cambio de frente
        ctx.save()
        ctx.beginPath()
        ctx.setLineDash([4, 4])
        ctx.moveTo(startBX, startBY)
        ctx.lineTo(bx, by)
        ctx.strokeStyle = (m.ball.kickType === 'cross' || m.ball.kickType === 'switch')
          ? 'rgba(56, 189, 248, 0.75)'
          : 'rgba(255, 255, 255, 0.52)'
        ctx.lineWidth = m.ball.kickType === 'switch' ? 2.6 : 2.2
        ctx.stroke()
        ctx.restore()
      }

      // Sombra en el piso desplazada según altura Z
      ctx.beginPath()
      ctx.arc(bx + Math.min(12, bz * 0.4), by + 3 + Math.min(14, bz * 0.5), Math.max(4, 6 - bz * 0.08), 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
      ctx.fill()

      // Esfera de la pelota (brilla en dorado/naranja cuando es un disparo al arco)
      const ballRadius = Math.min(10.5, (isShot && isInFlight ? 7.4 : 6.2) + bz * 0.12)
      ctx.beginPath()
      ctx.arc(bx, by - Math.min(18, bz * 0.45), ballRadius, 0, Math.PI * 2)
      ctx.fillStyle = (isShot && isInFlight) ? '#fde047' : '#ffffff'
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = (isShot && isInFlight) ? '#dc2626' : '#090d16'
      ctx.stroke()
    }
  }, [])

  // Loop de renderizado 60fps para interpolar suavemente entre ticks
  useEffect(() => {
    let rafId
    const renderLoop = (now) => {
      const m = matchRef.current
      if (m) {
        const { startTime, durationMs } = animStateRef.current
        const alpha = durationMs > 0 ? Math.min(1, (now - startTime) / durationMs) : 1
        drawPitchInterpolated(m, alpha)
      }
      rafId = requestAnimationFrame(renderLoop)
    }
    rafId = requestAnimationFrame(renderLoop)
    return () => cancelAnimationFrame(rafId)
  }, [drawPitchInterpolated])

  // Inteligencia Artificial de DT en Vivo (D5): ajusta mentalidad según resultado y realiza cambios tácticos
  const maybePerformAIManagerActions = (m) => {
    if (gameMode !== 'ai') return m
    const aiTeam = m.secondTeam
    if (!aiTeam) return m
    const tick = m.iterationCount || 0
    const koGoals = m.kickOffTeamStatistics.goals
    const aiGoals = m.secondTeamStatistics.goals

    // 1. Ajuste dinámico de mentalidad en el segundo tiempo
    if (m.half >= 2 && tick % 250 === 0) {
      let desiredMentality = 'balanced'
      if (aiGoals < koGoals && tick >= 1150) desiredMentality = 'offensive'
      else if (aiGoals > koGoals && tick >= 1550) desiredMentality = 'defensive'
      if (aiTeam.mentality !== desiredMentality) {
        m = applyLiveTactics(m, 'secondTeam', {
          formationId: aiTeam.formation,
          mentalityId: desiredMentality,
          setPieces: aiTeam.setPieces
        })
      }
    }

    // 2. Cambios por cansancio o tarjeta amarilla acumulada
    if ((aiTeam.substitutionsUsed || 0) >= 5) return m
    if (tick !== 1250 && tick !== 1550 && tick !== 1780 && tick !== 2150) return m

    let candidateIdx = -1
    let worstPriority = 999
    aiTeam.players.forEach((p, idx) => {
      if (idx > 0 && !p.sentOff) {
        const effectivePriority = (p.fitness ?? 100) - ((p.stats?.cards?.yellow || 0) > 0 ? 18 : 0)
        if (effectivePriority < 74 && effectivePriority < worstPriority) {
          worstPriority = effectivePriority
          candidateIdx = idx
        }
      }
    })
    if (candidateIdx === -1) return m

    const targetRole = aiTeam.players[candidateIdx].tacticalRole || aiTeam.players[candidateIdx].position
    let bestBenchIdx = -1
    let bestScore = -1
    ;(aiTeam.bench || []).forEach((sub, bIdx) => {
      if (sub.substitutedOut || (sub.fitness ?? 100) < 88 || sub.position === 'GK') return
      const compat = getPositionCompatibility(sub, targetRole)
      const score = sub.rating * compat.factor
      if (score > bestScore) {
        bestScore = score
        bestBenchIdx = bIdx
      }
    })

    if (bestBenchIdx !== -1) {
      try {
        return makeSubstitution(m, 'secondTeam', candidateIdx, bestBenchIdx)
      } catch {
        return m
      }
    }
    return m
  }

  // Ejecutar 1 tick de partido
  const stepOneTick = useCallback(async () => {
    let m = matchRef.current
    if (!m || phase !== 'playing') return

    // Si estamos interpolando una transición de pelota parada, esperar a que termine antes del próximo tick
    const now = performance.now()
    if (now - animStateRef.current.startTime < animStateRef.current.durationMs - 12) {
      return
    }

    const prevEventsLen = (m.events || []).length
    m = await playIteration(m)
    m = maybePerformAIManagerActions(m)

    const currentEvents = m.events || []
    const newEventsSlice = currentEvents.slice(prevEventsLen)
    const primaryEvent = newEventsSlice[newEventsSlice.length - 1] || null

    const minLabel = formatMatchMinute(m.iterationCount, m.half)
    const newComments = generateCommentaryForIteration(m, primaryEvent, minLabel, commTrackerRef.current)

    // Determinar si hubo pelota parada para activar transición suave (evita teletransportes bruscos)
    const hasDeadBallEvent = newEventsSlice.some(ev => ev.deadBall || ev.type === 'goal')
    const baseTickMs = speed === 'x4' ? 38 : 145
    const transitionMs = hasDeadBallEvent ? (speed === 'x4' ? 190 : 560) : baseTickMs
    animStateRef.current = {
      startTime: performance.now(),
      durationMs: transitionMs
    }

    // Procesar carteles superiores y efectos de sonido
    for (const ev of newEventsSlice) {
      const bannerObj = buildPitchBannerFromEvent(ev, minLabel)
      if (bannerObj) showPitchEventBanner(bannerObj)

      if (ev.type === 'goal') {
        soundEngine.playGoalRoar()
        setGoalBanner(`¡GOOOOOL DE ${ev.teamName.toUpperCase()}! (${ev.playerName})`)
        setTimeout(() => setGoalBanner(null), 3200)
      } else if (ev.type === 'redCard' || ev.type === 'yellowCard') {
        soundEngine.playWhistle('short')
        soundEngine.playCardBeep()
      } else if (ev.type === 'foul' || ev.type === 'penalty' || ev.type === 'offside') {
        soundEngine.playWhistle('short')
      } else if (ev.type === 'shot') {
        soundEngine.playShotKick()
      }
    }

    if (newComments.length > 0) {
      enqueueCommentary(newComments)
    }

    // Verificar fin de tiempo reglamentario / entretiempo / alargue
    const tick = m.iterationCount
    if (m.half === 1 && tick >= TICKS_PER_HALF) {
      soundEngine.playWhistle('double')
      setPhase('halftime')
      setSpeed('paused')
    } else if (m.half === 2 && tick >= TICKS_PER_HALF * 2) {
      soundEngine.playWhistle('long')
      if (m.kickOffTeamStatistics.goals === m.secondTeamStatistics.goals) {
        setPhase('fulltime_tied')
        setSpeed('paused')
      } else {
        setPhase('finished')
        setSpeed('paused')
      }
    } else if (m.half === 3 && tick >= TICKS_PER_HALF * 2 + TICKS_PER_ET_HALF) {
      soundEngine.playWhistle('double')
      setPhase('et_break')
      setSpeed('paused')
    } else if (m.half === 4 && tick >= TICKS_PER_HALF * 2 + TICKS_PER_ET_HALF * 2) {
      soundEngine.playWhistle('long')
      if (m.kickOffTeamStatistics.goals === m.secondTeamStatistics.goals) {
        setPhase('penalties')
        setSpeed('paused')
      } else {
        setPhase('finished')
        setSpeed('paused')
      }
    }

    matchRef.current = m
    setMatch({ ...m })
  }, [phase, gameMode, speed, enqueueCommentary, showPitchEventBanner])

  // Loop del temporizador según la velocidad elegida
  useEffect(() => {
    if (phase !== 'playing' || speed === 'paused' || showTacticsModal) return
    const intervalMs = speed === 'x4' ? 38 : 145
    const timer = setInterval(() => {
      stepOneTick()
    }, intervalMs)
    return () => clearInterval(timer)
  }, [phase, speed, showTacticsModal, stepOneTick])

  // Simular resultado directo del tiempo actual (o partido completo)
  const handleInstantSimulate = () => {
    let m = matchRef.current
    if (!m) return
    setSpeed('paused')
    commentaryQueueRef.current = []
    const collectedComments = []

    const runUntilTick = async (targetTick) => {
      while ((m.iterationCount || 0) < targetTick) {
        const prevLen = (m.events || []).length
        m = await playIteration(m)
        m = maybePerformAIManagerActions(m)
        const evs = m.events || []
        const newEv = evs.length > prevLen ? evs[evs.length - 1] : null
        const minLabel = formatMatchMinute(m.iterationCount, m.half)
        const comms = generateCommentaryForIteration(m, newEv, minLabel, commTrackerRef.current)
        if (comms.length > 0) collectedComments.unshift(...comms)
      }
    }

    ;(async () => {
      if (m.half === 1) {
        await runUntilTick(TICKS_PER_HALF)
        m = await startSecondHalf(m)
      }
      if (m.half === 2) {
        await runUntilTick(TICKS_PER_HALF * 2)
      }

      if (m.half === 2 && m.kickOffTeamStatistics.goals === m.secondTeamStatistics.goals) {
        setPhase('fulltime_tied')
      } else if (m.half >= 3) {
        if (m.half === 3) {
          await runUntilTick(TICKS_PER_HALF * 2 + TICKS_PER_ET_HALF)
          m = await startExtraTimeHalf(m)
        }
        if (m.half === 4) {
          await runUntilTick(TICKS_PER_HALF * 2 + TICKS_PER_ET_HALF * 2)
        }
        if (m.kickOffTeamStatistics.goals === m.secondTeamStatistics.goals) {
          setPhase('penalties')
        } else {
          setPhase('finished')
        }
      } else {
        setPhase('finished')
      }

      soundEngine.playWhistle('long')
      if (collectedComments.length > 0) {
        setCommentaryList(prev => [...collectedComments.slice(0, 25), ...prev].slice(0, 80))
      }
      matchRef.current = m
      setMatch({ ...m })
    })()
  }

  const handleStartSecondHalf = async () => {
    let m = matchRef.current
    if (!m) return
    m = await startSecondHalf(m)
    soundEngine.playWhistle('long')
    matchRef.current = m
    setMatch({ ...m })
    setPhase('playing')
    setSpeed('x1')
    setCommentaryList(prev => [
      {
        id: `2h-${Date.now()}`,
        minute: "45' 2T",
        speaker: 'Marcelo Araujo',
        type: 'kickoff',
        text: `¡Arranca el segundo tiempo! Ya mueve ${m.secondTeam.name}. ¡45 minutos finales a todo o nada!`
      },
      ...prev
    ])
  }

  const handleStartExtraTime = async () => {
    let m = matchRef.current
    if (!m) return
    m = await startExtraTimeHalf(m)
    soundEngine.playWhistle('long')
    matchRef.current = m
    setMatch({ ...m })
    setPhase('playing')
    setSpeed('x1')
    setCommentaryList(prev => [
      {
        id: `et-${Date.now()}`,
        minute: m.half === 3 ? "90' 1T ALARGUE" : "105' 2T ALARGUE",
        speaker: 'Marcelo Araujo',
        type: 'kickoff',
        text: m.half === 3
          ? '¡Señoras y señores, hay alargue! 30 minutos suplementarios con las piernas al límite.'
          : '¡Últimos 15 minutos del alargue! Si siguen así, nos vamos a los penales.'
      },
      ...prev
    ])
  }

  const handleLiveUpdateTeam = (updatedTeam) => {
    let m = matchRef.current
    if (!m) return
    m[activeTacticsTeamKey] = updatedTeam
    m = applyLiveTactics(m, activeTacticsTeamKey, {
      formationId: updatedTeam.formation,
      mentalityId: updatedTeam.mentality,
      playStyleId: updatedTeam.playStyle,
      setPieces: updatedTeam.setPieces
    })
    matchRef.current = m
    setMatch({ ...m })
  }

  const handleLiveSubstitution = (fieldIdx, benchIdx) => {
    let m = matchRef.current
    if (!m) return
    const prevLen = (m.events || []).length
    m = makeSubstitution(m, activeTacticsTeamKey, fieldIdx, benchIdx)
    const evs = m.events || []
    if (evs.length > prevLen) {
      const subEv = evs[evs.length - 1]
      const minLabel = formatMatchMinute(m.iterationCount, m.half)
      const comms = generateCommentaryForIteration(m, subEv, minLabel, commTrackerRef.current)
      if (comms.length > 0) setCommentaryList(prev => [...comms, ...prev])
    }
    matchRef.current = m
    setMatch({ ...m })
  }

  if (!match) {
    return (
      <div className="main-container">
        <div className="panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <h2>Preparando el estadio y sorteando el saque inicial...</h2>
        </div>
      </div>
    )
  }

  const t1 = match.kickOffTeam
  const t2 = match.secondTeam
  const s1 = match.kickOffTeamStatistics
  const s2 = match.secondTeamStatistics

  const totalPossTicks = (s1.possessionTicks || 1) + (s2.possessionTicks || 1)
  const poss1 = Math.round(((s1.possessionTicks || 1) / totalPossTicks) * 100)
  const poss2 = 100 - poss1

  const cards1 = t1.players.reduce(
    (acc, p) => ({ y: acc.y + (p.stats?.cards?.yellow || 0), r: acc.r + (p.stats?.cards?.red || 0) }),
    { y: 0, r: 0 }
  )
  const cards2 = t2.players.reduce(
    (acc, p) => ({ y: acc.y + (p.stats?.cards?.yellow || 0), r: acc.r + (p.stats?.cards?.red || 0) }),
    { y: 0, r: 0 }
  )

  // Calcular calificaciones 1-10 y MVP cuando termina el partido
  const ratedT1 = t1.players.map(p => ({ ...p, matchRating: calculatePlayerMatchRating(p, s1.goals, s2.goals), teamName: t1.name }))
  const ratedT2 = t2.players.map(p => ({ ...p, matchRating: calculatePlayerMatchRating(p, s2.goals, s1.goals), teamName: t2.name }))
  const mvpPlayer = [...ratedT1, ...ratedT2].sort((a, b) => b.matchRating - a.matchRating || (b.stats?.goals || 0) - (a.stats?.goals || 0))[0]

  return (
    <div className="main-container">
      {/* Marcador Electrónico LED Estilo PC Fútbol */}
      <div className="tv-scoreboard">
        <div className="score-teams-row">
          <div className="score-team-block">
            <span className="score-kit-dot" style={{ background: t1.primaryColor, borderColor: t1.secondaryColor }} />
            <span className="score-team-name">{t1.name}</span>
          </div>

          <div className="score-digits">
            {s1.goals} - {s2.goals}
          </div>

          <div className="score-team-block">
            <span className="score-team-name">{t2.name}</span>
            <span className="score-kit-dot" style={{ background: t2.primaryColor, borderColor: t2.secondaryColor }} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
          <div className="match-clock-pill">
            <span>⏱️ {formatMatchMinute(match.iterationCount, match.half)}</span>
          </div>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            title={soundMuted ? 'Activar Sonido Estadio' : 'Silenciar Audio'}
            onClick={() => {
              const nextMuted = soundEngine.toggleMute()
              setSoundMuted(nextMuted)
            }}
          >
            {soundMuted ? '🔇 Audio Off' : '🔊 Audio On'}
          </button>

          {phase === 'playing' && (
            <>
              <button
                type="button"
                className={`btn btn-sm ${speed === 'paused' ? 'btn-gold' : 'btn-outline'}`}
                onClick={() => setSpeed(speed === 'paused' ? 'x1' : 'paused')}
              >
                {speed === 'paused' ? '▶️ Reanudar' : '⏸️ Pausa'}
              </button>
              <button
                type="button"
                className={`btn btn-sm ${speed === 'x1' ? 'btn-gold' : 'btn-outline'}`}
                onClick={() => setSpeed('x1')}
              >
                Normal (x1)
              </button>
              <button
                type="button"
                className={`btn btn-sm ${speed === 'x4' ? 'btn-gold' : 'btn-outline'}`}
                onClick={() => setSpeed('x4')}
              >
                ⏩ Rápido (x4)
              </button>
              <button
                type="button"
                className="btn btn-emerald btn-sm"
                onClick={handleInstantSimulate}
              >
                ⚡ Resultado Directo
              </button>
            </>
          )}

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setSpeed('paused')
              setShowTacticsModal(true)
            }}
          >
            📋 Pizarra / Cambios ({t1.substitutionsUsed || 0}/5)
          </button>
        </div>
      </div>

      {/* Banner de Entretiempo / Alargue / Resumen Final PC Fútbol */}
      {phase !== 'playing' && (
        <div className="panel panel-gold" style={{ marginBottom: '1rem', textAlign: 'center', padding: '1.1rem' }}>
          {phase === 'halftime' && (
            <>
              <h2 style={{ color: '#facc15', marginBottom: '0.35rem' }}>
                ⏸️ ENTRETIEMPO • FINAL DEL PRIMER TIEMPO ({t1.name} {s1.goals} - {s2.goals} {t2.name})
              </h2>
              <p style={{ fontSize: '0.86rem', color: '#cbd5e1', marginBottom: '0.85rem' }}>
                Los jugadores recuperan aire en el vestuario (+18% físico). Podés abrir la Pizarra Táctica para hacer cambios o iniciar el complemento.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-primary" onClick={() => setShowTacticsModal(true)}>
                  📋 Ajustar Táctica / Hacer Cambios
                </button>
                <button type="button" className="btn btn-gold btn-lg" onClick={handleStartSecondHalf}>
                  ⚽ Iniciar Segundo Tiempo
                </button>
              </div>
            </>
          )}

          {phase === 'fulltime_tied' && (
            <>
              <h2 style={{ color: '#facc15', marginBottom: '0.35rem' }}>
                🔔 FINAL DE LOS 90 MINUTOS • EMPATE {s1.goals} A {s2.goals}
              </h2>
              <p style={{ fontSize: '0.86rem', color: '#cbd5e1', marginBottom: '0.85rem' }}>
                No se sacaron ventaja en el tiempo reglamentario. Nos vamos al Alargue (2 tiempos de 15 minutos) y, si persiste la igualdad, definición por penales.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-primary" onClick={() => setShowTacticsModal(true)}>
                  📋 Hacer Cambios Antes del Alargue
                </button>
                <button type="button" className="btn btn-gold btn-lg" onClick={handleStartExtraTime}>
                  🔥 Iniciar Primer Tiempo del Alargue (15')
                </button>
              </div>
            </>
          )}

          {phase === 'et_break' && (
            <>
              <h2 style={{ color: '#facc15', marginBottom: '0.35rem' }}>
                ⏸️ CAMBIO DE LADO EN EL ALARGUE (105') • {t1.name} {s1.goals} - {s2.goals} {t2.name}
              </h2>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '0.6rem' }}>
                <button type="button" className="btn btn-primary" onClick={() => setShowTacticsModal(true)}>
                  📋 Pizarra / Cambios
                </button>
                <button type="button" className="btn btn-gold btn-lg" onClick={handleStartExtraTime}>
                  ⚽ Jugar Últimos 15 Minutos (2T Alargue)
                </button>
              </div>
            </>
          )}

          {phase === 'finished' && (
            <div>
              <span className="brand-badge">FICHA OFICIAL DEL PARTIDO • PC FÚTBOL</span>
              <h2 style={{ fontSize: '1.75rem', color: '#00ff66', margin: '0.45rem 0', fontFamily: 'VT323, monospace', letterSpacing: '0.06em' }}>
                🏆 {penaltyWinner
                  ? `¡${penaltyWinner.team.name.toUpperCase()} CAMPEÓN POR PENALES (${penaltyWinner.score1}-${penaltyWinner.score2})!`
                  : s1.goals > s2.goals
                    ? `¡VICTORIA DE ${t1.name.toUpperCase()} (${s1.goals} - ${s2.goals})!`
                    : `¡VICTORIA DE ${t2.name.toUpperCase()} (${s2.goals} - ${s1.goals})!`}
              </h2>

              {mvpPlayer && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    background: '#02060d',
                    border: '2px solid #facc15',
                    padding: '0.45rem 1rem',
                    margin: '0.4rem 0 0.9rem',
                    borderRadius: '2px'
                  }}
                >
                  <span style={{ fontSize: '1.3rem' }}>⭐</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.68rem', color: '#facc15', fontWeight: 800 }}>
                      FIGURA DEL PARTIDO (PREMIO CHAMIGO)
                    </div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff' }}>
                      {mvpPlayer.name} ({mvpPlayer.teamName}) • Puntaje: <span style={{ color: '#00ff66' }}>{mvpPlayer.matchRating}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Planilla de Calificaciones 1-10 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.85rem', textAlign: 'left', margin: '0.5rem 0 1rem' }}>
                {[
                  { title: t1.name, list: ratedT1, color: '#facc15' },
                  { title: t2.name, list: ratedT2, color: '#38bdf8' }
                ].map((group) => (
                  <div key={group.title} style={{ background: '#040a17', border: '1px solid #334e7a', padding: '0.6rem' }}>
                    <div style={{ fontWeight: 800, color: group.color, fontSize: '0.82rem', marginBottom: '0.4rem', borderBottom: '1px solid #1e3a8a', paddingBottom: '0.25rem' }}>
                      PLANILLA DE PUNTUACIÓN • {group.title}
                    </div>
                    {group.list.map((p) => (
                      <div key={p.playerID} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', padding: '2px 0', borderBottom: '1px solid rgba(51,78,122,0.25)' }}>
                        <span>
                          <b>#{p.shirtNumber}</b> {p.name} {p.stats?.goals > 0 ? `⚽x${p.stats.goals}` : ''} {p.sentOff ? '🟥' : ''}
                        </span>
                        <span style={{ fontFamily: 'VT323, monospace', fontSize: '1rem', color: p.matchRating >= 7.5 ? '#00ff66' : (p.matchRating >= 6.0 ? '#facc15' : '#f87171') }}>
                          {p.matchRating.toFixed(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.85rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-gold btn-lg" onClick={onPlayRematch}>
                  🔄 Jugar Revancha (Mismos Planteles)
                </button>
                <button type="button" className="btn btn-outline btn-lg" onClick={onReturnToMenu}>
                  🏠 Volver al Menú Principal / Nuevo Draft
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grilla Principal: Cancha 2D a la izquierda + Cabina de Transmisión y Estadísticas a la derecha */}
      <div className="match-layout-grid">
        {/* Cancha 2D con Cartel Superior de Eventos */}
        <div className="canvas-wrapper">
          {pitchBanner && (
            <div className={`pitch-event-banner banner-${pitchBanner.type}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                <span style={{ fontSize: '1.35rem' }}>{pitchBanner.icon}</span>
                <div>
                  <div style={{ fontFamily: 'Chakra Petch, sans-serif', fontWeight: 900, fontSize: '0.88rem', lineHeight: 1.1 }}>
                    {pitchBanner.title}
                  </div>
                  <div style={{ fontSize: '0.72rem', opacity: 0.92, fontWeight: 700 }}>
                    {pitchBanner.subtitle}
                  </div>
                </div>
              </div>
            </div>
          )}

          <canvas
            ref={canvasRef}
            width={PITCH_CONFIG.pitchWidth}
            height={PITCH_CONFIG.pitchHeight}
            className="pitch-canvas"
          />

          {goalBanner && (
            <div
              style={{
                position: 'absolute',
                top: '46%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: 'linear-gradient(180deg, #fde047 0%, #ca8a04 100%)',
                color: '#020617',
                padding: '0.85rem 1.5rem',
                borderRadius: '2px',
                fontFamily: 'Chakra Petch, sans-serif',
                fontWeight: 900,
                fontSize: '1.35rem',
                boxShadow: '0 0 40px rgba(250, 204, 21, 0.95)',
                border: '3px solid #fff',
                textAlign: 'center',
                zIndex: 30
              }}
            >
              ⚽ {goalBanner}
            </div>
          )}
        </div>

        {/* Columna Derecha: Relatos en Vivo + Estadísticas + Estado Físico de los 22 Jugadores */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Cabina de Transmisión Araujo & Macaya */}
          <div className="panel panel-gold">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.55rem' }}>
              <h3 style={{ color: '#facc15', fontSize: '1rem' }}>
                🎙️ CABINA DE TRANSMISIÓN • ARAUJO & MACAYA MÁRQUEZ
              </h3>
              <span style={{ fontSize: '0.72rem', color: '#00ff66', fontWeight: 800 }}>
                ● EN VIVO
              </span>
            </div>

            <div className="commentary-feed">
              {commentaryList.map((item) => {
                const badge = COMMENTARY_BADGES[item.type] || COMMENTARY_BADGES.play
                const isAraujo = (item.speaker || '').toUpperCase().includes('ARAUJO')
                return (
                  <div key={item.id} className={`commentary-item type-${item.type}`}>
                    <div className="commentary-speaker">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span
                          style={{
                            background: badge.bg,
                            color: badge.color,
                            fontSize: '0.64rem',
                            fontWeight: 900,
                            padding: '1px 5px',
                            borderRadius: '2px'
                          }}
                        >
                          {badge.label}
                        </span>
                        <span style={{ color: isAraujo ? '#facc15' : '#38bdf8' }}>
                          {item.speaker}
                        </span>
                      </div>
                      <span className="led-font" style={{ color: '#00ff66', fontSize: '1rem' }}>{item.minute}</span>
                    </div>
                    <div>{item.text}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Estadísticas del Partido en Tiempo Real */}
          <div className="panel">
            <h3 style={{ color: '#facc15', fontSize: '0.96rem', marginBottom: '0.65rem' }}>
              📊 ESTADÍSTICAS DEL PARTIDO EN VIVO
            </h3>

            {[
              { label: 'Posesión de Pelota', v1: `${poss1}%`, v2: `${poss2}%`, p1: poss1 },
              {
                label: 'Tiros Totales (Al Arco)',
                v1: `${s1.shots.total} (${s1.shots.on})`,
                v2: `${s2.shots.total} (${s2.shots.on})`,
                p1: (s1.shots.total + s2.shots.total) > 0 ? (s1.shots.total / (s1.shots.total + s2.shots.total)) * 100 : 50
              },
              {
                label: 'Pases Completados / Intentados',
                v1: `${s1.passesCompleted || 0}/${s1.passesTotal || 0}`,
                v2: `${s2.passesCompleted || 0}/${s2.passesTotal || 0}`,
                p1: ((s1.passesCompleted || 0) + (s2.passesCompleted || 0)) > 0
                  ? ((s1.passesCompleted || 0) / ((s1.passesCompleted || 0) + (s2.passesCompleted || 0))) * 100
                  : 50
              },
              {
                label: 'Tiros de Esquina (Córners)',
                v1: s1.corners,
                v2: s2.corners,
                p1: (s1.corners + s2.corners) > 0 ? (s1.corners / (s1.corners + s2.corners)) * 100 : 50
              },
              {
                label: 'Faltas Cometidas / Penales',
                v1: `${s1.fouls || 0} (Pen: ${s1.penalties})`,
                v2: `${s2.fouls || 0} (Pen: ${s2.penalties})`,
                p1: ((s1.fouls || 0) + (s2.fouls || 0)) > 0 ? ((s1.fouls || 0) / ((s1.fouls || 0) + (s2.fouls || 0))) * 100 : 50
              },
              {
                label: 'Tarjetas (Amarillas / Rojas)',
                v1: `🟨 ${cards1.y} | 🟥 ${cards1.r}`,
                v2: `🟨 ${cards2.y} | 🟥 ${cards2.r}`,
                p1: 50
              }
            ].map((row) => (
              <div key={row.label} className="stat-comparison-row">
                <div className="stat-comparison-header">
                  <span style={{ color: '#facc15' }}>{row.v1}</span>
                  <span style={{ color: '#cbd5e1' }}>{row.label}</span>
                  <span style={{ color: '#38bdf8' }}>{row.v2}</span>
                </div>
                <div className="stat-bar-track">
                  <div style={{ width: `${row.p1}%`, background: t1.primaryColor || '#facc15', transition: 'width 0.3s' }} />
                  <div style={{ width: `${100 - row.p1}%`, background: t2.primaryColor || '#38bdf8', transition: 'width 0.3s' }} />
                </div>
              </div>
            ))}
          </div>

          {/* Estado Físico y Goleadores en Cancha */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
            {[
              { team: t1, accent: '#facc15' },
              { team: t2, accent: '#38bdf8' }
            ].map(({ team, accent }) => (
              <div key={team.name} className="panel" style={{ padding: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                  <h4 style={{ color: accent, fontSize: '0.86rem' }}>
                    {team.name} ({team.formation} • {team.mentality === 'offensive' ? 'Ofensiva' : team.mentality === 'defensive' ? 'Defensiva' : 'Equil.'})
                  </h4>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                    Cambios: {team.substitutionsUsed || 0}/5
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.26rem', maxHeight: '210px', overflowY: 'auto' }}>
                  {team.players.map((p) => {
                    const fit = Math.round(p.fitness ?? 100)
                    return (
                      <div
                        key={p.playerID}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.74rem',
                          opacity: p.sentOff ? 0.4 : 1,
                          padding: '1px 3px',
                          background: p.hasBall ? 'rgba(250, 204, 21, 0.14)' : 'transparent'
                        }}
                      >
                        <span>
                          <b style={{ color: accent }}>#{p.shirtNumber}</b> {p.name}{' '}
                          <span style={{ color: '#64748b', fontSize: '0.66rem' }}>({p.tacticalRole || p.position})</span>{' '}
                          {p.stats?.goals > 0 && `⚽x${p.stats.goals}`}{' '}
                          {p.stats?.cards?.yellow > 0 && '🟨'}
                          {p.sentOff && '🟥'}
                        </span>
                        <span style={{ color: fit > 65 ? '#4ade80' : (fit > 40 ? '#facc15' : '#ef4444'), fontWeight: 800 }}>
                          {fit}%
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal de Pizarra Táctica y Cambios en Vivo */}
      {showTacticsModal && (
        <div className="modal-backdrop" onClick={() => setShowTacticsModal(false)}>
          <div className="modal-content" style={{ maxWidth: '1260px' }} onClick={(e) => e.stopPropagation()}>
            <TacticsBoard
              team={match[activeTacticsTeamKey]}
              onUpdateTeam={handleLiveUpdateTeam}
              isLiveMatch={true}
              onMakeLiveSubstitution={handleLiveSubstitution}
              onConfirm={() => setShowTacticsModal(false)}
              confirmLabel="Volver al Partido ⚽"
              secondaryTeamTab={
                gameMode === 'pvp'
                  ? {
                      activeTeamIndex: activeTacticsTeamKey === 'kickOffTeam' ? 1 : 2,
                      onSwitchTeam: (idx) => setActiveTacticsTeamKey(idx === 1 ? 'kickOffTeam' : 'secondTeam'),
                      team1Name: t1.name,
                      team2Name: t2.name
                    }
                  : null
              }
            />
          </div>
        </div>
      )}

      {/* Modal de Definición por Penales (si empatan tras los 120' de alargue) */}
      {phase === 'penalties' && (
        <PenaltyShootoutModal
          team1={t1}
          team2={t2}
          onFinishShootout={(winInfo) => {
            setPenaltyWinner(winInfo)
            setPhase('finished')
          }}
        />
      )}
    </div>
  )
}
