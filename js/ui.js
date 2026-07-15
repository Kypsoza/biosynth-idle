// ============================================
// ui.js — Rendu : synchronise le DOM avec gameState
// ============================================

import { gameState } from './state.js';

const els = {
  strateName: document.getElementById('strate-name'),
  resistanceFill: document.getElementById('resistance-fill'),
  resistanceValue: document.getElementById('resistance-value'),
  resCycles: document.getElementById('res-cycles'),
  resBiomasse: document.getElementById('res-biomasse'),
  resAdn: document.getElementById('res-adn'),
  saveStatus: document.getElementById('save-status'),
};

// Formatage simple des nombres (Phase future : notation scientifique pour les gros nombres)
function formatNumber(n) {
  return Math.floor(n).toLocaleString('fr-FR');
}

export function renderAll() {
  els.strateName.textContent = gameState.strate.name;

  const resistancePct = Math.min(100, Math.max(0, gameState.resistance));
  els.resistanceFill.style.width = `${resistancePct}%`;
  els.resistanceValue.textContent = `${Math.round(resistancePct)}%`;
  document.getElementById('resistance-bar').setAttribute('aria-valuenow', Math.round(resistancePct));

  els.resCycles.textContent = formatNumber(gameState.resources.cycles);
  els.resBiomasse.textContent = formatNumber(gameState.resources.biomasse);
  els.resAdn.textContent = formatNumber(gameState.resources.adn);
}

export function flashSaveStatus(message, durationMs = 2000) {
  const previous = els.saveStatus.textContent;
  els.saveStatus.textContent = message;
  setTimeout(() => {
    els.saveStatus.textContent = previous;
  }, durationMs);
}
