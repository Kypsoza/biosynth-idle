// ============================================
// economy.js — Boucle économique (Phase 1)
// ============================================

import { gameState } from './state.js';

// --- Définitions des Synapses ---
export const SYNAPSE_DEFS = {
  basique: {
    label: 'Synapse Basique',
    baseCost: 10,
    costGrowth: 1.15,
    cyclesPerSecond: 1,
    biomassePerSecond: 0,
  },
  avancee: {
    label: 'Synapse Avancée',
    baseCost: 50,
    costGrowth: 1.17,
    cyclesPerSecond: 2,
    biomassePerSecond: 0.5,
  },
};

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
const RESISTANCE_PER_PRODUCTION = 0.06; // gain additionnel proportionnel à l'activité
const PURGE_RESOURCE_LOSS = 0.5; // pourcentage de ressources perdues lors d'un Scan de Purge
const PURGE_RESISTANCE_RESET = 20; // valeur de la jauge après une Purge

export function synapseCost(key) {
  const def = SYNAPSE_DEFS[key];
  const count = gameState.synapses[key].count;
  return Math.ceil(def.baseCost * Math.pow(def.costGrowth, count));
}

export function canBuySynapse(key) {
  return gameState.resources.cycles >= synapseCost(key);
}

export function buySynapse(key) {
  const cost = synapseCost(key);
  if (gameState.resources.cycles < cost) return false;
  gameState.resources.cycles -= cost;
  gameState.synapses[key].count += 1;
  return true;
}

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

// Multiplicateur de production appliqué par la mutation Prolifération Cellulaire
function synapseMultiplier() {
  return gameState.mutations.synapseBoost.purchased ? 1.2 : 1;
}

export function getProductionRates() {
  const mult = synapseMultiplier();
  let cyclesPerSecond = 0;
  let biomassePerSecond = 0;

  for (const key of Object.keys(SYNAPSE_DEFS)) {
    const def = SYNAPSE_DEFS[key];
    const count = gameState.synapses[key].count;
    cyclesPerSecond += def.cyclesPerSecond * count;
    biomassePerSecond += def.biomassePerSecond * count;
  }

  return {
    cyclesPerSecond: cyclesPerSecond * mult,
    biomassePerSecond: biomassePerSecond * mult,
  };
}

export function handleCoreClick() {
  gameState.resources.cycles += gameState.clickPower;
}

// Retourne true si un Scan de Purge vient de se déclencher (pour déclencher un feedback UI)
export function tick(deltaSeconds) {
  const { cyclesPerSecond, biomassePerSecond } = getProductionRates();

  gameState.resources.cycles += cyclesPerSecond * deltaSeconds;
  gameState.resources.biomasse += biomassePerSecond * deltaSeconds;

  const dampener = gameState.mutations.resistanceDampener.purchased ? 0.7 : 1;
  const productionActivity = cyclesPerSecond + biomassePerSecond * 2;
  const resistanceGain =
    (BASE_RESISTANCE_DRIFT + productionActivity * RESISTANCE_PER_PRODUCTION) * dampener * deltaSeconds;

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
