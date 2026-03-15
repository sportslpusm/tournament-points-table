import { useState, useMemo } from 'react';
import { useTournament, useDispatch } from '../context/TournamentContext';
import { useAuth } from '../context/AuthContext';
import { ROUND_LABELS } from '../utils/knockout';
import Modal, { ConfirmDialog } from '../components/Modal';
import TeamLogo from '../components/TeamLogo';
import EmptyState from '../components/EmptyState';

export default function MatchManagement() {
  const state = useTournament();
  const { dispatch, showToast } = useDispatch();
  const { isAdmin } = useAuth();
  const { games, pools, matches, teams, darkMode, knockoutMatches, knockoutConfig } = state;

  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editMatch, setEditMatch] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [filterGame, setFilterGame] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');

  // Add/Edit form state
  const [formPoolId, setFormPoolId] = useState('');
  const [formTeamA, setFormTeamA] = useState('');
  const [formTeamB, setFormTeamB] = useState('');
  const [formStatus, setFormStatus] = useState('upcoming');
  const [formResult, setFormResult] = useState(null);
  const [formAbsent, setFormAbsent] = useState('');

  // Enriched pool matches
  const enrichedMatches = useMemo(() => {
    const poolEnriched = matches.map(m => {
      const pool = pools.find(p => p.id === m.poolId);
      const game = pool ? games.find(g => g.id === pool.gameId) : null;
      const teamA = teams.find(t => t.id === m.teamAId);
      const teamB = teams.find(t => t.id === m.teamBId);
      return { ...m, pool, game, teamA, teamB, matchType: 'pool' };
    });

    const koEnriched = knockoutMatches.map(m => {
      const game = games.find(g => g.id === m.gameId);
      const teamA = teams.find(t => t.id === m.teamAId);
      const teamB = teams.find(t => t.id === m.teamBId);
      return { ...m, game, teamA, teamB, matchType: 'knockout', pool: null };
    });

    return [...poolEnriched, ...koEnriched].filter(m => {
      if (filterGame !== 'all' && m.game?.id !== filterGame) return false;
      if (filterStatus !== 'all' && m.status !== filterStatus) return false;
      if (filterType === 'pool' && m.matchType !== 'pool') return false;
      if (filterType === 'knockout' && m.matchType !== 'knockout') return false;
      return true;
    });
  }, [matches, knockoutMatches, pools, games, teams, filterGame, filterStatus, filterType]);

  function resetForm() {
    setFormPoolId('');
    setFormTeamA('');
    setFormTeamB('');
    setFormStatus('upcoming');
    setFormResult(null);
    setFormAbsent('');
  }

  function openAdd() {
    resetForm();
    setEditMatch(null);
    setShowAddModal(true);
  }

  function openEdit(match) {
    setEditMatch(match);
    setFormPoolId(match.poolId || '');
    setFormTeamA(match.teamAId);
    setFormTeamB(match.teamBId);
    setFormStatus(match.status);
    setFormResult(match.result);
    setFormAbsent(match.absentTeamId || '');
    setShowAddModal(true);
  }

  function handleSave() {
    if (!editMatch) {
      if (!formPoolId || !formTeamA || !formTeamB) {
        showToast('Please fill in all required fields', 'error');
        return;
      }
      if (formTeamA === formTeamB) {
        showToast('A team cannot play against itself', 'error');
        return;
      }

      const dup = matches.find(m =>
        m.poolId === formPoolId &&
        ((m.teamAId === formTeamA && m.teamBId === formTeamB) ||
         (m.teamAId === formTeamB && m.teamBId === formTeamA))
      );
      if (dup) {
        showToast('This match already exists in this pool', 'error');
        return;
      }

      dispatch({
        type: 'ADD_MATCH',
        payload: {
          poolId: formPoolId,
          teamAId: formTeamA,
          teamBId: formTeamB,
          status: formStatus,
          result: formStatus === 'completed' ? formResult : null,
          absentTeamId: formResult === 'bye' ? formAbsent : null,
        },
      });
      showToast('Match added successfully');
    } else if (editMatch.matchType === 'knockout') {
      const payload = {
        id: editMatch.id,
        status: formStatus,
        result: formStatus === 'completed' ? formResult : null,
        absentTeamId: formResult === 'bye' ? formAbsent : null,
      };

      dispatch({ type: 'UPDATE_KNOCKOUT_MATCH', payload });

      if (formStatus === 'completed' && formResult && editMatch.nextMatchId) {
        const winnerId = formResult === 'teamA' ? editMatch.teamAId : editMatch.teamBId;
        const slot = editMatch.slot;
        dispatch({
          type: 'UPDATE_KNOCKOUT_MATCH',
          payload: {
            id: editMatch.nextMatchId,
            [slot === 'teamA' ? 'teamAId' : 'teamBId']: winnerId,
          },
        });
      }

      if (formStatus === 'completed' && formResult && editMatch.round === 'sf') {
        const loserId = formResult === 'teamA' ? editMatch.teamBId : editMatch.teamAId;
        const thirdMatch = knockoutMatches.find(m => m.round === 'third' && m.gameId === editMatch.gameId);
        if (thirdMatch) {
          const update = {};
          if (!thirdMatch.teamAId) update.teamAId = loserId;
          else if (!thirdMatch.teamBId) update.teamBId = loserId;
          if (Object.keys(update).length > 0) {
            dispatch({ type: 'UPDATE_KNOCKOUT_MATCH', payload: { id: thirdMatch.id, ...update } });
          }
        }
      }

      showToast('Knockout match updated');
    } else {
      dispatch({
        type: 'UPDATE_MATCH',
        payload: {
          id: editMatch.id,
          poolId: formPoolId,
          teamAId: formTeamA,
          teamBId: formTeamB,
          status: formStatus,
          result: formStatus === 'completed' ? formResult : null,
          absentTeamId: formResult === 'bye' ? formAbsent : null,
        },
      });
      showToast('Match updated successfully');
    }
    setShowAddModal(false);
    resetForm();
  }

  function handleDelete() {
    if (deleteId) {
      const isKo = knockoutMatches.some(m => m.id === deleteId);
      if (isKo) {
        dispatch({ type: 'DELETE_KNOCKOUT_MATCH', payload: deleteId });
      } else {
        dispatch({ type: 'DELETE_MATCH', payload: deleteId });
      }
      showToast('Match deleted');
      setDeleteId(null);
    }
  }

  // Bulk result entry (pool matches only)
  const [bulkResults, setBulkResults] = useState({});
  const upcomingPoolMatches = useMemo(() => {
    return matches.filter(m => m.status === 'upcoming').map(m => ({
      ...m,
      teamA: teams.find(t => t.id === m.teamAId),
      teamB: teams.find(t => t.id === m.teamBId),
      pool: pools.find(p => p.id === m.poolId),
      game: (() => { const p = pools.find(p2 => p2.id === m.poolId); return p ? games.find(g => g.id === p.gameId) : null; })(),
    }));
  }, [matches, teams, pools, games]);

  function openBulk() {
    setBulkResults({});
    setShowBulkModal(true);
  }

  function handleBulkSave() {
    let count = 0;
    for (const [matchId, data] of Object.entries(bulkResults)) {
      if (!data.result) continue;
      dispatch({
        type: 'UPDATE_MATCH',
        payload: {
          id: matchId,
          status: 'completed',
          result: data.result,
          absentTeamId: data.result === 'bye' ? data.absentTeamId : null,
        },
      });
      count++;
    }
    showToast(`${count} match result${count !== 1 ? 's' : ''} saved`);
    setShowBulkModal(false);
  }

  const availableTeams = useMemo(() => {
    if (!formPoolId) return [];
    const pool = pools.find(p => p.id === formPoolId);
    if (!pool) return [];
    return pool.teamIds.map(tid => teams.find(t => t.id === tid)).filter(Boolean);
  }, [formPoolId, pools, teams]);

  const isEditingKnockout = editMatch?.matchType === 'knockout';

  const inputCls = `w-full px-3 py-2 rounded-lg text-sm border ${
    darkMode ? 'bg-navy-800 border-white/10 text-white [&>option]:bg-navy-800 [&>option]:text-white' : 'bg-white border-gray-300 text-gray-900'
  }`;

  const selectCls = inputCls;

  if (pools.length === 0 && knockoutMatches.length === 0) {
    return (
      <EmptyState
        icon="📋"
        title="No pools yet"
        description="Create games and pools first, then add matches."
        action={{ label: 'Go to Game Management', onClick: () => dispatch({ type: 'SET_VIEW', payload: { view: 'gameManagement' } }) }}
      />
    );
  }

  function getStatusStripe(m) {
    if (m.status === 'completed') return m.result === 'draw' ? 'border-l-draw' : m.result === 'bye' ? 'border-l-bye' : 'border-l-win';
    if (m.status === 'live') return 'border-l-accent';
    return 'border-l-transparent';
  }

  return (
    <div className="animate-slideUp">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-bold">Match Management</h2>
        {isAdmin && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={openAdd} className="px-4 py-2 bg-accent text-navy-900 font-bold text-sm rounded-lg hover:bg-accent-dark transition-colors">
              + Add Match
            </button>
            {upcomingPoolMatches.length > 0 && (
              <button onClick={openBulk} className={`px-4 py-2 font-medium text-sm rounded-lg transition-colors ${
                darkMode ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}>
                Bulk Entry
              </button>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <select value={filterGame} onChange={e => setFilterGame(e.target.value)} className={selectCls} style={{width: 'auto'}}>
          <option value="all">All Games</option>
          {games.map(g => <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={selectCls} style={{width: 'auto'}}>
          <option value="all">All Status</option>
          <option value="upcoming">Upcoming</option>
          <option value="live">Live</option>
          <option value="completed">Completed</option>
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className={selectCls} style={{width: 'auto'}}>
          <option value="all">All Types</option>
          <option value="pool">Pool Matches</option>
          <option value="knockout">Knockout Matches</option>
        </select>
      </div>

      {/* Match List */}
      {enrichedMatches.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No matches found"
          description="Add matches or adjust your filters."
        />
      ) : (
        <div className="space-y-2">
          {enrichedMatches.map(m => {
            const statusBg = m.status === 'completed' ? 'bg-win/10 text-win' : m.status === 'live' ? 'bg-accent/10 text-accent animate-pulseLive' : darkMode ? 'bg-white/5 text-gray-500' : 'bg-gray-100 text-gray-400';
            return (
              <div key={m.id} className={`rounded-xl p-4 border border-l-[3px] transition-all ${getStatusStripe(m)} ${
                darkMode
                  ? 'bg-navy-800/40 backdrop-blur border-white/5 hover:bg-navy-800/60'
                  : 'bg-white/80 backdrop-blur border-gray-200 hover:bg-white'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {m.game && <span className="text-lg">{m.game.emoji}</span>}
                    <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      {m.game?.name} · {m.matchType === 'knockout' ? ROUND_LABELS[m.round] || m.round : m.pool?.name}
                    </span>
                    {m.matchType === 'knockout' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent font-bold">KO</span>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBg}`}>
                    {m.status.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex items-center gap-2 flex-1">
                      {m.teamA ? (
                        <>
                          <TeamLogo team={m.teamA} size={32} />
                          <div>
                            <div className={`font-medium text-sm ${m.result === 'teamA' ? 'text-win font-bold' : m.result === 'bye' && m.absentTeamId === m.teamAId ? 'text-gray-500 line-through' : ''}`}>
                              {m.teamA?.name || '?'}
                            </div>
                          </div>
                        </>
                      ) : (
                        <span className={`text-sm italic ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>TBD</span>
                      )}
                    </div>
                    <div className={`px-3 py-1 rounded text-xs font-bold ${
                      m.result === 'draw' ? 'bg-draw/20 text-draw' :
                      m.result === 'bye' ? 'bg-bye/20 text-bye' :
                      m.result ? (darkMode ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-500') :
                      darkMode ? 'bg-white/5 text-gray-600' : 'bg-gray-50 text-gray-300'
                    }`}>
                      {m.result === 'draw' ? 'DRAW' : m.result === 'bye' ? 'BYE' : 'vs'}
                    </div>
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      {m.teamB ? (
                        <>
                          <div className="text-right">
                            <div className={`font-medium text-sm ${m.result === 'teamB' ? 'text-win font-bold' : m.result === 'bye' && m.absentTeamId === m.teamBId ? 'text-gray-500 line-through' : ''}`}>
                              {m.teamB?.name || '?'}
                            </div>
                          </div>
                          <TeamLogo team={m.teamB} size={32} />
                        </>
                      ) : (
                        <span className={`text-sm italic ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>TBD</span>
                      )}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 ml-3">
                      <button
                        onClick={() => openEdit(m)}
                        className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-700'}`}
                        title="Edit"
                        aria-label="Edit match"
                      >
                        ✏️
                      </button>
                      {m.matchType === 'pool' && (
                        <button
                          onClick={() => setDeleteId(m.id)}
                          className="p-2 rounded-lg hover:bg-red-900/30 text-gray-400 hover:text-red-400 transition-colors"
                          title="Delete"
                          aria-label="Delete match"
                        >
                          🗑
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {m.penalties && <span className="text-[10px] text-draw mt-1 block">Won on penalties</span>}
                {m.extraTime && !m.penalties && <span className="text-[10px] text-draw mt-1 block">Won after extra time</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal - admin only */}
      {isAdmin && <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={editMatch ? (isEditingKnockout ? `Edit Knockout Match - ${ROUND_LABELS[editMatch.round] || ''}` : 'Edit Match') : 'Add Match'}
      >
        <div className="space-y-4">
          {!isEditingKnockout && (
            <>
              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Pool *</label>
                <select
                  value={formPoolId}
                  onChange={e => { setFormPoolId(e.target.value); setFormTeamA(''); setFormTeamB(''); }}
                  className={inputCls}
                  disabled={!!editMatch}
                >
                  <option value="">Select Pool</option>
                  {games.map(g => {
                    const gamePools = pools.filter(p => p.gameId === g.id);
                    return gamePools.map(p => (
                      <option key={p.id} value={p.id}>{g.emoji} {g.name} - {p.name}</option>
                    ));
                  })}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Team A *</label>
                  <select value={formTeamA} onChange={e => setFormTeamA(e.target.value)} className={inputCls} disabled={!!editMatch}>
                    <option value="">Select</option>
                    {availableTeams.filter(t => t.id !== formTeamB).map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Team B *</label>
                  <select value={formTeamB} onChange={e => setFormTeamB(e.target.value)} className={inputCls} disabled={!!editMatch}>
                    <option value="">Select</option>
                    {availableTeams.filter(t => t.id !== formTeamA).map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          {isEditingKnockout && (
            <div className="flex items-center justify-center gap-4 py-2">
              <div className="text-center">
                <TeamLogo team={teams.find(t => t.id === editMatch.teamAId)} size={40} />
                <p className="text-xs font-bold mt-1">
                  {teams.find(t => t.id === editMatch.teamAId)?.name || 'TBD'}
                </p>
              </div>
              <span className="text-xl font-bold text-accent">VS</span>
              <div className="text-center">
                <TeamLogo team={teams.find(t => t.id === editMatch.teamBId)} size={40} />
                <p className="text-xs font-bold mt-1">
                  {teams.find(t => t.id === editMatch.teamBId)?.name || 'TBD'}
                </p>
              </div>
            </div>
          )}

          <div>
            <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Status</label>
            <select
              value={formStatus}
              onChange={e => { setFormStatus(e.target.value); if (e.target.value !== 'completed') { setFormResult(null); setFormAbsent(''); } }}
              className={inputCls}
            >
              <option value="upcoming">Upcoming</option>
              <option value="live">Live</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          {formStatus === 'completed' && (
            <div>
              <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Result *</label>
              {isEditingKnockout && (
                <p className={`text-xs mb-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>No draws allowed in knockout matches.</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'teamA', label: `${teams.find(t => t.id === (editMatch?.teamAId || formTeamA))?.shortCode || 'A'} Wins` },
                  { value: 'teamB', label: `${teams.find(t => t.id === (editMatch?.teamBId || formTeamB))?.shortCode || 'B'} Wins` },
                  ...(!isEditingKnockout ? [
                    { value: 'draw', label: 'Draw' },
                    { value: 'bye', label: 'Bye' },
                  ] : []),
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFormResult(opt.value)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                      formResult === opt.value
                        ? 'bg-accent/20 border-accent text-accent'
                        : darkMode
                        ? 'bg-white/5 border-white/10 text-gray-300 hover:border-white/20'
                        : 'bg-gray-50 border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {formResult === 'bye' && !isEditingKnockout && (
                <div className="mt-3">
                  <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Absent Team *</label>
                  <select value={formAbsent} onChange={e => setFormAbsent(e.target.value)} className={inputCls}>
                    <option value="">Select absent team</option>
                    <option value={editMatch?.teamAId || formTeamA}>{teams.find(t => t.id === (editMatch?.teamAId || formTeamA))?.name}</option>
                    <option value={editMatch?.teamBId || formTeamB}>{teams.find(t => t.id === (editMatch?.teamBId || formTeamB))?.name}</option>
                  </select>
                </div>
              )}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowAddModal(false)} className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
              darkMode ? 'bg-white/10 text-gray-300 hover:bg-white/15' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}>
              Cancel
            </button>
            <button onClick={handleSave} className="flex-1 px-4 py-2 rounded-lg bg-accent text-navy-900 font-bold hover:bg-accent-dark transition-colors">
              {editMatch ? 'Update' : 'Add'} Match
            </button>
          </div>
        </div>
      </Modal>}

      {/* Bulk Entry Modal - admin only */}
      {isAdmin && <Modal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        title="Bulk Result Entry"
        size="lg"
      >
        <div className="space-y-3">
          <p className={`text-sm mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Quickly enter results for upcoming pool matches.</p>
          {upcomingPoolMatches.map(m => (
            <div key={m.id} className={`flex items-center gap-3 p-3 rounded-lg ${
              darkMode ? 'bg-white/5' : 'bg-gray-50'
            }`}>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-sm">{m.game?.emoji}</span>
                <TeamLogo team={m.teamA} size={24} />
                <span className="text-sm font-medium truncate">{m.teamA?.shortCode}</span>
                <span className={`text-xs ${darkMode ? 'text-gray-600' : 'text-gray-300'}`}>vs</span>
                <span className="text-sm font-medium truncate">{m.teamB?.shortCode}</span>
                <TeamLogo team={m.teamB} size={24} />
              </div>
              <select
                value={bulkResults[m.id]?.result || ''}
                onChange={e => {
                  const result = e.target.value || null;
                  setBulkResults(prev => ({
                    ...prev,
                    [m.id]: { result, absentTeamId: null },
                  }));
                }}
                className={`px-2 py-1.5 rounded text-xs border ${
                  darkMode ? 'bg-navy-800 border-white/10 text-white [&>option]:bg-navy-800 [&>option]:text-white' : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value="">-- Select --</option>
                <option value="teamA">{m.teamA?.shortCode} Wins</option>
                <option value="teamB">{m.teamB?.shortCode} Wins</option>
                <option value="draw">Draw</option>
                <option value="bye">Bye</option>
              </select>
              {bulkResults[m.id]?.result === 'bye' && (
                <select
                  value={bulkResults[m.id]?.absentTeamId || ''}
                  onChange={e => setBulkResults(prev => ({
                    ...prev,
                    [m.id]: { ...prev[m.id], absentTeamId: e.target.value },
                  }))}
                  className={`px-2 py-1.5 rounded text-xs border ${
                    darkMode ? 'bg-navy-800 border-white/10 text-white [&>option]:bg-navy-800 [&>option]:text-white' : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="">Absent?</option>
                  <option value={m.teamAId}>{m.teamA?.shortCode}</option>
                  <option value={m.teamBId}>{m.teamB?.shortCode}</option>
                </select>
              )}
            </div>
          ))}
          <div className="flex gap-3 pt-4">
            <button onClick={() => setShowBulkModal(false)} className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
              darkMode ? 'bg-white/10 text-gray-300' : 'bg-gray-100 text-gray-700'
            }`}>
              Cancel
            </button>
            <button onClick={handleBulkSave} className="flex-1 px-4 py-2 rounded-lg bg-accent text-navy-900 font-bold transition-colors hover:bg-accent-dark">
              Save All Results
            </button>
          </div>
        </div>
      </Modal>}

      {/* Delete Confirm - admin only */}
      {isAdmin && <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Match"
        message="Are you sure you want to delete this match? Points will be recalculated."
      />}
    </div>
  );
}
