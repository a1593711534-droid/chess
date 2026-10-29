import test from 'node:test';
import assert from 'node:assert/strict';
import {ChessClock} from '../src/chess/clock.js';
import {ChessSession} from '../src/chess/session.js';

const prefs={mode:'local',side:'w',time:'3+0',level:'club',sound:true};

test('flag fall is a one-shot event even if tick repeats hundreds of times',()=>{
  const c=new ChessClock('3+0');
  c.afterMove('w','b');
  const deadline=c.lastTick+c.remaining.b+1;
  assert.equal(c.tick(deadline),'b');
  for(let i=0;i<1000;i++)assert.equal(c.tick(deadline+i*200),null);
  assert.equal(c.timeout,'b');
  assert.equal(c.active,null);
  assert.equal(c.format('b'),'00:00');
});

test('terminal timer state survives snapshot/restore and reload does not refire event',()=>{
  const c=new ChessClock('3+0');c.afterMove('w','b');
  assert.equal(c.tick(c.lastTick+200000),'b');
  const snapshot=c.snapshot();assert.equal(snapshot.timeout,'b');
  const loaded=new ChessClock('3+0');loaded.restore(snapshot,{accountElapsed:true});
  assert.equal(loaded.timeout,'b');
  for(let i=0;i<100;i++)assert.equal(loaded.tick(),null);
  assert.equal(loaded.active,null);
});

test('older version saved a flag but no timeout field: infer losing side',()=>{
  const c=new ChessClock('3+0');
  c.restore({remaining:{w:170000,b:0},active:null,savedAt:Date.now()-100000},{accountElapsed:true});
  assert.equal(c.timeout,'b');assert.equal(c.tick(),null);
});

test('session play refuses an attempted move when snapshot detects a just-expired clock',()=>{
  const s=new ChessSession(prefs);
  s.play('e4');assert.equal(s.game.turn(),'b');
  s.clock.lastTick-=200000;
  assert.equal(s.play('e5'),null);
  assert.equal(s.ply,1);
  assert.equal(s.clock.timeout,'b');
  assert.deepEqual(s.status(),{winner:'w',kind:'timeout'});
});

test('checkmate ends clock immediately; must never overwrite checkmate with timeout',()=>{
  const s=new ChessSession(prefs);
  for(const san of ['f3','e5','g4','Qh4#'])assert.ok(s.play(san));
  assert.equal(s.game.isCheckmate(),true);
  assert.equal(s.clock.active,null);
  assert.equal(s.clock.timeout,null);
  assert.equal(s.clock.tick(performance.now()+999_999),null);
  assert.deepEqual(s.status(),{winner:'b',kind:'checkmate'});
});

test('timeout result remains terminal after restoring serialized game',()=>{
  const s=new ChessSession(prefs);s.play('e4');
  assert.equal(s.clock.tick(s.clock.lastTick+200000),'b');
  const restored=new ChessSession(prefs);restored.restore(s.serialize());
  assert.equal(restored.done,true);
  assert.deepEqual(restored.status(),{winner:'w',kind:'timeout'});
  assert.equal(restored.clock.tick(),null);
});

test('paused untimed games do not accidentally infer a timeout from zero values',()=>{
  const c=new ChessClock('none');
  c.restore({remaining:{w:0,b:0},active:null,timeout:null});
  assert.equal(c.timeout,null);
});
