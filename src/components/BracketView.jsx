import { useMemo } from 'react';
import { useTournament } from '../context/TournamentContext';
import { ROUND_LABELS } from '../utils/knockout';
import TeamLogo from './TeamLogo';

function MatchCard({ match, teams, darkMode }) {
  const teamA = teams.find(t => t.id === match.teamAId);
  const teamB = teams.find(t => t.id === match.teamBId);
  const isCompleted = match.status === 'completed';

  const aWon = isCompleted && match.result === 'teamA';
  const bWon = isCompleted && match.result === 'teamB';

  return (
    <div className={`rounded-lg border overflow-hidden w-52 flex-shrink-0 transition-all ${
      darkMode
        ? 'bg-navy-800/60 backdrop-blur border-white/5'
        : 'bg-white/80 backdrop-blur border-gray-200'
    } ${isCompleted ? '' : 'opacity-80'}`}>
      {/* Match number */}
      <div className={`px-2 py-0.5 text-[10px] font-mono flex items-center justify-between ${
        darkMode ? 'bg-white/[0.03] text-gray-500' : 'bg-gray-50 text-gray-400'
      }`}>
        <span>M{match.matchNumber}</span>
        {match.penalties && <span className="text-draw">PEN</span>}
        {match.extraTime && !match.penalties && <span className="text-draw">AET</span>}
      </div>

      {/* Team A */}
      <div className={`flex items-center gap-2 px-2 py-1.5 border-b ${
        darkMode ? 'border-white/5' : 'border-gray-100'
      } ${aWon ? 'bg-win/10 border-l-[3px] border-l-win' : 'border-l-[3px] border-l-transparent'}`}>
        {teamA ? (
          <>
            <TeamLogo team={teamA} size={20} />
            <span className={`text-xs font-medium flex-1 truncate ${aWon ? 'text-win font-bold' : ''}`}>
              {teamA.shortCode}
            </span>
          </>
        ) : (
          <span className={`text-xs italic flex-1 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>TBD</span>
        )}
        {isCompleted && aWon && <span className="text-win text-xs font-bold">W</span>}
      </div>

      {/* Team B */}
      <div className={`flex items-center gap-2 px-2 py-1.5 ${
        bWon ? 'bg-win/10 border-l-[3px] border-l-win' : 'border-l-[3px] border-l-transparent'
      }`}>
        {teamB ? (
          <>
            <TeamLogo team={teamB} size={20} />
            <span className={`text-xs font-medium flex-1 truncate ${bWon ? 'text-win font-bold' : ''}`}>
              {teamB.shortCode}
            </span>
          </>
        ) : (
          <span className={`text-xs italic flex-1 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>TBD</span>
        )}
        {isCompleted && bWon && <span className="text-win text-xs font-bold">W</span>}
      </div>
    </div>
  );
}

export default function BracketView({ gameId }) {
  const state = useTournament();
  const { knockoutMatches, teams, darkMode } = state;

  const gameMatches = useMemo(() =>
    knockoutMatches.filter(m => m.gameId === gameId),
    [knockoutMatches, gameId]
  );

  // Group by rounds (maintain order)
  const roundGroups = useMemo(() => {
    const mainRounds = ['ro32', 'ro16', 'qf', 'sf', 'final'];
    const groups = [];

    for (const round of mainRounds) {
      const matches = gameMatches
        .filter(m => m.round === round)
        .sort((a, b) => a.matchNumber - b.matchNumber);
      if (matches.length > 0) {
        groups.push({ round, label: ROUND_LABELS[round], matches });
      }
    }

    return groups;
  }, [gameMatches]);

  // Third place match separate
  const thirdMatch = useMemo(() =>
    gameMatches.find(m => m.round === 'third'),
    [gameMatches]
  );

  if (gameMatches.length === 0) {
    return (
      <div className={`rounded-xl p-8 text-center ${darkMode ? 'bg-navy-800/40 backdrop-blur' : 'bg-gray-50'}`}>
        <p className={darkMode ? 'text-gray-500' : 'text-gray-400'}>No bracket generated yet. Advance to knockout stage to see the bracket.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Main bracket - horizontal scroll */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-6 min-w-max items-start px-2 py-4">
          {roundGroups.map(({ round, label, matches }) => (
            <div key={round} className="flex flex-col items-center">
              {/* Round header */}
              <div className={`text-xs font-bold uppercase tracking-wider mb-3 px-4 py-1.5 rounded-full ${
                round === 'final'
                  ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 text-gold shadow-lg shadow-gold/10'
                  : darkMode ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-500'
              }`}>
                {label}
              </div>

              {/* Matches in this round */}
              <div className="flex flex-col justify-around flex-1" style={{
                gap: round === 'final' ? '0px' :
                     round === 'sf' ? '48px' :
                     round === 'qf' ? '24px' :
                     round === 'ro16' ? '12px' : '8px',
                paddingTop: round === 'final' ? `${(matches.length > 0 ? (roundGroups[0]?.matches.length || 1) * 30 : 0)}px` :
                            round === 'sf' ? `${Math.max(0, ((roundGroups[0]?.matches.length || 1) - 2) * 20)}px` : '0px',
              }}>
                {matches.map(match => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    teams={teams}
                    darkMode={darkMode}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3rd Place Match */}
      {thirdMatch && (
        <div className={`rounded-xl p-4 border ${
          darkMode ? 'bg-navy-800/40 backdrop-blur border-white/5' : 'bg-gray-50 border-gray-200'
        }`}>
          <h4 className="text-xs font-bold uppercase tracking-wider text-bronze mb-3">
            3rd Place Match
          </h4>
          <MatchCard match={thirdMatch} teams={teams} darkMode={darkMode} />
        </div>
      )}
    </div>
  );
}
