const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('C:/Users/Nick/AppData/Local/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright');
const AxeBuilder = require('C:/Users/Nick/AppData/Local/Temp/olympus-audit-tools/node_modules/@axe-core/playwright').default;
const root = path.resolve(__dirname, '../../olympus-web');
const types = { '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml' };
(async () => {
  const server = http.createServer((req, res) => {
    try {
      const file = path.join(root, decodeURIComponent(req.url.split('?')[0]));
      res.setHeader('Content-Type', types[path.extname(file)] || 'text/html');
      res.end(fs.readFileSync(file));
    } catch { res.statusCode = 404; res.end('Not found'); }
  }).listen(0);
  try {
    const browser = await chromium.launch();
    try {
      for (const width of [1440, 390]) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('https://**/*', route => route.abort());
        await page.goto(`http://localhost:${server.address().port}/app.html`);
        await page.locator('[data-workspace-demo] [data-add-agent]').click();
        await page.locator('[data-pick-project="studio-site"]').click();
        if (await page.locator('[data-agent-grid] article').count() !== 3) throw Error('Add agent failed');
        await page.locator('[data-send="2"] input').fill('Keep my unsent draft');
        await page.locator('[data-send="1"] input').fill('Review the navigation');
        await page.locator('[data-send="1"] button[type="submit"]').click();
        if (!await page.locator('[data-agent-grid] article').first().getByText('Review the navigation').count()) throw Error('Send failed');
        if (await page.locator('[data-send="2"] input').inputValue() !== 'Keep my unsent draft') throw Error('Sending to one agent erased another draft');
        await page.locator('[data-folder="2"]').click();
        if (!await page.locator('dialog.workspace-picker').evaluate(node => node.open)) throw Error('Folder dialog did not open');
        await page.locator('[data-picker-search]').fill('weekend');
        if (await page.locator('[data-pick-project]').count() !== 1) throw Error('Project search failed');
        const dialogViolations = (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) }));
        if (dialogViolations.length) throw Error(`Folder dialog accessibility: ${JSON.stringify(dialogViolations)}`);
        await page.screenshot({ path: path.join(__dirname, `screenshots/workspace-picker-${width}.png`) });
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('dialog.workspace-picker').open);
        if (!await page.locator('[data-folder="2"]').evaluate(node => document.activeElement === node)) throw Error('Dialog did not restore focus');
        await page.locator('[data-folder="2"]').click();
        await page.locator('[data-pick-project="weekend-project"]').click();
        if (!await page.locator('[data-agent-grid] article').nth(1).getByText('Now working in weekend-project.').count()) throw Error('Folder change failed');
        await page.locator('[data-folder="1"]').click();
        await page.locator('[data-picker-add]').click();
        await page.locator('[data-pick-project="example-project-4"]').click();
        if (!await page.locator('[data-folder="1"]').getByText('example-project-4').count()) throw Error('Add example folder failed');
        await page.locator('[data-close="3"]').click();
        if (await page.locator('[data-agent-grid] article').count() !== 2) throw Error('Close failed');
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
        const violations = (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(item => item.id);
        await page.screenshot({ path: path.join(__dirname, `screenshots/workspace-demo-${width}.png`), fullPage: true });
        if (overflow || errors.length || violations.length) throw Error(JSON.stringify({ width, overflow, errors, violations }));
        console.log(`Workspace demo ${width}px: add, send, change folder, close, layout, script errors, accessibility passed`);
        await context.close();
      }
    } finally { await browser.close(); }
  } finally { server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
