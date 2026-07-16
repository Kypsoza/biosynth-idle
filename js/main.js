// ============================================
// main.js — Point d'entrée du jeu
// ============================================

import { gameState } from './state.js';
import { saveGame, loadGame, exportSave, importSave, hardReset, startAutosave } from './save.js';
import {
  renderGrid,
  renderTileInfoPanel,
  updateTileInfoAffordability,
  renderStats,
  renderBuildMenu,
  updateBuildMenuAffordability,
  updateConstructionProgress,
  flashSaveStatus,
} from './ui.js';
import {
  MUTATION_DEFS,
  buyMutation,
  handleCoreClick,
  tick,
  assignAgent,
  unassignAgent,
  recruitAgent,
  upgradeAgentCap,
  upgradeBuilding,
  buyBuilding,
} from './economy.js';
import { tileKey } from './hexgrid.js';
import { BUILDING_TYPES } from './buildings.js';

const TICK_INTERVAL_MS = 100; // 10 ticks/seconde pour une production fluide

let selectedTile = null; // { q, r } | null

function init() {
  const hadSave = loadGame();
  if (!hadSave) {
    console.info('Aucune sauvegarde trouvée, nouvelle partie.');
  }

  wireEvents(); // toujours attaché en premier : la carte reste cliquable même si un rendu échoue
  renderGrid(null);
  renderTileInfoPanel(null);
  renderBuildMenu();
  renderStats();
  startGameLoop();
  startAutosave((ok) => {
    if (ok) flashSaveStatus('Sauvegarde effectuée');
  });
  registerServiceWorker();
}

function selectedKey() {
  return selectedTile ? tileKey(selectedTile.q, selectedTile.r) : null;
}

function refreshStructural() {
  renderGrid(selectedKey());
  renderTileInfoPanel(selectedTile);
  renderBuildMenu();
  renderStats();
}

function startGameLoop() {
  const deltaSeconds = TICK_INTERVAL_MS / 1000;
  setInterval(() => {
    const justCompleted = tick(deltaSeconds);
    renderStats();
    updateConstructionProgress(); // met juste à jour la largeur des barres, sans reconstruire le DOM
    updateTileInfoAffordability();
    updateBuildMenuAffordability();
    if (justCompleted.length > 0) {
      // Une construction vient de se terminer : un rendu structurel complet est nécessaire
      // (nouvelle icône, contrôles d'Agents, et le menu peut débloquer de nouveaux prérequis)
      refreshStructural();
      justCompleted.forEach((type) => flashSaveStatus(`${BUILDING_TYPES[type].label} construit !`));
    }
  }, TICK_INTERVAL_MS);
}

function wireEvents() {
  // Clics sur la grille : actions inline (Agents) en priorité, sinon sélection de case
  document.getElementById('hex-grid').addEventListener('click', (event) => {
    const actionEl = event.target.closest('[data-action]');
    if (actionEl) {
      const q = Number(actionEl.dataset.q);
      const r = Number(actionEl.dataset.r);
      const action = actionEl.dataset.action;
      let success = false;
      if (action === 'assign-agent') success = assignAgent(q, r);
      else if (action === 'unassign-agent') success = unassignAgent(q, r);
      if (success) {
        renderGrid(selectedKey());
        renderTileInfoPanel(selectedTile);
        renderStats();
      }
      return;
    }

    const tileEl = event.target.closest('[data-q]');
    if (!tileEl) return;

    const q = Number(tileEl.dataset.q);
    const r = Number(tileEl.dataset.r);
    selectedTile = { q, r };

    if (q === 0 && r === 0) {
      handleCoreClick();
    }

    renderGrid(selectedKey());
    renderTileInfoPanel(selectedTile);
    renderStats();
  });

  // Amélioration de niveau (panneau latéral)
  document.getElementById('tile-info-panel').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-action="upgrade"]');
    if (!btn || btn.disabled) return;
    const q = Number(btn.dataset.q);
    const r = Number(btn.dataset.r);
    if (upgradeBuilding(q, r)) refreshStructural();
  });

  // Achat de bâtiments depuis le menu de construction
  document.getElementById('build-menu').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-action="buy-building"]');
    if (!btn || btn.disabled) return;
    if (buyBuilding(btn.dataset.type)) {
      refreshStructural();
      flashSaveStatus(`Construction de ${BUILDING_TYPES[btn.dataset.type].label} lancée`);
    }
  });

  document.getElementById('recruit-btn').addEventListener('click', () => {
    if (recruitAgent()) {
      renderGrid(selectedKey());
      renderStats();
      flashSaveStatus('Nouvel Agent recruté');
    }
  });

  document.getElementById('upgrade-cap-btn').addEventListener('click', () => {
    if (upgradeAgentCap()) {
      renderGrid(selectedKey());
      renderStats();
      flashSaveStatus('Plafond d\'Agents amélioré');
    }
  });

  for (const key of Object.keys(MUTATION_DEFS)) {
    const btn = document.getElementById(`buy-${key}`);
    if (!btn) continue;
    btn.addEventListener('click', () => {
      if (buyMutation(key)) {
        renderStats();
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
      refreshStructural();
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
    refreshStructural();
    flashSaveStatus('Progression réinitialisée');
  });

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
