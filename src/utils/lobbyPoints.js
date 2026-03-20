/**
 * Scoring utilities for Lobby/Multi-Competitor games.
 *
 * Lobby games: multiple teams or squads compete simultaneously in a single
 * session (e.g. ESports lobbies, relay races, marathons, battle royales).
 *
 * Key features:
 *  - Uses SAME placement point scale as individual sports (6/4/2/1)
 *  - A single school CAN register multiple entries ("Team A", "Team B")
 *  - A single school CAN win multiple podium spots (podium stacking)
 *  - maxParticipationCap ONLY caps +1 attendance pts, NEVER placement pts
 *
 * Data model (lobbyResults):
 *   { id, gameId, sessionName, placements: { first, second, third }, participantTeamIds: [] }
 *   Where first/second/third are teamIds (school teams), and participantTeamIds
 *   includes ALL teams that competed.
 */

import { DEFAULT_INDIVIDUAL_POINTS } from './individualPoints';

/**
 * Default lobby point config — mirrors individual sport values.
 */
export const DEFAULT_LOBBY_POINTS = {
  first: 5,       // placement bonus for 1st
  second: 3,      // placement bonus for 2nd
  third: 1,       // placement bonus for 3rd
  participation: 1,
  maxParticipationCap: Infinity,
};

/**
 * Get total lobby game points for a specific school team.
 * Handles podium stacking: if a school has multiple entries winning multiple spots,
 * each placement earns full bonus.
 *
 * @param {string} teamId - The school's team ID
 * @param {Array} lobbyResults - All lobby session results
 * @param {Object} pointsConfig - Per-game config keyed by gameId
 * @returns {{ total, golds, silvers, bronzes, participations }}
 */
export function getLobbyPointsForTeam(teamId, lobbyResults, pointsConfig) {
  let total = 0;
  let golds = 0, silvers = 0, bronzes = 0;

  // Group by game for per-game participation cap
  const resultsByGame = {};
  for (const r of lobbyResults) {
    if (!resultsByGame[r.gameId]) resultsByGame[r.gameId] = [];
    resultsByGame[r.gameId].push(r);
  }

  for (const gameId in resultsByGame) {
    const config = pointsConfig[gameId] || DEFAULT_LOBBY_POINTS;
    const cap = config.maxParticipationCap ?? Infinity;
    let gameParticipationCount = 0;
    const sessions = resultsByGame[gameId];

    for (const session of sessions) {
      const isParticipant = (session.participantTeamIds || []).includes(teamId);
      if (!isParticipant) continue;

      // Check placements — podium stacking: same team can appear in multiple slots
      const placements = session.placements || {};

      // A team can win multiple spots via multiple entries.
      // placements can be arrays (for stacking) or single values.
      // We check each placement slot:
      const firstIds = Array.isArray(placements.first) ? placements.first : [placements.first].filter(Boolean);
      const secondIds = Array.isArray(placements.second) ? placements.second : [placements.second].filter(Boolean);
      const thirdIds = Array.isArray(placements.third) ? placements.third : [placements.third].filter(Boolean);

      const firstCount = firstIds.filter(id => id === teamId).length;
      const secondCount = secondIds.filter(id => id === teamId).length;
      const thirdCount = thirdIds.filter(id => id === teamId).length;

      // Placement bonuses are NEVER capped
      total += firstCount * config.first;
      total += secondCount * config.second;
      total += thirdCount * config.third;
      golds += firstCount;
      silvers += secondCount;
      bronzes += thirdCount;

      // Participation point — capped per school per game
      if (gameParticipationCount < cap) {
        total += config.participation;
        gameParticipationCount++;
      }
    }
  }

  return { total, golds, silvers, bronzes };
}

/**
 * Get lobby standings for a specific game.
 * Returns sorted array of { teamId, team, totalPoints, golds, silvers, bronzes, ... }
 */
export function getLobbyGameStandings(gameId, lobbyResults, teams, pointsConfig) {
  const gameResults = lobbyResults.filter(r => r.gameId === gameId);
  const config = pointsConfig[gameId] || DEFAULT_LOBBY_POINTS;
  const cap = config.maxParticipationCap ?? Infinity;

  const teamMap = new Map();

  // Find all teams that participated in this game
  for (const session of gameResults) {
    for (const tid of (session.participantTeamIds || [])) {
      if (!teamMap.has(tid)) {
        const team = teams.find(t => t.id === tid);
        if (team) {
          teamMap.set(tid, {
            teamId: tid,
            team,
            totalPoints: 0,
            golds: 0,
            silvers: 0,
            bronzes: 0,
            participationCount: 0,
            sessions: 0,
          });
        }
      }
    }
  }

  // Calculate points
  for (const session of gameResults) {
    const placements = session.placements || {};
    const firstIds = Array.isArray(placements.first) ? placements.first : [placements.first].filter(Boolean);
    const secondIds = Array.isArray(placements.second) ? placements.second : [placements.second].filter(Boolean);
    const thirdIds = Array.isArray(placements.third) ? placements.third : [placements.third].filter(Boolean);

    for (const [tid, entry] of teamMap) {
      if (!(session.participantTeamIds || []).includes(tid)) continue;

      entry.sessions++;

      const fCount = firstIds.filter(id => id === tid).length;
      const sCount = secondIds.filter(id => id === tid).length;
      const tCount = thirdIds.filter(id => id === tid).length;

      entry.totalPoints += fCount * config.first;
      entry.totalPoints += sCount * config.second;
      entry.totalPoints += tCount * config.third;
      entry.golds += fCount;
      entry.silvers += sCount;
      entry.bronzes += tCount;

      if (entry.participationCount < cap) {
        entry.totalPoints += config.participation;
        entry.participationCount++;
      }
    }
  }

  const standings = [...teamMap.values()];
  standings.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.golds !== a.golds) return b.golds - a.golds;
    if (b.silvers !== a.silvers) return b.silvers - a.silvers;
    if (b.bronzes !== a.bronzes) return b.bronzes - a.bronzes;
    return 0;
  });

  return standings;
}
