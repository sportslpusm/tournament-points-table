import { useMemo, useState } from 'react';
import { useTournament, useDispatch } from '../context/TournamentContext';
import { useAuth } from '../context/AuthContext';
import { ROUND_ORDER, ROUND_LABELS, advanceWinner, advanceLoserToThird } from '../utils/knockout';
import TeamLogo from './TeamLogo';
import Modal from './Modal';

export default function KnockoutFixtures({ gameId }) {
  const state = useTournament();
  const { dispatch, showToast } = useDispatch();
  const { isAdmin } = useAuth();
  const { knockoutMatches, teams, darkMode } = state;

  const [editMatch, setEditMatch] = useState(null);
  const [formResult, setFormResult] = useState(null);
  const [formExtraTime, setFormExtraTime] = useState(false);
  const [formPenalties, setFormPenalties] = useState(false);
  const [filterRound, setFilterRound] = useState('all');

  const gameMatches = useMemo(() =>
    knockoutMatches.filter(m => m.gameId === gameId),
    [knockoutMatches, gameId]
  );

  // Group by round
  const roundGroups = useMemo(() => {
    const groups = [];
    for (const round of ROUND_ORDER) {
      const matches = gameMatches
        .filter(m => m.round === round)
        .sort((a, b) => a.matchNumber - b.matchNumber);
      if (matches.length > 0 && (filterRound === 'all' || filterRound === round)) {
        groups.push({ round, label: ROUND_LABELS[round], matches });
      }
    }
    return groups;
  }, [gameMatches, filterRound]);

  const availableRounds = useMemo(() => {
    const rounds = new Set(gameMatches.map(m => m.round));
    return ROUND_ORDER.filter(r => rounds.has(r));
  }, [gameMatches]);

  function openEdit(match) {
    setEditMatch(match);
    setFormResult(match.result);
    setFormExtraTime(match.extraTime || false);
    setFormPenalties(match.penalties || false);
  }

  function handleSaveResult() {
    if (!editMatch || !formResult) {
      showToast('Please select a result', 'error');
      return;
    }

    dispatch({
      type: 'UPDATE_KNOCKOUT_MATCH',
      payload: {
        id: editMatch.id,
        status: 'completed',
        result: formResult,
        extraTime: formExtraTime,
        penalties: formPenalties,
      },
    });

    const updatedMatch = {
      ...editMatch,
      status: 'completed',
      result: formResult,
    };

    const allGameMatches = gameMatches.map(m =>
      m.id === editMatch.id ? updatedMatch : { ...m }
    );

    if (updatedMatch.nextMatchId) {
      const winnerId = formResult === 'teamA' ? updatedMatch.teamAId : updatedMatch.teamBId;
      const nextMatch = allGameMatches.find(m => m.id === updatedMatch.nextMatchId);
      if (nextMatch) {
        const slot = updatedMatch.slot;
        dispatch({
          type: 'UPDATE_KNOCKOUT_MATCH',
          payload: {
            id: nextMatch.id,
            [slot === 'teamA' ? 'teamAId' : 'teamBId']: winnerId,
          },
        });
      }
    }

    if (updatedMatch.round === 'sf') {
      const loserId = formResult === 'teamA' ? updatedMatch.teamBId : updatedMatch.teamAId;
      const thirdMatch = allGameMatches.find(m => m.round === 'third');
      if (thirdMatch) {
        const update = {};
        if (!thirdMatch.teamAId) {
          update.teamAId = loserId;
        } else if (!thirdMatch.teamBId) {
          update.teamBId = loserId;
        }
        if (Object.keys(update).length > 0) {
          dispatch({
            type: 'UPDATE_KNOCKOUT_MATCH',
            payload: { id: thirdMatch.id, ...update },
          });
        }
      }
    }

    showToast('Knockout match result saved');
    setEditMatch(null);
  }

  function getResultBadge(match) {
    const teamA = teams.find(t => t.id === match.teamAId);
    const teamB = teams.find(t => t.id === match.teamBId);

    if (match.status !== 'completed') {
      return { label: 'UPCOMING', cls: darkMode ? 'text-gray-500' : 'text-gray-400' };
    }
    if (match.result === 'bye') {
      const present = match.absentTeamId === match.teamAId ? teamB : teamA;
      return { label: `BYE - ${present?.shortCode}`, cls: 'text-bye' };
    }
    if (match.result === 'teamA') {
      let suffix = '';
      if (match.penalties) suffix = ' (PEN)';
      else if (match.extraTime) suffix = ' (AET)';
      return { label: `${teamA?.shortCode} won${suffix}`, cls: 'text-win' };
    }
    if (match.result === 'teamB') {
      let suffix = '';
      if (match.penalties) suffix = ' (PEN)';
      else if (match.extraTime) suffix = ' (AET)';
      return { label: `${teamB?.shortCode} won${suffix}`, cls: 'text-win' };
    }
    return { label: 'vs', cls: darkMode ? 'text-gray-500' : 'text-gray-400' };
  }

  if (gameMatches.length === 0) {
    return (
      <div className={`rounded-2xl p-8 text-center ${darkMode ? 'bg-navy-850/40 backdrop-blur backdrop-blur-xl' : 'bg-gray-50'}`}>
        <p className={darkMode ? 'text-gray-500' : 'text-gray-400'}>No knockout matches yet.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Round filter - pill style */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        <button
          onClick={() => setFilterRound('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
            filterRound === 'all'
              ? 'bg-accent text-navy-900 shadow-md shadow-accent/20'
              : darkMode ? 'bg-white/[0.04] text-gray-400 hover:bg-white/[0.06]' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          All Rounds
        </button>
        {availableRounds.map(round => (
          <button
            key={round}
            onClick={() => setFilterRound(round)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
              filterRound === round
                ? round === 'final' ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 text-gold shadow-md shadow-gold/10' : 'bg-accent text-navy-900 shadow-md shadow-accent/20'
                : darkMode ? 'bg-white/[0.04] text-gray-400 hover:bg-white/[0.06]' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {ROUND_LABELS[round]}
          </button>
        ))}
      </div>

      {/* Matches by round */}
      <div className="space-y-6">
        {roundGroups.map(({ round, label, matches }) => (
          <div key={round}>
            <h3 className={`section-heading tracking-tight mb-3 flex items-center gap-2 ${
              round === 'final' ? 'text-gold' : round === 'third' ? 'text-bronze' : darkMode ? 'text-gray-400' : 'text-gray-500'
            }`}>
              {round === 'final' && '🏆'} {label}
              <span className={`font-normal ${darkMode ? 'text-gray-600' : 'text-gray-300'}`}>
                ({matches.filter(m => m.status === 'completed').length}/{matches.length} played)
              </span>
            </h3>

            <div className="space-y-2">
              {matches.map(m => {
                const teamA = teams.find(t => t.id === m.teamAId);
                const teamB = teams.find(t => t.id === m.teamBId);
                const result = getResultBadge(m);
                const canEdit = m.teamAId && m.teamBId && m.status !== 'completed';
                const statusStripe = m.status === 'completed'
                  ? m.result === 'bye' ? 'border-l-bye' : 'border-l-win'
                  : 'border-l-transparent';

                return (
                  <div key={m.id} className={`rounded-xl p-3 border border-l-[3px] flex items-center gap-3 transition-all duration-200 ${statusStripe} ${
                    darkMode
                      ? 'bg-navy-850/40 backdrop-blur backdrop-blur-xl border-white/[0.06] hover:bg-navy-850/60'
                      : 'bg-white/80 backdrop-blur border-gray-200/80 hover:bg-white'
                  }`}>
                    <span className={`text-[10px] font-mono w-8 ${darkMode ? 'text-gray-600' : 'text-gray-300'}`}>
                      M{m.matchNumber}
                    </span>

                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-1">
                        {teamA ? (
                          <>
                            <TeamLogo team={teamA} size={24} />
                            <span className={`text-sm font-semibold truncate ${
                              m.result === 'teamA' ? 'text-win font-bold' : ''
                            }`}>
                              {teamA.shortCode}
                            </span>
                          </>
                        ) : (
                          <span className={`text-xs italic ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>TBD</span>
                        )}
                      </div>

                      <span className={`text-xs font-bold px-2 ${result.cls}`}>
                        {result.label}
                      </span>

                      <div className="flex items-center gap-1.5 flex-1 justify-end">
                        {teamB ? (
                          <>
                            <span className={`text-sm font-semibold truncate ${
                              m.result === 'teamB' ? 'text-win font-bold' : ''
                            }`}>
                              {teamB.shortCode}
                            </span>
                            <TeamLogo team={teamB} size={24} />
                          </>
                        ) : (
                          <span className={`text-xs italic ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>TBD</span>
                        )}
                      </div>
                    </div>

                    {isAdmin && canEdit && (
                      <button
                        onClick={() => openEdit(m)}
                        className="px-3 py-1 rounded-xl bg-accent/20 text-accent text-xs font-bold hover:bg-accent/30 transition-all duration-200 shadow-sm shadow-accent/20"
                      >
                        Enter Result
                      </button>
                    )}
                    {isAdmin && m.status === 'completed' && (
                      <button
                        onClick={() => openEdit(m)}
                        className={`p-1.5 rounded-xl text-sm transition-all duration-200 ${
                          darkMode ? 'hover:bg-white/[0.06] text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-700'
                        }`}
                        title="Edit result"
                      >
                        ✏️
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Result Entry Modal */}
      <Modal
        isOpen={!!editMatch}
        onClose={() => setEditMatch(null)}
        title={`${editMatch ? ROUND_LABELS[editMatch.round] : ''} - Match ${editMatch?.matchNumber || ''}`}
      >
        {editMatch && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-4 py-4">
              <div className="text-center">
                <TeamLogo team={teams.find(t => t.id === editMatch.teamAId)} size={48} />
                <p className={`text-sm font-bold mt-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {teams.find(t => t.id === editMatch.teamAId)?.name || 'TBD'}
                </p>
              </div>
              <span className="text-2xl font-bold text-accent">VS</span>
              <div className="text-center">
                <TeamLogo team={teams.find(t => t.id === editMatch.teamBId)} size={48} />
                <p className={`text-sm font-bold mt-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {teams.find(t => t.id === editMatch.teamBId)?.name || 'TBD'}
                </p>
              </div>
            </div>

            <div>
              <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Winner *</label>
              <p className={`text-xs mb-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>No draws allowed in knockout matches.</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'teamA', label: `${teams.find(t => t.id === editMatch.teamAId)?.shortCode || 'A'} Wins` },
                  { value: 'teamB', label: `${teams.find(t => t.id === editMatch.teamBId)?.shortCode || 'B'} Wins` },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFormResult(opt.value)}
                    className={`px-3 py-2.5 rounded-xl text-sm font-semibold border transition-all duration-200 ${
                      formResult === opt.value
                        ? 'bg-accent/20 border-accent text-accent'
                        : darkMode
                        ? 'bg-white/[0.04] border-white/[0.06] text-gray-300 hover:border-white/[0.15]'
                        : 'bg-gray-50 border-gray-300/80 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <label className={`flex items-center gap-2 text-sm cursor-pointer ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <input
                  type="checkbox"
                  checked={formExtraTime}
                  onChange={e => {
                    setFormExtraTime(e.target.checked);
                    if (!e.target.checked) setFormPenalties(false);
                  }}
                  className="rounded"
                />
                After Extra Time
              </label>
              <label className={`flex items-center gap-2 text-sm cursor-pointer ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <input
                  type="checkbox"
                  checked={formPenalties}
                  onChange={e => {
                    setFormPenalties(e.target.checked);
                    if (e.target.checked) setFormExtraTime(true);
                  }}
                  className="rounded"
                />
                Penalties
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setEditMatch(null)}
                className={`flex-1 px-4 py-2.5 rounded-xl transition-all duration-200 ${
                  darkMode ? 'bg-white/[0.06] text-gray-300 hover:bg-white/[0.1]' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveResult}
                className="flex-1 px-4 py-2.5 rounded-xl bg-accent text-navy-900 font-bold hover:bg-accent-dark transition-all duration-200 shadow-sm shadow-accent/20"
              >
                Save Result
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
