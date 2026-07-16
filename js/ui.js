// ============================================
// ui.js — Rendu : synchronise le DOM avec gameState
// ============================================

import { gameState } from './state.js';
import { BUILDING_TYPES, NOYAU_COLOR, upgradeCost, productionPerAgentAtLevel, visualTier } from './buildings.js';
import {
  MUTATION_DEFS,
  canBuyMutation,
  getProductionRates,
  getEnergyConsumption,
  unlockCost,
  canUnlockTile,
  isTileUnlockable,
  canPlaceBuilding,
  canUpgradeBuilding,
  currentAgentCap,
  idleAgents,
  totalAssignedAgents,
  canAssignAgent,
  canUnassignAgent,
  getRecruitCost,
  canRecruitAgent,
  getAgentCapUpgradeCost,
  canUpgradeAgentCap,
} from './economy.js';
import { MAX_RING, allTilesInRadius, axialToPixel, hexCorners, tileKey } from './hexgrid.js';

const els = {
  strateName: document.getElementById('strate-name'),
  resCycles: document.getElementById('res-cycles'),
  resEnergie: document.getElementById('res-energie'),
  resBiomasse: document.getElementById('res-biomasse'),
  resAdn: document.getElementById('res-adn'),
  saveStatus: document.getElementById('save-status'),
  coreProduction: document.getElementById('core-production'),
  agentsTotalHud: document.getElementById('agents-total-hud'),
  agentsIdleHud: document.getElementById('agents-idle-hud'),
  recruitBtn: document.getElementById('recruit-btn'),
  recruitCost: document.getElementById('recruit-cost'),
  agentCapValue: document.getElementById('agent-cap-value'),
  agentCapCost: document.getElementById('agent-cap-cost'),
  upgradeCapBtn: document.getElementById('upgrade-cap-btn'),
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

function shadeColor(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  let r = (num >> 16) + percent;
  let g = ((num >> 8) & 0x00ff) + percent;
  let b = (num & 0x0000ff) + percent;
  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function buildDefsMarkup() {
  const buildingColors = { noyau: NOYAU_COLOR };
  for (const [type, def] of Object.entries(BUILDING_TYPES)) buildingColors[type] = def.color;

  const gradientDefs = Object.entries(buildingColors).map(([type, color]) => `
    <radialGradient id="grad-${type}" cx="35%" cy="30%" r="70%">
      <stop offset="0%" stop-color="${shadeColor(color, 90)}"/>
      <stop offset="45%" stop-color="${color}"/>
      <stop offset="100%" stop-color="${shadeColor(color, -70)}"/>
    </radialGradient>
  `).join('');

  return `
    <defs>
      ${gradientDefs}
      <linearGradient id="metalGold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FFE9A8"/>
        <stop offset="50%" stop-color="#D4AF37"/>
        <stop offset="100%" stop-color="#6B4423"/>
      </linearGradient>
      <radialGradient id="noyauGrad" cx="35%" cy="30%" r="75%">
        <stop offset="0%" stop-color="#FFF6DC"/>
        <stop offset="45%" stop-color="#FFE9A8"/>
        <stop offset="80%" stop-color="#D4AF37"/>
        <stop offset="100%" stop-color="#6B4423"/>
      </radialGradient>
      <radialGradient id="ledHalo" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#FFE9A8" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="#FFE9A8" stop-opacity="0"/>
      </radialGradient>
      <pattern id="circuitPattern" patternUnits="userSpaceOnUse" width="52" height="52" patternTransform="rotate(0)">
        <path d="M4,26 H20 L24,22 V8 M32,26 H48 M26,30 V44 L30,48"
          stroke="#D4AF37" stroke-width="1.3" opacity="0.5" fill="none" stroke-linecap="round"/>
        <path d="M26,4 V16 M4,4 H14 M38,4 V14 L44,20 H48"
          stroke="#B8763F" stroke-width="1" opacity="0.35" fill="none" stroke-linecap="round"/>
        <rect x="6" y="34" width="8" height="4" rx="1" fill="none" stroke="#C97F4F" stroke-width="1" opacity="0.4"/>
        <circle cx="26" cy="26" r="2.4" fill="#FFE9A8" opacity="0.7"/>
        <circle cx="24" cy="22" r="1.3" fill="#D4AF37" opacity="0.55"/>
        <circle cx="32" cy="26" r="1.3" fill="#D4AF37" opacity="0.55"/>
        <circle cx="4" cy="26" r="1.1" fill="#D4AF37" opacity="0.45"/>
        <circle cx="48" cy="26" r="1.1" fill="#D4AF37" opacity="0.45"/>
      </pattern>
      <filter id="metalShadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.55"/>
      </filter>
    </defs>
  `;
}

export function renderGrid(selectedKey) {
  const allTiles = allTilesInRadius(MAX_RING);

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

  const svgParts = [buildDefsMarkup()];

  for (const { q, r, x, y } of positions) {
    const key = tileKey(q, r);
    const state = tileVisualState(q, r);
    const tile = gameState.tiles[key];
    const classes = [`hex-tile`, `hex-tile--${state}`];
    if (selectedKey === key) classes.push('hex-tile--selected');

    let inner = '';
    const showCircuitOverlay = state === 'built' || state === 'empty';
    if (showCircuitOverlay) {
      inner += `<polygon class="hex-tile-circuit-overlay" points="${hexCorners(x, y)}"></polygon>`;
    }

    if (state === 'frontier') {
      inner += `<text class="hex-tile-glyph hex-tile-glyph--lock" x="${x}" y="${y + 6}" text-anchor="middle">🔒</text>`;
    } else if (state === 'empty') {
      inner += `<text class="hex-tile-glyph hex-tile-glyph--build" x="${x}" y="${y + 7}" text-anchor="middle">+</text>`;
    }

    if (state === 'built') {
      const { type, level, assignedAgents } = tile.building;

      if (type === 'noyau') {
        const half = 17;
        inner += `<circle class="hex-noyau-halo" cx="${x}" cy="${y}" r="30" fill="url(#ledHalo)"></circle>`;
        inner += `<rect class="hex-building-ring" x="${x - half - 4}" y="${y - half - 4}" width="${(half + 4) * 2}" height="${(half + 4) * 2}" rx="4" fill="none" stroke="url(#metalGold)" stroke-width="2"></rect>`;
        inner += `<rect x="${x - half}" y="${y - half}" width="${half * 2}" height="${half * 2}" rx="3" fill="url(#noyauGrad)" transform="rotate(45 ${x} ${y})" style="color:${NOYAU_COLOR}"></rect>`;
      } else {
        const tier = visualTier(level);
        classes.push(`hex-tile--tier-${tier}`);
        const color = BUILDING_TYPES[type].color;
        const radius = 8 + tier * 2.5;
        inner += `<circle class="hex-building-ring" cx="${x}" cy="${y}" r="${radius + 3}" fill="none" stroke="url(#metalGold)" stroke-width="1.6"></circle>`;
        inner += `<circle class="hex-building-core" cx="${x}" cy="${y}" r="${radius}" fill="url(#grad-${type})" style="color:${color}"></circle>`;
        const agentBadge = assignedAgents !== undefined ? ` · ${assignedAgents}👤` : '';
        inner += `<text class="hex-tile-level-badge" x="${x}" y="${y + radius + 12}" text-anchor="middle">Nv.${level}${agentBadge}</text>`;
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
  const { type, level, assignedAgents } = tile.building;

  if (type === 'noyau') {
    panel.innerHTML = `
      <h2 class="panel-title">Le Noyau</h2>
      <p class="tile-info-desc">Le cœur de la colonie. Cliquez dessus sur la carte pour générer des Cycles de Calcul.</p>
      <div class="tile-info-stat"><span>Puissance de clic</span><strong>+${gameState.clickPower} Cycle(s)/clic</strong></div>
    `;
    return;
  }

  const def = BUILDING_TYPES[type];
  const isMaxed = level >= def.maxLevel;

  let agentSection = '';
  if (def.requiresAgents) {
    const prod = productionPerAgentAtLevel(type, level);
    const prodLines = Object.entries(prod).map(([k, v]) => {
      const label = k === 'cyclesPerSecond' ? 'Cycles/s' : k === 'biomassePerSecond' ? 'Biomasse/s' : 'Énergie/s';
      const total = v * assignedAgents;
      return `<div class="tile-info-stat"><span>${label} (par Agent : ${formatRate(v)})</span><strong>+${formatRate(total)}</strong></div>`;
    }).join('');

    agentSection = `
      <div class="tile-info-stat"><span>Agents assignés</span><strong>${assignedAgents} / ${currentAgentCap()}</strong></div>
      <div class="agent-assign-controls">
        <button class="agent-assign-btn" data-action="unassign-agent" data-q="${q}" data-r="${r}" ${canUnassignAgent(q, r) ? '' : 'disabled'}>−</button>
        <span class="agent-assign-count">${assignedAgents}</span>
        <button class="agent-assign-btn" data-action="assign-agent" data-q="${q}" data-r="${r}" ${canAssignAgent(q, r) ? '' : 'disabled'}>+</button>
      </div>
      ${prodLines}
    `;
  }

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
    ${agentSection}
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
    } else if (action === 'assign-agent') {
      btn.disabled = !canAssignAgent(q, r);
    } else if (action === 'unassign-agent') {
      btn.disabled = !canUnassignAgent(q, r);
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
// Agents (panneau recrutement + plafond)
// ============================================

function renderAgentsPanel() {
  els.recruitCost.textContent = formatNumber(getRecruitCost());
  els.recruitBtn.disabled = !canRecruitAgent();

  els.agentCapValue.textContent = currentAgentCap();
  const capCost = getAgentCapUpgradeCost();
  if (!capCost) {
    els.agentCapCost.textContent = 'Palier maximum atteint';
    els.upgradeCapBtn.disabled = true;
  } else {
    els.agentCapCost.innerHTML = `<span class="cost-cycles">${formatNumber(capCost.cycles)}⚡</span> / <span class="cost-biomasse">${formatNumber(capCost.biomasse)}🧬</span>`;
    els.upgradeCapBtn.disabled = !canUpgradeAgentCap();
  }
}

// ============================================
// Ressources / stats globales (appelé à chaque tick)
// ============================================

export function renderStats() {
  els.strateName.textContent = gameState.strate.name;

  els.resCycles.textContent = formatNumber(gameState.resources.cycles);
  els.resEnergie.textContent = formatNumber(gameState.resources.energie);
  els.resBiomasse.textContent = formatNumber(gameState.resources.biomasse);
  els.resAdn.textContent = formatNumber(gameState.resources.adn);

  els.agentsTotalHud.textContent = formatNumber(gameState.agents.total);
  els.agentsIdleHud.textContent = formatNumber(idleAgents());

  const { cyclesPerSecond, biomassePerSecond, energiePerSecond } = getProductionRates();
  const consumption = getEnergyConsumption();
  const netEnergie = energiePerSecond - consumption;
  els.coreProduction.textContent = `+${formatRate(cyclesPerSecond)} Cycles/s · +${formatRate(biomassePerSecond)} Biomasse/s · ${netEnergie >= 0 ? '+' : ''}${formatRate(netEnergie)} Énergie/s`;

  renderMutations();
  renderAgentsPanel();
}

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
