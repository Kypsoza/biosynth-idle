// ============================================
// main.js — Point d'entrée du jeu
// ============================================

import { gameState } from './state.js';
import { saveGame, loadGame, exportSave, importSave, hardReset, startAutosave } from './save.js';
import { renderAll, flashSaveStatus, showPurgeAlert } from './ui.js';
import {
  SYNAPSE_DEFS,
  MUTATION_DEFS,
  buySynapse,
  buyMutation,
  handleCoreClick,
  tick,
} from './economy.js';

const TICK_INTERVAL_MS = 100; // 10 ticks/seconde pour une production fluide

function init() {
  const hadSave = loadGame();
  if (!hadSave) {
    console.info('Aucune sauvegarde trouvée, nouvelle partie.');
  }

  renderAll();
  wireEvents();
  startGameLoop();
  startAutosave((ok) => {
    if (ok) flashSaveStatus('Sauvegarde effectuée');
  });
  registerServiceWorker();
}

function startGameLoop() {
  const deltaSeconds = TICK_INTERVAL_MS / 1000;
  setInterval(() => {
    const purged = tick(deltaSeconds);
    renderAll();
    if (purged) showPurgeAlert();
  }, TICK_INTERVAL_MS);
}

function wireEvents() {
  // Clic sur le Noyau : génère des Cycles de Calcul (quantité modifiée par les Mutations)
  document.getElementById('core-button').addEventListener('click', () => {
    handleCoreClick();
    renderAll();
  });

  // Achat des Synapses
  for (const key of Object.keys(SYNAPSE_DEFS)) {
    const btn = document.getElementById(`buy-${key}`);
    if (!btn) continue;
    btn.addEventListener('click', () => {
      if (buySynapse(key)) renderAll();
    });
  }

  // Achat des Mutations
  for (const key of Object.keys(MUTATION_DEFS)) {
    const btn = document.getElementById(`buy-${key}`);
    if (!btn) continue;
    btn.addEventListener('click', () => {
      if (buyMutation(key)) {
        renderAll();
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
      renderAll();
      flashSaveStatus('Import réussi');
    } else {
      flashSaveStatus('Code de sauvegarde invalide');
    }
  });

  document.getElementById('reset-btn').addEventListener('click', () => {
    const confirmed = window.confirm('Réinitialiser toute la progression ? Cette action est irréversible.');
    if (!confirmed) return;
    hardReset();
    renderAll();
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
