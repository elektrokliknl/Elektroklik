/* ElektroKlik – cookietoestemming voor de hele website.
 * In de <head> van iedere pagina staat Google Consent Mode v2 standaard op 'denied' en de Meta-pixel op 'revoke'.
 * Dit script toont een rustige, niet-blokkerende balk en past de toestemming aan na de keuze van de bezoeker. */
(function () {
  'use strict';
  var KEY = 'ek_consent_v1';
  var PRIVACY = '/privacyverklaring/';
  function lees() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function pas(v) {
    var g = v === 'granted' ? 'granted' : 'denied';
    if (typeof window.gtag === 'function') window.gtag('consent', 'update', { analytics_storage: g, ad_storage: g, ad_user_data: g, ad_personalization: g });
    if (typeof window.fbq === 'function') window.fbq('consent', v === 'granted' ? 'grant' : 'revoke');
  }
  function balk() {
    var css = document.createElement('style');
    css.textContent = '.ek-cb{position:fixed;left:16px;right:16px;bottom:16px;z-index:2500;max-width:560px;background:#fff;color:#334155;border:1px solid #e3e8ef;border-radius:16px;box-shadow:0 18px 48px rgba(15,27,45,.18);padding:16px 18px;font:400 .92rem/1.5 "DM Sans",system-ui,sans-serif}' +
      '.ek-cb p{margin:0 0 10px}.ek-cb a{color:#0b7f75}.ek-cb .r{display:flex;gap:8px;flex-wrap:wrap}' +
      '.ek-cb button{min-height:42px;padding:.55rem 1rem;border-radius:10px;font:700 .92rem "DM Sans",system-ui,sans-serif;cursor:pointer;border:1.5px solid #cfd8e3;background:#fff;color:#0f1b2d}' +
      '.ek-cb button.a{background:#0b7f75;border-color:#0b7f75;color:#fff}.ek-cb button:focus-visible{outline:3px solid #1aa597;outline-offset:2px}' +
      '@media (max-width:1080px){body:has(.mobile-bar) .ek-cb{bottom:84px}}';
    document.head.appendChild(css);
    var el = document.createElement('div');
    el.className = 'ek-cb consent-bar'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Cookie-instellingen');
    el.innerHTML = '<p>Wij gebruiken cookies om te meten hoe onze website wordt gebruikt en om onze advertenties te verbeteren. Gaat u hiermee akkoord? <a href="' + PRIVACY + '">Meer informatie</a></p>' +
      '<div class="r"><button type="button" class="a" data-c="granted">Akkoord</button><button type="button" data-c="denied">Alleen noodzakelijk</button></div>';
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-c]'); if (!b) return;
      var v = b.getAttribute('data-c');
      try { localStorage.setItem(KEY, v); } catch (er) {}
      pas(v); el.remove();
    });
    document.body.appendChild(el);
  }
  /* Opnieuw kiezen via de link 'Cookie-instellingen' */
  window.ekCookieInstellingen = function () {
    try { localStorage.removeItem(KEY); } catch (e) {}
    var oud = document.querySelector('.ek-cb'); if (oud) oud.remove();
    balk();
    var b = document.querySelector('.ek-cb button'); if (b) b.focus();
  };
  var v = lees();
  if (v) pas(v);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', balk);
  else balk();
})();
