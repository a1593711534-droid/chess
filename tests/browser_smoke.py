#!/usr/bin/env python3
"""Manual/offline Chromium smoke suite. Needs python-playwright + local Chromium."""
import subprocess,sys,time,urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
server=subprocess.Popen([sys.executable,'-m','http.server','8977','--bind','127.0.0.1'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.STDOUT)
try:
    for _ in range(60):
        try:
            urllib.request.urlopen('http://127.0.0.1:8977/',timeout=1).read(8);break
        except Exception:time.sleep(.15)
    with sync_playwright() as pw:
        chromium_path=Path('/usr/bin/chromium')
        browser=pw.chromium.launch(headless=True,executable_path=str(chromium_path) if chromium_path.exists() else None,args=['--no-sandbox','--disable-dev-shm-usage'])
        for width,height in [(1440,900),(1280,720),(900,700),(390,844),(360,720)]:
            page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
            errors=[];page.on('pageerror',lambda exc: errors.append(str(exc)))
            page.goto('http://127.0.0.1:8977/',wait_until='domcontentloaded')
            page.wait_for_selector('.square',state='attached')
            page.locator('#new-game').click()
            page.wait_for_timeout(550)
            assert page.locator('.square').count()==64, (width,'squares')
            dims=page.evaluate('({sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,cw:innerWidth,ch:innerHeight})')
            print('VIEW',width,height,dims,'ERRORS',errors,flush=True)
            assert dims['sh']<=dims['ch']+2,('page vertical scroll',dims)
            assert dims['sw']<=dims['cw']+2,('page horizontal scroll',dims)
            page.screenshot(path=str(ROOT/f'PREVIEW_{width}.png'))
            assert not errors,(width,errors)
            if width==1440:
                page.locator('#tab-openings').click();assert page.locator('#opening-library .library-card').count()==33
                page.locator('#tab-training').click();assert page.locator('#puzzle-library .library-card').count()==16
                page.locator('#puzzle-library .library-card').first.click()
                assert '后與國王配合' in page.locator('#training-name').inner_text()
                page.locator('.square[data-square="g6"]').click();page.locator('.square[data-square="h6"]').click()
                assert '訓練完成' in page.locator('#game-status-title').inner_text()
                page.locator('#training-exit').click()
                page.locator('#main-menu-open').click();page.locator('#menu-new').click()
                page.locator('[data-mode="local"]').click()
                page.locator('#new-game').click()
                page.locator('.square[data-square="e2"]').click();page.locator('.square[data-square="e4"]').click()
                assert page.locator('#moves-count').inner_text()=='1 PLIES'
                page.locator('#tab-moves').click()
                page.locator('#position-note').fill('Good centre')
                page.locator('#save-note').click()
                page.locator('#create-variation').click()
                page.locator('.square[data-square="e7"]').click();page.locator('.square[data-square="e5"]').click()
                page.locator('#finish-variation').click()
                assert page.locator('.variation-item').count()==1
                page.locator('#tab-analysis').click()
                assert page.locator('#multi-pv option').count()==3
                assert not errors, errors
            page.close()
        browser.close()
finally:
    server.terminate()
    try:server.wait(timeout=3)
    except subprocess.TimeoutExpired:server.kill()
