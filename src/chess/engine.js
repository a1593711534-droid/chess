/** Stockfish UCI adapter. Queues requests and discards cancelled searches safely. */
/** Convert a GUI search budget to a valid UCI go command. */
export function buildGoCommand({movetime=900,clock=null,depth=0}={}){
  if(depth>0)return `go depth ${Math.min(35,Math.max(1,Math.trunc(depth)))}`;
  if(clock&&['wtime','btime','winc','binc'].every(k=>Number.isFinite(clock[k])&&clock[k]>=0)){
    const n=k=>Math.max(k.endsWith('time')?1:0,Math.trunc(clock[k]));
    return `go wtime ${n('wtime')} btime ${n('btime')} winc ${n('winc')} binc ${n('binc')}`;
  }
  return `go movetime ${Math.max(100,Math.trunc(movetime))}`;
}
export class EngineClient{
  constructor(onState=()=>{}){
    this.onState=onState;this.worker=null;this.state='loading';this.pending=null;this.token=0;
    this.newGamePending=true;this.optionsInitialized=false;this.readyWaiter=null;this.setupPromise=null;
    this.readyPromise=new Promise((resolve,reject)=>{this.resolveReady=resolve;this.rejectReady=reject;});
    this.readyPromise.catch(()=>{}); // avoid an unhandled rejection if nobody requests the engine
    this.readyTimeout=setTimeout(()=>this.fail(new Error('引擎載入逾時，請確認 WASM 檔案完整。')),90000);
    try{
      this.worker=new Worker(new URL('../../vendor/stockfish-19-single.js',import.meta.url));
      this.worker.onmessage=e=>this.receive(String(e.data));
      this.worker.onerror=e=>{this.fail(new Error(e.message||'引擎工作執行緒無法啟動。'));};
      this.worker.onmessageerror=()=>this.fail(new Error('引擎訊息處理失敗。'));
      this.post('uci');this.onState('loading');
    }catch(e){this.fail(e);}
  }
  post(command){this.worker?.postMessage(command);}
  receive(msg){
    if(msg==='uciok'){this.post('isready');return;}
    if(msg==='readyok'){
      if(this.state==='loading'){
        clearTimeout(this.readyTimeout);this.state='ready';this.resolveReady();this.onState('ready');
      }else if(this.readyWaiter){const done=this.readyWaiter;this.readyWaiter=null;this.setupPromise=null;done();}
      return;
    }
    if(msg.startsWith('info ')&&this.pending){
      const cp=msg.match(/\bscore cp (-?\d+)/),mate=msg.match(/\bscore mate (-?\d+)/),depth=msg.match(/\bdepth (\d+)/),multi=msg.match(/\bmultipv (\d+)/),pv=msg.match(/\bpv ([a-h][1-8][a-h][1-8][qrbn]?(?:\s+[a-h][1-8][a-h][1-8][qrbn]?){0,20})/);
      if((cp||mate||pv)&&this.pending.info){this.pending.info({cp:cp?Number(cp[1]):null,mate:mate?Number(mate[1]):null,depth:depth?Number(depth[1]):0,multiPV:multi?Number(multi[1]):1,pv:pv?pv[1].split(/\s+/):[]});}
    }
    if(msg.startsWith('bestmove ')&&this.pending){
      const move=msg.split(/\s+/)[1];const task=this.pending;this.pending=null;clearTimeout(task.timer);clearTimeout(task.cancelTimer);
      this.state='ready';this.onState('ready');task.resolve(task.cancelled?null:(move&&move!=='(none)'?move:null));
    }
  }
  fail(error){
    if(this.state==='error')return;
    clearTimeout(this.readyTimeout);this.state='error';this.onState('error',error);
    if(this.readyWaiter){const done=this.readyWaiter;this.readyWaiter=null;this.setupPromise=null;done();}
    this.rejectReady?.(error);if(this.pending){clearTimeout(this.pending.timer);clearTimeout(this.pending.cancelTimer);this.pending.resolve(null);this.pending=null;}
    this.worker?.terminate();this.worker=null;
  }
  /** Reset game-specific engine state before the next search, not mid-search. */
  newGame(){this.newGamePending=true;}
  cancel(){
    this.token++;if(this.pending&&!this.pending.cancelled){
      this.pending.cancelled=true;this.post('stop');
      // Workers occasionally ignore UCI stop. Recover instead of blocking new searches.
      this.pending.cancelTimer=setTimeout(()=>this.fail(new Error('引擎停止搜尋逾時，請重試。')),3500);
    }
  }
  async search(fen,{movetime=900,clock=null,skill=20,multiPV=1,depth=0,getSearchOptions=null,onInfo=()=>{}}={}){
    const request=++this.token;
    await this.readyPromise;
    if(request!==this.token)return null;
    if(this.pending){this.pending.cancelled=true;this.post('stop');await this.pending.finished;}
    if(request!==this.token||this.state==='error')return null;
    // Hash resize clears the transposition table. Configure it once per Worker,
    // never before every move; the single-threaded build already uses Threads=1.
    if(!this.optionsInitialized){
      this.post('setoption name Hash value 64');this.optionsInitialized=true;
    }
    while(this.newGamePending||this.setupPromise){
      if(!this.setupPromise){
        this.newGamePending=false;
        // Install the waiter before posting isready to avoid missing the reply.
        this.setupPromise=new Promise(resolve=>{this.readyWaiter=resolve;});
        this.post('ucinewgame');this.post('isready');
      }
      const setup=this.setupPromise;
      await setup;
      if(request!==this.token||this.state==='error')return null;
    }
    this.post(`setoption name Skill Level value ${skill}`);
    this.post(`setoption name MultiPV value ${Math.max(1,Math.min(3,Math.trunc(multiPV)))}`);
    this.post(`position fen ${fen}`);
    // In timed games, refresh the clock only once the Worker is ready and idle.
    const options=getSearchOptions?getSearchOptions():{movetime,clock};
    if(!options)return null;
    const searchMovetime=options.movetime??movetime,searchClock=options.clock??clock;
    this.state='thinking';this.onState('thinking');
    let resolveFinished;
    const finished=new Promise(r=>{resolveFinished=r;});
    return new Promise(resolve=>{
      const done=move=>{resolve(move);resolveFinished();};
      // Clock-driven searches may last longer than fixed move budgets.
      const side=fen.split(' ')[1]==='b'?'b':'w';
      const clockBudget=searchClock?.[side==='w'?'wtime':'btime'];
      const watchdog=searchClock&&Number.isFinite(clockBudget)?Math.max(20000,Math.min(1800000,clockBudget+15000)):Math.max(12000,searchMovetime+12000);
      const timer=setTimeout(()=>this.fail(new Error('引擎計算超時，已停止工作。')),watchdog);
      this.pending={resolve:done,cancelled:false,info:onInfo,timer,finished};
      this.post(buildGoCommand({movetime:searchMovetime,clock:searchClock,depth}));
    });
  }
}
