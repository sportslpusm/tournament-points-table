// Points System:
// Participation = 1pt (both teams, if not bye-absent)
// Win = 3pts (+ 1 participation = 4 total)
// Loss = 0pts (+ 1 participation = 1 total)
// Draw = 1pt each (+ 1 participation = 2 total each)
// Bye = 2pts to present team, 0pts to absent team (no participation for absent)

export function getMatchPoints(match, teamId) {
  if (match.status !== 'completed') return 0;

  if (match.result === 'bye') {
    if (match.absentTeamId === teamId) return 0;
    // Present team
    return 2;
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
        // Present: gets 2 points
        byes += 1;
        played += 1;
        points += 2;
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

export function getHeadToHead(matches, teamAId, teamBId) {
  let aWins = 0, bWins = 0;
  for (const m of matches) {
    if (m.status !== 'completed') continue;
    const involves = (m.teamAId === teamAId && m.teamBId === teamBId) ||
                     (m.teamAId === teamBId && m.teamBId === teamAId);
    if (!involves) continue;

    if (m.result === 'teamA') {
      if (m.teamAId === teamAId) aWins++;
      else bWins++;
    } else if (m.result === 'teamB') {
      if (m.teamBId === teamAId) aWins++;
      else bWins++;
    }
  }
  return { aWins, bWins };
}

export function sortTeamsByTiebreaker(teamStats, allMatches) {
  return [...teamStats].sort((a, b) => {
    // 1. Points descending
    if (b.points !== a.points) return b.points - a.points;
    // 2. Most wins
    if (b.wins !== a.wins) return b.wins - a.wins;
    // 3. Head-to-head
    const h2h = getHeadToHead(allMatches, a.teamId, b.teamId);
    if (h2h.aWins !== h2h.bWins) return h2h.bWins - h2h.aWins; // b has more h2h wins = b ranks higher
    // 4. Alphabetical
    return a.teamName.localeCompare(b.teamName);
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
        koPoints += 2;
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

      // Bonus points
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
