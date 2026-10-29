# CHESS ATELIER PRO — GitHub Pages

CHESS ATELIER PRO v2.0.2 is a static HTML/CSS/JavaScript chess game with a single-thread Stockfish 19 WebAssembly engine, openings, puzzles, PGN study and local chess clocks.

**Deployment status:** The repository's GitHub Pages workflow is prepared. It requires the **`chess-pages-source.zip`** source archive in the repository root before it can build and publish the site. Until that file has been uploaded and GitHub Pages is enabled, this repository is not a playable website.

## Publish the game

1. Obtain the **Chess Atelier PRO Pages Upload Kit** prepared for this repository and extract it locally.
2. Upload **`chess-pages-source.zip`** (about 123 KB) to the **root of this GitHub repository** using GitHub's **Add file → Upload files**. Keep it zipped.
3. Visit **Settings → Pages** and set **Source: GitHub Actions**.
4. Inspect the workflow **Actions → CHESS ATELIER PRO - Deploy GitHub Pages** for successful deployment, or run the workflow manually.
5. The resulting URL will be `https://a1593711534-droid.github.io/chess/`.

## Engine and deployment

- The Pages workflow extracts the small source ZIP, runs the bundled 39 chess/game JavaScript tests, and downloads the **99,169,054-byte** Stockfish 19 single-thread WASM from the maintained [Stockfish.js v19.0.1 release](https://github.com/nmrugg/stockfish.js/releases/tag/v19.0.1).
- It verifies the downloaded binary's SHA-256 before deploying.
- GitHub Pages serves all static files; no Render, Python process, npm server or always-on backend is needed.
- The engine is computed in your browser, but the first download of the 99 MB engine still requires internet access.
- `chess-pages-source.zip` must be a ZIP containing `index.html`, `src/`, `styles/`, `assets/`, `vendor/chess.js`, `vendor/stockfish-19-single.js`, `licenses/`, and `tests/` at the root. Don't upload the large WASM to GitHub.
- The UI uses relative asset paths suitable for a repository path such as `/chess/`.
- Original third-party license notices are in the source archive.

Built and deployed via [GitHub Pages](https://docs.github.com/en/pages).
