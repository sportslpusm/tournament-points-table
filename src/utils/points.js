// ═══════════════════════════════════════════════════════════════
// TOURNAMENT SCORING RULES — Single Source of Truth
// ═══════════════════════════════════════════════════════════════
//
// TEAM GAME SCORING (Cricket, Badminton, Kabaddi, Football, ESports-BGMI):
//   Win (contested):     3 base + 1 participation = 4 pts
//   Loss (contested):    0 base + 1 participation = 1 pt
//   Draw:                1 base + 1 participation = 2 pts
//   Bye / Walkover win:  4 pts (equal to a contested win — structural fairness)
//   No-show/Forfeit:     0 pts (absent team)
//
// KNOCKOUT BONUS (only for contested wins, NOT walkovers):
//   QF Win: +1 | SF Win: +2 | Final Win: +3 | 3rd Place Win: +1
//
// MASTER TIEBREAKER (for overall leaderboard):
//   1. Total Overall Points (descending)
//   2. Most Total Tournament Wins (team game wins + individual 1st places) (descending)
//   3. Most 2nd Place / Runner-Up finishes (descending)
//   4. Most 3rd Place finishes (descending)
//   NEVER Head-to-Head. NEVER Alphabetical.
// ═══════════════════════════════════════════════════════════════

/** Safely coerce a value to a non-negative finite number. Returns 0 on NaN/null/undefined/negative. */
export function safeNum(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return 0;
  return v;
}

/**
 * Compute dense ranks for a pre-sorted array.
 * Ties get the same rank; next distinct value gets rank+1 (dense, no gaps).
 * @param {Array} sorted - Pre-sorted array (best first)
 * @param {Function} isTied - (a, b) => boolean — true if a and b should share a rank
 * @returns {number[]} - Array of rank numbers aligned with input indices
 */
export function denseRank(sorted, isTied) {
  if (sorted.length === 0) return [];
  const ranks = [1];
  let currentRank = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (!isTied(sorted[i - 1], sorted[i])) currentRank++;
    ranks.push(currentRank);
  }
  return ranks;
}

export function getMatchPoints(match, teamId) {
  if (match.status !== 'completed') return 0;

  // Bye / Walkover — present team gets 4 pts (equal to a win)
  if (match.result === 'bye') {
    if (match.absentTeamId === teamId) return 0;
    return 4;
  }

  // Participation point
  let points = 1;

  if (match.result === 'draw') {
    points += 1; // draw bonus
  } else if (match.result === 'teamA' && match.teamAId === teamId) {
    points += 3; // win bonus
  } else if (match.result === 'teamB' && match.teamBId === teamId) {
    points += 3; // win bonus
  }
  // Loss: only participation (already 1)

  return points;
}

export function getTeamStatsForMatches(matches, teamId) {
  let played = 0, wins = 0, losses = 0, draws = 0, byes = 0, points = 0;

  for (const m of matches) {
    if (m.status !== 'completed') continue;
    if (m.teamAId !== teamId && m.teamBId !== teamId) continue;

    if (m.result === 'bye') {
      if (m.absentTeamId === teamId) {
        // Absent: no points, no played, but count as bye
        byes += 1;
      } else {
        // Present: gets 4 points (equal to a win)
        byes += 1;
        played += 1;
        wins += 1;
        points += 4;
      }
      continue;
    }

    played += 1;

    if (m.result === 'draw') {
      draws += 1;
      points += 2; // 1 participation + 1 draw
    } else {
      const isWinner =
        (m.result === 'teamA' && m.teamAId === teamId) ||
        (m.result === 'teamB' && m.teamBId === teamId);
      if (isWinner) {
        wins += 1;
        points += 4; // 1 participation + 3 win
      } else {
        losses += 1;
        points += 1; // 1 participation only
      }
    }
  }

  return { played, wins, losses, draws, byes, points };
}

/**
 * Master tiebreaker for the overall tournament leaderboard.
 *
 * Each team stat object must include:
 *   - points: total tournament points
 *   - wins: total team game wins (including bye/walkover wins)
 *   - golds: total individual 1st-place finishes
 *   - silvers: total individual 2nd-place finishes
 *   - bronzes: total individual 3rd-place finishes
 *
 * Hierarchy:
 *   1. Total Overall Points (desc)
 *   2. Total Tournament Wins = team wins + individual golds (desc)
 *   3. Most 2nd Place / Runner-Up finishes (desc)
 *   4. Most 3rd Place finishes (desc)
 *   NEVER Head-to-Head. NEVER Alphabetical.
 */
export function sortTeamsByTiebreaker(teamStats) {
  return [...teamStats].sort((a, b) => {
    // 1. Total Overall Points (descending)
    if (b.points !== a.points) return b.points - a.points;

    // 2. Most Total Tournament Wins (team game wins + individual golds)
    const aTotalWins = (a.wins || 0) + (a.golds || 0);
    const bTotalWins = (b.wins || 0) + (b.golds || 0);
    if (bTotalWins !== aTotalWins) return bTotalWins - aTotalWins;

    // 3. Most 2nd Place / Runner-Up finishes (descending)
    const aSilvers = a.silvers || 0;
    const bSilvers = b.silvers || 0;
    if (bSilvers !== aSilvers) return bSilvers - aSilvers;

    // 4. Most 3rd Place finishes (descending)
    const aBronzes = a.bronzes || 0;
    const bBronzes = b.bronzes || 0;
    if (bBronzes !== aBronzes) return bBronzes - aBronzes;

    // Tie remains — manual resolution (coin toss / playoff)
    return 0;
  });
}

// Combined stats: pool matches + knockout matches with bonus
export function getTeamCombinedStats(poolMatches, knockoutMatches, teamId, bonusConfig) {
  const poolStats = getTeamStatsForMatches(poolMatches, teamId);

  // Knockout stats
  let koPlayed = 0, koWins = 0, koLosses = 0, koByes = 0, koPoints = 0;

  for (const m of knockoutMatches) {
    if (m.teamAId !== teamId && m.teamBId !== teamId) continue;
    if (m.status !== 'completed') continue;

    if (m.result === 'bye') {
      koByes++;
      if (m.absentTeamId !== teamId) {
        koPlayed++;
        koWins++;
        koPoints += 4; // Bye = Win = 4 pts
        // NO knockout bonus for walkovers/byes
      }
      continue;
    }

    koPlayed++;
    koPoints += 1; // participation

    const isWinner =
      (m.result === 'teamA' && m.teamAId === teamId) ||
      (m.result === 'teamB' && m.teamBId === teamId);

    if (isWinner) {
      koWins++;
      koPoints += 3;

      // Knockout bonus — ONLY for contested wins
      if (bonusConfig?.enabled) {
        if (m.round === 'qf') koPoints += bonusConfig.qf || 0;
        else if (m.round === 'sf') koPoints += bonusConfig.sf || 0;
        else if (m.round === 'final') koPoints += bonusConfig.final || 0;
        else if (m.round === 'third') koPoints += bonusConfig.third || 0;
      }
    } else {
      koLosses++;
    }
  }

  return {
    played: poolStats.played + koPlayed,
    wins: poolStats.wins + koWins,
    losses: poolStats.losses + koLosses,
    draws: poolStats.draws,
    byes: poolStats.byes + koByes,
    points: poolStats.points + koPoints,
    poolPoints: poolStats.points,
    knockoutPoints: koPoints,
  };
}
