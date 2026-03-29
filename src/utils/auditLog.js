// Audit log — tracks admin changes to tournament data
// Writes immutable log entries to Firestore 'auditLog' collection
import { db } from './firebase';
import {
  collection, addDoc, query, orderBy, limit, getDocs, serverTimestamp,
} from 'firebase/firestore';

const AUDIT_COLLECTION = 'auditLog';
const MAX_LOG_ENTRIES = 200;

// ── Diff engine ─────────────────────────────────────────────

function describeArrayChanges(label, oldArr, newArr, nameKey = 'name') {
  const changes = [];
  const oldMap = new Map((oldArr || []).map(i => [i.id, i]));
  const newMap = new Map((newArr || []).map(i => [i.id, i]));

  // Added
  for (const [id, item] of newMap) {
    if (!oldMap.has(id)) {
      changes.push({ action: `Added ${label}: ${item[nameKey] || item.id}`, type: 'add' });
    }
  }

  // Removed
  for (const [id, item] of oldMap) {
    if (!newMap.has(id)) {
      changes.push({
        action: `Deleted ${label}: ${item[nameKey] || item.id}`,
        type: 'delete',
        deletedItem: item,
      });
    }
  }

  // Modified — shallow check on JSON
  for (const [id, newItem] of newMap) {
    const oldItem = oldMap.get(id);
    if (oldItem && JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
      changes.push({ action: `Updated ${label}: ${newItem[nameKey] || id}`, type: 'update' });
    }
  }

  return changes;
}

function describeObjectChanges(label, oldObj, newObj) {
  if (JSON.stringify(oldObj || {}) === JSON.stringify(newObj || {})) return [];
  return [{ action: `Updated ${label}`, type: 'update' }];
}

/**
 * Compute human-readable diffs between old and new tournament state.
 * Returns array of { action, category, type, deletedItem? }
 */
export function computeDiff(oldState, newState) {
  if (!oldState || !newState) return [];

  const diffs = [];

  // Tournament info
  if (JSON.stringify(oldState.tournament) !== JSON.stringify(newState.tournament)) {
    diffs.push({ action: 'Updated tournament info', category: 'setting', type: 'update' });
  }

  // Teams
  diffs.push(...describeArrayChanges('team', oldState.teams, newState.teams).map(d => ({ ...d, category: 'team' })));

  // Games
  diffs.push(...describeArrayChanges('game', oldState.games, newState.games).map(d => ({ ...d, category: 'game' })));

  // Pools
  diffs.push(...describeArrayChanges('pool', oldState.pools, newState.pools).map(d => ({ ...d, category: 'game' })));

  // Matches
  const matchChanges = describeArrayChanges('match', oldState.matches, newState.matches, 'id');
  // Enrich match descriptions with team names
  for (const mc of matchChanges) {
    diffs.push({ ...mc, category: 'match' });
  }

  // Knockout matches
  diffs.push(...describeArrayChanges('knockout match', oldState.knockoutMatches, newState.knockoutMatches, 'id').map(d => ({ ...d, category: 'knockout' })));

  // Athletes
  diffs.push(...describeArrayChanges('athlete', oldState.athletes, newState.athletes).map(d => ({ ...d, category: 'individual' })));

  // Categories
  diffs.push(...describeArrayChanges('category', oldState.categories, newState.categories).map(d => ({ ...d, category: 'individual' })));

  // Individual results
  diffs.push(...describeArrayChanges('result', oldState.individualResults, newState.individualResults, 'id').map(d => ({ ...d, category: 'individual' })));

  // Lobby entries
  diffs.push(...describeArrayChanges('lobby entry', oldState.lobbyEntries, newState.lobbyEntries).map(d => ({ ...d, category: 'lobby' })));

  // Lobby results
  diffs.push(...describeArrayChanges('lobby result', oldState.lobbyResults, newState.lobbyResults, 'id').map(d => ({ ...d, category: 'lobby' })));

  // Config objects
  diffs.push(...describeObjectChanges('knockout config', oldState.knockoutConfig, newState.knockoutConfig).map(d => ({ ...d, category: 'knockout' })));
  diffs.push(...describeObjectChanges('qualified teams', oldState.qualifiedTeams, newState.qualifiedTeams).map(d => ({ ...d, category: 'knockout' })));
  diffs.push(...describeObjectChanges('individual points config', oldState.individualPointsConfig, newState.individualPointsConfig).map(d => ({ ...d, category: 'individual' })));
  diffs.push(...describeObjectChanges('lobby points config', oldState.lobbyPointsConfig, newState.lobbyPointsConfig).map(d => ({ ...d, category: 'lobby' })));
  diffs.push(...describeObjectChanges('lobby game status', oldState.lobbyGameStatus, newState.lobbyGameStatus).map(d => ({ ...d, category: 'lobby' })));
  diffs.push(...describeObjectChanges('individual game status', oldState.individualGameStatus, newState.individualGameStatus).map(d => ({ ...d, category: 'individual' })));

  return diffs;
}

// ── Write to Firestore ──────────────────────────────────────

/**
 * Write audit log entries for all detected changes.
 * Fire-and-forget — errors are silently ignored to avoid blocking saves.
 */
export async function writeAuditEntries(diffs) {
  if (!diffs || diffs.length === 0) return;

  const col = collection(db, AUDIT_COLLECTION);

  // Batch up to 10 individual entries, or consolidate if too many
  const entriesToWrite = diffs.length <= 10
    ? diffs
    : [
        ...diffs.slice(0, 9),
        {
          action: `...and ${diffs.length - 9} more changes`,
          category: 'bulk',
          type: 'update',
        },
      ];

  const promises = entriesToWrite.map(entry =>
    addDoc(col, {
      timestamp: serverTimestamp(),
      action: (entry.action || '').slice(0, 500),
      category: (entry.category || 'unknown').slice(0, 50),
      changeType: entry.type || 'update',
      // Store deleted item data for undo (only for deletes, capped at 50KB)
      ...(entry.type === 'delete' && entry.deletedItem
        ? { deletedItem: JSON.stringify(entry.deletedItem).length <= 50000 ? entry.deletedItem : null }
        : {}),
    }).catch(() => {})
  );

  await Promise.allSettled(promises);
}

// ── Read audit log ──────────────────────────────────────────

/**
 * Fetch recent audit log entries.
 * @param {number} count - max entries to return (default 100)
 * @returns {Promise<Array>} - sorted newest-first
 */
export async function fetchAuditLog(count = 100) {
  const col = collection(db, AUDIT_COLLECTION);
  const q = query(col, orderBy('timestamp', 'desc'), limit(Math.min(count, MAX_LOG_ENTRIES)));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({
    id: d.id,
    ...d.data(),
    // Convert Firestore timestamp to JS Date
    timestamp: d.data().timestamp?.toDate?.() || null,
  }));
}
