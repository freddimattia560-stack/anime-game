// Server ARTX per SHARD OF SOULS — Stripe Checkout + codici firmati (senza webhook).
// Variabili d'ambiente: STRIPE_SECRET_KEY, SIGN_KEY (contenuto di chiave-privata.pem), BASE_URL (opzionale)
const express = require('express'), crypto = require('crypto');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const SIGN_KEY = (process.env.SIGN_KEY || '').replace(/\\n/g, '\n');
const PACKS = [
  { artx: 500,  cents: 499,  name: '500 ARTX' },
  { artx: 1500, cents: 1299, name: '1500 ARTX' },
  { artx: 4000, cents: 2999, name: '4000 ARTX' },
];
const app = express();
const b64 = b => Buffer.from(b).toString('base64url');
const base = req => process.env.BASE_URL || (req.protocol + '://' + req.get('host'));

// 1) Il gioco apre questa pagina: crea il pagamento e porta il giocatore su Stripe
app.get('/buy', async (req, res) => {
  const p = PACKS[+req.query.pack];
  if (!p) return res.status(400).send('Pacchetto non valido');
  try {
    const s = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: p.cents, product_data: { name: p.name + ' — Shard of Souls' } } }],
      metadata: { pack: String(req.query.pack) },
      success_url: base(req) + '/thanks?sid={CHECKOUT_SESSION_ID}',
      cancel_url: base(req) + '/annullato',
    });
    res.redirect(303, s.url);
  } catch (e) { res.status(500).send('Errore pagamento: ' + e.message); }
});

// 2) Dopo il pagamento: verifica con Stripe e mostra un codice firmato da incollare nel gioco
app.get('/thanks', async (req, res) => {
  try {
    const s = await stripe.checkout.sessions.retrieve(String(req.query.sid));
    if (s.payment_status !== 'paid') return res.status(402).send('Pagamento non completato.');
    const pack = PACKS[+s.metadata.pack];
    const payload = b64(JSON.stringify({ id: s.id, a: pack.artx }));
    const sig = crypto.sign('sha256', Buffer.from(payload), { key: SIGN_KEY, dsaEncoding: 'ieee-p1363' }).toString('base64url');
    const code = payload + '.' + sig;
    res.send(`<!doctype html><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><body style="font-family:sans-serif;background:#07101c;color:#fff;text-align:center;padding:30px"><h2>✦ Pagamento riuscito: ${pack.artx} ARTX</h2><p>Copia questo codice e incollalo nel gioco, in Negozio → “Riscatta”.</p><textarea id=c readonly style="width:90%;max-width:520px;height:120px;font-size:12px">${code}</textarea><br><br><button onclick="c.select();navigator.clipboard&&navigator.clipboard.writeText(c.value);this.textContent='Copiato!'" style="font-size:18px;padding:10px 20px">COPIA CODICE</button></body>`);
  } catch (e) { res.status(400).send('Sessione non valida.'); }
});
app.get('/annullato', (q, r) => r.send('Pagamento annullato. Puoi chiudere questa scheda.'));
app.get('/', (q, r) => r.send('ARTX server attivo'));
app.listen(process.env.PORT || 3000, () => console.log('ARTX server attivo'));
