// ============================================
// economy.js — Boucle économique (Phase 2 — Agents & Énergie)
// ============================================

import { gameState } from './state.js';
import {
  BUILDING_TYPES,
  upgradeCost,
  productionPerAgentAtLevel,
  agentCapForTier,
  agentCapUpgradeCost,
  recruitCost,
} from './buildings.js';
import { tileKey, hexDistance, neighborsOf, MAX_RING, tileCostProfile } from './hexgrid.js';

// --- Définitions des Mutations (achat unique, payées en Biomasse) ---
export const MUTATION_DEFS = {
  clickPower: {
    label: 'Amplification Synaptique',
    cost: 20,
  },
  metabolismeOptimise: {
    label: 'Métabolisme Optimisé',
    cost: 40,
  },
  synapseBoost: {
    label: 'Prolifération Cellulaire',
    cost: 80,
  },
};

const ENERGY_PER_AGENT = 0.4; // consommation d'Énergie par Agent recruté (actif ou non), par seconde
const ENERGY_SHORTAGE_THROTTLE = 0.7; // ralentissement doux (pas de pénalité brutale) en cas de pénurie

// ============================================
// Grille : déblocage de cases
// ============================================

export function unlockCost(q, r) {
  const ring = hexDistance(0, 0, q, r);
  const { cyclesRatio, biomasseRatio } = tileCostProfile(q, r);
  const base = 12 * Math.pow(Math.max(ring, 1), 1.6);
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
  const building = { type, level: 1 };
  if (BUILDING_TYPES[type].requiresAgents) building.assignedAgents = 0;
  gameState.tiles[tileKey(q, r)].building = building;
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
// Agents : pool, recrutement, assignation
// ============================================

export function currentAgentCap() {
  return agentCapForTier(gameState.agentCapTier);
}

export function totalAssignedAgents() {
  let sum = 0;
  for (const tile of Object.values(gameState.tiles)) {
    if (tile.building?.assignedAgents) sum += tile.building.assignedAgents;
  }
  return sum;
}

export function idleAgents() {
  return gameState.agents.total - totalAssignedAgents();
}

export function getRecruitCost() {
  return recruitCost(gameState.agents.total);
}

export function canRecruitAgent() {
  return gameState.resources.energie >= getRecruitCost();
}

export function recruitAgent() {
  if (!canRecruitAgent()) return false;
  gameState.resources.energie -= getRecruitCost();
  gameState.agents.total += 1;
  return true;
}

export function canAssignAgent(q, r) {
  const tile = gameState.tiles[tileKey(q, r)];
  if (!tile?.building || !BUILDING_TYPES[tile.building.type]?.requiresAgents) return false;
  if (idleAgents() <= 0) return false;
  return tile.building.assignedAgents < currentAgentCap();
}

export function canUnassignAgent(q, r) {
  const tile = gameState.tiles[tileKey(q, r)];
  return !!tile?.building?.assignedAgents && tile.building.assignedAgents > 0;
}

export function assignAgent(q, r) {
  if (!canAssignAgent(q, r)) return false;
  gameState.tiles[tileKey(q, r)].building.assignedAgents += 1;
  return true;
}

export function unassignAgent(q, r) {
  if (!canUnassignAgent(q, r)) return false;
  gameState.tiles[tileKey(q, r)].building.assignedAgents -= 1;
  return true;
}

// ============================================
// Plafond d'Agents par bâtiment (amélioration globale)
// ============================================

export function getAgentCapUpgradeCost() {
  return agentCapUpgradeCost(gameState.agentCapTier);
}

export function canUpgradeAgentCap() {
  const cost = getAgentCapUpgradeCost();
  if (!cost) return false;
  return gameState.resources.cycles >= cost.cycles && gameState.resources.biomasse >= cost.biomasse;
}

export function upgradeAgentCap() {
  if (!canUpgradeAgentCap()) return false;
  const cost = getAgentCapUpgradeCost();
  gameState.resources.cycles -= cost.cycles;
  gameState.resources.biomasse -= cost.biomasse;
  gameState.agentCapTier += 1;
  return true;
}

// ============================================
// Mutations (achat unique, payées en Biomasse)
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
  let energiePerSecond = 0;

  // 1. Production de base de chaque bâtiment (proportionnelle aux Agents assignés)
  for (const [, tile] of builtTiles()) {
    const { type, level, assignedAgents } = tile.building;
    const def = BUILDING_TYPES[type];
    if (!def.productionPerAgent || !assignedAgents) continue;
    const prod = productionPerAgentAtLevel(type, level);
    cyclesPerSecond += (prod.cyclesPerSecond || 0) * assignedAgents;
    biomassePerSecond += (prod.biomassePerSecond || 0) * assignedAgents;
    energiePerSecond += (prod.energiePerSecond || 0) * assignedAgents;
  }

  // 2. Bonus d'adjacence des Nexus de Fusion (boostent Synapse/Incubateur/Énergie voisins)
  for (const [key, tile] of builtTiles()) {
    if (tile.building.type !== 'nexus') continue;
    const [q, r] = key.split(',').map(Number);
    const bonusPct = tile.building.level * BUILDING_TYPES.nexus.adjacencyBonusPerLevel;
    for (const [nq, nr] of neighborsOf(q, r)) {
      const neighborTile = gameState.tiles[tileKey(nq, nr)];
      if (!neighborTile?.building?.assignedAgents) continue;
      const nType = neighborTile.building.type;
      if (!['synapse', 'incubateur', 'energie'].includes(nType)) continue;
      const nProd = productionPerAgentAtLevel(nType, neighborTile.building.level);
      const nAgents = neighborTile.building.assignedAgents;
      cyclesPerSecond += (nProd.cyclesPerSecond || 0) * nAgents * bonusPct;
      biomassePerSecond += (nProd.biomassePerSecond || 0) * nAgents * bonusPct;
      energiePerSecond += (nProd.energiePerSecond || 0) * nAgents * bonusPct;
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
  const mult = gameState.mutations.synapseBoost?.purchased ? 1.2 : 1;

  return {
    cyclesPerSecond: cyclesPerSecond * mult,
    biomassePerSecond: biomassePerSecond * mult,
    energiePerSecond: energiePerSecond * mult,
  };
}

export function getEnergyConsumption() {
  const reduction = gameState.mutations.metabolismeOptimise?.purchased ? 0.8 : 1;
  return gameState.agents.total * ENERGY_PER_AGENT * reduction;
}

// ============================================
// Tick principal
// ============================================

export function tick(deltaSeconds) {
  const { cyclesPerSecond, biomassePerSecond, energiePerSecond } = getProductionRates();
  const consumption = getEnergyConsumption();

  // Ralentissement doux (pas de malus brutal) si l'Énergie est à sec
  const throttle = gameState.resources.energie <= 0 ? ENERGY_SHORTAGE_THROTTLE : 1;

  gameState.resources.cycles += cyclesPerSecond * throttle * deltaSeconds;
  gameState.resources.biomasse += biomassePerSecond * throttle * deltaSeconds;

  const netEnergie = energiePerSecond * throttle - consumption;
  gameState.resources.energie = Math.max(0, gameState.resources.energie + netEnergie * deltaSeconds);
}
