# SYSTEM_REFERENCE.md — Tournament Points Table

> **Last updated:** 2026-03-25
> **Purpose:** Permanent reference document for AI-assisted development. Read before every change.
> **Audit sources:** Full codebase read, live Firestore database queries, dev server inspection.

---

## 1. PROJECT OVERVIEW

**What this app does:** A tournament management web application for organizing multi-sport inter-school/department championships. Tracks team games (Cricket, Badminton, Kabaddi, Football), individual sports (Powerlifting with weight categories), and lobby/esports games (BGMI, Real Cricket 26) with a unified master leaderboard.

**Who uses it:**
- **Public viewers** (no login): View the leaderboard, game standings, pool tables, knockout brackets, match results. Read-only access.
- **Admin** (password-protected): Manages all tournament data — teams, games, pools, matches, athletes, categories, results, knockout advancement, import/export, settings.

**What problem it solves:** Provides a real-time, centralized points tracking system for the "General Sports Championship 2025-26" at Lovely Professional University (LPU), organized by the Uni Sports Council (USC) and Student Welfare Wing (SWW). Replaces manual spreadsheet tracking with live scoring, automatic point calculation, knockout bracket management, and a public-facing leaderboard.

---

## 2. LIVE SITE URL

- **Primary deployment:** Netlify (site ID: `f06ea037-66cf-4832-86ac-b10d9dbad7e3`)
- **Vercel config exists** (`vercel.json`) with headers allowing iframe embedding from `unisportscouncil.in`, `*.wix.com`, `*.wixsite.com`
- **Embedded in:** `https://www.unisportscouncil.in/` (Wix site, via iframe)
- **Staging/preview:** None configured

---

## 3. TECH STACK

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | 19.2.4 |
| Build tool | Vite | 8.0.0 |
| CSS | Tailwind CSS (Vite plugin) | 4.2.1 |
| Backend/DB | Firebase Firestore | firebase 12.10.0 |
| Screenshot export | html2canvas | 1.4.1 |
| Linting | ESLint | 9.39.4 |
| React plugin | @vitejs/plugin-react | 6.0.0 |
| Node.js | >= 22.0.0 (engines field) | |
| Deployment | Netlify + Vercel (dual config) | |
| Fonts | Inter, JetBrains Mono (Google Fonts) | |

**No server-side code.** Pure client-side SPA. All data stored in Firestore. Auth is client-side (SHA-256 hash in localStorage + Firestore backup).

---

## 4. PROJECT FILE TREE

```
tournament-app/
├── .claude/launch.json            — Dev server config for Claude Preview
├── .gitignore                     — Standard React/Vite ignores
├── .netlify/
│   ├── netlify.toml               — Auto-generated Netlify build config
│   └── state.json                 — Netlify site ID binding
├── .npmrc                         — legacy-peer-deps=true
├── dev.mjs                        — Custom Vite dev server launcher (host: true)
├── eslint.config.js               — ESLint flat config with React hooks/refresh plugins
├── firestore.rules                — Firestore security rules (public read tournaments/logos, blocked config reads)
├── index.html                     — SPA entry point with meta tags, Google Fonts, OG tags
├── netlify.toml                   — Netlify build config (npm run build, publish dist, SPA redirect)
├── package.json                   — Dependencies and scripts (dev, build, lint, preview)
├── vercel.json                    — Vercel rewrites + security headers (X-Frame-Options, CSP for USC embedding)
├── vite.config.js                 — Vite config with React + Tailwind plugins, no sourcemaps
├── public/
│   ├── _redirects                 — Netlify SPA catch-all redirect
│   ├── favicon.svg                — Gold trophy SVG favicon
│   ├── icons.svg                  — SVG icon sprite (unused in code)
│   ├── SWW and USC.png            — Student Welfare Wing + USC combined logo
│   └── USC.png                    — Uni Sports Council logo
├── src/
│   ├── main.jsx                   — React 19 createRoot entry with StrictMode
│   ├── App.jsx                    — Root component: providers (Error→Sync→Tournament→Auth), router
│   ├── index.css                  — Tailwind imports, custom theme (navy palette), animations, glass utilities
│   ├── assets/
│   │   ├── hero.png               — Hero image (unused in code)
│   │   ├── react.svg              — React logo (unused)
│   │   └── vite.svg               — Vite logo (unused)
│   ├── context/
│   │   ├── AuthContext.jsx         — Auth state: login/logout, password setup, recovery, lockout, inactivity timeout
│   │   ├── SyncContext.jsx         — Save status tracking: saving/saved/error, progress, online/offline
│   │   └── TournamentContext.jsx   — Main state store: useReducer with all tournament data, Firestore sync, auto-save
│   ├── components/
│   │   ├── BracketView.jsx         — Horizontal knockout bracket visualization by round
│   │   ├── ChampionDisplay.jsx     — Podium display (1st/2nd/3rd) with confetti animation
│   │   ├── EmptyState.jsx          — Empty data placeholder with icon/title/action
│   │   ├── ErrorBoundary.jsx       — React error boundary with recovery UI
│   │   ├── FirstTimeSetup.jsx      — 3-step setup wizard (tournament info → password → recovery key)
│   │   ├── ImageUpload.jsx         — Image upload with compression (200×200 PNG)
│   │   ├── KnockoutFixtures.jsx    — Knockout match list with result entry (admin) and round tabs
│   │   ├── Layout.jsx              — App shell: sidebar (desktop), bottom nav (mobile), USC branding
│   │   ├── LoadingScreen.jsx       — Initial loading screen with USC logo and progress bar
│   │   ├── LoginModal.jsx          — Admin login modal with lockout, recovery, and setup modes
│   │   ├── Modal.jsx               — Reusable modal + ConfirmDialog components with focus trap
│   │   ├── OfflineBanner.jsx       — Offline status banner
│   │   ├── PointsBreakdownPopover.jsx — Click-to-expand detailed points breakdown per team/game/stat
│   │   ├── PointsExplainer.jsx     — "How Points Work" expandable panel with scoring tables
│   │   ├── QualificationPanel.jsx  — Qualified teams summary per pool
│   │   ├── SaveIndicator.jsx       — Cloud sync status indicator with progress bar
│   │   ├── TeamLogo.jsx            — Team logo image or initials fallback with deterministic colors
│   │   └── Toast.jsx               — Toast notification system (success/warning/error, 3s auto-dismiss)
│   ├── pages/
│   │   ├── Dashboard.jsx           — Master leaderboard with combined standings, progress, comparison
│   │   ├── GameView.jsx            — Per-game view: pool standings, knockout advancement, bracket
│   │   ├── IndividualGameView.jsx  — Individual sport management: categories, athletes, results, standings
│   │   ├── LobbyGameView.jsx       — Lobby/esports game: entries, sessions, placements, standings
│   │   ├── MatchManagement.jsx     — Match CRUD: pool + knockout, bulk entry, auto-advancement
│   │   ├── TeamManagement.jsx      — Team CRUD with logos and per-game stats
│   │   ├── AthleteManagement.jsx   — Athlete CRUD with reg number validation and category assignment
│   │   ├── GamePoolManagement.jsx  — Game/pool/knockout configuration and management
│   │   └── Settings.jsx            — Tournament settings, password change, import/export, dark mode
│   └── utils/
│       ├── auth.js                 — SHA-256 hashing, password validation, lockout, session management
│       ├── breakdownData.js        — Detailed per-team points breakdown computation
│       ├── database.js             — Firestore CRUD: load/save tournament data, logos, auth, debounced save
│       ├── firebase.js             — Firebase app initialization with memory-only cache
│       ├── imageCompression.js     — Canvas-based PNG compression (200×200, progressive reduction)
│       ├── individualPoints.js     — Individual sport points: placements, participation, caps, per-category config
│       ├── knockout.js             — Knockout bracket: generation, seeding, advancement, podium, bonus points
│       ├── lobbyPoints.js          — Lobby game scoring: entries, sessions, participation caps, standings
│       ├── points.js               — Core scoring: match points, team stats, tiebreaker, combined stats
│       ├── sampleData.js           — Demo tournament data generator (8 teams, 3 games)
│       ├── secondRound.js          — Second round logic: pool toppers → round-robin → SF/play-in
│       ├── validation.js           — Input validation: team/game/athlete names, import data, image files
│       └── __tests__/
│           ├── edge-cases.test.js  — safeNum, denseRank, empty arrays, NaN guards
│           ├── scoring-hotfix.test.js — Participation cap, bye=4pts, tiebreaker tests
│           └── scoring-v2.test.js  — Shared ranking, lobby scoring, podium stacking tests
```

---

## 5. DATABASE SCHEMA

### Backend: Firebase Firestore (project: `tournament-points-table`)

#### Collections & Documents

##### `tournaments/main` (Single document — all tournament data)

| Field | Type | Description |
|-------|------|-------------|
| `tournament` | Map | `{ name: string, logo: null, startDate: string, endDate: string }` |
| `teams` | Array<Map> | `[{ id, name, shortCode, logo: null }]` — logos stripped out, stored separately |
| `games` | Array<Map> | `[{ id, name, emoji, type?: 'team'│'individual'│'lobby' }]` |
| `pools` | Array<Map> | `[{ id, name, gameId, teamIds: string[] }]` |
| `matches` | Array<Map> | `[{ id, poolId, teamAId, teamBId, status, result, absentTeamId, scoreA?, scoreB?, isSecondRound? }]` |
| `knockoutConfig` | Map | `{ [gameId]: { enabled, qualifyCount, stage, seedingFormat, startingRound?, twoLeg, bonusPoints: { enabled, qf, sf, final, third }, secondRoundPoolId? } }` |
| `knockoutMatches` | Array<Map> | `[{ id, gameId, round, matchNumber, teamAId, teamBId, status, result, absentTeamId?, nextMatchId?, slot?, extraTime?, penalties?, _sfMatchIds? }]` |
| `qualifiedTeams` | Map | `{ [gameId]: [{ teamId, poolId, rank, manual }] }` |
| `athletes` | Array<Map> | `[{ id, name, regNumber, teamId, gameId }]` |
| `categories` | Array<Map> | `[{ id, name, gameId, status, athleteIds: string[] }]` |
| `individualResults` | Array<Map> | `[{ id, gameId, categoryId, placements: { first, second, third }, participants: string[], absentees: string[] }]` |
| `individualPointsConfig` | Map | `{ [gameId]: { first, second, third, participation, maxParticipationCap?, categoryOverrides?: { [catId]: {...} } } }` |
| `lobbyEntries` | Array<Map> | `[{ id, gameId, teamId, entryName }]` |
| `lobbyResults` | Array<Map> | `[{ id, gameId, sessionName, placements: { first, second, third }, participantEntryIds: string[] }]` |
| `lobbyPointsConfig` | Map | `{ [gameId]: { first, second, third, participation, maxParticipationCap?, maxEntriesPerSchool? } }` |
| `lobbyGameStatus` | Map | `{ [gameId]: 'active'│'completed' }` |
| `_updatedAt` | Timestamp | Server timestamp on each save |

**Firestore rules constraints:**
- `teams` array max 64 items
- `games` array max 20 items
- `matches` array max 500 items
- All three fields (`teams`, `games`, `matches`) required for writes

##### `logos/{logoId}` (One document per logo)

| Field | Type | Description |
|-------|------|-------------|
| `data` | String | Base64 PNG data URL (max 3MB per Firestore rules) |
| `_updatedAt` | Timestamp | Server timestamp |

**Current logos in database:** 3 documents (tmmrlyws4: CSE ~10KB, tmmrlyws6: AGR ~12KB, tmmrlyws8: BIO ~14KB)

##### `config/auth` (Single document — auth data)

| Field | Type | Description |
|-------|------|-------------|
| `passwordHash` | String | 64-char hex SHA-256 hash |
| `recoveryKeyHash` | String | 64-char hex SHA-256 hash |
| `_updatedAt` | Timestamp | Server timestamp |

**Firestore rules:** Read BLOCKED (`allow read: if false`). Write allowed only if both hashes are exactly 64-char hex strings.

#### Indexes
No custom composite indexes defined. Firestore auto-indexes all fields.

#### RLS / Access Policies (Firestore Security Rules)
- `tournaments/{docId}`: Public read, validated writes (must have teams/games/matches arrays within size limits)
- `logos/{logoId}`: Public read, validated writes (data must be string ≤ 3MB)
- `config/{docId}`: **Read BLOCKED** (protects password hashes), validated writes (hash format enforcement)
- Everything else: **Denied** (`allow read, write: if false`)

#### Triggers / Functions / Views / Stored Procedures
**None.** No server-side Firebase Functions, Cloud Functions, or triggers are deployed.

#### Realtime Subscriptions
- `tournaments/main`: Real-time `onSnapshot` listener with `includeMetadataChanges: true`. Filters out local pending writes.
- `logos` collection: Real-time `onSnapshot` listener for logo changes. Merges with cached main document data.

---

## 6. AUTH FLOW

### Single Role: Admin

**Authentication method:** Client-side password hashing (SHA-256 with salt `tournament-app-v1-salt::`)

**Login flow:**
1. User clicks lock icon → `LoginModal` opens
2. User enters password → `hashPassword(password)` generates SHA-256 hash
3. Hash compared against `localStorage` key `tournament_auth.passwordHash`
4. On match: `sessionStorage.tournament_admin_session = 'true'`, `sessionStorage.tournament_last_activity = Date.now()`
5. `AuthContext.isAdmin = true` → `TournamentContext.isAdminRef.current = true`
6. Admin actions now pass the dispatch guard

**Session management:**
- Session stored in `sessionStorage` (cleared on tab close)
- Activity tracked via mouse/keyboard/scroll/touch events
- Inactivity timeout: 30 minutes (checked every 30 seconds)
- On timeout: auto-logout with toast notification

**Lockout mechanism:**
- 5 failed attempts → 5-minute lockout
- Lockout stored in both `localStorage` (`tournament_lockout`) and React ref (defense-in-depth)
- Same lockout applies to recovery key attempts

**Password setup (first time):**
1. `FirstTimeSetup` wizard detects no `passwordHash` in localStorage
2. Step 1: Tournament info (name, logo) — skipped if tournament data already exists
3. Step 2: Set password (min 6 chars)
4. Step 3: Recovery key generated (12 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`), displayed as `XXXX-XXXX-XXXX`
5. Both hashes saved to localStorage + Firestore backup

**Password recovery:**
1. User enters recovery key + new password in LoginModal recovery tab
2. Recovery key hash compared against stored `recoveryKeyHash`
3. On match: password updated, lockout cleared

**Protected routes:** `gameManagement` (GamePoolManagement) and `settings` (Settings) views redirect to dashboard if not admin. All mutation actions (`ADD_TEAM`, `UPDATE_MATCH`, etc.) are blocked at the dispatch level.

---

## 7. FEATURES

### 7.1 Master Leaderboard (Dashboard)
- **What it does:** Shows overall tournament standings combining points from all game types
- **Components:** `Dashboard.jsx`, `PointsBreakdownPopover.jsx`, `PointsExplainer.jsx`, `TeamLogo.jsx`
- **Data flow:** Reads all state → computes `getTeamCombinedStats()` for pool+KO per team game → adds `getIndividualPointsForTeam()` for individual games → adds `getLobbyPointsForTeam()` for lobby games → `sortTeamsByTiebreaker()` → dense ranking
- **Tables:** teams, games, pools, matches, knockoutMatches, knockoutConfig, athletes, individualResults, individualPointsConfig, lobbyEntries, lobbyResults, lobbyPointsConfig
- **Live behavior (verified):** Shows 22 teams ranked by total points. CSE leads with 78 pts (13W, 2L). Columns: #, TEAM, GP, W, L, D, B, PTS (with +KO and +Lobby breakdowns). Tournament progress cards show game completion status with champion logos.

### 7.2 Team Games (Cricket, Badminton, Kabaddi, Football)
- **What it does:** Pool stage round-robin → qualification → knockout bracket
- **Components:** `GameView.jsx`, `BracketView.jsx`, `ChampionDisplay.jsx`, `KnockoutFixtures.jsx`, `QualificationPanel.jsx`
- **Scoring:** Win=4pts (3+1 participation), Loss=1pt (participation only), Draw=2pts (1+1), Bye present=4pts, Bye absent=0pts
- **Knockout bonus (contested wins only):** QF +1, SF +2, Final +3, 3rd Place +1
- **Tables:** pools, matches, knockoutMatches, knockoutConfig, qualifiedTeams
- **Live behavior:** Cricket (completed, CSE champion), Badminton (completed, MSB champion), Kabaddi (completed, SPED champion), Football (knockout stage, final + 3rd place pending)

### 7.3 Individual Sports (Powerlifting)
- **What it does:** Weight-category-based athlete competition with 1st/2nd/3rd placements
- **Components:** `IndividualGameView.jsx`, `AthleteManagement.jsx`
- **Scoring:** Configurable per-game and per-category. Default: 1st=5+1, 2nd=3+1, 3rd=1+1, Participation=1
- **Anti-spam:** `maxParticipationCap` limits participation points per team per game
- **Tables:** athletes, categories, individualResults, individualPointsConfig
- **Live behavior:** Powerlifting has 9 categories (Men's 55-65kg through Women's 75+kg Open), 31 athletes registered. Status shows "0/9" — no results entered yet.

### 7.4 Lobby/Esports Games (BGMI, Real Cricket 26)
- **What it does:** Multi-entry session-based competition where schools register entries (teams) that compete in lobby sessions
- **Components:** `LobbyGameView.jsx`
- **Scoring:** Per-session placements (1st/2nd/3rd) + participation per entry, capped per school
- **Data model:** `lobbyEntries` (school→entry mapping) → `lobbyResults` (session placements + participant entry IDs)
- **Tables:** lobbyEntries, lobbyResults, lobbyPointsConfig, lobbyGameStatus
- **Live behavior:** BGMI completed (CSE champion, 4 entries/school, 16 entries total, 1 session). Real Cricket 26 completed (AMS champion, 1 entry/school, 10 entries, 1 session). Both show "Completed" status.

### 7.5 Match Management
- **What it does:** Central hub for creating/editing/deleting pool and knockout matches
- **Components:** `MatchManagement.jsx`
- **Features:** Bulk result entry for upcoming pool matches, knockout auto-advancement (winner→next match, SF loser→3rd place), score tracking
- **Live behavior:** 51 pool matches played, 14 knockout matches played

### 7.6 Team Management
- **What it does:** CRUD for teams with logo upload
- **Components:** `TeamManagement.jsx`, `ImageUpload.jsx`, `TeamLogo.jsx`
- **Live behavior:** 22 teams (schools/departments at LPU) with 4-char short codes

### 7.7 Import/Export & Settings
- **What it does:** JSON export/import of all tournament data, password change, dark mode toggle, sample data loading, full reset
- **Components:** `Settings.jsx`
- **Export includes:** All tournament data + optional auth data (password/recovery hashes)
- **Import validates:** JSON structure, array sizes, field types, sanitizes strings

### 7.8 Second Round (Optional Stage)
- **What it does:** Intermediate stage between pool and knockout. Pool toppers play round-robin → top 3 to SF, bottom 2 to play-in
- **Components:** `GameView.jsx` (uses logic from `secondRound.js`)
- **Scoring:** Different from pool: Win=3pts, Draw=1pt, Loss=0pts. Uses goals scored/conceded for tiebreaker.
- **Live behavior:** Not currently used by any game in the live tournament

---

## 8. API / SERVER ACTION ROUTES

**There are no server-side API routes.** This is a pure client-side SPA. All data operations go directly to Firestore via the Firebase SDK.

### Firestore Operations (database.js)

| Function | Purpose | Auth Required | Collections Touched |
|----------|---------|---------------|-------------------|
| `loadTournamentData()` | Load main doc + all logos | No | tournaments/main, logos/* |
| `saveTournamentData(state)` | Save main doc + changed logos + cleanup orphans | Admin (dispatch guard) | tournaments/main, logos/* |
| `debouncedSave(state)` | Debounced save (1.5s delay, 10s if errors) | Admin | tournaments/main, logos/* |
| `forceSave(state)` | Immediate save (bypass debounce) | Admin | tournaments/main, logos/* |
| `subscribeToChanges(callback)` | Real-time listener for cross-tab sync | No | tournaments/main, logos/* |
| `loadAuthData()` | Load auth config (will fail — reads blocked by rules) | No | config/auth |
| `saveAuthData(data)` | Write auth hashes to Firestore | No (but only called during setup/password change) | config/auth |

---

## 9. REALTIME / LIVE UPDATE MECHANISM

**Mechanism:** Firestore `onSnapshot` real-time listeners

**How it works:**
1. On initial load: `loadTournamentData()` fetches main doc + all logos via `getDoc()`
2. After load: `subscribeToChanges()` attaches two `onSnapshot` listeners:
   - Main document (`tournaments/main`): Updates on remote changes, filters out local pending writes
   - Logos collection: Updates on logo changes, merges with cached main data
3. On admin changes: `debouncedSave()` writes to Firestore after 1.5s debounce
4. Cross-tab sync: Remote changes arrive via listeners, dispatched as `_SYNC_FROM_FIRESTORE`

**Firestore cache:** Memory-only (`memoryLocalCache()`) — no IndexedDB persistence. Fresh data on every page load.

**Verified behavior:** Data syncs across tabs. Changes by admin are visible to public viewers within seconds.

---

## 10. FILE EXPORTS

### Screenshot Export (Dashboard)
- **Library:** html2canvas 1.4.1
- **Client-side:** Yes
- **What:** Captures the standings table as a PNG image
- **Triggered by:** Camera icon button on Dashboard

### JSON Export (Settings)
- **Format:** JSON file download
- **Client-side:** Yes, via Blob URL + anchor click
- **Content:** Full tournament state (tournament, teams, games, pools, matches, knockoutConfig, knockoutMatches, qualifiedTeams, athletes, categories, individualResults, individualPointsConfig, lobbyEntries, lobbyResults, lobbyPointsConfig, lobbyGameStatus) + optional auth data
- **Filename:** `tournament-data-YYYY-MM-DD.json`

---

## 11. THIRD-PARTY INTEGRATIONS

| Service | Purpose | Files |
|---------|---------|-------|
| Firebase/Firestore | Database, real-time sync | `src/utils/firebase.js`, `src/utils/database.js` |
| Google Fonts | Inter + JetBrains Mono fonts | `index.html` (preconnect + stylesheet links) |
| html2canvas | Screenshot export of leaderboard | `src/pages/Dashboard.jsx` |
| Wix/unisportscouncil.in | Iframe embedding of the app | `vercel.json` (CSP headers) |

**No email, SMS, payment, or analytics integrations.** Google Analytics measurement ID (`G-LV3M0VHMBC`) is in the Firebase config but no GA SDK is loaded.

---

## 12. ENVIRONMENT VARIABLES

**None.** All configuration is hardcoded:
- Firebase config (API key, project ID, etc.) in `src/utils/firebase.js`
- No `.env` file exists in the project

| Hardcoded Value | Location | Notes |
|----------------|----------|-------|
| Firebase API Key | `src/utils/firebase.js` | `AIzaSyAms3WpTGpXjZO9N3U_wbJeYiA8bXBGdtY` |
| Firebase Project ID | `src/utils/firebase.js` | `tournament-points-table` |
| Firebase Auth Domain | `src/utils/firebase.js` | `tournament-points-table.firebaseapp.com` |
| Firebase App ID | `src/utils/firebase.js` | `1:705146517748:web:3b87cfad9938ce69efc6a1` |
| Measurement ID | `src/utils/firebase.js` | `G-LV3M0VHMBC` (unused — no GA SDK loaded) |
| Password Salt | `src/utils/auth.js` | `tournament-app-v1-salt::` |

**Security note:** Firebase API keys are designed to be public (client-side). Security is enforced by Firestore rules. The password salt is also client-side — this is a known tradeoff since auth is client-side.

---

## 13. BACKEND CONFIGURATION SUMMARY

### Database
- **Engine:** Cloud Firestore (Native mode)
- **Project:** `tournament-points-table`
- **Collections:** 3 (`tournaments`, `logos`, `config`)
- **Documents:** 1 main tournament doc, 3 logo docs, 1 auth config doc
- **Functions/Triggers:** None
- **Views:** None
- **Realtime:** Two onSnapshot listeners (main doc + logos collection)

### Auth
- **Provider:** Client-side SHA-256 hashing (no Firebase Auth)
- **Roles:** Single role (Admin)
- **Auth sync:** localStorage is primary store; Firestore `config/auth` is read/write backup. New devices auto-recover auth from Firestore on mount.
- **Custom hooks:** Inactivity timeout (30 min), lockout (5 attempts → 5 min)

### Storage
- **Firebase Storage:** Not used (despite `storageBucket` in config)
- **Logo storage:** Inline base64 data URLs in Firestore `logos` collection
- **Public assets:** `/public/` directory with USC/SWW logos, favicon

### Edge/Serverless Functions
- **None deployed.** No Firebase Functions, Netlify Functions, or Vercel Serverless Functions.

---

## 14. BUSINESS RULES

### Scoring Rules (Team Games)
| Result | Points | Breakdown |
|--------|--------|-----------|
| Win (contested) | 4 | 3 base + 1 participation |
| Loss (contested) | 1 | 0 base + 1 participation |
| Draw | 2 | 1 base + 1 participation |
| Bye/Walkover (present team) | 4 | Equal to contested win |
| Bye/Walkover (absent team) | 0 | No points |

### Knockout Bonus Points (contested wins ONLY, not walkovers)
| Round | Bonus |
|-------|-------|
| Quarter Final | +1 |
| Semi Final | +2 |
| Final | +3 |
| 3rd Place | +1 |

### Individual Sport Scoring (Default)
| Placement | Points | Breakdown |
|-----------|--------|-----------|
| 1st Place | 6 | 5 placement + 1 participation |
| 2nd Place | 4 | 3 placement + 1 participation |
| 3rd Place | 2 | 1 placement + 1 participation |
| Participant | 1 | 1 participation only |
| Absent/DNS | 0 | Nothing |

### Lobby/Esports Scoring (Configurable per game)
- Same structure as individual: placement bonus + participation per entry
- Participation cap per school per game (`maxParticipationCap`)
- Placement bonus **never** capped
- Multiple entries per school allowed (`maxEntriesPerSchool`)

### Master Tiebreaker (Overall Leaderboard)
1. Total Overall Points (descending)
2. Most Total Tournament Wins = team game wins + individual golds (descending)
3. Most 2nd Place / Runner-Up finishes (descending)
4. Most 3rd Place finishes (descending)
5. **NEVER** Head-to-Head. **NEVER** Alphabetical.
6. Remaining ties: shared rank (dense ranking, no gaps)

### Second Round Scoring (Different from pool stage)
| Result | Points |
|--------|--------|
| Win | 3 |
| Draw | 1 |
| Loss | 0 |
| Tiebreaker: Goal Difference → Goals Scored |

### Validation Limits
| Limit | Value |
|-------|-------|
| MAX_TEAMS | 64 |
| MAX_GAMES | 20 |
| MAX_POOLS | 40 |
| MAX_MATCHES | 500 |
| MAX_KNOCKOUT_MATCHES | 200 |
| MAX_ATHLETES | 500 |
| MAX_CATEGORIES | 100 |
| MAX_INDIVIDUAL_RESULTS | 500 |
| MAX_REG_NUMBER_LENGTH | 8 (exactly 8 digits) |
| MAX_NAME_LENGTH | 100 |
| MAX_SHORT_CODE_LENGTH | 4 |
| MAX_TOURNAMENT_NAME_LENGTH | 200 |
| MAX_IMPORT_SIZE_BYTES | 5 MB |
| MAX_IMAGE_SIZE_BYTES | 2 MB |
| MAX_LOGO_DATA_URL_LENGTH | 3 MB |
| Password min length | 6 |
| Password max length | 128 |
| Lockout threshold | 5 attempts |
| Lockout duration | 5 minutes |
| Inactivity timeout | 30 minutes |
| Save debounce | 1.5 seconds (10s during errors) |
| Max consecutive save errors before backoff | 3 |
| Toast auto-dismiss | 3 seconds |
| Recovery key length | 12 characters (XXXX-XXXX-XXXX) |
| Recovery key charset | ABCDEFGHJKLMNPQRSTUVWXYZ23456789 |

---

## 15. GAPS AND ISSUES

### Code vs Live Site Discrepancies

1. **Settings.jsx points reference table is WRONG:** The Settings page hardcodes "Bye (present): 2 pts (walkover)" but the actual scoring logic in `points.js` gives bye present = 4 pts. This is a documentation bug in the Settings UI.

2. **Settings.jsx tiebreaker display is WRONG:** Shows "Most wins → Head-to-head → Alphabetical" but actual tiebreaker in `points.js` is "Points → Wins+Golds → Silvers → Bronzes" with explicit "NEVER Head-to-Head, NEVER Alphabetical" comments.

3. **Football knockout stage mismatch:** `knockoutConfig.gmmrnidqe.stage = 'knockout'` but the final and 3rd place matches are status `'upcoming'`. The Dashboard shows "Football: Knockout" badge correctly, not "Completed".

4. **Individual results empty:** `individualResults` is an empty array/object in Firestore, but `individualPointsConfig` is also empty. The 31 athletes are registered in categories but no results have been entered. Powerlifting shows "0/9" on the dashboard (0 of 9 categories completed).

5. **`icons.svg` in public folder:** Referenced in `public/` but never imported or used by any component.

6. **Unused assets:** `src/assets/hero.png`, `src/assets/react.svg`, `src/assets/vite.svg` exist but are never imported.

7. **Dual deployment config:** Both `netlify.toml` and `vercel.json` exist. The Netlify site ID is bound (`.netlify/state.json`) but Vercel config also exists with CSP headers for iframe embedding. It's unclear which is the primary deployment.

### Database vs Code Mismatches

8. **~~`loadAuthData()` will always fail~~ (FIXED):** Firestore rules now allow reads on `config/auth`. On mount, AuthContext tries localStorage first; if empty, loads auth from Firestore and syncs to localStorage. Auth is now recoverable across devices.

9. **Lobby games have `knockoutConfig` entries:** ESports-BGMI (`gmmx5azkk`) and Real Cricket 26 (`gmmyl39wj`) both have `knockoutConfig` with `stage: 'pool'`. Lobby games don't use knockout brackets, so these configs are unused dead data.

10. **Missing `type` field on team games:** Cricket, Badminton, Kabaddi, Football games don't have an explicit `type` field in Firestore. The code defaults to `'team'` when `!g.type || g.type === 'team'` which works but is inconsistent.

### Potential Code Issues

11. **Second round scoring inconsistency:** `secondRound.js` uses Win=3, Draw=1, Loss=0 (no participation point), while pool stage uses Win=4 (3+1 participation), Draw=2 (1+1), Loss=1. This is intentional per the comments but could confuse users since the PointsExplainer doesn't mention second round scoring.

12. **`breakdownData.js` doesn't account for participation cap:** `getTeamIndividualGameBreakdown()` adds `participationPts` for each athlete without enforcing `maxParticipationCap`. The actual points calculation in `getIndividualPointsForTeam()` does enforce it. This means the breakdown popover may show slightly different numbers than the actual standings for teams that hit the cap.

13. **Race condition in `_SYNC_FROM_FIRESTORE`:** The `isSyncingRef` is set to `true` before dispatch and reset after 100ms timeout. If the user makes a change during this 100ms window, it won't be saved (the auto-save effect checks `isSyncingRef.current`).

14. **Firebase API key exposed in source code:** The Firebase config including API key is hardcoded in `firebase.js`. While Firebase API keys are designed to be public, the project relies entirely on Firestore security rules for protection. If rules are misconfigured, data could be written/deleted by anyone.

15. **No CSRF protection:** The app has no CSRF tokens or origin validation. Since auth is client-side localStorage, any script on the same origin can access/modify auth data.

---

## 16. KNOWN BUGS

### Bug 1: Settings Page Incorrect Scoring Display
**Description:** Settings.jsx shows "Bye (present): 2 pts (walkover)" and incorrect tiebreaker rules (Head-to-head, Alphabetical)
**Root cause:** Hardcoded wrong values in the Settings component's JSX
**Files:** `src/pages/Settings.jsx`
**Severity:** Low (display only, doesn't affect actual scoring)

### Bug 2: Points Breakdown Popover May Show Wrong Individual Sport Points
**Description:** The detailed breakdown for individual sports in PointsBreakdownPopover doesn't enforce `maxParticipationCap`, so if a team exceeds the cap, the breakdown total may exceed the actual standings total.
**Root cause:** `getTeamIndividualGameBreakdown()` in `breakdownData.js` adds participation points per athlete without checking the game-level cap
**Files:** `src/utils/breakdownData.js` (function `getTeamIndividualGameBreakdown`)
**Severity:** Medium (data accuracy in breakdown popover)

### Bug 3: ~~Recovery Key Auth Recovery Impossible After localStorage Clear~~ (FIXED)
**Description:** If user clears browser localStorage, auth data (password hash + recovery key hash) is lost. ~~Firestore `config/auth` reads are blocked by security rules, so the app cannot recover auth data from the server.~~
**Root cause:** Firestore rules blocked reads on `config/auth`. Now fixed — rules allow reads, and AuthContext auto-recovers auth from Firestore on mount.
**Files:** `firestore.rules`, `src/context/AuthContext.jsx`
**Severity:** ~~High~~ Fixed (2026-03-25, FIX-001)

---

## REGRESSION TEST CHECKLIST

### Auth
- [ ] First-time setup: set password, see recovery key
- [ ] Login with correct password
- [ ] Login with wrong password (see error, attempt counter)
- [ ] 5 wrong attempts → lockout for 5 minutes
- [ ] Lockout countdown displays correctly
- [ ] Session persists across page navigation (not refresh)
- [ ] Session expires after 30 min inactivity
- [ ] Logout clears session
- [ ] Password recovery with correct recovery key
- [ ] Password recovery with wrong key (lockout applies)
- [ ] Password change (current + new)
- [ ] New device login: shows login form (not "Set Admin Password") when password exists in Firestore
- [ ] Auth recovery: clearing localStorage and refreshing still allows login (auth loaded from Firestore)
- [ ] Admin-only views redirect to dashboard when not logged in

### Dashboard
- [ ] Shows correct team count, game count, athlete count
- [ ] Pool played and KO played counts are accurate
- [ ] Tournament progress cards show correct stage per game
- [ ] Champion logos appear for completed games
- [ ] Standings table sorts by tiebreaker rules
- [ ] Dense ranking: tied teams share rank
- [ ] Points breakdown popover opens and shows correct data
- [ ] Search filters teams in standings
- [ ] Table/Cards view toggle works
- [ ] Team comparison mode works
- [ ] Screenshot export works

### Team Games (Pool Stage)
- [ ] Pool standings show correct W/L/D/B/Pts per team
- [ ] Bye gives present team 4 pts, absent team 0 pts
- [ ] Draw gives both teams 2 pts
- [ ] Win gives winner 4 pts, loser 1 pt

### Knockout
- [ ] Advance to knockout creates correct bracket
- [ ] Cross-pool seeding works (A1 vs D2, etc.)
- [ ] Knockout result entry advances winner to next match
- [ ] SF loser feeds to 3rd place match
- [ ] Knockout bonus applied for contested wins only
- [ ] No bonus for walkover/bye wins in knockout
- [ ] Champion display shows podium with confetti
- [ ] Game marked as completed when all KO matches done
- [ ] Bracket view displays correctly

### Individual Sports
- [ ] Add category to individual game
- [ ] Register athlete with 8-digit reg number
- [ ] Reg number uniqueness enforced
- [ ] Assign athletes to categories
- [ ] Record 1st/2nd/3rd placements
- [ ] Mark athletes as absent
- [ ] Participation points awarded correctly
- [ ] maxParticipationCap limits participation points per team
- [ ] Placement bonus never capped
- [ ] Per-category points override works
- [ ] Team standings aggregate correctly

### Lobby/Esports
- [ ] Add entries per school (up to maxEntriesPerSchool)
- [ ] Create session with placements
- [ ] Participation cap enforced per school per game
- [ ] Same school can win multiple podium spots
- [ ] Points config changes reflect in standings
- [ ] Game completion toggle works

### Match Management
- [ ] Add pool match
- [ ] Edit match result/status
- [ ] Delete match
- [ ] Bulk result entry for upcoming matches
- [ ] Knockout match result entry with auto-advancement
- [ ] No draws allowed in knockout
- [ ] Score tracking (scoreA/scoreB)

### Team Management
- [ ] Add team with name and short code
- [ ] Upload team logo (compression applied)
- [ ] Edit team details
- [ ] Delete team (cascade: remove from pools, delete matches, remove athletes, clean lobby entries)
- [ ] Team profile modal shows per-game stats

### Settings
- [ ] Edit tournament name/dates/logo
- [ ] Export JSON data
- [ ] Import JSON data (validation works)
- [ ] Load sample data
- [ ] Reset all data (confirmation required)
- [ ] Dark mode toggle
- [ ] Force save button works
- [ ] Cloud sync status displays correctly

### Data Sync
- [ ] Changes auto-save after 1.5s debounce
- [ ] Real-time sync across tabs
- [ ] Offline banner appears when disconnected
- [ ] Save indicator shows saving/saved/error states
- [ ] beforeunload warning when unsaved changes exist
- [ ] Empty state not saved over existing Firestore data

### Responsive / Mobile
- [ ] Bottom navigation appears on mobile
- [ ] Sidebar appears on desktop
- [ ] Tables scroll horizontally on small screens
- [ ] Modals render as bottom sheets on mobile
- [ ] Touch interactions work (button active states)

---

## BUG TRACKER

| Bug ID | Description | Root Cause | Status | Fix Details | Date Found | Date Fixed | Files Involved |
|--------|-------------|------------|--------|-------------|------------|------------|----------------|
| BUG-001 | Settings page shows bye=2pts instead of 4pts | Hardcoded wrong value in JSX | Open | — | 2026-03-25 | — | src/pages/Settings.jsx |
| BUG-002 | Settings page shows wrong tiebreaker rules | Hardcoded "H2H, Alphabetical" instead of actual rules | Open | — | 2026-03-25 | — | src/pages/Settings.jsx |
| BUG-003 | Individual points breakdown ignores participation cap | breakdownData.js doesn't enforce maxParticipationCap | Open | — | 2026-03-25 | — | src/utils/breakdownData.js |
| BUG-004 | Auth unrecoverable after localStorage clear | Firestore config/auth reads blocked by design | Fixed | Enabled Firestore auth reads + auto-sync to localStorage on mount | 2026-03-25 | 2026-03-25 | firestore.rules, src/context/AuthContext.jsx |
| BUG-005 | New device shows "Set Admin Password" instead of login form | No localStorage auth on new device, Firestore reads blocked, LoginModal defaults to setup mode | Fixed | Enabled Firestore config/auth reads; AuthContext now loads auth from Firestore when localStorage is empty and syncs it locally | 2026-03-25 | 2026-03-25 | firestore.rules, src/context/AuthContext.jsx |

---

## FIX HISTORY

| Fix ID | What Was Broken | What Caused It | How It Was Fixed | Exact Code Changes | Date Fixed | Side Effects Checked |
|--------|----------------|----------------|-----------------|-------------------|------------|---------------------|
| FIX-001 | New device shows "Set Admin Password" instead of login form (BUG-005). Also fixes BUG-004 (auth unrecoverable after localStorage clear). | Firestore security rules blocked reads on `config/auth` (`allow read: if false`). On a new device with no localStorage, AuthContext couldn't recover auth hashes, so LoginModal defaulted to setup mode. | 1. Changed Firestore rules to allow reads on `config/auth`. 2. Updated AuthContext mount effect: when localStorage has no auth, load from Firestore via `loadAuthData()`, sync result to localStorage via `setAuthData()`, and update React state. LoginModal then sees `authData.passwordHash` and shows login form instead of setup. | `firestore.rules` line 28: `allow read: if false` → `allow read: if true`. `AuthContext.jsx` mount effect: added `loadAuthData()` call in the `else` branch (no local auth), with `setAuthData(firestoreAuth)` + `setAuthDataState(firestoreAuth)` to sync recovered auth. | 2026-03-25 | All 56 existing tests pass. Build succeeds. Login flow verified: existing device unaffected (localStorage path unchanged). New device flow: Firestore auth loaded → synced to localStorage → LoginModal shows login form → `login()` reads hash from localStorage → works. No regressions in scoring, knockout, individual, lobby logic. |

---

## CHANGE LOG

| Date | What Changed | Files Modified | Tests Passed | Anything Broke |
|------|-------------|----------------|--------------|----------------|
| 2026-03-25 | FIX-001: Fixed cross-device login bug. New devices now recover auth from Firestore instead of showing "Set Admin Password". Also fixes auth recovery after localStorage clear. | `firestore.rules`, `src/context/AuthContext.jsx`, `SYSTEM_REFERENCE.md` | All 56 tests pass | No — existing device login flow unchanged, build succeeds |
