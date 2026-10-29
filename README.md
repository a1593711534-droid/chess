# CHESS ATELIER PRO — GitHub Pages

**Version:** v2.0.2 (clock and audio fixes)  
**GitHub repository:** https://github.com/a1593711534-droid/chess

This repository now contains the *actual* game source uploaded via the GitHub connector:

- `chess-pages-source.zip` — a verified 122,777-byte static-source archive (contains `index.html`, `src/`, `styles/`, `assets/`, chess.js, Stockfish Worker JS, licences and test suite).
- `.github/workflows/deploy-pages.yml` — automatic build, unit tests, pinned Stockfish 19 WASM download, SHA-256 verification and GitHub Pages deployment.

**Upload complete. The only remaining GitHub-side setup is enabling Pages for the first time.** GitHub Actions run #1 passed compilation, the bundled **39 automated tests**, and Stockfish WASM download and checksum validation. It failed at `actions/configure-pages` because the Pages site has not been enabled yet.

## Activate GitHub Pages (one-time)

1. Open **https://github.com/a1593711534-droid/chess/settings/pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions** (save if needed).
3. Open **https://github.com/a1593711534-droid/chess/actions/workflows/deploy-pages.yml**, select **Run workflow** (branch `main`) and start it. Alternatively re-run the failed workflow.
4. After success, your game URL is **https://a1593711534-droid.github.io/chess/**.

If Pages settings are unavailable, check repository owner/admin privileges and GitHub Pages availability.

## How it works

- GitHub Actions unpacks the versioned source ZIP into the Pages artifact; Pages serves the game from `/chess/` using relative paths.
- During the build, the **99,169,054-byte** Stockfish 19 single-thread WASM is fetched from official Stockfish.js release `v19.0.1`, SHA-256 `991bede2f253ebb08ff01fcc48270f4b9c8e66b12d5bd5f8d6f52eb3e3b3a740`. No binary is pushed into Git.
- The 39 Node test cases run before deployment; a build failure prevents publishing.
- No Render, Python server, or npm server is required to *serve* the final site.
- Stockfish runs in the visitor's browser; the first load still requires downloading the WASM. Data in localStorage is local to each browser/device.
- GitHub Pages does not provide real-time online multiplayer, central accounts, cloud-synced chess games, or guaranteed offline reopening.

## Development and license

The complete source is in `chess-pages-source.zip`; the release retains the upstream chess.js and Stockfish license notices. When editing the project, regenerate the archive and commit it: this triggers the deploy workflow.

**First workflow run:** https://github.com/a1593711534-droid/chess/actions/runs/40862337835
