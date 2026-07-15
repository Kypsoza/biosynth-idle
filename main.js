// ============================================
// main.js — Point d'entrée du jeu
// ============================================

import { gameState } from './state.js';
import { saveGame, loadGame, exportSave, importSave, hardReset, startAutosave } from './save.js';
import { renderAll, flashSaveStatus } from './ui.js';

function init() {
  const hadSave = loadGame();
  if (!hadSave) {
    console.info('Aucune sauvegarde trouvée, nouvelle partie.');
  }

  renderAll();
  wireEvents();
  startAutosave((ok) => {
    if (ok) flashSaveStatus('Sauvegarde effectuée');
  });
  registerServiceWorker();
}

function wireEvents() {
  // Clic sur le Noyau : génère des Cycles de Calcul
  // Phase 1 remplacera le "+1" fixe par un calcul basé sur les Mutations actives
  document.getElementById('core-button').addEventListener('click', () => {
    gameState.resources.cycles += 1;
    renderAll();
  });

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
