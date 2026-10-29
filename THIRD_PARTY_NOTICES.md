# Third-party components and licenses

This project includes third-party components from the attachments and locally created graphical outlines. It is intended for personal, local/offline use.

## chess.js

- File: `vendor/chess.js` (unchanged from the user-provided archive).
- Author: Jeff Hlywa and contributors.
- Project/source: https://github.com/jhlywa/chess.js
- License: BSD 2-Clause. Full license: `licenses/chess.js-BSD-2-Clause.txt`.

## Stockfish 19 and Stockfish.js

- Files: `vendor/stockfish-19-single.js` and `vendor/stockfish-19-single.wasm` (unchanged from the user-provided archive).
- Stockfish.js: Copyright 2026 Chess.com, LLC, maintained by Nathan Rugg and contributors.
- Underlying chess engine: Stockfish developers.
- Source: https://github.com/nmrugg/stockfish.js and https://github.com/official-stockfish/Stockfish
- License: GNU GPL v3. Full license: `licenses/GPL-3.0.txt`.
- The engine runs as a separate Web Worker, communicates over UCI, and ships without modifications.
- The full single-threaded engine is specifically chosen because it does not require cross-origin isolation.
- The original JS/WASM component has corresponding source available from the upstream repositories. Distributing or modifying the engine requires compliance with GPLv3 obligations.

## Chess piece artwork

- Files: `assets/pieces/*.svg`.
- The piece paths were generated from character outlines in the open-source DejaVu Sans font; they are not font binaries.
- License: DejaVu/Bitstream Vera permissions, `licenses/DejaVu-Bitstream-Vera-LICENSE.txt`.

No external fonts, analytics, ad networks, or third-party CDNs are loaded by the game.
