#!/usr/bin/env python3
"""Real Chromium end-to-end tests for professional game-integrity controls.

Unlike source-regex checks, these exercise actual DOM interaction and persistence.
Stockfish is not required: matches run in local two-player mode.
"""
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'http://127.0.0.1:8992/'

def launch_game(browser):
    context = browser.new_context(viewport={'width': 1440, 'height': 900})
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(ORIGIN, wait_until='domcontentloaded')
    page.locator('[data-mode="local"]').click()
    page.locator('#time-select').select_option('none')
    page.locator('#new-game').click()
    assert page.locator('#main-menu-modal').is_hidden()
    return context, page, errors

def play(page, src, dest):
    page.locator(f'.square[data-square="{src}"]').click()
    page.locator(f'.square[data-square="{dest}"]').click()

server = subprocess.Popen(
    [sys.executable, '-m', 'http.server', '8992', '--bind', '127.0.0.1'],
    cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT
)
try:
    for _ in range(100):
        try:
            urllib.request.urlopen(ORIGIN, timeout=1).read(8)
            break
        except Exception:
            time.sleep(.1)
    else:
        raise AssertionError('Professional browser test server never started')

    with sync_playwright() as pw:
        chromium = Path('/usr/bin/chromium')
        browser = pw.chromium.launch(
            headless=True, executable_path=str(chromium) if chromium.exists() else None,
            args=['--no-sandbox', '--disable-dev-shm-usage']
        )
        # A draw claim on an intended next move must not play that move.
        ctx, page, errors = launch_game(browser)
        for start, end in [('g1','f3'),('g8','f6'),('f3','g1'),('f6','g8'),
                           ('g1','f3'),('g8','f6'),('f3','g1')]:
            play(page,start,end)
        assert '7 PLIES' in page.locator('#moves-count').inner_text()
        assert page.locator('#claim-draw').is_enabled(), 'announced draw not offered'
        page.locator('#claim-draw').click()
        assert page.locator('#confirm-modal').is_visible(), 'announcement dialog missing'
        assert page.locator('#claim-draw-announced-move').is_visible()
        page.locator('#claim-draw-announced-move').select_option('f6g8')
        page.locator('#confirm-yes').click()
        assert page.locator('#confirm-modal').is_hidden()
        assert '和棋' in page.locator('#game-status-title').inner_text()
        assert '7 PLIES' in page.locator('#moves-count').inner_text()
        assert not errors, errors
        ctx.close()

        # A destructive import must offer cancel and must not alter the game
        # until explicitly confirmed.
        ctx, page, errors = launch_game(browser)
        play(page,'e2','e4')
        assert '1 PLIES' in page.locator('#moves-count').inner_text()
        def begin_import():
            page.locator('#main-menu-open').click()
            page.locator('#menu-import').click()
            page.locator('#pgn-input').fill('1. d4 d5 *')
            page.locator('#import-confirm').click()
            assert page.locator('#confirm-modal').is_visible()
            assert '取代' in page.locator('#confirm-title').inner_text()
        begin_import()
        page.locator('#confirm-cancel').click()
        assert '1 PLIES' in page.locator('#moves-count').inner_text()
        # After cancel, the main menu remains available.
        page.locator('#menu-import').click()
        page.locator('#pgn-input').fill('1. d4 d5 *')
        page.locator('#import-confirm').click()
        page.locator('#confirm-yes').click()
        assert '2 PLIES' in page.locator('#moves-count').inner_text()
        assert not errors, errors
        ctx.close()

        # Open a second tab WITHOUT unloading the first one. This proves that
        # variation undo was stored immediately, not merely by pagehide.
        ctx, page, errors = launch_game(browser)
        page.locator('#create-variation').click()
        play(page,'e2','e4')
        assert 'e4' in page.locator('#variation-moves').inner_text()
        page.locator('#undo-btn').click()
        assert '尚未走棋' in page.locator('#variation-moves').inner_text()
        other = ctx.new_page()
        other.goto(ORIGIN, wait_until='domcontentloaded')
        assert '尚未走棋' in other.locator('#variation-moves').inner_text()
        assert not errors, errors
        ctx.close()
        browser.close()

    print('PROFESSIONAL BROWSER REGRESSIONS OK: announced draw, guarded import, persisted variation undo')
finally:
    server.terminate()
    try:
        server.wait(timeout=3)
    except subprocess.TimeoutExpired:
        server.kill()
