// ============================================
// state.js — Structure de données du jeu
// ============================================
// Phase 0 : squelette de state, sans logique de production
// (Synapses/Mutations/Résistance arrivent en Phase 1+)

export const SAVE_VERSION = 2;

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
      adn: 0, // Brins d'ADN (permanent, ne reset jamais lors d'un Transfert de Noyau)
    },

    // Synapses : production passive (Phase 1)
    synapses: {
      basique: { count: 0 },
      avancee: { count: 0 },
    },

    // Mutations : améliorations achetées avec la Biomasse (Phase 1)
    // Ne pas confondre avec l'arbre de mutation PERMANENT du Transfert de Noyau (Phase 2)
    mutations: {
      clickPower: { purchased: false },
      resistanceDampener: { purchased: false },
      synapseBoost: { purchased: false },
    },

    // Puissance de clic de base (modifiée par la mutation clickPower)
    clickPower: 1,

    // Jauge de Résistance (0-100)
    resistance: 0,

    // Horodatage de la dernière sauvegarde, utilisé pour le calcul des gains offline (Phase 8)
    lastSaveTimestamp: Date.now(),
  };
}

// State global unique, exporté par référence pour être muté par les autres modules
export const gameState = createDefaultState();

export function resetState() {
  Object.assign(gameState, createDefaultState());
}
