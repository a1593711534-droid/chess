import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ChessSession} from '../src/chess/session.js';
import {StudyBook} from '../src/study/studybook.js';
import {pvToSan} from '../src/chess/notation.js';
import {openingFor} from '../src/data/openings.js';
import {saveGame} from '../src/utils/preferences.js';

const prefs={mode:'local',side:'w',time:'none',level:'club',sound:false};
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
test('ambiguous opening prefixes are not labeled as a specific ECO opening',()=>{
  assert.equal(openingFor(['e4']),null);
  assert.equal(openingFor(['e4','e5','Nf3','Nc6']),null);
  assert.equal(openingFor(['e4','e5','Nf3','Nc6','Bc4'])?.eco,'C50');
});
test('PV notation honors non-default FEN fullmove number',()=>{
  const fen='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 17';
  assert.equal(pvToSan(fen,['e7e5','e2e4']),'17... e5  18. e4');
});
test('older saves with more than 50 branches survive reload',()=>{
  const book=new StudyBook(),game=new ChessSession(prefs),fen=game.game.fen();
  for(let i=0;i<50;i++)book.addBranch(0,fen,['e2e4']);
  assert.equal(book.serialize().branches.length,50);
  book.addBranch(0,fen,['d2d4']);
  assert.equal(new StudyBook(JSON.parse(JSON.stringify(book.serialize()))).branches.length,51);
});
test('full study data roundtrip retains notes, annotations and variations',()=>{
  const game=new ChessSession(prefs);game.play('e4');
  game.study.setNote(1,'Centre control');game.study.toggleMark(1,'e2','e4');
  game.study.addBranch(1,game.game.fen(),['e7e5']);
  const backup=JSON.parse(JSON.stringify({format:'chess-atelier-study-v1',game:game.serialize()}));
  const loaded=new ChessSession(backup.game.config);loaded.restore(backup.game);
  assert.equal(loaded.study.notes['1'],'Centre control');
  assert.deepEqual(loaded.study.marks['1'],[{from:'e2',to:'e4'}]);
  assert.equal(loaded.study.branches[0].moves[0],'e7e5');
});
test('autosave storage errors return a failure signal',()=>{
  const old=globalThis.localStorage;
  try{
    globalThis.localStorage={setItem(){throw Error('QuotaExceededError')}};
    assert.equal(saveGame({version:1}),false);
    globalThis.localStorage={setItem(){}};
    assert.equal(saveGame({version:1}),true);
  }finally{
    if(old===undefined)delete globalThis.localStorage;
    else globalThis.localStorage=old;
  }
});
test('UI cancel logic fences analyses from stale positions',()=>{
  assert.match(source,/next!==session\.cursor&&\(thinking\|\|analysisRunning\)/);
  assert.match(source,/token!==analysisSequence\|\|activeGame\(\)\.fen\(\)!==fen/);
  assert.match(source,/變例尚未儲存/);
  assert.match(source,/flippedBeforeTraining/);
  assert.match(source,/engine\.state==='error'/);
});
