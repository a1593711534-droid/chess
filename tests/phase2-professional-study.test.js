import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from '../vendor/chess.js';
import {ChessSession} from '../src/chess/session.js';
import {StudyBook} from '../src/study/studybook.js';

const config={mode:'local',side:'w',level:'skill-10',time:'none',sound:false};
const local=()=>new ChessSession(config);
const copy=record=>structuredClone(record);

test('FIDE draw offer is made on move; opponent can accept only after the move',()=>{
  const s=local();
  assert.equal(s.offerDraw(),true);
  assert.equal(s.offerDraw(),false);
  assert.equal(s.canRespondToDrawOffer(),false);
  assert.equal(s.respondToDrawOffer(true),false);
  assert.equal(s.pendingDrawOffer.stage,'awaiting-move');
  assert.ok(s.play('e4'));
  assert.equal(s.pendingDrawOffer.stage,'pending-reply');
  assert.equal(s.canRespondToDrawOffer(),true);
  const fen=s.game.fen(),ply=s.ply;
  assert.equal(s.respondToDrawOffer(true),true);
  assert.equal(s.game.fen(),fen);assert.equal(s.ply,ply);
  assert.deepEqual(s.status(),{winner:null,kind:'agreement'});
  assert.equal(s.play('e5'),null);
  assert.match(s.pgn(),/\[Result "1\/2-1\/2"\]/);
  const restored=local();restored.restore(s.serialize(),{strictStudy:true});
  assert.deepEqual(restored.status(),s.status());
});
test('rejecting draw or making a reply move expires the offer',()=>{
  const a=local();a.offerDraw();a.play('d4');
  assert.equal(a.respondToDrawOffer(false),true);
  assert.equal(a.pendingDrawOffer,null);assert.equal(a.done,false);
  const b=local();b.offerDraw();b.play('d4');
  assert.ok(b.play('d5'));assert.equal(b.pendingDrawOffer,null);
});
test('pending draw offer survives strict backup without changing chess clocks',()=>{
  const s=local();s.offerDraw();const waiting=s.serialize();
  const restored=local();restored.restore(waiting,{strictStudy:true});
  assert.deepEqual(restored.pendingDrawOffer,s.pendingDrawOffer);
  restored.play('e4');
  const offered=restored.serialize();
  const next=local();next.restore(offered,{strictStudy:true});
  assert.equal(next.canRespondToDrawOffer(),true);
  assert.equal(next.respondToDrawOffer(true),true);
  const wrong=copy(offered);wrong.pendingDrawOffer.atPly=wrong.moves.length;
  assert.throws(()=>local().restore(wrong,{strictStudy:true}),/Invalid saved draw offer/);
  const fake=copy(offered);fake.pendingDrawOffer.from='b';
  assert.throws(()=>local().restore(fake,{strictStudy:true}),/Invalid saved draw offer/);
  assert.equal(new ChessSession({...config,mode:'ai'}).offerDraw(),false);
});
test('draw offer is cancelled on undo and cannot override a finished game',()=>{
  const s=local();s.offerDraw();s.play('e4');
  s.undo();assert.equal(s.pendingDrawOffer,null);
  s.result={winner:'w',kind:'pgn'};
  assert.equal(s.offerDraw(),false);
});
test('nested variations have stable IDs and validate their exact parent FEN',()=>{
  const g=new Chess();g.move('e4');const first=g.fen();
  const book=new StudyBook();
  const a=book.addBranch(1,first,['c7c5','g1f3']);
  const middle=new Chess(first);middle.move('c5');
  const child=book.addBranch(1,middle.fen(),['d2d4'],{parentId:a.id,parentPly:1});
  assert.equal(child.parentId,a.id);assert.equal(child.parentPly,1);
  const data=structuredClone(book.serialize()),reload=new StudyBook(data,{strict:true});
  assert.deepEqual(reload.branches,book.branches);
  assert.equal(reload.addBranch(1,middle.fen(),['d2d3'],{parentId:a.id,parentPly:1}).id,child.id+1);
  assert.throws(()=>book.addBranch(1,first,['d2d4'],{parentId:a.id,parentPly:1}),/parent position/);
  assert.throws(()=>new StudyBook({...data,branches:[...data.branches,{...child,id:a.id}]},{strict:true}),/duplicate/);
  assert.throws(()=>book.upsertBranch(1,first,[],a),/子分支/);
});
test('PGN exports annotated mainline and actual nested RAV, preserving FEN from the root',()=>{
  const s=local();
  s.play('e4');const first=s.game.fen();
  s.play('e5');s.play('Nf3');
  s.study.setNote(1,'White plays for the centre');
  const b=s.study.addBranch(1,first,['c7c5','g1f3']);
  const after=new Chess(first);after.move('c5');
  s.study.addBranch(1,after.fen(),['d2d4'],{parentId:b.id,parentPly:1});
  const pgn=s.pgnWithVariations();
  assert.match(pgn,/1\. e4 \{White plays for the centre\} e5 \(1\.\.\. c5 2\. Nf3 \(2\. d4\)\) 2\. Nf3/);
  assert.match(pgn,/\[Result "\*"\]/);
  const backup=s.serialize(),again=local();
  again.restore(backup,{strictStudy:true});
  assert.equal(again.pgnWithVariations().replace(/\[Date "[^"]+"\]/g,''),
    pgn.replace(/\[Date "[^"]+"\]/g,''));
  assert.match(again.pgnWithVariations(),/\(2\. d4\)/);
});
test('old backup branches without IDs remain compatible, new ancestry is validated',()=>{
  const s=local();s.play('e4');
  const raw=s.serialize();
  raw.study.branches=[{origin:1,fen:s.game.fen(),moves:['c7c5']}];
  const restored=local();restored.restore(raw,{strictStudy:true});
  assert.equal(restored.study.branches[0].id,1);
  assert.equal(restored.study.branches[0].parentId,null);
  const illegal=copy(restored.serialize());
  illegal.study.branches.push({origin:1,fen:s.game.fen(),moves:['d7d5'],id:2,parentId:500,parentPly:0});
  assert.throws(()=>local().restore(illegal,{strictStudy:true}),/變例無效/);
});
