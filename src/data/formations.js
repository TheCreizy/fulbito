// Formaciones Tácticas y Mentalidades para cancha de 680 x 1050
// Nota: Las coordenadas base están definidas para el equipo que defiende el arco SUPERIOR (y = 0)
// y ataca hacia el arco INFERIOR (y = 1050). El motor invierte automáticamente Y (1050 - y)
// para el equipo que defiende el arco inferior o al cambiar de lado en el entretiempo.

export const PITCH_CONFIG = {
  pitchWidth: 680,
  pitchHeight: 1050,
  goalWidth: 90
}

export const FORMATIONS = {
  '4-4-2': {
    id: '4-4-2',
    name: '4-4-2 Clásico',
    defaultPlayStyle: 'wingPlay',
    description: 'Equilibrio total entre defensa y ataque con doble 9 y bandas cubiertas.',
    slots: [
      { index: 0, role: 'GK', label: 'ARQ', pos: [340, 30] },
      { index: 1, role: 'LB', label: 'LI', pos: [95, 165] },
      { index: 2, role: 'CB', label: 'DFC', pos: [250, 145] },
      { index: 3, role: 'CB', label: 'DFC', pos: [430, 145] },
      { index: 4, role: 'RB', label: 'LD', pos: [585, 165] },
      { index: 5, role: 'LM', label: 'MI', pos: [105, 330] },
      { index: 6, role: 'CM', label: 'MC', pos: [255, 310] },
      { index: 7, role: 'CM', label: 'MC', pos: [425, 310] },
      { index: 8, role: 'RM', label: 'MD', pos: [575, 330] },
      { index: 9, role: 'ST', label: 'DC', pos: [260, 480] },
      { index: 10, role: 'ST', label: 'DC', pos: [420, 480] }
    ]
  },
  '4-3-1-2': {
    id: '4-3-1-2',
    name: '4-3-1-2 (Rombo con Enganche)',
    defaultPlayStyle: 'tikiTaka',
    description: 'El esquema clásico del fútbol argentino: un 5 tapón, dos internos, el 10 suelto y dos puntas.',
    slots: [
      { index: 0, role: 'GK', label: 'ARQ', pos: [340, 30] },
      { index: 1, role: 'LB', label: 'LI', pos: [95, 175] },
      { index: 2, role: 'CB', label: 'DFC', pos: [250, 145] },
      { index: 3, role: 'CB', label: 'DFC', pos: [430, 145] },
      { index: 4, role: 'RB', label: 'LD', pos: [585, 175] },
      { index: 5, role: 'CM', label: 'VOL I', pos: [175, 295] },
      { index: 6, role: 'CM', label: '5 TAPÓN', pos: [340, 260] },
      { index: 7, role: 'CM', label: 'VOL D', pos: [505, 295] },
      { index: 8, role: 'CAM', label: 'ENG (10)', pos: [340, 395] },
      { index: 9, role: 'ST', label: 'DC', pos: [250, 485] },
      { index: 10, role: 'ST', label: 'DC', pos: [430, 485] }
    ]
  },
  '4-3-3': {
    id: '4-3-3',
    name: '4-3-3 Ofensivo',
    defaultPlayStyle: 'wingPlay',
    description: 'Presión alta, extremos bien abiertos por las puntas y un 9 de referencia en el área.',
    slots: [
      { index: 0, role: 'GK', label: 'ARQ', pos: [340, 30] },
      { index: 1, role: 'LB', label: 'LI', pos: [75, 170] },
      { index: 2, role: 'CB', label: 'DFC', pos: [250, 145] },
      { index: 3, role: 'CB', label: 'DFC', pos: [430, 145] },
      { index: 4, role: 'RB', label: 'LD', pos: [605, 170] },
      { index: 5, role: 'CM', label: 'MC I', pos: [195, 315] },
      { index: 6, role: 'CM', label: 'MC C', pos: [340, 285] },
      { index: 7, role: 'CM', label: 'MC D', pos: [485, 315] },
      { index: 8, role: 'LM', label: 'EXT I', pos: [48, 465] },
      { index: 9, role: 'ST', label: '9 ÁREA', pos: [340, 495] },
      { index: 10, role: 'RM', label: 'EXT D', pos: [632, 465] }
    ]
  },
  '5-3-2': {
    id: '5-3-2',
    name: '5-3-2 Catenaccio',
    defaultPlayStyle: 'directCounter',
    description: 'Línea de 3 centrales más 2 carrileros, cerrojo defensivo y salida rápida de contra.',
    slots: [
      { index: 0, role: 'GK', label: 'ARQ', pos: [340, 30] },
      { index: 1, role: 'LB', label: 'CAR I', pos: [85, 200] },
      { index: 2, role: 'CB', label: 'DFC I', pos: [210, 140] },
      { index: 3, role: 'CB', label: 'LÍBERO', pos: [340, 125] },
      { index: 4, role: 'CB', label: 'DFC D', pos: [470, 140] },
      { index: 5, role: 'RB', label: 'CAR D', pos: [595, 200] },
      { index: 6, role: 'CM', label: 'MC I', pos: [210, 310] },
      { index: 7, role: 'CM', label: 'MC C', pos: [340, 290] },
      { index: 8, role: 'CM', label: 'MC D', pos: [470, 310] },
      { index: 9, role: 'ST', label: 'DC', pos: [260, 475] },
      { index: 10, role: 'ST', label: 'DC', pos: [420, 475] }
    ]
  },
  '3-5-2': {
    id: '3-5-2',
    name: '3-5-2 Bilardista',
    defaultPlayStyle: 'directCounter',
    description: 'Tres centrales ásperos, superpoblación en mitad de cancha con dos bandas y doble punta.',
    slots: [
      { index: 0, role: 'GK', label: 'ARQ', pos: [340, 30] },
      { index: 1, role: 'CB', label: 'STOP I', pos: [190, 145] },
      { index: 2, role: 'CB', label: 'LÍBERO', pos: [340, 130] },
      { index: 3, role: 'CB', label: 'STOP D', pos: [490, 145] },
      { index: 4, role: 'LM', label: 'CAR I', pos: [95, 315] },
      { index: 5, role: 'CM', label: '5 REC', pos: [250, 285] },
      { index: 6, role: 'CM', label: '5 MIX', pos: [430, 285] },
      { index: 7, role: 'RM', label: 'CAR D', pos: [585, 315] },
      { index: 8, role: 'CAM', label: 'ENG (10)', pos: [340, 390] },
      { index: 9, role: 'ST', label: 'DC', pos: [255, 485] },
      { index: 10, role: 'ST', label: 'DC', pos: [425, 485] }
    ]
  },
  '4-2-3-1': {
    id: '4-2-3-1',
    name: '4-2-3-1 Moderno',
    defaultPlayStyle: 'tikiTaka',
    description: 'Doble pivote central respaldando a tres mediapuntas creativos y un único artillero.',
    slots: [
      { index: 0, role: 'GK', label: 'ARQ', pos: [340, 30] },
      { index: 1, role: 'LB', label: 'LI', pos: [95, 165] },
      { index: 2, role: 'CB', label: 'DFC', pos: [250, 145] },
      { index: 3, role: 'CB', label: 'DFC', pos: [430, 145] },
      { index: 4, role: 'RB', label: 'LD', pos: [585, 165] },
      { index: 5, role: 'CM', label: 'PIV I', pos: [250, 275] },
      { index: 6, role: 'CM', label: 'PIV D', pos: [430, 275] },
      { index: 7, role: 'LM', label: 'MP I', pos: [125, 395] },
      { index: 8, role: 'CAM', label: 'MP C', pos: [340, 390] },
      { index: 9, role: 'RM', label: 'MP D', pos: [555, 395] },
      { index: 10, role: 'ST', label: '9 ÁREA', pos: [340, 495] }
    ]
  }
}

export const PLAY_STYLES = {
  wingPlay: {
    id: 'wingPlay',
    name: 'Bandas y Centros',
    shortLabel: 'Bandas',
    color: '#06b6d4',
    description: 'Abre la cancha al máximo con los laterales y extremos en la cal, genera desdoblamientos por fuera y bombardea el área con centros.',
    switchBoost: 0.95,
    crossBoost: 1.85,
    gambetaBoost: 1.30,
    throughBoost: 1.55,
    carryPatience: 1.25,
    overlapRate: 1.65
  },
  tikiTaka: {
    id: 'tikiTaka',
    name: 'Gambeta y Asociación',
    shortLabel: 'Gambeta / 10',
    color: '#f59e0b',
    description: 'Pausa, tenencia, protagonismo del Enganche (10), paredes cortas, gambeta 1v1 para romper líneas y llegadas tocando al área.',
    switchBoost: 0.85,
    crossBoost: 0.70,
    gambetaBoost: 1.55,
    throughBoost: 1.35,
    carryPatience: 1.45,
    overlapRate: 0.8
  },
  directCounter: {
    id: 'directCounter',
    name: 'Vertical / Contraataque',
    shortLabel: 'Vertical',
    color: '#a855f7',
    description: 'Transiciones rápidas sin pausa: diagonales al espacio y pases largos filtrados a espaldas de los defensores.',
    switchBoost: 0.90,
    crossBoost: 1.15,
    gambetaBoost: 1.10,
    throughBoost: 1.70,
    carryPatience: 0.90,
    overlapRate: 0.7
  },
  balanced: {
    id: 'balanced',
    name: 'Equilibrado / Dinámico',
    shortLabel: 'Dinámico',
    color: '#10b981',
    description: 'Combina temporización, cambios de frente cuando una banda se cierra, subida alternada de laterales y juego entre líneas.',
    switchBoost: 0.95,
    crossBoost: 1.35,
    gambetaBoost: 1.20,
    throughBoost: 1.25,
    carryPatience: 1.20,
    overlapRate: 1.1
  }
}

export function getPlayStyleConfig(playStyleId, formationId = '4-4-2') {
  if (playStyleId && PLAY_STYLES[playStyleId]) return PLAY_STYLES[playStyleId]
  const defaultId = FORMATIONS[formationId]?.defaultPlayStyle || 'balanced'
  return PLAY_STYLES[defaultId] || PLAY_STYLES.balanced
}

export const MENTALITIES = {
  defensive: {
    id: 'defensive',
    name: 'Defensiva / Contraataque',
    shortLabel: 'Defensiva',
    yShift: -35, // Retrasa las líneas hacia el propio arco
    color: '#3b82f6',
    description: 'Líneas replegadas cerca del arco propio, menor desgaste físico y pelotazos largos a los puntas.'
  },
  balanced: {
    id: 'balanced',
    name: 'Equilibrada',
    shortLabel: 'Equilibrada',
    yShift: 0,
    color: '#10b981',
    description: 'Bloque compacto en mitad de cancha, balance entre tenencia de pelota y solidez defensiva.'
  },
  offensive: {
    id: 'offensive',
    name: 'Ofensiva / Presión Alta',
    shortLabel: 'Ofensiva',
    yShift: 45, // Adelanta las líneas hacia campo rival
    color: '#ef4444',
    description: 'Adelanta las líneas para ahogar al rival y buscar el arco, con mayor desgaste físico.'
  }
}

/**
 * Calcula las coordenadas [x, y] de los 11 slots para una formación y mentalidad dadas,
 * teniendo en cuenta si el equipo defiende el lado 'top' (y cerca de 0) o 'bottom' (y cerca de 1050).
 */
export function getFormationCoordinates(formationId, mentalityId = 'balanced', side = 'top') {
  const formation = FORMATIONS[formationId] || FORMATIONS['4-4-2']
  const mentality = MENTALITIES[mentalityId] || MENTALITIES.balanced
  const { pitchHeight, pitchWidth } = PITCH_CONFIG

  return formation.slots.map((slot, idx) => {
    const baseX = slot.pos[0]
    let baseY = slot.pos[1]
    if (idx > 0) {
      // No mover al arquero con la mentalidad
      baseY = Math.max(60, Math.min(510, baseY + mentality.yShift))
    }
    const finalY = side === 'bottom' ? pitchHeight - baseY : baseY
    const finalX = side === 'bottom' ? pitchWidth - baseX : baseX
    return {
      ...slot,
      coords: [finalX, finalY]
    }
  })
}
