/* ElektroKlik – offertelink
 * Versie 2 (standaard): korte link  /uw-offerte/#<id>.<sleutel>
 *   De offerte staat versleuteld (AES-GCM, willekeurige 128-bits sleutel) in /uw-offerte/o/<id>.json op de website.
 *   De sleutel staat alleen in de link, na het #-teken; dat deel stuurt een browser nooit naar een server.
 *   Zonder de volledige link is het bestand onleesbaar; wie iets aanpast, krijgt een foutmelding.
 * Versie 1 (oude links): de offerte zit in de link zelf (#o=…) en wordt geopend met een code van 8 tekens.
 */
(function (root) {
  'use strict';
  var TEKENS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // zonder 0/O, 1/I/L
  var ITERATIES = 210000;
  var enc = new TextEncoder(), dec = new TextDecoder();

  function b64url(bytes) {
    var s = ''; bytes = new Uint8Array(bytes);
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function vanB64url(str) {
    str = String(str).replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    var s = atob(str), out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  /** "k7mp-4qxr" → "K7MP4QXR" */
  function normaliseer(code) { return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function nieuweCode() {
    var r = new Uint8Array(8), s = '';
    crypto.getRandomValues(r);
    for (var i = 0; i < 8; i++) s += TEKENS[r[i] % TEKENS.length];
    return s.slice(0, 4) + '-' + s.slice(4);
  }
  function sleutel(code, salt) {
    return crypto.subtle.importKey('raw', enc.encode(normaliseer(code)), 'PBKDF2', false, ['deriveKey']).then(function (basis) {
      return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: ITERATIES, hash: 'SHA-256' }, basis, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }
  /** offerte (object) + code → "v1.<salt>.<iv>.<data>" */
  function versleutel(offerte, code) {
    var salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    return sleutel(code, salt).then(function (k) {
      return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, enc.encode(JSON.stringify(offerte)));
    }).then(function (data) { return ['v1', b64url(salt), b64url(iv), b64url(data)].join('.'); });
  }
  /** Geeft de offerte terug, of een fout met .soort = 'link' (onvolledige link) of 'code' (verkeerde code of aangepaste link). */
  function ontsleutel(token, code) {
    var d = String(token || '').split('.');
    if (d.length !== 4 || d[0] !== 'v1') return Promise.reject(Object.assign(new Error('Onvolledige link'), { soort: 'link' }));
    var salt, iv, data;
    try { salt = vanB64url(d[1]); iv = vanB64url(d[2]); data = vanB64url(d[3]); } catch (e) { return Promise.reject(Object.assign(new Error('Onvolledige link'), { soort: 'link' })); }
    return sleutel(code, salt).then(function (k) { return crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, k, data); })
      .then(function (buf) { return JSON.parse(dec.decode(buf)); })
      .catch(function () { throw Object.assign(new Error('Code onjuist of link aangepast'), { soort: 'code' }); });
  }
  /* --- Versie 2: korte link met sleutel --- */
  function nieuweId() {
    var t = 'abcdefghjkmnpqrstuvwxyz23456789', r = new Uint8Array(8), s = '';
    crypto.getRandomValues(r);
    for (var i = 0; i < 8; i++) s += t[r[i] % t.length];
    return s;
  }
  function nieuweSleutel() { return b64url(crypto.getRandomValues(new Uint8Array(16))); }
  function aesSleutel(sleutelB64) { return crypto.subtle.importKey('raw', vanB64url(sleutelB64), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']); }
  /** offerte + sleutel → inhoud van het bestand o/<id>.json */
  function versleutelBestand(offerte, sleutelB64) {
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return aesSleutel(sleutelB64).then(function (k) { return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, enc.encode(JSON.stringify(offerte))); })
      .then(function (data) { return JSON.stringify({ v: 2, iv: b64url(iv), data: b64url(data) }); });
  }
  function ontsleutelBestand(bestand, sleutelB64) {
    var b; try { b = typeof bestand === 'string' ? JSON.parse(bestand) : bestand; } catch (e) { b = null; }
    if (!b || b.v !== 2) return Promise.reject(Object.assign(new Error('Onbekend bestand'), { soort: 'link' }));
    return aesSleutel(sleutelB64).then(function (k) { return crypto.subtle.decrypt({ name: 'AES-GCM', iv: vanB64url(b.iv) }, k, vanB64url(b.data)); })
      .then(function (buf) { return JSON.parse(dec.decode(buf)); })
      .catch(function () { throw Object.assign(new Error('Link aangepast of onvolledig'), { soort: 'link' }); });
  }
  /** "#k7mp4qxr.Xy3f…" → { id, sleutel } of null */
  function leesKorteLink(hash) {
    var m = String(hash || '').replace(/^#/, '').match(/^([a-z0-9]{8})\.([A-Za-z0-9_-]{22})$/);
    return m ? { id: m[1], sleutel: m[2] } : null;
  }

  /** Bedragen in hele centen om afrondingsfouten te voorkomen. */
  function totalen(offerte) {
    var cent = function (n) { return Math.round(Number(n || 0) * 100); };
    var totaal = (offerte.regels || []).reduce(function (s, r) { return s + cent(r.bedrag); }, 0);
    var btwPct = Number(offerte.btwPercentage == null ? 21 : offerte.btwPercentage);
    var btw = Math.round(totaal * btwPct / (100 + btwPct));
    var aanbetaling = Math.round(totaal * Number(offerte.aanbetalingPercentage || 0) / 100);
    return { totaal: totaal / 100, btw: btw / 100, excl: (totaal - btw) / 100, aanbetaling: aanbetaling / 100, rest: (totaal - aanbetaling) / 100 };
  }
  function euro(n) { return '€ ' + Number(n).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  root.EKOfferte = { versleutel: versleutel, ontsleutel: ontsleutel, nieuweCode: nieuweCode, normaliseer: normaliseer, totalen: totalen, euro: euro,
    nieuweId: nieuweId, nieuweSleutel: nieuweSleutel, versleutelBestand: versleutelBestand, ontsleutelBestand: ontsleutelBestand, leesKorteLink: leesKorteLink };
})(typeof window !== 'undefined' ? window : this);
