import {Chess} from '../../vendor/chess.js';

/** Maintain one replay-independent index for the current main line.
 * chess.js history({verbose:true}) otherwise reconstructs the game by undo/replay.
 * The index is rebuilt if a caller replaces or directly edits the Chess instance.
 */
export class GameHistoryIndex{
  constructor(game,initialFen){this.attach(game,initialFen);}
  attach(game,initialFen){
    this.game=game;this.initialFen=initialFen;
    this.moves=[];this.keys=[];this.counts=new Map();this.revision=0;
    this.rebuild();
  }
  static key(fen){return fen.split(' ').slice(0,4).join(' ');}
  rebuild(){
    this.moves=this.game.history({verbose:true});
    this.keys=[];this.counts=new Map();
    const replay=new Chess(this.initialFen);
    const include=()=>{const key=GameHistoryIndex.key(replay.fen());this.keys.push(key);this.counts.set(key,(this.counts.get(key)||0)+1);};
    include();
    for(const move of this.moves){replay.move(move.san);include();}
    this.lastFen=this.game.fen();this.revision++;
  }
  sync(game,initialFen){
    if(this.game!==game||this.initialFen!==initialFen){this.attach(game,initialFen);return;}
    if(this.lastFen!==game.fen())this.rebuild();
  }
  recordMove(move){
    this.moves.push(move);
    const key=GameHistoryIndex.key(this.game.fen());
    this.keys.push(key);this.counts.set(key,(this.counts.get(key)||0)+1);
    this.lastFen=this.game.fen();this.revision++;
  }
  recordUndo(){
    if(!this.moves.length){this.rebuild();return;}
    this.moves.pop();
    const key=this.keys.pop(),count=this.counts.get(key)||0;
    if(count<=1)this.counts.delete(key);else this.counts.set(key,count-1);
    this.lastFen=this.game.fen();this.revision++;
  }
  repetitions(){return this.counts.get(this.keys.at(-1))||0;}
}
