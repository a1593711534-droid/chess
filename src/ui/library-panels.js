import {OPENINGS,openingFor,continuations} from '../data/openings.js';
import {PUZZLES,readTrainingStats} from '../data/puzzles.js';

/** Render expensive libraries only while the matching tab is visible.
 * No virtual DOM or framework required; refresh on opening a tab and on moves.
 */
export function renderOpeningLibrary($,{history,filter='all',startExercise}){
  const found=openingFor(history),next=continuations(history);
  $('opening-detected').textContent=found?`${found.eco} · ${found.name}`:history.length?(next.length?'尚未確定開局 · 繼續走棋以辨識':'目前路線不在精選庫中'):`標準起始局面 · ${OPENINGS.length} 條精選路線`;
  const cand=$('opening-candidates'),fragment=document.createDocumentFragment();
  for(const option of next.slice(0,8)){
    const item=document.createElement('div');item.className='candidate-item';
    const label=document.createElement('strong');label.textContent=option.san;
    const detail=document.createElement('small');detail.textContent=option.lines.slice(0,2).map(x=>x.name).join(' · ');
    item.append(label,detail);fragment.append(item);
  }
  if(!next.length){const msg=document.createElement('small');msg.className='muted-placeholder';msg.textContent='精選路線在此沒有更多續著。';fragment.append(msg);}
  cand.replaceChildren(fragment);
  const library=$('opening-library'),cards=document.createDocumentFragment();
  const filtered=OPENINGS.filter(o=>filter==='all'||(filter==='other'?!['e4','d4'].includes(o.moves[0]):o.moves[0]===filter));
  for(const row of filtered){
    const el=document.createElement('button');el.className='library-card';el.type='button';
    const top=document.createElement('span');top.className='library-top';const eco=document.createElement('b');eco.textContent=row.eco;const name=document.createElement('strong');name.textContent=row.name;top.append(eco,name);
    const moves=document.createElement('small');moves.textContent=row.moves.map((m,i)=>(i%2===0?`${Math.floor(i/2)+1}. `:'')+m).join(' ').slice(0,110);
    const action=document.createElement('em');action.textContent='練習此路線  ↗';el.append(top,moves,action);
    el.onclick=()=>startExercise(row);cards.append(el);
  }
  library.replaceChildren(cards);
}

export function renderPuzzleLibrary($,{training,filter='全部',startExercise}){
  const stats=readTrainingStats(),solved=Object.values(stats).filter(x=>x?.solved).length;
  $('solved-count').textContent=`${solved} / ${PUZZLES.length}`;
  $('training-active').classList.toggle('hidden',!training);
  if(training){
    $('training-label').textContent=training.exercise.category.toUpperCase();$('training-name').textContent=training.exercise.title;
    $('training-goal').textContent=training.solved?'✅ 練習完成。可以再練一次或選擇下一題。':training.exercise.goal;
    $('training-step').textContent=`進度 ${training.progress}`;$('training-errors').textContent=`嘗試錯誤 ${training.errors}`;
  }
  const cards=document.createDocumentFragment();
  for(const p of PUZZLES.filter(x=>filter==='全部'||x.category===filter)){
    const b=document.createElement('button');b.className='library-card puzzle-card';b.type='button';
    const top=document.createElement('span');top.className='library-top';const star=document.createElement('b');star.textContent=stats[p.id]?.solved?'✓':`★${p.rating}`;const title=document.createElement('strong');title.textContent=p.title;top.append(star,title);
    const desc=document.createElement('small');desc.textContent=`${p.category} · ${p.goal}`;b.append(top,desc);
    b.onclick=()=>startExercise(p);cards.append(b);
  }
  $('puzzle-library').replaceChildren(cards);
}
