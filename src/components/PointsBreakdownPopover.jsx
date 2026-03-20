import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTournament } from '../context/TournamentContext';
import {
  getTeamFullBreakdown,
  getKnockoutPointsBreakdown,
  getPoolPointsBreakdown,
  getSpecificMatchesForStat,
  getGamePointsBreakdown,
  getTeamLobbyGameBreakdown,
  getTeamIndividualGameBreakdown,
  getRoundLabel,
  getPlacementEmoji,
  getPlacementLabel,
} from '../utils/breakdownData';

/**
 * Global state for "only one popover open at a time".
 */
let globalCloseCallback = null;

export function closeAllPopovers() {
  if (globalCloseCallback) {
    globalCloseCallback();
    globalCloseCallback = null;
  }
}

/**
 * PointsBreakdownPopover — renders a clickable number that shows a detailed breakdown on click.
 * Uses a React Portal to render the modal at the document root, avoiding all z-index and overflow issues.
 *
 * Props:
 *  - teamId: string
 *  - type: 'total' | 'knockout' | 'pool' | 'game' | 'lobby' | 'individual' | 'wins' | 'losses' | 'draws' | 'byes'
 *  - gameId?: string (for type='game')
 *  - value: number (displayed value)
 *  - label?: string (suffix like 'pts', 'KO', etc.)
 *  - className?: string
 *  - children?: React node (custom display for the clickable element)
 */
export default function PointsBreakdownPopover({ teamId, type, gameId, value, label, className = '', children }) {
  const state = useTournament();
  const { darkMode } = state;
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    if (globalCloseCallback === close) globalCloseCallback = null;
  }, []);

  const handleOpen = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    // Close any other open popover
    closeAllPopovers();
    setOpen(true);
    globalCloseCallback = close;
  }, [close]);

  // Close on escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  // Build breakdown content
  const breakdownContent = open ? getBreakdownContent(type, teamId, gameId, state) : null;

  // Render the modal via Portal so it's always on top of everything
  const modal = open && breakdownContent ? createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center"
      style={{ pointerEvents: 'auto' }}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 transition-opacity duration-200 ${darkMode ? 'bg-black/70' : 'bg-black/50'}`}
        onClick={close}
      />

      {/* Panel */}
      <div
        className={`relative w-full ${
          isMobile
            ? 'max-h-[85vh] rounded-t-2xl animate-slideUp'
            : 'max-w-md max-h-[80vh] rounded-2xl mx-4 animate-scaleIn'
        } overflow-hidden shadow-2xl border flex flex-col ${
          darkMode
            ? 'bg-navy-850 border-white/10 text-white'
            : 'bg-white border-gray-200 text-gray-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle — mobile only */}
        {isMobile && (
          <div className="flex justify-center pt-2 pb-1">
            <div className={`w-10 h-1 rounded-full ${darkMode ? 'bg-white/20' : 'bg-gray-300'}`} />
          </div>
        )}

        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-3 border-b shrink-0 ${
          darkMode ? 'border-white/10' : 'border-gray-200'
        }`}>
          <h3 className="font-bold text-sm truncate pr-2">{breakdownContent.title}</h3>
          <button
            onClick={close}
            className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xl font-light transition-colors ${
              darkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
            }`}
          >
            ×
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto flex-1 p-4">
          {breakdownContent.body}
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <span
        onClick={handleOpen}
        className={`cursor-pointer hover:underline decoration-dotted underline-offset-2 transition-all ${className}`}
        title="Click for points breakdown"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOpen(e); }}
      >
        {children || value}
      </span>
      {modal}
    </>
  );
}

function getBreakdownContent(type, teamId, gameId, state) {
  const { teams, darkMode } = state;
  const team = teams.find(t => t.id === teamId);
  if (!team) return null;

  switch (type) {
    case 'total':
      return getTotalBreakdownContent(teamId, team, state);
    case 'knockout':
      return getKnockoutBreakdownContent(teamId, team, state);
    case 'pool':
      return getPoolBreakdownContent(teamId, team, state);
    case 'lobby':
      return getLobbyBreakdownContent(teamId, team, state);
    case 'individual':
      return getIndividualBreakdownContent(teamId, team, state);
    case 'game':
      return getGameBreakdownContent(teamId, team, gameId, state);
    case 'wins':
    case 'losses':
    case 'draws':
    case 'byes':
      return getStatBreakdownContent(teamId, team, type, state);
    default:
      return null;
  }
}

// ── Total Points Breakdown ──────────────────────────

function getTotalBreakdownContent(teamId, team, state) {
  const breakdown = getTeamFullBreakdown(teamId, state);
  if (!breakdown) return null;
  const { darkMode } = state;

  const body = (
    <div className="space-y-4">
      {breakdown.sections.length === 0 && (
        <p className={`text-sm italic ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>No matches played yet</p>
      )}
      {breakdown.sections.map((section, i) => (
        <GameSection key={i} section={section} darkMode={darkMode} />
      ))}
      {breakdown.sections.length > 0 && (
        <GrandTotal total={breakdown.grandTotal} darkMode={darkMode} />
      )}
    </div>
  );

  return {
    title: `${team.name} — ${breakdown.grandTotal} pts`,
    body,
  };
}

// ── Knockout Breakdown ──────────────────────────────

function getKnockoutBreakdownContent(teamId, team, state) {
  const breakdown = getKnockoutPointsBreakdown(teamId, state);
  const { darkMode } = state;

  const body = (
    <div className="space-y-4">
      {breakdown.sections.map((section, i) => {
        if (!section.hasData && section.stage === 'pool') {
          return (
            <GameHeader key={i} game={section.game} subtitle="Knockout not started" darkMode={darkMode} />
          );
        }
        if (!section.hasData) {
          return (
            <GameHeader key={i} game={section.game} subtitle="No knockout matches" darkMode={darkMode} />
          );
        }
        return (
          <div key={i}>
            <GameHeader game={section.game} subtitle={`Knockout (${section.subtotal} pts)`} darkMode={darkMode} />
            <MatchList matches={section.matchDetails} showBonus darkMode={darkMode} />
            <Subtotal value={section.subtotal} darkMode={darkMode} />
          </div>
        );
      })}
      <GrandTotal total={breakdown.total} label="TOTAL KO POINTS" darkMode={darkMode} />
    </div>
  );

  return {
    title: `${team.name} — Knockout (${breakdown.total} pts)`,
    body,
  };
}

// ── Pool Breakdown ──────────────────────────────────

function getPoolBreakdownContent(teamId, team, state) {
  const breakdown = getPoolPointsBreakdown(teamId, state);
  const { darkMode } = state;

  const body = (
    <div className="space-y-4">
      {breakdown.sections.length === 0 && (
        <p className={`text-sm italic ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>No pool matches played</p>
      )}
      {breakdown.sections.map((section, i) => {
        if (section.type === 'individual') {
          return (
            <div key={i}>
              <GameHeader game={section.game} subtitle={`(${section.subtotal} pts)`} darkMode={darkMode} />
              <p className={`text-xs italic ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Individual sport — see game breakdown</p>
              <Subtotal value={section.subtotal} darkMode={darkMode} />
            </div>
          );
        }
        if (section.type === 'lobby') {
          return (
            <div key={i}>
              <GameHeader game={section.game} subtitle={`Lobby (${section.subtotal} pts)`} darkMode={darkMode} />
              <p className={`text-xs italic ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Lobby game — see game breakdown</p>
              <Subtotal value={section.subtotal} darkMode={darkMode} />
            </div>
          );
        }
        return (
          <div key={i}>
            <GameHeader game={section.game} subtitle={`Pool (${section.subtotal} pts)`} darkMode={darkMode} />
            <MatchList matches={section.matchDetails} darkMode={darkMode} />
            <Subtotal value={section.subtotal} darkMode={darkMode} />
          </div>
        );
      })}
      <GrandTotal total={breakdown.total} label="TOTAL POOL/STAGE POINTS" darkMode={darkMode} />
    </div>
  );

  return {
    title: `${team.name} — Pool Stage (${breakdown.total} pts)`,
    body,
  };
}

// ── Lobby-Only Breakdown ────────────────────────────

function getLobbyBreakdownContent(teamId, team, state) {
  const { games, darkMode } = state;
  const lobbyEntries = Array.isArray(state.lobbyEntries) ? state.lobbyEntries : [];
  const lobbyResults = Array.isArray(state.lobbyResults) ? state.lobbyResults : [];
  const lobbyPointsConfig = state.lobbyPointsConfig || {};
  const lobbyGames = games.filter(g => g.type === 'lobby');

  let grandTotal = 0;
  const sections = [];

  for (const game of lobbyGames) {
    const section = getTeamLobbyGameBreakdown(teamId, game, lobbyEntries, lobbyResults, lobbyPointsConfig, state.teams);
    if (!section || (section.sessions.length === 0 && section.subtotal === 0)) continue;
    grandTotal += section.subtotal;
    sections.push({ type: 'lobby', game, lobby: section, gameTotal: section.subtotal });
  }

  const body = (
    <div className="space-y-4">
      {sections.length === 0 && (
        <p className={`text-sm italic ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>No lobby games played</p>
      )}
      {sections.map((section, i) => (
        <LobbyGameDetailSection key={i} section={section} lobbyEntries={lobbyEntries} darkMode={darkMode} />
      ))}
      {sections.length > 0 && (
        <GrandTotal total={grandTotal} label="TOTAL LOBBY POINTS" darkMode={darkMode} />
      )}
    </div>
  );

  return {
    title: `${team.name} — Lobby Events (${grandTotal} pts)`,
    body,
  };
}

// ── Individual-Only Breakdown ───────────────────────

function getIndividualBreakdownContent(teamId, team, state) {
  const { games, athletes, individualResults, individualPointsConfig, categories, teams, darkMode } = state;
  const indGames = games.filter(g => g.type === 'individual');

  let grandTotal = 0;
  const sections = [];

  for (const game of indGames) {
    const section = getTeamIndividualGameBreakdown(teamId, game, athletes, individualResults, individualPointsConfig, categories, teams);
    if (!section || (section.categories.length === 0 && section.subtotal === 0)) continue;
    grandTotal += section.subtotal;
    sections.push({ type: 'individual', game, individual: section, gameTotal: section.subtotal });
  }

  const body = (
    <div className="space-y-4">
      {sections.length === 0 && (
        <p className={`text-sm italic ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>No individual results</p>
      )}
      {sections.map((section, i) => (
        <GameSection key={i} section={section} darkMode={darkMode} />
      ))}
      {sections.length > 0 && (
        <GrandTotal total={grandTotal} label="TOTAL INDIVIDUAL POINTS" darkMode={darkMode} />
      )}
    </div>
  );

  return {
    title: `${team.name} — Individual Events (${grandTotal} pts)`,
    body,
  };
}

// ── Game-Specific Breakdown ─────────────────────────

function getGameBreakdownContent(teamId, team, gameId, state) {
  const breakdown = getGamePointsBreakdown(teamId, gameId, state);
  if (!breakdown) return null;
  const { darkMode } = state;

  if (breakdown.type === 'lobby') {
    const { sessions, subtotal, config } = breakdown;
    const body = (
      <div className="space-y-3">
        {sessions.length === 0 && (
          <p className={`text-sm italic ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>No sessions recorded</p>
        )}
        {sessions.map((s, i) => (
          <div key={i} className={`flex items-center justify-between text-xs py-1 ${
            i > 0 ? `border-t ${darkMode ? 'border-white/5' : 'border-gray-100'}` : ''
          }`}>
            <span className="flex items-center gap-1 min-w-0">
              <span className="font-medium">{s.sessionName}</span>
              {s.medals.map((m, j) => (
                <span key={j} className={`${
                  m.placement === 'first' ? 'text-gold' : m.placement === 'second' ? 'text-silver' : 'text-bronze'
                }`}>
                  {m.placement === 'first' ? '\u{1F947}' : m.placement === 'second' ? '\u{1F948}' : '\u{1F949}'}
                  {m.entryName ? ` ${m.entryName}` : ''}
                </span>
              ))}
            </span>
            <span className="font-mono font-bold text-accent whitespace-nowrap ml-2">
              {s.sessionTotal}
            </span>
          </div>
        ))}
        <GrandTotal total={subtotal} darkMode={darkMode} />
      </div>
    );
    return {
      title: `${team.name} — ${breakdown.game.emoji} ${breakdown.game.name} (${subtotal} pts)`,
      body,
    };
  }

  if (breakdown.type === 'individual') {
    const { categories, subtotal, config } = breakdown;
    const body = (
      <div className="space-y-3">
        {categories.length === 0 && (
          <p className={`text-sm italic ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Results pending</p>
        )}
        {categories.map((cat, i) => (
          <div key={i}>
            <div className={`text-xs font-bold uppercase tracking-wide mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {cat.category.name}
            </div>
            {cat.athletes.map((a, j) => (
              <div key={j} className={`flex items-center justify-between text-xs py-1 ${j > 0 ? `border-t ${darkMode ? 'border-white/5' : 'border-gray-100'}` : ''}`}>
                <span className="flex items-center gap-1">
                  {getPlacementEmoji(a.placement) && <span>{getPlacementEmoji(a.placement)}</span>}
                  <span className="font-medium">{a.athlete.name}</span>
                  <span className={`${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>({a.athlete.regNumber})</span>
                  <span className={`${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>— {getPlacementLabel(a.placement)}</span>
                </span>
                <span className="font-mono font-bold text-accent whitespace-nowrap">
                  {a.placementBonus > 0
                    ? `${a.placementBonus}+${a.participationPts}=${a.total}`
                    : `${a.total}`
                  }
                </span>
              </div>
            ))}
            <Subtotal value={cat.categoryTotal} label="Category subtotal" small darkMode={darkMode} />
          </div>
        ))}
        <GrandTotal total={subtotal} darkMode={darkMode} />
      </div>
    );
    return {
      title: `${team.name} — ${breakdown.game.emoji} ${breakdown.game.name} (${subtotal} pts)`,
      body,
    };
  }

  // Team game
  const { pool, knockout, total } = breakdown;
  const body = (
    <div className="space-y-3">
      {/* Pool */}
      <div>
        <div className={`text-xs font-bold uppercase tracking-wide mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Pool Stage
        </div>
        {!pool.hasData
          ? <p className={`text-xs italic ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>No pool matches played</p>
          : <MatchList matches={pool.matchDetails} darkMode={darkMode} />
        }
        <Subtotal value={pool.subtotal} label="Pool subtotal" small darkMode={darkMode} />
      </div>

      {/* Knockout */}
      <div>
        <div className={`text-xs font-bold uppercase tracking-wide mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Knockout Stage
        </div>
        {!knockout.hasData
          ? <p className={`text-xs italic ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              {knockout.stage === 'pool' ? 'Knockout stage not started' : 'No knockout matches'}
            </p>
          : <MatchList matches={knockout.matchDetails} showBonus darkMode={darkMode} />
        }
        <Subtotal value={knockout.subtotal} label="Knockout subtotal" small darkMode={darkMode} />
      </div>

      <GrandTotal total={total} darkMode={darkMode} />
    </div>
  );

  return {
    title: `${team.name} — ${breakdown.game.emoji} ${breakdown.game.name} (${total} pts)`,
    body,
  };
}

// ── W/L/D/B Stat Breakdown ──────────────────────────

function getStatBreakdownContent(teamId, team, statType, state) {
  const matchList = getSpecificMatchesForStat(teamId, statType, state);
  const { darkMode } = state;
  const labels = { wins: 'Wins', losses: 'Losses', draws: 'Draws', byes: 'Byes' };

  const body = (
    <div className="space-y-1">
      {matchList.length === 0 && (
        <p className={`text-sm italic ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>No {statType} recorded</p>
      )}
      {matchList.map((m, i) => (
        <div key={i} className={`flex items-center gap-2 text-xs py-1.5 ${i > 0 ? `border-t ${darkMode ? 'border-white/5' : 'border-gray-100'}` : ''}`}>
          {m.game && <span>{m.game.emoji}</span>}
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
            m.isKnockout
              ? 'bg-accent/20 text-accent'
              : darkMode ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-500'
          }`}>
            {m.isKnockout ? (m.roundLabel || 'KO') : 'Pool'}
          </span>
          <span className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>vs</span>
          <span className="font-medium">{m.opponent?.name || m.opponent?.shortCode || 'BYE'}</span>
          {m.isBye && (
            <span className={`text-[10px] ${m.isAbsent ? 'text-loss' : 'text-bye'}`}>
              ({m.isAbsent ? 'Absent' : 'Present'})
            </span>
          )}
        </div>
      ))}
    </div>
  );

  return {
    title: `${team.name} — ${matchList.length} ${labels[statType]}`,
    body,
  };
}

// ── Shared Sub-components ───────────────────────────

function GameSection({ section, darkMode }) {
  if (section.type === 'lobby') {
    const { lobby, game, gameTotal } = section;
    return (
      <div>
        <GameHeader game={game} subtitle={`(${gameTotal} pts)`} darkMode={darkMode} />
        {lobby.sessions.length === 0 ? (
          <p className={`text-xs italic ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>No sessions recorded</p>
        ) : (
          lobby.sessions.map((s, i) => (
            <div key={i} className={`pl-2 py-0.5 ${
              i > 0 ? `border-t ${darkMode ? 'border-white/5' : 'border-gray-50'}` : ''
            }`}>
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium">{s.sessionName}</span>
                <span className="font-mono font-bold text-accent whitespace-nowrap ml-2">{s.sessionTotal}</span>
              </div>
              <div className="pl-2 space-y-0">
                {s.medals.map((m, j) => (
                  <div key={`m-${j}`} className="flex items-center justify-between text-[10px]">
                    <span className="flex items-center gap-1">
                      <span className={
                        m.placement === 'first' ? 'text-gold' : m.placement === 'second' ? 'text-silver' : 'text-bronze'
                      }>
                        {m.placement === 'first' ? '\u{1F947}' : m.placement === 'second' ? '\u{1F948}' : '\u{1F949}'}
                      </span>
                      <span>{m.entryName || 'Entry'}</span>
                    </span>
                    <span className="font-mono text-accent text-[10px]">
                      +{m.placement === 'first' ? (lobby.config?.first || 5) : m.placement === 'second' ? (lobby.config?.second || 3) : (lobby.config?.third || 1)}
                    </span>
                  </div>
                ))}
                {s.participationPts > 0 && (
                  <div className="flex items-center justify-between text-[10px]">
                    <span className={darkMode ? 'text-gray-500' : 'text-gray-400'}>
                      Participation ({s.participationPts}×)
                    </span>
                    <span className="font-mono text-accent text-[10px]">+{s.participationPts}</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <Subtotal value={gameTotal} darkMode={darkMode} />
      </div>
    );
  }

  if (section.type === 'individual') {
    const { individual, game, gameTotal } = section;
    return (
      <div>
        <GameHeader game={game} subtitle={`(${gameTotal} pts)`} darkMode={darkMode} />
        {individual.categories.length === 0 ? (
          <p className={`text-xs italic ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Results pending</p>
        ) : (
          individual.categories.map((cat, i) => (
            <div key={i} className="mb-2">
              <div className={`text-[11px] font-semibold mb-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {cat.category.name}:
              </div>
              {cat.athletes.map((a, j) => (
                <div key={j} className="flex items-center justify-between text-xs pl-2">
                  <span className="flex items-center gap-1">
                    {getPlacementEmoji(a.placement) && <span className="text-xs">{getPlacementEmoji(a.placement)}</span>}
                    <span>{a.athlete.name}</span>
                    <span className={`${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>({a.athlete.regNumber})</span>
                  </span>
                  <span className="font-mono text-accent">
                    {a.placementBonus > 0 ? `${a.placementBonus}+${a.participationPts}=${a.total}` : a.total}
                  </span>
                </div>
              ))}
            </div>
          ))
        )}
        <Subtotal value={gameTotal} darkMode={darkMode} />
      </div>
    );
  }

  // Team game section
  const { game, pool, knockout, gameTotal } = section;
  return (
    <div>
      <GameHeader game={game} subtitle={`(${gameTotal} pts)`} darkMode={darkMode} />
      {pool.hasData && (
        <div className="mb-2">
          <div className={`text-[11px] font-semibold mb-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Pool Stage:</div>
          <MatchList matches={pool.matchDetails} compact darkMode={darkMode} />
        </div>
      )}
      {knockout.hasData && (
        <div className="mb-2">
          <div className={`text-[11px] font-semibold mb-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Knockout:</div>
          <MatchList matches={knockout.matchDetails} showBonus compact darkMode={darkMode} />
        </div>
      )}
      {!pool.hasData && !knockout.hasData && (
        <p className={`text-xs italic ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>No matches played</p>
      )}
      <Subtotal value={gameTotal} darkMode={darkMode} />
    </div>
  );
}

function LobbyGameDetailSection({ section, lobbyEntries, darkMode }) {
  const { game, lobby, gameTotal } = section;
  const gameEntries = lobbyEntries.filter(e => e.gameId === game.id);

  return (
    <div>
      <GameHeader game={game} subtitle={`(${gameTotal} pts)`} darkMode={darkMode} />
      {lobby.sessions.length === 0 ? (
        <p className={`text-xs italic ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>No sessions recorded</p>
      ) : (
        lobby.sessions.map((s, i) => (
          <div key={i} className={`pl-2 py-1 ${
            i > 0 ? `border-t ${darkMode ? 'border-white/5' : 'border-gray-50'}` : ''
          }`}>
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold">{s.sessionName}</span>
              <span className="font-mono font-bold text-accent">{s.sessionTotal}</span>
            </div>
            {/* Per-entry detail */}
            <div className="pl-2 mt-0.5 space-y-0">
              {s.medals.map((m, j) => (
                <div key={`medal-${j}`} className="flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1">
                    <span className={
                      m.placement === 'first' ? 'text-gold' : m.placement === 'second' ? 'text-silver' : 'text-bronze'
                    }>
                      {m.placement === 'first' ? '\u{1F947}' : m.placement === 'second' ? '\u{1F948}' : '\u{1F949}'}
                    </span>
                    <span className="font-medium">{m.entryName || 'Entry'}</span>
                    <span className={darkMode ? 'text-gray-500' : 'text-gray-400'}>
                      — {m.placement === 'first' ? '1st Place' : m.placement === 'second' ? '2nd Place' : '3rd Place'}
                    </span>
                  </span>
                  <span className="font-mono text-accent">
                    +{m.placement === 'first' ? (lobby.config?.first || 5) : m.placement === 'second' ? (lobby.config?.second || 3) : (lobby.config?.third || 1)}
                  </span>
                </div>
              ))}
              {s.participationPts > 0 && (
                <div className="flex items-center justify-between text-[10px]">
                  <span className={darkMode ? 'text-gray-500' : 'text-gray-400'}>
                    Participation ({s.participationPts}× entry)
                  </span>
                  <span className="font-mono text-accent">+{s.participationPts}</span>
                </div>
              )}
            </div>
          </div>
        ))
      )}
      <Subtotal value={gameTotal} darkMode={darkMode} />
    </div>
  );
}

function GameHeader({ game, subtitle, darkMode }) {
  return (
    <div className={`flex items-center gap-2 mb-1.5 pb-1 border-b ${darkMode ? 'border-white/5' : 'border-gray-100'}`}>
      <span className="text-base">{game.emoji}</span>
      <span className="font-bold text-sm">{game.name}</span>
      {subtitle && <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{subtitle}</span>}
    </div>
  );
}

function MatchList({ matches, showBonus = false, compact = false, darkMode }) {
  return (
    <div className="space-y-0">
      {matches.map((m, i) => (
        <div key={i} className={`flex items-center justify-between ${compact ? 'text-[11px] py-0.5 pl-2' : 'text-xs py-1'} ${
          i > 0 ? `border-t ${darkMode ? 'border-white/5' : 'border-gray-50'}` : ''
        }`}>
          <span className="flex items-center gap-1 min-w-0">
            {m.roundLabel && (
              <span className={`shrink-0 text-[10px] px-1 py-0.5 rounded ${
                darkMode ? 'bg-white/5 text-gray-500' : 'bg-gray-100 text-gray-400'
              }`}>{m.roundLabel}</span>
            )}
            <span className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {m.isBye ? '' : 'vs '}
            </span>
            <span className="font-medium truncate">{m.opponent?.name || m.opponent?.shortCode || 'BYE'}</span>
            <span className={`shrink-0 font-semibold ${
              m.result === 'win' ? 'text-win' :
              m.result === 'loss' ? 'text-loss' :
              m.result === 'draw' ? 'text-draw' :
              'text-bye'
            }`}>
              {m.label}
            </span>
          </span>
          <span className="font-mono font-bold text-accent whitespace-nowrap ml-2">
            {m.isBye
              ? `${m.totalPoints}`
              : showBonus && m.bonusPoints > 0
                ? `${m.basePoints}+${m.participationPoints}+${m.bonusPoints}=${m.totalPoints}`
                : `${m.basePoints}+${m.participationPoints}=${m.totalPoints}`
            }
          </span>
        </div>
      ))}
    </div>
  );
}

function Subtotal({ value, label = 'Subtotal', small = false, darkMode }) {
  return (
    <div className={`flex items-center justify-between ${small ? 'mt-1 pt-1' : 'mt-2 pt-2'} border-t ${
      darkMode ? 'border-white/10' : 'border-gray-200'
    }`}>
      <span className={`${small ? 'text-[11px]' : 'text-xs'} font-medium ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{label}</span>
      <span className={`font-mono font-bold text-accent ${small ? 'text-xs' : 'text-sm'}`}>{value} pts</span>
    </div>
  );
}

function GrandTotal({ total, label = 'TOTAL', darkMode }) {
  return (
    <div className={`flex items-center justify-between mt-3 pt-3 border-t-2 ${
      darkMode ? 'border-accent/30' : 'border-accent/20'
    }`}>
      <span className="text-xs font-black tracking-wide">{label}</span>
      <span className="font-mono font-black text-lg text-accent">{total} pts</span>
    </div>
  );
}
