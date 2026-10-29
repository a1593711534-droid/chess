const PIECES={w:{k:'K',q:'Q',r:'R',b:'B',n:'N',p:'P'},b:{k:'K',q:'Q',r:'R',b:'B',n:'N',p:'P'}};
export const pieceSrc=(type,color)=>`./assets/pieces/${color}${PIECES[color][type]}.svg`;
const displayName={k:'國王',q:'皇后',r:'城堡',b:'主教',n:'騎士',p:'兵'};
export function createBoard(container,onMove,onSelect,onAnnotate,onStatus){
  let selected=null,reverse=false,possible=[],hint=null,view=null,locked=false,dragging=null,marks=[],markStart=null,annotationMode=false;
  // Keep square/image nodes mounted; full-board replacement flashes on some devices.
  const cells=[];let annotationsKey=null;
  function announce(message){onStatus?.(message);}
  function setSelection(square){
    selected=square;possible=square&&view?view.moves({square,verbose:true}).map(m=>m.to):[];
    onSelect?.(square);
    if(square){
      const p=view.get(square);
      announce(`已選取 ${square} ${p?.color==='w'?'白方':'黑方'}${displayName[p?.type]||'棋子'}。${possible.length?'合法落點：'+possible.join('、'):'沒有合法落點'}。`);
    }else announce('已取消選取棋子。');
    render();
  }
  function selectSquare(square){
    if(!view)return;
    // Annotations must remain available when the history board is read-only.
    if(annotationMode){
      if(markStart){
        const from=markStart;markStart=null;onAnnotate?.(from,square);
        announce(from===square?`已切換 ${square} 的圓圈標記。`:`已切換 ${from} 到 ${square} 的箭頭標記。`);
      }else{
        markStart=square;
        announce(`標記起點 ${square} 已選取。再點選一格畫箭頭、再次點選原格畫圓圈，或按 Escape 取消。`);
      }
      render();
      return;
    }
    if(locked)return;
    const piece=view.get(square);
    if(selected&&possible.includes(square)){
      const from=selected;selected=null;possible=[];onMove(from,square);return;
    }
    if(piece&&piece.color===view.turn()){setSelection(selected===square?null:square);}else if(selected){setSelection(null);}
  }
  function render(){
    if(!view)return;
    const focusedSquare=container.contains(document.activeElement)?document.activeElement.closest('[data-square]')?.dataset.square:null;
    const files=reverse?'hgfedcba':'abcdefgh',ranks=reverse?'12345678':'87654321';
    const last=view.history({verbose:true}).at(-1);
    const check=view.isCheck()?view.board().flat().find(p=>p?.type==='k'&&p.color===view.turn())?.square:null;
    const fragment=document.createDocumentFragment();
    for(let r=0;r<8;r++)for(let c=0;c<8;c++){
      const sq=`${files[c]}${ranks[r]}`,p=view.get(sq);
      const isNew=!cells[r*8+c];
      const button=cells[r*8+c]||document.createElement('button');
      if(isNew){cells[r*8+c]=button;button.type='button';}
      button.dataset.square=sq;
      button.className=`square ${(r+c)%2===0?'light':'dark'}`;
      if(sq===selected)button.classList.add('selected');
      if(annotationMode&&sq===markStart)button.classList.add('annotation-start');
      if(last&&(sq===last.from||sq===last.to))button.classList.add('last-move');
      if(sq===check)button.classList.add('in-check');
      if(hint&&(sq===hint.from||sq===hint.to))button.classList.add(sq===hint.from?'hint-from':'hint-to');
      if(possible.includes(sq))button.classList.add('possible');
      if(p&&possible.includes(sq))button.classList.add('occupied');
      button.tabIndex=(focusedSquare||selected||(reverse?'e8':'e1'))===sq?0:-1;
      const details=[sq,p?`${p.color==='w'?'白方':'黑方'}${displayName[p.type]}`:'空格'];
      if(sq===selected)details.push('已選取');
      if(possible.includes(sq))details.push('合法落點');
      if(annotationMode&&sq===markStart)details.push('標記起點');
      if(sq===check)details.push('被將軍');
      button.setAttribute('aria-label',details.join('，'));
      button.setAttribute('aria-pressed',String(sq===selected||(annotationMode&&sq===markStart)));
      // Keep the same image node when a piece has not changed.
      let image=button.querySelector('img.piece-image');
      if(p){
        if(!image){image=document.createElement('img');image.className='piece-image';image.alt='';button.prepend(image);}
        image.draggable=!annotationMode&&!locked&&p.color===view.turn();
        const src=pieceSrc(p.type,p.color);
        if(image.getAttribute('src')!==src)image.src=src;
        image.ondragstart=e=>{if(annotationMode||locked||p.color!==view.turn()){e.preventDefault();return;}dragging=sq;selected=sq;possible=view.moves({square:sq,verbose:true}).map(m=>m.to);
          onSelect?.(sq);button.classList.add('selected');
          for(const dest of possible)container.querySelector(`[data-square="${dest}"]`)?.classList.add('possible');
          e.dataTransfer.setData('text/plain',sq);e.dataTransfer.effectAllowed='move';};
        image.ondragend=()=>{const abandoned=!!dragging;dragging=null;
          container.querySelectorAll('.drag-target').forEach(el=>el.classList.remove('drag-target'));
          if(abandoned)setSelection(null);};
      }else image?.remove();
      if(c===0){let rank=button.querySelector('.coord.rank');if(!rank){rank=document.createElement('span');rank.className='coord rank';button.append(rank);}if(rank.textContent!==ranks[r])rank.textContent=ranks[r];}
      if(r===7){let file=button.querySelector('.coord.file');if(!file){file=document.createElement('span');file.className='coord file';button.append(file);}if(file.textContent!==files[c])file.textContent=files[c];}
      // Reassign handlers instead of stacking listeners on every render.
      button.onclick=()=>selectSquare(sq);
      button.onkeydown=event=>{
        if(event.key==='Escape'&&(selected||markStart)){
          event.preventDefault();event.stopPropagation();
          selected=null;possible=[];markStart=null;
          announce('已取消棋盤選取或標記起點。');render();return;
        }
        const delta={ArrowLeft:[0,-1],ArrowRight:[0,1],ArrowUp:[-1,0],ArrowDown:[1,0]}[event.key];
        if(!delta)return;
        event.preventDefault();const nr=r+delta[0],nc=c+delta[1];
        if(nr<0||nr>=8||nc<0||nc>=8)return;
        const target=container.querySelector(`[data-square="${files[nc]}${ranks[nr]}"]`);
        container.querySelectorAll('.square').forEach(el=>{el.tabIndex=-1;});
        if(target){target.tabIndex=0;target.focus();}
      };
      button.oncontextmenu=e=>e.preventDefault();
      button.onpointerdown=e=>{if(e.button===2)markStart=sq;};
      button.onpointerup=e=>{if(e.button===2&&markStart){
        const from=markStart;markStart=null;onAnnotate?.(from,sq);
        announce(`已切換 ${from} 到 ${sq} 的標記。`);
      }};
      button.ondragover=e=>{if(!annotationMode&&!locked&&dragging&&possible.includes(sq)){e.preventDefault();e.dataTransfer.dropEffect='move';button.classList.add('drag-target');}};
      button.ondragleave=()=>button.classList.remove('drag-target');
      button.ondrop=e=>{e.preventDefault();button.classList.remove('drag-target');if(!annotationMode&&!locked&&dragging){const from=dragging;dragging=null;if(from&&possible.includes(sq)){selected=null;possible=[];onMove(from,sq);}else setSelection(null);}};
      if(isNew) fragment.append(button);
    }
    if(fragment.childNodes.length)container.append(fragment);
    const overlay=container.querySelector('svg.board-annotations')||document.createElementNS('http://www.w3.org/2000/svg','svg');
    overlay.setAttribute('viewBox','0 0 800 800');overlay.classList.add('board-annotations');overlay.setAttribute('aria-hidden','true');
    const nextAnnotationsKey=JSON.stringify([reverse,marks]);
    if(annotationsKey!==nextAnnotationsKey){
      annotationsKey=nextAnnotationsKey;overlay.replaceChildren();
    const toXY=s=>{const f='abcdefgh'.indexOf(s[0]),rank=Number(s[1])-1;return {x:(reverse?7-f:f)*100+50,y:(reverse?rank:7-rank)*100+50};};
    const mk=(tag,attrs)=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));return e;};
    const defs=mk('defs',{}),arrow=mk('marker',{id:'study-arrow',markerWidth:6,markerHeight:6,refX:5,refY:3,orient:'auto',markerUnits:'strokeWidth'});
    arrow.append(mk('path',{d:'M0 0 L6 3 L0 6 Z',fill:'#f0bd45'}));defs.append(arrow);overlay.append(defs);
    for(const mark of marks){if(!/^[a-h][1-8]$/.test(mark.from)||!/^[a-h][1-8]$/.test(mark.to))continue;
      const a=toXY(mark.from),b=toXY(mark.to);
      if(mark.from===mark.to)overlay.append(mk('circle',{cx:a.x,cy:a.y,r:37,fill:'none',stroke:'#f0bd45','stroke-width':11,opacity:.92}));
      else{const vx=b.x-a.x,vy=b.y-a.y,len=Math.hypot(vx,vy),end=28;overlay.append(mk('line',{x1:a.x,y1:a.y,x2:b.x-vx/len*end,y2:b.y-vy/len*end,stroke:'#f0bd45','stroke-width':13,'stroke-linecap':'round',opacity:.83,'marker-end':'url(#study-arrow)'}));}
    }
    }
    if(!overlay.isConnected)container.append(overlay);
    if(focusedSquare)container.querySelector(`[data-square="${focusedSquare}"]`)?.focus({preventScroll:true});
  }
  return {
    update(game,{flipped=false,disabled=false,lastHint=null,annotations=[]}={}){view=game;reverse=flipped;locked=disabled;hint=lastHint;marks=annotations;selected=null;possible=[];render();},
    flip(){reverse=!reverse;render();},
    clearHint(){hint=null;render();},
    setAnnotationMode(enabled){
      annotationMode=!!enabled;markStart=null;selected=null;possible=[];
      announce(annotationMode?'標記模式開啟。先選起點，再選終點；同格可畫圓圈。按 Escape 可取消。':'標記模式已關閉。');
      render();
    },
    cancelPending(){if(!selected&&!markStart)return false;selected=null;markStart=null;possible=[];announce('已取消棋盤選取。');render();return true;},
    render,
  };
}
