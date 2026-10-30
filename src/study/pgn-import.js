import {Chess,DEFAULT_POSITION} from '../../vendor/chess.js';
import {StudyBook} from './studybook.js';

const PUNCTUATION={'!':1,'?':2,'!!':3,'??':4,'!?':5,'?!':6};
const RESULT=/^(?:1-0|0-1|1\/2-1\/2|\*)$/;
const MOVE_NUMBER=/^\d+\.(?:\.\.)?/;

/**
 * Parse a single PGN game, including nested Recursive Annotation Variations,
 * comments and numeric/standard punctuation NAGs.
 *
 * Variations are alternatives to the immediately preceding move. Always
 * validate their SAN moves from the BEFORE-move FEN and anchor children to
 * stable parent IDs. The caller replaces the live session only on success.
 */
export function parseAnnotatedPgn(text){
  if(typeof text!=='string'||!text.trim()||text.length>500000)
    throw Error('PGN 為空白或超出 500 KB 上限');
  const headers={};
  let body=text.replace(/^\s*\[([A-Za-z][A-Za-z0-9_]*)\s+"((?:\\.|[^"\\])*)"\s*\][ \t]*$/gm,(_,key,value)=>{
    headers[key]=value.replace(/\\(["\\])/g,'$1');return '';
  });
  if(/^\s*\[/.test(body))throw Error('PGN 標頭格式無效');
  const initial=headers.FEN||DEFAULT_POSITION;
  let game;
  try{game=new Chess(initial);}catch{throw Error('PGN FEN 初始局面無效');}
  const study=new StudyBook();
  const frames=[{game,moves:[],branch:null,lastBefore:null}];
  let tokenCount=0,variationCount=0,statedResult=null;
  const current=()=>frames.at(-1);
  const appendNote=(token)=>{
    const frame=current(),note=token.trim();
    if(!note)return;
    const notes=frame.branch?frame.branch.notes:study.notes;
    const key=String(frame.moves.length);
    const joined=(notes[key]?notes[key]+' ': '')+note;
    if(joined.length>500)throw Error('PGN 註解超過 500 字元');
    notes[key]=joined;
  };
  const appendNag=n=>{
    const frame=current(),nags=frame.branch?frame.branch.nags:study.nags;
    const key=String(frame.moves.length);
    if(frame.moves.length===0)throw Error('PGN NAG 必須跟在著法之後');
    if(!Number.isInteger(n)||n<0||n>255)throw Error('PGN NAG 不合法');
    const prev=nags[key]||[];
    if(prev.length>=12)throw Error('PGN 著法 NAG 數量過多');
    nags[key]=[...prev,n];
  };
  const consumeMove=token=>{
    const frame=current();
    const match=token.match(/(!!|\?\?|!\?|\?!|!|\?)$/);
    const notation=match?token.slice(0,-match[0].length):token;
    if(!notation)throw Error('PGN 缺少著法');
    if(frame.moves.length>=2000)throw Error('棋譜超出 2000 半回合上限');
    const before=frame.game.fen();let move;
    try{move=frame.game.move(notation,{strict:false});}
    catch{throw Error('PGN 含不合法著法：'+notation);}
    if(!move)throw Error('PGN 含不合法著法：'+notation);
    frame.lastBefore=before;frame.moves.push(move.san);
    if(frame.branch){
      if(frame.branch.moves.length>=160)throw Error('單一變例超過 160 半回合上限');
      frame.branch.moves.push(move.from+move.to+(move.promotion||''));
    }
    if(match)appendNag(PUNCTUATION[match[0]]);
  };
  for(let i=0;i<body.length;){
    if(++tokenCount>20000)throw Error('PGN 的符號數量過多');
    if(/\s/.test(body[i])){i++;continue;}
    if(body[i]==='{'){
      const end=body.indexOf('}',i+1);
      if(end<0)throw Error('PGN 註解大括號未關閉');
      appendNote(body.slice(i+1,end));i=end+1;continue;
    }
    if(body[i]===';'){
      const end=body.indexOf('\n',i+1);
      appendNote(body.slice(i+1,end<0?body.length:end));i=end<0?body.length:end;continue;
    }
    if(body[i]==='('){
      const parent=current();
      if(!parent.lastBefore)throw Error('PGN 變例必須緊接在其替代著法之後');
      if(frames.length>=25||++variationCount>300)throw Error('PGN 變例過深或過多');
      const origin=parent.branch?parent.branch.origin:parent.moves.length-1;
      const meta=parent.branch
        ?{parentId:parent.branch.id,parentPly:parent.moves.length-1}
        :{};
      const branch=study.addBranch(origin,parent.lastBefore,[],meta);
      branch.notes={};branch.nags={};
      frames.push({game:new Chess(parent.lastBefore),moves:[],branch,lastBefore:null});
      i++;continue;
    }
    if(body[i]===')'){
      if(frames.length===1)throw Error('PGN 變例括號不匹配');
      if(!current().moves.length)throw Error('PGN 變例不得為空');
      frames.pop();i++;continue;
    }
    let end=i;
    while(end<body.length&&!/[\s(){};]/.test(body[end]))end++;
    const raw=body.slice(i,end);
    i=end;
    if(!raw)throw Error('PGN 含不支援的語法');
    if(/^\$/.test(raw)){if(!/^\$\d+$/.test(raw))throw Error('無效 PGN NAG');appendNag(Number(raw.slice(1)));continue;}
    if(RESULT.test(raw)){
      if(frames.length===1)statedResult=raw;
      continue;
    }
    // Supports both "1. e4" and "1.e4", "1...e5" and black-first FEN.
    const sanitized=raw.replace(MOVE_NUMBER,'');
    if(!sanitized)continue;
    if(/^\d+\.+$/.test(sanitized))continue;
    if(RESULT.test(sanitized)){if(frames.length===1)statedResult=sanitized;continue;}
    consumeMove(sanitized);
  }
  if(frames.length!==1)throw Error('PGN 變例括號未關閉');
  const declared=headers.Result;
  if(declared&&(!RESULT.test(declared)||(statedResult&&declared!==statedResult)))
    throw Error('PGN 標頭與棋局結果不一致');
  const result=declared||statedResult||'*';
  headers.Result=result;
  return {headers,initialFen:initial,moves:frames[0].moves,study,result};
}
