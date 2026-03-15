// Firestore database service — persistence layer for tournament data
import { db, clearAndReinit } from './firebase';
import {
  doc, getDoc, setDoc, onSnapshot,
  collection, getDocs, writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { compressImage } from './imageCompression';

const TOURNAMENT_DOC = 'tournaments/main';
const AUTH_DOC = 'config/auth';
const LOGOS_COLLECTION = 'logos';

// ── Get current db reference (may change after reinit) ───
let currentDb = db;

function getDb() {
  return currentDb;
}

// ── Progress reporting ───────────────────────────────────
let progressCallback = null;

export function onSaveProgress(callback) {
  progressCallback = callback;
}

function reportProgress(info) {
  progressCallback?.(info);
}

// ── Resource-exhausted recovery ──────────────────────────
let hasRecovered = false;

async function recoverIfNeeded(err) {
  if (hasRecovered) return false;
  if (err?.code === 'resource-exhausted' || err?.message?.includes('resource-exhausted')) {
    console.warn('Detected stale write queue. Clearing Firestore cache...');
    hasRecovered = true;
    try {
      currentDb = await clearAndReinit();
      // Cache cleared, retrying
      return true; // signal caller to retry
    } catch (reinitErr) {
      console.error('Recovery failed:', reinitErr);
      return false;
    }
  }
  return false;
}

// ── Logo helpers ─────────────────────────────────────────

async function ensureCompressed(dataUrl) {
  if (!dataUrl) return dataUrl;
  if (dataUrl.length < 500_000) return dataUrl;
  try {
    return await compressImage(dataUrl, 200, 200, 0.7);
  } catch {
    return dataUrl;
  }
}

function extractLogos(state) {
  const logos = [];

  if (state.tournament?.logo) {
    logos.push({ id: 'tournament', data: state.tournament.logo });
  }

  if (state.teams) {
    for (const team of state.teams) {
      if (team.logo) {
        logos.push({ id: team.id, data: team.logo });
      }
    }
  }

  const strippedState = {
    ...state,
    tournament: { ...state.tournament, logo: null },
    teams: (state.teams || []).map(t => ({ ...t, logo: null })),
  };

  return { strippedState, logos };
}

function mergeLogos(data, logosMap) {
  if (!data) return data;
  const merged = { ...data };

  if (logosMap.has('tournament')) {
    merged.tournament = { ...merged.tournament, logo: logosMap.get('tournament') };
  }

  if (merged.teams) {
    merged.teams = merged.teams.map(t => {
      if (logosMap.has(t.id)) {
        return { ...t, logo: logosMap.get(t.id) };
      }
      return t;
    });
  }

  return merged;
}

// Track which logos were last saved to avoid redundant writes
let savedLogoHashes = new Map();

function simpleHash(str) {
  if (!str) return '';
  return str.length + ':' + str.slice(0, 50) + str.slice(-50);
}

/**
 * Save logos individually with progress reporting.
 */
async function saveLogos(logos, teamNameMap) {
  if (logos.length === 0) return;

  // Filter to only logos that changed
  const toSave = logos.filter(logo => {
    const hash = simpleHash(logo.data);
    return savedLogoHashes.get(logo.id) !== hash;
  });

  if (toSave.length === 0) {
    reportProgress({ phase: 'logos', current: 0, total: 0, done: true, skipped: true });
    return;
  }

  const total = toSave.length;
  let completed = 0;
  let totalBytesUploaded = 0;
  const startTime = Date.now();

  for (const logo of toSave) {
    const name = logo.id === 'tournament' ? 'Tournament Logo' : (teamNameMap.get(logo.id) || logo.id);

    reportProgress({
      phase: 'logos',
      current: completed,
      total,
      currentName: name,
      speed: null,
      percent: Math.round((completed / total) * 100),
    });

    try {
      const compressed = await ensureCompressed(logo.data);
      const sizeBytes = compressed.length;

      await setDoc(doc(getDb(), LOGOS_COLLECTION, logo.id), {
        data: compressed,
        _updatedAt: serverTimestamp(),
      });

      const hash = simpleHash(logo.data);
      savedLogoHashes.set(logo.id, hash);
      completed++;
      totalBytesUploaded += sizeBytes;

      // Calculate speed
      const elapsedSec = (Date.now() - startTime) / 1000;
      let speedText = null;
      if (elapsedSec > 0.5) {
        const kbps = Math.round(totalBytesUploaded / 1024 / elapsedSec);
        speedText = kbps >= 1024 ? `${(kbps / 1024).toFixed(1)} MB/s` : `${kbps} KB/s`;
      }

      reportProgress({
        phase: 'logos',
        current: completed,
        total,
        currentName: completed < total ? name : null,
        speed: speedText,
        percent: Math.round((completed / total) * 100),
        done: completed === total,
      });
    } catch (err) {
      console.warn(`Failed to save logo ${logo.id}:`, err.message);
      // Try recovery on first resource-exhausted error
      const recovered = await recoverIfNeeded(err);
      if (recovered) {
        // Retry this logo
        try {
          const compressed = await ensureCompressed(logo.data);
          await setDoc(doc(getDb(), LOGOS_COLLECTION, logo.id), {
            data: compressed,
            _updatedAt: serverTimestamp(),
          });
          savedLogoHashes.set(logo.id, simpleHash(logo.data));
          totalBytesUploaded += compressed.length;
        } catch {
          // Still failed after recovery
        }
      }
      completed++;
      reportProgress({
        phase: 'logos',
        current: completed,
        total,
        currentName: `${name} (retry)`,
        speed: null,
        percent: Math.round((completed / total) * 100),
      });
    }
  }
}

async function loadLogos() {
  try {
    const snap = await getDocs(collection(getDb(), LOGOS_COLLECTION));
    const logosMap = new Map();
    snap.forEach(d => {
      const data = d.data();
      if (data.data) {
        logosMap.set(d.id, data.data);
        savedLogoHashes.set(d.id, simpleHash(data.data));
      }
    });
    return logosMap;
  } catch (err) {
    console.warn('Failed to load logos:', err);
    return new Map();
  }
}

async function deleteOrphanLogos(currentTeamIds, hasTournamentLogo) {
  try {
    const snap = await getDocs(collection(getDb(), LOGOS_COLLECTION));
    const validIds = new Set(currentTeamIds);
    if (hasTournamentLogo) validIds.add('tournament');

    const batch = writeBatch(getDb());
    let deletions = 0;
    snap.forEach(d => {
      if (!validIds.has(d.id)) {
        batch.delete(doc(getDb(), LOGOS_COLLECTION, d.id));
        savedLogoHashes.delete(d.id);
        deletions++;
      }
    });
    if (deletions > 0) await batch.commit();
  } catch (err) {
    console.warn('Failed to clean up orphan logos:', err);
  }
}

// ── Tournament Data ─────────────────────────────────────────

export async function loadTournamentData() {
  try {
    const [snap, logosMap] = await Promise.all([
      getDoc(doc(getDb(), TOURNAMENT_DOC)),
      loadLogos(),
    ]);

    if (snap.exists()) {
      const data = snap.data();
      const { _updatedAt, ...tournamentData } = data;
      return mergeLogos(tournamentData, logosMap);
    }
    return null;
  } catch (err) {
    console.error('Failed to load tournament data:', err);
    throw err;
  }
}

async function doSave(state) {
  const { strippedState, logos } = extractLogos(state);
  const teamNameMap = new Map();
  (state.teams || []).forEach(t => teamNameMap.set(t.id, t.shortCode || t.name));

  const totalSteps = 1 + logos.filter(l => savedLogoHashes.get(l.id) !== simpleHash(l.data)).length;

  // Phase 1: Save main document
  reportProgress({
    phase: 'data',
    current: 0,
    total: totalSteps,
    currentName: 'Saving tournament data...',
    percent: 0,
  });

  const dataToSave = {
    tournament: strippedState.tournament,
    teams: strippedState.teams,
    games: state.games,
    pools: state.pools,
    matches: state.matches,
    knockoutConfig: state.knockoutConfig || {},
    knockoutMatches: state.knockoutMatches || [],
    qualifiedTeams: state.qualifiedTeams || {},
    athletes: state.athletes || [],
    categories: state.categories || [],
    individualResults: state.individualResults || [],
    individualPointsConfig: state.individualPointsConfig || {},
    _updatedAt: serverTimestamp(),
  };

  await setDoc(doc(getDb(), TOURNAMENT_DOC), dataToSave);

  reportProgress({
    phase: 'data',
    current: 1,
    total: totalSteps,
    currentName: 'Data saved',
    percent: Math.round((1 / totalSteps) * 100),
  });

  // Phase 2: Save logos with per-logo progress
  await saveLogos(logos, teamNameMap);

  // Phase 3: Clean up orphan logos (fire-and-forget)
  const teamIds = (state.teams || []).map(t => t.id);
  deleteOrphanLogos(teamIds, !!state.tournament?.logo).catch(() => {});

  reportProgress({ phase: 'complete' });
}

export async function saveTournamentData(state) {
  try {
    await doSave(state);
    return true;
  } catch (err) {
    // If resource-exhausted, try recovery and retry once
    const recovered = await recoverIfNeeded(err);
    if (recovered) {
      try {
        await doSave(state);
        return true;
      } catch (retryErr) {
        console.error('Save failed after recovery:', retryErr);
        throw retryErr;
      }
    }
    console.error('Failed to save tournament data:', err);
    throw err;
  }
}

export function subscribeToChanges(callback) {
  let cachedLogos = new Map();

  loadLogos().then(m => { cachedLogos = m; }).catch(() => {});

  const unsubMain = onSnapshot(
    doc(getDb(), TOURNAMENT_DOC),
    { includeMetadataChanges: true },
    (snap) => {
      if (!snap.exists()) return;
      if (snap.metadata.hasPendingWrites) return;

      const data = snap.data();
      const { _updatedAt, ...tournamentData } = data;
      lastMainData = tournamentData;
      const merged = mergeLogos(tournamentData, cachedLogos);
      callback(merged, {
        fromCache: snap.metadata.fromCache,
        hasPendingWrites: snap.metadata.hasPendingWrites,
      });
    },
    (err) => {
      console.error('Firestore listener error:', err);
    }
  );

  // Keep a cached copy of the last main doc data so we can re-merge when logos change
  let lastMainData = null;

  const unsubLogos = onSnapshot(
    collection(getDb(), LOGOS_COLLECTION),
    { includeMetadataChanges: true },
    (snap) => {
      if (snap.metadata.hasPendingWrites) return;

      let changed = false;
      snap.forEach(d => {
        const data = d.data();
        if (data.data) {
          if (cachedLogos.get(d.id) !== data.data) changed = true;
          cachedLogos.set(d.id, data.data);
        }
      });
      const currentIds = new Set(snap.docs.map(d => d.id));
      for (const key of cachedLogos.keys()) {
        if (!currentIds.has(key)) {
          cachedLogos.delete(key);
          changed = true;
        }
      }

      // Re-notify with updated logos if we have main data cached
      if (changed && lastMainData) {
        const merged = mergeLogos(lastMainData, cachedLogos);
        callback(merged, { fromCache: snap.metadata.fromCache, hasPendingWrites: false });
      }
    },
    (err) => {
      console.warn('Logos listener error:', err);
    }
  );

  return () => {
    unsubMain();
    unsubLogos();
  };
}

// ── Auth Data ───────────────────────────────────────────────

export async function loadAuthData() {
  try {
    const snap = await getDoc(doc(getDb(), AUTH_DOC));
    if (snap.exists()) return snap.data();
    return null;
  } catch (err) {
    console.error('Failed to load auth data:', err);
    throw err;
  }
}

export async function saveAuthData(authData) {
  try {
    await setDoc(doc(getDb(), AUTH_DOC), {
      ...authData,
      _updatedAt: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.error('Failed to save auth data:', err);
    throw err;
  }
}

// ── Debounced Save ──────────────────────────────────────────

let saveTimer = null;
let pendingSave = null;
let saveCallbacks = { onSaving: null, onSaved: null, onError: null };
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 3;

export function configureSaveCallbacks(callbacks) {
  saveCallbacks = { ...saveCallbacks, ...callbacks };
}

export function debouncedSave(state) {
  if (saveTimer) clearTimeout(saveTimer);

  const delay = consecutiveErrors >= MAX_CONSECUTIVE_ERRORS ? 10000 : 1500;

  return new Promise((resolve, reject) => {
    pendingSave = { state, resolve, reject };

    saveTimer = setTimeout(async () => {
      const { state: s, resolve: res, reject: rej } = pendingSave;
      pendingSave = null;
      saveTimer = null;

      try {
        saveCallbacks.onSaving?.();
        await saveTournamentData(s);
        consecutiveErrors = 0;
        saveCallbacks.onSaved?.();
        res(true);
      } catch (err) {
        consecutiveErrors++;
        saveCallbacks.onError?.(err);
        rej(err);
      }
    }, delay);
  });
}

export async function forceSave(state) {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
    pendingSave = null;
  }
  try {
    saveCallbacks.onSaving?.();
    await saveTournamentData(state);
    consecutiveErrors = 0;
    saveCallbacks.onSaved?.();
    return true;
  } catch (err) {
    consecutiveErrors++;
    saveCallbacks.onError?.(err);
    throw err;
  }
}

export function hasPendingSave() {
  return pendingSave !== null || saveTimer !== null;
}

// ── Connection Status ───────────────────────────────────────

let onlineListeners = [];

export function onConnectionChange(callback) {
  onlineListeners.push(callback);

  const handleOnline = () => onlineListeners.forEach(cb => cb(true));
  const handleOffline = () => onlineListeners.forEach(cb => cb(false));

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    onlineListeners = onlineListeners.filter(cb => cb !== callback);
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
