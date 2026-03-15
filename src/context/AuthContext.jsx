import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import {
  hashPassword, getAuthData, setAuthData, clearAuthData,
  getAdminSession, setAdminSession, updateActivity, isSessionExpired,
  getLockoutData, incrementLockoutAttempts, clearLockout, isLockedOut, getLockoutRemainingMs,
  MAX_PASSWORD_LENGTH,
} from '../utils/auth';

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
  const inactivityTimerRef = useRef(null);
  const onLogoutCallbackRef = useRef(null);
  // In-memory lockout ref to prevent bypass via clearing localStorage
  const lockoutRef = useRef(getLockoutData());

  // Whether first-time setup is needed (no password set yet)
  const needsSetup = !authData?.passwordHash;

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
    // Even if user clears localStorage, React state retains the lockout
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
    lockoutRef.current = lockData; // Also store in ref for bypass resistance
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
    setAuthData(data);
    setAuthDataState(data);
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
    return { success: true };
  }, []);

  const recoverPassword = useCallback(async (recoveryKey, newPassword) => {
    const auth = getAuthData();
    if (!auth?.recoveryKeyHash) return { success: false, error: 'No recovery key configured' };

    const keyHash = await hashPassword(recoveryKey.replace(/-/g, '').toUpperCase());
    if (keyHash !== auth.recoveryKeyHash) {
      return { success: false, error: 'Invalid recovery key' };
    }

    const newHash = await hashPassword(newPassword);
    const updated = { ...auth, passwordHash: newHash };
    setAuthData(updated);
    setAuthDataState(updated);
    clearLockout();
    setLockout({ attempts: 0, lockedUntil: null });
    return { success: true };
  }, []);

  // Import auth data from tournament export
  const importAuth = useCallback((importedAuth) => {
    if (importedAuth?.passwordHash) {
      setAuthData(importedAuth);
      setAuthDataState(importedAuth);
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
      authData,
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
