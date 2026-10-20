// Base de Datos Maestra de los 100 Jugadores (Calibración RPG: Leyendas, Ídolos, Plantilla y Relleno)
// Compatible con el motor físico footballSimulationEngine + extensiones (freekick, perception, control, traits)

// ---------------------------------------------------------------------------
// 1. Catálogo de Rasgos Únicos de Jugador (Signature Traits)
// ---------------------------------------------------------------------------
export const TRAIT_DEFINITIONS = {
  velocista_banda: {
    id: 'velocista_banda',
    label: 'Velocista de Banda',
    icon: '⚡',
    color: '#38bdf8',
    description: 'Explota las bandas, pide pases al vacío y gana en velocidad por afuera.'
  },
  playmaker_gambeteador: {
    id: 'playmaker_gambeteador',
    label: 'Playmaker Gambeteador',
    icon: '🪄',
    color: '#a855f7',
    description: 'Duelos 1v1 elusivos, pases filtrados milimétricos y remate colocado al borde del área.'
  },
  fenomeno_encarador: {
    id: 'fenomeno_encarador',
    label: 'El Fenómeno Encarador',
    icon: '🚀',
    color: '#ef4444',
    description: 'Encarada voraz directo al arco, gambeta en velocidad y penetración furiosa al área.'
  },
  organizador_mediocampo: {
    id: 'organizador_mediocampo',
    label: 'Organizador del Medio',
    icon: '🧠',
    color: '#10b981',
    description: 'Distribución quirúrgica, toque asociativo y apoyo constante entre líneas.'
  },
  lanzador_canonero: {
    id: 'lanzador_canonero',
    label: 'Lanzador y Cañonero',
    icon: '🎯',
    color: '#f59e0b',
    description: 'Cambios de frente teledirigidos a 50 metros y bombazos de media distancia.'
  },
  lateral_ofensivo: {
    id: 'lateral_ofensivo',
    label: 'Lateral con Llegada',
    icon: '🏎️',
    color: '#06b6d4',
    description: 'Proyección constante por la banda, desdobles ofensivos y centros punzantes.'
  },
  canonero_media_distancia: {
    id: 'canonero_media_distancia',
    label: 'Bomba de Afuera',
    icon: '💥',
    color: '#f97316',
    description: 'Fierrazo potente desde fuera del área con máxima violencia y efecto.'
  },
  caudillo_fisico: {
    id: 'caudillo_fisico',
    label: 'Caudillo Físico',
    icon: '🛡️',
    color: '#e11d48',
    description: 'Usa la fuerza del cuerpo en cargas hombro a hombro para despojar al rival limpiamente.'
  },
  artillero_area: {
    id: 'artillero_area',
    label: 'Artillero de Área',
    icon: '⚽',
    color: '#84cc16',
    description: 'Desmarques letales al punto penal y definición implacable de primera intención.'
  },
  muro_reflejos: {
    id: 'muro_reflejos',
    label: 'Muro Bajo los Palos',
    icon: '🧤',
    color: '#14b8a6',
    description: 'Reflejos felinos en el mano a mano y descuelgue aéreo de centros.'
  },
  recuperador_pulmon: {
    id: 'recuperador_pulmon',
    label: 'Pulmón Recuperador',
    icon: '🔋',
    color: '#eab308',
    description: 'Presión asfixiante, corte en mitad de cancha y relevos constantes.'
  }
}

// Mapa de posiciones secundarias / polifuncionalidad real para cada jugador
const EXTRA_POSITIONS_BY_ID = {
  1: ['CAM', 'CM', 'ST'],          // Diego Maradona: Enganche, Mediocampista, Segunda punta
  2: ['ST', 'RM', 'CAM', 'CM'],    // Lionel Messi: Delantero, Extremo Derecho, Enganche
  3: ['ST', 'CAM', 'CM'],          // Pelé: Delantero, Enganche, Todocampista
  4: ['ST'],                       // Ronaldo Nazário: 9 puro
  5: ['CAM', 'CM'],                // Juan Román Riquelme: Enganche, Mediocampista organizador
  6: ['ST', 'CAM', 'LM', 'RM'],    // Johan Cruyff: Delantero, Enganche, Extremo por ambas bandas
  7: ['CAM', 'CM', 'LM'],          // Zinedine Zidane: Enganche, Mediocampista, Volante izq.
  8: ['ST', 'LM', 'RM'],           // Cristiano Ronaldo: Delantero y Extremo por ambas bandas
  9: ['LM', 'CAM', 'ST'],          // Ronaldinho: Extremo Izq., Enganche y Segunda punta
  10: ['CB', 'CM'],                // Franz Beckenbauer: Líbero y Mediocampista central
  11: ['CB', 'LB'],                // Paolo Maldini: Central y Lateral Izquierdo
  12: ['LB', 'LM'],                // Roberto Carlos: Lateral y Carrilero Izquierdo
  13: ['RB', 'RM'],                // Cafú: Lateral y Carrilero Derecho
  14: ['CM', 'CB', 'CAM'],         // Lothar Matthäus: Todocampista y Líbero
  15: ['CM', 'CAM', 'LM'],         // Andrés Iniesta: Interno, Enganche y Volante Izq.
  16: ['CM', 'CAM'],               // Xavi Hernández: Organizador y Mediapunta
  17: ['ST'],                      // Gabriel Batistuta: 9 de área
  20: ['CB', 'LB'],                // Daniel Passarella: Segundo central / salida por izq.
  22: ['ST', 'CAM', 'LM', 'RM'],   // Carlos Tevez: Delantero, Enganche, Extremo
  23: ['RM', 'LM', 'CAM', 'CM'],   // Ángel Di María: Extremo der/izq, Fideo interno
  24: ['RM', 'CAM', 'ST'],         // Ariel Ortega: Win derecho, Enganche, Segunda punta
  25: ['ST', 'CAM', 'CM'],         // Enzo Francescoli: Delantero y Príncipe creador
  32: ['RB', 'RM'],                // Hugo Ibarra: 4 clásico y carrilero derecho
  33: ['RB', 'RM', 'CM', 'LB'],    // Javier Zanetti: Polifuncional total (4, 8, 5, 3)
  34: ['LB', 'LM', 'CM'],          // Juan Pablo Sorín: 3, carrilero y volante interno
  36: ['CM', 'RM'],                // Diego Simeone: 5 / 8 de llegada
  38: ['CM', 'CAM', 'RM'],         // Juan S. Verón: Doble 5, Enganche, Volante derecho
  39: ['CAM', 'CM', 'RM', 'ST'],   // Pablo Aimar: Enganche, Mediapunta
  40: ['RM', 'ST', 'LM'],          // G. Barros Schelotto: Win derecho/izquierdo y Delantero
  41: ['LM', 'RM', 'ST'],          // Claudio Caniggia: Extremo por ambas bandas y Punta
  43: ['ST', 'CAM'],               // Sergio Agüero: 9 y Segunda punta
  51: ['CB', 'RB'],                // Nicolás Burdisso: Central y Lateral derecho
  54: ['CB', 'CM'],                // Juan Simón: Líbero y 5
  55: ['CB', 'LB'],                // Marcos Rojo: Central zurdo y Lateral izquierdo
  56: ['LB', 'LM', 'RB'],          // Clemente Rodríguez: Lateral por ambas bandas y carrilero
  57: ['LB', 'LM'],                // R. Arruabarrena: 3 con llegada
  58: ['LB', 'CB'],                // Morel Rodríguez: 3 y segundo marcador central
  59: ['RB', 'RM'],                // Luis Advíncula: 4 y extremo/carrilero derecho
  60: ['RB', 'CB'],                // Gabriel Mercado: 4 y primer marcador central
  61: ['RB', 'RM'],                // Hernán Díaz: 4 y 8
  63: ['CM', 'CAM', 'LM'],         // Éver Banega: 5 organizador, enganche e interno
  64: ['CM', 'CB', 'RB'],          // Leonardo Ponzio: 5, central y lateral de emergencia
  68: ['RM', 'CM'],                // Diego Cagna: 8 y volante interno
  69: ['RM', 'LM'],                // Neri Cardozo: Volante por ambas bandas
  70: ['LM', 'CM'],                // Jesús Dátolo: Volante izquierdo e interno
  71: ['LM', 'CM', 'CAM'],         // Walter Erviti: Interno izquierdo, doble 5 y enganche
  72: ['ST', 'RM', 'LM'],          // Rodrigo Palacio: Punta por afuera en ambas bandas y 9
  73: ['ST', 'RM', 'LM'],          // Marcelo Delgado: Win y delantero
  75: ['ST', 'CAM'],               // Lucas Pratto: 9 y media punta de apoyo
  85: ['RB', 'CB'],                // Franco Sosa: 4 y central
  86: ['RB', 'RM', 'LB'],          // Emiliano Albín: Lateral/volante
  90: ['CM', 'CB', 'RM'],          // Ribair Rodríguez: 5, 8 y central
  91: ['CM', 'RM'],                // Jesús Méndez: 5 y 8
  93: ['CM', 'RM', 'RB'],          // Gonzalo Escalante: 8, 5 y 4
  95: ['LM', 'CAM'],               // Damián Escudero: Volante izq. y media punta
  97: ['RM', 'ST'],                // Joel Acosta: Win derecho y punta
  99: ['ST', 'RM']                 // Franco Soldano: 9 y "8" sacrificado
}

// ---------------------------------------------------------------------------
// 2. Asignación de Rasgos Individuales por Jugador
// ---------------------------------------------------------------------------
const PLAYER_TRAITS_BY_ID = {
  1: ['playmaker_gambeteador', 'lanzador_canonero'],                     // Maradona
  2: ['playmaker_gambeteador', 'fenomeno_encarador'],                    // Messi
  3: ['fenomeno_encarador', 'artillero_area'],                          // Pelé
  4: ['fenomeno_encarador', 'artillero_area'],                          // Ronaldo Nazário
  5: ['organizador_mediocampo', 'lanzador_canonero'],                    // Riquelme
  6: ['playmaker_gambeteador', 'organizador_mediocampo'],                // Cruyff
  7: ['organizador_mediocampo', 'playmaker_gambeteador'],                // Zidane
  8: ['fenomeno_encarador', 'canonero_media_distancia'],                 // Cristiano Ronaldo
  9: ['playmaker_gambeteador', 'velocista_banda'],                      // Ronaldinho
  10: ['caudillo_fisico', 'organizador_mediocampo'],                     // Beckenbauer
  11: ['caudillo_fisico'],                                               // Maldini
  12: ['lateral_ofensivo', 'canonero_media_distancia'],                  // Roberto Carlos
  13: ['lateral_ofensivo', 'velocista_banda'],                          // Cafú
  14: ['recuperador_pulmon', 'canonero_media_distancia'],                // Matthäus
  15: ['organizador_mediocampo', 'playmaker_gambeteador'],               // Iniesta
  16: ['organizador_mediocampo'],                                        // Xavi
  17: ['artillero_area', 'canonero_media_distancia'],                   // Batistuta
  18: ['muro_reflejos'],                                                 // Yashin
  19: ['muro_reflejos'],                                                 // Buffon
  20: ['caudillo_fisico', 'canonero_media_distancia'],                   // Passarella

  // Ídolos
  21: ['artillero_area'],                                                // Palermo
  22: ['playmaker_gambeteador', 'fenomeno_encarador'],                   // Tevez
  23: ['velocista_banda', 'playmaker_gambeteador'],                     // Di María
  24: ['playmaker_gambeteador', 'velocista_banda'],                     // Ortega
  25: ['playmaker_gambeteador', 'artillero_area'],                      // Francescoli
  26: ['muro_reflejos'],                                                 // Córdoba
  27: ['muro_reflejos', 'lanzador_canonero'],                            // Abbondanzieri
  28: ['muro_reflejos'],                                                 // Dibu Martínez
  29: ['caudillo_fisico'],                                               // Samuel
  30: ['caudillo_fisico'],                                               // Ayala
  31: ['caudillo_fisico'],                                               // Bermúdez ("El Patrón")
  32: ['lateral_ofensivo'],                                              // Ibarra
  33: ['lateral_ofensivo', 'recuperador_pulmon'],                       // Zanetti
  34: ['lateral_ofensivo', 'artillero_area'],                           // Sorín
  35: ['organizador_mediocampo'],                                        // Redondo
  36: ['recuperador_pulmon', 'caudillo_fisico'],                         // Simeone
  37: ['recuperador_pulmon', 'organizador_mediocampo'],                 // Battaglia
  38: ['lanzador_canonero', 'canonero_media_distancia'],                 // Verón
  39: ['playmaker_gambeteador'],                                         // Aimar
  40: ['velocista_banda', 'playmaker_gambeteador'],                     // Guillermo Barros Schelotto
  41: ['velocista_banda'],                                               // Caniggia
  42: ['artillero_area'],                                                // Crespo
  43: ['fenomeno_encarador', 'artillero_area'],                          // Agüero
  44: ['caudillo_fisico', 'recuperador_pulmon'],                         // Serna ("Chicho")
  45: ['caudillo_fisico'],                                               // Giunta ("Huevo huevo huevo")

  // Plantilla
  46: ['muro_reflejos'],                                                 // Romero
  47: ['muro_reflejos'],                                                 // Armani
  48: ['muro_reflejos'],                                                 // Orion
  49: ['muro_reflejos'],                                                 // Barovero
  50: ['caudillo_fisico'],                                               // Schiavi ("El Flaco")
  51: ['caudillo_fisico'],                                               // Burdisso
  52: ['caudillo_fisico', 'canonero_media_distancia'],                   // Cata Díaz
  53: ['caudillo_fisico'],                                               // Maidana
  54: ['organizador_mediocampo'],                                        // Simón
  55: ['caudillo_fisico'],                                               // Marcos Rojo
  56: ['velocista_banda', 'lateral_ofensivo'],                          // Clemente Rodríguez
  57: ['lateral_ofensivo'],                                              // Arruabarrena
  58: ['caudillo_fisico'],                                               // Morel Rodríguez
  59: ['lateral_ofensivo', 'velocista_banda'],                          // Advíncula
  60: ['caudillo_fisico'],                                               // Mercado
  61: ['caudillo_fisico'],                                               // Hernán Díaz
  62: ['organizador_mediocampo'],                                        // Gago
  63: ['organizador_mediocampo', 'playmaker_gambeteador'],               // Banega
  64: ['caudillo_fisico', 'recuperador_pulmon'],                         // Ponzio
  65: ['caudillo_fisico'],                                               // Cascini
  66: ['recuperador_pulmon'],                                            // Erbes
  67: ['recuperador_pulmon'],                                            // Pablo Pérez
  68: ['organizador_mediocampo'],                                        // Cagna
  69: ['velocista_banda'],                                               // Neri Cardozo
  70: ['velocista_banda'],                                               // Dátolo
  71: ['organizador_mediocampo'],                                        // Erviti
  72: ['velocista_banda', 'artillero_area'],                             // Palacio
  73: ['lanzador_canonero'],                                             // Delgado
  74: ['artillero_area', 'canonero_media_distancia'],                   // Benedetto
  75: ['artillero_area', 'caudillo_fisico'],                            // Pratto

  // Relleno (Especialistas Buffeados OVR 74-77)
  76: ['organizador_mediocampo', 'muro_reflejos'],                       // Javier García (buen pie)
  77: ['muro_reflejos'],                                                 // Josué Ayala (atajador)
  78: ['muro_reflejos'],                                                 // Assmann (reflejos rápidos)
  79: ['muro_reflejos'],                                                 // Rigamonti (aéreo)
  80: ['caudillo_fisico'],                                               // Chiqui Pérez (fuerza y penal)
  81: ['caudillo_fisico'],                                               // Luiz Alberto
  82: ['caudillo_fisico'],                                               // Breyner Bonilla (topadora)
  83: ['caudillo_fisico', 'artillero_area'],                            // Guillermo Burdisso (cabezazo)
  84: ['caudillo_fisico'],                                               // Caruzzo
  85: ['canonero_media_distancia', 'lanzador_canonero'],                 // Franco Sosa (tiro libre bomba)
  86: ['velocista_banda', 'lateral_ofensivo'],                          // Emiliano Albín
  87: ['caudillo_fisico'],                                               // Nahuel Zárate
  88: ['lateral_ofensivo'],                                              // Urribarri
  89: ['velocista_banda', 'lateral_ofensivo'],                          // Hernán Grana (sprint puro)
  90: ['caudillo_fisico', 'recuperador_pulmon'],                         // Ribair Rodríguez
  91: ['lanzador_canonero'],                                             // Jesús Méndez (pase largo y tiro libre)
  92: ['recuperador_pulmon'],                                            // Prediger (quite)
  93: ['recuperador_pulmon'],                                            // Escalante (ida y vuelta)
  94: ['recuperador_pulmon'],                                            // Bravo (tapón)
  95: ['playmaker_gambeteador'],                                         // Escudero (control y gambeta)
  96: ['velocista_banda'],                                               // Matías Giménez (centros a la carrera)
  97: ['velocista_banda'],                                               // Joel Acosta (velocista)
  98: ['artillero_area'],                                                // Takahara (primer toque)
  99: ['recuperador_pulmon', 'artillero_area'],                         // Soldano (presión total)
  100: ['artillero_area', 'caudillo_fisico']                            // Gigliotti (9 físico de área)
}

function inferDefaultTraits(position, skill) {
  if (position === 'GK') return ['muro_reflejos']
  if (position === 'ST') {
    return skill.agility >= 84 ? ['fenomeno_encarador'] : ['artillero_area']
  }
  if (position === 'LM' || position === 'RM') {
    return skill.control >= 85 ? ['playmaker_gambeteador'] : ['velocista_banda']
  }
  if (position === 'LB' || position === 'RB') {
    return skill.agility >= 82 ? ['lateral_ofensivo', 'velocista_banda'] : ['lateral_ofensivo']
  }
  if (position === 'CB') {
    return ['caudillo_fisico']
  }
  // CM / CAM
  if (skill.shooting >= 84) return ['lanzador_canonero', 'organizador_mediocampo']
  if (skill.tackling >= 82) return ['recuperador_pulmon', 'caudillo_fisico']
  return ['organizador_mediocampo']
}

function createPlayer(id, name, category, position, rating, price, height, pas, sho, tac, sav, agi, str, pen, fk, jum, per, con, specialty) {
  const rawPositions = EXTRA_POSITIONS_BY_ID[id] || [position]
  const positions = Array.from(new Set([position, ...rawPositions]))
  const traits = PLAYER_TRAITS_BY_ID[id] || inferDefaultTraits(position, { passing: pas, shooting: sho, tackling: tac, saving: sav, agility: agi, strength: str, control: con })

  return {
    id,
    name,
    category, // 'legend' | 'idol' | 'squad' | 'filler'
    position, // Posición principal: 'GK' | 'CB' | 'LB' | 'RB' | 'CM' | 'LM' | 'RM' | 'ST'
    positions, // Todas las posiciones naturales del jugador (100% compatibilidad)
    traits, // Rasgos de personalidad de IA
    rating,
    price, // En Millones ($M)
    height, // En cm
    specialty,
    fitness: 100,
    injured: false,
    skill: {
      passing: pas,
      shooting: sho,
      tackling: tac,
      saving: sav,
      agility: agi,
      strength: str,
      penalty_taking: pen,
      freekick: fk,
      jumping: jum,
      perception: per,
      control: con
    }
  }
}

export const POSITION_LABELS_ES = {
  GK: 'Arquero',
  CB: 'Defensor Central',
  LB: 'Lateral Izquierdo',
  RB: 'Lateral Derecho',
  CM: 'Mediocampista Central',
  CAM: 'Enganche / Mediapunta',
  LM: 'Volante / Extremo Izq.',
  RM: 'Volante / Extremo Der.',
  ST: 'Delantero'
}

export const CATEGORY_INFO = {
  legend: {
    id: 'legend',
    label: 'LEYENDA',
    plural: 'Leyendas',
    color: '#f59e0b',
    badgeBg: 'linear-gradient(135deg, #fde047 0%, #f59e0b 50%, #b45309 100%)',
    description: 'Dominan casi todas las facetas del juego (Media 93-99)'
  },
  idol: {
    id: 'idol',
    label: 'ÍDOLO',
    plural: 'Ídolos',
    color: '#a855f7',
    badgeBg: 'linear-gradient(135deg, #e9d5ff 0%, #9333ea 55%, #581c87 100%)',
    description: 'Especialistas de jerarquía con 4 a 5 atributos de élite (Media 82-89)'
  },
  squad: {
    id: 'squad',
    label: 'PLANTILLA',
    plural: 'Plantilla',
    color: '#10b981',
    badgeBg: 'linear-gradient(135deg, #6ee7b7 0%, #059669 55%, #064e3b 100%)',
    description: 'Cumplidores tácticos con 1 a 3 puntos fuertes marcados (Media 72-79)'
  },
  filler: {
    id: 'filler',
    label: 'RELLENO',
    plural: 'Relleno',
    color: '#94a3b8',
    badgeBg: 'linear-gradient(135deg, #cbd5e1 0%, #64748b 55%, #334155 100%)',
    description: 'Suplentes rendidores de Primera con 1 virtud extrema de especialista (Media 74-78)'
  }
}

export const PLAYERS_DB = [
  // =========================================================================
  // 1. LEYENDAS (20 Jugadores | Precio: $35M a $45M | Media 93-99)
  // =========================================================================
  createPlayer(1, 'Diego Maradona', 'legend', 'CM', 99, 45.0, 165, 99, 96, 45, 10, 99, 88, 96, 99, 75, 99, 99, 'Total / D10S: Gamba, visión, pegada y liderazgo absoluto'),
  createPlayer(2, 'Lionel Messi', 'legend', 'ST', 99, 45.0, 170, 99, 98, 40, 10, 99, 80, 92, 98, 70, 99, 99, 'Total / Genio ofensivo: Control pegado al pie y definición letal'),
  createPlayer(3, 'Pelé', 'legend', 'ST', 98, 44.0, 173, 94, 98, 52, 15, 97, 88, 95, 90, 95, 98, 98, 'Total / Atleta completo: Salto, potencia y definición ambidiestra'),
  createPlayer(4, 'Ronaldo Nazário', 'legend', 'ST', 97, 43.0, 183, 86, 99, 35, 10, 98, 92, 94, 82, 82, 96, 98, 'El Fenómeno: Potencia explosiva, gambeta en velocidad y gol'),
  createPlayer(5, 'Juan Román Riquelme', 'legend', 'CM', 95, 40.0, 183, 99, 91, 48, 10, 86, 89, 95, 98, 72, 99, 99, 'El Último 10: Pase filtrado, pausa, tiro libre y aguante de espalda'),
  createPlayer(6, 'Johan Cruyff', 'legend', 'ST', 96, 41.0, 178, 97, 94, 50, 10, 97, 79, 91, 88, 78, 99, 98, 'Fútbol Total: Creador y definidor con lectura de juego suprema'),
  createPlayer(7, 'Zinedine Zidane', 'legend', 'CM', 96, 41.0, 185, 98, 91, 68, 10, 93, 90, 96, 92, 84, 98, 99, 'Elegancia total: Control orientado, pase, físico y volea'),
  createPlayer(8, 'Cristiano Ronaldo', 'legend', 'ST', 97, 43.0, 187, 85, 99, 40, 10, 94, 94, 97, 91, 99, 97, 95, 'Máquina física: Salto inalcanzable, cañón de media distancia y penal'),
  createPlayer(9, 'Ronaldinho', 'legend', 'LM', 95, 40.0, 182, 96, 92, 36, 10, 99, 84, 90, 95, 76, 95, 99, 'Magia pura: Agilidad, fantasía en el 1 contra 1 y tiro libre'),
  createPlayer(10, 'Franz Beckenbauer', 'legend', 'CB', 96, 40.0, 181, 94, 80, 97, 15, 88, 89, 85, 82, 89, 99, 94, 'El Káiser: Defensor imperial con salida limpia de enganche'),
  createPlayer(11, 'Paolo Maldini', 'legend', 'CB', 95, 39.0, 186, 85, 62, 99, 15, 90, 92, 75, 65, 94, 99, 90, 'Muralla perfecta: Lectura anticipada y quite quirúrgico sin falta'),
  createPlayer(12, 'Roberto Carlos', 'legend', 'LB', 93, 36.0, 168, 88, 95, 88, 10, 96, 91, 88, 99, 83, 89, 90, 'El Hombre Bala: Velocidad extrema y bomba de tiro libre (FK 99)'),
  createPlayer(13, 'Cafú', 'legend', 'RB', 93, 36.0, 176, 90, 78, 92, 10, 96, 88, 80, 72, 85, 93, 92, 'Motor incansable: Dueño absoluto de toda la banda derecha'),
  createPlayer(14, 'Lothar Matthäus', 'legend', 'CM', 94, 38.0, 174, 92, 93, 93, 15, 89, 93, 94, 89, 86, 95, 91, 'Box-to-Box total: Quita, distribuye y patea desde 30 metros'),
  createPlayer(15, 'Andrés Iniesta', 'legend', 'CM', 93, 36.0, 171, 98, 82, 68, 10, 97, 74, 84, 80, 65, 98, 99, 'El Ilusionista: Agilidad en una baldosa, control y pase entre líneas'),
  createPlayer(16, 'Xavi Hernández', 'legend', 'CM', 93, 36.0, 170, 99, 80, 70, 10, 91, 75, 85, 88, 64, 99, 99, 'Reloj suizo: Precisión del 99% en pases y lectura táctica'),
  createPlayer(17, 'Gabriel Batistuta', 'legend', 'ST', 94, 38.0, 185, 78, 99, 42, 10, 84, 96, 95, 94, 92, 94, 88, 'Batigol: Remate violento, potencia física y tiro libre pesado'),
  createPlayer(18, 'Lev Yashin', 'legend', 'GK', 95, 37.0, 189, 75, 25, 45, 99, 95, 90, 60, 50, 96, 98, 80, 'La Araña Negra: Arquero total con reflejos sobrehumanos (SAV 99)'),
  createPlayer(19, 'Gianluigi Buffon', 'legend', 'GK', 94, 35.0, 192, 72, 20, 35, 98, 90, 91, 55, 45, 94, 99, 78, 'Gigi: Ubicación perfecta bajo los tres palos y mando en el área'),
  createPlayer(20, 'Daniel Passarella', 'legend', 'CB', 93, 35.0, 173, 82, 88, 95, 15, 85, 94, 93, 88, 99, 94, 85, 'El Gran Capitán: Caudillo defensivo, salto de 99 y gol de pelota parada'),

  // =========================================================================
  // 2. ÍDOLOS (25 Jugadores | Precio: $16M a $26M | Media 82-89)
  // =========================================================================
  createPlayer(21, 'Martín Palermo', 'idol', 'ST', 88, 25.0, 188, 64, 95, 45, 15, 66, 95, 88, 60, 99, 97, 72, 'Optimista del Gol: Cabezazo letal (JUM 99) y olfato único en el área'),
  createPlayer(22, 'Carlos Tevez', 'idol', 'ST', 89, 26.0, 171, 84, 92, 62, 10, 92, 94, 88, 84, 76, 88, 91, 'El Apache: Guerrero imparable de potencia, gambeta y remate'),
  createPlayer(23, 'Ángel Di María', 'idol', 'RM', 89, 26.0, 178, 92, 88, 48, 10, 96, 66, 85, 88, 70, 89, 95, 'Fideo: Velocidad eléctrica, centro picante y definición en finales'),
  createPlayer(24, 'Ariel Ortega', 'idol', 'RM', 87, 23.0, 170, 86, 84, 35, 10, 98, 72, 86, 82, 65, 86, 97, 'El Burrito: Cintura endiablada (AGI 98, CON 97) y enganche corto'),
  createPlayer(25, 'Enzo Francescoli', 'idol', 'ST', 89, 26.0, 181, 89, 93, 42, 10, 89, 78, 94, 90, 86, 92, 95, 'El Príncipe: Elegancia pura, control orientado y pelota parada'),
  createPlayer(26, 'Oscar Córdoba', 'idol', 'GK', 87, 21.0, 183, 74, 20, 35, 93, 91, 84, 50, 45, 91, 90, 75, 'Muralla colombiana: Atajador de penales y voladas espectaculares'),
  createPlayer(27, 'R. Abbondanzieri', 'idol', 'GK', 86, 20.0, 186, 80, 25, 35, 91, 85, 86, 82, 65, 87, 90, 76, 'El Pato: Especialista en definiciones, seguro y con gran saque largo'),
  createPlayer(28, 'Emiliano Martínez', 'idol', 'GK', 89, 24.0, 195, 82, 25, 38, 95, 88, 92, 75, 55, 96, 93, 78, 'El Dibu: Gigante en el mano a mano, descuelga todos los centros'),
  createPlayer(29, 'Walter Samuel', 'idol', 'CB', 88, 24.0, 183, 68, 52, 95, 15, 74, 95, 60, 45, 95, 94, 72, 'El Muro: Impasable de arriba y de abajo (TAC 95, STR 95, JUM 95)'),
  createPlayer(30, 'Roberto Ayala', 'idol', 'CB', 88, 24.0, 177, 72, 55, 94, 15, 84, 89, 68, 50, 99, 95, 76, 'El Ratón: Salto prodigioso (JUM 99) y tiempista de élite'),
  createPlayer(31, 'Jorge Bermúdez', 'idol', 'CB', 86, 21.0, 186, 66, 58, 92, 15, 70, 97, 80, 55, 93, 90, 68, 'El Patrón: Voz de mando, fuerza bruta (STR 97) y juego aéreo'),
  createPlayer(32, 'Hugo Ibarra', 'idol', 'RB', 86, 21.0, 174, 84, 74, 88, 10, 90, 86, 70, 65, 78, 86, 87, 'El Negro: Clausura su lateral y pasa al ataque con criterio'),
  createPlayer(33, 'Javier Zanetti', 'idol', 'RB', 89, 25.0, 178, 87, 72, 92, 10, 91, 91, 76, 65, 82, 92, 89, 'El Pupi: Tractor inagotable, regularidad perfecta en marca y conducción'),
  createPlayer(34, 'Juan Pablo Sorín', 'idol', 'LB', 86, 21.0, 173, 82, 80, 84, 10, 88, 85, 72, 68, 92, 89, 83, 'Juampi: Lateral con alma de 9, aparece siempre de palomita en el área'),
  createPlayer(35, 'Fernando Redondo', 'idol', 'CM', 89, 25.0, 186, 94, 74, 88, 10, 88, 86, 78, 72, 82, 94, 95, 'El Príncipe de Madrid: El 5 lírico de galera y bastón'),
  createPlayer(36, 'Diego Simeone', 'idol', 'CM', 87, 22.0, 177, 78, 82, 92, 10, 82, 94, 80, 65, 92, 91, 78, 'El Cholo: Cuchillo entre los dientes, quite, despliegue y cabezazo'),
  createPlayer(37, 'Sebastián Battaglia', 'idol', 'CM', 85, 19.0, 180, 80, 70, 92, 10, 78, 89, 72, 55, 86, 92, 80, 'El León: Ubicación táctica perfecta para robar y entregar redondo'),
  createPlayer(38, 'Juan S. Verón', 'idol', 'CM', 88, 24.0, 186, 96, 88, 76, 10, 78, 86, 90, 93, 82, 94, 90, 'La Brujita: Cambio de frente de 50 metros y pegada de pelota parada'),
  createPlayer(39, 'Pablo Aimar', 'idol', 'CM', 87, 23.0, 170, 92, 83, 42, 10, 96, 64, 84, 82, 64, 91, 95, 'El Payaso: Arranque en velocidad, gambeta vertical y asistencia'),
  createPlayer(40, 'G. Barros Schelotto', 'idol', 'RM', 87, 23.0, 173, 88, 85, 52, 10, 91, 82, 90, 85, 75, 94, 89, 'El Mellizo: Picardía, diagonal punzante y centros venenosos'),
  createPlayer(41, 'Claudio Caniggia', 'idol', 'LM', 88, 24.0, 175, 82, 88, 40, 10, 99, 76, 80, 72, 80, 87, 91, 'El Hijo del Viento: Velocidad pura (AGI 99) para dejar pagando al arquero'),
  createPlayer(42, 'Hernán Crespo', 'idol', 'ST', 88, 25.0, 184, 75, 94, 40, 10, 85, 85, 90, 72, 92, 95, 88, 'Valdanito: Desmarque quirúrgico y definición de primera'),
  createPlayer(43, 'Sergio Agüero', 'idol', 'ST', 89, 26.0, 173, 82, 95, 35, 10, 94, 88, 90, 76, 76, 92, 93, 'El Kun: Explosión en corto, tren inferior potente y fierrazo al primer palo'),
  createPlayer(44, 'Mauricio Serna', 'idol', 'CM', 84, 17.0, 168, 76, 62, 94, 10, 85, 93, 68, 50, 78, 88, 76, 'Chicho: Rueda de auxilio impasable en el círculo central'),
  createPlayer(45, 'Blas Giunta', 'idol', 'CM', 82, 16.0, 178, 68, 60, 94, 10, 76, 97, 70, 45, 88, 87, 70, 'Blas Armando: Huevo, huevo, huevo (STR 97, TAC 94), intimida al medio rival'),

  // =========================================================================
  // 3. JUGADORES DE PLANTILLA (30 Jugadores | Precio: $6M a $14M | Media 72-79)
  // =========================================================================
  createPlayer(46, 'Sergio Romero', 'squad', 'GK', 78, 11.0, 192, 62, 15, 25, 86, 75, 78, 45, 35, 84, 84, 65, 'Chiquito: Fuerte en SAV (86), JUM (84) y PER (84)'),
  createPlayer(47, 'Franco Armani', 'squad', 'GK', 78, 11.0, 189, 55, 15, 25, 88, 82, 78, 40, 30, 83, 78, 58, 'El Pulpo: Achique rápido y reflejos (SAV 88), flojo con los pies'),
  createPlayer(48, 'Agustín Orion', 'squad', 'GK', 75, 8.0, 189, 60, 15, 30, 83, 68, 85, 45, 35, 76, 82, 62, 'Presencia física en el área chica (STR 85, SAV 83, PER 82)'),
  createPlayer(49, 'Marcelo Barovero', 'squad', 'GK', 77, 10.0, 183, 68, 15, 25, 85, 83, 70, 45, 40, 75, 86, 68, 'Trapito: Ubicación y sobriedad (PER 86, SAV 85, AGI 83)'),
  createPlayer(50, 'Rolando Schiavi', 'squad', 'CB', 79, 13.0, 191, 58, 58, 88, 15, 52, 93, 90, 55, 91, 78, 58, 'El Flaco: Caudillo de arriba y pateador de penales (STR 93, JUM 91, PEN 90), lento'),
  createPlayer(51, 'Nicolás Burdisso', 'squad', 'CB', 78, 12.0, 183, 62, 52, 86, 12, 66, 88, 60, 40, 90, 76, 62, 'Tiemplista aéreo y firme en el cruce (JUM 90, STR 88, TAC 86)'),
  createPlayer(52, 'Cata Díaz', 'squad', 'CB', 77, 10.0, 183, 60, 82, 84, 12, 64, 89, 75, 82, 80, 74, 60, 'Cañonero desde el fondo (STR 89, TAC 84, SHO/FK 82)'),
  createPlayer(53, 'Jonatan Maidana', 'squad', 'CB', 77, 10.0, 185, 55, 45, 87, 12, 60, 91, 55, 35, 85, 75, 56, 'Especialista en anular nueves de área (STR 91, TAC 87, JUM 85)'),
  createPlayer(54, 'Juan Simón', 'squad', 'CB', 79, 13.0, 182, 86, 50, 84, 15, 74, 74, 68, 58, 76, 88, 85, 'Líbero elegante con salida limpia (PER 88, PAS 86, CON 85)'),
  createPlayer(55, 'Marcos Rojo', 'squad', 'CB', 76, 9.0, 187, 68, 66, 82, 12, 66, 90, 83, 65, 85, 64, 66, 'Fuerte al choque y en penales (STR 90, JUM 85, PEN 83), baja lectura'),
  createPlayer(56, 'Clemente Rodríguez', 'squad', 'LB', 78, 12.0, 167, 81, 62, 74, 10, 93, 64, 65, 55, 66, 74, 82, 'Bala por izquierda, socio ideal del 10 (AGI 93, CON 82, PAS 81)'),
  createPlayer(57, 'R. Arruabarrena', 'squad', 'LB', 78, 12.0, 178, 72, 81, 82, 10, 72, 76, 70, 60, 78, 85, 74, 'El Vasco: Lateral goleador que pisa el área por sorpresa (PER 85, SHO 81)'),
  createPlayer(58, 'Morel Rodríguez', 'squad', 'LB', 76, 9.0, 176, 72, 68, 84, 10, 72, 85, 68, 80, 78, 74, 70, 'Garra paraguaya y buena pegada de pelota parada (STR 85, TAC 84, FK 80)'),
  createPlayer(59, 'Luis Advíncula', 'squad', 'RB', 76, 9.0, 178, 66, 80, 72, 10, 93, 86, 62, 55, 78, 68, 68, 'El Rayo: Sprint demoledor y zurdazo enganchando (AGI 93, STR 86, SHO 80)'),
  createPlayer(60, 'Gabriel Mercado', 'squad', 'RB', 77, 10.0, 180, 66, 66, 84, 10, 68, 86, 62, 50, 88, 76, 66, 'Lateral-central durísimo de arriba (JUM 88, STR 86, TAC 84)'),
  createPlayer(61, 'Hernán Díaz', 'squad', 'RB', 76, 9.0, 175, 70, 66, 83, 10, 76, 85, 68, 55, 76, 74, 68, 'La Hormiga: Asperísimo en la marca sobre la raya (STR 85, TAC 83)'),
  createPlayer(62, 'Fernando Gago', 'squad', 'CM', 79, 14.0, 178, 92, 60, 70, 10, 74, 64, 72, 70, 64, 90, 89, 'Pintita: Primer pase de élite (PAS 92, PER 90, CON 89), poca fuerza física'),
  createPlayer(63, 'Éver Banega', 'squad', 'CM', 78, 12.0, 174, 89, 72, 66, 10, 76, 72, 78, 83, 62, 80, 90, 'Tenencia, pisada y pelota parada (CON 90, PAS 89, FK 83)'),
  createPlayer(64, 'Leonardo Ponzio', 'squad', 'CM', 77, 10.0, 177, 72, 68, 86, 10, 68, 87, 70, 62, 76, 85, 70, 'El León de Núñez: Caudillo 5 de relevos y quite (STR 87, TAC 86, PER 85)'),
  createPlayer(65, 'Raúl Cascini', 'squad', 'CM', 75, 8.0, 178, 66, 58, 85, 10, 64, 86, 80, 50, 75, 78, 65, 'El Mosquito: Metedor en el medio y frío para los penales (STR 86, TAC 85, PEN 80)'),
  createPlayer(66, 'Cristian Erbes', 'squad', 'CM', 72, 6.0, 176, 70, 52, 82, 10, 72, 72, 60, 45, 68, 81, 68, 'El Pichy: Rueda de auxilio económica y ordenada (TAC 82, PER 81)'),
  createPlayer(67, 'Pablo Pérez', 'squad', 'CM', 74, 7.0, 179, 82, 68, 74, 10, 68, 84, 68, 60, 72, 66, 76, 'Físico y pase vertical (STR 84, PAS 82), propenso al roce'),
  createPlayer(68, 'Diego Cagna', 'squad', 'RM', 77, 10.0, 176, 83, 72, 72, 10, 72, 74, 74, 65, 72, 86, 82, 'Equilibrista del mediocampo, llega vacío al área (PER 86, PAS 83, CON 82)'),
  createPlayer(69, 'Neri Cardozo', 'squad', 'RM', 74, 7.0, 172, 68, 72, 55, 10, 89, 60, 65, 60, 65, 68, 81, 'Velocista puro para el contraataque por banda (AGI 89, CON 81)'),
  createPlayer(70, 'Jesús Dátolo', 'squad', 'LM', 75, 8.0, 177, 76, 82, 58, 10, 84, 70, 70, 74, 68, 68, 82, 'Desborde zurdo y zurdazo cruzado (AGI 84, SHO 82, CON 82)'),
  createPlayer(71, 'Walter Erviti', 'squad', 'LM', 77, 10.0, 171, 86, 68, 74, 10, 74, 68, 72, 76, 62, 86, 86, 'Cerebro silencioso: Pausa, lectura y asociación (PAS 86, PER 86, CON 86)'),
  createPlayer(72, 'Rodrigo Palacio', 'squad', 'ST', 79, 14.0, 175, 76, 83, 38, 10, 94, 68, 72, 62, 72, 86, 80, 'La Joya: Diagonal letal a espaldas de los centrales (AGI 94, PER 86, SHO 83)'),
  createPlayer(73, 'Marcelo Delgado', 'squad', 'ST', 78, 12.0, 173, 84, 85, 38, 10, 80, 70, 80, 86, 66, 78, 80, 'El Chelo: Maestro de los tres dedos y tiro libre (FK 86, SHO 85, PAS 84)'),
  createPlayer(74, 'Darío Benedetto', 'squad', 'ST', 77, 11.0, 175, 68, 88, 35, 10, 74, 76, 84, 70, 82, 74, 76, 'El Pipa: Remate seco de media distancia y penal (SHO 88, PEN 84, JUM 82)'),
  createPlayer(75, 'Lucas Pratto', 'squad', 'ST', 76, 9.0, 185, 72, 82, 55, 10, 66, 90, 76, 62, 84, 76, 72, 'El Oso: Aguanta a los dos centrales y saca el remate (STR 90, JUM 84, SHO 82)'),

  // =========================================================================
  // 4. RELLENO (25 Jugadores | Precio: $1.8M a $2.5M | Media Competitiva 74-77)
  // Rebalanceados: gangas y suplentes cumplidores de Primera División con un atributo pico de élite (82-90)
  // =========================================================================
  createPlayer(76, 'Javier García', 'filler', 'GK', 75, 2.5, 181, 84, 20, 25, 78, 72, 68, 48, 40, 65, 76, 82, 'Especialista en salir jugando con los pies (PAS 84, CON 82, SAV 78)'),
  createPlayer(77, 'Josué Ayala', 'filler', 'GK', 74, 1.8, 188, 52, 18, 20, 84, 72, 76, 40, 30, 72, 74, 52, 'Atajador puro bajo los tres palos y achique (SAV 84, STR 76)'),
  createPlayer(78, 'Fabián Assmann', 'filler', 'GK', 74, 1.8, 184, 55, 18, 20, 79, 86, 72, 40, 30, 68, 74, 58, 'Arquero rápido de piernas y volador elástico (AGI 86, SAV 79)'),
  createPlayer(79, 'César Rigamonti', 'filler', 'GK', 74, 1.8, 185, 50, 18, 20, 80, 68, 86, 38, 30, 86, 74, 50, 'Dueño del juego aéreo y descolgar centros (STR 86, JUM 86, SAV 80)'),
  createPlayer(80, 'Chiqui Pérez', 'filler', 'CB', 76, 2.2, 186, 56, 64, 83, 12, 56, 90, 88, 65, 80, 68, 56, 'Caudillo rústico, fuerza bruta y penales secos (STR 90, PEN 88, TAC 83)'),
  createPlayer(81, 'Luiz Alberto', 'filler', 'CB', 74, 1.8, 187, 50, 42, 85, 10, 56, 82, 50, 35, 76, 68, 52, 'Especialista en barridas y cruces frontales limpios (TAC 85, STR 82)'),
  createPlayer(82, 'Breyner Bonilla', 'filler', 'CB', 74, 1.8, 190, 46, 38, 82, 10, 58, 92, 45, 30, 84, 66, 48, 'Fuerza extrema para sacar al rival del partido con el cuerpo (STR 92, JUM 84)'),
  createPlayer(83, 'Guillermo Burdisso', 'filler', 'CB', 76, 2.4, 189, 58, 66, 83, 10, 60, 84, 60, 45, 90, 72, 60, 'Arma letal de cabeza en ambas áreas en pelota parada (JUM 90, STR 84, TAC 83)'),
  createPlayer(84, 'Matías Caruzzo', 'filler', 'CB', 76, 2.4, 181, 66, 50, 86, 10, 70, 76, 65, 45, 74, 82, 70, 'Tiempista ordenado y de anticipación en el 1v1 (TAC 86, PER 82)'),
  createPlayer(85, 'Franco Sosa', 'filler', 'RB', 75, 2.2, 173, 68, 80, 76, 10, 68, 78, 70, 88, 68, 66, 66, 'Bombazo de tiro libre y pegada con efecto de larga distancia (FK 88, SHO 80)'),
  createPlayer(86, 'Emiliano Albín', 'filler', 'RB', 75, 2.0, 177, 68, 58, 76, 10, 88, 68, 55, 45, 68, 68, 72, 'Velocidad pura para doblar la banda derecha en sprint (AGI 88, TAC 76)'),
  createPlayer(87, 'Nahuel Zárate', 'filler', 'LB', 74, 1.8, 179, 62, 52, 81, 10, 68, 84, 52, 40, 74, 66, 62, 'Lateral duro al roce con gran potencia física (STR 84, TAC 81)'),
  createPlayer(88, 'Bruno Urribarri', 'filler', 'LB', 75, 2.0, 178, 74, 56, 78, 10, 70, 72, 60, 55, 70, 84, 72, 'Ubicación táctica inteligente y criterio de cobertura (PER 84, TAC 78)'),
  createPlayer(89, 'Hernán Grana', 'filler', 'RB', 76, 2.4, 170, 72, 58, 72, 10, 90, 68, 60, 50, 65, 68, 78, 'Pique explosivo de banda y llegada por sorpresa (AGI 90, CON 78)'),
  createPlayer(90, 'Ribair Rodríguez', 'filler', 'CM', 76, 2.4, 181, 62, 60, 84, 10, 66, 92, 60, 45, 80, 72, 60, 'Topadora destructiva en el círculo central (STR 92, TAC 84, JUM 80)'),
  createPlayer(91, 'Jesús Méndez', 'filler', 'CM', 76, 2.4, 178, 86, 78, 70, 10, 66, 74, 72, 87, 68, 76, 79, 'Lanzador de cambios de frente y pegada de tiro libre (FK 87, PAS 86, SHO 78)'),
  createPlayer(92, 'Sebastián Prediger', 'filler', 'CM', 75, 2.2, 181, 72, 55, 86, 10, 68, 78, 58, 45, 72, 82, 68, 'Tapón clásico de marca y quite posicional (TAC 86, PER 82, STR 78)'),
  createPlayer(93, 'Gonzalo Escalante', 'filler', 'CM', 76, 2.2, 182, 74, 66, 78, 10, 86, 80, 62, 50, 74, 76, 74, 'Motor dinámico de ida y vuelta con despliegue físico (AGI 86, STR 80, TAC 78)'),
  createPlayer(94, 'Federico Bravo', 'filler', 'CM', 74, 1.8, 181, 68, 50, 85, 10, 64, 80, 55, 40, 72, 80, 66, 'Especialista en relevos defensivos y corte por abajo (TAC 85, PER 80, STR 80)'),
  createPlayer(95, 'Damián Escudero', 'filler', 'LM', 76, 2.2, 175, 76, 74, 48, 10, 82, 66, 65, 68, 62, 74, 88, 'Manejo en espacio reducido y gambeta corta punzante (CON 88, AGI 82, PAS 76)'),
  createPlayer(96, 'Matías Giménez', 'filler', 'LM', 75, 2.0, 178, 86, 70, 58, 10, 72, 70, 65, 68, 66, 74, 78, 'Precisión milimétrica para tirar centros venenosos en carrera (PAS 86, CON 78)'),
  createPlayer(97, 'Joel Acosta', 'filler', 'RM', 75, 2.0, 173, 70, 68, 50, 10, 89, 66, 58, 45, 64, 68, 78, 'Velocidad de extremo puro para ganar la línea de fondo (AGI 89, CON 78)'),
  createPlayer(98, 'Naohiro Takahara', 'filler', 'ST', 75, 2.2, 181, 64, 84, 42, 10, 74, 74, 70, 52, 76, 80, 76, 'Definidor al primer toque y lectura dentro del área (SHO 84, PER 80, CON 76)'),
  createPlayer(99, 'Franco Soldano', 'filler', 'ST', 76, 2.2, 186, 66, 68, 74, 10, 86, 86, 62, 45, 88, 76, 68, 'Presión incansable a defensores y potencia en el salto (AGI 86, STR 86, JUM 88)'),
  createPlayer(100, 'Emmanuel Gigliotti', 'filler', 'ST', 77, 2.5, 187, 65, 87, 46, 10, 66, 88, 78, 60, 84, 76, 74, 'Nueve de área implacable, potencia de remate y choque físico (SHO 87, STR 88, JUM 84)')
]

export function getPlayerById(id) {
  return PLAYERS_DB.find(p => p.id === Number(id)) || null
}

export function clonePlayerForTeam(player) {
  return JSON.parse(JSON.stringify(player))
}
