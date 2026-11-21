/* ElektroKlik – offertelink
 * De offerte staat versleuteld in de link zelf (na het #-teken). Er wordt niets op de website of op GitHub opgeslagen.
 * Versleuteling: AES-GCM 256 bit, sleutel afgeleid van de code (8 tekens) met PBKDF2-SHA256.
 * Zonder de juiste code is de inhoud onleesbaar; wie iets in de link verandert, krijgt een foutmelding.
 * Het deel na # wordt door browsers nooit naar een server gestuurd.
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

  root.EKOfferte = { versleutel: versleutel, ontsleutel: ontsleutel, nieuweCode: nieuweCode, normaliseer: normaliseer, totalen: totalen, euro: euro };
})(typeof window !== 'undefined' ? window : this);
