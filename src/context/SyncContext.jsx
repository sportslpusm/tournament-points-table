// SyncContext — manages save status, online state, progress, and last-saved time
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { configureSaveCallbacks, onSaveProgress } from '../utils/database';

const SyncContext = createContext(null);

export function SyncProvider({ children }) {
  // 'idle' | 'saving' | 'saved' | 'error'
  const [saveStatus, setSaveStatus] = useState('idle');
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const savedTimerRef = useRef(null);

  // Upload progress: { phase, current, total, currentName, speed, done }
  const [progress, setProgress] = useState(null);

  // Wire up save callbacks
  useEffect(() => {
    configureSaveCallbacks({
      onSaving: () => {
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        setSaveStatus('saving');
        setProgress(null);
      },
      onSaved: () => {
        setSaveStatus('saved');
        setLastSavedAt(new Date());
        setProgress(null);
        savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 3000);
      },
      onError: () => {
        setSaveStatus('error');
        setProgress(null);
        savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 5000);
      },
    });

    // Wire up progress reporting
    onSaveProgress((info) => {
      if (info.phase === 'complete') {
        setProgress(null);
      } else {
        setProgress(info);
      }
    });

    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  // Online/offline listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const markSaving = useCallback(() => setSaveStatus('saving'), []);
  const markSaved = useCallback(() => {
    setSaveStatus('saved');
    setLastSavedAt(new Date());
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 3000);
  }, []);
  const markError = useCallback(() => setSaveStatus('error'), []);

  return (
    <SyncContext.Provider value={{ saveStatus, lastSavedAt, isOnline, progress, markSaving, markSaved, markError }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncStatus() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSyncStatus must be used within SyncProvider');
  return ctx;
}
