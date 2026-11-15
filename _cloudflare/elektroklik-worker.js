/**
 * ElektroKlik – Cloudflare Worker
 * --------------------------------------------------------------------------
 * 1. Online betalen met Mollie (offerte accepteren en betalen met iDEAL).
 * 2. Centrale opslag van laadpaalaanvragen (zonder foto's; die blijven via Formspree/e-mail lopen).
 *
 * Kopieer dit volledige bestand in de Cloudflare-editor van uw Worker (Edit code → alles vervangen → Deploy).
 *
 * Benodigde instellingen in Cloudflare (Worker → Settings → Variables and Secrets):
 *   MOLLIE_API_KEY   Secret  Uw Mollie API-sleutel. Begin met de testsleutel (test_...), daarna live_...
 *   ADMIN_KEY        Secret  Een lang, zelfgekozen wachtwoord (minimaal 24 tekens) voor /beheer/.
 *   SITE_URL         Text    https://elektroklik.nl
 *   ALLOWED_ORIGINS  Text    https://elektroklik.nl,https://www.elektroklik.nl
 * Binding (Worker → Settings → Bindings → KV namespace):
 *   Variabelenaam DB, gekoppeld aan een KV-namespace (bijv. "elektroklik-data").
 *
 * Er staan geen geheimen in deze code. Pas deze code niet aan, tenzij u weet wat u doet.
 */

const MOLLIE_API = 'https://api.mollie.com/v2';
const REF_PATROON = /^EK-\d{6}-[A-Z0-9]{5}$/;
const TOKEN_PATROON = /^[0-9a-f-]{36}$/;
const DAG = 24 * 60 * 60;
const BEWAAR_AANVRAAG = 183 * DAG;   // privacyverklaring: aanvragen zonder opdracht maximaal 6 maanden
const BEWAAR_OFFERTE = 400 * DAG;
const MAX_AANVRAAG_BYTES = 64 * 1024;
const MAX_AANVRAGEN_PER_UUR = 20;    // per IP-adres, tegen misbruik

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    let antwoord;
    try {
      controleerInstellingen(env);
      antwoord = await route(request, env, ctx);
    } catch (e) {
      const status = e.status || 500;
      if (status === 500) console.error(e && e.stack || e);
      antwoord = json({ fout: status === 500 ? 'Er ging iets mis op de server. Probeer het later opnieuw.' : e.message }, status);
    }
    for (const [k, v] of Object.entries(cors)) antwoord.headers.set(k, v);
    return antwoord;
  }
};

/* ------------------------------------------------------------------ routes */
async function route(request, env, ctx) {
  const url = new URL(request.url);
  const pad = url.pathname.replace(/\/+$/, '') || '/';
  const m = request.method;

  if (m === 'GET' && pad === '/') return json({ ok: true, dienst: 'ElektroKlik', mollie: env.MOLLIE_API_KEY.startsWith('live_') ? 'live' : 'test' });

  // Openbaar: aanvraag uit de configurator opslaan
  if (m === 'POST' && pad === '/aanvraag') { vereisOrigin(request, env); return aanvraagOpslaan(request, env); }

  // Openbaar: offerte bekijken en betalen
  let r = pad.match(/^\/offerte\/([0-9a-f-]{36})$/);
  if (m === 'GET' && r) return offerteBekijken(r[1], env);
  if (m === 'POST' && pad === '/betalen') { vereisOrigin(request, env); return betalingStarten(request, env, url); }

  // Mollie meldt statuswijzigingen hier (geen Origin, wordt altijd bij Mollie gecontroleerd)
  if (m === 'POST' && pad === '/mollie/webhook') return mollieWebhook(request, env);

  // Beheer (alleen met ADMIN_KEY)
  if (pad.startsWith('/admin/')) {
    vereisBeheer(request, env);
    if (m === 'GET' && pad === '/admin/check') return json({ ok: true });
    if (m === 'POST' && pad === '/admin/offerte') return offerteAanmaken(request, env);
    if (m === 'GET' && pad === '/admin/aanvragen') return json({ aanvragen: await alles(env, 'aanvraag:') });
    if (m === 'GET' && pad === '/admin/offertes') return json({ offertes: await alles(env, 'offerte:') });
    r = pad.match(/^\/admin\/aanvraag\/(EK-\d{6}-[A-Z0-9]{5})$/);
    if (m === 'DELETE' && r) { await env.DB.delete('aanvraag:' + r[1]); return json({ ok: true }); }
    r = pad.match(/^\/admin\/offerte\/([0-9a-f-]{36})$/);
    if (m === 'DELETE' && r) { await intrekken(r[1], env); return json({ ok: true }); }
  }
  throw fout(404, 'Niet gevonden.');
}

/* --------------------------------------------------------------- aanvragen */
async function aanvraagOpslaan(request, env) {
  const tekst = await request.text();
  if (tekst.length > MAX_AANVRAAG_BYTES) throw fout(413, 'Aanvraag te groot.');
  await beperk(request, env);
  let d;
  try { d = JSON.parse(tekst); } catch (e) { throw fout(400, 'Ongeldige aanvraag.'); }
  if (!d || !REF_PATROON.test(String(d.ref || ''))) throw fout(400, 'Ongeldig aanvraagnummer.');
  if (d._gotcha) return json({ ok: true }); // spam: stil negeren
  const sleutel = 'aanvraag:' + d.ref;
  const bestaand = await env.DB.get(sleutel);
  if (!bestaand) {
    const opslaan = {
      ref: d.ref,
      ontvangen: new Date().toISOString(),
      route: kort(d.route, 20),
      totaal: Number(d.totaal) || 0,
      versie: kort(d.versie, 40),
      staat: d.staat && typeof d.staat === 'object' ? d.staat : {},
      regels: Array.isArray(d.regels) ? d.regels.slice(0, 30) : [],
      intern: Array.isArray(d.intern) ? d.intern.slice(0, 20).map(x => kort(x, 300)) : [],
      klant: {
        naam: kort(d.klant && d.klant.naam, 120), email: kort(d.klant && d.klant.email, 160),
        telefoon: kort(d.klant && d.klant.telefoon, 40), adres: kort(d.klant && d.klant.adres, 250)
      },
      opmerkingen: kort(d.opmerkingen, 2000),
      fotos: kort(d.fotos, 300),
      verzendstatus: kort(d.verzendstatus, 40)
    };
    await env.DB.put(sleutel, JSON.stringify(opslaan), { expirationTtl: BEWAAR_AANVRAAG });
  }
  return json({ ok: true });
}

/* ---------------------------------------------------------------- offertes */
async function offerteAanmaken(request, env) {
  const d = await request.json().catch(() => null);
  if (!d) throw fout(400, 'Ongeldige gegevens.');
  if (!REF_PATROON.test(String(d.ref || ''))) throw fout(400, 'Ongeldig aanvraagnummer.');
  const bedrag = Math.round(Number(d.bedrag) * 100) / 100;
  if (!(bedrag >= 1 && bedrag <= 50000)) throw fout(400, 'Het bedrag moet tussen € 1 en € 50.000 liggen.');
  const dagen = Math.min(Math.max(parseInt(d.geldigDagen, 10) || 30, 1), 180);
  const token = crypto.randomUUID();
  const o = {
    token, ref: d.ref,
    bedrag, omschrijving: kort(d.omschrijving || ('Laadpaal inclusief installatie – ' + d.ref), 200),
    soort: d.soort === 'aanbetaling' ? 'aanbetaling' : 'volledig',
    naam: kort(d.naam, 120), email: kort(d.email, 160),
    aangemaakt: new Date().toISOString(),
    geldigTot: new Date(Date.now() + dagen * DAG * 1000).toISOString(),
    status: 'open', betalingen: []
  };
  await env.DB.put('offerte:' + token, JSON.stringify(o), { expirationTtl: BEWAAR_OFFERTE });
  return json({ token, betaalUrl: siteUrl(env) + '/laadpalen/betalen/?t=' + token, offerte: o });
}

async function offerteBekijken(token, env) {
  const o = await laadOfferte(token, env);
  const verlopen = o.status !== 'betaald' && new Date(o.geldigTot) < new Date();
  // Alleen wat de klant nodig heeft; geen e-mailadres of adres teruggeven
  return json({
    ref: o.ref, naam: voornaam(o.naam), omschrijving: o.omschrijving, bedrag: o.bedrag, soort: o.soort,
    status: o.status === 'ingetrokken' ? 'ingetrokken' : (verlopen ? 'verlopen' : o.status), geldigTot: o.geldigTot
  });
}

async function intrekken(token, env) {
  const o = await laadOfferte(token, env);
  if (o.status === 'betaald') throw fout(409, 'Een betaalde offerte kan niet worden ingetrokken.');
  o.status = 'ingetrokken';
  await env.DB.put('offerte:' + token, JSON.stringify(o), { expirationTtl: BEWAAR_OFFERTE });
}

/* ---------------------------------------------------------------- betalen */
async function betalingStarten(request, env, url) {
  const d = await request.json().catch(() => null);
  if (!d || !TOKEN_PATROON.test(String(d.token || ''))) throw fout(400, 'Ongeldige betaallink.');
  if (d.akkoord !== true) throw fout(400, 'Geef eerst akkoord op de offerte.');
  const o = await laadOfferte(d.token, env);
  if (o.status === 'betaald') throw fout(409, 'Deze offerte is al betaald. Dank u wel!');
  if (o.status === 'ingetrokken') throw fout(410, 'Deze betaallink is niet meer geldig. Neem contact met ons op.');
  if (new Date(o.geldigTot) < new Date()) throw fout(410, 'Deze betaallink is verlopen. Neem contact met ons op voor een nieuwe link.');

  // Het bedrag komt altijd uit de opgeslagen offerte, nooit uit de browser van de klant.
  const betaling = await mollie(env, 'POST', '/payments', {
    amount: { currency: 'EUR', value: o.bedrag.toFixed(2) },
    description: (o.omschrijving + ' (' + o.ref + ')').slice(0, 255),
    redirectUrl: siteUrl(env) + '/laadpalen/betalen/?t=' + o.token + '&terug=1',
    webhookUrl: url.origin + '/mollie/webhook',
    metadata: { token: o.token, ref: o.ref },
    locale: 'nl_NL'
  });
  o.status = 'gestart';
  o.akkoordOp = new Date().toISOString();
  o.betalingen = (o.betalingen || []).concat([{ id: betaling.id, status: betaling.status, aangemaakt: new Date().toISOString() }]).slice(-10);
  await env.DB.put('offerte:' + o.token, JSON.stringify(o), { expirationTtl: BEWAAR_OFFERTE });
  return json({ checkoutUrl: betaling._links.checkout.href });
}

async function mollieWebhook(request, env) {
  const form = await request.formData().catch(() => null);
  const id = form && String(form.get('id') || '');
  if (!/^tr_[A-Za-z0-9]+$/.test(id)) return new Response('ok');
  const b = await mollie(env, 'GET', '/payments/' + id);          // status altijd bij Mollie zelf opvragen
  const token = b.metadata && b.metadata.token;
  if (!token || !TOKEN_PATROON.test(token)) return new Response('ok');
  const ruw = await env.DB.get('offerte:' + token);
  if (!ruw) return new Response('ok');
  const o = JSON.parse(ruw);
  const regel = (o.betalingen || []).find(x => x.id === id);
  if (regel) regel.status = b.status; else (o.betalingen = o.betalingen || []).push({ id, status: b.status });
  if (b.status === 'paid') {
    const betaald = Math.round(Number(b.amount && b.amount.value) * 100) / 100;
    if (betaald === o.bedrag) { o.status = 'betaald'; o.betaaldOp = b.paidAt || new Date().toISOString(); o.molliePaymentId = id; }
    else { o.status = 'controleren'; o.opmerking = 'Betaald bedrag (' + betaald + ') wijkt af van de offerte.'; }
  } else if (o.status !== 'betaald' && ['canceled', 'expired', 'failed'].includes(b.status)) {
    o.status = 'open';
  } else if (o.status !== 'betaald' && ['open', 'pending', 'authorized'].includes(b.status)) {
    o.status = 'gestart';
  }
  await env.DB.put('offerte:' + token, JSON.stringify(o), { expirationTtl: BEWAAR_OFFERTE });
  return new Response('ok');
}

/* ----------------------------------------------------------------- helpers */
async function mollie(env, methode, pad, body) {
  const res = await fetch(MOLLIE_API + pad, {
    method: methode,
    headers: { Authorization: 'Bearer ' + env.MOLLIE_API_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('Mollie-fout', res.status, JSON.stringify(data));
    throw fout(502, 'De betaling kon niet worden gestart. Probeer het later opnieuw of neem contact met ons op.');
  }
  return data;
}

async function laadOfferte(token, env) {
  if (!TOKEN_PATROON.test(token)) throw fout(404, 'Deze betaallink bestaat niet.');
  const ruw = await env.DB.get('offerte:' + token);
  if (!ruw) throw fout(404, 'Deze betaallink bestaat niet (meer). Neem contact met ons op.');
  return JSON.parse(ruw);
}

async function alles(env, prefix) {
  const uit = [];
  let cursor;
  do {
    const l = await env.DB.list({ prefix, cursor });
    const waarden = await Promise.all(l.keys.map(k => env.DB.get(k.name)));
    waarden.forEach(w => { if (w) uit.push(JSON.parse(w)); });
    cursor = l.list_complete ? null : l.cursor;
  } while (cursor);
  return uit;
}

async function beperk(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'onbekend';
  const sleutel = 'rl:' + ip + ':' + Math.floor(Date.now() / 3600000);
  const n = parseInt(await env.DB.get(sleutel), 10) || 0;
  if (n >= MAX_AANVRAGEN_PER_UUR) throw fout(429, 'Te veel aanvragen. Probeer het later opnieuw.');
  await env.DB.put(sleutel, String(n + 1), { expirationTtl: 3600 });
}

function vereisBeheer(request, env) {
  const h = request.headers.get('Authorization') || '';
  const sleutel = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!gelijk(sleutel, env.ADMIN_KEY)) throw fout(401, 'Geen toegang. Controleer de beheersleutel.');
}

function vereisOrigin(request, env) {
  const toegestaan = origins(env);
  if (!toegestaan.length) return;
  const o = request.headers.get('Origin') || '';
  if (!toegestaan.includes(o)) throw fout(403, 'Niet toegestaan.');
}

function corsHeaders(origin, env) {
  const toegestaan = origins(env);
  const ok = origin && (toegestaan.includes(origin) || !toegestaan.length);
  return ok ? {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  } : { 'Vary': 'Origin' };
}

function origins(env) { return String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean); }
function siteUrl(env) { return String(env.SITE_URL || 'https://elektroklik.nl').replace(/\/+$/, ''); }

function controleerInstellingen(env) {
  const mist = [];
  if (!env.DB) mist.push('KV-binding DB');
  if (!env.MOLLIE_API_KEY) mist.push('MOLLIE_API_KEY');
  if (!env.ADMIN_KEY || String(env.ADMIN_KEY).length < 24) mist.push('ADMIN_KEY (minimaal 24 tekens)');
  if (mist.length) throw fout(503, 'De Worker is nog niet volledig ingesteld. Ontbreekt: ' + mist.join(', ') + '.');
}

function gelijk(a, b) {
  a = String(a || ''); b = String(b || '');
  let v = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) v |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return v === 0 && a.length > 0;
}
function kort(s, n) { return s == null ? '' : String(s).slice(0, n); }
function voornaam(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }
function fout(status, bericht) { const e = new Error(bericht); e.status = status; return e; }
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
