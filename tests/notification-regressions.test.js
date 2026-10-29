import test from 'node:test';
import assert from 'node:assert/strict';
import {toast} from '../src/ui/toast.js';

function rootMock(){
 const root={children:[],get childElementCount(){return this.children.length;},get firstElementChild(){return this.children[0];},appendChild(item){this.children.push(item);item.remove=()=>{const n=this.children.indexOf(item);if(n>=0)this.children.splice(n,1);};}};
 return root;
}

test('repeated timeout notification is de-duplicated and queue is bounded to three',()=>{
 const before=globalThis.document;
 const root=rootMock();
 globalThis.document={getElementById:()=>root,createElement:()=>({className:'',dataset:{},textContent:'',setAttribute(){}})};
 try{
  for(let i=0;i<50;i++)toast('黑方勝利 · 時間用盡','info');
  assert.equal(root.childElementCount,1);
  for(let i=0;i<5;i++)toast(`不同事件 ${i}`,'info');
  assert.equal(root.childElementCount,3);
  assert.deepEqual(root.children.map(x=>x.textContent),['不同事件 2','不同事件 3','不同事件 4']);
 }finally{globalThis.document=before;}
});

test('sound module never creates AudioContext before trusted player gesture',async()=>{
 const priorDoc=globalThis.document,priorWin=globalThis.window;
 const handlers=new Map();let constructions=0;
 globalThis.document={
   addEventListener(name,callback){handlers.set(name,callback);},removeEventListener(name){handlers.delete(name);}
 };
 class FakeContext{
  constructor(){constructions++;this.state='running';this.currentTime=2;this.destination={};}
  createOscillator(){return {type:'',frequency:{setValueAtTime(){}},connect(){},start(){},stop(){}};}
  createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}};}
 }
 globalThis.window={AudioContext:FakeContext};
 try{
  const {playSound}=await import('../src/utils/sound.js?regression='+Date.now());
  playSound('end',true);assert.equal(constructions,0);
  handlers.get('pointerdown')({isTrusted:false});
  playSound('end',true);assert.equal(constructions,0);
  handlers.get('pointerdown')({isTrusted:true});
  playSound('end',true);assert.equal(constructions,1);
  playSound('move',false);assert.equal(constructions,1);
 }finally{globalThis.document=priorDoc;globalThis.window=priorWin;}
});
