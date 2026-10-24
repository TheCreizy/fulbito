# `App.js` - Componente Raíz de la Aplicación

> **Categoría:** `Componentes UI / Raíz`  
> **Ubicación:** `src/App.js`  
> **Líneas de código:** 225  
> **Tamaño:** 6.90 KB

---

## 📋 Resumen del Módulo

Orquestador principal de estado y navegación de la aplicación: administra las transiciones entre pantallas (menu, draft, fut-draft, tactics, match), almacena los objetos de los equipos y maneja los reinicios.

---

## 🧩 Exportaciones y Elementos Principales

- **Línea 15:** `export default function App()`



---

## 💻 Código Fuente JavaScript (`App.js`)

````javascript
import React, { useState } from 'react';
import MainMenu from './components/MainMenu.jsx';
import DraftScreen from './components/DraftScreen.jsx';
import FutDraftScreen from './components/FutDraftScreen.jsx';
import TacticsBoard from './components/TacticsBoard.jsx';
import MatchSimulator from './components/MatchSimulator.jsx';
import {
  INITIAL_BUDGET,
  TOTAL_ROUNDS,
  generateDraftPack,
  selectAICardFromPack,
  autoSetupTeamFromSquad } from
'./draft/draftEngine.js';import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";

export default function App() {
  // Fases: 'menu' | 'draft' | 'tactics' | 'match'
  const [screen, setScreen] = useState('menu');
  const [gameMode, setGameMode] = useState('ai');
  const [team1Config, setTeam1Config] = useState({
    name: 'Xeneize Leyendas',
    primaryColor: '#1d4ed8',
    secondaryColor: '#facc15'
  });
  const [team2Config, setTeam2Config] = useState({
    name: 'Millonario Ídolos',
    primaryColor: '#ef4444',
    secondaryColor: '#ffffff'
  });

  const [team1Obj, setTeam1Obj] = useState(null);
  const [team2Obj, setTeam2Obj] = useState(null);
  const [activeTacticsTab, setActiveTacticsTab] = useState(1);
  const [rematchCounter, setRematchCounter] = useState(0);

  // Iniciar el modo Draft normal de 16 rondas
  const handleStartDraft = (mode, cfg1, cfg2) => {
    setGameMode(mode);
    setTeam1Config(cfg1);
    setTeam2Config(cfg2);
    setScreen('draft');
  };

  // Iniciar el nuevo FUT Draft Táctico estilo FIFA Ultimate Team
  const handleStartFutDraft = (mode, cfg1, cfg2) => {
    setGameMode(mode);
    setTeam1Config(cfg1);
    setTeam2Config(cfg2);
    setScreen('fut-draft');
  };

  // Al terminar el FUT Draft Táctico
  const handleFutDraftComplete = (t1, t2) => {
    setTeam1Obj(t1);
    setTeam2Obj(t2);
    setActiveTacticsTab(1);
    setScreen('tactics');
  };

  // Iniciar Partido Rápido (genera automáticamente ambos planteles de 16 jugadores respetando los $250M y pasa a Pizarra Táctica)
  const handleStartQuickMatch = (mode, cfg1, cfg2) => {
    setGameMode(mode);
    setTeam1Config(cfg1);
    setTeam2Config(cfg2);

    const used = new Set();
    let b1 = INITIAL_BUDGET;
    let b2 = INITIAL_BUDGET;
    const s1 = [];
    const s2 = [];

    for (let r = 1; r <= TOTAL_ROUNDS; r++) {
      const p1 = generateDraftPack(r, used, b1, s1);
      const pick1 = selectAICardFromPack(p1, b1, s1, r, used);
      used.add(pick1.id);
      s1.push(pick1);
      b1 = Number((b1 - pick1.price).toFixed(2));

      const p2 = generateDraftPack(r, used, b2, s2);
      const pick2 = selectAICardFromPack(p2, b2, s2, r, used);
      used.add(pick2.id);
      s2.push(pick2);
      b2 = Number((b2 - pick2.price).toFixed(2));
    }

    const t1 = autoSetupTeamFromSquad(s1, {
      teamName: cfg1.name,
      primaryColor: cfg1.primaryColor,
      secondaryColor: cfg1.secondaryColor,
      formationId: '4-3-1-2',
      mentalityId: 'balanced'
    });
    const t2 = autoSetupTeamFromSquad(s2, {
      teamName: cfg2.name,
      primaryColor: cfg2.primaryColor,
      secondaryColor: cfg2.secondaryColor,
      formationId: '4-3-3',
      mentalityId: 'balanced'
    });

    setTeam1Obj(t1);
    setTeam2Obj(t2);
    setActiveTacticsTab(1);
    setScreen('tactics');
  };

  // Al terminar las 16 rondas del Draft
  const handleDraftComplete = (squad1, squad2) => {
    const t1 = autoSetupTeamFromSquad(squad1, {
      teamName: team1Config.name,
      primaryColor: team1Config.primaryColor,
      secondaryColor: team1Config.secondaryColor,
      formationId: '4-4-2',
      mentalityId: 'balanced'
    });
    const t2 = autoSetupTeamFromSquad(squad2, {
      teamName: team2Config.name,
      primaryColor: team2Config.primaryColor,
      secondaryColor: team2Config.secondaryColor,
      formationId: '4-3-3',
      mentalityId: 'balanced'
    });

    setTeam1Obj(t1);
    setTeam2Obj(t2);
    setActiveTacticsTab(1);
    setScreen('tactics');
  };

  return (/*#__PURE__*/
    _jsxs("div", { children: [/*#__PURE__*/

      _jsxs("header", { className: "app-header", children: [/*#__PURE__*/
        _jsxs("div", { className: "brand-logo", children: [/*#__PURE__*/
          _jsx("span", { className: "brand-badge", children: "PCF 98 • v2.0" }), /*#__PURE__*/
          _jsxs("div", { children: [/*#__PURE__*/
            _jsx("div", { className: "brand-title", children: "PC FÚTBOL DE PRIMERA • MANAGER & SIMULADOR 2D" }), /*#__PURE__*/
            _jsx("div", { className: "brand-subtitle", children: "200 Jugadores Polifuncionales • FUT Draft Táctico • Relatos de Marcelo Araujo & Enrique Macaya Márquez" }

            )] }
          )] }
        ), /*#__PURE__*/

        _jsx("div", { style: { display: 'flex', alignItems: 'center', gap: '0.6rem' }, children:
          screen !== 'menu' && /*#__PURE__*/
          _jsx("button", {
            type: "button",
            className: "btn btn-outline btn-sm",
            onClick: () => setScreen('menu'), children:
            "🏠 Menú Principal" }

          ) }

        )] }
      ),

      screen === 'menu' && /*#__PURE__*/
      _jsx(MainMenu, {
        onStartDraft: handleStartDraft,
        onStartFutDraft: handleStartFutDraft,
        onStartQuickMatch: handleStartQuickMatch }
      ),


      screen === 'fut-draft' && /*#__PURE__*/
      _jsx(FutDraftScreen, {
        gameMode: gameMode,
        team1Config: team1Config,
        team2Config: team2Config,
        onDraftComplete: handleFutDraftComplete,
        onCancel: () => setScreen('menu') }
      ),


      screen === 'draft' && /*#__PURE__*/
      _jsx(DraftScreen, {
        gameMode: gameMode,
        team1Config: team1Config,
        team2Config: team2Config,
        onDraftComplete: handleDraftComplete,
        onCancel: () => setScreen('menu') }
      ),


      screen === 'tactics' && team1Obj && team2Obj && /*#__PURE__*/
      _jsx(TacticsBoard, {
        team: activeTacticsTab === 1 ? team1Obj : team2Obj,
        onUpdateTeam: (updated) => {
          if (activeTacticsTab === 1) setTeam1Obj(updated);else
          setTeam2Obj(updated);
        },
        isLiveMatch: false,
        onConfirm: () => {
          if (gameMode === 'pvp' && activeTacticsTab === 1) {
            setActiveTacticsTab(2);
          } else {
            setScreen('match');
          }
        },
        confirmLabel:
        gameMode === 'pvp' && activeTacticsTab === 1 ?
        `Guardar y Configurar ${team2Obj.name} ➡️` :
        '¡Salir a la Cancha y Jugar Partido! ⚽',

        secondaryTeamTab: {
          activeTeamIndex: activeTacticsTab,
          onSwitchTeam: (idx) => setActiveTacticsTab(idx),
          team1Name: team1Obj.name,
          team2Name: team2Obj.name
        } }
      ),


      screen === 'match' && team1Obj && team2Obj && /*#__PURE__*/
      _jsx(MatchSimulator, {

        initialTeam1: team1Obj,
        initialTeam2: team2Obj,
        gameMode: gameMode,
        onReturnToMenu: () => setScreen('menu'),
        onPlayRematch: () => setRematchCounter((c) => c + 1) }, rematchCounter
      )] }

    ));

}
````

---

## ⚛️ Código Fuente Original en React JSX (`App.jsx`)

> **Archivo original:** `src/App.jsx`  
> **Líneas JSX:** 226  
> **Tamaño:** 6.67 KB

<details>
<summary><b>Haz clic aquí para desplegar el código fuente original en JSX</b></summary>

````jsx
import React, { useState } from 'react'
import MainMenu from './components/MainMenu.jsx'
import DraftScreen from './components/DraftScreen.jsx'
import FutDraftScreen from './components/FutDraftScreen.jsx'
import TacticsBoard from './components/TacticsBoard.jsx'
import MatchSimulator from './components/MatchSimulator.jsx'
import {
  INITIAL_BUDGET,
  TOTAL_ROUNDS,
  generateDraftPack,
  selectAICardFromPack,
  autoSetupTeamFromSquad
} from './draft/draftEngine.js'

export default function App() {
  // Fases: 'menu' | 'draft' | 'tactics' | 'match'
  const [screen, setScreen] = useState('menu')
  const [gameMode, setGameMode] = useState('ai')
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

  const [team1Obj, setTeam1Obj] = useState(null)
  const [team2Obj, setTeam2Obj] = useState(null)
  const [activeTacticsTab, setActiveTacticsTab] = useState(1)
  const [rematchCounter, setRematchCounter] = useState(0)

  // Iniciar el modo Draft normal de 16 rondas
  const handleStartDraft = (mode, cfg1, cfg2) => {
    setGameMode(mode)
    setTeam1Config(cfg1)
    setTeam2Config(cfg2)
    setScreen('draft')
  }

  // Iniciar el nuevo FUT Draft Táctico estilo FIFA Ultimate Team
  const handleStartFutDraft = (mode, cfg1, cfg2) => {
    setGameMode(mode)
    setTeam1Config(cfg1)
    setTeam2Config(cfg2)
    setScreen('fut-draft')
  }

  // Al terminar el FUT Draft Táctico
  const handleFutDraftComplete = (t1, t2) => {
    setTeam1Obj(t1)
    setTeam2Obj(t2)
    setActiveTacticsTab(1)
    setScreen('tactics')
  }

  // Iniciar Partido Rápido (genera automáticamente ambos planteles de 16 jugadores respetando los $250M y pasa a Pizarra Táctica)
  const handleStartQuickMatch = (mode, cfg1, cfg2) => {
    setGameMode(mode)
    setTeam1Config(cfg1)
    setTeam2Config(cfg2)

    const used = new Set()
    let b1 = INITIAL_BUDGET
    let b2 = INITIAL_BUDGET
    const s1 = []
    const s2 = []

    for (let r = 1; r <= TOTAL_ROUNDS; r++) {
      const p1 = generateDraftPack(r, used, b1, s1)
      const pick1 = selectAICardFromPack(p1, b1, s1, r, used)
      used.add(pick1.id)
      s1.push(pick1)
      b1 = Number((b1 - pick1.price).toFixed(2))

      const p2 = generateDraftPack(r, used, b2, s2)
      const pick2 = selectAICardFromPack(p2, b2, s2, r, used)
      used.add(pick2.id)
      s2.push(pick2)
      b2 = Number((b2 - pick2.price).toFixed(2))
    }

    const t1 = autoSetupTeamFromSquad(s1, {
      teamName: cfg1.name,
      primaryColor: cfg1.primaryColor,
      secondaryColor: cfg1.secondaryColor,
      formationId: '4-3-1-2',
      mentalityId: 'balanced'
    })
    const t2 = autoSetupTeamFromSquad(s2, {
      teamName: cfg2.name,
      primaryColor: cfg2.primaryColor,
      secondaryColor: cfg2.secondaryColor,
      formationId: '4-3-3',
      mentalityId: 'balanced'
    })

    setTeam1Obj(t1)
    setTeam2Obj(t2)
    setActiveTacticsTab(1)
    setScreen('tactics')
  }

  // Al terminar las 16 rondas del Draft
  const handleDraftComplete = (squad1, squad2) => {
    const t1 = autoSetupTeamFromSquad(squad1, {
      teamName: team1Config.name,
      primaryColor: team1Config.primaryColor,
      secondaryColor: team1Config.secondaryColor,
      formationId: '4-4-2',
      mentalityId: 'balanced'
    })
    const t2 = autoSetupTeamFromSquad(squad2, {
      teamName: team2Config.name,
      primaryColor: team2Config.primaryColor,
      secondaryColor: team2Config.secondaryColor,
      formationId: '4-3-3',
      mentalityId: 'balanced'
    })

    setTeam1Obj(t1)
    setTeam2Obj(t2)
    setActiveTacticsTab(1)
    setScreen('tactics')
  }

  return (
    <div>
      {/* Header Permanente Estilo PC Fútbol */}
      <header className="app-header">
        <div className="brand-logo">
          <span className="brand-badge">PCF 98 • v2.0</span>
          <div>
            <div className="brand-title">PC FÚTBOL DE PRIMERA • MANAGER & SIMULADOR 2D</div>
            <div className="brand-subtitle">
              200 Jugadores Polifuncionales • FUT Draft Táctico • Relatos de Marcelo Araujo & Enrique Macaya Márquez
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {screen !== 'menu' && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setScreen('menu')}
            >
              🏠 Menú Principal
            </button>
          )}
        </div>
      </header>

      {screen === 'menu' && (
        <MainMenu
          onStartDraft={handleStartDraft}
          onStartFutDraft={handleStartFutDraft}
          onStartQuickMatch={handleStartQuickMatch}
        />
      )}

      {screen === 'fut-draft' && (
        <FutDraftScreen
          gameMode={gameMode}
          team1Config={team1Config}
          team2Config={team2Config}
          onDraftComplete={handleFutDraftComplete}
          onCancel={() => setScreen('menu')}
        />
      )}

      {screen === 'draft' && (
        <DraftScreen
          gameMode={gameMode}
          team1Config={team1Config}
          team2Config={team2Config}
          onDraftComplete={handleDraftComplete}
          onCancel={() => setScreen('menu')}
        />
      )}

      {screen === 'tactics' && team1Obj && team2Obj && (
        <TacticsBoard
          team={activeTacticsTab === 1 ? team1Obj : team2Obj}
          onUpdateTeam={(updated) => {
            if (activeTacticsTab === 1) setTeam1Obj(updated)
            else setTeam2Obj(updated)
          }}
          isLiveMatch={false}
          onConfirm={() => {
            if (gameMode === 'pvp' && activeTacticsTab === 1) {
              setActiveTacticsTab(2)
            } else {
              setScreen('match')
            }
          }}
          confirmLabel={
            gameMode === 'pvp' && activeTacticsTab === 1
              ? `Guardar y Configurar ${team2Obj.name} ➡️`
              : '¡Salir a la Cancha y Jugar Partido! ⚽'
          }
          secondaryTeamTab={{
            activeTeamIndex: activeTacticsTab,
            onSwitchTeam: (idx) => setActiveTacticsTab(idx),
            team1Name: team1Obj.name,
            team2Name: team2Obj.name
          }}
        />
      )}

      {screen === 'match' && team1Obj && team2Obj && (
        <MatchSimulator
          key={rematchCounter}
          initialTeam1={team1Obj}
          initialTeam2={team2Obj}
          gameMode={gameMode}
          onReturnToMenu={() => setScreen('menu')}
          onPlayRematch={() => setRematchCounter(c => c + 1)}
        />
      )}
    </div>
  )
}

````

</details>

