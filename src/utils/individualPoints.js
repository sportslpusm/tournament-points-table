/**
 * Points calculation utilities for Individual (athlete-based) games.
 *
 * Points model:
 *  - Participation: configurable (default 1) for each athlete who competes
 *  - 1st place: configurable bonus (default 5) ON TOP of participation
 *  - 2nd place: configurable bonus (default 3) ON TOP of participation
 *  - 3rd place: configurable bonus (default 1) ON TOP of participation
 *  - Absent/DNS: 0 points (no participation)
 *
 * Per-category overrides:
 *  - Each category can have its own points config stored in
 *    individualPointsConfig[gameId].categoryOverrides[categoryId].
 *  - Falls back to game-level config, then DEFAULT_INDIVIDUAL_POINTS.
 *
 * ANTI-SPAM:
 *  - maxParticipationCap: configurable per-game limit on how many participation
 *    points a single TEAM can earn in a single event/category. Prevents point
 *    farming by flooding athletes. Medal/placement bonus is NEVER capped.
 *    Default: Infinity (no cap). Set to e.g. 3 to cap at 3 participation pts.
 */

import { safeNum, denseRank } from './points';

export const DEFAULT_INDIVIDUAL_POINTS = {
  first: 5,
  second: 3,
  third: 1,
  participation: 1,
  maxParticipationCap: Infinity, // ← dynamic cap; set to a number to limit
};

/**
 * Resolve the effective points config for a specific category.
 * Priority: category override → game-level config → DEFAULT.
 * Category overrides inherit missing fields from game-level config.
 */
export function resolvePointsConfig(individualPointsConfig, gameId, categoryId) {
  const gameConfig = individualPointsConfig[gameId] || DEFAULT_INDIVIDUAL_POINTS;
  if (categoryId && gameConfig.categoryOverrides?.[categoryId]) {
    const override = gameConfig.categoryOverrides[categoryId];
    return {
      first: override.first ?? gameConfig.first ?? DEFAULT_INDIVIDUAL_POINTS.first,
      second: override.second ?? gameConfig.second ?? DEFAULT_INDIVIDUAL_POINTS.second,
      third: override.third ?? gameConfig.third ?? DEFAULT_INDIVIDUAL_POINTS.third,
      participation: override.participation ?? gameConfig.participation ?? DEFAULT_INDIVIDUAL_POINTS.participation,
      maxParticipationCap: override.maxParticipationCap ?? gameConfig.maxParticipationCap ?? Infinity,
    };
  }
  return gameConfig;
}

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
 *
 * NOTE: This per-athlete function does NOT enforce the team-level cap.
 * The cap is enforced at the team aggregation level (getIndividualPointsForTeam
 * and getCategoryPointsBreakdown).
 */
export function getAthletePoints(athleteId, individualResults, individualPointsConfig) {
  let total = 0;
  const breakdown = [];

  for (const result of individualResults) {
    if (result.placements?.first === athleteId ||
        result.placements?.second === athleteId ||
        result.placements?.third === athleteId ||
        (result.participants || []).includes(athleteId)) {

      // Use category-specific config if available, else game-level
      const config = resolvePointsConfig(individualPointsConfig, result.gameId, result.categoryId);

      // Check if absent
      if ((result.absentees || []).includes(athleteId)) continue;

      let pts = safeNum(config.participation); // participation base
      let placement = 'participant';

      if (result.placements?.first === athleteId) {
        pts += safeNum(config.first);
        placement = 'first';
      } else if (result.placements?.second === athleteId) {
        pts += safeNum(config.second);
        placement = 'second';
      } else if (result.placements?.third === athleteId) {
        pts += safeNum(config.third);
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
 * Enforces maxParticipationCap per game per team.
 */
export function getIndividualPointsForTeam(teamId, athletes, individualResults, individualPointsConfig) {
  const teamAthletes = athletes.filter(a => a.teamId === teamId);
  let total = 0;

  // Group results by gameId to enforce per-game participation cap
  const resultsByGame = {};
  for (const r of individualResults) {
    if (!resultsByGame[r.gameId]) resultsByGame[r.gameId] = [];
    resultsByGame[r.gameId].push(r);
  }

  for (const gameId in resultsByGame) {
    const gameResults = resultsByGame[gameId];
    const gameConfig = individualPointsConfig[gameId] || DEFAULT_INDIVIDUAL_POINTS;
    const cap = gameConfig.maxParticipationCap ?? Infinity;

    let gameParticipationCount = 0; // track participation slots used

    for (const result of gameResults) {
      // Use category-specific config if available
      const config = resolvePointsConfig(individualPointsConfig, gameId, result.categoryId);
      const absentSet = new Set(result.absentees || []);
      const placedIds = new Set([
        result.placements?.first,
        result.placements?.second,
        result.placements?.third,
      ].filter(Boolean));

      for (const athlete of teamAthletes) {
        if (athlete.gameId !== gameId) continue;

        const isPlaced = placedIds.has(athlete.id);
        const isParticipant = (result.participants || []).includes(athlete.id);
        if (!isPlaced && !isParticipant) continue;
        if (absentSet.has(athlete.id)) continue;

        // Placement bonus is NEVER capped
        let placementBonus = 0;
        if (result.placements?.first === athlete.id) placementBonus = safeNum(config.first);
        else if (result.placements?.second === athlete.id) placementBonus = safeNum(config.second);
        else if (result.placements?.third === athlete.id) placementBonus = safeNum(config.third);

        // Participation point is capped per team per game
        let participationPts = 0;
        if (gameParticipationCount < cap) {
          participationPts = safeNum(config.participation);
          gameParticipationCount++;
        }

        total += placementBonus + participationPts;
      }
    }
  }

  return total;
}

/**
 * Get per-team points breakdown for a single category.
 * Returns array of { teamId, points, golds, silvers, bronzes, participations }
 * Enforces maxParticipationCap per team within this category.
 */
export function getCategoryPointsBreakdown(categoryId, individualResults, athletes, pointsConfig) {
  const result = individualResults.find(r => r.categoryId === categoryId);
  if (!result) return [];

  const config = pointsConfig || DEFAULT_INDIVIDUAL_POINTS;
  const cap = config.maxParticipationCap ?? Infinity;
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

  // Process placements first (medal holders always get participation — counted toward cap)
  if (result.placements?.first) {
    const tid = getTeamId(result.placements.first);
    if (tid && !absentSet.has(result.placements.first)) {
      const entry = getOrCreate(tid);
      entry.points += safeNum(config.first); // placement bonus (never capped)
      if (entry.participations < cap) {
        entry.points += safeNum(config.participation);
        entry.participations++;
      }
      entry.golds++;
    }
  }
  if (result.placements?.second) {
    const tid = getTeamId(result.placements.second);
    if (tid && !absentSet.has(result.placements.second)) {
      const entry = getOrCreate(tid);
      entry.points += safeNum(config.second);
      if (entry.participations < cap) {
        entry.points += safeNum(config.participation);
        entry.participations++;
      }
      entry.silvers++;
    }
  }
  if (result.placements?.third) {
    const tid = getTeamId(result.placements.third);
    if (tid && !absentSet.has(result.placements.third)) {
      const entry = getOrCreate(tid);
      entry.points += safeNum(config.third);
      if (entry.participations < cap) {
        entry.points += safeNum(config.participation);
        entry.participations++;
      }
      entry.bronzes++;
    }
  }

  // Process other participants (not in placements, not absent) — subject to cap
  // Deduplicate to prevent double-counting from data entry errors
  const placedIds = new Set([result.placements?.first, result.placements?.second, result.placements?.third].filter(Boolean));
  const seenParticipants = new Set();
  for (const athleteId of (result.participants || [])) {
    if (placedIds.has(athleteId) || absentSet.has(athleteId)) continue;
    if (seenParticipants.has(athleteId)) continue; // dedup
    seenParticipants.add(athleteId);
    const tid = getTeamId(athleteId);
    if (tid) {
      const entry = getOrCreate(tid);
      if (entry.participations < cap) {
        entry.points += safeNum(config.participation);
        entry.participations++;
      }
    }
  }

  return [...teamMap.values()];
}

/**
 * Get aggregated team standings for an entire individual game.
 * Sorted by: total points → golds → silvers → bronzes (Olympic-style).
 * Enforces maxParticipationCap across all categories in the game.
 */
export function getIndividualGameTeamStandings(gameId, athletes, categories, individualResults, teams, pointsConfig, individualPointsConfig) {
  const gameCategories = categories.filter(c => c.gameId === gameId);
  const gameResults = individualResults.filter(r => r.gameId === gameId);
  const gameAthletes = athletes.filter(a => a.gameId === gameId);
  const fallbackConfig = pointsConfig || DEFAULT_INDIVIDUAL_POINTS;

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

  // Aggregate across all categories (each may have its own points config)
  for (const result of gameResults) {
    const catConfig = individualPointsConfig
      ? resolvePointsConfig(individualPointsConfig, gameId, result.categoryId)
      : fallbackConfig;
    const breakdown = getCategoryPointsBreakdown(result.categoryId, [result], athletes, catConfig);
    for (const entry of breakdown) {
      const team = teamMap.get(entry.teamId);
      if (!team) continue;
      team.golds += entry.golds;
      team.silvers += entry.silvers;
      team.bronzes += entry.bronzes;
      team.participationPoints += entry.participations * safeNum(catConfig.participation);
      team.placementPoints += entry.points - (entry.participations * safeNum(catConfig.participation));
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
    return 0; // never alphabetical
  });

  // Compute dense ranks (tied teams share rank, next team gets rank+1)
  const ranks = denseRank(standings, (a, b) =>
    a.totalPoints === b.totalPoints && a.golds === b.golds &&
    a.silvers === b.silvers && a.bronzes === b.bronzes
  );
  standings.forEach((s, i) => { s.rank = ranks[i]; });

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
