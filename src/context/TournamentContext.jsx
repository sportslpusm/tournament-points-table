import { createContext, useContext, useReducer, useCallback, useRef, useEffect, useState } from 'react';
import { sanitizeString, LIMITS } from '../utils/validation';
import { loadTournamentData, debouncedSave, forceSave, subscribeToChanges, hasPendingSave } from '../utils/database';

const TournamentContext = createContext(null);
const DispatchContext = createContext(null);

const initialState = {
  tournament: {
    name: 'My Tournament',
    logo: null,
    startDate: '',
    endDate: '',
  },
  teams: [],
  games: [],
  pools: [],
  matches: [],
  // Knockout stage data per game
  knockoutConfig: {},
  knockoutMatches: [],
  qualifiedTeams: {},
  // Individual game data
  athletes: [],
  categories: [],
  individualResults: [],
  individualPointsConfig: {},
  // Lobby game data
  lobbyEntries: [],
  lobbyResults: [],
  lobbyPointsConfig: {},
  darkMode: true,
  currentView: 'dashboard',
  selectedGameId: null,
  toasts: [],
};

let idCounter = Date.now();
function genId(prefix = '') {
  return prefix + (++idCounter).toString(36);
}

// Actions that are ALWAYS allowed (no admin needed)
const SAFE_ACTIONS = new Set([
  'SET_VIEW', 'SELECT_GAME', 'TOGGLE_DARK_MODE',
  'ADD_TOAST', 'REMOVE_TOAST',
]);

// Actions that require admin
const ADMIN_ACTIONS = new Set([
  'SET_TOURNAMENT',
  'ADD_TEAM', 'UPDATE_TEAM', 'DELETE_TEAM',
  'ADD_GAME', 'UPDATE_GAME', 'DELETE_GAME',
  'ADD_POOL', 'UPDATE_POOL', 'DELETE_POOL',
  'ASSIGN_TEAM_TO_POOL', 'REMOVE_TEAM_FROM_POOL',
  'ADD_MATCH', 'UPDATE_MATCH', 'DELETE_MATCH',
  'UPDATE_KNOCKOUT_CONFIG',
  'SET_KNOCKOUT_MATCHES', 'UPDATE_KNOCKOUT_MATCH', 'DELETE_KNOCKOUT_MATCH',
  'SET_QUALIFIED_TEAMS',
  'ADVANCE_TO_KNOCKOUT', 'COMPLETE_GAME', 'RESET_TO_POOL',
  'ADD_ATHLETE', 'UPDATE_ATHLETE', 'DELETE_ATHLETE',
  'ADD_CATEGORY', 'UPDATE_CATEGORY', 'DELETE_CATEGORY',
  'SET_INDIVIDUAL_RESULT', 'UPDATE_INDIVIDUAL_POINTS_CONFIG',
  'ADD_LOBBY_ENTRY', 'UPDATE_LOBBY_ENTRY', 'DELETE_LOBBY_ENTRY',
  'ADD_LOBBY_RESULT', 'UPDATE_LOBBY_RESULT', 'DELETE_LOBBY_RESULT', 'UPDATE_LOBBY_POINTS_CONFIG',
  'IMPORT_DATA', 'LOAD_SAMPLE', 'RESET_DATA',
]);

// Actions that should NOT trigger a save (transient UI state)
const NO_SAVE_ACTIONS = new Set([
  'SET_VIEW', 'SELECT_GAME', 'TOGGLE_DARK_MODE',
  'ADD_TOAST', 'REMOVE_TOAST',
  '_SYNC_FROM_FIRESTORE',
]);

// Helper: shift placements when an athlete is removed (2nd→1st, 3rd→2nd)
function shiftPlacementsHelper(placements, deletedId) {
  let { first, second, third } = placements || {};
  if (first === deletedId) { first = second; second = third; third = null; }
  else if (second === deletedId) { second = third; third = null; }
  else if (third === deletedId) { third = null; }
  return { first: first || null, second: second || null, third: third || null };
}

function tournamentReducer(state, action) {
  switch (action.type) {
    // ── Firestore sync (internal) — validate incoming data ──
    case '_SYNC_FROM_FIRESTORE': {
      const incoming = action.payload;
      if (!incoming || typeof incoming !== 'object') return state;
      // Validate arrays and enforce size limits
      const safeArr = (val, limit) => Array.isArray(val) ? val.slice(0, limit) : undefined;
      const safeObj = (val) => (val && typeof val === 'object' && !Array.isArray(val)) ? val : undefined;
      const safeTournament = safeObj(incoming.tournament)
        ? { ...incoming.tournament, name: sanitizeString(incoming.tournament.name || '', LIMITS.MAX_TOURNAMENT_NAME_LENGTH) }
        : undefined;
      return {
        ...state,
        tournament: safeTournament || state.tournament,
        teams: safeArr(incoming.teams, LIMITS.MAX_TEAMS) || state.teams,
        games: safeArr(incoming.games, LIMITS.MAX_GAMES) || state.games,
        pools: safeArr(incoming.pools, LIMITS.MAX_POOLS) || state.pools,
        matches: safeArr(incoming.matches, LIMITS.MAX_MATCHES) || state.matches,
        knockoutConfig: safeObj(incoming.knockoutConfig) || state.knockoutConfig,
        knockoutMatches: safeArr(incoming.knockoutMatches, LIMITS.MAX_KNOCKOUT_MATCHES) || state.knockoutMatches,
        qualifiedTeams: safeObj(incoming.qualifiedTeams) || state.qualifiedTeams,
        athletes: safeArr(incoming.athletes, LIMITS.MAX_ATHLETES) || state.athletes,
        categories: safeArr(incoming.categories, LIMITS.MAX_CATEGORIES) || state.categories,
        individualResults: safeArr(incoming.individualResults, LIMITS.MAX_INDIVIDUAL_RESULTS) || state.individualResults,
        individualPointsConfig: safeObj(incoming.individualPointsConfig) || state.individualPointsConfig,
        lobbyEntries: safeArr(incoming.lobbyEntries, LIMITS.MAX_ATHLETES) || state.lobbyEntries,
        lobbyResults: safeArr(incoming.lobbyResults, LIMITS.MAX_INDIVIDUAL_RESULTS) || state.lobbyResults,
        lobbyPointsConfig: safeObj(incoming.lobbyPointsConfig) || state.lobbyPointsConfig,
      };
    }

    // Tournament
    case 'SET_TOURNAMENT': {
      const tp = action.payload;
      const sanitizedTournament = {
        ...tp,
        ...(tp.name != null && { name: sanitizeString(tp.name, LIMITS.MAX_TOURNAMENT_NAME_LENGTH) }),
      };
      return { ...state, tournament: { ...state.tournament, ...sanitizedTournament } };
    }

    // Navigation
    case 'SET_VIEW':
      return { ...state, currentView: action.payload.view, selectedGameId: action.payload.gameId || state.selectedGameId };
    case 'SELECT_GAME':
      return { ...state, selectedGameId: action.payload, currentView: 'game' };

    // Teams
    case 'ADD_TEAM': {
      const p = action.payload;
      const newTeam = {
        id: genId('t'),
        ...p,
        name: sanitizeString(p.name, LIMITS.MAX_NAME_LENGTH),
        shortCode: sanitizeString(p.shortCode, LIMITS.MAX_SHORT_CODE_LENGTH),
      };
      return { ...state, teams: [...state.teams, newTeam] };
    }
    case 'UPDATE_TEAM': {
      const up = action.payload;
      const sanitized = {
        ...up,
        ...(up.name != null && { name: sanitizeString(up.name, LIMITS.MAX_NAME_LENGTH) }),
        ...(up.shortCode != null && { shortCode: sanitizeString(up.shortCode, LIMITS.MAX_SHORT_CODE_LENGTH) }),
      };
      return {
        ...state,
        teams: state.teams.map(t => t.id === sanitized.id ? { ...t, ...sanitized } : t),
      };
    }
    case 'DELETE_TEAM': {
      const teamId = action.payload;
      // Find athletes belonging to this team for cascade
      const teamAthleteIds = new Set(state.athletes.filter(a => a.teamId === teamId).map(a => a.id));
      // Shift placements for any deleted athletes
      let updatedResults = state.individualResults;
      if (teamAthleteIds.size > 0) {
        updatedResults = updatedResults.map(r => {
          let changed = false;
          let placements = { ...r.placements };
          for (const aid of teamAthleteIds) {
            if (placements.first === aid || placements.second === aid || placements.third === aid) {
              placements = shiftPlacementsHelper(placements, aid);
              changed = true;
            }
          }
          if (!changed) return r;
          return {
            ...r,
            placements,
            participants: (r.participants || []).filter(id => !teamAthleteIds.has(id)),
            absentees: (r.absentees || []).filter(id => !teamAthleteIds.has(id)),
          };
        });
      }
      // Cascade lobby entries belonging to this team
      const deletedEntryIds = new Set(state.lobbyEntries.filter(e => e.teamId === teamId).map(e => e.id));
      const updatedLobbyResults = deletedEntryIds.size > 0
        ? state.lobbyResults.map(r => {
            const hasEntry = (r.participantEntryIds || []).some(id => deletedEntryIds.has(id));
            const p = r.placements || {};
            const hasPlacement = deletedEntryIds.has(p.first) || deletedEntryIds.has(p.second) || deletedEntryIds.has(p.third);
            if (!hasEntry && !hasPlacement) return r;
            let placements = { ...p };
            for (const eid of deletedEntryIds) {
              if (placements.first === eid || placements.second === eid || placements.third === eid) {
                placements = shiftPlacementsHelper(placements, eid);
              }
            }
            return { ...r, participantEntryIds: (r.participantEntryIds || []).filter(id => !deletedEntryIds.has(id)), placements };
          })
        : state.lobbyResults;
      return {
        ...state,
        teams: state.teams.filter(t => t.id !== teamId),
        pools: state.pools.map(p => ({
          ...p,
          teamIds: p.teamIds.filter(id => id !== teamId),
        })),
        matches: state.matches.filter(m => m.teamAId !== teamId && m.teamBId !== teamId),
        knockoutMatches: state.knockoutMatches.filter(m => m.teamAId !== teamId && m.teamBId !== teamId),
        athletes: state.athletes.filter(a => a.teamId !== teamId),
        categories: state.categories.map(c => ({
          ...c,
          athleteIds: c.athleteIds.filter(id => !teamAthleteIds.has(id)),
        })),
        individualResults: updatedResults,
        lobbyEntries: state.lobbyEntries.filter(e => e.teamId !== teamId),
        lobbyResults: updatedLobbyResults,
      };
    }

    // Games
    case 'ADD_GAME': {
      const gp = action.payload;
      // Sanitize emoji: allow only first grapheme, max 4 chars (emoji + variation selector)
      const safeEmoji = typeof gp.emoji === 'string' ? gp.emoji.slice(0, 4) : '🎮';
      const newGame = { id: genId('g'), name: sanitizeString(gp.name, LIMITS.MAX_NAME_LENGTH), emoji: safeEmoji, type: gp.type || 'team' };
      if (newGame.type === 'individual') {
        return {
          ...state,
          games: [...state.games, newGame],
          individualPointsConfig: {
            ...state.individualPointsConfig,
            [newGame.id]: { first: 5, second: 3, third: 1, participation: 1 },
          },
        };
      }
      return {
        ...state,
        games: [...state.games, newGame],
        knockoutConfig: {
          ...state.knockoutConfig,
          [newGame.id]: {
            enabled: true,
            qualifyCount: 2,
            seedingFormat: 'cross',
            stage: 'pool',
            bonusPoints: { enabled: true, qf: 1, sf: 2, final: 3, third: 1 },
            twoLeg: false,
          },
        },
      };
    }
    case 'UPDATE_GAME': {
      const ug = action.payload;
      const sanitizedGame = {
        ...ug,
        ...(ug.name != null && { name: sanitizeString(ug.name, LIMITS.MAX_NAME_LENGTH) }),
        ...(ug.emoji != null && { emoji: typeof ug.emoji === 'string' ? ug.emoji.slice(0, 4) : undefined }),
      };
      return {
        ...state,
        games: state.games.map(g => g.id === sanitizedGame.id ? { ...g, ...sanitizedGame } : g),
      };
    }
    case 'DELETE_GAME': {
      const gameId = action.payload;
      const poolIds = state.pools.filter(p => p.gameId === gameId).map(p => p.id);
      const { [gameId]: _kc, ...restKnockoutConfig } = state.knockoutConfig;
      const { [gameId]: _qt, ...restQualifiedTeams } = state.qualifiedTeams;
      const { [gameId]: _ipc, ...restIndPointsConfig } = state.individualPointsConfig;
      const { [gameId]: _lpc, ...restLobbyPointsConfig } = state.lobbyPointsConfig;
      return {
        ...state,
        games: state.games.filter(g => g.id !== gameId),
        pools: state.pools.filter(p => p.gameId !== gameId),
        matches: state.matches.filter(m => !poolIds.includes(m.poolId)),
        knockoutConfig: restKnockoutConfig,
        knockoutMatches: state.knockoutMatches.filter(m => m.gameId !== gameId),
        qualifiedTeams: restQualifiedTeams,
        athletes: state.athletes.filter(a => a.gameId !== gameId),
        categories: state.categories.filter(c => c.gameId !== gameId),
        individualResults: state.individualResults.filter(r => r.gameId !== gameId),
        individualPointsConfig: restIndPointsConfig,
        lobbyEntries: state.lobbyEntries.filter(e => e.gameId !== gameId),
        lobbyResults: state.lobbyResults.filter(r => r.gameId !== gameId),
        lobbyPointsConfig: restLobbyPointsConfig,
        selectedGameId: state.selectedGameId === gameId ? null : state.selectedGameId,
      };
    }

    // Pools
    case 'ADD_POOL': {
      const newPool = { id: genId('p'), teamIds: [], ...action.payload };
      return { ...state, pools: [...state.pools, newPool] };
    }
    case 'UPDATE_POOL':
      return {
        ...state,
        pools: state.pools.map(p => p.id === action.payload.id ? { ...p, ...action.payload } : p),
      };
    case 'DELETE_POOL': {
      const poolId = action.payload;
      return {
        ...state,
        pools: state.pools.filter(p => p.id !== poolId),
        matches: state.matches.filter(m => m.poolId !== poolId),
      };
    }
    case 'ASSIGN_TEAM_TO_POOL': {
      const { poolId, teamId } = action.payload;
      // Find which game this pool belongs to
      const targetPool = state.pools.find(p => p.id === poolId);
      if (!targetPool) return state;
      // Check if team is already in any pool of the same game
      const alreadyInGame = state.pools.some(
        p => p.gameId === targetPool.gameId && p.teamIds.includes(teamId)
      );
      if (alreadyInGame) return state;
      return {
        ...state,
        pools: state.pools.map(p => {
          if (p.id !== poolId) return p;
          return { ...p, teamIds: [...p.teamIds, teamId] };
        }),
      };
    }
    case 'REMOVE_TEAM_FROM_POOL': {
      const { poolId, teamId } = action.payload;
      return {
        ...state,
        pools: state.pools.map(p => {
          if (p.id !== poolId) return p;
          return { ...p, teamIds: p.teamIds.filter(id => id !== teamId) };
        }),
        matches: state.matches.filter(m => {
          if (m.poolId !== poolId) return true;
          return m.teamAId !== teamId && m.teamBId !== teamId;
        }),
      };
    }

    // Matches (pool stage)
    case 'ADD_MATCH': {
      const newMatch = { id: genId('m'), status: 'upcoming', result: null, absentTeamId: null, ...action.payload };
      return { ...state, matches: [...state.matches, newMatch] };
    }
    case 'UPDATE_MATCH':
      return {
        ...state,
        matches: state.matches.map(m => m.id === action.payload.id ? { ...m, ...action.payload } : m),
      };
    case 'DELETE_MATCH':
      return { ...state, matches: state.matches.filter(m => m.id !== action.payload) };

    // Knockout Config
    case 'UPDATE_KNOCKOUT_CONFIG': {
      const { gameId, ...config } = action.payload;
      return {
        ...state,
        knockoutConfig: {
          ...state.knockoutConfig,
          [gameId]: { ...(state.knockoutConfig[gameId] || {}), ...config },
        },
      };
    }

    // Knockout Matches
    case 'SET_KNOCKOUT_MATCHES': {
      const { gameId, matches: koMatches } = action.payload;
      const filtered = state.knockoutMatches.filter(m => m.gameId !== gameId);
      return { ...state, knockoutMatches: [...filtered, ...koMatches] };
    }
    case 'UPDATE_KNOCKOUT_MATCH': {
      return {
        ...state,
        knockoutMatches: state.knockoutMatches.map(m =>
          m.id === action.payload.id ? { ...m, ...action.payload } : m
        ),
      };
    }
    case 'DELETE_KNOCKOUT_MATCH':
      return { ...state, knockoutMatches: state.knockoutMatches.filter(m => m.id !== action.payload) };

    // Qualified Teams
    case 'SET_QUALIFIED_TEAMS': {
      const { gameId, teams: qualTeams } = action.payload;
      return {
        ...state,
        qualifiedTeams: { ...state.qualifiedTeams, [gameId]: qualTeams },
      };
    }

    // Advance game to knockout stage
    case 'ADVANCE_TO_KNOCKOUT': {
      const { gameId } = action.payload;
      return {
        ...state,
        knockoutConfig: {
          ...state.knockoutConfig,
          [gameId]: { ...(state.knockoutConfig[gameId] || {}), stage: 'knockout' },
        },
      };
    }

    // Mark game completed
    case 'COMPLETE_GAME': {
      const { gameId } = action.payload;
      return {
        ...state,
        knockoutConfig: {
          ...state.knockoutConfig,
          [gameId]: { ...(state.knockoutConfig[gameId] || {}), stage: 'completed' },
        },
      };
    }

    // Reset game to pool stage
    case 'RESET_TO_POOL': {
      const { gameId } = action.payload;
      return {
        ...state,
        knockoutConfig: {
          ...state.knockoutConfig,
          [gameId]: { ...(state.knockoutConfig[gameId] || {}), stage: 'pool' },
        },
        knockoutMatches: state.knockoutMatches.filter(m => m.gameId !== gameId),
        qualifiedTeams: { ...state.qualifiedTeams, [gameId]: [] },
      };
    }

    // ── Individual Game: Athletes ──────────────────────
    case 'ADD_ATHLETE': {
      if (state.athletes.length >= LIMITS.MAX_ATHLETES) return state;
      const ap = action.payload;
      // Validate referenced game exists and is individual type
      const targetGame = state.games.find(g => g.id === ap.gameId);
      if (!targetGame || targetGame.type !== 'individual') return state;
      // Validate referenced team exists
      if (!state.teams.some(t => t.id === ap.teamId)) return state;
      // Validate regNumber format (8 digits, unique)
      if (!/^\d{8}$/.test(ap.regNumber)) return state;
      if (state.athletes.some(a => a.regNumber === ap.regNumber)) return state;
      const newAthlete = {
        id: genId('a'),
        name: sanitizeString(ap.name, LIMITS.MAX_NAME_LENGTH),
        regNumber: ap.regNumber,
        teamId: ap.teamId,
        gameId: ap.gameId,
      };
      // Also add to category athleteIds if category provided (single category only)
      let updatedCategories = state.categories;
      if (ap.categoryIds && ap.categoryIds.length > 0) {
        // Only allow first category, must belong to same game
        const validCatId = ap.categoryIds[0];
        updatedCategories = state.categories.map(c =>
          c.id === validCatId && c.gameId === ap.gameId && !c.athleteIds.includes(newAthlete.id)
            ? { ...c, athleteIds: [...c.athleteIds, newAthlete.id] }
            : c
        );
      }
      return { ...state, athletes: [...state.athletes, newAthlete], categories: updatedCategories };
    }
    case 'UPDATE_ATHLETE': {
      const ua = action.payload;
      const existingAthlete = state.athletes.find(a => a.id === ua.id);
      if (!existingAthlete) return state;
      // Validate gameId if changed
      if (ua.gameId != null && ua.gameId !== existingAthlete.gameId) {
        const newGame = state.games.find(g => g.id === ua.gameId);
        if (!newGame || newGame.type !== 'individual') return state;
      }
      // Validate teamId if changed
      if (ua.teamId != null && !state.teams.some(t => t.id === ua.teamId)) return state;
      // Validate regNumber if changed
      if (ua.regNumber != null && ua.regNumber !== existingAthlete.regNumber) {
        if (!/^\d{8}$/.test(ua.regNumber)) return state;
        if (state.athletes.some(a => a.id !== ua.id && a.regNumber === ua.regNumber)) return state;
      }
      const sanitizedAthlete = {
        id: ua.id,
        ...(ua.name != null && { name: sanitizeString(ua.name, LIMITS.MAX_NAME_LENGTH) }),
        ...(ua.regNumber != null && { regNumber: ua.regNumber }),
        ...(ua.teamId != null && { teamId: ua.teamId }),
        ...(ua.gameId != null && { gameId: ua.gameId }),
      };
      return {
        ...state,
        athletes: state.athletes.map(a => a.id === sanitizedAthlete.id ? { ...a, ...sanitizedAthlete } : a),
      };
    }
    case 'DELETE_ATHLETE': {
      const athleteId = action.payload;
      if (typeof athleteId !== 'string') return state;
      return {
        ...state,
        athletes: state.athletes.filter(a => a.id !== athleteId),
        categories: state.categories.map(c => ({
          ...c,
          athleteIds: c.athleteIds.filter(id => id !== athleteId),
        })),
        individualResults: state.individualResults.map(r => {
          const hasPlacement = r.placements?.first === athleteId || r.placements?.second === athleteId || r.placements?.third === athleteId;
          const inParticipants = (r.participants || []).includes(athleteId);
          const inAbsentees = (r.absentees || []).includes(athleteId);
          if (!hasPlacement && !inParticipants && !inAbsentees) return r;
          return {
            ...r,
            placements: hasPlacement ? shiftPlacementsHelper(r.placements, athleteId) : r.placements,
            participants: (r.participants || []).filter(id => id !== athleteId),
            absentees: (r.absentees || []).filter(id => id !== athleteId),
          };
        }),
      };
    }

    // ── Individual Game: Categories ─────────────────────
    case 'ADD_CATEGORY': {
      if (state.categories.length >= LIMITS.MAX_CATEGORIES) return state;
      const cp = action.payload;
      // Validate game exists and is individual
      const catGame = state.games.find(g => g.id === cp.gameId);
      if (!catGame || catGame.type !== 'individual') return state;
      const newCategory = {
        id: genId('cat'),
        name: sanitizeString(cp.name, LIMITS.MAX_NAME_LENGTH),
        gameId: cp.gameId,
        status: 'upcoming',
        athleteIds: [],
      };
      return { ...state, categories: [...state.categories, newCategory] };
    }
    case 'UPDATE_CATEGORY': {
      const ucPayload = action.payload;
      const existingCat = state.categories.find(c => c.id === ucPayload.id);
      if (!existingCat) return state;
      // Build safe update — only allow known fields
      const catUpdate = { id: ucPayload.id };
      if (ucPayload.name != null) catUpdate.name = sanitizeString(ucPayload.name, LIMITS.MAX_NAME_LENGTH);
      if (ucPayload.status != null && ['upcoming', 'completed'].includes(ucPayload.status)) catUpdate.status = ucPayload.status;
      if (ucPayload.athleteIds != null) {
        // Validate all athleteIds belong to athletes in the same game
        const validIds = Array.isArray(ucPayload.athleteIds)
          ? ucPayload.athleteIds.filter(id => state.athletes.some(a => a.id === id && a.gameId === existingCat.gameId))
          : [];
        catUpdate.athleteIds = validIds;
      }
      return {
        ...state,
        categories: state.categories.map(c =>
          c.id === catUpdate.id ? { ...c, ...catUpdate } : c
        ),
      };
    }
    case 'DELETE_CATEGORY': {
      const catId = action.payload;
      if (typeof catId !== 'string') return state;
      return {
        ...state,
        categories: state.categories.filter(c => c.id !== catId),
        individualResults: state.individualResults.filter(r => r.categoryId !== catId),
      };
    }

    // ── Individual Game: Results ─────────────────────────
    case 'SET_INDIVIDUAL_RESULT': {
      if (state.individualResults.length >= LIMITS.MAX_INDIVIDUAL_RESULTS) {
        // Allow updates to existing but not new
        if (!state.individualResults.some(r => r.categoryId === action.payload.categoryId)) return state;
      }
      const result = action.payload;
      // Validate category exists
      const resCat = state.categories.find(c => c.id === result.categoryId);
      if (!resCat) return state;
      // Validate gameId matches category's game
      if (result.gameId && result.gameId !== resCat.gameId) return state;
      // Validate placements reference athletes in this category
      const catAthIds = new Set(resCat.athleteIds);
      const placements = result.placements || {};
      if (placements.first && !catAthIds.has(placements.first)) return state;
      if (placements.second && !catAthIds.has(placements.second)) return state;
      if (placements.third && !catAthIds.has(placements.third)) return state;
      // Validate no duplicate placements
      const placementIds = [placements.first, placements.second, placements.third].filter(Boolean);
      if (new Set(placementIds).size !== placementIds.length) return state;
      // Sanitize participants/absentees to only valid athlete IDs in category
      const safeResult = {
        ...result,
        placements,
        participants: Array.isArray(result.participants)
          ? result.participants.filter(id => catAthIds.has(id)).slice(0, LIMITS.MAX_ATHLETES)
          : [],
        absentees: Array.isArray(result.absentees)
          ? result.absentees.filter(id => catAthIds.has(id)).slice(0, LIMITS.MAX_ATHLETES)
          : [],
      };
      const existingIdx = state.individualResults.findIndex(r => r.categoryId === safeResult.categoryId);
      if (existingIdx >= 0) {
        return {
          ...state,
          individualResults: state.individualResults.map(r =>
            r.categoryId === safeResult.categoryId ? { ...r, ...safeResult } : r
          ),
        };
      }
      return {
        ...state,
        individualResults: [...state.individualResults, { id: genId('ir'), ...safeResult }],
      };
    }

    // ── Individual Game: Points Config ──────────────────
    case 'UPDATE_INDIVIDUAL_POINTS_CONFIG': {
      const { gameId: pcGameId, ...pcConfig } = action.payload;
      // Validate game exists and is individual
      const pcGame = state.games.find(g => g.id === pcGameId);
      if (!pcGame || pcGame.type !== 'individual') return state;
      // Clamp values to safe range [0, 100]
      const clamp = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
      const safeConfig = {};
      if (pcConfig.first != null) safeConfig.first = clamp(pcConfig.first);
      if (pcConfig.second != null) safeConfig.second = clamp(pcConfig.second);
      if (pcConfig.third != null) safeConfig.third = clamp(pcConfig.third);
      if (pcConfig.participation != null) safeConfig.participation = clamp(pcConfig.participation);
      if (pcConfig.maxParticipationCap !== undefined) {
        safeConfig.maxParticipationCap = pcConfig.maxParticipationCap === Infinity ? Infinity : Math.max(1, Math.min(100, Math.round(Number(pcConfig.maxParticipationCap) || Infinity)));
      }
      return {
        ...state,
        individualPointsConfig: {
          ...state.individualPointsConfig,
          [pcGameId]: { ...(state.individualPointsConfig[pcGameId] || {}), ...safeConfig },
        },
      };
    }

    // ── Lobby Game: Entries ──────────────────
    case 'ADD_LOBBY_ENTRY': {
      const le = action.payload;
      const leGame = state.games.find(g => g.id === le.gameId);
      if (!leGame || leGame.type !== 'lobby') return state;
      if (!state.teams.some(t => t.id === le.teamId)) return state;
      const newEntry = {
        id: genId('le'),
        gameId: le.gameId,
        teamId: le.teamId,
        entryName: le.entryName ? sanitizeString(le.entryName, LIMITS.MAX_NAME_LENGTH) : '',
      };
      return { ...state, lobbyEntries: [...state.lobbyEntries, newEntry] };
    }
    case 'UPDATE_LOBBY_ENTRY': {
      const ule = action.payload;
      const existing = state.lobbyEntries.find(e => e.id === ule.id);
      if (!existing) return state;
      const update = { id: ule.id };
      if (ule.entryName != null) update.entryName = sanitizeString(ule.entryName, LIMITS.MAX_NAME_LENGTH);
      if (ule.teamId != null && state.teams.some(t => t.id === ule.teamId)) update.teamId = ule.teamId;
      return { ...state, lobbyEntries: state.lobbyEntries.map(e => e.id === update.id ? { ...e, ...update } : e) };
    }
    case 'DELETE_LOBBY_ENTRY': {
      const entryId = action.payload;
      // Cascade: remove from session participants and shift placements
      const updatedLR = state.lobbyResults.map(r => {
        const inParticipants = (r.participantEntryIds || []).includes(entryId);
        const p = r.placements || {};
        const inPlacements = p.first === entryId || p.second === entryId || p.third === entryId;
        if (!inParticipants && !inPlacements) return r;
        return {
          ...r,
          participantEntryIds: (r.participantEntryIds || []).filter(id => id !== entryId),
          placements: inPlacements ? shiftPlacementsHelper(p, entryId) : p,
        };
      });
      return { ...state, lobbyEntries: state.lobbyEntries.filter(e => e.id !== entryId), lobbyResults: updatedLR };
    }

    // ── Lobby Game: Results ──────────────────
    case 'ADD_LOBBY_RESULT': {
      const lr = action.payload;
      const lrGame = state.games.find(g => g.id === lr.gameId);
      if (!lrGame || lrGame.type !== 'lobby') return state;
      const newLr = {
        id: genId('lr'),
        gameId: lr.gameId,
        sessionName: sanitizeString(lr.sessionName || 'Session', LIMITS.MAX_NAME_LENGTH),
        placements: lr.placements || { first: null, second: null, third: null },
        participantEntryIds: Array.isArray(lr.participantEntryIds) ? lr.participantEntryIds : [],
      };
      return { ...state, lobbyResults: [...state.lobbyResults, newLr] };
    }
    case 'UPDATE_LOBBY_RESULT': {
      const ulr = action.payload;
      return {
        ...state,
        lobbyResults: state.lobbyResults.map(r => r.id === ulr.id ? { ...r, ...ulr } : r),
      };
    }
    case 'DELETE_LOBBY_RESULT':
      return { ...state, lobbyResults: state.lobbyResults.filter(r => r.id !== action.payload) };

    case 'UPDATE_LOBBY_POINTS_CONFIG': {
      const { gameId: lpGameId, ...lpConfig } = action.payload;
      const lpGame = state.games.find(g => g.id === lpGameId);
      if (!lpGame || lpGame.type !== 'lobby') return state;
      const clampLp = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
      const safeLpConfig = {};
      if (lpConfig.first != null) safeLpConfig.first = clampLp(lpConfig.first);
      if (lpConfig.second != null) safeLpConfig.second = clampLp(lpConfig.second);
      if (lpConfig.third != null) safeLpConfig.third = clampLp(lpConfig.third);
      if (lpConfig.participation != null) safeLpConfig.participation = clampLp(lpConfig.participation);
      if (lpConfig.maxParticipationCap !== undefined) {
        safeLpConfig.maxParticipationCap = lpConfig.maxParticipationCap === Infinity ? Infinity : Math.max(1, Math.min(100, Math.round(Number(lpConfig.maxParticipationCap) || Infinity)));
      }
      return {
        ...state,
        lobbyPointsConfig: {
          ...state.lobbyPointsConfig,
          [lpGameId]: { ...(state.lobbyPointsConfig[lpGameId] || {}), ...safeLpConfig },
        },
      };
    }

    // Dark mode
    case 'TOGGLE_DARK_MODE':
      return { ...state, darkMode: !state.darkMode };

    // Toast
    case 'ADD_TOAST':
      return { ...state, toasts: [...state.toasts, { id: genId('toast'), ...action.payload }] };
    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter(t => t.id !== action.payload) };

    // Import/Export
    case 'IMPORT_DATA':
      return {
        ...initialState,
        ...action.payload,
        knockoutConfig: action.payload.knockoutConfig || {},
        knockoutMatches: action.payload.knockoutMatches || [],
        qualifiedTeams: action.payload.qualifiedTeams || {},
        athletes: action.payload.athletes || [],
        categories: action.payload.categories || [],
        individualResults: action.payload.individualResults || [],
        individualPointsConfig: action.payload.individualPointsConfig || {},
        lobbyEntries: action.payload.lobbyEntries || [],
        lobbyResults: action.payload.lobbyResults || [],
        lobbyPointsConfig: action.payload.lobbyPointsConfig || {},
        currentView: 'dashboard',
        toasts: state.toasts,
        darkMode: state.darkMode,
      };
    case 'LOAD_SAMPLE':
      return {
        ...initialState,
        ...action.payload,
        knockoutConfig: action.payload.knockoutConfig || {},
        knockoutMatches: action.payload.knockoutMatches || [],
        qualifiedTeams: action.payload.qualifiedTeams || {},
        athletes: action.payload.athletes || [],
        categories: action.payload.categories || [],
        individualResults: action.payload.individualResults || [],
        individualPointsConfig: action.payload.individualPointsConfig || {},
        lobbyEntries: action.payload.lobbyEntries || [],
        lobbyResults: action.payload.lobbyResults || [],
        lobbyPointsConfig: action.payload.lobbyPointsConfig || {},
        currentView: 'dashboard',
        toasts: state.toasts,
        darkMode: state.darkMode,
      };
    case 'RESET_DATA':
      return {
        ...initialState,
        darkMode: state.darkMode,
        toasts: state.toasts,
      };

    default:
      return state;
  }
}

export function TournamentProvider({ children }) {
  const [state, rawDispatch] = useReducer(tournamentReducer, initialState);
  const isAdminRef = useRef(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const isSyncingRef = useRef(false);
  const stateRef = useRef(state);
  // Track whether user has made any changes (prevents overwriting Firestore with empty state)
  const userHasActedRef = useRef(false);
  // Track whether initial load found existing data in Firestore
  const firestoreHadDataRef = useRef(false);

  // Keep stateRef in sync
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // ── Load initial data from Firestore ────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await loadTournamentData();
        if (cancelled) return;
        if (data) {
          firestoreHadDataRef.current = true;
          isSyncingRef.current = true;
          rawDispatch({ type: '_SYNC_FROM_FIRESTORE', payload: data });
          // Small delay to let the reducer settle before re-enabling save
          setTimeout(() => { isSyncingRef.current = false; }, 100);
        }
        setDataLoaded(true);
      } catch (err) {
        if (!cancelled) {
          // Failed to load data from Firestore
          setLoadError(err.message || 'Failed to load data');
          // CRITICAL: Do NOT set dataLoaded=true on load failure if we don't know
          // whether Firestore has data. This prevents the empty state from being
          // saved over existing data. The app will stay in loading state.
          // But allow it after a retry...
          setTimeout(async () => {
            if (cancelled) return;
            try {
              const retryData = await loadTournamentData();
              if (cancelled) return;
              if (retryData) {
                firestoreHadDataRef.current = true;
                isSyncingRef.current = true;
                rawDispatch({ type: '_SYNC_FROM_FIRESTORE', payload: retryData });
                setTimeout(() => { isSyncingRef.current = false; }, 100);
              }
              setDataLoaded(true);
            } catch {
              // Second attempt failed — allow app to work but block saves
              // until user makes an explicit change
              // Firestore load failed after retry — saves blocked until user acts
              setDataLoaded(true);
            }
          }, 3000);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // ── Subscribe to real-time changes from other tabs/devices ──
  useEffect(() => {
    if (!dataLoaded) return;
    const unsub = subscribeToChanges((data) => {
      isSyncingRef.current = true;
      rawDispatch({ type: '_SYNC_FROM_FIRESTORE', payload: data });
      setTimeout(() => { isSyncingRef.current = false; }, 100);
    });
    return unsub;
  }, [dataLoaded]);

  // ── Auto-save on state changes ──────────────────────
  const prevStateForSaveRef = useRef(null);
  useEffect(() => {
    if (!dataLoaded) return;
    if (isSyncingRef.current) return;

    // CRITICAL SAFETY: Don't save empty state over existing Firestore data.
    // This prevents data loss when cache is cleared and load fails/is slow.
    const stateIsEmpty = state.teams.length === 0 && state.games.length === 0
      && state.matches.length === 0 && state.knockoutMatches.length === 0;

    if (stateIsEmpty && firestoreHadDataRef.current && !userHasActedRef.current) {
      // Firestore had data, state is empty, and user hasn't done anything.
      // This is likely a load failure or race condition — DON'T save.
      // Blocked saving empty state over existing Firestore data
      return;
    }

    if (stateIsEmpty && !userHasActedRef.current) {
      // State is empty and user hasn't acted — skip save entirely.
      // This covers both first-time setup (no data yet) and load failures.
      return;
    }

    // Only save data fields, not UI state
    const savePayload = {
      tournament: state.tournament,
      teams: state.teams,
      games: state.games,
      pools: state.pools,
      matches: state.matches,
      knockoutConfig: state.knockoutConfig,
      knockoutMatches: state.knockoutMatches,
      qualifiedTeams: state.qualifiedTeams,
      athletes: state.athletes,
      categories: state.categories,
      individualResults: state.individualResults,
      individualPointsConfig: state.individualPointsConfig,
      lobbyEntries: state.lobbyEntries,
      lobbyResults: state.lobbyResults,
      lobbyPointsConfig: state.lobbyPointsConfig,
    };

    const serialized = JSON.stringify(savePayload);
    if (prevStateForSaveRef.current === serialized) return;
    prevStateForSaveRef.current = serialized;

    debouncedSave(state).catch(() => {
      // Error handled by save callbacks
    });
  }, [state, dataLoaded]);

  // ── beforeunload warning for unsaved changes ────────
  useEffect(() => {
    const handler = (e) => {
      if (hasPendingSave()) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        // Try to force save before leaving
        forceSave(stateRef.current).catch(() => {});
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // Guarded dispatch that checks admin status for mutation actions
  const dispatch = useCallback((action) => {
    if (ADMIN_ACTIONS.has(action.type) && !isAdminRef.current) {
      rawDispatch({
        type: 'ADD_TOAST',
        payload: { message: 'Unauthorized: Admin login required', toastType: 'error' },
      });
      return;
    }
    // Mark that user has made an intentional change — unlocks auto-save
    if (ADMIN_ACTIONS.has(action.type)) {
      userHasActedRef.current = true;
    }
    rawDispatch(action);
  }, []);

  const showToast = useCallback((message, type = 'success') => {
    rawDispatch({ type: 'ADD_TOAST', payload: { message, toastType: type } });
  }, []);

  // Function to update admin ref from AuthContext
  const setAdminFlag = useCallback((isAdmin) => {
    isAdminRef.current = isAdmin;
  }, []);

  return (
    <TournamentContext.Provider value={state}>
      <DispatchContext.Provider value={{ dispatch, showToast, setAdminFlag, dataLoaded, loadError, forceSaveNow: () => forceSave(stateRef.current) }}>
        {children}
      </DispatchContext.Provider>
    </TournamentContext.Provider>
  );
}

export function useTournament() {
  const ctx = useContext(TournamentContext);
  if (!ctx) throw new Error('useTournament must be used within TournamentProvider');
  return ctx;
}

export function useDispatch() {
  const ctx = useContext(DispatchContext);
  if (!ctx) throw new Error('useDispatch must be used within TournamentProvider');
  return ctx;
}
