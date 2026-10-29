import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {describeEvaluation} from '../src/ui/evaluation.js';

const app=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const uxCss=readFileSync(new URL('../styles/ux-phase2.css',import.meta.url),'utf8');
const board=readFileSync(new URL('../src/ui/board.js',import.meta.url),'utf8');
const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');

test('engine evaluation always describes the white perspective, whichever side moves',()=>{
  assert.match(describeEvaluation({cp:125,mate:null},'w'),/白方較有優勢.*\+1\.25/);
  assert.match(describeEvaluation({cp:125,mate:null},'b'),/黑方較有優勢.*−1\.25/);
  assert.match(describeEvaluation({cp:-200,mate:null},'w'),/黑方較有優勢.*−2\.00/);
  assert.match(describeEvaluation({cp:-200,mate:null},'b'),/白方較有優勢.*\+2\.00/);
  assert.match(describeEvaluation({cp:5,mate:null},'w'),/接近均勢/);
  assert.match(describeEvaluation({cp:null,mate:3},'b'),/黑方有將死路線/);
  assert.match(describeEvaluation({cp:null,mate:-2},'b'),/白方有將死路線/);
  assert.match(describeEvaluation({cp:null,mate:null},'w'),/尚無有效/);
});
test('board communicates marked starts, legal targets, selected square and cancellation',()=>{
  assert.match(board,/annotation-start/);
  assert.match(board,/markStart=null;[\s\S]*?onAnnotate/);
  assert.match(board,/button\.setAttribute\('aria-pressed'/);
  assert.match(board,/details\.push\('合法落點'\)/);
  assert.match(board,/event\.key==='Escape'/);
  assert.match(html,/id="chessboard"[^>]*aria-describedby="board-instructions"/);
  assert.match(html,/id="board-live"[^>]*aria-live="polite"/);
});
test('mobile has one-step save and analysis, and save result remains visible',()=>{
  for(const id of ['mobile-analysis-btn','mobile-save-btn','arena-save-status']){
    assert.ok(html.includes(`id="${id}"`));
  }
  assert.match(app,/\$\('mobile-analysis-btn'\)\.onclick=\(\)=>openRightPanel\('analysis'\)/);
  assert.match(app,/\$\('mobile-save-btn'\)\.onclick=saveManual/);
  assert.match(app,/data\.savedAt=new Date\(\)\.toISOString\(\)/);
  assert.match(app,/displaySaveStatus\('自動儲存失敗/);
  assert.match(app,/手動存檔成功/);
});
test('mobile landscape preserves playable touch targets by scrolling rather than scaling board height',()=>{
  assert.match(uxCss,/@media\(max-width:779px\) and \(max-height:500px\)/);
  assert.match(uxCss,/--focus-board:min\(calc\(100vw - 20px\),440px\)/);
  assert.match(uxCss,/overflow-y:auto!important/);
  assert.match(uxCss,/min-height:44px!important/);
  assert.match(uxCss,/#focus-return:not\(\.hidden\)\{grid-column:1\/-1/);
});
test('analysis labels, roving tabs and bundled offline assets cover all new features',()=>{
  assert.ok(html.includes('id="eval-description"'));
  assert.match(app,/describeEvaluation\(analysisInfo,current\.turn\(\)\)/);
  assert.match(app,/button\.onkeydown=event=>/);
  assert.match(app,/b\.tabIndex=active\?0:-1/);
  assert.match(sw,/src\/ui\/evaluation\.js/);
  assert.match(sw,/styles\/ux-phase2\.css/);
});
