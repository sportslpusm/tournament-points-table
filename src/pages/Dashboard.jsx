import { useState, useMemo, useRef } from 'react';
import { useTournament, useDispatch } from '../context/TournamentContext';
import { getTeamStatsForMatches, sortTeamsByTiebreaker, getTeamCombinedStats } from '../utils/points';
import { getTeamFurthestRound, getChampion } from '../utils/knockout';
import { getIndividualPointsForTeam, getTeamMedals } from '../utils/individualPoints';
import TeamLogo from '../components/TeamLogo';
import EmptyState from '../components/EmptyState';
import PointsExplainer, { TableLegend } from '../components/PointsExplainer';
import PointsBreakdownPopover from '../components/PointsBreakdownPopover';

export default function Dashboard() {
  const state = useTournament();
  const { dispatch } = useDispatch();
  const { teams, games, pools, matches, darkMode, knockoutConfig, knockoutMatches, athletes, individualResults, individualPointsConfig, categories } = state;
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('table');
  const [compareTeams, setCompareTeams] = useState([null, null]);
  const [showCompare, setShowCompare] = useState(false);
  const tableRef = useRef(null);

  const totalMatches = matches.filter(m => m.status === 'completed').length;
  const upcomingMatches = matches.filter(m => m.status === 'upcoming').length;
  const totalKoMatches = knockoutMatches.filter(m => m.status === 'completed').length;

  // Compute overall standings with knockout points
  const standings = useMemo(() => {
    const teamStats = teams.map(team => {
      const teamPoolMatches = matches.filter(m => m.teamAId === team.id || m.teamBId === team.id);
      const teamKoMatches = knockoutMatches.filter(m => m.teamAId === team.id || m.teamBId === team.id);

      const teamGames = games.filter(g => {
        const gamePools = pools.filter(p => p.gameId === g.id);
        return gamePools.some(p => p.teamIds.includes(team.id));
      });

      const koGameIds = new Set(teamKoMatches.map(m => m.gameId));
      const allGameIds = new Set([...teamGames.map(g => g.id), ...koGameIds]);

      let totalPlayed = 0, totalWins = 0, totalLosses = 0, totalDraws = 0, totalByes = 0, totalPoints = 0;
      let poolPts = 0, koPts = 0;

      const poolStats = getTeamStatsForMatches(teamPoolMatches, team.id);
      totalPlayed += poolStats.played;
      totalWins += poolStats.wins;
      totalLosses += poolStats.losses;
      totalDraws += poolStats.draws;
      totalByes += poolStats.byes;
      totalPoints += poolStats.points;
      poolPts = poolStats.points;

      for (const gid of koGameIds) {
        const cfg = knockoutConfig[gid];
        const bonus = cfg?.bonusPoints;
        const gameKo = teamKoMatches.filter(m => m.gameId === gid);
        for (const m of gameKo) {
          if (m.status !== 'completed') continue;
          if (m.teamAId !== team.id && m.teamBId !== team.id) continue;

          if (m.result === 'bye') {
            totalByes++;
            if (m.absentTeamId !== team.id) {
              totalPlayed++;
              totalPoints += 2;
              koPts += 2;
            }
            continue;
          }

          totalPlayed++;
          totalPoints += 1;
          koPts += 1;

          const isWinner =
            (m.result === 'teamA' && m.teamAId === team.id) ||
            (m.result === 'teamB' && m.teamBId === team.id);
          if (isWinner) {
            totalWins++;
            totalPoints += 3;
            koPts += 3;
            if (bonus?.enabled) {
              const b = m.round === 'qf' ? (bonus.qf || 0) :
                        m.round === 'sf' ? (bonus.sf || 0) :
                        m.round === 'final' ? (bonus.final || 0) :
                        m.round === 'third' ? (bonus.third || 0) : 0;
              totalPoints += b;
              koPts += b;
            }
          } else {
            totalLosses++;
          }
        }
      }

      let bestAdvancement = 'Pool Stage';
      const gameAdvancements = [];
      for (const gid of allGameIds) {
        const game = games.find(g => g.id === gid);
        const cfg = knockoutConfig[gid];
        const gameStage = cfg?.stage || 'pool';
        const adv = getTeamFurthestRound(knockoutMatches, team.id, gid);
        if (adv) {
          const priority = { 'Champion': 7, 'Finalist': 6, '3rd Place': 5, '4th Place': 4, 'Semi-Finalist': 3, 'Quarter-Finalist': 2, 'Round of 16': 1, 'Round of 32': 0.5, 'Pool Stage': 0 };
          if ((priority[adv] || 0) > (priority[bestAdvancement] || 0)) {
            bestAdvancement = adv;
          }
          if (game) gameAdvancements.push({ game, status: adv });
        } else if (game && (gameStage === 'pool' || gameStage === 'knockout')) {
          gameAdvancements.push({ game, status: 'Participation' });
        }
      }

      const championOf = [];
      for (const gid of allGameIds) {
        const champ = getChampion(knockoutMatches, gid);
        if (champ === team.id) {
          const game = games.find(g => g.id === gid);
          if (game) championOf.push(game);
        }
      }

      const indPts = getIndividualPointsForTeam(team.id, athletes, individualResults, individualPointsConfig);
      const medals = getTeamMedals(team.id, athletes, individualResults);
      totalPoints += indPts;

      return {
        teamId: team.id,
        teamName: team.name,
        team,
        gameIds: [...allGameIds],
        played: totalPlayed,
        wins: totalWins,
        losses: totalLosses,
        draws: totalDraws,
        byes: totalByes,
        points: totalPoints,
        poolPoints: poolPts,
        knockoutPoints: koPts,
        individualPoints: indPts,
        medals,
        advancement: bestAdvancement,
        gameAdvancements,
        championOf,
      };
    });
    return sortTeamsByTiebreaker(teamStats, matches);
  }, [teams, matches, games, pools, knockoutMatches, knockoutConfig, athletes, individualResults, individualPointsConfig]);

  const filtered = standings.filter(s =>
    s.teamName.toLowerCase().includes(search.toLowerCase())
  );

  // Tournament Progress
  const gameProgress = useMemo(() => {
    return games.map(g => {
      if (g.type === 'individual') {
        const gameCats = categories.filter(c => c.gameId === g.id);
        const completedCats = gameCats.filter(c => c.status === 'completed').length;
        const totalCats = gameCats.length;
        const stage = totalCats > 0 && completedCats === totalCats ? 'completed' : 'pool';
        return { game: g, stage, champTeam: null, isIndividual: true, completedCats, totalCats };
      }
      const cfg = knockoutConfig[g.id];
      const stage = cfg?.stage || 'pool';
      const champ = getChampion(knockoutMatches, g.id);
      const champTeam = champ ? teams.find(t => t.id === champ) : null;
      return { game: g, stage, champTeam, isIndividual: false };
    });
  }, [games, knockoutConfig, knockoutMatches, teams, categories]);

  // Recent results
  const recentResults = useMemo(() => {
    const poolResults = matches
      .filter(m => m.status === 'completed')
      .slice(-5)
      .reverse()
      .map(m => {
        const teamA = teams.find(t => t.id === m.teamAId);
        const teamB = teams.find(t => t.id === m.teamBId);
        const pool = pools.find(p => p.id === m.poolId);
        const game = pool ? games.find(g => g.id === pool.gameId) : null;
        return { ...m, teamA, teamB, pool, game, isKnockout: false };
      });

    const koResults = knockoutMatches
      .filter(m => m.status === 'completed')
      .slice(-5)
      .reverse()
      .map(m => {
        const teamA = teams.find(t => t.id === m.teamAId);
        const teamB = teams.find(t => t.id === m.teamBId);
        const game = games.find(g => g.id === m.gameId);
        return { ...m, teamA, teamB, game, isKnockout: true };
      });

    return [...koResults, ...poolResults].slice(0, 10);
  }, [matches, knockoutMatches, teams, pools, games]);

  function getRankBadge(rank) {
    if (rank === 1) return <span className="inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 text-navy-950 font-bold text-[10px] sm:text-sm shadow-lg shadow-yellow-500/30">1</span>;
    if (rank === 2) return <span className="inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 text-navy-950 font-bold text-[10px] sm:text-sm shadow-lg shadow-gray-400/20">2</span>;
    if (rank === 3) return <span className="inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-white font-bold text-[10px] sm:text-sm shadow-lg shadow-orange-500/30">3</span>;
    return <span className={`inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full font-mono text-[10px] sm:text-sm ${darkMode ? 'bg-white/[0.04] text-text-secondary' : 'bg-gray-100 text-gray-500'}`}>{rank}</span>;
  }

  function getRowBg(rank) {
    if (rank === 1) return darkMode ? 'bg-yellow-500/[0.04] hover:bg-yellow-500/[0.08]' : 'bg-yellow-50/50 hover:bg-yellow-50';
    if (rank === 2) return darkMode ? 'bg-gray-400/[0.03] hover:bg-gray-400/[0.06]' : 'bg-gray-50/50 hover:bg-gray-50';
    if (rank === 3) return darkMode ? 'bg-orange-500/[0.04] hover:bg-orange-500/[0.08]' : 'bg-orange-50/50 hover:bg-orange-50';
    return darkMode ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50';
  }

  function getRowLeftBorder(rank) {
    if (rank === 1) return 'border-l-[3px] border-l-gold';
    if (rank === 2) return 'border-l-[3px] border-l-silver';
    if (rank === 3) return 'border-l-[3px] border-l-bronze';
    return 'border-l-[3px] border-l-transparent';
  }

  function getAdvancementBadge(adv) {
    const colors = {
      'Champion': 'bg-gold/20 text-gold border border-gold/30',
      'Finalist': 'bg-silver/20 text-silver border border-silver/30',
      '3rd Place': 'bg-bronze/20 text-bronze border border-bronze/30',
      '4th Place': darkMode ? 'bg-white/[0.04] text-text-secondary border border-white/[0.06]' : 'bg-gray-100 text-gray-500 border border-gray-200',
      'Semi-Finalist': 'bg-accent/10 text-accent border border-accent/20',
      'Quarter-Finalist': darkMode ? 'bg-white/[0.04] text-text-secondary border border-white/[0.06]' : 'bg-gray-100 text-gray-500 border border-gray-200',
    };
    if (!adv || adv === 'Pool Stage') return null;
    return (
      <span className={`text-[10px] px-2 py-0.5 rounded-lg font-semibold uppercase tracking-wider ${colors[adv] || (darkMode ? 'bg-white/[0.04] text-text-secondary' : 'bg-gray-100 text-gray-500')}`}>
        {adv}
      </span>
    );
  }

  function handleScreenshot() {
    if (!tableRef.current) return;
    import('html2canvas').then(({ default: html2canvas }) => {
      html2canvas(tableRef.current, {
        backgroundColor: darkMode ? '#07090E' : '#F8FAFC',
        scale: 2,
      }).then(canvas => {
        const link = document.createElement('a');
        link.download = `${state.tournament.name.replace(/\s+/g, '_')}_leaderboard.png`;
        link.href = canvas.toDataURL();
        link.click();
      });
    });
  }

  // Compare mode
  const compareData = useMemo(() => {
    if (!compareTeams[0] || !compareTeams[1]) return null;
    const a = standings.find(s => s.teamId === compareTeams[0]);
    const b = standings.find(s => s.teamId === compareTeams[1]);
    if (!a || !b) return null;
    return { a, b };
  }, [compareTeams, standings]);

  if (teams.length === 0) {
    return (
      <EmptyState
        icon="🏆"
        title="No teams yet"
        description="Add teams to get started with your tournament leaderboard."
        action={{ label: 'Go to Teams', onClick: () => dispatch({ type: 'SET_VIEW', payload: { view: 'teams' } }) }}
      />
    );
  }

  return (
    <div className="animate-slideUp">
      {/* Hero Tournament Name */}
      <div className="mb-8">
        <div className="flex items-center gap-4 md:gap-5">
          {state.tournament.logo && (
            <div className={`rounded-2xl overflow-hidden flex-shrink-0 ${darkMode ? 'ring-1 ring-white/[0.06]' : 'ring-1 ring-gray-200'}`}>
              <img
                src={state.tournament.logo}
                alt="Event Logo"
                className="h-20 w-20 md:h-24 md:w-24 object-contain"
              />
            </div>
          )}
          <div>
            <h1 className={`text-3xl md:text-4xl lg:text-[42px] font-extrabold tracking-tight leading-tight ${darkMode ? 'gradient-text' : 'text-gray-900'}`}>
              {state.tournament.name}
            </h1>
            <p className={`text-sm mt-1 font-medium uppercase tracking-widest ${darkMode ? 'text-text-tertiary' : 'text-gray-400'}`}>
              Master Leaderboard
            </p>
          </div>
        </div>
      </div>

      {/* Stat Cards — Crypto KPI style */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-8">
        {[
          { label: 'TEAMS', value: teams.length, icon: '👥', color: 'from-accent to-[#7C3AED]' },
          { label: 'GAMES', value: games.length, icon: '🎮', color: 'from-accent to-[#06B6D4]' },
          { label: 'ATHLETES', value: athletes.length, icon: '🏃', color: 'from-[#10B981] to-[#06B6D4]' },
          { label: 'POOL PLAYED', value: totalMatches, icon: '✔', color: 'from-[#F59E0B] to-[#EF4444]' },
          { label: 'KO PLAYED', value: totalKoMatches, icon: '⚔️', color: 'from-[#8B5CF6] to-[#EC4899]' },
        ].map((stat, i) => (
          <div
            key={stat.label}
            className={`relative overflow-hidden rounded-2xl p-4 md:p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl ${
              darkMode
                ? 'fintech-card hover:border-white/[0.1]'
                : 'fintech-card-light hover:shadow-lg'
            }`}
            style={{ animationDelay: `${i * 50}ms` }}
          >
            {/* Gradient accent line at top */}
            <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${stat.color}`} />
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{stat.icon}</span>
              <span className={`text-[11px] font-semibold uppercase tracking-wider ${darkMode ? 'text-text-tertiary' : 'text-gray-400'}`}>{stat.label}</span>
            </div>
            <div className="stat-number text-white">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Tournament Progress */}
      {gameProgress.length > 0 && (
        <div className={`rounded-2xl p-4 md:p-5 mb-6 ${
          darkMode
            ? 'fintech-card'
            : 'fintech-card-light'
        }`}>
          <h3 className={`text-[11px] font-semibold uppercase tracking-wider mb-3 ${darkMode ? 'text-text-tertiary' : 'text-gray-400'}`}>Tournament Progress</h3>
          <div className="flex flex-wrap gap-2">
            {gameProgress.map((gp) => {
              const { game, stage, champTeam, isIndividual, completedCats, totalCats } = gp;
              const stageColors = {
                pool: darkMode ? 'bg-white/[0.04] text-text-secondary border-white/[0.06]' : 'bg-gray-100 text-gray-600 border-gray-200',
                knockout: 'bg-accent/10 text-accent border-accent/20',
                completed: 'bg-win/10 text-win border-win/20',
              };
              const stageLabel = isIndividual
                ? (totalCats > 0 ? `${completedCats}/${totalCats}` : 'Individual')
                : (stage === 'pool' ? 'Pool' : stage === 'knockout' ? 'Knockout' : 'Completed');

              return (
                <button
                  key={game.id}
                  onClick={() => dispatch({ type: 'SELECT_GAME', payload: game.id })}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all hover:-translate-y-0.5 border ${isIndividual ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : stageColors[stage]}`}
                >
                  <span>{game.emoji}</span>
                  <span className="font-medium">{game.name}</span>
                  <span className="text-[10px] opacity-70 font-semibold uppercase">{stageLabel}</span>
                  {champTeam && (
                    <span className="flex items-center gap-1 text-xs">
                      🏆 <TeamLogo team={champTeam} size={16} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Points Explainer */}
      <PointsExplainer filterType="all" />

      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Standings</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Search teams..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`px-3 py-2 rounded-xl text-sm border transition-all ${
              darkMode
                ? 'bg-white/[0.04] border-white/[0.08] text-white placeholder-text-tertiary focus:border-accent/50 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]'
                : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-accent focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]'
            }`}
          />
          {/* Pill tabs */}
          <div className={`flex rounded-xl overflow-hidden border ${darkMode ? 'border-white/[0.08]' : 'border-gray-200'}`}>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-2 text-xs font-semibold transition-all ${viewMode === 'table' ? 'bg-accent text-white glow-accent' : darkMode ? 'bg-white/[0.04] text-text-secondary' : 'bg-white text-gray-600'}`}
            >
              Table
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`px-3 py-2 text-xs font-semibold transition-all ${viewMode === 'card' ? 'bg-accent text-white glow-accent' : darkMode ? 'bg-white/[0.04] text-text-secondary' : 'bg-white text-gray-600'}`}
            >
              Cards
            </button>
          </div>
          <button onClick={handleScreenshot} className={`px-3 py-2 text-xs font-semibold rounded-xl transition-all ${darkMode ? 'bg-white/[0.04] text-text-secondary hover:bg-white/[0.08] border border-white/[0.08]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'}`} title="Screenshot">
            📷
          </button>
          <button
            onClick={() => setShowCompare(!showCompare)}
            className={`px-3 py-2 text-xs font-semibold rounded-xl transition-all border ${showCompare ? 'bg-accent text-white glow-accent border-accent' : darkMode ? 'bg-white/[0.04] text-text-secondary hover:bg-white/[0.08] border-white/[0.08]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-gray-200'}`}
          >
            Compare
          </button>
        </div>
      </div>

      {/* Compare Panel */}
      {showCompare && (
        <div className={`rounded-2xl p-5 mb-4 animate-slideUp ${
          darkMode ? 'fintech-card' : 'fintech-card-light'
        }`}>
          <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
            <select
              value={compareTeams[0] || ''}
              onChange={e => setCompareTeams([e.target.value || null, compareTeams[1]])}
              className={`px-3 py-2.5 rounded-xl border text-sm flex-1 w-full sm:w-auto ${
                darkMode ? 'bg-navy-800 border-white/[0.08] text-white [&>option]:bg-navy-800 [&>option]:text-white' : 'bg-gray-50 border-gray-200'
              }`}
            >
              <option value="">Select Team A</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <span className="font-bold text-accent text-lg">VS</span>
            <select
              value={compareTeams[1] || ''}
              onChange={e => setCompareTeams([compareTeams[0], e.target.value || null])}
              className={`px-3 py-2.5 rounded-xl border text-sm flex-1 w-full sm:w-auto ${
                darkMode ? 'bg-navy-800 border-white/[0.08] text-white [&>option]:bg-navy-800 [&>option]:text-white' : 'bg-gray-50 border-gray-200'
              }`}
            >
              <option value="">Select Team B</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          {compareData && (
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              {['played', 'wins', 'losses', 'draws', 'byes', 'points'].map(key => (
                <div key={key} className="contents">
                  <div className={`py-2 font-mono font-bold text-lg ${compareData.a[key] > compareData.b[key] ? 'text-win' : compareData.a[key] < compareData.b[key] ? 'text-loss' : ''}`}>
                    {compareData.a[key]}
                  </div>
                  <div className={`py-2 font-semibold capitalize text-[11px] uppercase tracking-wider ${darkMode ? 'text-text-tertiary' : 'text-gray-400'}`}>{key}</div>
                  <div className={`py-2 font-mono font-bold text-lg ${compareData.b[key] > compareData.a[key] ? 'text-win' : compareData.b[key] < compareData.a[key] ? 'text-loss' : ''}`}>
                    {compareData.b[key]}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Leaderboard */}
      <div ref={tableRef}>
        {viewMode === 'table' ? (
          <div className={`overflow-x-auto rounded-2xl ${
            darkMode
              ? 'fintech-card'
              : 'fintech-card-light'
          }`}>
            <table className="w-full text-sm">
              <thead>
                <tr className={darkMode ? 'bg-white/[0.02]' : 'bg-gray-50'}>
                  <th className={`px-2 sm:px-3 py-3 sm:py-4 text-left text-[11px] font-semibold uppercase tracking-wider ${darkMode ? 'text-text-tertiary' : 'text-gray-400'}`}>#</th>
                  <th className={`px-2 sm:px-3 py-3 sm:py-4 text-left text-[11px] font-semibold uppercase tracking-wider ${darkMode ? 'text-text-tertiary' : 'text-gray-400'}`}>Team</th>
                  <th className={`px-1 sm:px-3 py-3 sm:py-4 text-center text-[11px] font-semibold uppercase tracking-wider ${darkMode ? 'text-text-tertiary' : 'text-gray-400'}`}>GP</th>
                  <th className="px-1 sm:px-3 py-3 sm:py-4 text-center text-[11px] font-semibold uppercase tracking-wider text-win">W</th>
                  <th className="px-1 sm:px-3 py-3 sm:py-4 text-center text-[11px] font-semibold uppercase tracking-wider text-loss">L</th>
                  <th className="px-1 sm:px-3 py-3 sm:py-4 text-center text-[11px] font-semibold uppercase tracking-wider text-draw">D</th>
                  <th className="px-1 sm:px-3 py-3 sm:py-4 text-center text-[11px] font-semibold uppercase tracking-wider text-bye">B</th>
                  <th className={`px-1 sm:px-3 py-3 sm:py-4 text-center text-[11px] font-semibold uppercase tracking-wider ${darkMode ? 'text-text-tertiary' : 'text-gray-400'}`}>PTS</th>
                  <th className={`px-3 py-4 text-left text-[11px] font-semibold uppercase tracking-wider hidden md:table-cell ${darkMode ? 'text-text-tertiary' : 'text-gray-400'}`}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => {
                  const rank = i + 1;
                  return (
                    <tr key={row.teamId} className={`border-b transition-all duration-200 ${darkMode ? 'border-white/[0.04]' : 'border-gray-100'} ${getRowBg(rank)} ${getRowLeftBorder(rank)}`}>
                      <td className="px-2 sm:px-3 py-2.5 sm:py-3">{getRankBadge(rank)}</td>
                      <td className="px-2 sm:px-3 py-2.5 sm:py-3">
                        <div className="flex items-center gap-2 sm:gap-2.5">
                          <TeamLogo team={row.team} size={24} className="sm:!w-9 sm:!h-9" />
                          <div className="min-w-0 max-w-[140px] sm:max-w-[220px] md:max-w-xs">
                            <div className="flex items-center gap-1">
                              <span className="font-semibold truncate text-xs sm:text-sm hidden sm:inline">{row.teamName}</span>
                              <span className="font-semibold truncate text-xs sm:hidden">{row.team.shortCode || row.teamName}</span>
                              {row.championOf.map(g => (
                                <span key={g.id} className="text-xs" title={`${g.name} Champion`}>🏆</span>
                              ))}
                            </div>
                            <div className={`text-[10px] sm:text-xs hidden sm:block ${darkMode ? 'text-text-tertiary' : 'text-gray-400'}`}>{row.team.shortCode}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-1 sm:px-3 py-2.5 sm:py-3 text-center font-mono text-xs sm:text-sm">{row.played}</td>
                      <td className="px-1 sm:px-3 py-2.5 sm:py-3 text-center">
                        <PointsBreakdownPopover
                          teamId={row.teamId}
                          type="wins"
                          value={row.wins}
                          className="font-mono font-bold text-win text-xs sm:text-sm"
                        />
                      </td>
                      <td className="px-1 sm:px-3 py-2.5 sm:py-3 text-center">
                        <PointsBreakdownPopover
                          teamId={row.teamId}
                          type="losses"
                          value={row.losses}
                          className="font-mono font-bold text-loss text-xs sm:text-sm"
                        />
                      </td>
                      <td className="px-1 sm:px-3 py-2.5 sm:py-3 text-center">
                        <PointsBreakdownPopover
                          teamId={row.teamId}
                          type="draws"
                          value={row.draws}
                          className="font-mono font-bold text-draw text-xs sm:text-sm"
                        />
                      </td>
                      <td className="px-1 sm:px-3 py-2.5 sm:py-3 text-center">
                        <PointsBreakdownPopover
                          teamId={row.teamId}
                          type="byes"
                          value={row.byes}
                          className="font-mono font-bold text-bye text-xs sm:text-sm"
                        />
                      </td>
                      <td className="px-1 sm:px-3 py-2.5 sm:py-3 text-center">
                        <PointsBreakdownPopover
                          teamId={row.teamId}
                          type="total"
                          value={row.points}
                          className="font-mono font-black text-sm sm:text-lg"
                        >
                          <span className={`font-mono font-black text-sm sm:text-lg ${darkMode ? 'text-accent-bright' : 'text-accent-dark'}`}>{row.points}</span>
                        </PointsBreakdownPopover>
                        <div className="flex flex-wrap justify-center gap-x-1">
                          {row.knockoutPoints > 0 && (
                            <PointsBreakdownPopover
                              teamId={row.teamId}
                              type="knockout"
                              value={row.knockoutPoints}
                              className="text-[10px] text-accent"
                            >
                              <span className="text-[10px] text-accent">+{row.knockoutPoints} KO</span>
                            </PointsBreakdownPopover>
                          )}
                          {row.individualPoints > 0 && (
                            <PointsBreakdownPopover
                              teamId={row.teamId}
                              type="pool"
                              value={row.individualPoints}
                              className="text-[10px] text-purple-400"
                            >
                              <span className="text-[10px] text-purple-400">+{row.individualPoints} Ind</span>
                            </PointsBreakdownPopover>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell">
                        <div className="flex gap-1 flex-wrap items-center">
                          {row.gameAdvancements.length > 0 ? row.gameAdvancements.map(ga => (
                            <span key={ga.game.id} className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg font-semibold uppercase tracking-wider ${
                              ga.status === 'Champion' ? 'bg-gold/20 text-gold border border-gold/30' :
                              ga.status === 'Finalist' ? 'bg-silver/20 text-silver border border-silver/30' :
                              ga.status === '3rd Place' ? 'bg-bronze/20 text-bronze border border-bronze/30' :
                              ga.status === '4th Place' ? (darkMode ? 'bg-white/[0.04] text-text-secondary border border-white/[0.06]' : 'bg-gray-100 text-gray-500 border border-gray-200') :
                              ga.status === 'Semi-Finalist' ? 'bg-accent/10 text-accent border border-accent/20' :
                              ga.status === 'Quarter-Finalist' ? (darkMode ? 'bg-white/[0.04] text-text-secondary border border-white/[0.06]' : 'bg-gray-100 text-gray-500 border border-gray-200') :
                              (darkMode ? 'bg-white/[0.04] text-text-secondary border border-white/[0.06]' : 'bg-gray-100 text-gray-500 border border-gray-200')
                            }`} title={`${ga.game.name}: ${ga.status}`}>
                              {ga.status} {ga.game.emoji}
                            </span>
                          )) : (
                            <>
                              {row.gameIds.map(gid => {
                                const game = games.find(g => g.id === gid);
                                return game ? (
                                  <span key={gid} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs ${darkMode ? 'bg-white/[0.04] text-text-secondary' : 'bg-gray-100 text-gray-600'}`}>
                                    {game.emoji}
                                  </span>
                                ) : null;
                              })}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <TableLegend type="master" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((row, i) => {
              const rank = i + 1;
              return (
                <div key={row.teamId} className={`rounded-2xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl ${getRowLeftBorder(rank)} ${
                  darkMode
                    ? 'fintech-card hover:border-white/[0.1]'
                    : 'fintech-card-light'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    {getRankBadge(rank)}
                    <div className="text-right">
                      <PointsBreakdownPopover
                        teamId={row.teamId}
                        type="total"
                        value={row.points}
                        className="font-mono font-black text-2xl text-accent"
                      >
                        <span className={`font-mono font-black text-2xl ${darkMode ? 'text-accent-bright' : 'text-accent-dark'}`}>{row.points}<span className="text-[11px] font-medium text-text-tertiary ml-1 uppercase">pts</span></span>
                      </PointsBreakdownPopover>
                      {row.knockoutPoints > 0 && (
                        <PointsBreakdownPopover
                          teamId={row.teamId}
                          type="knockout"
                          value={row.knockoutPoints}
                          className="text-[10px] text-accent block"
                        >
                          <span className="text-[10px] text-accent">+{row.knockoutPoints} KO</span>
                        </PointsBreakdownPopover>
                      )}
                      {row.individualPoints > 0 && (
                        <PointsBreakdownPopover
                          teamId={row.teamId}
                          type="pool"
                          value={row.individualPoints}
                          className="text-[10px] text-purple-400 block"
                        >
                          <span className="text-[10px] text-purple-400">+{row.individualPoints} Ind</span>
                        </PointsBreakdownPopover>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mb-4">
                    <TeamLogo team={row.team} size={48} />
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="font-bold">{row.teamName}</span>
                        {row.championOf.map(g => (
                          <span key={g.id} className="text-sm" title={`${g.name} Champion`}>🏆</span>
                        ))}
                      </div>
                      <div className={`text-xs ${darkMode ? 'text-text-tertiary' : 'text-gray-400'}`}>{row.team.shortCode}</div>
                      <div className="flex gap-1 flex-wrap mt-1">
                        {row.gameAdvancements.map(ga => (
                          <span key={ga.game.id} className={`inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-md font-semibold uppercase tracking-wider ${
                            ga.status === 'Champion' ? 'bg-gold/20 text-gold border border-gold/30' :
                            ga.status === 'Finalist' ? 'bg-silver/20 text-silver border border-silver/30' :
                            ga.status === '3rd Place' ? 'bg-bronze/20 text-bronze border border-bronze/30' :
                            (darkMode ? 'bg-white/[0.04] text-text-secondary border border-white/[0.06]' : 'bg-gray-100 text-gray-500 border border-gray-200')
                          }`} title={`${ga.game.name}: ${ga.status}`}>
                            {ga.status} {ga.game.emoji}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-5 gap-1 text-center text-xs">
                    {[
                      { label: 'GP', value: row.played, type: null },
                      { label: 'W', value: row.wins, cls: 'text-win', type: 'wins' },
                      { label: 'L', value: row.losses, cls: 'text-loss', type: 'losses' },
                      { label: 'D', value: row.draws, cls: 'text-draw', type: 'draws' },
                      { label: 'B', value: row.byes, cls: 'text-bye', type: 'byes' },
                    ].map(s => (
                      <div key={s.label}>
                        {s.type ? (
                          <PointsBreakdownPopover
                            teamId={row.teamId}
                            type={s.type}
                            value={s.value}
                            className={`font-mono font-bold text-sm ${s.cls || ''}`}
                          />
                        ) : (
                          <div className="font-mono font-bold text-sm">{s.value}</div>
                        )}
                        <div className={`text-[10px] uppercase tracking-wider font-medium ${darkMode ? 'text-text-tertiary' : 'text-gray-400'}`}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1 flex-wrap mt-3">
                    {row.gameIds.map(gid => {
                      const game = games.find(g => g.id === gid);
                      return game ? (
                        <span key={gid} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs ${darkMode ? 'bg-white/[0.04] text-text-secondary' : 'bg-gray-100 text-gray-500'}`}>
                          {game.emoji}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Results */}
      {recentResults.length > 0 && (
        <div className="mt-8">
          <h3 className={`text-[11px] font-semibold uppercase tracking-wider mb-3 ${darkMode ? 'text-text-tertiary' : 'text-gray-400'}`}>Recent Results</h3>
          <div className="space-y-2">
            {recentResults.map(m => {
              const resultStripe = m.result === 'draw' ? 'border-l-draw' :
                m.result === 'bye' ? 'border-l-bye' :
                m.isKnockout ? 'border-l-accent' : 'border-l-win';

              return (
                <div key={m.id} className={`rounded-xl p-3 flex items-center gap-3 border-l-[3px] ${resultStripe} transition-all duration-200 hover:-translate-y-0.5 ${
                  darkMode
                    ? 'fintech-card border-l-[3px]'
                    : 'fintech-card-light border-l-[3px]'
                }`}>
                  {m.game && <span className="text-lg">{m.game.emoji}</span>}
                  {m.isKnockout && <span className="text-[10px] px-2 py-0.5 rounded-lg bg-accent/10 text-accent font-semibold uppercase tracking-wider border border-accent/20">KO</span>}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <TeamLogo team={m.teamA} size={24} />
                    <span className={`text-sm font-medium truncate ${m.result === 'teamA' ? 'text-win font-bold' : m.result === 'bye' && m.absentTeamId === m.teamAId ? 'text-text-tertiary line-through' : ''}`}>
                      {m.teamA?.shortCode || '?'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold uppercase ${
                      m.result === 'draw' ? 'bg-draw/15 text-draw border border-draw/30' :
                      m.result === 'bye' ? 'bg-bye/15 text-bye border border-bye/30' :
                      darkMode ? 'bg-white/[0.04] text-text-secondary' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {m.result === 'draw' ? 'DRAW' : m.result === 'bye' ? 'BYE' : 'vs'}
                    </span>
                    <span className={`text-sm font-medium truncate ${m.result === 'teamB' ? 'text-win font-bold' : m.result === 'bye' && m.absentTeamId === m.teamBId ? 'text-text-tertiary line-through' : ''}`}>
                      {m.teamB?.shortCode || '?'}
                    </span>
                    <TeamLogo team={m.teamB} size={24} />
                  </div>
                  {m.pool && (
                    <span className={`text-xs ${darkMode ? 'text-text-tertiary' : 'text-gray-400'}`}>{m.pool.name}</span>
                  )}
                  {m.isKnockout && m.round && (
                    <span className={`text-xs font-medium ${darkMode ? 'text-text-tertiary' : 'text-gray-400'}`}>
                      {m.round === 'qf' ? 'QF' : m.round === 'sf' ? 'SF' : m.round === 'final' ? 'Final' : m.round === 'third' ? '3rd' : m.round.toUpperCase()}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
