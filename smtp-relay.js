// Simple local SMTP relay server to avoid CORS and keep SMTP credentials server-side
// Usage: node smtp-relay.js  (runs on http://localhost:4000)
const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');

const app = express();
app.use(bodyParser.json());

// Hostinger SMTP credentials
const SMTP_USER = process.env.SMTP_USER || 'accounting@ecomgliders.com';
const SMTP_PASS = process.env.SMTP_PASS || 'Ecomgliders.llc.22';
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.hostinger.com';

// Helper: try 465 (SSL), then fallback to 587 (STARTTLS)
async function sendMailSmart(mailOpts) {
  // First attempt: SSL 465
  try {
    const t1 = nodemailer.createTransport({
      host: SMTP_HOST,
      port: 465,
      secure: true,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    await t1.verify();
    return await t1.sendMail(mailOpts);
  } catch (e1) {
    console.error('SMTP 465 attempt failed:', e1?.message || e1);
    // Fallback: STARTTLS 587
    const t2 = nodemailer.createTransport({
      host: SMTP_HOST,
      port: 587,
      secure: false,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      tls: { rejectUnauthorized: false },
    });
    await t2.verify();
    return await t2.sendMail(mailOpts);
  }
}

app.post('/audit', async (req, res) => {
  try {
    const { action, entity, details, actor, recipients, timestamp } = req.body || {};
    const toList = (recipients && recipients.length)
      ? recipients.join(',')
      : 'mushahid@ecomgliders.com,rizwan@ecomgliders.com,mushahidyaseen56@gmail.com';

    const subject = `[Accounting Audit] ${(action || 'event').toUpperCase()} ${entity || ''}`.trim();
    const text = [
      `Action: ${action}`,
      `Entity: ${entity}`,
      `Actor: ${actor?.email || 'unknown'} (${actor?.uid || 'n/a'})`,
      `Time: ${timestamp || new Date().toISOString()}`,
      `Details: ${JSON.stringify(details || {}, null, 2)}`,
    ].join('\n');

    const mail = {
      from: SMTP_USER,
      to: toList,
      subject,
      text,
    };

    const info = await sendMailSmart(mail);

    res.json({ ok: true });
  } catch (e) {
    console.error('SMTP relay error', e);
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`SMTP relay listening on http://localhost:${PORT}`));


