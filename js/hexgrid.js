// ============================================
// hexgrid.js — Mathématiques de la grille hexagonale
// ============================================
// Coordonnées axiales (q, r), hexagones "pointy-top"
// Référence : https://www.redblobgames.com/grids/hexagons/

export const MAX_RING = 4; // Rayon maximal de la carte (soft cap, extensible en Phase future)
export const HEX_SIZE = 34; // Rayon d'un hexagone en pixels (centre → coin)

export function tileKey(q, r) {
  return `${q},${r}`;
}

export function parseKey(key) {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}

export function axialToPixel(q, r) {
  const x = HEX_SIZE * Math.sqrt(3) * (q + r / 2);
  const y = HEX_SIZE * 1.5 * r;
  return { x, y };
}

export function hexCorners(cx, cy) {
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angleDeg = 60 * i - 30;
    const angleRad = (Math.PI / 180) * angleDeg;
    points.push(`${(cx + HEX_SIZE * Math.cos(angleRad)).toFixed(1)},${(cy + HEX_SIZE * Math.sin(angleRad)).toFixed(1)}`);
  }
  return points.join(' ');
}

export function hexDistance(q1, r1, q2, r2) {
  return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2;
}

const NEIGHBOR_DIRS = [
  [1, 0], [1, -1], [0, -1],
  [-1, 0], [-1, 1], [0, 1],
];

export function neighborsOf(q, r) {
  return NEIGHBOR_DIRS.map(([dq, dr]) => [q + dq, r + dr]);
}

export function allTilesInRadius(radius) {
  const tiles = [];
  for (let q = -radius; q <= radius; q++) {
    const rMin = Math.max(-radius, -q - radius);
    const rMax = Math.min(radius, -q + radius);
    for (let r = rMin; r <= rMax; r++) {
      tiles.push([q, r]);
    }
  }
  return tiles;
}

// Hash déterministe pour varier le profil de coût des cases (mélange Cycles/Biomasse selon la case)
export function tileCostProfile(q, r) {
  const h = Math.abs((q * 31 + r * 17) % 3);
  if (h === 0) return { cyclesRatio: 1.5, biomasseRatio: 0.5 };
  if (h === 1) return { cyclesRatio: 0.5, biomasseRatio: 1.5 };
  return { cyclesRatio: 1, biomasseRatio: 1 };
}
