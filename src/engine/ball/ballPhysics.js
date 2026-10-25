/**
 * ballPhysics.js — Balística 2.5D, Vuelo, Magnus, Fricción y Rebote
 * Modela la física continua del balón en 2.5D (coordenadas x, y, z, vz, spinZ).
 * Inspirado en open_football_engine/src/match/engine/ball/flight/ (ballistics.rs, aerial.rs, roll.rs).
 */

export const BALL_PHYSICS = {
  GRAVITY: 0.28,           // Aceleración gravitatoria por tick
  AIR_DRAG: 0.992,         // Resistencia aerodinámica en vuelo
  GRASS_FRICTION: 0.955,   // Fricción de rodamiento en césped seco
  WET_FRICTION: 0.972,     // Césped mojado: patina más rápido
  BOUNCE_RESTITUTION: 0.56,// Coeficiente de restitución vertical
  BOUNCE_XY_DAMPING: 0.82, // Amortiguación horizontal en cada pique
  MAGNUS_COEFF: 0.018,     // Coeficiente de comba lateral por spinZ
};

/**
 * Sincroniza propiedades escalares (x, y, z, vx, vy) con arrays de compatibilidad de Fulbito (position, velocity)
 */
export function syncBallState(ball) {
  if (!ball) return;

  // Si position existe como array [x, y, z], asegurar ball.x, ball.y, ball.z
  if (Array.isArray(ball.position)) {
    if (ball.x === undefined) ball.x = ball.position[0];
    if (ball.y === undefined) ball.y = ball.position[1];
    if (ball.z === undefined) ball.z = ball.position[2] || 0;
  } else {
    ball.x = ball.x ?? 0;
    ball.y = ball.y ?? 0;
    ball.z = ball.z ?? 0;
    ball.position = [ball.x, ball.y, ball.z];
  }

  // Si velocity existe como array [vx, vy]
  if (Array.isArray(ball.velocity)) {
    if (ball.vx === undefined) ball.vx = ball.velocity[0];
    if (ball.vy === undefined) ball.vy = ball.velocity[1];
  } else {
    ball.vx = ball.vx ?? 0;
    ball.vy = ball.vy ?? 0;
    ball.velocity = [ball.vx, ball.vy];
  }

  ball.vz = ball.vz ?? 0;
  ball.spinZ = ball.spinZ ?? 0;
}

/**
 * Lanza o impacta el balón en 2.5D
 * @param {Object} ball - Objeto balón
 * @param {number} vx - Velocidad horizontal X
 * @param {number} vy - Velocidad vertical Y
 * @param {number} vz - Velocidad de elevación Z
 * @param {number} spinZ - Rotación para efecto Magnus (positivo = curva a derecha, negativo = izquierda)
 */
export function kickBall25D(ball, vx, vy, vz = 0, spinZ = 0) {
  syncBallState(ball);

  ball.vx = vx;
  ball.vy = vy;
  ball.vz = vz;
  ball.z = Math.max(0, ball.z || 0);
  ball.spinZ = spinZ;
  ball.ownerId = null;
  ball.withPlayer = false;
  ball.Player = null;

  ball.position[0] = ball.x;
  ball.position[1] = ball.y;
  ball.position[2] = ball.z;
  ball.velocity[0] = ball.vx;
  ball.velocity[1] = ball.vy;

  ball.landingPoint = predictBallLanding(ball);
}

/**
 * Predice analítica e iterativamente dónde y cuándo picará el balón por primera vez
 */
export function predictBallLanding(ball) {
  syncBallState(ball);

  const z = Math.max(0, ball.z || 0);
  const vz = ball.vz || 0;

  if (z <= 0.1 && vz <= 0.1) {
    // Al ras del suelo: proyección de frenado corto
    return {
      x: ball.x + (ball.vx || 0) * 12,
      y: ball.y + (ball.vy || 0) * 12,
      ticksToLand: 0,
      isAerial: false,
    };
  }

  const g = BALL_PHYSICS.GRAVITY;
  const disc = vz * vz + 2 * g * z;
  const ticks = (vz + Math.sqrt(Math.max(0, disc))) / g;

  let simX = ball.x;
  let simY = ball.y;
  let svx = ball.vx || 0;
  let svy = ball.vy || 0;
  const spin = ball.spinZ || 0;
  const steps = Math.min(180, Math.max(1, Math.ceil(ticks)));

  for (let i = 0; i < steps; i++) {
    const mx = -BALL_PHYSICS.MAGNUS_COEFF * spin * svy;
    const my = BALL_PHYSICS.MAGNUS_COEFF * spin * svx;
    svx = (svx + mx) * BALL_PHYSICS.AIR_DRAG;
    svy = (svy + my) * BALL_PHYSICS.AIR_DRAG;
    simX += svx;
    simY += svy;
  }

  return {
    x: simX,
    y: simY,
    ticksToLand: steps,
    isAerial: (z > 8 || vz > 2.2),
  };
}

/**
 * Actualiza la física continua 2.5D del balón en cada tick
 * @param {Object} ball - Objeto balón
 * @param {boolean} isWetPitch - Si la cancha está mojada
 */
export function updateBallPhysics25D(ball, isWetPitch = false) {
  syncBallState(ball);

  // Si está en posesión de un jugador, la pelota sigue al jugador a ras de piso
  if (ball.ownerId !== null && ball.ownerId !== undefined && ball.withPlayer) {
    ball.z = 0;
    ball.vz = 0;
    ball.spinZ = 0;
    ball.position[0] = ball.x;
    ball.position[1] = ball.y;
    ball.position[2] = 0;
    ball.landingPoint = { x: ball.x, y: ball.y, ticksToLand: 0, isAerial: false };
    return;
  }

  const isAirborne = (ball.z || 0) > 0.05 || (ball.vz || 0) > 0.05;

  if (isAirborne) {
    // 1. Efecto Magnus (fuerza transversal al vector de velocidad)
    const spin = ball.spinZ || 0;
    const magX = -BALL_PHYSICS.MAGNUS_COEFF * spin * ball.vy;
    const magY = BALL_PHYSICS.MAGNUS_COEFF * spin * ball.vx;

    ball.vx = (ball.vx + magX) * BALL_PHYSICS.AIR_DRAG;
    ball.vy = (ball.vy + magY) * BALL_PHYSICS.AIR_DRAG;
    ball.vz = (ball.vz || 0) - BALL_PHYSICS.GRAVITY;

    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.z = Math.max(0, (ball.z || 0) + ball.vz);

    // 2. Detección de pique contra el césped
    if (ball.z <= 0) {
      ball.z = 0;
      if (Math.abs(ball.vz) > 0.85) {
        ball.vz = -ball.vz * BALL_PHYSICS.BOUNCE_RESTITUTION;
        ball.vx *= BALL_PHYSICS.BOUNCE_XY_DAMPING;
        ball.vy *= BALL_PHYSICS.BOUNCE_XY_DAMPING;
        ball.spinZ *= 0.6;
      } else {
        ball.vz = 0;
        ball.spinZ = 0;
      }
    }
    ball.landingPoint = predictBallLanding(ball);
  } else {
    // 3. Rodamiento sobre el césped
    ball.z = 0;
    ball.vz = 0;
    const friction = isWetPitch ? BALL_PHYSICS.WET_FRICTION : BALL_PHYSICS.GRASS_FRICTION;
    ball.vx *= friction;
    ball.vy *= friction;

    if (Math.hypot(ball.vx, ball.vy) < 0.08) {
      ball.vx = 0;
      ball.vy = 0;
    }

    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.landingPoint = { x: ball.x, y: ball.y, ticksToLand: 0, isAerial: false };
  }

  // Sincronizar arrays de compatibilidad con UI y el resto del motor
  ball.position[0] = ball.x;
  ball.position[1] = ball.y;
  ball.position[2] = ball.z;
  ball.velocity[0] = ball.vx;
  ball.velocity[1] = ball.vy;
}
