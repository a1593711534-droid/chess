import test from 'node:test';
import assert from 'node:assert/strict';
import {EngineClient} from '../src/chess/engine.js';
test('UCI engine info parser separates MultiPV 1, 2, 3 and reports bestmove',()=>{
 const engine=Object.create(EngineClient.prototype),infos=[];let best=null;
 engine.state='thinking';engine.onState=()=>{};
 engine.pending={info:x=>infos.push(x),cancelled:false,timer:setTimeout(()=>{},9000),resolve:x=>best=x};
 engine.receive('info depth 13 seldepth 19 multipv 1 score cp 32 nodes 78885 nps 340021 hashfull 23 time 232 pv e2e4 e7e5 g1f3');
 engine.receive('info depth 13 seldepth 19 multipv 2 score cp 19 nodes 78885 nps 340021 hashfull 23 time 232 pv g1f3 g8f6');
 engine.receive('info depth 13 seldepth 16 multipv 3 score mate -2 nodes 78885 pv d2d4 d7d5');
 assert.deepEqual(infos.map(x=>x.multiPV),[1,2,3]);
 assert.deepEqual(infos[0],{cp:32,mate:null,depth:13,multiPV:1,pv:['e2e4','e7e5','g1f3']});
 assert.equal(infos[2].mate,-2);
 engine.receive('bestmove e2e4 ponder e7e5');assert.equal(best,'e2e4');assert.equal(engine.pending,null);assert.equal(engine.state,'ready');
});
