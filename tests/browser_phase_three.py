#!/usr/bin/env python3
"""End-to-end PGN import and complete local Stockfish game review."""
import subprocess,sys,time,urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
HOST='http://127.0.0.1:8994/'
proc=subprocess.Popen([sys.executable,'-m','http.server','8994','--bind','127.0.0.1'],
  cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.STDOUT)
try:
  for _ in range(100):
    try:urllib.request.urlopen(HOST,timeout=1).read(1);break
    except Exception:time.sleep(.1)
  else:raise AssertionError('Browser server unavailable')
  with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    ctx=browser.new_context(viewport={'width':1440,'height':900},accept_downloads=True)
    page=ctx.new_page();errors=[]
    page.on('pageerror',lambda err:errors.append(str(err)))
    page.goto(HOST,wait_until='domcontentloaded')
    page.locator('[data-mode="local"]').click()
    page.locator('#time-select').select_option('none')
    page.locator('#new-game').click()
    page.locator('#focus-open-study').click()
    page.locator('#import-pgn').click()
    sample='[Event "RAV Regression"]\n[Result "*"]\n\n1.e4! {Centre control} e5 (1...c5 $5 {Sicilian} 2.Nf3 (2.d4)) 2.Nf3 *'
    page.locator('#pgn-input').fill(sample)
    page.locator('#import-confirm').click()
    assert page.locator('#moves-count').inner_text()=='3 PLIES'
    assert page.locator('.variation-item').count()==2
    with page.expect_download() as export_info:
      page.locator('#export-btn').click()
    exported=Path(export_info.value.path()).read_text(encoding='utf-8')
    assert '(1... c5 $5 {Sicilian} 2. Nf3 (2. d4))' in exported,exported
    assert 'e4 $1 {Centre control}' in exported,exported
    page.locator('#focus-open-analysis').click()
    page.locator('#review-time').select_option('350')
    page.locator('#review-game').click()
    page.wait_for_function("""() => {
      const area=document.getElementById('game-review-results');
      return area && area.textContent.includes('已完成');
    }""",timeout=150000)
    assert page.locator('#game-review-results button.review-move').count()==3
    page.locator('#game-review-results button.review-move').first.click()
    assert page.locator('#position-indicator').inner_text().startswith('1 / 3')
    assert not errors,errors
    print('PGN RAV NAG IMPORT + REAL FULL-GAME STOCKFISH REVIEW BROWSER OK',flush=True)
    ctx.close();browser.close()
finally:
  proc.terminate()
  try:proc.wait(timeout=3)
  except subprocess.TimeoutExpired:proc.kill()
