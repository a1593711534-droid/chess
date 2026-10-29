import test from 'node:test';
import assert from 'node:assert/strict';
import {ChessClock} from '../src/chess/clock.js';
import {ChessSession} from '../src/chess/session.js';
import {buildGoCommand} from '../src/chess/engine.js';
import {selectAiSearch,normalizeThinkMs,describeAiTime} from '../src/chess/time-management.js';
import {DEFAULT_PREFS} from '../src/utils/preferences.js';
import {readFileSync} from 'node:fs';

const config={mode:'ai',side:'w',level:'skill-20',time:'10+5',aiThink:'2000',aiTimeMode:'adaptive'};
test('new games use clock-aware AI with independent skill, clock and think controls',()=>{
  assert.equal(DEFAULT_PREFS.aiTimeMode,'adaptive');
  const clock=new ChessClock('10+5');
  const options=selectAiSearch(config,clock);
  assert.deepEqual(options,{clock:{wtime:600000,btime:600000,winc:5000,binc:5000}});
  assert.equal(buildGoCommand(options),'go wtime 600000 btime 600000 winc 5000 binc 5000');
  assert.equal(describeAiTime(config,clock),'智能時間分配');
});
test('real elapsed time, increment and side-to-move update UCI budget',()=>{
  const clock=new ChessClock('3+0');
  clock.remaining={w:71480,b:148711};clock.increment=3000;
  const opts=selectAiSearch(config,clock);
  assert.equal(opts.clock.wtime,71480);
  assert.equal(opts.clock.btime,148711);
  assert.equal(opts.clock.winc,3000);
  assert.equal(buildGoCommand(opts),'go wtime 71480 btime 148711 winc 3000 binc 3000');
  assert.equal(buildGoCommand({...opts,depth:13}),'go depth 13');
});
test('fixed advanced mode never supplies clock-based UCI controls',()=>{
  const clock=new ChessClock('10+5');
  const opts=selectAiSearch({...config,aiTimeMode:'fixed',aiThink:'15000'},clock);
  assert.deepEqual(opts,{movetime:15000});
  assert.equal(buildGoCommand(opts),'go movetime 15000');
  assert.match(describeAiTime({...config,aiTimeMode:'fixed',aiThink:'15000'},clock),/15 秒/);
});
test('untimed adaptive mode uses bounded, explicit per-move fallback',()=>{
  const clock=new ChessClock('none');
  assert.deepEqual(selectAiSearch({...config,aiThink:'4000'},clock),{movetime:4000});
  assert.equal(buildGoCommand(selectAiSearch({...config},clock)),'go movetime 2000');
  assert.equal(normalizeThinkMs('900000'),2000);
  assert.equal(normalizeThinkMs('350'),350);
});
test('flag fall before search prevents a new engine command',()=>{
  const clock=new ChessClock('3+0');clock.timeout='b';clock.remaining.b=0;
  assert.equal(selectAiSearch(config,clock),null);
});
test('legacy saves retain original fixed-time behavior and search budgets',()=>{
  const old=new ChessSession({...config,level:'beginner',aiThink:undefined});
  const saved=old.serialize();delete saved.config.aiTimeMode;
  const restored=new ChessSession(config);
  restored.restore(saved,{resumeClock:false});
  assert.equal(restored.config.aiTimeMode,'fixed');
  assert.equal(restored.config.aiThink,'350');
  assert.deepEqual(selectAiSearch(restored.config,restored.clock),{movetime:350});
  const future=new ChessSession(config);const now=future.serialize();
  future.restore(now,{resumeClock:false});
  assert.equal(future.config.aiTimeMode,'adaptive');
});
test('UI explains increment and does not offer fixed time in adaptive timed mode',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  assert.match(html,/每步加秒/);
  assert.match(html,/id="ai-time-mode"/);
  assert.match(main,/adaptive&&\!noClock/);
  assert.match(main,/selectAiSearch\(session.config,session.clock\)/);
});
