const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('C:/Users/Nick/AppData/Local/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright');
const root = path.resolve(__dirname, '../../olympus-web');
const config = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
const headers = { 'Content-Security-Policy': config.match(/Content-Security-Policy = "(.*)"/)[1], 'X-Frame-Options': config.match(/X-Frame-Options = "(.*)"/)[1] };
const types = { '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
function response(url) {
  let relative = new URL(url, 'http://local').pathname;
  if (relative === '/') relative = '/index.html';
  if (!path.extname(relative)) relative += '.html';
  const file = path.join(root, relative);
  return { status: fs.existsSync(file) ? 200 : 404, headers: { ...headers, 'content-type': types[path.extname(file)] || 'text/html' }, body: fs.existsSync(file) ? fs.readFileSync(file) : 'Not found' };
}
(async () => {
  const results = [];
  const server = http.createServer((req, res) => { const out = response(req.url); res.writeHead(out.status, out.headers); res.end(out.body); }).listen(0);
  const browser = await chromium.launch();
  const base = `http://localhost:${server.address().port}`;
  const scenario = async (name, work, options = {}) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', ...options });
    const page = await context.newPage();
    page.setDefaultTimeout(7000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => route.abort());
    await page.addInitScript(() => { window.auditCsp = []; document.addEventListener('securitypolicyviolation', event => window.auditCsp.push(`${event.effectiveDirective}: ${event.blockedURI}`)); });
    try { await work(page, context); assert.deepEqual(errors, []); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, error: String(error), errors }); }
    finally { await context.close(); console.log(name, results.at(-1).passed ? 'PASS' : results.at(-1).error); }
  };
  try {
    await scenario('production headers and 320px/768px layout across all pages', async page => {
      const findings = [];
      for (const width of [320, 768]) {
        await page.setViewportSize({ width, height: 900 });
        for (const file of fs.readdirSync(root).filter(file => file.endsWith('.html'))) {
          await page.goto(`${base}/${file}`);
          const state = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, csp: window.auditCsp }));
          if (state.overflow || state.csp.length) findings.push({ file, width, ...state });
        }
      }
      assert.deepEqual(findings, []);
    });
    await scenario('FAQ filtering, no-result recovery and Enter without reload', async page => {
      await page.goto(`${base}/faq.html`);
      await page.locator('[data-faq-search]').fill('zzzz-no-match');
      assert(await page.locator('[data-faq-empty]').isVisible());
      await page.locator('[data-faq-search]').press('Enter');
      assert.equal(await page.locator('[data-faq-search]').inputValue(), 'zzzz-no-match');
      await page.locator('[data-faq-search]').fill('models');
      assert(await page.locator('.faq__item:visible').count() > 0);
      await page.locator('[data-faq-search]').fill('');
      assert.equal(await page.locator('.faq__item:visible').count(), await page.locator('.faq__item').count());
      await page.locator('.faq__item summary').first().click();
      assert(await page.locator('.faq__item').first().evaluate(node => node.open));
      assert.deepEqual(await page.evaluate(() => window.auditCsp), []);
    });
    await scenario('iframe previews work with CSP and X-Frame-Options', async page => {
      await page.goto(`${base}/index.html`);
      const studio = page.frameLocator('iframe[data-app="studio-site"]');
      await studio.getByRole('button', { name: 'Web', exact: true }).click();
      assert.equal(await studio.locator('#projects article').count(), 1);
      await studio.getByRole('button', { name: 'View case study' }).click();
      await studio.getByRole('button', { name: 'Back to work' }).click();
      await page.locator('[data-project="notes-app"]').click();
      const notes = page.frameLocator('iframe[data-app="notes-app"]');
      await notes.locator('#title').fill('Audit note');
      await notes.locator('#body').fill('Keep this when changing projects.');
      await notes.getByRole('button', { name: 'Save note' }).click();
      await page.locator('[data-project="weekend-project"]').click();
      const weekend = page.frameLocator('iframe[data-app="weekend-project"]');
      await weekend.getByRole('button', { name: 'Sunday', exact: true }).click();
      await weekend.locator('#activity').fill('Audit walk');
      await weekend.getByRole('button', { name: 'Add to the weekend' }).click();
      assert.equal(await weekend.getByRole('heading', { name: 'Audit walk', exact: true }).count(), 1);
      await page.locator('[data-project="notes-app"]').click();
      assert.equal(await notes.getByRole('heading', { name: 'Audit note', exact: true }).count(), 1);
      await page.locator('[data-file="app.js"]').click();
      await page.waitForFunction(() => document.querySelector('.code-editor').textContent.includes('localStorage'));
    });
    await scenario('workspace preserves unrelated drafts and reopens saved conversations', async page => {
      await page.goto(`${base}/app.html`);
      await page.locator('[data-send="1"] input').fill('Unsent draft');
      await page.locator('[data-send="2"] input').fill('A <script>literal</script> task');
      await page.locator('[data-send="2"] button[type=submit]').click();
      assert.equal(await page.locator('[data-send="1"] input').inputValue(), 'Unsent draft');
      assert.equal(await page.locator('[data-agent-grid] script').count(), 0);
      await page.locator('[data-folder="1"]').click();
      await page.locator('[data-pick-project="weekend-project"]').click();
      await page.locator('[data-reopen]').first().click();
      assert.equal(await page.locator('[data-send="3"] input').inputValue(), 'Unsent draft');
      await page.locator('[data-close="2"]').click();
      await page.locator('[data-reopen]').first().click();
      assert.equal(await page.locator('[data-agent-id="4"] .workspace-playground__message--you').innerText(), 'You\nA <script>literal</script> task');
    });
    await scenario('mobile navigation, Escape and tab navigation', async page => {
      await page.goto(`${base}/index.html`);
      await page.locator('[data-nav-toggle]').click();
      assert.equal(await page.locator('[data-nav-toggle]').getAttribute('aria-expanded'), 'true');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('[data-nav-toggle]').getAttribute('aria-expanded'), 'false');
      await page.locator('#tab-agent').focus();
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.locator('#tab-code').getAttribute('aria-selected'), 'true');
    }, { viewport: { width: 390, height: 844 } });
    await scenario('normal-motion navigation and back recovery', async page => {
      await page.goto(`${base}/index.html`);
      await page.locator('.hero__actions a[href="app.html"]').click();
      await page.waitForURL('**/app.html');
      await page.goBack();
      await page.waitForFunction(() => document.querySelector('.cloud-curtain').classList.contains('is-open'));
      assert.equal(await page.locator('[data-nav-toggle]').getAttribute('aria-expanded'), 'false');
    }, { reducedMotion: 'no-preference' });
    await scenario('waitlist local preview avoids submission', async page => {
      await page.goto(`${base}/waitlist.html`);
      await page.locator('#waitlist-email').fill('audit@invalid.test');
      await page.locator('[name=consent]').check();
      await page.locator('.waitlist-form button[type=submit]').click();
      assert.match(await page.locator('.form-status').innerText(), /local preview/);
    });
    await scenario('waitlist failure, retry, duplicate suppression and success using mocked transport', async page => {
      let posts = 0, pending;
      await page.route('http://audit.test/**', async route => {
        if (route.request().method() === 'POST') { posts++; pending = route; return; }
        await route.fulfill(response(route.request().url()));
      });
      await page.goto('http://audit.test/waitlist.html');
      await page.locator('#waitlist-email').fill('audit@invalid.test');
      await page.locator('[name=consent]').check();
      await page.locator('.waitlist-form button[type=submit]').click();
      await page.waitForFunction(() => document.querySelector('.waitlist-form').getAttribute('aria-busy') === 'true');
      await page.locator('.waitlist-form').dispatchEvent('submit');
      await page.waitForTimeout(80);
      assert.equal(posts, 1);
      await pending.fulfill({ status: 503, body: 'Unavailable' });
      await page.waitForFunction(() => !document.querySelector('.waitlist-form button[type=submit]').disabled);
      assert.equal(await page.locator('#waitlist-email').inputValue(), 'audit@invalid.test');
      await page.locator('.waitlist-form button[type=submit]').click();
      await page.waitForTimeout(80);
      assert.equal(posts, 2);
      await pending.fulfill({ status: 200, body: 'Saved' });
      await page.waitForURL('http://audit.test/thanks');
    });
    await scenario('workspace no-JavaScript fallback', async page => {
      await page.goto(`${base}/app.html`);
      assert(await page.locator('noscript p').isVisible());
      assert.equal(await page.locator('[data-add-agent]').isVisible(), false);
    }, { javaScriptEnabled: false });
    await scenario('invalid saved demo data recovers and long text wraps', async page => {
      await page.addInitScript(() => {
        localStorage.setItem('olympus-little-notes', '[null]');
        localStorage.setItem('olympus-weekend', '[{"title":"old schema"}]');
      });
      await page.goto(`${base}/assets/demo-projects/notes-app/index.html`);
      assert.equal(await page.locator('#notes article').count(), 3);
      await page.locator('#title').fill('A'.repeat(80));
      await page.locator('#body').fill('A long title should wrap.');
      await page.getByRole('button', { name: 'Save note' }).click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.goto(`${base}/assets/demo-projects/weekend-project/index.html`);
      assert.equal(await page.locator('#plans article').count(), 3);
    }, { viewport: { width: 320, height: 800 } });
    await scenario('waitlist stalled request times out and allows retry', async page => {
      await page.addInitScript(() => {
        const original = window.setTimeout;
        window.setTimeout = (handler, delay, ...args) => original(handler, delay === 15000 ? 100 : delay, ...args);
      });
      await page.route('http://audit.test/**', async route => {
        if (route.request().method() === 'POST') return;
        await route.fulfill(response(route.request().url()));
      });
      await page.goto('http://audit.test/waitlist.html');
      await page.locator('#waitlist-email').fill('audit@invalid.test');
      await page.locator('[name=consent]').check();
      await page.locator('.waitlist-form button[type=submit]').click();
      await page.waitForFunction(() => document.querySelector('.form-status').textContent.includes('could not be sent'));
      assert.equal(await page.locator('.waitlist-form button[type=submit]').isEnabled(), true);
    });
  } finally {
    fs.writeFileSync(path.join(__dirname, 'deep-website-results.json'), JSON.stringify(results, null, 2));
    await browser.close(); server.close();
  }
  if (results.some(result => !result.passed)) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
