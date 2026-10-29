/** Lightweight emergency opponent if WebAssembly is unavailable. Stockfish is preferred. */
import {Chess} from '../../vendor/chess.js';
const VALUE={p:100,n:310,b:330,r:500,q:900,k:0};
function evaluate(game,color){
  if(game.isCheckmate())return game.turn()===color?-99999:99999;
  if(game.isDraw())return 0;
  let score=0;
  for(const rank of game.board())for(const piece of rank){if(!piece)continue;
    const center=3.5-Math.abs('abcdefgh'.indexOf(piece.square[0])-3.5);
    const advance=piece.color==='w'?Number(piece.square[1])-1:8-Number(piece.square[1]);
    const val=VALUE[piece.type]+(piece.type==='p'?advance*4:Math.max(0,center)*3);
    score+=(piece.color===color?1:-1)*val;
  }return score;
}
export function fallbackMove(fen,level='club'){
  const game=new Chess(fen),color=game.turn(),all=game.moves({verbose:true});
  if(!all.length)return null;
  let best=null,bestScore=-Infinity;const moves=all.sort(()=>Math.random()-.5);
  const deep=level==='expert'||level==='master';
  for(const move of moves){
    game.move(move);let score=evaluate(game,color);
    if(deep&&!game.isGameOver()){
      let worst=Infinity;
      for(const reply of game.moves({verbose:true})){
        game.move(reply);worst=Math.min(worst,evaluate(game,color));game.undo();
      }
      score=.2*score+.8*worst;
    }
    game.undo();score+=Math.random()*(level==='beginner'?180:level==='casual'?85:18);
    if(score>bestScore){bestScore=score;best=move;}
  }
  return best?`${best.from}${best.to}${best.promotion||''}`:null;
}
