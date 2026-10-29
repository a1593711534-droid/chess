import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Chess} from '../vendor/chess.js';
import {ChessSession,canPossiblyMate} from '../src/chess/session.js';
import {StudyBook} from '../src/study/studybook.js';

const prefs={mode:'local',side:'w',level:'skill-10',time:'none',sound:false};
const session=()=>new ChessSession(prefs);
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');

test('flag fall is a draw if the winning side has only a king',()=>{
  const s=session(),fen='7k/8/8/8/8/8/8/KQ6 w - - 0 1';
  s.initialFen=fen;s.game=new Chess(fen);
  assert.equal(canPossiblyMate(s.game,'b'),false);
  s.clock.timeout='w';
  assert.deepEqual(s.status(),{winner:null,kind:'timeout-insufficient'});
  s.clock.timeout='b';
  assert.deepEqual(s.status(),{winner:'w',kind:'timeout'});
});
test('a lone bishop or knight cannot mate a bare king on time',()=>{
  for(const fen of ['7k/8/8/8/8/8/8/KB6 w - - 0 1','7k/8/8/8/8/8/8/KN6 w - - 0 1']){
    const g=new Chess(fen);
    assert.equal(canPossiblyMate(g,'w'),false);
  }
});
test('defender material can create a possible helpmate with a lone minor piece',()=>{
  const g=new Chess('7k/8/8/8/8/8/5p2/KN6 w - - 0 1');
  assert.equal(canPossiblyMate(g,'w'),true);
});
test('three repetitions are claimable, not automatic',()=>{
  const s=session();
  for(let i=0;i<2;i++)for(const move of ['Nf3','Nf6','Ng1','Ng8'])assert.ok(s.play(move));
  assert.equal(s.game.isThreefoldRepetition(),true);
  assert.equal(s.done,false);
  assert.equal(s.canClaimDraw(),true);
  assert.equal(s.claimDraw(),true);
  assert.deepEqual(s.status(),{winner:null,kind:'threefold-claim'});
  assert.equal(s.done,true);
});
test('five repetitions end automatically without a claim',()=>{
  const s=session();
  for(let i=0;i<4;i++)for(const move of ['Nf3','Nf6','Ng1','Ng8'])assert.ok(s.play(move));
  assert.deepEqual(s.status(),{winner:null,kind:'fivefold'});
  assert.equal(s.canClaimDraw(),false);
});
test('the 50-move rule is claimable, but 75 moves are automatic',()=>{
  const s=session();
  s.initialFen='4k3/8/8/8/8/8/8/R3K3 w Q - 100 51';
  s.game=new Chess(s.initialFen);
  assert.equal(s.game.isDrawByFiftyMoves(),true);
  assert.equal(s.done,false);
  assert.equal(s.canClaimDraw(),true);
  assert.equal(s.claimDraw(),true);
  assert.equal(s.status().kind,'fifty-move-claim');
  const other=session();
  other.initialFen='4k3/8/8/8/8/8/8/R3K3 w Q - 150 76';
  other.game=new Chess(other.initialFen);
  assert.deepEqual(other.status(),{winner:null,kind:'seventyfive-move'});
});
test('checkmate takes precedence over automatic move-count draw',()=>{
  const s=session();
  s.initialFen='7k/6Q1/5K2/8/8/8/8/8 b - - 150 76';
  s.game=new Chess(s.initialFen);
  assert.equal(s.status().kind,'checkmate');
});
test('variation retry is idempotent and updates the same branch',()=>{
  const book=new StudyBook(),fen=new Chess().fen();
  const first=book.upsertBranch(0,fen,['e2e4']);
  assert.equal(book.upsertBranch(0,fen,['e2e4'],first),first);
  assert.equal(book.branches.length,1);
  book.upsertBranch(0,fen,['d2d4'],first);
  assert.equal(book.branches.length,1);
  assert.deepEqual(book.branches[0].moves,['d2d4']);
});
test('undo prunes detached annotations and branches while keeping earlier study',()=>{
  const s=session();s.study.setNote(0,'Initial position');
  s.play('e4');s.study.setNote(1,'King pawn');s.study.toggleMark(1,'e2','e4');
  s.study.addBranch(1,s.game.fen(),['e7e5']);
  assert.equal(s.undoTargetPly(),0);
  assert.equal(s.study.hasResearchAfter(0),true);
  assert.equal(s.undo(),1);
  assert.deepEqual(s.study.notes,{'0':'Initial position'});
  assert.deepEqual(s.study.marks,{});
  assert.equal(s.study.branches.length,0);
  assert.ok(s.play('d4'));
  assert.equal(s.study.notes['1'],undefined);
});
test('undo leaves branches anchored to a surviving position intact',()=>{
  const s=session();s.play('e4');s.study.addBranch(1,s.game.fen(),['e7e5']);s.play('c5');
  s.undo();
  assert.equal(s.study.branches.length,1);
  assert.equal(s.study.branches[0].origin,1);
});
test('strict restore rejects orphaned study branches, invalid clock and future notes',()=>{
  const s=session();s.play('e4');
  const snapshot=s.serialize(),wrong={...snapshot,study:{...snapshot.study,branches:[{origin:0,fen:s.game.fen(),moves:['e7e5']}]}};
  assert.throws(()=>session().restore(wrong,{strictStudy:true}),/起點與主線不一致/);
  const future={...snapshot,study:{...snapshot.study,notes:{'5':'orphan'}}};
  assert.throws(()=>session().restore(future,{strictStudy:true}),/超出主線/);
  const invalid={...snapshot,clock:{remaining:{w:-100,b:500},active:'w'}};
  assert.throws(()=>session().restore(invalid),/Invalid saved clock/);
});
test('UI uses staged restore and asks before overwriting study or undoing annotated moves',()=>{
  assert.match(source,/const next=new ChessSession\(saved\.config\);next\.restore\(saved,\{resumeClock:false,strictStudy:true\}\)/);
  assert.match(source,/next\.restore\(manual\.game,\{resumeClock:false,strictStudy:true\}\)/);
  assert.match(source,/session\.study\.hasResearchAfter\(session\.undoTargetPly\(\)\)/);
  assert.match(source,/sessionActive&&\(session\.ply>0\|\|session\.done\|\|hasResearch\)/);
  assert.match(source,/session\.study\.upsertBranch\(/);
});
