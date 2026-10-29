import test from 'node:test';
import assert from 'node:assert/strict';
import {StudyBook} from '../src/study/studybook.js';
import {ChessSession} from '../src/chess/session.js';
import {EngineClient} from '../src/chess/engine.js';
import {inspectSavedGame,inspectManualGame} from '../src/utils/preferences.js';
import {readFileSync} from 'node:fs';

const prefs={mode:'local',side:'w',time:'none',level:'skill-10'};
test('missing, corrupt, inaccessible and valid storage are distinguished',()=>{
  const old=globalThis.localStorage;
  const values=new Map();
  try{
    globalThis.localStorage={getItem:key=>values.has(key)?values.get(key):null};
    assert.deepEqual(inspectSavedGame(),{value:null,corrupted:false});
    values.set('chess-atelier-game-v1','{bad');
    assert.deepEqual(inspectSavedGame(),{value:null,corrupted:true});
    values.set('chess-atelier-game-v1','null');
    assert.deepEqual(inspectSavedGame(),{value:null,corrupted:true});
    values.set('chess-atelier-game-v1','{"version":1}');
    assert.deepEqual(inspectSavedGame(),{value:{version:1},corrupted:false});
    values.set('chess-atelier-manual-save-v1','{broken');
    assert.equal(inspectManualGame().corrupted,true);
    globalThis.localStorage={getItem(){throw new Error('permission denied')}};
    assert.equal(inspectSavedGame().corrupted,true);
  }finally{
    if(old===undefined)delete globalThis.localStorage;
    else globalThis.localStorage=old;
  }
});
test('strict study backup rejects an invalid branch instead of dropping it',()=>{
  const session=new ChessSession(prefs);session.play('e4');
  const raw=session.serialize();
  raw.study.branches=[{origin:1,fen:'broken FEN',moves:['e7e5']}];
  const relaxed=new ChessSession(prefs);relaxed.restore(raw);
  assert.equal(relaxed.study.branches.length,0);
  const validated=new ChessSession(prefs);
  assert.throws(()=>validated.restore(raw,{strictStudy:true}),/第 1 個變例無效/);
});
test('strict backup rejects invalid marks and unrepresentable notes',()=>{
  const game=new ChessSession(prefs);const record=game.serialize();
  record.study.marks={'0':[{from:'bad',to:'e4'}]};
  assert.throws(()=>new StudyBook(record.study,{strict:true}),/標記/);
  record.study.marks={};record.study.notes={'0':'x'.repeat(501)};
  assert.throws(()=>new StudyBook(record.study,{strict:true}),/註解/);
});
test('cancelled Stockfish bestmove is not incorrectly delivered to a new search',()=>{
  const engine=Object.create(EngineClient.prototype),posted=[];let reply='unset';
  engine.pending={info:()=>{},cancelled:false,timer:setTimeout(()=>{},5000),resolve:move=>reply=move};
  engine.token=0;engine.state='thinking';engine.onState=()=>{};engine.post=cmd=>posted.push(cmd);
  engine.cancel();
  assert.equal(engine.pending.cancelled,true);
  assert.deepEqual(posted,['stop']);
  assert.ok(engine.pending.cancelTimer);
  engine.receive('bestmove e2e4');
  assert.equal(reply,null);
  assert.equal(engine.pending,null);
  assert.equal(engine.state,'ready');
});
test('UI always validates a manual save before replacing the active session',()=>{
  const app=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  assert.match(app,/const next=new ChessSession\(manual\.game\.config\);next\.restore\(manual\.game,\{resumeClock:false,strictStudy:true\}\)/);
  assert.match(app,/cancelSearch\(\);engine\?\.newGame\(\);session=next/);
  assert.match(app,/strictStudy:true/);
  assert.match(app,/preserveAnalysis:true/);
  assert.match(app,/menuFocusBeforeOpen/);
});
