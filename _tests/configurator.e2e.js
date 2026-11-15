// Run (met lokale server op 8765): node _tests/configurator.e2e.js
const { chromium, devices } = require('playwright');
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, 'screenshots/');
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8765';

async function nieuw(b, opts, failFirstPost) {
  const ctx = await b.newContext(opts); const p = await ctx.newPage();
  const st = { errs: [], posted: null, calls: 0 };
  p.on('pageerror', e => st.errs.push(e.message));
  await p.route('**/*', async r => {
    const u = r.request().url();
    if (u.includes('formspree.io')) { st.calls++; st.posted = r.request().postDataBuffer().toString('latin1');
      if (failFirstPost && st.calls === 1) return r.fulfill({ status: 413, body: '{}' });
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); }
    return u.startsWith(BASE) ? r.continue() : r.abort();
  });
  return { ctx, p, st };
}
const kies = (p, q, v) => p.click(`#q-${q} input[value="${v}"] + span`);
async function gegevens(p) {
  for (const [k, v] of Object.entries({ voornaam: 'Test', achternaam: 'Klant', email: 'test@voorbeeld.nl', telefoon: '06 12345678', postcode: '3811 AB', huisnummer: '12', straat: 'Teststraat', plaats: 'Amersfoort' })) await p.fill('#f-' + k, v);
  await p.check('#f-akkoord');
}

(async () => {
  const b = await chromium.launch();

  // 1) Desktop – standaardroute met alle toeslagen en een foto
  {
    const { ctx, p, st } = await nieuw(b, { viewport: { width: 1280, height: 900 } });
    await p.goto(BASE + '/laadpalen/samenstellen/');
    await p.click('.consent-bar [data-c=denied]');
    await p.click('#btnNext'); assert(await p.isVisible('#err-product'));
    await p.click('label[data-product=zaptec] .box'); await p.click('#btnNext');
    // meterkastcontrole direct na de productkeuze
    assert((await p.textContent('.step-title')).includes('meterkast'));
    assert(await p.isVisible('.mk-ex.ok img') && await p.isVisible('.mk-ex.bad img'));
    await p.click('#btnNext'); assert(await p.isVisible('#err-meterkast'));
    await p.click('input[value="geschikt-vol"] + .box');
    assert((await p.textContent('#btnNext')).includes('Volgende'));
    await p.click('#btnNext');
    await p.click('input[name=locatie][value=paal] + .box');
    assert(!(await p.isVisible('input[value=kabelhouder]')), 'kabelhouder hoort niet bij montagepaal');
    await p.click('#btnNext');
    await kies(p, 'afstand', '20+'); await p.click('#btnNext'); assert(await p.isVisible('#err-afstandMeters'));
    await p.fill('#m-afstandMeters', '28');
    await kies(p, 'kruipruimte', 'nee'); await kies(p, 'graafwerk', 'ja'); await p.fill('#m-graafMeters', '6');
    // geen losse toeslagen bij technische vragen
    assert(!(await p.textContent('#stepHost')).includes('€'));
    await p.click('#btnNext');
    for (const [q, v] of [['fase', '3'], ['slimmeMeter', 'ja'], ['zonnepanelen', 'ja'], ['zakelijk', 'ja']]) await kies(p, q, v);
    assert(await p.isVisible('text=Load balancing is inbegrepen'));
    assert(await p.isVisible('#q-kabel input[value=kabel3] ~ .box .rec'), 'advies 3-fasekabel');
    await p.click('#q-kabel input[value=kabel3] + .box');
    await p.click('#btnNext');
    const tot = await p.textContent('.price-table tr.total');
    console.log('desktop overzicht:', tot.replace(/\s+/g, ' '));
    assert(tot.includes('2.694'), 'verwacht 1750 + 25 (meterkast vol) + 359 + 200 + 35 + 150 + 175 (3-fasekabel)');
    assert((await p.textContent('#summary')).includes('Aanpassingen voor uw situatie'));
    assert((await p.textContent('#btnNext')).includes('Vraag uw definitieve prijs aan'));
    await p.screenshot({ path: OUT + 'desktop-overzicht.png', fullPage: true });
    await p.click('#btnNext');
    await p.click('#btnNext'); assert(await p.isVisible('#e-voornaam'));
    await gegevens(p); await p.click('#btnNext');
    assert((await p.textContent('.step-title')).includes('Foto'));
    assert(await p.isVisible('#up-meterkast', { state: 'attached' }) !== null);
    assert(await p.isVisible('.later-box a[href*="wa.me/31850600572"]'));
    await p.setInputFiles('#up-meterkast', { name: 'meterkast.png', mimeType: 'image/png', buffer: fs.readFileSync(path.join(__dirname, '../favicon-96.png')) });
    await p.waitForSelector('.upload-list img');
    await p.screenshot({ path: OUT + 'desktop-fotos.png', fullPage: true });
    await p.click('#btnNext'); await p.waitForURL('**/bedankt/'); await p.waitForSelector('.ref');
    for (const veld of ['Uitbreiding meterkast', '3-fase 32 A', 'Aanvraagnummer', 'Kruipruimte', 'Graafwerk', 'circa 28 m', 'Montagepaal', 'uitbreidingskast', 'Zaptec Sense P1', 'filename=']) assert(st.posted.includes(veld), 'mist in aanvraag: ' + veld);
    console.log('desktop ok, aanvraag', await p.textContent('.ref'), '| errors:', st.errs.length ? st.errs : 'geen');
    await ctx.close();
  }

  // 2) Mobiel – verouderde meterkast → vrijblijvende offerte, zonder foto's
  {
    const { ctx, p, st } = await nieuw(b, { ...devices['iPhone 13'] });
    await p.goto(BASE + '/laadpalen/samenstellen/?laadpaal=easee-up');
    await p.click('.consent-bar [data-c=denied]');
    assert((await p.textContent('.step-title')).includes('meterkast'));
    await p.click('input[value="verouderd"] + .box');
    assert(await p.isVisible('text=Wij adviseren u een vrijblijvende offerte aan te vragen.'));
    assert((await p.textContent('#btnNext')).includes('Vraag vrijblijvend een offerte aan'));
    assert((await p.textContent('#progressCount')).includes('van 4'));
    await p.screenshot({ path: OUT + 'mobiel-meterkast.png', fullPage: true });
    await p.click('#btnNext');
    assert((await p.textContent('.step-title')).includes('offerte'));
    await gegevens(p); await p.click('#btnNext');
    await p.click('#btnNext'); // versturen zonder foto's
    await p.waitForURL('**/bedankt/'); await p.waitForSelector('.later-box');
    assert(st.posted.includes('Vrijblijvende offerte') && st.posted.includes('Easee Charge Up') && !st.posted.includes('filename='));
    await p.screenshot({ path: OUT + 'mobiel-bedankt.png', fullPage: true });
    console.log('mobiel offerteroute ok | errors:', st.errs.length ? st.errs : 'geen');
    await ctx.close();
  }

  // 3) Mobiel – 'weet ik niet' meterkast + foto-upload die mislukt → tweede poging zonder foto's
  {
    const { ctx, p, st } = await nieuw(b, { ...devices['Pixel 7'] }, true);
    await p.goto(BASE + '/laadpalen/samenstellen/?laadpaal=alfen-pro');
    await p.click('input[value="onbekend"] + .box');
    assert(await p.isVisible('text=Geen probleem. U kunt verder met het samenstellen.'));
    assert((await p.textContent('#btnNext')).includes('Volgende stap') && (await p.textContent('#progressCount')).includes('van 8'));
    await p.click('input[value="verouderd"] + .box');
    await p.click('#btnNext'); await gegevens(p); await p.click('#btnNext');
    await p.setInputFiles('#up-locatie', { name: 'muur.png', mimeType: 'image/png', buffer: fs.readFileSync(path.join(__dirname, '../favicon-96.png')) });
    await p.waitForSelector('.upload-list img');
    await p.click('#btnNext'); await p.waitForURL('**/bedankt/');
    assert(st.calls === 2 && await p.isVisible('text=konden niet worden meegestuurd'));
    console.log('upload-fallback ok | errors:', st.errs.length ? st.errs : 'geen');
    await ctx.close();
  }
  await b.close();
  console.log('\nAlle e2e-scenario’s geslaagd');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
