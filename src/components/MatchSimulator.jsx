import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
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
    case 'goal': {
      const detail = ev.goalDetail ? ` • ${ev.goalDetail}` : ''
      return {
        type: 'goal',
        icon: '⚽',
        title: `¡GOOOOOL DE ${(ev.teamName || '').toUpperCase()}!`,
        subtitle: `Autor: ${ev.playerName}${detail} (${minuteLabel})`,
        duration: 3400
      }
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
    case 'penalty': {
      const infractor = (ev.infractorName || ev.playerName || 'DEFENSOR').split(' ').pop().toUpperCase()
      return {
        type: 'penalty',
        icon: '🚨',
        title: `PENAL - ${infractor}`,
        subtitle: `Infracción dentro del área sancionada por el árbitro (${minuteLabel})`,
        duration: 3200
      }
    }
    case 'foul': {
      const lastName = (ev.playerName || '').split(' ').pop().toUpperCase()
      const isRed = ev.card === 'red' || ev.foulCard === 'red'
      const isYellow = ev.card === 'yellow' || ev.foulCard === 'yellow'
      const cardTag = isRed ? ' • 🟥 TARJETA ROJA' : (isYellow ? ' • 🟨 TARJETA AMARILLA' : '')
      const cardIcon = isRed ? '🟥' : (isYellow ? '🟨' : '🚩')
      return {
        type: 'foul',
        icon: cardIcon,
        title: `FALTA DE ${lastName}${cardTag}`,
        subtitle: `Infracción sobre ${ev.victimName || 'el rival'} • Tiro libre (${minuteLabel})`,
        duration: 2500
      }
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
        title: `CORNER PARA ${(ev.teamName || '').toUpperCase()}`,
        subtitle: `Tiro de esquina ejecutado por ${ev.playerName || 'el especialista'} (${minuteLabel})`,
        duration: 2400
      }
    case 'throwIn':
      return {
        type: 'throwIn',
        icon: '🙌',
        title: `LATERAL PARA ${(ev.teamName || '').toUpperCase()}`,
        subtitle: `Saque de banda en juego (${minuteLabel})`,
        duration: 2000
      }
    case 'goalKick':
      return {
        type: 'goalKick',
        icon: '🥅',
        title: `SAQUE DE ARCO • ${(ev.teamName || '').toUpperCase()}`,
        subtitle: `La pelota salió por línea de fondo (${minuteLabel})`,
        duration: 2000
      }
    case 'shot': {
      if (ev.onTarget === false || ev.outcome === 'miss') {
        const title = ev.isHeader
          ? `💨 CABEZAZO DESVIADO • ${(ev.playerName || 'DELANTERO').toUpperCase()}`
          : (ev.isVolley
            ? `💨 VOLEA DESVIADA • ${(ev.playerName || 'DELANTERO').toUpperCase()}`
            : `💨 REMATE DESVIADO • ${(ev.playerName || 'DELANTERO').toUpperCase()}`)
        const subtitle = `La pelota salió por la línea de fondo • Saque de arco (${minuteLabel})`
        return {
          type: 'miss',
          icon: '💨',
          title,
          subtitle,
          duration: 2000
        }
      }
      return null
    }
    case 'offside': {
      const offLastName = (ev.playerName || '').split(' ').pop().toUpperCase()
      return {
        type: 'offside',
        icon: '🚩',
        title: `OFFSIDE DE ${offLastName}`,
        subtitle: `Posición adelantada tras pase de ${ev.passerName || 'su compañero'} • Tiro libre indirecto (${minuteLabel})`,
        duration: 3800
      }
    }
    case 'save': {
      const isCorner = ev.outcome === 'corner'
      const isRebound = ev.outcome === 'rebound'
      let title = `¡ATAJADA DE ${(ev.playerName || 'ARQUERO').toUpperCase()}!`
      let subtitle = `Salvada clave para ${ev.teamName} (${minuteLabel})`
      if (isCorner) {
        title = `¡ATAJADA AL CÓRNER DE ${(ev.playerName || 'ARQUERO').toUpperCase()}!`
        subtitle = `Desvió la pelota sobre la línea final al tiro de esquina (${minuteLabel})`
      } else if (isRebound) {
        title = `¡REBOTE TRAS ATAJADA DE ${(ev.playerName || 'ARQUERO').toUpperCase()}!`
        subtitle = `La pelota quedó suelta en zona de peligro (${minuteLabel})`
      }
      return {
        type: 'save',
        icon: isCorner ? '🧤🚩' : '🧤',
        title,
        subtitle,
        duration: 2100
      }
    }
    case 'injury': {
      const isSerious = ev.grade === 'serious'
      const icon = isSerious ? '🚨' : (ev.grade === 'hurt' ? '⚠️' : '🩹')
      const gradeLabel = isSerious ? 'LESIÓN GRAVE' : (ev.grade === 'hurt' ? 'MOLESTIA FÍSICA' : 'GOLPE LEVE')
      return {
        type: 'injury',
        icon,
        title: `${gradeLabel} • ${(ev.playerName || '').toUpperCase()}`,
        subtitle: `${ev.injuryName || 'Atención médica'} — ${ev.canContinue ? 'Continúa disminuido' : 'Pide el cambio obligatorio'} (${minuteLabel})`,
        duration: 2800
      }
    }
    case 'substitution': {
      return {
        type: 'substitution',
        icon: '🔄',
        title: `CAMBIO EN ${(ev.teamName || '').toUpperCase()}`,
        subtitle: `Sale: ${ev.playerOut} ⬇️  •  Entra: ${ev.playerIn} ⬆️ (${minuteLabel})`,
        duration: 3800
      }
    }
    case 'gambeta':
      return {
        type: 'play',
        icon: '⚡',
        title: `¡QUÉ GAMBETA DE ${(ev.playerName || '').toUpperCase()}!`,
        subtitle: `Dejó pagando a ${ev.victimName || 'su marcador'} y encara (${minuteLabel})`,
        duration: 1550
      }
    case 'caudilloTackle':
      return {
        type: 'play',
        icon: '🛡️',
        title: `¡CARGA CON EL CUERPO DE ${(ev.playerName || '').toUpperCase()}!`,
        subtitle: `Lo desparramó a ${ev.victimName || 'su rival'} hombro a hombro limpiamente (${minuteLabel})`,
        duration: 1750
      }
    case 'switchOfPlay':
      return {
        type: 'play',
        icon: '🔄',
        title: `CAMBIO DE FRENTE • ${(ev.playerName || '').toUpperCase()}`,
        subtitle: `Pelotazo cruzado para abrir la cancha con ${ev.receiverName || 'la banda'} (${minuteLabel})`,
        duration: 1550
      }
    case 'gkLongPass':
      return {
        type: 'play',
        icon: '🧤',
        title: `DESPEJE LARGO • ${(ev.playerName || '').toUpperCase()}`,
        subtitle: `Pelotazo largo del arquero buscando a los delanteros (${minuteLabel})`,
        duration: 1650
      }
    case 'oneTwoPass':
      return {
        type: 'play',
        icon: '⚡',
        title: `¡HERMOSA PARED! • ${(ev.teamName || '').toUpperCase()}`,
        subtitle: `${ev.playerName} y ${ev.receiverName || 'su compañero'} combinaron en una pared perfecta (${minuteLabel})`,
        duration: 1850
      }
    default:
      return null
  }
}

function calculatePlayerMatchRating(p, teamGoals = 0, oppGoals = 0) {
  const st = p.stats || {}
  let score = 6.0
  score += (st.goals || 0) * 1.25
  score += (st.assists || 0) * 0.75
  score += (st.shots?.on || 0) * 0.25
  score += (st.passes?.on || 0) * 0.05
  score += (st.dribbles || 0) * 0.2
  score += (st.blocks || 0) * 0.2
  score += (st.tackles?.standing || 0) * 0.2
  score += (st.tackles?.slides || 0) * 0.2
  score += (st.crosses?.on || 0) * 0.15
  score += (st.saves || 0) * 0.45
  score -= (st.tackles?.fouls || 0) * 0.25
  score -= (st.cards?.yellow || 0) * 0.5
  if (p.sentOff || (st.cards?.red || 0) > 0) score -= 2.5
  if (teamGoals > oppGoals) score += 0.25
  else if (teamGoals < oppGoals) score -= 0.25
  if (p.position === 'GK' && oppGoals === 0 && (st.saves || 0) > 0) score += 0.5
  return Math.max(1.0, Math.min(10.0, Number(score.toFixed(1))))
}

function getDisplayTeam(team, pendingList) {
  if (!team) return team
  const nextPlayers = team.players.map((origStarter, idx) => {
    const sub = (pendingList || []).find(s => s.starterIdx === idx)
    if (sub) {
      return {
        ...origStarter,
        isPendingSubOut: true,
        replacingBenchName: sub.incomingName
      }
    }
    return origStarter
  })
  const nextBench = (team.bench || []).map((origSub, idx) => {
    const sub = (pendingList || []).find(s => s.benchIdx === idx)
    if (sub) {
      return {
        ...origSub,
        isPendingSubIn: true,
        replacingStarterName: sub.outgoingName
      }
    }
    return origSub
  })
  return {
    ...team,
    players: nextPlayers,
    bench: nextBench
  }
}

function checkIsMatchPlayStopped(m, currentPhase, isFoulPaused, isDeadBallPaused, hasTacticalStoppage, hasVarReplay) {
  if (!m) return true
  if (currentPhase && currentPhase !== 'playing') return true
  if (isFoulPaused || isDeadBallPaused || hasTacticalStoppage || hasVarReplay) return true
  if (m.ball?.isRestart || m.ball?.isCornerKick || m.ball?.isGoalKick || m.ball?.isThrowIn || m.ball?.isPenalty) {
    return true
  }
  const tick = m.iterationCount || 0
  if (m.half === 1 && tick >= TICKS_PER_HALF) return true
  if (m.half === 2 && tick >= TICKS_PER_HALF * 2) return true
  if (m.half >= 3 && tick >= TICKS_PER_HALF * 2 + TICKS_PER_ET_HALF) return true

  const recentEvs = (m.events || []).slice(-3)
  if (recentEvs.some(e => ['foul', 'freekick', 'corner', 'throwIn', 'goalKick', 'offside', 'goal', 'penalty', 'redCard', 'injury'].includes(e.type) || e.deadBall)) {
    return true
  }

  return false
}

function drawVarReplayLines(ctx, varData, isHorizontal, W, H, padX, padY, playableW, playableH) {
  if (!varData) return
  const now = performance.now()
  const pulse = Math.sin(now / 160) * 0.15 + 0.85

  if (isHorizontal) {
    // Eje Y motor (0 a 1050) -> Eje X pantalla (padX + (Y / 1050) * playableW)
    // Eje X motor (0 a 680)  -> Eje Y pantalla (padY + (X / 680) * playableH)
    const defY = varData.defendingLineY ?? 525
    const offY = varData.targetPlayerPOS?.[1] ?? 525
    const ballPos = varData.ballPOS || [340, 525]
    const passerPos = varData.passerPOS || [340, 525]
    const targetPos = varData.targetPlayerPOS || [340, 525]

    const screenDefX = padX + (defY / 1050) * playableW
    const screenOffX = padX + (offY / 1050) * playableW

    const screenBallX = padX + (ballPos[1] / 1050) * playableW
    const screenBallY = padY + (ballPos[0] / 680) * playableH

    const screenPasserX = padX + (passerPos[1] / 1050) * playableW
    const screenPasserY = padY + (passerPos[0] / 680) * playableH

    const screenTargetX = padX + (targetPos[1] / 1050) * playableW
    const screenTargetY = padY + (targetPos[0] / 680) * playableH

    // 1. Zona sombreada de fuera de juego entre la línea defensiva y la del atacante
    const minX = Math.min(screenDefX, screenOffX)
    const spanW = Math.max(4, Math.abs(screenOffX - screenDefX))
    ctx.save()
    ctx.fillStyle = 'rgba(239, 68, 68, 0.28)'
    ctx.fillRect(minX, padY, spanW, playableH)

    // Rayas diagonales estilo VAR en la zona
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 6])
    for (let lx = minX; lx < minX + spanW + playableH; lx += 16) {
      ctx.beginPath()
      ctx.moveTo(lx, padY)
      ctx.lineTo(lx - 25, padY + playableH)
      ctx.stroke()
    }
    ctx.restore()

    // 2. Línea punteada y flecha de pase desde el pasador hacia el balón
    ctx.save()
    ctx.beginPath()
    ctx.setLineDash([5, 4])
    ctx.moveTo(screenPasserX, screenPasserY)
    ctx.lineTo(screenBallX, screenBallY)
    ctx.lineTo(screenTargetX, screenTargetY)
    ctx.strokeStyle = '#facc15'
    ctx.lineWidth = 2.5
    ctx.stroke()
    ctx.restore()

    // Círculo concéntrico de impacto en el momento del pase
    ctx.save()
    ctx.beginPath()
    ctx.arc(screenBallX, screenBallY, 12 * pulse, 0, Math.PI * 2)
    ctx.strokeStyle = '#facc15'
    ctx.lineWidth = 2.5
    ctx.stroke()
    ctx.font = 'bold 10px "Chakra Petch", sans-serif'
    ctx.fillStyle = '#facc15'
    ctx.textAlign = 'center'
    ctx.fillText('MOMENTO DEL IMPACTO', screenBallX, Math.max(padY + 16, screenBallY - 16))
    ctx.restore()

    // 3. Línea AZUL del penúltimo defensor
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(screenDefX, padY)
    ctx.lineTo(screenDefX, padY + playableH)
    ctx.strokeStyle = '#38bdf8'
    ctx.lineWidth = 3
    ctx.shadowColor = '#0284c7'
    ctx.shadowBlur = 10
    ctx.stroke()

    // Badge de la línea defensiva
    ctx.fillStyle = '#0284c7'
    ctx.fillRect(screenDefX - 70, padY + 12, 140, 20)
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1
    ctx.strokeRect(screenDefX - 70, padY + 12, 140, 20)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 9.5px "Chakra Petch", sans-serif'
    ctx.textAlign = 'center'
    const defLastName = varData.secondLastDefenderName ? varData.secondLastDefenderName.split(' ').pop() : 'DEF'
    ctx.fillText(`LÍNEA DEFENSIVA (${defLastName})`, screenDefX, padY + 25)
    ctx.restore()

    // 4. Línea ROJA del atacante en offside
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(screenOffX, padY)
    ctx.lineTo(screenOffX, padY + playableH)
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 3.5
    ctx.shadowColor = '#dc2626'
    ctx.shadowBlur = 12
    ctx.stroke()

    // Badge del jugador en offside
    ctx.fillStyle = '#dc2626'
    ctx.fillRect(screenOffX - 80, padY + playableH - 32, 160, 22)
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1
    ctx.strokeRect(screenOffX - 80, padY + playableH - 32, 160, 22)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 10px "Chakra Petch", sans-serif'
    ctx.textAlign = 'center'
    const offLastName = varData.targetPlayerName ? varData.targetPlayerName.split(' ').pop() : 'DEL'
    ctx.fillText(`🚩 OFFSIDE: ${offLastName}`, screenOffX, padY + playableH - 18)
    ctx.restore()

    // 5. Marca de cámara lenta TV VAR en esquina
    ctx.save()
    ctx.fillStyle = 'rgba(0, 0, 0, 0.82)'
    ctx.fillRect(padX + 10, padY + 10, 260, 40)
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 1.5
    ctx.strokeRect(padX + 10, padY + 10, 260, 40)
    ctx.fillStyle = '#ef4444'
    ctx.beginPath(); ctx.arc(padX + 24, padY + 30, 6, 0, Math.PI * 2); ctx.fill()
    ctx.font = 'bold 11px "Chakra Petch", sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'left'
    ctx.fillText('VAR 3D • REPETICIÓN CÁMARA LENTA', padX + 36, padY + 24)
    ctx.font = '9.5px sans-serif'
    ctx.fillStyle = '#cbd5e1'
    ctx.fillText(`Pase: ${varData.passerName || 'Compañero'} ➔ Adelantado: ${varData.targetPlayerName || 'Atacante'}`, padX + 36, padY + 40)
    ctx.restore()
  } else {
    // Eje vertical
    const defY = varData.defendingLineY ?? 525
    const offY = varData.targetPlayerPOS?.[1] ?? 525
    const ballPos = varData.ballPOS || [340, 525]
    const passerPos = varData.passerPOS || [340, 525]
    const targetPos = varData.targetPlayerPOS || [340, 525]

    const screenDefY = padY + (defY / 1050) * playableH
    const screenOffY = padY + (offY / 1050) * playableH

    const screenBallX = padX + (ballPos[0] / 680) * playableW
    const screenBallY = padY + (ballPos[1] / 1050) * playableH

    const screenPasserX = padX + (passerPos[0] / 680) * playableW
    const screenPasserY = padY + (passerPos[1] / 1050) * playableH

    const screenTargetX = padX + (targetPos[0] / 680) * playableW
    const screenTargetY = padY + (targetPos[1] / 1050) * playableH

    const minY = Math.min(screenDefY, screenOffY)
    const spanH = Math.max(4, Math.abs(screenOffY - screenDefY))

    ctx.save()
    ctx.fillStyle = 'rgba(239, 68, 68, 0.28)'
    ctx.fillRect(padX, minY, playableW, spanH)
    ctx.restore()

    ctx.save()
    ctx.beginPath()
    ctx.setLineDash([5, 4])
    ctx.moveTo(screenPasserX, screenPasserY)
    ctx.lineTo(screenBallX, screenBallY)
    ctx.lineTo(screenTargetX, screenTargetY)
    ctx.strokeStyle = '#facc15'
    ctx.lineWidth = 2.5
    ctx.stroke()
    ctx.restore()

    // Círculo de impacto
    ctx.save()
    ctx.beginPath()
    ctx.arc(screenBallX, screenBallY, 12 * pulse, 0, Math.PI * 2)
    ctx.strokeStyle = '#facc15'
    ctx.lineWidth = 2.5
    ctx.stroke()
    ctx.restore()

    // Línea AZUL defensiva
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(padX, screenDefY)
    ctx.lineTo(padX + playableW, screenDefY)
    ctx.strokeStyle = '#38bdf8'
    ctx.lineWidth = 3
    ctx.shadowColor = '#0284c7'
    ctx.shadowBlur = 10
    ctx.stroke()
    ctx.restore()

    // Línea ROJA offside
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(padX, screenOffY)
    ctx.lineTo(padX + playableW, screenOffY)
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 3.5
    ctx.shadowColor = '#dc2626'
    ctx.shadowBlur = 12
    ctx.stroke()

    // Badge del jugador en offside vertical
    ctx.fillStyle = '#dc2626'
    ctx.fillRect(padX + playableW - 170, screenOffY - 11, 160, 22)
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1
    ctx.strokeRect(padX + playableW - 170, screenOffY - 11, 160, 22)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 10px "Chakra Petch", sans-serif'
    ctx.textAlign = 'center'
    const offLastNameV = varData.targetPlayerName ? varData.targetPlayerName.split(' ').pop() : 'DEL'
    ctx.fillText(`🚩 OFFSIDE: ${offLastNameV}`, padX + playableW - 90, screenOffY + 4)
    ctx.restore()

    // Badge de línea defensiva vertical
    ctx.save()
    ctx.fillStyle = '#0284c7'
    ctx.fillRect(padX + 10, screenDefY - 11, 150, 22)
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1
    ctx.strokeRect(padX + 10, screenDefY - 11, 150, 22)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 9.5px "Chakra Petch", sans-serif'
    ctx.textAlign = 'center'
    const defLastNameV = varData.secondLastDefenderName ? varData.secondLastDefenderName.split(' ').pop() : 'DEF'
    ctx.fillText(`LÍNEA DEFENSIVA (${defLastNameV})`, padX + 85, screenDefY + 4)
    ctx.restore()
  }
}

function renderVarFreezePlayersH(ctx, varData, kickOffTeam, secondTeam, W, H, padX, padY, playableW, playableH) {
  if (!varData?.playersSnapshot) return
  const { attacking = [], defending = [] } = varData.playersSnapshot
  const attackingTeamIsKO = kickOffTeam.players.some(p => p.playerID === varData.passerID || p.playerID === varData.targetPlayerID)
  const atkPrimary = (attackingTeamIsKO ? kickOffTeam.primaryColor : secondTeam.primaryColor) || '#1d4ed8'
  const atkSecondary = (attackingTeamIsKO ? kickOffTeam.secondaryColor : secondTeam.secondaryColor) || '#facc15'
  const defPrimary = (attackingTeamIsKO ? secondTeam.primaryColor : kickOffTeam.primaryColor) || '#dc2626'
  const defSecondary = (attackingTeamIsKO ? secondTeam.secondaryColor : kickOffTeam.secondaryColor) || '#ffffff'

  const drawGroup = (players, primary, secondary) => {
    players.forEach(p => {
      if (!Array.isArray(p.pos) || p.pos[0] === 'NP') return
      const targetEX = Number(p.pos[0]) || 0
      const targetEY = Number(p.pos[1]) || 0
      const rawHX = padX + (targetEY / 1050) * playableW
      const rawHY = padY + (targetEX / 680) * playableH
      const x = Math.max(padX + 6, Math.min(W - padX - 6, rawHX))
      const y = Math.max(padY + 6, Math.min(H - padY - 6, rawHY))

      if (p.isPasser) {
        ctx.save()
        ctx.beginPath()
        ctx.arc(x, y, 23, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(250, 204, 21, 0.35)'
        ctx.fill()
        ctx.strokeStyle = '#facc15'
        ctx.lineWidth = 2.5
        ctx.stroke()
        ctx.font = 'bold 9px "Chakra Petch", sans-serif'
        ctx.fillStyle = '#facc15'
        ctx.textAlign = 'center'
        ctx.fillText('PASADOR', x, y - 25)
        ctx.restore()
      } else if (p.isTarget) {
        ctx.save()
        ctx.beginPath()
        ctx.arc(x, y, 24, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(239, 68, 68, 0.40)'
        ctx.fill()
        ctx.strokeStyle = '#ef4444'
        ctx.lineWidth = 3
        ctx.stroke()
        ctx.font = 'bold 9.5px "Chakra Petch", sans-serif'
        ctx.fillStyle = '#ef4444'
        ctx.textAlign = 'center'
        ctx.fillText('🚩 EN OFFSIDE', x, y - 25)
        ctx.restore()
      } else if (p.isSecondLast) {
        ctx.save()
        ctx.beginPath()
        ctx.arc(x, y, 23, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(56, 189, 248, 0.35)'
        ctx.fill()
        ctx.strokeStyle = '#38bdf8'
        ctx.lineWidth = 2.5
        ctx.stroke()
        ctx.font = 'bold 9px "Chakra Petch", sans-serif'
        ctx.fillStyle = '#38bdf8'
        ctx.textAlign = 'center'
        ctx.fillText('ÚLTIMO DEFENSOR', x, y - 25)
        ctx.restore()
      }

      ctx.beginPath()
      ctx.arc(x, y + 4, 15.5, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.48)'
      ctx.fill()

      ctx.beginPath()
      ctx.arc(x, y, 15.5, 0, Math.PI * 2)
      ctx.fillStyle = p.role === 'GK' ? '#10b981' : primary
      ctx.fill()
      ctx.lineWidth = 3
      ctx.strokeStyle = secondary
      ctx.stroke()

      ctx.fillStyle = p.role === 'GK' ? '#052e16' : secondary
      ctx.font = 'bold 12.5px "Chakra Petch", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(p.shirtNumber || ''), x, y)

      const lastName = p.name ? p.name.split(' ').pop() : ''
      ctx.font = '700 12.5px "Chakra Petch", sans-serif'
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = 'rgba(0,0,0,0.92)'
      ctx.lineWidth = 3
      ctx.strokeText(lastName, x, y + 33)
      ctx.fillText(lastName, x, y + 33)
    })
  }

  drawGroup(defending, defPrimary, defSecondary)
  drawGroup(attacking, atkPrimary, atkSecondary)
}

function renderVarFreezePlayersV(ctx, varData, kickOffTeam, secondTeam, W, H, padX, padY, playableW, playableH) {
  if (!varData?.playersSnapshot) return
  const { attacking = [], defending = [] } = varData.playersSnapshot
  const attackingTeamIsKO = kickOffTeam.players.some(p => p.playerID === varData.passerID || p.playerID === varData.targetPlayerID)
  const atkPrimary = (attackingTeamIsKO ? kickOffTeam.primaryColor : secondTeam.primaryColor) || '#1d4ed8'
  const atkSecondary = (attackingTeamIsKO ? kickOffTeam.secondaryColor : secondTeam.secondaryColor) || '#facc15'
  const defPrimary = (attackingTeamIsKO ? secondTeam.primaryColor : kickOffTeam.primaryColor) || '#dc2626'
  const defSecondary = (attackingTeamIsKO ? secondTeam.secondaryColor : kickOffTeam.secondaryColor) || '#ffffff'

  const drawGroup = (players, primary, secondary) => {
    players.forEach(p => {
      if (!Array.isArray(p.pos) || p.pos[0] === 'NP') return
      const targetEX = Number(p.pos[0]) || 0
      const targetEY = Number(p.pos[1]) || 0
      const rawVX = padX + (targetEX / 680) * playableW
      const rawVY = padY + (targetEY / 1050) * playableH
      const x = Math.max(padX + 6, Math.min(W - padX - 6, rawVX))
      const y = Math.max(padY + 6, Math.min(H - padY - 6, rawVY))

      if (p.isPasser) {
        ctx.save()
        ctx.beginPath()
        ctx.arc(x, y, 23, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(250, 204, 21, 0.35)'
        ctx.fill()
        ctx.strokeStyle = '#facc15'
        ctx.lineWidth = 2.5
        ctx.stroke()
        ctx.font = 'bold 9px "Chakra Petch", sans-serif'
        ctx.fillStyle = '#facc15'
        ctx.textAlign = 'center'
        ctx.fillText('PASADOR', x, y - 25)
        ctx.restore()
      } else if (p.isTarget) {
        ctx.save()
        ctx.beginPath()
        ctx.arc(x, y, 24, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(239, 68, 68, 0.40)'
        ctx.fill()
        ctx.strokeStyle = '#ef4444'
        ctx.lineWidth = 3
        ctx.stroke()
        ctx.font = 'bold 9.5px "Chakra Petch", sans-serif'
        ctx.fillStyle = '#ef4444'
        ctx.textAlign = 'center'
        ctx.fillText('🚩 EN OFFSIDE', x, y - 25)
        ctx.restore()
      } else if (p.isSecondLast) {
        ctx.save()
        ctx.beginPath()
        ctx.arc(x, y, 23, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(56, 189, 248, 0.35)'
        ctx.fill()
        ctx.strokeStyle = '#38bdf8'
        ctx.lineWidth = 2.5
        ctx.stroke()
        ctx.font = 'bold 9px "Chakra Petch", sans-serif'
        ctx.fillStyle = '#38bdf8'
        ctx.textAlign = 'center'
        ctx.fillText('ÚLTIMO DEFENSOR', x, y - 25)
        ctx.restore()
      }

      ctx.beginPath()
      ctx.arc(x, y + 4, 15.5, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.48)'
      ctx.fill()

      ctx.beginPath()
      ctx.arc(x, y, 15.5, 0, Math.PI * 2)
      ctx.fillStyle = p.role === 'GK' ? '#10b981' : primary
      ctx.fill()
      ctx.lineWidth = 3
      ctx.strokeStyle = secondary
      ctx.stroke()

      ctx.fillStyle = p.role === 'GK' ? '#052e16' : secondary
      ctx.font = 'bold 12.5px "Chakra Petch", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(p.shirtNumber || ''), x, y)

      const lastName = p.name ? p.name.split(' ').pop() : ''
      ctx.font = '700 12.5px "Chakra Petch", sans-serif'
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = 'rgba(0,0,0,0.92)'
      ctx.lineWidth = 3
      ctx.strokeText(lastName, x, y + 33)
      ctx.fillText(lastName, x, y + 33)
    })
  }

  drawGroup(defending, defPrimary, defSecondary)
  drawGroup(attacking, atkPrimary, atkSecondary)
}

function TeamStatsBoard({ team, teamGoals, oppGoals, isLeft }) {
  if (!team || !Array.isArray(team.players)) return null
  const starters = team.players.slice(0, 11)

  return (
    <div className={`fm-team-side-panel ${isLeft ? 'left-team' : 'right-team'}`}>
      <div className="fm-team-side-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span
            className="score-kit-dot"
            style={{
              background: team.primaryColor || '#facc15',
              borderColor: team.secondaryColor || '#fff',
              width: 10,
              height: 10
            }}
          />
          <span style={{ fontWeight: 900, fontSize: '0.74rem', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>
            {team.name}
          </span>
        </div>
        <span style={{ fontSize: '0.64rem', color: '#facc15', fontWeight: 800 }}>
          {team.formation}
        </span>
      </div>

      <div className="fm-player-stat-table">
        {starters.map((p, idx) => {
          const st = p.stats || {}
          const isGK = p.position === 'GK'
          const rating = calculatePlayerMatchRating(p, teamGoals, oppGoals)
          const fitness = Math.round(p.fitness ?? 100)
          const fitColor = fitness > 65 ? '#4ade80' : (fitness > 40 ? '#facc15' : '#ef4444')
          const ratingColor = rating >= 8.0 ? '#4ade80' : (rating >= 7.0 ? '#38bdf8' : (rating >= 6.0 ? '#facc15' : (rating >= 5.0 ? '#fb923c' : '#f87171')))

          const distMeters = Math.round(st.distanceCovered || 0)
          const distDisplay = distMeters >= 1000 ? `${(distMeters / 1000).toFixed(1)}k` : `${distMeters}m`
          const passDisplay = `${st.passes?.on || 0}/${st.passes?.total || 0}`
          const shotDisplay = `${st.shots?.on || 0}/${st.shots?.total || 0}`
          const crossDisplay = `${st.crosses?.on || 0}/${st.crosses?.total || 0}`
          const standingDisplay = `${st.tackles?.standing || 0}`
          const slideDisplay = `${st.tackles?.slides || 0}`
          const blockDisplay = `${st.blocks || 0}`
          const dribbleDisplay = `${st.dribbles || 0}`
          const saveDisplay = isGK ? `${st.saves || 0}` : '-'

          const nameParts = (p.name || '').trim().split(' ')
          const shortName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : p.name

          return (
            <div key={p.playerID || p.id || idx} className="fm-player-stat-item">
              {/* Fila 1: Dorsal + Nombre + Iconos | Pase, Tiro, Distancia, Entrada, Barrida, Bloqueo, Dribbles, Centros, Atajado, Puntaje */}
              <div className="fm-player-stat-row1">
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <span style={{ color: '#94a3b8', fontWeight: 800 }}>{p.shirtNumber || (idx + 1)}</span>
                  <span style={{ fontWeight: 800, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.name}>
                    {shortName}
                  </span>
                  {p.substitutedIn && (
                    <span title={`Entró al ${p.substitutedIn.minute}' por ${p.substitutedIn.replacedName}`} style={{ color: '#22c55e', fontSize: '0.62rem', fontWeight: 900 }}>
                      ⇄
                    </span>
                  )}
                  {st.goals > 0 && <span title={`${st.goals} Goles`}>⚽{st.goals > 1 ? st.goals : ''}</span>}
                  {st.assists > 0 && <span title={`${st.assists} Asistencias`} style={{ color: '#38bdf8' }}>🅰️{st.assists > 1 ? st.assists : ''}</span>}
                  {st.cards?.yellow > 0 && <span title="Tarjeta Amarilla">🟨</span>}
                  {(p.sentOff || st.cards?.red > 0) && <span title="Tarjeta Roja">🟥</span>}
                  {(p.injuryStatus?.grade === 'knock' || p.injuryStatus?.grade === 'hurt') && <span title="Molestia física">🩹</span>}
                </div>
                <div style={{ textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>Pase</div>
                <div style={{ textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>Tiro</div>
                <div style={{ textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>Dist.</div>
                <div style={{ textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>Ent.</div>
                <div style={{ textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>Barr.</div>
                <div style={{ textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>Bloq.</div>
                <div style={{ textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>Drib.</div>
                <div style={{ textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>Cent.</div>
                <div style={{ textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>Ataj.</div>
                <div style={{ textAlign: 'center', color: '#facc15', fontWeight: 800 }}>Pts.</div>
              </div>

              {/* Fila 2: Fisico (barra + %) | Valores correspondientes */}
              <div className="fm-player-stat-row2">
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <span style={{ fontSize: '0.52rem', color: '#64748b', fontWeight: 800 }}>Fís</span>
                  <div style={{ flex: 1, height: '4px', background: '#09152b', borderRadius: '2px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ width: `${fitness}%`, height: '100%', background: fitColor, transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ fontSize: '0.54rem', fontWeight: 800, color: fitColor, minWidth: '20px', textAlign: 'right' }}>
                    {fitness}%
                  </span>
                </div>
                <div style={{ textAlign: 'center', color: '#f1f5f9' }}>{passDisplay}</div>
                <div style={{ textAlign: 'center', color: '#f1f5f9' }}>{shotDisplay}</div>
                <div style={{ textAlign: 'center', color: '#cbd5e1' }}>{distDisplay}</div>
                <div style={{ textAlign: 'center', color: '#f1f5f9' }}>{standingDisplay}</div>
                <div style={{ textAlign: 'center', color: '#f1f5f9' }}>{slideDisplay}</div>
                <div style={{ textAlign: 'center', color: '#f1f5f9' }}>{blockDisplay}</div>
                <div style={{ textAlign: 'center', color: '#f1f5f9' }}>{dribbleDisplay}</div>
                <div style={{ textAlign: 'center', color: '#f1f5f9' }}>{crossDisplay}</div>
                <div style={{ textAlign: 'center', color: isGK ? '#4ade80' : '#64748b' }}>{saveDisplay}</div>
                <div style={{ textAlign: 'center', fontWeight: 900, color: ratingColor }}>{rating.toFixed(1)}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
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
  const [foulOverlay, setFoulOverlay] = useState(null)
  const [deadBallOverlay, setDeadBallOverlay] = useState(null)
  const [varReplay, setVarReplay] = useState(null)
  const [tacticalStoppage, setTacticalStoppage] = useState(null)
  const [pitchOrientation, setPitchOrientation] = useState('horizontal') // 'horizontal' | 'vertical'
  const [showDetailPanels, setShowDetailPanels] = useState(false)
  const [penaltyWinner, setPenaltyWinner] = useState(null)
  const [soundMuted, setSoundMuted] = useState(false)
  const [pendingSubs, setPendingSubs] = useState([])
  const pendingSubsRef = useRef([])
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
  const commentsScrollRef = useRef(null)
  const handleScrollComments = (direction) => {
    if (commentsScrollRef.current) {
      const delta = direction === 'up' ? -150 : 150
      commentsScrollRef.current.scrollBy({ top: delta, behavior: 'smooth' })
    }
  }
  const commTrackerRef = useRef({ lastCommentTick: 0 })
  const commentaryQueueRef = useRef([])
  const bannerTimeoutRef = useRef(null)
  const varTimeoutRef = useRef(null)
  const varReplayRef = useRef(null)
  const handledStoppagesRef = useRef(new Set())
  const isFoulPausedRef = useRef(false)
  const isDeadBallPausedRef = useRef(false)
  const goalAnimRef = useRef({ time: 0, goalSide: null })
  const animStateRef = useRef({
    startTime: performance.now(),
    durationMs: 145,
    lastBallTrail: []
  })

  // Limpieza total del estado y overlay de revisión VAR
  const clearVarReplay = useCallback(() => {
    if (varTimeoutRef.current) {
      clearTimeout(varTimeoutRef.current)
      varTimeoutRef.current = null
    }
    varReplayRef.current = null
    setVarReplay(null)
    isDeadBallPausedRef.current = false
  }, [])

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
      m.pendingSubstitutions = []
      pendingSubsRef.current = []
      setPendingSubs([])
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
    const drainInterval = speed === 'x4' ? 550 : 1350
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

  const showSubstitutionBanner = useCallback((appliedSubs, iterationCount, half) => {
    if (!appliedSubs || appliedSubs.length === 0) return
    const minLabel = formatMatchMinute(iterationCount, half)
    soundEngine.playWhistle('short')

    if (appliedSubs.length === 1) {
      const s = appliedSubs[0]
      showPitchEventBanner({
        type: 'substitution',
        icon: '🔄',
        title: `CAMBIO EN ${(s.teamName || '').toUpperCase()}`,
        subtitle: `Sale: ${s.playerOut} ⬇️  •  Entra: ${s.playerIn} ⬆️ (${minLabel})`,
        duration: 4000
      })
    } else {
      const uniqueTeamIDs = new Set(appliedSubs.map(s => s.teamID))
      if (uniqueTeamIDs.size > 1) {
        showPitchEventBanner({
          type: 'substitution',
          icon: '🔄',
          title: `CAMBIOS EN AMBOS EQUIPOS (${minLabel})`,
          subtitle: `${appliedSubs[0].teamName}: Sale ${appliedSubs[0].playerOut} ⬇️ • Entra ${appliedSubs[0].playerIn} ⬆️`,
          extraLines: appliedSubs.slice(1).map(s => `${s.teamName}: Sale ${s.playerOut} ⬇️ • Entra ${s.playerIn} ⬆️`),
          duration: 5200
        })
      } else {
        showPitchEventBanner({
          type: 'substitution',
          icon: '🔄',
          title: `CAMBIOS EN ${(appliedSubs[0].teamName || '').toUpperCase()} (${minLabel})`,
          subtitle: `1) Sale: ${appliedSubs[0].playerOut} ⬇️ • Entra: ${appliedSubs[0].playerIn} ⬆️`,
          extraLines: appliedSubs.slice(1).map((s, idx) => `${idx + 2}) Sale: ${s.playerOut} ⬇️ • Entra: ${s.playerIn} ⬆️`),
          duration: 4800
        })
      }
    }
  }, [showPitchEventBanner])

  const applyPendingSubstitutions = useCallback((m) => {
    const currentPending = m.pendingSubstitutions || pendingSubsRef.current || []
    if (!currentPending || currentPending.length === 0) return m

    const appliedSubs = []
    for (const sub of currentPending) {
      try {
        const prevLen = (m.events || []).length
        m = makeSubstitution(m, sub.teamKey, sub.starterIdx, sub.benchIdx)
        const newEvs = (m.events || []).slice(prevLen)
        const subEv = newEvs.find(e => e.type === 'substitution')
        if (subEv) {
          appliedSubs.push(subEv)
          const minLabel = formatMatchMinute(m.iterationCount, m.half)
          const comms = generateCommentaryForIteration(m, subEv, minLabel, commTrackerRef.current)
          if (comms.length > 0) enqueueCommentary(comms)
        }
      } catch (err) {
        console.warn('No se pudo aplicar la sustitución pendiente:', err)
      }
    }

    m.pendingSubstitutions = []
    pendingSubsRef.current = []
    setPendingSubs([])

    if (appliedSubs.length > 0) {
      showSubstitutionBanner(appliedSubs, m.iterationCount, m.half)
    }

    return m
  }, [enqueueCommentary, showSubstitutionBanner])

  // Dibujar cancha Horizontal (1050x680 estilo Football Manager)
  const drawPitchHorizontal = (ctx, m, alpha = 1, now = performance.now()) => {
    const W = 1050
    const H = 680
    const padX = 35
    const padY = 22
    const playableW = W - 2 * padX
    const playableH = H - 2 * padY
    const t = Math.max(0, Math.min(1, alpha))

    ctx.clearRect(0, 0, W, H)

    // 1. Césped a franjas verticales estilo Football Manager
    const stripeCount = 16
    const stripeW = W / stripeCount
    for (let i = 0; i < stripeCount; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#15803d' : '#166534'
      ctx.fillRect(i * stripeW, 0, stripeW, H)
    }

    // 2. Líneas de cal reglamentarias
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.88)'
    ctx.lineWidth = 3
    ctx.strokeRect(padX, padY, playableW, playableH)

    // Línea de mitad de cancha y círculo central
    ctx.beginPath()
    ctx.moveTo(W / 2, padY)
    ctx.lineTo(W / 2, H - padY)
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(W / 2, H / 2, 72, 0, Math.PI * 2)
    ctx.stroke()

    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(W / 2, H / 2, 4, 0, Math.PI * 2)
    ctx.fill()

    // Áreas grandes y chicas
    const boxDepth = (175 / 1050) * playableW
    const boxSpan = (340 / 680) * playableH
    const boxTopY = (H - boxSpan) / 2
    ctx.strokeRect(padX, boxTopY, boxDepth, boxSpan)
    ctx.strokeRect(W - padX - boxDepth, boxTopY, boxDepth, boxSpan)

    const smallDepth = (70 / 1050) * playableW
    const smallSpan = (190 / 680) * playableH
    const smallTopY = (H - smallSpan) / 2
    ctx.strokeRect(padX, smallTopY, smallDepth, smallSpan)
    ctx.strokeRect(W - padX - smallDepth, smallTopY, smallDepth, smallSpan)

    // Puntos del penal
    const spotDist = (95 / 1050) * playableW
    ctx.beginPath()
    ctx.arc(padX + spotDist, H / 2, 3.5, 0, Math.PI * 2)
    ctx.arc(W - padX - spotDist, H / 2, 3.5, 0, Math.PI * 2)
    ctx.fill()

    // Córners
    const rCorner = 14
    ctx.beginPath(); ctx.arc(padX, padY, rCorner, 0, Math.PI * 0.5); ctx.stroke();
    ctx.beginPath(); ctx.arc(padX, H - padY, rCorner, Math.PI * 1.5, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(W - padX, padY, rCorner, Math.PI * 0.5, Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(W - padX, H - padY, rCorner, Math.PI, Math.PI * 1.5); ctx.stroke();

    // Nombres de equipos impresos en el césped en los laterales de los arcos
    ctx.save()
    ctx.translate(padX + 46, H / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.font = '900 24px "Chakra Petch", sans-serif'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.20)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(m.kickOffTeam.name.toUpperCase(), 0, 0)
    ctx.restore()

    ctx.save()
    ctx.translate(W - padX - 46, H / 2)
    ctx.rotate(Math.PI / 2)
    ctx.font = '900 24px "Chakra Petch", sans-serif'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.20)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(m.secondTeam.name.toUpperCase(), 0, 0)
    ctx.restore()

    // Arcos 3D y oscilación armónica amortiguada en goles (sin(18t) * e^(-2.2t) * 12)
    const goalH = (90 / 680) * playableH
    const goalTopY = (H - goalH) / 2
    const goalBottomY = goalTopY + goalH
    const netDepth = 24

    const goalElapsed = (now - (goalAnimRef.current.time || 0)) / 1000
    const isGoalVibrating = goalElapsed >= 0 && goalElapsed < 2.5
    const netVibe = isGoalVibrating ? Math.sin(18 * goalElapsed) * Math.exp(-2.2 * goalElapsed) * 12 : 0

    // Red Izquierda
    const leftNetBackX = padX - netDepth - (goalAnimRef.current.goalSide === 'left' ? netVibe : 0)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
    ctx.fillRect(leftNetBackX, goalTopY, padX - leftNetBackX, goalH)
    ctx.strokeStyle = '#facc15'
    ctx.lineWidth = 3.5
    ctx.beginPath(); ctx.moveTo(padX, goalTopY); ctx.lineTo(padX, goalBottomY); ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
    ctx.lineWidth = 1
    for (let gy = goalTopY + 7; gy < goalBottomY; gy += 7) {
      ctx.beginPath(); ctx.moveTo(padX, gy); ctx.lineTo(leftNetBackX, gy); ctx.stroke();
    }
    for (let gx = leftNetBackX + 6; gx < padX; gx += 6) {
      ctx.beginPath(); ctx.moveTo(gx, goalTopY); ctx.lineTo(gx, goalBottomY); ctx.stroke();
    }

    // Red Derecha
    const rightNetBackX = W - padX + netDepth + (goalAnimRef.current.goalSide === 'right' ? netVibe : 0)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
    ctx.fillRect(W - padX, goalTopY, rightNetBackX - (W - padX), goalH)
    ctx.strokeStyle = '#facc15'
    ctx.lineWidth = 3.5
    ctx.beginPath(); ctx.moveTo(W - padX, goalTopY); ctx.lineTo(W - padX, goalBottomY); ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
    ctx.lineWidth = 1
    for (let gy = goalTopY + 7; gy < goalBottomY; gy += 7) {
      ctx.beginPath(); ctx.moveTo(W - padX, gy); ctx.lineTo(rightNetBackX, gy); ctx.stroke();
    }
    for (let gx = W - padX + 6; gx < rightNetBackX; gx += 6) {
      ctx.beginPath(); ctx.moveTo(gx, goalTopY); ctx.lineTo(gx, goalBottomY); ctx.stroke();
    }

    // Renderizar Jugadores en orientación horizontal
    const renderTeamPlayersH = (team, prevPositions) => {
      const primary = team.primaryColor || '#1d4ed8'
      const secondary = team.secondaryColor || '#facc15'
      const captainId = Number(team.setPieces?.captainID)
      const currentIter = m.iterationCount || 0

      team.players.forEach((p, idx) => {
        if (!Array.isArray(p.currentPOS) || p.currentPOS[0] === 'NP' || p.sentOff) return
        const targetEX = Number(p.currentPOS[0]) || 0
        const targetEY = Number(p.currentPOS[1]) || 0
        const prevPos = prevPositions?.[idx]
        const startEX = (Array.isArray(prevPos) && prevPos[0] !== 'NP') ? Number(prevPos[0]) : targetEX
        const startEY = (Array.isArray(prevPos) && prevPos[0] !== 'NP') ? Number(prevPos[1]) : targetEY

        const interpEX = startEX + (targetEX - startEX) * t
        const interpEY = startEY + (targetEY - startEY) * t

        const rawHX = padX + (interpEY / 1050) * playableW
        const rawHY = padY + (interpEX / 680) * playableH

        const x = Math.max(padX + 6, Math.min(W - padX - 6, rawHX))
        const y = Math.max(padY + 6, Math.min(H - padY - 6, rawHY))

        if (!p.hasBall && p.offBallRun && p.offBallRun.untilIteration > currentIter) {
          const runTargetHX = padX + (p.offBallRun.targetY / 1050) * playableW
          const runTargetHY = padY + (p.offBallRun.targetX / 680) * playableH
          const rdx = runTargetHX - x
          const rdy = runTargetHY - y
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

        if (p.hasBall) {
          ctx.beginPath()
          ctx.arc(x, y, 22, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(250, 204, 21, 0.38)'
          ctx.fill()
          ctx.strokeStyle = '#facc15'
          ctx.lineWidth = 3
          ctx.stroke()
        }

        if (currentIter - (p.lastGambetaIter || -99) <= 6) {
          ctx.save()
          ctx.font = '900 10.5px "Chakra Petch", sans-serif'
          ctx.fillStyle = '#facc15'
          ctx.strokeStyle = '#000'
          ctx.lineWidth = 3
          ctx.strokeText('★ GAMBETA', x, y - 22)
          ctx.fillText('★ GAMBETA', x, y - 22)
          ctx.restore()
        }

        if (currentIter - (p.lastCaudilloIter || -99) <= 7) {
          ctx.save()
          ctx.font = '900 10.5px "Chakra Petch", sans-serif'
          ctx.fillStyle = '#f87171'
          ctx.strokeStyle = '#000'
          ctx.lineWidth = 3
          ctx.strokeText('🛡️ PATRÓN', x, y - 22)
          ctx.fillText('🛡️ PATRÓN', x, y - 22)
          ctx.restore()
        }

        if ((p.slideRecoveryTicks || 0) > 0) {
          ctx.save()
          ctx.beginPath()
          ctx.ellipse(x, y + 6, 22, 9, 0, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(234, 88, 12, 0.45)'
          ctx.fill()
          ctx.strokeStyle = '#ea580c'
          ctx.lineWidth = 1.5
          ctx.stroke()
          ctx.font = 'bold 9px "Chakra Petch", sans-serif'
          ctx.fillStyle = '#fb923c'
          ctx.textAlign = 'center'
          ctx.fillText('💨 AL PISO', x, y - 22)
          ctx.restore()
        }

        ctx.beginPath()
        ctx.arc(x, y + 4, 15.5, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.48)'
        ctx.fill()

        ctx.beginPath()
        ctx.arc(x, y, 15.5, 0, Math.PI * 2)
        ctx.fillStyle = p.position === 'GK' ? '#10b981' : primary
        ctx.fill()
        ctx.lineWidth = 3
        ctx.strokeStyle = secondary
        ctx.stroke()

        ctx.fillStyle = p.position === 'GK' ? '#052e16' : secondary
        ctx.font = 'bold 12.5px "Chakra Petch", sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(p.shirtNumber || ''), x, y)

        if (Number(p.id || p.playerID) === captainId) {
          ctx.fillStyle = '#facc15'
          ctx.fillRect(x + 9, y - 16, 11, 10)
          ctx.fillStyle = '#000'
          ctx.font = 'bold 9px sans-serif'
          ctx.fillText('C', x + 14.5, y - 11)
        }

        if (p.stats?.cards?.yellow > 0) {
          ctx.fillStyle = '#facc15'
          ctx.fillRect(x - 20, y - 17, 8, 11)
          ctx.strokeStyle = '#000000'
          ctx.lineWidth = 1
          ctx.strokeRect(x - 20, y - 17, 8, 11)
        }

        if (p.injuryStatus?.grade === 'knock' || p.injuryStatus?.grade === 'hurt') {
          ctx.save()
          ctx.font = '12px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('🩹', x + 16, y - 12)
          ctx.restore()
        }

        const fit = Math.max(0, Math.min(100, Number(p.fitness ?? 100)))
        const barW = 28
        ctx.fillStyle = 'rgba(0,0,0,0.68)'
        ctx.fillRect(x - barW / 2, y + 18, barW, 4)
        ctx.fillStyle = fit > 65 ? '#4ade80' : (fit > 40 ? '#facc15' : '#ef4444')
        ctx.fillRect(x - barW / 2, y + 18, (barW * fit) / 100, 4)

        const lastName = p.name.split(' ').slice(-1)[0]
        const yellowTag = p.stats?.cards?.yellow > 0 ? ' 🟨' : ''
        const injuryTag = (p.injuryStatus?.grade === 'knock' || p.injuryStatus?.grade === 'hurt') ? ' 🩹' : ''
        const displayName = lastName + yellowTag + injuryTag
        ctx.font = '700 12.5px "Chakra Petch", sans-serif'
        ctx.fillStyle = '#ffffff'
        ctx.strokeStyle = 'rgba(0,0,0,0.92)'
        ctx.lineWidth = 3
        ctx.strokeText(displayName, x, y + 33)
        ctx.fillText(displayName, x, y + 33)
      })
    }

    const activeVarH = varReplayRef.current || varReplay
    const isVarReplayingH = Boolean(activeVarH?.active && activeVarH.varData?.playersSnapshot)

    if (isVarReplayingH) {
      renderVarFreezePlayersH(ctx, activeVarH.varData, m.kickOffTeam, m.secondTeam, W, H, padX, padY, playableW, playableH)
    } else {
      renderTeamPlayersH(m.kickOffTeam, m.prevSnapshot?.kickOffTeam)
      renderTeamPlayersH(m.secondTeam, m.prevSnapshot?.secondTeam)
    }

    if (activeVarH?.active) {
      const elapsed = now - (activeVarH.startTime || 0)
      if (elapsed <= (activeVarH.durationMs || 4200)) {
        drawVarReplayLines(ctx, activeVarH.varData, true, W, H, padX, padY, playableW, playableH)
      }
    }

    // Renderizar Pelota en horizontal con penetración de red en gol
    if (m.ball && Array.isArray(m.ball.position)) {
      const varBallPos = isVarReplayingH ? (activeVarH.varData.ballPOS || activeVarH.varData.passerPOS) : null
      const targetEX = varBallPos ? Number(varBallPos[0]) : (Number(m.ball.position[0]) || 340)
      const targetEY = varBallPos ? Number(varBallPos[1]) : (Number(m.ball.position[1]) || 525)
      const targetEZ = varBallPos ? 0 : Math.max(0, Number(m.ball.position[2]) || 0)

      const prevBall = isVarReplayingH ? varBallPos : m.prevSnapshot?.ball
      const startEX = Array.isArray(prevBall) ? Number(prevBall[0]) : targetEX
      const startEY = Array.isArray(prevBall) ? Number(prevBall[1]) : targetEY
      const startEZ = Array.isArray(prevBall) ? Math.max(0, Number(prevBall[2]) || 0) : targetEZ

      let rawTargetHX = padX + (targetEY / 1050) * playableW
      let rawTargetHY = padY + (targetEX / 680) * playableH

      let rawStartHX = padX + (startEY / 1050) * playableW
      let rawStartHY = padY + (startEX / 680) * playableH

      // Si hay animación de gol, la pelota penetra 18px en la red
      if (isGoalVibrating) {
        if (goalAnimRef.current.goalSide === 'left') {
          rawTargetHX = padX - 18
          rawStartHX = Math.min(rawStartHX, padX)
        } else if (goalAnimRef.current.goalSide === 'right') {
          rawTargetHX = W - padX + 18
          rawStartHX = Math.max(rawStartHX, W - padX)
        }
      }

      const bx = rawStartHX + (rawTargetHX - rawStartHX) * t
      const by = rawStartHY + (rawTargetHY - rawStartHY) * t
      const bz = startEZ + (targetEZ - startEZ) * t

      const isInFlight = Array.isArray(m.ball.ballOverIterations) && m.ball.ballOverIterations.length > 0
      const isShot = m.ball.kickType === 'shot' || m.ball.kickType === 'freekick'
      const isPass = m.ball.kickType === 'pass' || m.ball.kickType === 'through' || m.ball.kickType === 'cross' || m.ball.kickType === 'switch'

      if (isInFlight && isShot) {
        const grad = ctx.createLinearGradient(rawStartHX, rawStartHY, bx, by)
        grad.addColorStop(0, 'rgba(239, 68, 68, 0.15)')
        grad.addColorStop(0.5, 'rgba(249, 115, 22, 0.75)')
        grad.addColorStop(1, 'rgba(250, 204, 21, 0.98)')
        ctx.save()
        ctx.beginPath()
        ctx.moveTo(rawStartHX, rawStartHY - startEZ * 0.4)
        ctx.lineTo(bx, by - bz * 0.45)
        ctx.strokeStyle = grad
        ctx.lineWidth = 6.5
        ctx.lineCap = 'round'
        ctx.stroke()
        ctx.restore()
      } else if (isInFlight && isPass) {
        ctx.save()
        ctx.beginPath()
        ctx.setLineDash([4, 4])
        ctx.moveTo(rawStartHX, rawStartHY)
        ctx.lineTo(bx, by)
        ctx.strokeStyle = (m.ball.kickType === 'cross' || m.ball.kickType === 'switch')
          ? 'rgba(56, 189, 248, 0.75)'
          : 'rgba(255, 255, 255, 0.52)'
        ctx.lineWidth = m.ball.kickType === 'switch' ? 2.6 : 2.2
        ctx.stroke()
        ctx.restore()
      }

      ctx.beginPath()
      ctx.arc(bx + Math.min(12, bz * 0.4), by + 3 + Math.min(14, bz * 0.5), Math.max(4, 6 - bz * 0.08), 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
      ctx.fill()

      const ballRadius = Math.min(10.5, (isShot && isInFlight ? 7.4 : 6.2) + bz * 0.12)
      ctx.beginPath()
      ctx.arc(bx, by - Math.min(18, bz * 0.45), ballRadius, 0, Math.PI * 2)
      ctx.fillStyle = (isShot && isInFlight) ? '#fde047' : '#ffffff'
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = (isShot && isInFlight) ? '#dc2626' : '#090d16'
      ctx.stroke()
    }
  }

  // Dibujar cancha 2D Vertical tradicional (PC Fútbol)
  const drawPitchVertical = (ctx, m, alpha = 1, now = performance.now()) => {
    const [W, H, goalW] = m.pitchSize
    const t = Math.max(0, Math.min(1, alpha))

    ctx.clearRect(0, 0, W, H)

    // 1. Césped a franjas estilo PC Fútbol
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

    // Áreas grandes y chicas
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

    // Arcos 3D y oscilación armónica amortiguada en goles vertical
    const goalElapsedV = (now - (goalAnimRef.current.time || 0)) / 1000
    const isGoalVibratingV = goalElapsedV >= 0 && goalElapsedV < 2.5
    const netVibeV = isGoalVibratingV ? Math.sin(18 * goalElapsedV) * Math.exp(-2.2 * goalElapsedV) * 10 : 0

    const gLeft = (W - goalW) / 2
    const topNetY = Math.max(0, 2 - (goalAnimRef.current.goalSideV === 'top' ? netVibeV : 0))
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)'
    ctx.fillRect(gLeft, topNetY, goalW, pad - topNetY)
    ctx.strokeStyle = '#facc15'
    ctx.lineWidth = 3.5
    ctx.strokeRect(gLeft, pad - 2, goalW, 2)

    const bottomNetY = Math.min(H, H - 2 + (goalAnimRef.current.goalSideV === 'bottom' ? netVibeV : 0))
    ctx.fillRect(gLeft, H - pad, goalW, bottomNetY - (H - pad))
    ctx.strokeRect(gLeft, H - pad, goalW, 2)

    const renderTeamPlayersV = (team, prevPositions) => {
      const primary = team.primaryColor || '#1d4ed8'
      const secondary = team.secondaryColor || '#facc15'
      const captainId = Number(team.setPieces?.captainID)
      const currentIter = m.iterationCount || 0

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

        if (p.hasBall) {
          ctx.beginPath()
          ctx.arc(x, y, 22, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(250, 204, 21, 0.38)'
          ctx.fill()
          ctx.strokeStyle = '#facc15'
          ctx.lineWidth = 3
          ctx.stroke()
        }

        if (currentIter - (p.lastGambetaIter || -99) <= 6) {
          ctx.save()
          ctx.font = '900 10.5px "Chakra Petch", sans-serif'
          ctx.fillStyle = '#facc15'
          ctx.strokeStyle = '#000'
          ctx.lineWidth = 3
          ctx.strokeText('★ GAMBETA', x, y - 22)
          ctx.fillText('★ GAMBETA', x, y - 22)
          ctx.restore()
        }

        if (currentIter - (p.lastCaudilloIter || -99) <= 7) {
          ctx.save()
          ctx.font = '900 10.5px "Chakra Petch", sans-serif'
          ctx.fillStyle = '#f87171'
          ctx.strokeStyle = '#000'
          ctx.lineWidth = 3
          ctx.strokeText('🛡️ PATRÓN', x, y - 22)
          ctx.fillText('🛡️ PATRÓN', x, y - 22)
          ctx.restore()
        }

        if ((p.slideRecoveryTicks || 0) > 0) {
          ctx.save()
          ctx.beginPath()
          ctx.ellipse(x, y + 6, 22, 9, 0, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(234, 88, 12, 0.45)'
          ctx.fill()
          ctx.strokeStyle = '#ea580c'
          ctx.lineWidth = 1.5
          ctx.stroke()
          ctx.font = 'bold 9px "Chakra Petch", sans-serif'
          ctx.fillStyle = '#fb923c'
          ctx.textAlign = 'center'
          ctx.fillText('💨 AL PISO', x, y - 22)
          ctx.restore()
        }

        ctx.beginPath()
        ctx.arc(x, y + 4, 15.5, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.48)'
        ctx.fill()

        ctx.beginPath()
        ctx.arc(x, y, 15.5, 0, Math.PI * 2)
        ctx.fillStyle = p.position === 'GK' ? '#10b981' : primary
        ctx.fill()
        ctx.lineWidth = 3
        ctx.strokeStyle = secondary
        ctx.stroke()

        ctx.fillStyle = p.position === 'GK' ? '#052e16' : secondary
        ctx.font = 'bold 12.5px "Chakra Petch", sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(p.shirtNumber || ''), x, y)

        if (Number(p.id || p.playerID) === captainId) {
          ctx.fillStyle = '#facc15'
          ctx.fillRect(x + 9, y - 16, 11, 10)
          ctx.fillStyle = '#000'
          ctx.font = 'bold 9px sans-serif'
          ctx.fillText('C', x + 14.5, y - 11)
        }

        if (p.stats?.cards?.yellow > 0) {
          ctx.fillStyle = '#facc15'
          ctx.fillRect(x - 18, y - 16, 7, 10)
        }

        const fit = Math.max(0, Math.min(100, Number(p.fitness ?? 100)))
        const barW = 28
        ctx.fillStyle = 'rgba(0,0,0,0.68)'
        ctx.fillRect(x - barW / 2, y + 18, barW, 4)
        ctx.fillStyle = fit > 65 ? '#4ade80' : (fit > 40 ? '#facc15' : '#ef4444')
        ctx.fillRect(x - barW / 2, y + 18, (barW * fit) / 100, 4)

        const lastName = p.name.split(' ').slice(-1)[0]
        ctx.font = '700 13px "Chakra Petch", sans-serif'
        ctx.fillStyle = '#ffffff'
        ctx.strokeStyle = 'rgba(0,0,0,0.92)'
        ctx.lineWidth = 3
        ctx.strokeText(lastName, x, y + 33)
        ctx.fillText(lastName, x, y + 33)
      })
    }

    const activeVarV = varReplayRef.current || varReplay
    const isVarReplayingV = Boolean(activeVarV?.active && activeVarV.varData?.playersSnapshot)

    if (isVarReplayingV) {
      renderVarFreezePlayersV(ctx, activeVarV.varData, m.kickOffTeam, m.secondTeam, W, H, padX, padY, playableW, playableH)
    } else {
      renderTeamPlayersV(m.kickOffTeam, m.prevSnapshot?.kickOffTeam)
      renderTeamPlayersV(m.secondTeam, m.prevSnapshot?.secondTeam)
    }

    if (activeVarV?.active) {
      const elapsed = now - (activeVarV.startTime || 0)
      if (elapsed <= (activeVarV.durationMs || 4200)) {
        drawVarReplayLines(ctx, activeVarV.varData, false, W, H, padX, padY, playableW, playableH)
      }
    }

    if (m.ball && Array.isArray(m.ball.position)) {
      const varBallPosV = isVarReplayingV ? (activeVarV.varData.ballPOS || activeVarV.varData.passerPOS) : null
      const targetBX = varBallPosV ? (padX + (Number(varBallPosV[0]) / 680) * playableW) : (Number(m.ball.position[0]) || W / 2)
      const targetBY = varBallPosV ? (padY + (Number(varBallPosV[1]) / 1050) * playableH) : (Number(m.ball.position[1]) || H / 2)
      const targetBZ = varBallPosV ? 0 : Math.max(0, Number(m.ball.position[2]) || 0)

      const prevBall = isVarReplayingV ? [targetBX, targetBY, 0] : m.prevSnapshot?.ball
      const startBX = isVarReplayingV ? targetBX : (Array.isArray(prevBall) ? Number(prevBall[0]) : targetBX)
      const startBY = isVarReplayingV ? targetBY : (Array.isArray(prevBall) ? Number(prevBall[1]) : targetBY)
      const startBZ = isVarReplayingV ? 0 : (Array.isArray(prevBall) ? Math.max(0, Number(prevBall[2]) || 0) : targetBZ)

      const minBY = (isGoalVibratingV && goalAnimRef.current.goalSideV === 'top') ? 2 : pad
      const maxBY = (isGoalVibratingV && goalAnimRef.current.goalSideV === 'bottom') ? H - 2 : H - pad
      const bx = Math.max(pad, Math.min(W - pad, startBX + (targetBX - startBX) * t))
      const by = Math.max(minBY, Math.min(maxBY, startBY + (targetBY - startBY) * t))
      const bz = startBZ + (targetBZ - startBZ) * t

      const isInFlight = Array.isArray(m.ball.ballOverIterations) && m.ball.ballOverIterations.length > 0
      const isShot = m.ball.kickType === 'shot' || m.ball.kickType === 'freekick'
      const isPass = m.ball.kickType === 'pass' || m.ball.kickType === 'through' || m.ball.kickType === 'cross' || m.ball.kickType === 'switch'

      if (isInFlight && isShot) {
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

      ctx.beginPath()
      ctx.arc(bx + Math.min(12, bz * 0.4), by + 3 + Math.min(14, bz * 0.5), Math.max(4, 6 - bz * 0.08), 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
      ctx.fill()

      const ballRadius = Math.min(10.5, (isShot && isInFlight ? 7.4 : 6.2) + bz * 0.12)
      ctx.beginPath()
      ctx.arc(bx, by - Math.min(18, bz * 0.45), ballRadius, 0, Math.PI * 2)
      ctx.fillStyle = (isShot && isInFlight) ? '#fde047' : '#ffffff'
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = (isShot && isInFlight) ? '#dc2626' : '#090d16'
      ctx.stroke()
    }
  }

  // Despachador de renderizado con interpolación suave 60fps
  const drawPitchInterpolated = useCallback((m, alpha = 1, now = performance.now()) => {
    const canvas = canvasRef.current
    if (!canvas || !m) return
    const ctx = canvas.getContext('2d')
    if (pitchOrientation === 'horizontal') {
      drawPitchHorizontal(ctx, m, alpha, now)
    } else {
      drawPitchVertical(ctx, m, alpha, now)
    }
  }, [pitchOrientation])

  // Loop de renderizado 60fps para interpolar suavemente entre ticks
  useEffect(() => {
    let rafId
    const renderLoop = (now) => {
      const m = matchRef.current
      if (m) {
        const { startTime, durationMs } = animStateRef.current
        const alpha = durationMs > 0 ? Math.min(1, (now - startTime) / durationMs) : 1
        drawPitchInterpolated(m, alpha, now)
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
    const aiPending = (m.pendingSubstitutions || pendingSubsRef.current || []).filter(s => s.teamKey === 'secondTeam').length
    if (((aiTeam.substitutionsUsed || 0) + aiPending) >= 5) return m
    if (tick !== 1250 && tick !== 1550 && tick !== 1780 && tick !== 2150) return m

    let candidateIdx = -1
    let worstPriority = 999
    aiTeam.players.forEach((p, idx) => {
      if (idx > 0 && !p.sentOff) {
        const isAlreadyPending = (m.pendingSubstitutions || pendingSubsRef.current || []).some(s => s.teamKey === 'secondTeam' && s.starterIdx === idx)
        if (isAlreadyPending) return
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
      const isAlreadyPending = (m.pendingSubstitutions || pendingSubsRef.current || []).some(s => s.teamKey === 'secondTeam' && s.benchIdx === bIdx)
      if (isAlreadyPending) return
      const compat = getPositionCompatibility(sub, targetRole)
      const score = sub.rating * compat.factor
      if (score > bestScore) {
        bestScore = score
        bestBenchIdx = bIdx
      }
    })

    if (bestBenchIdx !== -1) {
      const pOut = aiTeam.players[candidateIdx]
      const pIn = aiTeam.bench[bestBenchIdx]
      m.pendingSubstitutions = m.pendingSubstitutions || []
      const alreadyPending = m.pendingSubstitutions.some(s => s.teamKey === 'secondTeam' && s.starterIdx === candidateIdx)
      if (!alreadyPending) {
        const newSub = {
          id: `secondTeam-${candidateIdx}-${bestBenchIdx}-${Date.now()}`,
          teamKey: 'secondTeam',
          starterIdx: candidateIdx,
          benchIdx: bestBenchIdx,
          outgoingName: pOut?.name,
          incomingName: pIn?.name,
          teamName: aiTeam.name,
          teamID: aiTeam.teamID
        }
        m.pendingSubstitutions.push(newSub)
        pendingSubsRef.current = [...(pendingSubsRef.current || []), newSub]
        setPendingSubs([...pendingSubsRef.current])
      }
      return m
    }
    return m
  }

  // Ejecutar 1 tick de partido
  const stepOneTick = useCallback(async () => {
    let m = matchRef.current
    if (!m || phase !== 'playing' || isFoulPausedRef.current || isDeadBallPausedRef.current || varReplayRef.current) return

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

    // Identificar si hubo una falta con tarjeta o penal
    const foulEv = newEventsSlice.find(e => e.type === 'foul')
    const offsideEv = newEventsSlice.find(e => e.type === 'offside')
    const redEv = newEventsSlice.find(e => e.type === 'redCard')
    const yellowEv = newEventsSlice.find(e => e.type === 'yellowCard')
    if (foulEv) {
      if (redEv) foulEv.foulCard = 'red'
      else if (yellowEv) foulEv.foulCard = 'yellow'
    }

    // Filtrar eventos redundantes: si hay 'foul' u 'offside', descartamos el evento genérico 'freekick'
    const filteredEvents = newEventsSlice.filter(ev => {
      if ((foulEv || offsideEv) && ev.type === 'freekick') return false
      return true
    })

    // Determinar si hubo pelota parada para activar transición suave y caminar (Open Football)
    const hasDeadBallEvent = filteredEvents.some(ev => ev.deadBall || ev.type === 'goal')
    const baseTickMs = speed === 'x4' ? 32 : 105
    const transitionMs = hasDeadBallEvent ? (speed === 'x4' ? 650 : 1800) : baseTickMs
    animStateRef.current = {
      startTime: performance.now(),
      durationMs: transitionMs
    }

    // Aplicar sustituciones pendientes si el juego se detuvo por falta, lateral, córner, saque de arco, gol, offside o entretiempo
    const isStoppageTick = hasDeadBallEvent ||
      filteredEvents.some(ev => ['penalty', 'foul', 'freekick', 'corner', 'throwIn', 'goalKick', 'offside', 'redCard', 'injury'].includes(ev.type)) ||
      m.ball?.isRestart ||
      (m.half === 1 && m.iterationCount >= TICKS_PER_HALF) ||
      (m.half === 2 && m.iterationCount >= TICKS_PER_HALF * 2)

    if (isStoppageTick && ((m.pendingSubstitutions && m.pendingSubstitutions.length > 0) || pendingSubsRef.current.length > 0)) {
      m = applyPendingSubstitutions(m)
    }

    // Procesar carteles superiores y efectos de sonido
    for (const ev of filteredEvents) {
      const bannerObj = buildPitchBannerFromEvent(ev, minLabel)
      if (bannerObj) showPitchEventBanner(bannerObj)

      const isDeadBall = ['goal', 'penalty', 'foul', 'freekick', 'corner', 'throwIn', 'goalKick', 'offside'].includes(ev.type) || ev.deadBall

      if (ev.type === 'goal') {
        soundEngine.playGoalRoar()
        const goalExtra = ev.goalDetail ? ` - ${ev.goalDetail}` : ''
        setGoalBanner(`¡GOOOOOL DE ${ev.teamName.toUpperCase()}! (${ev.playerName}${goalExtra})`)
        const scoringTeam = ev.teamID === m.kickOffTeam.teamID ? m.kickOffTeam : m.secondTeam
        const isAttackingBottomOrRight = (scoringTeam?.players?.[0]?.originPOS?.[1] || 0) < (m.pitchSize[1] / 2)
        const sideH = isAttackingBottomOrRight ? 'right' : 'left'
        const sideV = isAttackingBottomOrRight ? 'bottom' : 'top'
        goalAnimRef.current = { time: performance.now(), goalSide: sideH, goalSideV: sideV }
        setTimeout(() => setGoalBanner(null), 3200)
      } else if (ev.type === 'redCard' || ev.type === 'yellowCard') {
        soundEngine.playWhistle('short')
        soundEngine.playCardBeep()
      } else if (isDeadBall) {
        soundEngine.playWhistle('short')
      } else if (ev.type === 'shot') {
        soundEngine.playShotKick()
      }

      // Pausa obligatoria del partido ante expulsión o lesión grave para ajustes tácticos
      if (ev.type === 'redCard' || (ev.type === 'injury' && (ev.grade === 'serious' || !ev.canContinue))) {
        const stoppageKey = `${ev.type}-${ev.teamID}-${ev.playerName}`
        if (!handledStoppagesRef.current.has(stoppageKey)) {
          handledStoppagesRef.current.add(stoppageKey)
          setSpeed('paused')
          setTacticalStoppage({
            isRed: ev.type === 'redCard',
            playerName: ev.playerName || 'Jugador',
            teamName: ev.teamName || 'Equipo',
            teamID: ev.teamID
          })
        }
      }

      // Repetición cinematográfica en cámara lenta estilo VAR ante offside
      if (ev.type === 'offside') {
        isDeadBallPausedRef.current = true
        const varData = ev.varData || {
          passerName: ev.passerName || 'Compañero',
          targetPlayerName: ev.playerName,
          defendingLineY: m.pitchSize[1] / 2,
          ballPOS: [m.pitchSize[0] / 2, m.pitchSize[1] / 2],
          passerPOS: [m.pitchSize[0] / 2, m.pitchSize[1] / 2 + 60],
          targetPlayerPOS: [m.pitchSize[0] / 2, m.pitchSize[1] / 2 - 20]
        }
        const replayObj = {
          active: true,
          varData,
          ev,
          startTime: performance.now(),
          durationMs: speed === 'x4' ? 1800 : 4200
        }
        varReplayRef.current = replayObj
        setVarReplay(replayObj)
        const varDuration = speed === 'x4' ? 1800 : 4200
        if (varTimeoutRef.current) clearTimeout(varTimeoutRef.current)
        varTimeoutRef.current = setTimeout(() => {
          varReplayRef.current = null
          setVarReplay(null)
          // Pausa post-VAR de 2 segundos antes de reanudar la jugada
          const pauseAfterVar = speed === 'x4' ? 700 : 2000
          setTimeout(() => {
            isDeadBallPausedRef.current = false
          }, pauseAfterVar)
        }, varDuration)
      } else if (isDeadBall && ev.type !== 'redCard') {
        // Pausa reglamentaria obligatoria de 2 segundos tras el cartel explicativo (Open Football Stoppage)
        isDeadBallPausedRef.current = true
        setDeadBallOverlay({
          type: ev.type,
          icon: bannerObj?.icon || '⏱️',
          title: bannerObj?.title || 'PELOTA PARADA',
          subtitle: bannerObj?.subtitle || `${minLabel} • Reanudación del juego`
        })
        const pauseMs = speed === 'x4' ? 700 : 2000
        setTimeout(() => {
          setDeadBallOverlay(null)
          isDeadBallPausedRef.current = false
        }, pauseMs)
      }
    }

    if (newComments.length > 0) {
      enqueueCommentary(newComments)
    }

    // Verificar fin de tiempo reglamentario / entretiempo / alargue
    const tick = m.iterationCount
    if (m.half === 1 && tick >= TICKS_PER_HALF) {
      clearVarReplay()
      soundEngine.playWhistle('double')
      setPhase('halftime')
      setSpeed('paused')
    } else if (m.half === 2 && tick >= TICKS_PER_HALF * 2) {
      clearVarReplay()
      soundEngine.playWhistle('long')
      if (m.kickOffTeamStatistics.goals === m.secondTeamStatistics.goals) {
        setPhase('fulltime_tied')
        setSpeed('paused')
      } else {
        setPhase('finished')
        setSpeed('paused')
      }
    } else if (m.half === 3 && tick >= TICKS_PER_HALF * 2 + TICKS_PER_ET_HALF) {
      clearVarReplay()
      soundEngine.playWhistle('double')
      setPhase('et_break')
      setSpeed('paused')
    } else if (m.half === 4 && tick >= TICKS_PER_HALF * 2 + TICKS_PER_ET_HALF * 2) {
      clearVarReplay()
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
    const intervalMs = speed === 'x4' ? 32 : 105
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
        const newEvs = evs.slice(prevLen)
        const isStoppage = newEvs.some(e => ['goal', 'penalty', 'foul', 'freekick', 'corner', 'throwIn', 'goalKick', 'offside', 'redCard', 'injury'].includes(e.type) || e.deadBall) || m.ball?.isRestart
        if (isStoppage && ((m.pendingSubstitutions && m.pendingSubstitutions.length > 0) || pendingSubsRef.current.length > 0)) {
          m = applyPendingSubstitutions(m)
        }
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
    if ((m.pendingSubstitutions && m.pendingSubstitutions.length > 0) || pendingSubsRef.current.length > 0) {
      m = applyPendingSubstitutions(m)
    }
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
    if ((m.pendingSubstitutions && m.pendingSubstitutions.length > 0) || pendingSubsRef.current.length > 0) {
      m = applyPendingSubstitutions(m)
    }
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
    if (Array.isArray(updatedTeam?.players)) {
      updatedTeam.players.forEach((p, idx) => {
        if (!p.playerID) p.playerID = p.id || (1000000000000 + idx)
        if (!p.stats) {
          p.stats = {
            goals: 0,
            assists: 0,
            shots: { total: 0, on: 0, off: 0 },
            cards: { yellow: 0, red: 0 },
            passes: { total: 0, on: 0, off: 0 },
            crosses: { total: 0, on: 0 },
            dribbles: 0,
            blocks: 0,
            tackles: { total: 0, on: 0, off: 0, fouls: 0, slides: 0, standing: 0 },
            saves: 0,
            distanceCovered: 0
          }
        }
        if (p.action == null) p.action = 'none'
        if (p.offside == null) p.offside = false
        if (p.hasBall == null) p.hasBall = false
        if (p.sentOff == null) p.sentOff = false
      })
    }
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
    const team = m[activeTacticsTeamKey]
    if (!team || !Array.isArray(team.bench)) {
      throw new Error('El equipo no tiene banco de suplentes disponible.')
    }
    const maxSubs = team.maxSubstitutions || 5
    const alreadyUsed = team.substitutionsUsed || 0
    const teamPending = pendingSubsRef.current.filter(s => s.teamKey === activeTacticsTeamKey)
    if (alreadyUsed + teamPending.length >= maxSubs) {
      throw new Error(`Ya se realizaron o solicitaron los ${maxSubs} cambios reglamentarios.`)
    }

    const outgoing = team.players[fieldIdx]
    const incoming = team.bench[benchIdx]
    if (!outgoing || !incoming) {
      throw new Error('Jugador titular o suplente inválido.')
    }
    if (outgoing.sentOff || outgoing.currentPOS[0] === 'NP') {
      throw new Error('No se puede reemplazar a un jugador expulsado.')
    }
    if (incoming.substitutedOut) {
      throw new Error('El jugador ingresante ya fue sustituido en el partido.')
    }
    if (teamPending.some(s => s.benchIdx === benchIdx)) {
      throw new Error('Este suplente ya tiene un cambio asignado.')
    }
    if (teamPending.some(s => s.starterIdx === fieldIdx)) {
      throw new Error('Este puesto titular ya tiene un cambio asignado.')
    }

    const newSub = {
      id: `${activeTacticsTeamKey}-${fieldIdx}-${benchIdx}-${Date.now()}`,
      teamKey: activeTacticsTeamKey,
      starterIdx: fieldIdx,
      benchIdx: benchIdx,
      outgoingName: outgoing.name,
      incomingName: incoming.name,
      teamName: team.name,
      teamID: team.teamID
    }

    const nextPending = [...pendingSubsRef.current, newSub]
    pendingSubsRef.current = nextPending
    setPendingSubs(nextPending)
    m.pendingSubstitutions = nextPending
    matchRef.current = m
    setMatch({ ...m })
  }

  const handleUndoLiveSubstitution = (teamKey = activeTacticsTeamKey) => {
    let m = matchRef.current
    const current = pendingSubsRef.current
    const teamSubs = current.filter(s => s.teamKey === teamKey)
    if (teamSubs.length === 0) return

    const lastSub = teamSubs[teamSubs.length - 1]
    const nextPending = current.filter(s => s.id !== lastSub.id)
    pendingSubsRef.current = nextPending
    setPendingSubs(nextPending)
    if (m) {
      m.pendingSubstitutions = nextPending
      matchRef.current = m
      setMatch({ ...m })
    }
  }

  const handleCloseTacticsModal = () => {
    setShowTacticsModal(false)
    let m = matchRef.current
    if (!m) return
    const isStopped = checkIsMatchPlayStopped(m, phase, isFoulPausedRef.current, isDeadBallPausedRef.current, Boolean(tacticalStoppage), Boolean(varReplayRef.current || varReplay))
    if (isStopped && ((m.pendingSubstitutions && m.pendingSubstitutions.length > 0) || pendingSubsRef.current.length > 0)) {
      m = applyPendingSubstitutions(m)
      matchRef.current = m
      setMatch({ ...m })
    }
  }

  const displayTacticsTeam = useMemo(() => {
    if (!match) return null
    const baseTeam = match[activeTacticsTeamKey]
    const teamPending = pendingSubs.filter(s => s.teamKey === activeTacticsTeamKey)
    return getDisplayTeam(baseTeam, teamPending)
  }, [match, activeTacticsTeamKey, pendingSubs])

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
    <div className={`main-container ${pitchOrientation === 'horizontal' ? 'main-container-match-horizontal' : ''}`}>
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
            className="btn btn-outline btn-sm"
            onClick={() => setPitchOrientation(prev => prev === 'horizontal' ? 'vertical' : 'horizontal')}
            title="Cambiar orientación de la cancha"
          >
            {pitchOrientation === 'horizontal' ? '🔄 Vista Vertical' : '🔄 Vista Horizontal (FM)'}
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setSpeed('paused')
              setShowTacticsModal(true)
            }}
          >
            📋 Pizarra / Cambios ({t1.substitutionsUsed || 0}/5){pendingSubs.filter(s => s.teamKey === 'kickOffTeam').length > 0 ? ` [🔄 ${pendingSubs.filter(s => s.teamKey === 'kickOffTeam').length} en espera]` : ''}
          </button>
        </div>
      </div>

      {/* Aviso de cambios en espera de juego detenido */}
      {pendingSubs.length > 0 && (
        <div style={{
          margin: '0.45rem 0 0.85rem 0',
          background: 'rgba(15, 23, 42, 0.94)',
          border: '1px solid #0ea5e9',
          borderRadius: '6px',
          padding: '0.45rem 0.9rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.75rem',
          fontSize: '0.84rem',
          color: '#e0f2fe',
          boxShadow: '0 3px 12px rgba(0,0,0,0.35)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ color: '#38bdf8', fontWeight: 800 }}>🔄 Cambios en espera:</span>
            {pendingSubs.map(s => (
              <span key={s.id} style={{ background: 'rgba(56, 189, 248, 0.16)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.35)', fontWeight: 600 }}>
                {s.teamName}: {s.outgoingName} ⬇️ por {s.incomingName} ⬆️
              </span>
            ))}
            <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>
              • Se aplicarán automáticamente al detenerse la pelota (falta, lateral, córner, saque de arco, gol, offside o entretiempo).
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <button
              type="button"
              className="btn btn-outline btn-xs"
              style={{ borderColor: '#f59e0b', color: '#fbbf24', background: 'rgba(245, 158, 11, 0.16)', fontSize: '0.76rem', padding: '0.22rem 0.6rem', fontWeight: 700 }}
              onClick={() => handleUndoLiveSubstitution(activeTacticsTeamKey)}
              title="Deshacer el último cambio en espera"
            >
              ↩️ Deshacer cambio
            </button>
            <button
              type="button"
              className="btn btn-primary btn-xs"
              style={{ fontSize: '0.76rem', padding: '0.22rem 0.6rem' }}
              onClick={() => {
                setSpeed('paused')
                setShowTacticsModal(true)
              }}
            >
              📋 Ver Pizarra
            </button>
          </div>
        </div>
      )}

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
      {/* Visualización del Partido: Horizontal FM (por defecto) o Vertical Tradicional */}
      {pitchOrientation === 'horizontal' ? (
        <div className="fm-match-container">
          {/* 4 FM Top Cards: Formación 1 | Estadísticas comparativas | Incidencias | Formación 2 */}
          <div className="fm-top-cards">
            {/* Card 1: Team 1 */}
            <div className="fm-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <span className="score-kit-dot" style={{ background: t1.primaryColor, borderColor: t1.secondaryColor, width: 14, height: 14 }} />
                  <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#f8fafc' }}>{t1.name}</span>
                </div>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700 }}>
                  {t1.formation}
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#cbd5e1', display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                <span>Mentalidad:</span>
                <b style={{ color: t1.mentality === 'offensive' ? '#f87171' : t1.mentality === 'defensive' ? '#60a5fa' : '#4ade80' }}>
                  {t1.mentality === 'offensive' ? 'Ofensiva' : t1.mentality === 'defensive' ? 'Defensiva' : 'Equilibrada'}
                </b>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#cbd5e1', display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                <span>Estilo:</span>
                <b style={{ color: '#facc15' }}>{t1.playStyle || 'balanced'}</b>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                <span>Cambios:</span>
                <b style={{ color: '#fff' }}>{t1.substitutionsUsed || 0} / 5</b>
              </div>
            </div>

            {/* Card 2: Match Stats con barras comparativas */}
            <div className="fm-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#facc15' }}>ESTADÍSTICAS DEL PARTIDO</span>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Posesión: {poss1}% - {poss2}%</span>
              </div>
              <div className="stat-bar-track" style={{ height: '5px', marginBottom: '0.35rem' }}>
                <div style={{ width: `${poss1}%`, background: t1.primaryColor || '#facc15', transition: 'width 0.3s' }} />
                <div style={{ width: `${poss2}%`, background: t2.primaryColor || '#38bdf8', transition: 'width 0.3s' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem', fontSize: '0.72rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 4px', background: 'rgba(0,0,0,0.25)', borderRadius: '2px' }}>
                  <span style={{ color: '#94a3b8' }}>Tiros:</span>
                  <b style={{ color: '#fff' }}>{s1.shots.total}({s1.shots.on}) - {s2.shots.total}({s2.shots.on})</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 4px', background: 'rgba(0,0,0,0.25)', borderRadius: '2px' }}>
                  <span style={{ color: '#94a3b8' }}>Pases:</span>
                  <b style={{ color: '#fff' }}>{s1.passesCompleted || 0} - {s2.passesCompleted || 0}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 4px', background: 'rgba(0,0,0,0.25)', borderRadius: '2px' }}>
                  <span style={{ color: '#94a3b8' }}>Córners:</span>
                  <b style={{ color: '#fff' }}>{s1.corners} - {s2.corners}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 4px', background: 'rgba(0,0,0,0.25)', borderRadius: '2px' }}>
                  <span style={{ color: '#94a3b8' }}>Faltas:</span>
                  <b style={{ color: '#fff' }}>{s1.fouls || 0} - {s2.fouls || 0}</b>
                </div>
              </div>
            </div>

            {/* Card 3: Match Events Timeline */}
            <div className="fm-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#38bdf8' }}>INCIDENCIAS DEL ENCUENTRO</span>
                <span style={{ fontSize: '0.68rem', color: '#00ff66', fontWeight: 800 }}>● EN VIVO</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', maxHeight: '68px', overflowY: 'auto' }}>
                {(match.events || [])
                  .filter(ev => ['goal', 'yellowCard', 'redCard', 'penalty', 'sub'].includes(ev.type))
                  .slice(-4)
                  .reverse()
                  .map((ev, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.7rem', color: '#e2e8f0' }}>
                      <span>{ev.type === 'goal' ? '⚽' : ev.type === 'redCard' ? '🟥' : ev.type === 'yellowCard' ? '🟨' : ev.type === 'penalty' ? '🚨' : '🔄'}</span>
                      <span style={{ fontWeight: 800, color: '#facc15' }}>{ev.minuteLabel || `${Math.floor(ev.iteration / 22)}'`}</span>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ev.type === 'goal' ? `Gol de ${ev.playerName} (${ev.teamName})` : `${ev.playerName} (${ev.teamName})`}
                      </span>
                    </div>
                  ))}
                {(!match.events || match.events.filter(ev => ['goal', 'yellowCard', 'redCard', 'penalty', 'sub'].includes(ev.type)).length === 0) && (
                  <span style={{ fontSize: '0.7rem', color: '#64748b', fontStyle: 'italic', paddingTop: '6px' }}>
                    Sin incidencias clave hasta el momento...
                  </span>
                )}
              </div>
            </div>

            {/* Card 4: Team 2 */}
            <div className="fm-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <span className="score-kit-dot" style={{ background: t2.primaryColor, borderColor: t2.secondaryColor, width: 14, height: 14 }} />
                  <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#f8fafc' }}>{t2.name}</span>
                </div>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700 }}>
                  {t2.formation}
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#cbd5e1', display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                <span>Mentalidad:</span>
                <b style={{ color: t2.mentality === 'offensive' ? '#f87171' : t2.mentality === 'defensive' ? '#60a5fa' : '#4ade80' }}>
                  {t2.mentality === 'offensive' ? 'Ofensiva' : t2.mentality === 'defensive' ? 'Defensiva' : 'Equilibrada'}
                </b>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#cbd5e1', display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                <span>Estilo:</span>
                <b style={{ color: '#facc15' }}>{t2.playStyle || 'balanced'}</b>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                <span>Cambios:</span>
                <b style={{ color: '#fff' }}>{t2.substitutionsUsed || 0} / 5</b>
              </div>
            </div>
          </div>

          {/* Fila de Cancha Horizontal Central con Paneles Laterales de Plantilla y Estadísticas */}
          <div className="fm-pitch-row">
            <TeamStatsBoard
              team={t1}
              teamGoals={match?.kickOffTeamStatistics?.goals || 0}
              oppGoals={match?.secondTeamStatistics?.goals || 0}
              isLeft={true}
            />

            <div className="fm-pitch-wrapper">
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
                      {Array.isArray(pitchBanner.extraLines) && pitchBanner.extraLines.map((line, idx) => (
                        <div key={idx} style={{ fontSize: '0.72rem', opacity: 0.92, fontWeight: 700, marginTop: '2px' }}>
                          {line}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <canvas
                ref={canvasRef}
                width={1050}
                height={680}
                className={pitchOrientation === 'horizontal' ? 'pitch-canvas-horizontal' : 'pitch-canvas-vertical'}
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
                    padding: '0.85rem 1.6rem',
                    borderRadius: '4px',
                    fontFamily: 'Chakra Petch, sans-serif',
                    fontWeight: 900,
                    fontSize: '1.45rem',
                    boxShadow: '0 0 45px rgba(250, 204, 21, 0.95)',
                    border: '3px solid #fff',
                    textAlign: 'center',
                    zIndex: 40
                  }}
                >
                  ⚽ {goalBanner}
                </div>
              )}

              {varReplay && (
                <div className="var-replay-banner-overlay" style={{
                  position: 'absolute',
                  top: '14px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 150,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.8rem',
                  background: 'rgba(10, 15, 29, 0.95)',
                  border: '2px solid #ef4444',
                  boxShadow: '0 0 25px rgba(239, 68, 68, 0.55)',
                  padding: '0.65rem 1.25rem',
                  borderRadius: '4px',
                  backdropFilter: 'blur(6px)'
                }}>
                  <span style={{ fontSize: '1.5rem' }}>📺</span>
                  <div>
                    <div style={{ color: '#ef4444', fontWeight: 900, fontSize: '0.92rem', letterSpacing: '0.5px' }}>
                      REVISIÓN VAR • FUERA DE JUEGO (OFFSIDE)
                    </div>
                    <div style={{ color: '#ffffff', fontSize: '0.78rem' }}>
                      Pase de <b style={{ color: '#facc15' }}>{varReplay.varData?.passerName || 'Compañero'}</b> • Receptor adelantado: <b style={{ color: '#f87171' }}>{varReplay.varData?.targetPlayerName || 'Atacante'}</b>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    style={{ marginLeft: '0.5rem', fontSize: '0.74rem', padding: '0.25rem 0.65rem' }}
                    onClick={clearVarReplay}
                  >
                    Saltar VAR ⏭️
                  </button>
                </div>
              )}

              {deadBallOverlay && !varReplay && (
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.96) 0%, rgba(30, 41, 59, 0.96) 100%)',
                    border: '3px solid #facc15',
                    boxShadow: '0 0 45px rgba(250, 204, 21, 0.65), inset 0 0 20px rgba(0,0,0,0.85)',
                    color: '#ffffff',
                    padding: '1.2rem 2.4rem',
                    borderRadius: '8px',
                    textAlign: 'center',
                    zIndex: 50,
                    pointerEvents: 'none',
                    minWidth: '320px',
                    backdropFilter: 'blur(4px)'
                  }}
                >
                  <div style={{ fontSize: '2.2rem', marginBottom: '0.25rem' }}>
                    {deadBallOverlay.icon}
                  </div>
                  <div
                    style={{
                      fontFamily: 'Chakra Petch, sans-serif',
                      fontWeight: 900,
                      fontSize: '1.5rem',
                      letterSpacing: '0.12em',
                      color: '#facc15',
                      textShadow: '0 0 16px rgba(250, 204, 21, 0.7), 2px 2px 0px #000',
                      lineHeight: 1.1,
                      marginBottom: '0.4rem'
                    }}
                  >
                    {deadBallOverlay.title}
                  </div>
                  <div
                    style={{
                      fontFamily: 'Chakra Petch, sans-serif',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      color: '#cbd5e1',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase'
                    }}
                  >
                    {deadBallOverlay.subtitle}
                  </div>
                </div>
              )}
            </div>

            <TeamStatsBoard
              team={t2}
              teamGoals={match?.secondTeamStatistics?.goals || 0}
              oppGoals={match?.kickOffTeamStatistics?.goals || 0}
              isLeft={false}
            />
          </div>

          {/* Bottom Full-Width Commentary Ticker con Colores Dinámicos */}
          {(() => {
            const currentMsg = commentaryList[0]
            const msgType = currentMsg?.type
            let tickerDynamicClass = ''
            if (msgType === 'goal') {
              tickerDynamicClass = 'ticker-goal'
            } else if (msgType === 'yellowCard') {
              tickerDynamicClass = 'ticker-yellow'
            } else if (msgType === 'redCard') {
              tickerDynamicClass = 'ticker-red'
            } else if (msgType === 'injury') {
              tickerDynamicClass = 'ticker-injury'
            }

            return (
              <div className={`fm-ticker-bar ${tickerDynamicClass}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: '220px' }}>
                  <span style={{ fontSize: '1.25rem' }}>🎙️</span>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{
                        background: COMMENTARY_BADGES[msgType]?.bg || '#475569',
                        color: COMMENTARY_BADGES[msgType]?.color || '#fff',
                        fontSize: '0.62rem',
                        fontWeight: 900,
                        padding: '1px 5px',
                        borderRadius: '2px'
                      }}>
                        {COMMENTARY_BADGES[msgType]?.label || 'RELATO'}
                      </span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'inherit' }}>
                        {currentMsg?.speaker || 'Marcelo Araujo'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="ticker-text" style={{ flex: 1, padding: '0 1rem', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontSize: '0.92rem', fontWeight: 600 }}>
                  <span className="ticker-min" style={{ fontFamily: 'VT323, monospace', fontSize: '1.2rem', color: msgType === 'yellowCard' ? '#854d0e' : (msgType === 'redCard' || msgType === 'injury' ? '#fff' : '#16a34a'), fontWeight: 900, marginRight: '0.45rem' }}>
                    [{formatMatchMinute(match.iterationCount, match.half)}]
                  </span>
                  {currentMsg?.text || 'El árbitro da la orden y la pelota sigue rodando en el campo...'}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', borderColor: 'currentColor', color: 'inherit' }}
                    onClick={() => setShowDetailPanels(prev => !prev)}
                  >
                    {showDetailPanels ? '▲ Ocultar Comentarios' : '▼ Ver Todos los Comentarios'}
                  </button>
                </div>
              </div>
            )
          })()}

          {/* Panel Desplegable de Todos los Comentarios (Historial Completo Deslizable sin Fichas) */}
          {showDetailPanels && (
            <div className="fm-comments-full-panel">
              <div className="fm-comments-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h3 style={{ color: '#facc15', fontSize: '0.95rem', margin: 0, fontWeight: 900 }}>
                    🎙️ CABINA COMPLETA DE TRANSMISIÓN — MARCELO ARAUJO & ENRIQUE MACAYA MÁRQUEZ
                  </h3>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                    ({commentaryList.length} relatos emitidos)
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem' }}
                    onClick={() => handleScrollComments('up')}
                    title="Deslizar arriba"
                  >
                    ▲ Deslizar
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem' }}
                    onClick={() => handleScrollComments('down')}
                    title="Deslizar abajo"
                  >
                    ▼ Deslizar
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', background: '#334155', color: '#f8fafc' }}
                    onClick={() => setShowDetailPanels(false)}
                  >
                    ✕ Cerrar
                  </button>
                </div>
              </div>

              <div ref={commentsScrollRef} className="fm-comments-scroll-area">
                {commentaryList.map((item) => (
                  <div key={item.id} className={`commentary-item type-${item.type}`} style={{ padding: '0.4rem 0.65rem' }}>
                    <div className="commentary-speaker" style={{ marginBottom: '0.15rem' }}>
                      <span style={{ color: (item.speaker || '').includes('Araujo') ? '#facc15' : '#38bdf8', fontWeight: 800 }}>
                        {item.speaker}
                      </span>
                      <span className="led-font" style={{ color: '#00ff66', fontSize: '0.92rem' }}>{item.minute}</span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#f1f5f9', lineHeight: 1.35 }}>{item.text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="match-layout-grid">
          {/* Cancha 2D Vertical tradicional */}
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
                    {Array.isArray(pitchBanner.extraLines) && pitchBanner.extraLines.map((line, idx) => (
                      <div key={idx} style={{ fontSize: '0.72rem', opacity: 0.92, fontWeight: 700, marginTop: '2px' }}>
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <canvas
              ref={canvasRef}
              width={PITCH_CONFIG.pitchWidth}
              height={PITCH_CONFIG.pitchHeight}
              className={pitchOrientation === 'horizontal' ? 'pitch-canvas-horizontal' : 'pitch-canvas-vertical'}
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

            {varReplay && (
              <div className="var-replay-banner-overlay" style={{
                position: 'absolute',
                top: '14px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 150,
                display: 'flex',
                alignItems: 'center',
                gap: '0.8rem',
                background: 'rgba(10, 15, 29, 0.95)',
                border: '2px solid #ef4444',
                boxShadow: '0 0 25px rgba(239, 68, 68, 0.55)',
                padding: '0.65rem 1.25rem',
                borderRadius: '4px',
                backdropFilter: 'blur(6px)'
              }}>
                <span style={{ fontSize: '1.5rem' }}>📺</span>
                <div>
                  <div style={{ color: '#ef4444', fontWeight: 900, fontSize: '0.92rem', letterSpacing: '0.5px' }}>
                    REVISIÓN VAR • FUERA DE JUEGO (OFFSIDE)
                  </div>
                  <div style={{ color: '#ffffff', fontSize: '0.78rem' }}>
                    Pase de <b style={{ color: '#facc15' }}>{varReplay.varData?.passerName || 'Compañero'}</b> • Receptor adelantado: <b style={{ color: '#f87171' }}>{varReplay.varData?.targetPlayerName || 'Atacante'}</b>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  style={{ marginLeft: '0.5rem', fontSize: '0.74rem', padding: '0.25rem 0.65rem' }}
                  onClick={clearVarReplay}
                >
                  Saltar VAR ⏭️
                </button>
              </div>
            )}

            {deadBallOverlay && !varReplay && (
              <div
                style={{
                  position: 'absolute',
                  top: '48%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.96) 0%, rgba(30, 41, 59, 0.96) 100%)',
                  border: '3px solid #facc15',
                  boxShadow: '0 0 45px rgba(250, 204, 21, 0.55), inset 0 0 20px rgba(0,0,0,0.85)',
                  color: '#ffffff',
                  padding: '1.25rem 2.5rem',
                  borderRadius: '8px',
                  textAlign: 'center',
                  zIndex: 50,
                  pointerEvents: 'none',
                  minWidth: '300px',
                  backdropFilter: 'blur(4px)'
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: '0.2rem' }}>
                  {deadBallOverlay.icon}
                </div>
                <div
                  style={{
                    fontFamily: 'Chakra Petch, sans-serif',
                    fontWeight: 900,
                    fontSize: '1.6rem',
                    letterSpacing: '0.14em',
                    color: '#facc15',
                    textShadow: '0 0 16px rgba(250, 204, 21, 0.7), 2px 2px 0px #000',
                    lineHeight: 1.1,
                    marginBottom: '0.35rem'
                  }}
                >
                  {deadBallOverlay.title}
                </div>
                <div
                  style={{
                    fontFamily: 'Chakra Petch, sans-serif',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    color: '#cbd5e1',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase'
                  }}
                >
                  {deadBallOverlay.subtitle}
                </div>
              </div>
            )}
          </div>

          {/* Columna Derecha: Relatos en Vivo + Estadísticas + Estado Físico */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                            {(p.injuryStatus?.grade === 'knock' || p.injuryStatus?.grade === 'hurt') && '🩹'}
                            {p.sentOff && '🟥'}
                          </span>
                          <span style={{ color: fit > 65 ? '#4ade80' : (fit > 40 ? '#facc15' : '#ef4444'), fontWeight: 800 }}>
                            {fit}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detención Obligatoria por Expulsión o Lesión Grave */}
      {tacticalStoppage && (
        <div className="modal-backdrop" style={{ zIndex: 9999 }}>
          <div className="panel" style={{ maxWidth: '520px', width: '92%', textAlign: 'center', border: '2px solid #ef4444', boxShadow: '0 0 35px rgba(239, 68, 68, 0.6)', background: '#0a0f1d', padding: '1.8rem' }}>
            <div style={{ fontSize: '3.2rem', marginBottom: '0.4rem' }}>
              {tacticalStoppage.isRed ? '🟥' : '🚑'}
            </div>
            <h2 style={{ color: '#ef4444', fontSize: '1.35rem', textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '0.5px' }}>
              {tacticalStoppage.isRed ? '¡JUGADOR EXPULSADO CON ROJA!' : '¡LESIÓN GRAVE DE UN JUGADOR!'}
            </h2>
            <p style={{ color: '#f8fafc', fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.3rem' }}>
              {tacticalStoppage.playerName} ({tacticalStoppage.teamName})
            </p>
            <p style={{ color: '#94a3b8', fontSize: '0.84rem', lineHeight: 1.45, marginBottom: '1.4rem' }}>
              El partido se pausó automáticamente para que puedas reacomodar tu equipo, cubrir puestos vacantes (por ejemplo si expulsaron al arquero) o realizar sustituciones tácticas.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-gold btn-lg"
                onClick={() => {
                  setTacticalStoppage(null)
                  setShowTacticsModal(true)
                }}
              >
                📋 Abrir Pizarra Táctica y Cambios
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setTacticalStoppage(null)
                  setSpeed('x1')
                }}
              >
                ▶️ Reanudar Partido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Pizarra Táctica y Cambios en Vivo */}
      {showTacticsModal && (
        <div className="modal-backdrop" onClick={handleCloseTacticsModal}>
          <div className="modal-content" style={{ maxWidth: '1260px' }} onClick={(e) => e.stopPropagation()}>
            <TacticsBoard
              team={displayTacticsTeam || match[activeTacticsTeamKey]}
              onUpdateTeam={handleLiveUpdateTeam}
              isLiveMatch={true}
              onMakeLiveSubstitution={handleLiveSubstitution}
              onUndoLiveSubstitution={() => handleUndoLiveSubstitution(activeTacticsTeamKey)}
              canUndoLiveSubstitution={pendingSubs.some(s => s.teamKey === activeTacticsTeamKey)}
              pendingSubstitutionsCount={pendingSubs.filter(s => s.teamKey === activeTacticsTeamKey).length}
              isPlayStopped={checkIsMatchPlayStopped(matchRef.current, phase, isFoulPausedRef.current, isDeadBallPausedRef.current, Boolean(tacticalStoppage), Boolean(varReplayRef.current || varReplay))}
              onConfirm={handleCloseTacticsModal}
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
