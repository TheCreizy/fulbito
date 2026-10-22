// Base de Datos Maestra de los 200 Jugadores (Calibración RPG: Leyendas, Ídolos, Plantilla y Relleno)
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
  // --- JUGADORES ORIGINALES (1 al 100) ---
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
  99: ['ST', 'RM'],                // Franco Soldano: 9 y "8" sacrificado

  // --- NUEVOS JUGADORES (101 al 200) ---
  101: ['ST', 'CAM', 'CM'],        // Alfredo Di Stéfano: Jugador total en todo el eje
  102: ['RM', 'ST'],               // Garrincha: Win derecho y segunda punta
  103: ['CB'],                     // Franco Baresi: Líbero puro
  104: ['CAM', 'CM', 'ST'],        // Michel Platini: 10 goleador y organizador
  106: ['ST', 'CAM'],              // Romário: 9 de área y falso 9
  107: ['ST', 'CAM', 'LM'],        // Roberto Baggio: Mediapunta, enganche y delantero
  108: ['CB', 'CM'],               // Ronald Koeman: Líbero y volante central de pegada
  109: ['ST', 'LM'],               // Thierry Henry: 9 y extremo izquierdo con diagonal
  110: ['CM', 'CAM'],              // Andrea Pirlo: Regista y enganche
  111: ['CM', 'CAM', 'RM'],        // Luka Modrić: Interno, organizador y mediapunta
  112: ['CM', 'LM'],               // Toni Kroos: Organizador e interno izquierdo
  113: ['RB', 'RM', 'CM'],         // Dani Alves: Lateral, carrilero e interno
  114: ['LB', 'LM'],               // Marcelo: Lateral y volante izquierdo
  116: ['CB', 'RB', 'LB'],         // Carles Puyol: Central y lateral de marca
  119: ['ST', 'LM', 'CAM'],        // Mario Kempes: Delantero entrando desde atrás o izquierda
  120: ['CAM', 'CM'],              // Ricardo Bochini: Enganche puro
  121: ['ST', 'CAM'],              // Ángel Clemente Rojas (Rojitas): Segunda punta y 10
  122: ['CB', 'RB'],               // Rubén Suñé: 4 y marcador central
  123: ['CB', 'LB'],               // Roberto Mouzo: Segundo central y 3
  125: ['CAM', 'CM', 'ST', 'LM'],  // Alberto Márcico: Enganche y delantero
  126: ['ST', 'RM'],               // Sergio "Manteca" Martínez: 9 y punta derecho
  127: ['LB'],                     // Silvio Marzolini: 3 clásico
  132: ['CB', 'LB'],               // Gabriel Heinze: Central zurdo y lateral izquierdo
  133: ['CM', 'CB'],               // Javier Mascherano: 5 tapón y marcador central
  134: ['CM', 'LM', 'CB'],         // Esteban Cambiasso: 5, interno zurdo y líbero
  135: ['CM', 'RM', 'CAM'],        // Lucho González: 8, interno y enganche
  136: ['CAM', 'CM', 'LM'],        // Andrés D'Alessandro: Enganche y volante zurdo
  137: ['CAM', 'CM', 'RM'],        // Leandro Romagnoli: 10 y mediapunta
  139: ['ST', 'RM', 'LM'],         // Lisandro López: 9 y punta por afuera
  140: ['LM', 'ST'],               // Claudio "Piojo" López: Win izquierdo y delantero
  141: ['LM', 'RM', 'ST'],         // Ezequiel Lavezzi: Extremo por ambas bandas y segunda punta
  143: ['ST', 'CAM'],              // Diego Forlán: 9 y media punta ambidiestro
  144: ['CM', 'RM', 'RB'],         // Enzo Pérez: 5, 8 y auxilio en banda
  151: ['CB', 'LB'],               // Aníbal Matellán: Segundo central y 3 de marca
  154: ['CB', 'LB'],               // Javier Pinola: Central zurdo y lateral izquierdo
  155: ['LB', 'LM'],               // Diego Placente: 3 con salida limpia
  156: ['LB', 'LM'],               // Leonel Vangioni: Lateral y volante izquierdo
  157: ['LB', 'LM'],               // Frank Fabra: Lateral-extremo izquierdo
  158: ['RB', 'RM'],               // Iván Pillud: 4 y carrilero derecho
  159: ['RB', 'RM', 'CM'],         // Julio Buffarini: 4, 8 y volante de contención
  160: ['RB', 'RM'],               // Marcelo Weigandt: Lateral derecho con llegada
  164: ['RM', 'CM', 'RB'],         // Pablo Ledesma: 8 con llegada al área y 5
  165: ['CM', 'LM', 'LB'],         // Pablo Guiñazú: 5, interno zurdo y 3
  166: ['CM', 'CAM', 'LM', 'RM'],  // Nacho Fernández: Interno, enganche y volante
  167: ['CAM', 'LM', 'RM'],        // Maxi Moralez: Enganche y extremo liviano
  168: ['LM', 'RM', 'CAM'],        // Ricardo Centurión: Extremo gambeteador por ambas bandas
  169: ['LM', 'RM', 'CM'],         // Nicolás Bertolo: Volante de ida y vuelta por las bandas
  170: ['RM', 'LM', 'ST'],         // Cristian Pavón: Extremo veloz por derecha o izquierda
  171: ['ST', 'RM'],               // Rodrigo Mora: Segunda punta y extremo derecho
  172: ['ST', 'LM', 'CAM'],        // Ignacio Scocco: 9 técnico y segunda punta
  180: ['CB', 'RB'],               // Christian Cellay: Central y lateral derecho
  182: ['CB', 'LB'],               // Matías Cahais: Central zurdo y 3
  185: ['RB', 'RM'],               // Leandro Marín: 4 con proyección
  186: ['RB', 'RM'],               // Gino Peruzzi: 4 con llegada al área
  187: ['LB', 'LM'],               // Fabián Monzón: 3 con cañón de zurda
  188: ['LB', 'LM'],               // Fernando Evangelista: Lateral y carrilero zurdo
  189: ['LB', 'LM'],               // Juan Krupoviesa: 3 áspero
  190: ['CM', 'RM'],               // Marcelo Meli: 8 y 5 de despliegue
  191: ['CM', 'CAM', 'RM'],        // Gonzalo Castellani: Volante organizador y enganche
  192: ['LM', 'RM'],               // Federico "Pachi" Carrizo: Extremo por ambas bandas
  193: ['LM', 'RM', 'ST'],         // Pablo Mouche: Win por afuera y segunda punta
  194: ['ST', 'LM', 'RM'],         // Andrés Chávez: Delantero potente por el centro o izquierda
  195: ['ST', 'CAM'],              // Lucas Viatri: 9 pivot y descargador
  196: ['ST', 'RM', 'LM'],         // Lucas Boyé: Delantero de choque por todo el frente
  200: ['RM', 'ST', 'CM']          // Lucas Castromán: Volante derecho, delantero y cañonero
}

// ---------------------------------------------------------------------------
// 2. Asignación de Rasgos Individuales por Jugador
// ---------------------------------------------------------------------------
const PLAYER_TRAITS_BY_ID = {
  // --- ORIGINALES (1 al 100) ---
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

  // Ídolos (21-45)
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

  // Plantilla (46-75)
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

  // Relleno (76-100)
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
  100: ['artillero_area', 'caudillo_fisico'],                           // Gigliotti (9 físico de área)

  // --- NUEVAS LEYENDAS (101 al 120) ---
  101: ['organizador_mediocampo', 'artillero_area'],                     // Alfredo Di Stéfano
  102: ['playmaker_gambeteador', 'velocista_banda'],                     // Garrincha
  103: ['caudillo_fisico', 'organizador_mediocampo'],                    // Franco Baresi
  104: ['organizador_mediocampo', 'lanzador_canonero'],                  // Michel Platini
  105: ['artillero_area', 'canonero_media_distancia'],                   // Marco van Basten
  106: ['artillero_area', 'fenomeno_encarador'],                         // Romário
  107: ['playmaker_gambeteador', 'artillero_area'],                      // Roberto Baggio
  108: ['canonero_media_distancia', 'lanzador_canonero'],                // Ronald Koeman
  109: ['velocista_banda', 'fenomeno_encarador'],                        // Thierry Henry
  110: ['organizador_mediocampo', 'lanzador_canonero'],                  // Andrea Pirlo
  111: ['organizador_mediocampo', 'recuperador_pulmon'],                 // Luka Modrić
  112: ['organizador_mediocampo', 'lanzador_canonero'],                  // Toni Kroos
  113: ['lateral_ofensivo', 'playmaker_gambeteador'],                    // Dani Alves
  114: ['lateral_ofensivo', 'playmaker_gambeteador'],                    // Marcelo
  115: ['caudillo_fisico'],                                              // Alessandro Nesta
  116: ['caudillo_fisico', 'recuperador_pulmon'],                        // Carles Puyol
  117: ['muro_reflejos', 'organizador_mediocampo'],                      // Manuel Neuer
  118: ['muro_reflejos'],                                                // Iker Casillas
  119: ['fenomeno_encarador', 'artillero_area'],                         // Mario Kempes
  120: ['organizador_mediocampo', 'playmaker_gambeteador'],              // Ricardo Bochini

  // --- NUEVOS ÍDOLOS (121 al 145) ---
  121: ['playmaker_gambeteador', 'fenomeno_encarador'],                  // Rojitas
  122: ['caudillo_fisico', 'recuperador_pulmon'],                        // Rubén Suñé
  123: ['caudillo_fisico'],                                              // Roberto Mouzo
  124: ['caudillo_fisico', 'organizador_mediocampo'],                    // Antonio Rattín
  125: ['playmaker_gambeteador', 'organizador_mediocampo'],              // Beto Márcico
  126: ['artillero_area'],                                               // Manteca Martínez
  127: ['lateral_ofensivo', 'organizador_mediocampo'],                   // Silvio Marzolini
  128: ['muro_reflejos', 'organizador_mediocampo'],                      // Hugo Gatti
  129: ['muro_reflejos'],                                                // Ubaldo Fillol
  130: ['muro_reflejos', 'canonero_media_distancia'],                    // José Luis Chilavert
  131: ['caudillo_fisico'],                                              // Oscar Ruggeri
  132: ['caudillo_fisico'],                                              // Gabriel Heinze
  133: ['recuperador_pulmon', 'caudillo_fisico'],                        // Javier Mascherano
  134: ['organizador_mediocampo', 'recuperador_pulmon'],                 // Esteban Cambiasso
  135: ['organizador_mediocampo', 'canonero_media_distancia'],           // Lucho González
  136: ['playmaker_gambeteador', 'lanzador_canonero'],                   // Andrés D'Alessandro
  137: ['playmaker_gambeteador', 'velocista_banda'],                     // Leandro Romagnoli
  138: ['artillero_area'],                                               // Diego Milito
  139: ['artillero_area', 'recuperador_pulmon'],                         // Lisandro López
  140: ['velocista_banda', 'canonero_media_distancia'],                  // Piojo López
  141: ['velocista_banda', 'fenomeno_encarador'],                        // Pocho Lavezzi
  142: ['artillero_area'],                                               // Fernando Cavenaghi
  143: ['canonero_media_distancia', 'lanzador_canonero'],                // Diego Forlán
  144: ['recuperador_pulmon', 'organizador_mediocampo'],                 // Enzo Pérez
  145: ['artillero_area'],                                               // Carlos Bianchi

  // --- NUEVA PLANTILLA (146 al 175) ---
  146: ['muro_reflejos'],                                                // Luis Islas
  147: ['muro_reflejos', 'canonero_media_distancia'],                    // Sebastián Saja
  148: ['muro_reflejos'],                                                // Mauricio Caranta
  149: ['muro_reflejos'],                                                // Germán Lux
  150: ['caudillo_fisico'],                                              // Néstor Fabbri
  151: ['caudillo_fisico'],                                              // Aníbal Matellán
  152: ['caudillo_fisico'],                                              // Juan Manuel Insaurralde
  153: ['caudillo_fisico'],                                              // Carlos Izquierdoz
  154: ['caudillo_fisico', 'recuperador_pulmon'],                        // Javier Pinola
  155: ['lateral_ofensivo'],                                             // Diego Placente
  156: ['lateral_ofensivo', 'canonero_media_distancia'],                 // Leonel Vangioni
  157: ['lateral_ofensivo', 'playmaker_gambeteador'],                    // Frank Fabra
  158: ['lateral_ofensivo'],                                             // Iván Pillud
  159: ['recuperador_pulmon', 'lateral_ofensivo'],                       // Julio Buffarini
  160: ['lateral_ofensivo', 'caudillo_fisico'],                          // Marcelo Weigandt
  161: ['organizador_mediocampo'],                                       // Iván Marcone
  162: ['recuperador_pulmon'],                                           // Andrés Cubas
  163: ['caudillo_fisico', 'recuperador_pulmon'],                        // Leandro Somoza
  164: ['recuperador_pulmon', 'canonero_media_distancia'],               // Pablo Ledesma
  165: ['recuperador_pulmon'],                                           // Pablo Guiñazú
  166: ['organizador_mediocampo', 'playmaker_gambeteador'],              // Nacho Fernández
  167: ['playmaker_gambeteador'],                                        // Maxi Moralez
  168: ['playmaker_gambeteador', 'velocista_banda'],                     // Ricardo Centurión
  169: ['velocista_banda', 'recuperador_pulmon'],                        // Nicolás Bertolo
  170: ['velocista_banda', 'canonero_media_distancia'],                  // Cristian Pavón
  171: ['velocista_banda', 'artillero_area'],                            // Rodrigo Mora
  172: ['playmaker_gambeteador', 'artillero_area'],                      // Ignacio Scocco
  173: ['artillero_area', 'caudillo_fisico'],                            // Wanchope Ábila
  174: ['artillero_area'],                                               // Nicolás Blandi
  175: ['caudillo_fisico', 'organizador_mediocampo'],                    // Fernando Gamboa

  // --- NUEVO RELLENO (176 al 200) ---
  176: ['muro_reflejos'],                                                // Emanuel Trípodi
  177: ['muro_reflejos'],                                                // Guillermo Sara
  178: ['muro_reflejos', 'organizador_mediocampo'],                      // Cristian Lucchetti
  179: ['muro_reflejos'],                                                // Sebastián Peratta
  180: ['caudillo_fisico'],                                              // Christian Cellay
  181: ['caudillo_fisico'],                                              // Gabriel Paletta
  182: ['caudillo_fisico'],                                              // Matías Cahais
  183: ['caudillo_fisico'],                                              // Santiago Vergini
  184: ['caudillo_fisico'],                                              // Lisandro Magallán
  185: ['lateral_ofensivo'],                                             // Leandro Marín
  186: ['lateral_ofensivo'],                                             // Gino Peruzzi
  187: ['canonero_media_distancia', 'lateral_ofensivo'],                 // Fabián Monzón
  188: ['velocista_banda', 'lateral_ofensivo'],                          // Fernando Evangelista
  189: ['caudillo_fisico'],                                              // Juan Krupoviesa
  190: ['recuperador_pulmon'],                                           // Marcelo Meli
  191: ['organizador_mediocampo'],                                       // Gonzalo Castellani
  192: ['playmaker_gambeteador', 'velocista_banda'],                     // Pachi Carrizo
  193: ['velocista_banda'],                                              // Pablo Mouche
  194: ['canonero_media_distancia', 'fenomeno_encarador'],               // Andrés Chávez
  195: ['artillero_area', 'organizador_mediocampo'],                     // Lucas Viatri
  196: ['caudillo_fisico', 'recuperador_pulmon'],                        // Lucas Boyé
  197: ['velocista_banda', 'caudillo_fisico'],                           // Nicolás Orsini
  198: ['caudillo_fisico', 'velocista_banda'],                           // Jan Hurtado
  199: ['artillero_area'],                                               // Claudio Riaño
  200: ['canonero_media_distancia']                                      // Lucas Castromán
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
  // 1. LEYENDAS ORIGINALES (IDs 1-20 | Precio: $35M a $45M | Media 93-99)
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
  // 2. ÍDOLOS ORIGINALES (IDs 21-45 | Precio: $16M a $26M | Media 82-89)
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
  // 3. JUGADORES DE PLANTILLA ORIGINALES (IDs 46-75 | Precio: $6M a $14M | Media 72-79)
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
  // 4. RELLENO ORIGINAL (IDs 76-100 | Precio: $1.8M a $2.5M | Media 74-77)
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
  createPlayer(100, 'Emmanuel Gigliotti', 'filler', 'ST', 77, 2.5, 187, 65, 87, 46, 10, 66, 88, 78, 60, 84, 76, 74, 'Nueve de área implacable, potencia de remate y choque físico (SHO 87, STR 88, JUM 84)'),

  // =========================================================================
  // 5. NUEVAS LEYENDAS (IDs 101-120 | Precio: $35M a $43M | Media 93-97)
  // =========================================================================
  createPlayer(101, 'Alfredo Di Stéfano', 'legend', 'ST', 97, 43.0, 178, 95, 96, 72, 15, 93, 88, 94, 88, 86, 99, 97, 'La Saeta Rubia: Todocampista ofensivo, defiende, crea y define'),
  createPlayer(102, 'Garrincha', 'legend', 'RM', 96, 41.0, 169, 92, 90, 35, 10, 99, 78, 86, 90, 72, 94, 99, 'El Ángel de las Piernas Torcidas: Gambeta indescifrable por derecha (AGI 99, CON 99)'),
  createPlayer(103, 'Franco Baresi', 'legend', 'CB', 95, 39.0, 176, 88, 60, 98, 15, 86, 88, 82, 70, 92, 99, 89, 'Cierre magistral: Anticipación perfecta y lectura defensiva (PER 99, TAC 98)'),
  createPlayer(104, 'Michel Platini', 'legend', 'CM', 95, 40.0, 179, 98, 94, 58, 10, 89, 80, 96, 98, 78, 98, 97, 'El Rey Michel: Enganche con alma de 9, pase largo y tiro libre quirúrgico'),
  createPlayer(105, 'Marco van Basten', 'legend', 'ST', 96, 41.0, 188, 84, 99, 40, 10, 89, 90, 95, 84, 94, 97, 95, 'El Cisne de Utrecht: Voleas imposibles, juego aéreo y definición clínica'),
  createPlayer(106, 'Romário', 'legend', 'ST', 95, 40.0, 167, 85, 98, 32, 10, 98, 82, 93, 82, 78, 98, 98, 'O Baixinho: Rey del área chica, puntinazo letal y giro en una baldosa'),
  createPlayer(107, 'Roberto Baggio', 'legend', 'ST', 94, 38.0, 174, 95, 93, 38, 10, 95, 75, 90, 96, 74, 96, 98, 'Il Divin Codino: Fantasía italiana, control de seda y pelota parada'),
  createPlayer(108, 'Ronald Koeman', 'legend', 'CB', 93, 36.0, 181, 93, 95, 91, 15, 78, 92, 96, 98, 86, 92, 88, 'Tintín: El defensor más goleador de la historia con un cañón en el pie (FK 98)'),
  createPlayer(109, 'Thierry Henry', 'legend', 'ST', 95, 40.0, 188, 89, 96, 42, 10, 98, 86, 92, 88, 83, 95, 96, 'Tití: Zancada imparable abriendo el pie al segundo palo'),
  createPlayer(110, 'Andrea Pirlo', 'legend', 'CM', 94, 38.0, 177, 99, 86, 66, 10, 84, 74, 94, 98, 68, 99, 98, 'Il Maestro: Pases teledirigidos de 60 metros y tiros libres con folha seca'),
  createPlayer(111, 'Luka Modrić', 'legend', 'CM', 94, 38.0, 172, 98, 84, 78, 10, 94, 76, 88, 85, 70, 99, 98, 'Motor eterno: Tres dedos mágico, giro bajo presión y despliegue total'),
  createPlayer(112, 'Toni Kroos', 'legend', 'CM', 93, 36.0, 183, 99, 88, 74, 10, 82, 82, 88, 92, 74, 98, 97, 'Francotirador alemán: Cambios de frente milimétricos y remate rasante al rincón'),
  createPlayer(113, 'Dani Alves', 'legend', 'RB', 93, 36.0, 172, 92, 84, 88, 10, 95, 80, 82, 88, 82, 93, 94, 'Socio de oro por derecha: Asociación de 10, llegada y centro perfecto'),
  createPlayer(114, 'Marcelo', 'legend', 'LB', 93, 35.0, 174, 92, 83, 84, 10, 95, 82, 84, 84, 78, 91, 98, 'Malabarista del lateral: Control de pelota irreal (CON 98) y ataque constante'),
  createPlayer(115, 'Alessandro Nesta', 'legend', 'CB', 94, 37.0, 187, 82, 55, 98, 15, 88, 91, 70, 60, 93, 98, 86, 'Elegancia romana: Barridas limpias y perfección posicional en la cueva'),
  createPlayer(116, 'Carles Puyol', 'legend', 'CB', 93, 36.0, 178, 76, 62, 96, 15, 86, 97, 70, 55, 97, 96, 78, 'Tiburón: Corazón, fuerza bruta, cierres al límite y cabezazo ganador'),
  createPlayer(117, 'Manuel Neuer', 'legend', 'GK', 95, 37.0, 193, 90, 30, 52, 98, 91, 93, 65, 55, 94, 98, 88, 'Arquero-líbero revolucionario: Achica fuera del área y sale jugando como un 5'),
  createPlayer(118, 'Iker Casillas', 'legend', 'GK', 94, 35.0, 182, 74, 20, 38, 98, 96, 85, 55, 45, 93, 97, 78, 'San Iker: Milagros en el mano a mano con reflejos felinos (SAV 98, AGI 96)'),
  createPlayer(119, 'Mario Kempes', 'legend', 'ST', 94, 38.0, 184, 85, 96, 50, 10, 92, 94, 90, 86, 90, 94, 93, 'El Matador: Potencia arrolladora entrando en diagonal desde tres cuartos'),
  createPlayer(120, 'Ricardo Bochini', 'legend', 'CM', 94, 38.0, 168, 99, 80, 42, 10, 93, 74, 85, 82, 65, 99, 98, 'El Bocha: El maestro de la pausa y el pase bochinesco que deja solo al 9'),

  // =========================================================================
  // 6. NUEVOS ÍDOLOS (IDs 121-145 | Precio: $16M a $26M | Media 82-89)
  // =========================================================================
  createPlayer(121, 'Ángel Clemente Rojas', 'idol', 'ST', 88, 24.0, 169, 86, 86, 38, 10, 98, 74, 85, 80, 72, 90, 98, 'Rojitas: Cintura mágica y quiebre de cadera inolvidable (AGI 98, CON 98)'),
  createPlayer(122, 'Rubén Suñé', 'idol', 'CB', 86, 21.0, 175, 76, 74, 92, 12, 82, 93, 84, 82, 86, 91, 78, 'El Chapa: Caudillo implacable y autor del tiro libre más famoso'),
  createPlayer(123, 'Roberto Mouzo', 'idol', 'CB', 87, 22.0, 179, 74, 68, 93, 15, 78, 94, 88, 75, 91, 92, 76, 'Símbolo eterno en la zaga: Firmeza, temperamento y jerarquía'),
  createPlayer(124, 'Antonio Rattín', 'idol', 'CM', 87, 22.0, 189, 84, 70, 92, 12, 74, 96, 80, 65, 92, 94, 82, 'El Rata: El 5 dueño de la mitad de la cancha, voz de mando y presencia física'),
  createPlayer(125, 'Alberto Márcico', 'idol', 'CM', 88, 24.0, 176, 93, 86, 48, 10, 84, 90, 88, 86, 74, 94, 96, 'El Beto: Talento puro, aguante con el cuerpo y toque de distinción en el área'),
  createPlayer(126, 'Sergio Martínez', 'idol', 'ST', 86, 21.0, 178, 74, 92, 42, 10, 88, 86, 88, 70, 88, 93, 84, 'El Manteca: Goleador de clásicos, siempre colgado del alambrado'),
  createPlayer(127, 'Silvio Marzolini', 'idol', 'LB', 89, 25.0, 179, 88, 74, 92, 10, 89, 85, 78, 72, 84, 93, 91, 'El mejor 3 de la historia: Salida elegante con la frente alta y marca limpia'),
  createPlayer(128, 'Hugo Gatti', 'idol', 'GK', 87, 21.0, 182, 88, 30, 55, 90, 92, 82, 60, 55, 86, 94, 86, 'El Loco: Achique con los pies ("La de Dios") y showman adelantado a su época'),
  createPlayer(129, 'Ubaldo Fillol', 'idol', 'GK', 89, 25.0, 181, 76, 20, 40, 96, 95, 88, 60, 50, 93, 94, 78, 'El Pato: Reflejos felinos de otro planeta y atajador de penales (SAV 96, AGI 95)'),
  createPlayer(130, 'José Luis Chilavert', 'idol', 'GK', 88, 24.0, 188, 82, 88, 42, 92, 84, 94, 96, 97, 88, 91, 80, 'Chila: Arquero caudillo y especialista letal en tiros libres y penales (FK 97, PEN 96)'),
  createPlayer(131, 'Oscar Ruggeri', 'idol', 'CB', 87, 23.0, 184, 68, 66, 93, 15, 76, 95, 75, 55, 97, 92, 70, 'El Cabezón: Guapo en las dos áreas, gana siempre de arriba (JUM 97, STR 95)'),
  createPlayer(132, 'Gabriel Heinze', 'idol', 'CB', 85, 19.0, 178, 75, 65, 91, 12, 82, 92, 74, 65, 90, 90, 76, 'El Gringo: Fiereza defensiva, barrida al piso y liderazgo'),
  createPlayer(133, 'Javier Mascherano', 'idol', 'CM', 88, 24.0, 174, 84, 62, 95, 12, 86, 91, 74, 60, 84, 96, 83, 'El Jefecito: Cruces salvadores al límite y lectura táctica suprema (PER 96, TAC 95)'),
  createPlayer(134, 'Esteban Cambiasso', 'idol', 'CM', 87, 23.0, 177, 89, 82, 88, 10, 82, 84, 80, 74, 82, 95, 89, 'El Cuchu: Cerebro táctico, relevo exacto y llegada por sorpresa al gol'),
  createPlayer(135, 'Lucho González', 'idol', 'CM', 85, 19.0, 185, 88, 86, 78, 10, 80, 85, 84, 80, 82, 89, 88, 'El Comandante: Volante mixto de tranco largo y remate de media distancia'),
  createPlayer(136, 'Andrés D\'Alessandro', 'idol', 'CM', 86, 21.0, 174, 93, 82, 42, 10, 92, 70, 88, 89, 64, 90, 95, 'El Cabezón: La Boba, pisada zurda y pases punzantes entre líneas'),
  createPlayer(137, 'Leandro Romagnoli', 'idol', 'CM', 85, 19.0, 172, 91, 80, 40, 10, 93, 68, 84, 86, 65, 89, 94, 'El Pipi: Enganche atrevido de cambio de ritmo y asistencia'),
  createPlayer(138, 'Diego Milito', 'idol', 'ST', 88, 24.0, 183, 82, 94, 42, 10, 85, 86, 91, 74, 86, 95, 90, 'El Príncipe: Enganche hacia adentro y definición cruzada infalible en finales'),
  createPlayer(139, 'Lisandro López', 'idol', 'ST', 86, 20.0, 174, 82, 90, 52, 10, 87, 84, 88, 75, 88, 91, 87, 'Licha: Movilidad por todo el frente de ataque, cabezazo y sacrificio'),
  createPlayer(140, 'Claudio López', 'idol', 'LM', 86, 21.0, 178, 80, 89, 42, 10, 95, 78, 82, 78, 80, 88, 86, 'El Piojo: Contraataque supersónico por izquierda y zurdazo violento'),
  createPlayer(141, 'Ezequiel Lavezzi', 'idol', 'LM', 84, 18.0, 173, 80, 83, 48, 10, 95, 86, 78, 72, 76, 84, 88, 'El Pocho: Potencia corta, desborde furioso y diagonales picantes'),
  createPlayer(142, 'Fernando Cavenaghi', 'idol', 'ST', 85, 19.0, 181, 78, 91, 38, 10, 80, 85, 89, 78, 84, 91, 86, 'El Torito: Goleador de raza con mil recursos adentro del área'),
  createPlayer(143, 'Diego Forlán', 'idol', 'ST', 89, 25.0, 180, 86, 96, 45, 10, 88, 85, 92, 92, 82, 92, 91, 'Cachavacha: Bombazos ambidiestros desde 35 metros (SHO 96, FK 92)'),
  createPlayer(144, 'Enzo Pérez', 'idol', 'CM', 85, 19.0, 178, 87, 74, 86, 35, 83, 84, 78, 70, 78, 91, 87, 'Motor de mitad de cancha, primer pase limpio y hasta se pone el buzo de arquero'),
  createPlayer(145, 'Carlos Bianchi', 'idol', 'ST', 88, 24.0, 179, 80, 95, 40, 10, 85, 86, 92, 78, 88, 96, 88, 'El Virrey Goleador: Artillero letal en Argentina y Francia (PER 96, SHO 95)'),

  // =========================================================================
  // 7. NUEVOS JUGADORES DE PLANTILLA (IDs 146-175 | Precio: $6M a $14M | Media 72-79)
  // =========================================================================
  createPlayer(146, 'Luis Islas', 'squad', 'GK', 78, 11.0, 181, 74, 20, 35, 85, 86, 76, 55, 45, 80, 84, 72, 'El Loco: Rápido para salir a cortar y puro reflejo bajo los palos (AGI 86, SAV 85)'),
  createPlayer(147, 'Sebastián Saja', 'squad', 'GK', 78, 11.0, 189, 72, 75, 30, 85, 78, 84, 92, 80, 82, 83, 68, 'El Chino: Arquero seguro y especialista en patear penales (PEN 92, SAV 85)'),
  createPlayer(148, 'Mauricio Caranta', 'squad', 'GK', 76, 9.0, 186, 65, 20, 30, 84, 82, 78, 45, 40, 81, 78, 62, 'Voladas elásticas en noches de Copa (SAV 84, AGI 82)'),
  createPlayer(149, 'Germán Lux', 'squad', 'GK', 75, 8.0, 186, 68, 18, 28, 83, 79, 76, 45, 38, 78, 80, 65, 'Poroto: Sobrio en el arco y rápido de reflejos (SAV 83, PER 80)'),
  createPlayer(150, 'Néstor Fabbri', 'squad', 'CB', 78, 12.0, 186, 62, 60, 86, 12, 65, 90, 70, 50, 89, 82, 62, 'La Tota: Impasable de arriba en las dos áreas (STR 90, JUM 89, TAC 86)'),
  createPlayer(151, 'Aníbal Matellán', 'squad', 'CB', 76, 9.0, 184, 60, 48, 86, 12, 68, 88, 58, 40, 84, 78, 60, 'Especialista en marcar hombre a hombre en partidos bravos (STR 88, TAC 86)'),
  createPlayer(152, 'Juan Manuel Insaurralde', 'squad', 'CB', 76, 9.0, 188, 56, 58, 84, 12, 58, 92, 65, 45, 87, 72, 55, 'El Chaco: Fuerte y áspero en cada dividida (STR 92, JUM 87, TAC 84)'),
  createPlayer(153, 'Carlos Izquierdoz', 'squad', 'CB', 78, 12.0, 186, 65, 62, 85, 12, 66, 89, 68, 45, 91, 80, 64, 'El Cali: Cabezazo imponente y voz de mando (JUM 91, STR 89, TAC 85)'),
  createPlayer(154, 'Javier Pinola', 'squad', 'CB', 78, 12.0, 181, 74, 58, 85, 12, 76, 85, 65, 55, 84, 83, 72, 'Central zurdo rápido para anticipar en mitad de cancha (TAC 85, STR 85, PER 83)'),
  createPlayer(155, 'Diego Placente', 'squad', 'LB', 77, 10.0, 177, 82, 62, 79, 10, 80, 74, 68, 60, 72, 82, 84, 'Salida limpia y elegante por el sector izquierdo (CON 84, PAS 82, PER 82)'),
  createPlayer(156, 'Leonel Vangioni', 'squad', 'LB', 77, 10.0, 176, 78, 81, 80, 10, 85, 78, 70, 74, 74, 76, 79, 'El Piri: Proyección constante, marca intensa y remate de zurda (AGI 85, SHO 81)'),
  createPlayer(157, 'Frank Fabra', 'squad', 'LB', 77, 10.0, 174, 82, 79, 66, 10, 88, 78, 72, 68, 70, 68, 89, 'Talento ofensivo de enganche jugando de 3 (CON 89, AGI 88), sufre a su espalda'),
  createPlayer(158, 'Iván Pillud', 'squad', 'RB', 75, 8.0, 179, 78, 64, 76, 10, 83, 78, 68, 60, 74, 74, 76, 'Ida y vuelta cumplidor y centros a la carrera (AGI 83, PAS 78)'),
  createPlayer(159, 'Julio Buffarini', 'squad', 'RB', 75, 8.0, 172, 70, 65, 80, 10, 86, 84, 72, 58, 75, 74, 68, 'Buffa: Entrega total, pulmón y despliegue físico (AGI 86, STR 84, TAC 80)'),
  createPlayer(160, 'Marcelo Weigandt', 'squad', 'RB', 73, 6.5, 176, 68, 66, 79, 10, 80, 84, 62, 50, 78, 72, 66, 'El Chelo: Puro empuje, barrida y llegada al segundo palo (STR 84, TAC 79)'),
  createPlayer(161, 'Iván Marcone', 'squad', 'CM', 76, 9.0, 183, 86, 60, 80, 10, 64, 84, 72, 60, 78, 84, 82, 'El Capo: Eje posicional de primer pase y ubicación (PAS 86, PER 84, STR 84)'),
  createPlayer(162, 'Andrés Cubas', 'squad', 'CM', 75, 8.0, 166, 74, 55, 88, 10, 85, 72, 60, 50, 68, 83, 76, 'Cubitas: Máquina de quitar pelotas limpias al ras del piso (TAC 88, AGI 85)'),
  createPlayer(163, 'Leandro Somoza', 'squad', 'CM', 76, 9.0, 185, 74, 70, 85, 10, 65, 88, 74, 62, 82, 82, 70, 'Cinco clásico de presencia física y orden táctico (STR 88, TAC 85, PER 82)'),
  createPlayer(164, 'Pablo Ledesma', 'squad', 'CM', 76, 9.0, 178, 78, 81, 78, 10, 78, 80, 76, 68, 76, 82, 78, 'Ocho todoterreno con gran llegada al gol desde segunda línea (PER 82, SHO 81)'),
  createPlayer(165, 'Pablo Guiñazú', 'squad', 'CM', 78, 11.0, 172, 76, 64, 87, 10, 88, 86, 68, 58, 74, 85, 76, 'El Cholo: Tres pulmones para presionar los 90 minutos (AGI 88, TAC 87, STR 86)'),
  createPlayer(166, 'Ignacio Fernández', 'squad', 'CM', 79, 14.0, 182, 88, 79, 70, 10, 80, 72, 78, 80, 72, 89, 87, 'Nacho: Cerebro zurdo de pases filtrados y lectura de espacios (PER 89, PAS 88)'),
  createPlayer(167, 'Maxi Moralez', 'squad', 'CM', 76, 9.0, 160, 84, 75, 45, 10, 91, 55, 76, 78, 55, 82, 88, 'Frasquito: Bajito escurridizo imposible de agarrar en corto (AGI 91, CON 88)'),
  createPlayer(168, 'Ricardo Centurión', 'squad', 'LM', 77, 10.0, 174, 76, 76, 40, 10, 92, 66, 72, 68, 66, 72, 92, 'Ricky: Bicicleta y gambeta endiablada en el 1 contra 1 (AGI 92, CON 92)'),
  createPlayer(169, 'Nicolás Bertolo', 'squad', 'LM', 74, 7.0, 179, 75, 72, 68, 10, 83, 76, 68, 62, 74, 74, 78, 'Carrilero de ida y vuelta y diagonal al área (AGI 83, CON 78)'),
  createPlayer(170, 'Cristian Pavón', 'squad', 'RM', 78, 12.0, 169, 78, 82, 48, 10, 94, 78, 72, 74, 72, 74, 82, 'Kichán: Balazo por la banda, centro atrás y remate de media distancia (AGI 94, SHO 82)'),
  createPlayer(171, 'Rodrigo Mora', 'squad', 'ST', 77, 10.0, 171, 76, 82, 48, 10, 88, 72, 78, 76, 78, 80, 82, 'El Uruguayo: Movilidad constante, definición por arriba y despliegue (AGI 88, SHO 82)'),
  createPlayer(172, 'Ignacio Scocco', 'squad', 'ST', 79, 14.0, 176, 80, 88, 40, 10, 86, 74, 86, 84, 74, 84, 89, 'Nacho: Golazos de autor, eludiendo rivales o de tiro libre (CON 89, SHO 88)'),
  createPlayer(173, 'Ramón Ábila', 'squad', 'ST', 77, 10.0, 179, 68, 86, 40, 10, 72, 91, 80, 60, 80, 70, 76, 'Wanchope: Potencia bruta para girar con el central colgado y fusilar (STR 91, SHO 86)'),
  createPlayer(174, 'Nicolás Blandi', 'squad', 'ST', 75, 8.0, 181, 64, 85, 36, 10, 72, 78, 78, 55, 84, 84, 72, 'Nueve silencioso de área chica: Toca pocas y las manda a guardar (SHO 85, PER 84)'),
  createPlayer(175, 'Fernando Gamboa', 'squad', 'CB', 77, 10.0, 180, 78, 58, 85, 12, 76, 84, 72, 62, 83, 84, 76, 'El Negro: Segundo central rápido y con buena salida desde el fondo (TAC 85, PER 84)'),

  // =========================================================================
  // 8. NUEVO RELLENO (IDs 176-200 | Precio: $1.8M a $2.5M | Media 74-77)
  // Especialistas de bajo presupuesto con 1 atributo pico marcado (84-92)
  // =========================================================================
  createPlayer(176, 'Emanuel Trípodi', 'filler', 'GK', 74, 1.8, 185, 58, 18, 22, 83, 76, 74, 42, 35, 70, 74, 58, 'Especialista en reflejos cortos sobre la línea de cal (SAV 83, AGI 76)'),
  createPlayer(177, 'Guillermo Sara', 'filler', 'GK', 75, 2.0, 187, 64, 18, 25, 84, 78, 74, 45, 38, 74, 75, 62, 'Rápido para achicar en el mano a mano (SAV 84, AGI 78)'),
  createPlayer(178, 'Cristian Lucchetti', 'filler', 'GK', 76, 2.5, 182, 82, 72, 28, 79, 76, 72, 89, 76, 70, 78, 78, 'El Laucha: Arquero pateador de penales y gran juego de pies (PEN 89, PAS 82)'),
  createPlayer(179, 'Sebastián Peratta', 'filler', 'GK', 75, 2.1, 189, 56, 18, 22, 85, 68, 82, 42, 35, 78, 80, 55, 'El Flaco: Largo de brazos y excelente ubicación bajo el travesaño (SAV 85, STR 82)'),
  createPlayer(180, 'Christian Cellay', 'filler', 'CB', 75, 2.1, 180, 62, 50, 84, 10, 78, 80, 58, 45, 82, 74, 62, 'El Samurai: Cruces veloces a los costados y salto (TAC 84, JUM 82, AGI 78)'),
  createPlayer(181, 'Gabriel Paletta', 'filler', 'CB', 76, 2.4, 190, 56, 48, 84, 12, 55, 91, 60, 40, 88, 74, 56, 'Torre defensiva impasable en el choque cuerpo a cuerpo (STR 91, JUM 88, TAC 84)'),
  createPlayer(182, 'Matías Cahais', 'filler', 'CB', 74, 1.8, 184, 64, 52, 84, 10, 64, 82, 58, 45, 80, 76, 62, 'Central zurdo firme en el anticipo corto (TAC 84, STR 82)'),
  createPlayer(183, 'Santiago Vergini', 'filler', 'CB', 75, 2.0, 191, 70, 54, 80, 10, 58, 84, 64, 48, 88, 74, 66, 'Altura máxima para despejar centros frontales (JUM 88, STR 84)'),
  createPlayer(184, 'Lisandro Magallán', 'filler', 'CB', 75, 2.0, 185, 60, 48, 82, 10, 76, 84, 55, 40, 86, 70, 58, 'Central rápido para correr hacia atrás y fuerte de arriba (JUM 86, STR 84, TAC 82)'),
  createPlayer(185, 'Leandro Marín', 'filler', 'RB', 75, 2.0, 177, 74, 72, 74, 10, 84, 74, 64, 60, 70, 70, 76, 'Proyección ofensiva sorpresiva y diagonal al área (AGI 84, CON 76)'),
  createPlayer(186, 'Gino Peruzzi', 'filler', 'RB', 76, 2.3, 178, 72, 74, 76, 10, 82, 82, 62, 52, 85, 72, 72, 'Lateral potente que gana siempre en el segundo palo de cabeza (JUM 85, STR 82, AGI 82)'),
  createPlayer(187, 'Fabián Monzón', 'filler', 'LB', 76, 2.3, 179, 70, 86, 74, 10, 78, 84, 74, 84, 78, 68, 70, 'Cañón zurdo de media distancia y potencia física (SHO 86, FK 84, STR 84)'),
  createPlayer(188, 'Fernando Evangelista', 'filler', 'LB', 74, 1.8, 179, 72, 56, 74, 10, 86, 68, 55, 50, 68, 68, 74, 'Carrilero liviano de gran velocidad en largo (AGI 86, CON 74)'),
  createPlayer(189, 'Juan Krupoviesa', 'filler', 'LB', 76, 2.4, 176, 66, 78, 85, 10, 68, 90, 72, 82, 76, 68, 62, 'El Tucumano: Marca feroz y zurdazo potente de tiro libre (STR 90, TAC 85, FK 82)'),
  createPlayer(190, 'Marcelo Meli', 'filler', 'CM', 76, 2.3, 176, 70, 68, 80, 10, 88, 82, 62, 50, 74, 74, 70, 'Cesarini: Despliegue incansable de área a área (AGI 88, STR 82, TAC 80)'),
  createPlayer(191, 'Gonzalo Castellani', 'filler', 'CM', 75, 2.0, 182, 86, 68, 62, 10, 68, 72, 70, 74, 68, 80, 84, 'Buen pie para tener la pelota y filtrar pases (PAS 86, CON 84, PER 80)'),
  createPlayer(192, 'Federico Carrizo', 'filler', 'LM', 76, 2.3, 170, 74, 70, 50, 10, 88, 62, 66, 65, 62, 72, 86, 'El Pachi: Gambeta encaradora en velocidad por la raya (AGI 88, CON 86)'),
  createPlayer(193, 'Pablo Mouche', 'filler', 'LM', 76, 2.4, 177, 78, 74, 42, 10, 89, 68, 70, 72, 66, 72, 82, 'Desborde zurdo explosivo para asistir al 9 (AGI 89, CON 82, PAS 78)'),
  createPlayer(194, 'Andrés Chávez', 'filler', 'ST', 76, 2.3, 184, 64, 85, 45, 10, 80, 88, 72, 65, 76, 70, 72, 'El Comandante: Topadora zurda de remate violento a la carrera (STR 88, SHO 85)'),
  createPlayer(195, 'Lucas Viatri', 'filler', 'ST', 76, 2.4, 186, 78, 80, 48, 10, 66, 84, 76, 68, 86, 78, 80, 'Nueve técnico de buen cabezazo y descarga de espaldas (JUM 86, STR 84, CON 80)'),
  createPlayer(196, 'Lucas Boyé', 'filler', 'ST', 75, 2.0, 184, 66, 68, 62, 10, 78, 90, 62, 50, 82, 72, 74, 'Tanque para chocar centrales y aguantar la pelota (STR 90, JUM 82)'),
  createPlayer(197, 'Nicolás Orsini', 'filler', 'ST', 74, 1.8, 187, 62, 68, 48, 10, 85, 86, 62, 45, 80, 68, 66, 'Potencia física para picar al vacío a espaldas de la defensa (STR 86, AGI 85)'),
  createPlayer(198, 'Jan Hurtado', 'filler', 'ST', 74, 1.8, 183, 58, 68, 45, 10, 86, 88, 60, 45, 84, 66, 66, 'Atleta puro: Fuerza, salto y velocidad para el contraataque (STR 88, AGI 86, JUM 84)'),
  createPlayer(199, 'Claudio Riaño', 'filler', 'ST', 75, 2.0, 179, 64, 84, 38, 10, 76, 74, 72, 55, 76, 78, 74, 'Definidor oportuno dentro del área rival (SHO 84, PER 78)'),
  createPlayer(200, 'Lucas Castromán', 'filler', 'RM', 77, 2.5, 177, 72, 88, 66, 10, 80, 82, 78, 80, 74, 74, 76, 'Fierrazo demoledor de media distancia y despliegue (SHO 88, STR 82, AGI 80)')
]

export function getPlayerById(id) {
  return PLAYERS_DB.find(p => p.id === Number(id)) || null
}

export function clonePlayerForTeam(player) {
  return JSON.parse(JSON.stringify(player))
}
