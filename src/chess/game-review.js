import {Chess} from '../../vendor/chess.js';

const moveUci=m=>m.from+m.to+(m.promotion||'');

/**
 * Approximate centipawn loss using the same best-line Stockfish evaluation
 * immediately before and after each played move, always from the mover's
 * perspective. Not a Chess.com/Lichess accuracy score or proof of a blunder.
 */
export function evaluateForWhite(info,turn){
  if(!info)return null;
  const sign=turn==='w'?1:-1;
  if(Number.isFinite(info.cp))return Math.max(-2000,Math.min(2000,info.cp*sign));
  // Mate scores are qualitative. Do not convert them into fabricated CP loss.
  return null;
}
export function classifyMoveLoss(beforeWhite,afterWhite,mover){
  if(!Number.isFinite(beforeWhite)||!Number.isFinite(afterWhite))
    return {loss:null,label:'未判定'};
  const sign=mover==='w'?1:-1;
  const loss=Math.max(0,Math.round((beforeWhite-afterWhite)*sign));
  const label=loss>=300?'嚴重失誤':loss>=150?'失誤':loss>=50?'小失誤':'正常';
  return {loss,label};
}

/**
 * Scan all mainline positions with the real UCI engine. MultiPV is fixed to 1
 * to make every position comparable; the same bounded per-position search
 * budget is applied. Caller owns engine cancellation and UI state.
 *
 * No evaluation is invented when a position has no search score.
 */
export async function analyzeFullGame(session,engine,{
  movetime=450,onProgress=()=>{},isCancelled=()=>false,
}={}){
  if(!Number.isInteger(movetime)||movetime<150||movetime>5000)
    throw Error('Invalid game review search budget');
  const initialFen=session.initialFen;
  const moves=session.moves.map(m=>({san:m.san,color:m.color}));
  if(!moves.length)return [];
  const game=new Chess(initialFen),history=[],rows=[];
  let previous=null;
  const assess=async()=>{
    // A terminal chess position has no legal continuation. Stockfish may send
    // bestmove (none) without any CP score; mark it unscored, not as an error.
    if(game.isCheckmate()||game.isStalemate()||game.isInsufficientMaterial())return null;
    let latest=null;
    const best=await engine.search(game.fen(),{
      position:{initialFen,moves:[...history]},
      movetime,skill:20,multiPV:1,
      onInfo:info=>{
        if(info.multiPV===1&&(Number.isFinite(info.cp)||Number.isFinite(info.mate)))
          latest=info;
      },
    });
    if(!best&&!latest)throw Error('Stockfish 未傳回局面分析結果');
    return evaluateForWhite(latest,game.turn());
  };
  onProgress({done:0,total:moves.length,rows:[]});
  previous=await assess();
  for(let i=0;i<moves.length;i++){
    if(isCancelled())return rows;
    const san=moves[i].san,played=game.move(san,{strict:true});
    history.push(moveUci(played));
    const after=await assess();
    if(isCancelled())return rows;
    const classification=classifyMoveLoss(previous,after,played.color);
    rows.push({ply:i+1,san:played.san,color:played.color,
      ...classification,depthHint:movetime});
    previous=after;
    onProgress({done:i+1,total:moves.length,rows:[...rows]});
  }
  return rows;
}
