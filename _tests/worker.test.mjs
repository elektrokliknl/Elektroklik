// Run: node _tests/worker.test.mjs   (simuleert Cloudflare KV en de Mollie-API)
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const code = fs.readFileSync(path.join(dir, '../_cloudflare/elektroklik-worker.js'), 'utf8');
const worker = (await import('data:text/javascript,' + encodeURIComponent(code))).default;

class KV { constructor() { this.m = new Map(); }
  async get(k) { return this.m.has(k) ? this.m.get(k) : null; }
  async put(k, v) { this.m.set(k, v); }
  async delete(k) { this.m.delete(k); }
  async list({ prefix }) { return { keys: [...this.m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }; } }
const env = { DB: new KV(), MOLLIE_API_KEY: 'test_xxx', ADMIN_KEY: 'een-heel-lang-geheim-wachtwoord-123', SITE_URL: 'https://elektroklik.nl', ALLOWED_ORIGINS: 'https://elektroklik.nl' };

// Nep-Mollie
const mollieBetalingen = {};
const echteFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  if (!String(url).startsWith('https://api.mollie.com/v2')) return echteFetch(url, opts);
  assert.strictEqual(opts.headers.Authorization, 'Bearer test_xxx');
  if (opts.method === 'POST') {
    const b = JSON.parse(opts.body); const id = 'tr_test' + Object.keys(mollieBetalingen).length;
    mollieBetalingen[id] = { id, status: 'open', amount: b.amount, metadata: b.metadata, _links: { checkout: { href: 'https://www.mollie.com/checkout/' + id } }, _req: b };
    return new Response(JSON.stringify(mollieBetalingen[id]), { status: 201 });
  }
  const id = String(url).split('/').pop();
  return new Response(JSON.stringify(mollieBetalingen[id]), { status: 200 });
};

const W = 'https://elektroklik.worker.test';
const call = (pad, { method = 'GET', body, origin = 'https://elektroklik.nl', admin, form } = {}) => {
  const headers = { Origin: origin };
  if (admin) headers.Authorization = 'Bearer ' + admin;
  let b = body ? JSON.stringify(body) : undefined;
  if (form) { b = new URLSearchParams(form); headers['Content-Type'] = 'application/x-www-form-urlencoded'; }
  return worker.fetch(new Request(W + pad, { method, headers, body: b }), env, {});
};
let n = 0; const t = async (naam, fn) => { await fn(); n++; console.log('✓', naam); };

await t('health + instellingen', async () => {
  const r = await call('/'); assert.strictEqual(r.status, 200); assert.strictEqual((await r.json()).mollie, 'test');
  const kapot = await worker.fetch(new Request(W + '/'), { ...env, ADMIN_KEY: 'kort' }, {});
  assert.strictEqual(kapot.status, 503);
});
await t('CORS alleen voor eigen domein', async () => {
  const r = await call('/', { method: 'OPTIONS' }); assert.strictEqual(r.headers.get('Access-Control-Allow-Origin'), 'https://elektroklik.nl');
  const x = await call('/', { method: 'OPTIONS', origin: 'https://evil.example' }); assert.strictEqual(x.headers.get('Access-Control-Allow-Origin'), null);
});
const aanvraag = { ref: 'EK-261115-ABCDE', route: 'standaard', totaal: 1740, staat: { product: 'easee-max' }, regels: [{ label: 'x', bedrag: 1740 }], intern: ['test'], klant: { naam: 'Jan Test', email: 'jan@test.nl', telefoon: '0612345678', adres: 'Weg 1' } };
await t('aanvraag opslaan, idempotent, met validatie', async () => {
  assert.strictEqual((await call('/aanvraag', { method: 'POST', body: aanvraag })).status, 200);
  assert.strictEqual((await call('/aanvraag', { method: 'POST', body: { ...aanvraag, totaal: 1 } })).status, 200);
  assert.strictEqual(JSON.parse(env.DB.m.get('aanvraag:EK-261115-ABCDE')).totaal, 1740, 'mag niet overschreven worden');
  assert.strictEqual((await call('/aanvraag', { method: 'POST', body: { ref: 'fout' } })).status, 400);
  assert.strictEqual((await call('/aanvraag', { method: 'POST', body: aanvraag, origin: 'https://evil.example' })).status, 403);
});
await t('beheer vereist sleutel', async () => {
  assert.strictEqual((await call('/admin/aanvragen')).status, 401);
  assert.strictEqual((await call('/admin/aanvragen', { admin: 'fout' })).status, 401);
  const r = await call('/admin/aanvragen', { admin: env.ADMIN_KEY }); assert.strictEqual((await r.json()).aanvragen.length, 1);
});
let token;
await t('offerte aanmaken (alleen beheer) en bekijken zonder persoonsgegevens', async () => {
  assert.strictEqual((await call('/admin/offerte', { method: 'POST', body: { ref: aanvraag.ref, bedrag: 1740 } })).status, 401);
  assert.strictEqual((await call('/admin/offerte', { method: 'POST', admin: env.ADMIN_KEY, body: { ref: aanvraag.ref, bedrag: -5 } })).status, 400);
  const r = await call('/admin/offerte', { method: 'POST', admin: env.ADMIN_KEY, body: { ref: aanvraag.ref, bedrag: 1740, naam: 'Jan Test', email: 'jan@test.nl' } });
  const d = await r.json(); token = d.token;
  assert.ok(d.betaalUrl.startsWith('https://elektroklik.nl/laadpalen/betalen/?t='));
  const o = await (await call('/offerte/' + token)).json();
  assert.strictEqual(o.bedrag, 1740); assert.strictEqual(o.naam, 'Jan'); assert.strictEqual(o.status, 'open'); assert.ok(!('email' in o));
});
await t('betalen: akkoord vereist, bedrag uit de offerte', async () => {
  assert.strictEqual((await call('/betalen', { method: 'POST', body: { token } })).status, 400);
  const r = await call('/betalen', { method: 'POST', body: { token, akkoord: true, bedrag: 1 } });
  const d = await r.json(); assert.ok(d.checkoutUrl.includes('mollie.com/checkout'));
  const req = Object.values(mollieBetalingen)[0]._req;
  assert.strictEqual(req.amount.value, '1740.00'); assert.ok(req.webhookUrl.endsWith('/mollie/webhook')); assert.ok(req.redirectUrl.includes(token));
});
await t('webhook: geannuleerd → opnieuw betalen mogelijk; betaald → status betaald', async () => {
  const id = Object.keys(mollieBetalingen)[0];
  mollieBetalingen[id].status = 'canceled';
  await call('/mollie/webhook', { method: 'POST', form: { id }, origin: '' });
  assert.strictEqual((await (await call('/offerte/' + token)).json()).status, 'open');
  const d = await (await call('/betalen', { method: 'POST', body: { token, akkoord: true } })).json();
  const id2 = d.checkoutUrl.split('/').pop();
  mollieBetalingen[id2].status = 'paid';
  await call('/mollie/webhook', { method: 'POST', form: { id: id2 }, origin: '' });
  assert.strictEqual((await (await call('/offerte/' + token)).json()).status, 'betaald');
  assert.strictEqual((await call('/betalen', { method: 'POST', body: { token, akkoord: true } })).status, 409);
  const lijst = await (await call('/admin/offertes', { admin: env.ADMIN_KEY })).json();
  assert.strictEqual(lijst.offertes[0].status, 'betaald'); assert.strictEqual(lijst.offertes[0].molliePaymentId, id2);
});
await t('afwijkend bedrag → controleren', async () => {
  const d = await (await call('/admin/offerte', { method: 'POST', admin: env.ADMIN_KEY, body: { ref: aanvraag.ref, bedrag: 500, soort: 'aanbetaling' } })).json();
  const c = await (await call('/betalen', { method: 'POST', body: { token: d.token, akkoord: true } })).json();
  const id = c.checkoutUrl.split('/').pop(); mollieBetalingen[id].status = 'paid'; mollieBetalingen[id].amount.value = '400.00';
  await call('/mollie/webhook', { method: 'POST', form: { id }, origin: '' });
  assert.strictEqual((await (await call('/offerte/' + d.token)).json()).status, 'controleren');
});
await t('intrekken, onbekende en ongeldige links', async () => {
  const d = await (await call('/admin/offerte', { method: 'POST', admin: env.ADMIN_KEY, body: { ref: aanvraag.ref, bedrag: 10 } })).json();
  await call('/admin/offerte/' + d.token, { method: 'DELETE', admin: env.ADMIN_KEY });
  assert.strictEqual((await call('/betalen', { method: 'POST', body: { token: d.token, akkoord: true } })).status, 410);
  assert.strictEqual((await call('/offerte/00000000-0000-0000-0000-000000000000')).status, 404);
  assert.strictEqual((await call('/onbekend')).status, 404);
  assert.strictEqual((await call('/mollie/webhook', { method: 'POST', form: { id: 'x' }, origin: '' })).status, 200);
});
await t('misbruikbeperking op aanvragen', async () => {
  let laatste;
  for (let i = 0; i < 25; i++) laatste = await call('/aanvraag', { method: 'POST', body: { ...aanvraag, ref: 'EK-261115-' + String(i).padStart(5, 'A') } });
  assert.strictEqual(laatste.status, 429);
});
console.log(`\n${n} worker-tests geslaagd`);
