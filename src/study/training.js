import {Chess} from '../../vendor/chess.js';
export class TrainingSession{
  constructor(exercise){this.exercise=exercise;this.restart();}
  restart(){this.game=new Chess(this.exercise.fen);this.index=0;this.errors=0;this.solved=false;this.pendingReply=false;}
  get expected(){return this.exercise.line[this.index]||null;}
  get progress(){return `${Math.ceil(this.index/2)} / ${Math.ceil(this.exercise.line.length/2)}`;}
  play(input){
    if(this.solved||this.pendingReply)return {ok:false,reason:'busy'};
    const uci=typeof input==='string'?input:`${input.from}${input.to}${input.promotion||''}`;
    if(uci!==this.expected){this.errors++;return {ok:false,reason:'incorrect'};}
    const move=this.game.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]},{strict:true});
    this.index++;this.solved=this.index===this.exercise.line.length;
    this.pendingReply=!this.solved;
    return {ok:true,move,done:this.solved,hasReply:!this.solved};
  }
  reply(){
    if(!this.pendingReply||this.solved)return null;
    const uci=this.expected,move=this.game.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]},{strict:true});
    this.index++;this.solved=this.index===this.exercise.line.length;this.pendingReply=false;
    return move;
  }
}
