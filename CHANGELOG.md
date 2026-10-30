## 2.3.8 — FIDE draw agreement and nested study variations

- Add draw-offer, acceptance, refusal and move-based refusal for local two-player games.
- Persist and validate pending draw offers in full and automatic study backups.
- Add stable child-parent branch references and strict FEN ancestry checks.
- Export recursively annotated PGN with nested variation lines and mainline comments; study JSON remains the exact editable import format.
- Expand unit/browser regressions and rotate the offline service-worker cache.

## 2.3.7 — Professional integrity and FIDE announced draw claims

- Require confirmation before destructive PGN or study backup import.
- Strictly validate complete timed-clock backups and persist variation undo immediately.
- Support FIDE 9.2.1 / 9.3.1 announced-move draw claims, including result recovery.
- Expand Node regression tests; bump versioned service-worker shell cache.

## v2.3.6 — Phase 3: history-index performance, UI refactor and real engine CI

- Cache verbose chess history, repeated position counts, historic views and automatic adjudication; incrementally update on move/undo and invalidate on replaced game state.
- Extract notation and opening/training panels from the main application controller; avoid unnecessary hidden-tab and unchanged-move DOM updates.
- Consolidate the final phase-two CSS overrides into the experience stylesheet without changing their order.
- Test the real Stockfish 19 single-WASM Worker in Chromium on PRs, including MultiPV and legal bestmove; pin both size and SHA-256 for test and deployment.
- Add long-history regression tests and streamline the GitHub Pages build to reuse the verified binary.

## v2.3.5 — Phase 2: mobile interface and accessibility

- Improve short-landscape chessboard usability, touch targets and scrolling.
- Add annotations with visible start state and Escape cancellation, legal-target announcements and keyboard-accessible analysis tabs.
- Show white-perspective analysis descriptions, automatic/manual save timestamps and mobile shortcuts.

## v2.3.4 — Phase 1: chess rules and study integrity

- Align time forfeits and automatic/claimable draws with FIDE rules; explicitly claim threefold repetition and 50-move draws.
- Confirm before overwriting finished or annotated games, deduplicate retries of variation saves and prevent stale study annotations after undo.
- Validate manual and automatic saves before replacing a live session and reject malformed clock and branch state.

## v2.3.3 — Save corruption safety and better engine interruption recovery

- Detect invalid JSON auto/manual saves and avoid overwriting an active game on failed manual restore.
- Strictly validate full study imports before accepting any branches or annotations.
- Add a 3.5 s Stockfish cancellation watchdog and retain partial analysis when stopped.
- Prevent accidental drag moves during touch annotation and return keyboard focus after closing the menu.
- Expand real-browser and Node regression testing; update offline cache.

## v2.3.2 — Audit bug fixes and complete study backups

- Safeguarded study variations and browser auto-save, with JSON backup roundtrips.
- Fixed analysis cancellation and stale hints, engine restart, training orientation, and FEN move numbering.
- Improved accessible modals, note preservation, opening labels and mobile marking.
- Rotated the offline cache version to refresh the application consistently.

## v2.3.1 — Stability, gameplay and offline improvements

- Fixed first-turn chess clock timing, variation clock pausing and AI search restarts.
- Preserved recorded PGN outcomes and corrected study-mode save/reload state.
- Fixed native piece dragging, accessible arrow-key navigation and landscape viewports.
- Load Stockfish only when requested, with optional WebAssembly cache and offline page shell.
- Test chess match lifecycle in Node and Chromium, including offline reloads.

## v2.3.0 — Larger interface and fixed-size main menu

- Expanded desktop main menu to 1280px on typical large displays, with responsive viewport-safe limits.
- Fixed the menu's outer width and height across game creation and setup state changes.
- Increased typography and control sizing across the game for easier reading.
- Improved save panel density so the create another match control remains visible at common laptop heights.
- Added browser interaction checks and layout regression tests.

## v2.2.0 — Professional AI time controls

- Added Stockfish clock-aware time allocation (remaining time and increment), independent of Skill Level.
- Retained fixed per-move search and a bounded untimed fallback.
- Clarified chess-clock increment versus AI calculation time in the menu.
- Preserved earlier saved games' fixed thinking budgets and added time-management regression tests.

# CHANGELOG

## 2.1.0 · Main menu and match persistence
- Removed site-wide header and moved title/version/engine details into the main menu.
- Separately configured AI difficulty (21 UCI Skill Level steps), AI move search budget, and chess-clock time control.
- Locked match configuration during games and displayed active settings read-only.
- Implemented automatic resume plus an explicit manual localStorage save/restore.
- Paused clock while the menu is open and while the game is not running in a browser session.
- Added unit and interactive browser regression tests.
