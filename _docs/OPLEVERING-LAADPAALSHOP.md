# Oplevering laadpaalshop ElektroKlik

**Status: testversie, niet gepubliceerd.** De verkoopprijzen zijn verwerkt zoals opgegeven. Publicatie gebeurt pas na uw goedkeuring.

---

## 1. Techniek in het kort

- **Website:** statische HTML op GitHub Pages, aangevuld met de shop. Er is geen tweede systeem of CMS bijgekomen.
- **Prijzen en teksten:** staan centraal in `laadpalen/data/config.json`. U bewerkt ze via `/beheer/`.
- **Prijsmotor:** `laadpalen/assets/pricing.js` rekent alle prijzen uit. Dezelfde code kan later op een server draaien voor online betalen.
- **Aanvragen:** gaan via Formspree naar uw mailbox en naar het Formspree-dashboard. U beheert ze in `/beheer/` → Aanvragen.

---

## 2. Assortiment en prijzen

Alle prijzen zijn inclusief btw, **professionele standaardinstallatie en load balancing**.

| Laadpaal | Prijs | Inbegrepen load balancing | Foto |
|---|---:|---|---|
| Easee Charge Up | € 1.450 | Easee Equalizer P1 | Uw Easee-foto's (vooraanzicht en zijaanzicht) |
| Easee Charge Max | € 1.600 | Easee Equalizer P1 | Uw Easee-foto met de strepen aan de zijkanten (door u bevestigd) |
| Zaptec Go 2 | € 1.750 | Zaptec Sense P1 | Uw foto's |
| Peblar Home | € 1.475 (5 m) / € 1.535 (7,5 m) | Peblar dynamische load balancing | Officiële Peblar-foto's (voor- en zijaanzicht), vaste laadkabel |
| Peblar Business | € 1.785 (5 m) / € 1.850 (7,5 m) | Peblar dynamische load balancing | Zelfde foto's als Peblar Home, MID-meter |

- Load balancing kan nergens meer apart worden gekozen of uitgezet. Het staat overal als inbegrepen vermeld.
- Voor load balancing via de P1-poort is een slimme meter nodig. Daarom staat de vraag **"Heeft u een slimme meter?"** in de configurator. Bij "Nee" of "Weet ik niet" wordt de aanvraag gemarkeerd voor controle.

**Toeslagen** (inclusief btw):

| Onderdeel | Prijs | Zichtbaar voor de klant |
|---|---:|---|
| Kabelroute tot 10 meter | € 0 | Nee, alleen de totaalprijs |
| Kabelroute 10–20 meter | € 90 | Nee, alleen de totaalprijs |
| Kabelroute meer dan 20 meter | € 200 + geschatte meters + controle | Nee, alleen de totaalprijs |
| Meterkast geschikt, maar geen vrije ruimte | € 25 | Nee, alleen de totaalprijs |
| Geen toegankelijke kruipruimte | € 35 ("Weet ik niet" = beoordeling) | Nee, alleen de totaalprijs |
| Graafwerk | aantal meters × € 25 | Nee, alleen de totaalprijs |
| Montagepaal Easee / Zaptec / Peblar | € 329 / € 359 / € 409 (Peblar: voorlopig, te bevestigen) | Ja |
| Kabelhouder | € 50 | Ja |

- Het prijsblok toont: laadpaal, montagepaal, kabelhouder, één regel **"Aanpassingen voor uw situatie"** en het totaal.
- In het prijsoverzicht vóór het versturen ziet de klant de volledige prijsopbouw. Kosten die nog niet vaststaan worden daar expliciet genoemd, zoals een eventuele uitbreiding van de meterkast.
- **Laadkabel (optioneel, in de stap Aansluiting):** Type 2, 1-fase 32 A (7,4 kW), 5 meter voor € 140, of Type 2, 3-fase 32 A (22 kW), 5 meter voor € 175. De kabel die past bij de gekozen aansluiting wordt aangeraden. Prijs zichtbaar voor de klant; er kan maar één kabel tegelijk worden gekozen.

---

## 3. Nieuwe volgorde van de configurator

**Standaardroute (8 stappen):**

1. **Laadpaal:** keuze uit de vijf modellen, met een optionele keuzehulp.
2. **Meterkast:** uw vier voorbeeldfoto's, twee geschikte meterkasten (✓) en twee die beoordeeld moeten worden (✕), plus vier grote keuzevakken.
   - *Geschikt, voldoende ruimte* → verder.
   - *Geschikt, geen vrije ruimte* → verder, met € 25 toeslag voor het uitbreiden van de meterkast. Intern gemarkeerd als "Aanvullende uitbreidingskast mogelijk nodig".
   - *Verouderd of niet geschikt* → melding "Wij adviseren u een vrijblijvende offerte aan te vragen." De knop wordt **"Vraag vrijblijvend een offerte aan"**.
   - *Weet ik niet* → de klant gaat verder met samenstellen. De aanvraag wordt gemarkeerd zodat u de meterkast vooraf controleert.
3. **Plaats:** buitenmuur, garage, montagepaal (+ prijs) of anders. Daaronder de kabelhouder (€ 50); die wordt niet getoond bij een montagepaal.
4. **Kabelroute:** afstand (bij meer dan 20 m ook het aantal meters), kruipruimte, en graafwerk (bij "Ja" het aantal meters).
5. **Aansluiting:** 1- of 3-fase, slimme meter, zonnepanelen en zakelijk verrekenen. Wil iemand zakelijk verrekenen met een Easee Charge Up, dan ziet hij een melding met een knop om naar een model met MID-meter te wisselen.
6. **Overzicht:** prijsindicatie met volledige prijsopbouw en "wat wij nog controleren". De knop is **"Vraag uw definitieve prijs aan"**.
7. **Gegevens:** naam, e-mail, telefoon, installatieadres en opmerkingen. Geen account nodig.
8. **Foto's** (alles optioneel):
   - drie aparte uploads: meterkast, **kabelroute** en laadpaallocatie;
   - werkt met de camera van de smartphone, JPG/PNG/HEIC, maximaal 20 MB per foto en maximaal 3 per onderdeel, met voorvertoning en verwijderknop;
   - daaronder het blok "Heeft u op dit moment geen foto's bij de hand?" met e-mail, telefoon en de knop "Foto's later via WhatsApp versturen";
   - het aanvraagnummer staat al op deze stap, zodat de klant het kan vermelden bij foto's die hij later stuurt.

**Offerteroute (4 stappen, alleen bij een verouderde meterkast):** laadpaal → meterkast → gegevens → foto's. Het gekozen model en alle ingevulde gegevens blijven bewaard; de klant hoeft niets opnieuw in te vullen.

- **Betaling:** er wordt nergens direct betaald. De klant ontvangt eerst een definitieve offerte, en de bedankpagina legt dat uit. De structuur is voorbereid op online betalen later.
- **Na het versturen:** de klant ziet het aanvraagnummer. Zijn er geen foto's meegestuurd, dan staat er opnieuw een WhatsApp-knop met het aanvraagnummer al in het bericht.

---

## 4. Aanvraagbeheer (`/beheer/` → Aanvragen)

Per aanvraag ziet u:

- aanvraagnummer, datum, contactgegevens en installatieadres;
- laadpaal, meterkastkeuze, kabelafstand (met meters), kruipruimte, graafwerk (met meters), montagepaal en kabelhouder;
- aansluiting, slimme meter, zonnepanelen en zakelijk verrekenen;
- de berekende totaalprijs, alle interne toeslagen en de technische bijzonderheden;
- een waarschuwing als de prijs met de huidige prijzen anders zou uitkomen;
- de **status**: Nieuw, In behandeling, Wacht op foto's, Offerte verstuurd, Akkoord, Ingepland, Geïnstalleerd of Geannuleerd;
- uw **interne notities**;
- **later ontvangen foto's**, die u aan de aanvraag kunt koppelen.

Aanvragen komen in het overzicht door de **CSV-export uit Formspree te importeren**, of door één aanvraag te plakken. Statussen en notities blijven behouden als u later opnieuw importeert. Het overzicht kunt u exporteren naar Excel (CSV, inclusief gclid voor Google Ads) en als back-up opslaan.

> **Belangrijke beperking:** dit overzicht en de later toegevoegde foto's worden bewaard **in de browser van de computer waarop u ze invoert**. De foto's die de klant bij de aanvraag meestuurt, staan in de e-mail en in Formspree.
>
> Wilt u later een centraal systeem, waarin aanvragen automatisch binnenkomen en foto's online worden opgeslagen? Dan is een kleine server-koppeling nodig. Dat kan altijd nog worden toegevoegd.

---

## 5. Privacy en cookies

- **Privacyverklaring:** uw tekst staat op `/privacyverklaring/`. Alle links verwijzen ernaartoe: configurator, cookiebalk, formulieren en de footer van elke pagina. Het oude adres `/privacy.html` stuurt automatisch door. De pagina staat ook in de sitemap.
- **Cookiebalk op de hele site:** Google Analytics, Google Ads en de Meta-pixel plaatsen pas cookies na "Akkoord".
- **Cookie-instellingen:** in de footer van elke pagina en in artikel 9 van de privacyverklaring staat een link "Cookie-instellingen". Daarmee kan een bezoeker zijn keuze later wijzigen, zoals uw privacyverklaring belooft.
- **Cookie-informatie:** een aparte cookiepagina is niet verplicht. De verplichte informatie staat nu als overzicht in artikel 9 van de privacyverklaring: welke diensten, met welk doel, welk soort cookie en welke bewaartermijn.

## 6. Aanvragen per e-mail

Ja, iedere aanvraag komt al bij u binnen per e-mail. De configurator verstuurt via hetzelfde Formspree-formulier als uw huidige offerteformulier, dus naar dezelfde mailbox.

**De e-mail bevat:**
- aanvraagnummer, soort aanvraag (standaard of offerte) en status;
- naam, e-mail, telefoon en installatieadres;
- laadpaal met de inbegrepen load balancing;
- meterkast, montageplek, montagepaal, kabelhouder, kabelafstand (met meters), kruipruimte, graafwerk (met meters), aansluiting, slimme meter, zonnepanelen en zakelijk verrekenen;
- volledige prijsopbouw en prijsindicatie, wat nog gecontroleerd moet worden, interne bijzonderheden en opmerkingen van de klant;
- de foto's (bij Formspree als link in de e-mail).

**Let op:**
- Bestandsuploads zijn bij Formspree een betaalde functie. Zonder dat abonnement wordt de aanvraag automatisch zonder foto's verstuurd, en vraagt de bevestigingspagina de klant om de foto's te mailen of te WhatsAppen.
- Formspree kan de klant ook automatisch een bevestigingsmail sturen (de "autoresponse"). Dat is eveneens een betaalde functie, die u in het Formspree-dashboard aanzet.

## 6b. Foto's uploaden

- De klant kan altijd foto's uploaden in de laatste stap.
- De foto's komen mee met de aanvraag. U ziet ze in Formspree en in de e-mail, mits uw Formspree-abonnement bestandsuploads ondersteunt.
- Het blok "Heeft u op dit moment geen foto's bij de hand?" is bedoeld voor klanten die nog geen foto's hebben, zoals u had gevraagd. Het is geen foutmelding.
- Weigert Formspree de bestanden (bijvoorbeeld omdat uploads niet in uw abonnement zitten), dan wordt de aanvraag zonder foto's verstuurd. Alleen dan vraagt de bedankpagina de klant om de foto's te mailen of te WhatsAppen.
- Controleer daarom in uw Formspree-dashboard of bestandsuploads voor dit formulier beschikbaar zijn. Doe daarna één echte testaanvraag met een foto.

## 6c. Betalen

De klant betaalt niets via de website. U beoordeelt eerst de situatie, stuurt een definitieve offerte en spreekt de betaling met de klant af, buiten de website om. In het beheer zet u de status daarna op "Akkoord" en "Betaald".

## 7. Tests (allemaal geslaagd)

| Test | Wat wordt gecontroleerd |
|---|---|
| `_tests/pricing.test.js` (18 tests) | De vijf prijzen, load balancing altijd inbegrepen, de afstandsstaffel, meters bij meer dan 20 m, kruipruimte, graafwerk per meter, montagepaal per model, kabelhouder, de meterkastroutes, slimme meter, zakelijk verrekenen, een combinatie (€ 2.494) en ongeldige configuraties |
| `_tests/configurator.e2e.js` | **Desktop:** volledige standaardroute met alle toeslagen, foto-upload en versturen, inclusief controle van alle velden in de aanvraag. **Mobiel:** verouderde meterkast → offerteroute zonder foto's. **Mobiel:** "Weet ik niet" met een mislukte foto-upload → automatisch opnieuw verstuurd zonder foto's |
| `_tests/beheer-en-foutscenarios.e2e.js` | Beheer: tabbladen, marge (inclusief inkoop load balancing) en validatie. Aanvraagregister: CSV-import, status, detail en later toegevoegde foto, bewaard na herladen. Prijswijziging tijdens het invullen. Storing bij de formulierdienst, met gegevens die bewaard blijven |

Verder gecontroleerd:

- geen oude prijzen of verkeerde productnamen meer in de site;
- geen "je", "jij", "jou" of "jouw" in klantteksten;
- overal "kabelroute" in plaats van een technischer woord.

---

## 8. Verwerkt in versie 4

- Uw vier meterkastfoto's in de meterkastcontrole (twee geschikt, twee beoordelen). De illustratie is verwijderd.
- Nieuwe foto voor de Alfen Eve Single Pro-line.
- De Easee Charge Max heeft de foto met de strepen aan de zijkanten, zoals u bevestigde.
- Voorrijkosten binnen het werkgebied zijn inbegrepen.
- Garantie: 2 jaar installatiegarantie van ElektroKlik volgens uw tekst. Op de laadpaal geldt de fabrieksgarantie volgens de voorwaarden van de fabrikant.
- Cookiebalk op de hele site.
- Uw privacyverklaring staat op `/privacyverklaring/`, met "Cookie-instellingen" in de footer.

**Nog open (optioneel):**
- Een centraal aanvraagsysteem met online opslag van foto's (zie §4).

## 8b. Aangepast in versie 8

- Productkaarten zijn even hoog, ook bij foto's met een andere verhouding (Zaptec).
- Het blok "Mogelijk extra, afhankelijk van uw situatie" is overal weggehaald. Overal staat nu "Standaard inbegrepen"; gekozen extra's staan apart in het prijsoverzicht.
- "Aparte groep met aardlekautomaat" is vervangen door "aparte beveiliging in de meterkast".
- Het woord "gewoon" is uit alle klantteksten gehaald.
- Meterkast "Weet ik niet" → de klant gaat verder. Meterkast zonder vrije ruimte → € 25 toeslag.
- De melding over de MID-meter eindigt nu na de knop om van laadpaal te wisselen.
- Shoppagina's hebben een donkere paginakop onder het menu, met kruimelpad en titel. Daardoor sluit de pagina rustiger aan op het menu.

## 9. Bekijken en publiceren

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Open daarna `http://127.0.0.1:8765/laadpalen/`. Instructies voor de tests staan in `_tests/README.md`.

Publiceer pas na uw goedkeuring. Gebruik eerst een testomgeving, bijvoorbeeld een aparte privé-repository met GitHub Pages.


## Wijziging november 2026: Alfen vervangen door Peblar
- Alfen Eve Single S-line en Pro-line zijn verwijderd; de oude adressen sturen door naar /laadpalen/.
- Peblar Home en Peblar Business hebben een vaste laadkabel; de klant kiest 5 of 7,5 meter (`kabelVarianten` in config.json). De vanafprijs is altijd de laagste kabelprijs.
- Bij Peblar wordt de optie voor een losse laadkabel verborgen; alle overige vragen en toeslagen blijven gelden.
