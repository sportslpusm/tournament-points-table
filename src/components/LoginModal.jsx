import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTournament } from '../context/TournamentContext';
import { validatePassword, MAX_PASSWORD_LENGTH } from '../utils/auth';
import Modal from './Modal';

export default function LoginModal({ isOpen, onClose }) {
  const { login, recoverPassword, setupPassword, authData, lockout, getLockoutRemainingMs } = useAuth();
  const { darkMode } = useTournament();

  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);

  // No password set — setup mode
  const noPasswordSet = !authData?.passwordHash;
  const [setupMode, setSetupMode] = useState(false);
  const [setupPw, setSetupPw] = useState('');
  const [setupPwConfirm, setSetupPwConfirm] = useState('');
  const [setupError, setSetupError] = useState('');

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

  const inputCls = `w-full px-3.5 py-2.5 rounded-xl text-sm border transition-all duration-200 ${
    darkMode ? 'bg-white/[0.04] border-white/[0.08] text-white focus:border-accent/50 focus:bg-white/[0.06]' : 'bg-white border-gray-200/80 text-gray-900 focus:border-accent'
  }`;

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError('');
      setShake(false);
      setShowRecovery(false);
      setSetupMode(!authData?.passwordHash);
      setSetupPw('');
      setSetupPwConfirm('');
      setSetupError('');
      setRecoveryKey('');
      setNewPassword('');
      setConfirmNewPassword('');
      setRecoveryError('');
      setRecoverySuccess(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function handleSetupPassword() {
    setSetupError('');
    const pwValidation = validatePassword(setupPw);
    if (pwValidation) {
      setSetupError(pwValidation);
      return;
    }
    if (setupPw !== setupPwConfirm) {
      setSetupError('Passwords do not match');
      return;
    }
    setLoading(true);
    await setupPassword(setupPw, null);
    setLoading(false);
    onClose();
  }

  const isLocked = lockoutRemaining > 0;
  const lockoutMinutes = Math.ceil(lockoutRemaining / 60000);
  const lockoutSeconds = Math.ceil((lockoutRemaining % 60000) / 1000);

  // No password set — show setup form
  if (setupMode || noPasswordSet) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Set Admin Password" size="sm">
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-3xl mb-1.5">🔐</div>
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              No admin password is set. Create one to manage your tournament.
            </p>
          </div>
          <div>
            <label className={`block text-sm font-semibold mb-1.5 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>New Password (min 6 characters)</label>
            <input
              type="password"
              value={setupPw}
              onChange={e => { setSetupPw(e.target.value); setSetupError(''); }}
              onKeyDown={e => e.key === 'Enter' && setupPwConfirm && handleSetupPassword()}
              placeholder="Enter new password"
              className={inputCls}
              autoFocus
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className={`block text-sm font-semibold mb-1.5 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Confirm Password</label>
            <input
              type="password"
              value={setupPwConfirm}
              onChange={e => { setSetupPwConfirm(e.target.value); setSetupError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleSetupPassword()}
              placeholder="Confirm password"
              className={inputCls}
              autoComplete="new-password"
            />
          </div>
          {setupError && <p className="text-red-400 text-sm">{setupError}</p>}
          <button
            onClick={handleSetupPassword}
            disabled={loading || !setupPw || !setupPwConfirm}
            className={`w-full px-4 py-2.5 font-bold rounded-xl transition-all duration-200 ${
              loading || !setupPw || !setupPwConfirm
                ? darkMode ? 'bg-white/[0.04] text-gray-600 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-accent text-navy-900 hover:bg-accent-dark shadow-sm shadow-accent/20'
            }`}
          >
            {loading ? 'Setting up...' : 'Set Password & Login'}
          </button>
        </div>
      </Modal>
    );
  }

  if (showRecovery) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Reset Password" size="sm">
        {recoverySuccess ? (
          <div className="space-y-4">
            <div className="text-center py-6">
              <div className="text-3xl mb-3">✅</div>
              <p className="text-win font-semibold">Password reset successfully!</p>
              <p className={`text-sm mt-1.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>You can now log in with your new password.</p>
            </div>
            <button
              onClick={() => {
                setShowRecovery(false);
                setRecoverySuccess(false);
              }}
              className="w-full px-4 py-2.5 bg-accent text-navy-900 font-bold rounded-xl hover:bg-accent-dark transition-all duration-200 shadow-sm shadow-accent/20"
            >
              Back to Login
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Enter the recovery key you saved during setup.</p>
            <div>
              <label className={`block text-sm font-semibold mb-1.5 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Recovery Key</label>
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
              <label className={`block text-sm font-semibold mb-1.5 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>New Password (min 6 characters)</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setRecoveryError(''); }}
                className={inputCls}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className={`block text-sm font-semibold mb-1.5 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Confirm New Password</label>
              <input
                type="password"
                value={confirmNewPassword}
                onChange={e => { setConfirmNewPassword(e.target.value); setRecoveryError(''); }}
                className={inputCls}
                autoComplete="new-password"
              />
            </div>
            {recoveryError && <p className="text-red-400 text-sm">{recoveryError}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => setShowRecovery(false)}
                className={`flex-1 px-4 py-2.5 rounded-xl transition-all duration-200 ${
                  darkMode ? 'bg-white/[0.06] text-gray-300 hover:bg-white/[0.1] border border-white/[0.06]' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Back
              </button>
              <button
                onClick={handleRecover}
                className="flex-1 px-4 py-2.5 bg-accent text-navy-900 font-bold rounded-xl hover:bg-accent-dark transition-all duration-200 shadow-sm shadow-accent/20"
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
          <div className="text-3xl mb-1.5">🛡️</div>
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Enter admin password to manage tournament data</p>
        </div>

        {isLocked ? (
          <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-center">
            <p className="text-red-300 font-semibold text-sm">Account Locked</p>
            <p className="text-red-400/70 text-xs mt-1">Too many failed attempts</p>
            <div className="text-2xl font-mono font-bold text-red-300 mt-2">
              {lockoutMinutes > 0 ? `${lockoutMinutes}m ` : ''}{lockoutSeconds}s
            </div>
          </div>
        ) : (
          <form autoComplete="off" onSubmit={e => { e.preventDefault(); handleLogin(); }}>
            {/* Hidden dummy fields to trick Chrome's autofill */}
            <input type="text" name="fake-user" style={{ display: 'none' }} tabIndex={-1} aria-hidden="true" />
            <input type="password" name="fake-pass" style={{ display: 'none' }} tabIndex={-1} aria-hidden="true" />
            <div>
              <label className={`block text-sm font-semibold mb-1.5 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Password</label>
              <div className="relative">
                <input
                  ref={inputRef}
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="Enter admin password"
                  className={`${inputCls} pr-10 ${error ? 'border-red-500!' : ''}`}
                  disabled={loading}
                  autoComplete="off"
                  name="tournament-admin-pw"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-sm px-1 transition-colors duration-200 ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}
                >
                  {showPw ? '🙈' : '👁'}
                </button>
              </div>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={isLocked || loading || !password}
              className={`w-full px-4 py-2.5 font-bold rounded-xl transition-all duration-200 ${
                isLocked || loading || !password
                  ? darkMode ? 'bg-white/[0.04] text-gray-600 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-accent text-navy-900 hover:bg-accent-dark shadow-sm shadow-accent/20 hover:shadow-accent/30 hover:-translate-y-0.5'
              }`}
            >
              {loading ? 'Verifying...' : 'Login'}
            </button>

            <button
              type="button"
              onClick={() => setShowRecovery(true)}
              className={`w-full text-xs transition-colors duration-200 ${darkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Forgot password? Use recovery key
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
}
