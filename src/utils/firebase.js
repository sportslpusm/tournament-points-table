// Firebase configuration and initialization
import { initializeApp } from 'firebase/app';
import {
  initializeFirestore,
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

// Use memory-only cache — no IndexedDB/localStorage caching
// Data always comes fresh from the server on each page load
let db = initializeFirestore(app, {
  localCache: memoryLocalCache(),
});

/**
 * Clear stale IndexedDB persistence and reinitialize Firestore.
 * Call this when encountering "resource-exhausted" or stuck writes.
 */
export async function clearAndReinit() {
  try {
    await terminate(db);
    await clearIndexedDbPersistence(db);
  } catch {
    // Clear failed — no issue since we use memory cache
  }
  db = initializeFirestore(app, {
    localCache: memoryLocalCache(),
  });
  return db;
}

export { db };
export default app;
