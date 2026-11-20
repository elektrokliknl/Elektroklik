#!/usr/bin/env node
// Maakt het productbestand voor Google Merchant Center: /google-producten.xml
// Gebruik: node _tools/google-feed.js          → bestand (opnieuw) schrijven
//          node _tools/google-feed.js --check  → alleen controleren of het bestand klopt met config.json
// Wordt automatisch uitgevoerd door .github/workflows/prijzen-sync.yml zodra config.json wijzigt.
// In Merchant Center stelt u een "geplande ophaalactie" in op https://www.elektroklik.nl/google-producten.xml.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://www.elektroklik.nl';
const UIT = path.join(ROOT, 'google-producten.xml');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'laadpalen/data/config.json'), 'utf8'));

const x = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const img = src => /^https?:/.test(src) ? src : src.startsWith('../') ? SITE + '/' + src.slice(3) : SITE + '/laadpalen/' + src;
const prijs = n => Number(n).toFixed(2) + ' EUR';

function item(p, variant) {
  const fotos = (p.afbeeldingen && p.afbeeldingen.length ? p.afbeeldingen : [p.afbeelding]).filter(Boolean);
  const id = variant ? `EK-${p.id}-${variant.id}` : `EK-${p.id}`;
  const titel = `${p.naam} laadpaal inclusief installatie` + (variant ? ` – ${variant.label.toLowerCase()}` : '');
  const link = `${SITE}/laadpalen/${p.slug}/` + (variant && variant !== p.kabelVarianten[0] ? `?kabel=${encodeURIComponent(variant.id)}` : '');
  const omschrijving = `${p.kort} Inclusief professionele standaardinstallatie en load balancing, geïnstalleerd door ElektroKlik in Amersfoort en omgeving.` +
    (variant ? ` Met ${variant.label.toLowerCase()}.` : '');
  return [
    '    <item>',
    `      <g:id>${x(id)}</g:id>`,
    `      <g:title>${x(titel)}</g:title>`,
    `      <g:description>${x(omschrijving)}</g:description>`,
    `      <g:link>${x(link)}</g:link>`,
    `      <g:image_link>${x(img(fotos[0]))}</g:image_link>`,
    ...fotos.slice(1, 10).map(f => `      <g:additional_image_link>${x(img(f))}</g:additional_image_link>`),
    '      <g:availability>in_stock</g:availability>',
    `      <g:price>${prijs(variant ? variant.prijs : p.vanafprijs)}</g:price>`,
    `      <g:brand>${x(p.merk)}</g:brand>`,
    '      <g:condition>new</g:condition>',
    '      <g:identifier_exists>no</g:identifier_exists>',
    '      <g:product_type>Laadpalen &gt; Laadpaal inclusief installatie</g:product_type>',
    ...(variant ? [`      <g:item_group_id>${x('EK-' + p.id)}</g:item_group_id>`] : []),
    '      <g:shipping><g:country>NL</g:country><g:price>0.00 EUR</g:price></g:shipping>',
    '    </item>'
  ].join('\n');
}

const items = [];
for (const p of config.producten) {
  if (p.kabelVarianten && p.kabelVarianten.length) p.kabelVarianten.forEach(v => items.push(item(p, v)));
  else items.push(item(p, null));
}
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Automatisch gemaakt uit laadpalen/data/config.json door _tools/google-feed.js. Niet met de hand aanpassen. -->
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>ElektroKlik laadpalen inclusief installatie</title>
    <link>${SITE}/laadpalen/</link>
    <description>Laadpalen van ElektroKlik, inclusief professionele standaardinstallatie, load balancing en btw.</description>
${items.join('\n')}
  </channel>
</rss>
`;

if (process.argv.includes('--check')) {
  const huidig = fs.existsSync(UIT) ? fs.readFileSync(UIT, 'utf8') : '';
  if (huidig !== xml) { console.error('google-producten.xml loopt niet gelijk met config.json'); process.exit(1); }
  console.log('google-producten.xml klopt met config.json (' + items.length + ' producten)');
} else {
  fs.writeFileSync(UIT, xml);
  console.log('google-producten.xml geschreven (' + items.length + ' producten)');
}
