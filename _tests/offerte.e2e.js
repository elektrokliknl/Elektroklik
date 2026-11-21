// Run (met lokale server op 8765): node _tests/offerte.e2e.js
// Offerte maken in beheer → online zetten (GitHub nagebootst) → klant opent korte link → akkoord → aanbetaling (Tikkie).
// Ook: aangepaste link, nog niet online, nieuwe versie via dezelfde link, verlopen offerte, verwijderen, oude links met code, voorwaarden en privacy.
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
  const repo = {}; const gh = [];   // nagebootste GitHub-repository: pad → inhoud
  const route = async r => {
    const u = r.request().url(), m = r.request().method();
    if (u.includes('formspree')) { posts.push(r.request().postDataBuffer().toString('utf8')); return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); }
    if (u.startsWith('https://api.github.com/repos/elektrokliknl/Elektroklik/contents/')) {
      const pad = decodeURIComponent(new URL(u).pathname.split('/contents/')[1]);
      gh.push(m + ' ' + pad + ' ' + (r.request().headers().authorization || ''));
      if (m === 'GET') return repo[pad] ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sha: 'sha-' + pad }) }) : r.fulfill({ status: 404, body: '{}' });
      const body = JSON.parse(r.request().postData());
      if (m === 'PUT') { repo[pad] = Buffer.from(body.content, 'base64').toString('utf8'); assert(!/Jan|Teststraat/.test(body.message), 'geen klantnaam in de commit'); return r.fulfill({ status: 201, body: '{}' }); }
      if (m === 'DELETE') { delete repo[pad]; return r.fulfill({ status: 200, body: '{}' }); }
    }
    const lok = u.match(/^http:\/\/127\.0\.0\.1:8765\/(uw-offerte\/o\/[a-z0-9]+\.json)/);
    if (lok) return repo[lok[1]] ? r.fulfill({ status: 200, contentType: 'application/json', body: repo[lok[1]] }) : r.fulfill({ status: 404, body: 'Not found' });
    return u.startsWith(BASE) ? r.continue() : r.abort();
  };
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route('**/*', route);
  ctx.on('page', p => p.on('pageerror', e => errs.push(e.message)));
  ctx.on('dialog', d => d.type() === 'prompt' ? d.accept('github_pat_TEST') : d.accept());

  // 1) Beheer: offerte maken vanuit een aanvraag en online zetten
  const beh = await ctx.newPage();
  await beh.goto(BASE + '/beheer/');
  await beh.evaluate(a => localStorage.setItem('ek_register_v1', JSON.stringify({ items: { [a.ref]: a } })), AANVRAAG);
  await beh.reload(); await beh.click('[data-tab=offertes]');
  await beh.selectOption('#offVanAanvraag', AANVRAAG.ref);
  assert.strictEqual(await beh.inputValue('[data-off="klant.naam"]'), 'Jan de Tester');
  assert((await beh.inputValue('[data-off="titel"]')).includes('Zaptec Go 2 op een montagepaal'));
  assert((await beh.textContent('#offTotalen')).includes('2.184,00') && (await beh.textContent('#offTotalen')).includes('655,20'));
  assert((await beh.inputValue('[data-off="garantie"]')).includes('Op de Zaptec Go 2 krijgt u 5 jaar fabrieksgarantie.'));
  assert((await beh.inputValue('[data-off="inbegrepen"]')).includes('Plaatsing van uw laadstation op een montagepaal'));
  await beh.fill('[data-off="betaallink"]', TIKKIE);
  await beh.fill('[data-off="installatiedatum"]', 'dinsdag 9 december');
  await beh.click('#offLink'); await beh.waitForSelector('#offB1');
  await beh.waitForSelector('#offOnline .banner.ok', { timeout: 15000 });
  assert((await beh.textContent('#offOnline')).includes('De link werkt'));
  assert(gh.some(x => /^PUT uw-offerte\/o\/[a-z0-9]{8}\.json Bearer github_pat_TEST$/.test(x)), 'bestand via GitHub gezet');
  const bestand = Object.values(repo)[0];
  assert(!/Jan|Teststraat|2184|Zaptec/.test(bestand), 'bestand op de website is onleesbaar zonder sleutel');
  const b1 = await beh.inputValue('#offB1');
  const link = b1.match(/http\S+uw-offerte\/#\S+/)[0];
  console.log('link:', link, '(' + link.length + ' tekens)');
  assert(link.length < 90, 'korte link');
  assert(!/code|apart/i.test(b1), 'geen code of apart bericht meer');
  assert(b1.includes('voor de Zaptec Go 2 op een montagepaal') && b1.includes('Na ontvangst van uw aanbetaling ontvangt u van ons per e-mail een bevestiging met alle afspraken.'));
  assert(await beh.$('a[href^="https://wa.me/31612345678?text="]'), 'knop Via WhatsApp sturen');
  const b3 = await beh.inputValue('#offB3');
  for (const t of ['en voor uw aanbetaling van € 655,20, die wij in goede orde hebben ontvangen', 'Aanbetaling (30%): € 655,20, ontvangen', 'Na de installatie: € 1.528,80', 'https://www.elektroklik.nl/algemene-voorwaarden/', 'KvK 81585802', 'NL003586894B15']) assert(b3.includes(t), 'mist in bevestiging: ' + t);
  assert(!b3.includes('U kunt deze voldoen via'), 'bevestiging komt na de betaling');
  assert((await beh.textContent('#offResultaat')).includes('Na ontvangst van de aanbetaling: bevestiging sturen'));
  await beh.screenshot({ path: path.join(__dirname, 'screenshots/beheer-offerte.png'), fullPage: true });

  // 2) Klant opent de korte link: direct de offerte, zonder code
  const k = await ctx.newPage();
  await k.goto(link); await k.waitForSelector('#offerte:not([hidden])');
  assert(!(await k.isVisible('#codeKaart')), 'geen code nodig');
  const tekst = await k.textContent('#offerte');
  for (const t of ['Zaptec Go 2 op een montagepaal', 'Jan de Tester', '€ 2.184,00', '€ 655,20', '€ 1.528,80', 'dinsdag 9 december', 'KvK 81585802', 'Op de Zaptec Go 2 krijgt u 5 jaar fabrieksgarantie.', 'Op de installatie krijgt u 2 jaar garantie van ElektroKlik.', 'gebaseerd op de gegevens en foto’s die u ons heeft gestuurd']) assert(tekst.includes(t), 'mist op offerte: ' + t);
  assert(!tekst.includes('meer werk nodig') && !tekst.includes('buitenmuur'));
  assert((await k.textContent('#akkoordGerust')).includes('Na ontvangst van uw aanbetaling ontvangt u van ons per e-mail een bevestiging met alle afspraken.'));
  assert.strictEqual(await k.getAttribute('#akkoordTekst a', 'href'), 'https://www.elektroklik.nl/algemene-voorwaarden/');
  assert(!(await k.isVisible('#betaalKnop')), 'betaalknop pas na akkoord');
  await k.screenshot({ path: path.join(__dirname, 'screenshots/klant-offerte.png'), fullPage: true });

  // 3) Akkoord en aanbetaling
  await k.click('#akkoordKnop'); assert(await k.isVisible('#akkoordFout'), 'zonder vinkje geen akkoord');
  await k.check('#akkoord'); await k.fill('#opmerking', 'Liefst in de ochtend');
  await k.click('#akkoordKnop'); await k.waitForSelector('#betaalKaart:not([hidden])');
  const post = posts[posts.length - 1];
  for (const t of ['Akkoord op offerte OF-', 'Jan de Tester', '2.184,00', '655,20 (30%)', 'Akkoord gegeven op', 'Liefst in de ochtend', 'EK-261121-TEST9']) assert(post.includes(t), 'mist in akkoordmail: ' + t);
  assert(!/name="Aanvraagnummer"/.test(post));
  assert.strictEqual(await k.getAttribute('#betaalKnop', 'href'), TIKKIE);
  assert((await k.textContent('#betaalMelding')).includes('Na ontvangst van uw aanbetaling ontvangt u van ons per e-mail een bevestiging met alle afspraken.'));
  await k.reload(); await k.waitForSelector('#betaalKaart:not([hidden])');
  assert(!(await k.isVisible('#akkoordKaart')), 'akkoord blijft bewaard');

  // 4) Aangepaste link en een offerte die (nog) niet online staat
  const kapot = link.slice(0, -3) + (link.slice(-3, -2) === 'A' ? 'B' : 'A') + link.slice(-2);
  const k3 = await ctx.newPage(); await k3.goto(kapot); await k3.waitForSelector('#linkFout:not([hidden])');
  await k3.goto(BASE + '/uw-offerte/#abcdefgh.AAAAAAAAAAAAAAAAAAAAAA'); await k3.reload(); await k3.waitForSelector('#nietBeschikbaar:not([hidden])');
  assert((await k3.textContent('#nietBeschikbaar')).includes('binnen een minuut'));

  // 5) Mobiel
  const m = await b.newPage({ ...devices['iPhone 13'] }); await m.route('**/*', route);
  await m.goto(link); await m.waitForSelector('#offerte:not([hidden])');
  assert(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'geen horizontaal scrollen op mobiel');
  await m.screenshot({ path: path.join(__dirname, 'screenshots/klant-offerte-mobiel.png'), fullPage: true });
  await m.close();

  // 6) Wijziging: dezelfde link toont versie 2; verlopen = geen akkoord
  await beh.fill('[data-off="geldigTot"]', '2020-01-01');
  await beh.click('#offLink'); await beh.waitForSelector('#offOnline .banner.ok', { timeout: 15000 });
  assert.strictEqual((await beh.inputValue('#offB1')).match(/http\S+uw-offerte\/#\S+/)[0], link, 'dezelfde link');
  const k2 = await ctx.newPage(); await k2.goto(link); await k2.waitForSelector('#offerte:not([hidden])');
  assert((await k2.textContent('#oSub')).includes('versie 2'));
  assert((await k2.textContent('#statusMelding')).includes('verlopen') && !(await k2.isVisible('#akkoordKaart')));

  // 7) Offerte verwijderen haalt hem ook van de website
  await beh.click('[data-offwis]'); await beh.waitForSelector('text=Nog geen offertes');
  assert.strictEqual(Object.keys(repo).length, 0, 'bestand verwijderd');
  const k4 = await ctx.newPage(); await k4.goto(link); await k4.waitForSelector('#nietBeschikbaar:not([hidden])');

  // 8) Oude links met code blijven werken
  const oud = await beh.evaluate(async () => { const code = EKOfferte.nieuweCode(); const t = await EKOfferte.versleutel({ nr: 'OF-OUD', versie: 1, datum: '2026-11-21', geldigTot: '2099-01-01', klant: { naam: 'Oude Klant' }, regels: [{ omschrijving: 'Test', bedrag: 100 }], aanbetalingPercentage: 30, formEndpoint: 'https://formspree.io/f/x' }, code); return { link: location.origin + '/uw-offerte/#o=' + t, code }; });
  const k5 = await ctx.newPage(); await k5.goto(oud.link);
  assert(!(await k5.textContent('#codeKaart')).includes('WhatsApp'));
  await k5.fill('#code', oud.code); await k5.click('#codeKnop'); await k5.waitForSelector('#offerte:not([hidden])');

  // 9) Aanvraag verwijderen
  await beh.click('[data-tab=aanvragen]'); await beh.waitForSelector('[data-regwis]');
  await beh.click('[data-regwis="' + AANVRAAG.ref + '"]'); await beh.waitForSelector('text=Nog geen aanvragen');

  // 10) Algemene voorwaarden en privacyverklaring
  const av = await ctx.newPage(); await av.goto(BASE + '/algemene-voorwaarden/');
  const avt = await av.textContent('main');
  for (const t of ['Algemene voorwaarden ElektroKlik', 'Artikel 6 – Bedenktijd', 'aanbetaling van 30%', '€ 70', 'NL003586894B15', 'Artikel 18']) assert(avt.includes(t), 'mist in voorwaarden: ' + t);
  await av.goto(BASE + '/privacyverklaring/'); assert((await av.textContent('main')).includes('Tikkie (ABN AMRO)'));

  console.log('fouten op pagina’s:', errs.length ? errs : 'geen');
  assert(!errs.length);
  await b.close();
  console.log('\nAlle offerte-scenario’s geslaagd');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
