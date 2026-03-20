import { useState, useMemo } from 'react';
import { useTournament, useDispatch } from '../context/TournamentContext';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_LOBBY_POINTS, getLobbyGameStandings } from '../utils/lobbyPoints';
import TeamLogo from '../components/TeamLogo';
import PointsExplainer from '../components/PointsExplainer';

export default function LobbyGameView() {
  const state = useTournament();
  const { dispatch } = useDispatch();
  const { isAdmin } = useAuth();
  const { games, teams, selectedGameId, darkMode, lobbyEntries, lobbyResults, lobbyPointsConfig, lobbyGameStatus } = state;
  const isCompleted = lobbyGameStatus[selectedGameId] === 'completed';
  const game = games.find(g => g.id === selectedGameId);

  const config = lobbyPointsConfig[selectedGameId] || DEFAULT_LOBBY_POINTS;

  const gameEntries = useMemo(() =>
    lobbyEntries.filter(e => e.gameId === selectedGameId),
    [lobbyEntries, selectedGameId]
  );

  const gameResults = useMemo(() =>
    lobbyResults.filter(r => r.gameId === selectedGameId),
    [lobbyResults, selectedGameId]
  );

  const standings = useMemo(() =>
    getLobbyGameStandings(selectedGameId, lobbyResults, lobbyEntries, teams, lobbyPointsConfig),
    [selectedGameId, lobbyResults, lobbyEntries, teams, lobbyPointsConfig]
  );

  // Derive podium from entry-level placements (allows same school in multiple positions)
  const podiumTeams = useMemo(() => {
    if (gameResults.length === 0) return [];
    const entryMap = new Map(gameEntries.map(e => [e.id, e]));

    // Aggregate placement points per entry across all sessions
    const entryPoints = new Map();
    for (const session of gameResults) {
      const p = session.placements || {};
      if (p.first) entryPoints.set(p.first, (entryPoints.get(p.first) || 0) + (config.first || 0));
      if (p.second) entryPoints.set(p.second, (entryPoints.get(p.second) || 0) + (config.second || 0));
      if (p.third) entryPoints.set(p.third, (entryPoints.get(p.third) || 0) + (config.third || 0));
    }

    // Sort entries by placement points (desc), then map to team
    const sorted = [...entryPoints.entries()].sort((a, b) => b[1] - a[1]);
    const result = [];
    for (const [entryId] of sorted) {
      const entry = entryMap.get(entryId);
      if (!entry) continue;
      const team = teams.find(t => t.id === entry.teamId);
      if (!team) continue;
      result.push({ team, entryName: entry.entryName || team.shortCode });
      if (result.length >= 3) break;
    }
    return result;
  }, [gameResults, gameEntries, teams, config]);

  // ── Entry form state ──
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [editEntryObj, setEditEntryObj] = useState(null);
  const [entryTeamId, setEntryTeamId] = useState('');
  const [entryName, setEntryName] = useState('');

  // ── Session form state ──
  const [showForm, setShowForm] = useState(false);
  const [editSession, setEditSession] = useState(null);
  const [sessionName, setSessionName] = useState('');
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [third, setThird] = useState('');
  const [participantIds, setParticipantIds] = useState([]);

  // ── Points config state ──
  const [showConfig, setShowConfig] = useState(false);
  const [cfgFirst, setCfgFirst] = useState(config.first);
  const [cfgSecond, setCfgSecond] = useState(config.second);
  const [cfgThird, setCfgThird] = useState(config.third);
  const [cfgParticipation, setCfgParticipation] = useState(config.participation);
  const [cfgCap, setCfgCap] = useState(config.maxParticipationCap === Infinity ? '' : config.maxParticipationCap);
  const [cfgMaxEntries, setCfgMaxEntries] = useState(config.maxEntriesPerSchool || 1);

  // ── Entry helpers ──
  const maxEntries = config.maxEntriesPerSchool || 1;
  function getEntryDisplayName(entryId) {
    const entry = gameEntries.find(e => e.id === entryId);
    if (!entry) return '?';
    const team = teams.find(t => t.id === entry.teamId);
    const schoolName = team?.shortCode || team?.name || '?';
    return entry.entryName ? `${schoolName} – ${entry.entryName}` : schoolName;
  }

  function getEntryTeam(entryId) {
    const entry = gameEntries.find(e => e.id === entryId);
    if (!entry) return null;
    return teams.find(t => t.id === entry.teamId) || null;
  }

  // ── Entry CRUD ──
  function openNewEntry() {
    setEditEntryObj(null);
    setEntryTeamId(teams[0]?.id || '');
    setEntryName('');
    setShowEntryForm(true);
  }

  function openEditEntry(entry) {
    setEditEntryObj(entry);
    setEntryTeamId(entry.teamId);
    setEntryName(entry.entryName || '');
    setShowEntryForm(true);
  }

  function handleSaveEntry() {
    if (!entryTeamId) return;
    const schoolEntries = gameEntries.filter(e => e.teamId === entryTeamId && e.id !== editEntryObj?.id);
    // Check cap
    if (!editEntryObj && schoolEntries.length >= maxEntries) {
      alert(`This school already has ${maxEntries} ${maxEntries === 1 ? 'entry' : 'entries'} (max per school for this game).`);
      return;
    }
    // If school will have >1 entry, name is mandatory
    const willHaveMultiple = schoolEntries.length >= 1;
    if (willHaveMultiple && !entryName.trim()) {
      alert('Team name is required when a school has more than one entry.');
      return;
    }
    if (editEntryObj) {
      dispatch({ type: 'UPDATE_LOBBY_ENTRY', payload: { id: editEntryObj.id, teamId: entryTeamId, entryName: entryName.trim() } });
    } else {
      dispatch({ type: 'ADD_LOBBY_ENTRY', payload: { gameId: selectedGameId, teamId: entryTeamId, entryName: entryName.trim() } });
    }
    setShowEntryForm(false);
  }

  function handleDeleteEntry(id) {
    if (confirm('Delete this entry? It will be removed from all sessions.')) {
      dispatch({ type: 'DELETE_LOBBY_ENTRY', payload: id });
    }
  }

  // ── Session CRUD ──
  function openNewSession() {
    setEditSession(null);
    setSessionName(`Session ${gameResults.length + 1}`);
    setFirst('');
    setSecond('');
    setThird('');
    setParticipantIds([]);
    setShowForm(true);
  }

  function openEditSession(session) {
    setEditSession(session);
    setSessionName(session.sessionName);
    const p = session.placements || {};
    setFirst(p.first || '');
    setSecond(p.second || '');
    setThird(p.third || '');
    setParticipantIds(session.participantEntryIds || []);
    setShowForm(true);
  }

  function handleSaveSession() {
    if (!sessionName.trim()) return;
    const payload = {
      gameId: selectedGameId,
      sessionName: sessionName.trim(),
      placements: { first: first || null, second: second || null, third: third || null },
      participantEntryIds: participantIds,
    };
    if (editSession) {
      dispatch({ type: 'UPDATE_LOBBY_RESULT', payload: { id: editSession.id, ...payload } });
    } else {
      dispatch({ type: 'ADD_LOBBY_RESULT', payload });
    }
    setShowForm(false);
  }

  function handleDeleteSession(id) {
    if (confirm('Delete this session result?')) {
      dispatch({ type: 'DELETE_LOBBY_RESULT', payload: id });
    }
  }

  function handleSaveConfig() {
    dispatch({
      type: 'UPDATE_LOBBY_POINTS_CONFIG',
      payload: {
        gameId: selectedGameId,
        first: cfgFirst,
        second: cfgSecond,
        third: cfgThird,
        participation: cfgParticipation,
        maxParticipationCap: cfgCap === '' ? Infinity : Number(cfgCap),
        maxEntriesPerSchool: Math.max(1, Number(cfgMaxEntries) || 1),
      },
    });
    setShowConfig(false);
  }

  function toggleParticipant(entryId) {
    setParticipantIds(prev =>
      prev.includes(entryId) ? prev.filter(id => id !== entryId) : [...prev, entryId]
    );
  }

  // Group entries by school for display
  const entriesBySchool = useMemo(() => {
    const map = new Map();
    for (const entry of gameEntries) {
      if (!map.has(entry.teamId)) map.set(entry.teamId, []);
      map.get(entry.teamId).push(entry);
    }
    return map;
  }, [gameEntries]);

  const cardCls = `rounded-xl border ${darkMode ? 'bg-navy-800/60 backdrop-blur border-white/5' : 'bg-white/80 backdrop-blur border-gray-200'}`;
  const inputCls = `w-full px-3 py-2 rounded-lg text-sm border ${darkMode ? 'bg-navy-800 border-white/10 text-white [&>option]:bg-navy-800 [&>option]:text-white' : 'bg-white border-gray-300 text-gray-900'}`;
  const labelCls = `block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`;
  const btnPrimary = `px-4 py-2 rounded-lg text-sm font-medium bg-accent text-navy-900 hover:bg-accent/90 transition-colors`;
  const btnSecondary = `px-4 py-2 rounded-lg text-sm font-medium ${darkMode ? 'bg-white/10 text-gray-300 hover:bg-white/15' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`;

  if (!game) return null;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className={`flex items-center gap-2 text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
        <button
          onClick={() => dispatch({ type: 'SET_VIEW', payload: { view: 'dashboard' } })}
          className={`hover:underline ${darkMode ? 'text-accent' : 'text-blue-600'}`}
        >
          Tournament
        </button>
        <span className={darkMode ? 'text-gray-600' : 'text-gray-300'}>/</span>
        <span className="font-medium">{game?.name || 'Games'}</span>
      </div>

      {/* Game Tabs - same as GameView */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {games.map(g => (
          <button
            key={g.id}
            onClick={() => dispatch({ type: 'SELECT_GAME', payload: g.id })}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              selectedGameId === g.id
                ? 'bg-accent text-navy-900 shadow-lg shadow-accent/20'
                : darkMode
                ? 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/5'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
            }`}
          >
            <span className="text-lg">{g.emoji}</span>
            {g.name}
          </button>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          {game.emoji} {game.name}
          <span className={`text-sm font-normal ml-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Lobby Game</span>
        </h2>
        {isAdmin && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setShowConfig(!showConfig)} className={btnSecondary}>
              ⚙️ Points Config
            </button>
            {!isCompleted && (
              <>
                <button onClick={openNewEntry} className={btnSecondary}>
                  + Add Entry
                </button>
                <button onClick={openNewSession} className={btnPrimary}>
                  + Add Session
                </button>
              </>
            )}
            {gameResults.length > 0 && (
              isCompleted ? (
                <button
                  onClick={() => {
                    if (confirm('Reopen this lobby game? You will be able to add/edit sessions again.')) {
                      dispatch({ type: 'REOPEN_LOBBY_GAME', payload: { gameId: selectedGameId } });
                    }
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors`}
                >
                  Reopen Game
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (confirm('Mark this lobby game as completed? This finalizes standings.')) {
                      dispatch({ type: 'COMPLETE_LOBBY_GAME', payload: { gameId: selectedGameId } });
                    }
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium bg-win text-white hover:bg-win/90 transition-colors`}
                >
                  Finish Game
                </button>
              )
            )}
          </div>
        )}
      </div>

      {isCompleted && podiumTeams.length > 0 && (
        <div className={`rounded-xl border overflow-hidden mb-6 ${
          darkMode ? 'bg-navy-800/60 backdrop-blur border-gold/20' : 'bg-white border-gold/30'
        }`}>
          {/* Champion Banner */}
          <div className="bg-gradient-to-r from-yellow-600/20 via-yellow-500/10 to-yellow-600/20 p-6 text-center">
            <div className="text-4xl mb-2">🏆</div>
            <h2 className="text-xl font-black text-gold mb-1 tracking-wide">CHAMPION</h2>
            <div className="flex items-center justify-center gap-3">
              <div className="ring-4 ring-gold/30 rounded-lg shadow-lg shadow-gold/20">
                <TeamLogo team={podiumTeams[0].team} size={56} />
              </div>
              <div className="text-left">
                <span className={`text-2xl font-black ${darkMode ? 'text-white' : 'text-gray-900'}`}>{podiumTeams[0].team.name}</span>
                {podiumTeams[0].entryName !== podiumTeams[0].team.shortCode && (
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{podiumTeams[0].entryName}</p>
                )}
              </div>
            </div>
          </div>
          {/* Podium */}
          <div className="p-4">
            <div className="flex items-end justify-center gap-4">
              {podiumTeams.length > 1 && (
                <div className="text-center flex-1">
                  <div className={`rounded-lg p-3 ${darkMode ? 'bg-white/[0.03]' : 'bg-gray-50'}`} style={{ minHeight: '80px' }}>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 text-navy-900 font-bold text-sm mx-auto mb-1 flex items-center justify-center shadow-md">2</div>
                    <TeamLogo team={podiumTeams[1].team} size={36} className="mx-auto" />
                    <p className="text-xs font-semibold mt-1">{podiumTeams[1].team.shortCode}</p>
                    {podiumTeams[1].entryName !== podiumTeams[1].team.shortCode && (
                      <p className={`text-[10px] ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{podiumTeams[1].entryName}</p>
                    )}
                    <p className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Finalist</p>
                  </div>
                </div>
              )}
              <div className="text-center flex-1">
                <div className={`rounded-lg p-3 border-2 border-gold/30 ${darkMode ? 'bg-gold/5' : 'bg-yellow-50'}`} style={{ minHeight: '100px' }}>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 text-navy-900 font-bold text-lg mx-auto mb-1 flex items-center justify-center shadow-lg shadow-yellow-500/30">1</div>
                  <TeamLogo team={podiumTeams[0].team} size={40} className="mx-auto" />
                  <p className="text-sm font-bold mt-1">{podiumTeams[0].team.shortCode}</p>
                  {podiumTeams[0].entryName !== podiumTeams[0].team.shortCode && (
                    <p className={`text-[10px] ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{podiumTeams[0].entryName}</p>
                  )}
                  <p className="text-[10px] text-gold font-bold">Champion</p>
                </div>
              </div>
              {podiumTeams.length > 2 && (
                <div className="text-center flex-1">
                  <div className={`rounded-lg p-3 ${darkMode ? 'bg-white/[0.03]' : 'bg-gray-50'}`} style={{ minHeight: '70px' }}>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-white font-bold text-sm mx-auto mb-1 flex items-center justify-center shadow-md">3</div>
                    <TeamLogo team={podiumTeams[2].team} size={32} className="mx-auto" />
                    <p className="text-xs font-semibold mt-1">{podiumTeams[2].team.shortCode}</p>
                    {podiumTeams[2].entryName !== podiumTeams[2].team.shortCode && (
                      <p className={`text-[10px] ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{podiumTeams[2].entryName}</p>
                    )}
                    <p className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>3rd Place</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {isCompleted && standings.length === 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-win/10 border border-win/20">
          <span className="text-win font-bold text-sm">Completed</span>
          <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>— No results recorded.</span>
        </div>
      )}

      <PointsExplainer filterType="lobby" gameId={selectedGameId} />

      {/* Points Config Panel */}
      {showConfig && isAdmin && (
        <div className={`${cardCls} p-4 space-y-4`}>
          <h3 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Lobby Points Configuration</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: '🥇 1st Place', value: cfgFirst, set: setCfgFirst },
              { label: '🥈 2nd Place', value: cfgSecond, set: setCfgSecond },
              { label: '🥉 3rd Place', value: cfgThird, set: setCfgThird },
              { label: 'Participation', value: cfgParticipation, set: setCfgParticipation },
            ].map((f, i) => (
              <div key={i}>
                <label className={labelCls}>{f.label}</label>
                <input type="number" min={0} max={100} value={f.value} onChange={e => f.set(Number(e.target.value))} className={inputCls} />
              </div>
            ))}
            <div>
              <label className={labelCls}>🛡️ Participation Cap</label>
              <input
                type="number" min={1} max={100}
                value={cfgCap} onChange={e => setCfgCap(e.target.value)}
                placeholder="∞" className={inputCls}
              />
              <p className={`text-[10px] mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                Caps +1 attendance pts per school. Medal pts never capped.
              </p>
            </div>
            <div>
              <label className={labelCls}>👥 Max Entries / School</label>
              <input
                type="number" min={1} max={20}
                value={cfgMaxEntries} onChange={e => setCfgMaxEntries(Number(e.target.value) || 1)}
                className={inputCls}
              />
              <p className={`text-[10px] mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                How many teams each school can register. If &gt;1, team names are mandatory.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSaveConfig} className={btnPrimary}>Save Config</button>
            <button onClick={() => setShowConfig(false)} className={btnSecondary}>Cancel</button>
          </div>
        </div>
      )}

      {/* Entry Form */}
      {showEntryForm && isAdmin && (
        <div className={`${cardCls} p-4 space-y-4`}>
          <h3 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            {editEntryObj ? 'Edit Entry' : 'Register New Entry'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>School</label>
              <select value={entryTeamId} onChange={e => setEntryTeamId(e.target.value)} className={inputCls}>
                <option value="">-- Select School --</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>{t.shortCode || t.name} ({t.name})</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Entry/Team Name <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>(optional)</span></label>
              <input
                value={entryName}
                onChange={e => setEntryName(e.target.value)}
                className={inputCls}
                placeholder="e.g. Team Alpha, Squad B (leave blank for school name)"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSaveEntry} className={btnPrimary}>{editEntryObj ? 'Update' : 'Register'}</button>
            <button onClick={() => setShowEntryForm(false)} className={btnSecondary}>Cancel</button>
          </div>
        </div>
      )}

      {/* Registered Entries List */}
      {gameEntries.length > 0 && (
        <div className={cardCls}>
          <div className="p-4">
            <h3 className={`text-sm font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Registered Entries ({gameEntries.length})
            </h3>
            <div className="space-y-2">
              {[...entriesBySchool.entries()].map(([schoolId, entries]) => {
                const team = teams.find(t => t.id === schoolId);
                if (!team) return null;
                return (
                  <div key={schoolId} className={`rounded-lg p-3 border ${darkMode ? 'bg-white/[0.02] border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <TeamLogo team={team} size={20} />
                      <span className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        {team.name}
                      </span>
                      <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        ({entries.length} {entries.length === 1 ? 'entry' : 'entries'})
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 ml-7">
                      {entries.map(entry => (
                        <div
                          key={entry.id}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border ${
                            darkMode ? 'bg-white/5 border-white/10 text-gray-300' : 'bg-white border-gray-200 text-gray-700'
                          }`}
                        >
                          <span>{entry.entryName || team.shortCode || team.name}</span>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => openEditEntry(entry)}
                                className={`ml-1 ${darkMode ? 'text-accent hover:text-accent/80' : 'text-blue-600 hover:text-blue-700'}`}
                                title="Edit"
                              >✎</button>
                              <button
                                onClick={() => handleDeleteEntry(entry.id)}
                                className={`${darkMode ? 'text-red-400 hover:text-red-300' : 'text-red-500 hover:text-red-600'}`}
                                title="Delete"
                              >×</button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Session Form Modal */}
      {showForm && isAdmin && (
        <div className={`${cardCls} p-4 space-y-4`}>
          <h3 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            {editSession ? 'Edit Session' : 'New Session'}
          </h3>
          <div>
            <label className={labelCls}>Session Name</label>
            <input value={sessionName} onChange={e => setSessionName(e.target.value)} className={inputCls} placeholder="e.g. Match 1, Round 2" />
          </div>

          {gameEntries.length === 0 ? (
            <p className={`text-sm ${darkMode ? 'text-yellow-400' : 'text-amber-600'}`}>
              No entries registered yet. Add entries first using "+ Add Entry" above.
            </p>
          ) : (
            <>
              {/* Participant selection — select entries */}
              <div>
                <label className={labelCls}>Participating Entries (click to toggle)</label>
                <p className={`text-[10px] mb-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  Select all entries that competed in this session.
                </p>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                  {gameEntries.map(entry => {
                    const team = teams.find(t => t.id === entry.teamId);
                    if (!team) return null;
                    const displayName = entry.entryName
                      ? `${team.shortCode || team.name} – ${entry.entryName}`
                      : (team.shortCode || team.name);
                    return (
                      <button
                        key={entry.id}
                        onClick={() => toggleParticipant(entry.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          participantIds.includes(entry.id)
                            ? 'bg-accent/20 border-accent text-accent'
                            : darkMode ? 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <TeamLogo team={team} size={16} />
                        {displayName}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Placements — podium stacking allowed */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: '🥇 1st Place', value: first, set: setFirst },
                  { label: '🥈 2nd Place', value: second, set: setSecond },
                  { label: '🥉 3rd Place', value: third, set: setThird },
                ].map((p, i) => (
                  <div key={i}>
                    <label className={labelCls}>{p.label}</label>
                    <select value={p.value} onChange={e => p.set(e.target.value)} className={inputCls}>
                      <option value="">-- None --</option>
                      {participantIds.map(eid => (
                        <option key={eid} value={eid}>{getEntryDisplayName(eid)}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <p className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                Same school CAN win multiple podium spots (podium stacking is allowed).
              </p>
            </>
          )}

          <div className="flex gap-2">
            <button onClick={handleSaveSession} className={btnPrimary}>{editSession ? 'Update' : 'Save'}</button>
            <button onClick={() => setShowForm(false)} className={btnSecondary}>Cancel</button>
          </div>
        </div>
      )}

      {/* Standings Table */}
      {standings.length > 0 && (
        <div className={cardCls}>
          <div className="p-4">
            <h3 className={`text-sm font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Standings</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={darkMode ? 'bg-white/[0.02]' : 'bg-gray-50/50'}>
                    <th className={`px-3 py-2 text-left text-[11px] font-bold uppercase ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>#</th>
                    <th className={`px-3 py-2 text-left text-[11px] font-bold uppercase ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>School</th>
                    <th className={`px-3 py-2 text-center text-[11px] font-bold uppercase ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>🥇</th>
                    <th className={`px-3 py-2 text-center text-[11px] font-bold uppercase ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>🥈</th>
                    <th className={`px-3 py-2 text-center text-[11px] font-bold uppercase ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>🥉</th>
                    <th className={`px-3 py-2 text-center text-[11px] font-bold uppercase ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Sessions</th>
                    <th className={`px-3 py-2 text-center text-[11px] font-bold uppercase ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>PTS</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s, i) => (
                    <tr key={s.teamId} className={`border-t ${darkMode ? 'border-white/5' : 'border-gray-100'}`}>
                      <td className={`px-3 py-2 font-mono ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{i + 1}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <TeamLogo team={s.team} size={20} />
                          <span className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{s.team.shortCode || s.team.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center text-gold font-bold">{s.golds || '-'}</td>
                      <td className="px-3 py-2 text-center text-silver font-bold">{s.silvers || '-'}</td>
                      <td className="px-3 py-2 text-center text-bronze font-bold">{s.bronzes || '-'}</td>
                      <td className={`px-3 py-2 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{s.sessions}</td>
                      <td className="px-3 py-2 text-center font-mono font-bold text-accent">{s.totalPoints}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Session Results List */}
      <div className={cardCls}>
        <div className="p-4">
          <h3 className={`text-sm font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Session Results ({gameResults.length})
          </h3>
          {gameResults.length === 0 ? (
            <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              No sessions recorded yet. {isAdmin ? 'Register entries first, then click "+ Add Session" to get started.' : ''}
            </p>
          ) : (
            <div className="space-y-3">
              {gameResults.map(session => {
                const p = session.placements || {};
                const firstTeam = getEntryTeam(p.first);
                const secondTeam = getEntryTeam(p.second);
                const thirdTeam = getEntryTeam(p.third);
                return (
                  <div key={session.id} className={`rounded-lg p-3 border ${darkMode ? 'bg-white/[0.02] border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>{session.sessionName}</span>
                      {isAdmin && (
                        <div className="flex gap-1">
                          <button onClick={() => openEditSession(session)} className={`text-xs px-2 py-1 rounded ${darkMode ? 'text-accent hover:bg-white/5' : 'text-blue-600 hover:bg-gray-100'}`}>Edit</button>
                          <button onClick={() => handleDeleteSession(session.id)} className={`text-xs px-2 py-1 rounded ${darkMode ? 'text-red-400 hover:bg-white/5' : 'text-red-600 hover:bg-gray-100'}`}>Delete</button>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs">
                      {p.first && (
                        <span className="inline-flex items-center gap-1 text-gold font-semibold">
                          🥇 {firstTeam && <TeamLogo team={firstTeam} size={14} />} {getEntryDisplayName(p.first)}
                        </span>
                      )}
                      {p.second && (
                        <span className="inline-flex items-center gap-1 text-silver font-semibold">
                          🥈 {secondTeam && <TeamLogo team={secondTeam} size={14} />} {getEntryDisplayName(p.second)}
                        </span>
                      )}
                      {p.third && (
                        <span className="inline-flex items-center gap-1 text-bronze font-semibold">
                          🥉 {thirdTeam && <TeamLogo team={thirdTeam} size={14} />} {getEntryDisplayName(p.third)}
                        </span>
                      )}
                      <span className={darkMode ? 'text-gray-500' : 'text-gray-400'}>
                        {(session.participantEntryIds || []).length} entries
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
