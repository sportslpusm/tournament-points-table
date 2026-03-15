export function generateSampleData() {
  const teams = [
    { id: 't1', name: 'Thunder Hawks', shortCode: 'THK', logo: null },
    { id: 't2', name: 'Storm Riders', shortCode: 'STR', logo: null },
    { id: 't3', name: 'Fire Dragons', shortCode: 'FDR', logo: null },
    { id: 't4', name: 'Ice Wolves', shortCode: 'ICW', logo: null },
    { id: 't5', name: 'Shadow Panthers', shortCode: 'SHP', logo: null },
    { id: 't6', name: 'Golden Eagles', shortCode: 'GLE', logo: null },
    { id: 't7', name: 'Silver Sharks', shortCode: 'SVS', logo: null },
    { id: 't8', name: 'Iron Bulls', shortCode: 'IRB', logo: null },
  ];

  const games = [
    { id: 'g1', name: 'Volleyball', emoji: '🏐' },
    { id: 'g2', name: 'Kabaddi', emoji: '🤼' },
    { id: 'g3', name: 'Cricket', emoji: '🏏' },
  ];

  const pools = [
    { id: 'p1', name: 'Pool A', gameId: 'g1', teamIds: ['t1', 't2', 't3', 't4'] },
    { id: 'p2', name: 'Pool B', gameId: 'g1', teamIds: ['t5', 't6', 't7', 't8'] },
    { id: 'p3', name: 'Pool A', gameId: 'g2', teamIds: ['t1', 't3', 't5', 't7'] },
    { id: 'p4', name: 'Pool B', gameId: 'g2', teamIds: ['t2', 't4', 't6', 't8'] },
    { id: 'p5', name: 'Pool A', gameId: 'g3', teamIds: ['t1', 't2', 't5', 't6'] },
    { id: 'p6', name: 'Pool B', gameId: 'g3', teamIds: ['t3', 't4', 't7', 't8'] },
  ];

  const matches = [
    // Volleyball Pool A
    { id: 'm1', poolId: 'p1', teamAId: 't1', teamBId: 't2', status: 'completed', result: 'teamA' },
    { id: 'm2', poolId: 'p1', teamAId: 't3', teamBId: 't4', status: 'completed', result: 'teamB' },
    { id: 'm3', poolId: 'p1', teamAId: 't1', teamBId: 't3', status: 'completed', result: 'draw' },
    { id: 'm4', poolId: 'p1', teamAId: 't2', teamBId: 't4', status: 'completed', result: 'teamA' },
    { id: 'm5', poolId: 'p1', teamAId: 't1', teamBId: 't4', status: 'upcoming', result: null },
    { id: 'm6', poolId: 'p1', teamAId: 't2', teamBId: 't3', status: 'upcoming', result: null },
    // Volleyball Pool B
    { id: 'm7', poolId: 'p2', teamAId: 't5', teamBId: 't6', status: 'completed', result: 'teamA' },
    { id: 'm8', poolId: 'p2', teamAId: 't7', teamBId: 't8', status: 'completed', result: 'teamA' },
    { id: 'm9', poolId: 'p2', teamAId: 't5', teamBId: 't7', status: 'completed', result: 'draw' },
    { id: 'm10', poolId: 'p2', teamAId: 't6', teamBId: 't8', status: 'completed', result: 'bye', absentTeamId: 't8' },
    // Kabaddi Pool A
    { id: 'm11', poolId: 'p3', teamAId: 't1', teamBId: 't3', status: 'completed', result: 'teamA' },
    { id: 'm12', poolId: 'p3', teamAId: 't5', teamBId: 't7', status: 'completed', result: 'teamB' },
    { id: 'm13', poolId: 'p3', teamAId: 't1', teamBId: 't5', status: 'completed', result: 'teamA' },
    { id: 'm14', poolId: 'p3', teamAId: 't3', teamBId: 't7', status: 'upcoming', result: null },
    // Kabaddi Pool B
    { id: 'm15', poolId: 'p4', teamAId: 't2', teamBId: 't4', status: 'completed', result: 'teamA' },
    { id: 'm16', poolId: 'p4', teamAId: 't6', teamBId: 't8', status: 'completed', result: 'draw' },
    { id: 'm17', poolId: 'p4', teamAId: 't2', teamBId: 't6', status: 'upcoming', result: null },
    // Cricket Pool A
    { id: 'm18', poolId: 'p5', teamAId: 't1', teamBId: 't2', status: 'completed', result: 'bye', absentTeamId: 't2' },
    { id: 'm19', poolId: 'p5', teamAId: 't5', teamBId: 't6', status: 'completed', result: 'teamB' },
    { id: 'm20', poolId: 'p5', teamAId: 't1', teamBId: 't5', status: 'upcoming', result: null },
    // Cricket Pool B
    { id: 'm21', poolId: 'p6', teamAId: 't3', teamBId: 't4', status: 'completed', result: 'teamA' },
    { id: 'm22', poolId: 'p6', teamAId: 't7', teamBId: 't8', status: 'completed', result: 'teamA' },
    { id: 'm23', poolId: 'p6', teamAId: 't3', teamBId: 't7', status: 'upcoming', result: null },
  ];

  return {
    tournament: {
      name: 'Champions League 2026',
      logo: null,
      startDate: '2026-03-15',
      endDate: '2026-03-30',
    },
    teams,
    games,
    pools,
    matches,
  };
}
