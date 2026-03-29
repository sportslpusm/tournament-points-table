// Backup utility — automatic state snapshots stored in Firestore
// Keeps last 10 backups, auto-prunes older ones
import { db } from './firebase';
import {
  collection, addDoc, query, orderBy, limit, getDocs,
  deleteDoc, doc, serverTimestamp, getDoc,
} from 'firebase/firestore';

const BACKUP_COLLECTION = 'backups';
const MAX_BACKUPS = 10;

/**
 * Create a backup snapshot of the current tournament state.
 * @param {object} state - full tournament state to snapshot
 * @param {string} reason - why the backup was created (e.g., 'auto', 'pre-delete', 'manual')
 * @returns {Promise<string|null>} - backup document ID, or null on failure
 */
export async function createBackup(state, reason = 'auto') {
  try {
    // Strip transient UI fields — only save data fields
    const dataToBackup = {
      tournament: state.tournament,
      teams: state.teams || [],
      games: state.games || [],
      pools: state.pools || [],
      matches: state.matches || [],
      knockoutConfig: state.knockoutConfig || {},
      knockoutMatches: state.knockoutMatches || [],
      qualifiedTeams: state.qualifiedTeams || {},
      athletes: state.athletes || [],
      categories: state.categories || [],
      individualResults: state.individualResults || [],
      individualPointsConfig: state.individualPointsConfig || {},
      lobbyEntries: state.lobbyEntries || [],
      lobbyResults: state.lobbyResults || [],
      lobbyPointsConfig: state.lobbyPointsConfig || {},
      lobbyGameStatus: state.lobbyGameStatus || {},
      individualGameStatus: state.individualGameStatus || {},
    };

    // Check approximate size — Firestore doc limit is 1MB
    const sizeEstimate = JSON.stringify(dataToBackup).length;
    if (sizeEstimate > 900_000) {
      // Too large to backup as single doc — skip silently
      return null;
    }

    const col = collection(db, BACKUP_COLLECTION);
    const docRef = await addDoc(col, {
      timestamp: serverTimestamp(),
      reason,
      sizeBytes: sizeEstimate,
      teamCount: (state.teams || []).length,
      gameCount: (state.games || []).length,
      matchCount: (state.matches || []).length,
      data: dataToBackup,
    });

    // Prune old backups (fire-and-forget)
    pruneOldBackups().catch(() => {});

    return docRef.id;
  } catch (err) {
    // Backup creation failed silently — don't block the save
    return null;
  }
}

/**
 * Keep only the most recent MAX_BACKUPS. Delete older ones.
 */
async function pruneOldBackups() {
  const col = collection(db, BACKUP_COLLECTION);
  const q = query(col, orderBy('timestamp', 'desc'));
  const snap = await getDocs(q);

  if (snap.size <= MAX_BACKUPS) return;

  const toDelete = snap.docs.slice(MAX_BACKUPS);
  const promises = toDelete.map(d => deleteDoc(doc(db, BACKUP_COLLECTION, d.id)).catch(() => {}));
  await Promise.allSettled(promises);
}

/**
 * Fetch list of available backups (metadata only, no data field).
 * @returns {Promise<Array>} - sorted newest-first
 */
export async function listBackups() {
  const col = collection(db, BACKUP_COLLECTION);
  const q = query(col, orderBy('timestamp', 'desc'), limit(MAX_BACKUPS));
  const snap = await getDocs(q);
  return snap.docs.map(d => {
    const { data, ...meta } = d.data();
    return {
      id: d.id,
      ...meta,
      timestamp: meta.timestamp?.toDate?.() || null,
    };
  });
}

/**
 * Load a specific backup's full data for restore.
 * @param {string} backupId - Firestore document ID
 * @returns {Promise<object|null>} - the backup data, or null
 */
export async function loadBackup(backupId) {
  try {
    const snap = await getDoc(doc(db, BACKUP_COLLECTION, backupId));
    if (!snap.exists()) return null;
    return snap.data().data || null;
  } catch {
    return null;
  }
}

/**
 * Delete a specific backup.
 * @param {string} backupId
 */
export async function deleteBackup(backupId) {
  await deleteDoc(doc(db, BACKUP_COLLECTION, backupId));
}
