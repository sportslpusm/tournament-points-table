import { useState, useMemo } from 'react';
import { useTournament, useDispatch } from '../context/TournamentContext';
import { useAuth } from '../context/AuthContext';
import { validateRegNumber, isRegNumberUnique, validateCategoryName, LIMITS, sanitizeString } from '../utils/validation';
import {
  getIndividualGameTeamStandings,
  getAthletePoints,
  getAthleteMedals,
  getCategoryPointsBreakdown,
  DEFAULT_INDIVIDUAL_POINTS,
} from '../utils/individualPoints';
import Modal, { ConfirmDialog } from '../components/Modal';
import TeamLogo from '../components/TeamLogo';
import EmptyState from '../components/EmptyState';
import PointsExplainer, { TableLegend } from '../components/PointsExplainer';

export default function IndividualGameView() {
  const state = useTournament();
  const { dispatch, showToast } = useDispatch();
  const { isAdmin } = useAuth();
  const { games, teams, darkMode, selectedGameId, athletes, categories, individualResults, individualPointsConfig } = state;

  const game = games.find(g => g.id === selectedGameId);
  const gameCategories = categories.filter(c => c.gameId === selectedGameId);
  const gameAthletes = athletes.filter(a => a.gameId === selectedGameId);
  const gameResults = individualResults.filter(r => r.gameId === selectedGameId);
  const pointsConfig = individualPointsConfig[selectedGameId] || DEFAULT_INDIVIDUAL_POINTS;

  const [activeTab, setActiveTab] = useState('categories');
  const [expandedCat, setExpandedCat] = useState(null);
  // Category modals
  const [showAddCat, setShowAddCat] = useState(false);
  const [editCat, setEditCat] = useState(null);
  const [catName, setCatName] = useState('');
  const [deleteCatId, setDeleteCatId] = useState(null);
  // Result entry modal
  const [resultCatId, setResultCatId] = useState(null);
  const [resultFirst, setResultFirst] = useState('');
  const [resultSecond, setResultSecond] = useState('');
  const [resultThird, setResultThird] = useState('');
  const [resultAbsentees, setResultAbsentees] = useState([]);
  // Athlete modals
  const [showAddAthlete, setShowAddAthlete] = useState(false);
  const [editAthlete, setEditAthlete] = useState(null);
  const [athName, setAthName] = useState('');
  const [athReg, setAthReg] = useState('');
  const [athTeam, setAthTeam] = useState('');
  const [athCats, setAthCats] = useState([]);
  const [deleteAthleteId, setDeleteAthleteId] = useState(null);
  // Search
  const [athleteSearch, setAthleteSearch] = useState('');
  // Points config
  const [ptFirst, setPtFirst] = useState(pointsConfig.first);
  const [ptSecond, setPtSecond] = useState(pointsConfig.second);
  const [ptThird, setPtThird] = useState(pointsConfig.third);
  const [ptParticipation, setPtParticipation] = useState(pointsConfig.participation);
  const [ptMaxCap, setPtMaxCap] = useState(pointsConfig.maxParticipationCap ?? '');

  const inputCls = `w-full px-3 py-2 rounded-lg text-sm border ${
    darkMode ? 'bg-navy-800 border-white/10 text-white [&>option]:bg-navy-800 [&>option]:text-white' : 'bg-white border-gray-300 text-gray-900'
  }`;

  // Team standings
  const standings = useMemo(() =>
    getIndividualGameTeamStandings(selectedGameId, athletes, categories, individualResults, teams, pointsConfig),
    [selectedGameId, athletes, categories, individualResults, teams, pointsConfig]
  );

  // ── Category CRUD ──
  function openAddCategory() {
    setEditCat(null);
    setCatName('');
    setShowAddCat(true);
  }
  function openEditCategory(cat) {
    setEditCat(cat);
    setCatName(cat.name);
    setShowAddCat(true);
  }
  function handleSaveCategory() {
    const err = validateCategoryName(catName, categories, selectedGameId, editCat?.id);
    if (err) { showToast(err, 'error'); return; }
    if (editCat) {
      dispatch({ type: 'UPDATE_CATEGORY', payload: { id: editCat.id, name: catName.trim() } });
      showToast('Category updated');
    } else {
      dispatch({ type: 'ADD_CATEGORY', payload: { name: catName.trim(), gameId: selectedGameId } });
      showToast('Category added');
    }
    setShowAddCat(false);
  }

  // ── Result Entry ──
  function openResultEntry(catId) {
    const existing = gameResults.find(r => r.categoryId === catId);
    setResultCatId(catId);
    setResultFirst(existing?.placements?.first || '');
    setResultSecond(existing?.placements?.second || '');
    setResultThird(existing?.placements?.third || '');
    setResultAbsentees(existing?.absentees || []);
  }
  function handleSaveResult() {
    const cat = gameCategories.find(c => c.id === resultCatId);
    if (!cat) return;
    // Build participants list: all athletes in this category minus absentees
    const allInCat = cat.athleteIds;
    const placedIds = [resultFirst, resultSecond, resultThird].filter(Boolean);
    const participants = allInCat.filter(id => !resultAbsentees.includes(id));

    dispatch({
      type: 'SET_INDIVIDUAL_RESULT',
      payload: {
        categoryId: resultCatId,
        gameId: selectedGameId,
        placements: { first: resultFirst || null, second: resultSecond || null, third: resultThird || null },
        participants,
        absentees: resultAbsentees,
      },
    });
    // Mark category as completed
    dispatch({ type: 'UPDATE_CATEGORY', payload: { id: resultCatId, status: 'completed' } });
    showToast('Results saved');
    setResultCatId(null);
  }
  function toggleAbsentee(athleteId) {
    setResultAbsentees(prev =>
      prev.includes(athleteId) ? prev.filter(id => id !== athleteId) : [...prev, athleteId]
    );
  }

  // ── Athlete CRUD ──
  function openAddAthlete() {
    setEditAthlete(null);
    setAthName('');
    setAthReg('');
    setAthTeam('');
    setAthCats([]);
    setShowAddAthlete(true);
  }
  function openEditAthlete(ath) {
    setEditAthlete(ath);
    setAthName(ath.name);
    setAthReg(ath.regNumber);
    setAthTeam(ath.teamId);
    setAthCats(gameCategories.filter(c => c.athleteIds.includes(ath.id)).map(c => c.id));
    setShowAddAthlete(true);
  }
  function handleSaveAthlete() {
    if (!athName.trim()) { showToast('Athlete name is required', 'error'); return; }
    const regErr = validateRegNumber(athReg);
    if (regErr) { showToast(regErr, 'error'); return; }
    const dupAth = isRegNumberUnique(athReg, athletes, editAthlete?.id);
    if (dupAth) {
      const dupTeam = teams.find(t => t.id === dupAth.teamId);
      showToast(`Registration number already exists — belongs to ${dupAth.name} from ${dupTeam?.name || 'Unknown'}`, 'error');
      return;
    }
    if (!athTeam) { showToast('Please select a school/team', 'error'); return; }

    if (editAthlete) {
      dispatch({ type: 'UPDATE_ATHLETE', payload: { id: editAthlete.id, name: athName.trim(), regNumber: athReg, teamId: athTeam } });
      // Update category assignments
      for (const cat of gameCategories) {
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
      dispatch({ type: 'ADD_ATHLETE', payload: { name: athName.trim(), regNumber: athReg, teamId: athTeam, gameId: selectedGameId, categoryIds: athCats } });
      showToast('Athlete added');
    }
    setShowAddAthlete(false);
  }
  function toggleAthCat(catId) {
    // Single category per athlete (e.g., one weight class)
    setAthCats(prev => prev.includes(catId) ? [] : [catId]);
  }

  // ── Points Config ──
  function handleSavePointsConfig() {
    dispatch({
      type: 'UPDATE_INDIVIDUAL_POINTS_CONFIG',
      payload: {
        gameId: selectedGameId,
        first: Math.max(0, Math.min(100, Math.round(Number(ptFirst) || 0))),
        second: Math.max(0, Math.min(100, Math.round(Number(ptSecond) || 0))),
        third: Math.max(0, Math.min(100, Math.round(Number(ptThird) || 0))),
        participation: Math.max(0, Math.min(100, Math.round(Number(ptParticipation) || 0))),
        maxParticipationCap: ptMaxCap === '' || ptMaxCap === Infinity ? Infinity : Math.max(1, Math.round(Number(ptMaxCap) || Infinity)),
      },
    });
    showToast('Points configuration saved');
  }

  // Filtered athletes
  const filteredAthletes = useMemo(() => {
    const q = athleteSearch.toLowerCase();
    return gameAthletes.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.regNumber.includes(q) ||
      (teams.find(t => t.id === a.teamId)?.name || '').toLowerCase().includes(q)
    );
  }, [gameAthletes, athleteSearch, teams]);

  if (!game) {
    return <EmptyState icon="🏋️" title="Game not found" description="This game may have been deleted." />;
  }

  const tabs = [
    { id: 'categories', label: 'Categories & Results', icon: '🏅' },
    { id: 'athletes', label: 'Athletes', icon: '🏃' },
    { id: 'standings', label: 'Team Standings', icon: '📊' },
    ...(isAdmin ? [{ id: 'settings', label: 'Settings', icon: '⚙️' }] : []),
  ];

  const resultCat = gameCategories.find(c => c.id === resultCatId);
  const resultCatAthletes = resultCat ? resultCat.athleteIds.map(id => athletes.find(a => a.id === id)).filter(Boolean) : [];

  return (
    <div className="animate-slideUp">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm mb-4">
        <button onClick={() => dispatch({ type: 'SET_VIEW', payload: { view: 'dashboard' } })} className="text-accent hover:underline">
          Tournament
        </button>
        <span className={`${darkMode ? 'text-gray-600' : 'text-gray-300'}`}>/</span>
        <span className="font-medium">{game?.name || 'Games'}</span>
      </div>

      {/* Game Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {games.map(g => (
          <button
            key={g.id}
            onClick={() => dispatch({ type: 'SELECT_GAME', payload: g.id })}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              g.id === selectedGameId
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
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-3xl">{game.emoji}</span>
          <h1 className={`text-2xl md:text-3xl font-black tracking-tight ${darkMode ? 'gradient-text' : 'text-gray-900'}`}>
            {game.name}
          </h1>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-purple-500/10 text-purple-400">
            Individual Sport
          </span>
        </div>
        <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          {gameCategories.length} categories · {gameAthletes.length} athletes · {gameCategories.filter(c => c.status === 'completed').length} completed
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-accent text-navy-900 shadow-lg shadow-accent/20'
                : darkMode ? 'bg-white/5 text-gray-400 hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Per-Game Points Explainer */}
      <PointsExplainer filterType="individual" gameId={selectedGameId} />

      {/* ═══ TAB 1: Categories & Results ═══ */}
      {activeTab === 'categories' && (
        <div>
          {isAdmin && (
            <button onClick={openAddCategory} className="mb-4 px-4 py-2 bg-accent text-navy-900 font-bold text-sm rounded-lg hover:bg-accent-dark transition-colors">
              + Add Category
            </button>
          )}
          {gameCategories.length === 0 ? (
            <EmptyState icon="📁" title="No categories" description="Add weight classes, events, or divisions for this game." action={isAdmin ? { label: 'Add Category', onClick: openAddCategory } : undefined} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {gameCategories.map(cat => {
                const result = gameResults.find(r => r.categoryId === cat.id);
                const isExpanded = expandedCat === cat.id;
                const catAthletes = cat.athleteIds.map(id => athletes.find(a => a.id === id)).filter(Boolean);

                return (
                  <div
                    key={cat.id}
                    className={`rounded-xl border overflow-hidden transition-all ${
                      darkMode ? 'bg-navy-800/60 backdrop-blur border-white/5 hover:border-white/10' : 'bg-white/80 backdrop-blur border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div
                      className={`px-4 py-3 flex items-center justify-between cursor-pointer ${darkMode ? 'hover:bg-white/[0.03]' : 'hover:bg-gray-50'}`}
                      onClick={() => setExpandedCat(isExpanded ? null : cat.id)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{cat.name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          cat.status === 'completed' ? 'bg-win/10 text-win' : darkMode ? 'bg-white/5 text-gray-500' : 'bg-gray-100 text-gray-400'
                        }`}>
                          {cat.status === 'completed' ? '✓ Completed' : 'Upcoming'}
                        </span>
                        <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                          {catAthletes.length} athletes
                        </span>
                      </div>
                      <span className={`text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                    </div>

                    {/* Podium preview for completed */}
                    {result && (
                      <div className={`px-4 py-2 border-t ${darkMode ? 'border-white/5 bg-white/[0.02]' : 'border-gray-100 bg-gray-50/50'}`}>
                        <div className="flex gap-3">
                          {[
                            { place: 'first', icon: '🥇', color: 'text-gold' },
                            { place: 'second', icon: '🥈', color: 'text-silver' },
                            { place: 'third', icon: '🥉', color: 'text-bronze' },
                          ].map(({ place, icon, color }) => {
                            const ath = result.placements?.[place] ? athletes.find(a => a.id === result.placements[place]) : null;
                            const team = ath ? teams.find(t => t.id === ath.teamId) : null;
                            return (
                              <div key={place} className="flex items-center gap-1 text-xs min-w-0">
                                <span>{icon}</span>
                                {ath ? (
                                  <span className="truncate">
                                    <span className="font-medium">{ath.name}</span>
                                    {team && <span className={`ml-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>({team.shortCode})</span>}
                                  </span>
                                ) : (
                                  <span className={darkMode ? 'text-gray-600' : 'text-gray-300'}>—</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className={`px-4 py-3 border-t ${darkMode ? 'border-white/5' : 'border-gray-100'}`}>
                        {catAthletes.length === 0 ? (
                          <p className={`text-xs ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>No athletes registered in this category.</p>
                        ) : (
                          <div className="space-y-1.5 mb-3">
                            {catAthletes.map(ath => {
                              const team = teams.find(t => t.id === ath.teamId);
                              const placement = result?.placements?.first === ath.id ? '🥇' :
                                result?.placements?.second === ath.id ? '🥈' :
                                result?.placements?.third === ath.id ? '🥉' :
                                (result?.absentees || []).includes(ath.id) ? '❌ DNS' : '';
                              return (
                                <div key={ath.id} className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${darkMode ? 'bg-white/[0.03]' : 'bg-gray-50'}`}>
                                  {team && <TeamLogo team={team} size={20} />}
                                  <span className="font-medium">{ath.name}</span>
                                  <span className={`font-mono ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{ath.regNumber}</span>
                                  {placement && <span className="ml-auto">{placement}</span>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {isAdmin && (
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); openResultEntry(cat.id); }}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent text-navy-900 hover:bg-accent-dark transition-colors"
                            >
                              {result ? 'Edit Results' : 'Enter Results'}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); openEditCategory(cat); }}
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${darkMode ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                              Edit
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteCatId(cat.id); }}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-900/20 text-red-400 hover:bg-red-900/30 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        )}

                        {/* Points breakdown */}
                        {result && (
                          <div className={`mt-3 pt-2 border-t text-xs ${darkMode ? 'border-white/5 text-gray-500' : 'border-gray-100 text-gray-400'}`}>
                            {getCategoryPointsBreakdown(cat.id, [result], athletes, pointsConfig).map(entry => {
                              const team = teams.find(t => t.id === entry.teamId);
                              return (
                                <div key={entry.teamId} className="flex justify-between py-0.5">
                                  <span>{team?.shortCode || '?'}</span>
                                  <span className="font-mono">{entry.points} pts ({entry.golds}🥇 {entry.silvers}🥈 {entry.bronzes}🥉 +{entry.participations} participation)</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB 2: Athletes ═══ */}
      {activeTab === 'athletes' && (
        <div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <input
              type="text"
              placeholder="Search athletes..."
              value={athleteSearch}
              onChange={e => setAthleteSearch(e.target.value)}
              className={`px-3 py-1.5 rounded-lg text-sm border w-full sm:w-64 transition-colors ${
                darkMode ? 'bg-white/5 border-white/10 text-white placeholder-gray-500 focus:border-accent/50' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-accent'
              }`}
            />
            {isAdmin && (
              <button onClick={openAddAthlete} className="px-4 py-2 bg-accent text-navy-900 font-bold text-sm rounded-lg hover:bg-accent-dark transition-colors whitespace-nowrap">
                + Add Athlete
              </button>
            )}
          </div>

          {filteredAthletes.length === 0 ? (
            <EmptyState icon="🏃" title="No athletes" description={gameAthletes.length === 0 ? 'Register athletes for this game.' : 'No athletes match your search.'} action={isAdmin && gameAthletes.length === 0 ? { label: 'Add Athlete', onClick: openAddAthlete } : undefined} />
          ) : (
            <div className={`overflow-x-auto rounded-xl border ${darkMode ? 'bg-navy-800/40 backdrop-blur border-white/5' : 'bg-white/80 backdrop-blur border-gray-200'}`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className={darkMode ? 'bg-white/[0.03]' : 'bg-gray-50'}>
                    <th className={`px-3 py-2 text-left text-xs font-medium ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Reg No.</th>
                    <th className={`px-3 py-2 text-left text-xs font-medium ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Athlete</th>
                    <th className={`px-3 py-2 text-left text-xs font-medium ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>School</th>
                    <th className={`px-3 py-2 text-left text-xs font-medium hidden sm:table-cell ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Categories</th>
                    <th className={`px-3 py-2 text-center text-xs font-medium ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Medals</th>
                    <th className={`px-3 py-2 text-center text-xs font-medium ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Points</th>
                    {isAdmin && <th className={`px-3 py-2 text-center text-xs font-medium ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredAthletes.map(ath => {
                    const team = teams.find(t => t.id === ath.teamId);
                    const athCats = gameCategories.filter(c => c.athleteIds.includes(ath.id));
                    const medals = getAthleteMedals(ath.id, gameResults);
                    const { total: pts } = getAthletePoints(ath.id, gameResults, individualPointsConfig);

                    return (
                      <tr key={ath.id} className={`border-b transition-colors ${darkMode ? 'border-white/5 hover:bg-white/[0.03]' : 'border-gray-100 hover:bg-gray-50'}`}>
                        <td className="px-3 py-2 font-mono text-xs">{ath.regNumber}</td>
                        <td className="px-3 py-2 font-medium text-sm">{ath.name}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            {team && <TeamLogo team={team} size={20} />}
                            <span className="text-xs">{team?.shortCode || '?'}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 hidden sm:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {athCats.map(c => (
                              <span key={c.id} className={`text-[10px] px-1.5 py-0.5 rounded ${darkMode ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                                {c.name}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center text-xs">
                          {medals.golds > 0 && <span>🥇{medals.golds} </span>}
                          {medals.silvers > 0 && <span>🥈{medals.silvers} </span>}
                          {medals.bronzes > 0 && <span>🥉{medals.bronzes}</span>}
                          {medals.golds === 0 && medals.silvers === 0 && medals.bronzes === 0 && <span className={darkMode ? 'text-gray-600' : 'text-gray-300'}>—</span>}
                        </td>
                        <td className="px-3 py-2 text-center font-mono font-bold">{pts}</td>
                        {isAdmin && (
                          <td className="px-3 py-2 text-center">
                            <div className="flex gap-1 justify-center">
                              <button onClick={() => openEditAthlete(ath)} className={`p-1 rounded text-xs transition-colors ${darkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>✏️</button>
                              <button onClick={() => setDeleteAthleteId(ath.id)} className="p-1 rounded text-xs hover:bg-red-900/30 text-gray-400 hover:text-red-400 transition-colors">🗑</button>
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
        </div>
      )}

      {/* ═══ TAB 3: Team Standings ═══ */}
      {activeTab === 'standings' && (
        <div>
          {standings.length === 0 ? (
            <EmptyState icon="📊" title="No standings yet" description="Register athletes and enter results to see team standings." />
          ) : (
            <div className={`overflow-x-auto rounded-xl border ${darkMode ? 'bg-navy-800/40 backdrop-blur border-white/5' : 'bg-white/80 backdrop-blur border-gray-200'}`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className={darkMode ? 'bg-white/[0.03]' : 'bg-gray-50'}>
                    <th className={`px-3 py-2 text-left text-xs font-medium ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>#</th>
                    <th className={`px-3 py-2 text-left text-xs font-medium ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>School</th>
                    <th className={`px-2 py-2 text-center text-xs font-medium ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Athletes</th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-gold">🥇</th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-silver">🥈</th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-bronze">🥉</th>
                    <th className={`px-2 py-2 text-center text-xs font-medium hidden sm:table-cell ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Part.</th>
                    <th className={`px-2 py-2 text-center text-xs font-medium hidden sm:table-cell ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Place.</th>
                    <th className={`px-3 py-2 text-center text-xs font-medium ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((row) => {
                    const rank = row.rank;
                    const rowBg = rank === 1 ? (darkMode ? 'bg-yellow-500/5' : 'bg-yellow-50/50') :
                                  rank === 2 ? (darkMode ? 'bg-gray-400/5' : 'bg-gray-50/50') :
                                  rank === 3 ? (darkMode ? 'bg-orange-500/5' : 'bg-orange-50/50') : '';
                    const leftBorder = rank === 1 ? 'border-l-[3px] border-l-gold' :
                                       rank === 2 ? 'border-l-[3px] border-l-silver' :
                                       rank === 3 ? 'border-l-[3px] border-l-bronze' : 'border-l-[3px] border-l-transparent';

                    return (
                      <tr key={row.teamId} className={`border-b transition-colors ${darkMode ? 'border-white/5' : 'border-gray-100'} ${rowBg} ${leftBorder}`}>
                        <td className="px-3 py-2 font-mono text-sm">{rank}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <TeamLogo team={row.team} size={28} />
                            <div>
                              <span className="font-semibold text-sm hidden sm:inline">{row.team?.name}</span>
                              <span className="font-semibold text-xs sm:hidden">{row.team?.shortCode}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-center font-mono text-xs">{row.athleteCount}</td>
                        <td className="px-2 py-2 text-center font-mono font-bold text-gold">{row.golds || '—'}</td>
                        <td className="px-2 py-2 text-center font-mono font-bold text-silver">{row.silvers || '—'}</td>
                        <td className="px-2 py-2 text-center font-mono font-bold text-bronze">{row.bronzes || '—'}</td>
                        <td className="px-2 py-2 text-center font-mono text-xs hidden sm:table-cell">{row.participationPoints}</td>
                        <td className="px-2 py-2 text-center font-mono text-xs hidden sm:table-cell">{row.placementPoints}</td>
                        <td className="px-3 py-2 text-center font-mono font-black text-lg">{row.totalPoints}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <TableLegend type="individual" />
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB 4: Settings (Admin) ═══ */}
      {activeTab === 'settings' && isAdmin && (
        <div className={`rounded-xl border p-6 max-w-md ${darkMode ? 'bg-navy-800/40 backdrop-blur border-white/5' : 'bg-white/80 backdrop-blur border-gray-200'}`}>
          <h3 className="font-bold mb-4">Points Configuration</h3>
          <p className={`text-xs mb-4 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            Configure how many bonus points are awarded for each placement. Participation points are awarded to every athlete who competes.
          </p>
          <div className="space-y-3">
            {[
              { label: '🥇 1st Place Bonus', value: ptFirst, set: setPtFirst },
              { label: '🥈 2nd Place Bonus', value: ptSecond, set: setPtSecond },
              { label: '🥉 3rd Place Bonus', value: ptThird, set: setPtThird },
              { label: '👤 Participation', value: ptParticipation, set: setPtParticipation },
            ].map(({ label, value, set }) => (
              <div key={label} className="flex items-center justify-between gap-4">
                <label className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{label}</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={value}
                  onChange={e => set(e.target.value)}
                  onBlur={e => set(Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))))}
                  className={`w-20 px-3 py-2 rounded-lg text-sm border text-center ${
                    darkMode ? 'bg-navy-800 border-white/10 text-white' : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              </div>
            ))}
          </div>

          {/* Participation Cap */}
          <div className={`mt-4 pt-4 border-t ${darkMode ? 'border-white/10' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <label className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>🛡️ Max Participation Cap</label>
                <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  Max participation points a single team can earn per event. Leave empty for no limit. Medal bonuses are never capped.
                </p>
              </div>
              <input
                type="number"
                min="1"
                max="100"
                placeholder="∞"
                value={ptMaxCap === Infinity || ptMaxCap === '' ? '' : ptMaxCap}
                onChange={e => setPtMaxCap(e.target.value === '' ? '' : Number(e.target.value))}
                onBlur={e => {
                  if (e.target.value === '') setPtMaxCap('');
                  else setPtMaxCap(Math.max(1, Math.min(100, Math.round(Number(e.target.value) || 1))));
                }}
                className={`w-20 px-3 py-2 rounded-lg text-sm border text-center ${
                  darkMode ? 'bg-navy-800 border-white/10 text-white' : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>
          </div>
          <button
            onClick={handleSavePointsConfig}
            className="mt-4 w-full px-4 py-2 bg-accent text-navy-900 font-bold text-sm rounded-lg hover:bg-accent-dark transition-colors"
          >
            Save Points Config
          </button>
        </div>
      )}

      {/* ══════ MODALS ══════ */}

      {/* Add/Edit Category Modal */}
      <Modal isOpen={showAddCat} onClose={() => setShowAddCat(false)} title={editCat ? 'Edit Category' : 'Add Category'}>
        <div className="space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Category Name *</label>
            <input
              type="text"
              value={catName}
              onChange={e => setCatName(e.target.value)}
              placeholder="e.g. 69 kg, 100m Sprint"
              className={inputCls}
              autoFocus
            />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowAddCat(false)} className={`flex-1 px-4 py-2 rounded-lg transition-colors ${darkMode ? 'bg-white/10 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>Cancel</button>
            <button onClick={handleSaveCategory} className="flex-1 px-4 py-2 rounded-lg bg-accent text-navy-900 font-bold hover:bg-accent-dark transition-colors">{editCat ? 'Update' : 'Add'}</button>
          </div>
        </div>
      </Modal>

      {/* Result Entry Modal */}
      <Modal isOpen={!!resultCatId} onClose={() => setResultCatId(null)} title={`Results: ${resultCat?.name || ''}`} size="lg">
        {resultCat && (
          <div className="space-y-4">
            {resultCatAthletes.length === 0 ? (
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>No athletes registered in this category. Add athletes first.</p>
            ) : (
              <>
                <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Select placements and mark absent athletes.</p>
                {[
                  { label: '🥇 1st Place (Gold)', value: resultFirst, set: setResultFirst },
                  { label: '🥈 2nd Place (Silver)', value: resultSecond, set: setResultSecond },
                  { label: '🥉 3rd Place (Bronze)', value: resultThird, set: setResultThird },
                ].map(({ label, value, set }) => (
                  <div key={label}>
                    <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{label}</label>
                    <select value={value} onChange={e => set(e.target.value)} className={inputCls}>
                      <option value="">— None —</option>
                      {resultCatAthletes.filter(a => !resultAbsentees.includes(a.id)).map(a => {
                        const team = teams.find(t => t.id === a.teamId);
                        return <option key={a.id} value={a.id}>{a.name} ({team?.shortCode}) — {a.regNumber}</option>;
                      })}
                    </select>
                  </div>
                ))}

                <div>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Absent / DNS Athletes</label>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {resultCatAthletes.map(a => {
                      const team = teams.find(t => t.id === a.teamId);
                      const isAbsent = resultAbsentees.includes(a.id);
                      const isPlaced = [resultFirst, resultSecond, resultThird].includes(a.id);
                      return (
                        <label
                          key={a.id}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer transition-colors ${
                            isAbsent ? 'bg-red-900/20 text-red-400' : darkMode ? 'bg-white/[0.03] hover:bg-white/5' : 'bg-gray-50 hover:bg-gray-100'
                          } ${isPlaced ? 'opacity-40 pointer-events-none' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isAbsent}
                            onChange={() => toggleAbsentee(a.id)}
                            disabled={isPlaced}
                            className="rounded"
                          />
                          <span>{a.name}</span>
                          <span className={`text-xs font-mono ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{a.regNumber}</span>
                          {team && <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>({team.shortCode})</span>}
                          {isAbsent && <span className="ml-auto text-xs text-red-400">DNS</span>}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setResultCatId(null)} className={`flex-1 px-4 py-2 rounded-lg transition-colors ${darkMode ? 'bg-white/10 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>Cancel</button>
                  <button onClick={handleSaveResult} className="flex-1 px-4 py-2 rounded-lg bg-accent text-navy-900 font-bold hover:bg-accent-dark transition-colors">Save Results</button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Add/Edit Athlete Modal */}
      <Modal isOpen={showAddAthlete} onClose={() => setShowAddAthlete(false)} title={editAthlete ? 'Edit Athlete' : 'Add Athlete'}>
        <div className="space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Full Name *</label>
            <input type="text" value={athName} onChange={e => setAthName(e.target.value)} placeholder="Athlete full name" className={inputCls} autoFocus />
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
          {gameCategories.length > 0 && (
            <div>
              <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Category</label>
              <p className={`text-[10px] mb-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Select one category per athlete</p>
              <div className="flex flex-wrap gap-2">
                {gameCategories.map(c => (
                  <button
                    key={c.id}
                    onClick={() => toggleAthCat(c.id)}
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
            <button onClick={() => setShowAddAthlete(false)} className={`flex-1 px-4 py-2 rounded-lg transition-colors ${darkMode ? 'bg-white/10 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>Cancel</button>
            <button onClick={handleSaveAthlete} className="flex-1 px-4 py-2 rounded-lg bg-accent text-navy-900 font-bold hover:bg-accent-dark transition-colors">{editAthlete ? 'Update' : 'Add'} Athlete</button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirms */}
      <ConfirmDialog
        isOpen={!!deleteCatId}
        onClose={() => setDeleteCatId(null)}
        onConfirm={() => { dispatch({ type: 'DELETE_CATEGORY', payload: deleteCatId }); showToast('Category deleted'); setDeleteCatId(null); }}
        title="Delete Category"
        message="This will delete the category and all its results. Team points will be recalculated."
      />
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
        message="This will remove the athlete from all categories. Any placements will shift up (2nd→1st, 3rd→2nd) and points will be recalculated."
      />
    </div>
  );
}
