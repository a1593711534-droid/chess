import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {APP_VERSION,REQUIRED_IDS,inspectUi} from '../src/ui/boot.js';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
const literalRefs=[...js.matchAll(/\$\(['"]([^'"]+)['"]\)/g)].map(m=>m[1]);

test('all 105 referenced UI elements exist in distributed HTML',()=>{
  for(const id of literalRefs)assert.ok(ids.has(id),`missing ${id}`);
  for(const id of literalRefs)assert.ok(REQUIRED_IDS.includes(id),`UI contract does not include ${id}`);
  assert.equal(new Set(literalRefs).size,105);
});
test('the release marker and imported script refer to the same version',()=>{
  assert.match(html,new RegExp(`data-app-version="${APP_VERSION.replaceAll('.','\\.')}"`));
  assert.ok(html.includes(`./src/main.js?v=${APP_VERSION}`));
});
test('startup contract detects older HTML before attaching handlers',()=>{
  const document={documentElement:{dataset:{appVersion:'2.0.0'}}};
  assert.deepEqual(inspectUi(document),{ok:false,reason:'version',version:'2.0.0',missing:[]});
});
test('startup contract detects critical missing elements',()=>{
  const doc={documentElement:{dataset:{appVersion:APP_VERSION}},getElementById:id=>ids.has(id)&&id!=='analyze-btn'?{}:null,querySelector:()=>null};
  const check=inspectUi(doc);
  assert.equal(check.ok,false);
  assert.deepEqual(check.missing,['analyze-btn']);
});
