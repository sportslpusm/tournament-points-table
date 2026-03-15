import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTournament } from '../context/TournamentContext';
import { validatePassword, MAX_PASSWORD_LENGTH } from '../utils/auth';
import Modal from './Modal';

export default function LoginModal({ isOpen, onClose }) {
  const { login, recoverPassword, lockout, getLockoutRemainingMs } = useAuth();
  const { darkMode } = useTournament();

  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);

  // Recovery mode
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState(false);

  // Lockout countdown
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  const inputRef = useRef(null);

  const inputCls = `w-full px-3 py-2.5 rounded-lg text-sm border ${
    darkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-300 text-gray-900'
  }`;

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError('');
      setShake(false);
      setShowRecovery(false);
      setRecoveryKey('');
      setNewPassword('');
      setConfirmNewPassword('');
      setRecoveryError('');
      setRecoverySuccess(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Update lockout countdown
  useEffect(() => {
    if (!lockout.lockedUntil) {
      setLockoutRemaining(0);
      return;
    }
    const update = () => {
      const remaining = getLockoutRemainingMs();
      setLockoutRemaining(remaining);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [lockout, getLockoutRemainingMs]);

  async function handleLogin() {
    if (!password) return;
    if (password.length > MAX_PASSWORD_LENGTH) {
      setError(`Password cannot exceed ${MAX_PASSWORD_LENGTH} characters`);
      return;
    }
    setLoading(true);
    setError('');

    const result = await login(password);
    setLoading(false);

    if (result.success) {
      onClose();
    } else {
      setError(result.error);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPassword('');
    }
  }

  async function handleRecover() {
    setRecoveryError('');
    if (!recoveryKey.trim()) {
      setRecoveryError('Enter your recovery key');
      return;
    }
    const pwValidation = validatePassword(newPassword);
    if (pwValidation) {
      setRecoveryError(pwValidation);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setRecoveryError('Passwords do not match');
      return;
    }

    const result = await recoverPassword(recoveryKey.trim(), newPassword);
    if (result.success) {
      setRecoverySuccess(true);
    } else {
      setRecoveryError(result.error);
    }
  }

  const isLocked = lockoutRemaining > 0;
  const lockoutMinutes = Math.ceil(lockoutRemaining / 60000);
  const lockoutSeconds = Math.ceil((lockoutRemaining % 60000) / 1000);

  if (showRecovery) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Reset Password" size="sm">
        {recoverySuccess ? (
          <div className="space-y-4">
            <div className="text-center py-4">
              <div className="text-3xl mb-2">✅</div>
              <p className="text-win font-medium">Password reset successfully!</p>
              <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>You can now log in with your new password.</p>
            </div>
            <button
              onClick={() => {
                setShowRecovery(false);
                setRecoverySuccess(false);
              }}
              className="w-full px-4 py-2.5 bg-accent text-navy-900 font-bold rounded-lg hover:bg-accent-dark transition-colors"
            >
              Back to Login
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Enter the recovery key you saved during setup.</p>
            <div>
              <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Recovery Key</label>
              <input
                type="text"
                value={recoveryKey}
                onChange={e => { setRecoveryKey(e.target.value); setRecoveryError(''); }}
                placeholder="XXXX-XXXX-XXXX"
                className={`${inputCls} font-mono tracking-wider`}
                autoFocus
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>New Password (min 6 characters)</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setRecoveryError(''); }}
                className={inputCls}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Confirm New Password</label>
              <input
                type="password"
                value={confirmNewPassword}
                onChange={e => { setConfirmNewPassword(e.target.value); setRecoveryError(''); }}
                className={inputCls}
              />
            </div>
            {recoveryError && <p className="text-red-400 text-sm">{recoveryError}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => setShowRecovery(false)}
                className={`flex-1 px-4 py-2.5 rounded-lg transition-colors ${
                  darkMode ? 'bg-white/10 text-gray-300 hover:bg-white/15' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Back
              </button>
              <button
                onClick={handleRecover}
                className="flex-1 px-4 py-2.5 bg-accent text-navy-900 font-bold rounded-lg hover:bg-accent-dark transition-colors"
              >
                Reset Password
              </button>
            </div>
          </div>
        )}
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Admin Login" size="sm">
      <div className={`space-y-4 ${shake ? 'animate-shake' : ''}`}>
        <div className="text-center">
          <div className="text-3xl mb-1">🛡️</div>
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Enter admin password to manage tournament data</p>
        </div>

        {isLocked ? (
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 text-center">
            <p className="text-red-300 font-medium text-sm">Account Locked</p>
            <p className="text-red-400/70 text-xs mt-1">Too many failed attempts</p>
            <div className="text-2xl font-mono font-bold text-red-300 mt-2">
              {lockoutMinutes > 0 ? `${lockoutMinutes}m ` : ''}{lockoutSeconds}s
            </div>
          </div>
        ) : (
          <>
            <div>
              <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Password</label>
              <div className="relative">
                <input
                  ref={inputRef}
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  placeholder="Enter admin password"
                  className={`${inputCls} pr-10 ${error ? 'border-red-500!' : ''}`}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 text-sm px-1 ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}
                >
                  {showPw ? '🙈' : '👁'}
                </button>
              </div>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
          </>
        )}

        <button
          onClick={handleLogin}
          disabled={isLocked || loading || !password}
          className={`w-full px-4 py-2.5 font-bold rounded-lg transition-colors ${
            isLocked || loading || !password
              ? darkMode ? 'bg-white/5 text-gray-600 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-accent text-navy-900 hover:bg-accent-dark'
          }`}
        >
          {loading ? 'Verifying...' : 'Login'}
        </button>

        <button
          onClick={() => setShowRecovery(true)}
          className={`w-full text-xs transition-colors ${darkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
        >
          Forgot password? Use recovery key
        </button>
      </div>
    </Modal>
  );
}
