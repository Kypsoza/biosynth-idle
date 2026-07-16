// ============================================
// economy.js — Boucle économique (Phase 2bis — emplacements fixes & construction chronométrée)
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
import { tileKey, neighborsOf } from './hexgrid.js';

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

const ENERGY_PER_AGENT = 0.4;
const ENERGY_SHORTAGE_THROTTLE = 0.7;

// ============================================
// Prérequis et construction des bâtiments (emplacements fixes)
// ============================================

function slotKey(type) {
  const { q, r } = BUILDING_TYPES[type].slot;
  return tileKey(q, r);
}

export function isBuilt(type) {
  const tile = gameState.tiles[slotKey(type)];
  return !!tile?.building && !tile.building.constructing;
}

export function isConstructing(type) {
  const tile = gameState.tiles[slotKey(type)];
  return !!tile?.building?.constructing;
}

export function prerequisiteMet(type) {
  const prereq = BUILDING_TYPES[type].prerequisite;
  return !prereq || isBuilt(prereq);
}

export function canBuyBuilding(type) {
  const tile = gameState.tiles[slotKey(type)];
  if (tile?.building) return false; // déjà construit ou en construction
  if (!prerequisiteMet(type)) return false;
  const cost = BUILDING_TYPES[type].placementCost;
  return gameState.resources.cycles >= cost.cycles && gameState.resources.biomasse >= cost.biomasse;
}

export function buyBuilding(type) {
  if (!canBuyBuilding(type)) return false;
  const def = BUILDING_TYPES[type];
  gameState.resources.cycles -= def.placementCost.cycles;
  gameState.resources.biomasse -= def.placementCost.biomasse;
  gameState.tiles[slotKey(type)].building = {
    type,
    level: 0,
    constructing: true,
    remainingTime: def.constructionTime,
    totalTime: def.constructionTime,
    ...(def.requiresAgents ? { assignedAgents: 0 } : {}),
  };
  return true;
}

// Fait avancer toutes les constructions en cours ; retourne la liste des types venant de se terminer
function tickConstructions(deltaSeconds) {
  const justCompleted = [];
  for (const tile of Object.values(gameState.tiles)) {
    if (!tile.building?.constructing) continue;
    tile.building.remainingTime -= deltaSeconds;
    if (tile.building.remainingTime <= 0) {
      tile.building.constructing = false;
      tile.building.remainingTime = 0;
      tile.building.level = 1;
      justCompleted.push(tile.building.type);
    }
  }
  return justCompleted;
}

// ============================================
// Amélioration de niveau
// ============================================

export function canUpgradeBuilding(q, r) {
  const tile = gameState.tiles[tileKey(q, r)];
  if (!tile?.building || tile.building.type === 'noyau' || tile.building.constructing) return false;
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
  if (!tile?.building || tile.building.constructing) return false;
  if (!BUILDING_TYPES[tile.building.type]?.requiresAgents) return false;
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
  return Object.entries(gameState.tiles).filter(
    ([, t]) => t.building && t.building.type !== 'noyau' && !t.building.constructing
  );
}

export function getProductionRates() {
  let cyclesPerSecond = 0;
  let biomassePerSecond = 0;
  let energiePerSecond = 0;

  for (const [, tile] of builtTiles()) {
    const { type, level, assignedAgents } = tile.building;
    const def = BUILDING_TYPES[type];
    if (!def.productionPerAgent || !assignedAgents) continue;
    const prod = productionPerAgentAtLevel(type, level);
    cyclesPerSecond += (prod.cyclesPerSecond || 0) * assignedAgents;
    biomassePerSecond += (prod.biomassePerSecond || 0) * assignedAgents;
    energiePerSecond += (prod.energiePerSecond || 0) * assignedAgents;
  }

  for (const [key, tile] of builtTiles()) {
    if (tile.building.type !== 'nexus') continue;
    const [q, r] = key.split(',').map(Number);
    const bonusPct = tile.building.level * BUILDING_TYPES.nexus.adjacencyBonusPerLevel;
    for (const [nq, nr] of neighborsOf(q, r)) {
      const neighborTile = gameState.tiles[tileKey(nq, nr)];
      if (!neighborTile?.building?.assignedAgents || neighborTile.building.constructing) continue;
      const nType = neighborTile.building.type;
      if (!['synapse', 'incubateur', 'energie'].includes(nType)) continue;
      const nProd = productionPerAgentAtLevel(nType, neighborTile.building.level);
      const nAgents = neighborTile.building.assignedAgents;
      cyclesPerSecond += (nProd.cyclesPerSecond || 0) * nAgents * bonusPct;
      biomassePerSecond += (nProd.biomassePerSecond || 0) * nAgents * bonusPct;
      energiePerSecond += (nProd.energiePerSecond || 0) * nAgents * bonusPct;
    }
  }

  for (const [, tile] of builtTiles()) {
    if (tile.building.type !== 'regulateur') continue;
    const rate = tile.building.level * BUILDING_TYPES.regulateur.conversionRatePerLevel;
    const converted = Math.min(rate, cyclesPerSecond * 0.5);
    cyclesPerSecond -= converted;
    biomassePerSecond += converted * 0.6;
  }

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

// Retourne la liste des types de bâtiments dont la construction vient de se terminer (pour le rendu)
export function tick(deltaSeconds) {
  const justCompleted = tickConstructions(deltaSeconds);

  const { cyclesPerSecond, biomassePerSecond, energiePerSecond } = getProductionRates();
  const consumption = getEnergyConsumption();
  const throttle = gameState.resources.energie <= 0 ? ENERGY_SHORTAGE_THROTTLE : 1;

  gameState.resources.cycles += cyclesPerSecond * throttle * deltaSeconds;
  gameState.resources.biomasse += biomassePerSecond * throttle * deltaSeconds;

  const netEnergie = energiePerSecond * throttle - consumption;
  gameState.resources.energie = Math.max(0, gameState.resources.energie + netEnergie * deltaSeconds);

  return justCompleted;
}
