// Independent read-only crawl. Explicit audit marker keeps our requests separable from visitors.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('C:/Users/Nick/AppData/Local/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright');
const base = new URL(process.argv[2]);
const out = process.argv[3] || path.join(__dirname, 'converter-search-results.json');
const fetchText = async url => {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'OlympusAudit/1.0 (+independent site verification)' } });
  return { status: response.status, url: response.url, headers: Object.fromEntries(response.headers), text: await response.text() };
};
(async () => {
  const result = { at: new Date().toISOString(), base: base.origin, pages: [], failures: [] };
  const robots = await fetchText(new URL('/robots.txt?audit=1', base));
  result.robots = { status: robots.status, text: robots.text.slice(0, 4000) };
  if (robots.status !== 200) result.failures.push('robots.txt unavailable');
  const sitemapUrl = robots.text.match(/^Sitemap:\s*(https?:\/\/\S+)/im)?.[1] || new URL('/sitemap.xml', base).href;
  const sitemap = await fetchText(sitemapUrl);
  const urls = [...sitemap.text.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)].map(m => m[1].replace(/&amp;/g, '&'));
  result.sitemap = { url: sitemapUrl, status: sitemap.status, urls };
  if (sitemap.status !== 200 || !urls.length) result.failures.push('Sitemap unavailable or empty');
  const targets = [...new Set([base.href, ...urls])].filter(u => { try { return new URL(u).origin === base.origin; } catch { return false; } }).slice(0, 35);
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 950 }, userAgent: 'Mozilla/5.0 OlympusAudit/1.0 Chrome/131.0.0.0 Safari/537.36' });
    for (const target of targets) {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      const auditUrl = new URL(target); auditUrl.searchParams.set('audit', '1');
      try {
        const response = await page.goto(auditUrl.href, { waitUntil: 'networkidle', timeout: 30000 });
        const data = await page.evaluate(() => ({
          title: document.title,
          description: document.querySelector('meta[name="description"]')?.content || '',
          canonical: document.querySelector('link[rel="canonical"]')?.href || '',
          robots: document.querySelector('meta[name="robots"]')?.content || '',
          h1: [...document.querySelectorAll('h1')].map(e => e.textContent.trim()),
          brokenImages: [...document.images].filter(i => !i.complete || !i.naturalWidth).map(i => i.getAttribute('src')),
          structuredData: [...document.querySelectorAll('script[type="application/ld+json"]')].map(e => { try { return JSON.parse(e.textContent); } catch { return { error: 'invalid JSON' }; } }),
          links: [...document.querySelectorAll('a[href]')].map(a => a.href),
          fileInputs: document.querySelectorAll('input[type="file"]').length,
          overflow: document.documentElement.scrollWidth > innerWidth,
        }));
        const record = { url: target, status: response?.status(), ...data, errors };
        result.pages.push(record);
        if (record.status !== 200) result.failures.push(`${target}: HTTP ${record.status}`);
        if (!data.title || !data.description || data.h1.length !== 1) result.failures.push(`${target}: missing title/description or not exactly one h1`);
        if (!data.canonical || new URL(data.canonical).origin !== base.origin) result.failures.push(`${target}: missing or foreign canonical`);
        if (/noindex/i.test(data.robots + ' ' + (response?.headers()['x-robots-tag'] || ''))) result.failures.push(`${target}: noindex`);
        if (data.brokenImages.length || errors.length || data.overflow) result.failures.push(`${target}: image, JS, or layout failure`);
      } catch (e) { result.failures.push(`${target}: ${e.message}`); }
      await page.close();
    }
    const titles = result.pages.map(p => p.title).filter(Boolean);
    if (new Set(titles).size !== titles.length) result.failures.push('Duplicate page titles');
  } finally { await browser.close(); }
  fs.writeFileSync(out, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ pages: result.pages.length, failures: result.failures, output: out }, null, 2));
  process.exitCode = result.failures.length ? 1 : 0;
})().catch(e => { console.error(e.message); process.exitCode = 1; });
