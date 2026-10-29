# CHANGELOG

## 2.1.0 · Main menu and match persistence
- Removed site-wide header and moved title/version/engine details into the main menu.
- Separately configured AI difficulty (21 UCI Skill Level steps), AI move search budget, and chess-clock time control.
- Locked match configuration during games and displayed active settings read-only.
- Implemented automatic resume plus an explicit manual localStorage save/restore.
- Paused clock while the menu is open and while the game is not running in a browser session.
- Added unit and interactive browser regression tests.
