# Stappenplan: Cloudflare Worker voor ElektroKlik

Met deze Worker kunt u:

- **online laten betalen met Mollie:** u maakt in het beheer een betaallink, de klant geeft akkoord op de offerte en betaalt met iDEAL;
- **aanvragen centraal bewaren:** iedere aanvraag uit de configurator komt ook automatisch op de server binnen, zonder foto's. Die blijven via Formspree en e-mail lopen. In het beheer haalt u alles met één klik op, op elke computer.

Kosten: het gratis Cloudflare-abonnement is ruim voldoende. Bij Mollie betaalt u alleen de normale transactiekosten.

De code staat in het bestand **`_cloudflare/elektroklik-worker.js`**. Daar staan geen wachtwoorden in; die vult u apart in bij Cloudflare.

---

## Stap 1 – Cloudflare-account
1. Ga naar **dash.cloudflare.com** en maak een gratis account aan, of log in.

## Stap 2 – Opslag (KV) aanmaken
1. Ga in het linkermenu naar **Storage & Databases → KV** (soms: Workers & Pages → KV).
2. Klik op **Create** (of "Create a namespace").
3. Naam: `elektroklik-data` → **Add/Create**.

## Stap 3 – De Worker aanmaken
1. Ga naar **Workers & Pages → Create → Create Worker** (soms: "Start with Hello World").
2. Naam: `elektroklik` → **Deploy**.
3. Klik op **Edit code**.
4. Selecteer alle bestaande code in de editor en verwijder die.
5. Open het bestand `elektroklik-worker.js`, kopieer **alle** tekst en plak die in de editor.
6. Klik rechtsboven op **Deploy**.

## Stap 4 – De opslag koppelen
1. Ga in uw Worker naar **Settings → Bindings → Add → KV namespace**.
2. Variable name: **`DB`** (precies zo, met hoofdletters).
3. KV namespace: kies `elektroklik-data` → **Save/Deploy**.

## Stap 5 – Instellingen en geheimen
Ga in uw Worker naar **Settings → Variables and Secrets → Add** en voeg deze vier toe:

| Naam | Type | Waarde |
|---|---|---|
| `MOLLIE_API_KEY` | **Secret** | Uw Mollie API-sleutel. Begin met de **test**sleutel (`test_…`). U vindt hem in het Mollie-dashboard → Developers → API keys. |
| `ADMIN_KEY` | **Secret** | Een zelfgekozen lang wachtwoord, **minimaal 24 tekens**. Dit is uw beheersleutel. Bewaar hem in uw wachtwoordmanager. |
| `SITE_URL` | Text | `https://elektroklik.nl` |
| `ALLOWED_ORIGINS` | Text | `https://elektroklik.nl,https://www.elektroklik.nl` |

Klik daarna op **Deploy/Save**.

## Stap 6 – Controleren
1. Kopieer het adres van uw Worker. Dat staat bovenaan, bijvoorbeeld `https://elektroklik.uwnaam.workers.dev`.
2. Open dat adres in uw browser. U hoort te zien: `{"ok":true,"dienst":"ElektroKlik","mollie":"test"}`.
   - Ziet u "De Worker is nog niet volledig ingesteld"? Dan noemt de melding wat er nog ontbreekt.

## Stap 7 – De website koppelen
1. Open `/beheer/` → tabblad **Algemeen**.
2. Vul bij **Server-adres (Cloudflare Worker)** het adres uit stap 6 in.
3. Vul eventueel bij **Algemene voorwaarden** het adres van uw voorwaarden in. Die worden dan op de betaalpagina genoemd.
4. Klik op **Publiceren…**, of download `config.json` en zet die op de website.
5. Ga naar het tabblad **Aanvragen**, vul uw beheersleutel (`ADMIN_KEY`) in en klik op **Verbinding testen**. U hoort te zien: "Verbinding in orde".

## Stap 8 – Testbetaling
1. Doe op de website een testaanvraag via de configurator.
2. Klik in het beheer op **Ophalen van server** en open de aanvraag.
3. Vul bij **Online betaling (Mollie)** een bedrag in en klik op **Betaallink aanmaken**.
4. Open de betaallink, vink "akkoord" aan en klik op **Akkoord en veilig betalen**.
5. Mollie toont in testmodus een testbetaalscherm. Kies daar **Paid**.
6. U komt terug op de site met "Bedankt voor uw betaling".
7. Klik in het beheer op **Ophalen van server**. De status is nu **Betaald**.

## Stap 9 – Live gaan
1. Vervang in Cloudflare de secret `MOLLIE_API_KEY` door uw **live**sleutel (`live_…`).
2. Controleer in Mollie dat iDEAL (en eventueel andere betaalmethoden) aanstaat.
3. Het Worker-adres toont nu `"mollie":"live"`.

---

## Zo werkt het daarna, dagelijks

1. Een aanvraag komt binnen per e-mail (via Formspree) én op de server.
2. U klikt in `/beheer/` → Aanvragen op **Ophalen van server**.
3. U beoordeelt de situatie en maakt bij de aanvraag een **betaallink**, voor het volledige bedrag of een aanbetaling.
4. Met **Betaallink mailen naar de klant** opent u een kant-en-klare e-mail.
5. De klant opent de link, gaat akkoord met de offerte en betaalt.
6. Mollie bevestigt de betaling automatisch aan de server. In het beheer ziet u de status **Betaald**. Mollie stuurt u daarnaast zelf een melding.

## Veiligheid

- **Het bedrag** wordt alleen in het beheer vastgelegd en staat op de server. Een klant kan het niet aanpassen.
- **De betaalstatus** vraagt de Worker altijd rechtstreeks op bij Mollie.
- **Beheerfuncties** werken alleen met uw beheersleutel.
- **Aanvragen** worden alleen aangenomen vanaf uw eigen website, met een limiet tegen misbruik.
- **Bewaartermijnen:** aanvragen worden na 6 maanden automatisch verwijderd, zoals in uw privacyverklaring staat. Betaallinks na ruim een jaar. Betalingen zelf blijven altijd bij Mollie bewaard voor uw administratie.

## Problemen?

| Melding | Oplossing |
|---|---|
| "Geen toegang. Controleer de beheersleutel." | De ingevulde beheersleutel komt niet overeen met `ADMIN_KEY` in Cloudflare. |
| "De Worker is nog niet volledig ingesteld." | Kijk welke instelling de melding noemt (stap 4 of 5). |
| "De betaling kon niet worden gestart." | Controleer `MOLLIE_API_KEY`, en of uw Mollie-account actief is. |
| Ophalen werkt niet vanaf de live website | Controleer of `ALLOWED_ORIGINS` precies uw websiteadres bevat, met `https://` en zonder `/` aan het eind. |
