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
