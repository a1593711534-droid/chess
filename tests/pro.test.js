import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess,DEFAULT_POSITION} from '../vendor/chess.js';
import {OPENINGS,validateOpenings,openingFor,continuations,openingGame} from '../src/data/openings.js';
import {PUZZLES,validatePuzzles} from '../src/data/puzzles.js';
import {StudyBook} from '../src/study/studybook.js';
import {TrainingSession} from '../src/study/training.js';
import {ChessSession} from '../src/chess/session.js';
const prefs={mode:'local',side:'w',level:'club',time:'none',sound:false};
test('all 33 curated opening sequences are strictly legal',()=>{assert.equal(OPENINGS.length,33);assert.equal(validateOpenings(),true);});
test('opening explorer recognizes best-prefix matches and followups',()=>{
 const o=openingFor(['e4','e5','Nf3','Nc6','Bc4']);assert.equal(o?.eco,'C50');
 assert.ok(continuations(['e4','e5','Nf3','Nc6']).some(r=>r.san==='Bc4'));
 assert.ok(continuations(['e4']).some(r=>r.san==='c5'));
 assert.equal(openingGame(OPENINGS[0]).history().length,OPENINGS[0].moves.length);
});
test('all 16 training puzzles are legal and marked mates actually checkmate',()=>{assert.equal(PUZZLES.length,16);assert.equal(validatePuzzles(),true);});
test('training rejects wrong moves without changing board and counts errors',()=>{
 const p=PUZZLES.find(x=>x.id==='mate01'),s=new TrainingSession(p);const fen=s.game.fen();
 assert.equal(s.play('g6g5').ok,false);assert.equal(s.errors,1);assert.equal(s.game.fen(),fen);
 assert.equal(s.play('g6h6').ok,true);assert.equal(s.solved,true);assert.equal(s.game.isCheckmate(),true);
 s.restart();assert.equal(s.errors,0);assert.equal(s.solved,false);
});
test('multi-ply training automatically supplies authored opponent reply',()=>{
 const p=PUZZLES.find(x=>x.id==='scotch01'),s=new TrainingSession(p);
 assert.equal(s.play('d2d4').hasReply,true);assert.equal(s.pendingReply,true);
 assert.equal(s.play('f3d4').reason,'busy');
 s.reply();assert.equal(s.game.history().join(' '),'d4 exd4');
 assert.equal(s.play('f3d4').done,true);assert.equal(s.solved,true);
});
test('study annotations can be toggled and filtered on recovery',()=>{
 const s=new StudyBook();s.toggleMark(2,'e4','e5');s.toggleMark(2,'e4','e4');
 assert.equal(s.marks['2'].length,2);s.toggleMark(2,'e4','e5');assert.deepEqual(s.marks['2'],[{from:'e4',to:'e4'}]);
 const restored=new StudyBook({notes:{'2':'Hi','evil':'x'},marks:{'2':s.marks['2']},branches:[]});
 assert.equal(restored.notes['2'],'Hi');assert.equal(restored.notes.evil,undefined);
});
test('study variation keeps legal independent branch and exports FEN/PGN',()=>{
 const book=new StudyBook(),g=new Chess();g.move('e4');g.move('e5');const fen=g.fen();
 const b=book.addBranch(2,fen,['g1f3','b8c6','f1c4']);
 assert.equal(b.moves.length,3);assert.match(book.branchPgn(b),/Nf3 Nc6 3\. Bc4/);
 assert.equal(g.fen(),fen);
 assert.throws(()=>book.addBranch(0,DEFAULT_POSITION,['e2e5']));
});
test('PGN comments roundtrip; saved analysis notes and branches survive restoration',()=>{
 const s=new ChessSession(prefs);s.play('e4');s.play('e5');s.study.setNote(1,'Occupy the centre');s.study.setNote(2,'Respond symmetrically');s.study.toggleMark(2,'e4','e5');
 s.study.addBranch(2,s.game.fen(),['g1f3']);
 const pgn=s.pgn();assert.match(pgn,/Occupy the centre/);assert.match(pgn,/Respond symmetrically/);
 const restored=new ChessSession(prefs);restored.restore(s.serialize());assert.equal(restored.study.notes['2'],'Respond symmetrically');assert.equal(restored.study.branches.length,1);
 const imported=new ChessSession(prefs);imported.importPgn(pgn);assert.equal(imported.study.notes['1'],'Occupy the centre');assert.equal(imported.study.notes['2'],'Respond symmetrically');
});
