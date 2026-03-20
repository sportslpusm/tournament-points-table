import { useState } from 'react';
import { useTournament, useDispatch } from '../context/TournamentContext';
import Modal, { ConfirmDialog } from '../components/Modal';
import TeamLogo from '../components/TeamLogo';
import EmptyState from '../components/EmptyState';

export default function GamePoolManagement() {
  const state = useTournament();
  const { dispatch, showToast } = useDispatch();
  const { games, pools, teams, matches, darkMode, knockoutConfig, athletes, categories, lobbyEntries: rawLobbyEntries, lobbyResults } = state;
  const lobbyEntries = Array.isArray(rawLobbyEntries) ? rawLobbyEntries : [];

  const [showGameModal, setShowGameModal] = useState(false);
  const [editGame, setEditGame] = useState(null);
  const [gameName, setGameName] = useState('');
  const [gameEmoji, setGameEmoji] = useState('🎮');
  const [gameType, setGameType] = useState('team');
  const [deleteGameId, setDeleteGameId] = useState(null);

  const [showPoolModal, setShowPoolModal] = useState(false);
  const [editPool, setEditPool] = useState(null);
  const [poolName, setPoolName] = useState('');
  const [poolGameId, setPoolGameId] = useState('');
  const [deletePoolId, setDeletePoolId] = useState(null);

  const [assignPoolId, setAssignPoolId] = useState(null);
  const [showKoSettings, setShowKoSettings] = useState(null);

  const EMOJI_OPTIONS = ['🎮', '🏐', '🏏', '⚽', '🏀', '🎾', '🏓', '🤼', '🏋', '🏊', '🥊', '⛳', '🎯', '♟️', '🎳', '🏑'];

  const inputCls = `w-full px-3 py-2 rounded-lg text-sm border ${
    darkMode ? 'bg-navy-800 border-white/10 text-white [&>option]:bg-navy-800 [&>option]:text-white' : 'bg-white border-gray-300 text-gray-900'
  }`;

  // Game CRUD
  function openAddGame() {
    setEditGame(null);
    setGameName('');
    setGameEmoji('🎮');
    setGameType('team');
    setShowGameModal(true);
  }

  function openEditGame(game) {
    setEditGame(game);
    setGameName(game.name);
    setGameEmoji(game.emoji);
    setGameType(game.type || 'team');
    setShowGameModal(true);
  }

  function handleSaveGame() {
    if (!gameName.trim()) {
      showToast('Game name is required', 'error');
      return;
    }
    const isDup = games.some(g => g.name.toLowerCase() === gameName.trim().toLowerCase() && g.id !== editGame?.id);
    if (isDup) {
      showToast('A game with this name already exists', 'error');
      return;
    }

    if (editGame) {
      dispatch({ type: 'UPDATE_GAME', payload: { id: editGame.id, name: gameName.trim(), emoji: gameEmoji, type: gameType } });
      showToast('Game updated');
    } else {
      dispatch({ type: 'ADD_GAME', payload: { name: gameName.trim(), emoji: gameEmoji, type: gameType } });
      showToast('Game added');
    }
    setShowGameModal(false);
  }

  // Pool CRUD
  function openAddPool(gameId) {
    setEditPool(null);
    setPoolName('');
    setPoolGameId(gameId || '');
    setShowPoolModal(true);
  }

  function openEditPool(pool) {
    setEditPool(pool);
    setPoolName(pool.name);
    setPoolGameId(pool.gameId);
    setShowPoolModal(true);
  }

  function handleSavePool() {
    if (!poolName.trim() || !poolGameId) {
      showToast('Pool name and game are required', 'error');
      return;
    }
    const isDup = pools.some(p => p.gameId === poolGameId && p.name.toLowerCase() === poolName.trim().toLowerCase() && p.id !== editPool?.id);
    if (isDup) {
      showToast('A pool with this name already exists in this game', 'error');
      return;
    }

    if (editPool) {
      dispatch({ type: 'UPDATE_POOL', payload: { id: editPool.id, name: poolName.trim(), gameId: poolGameId } });
      showToast('Pool updated');
    } else {
      dispatch({ type: 'ADD_POOL', payload: { name: poolName.trim(), gameId: poolGameId } });
      showToast('Pool created');
    }
    setShowPoolModal(false);
  }

  // Knockout settings
  function updateKoConfig(gameId, updates) {
    dispatch({ type: 'UPDATE_KNOCKOUT_CONFIG', payload: { gameId, ...updates } });
  }

  // Assign teams — exclude teams already in ANY pool of the same game
  const assignPool = pools.find(p => p.id === assignPoolId);
  const teamsInSameGame = assignPool
    ? new Set(
        pools
          .filter(p => p.gameId === assignPool.gameId)
          .flatMap(p => p.teamIds)
      )
    : new Set();
  const unassignedTeams = assignPool ? teams.filter(t => !teamsInSameGame.has(t.id)) : [];

  // KO settings for currently open modal
  const koSettingsGame = games.find(g => g.id === showKoSettings);
  const koConfig = showKoSettings ? (knockoutConfig[showKoSettings] || {}) : {};

  return (
    <div className="animate-slideUp">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Games & Pools</h2>
        <button onClick={openAddGame} className="px-4 py-2 bg-accent text-navy-900 font-bold text-sm rounded-lg hover:bg-accent-dark transition-colors">
          + Add Game
        </button>
      </div>

      {games.length === 0 ? (
        <EmptyState
          icon="🎮"
          title="No games added yet"
          description="Create your first game to organize your tournament into different sports or events."
          action={{ label: 'Add Game', onClick: openAddGame }}
        />
      ) : (
        <div className="space-y-6">
          {games.map(game => {
            const isIndividual = game.type === 'individual';
            const isLobby = game.type === 'lobby';
            const gamePools = pools.filter(p => p.gameId === game.id);
            const cfg = knockoutConfig[game.id] || {};
            const gameAthletes = athletes.filter(a => a.gameId === game.id);
            const gameCategories = categories.filter(c => c.gameId === game.id);
            const gameLobbyEntries = lobbyEntries.filter(e => e.gameId === game.id);
            const stageLabel = isIndividual ? 'Individual' : isLobby ? 'Lobby' : cfg.stage === 'knockout' ? 'Knockout' : cfg.stage === 'completed' ? 'Completed' : 'Pool';

            return (
              <div key={game.id} className={`rounded-xl border overflow-hidden ${
                darkMode ? 'bg-navy-800/40 backdrop-blur border-white/5' : 'bg-white/80 backdrop-blur border-gray-200'
              }`}>
                {/* Game Header */}
                <div className={`px-4 py-3 flex items-center justify-between ${
                  darkMode ? 'bg-white/[0.03]' : 'bg-gray-50'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{game.emoji}</span>
                    <span className="font-bold">{game.name}</span>
                    {isIndividual ? (
                      <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        ({gameCategories.length} categories · {gameAthletes.length} athletes)
                      </span>
                    ) : isLobby ? (
                      <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        ({gameLobbyEntries.length} {gameLobbyEntries.length === 1 ? 'entry' : 'entries'})
                      </span>
                    ) : (
                      <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        ({gamePools.length} pool{gamePools.length !== 1 ? 's' : ''})
                      </span>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      isIndividual ? 'bg-purple-500/10 text-purple-400' :
                      isLobby ? 'bg-emerald-500/10 text-emerald-400' :
                      stageLabel === 'Knockout' ? 'bg-accent/10 text-accent' :
                      stageLabel === 'Completed' ? 'bg-win/10 text-win' :
                      darkMode ? 'bg-white/5 text-gray-500' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {stageLabel}
                    </span>
                  </div>
                  <div className="flex gap-1 items-center">
                    {!isIndividual && !isLobby && (
                      <button
                        onClick={() => setShowKoSettings(game.id)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          cfg.enabled !== false ? 'bg-accent/10 text-accent' : darkMode ? 'bg-white/5 text-gray-500' : 'bg-gray-100 text-gray-400'
                        }`}
                        title="Knockout Settings"
                        aria-label="Knockout settings"
                      >
                        ⚔️ KO
                      </button>
                    )}
                    {(isIndividual || isLobby) && (
                      <button
                        onClick={() => dispatch({ type: 'SELECT_GAME', payload: game.id })}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors hover:opacity-80 ${
                          isLobby ? 'bg-emerald-500/10 text-emerald-400' : 'bg-purple-500/10 text-purple-400'
                        }`}
                      >
                        Manage →
                      </button>
                    )}
                    <button onClick={() => openEditGame(game)} className={`p-1.5 rounded-lg text-sm transition-colors ${darkMode ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-700'}`} aria-label="Edit game">
                      ✏️
                    </button>
                    <button onClick={() => setDeleteGameId(game.id)} className="p-1.5 rounded-lg hover:bg-red-900/30 text-gray-400 hover:text-red-400 text-sm transition-colors" aria-label="Delete game">
                      🗑
                    </button>
                    {!isIndividual && !isLobby && (
                      <button onClick={() => openAddPool(game.id)} className={`px-3 py-1 rounded-lg text-xs font-medium ml-2 transition-colors ${
                        darkMode ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}>
                        + Pool
                      </button>
                    )}
                  </div>
                </div>

                {/* Content: Pools for team games, summary for individual/lobby games */}
                {isLobby ? (
                  <div className="p-4">
                    <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {gameLobbyEntries.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {gameLobbyEntries.map(entry => {
                            const team = teams.find(t => t.id === entry.teamId);
                            return (
                              <span key={entry.id} className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs ${
                                darkMode ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {team && <TeamLogo team={team} size={14} />}
                                {entry.entryName ? `${team?.shortCode || team?.name} – ${entry.entryName}` : (team?.shortCode || team?.name || '?')}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <p>No entries yet. Click "Manage" to add schools and entries.</p>
                      )}
                    </div>
                  </div>
                ) : isIndividual ? (
                  <div className="p-4">
                    <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {gameCategories.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {gameCategories.map(cat => (
                            <span key={cat.id} className={`px-2 py-1 rounded-lg text-xs ${
                              cat.status === 'completed'
                                ? 'bg-win/10 text-win'
                                : darkMode ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {cat.name} ({cat.athleteIds.length})
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p>No categories yet. Click "Manage" to add categories and athletes.</p>
                      )}
                    </div>
                  </div>
                ) : gamePools.length === 0 ? (
                  <p className={`p-4 text-sm ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>No pools yet. Add a pool to this game.</p>
                ) : (
                  <div className={`divide-y ${darkMode ? 'divide-white/5' : 'divide-gray-100'}`}>
                    {gamePools.map(pool => {
                      const poolTeams = pool.teamIds.map(tid => teams.find(t => t.id === tid)).filter(Boolean);
                      const poolMatchCount = matches.filter(m => m.poolId === pool.id).length;
                      return (
                        <div key={pool.id} className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">{pool.name}</span>
                              <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                {poolTeams.length} teams · {poolMatchCount} matches
                              </span>
                            </div>
                            <div className="flex gap-1">
                              <button onClick={() => setAssignPoolId(pool.id)} className={`px-2 py-1 rounded text-xs transition-colors ${
                                darkMode ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}>
                                + Team
                              </button>
                              <button onClick={() => openEditPool(pool)} className={`p-1 rounded text-sm transition-colors ${darkMode ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-700'}`} aria-label="Edit pool">
                                ✏️
                              </button>
                              <button onClick={() => setDeletePoolId(pool.id)} className="p-1 rounded hover:bg-red-900/30 text-gray-400 hover:text-red-400 text-sm transition-colors" aria-label="Delete pool">
                                🗑
                              </button>
                            </div>
                          </div>
                          {poolTeams.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {poolTeams.map(team => (
                                <div
                                  key={team.id}
                                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                                    darkMode ? 'bg-white/5 text-gray-300' : 'bg-gray-100 text-gray-700'
                                  }`}
                                >
                                  <TeamLogo team={team} size={24} />
                                  <span>{team.shortCode}</span>
                                  <button
                                    onClick={() => {
                                      dispatch({ type: 'REMOVE_TEAM_FROM_POOL', payload: { poolId: pool.id, teamId: team.id } });
                                      showToast(`${team.shortCode} removed from ${pool.name}`);
                                    }}
                                    className="text-gray-500 hover:text-red-400 ml-1 transition-colors"
                                    aria-label="Remove team from pool"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className={`text-xs ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>No teams assigned</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Game Modal */}
      <Modal isOpen={showGameModal} onClose={() => setShowGameModal(false)} title={editGame ? 'Edit Game' : 'Add Game'}>
        <div className="space-y-4">
          {/* Game Type Selector — only for new games or games without data */}
          {(() => {
            const hasData = editGame && (
              pools.some(p => p.gameId === editGame.id) ||
              athletes.some(a => a.gameId === editGame.id) ||
              categories.some(c => c.gameId === editGame.id) ||
              lobbyEntries.some(e => e.gameId === editGame.id) ||
              (lobbyResults || []).some(r => r.gameId === editGame.id)
            );
            return (
              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Game Type *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => !hasData && setGameType('team')}
                    disabled={hasData}
                    className={`px-3 py-3 rounded-lg text-sm font-medium border transition-all text-center ${
                      gameType === 'team'
                        ? 'bg-accent/20 border-accent text-accent'
                        : hasData
                          ? 'opacity-40 cursor-not-allowed ' + (darkMode ? 'bg-white/5 border-white/10 text-gray-500' : 'bg-gray-50 border-gray-300 text-gray-400')
                          : darkMode ? 'bg-white/5 border-white/10 text-gray-300 hover:border-white/20' : 'bg-gray-50 border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    <div className="text-xl mb-1">🏐</div>
                    Team Sport
                    <div className={`text-[10px] mt-0.5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Team vs Team</div>
                  </button>
                  <button
                    onClick={() => !hasData && setGameType('individual')}
                    disabled={hasData}
                    className={`px-3 py-3 rounded-lg text-sm font-medium border transition-all text-center ${
                      gameType === 'individual'
                        ? 'bg-purple-500/20 border-purple-400 text-purple-400'
                        : hasData
                          ? 'opacity-40 cursor-not-allowed ' + (darkMode ? 'bg-white/5 border-white/10 text-gray-500' : 'bg-gray-50 border-gray-300 text-gray-400')
                          : darkMode ? 'bg-white/5 border-white/10 text-gray-300 hover:border-white/20' : 'bg-gray-50 border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    <div className="text-xl mb-1">🏋️</div>
                    Individual Sport
                    <div className={`text-[10px] mt-0.5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Athletes in categories</div>
                  </button>
                  <button
                    onClick={() => !hasData && setGameType('lobby')}
                    disabled={hasData}
                    className={`px-3 py-3 rounded-lg text-sm font-medium border transition-all text-center ${
                      gameType === 'lobby'
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-400'
                        : hasData
                          ? 'opacity-40 cursor-not-allowed ' + (darkMode ? 'bg-white/5 border-white/10 text-gray-500' : 'bg-gray-50 border-gray-300 text-gray-400')
                          : darkMode ? 'bg-white/5 border-white/10 text-gray-300 hover:border-white/20' : 'bg-gray-50 border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    <div className="text-xl mb-1">🎮</div>
                    Lobby / Battle
                    <div className={`text-[10px] mt-0.5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Multi-team session</div>
                  </button>
                </div>
                {hasData && (
                  <p className={`text-xs mt-1 ${darkMode ? 'text-yellow-400/70' : 'text-yellow-600'}`}>
                    ⚠️ Game type cannot be changed after data has been added.
                  </p>
                )}
              </div>
            );
          })()}
          <div>
            <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Game Name *</label>
            <input
              type="text"
              value={gameName}
              onChange={e => setGameName(e.target.value)}
              placeholder={gameType === 'individual' ? 'e.g. Powerlifting' : gameType === 'lobby' ? 'e.g. ESports - BGMI' : 'e.g. Volleyball'}
              className={inputCls}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Icon</label>
            <div className="flex flex-wrap gap-2">
              {EMOJI_OPTIONS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => setGameEmoji(emoji)}
                  className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center border transition-all ${
                    gameEmoji === emoji
                      ? 'bg-accent/20 border-accent scale-110'
                      : darkMode ? 'bg-white/5 border-white/10 hover:border-white/20' : 'bg-gray-50 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>or type custom:</span>
              <input
                type="text"
                value={!EMOJI_OPTIONS.includes(gameEmoji) ? gameEmoji : ''}
                onChange={e => {
                  const val = e.target.value;
                  // Allow emojis and special chars, limit to first grapheme cluster (max 2 chars for surrogate pairs)
                  const segments = val.length > 0 ? [...new Intl.Segmenter().segment(val)] : [];
                  if (segments.length > 0) setGameEmoji(segments[0].segment);
                  else if (val === '') setGameEmoji(EMOJI_OPTIONS[0]);
                }}
                placeholder="🏸"
                className={`w-16 h-10 text-center text-xl rounded-lg border ${
                  !EMOJI_OPTIONS.includes(gameEmoji)
                    ? 'bg-accent/20 border-accent'
                    : darkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-300'
                }`}
                maxLength={4}
              />
              {!EMOJI_OPTIONS.includes(gameEmoji) && (
                <span className="text-2xl">{gameEmoji}</span>
              )}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowGameModal(false)} className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
              darkMode ? 'bg-white/10 text-gray-300' : 'bg-gray-100 text-gray-700'
            }`}>Cancel</button>
            <button onClick={handleSaveGame} className="flex-1 px-4 py-2 rounded-lg bg-accent text-navy-900 font-bold hover:bg-accent-dark transition-colors">{editGame ? 'Update' : 'Add'} Game</button>
          </div>
        </div>
      </Modal>

      {/* Knockout Settings Modal */}
      <Modal
        isOpen={!!showKoSettings}
        onClose={() => setShowKoSettings(null)}
        title={`Knockout Settings - ${koSettingsGame?.emoji || ''} ${koSettingsGame?.name || ''}`}
      >
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={koConfig.enabled !== false}
              onChange={e => updateKoConfig(showKoSettings, { enabled: e.target.checked })}
              className="rounded"
            />
            <span className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>Enable Knockout Stage</span>
          </label>

          {koConfig.enabled !== false && (
            <>
              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Teams qualifying per pool
                </label>
                <select
                  value={koConfig.qualifyCount || 2}
                  onChange={e => updateKoConfig(showKoSettings, { qualifyCount: Number(e.target.value) })}
                  className={inputCls}
                >
                  {[1, 2, 3, 4, 5].map(n => (
                    <option key={n} value={n}>Top {n} from each pool</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Starting Round
                </label>
                <select
                  value={koConfig.startingRound || 'auto'}
                  onChange={e => updateKoConfig(showKoSettings, { startingRound: e.target.value })}
                  className={inputCls}
                >
                  <option value="auto">Auto (based on qualified teams)</option>
                  <option value="final">Final only (top 2)</option>
                  <option value="sf">Semi Finals (top 3-4)</option>
                  <option value="qf">Quarter Finals (top 5-8)</option>
                  <option value="ro16">Round of 16 (top 9-16)</option>
                  <option value="ro32">Round of 32 (top 17-32)</option>
                </select>
                <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  Skip rounds by selecting a later starting round (e.g., start from Semi Finals to skip Quarter Finals).
                </p>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Seeding Format</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'cross', label: 'Cross-Pool' },
                    { value: 'random', label: 'Random' },
                    { value: 'manual', label: 'Manual' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => updateKoConfig(showKoSettings, { seedingFormat: opt.value })}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                        (koConfig.seedingFormat || 'cross') === opt.value
                          ? 'bg-accent/20 border-accent text-accent'
                          : darkMode ? 'bg-white/5 border-white/10 text-gray-300' : 'bg-gray-50 border-gray-300 text-gray-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-3 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={koConfig.bonusPoints?.enabled !== false}
                    onChange={e => updateKoConfig(showKoSettings, {
                      bonusPoints: { ...(koConfig.bonusPoints || {}), enabled: e.target.checked }
                    })}
                    className="rounded"
                  />
                  <span className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>Knockout Bonus Points</span>
                </label>

                {koConfig.bonusPoints?.enabled !== false && (
                  <div className="grid grid-cols-2 gap-2 ml-8">
                    {[
                      { key: 'qf', label: 'QF Win Bonus', def: 1 },
                      { key: 'sf', label: 'SF Win Bonus', def: 2 },
                      { key: 'final', label: 'Final Win Bonus', def: 3 },
                      { key: 'third', label: '3rd Place Win', def: 1 },
                    ].map(bp => (
                      <div key={bp.key}>
                        <label className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{bp.label}</label>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          value={koConfig.bonusPoints?.[bp.key] ?? bp.def}
                          onChange={e => updateKoConfig(showKoSettings, {
                            bonusPoints: { ...(koConfig.bonusPoints || {}), [bp.key]: Number(e.target.value) }
                          })}
                          className={inputCls}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={koConfig.twoLeg || false}
                  onChange={e => updateKoConfig(showKoSettings, { twoLeg: e.target.checked })}
                  className="rounded"
                />
                <span className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>Two-leg matches (aggregate)</span>
              </label>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowKoSettings(null)}
              className="flex-1 px-4 py-2 rounded-lg bg-accent text-navy-900 font-bold hover:bg-accent-dark transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </Modal>

      {/* Pool Modal */}
      <Modal isOpen={showPoolModal} onClose={() => setShowPoolModal(false)} title={editPool ? 'Edit Pool' : 'Add Pool'}>
        <div className="space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Pool Name *</label>
            <input
              type="text"
              value={poolName}
              onChange={e => setPoolName(e.target.value)}
              placeholder="e.g. Pool A"
              className={inputCls}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Game *</label>
            <select
              value={poolGameId}
              onChange={e => setPoolGameId(e.target.value)}
              className={inputCls}
              disabled={!!editPool}
            >
              <option value="">Select Game</option>
              {games.filter(g => g.type !== 'individual' && g.type !== 'lobby').map(g => <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowPoolModal(false)} className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
              darkMode ? 'bg-white/10 text-gray-300' : 'bg-gray-100 text-gray-700'
            }`}>Cancel</button>
            <button onClick={handleSavePool} className="flex-1 px-4 py-2 rounded-lg bg-accent text-navy-900 font-bold hover:bg-accent-dark transition-colors">{editPool ? 'Update' : 'Add'} Pool</button>
          </div>
        </div>
      </Modal>

      {/* Assign Teams Modal */}
      <Modal isOpen={!!assignPoolId} onClose={() => setAssignPoolId(null)} title={`Assign Teams to ${assignPool?.name || ''}`}>
        {unassignedTeams.length === 0 ? (
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>All teams are already assigned to this pool, or no teams exist.</p>
        ) : (
          <div className="space-y-2">
            <p className={`text-sm mb-3 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Click a team to add it to this pool.</p>
            {unassignedTeams.map(team => (
              <button
                key={team.id}
                onClick={() => {
                  dispatch({ type: 'ASSIGN_TEAM_TO_POOL', payload: { poolId: assignPoolId, teamId: team.id } });
                  showToast(`${team.shortCode} added to ${assignPool?.name}`);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
                  darkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <TeamLogo team={team} size={32} />
                <div>
                  <div className="font-medium text-sm">{team.name}</div>
                  <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{team.shortCode}</div>
                </div>
                <span className="ml-auto text-accent font-bold">+</span>
              </button>
            ))}
          </div>
        )}
      </Modal>

      {/* Delete Confirms */}
      <ConfirmDialog
        isOpen={!!deleteGameId}
        onClose={() => setDeleteGameId(null)}
        onConfirm={() => { dispatch({ type: 'DELETE_GAME', payload: deleteGameId }); showToast('Game deleted'); setDeleteGameId(null); }}
        title="Delete Game"
        message="This will delete the game, all its pools, matches, and knockout data. Points will be recalculated."
      />
      <ConfirmDialog
        isOpen={!!deletePoolId}
        onClose={() => setDeletePoolId(null)}
        onConfirm={() => { dispatch({ type: 'DELETE_POOL', payload: deletePoolId }); showToast('Pool deleted'); setDeletePoolId(null); }}
        title="Delete Pool"
        message="This will delete the pool and all matches within it. Points will be recalculated."
      />
    </div>
  );
}
