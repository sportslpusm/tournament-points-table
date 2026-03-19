/**
 * HOTFIX VALIDATION TESTS
 *
 * Test A: Dynamic Participation Spam Cap
 * Test B: Bye = 4 pts (Structural Fairness)
 * Test C: New Master Tiebreaker Protocol
 */

import { getMatchPoints, getTeamStatsForMatches, sortTeamsByTiebreaker, getTeamCombinedStats } from '../points.js';
import { getKnockoutMatchPoints, getTeamKnockoutPoints } from '../knockout.js';
import { getIndividualPointsForTeam, getCategoryPointsBreakdown, DEFAULT_INDIVIDUAL_POINTS } from '../individualPoints.js';

// ═══════════════════════════════════════════════════════════════
// TEST A: The Dynamic Spam Test
// ═══════════════════════════════════════════════════════════════
// Set maxParticipationCap = 2
// School A: 10 athletes, 0 medals → should earn ONLY 2 participation pts (capped)
// School B: 1 athlete, Gold → should earn 6 pts (5 placement + 1 participation)
// School B must rank higher.
// ═══════════════════════════════════════════════════════════════

describe('Test A: Dynamic Participation Spam Cap', () => {
  const gameId = 'game1';
  const categoryId = 'cat1';

  // School A: 10 athletes, all participants, no medals
  const schoolAAthletes = Array.from({ length: 10 }, (_, i) => ({
    id: `a_athlete_${i}`, teamId: 'schoolA', gameId, name: `A-Athlete-${i}`,
  }));

  // School B: 1 athlete, will be placed 1st
  const schoolBAthletes = [
    { id: 'b_athlete_0', teamId: 'schoolB', gameId, name: 'B-Gold-Winner' },
  ];

  const allAthletes = [...schoolAAthletes, ...schoolBAthletes];

  const individualResults = [{
    gameId,
    categoryId,
    placements: { first: 'b_athlete_0', second: null, third: null },
    participants: [
      ...schoolAAthletes.map(a => a.id),
      'b_athlete_0',
    ],
    absentees: [],
  }];

  const configWithCap = {
    [gameId]: {
      ...DEFAULT_INDIVIDUAL_POINTS,
      maxParticipationCap: 2, // ← THE CAP
    },
  };

  test('School A (10 athletes, 0 medals) is capped at 2 participation pts', () => {
    const pts = getIndividualPointsForTeam('schoolA', allAthletes, individualResults, configWithCap);
    expect(pts).toBe(2); // 10 athletes but only 2 participation pts allowed
  });

  test('School B (1 athlete, Gold) earns full 6 pts', () => {
    const pts = getIndividualPointsForTeam('schoolB', allAthletes, individualResults, configWithCap);
    expect(pts).toBe(6); // 5 placement + 1 participation (under cap)
  });

  test('School B ranks higher than School A', () => {
    const ptsA = getIndividualPointsForTeam('schoolA', allAthletes, individualResults, configWithCap);
    const ptsB = getIndividualPointsForTeam('schoolB', allAthletes, individualResults, configWithCap);
    expect(ptsB).toBeGreaterThan(ptsA);
  });

  test('Without cap (Infinity), School A would earn 10 pts — proving the exploit', () => {
    const noCap = { [gameId]: { ...DEFAULT_INDIVIDUAL_POINTS, maxParticipationCap: Infinity } };
    const pts = getIndividualPointsForTeam('schoolA', allAthletes, individualResults, noCap);
    expect(pts).toBe(10); // 10 × 1 participation = 10 (exploit!)
  });

  test('getCategoryPointsBreakdown also respects the cap', () => {
    const config = { ...DEFAULT_INDIVIDUAL_POINTS, maxParticipationCap: 2 };
    const breakdown = getCategoryPointsBreakdown(categoryId, individualResults, allAthletes, config);
    const schoolA = breakdown.find(e => e.teamId === 'schoolA');
    const schoolB = breakdown.find(e => e.teamId === 'schoolB');
    expect(schoolA.points).toBe(2);     // capped: only 2 out of 10 participation
    expect(schoolA.participations).toBe(2);
    expect(schoolB.points).toBe(6);     // 5 (gold) + 1 (participation)
    expect(schoolB.golds).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// TEST B: The Bye Test
// ═══════════════════════════════════════════════════════════════
// A team that advances via Bye must receive 4 points (equal to a win).
// The absent team must receive 0 points.
// ═══════════════════════════════════════════════════════════════

describe('Test B: Bye = 4 Points (Structural Fairness)', () => {
  const byeMatch = {
    id: 'm1', teamAId: 'teamX', teamBId: 'teamY',
    status: 'completed', result: 'bye', absentTeamId: 'teamY',
  };

  const winMatch = {
    id: 'm2', teamAId: 'teamZ', teamBId: 'teamW',
    status: 'completed', result: 'teamA', absentTeamId: null,
  };

  test('Present team in bye gets 4 points via getMatchPoints', () => {
    expect(getMatchPoints(byeMatch, 'teamX')).toBe(4);
  });

  test('Absent team in bye gets 0 points', () => {
    expect(getMatchPoints(byeMatch, 'teamY')).toBe(0);
  });

  test('Bye (4 pts) equals contested win (4 pts)', () => {
    const byePts = getMatchPoints(byeMatch, 'teamX');
    const winPts = getMatchPoints(winMatch, 'teamZ');
    expect(byePts).toBe(winPts);
    expect(byePts).toBe(4);
  });

  test('getTeamStatsForMatches counts bye as a win', () => {
    const stats = getTeamStatsForMatches([byeMatch], 'teamX');
    expect(stats.wins).toBe(1);
    expect(stats.points).toBe(4);
    expect(stats.byes).toBe(1);
  });

  test('Knockout bye also awards 4 pts', () => {
    const koByeMatch = {
      ...byeMatch, round: 'qf', gameId: 'g1',
    };
    const pts = getKnockoutMatchPoints(koByeMatch, 'teamX', { enabled: true, qf: 1, sf: 2, final: 3, third: 1 });
    expect(pts.base).toBe(4);
    expect(pts.bonus).toBe(0); // NO knockout bonus for byes
    expect(pts.total).toBe(4);
  });

  test('Knockout contested win gets bonus, bye does not', () => {
    const contestedWin = {
      id: 'm3', teamAId: 'teamX', teamBId: 'teamZ',
      status: 'completed', result: 'teamA', round: 'qf', gameId: 'g1',
    };
    const koBye = {
      id: 'm4', teamAId: 'teamX', teamBId: 'teamY',
      status: 'completed', result: 'bye', absentTeamId: 'teamY', round: 'qf', gameId: 'g1',
    };
    const bonusCfg = { enabled: true, qf: 1, sf: 2, final: 3, third: 1 };

    const contestedPts = getKnockoutMatchPoints(contestedWin, 'teamX', bonusCfg);
    const byePts = getKnockoutMatchPoints(koBye, 'teamX', bonusCfg);

    expect(contestedPts.total).toBe(5); // 4 base + 1 QF bonus
    expect(byePts.total).toBe(4);       // 4 base + 0 bonus
  });

  test('getTeamCombinedStats handles knockout bye as 4 pts with win count', () => {
    const koMatches = [{
      id: 'km1', teamAId: 'teamX', teamBId: 'teamY', gameId: 'g1',
      status: 'completed', result: 'bye', absentTeamId: 'teamY', round: 'sf',
    }];
    const stats = getTeamCombinedStats([], koMatches, 'teamX', { enabled: true, qf: 1, sf: 2, final: 3, third: 1 });
    expect(stats.points).toBe(4);
    expect(stats.wins).toBe(1);
    expect(stats.knockoutPoints).toBe(4);
  });
});

// ═══════════════════════════════════════════════════════════════
// TEST C: The Tiebreaker Test
// ═══════════════════════════════════════════════════════════════
// Two schools with IDENTICAL total points.
// School X: more Golds (individual 1st places)
// School Y: more total participants but fewer golds
// School X must rank higher (Tiebreaker 2: wins + golds).
// ═══════════════════════════════════════════════════════════════

describe('Test C: New Master Tiebreaker Protocol', () => {
  test('Tier 1: Higher total points wins', () => {
    const teams = [
      { teamId: 'low', points: 40, wins: 10, golds: 5, silvers: 3, bronzes: 2 },
      { teamId: 'high', points: 50, wins: 5, golds: 1, silvers: 0, bronzes: 0 },
    ];
    const sorted = sortTeamsByTiebreaker(teams);
    expect(sorted[0].teamId).toBe('high');
  });

  test('Tier 2: Equal points → more wins+golds wins', () => {
    const teams = [
      { teamId: 'schoolY', teamName: 'Y-Many-Athletes', points: 30, wins: 3, golds: 1, silvers: 5, bronzes: 5 },
      { teamId: 'schoolX', teamName: 'X-More-Golds', points: 30, wins: 3, golds: 4, silvers: 0, bronzes: 0 },
    ];
    const sorted = sortTeamsByTiebreaker(teams);
    expect(sorted[0].teamId).toBe('schoolX'); // 3+4=7 > 3+1=4
  });

  test('Tier 3: Equal points + equal wins+golds → more silvers wins', () => {
    const teams = [
      { teamId: 'fewSilvers', points: 30, wins: 5, golds: 2, silvers: 1, bronzes: 5 },
      { teamId: 'moreSilvers', points: 30, wins: 5, golds: 2, silvers: 4, bronzes: 0 },
    ];
    const sorted = sortTeamsByTiebreaker(teams);
    expect(sorted[0].teamId).toBe('moreSilvers');
  });

  test('Tier 4: Equal through silvers → more bronzes wins', () => {
    const teams = [
      { teamId: 'fewBronzes', points: 30, wins: 5, golds: 2, silvers: 3, bronzes: 1 },
      { teamId: 'moreBronzes', points: 30, wins: 5, golds: 2, silvers: 3, bronzes: 4 },
    ];
    const sorted = sortTeamsByTiebreaker(teams);
    expect(sorted[0].teamId).toBe('moreBronzes');
  });

  test('All tiers equal → stable sort (no alphabetical, no head-to-head)', () => {
    const teams = [
      { teamId: 'alpha', teamName: 'Alpha School', points: 30, wins: 5, golds: 2, silvers: 3, bronzes: 1 },
      { teamId: 'beta', teamName: 'Beta School', points: 30, wins: 5, golds: 2, silvers: 3, bronzes: 1 },
    ];
    const sorted = sortTeamsByTiebreaker(teams);
    // Must NOT sort alphabetically — should remain in original order (stable)
    expect(sorted[0].teamId).toBe('alpha');
    expect(sorted[1].teamId).toBe('beta');
  });

  test('NEVER sorts alphabetically — Z before A when Z has better medals', () => {
    const teams = [
      { teamId: 'aaa', teamName: 'AAA School', points: 30, wins: 5, golds: 1, silvers: 0, bronzes: 0 },
      { teamId: 'zzz', teamName: 'ZZZ School', points: 30, wins: 5, golds: 2, silvers: 0, bronzes: 0 },
    ];
    const sorted = sortTeamsByTiebreaker(teams);
    expect(sorted[0].teamId).toBe('zzz'); // More golds, despite Z > A alphabetically
  });
});
