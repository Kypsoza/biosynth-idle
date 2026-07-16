// ============================================
// ui.js — Rendu : synchronise le DOM avec gameState
// ============================================

import { gameState } from './state.js';
import {
  BUILDING_TYPES,
  NOYAU_COLOR,
  SLOT_INDEX,
  upgradeCost,
  productionPerAgentAtLevel,
  visualTier,
} from './buildings.js';
import {
  MUTATION_DEFS,
  canBuyMutation,
  getProductionRates,
  getEnergyConsumption,
  canUpgradeBuilding,
  currentAgentCap,
  idleAgents,
  canAssignAgent,
  canUnassignAgent,
  getRecruitCost,
  canRecruitAgent,
  getAgentCapUpgradeCost,
  canUpgradeAgentCap,
  canBuyBuilding,
  prerequisiteMet,
  isBuilt,
  isConstructing,
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
  buildMenu: document.getElementById('build-menu'),
};

function formatNumber(n) {
  return Math.floor(n).toLocaleString('fr-FR');
}

function formatRate(n) {
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
}

// ============================================
// Icônes de bâtiments thématisées
// ============================================

function smallHexPoints(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push(`${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`);
  }
  return pts.join(' ');
}

function buildingIconMarkup(type, x, y, radius, opacity = 1) {
  const grad = `url(#grad-${type})`;
  const color = BUILDING_TYPES[type].color;
  const style = `color:${color};opacity:${opacity}`;

  if (type === 'synapse') {
    let dendrites = '';
    for (const angle of [45, 135, 225, 315]) {
      const rad = (angle * Math.PI) / 180;
      const x2 = x + Math.cos(rad) * radius * 1.4;
      const y2 = y + Math.sin(rad) * radius * 1.4;
      dendrites += `<line x1="${x}" y1="${y}" x2="${x2}" y2="${y2}" stroke="url(#metalGold)" stroke-width="1.4"/><circle cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="1.8" fill="#FFE9A8"/>`;
    }
    return `<g class="hex-building-core" style="${style}">${dendrites}<circle cx="${x}" cy="${y}" r="${radius * 0.62}" fill="${grad}"/></g>`;
  }
  if (type === 'incubateur') {
    return `<polygon class="hex-building-core" style="${style}" points="${smallHexPoints(x, y, radius)}" fill="${grad}"/>`;
  }
  if (type === 'nexus') {
    let nubs = '';
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = x + dx * radius * 1.3;
      const ny = y + dy * radius * 1.3;
      nubs += `<line x1="${x}" y1="${y}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="url(#metalGold)" stroke-width="1.3"/><circle cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="1.6" fill="#FFE9A8"/>`;
    }
    return `<g class="hex-building-core" style="${style}">${nubs}<rect x="${(x - radius * 0.6).toFixed(1)}" y="${(y - radius * 0.6).toFixed(1)}" width="${(radius * 1.2).toFixed(1)}" height="${(radius * 1.2).toFixed(1)}" fill="${grad}" transform="rotate(45 ${x} ${y})"/></g>`;
  }
  if (type === 'regulateur') {
    return `<g class="hex-building-core" style="${style}">
      <circle cx="${x}" cy="${y}" r="${radius * 0.8}" fill="${grad}"/>
      <rect x="${(x - 2).toFixed(1)}" y="${(y - radius - 3).toFixed(1)}" width="4" height="6" fill="url(#metalGold)"/>
      <rect x="${(x - 2).toFixed(1)}" y="${(y + radius - 3).toFixed(1)}" width="4" height="6" fill="url(#metalGold)"/>
    </g>`;
  }
  if (type === 'energie') {
    const p = (dx, dy) => `${(x + dx * radius).toFixed(1)},${(y + dy * radius).toFixed(1)}`;
    return `<path class="hex-building-core" style="${style}" d="M ${p(0.25, -1)} L ${p(-0.45, 0.15)} L ${p(0, 0.15)} L ${p(-0.25, 1)} L ${p(0.45, -0.15)} L ${p(0, -0.15)} Z" fill="${grad}"/>`;
  }
  return `<circle class="hex-building-core" style="${style}" cx="${x}" cy="${y}" r="${radius}" fill="${grad}"/>`;
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
      <pattern id="circuitPattern" patternUnits="userSpaceOnUse" width="52" height="52">
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

// ============================================
// Grille hexagonale (SVG)
// ============================================

function slotState(type) {
  if (isConstructing(type)) return 'constructing';
  if (isBuilt(type)) return 'built';
  return prerequisiteMet(type) ? 'buildable' : 'locked';
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
  const pad = 50;
  const viewBox = `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`;
  els.hexGrid.setAttribute('viewBox', viewBox);

  const svgParts = [buildDefsMarkup()];

  for (const { q, r, x, y } of positions) {
    const key = tileKey(q, r);
    const isNoyau = key === '0,0';
    const slotType = SLOT_INDEX[key];
    const classes = ['hex-tile'];
    let inner = '';

    if (isNoyau) {
      classes.push('hex-tile--noyau');
      if (selectedKey === key) classes.push('hex-tile--selected');
      const half = 17;
      inner += `<circle class="hex-noyau-halo" cx="${x}" cy="${y}" r="30" fill="url(#ledHalo)"></circle>`;
      inner += `<rect class="hex-building-ring" x="${x - half - 4}" y="${y - half - 4}" width="${(half + 4) * 2}" height="${(half + 4) * 2}" rx="4" fill="none" stroke="url(#metalGold)" stroke-width="2"></rect>`;
      inner += `<rect x="${x - half}" y="${y - half}" width="${half * 2}" height="${half * 2}" rx="3" fill="url(#noyauGrad)" transform="rotate(45 ${x} ${y})"></rect>`;
    } else if (slotType) {
      const type = slotType;
      const def = BUILDING_TYPES[type];
      const tile = gameState.tiles[key];
      const state = slotState(type);
      classes.push(`hex-tile--slot`, `hex-tile--slot-${state}`);
      if (selectedKey === key) classes.push('hex-tile--selected');

      if (state === 'locked') {
        inner += buildingIconMarkup(type, x, y, 12, 0.18);
        inner += `<text class="hex-tile-glyph hex-tile-glyph--lock" x="${x}" y="${y + 26}" text-anchor="middle">🔒</text>`;
      } else if (state === 'buildable') {
        inner += buildingIconMarkup(type, x, y, 13, 0.4);
        inner += `<text class="hex-tile-glyph hex-tile-glyph--build" x="${x}" y="${y + 30}" text-anchor="middle">Menu ↓</text>`;
      } else if (state === 'constructing') {
        inner += buildingIconMarkup(type, x, y, 13, 0.5);
        const pct = Math.max(0, Math.min(1, 1 - tile.building.remainingTime / tile.building.totalTime));
        const barW = 40;
        inner += `
          <rect x="${x - barW / 2}" y="${y + 20}" width="${barW}" height="6" rx="3" fill="var(--color-bg)" stroke="var(--color-bronze)"></rect>
          <rect data-progress-for="${key}" x="${x - barW / 2}" y="${y + 20}" width="${(barW * pct).toFixed(1)}" height="6" rx="3" fill="url(#metalGold)"></rect>
          <text class="hex-tile-level-badge" x="${x}" y="${y + 38}" text-anchor="middle">Construction…</text>
        `;
      } else {
        // built
        const { level, assignedAgents } = tile.building;
        const tier = visualTier(level);
        classes.push(`hex-tile--tier-${tier}`);
        const radius = 8 + tier * 2.5;
        inner += `<circle class="hex-building-ring" cx="${x}" cy="${y}" r="${radius + 3}" fill="none" stroke="url(#metalGold)" stroke-width="1.6"></circle>`;
        inner += buildingIconMarkup(type, x, y, radius, 1);
        inner += `<text class="hex-tile-level-badge" x="${x}" y="${y + radius + 14}" text-anchor="middle">Nv.${level}</text>`;

        if (def.requiresAgents) {
          const yCtrl = y + radius + 26;
          const canMinus = canUnassignAgent(q, r);
          const canPlus = canAssignAgent(q, r);
          inner += `
            <g class="agent-inline-controls">
              <circle class="agent-inline-btn ${canMinus ? '' : 'agent-inline-btn--disabled'}" cx="${x - 16}" cy="${yCtrl}" r="9" data-action="unassign-agent" data-q="${q}" data-r="${r}"></circle>
              <text class="agent-inline-btn-label" x="${x - 16}" y="${yCtrl + 4}" text-anchor="middle" data-action="unassign-agent" data-q="${q}" data-r="${r}">−</text>
              <text class="agent-inline-count" x="${x}" y="${yCtrl + 4}" text-anchor="middle">${assignedAgents}</text>
              <circle class="agent-inline-btn ${canPlus ? '' : 'agent-inline-btn--disabled'}" cx="${x + 16}" cy="${yCtrl}" r="9" data-action="assign-agent" data-q="${q}" data-r="${r}"></circle>
              <text class="agent-inline-btn-label" x="${x + 16}" y="${yCtrl + 4}" text-anchor="middle" data-action="assign-agent" data-q="${q}" data-r="${r}">+</text>
            </g>
          `;
        }
      }
    } else {
      // Case purement décorative (atmosphère de la carte mère)
      classes.push('hex-tile--decor');
      inner += `<polygon class="hex-tile-circuit-overlay" points="${hexCorners(x, y)}"></polygon>`;
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

// Met à jour uniquement la largeur des barres de progression en cours de construction,
// sans jamais reconstruire le DOM (appelé à chaque tick, évite toute course avec les clics)
export function updateConstructionProgress() {
  const bars = els.hexGrid.querySelectorAll('[data-progress-for]');
  bars.forEach((bar) => {
    const key = bar.dataset.progressFor;
    const tile = gameState.tiles[key];
    if (!tile?.building?.constructing) return;
    const pct = Math.max(0, Math.min(1, 1 - tile.building.remainingTime / tile.building.totalTime));
    bar.setAttribute('width', (40 * pct).toFixed(1));
  });
}

// ============================================
// Menu de construction (bas de page)
// ============================================

export function renderBuildMenu() {
  const cards = Object.entries(BUILDING_TYPES).map(([type, def]) => {
    const state = slotState(type);
    let statusLabel = '';
    let disabled = true;

    if (state === 'built') {
      statusLabel = '<span class="build-card-status build-card-status--done">Construit</span>';
    } else if (state === 'constructing') {
      statusLabel = '<span class="build-card-status build-card-status--progress">En construction…</span>';
    } else if (state === 'locked') {
      const prereqLabel = BUILDING_TYPES[def.prerequisite].label;
      statusLabel = `<span class="build-card-status build-card-status--locked">Nécessite : ${prereqLabel}</span>`;
    } else {
      disabled = !canBuyBuilding(type);
      statusLabel = `<span class="build-card-cost"><span class="cost-cycles">${formatNumber(def.placementCost.cycles)}⚡</span>${def.placementCost.biomasse ? ` / <span class="cost-biomasse">${formatNumber(def.placementCost.biomasse)}🧬</span>` : ''}</span>`;
    }

    return `
      <li class="build-card build-card--${state}" data-type="${type}">
        <span class="build-card-name">${def.label}</span>
        <span class="build-card-desc">${def.description}</span>
        ${statusLabel}
        <button class="build-card-btn" data-action="buy-building" data-type="${type}" ${state === 'buildable' ? '' : 'disabled'}>
          ${state === 'built' ? '✓' : state === 'constructing' ? '…' : state === 'locked' ? '🔒' : 'Construire'}
        </button>
      </li>
    `;
  }).join('');

  els.buildMenu.innerHTML = `<ul class="build-card-list">${cards}</ul>`;
  updateBuildMenuAffordability();
}

// Met juste à jour l'état activé/désactivé des boutons du menu, sans reconstruire le HTML
export function updateBuildMenuAffordability() {
  const buttons = els.buildMenu.querySelectorAll('[data-action="buy-building"]');
  buttons.forEach((btn) => {
    const type = btn.dataset.type;
    if (slotState(type) !== 'buildable') return; // déjà disabled par le rendu structurel
    btn.disabled = !canBuyBuilding(type);
  });
}

// ============================================
// Panneau d'info de la case sélectionnée
// ============================================

export function renderTileInfoPanel(selected) {
  const panel = els.tileInfoPanel;

  if (!selected) {
    panel.innerHTML = `
      <h2 class="panel-title">Case sélectionnée</h2>
      <p class="tile-info-empty">Cliquez sur le Noyau ou un bâtiment construit pour voir ses détails.</p>
    `;
    return;
  }

  const { q, r } = selected;
  const key = tileKey(q, r);

  if (key === '0,0') {
    panel.innerHTML = `
      <h2 class="panel-title">Le Noyau</h2>
      <p class="tile-info-desc">Le cœur de la colonie. Cliquez dessus sur la carte pour générer des Cycles de Calcul.</p>
      <div class="tile-info-stat"><span>Puissance de clic</span><strong>+${gameState.clickPower} Cycle(s)/clic</strong></div>
    `;
    return;
  }

  const type = SLOT_INDEX[key];
  if (!type) {
    panel.innerHTML = `
      <h2 class="panel-title">Case sélectionnée</h2>
      <p class="tile-info-empty">Cette case est purement décorative.</p>
    `;
    return;
  }

  const state = slotState(type);
  const def = BUILDING_TYPES[type];

  if (state === 'locked') {
    panel.innerHTML = `
      <h2 class="panel-title">${def.label} — Verrouillé</h2>
      <p class="tile-info-desc">Nécessite : <strong>${BUILDING_TYPES[def.prerequisite].label}</strong> construit au préalable.</p>
    `;
    return;
  }

  if (state === 'buildable') {
    panel.innerHTML = `
      <h2 class="panel-title">${def.label}</h2>
      <p class="tile-info-desc">${def.description}</p>
      <p class="tile-info-empty">Achetez ce bâtiment depuis le menu de construction en bas de l'écran.</p>
    `;
    return;
  }

  const tile = gameState.tiles[key];

  if (state === 'constructing') {
    const remaining = Math.ceil(tile.building.remainingTime);
    panel.innerHTML = `
      <h2 class="panel-title">${def.label} — Construction</h2>
      <p class="tile-info-desc">${def.description}</p>
      <div class="tile-info-stat"><span>Temps restant</span><strong>${remaining}s</strong></div>
    `;
    return;
  }

  // state === 'built'
  const { level, assignedAgents } = tile.building;
  const isMaxed = level >= def.maxLevel;

  let prodSection = '';
  if (def.requiresAgents) {
    const prod = productionPerAgentAtLevel(type, level);
    const prodLines = Object.entries(prod).map(([k, v]) => {
      const label = k === 'cyclesPerSecond' ? 'Cycles/s' : k === 'biomassePerSecond' ? 'Biomasse/s' : 'Énergie/s';
      const total = v * assignedAgents;
      return `<div class="tile-info-stat"><span>${label}</span><strong>+${formatRate(total)}</strong></div>`;
    }).join('');
    prodSection = `<div class="tile-info-stat"><span>Agents assignés</span><strong>${assignedAgents} / ${currentAgentCap()}</strong></div>${prodLines}<p class="tile-info-hint">Ajustez les Agents avec les boutons − / + directement sous le bâtiment sur la carte.</p>`;
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
    ${prodSection}
    ${upgradeSection}
  `;
}

export function updateTileInfoAffordability() {
  const buttons = els.tileInfoPanel.querySelectorAll('[data-action="upgrade"]');
  buttons.forEach((btn) => {
    const q = Number(btn.dataset.q);
    const r = Number(btn.dataset.r);
    btn.disabled = !canUpgradeBuilding(q, r);
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
