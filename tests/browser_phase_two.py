#!/usr/bin/env python3
"""Phase-two real browser checks: FIDE draw agreement and nested study PGN."""
from pathlib import Path
import subprocess
import sys
import time
import urllib.request
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
HOST='http://127.0.0.1:8993/'
server=subprocess.Popen([sys.executable,'-m','http.server','8993','--bind','127.0.0.1'],
  cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.STDOUT)
try:
  for _ in range(100):
    try:
      urllib.request.urlopen(HOST,timeout=1).read(1)
      break
    except Exception:
      time.sleep(.1)
  else:
    raise AssertionError('Test server failed to start')
  with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    ctx=browser.new_context(viewport={'width':1440,'height':900},accept_downloads=True)
    page=ctx.new_page()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    def new_game():
      page.goto(HOST,wait_until='domcontentloaded')
      page.locator('[data-mode="local"]').click()
      page.locator('#time-select').select_option('none')
      page.locator('#new-game').click()
    def move(frm,to):
      page.locator('.square[data-square="'+frm+'"]').click()
      page.locator('.square[data-square="'+to+'"]').click()
    new_game()
    assert page.locator('#offer-draw').is_enabled()
    page.locator('#offer-draw').click()
    assert '提和已登記' in page.locator('#game-status-title').inner_text()
    assert page.locator('#accept-draw').is_hidden()
    move('e2','e4')
    assert page.locator('#accept-draw').is_visible()
    assert page.locator('#decline-draw').is_visible()
    page.locator('#decline-draw').click()
    assert page.locator('#accept-draw').is_hidden()
    move('e7','e5')
    assert page.locator('#offer-draw').is_enabled()
    page.locator('#offer-draw').click()
    move('g1','f3')
    page.locator('#accept-draw').click()
    assert '雙方同意和棋' in page.locator('#game-status-title').inner_text()
    assert page.locator('#offer-draw').is_disabled()
    assert not errors,errors
    print('FIDE DRAW OFFER/ACCEPT/DECLINE BROWSER OK',flush=True)

    ctx.close()
    ctx=browser.new_context(viewport={'width':1440,'height':900},accept_downloads=True)
    page=ctx.new_page()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    new_game()
    page.locator('#create-variation').click()
    move('e2','e4')
    page.locator('#create-variation').click()
    move('e7','e5')
    # Export while the child is still an edit draft: it must not be omitted.
    with page.expect_download() as draft_info:
      page.locator('#export-btn').click()
    draft_pgn=Path(draft_info.value.path()).read_text(encoding='utf-8')
    assert '(1. e4 (1... e5))' in draft_pgn,draft_pgn
    page.locator('#finish-variation').click()
    assert page.locator('.variation-item').count()==2
    with page.expect_download() as download_info:
      page.locator('#export-btn').click()
    pgn=Path(download_info.value.path()).read_text(encoding='utf-8')
    assert '(1. e4 (1... e5))' in pgn,pgn
    with page.expect_download() as backup_info:
      page.locator('#download-study').click()
    backup=Path(backup_info.value.path()).read_text(encoding='utf-8')
    assert '"parentId": 1' in backup, backup[:1000]
    assert not errors,errors
    print('NESTED VARIATION / RAV PGN / JSON BROWSER OK',flush=True)
    ctx.close();browser.close()
finally:
  server.terminate()
  try:server.wait(timeout=3)
  except subprocess.TimeoutExpired:server.kill()
