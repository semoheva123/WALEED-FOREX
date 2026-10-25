const crypto = require('node:crypto');

const OWNER_INBOX = 'lumiviavx@gmail.com';
const SUPPORT_ADDRESS = 'support@validvx.com';
const SENDER = 'VALID VX <support@validvx.com>';
const MAX_BODY_BYTES = 1_000_000;
const MAX_CLOCK_SKEW_SECONDS = 5 * 60;

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function verifyResendWebhook(payload, headers, secret) {
  const messageId = headers['svix-id'];
  const timestamp = headers['svix-timestamp'];
  const signatures = headers['svix-signature'];
  if (!messageId || !timestamp || !signatures || !secret?.startsWith('whsec_')) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > MAX_CLOCK_SKEW_SECONDS) {
    return false;
  }

  let key;
  try {
    key = Buffer.from(secret.slice('whsec_'.length), 'base64');
  } catch {
    return false;
  }
  if (!key.length) return false;

  const signedContent = `${messageId}.${timestamp}.${payload}`;
  const expected = crypto.createHmac('sha256', key).update(signedContent).digest('base64');
  return signatures.split(' ').some(signature => {
    const [version, value] = signature.split(',', 2);
    if (version !== 'v1' || !value) return false;
    const actualBuffer = Buffer.from(value);
    const expectedBuffer = Buffer.from(expected);
    return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
  });
}

function extractEmailAddress(value) {
  if (typeof value !== 'string') return '';
  const match = value.match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+/i);
  return match ? match[0].toLowerCase() : '';
}

function htmlToText(html) {
  return String(html || '')
    .replace(/<(script|style|head|title)[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<\/(p|div|br|li|tr|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let payload;
  try {
    payload = await readRawBody(req);
  } catch {
    return res.status(413).json({ error: 'Request body too large or unreadable.' });
  }

  if (!verifyResendWebhook(payload, req.headers, process.env.RESEND_WEBHOOK_SECRET)) {
    return res.status(400).json({ error: 'Invalid webhook signature.' });
  }

  let event;
  try {
    event = JSON.parse(payload);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON payload.' });
  }

  if (event.type !== 'email.received') {
    return res.status(200).json({ received: true, ignored: true });
  }

  const emailId = event.data?.email_id;
  const apiKey = process.env.RESEND_API_KEY;
  if (!emailId || !apiKey) {
    console.error('Inbound email forwarding is missing required configuration.');
    return res.status(503).json({ error: 'Email forwarding is not configured.' });
  }

  try {
    const inboundResponse = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    if (!inboundResponse.ok) {
      console.error('Could not retrieve inbound email; Resend status:', inboundResponse.status);
      return res.status(502).json({ error: 'Could not retrieve the received email.' });
    }

    const inbound = await inboundResponse.json();
    const originalSender = extractEmailAddress(inbound.from || event.data.from);
    const recipients = Array.isArray(inbound.to) ? inbound.to : (Array.isArray(event.data.to) ? event.data.to : []);
    const isSupportMail = recipients.some(address => extractEmailAddress(address) === SUPPORT_ADDRESS);

    // Only forward messages addressed to the public support mailbox.
    if (!isSupportMail || !originalSender) {
      return res.status(200).json({ received: true, ignored: true });
    }

    const bodyText = textBody(inbound);
    const subject = typeof inbound.subject === 'string' && inbound.subject.trim()
      ? inbound.subject.trim().slice(0, 180)
      : '(no subject)';
    const attachmentsNote = Array.isArray(inbound.attachments) && inbound.attachments.length
      ? `\n\nAttachments (${inbound.attachments.length}) are available in the Resend dashboard.`
      : '';
    const forwardedText = [
      `From: ${inbound.from || originalSender}`,
      `To: ${SUPPORT_ADDRESS}`,
      `Subject: ${subject}`,
      '',
      bodyText || '(The message contained no readable plain-text body.)',
      attachmentsNote
    ].join('\n');

    const sendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `inbound-forward-${emailId}`
      },
      body: JSON.stringify({
        from: SENDER,
        to: [OWNER_INBOX],
        reply_to: originalSender,
        subject: `Support: ${subject}`,
        text: forwardedText.slice(0, 100_000)
      })
    });

    if (!sendResponse.ok) {
      console.error('Inbound forward failed; Resend status:', sendResponse.status);
      return res.status(502).json({ error: 'Could not forward the received email.' });
    }

    return res.status(200).json({ received: true, forwarded: true });
  } catch {
    console.error('Unexpected error while forwarding an inbound email.');
    return res.status(502).json({ error: 'Could not process the received email.' });
  }
};

function textBody(email) {
  const value = typeof email.text === 'string' && email.text.trim()
    ? email.text
    : htmlToText(email.html);
  return value.slice(0, 90_000);
}

module.exports.config = {
  api: { bodyParser: false }
};