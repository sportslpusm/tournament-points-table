import { useState, useMemo } from 'react';
import { useTournament, useDispatch } from '../context/TournamentContext';
import { useAuth } from '../context/AuthContext';
import { validateRegNumber, isRegNumberUnique } from '../utils/validation';
import { getAthletePoints, getAthleteMedals } from '../utils/individualPoints';
import Modal, { ConfirmDialog } from '../components/Modal';
import TeamLogo from '../components/TeamLogo';
import EmptyState from '../components/EmptyState';

export default function AthleteManagement() {
  const state = useTournament();
  const { dispatch, showToast } = useDispatch();
  const { isAdmin } = useAuth();
  const { teams, games, darkMode, athletes, categories, individualResults, individualPointsConfig } = state;

  const individualGames = games.filter(g => g.type === 'individual');

  const [search, setSearch] = useState('');
  const [filterGame, setFilterGame] = useState('');
  const [filterTeam, setFilterTeam] = useState('');

  // Add/Edit athlete
  const [showModal, setShowModal] = useState(false);
  const [editAthlete, setEditAthlete] = useState(null);
  const [athName, setAthName] = useState('');
  const [athReg, setAthReg] = useState('');
  const [athTeam, setAthTeam] = useState('');
  const [athGame, setAthGame] = useState('');
  const [athCats, setAthCats] = useState([]);
  const [deleteAthleteId, setDeleteAthleteId] = useState(null);

  const inputCls = `w-full px-3 py-2 rounded-lg text-sm border ${
    darkMode ? 'bg-navy-800 border-white/10 text-white [&>option]:bg-navy-800 [&>option]:text-white' : 'bg-white border-gray-300 text-gray-900'
  }`;

  const filtered = useMemo(() => {
    let list = athletes;
    if (filterGame) list = list.filter(a => a.gameId === filterGame);
    if (filterTeam) list = list.filter(a => a.teamId === filterTeam);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.regNumber.includes(q) ||
        (teams.find(t => t.id === a.teamId)?.name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [athletes, search, filterGame, filterTeam, teams]);

  function openAdd() {
    setEditAthlete(null);
    setAthName('');
    setAthReg('');
    setAthTeam('');
    setAthGame(individualGames[0]?.id || '');
    setAthCats([]);
    setShowModal(true);
  }

  function openEdit(ath) {
    setEditAthlete(ath);
    setAthName(ath.name);
    setAthReg(ath.regNumber);
    setAthTeam(ath.teamId);
    setAthGame(ath.gameId);
    setAthCats(categories.filter(c => c.athleteIds.includes(ath.id)).map(c => c.id));
    setShowModal(true);
  }

  function handleSave() {
    if (!athName.trim()) { showToast('Name is required', 'error'); return; }
    const regErr = validateRegNumber(athReg);
    if (regErr) { showToast(regErr, 'error'); return; }
    const dupAth = isRegNumberUnique(athReg, athletes, editAthlete?.id);
    if (dupAth) {
      const dupTeam = teams.find(t => t.id === dupAth.teamId);
      showToast(`Registration number already exists — belongs to ${dupAth.name} from ${dupTeam?.name || 'Unknown'}`, 'error');
      return;
    }
    if (!athTeam) { showToast('Please select a school/team', 'error'); return; }
    if (!athGame) { showToast('Please select a game', 'error'); return; }

    if (editAthlete) {
      dispatch({ type: 'UPDATE_ATHLETE', payload: { id: editAthlete.id, name: athName.trim(), regNumber: athReg, teamId: athTeam, gameId: athGame } });
      // Update category assignments
      const gameCats = categories.filter(c => c.gameId === athGame);
      for (const cat of gameCats) {
        const isIn = cat.athleteIds.includes(editAthlete.id);
        const shouldBeIn = athCats.includes(cat.id);
        if (isIn && !shouldBeIn) {
          dispatch({ type: 'UPDATE_CATEGORY', payload: { id: cat.id, athleteIds: cat.athleteIds.filter(id => id !== editAthlete.id) } });
        } else if (!isIn && shouldBeIn) {
          dispatch({ type: 'UPDATE_CATEGORY', payload: { id: cat.id, athleteIds: [...cat.athleteIds, editAthlete.id] } });
        }
      }
      showToast('Athlete updated');
    } else {
      dispatch({ type: 'ADD_ATHLETE', payload: { name: athName.trim(), regNumber: athReg, teamId: athTeam, gameId: athGame, categoryIds: athCats } });
      showToast('Athlete added');
    }
    setShowModal(false);
  }

  const gameCatsForModal = categories.filter(c => c.gameId === athGame);

  if (individualGames.length === 0 && athletes.length === 0) {
    return (
      <div className="animate-slideUp">
        <h2 className="text-xl font-bold mb-4">Athletes</h2>
        <EmptyState
          icon="🏃"
          title="No individual games yet"
          description="Create an individual game first (e.g., Powerlifting, Athletics) to manage athletes."
        />
      </div>
    );
  }

  return (
    <div className="animate-slideUp">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Athletes</h2>
        <span className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{athletes.length} total</span>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="text"
          placeholder="Search name, reg no., school..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={`px-3 py-1.5 rounded-lg text-sm border flex-1 transition-colors ${
            darkMode ? 'bg-white/5 border-white/10 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
          }`}
        />
        <select
          value={filterGame}
          onChange={e => setFilterGame(e.target.value)}
          className={`px-3 py-1.5 rounded-lg text-sm border ${darkMode ? 'bg-navy-800 border-white/10 text-white [&>option]:bg-navy-800 [&>option]:text-white' : 'bg-white border-gray-300 text-gray-900'}`}
        >
          <option value="">All Games</option>
          {individualGames.map(g => <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>)}
        </select>
        <select
          value={filterTeam}
          onChange={e => setFilterTeam(e.target.value)}
          className={`px-3 py-1.5 rounded-lg text-sm border ${darkMode ? 'bg-navy-800 border-white/10 text-white [&>option]:bg-navy-800 [&>option]:text-white' : 'bg-white border-gray-300 text-gray-900'}`}
        >
          <option value="">All Schools</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {isAdmin && (
          <button onClick={openAdd} className="px-4 py-1.5 bg-accent text-navy-900 font-bold text-sm rounded-lg hover:bg-accent-dark transition-colors whitespace-nowrap">
            + Add
          </button>
        )}
      </div>

      {/* Athletes List */}
      {filtered.length === 0 ? (
        <EmptyState icon="🏃" title="No athletes found" description={athletes.length === 0 ? 'Register athletes in individual games.' : 'No athletes match your filters.'} />
      ) : (
        <div className={`overflow-x-auto rounded-xl border ${darkMode ? 'bg-navy-800/40 backdrop-blur border-white/5' : 'bg-white/80 backdrop-blur border-gray-200'}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className={darkMode ? 'bg-white/[0.03]' : 'bg-gray-50'}>
                <th className={`px-3 py-2 text-left text-xs font-medium ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Reg No.</th>
                <th className={`px-3 py-2 text-left text-xs font-medium ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Name</th>
                <th className={`px-3 py-2 text-left text-xs font-medium ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>School</th>
                <th className={`px-3 py-2 text-left text-xs font-medium hidden md:table-cell ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Game</th>
                <th className={`px-3 py-2 text-center text-xs font-medium ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Medals</th>
                <th className={`px-3 py-2 text-center text-xs font-medium ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Points</th>
                {isAdmin && <th className={`px-3 py-2 text-center text-xs font-medium ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(ath => {
                const team = teams.find(t => t.id === ath.teamId);
                const game = games.find(g => g.id === ath.gameId);
                const medals = getAthleteMedals(ath.id, individualResults);
                const { total: pts } = getAthletePoints(ath.id, individualResults, individualPointsConfig);

                return (
                  <tr key={ath.id} className={`border-b transition-colors ${darkMode ? 'border-white/5 hover:bg-white/[0.03]' : 'border-gray-100 hover:bg-gray-50'}`}>
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{ath.regNumber}</td>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{ath.name}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        {team && <TeamLogo team={team} size={20} />}
                        <span className="text-xs">{team?.shortCode || '?'}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell">
                      <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{game?.emoji} {game?.name}</span>
                    </td>
                    <td className="px-3 py-2 text-center text-xs whitespace-nowrap">
                      {medals.golds > 0 && <span>🥇{medals.golds} </span>}
                      {medals.silvers > 0 && <span>🥈{medals.silvers} </span>}
                      {medals.bronzes > 0 && <span>🥉{medals.bronzes}</span>}
                      {medals.golds === 0 && medals.silvers === 0 && medals.bronzes === 0 && '—'}
                    </td>
                    <td className="px-3 py-2 text-center font-mono font-bold">{pts}</td>
                    {isAdmin && (
                      <td className="px-3 py-2 text-center">
                        <div className="flex gap-1 justify-center">
                          <button onClick={() => openEdit(ath)} className={`p-1 rounded text-xs ${darkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>✏️</button>
                          <button onClick={() => setDeleteAthleteId(ath.id)} className="p-1 rounded text-xs hover:bg-red-900/30 text-gray-400 hover:text-red-400">🗑</button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editAthlete ? 'Edit Athlete' : 'Add Athlete'}>
        <div className="space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Full Name *</label>
            <input type="text" value={athName} onChange={e => setAthName(e.target.value)} placeholder="Athlete name" className={inputCls} autoFocus />
          </div>
          <div>
            <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Registration Number *</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={8}
              value={athReg}
              onChange={e => setAthReg(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="12345678"
              className={`${inputCls} font-mono tracking-wider`}
            />
            <div className="flex justify-between mt-1">
              {(() => {
                const dup = athReg.length === 8 ? isRegNumberUnique(athReg, athletes, editAthlete?.id) : null;
                const color = dup ? 'text-loss' : athReg.length === 8 ? 'text-win' : athReg.length > 0 ? 'text-loss' : darkMode ? 'text-gray-600' : 'text-gray-400';
                const text = dup ? `⚠ Already used by ${dup.name}` : athReg.length === 8 ? '✓ Valid' : athReg.length > 0 ? `${athReg.length}/8 digits` : 'Exactly 8 digits required';
                return <span className={`text-xs ${color}`}>{text}</span>;
              })()}
              <span className={`text-xs font-mono ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{athReg.length}/8</span>
            </div>
          </div>
          <div>
            <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>School / Team *</label>
            <select value={athTeam} onChange={e => setAthTeam(e.target.value)} className={inputCls}>
              <option value="">Select School</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.shortCode})</option>)}
            </select>
          </div>
          <div>
            <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Game *</label>
            <select
              value={athGame}
              onChange={e => { setAthGame(e.target.value); setAthCats([]); }}
              className={inputCls}
              disabled={!!editAthlete}
            >
              <option value="">Select Game</option>
              {individualGames.map(g => <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>)}
            </select>
          </div>
          {gameCatsForModal.length > 0 && (
            <div>
              <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Category</label>
              <p className={`text-[10px] mb-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Select one category per athlete</p>
              <div className="flex flex-wrap gap-2">
                {gameCatsForModal.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setAthCats(prev => prev.includes(c.id) ? [] : [c.id])}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      athCats.includes(c.id)
                        ? 'bg-accent/20 border-accent text-accent'
                        : darkMode ? 'bg-white/5 border-white/10 text-gray-300' : 'bg-gray-50 border-gray-300 text-gray-700'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className={`flex-1 px-4 py-2 rounded-lg transition-colors ${darkMode ? 'bg-white/10 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>Cancel</button>
            <button onClick={handleSave} className="flex-1 px-4 py-2 rounded-lg bg-accent text-navy-900 font-bold hover:bg-accent-dark transition-colors">{editAthlete ? 'Update' : 'Add'} Athlete</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteAthleteId}
        onClose={() => setDeleteAthleteId(null)}
        onConfirm={() => {
          const ath = athletes.find(a => a.id === deleteAthleteId);
          dispatch({ type: 'DELETE_ATHLETE', payload: deleteAthleteId });
          showToast(`${ath?.name || 'Athlete'} deleted. Placements shifted up.`);
          setDeleteAthleteId(null);
        }}
        title="Delete Athlete"
        message="This will remove the athlete from all categories and results. Placements will shift up (2nd→1st, 3rd→2nd) and points will be recalculated."
      />
    </div>
  );
}
