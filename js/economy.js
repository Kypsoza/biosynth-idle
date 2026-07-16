// ============================================
// economy.js — Boucle économique (Phase 1 — grille hexagonale)
// ============================================

import { gameState } from './state.js';
import { BUILDING_TYPES, upgradeCost, buildingProductionAtLevel } from './buildings.js';
import { tileKey, hexDistance, neighborsOf, MAX_RING, tileCostProfile } from './hexgrid.js';

// --- Définitions des Mutations (achat unique, payées en Biomasse) ---
export const MUTATION_DEFS = {
  clickPower: {
    label: 'Amplification Synaptique',
    cost: 20,
  },
  resistanceDampener: {
    label: 'Camouflage Adaptatif',
    cost: 40,
  },
  synapseBoost: {
    label: 'Prolifération Cellulaire',
    cost: 80,
  },
};

const BASE_RESISTANCE_DRIFT = 0.15; // gain passif par seconde, même à l'arrêt
const RESISTANCE_PER_PRODUCTION = 0.05; // gain additionnel proportionnel à l'activité
const PURGE_RESOURCE_LOSS = 0.5; // pourcentage de ressources perdues lors d'un Scan de Purge
const PURGE_RESISTANCE_RESET = 20; // valeur de la jauge après une Purge

// ============================================
// Grille : déblocage de cases
// ============================================

export function unlockCost(q, r) {
  const ring = hexDistance(0, 0, q, r);
  const { cyclesRatio, biomasseRatio } = tileCostProfile(q, r);
  const base = 12 * Math.pow(Math.max(ring, 1), 1.6);
  // Les cases du premier anneau ne coûtent jamais de Biomasse : au tout début de partie,
  // aucun Incubateur n'existe encore pour en produire, donc un déblocage 100% Cycles doit
  // toujours être possible pour éviter un blocage total de la progression.
  const effectiveBiomasseRatio = ring <= 1 ? 0 : biomasseRatio;
  return {
    cycles: Math.ceil(base * cyclesRatio),
    biomasse: Math.ceil(base * effectiveBiomasseRatio * 0.6),
  };
}

export function isTileUnlockable(q, r) {
  const key = tileKey(q, r);
  if (gameState.tiles[key]?.unlocked) return false;
  if (hexDistance(0, 0, q, r) > MAX_RING) return false;
  return neighborsOf(q, r).some(([nq, nr]) => gameState.tiles[tileKey(nq, nr)]?.unlocked);
}

export function canUnlockTile(q, r) {
  if (!isTileUnlockable(q, r)) return false;
  const cost = unlockCost(q, r);
  return gameState.resources.cycles >= cost.cycles && gameState.resources.biomasse >= cost.biomasse;
}

export function unlockTile(q, r) {
  if (!canUnlockTile(q, r)) return false;
  const cost = unlockCost(q, r);
  gameState.resources.cycles -= cost.cycles;
  gameState.resources.biomasse -= cost.biomasse;
  gameState.tiles[tileKey(q, r)] = { unlocked: true, building: null };
  return true;
}

// ============================================
// Grille : construction et amélioration de bâtiments
// ============================================

export function canPlaceBuilding(q, r, type) {
  const tile = gameState.tiles[tileKey(q, r)];
  if (!tile || !tile.unlocked || tile.building) return false;
  const cost = BUILDING_TYPES[type].placementCost;
  return gameState.resources.cycles >= cost.cycles && gameState.resources.biomasse >= cost.biomasse;
}

export function placeBuilding(q, r, type) {
  if (!canPlaceBuilding(q, r, type)) return false;
  const cost = BUILDING_TYPES[type].placementCost;
  gameState.resources.cycles -= cost.cycles;
  gameState.resources.biomasse -= cost.biomasse;
  gameState.tiles[tileKey(q, r)].building = { type, level: 1 };
  return true;
}

export function canUpgradeBuilding(q, r) {
  const tile = gameState.tiles[tileKey(q, r)];
  if (!tile || !tile.building || tile.building.type === 'noyau') return false;
  const def = BUILDING_TYPES[tile.building.type];
  if (tile.building.level >= def.maxLevel) return false;
  const cost = upgradeCost(tile.building.type, tile.building.level);
  return gameState.resources.cycles >= cost.cycles && gameState.resources.biomasse >= cost.biomasse;
}

export function upgradeBuilding(q, r) {
  if (!canUpgradeBuilding(q, r)) return false;
  const tile = gameState.tiles[tileKey(q, r)];
  const cost = upgradeCost(tile.building.type, tile.building.level);
  gameState.resources.cycles -= cost.cycles;
  gameState.resources.biomasse -= cost.biomasse;
  tile.building.level += 1;
  return true;
}

// ============================================
// Mutations (inchangé depuis la version liste d'achats)
// ============================================

export function canBuyMutation(key) {
  const def = MUTATION_DEFS[key];
  return !gameState.mutations[key].purchased && gameState.resources.biomasse >= def.cost;
}

export function buyMutation(key) {
  const def = MUTATION_DEFS[key];
  if (gameState.mutations[key].purchased) return false;
  if (gameState.resources.biomasse < def.cost) return false;
  gameState.resources.biomasse -= def.cost;
  gameState.mutations[key].purchased = true;
  if (key === 'clickPower') {
    gameState.clickPower += 1;
  }
  return true;
}

export function handleCoreClick() {
  gameState.resources.cycles += gameState.clickPower;
}

// ============================================
// Agrégation de la production sur toute la grille
// ============================================

function builtTiles() {
  return Object.entries(gameState.tiles).filter(([, t]) => t.building && t.building.type !== 'noyau');
}

export function getProductionRates() {
  let cyclesPerSecond = 0;
  let biomassePerSecond = 0;

  // 1. Production de base de chaque bâtiment
  for (const [, tile] of builtTiles()) {
    const { type, level } = tile.building;
    const def = BUILDING_TYPES[type];
    if (!def.baseProduction) continue;
    const prod = buildingProductionAtLevel(type, level);
    cyclesPerSecond += prod.cyclesPerSecond || 0;
    biomassePerSecond += prod.biomassePerSecond || 0;
  }

  // 2. Bonus d'adjacence des Nexus de Fusion (boostent Synapse/Incubateur voisins)
  for (const [key, tile] of builtTiles()) {
    if (tile.building.type !== 'nexus') continue;
    const { q, r } = { q: Number(key.split(',')[0]), r: Number(key.split(',')[1]) };
    const bonusPct = tile.building.level * BUILDING_TYPES.nexus.adjacencyBonusPerLevel;
    for (const [nq, nr] of neighborsOf(q, r)) {
      const neighborTile = gameState.tiles[tileKey(nq, nr)];
      if (!neighborTile || !neighborTile.building) continue;
      const nType = neighborTile.building.type;
      if (nType !== 'synapse' && nType !== 'incubateur') continue;
      const nProd = buildingProductionAtLevel(nType, neighborTile.building.level);
      cyclesPerSecond += (nProd.cyclesPerSecond || 0) * bonusPct;
      biomassePerSecond += (nProd.biomassePerSecond || 0) * bonusPct;
    }
  }

  // 3. Conversion du Régulateur (une partie des Cycles devient de la Biomasse)
  for (const [, tile] of builtTiles()) {
    if (tile.building.type !== 'regulateur') continue;
    const rate = tile.building.level * BUILDING_TYPES.regulateur.conversionRatePerLevel;
    const converted = Math.min(rate, cyclesPerSecond * 0.5);
    cyclesPerSecond -= converted;
    biomassePerSecond += converted * 0.6;
  }

  // 4. Multiplicateur global de la mutation Prolifération Cellulaire
  const mult = gameState.mutations.synapseBoost.purchased ? 1.2 : 1;

  return {
    cyclesPerSecond: cyclesPerSecond * mult,
    biomassePerSecond: biomassePerSecond * mult,
  };
}

// Réduction de la Résistance apportée par les Boucliers Adaptatifs placés sur la grille
function shieldReductionFactor() {
  let reduction = 0;
  for (const [, tile] of builtTiles()) {
    if (tile.building.type === 'bouclier') {
      reduction += tile.building.level * BUILDING_TYPES.bouclier.resistanceReductionPerLevel;
    }
  }
  return Math.max(0.2, 1 - Math.min(0.8, reduction));
}

// ============================================
// Tick principal
// ============================================

// Retourne true si un Scan de Purge vient de se déclencher (pour déclencher un feedback UI)
export function tick(deltaSeconds) {
  const { cyclesPerSecond, biomassePerSecond } = getProductionRates();

  gameState.resources.cycles += cyclesPerSecond * deltaSeconds;
  gameState.resources.biomasse += biomassePerSecond * deltaSeconds;

  const dampener = gameState.mutations.resistanceDampener.purchased ? 0.7 : 1;
  const shieldFactor = shieldReductionFactor();
  const productionActivity = cyclesPerSecond + biomassePerSecond * 2;
  const resistanceGain =
    (BASE_RESISTANCE_DRIFT + productionActivity * RESISTANCE_PER_PRODUCTION) * dampener * shieldFactor * deltaSeconds;

  gameState.resistance = Math.min(100, gameState.resistance + resistanceGain);

  if (gameState.resistance >= 100) {
    triggerPurge();
    return true;
  }
  return false;
}

function triggerPurge() {
  gameState.resources.cycles *= 1 - PURGE_RESOURCE_LOSS;
  gameState.resources.biomasse *= 1 - PURGE_RESOURCE_LOSS;
  gameState.resistance = PURGE_RESISTANCE_RESET;
}
