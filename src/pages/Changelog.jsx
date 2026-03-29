import { useTournament } from '../context/TournamentContext';
import changelogData from '../data/changelog.json';

const TAG_STYLES = {
  'Bug Fix': { bg: 'bg-red-500/10 border-red-500/20 text-red-400', bgLight: 'bg-red-50 border-red-200/60 text-red-600', icon: '🐛' },
  'New Feature': { bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400', bgLight: 'bg-emerald-50 border-emerald-200/60 text-emerald-600', icon: '✨' },
  'Improvement': { bg: 'bg-blue-500/10 border-blue-500/20 text-blue-400', bgLight: 'bg-blue-50 border-blue-200/60 text-blue-600', icon: '🔧' },
  'Security Fix': { bg: 'bg-orange-500/10 border-orange-500/20 text-orange-400', bgLight: 'bg-orange-50 border-orange-200/60 text-orange-600', icon: '🛡️' },
};

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Group entries by date
function groupByDate(entries) {
  const groups = [];
  let currentDate = null;
  let currentGroup = null;
  for (const entry of entries) {
    if (entry.date !== currentDate) {
      currentDate = entry.date;
      currentGroup = { date: entry.date, entries: [] };
      groups.push(currentGroup);
    }
    currentGroup.entries.push(entry);
  }
  return groups;
}

export default function Changelog() {
  const { darkMode } = useTournament();

  // Reverse chronological order
  const sorted = [...changelogData].reverse();
  const groups = groupByDate(sorted);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Changelog
        </h1>
        <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          All changes, fixes, and new features — newest first.
        </p>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Timeline line */}
        <div className={`absolute left-[19px] top-2 bottom-2 w-px ${darkMode ? 'bg-white/[0.06]' : 'bg-gray-200'}`} />

        <div className="space-y-8">
          {groups.map(group => (
            <div key={group.date}>
              {/* Date header */}
              <div className="flex items-center gap-3 mb-4 relative">
                <div className={`w-[39px] flex justify-center flex-shrink-0`}>
                  <div className={`w-2.5 h-2.5 rounded-full ring-4 ${
                    darkMode
                      ? 'bg-accent ring-navy-950'
                      : 'bg-accent-dark ring-gray-50'
                  }`} />
                </div>
                <span className={`text-xs font-bold tracking-wider uppercase ${
                  darkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  {formatDate(group.date)}
                </span>
              </div>

              {/* Entries for this date */}
              <div className="space-y-3 ml-[39px]">
                {group.entries.map(entry => {
                  const tagStyle = TAG_STYLES[entry.tag] || TAG_STYLES['Improvement'];
                  return (
                    <div
                      key={entry.id}
                      className={`rounded-xl p-4 border transition-colors ${
                        darkMode
                          ? 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                          : 'bg-white border-gray-200/80 hover:bg-gray-50/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-lg flex-shrink-0 mt-0.5">{tagStyle.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <h3 className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                              {entry.title}
                            </h3>
                            <span className={`text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full border ${
                              darkMode ? tagStyle.bg : tagStyle.bgLight
                            }`}>
                              {entry.tag}
                            </span>
                          </div>
                          <p className={`text-sm leading-relaxed ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            {entry.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className={`mt-10 text-center text-xs py-4 border-t ${
        darkMode ? 'text-gray-600 border-white/[0.06]' : 'text-gray-400 border-gray-200'
      }`}>
        {changelogData.length} entries total
      </div>
    </div>
  );
}
