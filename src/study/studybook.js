import {Chess} from '../../vendor/chess.js';
export class StudyBook{
  constructor(source,{strict=false}={}){this.notes={};this.marks={};this.branches=[];if(source)this.load(source,{strict});}
  load(raw,{strict=false}={}){
    if(!raw||typeof raw!=='object'){
      if(strict)throw Error('研究備份缺少研究資料');
      return;
    }
    if(strict){
      if(!raw.notes||typeof raw.notes!=='object'||Array.isArray(raw.notes)||!raw.marks||typeof raw.marks!=='object'||Array.isArray(raw.marks)||!Array.isArray(raw.branches))throw Error('研究備份資料結構不完整');
      if(Object.entries(raw.notes).some(([k,v])=>!/^[0-9]{1,4}$/.test(k)||typeof v!=='string'||v.length>500))throw Error('研究備份包含無效或過長的註解');
      if(Object.entries(raw.marks).some(([k,v])=>!/^[0-9]{1,4}$/.test(k)||!Array.isArray(v)||v.length>24||v.some(mark=>!/^[a-h][1-8]$/.test(mark?.from)||!/^[a-h][1-8]$/.test(mark?.to))))throw Error('研究備份包含無效的棋盤標記');
    }
    this.notes=Object.fromEntries(Object.entries(raw.notes||{}).filter(([k,v])=>/^\d{1,4}$/.test(k)&&typeof v==='string').map(([k,v])=>[k,v.slice(0,500)]));
    this.marks=Object.fromEntries(Object.entries(raw.marks||{}).filter(([k,a])=>/^\d{1,4}$/.test(k)&&Array.isArray(a)).map(([k,a])=>[k,a.filter(m=>/^[a-h][1-8]$/.test(m?.from)&&/^[a-h][1-8]$/.test(m?.to)).slice(0,24)]));
    this.branches=[];for(const [index,item] of (Array.isArray(raw.branches)?raw.branches:[]).entries()){
      try{this.addBranch(item.origin,item.fen,item.moves);}
      catch(error){if(strict)throw Error(`研究備份第 ${index+1} 個變例無效：${error.message}`);}
    }
  }
  setNote(ply,text){const key=String(ply);if(typeof text!=='string')return;if(text.trim())this.notes[key]=text.trim().slice(0,500);else delete this.notes[key];}
  toggleMark(ply,from,to){const key=String(ply),list=this.marks[key]||[];const found=list.findIndex(m=>m.from===from&&m.to===to);if(found>=0)list.splice(found,1);else list.push({from,to});this.marks[key]=list.slice(-24);}
  validateBranch(origin,fen,moves){
    if(!Number.isInteger(origin)||origin<0||origin>2000||typeof fen!=='string'||!Array.isArray(moves)||moves.length>160)throw Error('Invalid variation');
    const g=new Chess(fen),normalized=[];
    for(const u of moves){
      if(typeof u!=='string'||!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(u))throw Error('Invalid variation move');
      const m=g.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]},{strict:true});
      normalized.push(`${m.from}${m.to}${m.promotion||''}`);
    }
    return {origin,fen,moves:normalized};
  }
  addBranch(origin,fen,moves){
    const branch=this.validateBranch(origin,fen,moves);
    this.branches.push(branch);
    return branch;
  }
  /** Retry a failed persistence without appending a second copy of the same edit. */
  upsertBranch(origin,fen,moves,existing=null){
    const candidate=this.validateBranch(origin,fen,moves);
    if(existing&&this.branches.includes(existing)){
      Object.assign(existing,candidate);
      return existing;
    }
    this.branches.push(candidate);
    return candidate;
  }
  hasResearchAfter(ply){
    return Object.keys(this.notes).some(k=>Number(k)>ply)
      ||Object.keys(this.marks).some(k=>Number(k)>ply)
      ||this.branches.some(branch=>branch.origin>ply);
  }
  /** Called only when a user confirms removing main-line moves. */
  pruneAfter(ply){
    for(const data of [this.notes,this.marks]){
      for(const key of Object.keys(data))if(Number(key)>ply)delete data[key];
    }
    this.branches=this.branches.filter(branch=>branch.origin<=ply);
  }
  branchPgn(branch){const g=new Chess(branch.fen);g.header('Event','Chess Atelier PRO Study Variation','SetUp','1','FEN',branch.fen);for(const u of branch.moves)g.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]});return g.pgn({maxWidth:72});}
  serialize(){return {notes:this.notes,marks:this.marks,branches:this.branches};}
}
