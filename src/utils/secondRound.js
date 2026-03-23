// ═══════════════════════════════════════════════════════════════
// SECOND ROUND LOGIC
// ═══════════════════════════════════════════════════════════════
//
// Second Round is an intermediate stage between Pool Stage and Knockout.
// - All pool-topping teams (rank 1 from each pool) qualify
// - They are placed in a single pool and play round-robin
// - Ranking criteria: 1. Total Points  2. Goals Scored  3. Goal Difference
// - Top 3 → Semifinals
// - Bottom 2 → Knockout Match (play-in), winner gets 4th SF spot
// ═══════════════════════════════════════════════════════════════

import { getTeamStatsForMatches } from './points';

/**
 * Get pool-topping teams (rank 1 from each pool) for second round.
 * Uses the existing qualifier logic but always picks top 1.
 */
export function getSecondRoundQualifiers(pools, matches, teams) {
  const qualifiers = [];

  for (const pool of pools) {
    // Skip second round pools
    if (pool.isSecondRound) continue;

    const poolMatches = matches.filter(m => m.poolId === pool.id);
    const poolTeams = pool.teamIds
      .map(tid => teams.find(t => t.id === tid))
      .filter(Boolean);

    const teamStats = poolTeams.map(team => {
      const stats = getTeamStatsForMatches(poolMatches, team.id);
      return { teamId: team.id, teamName: team.name, team, ...stats };
    });

    // Sort by points descending, then wins, then alphabetical as fallback
    const sorted = [...teamStats].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return 0;
    });

    // Take rank 1 (pool topper)
    if (sorted.length > 0) {
      qualifiers.push({
        teamId: sorted[0].teamId,
        poolId: pool.id,
        rank: 1,
        manual: false,
      });
    }
  }

  return qualifiers;
}

/**
 * Generate round-robin matches for the second round pool.
 * Every team plays every other team exactly once.
 */
export function generateSecondRoundMatches(teamIds, poolId, gameId, genIdFn) {
  const matches = [];
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      matches.push({
        id: genIdFn('sr'),
        poolId,
        gameId,
        teamAId: teamIds[i],
        teamBId: teamIds[j],
        status: 'upcoming',
        result: null,
        absentTeamId: null,
        scoreA: null,
        scoreB: null,
        isSecondRound: true,
      });
    }
  }
  return matches;
}

/**
 * Get team stats for second round including goals.
 * Returns stats with goalsFor, goalsAgainst, goalDifference for ranking.
 */
export function getSecondRoundTeamStats(matches, teamId) {
  let played = 0, wins = 0, losses = 0, draws = 0, points = 0;
  let goalsFor = 0, goalsAgainst = 0;

  for (const m of matches) {
    if (m.status !== 'completed') continue;
    if (m.teamAId !== teamId && m.teamBId !== teamId) continue;

    played += 1;
    const isTeamA = m.teamAId === teamId;
    const myScore = isTeamA ? (m.scoreA || 0) : (m.scoreB || 0);
    const oppScore = isTeamA ? (m.scoreB || 0) : (m.scoreA || 0);

    goalsFor += myScore;
    goalsAgainst += oppScore;

    if (m.result === 'bye') {
      if (m.absentTeamId === teamId) {
        points += 0;
        losses += 1;
      } else {
        points += 3;
        wins += 1;
      }
    } else if (m.result === 'draw') {
      draws += 1;
      points += 1;
    } else {
      const isWinner =
        (m.result === 'teamA' && m.teamAId === teamId) ||
        (m.result === 'teamB' && m.teamBId === teamId);
      if (isWinner) {
        wins += 1;
        points += 3;
      } else {
        losses += 1;
        points += 0;
      }
    }
  }

  return {
    played,
    wins,
    losses,
    draws,
    points,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
  };
}

/**
 * Sort second round teams by:
 * 1. Total Points (descending)
 * 2. Goal Difference (descending)
 * 3. Goals Scored (descending)
 */
export function sortSecondRoundTeams(teamStats) {
  return [...teamStats].sort((a, b) => {
    // 1. Total Points
    if (b.points !== a.points) return b.points - a.points;
    // 2. Goal Difference
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    // 3. Goals Scored
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return 0;
  });
}

/**
 * Determine second round results:
 * - Top 3 → Semifinals
 * - Bottom 2 → Play-in knockout match
 * Returns { semiFinalTeams: [top3], playInTeams: [bottom2] }
 */
export function getSecondRoundResults(sortedStandings) {
  if (sortedStandings.length < 5) {
    // If fewer than 5 teams, top 3 go to SF, rest play-in (or all go to SF if <= 4)
    if (sortedStandings.length <= 4) {
      return {
        semiFinalTeams: sortedStandings.map(s => s.teamId),
        playInTeams: [],
      };
    }
  }

  return {
    semiFinalTeams: sortedStandings.slice(0, 3).map(s => s.teamId),
    playInTeams: sortedStandings.slice(3, 5).map(s => s.teamId),
  };
}

/**
 * Generate knockout bracket for post-second-round:
 * - 4 teams in SF (3 from second round + play-in winner)
 * - SF → 3rd Place Match + Final
 */
export function generatePostSecondRoundBracket(sfTeamIds, gameId, genIdFn) {
  const matches = [];
  let matchNumber = 1;

  // SF Match 1: Team 1 vs Team 4 (top seed vs play-in winner/lowest seed)
  const sf1 = {
    id: genIdFn('km'),
    gameId,
    round: 'sf',
    matchNumber: matchNumber++,
    teamAId: sfTeamIds[0] || null,
    teamBId: sfTeamIds[3] || null,
    status: 'upcoming',
    result: null,
    absentTeamId: null,
    extraTime: false,
    penalties: false,
    nextMatchId: null,
    slot: null,
  };
  matches.push(sf1);

  // SF Match 2: Team 2 vs Team 3
  const sf2 = {
    id: genIdFn('km'),
    gameId,
    round: 'sf',
    matchNumber: matchNumber++,
    teamAId: sfTeamIds[1] || null,
    teamBId: sfTeamIds[2] || null,
    status: 'upcoming',
    result: null,
    absentTeamId: null,
    extraTime: false,
    penalties: false,
    nextMatchId: null,
    slot: null,
  };
  matches.push(sf2);

  // Final
  const finalMatch = {
    id: genIdFn('km'),
    gameId,
    round: 'final',
    matchNumber: matchNumber++,
    teamAId: null,
    teamBId: null,
    status: 'upcoming',
    result: null,
    absentTeamId: null,
    extraTime: false,
    penalties: false,
    nextMatchId: null,
    slot: null,
  };
  matches.push(finalMatch);

  // Link SF to Final
  sf1.nextMatchId = finalMatch.id;
  sf1.slot = 'teamA';
  sf2.nextMatchId = finalMatch.id;
  sf2.slot = 'teamB';

  // 3rd Place Match
  const thirdMatch = {
    id: genIdFn('km'),
    gameId,
    round: 'third',
    matchNumber: matchNumber++,
    teamAId: null,
    teamBId: null,
    status: 'upcoming',
    result: null,
    absentTeamId: null,
    extraTime: false,
    penalties: false,
    nextMatchId: null,
    slot: null,
    _sfMatchIds: [sf1.id, sf2.id],
  };
  matches.push(thirdMatch);

  return matches;
}

/**
 * Generate the play-in knockout match (bottom 2 teams).
 * This is stored as a knockout match with round 'playIn'.
 */
export function generatePlayInMatch(team4Id, team5Id, gameId, genIdFn) {
  return {
    id: genIdFn('km'),
    gameId,
    round: 'playIn',
    matchNumber: 0,
    teamAId: team4Id,
    teamBId: team5Id,
    status: 'upcoming',
    result: null,
    absentTeamId: null,
    extraTime: false,
    penalties: false,
    nextMatchId: null,
    slot: null,
  };
}
