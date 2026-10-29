#!/usr/bin/env python3
"""Real Stockfish 19 browser Worker/WASM test, not a synthetic UCI fake.
CI downloads a pinned SHA-256-verified WASM to vendor/ before invoking this.
"""
import subprocess,sys,time,urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
WASM=ROOT/'vendor'/'stockfish-19-single.wasm'
assert WASM.exists() and WASM.stat().st_size==99169054, 'Verified real Stockfish WASM is required'
server=subprocess.Popen([sys.executable,'-m','http.server','8991','--bind','127.0.0.1'],cwd=ROOT,
    stdout=subprocess.DEVNULL,stderr=subprocess.STDOUT)
try:
    for _ in range(100):
        try:
            urllib.request.urlopen('http://127.0.0.1:8991/',timeout=1).read(8)
            break
        except Exception:
            time.sleep(.1)
    else:raise AssertionError('Real Worker test HTTP server never started')
    with sync_playwright() as p:
        chromium=Path('/usr/bin/chromium')
        browser=p.chromium.launch(headless=True,executable_path=str(chromium) if chromium.exists() else None,
            args=['--no-sandbox','--disable-dev-shm-usage'])
        page=browser.new_page()
        errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
        page.goto('http://127.0.0.1:8991/',wait_until='domcontentloaded')
        page.evaluate("""() => {
          window.realEngineFinished=false;
          (async()=>{
            let engine;
            try{
              const {EngineClient}=await import('/src/chess/engine.js');
              const {Chess}=await import('/vendor/chess.js');
              const states=[],lines=[],position=new Chess();
              engine=new EngineClient((state,error)=>states.push(state+(error?':'+error.message:'')));
              const best=await engine.search(position.fen(),{
                depth:8,multiPV:3,skill:20,onInfo:info=>lines.push(info)
              });
              const legal=position.moves({verbose:true}).some(move=>
                move.from+move.to+(move.promotion||'')===best);
              const multipv=[...new Set(lines.map(line=>line.multiPV))];
              const withPV=lines.filter(info=>info.depth>=1&&info.pv.length>0).length;
              window.realEngineResult={best,legal,multipv,withPV,states,
                sawReady:states.includes('ready'),sawThinking:states.includes('thinking')};
            }catch(error){window.realEngineResult={error:String(error),stack:error?.stack};}
            finally{engine?.worker?.terminate();window.realEngineFinished=true;}
          })();
        }""")
        page.wait_for_function('window.realEngineFinished===true',timeout=150000)
        data=page.evaluate('window.realEngineResult')
        print('REAL STOCKFISH WORKER:',data,flush=True)
        assert 'error' not in data,data
        assert data['sawReady'] and data['sawThinking'],data
        assert data['legal'] and len(data['best'])>=4,data
        assert data['withPV']>0,'No actual UCI info / PV from real WASM'
        assert 1 in data['multipv'],data
        assert len(data['multipv'])>=2,('MultiPV failed on real Stockfish',data)
        assert not errors,errors
        browser.close()
finally:
    server.terminate()
    try:server.wait(timeout=3)
    except subprocess.TimeoutExpired:server.kill()
