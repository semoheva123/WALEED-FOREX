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
// Official widget endpoint (Arabic, GMT+3, full week in one page) — the
// scraping API fetches this so the calendar covers the whole week.
const WIDGET_WEEK_URL = 'https://sslecal2.investing.com?columns=exc_flags,exc_currency,exc_importance,exc_actual,exc_forecast,exc_previous&features=datepicker,timezone&calType=week&timeZone=18&lang=3';
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

// Country code (as shown on sa.investing.com) -> currency code used by the site filters.
const CCY_MAP = { US: 'USD', JP: 'JPY', GB: 'GBP', UK: 'GBP', EU: 'EUR', FR: 'EUR', DE: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR', BE: 'EUR', AT: 'EUR', IE: 'EUR', PT: 'EUR', FI: 'EUR', GR: 'EUR', SK: 'EUR', SI: 'EUR', EE: 'EUR', LV: 'EUR', LT: 'EUR', CY: 'EUR', MT: 'EUR', HR: 'EUR', LU: 'EUR', CA: 'CAD', AU: 'AUD', CH: 'CHF', NZ: 'NZD', CN: 'CNY', TR: 'TRY', KW: 'KWD', SA: 'SAR', AE: 'AED', QA: 'QAR', BH: 'BHD', OM: 'OMR', EG: 'EGP', JO: 'JOD', LB: 'LBP', IL: 'ILS', IN: 'INR', KR: 'KRW', SG: 'SGD', HK: 'HKD', BR: 'BRL', MX: 'MXN', ZA: 'ZAR', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', CZ: 'CZK', HU: 'HUF', RU: 'RUB', ID: 'IDR', TH: 'THB', MY: 'MYR', PH: 'PHP', TW: 'TWD' };

function parseInvesting(html) {
  const events = parseInvestingV2(html);
  return events.length ? events : parseInvestingLegacy(html);
}

// Current sa.investing.com markup (datatable-v2): date rows use colspan,
// event rows carry an id, importance is shown as filled stars, and the
// currency cell shows the country code (flag-XX).
function parseInvestingV2(html) {
  const events = [];
  let current = null;
  const pad = (n) => String(n).padStart(2, '0');
  const tbStart = String(html).search(/<tbody[^>]*datatable-v2_body/i);
  const scope = tbStart >= 0 ? String(html).slice(tbStart, String(html).indexOf('</tbody>', tbStart) + 8) : String(html);
  const rows = scope.split(/(?=<tr[^>]*>)/i);
  for (const row of rows) {
    if (!/datatable-v2_row/i.test(row)) continue;
    if (/colspan\s*=\s*["']?\d+/i.test(row)) {
      const parsed = parseDayHeader(stripTags(row));
      if (parsed) current = parsed;
      continue;
    }
    if (!current) continue;
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((x) => x[1]);
    if (cells.length < 8) continue;
    const time = stripTags(cells[1]);
    const flag = ((row.match(/data-test="flag-([A-Za-z]+)"/) || [])[1] || '').toUpperCase();
    const country = CCY_MAP[flag] || flag;
    const filled = (cells[4].match(/icon-star-filled opacity-60/g) || []).length;
    const impact = filled >= 3 ? 'High' : filled === 2 ? 'Medium' : 'Low';
    const eventPart = cells[3].split(/visible flex/)[0];
    const anchor = eventPart.match(/<a[^>]*>([\s\S]*?)<\/a>/i);
    const title = stripTags(anchor ? anchor[1] : eventPart);
    if (!title) continue;
    const tm = time.match(/(\d{1,2}):(\d{2})/);
    const date = tm
      ? `${current.y}-${pad(current.mo)}-${pad(current.d)}T${pad(tm[1])}:${tm[2]}:00+03:00`
      : `${current.y}-${pad(current.mo)}-${pad(current.d)}T00:00:00+03:00`;
    events.push({
      title: title.slice(0, 500),
      country,
      date,
      impact,
      forecast: stripTags(cells[6]).slice(0, 500),
      previous: stripTags(cells[7]).slice(0, 500),
      actual: stripTags(cells[5]).slice(0, 500),
    });
    if (events.length >= 2000) break;
  }
  return events;
}

// Legacy markup (js-event-item) kept as a fallback for older cached pages.
function parseInvestingLegacy(html) {
  const events = [];
  let current = null;
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
let lastAttempts = [];
async function fetchInvestingViaScrapingApi(targetUrl) {
  const key = process.env.SCRAPING_API_KEY;
  if (!key) return null;
  const provider = String(process.env.SCRAPING_API || 'zenrows').toLowerCase();
  const target = encodeURIComponent(targetUrl || INVESTING_URL);
  const url = provider === 'scraperapi'
    ? `https://api.scraperapi.com/?api_key=${encodeURIComponent(key)}&url=${target}&render=true`
    : `https://api.zenrows.com/v1/?apikey=${encodeURIComponent(key)}&url=${target}&js_render=true&antibot=true&premium_proxy=true`;
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const html = response.ok ? await response.text() : '';
  const v2 = html ? parseInvestingV2(html) : [];
  const legacy = html ? parseInvestingLegacy(html) : [];
  const ti = html ? html.search(/<table/i) : -1;
  const tb = html ? html.search(/<tbody/i) : -1;
  lastAttempts.push({
    target: targetUrl && targetUrl.includes('sslecal2') ? 'widget-week' : 'main-page',
    status: response.status,
    htmlLen: html ? html.length : 0,
    hasJsEventItem: Boolean(html && html.includes('js-event-item')),
    hasDatatableV2: Boolean(html && html.includes('datatable-v2_row')),
    v2Count: v2.length,
    legacyCount: legacy.length,
    tableSnippet: ti >= 0 ? html.slice(ti, ti + 500).replace(/\s+/g, ' ') : '',
    tbodySnippet: tb >= 0 ? html.slice(tb, tb + 2500).replace(/\s+/g, ' ') : '',
    timeSnippet: (() => { const i = html ? html.indexOf('وقت') : -1; return i >= 0 ? html.slice(i, i + 3500).replace(/\s+/g, ' ') : ''; })(),
    tailSnippet: html ? html.slice(-2500).replace(/\s+/g, ' ') : '',
  });
  const events = v2.length ? v2 : legacy;
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

module.exports = async function handler(req, res) {
  lastAttempts = [];
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'method_not_allowed' }); }

  // Primary source: Investing.com Saudi Arabic calendar.
  try {
    let events = await fetchInvesting();
    const forceAttempt = Boolean(req.query && req.query.debug === '1');
    if (!events && process.env.SCRAPING_API_KEY && (forceAttempt || Date.now() - lastScrapingFail > 5 * 60 * 1000)) {
      events = await fetchInvestingViaScrapingApi(WIDGET_WEEK_URL).catch(() => null);
      if (!events) events = await fetchInvestingViaScrapingApi(INVESTING_URL).catch(() => null);
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
      if (req.query && req.query.debug === '1') body.debug = { attempts: lastAttempts, cooldownMs: Math.max(0, 5 * 60 * 1000 - (Date.now() - lastScrapingFail)) };
      return res.status(200).json(body);
    }
  } catch (_) { /* fall through to the fallback source */ }

  // Fallback source: Fair Economy / Forex Factory.
  try {
    const result = await fetchFairEconomy(res);
    if (result.status === 200) res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=120');
    if (req.query && req.query.debug === '1') result.body.debug = { attempts: lastAttempts, cooldownMs: Math.max(0, 5 * 60 * 1000 - (Date.now() - lastScrapingFail)) };
    return res.status(result.status).json(result.body);
  } catch (_) { return res.status(502).json({ error: 'source_unavailable' }); }
};
