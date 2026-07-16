// ============================================
// state.js — Structure de données du jeu
// ============================================

import { BUILDING_TYPES } from './buildings.js';

export const SAVE_VERSION = 5;

function createInitialTiles() {
  const tiles = {
    '0,0': { unlocked: true, building: { type: 'noyau', level: 1 } },
  };
  for (const def of Object.values(BUILDING_TYPES)) {
    const key = `${def.slot.q},${def.slot.r}`;
    tiles[key] = { unlocked: true, building: null }; // emplacement existant, pas encore construit
  }
  return tiles;
}

export function createDefaultState() {
  return {
    version: SAVE_VERSION,

    // Identité de la Strate en cours (méta-progression Phase 3)
    strate: {
      id: 'strate-01',
      name: '01 — Éveil',
    },

    // Ressources
    resources: {
      cycles: 0,
      biomasse: 0,
      energie: 20, // petite réserve de départ pour amortir les premiers recrutements
      adn: 0, // Brins d'ADN (permanent, ne reset jamais lors d'un Transfert de Noyau)
    },

    // Pool d'Agents (main-d'œuvre) — Phase 2
    agents: {
      total: 5, // 5 Agents de départ, comme les habitants de Little Incrementisle
    },

    // Palier de plafond d'Agents par bâtiment (0 = 5 max, 1 = 10 max, etc.)
    agentCapTier: 0,

    // Grille hexagonale : clé "q,r" -> { unlocked, building: {...} | null }
    // Le Noyau + les emplacements fixes de bâtiments (cf. buildings.js) ; le reste de la
    // carte est purement décoratif (pas de stockage nécessaire pour les cases inactives)
    tiles: createInitialTiles(),

    // Mutations : améliorations achetées avec la Biomasse (Phase 1)
    // Ne pas confondre avec l'arbre de mutation PERMANENT du Transfert de Noyau (Phase 2)
    mutations: {
      clickPower: { purchased: false },
      metabolismeOptimise: { purchased: false },
      synapseBoost: { purchased: false },
    },

    // Puissance de clic de base (modifiée par la mutation clickPower)
    clickPower: 1,

    // Horodatage de la dernière sauvegarde, utilisé pour le calcul des gains offline (Phase 8)
    lastSaveTimestamp: Date.now(),
  };
}

// State global unique, exporté par référence pour être muté par les autres modules
export const gameState = createDefaultState();

export function resetState() {
  Object.assign(gameState, createDefaultState());
}
