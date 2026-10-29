import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const css = readFileSync(new URL('styles/viewport.css', root), 'utf8');
test('viewport stylesheet is loaded after all legacy styles', () => {
  assert.match(html, /styles\/viewport\.css\?v=layout-20261029/);
  assert.ok(html.indexOf('styles/viewport.css') > html.indexOf('styles/pro.css'));
});
test('large screens use a viewport-height-based square board and panels fill the side space', () => {
  assert.match(css, /--atelier-board:min\(900px,calc\(100dvh - 145px\)\)/);
  assert.match(css, /grid-template-columns:minmax\(235px,1fr\) minmax\(0,var\(--atelier-board\)\) minmax\(265px,1fr\)/);
  assert.match(css, /\.arena-footbar\{display:none\}/);
});
test('tablet and mobile layouts remain independently configurable', () => {
  assert.match(css, /max-width:1150px/);
  assert.match(css, /max-width:740px/);
});
