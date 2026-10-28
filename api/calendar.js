/* Fetch an on-demand calendar snapshot from the existing source. */
const URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'method_not_allowed' }); }
  try {
    const response = await fetch(URL, { headers: { 'User-Agent': 'Mozilla/5.0 VALID-VX-calendar/1.0', Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
    if (response.status === 429) { const retry = response.headers.get('retry-after'); if (retry) res.setHeader('Retry-After', retry); return res.status(429).json({error:'source_rate_limited'}); }
    if (!response.ok) return res.status(502).json({ error: 'source_unavailable' });
    const raw = await response.json();
    if (!Array.isArray(raw) || !raw.length || raw.length > 10000) return res.status(502).json({ error: 'invalid_source' });
    const events = raw.filter(e => e && e.title && e.date && e.country && e.impact).map(e => Object.fromEntries(['title','country','date','impact','forecast','previous','actual'].map(k => [k, String(e[k] ?? '').slice(0, 500)])));
    if (!events.length) return res.status(502).json({ error: 'invalid_source' });
    const modified = response.headers.get('last-modified');
    const time = modified && Number.isFinite(Date.parse(modified)) ? new Date(modified).toISOString() : null;
    // Cache successful responses at Vercel's CDN to reduce duplicate upstream calls.
    // The original fetched_at remains unchanged when served from cache.
    res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=120');
    return res.status(200).json({ updated_at: time, fetched_at: new Date().toISOString(), source: 'Fair Economy / Forex Factory', events });
  } catch (_) { return res.status(502).json({ error: 'source_unavailable' }); }
};
