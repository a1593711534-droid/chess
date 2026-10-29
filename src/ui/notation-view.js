/** Chess notation DOM renderer. Never re-create move buttons when the main
 * line and cursor have not changed (e.g. clock ticks, analysis info, toasts). */
export function createNotationView($,onNavigate){
  const element=$('moves-list');
  let lastSession=null,lastRevision=-1,lastCursor=-1;
  return function renderMoveHistory(session){
    const moves=session.moves,revision=session.historyIndex.revision,cursor=session.cursor;
    $('moves-count').textContent=`${moves.length} PLIES`;
    $('position-indicator').textContent=cursor===0?'起始位置':`${cursor} / ${moves.length}`;
    for(const [button,disabled] of [['nav-start',cursor===0],['nav-prev',cursor===0],['nav-next',cursor===moves.length],['nav-end',cursor===moves.length]])$(button).disabled=disabled;
    if(lastSession===session&&lastRevision===revision&&lastCursor===cursor)return;
    lastSession=session;lastRevision=revision;lastCursor=cursor;
    const previous=element.querySelector('.move-token.current')?.dataset.ply;
    if(!moves.length){
      element.innerHTML='<div class="empty-state"><span class="empty-mark">♞</span><strong>棋局尚未開始</strong><small>每一步精彩著法，將在此完整記錄。</small></div>';
      return;
    }
    const fragment=document.createDocumentFragment();
    const fenParts=session.initialFen.split(' ');
    const firstPly=(Math.max(1,Number(fenParts[5])||1)-1)*2+(fenParts[1]==='b'?1:0);
    for(let i=0;i<moves.length;){
      const blackFirst=(firstPly+i)%2===1;
      const row=document.createElement('div');row.className='move-row';
      const num=document.createElement('span');num.className='move-number';num.textContent=`${Math.floor((firstPly+i)/2)+1}${blackFirst?'...':'.'}`;row.append(num);
      if(blackFirst){const spacer=document.createElement('span');spacer.setAttribute('aria-hidden','true');row.append(spacer);}
      for(const j of (blackFirst?[i]:[i,i+1])){
        if(j>=moves.length)break;
        const button=document.createElement('button');button.type='button';button.className='move-token'+(cursor===j+1?' current':'');
        button.dataset.ply=String(j+1);button.textContent=moves[j].san;button.title=`查看第 ${j+1} 步`;
        button.onclick=()=>onNavigate(j+1);row.append(button);
      }
      fragment.append(row);i+=blackFirst?1:2;
    }
    element.replaceChildren(fragment);
    if(String(cursor)!==previous)element.querySelector('.move-token.current')?.scrollIntoView({block:'nearest'});
  };
}
