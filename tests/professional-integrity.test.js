import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Chess} from '../vendor/chess.js';
import {ChessSession} from '../src/chess/session.js';

const config={mode:'local',side:'w',level:'skill-10',time:'none',sound:false};
const timed={...config,time:'5+3'};
const make=(prefs=config)=>new ChessSession(prefs);
const clone=value=>structuredClone(value);

test('FIDE 9.2.1: announce the third repetition without playing the move',()=>{
  const s=make();
  for(const san of ['Nf3','Nf6','Ng1','Ng8','Nf3','Nf6','Ng1']){
    assert.ok(s.play(san),san);
  }
  assert.equal(s.canClaimDraw(),false,'present position has not occurred three times');
  const matching=s.claimableDrawMoves().find(m=>m.uci==='f6g8');
  assert.deepEqual(matching,{uci:'f6g8',san:'Ng8',kind:'threefold-claim'});
  const fen=s.game.fen(),ply=s.ply;
  assert.equal(s.claimDraw('e7e5'),false,'illegal/unqualified announcement must fail');
  assert.equal(s.claimDraw('f6g8'),true);
  assert.equal(s.game.fen(),fen,'the intended move must not be made');
  assert.equal(s.ply,ply);
  assert.deepEqual(s.status(),{winner:null,kind:'threefold-claim',announcedMove:'f6g8'});
  assert.match(s.pgn(),/\[Result "1\/2-1\/2"\]/);
  const saved=s.serialize(),restored=make();
  assert.doesNotThrow(()=>restored.restore(saved,{strictStudy:true}));
  assert.deepEqual(restored.status(),s.status());
  const invalid=clone(saved);
  invalid.result.announcedMove='a2a3';
  assert.throws(()=>make().restore(invalid,{strictStudy:true}),/Invalid saved draw claim/);
});

test('FIDE 9.3.1: announce a non-capture, non-pawn 100th halfmove',()=>{
  const s=make(),fen='7k/8/8/8/8/8/3R4/K7 w - - 99 50';
  s.initialFen=fen;s.game=new Chess(fen);
  s.historyIndex.attach(s.game,fen);
  assert.equal(s.canClaimDraw(),false);
  assert.ok(s.claimableDrawMoves().some(m=>m.uci==='d2d3'&&m.kind==='fifty-move-claim'));
  assert.equal(s.claimDraw('d2d3'),true);
  assert.equal(s.game.fen(),fen);
  assert.equal(s.status().kind,'fifty-move-claim');
  assert.doesNotThrow(()=>make().restore(s.serialize(),{strictStudy:true}));
});

test('a normal draw claim still works without an announced move',()=>{
  const s=make();
  for(const san of ['Nf3','Nf6','Ng1','Ng8','Nf3','Nf6','Ng1','Ng8'])
    assert.ok(s.play(san));
  assert.equal(s.canClaimDraw(),true);
  assert.equal(s.claimDraw(),true);
  assert.deepEqual(s.status(),{winner:null,kind:'threefold-claim'});
});

test('strict timed backup rejects missing clock and per-move clock history',()=>{
  const s=make(timed);s.clock.resume('w');assert.ok(s.play('e4'));
  const saved=s.serialize();
  assert.doesNotThrow(()=>make(timed).restore(saved,{strictStudy:true}));
  const noClock=clone(saved);delete noClock.clock;
  assert.throws(()=>make(timed).restore(noClock,{strictStudy:true}),/timed study requires/);
  const nullClock=clone(saved);nullClock.clock=null;
  assert.throws(()=>make(timed).restore(nullClock,{strictStudy:true}),/timed study requires/);
  const noSnapshots=clone(saved);delete noSnapshots.clockSnapshots;
  assert.throws(()=>make(timed).restore(noSnapshots,{strictStudy:true}),/Invalid saved clock history/);
  // For backward-compatible non-strict imports, do not require the new fields.
  assert.doesNotThrow(()=>make(timed).restore(noSnapshots,{strictStudy:false}));
});

test('restored draw claim rejects forged announced move or result kind',()=>{
  const s=make();
  for(const san of ['Nf3','Nf6','Ng1','Ng8','Nf3','Nf6','Ng1'])s.play(san);
  s.claimDraw('f6g8');
  const record=s.serialize();
  const wrongKind=clone(record);wrongKind.result.kind='fifty-move-claim';
  assert.throws(()=>make().restore(wrongKind,{strictStudy:true}),/Invalid saved draw claim/);
  const badSyntax=clone(record);badSyntax.result.announcedMove='f6g9';
  assert.throws(()=>make().restore(badSyntax,{strictStudy:true}),/Invalid saved result/);
});

test('destructive imports and variation undo have explicit safety and persistence paths',()=>{
  const app=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  assert.match(app,/const hasExistingWork=sessionActive&&/);
  assert.match(app,/Object\.keys\(session\.study\.notes\)\.length>0/);
  assert.match(app,/showConfirm\('匯入將取代目前棋局'/);
  assert.match(app,/variation\.moves\.pop\(\);variation\.game\.undo\(\);render\(\);save\(\)/);
  assert.match(app,/session\.claimableDrawMoves\(\)/);
  assert.match(app,/session\.claimDraw\(select\.value\)/);
});
