// Save status indicator with upload progress bar, count, and speed
import { useSyncStatus } from '../context/SyncContext';

export default function SaveIndicator({ darkMode }) {
  const { saveStatus, lastSavedAt, isOnline, progress } = useSyncStatus();

  const formatTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Active save with progress info
  if (saveStatus === 'saving' && progress) {
    const { phase, current, total, currentName, speed, percent } = progress;

    // Logo upload phase — show rich progress
    if (phase === 'logos' && total > 0) {
      const pct = percent || Math.round((current / total) * 100);
      return (
        <div className="flex flex-col gap-0.5 min-w-0 max-w-[200px]">
          <div className="flex items-center gap-1 text-[10px] font-medium select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulseLive flex-shrink-0" />
            <span className={`truncate ${darkMode ? 'text-amber-400' : 'text-amber-600'}`}>
              Logos {current}/{total}
            </span>
            {speed && (
              <span className={`flex-shrink-0 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                {speed}
              </span>
            )}
          </div>
          <div className={`w-full h-1.5 rounded-full overflow-hidden ${darkMode ? 'bg-white/10' : 'bg-gray-200'}`}>
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-cyan-400 transition-all duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          {currentName && (
            <span className={`text-[9px] truncate ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
              ↑ {currentName}
            </span>
          )}
        </div>
      );
    }

    // Data saving phase
    if (phase === 'data') {
      return (
        <div className="flex items-center gap-1.5 text-[10px] font-medium select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulseLive" />
          <span className={darkMode ? 'text-amber-400' : 'text-amber-600'}>
            {currentName || 'Saving data...'}
          </span>
        </div>
      );
    }
  }

  // Generic saving (no progress detail yet)
  if (saveStatus === 'saving') {
    return (
      <div className="flex items-center gap-1.5 text-[10px] font-medium select-none">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulseLive" />
        <span className={darkMode ? 'text-amber-400' : 'text-amber-600'}>Saving...</span>
      </div>
    );
  }

  if (saveStatus === 'idle' && !lastSavedAt) return null;

  return (
    <div className="flex items-center gap-1.5 text-[10px] font-medium select-none">
      {saveStatus === 'saved' && (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
          <span className={darkMode ? 'text-green-400' : 'text-green-600'}>
            Saved {lastSavedAt ? formatTime(lastSavedAt) : '✓'}
          </span>
        </>
      )}
      {saveStatus === 'error' && (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
          <span className={darkMode ? 'text-red-400' : 'text-red-600'}>Save failed ✗</span>
        </>
      )}
      {saveStatus === 'idle' && lastSavedAt && (
        <>
          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-400/50' : 'bg-gray-500'}`} />
          <span className={darkMode ? 'text-gray-500' : 'text-gray-400'}>
            {isOnline ? `Saved ${formatTime(lastSavedAt)}` : 'Offline'}
          </span>
        </>
      )}
    </div>
  );
}
