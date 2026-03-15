// Offline detection banner — slides in when connection is lost
import { useSyncStatus } from '../context/SyncContext';

export default function OfflineBanner({ darkMode }) {
  const { isOnline } = useSyncStatus();

  if (isOnline) return null;

  return (
    <div className={`px-4 py-2 text-center text-xs font-medium animate-slideUp ${
      darkMode
        ? 'bg-amber-500/10 text-amber-400 border-b border-amber-500/20'
        : 'bg-amber-50 text-amber-700 border-b border-amber-200'
    }`}>
      <span className="inline-flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulseLive" />
        You're offline — changes will sync when connection returns
      </span>
    </div>
  );
}
