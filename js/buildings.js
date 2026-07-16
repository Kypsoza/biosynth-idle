// ============================================
// buildings.js — Définitions des bâtiments de la grille
// ============================================
// Chaque bâtiment a un emplacement FIXE prédéfini sur la carte (coordonnées axiales)
// et peut nécessiter un autre bâtiment construit au préalable (prerequisite).

export const BUILDING_TYPES = {
  energie: {
    label: 'Générateur d\'Énergie',
    description: 'Produit de l\'Énergie, consommée en continu par vos Agents',
    placementCost: { cycles: 12, biomasse: 0 },
    constructionTime: 6,
    prerequisite: null,
    slot: { q: 2, r: 0 },
    requiresAgents: true,
    productionPerAgent: { energiePerSecond: 0.8 },
    maxLevel: 10,
    color: '#FFB627',
  },
  synapse: {
    label: 'Synapse',
    description: 'Production de Cycles de Calcul',
    placementCost: { cycles: 15, biomasse: 0 },
    constructionTime: 5,
    prerequisite: null,
    slot: { q: 2, r: -2 },
    requiresAgents: true,
    productionPerAgent: { cyclesPerSecond: 0.6 },
    maxLevel: 10,
    color: '#00D9FF',
  },
  incubateur: {
    label: 'Incubateur',
    description: 'Production de Biomasse Numérique',
    placementCost: { cycles: 20, biomasse: 5 },
    constructionTime: 8,
    prerequisite: 'synapse',
    slot: { q: 0, r: -2 },
    requiresAgents: true,
    productionPerAgent: { biomassePerSecond: 0.35 },
    maxLevel: 10,
    color: '#39FF14',
  },
  nexus: {
    label: 'Nexus de Fusion',
    description: '+8% de production par niveau pour chaque bâtiment adjacent',
    placementCost: { cycles: 40, biomasse: 25 },
    constructionTime: 15,
    prerequisite: 'incubateur',
    slot: { q: -2, r: 0 },
    requiresAgents: false,
    adjacencyBonusPerLevel: 0.08,
    maxLevel: 10,
    color: '#B026FF',
  },
  regulateur: {
    label: 'Régulateur',
    description: 'Convertit un flux de Cycles en Biomasse',
    placementCost: { cycles: 35, biomasse: 10 },
    constructionTime: 12,
    prerequisite: 'incubateur',
    slot: { q: -2, r: 2 },
    requiresAgents: false,
    conversionRatePerLevel: 0.3,
    maxLevel: 10,
    color: '#4DA6FF',
  },
};

// Emplacement réservé pour un futur bâtiment (Défense/Exploration, Phases 3-4)
export const RESERVED_SLOT = { q: 0, r: 2 };

// Index inverse "q,r" -> type de bâtiment, construit une seule fois
export const SLOT_INDEX = Object.fromEntries(
  Object.entries(BUILDING_TYPES).map(([type, def]) => [`${def.slot.q},${def.slot.r}`, type])
);

// Le Noyau n'est pas un bâtiment "constructible" : il est fixe, unique, toujours au centre
export const NOYAU_COLOR = '#39FF14';

const UPGRADE_COST_GROWTH = 1.35;

export function upgradeCost(type, currentLevel) {
  const def = BUILDING_TYPES[type];
  const factor = Math.pow(UPGRADE_COST_GROWTH, currentLevel - 1);
  return {
    cycles: Math.ceil(def.placementCost.cycles * 0.7 * factor),
    biomasse: Math.ceil(def.placementCost.biomasse * 0.7 * factor),
  };
}

// Production PAR AGENT ASSIGNÉ, à un niveau donné (le niveau augmente le rendement de chaque Agent)
export function productionPerAgentAtLevel(type, level) {
  const def = BUILDING_TYPES[type];
  const prod = {};
  if (def.productionPerAgent) {
    for (const key of Object.keys(def.productionPerAgent)) {
      prod[key] = def.productionPerAgent[key] * level;
    }
  }
  return prod;
}

// Palier visuel : l'apparence change tous les 3 niveaux (4 paliers pour un maxLevel de 10)
export function visualTier(level) {
  if (level >= 10) return 4;
  if (level >= 7) return 3;
  if (level >= 4) return 2;
  return 1;
}

// ============================================
// Plafond d'Agents par bâtiment (amélioration globale, paliers progressifs)
// ============================================

export const AGENT_CAP_TIERS = [5, 10, 15, 20, 25, 30];

export const AGENT_CAP_UPGRADE_COSTS = [
  { cycles: 100, biomasse: 50 },
  { cycles: 300, biomasse: 150 },
  { cycles: 800, biomasse: 400 },
  { cycles: 2000, biomasse: 1000 },
  { cycles: 5000, biomasse: 2500 },
];

export function agentCapForTier(tier) {
  return AGENT_CAP_TIERS[Math.min(tier, AGENT_CAP_TIERS.length - 1)];
}

export function agentCapUpgradeCost(currentTier) {
  return AGENT_CAP_UPGRADE_COSTS[currentTier] || null;
}

// ============================================
// Recrutement d'Agents
// ============================================

const RECRUIT_BASE_COST = 15;
const RECRUIT_COST_GROWTH = 1.22;

export function recruitCost(currentAgentCount) {
  return Math.ceil(RECRUIT_BASE_COST * Math.pow(RECRUIT_COST_GROWTH, currentAgentCount - 5));
}
