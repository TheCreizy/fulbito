# `DraftScreen.js` - Pantalla de Selección de Draft ($250M)

> **Categoría:** `Componentes UI / Modo Draft`  
> **Ubicación:** `src\components\DraftScreen.js`  
> **Líneas de código:** 338  
> **Tamaño:** 14.10 KB

---

## 📋 Resumen del Módulo

Componente interactivo para el modo Draft con tope presupuestario ($250M). Muestra el sobre actual con 7 cartas sorteadas, tarjetas coleccionables interactivas, balance de posiciones, indicador de presupuesto restante, banco de suplentes y confirmación de la plantilla final.

---

## 🧩 Exportaciones y Elementos Principales

- **Línea 14:** `export default function DraftScreen(`



---

## 💻 Código Fuente JavaScript (`DraftScreen.js`)

````javascript
import React, { useState, useMemo } from 'react';
import {
  INITIAL_BUDGET,
  TOTAL_ROUNDS,
  REROLL_COST,
  getMaxSpendableForRound,
  canRerollPack,
  generateDraftPack,
  selectAICardFromPack,
  getPositionalCounts } from
'../draft/draftEngine.js';
import PlayerCard from './PlayerCard.jsx';import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";

export default function DraftScreen({
  gameMode,
  team1Config,
  team2Config,
  onDraftComplete,
  onCancel
}) {
  const [round, setRound] = useState(1);
  const [activeTurn, setActiveTurn] = useState(1); // 1 = Equipo 1, 2 = Equipo 2 (en PvP Local)
  const [usedIds, setUsedIds] = useState(() => new Set());

  const [budget1, setBudget1] = useState(INITIAL_BUDGET);
  const [budget2, setBudget2] = useState(INITIAL_BUDGET);
  const [squad1, setSquad1] = useState([]);
  const [squad2, setSquad2] = useState([]);

  const [rerolledThisTurn, setRerolledThisTurn] = useState(false);
  const [lastAIPick, setLastAIPick] = useState(null);

  const [currentPack, setCurrentPack] = useState(() =>
  generateDraftPack(1, new Set(), INITIAL_BUDGET, [])
  );

  const currentTeamConfig = activeTurn === 1 ? team1Config : team2Config;
  const currentBudget = activeTurn === 1 ? budget1 : budget2;
  const currentSquad = activeTurn === 1 ? squad1 : squad2;

  const maxSpendable = useMemo(
    () => getMaxSpendableForRound(currentBudget, currentSquad.length, usedIds),
    [currentBudget, currentSquad.length, usedIds]
  );

  const posCounts = useMemo(() => getPositionalCounts(currentSquad), [currentSquad]);
  const canReroll = canRerollPack(currentBudget, currentSquad.length, rerolledThisTurn, usedIds);

  const handleReroll = () => {
    if (!canReroll) return;
    const nextBudget = Number((currentBudget - REROLL_COST).toFixed(2));
    if (activeTurn === 1) setBudget1(nextBudget);else
    setBudget2(nextBudget);

    setRerolledThisTurn(true);
    const freshPack = generateDraftPack(round, usedIds, nextBudget, currentSquad);
    setCurrentPack(freshPack);
  };

  const handleSelectCard = (card) => {
    const nextUsed = new Set(usedIds);
    nextUsed.add(card.id);

    if (activeTurn === 1) {
      const nextSquad1 = [...squad1, card];
      const nextBudget1 = Number((budget1 - card.price).toFixed(2));
      setSquad1(nextSquad1);
      setBudget1(nextBudget1);

      if (gameMode === 'pvp') {
        // Turno del Jugador 2 en la misma ronda
        setUsedIds(nextUsed);
        setActiveTurn(2);
        setRerolledThisTurn(false);
        setCurrentPack(generateDraftPack(round, nextUsed, budget2, squad2));
      } else {
        // Modo vs IA: la IA abre su sobre de 7 cartas y elige inmediatamente
        const aiPack = generateDraftPack(round, nextUsed, budget2, squad2);
        const aiPick = selectAICardFromPack(aiPack, budget2, squad2, round, nextUsed);
        nextUsed.add(aiPick.id);
        const nextSquad2 = [...squad2, aiPick];
        const nextBudget2 = Number((budget2 - aiPick.price).toFixed(2));

        setSquad2(nextSquad2);
        setBudget2(nextBudget2);
        setLastAIPick(aiPick);
        setUsedIds(nextUsed);
        setRerolledThisTurn(false);

        if (round >= TOTAL_ROUNDS) {
          onDraftComplete(nextSquad1, nextSquad2, nextBudget1, nextBudget2);
        } else {
          const nextRound = round + 1;
          setRound(nextRound);
          setCurrentPack(generateDraftPack(nextRound, nextUsed, nextBudget1, nextSquad1));
        }
      }
    } else {
      // Jugador 2 en modo PvP Local termina la ronda
      const nextSquad2 = [...squad2, card];
      const nextBudget2 = Number((budget2 - card.price).toFixed(2));
      setSquad2(nextSquad2);
      setBudget2(nextBudget2);
      setUsedIds(nextUsed);
      setRerolledThisTurn(false);

      if (round >= TOTAL_ROUNDS) {
        onDraftComplete(squad1, nextSquad2, budget1, nextBudget2);
      } else {
        const nextRound = round + 1;
        setRound(nextRound);
        setActiveTurn(1);
        setCurrentPack(generateDraftPack(nextRound, nextUsed, budget1, squad1));
      }
    }
  };

  // Botón para autocompletar las rondas restantes si el jugador quiere ir rápido a la pizarra
  const handleAutoFinishDraft = () => {
    const tempUsed = new Set(usedIds);
    let b1 = budget1;
    let b2 = budget2;
    const s1 = [...squad1];
    const s2 = [...squad2];

    // Si en PvP quedó a mitad de ronda (turno 2), completar primero el turno 2 de la ronda actual
    let startR = round;
    if (gameMode === 'pvp' && activeTurn === 2) {
      const p2 = generateDraftPack(round, tempUsed, b2, s2);
      const pick2 = selectAICardFromPack(p2, b2, s2, round, tempUsed);
      tempUsed.add(pick2.id);
      s2.push(pick2);
      b2 = Number((b2 - pick2.price).toFixed(2));
      startR = round + 1;
    }

    for (let r = startR; r <= TOTAL_ROUNDS; r++) {
      const p1 = generateDraftPack(r, tempUsed, b1, s1);
      const pick1 = selectAICardFromPack(p1, b1, s1, r, tempUsed);
      tempUsed.add(pick1.id);
      s1.push(pick1);
      b1 = Number((b1 - pick1.price).toFixed(2));

      const p2 = generateDraftPack(r, tempUsed, b2, s2);
      const pick2 = selectAICardFromPack(p2, b2, s2, r, tempUsed);
      tempUsed.add(pick2.id);
      s2.push(pick2);
      b2 = Number((b2 - pick2.price).toFixed(2));
    }

    onDraftComplete(s1, s2, b1, b2);
  };

  return (/*#__PURE__*/
    _jsxs("div", { className: "main-container", children: [/*#__PURE__*/

      _jsxs("div", { className: "panel panel-gold", style: { marginBottom: '1rem' }, children: [/*#__PURE__*/
        _jsxs("div", { style: { display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem' }, children: [/*#__PURE__*/
          _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '0.75rem' }, children: [/*#__PURE__*/
            _jsx("span", {
              style: {
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: currentTeamConfig.primaryColor,
                border: `3px solid ${currentTeamConfig.secondaryColor}`
              } }
            ), /*#__PURE__*/
            _jsxs("div", { children: [/*#__PURE__*/
              _jsxs("div", { style: { fontSize: '0.75rem', color: '#facc15', fontWeight: 700, textTransform: 'uppercase' }, children: ["RONDA ",
                round, " DE ", TOTAL_ROUNDS, " • ", round <= 11 ? 'ARMANDO 11 TITULAR' : 'BANCO DE SUPLENTES (7)'] }
              ), /*#__PURE__*/
              _jsxs("h2", { style: { fontSize: '1.4rem', color: '#fff' }, children: ["TURNO DE: ",
                currentTeamConfig.name, " ", gameMode === 'pvp' ? `(JUGADOR ${activeTurn})` : ''] }
              )] }
            )] }
          ), /*#__PURE__*/

          _jsxs("div", { style: { display: 'flex', flexWrap: 'wrap', gap: '0.55rem' }, children: [/*#__PURE__*/
            _jsxs("button", {
              type: "button",
              className: "btn btn-primary",
              disabled: !canReroll,
              onClick: handleReroll,
              title: "Descarta estas 7 cartas y abre un sobre nuevo por $2.0M (máximo 1 vez por ronda)", children: [
              "🔄 Reroll Sobre (-$",
              REROLL_COST.toFixed(1), "M) ", rerolledThisTurn ? '• Usado' : ''] }
            ), /*#__PURE__*/
            _jsx("button", {
              type: "button",
              className: "btn btn-emerald",
              onClick: handleAutoFinishDraft, children:
              "⚡ Auto-Completar Resto del Draft" }

            ), /*#__PURE__*/
            _jsx("button", { type: "button", className: "btn btn-outline btn-sm", onClick: onCancel, children: "Volver al Menú" }

            )] }
          )] }
        ), /*#__PURE__*/

        _jsxs("div", { className: "draft-header-bar", children: [/*#__PURE__*/
          _jsxs("div", { className: "stat-metric-box", children: [/*#__PURE__*/
            _jsx("span", { className: "stat-metric-label", children: "Presupuesto Disponible" }), /*#__PURE__*/
            _jsxs("span", { className: "stat-metric-value", style: { color: '#4ade80' }, children: ["$",
              currentBudget.toFixed(1), "M"] }
            )] }
          ), /*#__PURE__*/
          _jsxs("div", { className: "stat-metric-box", children: [/*#__PURE__*/
            _jsx("span", { className: "stat-metric-label", children: "Gasto Máx. en esta Ronda (Reserva Anti-Bloqueo)" }), /*#__PURE__*/
            _jsxs("span", { className: "stat-metric-value", style: { color: '#facc15' }, children: ["$",
              maxSpendable.toFixed(1), "M"] }
            )] }
          ), /*#__PURE__*/
          _jsxs("div", { className: "stat-metric-box", children: [/*#__PURE__*/
            _jsx("span", { className: "stat-metric-label", children: "Plantel Fichado" }), /*#__PURE__*/
            _jsxs("span", { className: "stat-metric-value", children: [
              currentSquad.length, " / ", TOTAL_ROUNDS] }
            )] }
          ), /*#__PURE__*/
          _jsxs("div", { className: "stat-metric-box", children: [/*#__PURE__*/
            _jsx("span", { className: "stat-metric-label", children: "Balance por Línea (ARQ / DEF / MED / DEL)" }), /*#__PURE__*/
            _jsxs("span", { className: "stat-metric-value", style: { fontSize: '1.15rem', marginTop: '0.2rem' }, children: ["🧤 ",
              posCounts.GK, " \xA0|\xA0 🛡️ ", posCounts.DEF, " \xA0|\xA0 🧠 ", posCounts.MID, " \xA0|\xA0 ⚽ ", posCounts.ATT] }
            )] }
          )] }
        ),

        gameMode === 'ai' && lastAIPick && /*#__PURE__*/
        _jsxs("div", {
          style: {
            background: 'rgba(30, 41, 59, 0.85)',
            borderLeft: '4px solid #38bdf8',
            padding: '0.45rem 0.75rem',
            borderRadius: '6px',
            fontSize: '0.82rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }, children: [/*#__PURE__*/

          _jsxs("span", { children: ["🤖 ", /*#__PURE__*/
            _jsx("b", { children: team2Config.name }), " fichó en la última ronda a: ", /*#__PURE__*/_jsx("b", { children: lastAIPick.name }), " (", lastAIPick.position, " • OVR ", lastAIPick.rating, " • $", lastAIPick.price, "M)"] }
          ), /*#__PURE__*/
          _jsxs("span", { style: { color: '#94a3b8' }, children: ["Presupuesto IA: ", /*#__PURE__*/
            _jsxs("b", { style: { color: '#4ade80' }, children: ["$", budget2.toFixed(1), "M"] }), " (", squad2.length, "/16)"] }
          )] }
        )] }

      ), /*#__PURE__*/


      _jsxs("div", { className: "panel", style: { marginBottom: '1.15rem' }, children: [/*#__PURE__*/
        _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }, children: [/*#__PURE__*/
          _jsx("h3", { style: { color: '#facc15', fontSize: '1.05rem' }, children: "SOBRE ABIERTO (7 CARTAS DISPONIBLES • ELEGÍ 1 PARA TU PLANTEL)" }

          ), /*#__PURE__*/
          _jsx("span", { style: { fontSize: '0.78rem', color: '#94a3b8' }, children: "Ningún jugador puede repetirse entre ambos equipos" }

          )] }
        ), /*#__PURE__*/

        _jsx("div", { className: "pack-grid-7", children:
          currentPack.map((card) => {
            const overMax = card.price > maxSpendable;
            const overTotal = card.price > currentBudget;
            const disabled = overMax || overTotal;
            const reason = overTotal ? 'Sin Saldo' : overMax ? 'Reserva 16' : '';
            return (/*#__PURE__*/
              _jsx(PlayerCard, {

                player: card,
                disabled: disabled,
                disabledReason: reason,
                onSelect: handleSelectCard }, card.id
              ));

          }) }
        )] }
      ), /*#__PURE__*/


      _jsxs("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1rem' }, children: [/*#__PURE__*/
        _jsxs("div", { className: "panel", children: [/*#__PURE__*/
          _jsxs("h3", { style: { color: '#facc15', fontSize: '0.98rem', marginBottom: '0.6rem' }, children: ["📋 Plantel de ",
            team1Config.name, " (", squad1.length, "/16) — Saldo: $", budget1.toFixed(1), "M"] }
          ),
          squad1.length === 0 ? /*#__PURE__*/
          _jsx("p", { style: { fontSize: '0.82rem', color: '#64748b' }, children: "Aún sin fichajes. Elegí tu primera carta arriba." }) : /*#__PURE__*/

          _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }, children:
            squad1.map((p, idx) => /*#__PURE__*/
            _jsxs("span", {

              style: {
                background: '#1e293b',
                border: '1px solid rgba(250,204,21,0.35)',
                borderRadius: '5px',
                padding: '0.22rem 0.5rem',
                fontSize: '0.75rem'
              }, children: [/*#__PURE__*/

              _jsxs("b", { children: [idx + 1, "."] }), " ", /*#__PURE__*/_jsx("span", { style: { color: '#facc15', fontWeight: 700 }, children: p.position }), " ", p.name, " (", p.rating, ")"] }, p.id
            )
            ) }
          )] }

        ), /*#__PURE__*/

        _jsxs("div", { className: "panel", children: [/*#__PURE__*/
          _jsxs("h3", { style: { color: '#38bdf8', fontSize: '0.98rem', marginBottom: '0.6rem' }, children: ["📋 Plantel de ",
            team2Config.name, " (", squad2.length, "/16) — Saldo: $", budget2.toFixed(1), "M"] }
          ),
          squad2.length === 0 ? /*#__PURE__*/
          _jsx("p", { style: { fontSize: '0.82rem', color: '#64748b' }, children: "Esperando primer fichaje..." }) : /*#__PURE__*/

          _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }, children:
            squad2.map((p, idx) => /*#__PURE__*/
            _jsxs("span", {

              style: {
                background: '#1e293b',
                border: '1px solid rgba(56,189,248,0.35)',
                borderRadius: '5px',
                padding: '0.22rem 0.5rem',
                fontSize: '0.75rem'
              }, children: [/*#__PURE__*/

              _jsxs("b", { children: [idx + 1, "."] }), " ", /*#__PURE__*/_jsx("span", { style: { color: '#38bdf8', fontWeight: 700 }, children: p.position }), " ", p.name, " (", p.rating, ")"] }, p.id
            )
            ) }
          )] }

        )] }
      )] }
    ));

}
````

---

## ⚛️ Código Fuente Original en React JSX (`DraftScreen.jsx`)

> **Archivo original:** `src\components\DraftScreen.jsx`  
> **Líneas JSX:** 339  
> **Tamaño:** 12.67 KB

<details>
<summary><b>Haz clic aquí para desplegar el código fuente original en JSX</b></summary>

````jsx
import React, { useState, useMemo } from 'react'
import {
  INITIAL_BUDGET,
  TOTAL_ROUNDS,
  REROLL_COST,
  getMaxSpendableForRound,
  canRerollPack,
  generateDraftPack,
  selectAICardFromPack,
  getPositionalCounts
} from '../draft/draftEngine.js'
import PlayerCard from './PlayerCard.jsx'

export default function DraftScreen({
  gameMode,
  team1Config,
  team2Config,
  onDraftComplete,
  onCancel
}) {
  const [round, setRound] = useState(1)
  const [activeTurn, setActiveTurn] = useState(1) // 1 = Equipo 1, 2 = Equipo 2 (en PvP Local)
  const [usedIds, setUsedIds] = useState(() => new Set())

  const [budget1, setBudget1] = useState(INITIAL_BUDGET)
  const [budget2, setBudget2] = useState(INITIAL_BUDGET)
  const [squad1, setSquad1] = useState([])
  const [squad2, setSquad2] = useState([])

  const [rerolledThisTurn, setRerolledThisTurn] = useState(false)
  const [lastAIPick, setLastAIPick] = useState(null)

  const [currentPack, setCurrentPack] = useState(() =>
    generateDraftPack(1, new Set(), INITIAL_BUDGET, [])
  )

  const currentTeamConfig = activeTurn === 1 ? team1Config : team2Config
  const currentBudget = activeTurn === 1 ? budget1 : budget2
  const currentSquad = activeTurn === 1 ? squad1 : squad2

  const maxSpendable = useMemo(
    () => getMaxSpendableForRound(currentBudget, currentSquad.length, usedIds),
    [currentBudget, currentSquad.length, usedIds]
  )

  const posCounts = useMemo(() => getPositionalCounts(currentSquad), [currentSquad])
  const canReroll = canRerollPack(currentBudget, currentSquad.length, rerolledThisTurn, usedIds)

  const handleReroll = () => {
    if (!canReroll) return
    const nextBudget = Number((currentBudget - REROLL_COST).toFixed(2))
    if (activeTurn === 1) setBudget1(nextBudget)
    else setBudget2(nextBudget)

    setRerolledThisTurn(true)
    const freshPack = generateDraftPack(round, usedIds, nextBudget, currentSquad)
    setCurrentPack(freshPack)
  }

  const handleSelectCard = (card) => {
    const nextUsed = new Set(usedIds)
    nextUsed.add(card.id)

    if (activeTurn === 1) {
      const nextSquad1 = [...squad1, card]
      const nextBudget1 = Number((budget1 - card.price).toFixed(2))
      setSquad1(nextSquad1)
      setBudget1(nextBudget1)

      if (gameMode === 'pvp') {
        // Turno del Jugador 2 en la misma ronda
        setUsedIds(nextUsed)
        setActiveTurn(2)
        setRerolledThisTurn(false)
        setCurrentPack(generateDraftPack(round, nextUsed, budget2, squad2))
      } else {
        // Modo vs IA: la IA abre su sobre de 7 cartas y elige inmediatamente
        const aiPack = generateDraftPack(round, nextUsed, budget2, squad2)
        const aiPick = selectAICardFromPack(aiPack, budget2, squad2, round, nextUsed)
        nextUsed.add(aiPick.id)
        const nextSquad2 = [...squad2, aiPick]
        const nextBudget2 = Number((budget2 - aiPick.price).toFixed(2))

        setSquad2(nextSquad2)
        setBudget2(nextBudget2)
        setLastAIPick(aiPick)
        setUsedIds(nextUsed)
        setRerolledThisTurn(false)

        if (round >= TOTAL_ROUNDS) {
          onDraftComplete(nextSquad1, nextSquad2, nextBudget1, nextBudget2)
        } else {
          const nextRound = round + 1
          setRound(nextRound)
          setCurrentPack(generateDraftPack(nextRound, nextUsed, nextBudget1, nextSquad1))
        }
      }
    } else {
      // Jugador 2 en modo PvP Local termina la ronda
      const nextSquad2 = [...squad2, card]
      const nextBudget2 = Number((budget2 - card.price).toFixed(2))
      setSquad2(nextSquad2)
      setBudget2(nextBudget2)
      setUsedIds(nextUsed)
      setRerolledThisTurn(false)

      if (round >= TOTAL_ROUNDS) {
        onDraftComplete(squad1, nextSquad2, budget1, nextBudget2)
      } else {
        const nextRound = round + 1
        setRound(nextRound)
        setActiveTurn(1)
        setCurrentPack(generateDraftPack(nextRound, nextUsed, budget1, squad1))
      }
    }
  }

  // Botón para autocompletar las rondas restantes si el jugador quiere ir rápido a la pizarra
  const handleAutoFinishDraft = () => {
    const tempUsed = new Set(usedIds)
    let b1 = budget1
    let b2 = budget2
    const s1 = [...squad1]
    const s2 = [...squad2]

    // Si en PvP quedó a mitad de ronda (turno 2), completar primero el turno 2 de la ronda actual
    let startR = round
    if (gameMode === 'pvp' && activeTurn === 2) {
      const p2 = generateDraftPack(round, tempUsed, b2, s2)
      const pick2 = selectAICardFromPack(p2, b2, s2, round, tempUsed)
      tempUsed.add(pick2.id)
      s2.push(pick2)
      b2 = Number((b2 - pick2.price).toFixed(2))
      startR = round + 1
    }

    for (let r = startR; r <= TOTAL_ROUNDS; r++) {
      const p1 = generateDraftPack(r, tempUsed, b1, s1)
      const pick1 = selectAICardFromPack(p1, b1, s1, r, tempUsed)
      tempUsed.add(pick1.id)
      s1.push(pick1)
      b1 = Number((b1 - pick1.price).toFixed(2))

      const p2 = generateDraftPack(r, tempUsed, b2, s2)
      const pick2 = selectAICardFromPack(p2, b2, s2, r, tempUsed)
      tempUsed.add(pick2.id)
      s2.push(pick2)
      b2 = Number((b2 - pick2.price).toFixed(2))
    }

    onDraftComplete(s1, s2, b1, b2)
  }

  return (
    <div className="main-container">
      {/* Barra Superior de Estado del Draft */}
      <div className="panel panel-gold" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: currentTeamConfig.primaryColor,
                border: `3px solid ${currentTeamConfig.secondaryColor}`
              }}
            />
            <div>
              <div style={{ fontSize: '0.75rem', color: '#facc15', fontWeight: 700, textTransform: 'uppercase' }}>
                RONDA {round} DE {TOTAL_ROUNDS} • {round <= 11 ? 'ARMANDO 11 TITULAR' : 'BANCO DE SUPLENTES (7)'}
              </div>
              <h2 style={{ fontSize: '1.4rem', color: '#fff' }}>
                TURNO DE: {currentTeamConfig.name} {gameMode === 'pvp' ? `(JUGADOR ${activeTurn})` : ''}
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canReroll}
              onClick={handleReroll}
              title="Descarta estas 7 cartas y abre un sobre nuevo por $2.0M (máximo 1 vez por ronda)"
            >
              🔄 Reroll Sobre (-${REROLL_COST.toFixed(1)}M) {rerolledThisTurn ? '• Usado' : ''}
            </button>
            <button
              type="button"
              className="btn btn-emerald"
              onClick={handleAutoFinishDraft}
            >
              ⚡ Auto-Completar Resto del Draft
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={onCancel}>
              Volver al Menú
            </button>
          </div>
        </div>

        <div className="draft-header-bar">
          <div className="stat-metric-box">
            <span className="stat-metric-label">Presupuesto Disponible</span>
            <span className="stat-metric-value" style={{ color: '#4ade80' }}>
              ${currentBudget.toFixed(1)}M
            </span>
          </div>
          <div className="stat-metric-box">
            <span className="stat-metric-label">Gasto Máx. en esta Ronda (Reserva Anti-Bloqueo)</span>
            <span className="stat-metric-value" style={{ color: '#facc15' }}>
              ${maxSpendable.toFixed(1)}M
            </span>
          </div>
          <div className="stat-metric-box">
            <span className="stat-metric-label">Plantel Fichado</span>
            <span className="stat-metric-value">
              {currentSquad.length} / {TOTAL_ROUNDS}
            </span>
          </div>
          <div className="stat-metric-box">
            <span className="stat-metric-label">Balance por Línea (ARQ / DEF / MED / DEL)</span>
            <span className="stat-metric-value" style={{ fontSize: '1.15rem', marginTop: '0.2rem' }}>
              🧤 {posCounts.GK} &nbsp;|&nbsp; 🛡️ {posCounts.DEF} &nbsp;|&nbsp; 🧠 {posCounts.MID} &nbsp;|&nbsp; ⚽ {posCounts.ATT}
            </span>
          </div>
        </div>

        {gameMode === 'ai' && lastAIPick && (
          <div
            style={{
              background: 'rgba(30, 41, 59, 0.85)',
              borderLeft: '4px solid #38bdf8',
              padding: '0.45rem 0.75rem',
              borderRadius: '6px',
              fontSize: '0.82rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <span>
              🤖 <b>{team2Config.name}</b> fichó en la última ronda a: <b>{lastAIPick.name}</b> ({lastAIPick.position} • OVR {lastAIPick.rating} • ${lastAIPick.price}M)
            </span>
            <span style={{ color: '#94a3b8' }}>
              Presupuesto IA: <b style={{ color: '#4ade80' }}>${budget2.toFixed(1)}M</b> ({squad2.length}/16)
            </span>
          </div>
        )}
      </div>

      {/* Sobre de 7 Cartas */}
      <div className="panel" style={{ marginBottom: '1.15rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <h3 style={{ color: '#facc15', fontSize: '1.05rem' }}>
            SOBRE ABIERTO (7 CARTAS DISPONIBLES • ELEGÍ 1 PARA TU PLANTEL)
          </h3>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
            Ningún jugador puede repetirse entre ambos equipos
          </span>
        </div>

        <div className="pack-grid-7">
          {currentPack.map((card) => {
            const overMax = card.price > maxSpendable
            const overTotal = card.price > currentBudget
            const disabled = overMax || overTotal
            const reason = overTotal ? 'Sin Saldo' : (overMax ? 'Reserva 16' : '')
            return (
              <PlayerCard
                key={card.id}
                player={card}
                disabled={disabled}
                disabledReason={reason}
                onSelect={handleSelectCard}
              />
            )
          })}
        </div>
      </div>

      {/* Resumen de Planteles Fichados hasta ahora */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1rem' }}>
        <div className="panel">
          <h3 style={{ color: '#facc15', fontSize: '0.98rem', marginBottom: '0.6rem' }}>
            📋 Plantel de {team1Config.name} ({squad1.length}/16) — Saldo: ${budget1.toFixed(1)}M
          </h3>
          {squad1.length === 0 ? (
            <p style={{ fontSize: '0.82rem', color: '#64748b' }}>Aún sin fichajes. Elegí tu primera carta arriba.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {squad1.map((p, idx) => (
                <span
                  key={p.id}
                  style={{
                    background: '#1e293b',
                    border: '1px solid rgba(250,204,21,0.35)',
                    borderRadius: '5px',
                    padding: '0.22rem 0.5rem',
                    fontSize: '0.75rem'
                  }}
                >
                  <b>{idx + 1}.</b> <span style={{ color: '#facc15', fontWeight: 700 }}>{p.position}</span> {p.name} ({p.rating})
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <h3 style={{ color: '#38bdf8', fontSize: '0.98rem', marginBottom: '0.6rem' }}>
            📋 Plantel de {team2Config.name} ({squad2.length}/16) — Saldo: ${budget2.toFixed(1)}M
          </h3>
          {squad2.length === 0 ? (
            <p style={{ fontSize: '0.82rem', color: '#64748b' }}>Esperando primer fichaje...</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {squad2.map((p, idx) => (
                <span
                  key={p.id}
                  style={{
                    background: '#1e293b',
                    border: '1px solid rgba(56,189,248,0.35)',
                    borderRadius: '5px',
                    padding: '0.22rem 0.5rem',
                    fontSize: '0.75rem'
                  }}
                >
                  <b>{idx + 1}.</b> <span style={{ color: '#38bdf8', fontWeight: 700 }}>{p.position}</span> {p.name} ({p.rating})
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

````

</details>

