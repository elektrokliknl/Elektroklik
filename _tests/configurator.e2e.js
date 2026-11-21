// Run (met lokale server op 8765): node _tests/configurator.e2e.js
const { chromium, devices } = require('playwright');
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, 'screenshots/');
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8765';

// failCall: het zoveelste verzoek naar Formspree laten mislukken (1 = de aanvraag zelf, 2 = de foto's erna)
async function nieuw(b, opts, failCall) {
  const ctx = await b.newContext(opts); const p = await ctx.newPage();
  const st = { errs: [], posted: null, posts: [], calls: 0, pdok: 0 };
  p.on('pageerror', e => st.errs.push(e.message));
  await p.route('**/*', async r => {
    const u = r.request().url();
    if (u.includes('formspree.io')) { st.calls++; st.posted = r.request().postDataBuffer().toString('latin1'); st.posts.push(st.posted);
      if (failCall && st.calls === failCall) return r.fulfill({ status: 413, body: '{}' });
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); }
    if (u.includes('api.pdok.nl')) { st.pdok++; st.pdokUrl = u;
      return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ response: { numFound: 1, docs: [{ straatnaam: 'Stationsplein', woonplaatsnaam: 'Amersfoort' }] } }) }); }
    return u.startsWith(BASE) ? r.continue() : r.abort();
  });
  return { ctx, p, st };
}
const leads = p => p.evaluate(() => (window.dataLayer || []).filter(x => x && x.event === 'generate_lead').length);
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
    assert((await p.textContent('#progressCount')).includes('van 6'), 'standaardroute heeft 6 stappen');
    await p.click('input[name=locatie][value=paal] + .box');
    assert(!(await p.isVisible('input[value=kabelhouder]')), 'kabelhouder hoort niet bij montagepaal');
    // plaats en kabelroute staan samen in één stap
    assert(await p.isVisible('#q-afstand') && await p.isVisible('.step-sub'));
    await p.click('#btnNext'); assert(await p.isVisible('#err-afstand'), 'kabelroute is verplicht in dezelfde stap');
    await kies(p, 'afstand', '20+'); await p.click('#btnNext'); assert(await p.isVisible('#err-afstandMeters'));
    await p.fill('#m-afstandMeters', '28');
    await kies(p, 'kruipruimte', 'nee'); await kies(p, 'graafwerk', 'ja'); await p.fill('#m-graafMeters', '6');
    // geen losse toeslagen bij technische vragen
    for (const q of ['afstand', 'kruipruimte', 'graafwerk']) assert(!(await p.textContent('#q-' + q)).includes('€'), 'geen toeslag bij ' + q);
    await p.click('#btnNext');
    for (const [q, v] of [['fase', '3'], ['slimmeMeter', 'ja'], ['zonnepanelen', 'ja'], ['zakelijk', 'ja']]) await kies(p, q, v);
    assert(await p.isVisible('text=Load balancing is inbegrepen'));
    assert(await p.isVisible('#q-kabel input[value=kabel3] ~ .box .rec'), 'advies 3-fasekabel');
    await p.click('#q-kabel input[value=kabel3] + .box');
    await p.click('#btnNext');
    const tot = await p.textContent('.price-table tr.total');
    console.log('desktop overzicht:', tot.replace(/\s+/g, ' '));
    assert(tot.includes('2.654'), 'verwacht 1650 + 25 (meterkast vol) + 359 + 200 + 35 + 210 (6 m graven × 35) + 175 (3-fasekabel)');
    assert((await p.textContent('#summary')).includes('Aanpassingen voor uw situatie'));
    assert((await p.textContent('#btnNext')).includes('Vraag uw definitieve prijs aan'));
    await p.screenshot({ path: OUT + 'desktop-overzicht.png', fullPage: true });
    await p.click('#btnNext');
    await p.click('#btnNext'); assert(await p.isVisible('#e-voornaam'));
    assert((await p.textContent('#btnNext')).includes('Vraag uw definitieve prijs aan'));
    await gegevens(p); await p.click('#btnNext');
    // aanvraag is direct verstuurd (zonder foto's) en de conversie is gemeten
    await p.waitForSelector('#stepHost .notice-ok .ref');
    assert(st.calls === 1 && !st.posts[0].includes('filename='), 'aanvraag wordt verstuurd voor de fotostap');
    for (const veld of ['Uitbreiding meterkast', '3-fase 32 A', 'Aanvraagnummer', 'Kruipruimte', 'Graafwerk', 'circa 28 m', 'Montagepaal', 'uitbreidingskast', 'Zaptec Sense P1']) assert(st.posts[0].includes(veld), 'mist in aanvraag: ' + veld);
    assert.strictEqual(await leads(p), 1, 'generate_lead direct na versturen');
    assert((await p.textContent('.step-title')).includes('foto'));
    assert((await p.textContent('#btnNext')).includes('Afronden zonder foto'));
    assert(!(await p.isVisible('#btnBack')), 'na versturen niet meer terug');
    assert(await p.isVisible('#up-meterkast', { state: 'attached' }) !== null);
    assert(await p.isVisible('.later-box a[href*="wa.me/31850600572"]'));
    await p.setInputFiles('#up-meterkast', { name: 'meterkast.png', mimeType: 'image/png', buffer: fs.readFileSync(path.join(__dirname, '../favicon-96.png')) });
    await p.waitForSelector('.upload-list img');
    assert((await p.textContent('#btnNext')).includes('Foto’s versturen'));
    await p.screenshot({ path: OUT + 'desktop-fotos.png', fullPage: true });
    const ref = (await p.textContent('.notice-ok .ref')).trim();
    await p.click('#btnNext'); await p.waitForURL('**/bedankt/'); await p.waitForSelector('.ref');
    assert(st.calls === 2 && st.posts[1].includes('filename=') && st.posts[1].includes(ref), 'foto’s apart verstuurd met hetzelfde aanvraagnummer');
    assert(!st.posts[1].includes('Aanvraagnummer'), 'foto-inzending wordt in beheer niet als nieuwe aanvraag gezien');
    assert.strictEqual(await leads(p), 0, 'bedankpagina meet niet nogmaals');
    assert(!(await p.isVisible('text=konden niet worden meegestuurd')));
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
    assert((await p.textContent('#progressCount')).includes('van 3'));
    await p.screenshot({ path: OUT + 'mobiel-meterkast.png', fullPage: true });
    await p.click('#btnNext');
    assert((await p.textContent('.step-title')).includes('offerte'));
    // adres automatisch invullen op basis van postcode en huisnummer
    await p.fill('#f-postcode', '3811 AB'); await p.fill('#f-huisnummer', '12');
    await p.waitForFunction(() => document.getElementById('f-straat').value === 'Stationsplein');
    assert.strictEqual(await p.inputValue('#f-plaats'), 'Amersfoort');
    assert(/fq=postcode:3811AB/.test(st.pdokUrl) && /fq=huisnummer:12/.test(st.pdokUrl), st.pdokUrl);
    for (const [k, v] of Object.entries({ voornaam: 'Test', achternaam: 'Klant', email: 'test@voorbeeld.nl', telefoon: '06 12345678' })) await p.fill('#f-' + k, v);
    await p.check('#f-akkoord');
    assert((await p.textContent('#btnNext')).includes('Vraag vrijblijvend een offerte aan'));
    await p.click('#btnNext'); await p.waitForSelector('#stepHost .notice-ok .ref');
    await p.click('#btnNext'); // afronden zonder foto's
    await p.waitForURL('**/bedankt/'); await p.waitForSelector('.later-box');
    assert(st.calls === 1 && st.posted.includes('Vrijblijvende offerte') && st.posted.includes('Easee Charge Up') && st.posted.includes('Stationsplein 12') && !st.posted.includes('filename='));
    await p.screenshot({ path: OUT + 'mobiel-bedankt.png', fullPage: true });
    console.log('mobiel offerteroute ok | errors:', st.errs.length ? st.errs : 'geen');
    await ctx.close();
  }

  // 3) Mobiel – 'weet ik niet' meterkast + foto's die niet verstuurd kunnen worden → aanvraag is er wel
  {
    const { ctx, p, st } = await nieuw(b, { ...devices['Pixel 7'] }, 2);
    await p.goto(BASE + '/laadpalen/samenstellen/?laadpaal=peblar-business');
    await p.click('input[value="onbekend"] + .box');
    assert(await p.isVisible('text=Geen probleem. U kunt verder met het samenstellen.'));
    assert((await p.textContent('#btnNext')).includes('Volgende stap') && (await p.textContent('#progressCount')).includes('van 6'));
    await p.click('input[value="verouderd"] + .box');
    await p.click('#btnNext'); await gegevens(p); await p.click('#btnNext');
    await p.waitForSelector('#stepHost .notice-ok .ref');
    await p.setInputFiles('#up-locatie', { name: 'muur.png', mimeType: 'image/png', buffer: fs.readFileSync(path.join(__dirname, '../favicon-96.png')) });
    await p.waitForSelector('.upload-list img');
    await p.click('#btnNext'); await p.waitForURL('**/bedankt/');
    assert(st.calls === 2 && await p.isVisible('text=konden niet worden meegestuurd'));
    console.log('upload-fallback ok | errors:', st.errs.length ? st.errs : 'geen');
    await ctx.close();
  }

  // 4) Aanvraag zelf mislukt → foutmelding op de gegevensstap, geen conversie, gegevens blijven staan
  {
    const { ctx, p, st } = await nieuw(b, { viewport: { width: 1280, height: 900 } }, 1);
    await p.goto(BASE + '/laadpalen/samenstellen/?laadpaal=easee-max');
    await p.click('input[value="verouderd"] + .box'); await p.click('#btnNext');
    await gegevens(p); await p.click('#btnNext');
    await p.waitForSelector('#sendError .notice');
    assert((await p.textContent('#sendError')).includes('kon niet worden verstuurd'));
    assert.strictEqual(await leads(p), 0, 'geen conversie bij mislukte aanvraag');
    assert.strictEqual(await p.inputValue('#f-voornaam'), 'Test');
    await p.click('#btnNext'); await p.waitForSelector('#stepHost .notice-ok .ref');
    assert.strictEqual(await leads(p), 1);
    console.log('mislukte aanvraag + opnieuw proberen ok | errors:', st.errs.length ? st.errs : 'geen');
    await ctx.close();
  }

  // 5) Automatisch doorschuiven op de telefoon
  {
    const { ctx, p, st } = await nieuw(b, { ...devices['iPhone 13'] });
    await p.goto(BASE + '/laadpalen/samenstellen/?laadpaal=zaptec');
    await p.click('.consent-bar [data-c=denied]').catch(() => {});
    await p.click('input[value="geschikt"] + .box'); await p.click('#btnNext');
    await p.click('input[name=locatie][value=buitenmuur] + .box'); await p.waitForTimeout(900);
    const y1 = await p.evaluate(() => window.scrollY);
    await kies(p, 'afstand', '5-10'); await p.waitForTimeout(900);
    const top = await p.evaluate(() => document.getElementById('q-kruipruimte').getBoundingClientRect().top);
    assert(top > 0 && top < 300, 'volgende vraag staat bovenaan in beeld: ' + top);
    assert(await p.evaluate(() => window.scrollY) > y1, 'pagina is doorgeschoven');
    await kies(p, 'kruipruimte', 'nee'); await p.waitForTimeout(900);
    await kies(p, 'graafwerk', 'nee'); await p.waitForTimeout(900);
    const pos = await p.evaluate(() => { const r = document.getElementById('cfgNav').getBoundingClientRect(), bar = document.getElementById('mobileBar').offsetHeight; return { onder: r.bottom, ruimte: innerHeight - bar, top: r.top }; });
    assert(pos.onder <= pos.ruimte && pos.top > pos.ruimte * 0.5, 'knop staat onderaan in beeld, niet bovenaan: ' + JSON.stringify(pos));
    await p.screenshot({ path: OUT + 'mobiel-knop-onderaan.png' });
    console.log('doorschuiven ok | errors:', st.errs.length ? st.errs : 'geen');
    await ctx.close();
  }
  await b.close();
  console.log('\nAlle e2e-scenario’s geslaagd');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
