import React, { useState } from 'react';
import { FORMATIONS, MENTALITIES, PLAY_STYLES, getPlayStyleConfig, getFormationCoordinates } from '../data/formations.js';
import { getPositionCompatibility, updateTeamEffectiveSkills } from '../engine/modifiers.js';
import { autoSetupTeamFromSquad } from '../draft/draftEngine.js';
import { TRAIT_DEFINITIONS } from '../data/playersDB.js';import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";

function getStatColor(val) {
  if (val >= 90) return '#facc15';
  if (val >= 80) return '#4ade80';
  if (val >= 70) return '#38bdf8';
  return '#cbd5e1';
}

function getTacticalMiniStats(player) {
  const s = player.skill || {};
  const isGK = player.position === 'GK';
  if (isGK) {
    return [
    { label: 'ATA', val: s.saving },
    { label: 'AGI', val: s.agility },
    { label: 'SAL', val: s.jumping },
    { label: 'PER', val: s.perception },
    { label: 'PAS', val: s.passing },
    { label: 'FUE', val: s.strength },
    { label: 'TL', val: s.freekick },
    { label: 'PEN', val: s.penalty_taking },
    { label: 'ALT', val: `${player.height || 185}cm`, isText: true }];

  }
  return [
  { label: 'PAS', val: s.passing },
  { label: 'TIR', val: s.shooting },
  { label: 'ENT', val: s.tackling },
  { label: 'AGI', val: s.agility },
  { label: 'FUE', val: s.strength },
  { label: 'CON', val: s.control },
  { label: 'TL', val: s.freekick },
  { label: 'PEN', val: s.penalty_taking },
  { label: 'ALT', val: `${player.height || 178}cm`, isText: true }];

}

export default function TacticsBoard({
  team,
  onUpdateTeam,
  isLiveMatch = false,
  onMakeLiveSubstitution,
  onUndoLiveSubstitution = null,
  canUndoLiveSubstitution = false,
  pendingSubstitutionsCount = 0,
  isPlayStopped = true,
  onConfirm,
  confirmLabel = 'Confirmar Pizarra e Ir a la Cancha ⚽',
  secondaryTeamTab = null // { activeTeamIndex, onSwitchTeam, team1Name, team2Name }
}) {
  // Selección para intercambiar jugadores (tipo: 'starter' | 'bench', index: number)
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const formation = FORMATIONS[team.formation] || FORMATIONS['4-4-2'];
  const mentality = MENTALITIES[team.mentality] || MENTALITIES.balanced;
  const playStyle = getPlayStyleConfig(team.playStyle, team.formation);
  const slots = getFormationCoordinates(team.formation, team.mentality, 'top');

  const recomputeCoordsAndSkills = (
  updatedTeam,
  newFormation = updatedTeam.formation,
  newMentality = updatedTeam.mentality,
  newPlayStyle = updatedTeam.playStyle) =>
  {
    const currentSide = isLiveMatch && updatedTeam.players[0]?.originPOS?.[1] > 525 ? 'bottom' : 'top';
    const coords = getFormationCoordinates(newFormation, newMentality, currentSide);
    const clonedPlayers = updatedTeam.players.map((p, idx) => {
      const slot = coords[idx] || coords[coords.length - 1];
      const copy = { ...p, tacticalRole: slot.role };
      if (copy.currentPOS?.[0] !== 'NP') {
        copy.originPOS = slot.coords.slice();
        copy.intentPOS = slot.coords.slice();
        if (!isLiveMatch) copy.currentPOS = slot.coords.slice();
      }
      return copy;
    });
    const nextTeam = {
      ...updatedTeam,
      formation: newFormation,
      mentality: newMentality,
      playStyle: newPlayStyle || FORMATIONS[newFormation]?.defaultPlayStyle || 'balanced',
      players: clonedPlayers
    };
    updateTeamEffectiveSkills(nextTeam);
    return nextTeam;
  };

  const handleFormationChange = (newFormId) => {
    setErrorMsg('');
    const recommendedStyle = FORMATIONS[newFormId]?.defaultPlayStyle || team.playStyle || 'balanced';
    onUpdateTeam(recomputeCoordsAndSkills(team, newFormId, team.mentality, recommendedStyle));
  };

  const handleMentalityChange = (newMentId) => {
    setErrorMsg('');
    onUpdateTeam(recomputeCoordsAndSkills(team, team.formation, newMentId, team.playStyle));
  };

  const handlePlayStyleChange = (newStyleId) => {
    setErrorMsg('');
    onUpdateTeam(recomputeCoordsAndSkills(team, team.formation, team.mentality, newStyleId));
  };

  const handleSetPieceChange = (key, playerId) => {
    const nextTeam = {
      ...team,
      setPieces: {
        ...team.setPieces,
        [key]: Number(playerId)
      }
    };
    updateTeamEffectiveSkills(nextTeam);
    onUpdateTeam(nextTeam);
  };

  const handleAutoOptimize = () => {
    if (isLiveMatch) return;
    const currentSide = 'top';
    const all16 = [...team.players, ...(team.bench || [])];
    const optimized = autoSetupTeamFromSquad(all16, {
      teamName: team.name,
      primaryColor: team.primaryColor,
      secondaryColor: team.secondaryColor,
      formationId: team.formation,
      mentalityId: team.mentality,
      side: currentSide
    });
    onUpdateTeam(optimized);
    setSelectedSlot(null);
    setErrorMsg('');
  };

  const handleSlotClick = (type, index) => {
    setErrorMsg('');
    if (!selectedSlot) {
      setSelectedSlot({ type, index });
      return;
    }
    if (selectedSlot.type === type && selectedSlot.index === index) {
      setSelectedSlot(null);
      return;
    }

    // Caso 1: Intercambio entre dos titulares (cambio de puesto táctico en cancha)
    if (selectedSlot.type === 'starter' && type === 'starter') {
      const idxA = selectedSlot.index;
      const idxB = index;
      const pA = team.players[idxA];
      const pB = team.players[idxB];
      const nextPlayers = [...team.players];
      nextPlayers[idxA] = { ...pB };
      nextPlayers[idxB] = { ...pA };

      // En partido en vivo, reasignar posiciones y roles respetando a los jugadores activos y expulsados
      if (isLiveMatch) {
        const currentSide = team.players[0]?.originPOS?.[1] > 525 ? 'bottom' : 'top';
        const coords = getFormationCoordinates(team.formation, team.mentality, currentSide);
        const slotA = coords[idxA] || coords[0];
        const slotB = coords[idxB] || coords[0];

        // Jugador que va al slot A:
        if (nextPlayers[idxA].sentOff || nextPlayers[idxA].currentPOS?.[0] === 'NP') {
          nextPlayers[idxA].currentPOS = ['NP', 'NP'];
          nextPlayers[idxA].intentPOS = ['NP', 'NP'];
          nextPlayers[idxA].originPOS = slotA.coords.slice();
          nextPlayers[idxA].tacticalRole = slotA.role;
        } else {
          nextPlayers[idxA].originPOS = slotA.coords.slice();
          nextPlayers[idxA].intentPOS = slotA.coords.slice();
          nextPlayers[idxA].currentPOS = slotA.coords.slice();
          nextPlayers[idxA].tacticalRole = slotA.role;
        }

        // Jugador que va al slot B:
        if (nextPlayers[idxB].sentOff || nextPlayers[idxB].currentPOS?.[0] === 'NP') {
          nextPlayers[idxB].currentPOS = ['NP', 'NP'];
          nextPlayers[idxB].intentPOS = ['NP', 'NP'];
          nextPlayers[idxB].originPOS = slotB.coords.slice();
          nextPlayers[idxB].tacticalRole = slotB.role;
        } else {
          nextPlayers[idxB].originPOS = slotB.coords.slice();
          nextPlayers[idxB].intentPOS = slotB.coords.slice();
          nextPlayers[idxB].currentPOS = slotB.coords.slice();
          nextPlayers[idxB].tacticalRole = slotB.role;
        }
      }
      const nextTeam = recomputeCoordsAndSkills({ ...team, players: nextPlayers });
      onUpdateTeam(nextTeam);
      setSelectedSlot(null);
      return;
    }

    // Caso 2: Intercambio entre un titular y un suplente
    if (
    selectedSlot.type === 'starter' && type === 'bench' ||
    selectedSlot.type === 'bench' && type === 'starter')
    {
      const starterIdx = selectedSlot.type === 'starter' ? selectedSlot.index : index;
      const benchIdx = selectedSlot.type === 'bench' ? selectedSlot.index : index;

      if (isLiveMatch && onMakeLiveSubstitution) {
        try {
          onMakeLiveSubstitution(starterIdx, benchIdx);
          setSelectedSlot(null);
        } catch (err) {
          setErrorMsg(err.message || 'No se pudo realizar el cambio.');
          setSelectedSlot(null);
        }
        return;
      }

      // En pre-partido: intercambio libre entre titular y banco
      const nextPlayers = [...team.players];
      const nextBench = [...(team.bench || [])];
      const starter = nextPlayers[starterIdx];
      const sub = nextBench[benchIdx];
      const subShirt = sub.shirtNumber;
      nextPlayers[starterIdx] = { ...sub, shirtNumber: starter.shirtNumber };
      nextBench[benchIdx] = { ...starter, shirtNumber: subShirt };

      const nextTeam = recomputeCoordsAndSkills({
        ...team,
        players: nextPlayers,
        bench: nextBench
      });
      onUpdateTeam(nextTeam);
      setSelectedSlot(null);
      return;
    }

    setSelectedSlot({ type, index });
  };

  const activeStarters = team.players.filter((p) => !p.sentOff);

  return (/*#__PURE__*/
    _jsxs("div", { className: isLiveMatch ? '' : 'main-container', children: [

      secondaryTeamTab && /*#__PURE__*/
      _jsxs("div", { className: "panel", style: { marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }, children: [/*#__PURE__*/
        _jsxs("div", { style: { display: 'flex', gap: '0.6rem' }, children: [/*#__PURE__*/
          _jsxs("button", {
            type: "button",
            className: `btn ${secondaryTeamTab.activeTeamIndex === 1 ? 'btn-gold' : 'btn-outline'}`,
            onClick: () => {
              setSelectedSlot(null);
              secondaryTeamTab.onSwitchTeam(1);
            }, children: [
            "1️⃣ Pizarra de ",
            secondaryTeamTab.team1Name] }
          ), /*#__PURE__*/
          _jsxs("button", {
            type: "button",
            className: `btn ${secondaryTeamTab.activeTeamIndex === 2 ? 'btn-gold' : 'btn-outline'}`,
            onClick: () => {
              setSelectedSlot(null);
              secondaryTeamTab.onSwitchTeam(2);
            }, children: [
            "2️⃣ Pizarra de ",
            secondaryTeamTab.team2Name] }
          )] }
        ), /*#__PURE__*/
        _jsx("span", { style: { fontSize: '0.82rem', color: '#94a3b8' }, children: "Configurá formación, mentalidad, pelota parada y titulares antes de salir a la cancha" }

        )] }
      ), /*#__PURE__*/



      _jsxs("div", { className: "panel panel-gold", style: { marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.85rem' }, children: [/*#__PURE__*/
        _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '0.75rem' }, children: [/*#__PURE__*/
          _jsx("span", {
            style: {
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: team.primaryColor || '#1d4ed8',
              border: `3px solid ${team.secondaryColor || '#facc15'}`
            } }
          ), /*#__PURE__*/
          _jsxs("div", { children: [/*#__PURE__*/
            _jsxs("h2", { style: { fontSize: '1.35rem', color: '#fff' }, children: ["PIZARRA TÁCTICA • ",
              team.name] }
            ), /*#__PURE__*/
            _jsx("p", { style: { fontSize: '0.8rem', color: '#cbd5e1' }, children:
              isLiveMatch ?
              `Cambios realizados: ${team.substitutionsUsed || 0} / ${team.maxSubstitutions || 5}${pendingSubstitutionsCount > 0 ? ` (${pendingSubstitutionsCount} en espera)` : ''} • Hacé clic en un titular y luego en un suplente para hacer un cambio.` :
              'Hacé clic en cualquier jugador titular y luego en otro titular o suplente para intercambiar su puesto.' }
            )] }
          )] }
        ), /*#__PURE__*/

        _jsxs("div", { style: { display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }, children: [
          isLiveMatch && canUndoLiveSubstitution && /*#__PURE__*/
          _jsxs("button", {
            type: "button",
            className: "btn btn-outline",
            style: {
              borderColor: '#f59e0b',
              color: '#fbbf24',
              background: 'rgba(245, 158, 11, 0.14)',
              fontWeight: 700,
              fontSize: '0.88rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem'
            },
            onClick: () => {
              if (onUndoLiveSubstitution) onUndoLiveSubstitution();
              setErrorMsg('');
            }, children: [
            "↩️ Deshacer cambios ",
            pendingSubstitutionsCount > 1 ? `(${pendingSubstitutionsCount})` : ''] }
          ),

          !isLiveMatch && /*#__PURE__*/
          _jsx("button", { type: "button", className: "btn btn-outline", onClick: handleAutoOptimize, children: "✨ Auto-Ordenar Puestos Óptimos" }

          ),

          onConfirm && /*#__PURE__*/
          _jsx("button", { type: "button", className: "btn btn-gold btn-lg", onClick: onConfirm, children:
            confirmLabel }
          )] }

        )] }
      ),

      isLiveMatch && pendingSubstitutionsCount > 0 && /*#__PURE__*/
      _jsxs("div", {
        style: {
          background: 'rgba(14, 165, 233, 0.16)',
          border: '1px solid #0ea5e9',
          color: '#e0f2fe',
          padding: '0.65rem 1rem',
          borderRadius: '6px',
          marginBottom: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.75rem',
          fontSize: '0.85rem'
        }, children: [/*#__PURE__*/

        _jsxs("div", { children: [/*#__PURE__*/
          _jsx("span", { style: { fontWeight: 800, color: '#38bdf8' }, children: "🔄 CAMBIO(S) SOLICITADO(S): " }),
          !isPlayStopped ?
          'El partido está en juego. Los cambios se aplicarán automáticamente cuando la pelota se detenga (falta, lateral, córner, saque de arco, gol, offside o entretiempo).' :
          'Las sustituciones se aplicarán al reanudar el partido.'] }
        ),
        canUndoLiveSubstitution && /*#__PURE__*/
        _jsx("button", {
          type: "button",
          className: "btn btn-outline btn-sm",
          style: {
            borderColor: '#f59e0b',
            color: '#fbbf24',
            background: 'rgba(245, 158, 11, 0.22)',
            whiteSpace: 'nowrap',
            fontWeight: 700
          },
          onClick: () => {
            if (onUndoLiveSubstitution) onUndoLiveSubstitution();
            setErrorMsg('');
          }, children:
          "↩️ Deshacer cambios" }

        )] }

      ),


      errorMsg && /*#__PURE__*/
      _jsxs("div", {
        style: {
          background: 'rgba(239, 68, 68, 0.2)',
          border: '1px solid #ef4444',
          color: '#fca5a5',
          padding: '0.65rem 1rem',
          borderRadius: '8px',
          marginBottom: '1rem',
          fontWeight: 600,
          fontSize: '0.86rem'
        }, children: [
        "⚠️ ",
        errorMsg] }
      ), /*#__PURE__*/


      _jsxs("div", { className: "tactics-layout", children: [/*#__PURE__*/

        _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '1rem' }, children: [/*#__PURE__*/
          _jsxs("div", { className: "panel", children: [/*#__PURE__*/
            _jsxs("h3", { style: { color: '#facc15', fontSize: '0.95rem', marginBottom: '0.6rem' }, children: ["ESQUEMA TÁCTICO EN CANCHA (",
              formation.name, ")"] }
            ), /*#__PURE__*/
            _jsxs("div", { className: "mini-pitch", children: [/*#__PURE__*/

              _jsx("div", {
                style: {
                  position: 'absolute',
                  top: 0,
                  left: '10%',
                  width: '80%',
                  height: '2px',
                  background: 'rgba(255,255,255,0.55)'
                } }
              ), /*#__PURE__*/
              _jsx("div", {
                style: {
                  position: 'absolute',
                  top: -36,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  border: '1.5px solid rgba(255,255,255,0.45)'
                } }
              ), /*#__PURE__*/
              _jsx("div", {
                style: {
                  position: 'absolute',
                  bottom: 0,
                  left: '22%',
                  width: '56%',
                  height: '18%',
                  border: '1.5px solid rgba(255,255,255,0.55)',
                  borderBottom: 'none'
                } }
              ),

              team.players.map((player, idx) => {
                const slot = slots[idx] || slots[0];
                // Orientación estándar PC Fútbol: Arquero abajo (90%), Delanteros arriba (12%), LI a la izquierda y LD a la derecha
                const leftPct = Math.max(8, Math.min(92, slot.coords[0] / 680 * 100));
                const topPct = Math.max(10, Math.min(91, 96 - slot.coords[1] / 540 * 86));
                const compat = getPositionCompatibility(player, slot.role);
                const isSelected = selectedSlot?.type === 'starter' && selectedSlot?.index === idx;
                const isCaptain = Number(team.setPieces?.captainID) === Number(player.id || player.playerID);

                return (/*#__PURE__*/
                  _jsxs("div", {

                    className: "mini-pitch-node",
                    style: { left: `${leftPct}%`, top: `${topPct}%`, opacity: player.sentOff ? 0.35 : 1 },
                    onClick: () => handleSlotClick('starter', idx), children: [/*#__PURE__*/

                    _jsxs("div", {
                      className: "node-circle",
                      style: {
                        background: team.primaryColor || '#1d4ed8',
                        color: team.secondaryColor || '#facc15',
                        borderColor: isSelected ? '#facc15' : compat.factor < 0.8 ? '#ef4444' : '#ffffff',
                        boxShadow: isSelected ? '0 0 14px #facc15' : undefined
                      }, children: [

                      player.shirtNumber || idx + 1,
                      isCaptain && /*#__PURE__*/
                      _jsx("span", {
                        style: {
                          position: 'absolute',
                          top: -5,
                          right: -6,
                          background: '#facc15',
                          color: '#000',
                          fontSize: '0.55rem',
                          fontWeight: 900,
                          padding: '0 3px',
                          borderRadius: '2px'
                        }, children:
                        "C" }

                      ),

                      player.stats?.cards?.yellow > 0 && /*#__PURE__*/
                      _jsx("span", {
                        title: "Tarjeta Amarilla",
                        style: {
                          position: 'absolute',
                          bottom: -4,
                          left: -4,
                          fontSize: '0.62rem',
                          lineHeight: 1
                        }, children:
                        "🟨" }

                      ),

                      (player.isPendingSubOut || player.isPendingSubIn) && /*#__PURE__*/
                      _jsx("span", {
                        title: player.isPendingSubOut ? `Cambio pendiente: Sale por ${player.replacingBenchName || 'suplente'}` : `Cambio pendiente: Reemplaza a ${player.replacedName || 'titular'}`,
                        style: {
                          position: 'absolute',
                          top: -6,
                          left: -6,
                          fontSize: '0.72rem',
                          lineHeight: 1
                        }, children:
                        "🔄" }

                      ),

                      (player.injuryStatus?.grade === 'knock' || player.injuryStatus?.grade === 'hurt') && /*#__PURE__*/
                      _jsx("span", {
                        title: `Lesión menor (${player.injuryStatus.name || 'Molestia'})`,
                        style: {
                          position: 'absolute',
                          top: -5,
                          left: -5,
                          fontSize: '0.62rem',
                          lineHeight: 1
                        }, children:
                        "🩹" }

                      ),

                      player.sentOff && /*#__PURE__*/
                      _jsx("span", {
                        title: "Expulsado (Roja)",
                        style: {
                          position: 'absolute',
                          bottom: -4,
                          right: -4,
                          fontSize: '0.62rem',
                          lineHeight: 1
                        }, children:
                        "🟥" }

                      )] }

                    ), /*#__PURE__*/
                    _jsxs("div", { className: "node-name-tag", children: [
                      slot.label, ": ", player.name.split(' ').slice(-1)[0],
                      player.isPendingSubOut && /*#__PURE__*/
                      _jsxs("span", { style: { color: '#f59e0b', fontSize: '0.64rem', marginLeft: '3px', fontWeight: 800 }, children: ["➔ ",
                        player.replacingBenchName?.split(' ').slice(-1)[0]] }
                      )] }

                    )] }, player.id || player.playerID
                  ));

              })] }
            ), /*#__PURE__*/
            _jsx("div", { style: { fontSize: '0.73rem', color: '#93c5fd', marginTop: '0.5rem', textAlign: 'center', fontWeight: 700 }, children: "⬆️ Ataque de abajo (ARQ) hacia arriba (DEL) • LI a la izquierda | LD a la derecha" }

            )] }
          ), /*#__PURE__*/


          _jsxs("div", { className: "panel", children: [/*#__PURE__*/
            _jsx("h3", { style: { color: '#facc15', fontSize: '0.95rem', marginBottom: '0.7rem' }, children: "⚙️ FORMACIÓN, MENTALIDAD Y PELOTA PARADA" }

            ), /*#__PURE__*/

            _jsxs("div", { style: { marginBottom: '0.7rem' }, children: [/*#__PURE__*/
              _jsx("label", { style: { fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }, children: "Formación Táctica" }

              ), /*#__PURE__*/
              _jsx("select", {
                className: "select-input",
                value: team.formation,
                onChange: (e) => handleFormationChange(e.target.value), children:

                Object.values(FORMATIONS).map((f) => /*#__PURE__*/
                _jsx("option", { value: f.id, children:
                  f.name }, f.id
                )
                ) }
              ), /*#__PURE__*/
              _jsx("div", { style: { fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }, children:
                formation.description }
              )] }
            ), /*#__PURE__*/

            _jsxs("div", { style: { marginBottom: '0.7rem' }, children: [/*#__PURE__*/
              _jsx("label", { style: { fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }, children: "Mentalidad del Equipo" }

              ), /*#__PURE__*/
              _jsx("select", {
                className: "select-input",
                value: team.mentality,
                onChange: (e) => handleMentalityChange(e.target.value), children:

                Object.values(MENTALITIES).map((m) => /*#__PURE__*/
                _jsx("option", { value: m.id, children:
                  m.name }, m.id
                )
                ) }
              ), /*#__PURE__*/
              _jsx("div", { style: { fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }, children:
                mentality.description }
              )] }
            ), /*#__PURE__*/

            _jsxs("div", { style: { marginBottom: '0.85rem' }, children: [/*#__PURE__*/
              _jsx("label", { style: { fontSize: '0.75rem', color: '#facc15', fontWeight: 700, display: 'block', marginBottom: '0.2rem' }, children: "⚡ Estilo de Juego (Comportamiento IA en Cancha)" }

              ), /*#__PURE__*/
              _jsx("select", {
                className: "select-input",
                value: playStyle.id,
                onChange: (e) => handlePlayStyleChange(e.target.value), children:

                Object.values(PLAY_STYLES).map((st) => /*#__PURE__*/
                _jsx("option", { value: st.id, children:
                  st.name }, st.id
                )
                ) }
              ), /*#__PURE__*/
              _jsx("div", { style: { fontSize: '0.72rem', color: '#93c5fd', marginTop: '0.2rem' }, children:
                playStyle.description }
              )] }
            ), /*#__PURE__*/

            _jsx("hr", { style: { border: 'none', borderTop: '1px solid rgba(148,163,184,0.2)', margin: '0.75rem 0' } }), /*#__PURE__*/

            _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }, children: [/*#__PURE__*/
              _jsxs("div", { children: [/*#__PURE__*/
                _jsx("label", { style: { fontSize: '0.72rem', color: '#facc15', fontWeight: 700, display: 'block', marginBottom: '0.2rem' }, children: "©️ Capitán (+PER / -15% fatiga)" }

                ), /*#__PURE__*/
                _jsx("select", {
                  className: "select-input",
                  value: team.setPieces?.captainID || '',
                  onChange: (e) => handleSetPieceChange('captainID', e.target.value), children:

                  activeStarters.map((p) => /*#__PURE__*/
                  _jsxs("option", { value: p.id || p.playerID, children: [
                    p.name, " (PER ", p.baseSkill?.perception || p.skill.perception, ")"] }, p.id || p.playerID
                  )
                  ) }
                )] }
              ), /*#__PURE__*/

              _jsxs("div", { children: [/*#__PURE__*/
                _jsx("label", { style: { fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700, display: 'block', marginBottom: '0.2rem' }, children: "🎯 Pateador de Penales" }

                ), /*#__PURE__*/
                _jsx("select", {
                  className: "select-input",
                  value: team.setPieces?.penaltyTakerID || '',
                  onChange: (e) => handleSetPieceChange('penaltyTakerID', e.target.value), children:

                  activeStarters.map((p) => /*#__PURE__*/
                  _jsxs("option", { value: p.id || p.playerID, children: [
                    p.name, " (PEN ", p.baseSkill?.penalty_taking || p.skill.penalty_taking, ")"] }, p.id || p.playerID
                  )
                  ) }
                )] }
              ), /*#__PURE__*/

              _jsxs("div", { children: [/*#__PURE__*/
                _jsx("label", { style: { fontSize: '0.72rem', color: '#4ade80', fontWeight: 700, display: 'block', marginBottom: '0.2rem' }, children: "🚀 Tiros Libres Directos" }

                ), /*#__PURE__*/
                _jsx("select", {
                  className: "select-input",
                  value: team.setPieces?.freekickTakerID || '',
                  onChange: (e) => handleSetPieceChange('freekickTakerID', e.target.value), children:

                  activeStarters.map((p) => /*#__PURE__*/
                  _jsxs("option", { value: p.id || p.playerID, children: [
                    p.name, " (TL ", p.baseSkill?.freekick || p.skill.freekick, ")"] }, p.id || p.playerID
                  )
                  ) }
                )] }
              ), /*#__PURE__*/

              _jsxs("div", { children: [/*#__PURE__*/
                _jsx("label", { style: { fontSize: '0.72rem', color: '#c084fc', fontWeight: 700, display: 'block', marginBottom: '0.2rem' }, children: "🚩 Ejecutor de Córners" }

                ), /*#__PURE__*/
                _jsx("select", {
                  className: "select-input",
                  value: team.setPieces?.cornerTakerID || '',
                  onChange: (e) => handleSetPieceChange('cornerTakerID', e.target.value), children:

                  activeStarters.map((p) => /*#__PURE__*/
                  _jsxs("option", { value: p.id || p.playerID, children: [
                    p.name, " (PAS ", p.baseSkill?.passing || p.skill.passing, ")"] }, p.id || p.playerID
                  )
                  ) }
                )] }
              )] }
            )] }
          )] }
        ), /*#__PURE__*/


        _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '1rem' }, children: [/*#__PURE__*/

          _jsxs("div", { className: "panel", children: [/*#__PURE__*/
            _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.7rem' }, children: [/*#__PURE__*/
              _jsx("h3", { style: { color: '#facc15', fontSize: '1rem' }, children: "🟢 11 TITULARES EN CANCHA" }

              ), /*#__PURE__*/
              _jsx("span", { style: { fontSize: '0.76rem', color: '#94a3b8' }, children: "Los puestos fuera de posición reducen los atributos efectivos del jugador" }

              )] }
            ), /*#__PURE__*/

            _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: '0.45rem' }, children:
              team.players.map((player, idx) => {
                const slot = slots[idx] || slots[0];
                const compat = getPositionCompatibility(player, slot.role);
                const isSelected = selectedSlot?.type === 'starter' && selectedSlot?.index === idx;
                const effectiveRating = Math.round(player.rating * compat.factor * ((player.fitness ?? 100) < 75 ? 0.94 : 1));
                const isCaptain = Number(team.setPieces?.captainID) === Number(player.id || player.playerID);
                const allNaturalPos = Array.isArray(player.positions) && player.positions.length > 0 ?
                player.positions.join(' / ') :
                player.position;

                return (/*#__PURE__*/
                  _jsxs("div", {

                    onClick: () => handleSlotClick('starter', idx),
                    style: {
                      display: 'grid',
                      gridTemplateColumns: '84px 1fr auto auto',
                      alignItems: 'center',
                      gap: '0.65rem',
                      padding: '0.62rem 0.8rem',
                      borderRadius: '4px',
                      background: isSelected ? 'rgba(250, 204, 21, 0.22)' : idx % 2 === 0 ? '#0a1936' : '#0d2147',
                      border: isSelected ? '2px solid #facc15' : '1px solid #284678',
                      cursor: 'pointer'
                    }, children: [/*#__PURE__*/

                    _jsx("div", { children: /*#__PURE__*/
                      _jsxs("span", {
                        style: {
                          background: '#02060d',
                          color: '#facc15',
                          fontWeight: 800,
                          fontSize: '0.72rem',
                          padding: '0.18rem 0.42rem',
                          borderRadius: '2px',
                          border: '1px solid #47669c',
                          display: 'inline-block'
                        }, children: [

                        slot.label, " (", slot.role, ")"] }
                      ) }
                    ), /*#__PURE__*/

                    _jsxs("div", { children: [/*#__PURE__*/
                      _jsxs("div", { style: { fontWeight: 800, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }, children: [/*#__PURE__*/
                        _jsx("span", { children: player.name }),
                        isCaptain && /*#__PURE__*/
                        _jsx("span", { style: { background: '#facc15', color: '#000', fontSize: '0.64rem', fontWeight: 900, padding: '1px 5px', borderRadius: '2px' }, children: "CAPITÁN" }

                        ),

                        player.stats?.cards?.yellow > 0 && /*#__PURE__*/_jsx("span", { title: "Tarjeta Amarilla", children: "🟨" }),
                        (player.injuryStatus?.grade === 'knock' || player.injuryStatus?.grade === 'hurt') && /*#__PURE__*/
                        _jsxs("span", { title: `Molestia física: ${player.injuryStatus.name || 'Disminuido'}`, style: { color: '#fb923c' }, children: ["🩹 ",
                          player.injuryStatus.name || 'Molestia'] }
                        ),

                        player.sentOff && /*#__PURE__*/_jsx("span", { title: "Expulsado (Roja)", children: "🟥 EXPULSADO" })] }
                      ), /*#__PURE__*/
                      _jsxs("div", { style: { fontSize: '0.72rem', color: '#94a3b8' }, children: ["Puestos: ", /*#__PURE__*/
                        _jsx("b", { style: { color: '#fde047' }, children: allNaturalPos }), " • ", player.specialty] }
                      ),
                      Array.isArray(player.traits) && player.traits.length > 0 && /*#__PURE__*/
                      _jsx("div", { style: { display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.22rem' }, children:
                        player.traits.map((tId) => {
                          const tr = TRAIT_DEFINITIONS[tId];
                          if (!tr) return null;
                          return (/*#__PURE__*/
                            _jsxs("span", {

                              title: tr.description,
                              style: {
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                padding: '1px 5px',
                                borderRadius: '2px',
                                background: 'rgba(0,0,0,0.6)',
                                border: `1px solid ${tr.color}`,
                                color: tr.color
                              }, children: [

                              tr.icon, " ", tr.label] }, tId
                            ));

                        }) }
                      ), /*#__PURE__*/


                      _jsx("div", {
                        style: {
                          display: 'inline-flex',
                          gap: '0.35rem',
                          marginTop: '0.3rem',
                          background: 'rgba(2, 6, 23, 0.75)',
                          padding: '0.2rem 0.45rem',
                          borderRadius: '4px',
                          border: '1px solid rgba(255, 255, 255, 0.08)'
                        }, children:

                        getTacticalMiniStats(player).map((st) => /*#__PURE__*/
                        _jsxs("div", { style: { textAlign: 'center', minWidth: '24px' }, children: [/*#__PURE__*/
                          _jsx("div", { style: { fontSize: '0.58rem', color: '#94a3b8', fontWeight: 800, lineHeight: 1 }, children: st.label }), /*#__PURE__*/
                          _jsx("div", { style: { fontSize: '0.68rem', fontWeight: 900, color: st.isText ? '#f1f5f9' : getStatColor(st.val), lineHeight: 1.1 }, children: st.val })] }, st.label
                        )
                        ) }
                      )] }
                    ), /*#__PURE__*/

                    _jsx("div", { style: { textAlign: 'right' }, children: /*#__PURE__*/
                      _jsxs("span", { className: `compat-badge compat-${compat.status}`, children: [
                        Math.round(compat.factor * 100), "% • ", compat.label] }
                      ) }
                    ), /*#__PURE__*/

                    _jsx("div", { style: { display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: '105px', justifyContent: 'flex-end' }, children: /*#__PURE__*/
                      _jsxs("div", { style: { textAlign: 'right' }, children: [/*#__PURE__*/
                        _jsxs("div", { style: { fontFamily: 'VT323, monospace', fontWeight: 700, fontSize: '1.25rem', lineHeight: 1, color: compat.factor < 0.8 ? '#f87171' : '#00ff66' }, children: ["OVR ",
                          effectiveRating] }
                        ), /*#__PURE__*/
                        _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'flex-end', marginTop: '0.15rem' }, children: [/*#__PURE__*/
                          _jsx("div", { style: { width: '38px', height: '4.5px', background: '#020617', borderRadius: '2px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)' }, children: /*#__PURE__*/
                            _jsx("div", {
                              style: {
                                width: `${Math.round(player.fitness ?? 100)}%`,
                                height: '100%',
                                background: (player.fitness ?? 100) > 65 ? '#4ade80' : (player.fitness ?? 100) > 40 ? '#facc15' : '#ef4444'
                              } }
                            ) }
                          ), /*#__PURE__*/
                          _jsxs("span", { style: { fontSize: '0.68rem', color: (player.fitness ?? 100) > 65 ? '#94a3b8' : (player.fitness ?? 100) > 40 ? '#facc15' : '#f87171', fontWeight: 700 }, children: [
                            Math.round(player.fitness ?? 100), "%"] }
                          )] }
                        )] }
                      ) }
                    )] }, player.id || player.playerID
                  ));

              }) }
            )] }
          ), /*#__PURE__*/


          _jsxs("div", { className: "panel", children: [/*#__PURE__*/
            _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }, children: [/*#__PURE__*/
              _jsxs("h3", { style: { color: '#38bdf8', fontSize: '1rem' }, children: ["🪑 BANCO DE SUPLENTES (",
                (team.bench || []).length, " JUGADORES)"] }
              ), /*#__PURE__*/
              _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '0.6rem' }, children: [
                isLiveMatch && canUndoLiveSubstitution && /*#__PURE__*/
                _jsx("button", {
                  type: "button",
                  style: {
                    background: 'rgba(245, 158, 11, 0.2)',
                    border: '1px solid #f59e0b',
                    color: '#fbbf24',
                    borderRadius: '4px',
                    padding: '0.2rem 0.55rem',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  },
                  onClick: () => {
                    if (onUndoLiveSubstitution) onUndoLiveSubstitution();
                    setErrorMsg('');
                  }, children:
                  "↩️ Deshacer cambios" }

                ), /*#__PURE__*/

                _jsx("span", { style: { fontSize: '0.75rem', color: '#94a3b8' }, children:
                  isLiveMatch ?
                  `Cambios restantes: ${Math.max(0, (team.maxSubstitutions || 5) - (team.substitutionsUsed || 0) - (pendingSubstitutionsCount || 0))}` :
                  'Seleccioná un suplente y un titular para rotar el once inicial' }
                )] }
              )] }
            ), /*#__PURE__*/

            _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: '0.45rem' }, children:
              (team.bench || []).map((sub, bIdx) => {
                const isSelected = selectedSlot?.type === 'bench' && selectedSlot?.index === bIdx;
                const compatWithSelected = selectedSlot?.type === 'starter' ?
                getPositionCompatibility(sub, slots[selectedSlot.index]?.role || sub.position) :
                null;
                const subPositions = Array.isArray(sub.positions) && sub.positions.length > 0 ?
                sub.positions.join(' / ') :
                sub.position;

                return (/*#__PURE__*/
                  _jsxs("div", {

                    onClick: () => handleSlotClick('bench', bIdx),
                    style: {
                      display: 'grid',
                      gridTemplateColumns: '84px 1fr auto auto',
                      alignItems: 'center',
                      gap: '0.65rem',
                      padding: '0.62rem 0.8rem',
                      borderRadius: '4px',
                      background: isSelected ? 'rgba(56, 189, 248, 0.22)' : '#071226',
                      border: isSelected ? '2px solid #38bdf8' : '1px solid #284678',
                      cursor: 'pointer'
                    }, children: [/*#__PURE__*/

                    _jsx("div", { children: /*#__PURE__*/
                      _jsx("span", {
                        style: {
                          background: '#02060d',
                          color: '#38bdf8',
                          fontWeight: 800,
                          fontSize: '0.72rem',
                          padding: '0.18rem 0.42rem',
                          borderRadius: '2px',
                          border: '1px solid #1e3a8a',
                          display: 'inline-block'
                        }, children:

                        subPositions }
                      ) }
                    ), /*#__PURE__*/

                    _jsxs("div", { children: [/*#__PURE__*/
                      _jsxs("div", { style: { fontWeight: 700, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }, children: [/*#__PURE__*/
                        _jsx("span", { children: sub.name }),
                        (sub.isPendingSubIn || sub.isPendingSubOut) && /*#__PURE__*/
                        _jsxs("span", { style: { color: '#f59e0b', fontSize: '0.74rem', fontWeight: 800 }, children: ["🔄 ",
                          sub.isPendingSubIn ? `(Entra por ${sub.replacingStarterName || 'titular'})` : `(Sale por ${sub.replacingName || 'suplente'})`] }
                        ),

                        sub.stats?.cards?.yellow > 0 && /*#__PURE__*/_jsx("span", { title: "Tarjeta Amarilla", children: "🟨" }),
                        (sub.injuryStatus?.grade === 'knock' || sub.injuryStatus?.grade === 'hurt') && /*#__PURE__*/
                        _jsxs("span", { title: `Molestia física: ${sub.injuryStatus.name || 'Disminuido'}`, style: { color: '#fb923c' }, children: ["🩹 ",
                          sub.injuryStatus.name || 'Molestia'] }
                        ),

                        sub.sentOff && /*#__PURE__*/_jsx("span", { title: "Expulsado (Roja)", children: "🟥 EXPULSADO" })] }
                      ), /*#__PURE__*/
                      _jsx("div", { style: { fontSize: '0.72rem', color: '#94a3b8' }, children:
                        sub.specialty }
                      ),
                      Array.isArray(sub.traits) && sub.traits.length > 0 && /*#__PURE__*/
                      _jsx("div", { style: { display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.2rem' }, children:
                        sub.traits.map((tId) => {
                          const tr = TRAIT_DEFINITIONS[tId];
                          if (!tr) return null;
                          return (/*#__PURE__*/
                            _jsxs("span", {

                              title: tr.description,
                              style: {
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                padding: '1px 5px',
                                borderRadius: '2px',
                                background: 'rgba(0,0,0,0.6)',
                                border: `1px solid ${tr.color}`,
                                color: tr.color
                              }, children: [

                              tr.icon, " ", tr.label] }, tId
                            ));

                        }) }
                      ), /*#__PURE__*/


                      _jsx("div", {
                        style: {
                          display: 'inline-flex',
                          gap: '0.35rem',
                          marginTop: '0.3rem',
                          background: 'rgba(2, 6, 23, 0.75)',
                          padding: '0.2rem 0.45rem',
                          borderRadius: '4px',
                          border: '1px solid rgba(255, 255, 255, 0.08)'
                        }, children:

                        getTacticalMiniStats(sub).map((st) => /*#__PURE__*/
                        _jsxs("div", { style: { textAlign: 'center', minWidth: '24px' }, children: [/*#__PURE__*/
                          _jsx("div", { style: { fontSize: '0.58rem', color: '#94a3b8', fontWeight: 800, lineHeight: 1 }, children: st.label }), /*#__PURE__*/
                          _jsx("div", { style: { fontSize: '0.68rem', fontWeight: 900, color: st.isText ? '#f1f5f9' : getStatColor(st.val), lineHeight: 1.1 }, children: st.val })] }, st.label
                        )
                        ) }
                      )] }
                    ), /*#__PURE__*/

                    _jsx("div", { children:
                      compatWithSelected && /*#__PURE__*/
                      _jsxs("span", { className: `compat-badge compat-${compatWithSelected.status}`, children: ["En ese puesto: ",
                        Math.round(compatWithSelected.factor * 100), "%"] }
                      ) }

                    ), /*#__PURE__*/

                    _jsxs("div", { style: { textAlign: 'right', minWidth: '85px' }, children: [/*#__PURE__*/
                      _jsxs("div", { style: { fontFamily: 'Chakra Petch', fontWeight: 800, fontSize: '0.92rem', color: '#fff' }, children: ["OVR ",
                        sub.rating] }
                      ), /*#__PURE__*/
                      _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'flex-end', marginTop: '0.15rem' }, children: [/*#__PURE__*/
                        _jsx("div", { style: { width: '38px', height: '4.5px', background: '#020617', borderRadius: '2px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)' }, children: /*#__PURE__*/
                          _jsx("div", {
                            style: {
                              width: `${Math.round(sub.fitness ?? 100)}%`,
                              height: '100%',
                              background: (sub.fitness ?? 100) > 65 ? '#4ade80' : (sub.fitness ?? 100) > 40 ? '#facc15' : '#ef4444'
                            } }
                          ) }
                        ), /*#__PURE__*/
                        _jsxs("span", { style: { fontSize: '0.68rem', color: (sub.fitness ?? 100) > 65 ? '#94a3b8' : (sub.fitness ?? 100) > 40 ? '#facc15' : '#f87171', fontWeight: 700 }, children: [
                          Math.round(sub.fitness ?? 100), "%"] }
                        )] }
                      )] }
                    )] }, sub.id || sub.playerID
                  ));

              }) }
            )] }
          )] }
        )] }
      )] }
    ));

}