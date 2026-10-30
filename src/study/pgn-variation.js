import {Chess} from '../../vendor/chess.js';

/** Export a nested study tree as PGN Recursive Annotation Variations (RAV).
 * JSON study backups remain the lossless editable format (including marks).
 */
export function exportAnnotatedPgn(session){
  const original=session.pgn();
  const gap=original.indexOf('\n\n');
  const headers=gap>=0?original.slice(0,gap):'';
  const result=session.status();
  const resultToken=result
    ?result.winner==='w'?'1-0':result.winner==='b'?'0-1':'1/2-1/2'
    :'*';
  const roots=new Map(),children=new Map();
  const grouped=(map,key,branch)=>{
    if(!map.has(key))map.set(key,[]);
    map.get(key).push(branch);
  };
  for(const b of session.study.branches){
    if(b.parentId==null)grouped(roots,b.origin,b);
    else grouped(children,String(b.parentId)+':'+b.parentPly,b);
  }
  const comment=value=>value
    ?'{'+value.replace(/[{}]/g,c=>c==='{'?'[':']').replace(/\s+/g,' ').trim()+'}'
    :'';
  const moveTokens=(game,move,first)=>{
    const num=Number(game.fen().split(' ')[5]),side=game.turn();
    const before=side==='w'?num+'.':first?num+'...':null;
    const played=game.move(move,{strict:true});
    return [before,played.san].filter(Boolean);
  };
  const renderBranch=(b,seen)=>{
    if(seen.has(b.id))throw Error('Cyclic study variation');
    const next=new Set(seen);next.add(b.id);
    const game=new Chess(b.fen),tokens=[];
    for(let i=0;i<=b.moves.length;i++){
      if(i<b.moves.length){
        const u=b.moves[i];
        tokens.push(...moveTokens(game,{from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]},i===0));
      }
      for(const child of children.get(String(b.id)+':'+i)||[])
        tokens.push(renderBranch(child,next));
    }
    return '('+tokens.join(' ')+')';
  };
  const game=new Chess(session.initialFen),tokens=[];
  const first=comment(session.study.notes['0']);
  if(first)tokens.push(first);
  for(let i=0;i<=session.moves.length;i++){
    if(i<session.moves.length){
      tokens.push(...moveTokens(game,session.moves[i].san,i===0));
      const note=comment(session.study.notes[String(i+1)]);
      if(note)tokens.push(note);
    }
    for(const b of roots.get(i)||[])tokens.push(renderBranch(b,new Set()));
  }
  tokens.push(resultToken);
  const lines=[];let line='';
  for(const token of tokens){
    if(line&&line.length+token.length+1>92){lines.push(line);line=token;}
    else line+=(line?' ':'')+token;
  }
  if(line)lines.push(line);
  return (headers+'\n\n'+lines.join('\n')).trim();
}
