/* Economic calendar: try Investing.com (Saudi Arabic) first, fall back to Fair Economy.
 * Investing.com has no public API and blocks datacenter IPs (403) — including
 * headless-browser attempts from serverless IPs (verified 2026-11-10). A
 * residential proxy (PROXY_SERVER / PROXY_USERNAME / PROXY_PASSWORD env vars)
 * lets the headless attempt pass Cloudflare IP checks. A scraping API key
 * (SCRAPING_API_KEY, provider in SCRAPING_API: zenrows|scraperapi) is an
 * alternative that fetches the page through the provider's own proxies.
 * Without either, the Fair Economy fallback serves the calendar.
 * Response shape is unchanged: { updated_at, fetched_at, source, events }.
 */
const INVESTING_URL = 'https://sa.investing.com/economic-calendar';
const FAIRECONOMY_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function stripTags(s) {
  return String(s || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

const MONTHS = {
  'يناير': 1, 'فبراير': 2, 'مارس': 3, 'أبريل': 4, 'مايو': 5, 'يونيو': 6,
  'يوليو': 7, 'أغسطس': 8, 'سبتمبر': 9, 'أكتوبر': 10, 'نوفمبر': 11, 'ديسمبر': 12,
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7,
  august: 8, september: 9, october: 10, november: 11, december: 12,
};

function parseDayHeader(text) {
  // Arabic: "الثلاثاء، 10 نوفمبر 2026" | English: "Tuesday, November 10, 2026"
  let m = text.match(/(\d{1,2})\s+([^\s\d,]+)\s+(\d{4})/);
  if (m && MONTHS[m[2].toLowerCase()]) {
    return { y: m[3], mo: MONTHS[m[2].toLowerCase()], d: m[1] };
  }
  m = text.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (m && MONTHS[m[1].toLowerCase()]) {
    return { y: m[3], mo: MONTHS[m[1].toLowerCase()], d: m[2] };
  }
  return null;
}

function parseInvesting(html) {
  const events = [];
  let current = null; // { y, mo, d } of the current day header
  const pad = (n) => String(n).padStart(2, '0');
  const rows = String(html).split(/(?=<tr[^>]*>)/i);
  for (const row of rows) {
    const isDayRow = /class=["'][^"']*\btheDay\b/i.test(row) || /colspan/i.test(row);
    if (isDayRow && !/js-event-item/i.test(row)) {
      const parsed = parseDayHeader(stripTags(row));
      if (parsed) current = parsed;
      continue;
    }
    if (!/js-event-item/i.test(row) || !current) continue;
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((x) => x[1]);
    if (cells.length < 7) continue;
    const time = stripTags(cells[0]);
    const currency = (stripTags(cells[1]).match(/[A-Z]{3}/) || [''])[0];
    const bulls = (cells[2].match(/bullishIcon/gi) || []).length;
    const impact = bulls >= 3 ? 'High' : bulls === 2 ? 'Medium' : 'Low';
    const title = stripTags(cells[3]);
    if (!title) continue;
    const tm = time.match(/(\d{1,2}):(\d{2})/);
    const date = tm
      ? `${current.y}-${pad(current.mo)}-${pad(current.d)}T${pad(tm[1])}:${tm[2]}:00+03:00`
      : `${current.y}-${pad(current.mo)}-${pad(current.d)}T00:00:00+03:00`;
    events.push({
      title: title.slice(0, 500),
      country: currency,
      date,
      impact,
      forecast: stripTags(cells[5]).slice(0, 500),
      previous: stripTags(cells[6]).slice(0, 500),
      actual: stripTags(cells[4]).slice(0, 500),
    });
    if (events.length >= 2000) break;
  }
  return events;
}

async function fetchInvesting() {
  const response = await fetch(INVESTING_URL, {
    headers: {
      'User-Agent': BROWSER_UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ar-SA,ar;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return null;
  const html = await response.text();
  if (!html || html.length < 1000) return null;
  const events = parseInvesting(html);
  return events.length ? events : null;
}



// Scraping-API attempt: fetches the page through the provider's proxy/anti-bot
// stack and returns raw HTML. Env-gated (SCRAPING_API_KEY); failures are
// negatively cached per instance so a bad key does not slow every request.
let lastScrapingFail = 0;
let lastScrapingDebug = { attempted: false, status: null, ms: null };
async function fetchInvestingViaScrapingApi() {
  const key = process.env.SCRAPING_API_KEY;
  if (!key) return null;
  const started = Date.now();
  lastScrapingDebug = { attempted: true, status: null, ms: null };
  const provider = String(process.env.SCRAPING_API || 'zenrows').toLowerCase();
  const target = encodeURIComponent(INVESTING_URL);
  const url = provider === 'scraperapi'
    ? `https://api.scraperapi.com/?api_key=${encodeURIComponent(key)}&url=${target}&render=true`
    : `https://api.zenrows.com/v1/?apikey=${encodeURIComponent(key)}&url=${target}&js_render=true&antibot=true&premium_proxy=true`;
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  lastScrapingDebug.status = response.status;
  lastScrapingDebug.ms = Date.now() - started;
  if (!response.ok) return null;
  const html = await response.text();
  lastScrapingDebug.htmlLen = html ? html.length : 0;
  lastScrapingDebug.hasRows = Boolean(html && html.includes('js-event-item'));
  lastScrapingDebug.challenge = Boolean(html && /just a moment|attention required|cf-challenge|checking your browser/i.test(html));
  lastScrapingDebug.tableCount = html ? (html.match(/<table/gi) || []).length : 0;
  lastScrapingDebug.trCount = html ? (html.match(/<tr[\s>]/gi) || []).length : 0;
  lastScrapingDebug.hasNextData = Boolean(html && html.includes('__NEXT_DATA__'));
  lastScrapingDebug.hasCalData = Boolean(html && html.includes('economicCalendarData'));
  const ti = html ? html.search(/<table/i) : -1;
  lastScrapingDebug.tableSnippet = ti >= 0 ? html.slice(ti, ti + 600).replace(/\s+/g, ' ') : '';
  const tb = html ? html.search(/<tbody/i) : -1;
  lastScrapingDebug.tbodySnippet = tb >= 0 ? html.slice(tb, tb + 3000).replace(/\s+/g, ' ') : '';
  const er = html ? html.search(/<tr[^>]*\sid="[^"]+"/i) : -1;
  lastScrapingDebug.rowSnippet = er >= 0 ? html.slice(er, er + 7000).replace(/\s+/g, ' ') : '';
  lastScrapingDebug.snippet = html ? html.replace(/\s+/g, ' ').slice(0, 300) : '';
  if (!html || html.length < 1000) return null;
  const events = parseInvesting(html);
  return events.length ? events : null;
}

// Headless-browser attempt through an optional residential proxy.
// Cloudflare blocks datacenter IPs even with a real Chromium (verified
// 2026-11-10); a residential proxy restores trust. Only runs when
// PROXY_SERVER is configured. Failures are negatively cached per instance.
let lastHeadlessFail = 0;
async function fetchInvestingHeadless() {
  let browser;
  try {
    const { chromium: playwright } = require('playwright-core');
    const chromium = require('@sparticuz/chromium');
    const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH || await chromium.executablePath();
    const proxy = {
      server: process.env.PROXY_SERVER,
      username: process.env.PROXY_USERNAME || undefined,
      password: process.env.PROXY_PASSWORD || undefined,
    };
    browser = await playwright.launch({ args: chromium.args, executablePath, proxy });
    const page = await browser.newPage({
      locale: 'ar-SA',
      userAgent: BROWSER_UA,
      viewport: { width: 1280, height: 900 },
      extraHTTPHeaders: { 'Accept-Language': 'ar-SA,ar;q=0.9,en;q=0.8' },
    });
    await page.goto(INVESTING_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('.js-event-item', { timeout: 8000 }).catch(() => {});
    const html = await page.content();
    if (!html || html.length < 1000) return null;
    const events = parseInvesting(html);
    return events.length ? events : null;
  } catch (_) {
    return null;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

async function fetchFairEconomy(res) {
  const response = await fetch(FAIRECONOMY_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 VALID-VX-calendar/1.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 429) {
    const retry = response.headers.get('retry-after');
    if (retry) res.setHeader('Retry-After', retry);
    return { status: 429, body: { error: 'source_rate_limited' } };
  }
  if (!response.ok) return { status: 502, body: { error: 'source_unavailable' } };
  const raw = await response.json();
  if (!Array.isArray(raw) || !raw.length || raw.length > 10000) return { status: 502, body: { error: 'invalid_source' } };
  const events = raw
    .filter((e) => e && e.title && e.date && e.country && e.impact)
    .map((e) => Object.fromEntries(['title', 'country', 'date', 'impact', 'forecast', 'previous', 'actual'].map((k) => [k, String(e[k] ?? '').slice(0, 500)])));
  if (!events.length) return { status: 502, body: { error: 'invalid_source' } };
  const modified = response.headers.get('last-modified');
  const time = modified && Number.isFinite(Date.parse(modified)) ? new Date(modified).toISOString() : null;
  return { status: 200, body: { updated_at: time, fetched_at: new Date().toISOString(), source: 'Fair Economy / Forex Factory', events } };
}

function debugInfo() {
  return {
    hasScrapingKey: Boolean(process.env.SCRAPING_API_KEY),
    scrapingProvider: String(process.env.SCRAPING_API || 'zenrows'),
    hasProxy: Boolean(process.env.PROXY_SERVER),
    scraping: lastScrapingDebug,
    scrapingCooldownMs: Math.max(0, 5 * 60 * 1000 - (Date.now() - lastScrapingFail)),
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'method_not_allowed' }); }

  // Primary source: Investing.com Saudi Arabic calendar.
  try {
    let events = await fetchInvesting();
    if (!events && process.env.SCRAPING_API_KEY && Date.now() - lastScrapingFail > 5 * 60 * 1000) {
      events = await fetchInvestingViaScrapingApi().catch(() => null);
      if (!events) lastScrapingFail = Date.now();
    }
    if (!events && process.env.PROXY_SERVER && Date.now() - lastHeadlessFail > 5 * 60 * 1000) {
      events = await fetchInvestingHeadless();
      if (!events) lastHeadlessFail = Date.now();
    }
    if (events) {
      // Cache successful responses at Vercel's CDN to reduce duplicate upstream calls.
      res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=120');
      const body = { updated_at: new Date().toISOString(), fetched_at: new Date().toISOString(), source: 'Investing.com (السعودية)', events };
      if (req.query && req.query.debug === '1') body.debug = debugInfo();
      return res.status(200).json(body);
    }
  } catch (_) { /* fall through to the fallback source */ }

  // Fallback source: Fair Economy / Forex Factory.
  try {
    const result = await fetchFairEconomy(res);
    if (result.status === 200) res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=120');
    if (req.query && req.query.debug === '1') result.body.debug = debugInfo();
    return res.status(result.status).json(result.body);
  } catch (_) { return res.status(502).json({ error: 'source_unavailable' }); }
};
