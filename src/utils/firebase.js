// Firebase configuration and initialization
import { initializeApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  terminate,
  clearIndexedDbPersistence,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAms3WpTGpXjZO9N3U_wbJeYiA8bXBGdtY",
  authDomain: "tournament-points-table.firebaseapp.com",
  projectId: "tournament-points-table",
  storageBucket: "tournament-points-table.firebasestorage.app",
  messagingSenderId: "705146517748",
  appId: "1:705146517748:web:3b87cfad9938ce69efc6a1",
  measurementId: "G-LV3M0VHMBC"
};

const app = initializeApp(firebaseConfig);

// Use persistent cache with multi-tab support
// If the cache has stale/broken writes, clearAndReinit() below will fix it
let db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

/**
 * Clear stale IndexedDB persistence and reinitialize Firestore.
 * Call this when encountering "resource-exhausted" or stuck writes.
 */
export async function clearAndReinit() {
  try {
    await terminate(db);
    await clearIndexedDbPersistence(db);
    // Cleared stale Firestore cache
  } catch (err) {
    // Failed to clear persistence — falling back to memory cache
  }
  // Reinitialize — try persistent first, fall back to memory
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    db = initializeFirestore(app, {
      localCache: memoryLocalCache(),
    });
  }
  return db;
}

export { db };
export default app;
