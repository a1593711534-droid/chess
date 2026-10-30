/* Offline support for the static, same-origin Chess Atelier GitHub Pages app. */
const SHELL_CACHE='chess-atelier-shell-2.3.9-rav-review';
const ENGINE_CACHE='chess-atelier-stockfish-19.0.1';
const PREFIX='chess-atelier-';
const SHELL_FILES=[
  '', 'index.html',
  'styles/base.css','styles/layout.css','styles/board.css','styles/mobile.css',
  'styles/pro.css','styles/viewport.css','styles/main-menu.css','styles/readability.css','styles/focus.css','styles/experience.css',
  'src/main.js','src/chess/clock.js','src/chess/engine.js','src/chess/fallback.js',
  'src/chess/notation.js','src/chess/game-review.js','src/chess/session.js','src/chess/history-index.js','src/chess/time-management.js',
  'src/data/openings.js','src/data/puzzles.js',
  'src/study/studybook.js','src/study/pgn-import.js','src/study/pgn-variation.js','src/study/training.js',
  'src/ui/board.js','src/ui/boot.js','src/ui/toast.js','src/ui/evaluation.js','src/ui/notation-view.js','src/ui/library-panels.js',
  'src/utils/icons.js','src/utils/preferences.js','src/utils/sound.js',
  'vendor/chess.js','vendor/stockfish-19-single.js','assets/favicon.svg',
  ...['w','b'].flatMap(color=>['B','K','N','P','Q','R'].map(type=>`assets/pieces/${color}${type}.svg`)),
];
const shellUrls=new Set(SHELL_FILES.map(path=>new URL(path,self.registration.scope).href));
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(SHELL_CACHE).then(cache=>cache.addAll([...shellUrls])).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for(const name of await caches.keys()){
      if(name.startsWith(PREFIX)&&name!==SHELL_CACHE&&name!==ENGINE_CACHE)await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
async function getWithOfflineFallback(request,cacheName,preferCache=false){
  const cache=await caches.open(cacheName);
  if(preferCache){
    const cached=await cache.match(request,{ignoreSearch:true});
    if(cached)return cached;
  }
  try{
    const response=await fetch(request);
    if(response.ok)cache.put(request,response.clone()).catch(()=>{/* Storage quota can be exhausted. */});
    return response;
  }catch(error){
    const cached=await cache.match(request,{ignoreSearch:true});
    if(cached)return cached;
    throw error;
  }
}
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url),scope=new URL(self.registration.scope);
  if(url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
  const isWasm=url.pathname.endsWith('/vendor/stockfish-19-single.wasm');
  if(isWasm){
    // ~99 MB: downloaded once when needed; reuse when available, without blocking SW install.
    event.respondWith(getWithOfflineFallback(request,ENGINE_CACHE,true));
    return;
  }
  // Network-first keeps deployments fresh; precached files remain available offline.
  if(shellUrls.has(new URL(url.pathname,scope.origin).href)){
    event.respondWith(getWithOfflineFallback(request,SHELL_CACHE,false));
  }
});
