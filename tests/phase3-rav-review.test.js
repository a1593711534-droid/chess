import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Chess,DEFAULT_POSITION} from '../vendor/chess.js';
import {ChessSession} from '../src/chess/session.js';
import {parseAnnotatedPgn} from '../src/study/pgn-import.js';
import {analyzeFullGame,evaluateForWhite,classifyMoveLoss} from '../src/chess/game-review.js';

const prefs={mode:'local',side:'w',time:'none',level:'skill-10',sound:false};
const make=()=>new ChessSession(prefs);
const uci=m=>m.from+m.to+(m.promotion||'');
const normalizePgn=p=>p.replace(/^\[Date ".*"\]\n/gm,'').replace(/\s+/g,' ').trim();

test('nested PGN RAV, branch comments, punctuation NAGs and mainline notes roundtrip',()=>{
  const s=make();
  s.play('e4');s.play('e5');s.play('Nf3');
  s.study.setNote(1,'Centre control');
  s.study.nags['1']=[1,14];
  const before=new Chess();before.move('e4');
  const b=s.study.addBranch(1,before.fen(),['c7c5','g1f3'],{
    notes:{'1':'Sicilian idea'},nags:{'1':[5],'2':[1]}});
  before.move('c5');
  s.study.addBranch(1,before.fen(),['d2d4'],{
    parentId:b.id,parentPly:1,notes:{'1':'Alternative plan'},nags:{'1':[2]}});
  const pg=s.pgnWithVariations();
  assert.match(pg,/\(1\.\.\. c5 \$5 \{Sicilian idea\} 2\. Nf3 \$1 \(2\. d4 \$2 \{Alternative plan\}\)\)/);
  const imported=make();imported.importPgn(pg);
  assert.deepEqual(imported.moves.map(m=>m.san),s.moves.map(m=>m.san));
  assert.deepEqual(imported.study.nags,s.study.nags);
  assert.deepEqual(imported.study.branches,s.study.branches);
  assert.equal(normalizePgn(imported.pgnWithVariations()),normalizePgn(pg));
  const saved=imported.serialize(),restored=make();
  assert.doesNotThrow(()=>restored.restore(saved,{strictStudy:true}));
  assert.deepEqual(restored.study.branches,imported.study.branches);
});
test('third-party PGN RAV with semicolon comments and relative alternatives imports',()=>{
  const text='[Event "Example"]\n[Result "1-0"]\n\n1.e4! {King pawn} (1.d4!? d5) e5 (1...c5 ; Sicilian\n 2.Nf3 (2.d4)) 2.Nf3 Nc6 1-0';
  const s=make();s.importPgn(text);
  assert.equal(s.ply,4);assert.equal(s.status().winner,'w');
  assert.equal(s.study.notes['1'],'King pawn');
  assert.deepEqual(s.study.nags['1'],[1]);
  assert.equal(s.study.branches.length,3);
  assert.equal(s.study.branches[0].origin,0);
  assert.equal(s.study.branches[1].origin,1);
  assert.equal(s.study.branches[2].parentId,s.study.branches[1].id);
  assert.equal(s.study.branches[2].parentPly,1);
  const pg=s.pgnWithVariations();
  assert.match(pg,/Sicilian/);
  assert.match(pg,/\(1\. d4 \$5 d5\)/);
});
test('FEN black-to-move PGN variation imports and exports correctly',()=>{
  const fen='rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
  const pgn='[SetUp "1"]\n[FEN "'+fen+'"]\n\n1...c5 (1...e5) 2.Nf3 *';
  const s=make();s.importPgn(pgn);
  assert.equal(s.initialFen,fen);assert.equal(s.study.branches.length,1);
  assert.equal(s.study.branches[0].origin,0);
  assert.match(s.pgnWithVariations(),/1\.\.\. c5 \(1\.\.\. e5\) 2\. Nf3/);
  assert.doesNotThrow(()=>make().importPgn(s.pgnWithVariations()));
});
test('bad/misnested RAV and oversized comments reject without mutating the existing game',()=>{
  const s=make();s.play('e4');const previous=s.serialize();
  const malformed=['1. e4 (1... e5', '1. e4 )','(1.e4)','1. e4 (1. d4 2. illegal)',
    '1. e4 {unclosed', '1. e4 ('+'('.repeat(30)+'1.d4'+')'.repeat(31),
    '1. e4 { '+'x'.repeat(510)+' }', '[Result "0-1"]\n\n1. e4 1-0'];
  for(const text of malformed){
    assert.throws(()=>s.importPgn(text),undefined,text);
    assert.deepEqual(s.serialize().moves,previous.moves);
    assert.equal(s.study.branches.length,0);
  }
});
test('PGN annotation punctuation and numeric NAG preserve legal SAN',()=>{
  const s=make();s.importPgn('1. e4!? $14 e5?? $2 2. Nf3!! Nc6! *');
  assert.deepEqual(s.study.nags,{'1':[5,14],'2':[4,2],'3':[3],'4':[1]});
  const pgn=s.pgnWithVariations();
  assert.match(pgn,/e4 \$5 \$14 e5 \$4 \$2/);
  assert.deepEqual(parseAnnotatedPgn(pgn).study.nags,s.study.nags);
});
test('engine score normalization is from White perspective and mate has no invented CP loss',()=>{
  assert.equal(evaluateForWhite({cp:100,mate:null},'b'),-100);
  assert.equal(evaluateForWhite({cp:-60,mate:null},'b'),60);
  assert.equal(evaluateForWhite({cp:null,mate:2},'w'),null);
  assert.deepEqual(classifyMoveLoss(80,40,'w'),{loss:40,label:'正常'});
  assert.deepEqual(classifyMoveLoss(100,20,'w'),{loss:80,label:'小失誤'});
  assert.deepEqual(classifyMoveLoss(100,-100,'w'),{loss:200,label:'失誤'});
  assert.deepEqual(classifyMoveLoss(200,-200,'w'),{loss:400,label:'嚴重失誤'});
  assert.deepEqual(classifyMoveLoss(-60,30,'b'),{loss:90,label:'小失誤'});
  assert.deepEqual(classifyMoveLoss(null,10,'w'),{loss:null,label:'未判定'});
});
test('whole-game analysis searches initial plus every ply and reports mover-side losses',async()=>{
  const s=make();s.play('e4');s.play('e5');s.play('Nf3');
  const visits=[];
  const white=[30,0,100,-30];
  const engine={async search(fen,{movetime,multiPV,skill,position,onInfo}){
    assert.equal(movetime,350);assert.equal(multiPV,1);assert.equal(skill,20);
    const i=visits.length;
    const whiteScore=white[i],turn=fen.split(' ')[1];
    onInfo({cp:turn==='w'?whiteScore:-whiteScore,mate:null,depth:10,multiPV:1,pv:[]});
    visits.push({fen,history:[...position.moves]});
    return 'e2e4';
  }};
  const progress=[];
  const rows=await analyzeFullGame(s,engine,{movetime:350,onProgress:p=>progress.push(p)});
  assert.equal(visits.length,4);
  assert.deepEqual(visits.map(v=>v.history.length),[0,1,2,3]);
  assert.equal(rows.length,3);assert.deepEqual(rows.map(r=>r.loss),[30,100,130]);
  assert.deepEqual(rows.map(r=>r.label),['正常','小失誤','小失誤']);
  assert.equal(progress.at(-1).done,3);
});
test('game review stops after cancellation; empty and bad budgets are handled',async()=>{
  const empty=make();
  assert.deepEqual(await analyzeFullGame(empty,{search(){throw Error('should not run');}}),[]);
  const s=make();s.play('e4');s.play('e5');
  let cancelled=false,visits=0;
  const engine={async search(_fen,{onInfo}){visits++;onInfo({cp:0,mate:null,multiPV:1});cancelled=visits>=2;return 'e2e4';}};
  const rows=await analyzeFullGame(s,engine,{isCancelled:()=>cancelled});
  assert.equal(visits,2);assert.deepEqual(rows,[]);
  await assert.rejects(()=>analyzeFullGame(s,engine,{movetime:20}),/Invalid game review/);
});
test('new PGN/analysis modules are included in offline shell and UI wiring',()=>{
  const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  const app=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  assert.match(sw,/'src\/study\/pgn-import\.js'/);
  assert.match(sw,/'src\/chess\/game-review\.js'/);
  assert.match(app,/analyzeFullGame\(subject,ensureEngine\(\)/);
  assert.match(app,/review-game/);
});
