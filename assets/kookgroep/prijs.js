/* ElektroKlik – prijsmotor kookgroep- en Perilex-configurator.
 * Werkt in de browser (window.KGPrijs) en in Node (require) voor de tests.
 *
 * Uitkomst van bereken(config, staat):
 *   modus: 'vast'    → één prijs
 *          'bereik'  → van min tot max (bijv. afstand als categorie gekozen)
 *          'vanaf'   → vanaf min, bovengrens hangt af van de situatie
 *          'opMaat'  → prijs op aanvraag (complexe of technisch onzekere situatie)
 *          'leeg'    → nog niets gekozen
 *   min, max (max = null bij 'vanaf'/'opMaat'), btw (bij min), regels[], aandachtspunten[], ontbreekt[]
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KGPrijs = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var WERK = ['aansluiten', 'perilex', 'compleet', 'weetniet'];
  var TYPES = ['1fase', '2fase', '3fase'];

  function leegeStaat() {
    return { werk: null, hulpAansluiting: null, hulpWerkte: null, woningFase: null, kookplaatType: null, meterkastRuimte: null,
      afstand: null, meters: null, kruipruimte: null, route: null, kookplaatAansluiten: null, merkModel: '' };
  }
  function geldigeMeters(config, m) {
    var n = Number(m);
    return isFinite(n) && n >= 1 && n <= config.kabel.maxMeters && Math.round(n) === n ? n : null;
  }
  function extraKabel(config, meters) {
    return Math.max(0, meters - config.kabel.inbegrepenMeters) * config.kabel.prijsPerExtraMeter;
  }
  function euro(n) { return '€ ' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

  /** Advies bij "Ik weet niet precies wat ik nodig heb". */
  function advies(staat) {
    if (staat.hulpAansluiting === 'geen') return { werk: 'compleet', reden: 'Er is nog geen aansluiting voor een elektrische kookplaat. Dan is een nieuwe kookgroep vanuit de meterkast nodig.' };
    if (staat.hulpAansluiting === 'perilex' && staat.hulpWerkte === 'ja') return { werk: 'aansluiten', reden: 'Er is al een Perilex-stopcontact waarop eerder een elektrische kookplaat werkte. Dan hoeft meestal alleen uw nieuwe kookplaat te worden aangesloten.' };
    if (staat.hulpAansluiting === 'perilex' && staat.hulpWerkte === 'nee') return { werk: 'compleet', reden: 'Er zit wel een Perilex-stopcontact, maar daar werkte nog geen elektrische kookplaat op. Vaak ontbreekt dan een geschikte kookgroep in de meterkast.' };
    if (staat.hulpAansluiting === 'kabel') return { werk: 'perilex', reden: 'Er is al een aansluiting (een kabel of aansluitdoos). Meestal hoeft er dan alleen een Perilex-stopcontact te worden geplaatst.' };
    if (staat.hulpAansluiting === 'onbekend' || staat.hulpWerkte === 'onbekend') return { werk: null, reden: 'Geen probleem. Stuur ons een paar foto’s, dan bepalen wij welke aansluiting u nodig heeft en maken wij een offerte op maat.' };
    return null;
  }

  function bereken(config, staat) {
    staat = staat || {};
    var r = { modus: 'leeg', min: 0, max: 0, btw: 0, regels: [], aandachtspunten: [], ontbreekt: [] };
    var opMaat = false, open = false;
    var regel = function (label, min, max, toelichting) { r.regels.push({ label: label, min: min, max: max === undefined ? min : max, toelichting: toelichting || '' }); r.min += min; if (max === null) open = true; else r.max += (max === undefined ? min : max); };

    if (WERK.indexOf(staat.werk) < 0) { r.ontbreekt.push('werk'); return r; }

    if (staat.werk === 'aansluiten') {
      var a = config.werk.aansluiten; regel(a.label, a.prijs);
      r.aandachtspunten.push('Wij gaan uit van een bestaande, geschikte kookaansluiting. Die controleren wij bij het aansluiten.');
    }
    if (staat.werk === 'perilex') {
      var p = config.werk.perilex; regel(p.label, p.prijs);
      r.aandachtspunten.push('Wij gaan uit van een bestaande, geschikte kookgroep en bekabeling. Die controleren wij vooraf aan de hand van uw foto’s.');
    }
    if (staat.werk === 'weetniet') {
      var adv = advies(staat);
      if (!staat.hulpAansluiting) r.ontbreekt.push('hulpAansluiting');
      else if (staat.hulpAansluiting === 'perilex' && !staat.hulpWerkte) r.ontbreekt.push('hulpWerkte');
      opMaat = true;
      var adviesLabel = adv && adv.werk ? (adv.werk === 'compleet' ? 'complete kookgroep met Perilex' : config.werk[adv.werk].label.toLowerCase()) : '';
      r.aandachtspunten.push('De klant weet niet precies wat er nodig is' + (adviesLabel ? ' (op basis van de antwoorden waarschijnlijk: ' + adviesLabel + ')' : '') + '. Beoordelen aan de hand van de foto’s.');
    }
    if (staat.werk === 'compleet') {
      // 1. Type aansluiting
      if (!staat.woningFase) r.ontbreekt.push('woningFase');
      if (!staat.kookplaatType) { r.ontbreekt.push('kookplaatType'); regel('Complete kookgroep met Perilex', config.compleet['1fase'].prijs, null, 'De prijs hangt af van uw kookplaat'); }
      if (staat.kookplaatType && staat.woningFase) {
        if (staat.kookplaatType === '3fase' && staat.woningFase === '1') {
          opMaat = true;
          r.regels.push({ label: config.compleet['3fase'].label, min: null, max: null, toelichting: 'Uw woning heeft een 1-fase-aansluiting' });
          r.aandachtspunten.push('3-fase kookplaat gekozen, maar de woning heeft een 1-fase-aansluiting. Eerst beoordelen; mogelijk is verzwaring door de netbeheerder nodig (niet inbegrepen).');
        } else if (staat.kookplaatType === 'onbekend') {
          var mogelijk = staat.woningFase === '1' ? ['1fase', '2fase'] : TYPES;
          var prijzen = mogelijk.map(function (t) { return config.compleet[t].prijs; });
          regel('Complete kookgroep (de juiste uitvoering bepalen wij)', Math.min.apply(null, prijzen), Math.max.apply(null, prijzen), 'Afhankelijk van uw kookplaat');
          r.aandachtspunten.push('Type kookplaat onbekend: uitvoering bepalen aan de hand van het typeplaatje of aansluitschema.');
        } else if (TYPES.indexOf(staat.kookplaatType) > -1) {
          var c = config.compleet[staat.kookplaatType]; regel(c.label, c.prijs);
          if (staat.kookplaatType === '3fase' && staat.woningFase === 'onbekend') r.aandachtspunten.push('Controleren of de woning een 3-fase-aansluiting heeft. Zo niet, dan is eerst verzwaring door de netbeheerder nodig (niet inbegrepen).');
        }
        if (staat.woningFase === 'onbekend') r.aandachtspunten.push('Type aansluiting van de woning (1-fase of 3-fase) onbekend: controleren aan de hand van de foto van de meterkast.');
      }
      // Plek in de meterkast voor de nieuwe kookgroep
      if (!staat.meterkastRuimte) r.ontbreekt.push('meterkastRuimte');
      else if (staat.meterkastRuimte !== 'ja') {
        regel('Uitbreiding van de meterkast, als dat nodig is', 0, null, 'Niet inbegrepen. Wij beoordelen dit aan de hand van de foto van uw meterkast');
        r.aandachtspunten.push(staat.meterkastRuimte === 'nee' ? 'Klant geeft aan dat er geen plek meer is in de meterkast: uitbreiding nodig (niet inbegrepen).' : 'Onbekend of er plek is in de meterkast voor de nieuwe kookgroep: beoordelen aan de hand van de foto van de meterkast.');
      }
      // 2. Kabelafstand
      var m = geldigeMeters(config, staat.meters);
      var cat = (config.kabel.categorieen || []).filter(function (k) { return k.id === staat.afstand; })[0];
      if (m !== null) {
        var ex = extraKabel(config, m);
        if (ex > 0) regel('Extra kabel: ' + (m - config.kabel.inbegrepenMeters) + ' meter × ' + euro(config.kabel.prijsPerExtraMeter), ex, ex, 'Kabelroute van circa ' + m + ' meter');
        else regel('Kabelaanleg tot ' + config.kabel.inbegrepenMeters + ' meter', 0, 0, 'Inbegrepen');
      } else if (cat) {
        var emin = extraKabel(config, cat.van), emax = cat.tot === null ? null : extraKabel(config, cat.tot);
        if (cat.id === 'onbekend') { regel('Extra kabel boven ' + config.kabel.inbegrepenMeters + ' meter', 0, null, euro(config.kabel.prijsPerExtraMeter) + ' per meter, afhankelijk van de kabelroute'); r.aandachtspunten.push('Afstand meterkast–keuken onbekend.'); }
        else if (emax === 0) regel('Kabelaanleg tot ' + config.kabel.inbegrepenMeters + ' meter', 0, 0, 'Inbegrepen');
        else regel('Extra kabel (' + cat.label.replace(/\s+/g, ' ') + ')', emin, emax, euro(config.kabel.prijsPerExtraMeter) + ' per meter boven ' + config.kabel.inbegrepenMeters + ' meter, afhankelijk van de kabelroute');
      } else r.ontbreekt.push('afstand');
      // 3. Kruipruimte en kabelroute
      if (!staat.kruipruimte) r.ontbreekt.push('kruipruimte');
      else if (staat.kruipruimte !== 'ja') {
        var route = config.kabelroute[staat.route];
        if (!route || (staat.route === 'kruipruimte' && staat.kruipruimte === 'nee')) r.ontbreekt.push('route');
        else if (route.soort === 'opMaat') { opMaat = true; r.regels.push({ label: route.label, min: null, max: null, toelichting: 'Prijs op aanvraag' }); r.aandachtspunten.push('Kabel wegwerken in de muur (freeswerk): offerte op maat.'); }
        else if (route.soort === 'vanaf') regel(route.label, route.toeslag, null, 'Vanaf-prijs, afhankelijk van de route');
        else if (route.soort === 'beoordelen') { regel('Kabelroute (beoordelen wij aan de hand van uw foto’s)', 0, null, 'Mogelijk meerwerk'); r.aandachtspunten.push('Kabelroute onbekend en geen toegankelijke kruipruimte bevestigd: route beoordelen.'); }
      }
      // 4. Kookplaat aansluiten
      if (!staat.kookplaatAansluiten) r.ontbreekt.push('kookplaatAansluiten');
      else if (staat.kookplaatAansluiten === 'ja') regel('Kookplaat of fornuis aansluiten', config.kookplaatAansluiten);
      // Nog niet alle vragen beantwoord: toon een vanaf-prijs, geen schijnzekerheid
      if (r.ontbreekt.length) open = true;
    }

    if (staat.merkModel) r.aandachtspunten.push('Kookplaat: ' + staat.merkModel + ' (aansluitschema controleren).');
    r.modus = opMaat ? 'opMaat' : (open ? 'vanaf' : (r.min !== r.max ? 'bereik' : 'vast'));
    if (r.modus !== 'vanaf' && r.modus !== 'opMaat' && r.max < r.min) r.max = r.min;
    if (open || opMaat) r.max = null;
    r.btw = Math.round(r.min * config.btwPercentage / (100 + config.btwPercentage) * 100) / 100;
    return r;
  }

  /** Gekozen antwoorden als leesbare regels [vraag, antwoord] (configurator, e-mail en beheer). */
  function keuzes(config, staat) {
    var rij = [];
    var lab = function (id) { var m = { '1': '1-fase', '3': '3-fase', onbekend: 'Weet ik niet', ja: 'Ja', nee: 'Nee', '1fase': '1-fase kookaansluiting', '2fase': '2-fase kookgroep', '3fase': '3-fase krachtgroep', perilex: 'Perilex-stopcontact', kabel: 'Kabel of aansluitdoos', geen: 'Geen aansluiting' }; return m[id] || id || '–'; };
    var werk = { aansluiten: config.werk.aansluiten.label, perilex: config.werk.perilex.label, compleet: 'Complete kookgroep met Perilex', weetniet: 'Ik weet niet precies wat ik nodig heb' }[staat.werk];
    rij.push(['Werkzaamheden', werk || '–']);
    if (staat.werk === 'weetniet') { rij.push(['In de keuken nu', lab(staat.hulpAansluiting)]); if (staat.hulpWerkte) rij.push(['Werkte er eerder een kookplaat op', lab(staat.hulpWerkte)]); }
    if (staat.werk === 'compleet') {
      rij.push(['Aansluiting woning', lab(staat.woningFase)]); rij.push(['Kookplaat heeft nodig', lab(staat.kookplaatType)]);
      rij.push(['Plek in de meterkast', lab(staat.meterkastRuimte)]);
      var m = geldigeMeters(config, staat.meters), cat = config.kabel.categorieen.filter(function (k) { return k.id === staat.afstand; })[0];
      rij.push(['Afstand meterkast–keuken', m ? 'circa ' + m + ' meter' : (cat ? cat.label : '–')]);
      rij.push(['Kruipruimte', lab(staat.kruipruimte)]); if (staat.kruipruimte && staat.kruipruimte !== 'ja' && config.kabelroute[staat.route]) rij.push(['Kabelroute', config.kabelroute[staat.route].label]);
      rij.push(['Kookplaat aansluiten', lab(staat.kookplaatAansluiten)]);
    }
    if (staat.merkModel) rij.push(['Merk en type kookplaat', staat.merkModel]);
    return rij;
  }
  /** Korte omschrijving van het werk, bijvoorbeeld als titel van een offerte. */
  function omschrijving(config, staat) {
    if (staat.werk === 'aansluiten' || staat.werk === 'perilex') return config.werk[staat.werk].label;
    if (staat.werk === 'compleet') return (config.compleet[staat.kookplaatType] ? config.compleet[staat.kookplaatType].label : 'Complete kookgroep met Perilex') + (staat.kookplaatAansluiten === 'ja' ? ', inclusief aansluiten van uw kookplaat' : '');
    return 'Kookgroep of Perilex-aansluiting';
  }

  /** Korte tekst voor de prijsbalk en de e-mail. */
  function prijsTekst(r) {
    if (r.modus === 'leeg') return '';
    if (r.modus === 'opMaat') return 'Prijs op aanvraag';
    if (r.modus === 'vanaf') return 'Vanaf ' + euro(r.min);
    if (r.modus === 'bereik') return euro(r.min) + ' – ' + euro(r.max);
    return euro(r.min);
  }

  return { leegeStaat: leegeStaat, bereken: bereken, advies: advies, prijsTekst: prijsTekst, euro: euro, geldigeMeters: geldigeMeters, keuzes: keuzes, omschrijving: omschrijving };
});
