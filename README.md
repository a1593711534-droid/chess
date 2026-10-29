## v2.3.0 · Enlarged, readable and stable main menu

- The desktop menu grows to up to 1280px wide × 820px tall (over 1.5× its previous ~840px width at 1648px viewport width).
- The outer menu frame has viewport-clamped fixed dimensions. Switching between AI/local play, fixed/adaptive time, active match and new-game editing no longer changes its size.
- If the contents exceed the viewport, menu panels scroll inside the fixed frame; tablet/mobile use an internal stacked scroller.
- Text and control sizes have been increased throughout the game, including menu selections, clocks, move history, analysis and notes.
- New styles/readability.css is loaded last; the underlying chess logic and save schema are unchanged.
- Smoke-tested at eight viewport sizes in Chromium with new/locked/editing flows; static tests validate stylesheet loading and layout contracts.

## v2.2.0 · Professional Stockfish time management

- Skill Level (0–20), the **chess clock**, and **AI time-management policy** are independent and locked when a match begins.
- **Intelligent time management (default for new users):** the engine receives remaining times and increments using standard UCI `go wtime ... btime ... winc ... binc ...` and allocates search time itself.
- **Fixed time (advanced):** UCI `go movetime N` for each AI move. The clock still counts down and can flag the AI.
- **Untimed adaptive games:** use the separately selected, bounded fixed search target (default 2 seconds); no clock information exists to schedule from.
- v2.1 and older saved games/preferences remain in **fixed time** mode when restored. New users get intelligent time management by default.
- The UI explicitly identifies a clock increment (“每步加秒”) as distinct from engine search time.

# CHESS ATELIER PRO — GitHub Pages

## v2.1.0 · Main menu, AI controls and save/resume

- A dedicated **Main Menu** now owns match type, side, both players' chess clock, and **21 Stockfish UCI Skill Levels (0–20)**.
- The **AI think budget is independent from the chess clock**: choose 0.25, 0.5, 1, 2, 4, 8, 15 or 30 seconds per move. The clock can still flag while the AI calculates; no Elo rating is claimed from Skill Level alone.
- When a game starts, these match settings become read-only. To change them, create a new game. During an active game the left panel displays the locked settings but no editable difficulty control.
- The website **autosaves** after moves and on exit. Select **儲存目前棋局** for an extra manual save; use **繼續目前棋局** or **載入手動存檔** from the main menu on a later visit.
- Local saves use browser `localStorage` and do not sync across devices. Clearing site data or using restricted private browsing can remove them.
- The game clock **pauses when the main menu opens** and does not consume offline time while the browser is closed. This is intended for offline-friendly casual play, not official online competition.
- The redundant page-wide header was removed: branding, version and engine status now appear in the main menu, leaving more room for the chessboard.


**Play:** https://a1593711534-droid.github.io/chess/

本 Repository 已改為 **原始碼逐檔管理**。修改棋盤、棋鐘、Stockfish 控制或版面時，直接編輯相關的 HTML、CSS、JS 檔案，不必重新打包 ZIP。

## 專案結構

- `index.html`：遊戲入口
- `src/main.js`：遊戲介面、按鈕與操作流程
- `src/chess/`：棋局、棋鐘、引擎管理
- `src/data/`、`src/study/`：開局、訓練、棋譜研究
- `src/ui/`：棋盤、通知及啟動檢查
- `styles/`：滿版響應式介面
- `assets/`：棋子 SVG 等素材
- `vendor/chess.js`、`vendor/stockfish-19-single.js`：瀏覽器程式庫
- `tests/`：自動測試
- `.github/workflows/deploy-pages.yml`：測試、建置及自動發布

## 修改與部署

在 `main` 分支修改 `index.html`、`src/`、`styles/`、`assets/` 等遊戲檔案後，GitHub Actions 會自動：

1. 執行 `npm test`。
2. 組裝 GitHub Pages 所需的靜態檔案。
3. 從已指定版本的 Stockfish.js 發行頁下載單執行緒 Stockfish 19 WASM（約 99 MB），核對 SHA-256。
4. 發布至 GitHub Pages。

**不需要 Render，不需要執行 Python 後端，也不需要上傳整包 ZIP。** 棋藝引擎在玩家的瀏覽器本機運作；首次開啟仍需要網路下載檔案。

[查看部署紀錄](../../actions/workflows/deploy-pages.yml) · [Pages 設定](../../settings/pages)

## 本機測試

`npm test`（需要 Node.js，但不需要 `npm install`）。如需在本機對弈，請先將與工作流程 SHA-256 相符的 Stockfish WASM 放到 `vendor/stockfish-19-single.wasm`，再執行 `py -3 launcher/serve.py`（若保留本機啟動器）或使用任意靜態 HTTP 伺服器。

## 授權

請參閱 `THIRD_PARTY_NOTICES.md` 與 `licenses/`。

## 原 ZIP 的用途

首次發佈使用的 `chess-pages-source.zip` 已完成一次性轉換。日後請直接修改上面的原始碼檔案；舊 ZIP 不再參與 GitHub Pages 的建置。
