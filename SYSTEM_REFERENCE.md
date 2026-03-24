# SYSTEM_REFERENCE.md — Tournament Points Table

> **Last updated:** 2026-03-24
> **Purpose:** Permanent reference document for AI-assisted development. Read before every change.

---

## 1. Project Overview

Tournament Points Table is a professional tournament management web app for university/school sports events. It manages multi-game tournaments with team games (pool stage + knockout brackets), individual athlete competitions, and lobby/battle-royale-style events. All data persists to Firebase Firestore with real-time sync across devices.

The app is used by the **Uni Sports Council (USC)** — evidenced by branding, logos, and the Vercel CSP headers allowing iframe embedding on `unisportscouncil.in`.

---

## 2. Full Tech Stack (Exact Versions)

| Technology | Version | Purpose |
|---|---|---|
| React | ^19.2.4 | UI framework |
| React DOM | ^19.2.4 | DOM rendering |
| Vite | ^8.0.0 | Build tool + dev server |
| Tailwind CSS | ^4.2.1 | Utility CSS (via `@tailwindcss/vite` plugin ^4.2.1) |
| Firebase | ^12.10.0 | Backend (Firestore database) |
| html2canvas | ^1.4.1 | Client-side screenshot/export |
| Node.js | >=22.0.0 | Runtime (enforced in `engines`) |
| ESLint | ^9.39.4 | Linting |
| @vitejs/plugin-react | ^6.0.0 | React Vite plugin |

**Deployment targets:** Netlify (siteId: `f06ea037-66cf-4832-86ac-b10d9dbad7e3`), Vercel (rewrites + security headers)

**No backend server.** The entire app is a static SPA. Firebase Firestore is the only persistence layer, accessed directly from the browser via the Firebase JS SDK.

---

## 3. Complete Project File Tree

```
tournament-app/
├── .claude/
│   └── launch.json                    # Claude Preview dev server config
├── .gitignore                         # Standard ignores (node_modules, dist, .netlify)
├── .netlify/
│   ├── netlify.toml                   # Generated Netlify build config
│   └── state.json                     # Netlify site ID binding
├── .npmrc                             # legacy-peer-deps=true
├── dev.mjs                            # Custom Vite dev server launcher (host: true)
├── dist/                              # Production build output
├── dist.zip                           # Zipped dist for manual deployment
├── eslint.config.js                   # ESLint flat config (react-hooks, react-refresh)
├── firestore.rules                    # Firestore security rules (tournaments, logos, config)
├── index.html                         # SPA entry point with meta tags and font preconnects
├── netlify.toml                       # Netlify build + SPA redirect config
├── package.json                       # Dependencies, scripts, engine requirements
├── package-lock.json                  # Lockfile
├── public/
│   ├── favicon.svg                    # App favicon
│   ├── icons.svg                      # SVG icon sprite
│   ├── SWW and USC.png                # Organization logo (SWW + USC)
│   ├── USC.png                        # USC logo
│   └── _redirects                     # Netlify SPA fallback redirect
├── README.md                          # Default Vite template readme
├── vercel.json                        # Vercel rewrites + security headers (CSP, X-Frame-Options)
├── vite.config.js                     # Vite config (react plugin, tailwindcss plugin, no sourcemaps)
│
├── src/
│   ├── main.jsx                       # React root render (StrictMode)
│   ├── App.jsx                        # Root component: providers + routing + auth gate
│   ├── index.css                      # Tailwind imports + custom theme + animations + utilities
│   │
│   ├── assets/
│   │   ├── hero.png                   # Hero image asset
│   │   ├── react.svg                  # React logo (unused)
│   │   └── vite.svg                   # Vite logo (unused)
│   │
│   ├── context/
│   │   ├── AuthContext.jsx            # Auth provider: login, logout, password management, lockout
│   │   ├── SyncContext.jsx            # Sync status provider: save status, online state, progress
│   │   └── TournamentContext.jsx      # Main state: useReducer + Firestore sync + auto-save
│   │
│   ├── components/
│   │   ├── BracketView.jsx            # Horizontal knockout bracket visualization
│   │   ├── ChampionDisplay.jsx        # Champion banner with confetti + podium
│   │   ├── EmptyState.jsx             # Reusable empty state with icon/title/action
│   │   ├── ErrorBoundary.jsx          # React error boundary with recovery UI
│   │   ├── FirstTimeSetup.jsx         # 3-step setup wizard (name, password, recovery key)
│   │   ├── ImageUpload.jsx            # Image upload with compression (200x200 PNG)
│   │   ├── KnockoutFixtures.jsx       # Knockout match list with result entry
│   │   ├── Layout.jsx                 # App shell: sidebar, mobile nav, responsive layout
│   │   ├── LoadingScreen.jsx          # Full-screen loading with USC branding
│   │   ├── LoginModal.jsx             # Admin login, recovery, and setup modal
│   │   ├── Modal.jsx                  # Reusable modal with focus trap + ConfirmDialog
│   │   ├── OfflineBanner.jsx          # Offline connectivity banner
│   │   ├── PointsBreakdownPopover.jsx # Clickable points with detailed breakdown modal
│   │   ├── PointsExplainer.jsx        # "How Points Work" expandable explainer
│   │   ├── QualificationPanel.jsx     # Pool qualification status display
│   │   ├── SaveIndicator.jsx          # Cloud save status with progress bar
│   │   ├── TeamLogo.jsx               # Team logo or colored initials fallback
│   │   └── Toast.jsx                  # Toast notification system (auto-dismiss)
│   │
│   ├── pages/
│   │   ├── Dashboard.jsx              # Main leaderboard, stats, team comparison
│   │   ├── GameView.jsx               # Team game view: pool→second round→knockout flow
│   │   ├── IndividualGameView.jsx     # Individual game: categories, athletes, results, points
│   │   ├── LobbyGameView.jsx          # Lobby game: entries, sessions, standings
│   │   ├── MatchManagement.jsx        # All matches list with CRUD + bulk entry
│   │   ├── TeamManagement.jsx         # Team CRUD with logos and profiles
│   │   ├── AthleteManagement.jsx      # Athlete CRUD with reg number validation
│   │   ├── GamePoolManagement.jsx     # Game + pool + knockout configuration
│   │   └── Settings.jsx               # Tournament settings, password, export/import, sync
│   │
│   └── utils/
│       ├── auth.js                    # SHA-256 hashing, lockout, session, activity tracking
│       ├── breakdownData.js           # Per-team points breakdown calculations
│       ├── database.js                # Firestore CRUD, logo management, debounced save, subscriptions
│       ├── firebase.js                # Firebase init (memory cache, clearAndReinit)
│       ├── imageCompression.js        # Canvas-based PNG compression (200x200, <500KB)
│       ├── individualPoints.js        # Individual game scoring (placement + participation + cap)
│       ├── knockout.js                # Bracket generation, seeding, advancement, bonus points
│       ├── lobbyPoints.js             # Lobby game scoring (entry-based, podium stacking)
│       ├── points.js                  # Core scoring: match points, tiebreaker, combined stats
│       ├── sampleData.js              # Demo data generator (8 teams, 3 games)
│       ├── secondRound.js             # Second round stage logic (round-robin, play-in)
│       ├── validation.js              # Input validation, import validation, sanitization
│       └── __tests__/
│           ├── edge-cases.test.js     # NaN guards, dense ranking, empty inputs, dedup
│           ├── scoring-hotfix.test.js # Spam cap, bye=4pts, tiebreaker protocol
│           └── scoring-v2.test.js     # Shared ranking, lobby scoring, cap clarification
```

---

## 4. Complete Database Schema (Firebase Firestore)

### Collection: `tournaments`

**Document:** `tournaments/main` (single document storing all tournament data)

| Field | Type | Description |
|---|---|---|
| `tournament` | Object | `{ name: string, logo: null (stored separately), startDate: string, endDate: string }` |
| `teams` | Array<Object> | Each: `{ id, name, shortCode, logo: null (stored separately) }` |
| `games` | Array<Object> | Each: `{ id, name, emoji, type: 'team'|'individual'|'lobby' }` |
| `pools` | Array<Object> | Each: `{ id, name, gameId, teamIds: string[], isSecondRound?: boolean }` |
| `matches` | Array<Object> | Pool matches. Each: `{ id, poolId, teamAId, teamBId, status, result, absentTeamId, scoreA?, scoreB?, isSecondRound? }` |
| `knockoutConfig` | Object | Keyed by gameId. Each: `{ enabled, qualifyCount, seedingFormat, stage, bonusPoints: {enabled, qf, sf, final, third}, twoLeg, secondRoundPoolId? }` |
| `knockoutMatches` | Array<Object> | Each: `{ id, gameId, round, matchNumber, teamAId, teamBId, status, result, absentTeamId, extraTime, penalties, nextMatchId, slot, _sfMatchIds? }` |
| `qualifiedTeams` | Object | Keyed by gameId. Each value: Array<`{ teamId, poolId, rank, manual }`> |
| `athletes` | Array<Object> | Each: `{ id, name, regNumber (8 digits), teamId, gameId }` |
| `categories` | Array<Object> | Each: `{ id, name, gameId, status, athleteIds: string[] }` |
| `individualResults` | Array<Object> | Each: `{ id, gameId, categoryId, placements: {first, second, third}, participants: string[], absentees: string[] }` |
| `individualPointsConfig` | Object | Keyed by gameId. Each: `{ first, second, third, participation, maxParticipationCap, categoryOverrides?: { [catId]: {...} } }` |
| `lobbyEntries` | Array<Object> | Each: `{ id, gameId, teamId, entryName }` |
| `lobbyResults` | Array<Object> | Each: `{ id, gameId, sessionName, placements: {first, second, third}, participantEntryIds: string[] }` |
| `lobbyPointsConfig` | Object | Keyed by gameId. Each: `{ first, second, third, participation, maxParticipationCap, maxEntriesPerSchool? }` |
| `lobbyGameStatus` | Object | Keyed by gameId. Values: `'active'` or `'completed'` |
| `_updatedAt` | Timestamp | Server timestamp, set on every save |

### Collection: `logos`

Each document stores a single logo as a base64 data URL.

| Document ID | Field | Type | Description |
|---|---|---|---|
| `tournament` | `data` | string | Tournament logo (base64 PNG) |
| `{teamId}` | `data` | string | Team logo (base64 PNG) |
| (any) | `_updatedAt` | Timestamp | Server timestamp |

**Why logos are separate:** Logos are stored in individual documents to avoid exceeding Firestore's 1MB document limit. They are compressed to <500KB PNG and loaded/saved separately from main tournament data.

### Collection: `config`

**Document:** `config/auth`

| Field | Type | Description |
|---|---|---|
| `passwordHash` | string (64 hex chars) | SHA-256 hash of admin password (salted) |
| `recoveryKeyHash` | string (64 hex chars) | SHA-256 hash of recovery key (salted) |
| `_updatedAt` | Timestamp | Server timestamp |

### Firestore Security Rules

```
tournaments/{docId}: read=public, write=validated (requires teams/games/matches arrays, size limits)
logos/{logoId}: read=public, write=validated (string data <=3MB)
config/{docId}: read=BLOCKED, write=validated (64-char hex hashes only)
Everything else: denied
```

**Critical:** `config/auth` reads are blocked. Auth is stored in localStorage as primary, Firestore is write-only backup.

### No RLS Policies / No RPC Functions / No Triggers

This is Firestore, not Supabase. Security is handled by Firestore rules only. There are no server-side triggers, functions, or stored procedures.

---

## 5. Auth Flow

### Roles

There are only **two roles**: Admin (authenticated) and Viewer (unauthenticated, read-only).

There are no "verifier" or "student" roles. This is a tournament management app, not a student check-in system.

### First-Time Setup Flow

1. App loads → `AuthProvider` checks `localStorage` for `tournament_auth`
2. If no auth data AND no existing tournament data in Firestore → `needsSetup = true`
3. `FirstTimeSetup` wizard renders:
   - Step 1: Tournament name + logo → dispatches `SET_TOURNAMENT`
   - Step 2: Admin password → `setupPassword()` → SHA-256 hash with salt `'tournament-app-v1-salt::'` → saves to localStorage + Firestore
   - Step 3: Recovery key display (12-char, formatted XXXX-XXXX-XXXX)
4. Admin session set in `sessionStorage`

### Login Flow

1. User clicks lock icon in sidebar → `LoginModal` opens
2. User enters password → `login(password)` called
3. Password hashed with `crypto.subtle.digest('SHA-256', SALT + password)`
4. Hash compared against `localStorage.tournament_auth.passwordHash`
5. On match: session set, lockout cleared, `isAdmin = true`
6. On failure: lockout counter incremented (5 failures = 5-minute lockout)

**Code path:** `Layout.jsx` → `LoginModal.jsx` → `AuthContext.login()` → `auth.js:hashPassword()` → compare against `auth.js:getAuthData()`

### Session Management

- Admin session stored in `sessionStorage` (key: `tournament_admin_session`)
- Activity tracked via `sessionStorage` (key: `tournament_last_activity`)
- Inactivity timeout: 30 minutes (checked every 30 seconds)
- On timeout: auto-logout with toast notification

### Password Recovery

1. User clicks "Forgot Password?" in LoginModal
2. Enters recovery key (XXXX-XXXX-XXXX format)
3. Key is uppercased, dashes stripped, hashed, compared against stored `recoveryKeyHash`
4. On match: user sets new password
5. Recovery attempts share the same lockout mechanism as login

### Lockout Mechanism

- Stored in `localStorage` (key: `tournament_lockout`) AND React ref (defense-in-depth)
- After 5 failed attempts: locked for 5 minutes
- Clearing localStorage doesn't bypass because React state persists until page refresh
- Countdown displayed in UI, ticks every second

---

## 6. Features Documentation

### Feature 1: Overall Leaderboard (Dashboard)

**What it does:** Displays ranked standings of all teams across all games combined.

**Files involved:**
- `src/pages/Dashboard.jsx` — renders leaderboard table
- `src/utils/points.js` — `getTeamStatsForMatches()`, `getTeamCombinedStats()`, `sortTeamsByTiebreaker()`
- `src/utils/individualPoints.js` — `getIndividualPointsForTeam()`, `getTeamMedals()`
- `src/utils/lobbyPoints.js` — `getLobbyPointsForTeam()`
- `src/utils/knockout.js` — `getChampion()`, `getTeamFurthestRound()`

**Database reads:** teams, games, pools, matches, knockoutMatches, knockoutConfig, athletes, individualResults, individualPointsConfig, lobbyEntries, lobbyResults, lobbyPointsConfig

**Data flow:**
1. For each team, aggregate points from: pool matches + knockout matches (with bonus) + individual game points + lobby game points
2. Sort using master tiebreaker: Points → Wins+Golds → Silvers → Bronzes
3. Assign dense ranks (tied teams share rank, next gets rank+1)
4. Display with team logos, stats columns (GP, W, L, D, B, PTS), champion badges

### Feature 2: Team Game (Pool Stage)

**What it does:** Round-robin pool stage for team-based games (Cricket, Kabaddi, Football, etc.)

**Files involved:**
- `src/pages/GameView.jsx` — pool standings display + advancement controls
- `src/pages/MatchManagement.jsx` — match CRUD + bulk entry
- `src/pages/GamePoolManagement.jsx` — pool creation + team assignment
- `src/utils/points.js` — `getTeamStatsForMatches()`, `getMatchPoints()`
- `src/context/TournamentContext.jsx` — ADD_POOL, ADD_MATCH, UPDATE_MATCH, etc.

**Scoring rules (pool stage):**
- Win: 3 base + 1 participation = **4 pts**
- Loss: 0 base + 1 participation = **1 pt**
- Draw: 1 base + 1 participation = **2 pts**
- Bye/Walkover (present team): **4 pts** (equal to win)
- No-show/Forfeit (absent team): **0 pts**

### Feature 3: Team Game (Knockout Stage)

**What it does:** Single-elimination bracket from qualified pool teams.

**Files involved:**
- `src/pages/GameView.jsx` — bracket generation + advancement
- `src/components/BracketView.jsx` — bracket visualization
- `src/components/KnockoutFixtures.jsx` — match list + result entry
- `src/components/ChampionDisplay.jsx` — champion + podium display
- `src/components/QualificationPanel.jsx` — qualified teams display
- `src/utils/knockout.js` — `generateBracket()`, `advanceWinner()`, `advanceLoserToThird()`, `getKnockoutMatchPoints()`

**Knockout bonus (contested wins only, NOT walkovers):**
- QF Win: +1
- SF Win: +2
- Final Win: +3
- 3rd Place Win: +1

**Bracket features:**
- Cross-pool seeding (A1 vs B2, B1 vs A2)
- Configurable starting round (RO32/RO16/QF/SF/Final)
- Auto-bye for odd numbers (pad to next power of 2)
- Winner auto-advances to next match
- SF losers auto-enter 3rd place match
- Manual bracket customization option

### Feature 4: Second Round Stage

**What it does:** Optional intermediate stage between pool and knockout. Pool toppers play round-robin, top 3 + play-in winner go to semifinals.

**Files involved:**
- `src/pages/GameView.jsx` — second round tab + advancement
- `src/utils/secondRound.js` — all second round logic

**Scoring rules (second round — different from pool!):**
- Win: **3 pts** (no participation point)
- Loss: **0 pts**
- Draw: **1 pt**
- Rankings: Points → Goal Difference → Goals Scored

**Flow:** Pool toppers → Second Round round-robin → Top 3 to SF + Bottom 2 play-in → Winner gets 4th SF spot

### Feature 5: Individual Game Management

**What it does:** Manages individual athlete competitions (e.g., Athletics, Swimming) with categories, placements, and per-athlete scoring.

**Files involved:**
- `src/pages/IndividualGameView.jsx` — full individual game UI
- `src/pages/AthleteManagement.jsx` — athlete CRUD
- `src/utils/individualPoints.js` — all scoring logic
- `src/context/TournamentContext.jsx` — ADD_ATHLETE, ADD_CATEGORY, SET_INDIVIDUAL_RESULT, etc.

**Default scoring:**
- 1st place: 5 bonus + 1 participation = **6 pts**
- 2nd place: 3 bonus + 1 participation = **4 pts**
- 3rd place: 1 bonus + 1 participation = **2 pts**
- Participant: 0 bonus + 1 participation = **1 pt**
- Absent/DNS: **0 pts**

**Anti-spam:** `maxParticipationCap` limits participation points per team per game. Placement bonuses are NEVER capped.

**Per-category overrides:** Each category can have its own points config, falling back to game-level then default.

### Feature 6: Lobby Game Management

**What it does:** Manages lobby/battle-royale games (e.g., BGMI/ESports) where multiple entries compete in sessions.

**Files involved:**
- `src/pages/LobbyGameView.jsx` — full lobby game UI
- `src/utils/lobbyPoints.js` — scoring logic

**Key features:**
- Schools register multiple "entries" (teams within a team)
- Entries compete in "sessions" (matches)
- Podium stacking: same school CAN win 1st, 2nd, AND 3rd
- Participation points per ENTRY per session (not per school)
- `maxParticipationCap` limits total participation pts per school per game

### Feature 7: Points Breakdown Popover

**What it does:** Clicking any points number shows a detailed modal breakdown of how those points were calculated.

**Files involved:**
- `src/components/PointsBreakdownPopover.jsx` — modal UI + calculation
- `src/utils/breakdownData.js` — `getTeamFullBreakdown()`, `getPoolPointsBreakdown()`, `getKnockoutPointsBreakdown()`, `getGamePointsBreakdown()`, `getSpecificMatchesForStat()`

**Breakdown types:** total, knockout, pool, game-specific, individual, lobby, wins, losses, draws, byes

### Feature 8: Export/Import

**What it does:** Export tournament data as JSON, import from JSON file.

**Files involved:**
- `src/pages/Settings.jsx` — export/import buttons
- `src/utils/validation.js` — `validateImportData()`

**Export:** Serializes all state (tournament, teams, games, pools, matches, knockoutConfig, knockoutMatches, qualifiedTeams, athletes, categories, individualResults, individualPointsConfig, lobbyEntries, lobbyResults, lobbyPointsConfig, lobbyGameStatus). Downloads as `.json`. Auth data is exported separately via `getExportAuth()`.

**Import:** Validates JSON structure, enforces size limits, sanitizes all strings, validates team/game/match structures. Replaces all existing data.

### Feature 9: Screenshot Export

**What it does:** Takes screenshot of the dashboard using html2canvas.

**Files involved:**
- `src/pages/Dashboard.jsx` — `handleScreenshot()` function
- `html2canvas` library (client-side)

**Flow:** Captures a DOM element as canvas → converts to PNG blob → triggers download.

### Feature 10: Real-time Sync

**What it does:** Changes made on one device appear on all other devices viewing the same tournament.

**Files involved:**
- `src/utils/database.js` — `subscribeToChanges()` uses Firestore `onSnapshot()`
- `src/context/TournamentContext.jsx` — subscribes on mount, dispatches `_SYNC_FROM_FIRESTORE`
- `src/context/SyncContext.jsx` — tracks save status + progress

**Mechanism:** Firestore `onSnapshot()` listeners on both `tournaments/main` document and `logos` collection. Changes from other tabs/devices trigger re-render. Local writes are filtered out via `hasPendingWrites`.

**Auto-save:** Debounced (1.5s delay, 10s on consecutive errors). Saves on every state change that isn't UI-only. Warns on page unload if unsaved changes exist.

### Feature 11: Dark Mode

**What it does:** Toggle between dark (default) and light themes.

**Files involved:**
- `src/context/TournamentContext.jsx` — `darkMode` state + `TOGGLE_DARK_MODE` action
- `src/index.css` — theme variables for both modes
- Every component — reads `darkMode` from context for conditional classes

### Feature 12: Offline Support

**What it does:** Shows offline banner when connection lost, queues saves.

**Files involved:**
- `src/components/OfflineBanner.jsx` — displays banner
- `src/context/SyncContext.jsx` — `isOnline` state from browser events
- `src/utils/database.js` — `onConnectionChange()`

**Note:** Firebase is configured with `memoryLocalCache()` — no IndexedDB persistence. Data comes fresh from server on each page load. Offline edits are NOT persisted.

---

## 7. API Routes

**There are no API routes.** This is a purely client-side SPA. All data access is via the Firebase JS SDK directly from the browser:

| Operation | Firebase Method | Document Path |
|---|---|---|
| Load tournament | `getDoc()` | `tournaments/main` |
| Save tournament | `setDoc()` | `tournaments/main` |
| Subscribe to changes | `onSnapshot()` | `tournaments/main` + `logos/*` |
| Load logos | `getDocs()` | `logos/*` |
| Save logo | `setDoc()` | `logos/{id}` |
| Delete orphan logos | `writeBatch()` | `logos/*` |
| Load auth | `getDoc()` | `config/auth` (BLOCKED by rules) |
| Save auth | `setDoc()` | `config/auth` |

---

## 8. How Live Stats / Realtime Works

**Mechanism:** Firestore `onSnapshot()` — real-time listeners, NOT polling, NOT WebSocket.

**Implementation in `database.js:subscribeToChanges()`:**
1. Two listeners established: one on `tournaments/main` document, one on `logos` collection
2. `includeMetadataChanges: true` — receives events for both server and local writes
3. `snap.metadata.hasPendingWrites` — skips events from local writes (prevents echo)
4. On server change: merges tournament data with cached logos → calls callback
5. `TournamentContext` dispatches `_SYNC_FROM_FIRESTORE` to update React state
6. Uses `isSyncingRef` flag to prevent auto-save from triggering on incoming sync

---

## 9. How Screenshot/PDF Export Works

**Library:** `html2canvas` (^1.4.1) — client-side only

**How it works (Dashboard.jsx):**
1. User clicks screenshot button
2. `html2canvas(targetElement)` captures DOM as canvas
3. Canvas converted to PNG blob
4. Blob wrapped in object URL
5. Programmatic `<a>` click triggers download

**There is no PDF export.** Only PNG screenshots via html2canvas.

---

## 10. How CSV Export Works

**There is no CSV export.** The only export is JSON (full tournament data) and PNG screenshot. No CSV generation exists in the codebase.

---

## 11. Potential Bugs and Issues

### High Severity

1. **Firebase API key exposed in source code** (`firebase.js:11`): The Firebase config including API key is hardcoded. While Firebase API keys are designed to be public (security is in Firestore rules), this still means anyone can write to the database if they craft valid payloads.

2. **Auth stored in localStorage is bypassable:** Admin auth hashes are in `localStorage`. A user can inspect and copy them, or use devtools to set `sessionStorage.tournament_admin_session = 'true'`. The lockout mechanism uses both localStorage and React ref, but a page refresh resets the ref.

3. **No server-side auth validation:** Firestore rules for `tournaments` allow `write: if true` (with basic structure validation). Any client can write tournament data without being authenticated. The admin password only gates the UI, not the database.

4. **`config/auth` reads blocked but writes open:** Anyone who knows the schema can overwrite the password hash in Firestore (if they can craft a valid 64-char hex string). This could lock out the legitimate admin.

### Medium Severity

5. **Race condition in auto-save:** `debouncedSave` uses a 1.5s timer. If two tabs edit simultaneously, the last write wins. No conflict resolution or merge strategy exists.

6. **`prevStateForSaveRef` comparison is JSON.stringify:** Serializing the entire state on every render for comparison could be expensive with large tournaments (500 matches, 500 athletes).

7. **Second round scoring uses different point system:** Pool stage uses 4/2/1 (W/D/L with participation), but second round uses 3/1/0 (no participation point). This inconsistency might confuse users and affect overall point calculations. The second round points don't flow back to the main leaderboard in the same way.

8. **Logo compression race condition:** `ensureCompressed()` is async but `simpleHash()` is sync. The hash is computed on the original data, but the saved data is compressed. On next save, the hash comparison might not match.

### Low Severity

9. **`idCounter` starts from `Date.now()`:** Two tabs opened at the same millisecond could generate duplicate IDs.

10. **Missing error handling in several places:** Logo load/save failures are silently swallowed. Orphan deletion failures are silent. Firebase write failures in auth sync are silent.

11. **No pagination:** The entire tournament (up to 500 matches, 500 athletes) is loaded into memory at once and stored in a single Firestore document.

12. **`sortTeamsByTiebreaker` passed extra arg:** In `knockout.js:calculateQualifiers()`, `sortTeamsByTiebreaker(teamStats, poolMatches)` passes `poolMatches` as second arg, but the function only takes one parameter. This is harmless but misleading.

---

## 12. Business Rules Embedded in Code

### Scoring Rules

| Game Type | Outcome | Points |
|---|---|---|
| Team (Pool) | Win | 3 base + 1 participation = 4 |
| Team (Pool) | Loss | 0 base + 1 participation = 1 |
| Team (Pool) | Draw | 1 base + 1 participation = 2 |
| Team (Pool) | Bye (present) | 4 (equal to win) |
| Team (Pool) | Bye (absent) | 0 |
| Knockout | Same as pool + bonus for contested wins only |
| KO Bonus | QF: +1, SF: +2, Final: +3, 3rd Place: +1 |
| Individual | 1st: 5+1=6, 2nd: 3+1=4, 3rd: 1+1=2, Participant: 1 |
| Lobby | Same scale as individual, per entry |

### Second Round Scoring (Different!)

| Outcome | Points |
|---|---|
| Win | 3 |
| Draw | 1 |
| Loss | 0 |
| Ranking | Points → Goal Difference → Goals Scored |

### Master Tiebreaker Hierarchy

1. Total Overall Points (descending)
2. Total Tournament Wins = team game wins + individual golds (descending)
3. Most 2nd Place / Runner-Up finishes (descending)
4. Most 3rd Place finishes (descending)
5. **NEVER Head-to-Head. NEVER Alphabetical.**

### Validation Rules

- Registration number: exactly 8 digits, unique across tournament
- Team name: max 100 chars, unique (case-insensitive)
- Short code: max 4 chars
- Game name: max 100 chars, unique (case-insensitive)
- Tournament name: max 200 chars
- Password: 6-128 characters, not whitespace-only
- Image: max 2MB, no SVG (security), compressed to 200x200 PNG
- Logo data URL: max 3MB base64 string
- Recovery key: 12 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no I, O, 0, 1)

### Size Limits

- Max teams: 64
- Max games: 20
- Max pools: 40
- Max matches: 500
- Max knockout matches: 200
- Max athletes: 500
- Max categories: 100
- Max individual results: 500
- Max import file size: 5MB

### Lockout Rules

- 5 failed login/recovery attempts → 5-minute lockout
- Applies to both password login and recovery key attempts
- Countdown displayed in UI

### Inactivity Timeout

- Admin session expires after 30 minutes of inactivity
- Activity tracked on: mousedown, keydown, scroll, touchstart
- Checked every 30 seconds

---

## 13. Environment Variables

**There are no environment variables.** The Firebase config is hardcoded in `src/utils/firebase.js`:

| Config Key | Purpose |
|---|---|
| `apiKey` | Firebase API key for authentication |
| `authDomain` | Firebase Auth domain |
| `projectId` | Firestore project: `tournament-points-table` |
| `storageBucket` | Firebase Storage bucket |
| `messagingSenderId` | Firebase Cloud Messaging sender |
| `appId` | Firebase app identifier |
| `measurementId` | Google Analytics measurement ID |

---

## 14. Regression Test Checklist

### Authentication
- [ ] First-time setup wizard appears when no auth data exists
- [ ] Can set admin password (min 6 chars)
- [ ] Recovery key is generated and displayed correctly (XXXX-XXXX-XXXX)
- [ ] Can copy recovery key to clipboard
- [ ] Can log in with correct password
- [ ] Login fails with incorrect password
- [ ] Lockout triggers after 5 failed attempts
- [ ] Lockout countdown displays correctly
- [ ] Can recover password with recovery key
- [ ] Recovery fails with wrong key
- [ ] Can change password (requires current password)
- [ ] Admin session persists across page navigation
- [ ] Admin session expires after 30 min inactivity
- [ ] Logout clears admin session
- [ ] Non-admin cannot perform admin actions (toasts "Unauthorized")

### Team Management
- [ ] Can add team with name and short code
- [ ] Can upload team logo (compressed to 200x200 PNG)
- [ ] Can edit team name, code, logo
- [ ] Can delete team (cascades to pools, matches, athletes, entries)
- [ ] Duplicate team names are rejected
- [ ] Team profile modal shows correct stats
- [ ] Team logos display correctly (or initials fallback)

### Game Management
- [ ] Can create team game with emoji
- [ ] Can create individual game with emoji
- [ ] Can create lobby game with emoji
- [ ] Can edit game name and emoji
- [ ] Can delete game (cascades to pools, matches, config, entries)
- [ ] Game type badge displays correctly (Team/Individual/Lobby)

### Pool Management
- [ ] Can create pool for a game
- [ ] Can assign teams to pool
- [ ] Same team cannot be in two pools of the same game
- [ ] Can remove team from pool (cascades pool matches)
- [ ] Can delete pool (cascades matches)
- [ ] Pool standings table shows correct stats

### Match Management (Pool Stage)
- [ ] Can add pool match (two different teams)
- [ ] Can set match result: teamA win, teamB win, draw, bye
- [ ] Can set bye with absent team selection
- [ ] Can enter scores (scoreA, scoreB)
- [ ] Can delete match
- [ ] Bulk result entry works for multiple matches
- [ ] Match filters work (game, status, type)
- [ ] Match status colors display correctly (upcoming, live, completed)

### Knockout Stage
- [ ] Can advance from pool to knockout
- [ ] Bracket generates with correct cross-pool seeding
- [ ] Byes auto-advance in first round
- [ ] Can enter knockout match results
- [ ] Winner auto-advances to next match
- [ ] SF losers auto-enter 3rd place match
- [ ] Knockout bonus points apply for contested wins only
- [ ] Knockout bonus does NOT apply for byes/walkovers
- [ ] Can force advance (ignore remaining pool matches)
- [ ] Can reset to pool stage
- [ ] Champion display shows with confetti
- [ ] Podium (1st/2nd/3rd) displays correctly
- [ ] Can choose starting round (RO32/RO16/QF/SF/Final)
- [ ] Can manually set bracket matchups
- [ ] Bracket visualization renders correctly

### Second Round Stage
- [ ] Can advance pool toppers to second round
- [ ] Second round round-robin matches generated correctly
- [ ] Second round standings use correct scoring (3/1/0)
- [ ] Second round rankings use Points → GD → Goals
- [ ] Can advance from second round to SF bracket
- [ ] Play-in match generated for bottom 2 teams
- [ ] Can reset second round

### Individual Game
- [ ] Can add athlete with name, 8-digit reg number, team, game
- [ ] Reg number validated (exactly 8 digits)
- [ ] Duplicate reg numbers rejected
- [ ] Can assign athlete to category
- [ ] Can create category
- [ ] Can enter results (1st, 2nd, 3rd placements + participants)
- [ ] No duplicate placements allowed
- [ ] Placement bonus + participation calculated correctly
- [ ] Absent athletes get 0 points
- [ ] Deleting athlete shifts placements up (2nd→1st, 3rd→2nd)
- [ ] Can configure per-game points (1st, 2nd, 3rd, participation)
- [ ] Can configure per-category point overrides
- [ ] Can reset category config to game default
- [ ] maxParticipationCap limits participation points per team
- [ ] Placement bonuses are NEVER capped
- [ ] Individual standings sorted: Points → Golds → Silvers → Bronzes

### Lobby Game
- [ ] Can add entry (school + optional entry name)
- [ ] Can create session with name
- [ ] Can set session placements (1st, 2nd, 3rd)
- [ ] Can mark entries as participants
- [ ] Podium stacking works (same school 1st + 2nd)
- [ ] Participation per entry per session
- [ ] maxParticipationCap works for lobby
- [ ] Can configure lobby points
- [ ] Can complete/reopen lobby game
- [ ] Standings aggregate across all sessions
- [ ] Deleting entry cascades to session results

### Dashboard / Leaderboard
- [ ] Leaderboard shows all teams with correct total points
- [ ] Points aggregate from: pool + knockout + individual + lobby
- [ ] Tiebreaker sorting is correct (Points → Wins+Golds → Silvers → Bronzes)
- [ ] Dense ranking works (tied teams share rank, no gaps)
- [ ] Champion badges show for completed games
- [ ] Medal counts (golds, silvers, bronzes) are correct
- [ ] Team comparison modal works
- [ ] Stats cards show correct totals
- [ ] Search/filter works on leaderboard
- [ ] Screenshot export generates PNG download

### Points Breakdown
- [ ] Clicking points opens breakdown popover
- [ ] Total breakdown shows all game sections
- [ ] Pool breakdown shows per-match detail
- [ ] Knockout breakdown shows per-match + bonus
- [ ] Individual breakdown shows per-category + per-athlete
- [ ] Lobby breakdown shows per-session
- [ ] W/L/D/B stat popover shows specific match list
- [ ] Game-specific breakdown shows pool + knockout split

### Settings
- [ ] Can edit tournament name
- [ ] Can set tournament dates
- [ ] Can upload/change tournament logo
- [ ] Can change admin password
- [ ] Export downloads valid JSON
- [ ] Import loads valid JSON and replaces data
- [ ] Import rejects invalid JSON (missing fields, bad types)
- [ ] Import rejects oversized files (>5MB)
- [ ] Load Sample populates demo data
- [ ] Reset Data clears everything
- [ ] Dark mode toggle works
- [ ] Sync status shows correctly (saving, saved, error, offline)
- [ ] Force save button works

### Data Persistence & Sync
- [ ] Data persists after page refresh
- [ ] Changes sync across tabs/devices in real-time
- [ ] Save indicator shows progress during logo upload
- [ ] Offline banner appears when disconnected
- [ ] Unsaved changes warn on page close
- [ ] Empty state is NOT saved over existing Firestore data on load failure
- [ ] Debounced save waits 1.5s before writing

### UI / Navigation
- [ ] Desktop sidebar navigates correctly
- [ ] Mobile bottom tabs navigate correctly
- [ ] Dark mode styling consistent across all pages
- [ ] Modals have focus trap and escape-to-close
- [ ] Toast notifications appear and auto-dismiss
- [ ] Loading screen shows during initial data load
- [ ] Error boundary catches and displays errors
- [ ] Responsive layout works on mobile/tablet/desktop

---

## 15. Change Log

| Date | Description | Files Modified | Test Results |
|---|---|---|---|
| | | | |

---

*End of SYSTEM_REFERENCE.md*
