#!/usr/bin/env node
// Zet de prijzen uit laadpalen/data/config.json vast in de HTML-pagina's (voor Google en bezoekers zonder JavaScript).
// Gebruik:  node _tools/sync-prijzen.js          → pagina's bijwerken
//           node _tools/sync-prijzen.js --check  → alleen controleren (exitcode 1 als iets niet klopt)
// Wordt automatisch uitgevoerd door .github/workflows/prijzen-sync.yml zodra config.json wijzigt (bijv. via /beheer/).
//
// Wat wordt bijgewerkt:
//  - <span data-prijs="zaptec">€ 1.750</span>          productprijs (of "min" = laagste prijs)
//  - <span data-cfg="regels.afstand.keuzes.10-20.prijs">€ 90</span>   elk bedrag uit config.json (ook sommen, zie cfgWaarde)
//  - JSON-LD: Product (sku "EK-<id>") → offers.price, en bedragen in FAQ-antwoorden
//  - llms.txt: "vanaf € …"
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CHECK = process.argv.includes('--check');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'laadpalen/data/config.json'), 'utf8'));

const euro = n => '€ ' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const prijsVan = id => {
  if (id === 'min') return Math.min(...config.producten.map(p => p.vanafprijs));
  const p = config.producten.find(x => x.id === id);
  return p ? p.vanafprijs : undefined;
};
// "regels.afstand.keuzes.10-20.prijs" → arrays worden op id doorzocht.
// Ook optellen en vermenigvuldigen kan: "producten.zaptec.vanafprijs + regels.graafwerk.prijsPerMeter*6" (let op de spaties rond +)
function cfgWaarde(expr) {
  let som = 0;
  for (const term of expr.split(' + ')) {
    const [pad, factor] = term.split('*');
    const v = cfgPad(pad.trim());
    if (v === undefined) return undefined;
    som += v * (factor === undefined ? 1 : Number(factor));
  }
  return som;
}
function cfgPad(pad) {
  let o = config;
  for (const deel of pad.split('.')) {
    if (o == null) return undefined;
    o = Array.isArray(o) ? o.find(x => x && x.id === deel) : o[deel];
  }
  return typeof o === 'number' ? o : undefined;
}

function bestanden(dir, uit = []) {
  for (const n of fs.readdirSync(dir, { withFileTypes: true })) {
    if (n.name.startsWith('.') || n.name.startsWith('_') || n.name === 'node_modules' || n.name === 'beheer') continue;
    const p = path.join(dir, n.name);
    if (n.isDirectory()) bestanden(p, uit); else if (n.name.endsWith('.html')) uit.push(p);
  }
  return uit;
}

const fouten = [];
let gewijzigd = 0;

function verwerk(file) {
  const rel = path.relative(ROOT, file);
  const oud = fs.readFileSync(file, 'utf8');
  let s = oud;
  const wissels = []; // [oud bedrag, nieuw bedrag] uit JSON-LD, om FAQ-teksten bij te werken

  // 1) Losse prijsvelden
  s = s.replace(/(<(\w+)\b[^>]*?\bdata-(prijs|cfg)="([^"]+)"[^>]*>)([^<]*)(<\/\2>)/g, (m, open, tag, soort, sleutel, inhoud, sluit) => {
    const v = soort === 'prijs' ? prijsVan(sleutel) : cfgWaarde(sleutel);
    if (v === undefined) { fouten.push(`${rel}: onbekende ${soort} "${sleutel}"`); return m; }
    return open + euro(v) + (/,-\s*$/.test(inhoud) ? ',-' : '') + sluit;
  });

  // 2) "vanaf € …" in titel en meta-omschrijvingen – alleen op laadpaalpagina's (titel bevat "laadpa"),
  //    zodat bijvoorbeeld "vanaf € 109" op de Perilex-pagina niet wordt overschreven met de laadpaalprijs.
  const titel = (s.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  const laadpaalPagina = /laadpa/i.test(titel);
  const vanaf = 'vanaf ' + euro(prijsVan('min'));
  const zetVanaf = t => laadpaalPagina ? t.replace(/([Vv])anaf € \d{1,3}(?:\.\d{3})*/g, (m, v) => v + vanaf.slice(1)) : t;
  s = s.replace(/<title>[^<]*<\/title>|<meta\b[^>]*\bcontent="[^"]*"[^>]*>/g, zetVanaf);

  // 3) Gestructureerde gegevens
  s = s.replace(/(<script type="application\/ld\+json">\s*)([\s\S]*?)(\s*<\/script>)/g, (m, a, json, b) => {
    let data;
    try { data = JSON.parse(json); } catch (e) { fouten.push(`${rel}: JSON-LD niet leesbaar`); return m; }
    let veranderd = false;
    const knopen = Array.isArray(data['@graph']) ? data['@graph'] : [data];
    for (const k of knopen) {
      if (k['@type'] !== 'Product' || !k.offers || !/^EK-/.test(k.sku || '')) continue;
      const id = k.sku.slice(3);
      if (Array.isArray(k.offers)) { // laadpaal met kabelvarianten: één aanbieding per kabellengte
        const prod = config.producten.find(x => x.id === id);
        if (!prod || !prod.kabelVarianten) { fouten.push(`${rel}: onbekend product of geen kabelvarianten voor ${id}`); continue; }
        for (const o of k.offers) {
          const kv = prod.kabelVarianten.find(x => o.sku === `EK-${id}-${x.id}`);
          if (!kv) { fouten.push(`${rel}: onbekende kabelvariant ${o.sku}`); continue; }
          const nieuw = kv.prijs.toFixed(2);
          if (o.price !== nieuw) { wissels.push([Number(o.price), kv.prijs]); o.price = nieuw; if (o.priceSpecification) o.priceSpecification.price = nieuw; veranderd = true; }
        }
        continue;
      }
      const v = prijsVan(id);
      if (v === undefined) { fouten.push(`${rel}: onbekend product ${id}`); continue; }
      const nieuw = v.toFixed(2);
      if (k.offers.price !== nieuw) {
        wissels.push([Number(k.offers.price), v]);
        k.offers.price = nieuw;
        if (k.offers.priceSpecification) k.offers.priceSpecification.price = nieuw;
        veranderd = true;
      }
    }
    for (const k of knopen) {
      if (k['@type'] !== 'FAQPage') continue;
      for (const q of k.mainEntity || []) {
        const ans = q.acceptedAnswer; if (!ans) continue;
        let t = ans.text;
        for (const [oud, nieuw] of wissels) t = t.split(euro(oud)).join(euro(nieuw));
        if (t !== ans.text) { ans.text = t; veranderd = true; }
      }
    }
    // "vanaf € …" in alle teksten (omschrijvingen, antwoorden)
    const loop = o => {
      for (const key of Object.keys(o)) {
        if (typeof o[key] === 'string') { const t = zetVanaf(o[key]); if (t !== o[key]) { o[key] = t; veranderd = true; } }
        else if (o[key] && typeof o[key] === 'object') loop(o[key]);
      }
    };
    loop(data);
    if (!veranderd) return m;
    const compact = !/\n/.test(json.trim());
    return a + (compact ? JSON.stringify(data) : JSON.stringify(data, null, 1)) + b;
  });

  if (s !== oud) {
    gewijzigd++;
    if (CHECK) fouten.push(`${rel}: prijzen lopen niet gelijk met config.json`);
    else { fs.writeFileSync(file, s); console.log('bijgewerkt', rel); }
  }
}

bestanden(ROOT).forEach(verwerk);

// llms.txt
const llms = path.join(ROOT, 'llms.txt');
if (fs.existsSync(llms)) {
  const oud = fs.readFileSync(llms, 'utf8');
  const s = oud.replace(/vanaf € \d{1,3}(?:\.\d{3})*/g, 'vanaf ' + euro(prijsVan('min')));
  if (s !== oud) { gewijzigd++; if (CHECK) fouten.push('llms.txt: prijs loopt niet gelijk'); else { fs.writeFileSync(llms, s); console.log('bijgewerkt llms.txt'); } }
}

if (fouten.length) { console.error(fouten.join('\n')); process.exit(1); }
console.log(CHECK ? 'Alle prijzen in de pagina’s kloppen met config.json' : (gewijzigd ? `${gewijzigd} bestand(en) bijgewerkt` : 'Niets te wijzigen'));
