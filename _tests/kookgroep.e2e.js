// Run (met lokale server op 8765): node _tests/kookgroep.e2e.js
// Kookgroep- en Perilex-configurator op /blog/perilex-aansluiten-kosten/.
const { chromium, devices } = require('playwright');
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const BASE = 'http://127.0.0.1:8765';
const URL_ = BASE + '/blog/perilex-aansluiten-kosten/';
const OUT = path.join(__dirname, 'screenshots/');
fs.mkdirSync(OUT, { recursive: true });
const FOTO = { name: 'meterkast.png', mimeType: 'image/png', buffer: fs.readFileSync(path.join(__dirname, '../favicon-96.png')) };

async function nieuw(b, opts, faal) {
  const ctx = await b.newContext(opts); const p = await ctx.newPage(); const st = { errs: [], posts: [] };
  p.on('pageerror', e => st.errs.push(e.message));
  await p.route('**/*', r => { const u = r.request().url();
    if (u.includes('formspree')) { st.posts.push(r.request().postDataBuffer().toString('utf8'));
      if (faal === 'alles' || (faal === 'fotos' && st.posts.length === 1)) return r.fulfill({ status: 413, body: '{}' });
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); }
    return u.startsWith(BASE) ? r.continue() : r.abort(); });
  await p.goto(URL_); await p.waitForSelector('#kg-stap .kg-titel');
  await p.evaluate(() => document.querySelectorAll('.ek-cb').forEach(e => e.remove()));
  return { ctx, p, st };
}
const kies = (p, naam, waarde) => p.click(`#kookgroep input[name="${naam}"][value="${waarde}"] + span`);
const prijs = p => p.textContent('#kg-prijs');
const volgende = p => p.click('#kg-volgende');
const titel = p => p.textContent('#kg-stap .kg-titel');
async function gegevens(p) {
  for (const [k, v] of Object.entries({ voornaam: 'Test', achternaam: 'Klant', email: 'test@voorbeeld.nl', telefoon: '06 12345678', postcode: '3811 AB', huisnummer: '12' })) await p.fill('#kg-' + k, v);
  await p.check('#kg-akkoord');
}
const veld = (post, naam) => { const m = post.match(new RegExp('name="' + naam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[’']/g, '.') + '"\\r\\n\\r\\n([^\\r]*)')); return m ? m[1] : null; };

(async () => {
  const b = await chromium.launch();

  // 0) Pagina: configurator bovenaan, prijstabel weg, introductie met de nieuwe prijzen
  { const { ctx, p, st } = await nieuw(b, { viewport: { width: 1280, height: 900 } });
    assert(!(await p.$('.prijs-tabel')), 'oude prijstabel is weg');
    assert(!(await p.textContent('.artikel > p')).includes('€'), 'geen prijzen in de introductie'); assert((await p.textContent('.faq-blok')).includes('€ 109'), 'prijzen in de FAQ');
    assert.strictEqual(await prijs(p), 'Kies wat u wilt laten doen');
    assert(await p.isHidden('#kg-vorige'));
    await volgende(p); assert(await p.isVisible('#kgf-werk'), 'eerst een keuze maken');
    assert.strictEqual(await p.getAttribute('.cta-blok a', 'href'), '#samenstellen');
    await p.screenshot({ path: OUT + 'kookgroep-start.png' });
    assert(!st.errs.length, st.errs.join()); await ctx.close(); }

  // 1) A: alleen kookplaat aansluiten, met foto
  { const { ctx, p, st } = await nieuw(b, { viewport: { width: 1280, height: 900 } });
    await kies(p, 'werk', 'aansluiten'); assert.strictEqual(await prijs(p), '€ 109'); assert((await p.textContent('#kg-stap')).includes('Inclusief Perilex-stekker'), 'stekker bij A');
    await volgende(p); assert((await titel(p)).includes('kookplaat'));
    assert(!(await p.$('input[name="kookplaatAansluiten"]')), 'geen extra kookplaattoeslag bij A');
    await p.fill('#kg-merk', 'Bosch PIE631FB1E'); await volgende(p);
    assert((await titel(p)).includes('Offerte aanvragen'));
    assert.strictEqual(await p.textContent('#kg-volgende'), 'Offerte aanvragen');
    await volgende(p); assert(await p.isVisible('#kge-voornaam'), 'formulier wordt gecontroleerd');
    await gegevens(p);
    assert(await p.$('#kgu-bestaand') && await p.$('#kgu-typeplaatje') && !(await p.$('#kgu-meterkast')), 'relevante foto’s bij A');
    await p.setInputFiles('#kgu-typeplaatje', FOTO); await p.waitForSelector('.kg-fotos img');
    await volgende(p); await p.waitForSelector('.kg-klaar');
    const post = st.posts[0];
    assert.strictEqual(veld(post, 'Werkzaamheden'), 'Alleen kookplaat of fornuis aansluiten');
    assert.strictEqual(veld(post, 'Prijsindicatie incl. btw'), '€ 109');
    assert.strictEqual(veld(post, 'Merk en type kookplaat'), 'Bosch PIE631FB1E');
    assert.strictEqual(veld(post, 'Adres'), '3811 AB 12');
    assert(veld(post, 'Cookies') && post.includes('filename='), 'foto en cookieregel meegestuurd');
    assert(/^KG-\d{6}-[A-Z0-9]{5}$/.test(veld(post, 'Referentie')));
    assert(!/name="Aanvraagnummer"/.test(post), 'telt niet als laadpaalaanvraag in beheer');
    assert((await p.textContent('.kg-klaar')).includes(veld(post, 'Referentie')));
    console.log('A ok'); assert(!st.errs.length, st.errs.join()); await ctx.close(); }

  // 2) B: Perilex-stopcontact → meteen naar de gegevens
  { const { ctx, p, st } = await nieuw(b, { viewport: { width: 1280, height: 900 } });
    await kies(p, 'werk', 'perilex'); assert.strictEqual(await prijs(p), '€ 129');
    await volgende(p); assert((await titel(p)).includes('Offerte aanvragen'));
    assert(await p.$('#kgu-meterkast') && await p.$('#kgu-bestaand'));
    await gegevens(p); await volgende(p); await p.waitForSelector('.kg-klaar');
    assert.strictEqual(veld(st.posts[0], 'Prijsindicatie incl. btw'), '€ 129');
    console.log('B ok'); await ctx.close(); }

  // 3) C: complete kookgroep – voorbeeld uit de opdracht (€ 380) en varianten
  { const { ctx, p, st } = await nieuw(b, { viewport: { width: 1280, height: 900 } });
    await kies(p, 'werk', 'compleet'); assert.strictEqual(await prijs(p), 'Vanaf € 259');
    await volgende(p); await volgende(p); assert(await p.isVisible('#kgf-woningFase') && await p.isVisible('#kgf-kookplaatType') && await p.isVisible('#kgf-meterkastRuimte'));
    await kies(p, 'woningFase', '1'); await kies(p, 'kookplaatType', '3fase');
    assert((await p.textContent('#kg-stap')).includes('netbeheerder'), 'waarschuwing 3-fase in 1-fase woning');
    assert.strictEqual(await prijs(p), 'Prijs op aanvraag');
    await kies(p, 'kookplaatType', 'onbekend'); assert.strictEqual(await prijs(p), 'Vanaf € 259');
    await kies(p, 'kookplaatType', '2fase'); assert.strictEqual(await prijs(p), 'Vanaf € 299');
    await kies(p, 'meterkastRuimte', 'nee'); assert((await p.textContent('#kg-stap')).includes('uitbreiding van de meterkast'), 'melding meterkast vol');
    await p.click('#kg-opbouwknop'); assert((await p.textContent('#kg-opbouw')).includes('Na beoordeling'), 'meterkastuitbreiding na beoordeling'); await p.click('#kg-opbouwknop');
    await kies(p, 'meterkastRuimte', 'ja'); assert(!(await p.textContent('#kg-stap')).includes('uitbreiding van de meterkast'));
    await volgende(p); await kies(p, 'afstand', '6-10'); assert.strictEqual(await prijs(p), 'Vanaf € 311');
    await p.fill('#kg-meters', '8'); assert.strictEqual(await prijs(p), 'Vanaf € 335');
    await p.fill('#kg-meters', '2.5'); await volgende(p); assert(await p.isVisible('#kgf-meters'), 'ongeldig aantal meters');
    await p.fill('#kg-meters', '8'); await volgende(p);
    await kies(p, 'kruipruimte', 'nee'); assert(!(await p.$('input[name="route"][value="kruipruimte"]')), 'geen "via kruipruimte" zonder kruipruimte');
    await volgende(p); assert(await p.isVisible('#kgf-route'), 'vervolgvraag kabelroute verplicht');
    await kies(p, 'route', 'leiding'); assert.strictEqual(await prijs(p), 'Vanaf € 335', 'geen automatische € 75');
    await kies(p, 'route', 'kabelgoot'); assert.strictEqual(await prijs(p), 'Vanaf € 410');
    await kies(p, 'route', 'muur'); assert.strictEqual(await prijs(p), 'Prijs op aanvraag');
    await kies(p, 'kruipruimte', 'ja'); assert(!(await p.$('input[name="route"]')), 'geen vervolgvraag bij kruipruimte');
    await volgende(p); await kies(p, 'kookplaatAansluiten', 'ja');
    assert.strictEqual(await prijs(p), '€ 380', 'voorbeeldberekening uit de opdracht');
    await p.click('#kg-opbouwknop'); const opb = await p.textContent('#kg-opbouw');
    for (const t of ['Complete 2-fase kookgroep met Perilex', '€ 299', 'Extra kabel: 3 meter', '€ 36', 'Kookplaat of fornuis aansluiten', '€ 45', '€ 380']) assert(opb.includes(t), 'prijsopbouw mist: ' + t);
    await volgende(p); const ov = await p.textContent('.kg-overzicht');
    for (const t of ['Complete kookgroep met Perilex', '2-fase kookgroep', 'circa 8 meter', 'Kruipruimte', 'Ja', 'Waarvan 21% btw: € 65,95']) assert(ov.includes(t), 'overzicht mist: ' + t);
    // keuzes aanpassen zonder opnieuw te beginnen
    await p.click('.kg-stappen [data-ga="aansluiting"]'); await kies(p, 'woningFase', '3'); await kies(p, 'kookplaatType', '3fase');
    assert.strictEqual(await prijs(p), '€ 430'); await p.click('.kg-stappen [data-ga="gegevens"]');
    await p.screenshot({ path: OUT + 'kookgroep-desktop-gegevens.png', fullPage: true });
    await gegevens(p); await p.setInputFiles('#kgu-meterkast', FOTO); await p.waitForSelector('.kg-fotos img');
    await volgende(p); await p.waitForSelector('.kg-klaar');
    const post = st.posts[0];
    for (const [k, v] of [['Aansluiting woning', '3-fase'], ['Kookplaat heeft nodig', '3-fase krachtgroep'], ['Plek in de meterkast', 'Ja'], ['Afstand meterkast–keuken', 'circa 8 meter'], ['Kookplaat aansluiten', 'Ja'], ['Prijsindicatie incl. btw', '€ 430']]) assert.strictEqual(veld(post, k), v, k);
    assert(post.includes('Extra kabel: 3 meter') && post.includes('Configuratie (kookgroep)'));
    const tech = JSON.parse(veld(post, 'Configuratie (kookgroep)')); assert.strictEqual(tech.soort, 'kookgroep'); assert.strictEqual(tech.klant.email, veld(post, 'email'));
    console.log('C ok'); assert(!st.errs.length, st.errs.join()); await ctx.close(); }

  // 4) D: weet niet → advies → verder als A; en "weet ik niet" → offerte op maat
  { const { ctx, p } = await nieuw(b, { viewport: { width: 1280, height: 900 } });
    await kies(p, 'werk', 'weetniet'); await volgende(p);
    await kies(p, 'hulpAansluiting', 'perilex'); await kies(p, 'hulpWerkte', 'ja');
    assert((await p.textContent('.kg-melding')).includes('Ons advies'));
    await p.click('[data-advies]'); assert((await titel(p)).includes('kookplaat')); assert.strictEqual(await prijs(p), '€ 109');
    await p.click('.kg-stappen [data-ga="werk"]'); await kies(p, 'werk', 'weetniet'); await volgende(p);
    await kies(p, 'hulpAansluiting', 'onbekend'); assert.strictEqual(await prijs(p), 'Prijs op aanvraag');
    await volgende(p); assert((await titel(p)).includes('Offerte aanvragen'));
    assert(await p.$('#kgu-meterkast') && await p.$('#kgu-bestaand') && await p.$('#kgu-locatie') && await p.$('#kgu-typeplaatje'), 'alle foto’s bij twijfel');
    console.log('D ok'); await ctx.close(); }

  // 5) Mobiel: geen horizontaal scrollen, prijs en knop blijven in beeld, keuzes blijven bewaard na herladen
  { const { ctx, p, st } = await nieuw(b, { ...devices['iPhone 13'] });
    await kies(p, 'werk', 'compleet'); await volgende(p); await kies(p, 'woningFase', '1'); await kies(p, 'kookplaatType', '2fase');
    await p.waitForTimeout(900);
    assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'geen horizontaal scrollen');
    const voet = await p.evaluate(() => { const r = document.getElementById('kg-voet').getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.top < innerHeight; });
    assert(voet, 'prijs en knop in beeld');
    await p.screenshot({ path: OUT + 'kookgroep-mobiel.png' });
    await p.reload(); await p.waitForSelector('#kg-stap .kg-titel');
    assert((await titel(p)).includes('aansluiting'), 'stap bewaard'); assert.strictEqual(await prijs(p), 'Vanaf € 299', 'keuzes bewaard');
    console.log('mobiel ok'); assert(!st.errs.length, st.errs.join()); await ctx.close(); }

  // 6) Foto's kunnen niet mee → aanvraag toch verstuurd; versturen mislukt helemaal → nette foutmelding
  { const { ctx, p, st } = await nieuw(b, { viewport: { width: 1280, height: 900 } }, 'fotos');
    await kies(p, 'werk', 'perilex'); await volgende(p); await gegevens(p);
    await p.setInputFiles('#kgu-meterkast', FOTO); await p.waitForSelector('.kg-fotos img');
    await volgende(p); await p.waitForSelector('.kg-klaar');
    assert(st.posts.length === 2 && !st.posts[1].includes('filename=') && (await p.textContent('.kg-klaar')).includes('konden niet worden meegestuurd'));
    console.log('foto-terugval ok'); await ctx.close(); }
  { const { ctx, p } = await nieuw(b, { viewport: { width: 1280, height: 900 } }, 'alles');
    await kies(p, 'werk', 'perilex'); await volgende(p); await gegevens(p); await volgende(p);
    await p.waitForSelector('#kg-verzendfout .kg-melding'); assert((await p.textContent('#kg-verzendfout')).includes('kon niet worden verstuurd'));
    assert.strictEqual(await p.inputValue('#kg-voornaam'), 'Test');
    console.log('verzendfout ok'); await ctx.close(); }

  await b.close();
  console.log('\nAlle kookgroep-scenario’s geslaagd');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
