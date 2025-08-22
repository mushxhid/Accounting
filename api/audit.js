// Vercel Serverless Function for sending audit emails via SMTP
// Uses environment variables: SMTP_USER, SMTP_PASS, SMTP_HOST
// CORS enabled for POST from browser

const nodemailer = require('nodemailer');

function allowCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
}

async function sendMailSmart(mailOpts) {
  const SMTP_USER = process.env.SMTP_USER;
  const SMTP_PASS = process.env.SMTP_PASS;
  const SMTP_HOST = process.env.SMTP_HOST || 'smtp.hostinger.com';

  if (!SMTP_USER || !SMTP_PASS) {
    throw new Error('Missing SMTP credentials');
  }

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
    const t2 = nodemailer.createTransport({
      host: SMTP_HOST,
      port: 587,
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      tls: { rejectUnauthorized: false },
    });
    await t2.verify();
    return await t2.sendMail(mailOpts);
  }
}

module.exports = async (req, res) => {
  allowCors(res);
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    return;
  }

  try {
    const { action, entity, details, actor, recipients, timestamp } = req.body || {};
    const SMTP_USER = process.env.SMTP_USER;
    if (!SMTP_USER) throw new Error('Missing SMTP_USER');

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

    await sendMailSmart(mail);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
};


