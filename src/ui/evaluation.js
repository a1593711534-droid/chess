import {scoreWhite} from '../chess/notation.js';

/** All evaluation scores in the UI use White's perspective, even when Black is to move. */
export function describeEvaluation(info,turn){
  if(!info||(info.cp==null&&info.mate==null))return '尚無有效的引擎評分';
  const {text}=scoreWhite(info,turn);
  if(info.mate!=null){
    const signed=Number(info.mate)*(turn==='w'?1:-1);
    if(!signed)return '已達將死局面';
    return `${signed>0?'白方':'黑方'}有將死路線（白方視角 ${text}）`;
  }
  const whiteCp=Number(info.cp)*(turn==='w'?1:-1);
  if(Math.abs(whiteCp)<15)return `局面接近均勢（白方視角 ${text}）`;
  return `${whiteCp>0?'白方':'黑方'}較有優勢（白方視角 ${text}）`;
}
