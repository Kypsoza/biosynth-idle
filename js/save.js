// ============================================
// save.js — Sauvegarde locale + export/import
// ============================================

import { gameState, SAVE_VERSION, resetState } from './state.js';

const STORAGE_KEY = 'biosynth-idle-save';
const AUTOSAVE_INTERVAL_MS = 30000;

export function saveGame() {
  gameState.lastSaveTimestamp = Date.now();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
    return true;
  } catch (err) {
    console.error('Échec de la sauvegarde :', err);
    return false;
  }
}

// Fusion profonde : préserve les valeurs par défaut de gameState pour tout champ absent
// de l'ancienne sauvegarde (évite les crashs quand le schéma évolue entre deux versions)
function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = target[key];
    const bothAreObjects =
      sourceVal && typeof sourceVal === 'object' && !Array.isArray(sourceVal) &&
      targetVal && typeof targetVal === 'object' && !Array.isArray(targetVal);
    if (bothAreObjects) {
      deepMerge(targetVal, sourceVal);
    } else {
      target[key] = sourceVal;
    }
  }
  return target;
}

export function loadGame() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;

  try {
    const parsed = JSON.parse(raw);
    if (parsed.version !== SAVE_VERSION) {
      console.warn('Version de sauvegarde différente, fusion avec les valeurs par défaut actuelles.');
    }
    deepMerge(gameState, parsed);
    return true;
  } catch (err) {
    console.error('Sauvegarde corrompue, impossible de charger :', err);
    return false;
  }
}

export function exportSave() {
  const json = JSON.stringify(gameState);
  // encodeURIComponent gère les caractères spéciaux avant le passage en Base64
  return btoa(encodeURIComponent(json));
}

export function importSave(base64String) {
  try {
    const json = decodeURIComponent(atob(base64String.trim()));
    const parsed = JSON.parse(json);
    deepMerge(gameState, parsed);
    saveGame();
    return true;
  } catch (err) {
    console.error('Chaîne d\'import invalide :', err);
    return false;
  }
}

export function hardReset() {
  localStorage.removeItem(STORAGE_KEY);
  resetState();
}

export function startAutosave(onSave) {
  setInterval(() => {
    const ok = saveGame();
    if (onSave) onSave(ok);
  }, AUTOSAVE_INTERVAL_MS);
}
