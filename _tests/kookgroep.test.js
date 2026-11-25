// Run: node _tests/kookgroep.test.js
// Prijsmotor van de kookgroep- en Perilex-configurator (assets/kookgroep/prijs.js) met de centrale prijzen (assets/kookgroep/config.json).
const assert = require('assert');
const path = require('path');
const P = require(path.join(__dirname, '../assets/kookgroep/prijs.js'));
const C = require(path.join(__dirname, '../assets/kookgroep/config.json'));
let n = 0; const t = (naam, fn) => { fn(); n++; console.log('✓', naam); };
const compleet = (extra) => Object.assign({ werk: 'compleet', woningFase: '1', kookplaatType: '2fase', meterkastRuimte: 'ja', afstand: '0-5', kruipruimte: 'ja', kookplaatAansluiten: 'nee' }, extra);

t('niets gekozen → leeg', () => { const r = P.bereken(C, {}); assert.strictEqual(r.modus, 'leeg'); assert.deepStrictEqual(r.ontbreekt, ['werk']); });
t('A: alleen kookplaat aansluiten → € 109 vast, geen extra kookplaattoeslag', () => {
  const r = P.bereken(C, { werk: 'aansluiten', kookplaatAansluiten: 'ja' });
  assert.strictEqual(r.modus, 'vast'); assert.strictEqual(r.min, 109); assert.strictEqual(r.regels.length, 1);
});
t('B: Perilex-stopcontact → € 129 vast', () => { const r = P.bereken(C, { werk: 'perilex' }); assert.strictEqual(r.modus, 'vast'); assert.strictEqual(r.min, 129); });
t('C: drie fasevarianten', () => {
  for (const [type, prijs, woning] of [['1fase', 259, '1'], ['2fase', 299, '1'], ['3fase', 349, '3']]) {
    const r = P.bereken(C, compleet({ kookplaatType: type, woningFase: woning }));
    assert.strictEqual(r.modus, 'vast', type); assert.strictEqual(r.min, prijs, type); assert.deepStrictEqual(r.ontbreekt, []);
  }
});
t('voorbeeld uit de opdracht: 2-fase + 8 m + kruipruimte + kookplaat = € 380', () => {
  const r = P.bereken(C, compleet({ kookplaatType: '2fase', meters: 8, afstand: '6-10', kruipruimte: 'ja', kookplaatAansluiten: 'ja' }));
  assert.strictEqual(r.modus, 'vast'); assert.strictEqual(r.min, 380); assert.strictEqual(r.max, 380);
  assert.strictEqual(r.btw, Math.round(380 * 21 / 121 * 100) / 100);
});
t('exacte meters gaan voor de categorie; 5 m en minder kost niets extra', () => {
  assert.strictEqual(P.bereken(C, compleet({ meters: 5, afstand: '15+' })).min, 299);
  assert.strictEqual(P.bereken(C, compleet({ meters: 3 })).min, 299);
  assert.strictEqual(P.bereken(C, compleet({ meters: 23 })).min, 299 + 18 * 12);
});
t('afstandscategorieën geven een bereik of vanaf-prijs', () => {
  let r = P.bereken(C, compleet({ afstand: '6-10' })); assert.strictEqual(r.modus, 'bereik'); assert.strictEqual(r.min, 299 + 12); assert.strictEqual(r.max, 299 + 60);
  r = P.bereken(C, compleet({ afstand: '11-15' })); assert.strictEqual(r.min, 299 + 72); assert.strictEqual(r.max, 299 + 120);
  r = P.bereken(C, compleet({ afstand: '15+' })); assert.strictEqual(r.modus, 'vanaf'); assert.strictEqual(r.min, 299 + 132); assert.strictEqual(r.max, null);
  r = P.bereken(C, compleet({ afstand: 'onbekend' })); assert.strictEqual(r.modus, 'vanaf'); assert.strictEqual(r.min, 299);
});
t('ongeldige meters worden genegeerd (categorie telt)', () => {
  for (const m of [0, -3, 2.5, 500, 'abc']) assert.strictEqual(P.bereken(C, compleet({ meters: m, afstand: '0-5' })).min, 299, String(m));
});
t('geen kruipruimte → + € 70 in de totaalprijs, geen vervolgvraag', () => {
  const r = P.bereken(C, compleet({ kruipruimte: 'nee' })); assert.strictEqual(r.modus, 'vast'); assert.strictEqual(r.min, 299 + 70); assert.deepStrictEqual(r.ontbreekt, []);
  assert(r.regels.some(x => x.label === 'Kabelaanleg zonder kruipruimte' && x.min === 70));
});
t('kruipruimte onbekend → bereik tot + € 70, met aandachtspunt', () => { const r = P.bereken(C, compleet({ kruipruimte: 'onbekend' })); assert.strictEqual(r.modus, 'bereik'); assert.strictEqual(r.min, 299); assert.strictEqual(r.max, 369); assert(r.aandachtspunten.some(x => /kruipruimte/.test(x))); });
t('3-fase kookplaat in een 1-fase woning → nooit een gewone prijs', () => {
  const r = P.bereken(C, compleet({ kookplaatType: '3fase', woningFase: '1' })); assert.strictEqual(r.modus, 'opMaat'); assert(r.aandachtspunten.some(x => /netbeheerder/.test(x)));
});
t('type kookplaat onbekend → bereik over de mogelijke uitvoeringen', () => {
  let r = P.bereken(C, compleet({ kookplaatType: 'onbekend', woningFase: '1' })); assert.strictEqual(r.modus, 'bereik'); assert.strictEqual(r.min, 259); assert.strictEqual(r.max, 299);
  r = P.bereken(C, compleet({ kookplaatType: 'onbekend', woningFase: '3' })); assert.strictEqual(r.min, 259); assert.strictEqual(r.max, 349);
});
t('woning onbekend + 3-fase → prijs met aandachtspunt', () => { const r = P.bereken(C, compleet({ kookplaatType: '3fase', woningFase: 'onbekend' })); assert.strictEqual(r.min, 349); assert(r.aandachtspunten.some(x => /3-fase-aansluiting heeft/.test(x))); });
t('complete kookgroep nog niet helemaal ingevuld → vanaf-prijs, nooit € 0', () => {
  let r = P.bereken(C, { werk: 'compleet' }); assert.strictEqual(r.modus, 'vanaf'); assert.strictEqual(r.min, 259);
  r = P.bereken(C, { werk: 'compleet', woningFase: '1', kookplaatType: '2fase' }); assert.strictEqual(P.prijsTekst(r), 'Vanaf € 299');
});
t('D: weet niet → advies en prijs op aanvraag', () => {
  assert.strictEqual(P.advies({ hulpAansluiting: 'geen' }).werk, 'compleet');
  assert.strictEqual(P.advies({ hulpAansluiting: 'perilex', hulpWerkte: 'ja' }).werk, 'aansluiten');
  assert.strictEqual(P.advies({ hulpAansluiting: 'perilex', hulpWerkte: 'nee' }).werk, 'compleet');
  assert.strictEqual(P.advies({ hulpAansluiting: 'kabel' }).werk, 'perilex');
  assert.strictEqual(P.advies({ hulpAansluiting: 'onbekend' }).werk, null);
  assert.strictEqual(P.bereken(C, { werk: 'weetniet', hulpAansluiting: 'onbekend' }).modus, 'opMaat');
});
t('kookplaat aansluiten bij complete installatie: + € 45, één keer', () => { const r = P.bereken(C, compleet({ kookplaatAansluiten: 'ja' })); assert.strictEqual(r.min, 344); assert.strictEqual(r.regels.filter(x => /aansluiten/i.test(x.label)).length, 1); });
t('meterkast vol of onbekend → vanaf-prijs met aandachtspunt, nooit stilzwijgend inbegrepen', () => {
  for (const v of ['nee', 'onbekend']) {
    const r = P.bereken(C, compleet({ meterkastRuimte: v }));
    assert.strictEqual(r.modus, 'vanaf', v); assert.strictEqual(r.min, 299, v); assert(r.aandachtspunten.some(x => /meterkast/.test(x)), v);
    assert(r.regels.some(x => /Uitbreiding van de meterkast/.test(x.label)), v);
  }
  assert(P.bereken(C, compleet({ meterkastRuimte: null })).ontbreekt.includes('meterkastRuimte'));
});
t('keuzes en omschrijving (voor e-mail, beheer en offerte)', () => {
  const k = P.keuzes(C, compleet({ meterkastRuimte: 'nee', meters: 8 }));
  assert.deepStrictEqual(k.find(x => x[0] === 'Plek in de meterkast'), ['Plek in de meterkast', 'Nee']);
  assert.deepStrictEqual(k.find(x => x[0] === 'Afstand meterkast–keuken'), ['Afstand meterkast–keuken', 'circa 8 meter']);
  assert.strictEqual(P.omschrijving(C, compleet({ kookplaatType: '2fase', kookplaatAansluiten: 'ja' })), 'Complete 2-fase kookgroep met Perilex, inclusief aansluiten van uw kookplaat');
  assert.strictEqual(P.omschrijving(C, { werk: 'perilex' }), C.werk.perilex.label);
});
t('prijstekst', () => {
  assert.strictEqual(P.prijsTekst(P.bereken(C, { werk: 'aansluiten' })), '€ 109');
  assert.strictEqual(P.prijsTekst(P.bereken(C, compleet({ afstand: '6-10' }))), '€ 311 – € 359');
  assert.strictEqual(P.prijsTekst(P.bereken(C, compleet({ afstand: '15+' }))), 'Vanaf € 431');
  assert.strictEqual(P.prijsTekst(P.bereken(C, compleet({ meters: 108 + 1000 }))).startsWith('€'), true);
});
t('prijzen in de introductie van de pagina kloppen met de prijsconfiguratie', () => {
  const html = require('fs').readFileSync(path.join(__dirname, '../blog/perilex-aansluiten-kosten/index.html'), 'utf8');
  for (const [sleutel, prijs] of [['werk.aansluiten.prijs', C.werk.aansluiten.prijs], ['werk.perilex.prijs', C.werk.perilex.prijs], ['compleet.1fase.prijs', C.compleet['1fase'].prijs]]) {
    const re = new RegExp('data-kg="' + sleutel.replace(/\./g, '\\.') + '">€ ' + prijs + '<');
    assert(re.test(html), 'prijs in de pagina wijkt af: ' + sleutel);
  }
});
console.log('\n' + n + ' tests geslaagd');
