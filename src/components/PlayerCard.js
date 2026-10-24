import React, { useState } from 'react';
import { POSITION_LABELS_ES } from '../data/playersDB.js';
import { getPlayerNickname } from '../commentary/commentaryEngine.js';import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";

const TIER_CONFIG = {
  legend: { label: '★ Leyenda', className: 'tier-legend' },
  idol: { label: '◆ Ídolo', className: 'tier-idol' },
  squad: { label: '● Plantilla', className: 'tier-squad' },
  filler: { label: '○ Relleno', className: 'tier-filler' }
};

export default function PlayerCard({
  player,
  onSelect,
  disabled = false,
  disabledReason = '',
  compact = false,
  actionLabel = 'Fichar Carta'
}) {
  const [showAllStats, setShowAllStats] = useState(false);
  const tier = TIER_CONFIG[player.category] || TIER_CONFIG.squad;
  const nickname = getPlayerNickname(player.name);
  const s = player.skill || {};
  const isGK = player.position === 'GK';

  const cardStats = isGK ?
  [
  { k: 'ATA', v: s.saving },
  { k: 'AGI', v: s.agility },
  { k: 'SAL', v: s.jumping },
  { k: 'PER', v: s.perception },
  { k: 'PAS', v: s.passing },
  { k: 'FUE', v: s.strength },
  { k: 'TL', v: s.freekick },
  { k: 'PEN', v: s.penalty_taking },
  { k: 'ALT', v: `${player.height}cm`, isAlt: true }] :

  [
  { k: 'PAS', v: s.passing },
  { k: 'TIR', v: s.shooting },
  { k: 'ENT', v: s.tackling },
  { k: 'AGI', v: s.agility },
  { k: 'FUE', v: s.strength },
  { k: 'CON', v: s.control },
  { k: 'TL', v: s.freekick },
  { k: 'PEN', v: s.penalty_taking },
  { k: 'ALT', v: `${player.height}cm`, isAlt: true }];


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
  { k: 'Tiro Libre (TL)', v: s.freekick }];


  const getStatClass = (val) => {
    if (val >= 90) return 'card-stat-val stat-elite';
    if (val >= 80) return 'card-stat-val stat-good';
    return 'card-stat-val';
  };

  return (/*#__PURE__*/
    _jsxs("div", {
      className: `player-card ${tier.className} ${onSelect ? 'clickable' : ''} ${disabled ? 'card-disabled' : ''}`,
      onClick: () => {
        if (!disabled && onSelect) onSelect(player);
      }, children: [/*#__PURE__*/

      _jsxs("div", { children: [/*#__PURE__*/
        _jsxs("div", { className: "card-top-row", children: [/*#__PURE__*/
          _jsxs("div", { className: "card-rating-box", children: [/*#__PURE__*/
            _jsx("span", { className: "card-ovr", children: player.rating }), /*#__PURE__*/
            _jsx("span", { className: "card-pos", title: POSITION_LABELS_ES[player.position], children:
              player.position }
            )] }
          ), /*#__PURE__*/
          _jsxs("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }, children: [/*#__PURE__*/
            _jsxs("span", { className: "card-price-tag", children: ["$", player.price.toFixed(1), "M"] }), /*#__PURE__*/
            _jsx("span", { className: "card-tier-label", children: tier.label })] }
          )] }
        ), /*#__PURE__*/

        _jsx("div", { className: "card-name", children: player.name }), /*#__PURE__*/
        _jsx("div", { className: "card-nickname", children:
          nickname ? `"${nickname}"` : `${POSITION_LABELS_ES[player.position]} • ${player.height} cm` }
        ), /*#__PURE__*/

        _jsx("div", { className: "card-multi-positions", children:
          (Array.isArray(player.positions) && player.positions.length > 0 ? player.positions : [player.position]).map((pos, idx) => /*#__PURE__*/
          _jsx("span", {

            className: `pos-pill ${idx > 0 ? 'secondary' : ''}`,
            title: POSITION_LABELS_ES[pos] || pos, children:

            pos }, pos
          )
          ) }
        ),

        player.specialty && /*#__PURE__*/
        _jsx("div", { className: "card-specialty", children: /*#__PURE__*/
          _jsx("span", { children: player.specialty }) }
        ),


        !compact && /*#__PURE__*/
        _jsxs(_Fragment, { children: [/*#__PURE__*/
          _jsx("div", { className: "card-stats-grid", children:
            cardStats.map((st) => /*#__PURE__*/
            _jsxs("div", { className: "card-stat-item", children: [/*#__PURE__*/
              _jsx("span", { className: "card-stat-label", children: st.k }), /*#__PURE__*/
              _jsx("span", { className: st.isAlt ? 'card-stat-val' : getStatClass(st.v), style: st.isAlt ? { fontSize: '0.64rem', color: '#f1f5f9' } : undefined, children:
                st.v }
              )] }, st.k
            )
            ) }
          ),

          showAllStats && /*#__PURE__*/
          _jsx("div", {
            style: {
              background: 'rgba(0,0,0,0.68)',
              padding: '0.45rem',
              borderRadius: '6px',
              marginBottom: '0.45rem',
              fontSize: '0.67rem'
            },
            onClick: (e) => e.stopPropagation(), children:

            allStats.map((item) => /*#__PURE__*/
            _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', padding: '1px 0' }, children: [/*#__PURE__*/
              _jsx("span", { style: { color: '#94a3b8' }, children: item.k }), /*#__PURE__*/
              _jsx("span", { className: getStatClass(item.v), children: item.v })] }, item.k
            )
            ) }
          )] }

        )] }

      ),

      !compact && /*#__PURE__*/
      _jsxs("div", { style: { display: 'flex', gap: '0.35rem', marginTop: '0.2rem' }, children: [/*#__PURE__*/
        _jsx("button", {
          type: "button",
          className: "btn btn-outline btn-sm",
          style: { padding: '0.28rem 0.45rem', fontSize: '0.66rem' },
          onClick: (e) => {
            e.stopPropagation();
            setShowAllStats(!showAllStats);
          }, children:

          showAllStats ? 'Ocultar' : '11 Stats' }
        ),
        onSelect && /*#__PURE__*/
        _jsx("button", {
          type: "button",
          className: `btn btn-sm ${disabled ? 'btn-outline' : 'btn-gold'}`,
          style: { flex: 1, padding: '0.28rem 0.4rem', fontSize: '0.72rem' },
          disabled: disabled,
          onClick: (e) => {
            e.stopPropagation();
            if (!disabled) onSelect(player);
          }, children:

          disabled ? disabledReason || 'Sin Saldo' : actionLabel }
        )] }

      )] }

    ));

}