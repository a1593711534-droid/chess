const PIECES={w:{k:'K',q:'Q',r:'R',b:'B',n:'N',p:'P'},b:{k:'K',q:'Q',r:'R',b:'B',n:'N',p:'P'}};
export const pieceSrc=(type,color)=>`./assets/pieces/${color}${PIECES[color][type]}.svg`;
const displayName={k:'國王',q:'皇后',r:'城堡',b:'主教',n:'騎士',p:'兵'};
export function createBoard(container,onMove,onSelect,onAnnotate){
  let selected=null,reverse=false,possible=[],hint=null,view=null,locked=false,dragging=null,marks=[],markStart=null;
  function setSelection(square){selected=square;possible=square&&view?view.moves({square,verbose:true}).map(m=>m.to):[];onSelect?.(square);render();}
  function selectSquare(square){
    if(locked||!view)return;
    const piece=view.get(square);
    if(selected&&possible.includes(square)){
      const from=selected;selected=null;possible=[];onMove(from,square);return;
    }
    if(piece&&piece.color===view.turn()){setSelection(selected===square?null:square);}else if(selected){setSelection(null);}
  }
  function render(){
    if(!view)return;
    container.innerHTML='';
    const files=reverse?'hgfedcba':'abcdefgh',ranks=reverse?'12345678':'87654321';
    const last=view.history({verbose:true}).at(-1);
    const check=view.isCheck()?view.board().flat().find(p=>p?.type==='k'&&p.color===view.turn())?.square:null;
    const fragment=document.createDocumentFragment();
    for(let r=0;r<8;r++)for(let c=0;c<8;c++){
      const sq=`${files[c]}${ranks[r]}`,p=view.get(sq);
      const button=document.createElement('button');button.type='button';button.dataset.square=sq;
      button.className=`square ${(r+c)%2===0?'light':'dark'}`;
      if(sq===selected)button.classList.add('selected');
      if(last&&(sq===last.from||sq===last.to))button.classList.add('last-move');
      if(sq===check)button.classList.add('in-check');
      if(hint&&(sq===hint.from||sq===hint.to))button.classList.add(sq===hint.from?'hint-from':'hint-to');
      if(possible.includes(sq))button.classList.add('possible');
      if(p&&possible.includes(sq))button.classList.add('occupied');
      button.setAttribute('role','gridcell');button.setAttribute('aria-label',`${sq}${p?` ${p.color==='w'?'白方':'黑方'}${displayName[p.type]}`:''}`);
      if(p){const image=document.createElement('img');image.className='piece-image';image.alt='';image.draggable=!locked&&p.color===view.turn();image.src=pieceSrc(p.type,p.color);
        image.addEventListener('dragstart',e=>{if(locked||p.color!==view.turn()){e.preventDefault();return;}dragging=sq;setSelection(sq);e.dataTransfer.setData('text/plain',sq);e.dataTransfer.effectAllowed='move';});
        image.addEventListener('dragend',()=>{dragging=null;container.querySelectorAll('.drag-target').forEach(el=>el.classList.remove('drag-target'));});button.append(image);
      }
      if(c===0){const rank=document.createElement('span');rank.className='coord rank';rank.textContent=ranks[r];button.append(rank);}
      if(r===7){const file=document.createElement('span');file.className='coord file';file.textContent=files[c];button.append(file);}
      button.addEventListener('click',()=>selectSquare(sq));
      button.addEventListener('contextmenu',e=>e.preventDefault());
      button.addEventListener('pointerdown',e=>{if(e.button===2)markStart=sq;});
      button.addEventListener('pointerup',e=>{if(e.button===2&&markStart){onAnnotate?.(markStart,sq);markStart=null;}});
      button.addEventListener('dragover',e=>{if(!locked&&dragging&&possible.includes(sq)){e.preventDefault();e.dataTransfer.dropEffect='move';button.classList.add('drag-target');}});
      button.addEventListener('dragleave',()=>button.classList.remove('drag-target'));
      button.addEventListener('drop',e=>{e.preventDefault();button.classList.remove('drag-target');if(!locked&&dragging){const from=dragging;dragging=null;if(from&&possible.includes(sq)){selected=null;possible=[];onMove(from,sq);}else setSelection(null);}});
      fragment.append(button);
    }
    container.append(fragment);
    const overlay=document.createElementNS('http://www.w3.org/2000/svg','svg');
    overlay.setAttribute('viewBox','0 0 800 800');overlay.classList.add('board-annotations');overlay.setAttribute('aria-hidden','true');
    const toXY=s=>{const f='abcdefgh'.indexOf(s[0]),rank=Number(s[1])-1;return {x:(reverse?7-f:f)*100+50,y:(reverse?rank:7-rank)*100+50};};
    const mk=(tag,attrs)=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));return e;};
    const defs=mk('defs',{}),arrow=mk('marker',{id:'study-arrow',markerWidth:6,markerHeight:6,refX:5,refY:3,orient:'auto',markerUnits:'strokeWidth'});
    arrow.append(mk('path',{d:'M0 0 L6 3 L0 6 Z',fill:'#f0bd45'}));defs.append(arrow);overlay.append(defs);
    for(const mark of marks){if(!/^[a-h][1-8]$/.test(mark.from)||!/^[a-h][1-8]$/.test(mark.to))continue;
      const a=toXY(mark.from),b=toXY(mark.to);
      if(mark.from===mark.to)overlay.append(mk('circle',{cx:a.x,cy:a.y,r:37,fill:'none',stroke:'#f0bd45','stroke-width':11,opacity:.92}));
      else{const vx=b.x-a.x,vy=b.y-a.y,len=Math.hypot(vx,vy),end=28;overlay.append(mk('line',{x1:a.x,y1:a.y,x2:b.x-vx/len*end,y2:b.y-vy/len*end,stroke:'#f0bd45','stroke-width':13,'stroke-linecap':'round',opacity:.83,'marker-end':'url(#study-arrow)'}));}
    }
    container.append(overlay);
  }
  return {
    update(game,{flipped=false,disabled=false,lastHint=null,annotations=[]}={}){view=game;reverse=flipped;locked=disabled;hint=lastHint;marks=annotations;selected=null;possible=[];render();},
    flip(){reverse=!reverse;render();},
    clearHint(){hint=null;render();},
    render,
  };
}
