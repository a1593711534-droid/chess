/**
 * HTML / JavaScript release compatibility contract.
 * This is deliberately independent of the chess engine: a damaged or stale
 * index.html should produce an actionable message instead of a blank board.
 */
export const APP_VERSION='2.0.2';

// Every literal id accessed by the application at startup or during gameplay.
// Kept explicit so tests can detect newly added UI references.
export const REQUIRED_IDS=[
  'analysis-state','analysis-time','analyze-btn','arena-type','chessboard','close-records',
  'confirm-cancel','confirm-text','confirm-title','confirm-yes','copy-fen','copy-pgn',
  'create-variation','engine-dot','engine-status','eval-depth','eval-fill','eval-score',
  'export-btn','export-variation','finish-variation','flip-btn','game-status-desc',
  'game-status-title','hint-btn','import-cancel','import-confirm','import-error',
  'import-pgn','level-description','level-section','level-select','mobile-flip-btn',
  'mobile-hint-btn','mobile-scrim','mobile-settings','mobile-undo-btn','moves-count',
  'moves-list','multi-pv','nav-end','nav-next','nav-prev','nav-start','new-game',
  'note-position','opening-candidates','opening-detected','opening-filter',
  'opening-library','pgn-input','position-indicator','position-note','promotion-cancel',
  'promotion-options','puzzle-filter','puzzle-library','pv-line','resign-btn',
  'right-panel','round-caption','save-note','setup-panel','show-records','side-section',
  'solved-count','sound-btn','sound-label','stat-moves','stat-phase','status-overline',
  'stop-analysis','time-select','training-active','training-errors','training-exit',
  'training-goal','training-label','training-name','training-reset','training-step',
  'turn-message','undo-btn','variation-list','variation-moves','variation-strip',
  'variation-title',
];

/** Restore the optional Stop button if a partly-cached older HTML omitted it. */
function repairOptionalControls(doc){
  if(doc.getElementById('stop-analysis'))return;
  const controls=doc.querySelector('.analysis-buttons');
  if(!controls)return;
  const stop=doc.createElement('button');
  stop.id='stop-analysis';stop.type='button';stop.className='outline-action compact';
  stop.disabled=true;stop.textContent='停止';stop.title='停止引擎分析';
  controls.append(stop);
  console.warn('[Chess Atelier PRO] Restored missing #stop-analysis control.');
}

export function inspectUi(doc){
  const version=doc.documentElement.dataset.appVersion||'';
  // Check the version first: wiring a new JS bundle to old markup is unsafe.
  if(version!==APP_VERSION)return {ok:false,reason:'version',version,missing:[]};
  repairOptionalControls(doc);
  const missing=REQUIRED_IDS.filter(id=>!doc.getElementById(id));
  return {ok:missing.length===0,reason:'missing',version,missing};
}

export function showStartupError(doc,issue){
  // Use DOM creation (not innerHTML with untrusted values) for safe diagnostics.
  const box=doc.createElement('section');box.id='startup-error';
  box.setAttribute('role','alert');box.setAttribute('aria-live','assertive');
  box.style.cssText='position:fixed;inset:0;z-index:99999;background:#101a21;color:#f4f2eb;display:flex;align-items:center;justify-content:center;padding:24px;font:16px/1.75 system-ui,sans-serif;overflow:auto;';
  const card=doc.createElement('div');card.style.cssText='max-width:640px;border:1px solid #b49563;background:#19252b;padding:clamp(22px,5vw,42px);border-radius:14px;box-shadow:0 24px 90px #0009;';
  const header=doc.createElement('h1');header.textContent='棋境 PRO · 啟動版本檢查';header.style.cssText='font-size:26px;margin:0 0 14px;color:#e5c38c;';
  const detail=doc.createElement('p');
  detail.textContent=issue?.reason==='version'
    ?`網頁與程式版本不相符（網頁：${issue.version||'舊版／未標示'}；程式：${APP_VERSION}），已停止載入以避免閃退。`
    :issue?.reason==='runtime'
      ?`初始化過程發生錯誤：${(issue?.missing||[]).join('、')||'未知'}。請依照下方指示排除版本或檔案問題。`
      :`網頁缺少必要的操作元件：${(issue?.missing||[]).join('、')||'未知'}。已停止載入，避免功能異常。`;
  const help=doc.createElement('p');help.textContent='請關閉舊伺服器視窗，將修正版 ZIP 完整解壓縮到新資料夾，雙擊其中的 start_windows.bat，然後在新開啟的頁面按 Ctrl+Shift+R 強制重新整理。不要混用舊版 index.html 與新版 src/ 檔案。';
  const refresh=doc.createElement('button');refresh.textContent='重新整理頁面';refresh.type='button';
  refresh.style.cssText='background:#cfa977;color:#111b21;border:0;border-radius:7px;padding:11px 18px;font-size:15px;font-weight:700;cursor:pointer;margin-top:10px;';
  refresh.addEventListener('click',()=>doc.defaultView.location.reload());
  card.append(header,detail,help,refresh);box.append(card);doc.body.append(box);
  console.error('[Chess Atelier PRO] UI compatibility check failed:',issue);
}
