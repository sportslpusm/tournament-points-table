/**
 * Scoring utilities for Lobby/Multi-Competitor games.
 *
 * Lobby games: multiple entries compete simultaneously in a single
 * session (e.g. ESports lobbies, relay races, marathons, battle royales).
 *
 * Key features:
 *  - Uses SAME placement point scale as individual sports (6/4/2/1)
 *  - A single school CAN register multiple entries ("Team A", "Team B")
 *  - A single school CAN win multiple podium spots (podium stacking)
 *  - maxParticipationCap ONLY caps +1 attendance pts, NEVER placement pts
 *  - Points roll up from entries to their parent school
 *
 * Data model:
 *   lobbyEntries: { id, gameId, teamId (school), entryName (optional) }
 *   lobbyResults: { id, gameId, sessionName, placements: { first, second, third }, participantEntryIds: [] }
 *   Where first/second/third are entry IDs, and participantEntryIds includes ALL entries that competed.
 */

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
 * Get total lobby game points for a specific school (teamId).
 * Maps entries back to their parent school and aggregates.
 * Participation: one per session per school (not per entry), capped by maxParticipationCap.
 *
 * @param {string} teamId - The school's team ID
 * @param {Array} lobbyResults - All lobby session results
 * @param {Array} lobbyEntries - All lobby entries
 * @param {Object} pointsConfig - Per-game config keyed by gameId
 * @returns {{ total, golds, silvers, bronzes }}
 */
export function getLobbyPointsForTeam(teamId, lobbyResults, lobbyEntries, pointsConfig) {
  let total = 0;
  let golds = 0, silvers = 0, bronzes = 0;

  const entries = Array.isArray(lobbyEntries) ? lobbyEntries : [];

  // Build set of entry IDs belonging to this school
  const myEntryIds = new Set(
    entries.filter(e => e.teamId === teamId).map(e => e.id)
  );

  // Group results by game for per-game participation cap
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
      const participantEntryIds = session.participantEntryIds || [];
      // Check if any of this school's entries participated
      const schoolParticipated = participantEntryIds.some(id => myEntryIds.has(id));
      if (!schoolParticipated) continue;

      // Check placements
      const placements = session.placements || {};
      if (myEntryIds.has(placements.first)) { total += config.first; golds++; }
      if (myEntryIds.has(placements.second)) { total += config.second; silvers++; }
      if (myEntryIds.has(placements.third)) { total += config.third; bronzes++; }

      // Participation point — one per session per school, capped
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
 * Aggregates at the school level — entries roll up to their parent team.
 * Returns sorted array of { teamId, team, totalPoints, golds, silvers, bronzes, sessions }
 */
export function getLobbyGameStandings(gameId, lobbyResults, lobbyEntries, teams, pointsConfig) {
  const gameResults = lobbyResults.filter(r => r.gameId === gameId);
  const entries = Array.isArray(lobbyEntries) ? lobbyEntries : [];
  const gameEntries = entries.filter(e => e.gameId === gameId);
  const config = pointsConfig[gameId] || DEFAULT_LOBBY_POINTS;
  const cap = config.maxParticipationCap ?? Infinity;

  // Build entry→school lookup
  const entryToTeam = new Map();
  for (const entry of gameEntries) {
    entryToTeam.set(entry.id, entry.teamId);
  }

  // Aggregate per school
  const teamMap = new Map();

  function getOrCreateTeamEntry(schoolId) {
    if (teamMap.has(schoolId)) return teamMap.get(schoolId);
    const team = teams.find(t => t.id === schoolId);
    if (!team) return null;
    const entry = {
      teamId: schoolId,
      team,
      totalPoints: 0,
      golds: 0,
      silvers: 0,
      bronzes: 0,
      participationCount: 0,
      sessions: 0,
    };
    teamMap.set(schoolId, entry);
    return entry;
  }

  for (const session of gameResults) {
    const placements = session.placements || {};
    const participantEntryIds = session.participantEntryIds || [];

    // Track which schools participated in this session (for one participation point per school)
    const schoolsInSession = new Set();

    for (const entryId of participantEntryIds) {
      const schoolId = entryToTeam.get(entryId);
      if (!schoolId) continue;
      schoolsInSession.add(schoolId);
    }

    // Award placement bonuses
    const firstSchool = entryToTeam.get(placements.first);
    const secondSchool = entryToTeam.get(placements.second);
    const thirdSchool = entryToTeam.get(placements.third);

    if (firstSchool) {
      const e = getOrCreateTeamEntry(firstSchool);
      if (e) { e.totalPoints += config.first; e.golds++; }
    }
    if (secondSchool) {
      const e = getOrCreateTeamEntry(secondSchool);
      if (e) { e.totalPoints += config.second; e.silvers++; }
    }
    if (thirdSchool) {
      const e = getOrCreateTeamEntry(thirdSchool);
      if (e) { e.totalPoints += config.third; e.bronzes++; }
    }

    // Participation — one per school per session, capped
    for (const schoolId of schoolsInSession) {
      const e = getOrCreateTeamEntry(schoolId);
      if (!e) continue;
      e.sessions++;
      if (e.participationCount < cap) {
        e.totalPoints += config.participation;
        e.participationCount++;
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
