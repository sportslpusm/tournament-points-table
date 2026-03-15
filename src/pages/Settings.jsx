import { useState, useRef } from 'react';
import { useTournament, useDispatch } from '../context/TournamentContext';
import { useAuth } from '../context/AuthContext';
import { useSyncStatus } from '../context/SyncContext';
import { generateSampleData } from '../utils/sampleData';
import { validatePassword } from '../utils/auth';
import { validateImportData, LIMITS } from '../utils/validation';
import ImageUpload from '../components/ImageUpload';
import { ConfirmDialog } from '../components/Modal';

export default function Settings() {
  const state = useTournament();
  const { dispatch, showToast, forceSaveNow } = useDispatch();
  const { isAdmin, changePassword, getExportAuth, importAuth } = useAuth();
  const { saveStatus, lastSavedAt, isOnline } = useSyncStatus();
  const { tournament, darkMode } = state;
  const importRef = useRef(null);
  const [forceSaving, setForceSaving] = useState(false);

  const [name, setName] = useState(tournament.name);
  const [startDate, setStartDate] = useState(tournament.startDate);
  const [endDate, setEndDate] = useState(tournament.endDate);
  const [logo, setLogo] = useState(tournament.logo);
  const [showReset, setShowReset] = useState(false);

  // Password change state
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  function handleSaveTournament() {
    dispatch({
      type: 'SET_TOURNAMENT',
      payload: { name: name.trim() || 'My Tournament', startDate, endDate, logo },
    });
    showToast('Tournament settings saved');
  }

  function handleExport() {
    const authData = getExportAuth();
    const data = {
      tournament: state.tournament,
      teams: state.teams,
      games: state.games,
      pools: state.pools,
      matches: state.matches,
      knockoutConfig: state.knockoutConfig,
      knockoutMatches: state.knockoutMatches,
      qualifiedTeams: state.qualifiedTeams,
      athletes: state.athletes || [],
      categories: state.categories || [],
      individualResults: state.individualResults || [],
      individualPointsConfig: state.individualPointsConfig || {},
      auth: authData || undefined,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${state.tournament.name.replace(/\s+/g, '_')}_data.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Data exported successfully');
  }

  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    // File size check
    if (file.size > LIMITS.MAX_IMPORT_SIZE_BYTES) {
      showToast(`File too large. Maximum size is ${LIMITS.MAX_IMPORT_SIZE_BYTES / 1024 / 1024}MB`, 'error');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const result = validateImportData(ev.target.result);
        if (!result.valid) {
          showToast(result.error, 'error');
          return;
        }
        const data = result.data;
        dispatch({ type: 'IMPORT_DATA', payload: data });
        // Import auth data if present and valid
        if (data.auth && typeof data.auth === 'object' && data.auth.passwordHash && typeof data.auth.passwordHash === 'string') {
          importAuth(data.auth);
        }
        // Update local form state
        setName(data.tournament.name);
        setStartDate(data.tournament.startDate || '');
        setEndDate(data.tournament.endDate || '');
        setLogo(data.tournament.logo);
        showToast('Data imported successfully');
      } catch {
        showToast('Failed to parse JSON file', 'error');
      }
    };
    reader.onerror = () => {
      showToast('Failed to read file', 'error');
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleLoadSample() {
    const data = generateSampleData();
    dispatch({ type: 'LOAD_SAMPLE', payload: data });
    setName(data.tournament.name);
    setStartDate(data.tournament.startDate);
    setEndDate(data.tournament.endDate);
    setLogo(data.tournament.logo);
    showToast('Sample data loaded');
  }

  function handleReset() {
    dispatch({ type: 'RESET_DATA' });
    setName('My Tournament');
    setStartDate('');
    setEndDate('');
    setLogo(null);
    showToast('All data cleared');
    setShowReset(false);
  }

  async function handleChangePassword() {
    setPwError('');
    setPwSuccess(false);

    if (!currentPw) {
      setPwError('Current password is required');
      return;
    }
    const pwValidation = validatePassword(newPw);
    if (pwValidation) {
      setPwError(pwValidation);
      return;
    }
    if (newPw !== confirmPw) {
      setPwError('New passwords do not match');
      return;
    }

    const result = await changePassword(currentPw, newPw);
    if (result.success) {
      setPwSuccess(true);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      showToast('Password changed successfully');
    } else {
      setPwError(result.error);
    }
  }

  const inputCls = `w-full px-3 py-2.5 rounded-lg border text-sm transition-colors ${
    darkMode
      ? 'bg-white/5 border-white/10 text-white placeholder-gray-500 focus:border-accent/50'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-accent'
  }`;

  const sectionCls = `rounded-xl p-6 border mb-6 ${
    darkMode
      ? 'bg-navy-800/40 backdrop-blur border-white/5'
      : 'bg-white/80 backdrop-blur border-gray-200'
  }`;

  const sectionTitle = `font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`;

  const actionBtnCls = `w-full px-4 py-2.5 rounded-lg font-medium text-sm text-left flex items-center gap-3 transition-all ${
    darkMode
      ? 'bg-white/5 border border-white/5 hover:bg-white/10 text-gray-300'
      : 'bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-700'
  }`;

  return (
    <div className="max-w-2xl mx-auto animate-slideUp">
      <h2 className={`text-xl font-bold mb-6 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Tournament Settings</h2>

      {/* Tournament Info */}
      <div className={sectionCls}>
        <h3 className={sectionTitle}>Tournament Info</h3>
        <div className="flex justify-center mb-4">
          <ImageUpload value={logo} onChange={setLogo} label="Tournament Logo" size={100} />
        </div>
        <div className="space-y-3">
          <div>
            <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Tournament Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>End Date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
            </div>
          </div>
          <button onClick={handleSaveTournament} className="w-full px-4 py-2.5 bg-accent text-navy-900 font-bold rounded-lg hover:bg-accent-dark transition-colors mt-2">
            Save Settings
          </button>
        </div>
      </div>

      {/* Password Change */}
      <div className={sectionCls}>
        <h3 className={sectionTitle}>Change Admin Password</h3>
        <div className="space-y-3">
          <div className="relative">
            <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Current Password</label>
            <input
              type={showCurrentPw ? 'text' : 'password'}
              value={currentPw}
              onChange={e => { setCurrentPw(e.target.value); setPwError(''); setPwSuccess(false); }}
              className={`${inputCls} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowCurrentPw(!showCurrentPw)}
              className={`absolute right-3 top-8 text-sm ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}
            >
              {showCurrentPw ? '🙈' : '👁'}
            </button>
          </div>
          <div className="relative">
            <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>New Password (min 6 chars)</label>
            <input
              type={showNewPw ? 'text' : 'password'}
              value={newPw}
              onChange={e => { setNewPw(e.target.value); setPwError(''); setPwSuccess(false); }}
              className={`${inputCls} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowNewPw(!showNewPw)}
              className={`absolute right-3 top-8 text-sm ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}
            >
              {showNewPw ? '🙈' : '👁'}
            </button>
          </div>
          <div>
            <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Confirm New Password</label>
            <input
              type="password"
              value={confirmPw}
              onChange={e => { setConfirmPw(e.target.value); setPwError(''); setPwSuccess(false); }}
              className={inputCls}
            />
          </div>
          {pwError && (
            <p className="text-sm text-red-400">{pwError}</p>
          )}
          {pwSuccess && (
            <p className="text-sm text-win">Password changed successfully!</p>
          )}
          <button
            onClick={handleChangePassword}
            className="w-full px-4 py-2.5 bg-accent text-navy-900 font-bold rounded-lg hover:bg-accent-dark transition-colors"
          >
            Change Password
          </button>
        </div>
      </div>

      {/* Appearance */}
      <div className={sectionCls}>
        <h3 className={sectionTitle}>Appearance</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className={`font-medium text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>Dark Mode</p>
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Toggle between light and dark theme</p>
          </div>
          <button
            onClick={() => dispatch({ type: 'TOGGLE_DARK_MODE' })}
            className={`relative w-14 h-7 rounded-full transition-all ${
              darkMode
                ? 'bg-accent shadow-md shadow-accent/30'
                : 'bg-gray-300'
            }`}
          >
            <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
              darkMode ? 'translate-x-7' : 'translate-x-1'
            }`} />
          </button>
        </div>
      </div>

      {/* Data Management */}
      <div className={sectionCls}>
        <h3 className={sectionTitle}>Data Management</h3>
        <div className="space-y-3">
          <button onClick={handleExport} className={actionBtnCls}>
            <span className="text-lg">📥</span>
            <div>
              <div>Export Tournament Data</div>
              <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Download as JSON file (includes auth)</div>
            </div>
          </button>
          <button onClick={() => importRef.current?.click()} className={actionBtnCls}>
            <span className="text-lg">📤</span>
            <div>
              <div>Import Tournament Data</div>
              <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Upload a JSON file</div>
            </div>
          </button>
          <input ref={importRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          <button onClick={handleLoadSample} className={actionBtnCls}>
            <span className="text-lg">🧪</span>
            <div>
              <div>Load Sample Data</div>
              <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Populate with demo tournament data</div>
            </div>
          </button>
          <button onClick={() => setShowReset(true)} className={`w-full px-4 py-2.5 rounded-lg font-medium text-sm text-left flex items-center gap-3 transition-all border ${
            darkMode
              ? 'bg-red-900/10 border-red-500/20 hover:bg-red-900/20 text-red-400'
              : 'bg-red-50 border-red-200 hover:bg-red-100 text-red-600'
          }`}>
            <span className="text-lg">⚠️</span>
            <div>
              <div>Reset All Data</div>
              <div className={`text-xs ${darkMode ? 'text-red-400/60' : 'text-red-400'}`}>Clear everything and start fresh</div>
            </div>
          </button>
        </div>
      </div>

      {/* Sync Status */}
      <div className={sectionCls}>
        <h3 className={sectionTitle}>Cloud Sync Status</h3>
        <div className="space-y-3">
          {/* Connection Status */}
          <div className={`flex items-center justify-between py-2.5 border-b ${darkMode ? 'border-white/5' : 'border-gray-100'}`}>
            <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Connection</span>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400 animate-pulseLive'}`} />
              <span className={`text-sm font-medium ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>

          {/* Save Status */}
          <div className={`flex items-center justify-between py-2.5 border-b ${darkMode ? 'border-white/5' : 'border-gray-100'}`}>
            <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Save Status</span>
            <span className={`text-sm font-medium ${
              saveStatus === 'saving' ? 'text-amber-400' :
              saveStatus === 'saved' ? 'text-green-400' :
              saveStatus === 'error' ? 'text-red-400' :
              darkMode ? 'text-gray-400' : 'text-gray-500'
            }`}>
              {saveStatus === 'saving' ? 'Saving...' :
               saveStatus === 'saved' ? 'Saved ✓' :
               saveStatus === 'error' ? 'Save failed ✗' :
               'Idle'}
            </span>
          </div>

          {/* Last Saved */}
          <div className={`flex items-center justify-between py-2.5 border-b ${darkMode ? 'border-white/5' : 'border-gray-100'}`}>
            <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Last Saved</span>
            <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {lastSavedAt ? lastSavedAt.toLocaleTimeString() : 'Not yet saved'}
            </span>
          </div>

          {/* Force Save Button */}
          <button
            onClick={async () => {
              setForceSaving(true);
              try {
                await forceSaveNow();
                showToast('Data saved to cloud', 'success');
              } catch {
                showToast('Failed to save data', 'error');
              } finally {
                setForceSaving(false);
              }
            }}
            disabled={forceSaving}
            className={`w-full px-4 py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all ${
              darkMode
                ? 'bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20 disabled:opacity-50'
                : 'bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 disabled:opacity-50'
            }`}
          >
            <span>{forceSaving ? '⏳' : '☁️'}</span>
            {forceSaving ? 'Saving...' : 'Force Save Now'}
          </button>

          <p className={`text-xs ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
            Data auto-saves 1.5 seconds after each change. Changes sync in real-time across all open tabs and devices.
          </p>
        </div>
      </div>

      {/* Points System Reference */}
      <div className={`rounded-xl p-6 border ${
        darkMode
          ? 'bg-navy-800/40 backdrop-blur border-white/5'
          : 'bg-white/80 backdrop-blur border-gray-200'
      }`}>
        <h3 className={sectionTitle}>Points System</h3>
        <div className="space-y-2 text-sm">
          {[
            { label: 'Win', points: '4 pts', detail: '3 win + 1 participation', color: 'text-win' },
            { label: 'Draw', points: '2 pts', detail: '1 draw + 1 participation', color: 'text-draw' },
            { label: 'Loss', points: '1 pt', detail: '0 loss + 1 participation', color: 'text-loss' },
            { label: 'Bye (present)', points: '2 pts', detail: 'Walkover points', color: 'text-bye' },
            { label: 'Bye (absent)', points: '0 pts', detail: 'No points at all', color: darkMode ? 'text-gray-500' : 'text-gray-400' },
          ].map(row => (
            <div key={row.label} className={`flex items-center justify-between py-2.5 border-b ${
              darkMode ? 'border-white/5' : 'border-gray-100'
            }`}>
              <span className="font-medium">{row.label}</span>
              <div className="text-right">
                <span className={`font-mono font-bold ${row.color}`}>{row.points}</span>
                <span className={`text-xs ml-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>({row.detail})</span>
              </div>
            </div>
          ))}
        </div>
        <div className={`mt-4 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          <p className="font-medium mb-1">Tiebreaker Rules:</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>Most wins</li>
            <li>Head-to-head record</li>
            <li>Alphabetical order</li>
          </ol>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showReset}
        onClose={() => setShowReset(false)}
        onConfirm={handleReset}
        title="Reset All Data"
        message="This will permanently delete all teams, games, pools, and matches. This action cannot be undone."
      />
    </div>
  );
}
