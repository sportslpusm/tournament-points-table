import { useState, useEffect, useCallback } from 'react';
import { useTournament } from '../context/TournamentContext';
import { fetchAuditLog } from '../utils/auditLog';
import EmptyState from '../components/EmptyState';

const CATEGORY_STYLES = {
  team:       { icon: '👥', label: 'Team',       color: 'blue' },
  game:       { icon: '🎮', label: 'Game',       color: 'emerald' },
  match:      { icon: '📋', label: 'Match',      color: 'purple' },
  knockout:   { icon: '🏆', label: 'Knockout',   color: 'orange' },
  individual: { icon: '🏃', label: 'Individual', color: 'cyan' },
  lobby:      { icon: '🎯', label: 'Lobby',      color: 'pink' },
  setting:    { icon: '⚙️', label: 'Setting',    color: 'gray' },
  bulk:       { icon: '📦', label: 'Bulk',        color: 'gray' },
};

const TYPE_ICONS = {
  add: '➕',
  delete: '🗑️',
  update: '✏️',
};

function getCategoryStyle(category, darkMode) {
  const cat = CATEGORY_STYLES[category] || CATEGORY_STYLES.setting;
  const colorMap = {
    blue:    darkMode ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'       : 'bg-blue-50 border-blue-200/60 text-blue-600',
    emerald: darkMode ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200/60 text-emerald-600',
    purple:  darkMode ? 'bg-purple-500/10 border-purple-500/20 text-purple-400'   : 'bg-purple-50 border-purple-200/60 text-purple-600',
    orange:  darkMode ? 'bg-orange-500/10 border-orange-500/20 text-orange-400'   : 'bg-orange-50 border-orange-200/60 text-orange-600',
    cyan:    darkMode ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'         : 'bg-cyan-50 border-cyan-200/60 text-cyan-600',
    pink:    darkMode ? 'bg-pink-500/10 border-pink-500/20 text-pink-400'         : 'bg-pink-50 border-pink-200/60 text-pink-600',
    gray:    darkMode ? 'bg-gray-500/10 border-gray-500/20 text-gray-400'         : 'bg-gray-50 border-gray-200/60 text-gray-600',
  };
  return { ...cat, className: colorMap[cat.color] || colorMap.gray };
}

function formatTimestamp(date) {
  if (!date) return 'Unknown time';
  const now = new Date();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatFullTimestamp(date) {
  if (!date) return '';
  return date.toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// Group entries by date
function groupByDate(entries) {
  const groups = [];
  let currentDate = null;
  let currentGroup = null;
  for (const entry of entries) {
    const dateKey = entry.timestamp?.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) || 'Unknown';
    if (dateKey !== currentDate) {
      currentDate = dateKey;
      currentGroup = { date: dateKey, entries: [] };
      groups.push(currentGroup);
    }
    currentGroup.entries.push(entry);
  }
  return groups;
}

export default function ActivityLog() {
  const { darkMode } = useTournament();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  const loadLog = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAuditLog(200);
      setEntries(data);
    } catch (err) {
      setError('Failed to load activity log');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLog(); }, [loadLog]);

  const filtered = filter === 'all' ? entries : entries.filter(e => e.category === filter);
  const groups = groupByDate(filtered);

  // Category counts for filter tabs
  const categoryCounts = {};
  for (const e of entries) {
    categoryCounts[e.category] = (categoryCounts[e.category] || 0) + 1;
  }
  const activeCategories = Object.keys(categoryCounts).sort();

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Activity Log
            </h1>
            <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              All admin changes — newest first. Auto-tracked on every save.
            </p>
          </div>
          <button
            onClick={loadLog}
            disabled={loading}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
              darkMode
                ? 'bg-white/[0.06] text-gray-300 hover:bg-white/[0.1]'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            } ${loading ? 'opacity-50' : ''}`}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      {activeCategories.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`text-[11px] font-bold tracking-wide uppercase px-2.5 py-1 rounded-lg border transition-colors ${
              filter === 'all'
                ? darkMode
                  ? 'bg-accent/10 border-accent/20 text-accent'
                  : 'bg-accent/5 border-accent/20 text-accent-dark'
                : darkMode
                ? 'bg-white/[0.03] border-white/[0.06] text-gray-500 hover:text-gray-300'
                : 'bg-gray-50 border-gray-200 text-gray-400 hover:text-gray-600'
            }`}
          >
            All ({entries.length})
          </button>
          {activeCategories.map(cat => {
            const style = getCategoryStyle(cat, darkMode);
            return (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`text-[11px] font-bold tracking-wide uppercase px-2.5 py-1 rounded-lg border transition-colors ${
                  filter === cat
                    ? style.className
                    : darkMode
                    ? 'bg-white/[0.03] border-white/[0.06] text-gray-500 hover:text-gray-300'
                    : 'bg-gray-50 border-gray-200 text-gray-400 hover:text-gray-600'
                }`}
              >
                {style.icon} {style.label} ({categoryCounts[cat]})
              </button>
            );
          })}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className={`rounded-xl p-4 mb-4 border ${
          darkMode ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-200 text-red-600'
        }`}>
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <EmptyState
          icon="📝"
          title={filter === 'all' ? 'No activity yet' : `No ${filter} activity`}
          description={filter === 'all'
            ? 'Changes will appear here as admins make edits to the tournament.'
            : 'Try selecting a different filter.'}
        />
      )}

      {/* Timeline */}
      {filtered.length > 0 && (
        <div className="relative">
          {/* Timeline line */}
          <div className={`absolute left-[19px] top-2 bottom-2 w-px ${darkMode ? 'bg-white/[0.06]' : 'bg-gray-200'}`} />

          <div className="space-y-6">
            {groups.map(group => (
              <div key={group.date}>
                {/* Date header */}
                <div className="flex items-center gap-3 mb-3 relative">
                  <div className="w-[39px] flex justify-center flex-shrink-0">
                    <div className={`w-2.5 h-2.5 rounded-full ring-4 ${
                      darkMode ? 'bg-accent ring-navy-950' : 'bg-accent-dark ring-gray-50'
                    }`} />
                  </div>
                  <span className={`text-xs font-bold tracking-wider uppercase ${
                    darkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    {group.date}
                  </span>
                </div>

                {/* Entries */}
                <div className="space-y-1.5 ml-[39px]">
                  {group.entries.map(entry => {
                    const catStyle = getCategoryStyle(entry.category, darkMode);
                    const typeIcon = TYPE_ICONS[entry.changeType] || '✏️';
                    return (
                      <div
                        key={entry.id}
                        className={`rounded-xl px-4 py-3 border transition-colors ${
                          darkMode
                            ? 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                            : 'bg-white border-gray-200/80 hover:bg-gray-50/50'
                        }`}
                        title={formatFullTimestamp(entry.timestamp)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm flex-shrink-0">{typeIcon}</span>
                          <div className="flex-1 min-w-0">
                            <span className={`text-sm ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                              {entry.action}
                            </span>
                          </div>
                          <span className={`text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full border flex-shrink-0 ${catStyle.className}`}>
                            {catStyle.label}
                          </span>
                          <span className={`text-[11px] flex-shrink-0 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                            {formatTimestamp(entry.timestamp)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      {filtered.length > 0 && (
        <div className={`mt-8 text-center text-xs py-4 border-t ${
          darkMode ? 'text-gray-600 border-white/[0.06]' : 'text-gray-400 border-gray-200'
        }`}>
          {filtered.length} {filter === 'all' ? 'entries' : `${filter} entries`} shown
          {filter !== 'all' && ` (${entries.length} total)`}
        </div>
      )}
    </div>
  );
}
