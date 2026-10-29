import {Chess} from '../../vendor/chess.js';
export function moveToUci(m){return `${m.from}${m.to}${m.promotion||''}`;}
export function pvToSan(fen,pv){
  if(!pv?.length)return '—';const game=new Chess(fen),result=[];
  for(const uci of pv.slice(0,10)){
    try{const fullMove=Number(game.fen().split(' ')[5])||1;
      const m=game.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]||'q'});if(!m)break;
      if(m.color==='w')result.push(`${fullMove}. ${m.san}`);
      else if(result.length&&/\d+\. [^.]*/.test(result.at(-1)))result[result.length-1]+=` ${m.san}`;
      else result.push(`${fullMove}... ${m.san}`);
    }catch{break;}
  }
  return result.join('  ')||'—';
}
export function scoreWhite(info,turn){
  const sign=turn==='w'?1:-1;
  if(info.mate!=null)return {text:`${info.mate*sign>0?'+':'−'}M${Math.abs(info.mate)}`,ratio:info.mate*sign>0?96:4};
  if(info.cp==null)return {text:'—',ratio:50};
  const evalWhite=info.cp*sign/100;
  return {text:`${evalWhite>=0?'+':'−'}${Math.abs(evalWhite).toFixed(2)}`,ratio:Math.min(96,Math.max(4,50+Math.atan(evalWhite/2)*32))};
}
