/* Experimental on-demand quote snapshot. TradingView prohibits automated data collection. */
const { chromium: playwright } = require('playwright-core');
const chromium = require('@sparticuz/chromium');

const groups = {
  forex: ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF'],
  commodities: ['XAUUSD', 'XAGUSD', 'USOIL', 'BCOUSD'],
  indices: ['SPXUSD', 'US30', 'NSXUSD']
};
const all = [...groups.forex, ...groups.commodities, ...groups.indices];
// Best effort per-instance guard only; distributed rate limiting must be configured separately.
let busy = false;
let lastStart = 0;

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const category = req.query && req.query.category;
  if (!['forex', 'commodities', 'indices', 'all'].includes(category)) {
    return res.status(400).json({ error: 'invalid_category' });
  }
  // Deployment URL is provided by Vercel, never the visitor's Host header or an input URL.
  const siteURL = process.env.QUOTE_SITE_URL || (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}/`);
  if (!siteURL) return res.status(503).json({ error: 'site_url_not_configured' });
  if (busy || Date.now() - lastStart < 5000) return res.status(429).json({ error: 'try_later' });
  busy = true;
  lastStart = Date.now();
  let browser;
  try {
    const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH || await chromium.executablePath();
    browser = await playwright.launch({ args: chromium.args, executablePath });
    const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
    await page.goto(siteURL, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.locator('#vx-share-prices').click({ timeout: 8000 });
    await page.selectOption('#vx-capture-category', category, { timeout: 8000 });
    const symbols = category === 'all' ? all : groups[category];
    const frame = page.frameLocator('#vx-capture-widget iframe');
    await frame.getByText(symbols[0], { exact: true }).waitFor({ timeout: 15000 });
    // The iframe loads prices asynchronously. Values may still be absent or delayed.
    await page.waitForTimeout(9000);
    const body = await frame.locator('body').innerText();
    const lines = body.split('\n').map(x => x.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\u00a0]/g, '').trim());
    const quotes = symbols.map(symbol => {
      const index = lines.indexOf(symbol);
      const price = index >= 0 ? lines[index + 2] : '';
      return { symbol, price: /^[0-9][0-9,.]*$/.test(price) ? price : null };
    });
    if (!quotes.some(x => x.price)) return res.status(502).json({ error: 'quotes_unavailable' });
    return res.status(200).json({
      quotes,
      capturedAt: new Date().toISOString(),
      source: 'TradingView widget',
      notice: 'Collection time only; quote timestamps are unavailable and prices may be delayed.'
    });
  } catch (err) {
    console.error('Quote request failed:', String(err && err.message || err).slice(0, 250));
    return res.status(502).json({ error: 'quotes_unavailable' });
  } finally {
    if (browser) await browser.close().catch(() => {});
    busy = false;
  }
};
