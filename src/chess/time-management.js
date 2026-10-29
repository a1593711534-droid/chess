/** Stockfish play-time configuration; distinct from the chess clock and skill level. */
export const AI_TIME_MODES=Object.freeze({adaptive:'智能分配',fixed:'固定每步'});
export const AI_THINK_OPTIONS=Object.freeze([250,500,1000,2000,4000,8000,15000,30000]);
export const DEFAULT_THINK_MS=2000;
export function normalizeThinkMs(value){
  const n=Number(value);
  return Number.isFinite(n)&&n>=100&&n<=30000?Math.trunc(n):DEFAULT_THINK_MS;
}
/** Missing mode in old saved games means the original fixed movetime behavior. */
export function normalizeAiTimeMode(mode){return mode==='adaptive'?'adaptive':'fixed';}
export function selectAiSearch(config,clock){
  const movetime=normalizeThinkMs(config.aiThink);
  if(normalizeAiTimeMode(config.aiTimeMode)!=='adaptive'||!clock?.enabled)return {movetime};
  // snapshot() accounts for time spent since the last UI clock tick.
  const snapshot=clock.snapshot();
  if(snapshot.timeout||snapshot.remaining.w<=0||snapshot.remaining.b<=0)return null;
  const toMs=value=>Math.max(1,Math.trunc(value));
  return {clock:{wtime:toMs(snapshot.remaining.w),btime:toMs(snapshot.remaining.b),
    winc:Math.max(0,Math.trunc(clock.increment)),binc:Math.max(0,Math.trunc(clock.increment))}};
}
export function describeAiTime(config,clock){
  if(normalizeAiTimeMode(config.aiTimeMode)==='adaptive'&&clock?.enabled)return '智能時間分配';
  const time=normalizeThinkMs(config.aiThink)/1000;
  return clock?.enabled?`固定每步約 ${time} 秒`:`不限時 · 每步約 ${time} 秒`;
}
