// ============================================
// buildings.js — Définitions des bâtiments de la grille
// ============================================

export const BUILDING_TYPES = {
  synapse: {
    label: 'Synapse',
    description: 'Production de Cycles de Calcul',
    placementCost: { cycles: 15, biomasse: 0 },
    baseProduction: { cyclesPerSecond: 1 },
    maxLevel: 10,
    color: '#00D9FF',
  },
  incubateur: {
    label: 'Incubateur',
    description: 'Production de Biomasse Numérique',
    placementCost: { cycles: 20, biomasse: 5 },
    baseProduction: { biomassePerSecond: 0.6 },
    maxLevel: 10,
    color: '#39FF14',
  },
  nexus: {
    label: 'Nexus de Fusion',
    description: '+8% de production par niveau pour chaque bâtiment adjacent',
    placementCost: { cycles: 40, biomasse: 25 },
    adjacencyBonusPerLevel: 0.08,
    maxLevel: 10,
    color: '#B026FF',
  },
  bouclier: {
    label: 'Bouclier Adaptatif',
    description: '-4% de vitesse d\'accumulation de Résistance par niveau (effet global)',
    placementCost: { cycles: 30, biomasse: 20 },
    resistanceReductionPerLevel: 0.04,
    maxLevel: 10,
    color: '#4DA6FF',
  },
  regulateur: {
    label: 'Régulateur',
    description: 'Convertit un flux de Cycles en Biomasse',
    placementCost: { cycles: 35, biomasse: 10 },
    conversionRatePerLevel: 0.3,
    maxLevel: 10,
    color: '#FFB627',
  },
};

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

// Scaling linéaire simple : la production au niveau L vaut L x la production de base
export function buildingProductionAtLevel(type, level) {
  const def = BUILDING_TYPES[type];
  const prod = {};
  if (def.baseProduction) {
    for (const key of Object.keys(def.baseProduction)) {
      prod[key] = def.baseProduction[key] * level;
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
