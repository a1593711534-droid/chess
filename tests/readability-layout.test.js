import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../styles/readability.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const boot=readFileSync(new URL('../src/ui/boot.js',import.meta.url),'utf8');

test('readability styles load last and use a new cache version',()=>{
  const all=[...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(x=>x[1]);
  assert.match(all.at(-1),/readability\.css\?v=2\.3\.1/);
  assert.match(boot,/APP_VERSION='2\.3\.1'/);
  assert.match(html,/data-app-version="2\.3\.1"/);
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
