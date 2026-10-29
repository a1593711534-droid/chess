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
