/* ElektroKlik laadpaalconfigurator
 * Route: laadpaal → meterkastcontrole → (standaard: plaats en kabelroute, aansluiting, overzicht) → gegevens → versturen.
 * Bij een verouderde of onbekende meterkast: laadpaal → meterkast → gegevens → versturen (vrijblijvende offerte).
 * De aanvraag wordt verstuurd na de stap 'gegevens'. Daarna kan de klant nog foto's toevoegen (stap 'fotos', buiten de stappenlijst);
 * die gaan als aparte inzending met hetzelfde aanvraagnummer naar ElektroKlik.
 */
(function () {
  'use strict';
  var C = null;
  var S = EKPricing.leegeStaat();
  var G = { voornaam: '', achternaam: '', email: '', telefoon: '', postcode: '', huisnummer: '', straat: '', plaats: '', opmerkingen: '', akkoord: false };
  var FILES = [];               // { soort, naam, preview, file }
  var stapKey = 'laadpaal';
  var bezocht = { laadpaal: true };
  var gestart = false, verzonden = false;
  var REF = null;               // aanvraagnummer, vast vanaf de fotostap
  var STORE = 'ek_cfg_v2';
  var MAX_PER_SOORT = 3, MAX_MB = 20;

  var STANDAARD = [
    { key: 'laadpaal', naam: 'Laadpaal' }, { key: 'meterkast', naam: 'Meterkast' }, { key: 'plaats', naam: 'Plaats en kabelroute' },
    { key: 'aansluiting', naam: 'Aansluiting' }, { key: 'overzicht', naam: 'Overzicht' }, { key: 'gegevens', naam: 'Gegevens' }
  ];
  var OFFERTE = [
    { key: 'laadpaal', naam: 'Laadpaal' }, { key: 'meterkast', naam: 'Meterkast' }, { key: 'gegevens', naam: 'Gegevens' }
  ];
  var FOTO_SOORTEN = [
    { id: 'meterkast', label: 'Foto van uw meterkast (optioneel)', uitleg: 'Maak bij voorkeur een duidelijke foto waarop de volledige meterkast zichtbaar is. U hoeft niets open te schroeven.' },
    { id: 'kabelroute', label: 'Foto van de kabelroute (optioneel)', uitleg: 'Laat zien waar de kabel ongeveer moet lopen, vanaf de meterkast richting de gewenste laadpaallocatie.' },
    { id: 'locatie', label: 'Foto van de gewenste laadpaallocatie (optioneel)', uitleg: 'Maak een foto van de muur, garage of andere plek waar u de laadpaal wilt laten installeren.' }
  ];
  var INFO = {
    fase: 'Kijk op de hoofdschakelaar in uw meterkast. Staat daar bijvoorbeeld 1x35A, dan heeft u een 1-faseaansluiting. Staat er 3x25A, dan heeft u 3-fase. Twijfelt u? Kies dan ‘Weet ik niet’.',
    slimmeMeter: 'Een slimme meter heeft een digitaal display en een P1-poort (een klein aansluitpunt, vaak achter een klepje). Via die P1-poort werkt de load balancing die bij uw laadpaal is inbegrepen.',
    kruipruimte: 'Een kruipruimte is de ruimte onder de begane grondvloer, vaak bereikbaar via een luik. Via de kruipruimte kan de kabel vaak onzichtbaar naar buiten worden gelegd.',
    graafwerk: 'Graafwerk is nodig als de kabel onder de grond moet lopen, bijvoorbeeld naar een montagepaal of door de tuin.',
    zakelijk: 'Voor verrekening van laadkosten met uw werkgever of leasemaatschappij is meestal een MID-gecertificeerde meter nodig, plus een abonnement bij een verrekenpartij.'
  };
  var ICONS = { buitenmuur: 'home', garage: 'garage', paal: 'pole', anders: 'help' };
  var $ = function (id) { return document.getElementById(id); };
  var esc = EK.esc;

  function stappen() { return EKPricing.route(C, S) === 'offerte' ? OFFERTE : STANDAARD; }
  function stapIndex() { var l = stappen(); for (var i = 0; i < l.length; i++) if (l[i].key === stapKey) return i; return 0; }

  /* ---------- Opslaan en herstellen ---------- */
  function bewaar() {
    if (verzonden) return;
    try { localStorage.setItem(STORE, JSON.stringify({ s: S, g: G, stap: stapKey, bezocht: bezocht, ref: REF, t: Date.now() })); } catch (e) {}
  }
  function lees() {
    try { var d = JSON.parse(localStorage.getItem(STORE) || 'null'); if (d && Date.now() - d.t < 1000 * 60 * 60 * 24 * 60) return d; } catch (e) {}
    return null;
  }
  function wis() { try { localStorage.removeItem(STORE); } catch (e) {} }
  function deelLink() { return location.origin + location.pathname + '?c=' + encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(S))))); }
  function uitLink(param) { try { var o = JSON.parse(decodeURIComponent(escape(atob(param)))); return o && typeof o === 'object' ? o : null; } catch (e) { return null; } }
  function zuiver(o) {
    var s = EKPricing.leegeStaat();
    if (o.product && EKPricing.product(C, o.product)) s.product = o.product;
    var pz = EKPricing.product(C, s.product);
    if (pz && pz.kabelVarianten && pz.kabelVarianten.some(function (v) { return v.id === o.kabelLengte; })) s.kabelLengte = o.kabelLengte;
    EKPricing.VRAGEN.forEach(function (v) { if (o[v] && EKPricing.keuze(C, v, o[v])) s[v] = o[v]; });
    ['afstandMeters', 'graafMeters'].forEach(function (k) { var n = Math.round(Number(o[k])); if (n > 0 && n <= EKPricing.MAX_METERS) s[k] = n; });
    s.opties = Array.isArray(o.opties) ? o.opties.filter(function (id) { return !!EKPricing.optie(C, id); }) : [];
    return s;
  }

  /* ---------- Bouwstenen ---------- */
  function keuzeLabel(vraag, id) { var k = EKPricing.keuze(C, vraag, id); return k ? k.label : '–'; }
  function infoKnop(key) { return INFO[key] ? ' <button type="button" class="info-btn" aria-expanded="false" aria-controls="info-' + key + '" data-info="' + key + '">?<span class="sr-only"> Uitleg</span></button>' : ''; }
  function infoBlok(key) { return INFO[key] ? '<div class="info-pop" id="info-' + key + '" hidden>' + esc(INFO[key]) + '</div>' : ''; }
  function fout(id, tekst) { return '<p class="field-error" id="err-' + id + '" hidden>' + esc(tekst || 'Maak een keuze om verder te gaan.') + '</p>'; }

  function pills(vraag, extraNa) {
    var r = C.regels[vraag];
    return '<fieldset class="cfg-q" id="q-' + vraag + '"><legend>' + esc(r.vraag) + infoKnop(vraag) + '</legend>' + infoBlok(vraag) +
      '<div class="pills">' + r.keuzes.map(function (k) {
        return '<label class="pill"><input type="radio" name="' + vraag + '" value="' + esc(k.id) + '"' + (S[vraag] === k.id ? ' checked' : '') + '><span>' + esc(k.label) + '</span></label>';
      }).join('') + '</div>' + (extraNa || '') + fout(vraag) + '</fieldset>';
  }
  function meterVeld(id, label, hint, waarde) {
    return '<div class="fld meter-fld"><label for="m-' + id + '">' + esc(label) + '</label>' +
      '<div class="meter-input"><input id="m-' + id + '" type="number" inputmode="numeric" min="1" max="' + EKPricing.MAX_METERS + '" step="1" data-meters="' + id + '" value="' + (waarde || '') + '" aria-describedby="h-' + id + ' err-' + id + '"><span>meter</span></div>' +
      '<p class="hint" id="h-' + id + '">' + esc(hint) + '</p>' + fout(id, 'Vul een geschat aantal meters in.') + '</div>';
  }

  /* ---------- Stappen ---------- */
  function stapLaadpaal() {
    return '<h2 class="step-title" tabindex="-1">Kies uw laadpaal</h2><p class="step-intro">Alle prijzen zijn inclusief professionele standaardinstallatie, load balancing en 21% btw.</p>' +
      '<fieldset class="cfg-q" id="q-product"><legend class="sr-only">Laadpaal</legend><div class="choice-grid cols-3">' +
      C.producten.map(function (p) {
        return '<label class="choice choice-product" data-product="' + p.id + '"><input type="radio" name="product" value="' + p.id + '"' + (S.product === p.id ? ' checked' : '') + '>' +
          '<span class="box"><span class="pm">' + EK.productMedia(p) + '</span><span class="pb"><span class="pos">' + esc(p.positionering) + '</span><span class="t">' + esc(p.naam) + '</span>' +
          '<span class="d">' + esc(p.kort) + '</span>' +
          '<span class="price-from">Inclusief installatie en load balancing</span><span class="price-big">' + EK.euro(p.vanafprijs) + '</span>' + EK.conceptTag() +
          (p.kabelVarianten ? '<span class="price-note">Met vaste laadkabel van ' + esc(p.kabelVarianten[0].kort) + '</span>' : '') +
          '<a href="' + EK.productUrl(p) + '" class="btn-link" style="font-size:.88rem" target="_blank" rel="noopener">Meer informatie<span class="sr-only"> over ' + esc(p.naam) + ' (opent in nieuw tabblad)</span></a></span></span></label>';
      }).join('') + '</div>' + fout('product', 'Kies een laadpaal om verder te gaan.') + '</fieldset>' + kabelLengteVraag() +
      '<div class="notice notice-info">' + EK.icon('info') + '<div>Weet u nog niet welke laadpaal bij u past? <button type="button" class="btn-link" id="openHelper">Laat u adviseren in vier korte vragen</button></div></div><div id="miniHelper" hidden></div>';
  }

  function stapMeterkast() {
    var v = C.meterkastVoorbeelden || {};
    var groep = function (lijst, ok, tekst) {
      if (!lijst || !lijst.length) return '';
      return '<figure class="mk-ex ' + (ok ? 'ok' : 'bad') + '"><div class="mk-imgs">' + lijst.map(function (x) {
        return '<div class="mk-img"><img src="' + esc(EK.imgUrl(x.afbeelding)) + '" alt="' + esc(x.alt) + '" loading="lazy"><span class="mk-badge" aria-hidden="true">' + (ok ? '✓' : '✕') + '</span></div>';
      }).join('') + '</div><figcaption><b>' + esc(tekst) + '</b></figcaption></figure>';
    };
    var k = EKPricing.keuze(C, 'meterkast', S.meterkast);
    var melding = '';
    if (S.meterkast === 'verouderd') melding = '<div class="notice notice-warn mk-advies" role="status">' + EK.icon('warn') + '<div><b>Wij adviseren u een vrijblijvende offerte aan te vragen.</b><br>Omdat uw meterkast mogelijk aangepast of vervangen moet worden, kunnen wij niet direct een betrouwbare totaalprijs berekenen. Wij beoordelen graag uw situatie en bieden u een passende oplossing.</div></div>';
    if (S.meterkast === 'onbekend') melding = '<div class="notice notice-info mk-advies" role="status">' + EK.icon('info') + '<div><b>Geen probleem. U kunt verder met het samenstellen.</b><br>Wij controleren uw meterkast voordat de installatie wordt ingepland. Een foto van uw meterkast aan het eind van de aanvraag helpt ons daarbij.</div></div>';
    if (S.meterkast === 'geschikt-vol') melding = '<div class="notice notice-info mk-advies" role="status">' + EK.icon('info') + '<div>U kunt verder met het samenstellen. Voor het uitbreiden van uw meterkast rekenen wij € 25 extra; dit is verwerkt in uw prijsindicatie. Wij controleren vooraf of de uitbreiding veilig mogelijk is.</div></div>';
    return '<h2 class="step-title" tabindex="-1">Controleer uw meterkast</h2><p class="step-intro">Een laadpaal krijgt een eigen beveiliging in de meterkast. Vergelijk uw meterkast met de voorbeelden hieronder.</p>' +
      '<div class="mk-examples">' + groep(v.geschikt, true, 'Voorbeelden van een geschikte meterkast.') + groep(v.beoordelen, false, 'Voorbeelden van een verouderde meterkast die eerst vernieuwd moet worden.') + '</div>' +
      '<p class="price-note" style="margin:-6px 0 18px">Deze foto’s zijn alleen voorbeelden en geven geen definitieve technische goedkeuring. ElektroKlik controleert uw situatie altijd.</p>' +
      '<fieldset class="cfg-q" id="q-meterkast"><legend>' + esc(C.regels.meterkast.vraag) + '</legend><div class="choice-grid mk-choices">' +
      C.regels.meterkast.keuzes.map(function (x) {
        var ic = x.route === 'offerte' ? (x.id === 'onbekend' ? 'help' : 'warn') : 'check';
        return '<label class="choice mk-choice ' + (x.route === 'offerte' ? 'is-offerte' : 'is-ok') + '"><input type="radio" name="meterkast" value="' + x.id + '"' + (S.meterkast === x.id ? ' checked' : '') + '><span class="box"><span class="ic">' + EK.icon(ic) + '</span><span><span class="t">' + esc(x.label) + '</span></span></span></label>';
      }).join('') + '</div>' + fout('meterkast') + '</fieldset>' + melding + (k ? '' : '');
  }

  function stapPlaats() {
    var r = C.regels.locatie;
    var kh = EKPricing.beschikbareOpties(C, S).filter(function (o) { return o.optie.id === 'kabelhouder' && !o.verborgen; })[0];
    return '<h2 class="step-title" tabindex="-1">' + esc(r.vraag) + '</h2><p class="step-intro">Kies de plek die het beste past. Twijfelt u? Kies ‘Andere situatie’, dan kijken wij met u mee.</p>' +
      '<fieldset class="cfg-q" id="q-locatie"><legend class="sr-only">Montageplek</legend><div class="choice-grid">' +
      r.keuzes.map(function (k) {
        var pr = k.voegtToe === 'montagepaal' ? '<span class="pr">+ ' + EK.euro(C.regels.montagepaal.prijsPerProduct[S.product]) + '</span>' : '';
        return '<label class="choice"><input type="radio" name="locatie" value="' + esc(k.id) + '"' + (S.locatie === k.id ? ' checked' : '') + '><span class="box"><span class="ic">' + EK.icon(ICONS[k.id] || 'home') + '</span><span><span class="t">' + esc(k.label) + '</span>' + (k.uitleg ? '<span class="d">' + esc(k.uitleg) + '</span>' : '') + '</span>' + pr + '</span></label>';
      }).join('') + '</div>' + fout('locatie') + '</fieldset>' +
      (kh ? '<fieldset class="cfg-q"><legend>Extra</legend><div class="choice-grid"><label class="choice choice-check"><input type="checkbox" name="optie" value="kabelhouder"' + (S.opties.indexOf('kabelhouder') > -1 ? ' checked' : '') + '><span class="box"><span><span class="t">' + esc(kh.optie.label) + '</span><span class="d">' + esc(kh.optie.uitleg) + '</span></span><span class="pr">+ ' + EK.euro(kh.optie.prijs) + '</span></span></label></div></fieldset>' : '') +
      stapKabelroute();
  }

  function stapKabelroute() {
    var afst = C.regels.afstand;
    return '<h3 class="step-sub">De kabelroute</h3><p class="step-intro">Een schatting is voldoende. Wij controleren de kabelroute altijd voordat de installatie wordt ingepland.</p>' +
      '<fieldset class="cfg-q" id="q-afstand"><legend>' + esc(afst.vraag) + '</legend><p class="price-note" style="margin:-4px 0 10px">Meet ongeveer de route die de kabel aflegt, bijvoorbeeld langs de muur of via de kruipruimte.</p><div class="pills">' +
      afst.keuzes.map(function (k) { return '<label class="pill"><input type="radio" name="afstand" value="' + k.id + '"' + (S.afstand === k.id ? ' checked' : '') + '><span>' + esc(k.label) + '</span></label>'; }).join('') + '</div>' +
      (S.afstand === '20+' ? meterVeld('afstandMeters', 'Hoeveel meter is de kabelroute ongeveer?', 'Een schatting is voldoende, bijvoorbeeld 28.', S.afstandMeters) : '') + fout('afstand') + '</fieldset>' +
      pills('kruipruimte') +
      pills('graafwerk', S.graafwerk === 'ja' ? meterVeld('graafMeters', 'Hoeveel meter moet er ongeveer worden gegraven?', 'Een schatting is voldoende.', S.graafMeters) : '');
  }

  function stapAansluiting() {
    var p = EKPricing.product(C, S.product);
    var waarschuwing = '';
    if (S.slimmeMeter === 'nee') waarschuwing += '<div class="notice notice-warn">' + EK.icon('warn') + '<div>De load balancing bij uw laadpaal werkt via de P1-poort van een slimme meter. Heeft u geen slimme meter, dan bespreken wij de mogelijkheden met u.</div></div>';
    if (S.zakelijk === 'ja' && p && !p.midGecertificeerd) {
      var alt = C.producten.filter(function (x) { return x.midGecertificeerd; })[0];
      waarschuwing += '<div class="notice notice-warn">' + EK.icon('warn') + '<div>De ' + esc(p.naam) + ' heeft geen MID-gecertificeerde meter. Die is meestal nodig voor zakelijke verrekening. ' + (alt ? '<button type="button" class="btn-link" data-wissel="' + alt.id + '">Kies de ' + esc(alt.naam) + ' (' + EK.euro(alt.vanafprijs) + ')</button>' : '') + '</div></div>';
    }
    return '<h2 class="step-title" tabindex="-1">Uw aansluiting</h2><p class="step-intro">Geen technische kennis nodig: kies gerust ‘Weet ik niet’.</p>' +
      pills('fase') + kabelVraag() + pills('slimmeMeter') + pills('zonnepanelen') + pills('zakelijk') + waarschuwing +
      '<div class="notice notice-ok">' + EK.icon('check') + '<div>Load balancing is inbegrepen' + (p ? ': ' + esc(C.regels.loadBalancing.labelPerProduct[p.id]) : '') + '. De laadpaal past het laadvermogen automatisch aan, zodat uw hoofdzekering niet wordt overbelast.</div></div>';
  }

  function kabelKeuze() { return (S.opties || []).filter(function (id) { var o = EKPricing.optie(C, id); return o && o.groep === 'kabel'; })[0] || 'geen'; }
  /** Bij laadpalen met vaste laadkabel kiest de klant de kabellengte. */
  function kabelLengteVraag() {
    var p = EKPricing.product(C, S.product);
    if (!p || !p.kabelVarianten) return '';
    var huidig = EKPricing.kabelVariant(p, S.kabelLengte).id;
    return '<fieldset class="cfg-q" id="q-kabelLengte"><legend>Kies de lengte van de vaste laadkabel</legend><p class="price-note" style="margin:-4px 0 10px">De ' + esc(p.naam) + ' heeft een vaste Type 2-laadkabel. Een losse laadkabel is daarom niet nodig.</p><div class="choice-grid cols-3">' +
      p.kabelVarianten.map(function (v) {
        return '<label class="choice"><input type="radio" name="kabelLengte" value="' + v.id + '"' + (huidig === v.id ? ' checked' : '') + '><span class="box"><span><span class="t">' + esc(v.label) + '</span><span class="d">' + esc(p.naam) + ' inclusief installatie en load balancing</span></span><span class="pr">' + EK.euro(v.prijs) + '</span></span></label>';
      }).join('') + '</div></fieldset>';
  }
  function kabelVraag() {
    var pk = EKPricing.product(C, S.product);
    if (pk && pk.vasteKabel) return kabelLengteVraag();
    var huidig = kabelKeuze(), advies = S.fase === '1' ? 'kabel1' : (S.fase === '3' ? 'kabel3' : null);
    var kabels = C.opties.filter(function (o) { return o.groep === 'kabel'; });
    if (!kabels.length) return '';
    return '<fieldset class="cfg-q" id="q-kabel"><legend>Heeft u een laadkabel nodig?</legend><p class="price-note" style="margin:-4px 0 10px">De laadpaal heeft een Type 2-contactdoos. Veel elektrische auto’s worden met een laadkabel geleverd.</p><div class="choice-grid cols-3">' +
      '<label class="choice"><input type="radio" name="kabel" value="geen"' + (huidig === 'geen' ? ' checked' : '') + '><span class="box"><span><span class="t">Nee, ik heb al een laadkabel</span></span></span></label>' +
      kabels.map(function (o) {
        return '<label class="choice"><input type="radio" name="kabel" value="' + o.id + '"' + (huidig === o.id ? ' checked' : '') + '><span class="box"><span><span class="t">' + esc(o.kort || o.label) + (advies === o.id ? '<span class="rec">Past bij uw aansluiting</span>' : '') + '</span><span class="d">' + esc(o.uitleg) + '</span></span><span class="pr">+ ' + EK.euro(o.prijs) + '</span></span></label>';
      }).join('') + '</div></fieldset>';
  }
  function prijsTabel(r) {
    return '<table class="price-table"><tbody>' + r.regels.map(function (x) { return '<tr><td>' + esc(x.label) + '</td><td>' + EK.euro(x.bedrag) + '</td></tr>'; }).join('') +
      '<tr class="total"><td>Prijsindicatie incl. btw</td><td>' + EK.euro(r.totaal) + '</td></tr>' +
      '<tr class="sub"><td>Waarvan btw (' + C.instellingen.btwPercentage + '%)</td><td>' + EK.euro(r.btw, 2) + '</td></tr></tbody></table>' +
      (C.instellingen.prijzenGoedgekeurd ? '' : '<p style="padding:8px 18px 12px"><span class="concept-tag">' + esc(C.instellingen.conceptLabel) + '</span></p>');
  }

  function stapOverzicht(r) {
    var p = EKPricing.product(C, S.product);
    var rij = function (dt, dd) { return '<div><dt>' + esc(dt) + '</dt><dd>' + esc(dd) + '</dd></div>'; };
    var afst = keuzeLabel('afstand', S.afstand) + (S.afstand === '20+' && S.afstandMeters ? ' (circa ' + S.afstandMeters + ' m)' : '');
    var graaf = keuzeLabel('graafwerk', S.graafwerk) + (S.graafwerk === 'ja' && S.graafMeters ? ' (circa ' + S.graafMeters + ' m)' : '');
    return '<h2 class="step-title" tabindex="-1">Uw persoonlijke prijsindicatie</h2><p class="step-intro">Controleer uw keuzes. U kunt alles nog aanpassen.</p><div class="overview">' +
      '<div class="ov-card"><h3>' + esc(p.naam) + ' <button type="button" class="btn-link" data-ga="laadpaal">Wijzig</button></h3><dl class="ov-rows">' +
      rij('Inbegrepen', 'Standaardinstallatie en load balancing (' + C.regels.loadBalancing.labelPerProduct[p.id] + ')') + rij('Max. laadvermogen', p.specs.maxVermogen) + '</dl></div>' +
      '<div class="ov-card"><h3>Uw situatie <button type="button" class="btn-link" data-ga="meterkast">Wijzig</button></h3><dl class="ov-rows">' +
      rij('Meterkast', keuzeLabel('meterkast', S.meterkast)) + rij('Montageplek', keuzeLabel('locatie', S.locatie)) + rij('Kabelhouder', S.opties.indexOf('kabelhouder') > -1 ? 'Ja' : 'Nee') + (p.kabelVarianten ? rij('Vaste laadkabel', EKPricing.kabelVariant(p, S.kabelLengte).label) : rij('Laadkabel', kabelKeuze() === 'geen' ? 'Geen' : EKPricing.optie(C, kabelKeuze()).label)) +
      rij('Kabelroute', afst) + rij('Toegankelijke kruipruimte', keuzeLabel('kruipruimte', S.kruipruimte)) + rij('Graafwerk', graaf) +
      rij('Aansluiting', keuzeLabel('fase', S.fase)) + rij('Slimme meter', keuzeLabel('slimmeMeter', S.slimmeMeter)) + rij('Zonnepanelen', keuzeLabel('zonnepanelen', S.zonnepanelen)) + rij('Zakelijk verrekenen', keuzeLabel('zakelijk', S.zakelijk)) + '</dl></div>' +
      '<div class="ov-card"><h3>Prijsopbouw <span class="result-label ind">Prijsindicatie</span></h3>' + prijsTabel(r) + '</div>' +
      '<div class="ov-card"><h3>Wat is standaard inbegrepen</h3><div style="padding:14px 18px"><ul class="checks">' + C.standaardInstallatie.inbegrepen.map(function (x) { return '<li>' + EK.txt(x) + '</li>'; }).join('') + '</ul></div></div>' +
      '<div class="ov-card"><h3>Wat wij nog controleren</h3><div style="padding:14px 18px"><ul class="checks">' +
      ['Wij controleren uw meterkast, de kabelroute en de montageplek aan de hand van uw gegevens en eventuele foto’s.'].concat(r.beoordeling).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') +
      '</ul><p class="price-note" style="margin-top:10px">Kosten die nu nog niet vaststaan, zoals een eventuele uitbreiding van de meterkast, zijn niet in dit bedrag opgenomen. U ontvangt altijd eerst een definitieve offerte. Pas na uw akkoord wordt de installatie ingepland.</p></div></div>' +
      '</div>';
  }

  function veld(id, label, type, opts) {
    opts = opts || {};
    return '<div class="fld' + (opts.full ? ' full' : '') + '"><label for="f-' + id + '">' + esc(label) + (opts.optioneel ? ' <span class="opt">(optioneel)</span>' : '') + '</label>' +
      (type === 'textarea' ? '<textarea id="f-' + id + '" name="' + id + '"' + (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : '') + '>' + esc(G[id]) + '</textarea>'
        : '<input id="f-' + id + '" name="' + id + '" type="' + type + '" value="' + esc(G[id]) + '"' + (opts.ac ? ' autocomplete="' + opts.ac + '"' : '') + (opts.im ? ' inputmode="' + opts.im + '"' : '') + ' required aria-required="true"' + (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : '') + ' aria-describedby="e-' + id + (opts.hint ? ' h-' + id : '') + '">') +
      (opts.hint ? '<p class="hint" id="h-' + id + '">' + esc(opts.hint) + '</p>' : '') + '<p class="field-error" id="e-' + id + '" hidden></p></div>';
  }

  function stapGegevens() {
    var offerte = EKPricing.route(C, S) === 'offerte';
    return '<h2 class="step-title" tabindex="-1">' + (offerte ? 'Vraag vrijblijvend een offerte aan' : 'Uw gegevens') + '</h2>' +
      '<p class="step-intro">' + (offerte ? 'Laat uw gegevens achter. Wij beoordelen uw meterkast en sturen u een passende offerte voor de ' + esc(EKPricing.product(C, S.product).naam) + '.' : 'U heeft geen account nodig. U betaalt nu niets. Na uw akkoord op de offerte betaalt u 30% aanbetaling. De rest betaalt u na de installatie.') + '</p>' +
      '<div class="form-grid">' +
      veld('voornaam', 'Voornaam', 'text', { ac: 'given-name' }) + veld('achternaam', 'Achternaam', 'text', { ac: 'family-name' }) +
      veld('email', 'E-mailadres', 'email', { ac: 'email', im: 'email', hint: 'Hier sturen wij de bevestiging en de offerte naartoe.' }) +
      veld('telefoon', 'Telefoonnummer', 'tel', { ac: 'tel', im: 'tel', hint: 'Zodat wij u kunnen bellen bij een vraag.' }) +
      veld('postcode', 'Postcode', 'text', { ac: 'postal-code', ph: '1234 AB' }) + veld('huisnummer', 'Huisnummer en toevoeging', 'text', { ph: '12 A' }) +
      veld('straat', 'Straat', 'text', { ac: 'address-line1', ph: 'Wordt automatisch ingevuld' }) + veld('plaats', 'Plaats', 'text', { ac: 'address-level2', ph: 'Wordt automatisch ingevuld' }) +
      veld('opmerkingen', 'Aanvullende opmerkingen', 'textarea', { full: true, optioneel: true, ph: 'Bijvoorbeeld uw automodel, een gewenste periode of bijzonderheden over uw woning.' }) +
      '<div class="full"><input type="text" name="_gotcha" id="f-gotcha" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true"></div>' +
      '<div class="full"><label class="consent"><input type="checkbox" id="f-akkoord" name="akkoord"' + (G.akkoord ? ' checked' : '') + ' aria-describedby="e-akkoord"><span>Ik ga ermee akkoord dat ElektroKlik mijn gegevens gebruikt om mijn aanvraag te behandelen, zoals beschreven in de <a href="' + esc(C.instellingen.privacyUrl || '/privacy.html') + '" target="_blank" rel="noopener">privacyverklaring</a>.</span></label><p class="field-error" id="e-akkoord" hidden></p></div>' +
      '</div><p class="price-note" style="margin-top:14px">Na het versturen kunt u nog foto’s toevoegen. Dat is niet verplicht.</p><div id="sendError" role="alert"></div>';
  }

  function stapFotos() {
    var offerte = EKPricing.route(C, S) === 'offerte';
    var wa = C.instellingen.whatsappLink + '?text=' + encodeURIComponent('Hallo ElektroKlik, hierbij de foto’s voor mijn laadpaalaanvraag ' + REF + '.');
    return '<div class="notice notice-ok" style="margin-bottom:18px">' + EK.icon('check') + '<div><b>Uw aanvraag is verstuurd.</b> Uw aanvraagnummer is <span class="ref">' + esc(REF) + '</span>. Wij nemen binnen 1 werkdag contact met u op.</div></div>' +
      '<h2 class="step-title" tabindex="-1">Wilt u nog foto’s toevoegen?</h2>' +
      '<p class="step-intro">Met enkele foto’s kunnen wij uw installatie beter voorbereiden en uw aanvraag sneller beoordelen. Het toevoegen van foto’s is niet verplicht.</p>' +
      FOTO_SOORTEN.map(uploadBlok).join('') +
      '<div class="later-box"><h3>Heeft u op dit moment geen foto’s bij de hand?</h3><p>Geen probleem. U kunt uw aanvraag afronden en de foto’s later naar ons toesturen. Dit kan eenvoudig per e-mail of via WhatsApp. Vermeld dan uw aanvraagnummer: <span class="ref">' + esc(REF) + '</span></p>' +
      '<p><b>E-mail:</b> <a href="mailto:' + esc(C.instellingen.email) + '?subject=' + encodeURIComponent('Foto’s bij aanvraag ' + REF) + '">' + esc(C.instellingen.email) + '</a><br><b>Telefoon:</b> <a href="tel:' + esc(C.instellingen.telefoonLink) + '">' + esc(C.instellingen.telefoon) + '</a></p>' +
      '<a class="btn btn-ghost" href="' + esc(wa) + '" target="_blank" rel="noopener">' + EK.icon('chat') + ' Foto’s later via WhatsApp versturen</a></div>' +
      '<div class="notice notice-info" style="margin-top:18px">' + EK.icon('shield') + '<div>Uw foto’s worden versleuteld verzonden en alleen gebruikt voor de behandeling van uw aanvraag.</div></div>' +
      '<div id="sendError" role="alert"></div>';
  }

  function uploadBlok(s) {
    var mijn = FILES.filter(function (f) { return f.soort === s.id; });
    return '<div class="cfg-q upload-q"><p class="q-label">' + esc(s.label) + '</p><p class="price-note" style="margin:-4px 0 8px">' + esc(s.uitleg) + '</p>' +
      '<div class="upload" data-soort="' + s.id + '">' +
      '<input type="file" id="up-' + s.id + '" accept="image/*,.heic,.heif" data-soort="' + s.id + '" multiple>' +
      '<label for="up-' + s.id + '" class="btn btn-ghost">' + EK.icon('upload') + (mijn.length ? ' Nog een foto toevoegen' : ' Kies of maak een foto') + '</label>' +
      '<p class="price-note" style="margin-top:6px">JPG, PNG of HEIC, maximaal ' + MAX_MB + ' MB per foto, maximaal ' + MAX_PER_SOORT + ' foto’s.</p>' +
      '<ul class="upload-list">' + mijn.map(function (f) {
        var i = FILES.indexOf(f);
        return '<li>' + (f.preview ? '<img src="' + f.preview + '" alt="">' : '<span class="up-noprev">' + EK.icon('upload') + '</span>') + '<span>' + esc(f.naam) + (f.file ? '' : ' (bezig…)') + '</span><button type="button" class="btn-link" data-del="' + i + '">Verwijder<span class="sr-only"> ' + esc(f.naam) + '</span></button></li>';
      }).join('') + '</ul></div></div>';
  }

  /* ---------- Foto's verwerken ---------- */
  function isHeic(f) { return /heic|heif/i.test(f.type) || /\.(heic|heif)$/i.test(f.name); }
  function verkleinFoto(file) {
    return new Promise(function (resolve) {
      if (!/^image\//.test(file.type) || isHeic(file) || file.type === 'image/gif') return resolve({ file: file, preview: '' });
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var max = 2000, f = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        var cv = document.createElement('canvas'); cv.width = Math.round(img.naturalWidth * f); cv.height = Math.round(img.naturalHeight * f);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        cv.toBlob(function (b) {
          var out = b && b.size < file.size ? new File([b], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
          resolve({ file: out, preview: URL.createObjectURL(out) });
        }, 'image/jpeg', .82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve({ file: file, preview: '' }); };
      img.src = url;
    });
  }
  function voegBestandenToe(lijst, soort) {
    var melding = '';
    var werk = Array.prototype.slice.call(lijst).map(function (f) {
      if (FILES.filter(function (x) { return x.soort === soort; }).length >= MAX_PER_SOORT) { melding = 'U kunt maximaal ' + MAX_PER_SOORT + ' foto’s per onderdeel toevoegen.'; return null; }
      if (!/^image\//.test(f.type) && !isHeic(f)) { melding = '“' + f.name + '” is geen foto. Kies een JPG-, PNG- of HEIC-bestand.'; return null; }
      if (f.size > MAX_MB * 1024 * 1024) { melding = '“' + f.name + '” is groter dan ' + MAX_MB + ' MB. Kies een kleinere foto.'; return null; }
      var plek = { soort: soort, naam: f.name, preview: '', file: null };
      FILES.push(plek);
      return verkleinFoto(f).then(function (r) { plek.file = r.file; plek.preview = r.preview; });
    }).filter(Boolean);
    render(false);
    Promise.all(werk).then(function () { render(false); EK.track('foto_toegevoegd', { soort: soort }); });
    if (melding) EK.toast(melding);
  }

  /* ---------- Weergave ---------- */
  function render(focus) {
    var r = EKPricing.bereken(C, S);
    var html = ({ laadpaal: stapLaadpaal, meterkast: stapMeterkast, plaats: stapPlaats, aansluiting: stapAansluiting, overzicht: function () { return stapOverzicht(r); }, gegevens: stapGegevens, fotos: stapFotos })[stapKey]();
    $('stepHost').innerHTML = html;
    var offerte = r.route === 'offerte';
    $('btnBack').style.visibility = (stapKey === 'laadpaal' || stapKey === 'fotos') ? 'hidden' : 'visible';
    if ($('btnSave')) $('btnSave').parentNode.hidden = stapKey === 'fotos'; // na versturen valt er niets meer te bewaren
    var next = $('btnNext');
    if (stapKey === 'meterkast' && offerte) next.textContent = 'Vraag vrijblijvend een offerte aan';
    else if (stapKey === 'overzicht') next.textContent = 'Vraag uw definitieve prijs aan';
    else if (stapKey === 'gegevens') next.textContent = offerte ? 'Vraag vrijblijvend een offerte aan' : 'Vraag uw definitieve prijs aan';
    else if (stapKey === 'fotos') next.textContent = FILES.length ? 'Foto’s versturen en afronden' : 'Afronden zonder foto’s';
    else next.textContent = 'Volgende stap';
    renderVoortgang(); renderSamenvatting(r);
    if (focus) {
      var h = $('stepHost').querySelector('.step-title'); if (h) h.focus({ preventScroll: true });
      var top = document.querySelector('.cfg').getBoundingClientRect().top + window.scrollY - 90;
      if (window.scrollY > top) window.scrollTo({ top: top, behavior: 'smooth' });
    }
    bewaar();
  }

  function renderVoortgang() {
    var l = stappen(), idx = stapIndex();
    $('progressList').style.gridTemplateColumns = 'repeat(' + l.length + ', 1fr)';
    if (stapKey === 'fotos') {
      $('progressList').innerHTML = l.map(function (s, i) { return '<li class="done">' + (i + 1) + '. ' + s.naam + '</li>'; }).join('');
      $('progressCount').textContent = 'Uw aanvraag is verstuurd';
      $('progressBar').style.width = '100%';
      return;
    }
    $('progressList').innerHTML = l.map(function (s, i) {
      var cls = i < idx ? 'done' : (i === idx ? 'current' : '');
      var kan = bezocht[s.key] && i !== idx;
      return '<li class="' + cls + '"' + (i === idx ? ' aria-current="step"' : '') + '>' + (kan ? '<button type="button" data-ga="' + s.key + '">' + (i + 1) + '. ' + s.naam + '</button>' : (i + 1) + '. ' + s.naam) + '</li>';
    }).join('');
    $('progressCount').textContent = 'Stap ' + (idx + 1) + ' van ' + l.length + ': ' + l[idx].naam;
    $('progressBar').style.width = ((idx + 1) / l.length * 100) + '%';
  }

  function samenvattingHTML(r) {
    var p = EKPricing.product(C, S.product);
    if (!p) return '<div class="summary-empty"><b style="color:var(--ek-ink);display:block;margin-bottom:4px">Uw prijsindicatie</b>Kies een laadpaal om uw prijs te zien. Alle prijzen zijn inclusief standaardinstallatie, load balancing en btw.</div>';
    var head = '<div class="summary-head"><span class="thumb">' + EK.productMedia(p) + '</span><div><b>' + esc(p.naam) + '</b><span>Inclusief installatie en load balancing</span></div></div>';
    var foot = '<div class="summary-foot"><span>Vragen? <a href="tel:' + C.instellingen.telefoonLink + '">Bel ' + esc(C.instellingen.telefoon) + '</a> of <a href="' + C.instellingen.whatsappLink + '" target="_blank" rel="noopener">WhatsApp</a></span></div>';
    if (r.route === 'offerte') return head + '<div class="summary-total"><div class="row"><span>Vanaf</span><b>' + EK.euro(EKPricing.productPrijs(p, S.kabelLengte)) + '</b></div><small>Voor uw situatie maken wij een vrijblijvende offerte op maat, omdat uw meterkast eerst beoordeeld moet worden.</small></div>' + foot;
    var regels = r.regels.filter(function (x) { return x.groep === 'zichtbaar'; }).map(function (x) { return '<li><span>' + esc(x.id === 'product' ? (p.kabelVarianten ? 'Laadpaal (kabel ' + EKPricing.kabelVariant(p, S.kabelLengte).kort + '), installatie en load balancing' : 'Laadpaal, installatie en load balancing') : x.label) + '</span><span>' + EK.euro(x.bedrag) + '</span></li>'; });
    if (r.situatieTotaal) regels.push('<li><span>Aanpassingen voor uw situatie</span><span>' + EK.euro(r.situatieTotaal) + '</span></li>');
    return head + '<ul class="summary-lines">' + regels.join('') + '</ul>' +
      '<div class="summary-total"><div class="row"><span>Prijsindicatie</span><b>' + EK.euro(r.totaal) + '</b></div><small>Inclusief ' + C.instellingen.btwPercentage + '% btw (' + EK.euro(r.btw, 2) + ')</small>' +
      (C.instellingen.prijzenGoedgekeurd ? '' : '<small><span class="concept-tag">' + esc(C.instellingen.conceptLabel) + '</span></small>') + '</div>' + foot;
  }
  function renderSamenvatting(r) {
    $('summary').innerHTML = samenvattingHTML(r);
    var p = EKPricing.product(C, S.product);
    $('mbTotal').innerHTML = p ? (r.route === 'offerte' ? '<small class="vanaf-s">vanaf </small>' + EK.euro(EKPricing.productPrijs(p, S.kabelLengte)) : EK.euro(r.totaal)) : 'Kies een laadpaal';
    $('mbLabel').textContent = r.route === 'offerte' ? 'Offerte op maat' : 'Uw prijsindicatie incl. btw';
    $('mbOpen').hidden = !p;
    if ($('sheet').open) $('sheetBody').innerHTML = samenvattingHTML(r);
  }

  /* ---------- Validatie ---------- */
  function verplicht(vragen) {
    var eerste = null;
    vragen.forEach(function (v) {
      var leeg = v === 'afstandMeters' ? !(S.afstandMeters > 20) : (v === 'graafMeters' ? !(S.graafMeters > 0) : !S[v]);
      var err = $('err-' + v); if (err) { err.hidden = !leeg; if (v === 'afstandMeters' && leeg) err.textContent = 'Vul het geschatte aantal meters in (meer dan 20).'; }
      if (leeg && !eerste) eerste = v;
    });
    if (eerste) {
      var el = $('m-' + eerste) || document.querySelector('#q-' + eerste + ' input');
      if (el) { el.focus(); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      return false;
    }
    return true;
  }
  function zetFout(id, msg) {
    var e = $('e-' + id), inp = $('f-' + id);
    if (e) { e.hidden = !msg; e.textContent = msg || ''; }
    if (inp) inp.setAttribute('aria-invalid', msg ? 'true' : 'false');
    return !msg;
  }
  var REGELS = {
    voornaam: function (v) { return v.length >= 1 ? '' : 'Vul uw voornaam in.'; },
    achternaam: function (v) { return v.length >= 2 ? '' : 'Vul uw achternaam in.'; },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Vul een geldig e-mailadres in, bijvoorbeeld naam@voorbeeld.nl.'; },
    telefoon: function (v) { var t = v.replace(/[\s\-()]/g, ''); return /^(\+31|0031|0)[1-9]\d{8}$/.test(t) || /^\+\d{9,15}$/.test(t) ? '' : 'Vul een geldig telefoonnummer in, bijvoorbeeld 06 12345678.'; },
    postcode: function (v) { return /^[1-9]\d{3}\s?[a-zA-Z]{2}$/.test(v) ? '' : 'Vul een geldige postcode in, bijvoorbeeld 3811 AB.'; },
    huisnummer: function (v) { return /^\d+/.test(v) ? '' : 'Vul uw huisnummer in.'; },
    straat: function (v) { return v.length >= 2 ? '' : 'Vul uw straatnaam in.'; },
    plaats: function (v) { return v.length >= 2 ? '' : 'Vul uw woonplaats in.'; }
  };
  function leesGegevens() {
    Object.keys(G).forEach(function (k) { var el = $('f-' + k); if (el) G[k] = el.type === 'checkbox' ? el.checked : el.value; });
  }
  function valideerGegevens() {
    leesGegevens();
    var eerste = null;
    Object.keys(REGELS).forEach(function (k) { var m = REGELS[k](String(G[k]).trim()); zetFout(k, m); if (m && !eerste) eerste = k; });
    var ak = zetFout('akkoord', G.akkoord ? '' : 'Geef toestemming om uw aanvraag te kunnen behandelen.'); if (!ak && !eerste) eerste = 'akkoord';
    if (eerste) { var el = $('f-' + eerste); if (el) { el.focus(); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } return false; }
    return true;
  }

  /* ---------- Navigatie ---------- */
  function naar(key) {
    if (stapKey === 'gegevens') leesGegevens();
    stapKey = key; bezocht[key] = true;
    render(true);
    var l = stappen(), idx = stapIndex();
    if (key === 'fotos') EK.track('configurator_stap', { stap_nummer: l.length + 1, stap_naam: 'Foto’s (na versturen)', route: EKPricing.route(C, S), laadpaal: S.product || undefined });
    else EK.track('configurator_stap', { stap_nummer: idx + 1, stap_naam: l[idx].naam, route: EKPricing.route(C, S), laadpaal: S.product || undefined });
    var r = EKPricing.bereken(C, S);
    if (key === 'overzicht') EK.track('configurator_overzicht', { currency: 'EUR', value: r.totaal, laadpaal: S.product });
    if (key === 'gegevens') EK.track('begin_checkout', { currency: 'EUR', value: r.totaal, route: r.route, items: [EK.gaItem(EKPricing.product(C, S.product))] });
  }
  function volgende() {
    var VERPLICHT = {
      laadpaal: ['product'], meterkast: ['meterkast'],
      plaats: ['locatie', 'afstand'].concat(S.afstand === '20+' ? ['afstandMeters'] : []).concat(['kruipruimte', 'graafwerk']).concat(S.graafwerk === 'ja' ? ['graafMeters'] : []),
      aansluiting: ['fase', 'slimmeMeter', 'zonnepanelen', 'zakelijk']
    };
    if (VERPLICHT[stapKey] && !verplicht(VERPLICHT[stapKey])) return;
    if (stapKey === 'gegevens') { if (valideerGegevens()) verstuur(); return; }
    if (stapKey === 'meterkast' && EKPricing.route(C, S) === 'offerte') EK.track('meterkast_offerteroute', { keuze: S.meterkast, laadpaal: S.product });
    if (stapKey === 'fotos') { verstuurFotos(); return; }
    var l = stappen(); naar(l[Math.min(stapIndex() + 1, l.length - 1)].key);
  }

  /* ---------- Versturen ---------- */
  function referentie() {
    var d = new Date(), chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '', rnd = new Uint8Array(5);
    (window.crypto || window.msCrypto).getRandomValues(rnd);
    for (var i = 0; i < 5; i++) s += chars[rnd[i] % chars.length];
    return 'EK-' + String(d.getFullYear()).slice(2) + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2) + '-' + s;
  }

  function verstuur() {
    if (!REF) REF = referentie();
    var btn = $('btnNext'), oud = btn.textContent;
    btn.disabled = true; btn.textContent = 'Bezig met versturen…'; $('sendError').innerHTML = '';
    var getoond = EKPricing.bereken(C, S);
    fetch(EK.base + 'data/config.json', { cache: 'no-store' }).then(function (x) { if (!x.ok) throw new Error('cfg'); return x.json(); }).then(function (vers) {
      if (EKPricing.valideerConfig(vers).length) throw new Error('Prijsconfiguratie ongeldig');
      var r = EKPricing.bereken(vers, S);
      if (r.totaal !== getoond.totaal || r.route !== getoond.route) {
        C = vers; renderSamenvatting(r);
        $('sendError').innerHTML = '<div class="notice notice-warn" style="margin-top:14px">' + EK.icon('warn') + '<div>Onze prijzen zijn zojuist bijgewerkt. Uw nieuwe prijsindicatie is ' + EK.euro(r.totaal) + '. Controleer het bedrag en verstuur uw aanvraag opnieuw.</div></div>';
        btn.disabled = false; btn.textContent = oud; return;
      }
      return verzend(vers, r).then(function () { btn.disabled = false; if (stapKey !== 'fotos') btn.textContent = oud; });
    }).catch(function (e) { console.error(e); toonVerzendFout(null); btn.disabled = false; btn.textContent = oud; });
  }

  function bouwFormData(cfg, r, metBestanden) {
    var p = EKPricing.product(cfg, S.product);
    var offerte = r.route === 'offerte';
    var fd = new FormData();
    var add = function (k, v) { fd.append(k, v == null ? '' : String(v)); };
    add('_subject', (offerte ? 'Offerteaanvraag laadpaal (meterkast beoordelen)' : 'Laadpaal prijsaanvraag') + ' – ' + G.voornaam + ' ' + G.achternaam + ' – ' + REF);
    add('_replyto', G.email.trim()); add('email', G.email.trim());
    add('_gotcha', ($('f-gotcha') || {}).value || '');
    add('Aanvraagnummer', REF);
    add('Soort aanvraag', offerte ? 'Vrijblijvende offerte (meterkast verouderd of onbekend)' : 'Aanvraag definitieve prijs (standaardroute)');
    add('Status', 'Nieuw');
    add('Naam', G.voornaam.trim() + ' ' + G.achternaam.trim());
    add('Telefoon', G.telefoon.trim());
    add('Installatieadres', G.straat.trim() + ' ' + G.huisnummer.trim() + ', ' + G.postcode.trim().toUpperCase() + ' ' + G.plaats.trim());
    var kvf = EKPricing.kabelVariant(p, S.kabelLengte);
    add('Laadpaal', p.naam + (kvf ? ' met ' + kvf.label.toLowerCase() : '') + ' (incl. load balancing: ' + cfg.regels.loadBalancing.labelPerProduct[p.id] + ')');
    if (kvf) add('Vaste laadkabel', kvf.label + ' (' + EK.euro(kvf.prijs) + ' incl. installatie en load balancing)');
    add('Meterkast', keuzeLabel('meterkast', S.meterkast));
    if (!offerte) {
      add('Montageplek', keuzeLabel('locatie', S.locatie));
      add('Montagepaal', S.locatie === 'paal' ? 'Ja' : 'Nee');
      add('Kabelhouder', S.opties.indexOf('kabelhouder') > -1 ? 'Ja' : 'Nee');
      add('Laadkabel', kvf ? 'Vaste laadkabel van de laadpaal: ' + kvf.label : (kabelKeuze() === 'geen' ? 'Nee' : EKPricing.optie(cfg, kabelKeuze()).label));
      add('Kabelafstand', keuzeLabel('afstand', S.afstand) + (S.afstand === '20+' ? ' (circa ' + S.afstandMeters + ' m)' : ''));
      add('Kruipruimte', keuzeLabel('kruipruimte', S.kruipruimte));
      add('Graafwerk', keuzeLabel('graafwerk', S.graafwerk) + (S.graafwerk === 'ja' ? ' (circa ' + S.graafMeters + ' m)' : ''));
      add('Aansluiting', keuzeLabel('fase', S.fase));
      add('Slimme meter', keuzeLabel('slimmeMeter', S.slimmeMeter));
      add('Zonnepanelen', keuzeLabel('zonnepanelen', S.zonnepanelen));
      add('Zakelijk verrekenen', keuzeLabel('zakelijk', S.zakelijk));
      add('Prijsopbouw (intern)', r.regels.map(function (x) { return x.label + ': ' + EK.euro(x.bedrag); }).join('\n'));
      add('Prijsindicatie incl. btw', EK.euro(r.totaal) + ' (waarvan btw ' + EK.euro(r.btw, 2) + ')');
    } else add('Prijsindicatie incl. btw', 'Geen – offerte op maat (vanafprijs laadpaal ' + EK.euro(EKPricing.productPrijs(p, S.kabelLengte)) + ')');
    add('Nog te controleren', r.beoordeling.join('\n') || 'Standaardcontrole');
    add('Interne bijzonderheden', r.intern.join('\n') || '-');
    add('Opmerkingen klant', G.opmerkingen.trim() || '-');
    add('Foto’s', 'Volgen eventueel in een aparte e-mail “Foto’s bij aanvraag ' + REF + '” (de klant kan ze na het versturen toevoegen, of later mailen of WhatsAppen)');
    add('Prijsconfiguratie versie', cfg.versie);
    var ids = EK.clickIds(); if (Object.keys(ids).length) add('Advertentie-ID’s', JSON.stringify(ids));
    add('Configuratie (technisch)', JSON.stringify({ ref: REF, route: r.route, staat: S, totaal: r.totaal, regels: r.regels, intern: r.intern, versie: cfg.versie, klant: { naam: G.voornaam + ' ' + G.achternaam, email: G.email, telefoon: G.telefoon, adres: G.straat + ' ' + G.huisnummer + ', ' + G.postcode + ' ' + G.plaats } }));
    if (metBestanden) FILES.forEach(function (f, i) { if (f.file) fd.append('upload', f.file, (REF + '-' + f.soort + '-' + (i + 1) + '-' + f.file.name).slice(0, 90)); });
    return fd;
  }
  function post(cfg, fd) {
    return fetch(cfg.instellingen.formEndpoint, { method: 'POST', body: fd, headers: { Accept: 'application/json' } }).then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res; });
  }
  var AANVRAAG = null; // overzicht van de verstuurde aanvraag (voor de bedankpagina en de conversiemeting)
  function bewaarAanvraag() { try { localStorage.setItem('ek_laatste_aanvraag', JSON.stringify(AANVRAAG)); } catch (e) {} }
  function verzend(cfg, r) {
    AANVRAAG = { referentie: REF, datum: new Date().toISOString(), naam: G.voornaam + ' ' + G.achternaam, email: G.email, product: S.product, type: r.route, regels: r.regels, totaal: r.totaal, fotos: 0, foutUpload: false, status: 'versturen' };
    bewaarAanvraag();
    return post(cfg, bouwFormData(cfg, r, false))
      .then(function () {
        AANVRAAG.status = 'verstuurd'; bewaarAanvraag();
        verzonden = true; wis();
        EK.meetAanvraag(AANVRAAG); // conversie direct meten, ook als de klant de fotostap niet afmaakt
        naar('fotos');
      })
      .catch(function (e) { console.error(e); toonVerzendFout(r); });
  }
  /* Foto's na het versturen: aparte inzending met hetzelfde aanvraagnummer. Daarna naar de bedankpagina. */
  function verstuurFotos() {
    if (FILES.some(function (f) { return !f.file; })) { EK.toast('Een moment, uw foto’s worden nog verwerkt.'); return; }
    var klaar = function () { location.href = EK.base + 'bedankt/'; };
    var met = FILES.filter(function (f) { return f.file; });
    if (!met.length) { EK.track('fotos_overgeslagen', { laadpaal: S.product }); klaar(); return; }
    var btn = $('btnNext'); btn.disabled = true; btn.textContent = 'Bezig met versturen…';
    var fd = new FormData(), add = function (k, v) { fd.append(k, v == null ? '' : String(v)); };
    add('_subject', 'Foto’s bij aanvraag ' + REF + ' – ' + G.voornaam + ' ' + G.achternaam);
    add('_replyto', G.email.trim()); add('email', G.email.trim());
    add('Foto’s bij aanvraag', REF);
    add('Naam', G.voornaam.trim() + ' ' + G.achternaam.trim());
    add('Telefoon', G.telefoon.trim());
    add('Foto’s', met.map(function (f) { return f.soort; }).join(', '));
    met.forEach(function (f, i) { fd.append('upload', f.file, (REF + '-' + f.soort + '-' + (i + 1) + '-' + f.file.name).slice(0, 90)); });
    post(C, fd).then(function () {
      if (AANVRAAG) { AANVRAAG.fotos = met.length; AANVRAAG.foutUpload = false; bewaarAanvraag(); }
      EK.track('fotos_verstuurd', { aantal: met.length, laadpaal: S.product });
    }).catch(function (e) {
      console.error(e);
      if (AANVRAAG) { AANVRAAG.foutUpload = true; bewaarAanvraag(); }
      EK.track('fotos_fout', { laadpaal: S.product });
    }).then(klaar);
  }
  function toonVerzendFout(r) {
    var tekst = r ? 'Aanvraag laadpaal ' + REF + '\nLaadpaal: ' + r.regels[0].label + '\nPrijsindicatie: ' + EK.euro(r.totaal) + '\n\nNaam: ' + G.voornaam + ' ' + G.achternaam + '\nTelefoon: ' + G.telefoon + '\nAdres: ' + G.straat + ' ' + G.huisnummer + ', ' + G.postcode + ' ' + G.plaats : '';
    $('sendError').innerHTML = '<div class="notice notice-warn" style="margin-top:14px">' + EK.icon('warn') + '<div><b>Uw aanvraag kon niet worden verstuurd.</b> Dit ligt niet aan u. Uw keuzes en gegevens zijn bewaard. Probeer het over een moment opnieuw, of neem direct contact met ons op: <a href="tel:' + C.instellingen.telefoonLink + '">bel ' + esc(C.instellingen.telefoon) + '</a>' +
      (r ? ' of <a href="mailto:' + esc(C.instellingen.email) + '?subject=' + encodeURIComponent('Aanvraag laadpaal ' + REF) + '&body=' + encodeURIComponent(tekst) + '">stuur uw aanvraag per e-mail</a>' : '') + '.</div></div>';
    EK.track('aanvraag_fout', { laadpaal: S.product });
  }

  /* ---------- Mini-keuzehulp ---------- */
  function toonMiniHelper() {
    var host = $('miniHelper'); host.hidden = false;
    var q = function (naam, legend, opts) { return '<fieldset class="helper-q"><legend>' + legend + '</legend><div class="pills">' + opts.map(function (o) { return '<label class="pill"><input type="radio" name="' + naam + '" value="' + o[0] + '"><span>' + o[1] + '</span></label>'; }).join('') + '</div></fieldset>'; };
    host.innerHTML = '<div id="mhForm" class="ov-card" style="padding:18px"><h3 style="padding:0;background:none;border:0;margin-bottom:12px">Laat u adviseren</h3>' +
      q('zakelijk_h', 'Wilt u laadkosten verrekenen met uw werkgever of bedrijf?', [['ja', 'Ja'], ['nee', 'Nee'], ['weet', 'Weet ik nog niet']]) +
      q('prioriteit', 'Wat vindt u het belangrijkst?', [['prijs', 'Een scherpe prijs'], ['design', 'Premium ontwerp en slimme functies'], ['uitgebreid', 'Uitgebreide mogelijkheden']]) +
      q('bediening', 'Hoe wilt u uw laadpaal het liefst gebruiken?', [['app', 'Via een app'], ['eenvoud', 'Zo eenvoudig mogelijk'], ['backoffice', 'Via werkgever of laadpasprovider']]) +
      '<p class="field-error" hidden role="alert"></p><button type="button" class="btn btn-main" id="mhGo">Bekijk mijn advies</button></div>';
    $('mhGo').addEventListener('click', function () {
      var f = $('mhForm'), val = function (n) { var el = f.querySelector('input[name="' + n + '"]:checked'); return el ? el.value : null; };
      var antw = { zakelijk: val('zakelijk_h'), prioriteit: val('prioriteit'), bediening: val('bediening') };
      var err = f.querySelector('.field-error');
      if (!antw.zakelijk || !antw.prioriteit || !antw.bediening) { err.hidden = false; err.textContent = 'Beantwoord alle vragen, dan geven wij een passend advies.'; return; }
      var r = EKPricing.adviseer(C, antw), p = EKPricing.product(C, r.aanbevolen);
      S.product = p.id; if (antw.zakelijk === 'ja') S.zakelijk = 'ja'; S.opties = EKPricing.schoonOpties(C, S);
      EK.track('keuzehulp_advies', { aanbevolen: p.id, bron: 'configurator' });
      render(false);
      $('miniHelper').hidden = false;
      $('miniHelper').innerHTML = '<div class="notice notice-ok">' + EK.icon('check') + '<div><b>Ons advies: ' + esc(p.naam) + '.</b> Deze laadpaal ' + esc(r.redenen.join(' en ') || 'past goed bij uw wensen') + '. Wij hebben hem voor u geselecteerd.</div></div>';
      $('miniHelper').scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }

  /* ---------- Automatisch doorschuiven naar de volgende vraag ---------- */
  var schuifTimer = null;
  function naarVolgendeVraag(naam) {
    clearTimeout(schuifTimer);
    schuifTimer = setTimeout(function () {
      var el = document.querySelector('#stepHost input[name="' + naam + '"]'); if (!el) return;
      var vraag = el.closest('fieldset.cfg-q'); if (!vraag) return;
      var rustig = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
      // Moet er binnen deze vraag nog een aantal meters worden ingevuld? Dan daar blijven.
      var meters = vraag.querySelector('input[data-meters]');
      if (meters && !meters.value) { meters.focus({ preventScroll: true }); meters.scrollIntoView({ block: 'center', behavior: rustig }); return; }
      if (vraag.parentNode.querySelector('.mk-advies')) return; // meterkastadvies: de klant moet dat eerst lezen
      var alle = Array.prototype.slice.call(document.querySelectorAll('#stepHost fieldset.cfg-q'));
      var doel = alle[alle.indexOf(vraag) + 1] || $('cfgNav');
      if (!doel) return;
      var top = doel.getBoundingClientRect().top;
      if (top < window.innerHeight * 0.6) return; // staat al goed in beeld
      window.scrollTo({ top: window.scrollY + top - 96, behavior: rustig });
    }, 260);
  }

  /* ---------- Adres automatisch invullen (postcode + huisnummer, via PDOK van de overheid) ---------- */
  var adresTimer = null, adresLaatst = '', adresAuto = { straat: '', plaats: '' };
  function zoekAdres() {
    clearTimeout(adresTimer);
    adresTimer = setTimeout(function () {
      var pc = String(G.postcode || '').replace(/\s/g, '').toUpperCase(), hn = (String(G.huisnummer || '').match(/^\s*(\d+)/) || [])[1];
      if (!/^[1-9]\d{3}[A-Z]{2}$/.test(pc) || !hn || pc + '-' + hn === adresLaatst) return;
      adresLaatst = pc + '-' + hn;
      var url = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?fq=type:adres&fq=postcode:' + pc + '&fq=huisnummer:' + hn + '&rows=1&fl=straatnaam,woonplaatsnaam';
      fetch(url).then(function (x) { return x.ok ? x.json() : null; }).then(function (d) {
        var doc = d && d.response && d.response.docs && d.response.docs[0];
        if (!doc || stapKey !== 'gegevens') return;
        var gevuld = false;
        [['straat', doc.straatnaam], ['plaats', doc.woonplaatsnaam]].forEach(function (x) {
          var veldEl = $('f-' + x[0]); if (!veldEl || !x[1]) return;
          if (!veldEl.value || veldEl.value === adresAuto[x[0]]) { veldEl.value = x[1]; adresAuto[x[0]] = x[1]; zetFout(x[0], ''); gevuld = true; }
        });
        if (gevuld) { leesGegevens(); bewaar(); EK.track('adres_automatisch_ingevuld'); }
      }).catch(function () { /* geen verbinding: de klant vult straat en plaats zelf in */ });
    }, 350);
  }

  /* ---------- Events ---------- */
  function bindEvents() {
    $('cfgForm').addEventListener('submit', function (e) { e.preventDefault(); volgende(); });
    $('btnBack').addEventListener('click', function () { var l = stappen(); naar(l[Math.max(stapIndex() - 1, 0)].key); });

    $('cfgForm').addEventListener('change', function (e) {
      var t = e.target;
      if (!gestart) { gestart = true; EK.track('configurator_start', { bron: 'configurator' }); }
      if (t.type === 'file') { voegBestandenToe(t.files, t.getAttribute('data-soort')); t.value = ''; return; }
      if (t.name === 'product') {
        var vorigeVast = !!(EKPricing.product(C, S.product) || {}).kabelVarianten;
        S.product = t.value; S.opties = EKPricing.schoonOpties(C, S);
        var np = EKPricing.product(C, t.value);
        if (!(np.kabelVarianten && np.kabelVarianten.some(function (v) { return v.id === S.kabelLengte; }))) S.kabelLengte = np.kabelVarianten ? np.kabelVarianten[0].id : null;
        EK.track('select_item', { item_list_name: 'configurator', items: [EK.gaItem(np)] });
        if (vorigeVast || np.kabelVarianten) { render(false); var gekozen = document.querySelector('input[name="product"][value="' + t.value + '"]'); if (gekozen) gekozen.focus(); }
        else renderSamenvatting(EKPricing.bereken(C, S));
        var er0 = $('err-product'); if (er0) er0.hidden = true; bewaar(); naarVolgendeVraag('product'); return;
      }
      if (t.name === 'kabelLengte') {
        S.kabelLengte = t.value;
        EK.track('kabellengte_keuze', { laadpaal: S.product, lengte: t.value });
        renderSamenvatting(EKPricing.bereken(C, S)); bewaar(); naarVolgendeVraag('kabelLengte'); return;
      }
      if (EKPricing.VRAGEN.indexOf(t.name) > -1) {
        S[t.name] = t.value; S.opties = EKPricing.schoonOpties(C, S);
        var er = $('err-' + t.name); if (er) er.hidden = true;
        if (['meterkast', 'locatie', 'afstand', 'graafwerk', 'fase', 'slimmeMeter', 'zakelijk'].indexOf(t.name) > -1) {
          var naam = t.name, waarde = t.value; render(false);
          var el = document.querySelector('input[name="' + naam + '"][value="' + waarde + '"]'); if (el) el.focus();
          if (naam === 'meterkast') { var m = document.querySelector('.mk-advies'); if (m) m.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); EK.track('meterkast_keuze', { keuze: waarde }); }
        } else renderSamenvatting(EKPricing.bereken(C, S));
        bewaar(); naarVolgendeVraag(t.name); return;
      }
      if (t.name === 'kabel') {
        S.opties = S.opties.filter(function (id) { var o = EKPricing.optie(C, id); return !(o && o.groep === 'kabel'); });
        if (t.value !== 'geen') S.opties.push(t.value);
        renderSamenvatting(EKPricing.bereken(C, S)); bewaar(); naarVolgendeVraag('kabel'); return;
      }
      if (t.name === 'optie') {
        S.opties = S.opties.filter(function (id) { return id !== t.value; }); if (t.checked) S.opties.push(t.value);
        S.opties = EKPricing.schoonOpties(C, S); renderSamenvatting(EKPricing.bereken(C, S)); bewaar(); return;
      }
      if (t.id === 'f-akkoord' && t.checked) zetFout('akkoord', '');
      if (stapKey === 'gegevens') { leesGegevens(); bewaar(); }
    });
    $('cfgForm').addEventListener('input', function (e) {
      var t = e.target;
      if (t.hasAttribute('data-meters')) {
        var k = t.getAttribute('data-meters'), n = Math.round(Number(t.value));
        S[k] = n > 0 && n <= EKPricing.MAX_METERS ? n : null;
        var ok = k === 'afstandMeters' ? S[k] > 20 : S[k] > 0; if (ok) { var er = $('err-' + k); if (er) er.hidden = true; }
        renderSamenvatting(EKPricing.bereken(C, S)); bewaar(); return;
      }
      if (stapKey !== 'gegevens' || !t.id || t.id.indexOf('f-') !== 0) return;
      leesGegevens(); bewaar();
      var id = t.id.slice(2);
      if (id === 'postcode' || id === 'huisnummer') zoekAdres();
      if (t.getAttribute('aria-invalid') === 'true' && REGELS[id] && !REGELS[id](t.value.trim())) zetFout(id, '');
    });
    $('cfgForm').addEventListener('focusout', function (e) {
      var t = e.target; if (stapKey !== 'gegevens' || !t.id || t.id.indexOf('f-') !== 0 || !t.value) return;
      var id = t.id.slice(2); if (['email', 'postcode', 'telefoon'].indexOf(id) > -1) zetFout(id, REGELS[id](t.value.trim()));
    });
    document.addEventListener('click', function (e) {
      var ga = e.target.closest('[data-ga]'); if (ga) { e.preventDefault(); naar(ga.getAttribute('data-ga')); return; }
      var w = e.target.closest('[data-wissel]'); if (w) { S.product = w.getAttribute('data-wissel'); render(false); EK.toast('U heeft nu de ' + EKPricing.product(C, S.product).naam + ' gekozen.'); return; }
      var info = e.target.closest('[data-info]');
      if (info) { var box = $('info-' + info.getAttribute('data-info')), open = info.getAttribute('aria-expanded') === 'true'; info.setAttribute('aria-expanded', String(!open)); box.hidden = open; return; }
      var del = e.target.closest('[data-del]');
      if (del) { var i = parseInt(del.getAttribute('data-del'), 10), f = FILES[i]; if (f && f.preview) URL.revokeObjectURL(f.preview); FILES.splice(i, 1); render(false); return; }
      if (e.target.id === 'openHelper') toonMiniHelper();
    });
    ['dragover', 'dragleave', 'drop'].forEach(function (ev) {
      document.addEventListener(ev, function (e) {
        var z = e.target.closest && e.target.closest('.upload'); if (!z) return;
        e.preventDefault(); z.classList.toggle('drag', ev === 'dragover');
        if (ev === 'drop' && e.dataTransfer.files.length) voegBestandenToe(e.dataTransfer.files, z.getAttribute('data-soort'));
      });
    });
    $('mbOpen').addEventListener('click', function () { var d = $('sheet'); $('sheetBody').innerHTML = samenvattingHTML(EKPricing.bereken(C, S)); if (d.showModal) d.showModal(); else d.setAttribute('open', ''); });
    $('sheet').addEventListener('click', function (e) { if (e.target === this) this.close(); });
    $('btnSave').addEventListener('click', function () {
      var link = deelLink(), klaar = function () { EK.toast('De link is gekopieerd. Bewaar of mail hem naar uzelf om later verder te gaan.'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(klaar, function () { window.prompt('Kopieer deze link:', link); });
      else window.prompt('Kopieer deze link:', link);
      EK.track('configurator_bewaard');
    });
    $('resumeYes').addEventListener('click', function () { herstel(lees()); $('resume').classList.remove('show'); });
    $('resumeNo').addEventListener('click', function () { wis(); $('resume').classList.remove('show'); });
    window.addEventListener('beforeunload', function () { if (stapKey === 'gegevens') leesGegevens(); bewaar(); });
  }

  function herstel(d) {
    if (!d) return;
    S = zuiver(d.s || {});
    if (d.g) Object.keys(G).forEach(function (k) { if (d.g[k] !== undefined) G[k] = d.g[k]; });
    bezocht = d.bezocht || { laadpaal: true }; REF = d.ref || null;
    stapKey = S.product ? (d.stap || 'laadpaal') : 'laadpaal';
    if (stapKey === 'kabelroute') stapKey = 'plaats';   // oude stap, nu samengevoegd
    if (stapKey === 'fotos') stapKey = 'gegevens';      // er is nog niets verstuurd
    if (!stappen().some(function (s) { return s.key === stapKey; })) stapKey = 'meterkast';
    if (bezocht.kabelroute) bezocht.plaats = true;
    render(true);
  }

  /* ---------- Start ---------- */
  EK.loadConfig().then(function (cfg) {
    C = cfg;
    if (C.__ongeldig) throw new Error('Configuratie ongeldig');
    bindEvents();
    var q = new URLSearchParams(location.search), opgeslagen = lees();
    if (q.get('c')) {
      var o = uitLink(q.get('c'));
      if (o) {
        S = zuiver(o);
        var r = EKPricing.bereken(C, S);
        stapKey = !S.product ? 'laadpaal' : (r.compleet && r.route === 'standaard' ? 'overzicht' : 'meterkast');
        stappen().forEach(function (s, i) { if (i <= stapIndex()) bezocht[s.key] = true; });
        if (opgeslagen && opgeslagen.g && JSON.stringify(zuiver(opgeslagen.s || {})) === JSON.stringify(S)) Object.keys(G).forEach(function (k) { if (opgeslagen.g[k] !== undefined) G[k] = opgeslagen.g[k]; });
      }
      try { history.replaceState(null, '', location.pathname); } catch (e) {}
    } else if (q.get('laadpaal') && EKPricing.product(C, q.get('laadpaal'))) {
      if (opgeslagen && opgeslagen.s && opgeslagen.s.product) $('resume').classList.add('show');
      S.product = q.get('laadpaal'); stapKey = 'meterkast'; bezocht.meterkast = true;
      var qp = EKPricing.product(C, S.product);
      if (qp.kabelVarianten) S.kabelLengte = qp.kabelVarianten.some(function (v) { return v.id === q.get('kabel'); }) ? q.get('kabel') : qp.kabelVarianten[0].id;
      try { history.replaceState(null, '', location.pathname); } catch (e) {}
      EK.track('configurator_start', { bron: 'productkeuze', laadpaal: S.product }); gestart = true;
    } else if (opgeslagen && opgeslagen.s && opgeslagen.s.product) {
      herstel(opgeslagen); EK.toast('Welkom terug. U gaat verder waar u gebleven was.'); return;
    }
    render(false);
  }).catch(function (e) {
    console.error(e);
    $('stepHost').innerHTML = '<div class="notice notice-warn">' + EK.icon('warn') + '<div><b>De configurator kon niet worden geladen.</b> Ververs de pagina of neem contact met ons op via <a href="tel:+31850600572">085 060 05 72</a>. U kunt ook <a href="../../offerte/">een offerte aanvragen</a>.</div></div>';
    $('cfgNav').hidden = true;
  });
})();
