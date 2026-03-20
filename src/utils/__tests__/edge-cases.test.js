/**
 * EDGE CASE TESTS — Code Red Audit
 *
 * Covers: NaN guards, dense ranking, empty arrays, participation dedup,
 * 5-way ties, 0-participant lobby entries, negative config values.
 */

import { safeNum, denseRank, sortTeamsByTiebreaker } from '../points.js';
import { getLobbyPointsForTeam, getLobbyGameStandings, DEFAULT_LOBBY_POINTS } from '../lobbyPoints.js';
import { getIndividualPointsForTeam, getIndividualGameTeamStandings, DEFAULT_INDIVIDUAL_POINTS } from '../individualPoints.js';

// ═══════════════════════════════════════════════════════════════
// safeNum utility
// ═══════════════════════════════════════════════════════════════
describe('safeNum', () => {
  test('returns 0 for NaN', () => expect(safeNum(NaN)).toBe(0));
  test('returns 0 for undefined', () => expect(safeNum(undefined)).toBe(0));
  test('returns 0 for null', () => expect(safeNum(null)).toBe(0));
  test('returns 0 for negative', () => expect(safeNum(-5)).toBe(0));
  test('returns 0 for Infinity', () => expect(safeNum(Infinity)).toBe(0));
  test('returns valid number', () => expect(safeNum(5)).toBe(5));
  test('returns 0 for string', () => expect(safeNum('abc')).toBe(0));
  test('coerces numeric string', () => expect(safeNum('3')).toBe(3));
});

// ═══════════════════════════════════════════════════════════════
// denseRank utility
// ═══════════════════════════════════════════════════════════════
describe('denseRank', () => {
  test('empty array returns empty', () => {
    expect(denseRank([], () => false)).toEqual([]);
  });

  test('no ties: sequential 1,2,3', () => {
    const items = [{ pts: 10 }, { pts: 5 }, { pts: 1 }];
    const ranks = denseRank(items, (a, b) => a.pts === b.pts);
    expect(ranks).toEqual([1, 2, 3]);
  });

  test('2-way tie for 1st: 1,1,2', () => {
    const items = [{ pts: 10 }, { pts: 10 }, { pts: 5 }];
    const ranks = denseRank(items, (a, b) => a.pts === b.pts);
    expect(ranks).toEqual([1, 1, 2]);
  });

  test('3-way tie for 2nd: 1,2,2,2,3', () => {
    const items = [{ pts: 10 }, { pts: 5 }, { pts: 5 }, { pts: 5 }, { pts: 1 }];
    const ranks = denseRank(items, (a, b) => a.pts === b.pts);
    expect(ranks).toEqual([1, 2, 2, 2, 3]);
  });

  test('5-way tie for 1st: all rank 1, next is rank 2', () => {
    const items = [
      { pts: 10 }, { pts: 10 }, { pts: 10 }, { pts: 10 }, { pts: 10 },
      { pts: 3 },
    ];
    const ranks = denseRank(items, (a, b) => a.pts === b.pts);
    expect(ranks).toEqual([1, 1, 1, 1, 1, 2]);
  });
});

// ═══════════════════════════════════════════════════════════════
// 5-way absolute deadlock on master leaderboard
// ═══════════════════════════════════════════════════════════════
describe('5-way absolute deadlock', () => {
  test('sortTeamsByTiebreaker preserves order for 5 identical teams', () => {
    const teams = Array.from({ length: 6 }, (_, i) => ({
      teamId: `team${i}`,
      points: i < 5 ? 20 : 5,
      wins: i < 5 ? 3 : 1,
      golds: i < 5 ? 1 : 0,
      silvers: i < 5 ? 1 : 0,
      bronzes: i < 5 ? 1 : 0,
    }));
    const sorted = sortTeamsByTiebreaker(teams);
    // First 5 should all be tied (same order preserved), 6th is last
    expect(sorted[5].teamId).toBe('team5');
    // All 5 tied teams have same stats
    for (let i = 0; i < 5; i++) {
      expect(sorted[i].points).toBe(20);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Lobby: 0-participant edge case
// ═══════════════════════════════════════════════════════════════
describe('Lobby: 0-participant school', () => {
  const teams = [
    { id: 'schoolA', name: 'School A', shortCode: 'A' },
    { id: 'schoolB', name: 'School B', shortCode: 'B' },
  ];
  const entries = [
    { id: 'e1', gameId: 'g1', teamId: 'schoolA', entryName: 'Alpha' },
    { id: 'e2', gameId: 'g1', teamId: 'schoolA', entryName: 'Beta' },
    // schoolB has 0 entries
  ];
  const results = [{
    id: 'r1', gameId: 'g1', sessionName: 'Round 1',
    placements: { first: 'e1', second: 'e2', third: null },
    participantEntryIds: ['e1', 'e2'],
  }];
  const config = { g1: DEFAULT_LOBBY_POINTS };

  test('School with 0 entries gets 0 points, no crash', () => {
    const pts = getLobbyPointsForTeam('schoolB', results, entries, config);
    expect(pts.total).toBe(0);
    expect(pts.golds).toBe(0);
    expect(Number.isFinite(pts.total)).toBe(true);
  });

  test('School with entries gets correct points', () => {
    const pts = getLobbyPointsForTeam('schoolA', results, entries, config);
    // e1: 5 (1st) + 1 (participation) = 6
    // e2: 3 (2nd) + 1 (participation) = 4
    expect(pts.total).toBe(10);
    expect(pts.golds).toBe(1);
    expect(pts.silvers).toBe(1);
  });

  test('Standings only include schools with entries, no crash', () => {
    const standings = getLobbyGameStandings('g1', results, entries, teams, config);
    expect(standings.length).toBe(1); // only schoolA
    expect(standings[0].teamId).toBe('schoolA');
    expect(standings[0].rank).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// Lobby: participation deduplication
// ═══════════════════════════════════════════════════════════════
describe('Lobby: participation dedup', () => {
  test('duplicate entry in participantEntryIds only counts once', () => {
    const entries = [
      { id: 'e1', gameId: 'g1', teamId: 'schoolA', entryName: 'Alpha' },
    ];
    const results = [{
      id: 'r1', gameId: 'g1', sessionName: 'R1',
      placements: { first: null, second: null, third: null },
      participantEntryIds: ['e1', 'e1', 'e1'], // triple duplicate
    }];
    const config = { g1: DEFAULT_LOBBY_POINTS };
    const pts = getLobbyPointsForTeam('schoolA', results, entries, config);
    expect(pts.total).toBe(1); // only 1 participation point, not 3
  });
});

// ═══════════════════════════════════════════════════════════════
// Lobby: NaN config values
// ═══════════════════════════════════════════════════════════════
describe('Lobby: NaN/bad config guard', () => {
  test('NaN config values treated as 0', () => {
    const entries = [{ id: 'e1', gameId: 'g1', teamId: 'schoolA' }];
    const results = [{
      id: 'r1', gameId: 'g1', sessionName: 'R1',
      placements: { first: 'e1', second: null, third: null },
      participantEntryIds: ['e1'],
    }];
    const config = { g1: { first: NaN, second: undefined, third: -5, participation: null, maxParticipationCap: Infinity } };
    const pts = getLobbyPointsForTeam('schoolA', results, entries, config);
    expect(Number.isFinite(pts.total)).toBe(true);
    expect(pts.total).toBe(0); // all config values sanitized to 0
    expect(pts.golds).toBe(1); // medal count still tracked
  });
});

// ═══════════════════════════════════════════════════════════════
// Lobby: dense ranking with ties
// ═══════════════════════════════════════════════════════════════
describe('Lobby standings: dense ranking', () => {
  test('2 teams tied for 1st both get rank 1', () => {
    const teams = [
      { id: 'A', name: 'A', shortCode: 'A' },
      { id: 'B', name: 'B', shortCode: 'B' },
      { id: 'C', name: 'C', shortCode: 'C' },
    ];
    const entries = [
      { id: 'eA', gameId: 'g1', teamId: 'A' },
      { id: 'eB', gameId: 'g1', teamId: 'B' },
      { id: 'eC', gameId: 'g1', teamId: 'C' },
    ];
    // Session 1: A wins, B 2nd
    // Session 2: B wins, A 2nd
    // Both A and B get 5+3=8 placement, same golds/silvers
    const results = [
      { id: 'r1', gameId: 'g1', sessionName: 'S1', placements: { first: 'eA', second: 'eB', third: 'eC' }, participantEntryIds: ['eA', 'eB', 'eC'] },
      { id: 'r2', gameId: 'g1', sessionName: 'S2', placements: { first: 'eB', second: 'eA', third: 'eC' }, participantEntryIds: ['eA', 'eB', 'eC'] },
    ];
    const config = { g1: DEFAULT_LOBBY_POINTS };
    const standings = getLobbyGameStandings('g1', results, entries, teams, config);
    expect(standings[0].rank).toBe(1);
    expect(standings[1].rank).toBe(1); // tied
    expect(standings[2].rank).toBe(2); // dense rank (not 3)
  });
});

// ═══════════════════════════════════════════════════════════════
// Individual: dense ranking with ties
// ═══════════════════════════════════════════════════════════════
describe('Individual standings: dense ranking', () => {
  test('tied teams share rank', () => {
    const teams = [
      { id: 'A', name: 'A', shortCode: 'A' },
      { id: 'B', name: 'B', shortCode: 'B' },
      { id: 'C', name: 'C', shortCode: 'C' },
    ];
    const athletes = [
      { id: 'a1', gameId: 'g1', teamId: 'A', name: 'A1' },
      { id: 'a2', gameId: 'g1', teamId: 'B', name: 'B1' },
      { id: 'a3', gameId: 'g1', teamId: 'C', name: 'C1' },
    ];
    const categories = [
      { id: 'c1', gameId: 'g1', name: 'Cat1', athleteIds: ['a1', 'a2', 'a3'] },
      { id: 'c2', gameId: 'g1', name: 'Cat2', athleteIds: ['a1', 'a2', 'a3'] },
    ];
    // Cat1: A wins, B 2nd. Cat2: B wins, A 2nd. C participates in both.
    const results = [
      { id: 'r1', gameId: 'g1', categoryId: 'c1', placements: { first: 'a1', second: 'a2', third: null }, participants: ['a1', 'a2', 'a3'], absentees: [] },
      { id: 'r2', gameId: 'g1', categoryId: 'c2', placements: { first: 'a2', second: 'a1', third: null }, participants: ['a1', 'a2', 'a3'], absentees: [] },
    ];
    const standings = getIndividualGameTeamStandings('g1', athletes, categories, results, teams, DEFAULT_INDIVIDUAL_POINTS);
    // A: gold + silver + 2 participation = 5+3+2 = 10. Golds=1, Silvers=1
    // B: gold + silver + 2 participation = 5+3+2 = 10. Golds=1, Silvers=1
    // A and B are tied
    expect(standings[0].rank).toBe(1);
    expect(standings[1].rank).toBe(1);
    expect(standings[2].rank).toBe(2); // dense
  });
});

// ═══════════════════════════════════════════════════════════════
// Empty/null input safety
// ═══════════════════════════════════════════════════════════════
describe('Empty input safety', () => {
  test('getLobbyPointsForTeam with empty arrays', () => {
    const pts = getLobbyPointsForTeam('t1', [], [], {});
    expect(pts.total).toBe(0);
    expect(Number.isFinite(pts.total)).toBe(true);
  });

  test('getLobbyPointsForTeam with null entries', () => {
    const pts = getLobbyPointsForTeam('t1', [], null, {});
    expect(pts.total).toBe(0);
  });

  test('getLobbyGameStandings with no results', () => {
    const standings = getLobbyGameStandings('g1', [], [], [], {});
    expect(standings).toEqual([]);
  });

  test('getIndividualPointsForTeam with empty arrays', () => {
    const pts = getIndividualPointsForTeam('t1', [], [], {});
    expect(pts).toBe(0);
  });
});
