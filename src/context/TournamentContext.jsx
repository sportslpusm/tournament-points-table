import { createContext, useContext, useReducer, useCallback, useRef } from 'react';
import { sanitizeString, LIMITS } from '../utils/validation';

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
  'IMPORT_DATA', 'LOAD_SAMPLE', 'RESET_DATA',
]);

function tournamentReducer(state, action) {
  switch (action.type) {
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
      return {
        ...state,
        teams: state.teams.filter(t => t.id !== teamId),
        pools: state.pools.map(p => ({
          ...p,
          teamIds: p.teamIds.filter(id => id !== teamId),
        })),
        matches: state.matches.filter(m => m.teamAId !== teamId && m.teamBId !== teamId),
        knockoutMatches: state.knockoutMatches.filter(m => m.teamAId !== teamId && m.teamBId !== teamId),
      };
    }

    // Games
    case 'ADD_GAME': {
      const gp = action.payload;
      const newGame = { id: genId('g'), ...gp, name: sanitizeString(gp.name, LIMITS.MAX_NAME_LENGTH) };
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
      return {
        ...state,
        games: state.games.filter(g => g.id !== gameId),
        pools: state.pools.filter(p => p.gameId !== gameId),
        matches: state.matches.filter(m => !poolIds.includes(m.poolId)),
        knockoutConfig: restKnockoutConfig,
        knockoutMatches: state.knockoutMatches.filter(m => m.gameId !== gameId),
        qualifiedTeams: restQualifiedTeams,
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
      return {
        ...state,
        pools: state.pools.map(p => {
          if (p.id !== poolId) return p;
          if (p.teamIds.includes(teamId)) return p;
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

  // Guarded dispatch that checks admin status for mutation actions
  const dispatch = useCallback((action) => {
    if (ADMIN_ACTIONS.has(action.type) && !isAdminRef.current) {
      // Silently reject or show unauthorized toast
      rawDispatch({
        type: 'ADD_TOAST',
        payload: { message: 'Unauthorized: Admin login required', toastType: 'error' },
      });
      return;
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
      <DispatchContext.Provider value={{ dispatch, showToast, setAdminFlag }}>
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
