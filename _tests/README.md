# Tests laadpaalshop

Deze map begint met een underscore, zodat GitHub Pages hem niet publiceert.

1. Start een lokale webserver in de hoofdmap van de website:
   `python3 -m http.server 8765 --bind 127.0.0.1`
2. Prijsmotor (geen browser nodig): `node _tests/pricing.test.js`
3. Volledige bestelflow op desktop en mobiel (Playwright): `node _tests/configurator.e2e.js`
4. Beheer, prijswijziging tijdens bestellen en storingen: `node _tests/beheer-en-foutscenarios.e2e.js`

De e2e-tests onderscheppen het verzenden naar Formspree. Er worden dus geen echte aanvragen verstuurd.
5. Cloudflare Worker (zonder browser): `node _tests/worker.test.mjs`
6. Volledige betaalroute in de browser: `node _tests/betalen.e2e.js`
