const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('C:/Users/Nick/AppData/Local/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright');
const AxeBuilder = require('C:/Users/Nick/AppData/Local/Temp/olympus-audit-tools/node_modules/@axe-core/playwright').default;
const root = path.resolve(__dirname, '../../olympus-web');
const out = path.join(__dirname, 'screenshots');
fs.mkdirSync(out, { recursive: true });
const types = { '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png' };
(async () => {
  const server = http.createServer((req, res) => {
    try {
      const f = path.join(root, decodeURIComponent(req.url.split('?')[0]));
      res.setHeader('Content-Type', types[path.extname(f)] || 'text/html');
      res.end(fs.readFileSync(f));
    } catch { res.statusCode = 404; res.end('Not found'); }
  }).listen(0);
  const browser = await chromium.launch();
  const base = `http://localhost:${server.address().port}`;
  const pages = fs.readdirSync(root).filter(f => f.endsWith('.html') && (!process.env.AUDIT_PAGES || process.env.AUDIT_PAGES.split(',').includes(f))); 
  const results = [];
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    // Offline typography baseline; external font availability is not asserted here.
    await page.route('https://**/*', r => r.abort());
    for (const file of pages) {
      const errors = [];
      const onError = e => errors.push(e.message);
      page.on('pageerror', onError);
      await page.goto(`${base}/${file}`);
      await page.evaluate(async () => {
        for (const img of document.images) { img.loading = 'eager'; }
        await Promise.all([...document.images].map(i => i.decode().catch(() => {})));
      });
      const layout = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        brokenImages: [...document.images].filter(i => !i.naturalWidth).map(i => i.getAttribute('src')),
        links: [...document.querySelectorAll('a[href]')].map(a => ({ href: a.getAttribute('href'), text: a.textContent.trim() })),
        tinyTargets: [...document.querySelectorAll('button,a')].filter(e => {
          const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 24;
        }).map(e => ({ text: (e.getAttribute('aria-label') || e.textContent).trim().slice(0, 70), height: Math.round(e.getBoundingClientRect().height) })),
      }));
      const links = layout.links.flatMap(link => {
        if (link.href.includes('{{')) return [{ ...link, problem: 'Unresolved configuration token' }];
        if (/^(https?:|mailto:|tel:)/.test(link.href)) return [];
        const [target, fragment] = link.href.split('#');
        const dest = path.resolve(root, target || file);
        if (!fs.existsSync(dest)) return [{ ...link, problem: 'Missing local target' }];
        if (fragment && !fs.readFileSync(dest, 'utf8').includes(`id="${fragment}"`)) return [{ ...link, problem: 'Missing fragment' }];
        return [];
      });
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      await page.screenshot({ path: path.join(out, `${file.replace('.html', '')}-${width}.png`), fullPage: true });
      results.push({ file, width, ...layout, links: undefined, linkIssues: links, errors, accessibility: axe.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })) });
      page.off('pageerror', onError);
      console.log(file, width, 'overflow:', layout.overflow, 'broken images:', layout.brokenImages.length, 'axe:', axe.violations.map(v => v.id).join(','));
    }
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await page.route('https://**/*', r => r.abort());
  await page.goto(`${base}/index.html`);
  const functions = {};
  await page.locator('[data-nav-toggle]').click();
  functions.mobileMenuOpens = await page.locator('[data-nav-toggle]').getAttribute('aria-expanded') === 'true';
  await page.keyboard.press('Escape');
  functions.mobileMenuEscape = await page.locator('[data-nav-toggle]').getAttribute('aria-expanded') === 'false';
  await page.locator('#tab-code').click();
  functions.codeTab = await page.locator('#view-code').isVisible() && !await page.locator('#view-agent').isVisible();
  await page.locator('#tab-code').focus();
  await page.keyboard.press('ArrowRight');
  functions.tabKeyboard = await page.locator('#tab-thread').getAttribute('aria-selected') === 'true';
  await page.locator('.faq__item summary').first().click();
  functions.faq = await page.locator('.faq__item').first().getAttribute('open') !== null;
  await page.locator('.discovery-button').click();
  functions.discovery = await page.locator('.discovery-card').isVisible();
  await page.keyboard.press('Escape');
  functions.discoveryEscape = !await page.locator('.discovery-card').isVisible();
  fs.writeFileSync(path.join(__dirname, process.env.AUDIT_PAGES ? 'website-final-results.json' : 'website-results.json'), JSON.stringify({ results, functions }, null, 2));
  console.log('Interactions', functions);
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
