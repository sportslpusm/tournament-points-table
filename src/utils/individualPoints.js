/**
 * Points calculation utilities for Individual (athlete-based) games.
 *
 * Points model:
 *  - Participation: configurable (default 1) for each athlete who competes
 *  - 1st place: configurable bonus (default 5) ON TOP of participation
 *  - 2nd place: configurable bonus (default 3) ON TOP of participation
 *  - 3rd place: configurable bonus (default 1) ON TOP of participation
 *  - Absent/DNS: 0 points (no participation)
 */

export const DEFAULT_INDIVIDUAL_POINTS = {
  first: 5,
  second: 3,
  third: 1,
  participation: 1,
};

/**
 * Shift placements up when an athlete is deleted.
 * 2nd → 1st, 3rd → 2nd, vacated slot becomes null.
 */
export function shiftPlacements(placements, deletedAthleteId) {
  if (!placements) return { first: null, second: null, third: null };
  let { first, second, third } = placements;

  if (first === deletedAthleteId) {
    first = second;
    second = third;
    third = null;
  } else if (second === deletedAthleteId) {
    second = third;
    third = null;
  } else if (third === deletedAthleteId) {
    third = null;
  }

  return { first, second, third };
}

/**
 * Get points earned by a single athlete across all categories in all games.
 * Returns { total, breakdown: [{ gameId, categoryId, points, placement }] }
 */
export function getAthletePoints(athleteId, individualResults, individualPointsConfig) {
  let total = 0;
  const breakdown = [];

  for (const result of individualResults) {
    if (result.placements?.first === athleteId ||
        result.placements?.second === athleteId ||
        result.placements?.third === athleteId ||
        (result.participants || []).includes(athleteId)) {

      const config = individualPointsConfig[result.gameId] || DEFAULT_INDIVIDUAL_POINTS;

      // Check if absent
      if ((result.absentees || []).includes(athleteId)) continue;

      let pts = config.participation; // participation base
      let placement = 'participant';

      if (result.placements?.first === athleteId) {
        pts += config.first;
        placement = 'first';
      } else if (result.placements?.second === athleteId) {
        pts += config.second;
        placement = 'second';
      } else if (result.placements?.third === athleteId) {
        pts += config.third;
        placement = 'third';
      }

      total += pts;
      breakdown.push({ gameId: result.gameId, categoryId: result.categoryId, points: pts, placement });
    }
  }

  return { total, breakdown };
}

/**
 * Get total individual game points for a team across all individual games.
 */
export function getIndividualPointsForTeam(teamId, athletes, individualResults, individualPointsConfig) {
  const teamAthletes = athletes.filter(a => a.teamId === teamId);
  let total = 0;

  for (const athlete of teamAthletes) {
    const { total: pts } = getAthletePoints(athlete.id, individualResults, individualPointsConfig);
    total += pts;
  }

  return total;
}

/**
 * Get per-team points breakdown for a single category.
 * Returns array of { teamId, points, golds, silvers, bronzes, participations }
 */
export function getCategoryPointsBreakdown(categoryId, individualResults, athletes, pointsConfig) {
  const result = individualResults.find(r => r.categoryId === categoryId);
  if (!result) return [];

  const config = pointsConfig || DEFAULT_INDIVIDUAL_POINTS;
  const teamMap = new Map(); // teamId → { points, golds, silvers, bronzes, participations }

  function getOrCreate(teamId) {
    if (!teamMap.has(teamId)) {
      teamMap.set(teamId, { teamId, points: 0, golds: 0, silvers: 0, bronzes: 0, participations: 0 });
    }
    return teamMap.get(teamId);
  }

  function getTeamId(athleteId) {
    const a = athletes.find(x => x.id === athleteId);
    return a?.teamId;
  }

  const absentSet = new Set(result.absentees || []);

  // Process placements
  if (result.placements?.first) {
    const tid = getTeamId(result.placements.first);
    if (tid && !absentSet.has(result.placements.first)) {
      const entry = getOrCreate(tid);
      entry.points += config.first + config.participation;
      entry.golds++;
      entry.participations++;
    }
  }
  if (result.placements?.second) {
    const tid = getTeamId(result.placements.second);
    if (tid && !absentSet.has(result.placements.second)) {
      const entry = getOrCreate(tid);
      entry.points += config.second + config.participation;
      entry.silvers++;
      entry.participations++;
    }
  }
  if (result.placements?.third) {
    const tid = getTeamId(result.placements.third);
    if (tid && !absentSet.has(result.placements.third)) {
      const entry = getOrCreate(tid);
      entry.points += config.third + config.participation;
      entry.bronzes++;
      entry.participations++;
    }
  }

  // Process other participants (not in placements, not absent)
  const placedIds = new Set([result.placements?.first, result.placements?.second, result.placements?.third].filter(Boolean));
  for (const athleteId of (result.participants || [])) {
    if (placedIds.has(athleteId) || absentSet.has(athleteId)) continue;
    const tid = getTeamId(athleteId);
    if (tid) {
      const entry = getOrCreate(tid);
      entry.points += config.participation;
      entry.participations++;
    }
  }

  return [...teamMap.values()];
}

/**
 * Get aggregated team standings for an entire individual game.
 * Sorted by: total points → golds → silvers → bronzes (Olympic-style).
 */
export function getIndividualGameTeamStandings(gameId, athletes, categories, individualResults, teams, pointsConfig) {
  const gameCategories = categories.filter(c => c.gameId === gameId);
  const gameResults = individualResults.filter(r => r.gameId === gameId);
  const gameAthletes = athletes.filter(a => a.gameId === gameId);
  const config = pointsConfig || DEFAULT_INDIVIDUAL_POINTS;

  const teamMap = new Map();

  // Initialize all teams that have athletes in this game
  const teamsInGame = new Set(gameAthletes.map(a => a.teamId));
  for (const tid of teamsInGame) {
    const team = teams.find(t => t.id === tid);
    if (team) {
      teamMap.set(tid, {
        teamId: tid,
        team,
        athleteCount: gameAthletes.filter(a => a.teamId === tid).length,
        golds: 0,
        silvers: 0,
        bronzes: 0,
        participationPoints: 0,
        placementPoints: 0,
        totalPoints: 0,
      });
    }
  }

  // Aggregate across all categories
  for (const result of gameResults) {
    const breakdown = getCategoryPointsBreakdown(result.categoryId, [result], athletes, config);
    for (const entry of breakdown) {
      const team = teamMap.get(entry.teamId);
      if (!team) continue;
      team.golds += entry.golds;
      team.silvers += entry.silvers;
      team.bronzes += entry.bronzes;
      team.participationPoints += entry.participations * config.participation;
      team.placementPoints += entry.points - (entry.participations * config.participation);
      team.totalPoints += entry.points;
    }
  }

  // Sort: total points desc → golds desc → silvers desc → bronzes desc
  const standings = [...teamMap.values()];
  standings.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.golds !== a.golds) return b.golds - a.golds;
    if (b.silvers !== a.silvers) return b.silvers - a.silvers;
    if (b.bronzes !== a.bronzes) return b.bronzes - a.bronzes;
    return (a.team?.name || '').localeCompare(b.team?.name || '');
  });

  return standings;
}

/**
 * Get medal counts for a single athlete across all games.
 * Returns { golds, silvers, bronzes }
 */
export function getAthleteMedals(athleteId, individualResults) {
  let golds = 0, silvers = 0, bronzes = 0;
  for (const r of individualResults) {
    if (r.placements?.first === athleteId) golds++;
    if (r.placements?.second === athleteId) silvers++;
    if (r.placements?.third === athleteId) bronzes++;
  }
  return { golds, silvers, bronzes };
}

/**
 * Get medal counts for a team across all individual games.
 */
export function getTeamMedals(teamId, athletes, individualResults) {
  const teamAthleteIds = new Set(athletes.filter(a => a.teamId === teamId).map(a => a.id));
  let golds = 0, silvers = 0, bronzes = 0;
  for (const r of individualResults) {
    if (r.placements?.first && teamAthleteIds.has(r.placements.first)) golds++;
    if (r.placements?.second && teamAthleteIds.has(r.placements.second)) silvers++;
    if (r.placements?.third && teamAthleteIds.has(r.placements.third)) bronzes++;
  }
  return { golds, silvers, bronzes };
}
