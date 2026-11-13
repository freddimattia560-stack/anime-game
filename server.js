// Server ARTX per SHARD OF SOULS — Stripe Checkout + webhook.
// Avvio: npm install express stripe cors && STRIPE_SECRET_KEY=sk_... STRIPE_WEBHOOK_SECRET=whsec_... node server.js
const express = require('express'), cors = require('cors'), fs = require('fs');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const PACKS = [ // stessi pacchetti del gioco (indice = posizione in ARTX_PACKS)
  { artx: 500,  cents: 499,  name: '500 ARTX' },
  { artx: 1500, cents: 1299, name: '1500 ARTX' },
  { artx: 4000, cents: 2999, name: '4000 ARTX' },
];
const DB = './artx-db.json';
const load = () => { try { return JSON.parse(fs.readFileSync(DB)); } catch { return {}; } };
const save = d => fs.writeFileSync(DB, JSON.stringify(d));
const app = express();
app.use(cors());

// Webhook: Stripe conferma il pagamento (va PRIMA di express.json, serve il body grezzo)
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  let ev;
  try { ev = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET); }
  catch (e) { return res.status(400).send('firma non valida'); }
  if (ev.type === 'checkout.session.completed' && ev.data.object.payment_status === 'paid') {
    const s = ev.data.object, db = load();
    db.done = db.done || {};
    if (!db.done[s.id]) { // idempotente
      db.done[s.id] = 1;
      const pid = s.metadata.pid, pack = PACKS[+s.metadata.pack];
      if (pid && pack) { db.bal = db.bal || {}; db.bal[pid] = (db.bal[pid] || 0) + pack.artx; save(db); }
    }
  }
  res.json({ received: true });
});

app.use(express.json());
// Crea la sessione di pagamento
app.post('/checkout', async (req, res) => {
  const { pid, pack, ret } = req.body || {};
  const p = PACKS[pack];
  if (!pid || !p) return res.status(400).json({ error: 'richiesta non valida' });
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: p.cents, product_data: { name: p.name + ' — Shard of Souls' } } }],
    metadata: { pid, pack: String(pack) },
    success_url: ret || 'https://claude.ai', cancel_url: ret || 'https://claude.ai',
  });
  res.json({ url: session.url });
});
// Il gioco ritira gli ARTX pagati (una sola volta)
app.get('/claim', (req, res) => {
  const db = load(), pid = String(req.query.pid || '');
  const n = (db.bal && db.bal[pid]) || 0;
  if (n) { db.bal[pid] = 0; save(db); }
  res.json({ artx: n });
});
app.listen(process.env.PORT || 3000, () => console.log('ARTX server attivo'));
