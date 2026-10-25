const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INBOX = 'lumiviavx@gmail.com';
const SENDER = 'VALID VX <support@validvx.com>';

function text(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const contentLength = Number(req.headers['content-length'] || 0);
  if (contentLength > 12_000) {
    return res.status(413).json({ error: 'Request is too large.' });
  }

  const body = typeof req.body === 'string' ? (() => {
    try { return JSON.parse(req.body); } catch { return null; }
  })() : req.body;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  // Quietly accept bot submissions caught by the hidden honeypot.
  if (text(body.website, 200)) {
    return res.status(200).json({ ok: true });
  }

  const fullName = text(body.fullName, 100);
  const email = text(body.email, 254).toLowerCase();
  const phone = text(body.phone, 40);
  const message = text(body.message, 5000);

  if (
    fullName.length < 2 ||
    !EMAIL_PATTERN.test(email) ||
    phone.replace(/\D/g, '').length < 7 ||
    message.length < 5
  ) {
    return res.status(400).json({ error: 'Please provide valid contact details and a message.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'Email service is not configured.' });
  }

  let emailResponse;
  try {
    emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: SENDER,
        to: [INBOX],
        reply_to: email,
        subject: `Website contact: ${fullName}`,
        text: [
          `Name: ${fullName}`,
          `Email: ${email}`,
          `Phone: ${phone}`,
          '',
          'Message:',
          message
        ].join('\n')
      })
    });
  } catch {
    console.error('Could not connect to Resend email API.');
    return res.status(502).json({ error: 'Email could not be sent.' });
  }

  if (!emailResponse.ok) {
    console.error('Resend email request failed with status:', emailResponse.status);
    return res.status(502).json({ error: 'Email could not be sent.' });
  }

  return res.status(200).json({ ok: true });
};