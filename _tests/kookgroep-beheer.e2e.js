// Run (met lokale server op 8765): node _tests/kookgroep-beheer.e2e.js
// Kookgroep/Perilex-aanvraag in het beheer: CSV-import → overzicht en details → offerte (zonder aanbetaling) → klant opent link → akkoord.
const { chromium } = require('playwright');
const assert = require('assert');
const BASE = 'http://127.0.0.1:8765';
const REF = 'KG-261125-TST42';
const KG = { soort: 'kookgroep', ref: REF, versie: '2026-11-25',
  staat: { werk: 'compleet', woningFase: '1', kookplaatType: '2fase', meterkastRuimte: 'onbekend', afstand: '6-10', meters: 8, kruipruimte: 'ja', route: null, kookplaatAansluiten: 'ja', merkModel: 'Bosch PIE631FB1E' },
  prijs: { modus: 'vanaf', min: 380, max: null },
  klant: { naam: 'Kees Kook', email: 'kees@voorbeeld.nl', telefoon: '06 87654321', adres: '3811 AB 12' } };
const q = v => '"' + String(v).replace(/"/g, '""') + '"';
const CSV = ['Referentie,Naam,Adres,email,Opmerkingen klant,Prijsconfiguratie versie,Configuratie (kookgroep),Created At',
  [REF, 'Kees Kook', '3811 AB 12', 'kees@voorbeeld.nl', 'Graag in december', '2026-11-25', JSON.stringify(KG), '2026-11-25 09:30'].map(q).join(',')].join('\n');

(async () => {
  const b = await chromium.launch(); const errs = []; const posts = []; const repo = {}; const puts = [];
  let bevestig = true;
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route('**/*', async r => {
    const u = r.request().url(), m = r.request().method();
    if (u.includes('formspree')) { posts.push(r.request().postDataBuffer().toString('utf8')); return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); }
    if (u.startsWith('https://api.github.com/repos/elektrokliknl/Elektroklik/contents/')) {
      const pad = decodeURIComponent(new URL(u).pathname.split('/contents/')[1]);
      if (m === 'GET') return repo[pad] ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sha: 'sha-' + pad }) }) : r.fulfill({ status: 404, body: '{}' });
      if (m === 'PUT') { puts.push(pad); repo[pad] = Buffer.from(JSON.parse(r.request().postData()).content, 'base64').toString('utf8'); return r.fulfill({ status: 201, body: '{}' }); }
    }
    const lok = u.match(/^http:\/\/127\.0\.0\.1:8765\/(uw-offerte\/o\/[a-z0-9]+\.json)/);
    if (lok) return repo[lok[1]] ? r.fulfill({ status: 200, contentType: 'application/json', body: repo[lok[1]] }) : r.fulfill({ status: 404, body: 'Not found' });
    return u.startsWith(BASE) ? r.continue() : r.abort();
  });
  ctx.on('page', p => p.on('pageerror', e => errs.push(e.message)));
  ctx.on('dialog', d => d.type() === 'prompt' ? d.accept('github_pat_TEST') : (d.type() === 'confirm' && !bevestig ? d.dismiss() : d.accept()));

  // 1) Aanvraag importeren en bekijken
  const beh = await ctx.newPage();
  await beh.goto(BASE + '/beheer/'); await beh.waitForSelector('#regLijst');
  await beh.setInputFiles('#regCsv', { name: 'export.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV) });
  await beh.waitForSelector(`[data-open="${REF}"]`);
  const rij = await beh.textContent(`#regLijst tr:has([data-open="${REF}"])`);
  for (const t of ['Kees Kook', 'Complete 2-fase kookgroep met Perilex', 'Kookgroep / Perilex', 'Vanaf € 380']) assert(rij.includes(t), 'overzicht mist: ' + t);
  await beh.fill('#regZoek', 'kookgroep'); assert(await beh.$(`[data-open="${REF}"]`), 'zoeken op kookgroep'); await beh.fill('#regZoek', '');
  await beh.click(`[data-open="${REF}"]`); const det = await beh.textContent('#regDetail');
  for (const t of ['Plek in de meterkast', 'Weet ik niet', 'circa 8 meter', 'Bosch PIE631FB1E', 'Graag in december', 'Uitbreiding van de meterkast', 'Na beoordeling', 'Aandachtspunten', 'plek is in de meterkast']) assert(det.includes(t), 'details missen: ' + t);
  assert(!det.includes('Laadpaal'), 'geen laadpaalvelden bij een kookgroep');
  assert(await beh.$('#regFotoSoort option[value="typeplaatje"]'), 'fotosoorten voor kookgroep');
  console.log('register ok');

  // 2) Offerte maken: vaste bedragen overgenomen, indicaties moet u zelf invullen, geen aanbetaling
  await beh.click('[data-tab=offertes]'); await beh.selectOption('#offVanAanvraag', REF);
  assert.strictEqual(await beh.inputValue('[data-off="titel"]'), 'Complete 2-fase kookgroep met Perilex, inclusief aansluiten van uw kookplaat');
  assert.strictEqual(await beh.inputValue('[data-off="klant.email"]'), 'kees@voorbeeld.nl');
  assert.strictEqual(await beh.inputValue('[data-off="aanbetalingPercentage"]'), '0');
  assert.strictEqual(await beh.inputValue('[data-off="inbegrepen"]'), '');
  const ed = await beh.textContent('#offEditor');
  assert(ed.includes('Vul deze bedragen zelf in') && ed.includes('Uitbreiding van de meterkast') && ed.includes('Aandachtspunten uit de aanvraag'));
  const regels = await beh.$$eval('[data-offregel][data-k="omschrijving"]', l => l.map(x => x.value));
  assert.deepStrictEqual(regels, ['Complete 2-fase kookgroep met Perilex', 'Uitbreiding van de meterkast, als dat nodig is', 'Extra kabel: 3 meter × € 12', 'Kookplaat of fornuis aansluiten']);
  // regel van € 0: eerst waarschuwing, niet online zetten
  bevestig = false; await beh.click('#offLink'); await beh.waitForTimeout(400); assert.strictEqual(puts.length, 0, 'niet online met een regel van € 0'); bevestig = true;
  await beh.click('[data-offregelwis="1"]');
  assert((await beh.textContent('#offTotalen')).includes('380,00'));
  await beh.click('#offLink'); await beh.waitForSelector('#offOnline .banner.ok', { timeout: 15000 });
  const b1 = await beh.inputValue('#offB1'), b3 = await beh.inputValue('#offB3');
  assert(b1.includes('Hierbij ontvangt u onze offerte: Complete 2-fase kookgroep met Perilex, inclusief aansluiten van uw kookplaat.'), b1);
  assert(b1.includes('Na uw akkoord ontvangt u van ons per e-mail een bevestiging') && !/aanbetaling/i.test(b1));
  assert((await beh.textContent('#offResultaat')).includes('Na het akkoord: bevestiging sturen'));
  assert(b3.includes('Het volledige bedrag betaalt u na de installatie.') && !/aanbetaling/i.test(b3));
  const link = b1.match(/http\S+uw-offerte\/#\S+/)[0];
  console.log('offerte ok');

  // 3) Klant opent de link en geeft akkoord
  const kl = await ctx.newPage(); await kl.goto(link); await kl.waitForSelector('#oRegels tr');
  assert.strictEqual(await kl.textContent('#oTitel'), 'Complete 2-fase kookgroep met Perilex, inclusief aansluiten van uw kookplaat');
  assert((await kl.textContent('#oRegels')).includes('380,00'));
  assert.strictEqual((await kl.textContent('#oBetaal')).trim(), '', 'geen aanbetalingsblok');
  const afspr = await kl.textContent('#oAfspraken');
  assert(afspr.includes('U betaalt het volledige bedrag na de installatie.') && !afspr.includes('garantievoorwaarden'), 'betaling na installatie, geen laadpaalgarantie-link');
  assert(await kl.isHidden('#oInbegrepenKaart'));
  assert.strictEqual(await kl.textContent('#akkoordGerust'), 'Na uw akkoord ontvangt u van ons per e-mail een bevestiging met alle afspraken.');
  if (process.env.SHOT) await kl.screenshot({ path: process.env.SHOT + '/kg-offerte-klant.png', fullPage: true });
  await kl.check('#akkoord'); await kl.click('#akkoordKnop'); await kl.waitForSelector('#betaalKaart:not([hidden])');
  assert.strictEqual(await kl.textContent('#betaalTekst'), 'U hoeft nu niets te betalen.');
  assert(await kl.isHidden('#betaalKnop'));
  const post = posts[posts.length - 1];
  assert(post.includes('Akkoord op offerte') && post.includes(REF) && /name="Aanbetaling"\r\n\r\n-\r\n/.test(post));
  console.log('klant ok');

  assert(!errs.length, errs.join('\n'));
  await b.close(); console.log('\nAlle kookgroep-beheerscenario’s geslaagd');
})().catch(e => { console.error(e); process.exit(1); });
