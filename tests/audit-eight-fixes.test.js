import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Chess,DEFAULT_POSITION} from '../vendor/chess.js';
import {ChessSession} from '../src/chess/session.js';
import {EngineClient,buildPositionCommand} from '../src/chess/engine.js';

const prefs={mode:'local',side:'w',level:'skill-10',time:'3+0'};
const session=()=>new ChessSession(prefs);
const copy=data=>structuredClone(data);

test('strict restore rejects malformed or mismatched per-ply clock records',()=>{
  const s=session();s.clock.resume('w');assert.ok(s.play('e4'));assert.ok(s.play('e5'));
  const data=s.serialize();
  assert.equal(data.clockSnapshots.length,2);
  for(const damaged of [
    {...data,clockSnapshots:[{remaining:{w:100,b:100},active:'b'},...data.clockSnapshots.slice(1)]},
    {...data,clockSnapshots:[{remaining:{w:-5,b:100},active:'w'},...data.clockSnapshots.slice(1)]},
    {...data,clockSnapshots:[{remaining:{w:100,b:100},active:'z'},...data.clockSnapshots.slice(1)]},
    {...data,clockSnapshots:[data.clockSnapshots[0]]},
    {...data,clockSnapshots:[{...data.clockSnapshots[0],timeout:'w'},data.clockSnapshots[1]]}
  ]) assert.throws(()=>session().restore(damaged,{strictStudy:true}),/Invalid saved clock history/);
  assert.doesNotThrow(()=>session().restore(data,{strictStudy:true}));
});

test('strict restore checks the final clock turn and result against the game',()=>{
  const s=session();s.clock.resume('w');assert.ok(s.play('e4'));
  const data=s.serialize();
  const wrongClock=copy(data);wrongClock.clock.active='w';
  assert.throws(()=>session().restore(wrongClock,{strictStudy:true}),/Invalid saved clock turn/);
  const impossible=copy(data);impossible.result={winner:null,kind:'stalemate'};
  assert.throws(()=>session().restore(impossible,{strictStudy:true}),/Invalid saved result/);
  const unknown=copy(data);unknown.result={winner:'z',kind:'resign'};
  assert.throws(()=>session().restore(unknown,{strictStudy:true}),/Invalid saved result/);
  const falseResign=copy(data);falseResign.result={winner:'b',kind:'resign'};
  assert.throws(()=>session().restore(falseResign,{strictStudy:true}),/Invalid saved resignation/);
  const proper=copy(data);proper.result={winner:'w',kind:'resign'};
  assert.doesNotThrow(()=>session().restore(proper,{strictStudy:true}));
});

test('variation draft survives strict restore without silently creating duplicate branches',()=>{
  const s=session();
  const data=s.serialize();
  data.variationDraft={origin:0,fen:DEFAULT_POSITION,moves:['e2e4'],persistedBranchIndex:-1};
  const restored=session();restored.restore(data,{strictStudy:true});
  assert.deepEqual(restored.variationDraft,data.variationDraft);
  assert.equal(restored.study.branches.length,0);
  const corrupted=copy(data);
  corrupted.variationDraft.fen=new Chess().move('e4').after;
  assert.throws(()=>session().restore(corrupted,{strictStudy:true}),/草稿起點與主線不一致/);
  corrupted.variationDraft={...data.variationDraft,persistedBranchIndex:42};
  assert.throws(()=>session().restore(corrupted,{strictStudy:true}),/Invalid variation draft/);
});

test('engine position commands preserve moves from the initial position',()=>{
  assert.equal(buildPositionCommand(DEFAULT_POSITION),`position fen ${DEFAULT_POSITION}`);
  assert.equal(buildPositionCommand(DEFAULT_POSITION,{initialFen:DEFAULT_POSITION,moves:[]}), 'position startpos');
  assert.equal(buildPositionCommand(DEFAULT_POSITION,{initialFen:DEFAULT_POSITION,
    moves:['g1f3','g8f6','f3g1','f6g8','g1f3','g8f6','f3g1','f6g8']}),
    'position startpos moves g1f3 g8f6 f3g1 f6g8 g1f3 g8f6 f3g1 f6g8');
  const custom='8/8/8/8/8/8/4k3/K7 w - - 0 1';
  assert.equal(buildPositionCommand(custom,{initialFen:custom,moves:[]}),`position fen ${custom}`);
  assert.throws(()=>buildPositionCommand(DEFAULT_POSITION,{initialFen:DEFAULT_POSITION,moves:['bad\\nuci']}),/Invalid engine position/);
});

class StalledWorker{
  static instances=[];
  constructor(){this.commands=[];this.terminated=false;this.readyCount=0;StalledWorker.instances.push(this);}
  postMessage(command){
    this.commands.push(command);
    if(command==='uci')queueMicrotask(()=>this.onmessage?.({data:'uciok'}));
    if(command==='isready'&&++this.readyCount===1)
      queueMicrotask(()=>this.onmessage?.({data:'readyok'}));
  }
  terminate(){this.terminated=true;}
}
async function waitForSetup(engine){
  for(let i=0;i<30;i++){
    if(engine.setupPromise)return;
    await new Promise(resolve=>setTimeout(resolve,1));
  }
  throw Error('Setup did not start');
}
test('a cancelled second isready releases the pending search and invalidates its worker',async()=>{
  const prior=globalThis.Worker;globalThis.Worker=StalledWorker;
  let engine;
  try{
    engine=new EngineClient();
    const search=engine.search(DEFAULT_POSITION);
    await waitForSetup(engine);
    engine.cancel();
    const result=await Promise.race([search,new Promise((_,reject)=>setTimeout(()=>reject(Error('cancel hang')),250))]);
    assert.equal(result,null);
    assert.equal(engine.state,'error');
    assert.equal(engine.setupPromise,null);
    assert.ok(StalledWorker.instances.at(-1).terminated);
  }finally{
    clearTimeout(engine?.readyTimeout);clearTimeout(engine?.setupTimer);
    engine?.worker?.terminate();globalThis.Worker=prior;
  }
});

test('a timed-out second isready releases the search before the search watchdog exists',async()=>{
  const priorWorker=globalThis.Worker,priorSetTimeout=globalThis.setTimeout;
  globalThis.Worker=StalledWorker;
  globalThis.setTimeout=(callback,delay,...args)=>priorSetTimeout(callback,delay===12000?15:delay,...args);
  let engine;
  try{
    engine=new EngineClient();
    const result=await Promise.race([engine.search(DEFAULT_POSITION),
      new Promise((_,reject)=>priorSetTimeout(()=>reject(Error('setup watchdog hang')),250))]);
    assert.equal(result,null);
    assert.equal(engine.state,'error');
    assert.equal(engine.pending,null);
  }finally{
    clearTimeout(engine?.readyTimeout);clearTimeout(engine?.setupTimer);
    engine?.worker?.terminate();
    globalThis.setTimeout=priorSetTimeout;globalThis.Worker=priorWorker;
  }
});

test('UI includes draft snapshots, restore-and-resume paths and cached board last move',()=>{
  const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  const board=readFileSync(new URL('../src/ui/board.js',import.meta.url),'utf8');
  assert.match(main,/data\\.variationDraft=/);
  assert.match(main,/restoreVariationDraft\\(manual\\.game\\)/);
  assert.match(main,/restoreVariationDraft\\(saved\\)/);
  assert.match(main,/restoreVariationDraft\\(dataForImport\\)/);
  assert.match(main,/if\\(variation&&!parkVariation\\(\\)\\)return/);
  assert.match(main,/if\\(engineLoadingClockSide&&!training&&!variation/);
  assert.match(main,/session\\.clock\\.tick\\(\\);\\s*if\\(session\\.done\\)/);
  assert.match(main,/if\\(menuVisible\\(\\)\\)closeMainMenu\\(\\);\\s*resumeBotIfNeeded\\(\\)/);
  assert.match(main,/board\\.update\\(current,\\{[^}]*lastMove/);
  assert.doesNotMatch(board,/view\\.history\\(\\{verbose:true\\}\\)/);
});
