import { useState, useEffect } from 'react';
import { useTournament } from '../context/TournamentContext';
import { DEFAULT_INDIVIDUAL_POINTS } from '../utils/individualPoints';

const SESSION_KEY = 'points_explainer_open';

/**
 * PointsExplainer — "How Points Work" expandable panel.
 *
 * Props:
 *  - filterType: 'all' | 'team' | 'individual' (default: 'all')
 *  - gameId?: string (when filterType='individual', show that game's config)
 */
export default function PointsExplainer({ filterType = 'all', gameId = null }) {
  const state = useTournament();
  const { darkMode, knockoutConfig, individualPointsConfig, games } = state;

  const [isOpen, setIsOpen] = useState(() => {
    try { return sessionStorage.getItem(SESSION_KEY) === 'true'; } catch { return false; }
  });

  useEffect(() => {
    try { sessionStorage.setItem(SESSION_KEY, isOpen ? 'true' : 'false'); } catch {}
  }, [isOpen]);

  // Dynamic point values from config
  const winPts = 3;
  const lossPts = 0;
  const drawPts = 1;
  const participationPts = 1;
  const byePresentPts = 2;

  // Gather all unique knockout bonus configs
  const teamGames = games.filter(g => g.type !== 'individual');
  const individualGames = games.filter(g => g.type === 'individual');

  // For per-game explainer
  const specificGame = gameId ? games.find(g => g.id === gameId) : null;
  const specificConfig = gameId ? (individualPointsConfig[gameId] || DEFAULT_INDIVIDUAL_POINTS) : null;
  const specificKoConfig = gameId ? knockoutConfig[gameId] : null;

  const showTeam = filterType === 'all' || filterType === 'team';
  const showIndividual = filterType === 'all' || filterType === 'individual';

  const cardCls = `rounded-xl border transition-all ${
    darkMode
      ? 'bg-navy-800/60 backdrop-blur border-white/5'
      : 'bg-white/80 backdrop-blur border-gray-200'
  }`;

  const thCls = `px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider ${
    darkMode ? 'text-gray-500' : 'text-gray-400'
  }`;

  const tdCls = `px-3 py-1.5 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`;
  const tdMonoCls = `px-3 py-1.5 text-sm font-mono font-bold text-accent`;

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
          isOpen
            ? 'bg-accent/15 text-accent border border-accent/30'
            : darkMode
              ? 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300 border border-white/5'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-600 border border-gray-200'
        }`}
      >
        <span className="text-base">ℹ️</span>
        <span>How Points Work</span>
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className={`mt-3 ${cardCls} overflow-hidden animate-slideUp`}>
          <div className="p-4 space-y-5">

            {/* ── SECTION A: Team Games ── */}
            {showTeam && (
              <div>
                <h4 className={`flex items-center gap-2 text-xs font-black uppercase tracking-wider mb-3 ${
                  darkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  <span className="w-5 h-0.5 bg-accent rounded" />
                  Team Game Scoring
                </h4>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className={darkMode ? 'bg-white/[0.02]' : 'bg-gray-50/50'}>
                        <th className={thCls}>Result</th>
                        <th className={thCls}>Points Earned</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'Win', detail: `${winPts} pts + ${participationPts} participation = ${winPts + participationPts} total`, color: 'text-win' },
                        { label: 'Loss', detail: `${lossPts} pts + ${participationPts} participation = ${lossPts + participationPts} total`, color: 'text-loss' },
                        { label: 'Draw', detail: `${drawPts} pt + ${participationPts} participation = ${drawPts + participationPts} total`, color: 'text-draw' },
                        { label: 'Bye (present)', detail: `${byePresentPts} pts (no participation added)`, color: 'text-bye' },
                        { label: 'Bye (absent)', detail: `0 pts (not present = no points)`, color: darkMode ? 'text-gray-500' : 'text-gray-400' },
                      ].map((row, i) => (
                        <tr key={i} className={`border-t ${darkMode ? 'border-white/5' : 'border-gray-100'}`}>
                          <td className={tdCls}>
                            <span className={`font-semibold ${row.color}`}>{row.label}</span>
                          </td>
                          <td className={tdCls}>{row.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Knockout Bonuses */}
                {filterType === 'team' && specificKoConfig?.bonusPoints?.enabled ? (
                  <div className="mt-3">
                    <div className={`text-[11px] font-bold uppercase tracking-wider mb-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      Knockout Bonus Points
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { label: 'QF Win', value: specificKoConfig.bonusPoints.qf || 0 },
                        { label: 'SF Win', value: specificKoConfig.bonusPoints.sf || 0 },
                        { label: 'Final Win', value: specificKoConfig.bonusPoints.final || 0 },
                        { label: '3rd Place Win', value: specificKoConfig.bonusPoints.third || 0 },
                      ].map((b, i) => (
                        <div key={i} className={`px-3 py-2 rounded-lg text-center ${darkMode ? 'bg-white/5' : 'bg-gray-50'}`}>
                          <div className="font-mono font-bold text-accent text-lg">+{b.value}</div>
                          <div className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{b.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : filterType !== 'individual' && teamGames.length > 0 && (
                  <div className="mt-3">
                    <div className={`text-[11px] font-bold uppercase tracking-wider mb-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      Knockout Bonus Points
                    </div>
                    {teamGames.map(g => {
                      const cfg = knockoutConfig[g.id];
                      if (!cfg?.bonusPoints?.enabled) return null;
                      const bp = cfg.bonusPoints;
                      return (
                        <div key={g.id} className="mb-2">
                          <div className={`text-xs font-medium mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            {g.emoji} {g.name}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {[
                              { label: 'QF Win', value: bp.qf || 0 },
                              { label: 'SF Win', value: bp.sf || 0 },
                              { label: 'Final Win', value: bp.final || 0 },
                              { label: '3rd Place Win', value: bp.third || 0 },
                            ].map((b, i) => (
                              <div key={i} className={`px-2 py-1.5 rounded-lg text-center ${darkMode ? 'bg-white/5' : 'bg-gray-50'}`}>
                                <div className="font-mono font-bold text-accent">+{b.value}</div>
                                <div className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{b.label}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {!teamGames.some(g => knockoutConfig[g.id]?.bonusPoints?.enabled) && (
                      <p className={`text-xs italic ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>No knockout bonuses configured</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── SECTION B: Individual Games ── */}
            {showIndividual && (
              <div>
                <h4 className={`flex items-center gap-2 text-xs font-black uppercase tracking-wider mb-3 ${
                  darkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  <span className="w-5 h-0.5 bg-purple-500 rounded" />
                  Individual Sport Scoring
                </h4>

                {filterType === 'individual' && specificConfig ? (
                  <IndividualTable config={specificConfig} thCls={thCls} tdCls={tdCls} darkMode={darkMode} />
                ) : (
                  <>
                    {individualGames.length === 0 ? (
                      <p className={`text-xs italic ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>No individual games configured</p>
                    ) : individualGames.length === 1 ? (
                      <IndividualTable
                        config={individualPointsConfig[individualGames[0].id] || DEFAULT_INDIVIDUAL_POINTS}
                        thCls={thCls} tdCls={tdCls} darkMode={darkMode}
                      />
                    ) : (
                      individualGames.map(g => {
                        const cfg = individualPointsConfig[g.id] || DEFAULT_INDIVIDUAL_POINTS;
                        return (
                          <div key={g.id} className="mb-3">
                            <div className={`text-xs font-medium mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              {g.emoji} {g.name}
                            </div>
                            <IndividualTable config={cfg} thCls={thCls} tdCls={tdCls} darkMode={darkMode} />
                          </div>
                        );
                      })
                    )}
                  </>
                )}

                <p className={`text-[11px] mt-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  Note: Each athlete earns points for their school. Multiple athletes from the same school = points stack.
                </p>
              </div>
            )}

            {/* ── SECTION C: Overall Rules ── */}
            {filterType === 'all' && (
              <div>
                <h4 className={`flex items-center gap-2 text-xs font-black uppercase tracking-wider mb-2 ${
                  darkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  <span className="w-5 h-0.5 bg-gold rounded" />
                  How the Leaderboard Works
                </h4>
                <div className={`text-xs leading-relaxed space-y-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  <p>A team's total tournament points = sum of ALL points earned across ALL games (team games + individual games).</p>
                  <p><span className="font-semibold text-accent">Tiebreaker:</span> Most wins → Head-to-head → Alphabetical</p>
                  <p>Teams competing in more games have more opportunities to earn points.</p>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}

function IndividualTable({ config, thCls, tdCls, darkMode }) {
  const p = config.participation;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className={darkMode ? 'bg-white/[0.02]' : 'bg-gray-50/50'}>
            <th className={thCls}>Placement</th>
            <th className={thCls}>Points to Team</th>
          </tr>
        </thead>
        <tbody>
          {[
            { label: '🥇 1st Place', detail: `${config.first} pts + ${p} participation = ${config.first + p} total`, color: 'text-gold' },
            { label: '🥈 2nd Place', detail: `${config.second} pts + ${p} participation = ${config.second + p} total`, color: 'text-silver' },
            { label: '🥉 3rd Place', detail: `${config.third} pts + ${p} participation = ${config.third + p} total`, color: 'text-bronze' },
            { label: 'Participated', detail: `0 pts + ${p} participation = ${p} total`, color: darkMode ? 'text-gray-300' : 'text-gray-600' },
            { label: 'Absent / DNS', detail: `0 pts (not present = no points)`, color: darkMode ? 'text-gray-500' : 'text-gray-400' },
          ].map((row, i) => (
            <tr key={i} className={`border-t ${darkMode ? 'border-white/5' : 'border-gray-100'}`}>
              <td className={tdCls}><span className={`font-semibold ${row.color}`}>{row.label}</span></td>
              <td className={tdCls}>{row.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * TableLegend — tiny footer below tables explaining column abbreviations.
 *
 * Props:
 *  - type: 'team' | 'individual' | 'master'
 */
export function TableLegend({ type = 'master' }) {
  const { darkMode } = useTournament();
  const cls = `text-[10px] mt-2 px-2 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`;

  if (type === 'individual') {
    return <div className={cls}>🥇=Gold 🥈=Silver 🥉=Bronze P=Participation Pts=Total Points</div>;
  }

  if (type === 'team') {
    return <div className={cls}>P=Played W=Win L=Loss D=Draw B=Bye Pts=Total Points</div>;
  }

  // Master
  return (
    <div className={cls}>
      GP=Games Played W=Win L=Loss D=Draw B=Bye PTS=Total Points • KO=Knockout bonus • Ind=Individual game points • Click any number for breakdown
    </div>
  );
}
