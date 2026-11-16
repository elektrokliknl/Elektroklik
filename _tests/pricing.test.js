// Run: node _tests/pricing.test.js
const assert = require('assert');
const path = require('path');
const P = require(path.join(__dirname, '../laadpalen/assets/pricing.js'));
const config = require(path.join(__dirname, '../laadpalen/data/config.json'));
let n = 0; const t = (name, fn) => { fn(); n++; console.log('✓', name); };

const basis = { product: 'easee-up', meterkast: 'geschikt', locatie: 'buitenmuur', afstand: '0-5', kruipruimte: 'ja', graafwerk: 'nee', fase: '3', slimmeMeter: 'ja', zonnepanelen: 'nee', zakelijk: 'nee', opties: [] };
const tot = s => P.bereken(config, { ...basis, ...s }).totaal;

t('config is geldig', () => assert.deepStrictEqual(P.valideerConfig(config), []));
t('opgegeven verkoopprijzen (incl. installatie en load balancing)', () => {
  assert.strictEqual(tot({}), 1450);
  assert.strictEqual(tot({ product: 'easee-max' }), 1600);
  assert.strictEqual(tot({ product: 'zaptec' }), 1750);
  assert.strictEqual(tot({ product: 'peblar-home' }), 1475);
  assert.strictEqual(tot({ product: 'peblar-business' }), 1785);
  assert.ok(config.instellingen.prijzenGoedgekeurd);
});
t('load balancing bij alle producten inbegrepen, nooit als losse regel', () => {
  for (const p of config.producten) {
    const r = P.bereken(config, { ...basis, product: p.id });
    assert.ok(config.regels.loadBalancing.labelPerProduct[p.id]);
    assert.ok(r.regels[0].label.includes('load balancing'));
    assert.strictEqual(r.regels.length, 1);
  }
  assert.ok(!('prijsPerProduct' in config.regels.loadBalancing));
});
t('standaard compleet zonder beoordeling', () => { const r = P.bereken(config, basis); assert.ok(r.compleet); assert.deepStrictEqual(r.beoordeling, []); assert.strictEqual(r.route, 'standaard'); });
t('afstand: 5-10 m gratis, 10-20 m +90, >20 m +200 met meters', () => {
  assert.strictEqual(tot({ afstand: '5-10' }), 1450);
  assert.strictEqual(tot({ afstand: '10-20' }), 1540);
  const r = P.bereken(config, { ...basis, afstand: '20+' });
  assert.ok(!r.compleet && r.ontbreekt.includes('afstandMeters'));
  const r2 = P.bereken(config, { ...basis, afstand: '20+', afstandMeters: 28 });
  assert.strictEqual(r2.totaal, 1650); assert.ok(r2.compleet && r2.beoordeling.length === 1);
  assert.ok(!P.bereken(config, { ...basis, afstand: '20+', afstandMeters: 15 }).compleet);
});
t('kruipruimte: nee +35, weet ik niet = beoordeling', () => {
  assert.strictEqual(tot({ kruipruimte: 'nee' }), 1485);
  assert.ok(P.bereken(config, { ...basis, kruipruimte: 'onbekend' }).beoordeling.length === 1);
});
t('graafwerk: meters × 25', () => {
  assert.strictEqual(tot({ graafwerk: 'ja', graafMeters: 6 }), 1450 + 150);
  assert.ok(!P.bereken(config, { ...basis, graafwerk: 'ja' }).compleet);
  assert.ok(!P.bereken(config, { ...basis, graafwerk: 'ja', graafMeters: 0 }).compleet);
  assert.ok(!P.bereken(config, { ...basis, graafwerk: 'ja', graafMeters: 9999 }).compleet);
});
t('montagepaal per product', () => {
  assert.strictEqual(tot({ locatie: 'paal' }), 1450 + 329);
  assert.strictEqual(tot({ product: 'zaptec', locatie: 'paal' }), 1750 + 359);
  assert.strictEqual(tot({ product: 'peblar-business', locatie: 'paal' }), 1785 + 409);
});
t('kabelhouder € 50, niet bij montagepaal', () => {
  assert.strictEqual(tot({ opties: ['kabelhouder'] }), 1500);
  assert.strictEqual(tot({ locatie: 'paal', opties: ['kabelhouder'] }), 1450 + 329);
});
t('laadkabel 1-fase € 140 of 3-fase € 175, nooit twee tegelijk', () => {
  assert.strictEqual(tot({ opties: ['kabel1'] }), 1590);
  assert.strictEqual(tot({ opties: ['kabel3'] }), 1625);
  assert.strictEqual(tot({ opties: ['kabel1', 'kabel3'] }), 1625);
  assert.ok(P.bereken(config, { ...basis, opties: ['kabel3'] }).regels.find(x => x.id === 'kabel3').groep === 'zichtbaar');
});
t('meterkast vol: door, € 25 toeslag en interne markering', () => {
  const r = P.bereken(config, { ...basis, meterkast: 'geschikt-vol' });
  assert.strictEqual(r.route, 'standaard'); assert.strictEqual(r.totaal, 1475);
  assert.ok(r.intern.some(x => /uitbreidingskast/.test(x))); assert.ok(r.beoordeling.length === 1);
});
t('meterkast verouderd: offerteroute; weet ik niet: verder met beoordeling', () => {
  const r = P.bereken(config, { product: 'zaptec', meterkast: 'verouderd' });
  assert.strictEqual(r.route, 'offerte'); assert.ok(r.compleet);
  const o = P.bereken(config, { ...basis, meterkast: 'onbekend' });
  assert.strictEqual(o.route, 'standaard'); assert.strictEqual(o.totaal, 1450); assert.ok(o.beoordeling.length === 1);
});
t('slimme meter nee/onbekend = beoordeling (load balancing)', () => {
  assert.ok(P.bereken(config, { ...basis, slimmeMeter: 'nee' }).beoordeling.length === 1);
  assert.ok(P.bereken(config, { ...basis, slimmeMeter: 'onbekend' }).beoordeling.length === 1);
});
t('zakelijk met Easee Charge Up = beoordeling, met MID niet', () => {
  assert.ok(P.bereken(config, { ...basis, zakelijk: 'ja' }).beoordeling.length === 1);
  assert.ok(P.bereken(config, { ...basis, product: 'easee-max', zakelijk: 'ja' }).beoordeling.length === 0);
});
t('combinatie: Zaptec, paal, 28 m, geen kruipruimte, 6 m graven, zonder kabelhouder', () => {
  const r = P.bereken(config, { ...basis, product: 'zaptec', locatie: 'paal', afstand: '20+', afstandMeters: 28, kruipruimte: 'nee', graafwerk: 'ja', graafMeters: 6 });
  assert.strictEqual(r.totaal, 1750 + 359 + 200 + 35 + 150);
  assert.strictEqual(r.situatieTotaal, 200 + 35 + 150);
  assert.strictEqual(r.btw, Math.round(r.totaal * 21 / 121 * 100) / 100);
});
t('onvolledig -> niet compleet', () => { const r = P.bereken(config, { product: 'easee-up' }); assert.ok(!r.compleet && r.ontbreekt.length === P.VRAGEN.length); });
t('onbekend product -> totaal 0', () => assert.strictEqual(P.bereken(config, { product: 'xx' }).totaal, 0));
t('ongeldige configuratie wordt gedetecteerd', () => {
  const kapot = JSON.parse(JSON.stringify(config)); kapot.producten[0].vanafprijs = 'abc';
  assert.throws(() => P.bereken(kapot, basis)); assert.ok(P.valideerConfig(kapot).length > 0);
  const k2 = JSON.parse(JSON.stringify(config)); k2.regels.montagepaal.prijsPerProduct.zaptec = '';
  assert.ok(P.valideerConfig(k2).length > 0);
});
t('keuzehulp', () => {
  const A = (z, p, b) => P.adviseer(config, { zakelijk: z, prioriteit: p, bediening: b }).aanbevolen;
  assert.strictEqual(A('nee', 'prijs', 'app'), 'easee-up');
  assert.strictEqual(A('ja', 'prijs', 'app'), 'easee-max');
  assert.strictEqual(A('ja', 'design', 'app'), 'zaptec');
  assert.strictEqual(A('ja', 'uitgebreid', 'backoffice'), 'peblar-business');
  assert.strictEqual(A('weet', 'uitgebreid', 'eenvoud'), 'peblar-home');
  for (const p of ['prijs', 'design', 'uitgebreid']) for (const b of ['app', 'eenvoud', 'backoffice'])
    assert.ok(P.product(config, A('ja', p, b)).midGecertificeerd);
});
t('Peblar: vier prijzen met vaste laadkabel van 5 of 7,5 meter', () => {
  assert.strictEqual(tot({ product: 'peblar-home', kabelLengte: '5m' }), 1475);
  assert.strictEqual(tot({ product: 'peblar-home', kabelLengte: '7-5m' }), 1535);
  assert.strictEqual(tot({ product: 'peblar-business', kabelLengte: '5m' }), 1785);
  assert.strictEqual(tot({ product: 'peblar-business', kabelLengte: '7-5m' }), 1850);
  assert.strictEqual(tot({ product: 'peblar-home', kabelLengte: 'onzin' }), 1475, 'onbekende lengte valt terug op 5 meter');
  const r = P.bereken(config, { ...basis, product: 'peblar-business', kabelLengte: '7-5m' });
  assert.ok(r.regels[0].label.includes('vaste laadkabel 7,5 meter') && r.regels[0].label.includes('load balancing'));
  assert.ok(r.intern.some(x => x.includes('Vaste laadkabel 7,5 meter')));
});
t('Peblar: losse laadkabel verborgen, kabelhouder en toeslagen blijven', () => {
  assert.strictEqual(tot({ product: 'peblar-home', opties: ['kabel3'] }), 1475);
  assert.strictEqual(tot({ product: 'peblar-home', kabelLengte: '7-5m', opties: ['kabel1', 'kabelhouder'] }), 1535 + 50);
  assert.ok(P.beschikbareOpties(config, { ...basis, product: 'peblar-home' }).filter(o => o.optie.groep === 'kabel').every(o => o.verborgen));
  assert.strictEqual(tot({ product: 'peblar-home', kabelLengte: '7-5m', afstand: '10-20', kruipruimte: 'nee' }), 1535 + 90 + 35);
  assert.strictEqual(tot({ product: 'zaptec', kabelLengte: '7-5m', opties: ['kabel3'] }), 1750 + 175, 'Zaptec ongewijzigd');
});
t('Peblar: vanafprijs moet gelijk zijn aan de laagste kabelprijs', () => {
  const k = JSON.parse(JSON.stringify(config)); k.producten.find(p => p.id === 'peblar-home').kabelVarianten[0].prijs = 1499;
  assert.ok(P.valideerConfig(k).some(f => f.includes('vanafprijs')));
  assert.ok(!config.producten.some(p => p.id.startsWith('alfen')));
});
console.log(`\n${n} tests geslaagd`);
