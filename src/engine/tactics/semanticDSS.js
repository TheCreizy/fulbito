/**
 * semanticDSS.js — Motor Semántico DSS (Decision Support System) de Fulbito 2.2
 * 
 * Implementa la especificación de Fase 9 (9.1, 9.2, 9.3) de Fulbito 2.2:
 * 1. Espacio vectorial continuo de 14 Macro-Atributos normalizados V_team(t) en [0, 1]^14.
 * 2. Catálogo de las 20 Estrategias Canónicas.
 * 3. Métrica de distancia asimétrica d_adapt ponderada para adaptación dinámica y contra-estrategias.
 */

export const SEMANTIC_MACRO_ATTRIBUTES = [
  'pressing_height',          // 0: Altura de la línea de presión (0=bajo, 1=asfixiante)
  'defensive_width',          // 1: Anchura del bloque sin balón (0=muy estrecho, 1=muy amplio)
  'offensive_tempo',          // 2: Velocidad de circulación en posesión
  'pass_directness',          // 3: Verticalidad de pases (0=asociativo corto, 1=directo vertical)
  'possession_patience',      // 4: Paciencia para encontrar pase filtrado vs apurar el tiro
  'counter_aggression',       // 5: Intensidad del contraataque tras recuperar
  'rest_defence_depth',       // 6: Profundidad del retén de cobertura (3 atrás)
  'overlap_frequency',        // 7: Proyección de laterales por banda
  'half_space_occupation',    // 8: Densidad de ocupación de los carriles interiores 10/12
  'box_overload_intensity',   // 9: Carga de atacantes a las 4 Zonas de Remate
  'foul_restraint',           // 10: Disciplina defensiva y autoprotección ante faltas
  'dribble_risk_tolerance',   // 11: Propensión a la gambeta 1v1 en el último tercio
  'aerial_duel_reliance',     // 12: Búsqueda del juego aéreo / centros a las torres
  'transition_speed'          // 13: Celeridad en reorganización defensiva y ofensiva
];

/**
 * 20 Estrategias Canónicas representadas en el espacio vectorial R^14
 */
export const CANONICAL_STRATEGIES = {
  TIKI_TAKA: {
    id: 'TIKI_TAKA',
    name: 'Tiki-Taka / Juego de Posición',
    vector: [0.75, 0.65, 0.85, 0.20, 0.90, 0.40, 0.70, 0.80, 0.95, 0.70, 0.85, 0.65, 0.30, 0.80],
    description: 'Control absoluto mediante posesión corta, rondos, half-spaces y paciencia.'
  },
  GEGENPRESSING: {
    id: 'GEGENPRESSING',
    name: 'Gegenpressing / Presión Tras Pérdida',
    vector: [0.95, 0.70, 0.90, 0.65, 0.40, 0.95, 0.80, 0.75, 0.85, 0.85, 0.60, 0.60, 0.55, 0.95],
    description: 'Acoso brutal en los primeros 5 segundos tras pérdida y verticalidad extrema.'
  },
  CATENACCIO: {
    id: 'CATENACCIO',
    name: 'Catenaccio Clásico con Líbero',
    vector: [0.15, 0.40, 0.40, 0.75, 0.50, 0.85, 0.95, 0.30, 0.35, 0.30, 0.50, 0.45, 0.75, 0.60],
    description: 'Líbero corrector barriendo zaga, cerrojo en área chica y salida punzante.'
  },
  DIRECT_COUNTER: {
    id: 'DIRECT_COUNTER',
    name: 'Contraataque Vertical Directo',
    vector: [0.30, 0.50, 0.80, 0.85, 0.30, 0.95, 0.65, 0.55, 0.50, 0.75, 0.70, 0.70, 0.65, 0.90],
    description: 'Esperar en bloque medio-bajo y lanzar estocadas rápidas a las bandas.'
  },
  TOTAL_FOOTBALL: {
    id: 'TOTAL_FOOTBALL',
    name: 'Fútbol Total / Polivalencia Holandesa',
    vector: [0.85, 0.80, 0.85, 0.50, 0.75, 0.80, 0.75, 0.85, 0.90, 0.85, 0.75, 0.75, 0.60, 0.90],
    description: 'Intercambio constante de posiciones, ocupación de los 5 carriles y presión.'
  },
  LOW_BLOCK_LONG_BALL: {
    id: 'LOW_BLOCK_LONG_BALL',
    name: 'Bloque Bajo y Pelotazo al 9',
    vector: [0.10, 0.35, 0.50, 0.90, 0.20, 0.70, 0.90, 0.20, 0.30, 0.60, 0.55, 0.30, 0.90, 0.55],
    description: 'Cerrar todos los caminos centrales y buscar peinada aérea del centrodelantero.'
  },
  WING_PLAY_OVERLOAD: {
    id: 'WING_PLAY_OVERLOAD',
    name: 'Juego por Bandas y Sobrecarga Exterior',
    vector: [0.65, 0.95, 0.75, 0.60, 0.60, 0.75, 0.60, 0.95, 0.45, 0.90, 0.80, 0.80, 0.85, 0.75],
    description: 'Apertura de cancha a la cal, desdoblamientos 2v1 y centros continuos al área.'
  },
  FALSE_NINE_POSSESSION: {
    id: 'FALSE_NINE_POSSESSION',
    name: 'Falso 9 y Desmarque del Tercer Hombre',
    vector: [0.80, 0.60, 0.80, 0.35, 0.85, 0.60, 0.70, 0.70, 0.95, 0.75, 0.85, 0.80, 0.25, 0.80],
    description: 'Punta que desciende a generar superioridad en Z14 y libera extremos en ruptura.'
  },
  LAVOLPIANA_BUILDUP: {
    id: 'LAVOLPIANA_BUILDUP',
    name: 'Salida Lavolpiana con Pivote Incrustado',
    vector: [0.55, 0.75, 0.70, 0.35, 0.80, 0.50, 0.85, 0.80, 0.80, 0.55, 0.90, 0.60, 0.45, 0.70],
    description: 'Pivote se mete entre centrales para generar superioridad 3v2 en salida limpia.'
  },
  HIGH_PRESS_TURNOVER: {
    id: 'HIGH_PRESS_TURNOVER',
    name: 'Presión Alta para Provocar Error en Salida',
    vector: [0.95, 0.80, 0.85, 0.60, 0.45, 0.85, 0.75, 0.70, 0.80, 0.80, 0.65, 0.65, 0.50, 0.85],
    description: 'Bloqueo coordinado de los defensores rivales en campo propio.'
  },
  MID_BLOCK_COMPACT: {
    id: 'MID_BLOCK_COMPACT',
    name: 'Bloque Medio Compacto Simétrico',
    vector: [0.50, 0.55, 0.60, 0.50, 0.65, 0.65, 0.70, 0.50, 0.65, 0.60, 0.80, 0.55, 0.60, 0.65],
    description: 'Equilibrio estricto en mitad de cancha esperando el salto a presión.'
  },
  BOX_TO_BOX_PHYSICAL: {
    id: 'BOX_TO_BOX_PHYSICAL',
    name: 'Despliegue Físico y Llegada Box-to-Box',
    vector: [0.70, 0.65, 0.80, 0.65, 0.50, 0.80, 0.65, 0.65, 0.75, 0.85, 0.60, 0.60, 0.70, 0.80],
    description: 'Volantes con pulmones inagotables que pisan las dos áreas con contundencia.'
  },
  ENGANCHE_CREATIVE: {
    id: 'ENGANCHE_CREATIVE',
    name: 'Sistema con Enganche Clásico (El 10)',
    vector: [0.55, 0.60, 0.70, 0.55, 0.75, 0.70, 0.65, 0.60, 0.90, 0.70, 0.80, 0.85, 0.40, 0.70],
    description: 'Todo el fútbol pasa por la pausa y la magia del enganche flotando en Zona 14.'
  },
  REST_DEFENCE_SHIELD: {
    id: 'REST_DEFENCE_SHIELD',
    name: 'Escudo Rest Defence Blindado (3+2)',
    vector: [0.60, 0.50, 0.65, 0.45, 0.70, 0.55, 0.95, 0.50, 0.60, 0.55, 0.85, 0.45, 0.65, 0.75],
    description: 'Cinco hombres siempre detrás de la línea del balón para inmunidad ante contraataques.'
  },
  FAST_BREAKAWAY: {
    id: 'FAST_BREAKAWAY',
    name: 'Transición Supersónica a Espaldas',
    vector: [0.40, 0.60, 0.95, 0.90, 0.25, 0.95, 0.60, 0.60, 0.55, 0.80, 0.70, 0.80, 0.50, 0.95],
    description: 'Pelotazos teledirigidos a flechas veloces sin ninguna escala intermedia.'
  },
  EXPANSIVE_WIDTH: {
    id: 'EXPANSIVE_WIDTH',
    name: 'Anchura Expansiva en 5 Carriles',
    vector: [0.70, 0.95, 0.75, 0.45, 0.70, 0.65, 0.65, 0.90, 0.75, 0.75, 0.80, 0.75, 0.60, 0.75],
    description: 'Obliga a la defensa rival a estirarse transversalmente abriendo pasillos centrales.'
  },
  CENTRAL_HALF_SPACE_CROWD: {
    id: 'CENTRAL_HALF_SPACE_CROWD',
    name: 'Sobrecarga Interior en Half-Spaces',
    vector: [0.75, 0.45, 0.80, 0.40, 0.80, 0.60, 0.70, 0.50, 0.98, 0.75, 0.85, 0.80, 0.35, 0.75],
    description: 'Acumula jugadores de toque fino en los pasillos interiores desorientando a pivotes.'
  },
  AGILE_DRIBBLE_ISOLATION: {
    id: 'AGILE_DRIBBLE_ISOLATION',
    name: 'Aislamiento 1v1 para Gambeteadores',
    vector: [0.65, 0.80, 0.75, 0.50, 0.60, 0.75, 0.60, 0.70, 0.65, 0.70, 0.75, 0.95, 0.35, 0.80],
    description: 'Genera duelos individuales para extremos desequilibrantes que quiebran marcas.'
  },
  AERIAL_TARGET_BOMBARDMENT: {
    id: 'AERIAL_TARGET_BOMBARDMENT',
    name: 'Bombardeo Aéreo al Centrodelantero Torre',
    vector: [0.45, 0.75, 0.65, 0.80, 0.35, 0.70, 0.75, 0.75, 0.40, 0.95, 0.70, 0.40, 0.98, 0.65],
    description: 'Centros bombeados constantes al segundo palo y punto penal para rematadores altos.'
  },
  PRAGMATIC_BALANCED: {
    id: 'PRAGMATIC_BALANCED',
    name: 'Pragmatismo Dinámico Equilibrado',
    vector: [0.55, 0.65, 0.65, 0.55, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65, 0.75, 0.60, 0.55, 0.65],
    description: 'Se adapta al momento del partido sin casarse con ningún dogma táctico.'
  }
};

/**
 * Ponderadores W_k para la distancia asimétrica d_adapt
 */
export const ADAPTATION_WEIGHTS = [
  1.20, // pressing_height
  0.90, // defensive_width
  1.10, // offensive_tempo
  1.15, // pass_directness
  1.00, // possession_patience
  1.25, // counter_aggression
  1.05, // rest_defence_depth
  0.95, // overlap_frequency
  1.10, // half_space_occupation
  1.05, // box_overload_intensity
  0.85, // foul_restraint
  0.90, // dribble_risk_tolerance
  0.95, // aerial_duel_reliance
  1.15  // transition_speed
];

/**
 * Calcula la distancia asimétrica ponderada entre dos vectores tácticos:
 * d_adapt(u, v) = sqrt( sum( W_k * (u_k - v_k)^2 ) )
 * 
 * @param {number[]} vecA 
 * @param {number[]} vecB 
 * @param {number[]} weights 
 * @returns {number}
 */
export function computeAsymmetricAdaptationDistance(vecA, vecB, weights = ADAPTATION_WEIGHTS) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB)) return 1.0;
  let sum = 0;
  const len = Math.min(vecA.length, vecB.length, weights.length);
  for (let i = 0; i < len; i++) {
    const diff = (vecA[i] || 0) - (vecB[i] || 0);
    sum += weights[i] * diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Calcula el vector semántico V_team(t) a partir de los jugadores y contexto de partido
 * 
 * @param {Object} team 
 * @param {Object} matchContext 
 * @returns {number[]} Vector R^14 en [0, 1]
 */
export function computeTeamSemanticVector(team, matchContext = {}) {
  if (!team || !Array.isArray(team.players)) {
    return [...CANONICAL_STRATEGIES.PRAGMATIC_BALANCED.vector];
  }

  const outfield = team.players.filter(p => !p.sentOff && p.position !== 'GK');
  const count = Math.max(1, outfield.length);

  // Promedios de atributos relevantes
  const avgPace = outfield.reduce((acc, p) => acc + (p.skill?.speed || 70), 0) / count / 100;
  const avgPass = outfield.reduce((acc, p) => acc + (p.skill?.passing || 70), 0) / count / 100;
  const avgCtrl = outfield.reduce((acc, p) => acc + (p.skill?.control || 70), 0) / count / 100;
  const avgTack = outfield.reduce((acc, p) => acc + (p.skill?.tackling || 70), 0) / count / 100;
  const avgPer = outfield.reduce((acc, p) => acc + (p.skill?.perception || 70), 0) / count / 100;
  const avgJump = outfield.reduce((acc, p) => acc + (p.skill?.jumping || 70), 0) / count / 100;
  const avgHeight = outfield.reduce((acc, p) => acc + (Number(p.height) || 180), 0) / count;

  const isAggressiveCoach = team.coachState?.ambition > 0.70;
  const isDefensiveCoach = team.coachState?.ambition < 0.35;

  const pressingHeight = isAggressiveCoach ? 0.85 : (isDefensiveCoach ? 0.25 : 0.40 + 0.30 * avgTack);
  const defensiveWidth = 0.50 + 0.25 * avgPace;
  const offensiveTempo = 0.45 + 0.45 * avgPace;
  const passDirectness = isDefensiveCoach ? 0.75 : (0.85 - 0.45 * avgPass);
  const possessionPatience = 0.30 + 0.55 * avgCtrl;
  const counterAggression = 0.40 + 0.50 * avgPace;
  const restDefenceDepth = isDefensiveCoach ? 0.85 : 0.65;
  const overlapFrequency = 0.45 + 0.40 * avgPace;
  const halfSpaceOccupation = 0.40 + 0.50 * avgCtrl;
  const boxOverloadIntensity = isAggressiveCoach ? 0.85 : 0.60;
  const foulRestraint = 0.40 + 0.50 * avgPer;
  const dribbleRiskTolerance = 0.35 + 0.55 * avgCtrl;
  const aerialReliance = (avgHeight - 170) / 25 * 0.5 + 0.5 * avgJump;
  const transitionSpeed = 0.40 + 0.55 * avgPace;

  return [
    Math.min(1.0, Math.max(0.05, pressingHeight)),
    Math.min(1.0, Math.max(0.05, defensiveWidth)),
    Math.min(1.0, Math.max(0.05, offensiveTempo)),
    Math.min(1.0, Math.max(0.05, passDirectness)),
    Math.min(1.0, Math.max(0.05, possessionPatience)),
    Math.min(1.0, Math.max(0.05, counterAggression)),
    Math.min(1.0, Math.max(0.05, restDefenceDepth)),
    Math.min(1.0, Math.max(0.05, overlapFrequency)),
    Math.min(1.0, Math.max(0.05, halfSpaceOccupation)),
    Math.min(1.0, Math.max(0.05, boxOverloadIntensity)),
    Math.min(1.0, Math.max(0.05, foulRestraint)),
    Math.min(1.0, Math.max(0.05, dribbleRiskTolerance)),
    Math.min(1.0, Math.max(0.05, aerialReliance)),
    Math.min(1.0, Math.max(0.05, transitionSpeed))
  ];
}

/**
 * Encuentra la Estrategia Canónica más afín al vector táctico del equipo
 * 
 * @param {number[]} teamVector 
 * @returns {{ strategy: Object, distance: number }}
 */
export function findClosestCanonicalStrategy(teamVector) {
  let minDistance = Infinity;
  let bestStrategy = CANONICAL_STRATEGIES.PRAGMATIC_BALANCED;

  for (const key of Object.keys(CANONICAL_STRATEGIES)) {
    const strat = CANONICAL_STRATEGIES[key];
    const dist = computeAsymmetricAdaptationDistance(teamVector, strat.vector);
    if (dist < minDistance) {
      minDistance = dist;
      bestStrategy = strat;
    }
  }

  return {
    strategy: bestStrategy,
    distance: minDistance
  };
}
