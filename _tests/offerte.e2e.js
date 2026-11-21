// Run (met lokale server op 8765): node _tests/offerte.e2e.js
// Offerte maken in beheer → klant opent link met code → akkoord → aanbetaling (Tikkie). Ook: verkeerde code, aangepaste link, verlopen offerte, nieuwe versie, aanvraag verwijderen.
const { chromium, devices } = require('playwright');
const assert = require('assert');
const path = require('path');
const BASE = 'http://127.0.0.1:8765';
const TIKKIE = 'https://tikkie.me/pay/ElektroKlik/test123';
const AANVRAAG = { ref: 'EK-261121-TEST9', datum: '2026-11-21 10:00', naam: 'Jan de Tester', email: 'jan@voorbeeld.nl', telefoon: '06 12345678', adres: 'Teststraat 1, 3811 AB Amersfoort', status: 'Nieuw', notities: '', velden: {},
  tech: { ref: 'EK-261121-TEST9', route: 'standaard', totaal: 2184, staat: { product: 'zaptec', locatie: 'paal', graafwerk: 'ja', graafMeters: 5 },
    regels: [{ label: 'Zaptec Go 2 inclusief standaardinstallatie en load balancing', bedrag: 1650 }, { label: 'Montagepaal inclusief plaatsing', bedrag: 359 }, { label: 'Graafwerk (5 meter × € 35)', bedrag: 175 }] } };

(async () => {
  const b = await chromium.launch(); const errs = []; const posts = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route('**/*', r => { const u = r.request().url();
    if (u.includes('formspree')) { posts.push(r.request().postDataBuffer().toString('utf8')); return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); }
    return u.startsWith(BASE) ? r.continue() : r.abort(); });
  ctx.on('page', p => p.on('pageerror', e => errs.push(e.message)));
  ctx.on('dialog', d => d.accept());

  // 1) Beheer: offerte maken vanuit een aanvraag
  const beh = await ctx.newPage();
  await beh.goto(BASE + '/beheer/');
  await beh.evaluate(a => localStorage.setItem('ek_register_v1', JSON.stringify({ items: { [a.ref]: a } })), AANVRAAG);
  await beh.reload(); await beh.click('[data-tab=offertes]');
  await beh.selectOption('#offVanAanvraag', AANVRAAG.ref);
  assert.strictEqual(await beh.inputValue('[data-off="klant.naam"]'), 'Jan de Tester');
  assert((await beh.inputValue('[data-off="titel"]')).includes('Zaptec Go 2 op een montagepaal'));
  assert((await beh.textContent('#offTotalen')).includes('2.184,00'), 'totaal uit de aanvraag');
  assert((await beh.textContent('#offTotalen')).includes('655,20'), '30% aanbetaling');
  assert((await beh.inputValue('[data-off="garantie"]')).includes('5 jaar fabrieksgarantie op de Zaptec Go 2'));
  await beh.fill('[data-off="betaallink"]', TIKKIE);
  await beh.fill('[data-off="installatiedatum"]', 'dinsdag 9 december');
  await beh.click('#offLink'); await beh.waitForSelector('#offB1');
  const b1 = await beh.inputValue('#offB1'), b2 = await beh.inputValue('#offB2');
  const link = b1.match(/http\S+uw-offerte\/#o=\S+/)[0], code = b2.match(/is: ([A-Z0-9]{4}-[A-Z0-9]{4})/)[1];
  assert(!b1.includes(code), 'code staat niet in het bericht met de link');
  assert(!link.includes('Jan') && !link.includes('Teststraat'), 'geen leesbare klantgegevens in de link');
  console.log('link lengte:', link.length, 'tekens | code:', code);
  await beh.screenshot({ path: path.join(__dirname, 'screenshots/beheer-offerte.png'), fullPage: true });

  // 2) Klant: verkeerde code, aangepaste link, juiste code
  const k = await ctx.newPage();
  await k.goto(link);
  await k.fill('#code', 'AAAA-BBBB'); await k.click('#codeKnop'); await k.waitForSelector('#codeFout:not([hidden])');
  assert((await k.textContent('#codeFout')).includes('klopt niet'));
  const kapot = link.slice(0, -6) + (link.slice(-6, -5) === 'A' ? 'B' : 'A') + link.slice(-5);
  await k.goto(kapot); await k.reload(); await k.fill('#code', code); await k.click('#codeKnop'); await k.waitForSelector('#codeFout:not([hidden])');
  assert((await k.textContent('#codeFout')).includes('klopt niet'), 'aangepaste link wordt geweigerd');
  await k.goto('about:blank'); await k.goto(link); await k.fill('#code', code.toLowerCase().replace('-', ' ')); await k.click('#codeKnop');
  await k.waitForSelector('#offerte:not([hidden])');
  const tekst = await k.textContent('#offerte');
  for (const t of ['Zaptec Go 2 op een montagepaal', 'Jan de Tester', '€ 2.184,00', '€ 655,20', '€ 1.528,80', 'dinsdag 9 december', 'KvK 81585802', 'NL003586894B15', '5 jaar fabrieksgarantie']) assert(tekst.includes(t), 'mist op offerte: ' + t);
  assert(!(await k.isVisible('#betaalKnop')), 'betaalknop pas na akkoord');
  const inb = await k.textContent('#oInbegrepen');
  assert(inb.includes('Plaatsing van de montagepaal') && !inb.includes('buitenmuur'), 'bij een montagepaal geen tekst over de buitenmuur');
  assert(!(await k.$('button[onclick*="print"]')), 'geen afdrukknop');
  await k.screenshot({ path: path.join(__dirname, 'screenshots/klant-offerte.png'), fullPage: true });

  // 3) Akkoord
  await k.click('#akkoordKnop'); assert(await k.isVisible('#akkoordFout'), 'zonder vinkje geen akkoord');
  assert(!(await k.$('#bedenktijd')), 'geen bedenktijd-vinkje'); await k.check('#akkoord'); await k.fill('#opmerking', 'Liefst in de ochtend');
  await k.click('#akkoordKnop'); await k.waitForSelector('#betaalKaart:not([hidden])');
  const post = posts[posts.length - 1];
  for (const t of ['Akkoord op offerte OF-', 'Jan de Tester', '2.184,00', '655,20 (30%)', 'Akkoord gegeven op', 'Liefst in de ochtend', 'EK-261121-TEST9']) assert(post.includes(t), 'mist in akkoordmail: ' + t);
  assert(!/name="Aanvraagnummer"/.test(post), 'akkoordmail telt in beheer niet als nieuwe aanvraag');
  assert.strictEqual(await k.getAttribute('#betaalKnop', 'href'), TIKKIE);
  assert((await k.textContent('#betaalKnop')).includes('655,20'));
  // opnieuw openen: akkoord blijft zichtbaar
  await k.reload(); await k.fill('#code', code); await k.click('#codeKnop'); await k.waitForSelector('#betaalKaart:not([hidden])');
  assert(!(await k.isVisible('#akkoordKaart')) && (await k.textContent('#statusMelding')).includes('akkoord gegeven'));

  // 4) Mobiel bekijken
  const m = await b.newPage({ ...devices['iPhone 13'] });
  await m.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await m.goto(link); await m.fill('#code', code); await m.click('#codeKnop'); await m.waitForSelector('#offerte:not([hidden])');
  assert(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'geen horizontaal scrollen op mobiel');
  await m.screenshot({ path: path.join(__dirname, 'screenshots/klant-offerte-mobiel.png'), fullPage: true });
  await m.close();

  // 5) Nieuwe versie en verlopen offerte
  await beh.fill('[data-off="geldigTot"]', '2020-01-01');
  await beh.click('#offLink'); await beh.waitForFunction(() => /Versie 2/.test(document.querySelector('#offResultaat').textContent));
  const link2 = (await beh.inputValue('#offB1')).match(/http\S+uw-offerte\/#o=\S+/)[0], code2 = (await beh.inputValue('#offB2')).match(/is: ([A-Z0-9]{4}-[A-Z0-9]{4})/)[1];
  const k2 = await ctx.newPage(); await k2.goto(link2); await k2.fill('#code', code2); await k2.click('#codeKnop'); await k2.waitForSelector('#offerte:not([hidden])');
  assert((await k2.textContent('#oSub')).includes('versie 2'));
  assert((await k2.textContent('#statusMelding')).includes('verlopen') && !(await k2.isVisible('#akkoordKaart')), 'verlopen offerte: geen akkoord mogelijk');

  // 6) Aanvraag verwijderen
  await beh.click('[data-tab=aanvragen]'); await beh.waitForSelector('[data-regwis]');
  await beh.click('[data-regwis="' + AANVRAAG.ref + '"]'); await beh.waitForSelector('text=Nog geen aanvragen');
  assert.strictEqual(await beh.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('ek_register_v1')).items).length), 0);

  console.log('fouten op pagina’s:', errs.length ? errs : 'geen');
  assert(!errs.length);
  await b.close();
  console.log('\nAlle offerte-scenario’s geslaagd');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
