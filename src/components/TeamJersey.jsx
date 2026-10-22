import React from 'react'

/**
 * Renderiza una camiseta de fútbol retro vectorial en SVG,
 * adaptándose dinámicamente a los colores titular y secundario
 * y reconociendo estilos clásicos (Banda River, Franja Boca, Rayas Racing/Albiceleste, etc.)
 */
export default function TeamJersey({ primaryColor = '#1d4ed8', secondaryColor = '#facc15', teamName = '', size = 70 }) {
  const nameLower = (teamName || '').toLowerCase()
  
  // Detectar patrón según el nombre del equipo
  let pattern = 'solid'
  if (nameLower.includes('river') || nameLower.includes('millonario')) {
    pattern = 'sash' // Banda diagonal
  } else if (nameLower.includes('boca') || nameLower.includes('xeneize')) {
    pattern = 'band' // Franja horizontal en el pecho
  } else if (nameLower.includes('racing') || nameLower.includes('albiceleste') || nameLower.includes('academia') || nameLower.includes('pincharreta') || nameLower.includes('pincharrata')) {
    pattern = 'stripes' // Franjas verticales
  } else if (nameLower.includes('velez') || nameLower.includes('fortin')) {
    pattern = 'chevron' // V azulada
  } else if (nameLower.includes('san lorenzo') || nameLower.includes('ciclon')) {
    pattern = 'dual_stripes' // Rayas verticales dobles
  }

  const width = size
  const height = Math.round(size * 0.95)

  return (
    <div style={{ display: 'inline-block', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.6))' }}>
      <svg
        width={width}
        height={height}
        viewBox="0 0 100 95"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Sombras y pliegues de la camiseta */}
          <linearGradient id={`jersey-shade-${primaryColor.replace('#','')}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#000" stopOpacity="0.25" />
            <stop offset="25%" stopColor="#fff" stopOpacity="0.08" />
            <stop offset="75%" stopColor="#000" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.32" />
          </linearGradient>

          {/* Máscara del cuerpo de la camiseta para recortar la banda o rayas */}
          <clipPath id="body-clip">
            <path d="M 28 16 L 36 12 C 43 18 57 18 64 12 L 72 16 L 80 40 L 68 45 L 68 88 C 68 91 65 92 62 92 L 38 92 C 35 92 32 91 32 88 L 32 45 L 20 40 Z" />
          </clipPath>
        </defs>

        {/* Silueta principal de la camiseta */}
        <g clipPath="url(#body-clip)">
          {/* Color Base */}
          <rect x="0" y="0" width="100" height="100" fill={primaryColor} />

          {/* Patrones de diseño de club */}
          {pattern === 'band' && (
            // Franja horizontal (Boca)
            <rect x="0" y="42" width="100" height="22" fill={secondaryColor} />
          )}

          {pattern === 'sash' && (
            // Banda diagonal (River)
            <polygon points="15,0 45,0 95,95 65,95" fill={secondaryColor} />
          )}

          {pattern === 'stripes' && (
            // Rayas verticales (Racing / Selección / Pincharrata)
            <>
              <rect x="37" y="0" width="9" height="100" fill={secondaryColor} />
              <rect x="54" y="0" width="9" height="100" fill={secondaryColor} />
            </>
          )}

          {pattern === 'chevron' && (
            // V en el pecho (Vélez)
            <polygon points="28,16 50,56 72,16 64,16 50,44 36,16" fill={secondaryColor} />
          )}

          {pattern === 'dual_stripes' && (
            // Rayas cuervas (San Lorenzo)
            <>
              <rect x="42" y="0" width="8" height="100" fill={secondaryColor} />
              <rect x="58" y="0" width="8" height="100" fill={secondaryColor} />
            </>
          )}

          {/* Sombra y textura sobre el cuerpo */}
          <rect x="0" y="0" width="100" height="100" fill={`url(#jersey-shade-${primaryColor.replace('#','')})`} />
        </g>

        {/* Borde exterior de la silueta */}
        <path
          d="M 28 16 L 36 12 C 43 18 57 18 64 12 L 72 16 L 80 40 L 68 45 L 68 88 C 68 91 65 92 62 92 L 38 92 C 35 92 32 91 32 88 L 32 45 L 20 40 Z"
          fill="none"
          stroke="#000000"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />

        {/* Cuello redondo o en V */}
        <path
          d="M 36 12 C 43 21 57 21 64 12"
          fill="none"
          stroke={secondaryColor}
          strokeWidth="3.2"
        />
        <path
          d="M 36 12 C 43 21 57 21 64 12"
          fill="none"
          stroke="#000"
          strokeWidth="1.2"
        />

        {/* Mangas / Puños */}
        <line x1="20" y1="40" x2="32" y2="45" stroke={secondaryColor} strokeWidth="3.5" />
        <line x1="80" y1="40" x2="68" y2="45" stroke={secondaryColor} strokeWidth="3.5" />

        {/* Escudito decorativo en el pecho izquierdo */}
        <circle cx="41" cy="34" r="3.2" fill={secondaryColor} stroke="#000" strokeWidth="0.8" />
      </svg>
    </div>
  )
}
