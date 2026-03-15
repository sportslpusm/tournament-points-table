import { useTournament } from '../context/TournamentContext';
import TeamLogo from './TeamLogo';

export default function QualificationPanel({ gameId }) {
  const state = useTournament();
  const { qualifiedTeams, pools, teams, matches, knockoutConfig, darkMode } = state;

  const config = knockoutConfig[gameId];
  const gamePools = pools.filter(p => p.gameId === gameId);
  const qualified = qualifiedTeams[gameId] || [];

  const poolIds = gamePools.map(p => p.id);
  const poolMatches = matches.filter(m => poolIds.includes(m.poolId));
  const remaining = poolMatches.filter(m => m.status !== 'completed').length;

  if (gamePools.length === 0) return null;

  return (
    <div className={`rounded-xl border p-4 ${
      darkMode
        ? 'bg-navy-800/40 backdrop-blur border-white/5'
        : 'bg-white/80 backdrop-blur border-gray-200'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`section-heading ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Qualification Summary</h3>
        {remaining > 0 ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-draw/10 text-draw">
            {remaining} pool match{remaining !== 1 ? 'es' : ''} remaining
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-full bg-win/10 text-win">
            Qualification complete
          </span>
        )}
      </div>

      <p className={`text-xs mb-3 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
        Top {config?.qualifyCount || 2} from each pool advance
      </p>

      <div className="space-y-3">
        {gamePools.map(pool => {
          const poolQualified = qualified.filter(q => q.poolId === pool.id);

          return (
            <div key={pool.id} className={`rounded-lg p-3 ${darkMode ? 'bg-white/[0.03]' : 'bg-gray-50'}`}>
              <div className={`text-xs font-semibold mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{pool.name}</div>
              {poolQualified.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {poolQualified.map(q => {
                    const team = teams.find(t => t.id === q.teamId);
                    return (
                      <div key={q.teamId} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-win/10 border border-win/20">
                        <TeamLogo team={team} size={18} />
                        <span className="text-xs font-medium text-win">{team?.shortCode}</span>
                        <span className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>({q.rank}{q.rank === 1 ? 'st' : 'nd'})</span>
                        {q.manual && <span className="text-[10px] text-draw">M</span>}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className={`text-xs italic ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>No qualifiers yet</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
