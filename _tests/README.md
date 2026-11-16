# Tests laadpaalshop

Deze map begint met een underscore, zodat GitHub Pages hem niet publiceert.

1. Start een lokale webserver in de hoofdmap van de website:
   `python3 -m http.server 8765 --bind 127.0.0.1`
2. Prijsmotor (geen browser nodig): `node _tests/pricing.test.js`
3. Volledige bestelflow op desktop en mobiel (Playwright): `node _tests/configurator.e2e.js`
4. Beheer, prijswijziging tijdens bestellen en storingen: `node _tests/beheer-en-foutscenarios.e2e.js`
5. Peblar (vier prijzen, kabellengte, geen losse laadkabel, oude Alfen-adressen): `node _tests/peblar.e2e.js`

De e2e-tests onderscheppen het verzenden naar Formspree. Er worden dus geen echte aanvragen verstuurd.


## Prijzen in de pagina's
`node _tools/sync-prijzen.js --check` controleert of de vaste prijzen in de HTML (productpagina's, blog, gegevens voor Google) gelijk lopen met `laadpalen/data/config.json`. Na publiceren via /beheer/ werkt de GitHub Action `prijzen-sync` dit automatisch bij.
