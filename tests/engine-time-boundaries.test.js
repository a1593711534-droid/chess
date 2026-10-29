import test from 'node:test';
import assert from 'node:assert/strict';
import {EngineClient} from '../src/chess/engine.js';

// A deterministic UCI worker verifies command ordering and the budget sampled
// immediately before go, without requiring the large WASM file in unit tests.
class MockWorker {
  static onReady=()=>{};
  constructor(){this.commands=[];}
  postMessage(command){
    this.commands.push(command);
    if(command==='uci')queueMicrotask(()=>this.onmessage({data:'uciok'}));
    else if(command==='isready')queueMicrotask(()=>{
      MockWorker.onReady();
      this.onmessage({data:'readyok'});
    });
    else if(command.startsWith('go '))queueMicrotask(()=>this.onmessage({data:'bestmove e7e5'}));
  }
  terminate(){}
}

test('engine preserves Hash between moves, resets each game and samples live move time',async()=>{
  const originalWorker=globalThis.Worker;
  globalThis.Worker=MockWorker;
  let engine;
  try{
    engine=new EngineClient();
    const fen='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1';
    let readyCount=0,remaining=600000;
    MockWorker.onReady=()=>{
      // The first ACK is the initial UCI handshake; the next completes
      // the asynchronous new-game reset, which must precede clock sampling.
      if(++readyCount===2)remaining=550000;
    };
    const readTime=()=>({clock:{wtime:600000,btime:remaining,winc:5000,binc:5000}});
    assert.equal(await engine.search(fen,{getSearchOptions:readTime}),'e7e5');
    const commands=engine.worker.commands;
    assert.ok(commands.indexOf('ucinewgame')<commands.findIndex(c=>c.startsWith('go ')));
    assert.equal(commands.filter(c=>c==='setoption name Hash value 64').length,1);
    assert.ok(commands.includes('go wtime 600000 btime 550000 winc 5000 binc 5000'));

    assert.equal(await engine.search(fen,{getSearchOptions:readTime}),'e7e5');
    assert.equal(commands.filter(c=>c==='setoption name Hash value 64').length,1);
    assert.equal(commands.filter(c=>c==='ucinewgame').length,1);

    engine.newGame();
    assert.equal(await engine.search(fen,{movetime:1500}),'e7e5');
    assert.equal(commands.filter(c=>c==='ucinewgame').length,2);
    assert.ok(commands.includes('go movetime 1500'));
    assert.equal(commands.filter(c=>c==='setoption name Hash value 64').length,1);

    const goCount=commands.filter(c=>c.startsWith('go ')).length;
    assert.equal(await engine.search(fen,{getSearchOptions:()=>null}),null);
    assert.equal(commands.filter(c=>c.startsWith('go ')).length,goCount,
      'flagged clock must not start a new search');
  }finally{
    clearTimeout(engine?.readyTimeout);
    engine?.worker?.terminate();
    MockWorker.onReady=()=>{};
    globalThis.Worker=originalWorker;
  }
});
