/**
 * Comprehensive validation utilities for the tournament app.
 * Covers import validation, input sanitization, and data integrity checks.
 */

// Max limits to prevent DoS
export const LIMITS = {
  MAX_TEAMS: 64,
  MAX_GAMES: 20,
  MAX_POOLS: 40,
  MAX_MATCHES: 500,
  MAX_KNOCKOUT_MATCHES: 200,
  MAX_NAME_LENGTH: 100,
  MAX_SHORT_CODE_LENGTH: 4,
  MAX_TOURNAMENT_NAME_LENGTH: 200,
  MAX_IMPORT_SIZE_BYTES: 5 * 1024 * 1024, // 5MB
  MAX_IMAGE_SIZE_BYTES: 2 * 1024 * 1024, // 2MB
  MAX_LOGO_DATA_URL_LENGTH: 3 * 1024 * 1024, // ~3MB base64
};

// Strip HTML tags from a string
function stripHtml(str) {
  return str.replace(/<[^>]*>/g, '');
}

// Sanitize a string: strip HTML tags, trim, limit length
export function sanitizeString(str, maxLength = LIMITS.MAX_NAME_LENGTH) {
  if (typeof str !== 'string') return '';
  return stripHtml(str).trim().slice(0, maxLength);
}

// Validate team name
export function validateTeamName(name, existingTeams = [], editId = null) {
  if (!name || typeof name !== 'string') return 'Team name is required';
  const trimmed = name.trim();
  if (trimmed.length === 0) return 'Team name cannot be empty or whitespace only';
  if (trimmed.length > LIMITS.MAX_NAME_LENGTH) return `Team name cannot exceed ${LIMITS.MAX_NAME_LENGTH} characters`;
  const isDup = existingTeams.some(t => t.name.toLowerCase() === trimmed.toLowerCase() && t.id !== editId);
  if (isDup) return 'A team with this name already exists';
  return null;
}

// Validate game name
export function validateGameName(name, existingGames = [], editId = null) {
  if (!name || typeof name !== 'string') return 'Game name is required';
  const trimmed = name.trim();
  if (trimmed.length === 0) return 'Game name cannot be empty';
  if (trimmed.length > LIMITS.MAX_NAME_LENGTH) return `Game name cannot exceed ${LIMITS.MAX_NAME_LENGTH} characters`;
  const isDup = existingGames.some(g => g.name.toLowerCase() === trimmed.toLowerCase() && g.id !== editId);
  if (isDup) return 'A game with this name already exists';
  return null;
}

// Validate import data structure and content
export function validateImportData(jsonString) {
  // Size check
  if (typeof jsonString !== 'string') return { valid: false, error: 'Invalid file content' };
  if (jsonString.length > LIMITS.MAX_IMPORT_SIZE_BYTES) {
    return { valid: false, error: `File too large. Maximum size is ${LIMITS.MAX_IMPORT_SIZE_BYTES / 1024 / 1024}MB` };
  }

  let data;
  try {
    data = JSON.parse(jsonString);
  } catch {
    return { valid: false, error: 'Invalid JSON format' };
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, error: 'Invalid data format: expected an object' };
  }

  // Check required top-level keys
  const requiredKeys = ['tournament', 'teams', 'games', 'pools', 'matches'];
  for (const key of requiredKeys) {
    if (!(key in data)) {
      return { valid: false, error: `Missing required field: ${key}` };
    }
  }

  // Validate tournament
  if (typeof data.tournament !== 'object' || !data.tournament) {
    return { valid: false, error: 'Invalid tournament data' };
  }

  // Validate arrays
  const arrayFields = ['teams', 'games', 'pools', 'matches'];
  for (const field of arrayFields) {
    if (!Array.isArray(data[field])) {
      return { valid: false, error: `${field} must be an array` };
    }
  }

  // Size limits
  if (data.teams.length > LIMITS.MAX_TEAMS) {
    return { valid: false, error: `Too many teams. Maximum is ${LIMITS.MAX_TEAMS}` };
  }
  if (data.games.length > LIMITS.MAX_GAMES) {
    return { valid: false, error: `Too many games. Maximum is ${LIMITS.MAX_GAMES}` };
  }
  if (data.pools.length > LIMITS.MAX_POOLS) {
    return { valid: false, error: `Too many pools. Maximum is ${LIMITS.MAX_POOLS}` };
  }
  if (data.matches.length > LIMITS.MAX_MATCHES) {
    return { valid: false, error: `Too many matches. Maximum is ${LIMITS.MAX_MATCHES}` };
  }
  if (Array.isArray(data.knockoutMatches) && data.knockoutMatches.length > LIMITS.MAX_KNOCKOUT_MATCHES) {
    return { valid: false, error: `Too many knockout matches. Maximum is ${LIMITS.MAX_KNOCKOUT_MATCHES}` };
  }

  // Validate each team has required fields
  for (let i = 0; i < data.teams.length; i++) {
    const team = data.teams[i];
    if (!team || typeof team !== 'object') {
      return { valid: false, error: `Invalid team at index ${i}` };
    }
    if (!team.id || typeof team.id !== 'string') {
      return { valid: false, error: `Team at index ${i} missing valid id` };
    }
    if (!team.name || typeof team.name !== 'string') {
      return { valid: false, error: `Team at index ${i} missing valid name` };
    }
    // Sanitize name length
    team.name = sanitizeString(team.name, LIMITS.MAX_NAME_LENGTH);
    team.shortCode = sanitizeString(team.shortCode || '', LIMITS.MAX_SHORT_CODE_LENGTH);
    // Validate logo if present (must be a data URL or null)
    if (team.logo && typeof team.logo === 'string') {
      if (!team.logo.startsWith('data:image/') || team.logo.length > LIMITS.MAX_LOGO_DATA_URL_LENGTH) {
        team.logo = null; // Strip invalid/oversized logos
      }
    } else {
      team.logo = null;
    }
  }

  // Validate each game
  for (let i = 0; i < data.games.length; i++) {
    const game = data.games[i];
    if (!game || typeof game !== 'object') {
      return { valid: false, error: `Invalid game at index ${i}` };
    }
    if (!game.id || typeof game.id !== 'string') {
      return { valid: false, error: `Game at index ${i} missing valid id` };
    }
    if (!game.name || typeof game.name !== 'string') {
      return { valid: false, error: `Game at index ${i} missing valid name` };
    }
    game.name = sanitizeString(game.name, LIMITS.MAX_NAME_LENGTH);
    game.emoji = typeof game.emoji === 'string' ? game.emoji.slice(0, 4) : '🎮';
  }

  // Validate each pool
  for (let i = 0; i < data.pools.length; i++) {
    const pool = data.pools[i];
    if (!pool || typeof pool !== 'object') {
      return { valid: false, error: `Invalid pool at index ${i}` };
    }
    if (!pool.id || typeof pool.id !== 'string') {
      return { valid: false, error: `Pool at index ${i} missing valid id` };
    }
    if (!Array.isArray(pool.teamIds)) {
      pool.teamIds = [];
    }
    pool.name = sanitizeString(pool.name || 'Pool', LIMITS.MAX_NAME_LENGTH);
  }

  // Validate each match
  const validResults = ['teamA', 'teamB', 'draw', 'bye', null];
  const validStatuses = ['upcoming', 'live', 'completed'];
  for (let i = 0; i < data.matches.length; i++) {
    const match = data.matches[i];
    if (!match || typeof match !== 'object') {
      return { valid: false, error: `Invalid match at index ${i}` };
    }
    if (!match.id || typeof match.id !== 'string') {
      return { valid: false, error: `Match at index ${i} missing valid id` };
    }
    if (!validStatuses.includes(match.status)) {
      match.status = 'upcoming';
    }
    if (!validResults.includes(match.result)) {
      match.result = null;
    }
  }

  // Validate knockoutMatches if present
  if (data.knockoutMatches && !Array.isArray(data.knockoutMatches)) {
    data.knockoutMatches = [];
  }

  // Validate knockoutConfig if present
  if (data.knockoutConfig && typeof data.knockoutConfig !== 'object') {
    data.knockoutConfig = {};
  }

  // Validate qualifiedTeams if present
  if (data.qualifiedTeams && typeof data.qualifiedTeams !== 'object') {
    data.qualifiedTeams = {};
  }

  // Sanitize tournament
  data.tournament.name = sanitizeString(data.tournament.name || 'Tournament', LIMITS.MAX_TOURNAMENT_NAME_LENGTH);
  if (data.tournament.logo && typeof data.tournament.logo === 'string') {
    if (!data.tournament.logo.startsWith('data:image/') || data.tournament.logo.length > LIMITS.MAX_LOGO_DATA_URL_LENGTH) {
      data.tournament.logo = null;
    }
  } else {
    data.tournament.logo = null;
  }

  return { valid: true, data };
}

// Validate image data URL
export function validateImageDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return false;
  // Must be a valid data URL with image MIME type
  if (!dataUrl.startsWith('data:image/')) return false;
  // Reject SVGs (can contain scripts)
  if (dataUrl.startsWith('data:image/svg')) return false;
  // Size limit
  if (dataUrl.length > LIMITS.MAX_LOGO_DATA_URL_LENGTH) return false;
  return true;
}

// Validate image file before reading
export function validateImageFile(file) {
  if (!file) return 'No file selected';
  if (!file.type.startsWith('image/')) return 'File must be an image';
  if (file.type === 'image/svg+xml') return 'SVG files are not allowed for security reasons';
  if (file.size > LIMITS.MAX_IMAGE_SIZE_BYTES) {
    return `Image too large. Maximum size is ${LIMITS.MAX_IMAGE_SIZE_BYTES / 1024 / 1024}MB`;
  }
  return null; // valid
}
