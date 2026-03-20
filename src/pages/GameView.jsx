import { useMemo, useState, useEffect } from 'react';
import { useTournament, useDispatch } from '../context/TournamentContext';
import { useAuth } from '../context/AuthContext';
import { getTeamStatsForMatches, sortTeamsByTiebreaker } from '../utils/points';
import { calculateQualifiers, generateBracket, getPoolMatchesRemaining, isKnockoutComplete, getStartingRound, getAvailableStartingRounds } from '../utils/knockout';
import TeamLogo from '../components/TeamLogo';
import EmptyState from '../components/EmptyState';
import BracketView from '../components/BracketView';
import KnockoutFixtures from '../components/KnockoutFixtures';
import QualificationPanel from '../components/QualificationPanel';
import ChampionDisplay from '../components/ChampionDisplay';
import Modal, { ConfirmDialog } from '../components/Modal';
import PointsExplainer, { TableLegend } from '../components/PointsExplainer';

let _idCounter = Date.now() + 100000;
function localGenId(prefix = '') {
  return prefix + (++_idCounter).toString(36);
}

export default function GameView() {
  const state = useTournament();
  const { dispatch, showToast } = useDispatch();
  const { isAdmin } = useAuth();
  const { games, pools, matches, teams, selectedGameId, darkMode, knockoutConfig, knockoutMatches, qualifiedTeams } = state;

  const [activeTab, setActiveTab] = useState('pool');
  const [showAdvanceConfirm, setShowAdvanceConfirm] = useState(false);
  const [showForceAdvance, setShowForceAdvance] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showChangeRound, setShowChangeRound] = useState(false);
  const [selectedStartRound, setSelectedStartRound] = useState('auto');

  const currentGame = games.find(g => g.id === selectedGameId) || games[0];
  const gameId = currentGame?.id;
  const config = gameId ? knockoutConfig[gameId] : null;
  const stage = config?.stage || 'pool';
  const knockoutEnabled = config?.enabled !== false;

  const gamePools = useMemo(() => {
    if (!currentGame) return [];
    return pools.filter(p => p.gameId === currentGame.id);
  }, [currentGame, pools]);

  const poolData = useMemo(() => {
    return gamePools.map(pool => {
      const poolMatches = matches.filter(m => m.poolId === pool.id);
      const poolTeams = pool.teamIds
        .map(tid => teams.find(t => t.id === tid))
        .filter(Boolean);

      const teamStats = poolTeams.map(team => {
        const stats = getTeamStatsForMatches(poolMatches, team.id);
        return { teamId: team.id, teamName: team.name, team, ...stats };
      });

      const sorted = sortTeamsByTiebreaker(teamStats, poolMatches);
      return { pool, matches: poolMatches, standings: sorted };
    });
  }, [gamePools, matches, teams]);

  const remainingPoolMatches = useMemo(() => {
    if (!gameId) return 0;
    return getPoolMatchesRemaining(pools, matches, gameId);
  }, [gameId, pools, matches]);

  const qualified = qualifiedTeams[gameId] || [];
  const gameKoMatches = useMemo(() =>
    knockoutMatches.filter(m => m.gameId === gameId),
    [knockoutMatches, gameId]
  );
  const koComplete = useMemo(() =>
    isKnockoutComplete(knockoutMatches, gameId),
    [knockoutMatches, gameId]
  );

  // Check if game completed and auto-mark
  useEffect(() => {
    if (koComplete && stage === 'knockout' && gameId) {
      dispatch({ type: 'COMPLETE_GAME', payload: { gameId } });
    }
  }, [koComplete, stage, gameId, dispatch]);

  function handleAdvance() {
    if (remainingPoolMatches > 0) {
      setShowForceAdvance(true);
      return;
    }
    doAdvance();
  }

  function doAdvance() {
    if (!gameId) return;

    // Calculate qualifiers
    const qualifiers = calculateQualifiers(gamePools, matches, teams, config?.qualifyCount || 2);
    dispatch({ type: 'SET_QUALIFIED_TEAMS', payload: { gameId, teams: qualifiers } });

    // Generate bracket (pass custom starting round from config if set)
    const bracketMatches = generateBracket(qualifiers, gamePools, gameId, localGenId, config?.startingRound);
    dispatch({ type: 'SET_KNOCKOUT_MATCHES', payload: { gameId, matches: bracketMatches } });

    // Advance stage
    dispatch({ type: 'ADVANCE_TO_KNOCKOUT', payload: { gameId } });

    showToast(`${currentGame.name}: Advanced to knockout stage with ${qualifiers.length} teams`);
    setActiveTab('knockout');
    setShowAdvanceConfirm(false);
    setShowForceAdvance(false);
  }

  function handleResetToPool() {
    if (!gameId) return;
    dispatch({ type: 'RESET_TO_POOL', payload: { gameId } });
    showToast('Reset to pool stage');
    setActiveTab('pool');
    setShowResetConfirm(false);
  }

  // Regenerate bracket with a different starting round
  function handleRegenerateBracket(newStartRound) {
    if (!gameId) return;

    // Recalculate qualifiers from current pool data
    const qualifiers = calculateQualifiers(gamePools, matches, teams, config?.qualifyCount || 2);
    dispatch({ type: 'SET_QUALIFIED_TEAMS', payload: { gameId, teams: qualifiers } });

    // Save the starting round preference
    dispatch({ type: 'UPDATE_KNOCKOUT_CONFIG', payload: { gameId, startingRound: newStartRound } });

    // Regenerate bracket with new starting round
    const bracketMatches = generateBracket(qualifiers, gamePools, gameId, localGenId, newStartRound);
    dispatch({ type: 'SET_KNOCKOUT_MATCHES', payload: { gameId, matches: bracketMatches } });

    const roundLabels = { auto: 'Auto', sf: 'Semi Finals', qf: 'Quarter Finals', final: 'Final', ro16: 'Round of 16', ro32: 'Round of 32' };
    showToast(`Bracket regenerated — starting from ${roundLabels[newStartRound] || newStartRound}`);
    setShowChangeRound(false);
  }

  // Sync selectedStartRound when config changes or modal opens
  function openChangeRound() {
    setSelectedStartRound(config?.startingRound || 'auto');
    setShowChangeRound(true);
  }

  if (games.length === 0) {
    return (
      <EmptyState
        icon="🎮"
        title="No games yet"
        description="Create a game to organize pools and matches."
        action={{ label: 'Go to Game Management', onClick: () => dispatch({ type: 'SET_VIEW', payload: { view: 'gameManagement' } }) }}
      />
    );
  }

  function getResultDisplay(match) {
    const teamA = teams.find(t => t.id === match.teamAId);
    const teamB = teams.find(t => t.id === match.teamBId);
    if (match.status === 'upcoming') {
      return { label: 'UPCOMING', cls: 'text-gray-400' };
    }
    if (match.result === 'draw') return { label: 'DRAW', cls: 'text-draw' };
    if (match.result === 'bye') {
      const present = match.absentTeamId === match.teamAId ? teamB : teamA;
      return { label: `BYE - ${present?.shortCode} present`, cls: 'text-bye' };
    }
    if (match.result === 'teamA') return { label: `${teamA?.shortCode} won`, cls: 'text-win' };
    if (match.result === 'teamB') return { label: `${teamB?.shortCode} won`, cls: 'text-win' };
    return { label: 'LIVE', cls: 'text-accent' };
  }

  // Determine qualified team IDs for highlighting
  const qualifiedIds = new Set(qualified.map(q => q.teamId));

  return (
    <div className="animate-slideUp">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm mb-5">
        <button onClick={() => dispatch({ type: 'SET_VIEW', payload: { view: 'dashboard' } })} className="text-accent hover:underline font-medium">
          Tournament
        </button>
        <span className={`${darkMode ? 'text-gray-600' : 'text-gray-300'}`}>/</span>
        <span className="font-semibold">{currentGame?.name || 'Games'}</span>
      </div>

      {/* Game Tabs - pill style */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-2">
        {games.map(game => (
          <button
            key={game.id}
            onClick={() => dispatch({ type: 'SELECT_GAME', payload: game.id })}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
              currentGame?.id === game.id
                ? 'bg-accent text-navy-900 shadow-lg shadow-accent/20'
                : darkMode
                ? 'bg-white/[0.04] text-gray-400 hover:bg-white/[0.08] border border-white/[0.06]'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
            }`}
          >
            <span className="text-lg">{game.emoji}</span>
            {game.name}
          </button>
        ))}
      </div>

      {/* Stage Progress Indicator */}
      {knockoutEnabled && (
        <div className={`rounded-2xl p-4 mb-5 border ${
          darkMode
            ? 'bg-navy-850/40 backdrop-blur-xl border-white/[0.06]'
            : 'bg-white/80 backdrop-blur-xl border-gray-200/80'
        }`}>
          <div className="flex items-center gap-3">
            {['pool', 'knockout', 'completed'].map((s, i) => {
              const labels = { pool: 'Pool Stage', knockout: 'Knockout Stage', completed: 'Completed' };
              const icons = { pool: '🏊', knockout: '⚔️', completed: '🏆' };
              const isCurrent = stage === s;
              const isPast = ['pool', 'knockout', 'completed'].indexOf(stage) > i;

              return (
                <div key={s} className="flex items-center gap-2">
                  {i > 0 && (
                    <div className={`w-8 h-0.5 rounded-full transition-colors ${isPast || isCurrent ? 'bg-accent' : darkMode ? 'bg-white/[0.08]' : 'bg-gray-200'}`} />
                  )}
                  <div className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                    isCurrent
                      ? 'bg-accent text-navy-900 shadow-md shadow-accent/20'
                      : isPast
                      ? 'bg-win/10 text-win'
                      : darkMode ? 'bg-white/[0.04] text-gray-500' : 'bg-gray-100 text-gray-400'
                  }`}>
                    <span>{icons[s]}</span>
                    <span className="hidden sm:inline">{labels[s]}</span>
                  </div>
                </div>
              );
            })}

            <div className="flex-1" />

            {/* Action buttons - admin only */}
            {isAdmin && stage === 'pool' && knockoutEnabled && gamePools.length > 0 && (
              <button
                onClick={handleAdvance}
                className="px-4 py-2.5 bg-accent text-navy-900 font-bold text-sm rounded-xl hover:bg-accent-dark transition-all duration-200 shadow-sm shadow-accent/20"
              >
                Advance to Knockout
              </button>
            )}
            {isAdmin && (stage === 'knockout' || stage === 'completed') && (
              <div className="flex gap-2">
                <button
                  onClick={openChangeRound}
                  className="px-3.5 py-2 text-xs rounded-xl font-semibold transition-all duration-200 bg-accent/10 text-accent hover:bg-accent/20"
                >
                  Change Round
                </button>
                <button
                  onClick={() => setShowResetConfirm(true)}
                  className={`px-3.5 py-2 text-xs rounded-xl font-medium transition-all duration-200 ${
                    darkMode ? 'bg-white/[0.04] text-gray-400 hover:bg-white/[0.08]' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  Reset to Pool
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stage Tabs */}
      {knockoutEnabled && (stage === 'knockout' || stage === 'completed') && (
        <div className="flex gap-1.5 mb-6">
          {[
            { key: 'pool', label: 'Pool Stage' },
            { key: 'knockout', label: 'Knockout Stage' },
            { key: 'bracket', label: 'Full Bracket' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                activeTab === tab.key
                  ? 'bg-accent text-navy-900 shadow-md shadow-accent/20'
                  : darkMode ? 'bg-white/[0.04] text-gray-400 hover:bg-white/[0.08]' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Per-Game Points Explainer */}
      <PointsExplainer filterType="team" gameId={gameId} />

      {/* Champion Display */}
      {stage === 'completed' && <ChampionDisplay gameId={gameId} />}

      {/* Pool Stage Tab */}
      {(activeTab === 'pool' || stage === 'pool') && (
        <>
          {/* Qualification Panel */}
          {knockoutEnabled && qualified.length > 0 && (
            <div className="mb-6">
              <QualificationPanel gameId={gameId} />
            </div>
          )}

          {/* Pools */}
          {gamePools.length === 0 ? (
            <EmptyState
              icon="🏊"
              title="No pools in this game"
              description="Create pools and assign teams to start tracking results."
              action={{ label: 'Manage Pools', onClick: () => dispatch({ type: 'SET_VIEW', payload: { view: 'gameManagement' } }) }}
            />
          ) : (
            <div className="space-y-8">
              {poolData.map(({ pool, matches: poolMatches, standings }) => (
                <div key={pool.id} className={`rounded-2xl overflow-hidden border ${
                  darkMode ? 'bg-navy-850/40 backdrop-blur-xl border-white/[0.06]' : 'bg-white/80 backdrop-blur-xl border-gray-200/80'
                }`}>
                  {/* Pool Header */}
                  <div className={`px-5 py-3.5 font-bold text-sm flex items-center justify-between ${
                    darkMode ? 'bg-white/[0.02]' : 'bg-gray-50/80'
                  }`}>
                    <span>{currentGame?.emoji} {pool.name}</span>
                    <span className={`text-xs font-medium ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      {pool.teamIds.length} teams · {poolMatches.length} matches
                    </span>
                  </div>

                  {/* Pool Table */}
                  {standings.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className={darkMode ? 'bg-white/[0.02]' : 'bg-gray-50/50'}>
                            <th className={`px-3 py-2.5 text-left section-heading w-8 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>#</th>
                            <th className={`px-3 py-2.5 text-left section-heading ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Team</th>
                            <th className={`px-3 py-2.5 text-center section-heading ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>P</th>
                            <th className="px-3 py-2.5 text-center section-heading text-win">W</th>
                            <th className="px-3 py-2.5 text-center section-heading text-loss">L</th>
                            <th className="px-3 py-2.5 text-center section-heading text-draw">D</th>
                            <th className="px-3 py-2.5 text-center section-heading text-bye">B</th>
                            <th className={`px-3 py-2.5 text-center section-heading ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Pts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {standings.map((row, i) => {
                            const isQualified = qualifiedIds.has(row.teamId);
                            const qualifyCount = config?.qualifyCount || 2;
                            const wouldQualify = i < qualifyCount;

                            return (
                              <tr key={row.teamId} className={`border-t transition-colors duration-150 ${
                                darkMode ? 'border-white/[0.04] hover:bg-white/[0.02]' : 'border-gray-100 hover:bg-gray-50/80'
                              } ${
                                isQualified ? 'border-l-[3px] border-l-win bg-win/[0.04]' :
                                wouldQualify && stage === 'pool' && knockoutEnabled ? 'border-l-[3px] border-l-win/40 bg-win/[0.02]' :
                                'border-l-[3px] border-l-transparent'
                              }`}>
                                <td className="px-3 py-2.5">
                                  <div className="flex items-center gap-1">
                                    <span className={`font-mono ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{i + 1}</span>
                                    {knockoutEnabled && (
                                      isQualified ? (
                                        <span className="w-2 h-2 rounded-full bg-win" title="Qualified" />
                                      ) : wouldQualify && stage === 'pool' ? (
                                        <span className="w-2 h-2 rounded-full bg-win/40" title="Projected qualifier" />
                                      ) : stage === 'pool' ? (
                                        <span className="w-2 h-2 rounded-full bg-loss/40" title="Eliminated" />
                                      ) : null
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <TeamLogo team={row.team} size={24} />
                                    <span className="font-medium whitespace-nowrap">{row.teamName}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-center font-mono">{row.played}</td>
                                <td className="px-3 py-2.5 text-center font-mono font-bold text-win">{row.wins}</td>
                                <td className="px-3 py-2.5 text-center font-mono font-bold text-loss">{row.losses}</td>
                                <td className="px-3 py-2.5 text-center font-mono font-bold text-draw">{row.draws}</td>
                                <td className="px-3 py-2.5 text-center font-mono font-bold text-bye">{row.byes}</td>
                                <td className="px-3 py-2.5 text-center font-mono font-black text-lg">{row.points}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <TableLegend type="team" />
                    </div>
                  ) : (
                    <p className={`p-5 text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>No teams assigned to this pool yet.</p>
                  )}

                  {/* Fixture List */}
                  {poolMatches.length > 0 && (
                    <div className={`border-t ${darkMode ? 'border-white/[0.05]' : 'border-gray-200/80'}`}>
                      <div className={`px-5 py-2.5 section-heading ${darkMode ? 'text-gray-500 bg-white/[0.02]' : 'text-gray-400 bg-gray-50/50'}`}>
                        FIXTURES
                      </div>
                      <div className={`divide-y ${darkMode ? 'divide-white/[0.04]' : 'divide-gray-100'}`}>
                        {poolMatches.map(m => {
                          const teamA = teams.find(t => t.id === m.teamAId);
                          const teamB = teams.find(t => t.id === m.teamBId);
                          const result = getResultDisplay(m);
                          const statusStripe = m.status === 'completed'
                            ? m.result === 'draw' ? 'border-l-draw' : m.result === 'bye' ? 'border-l-bye' : 'border-l-win'
                            : 'border-l-transparent';

                          return (
                            <div key={m.id} className={`px-5 py-3 flex items-center gap-3 border-l-[3px] ${statusStripe} transition-colors duration-150 ${
                              darkMode ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50/80'
                            }`}>
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <TeamLogo team={teamA} size={24} />
                                <span className={`text-sm font-medium ${m.result === 'teamA' ? 'text-win font-bold' : m.result === 'bye' && m.absentTeamId === m.teamAId ? 'text-gray-500 line-through' : ''}`}>
                                  {teamA?.shortCode || '?'}
                                </span>
                              </div>
                              <span className={`text-xs font-bold ${result.cls}`}>{result.label}</span>
                              <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                                <span className={`text-sm font-medium ${m.result === 'teamB' ? 'text-win font-bold' : m.result === 'bye' && m.absentTeamId === m.teamBId ? 'text-gray-500 line-through' : ''}`}>
                                  {teamB?.shortCode || '?'}
                                </span>
                                <TeamLogo team={teamB} size={24} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Knockout Stage Tab */}
      {activeTab === 'knockout' && (stage === 'knockout' || stage === 'completed') && (
        <div className="space-y-6">
          <QualificationPanel gameId={gameId} />
          <KnockoutFixtures gameId={gameId} />
        </div>
      )}

      {/* Full Bracket Tab */}
      {activeTab === 'bracket' && (stage === 'knockout' || stage === 'completed') && (
        <BracketView gameId={gameId} />
      )}

      {/* Force Advance Confirmation - admin only */}
      {isAdmin && <Modal
        isOpen={showForceAdvance}
        onClose={() => setShowForceAdvance(false)}
        title="Incomplete Pool Stage"
        size="sm"
      >
        <div className="space-y-4">
          <div className={`rounded-xl p-4 ${darkMode ? 'bg-draw/10 border border-draw/20' : 'bg-yellow-50 border border-yellow-200'}`}>
            <p className="text-sm text-draw font-semibold">
              {remainingPoolMatches} pool match{remainingPoolMatches !== 1 ? 'es' : ''} remaining
            </p>
            <p className={`text-xs mt-1.5 leading-relaxed ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Advancing now will use current standings to determine qualifiers. Remaining pool matches will still be playable but won't affect knockout seeding.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowForceAdvance(false)}
              className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors ${
                darkMode ? 'bg-white/[0.06] text-gray-300 hover:bg-white/[0.10]' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={doAdvance}
              className="flex-1 px-4 py-2.5 rounded-xl bg-draw text-navy-900 font-bold hover:bg-draw/80 transition-colors"
            >
              Force Advance
            </button>
          </div>
        </div>
      </Modal>}

      {/* Reset Confirmation - admin only */}
      {isAdmin && <ConfirmDialog
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={handleResetToPool}
        title="Reset to Pool Stage"
        message="This will delete all knockout matches, brackets, and qualification data for this game. Pool stage data will be preserved."
      />}

      {/* Change Starting Round Modal - admin only */}
      {isAdmin && <Modal
        isOpen={showChangeRound}
        onClose={() => setShowChangeRound(false)}
        title="Change Knockout Starting Round"
        size="sm"
      >
        <div className="space-y-4">
          <p className={`text-sm leading-relaxed ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Choose which round the knockout stage starts from. This will <strong>regenerate the entire bracket</strong> — all existing knockout results will be lost.
          </p>

          <div className="space-y-2">
            {[
              { value: 'auto', label: 'Auto', desc: `Based on ${qualified.length} qualified teams` },
              { value: 'sf', label: 'Semi Finals', desc: 'Top 4 teams only' },
              { value: 'qf', label: 'Quarter Finals', desc: 'Top 8 teams' },
              { value: 'final', label: 'Final Only', desc: 'Top 2 teams' },
              { value: 'ro16', label: 'Round of 16', desc: 'Top 16 teams' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setSelectedStartRound(opt.value)}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border text-left transition-all duration-200 ${
                  selectedStartRound === opt.value
                    ? 'bg-accent/10 border-accent text-accent'
                    : darkMode
                    ? 'bg-white/[0.02] border-white/[0.08] text-gray-300 hover:bg-white/[0.04]'
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div>
                  <div className="font-semibold text-sm">{opt.label}</div>
                  <div className={`text-xs mt-0.5 ${selectedStartRound === opt.value ? 'text-accent/70' : darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    {opt.desc}
                  </div>
                </div>
                {selectedStartRound === opt.value && (
                  <span className="text-accent text-lg">✓</span>
                )}
              </button>
            ))}
          </div>

          {/* Warning about losing results */}
          {gameKoMatches.some(m => m.status === 'completed') && (
            <div className={`rounded-xl p-4 ${darkMode ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
              <p className="text-xs text-red-400 font-semibold">
                ⚠️ Warning: You have completed knockout matches. Regenerating will erase all knockout results.
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowChangeRound(false)}
              className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors ${
                darkMode ? 'bg-white/[0.06] text-gray-300 hover:bg-white/[0.10]' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={() => handleRegenerateBracket(selectedStartRound)}
              className="flex-1 px-4 py-2.5 rounded-xl bg-accent text-navy-900 font-bold hover:bg-accent-dark transition-colors shadow-sm shadow-accent/20"
            >
              Regenerate Bracket
            </button>
          </div>
        </div>
      </Modal>}
    </div>
  );
}
