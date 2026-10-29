import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ChessSession,resolveLevel,SKILL_LEVELS} from '../src/chess/session.js';
import {ChessClock} from '../src/chess/clock.js';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles/main-menu.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');

test('main menu owns difficulty, clock and independent bot thinking controls',()=>{
  assert.ok(html.includes('id="main-menu-modal"'));
  assert.ok(html.indexOf('id="level-select"')>html.indexOf('id="main-menu-modal"'));
  assert.ok(html.indexOf('id="ai-think-select"')>html.indexOf('id="main-menu-modal"'));
  assert.equal((html.match(/<option value="skill-\d+"/g)||[]).length,21);
  assert.ok(html.includes('id="active-match-summary"'));
  assert.ok(html.includes('id="save-game"'));
  assert.ok(html.includes('id="ai-time-mode"'));
  assert.ok(html.includes('智能分配 · 依棋鐘與局面'));
  assert.ok(html.includes('id="menu-load"'));
  assert.ok(!html.includes('<header class="app-header">'));
  assert.match(css,/\.app-header\{display:none!important\}/);
});
test('all 21 stockfish skill settings map to exact UCI levels without modifying think time',()=>{
  assert.equal(Object.keys(SKILL_LEVELS).length,21);
  for(let i=0;i<=20;i++){
    const config=resolveLevel(`skill-${i}`);
    assert.equal(config.skill,i);
    assert.equal(config.movetime,2000);
  }
});
test('clock and bot budget are stored independently in the session and roundtrip',()=>{
  const session=new ChessSession({mode:'ai',side:'w',time:'3+0',level:'skill-7',aiThink:'15000'});
  session.play({from:'e2',to:'e4'});
  const saved=session.serialize();
  assert.equal(saved.config.time,'3+0');
  assert.equal(saved.config.aiThink,'15000');
  assert.equal(saved.config.level,'skill-7');
  assert.equal(saved.moves.length,1);
  const recovered=new ChessSession(saved.config);
  recovered.restore(saved,{resumeClock:false});
  assert.equal(recovered.ply,1);
  assert.equal(recovered.clock.active,null);
  assert.equal(recovered.config.aiThink,'15000');
  assert.equal(recovered.config.level,'skill-7');
});
test('resuming suspended clock does not spend time in menu or while page is closed',()=>{
  const clock=new ChessClock('10+5');
  clock.resume('w');
  assert.equal(clock.active,'w');
  clock.pause();
  const saved=clock.snapshot();
  assert.equal(saved.active,null);
  clock.resume('w');
  assert.equal(clock.active,'w');
  clock.pause();
});
test('active game configuration stays unchanged while the new-game menu is editable in one step',()=>{
  assert.match(app,/setMenuEditing\(true\)/);
  assert.match(app,/\$\('menu-start-shortcut'\)\.onclick=showNewGame/);
  assert.match(app,/menuVisible\(\)\|\|session\.done/);
  assert.match(app,/saveManualGame\(serializedForSave\(\)\)/);
  assert.match(app,/next\.restore\(saved,\{resumeClock:false,strictStudy:true\}\)/);
  assert.match(app,/next\.restore\(manual\.game,\{resumeClock:false,strictStudy:true\}\)/);
});
