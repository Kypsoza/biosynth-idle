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

// Grappe de cercles superposés : base organique commune à toutes les icônes
function cellCluster(x, y, radius, grad, style) {
  return `<g class="hex-building-core" style="${style}">
    <circle cx="${(x - radius * 0.3).toFixed(1)}" cy="${(y - radius * 0.2).toFixed(1)}" r="${(radius * 0.55).toFixed(1)}" fill="${grad}" opacity="0.75"/>
    <circle cx="${(x + radius * 0.32).toFixed(1)}" cy="${(y + radius * 0.18).toFixed(1)}" r="${(radius * 0.42).toFixed(1)}" fill="${grad}" opacity="0.75"/>
    <circle cx="${x}" cy="${y}" r="${(radius * 0.68).toFixed(1)}" fill="${grad}"/>
  </g>`;
}

function buildingIconMarkup(type, x, y, radius, opacity = 1) {
  const grad = `url(#grad-${type})`;
  const color = BUILDING_TYPES[type].color;
  const style = `color:${color};opacity:${opacity}`;

  if (type === 'synapse') {
    // Cellule neuronale : cœur + dendrites bioluminescentes fines
    let dendrites = '';
    for (const angle of [30, 100, 190, 260, 320]) {
      const rad = (angle * Math.PI) / 180;
      const x2 = x + Math.cos(rad) * radius * 1.5;
      const y2 = y + Math.sin(rad) * radius * 1.5;
      const xm = x + Math.cos(rad) * radius * 0.9;
      const ym = y + Math.sin(rad) * radius * 0.9;
      dendrites += `<path d="M${x},${y} Q${xm.toFixed(1)},${ym.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}" stroke="${color}" stroke-width="1" opacity="0.55" fill="none"/><circle cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="1.4" fill="${color}" opacity="0.8"/>`;
    }
    return `<g style="${style}">${dendrites}${cellCluster(x, y, radius, grad, style)}</g>`;
  }
  if (type === 'incubateur') {
    // Cocon/gousse : cellule allongée avec petites spores autour
    let spores = '';
    for (const [dx, dy] of [[-0.8, -0.6], [0.9, -0.4], [-0.5, 0.9], [0.7, 0.7]]) {
      spores += `<circle cx="${(x + dx * radius).toFixed(1)}" cy="${(y + dy * radius).toFixed(1)}" r="${(radius * 0.16).toFixed(1)}" fill="${grad}" opacity="0.6"/>`;
    }
    return `<g class="hex-building-core" style="${style}">
      ${spores}
      <ellipse cx="${x}" cy="${y}" rx="${(radius * 0.65).toFixed(1)}" ry="${(radius * 0.85).toFixed(1)}" fill="${grad}"/>
    </g>`;
  }
  if (type === 'nexus') {
    // Fusion de plusieurs cellules reliées par de fines veines
    let veins = '';
    const satellites = [[0, -1], [0.95, 0.55], [-0.95, 0.55]];
    for (const [dx, dy] of satellites) {
      const nx = x + dx * radius * 1.2;
      const ny = y + dy * radius * 1.2;
      veins += `<line x1="${x}" y1="${y}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="${color}" stroke-width="1" opacity="0.5"/><circle cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="${(radius * 0.32).toFixed(1)}" fill="${grad}" opacity="0.85"/>`;
    }
    return `<g class="hex-building-core" style="${style}">${veins}<circle cx="${x}" cy="${y}" r="${(radius * 0.5).toFixed(1)}" fill="${grad}"/></g>`;
  }
  if (type === 'regulateur') {
    // Deux lobes reliés par un col étroit (régulation de flux)
    const off = radius * 0.55;
    return `<g class="hex-building-core" style="${style}">
      <line x1="${x}" y1="${(y - off).toFixed(1)}" x2="${x}" y2="${(y + off).toFixed(1)}" stroke="${color}" stroke-width="2.5" opacity="0.5"/>
      <circle cx="${x}" cy="${(y - off).toFixed(1)}" r="${(radius * 0.5).toFixed(1)}" fill="${grad}"/>
      <circle cx="${x}" cy="${(y + off).toFixed(1)}" r="${(radius * 0.5).toFixed(1)}" fill="${grad}"/>
    </g>`;
  }
  if (type === 'energie') {
    // Étincelle bioluminescente : petit cœur + courtes décharges
    let sparks = '';
    for (const angle of [20, 100, 200, 300]) {
      const rad = (angle * Math.PI) / 180;
      const x2 = x + Math.cos(rad) * radius * 1.2;
      const y2 = y + Math.sin(rad) * radius * 1.2;
      sparks += `<line x1="${x}" y1="${y}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="1.2" opacity="0.6"/>`;
    }
    return `<g class="hex-building-core" style="${style}">${sparks}<circle cx="${x}" cy="${y}" r="${(radius * 0.55).toFixed(1)}" fill="${grad}"/></g>`;
  }
  return cellCluster(x, y, radius, grad, style);
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
  const buildingColors = {};
  for (const [type, def] of Object.entries(BUILDING_TYPES)) buildingColors[type] = def.color;

  const gradientDefs = Object.entries(buildingColors).map(([type, color]) => `
    <radialGradient id="grad-${type}" cx="35%" cy="30%" r="75%">
      <stop offset="0%" stop-color="${shadeColor(color, 90)}"/>
      <stop offset="40%" stop-color="${color}"/>
      <stop offset="100%" stop-color="${shadeColor(color, -85)}"/>
    </radialGradient>
  `).join('');

  return `
    <defs>
      ${gradientDefs}
      <radialGradient id="noyauGrad" cx="35%" cy="30%" r="75%">
        <stop offset="0%" stop-color="#FFFFFF"/>
        <stop offset="35%" stop-color="#00F0D8"/>
        <stop offset="75%" stop-color="#0A8A80"/>
        <stop offset="100%" stop-color="#06070C"/>
      </radialGradient>
      <radialGradient id="noyauHalo" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#00F0D8" stop-opacity="0.85"/>
        <stop offset="100%" stop-color="#00F0D8" stop-opacity="0"/>
      </radialGradient>
      <pattern id="veinPattern" patternUnits="userSpaceOnUse" width="60" height="60">
        <path d="M4,30 Q18,14 30,30 T56,30" stroke="#00F0D8" stroke-width="1" opacity="0.3" fill="none"/>
        <path d="M30,4 Q42,18 30,30 Q18,42 30,56" stroke="#7CFF3C" stroke-width="0.8" opacity="0.25" fill="none"/>
        <circle cx="30" cy="30" r="1.8" fill="#00F0D8" opacity="0.45"/>
        <circle cx="4" cy="30" r="1.1" fill="#00F0D8" opacity="0.3"/>
        <circle cx="56" cy="30" r="1.1" fill="#7CFF3C" opacity="0.3"/>
      </pattern>
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
      inner += `<circle class="hex-noyau-halo" cx="${x}" cy="${y}" r="32" fill="url(#noyauHalo)"></circle>`;
      inner += `<g class="hex-noyau-heart">
        <circle cx="${(x - 6).toFixed(1)}" cy="${(y - 5).toFixed(1)}" r="13" fill="url(#noyauGrad)" opacity="0.85"/>
        <circle cx="${(x + 7).toFixed(1)}" cy="${(y + 4).toFixed(1)}" r="11" fill="url(#noyauGrad)" opacity="0.85"/>
        <circle cx="${x}" cy="${y}" r="16" fill="url(#noyauGrad)"/>
      </g>`;
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
          <rect x="${x - barW / 2}" y="${y + 20}" width="${barW}" height="6" rx="3" fill="var(--color-bg)" stroke="var(--color-border)"></rect>
          <rect data-progress-for="${key}" x="${x - barW / 2}" y="${y + 20}" width="${(barW * pct).toFixed(1)}" height="6" rx="3" fill="var(--color-green)"></rect>
          <text class="hex-tile-level-badge" x="${x}" y="${y + 38}" text-anchor="middle">Croissance…</text>
        `;
      } else {
        // built
        const { level, assignedAgents } = tile.building;
        const tier = visualTier(level);
        classes.push(`hex-tile--tier-${tier}`);
        const radius = 8 + tier * 2.5;
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
      // Case purement décorative (tissu vivant en arrière-plan)
      classes.push('hex-tile--decor');
      inner += `<polygon class="hex-tile-vein-overlay" points="${hexCorners(x, y)}" fill="url(#veinPattern)"></polygon>`;
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
