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
