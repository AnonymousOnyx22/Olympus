const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('C:/Users/Nick/AppData/Local/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright');
const AxeBuilder = require('C:/Users/Nick/AppData/Local/Temp/olympus-audit-tools/node_modules/@axe-core/playwright').default;
const root = path.resolve(__dirname, '../../olympus-web');
const csp = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8').match(/Content-Security-Policy = "(.*)"/)[1];
const types = { '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png' };
const pages = fs.readdirSync(root).filter(name => name.endsWith('.html'));
(async () => {
  const server = http.createServer((req, res) => {
    try {
      const target = path.join(root, decodeURIComponent(req.url.split('?')[0]));
      res.setHeader('Content-Type', types[path.extname(target)] || 'text/html');
      res.setHeader('Content-Security-Policy', csp);
      res.end(fs.readFileSync(target));
    } catch { res.statusCode = 404; res.end('Not found'); }
  }).listen(0);
  try {
    const browser = await chromium.launch();
    const results = [];
    try {
      for (const width of [1440, 390]) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
        const page = await context.newPage();
        await page.route('https://**/*', route => route.abort());
        for (const file of pages) {
          const errors = [];
          page.on('pageerror', error => errors.push(error.message));
          await page.goto(`http://localhost:${server.address().port}/${file}`);
          await page.evaluate(async () => {
            for (const image of document.images) image.loading = 'eager';
            await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
          });
          const state = await page.evaluate(() => ({
            overflow: document.documentElement.scrollWidth > innerWidth,
            brokenImages: [...document.images].filter(image => !image.naturalWidth).map(image => image.getAttribute('src')),
            links: [...document.querySelectorAll('a[href]')].map(link => link.getAttribute('href')),
          }));
          const missingLinks = state.links.filter(link => !link.includes('{{') && !/^(https?:|mailto:|tel:)/.test(link)).filter(link => {
            const [target, fragment] = link.split('#');
            const destination = path.join(root, target || file);
            return !fs.existsSync(destination) || (fragment && !fs.readFileSync(destination, 'utf8').includes(`id="${fragment}"`));
          });
          const violations = (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) }));
          results.push({ file, width, overflow: state.overflow, brokenImages: state.brokenImages, missingLinks, errors, violations });
          page.removeAllListeners('pageerror');
        }
        await context.close();
      }
    } finally { await browser.close(); }
    fs.writeFileSync(path.join(__dirname, 'interaction-audit-results.json'), JSON.stringify(results, null, 2));
    const issues = results.filter(item => item.overflow || item.brokenImages.length || item.missingLinks.length || item.errors.length || item.violations.length);
    console.log(`Checked ${results.length} page/viewport combinations. ${issues.length} with detected issues.`);
    for (const item of issues) console.log(`${item.file} ${item.width}: ${JSON.stringify({ overflow: item.overflow, brokenImages: item.brokenImages, missingLinks: item.missingLinks, errors: item.errors, violations: item.violations })}`);
    if (issues.length) process.exitCode = 1;
  } finally { server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
