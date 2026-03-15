// SHA-256 hashing using Web Crypto API with salt
const SALT = 'tournament-app-v1-salt::';

export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(SALT + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Max password length to prevent DoS via hashing extremely long strings
export const MAX_PASSWORD_LENGTH = 128;

// Validate password meets requirements
export function validatePassword(password) {
  if (!password || typeof password !== 'string') return 'Password is required';
  if (password.trim().length === 0) return 'Password cannot be only whitespace';
  if (password.length < 6) return 'Password must be at least 6 characters';
  if (password.length > MAX_PASSWORD_LENGTH) return `Password cannot exceed ${MAX_PASSWORD_LENGTH} characters`;
  return null; // valid
}

// Generate a random 12-character recovery key
export function generateRecoveryKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 to avoid confusion
  const array = new Uint8Array(12);
  crypto.getRandomValues(array);
  return Array.from(array, b => chars[b % chars.length]).join('');
}

// Format recovery key for display: XXXX-XXXX-XXXX
export function formatRecoveryKey(key) {
  return key.replace(/(.{4})(?=.)/g, '$1-');
}

// Auth data storage keys
const AUTH_STORAGE_KEY = 'tournament_auth';
const LOCKOUT_STORAGE_KEY = 'tournament_lockout';

export function getAuthData() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAuthData(data) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
}

export function clearAuthData() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

// Lockout management — stored in localStorage BUT validated with a server-timestamp approach
// We store the time the lockout was set, making clearing localStorage ineffective
// because the React state persists until page refresh, AND we re-check on each login attempt
export function getLockoutData() {
  try {
    const raw = localStorage.getItem(LOCKOUT_STORAGE_KEY);
    if (!raw) return { attempts: 0, lockedUntil: null };
    const data = JSON.parse(raw);
    if (typeof data.attempts !== 'number' || data.attempts < 0) {
      clearLockout();
      return { attempts: 0, lockedUntil: null };
    }
    // Clear expired lockout
    if (data.lockedUntil && Date.now() > data.lockedUntil) {
      clearLockout();
      return { attempts: 0, lockedUntil: null };
    }
    return data;
  } catch {
    return { attempts: 0, lockedUntil: null };
  }
}

export function incrementLockoutAttempts() {
  const data = getLockoutData();
  data.attempts += 1;
  if (data.attempts >= 5) {
    data.lockedUntil = Date.now() + 5 * 60 * 1000; // 5 minutes
  }
  localStorage.setItem(LOCKOUT_STORAGE_KEY, JSON.stringify(data));
  return data;
}

export function clearLockout() {
  localStorage.removeItem(LOCKOUT_STORAGE_KEY);
}

export function isLockedOut() {
  const data = getLockoutData();
  return data.lockedUntil && Date.now() < data.lockedUntil;
}

export function getLockoutRemainingMs() {
  const data = getLockoutData();
  if (!data.lockedUntil) return 0;
  return Math.max(0, data.lockedUntil - Date.now());
}

// Session management
const SESSION_KEY = 'tournament_admin_session';

export function getAdminSession() {
  return sessionStorage.getItem(SESSION_KEY) === 'true';
}

export function setAdminSession(active) {
  if (active) {
    sessionStorage.setItem(SESSION_KEY, 'true');
  } else {
    sessionStorage.removeItem(SESSION_KEY);
  }
}

// Inactivity timeout (default 30 min)
const TIMEOUT_KEY = 'tournament_last_activity';

export function updateActivity() {
  sessionStorage.setItem(TIMEOUT_KEY, Date.now().toString());
}

export function getLastActivity() {
  const val = sessionStorage.getItem(TIMEOUT_KEY);
  return val ? parseInt(val, 10) : Date.now();
}

export function isSessionExpired(timeoutMs = 30 * 60 * 1000) {
  const last = getLastActivity();
  return Date.now() - last > timeoutMs;
}
