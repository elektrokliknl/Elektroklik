// Run (met lokale server op 8765): node _tests/peblar.e2e.js
// Test de Peblar-laadpalen: vier prijzen, keuze kabellengte, geen losse laadkabel, aanvraag en productpagina.
const { chromium, devices } = require('playwright');
const assert = require('assert');
const BASE = 'http://127.0.0.1:8765';

async function nieuw(b, opts) {
  const ctx = await b.newContext(opts); const p = await ctx.newPage();
  const st = { errs: [], posted: null };
  p.on('pageerror', e => st.errs.push(e.message));
  await p.route('**/*', async r => {
    const u = r.request().url();
    if (u.includes('formspree.io')) { st.posted = r.request().postDataBuffer().toString('utf8'); return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); }
    return u.startsWith(BASE) ? r.continue() : r.abort();
  });
  return { ctx, p, st };
}
const kies = (p, q, v) => p.click(`#q-${q} input[value="${v}"] + span`);
const totaal = async p => (await p.textContent('#summary .summary-total b')).replace(/\s/g, '');

(async () => {
  const b = await chromium.launch();

  // 1) Configurator: alle vier prijzen via de kabelkeuze
  {
    const { ctx, p, st } = await nieuw(b, { viewport: { width: 1280, height: 900 } });
    await p.goto(BASE + '/laadpalen/samenstellen/');
    await p.click('.consent-bar [data-c=denied]');
    assert(!(await p.isVisible('#q-kabelLengte')), 'geen kabelkeuze zonder Peblar');
    for (const [id, k5, k75] of [['peblar-home', '€1.475,-', '€1.535,-'], ['peblar-business', '€1.785,-', '€1.850,-']]) {
      await p.click(`label[data-product=${id}] .box`);
      assert(await p.isVisible('#q-kabelLengte'), 'kabelkeuze na Peblar');
      assert.strictEqual(await totaal(p), k5, id + ' 5 m');
      await p.click('#q-kabelLengte input[value="7-5m"] + .box');
      assert.strictEqual(await totaal(p), k75, id + ' 7,5 m');
      await p.click('#q-kabelLengte input[value="5m"] + .box');
      assert.strictEqual(await totaal(p), k5, id + ' terug naar 5 m');
    }
    await p.click('label[data-product=zaptec] .box');
    assert(!(await p.isVisible('#q-kabelLengte')), 'kabelkeuze verdwijnt bij Zaptec');
    assert.strictEqual(await totaal(p), '€1.750,-');
    // Peblar Business 7,5 m door de hele standaardroute
    await p.click('label[data-product=peblar-business] .box');
    await p.click('#q-kabelLengte input[value="7-5m"] + .box');
    await p.click('#btnNext');
    await p.click('input[value="geschikt"] + .box'); await p.click('#btnNext');
    await p.click('input[name=locatie][value=buitenmuur] + .box'); await p.click('#btnNext');
    await kies(p, 'afstand', '10-20'); await kies(p, 'kruipruimte', 'ja'); await kies(p, 'graafwerk', 'nee'); await p.click('#btnNext');
    for (const [q, v] of [['fase', '3'], ['slimmeMeter', 'ja'], ['zonnepanelen', 'nee'], ['zakelijk', 'ja']]) await kies(p, q, v);
    assert(!(await p.isVisible('#q-kabel')), 'geen losse laadkabel bij Peblar');
    assert(await p.isVisible('#q-kabelLengte input[value="7-5m"]:checked + .box'), 'gekozen kabellengte blijft bewaard');
    await p.click('#btnNext');
    const tot = await p.textContent('.price-table tr.total');
    assert(tot.includes('1.940'), 'verwacht 1850 + 90 (kabelroute 10-20 m): ' + tot);
    assert((await p.textContent('#stepHost')).includes('Vaste laadkabel 7,5 meter'));
    await p.click('#btnNext');
    for (const [k, v] of Object.entries({ voornaam: 'Test', achternaam: 'Klant', email: 'test@voorbeeld.nl', telefoon: '06 12345678', postcode: '3811 AB', huisnummer: '12', straat: 'Teststraat', plaats: 'Amersfoort' })) await p.fill('#f-' + k, v);
    await p.check('#f-akkoord'); await p.click('#btnNext');
    await p.click('#btnNext'); await p.waitForURL('**/bedankt/'); await p.waitForSelector('.ref');
    for (const veld of ['Peblar Business met vaste laadkabel 7,5 meter', 'Vaste laadkabel 7,5 meter', 'Peblar dynamische load balancing', '1.940']) assert(st.posted.includes(veld), 'mist in aanvraag: ' + veld);
    assert((await p.textContent('#thanksBody')).includes('vaste laadkabel 7,5 meter'), 'bedankpagina toont kabellengte');
    console.log('configurator Peblar ok | fouten:', st.errs.length ? st.errs : 'geen');
    await ctx.close();
  }

  // 2) Productpagina (mobiel): kabelkeuze werkt prijs en link bij; link start configurator met juiste lengte
  {
    const { ctx, p, st } = await nieuw(b, { ...devices['iPhone 13'] });
    await p.goto(BASE + '/laadpalen/peblar-home/');
    await p.click('.consent-bar [data-c=denied]');
    assert.strictEqual((await p.textContent('#pdpPrijs')).replace(/\s/g, ''), '€1.475,-');
    await p.click('#pdpKabel input[value="7-5m"] + span');
    assert.strictEqual((await p.textContent('#pdpPrijs')).replace(/\s/g, ''), '€1.535,-');
    assert((await p.getAttribute('#pdpCta', 'href')).includes('kabel=7-5m'));
    assert(!(await p.textContent('#optList')).includes('Laadkabel Type 2'), 'geen losse laadkabel bij de opties');
    assert(await p.isVisible('img[src*="peblar-voorkant"]'));
    await p.click('#pdpCta'); await p.waitForURL('**/samenstellen/**');
    await p.waitForFunction(() => /1\.535/.test(document.getElementById('mbTotal').textContent));
    assert.strictEqual((await p.textContent('#mbTotal')).replace(/\s/g, ''), '€1.535,-', 'configurator neemt 7,5 m over');
    console.log('productpagina Peblar ok | fouten:', st.errs.length ? st.errs : 'geen');
    await ctx.close();
  }

  // 3) Oude Alfen-adressen sturen door naar het overzicht
  {
    const { ctx, p } = await nieuw(b, { viewport: { width: 1280, height: 900 } });
    for (const u of ['/laadpalen/alfen-eve-single-s-line/', '/laadpalen/alfen-eve-single-pro-line/', '/laadpalen/samenstellen/?laadpaal=alfen-s']) {
      await p.goto(BASE + u); await p.waitForLoadState('load'); await p.waitForTimeout(300);
      assert(/\/laadpalen\/(samenstellen\/)?$/.test(new URL(p.url()).pathname), u + ' -> ' + p.url());
    }
    console.log('Alfen-doorverwijzingen ok');
    await ctx.close();
  }
  await b.close();
  console.log('\nAlle Peblar-scenario’s geslaagd');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
