// ============================================
// ui.js — Rendu : synchronise le DOM avec gameState
// ============================================

import { gameState } from './state.js';
import { BUILDING_TYPES, NOYAU_COLOR, upgradeCost, buildingProductionAtLevel, visualTier } from './buildings.js';
import {
  MUTATION_DEFS,
  canBuyMutation,
  getProductionRates,
  unlockCost,
  canUnlockTile,
  isTileUnlockable,
  canPlaceBuilding,
  canUpgradeBuilding,
} from './economy.js';
import { MAX_RING, allTilesInRadius, axialToPixel, hexCorners, tileKey, hexDistance } from './hexgrid.js';

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
  hexGrid: document.getElementById('hex-grid'),
  tileInfoPanel: document.getElementById('tile-info-panel'),
};

function formatNumber(n) {
  return Math.floor(n).toLocaleString('fr-FR');
}

function formatRate(n) {
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
}

// ============================================
// Grille hexagonale (SVG)
// ============================================

function tileVisualState(q, r) {
  const key = tileKey(q, r);
  const tile = gameState.tiles[key];
  if (tile?.unlocked) {
    return tile.building ? 'built' : 'empty';
  }
  return isTileUnlockable(q, r) ? 'frontier' : 'far';
}

export function renderGrid(selectedKey) {
  const allTiles = allTilesInRadius(MAX_RING);

  // Calcul du viewBox englobant tous les hexagones + un peu de marge
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const positions = allTiles.map(([q, r]) => {
    const { x, y } = axialToPixel(q, r);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    return { q, r, x, y };
  });
  const pad = 40;
  const viewBox = `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`;
  els.hexGrid.setAttribute('viewBox', viewBox);

  const svgParts = [];

  for (const { q, r, x, y } of positions) {
    const key = tileKey(q, r);
    const state = tileVisualState(q, r);
    const tile = gameState.tiles[key];
    const classes = [`hex-tile`, `hex-tile--${state}`];
    if (selectedKey === key) classes.push('hex-tile--selected');

    let inner = '';

    if (state === 'frontier') {
      inner += `<text class="hex-tile-glyph hex-tile-glyph--lock" x="${x}" y="${y + 6}" text-anchor="middle">🔒</text>`;
    } else if (state === 'empty') {
      inner += `<text class="hex-tile-glyph hex-tile-glyph--build" x="${x}" y="${y + 7}" text-anchor="middle">+</text>`;
    }

    if (state === 'built') {
      const { type, level } = tile.building;
      const tier = visualTier(level);
      classes.push(`hex-tile--tier-${tier}`);
      const color = type === 'noyau' ? NOYAU_COLOR : BUILDING_TYPES[type].color;
      const radius = type === 'noyau' ? 15 : 8 + tier * 2.5;
      inner += `<circle class="hex-building-core" cx="${x}" cy="${y}" r="${radius}" fill="${color}" style="color:${color}"></circle>`;
      if (type !== 'noyau') {
        inner += `<text class="hex-tile-level-badge" x="${x}" y="${y + radius + 12}" text-anchor="middle">Nv.${level}</text>`;
      }
    }

    svgParts.push(`
      <g class="${classes.join(' ')}" data-q="${q}" data-r="${r}">
        <polygon class="hex-tile-shape" points="${hexCorners(x, y)}"></polygon>
        ${inner}
      </g>
    `);
  }

  els.hexGrid.innerHTML = svgParts.join('');
}

// ============================================
// Panneau d'info de la case sélectionnée
// ============================================

export function renderTileInfoPanel(selected) {
  const panel = els.tileInfoPanel;

  if (!selected) {
    panel.innerHTML = `
      <h2 class="panel-title">Case sélectionnée</h2>
      <p class="tile-info-empty">Cliquez sur une case de la carte pour voir ses détails.</p>
    `;
    return;
  }

  const { q, r } = selected;
  const key = tileKey(q, r);
  const state = tileVisualState(q, r);
  const tile = gameState.tiles[key];

  if (state === 'far') {
    panel.innerHTML = `
      <h2 class="panel-title">Case sélectionnée</h2>
      <p class="tile-info-empty">Cette case n'est pas encore accessible — débloquez des cases voisines pour vous en approcher.</p>
    `;
    return;
  }

  if (state === 'frontier') {
    const cost = unlockCost(q, r);
    const affordable = canUnlockTile(q, r);
    panel.innerHTML = `
      <h2 class="panel-title">Case verrouillée</h2>
      <p class="tile-info-desc">Débloquez cette case pour pouvoir y construire un bâtiment.</p>
      <div class="tile-info-stat"><span>Coût</span><strong><span class="cost-cycles">${formatNumber(cost.cycles)} Cycles</span>${cost.biomasse > 0 ? ` / <span class="cost-biomasse">${formatNumber(cost.biomasse)} Biomasse</span>` : ''}</strong></div>
      <button class="tile-action-btn" data-action="unlock" data-q="${q}" data-r="${r}" ${affordable ? '' : 'disabled'}>Débloquer</button>
    `;
    return;
  }

  if (state === 'empty') {
    const options = Object.entries(BUILDING_TYPES).map(([type, def]) => {
      const affordable = canPlaceBuilding(q, r, type);
      return `
        <li class="shop-item">
          <div class="shop-item-info">
            <span class="shop-item-name">${def.label}</span>
            <span class="shop-item-desc">${def.description}</span>
          </div>
          <button class="shop-item-buy" data-action="build" data-type="${type}" data-q="${q}" data-r="${r}" ${affordable ? '' : 'disabled'}>
            <span class="cost-cycles">${formatNumber(def.placementCost.cycles)}⚡</span>${def.placementCost.biomasse ? ` / <span class="cost-biomasse">${formatNumber(def.placementCost.biomasse)}🧬</span>` : ''}
          </button>
        </li>
      `;
    }).join('');

    panel.innerHTML = `
      <h2 class="panel-title">Case vide</h2>
      <p class="tile-info-desc">Choisissez un bâtiment à construire ici.</p>
      <ul class="build-option-list">${options}</ul>
    `;
    return;
  }

  // state === 'built'
  const { type, level } = tile.building;

  if (type === 'noyau') {
    panel.innerHTML = `
      <h2 class="panel-title">Le Noyau</h2>
      <p class="tile-info-desc">Le cœur de la colonie. Cliquez dessus sur la carte pour générer des Cycles de Calcul.</p>
      <div class="tile-info-stat"><span>Puissance de clic</span><strong>+${gameState.clickPower} Cycle(s)/clic</strong></div>
    `;
    return;
  }

  const def = BUILDING_TYPES[type];
  const prod = buildingProductionAtLevel(type, level);
  const prodLines = Object.entries(prod).map(([k, v]) => {
    const label = k === 'cyclesPerSecond' ? 'Cycles/s' : 'Biomasse/s';
    return `<div class="tile-info-stat"><span>${label}</span><strong>+${formatRate(v)}</strong></div>`;
  }).join('');

  const isMaxed = level >= def.maxLevel;
  let upgradeSection = `<p class="tile-max-level">Niveau maximum atteint</p>`;
  if (!isMaxed) {
    const cost = upgradeCost(type, level);
    const affordable = canUpgradeBuilding(q, r);
    upgradeSection = `
      <div class="tile-info-stat"><span>Coût amélioration</span><strong><span class="cost-cycles">${formatNumber(cost.cycles)}⚡</span> / <span class="cost-biomasse">${formatNumber(cost.biomasse)}🧬</span></strong></div>
      <button class="tile-action-btn" data-action="upgrade" data-q="${q}" data-r="${r}" ${affordable ? '' : 'disabled'}>Améliorer (Niveau ${level + 1})</button>
    `;
  }

  panel.innerHTML = `
    <h2 class="panel-title">${def.label} — Niveau ${level}</h2>
    <p class="tile-info-desc">${def.description}</p>
    ${prodLines}
    ${upgradeSection}
  `;
}

// Met à jour uniquement l'état activé/désactivé des boutons existants, SANS reconstruire
// le DOM — appelé à chaque tick pour rester réactif sans jamais interrompre un clic en cours
export function updateTileInfoAffordability() {
  const buttons = els.tileInfoPanel.querySelectorAll('[data-action]');
  buttons.forEach((btn) => {
    const q = Number(btn.dataset.q);
    const r = Number(btn.dataset.r);
    const action = btn.dataset.action;
    if (action === 'unlock') {
      btn.disabled = !canUnlockTile(q, r);
    } else if (action === 'build') {
      btn.disabled = !canPlaceBuilding(q, r, btn.dataset.type);
    } else if (action === 'upgrade') {
      btn.disabled = !canUpgradeBuilding(q, r);
    }
  });
}

// ============================================
// Mutations
// ============================================

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

// ============================================
// Ressources / stats globales (appelé à chaque tick)
// ============================================

export function renderStats() {
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

  renderMutations();
}

// Rendu complet : stats + mutations (grille et panneau d'info gérés séparément
// car ils n'ont besoin d'être reconstruits qu'après une action structurelle)
export function renderAll() {
  renderStats();
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
