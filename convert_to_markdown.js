import fs from 'fs';
import path from 'path';
import * as babel from '@babel/core';

const fileSummaries = {
  // --- Datos y Configuración ---
  'formations.js': {
    title: 'Formaciones y Mentalidades Tácticas',
    description: 'Define las formaciones tácticas disponibles (4-4-2, 4-3-1-2, 4-3-3, 5-3-2, etc.), coordenadas base sobre la cancha de 680x1050, roles por posición, estilos de juego predeterminados y mentalidades tácticas (Ofensiva, Equilibrada, Defensiva).',
    category: 'Datos Tácticos y Configuración'
  },
  'playersDB.js': {
    title: 'Base de Datos Maestra de Jugadores (100 Cartas RPG)',
    description: 'Catálogo completo de los 100 futbolistas del juego divididos en 4 tiers (Leyendas, Ídolos, Plantilla y Relleno). Define la estructura exacta de atributos técnicos y físicos (shooting, passing, tackling, saving, agility, strength, penalty_taking, jumping, perception, control, stamina, freekick), posiciones naturales, precios de draft y ratings.',
    category: 'Datos y Atributos de Jugadores'
  },
  'actions.js': {
    title: 'Acciones e Interacciones de Jugadores',
    description: 'Controla las decisiones e interacciones de los jugadores en posesión o disputa: pases cortos/largos, disparos al arco, regates, centros al área, quites, intercepciones y faltas reglamentarias.',
    category: 'Comportamiento y Acciones'
  },
  'ballMovement.js': {
    title: 'Física y Trayectoria de la Pelota',
    description: 'Modela la cinemática de la pelota en coordenadas tridimensionales (X, Y, Z), fricción, rebotes, atajadas del arquero con contacto visual, offside milimétrico con penúltimo defensor, goles en red física y saques de meta.',
    category: 'Física y Cinemática'
  },
  'coachAI.js': {
    title: 'Inteligencia Artificial de Directores Técnicos',
    description: 'Algoritmo de toma de decisiones tácticas para la IA: análisis del marcador y tiempo restante, cambios de mentalidad en tiempo real y ejecución de sustituciones tácticas o por desgaste físico.',
    category: 'Inteligencia Artificial'
  },
  'common.js': {
    title: 'Funciones Auxiliares y Matemáticas Comunes',
    description: 'Conjunto de utilidades matemáticas y vectoriales: distancias euclidianas, ángulos, dimensiones de área de penal reglamentaria (162px / 16.5m), generación de números pseudoaleatorios con sesgo y cálculos trigonométricos.',
    category: 'Utilidades'
  },
  'engine.js': {
    title: 'Núcleo del Motor de Simulación (Loop Principal)',
    description: 'Coordina el ciclo de simulación paso a paso (ticks/iteraciones), inicializa los tiempos reglamentarios, gestiona tiempos suplementarios, pausas post-pelota parada sin consumir tiempo de juego y definiciones por penales.',
    category: 'Núcleo del Simulador'
  },
  'modifiers.js': {
    title: 'Modificadores de Rendimiento y Atributos',
    description: 'Aplica penalizaciones o bonificaciones sobre los atributos técnicos y físicos de los jugadores según su cansancio (fitness), adaptación al puesto natural y presencia del capitán en el equipo.',
    category: 'Reglas y Modificadores'
  },
  'playerMovement.js': {
    title: 'Movimiento y Desplazamiento de Jugadores',
    description: 'Gestiona la velocidad, aceleración, desaceleración, fatiga acumulada en cada tick, marcación personal o zonal, y desplazamiento hacia las posiciones tácticas dinámicas.',
    category: 'Física y Cinemática'
  },
  'setFreekicks.js': {
    title: 'Resolución de Tiros Libres',
    description: 'Configura y ejecuta tiros libres directos e indirectos con selección de pateador por zona, reconocimiento de roles CDM/CAM en el bloque medio y barrera defensiva respetando distancias reglamentarias.',
    category: 'Pelota Parada'
  },
  'setPositions.js': {
    title: 'Posicionamiento en Balón Parado',
    description: 'Distribuye las coordenadas espaciales de los 22 jugadores en tiros de esquina (córners), saques laterales, tiros libres, saques de arco, asignación de goleadores en rebotes (lastShooter) y definiciones por penales.',
    category: 'Pelota Parada'
  },
  'setVariables.js': {
    title: 'Inicialización y Estado de Variables del Partido',
    description: 'Establece y reinicia los contadores de tiempo, posesión, saques de mitad de cancha asociativos (isRestart), registro de iteraciones y estadísticas acumuladas de ambos equipos.',
    category: 'Estado y Variables'
  },
  'steering.js': {
    title: 'Comportamientos de Conducción y Dirección (Steering)',
    description: 'Implementa algoritmos de dirección autónoma basados en vehículos de Reynolds (seek, arrive, separate, pursuit) para movimiento fluido y realista de los futbolistas.',
    category: 'Inteligencia Artificial y Cinemática'
  },
  'teamShape.js': {
    title: 'Estructura y Bloque Dinámico del Equipo',
    description: 'Calcula el balance y la deformación del bloque del equipo en función de la posición de la pelota, líneas de presión, protección de la cueva de centrales, slots de ataque y marcas individuales con Incumbency Bonus.',
    category: 'Táctica de Equipo'
  },
  'validate.js': {
    title: 'Validación de Equipos y Atributos',
    description: 'Verifica la integridad de las estructuras de datos de los equipos, asegurando que cuenten con 11 jugadores válidos, atributos de habilidades en rangos correctos y formaciones coherentes.',
    category: 'Validación y Seguridad'
  },
  'verifyGeminiArgonAjustes2.js': {
    title: 'Suite de Verificación Automatizada (Ajustes 2)',
    description: 'Casos de prueba automatizados y aserciones estrictas para los 6 problemas resueltos: asignación de teamID en titulares y suplentes, filtrado de disputas entre compañeros, velocidad de sprint en intercepciones, preservación de BoxSlots y apoyo durante pases en vuelo, reseteo de isPendingPass al frenarse el balón, distancia euclidiana vs Manhattan y mantenimiento de la línea defensiva en getRunMovement.',
    category: 'Testing y Verificación'
  },
  'verifyGeminiArgonAjustes3.js': {
    title: 'Suite de Verificación Automatizada (Ajustes 3 - Auditoría de Video Argon)',
    description: 'Casos de prueba automatizados para los 11 puntos de auditoría: profundidad reglamentaria del área de penal (162px), atribución de goleador en rebotes (lastShooter / closestPlayer), prioridad de faltas y penales sobre acciones de balón (endIteration), soporte de roles EXT, CDM y CAM, saque inicial asociativo (isRestart, waiter a 24px, d >= 12), sincronización de IDs y skills en playersDB.js, y contacto visual en atajadas.',
    category: 'Testing y Verificación'
  },
  'verifyGeminiArgonAjustes4.js': {
    title: 'Suite de Verificación Automatizada (Ajustes 4 - Auditoría de Videos Nuevos Argon)',
    description: 'Casos de prueba automatizados para los 6 problemas detectados: sincronización de prevSnapshot post-gol y en pelota parada (eliminación de barrido fantasma), activación de centrales como Stopper/Presser cuando el delantero encara por el medio, ampliación del radio de disputa defensiva a 38px, penalización de tiros lejanos de 35m con lastShotDistance y ballProx=24, y posicionamiento reglamentario en área grande y barrera en tiros libres.',
    category: 'Testing y Verificación'
  },
  'draftEngine.js': {
    title: 'Motor de Draft por Turnos',
    description: 'Lógica del sistema de selección de jugadores por sobres (packs de 7 cartas) por rondas, control de presupuesto ($250M), balanceo de posiciones y restricciones.',
    category: 'Modo Draft'
  },
  'futDraftEngine.js': {
    title: 'Motor de FUT Draft y Química',
    description: 'Gestión avanzada del draft estilo FUT: química por nacionalidad, club o liga, selección de capitanes y armado del once titular.',
    category: 'Modo Draft'
  },
  'commentaryEngine.js': {
    title: 'Motor de Relatos y Comentarios (Araujo y Macaya)',
    description: 'Traducción y contextualización en tiempo real de los eventos del partido a relatos futboleros argentinos con frases y análisis táctico contextual.',
    category: 'Relatos y Narración'
  },
  'soundEngine.js': {
    title: 'Motor de Efectos de Sonido',
    description: 'Gestión y reproducción de audio ambiental, silbatazos, remates, festejos de gol y ambientación de estadio.',
    category: 'Audio'
  },
  'exportSQL.js': {
    title: 'Exportador de Base de Datos SQL',
    description: 'Utilidad para generar sentencias SQL DDL/DML listas para importar en MySQL/MariaDB en hosting compartido.',
    category: 'Base de Datos'
  },

  // --- Componentes UI / React (Transpilados de JSX a JS con Babel) ---
  'MatchSimulator.js': {
    title: 'Simulador 2D del Partido y Visor Canvas',
    description: 'Componente React principal para la visualización del partido en tiempo real. Maneja canvas horizontal y vertical con rotación de campo, bucle de animación a 60 FPS, repeticiones VAR de offside con líneas milimétricas reglamentarias (4800ms), animaciones de goles con red física, atajadas del arquero con contacto visual, carteles de eventos superiores, sonido dinámico y pausas tácticas.',
    category: 'Componentes UI / Simulador 2D'
  },
  'TacticsBoard.js': {
    title: 'Pizarra Táctica Interactiva y Pistas de Posición',
    description: 'Pizarra táctica interactiva con visualización de cancha completa: asignación de posiciones tácticas y coordenadas de arrastre (drag & drop), selección de formaciones predeterminadas (4-4-2, 4-3-3, 5-3-2, etc.), selección de roles (Líbero, Stop, Enganche, Volante tapón), capitanes y ejecutores de pelota parada.',
    category: 'Componentes UI / Táctica'
  },
  'FutDraftScreen.js': {
    title: 'Pantalla de FUT Draft Táctico y Química',
    description: 'Interfaz avanzada de draft estilo FUT con cálculo de química en tiempo real (nacionalidad, club y liga), rondas de selección de sobres (packs de 7 cartas), asignación al once inicial o banco y selección del capitán del equipo.',
    category: 'Componentes UI / Modo Draft'
  },
  'DraftScreen.js': {
    title: 'Pantalla de Selección de Draft ($250M)',
    description: 'Componente interactivo para el modo Draft con tope presupuestario ($250M). Muestra el sobre actual con 7 cartas sorteadas, tarjetas coleccionables interactivas, balance de posiciones, indicador de presupuesto restante, banco de suplentes y confirmación de la plantilla final.',
    category: 'Componentes UI / Modo Draft'
  },
  'MainMenu.js': {
    title: 'Menú Principal y Configuración Inicial',
    description: 'Pantalla principal de inicio del simulador. Permite seleccionar el modo de juego (Partido Rápido vs IA, Partido 2 Jugadores, Draft Clásico, FUT Draft), personalizar nombres de equipos, colores primarios/secundarios y patrones de indumentaria.',
    category: 'Componentes UI / Menú'
  },
  'PenaltyShootoutModal.js': {
    title: 'Modal de Definición por Penales',
    description: 'Ventana modal interactiva para dirimir empates reglamentarios mediante tanda de 5 penales y serie de 1 a 1 en muerte súbita: selección de ejecutores y visualización del marcador de penales.',
    category: 'Componentes UI / Modales'
  },
  'PlayerCard.js': {
    title: 'Carta de Jugador / Ficha RPG Coleccionable',
    description: 'Componente visual para renderizar la ficha coleccionable de cada futbolista. Muestra foto/avatar, media global (OVR), posición natural y polifuncional, atributos físicos y técnicos destacados (remate, pase, quite, velocidad, salto, resistencia, cabezazo) y rasgos de personalidad.',
    category: 'Componentes UI / Cartas'
  },
  'TeamJersey.js': {
    title: 'Generador Vectorial SVG de Camisetas',
    description: 'Componente gráfico SVG que dibuja la camiseta y short de cada equipo según su esquema de colores y patrones visuales (liso, bastones verticales, banda diagonal cruzada, franja horizontal) junto al dorsal.',
    category: 'Componentes UI / Gráficos'
  },
  'App.js': {
    title: 'Componente Raíz de la Aplicación',
    description: 'Orquestador principal de estado y navegación de la aplicación: administra las transiciones entre pantallas (menu, draft, fut-draft, tactics, match), almacena los objetos de los equipos y maneja los reinicios.',
    category: 'Componentes UI / Raíz'
  }
};

// =========================================================================
// FASE 1: TRANSPILACIÓN DE ARCHIVOS JSX A JS CON BABEL
// =========================================================================
console.log('======================================================================');
console.log('=== FASE 1: TRANSPILANDO COMPONENTES JSX A JS (BABEL) ===');
console.log('======================================================================\n');

const componentsDir = 'src/components';
const jsxFiles = [];

if (fs.existsSync(componentsDir)) {
  const compFiles = fs.readdirSync(componentsDir)
    .filter(file => file.endsWith('.jsx'))
    .map(file => path.join(componentsDir, file));
  jsxFiles.push(...compFiles);
}

if (fs.existsSync('src/App.jsx')) {
  jsxFiles.push('src/App.jsx');
}

const componentFilesToConvert = [];

for (const srcPath of jsxFiles) {
  const rawJsx = fs.readFileSync(srcPath, 'utf8');
  const filename = path.basename(srcPath);
  const jsFilename = filename.replace(/\.jsx$/, '.js');
  const destJsPath = srcPath.replace(/\.jsx$/, '.js');

  try {
    const babelResult = babel.transformSync(rawJsx, {
      filename,
      presets: [
        ['@babel/preset-react', {
          runtime: 'automatic',
          development: false
        }]
      ],
      configFile: false,
      babelrc: false,
      compact: false,
      retainLines: true
    });

    fs.writeFileSync(destJsPath, babelResult.code, 'utf8');
    console.log(`✓ Babel transpilado: ${srcPath} -> ${destJsPath} (${(babelResult.code.length / 1024).toFixed(1)} KB)`);

    componentFilesToConvert.push({
      source: destJsPath,
      dest: `mdfiles/${jsFilename.replace(/\.js$/, '.md')}`,
      filename: jsFilename,
      originalJsxPath: srcPath
    });
  } catch (err) {
    console.error(`❌ Error transpilando ${srcPath} con Babel:`, err.message);
  }
}

// =========================================================================
// FASE 2: LISTA DE ARCHIVOS A CONVERTIR A MARKDOWN (.MD)
// =========================================================================
const baseFilesToConvert = [
  { source: 'src/data/formations.js', dest: 'mdfiles/formations.md', filename: 'formations.js' },
  { source: 'src/data/playersDB.js', dest: 'mdfiles/playersDB.md', filename: 'playersDB.js' },
  { source: 'src/engine/actions.js', dest: 'mdfiles/actions.md', filename: 'actions.js' },
  { source: 'src/engine/ballMovement.js', dest: 'mdfiles/ballMovement.md', filename: 'ballMovement.js' },
  { source: 'src/engine/coachAI.js', dest: 'mdfiles/coachAI.md', filename: 'coachAI.js' },
  { source: 'src/engine/common.js', dest: 'mdfiles/common.md', filename: 'common.js' },
  { source: 'src/engine/engine.js', dest: 'mdfiles/engine.md', filename: 'engine.js' },
  { source: 'src/engine/modifiers.js', dest: 'mdfiles/modifiers.md', filename: 'modifiers.md' },
  { source: 'src/engine/playerMovement.js', dest: 'mdfiles/playerMovement.md', filename: 'playerMovement.js' },
  { source: 'src/engine/setFreekicks.js', dest: 'mdfiles/setFreekicks.md', filename: 'setFreekicks.js' },
  { source: 'src/engine/setPositions.js', dest: 'mdfiles/setPositions.md', filename: 'setPositions.js' },
  { source: 'src/engine/setVariables.js', dest: 'mdfiles/setVariables.md', filename: 'setVariables.js' },
  { source: 'src/engine/steering.js', dest: 'mdfiles/steering.md', filename: 'steering.js' },
  { source: 'src/engine/teamShape.js', dest: 'mdfiles/teamShape.md', filename: 'teamShape.js' },
  { source: 'src/engine/validate.js', dest: 'mdfiles/validate.md', filename: 'validate.js' },
  { source: 'tests/verifyGeminiArgonAjustes2.js', dest: 'mdfiles/verifyGeminiArgonAjustes2.md', filename: 'verifyGeminiArgonAjustes2.js' },
  { source: 'tests/verifyGeminiArgonAjustes3.js', dest: 'mdfiles/verifyGeminiArgonAjustes3.md', filename: 'verifyGeminiArgonAjustes3.js' },
  { source: 'tests/verifyGeminiArgonAjustes4.js', dest: 'mdfiles/verifyGeminiArgonAjustes4.md', filename: 'verifyGeminiArgonAjustes4.js' },
  { source: 'src/draft/draftEngine.js', dest: 'mdfiles/draftEngine.md', filename: 'draftEngine.js' },
  { source: 'src/draft/futDraftEngine.js', dest: 'mdfiles/futDraftEngine.md', filename: 'futDraftEngine.js' },
  { source: 'src/commentary/commentaryEngine.js', dest: 'mdfiles/commentaryEngine.md', filename: 'commentaryEngine.js' },
  { source: 'src/audio/soundEngine.js', dest: 'mdfiles/soundEngine.md', filename: 'soundEngine.js' },
  { source: 'src/data/exportSQL.js', dest: 'mdfiles/exportSQL.md', filename: 'exportSQL.js' }
];

const allFilesToConvert = [
  ...baseFilesToConvert,
  ...componentFilesToConvert
];

if (!fs.existsSync('mdfiles')) {
  fs.mkdirSync('mdfiles', { recursive: true });
}

console.log('\n======================================================================');
console.log('=== FASE 2: CONVIRTIENDO ARCHIVOS JS A MARKDOWN (MDFILES) ===');
console.log('======================================================================\n');

let processed = 0;

for (const item of allFilesToConvert) {
  if (!fs.existsSync(item.source)) {
    console.warn(`Archivo no encontrado: ${item.source}`);
    continue;
  }

  const rawCode = fs.readFileSync(item.source, 'utf8');
  const info = fileSummaries[item.filename] || {
    title: item.filename,
    description: 'Módulo del proyecto de fútbol.',
    category: 'Módulo General'
  };

  const functionMatches = [];
  const exportMatches = [];

  const lines = rawCode.split('\n');
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('export const ') || trimmed.startsWith('export function ') || trimmed.startsWith('export let ') || trimmed.startsWith('export default ')) {
      exportMatches.push({ line: idx + 1, text: trimmed.replace(/\{?$/, '').trim() });
    } else if (trimmed.startsWith('function ') || trimmed.startsWith('async function ')) {
      const match = trimmed.match(/function\s+([a-zA-Z0-9_$]+)\s*\(([^)]*)\)/);
      if (match) {
        functionMatches.push({ name: match[1], params: match[2], line: idx + 1 });
      }
    }
  });

  let originalJsxSection = '';
  if (item.originalJsxPath && fs.existsSync(item.originalJsxPath)) {
    const rawJsx = fs.readFileSync(item.originalJsxPath, 'utf8');
    const jsxLines = rawJsx.split('\n').length;
    originalJsxSection = `
---

## ⚛️ Código Fuente Original en React JSX (\`${path.basename(item.originalJsxPath)}\`)

> **Archivo original:** \`${item.originalJsxPath}\`  
> **Líneas JSX:** ${jsxLines}  
> **Tamaño:** ${(rawJsx.length / 1024).toFixed(2)} KB

<details>
<summary><b>Haz clic aquí para desplegar el código fuente original en JSX</b></summary>

\`\`\`\`jsx
${rawJsx}
\`\`\`\`

</details>
`;
  }

  const mdContent = `# \`${item.filename}\` - ${info.title}

> **Categoría:** \`${info.category}\`  
> **Ubicación:** \`${item.source}\`  
> **Líneas de código:** ${lines.length}  
> **Tamaño:** ${(rawCode.length / 1024).toFixed(2)} KB

---

## 📋 Resumen del Módulo

${info.description}

---

## 🧩 Exportaciones y Elementos Principales

${exportMatches.length > 0 ? exportMatches.map(e => `- **Línea ${e.line}:** \`${e.text}\``).join('\n') : '_No contiene exportaciones directas explícitas._'}

${functionMatches.length > 0 ? `### Funciones Internas Notables\n\n| Función | Parámetros | Línea |\n| :--- | :--- | :--- |\n` + functionMatches.map(f => `| \`${f.name}\` | \`${f.params || 'ninguno'}\` | L${f.line} |`).join('\n') : ''}

---

## 💻 Código Fuente JavaScript (\`${item.filename}\`)

\`\`\`\`javascript
${rawCode}
\`\`\`\`
${originalJsxSection}
`;

  fs.writeFileSync(item.dest, mdContent, 'utf8');
  console.log(`Generado: ${item.dest} (${(rawCode.length / 1024).toFixed(1)} KB)`);
  processed++;
}

// Copiar notas_analisis_proyecto.md directamente a mdfiles/
if (fs.existsSync('notas_analisis_proyecto.md')) {
  fs.copyFileSync('notas_analisis_proyecto.md', 'mdfiles/notas_analisis_proyecto.md');
  console.log('Copiado: mdfiles/notas_analisis_proyecto.md');
  processed++;
}

console.log(`\n======================================================================`);
console.log(`🎉 CONVERSIÓN COMPLETA: ${processed} archivos procesados y actualizados en mdfiles/`);
console.log(`======================================================================`);
