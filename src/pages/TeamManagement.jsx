import { useState, useMemo } from 'react';
import { useTournament, useDispatch } from '../context/TournamentContext';
import { useAuth } from '../context/AuthContext';
import { getTeamStatsForMatches } from '../utils/points';
import Modal, { ConfirmDialog } from '../components/Modal';
import TeamLogo from '../components/TeamLogo';
import ImageUpload from '../components/ImageUpload';
import EmptyState from '../components/EmptyState';

export default function TeamManagement() {
  const state = useTournament();
  const { dispatch, showToast } = useDispatch();
  const { isAdmin } = useAuth();
  const { teams, games, pools, matches, darkMode } = state;

  const [showModal, setShowModal] = useState(false);
  const [editTeam, setEditTeam] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [profileTeamId, setProfileTeamId] = useState(null);

  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formLogo, setFormLogo] = useState(null);

  const inputCls = `w-full px-3 py-2 rounded-lg text-sm border ${
    darkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-300 text-gray-900'
  }`;

  function resetForm() {
    setFormName('');
    setFormCode('');
    setFormLogo(null);
  }

  function openAdd() {
    resetForm();
    setEditTeam(null);
    setShowModal(true);
  }

  function openEdit(team) {
    setEditTeam(team);
    setFormName(team.name);
    setFormCode(team.shortCode);
    setFormLogo(team.logo);
    setShowModal(true);
  }

  function handleSave() {
    if (!formName.trim()) {
      showToast('Team name is required', 'error');
      return;
    }
    if (!formCode.trim() || formCode.trim().length > 4) {
      showToast('Short code must be 1-4 characters', 'error');
      return;
    }

    const isDup = teams.some(t => t.name.toLowerCase() === formName.trim().toLowerCase() && t.id !== editTeam?.id);
    if (isDup) {
      showToast('A team with this name already exists', 'error');
      return;
    }

    const payload = {
      name: formName.trim(),
      shortCode: formCode.trim().toUpperCase(),
      logo: formLogo,
    };

    if (editTeam) {
      dispatch({ type: 'UPDATE_TEAM', payload: { id: editTeam.id, ...payload } });
      showToast('Team updated');
    } else {
      dispatch({ type: 'ADD_TEAM', payload });
      showToast('Team added');
    }
    setShowModal(false);
    resetForm();
  }

  function handleDelete() {
    if (deleteId) {
      dispatch({ type: 'DELETE_TEAM', payload: deleteId });
      showToast('Team deleted');
      setDeleteId(null);
    }
  }

  // Team profile
  const profileTeam = teams.find(t => t.id === profileTeamId);
  const profileStats = useMemo(() => {
    if (!profileTeam) return null;
    const teamMatches = matches.filter(m => m.teamAId === profileTeam.id || m.teamBId === profileTeam.id);
    const overall = getTeamStatsForMatches(teamMatches, profileTeam.id);
    const byGame = games.map(g => {
      const gamePools = pools.filter(p => p.gameId === g.id);
      const gamePoolIds = gamePools.map(p => p.id);
      const gMatches = teamMatches.filter(m => gamePoolIds.includes(m.poolId));
      const inGame = gamePools.some(p => p.teamIds.includes(profileTeam.id));
      if (!inGame) return null;
      return { game: g, stats: getTeamStatsForMatches(gMatches, profileTeam.id) };
    }).filter(Boolean);
    return { overall, byGame };
  }, [profileTeam, matches, games, pools]);

  return (
    <div className="animate-slideUp">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Teams ({teams.length})</h2>
        {isAdmin && (
          <button onClick={openAdd} className="px-4 py-2 bg-accent text-navy-900 font-bold text-sm rounded-lg hover:bg-accent-dark transition-colors">
            + Add Team
          </button>
        )}
      </div>

      {teams.length === 0 ? (
        <EmptyState
          icon="👥"
          title="No teams yet"
          description={isAdmin ? "Add your first team to get started." : "No teams have been added yet."}
          action={isAdmin ? { label: 'Add Team', onClick: openAdd } : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {teams.map(team => {
            const teamMatches = matches.filter(m => m.teamAId === team.id || m.teamBId === team.id);
            const stats = getTeamStatsForMatches(teamMatches, team.id);
            const teamGames = games.filter(g => {
              const gamePools = pools.filter(p => p.gameId === g.id);
              return gamePools.some(p => p.teamIds.includes(team.id));
            });

            return (
              <div
                key={team.id}
                className={`rounded-xl p-4 border cursor-pointer transition-all hover:scale-[1.01] hover:shadow-lg ${
                  darkMode
                    ? 'bg-navy-800/60 backdrop-blur border-white/5 hover:border-white/10'
                    : 'bg-white/80 backdrop-blur border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setProfileTeamId(team.id)}
              >
                <div className="flex items-center gap-3 mb-3">
                  <TeamLogo team={team} size={48} />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{team.name}</div>
                    <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{team.shortCode}</div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <button
                        onClick={e => { e.stopPropagation(); openEdit(team); }}
                        className={`p-1.5 rounded-lg text-sm transition-colors ${darkMode ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-700'}`}
                        aria-label="Edit team"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setDeleteId(team.id); }}
                        className="p-1.5 rounded-lg hover:bg-red-900/30 text-gray-400 hover:text-red-400 text-sm transition-colors"
                        aria-label="Delete team"
                      >
                        🗑
                      </button>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-xs mb-2">
                  <div><div className="font-mono font-bold">{stats.played}</div><div className={darkMode ? 'text-gray-500' : 'text-gray-400'}>GP</div></div>
                  <div><div className="font-mono font-bold text-win">{stats.wins}</div><div className={darkMode ? 'text-gray-500' : 'text-gray-400'}>W</div></div>
                  <div><div className="font-mono font-bold text-loss">{stats.losses}</div><div className={darkMode ? 'text-gray-500' : 'text-gray-400'}>L</div></div>
                  <div><div className="font-mono font-black text-accent text-base">{stats.points}</div><div className={darkMode ? 'text-gray-500' : 'text-gray-400'}>PTS</div></div>
                </div>
                {teamGames.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {teamGames.map(g => (
                      <span key={g.id} className={`text-xs px-2 py-0.5 rounded-full ${darkMode ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                        {g.emoji} {g.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal - admin only */}
      {isAdmin && (
        <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editTeam ? 'Edit Team' : 'Add Team'}>
          <div className="space-y-4">
            <div className="flex justify-center">
              <ImageUpload value={formLogo} onChange={setFormLogo} label="Team Logo" size={80} />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Team Name *</label>
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="Enter team name"
                className={inputCls}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Short Code * (3-4 letters)</label>
              <input
                type="text"
                value={formCode}
                onChange={e => setFormCode(e.target.value.toUpperCase().slice(0, 4))}
                placeholder="e.g. THK"
                maxLength={4}
                className={`${inputCls} font-mono`}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                darkMode ? 'bg-white/10 text-gray-300 hover:bg-white/15' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}>Cancel</button>
              <button onClick={handleSave} className="flex-1 px-4 py-2 rounded-lg bg-accent text-navy-900 font-bold hover:bg-accent-dark transition-colors">{editTeam ? 'Update' : 'Add'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Team Profile Modal - visible to all */}
      <Modal isOpen={!!profileTeamId} onClose={() => setProfileTeamId(null)} title="Team Profile" size="lg">
        {profileTeam && profileStats && (
          <div>
            <div className="flex items-center gap-4 mb-6">
              <TeamLogo team={profileTeam} size={64} />
              <div>
                <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{profileTeam.name}</h3>
                <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>{profileTeam.shortCode}</p>
              </div>
            </div>
            {/* Overall Stats */}
            <h4 className={`section-heading mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Overall Stats</h4>
            <div className={`grid grid-cols-6 gap-2 text-center mb-6 p-3 rounded-lg ${
              darkMode ? 'bg-white/5' : 'bg-gray-50'
            }`}>
              {[
                { label: 'GP', value: profileStats.overall.played },
                { label: 'W', value: profileStats.overall.wins, cls: 'text-win' },
                { label: 'L', value: profileStats.overall.losses, cls: 'text-loss' },
                { label: 'D', value: profileStats.overall.draws, cls: 'text-draw' },
                { label: 'B', value: profileStats.overall.byes, cls: 'text-bye' },
                { label: 'PTS', value: profileStats.overall.points, cls: 'text-accent' },
              ].map(s => (
                <div key={s.label}>
                  <div className={`font-mono font-bold text-lg ${s.cls || ''}`}>{s.value}</div>
                  <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{s.label}</div>
                </div>
              ))}
            </div>
            {/* Per-Game Stats */}
            {profileStats.byGame.length > 0 && (
              <>
                <h4 className={`section-heading mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Per Game</h4>
                <div className="space-y-2">
                  {profileStats.byGame.map(({ game, stats }) => (
                    <div key={game.id} className={`flex items-center gap-3 p-3 rounded-lg ${
                      darkMode ? 'bg-white/5' : 'bg-gray-50'
                    }`}>
                      <span className="text-lg">{game.emoji}</span>
                      <span className="font-medium text-sm flex-1">{game.name}</span>
                      <div className="flex gap-3 text-xs text-center">
                        <span>GP: <b>{stats.played}</b></span>
                        <span className="text-win">W: <b>{stats.wins}</b></span>
                        <span className="text-loss">L: <b>{stats.losses}</b></span>
                        <span className="text-accent">PTS: <b className="text-sm">{stats.points}</b></span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {isAdmin && (
        <ConfirmDialog
          isOpen={!!deleteId}
          onClose={() => setDeleteId(null)}
          onConfirm={handleDelete}
          title="Delete Team"
          message="This will remove the team from all pools and delete all their matches. Points will be recalculated. Are you sure?"
        />
      )}
    </div>
  );
}
