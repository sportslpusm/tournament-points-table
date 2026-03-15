import { getTeamStatsForMatches, sortTeamsByTiebreaker } from './points';

// Round labels and ordering
export const ROUND_ORDER = ['ro32', 'ro16', 'qf', 'sf', 'third', 'final'];
export const ROUND_LABELS = {
  ro32: 'Round of 32',
  ro16: 'Round of 16',
  qf: 'Quarter Finals',
  sf: 'Semi Finals',
  third: '3rd Place Match',
  final: 'Final',
};

// Determine which round to start from based on number of qualified teams
export function getStartingRound(teamCount) {
  if (teamCount >= 32) return 'ro32';
  if (teamCount >= 16) return 'ro16';
  if (teamCount >= 8) return 'qf';
  if (teamCount >= 4) return 'sf';
  if (teamCount >= 2) return 'final';
  return null;
}

// Get rounds needed for a given starting round
export function getRoundsNeeded(startRound) {
  const mainRounds = ['ro32', 'ro16', 'qf', 'sf', 'final'];
  const startIdx = mainRounds.indexOf(startRound);
  if (startIdx === -1) return [];
  const rounds = mainRounds.slice(startIdx);
  // Insert third place match before final if we have semi finals
  if (rounds.includes('sf')) {
    const finalIdx = rounds.indexOf('final');
    rounds.splice(finalIdx, 0, 'third');
  }
  return rounds;
}

// Calculate qualifiers from pools
export function calculateQualifiers(pools, matches, teams, qualifyCount) {
  const qualifiers = [];

  for (const pool of pools) {
    const poolMatches = matches.filter(m => m.poolId === pool.id);
    const poolTeams = pool.teamIds
      .map(tid => teams.find(t => t.id === tid))
      .filter(Boolean);

    const teamStats = poolTeams.map(team => {
      const stats = getTeamStatsForMatches(poolMatches, team.id);
      return { teamId: team.id, teamName: team.name, team, ...stats };
    });

    const sorted = sortTeamsByTiebreaker(teamStats, poolMatches);

    sorted.slice(0, qualifyCount).forEach((s, idx) => {
      qualifiers.push({
        teamId: s.teamId,
        poolId: pool.id,
        rank: idx + 1,
        manual: false,
      });
    });
  }

  return qualifiers;
}

// Check how many pool matches remain
export function getPoolMatchesRemaining(pools, matches, gameId) {
  const gamePools = pools.filter(p => p.gameId === gameId);
  const poolIds = gamePools.map(p => p.id);
  const poolMatches = matches.filter(m => poolIds.includes(m.poolId));
  return poolMatches.filter(m => m.status !== 'completed').length;
}

// Get the max teams a round can hold
export function getMaxTeamsForRound(round) {
  const roundSlots = { ro32: 32, ro16: 16, qf: 8, sf: 4, final: 2 };
  return roundSlots[round] || null;
}

// Get available starting round options for a given number of qualified teams
export function getAvailableStartingRounds(teamCount) {
  const options = [];
  if (teamCount >= 2) options.push({ value: 'final', label: 'Final (2 teams)' });
  if (teamCount >= 3) options.push({ value: 'sf', label: 'Semi Finals (3-4 teams)' });
  if (teamCount >= 5) options.push({ value: 'qf', label: 'Quarter Finals (5-8 teams)' });
  if (teamCount >= 9) options.push({ value: 'ro16', label: 'Round of 16 (9-16 teams)' });
  if (teamCount >= 17) options.push({ value: 'ro32', label: 'Round of 32 (17-32 teams)' });
  return options.reverse(); // largest first
}

// Generate bracket matches with cross-pool seeding
export function generateBracket(qualifiers, pools, gameId, genIdFn, customStartRound) {
  const teamCount = qualifiers.length;
  const startRound = customStartRound && customStartRound !== 'auto'
    ? customStartRound
    : getStartingRound(teamCount);
  if (!startRound) return [];

  // If custom start round needs fewer teams, pick top teams evenly across pools.
  // E.g. for SF (4 teams) with 4 pools: take rank 1 from each pool.
  // For SF (4 teams) with 2 pools: take rank 1 and 2 from each pool.
  const maxTeams = getMaxTeamsForRound(startRound);
  let effectiveQualifiers = qualifiers;
  if (maxTeams && teamCount > maxTeams) {
    // Group qualifiers by pool
    const byPool = {};
    for (const q of qualifiers) {
      if (!byPool[q.poolId]) byPool[q.poolId] = [];
      byPool[q.poolId].push(q);
    }
    // Sort each pool by rank
    for (const pid in byPool) byPool[pid].sort((a, b) => a.rank - b.rank);

    // Pick teams round-robin by rank: all rank-1 first, then rank-2, etc.
    const poolKeys = Object.keys(byPool);
    const selected = [];
    let rank = 0;
    while (selected.length < maxTeams) {
      for (const pid of poolKeys) {
        if (selected.length >= maxTeams) break;
        if (byPool[pid][rank]) {
          selected.push(byPool[pid][rank]);
        }
      }
      rank++;
      if (rank > 20) break; // safety
    }
    effectiveQualifiers = selected;
  }

  const rounds = getRoundsNeeded(startRound);
  const allMatches = [];
  let matchNumber = 1;

  // Sort qualifiers by pool for cross-seeding
  const poolMap = {};
  for (const q of effectiveQualifiers) {
    if (!poolMap[q.poolId]) poolMap[q.poolId] = [];
    poolMap[q.poolId].push(q);
  }

  // Sort each pool's qualifiers by rank
  for (const poolId in poolMap) {
    poolMap[poolId].sort((a, b) => a.rank - b.rank);
  }

  const poolIds = Object.keys(poolMap);

  // Create seeded team list for first round using cross-pool seeding
  let seededTeams = crossPoolSeed(poolMap, poolIds, effectiveQualifiers.length, startRound);

  // Pad to next power of 2 for byes
  const bracketSize = nextPowerOf2(seededTeams.length);
  while (seededTeams.length < bracketSize) {
    seededTeams.push(null); // bye slot
  }

  // Generate first round matches
  const firstRound = rounds[0];
  const firstRoundMatches = [];

  for (let i = 0; i < seededTeams.length; i += 2) {
    const teamA = seededTeams[i];
    const teamB = seededTeams[i + 1];
    const isBye = !teamA || !teamB;
    const match = {
      id: genIdFn('km'),
      gameId,
      round: firstRound,
      matchNumber: matchNumber++,
      teamAId: teamA?.teamId || null,
      teamBId: teamB?.teamId || null,
      status: isBye ? 'completed' : 'upcoming',
      result: isBye ? (teamA ? 'teamA' : teamB ? 'teamB' : null) : null,
      absentTeamId: null,
      extraTime: false,
      penalties: false,
      nextMatchId: null,
      slot: null,
    };
    firstRoundMatches.push(match);
    allMatches.push(match);
  }

  // Generate subsequent rounds (excluding 'third' for now)
  let prevRoundMatches = firstRoundMatches;
  for (let ri = 1; ri < rounds.length; ri++) {
    const round = rounds[ri];
    if (round === 'third') continue; // handle after semi finals

    const roundMatches = [];
    // If prevRound was 'sf', only consider sf matches (not third)
    const sourceMatches = round === 'final'
      ? allMatches.filter(m => m.round === 'sf')
      : prevRoundMatches;

    for (let i = 0; i < sourceMatches.length; i += 2) {
      const match = {
        id: genIdFn('km'),
        gameId,
        round,
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

      // Link previous matches to this one
      if (sourceMatches[i]) {
        sourceMatches[i].nextMatchId = match.id;
        sourceMatches[i].slot = 'teamA';
      }
      if (sourceMatches[i + 1]) {
        sourceMatches[i + 1].nextMatchId = match.id;
        sourceMatches[i + 1].slot = 'teamB';
      }

      roundMatches.push(match);
      allMatches.push(match);
    }

    prevRoundMatches = roundMatches;
  }

  // Generate 3rd place match if we have semi finals
  if (rounds.includes('third')) {
    const sfMatches = allMatches.filter(m => m.round === 'sf');
    if (sfMatches.length === 2) {
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
      };
      // We'll populate this when SF results come in (losers go here)
      // Store the SF match IDs on the third place match for reference
      thirdMatch._sfMatchIds = sfMatches.map(m => m.id);
      allMatches.push(thirdMatch);
    }
  }

  // Auto-advance byes in first round
  for (const m of firstRoundMatches) {
    if (m.status === 'completed' && m.result) {
      advanceWinner(m, allMatches);
    }
  }

  return allMatches;
}

// Cross-pool seeding: A1 vs B2, B1 vs A2, etc.
function crossPoolSeed(poolMap, poolIds, teamCount, startRound) {
  const teams = [];

  if (poolIds.length === 2) {
    // Standard 2-pool cross-seeding
    const poolA = poolMap[poolIds[0]] || [];
    const poolB = poolMap[poolIds[1]] || [];
    const maxRank = Math.max(poolA.length, poolB.length);

    for (let rank = 0; rank < maxRank; rank++) {
      if (rank % 2 === 0) {
        // A's team at this rank vs B's next rank
        if (poolA[rank]) teams.push(poolA[rank]);
        if (poolB[rank]) teams.push(poolB[rank]);
      } else {
        if (poolB[rank]) teams.push(poolB[rank]);
        if (poolA[rank]) teams.push(poolA[rank]);
      }
    }

    // Re-arrange for proper cross-seeding: A1 vs B2, B1 vs A2
    if (poolA.length >= 2 && poolB.length >= 2) {
      const seeded = [];
      seeded.push(poolA[0]); // A1
      seeded.push(poolB[1]); // B2
      seeded.push(poolB[0]); // B1
      seeded.push(poolA[1]); // A2
      // Add remaining teams
      for (let i = 2; i < Math.max(poolA.length, poolB.length); i++) {
        if (poolA[i]) seeded.push(poolA[i]);
        if (poolB[i]) seeded.push(poolB[i]);
      }
      return seeded;
    }

    return teams;
  }

  // Multi-pool: interleave by rank
  const maxRank = Math.max(...poolIds.map(pid => (poolMap[pid] || []).length));
  for (let rank = 0; rank < maxRank; rank++) {
    for (const pid of poolIds) {
      const poolTeams = poolMap[pid] || [];
      if (poolTeams[rank]) teams.push(poolTeams[rank]);
    }
  }

  return teams;
}

function nextPowerOf2(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

// Advance winner to next match
export function advanceWinner(match, allMatches) {
  if (!match.nextMatchId || !match.result) return;

  const winnerId = match.result === 'teamA' ? match.teamAId : match.teamBId;
  const nextMatch = allMatches.find(m => m.id === match.nextMatchId);
  if (!nextMatch) return;

  if (match.slot === 'teamA') {
    nextMatch.teamAId = winnerId;
  } else if (match.slot === 'teamB') {
    nextMatch.teamBId = winnerId;
  }
}

// Send loser to 3rd place match
export function advanceLoserToThird(match, allMatches) {
  const thirdMatch = allMatches.find(m => m.round === 'third' && m.gameId === match.gameId);
  if (!thirdMatch) return;

  const loserId = match.result === 'teamA' ? match.teamBId : match.teamAId;

  // Fill first available slot
  if (!thirdMatch.teamAId) {
    thirdMatch.teamAId = loserId;
  } else if (!thirdMatch.teamBId) {
    thirdMatch.teamBId = loserId;
  }
}

// Get knockout match points for a team (includes bonus)
export function getKnockoutMatchPoints(match, teamId, bonusConfig) {
  if (match.status !== 'completed') return { base: 0, bonus: 0, total: 0 };

  let base = 0;

  if (match.result === 'bye') {
    if (match.absentTeamId === teamId) return { base: 0, bonus: 0, total: 0 };
    base = 2; // bye points
  } else {
    base = 1; // participation
    const isWinner =
      (match.result === 'teamA' && match.teamAId === teamId) ||
      (match.result === 'teamB' && match.teamBId === teamId);
    if (isWinner) {
      base += 3; // win
    }
    // Loss: just participation (1)
  }

  // Bonus points for knockout advancement (only for winners)
  let bonus = 0;
  if (bonusConfig?.enabled) {
    const isWinner =
      (match.result === 'teamA' && match.teamAId === teamId) ||
      (match.result === 'teamB' && match.teamBId === teamId) ||
      (match.result === 'bye' && match.absentTeamId !== teamId);

    if (isWinner) {
      if (match.round === 'qf') bonus = bonusConfig.qf || 0;
      else if (match.round === 'sf') bonus = bonusConfig.sf || 0;
      else if (match.round === 'final') bonus = bonusConfig.final || 0;
      else if (match.round === 'third') bonus = bonusConfig.third || 0;
    }
  }

  return { base, bonus, total: base + bonus };
}

// Get total knockout points for a team across all their knockout matches in a game
export function getTeamKnockoutPoints(knockoutMatches, teamId, bonusConfig) {
  let total = 0;
  let played = 0;
  let wins = 0;
  let losses = 0;
  let byes = 0;

  for (const m of knockoutMatches) {
    if (m.teamAId !== teamId && m.teamBId !== teamId) continue;
    if (m.status !== 'completed') continue;

    const pts = getKnockoutMatchPoints(m, teamId, bonusConfig);
    total += pts.total;

    if (m.result === 'bye') {
      byes++;
      if (m.absentTeamId !== teamId) played++;
    } else {
      played++;
      const isWinner =
        (m.result === 'teamA' && m.teamAId === teamId) ||
        (m.result === 'teamB' && m.teamBId === teamId);
      if (isWinner) wins++;
      else losses++;
    }
  }

  return { played, wins, losses, byes, points: total };
}

// Get the furthest round a team reached in knockout
export function getTeamFurthestRound(knockoutMatches, teamId, gameId) {
  const teamMatches = knockoutMatches.filter(
    m => m.gameId === gameId && (m.teamAId === teamId || m.teamBId === teamId)
  );

  if (teamMatches.length === 0) return null;

  // Check if champion
  const finalMatch = teamMatches.find(m => m.round === 'final' && m.status === 'completed');
  if (finalMatch) {
    const isWinner =
      (finalMatch.result === 'teamA' && finalMatch.teamAId === teamId) ||
      (finalMatch.result === 'teamB' && finalMatch.teamBId === teamId);
    if (isWinner) return 'Champion';
    return 'Finalist';
  }

  // Check 3rd place
  const thirdMatch = teamMatches.find(m => m.round === 'third' && m.status === 'completed');
  if (thirdMatch) {
    const isWinner =
      (thirdMatch.result === 'teamA' && thirdMatch.teamAId === teamId) ||
      (thirdMatch.result === 'teamB' && thirdMatch.teamBId === teamId);
    if (isWinner) return '3rd Place';
    return '4th Place';
  }

  // Find highest round they appeared in
  const roundPriority = { final: 6, third: 5, sf: 4, qf: 3, ro16: 2, ro32: 1 };
  let highest = 0;
  let highestRound = null;

  for (const m of teamMatches) {
    const p = roundPriority[m.round] || 0;
    if (p > highest) {
      highest = p;
      highestRound = m.round;
    }
  }

  const roundToLabel = {
    sf: 'Semi-Finalist',
    qf: 'Quarter-Finalist',
    ro16: 'Round of 16',
    ro32: 'Round of 32',
  };

  return roundToLabel[highestRound] || 'Pool Stage';
}

// Check if all knockout matches of a game are completed
export function isKnockoutComplete(knockoutMatches, gameId) {
  const gameKo = knockoutMatches.filter(m => m.gameId === gameId);
  if (gameKo.length === 0) return false;
  return gameKo.every(m => m.status === 'completed');
}

// Get champion team ID
export function getChampion(knockoutMatches, gameId) {
  const finalMatch = knockoutMatches.find(
    m => m.gameId === gameId && m.round === 'final' && m.status === 'completed'
  );
  if (!finalMatch) return null;

  return finalMatch.result === 'teamA' ? finalMatch.teamAId : finalMatch.teamBId;
}

// Get podium (1st, 2nd, 3rd)
export function getPodium(knockoutMatches, gameId) {
  const finalMatch = knockoutMatches.find(
    m => m.gameId === gameId && m.round === 'final' && m.status === 'completed'
  );
  const thirdMatch = knockoutMatches.find(
    m => m.gameId === gameId && m.round === 'third' && m.status === 'completed'
  );

  const podium = { first: null, second: null, third: null };

  if (finalMatch) {
    podium.first = finalMatch.result === 'teamA' ? finalMatch.teamAId : finalMatch.teamBId;
    podium.second = finalMatch.result === 'teamA' ? finalMatch.teamBId : finalMatch.teamAId;
  }

  if (thirdMatch) {
    podium.third = thirdMatch.result === 'teamA' ? thirdMatch.teamAId : thirdMatch.teamBId;
  }

  return podium;
}
