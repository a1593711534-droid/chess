import {Chess} from '../vendor/chess.js';
import {ChessSession,LEVELS,resolveLevel} from './chess/session.js';
import {EngineClient} from './chess/engine.js';
import {selectAiSearch,describeAiTime,normalizeAiTimeMode} from './chess/time-management.js';
import {moveToUci,pvToSan,scoreWhite} from './chess/notation.js';
import {fallbackMove} from './chess/fallback.js';
import {createBoard,pieceSrc} from './ui/board.js';
import {toast} from './ui/toast.js';
import {loadPrefs,savePrefs,inspectSavedGame,inspectManualGame,saveGame,saveManualGame} from './utils/preferences.js';
import {playSound} from './utils/sound.js';
import {decorateIcons} from './utils/icons.js';
import {OPENINGS,openingFor,continuations,openingGame} from './data/openings.js';
import {PUZZLES,CATEGORIES,readTrainingStats,recordPuzzle} from './data/puzzles.js';
import {TrainingSession} from './study/training.js';
import {inspectUi,showStartupError} from './ui/boot.js?v=2.3.4';

const $=id=>document.getElementById(id);
let prefs=loadPrefs();
let autoSaveWarningShown=false,usingFallback=false,mobileAnnotating=false,flippedBeforeTraining=null,noteSaveTimer=null;
let session=new ChessSession(prefs);
let flipped=false;
let thinking=false;
let botSequence=0,analysisSequence=0;
let lastHint=null,analysisInfo=null,analysisFen=null;
let analysisLines=new Map(),analysisRunning=false;
let training=null,variation=null,trainingToken=0,clockBeforeTraining=null,clockBeforeVariation=null;
let openingFilter='all',puzzleFilter='全部';
let promotion=null,confirmCallback=null;
let engineError=null;
let engine=null;
let board=null;
let menuEditing=true,sessionActive=false,menuPauseSide=null,menuFocusBeforeOpen=null;
const menuVisible=()=>!$('main-menu-modal').classList.contains('hidden');
function ensureEngine(){
  if(!engine||engine.state==='error'){
    engineError=null;createEngine();
  }
  return engine;
}
function resumeBotIfNeeded(){
  if(!training&&!variation&&!thinking&&sessionActive&&!menuVisible()&&!session.done
    &&session.atLatest&&session.config.mode==='ai'&&!session.isHumanTurn())runBot();
}
function suspendClockForStudy(){
  const active=session.clock.active;
  session.clock.pause();
  const snapshot=session.clock.snapshot();
  snapshot.active=active;
  return snapshot;
}
function restoreClockFromStudy(snapshot){
  if(!snapshot)return;
  session.clock.restore(snapshot,{resume:sessionActive&&!menuVisible()&&!session.done});
  if(menuVisible())menuPauseSide=snapshot.active||null;
}
function createEngine(){
  engine=new EngineClient((status,error)=>{
    const dot=$('engine-dot'),label=$('engine-status');
    dot.className='status-dot'+(status==='ready'?' ready':status==='error'?' error':'');
    label.textContent={loading:'正在載入 Stockfish 19',ready:'Stockfish 19 · 已就緒',thinking:'Stockfish 正在計算',error:'引擎未就緒 · 備援模式'}[status];
    if(status==='error'){engineError=error;toast(`引擎無法啟動：${error?.message||'未知錯誤'}，下次請求會嘗試重新啟動。`,'error');}
    if(status==='ready'){engineError=null;usingFallback=false;if(board)renderPlayers();}
  });
}
function createGameBoard(){
  board=createBoard($('chessboard'),tryMove,null,(from,to)=>{
    if(training||variation)return;
    session.study.toggleMark(session.cursor,from,to);render();save();
  });
}
const activeGame=()=>training?.game||variation?.game||session.current;
const inputUci=m=>`${m.from}${m.to}${m.promotion||''}`;

function readSettings(){return {
  mode:document.querySelector('.segment.active')?.dataset.mode||'ai',
  side:document.querySelector('.color-choice.selected')?.dataset.side||'w',
  level:$('level-select').value,
  aiThink:$('ai-think-select').value,
  aiTimeMode:$('ai-time-mode').value,
  time:$('time-select').value,
  sound:prefs.sound,
};}
function renderSettings(){
  document.querySelectorAll('.segment').forEach(b=>b.classList.toggle('active',b.dataset.mode===prefs.mode));
  document.querySelectorAll('.color-choice').forEach(b=>b.classList.toggle('selected',b.dataset.side===prefs.side));
  $('level-select').value=prefs.level?.startsWith('skill-')?prefs.level:'skill-'+(LEVELS[prefs.level]?.skill??10);
  $('time-select').value=prefs.time;
  $('ai-think-select').value=String(prefs.aiThink||'2000');
  $('ai-time-mode').value=normalizeAiTimeMode(prefs.aiTimeMode);
  updateTimeControls();
  $('side-section').classList.toggle('hidden',prefs.mode==='local');
  $('level-section').classList.toggle('hidden',prefs.mode==='local');
  $('ai-time-mode-section').classList.toggle('hidden',prefs.mode==='local');
  $('level-description').textContent=resolveLevel(prefs.level).detail;
  $('sound-label').textContent=prefs.sound?'音效開啟':'音效關閉';
  $('sound-btn').querySelector('[data-icon]').dataset.icon=prefs.sound?'volume':'mute';
  decorateIcons($('sound-btn'));
}
function updateTimeControls(){
  const ai=prefs.mode==='ai',adaptive=normalizeAiTimeMode(prefs.aiTimeMode)==='adaptive';
  const noClock=prefs.time==='none';
  $('ai-think-section').classList.toggle('hidden',!ai||(adaptive&&!noClock));
  $('ai-think-label').textContent=adaptive&&noClock?'不限時搜尋時間':'固定每步搜尋時間';
  $('ai-time-note').textContent=adaptive
    ?(noClock?'本局不限時，沒有剩餘棋鐘可供引擎分配；使用下方每步搜尋時間。':'Stockfish 依剩餘棋鐘及加秒自動分配每步搜尋時間。')
    :'每步搜尋時間固定，不依棋鐘動態調整；搜尋仍消耗 AI 的棋鐘。';
}
function refreshPrefsFromUi(){prefs={...readSettings()};savePrefs(prefs);renderSettings();}
function serializedForSave(){
  const data=session.serialize();
  if(training&&clockBeforeTraining)data.clock={...clockBeforeTraining};
  else if(variation&&clockBeforeVariation)data.clock={...clockBeforeVariation};
  if(menuVisible()&&menuPauseSide&&!session.done)data.clock.active=menuPauseSide;
  return data;
}
function save(){
  if(!sessionActive)return false;
  const ok=saveGame(serializedForSave());
  if(ok){autoSaveWarningShown=false;$('save-status').textContent='自動儲存正常';}
  else{
    $('save-status').textContent='自動儲存失敗 · 請下載備份';
    if(!autoSaveWarningShown){autoSaveWarningShown=true;toast('瀏覽器無法自動儲存：請立即下載完整研究備份。','error');}
  }
  return ok;
}
function updateSaveInfo(){
  const {value:manual,corrupted:manualCorrupt}=inspectManualGame();
  $('menu-load').disabled=!manual?.game||manualCorrupt;
  $('menu-save').disabled=!sessionActive;
  $('menu-continue').disabled=!sessionActive;
  $('menu-close').disabled=!sessionActive;
  const last=manual?.date?new Date(manual.date).toLocaleString('zh-TW'):'未建立';
  $('menu-saved-info').textContent=`自動存檔：${sessionActive?`${session.ply} 步 · ${session.done?'本局已結束':'可繼續'}`:'尚未建立'}\n手動存檔：${manualCorrupt?'無法解析（請使用完整研究備份）':last}`;
}
function setMenuEditing(editing){
  menuEditing=editing;
  $('menu-form').classList.toggle('is-locked',!editing);
  for(const el of $('menu-form').querySelectorAll('select,.segment,.color-choice'))el.disabled=!editing;
  $('menu-lock-badge').textContent=editing?'僅套用至新對局':'目前棋局設定已鎖定';
  $('menu-new').classList.toggle('hidden',editing||!sessionActive);
}
function openMainMenu(){
  if(!menuVisible()){
    menuFocusBeforeOpen=document.activeElement;
    cancelSearch();
    menuPauseSide=session.clock.active;
    session.clock.pause();
    closeDrawers();
    if(sessionActive){prefs={...prefs,...session.config,side:prefs.side==='random'?'random':session.config.side,sound:prefs.sound};renderSettings();}
    $('main-menu-modal').classList.remove('hidden');
    (sessionActive?$('menu-continue'):$('new-game')).focus({preventScroll:true});
  }
  setMenuEditing(true);
  updateSaveInfo();
  updateClocks();
}
function closeMainMenu(){
  if(!sessionActive)return;
  $('main-menu-modal').classList.add('hidden');
  const priorFocus=menuFocusBeforeOpen;menuFocusBeforeOpen=null;
  (priorFocus?.isConnected?priorFocus:$('main-menu-open')).focus({preventScroll:true});
  if(menuEditing){prefs={...prefs,...session.config,side:prefs.side==='random'?'random':session.config.side,sound:prefs.sound};renderSettings();}
  setMenuEditing(false);
  const resumeSide=menuPauseSide||(session.ply===0?session.game.turn():null);
  if(resumeSide&&!session.done&&session.clock.enabled&&!training&&!variation)session.clock.resume(resumeSide);
  menuPauseSide=null;
  updateClocks();
  resumeBotIfNeeded();
}
function saveManual(){
  if(!sessionActive){toast('請先開始對局。','info');return;}
  if(saveManualGame(serializedForSave())){
    $('save-status').textContent='已儲存 · 重新開啟可讀取';
    toast('手動存檔成功；下次可從主選單讀取。','success');
    updateSaveInfo();
  }else toast('無法寫入存檔，請檢查瀏覽器儲存空間或隱私模式。','error');
}
function loadManual(){
  const {value:manual,corrupted}=inspectManualGame();
  if(corrupted){toast('手動存檔無法解析。原棋局沒有變更，請使用完整研究備份還原。','error');return;}
  if(!manual?.game)return;
  const restore=()=>{
    try{
      // Validate the entire save before touching the active match.
      const next=new ChessSession(manual.game.config);next.restore(manual.game,{resumeClock:false,strictStudy:true});
      cancelSearch();session=next;
      sessionActive=true;menuPauseSide=manual.game.clock?.active||null;
      $('position-note').dataset.ply='';usingFallback=false;
      prefs={...prefs,...manual.game.config,side:prefs.side==='random'?'random':manual.game.config.side};renderSettings();
      flipped=session.config.mode==='ai'&&session.config.side==='b';
      variation=null;training=null;flippedBeforeTraining=null;clockBeforeVariation=null;clockBeforeTraining=null;lastHint=null;render();save();closeMainMenu();toast('已載入手動存檔。');
    }catch(error){toast('存檔損毀，無法讀取：'+error.message,'error');}
  };
  if(sessionActive&&!session.done)showConfirm('載入手動存檔？','目前棋局會被手動存檔取代。',restore,'載入');
  else restore();
}
function cancelSearch({preserveAnalysis=false}={}){
  botSequence++;analysisSequence++;engine?.cancel();thinking=false;analysisRunning=false;
  if(!preserveAnalysis){analysisInfo=null;analysisFen=null;analysisLines=new Map();}
  const b=$('stop-analysis');if(b)b.disabled=true;
  if(board&&$('analysis-state'))renderAnalysis();
}
function initialGame(){
  prefs={...readSettings()};savePrefs(prefs);
  cancelSearch();exitTraining(false);variation=null;clockBeforeVariation=null;session=new ChessSession(prefs);sessionActive=true;
  $('position-note').dataset.ply='';flipped=session.config.mode==='ai'&&session.config.side==='b';
  menuPauseSide=null;lastHint=null;analysisInfo=null;analysisFen=null;
  if(mobileAnnotating){mobileAnnotating=false;board.setAnnotationMode(false);$('mobile-annotate-btn').setAttribute('aria-pressed','false');$('mobile-annotate-btn').textContent='標記';}
  usingFallback=false;render();closeDrawers();closeMainMenu();save();
}
function showNewGame(){
  const hasResearch=!!(Object.keys(session.study.notes).length||Object.keys(session.study.marks).length||session.study.branches.length);
  if(sessionActive&&(session.ply>0||session.done||hasResearch)){
    showConfirm('開始新對局？','目前的棋局與研究資料會被新棋局取代，請先下載完整研究備份。',initialGame,'確定開始新局');
  }else initialGame();
}
function tryMove(from,to){
  if(training){const candidates=training.game.moves({square:from,verbose:true}).filter(m=>m.to===to);if(!candidates.length){toast('目前的訓練局面中這一步不合法。','info');return;}
    if(candidates.some(m=>m.promotion))return showPromotion(from,to,training.game.turn());
    trainingMove({from,to});return;
  }
  if(variation){const candidates=variation.game.moves({square:from,verbose:true}).filter(m=>m.to===to);if(!candidates.length)return;
    if(candidates.some(m=>m.promotion))return showPromotion(from,to,variation.game.turn());
    variationMove({from,to});return;
  }
  if(!session.atLatest){toast('請先回到最新局面，才能繼續對弈。','info');return;}
  if(!sessionActive||menuVisible()||session.done||thinking||!session.isHumanTurn())return;
  const candidates=session.game.moves({square:from,verbose:true}).filter(m=>m.to===to);
  if(!candidates.length){toast('這不是合法走法。','error');return;}
  const promotions=candidates.filter(m=>!!m.promotion);
  if(promotions.length)return showPromotion(from,to,session.game.turn());
  makeMove({from,to});
}
function showPromotion(from,to,color){
  promotion={from,to};const root=$('promotion-options');root.innerHTML='';
  for(const type of ['q','r','b','n']){
    const button=document.createElement('button');button.className='promotion-option';button.title={q:'皇后',r:'城堡',b:'主教',n:'騎士'}[type];button.setAttribute('aria-label',`升變成${button.title}`);
    const pic=document.createElement('img');pic.alt='';pic.src=pieceSrc(type,color);button.append(pic);
    button.onclick=()=>{const move=promotion;closeModal('promotion-modal');promotion=null;
      if(training)trainingMove({...move,promotion:type});else if(variation)variationMove({...move,promotion:type});else makeMove({...move,promotion:type});};root.append(button);
  }
  openModal('promotion-modal');
}
function startExercise(exercise){
  cancelSearch();
  if(variation){variation=null;restoreClockFromStudy(clockBeforeVariation);clockBeforeVariation=null;}
  if(!training)clockBeforeTraining=suspendClockForStudy();
  if(!training)flippedBeforeTraining=flipped;
  training=new TrainingSession(exercise);trainingToken++;
  lastHint=null;flipped=training.game.turn()==='b';render();closeDrawers();toast(`訓練：${exercise.title}`,'info');
}
function exitTraining(restore=true){
  trainingToken++;training=null;
  if(flippedBeforeTraining!==null){flipped=flippedBeforeTraining;flippedBeforeTraining=null;}
  if(clockBeforeTraining){restoreClockFromStudy(clockBeforeTraining);clockBeforeTraining=null;}
  if(restore){lastHint=null;render();save();resumeBotIfNeeded();}
}
function trainingMove(input){
  if(!training)return;const result=training.play(input);
  if(!result.ok){if(result.reason==='incorrect'){playSound('error',prefs.sound);toast('這一步不符合訓練目標，請再想想。','info');renderTraining();}return;}
  playSound(result.move.captured?'capture':'move',prefs.sound);lastHint=null;
  if(result.done){finishExercise();return;}
  const token=++trainingToken;render();
  setTimeout(()=>{if(!training||token!==trainingToken)return;const response=training.reply();if(response){playSound(response.captured?'capture':'move',prefs.sound);if(training.solved){finishExercise();return;}render();}},360);
}
function finishExercise(){
  if(training.exercise.id.startsWith('opening:'))toast('開局路線練習完成！','success');
  else {recordPuzzle(training.exercise.id,training.errors);toast('成功完成這道訓練題！','success');}
  playSound('end',prefs.sound);render();
}
function openingExercise(row){
  const g=new Chess(),line=[];
  for(const san of row.moves){const m=g.move(san);line.push(moveToUci(m));}
  return {id:'opening:'+row.eco,title:row.name,fen:new Chess().fen(),line,category:'開局演練',goal:`以白方完成 ${row.eco} 精選開局路線。黑方會依教學路線回應。`};
}
function variationMove(input){
  if(!variation)return;try{const m=variation.game.move(input,{strict:true});variation.moves.push(moveToUci(m));playSound(m.captured?'capture':'move',prefs.sound);render();}
  catch{toast('不合法的變例著法。','error');}
}
function beginVariation(){
  if(training){toast('請先離開訓練模式。','info');return;}
  if(variation?.moves.length){toast('請先儲存目前變例，再建立新的分支。','info');return;}
  cancelSearch();if(!variation)clockBeforeVariation=suspendClockForStudy();
  const fen=session.current.fen();variation={origin:session.cursor,fen,game:new Chess(fen),moves:[]};lastHint=null;render();closeDrawers();toast('變例探索：現在可從此局面自由走棋。','info');
}
function finishVariation(){
  if(!variation)return;
  if(variation.moves.length){try{
    variation.persistedBranch=session.study.upsertBranch(variation.origin,variation.fen,variation.moves,variation.persistedBranch);
    if(save())toast('已儲存變例，可在棋譜頁面再次開啟。');
    else toast('變例僅保留在目前分頁，請立即下載完整研究備份。','error');
  }catch(e){toast(`變例尚未儲存：${e.message}。目前變例仍在，可先複製 PGN。`,'error');return;}}
  variation=null;restoreClockFromStudy(clockBeforeVariation);clockBeforeVariation=null;
  render();save();resumeBotIfNeeded();
}
function openVariation(index){
  if(training){toast('請先離開訓練模式。','info');return;}
  const branch=session.study.branches[index];if(!branch)return;
  cancelSearch();if(!variation)clockBeforeVariation=suspendClockForStudy();
  const g=new Chess(branch.fen);for(const u of branch.moves)g.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]});
  variation={origin:branch.origin,fen:branch.fen,game:g,moves:[...branch.moves]};render();closeDrawers();toast('已載入變例，可繼續探索；儲存後新增分支。','info');
}
function makeMove(input,computer=false){
  cancelSearch();
  const move=session.play(input);
  if(!move){
    // The move's clock snapshot may be the first operation to notice flag fall.
    // Present the correct outcome instead of misreporting a legal move as illegal.
    if(session.clock.timeout){
      const outcome=session.status();
      if(outcome?.kind==='timeout'&&!session.result){
        session.result=outcome;
        cancelSearch();render();save();playSound('end',prefs.sound);
        toast(gameOutcomeText(outcome),'info');
      }else render();
    }else{toast('不合法的著法，請重新選擇。','error');render();}
    return;
  }
  lastHint=null;analysisInfo=null;analysisFen=null;
  playSound(session.done?'end':session.game.isCheck()?'check':move.captured?'capture':'move',prefs.sound);
  render();save();
  if(session.done){toast(gameOutcomeText(session.status()),'info');return;}
  if(!computer&&session.config.mode==='ai'&&!session.isHumanTurn())runBot();
}
async function runBot(){
  if(!sessionActive||menuVisible()||training||variation||thinking||session.done||session.config.mode!=='ai'||session.isHumanTurn()||!session.atLatest)return;
  const token=++botSequence,fen=session.game.fen(),setting=resolveLevel(session.config.level);
  const budget=selectAiSearch(session.config,session.clock);
  if(!budget){
    const outcome=session.status();
    if(outcome?.kind==='timeout'&&!session.result){session.result=outcome;save();toast(gameOutcomeText(outcome),'info');}
    render();return;
  }
  thinking=true;analysisLines=new Map();analysisInfo=null;analysisFen=null;render();
  let uci=null;
  try{
    uci=await ensureEngine().search(fen,{skill:setting.skill,...budget,onInfo:info=>{
      if(botSequence!==token||session.game.fen()!==fen)return;
      analysisInfo=info;analysisFen=fen;analysisLines.set(info.multiPV||1,info);renderAnalysis();
    }});
  }catch(error){engineError=error;}
  if(token!==botSequence||session.game.fen()!==fen)return;
  if(!uci){usingFallback=true;uci=fallbackMove(fen,session.config.level);}
  else usingFallback=false;
  thinking=false;
  if(uci&&session.game.moves({verbose:true}).some(m=>moveToUci(m)===uci)){
    makeMove({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]||undefined},true);
  }else{toast('電腦無法取得合法著法，可使用悔棋或重新開始。','error');render();}
}

function doUndo(confirmed=false){
  if(training){trainingToken++;training.restart();render();return;}
  if(variation){if(variation.moves.length){variation.moves.pop();variation.game.undo();render();}return;}
  if(session.ply===0)return;
  if(!confirmed&&session.study.hasResearchAfter(session.undoTargetPly())){
    showConfirm('悔棋會移除研究資料','被撤回著法上的註解、標記及其後的變例將被移除。請先下載完整研究備份，或取消操作。',()=>doUndo(true),'確定悔棋');
    return;
  }
  cancelSearch();const n=session.undo();analysisInfo=null;analysisFen=null;lastHint=null;
  if(n){render();save();toast(`已退回 ${n} 步。`,'info');}
  if(session.config.mode==='ai'&&!session.isHumanTurn()&&!session.done)runBot();
}
function gameOutcomeText(outcome){
  if(!outcome)return '';
  const why={timeout:'時間用盡', 'timeout-insufficient':'時間用盡，但對手無法將死',checkmate:'將死',resign:'認輸',stalemate:'逼和','threefold-claim':'主張三次重複和棋','fifty-move-claim':'主張50步和棋',fivefold:'五次重複局面','seventyfive-move':'75步規則',insufficient:'子力不足',draw:'和棋',pgn:'棋譜記錄結果'}[outcome.kind]||'和棋';
  if(!outcome.winner)return `和棋 · ${why}`;
  return `${outcome.winner==='w'?'白方':'黑方'}勝利 · ${why}`;
}
function computePhase(){
  if(session.ply<20)return '開局';
  const count=session.game.board().flat().filter(p=>p&&p.type!=='p'&&p.type!=='k').length;
  return count<=6?'殘局':'中局';
}
function statusDisplay(){
  if(training)return {title:training.solved?'訓練完成 · EXCELLENT':training.pendingReply?'正在示範黑方的回應':training.exercise.title,desc:training.solved?'選擇下一題或退出訓練。':training.exercise.goal};
  if(variation)return {title:'變例沙盒 · STUDY BOARD',desc:'你可以自由走出另一條合法路線，結束時儲存為獨立分支。'};
  const result=session.status();
  if(result)return {title:gameOutcomeText(result),desc:'本局已結束。你可以重新開始或下載棋譜。'};
  if(!session.atLatest)return {title:'正在回看棋譜',desc:'正式棋鐘仍在倒數；回到最新局面繼續，或開啟主選單暫停。'};
  if(thinking)return {title:'引擎正在思考',desc:'電腦正在計算最佳的下一步…'};
  if(session.game.isCheck())return {title:`${session.game.turn()==='w'?'白方':'黑方'}被將軍`,desc:'國王受到攻擊，必須先解除將軍。'};
  return {title:`輪到${session.game.turn()==='w'?'白方':'黑方'}走棋`,desc:session.ply===0?'選取棋子開始你的第一步。':'仔細觀察局面，尋找下一步。'};
}
function render(){
  const current=activeGame();
  const isPlayable=training?(!training.solved&&!training.pendingReply):variation?true:session.atLatest&&!session.done&&!thinking&&session.isHumanTurn();
  if((training||variation)&&mobileAnnotating){mobileAnnotating=false;board.setAnnotationMode(false);$('mobile-annotate-btn').setAttribute('aria-pressed','false');$('mobile-annotate-btn').textContent='標記';}
  board.update(current,{flipped,disabled:!isPlayable,lastHint,annotations:training||variation?[]:(session.study.marks[String(session.cursor)]||[])});
  $('active-match-summary').textContent=session.config.mode==='ai'?`人機對弈 · ${resolveLevel(session.config.level).label}`:'雙人本機對弈';
  $('active-match-detail').textContent=session.config.mode==='ai'?`${describeAiTime(session.config,session.clock)} · 雙方棋鐘 ${session.config.time==='none'?'不限時':session.config.time} · ${session.config.side==='w'?'執白':'執黑'}`:`雙方棋鐘 ${session.config.time==='none'?'不限時':session.config.time}`;
  const display=statusDisplay();$('status-overline').textContent=`ROUND ${String(Math.floor(session.ply/2)+1).padStart(2,'0')} · ${session.done?'FINISHED':thinking?'THINKING':'IN PROGRESS'}`;
  $('game-status-title').textContent=display.title;
  $('game-status-desc').textContent=display.desc;
  $('stat-moves').textContent=String(session.ply).padStart(2,'0');$('stat-phase').textContent=computePhase();
  $('arena-type').textContent=training?'TACTICS ACADEMY':variation?'VARIATION STUDY':session.config.mode==='ai'?'STOCKFISH MATCH':'LOCAL TWO-PLAYER MATCH';
  $('round-caption').textContent=training?'離線訓練 · PRACTICE':variation?'自由變例 · SANDBOX':session.atLatest?'經典對局 · STANDARD CHESS':'歷史局面 · REPLAY MODE';
  $('turn-message').textContent=training?`解題 · ${training.exercise.title}`:variation?'變例探索':display.title;
  $('focus-return').classList.toggle('hidden',!training&&!variation);
  $('focus-return').textContent=training?'結束練習':'結束變例';
  renderPlayers();renderMoves();renderAnalysis();renderOpenings();renderTraining();
  $('undo-btn').disabled=!training&&!variation&&session.ply===0;
  $('resign-btn').disabled=!!training||!!variation||session.done||session.ply===0;
  $('claim-draw').disabled=!!training||!!variation||!sessionActive||!session.isHumanTurn()||!session.canClaimDraw();
  updateClocks();
}
function renderPlayers(){
  const topSide=flipped?'w':'b',bottomSide=flipped?'b':'w';const captured=training||variation?{w:[],b:[]}:session.captured();
  for(const [position,color] of [['top',topSide],['bottom',bottomSide]]){
    if(training||variation){const isBottom=position==='bottom';$(`${position}-name`).textContent=training?(isBottom?'你 · 解題棋手':'教學應答棋手'):(isBottom?'變例棋手':'變例棋手');$(`${position}-detail`).textContent=training?(isBottom?'TRAINING · ACTIVE':'SCRIPTED REPLIES'):'FREE STUDY · LOCAL';$(`${position}-avatar`).textContent=color==='w'?'♔':'♚';$(`${position}-avatar`).className=`player-avatar ${color==='w'?'light-avatar':'dark-avatar'}`;$(`${position}-captured`).innerHTML='';continue;}
    const isHuman=session.config.mode==='local'||color===session.config.side;
    const name=session.config.mode==='local'?(color==='w'?'白方棋手':'黑方棋手'):(isHuman?`你 · ${color==='w'?'白方':'黑方'}`:(usingFallback?'備援 AI · 輕量棋力':'Stockfish 19'));
    const detail=session.config.mode==='local'?'本機對弈 · HUMAN':(isHuman?'人類棋手 · HUMAN':`棋力等級 · ${resolveLevel(session.config.level).label.toUpperCase()}`);
    $(`${position}-name`).textContent=name;$(`${position}-detail`).textContent=detail;
    $(`${position}-avatar`).textContent=color==='w'?'♔':'♚';
    $(`${position}-avatar`).className=`player-avatar ${color==='w'?'light-avatar':'dark-avatar'}`;
    const dest=$(`${position}-captured`);dest.innerHTML='';
    for(const type of captured[color]){const img=document.createElement('img');img.src=pieceSrc(type,color==='w'?'b':'w');img.alt='';img.title=`已吃掉${color==='w'?'黑':'白'}方的棋子`;dest.append(img);}
  }
}
function updateClocks(){
  const sideTop=flipped?'w':'b',sideBottom=flipped?'b':'w';
  for(const [pos,side] of [['top',sideTop],['bottom',sideBottom]]){
    const element=$(`${pos}-clock`);element.textContent=training?'TRAIN':variation?'STUDY':session.clock.format(side);
    element.className='clock-display';
    if(!training&&!variation&&!session.done&&session.clock.active===side)element.classList.add('active-clock');
    if(session.clock.enabled&&session.clock.remaining[side]<30000)element.classList.add('low-time');
  }
}
function renderMoves(){
  const moves=session.moves;const list=$('moves-list');
  renderStudy();$('moves-count').textContent=`${moves.length} PLIES`;
  $('position-indicator').textContent=session.cursor===0?'起始位置':`${session.cursor} / ${moves.length}`;
  for(const [button,disabled] of [['nav-start',session.cursor===0],['nav-prev',session.cursor===0],['nav-next',session.cursor===moves.length],['nav-end',session.cursor===moves.length]])$(button).disabled=disabled;
  const previous=list.querySelector('.move-token.current')?.dataset.ply;
  if(!moves.length){list.innerHTML='<div class="empty-state"><span class="empty-mark">♞</span><strong>棋局尚未開始</strong><small>每一步精彩著法，將在此完整記錄。</small></div>';return;}
  list.innerHTML='';const fragment=document.createDocumentFragment();
  const fenParts=session.initialFen.split(' ');
  const firstPly=(Math.max(1,Number(fenParts[5])||1)-1)*2+(fenParts[1]==='b'?1:0);
  for(let i=0;i<moves.length;){
    const blackFirst=(firstPly+i)%2===1;
    const row=document.createElement('div');row.className='move-row';
    const num=document.createElement('span');num.className='move-number';num.textContent=`${Math.floor((firstPly+i)/2)+1}${blackFirst?'...':'.'}`;row.append(num);
    if(blackFirst){const spacer=document.createElement('span');spacer.setAttribute('aria-hidden','true');row.append(spacer);}
    for(const j of (blackFirst?[i]:[i,i+1])){
      if(j>=moves.length)break;
      const button=document.createElement('button');button.type='button';button.className='move-token'+(session.cursor===j+1?' current':'');button.dataset.ply=String(j+1);button.textContent=moves[j].san;button.title=`查看第 ${j+1} 步`;
      button.onclick=()=>goToPly(j+1);row.append(button);
    }fragment.append(row);
    i+=blackFirst?1:2;
  }
  list.append(fragment);
  if(String(session.cursor)!==previous)list.querySelector('.move-token.current')?.scrollIntoView({block:'nearest'});
}
function renderAnalysis(){
  const target=$('analysis-state');
  if(analysisRunning){target.textContent='分析中…';}else if(thinking){target.textContent='正在計算';}
  else if(analysisInfo&&analysisFen===activeGame().fen())target.textContent='最新結果';
  else target.textContent=engineError?'備援模式':'等待分析';
  const current=activeGame();
  if(!analysisInfo||analysisFen!==current.fen()){
    $('eval-score').textContent='—';$('eval-fill').style.width='50%';$('eval-depth').textContent='啟動分析後顯示評分';
    $('pv-line').innerHTML='<div class="pv-empty">選擇「分析局面」以查看三條候選路線。</div>';return;
  }
  const score=scoreWhite(analysisInfo,current.turn());$('eval-score').textContent=score.text;
  $('eval-fill').style.width=`${score.ratio}%`;
  $('eval-depth').textContent=`搜索深度 ${analysisInfo.depth||'—'} · ${session.config.mode==='ai'?'Stockfish 19':'本機運算'}`;
  const dest=$('pv-line');dest.innerHTML='';
  for(const item of [...analysisLines.values()].sort((a,b)=>a.multiPV-b.multiPV)){
    const row=document.createElement('div');row.className='pv-candidate';
    const title=document.createElement('div');title.className='pv-title';const num=document.createElement('strong');num.textContent=`#${item.multiPV}`;
    const score=document.createElement('span');score.textContent=scoreWhite(item,current.turn()).text;
    const depth=document.createElement('small');depth.textContent=`D${item.depth||'—'}`;title.append(num,score,depth);
    const line=document.createElement('div');line.className='pv-san';line.textContent=pvToSan(analysisFen,item.pv);
    row.append(title,line);dest.append(row);
  }
}
async function analyze(hint=false){
  if(hint&&training){
    if(training.solved||training.pendingReply)return;
    const u=training.expected;lastHint={from:u.slice(0,2),to:u.slice(2,4)};render();toast('已標示此題的教學著法。','info');return;
  }
  if(thinking){toast('請先等電腦完成著法。','info');return;}
  cancelSearch();const token=++analysisSequence,fen=activeGame().fen();
  analysisLines=new Map();analysisInfo=null;analysisFen=fen;
  analysisRunning=true;$('stop-analysis').disabled=false;
  lastHint=null;
  renderAnalysis();
  if(!hint)openRightPanel('analysis');
  let best=null,latest=null;
  try{
    best=await ensureEngine().search(fen,{movetime:hint?850:Number($('analysis-time').value),multiPV:hint?1:Number($('multi-pv').value),skill:20,onInfo:info=>{
      if(token!==analysisSequence)return;
      analysisLines.set(info.multiPV||1,info);
      latest=analysisLines.get(1)||info;analysisInfo=latest;analysisFen=fen;renderAnalysis();
    }});
  }catch(error){engineError=error;}
  if(token!==analysisSequence||activeGame().fen()!==fen)return;
  analysisRunning=false;$('stop-analysis').disabled=true;
  if(!best){if(engineError){best=fallbackMove(fen,'master');toast('Stockfish 不可用，已使用備援建議。','info');}else{renderAnalysis();toast('未能完成分析。','error');return;}}
  if(!latest){analysisInfo={cp:null,mate:null,depth:0,multiPV:1,pv:[best]};analysisLines.set(1,analysisInfo);analysisFen=fen;}
  if(hint&&best){lastHint={from:best.slice(0,2),to:best.slice(2,4)};
    toast(`提示：${best.slice(0,2)} → ${best.slice(2,4)}。綠色格為建議著法。`,'info');
  }else toast('局面分析完成。');
  render();
}
function goToPly(ply){
  if(training||variation)return;
  const wasLatest=session.atLatest;
  const next=Math.max(0,Math.min(session.ply,ply));
  if(next!==session.cursor&&(thinking||analysisRunning))cancelSearch();
  session.goTo(next);lastHint=null;render();
  if(!wasLatest&&session.atLatest)resumeBotIfNeeded();
}
function navigate(move){
  const next=move==='first'?0:move==='last'?session.ply:session.cursor+(move==='prev'?-1:1);
  goToPly(next);
}
function flipBoard(){flipped=!flipped;render();}
function toggleMobileAnnotation(){
  if(training||variation){toast('請先返回正式對局，再使用棋盤標記。','info');return;}
  mobileAnnotating=!mobileAnnotating;
  board.setAnnotationMode(mobileAnnotating);
  $('mobile-annotate-btn').setAttribute('aria-pressed',String(mobileAnnotating));
  $('focus-annotate').setAttribute('aria-pressed',String(mobileAnnotating));
  $('mobile-annotate-btn').textContent=mobileAnnotating?'完成標記':'標記';
}
function doResign(){
  if(training||variation||session.done||session.ply===0)return;
  showConfirm('確定認輸？','認輸後將結束本局，但棋譜仍可匯出保存。',()=>{
    cancelSearch();const loser=session.config.mode==='ai'?session.config.side:session.game.turn();
    session.result={winner:loser==='w'?'b':'w',kind:'resign'};session.clock.pause();render();save();playSound('end',prefs.sound);toast(gameOutcomeText(session.result));
  },'確認認輸');
}
const modalFocus=new Map();
function openModal(id){
  modalFocus.set(id,document.activeElement);
  const dialog=$(id);dialog.classList.remove('hidden');
  dialog.querySelector('textarea,button:not([disabled])')?.focus({preventScroll:true});
}
function closeModal(id){
  $(id).classList.add('hidden');
  const previous=modalFocus.get(id);modalFocus.delete(id);
  if(previous?.isConnected)previous.focus({preventScroll:true});
}
function showConfirm(title,text,callback,buttonLabel='確認'){$('confirm-title').textContent=title;$('confirm-text').textContent=text;$('confirm-yes').textContent=buttonLabel;confirmCallback=callback;openModal('confirm-modal');}
async function copyText(value,name){
  try{await navigator.clipboard.writeText(value);toast(`已複製${name}。`);}
  catch{const area=document.createElement('textarea');area.value=value;area.style.position='fixed';area.style.opacity='0';document.body.append(area);area.select();const success=document.execCommand('copy');area.remove();toast(success?`已複製${name}。`:'無法複製，請使用瀏覽器的複製功能。',success?'success':'error');}
}
function exportStudyBackup(){
  const data={format:'chess-atelier-study-v1',game:serializedForSave()};
  const file=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(file),link=document.createElement('a');
  link.href=url;link.download=`Chess-Atelier-Study-${new Date().toISOString().slice(0,10)}.json`;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
  toast('完整研究備份已下載（含變例、標記和註解）。','success');
}
function exportPgn(){
  const file=new Blob([session.pgn()+'\n'],{type:'application/x-chess-pgn;charset=utf-8'}),url=URL.createObjectURL(file);
  const link=document.createElement('a');link.href=url;link.download=`Chess-Atelier-${new Date().toISOString().slice(0,10)}.pgn`;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),2000);toast('PGN 棋譜已匯出。');
}
function importPgn(){
  try{
    const text=$('pgn-input').value.trim();if(!text)throw new Error('請先貼上 PGN 棋譜。');
    const isBackup=text.startsWith('{')&&text.includes('"chess-atelier-study-v1"');
    let next,importedActiveSide=null;
    if(isBackup){
      const data=JSON.parse(text);
      if(data.format!=='chess-atelier-study-v1'||!data.game||typeof data.game.config!=='object')throw Error('研究備份格式無效');
      next=new ChessSession(data.game.config);
      next.restore(data.game,{resumeClock:!menuVisible(),strictStudy:true});
      importedActiveSide=data.game.clock?.active||null;
    }else{next=new ChessSession({...prefs,mode:'local',time:'none'});next.importPgn(text);}
    cancelSearch();exitTraining(false);variation=null;clockBeforeVariation=null;session=next;
    $('position-note').dataset.ply='';flipped=isBackup&&session.config.mode==='ai'&&session.config.side==='b';
    menuPauseSide=isBackup&&menuVisible()?importedActiveSide:null;
    usingFallback=false;lastHint=null;analysisInfo=null;analysisFen=null;
    if(mobileAnnotating){mobileAnnotating=false;board.setAnnotationMode(false);$('mobile-annotate-btn').setAttribute('aria-pressed','false');$('mobile-annotate-btn').textContent='標記';}
    prefs={...prefs,...next.config,side:isBackup?next.config.side:prefs.side,mode:next.config.mode,time:next.config.time};
    savePrefs(prefs);renderSettings();closeModal('import-modal');
    sessionActive=true;render();save();toast(`已載入 ${session.ply} 步${isBackup?'研究備份':'棋譜'}。`);closeDrawers();if(menuVisible())closeMainMenu();
  }catch(e){$('import-error').textContent=`匯入失敗：${e.message||'PGN 格式不正確'}`;}
}
// Only a viewport breakpoint may change the permanent HUD's placement.
 // Clicking a tab, selecting a mode, or opening study tools never resizes the board.
function placeMatchHud(){
  const docked=window.matchMedia('(min-width:780px)').matches;
  const top=$('top-player-strip'),bottom=$('bottom-player-strip'),back=$('focus-return');
  const topDest=docked?$('match-hud'):$('board-top-slot');
  const bottomDest=docked?$('match-hud'):$('board-bottom-slot');
  if(top.parentElement!==topDest)topDest.append(top);
  if(bottom.parentElement!==bottomDest)bottomDest.append(bottom);
  const returnDest=docked?$('focus-return-dock'):document.querySelector('.arena-mobile-actions');
  if(back.parentElement!==returnDest)returnDest.append(back);
}
function closeDrawers(){
  $('setup-panel').classList.remove('mobile-visible');$('right-panel').classList.remove('mobile-visible');$('mobile-scrim').classList.add('hidden');
  $('focus-match').setAttribute('aria-expanded','false');$('show-records').setAttribute('aria-expanded','false');
  document.querySelectorAll('.mobile-tab').forEach(b=>b.classList.toggle('active',b.dataset.mobile==='board'));
}
function openDrawer(which){
  closeDrawers();
  const target=which==='settings'?'setup-panel':'right-panel';
  $(target).classList.add('mobile-visible');$('mobile-scrim').classList.remove('hidden');
  $('focus-match').setAttribute('aria-expanded',String(which==='settings'));
  $('show-records').setAttribute('aria-expanded',String(which==='records'));
  document.querySelectorAll('.mobile-tab').forEach(b=>b.classList.toggle('active',b.dataset.mobile===which));
}
function openRightPanel(tab='moves'){
  document.querySelectorAll('.panel-tab').forEach(b=>{const active=b.dataset.tab===tab;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));});
  for(const name of ['moves','analysis','openings','training'])$(`${name}-tab`).classList.toggle('hidden',tab!==name);
  openDrawer('records');
}

function renderStudy(){
  const ply=session.cursor;
  $('note-position').textContent=ply===0?'初始局面':`第 ${ply} 手`;
  const textarea=$('position-note');if(textarea.dataset.ply!==String(ply)){
    textarea.value=session.study.notes[String(ply)]||'';textarea.dataset.ply=String(ply);
  }
  const strip=$('variation-strip');strip.classList.toggle('hidden',!variation);
  if(variation){$('variation-title').textContent=`第 ${variation.origin} 手之後的變例`;
    const g=new Chess(variation.fen),sans=[];for(const u of variation.moves)sans.push(g.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]}).san);
    $('variation-moves').textContent=sans.join('  ')||'尚未走棋';}
  const dest=$('variation-list');dest.innerHTML='';
  session.study.branches.forEach((b,i)=>{
    const item=document.createElement('button');item.className='variation-item';item.type='button';
    const g=new Chess(b.fen),sans=[];for(const u of b.moves)sans.push(g.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]}).san);
    item.textContent=`分支 ${i+1} · 自第 ${b.origin} 手 · ${sans.join(' ').slice(0,80)}`;
    item.onclick=()=>openVariation(i);dest.append(item);
  });
}
function renderOpenings(){
  const history=session.current.history();const found=openingFor(history);
  const next=continuations(history);
  $('opening-detected').textContent=found?`${found.eco} · ${found.name}`:history.length?(next.length?'尚未確定開局 · 繼續走棋以辨識':'目前路線不在精選庫中'):'標準起始局面 · 33 條精選路線';
  const cand=$('opening-candidates');cand.innerHTML='';
  for(const option of next.slice(0,8)){
    const item=document.createElement('div');item.className='candidate-item';
    const label=document.createElement('strong');label.textContent=option.san;
    const detail=document.createElement('small');detail.textContent=option.lines.slice(0,2).map(x=>x.name).join(' · ');
    item.append(label,detail);cand.append(item);
  }
  if(!next.length){const msg=document.createElement('small');msg.className='muted-placeholder';msg.textContent='精選路線在此沒有更多續著。';cand.append(msg);}
  const library=$('opening-library');library.innerHTML='';
  const filtered=OPENINGS.filter(o=>openingFilter==='all'||(openingFilter==='other'?!['e4','d4'].includes(o.moves[0]):o.moves[0]===openingFilter));
  for(const row of filtered){
    const el=document.createElement('button');el.className='library-card';el.type='button';
    const top=document.createElement('span');top.className='library-top';const eco=document.createElement('b');eco.textContent=row.eco;const name=document.createElement('strong');name.textContent=row.name;top.append(eco,name);
    const moves=document.createElement('small');moves.textContent=row.moves.map((m,i)=>(i%2===0?`${Math.floor(i/2)+1}. `:'')+m).join(' ').slice(0,110);
    const action=document.createElement('em');action.textContent='練習此路線  ↗';el.append(top,moves,action);
    el.onclick=()=>startExercise(openingExercise(row));library.append(el);
  }
}
function renderTraining(){
  const stats=readTrainingStats(),solved=Object.values(stats).filter(x=>x?.solved).length;
  $('solved-count').textContent=`${solved} / ${PUZZLES.length}`;
  $('training-active').classList.toggle('hidden',!training);
  if(training){$('training-label').textContent=training.exercise.category.toUpperCase();$('training-name').textContent=training.exercise.title;
    $('training-goal').textContent=training.solved?'✅ 練習完成。可以再練一次或選擇下一題。':training.exercise.goal;
    $('training-step').textContent=`進度 ${training.progress}`;$('training-errors').textContent=`嘗試錯誤 ${training.errors}`;}
  const list=$('puzzle-library');list.innerHTML='';
  for(const p of PUZZLES.filter(x=>puzzleFilter==='全部'||x.category===puzzleFilter)){
    const b=document.createElement('button');b.className='library-card puzzle-card';b.type='button';
    const top=document.createElement('span');top.className='library-top';const star=document.createElement('b');star.textContent=stats[p.id]?.solved?'✓':`★${p.rating}`;const title=document.createElement('strong');title.textContent=p.title;top.append(star,title);
    const desc=document.createElement('small');desc.textContent=`${p.category} · ${p.goal}`;b.append(top,desc);
    b.onclick=()=>startExercise(p);list.append(b);
  }
}
function bindActions(){
  document.querySelectorAll('[data-mode]').forEach(el=>el.onclick=()=>{document.querySelectorAll('[data-mode]').forEach(x=>x.classList.remove('active'));el.classList.add('active');refreshPrefsFromUi();});
  document.querySelectorAll('[data-side]').forEach(el=>el.onclick=()=>{document.querySelectorAll('[data-side]').forEach(x=>x.classList.remove('selected'));el.classList.add('selected');refreshPrefsFromUi();});
  $('level-select').onchange=refreshPrefsFromUi;$('time-select').onchange=refreshPrefsFromUi;$('ai-think-select').onchange=refreshPrefsFromUi;$('ai-time-mode').onchange=refreshPrefsFromUi;
  $('main-menu-open').onclick=openMainMenu;$('mobile-main-menu').onclick=openMainMenu;
  $('menu-close').onclick=closeMainMenu;$('menu-continue').onclick=closeMainMenu;
  $('menu-new').onclick=()=>setMenuEditing(true);
  $('menu-start-shortcut').onclick=showNewGame;
  $('menu-import').onclick=()=>{$('pgn-input').value='';$('import-error').textContent='';openModal('import-modal');};
  $('menu-save').onclick=saveManual;$('save-game').onclick=saveManual;$('menu-load').onclick=loadManual;
  $('new-game').onclick=showNewGame;$('undo-btn').onclick=()=>doUndo();$('flip-btn').onclick=flipBoard;
  $('mobile-undo-btn').onclick=()=>doUndo();$('mobile-flip-btn').onclick=flipBoard;$('mobile-hint-btn').onclick=()=>analyze(true);
  $('mobile-annotate-btn').onclick=toggleMobileAnnotation;
  $('focus-annotate').onclick=toggleMobileAnnotation;
  $('focus-hint').onclick=()=>analyze(true);
  $('focus-open-study').onclick=()=>openRightPanel('moves');
  $('focus-open-analysis').onclick=()=>openRightPanel('analysis');
  $('focus-return').onclick=()=>{if(training)exitTraining();else if(variation)finishVariation();};
  $('sound-btn').onclick=()=>{prefs.sound=!prefs.sound;savePrefs(prefs);renderSettings();toast(prefs.sound?'音效已開啟':'音效已關閉','info');};
  $('resign-btn').onclick=doResign;
  $('claim-draw').onclick=()=>{
    if(!session.isHumanTurn())return;
    session.clock.snapshot();
    if(!session.claimDraw())return;
    cancelSearch();render();save();playSound('end',prefs.sound);toast('已依棋規主張和棋。','success');
  };
  $('nav-start').onclick=()=>navigate('first');$('nav-prev').onclick=()=>navigate('prev');$('nav-next').onclick=()=>navigate('next');$('nav-end').onclick=()=>navigate('last');
  document.querySelectorAll('.panel-tab').forEach(b=>b.onclick=()=>openRightPanel(b.dataset.tab));
  $('analyze-btn').onclick=()=>analyze(false);$('hint-btn').onclick=()=>analyze(true);
  $('stop-analysis').onclick=()=>{cancelSearch({preserveAnalysis:true});toast('已停止計算，保留目前取得的分析結果。','info');};
  $('position-note').addEventListener('input',()=>{
    const ply=Number($('position-note').dataset.ply);
    if(!Number.isInteger(ply))return;
    session.study.setNote(ply,$('position-note').value);
    clearTimeout(noteSaveTimer);noteSaveTimer=setTimeout(()=>save(),350);
  });
  $('save-note').onclick=()=>{clearTimeout(noteSaveTimer);session.study.setNote(session.cursor,$('position-note').value);save();toast('棋譜註解已儲存，也會寫入匯出的 PGN。');};
  $('create-variation').onclick=beginVariation;$('finish-variation').onclick=finishVariation;
  $('export-variation').onclick=()=>{if(variation)copyText(session.study.branchPgn(variation),'變例 PGN');};
  $('opening-filter').onchange=e=>{openingFilter=e.target.value;renderOpenings();};
  $('puzzle-filter').onchange=e=>{puzzleFilter=e.target.value;renderTraining();};
  $('training-reset').onclick=()=>{if(training){trainingToken++;training.restart();render();}};
  $('training-exit').onclick=()=>exitTraining();
  $('copy-fen').onclick=()=>copyText(activeGame().fen(),'FEN 局面');$('copy-pgn').onclick=()=>copyText(session.pgn(),'主線 PGN 棋譜');$('export-btn').onclick=exportPgn;
  $('download-study').onclick=exportStudyBackup;
  $('import-pgn').onclick=()=>{$('pgn-input').value='';$('import-error').textContent='';openModal('import-modal');};
  $('import-confirm').onclick=importPgn;$('import-cancel').onclick=()=>closeModal('import-modal');
  $('promotion-cancel').onclick=()=>{promotion=null;closeModal('promotion-modal');render();};
  $('confirm-cancel').onclick=()=>{confirmCallback=null;closeModal('confirm-modal');};
  $('confirm-yes').onclick=()=>{const callback=confirmCallback;confirmCallback=null;closeModal('confirm-modal');callback?.();};
  $('mobile-settings').onclick=openMainMenu;
  $('focus-match').onclick=()=>openDrawer('settings');$('focus-close-match').onclick=closeDrawers;
  $('show-records').onclick=()=>openRightPanel('moves');$('close-records').onclick=closeDrawers;$('mobile-scrim').onclick=closeDrawers;
  document.querySelectorAll('.mobile-tab').forEach(b=>b.onclick=()=>{if(b.dataset.mobile==='board')closeDrawers();else if(b.dataset.mobile==='settings')openMainMenu();else openDrawer(b.dataset.mobile);});
  document.querySelectorAll('.modal-backdrop').forEach(el=>el.addEventListener('click',event=>{if(event.target!==el)return;if(el.id==='promotion-modal'||el.id==='main-menu-modal')return;closeModal(el.id);}));
  window.addEventListener('keydown',event=>{
    const modal=[...document.querySelectorAll('.modal-backdrop:not(.hidden)')].at(-1);
    if(event.key==='Tab'&&modal){
      const focusable=[...modal.querySelectorAll('button:not([disabled]),textarea,select')].filter(el=>el.getClientRects().length&&el.tabIndex>=0);
      if(focusable.length){const first=focusable[0],last=focusable.at(-1);
        if(event.shiftKey&&(document.activeElement===first||!modal.contains(document.activeElement))){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&(document.activeElement===last||!modal.contains(document.activeElement))){event.preventDefault();first.focus();}
      }
      return;
    }
    if(event.key==='Escape'){
      if(!$('promotion-modal').classList.contains('hidden')){$('promotion-cancel').click();return;}
      if(!$('confirm-modal').classList.contains('hidden')){confirmCallback=null;closeModal('confirm-modal');return;}
      if(!$('import-modal').classList.contains('hidden')){closeModal('import-modal');return;}
      if(menuVisible()){closeMainMenu();return;}
      closeDrawers();return;
    }
    if(modal||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();doUndo();}
    else if(event.key.toLowerCase()==='f'&&!event.ctrlKey&&!event.metaKey){flipBoard();}
  });
  window.addEventListener('resize',()=>{placeMatchHud();if(window.innerWidth>779)closeDrawers();});
}

function init(){
  const check=inspectUi(document);
  if(!check.ok){showStartupError(document,check);return;}
  try{
    decorateIcons();
    createGameBoard();
    $('engine-status').textContent='Stockfish 19 · 按需載入';
    startApplication();
    if('serviceWorker' in navigator&&window.isSecureContext){
      navigator.serviceWorker.register('./sw.js').catch(error=>console.warn('[Chess Atelier] Offline cache unavailable:',error));
    }
  }catch(error){
    console.error('[Chess Atelier PRO] Fatal initialization failure:',error);
    showStartupError(document,{reason:'runtime',missing:[error.message||String(error)]});
  }
}
function startApplication(){
  const {value:saved,corrupted}=inspectSavedGame();let invalidSave=corrupted;
  if(saved){try{
    // Parse the entire save into a temporary session before replacing live state.
    const next=new ChessSession(saved.config);next.restore(saved,{resumeClock:false,strictStudy:true});
    session=next;sessionActive=true;
    menuPauseSide=saved.clock?.active||null;
    prefs={...prefs,...saved.config,side:prefs.side==='random'?'random':saved.config.side};flipped=session.config.mode==='ai'&&session.config.side==='b';
  }catch{invalidSave=true;}}
  // Random is a selection preference, not the resolved side stored in an old game.
  if(!['w','b','random'].includes(prefs.side))prefs.side='w';
  renderSettings();bindActions();placeMatchHud();
  if(invalidSave)toast('自動存檔損毀，已保留原始資料。請使用手動存檔或備份恢復。','error');
  for(const category of CATEGORIES.slice(1)){$('puzzle-filter').add(new Option(category,category));}
  render();
  $('main-menu-modal').classList.remove('hidden');
  setMenuEditing(true);
  updateSaveInfo();
  window.addEventListener('pagehide',()=>{clearTimeout(noteSaveTimer);save();});
  setInterval(()=>{
    if(menuVisible()||!sessionActive)return;
    const timedOut=session.clock.tick();
    if(timedOut){
      cancelSearch();
      const outcome=session.status();
      if(outcome?.kind==='timeout')session.result=outcome;
      render();save();playSound('end',prefs.sound);
      if(outcome?.kind==='timeout')toast(gameOutcomeText(outcome),'info');
    }
    else if(session.clock.enabled)updateClocks();
  },200);
}
init();
