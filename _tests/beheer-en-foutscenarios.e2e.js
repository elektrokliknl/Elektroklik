// Run (met lokale server op 8765): node _tests/beheer-en-foutscenarios.e2e.js
const { chromium } = require('playwright');
const assert = require('assert');
const BASE = 'http://127.0.0.1:8765';
const STAAT = { product: 'easee-max', meterkast: 'geschikt', locatie: 'garage', afstand: '10-20', kruipruimte: 'ja', graafwerk: 'nee', fase: '3', slimmeMeter: 'ja', zonnepanelen: 'nee', zakelijk: 'ja', opties: ['kabelhouder'] };
const link = s => BASE + '/laadpalen/samenstellen/?c=' + encodeURIComponent(Buffer.from(JSON.stringify(s)).toString('base64'));
const GEGEVENS = { voornaam: 'A', achternaam: 'Bee', email: 'a@b.nl', telefoon: '0612345678', postcode: '3811AB', huisnummer: '1', straat: 'Weg', plaats: 'Amersfoort' };

(async () => {
  const b = await chromium.launch(); const errs = [];
  const nieuw = async (handler) => { const p = await b.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.route('**/*', handler || (r => r.request().url().startsWith(BASE) ? r.continue() : r.abort())); return p; };

  // 1) Beheer: tabbladen, marge, validatie, aanvraagregister
  let p = await nieuw();
  await p.goto(BASE + '/beheer/'); await p.waitForSelector('#tabs button');
  for (const t of ['producten', 'prijsregels', 'opties', 'marge', 'test', 'algemeen', 'aanvragen']) await p.click(`[data-tab=${t}]`);
  await p.click('[data-tab=marge]'); await p.fill('[data-path="kosten.uurtarief"]', '55'); await p.fill('[data-path="producten.0.kosten.inkoop"]', '600');
  console.log('marge:', (await p.textContent('#margeTabel tbody tr')).replace(/\s+/g, ' '));
  await p.click('[data-tab=producten]'); await p.fill('[data-path="producten.0.vanafprijs"]', '');
  assert(await p.isVisible('.banner.err') && await p.isDisabled('#btnPublish'));
  await p.fill('[data-path="producten.0.vanafprijs"]', '1450'); assert(!(await p.isVisible('.banner.err')));
  // register: CSV zoals Formspree die exporteert
  const tech = JSON.stringify({ ref: 'EK-261115-TEST1', route: 'standaard', staat: STAAT, totaal: 1740, regels: [{ label: 'x', bedrag: 1740 }], intern: ['Laadpaal voorbereiden op zakelijke verrekening'], versie: 'x', klant: { naam: 'Jan Test', email: 'jan@test.nl', telefoon: '0612345678', adres: 'Weg 1, 3811AB Amersfoort' } });
  const csv = 'Submitted At,Aanvraagnummer,Naam,Configuratie (technisch)\n2026-11-15 10:00,EK-261115-TEST1,Jan Test,"' + tech.replace(/"/g, '""') + '"\n';
  await p.click('[data-tab=aanvragen]');
  p.once('dialog', d => d.accept());
  await p.setInputFiles('#regCsv', { name: 'export.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await p.waitForSelector('[data-open="EK-261115-TEST1"]');
  await p.selectOption('#regLijst select', 'Offerte verstuurd');
  await p.click('[data-open="EK-261115-TEST1"]');
  const det = await p.textContent('#regDetail');
  for (const x of ['Jan Test', 'Easee Charge Max', '10 tot 20 meter', 'Kabelhouder', 'zakelijke verrekening']) assert(det.includes(x), 'detail mist ' + x);
  await p.setInputFiles('#regFoto', { name: 'later.png', mimeType: 'image/png', buffer: require('fs').readFileSync(require('path').join(__dirname, '../favicon-96.png')) });
  await p.waitForSelector('#regFotos img');
  await p.reload(); await p.waitForSelector('[data-open="EK-261115-TEST1"]');
  assert.strictEqual(await p.inputValue('#regLijst select'), 'Offerte verstuurd');
  console.log('register: import, status, detail en later toegevoegde foto ok');
  await p.close();

  // 2) Prijswijziging tijdens het invullen → klant moet opnieuw bevestigen
  let wijzig = false;
  p = await nieuw(async r => {
    const u = r.request().url();
    if (u.includes('config.json') && wijzig) { try { const res = await r.fetch(); const j = await res.json(); j.producten[1].vanafprijs = 1700; return await r.fulfill({ json: j }); } catch (e) { return; } }
    if (u.includes('formspree')) return r.fulfill({ status: 200, json: { ok: true } });
    return u.startsWith(BASE) ? r.continue() : r.abort();
  });
  await p.goto(link(STAAT)); await p.waitForSelector('.price-table');
  console.log('overzicht via link:', (await p.textContent('.price-table tr.total')).replace(/\s+/g, ' '));
  await p.click('#btnNext');
  for (const [k, v] of Object.entries(GEGEVENS)) await p.fill('#f-' + k, v);
  await p.check('#f-akkoord'); await p.click('#btnNext');
  wijzig = true; await p.click('#btnNext');
  await p.waitForSelector('#sendError .notice'); console.log('prijswijziging:', (await p.textContent('#sendError')).trim().slice(0, 80));
  await p.click('#btnNext'); await p.waitForURL('**/bedankt/'); console.log('na herbevestiging verstuurd');
  await p.close();

  // 3) Formulierdienst onbereikbaar → foutmelding, e-mailalternatief, gegevens bewaard
  p = await nieuw(r => { const u = r.request().url(); if (u.includes('formspree')) return r.abort(); return u.startsWith(BASE) ? r.continue() : r.abort(); });
  await p.goto(link(STAAT)); await p.waitForSelector('.price-table'); await p.click('#btnNext');
  for (const [k, v] of Object.entries(GEGEVENS)) await p.fill('#f-' + k, v);
  await p.check('#f-akkoord'); await p.click('#btnNext'); await p.click('#btnNext');
  await p.waitForSelector('#sendError .notice'); console.log('storing:', (await p.textContent('#sendError')).trim().slice(0, 60), '| mailto:', await p.isVisible('#sendError a[href^=mailto]'));
  await p.reload(); await p.waitForTimeout(600);
  console.log('na herladen:', await p.textContent('#progressCount'));
  await p.click('[data-ga=gegevens]'); console.log('naam bewaard:', await p.inputValue('#f-voornaam'));
  console.log('errors:', errs.length ? errs : 'geen');
  await p.unrouteAll({ behavior: 'ignoreErrors' });
  await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
