#!/usr/bin/env python3
"""End-to-end offline reload regression, using the real service worker on localhost."""
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
server=subprocess.Popen([sys.executable,'-m','http.server','8978','--bind','127.0.0.1'],
                        cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.STDOUT)
try:
    for _ in range(100):
        try:
            urllib.request.urlopen('http://127.0.0.1:8978/',timeout=1).read(8)
            break
        except Exception:
            time.sleep(0.1)
    else:
        raise AssertionError('Local static server did not start')

    with sync_playwright() as pw:
        chromium=Path('/usr/bin/chromium')
        browser=pw.chromium.launch(headless=True,
            executable_path=str(chromium) if chromium.exists() else None,
            args=['--no-sandbox','--disable-dev-shm-usage'])
        context=browser.new_context(service_workers='allow')
        page=context.new_page()
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto('http://127.0.0.1:8978/',wait_until='domcontentloaded')
        page.wait_for_selector('.square',timeout=15000)
        page.evaluate('async () => { await navigator.serviceWorker.ready; }')
        page.wait_for_function('() => navigator.serviceWorker.controller !== null',timeout=15000)
        page.reload(wait_until='domcontentloaded')
        page.wait_for_selector('.square',timeout=15000)
        # Malformed JSON must be reported, not silently treated as an absent save.
        page.evaluate('''() => {
          localStorage.setItem('chess-atelier-game-v1','{broken');
          localStorage.setItem('chess-atelier-manual-save-v1','{broken');
        }''')
        page.reload(wait_until='domcontentloaded')
        page.wait_for_selector('.square',timeout=15000)
        assert '自動存檔損毀' in page.locator('#toast-stack').inner_text()
        assert '手動存檔：無法解析' in page.locator('#menu-saved-info').inner_text()
        assert page.locator('#menu-load').is_disabled()
        page.evaluate('''() => {
          localStorage.removeItem('chess-atelier-game-v1');
          localStorage.removeItem('chess-atelier-manual-save-v1');
        }''')
        page.reload(wait_until='domcontentloaded')
        page.wait_for_selector('.square',timeout=15000)
        # A structurally valid manual save with illegal chess moves must not
        # overwrite the currently active match before validation completes.
        page.locator('[data-mode="local"]').click()
        page.locator('#new-game').click()
        page.locator('.square[data-square="e2"]').click()
        page.locator('.square[data-square="e4"]').click()
        assert page.locator('#moves-count').inner_text()=='1 PLIES'
        page.evaluate('''() => {
          const game=JSON.parse(localStorage.getItem('chess-atelier-game-v1'));
          game.moves=['illegal'];
          localStorage.setItem('chess-atelier-manual-save-v1',JSON.stringify({version:1,date:new Date().toISOString(),game}));
        }''')
        page.locator('#mobile-main-menu').click()
        page.locator('#menu-load').click()
        page.locator('#confirm-yes').click()
        assert page.locator('#moves-count').inner_text()=='1 PLIES'
        page.locator('#menu-continue').click()
        # Reject a damaged variation in imported JSON without changing the game.
        invalid_backup=page.evaluate('''() => {
          const game=JSON.parse(localStorage.getItem('chess-atelier-game-v1'));
          game.study.branches=[{origin:1,fen:'invalid fen',moves:['e7e5']}];
          return JSON.stringify({format:'chess-atelier-study-v1',game});
        }''')
        page.locator('#show-records').click();page.locator('#tab-moves').click()
        page.locator('.focus-files summary').click()
        page.locator('#import-pgn').click()
        page.locator('#pgn-input').fill(invalid_backup)
        page.locator('#import-confirm').click()
        assert '變例無效' in page.locator('#import-error').inner_text()
        assert page.locator('#moves-count').inner_text()=='1 PLIES'
        page.locator('#import-cancel').click()
        assert not errors,errors
        print('CORRUPT AUTO/MANUAL SAVE AND STUDY IMPORT SAFETY OK',flush=True)
        context.set_offline(True)
        page.reload(wait_until='domcontentloaded')
        page.wait_for_selector('.square',timeout=15000)
        assert page.locator('.square').count()==64
        assert not errors,errors
        print('OFFLINE RELOAD OK: all chessboard modules, images and CSS served from cache',flush=True)
        context.set_offline(False)
        browser.close()
finally:
    server.terminate()
    try:
        server.wait(timeout=3)
    except subprocess.TimeoutExpired:
        server.kill()
