import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import {
  hashPassword, getAuthData, setAuthData, clearAuthData,
  getAdminSession, setAdminSession, updateActivity, isSessionExpired,
  getLockoutData, incrementLockoutAttempts, clearLockout, isLockedOut, getLockoutRemainingMs,
  MAX_PASSWORD_LENGTH,
} from '../utils/auth';
import { loadAuthData, saveAuthData, loadTournamentData } from '../utils/database';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isAdmin, setIsAdmin] = useState(() => {
    // Check if session exists and auth data exists
    const auth = getAuthData();
    if (!auth?.passwordHash) return false;
    return getAdminSession() && !isSessionExpired();
  });

  const [authData, setAuthDataState] = useState(() => getAuthData());
  const [lockout, setLockout] = useState(() => getLockoutData());
  const [authLoaded, setAuthLoaded] = useState(false);
  const [hasExistingTournament, setHasExistingTournament] = useState(false);
  const inactivityTimerRef = useRef(null);
  const onLogoutCallbackRef = useRef(null);
  // In-memory lockout ref to prevent bypass via clearing localStorage
  const lockoutRef = useRef(getLockoutData());

  // Whether first-time setup is needed (no password set yet AND no existing tournament)
  const needsSetup = !authData?.passwordHash && !hasExistingTournament;

  // ── Load auth on mount ───────────────
  // localStorage is primary auth store; Firestore is the sync backup.
  // On new devices (no localStorage), we recover auth from Firestore.
  useEffect(() => {
    let cancelled = false;
    async function loadAuth() {
      try {
        const localAuth = getAuthData();
        if (localAuth?.passwordHash) {
          // localStorage has auth — use it
          if (getAdminSession() && !isSessionExpired()) {
            setIsAdmin(true);
          }
          // Sync to Firestore as backup
          try {
            await saveAuthData(localAuth);
          } catch {
            // Firestore sync is best-effort
          }
        } else {
          // No local auth — try to recover from Firestore (new device scenario)
          try {
            const firestoreAuth = await loadAuthData();
            if (!cancelled && firestoreAuth?.passwordHash) {
              // Found auth in Firestore — sync to localStorage
              setAuthData(firestoreAuth);
              setAuthDataState(firestoreAuth);
              return; // auth recovered, no need to check tournament
            }
          } catch {
            // Firestore auth load failed — fall through to tournament check
          }

          // No auth anywhere — check if tournament data exists
          try {
            const tournamentData = await loadTournamentData();
            if (!cancelled && tournamentData && (tournamentData.teams?.length > 0 || tournamentData.games?.length > 0)) {
              setHasExistingTournament(true);
            }
          } catch {
            // Ignore — tournament check is best-effort
          }
        }
      } catch {
        // Fall back to localStorage auth (already loaded in useState init)
      } finally {
        if (!cancelled) setAuthLoaded(true);
      }
    }
    loadAuth();
    return () => { cancelled = true; };
  }, []);

  // Refresh lockout state periodically when locked
  useEffect(() => {
    if (!lockout.lockedUntil) return;
    const interval = setInterval(() => {
      const remaining = getLockoutRemainingMs();
      if (remaining <= 0) {
        clearLockout();
        setLockout({ attempts: 0, lockedUntil: null });
      } else {
        setLockout(prev => ({ ...prev })); // trigger re-render for countdown
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockout.lockedUntil]);

  // Inactivity timeout
  useEffect(() => {
    if (!isAdmin) {
      if (inactivityTimerRef.current) clearInterval(inactivityTimerRef.current);
      return;
    }

    updateActivity();

    function handleActivity() {
      updateActivity();
    }

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, handleActivity));

    inactivityTimerRef.current = setInterval(() => {
      if (isSessionExpired()) {
        logout('Session expired due to inactivity');
      }
    }, 30000); // check every 30 seconds

    return () => {
      events.forEach(e => window.removeEventListener(e, handleActivity));
      if (inactivityTimerRef.current) clearInterval(inactivityTimerRef.current);
    };
  }, [isAdmin]);

  const login = useCallback(async (password) => {
    // Check BOTH localStorage AND React state for lockout (defense-in-depth)
    if (isLockedOut() || (lockoutRef.current.lockedUntil && Date.now() < lockoutRef.current.lockedUntil)) {
      return { success: false, error: 'Account locked. Try again later.', locked: true };
    }

    // Cap password length to prevent DoS
    if (!password || typeof password !== 'string' || password.length > MAX_PASSWORD_LENGTH) {
      return { success: false, error: 'Invalid password' };
    }

    const auth = getAuthData();
    if (!auth?.passwordHash) {
      return { success: false, error: 'No password set' };
    }

    const hash = await hashPassword(password);
    if (hash === auth.passwordHash) {
      clearLockout();
      setLockout({ attempts: 0, lockedUntil: null });
      lockoutRef.current = { attempts: 0, lockedUntil: null };
      setAdminSession(true);
      updateActivity();
      setIsAdmin(true);
      return { success: true };
    }

    const lockData = incrementLockoutAttempts();
    setLockout(lockData);
    lockoutRef.current = lockData;
    const remaining = 5 - lockData.attempts;
    if (lockData.lockedUntil) {
      return { success: false, error: 'Too many attempts. Locked for 5 minutes.', locked: true };
    }
    return { success: false, error: `Incorrect password. ${remaining > 0 ? remaining + ' attempts remaining.' : ''}` };
  }, []);

  const logout = useCallback((reason) => {
    setAdminSession(false);
    setIsAdmin(false);
    if (reason && onLogoutCallbackRef.current) {
      onLogoutCallbackRef.current(reason);
    }
  }, []);

  const setupPassword = useCallback(async (password, recoveryKeyHash) => {
    const pwHash = await hashPassword(password);
    const data = { passwordHash: pwHash, recoveryKeyHash };
    // Save to localStorage
    setAuthData(data);
    setAuthDataState(data);
    // Save to Firestore
    try { await saveAuthData(data); } catch { /* best-effort Firestore sync */ }
    setAdminSession(true);
    updateActivity();
    setIsAdmin(true);
  }, []);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    const auth = getAuthData();
    if (!auth?.passwordHash) return { success: false, error: 'No password set' };

    const currentHash = await hashPassword(currentPassword);
    if (currentHash !== auth.passwordHash) {
      return { success: false, error: 'Current password is incorrect' };
    }

    const newHash = await hashPassword(newPassword);
    const updated = { ...auth, passwordHash: newHash };
    setAuthData(updated);
    setAuthDataState(updated);
    try { await saveAuthData(updated); } catch { /* best-effort */ }
    return { success: true };
  }, []);

  // Recovery key has its own rate limiting via the same lockout mechanism
  const recoverPassword = useCallback(async (recoveryKey, newPassword) => {
    // Rate limit recovery attempts using the same lockout
    if (isLockedOut() || (lockoutRef.current.lockedUntil && Date.now() < lockoutRef.current.lockedUntil)) {
      return { success: false, error: 'Too many attempts. Try again later.', locked: true };
    }

    const auth = getAuthData();
    if (!auth?.recoveryKeyHash) return { success: false, error: 'No recovery key configured' };

    const keyHash = await hashPassword(recoveryKey.replace(/-/g, '').toUpperCase());
    if (keyHash !== auth.recoveryKeyHash) {
      // Increment lockout on failed recovery attempt
      const lockData = incrementLockoutAttempts();
      setLockout(lockData);
      lockoutRef.current = lockData;
      if (lockData.lockedUntil) {
        return { success: false, error: 'Too many attempts. Locked for 5 minutes.', locked: true };
      }
      return { success: false, error: 'Invalid recovery key' };
    }

    const newHash = await hashPassword(newPassword);
    const updated = { ...auth, passwordHash: newHash };
    setAuthData(updated);
    setAuthDataState(updated);
    clearLockout();
    setLockout({ attempts: 0, lockedUntil: null });
    lockoutRef.current = { attempts: 0, lockedUntil: null };
    // Sync to Firestore (write-only)
    try { await saveAuthData(updated); } catch { /* best-effort */ }
    return { success: true };
  }, []);

  // Import auth data from tournament export
  const importAuth = useCallback((importedAuth) => {
    if (importedAuth?.passwordHash) {
      setAuthData(importedAuth);
      setAuthDataState(importedAuth);
      // Sync to Firestore
      saveAuthData(importedAuth).catch(() => {});
    }
  }, []);

  // Get auth data for export
  const getExportAuth = useCallback(() => {
    return getAuthData();
  }, []);

  const setOnLogoutCallback = useCallback((cb) => {
    onLogoutCallbackRef.current = cb;
  }, []);

  return (
    <AuthContext.Provider value={{
      isAdmin,
      needsSetup,
      hasExistingTournament,
      authData,
      authLoaded,
      lockout,
      login,
      logout,
      setupPassword,
      changePassword,
      recoverPassword,
      importAuth,
      getExportAuth,
      setOnLogoutCallback,
      getLockoutRemainingMs,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
