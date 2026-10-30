import {Chess} from '../../vendor/chess.js';
export class StudyBook{
  constructor(source,{strict=false}={}){this.notes={};this.marks={};this.branches=[];this.nextBranchId=1;if(source)this.load(source,{strict});}
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
    this.branches=[];this.nextBranchId=1;for(const [index,item] of (Array.isArray(raw.branches)?raw.branches:[]).entries()){
      try{this.addBranch(item.origin,item.fen,item.moves,{id:item.id,parentId:item.parentId,parentPly:item.parentPly});}
      catch(error){if(strict)throw Error(`研究備份第 ${index+1} 個變例無效：${error.message}`);}
    }
  }
  setNote(ply,text){const key=String(ply);if(typeof text!=='string')return;if(text.trim())this.notes[key]=text.trim().slice(0,500);else delete this.notes[key];}
  toggleMark(ply,from,to){const key=String(ply),list=this.marks[key]||[];const found=list.findIndex(m=>m.from===from&&m.to===to);if(found>=0)list.splice(found,1);else list.push({from,to});this.marks[key]=list.slice(-24);}
  validateBranch(origin,fen,moves,meta={}){
    const parentId=meta.parentId??null,parentPly=meta.parentPly??null;
    if(parentId!==null){
      if(!Number.isSafeInteger(parentId)||parentId<1||!Number.isInteger(parentPly)||parentPly<0)
        throw Error('Invalid variation parent');
      const parent=this.branches.find(b=>b.id===parentId);
      if(!parent||parentPly>parent.moves.length||origin!==parent.origin)
        throw Error('Invalid variation parent');
      const at=new Chess(parent.fen);
      for(const u of parent.moves.slice(0,parentPly))
        at.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]});
      if(at.fen()!==fen)throw Error('Variation parent position does not match');
    }else if(parentPly!==null)throw Error('Invalid variation parent offset');
    if(!Number.isInteger(origin)||origin<0||origin>2000||typeof fen!=='string'||!Array.isArray(moves)||moves.length>160)throw Error('Invalid variation');
    const g=new Chess(fen),normalized=[];
    for(const u of moves){
      if(typeof u!=='string'||!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(u))throw Error('Invalid variation move');
      const m=g.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]},{strict:true});
      normalized.push(`${m.from}${m.to}${m.promotion||''}`);
    }
    return {origin,fen,moves:normalized,parentId,parentPly};
  }
  addBranch(origin,fen,moves,meta={}){
    const candidate=this.validateBranch(origin,fen,moves,meta);
    const id=meta.id??this.nextBranchId;
    if(!Number.isSafeInteger(id)||id<1||this.branches.some(b=>b.id===id))
      throw Error('Invalid or duplicate variation ID');
    const branch={...candidate,id};
    this.branches.push(branch);this.nextBranchId=Math.max(this.nextBranchId,id+1);
    return branch;
  }
  /** Retry a failed persistence without appending a second copy of the same edit. */
  upsertBranch(origin,fen,moves,existing=null,meta={}){
    if(existing&&this.branches.includes(existing)){
      const candidate=this.validateBranch(origin,fen,moves,{
        parentId:existing.parentId,parentPly:existing.parentPly});
      if(this.branches.some(child=>child.parentId===existing.id&&child.parentPly>candidate.moves.length))
        throw Error('變例已有依附在後續著法上的子分支，無法直接刪除其起點');
      Object.assign(existing,candidate);
      return existing;
    }
    return this.addBranch(origin,fen,moves,meta);
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
    const kept=this.branches.filter(branch=>branch.origin<=ply);
    const ids=new Set(kept.map(b=>b.id));
    this.branches=kept.filter(b=>b.parentId===null||ids.has(b.parentId));
  }
  branchPgn(branch){const g=new Chess(branch.fen);g.header('Event','Chess Atelier PRO Study Variation','SetUp','1','FEN',branch.fen);for(const u of branch.moves)g.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]});return g.pgn({maxWidth:72});}
  serialize(){return {notes:this.notes,marks:this.marks,branches:this.branches};}
}
