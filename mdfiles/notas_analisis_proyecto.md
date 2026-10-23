# Notas de Análisis del Proyecto: Juego de Fútbol (Simulador + Draft)

## 1. Resumen del Objetivo General
Construir una aplicación web de simulación de fútbol en 2D (estilo *Football Manager* clásico combinado con *Ultimate Team Draft* / *Auto-chess* y relatos argentinos estilo **Araujo y Macaya Márquez**), lista para desplegarse en un **hosting compartido de Hostinger**.

### Flujo Principal del Juego:
1. **Selección de Modo**: PvP (2 jugadores) o vs IA.
2. **Modo Draft por Turnos con Presupuesto**:
   - Presupuesto inicial sugerido: **$250M** por equipo.
   - Plantel a completar: **16 jugadores** (11 titulares + 5 suplentes).
   - Pool de **100 jugadores** divididos en 4 categorías con diseño tipo RPG (especialidades marcadas):
     - **Leyendas (20)**: Media 93-99 | Precio $35M-$45M | Buenos en casi todo.
     - **Ídolos (25)**: Media 82-89 | Precio $16M-$26M | Destacan en 4-5 atributos clave.
     - **Jugadores de Plantilla (30)**: Media 72-79 | Precio $6M-$14M | Cumplidores con 1-3 puntos fuertes (80-94) y resto normal (60-72).
     - **Relleno (25)**: Media 54-64 | Precio $1M-$3M | Especialistas extremos en 1 sola virtud (74-88) y flojos en el resto (32-55).
   - En cada ronda se muestra una mano/sobre de jugadores (ej. 7 cartas) y se elige por turnos descontando del presupuesto.
3. **Pizarra Táctica Pre-Partido y En Vivo**:
   - Elección de formación (ej. 4-4-2, 4-3-3, 5-3-2, etc.) y mentalidad táctica (Defensiva, Equilibrada, Ofensiva).
   - Asignación de roles: **Capitán**, **Pateador de Tiros Libres**, **Córners** y **Penales**.
   - Sustituciones y cambios tácticos en vivo (pausando el partido o en el entretiempo) respetando las reglas del fútbol (máximo de cambios, jugadores expulsados no reemplazables).
4. **Simulación del Partido (Visor 2D + Relatos + Estadísticas)**:
   - Cancha 2D en HTML5 `<canvas>` (escala `680x1050`) con las 22 fichas + pelota (con altura `z`).
   - **3 Velocidades**:
     1. *Normal (x1)*
     2. *Rápida (x2 / x4)*
     3. *Simular Resultado Directo* (ejecución instantánea en memoria hasta el final).
   - **Estadísticas en vivo**: Posesión %, Goles, Tiros (totales / al arco / afuera), Pases (totales / completados), Quites, Faltas, Córners, Tiros Libres, Penales, Tarjetas y Cansancio (`fitness`).
   - **Motor de Relatos estilo Araujo y Macaya**: Traduce e interpreta contextualmente los eventos de `iterationLog`, quién tiene la pelota, su categoría/especialidad y la zona de la cancha.

---

## 2. Hallazgos Técnicos del Motor (`footballSimulationEngine-master`)

Al inspeccionar el código fuente completo (`engine.js` y `lib/*.js`), detectamos cómo funciona por dentro y qué ajustes técnicos son indispensables:

### A. Adaptación para Navegador (Hostinger Shared Hosting)
- El motor está escrito en CommonJS (`require` / `module.exports`).
- [`lib/common.js`](file:///e:/Herny/2025/The%20Creizy/Jugo%20futbol/footballSimulationEngine-master/lib/common.js#L1) importa `const fs = require('fs')` únicamente para la función auxiliar `readFile()`, la cual ni siquiera es usada por [`engine.js`](file:///e:/Herny/2025/The%20Creizy/Jugo%20futbol/footballSimulationEngine-master/engine.js).
- [`engine.js`](file:///e:/Herny/2025/The%20Creizy/Jugo%20futbol/footballSimulationEngine-master/engine.js#L89) hace un `console.log(JSON.stringify(matchDetails))` en cada iteración (línea 89) y [`lib/ballMovement.js`](file:///e:/Herny/2025/The%20Creizy/Jugo%20futbol/footballSimulationEngine-master/lib/ballMovement.js#L692) hace `console.log(finalTarget)` (línea 692). Eliminar esos `console.log` acelerará la simulación instantánea más de 100x.

### B. Bugs Críticos del Motor Original que Debemos Corregir
1. **Estadísticas de tiros invertidas según el tiempo (`lib/ballMovement.js` L129-130 y L194-195)**:
   - En `shotMade` y `penaltyTaken`, el motor suma los tiros a `kickOffTeamStatistics` si `half` es par y a `secondTeamStatistics` si `half` es impar, ¡sin importar qué equipo pateó! Debe corregirse para comparar `team.teamID === matchDetails.kickOffTeam.teamID`.
2. **Tarjetas Rojas y `Object.defineProperty` (`lib/playerMovement.js` L110-125 y L138-153)**:
   - Cuando un jugador recibe tarjeta roja, el motor define `currentPOS: ['NP', 'NP']` con `writable: false`.
   - Luego, cuando hay un gol, entretiempo, córner o tiro libre (`setVariables.js`, `setPositions.js`, `setFreekicks.js`), el motor intenta reasignar `player.currentPOS = ...` a todos los jugadores o calcular distancias con `['NP', 'NP']`, lo que produce `NaN` en coordenadas o lanza un error fatal en modo estricto (`TypeError: Cannot assign to read only property 'currentPOS'`).
3. **Índice `0` ignorado en quites (`lib/actions.js` L340 y L366)**:
   - Hace `if (index) thatPlayer = opposition.players[index]`. Si el jugador con la pelota es el índice `0` (arquero), `if (0)` da `false` y nunca se puede quitarle la pelota. Debe ser `if (index !== -1)`.
4. **Pateadores fijos por índice de array en Pelota Parada**:
   - **Córners (`lib/setPositions.js`)**: Fuerza siempre a `attack.players[1]` (el lateral izquierdo) a patear todos los córners.
   - **Tiros Libres (`lib/setFreekicks.js`)**: Fuerza a `attack.players[3]` o `attack.players[5]` a patear los tiros libres, y **no existe resolución de tiro libre directo al arco** (solo queda con la pelota en los pies en esa coordenada) ni usa el atributo `freekick` (`FK`).
   - **Penales (`lib/setPositions.js` L381)**: `selectPenaltyTaker` ordena por `shooting` en lugar de usar el pateador asignado por el usuario o `penalty_taking`.
   - **Saques de mitad de cancha (`lib/setVariables.js` L57 y `lib/setPositions.js` L504)**: Fuerza siempre a `players[9]` y `players[10]`.
5. **Impacto Real del Cansancio (`fitness`), Posiciones Fuera de Puesto y Capitán**:
   - Actualmente `fitness` baja muy lento (`-0.005` al correr, `-0.01` al esprintar), en el entretiempo sube `+50`, y no penaliza la velocidad ni los atributos cuando el jugador está cansado.
   - El atributo `freekick` (`FK`) y el rol de **Capitán** propuestos en el PDF deben integrarse en la lógica del motor.
   - En `lib/validate.js`, `validatePlayerSkills` valida 8 skills (`passing`, `shooting`, `tackling`, `saving`, `agility`, `strength`, `penalty_taking`, `jumping`), mientras que el motor también usa `perception`, `control` y agregaremos `freekick`.


---

## 3. Decisiones Confirmadas por el Usuario

1. **Modalidad de Juego**:
   - **PvP Local (Pass & Play en el mismo dispositivo)** y **Modo vs IA** en esta primera versión, con arquitectura desacoplada lista para conectar PvP Online (PHP/MySQL en Hostinger) más adelante.
2. **Sistema de Draft ($250M / 16 Rondas)**:
   - Sobres individuales de **7 cartas** por ronda sin jugadores repetidos entre ambos planteles.
   - **Mecánica de "Reroll"**: Posibilidad de pagar **$2M** una vez por ronda para cambiar las 7 cartas del sobre actual.
   - **Salvavidas económico ("Failsafe")**: El generador de sobres garantiza que siempre aparezcan cartas comprables con el presupuesto restante reservando al menos $1M por cada jugador que falte fichar.
3. **Mejoras al Motor (`footballSimulationEngine`)**:
   - Corrección de todos los bugs del motor original (estadísticas por equipo en vez de paridad del tiempo, manejo limpio de expulsados sin romper asignaciones de posición, quites al arquero `index !== -1`).
   - **Tiros Libres Directos (`FK`)**: En el último cuarto de cancha rival, los tiros libres pueden ejecutarse como remates directos al arco usando el atributo `freekick` (`FK`) del pateador designado.
   - **Cansancio Real (`fitness`)**: El desgaste físico reduce progresivamente atributos físicos y técnicos a lo largo del partido, haciendo vitales los **5 cambios** permitidos (y un desgaste adicional en el Alargue).
   - **Química de Puesto y Capitán**: Penalización gradual de stats si un jugador es ubicado fuera de su posición natural (ej. leve entre `LM`/`RM`/`CM`, severa entre `ST` y `CB`/`GK`), y bonus pasivo del **Capitán** (+3 en `perception` y menor desgaste de `fitness` para el equipo).
4. **Duración del Partido, Alargue y Penales**:
   - **Tiempo Reglamentario (90')**: ~2000 iteraciones totales (1000 por tiempo) a ~150ms por tick en **Velocidad Normal (x1)** (~5 minutos reales), **Velocidad Rápida (x4)** (~1 min 15 seg), y **Simular Resultado Directo** (<1 segundo).
   - **Desempate**: Si empatan a los 90', se juega **Alargue** (2 tiempos de 15' = ~660 iteraciones totales) y, de persistir el empate, **Definición por Penales** interactiva/visual usando los stats `penalty_taking` (`PEN`) de los pateadores y `saving` (`SAV`) + `perception` (`PER`) de los arqueros.
5. **Base de Datos**:
   - Base maestra con los **100 jugadores** (Leyendas, Ídolos, Plantilla y Relleno) en módulo JSON/JS optimizado para despliegue directo en Hostinger + script/utilidad de exportación SQL para futura migración a MySQL.
6. **Diseño Visual y Relatos**:
   - Estética **"Fútbol de Primera / PC Fútbol"** (años 90/2000 modernizado): marcador clásico de TV, cartas coleccionables diferenciadas por tier (Dorada/Épica para Leyendas, Plateada/Especial para Ídolos, Bronce/Acero para Plantilla, Rústica para Relleno).
   - Motor de relatos contextuales estilo **Marcelo Araujo y Enrique Macaya Márquez**.
