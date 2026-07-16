// ============================================
// main.js — Point d'entrée du jeu
// ============================================

import { gameState } from './state.js';
import { saveGame, loadGame, exportSave, importSave, hardReset, startAutosave } from './save.js';
import { renderGrid, renderTileInfoPanel, updateTileInfoAffordability, renderStats, flashSaveStatus, showPurgeAlert } from './ui.js';
import {
  MUTATION_DEFS,
  buyMutation,
  handleCoreClick,
  tick,
  unlockTile,
  placeBuilding,
  upgradeBuilding,
} from './economy.js';
import { tileKey } from './hexgrid.js';

const TICK_INTERVAL_MS = 100; // 10 ticks/seconde pour une production fluide

let selectedTile = null; // { q, r } | null

function init() {
  const hadSave = loadGame();
  if (!hadSave) {
    console.info('Aucune sauvegarde trouvée, nouvelle partie.');
  }

  renderGrid(null);
  renderTileInfoPanel(null);
  renderStats();
  wireEvents();
  startGameLoop();
  startAutosave((ok) => {
    if (ok) flashSaveStatus('Sauvegarde effectuée');
  });
  registerServiceWorker();
}

function selectedKey() {
  return selectedTile ? tileKey(selectedTile.q, selectedTile.r) : null;
}

function refreshAfterAction() {
  renderGrid(selectedKey());
  renderTileInfoPanel(selectedTile);
  renderStats();
}

function startGameLoop() {
  const deltaSeconds = TICK_INTERVAL_MS / 1000;
  setInterval(() => {
    const purged = tick(deltaSeconds);
    renderStats();
    updateTileInfoAffordability(); // met juste à jour disabled=..., ne touche pas au DOM des boutons
    if (purged) showPurgeAlert();
  }, TICK_INTERVAL_MS);
}

function wireEvents() {
  // Clic sur une case de la grille hexagonale
  document.getElementById('hex-grid').addEventListener('click', (event) => {
    const tileEl = event.target.closest('[data-q]');
    if (!tileEl) return;

    const q = Number(tileEl.dataset.q);
    const r = Number(tileEl.dataset.r);
    selectedTile = { q, r };

    // Le Noyau reste cliquable pour générer des Cycles, en plus de la sélection
    if (q === 0 && r === 0) {
      handleCoreClick();
    }

    refreshAfterAction();
  });

  // Actions du panneau d'info de case (délégation d'événements car le contenu est régénéré)
  document.getElementById('tile-info-panel').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-action]');
    if (!btn || btn.disabled) return;

    const q = Number(btn.dataset.q);
    const r = Number(btn.dataset.r);
    const action = btn.dataset.action;

    let success = false;
    if (action === 'unlock') {
      success = unlockTile(q, r);
    } else if (action === 'build') {
      success = placeBuilding(q, r, btn.dataset.type);
    } else if (action === 'upgrade') {
      success = upgradeBuilding(q, r);
    }

    if (success) refreshAfterAction();
  });

  // Achat des Mutations
  for (const key of Object.keys(MUTATION_DEFS)) {
    const btn = document.getElementById(`buy-${key}`);
    if (!btn) continue;
    btn.addEventListener('click', () => {
      if (buyMutation(key)) {
        renderStats();
        renderTileInfoPanel(selectedTile);
        flashSaveStatus(`Mutation acquise : ${MUTATION_DEFS[key].label}`);
      }
    });
  }

  document.getElementById('export-btn').addEventListener('click', () => {
    const encoded = exportSave();
    navigator.clipboard?.writeText(encoded).catch(() => {});
    window.prompt('Copiez votre code de sauvegarde :', encoded);
  });

  document.getElementById('import-btn').addEventListener('click', () => {
    const input = window.prompt('Collez votre code de sauvegarde :');
    if (!input) return;
    const ok = importSave(input);
    if (ok) {
      selectedTile = null;
      refreshAfterAction();
      flashSaveStatus('Import réussi');
    } else {
      flashSaveStatus('Code de sauvegarde invalide');
    }
  });

  document.getElementById('reset-btn').addEventListener('click', () => {
    const confirmed = window.confirm('Réinitialiser toute la progression ? Cette action est irréversible.');
    if (!confirmed) return;
    hardReset();
    selectedTile = null;
    refreshAfterAction();
    flashSaveStatus('Progression réinitialisée');
  });

  // Sauvegarde à la fermeture/changement d'onglet
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveGame();
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch((err) => {
      console.warn('Échec de l\'enregistrement du service worker :', err);
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
