import {Chess} from '../../vendor/chess.js';
export class StudyBook{
  constructor(source){this.notes={};this.marks={};this.branches=[];if(source)this.load(source);}
  load(raw){
    if(!raw||typeof raw!=='object')return;
    this.notes=Object.fromEntries(Object.entries(raw.notes||{}).filter(([k,v])=>/^\d{1,4}$/.test(k)&&typeof v==='string').map(([k,v])=>[k,v.slice(0,500)]));
    this.marks=Object.fromEntries(Object.entries(raw.marks||{}).filter(([k,a])=>/^\d{1,4}$/.test(k)&&Array.isArray(a)).map(([k,a])=>[k,a.filter(m=>/^[a-h][1-8]$/.test(m?.from)&&/^[a-h][1-8]$/.test(m?.to)).slice(0,24)]));
    this.branches=[];for(const item of (Array.isArray(raw.branches)?raw.branches:[])){
      try{this.addBranch(item.origin,item.fen,item.moves);}catch{/* ignore damaged saved variation */}
    }
  }
  setNote(ply,text){const key=String(ply);if(typeof text!=='string')return;if(text.trim())this.notes[key]=text.trim().slice(0,500);else delete this.notes[key];}
  toggleMark(ply,from,to){const key=String(ply),list=this.marks[key]||[];const found=list.findIndex(m=>m.from===from&&m.to===to);if(found>=0)list.splice(found,1);else list.push({from,to});this.marks[key]=list.slice(-24);}
  addBranch(origin,fen,moves){if(!Number.isInteger(origin)||origin<0||origin>2000||typeof fen!=='string'||!Array.isArray(moves)||moves.length>160)throw Error('Invalid variation');const g=new Chess(fen);const normalized=[];for(const u of moves){if(!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(u))throw Error('Invalid variation move');const m=g.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]},{strict:true});normalized.push(`${m.from}${m.to}${m.promotion||''}`);}const branch={origin,fen,moves:normalized};this.branches.push(branch);return branch;}
  branchPgn(branch){const g=new Chess(branch.fen);g.header('Event','Chess Atelier PRO Study Variation','SetUp','1','FEN',branch.fen);for(const u of branch.moves)g.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]});return g.pgn({maxWidth:72});}
  serialize(){return {notes:this.notes,marks:this.marks,branches:this.branches};}
}
