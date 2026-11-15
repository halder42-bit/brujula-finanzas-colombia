"""Smoke test of Brújula v2 without network access. Requires playwright + chromium."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
html = (ROOT/'index.html').read_text()
css = (ROOT/'styles.css').read_text()
js = (ROOT/'app.js').read_text()
html = html.replace('<link rel="stylesheet" href="./styles.css">',f'<style>{css}</style>')
shim = '''<script>window.__store={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>window.__store[k]||null,setItem:(k,v)=>{window.__store[k]=String(v)},removeItem:k=>delete window.__store[k]}})</script>'''
html = html.replace('<script src="./app.js" defer></script>',shim+f'<script>{js}</script>')

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1440,'height':900}, device_scale_factor=1)
    errors=[]
    page.on('pageerror',lambda exc:errors.append(str(exc)))
    page.set_content(html,wait_until='load')
    assert page.locator('.quick-entry').count()==1
    page.locator('[data-action=addExpense]').click()
    assert page.locator('#tx-form').count()==1
    page.locator('#tx-amount').fill('15.000')
    page.locator('#tx-note').fill('Almuerzo prueba')
    page.locator('#tx-form button[type=submit]').click()
    assert page.locator('#tx-form').count()==0
    assert 'Almuerzo prueba' in page.locator('#view').inner_text()
    data=page.evaluate('JSON.parse(window.__store.brujula_colombia_v1)')
    assert len(data['transactions'])==1 and data['transactions'][0]['amount']==15000
    assert page.locator('.tx-new-row').count()==1
    page.locator('[data-nav=dashboard]').click()
    page.locator('[data-action=addIncome]').click()
    assert page.locator('#tx-kind').input_value()=='income'
    page.locator('#tx-amount').fill('$ 1.200.000')
    page.locator('#tx-note').fill('Ingreso freelance')
    page.locator('#tx-form button[type=submit]').click()
    data=page.evaluate('JSON.parse(window.__store.brujula_colombia_v1)')
    assert len(data['transactions'])==2 and data['transactions'][1]['amount']==1200000
    # Month-select date context: when browsing previous month, new entry starts in that month.
    page.locator('[data-action=prevMonth]').click()
    month=page.evaluate('st.month')
    page.locator('[data-action=addTx]').first.click()
    assert page.locator('#tx-date').input_value()==month+'-01'
    page.locator('#tx-amount').fill('23.500')
    page.locator('#tx-note').fill('Prueba mes anterior')
    page.locator('#tx-form button[type=submit]').click()
    assert page.evaluate('st.month')==month
    assert 'Prueba mes anterior' in page.locator('#view').inner_text()
    # Edit and update
    txid=page.evaluate('st.highlightTx')
    page.locator(f'[data-action=editTx][data-id="{txid}"]').click()
    page.locator('#tx-amount').fill('29.000')
    page.locator('#tx-form button[type=submit]').click()
    data=page.evaluate('JSON.parse(window.__store.brujula_colombia_v1)')
    assert len(data['transactions'])==3
    assert next(x['amount'] for x in data['transactions'] if x['id']==txid)==29000
    # Deleting
    page.once('dialog',lambda d:d.accept())
    page.locator(f'[data-action=deleteTx][data-id="{txid}"]').click()
    data=page.evaluate('JSON.parse(window.__store.brujula_colombia_v1)')
    assert len(data['transactions'])==2
    # Mobile responsive interaction
    page.set_viewport_size({'width':390,'height':844})
    page.locator('[data-action=addTx]').first.click()
    assert page.locator('#tx-form button[type=submit]').is_visible()
    assert not errors, 'JS errors: '+repr(errors)
    print('PASS: expense, Colombian amount, income, date/month selection, edit, delete, mobile. No JS errors.')
    b.close()
