// ============================================
// ui.js — Rendu : synchronise le DOM avec gameState
// ============================================

import { gameState } from './state.js';
import {
  SYNAPSE_DEFS,
  MUTATION_DEFS,
  synapseCost,
  canBuySynapse,
  canBuyMutation,
  getProductionRates,
} from './economy.js';

const els = {
  strateName: document.getElementById('strate-name'),
  resistanceFill: document.getElementById('resistance-fill'),
  resistanceValue: document.getElementById('resistance-value'),
  resistanceBar: document.getElementById('resistance-bar'),
  resCycles: document.getElementById('res-cycles'),
  resBiomasse: document.getElementById('res-biomasse'),
  resAdn: document.getElementById('res-adn'),
  saveStatus: document.getElementById('save-status'),
  coreProduction: document.getElementById('core-production'),
  purgeAlert: document.getElementById('purge-alert'),
};

// Formatage simple des nombres (Phase future : notation scientifique pour les gros nombres)
function formatNumber(n) {
  return Math.floor(n).toLocaleString('fr-FR');
}

function formatRate(n) {
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
}

function renderSynapses() {
  for (const key of Object.keys(SYNAPSE_DEFS)) {
    const countEl = document.getElementById(`count-${key}`);
    const costEl = document.getElementById(`cost-${key}`);
    const buyBtn = document.getElementById(`buy-${key}`);
    if (!countEl || !costEl || !buyBtn) continue;

    countEl.textContent = `(${gameState.synapses[key].count})`;
    costEl.textContent = formatNumber(synapseCost(key));
    buyBtn.disabled = !canBuySynapse(key);
  }
}

function renderMutations() {
  for (const key of Object.keys(MUTATION_DEFS)) {
    const buyBtn = document.getElementById(`buy-${key}`);
    if (!buyBtn) continue;

    if (gameState.mutations[key].purchased) {
      buyBtn.innerHTML = 'Acquis';
      buyBtn.disabled = true;
      buyBtn.classList.add('shop-item-buy--purchased');
    } else {
      buyBtn.disabled = !canBuyMutation(key);
    }
  }
}

export function renderAll() {
  els.strateName.textContent = gameState.strate.name;

  const resistancePct = Math.min(100, Math.max(0, gameState.resistance));
  els.resistanceFill.style.width = `${resistancePct}%`;
  els.resistanceValue.textContent = `${Math.round(resistancePct)}%`;
  els.resistanceBar.setAttribute('aria-valuenow', Math.round(resistancePct));

  els.resCycles.textContent = formatNumber(gameState.resources.cycles);
  els.resBiomasse.textContent = formatNumber(gameState.resources.biomasse);
  els.resAdn.textContent = formatNumber(gameState.resources.adn);

  const { cyclesPerSecond, biomassePerSecond } = getProductionRates();
  els.coreProduction.textContent = `+${formatRate(cyclesPerSecond)} Cycles/s · +${formatRate(biomassePerSecond)} Biomasse/s`;

  renderSynapses();
  renderMutations();
}

export function flashSaveStatus(message, durationMs = 2000) {
  const previous = els.saveStatus.textContent;
  els.saveStatus.textContent = message;
  setTimeout(() => {
    els.saveStatus.textContent = previous;
  }, durationMs);
}

export function showPurgeAlert() {
  els.purgeAlert.hidden = false;
  setTimeout(() => {
    els.purgeAlert.hidden = true;
  }, 2500);
}
