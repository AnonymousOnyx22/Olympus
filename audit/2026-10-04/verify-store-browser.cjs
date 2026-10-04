const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('C:/Users/Nick/AppData/Local/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright');
(async () => {
  delete process.env.STRIPE_SECRET_KEY;
  const root = 'C:/Users/Nick/Downloads/Stores/build-a-small-online-murqxud7/';
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'wander-browser-'));
  const { PATHS } = await import(pathToFileURL(root+'src/paths.js'));
  PATHS.data = scratch; PATHS.orders = path.join(scratch,'orders.json');
  const { createApp } = await import(pathToFileURL(root+'server.js'));
  const server = createApp().listen(0,'127.0.0.1');
  await new Promise(resolve => server.once('listening',resolve));
  const base = 'http://127.0.0.1:'+server.address().port;
  const browser = await chromium.launch();
  const results = [];
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    for(const width of [1440,390]) {
      await page.setViewportSize({width,height:1000});
      for(const route of ['/','/collection','/product/tokyo','/faq']) {
        await page.goto(base+route);
        await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(async img=>{img.loading='eager'; await img.decode();})));
        assert.equal(await page.locator('img').evaluateAll(imgs=>imgs.filter(img=>!img.naturalWidth).length),0);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), `overflow ${width} ${route}`);
      }
      await page.goto(base+'/');
      await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(async img=>{img.loading='eager';await img.decode();})));
      await page.screenshot({path:path.join(__dirname,`store-finished-${width}.png`),fullPage:true});
      results.push(`PASS ${width}px: home, collection, product and FAQ; no horizontal overflow or broken images.`);
    }
    await page.goto(base+'/product/tokyo');
    await page.locator('form[action="/api/cart/add"] button[type="submit"]').first().click();
    await page.goto(base+'/checkout');
    await page.locator('#checkout-submit').click();
    assert.equal(await page.locator('#f-email').getAttribute('aria-invalid'),'true');
    const values={email:'browser@example.invalid',name:'Test Shopper',address:'123 Test Street',city:'Brooklyn',state:'NY',postcode:'11201',country:'US',cardName:'Test Shopper'};
    for(const [name,value] of Object.entries(values)) await page.locator(`[name="${name}"]`).fill(value);
    await page.locator('[data-fill-card="4000000000000002"]').click();
    await Promise.all([page.waitForURL('**/api/checkout'),page.locator('#checkout-submit').click()]);
    assert.equal(await page.locator('#f-cardNumber').getAttribute('aria-invalid'),'true');
    assert.ok(await page.locator('a[href="#f-cardNumber"]').count());
    await page.locator('[data-fill-card="4242424242424242"]').click();
    await Promise.all([page.waitForURL('**/order/confirmed?**'),page.locator('#checkout-submit').click()]);
    results.push('PASS browser checkout: required-field validation, decline attached to card field, successful retry and confirmation.');
    await page.screenshot({path:path.join(__dirname,'store-checkout-confirmed.png'),fullPage:true});
    await page.route('**/assets/mug-tokyo.png',route=>route.abort());
    await page.goto(base+'/product/tokyo');
    await page.locator('.art--missing .art__ph').first().waitFor({state:'visible'});
    results.push('PASS broken-image fallback remains visible and accessible.');
    assert.deepEqual(errors,[]);
    results.push('PASS no browser JavaScript errors.');
    console.log(results.join('\n'));
    await fs.writeFile(path.join(__dirname,'store-browser-verification.txt'),results.join('\n'));
  } finally {
    await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
    await fs.rm(scratch,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
