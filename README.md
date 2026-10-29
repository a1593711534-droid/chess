# CHESS ATELIER PRO — GitHub Pages

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
