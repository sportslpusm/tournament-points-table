/**
 * Utility functions to compute detailed points breakdowns for every team.
 * All breakdowns are calculated from actual match/result data — never stored separately.
 */

import { DEFAULT_INDIVIDUAL_POINTS, resolvePointsConfig } from './individualPoints';
import { DEFAULT_LOBBY_POINTS } from './lobbyPoints';

/**
 * Get the full breakdown of a team's total points across all games.
 * Returns an object with per-game sections, each listing every match/result.
 */
export function getTeamFullBreakdown(teamId, state) {
  const { teams, games, pools, matches, knockoutConfig, knockoutMatches, athletes, individualResults, individualPointsConfig, categories } = state;
  const team = teams.find(t => t.id === teamId);
  if (!team) return null;

  const sections = [];
  let grandTotal = 0;

  // Team games (games without a type default to 'team')
  const teamGames = games.filter(g => !g.type || g.type === 'team');
  for (const game of teamGames) {
    const gamePools = pools.filter(p => p.gameId === game.id);
    const teamInGame = gamePools.some(p => p.teamIds.includes(teamId));
    const gameKoMatches = knockoutMatches.filter(m => m.gameId === game.id && (m.teamAId === teamId || m.teamBId === teamId));

    if (!teamInGame && gameKoMatches.length === 0) continue;

    // Pool stage
    const poolSection = getTeamGamePoolBreakdown(teamId, game, gamePools, matches, teams);

    // Knockout stage
    const koSection = getTeamGameKnockoutBreakdown(teamId, game, knockoutMatches, knockoutConfig, teams);

    const gameTotal = poolSection.subtotal + koSection.subtotal;
    grandTotal += gameTotal;

    sections.push({
      type: 'team',
      game,
      pool: poolSection,
      knockout: koSection,
      gameTotal,
    });
  }

  // Individual games
  const indGames = games.filter(g => g.type === 'individual');
  for (const game of indGames) {
    const section = getTeamIndividualGameBreakdown(teamId, game, athletes, individualResults, individualPointsConfig, categories, teams);
    if (!section || (section.categories.length === 0 && section.subtotal === 0)) continue;
    grandTotal += section.subtotal;
    sections.push({
      type: 'individual',
      game,
      individual: section,
      gameTotal: section.subtotal,
    });
  }

  // Lobby games
  const lobbyGames = games.filter(g => g.type === 'lobby');
  const lobbyEntries = Array.isArray(state.lobbyEntries) ? state.lobbyEntries : [];
  const lobbyResults = Array.isArray(state.lobbyResults) ? state.lobbyResults : [];
  const lobbyPointsConfig = state.lobbyPointsConfig || {};

  for (const game of lobbyGames) {
    const section = getTeamLobbyGameBreakdown(teamId, game, lobbyEntries, lobbyResults, lobbyPointsConfig, teams);
    if (!section || (section.sessions.length === 0 && section.subtotal === 0)) continue;
    grandTotal += section.subtotal;
    sections.push({
      type: 'lobby',
      game,
      lobby: section,
      gameTotal: section.subtotal,
    });
  }

  return { team, sections, grandTotal };
}

/**
 * Pool stage breakdown for a team in a specific team game.
 */
export function getTeamGamePoolBreakdown(teamId, game, gamePools, allMatches, teams) {
  const matchDetails = [];
  let subtotal = 0;

  for (const pool of gamePools) {
    if (!pool.teamIds.includes(teamId)) continue;
    const poolMatches = allMatches.filter(m => m.poolId === pool.id && (m.teamAId === teamId || m.teamBId === teamId) && m.status === 'completed');

    for (const m of poolMatches) {
      const opponentId = m.teamAId === teamId ? m.teamBId : m.teamAId;
      const opponent = teams.find(t => t.id === opponentId);
      const detail = getMatchDetail(m, teamId, opponent);
      detail.poolName = pool.name;
      matchDetails.push(detail);
      subtotal += detail.totalPoints;
    }
  }

  return { matchDetails, subtotal, hasData: matchDetails.length > 0 };
}

/**
 * Knockout stage breakdown for a team in a specific team game.
 */
export function getTeamGameKnockoutBreakdown(teamId, game, allKnockoutMatches, knockoutConfig, teams) {
  const gameKoMatches = allKnockoutMatches.filter(m => m.gameId === game.id && (m.teamAId === teamId || m.teamBId === teamId) && m.status === 'completed');
  const config = knockoutConfig[game.id];
  const bonus = config?.bonusPoints;
  const stage = config?.stage || 'pool';
  const matchDetails = [];
  let subtotal = 0;

  for (const m of gameKoMatches) {
    const opponentId = m.teamAId === teamId ? m.teamBId : m.teamAId;
    const opponent = teams.find(t => t.id === opponentId);
    const detail = getMatchDetail(m, teamId, opponent);

    // Add knockout bonus
    detail.round = m.round;
    detail.roundLabel = getRoundLabel(m.round);
    detail.bonusPoints = 0;

    // Knockout bonus — ONLY for contested wins (not byes/walkovers)
    if (detail.isWin && !detail.isBye && bonus?.enabled) {
      const b = m.round === 'qf' ? (bonus.qf || 0) :
                m.round === 'sf' ? (bonus.sf || 0) :
                m.round === 'final' ? (bonus.final || 0) :
                m.round === 'third' ? (bonus.third || 0) : 0;
      detail.bonusPoints = b;
      detail.totalPoints += b;
    }

    matchDetails.push(detail);
    subtotal += detail.totalPoints;
  }

  return { matchDetails, subtotal, hasData: matchDetails.length > 0, stage };
}

/**
 * Individual game breakdown for a team — per category, per athlete.
 */
export function getTeamIndividualGameBreakdown(teamId, game, allAthletes, allResults, allPointsConfig, allCategories, teams) {
  const gameAthletes = allAthletes.filter(a => a.gameId === game.id && a.teamId === teamId);
  if (gameAthletes.length === 0) return { categories: [], subtotal: 0 };

  const gameCategories = allCategories.filter(c => c.gameId === game.id);
  const gameResults = allResults.filter(r => r.gameId === game.id);

  const categoryBreakdowns = [];
  let subtotal = 0;

  for (const cat of gameCategories) {
    const result = gameResults.find(r => r.categoryId === cat.id);
    if (!result) continue;

    // Use category-specific config if available
    const config = resolvePointsConfig(allPointsConfig, game.id, cat.id);

    const athleteDetails = [];
    const absentSet = new Set(result.absentees || []);
    const placedIds = new Set([result.placements?.first, result.placements?.second, result.placements?.third].filter(Boolean));

    for (const athlete of gameAthletes) {
      // Check if athlete is in this category
      const isPlaced = placedIds.has(athlete.id);
      const isParticipant = (result.participants || []).includes(athlete.id);
      const isAbsent = absentSet.has(athlete.id);

      if (!isPlaced && !isParticipant) continue;
      if (isAbsent) continue;

      let placement = 'participant';
      let placementBonus = 0;
      let participationPts = config.participation;

      if (result.placements?.first === athlete.id) {
        placement = 'first';
        placementBonus = config.first;
      } else if (result.placements?.second === athlete.id) {
        placement = 'second';
        placementBonus = config.second;
      } else if (result.placements?.third === athlete.id) {
        placement = 'third';
        placementBonus = config.third;
      }

      const total = participationPts + placementBonus;
      subtotal += total;

      athleteDetails.push({
        athlete,
        placement,
        placementBonus,
        participationPts,
        total,
      });
    }

    if (athleteDetails.length > 0) {
      // Sort: first > second > third > participant
      const placementOrder = { first: 0, second: 1, third: 2, participant: 3 };
      athleteDetails.sort((a, b) => placementOrder[a.placement] - placementOrder[b.placement]);

      categoryBreakdowns.push({
        category: cat,
        athletes: athleteDetails,
        categoryTotal: athleteDetails.reduce((sum, a) => sum + a.total, 0),
      });
    }
  }

  return { categories: categoryBreakdowns, subtotal };
}

/**
 * Lobby game breakdown for a team — per session, showing placements and participation.
 */
export function getTeamLobbyGameBreakdown(teamId, game, allLobbyEntries, allLobbyResults, allLobbyPointsConfig, teams) {
  const entries = Array.isArray(allLobbyEntries) ? allLobbyEntries : [];
  const results = Array.isArray(allLobbyResults) ? allLobbyResults : [];
  const config = allLobbyPointsConfig[game.id] || DEFAULT_LOBBY_POINTS;
  const cap = config.maxParticipationCap ?? Infinity;

  // Entry IDs belonging to this school
  const myEntryIds = new Set(
    entries.filter(e => e.gameId === game.id && e.teamId === teamId).map(e => e.id)
  );

  const gameResults = results.filter(r => r.gameId === game.id);
  const sessionDetails = [];
  let subtotal = 0;
  let golds = 0, silvers = 0, bronzes = 0;
  let participationCount = 0;

  for (const session of gameResults) {
    const participantEntryIds = session.participantEntryIds || [];
    const schoolParticipated = participantEntryIds.some(id => myEntryIds.has(id));
    if (!schoolParticipated) continue;

    const placements = session.placements || {};
    let sessionPts = 0;
    const medals = [];

    if (myEntryIds.has(placements.first)) {
      sessionPts += config.first;
      golds++;
      const entry = entries.find(e => e.id === placements.first);
      medals.push({ placement: 'first', entryName: entry?.entryName || '' });
    }
    if (myEntryIds.has(placements.second)) {
      sessionPts += config.second;
      silvers++;
      const entry = entries.find(e => e.id === placements.second);
      medals.push({ placement: 'second', entryName: entry?.entryName || '' });
    }
    if (myEntryIds.has(placements.third)) {
      sessionPts += config.third;
      bronzes++;
      const entry = entries.find(e => e.id === placements.third);
      medals.push({ placement: 'third', entryName: entry?.entryName || '' });
    }

    // Participation — one per ENTRY per session, capped per game
    let participationPts = 0;
    for (const entryId of participantEntryIds) {
      if (!myEntryIds.has(entryId)) continue;
      if (participationCount < cap) {
        participationPts += config.participation;
        participationCount++;
      }
    }
    sessionPts += participationPts;
    subtotal += sessionPts;

    sessionDetails.push({
      sessionName: session.sessionName,
      medals,
      participationPts,
      sessionTotal: sessionPts,
    });
  }

  return { sessions: sessionDetails, subtotal, golds, silvers, bronzes, config };
}

/**
 * Get match detail for a single match result.
 */
function getMatchDetail(match, teamId, opponent) {
  if (match.result === 'bye') {
    const isAbsent = match.absentTeamId === teamId;
    return {
      matchId: match.id,
      opponent,
      result: 'bye',
      isBye: true,
      isAbsent,
      isWin: !isAbsent,
      basePoints: isAbsent ? 0 : 4,
      participationPoints: 0,
      totalPoints: isAbsent ? 0 : 4,
      label: isAbsent ? 'Bye (Absent)' : 'Bye (Win)',
    };
  }

  const isWinner =
    (match.result === 'teamA' && match.teamAId === teamId) ||
    (match.result === 'teamB' && match.teamBId === teamId);
  const isDraw = match.result === 'draw';

  let basePoints = 0;
  let participationPoints = 1;
  let resultLabel = '';

  if (isWinner) {
    basePoints = 3;
    resultLabel = 'Won';
  } else if (isDraw) {
    basePoints = 1;
    resultLabel = 'Draw';
  } else {
    basePoints = 0;
    resultLabel = 'Lost';
  }

  return {
    matchId: match.id,
    opponent,
    result: isWinner ? 'win' : isDraw ? 'draw' : 'loss',
    isBye: false,
    isAbsent: false,
    isWin: isWinner,
    isDraw,
    basePoints,
    participationPoints,
    totalPoints: basePoints + participationPoints,
    label: resultLabel,
  };
}

/**
 * Get list of specific matches for a W/L/D/B stat.
 */
export function getSpecificMatchesForStat(teamId, statType, state) {
  const { teams, games, pools, matches, knockoutMatches } = state;
  const results = [];

  // Pool matches
  const teamPoolMatches = matches.filter(m => (m.teamAId === teamId || m.teamBId === teamId) && m.status === 'completed');
  for (const m of teamPoolMatches) {
    const opponentId = m.teamAId === teamId ? m.teamBId : m.teamAId;
    const opponent = teams.find(t => t.id === opponentId);
    const pool = pools.find(p => p.id === m.poolId);
    const game = pool ? games.find(g => g.id === pool.gameId) : null;
    const detail = getMatchDetail(m, teamId, opponent);

    if (matchesStat(detail, statType)) {
      results.push({ ...detail, game, isKnockout: false, poolName: pool?.name, round: null });
    }
  }

  // Knockout matches
  const teamKoMatches = knockoutMatches.filter(m => (m.teamAId === teamId || m.teamBId === teamId) && m.status === 'completed');
  for (const m of teamKoMatches) {
    const opponentId = m.teamAId === teamId ? m.teamBId : m.teamAId;
    const opponent = teams.find(t => t.id === opponentId);
    const game = games.find(g => g.id === m.gameId);
    const detail = getMatchDetail(m, teamId, opponent);
    detail.round = m.round;
    detail.roundLabel = getRoundLabel(m.round);

    if (matchesStat(detail, statType)) {
      results.push({ ...detail, game, isKnockout: true, poolName: null });
    }
  }

  return results;
}

function matchesStat(detail, statType) {
  switch (statType) {
    case 'wins': return detail.result === 'win';
    case 'losses': return detail.result === 'loss';
    case 'draws': return detail.isDraw;
    case 'byes': return detail.isBye;
    default: return false;
  }
}

/**
 * Get pool-only points breakdown for a team (across all team games + individual).
 */
export function getPoolPointsBreakdown(teamId, state) {
  const { games, pools, matches, athletes, individualResults, individualPointsConfig, categories, teams } = state;
  const sections = [];
  let total = 0;

  for (const game of games.filter(g => !g.type || g.type === 'team')) {
    const gamePools = pools.filter(p => p.gameId === game.id);
    const poolSection = getTeamGamePoolBreakdown(teamId, game, gamePools, matches, teams);
    if (poolSection.hasData) {
      sections.push({ game, ...poolSection });
      total += poolSection.subtotal;
    }
  }

  // Individual games count as "pool/stage" points
  for (const game of games.filter(g => g.type === 'individual')) {
    const section = getTeamIndividualGameBreakdown(teamId, game, athletes, individualResults, individualPointsConfig, categories, teams);
    if (section && section.subtotal > 0) {
      sections.push({ game, type: 'individual', ...section });
      total += section.subtotal;
    }
  }

  // Lobby games count as "stage" points
  const lobbyEntries = Array.isArray(state.lobbyEntries) ? state.lobbyEntries : [];
  const lobbyResults = Array.isArray(state.lobbyResults) ? state.lobbyResults : [];
  const lobbyPointsConfig = state.lobbyPointsConfig || {};
  for (const game of games.filter(g => g.type === 'lobby')) {
    const section = getTeamLobbyGameBreakdown(teamId, game, lobbyEntries, lobbyResults, lobbyPointsConfig, teams);
    if (section && section.subtotal > 0) {
      sections.push({ game, type: 'lobby', ...section });
      total += section.subtotal;
    }
  }

  return { sections, total };
}

/**
 * Get knockout-only points breakdown for a team (across all team games).
 */
export function getKnockoutPointsBreakdown(teamId, state) {
  const { games, knockoutMatches, knockoutConfig, teams } = state;
  const sections = [];
  let total = 0;

  for (const game of games.filter(g => !g.type || g.type === 'team')) {
    const koSection = getTeamGameKnockoutBreakdown(teamId, game, knockoutMatches, knockoutConfig, teams);
    sections.push({ game, ...koSection });
    total += koSection.subtotal;
  }

  return { sections, total };
}

/**
 * Get single-game points breakdown for a team.
 */
export function getGamePointsBreakdown(teamId, gameId, state) {
  const { games, pools, matches, knockoutMatches, knockoutConfig, athletes, individualResults, individualPointsConfig, categories, teams } = state;
  const game = games.find(g => g.id === gameId);
  if (!game) return null;

  if (game.type === 'individual') {
    const section = getTeamIndividualGameBreakdown(teamId, game, athletes, individualResults, individualPointsConfig, categories, teams);
    return { type: 'individual', game, ...section };
  }

  if (game.type === 'lobby') {
    const lobbyEntries = Array.isArray(state.lobbyEntries) ? state.lobbyEntries : [];
    const lobbyResults = Array.isArray(state.lobbyResults) ? state.lobbyResults : [];
    const lobbyPointsConfig = state.lobbyPointsConfig || {};
    const section = getTeamLobbyGameBreakdown(teamId, game, lobbyEntries, lobbyResults, lobbyPointsConfig, teams);
    return { type: 'lobby', game, ...section };
  }

  const gamePools = pools.filter(p => p.gameId === game.id);
  const poolSection = getTeamGamePoolBreakdown(teamId, game, gamePools, matches, teams);
  const koSection = getTeamGameKnockoutBreakdown(teamId, game, knockoutMatches, knockoutConfig, teams);

  return {
    type: 'team',
    game,
    pool: poolSection,
    knockout: koSection,
    total: poolSection.subtotal + koSection.subtotal,
  };
}

export function getRoundLabel(round) {
  const labels = {
    ro32: 'Round of 32',
    ro16: 'Round of 16',
    qf: 'Quarter Final',
    sf: 'Semi Final',
    final: 'Final',
    third: '3rd Place',
  };
  return labels[round] || round;
}

export function getPlacementEmoji(placement) {
  if (placement === 'first') return '\u{1F947}';
  if (placement === 'second') return '\u{1F948}';
  if (placement === 'third') return '\u{1F949}';
  return '';
}

export function getPlacementLabel(placement) {
  if (placement === 'first') return '1st';
  if (placement === 'second') return '2nd';
  if (placement === 'third') return '3rd';
  return 'Participated';
}
