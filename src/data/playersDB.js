// Base de Datos Maestra de los 100 Jugadores (Calibración RPG: Leyendas, Ídolos, Plantilla y Relleno)
// Compatible con el motor físico footballSimulationEngine + extensiones (freekick, perception, control)

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

function createPlayer(id, name, category, position, rating, price, height, pas, sho, tac, sav, agi, str, pen, fk, jum, per, con, specialty) {
  const rawPositions = EXTRA_POSITIONS_BY_ID[id] || [position]
  const positions = Array.from(new Set([position, ...rawPositions]))
  return {
    id,
    name,
    category, // 'legend' | 'idol' | 'squad' | 'filler'
    position, // Posición principal: 'GK' | 'CB' | 'LB' | 'RB' | 'CM' | 'LM' | 'RM' | 'ST'
    positions, // Todas las posiciones naturales del jugador (100% compatibilidad)
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
    description: 'Gangas de bajo presupuesto con 1 única virtud extrema y grandes debilidades (Media 54-64)'
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
  // 4. RELLENO (25 Jugadores | Precio: $1.0M a $3.0M | Media 54-64)
  // =========================================================================
  createPlayer(76, 'Javier García', 'filler', 'GK', 63, 2.5, 181, 80, 15, 25, 62, 56, 60, 45, 40, 58, 58, 78, 'Buen pie para salir jugando (PAS 80, CON 78), pero flojo atajando (SAV 62)'),
  createPlayer(77, 'Josué Ayala', 'filler', 'GK', 60, 2.0, 188, 42, 15, 20, 75, 52, 65, 38, 30, 60, 52, 40, 'Atajador puro bajo los palos (SAV 75), pésimo con los pies y lento'),
  createPlayer(78, 'Fabián Assmann', 'filler', 'GK', 58, 1.5, 184, 45, 15, 20, 58, 76, 55, 38, 30, 58, 50, 45, 'Rápido de piernas para salir (AGI 76), pero manos flojas (SAV 58)'),
  createPlayer(79, 'César Rigamonti', 'filler', 'GK', 55, 1.0, 185, 40, 15, 20, 56, 50, 78, 35, 30, 76, 48, 38, 'Saca centros arriba (STR 78, JUM 76), pero da rebote en tiros bajos'),
  createPlayer(80, 'Chiqui Pérez', 'filler', 'CB', 63, 2.5, 186, 38, 52, 70, 12, 40, 86, 85, 58, 70, 48, 38, 'Fuerza bruta (STR 86) y Penales (PEN 85), lentísimo y rústico con la pelota'),
  createPlayer(81, 'Luiz Alberto', 'filler', 'CB', 56, 1.0, 187, 35, 30, 74, 10, 38, 72, 40, 25, 65, 45, 35, 'Buena entrada frontal (TAC 74), un tronco para girar y pasarla'),
  createPlayer(82, 'Breyner Bonilla', 'filler', 'CB', 54, 1.0, 190, 32, 28, 66, 10, 38, 86, 35, 25, 72, 40, 32, 'Roca física (STR 86), pésimo pase (32) y lectura peligrosa'),
  createPlayer(83, 'Guillermo Burdisso', 'filler', 'CB', 64, 3.0, 189, 45, 55, 66, 10, 46, 74, 50, 35, 86, 55, 44, 'Especialista en cabezazo en ambas áreas (JUM 86), lento por abajo'),
  createPlayer(84, 'Matías Caruzzo', 'filler', 'CB', 64, 3.0, 181, 54, 40, 76, 10, 56, 62, 55, 40, 62, 64, 52, 'Quite limpio en el mano a mano (TAC 76), sufre con nueves grandotes'),
  createPlayer(85, 'Franco Sosa', 'filler', 'RB', 61, 2.0, 173, 48, 68, 56, 10, 54, 68, 60, 80, 58, 50, 48, 'Tiro Libre potente (FK 80), flojo marcando y pasando la pelota'),
  createPlayer(86, 'Emiliano Albín', 'filler', 'RB', 57, 1.5, 177, 46, 42, 50, 10, 78, 52, 45, 35, 54, 46, 48, 'Rápido para correr la banda (AGI 78), no marca ni tira buenos centros'),
  createPlayer(87, 'Nahuel Zárate', 'filler', 'LB', 54, 1.0, 179, 40, 38, 52, 10, 48, 76, 40, 30, 55, 42, 40, 'Fuerte en el choque (STR 76), muy limitado en todo lo demás'),
  createPlayer(88, 'Bruno Urribarri', 'filler', 'LB', 59, 1.5, 178, 50, 42, 56, 10, 50, 60, 50, 45, 58, 75, 48, 'Bien parado tácticamente (PER 75), pero lento y nulo en ataque'),
  createPlayer(89, 'Hernán Grana', 'filler', 'RB', 60, 2.0, 170, 52, 45, 50, 10, 80, 48, 48, 40, 50, 48, 56, 'Pique corto explosivo (AGI 80), livianito en el cuerpo a cuerpo'),
  createPlayer(90, 'Ribair Rodríguez', 'filler', 'CM', 64, 3.0, 181, 46, 48, 68, 10, 48, 88, 50, 35, 68, 52, 44, 'Topadora física en el medio (STR 88), pies redondos (CON 44)'),
  createPlayer(91, 'Jesús Méndez', 'filler', 'CM', 63, 2.5, 178, 76, 64, 52, 10, 52, 58, 62, 78, 55, 50, 62, 'Buena pegada y cambio de frente (FK 78, PAS 76), lento para el retroceso'),
  createPlayer(92, 'Sebastián Prediger', 'filler', 'CM', 60, 2.0, 181, 48, 42, 76, 10, 50, 64, 45, 35, 58, 54, 46, 'Roba pelotas en mitad de cancha (TAC 76), la pierde rápido al pasar'),
  createPlayer(93, 'Gonzalo Escalante', 'filler', 'CM', 62, 2.5, 182, 54, 50, 58, 10, 76, 62, 50, 40, 60, 54, 52, 'Ida y vuelta físico (AGI 76), sin pase filtrado ni gol'),
  createPlayer(94, 'Federico Bravo', 'filler', 'CM', 58, 1.5, 181, 48, 38, 74, 10, 45, 68, 45, 30, 58, 50, 44, '5 tapón de quite posicional (TAC 74), nulo aporte ofensivo'),
  createPlayer(95, 'Damián Escudero', 'filler', 'LM', 62, 2.5, 175, 54, 55, 32, 10, 66, 50, 52, 50, 48, 48, 79, 'Buen control y gambeta en corto (CON 79), se apaga al definir'),
  createPlayer(96, 'Matías Giménez', 'filler', 'LM', 60, 2.0, 178, 75, 50, 42, 10, 54, 54, 52, 50, 52, 50, 55, 'Tira buenos centros a la carrera (PAS 75), lento para desbordar'),
  createPlayer(97, 'Joel Acosta', 'filler', 'RM', 57, 1.5, 173, 44, 46, 35, 10, 80, 46, 45, 35, 48, 42, 52, 'Correcaminos por la banda derecha (AGI 80), decide mal al final'),
  createPlayer(98, 'Naohiro Takahara', 'filler', 'ST', 61, 2.0, 181, 44, 76, 30, 10, 54, 58, 60, 40, 66, 52, 48, 'Buen remate de primera (SHO 76), desconectado del circuito de juego'),
  createPlayer(99, 'Franco Soldano', 'filler', 'ST', 62, 2.5, 186, 52, 52, 64, 10, 78, 80, 50, 35, 82, 58, 48, 'Presiona, corre y salta todo el partido (AGI 78, STR 80, JUM 82), sin gol (SHO 52)'),
  createPlayer(100, 'Emmanuel Gigliotti', 'filler', 'ST', 64, 3.0, 187, 45, 78, 32, 10, 48, 80, 52, 45, 74, 55, 48, 'Cañón en el área y cuerpo (SHO 78, STR 80), lento y errático en penales')
]

export function getPlayerById(id) {
  return PLAYERS_DB.find(p => p.id === Number(id)) || null
}

export function clonePlayerForTeam(player) {
  return JSON.parse(JSON.stringify(player))
}
