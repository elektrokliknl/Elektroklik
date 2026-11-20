/* ElektroKlik laadpaalshop – gedeelde functies (geen frameworks nodig). */
(function () {
  'use strict';
  var script = document.currentScript;
  var BASE = script ? script.src.replace(/assets\/shop\.js.*$/, '') : '/laadpalen/';

  var EK = window.EK = window.EK || {};
  EK.base = BASE;
  var configPromise = null;

  EK.loadConfig = function () {
    if (!configPromise) {
      configPromise = fetch(BASE + 'data/config.json', { cache: 'no-cache' })
        .then(function (r) { if (!r.ok) throw new Error('config ' + r.status); return r.json(); })
        .then(function (c) {
          var fouten = window.EKPricing ? EKPricing.valideerConfig(c) : [];
          if (fouten.length) { console.error('Prijsconfiguratie ongeldig', fouten); c.__ongeldig = fouten; }
          EK.config = c; return c;
        });
    }
    return configPromise;
  };

  /* ---------- Opmaak ---------- */
  EK.euro = function (n, decimals) {
    var v = Number(n) || 0;
    var d = decimals === undefined ? (v % 1 ? 2 : 0) : decimals;
    return '€ ' + v.toLocaleString('nl-NL', { minimumFractionDigits: d, maximumFractionDigits: d }) + (d === 0 ? ',-' : '');
  };
  EK.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; });
  };
  /** Zet [TE BEVESTIGEN]-achtige markeringen om naar zichtbare placeholders. */
  EK.txt = function (s) {
    return EK.esc(s).replace(/\[([A-Z][A-Z \-]+)\]/g, '<span class="placeholder" title="Nog aan te leveren door ElektroKlik">$1</span>');
  };
  EK.conceptTag = function () {
    return EK.config && EK.config.instellingen.prijzenGoedgekeurd ? '' : ' <span class="concept-tag">' + EK.esc(EK.config ? EK.config.instellingen.conceptLabel : 'Voorbeeldprijs') + '</span>';
  };

  /* ---------- Iconen ---------- */
  var I = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    euro: '<path d="M4 10h12M4 14h9"/><path d="M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12a7.9 7.9 0 0 0 7.8 8 7.7 7.7 0 0 0 5.2-2"/>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    tool: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    support: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    home: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    garage: '<path d="M3 21V9l9-6 9 6v12"/><path d="M7 21v-8h10v8M7 17h10"/>',
    pole: '<rect x="9" y="3" width="6" height="8" rx="1.5"/><path d="M12 11v10M8 21h8"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
    bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    warn: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    cable: '<path d="M7 3v5M11 3v5M5 8h8v3a4 4 0 0 1-8 0zM9 15v2a4 4 0 0 0 8 0V7a3 3 0 0 1 6 0"/>',
    arrowR: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowL: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    meter: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M8 15h2M12 15h2M16 11v4"/>',
    briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    dig: '<path d="M2 22h20M6 22l3-9h6l3 9M12 13V2M9 5h6"/>'
  };
  EK.icon = function (name, cls) {
    return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (I[name] || '') + '</svg>';
  };

  /* ---------- Productweergave ----------
     Zolang er geen officiële productfoto is ingesteld, tonen we een herkenbare illustratie
     (duidelijk gemarkeerd), zodat er nooit een foto van een ander product wordt gesuggereerd. */
  EK.illustratie = function (id, label) {
    var a = ' role="img" aria-label="' + EK.esc((label || id) + ' (illustratie)') + '"';
    if (id.indexOf('easee') === 0) return '<svg viewBox="0 0 120 170"' + a + '><path d="M18 10h84l10 18v104l-22 30H30L8 132V28z" fill="#22262c"/><path d="M60 10 18 10 8 28v104l22 30h30z" fill="#1d2126"/><rect x="73" y="62" width="3" height="40" rx="1.5" fill="#e9f0f2"/><text x="74" y="40" fill="#8c96a3" font-size="8" font-family="sans-serif" text-anchor="middle">easee</text></svg>';
    if (id.indexOf('zaptec') === 0) return '<svg viewBox="0 0 120 170"' + a + '><rect x="14" y="8" width="92" height="150" rx="10" fill="#22262c"/><rect x="34" y="28" width="52" height="110" rx="26" fill="none" stroke="#4a515b"/><circle cx="60" cy="58" r="16" fill="#111" stroke="#e9f0f2" stroke-width="2"/><circle cx="60" cy="108" r="14" fill="#15181c" stroke="#555d68"/></svg>';
    return '<svg viewBox="0 0 120 170"' + a + '><rect x="16" y="10" width="88" height="146" rx="14" fill="#f3f5f7" stroke="#b9c1cb"/><rect x="34" y="30" width="52" height="22" rx="4" fill="#26303a"/><rect x="40" y="36" width="24" height="3" rx="1.5" fill="#7fd1c6"/><circle cx="60" cy="112" r="15" fill="#2c343d"/><circle cx="60" cy="112" r="6" fill="#47515c"/><text x="60" y="78" fill="#55606c" font-size="8" font-family="sans-serif" text-anchor="middle"></text></svg>';
  };
  EK.imgUrl = function (src) { return src.indexOf('http') === 0 || src.charAt(0) === '/' ? src : BASE + src; };
  EK.productMedia = function (p, cls) {
    if (p.afbeelding) return '<img src="' + EK.esc(EK.imgUrl(p.afbeelding)) + '" alt="' + EK.esc(p.afbeeldingAlt || p.naam) + '" loading="lazy" class="' + (cls || '') + '">';
    return EK.illustratie(p.id, p.naam);
  };
  /** Bij laadpalen met vaste laadkabel: korte toelichting op de kabellengtes en prijzen. */
  EK.kabelNote = function (p) {
    if (!p.kabelVarianten || !p.kabelVarianten.length) return '';
    return '<div class="price-note">Met vaste laadkabel van ' + EK.esc(p.kabelVarianten[0].kort) + p.kabelVarianten.slice(1).map(function (v) { return '; ' + EK.esc(v.kort) + ': ' + EK.euro(v.prijs); }).join('') + '</div>';
  };
  /* Standaard inbegrepen: tegels met pictogram, gevuld vanuit config.json */
  EK.inclIcoon = function (t) {
    t = t.toLowerCase();
    if (/montage|muur|garage/.test(t)) return 'home';
    if (/kabel/.test(t)) return 'cable';
    if (/beveiliging|meterkast/.test(t)) return 'shield';
    if (/load balancing/.test(t)) return 'bolt';
    if (/test|normen|bedrijf/.test(t)) return 'check';
    if (/uitleg|app/.test(t)) return 'phone';
    if (/voorrij/.test(t)) return 'euro';
    return 'check';
  };
  EK.inclTegels = function (lijst) {
    return lijst.map(function (x) { return '<li><span class="ic">' + EK.icon(EK.inclIcoon(x)) + '</span><span>' + EK.txt(x) + '</span></li>'; }).join('');
  };
  EK.renderInbegrepen = function (el) {
    if (!el) return;
    EK.loadConfig().then(function (c) { el.innerHTML = EK.inclTegels(c.standaardInstallatie.inbegrepen); });
  };
  EK.productUrl = function (p) { return BASE + p.slug + '/'; };
  EK.configUrl = function (pid) { return BASE + 'samenstellen/' + (pid ? '?laadpaal=' + encodeURIComponent(pid) : ''); };

  EK.productCard = function (p, opt) {
    opt = opt || {};
    var media = EK.productMedia(p);
    return '<article class="pcard' + (opt.advies ? ' is-advies' : '') + '" data-product="' + p.id + '">' +
      (opt.advies ? '<span class="pcard-flag">Past bij uw antwoorden</span>' : '') +
      '<a class="pcard-media" href="' + EK.productUrl(p) + '" tabindex="-1" aria-hidden="true">' + media + (p.afbeelding ? '' : '<span class="media-note">Illustratie</span>') + '</a>' +
      '<div class="pcard-body">' +
      '<span class="pcard-pos">' + EK.esc(p.positionering) + '</span>' +
      '<h3><a href="' + EK.productUrl(p) + '" style="color:inherit;text-decoration:none">' + EK.esc(p.naam) + '</a><small>Merk: ' + EK.esc(p.merk) + '</small></h3>' +
      '<p class="kort">' + EK.esc(p.kort) + '</p>' +
      '<ul class="checks">' + p.voordelen.slice(0, 4).map(function (v) { return '<li>' + EK.txt(v) + '</li>'; }).join('') + '</ul>' +
      '<div class="spec-mini">' +
      '<div><b>' + (p.specs.maxVermogen.match(/\d+ kW/) || ['–'])[0] + '</b>max. vermogen</div>' +
      '<div><b>' + (p.midGecertificeerd ? 'Ja' : 'Nee') + '</b>MID-meter</div>' +
      '<div style="grid-column:1/-1"><b>Inbegrepen</b>Load balancing</div>' +
      '</div>' +
      '<div class="price-block"><div class="price-from">Inclusief professionele standaardinstallatie en load balancing</div>' +
      '<div class="price-big">' + EK.euro(p.vanafprijs) + EK.conceptTag() + '</div>' +
      EK.kabelNote(p) + '<div class="price-note">Inclusief 21% btw</div>' +
      '<a class="pcard-incl" href="' + BASE + '#inbegrepen">' + EK.icon('check') + ' Bekijk wat is inbegrepen</a>' +
      '<div class="pcard-ctas"><a class="btn btn-ghost" href="' + EK.productUrl(p) + '" data-track="bekijk_laadpaal">Bekijk laadpaal</a>' +
      '<a class="btn btn-main" href="' + EK.configUrl(p.id) + '" data-track="stel_samen">Bereken uw prijs</a></div>' +
      '</div></div></article>';
  };

  EK.renderProductGrid = function (el, advies) {
    if (!el) return;
    EK.loadConfig().then(function (c) {
      el.innerHTML = c.producten.map(function (p) { return EK.productCard(p, { advies: advies === p.id }); }).join('');
      EK.track('view_item_list', { item_list_name: el.getAttribute('data-list') || 'laadpalen', items: c.producten.map(EK.gaItem) });
    }).catch(EK.configFout(el));
  };

  EK.configFout = function (el) {
    return function (e) {
      console.error(e);
      if (el) el.innerHTML = '<div class="notice notice-warn">' + EK.icon('warn') + '<div>De productinformatie kon niet worden geladen. Ververs de pagina of bel ons op <a href="tel:+31850600572">085 060 05 72</a>.</div></div>';
    };
  };

  /* Vul losse prijsvelden in statische HTML: <span data-prijs="easee"></span> */
  EK.fillPrices = function () {
    EK.loadConfig().then(function (c) {
      document.querySelectorAll('[data-prijs]').forEach(function (el) {
        var id = el.getAttribute('data-prijs');
        var v = id === 'min' ? Math.min.apply(null, c.producten.map(function (p) { return p.vanafprijs; })) : (EKPricing.product(c, id) || {}).vanafprijs;
        var kab = el.getAttribute('data-kabel'); // gekozen kabellengte op de productpagina
        if (kab && EKPricing.product(c, id)) v = EKPricing.productPrijs(EKPricing.product(c, id), kab);
        if (v) el.innerHTML = EK.euro(v) + (el.hasAttribute('data-no-tag') ? '' : EK.conceptTag());
      });
      document.querySelectorAll('[data-concept-only]').forEach(function (el) { el.hidden = !!c.instellingen.prijzenGoedgekeurd; });
    }).catch(function (e) { console.error(e); });
  };

  /* ---------- Vergelijker ---------- */
  EK.renderCompare = function (el) {
    if (!el) return;
    EK.loadConfig().then(function (c) {
      var ps = c.producten;
      var rij = function (label, fn) { return '<tr><th scope="row">' + label + '</th>' + ps.map(function (p) { return '<td>' + fn(p) + '</td>'; }).join('') + '</tr>'; };
      var yn = function (b, t) { return b ? '<span class="yes">✓ ' + (t || 'Ja') + '</span>' : '<span class="no">✕ ' + (t || 'Nee') + '</span>'; };
      el.innerHTML = '<table class="compare"><caption class="sr-only">Vergelijking van de laadpalen</caption><thead><tr><th scope="col"><span class="sr-only">Eigenschap</span></th>' +
        ps.map(function (p) { return '<th scope="col"><span class="t">' + EK.esc(p.naam) + '</span><span class="pcard-pos">' + EK.esc(p.positionering) + '</span></th>'; }).join('') + '</tr></thead><tbody>' +
        rij('Prijs incl. installatie en load balancing', function (p) { return '<b style="font-size:1.1rem;color:var(--ek-ink)">' + EK.euro(p.vanafprijs) + '</b>' + EK.conceptTag() + EK.kabelNote(p); }) +
        rij('Positionering', function (p) { return EK.esc(p.kort); }) +
        rij('Maximaal laadvermogen', function (p) { return EK.esc(p.specs.maxVermogen); }) +
        rij('Aansluiting auto', function (p) { return EK.esc(p.specs.aansluiting); }) +
        rij('Verbinding', function (p) { return EK.esc(p.specs.connectiviteit); }) +
        rij('RFID-lezer', function (p) { return EK.esc(p.specs.rfid); }) +
        rij('MID-gecertificeerde meter', function (p) { return yn(p.midGecertificeerd, EK.esc(p.specs.mid)); }) +
        rij('Zakelijke verrekening', function (p) { return yn(p.midGecertificeerd, p.midGecertificeerd ? 'Mogelijk' : 'Niet geschikt'); }) +
        rij('Load balancing', function (p) { return '<span class="yes">✓ Inbegrepen</span><br>' + EK.esc(p.specs.loadBalancing.replace(/^Inbegrepen: /, '')); }) +
        rij('Display', function (p) { return EK.esc(p.specs.display || '–'); }) +
        rij('Bediening', function (p) { return EK.esc(p.specs.app); }) +
        rij('Beschermingsgraad', function (p) { return EK.esc(p.specs.bescherming || '–'); }) +
        rij('Montage', function (p) { return EK.esc(p.specs.montage || '–'); }) +
        rij('Fabrieksgarantie', function (p) { return EK.txt(p.specs.garantie); }) +
        rij('Geschikt voor', function (p) { return '<ul class="checks">' + p.geschiktVoor.map(function (x) { return '<li>' + EK.esc(x) + '</li>'; }).join('') + '</ul>'; }) +
        '</tbody><tfoot><tr><td></td>' + ps.map(function (p) { return '<td><a class="btn btn-main btn-block" href="' + EK.configUrl(p.id) + '" data-track="stel_samen">Bereken uw prijs</a><a class="btn-link" style="display:inline-block;margin-top:8px" href="' + EK.productUrl(p) + '">Meer over ' + EK.esc(p.merk) + '</a></td>'; }).join('') + '</tr></tfoot></table>';
    }).catch(EK.configFout(el));
  };

  /* ---------- Keuzehulp ---------- */
  EK.initHelper = function (form, out, gridEl) {
    if (!form) return;
    var gestart = false;
    form.addEventListener('change', function () {
      if (!gestart) { gestart = true; EK.track('keuzehulp_start'); }
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      var antw = { zakelijk: fd.get('zakelijk'), prioriteit: fd.get('prioriteit'), bediening: fd.get('bediening'), zonnepanelen: fd.get('zonnepanelen') };
      var mist = Object.keys(antw).filter(function (k) { return !antw[k]; });
      var err = form.querySelector('.field-error');
      if (mist.length) { err.hidden = false; err.textContent = 'Beantwoord alle vragen, dan geven wij een passend advies.'; var f = form.querySelector('[name="' + mist[0] + '"]'); if (f) f.focus(); return; }
      err.hidden = true;
      EK.loadConfig().then(function (c) {
        var r = EKPricing.adviseer(c, antw);
        var p = EKPricing.product(c, r.aanbevolen);
        out.hidden = false;
        out.innerHTML = '<h4>Ons advies: ' + EK.esc(p.naam) + '</h4><p>Op basis van uw antwoorden past de ' + EK.esc(p.naam) + ' het best bij u, omdat deze ' + EK.esc(r.redenen.join(' en ') || 'goed aansluit bij uw wensen') + '.</p>' +
          (r.tips.length ? '<p style="margin-top:.5rem">' + EK.esc(r.tips.join(' ')) + '</p>' : '') +
          '<div class="hero-ctas" style="margin-top:12px"><a class="btn btn-main" href="' + EK.configUrl(p.id) + '" data-track="stel_samen">Stel uw ' + EK.esc(p.merk) + ' samen</a><a class="btn btn-ghost" href="' + EK.productUrl(p) + '">Bekijk de ' + EK.esc(p.merk) + '</a></div>' +
          '<p class="price-note" style="margin-top:10px">Dit is een advies op basis van uw voorkeuren. ElektroKlik controleert altijd uw technische situatie.</p>';
        out.setAttribute('tabindex', '-1'); out.focus();
        if (gridEl) EK.renderProductGrid(gridEl, p.id);
        EK.track('keuzehulp_advies', { aanbevolen: p.id });
      });
    });
  };

  /* ---------- Metingen (GA4 / GTM via dataLayer) ----------
     Alle gebeurtenissen gaan naar window.dataLayer. Zonder toestemming worden
     er (via Consent Mode) geen analytische of advertentiecookies geplaatst. */
  window.dataLayer = window.dataLayer || [];
  EK.track = function (event, params) {
    var payload = Object.assign({ event: event }, params || {});
    window.dataLayer.push(payload);
    if (typeof window.gtag === 'function' && !(EK.config && EK.config.instellingen.gtmContainerId)) {
      var p = Object.assign({}, params || {}); window.gtag('event', event, p);
    }
  };
  /* Meet een verstuurde laadpaalaanvraag één keer (GA4, Google Ads, Meta). Wordt direct na het versturen aangeroepen
     en nogmaals op de bedankpagina; het aanvraagnummer voorkomt dubbel meten. */
  EK.meetAanvraag = function (a) {
    if (!a || !a.referentie) return;
    var k = 'ek_lead_' + a.referentie;
    try { if (localStorage.getItem(k) || sessionStorage.getItem(k)) return; } catch (e) {}
    try { localStorage.setItem(k, '1'); } catch (e) { try { sessionStorage.setItem(k, '1'); } catch (e2) {} }
    EK.track('generate_lead', { currency: 'EUR', value: a.totaal, lead_type: a.type, laadpaal: a.product, transaction_id: a.referentie });
    EK.track('laadpaal_aanvraag', { currency: 'EUR', value: a.totaal, lead_type: a.type, laadpaal: a.product, transaction_id: a.referentie });
    // Google Ads-conversie 'Laadpaal aanvraag' (alleen na een echte aanvraag via de configurator)
    if (typeof window.gtag === 'function') window.gtag('event', 'conversion', { send_to: 'AW-18199719989/JBcMCIrEgrodELXgpuZD', value: a.totaal || 1, currency: 'EUR', transaction_id: a.referentie });
    if (typeof window.fbq === 'function') window.fbq('track', 'Lead', { lead_type: 'Laadpaal ' + a.type, value: a.totaal, currency: 'EUR' });
  };
  EK.gaItem = function (p) { return { item_id: p.id, item_name: p.naam, item_brand: p.merk, price: p.vanafprijs, currency: 'EUR' }; };

  /* Consent Mode v2 + niet-blokkerende cookiebalk */
  var CONSENT_KEY = 'ek_consent_v1';
  function getConsent() { try { return localStorage.getItem(CONSENT_KEY); } catch (e) { return null; } }
  function applyConsent(v) {
    if (typeof window.gtag !== 'function') return;
    var g = v === 'granted' ? 'granted' : 'denied';
    window.gtag('consent', 'update', { analytics_storage: g, ad_storage: g, ad_user_data: g, ad_personalization: g });
    if (v === 'granted' && typeof window.fbq === 'function') window.fbq('consent', 'grant');
  }
  EK.initConsent = function () {
    var v = getConsent();
    if (v) { applyConsent(v); return; }
    var bar = document.createElement('div');
    bar.className = 'consent-bar'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Cookie-instellingen');
    bar.innerHTML = '<p>Wij gebruiken cookies om te meten hoe onze website wordt gebruikt en om onze advertenties te verbeteren. Gaat u hiermee akkoord?</p><div class="row"><button class="btn btn-main" data-c="granted">Akkoord</button><button class="btn btn-ghost" data-c="denied">Alleen noodzakelijk</button></div>';
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('[data-c]'); if (!b) return;
      try { localStorage.setItem(CONSENT_KEY, b.getAttribute('data-c')); } catch (er) {}
      applyConsent(b.getAttribute('data-c')); bar.remove();
    });
    document.body.appendChild(bar);
  };

  EK.loadGTM = function () {
    EK.loadConfig().then(function (c) {
      var id = c.instellingen.gtmContainerId;
      if (!id || !/^GTM-[A-Z0-9]+$/.test(id)) return;
      window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
      var s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtm.js?id=' + id;
      document.head.appendChild(s);
    }).catch(function () {});
  };

  /* Bewaar advertentie-ID's (gclid) voor latere offline conversiemeting */
  EK.captureClickIds = function () {
    try {
      var q = new URLSearchParams(location.search);
      ['gclid', 'gbraid', 'wbraid', 'utm_source', 'utm_medium', 'utm_campaign'].forEach(function (k) {
        if (q.get(k)) sessionStorage.setItem('ek_' + k, q.get(k));
      });
    } catch (e) {}
  };
  EK.clickIds = function () {
    var o = {};
    try { ['gclid', 'gbraid', 'wbraid', 'utm_source', 'utm_medium', 'utm_campaign'].forEach(function (k) { var v = sessionStorage.getItem('ek_' + k); if (v) o[k] = v; }); } catch (e) {}
    return o;
  };

  EK.toast = function (msg) {
    var t = document.createElement('div'); t.className = 'ek-toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 4200);
  };

  /* Klik-tracking op CTA's en FAQ */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-track]');
    if (a) {
      var card = a.closest('[data-product]');
      EK.track('cta_klik', { cta: a.getAttribute('data-track'), laadpaal: card ? card.getAttribute('data-product') : (a.getAttribute('data-laadpaal') || undefined), pagina: location.pathname });
    }
    var tel = e.target.closest('a[href^="tel:"], a[href*="wa.me"]');
    if (tel) EK.track('contact_klik', { kanaal: tel.href.indexOf('wa.me') > -1 ? 'whatsapp' : 'telefoon', pagina: location.pathname });
  });
  document.addEventListener('toggle', function (e) {
    if (e.target.tagName === 'DETAILS' && e.target.open && e.target.closest('.faq')) {
      var s = e.target.querySelector('summary'); EK.track('faq_open', { vraag: s ? s.textContent.trim().slice(0, 90) : '' });
    }
  }, true);

  document.addEventListener('DOMContentLoaded', function () {
    EK.captureClickIds();
    EK.loadGTM();
    EK.loadConfig().then(function (c) {
      if (!c.instellingen.prijzenGoedgekeurd && !document.querySelector('.concept-banner') && document.body.hasAttribute('data-concept-banner')) {
        var b = document.createElement('div'); b.className = 'concept-banner';
        b.textContent = 'Testversie: de getoonde prijzen zijn voorbeeldprijzen en nog niet definitief.';
        var main = document.querySelector('main'); if (main) main.parentNode.insertBefore(b, main);
      }
    }).catch(function () {});
    EK.fillPrices();
  });
})();
