/**
 * rng.js — Utilidades Matemáticas, Clamps, Interpolación Angular y Distribuciones (Fase 5 — Fulbito 2.2)
 */

/**
 * Acota un valor numérico en el intervalo [min, max].
 */
export function clamp(val, min = 0.0, max = 1.0) {
  if (typeof val !== 'number' || Number.isNaN(val)) return min;
  return Math.max(min, Math.min(max, val));
}

/**
 * Interpolación lineal entre a y b con factor t en [0, 1].
 */
export function lerp(a, b, t) {
  return a + (b - a) * clamp(t, 0.0, 1.0);
}

/**
 * Curva suave Hermite (Smoothstep) en [0, 1].
 */
export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0 || 1), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

/**
 * Normaliza un ángulo en radianes al rango [-PI, PI].
 */
export function normalizeAngle(rad) {
  return Math.atan2(Math.sin(rad), Math.cos(rad));
}

/**
 * Diferencia angular con signo más corta desde currentAngle hacia targetAngle en [-PI, PI].
 */
export function signedAngleDiff(targetAngle, currentAngle) {
  return Math.atan2(
    Math.sin(targetAngle - currentAngle),
    Math.cos(targetAngle - currentAngle)
  );
}

/**
 * Diferencia angular absoluta |Delta theta| en [0, PI].
 */
export function angleDiff(targetAngle, currentAngle) {
  return Math.abs(signedAngleDiff(targetAngle, currentAngle));
}

/**
 * Interpola suavemente un ángulo desde currentAngle hacia targetAngle con velocidad angular máxima maxOmegaRad.
 */
export function rotateAngleTowards(currentAngle, targetAngle, maxOmegaRad) {
  const diff = signedAngleDiff(targetAngle, currentAngle);
  if (Math.abs(diff) <= maxOmegaRad) {
    return normalizeAngle(targetAngle);
  }
  return normalizeAngle(currentAngle + Math.sign(diff) * maxOmegaRad);
}

/**
 * Generador Normal Acotado (Box-Muller acotado a [min, max]).
 */
export function randomNormalClamped(mean = 0.0, stdDev = 1.0, min = -3.0, max = 3.0) {
  const u1 = Math.max(1e-7, Math.random());
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return clamp(mean + z0 * stdDev, min, max);
}
