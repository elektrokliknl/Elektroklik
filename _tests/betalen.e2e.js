// Run (met lokale server op 8765): node _tests/betalen.e2e.js
// Volledige route: aanvraag → server → beheer maakt betaallink → klant betaalt (Mollie gesimuleerd) → beheer ziet 'Betaald'.
const { chromium } = require('playwright');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const BASE = 'http://127.0.0.1:8765';
const WORKER = 'https://elektroklik-worker.test';

(async () => {
  const code = fs.readFileSync(path.join(__dirname, '../_cloudflare/elektroklik-worker.js'), 'utf8');
  const worker = (await import('data:text/javascript,' + encodeURIComponent(code))).default;
  const kv = new Map();
  const env = { DB: { get: async k => kv.has(k) ? kv.get(k) : null, put: async (k, v) => { kv.set(k, v); }, delete: async k => { kv.delete(k); }, list: async ({ prefix }) => ({ keys: [...kv.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }) },
    MOLLIE_API_KEY: 'test_x', ADMIN_KEY: 'beheersleutel-voor-de-test-1234567', SITE_URL: BASE, ALLOWED_ORIGINS: BASE };
  const betalingen = {};
  const echteFetch = globalThis.fetch;
  globalThis.fetch = async (u, o = {}) => {
    if (!String(u).startsWith('https://api.mollie.com')) return echteFetch(u, o);
    if (o.method === 'POST') { const b = JSON.parse(o.body); const id = 'tr_e2e' + Object.keys(betalingen).length; betalingen[id] = { id, status: 'open', amount: b.amount, metadata: b.metadata, redirectUrl: b.redirectUrl, _links: { checkout: { href: 'https://mollie.test/checkout/' + id } } }; return new Response(JSON.stringify(betalingen[id]), { status: 201 }); }
    return new Response(JSON.stringify(betalingen[String(u).split('/').pop()]), { status: 200 });
  };
  const errs = [];
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route('**/*', async r => {
    const req = r.request(), u = req.url();
    if (u.includes('/laadpalen/data/config.json')) { const res = await r.fetch(); const j = await res.json(); j.instellingen.workerUrl = WORKER; return r.fulfill({ json: j }); }
    if (u.startsWith(WORKER)) {
      const resp = await worker.fetch(new Request(u, { method: req.method(), headers: req.headers(), body: ['GET', 'HEAD'].includes(req.method()) ? undefined : req.postDataBuffer() }), env, {});
      return r.fulfill({ status: resp.status, headers: Object.fromEntries(resp.headers), body: Buffer.from(await resp.arrayBuffer()) });
    }
    if (u.startsWith('https://mollie.test/checkout/')) { // klant betaalt bij Mollie → webhook → terug naar site
      const id = u.split('/').pop(); betalingen[id].status = 'paid';
      await worker.fetch(new Request(WORKER + '/mollie/webhook', { method: 'POST', body: new URLSearchParams({ id }) }), env, {});
      return r.fulfill({ status: 302, headers: { location: betalingen[id].redirectUrl } });
    }
    if (u.includes('formspree.io')) return r.fulfill({ status: 200, json: { ok: true } });
    return u.startsWith(BASE) ? r.continue() : r.abort();
  });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));

  // 1) Klant doet een aanvraag → kopie naar de server
  const st = { product: 'zaptec', meterkast: 'geschikt', locatie: 'buitenmuur', afstand: '0-5', kruipruimte: 'ja', graafwerk: 'nee', fase: '3', slimmeMeter: 'ja', zonnepanelen: 'nee', zakelijk: 'nee', opties: [] };
  await p.goto(BASE + '/laadpalen/samenstellen/?c=' + encodeURIComponent(Buffer.from(JSON.stringify(st)).toString('base64')));
  await p.click('.consent-bar [data-c=denied]');
  await p.waitForSelector('.price-table'); await p.click('#btnNext');
  for (const [k, v] of Object.entries({ voornaam: 'Piet', achternaam: 'Klant', email: 'piet@test.nl', telefoon: '0612345678', postcode: '3811AB', huisnummer: '5', straat: 'Laan', plaats: 'Amersfoort' })) await p.fill('#f-' + k, v);
  await p.check('#f-akkoord'); await p.click('#btnNext'); await p.click('#btnNext');
  await p.waitForURL('**/bedankt/'); const ref = (await p.textContent('.ref')).trim();
  await p.waitForTimeout(500);
  assert(kv.has('aanvraag:' + ref), 'aanvraag niet op de server');
  console.log('1. aanvraag op server:', ref);

  // 2) Beheer haalt op en maakt een betaallink
  await p.goto(BASE + '/beheer/'); await p.waitForSelector('#srvKey');
  await p.fill('#srvKey', env.ADMIN_KEY); await p.click('#srvTest'); await p.waitForFunction(() => /in orde/.test(document.getElementById('srvStatus').textContent));
  await p.click('#srvSync'); await p.waitForSelector(`[data-open="${ref}"]`);
  await p.click(`[data-open="${ref}"]`);
  assert.strictEqual(await p.inputValue('#payBedrag'), '1750');
  p.once('dialog', d => d.accept()); await p.click('#payMaak');
  await p.waitForSelector('#regDetail a[href*="/laadpalen/betalen/?t="]');
  const link = await p.getAttribute('#regDetail a[href*="/laadpalen/betalen/?t="]', 'href');
  console.log('2. betaallink gemaakt');

  // 3) Klant opent de betaalpagina, gaat akkoord en betaalt
  await p.goto(BASE + '/laadpalen/' + link.replace('../laadpalen/', ''));
  await p.waitForSelector('#betaal');
  assert((await p.textContent('#payBody')).includes('1.750,00'));
  await p.click('#betaal'); assert(await p.isVisible('#akkoordFout'));
  await p.check('#akkoord'); await p.click('#betaal');
  await p.waitForFunction(() => /Bedankt voor uw betaling/.test(document.getElementById('payTitle').textContent), null, { timeout: 15000 });
  console.log('3. betaling afgerond:', (await p.textContent('#payBody')).trim().slice(0, 60));
  await p.click('#betaal').catch(() => {}); // knop bestaat niet meer na betaling

  // 4) Beheer ziet de status 'Betaald'
  await p.goto(BASE + '/beheer/'); await p.waitForFunction(() => /opgehaald/.test((document.getElementById('srvStatus') || {}).textContent || ''));
  assert.strictEqual(await p.inputValue(`#regLijst select[data-status="${ref}"]`), 'Betaald');
  console.log('4. status in beheer: Betaald');

  // 5) Ongeldige link en ontbrekende server
  await p.goto(BASE + '/laadpalen/betalen/?t=00000000-0000-0000-0000-000000000000');
  await p.waitForSelector('#payBody .notice'); console.log('5. onbekende link:', (await p.textContent('#payBody')).trim().slice(0, 50));
  console.log('errors:', errs.length ? errs : 'geen');
  await ctx.unrouteAll({ behavior: 'ignoreErrors' });
  await b.close();
  console.log('\nBetaalroute geslaagd');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
