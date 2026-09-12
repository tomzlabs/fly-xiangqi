"""Browser acceptance checks against a running dev or production server."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT=Path('test-results'); OUT.mkdir(exist_ok=True)
URL=os.environ.get('FLY_TEST_URL','http://127.0.0.1:5188')

def ready(page):
    page.wait_for_function("document.getElementById('runtime').textContent.includes('校验通过')",timeout=30000)

def finished(page):
    page.wait_for_function("!document.getElementById('new-game').disabled",timeout=30000)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
    context=browser.new_context(viewport={'width':1440,'height':1100},accept_downloads=True)
    page=context.new_page()
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(URL);ready(page)
    assert page.locator('[data-square]').count()==64
    page.screenshot(path=str(OUT/'desktop-initial.png'),full_page=True)
    # After loading the graph, ordinary play and ablation require zero network.
    requests=[];page.on('request',lambda r:requests.append(r.url))
    context.set_offline(True)
    page.locator('[data-square="e2"]').click()
    page.locator('[data-square="e4"]').click();finished(page)
    assert '1. e4' in page.locator('#moves').inner_text()
    assert 'd6' in page.locator('#moves').inner_text()
    assert page.locator('#spikes').inner_text()=='10,068'
    page.screenshot(path=str(OUT/'desktop-play.png'),full_page=True)
    with page.expect_download() as dl:
        page.locator('#export').click()
    dl.value.save_as(OUT/'trial.json')
    record=json.loads((OUT/'trial.json').read_text())['trial']
    assert record['totalSpikes']==len(record['events'])//2
    assert record['selected']['uci']=='d7d6'
    assert record['outputSpikes']==0 and record['signalNorm']>0
    history=page.locator('#moves').inner_text()
    page.locator('#ablate').click();finished(page)
    assert '因果作用' in page.locator('#ablation-result').inner_text()
    assert page.locator('#moves').inner_text()==history
    with page.expect_download() as dl:
        page.locator('#export-audit').click()
    dl.value.save_as(OUT/'audit.json')
    audit=json.loads((OUT/'audit.json').read_text())['audit']
    assert audit['intact']['signalNorm']>0
    assert audit['disconnected']['signalNorm']==0
    assert audit['disconnected']['selected'] is None
    assert audit['intact']['fen']==audit['disconnected']['fen']
    assert not requests, f'Unexpected network requests during computation: {requests}'
    page.locator('#replay').click()
    assert '回放' in page.locator('#phase').inner_text()
    page.locator('#replay').click()
    page.locator('#undo').click()
    assert page.locator('[data-square="e2"] .piece').count()==1
    assert page.locator('[data-square="e4"] .piece').count()==0
    # Black selection starts a genuine first trial.
    page.locator('#side').select_option('b');finished(page)
    assert page.locator('#moves').inner_text()!='落子之后，棋谱会记录在这里。'
    page.locator('#side').select_option('w');finished(page)
    # Standard rules and promotion UI, including selecting underpromotion.
    page.get_by_text('载入自定义棋局（FEN）',exact=True).click()
    page.locator('#fen-input').fill('7k/P7/8/8/8/8/8/7K w - - 0 1')
    page.locator('#load-fen').click()
    page.locator('[data-square="a7"]').click();page.locator('[data-square="a8"]').click()
    assert page.locator('#promotion').is_visible()
    page.locator('[data-promotion="n"]').click();finished(page)
    assert '子力不足' in page.locator('#status-text').inner_text()
    assert page.locator('[data-square="a8"]').get_attribute('aria-label')=='a8 白马'
    page.locator('#fen-input').fill('invalid')
    page.locator('#load-fen').click()
    assert '无法载入' in page.locator('#status-text').inner_text()
    assert page.locator('[data-square="a8"]').get_attribute('aria-label')=='a8 白马'
    page.locator('#new-game').click()
    context.set_offline(False)
    page.set_viewport_size({'width':390,'height':844})
    page.evaluate('window.scrollTo(0,0)')
    page.screenshot(path=str(OUT/'mobile.png'),full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.locator('[data-square="d2"]').click();page.locator('[data-square="d4"]').click();finished(page)
    assert '1. d4' in page.locator('#moves').inner_text()
    assert not errors,errors
    # Corruption must stop load, not silently swap in synthetic data.
    broken=browser.new_context(viewport={'width':390,'height':844})
    broken.route('**/data/neurons.bin.gz',lambda route:route.fulfill(body=b'corrupt graph',content_type='application/octet-stream'))
    tab=broken.new_page();tab.goto(URL)
    tab.wait_for_function("!document.getElementById('retry-load').hidden",timeout=30000)
    assert '校验失败' in tab.locator('#loading-help').inner_text()
    assert tab.locator('#new-game').is_disabled()
    summary={'desktop':True,'mobileWidth':390,'offlineMoveAndAblation':True,'exportSpikeCountMatches':True,
             'undo':True,'playBlack':True,'underpromotion':True,'invalidFenPreservesBoard':True,
             'corruptDataFailsClosed':True,'browserErrors':errors,
             'browserCoreComputeMs':record['computeMs'],'modelDurationMs':record['durationMs']}
    (OUT/'browser-check.json').write_text(json.dumps(summary,indent=2)+'\n')
    print(json.dumps(summary,indent=2))
    browser.close()
