import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDispatch } from '../context/TournamentContext';
import { hashPassword, generateRecoveryKey, formatRecoveryKey, validatePassword } from '../utils/auth';
import ImageUpload from './ImageUpload';

export default function FirstTimeSetup({ onComplete, skipTournamentInfo = false }) {
  const { setupPassword } = useAuth();
  const { dispatch, showToast, setAdminFlag } = useDispatch();

  // If tournament already exists, skip step 1 (tournament info)
  const [step, setStep] = useState(skipTournamentInfo ? 2 : 1);

  // Step 1: Tournament info
  const [tName, setTName] = useState('');
  const [tLogo, setTLogo] = useState(null);

  // Step 2: Password
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwError, setPwError] = useState('');

  // Step 2 result: recovery key
  const [recoveryKey, setRecoveryKey] = useState('');
  const [keyCopied, setKeyCopied] = useState(false);
  const [keyAcknowledged, setKeyAcknowledged] = useState(false);

  async function handleStep2() {
    setPwError('');
    const pwValidation = validatePassword(password);
    if (pwValidation) {
      setPwError(pwValidation);
      return;
    }
    if (password !== confirmPassword) {
      setPwError('Passwords do not match');
      return;
    }

    // Generate recovery key
    const key = generateRecoveryKey();
    const keyHash = await hashPassword(key);

    setRecoveryKey(key);

    // Setup password FIRST so we become admin before dispatching admin actions
    await setupPassword(password, keyHash);

    // Immediately set admin flag so dispatch guard passes (useEffect sync might be delayed)
    setAdminFlag(true);

    // Only save tournament info if we went through step 1 (not skipped for existing tournament)
    if (!skipTournamentInfo) {
      dispatch({
        type: 'SET_TOURNAMENT',
        payload: { name: tName.trim() || 'My Tournament', logo: tLogo },
      });
    }

    setStep(3);
  }

  function handleCopyKey() {
    navigator.clipboard.writeText(formatRecoveryKey(recoveryKey)).then(() => {
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2000);
    }).catch(() => {
      // Clipboard access denied — user can still manually copy
    });
  }

  function handleFinish() {
    showToast('Setup complete! You are now logged in as admin.');
    if (onComplete) onComplete();
  }

  const inputCls = 'w-full px-3 py-2.5 rounded-lg text-sm bg-white/5 border border-white/10 text-white placeholder-gray-500';

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fadeIn">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                step >= s ? 'bg-accent text-navy-900 shadow-md shadow-accent/20' : 'bg-white/5 text-gray-500'
              }`}>
                {step > s ? '✓' : s}
              </div>
              {s < 3 && <div className={`w-8 h-0.5 rounded-full transition-colors ${step > s ? 'bg-accent' : 'bg-white/10'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-navy-800/60 backdrop-blur-2xl rounded-2xl p-6 border border-white/10 shadow-2xl">
          {/* Step 1: Tournament Info */}
          {step === 1 && (
            <div className="animate-slideUp">
              <div className="text-center mb-6">
                <div className="text-3xl mb-2">🏆</div>
                <h2 className="text-xl font-bold text-white">Welcome!</h2>
                <p className="text-sm text-gray-400 mt-1">Set up your tournament</p>
              </div>
              <div className="space-y-4">
                <div className="flex justify-center">
                  <ImageUpload value={tLogo} onChange={setTLogo} label="Tournament Logo" size={80} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Tournament Name</label>
                  <input
                    type="text"
                    value={tName}
                    onChange={e => setTName(e.target.value)}
                    placeholder="e.g. Champions League 2026"
                    className={inputCls}
                    autoFocus
                  />
                </div>
                <button
                  onClick={() => setStep(2)}
                  className="w-full px-4 py-2.5 bg-accent text-navy-900 font-bold rounded-lg hover:bg-accent-dark transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Set Password */}
          {step === 2 && (
            <div className="animate-slideUp">
              <div className="text-center mb-6">
                <div className="text-3xl mb-2">{skipTournamentInfo ? '🔄' : '🔐'}</div>
                <h2 className="text-xl font-bold text-white">
                  {skipTournamentInfo ? 'Set New Admin Password' : 'Set Admin Password'}
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  {skipTournamentInfo
                    ? 'Your tournament data was found. Set a password to manage it from this device.'
                    : 'Protect your tournament data from unauthorized edits'}
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Password (min 6 characters)</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => { setPassword(e.target.value); setPwError(''); }}
                      placeholder="Enter password"
                      className={`${inputCls} pr-10`}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-sm px-1"
                    >
                      {showPw ? '🙈' : '👁'}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Confirm Password</label>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => { setConfirmPassword(e.target.value); setPwError(''); }}
                    placeholder="Re-enter password"
                    className={inputCls}
                    onKeyDown={e => e.key === 'Enter' && handleStep2()}
                  />
                </div>
                {pwError && (
                  <p className="text-red-400 text-sm">{pwError}</p>
                )}
                <div className="flex gap-3">
                  {!skipTournamentInfo && (
                    <button
                      onClick={() => setStep(1)}
                      className="flex-1 px-4 py-2.5 bg-white/10 text-gray-300 rounded-lg hover:bg-white/15 transition-colors"
                    >
                      Back
                    </button>
                  )}
                  <button
                    onClick={handleStep2}
                    className="flex-1 px-4 py-2.5 bg-accent text-navy-900 font-bold rounded-lg hover:bg-accent-dark transition-colors"
                  >
                    Set Password
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Recovery Key */}
          {step === 3 && (
            <div className="animate-slideUp">
              <div className="text-center mb-6">
                <div className="text-3xl mb-2">🔑</div>
                <h2 className="text-xl font-bold text-white">Save Your Recovery Key</h2>
                <p className="text-sm text-gray-400 mt-1">This is your ONLY way to reset your password if you forget it</p>
              </div>
              <div className="space-y-4">
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                  <p className="text-red-300 text-xs font-medium">
                    This key will only be shown ONCE. Save it somewhere safe!
                  </p>
                </div>
                <div className="bg-white/5 rounded-lg p-4 text-center border border-white/10">
                  <p className="text-xs text-gray-500 mb-2">Recovery Key</p>
                  <p className="text-2xl font-mono font-bold text-accent tracking-widest">
                    {formatRecoveryKey(recoveryKey)}
                  </p>
                </div>
                <button
                  onClick={handleCopyKey}
                  className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    keyCopied ? 'bg-win/20 text-win' : 'bg-white/5 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {keyCopied ? '✓ Copied!' : 'Copy to Clipboard'}
                </button>
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg bg-white/5">
                  <input
                    type="checkbox"
                    checked={keyAcknowledged}
                    onChange={e => setKeyAcknowledged(e.target.checked)}
                    className="rounded mt-0.5"
                  />
                  <span className="text-sm text-gray-300">
                    I have saved my recovery key in a safe place
                  </span>
                </label>
                <button
                  onClick={handleFinish}
                  disabled={!keyAcknowledged}
                  className={`w-full px-4 py-2.5 font-bold rounded-lg transition-colors ${
                    keyAcknowledged
                      ? 'bg-accent text-navy-900 hover:bg-accent-dark'
                      : 'bg-white/5 text-gray-600 cursor-not-allowed'
                  }`}
                >
                  Get Started
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 mt-4">
          <img src="/USC.png" alt="USC" className="w-5 h-5 object-contain opacity-40" />
          <p className="text-xs text-gray-600">
            Tournament Points Table &middot; Uni Sports Council, LPU
          </p>
        </div>
      </div>
    </div>
  );
}
