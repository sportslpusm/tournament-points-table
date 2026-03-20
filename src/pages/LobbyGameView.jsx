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
  const { games, teams, selectedGameId, darkMode, lobbyResults, lobbyPointsConfig } = state;
  const game = games.find(g => g.id === selectedGameId);

  const config = lobbyPointsConfig[selectedGameId] || DEFAULT_LOBBY_POINTS;
  const gameResults = useMemo(() =>
    lobbyResults.filter(r => r.gameId === selectedGameId),
    [lobbyResults, selectedGameId]
  );

  const standings = useMemo(() =>
    getLobbyGameStandings(selectedGameId, lobbyResults, teams, lobbyPointsConfig),
    [selectedGameId, lobbyResults, teams, lobbyPointsConfig]
  );

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
    setParticipantIds(session.participantTeamIds || []);
    setShowForm(true);
  }

  function handleSaveSession() {
    if (!sessionName.trim()) return;
    const payload = {
      gameId: selectedGameId,
      sessionName: sessionName.trim(),
      placements: { first: first || null, second: second || null, third: third || null },
      participantTeamIds: participantIds,
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
      },
    });
    setShowConfig(false);
  }

  function toggleParticipant(teamId) {
    setParticipantIds(prev =>
      prev.includes(teamId) ? prev.filter(id => id !== teamId) : [...prev, teamId]
    );
  }

  const cardCls = `rounded-xl border ${darkMode ? 'bg-navy-800/60 backdrop-blur border-white/5' : 'bg-white/80 backdrop-blur border-gray-200'}`;
  const inputCls = `w-full px-3 py-2 rounded-lg text-sm border ${darkMode ? 'bg-navy-800 border-white/10 text-white [&>option]:bg-navy-800 [&>option]:text-white' : 'bg-white border-gray-300 text-gray-900'}`;
  const labelCls = `block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`;
  const btnPrimary = `px-4 py-2 rounded-lg text-sm font-medium bg-accent text-navy-900 hover:bg-accent/90 transition-colors`;
  const btnSecondary = `px-4 py-2 rounded-lg text-sm font-medium ${darkMode ? 'bg-white/10 text-gray-300 hover:bg-white/15' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`;

  if (!game) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <button
            onClick={() => dispatch({ type: 'SET_VIEW', payload: { view: 'dashboard' } })}
            className={`text-xs mb-1 ${darkMode ? 'text-accent hover:text-accent/80' : 'text-blue-600 hover:text-blue-700'}`}
          >
            ← Back to Dashboard
          </button>
          <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            {game.emoji} {game.name}
            <span className={`text-sm font-normal ml-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Lobby Game</span>
          </h2>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button onClick={() => setShowConfig(!showConfig)} className={btnSecondary}>
              ⚙️ Points Config
            </button>
            <button onClick={openNewSession} className={btnPrimary}>
              + Add Session
            </button>
          </div>
        )}
      </div>

      <PointsExplainer filterType="individual" gameId={selectedGameId} />

      {/* Points Config Panel */}
      {showConfig && isAdmin && (
        <div className={`${cardCls} p-4 space-y-4`}>
          <h3 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Lobby Points Configuration</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
                Caps +1 attendance pts per team. Medal pts never capped.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSaveConfig} className={btnPrimary}>Save Config</button>
            <button onClick={() => setShowConfig(false)} className={btnSecondary}>Cancel</button>
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

          {/* Participant selection — supports multiple entries per school */}
          <div>
            <label className={labelCls}>Participating Teams (click to toggle)</label>
            <p className={`text-[10px] mb-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              A school can enter multiple teams. Select all that competed in this session.
            </p>
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
              {teams.map(t => (
                <button
                  key={t.id}
                  onClick={() => toggleParticipant(t.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    participantIds.includes(t.id)
                      ? 'bg-accent/20 border-accent text-accent'
                      : darkMode ? 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <TeamLogo team={t} size={16} />
                  {t.shortCode || t.name}
                </button>
              ))}
            </div>
          </div>

          {/* Placements — podium stacking: same school can win multiple spots */}
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
                  {participantIds.map(tid => {
                    const t = teams.find(x => x.id === tid);
                    return t ? <option key={tid} value={tid}>{t.shortCode || t.name}</option> : null;
                  })}
                </select>
              </div>
            ))}
          </div>
          <p className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            Same school CAN win multiple podium spots (podium stacking is allowed).
          </p>

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
                    <th className={`px-3 py-2 text-left text-[11px] font-bold uppercase ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Team</th>
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
              No sessions recorded yet. {isAdmin ? 'Click "+ Add Session" to get started.' : ''}
            </p>
          ) : (
            <div className="space-y-3">
              {gameResults.map(session => {
                const p = session.placements || {};
                const firstTeam = teams.find(t => t.id === p.first);
                const secondTeam = teams.find(t => t.id === p.second);
                const thirdTeam = teams.find(t => t.id === p.third);
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
                      {firstTeam && (
                        <span className="inline-flex items-center gap-1 text-gold font-semibold">
                          🥇 <TeamLogo team={firstTeam} size={14} /> {firstTeam.shortCode}
                        </span>
                      )}
                      {secondTeam && (
                        <span className="inline-flex items-center gap-1 text-silver font-semibold">
                          🥈 <TeamLogo team={secondTeam} size={14} /> {secondTeam.shortCode}
                        </span>
                      )}
                      {thirdTeam && (
                        <span className="inline-flex items-center gap-1 text-bronze font-semibold">
                          🥉 <TeamLogo team={thirdTeam} size={14} /> {thirdTeam.shortCode}
                        </span>
                      )}
                      <span className={darkMode ? 'text-gray-500' : 'text-gray-400'}>
                        {(session.participantTeamIds || []).length} teams
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
