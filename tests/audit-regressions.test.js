import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ChessSession} from '../src/chess/session.js';
import {ChessClock} from '../src/chess/clock.js';

const app=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const board=readFileSync(new URL('../src/ui/board.js',import.meta.url),'utf8');
const boardCss=readFileSync(new URL('../styles/board.css',import.meta.url),'utf8');
const mobileCss=readFileSync(new URL('../styles/mobile.css',import.meta.url),'utf8');
const prefs={mode:'local',side:'w',time:'3+0',level:'skill-10',aiThink:'2000',aiTimeMode:'fixed'};

test('the opening white clock is resumed when a new game menu is dismissed',()=>{
  assert.match(app,/const resumeSide=menuPauseSide\|\|\(session\.ply===0\?session\.game\.turn\(\):null\)/);
  assert.match(app,/session\.clock\.resume\(resumeSide\)/);
  const clock=new ChessClock('3+0');
  clock.resume('w');
  assert.equal(clock.active,'w');
  assert.equal(clock.tick(clock.lastTick+1500),null);
  assert.ok(clock.remaining.w<=178500);
});

test('suspending a timed match for training prevents a flag and retains the side',()=>{
  const clock=new ChessClock('3+0');
  clock.resume('w');clock.lastTick-=1000;
  const side=clock.active;clock.pause();
  const snapshot={...clock.snapshot(),active:side};
  assert.equal(snapshot.active,'w');
  assert.equal(clock.tick(performance.now()+400000),null);
  clock.restore(snapshot,{resume:true});
  assert.equal(clock.active,'w');
  assert.ok(clock.remaining.w>175000);
});

test('PGN imports preserve decisive and drawn results as terminal states',()=>{
  for(const [result,winner] of [['1-0','w'],['0-1','b'],['1/2-1/2',null]]){
    const session=new ChessSession(prefs);
    session.importPgn('[Event "Imported"]\n\n1. e4 e5 '+result);
    assert.equal(session.done,true);
    assert.equal(session.status().winner,winner);
    assert.equal(session.status().kind,'pgn');
    assert.match(session.pgn(),new RegExp('Result "'+result.replaceAll('/','\\/')+'"'));
    session.undo();
    assert.equal(session.result,null);
    assert.equal(session.headers.Result,'*');
  }
});

test('a checkmate naturally writes decisive PGN Result metadata',()=>{
  const session=new ChessSession(prefs);
  for(const san of ['f3','e5','g4','Qh4#'])assert.ok(session.play(san));
  assert.match(session.pgn(),/\[Result "0-1"\]/);
});

test('navigation and study mode return paths re-queue an interrupted bot search',()=>{
  assert.match(app,/function resumeBotIfNeeded\(\)/);
  assert.match(app,/if\(!wasLatest&&session\.atLatest\)resumeBotIfNeeded\(\)/);
  assert.match(app,/render\(\);save\(\);resumeBotIfNeeded\(\)/);
  assert.match(app,/if\(next!==session\.ply&&thinking\)cancelSearch\(\)/);
  assert.match(app,/if\(!sessionActive\|\|menuVisible\(\)\|\|training\|\|variation\|\|thinking/);
});

test('piece drag cannot be prevented by pointer-events none or mid-drag rerender',()=>{
  assert.match(boardCss,/\.piece-image\{[^}]*pointer-events:auto/);
  assert.doesNotMatch(board,/dragging=sq;setSelection\(sq\)/);
  assert.match(board,/button\.addEventListener\('keydown'/);
  assert.match(board,/focusedSquare/);
});

test('engine loads lazily, and landscape UI permits scrolling',()=>{
  assert.match(app,/function ensureEngine\(\)/);
  assert.match(app,/ensureEngine\(\)\.search\(fen,/);
  assert.doesNotMatch(app,/createGameBoard\(\);\s*createEngine\(\)/);
  assert.match(mobileCss,/@media\(max-width:740px\) and \(max-height:500px\)/);
  assert.match(mobileCss,/overflow-y:auto/);
});

test('offline shell and on-demand engine cache are deployed together',()=>{
  const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  const deploy=readFileSync(new URL('../.github/workflows/deploy-pages.yml',import.meta.url),'utf8');
  assert.match(app,/navigator\.serviceWorker\.register\('\.\/sw\.js'\)/);
  assert.match(sw,/self\.addEventListener\('install'/);
  assert.match(sw,/self\.addEventListener\('fetch'/);
  assert.match(sw,/stockfish-19-single\.wasm/);
  assert.match(deploy,/cp -R index\.html sw\.js src/);
});
