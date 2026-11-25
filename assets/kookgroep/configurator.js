/* ElektroKlik – kookgroep- en Perilex-configurator
 * Stappen per keuze:
 *   A aansluiten : werkzaamheden → kookplaat → gegevens
 *   B perilex    : werkzaamheden → gegevens
 *   C compleet   : werkzaamheden → aansluiting → afstand → kruipruimte → kookplaat → gegevens
 *   D weetniet   : werkzaamheden → uw situatie → (advies: verder als A, B of C, of offerte op maat) → gegevens
 * Prijzen: assets/kookgroep/config.json, berekening: assets/kookgroep/prijs.js.
 * Aanvragen gaan via hetzelfde Formspree-formulier als de rest van de website, met foto's als bijlage.
 */
(function () {
  'use strict';
  var root = document.getElementById('kookgroep');
  if (!root) return;
  var BASE = root.getAttribute('data-base') || '../../assets/kookgroep/';
  var C = null, S = KGPrijs.leegeStaat(), FILES = [], stap = 'werk', bezocht = { werk: true }, verzonden = false, gestart = false;
  var G = { voornaam: '', achternaam: '', email: '', telefoon: '', postcode: '', huisnummer: '', opmerkingen: '', akkoord: false };
  var STORE = 'ek_kookgroep_v1', MAX_PER_SOORT = 3, MAX_MB = 20;
  var NAMEN = { werk: 'Werkzaamheden', situatie: 'Uw situatie', aansluiting: 'Aansluiting', kabel: 'Afstand', route: 'Kruipruimte', kookplaat: 'Kookplaat', gegevens: 'Gegevens' };
  var FOTOS = {
    meterkast: { label: 'Foto van uw meterkast', uitleg: 'De hele meterkast in beeld. U hoeft niets open te schroeven.' },
    bestaand: { label: 'Foto van de huidige aansluiting in de keuken', uitleg: 'Bijvoorbeeld het Perilex-stopcontact, de aansluitdoos of de kabel.' },
    locatie: { label: 'Foto van de plek van de nieuwe aansluiting', uitleg: 'De plek in de keuken waar de kookplaat of het fornuis komt.' },
    typeplaatje: { label: 'Foto van het typeplaatje of aansluitschema', uitleg: 'Staat op de onderkant van de kookplaat of in de handleiding.' }
  };
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var eur = function (n) { return KGPrijs.euro(n); };
  var track = function (ev, p) { try { if (typeof window.gtag === 'function') window.gtag('event', ev, p || {}); } catch (e) {} };

  /* ---------- Stappen ---------- */
  function stappen() {
    if (S.werk === 'aansluiten') return ['werk', 'kookplaat', 'gegevens'];
    if (S.werk === 'perilex') return ['werk', 'gegevens'];
    if (S.werk === 'compleet') return ['werk', 'aansluiting', 'kabel', 'route', 'kookplaat', 'gegevens'];
    if (S.werk === 'weetniet') return ['werk', 'situatie', 'gegevens'];
    return ['werk'];
  }
  function index() { return Math.max(0, stappen().indexOf(stap)); }

  /* ---------- Bouwstenen ---------- */
  function fout(id, tekst) { return '<p class="kg-fout" id="kgf-' + id + '" hidden>' + esc(tekst || 'Maak een keuze om verder te gaan.') + '</p>'; }
  function pillen(naam, vraag, keuzes, uitleg) {
    return '<fieldset class="kg-vraag" id="kgq-' + naam + '"><legend>' + esc(vraag) + '</legend>' + (uitleg ? '<p class="kg-uitleg">' + uitleg + '</p>' : '') +
      '<div class="kg-pillen">' + keuzes.map(function (k) {
        return '<label class="kg-pil"><input type="radio" name="' + naam + '" value="' + esc(k[0]) + '"' + (S[naam] === k[0] ? ' checked' : '') + '><span>' + esc(k[1]) + '</span></label>';
      }).join('') + '</div>' + fout(naam) + '</fieldset>';
  }
  function kaarten(naam, vraag, keuzes, uitleg, kolommen) {
    return '<fieldset class="kg-vraag" id="kgq-' + naam + '"><legend>' + esc(vraag) + '</legend>' + (uitleg ? '<p class="kg-uitleg">' + uitleg + '</p>' : '') +
      '<div class="kg-keuzes' + (kolommen ? ' kg-k' + kolommen : '') + '">' + keuzes.map(function (k) {
        return '<label class="kg-keuze"><input type="radio" name="' + naam + '" value="' + esc(k.id) + '"' + (S[naam] === k.id ? ' checked' : '') + '>' +
          '<span class="kg-kaart"><span class="kg-kt">' + esc(k.titel) + '</span>' + (k.tekst ? '<span class="kg-kd">' + esc(k.tekst) + '</span>' : '') + (k.prijs ? '<span class="kg-kp">' + esc(k.prijs) + '</span>' : '') + '</span></label>';
      }).join('') + '</div>' + fout(naam) + '</fieldset>';
  }
  function melding(soort, html) { return '<div class="kg-melding kg-' + soort + '">' + html + '</div>'; }

  /* ---------- Stap: wat wilt u laten doen ---------- */
  function stapWerk() {
    return '<h3 class="kg-titel" tabindex="-1">Wat wilt u laten doen?</h3>' +
      kaarten('werk', 'Kies wat het best bij uw situatie past', [
        { id: 'aansluiten', titel: 'Alleen kookplaat of fornuis aansluiten', tekst: 'U heeft al een geschikte kookaansluiting en wilt uw apparaat laten aansluiten. Inclusief Perilex-stekker.', prijs: eur(C.werk.aansluiten.prijs) + ' incl. btw' },
        { id: 'perilex', titel: 'Perilex-stopcontact plaatsen of vervangen', tekst: 'De juiste groep en kabel zijn er al, alleen het Perilex-stopcontact moet worden geplaatst of vervangen.', prijs: eur(C.werk.perilex.prijs) + ' incl. btw' },
        { id: 'compleet', titel: 'Complete kookgroep met Perilex', tekst: 'Een nieuwe aansluiting vanuit de meterkast naar de keuken.', prijs: 'Vanaf ' + eur(C.compleet['1fase'].prijs) + ' incl. btw' },
        { id: 'weetniet', titel: 'Ik weet niet precies wat ik nodig heb', tekst: 'Beantwoord een paar eenvoudige vragen, dan helpen wij u kiezen.', prijs: 'Wij helpen u kiezen' }
      ], '', 2);
  }
  /* ---------- Stap: uw situatie (weet niet) ---------- */
  function stapSituatie() {
    var h = '<h3 class="kg-titel" tabindex="-1">Uw situatie</h3><p class="kg-intro">Geen technische kennis nodig. Kies wat u ziet; twijfelt u, kies dan “Weet ik niet”.</p>' +
      kaarten('hulpAansluiting', 'Wat zit er nu in de keuken op de plek van de kookplaat?', [
        { id: 'perilex', titel: 'Een Perilex-stopcontact', tekst: 'Een rond stopcontact met vijf gaatjes.' },
        { id: 'kabel', titel: 'Een kabel of aansluitdoos', tekst: 'Er komt een kabel uit de muur, of er zit een witte doos.' },
        { id: 'geen', titel: 'Niets, of alleen een gasaansluiting', tekst: 'Er is nog geen aansluiting voor een elektrische kookplaat.' },
        { id: 'onbekend', titel: 'Weet ik niet', tekst: 'Stuur ons straks een foto, dan kijken wij mee.' }
      ], '', 2);
    if (S.hulpAansluiting === 'perilex') h += pillen('hulpWerkte', 'Werkte er eerder een elektrische kookplaat of fornuis op dit stopcontact?', [['ja', 'Ja'], ['nee', 'Nee'], ['onbekend', 'Weet ik niet']]);
    var adv = KGPrijs.advies(S);
    if (adv && (S.hulpAansluiting !== 'perilex' || S.hulpWerkte)) {
      var label = adv.werk === 'compleet' ? 'Complete kookgroep met Perilex' : (adv.werk ? C.werk[adv.werk].label : '');
      h += melding('ok', '<b>' + (adv.werk ? 'Ons advies: ' + esc(label) : 'Wij bepalen het samen met u') + '</b><br>' + esc(adv.reden) +
        (adv.werk ? '<p style="margin:10px 0 0"><button type="button" class="kg-knop" data-advies="' + adv.werk + '">Verder met dit advies</button></p>' : ''));
    }
    return h;
  }
  /* ---------- Stap: type aansluiting ---------- */
  function stapAansluiting() {
    var h = '<h3 class="kg-titel" tabindex="-1">Welke aansluiting heeft u nodig?</h3>' +
      pillen('woningFase', 'Welke aansluiting heeft uw woning?', [['1', '1-fase'], ['3', '3-fase'], ['onbekend', 'Weet ik niet']],
        'Kijk in de meterkast: één smalle hoofdschakelaar betekent meestal 1-fase, een brede hoofdschakelaar over drie plekken betekent 3-fase.') +
      kaarten('kookplaatType', 'Welke aansluiting heeft uw kookplaat nodig?', [
        { id: '1fase', titel: '1-fase kookaansluiting', tekst: 'Voor kleinere kookplaten, tot ongeveer 3,6 kW.', prijs: eur(C.compleet['1fase'].prijs) },
        { id: '2fase', titel: '2-fase kookgroep met Perilex', tekst: 'Voor de meeste inductiekookplaten met 4 zones. Kan ook bij een woning met 1-fase.', prijs: eur(C.compleet['2fase'].prijs) },
        { id: '3fase', titel: '3-fase krachtgroep met Perilex', tekst: 'Voor grote kookplaten. Alleen bij een woning met een 3-fase-aansluiting.', prijs: eur(C.compleet['3fase'].prijs) },
        { id: 'onbekend', titel: 'Weet ik niet', tekst: 'Wij bepalen de juiste uitvoering aan de hand van het typeplaatje of de handleiding.', prijs: 'Wij bepalen het' }
      ], 'Dit staat in de handleiding of op het typeplaatje van uw kookplaat. Prijzen zijn inclusief maximaal ' + C.kabel.inbegrepenMeters + ' meter kabelaanleg en btw.', 2);
    if (S.kookplaatType === '3fase' && S.woningFase === '1') h += melding('warn', '<b>Let op:</b> voor een 3-fase krachtgroep heeft uw woning een 3-fase-aansluiting nodig. Uw aansluiting kan worden verzwaard door de netbeheerder; dat is niet inbegrepen. Wij beoordelen uw situatie en maken een offerte op maat.');
    else if (S.kookplaatType === '2fase') h += melding('info', 'Een 2-fase kookgroep bestaat uit twee groepen in de meterkast. Dat werkt ook bij een woning met een 1-fase-aansluiting.');
    h += pillen('meterkastRuimte', 'Is er nog plek in uw meterkast voor de nieuwe kookgroep?', [['ja', 'Ja'], ['nee', 'Nee'], ['onbekend', 'Weet ik niet']],
      'Kijk of er in de meterkast nog lege plekken naast de bestaande groepen zitten.');
    if (S.meterkastRuimte === 'nee' || S.meterkastRuimte === 'onbekend') h += melding('info', 'Is er geen plek, dan is een uitbreiding van de meterkast nodig. Die is niet inbegrepen in de prijs. Wij beoordelen dit aan de hand van de foto van uw meterkast en nemen het mee in uw offerte.');
    return h;
  }
  /* ---------- Stap: afstand ---------- */
  function stapKabel() {
    return '<h3 class="kg-titel" tabindex="-1">Afstand tussen meterkast en keuken</h3>' +
      pillen('afstand', 'Wat is ongeveer de afstand tussen uw meterkast en de keuken?', C.kabel.categorieen.map(function (k) { return [k.id, k.label]; }),
        'Het gaat om de route die de kabel aflegt, bijvoorbeeld langs de muur of door de kruipruimte, niet om de afstand in een rechte lijn. De eerste ' + C.kabel.inbegrepenMeters + ' meter is inbegrepen; daarboven ' + eur(C.kabel.prijsPerExtraMeter) + ' per meter.') +
      '<div class="kg-vraag"><label class="kg-label" for="kg-meters">Weet u het aantal meters? <span class="kg-opt">(optioneel)</span></label>' +
      '<input class="kg-invoer kg-kort" type="number" inputmode="numeric" min="1" max="' + C.kabel.maxMeters + '" step="1" id="kg-meters" value="' + esc(S.meters || '') + '" placeholder="Bijv. 8"> <span class="kg-eenheid">meter</span>' +
      '<p class="kg-fout" id="kgf-meters" hidden>Vul een heel aantal meters in, tussen 1 en ' + C.kabel.maxMeters + '.</p></div>';
  }
  /* ---------- Stap: kabelroute ---------- */
  function stapRoute() {
    var h = '<h3 class="kg-titel" tabindex="-1">Kruipruimte</h3>' +
      pillen('kruipruimte', 'Is er een toegankelijke kruipruimte tussen de meterkast en de keuken?', [['ja', 'Ja'], ['nee', 'Nee'], ['onbekend', 'Weet ik niet']]);
    if (S.kruipruimte === 'nee') h += melding('info', 'Zonder kruipruimte komt er ' + eur(C.geenKruipruimte.toeslag) + ' bij voor het aanleggen van de kabel.');
    return h;
  }
  /* ---------- Stap: kookplaat ---------- */
  function stapKookplaat() {
    var h = '<h3 class="kg-titel" tabindex="-1">Uw kookplaat of fornuis</h3>';
    if (S.werk === 'compleet') h += pillen('kookplaatAansluiten', 'Wilt u dat wij de kookplaat of het fornuis direct aansluiten?', [['ja', 'Ja, + ' + eur(C.kookplaatAansluiten) + ' (inclusief Perilex-stekker)'], ['nee', 'Nee']]);
    else h += '<p class="kg-intro">Wij sluiten uw kookplaat of fornuis aan, inclusief een passende Perilex-stekker. Hierbij gaan wij uit van een reeds aanwezig en geschikt Perilex-stopcontact.</p>';
    h += '<div class="kg-vraag"><label class="kg-label" for="kg-merk">Merk en type van uw kookplaat of fornuis <span class="kg-opt">(optioneel)</span></label>' +
      '<input class="kg-invoer" type="text" id="kg-merk" maxlength="120" value="' + esc(S.merkModel) + '" placeholder="Bijv. Bosch PIE631FB1E">' +
      '<p class="kg-uitleg" style="margin-top:6px">Dan controleren wij vooraf welke aansluiting nodig is. Het aansluitschema van de fabrikant en uw huidige installatie zijn altijd leidend.</p></div>';
    return h;
  }
  /* ---------- Stap: gegevens ---------- */
  function veld(id, label, type, opt) {
    opt = opt || {};
    return '<div class="kg-veld' + (opt.vol ? ' kg-vol' : '') + '"><label class="kg-label" for="kg-' + id + '">' + label + (opt.optioneel ? ' <span class="kg-opt">(optioneel)</span>' : '') + '</label>' +
      (type === 'textarea' ? '<textarea class="kg-invoer" id="kg-' + id + '" rows="3" placeholder="' + esc(opt.ph || '') + '">' + esc(G[id]) + '</textarea>'
        : '<input class="kg-invoer" type="' + type + '" id="kg-' + id + '" value="' + esc(G[id]) + '"' + (opt.ac ? ' autocomplete="' + opt.ac + '"' : '') + (opt.im ? ' inputmode="' + opt.im + '"' : '') + (opt.ph ? ' placeholder="' + esc(opt.ph) + '"' : '') + '>') +
      '<p class="kg-fout" id="kge-' + id + '" hidden></p></div>';
  }
  function fotoSoorten() {
    if (S.werk === 'aansluiten') return ['bestaand', 'typeplaatje'];
    if (S.werk === 'perilex') return ['meterkast', 'bestaand'];
    if (S.werk === 'compleet') return ['meterkast', 'locatie', 'typeplaatje'];
    return ['meterkast', 'bestaand', 'locatie', 'typeplaatje'];
  }
  function uploadBlok(id) {
    var f = FOTOS[id], mijn = FILES.filter(function (x) { return x.soort === id; });
    return '<div class="kg-upload"><p class="kg-label">' + esc(f.label) + ' <span class="kg-opt">(optioneel)</span></p><p class="kg-uitleg">' + esc(f.uitleg) + '</p>' +
      '<input type="file" class="kg-file" id="kgu-' + id + '" data-soort="' + id + '" accept="image/*,.heic,.heif" multiple>' +
      '<label for="kgu-' + id + '" class="kg-knop kg-knop-licht">' + (mijn.length ? 'Nog een foto toevoegen' : 'Kies of maak een foto') + '</label>' +
      (mijn.length ? '<ul class="kg-fotos">' + mijn.map(function (x) { var i = FILES.indexOf(x); return '<li>' + (x.preview ? '<img src="' + x.preview + '" alt="">' : '') + '<span>' + esc(x.naam) + (x.file ? '' : ' (bezig…)') + '</span><button type="button" class="kg-link" data-wisfoto="' + i + '">Verwijderen</button></li>'; }).join('') + '</ul>' : '') + '</div>';
  }
  function stapGegevens(r) {
    return '<h3 class="kg-titel" tabindex="-1">Offerte aanvragen</h3><p class="kg-intro">Vrijblijvend: u betaalt nu niets. Wij controleren uw gegevens en foto’s en sturen u een offerte.</p>' +
      overzicht(r) +
      '<div class="kg-velden">' + veld('voornaam', 'Voornaam', 'text', { ac: 'given-name' }) + veld('achternaam', 'Achternaam', 'text', { ac: 'family-name' }) +
      veld('email', 'E-mailadres', 'email', { ac: 'email', im: 'email' }) + veld('telefoon', 'Telefoonnummer', 'tel', { ac: 'tel', im: 'tel' }) +
      veld('postcode', 'Postcode', 'text', { ac: 'postal-code', ph: '1234 AB' }) + veld('huisnummer', 'Huisnummer en toevoeging', 'text', { ph: '12 A' }) +
      veld('opmerkingen', 'Opmerkingen', 'textarea', { vol: true, optioneel: true, ph: 'Bijvoorbeeld een gewenste periode of bijzonderheden over uw keuken.' }) + '</div>' +
      '<div class="kg-fotoblok"><p class="kg-label" style="font-size:1.02rem">Foto’s <span class="kg-opt">(optioneel, maar handig)</span></p><p class="kg-uitleg">Met een paar foto’s kunnen wij u een nauwkeurige offerte sturen. JPG, PNG of HEIC, maximaal ' + MAX_MB + ' MB per foto.</p>' +
      fotoSoorten().map(uploadBlok).join('') + '</div>' +
      '<input type="text" id="kg-gotcha" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">' +
      '<label class="kg-check"><input type="checkbox" id="kg-akkoord"' + (G.akkoord ? ' checked' : '') + '><span>Ik ga ermee akkoord dat ElektroKlik mijn gegevens gebruikt om mijn aanvraag te behandelen, zoals beschreven in de <a href="/privacyverklaring/" target="_blank" rel="noopener">privacyverklaring</a>.</span></label>' +
      '<p class="kg-fout" id="kge-akkoord" hidden>Geef toestemming om uw aanvraag te kunnen behandelen.</p><div id="kg-verzendfout" role="alert"></div>';
  }
  function keuzeTekst() { return KGPrijs.keuzes(C, S); }
  function overzicht(r) {
    return '<div class="kg-overzicht"><p class="kg-label">Uw keuzes</p><dl>' + keuzeTekst().map(function (x) { return '<div><dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd></div>'; }).join('') + '</dl>' +
      '<p class="kg-label" style="margin-top:14px">Prijsindicatie</p>' + prijsTabel(r) +
      '<p class="kg-uitleg" style="margin-top:8px">Dit is een prijsindicatie, geen definitieve technische goedkeuring. Wij controleren vooraf uw meterkast, de kabelroute en de aansluiting van uw kookplaat. Eventuele werkzaamheden van de netbeheerder zijn niet inbegrepen.</p>' +
      '<p style="margin:8px 0 0"><button type="button" class="kg-link" data-ga="werk">Keuzes aanpassen</button></p></div>';
  }
  function bedrag(x) { return x.min === null ? 'Op aanvraag' : (x.max === null ? (x.min === 0 ? 'Na beoordeling' : 'Vanaf ' + eur(x.min)) : (x.min === x.max ? (x.min === 0 ? 'Inbegrepen' : eur(x.min)) : eur(x.min) + ' – ' + eur(x.max))); }
  function prijsTabel(r) {
    if (r.modus === 'leeg') return '';
    return '<table class="kg-tabel"><tbody>' + r.regels.map(function (x) { return '<tr><td>' + esc(x.label) + (x.toelichting ? '<small>' + esc(x.toelichting) + '</small>' : '') + '</td><td>' + esc(bedrag(x)) + '</td></tr>'; }).join('') +
      '<tr class="kg-tot"><td>Totaal inclusief btw</td><td>' + esc(KGPrijs.prijsTekst(r)) + '</td></tr></tbody></table>' +
      (r.modus === 'vast' ? '<p class="kg-uitleg" style="margin:4px 0 0">Waarvan ' + C.btwPercentage + '% btw: € ' + r.btw.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</p>' : '');
  }

  /* ---------- Weergave ---------- */
  function render(focus) {
    var r = KGPrijs.bereken(C, S);
    var html = ({ werk: stapWerk, situatie: stapSituatie, aansluiting: stapAansluiting, kabel: stapKabel, route: stapRoute, kookplaat: stapKookplaat, gegevens: function () { return stapGegevens(r); } })[stap]();
    $('kg-stap').innerHTML = html;
    var l = stappen(), i = index();
    $('kg-voortgang').innerHTML = '<p class="kg-telling">Stap ' + (i + 1) + (S.werk ? ' van ' + l.length : '') + ': ' + NAMEN[stap] + '</p><div class="kg-balk"><span style="width:' + (S.werk ? (i + 1) / l.length * 100 : 8) + '%"></span></div>' +
      (S.werk ? '<ol class="kg-stappen">' + l.map(function (s, j) { var kan = bezocht[s] && j !== i; return '<li class="' + (j < i ? 'klaar' : (j === i ? 'nu' : '')) + '">' + (kan ? '<button type="button" data-ga="' + s + '">' + NAMEN[s] + '</button>' : NAMEN[s]) + '</li>'; }).join('') + '</ol>' : '');
    $('kg-vorige').hidden = i === 0;
    var laatste = stap === 'gegevens';
    $('kg-volgende').textContent = laatste ? 'Offerte aanvragen' : 'Volgende stap';
    prijsbalk(r);
    if (focus) { var t = $('kg-stap').querySelector('.kg-titel'); if (t) t.focus({ preventScroll: true }); var top = root.getBoundingClientRect().top + window.scrollY - 90; if (window.scrollY > top) window.scrollTo({ top: top, behavior: 'smooth' }); }
    bewaar();
  }
  function prijsbalk(r) {
    $('kg-prijs').textContent = r.modus === 'leeg' ? 'Kies wat u wilt laten doen' : KGPrijs.prijsTekst(r);
    $('kg-prijslabel').textContent = r.modus === 'opMaat' ? 'Wij maken een offerte op maat' : 'Uw prijsindicatie incl. btw';
    $('kg-opbouwknop').hidden = r.modus === 'leeg';
    $('kg-opbouw').innerHTML = prijsTabel(r) + (r.modus === 'bereik' || r.modus === 'vanaf' ? '<p class="kg-uitleg" style="margin:6px 0 0">De definitieve prijs hangt af van de werkelijke kabelroute en uw situatie.</p>' : '');
  }

  /* ---------- Validatie en navigatie ---------- */
  var VERPLICHT = {
    werk: function () { return ['werk']; },
    situatie: function () { return ['hulpAansluiting'].concat(S.hulpAansluiting === 'perilex' ? ['hulpWerkte'] : []); },
    aansluiting: function () { return ['woningFase', 'kookplaatType', 'meterkastRuimte']; },
    kabel: function () { return ['afstand']; },
    route: function () { return ['kruipruimte']; },
    kookplaat: function () { return S.werk === 'compleet' ? ['kookplaatAansluiten'] : []; },
    gegevens: function () { return []; }
  };
  function controleer() {
    var eerste = null;
    VERPLICHT[stap]().forEach(function (v) {
      var leeg = !S[v];
      var e = $('kgf-' + v); if (e) e.hidden = !leeg;
      if (leeg && !eerste) eerste = v;
    });
    if (stap === 'kabel') { var mi = $('kg-meters'); if (mi && mi.value && KGPrijs.geldigeMeters(C, mi.value) === null) { $('kgf-meters').hidden = false; if (!eerste) eerste = 'meters'; } }
    if (eerste) { var el = eerste === 'meters' ? $('kg-meters') : document.querySelector('#kgq-' + eerste + ' input'); if (el) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } return false; }
    return true;
  }
  var REGELS = {
    voornaam: function (v) { return v ? '' : 'Vul uw voornaam in.'; },
    achternaam: function (v) { return v.length >= 2 ? '' : 'Vul uw achternaam in.'; },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Vul een geldig e-mailadres in, bijvoorbeeld naam@voorbeeld.nl.'; },
    telefoon: function (v) { var t = v.replace(/[\s\-()]/g, ''); return /^(\+31|0031|0)[1-9]\d{8}$/.test(t) || /^\+\d{9,15}$/.test(t) ? '' : 'Vul een geldig telefoonnummer in, bijvoorbeeld 06 12345678.'; },
    postcode: function (v) { return /^[1-9]\d{3}\s?[a-zA-Z]{2}$/.test(v) ? '' : 'Vul een geldige postcode in, bijvoorbeeld 3811 AB.'; },
    huisnummer: function (v) { return /^\d+/.test(v) ? '' : 'Vul uw huisnummer in.'; }
  };
  function leesGegevens() { Object.keys(G).forEach(function (k) { var el = $('kg-' + k); if (el) G[k] = el.type === 'checkbox' ? el.checked : el.value; }); }
  function zetFout(id, msg) { var e = $('kge-' + id), i = $('kg-' + id); if (e) { e.hidden = !msg; e.textContent = msg || ''; } if (i) i.setAttribute('aria-invalid', msg ? 'true' : 'false'); return !msg; }
  function controleerGegevens() {
    leesGegevens(); var eerste = null;
    Object.keys(REGELS).forEach(function (k) { var m = REGELS[k](String(G[k] || '').trim()); zetFout(k, m); if (m && !eerste) eerste = k; });
    if (!zetFout('akkoord', G.akkoord ? '' : 'Geef toestemming om uw aanvraag te kunnen behandelen.') && !eerste) eerste = 'akkoord';
    if (eerste) { var el = $('kg-' + eerste); if (el) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } return false; }
    return true;
  }
  function naar(key) {
    if (stap === 'gegevens') leesGegevens();
    stap = key; bezocht[key] = true; render(true);
    track('kookgroep_stap', { stap_naam: NAMEN[key], werk: S.werk || undefined });
  }
  function volgende() {
    if (stap === 'gegevens') { if (controleerGegevens()) verstuur(); return; }
    if (!controleer()) return;
    if (stap === 'situatie' && !(KGPrijs.advies(S) || {}).werk) { naar('gegevens'); return; } // weet niet: direct naar gegevens (offerte op maat)
    var l = stappen(); naar(l[Math.min(index() + 1, l.length - 1)]);
  }

  /* ---------- Foto's ---------- */
  function isHeic(f) { return /heic|heif/i.test(f.type) || /\.(heic|heif)$/i.test(f.name); }
  function verklein(file) {
    return new Promise(function (resolve) {
      if (!/^image\//.test(file.type) || isHeic(file) || file.type === 'image/gif') return resolve({ file: file, preview: '' });
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var f = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight)), cv = document.createElement('canvas');
        cv.width = Math.round(img.naturalWidth * f); cv.height = Math.round(img.naturalHeight * f);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
        cv.toBlob(function (b) { var out = b && b.size < file.size ? new File([b], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file; resolve({ file: out, preview: URL.createObjectURL(out) }); }, 'image/jpeg', .82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve({ file: file, preview: '' }); };
      img.src = url;
    });
  }
  function voegToe(lijst, soort) {
    var melding = '';
    var werk = Array.prototype.slice.call(lijst).map(function (f) {
      if (FILES.filter(function (x) { return x.soort === soort; }).length >= MAX_PER_SOORT) { melding = 'U kunt maximaal ' + MAX_PER_SOORT + ' foto’s per onderdeel toevoegen.'; return null; }
      if (f.size > MAX_MB * 1024 * 1024) { melding = 'Een foto is groter dan ' + MAX_MB + ' MB.'; return null; }
      if (!/^image\//.test(f.type) && !isHeic(f)) { melding = 'Alleen foto’s (JPG, PNG of HEIC) zijn mogelijk.'; return null; }
      var plek = { soort: soort, naam: f.name, preview: '', file: null }; FILES.push(plek);
      return verklein(f).then(function (r) { plek.file = r.file; plek.preview = r.preview; });
    }).filter(Boolean);
    leesGegevens(); render(false);
    if (melding) alert(melding);
    Promise.all(werk).then(function () { leesGegevens(); render(false); });
  }

  /* ---------- Versturen ---------- */
  function referentie() {
    var d = new Date(), t = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '', r = new Uint8Array(5); crypto.getRandomValues(r);
    for (var i = 0; i < 5; i++) s += t[r[i] % t.length];
    return 'KG-' + String(d.getFullYear()).slice(2) + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2) + '-' + s;
  }
  function cookieTekst() { var v = null; try { v = localStorage.getItem('ek_consent_v1'); } catch (e) {} return v === 'granted' ? 'Toegestaan (Google kon deze aanvraag meten)' : (v === 'denied' ? 'Geweigerd: alleen noodzakelijk (Google kon deze aanvraag niet meten)' : 'Geen keuze gemaakt (Google kon deze aanvraag niet meten)'); }
  function klikIds() { var o = {}; ['gclid', 'gbraid', 'wbraid', 'utm_source', 'utm_medium', 'utm_campaign'].forEach(function (k) { try { var v = sessionStorage.getItem('ek_' + k); if (v) o[k] = v; } catch (e) {} }); return o; }
  function formulier(ref, r, metFotos) {
    var fd = new FormData(), add = function (k, v) { fd.append(k, v == null ? '' : String(v)); };
    var naam = G.voornaam.trim() + ' ' + G.achternaam.trim();
    add('_subject', 'Offerteaanvraag kookgroep/Perilex – ' + naam + ' – ' + ref);
    add('_replyto', G.email.trim()); add('email', G.email.trim()); add('_gotcha', ($('kg-gotcha') || {}).value || '');
    add('Referentie', ref); add('Soort aanvraag', 'Kookgroep / Perilex');
    add('Naam', naam); add('Telefoon', G.telefoon.trim()); add('Adres', G.postcode.trim().toUpperCase() + ' ' + G.huisnummer.trim());
    keuzeTekst().forEach(function (x) { add(x[0], x[1]); });
    add('Prijsopbouw', r.regels.map(function (x) { return x.label + ': ' + bedrag(x); }).join('\n') || '-');
    add('Prijsindicatie incl. btw', KGPrijs.prijsTekst(r) || 'Op aanvraag');
    add('Aandachtspunten', r.aandachtspunten.join('\n') || '-');
    add('Opmerkingen klant', G.opmerkingen.trim() || '-');
    add('Foto’s', FILES.length ? FILES.map(function (f) { return FOTOS[f.soort].label; }).join(', ') : 'Geen (klant kan later mailen of WhatsAppen met de referentie)');
    add('Prijsconfiguratie versie', C.versie); add('Cookies', cookieTekst());
    var ids = klikIds(); if (Object.keys(ids).length) add('Advertentie-ID’s', JSON.stringify(ids));
    add('Configuratie (kookgroep)', JSON.stringify({ soort: 'kookgroep', ref: ref, versie: C.versie, staat: S, prijs: { modus: r.modus, min: r.min, max: r.max }, klant: { naam: naam, email: G.email.trim(), telefoon: G.telefoon.trim(), adres: G.postcode.trim().toUpperCase() + ' ' + G.huisnummer.trim() } }));
    if (metFotos) FILES.forEach(function (f, i) { if (f.file) fd.append('upload', f.file, (ref + '-' + f.soort + '-' + (i + 1) + '-' + f.file.name).slice(0, 90)); });
    return fd;
  }
  function post(fd) { return fetch(C.formEndpoint, { method: 'POST', body: fd, headers: { Accept: 'application/json' } }).then(function (x) { if (!x.ok) throw new Error('HTTP ' + x.status); }); }
  function verstuur() {
    if (FILES.some(function (f) { return !f.file; })) { alert('Een moment, uw foto’s worden nog verwerkt.'); return; }
    var knop = $('kg-volgende'), r = KGPrijs.bereken(C, S), ref = referentie(), metFotos = FILES.length > 0, fotoFout = false;
    knop.disabled = true; knop.textContent = 'Bezig met versturen…'; $('kg-verzendfout').innerHTML = '';
    post(formulier(ref, r, metFotos)).catch(function (e) { if (!metFotos) throw e; fotoFout = true; return post(formulier(ref, r, false)); }).then(function () {
      verzonden = true; try { localStorage.removeItem(STORE); } catch (e) {}
      track('generate_lead', { lead_type: 'Kookgroep', value: r.min || undefined, currency: 'EUR', transaction_id: ref });
      try { if (typeof window.fbq === 'function') window.fbq('track', 'Lead', { lead_type: 'Kookgroep', value: r.min || undefined, currency: 'EUR' }); } catch (e) {}
      klaar(ref, fotoFout);
    }).catch(function () {
      knop.disabled = false; knop.textContent = 'Offerte aanvragen';
      $('kg-verzendfout').innerHTML = melding('warn', '<b>Uw aanvraag kon niet worden verstuurd.</b> Dit ligt niet aan u. Probeer het over een moment opnieuw, of neem direct contact met ons op: <a href="tel:' + esc(C.telefoonLink) + '">bel ' + esc(C.telefoon) + '</a> of <a href="mailto:' + esc(C.email) + '?subject=' + encodeURIComponent('Offerteaanvraag kookgroep') + '">mail ons</a>.');
      track('kookgroep_fout');
    });
  }
  function klaar(ref, fotoFout) {
    var wa = C.whatsappLink + '?text=' + encodeURIComponent('Hallo ElektroKlik, hierbij de foto’s voor mijn aanvraag ' + ref + '.');
    root.innerHTML = '<div class="kg-kaartvak kg-klaar"><div class="kg-vink" aria-hidden="true">✓</div><h3 class="kg-titel" tabindex="-1">Bedankt voor uw aanvraag</h3>' +
      '<p>Wij hebben uw aanvraag goed ontvangen. Uw referentie is <b>' + esc(ref) + '</b>.</p>' +
      '<p>Wij bekijken uw gegevens' + (FILES.length && !fotoFout ? ' en foto’s' : '') + ' en sturen u binnen 1 werkdag een offerte. Heeft u nog een vraag? Bel <a href="tel:' + esc(C.telefoonLink) + '">' + esc(C.telefoon) + '</a>.</p>' +
      (fotoFout ? melding('warn', 'Uw foto’s konden niet worden meegestuurd. Wilt u ze via <a href="' + esc(wa) + '" target="_blank" rel="noopener">WhatsApp</a> of per e-mail aan ' + esc(C.email) + ' sturen, met uw referentie?') :
        (!FILES.length ? '<p>Heeft u foto’s van uw meterkast of keuken? Stuur ze gerust via <a href="' + esc(wa) + '" target="_blank" rel="noopener">WhatsApp</a>, met uw referentie. Dan kunnen wij nog nauwkeuriger offreren.</p>' : '')) + '</div>';
    var t = root.querySelector('.kg-titel'); if (t) t.focus({ preventScroll: true });
    root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- Bewaren ---------- */
  function bewaar() { if (verzonden) return; try { localStorage.setItem(STORE, JSON.stringify({ s: S, g: Object.assign({}, G, { akkoord: false }), stap: stap, bezocht: bezocht, t: Date.now() })); } catch (e) {} }
  function herstel() {
    try {
      var d = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (!d || Date.now() - d.t > 30 * 864e5) return;
      Object.keys(S).forEach(function (k) { if (d.s && d.s[k] !== undefined) S[k] = d.s[k]; });
      Object.keys(G).forEach(function (k) { if (d.g && d.g[k] !== undefined && k !== 'akkoord') G[k] = d.g[k]; });
      bezocht = d.bezocht || { werk: true }; stap = stappen().indexOf(d.stap) > -1 ? d.stap : 'werk';
    } catch (e) {}
  }

  /* ---------- Gebeurtenissen ---------- */
  function koppel() {
    root.addEventListener('change', function (e) {
      var t = e.target;
      if (t.classList.contains('kg-file')) { voegToe(t.files, t.getAttribute('data-soort')); t.value = ''; return; }
      if (t.type === 'radio' && t.name in S) {
        if (!gestart) { gestart = true; track('kookgroep_start'); }
        S[t.name] = t.value;
        if (t.name === 'werk') { bezocht = { werk: true }; }
        if (t.name === 'hulpAansluiting' && t.value !== 'perilex') S.hulpWerkte = null;
        var er = $('kgf-' + t.name); if (er) er.hidden = true;
        var naam = t.name, waarde = t.value; render(false);
        var el = root.querySelector('input[name="' + naam + '"][value="' + waarde + '"]'); if (el) el.focus({ preventScroll: true });
        schuif(naam);
        return;
      }
      if (t.id === 'kg-akkoord') { zetFout('akkoord', ''); leesGegevens(); bewaar(); }
    });
    root.addEventListener('input', function (e) {
      var t = e.target;
      if (t.id === 'kg-meters') { var m = KGPrijs.geldigeMeters(C, t.value); S.meters = m; if (m !== null || !t.value) $('kgf-meters').hidden = true; prijsbalk(KGPrijs.bereken(C, S)); bewaar(); return; }
      if (t.id === 'kg-merk') { S.merkModel = t.value.trim().slice(0, 120); bewaar(); return; }
      if (stap === 'gegevens' && t.id && t.id.indexOf('kg-') === 0) { leesGegevens(); bewaar(); var id = t.id.slice(3); if (t.getAttribute('aria-invalid') === 'true' && REGELS[id] && !REGELS[id](t.value.trim())) zetFout(id, ''); }
    });
    root.addEventListener('click', function (e) {
      var t = e.target;
      var ga = t.closest('[data-ga]'); if (ga) { e.preventDefault(); naar(ga.getAttribute('data-ga')); return; }
      var adv = t.closest('[data-advies]'); if (adv) { S.werk = adv.getAttribute('data-advies'); bezocht = { werk: true }; track('kookgroep_advies', { advies: S.werk }); naar(stappen()[1]); return; }
      var wf = t.closest('[data-wisfoto]'); if (wf) { var f = FILES[+wf.getAttribute('data-wisfoto')]; if (f && f.preview) URL.revokeObjectURL(f.preview); FILES.splice(+wf.getAttribute('data-wisfoto'), 1); leesGegevens(); render(false); return; }
      if (t.id === 'kg-opbouwknop') { var o = $('kg-opbouw'), open = o.hidden; o.hidden = !open; t.setAttribute('aria-expanded', String(open)); t.textContent = open ? 'Prijsopbouw verbergen' : 'Bekijk prijsopbouw'; return; }
      if (t.id === 'kg-vorige') { var l = stappen(); naar(l[Math.max(index() - 1, 0)]); return; }
      if (t.id === 'kg-volgende') { volgende(); return; }
    });
  }
  /* Na een antwoord rustig naar de volgende vraag of de knop schuiven */
  function schuif(naam) {
    setTimeout(function () {
      var el = root.querySelector('input[name="' + naam + '"]'); if (!el) return;
      var vraag = el.closest('.kg-vraag'), alle = Array.prototype.slice.call(root.querySelectorAll('#kg-stap .kg-vraag, #kg-stap .kg-melding'));
      var doel = alle[alle.indexOf(vraag) + 1] || $('kg-voet'); if (!doel) return;
      var top = doel.getBoundingClientRect().top;
      if (top > window.innerHeight * 0.75) window.scrollTo({ top: window.scrollY + top - window.innerHeight * 0.45, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }, 220);
  }

  /* ---------- Start ---------- */
  (function bewaarKlikIds() { try { var q = new URLSearchParams(location.search); ['gclid', 'gbraid', 'wbraid', 'utm_source', 'utm_medium', 'utm_campaign'].forEach(function (k) { if (q.get(k)) sessionStorage.setItem('ek_' + k, q.get(k)); }); } catch (e) {} })();
  root.innerHTML = '<div class="kg-kaartvak"><div class="kg-voortgang" id="kg-voortgang"></div><form id="kg-form" novalidate><div id="kg-stap"></div></form>' +
    '<div class="kg-voet" id="kg-voet"><div class="kg-prijsvak"><span class="kg-prijslabel" id="kg-prijslabel">Uw prijsindicatie incl. btw</span><b class="kg-prijs" id="kg-prijs" aria-live="polite"></b>' +
    '<button type="button" class="kg-link" id="kg-opbouwknop" aria-expanded="false" aria-controls="kg-opbouw" hidden>Bekijk prijsopbouw</button></div>' +
    '<div class="kg-knoppen"><button type="button" class="kg-knop kg-knop-licht" id="kg-vorige">Vorige</button><button type="button" class="kg-knop" id="kg-volgende">Volgende stap</button></div>' +
    '<div class="kg-opbouw" id="kg-opbouw" hidden></div></div></div>';
  // Op de telefoon: WhatsApp-knop van de site boven de prijsbalk houden zolang de configurator in beeld is
  (function () {
    if (!('IntersectionObserver' in window)) return;
    var voet = root.querySelector('#kg-voet');
    new IntersectionObserver(function (items) {
      var zichtbaar = items[0].isIntersecting;
      document.body.classList.toggle('kg-in-beeld', zichtbaar);
      if (zichtbaar) document.body.style.setProperty('--kg-voet-h', voet.offsetHeight + 'px');
    }).observe(root);
  })();
  root.querySelector('#kg-form').addEventListener('submit', function (e) { e.preventDefault(); volgende(); });
  fetch(BASE + 'config.json', { cache: 'no-cache' }).then(function (x) { if (!x.ok) throw new Error('config'); return x.json(); }).then(function (cfg) {
    C = cfg; herstel(); koppel(); render(false);
  }).catch(function () {
    root.innerHTML = '<div class="kg-kaartvak">' + melding('warn', '<b>De prijscalculator kon niet worden geladen.</b> Ververs de pagina, of vraag een offerte aan via <a href="tel:+31850600572">085 060 05 72</a> of <a href="/offerte/">ons offerteformulier</a>.') + '</div>';
  });
})();
