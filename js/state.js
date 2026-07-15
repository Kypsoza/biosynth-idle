// ============================================
// state.js — Structure de données du jeu
// ============================================
// Phase 0 : squelette de state, sans logique de production
// (Synapses/Mutations/Résistance arrivent en Phase 1+)

export const SAVE_VERSION = 1;

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

    // Jauge de Résistance (0-100), logique de Scan de Purge en Phase 1
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
