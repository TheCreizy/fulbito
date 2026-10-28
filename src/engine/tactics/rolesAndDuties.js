/**
 * rolesAndDuties.js — Taxonomía de los 15 Roles Funcionales + 3 Tareas (Duties)
 * 
 * Implementa la especificación de Fase 8 (8.2) de Fulbito 2.2:
 * - 15 Roles Funcionales de campo + 2 variantes de portería
 * - 3 Duties: DEFEND, SUPPORT, ATTACK
 * - Moduladores de HFSM, evaluadores de pase/tiro y posicionamiento espacial
 */

export const DUTIES = {
  DEFEND: 'DEFEND',
  SUPPORT: 'SUPPORT',
  ATTACK: 'ATTACK'
};

export const TACTICAL_ROLES = {
  // PORTERÍA
  GK_CLASSIC: {
    id: 'GK_CLASSIC',
    name: 'Arquero Clásico',
    line: 'GK',
    allowedDuties: [DUTIES.DEFEND],
    defaultDuty: DUTIES.DEFEND,
    primaryStates: ['GK_STANDING_LINE', 'GK_DIVING_SAVE', 'GK_SMOTHER_1V1'],
    forwardBiasPx: 0,
    creativeFreedom: 0.20,
    description: 'Custodia bajo los tres palos, no arriesga con los pies y prioriza seguridad.'
  },
  GK_SWEEPER: {
    id: 'GK_SWEEPER',
    name: 'Arquero Líbero (Sweeper Keeper)',
    line: 'GK',
    allowedDuties: [DUTIES.SUPPORT, DUTIES.ATTACK],
    defaultDuty: DUTIES.SUPPORT,
    primaryStates: ['GK_SWEEPING', 'GK_SUPPORT_BACKPASS', 'GK_BUILD_UP_PASS'],
    forwardBiasPx: 22,
    creativeFreedom: 0.65,
    description: 'Adelanta posición 18-25px, barre balones profundos e inicia la salida corta.'
  },

  // DEFENSA
  CB_STOPPER: {
    id: 'CB_STOPPER',
    name: 'Marcador Central (Stopper)',
    line: 'DEF',
    allowedDuties: [DUTIES.DEFEND],
    defaultDuty: DUTIES.DEFEND,
    primaryStates: ['DEF_REST_DEFENCE', 'DEF_HOLDING_LINE', 'DEF_TACKLE_SLIDE'],
    forwardBiasPx: 0,
    creativeFreedom: 0.25,
    description: 'Marca férrea sobre la referencia rival, anticipo y prioridad en duelos físicos/aéreos.'
  },
  CB_BALL_PLAYING: {
    id: 'CB_BALL_PLAYING',
    name: 'Central Iniciador (Ball-Playing Defender)',
    line: 'DEF',
    allowedDuties: [DUTIES.SUPPORT],
    defaultDuty: DUTIES.SUPPORT,
    primaryStates: ['DEF_BALL_PLAYING_STEP', 'DEF_REST_DEFENCE', 'DEF_HOLDING_LINE'],
    forwardBiasPx: 35,
    creativeFreedom: 0.70,
    description: 'Conduce hacia Z4/Z8 para fijar marcas y filtrar pases a los Half-Spaces.'
  },
  SW_LIBERO: {
    id: 'SW_LIBERO',
    name: 'Líbero Corrector',
    line: 'DEF',
    allowedDuties: [DUTIES.DEFEND, DUTIES.SUPPORT],
    defaultDuty: DUTIES.DEFEND,
    primaryStates: ['DEF_SWEEPER_COVER', 'DEF_HOLDING_LINE', 'DEF_REST_DEFENCE'],
    forwardBiasPx: -25, // 3.5m detrás de la línea de centrales
    creativeFreedom: 0.50,
    description: 'Barre detrás de los marcadores centrales en línea de 3 o 5; da paso adelante en salida.'
  },
  FB_FULLBACK: {
    id: 'FB_FULLBACK',
    name: 'Lateral Tradicional',
    line: 'DEF',
    allowedDuties: [DUTIES.DEFEND, DUTIES.SUPPORT, DUTIES.ATTACK],
    defaultDuty: DUTIES.SUPPORT,
    primaryStates: ['DEF_FULLBACK_SUPPORT', 'DEF_OVERLAPPING', 'DEF_REST_DEFENCE', 'DEF_INVERTED_FULLBACK'],
    forwardBiasPx: 45,
    creativeFreedom: 0.60,
    description: 'DEFEND: Cierra en Rest Defence. SUPPORT: Apoyo interior o en banda. ATTACK: Overlap profundo.'
  },
  WB_WINGBACK: {
    id: 'WB_WINGBACK',
    name: 'Carrilero Largo',
    line: 'DEF',
    allowedDuties: [DUTIES.SUPPORT, DUTIES.ATTACK],
    defaultDuty: DUTIES.ATTACK,
    primaryStates: ['DEF_OVERLAPPING', 'DEF_UNDERLAPPING', 'DEF_FULLBACK_SUPPORT'],
    forwardBiasPx: 90,
    creativeFreedom: 0.75,
    description: 'Dueño absoluto de la banda en sistemas de 3 o 5 defensores (Z2/Z3 a Z13/Z15).'
  },

  // MEDIOCAMPO
  DM_ANCHOR: {
    id: 'DM_ANCHOR',
    name: 'Pivote Ancla (5 Tapón)',
    line: 'MID',
    allowedDuties: [DUTIES.DEFEND],
    defaultDuty: DUTIES.DEFEND,
    primaryStates: ['MID_SHIELDING_ZONE14', 'MID_LAVOLPIANA_DROP', 'MID_PIVOT_RECYCLE'],
    forwardBiasPx: 10,
    creativeFreedom: 0.35,
    description: 'Custodia el balcón del área propia (Z14/Z4/Z8), rara vez cruza el balón y se incrusta en salida.'
  },
  CM_PLAYMAKER_DEEP: {
    id: 'CM_PLAYMAKER_DEEP',
    name: 'Mediocentro Distribuidor (Regista)',
    line: 'MID',
    allowedDuties: [DUTIES.SUPPORT],
    defaultDuty: DUTIES.SUPPORT,
    primaryStates: ['MID_PIVOT_RECYCLE', 'MID_SHUTTLING_BASCULATION'],
    forwardBiasPx: 50,
    creativeFreedom: 0.85,
    description: 'Eje de circulación, temporización, cambios de orientación y control del ritmo.'
  },
  CM_BOX_TO_BOX: {
    id: 'CM_BOX_TO_BOX',
    name: 'Interior Todoterreno (Box-to-Box)',
    line: 'MID',
    allowedDuties: [DUTIES.SUPPORT, DUTIES.ATTACK],
    defaultDuty: DUTIES.SUPPORT,
    primaryStates: ['MID_BOX_TO_BOX_LATE_RUN', 'MID_PRESSING_TRIGGER', 'MID_COUNTER_PRESSING'],
    forwardBiasPx: 110,
    creativeFreedom: 0.65,
    description: 'Conecta las dos áreas, lidera la presión y ataca por sorpresa la Zona 4 de remate.'
  },
  AM_PRESSING: {
    id: 'AM_PRESSING',
    name: 'Mediapunta Mixto / Presión',
    line: 'MID',
    allowedDuties: [DUTIES.SUPPORT],
    defaultDuty: DUTIES.SUPPORT,
    primaryStates: ['MID_PRESSING_TRIGGER', 'MID_BOX_HALF_SPACE'],
    forwardBiasPx: 125,
    creativeFreedom: 0.60,
    description: 'Primer defensor en bloque alto; ahoga al pivote rival y ocupa el Half-Space ofensivo.'
  },
  AM_ENGANCHE: {
    id: 'AM_ENGANCHE',
    name: 'Enganche Clásico (El 10 Creativo)',
    line: 'MID',
    allowedDuties: [DUTIES.ATTACK],
    defaultDuty: DUTIES.ATTACK,
    primaryStates: ['MID_ROAMING_PLAYMAKER', 'MID_BOX_HALF_SPACE'],
    forwardBiasPx: 140,
    creativeFreedom: 0.95,
    description: 'Flota libremente entre líneas en Zona 14 y Half-Spaces; inventa asistencias o remata de afuera.'
  },

  // DELANTERA
  WG_WINGER: {
    id: 'WG_WINGER',
    name: 'Extremo Puro de Banda',
    line: 'FWD',
    allowedDuties: [DUTIES.SUPPORT, DUTIES.ATTACK],
    defaultDuty: DUTIES.ATTACK,
    primaryStates: ['FWD_HOLDING_WIDTH_ISOLATION', 'FWD_PINNING_CB'],
    forwardBiasPx: 150,
    creativeFreedom: 0.75,
    description: 'Pega la bota a la cal (Z13/Z15), encara en 1v1 exterior y asiste con centros precisos.'
  },
  WG_INVERTED: {
    id: 'WG_INVERTED',
    name: 'Extremo Invertido / Delantero Interior',
    line: 'FWD',
    allowedDuties: [DUTIES.ATTACK],
    defaultDuty: DUTIES.ATTACK,
    primaryStates: ['FWD_INVERTED_WINGER_CUT', 'FWD_RUNNING_IN_BEHIND_ARC'],
    forwardBiasPx: 160,
    creativeFreedom: 0.85,
    description: 'Ataca desde banda hacia el Half-Space y balcón del área buscando perfil de remate o pared.'
  },
  ST_FALSE_NINE: {
    id: 'ST_FALSE_NINE',
    name: 'Segunda Punta / Falso 9',
    line: 'FWD',
    allowedDuties: [DUTIES.SUPPORT],
    defaultDuty: DUTIES.SUPPORT,
    primaryStates: ['FWD_FALSE_NINE_DROP', 'FWD_ROAMING_SPACE'],
    forwardBiasPx: 130,
    creativeFreedom: 0.90,
    description: 'Desciende a Z11/Z14 para arrastrar centrales y activar al Tercer Hombre o extremos en ruptura.'
  },
  ST_TARGET_POACHER: {
    id: 'ST_TARGET_POACHER',
    name: 'Centrodelantero de Área (El 9)',
    line: 'FWD',
    allowedDuties: [DUTIES.ATTACK],
    defaultDuty: DUTIES.ATTACK,
    primaryStates: ['FWD_PINNING_CB', 'FWD_RUNNING_IN_BEHIND_ARC'],
    forwardBiasPx: 180,
    creativeFreedom: 0.50,
    description: 'Fija centrales rivales, arquea carreras de desmarque anti-offside y castiga en el área chica.'
  }
};

/**
 * Obtiene la definición de un rol táctico
 */
export function getRoleDefinition(roleId) {
  return TACTICAL_ROLES[roleId] || TACTICAL_ROLES.ST_TARGET_POACHER;
}

/**
 * Determina si una tarea (duty) es permitida para un rol dado
 */
export function isDutyAllowedForRole(roleId, duty) {
  const role = getRoleDefinition(roleId);
  return role.allowedDuties.includes(duty);
}

/**
 * Resuelve la tarea (duty) efectiva garantizando validez
 */
export function resolvePlayerDuty(roleId, requestedDuty) {
  const role = getRoleDefinition(roleId);
  if (requestedDuty && role.allowedDuties.includes(requestedDuty)) {
    return requestedDuty;
  }
  return role.defaultDuty;
}

/**
 * Asigna roles funcionales y duties coherentes a los jugadores de un equipo
 * según la formación táctica elegida.
 * 
 * @param {Object} team - Equipo
 * @param {string} formationId - ID de formación (ej. '4-3-3', '3-5-2', '5-3-2')
 */
export function assignFormationRolesAndDuties(team, formationId = '4-4-2') {
  if (!team || !Array.isArray(team.players)) return;

  team.players.forEach((player, idx) => {
    if (idx === 0 || player.position === 'GK') {
      const isSweeper = (player.skill?.perception || 70) >= 80 && (player.skill?.agility || 70) >= 75;
      player.tacticalRoleCode = isSweeper ? 'GK_SWEEPER' : 'GK_CLASSIC';
      player.duty = resolvePlayerDuty(player.tacticalRoleCode, isSweeper ? DUTIES.SUPPORT : DUTIES.DEFEND);
      return;
    }

    const pos = player.position || player.tacticalRole || 'CM';

    switch (pos) {
      case 'CB':
      case 'DFC': {
        const isLibero = formationId.startsWith('3-') || formationId.startsWith('5-');
        const isBallPlaying = (player.skill?.passing || 70) >= 78 && (player.skill?.control || 70) >= 75;
        if (isLibero && idx === 3) {
          player.tacticalRoleCode = 'SW_LIBERO';
          player.duty = DUTIES.DEFEND;
        } else if (isBallPlaying) {
          player.tacticalRoleCode = 'CB_BALL_PLAYING';
          player.duty = DUTIES.SUPPORT;
        } else {
          player.tacticalRoleCode = 'CB_STOPPER';
          player.duty = DUTIES.DEFEND;
        }
        break;
      }
      case 'LB':
      case 'LI':
      case 'RB':
      case 'LD': {
        const isWingback = formationId.startsWith('3-') || formationId.startsWith('5-');
        if (isWingback) {
          player.tacticalRoleCode = 'WB_WINGBACK';
          player.duty = DUTIES.ATTACK;
        } else {
          player.tacticalRoleCode = 'FB_FULLBACK';
          player.duty = (player.skill?.speed || 70) >= 82 ? DUTIES.ATTACK : DUTIES.SUPPORT;
        }
        break;
      }
      case 'CDM':
      case '5 TAPÓN':
      case '5 REC': {
        player.tacticalRoleCode = 'DM_ANCHOR';
        player.duty = DUTIES.DEFEND;
        break;
      }
      case 'CAM':
      case 'ENG (10)':
      case 'MP C': {
        player.tacticalRoleCode = 'AM_ENGANCHE';
        player.duty = DUTIES.ATTACK;
        break;
      }
      case 'CM':
      case '8 MIX':
      case 'VOL I':
      case 'VOL D': {
        const isB2B = (player.skill?.stamina || 70) >= 80 && (player.skill?.shooting || 65) >= 72;
        player.tacticalRoleCode = isB2B ? 'CM_BOX_TO_BOX' : 'CM_PLAYMAKER_DEEP';
        player.duty = isB2B ? DUTIES.ATTACK : DUTIES.SUPPORT;
        break;
      }
      case 'LM':
      case 'RM':
      case 'EXT':
      case 'LW':
      case 'RW': {
        const isInverted = player.preferredFoot && ((pos.includes('L') && player.preferredFoot === 'right') || (pos.includes('R') && player.preferredFoot === 'left'));
        player.tacticalRoleCode = isInverted ? 'WG_INVERTED' : 'WG_WINGER';
        player.duty = DUTIES.ATTACK;
        break;
      }
      case 'ST':
      case 'DC':
      case 'CF': {
        const isFalse9 = (player.skill?.passing || 60) >= 76 && (player.skill?.control || 70) >= 82;
        player.tacticalRoleCode = isFalse9 ? 'ST_FALSE_NINE' : 'ST_TARGET_POACHER';
        player.duty = isFalse9 ? DUTIES.SUPPORT : DUTIES.ATTACK;
        break;
      }
      default:
        player.tacticalRoleCode = 'CM_PLAYMAKER_DEEP';
        player.duty = DUTIES.SUPPORT;
    }
  });
}

/**
 * Retorna el vector de modulación de movimiento y comportamiento táctico
 */
export function getRoleMovementBias(roleId, duty = DUTIES.SUPPORT) {
  const role = getRoleDefinition(roleId);
  let forwardModifier = role.forwardBiasPx;

  if (duty === DUTIES.DEFEND) {
    forwardModifier *= 0.65;
  } else if (duty === DUTIES.ATTACK) {
    forwardModifier *= 1.35;
  }

  return {
    forwardBiasPx: forwardModifier,
    creativeFreedom: role.creativeFreedom,
    primaryStates: role.primaryStates,
    duty
  };
}
