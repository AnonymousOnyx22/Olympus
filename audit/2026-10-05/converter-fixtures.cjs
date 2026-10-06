const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('C:/Users/Nick/AppData/Local/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright');
const dir = path.join(__dirname, 'converter-fixtures');
(async () => {
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const files = await page.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = 400;
      const c = canvas.getContext('2d'); c.fillStyle = '#ff0000'; c.fillRect(0, 0, 400, 200);
      c.fillStyle = '#00ff00'; c.fillRect(400, 0, 400, 200); c.fillStyle = '#0000ff'; c.fillRect(0, 200, 400, 200);
      const result = { 'transparent.png': canvas.toDataURL('image/png'), 'transparent.webp': canvas.toDataURL('image/webp', 1) };
      c.fillStyle = '#ffffff'; c.fillRect(400, 200, 400, 200); result['landscape.jpg'] = canvas.toDataURL('image/jpeg', 0.95);
      canvas.width = 1000; canvas.height = 1000;
      const data = c.createImageData(1000, 1000); let seed = 12345;
      for (let i = 0; i < data.data.length; i += 4) { for (let j = 0; j < 3; j++) { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; data.data[i+j] = seed >>> 24; } data.data[i+3] = 255; }
      c.putImageData(data, 0, 0); result['large-noise.png'] = canvas.toDataURL('image/png'); result['large-noise.jpg'] = canvas.toDataURL('image/jpeg', 0.95);
      return result;
    });
    const manifest = [];
    for (const [name, url] of Object.entries(files)) { const bytes = Buffer.from(url.split(',')[1], 'base64'); fs.writeFileSync(path.join(dir, name), bytes); manifest.push({ name, bytes: bytes.length, source: 'Deterministic locally generated test image' }); }
    fs.writeFileSync(path.join(dir, 'invalid.png'), 'This is not an image.');
    const source = 'https://raw.githubusercontent.com/strukturag/libheif/master/examples/example.heic';
    const response = await fetch(source, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw Error(`HEIC fixture HTTP ${response.status}`);
    const heic = Buffer.from(await response.arrayBuffer());
    if (heic.length > 5000000) throw Error('Unexpectedly large HEIC fixture');
    fs.writeFileSync(path.join(dir, 'example.heic'), heic); manifest.push({ name: 'example.heic', bytes: heic.length, source, purpose: 'Local compatibility test only; not a production asset' });
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    console.log(JSON.stringify(manifest, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
