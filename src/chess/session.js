import {Chess,DEFAULT_POSITION} from '../../vendor/chess.js';
import {ChessClock} from './clock.js';
import {GameHistoryIndex} from './history-index.js';
import {StudyBook} from '../study/studybook.js';
import {normalizeAiTimeMode} from './time-management.js';
export const LEVELS={
  beginner:{label:'入門',detail:'適合初學者',skill:0,movetime:350},
  casual:{label:'休閒',detail:'輕鬆練習',skill:5,movetime:550},
  club:{label:'俱樂部',detail:'具備戰術意識',skill:10,movetime:800},
  expert:{label:'高手',detail:'積極計算變化',skill:16,movetime:1300},
  master:{label:'大師',detail:'高強度對抗',skill:20,movetime:2500},
};
// Stockfish exposes 21 discrete UCI Skill Level values, independent of thinking time.
export const SKILL_LEVELS=Object.freeze(Object.fromEntries(Array.from({length:21},(_,i)=>[
  `skill-${i}`,{label:`Lv ${String(i+1).padStart(2,'0')} · Skill ${i}/20`,
  detail:i<5?'入門練習':i<10?'休閒對弈':i<15?'俱樂部挑戰':i<19?'進階戰術':'高強度挑戰',
  skill:i,movetime:2000}
])));
export const resolveLevel=id=>SKILL_LEVELS[id]||LEVELS[id]||SKILL_LEVELS['skill-10'];

/** FIDE 6.9: a flag only wins if the opponent could mate by some legal sequence.
 * This is a possibility test, not an assessment of whether mate is forceable.
 */
export function canPossiblyMate(game,color){
  const pieces=game.board().flat().filter(Boolean);
  const attackers=pieces.filter(p=>p.color===color&&p.type!=='k');
  if(!attackers.length)return false;
  if(attackers.some(p=>['p','r','q'].includes(p.type)))return true;
  const defenders=pieces.filter(p=>p.color!==color&&p.type!=='k');
  // A defending piece can obstruct its own king, enabling helpmates.
  if(defenders.length)return true;
  const knights=attackers.filter(p=>p.type==='n').length;
  const bishops=attackers.filter(p=>p.type==='b');
  if(knights)return knights>=2||bishops.length>0;
  // Bishops operating on only one square colour cannot mate a bare king.
  return new Set(bishops.map(p=>('abcdefgh'.indexOf(p.square[0])+Number(p.square[1]))%2)).size>=2;
}
const RESULT_KINDS=new Set(['checkmate','stalemate','insufficient','fivefold','seventyfive-move',
  'timeout','timeout-insufficient','threefold-claim','fifty-move-claim','resign','pgn','draw']);
function validClockRecord(value){
  return !!value&&typeof value==='object'&&!Array.isArray(value)
    &&!!value.remaining&&typeof value.remaining==='object'&&!Array.isArray(value.remaining)
    &&['w','b'].every(side=>Number.isFinite(value.remaining[side])&&value.remaining[side]>=0)
    &&(value.active==null||['w','b'].includes(value.active))
    &&(value.timeout==null||['w','b'].includes(value.timeout))
    &&(value.savedAt===undefined||(Number.isFinite(value.savedAt)&&value.savedAt>=0));
}
export class ChessSession{
  constructor(prefs){this.configure(prefs);}
  configure(prefs){
    this.config={...prefs,side:prefs.side==='random'?(Math.random()<.5?'w':'b'):prefs.side};
    this.initialFen=DEFAULT_POSITION;this.game=new Chess();this.headers={};this.cursor=0;this.result=null;this.clock=new ChessClock(prefs.time);this.clockSnapshots=[];this.lastMove=null;this.study=new StudyBook();
    this.historyIndex=new GameHistoryIndex(this.game,this.initialFen);this.viewCache=null;this.boardStatusCache=null;this.variationDraft=null;
  }
  get moves(){this.historyIndex.sync(this.game,this.initialFen);return this.historyIndex.moves;}
  get ply(){this.historyIndex.sync(this.game,this.initialFen);return this.historyIndex.moves.length;}
  get atLatest(){return this.cursor===this.ply;}
  get current(){
    if(this.atLatest)return this.game;
    const moves=this.moves,revision=this.historyIndex.revision;
    if(this.viewCache?.revision===revision&&this.viewCache.cursor===this.cursor)return this.viewCache.game;
    const view=new Chess(this.initialFen);
    for(let i=0;i<this.cursor;i++)view.move(moves[i].san);
    this.viewCache={revision,cursor:this.cursor,game:view};
    return view;
  }
  get done(){return !!this.status();}
  /** At three repetitions / 50 moves the side to move may claim, but play continues. */
  canClaimDraw(){
    return !this.status()&&this.atLatest&&(this.historyIndex.repetitions()>=3||this.game.isDrawByFiftyMoves());
  }
  claimDraw(){
    // A draw claim cannot retroactively overrule a clock that has just flagged.
    this.clock.tick();
    if(!this.isHumanTurn()||!this.canClaimDraw())return false;
    this.result={winner:null,kind:this.historyIndex.repetitions()>=3?'threefold-claim':'fifty-move-claim'};
    this.clock.pause();
    return true;
  }
  /** FIDE: the same position occurring five times ends the game automatically. */
  isFivefoldRepetition(){this.historyIndex.sync(this.game,this.initialFen);return this.historyIndex.repetitions()>=5;}
  isHumanTurn(){return this.config.mode==='local'||this.game.turn()===this.config.side;}
  play(move){
    if(!this.atLatest||this.done)return null;
    const beforeClock=this.clock.snapshot();
    // snapshot() updates elapsed time; a move must never be accepted after flag fall.
    if(this.done)return null;
    try{const result=this.game.move(move);if(!result)return null;
      this.historyIndex.recordMove(result);
      this.viewCache=null;this.boardStatusCache=null;
      this.clockSnapshots.push(beforeClock);
      if(this.headers.Result&&this.headers.Result!=='*')this.headers.Result='*';
      this.cursor=this.ply;this.lastMove=result;this.clock.afterMove(result.color,this.game.turn());
      // Checkmate/draw ends the clock immediately; neither side can later flag.
      if(this.status())this.clock.pause();
      return result;
    }catch{return null;}
  }
  undoTargetPly(){
    const take=this.config.mode==='ai'?(this.ply===1?1:this.isHumanTurn()?2:1):1;
    return Math.max(0,this.ply-take);
  }
  undo(){
    if(this.ply===0)return 0;this.clock.pause();this.clock.timeout=null;this.result=null;
    if(this.headers.Result&&this.headers.Result!=='*')this.headers.Result='*';
    const take=this.ply-this.undoTargetPly();
    let undone=0,restoreClock=null;
    this.historyIndex.sync(this.game,this.initialFen);
    for(let i=0;i<take;i++)if(this.game.undo()){
      this.historyIndex.recordUndo();
      undone++;restoreClock=this.clockSnapshots.pop()||null;
    }
    if(undone){this.viewCache=null;this.boardStatusCache=null;}
    if(restoreClock)this.clock.restore(restoreClock,{resume:true});
    this.cursor=this.ply;this.lastMove=this.moves.at(-1)||null;
    // Removed main-line positions must not inherit their former notes/marks/branches.
    if(undone)this.study.pruneAfter(this.ply);
    return undone;
  }
  goTo(ply){this.cursor=Math.min(this.ply,Math.max(0,ply));}
  pgn(){
    const temp=new Chess(this.initialFen);
    if(this.initialFen!==DEFAULT_POSITION){temp.header('SetUp','1','FEN',this.initialFen);}
    temp.header('Event','Chess Atelier Offline','Site','Local Browser','Date',new Date().toISOString().slice(0,10).replaceAll('-','.'));
    for(const [name,value] of Object.entries(this.headers)){if(typeof value==='string')temp.header(name,value);}
    if(this.study.notes['0'])temp.setComment(this.study.notes['0']);
    this.moves.forEach((move,i)=>{temp.move(move.san);if(this.study.notes[String(i+1)])temp.setComment(this.study.notes[String(i+1)]);});
    const outcome=this.status();
    if(outcome)temp.header('Result',outcome.winner==='w'?'1-0':outcome.winner==='b'?'0-1':'1/2-1/2');
    return temp.pgn({maxWidth:72});
  }
  importPgn(text){
    const loaded=new Chess();loaded.loadPgn(text,{strict:false});
    const headers=loaded.getHeaders?.()||{};
    const initial=headers.FEN||DEFAULT_POSITION;
    const verified=new Chess(initial);
    loaded.history().forEach(san=>verified.move(san));
    this.initialFen=initial;this.game=verified;this.historyIndex.attach(this.game,this.initialFen);
    this.viewCache=null;this.boardStatusCache=null;this.headers={...headers};this.cursor=this.ply;this.lastMove=this.moves.at(-1)||null;
    this.study=new StudyBook();
    const commentAt=new Chess(initial);if(loaded.getComments){const commentMap=new Map(loaded.getComments().map(x=>[x.fen,x.comment]));if(commentMap.has(commentAt.fen()))this.study.setNote(0,commentMap.get(commentAt.fen()));for(const [i,san] of loaded.history().entries()){commentAt.move(san);if(commentMap.has(commentAt.fen()))this.study.setNote(i+1,commentMap.get(commentAt.fen()));}}
    const result=headers.Result||text.trim().match(/(?:^|\s)(1-0|0-1|1\/2-1\/2)\s*$/)?.[1]||'*';
    this.result=result==='1-0'?{winner:'w',kind:'pgn'}:result==='0-1'?{winner:'b',kind:'pgn'}:result==='1/2-1/2'?{winner:null,kind:'pgn'}:null;
    this.config.mode='local';this.config.time='none';this.clock=new ChessClock('none');this.clockSnapshots=[];
  }
  serialize(){return {version:1,config:this.config,initialFen:this.initialFen,headers:this.headers,moves:this.moves.map(m=>m.san),result:this.result,clock:this.clock.snapshot(),clockSnapshots:this.clockSnapshots,study:this.study.serialize()};}
  restore(saved,{resumeClock=true,accountElapsed=false,strictStudy=false}={}){
    if(!saved||saved.version!==1||!saved.config||typeof saved.config!=='object'||Array.isArray(saved.config)||!Array.isArray(saved.moves)||saved.moves.length>2000)throw Error('Invalid saved game');
    if(!['ai','local'].includes(saved.config.mode)
      ||!['w','b'].includes(saved.config.side)
      ||!(saved.config.time==='none'||/^[0-9]{1,3}\+[0-9]{1,3}$/.test(saved.config.time))
      ||saved.moves.some(san=>typeof san!=='string'||san.length>32))throw Error('Invalid saved configuration or moves');
    if(strictStudy&&(!saved.study||typeof saved.study!=='object'))throw Error('研究備份缺少研究資料');
    if(saved.clockSnapshots!==undefined&&(!Array.isArray(saved.clockSnapshots)||saved.clockSnapshots.length>2000))throw Error('Invalid saved clock history');
    this.configure(saved.config);
    if(!this.config.aiThink)this.config.aiThink=String(resolveLevel(this.config.level).movetime);
    // Old saves used fixed time; do not silently reinterpret them.
    this.config.aiTimeMode=normalizeAiTimeMode(saved.config.aiTimeMode);
    this.initialFen=saved.initialFen||DEFAULT_POSITION;this.headers=saved.headers||{};this.game=new Chess(this.initialFen);
    const moveSides=[];saved.moves.forEach(san=>{moveSides.push(this.game.turn());this.game.move(san,{strict:true});});
    this.historyIndex.attach(this.game,this.initialFen);this.viewCache=null;this.boardStatusCache=null;
    this.cursor=this.ply;this.lastMove=this.moves.at(-1)||null;this.result=null;this.study=new StudyBook(saved.study,{strict:strictStudy});
    this.clockSnapshots=Array.isArray(saved.clockSnapshots)?saved.clockSnapshots:[];
    if(this.clockSnapshots.some((entry,i)=>!validClockRecord(entry)||entry.timeout!=null
      ||(strictStudy&&entry.active!=null&&entry.active!==moveSides[i]))
      ||(strictStudy&&this.clockSnapshots.length>0&&this.clockSnapshots.length!==saved.moves.length)
      ||(strictStudy&&this.clock.enabled&&saved.clockSnapshots!==undefined&&saved.moves.length>0&&this.clockSnapshots.length===0))
      throw Error('Invalid saved clock history');
    let positions=null;
    if(strictStudy){
      positions=[new Chess(this.initialFen).fen()];const replay=new Chess(this.initialFen);
      for(const san of saved.moves){replay.move(san);positions.push(replay.fen());}
      for(const branch of this.study.branches){
        if(branch.origin>=positions.length||branch.fen!==positions[branch.origin]){
          throw Error('研究備份的變例起點與主線不一致');
        }
      }
      for(const key of [...Object.keys(this.study.notes),...Object.keys(this.study.marks)]){
        if(Number(key)>this.ply)throw Error('研究備份包含超出主線的註解或標記');
      }
    }
    if(saved.variationDraft!=null){
      const draft=saved.variationDraft;
      if(!draft||typeof draft!=='object'||Array.isArray(draft)
        ||!Number.isInteger(draft.persistedBranchIndex)||draft.persistedBranchIndex< -1
        ||draft.persistedBranchIndex>=this.study.branches.length)throw Error('Invalid variation draft');
      const validated=this.study.validateBranch(draft.origin,draft.fen,draft.moves);
      if(strictStudy&&(draft.origin>=positions.length||positions[draft.origin]!==draft.fen))
        throw Error('研究備份的變例草稿起點與主線不一致');
      if(draft.persistedBranchIndex>=0){
        const existing=this.study.branches[draft.persistedBranchIndex];
        if(existing.origin!==draft.origin||existing.fen!==draft.fen)throw Error('Invalid variation draft branch');
      }
      this.variationDraft={...validated,persistedBranchIndex:draft.persistedBranchIndex};
    }
    if(saved.clock!==undefined&&saved.clock!==null&&!validClockRecord(saved.clock))
      throw Error('Invalid saved clock');
    if(strictStudy&&saved.clock){
      if(!this.clock.enabled&&(saved.clock.active!=null||saved.clock.timeout!=null))throw Error('Invalid saved clock');
      if(saved.clock.active!=null&&saved.clock.active!==this.game.turn())throw Error('Invalid saved clock turn');
      if(saved.clock.timeout!=null&&saved.clock.timeout!==this.game.turn())throw Error('Invalid saved clock timeout');
    }
    this.clock.restore(saved.clock,{resume:resumeClock,accountElapsed});
    if(saved.result!=null){
      const result=saved.result;
      if(!result||typeof result!=='object'||Array.isArray(result)
        ||!RESULT_KINDS.has(result.kind)||!Object.hasOwn(result,'winner')
        ||(result.winner!==null&&!['w','b'].includes(result.winner))
        ||(result.kind==='draw'&&result.winner!==null))throw Error('Invalid saved result');
      if(strictStudy){
        const inferred=this.status();
        const derived=new Set(['checkmate','stalemate','insufficient','fivefold','seventyfive-move','timeout','timeout-insufficient']);
        if(derived.has(result.kind)&&(!inferred||inferred.kind!==result.kind||inferred.winner!==result.winner))
          throw Error('Invalid saved result for position');
        if(!derived.has(result.kind)&&inferred
          &&!(result.kind==='pgn'&&inferred.winner===result.winner&&inferred.kind!=='timeout'&&inferred.kind!=='timeout-insufficient'))
          throw Error('Invalid saved result: game already finished');
        if(result.kind==='resign'&&(this.ply===0||result.winner!==(this.config.mode==='ai'
          ?(this.config.side==='w'?'b':'w'):(this.game.turn()==='w'?'b':'w'))))
          throw Error('Invalid saved resignation');
        if(result.kind==='threefold-claim'&&(result.winner!==null||this.historyIndex.repetitions()<3))
          throw Error('Invalid saved draw claim');
        if(result.kind==='fifty-move-claim'&&(result.winner!==null||!this.game.isDrawByFiftyMoves()))
          throw Error('Invalid saved draw claim');
        if(result.kind==='pgn'&&this.headers.Result&&this.headers.Result!=='*'
          &&this.headers.Result!==(result.winner==='w'?'1-0':result.winner==='b'?'0-1':'1/2-1/2'))
          throw Error('Invalid saved PGN result');
      }
      this.result={winner:result.winner,kind:result.kind};
    }
    if(this.status())this.clock.pause();
  }
  captured(){
    const pieces={w:[],b:[]};for(const m of this.moves){if(m.captured)pieces[m.color].push(m.captured);}
    const weight={q:0,r:1,b:2,n:3,p:4};
    for(const s of ['w','b'])pieces[s].sort((a,b)=>weight[a]-weight[b]);
    return pieces;
  }
  status(){
    if(this.result)return this.result;
    this.historyIndex.sync(this.game,this.initialFen);
    const revision=this.historyIndex.revision;
    if(this.boardStatusCache?.revision!==revision){
      let outcome=null;
      if(this.game.isCheckmate())outcome={winner:this.game.turn()==='w'?'b':'w',kind:'checkmate'};
      else if(this.game.isStalemate())outcome={winner:null,kind:'stalemate'};
      else if(this.game.isInsufficientMaterial())outcome={winner:null,kind:'insufficient'};
      // FIDE 9.6: five repetitions / 75 moves are automatic. Threefold /
      // 50-move conditions require an explicit claim.
      else if(Number(this.game.fen().split(' ')[4])>=150)outcome={winner:null,kind:'seventyfive-move'};
      else if(this.isFivefoldRepetition())outcome={winner:null,kind:'fivefold'};
      this.boardStatusCache={revision,outcome};
    }
    if(this.boardStatusCache.outcome)return this.boardStatusCache.outcome;
    if(this.clock.timeout){
      const winner=this.clock.timeout==='w'?'b':'w';
      return canPossiblyMate(this.game,winner)?{winner,kind:'timeout'}:{winner:null,kind:'timeout-insufficient'};
    }
    return null;
  }
}
