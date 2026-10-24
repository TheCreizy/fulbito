# `exportSQL.js` - Exportador de Base de Datos SQL

> **Categoría:** `Base de Datos`  
> **Ubicación:** `src/data/exportSQL.js`  
> **Líneas de código:** 64  
> **Tamaño:** 2.61 KB

---

## 📋 Resumen del Módulo

Utilidad para generar sentencias SQL DDL/DML listas para importar en MySQL/MariaDB en hosting compartido.

---

## 🧩 Exportaciones y Elementos Principales

- **Línea 7:** `export function generateHostingerSQL()`
- **Línea 51:** `export function downloadPlayersSQLFile()`



---

## 💻 Código Fuente JavaScript (`exportSQL.js`)

````javascript
import { PLAYERS_DB } from './playersDB.js'

/**
 * Genera el script SQL completo compatible con MySQL / MariaDB de Hostinger
 * para crear la tabla de jugadores e insertar los 200 registros calibrados.
 */
export function generateHostingerSQL() {
  const lines = [
    '-- ============================================================================',
    '-- Base de Datos MySQL para Hostinger: Simulador de Fútbol + Draft (200 Jugadores)',
    '-- ============================================================================',
    '',
    'CREATE TABLE IF NOT EXISTS `players` (',
    '  `id` INT PRIMARY KEY,',
    '  `name` VARCHAR(100) NOT NULL,',
    '  `category` ENUM(\'legend\', \'idol\', \'squad\', \'filler\') NOT NULL,',
    '  `position` VARCHAR(5) NOT NULL,',
    '  `rating` INT NOT NULL,',
    '  `price` DECIMAL(5,2) NOT NULL,',
    '  `height` INT NOT NULL,',
    '  `passing` INT NOT NULL,',
    '  `shooting` INT NOT NULL,',
    '  `tackling` INT NOT NULL,',
    '  `saving` INT NOT NULL,',
    '  `agility` INT NOT NULL,',
    '  `strength` INT NOT NULL,',
    '  `penalty_taking` INT NOT NULL,',
    '  `freekick` INT NOT NULL,',
    '  `jumping` INT NOT NULL,',
    '  `perception` INT NOT NULL,',
    '  `control` INT NOT NULL,',
    '  `specialty` VARCHAR(255) NOT NULL',
    ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;',
    '',
    'TRUNCATE TABLE `players`;',
    '',
    'INSERT INTO `players` (`id`, `name`, `category`, `position`, `rating`, `price`, `height`, `passing`, `shooting`, `tackling`, `saving`, `agility`, `strength`, `penalty_taking`, `freekick`, `jumping`, `perception`, `control`, `specialty`) VALUES'
  ]

  const rows = PLAYERS_DB.map((p, idx) => {
    const s = p.skill
    const escName = p.name.replace(/'/g, "''")
    const escSpec = p.specialty.replace(/'/g, "''")
    const comma = idx === PLAYERS_DB.length - 1 ? ';' : ','
    return `(${p.id}, '${escName}', '${p.category}', '${p.position}', ${p.rating}, ${p.price.toFixed(2)}, ${p.height}, ${s.passing}, ${s.shooting}, ${s.tackling}, ${s.saving}, ${s.agility}, ${s.strength}, ${s.penalty_taking}, ${s.freekick}, ${s.jumping}, ${s.perception}, ${s.control}, '${escSpec}')${comma}`
  })

  return [...lines, ...rows].join('\n')
}

export function downloadPlayersSQLFile() {
  const sqlContent = generateHostingerSQL()
  const blob = new Blob([sqlContent], { type: 'application/sql;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'hostinger_futbol_200_players.sql'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}


````

