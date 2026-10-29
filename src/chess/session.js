import {Chess,DEFAULT_POSITION} from '../../vendor/chess.js';
import {ChessClock} from './clock.js';
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
export class ChessSession{
  constructor(prefs){this.configure(prefs);}
  configure(prefs){
    this.config={...prefs,side:prefs.side==='random'?(Math.random()<.5?'w':'b'):prefs.side};
    this.initialFen=DEFAULT_POSITION;this.game=new Chess();this.headers={};this.cursor=0;this.result=null;this.clock=new ChessClock(prefs.time);this.clockSnapshots=[];this.lastMove=null;this.study=new StudyBook();
  }
  get moves(){return this.game.history({verbose:true});}
  get ply(){return this.moves.length;}
  get atLatest(){return this.cursor===this.ply;}
  get current(){
    if(this.atLatest)return this.game;
    const view=new Chess(this.initialFen);const moves=this.moves;
    for(let i=0;i<this.cursor;i++)view.move(moves[i].san);
    return view;
  }
  get done(){return !!this.result||this.game.isGameOver()||!!this.clock.timeout;}
  isHumanTurn(){return this.config.mode==='local'||this.game.turn()===this.config.side;}
  play(move){
    if(!this.atLatest||this.done)return null;
    const beforeClock=this.clock.snapshot();
    // snapshot() updates elapsed time; a move must never be accepted after flag fall.
    if(this.done)return null;
    try{const result=this.game.move(move);if(!result)return null;
      this.clockSnapshots.push(beforeClock);
      if(this.headers.Result&&this.headers.Result!=='*')this.headers.Result='*';
      this.cursor=this.ply;this.lastMove=result;this.clock.afterMove(result.color,this.game.turn());
      // Checkmate/draw ends the clock immediately; neither side can later flag.
      if(this.game.isGameOver())this.clock.pause();
      return result;
    }catch{return null;}
  }
  undo(){
    if(this.ply===0)return 0;this.clock.pause();this.clock.timeout=null;this.result=null;
    const take=this.config.mode==='ai'?(this.ply===1?1:this.isHumanTurn()?2:1):1;
    let undone=0,restoreClock=null;
    for(let i=0;i<take;i++)if(this.game.undo()){
      undone++;restoreClock=this.clockSnapshots.pop()||null;
    }
    if(restoreClock)this.clock.restore(restoreClock,{resume:true});
    this.cursor=this.ply;this.lastMove=this.moves.at(-1)||null;return undone;
  }
  goTo(ply){this.cursor=Math.min(this.ply,Math.max(0,ply));}
  pgn(){
    const temp=new Chess(this.initialFen);
    if(this.initialFen!==DEFAULT_POSITION){temp.header('SetUp','1','FEN',this.initialFen);}
    temp.header('Event','Chess Atelier Offline','Site','Local Browser','Date',new Date().toISOString().slice(0,10).replaceAll('-','.'));
    for(const [name,value] of Object.entries(this.headers)){if(typeof value==='string')temp.header(name,value);}
    if(this.study.notes['0'])temp.setComment(this.study.notes['0']);
    this.moves.forEach((move,i)=>{temp.move(move.san);if(this.study.notes[String(i+1)])temp.setComment(this.study.notes[String(i+1)]);});
    if(this.result)temp.header('Result',this.result.winner==='w'?'1-0':this.result.winner==='b'?'0-1':'1/2-1/2');
    return temp.pgn({maxWidth:72});
  }
  importPgn(text){
    const loaded=new Chess();loaded.loadPgn(text,{strict:false});
    const headers=loaded.getHeaders?.()||{};
    const initial=headers.FEN||DEFAULT_POSITION;
    const verified=new Chess(initial);
    loaded.history().forEach(san=>verified.move(san));
    this.initialFen=initial;this.game=verified;this.headers={...headers};this.cursor=verified.history().length;this.lastMove=this.moves.at(-1)||null;
    this.study=new StudyBook();
    const commentAt=new Chess(initial);if(loaded.getComments){const commentMap=new Map(loaded.getComments().map(x=>[x.fen,x.comment]));if(commentMap.has(commentAt.fen()))this.study.setNote(0,commentMap.get(commentAt.fen()));for(const [i,san] of loaded.history().entries()){commentAt.move(san);if(commentMap.has(commentAt.fen()))this.study.setNote(i+1,commentMap.get(commentAt.fen()));}}
    this.result=null;this.config.mode='local';this.config.time='none';this.clock=new ChessClock('none');this.clockSnapshots=[];
  }
  serialize(){return {version:1,config:this.config,initialFen:this.initialFen,headers:this.headers,moves:this.moves.map(m=>m.san),result:this.result,clock:this.clock.snapshot(),clockSnapshots:this.clockSnapshots,study:this.study.serialize()};}
  restore(saved,{resumeClock=true,accountElapsed=false}={}){
    if(!saved||saved.version!==1||!Array.isArray(saved.moves)||saved.moves.length>2000)throw Error('Invalid saved game');
    this.configure(saved.config);
    if(!this.config.aiThink)this.config.aiThink=String(resolveLevel(this.config.level).movetime);
    // Old saves used fixed time; do not silently reinterpret them.
    this.config.aiTimeMode=normalizeAiTimeMode(saved.config.aiTimeMode);
    this.initialFen=saved.initialFen||DEFAULT_POSITION;this.headers=saved.headers||{};this.game=new Chess(this.initialFen);
    saved.moves.forEach(san=>this.game.move(san,{strict:true}));
    this.cursor=this.ply;this.lastMove=this.moves.at(-1)||null;this.result=saved.result||null;this.study=new StudyBook(saved.study);
    this.clockSnapshots=Array.isArray(saved.clockSnapshots)?saved.clockSnapshots:[];
    this.clock.restore(saved.clock,{resume:resumeClock,accountElapsed});
    if(this.result||this.game.isGameOver())this.clock.pause();
  }
  captured(){
    const pieces={w:[],b:[]};for(const m of this.moves){if(m.captured)pieces[m.color].push(m.captured);}
    const weight={q:0,r:1,b:2,n:3,p:4};
    for(const s of ['w','b'])pieces[s].sort((a,b)=>weight[a]-weight[b]);
    return pieces;
  }
  status(){
    if(this.result)return this.result;
    if(this.game.isCheckmate())return {winner:this.game.turn()==='w'?'b':'w',kind:'checkmate'};
    if(this.game.isDraw())return {winner:null,kind:this.game.isStalemate()?'stalemate':this.game.isThreefoldRepetition()?'threefold':this.game.isInsufficientMaterial()?'insufficient':'draw'};
    if(this.clock.timeout)return {winner:this.clock.timeout==='w'?'b':'w',kind:'timeout'};
    return null;
  }
}
