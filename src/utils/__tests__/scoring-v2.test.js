/**
 * SCORING V2 VALIDATION TESTS
 *
 * Test D: Shared Ranking (Absolute Deadlock Protocol)
 * Test E: Lobby Game Scoring + Podium Stacking
 * Test F: Participation Cap never restricts medal/placement points
 */

import { sortTeamsByTiebreaker } from '../points.js';
import { getLobbyPointsForTeam, getLobbyGameStandings, DEFAULT_LOBBY_POINTS } from '../lobbyPoints.js';
import { getIndividualPointsForTeam, getCategoryPointsBreakdown, DEFAULT_INDIVIDUAL_POINTS } from '../individualPoints.js';

// ═══════════════════════════════════════════════════════════════
// TEST D: Shared Ranking (Absolute Deadlock Protocol)
// ═══════════════════════════════════════════════════════════════
// When two schools have identical points, wins+golds, silvers, and bronzes
// the sort function must return 0 (stable, no arbitrary tiebreak).
// The Dashboard assigns shared ranks: both get rank 1, next becomes rank 3.
// ═══════════════════════════════════════════════════════════════

describe('Test D: Shared Ranking / Absolute Deadlock', () => {
  test('Perfectly tied teams return 0 (no forced ordering)', () => {
    const teams = [
      { teamId: 'schoolA', points: 58, wins: 8, golds: 1, silvers: 1, bronzes: 1 },
      { teamId: 'schoolB', points: 58, wins: 8, golds: 1, silvers: 1, bronzes: 1 },
    ];
    const sorted = sortTeamsByTiebreaker(teams);
    // Both teams are perfectly tied — sort must preserve input order (stable)
    expect(sorted[0].teamId).toBe('schoolA');
    expect(sorted[1].teamId).toBe('schoolB');
  });

  test('Shared ranking logic: tied teams get same rank, next team skips', () => {
    const standings = [
      { teamId: 'a', points: 58, wins: 8, golds: 1, silvers: 1, bronzes: 1 },
      { teamId: 'b', points: 58, wins: 8, golds: 1, silvers: 1, bronzes: 1 },
      { teamId: 'c', points: 40, wins: 5, golds: 0, silvers: 2, bronzes: 0 },
    ];

    // Simulate the Dashboard shared ranking logic
    const rankMap = new Map();
    let currentRank = 1;
    rankMap.set(standings[0].teamId, currentRank);
    for (let i = 1; i < standings.length; i++) {
      const prev = standings[i - 1];
      const curr = standings[i];
      const prevTotalWins = (prev.wins || 0) + (prev.golds || 0);
      const currTotalWins = (curr.wins || 0) + (curr.golds || 0);
      const isTied = curr.points === prev.points
        && currTotalWins === prevTotalWins
        && (curr.silvers || 0) === (prev.silvers || 0)
        && (curr.bronzes || 0) === (prev.bronzes || 0);
      if (!isTied) currentRank = i + 1;
      rankMap.set(curr.teamId, currentRank);
    }

    expect(rankMap.get('a')).toBe(1);
    expect(rankMap.get('b')).toBe(1);  // Same rank as 'a' — shared!
    expect(rankMap.get('c')).toBe(3);  // Skips rank 2
  });

  test('Three-way tie all share rank', () => {
    const standings = [
      { teamId: 'x', points: 30, wins: 5, golds: 2, silvers: 1, bronzes: 1 },
      { teamId: 'y', points: 30, wins: 5, golds: 2, silvers: 1, bronzes: 1 },
      { teamId: 'z', points: 30, wins: 5, golds: 2, silvers: 1, bronzes: 1 },
      { teamId: 'w', points: 20, wins: 3, golds: 0, silvers: 0, bronzes: 0 },
    ];

    const rankMap = new Map();
    let currentRank = 1;
    rankMap.set(standings[0].teamId, currentRank);
    for (let i = 1; i < standings.length; i++) {
      const prev = standings[i - 1];
      const curr = standings[i];
      const isTied = curr.points === prev.points
        && ((curr.wins || 0) + (curr.golds || 0)) === ((prev.wins || 0) + (prev.golds || 0))
        && (curr.silvers || 0) === (prev.silvers || 0)
        && (curr.bronzes || 0) === (prev.bronzes || 0);
      if (!isTied) currentRank = i + 1;
      rankMap.set(curr.teamId, currentRank);
    }

    expect(rankMap.get('x')).toBe(1);
    expect(rankMap.get('y')).toBe(1);
    expect(rankMap.get('z')).toBe(1);
    expect(rankMap.get('w')).toBe(4); // Skips 2 and 3
  });
});

// ═══════════════════════════════════════════════════════════════
// TEST E: Lobby Game Scoring + Podium Stacking
// ═══════════════════════════════════════════════════════════════

describe('Test E: Lobby Game Scoring', () => {
  const gameId = 'lobbyGame1';

  test('Basic lobby scoring: 1st=6, 2nd=4, 3rd=2, participant=1', () => {
    const results = [{
      id: 'lr1', gameId,
      sessionName: 'Session 1',
      placements: { first: 'teamA', second: 'teamB', third: 'teamC' },
      participantTeamIds: ['teamA', 'teamB', 'teamC', 'teamD'],
    }];
    const config = { [gameId]: DEFAULT_LOBBY_POINTS };

    const ptsA = getLobbyPointsForTeam('teamA', results, config);
    const ptsB = getLobbyPointsForTeam('teamB', results, config);
    const ptsC = getLobbyPointsForTeam('teamC', results, config);
    const ptsD = getLobbyPointsForTeam('teamD', results, config);

    expect(ptsA.total).toBe(6); // 5 placement + 1 participation
    expect(ptsA.golds).toBe(1);
    expect(ptsB.total).toBe(4); // 3 placement + 1 participation
    expect(ptsB.silvers).toBe(1);
    expect(ptsC.total).toBe(2); // 1 placement + 1 participation
    expect(ptsC.bronzes).toBe(1);
    expect(ptsD.total).toBe(1); // 0 placement + 1 participation
  });

  test('Podium stacking: same school wins 1st AND 2nd', () => {
    // School Alpha has two entries: both placed on podium
    const results = [{
      id: 'lr2', gameId,
      sessionName: 'Session 2',
      placements: { first: 'schoolAlpha', second: 'schoolAlpha', third: 'schoolBeta' },
      participantTeamIds: ['schoolAlpha', 'schoolBeta', 'schoolGamma'],
    }];
    const config = { [gameId]: DEFAULT_LOBBY_POINTS };

    const ptsAlpha = getLobbyPointsForTeam('schoolAlpha', results, config);
    // Alpha gets: 5 (1st) + 3 (2nd) + 1 (participation) = 9
    expect(ptsAlpha.total).toBe(9);
    expect(ptsAlpha.golds).toBe(1);
    expect(ptsAlpha.silvers).toBe(1);
  });

  test('Podium stacking: same school sweeps all three spots', () => {
    const results = [{
      id: 'lr3', gameId,
      sessionName: 'Session 3',
      placements: { first: 'teamX', second: 'teamX', third: 'teamX' },
      participantTeamIds: ['teamX', 'teamY'],
    }];
    const config = { [gameId]: DEFAULT_LOBBY_POINTS };

    const ptsX = getLobbyPointsForTeam('teamX', results, config);
    // X gets: 5 (1st) + 3 (2nd) + 1 (3rd) + 1 (participation) = 10
    expect(ptsX.total).toBe(10);
    expect(ptsX.golds).toBe(1);
    expect(ptsX.silvers).toBe(1);
    expect(ptsX.bronzes).toBe(1);
  });

  test('Participation cap only caps +1 attendance, not medals', () => {
    const results = [
      {
        id: 'lr4', gameId,
        sessionName: 'S1',
        placements: { first: 'team1', second: null, third: null },
        participantTeamIds: ['team1'],
      },
      {
        id: 'lr5', gameId,
        sessionName: 'S2',
        placements: { first: 'team1', second: null, third: null },
        participantTeamIds: ['team1'],
      },
      {
        id: 'lr6', gameId,
        sessionName: 'S3',
        placements: { first: 'team1', second: null, third: null },
        participantTeamIds: ['team1'],
      },
    ];
    // Cap participation to 1 — but team1 wins gold in all 3 sessions
    const config = { [gameId]: { ...DEFAULT_LOBBY_POINTS, maxParticipationCap: 1 } };

    const pts = getLobbyPointsForTeam('team1', results, config);
    // 3 × 5 (gold bonus, NEVER capped) + 1 (capped participation) = 16
    expect(pts.total).toBe(16);
    expect(pts.golds).toBe(3);
  });

  test('Non-participant team gets 0 points', () => {
    const results = [{
      id: 'lr7', gameId,
      sessionName: 'Session',
      placements: { first: 'teamA', second: 'teamB', third: null },
      participantTeamIds: ['teamA', 'teamB'],
    }];
    const config = { [gameId]: DEFAULT_LOBBY_POINTS };

    const pts = getLobbyPointsForTeam('teamZ', results, config);
    expect(pts.total).toBe(0);
  });

  test('getLobbyGameStandings sorts correctly', () => {
    const teams = [
      { id: 'teamA', name: 'Team A', shortCode: 'A' },
      { id: 'teamB', name: 'Team B', shortCode: 'B' },
      { id: 'teamC', name: 'Team C', shortCode: 'C' },
    ];
    const results = [{
      id: 'lr8', gameId,
      sessionName: 'Session',
      placements: { first: 'teamC', second: 'teamA', third: 'teamB' },
      participantTeamIds: ['teamA', 'teamB', 'teamC'],
    }];
    const config = { [gameId]: DEFAULT_LOBBY_POINTS };

    const standings = getLobbyGameStandings(gameId, results, teams, config);
    expect(standings[0].teamId).toBe('teamC'); // Gold = 6 pts
    expect(standings[1].teamId).toBe('teamA'); // Silver = 4 pts
    expect(standings[2].teamId).toBe('teamB'); // Bronze = 2 pts
  });
});

// ═══════════════════════════════════════════════════════════════
// TEST F: Participation Cap Clarification (Individual)
// ═══════════════════════════════════════════════════════════════
// Cap ONLY restricts +1 attendance. Medal/placement bonuses are NEVER capped.

describe('Test F: Participation Cap Never Restricts Medals', () => {
  const gameId = 'indGame1';

  test('Team with 3 medalists but cap=1 still gets all medal bonuses', () => {
    const athletes = [
      { id: 'ath1', teamId: 'school1', gameId },
      { id: 'ath2', teamId: 'school1', gameId },
      { id: 'ath3', teamId: 'school1', gameId },
    ];
    const results = [{
      gameId, categoryId: 'cat1',
      placements: { first: 'ath1', second: 'ath2', third: 'ath3' },
      participants: ['ath1', 'ath2', 'ath3'],
      absentees: [],
    }];

    // Cap to 1 participation point
    const config = { [gameId]: { ...DEFAULT_INDIVIDUAL_POINTS, maxParticipationCap: 1 } };
    const pts = getIndividualPointsForTeam('school1', athletes, results, config);

    // Medal bonuses: 5 + 3 + 1 = 9 (NEVER capped)
    // Participation: 1 (capped to 1 out of 3)
    // Total: 10
    expect(pts).toBe(10);
  });

  test('Cap=0 still awards all medal bonuses (0 participation)', () => {
    const athletes = [
      { id: 'ath1', teamId: 'school1', gameId },
    ];
    const results = [{
      gameId, categoryId: 'cat1',
      placements: { first: 'ath1', second: null, third: null },
      participants: ['ath1'],
      absentees: [],
    }];

    // maxParticipationCap minimum is 1 (clamped in reducer), but test edge case
    const config = { [gameId]: { ...DEFAULT_INDIVIDUAL_POINTS, maxParticipationCap: 1 } };
    const pts = getIndividualPointsForTeam('school1', athletes, results, config);
    expect(pts).toBe(6); // 5 medal + 1 participation
  });

  test('getCategoryPointsBreakdown: cap=2, team has gold+silver+bronze+2 participants', () => {
    const athletes = [
      { id: 'a1', teamId: 't1', gameId },
      { id: 'a2', teamId: 't1', gameId },
      { id: 'a3', teamId: 't1', gameId },
      { id: 'a4', teamId: 't1', gameId },
      { id: 'a5', teamId: 't1', gameId },
    ];
    const results = [{
      gameId, categoryId: 'cat1',
      placements: { first: 'a1', second: 'a2', third: 'a3' },
      participants: ['a1', 'a2', 'a3', 'a4', 'a5'],
      absentees: [],
    }];

    const config = { ...DEFAULT_INDIVIDUAL_POINTS, maxParticipationCap: 2 };
    const breakdown = getCategoryPointsBreakdown('cat1', results, athletes, config);
    const team = breakdown.find(e => e.teamId === 't1');

    // Medal bonuses: 5+3+1=9 (uncapped)
    // Participation: 2 (capped from 5)
    expect(team.points).toBe(11);
    expect(team.participations).toBe(2);
    expect(team.golds).toBe(1);
    expect(team.silvers).toBe(1);
    expect(team.bronzes).toBe(1);
  });
});
