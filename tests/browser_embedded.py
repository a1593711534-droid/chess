#!/usr/bin/env python3
"""UI smoke without network navigation (policy-restricted Chromium). Bundles only test-time URLs.
No application files are changed. Stockfish worker cannot start in the synthetic data: page;
actual engine protocol is verified separately using Node UCI.
"""
import base64,json,re,sys
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
MODULES=[*ROOT.glob('src/**/*.js'),ROOT/'vendor/chess.js']
def key(p):return '@app/'+str(p.relative_to(ROOT)).replace('\\','/')
image_urls={p.stem:'data:image/svg+xml;base64,'+base64.b64encode(p.read_bytes()).decode() for p in (ROOT/'assets/pieces').glob('*.svg')}
modules={}
for file in MODULES:
    code=file.read_text(encoding='utf-8')
    def replace(match):
        resolved=(file.parent/match.group(2).split('?',1)[0]).resolve()
        assert resolved in MODULES,(file,match.group(2))
        return f'from {match.group(1)}{key(resolved)}{match.group(1)}'
    code=re.sub(r'from\s+([\'\"])(\.\.?/[^\'\"]+)\1',replace,code)
    if file.name=='board.js':
        code=code.replace('export const pieceSrc=(type,color)=>`./assets/pieces/${color}${PIECES[color][type]}.svg`;',"export const pieceSrc=(type,color)=>({IMAGE_DATA})[color+PIECES[color][type]];".replace('{IMAGE_DATA}',json.dumps(image_urls)))
    modules[key(file)]='data:text/javascript;base64,'+base64.b64encode(code.encode()).decode()
html=(ROOT/'index.html').read_text()
# Match the actual stylesheet links rather than a stale hard-coded list.
css_files=re.findall(r'<link rel="stylesheet" href="\./styles/([^"?]+)',html)
assert css_files and len(css_files)==len(set(css_files)),css_files
css='\n'.join((ROOT/'styles'/n).read_text() for n in css_files)
html=re.sub(r'<link rel="stylesheet"[^>]*>', '',html)
html=re.sub(r'<script type="module" src="./src/main\.js(?:\?v=[^"]+)?"></script>', '',html)
html=html.replace('</head>',f'<style>{css}</style><script type="importmap">'+json.dumps({'imports':modules})+'</script></head>')
html=html.replace('</body>','<script type="module">import "@app/src/main.js"</script></body>')
with sync_playwright() as pw:
  chromium_path=Path('/usr/bin/chromium')
  browser=pw.chromium.launch(executable_path=str(chromium_path) if chromium_path.exists() else None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  for width,height in [(1440,900),(1280,720),(900,700),(390,844),(360,720)]:
    page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
    errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
    page.set_content(html,wait_until='domcontentloaded')
    page.wait_for_selector('.square',timeout=15000)
    if width==1440:
      menu=page.locator('#main-menu-modal').bounding_box()
      assert abs(menu['x'])<1 and abs(menu['y'])<1 and abs(menu['width']-width)<2 and abs(menu['height']-height)<2,menu
    page.locator('#new-game').click()
    page.wait_for_timeout(200)
    # Player identity and clock must be REAL children of each moved card, not
    # visual empty placeholder cards with their contents left inside hidden slots.
    for pos in ['top','bottom']:
      card=page.locator(f'#{pos}-player-strip')
      assert card.locator(f'#{pos}-name').count()==1, ('player name outside card',width,pos)
      assert card.locator(f'#{pos}-clock').count()==1, ('clock outside card',width,pos)
      assert card.locator(f'#{pos}-name').inner_text().strip(), ('empty player name',width,pos)
      assert card.locator(f'#{pos}-clock').inner_text().strip(), ('empty player clock',width,pos)
      assert card.locator(f'#{pos}-name').is_visible(), ('name not visible',width,pos)
      assert card.locator(f'#{pos}-clock').is_visible(), ('clock not visible',width,pos)
      box=card.locator(f'#{pos}-clock').bounding_box()
      assert box and box['width']>=40 and box['height']>=20,('clock not painted',width,pos,box)
      if width>=1250:
        assert card.evaluate("(node)=>node.parentElement.id")=='match-hud',('not docked',width,pos)
        assert page.locator('#setup-panel').evaluate(
          "(panel,position)=>{const clock=document.querySelector('#'+position+'-clock').getBoundingClientRect(),rect=panel.getBoundingClientRect();return clock.left>=rect.left&&clock.right<=rect.right&&clock.top>=rect.top&&clock.bottom<=rect.bottom}",pos
        ),('clock outside sidebar',width,pos)
      if width<=740:
        assert card.evaluate("(node)=>node.parentElement.id")==f'board-{pos}-slot',('mobile clock not in board slot',width,pos)
    if width==1440:
      assert page.locator('#setup-panel').is_visible() and page.locator('#right-panel').is_visible()
      initial=page.locator('#chessboard').bounding_box()
      assert initial['width']>=690,initial
      for tab in ['analysis','openings','training','moves']:
        page.locator('#tab-'+tab).click()
        current=page.locator('#chessboard').bounding_box()
        assert abs(current['width']-initial['width'])<2 and abs(current['x']-initial['x'])<2,(initial,current,tab)

    # Synthetic data: document cannot create a real HTTP Stockfish Worker. Hide only its test-harness error toast.
    page.add_style_tag(content='.toast-stack{display:none!important}')
    page.evaluate("document.querySelector('#engine-status').textContent='Stockfish 19 · 離線引擎';document.querySelector('#engine-dot').className='status-dot'")
    assert page.locator('.square').count()==64
    dimensions=page.evaluate('({x:document.documentElement.scrollWidth,y:document.documentElement.scrollHeight,w:innerWidth,h:innerHeight})')
    print('viewport',width,height,dimensions,errs,flush=True)
    assert dimensions['x']<=width+1 and dimensions['y']<=height+1,dimensions
    assert not errs, errs
    page.screenshot(path=str(ROOT/f'PREVIEW_{width}.png'))
    if width==1440:
      page.locator('#focus-open-study').click();page.locator('#tab-openings').click()
      assert page.locator('#opening-library .library-card').count()==33
      page.screenshot(path=str(ROOT/'PREVIEW_OPENINGS.png'))
      page.locator('#tab-training').click()
      assert page.locator('#puzzle-library .library-card').count()==16
      page.locator('#puzzle-library .library-card').first.click()
      assert '后與國王配合' in page.locator('#training-name').inner_text()
      page.screenshot(path=str(ROOT/'PREVIEW_TRAINING.png'))
      page.locator('.square[data-square="g6"]').click();page.locator('.square[data-square="h6"]').click()
      assert '訓練完成' in page.locator('#game-status-title').inner_text()
      page.locator('#focus-return').click()
      # Training must restore the board orientation that was active beforehand.
      page.locator('#flip-btn').click()
      original_top_left=page.locator('.square').first.get_attribute('data-square')
      page.locator('#focus-open-study').click();page.locator('#tab-training').click()
      page.locator('#puzzle-library .library-card').first.click()
      page.locator('#focus-return').click()
      assert page.locator('.square').first.get_attribute('data-square')==original_top_left
      page.locator('#flip-btn').click()
      page.locator('#main-menu-open').click()
      page.locator('[data-mode="local"]').click();page.locator('#new-game').click()
      page.locator('.square[data-square="e2"]').click();page.locator('.square[data-square="e4"]').click()
      assert page.locator('#moves-count').inner_text()=='1 PLIES'
      page.locator('#focus-open-study').click();page.locator('#tab-moves').click()
      page.locator('#position-note').fill('Centre control')
      page.locator('#save-note').click();page.locator('#create-variation').click()
      page.locator('.square[data-square="e7"]').click();page.locator('.square[data-square="e5"]').click()
      page.locator('#focus-return').click()
      assert page.locator('.variation-item').count()==1
      # Export/import JSON backups with study branches and comments.
      page.locator('#focus-open-study').click()
      with page.expect_download() as download_info:
        page.locator('#download-study').click()
      backup=Path(download_info.value.path()).read_text(encoding='utf-8')
      data=json.loads(backup)
      assert data['format']=='chess-atelier-study-v1'
      assert data['game']['study']['notes']['1']=='Centre control'
      assert len(data['game']['study']['branches'])==1
      page.locator('#import-pgn').click()
      page.locator('#pgn-input').fill(backup)
      page.locator('#import-confirm').click()
      assert page.locator('.variation-item').count()==1
      page.locator('#focus-open-study').click();page.locator('#tab-analysis').click();assert page.locator('#multi-pv option').count()==3
      # Native drag-and-drop must reach the target square.
      page.locator('.square[data-square="e7"] .piece-image').drag_to(page.locator('.square[data-square="e5"]'))
      assert page.locator('#moves-count').inner_text()=='2 PLIES'
      page.locator('.square[data-square="e2"]').focus()
      page.keyboard.press('ArrowRight')
      assert page.evaluate("document.activeElement.dataset.square")=='f2'
      # PGN that ends in a result without a checkmate should still be terminal.
      page.locator('#import-pgn').click()
      page.locator('#pgn-input').fill('[Event "Imported"]\n\n1. e4 e5 1-0')
      page.locator('#import-confirm').click()
      assert '白方勝利' in page.locator('#game-status-title').inner_text()
      print('USER FLOW / DRAG / KEYBOARD / PGN OK',flush=True)
      assert not errs,errs
    if width==390:
      page.locator('#show-records').click();page.locator('#tab-openings').click()
      page.screenshot(path=str(ROOT/'PREVIEW_MOBILE_STUDY.png'))
      page.locator('#close-records').click()
      page.locator('#mobile-annotate-btn').click()
      page.locator('.square[data-square="e2"]').click()
      page.locator('.square[data-square="e4"]').click()
      assert page.locator('#chessboard svg.board-annotations line').count()==1
      page.locator('#mobile-annotate-btn').click()
    page.close()
  # Regression: a partly stale HTML with only #stop-analysis missing must recover
  # instead of throwing "Cannot set properties of null (setting onclick)".
  missing_stop=html.replace('<button class="outline-action compact" id="stop-analysis" disabled>停止</button>','')
  assert missing_stop!=html, 'Stop button fixture not removed'
  page=browser.new_page(viewport={'width':1280,'height':720})
  errors=[];page.on('pageerror',lambda exc:errors.append(str(exc)))
  page.set_content(missing_stop,wait_until='domcontentloaded')
  page.wait_for_selector('.square',timeout=15000)
  assert page.locator('.square').count()==64
  assert page.locator('#stop-analysis').count()==1
  assert not errors,errors
  print('MISSING OPTIONAL CONTROL RECOVERED',flush=True)
  page.close()
  # Regression: an old HTML build must present a clear recovery screen.
  mismatched=html.replace('data-app-version="2.3.5"','data-app-version="2.0.0"')
  assert mismatched!=html
  page=browser.new_page()
  errors=[];page.on('pageerror',lambda exc:errors.append(str(exc)))
  page.set_content(mismatched,wait_until='domcontentloaded')
  page.wait_for_selector('#startup-error',timeout=15000)
  assert '網頁與程式版本不相符' in page.locator('#startup-error').inner_text()
  assert page.locator('.square').count()==0
  assert not errors,errors
  print('VERSION MISMATCH SHOWS RECOVERY INSTRUCTIONS',flush=True)
  page.close()
  # Regression: a truly missing critical control must show a useful error.
  missing_required=html.replace('id="analyze-btn"','id="removed-analyze-btn"')
  page=browser.new_page()
  errors=[];page.on('pageerror',lambda exc:errors.append(str(exc)))
  page.set_content(missing_required,wait_until='domcontentloaded')
  page.wait_for_selector('#startup-error',timeout=15000)
  assert '#analyze-btn' not in page.locator('#startup-error').inner_text()  # Human-readable id list
  assert 'analyze-btn' in page.locator('#startup-error').inner_text()
  assert not errors,errors
  print('MISSING REQUIRED CONTROL SHOWS DIAGNOSTICS',flush=True)
  page.close()
  # Regression: timed games must show exactly one timeout banner after repeated UI ticks.
  page=browser.new_page(viewport={'width':1280,'height':720})
  errors=[];page.on('pageerror',lambda exc: errors.append(str(exc)))
  page.clock.install()
  page.set_content(html,wait_until='domcontentloaded')
  page.wait_for_selector('.square',timeout=15000)
  page.locator('[data-mode="local"]').click()
  page.locator('#time-select').select_option('3+0')
  page.locator('#new-game').click()
  page.locator('.square[data-square="e2"]').click()
  page.locator('.square[data-square="e4"]').click()
  assert page.locator('#moves-count').inner_text()=='1 PLIES'
  page.clock.fast_forward(181000)
  page.clock.run_for(1400)
  assert '白方勝利' in page.locator('#game-status-title').inner_text()
  assert '時間用盡' in page.locator('#game-status-title').inner_text()
  toasts=page.locator('#toast-stack .toast',has_text='時間用盡')
  assert toasts.count()==1,('repeat timeout toast',toasts.count())
  assert not errors,errors
  print('CHESS CLOCK UI REGRESSION: ONE TERMINAL NOTIFICATION',flush=True)
  page.close()
  # First-move clock and clock suspension through a study variation.
  page=browser.new_page(viewport={'width':1440,'height':900})
  page.clock.install()
  page.set_content(html,wait_until='domcontentloaded')
  page.wait_for_selector('.square',timeout=15000)
  page.locator('[data-mode="local"]').click()
  page.locator('#time-select').select_option('3+0')
  page.locator('#new-game').click()
  page.clock.fast_forward(6200)
  page.clock.run_for(300)
  before=page.locator('#bottom-clock').inner_text()
  assert before!='03:00',('first move was not charged',before)
  page.locator('#focus-open-study').click();page.locator('#tab-moves').click()
  page.locator('#create-variation').click()
  page.clock.fast_forward(181000)
  page.clock.run_for(300)
  assert page.locator('#bottom-clock').inner_text()=='STUDY'
  page.locator('#focus-return').click()
  during=page.locator('#bottom-clock').inner_text()
  assert during==before,('variation consumed game time',before,during)
  page.clock.fast_forward(2500)
  page.clock.run_for(300)
  after=page.locator('#bottom-clock').inner_text()
  to_seconds=lambda v:int(v[:2])*60+int(v[3:])
  assert to_seconds(after)<to_seconds(before),('clock did not resume',before,after)
  print('FIRST MOVE / VARIATION PAUSE / RESUME OK',flush=True)
  page.close()
  # Phase-one regressions: claimable draw, non-destructive cancellation and undo safety.
  page=browser.new_page(viewport={'width':1440,'height':900})
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(html,wait_until='domcontentloaded')
  page.wait_for_selector('.square',timeout=15000)
  page.locator('[data-mode="local"]').click()
  page.locator('#time-select').select_option('none')
  page.locator('#new-game').click()
  for from_sq,to_sq in [('g1','f3'),('g8','f6'),('f3','g1'),('f6','g8')]*2:
    page.locator(f'.square[data-square="{from_sq}"]').click()
    page.locator(f'.square[data-square="{to_sq}"]').click()
  assert page.locator('#claim-draw').is_enabled(), 'threefold draw should be claimable'
  assert '和棋' not in page.locator('#game-status-title').inner_text(), 'third repetition should not auto-end game'
  page.locator('#claim-draw').click()
  assert '和棋' in page.locator('#game-status-title').inner_text()
  page.locator('#main-menu-open').click()
  page.locator('#new-game').click()
  assert page.locator('#confirm-modal').is_visible(), 'finished game should not be overwritten silently'
  page.locator('#confirm-cancel').click()
  assert '和棋' in page.locator('#game-status-title').inner_text()
  assert not errors,errors
  page.close()

  page=browser.new_page(viewport={'width':1440,'height':900})
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(html,wait_until='domcontentloaded')
  page.wait_for_selector('.square',timeout=15000)
  page.locator('[data-mode="local"]').click()
  page.locator('#new-game').click()
  page.locator('.square[data-square="e2"]').click()
  page.locator('.square[data-square="e4"]').click()
  page.locator('#position-note').fill('Old e4 note')
  page.locator('#undo-btn').click()
  assert page.locator('#confirm-modal').is_visible(), 'undo must warn before deleting research'
  page.locator('#confirm-cancel').click()
  assert page.locator('#moves-count').inner_text()=='1 PLIES'
  page.locator('#undo-btn').click()
  page.locator('#confirm-yes').click()
  assert page.locator('#moves-count').inner_text()=='0 PLIES'
  page.locator('.square[data-square="d2"]').click()
  page.locator('.square[data-square="d4"]').click()
  assert page.locator('#position-note').input_value()=='', 'new first move must not inherit e4 notes'
  assert not errors,errors
  print('PHASE 1 UI: DRAW CLAIM, SAFE NEW GAME, UNDO STUDY INTEGRITY OK',flush=True)
  page.close()
  # Phase 2: small landscape devices must scroll and keep usable squares.
  for width,height in [(568,320),(667,375),(320,568)]:
    page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html,wait_until='domcontentloaded')
    page.wait_for_selector('.square',timeout=15000)
    page.locator('[data-mode="local"]').click()
    page.locator('#new-game').click()
    sq=page.locator('.square[data-square="e2"]').bounding_box()
    dims=page.evaluate('({x:document.documentElement.scrollWidth,y:document.documentElement.scrollHeight,w:innerWidth,h:innerHeight})')
    assert sq and sq['width']>=37,(width,height,sq)
    assert dims['x']<=width+1,('horizontal overflow',width,height,dims)
    if height<=375:
      assert sq['width']>=50,('landscape squares too small',width,height,sq)
      assert dims['y']>height,('short viewport should be scrollable instead of shrinking board',dims)
    assert page.locator('#mobile-analysis-btn').is_visible()
    assert page.locator('#mobile-save-btn').is_visible()
    page.locator('#mobile-annotate-btn').click()
    page.locator('.square[data-square="e2"]').click()
    assert 'annotation-start' in page.locator('.square[data-square="e2"]').get_attribute('class')
    assert '標記起點' in page.locator('#board-live').inner_text()
    page.locator('.square[data-square="e2"]').focus()
    page.keyboard.press('Escape')
    assert 'annotation-start' not in page.locator('.square[data-square="e2"]').get_attribute('class')
    page.locator('.square[data-square="e2"]').click()
    page.locator('.square[data-square="e4"]').click()
    assert page.locator('#chessboard svg.board-annotations line').count()==1
    page.locator('#mobile-annotate-btn').click()
    page.locator('.square[data-square="e2"]').click()
    assert page.locator('.square[data-square="e4"]').get_attribute('aria-label').find('合法落點')>=0
    page.locator('.square[data-square="e2"]').focus()
    page.keyboard.press('Escape')
    page.locator('#mobile-analysis-btn').click()
    assert page.locator('#right-panel').is_visible()
    assert page.locator('#analysis-tab').is_visible()
    page.locator('#tab-analysis').focus()
    page.keyboard.press('ArrowRight')
    assert page.locator('#tab-openings').get_attribute('aria-selected')=='true'
    page.locator('#close-records').click()
    page.locator('#mobile-save-btn').click()
    assert '存檔' in page.locator('#arena-save-status').inner_text() or '儲存' in page.locator('#arena-save-status').inner_text()
    assert not errors,errors
    print('PHASE 2 MOBILE / LANDSCAPE / BOARD A11Y OK',width,height,dims,flush=True)
    page.close()
  browser.close()
