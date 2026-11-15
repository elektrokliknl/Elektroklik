/*!
 * ElektroKlik prijsmotor voor laadpalen.
 * Pure functies zonder DOM-afhankelijkheden: dezelfde code draait in de browser,
 * in de tests (Node) en later in een server-functie (bijv. bij iDEAL-betaling),
 * zodat de prijs altijd op precies dezelfde manier wordt berekend.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EKPricing = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Vragen van de standaardroute, in de volgorde van de configurator. */
  var VRAGEN = ['meterkast', 'locatie', 'afstand', 'kruipruimte', 'graafwerk', 'fase', 'slimmeMeter', 'zonnepanelen', 'zakelijk'];
  /** Toeslagen die de klant per keuze mag zien; overige toeslagen tonen we samengevat. */
  var ZICHTBAAR = ['product', 'montagepaal', 'kabelhouder', 'kabel1', 'kabel3'];
  var MAX_METERS = 250;

  function leegeStaat() {
    var s = { product: null, opties: [], afstandMeters: null, graafMeters: null };
    VRAGEN.forEach(function (v) { s[v] = null; });
    return s;
  }

  function product(config, id) {
    for (var i = 0; i < config.producten.length; i++) if (config.producten[i].id === id) return config.producten[i];
    return null;
  }
  function keuze(config, vraag, id) {
    var r = config.regels[vraag];
    if (!r || !r.keuzes) return null;
    for (var i = 0; i < r.keuzes.length; i++) if (r.keuzes[i].id === id) return r.keuzes[i];
    return null;
  }
  function optie(config, id) {
    for (var i = 0; i < config.opties.length; i++) if (config.opties[i].id === id) return config.opties[i];
    return null;
  }
  function bedrag(n) {
    var x = Number(n);
    if (!isFinite(x) || x < 0) throw new Error('Ongeldig bedrag in prijsconfiguratie: ' + n);
    return Math.round(x * 100) / 100;
  }
  function meters(n) {
    var x = Math.round(Number(n));
    return isFinite(x) && x > 0 && x <= MAX_METERS ? x : null;
  }

  /** 'offerte' als de meterkastkeuze de standaardroute stopt, anders 'standaard'. */
  function route(config, staat) {
    var k = keuze(config, 'meterkast', staat.meterkast);
    return k && k.route === 'offerte' ? 'offerte' : 'standaard';
  }

  function optieStatus(config, staat, opt) {
    var p = product(config, staat.product);
    var v = opt.vereist || {};
    if (v.mid && !(p && p.midGecertificeerd)) return { beschikbaar: false, reden: opt.nietBeschikbaarReden || 'Niet beschikbaar met deze laadpaal.' };
    if (v.locatie && v.locatie.indexOf(staat.locatie) === -1) return { beschikbaar: false, verborgen: true };
    if (v.locatieNiet && v.locatieNiet.indexOf(staat.locatie) !== -1) return { beschikbaar: false, verborgen: true };
    return { beschikbaar: true };
  }
  function beschikbareOpties(config, staat) {
    return config.opties.map(function (o) {
      var s = optieStatus(config, staat, o);
      return { optie: o, beschikbaar: s.beschikbaar, verborgen: !!s.verborgen, reden: s.reden || '' };
    });
  }
  function schoonOpties(config, staat) {
    var gezien = {}, res = [];
    (staat.opties || []).slice().reverse().forEach(function (id) {
      var o = optie(config, id);
      if (!o || !optieStatus(config, staat, o).beschikbaar) return;
      if (o.groep) { if (gezien[o.groep]) return; gezien[o.groep] = true; }
      if (res.indexOf(id) === -1) res.unshift(id);
    });
    return res;
  }

  /**
   * Berekent de prijsopbouw.
   * Retourneert { route, regels, totaal, btw, situatieTotaal, beoordeling[], intern[], compleet, ontbreekt[] }.
   * Elke regel heeft `groep`: 'zichtbaar' (mag per regel getoond worden) of 'situatie' (samengevat getoond).
   */
  function bereken(config, invoer) {
    var staat = Object.assign(leegeStaat(), invoer || {});
    var regels = [], beoordeling = [], intern = [], ontbreekt = [];
    var p = product(config, staat.product);
    var leeg = { route: 'standaard', regels: [], totaal: 0, btw: 0, situatieTotaal: 0, beoordeling: [], intern: [], compleet: false, ontbreekt: ['product'] };
    if (!p) return leeg;

    var lb = config.regels.loadBalancing.labelPerProduct[p.id];
    regels.push({ id: 'product', groep: 'zichtbaar', label: p.naam + ' inclusief standaardinstallatie en load balancing', bedrag: bedrag(p.vanafprijs) });
    if (lb) intern.push('Load balancing inbegrepen: ' + lb);

    var r = route(config, staat);
    var vragen = r === 'offerte' ? ['meterkast'] : VRAGEN;

    vragen.forEach(function (vraag) {
      var id = staat[vraag];
      var k = id ? keuze(config, vraag, id) : null;
      if (!k) { ontbreekt.push(vraag); return; }
      var prijs = Number(k.prijs) || 0;
      var label = k.regelLabel || k.label;
      if (vraag === 'graafwerk' && k.vraagtMeters) {
        var gm = meters(staat.graafMeters);
        if (!gm) { ontbreekt.push('graafMeters'); return; }
        prijs = gm * bedrag(config.regels.graafwerk.prijsPerMeter);
        label = 'Graafwerk (' + gm + ' meter × € ' + config.regels.graafwerk.prijsPerMeter + ')';
      }
      if (vraag === 'afstand' && k.vraagtMeters) {
        var am = meters(staat.afstandMeters);
        if (!am || am <= 20) { ontbreekt.push('afstandMeters'); return; }
        label += ' (circa ' + am + ' meter)';
      }
      if (prijs) regels.push({ id: vraag, groep: 'situatie', label: label, bedrag: bedrag(prijs) });
      if (k.beoordeling) beoordeling.push(k.beoordeling);
      if (k.intern) intern.push(k.intern);
    });

    if (r === 'standaard') {
      var loc = keuze(config, 'locatie', staat.locatie);
      if (loc && loc.voegtToe === 'montagepaal') {
        var mp = config.regels.montagepaal;
        regels.push({ id: 'montagepaal', groep: 'zichtbaar', label: mp.label, bedrag: bedrag(mp.prijsPerProduct[p.id]) });
      }
      schoonOpties(config, staat).forEach(function (id) {
        var o = optie(config, id);
        regels.push({ id: o.id, groep: ZICHTBAAR.indexOf(o.id) > -1 ? 'zichtbaar' : 'situatie', label: o.label, bedrag: bedrag(o.prijs) });
      });
      if (staat.zakelijk === 'ja' && !p.midGecertificeerd) {
        beoordeling.push('U wilt laadkosten zakelijk verrekenen, maar de ' + p.naam + ' heeft geen MID-gecertificeerde meter. Wij adviseren u over een geschikt alternatief.');
        intern.push('Zakelijke verrekening gewenst met laadpaal zonder MID-meter');
      }
      if (staat.zakelijk === 'ja' && p.midGecertificeerd) intern.push('Laadpaal voorbereiden op zakelijke verrekening');
      if (staat.zonnepanelen === 'ja' || staat.zonnepanelen === 'gepland') intern.push('Klant heeft (binnenkort) zonnepanelen: advies over laden met zonne-energie');
    }

    var totaal = 0, situatie = 0;
    regels.forEach(function (x) { totaal += x.bedrag; if (x.groep === 'situatie') situatie += x.bedrag; });
    totaal = Math.round(totaal * 100) / 100;
    var pct = Number(config.instellingen.btwPercentage) || 21;
    return {
      route: r,
      regels: regels,
      totaal: totaal,
      btw: Math.round(totaal * pct / (100 + pct) * 100) / 100,
      situatieTotaal: Math.round(situatie * 100) / 100,
      beoordeling: uniek(beoordeling),
      intern: uniek(intern),
      compleet: ontbreekt.length === 0,
      ontbreekt: ontbreekt,
      configVersie: config.versie
    };
  }

  function uniek(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }

  /** Keuzehulp: geeft { aanbevolen, scores, redenen } terug. */
  var PUNTEN = {
    prioriteit: {
      prijs: { 'easee-up': 3, 'easee-max': 2.5, zaptec: 1 },
      design: { zaptec: 3, 'easee-up': 1, 'easee-max': 1 },
      uitgebreid: { 'alfen-pro': 3, 'alfen-s': 2, zaptec: 1 }
    },
    bediening: {
      app: { 'easee-up': 1, 'easee-max': 1, zaptec: 1 },
      eenvoud: { 'easee-up': 1, 'easee-max': 1, 'alfen-s': 1 },
      backoffice: { 'alfen-pro': 2, 'alfen-s': 1, zaptec: 1 }
    }
  };
  var REDEN = {
    prioriteit: { prijs: 'scherp geprijsd is', design: 'een premium ontwerp combineert met moderne slimme functies', uitgebreid: 'uitgebreide mogelijkheden biedt' },
    bediening: { app: 'eenvoudig via een app te bedienen is', eenvoud: 'eenvoudig is in dagelijks gebruik', backoffice: 'te koppelen is aan een backoffice of laadpasprovider' }
  };
  function adviseer(config, antw) {
    var s = {}, redenen = {};
    config.producten.forEach(function (p) { s[p.id] = 0; redenen[p.id] = []; });
    config.producten.forEach(function (p) {
      if (antw.zakelijk === 'ja') {
        if (p.midGecertificeerd) { s[p.id] += 2; redenen[p.id].push('een MID-gecertificeerde meter heeft voor zakelijke verrekening'); }
        else s[p.id] -= 100;
      }
      ['prioriteit', 'bediening'].forEach(function (v) {
        var pt = PUNTEN[v][antw[v]] && PUNTEN[v][antw[v]][p.id];
        if (pt) { s[p.id] += pt; if (pt >= 1) redenen[p.id].push(REDEN[v][antw[v]]); }
      });
    });
    var volgorde = config.producten.map(function (p) { return p.id; });
    var best = volgorde.slice().sort(function (a, b) { return s[b] - s[a] || volgorde.indexOf(a) - volgorde.indexOf(b); })[0];
    var tips = [];
    if (antw.zonnepanelen === 'ja' || antw.zonnepanelen === 'gepland') tips.push('Load balancing is bij al onze laadpalen inbegrepen. Wij adviseren u graag over laden met zonne-energie.');
    return { aanbevolen: best, scores: s, redenen: redenen[best], tips: tips };
  }

  /** Controleert de configuratie op fouten die tot een verkeerde prijs zouden leiden. */
  function valideerConfig(config) {
    var fouten = [];
    if (!config || !Array.isArray(config.producten) || !config.producten.length) return ['Er zijn geen producten ingesteld.'];
    config.producten.forEach(function (p) {
      if (!p.id || !p.naam) fouten.push('Een product mist een id of naam.');
      if (!(Number(p.vanafprijs) > 0)) fouten.push(p.naam + ': vanafprijs ontbreekt of is ongeldig.');
      var mp = config.regels.montagepaal && config.regels.montagepaal.prijsPerProduct[p.id];
      if (mp === '' || mp === null || mp === undefined || !(Number(mp) >= 0)) fouten.push(p.naam + ': prijs voor de montagepaal ontbreekt.');
      if (!(config.regels.loadBalancing && config.regels.loadBalancing.labelPerProduct[p.id])) fouten.push(p.naam + ': omschrijving van de inbegrepen load balancing ontbreekt.');
    });
    VRAGEN.forEach(function (v) {
      var r = config.regels[v];
      if (!r || !r.keuzes || !r.keuzes.length) { fouten.push('Vraag "' + v + '" heeft geen keuzes.'); return; }
      r.keuzes.forEach(function (k) { if (k.prijs === '' || !(Number(k.prijs) >= 0)) fouten.push('Vraag "' + v + '", keuze "' + k.label + '": ongeldige prijs.'); });
    });
    if (!(Number(config.regels.graafwerk && config.regels.graafwerk.prijsPerMeter) >= 0)) fouten.push('Graafwerk: prijs per meter ontbreekt.');
    (config.opties || []).forEach(function (o) { if (o.prijs === '' || !(Number(o.prijs) >= 0)) fouten.push('Optie "' + o.label + '": ongeldige prijs.'); });
    return fouten;
  }

  return {
    VRAGEN: VRAGEN, ZICHTBAAR: ZICHTBAAR, MAX_METERS: MAX_METERS,
    leegeStaat: leegeStaat, product: product, keuze: keuze, optie: optie, route: route,
    bereken: bereken, beschikbareOpties: beschikbareOpties, schoonOpties: schoonOpties,
    adviseer: adviseer, valideerConfig: valideerConfig
  };
});
