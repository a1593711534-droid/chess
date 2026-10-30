import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {APP_VERSION} from '../src/ui/boot.js';

const css=readFileSync(new URL('../styles/readability.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const experience=readFileSync(new URL('../styles/experience.css',import.meta.url),'utf8');
const boot=readFileSync(new URL('../src/ui/boot.js',import.meta.url),'utf8');

test('experience styles override focus and readability and retain a versioned cache key',()=>{
  const all=[...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(x=>x[1]);
  assert.ok(all.at(-1).endsWith(`experience.css?v=${APP_VERSION}`));
  assert.equal(all.filter(x=>x.includes('styles/experience.css')).length,1);
  assert.ok(all.some(x=>x.endsWith(`readability.css?v=${APP_VERSION}`)));
  assert.ok(boot.includes(`APP_VERSION='${APP_VERSION}'`));
  assert.ok(html.includes(`data-app-version="${APP_VERSION}"`));
  assert.match(experience,/grid-template-columns:minmax\(286px,1fr\)/);
  assert.match(experience,/#main-menu-modal \.main-menu-card/);
});
test('main menu has viewport-bounded, state-independent frame dimensions',()=>{
  assert.match(css,/#main-menu-modal \.main-menu-card\s*\{/);
  assert.match(css,/height:min\(820px,calc\(100dvh - 28px\)\)/);
  assert.match(css,/#main-menu-modal \.main-menu-grid\s*\{/);
  assert.match(css,/overflow:hidden/);
  assert.match(css,/overflow-y:auto/);
});
test('larger type is applied to menu controls and chess sidebar',()=>{
  assert.match(css,/\.menu-form \.select-field\{height:49px;font-size:15px/);
  assert.match(css,/\.side-panel \.move-token\{font-size:16px/);
  assert.match(css,/\.side-panel \.file-action\{font-size:14px/);
  assert.match(css,/\.arena \.clock-display\{font-size:21px/);
});
test('responsive menu keeps stable dimensions on tablets and phones',()=>{
  assert.match(css,/@media\(max-width:1050px\)/);
  assert.match(css,/height:calc\(100dvh - 24px\)/);
  assert.match(css,/@media\(max-width:740px\)/);
  assert.match(css,/height:calc\(100dvh - 14px\)/);
});
