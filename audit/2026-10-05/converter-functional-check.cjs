// Exercises generated tools locally without uploading fixtures to a public server.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('C:/Users/Nick/AppData/Local/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright');
const root = path.resolve(process.argv[2] || 'C:/Users/Nick/Downloads/Stores/build-me-a-muw576gx');
const fixtures = path.join(__dirname, 'converter-fixtures');
const cases = [
  ['convert-heic-to-jpg', 'example.heic', 'image/jpeg'],
  ['convert-webp-to-png', 'transparent.webp', 'image/png'],
  ['convert-png-to-jpg', 'transparent.png', 'image/jpeg'],
  ['compress-png-to-200kb', 'large-noise.png', 'image/png', 200000],
  ['compress-jpeg-to-50kb', 'large-noise.jpg', 'image/jpeg', 50000],
  ['resize-to-400x400', 'landscape.jpg', null, null, [400,400]],
];
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml' };
const server = http.createServer((req,res) => {
  let file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403).end(); return; }
  try {
    if (fs.statSync(file).isDirectory()) file = path.join(file,'index.html');
    res.setHeader('Content-Type',types[path.extname(file)] || 'application/octet-stream');
    res.end(fs.readFileSync(file));
  } catch { res.writeHead(404).end(); }
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({headless:true});
  const results = [];
  try {
    for (const [slug,fixture,mime,maxBytes,dimensions] of cases) {
      if (!fs.existsSync(path.join(root,'tools',slug,'index.html'))) continue;
      const result = {slug,fixture,errors:[],network:[],failures:[]};
      const page = await browser.newPage({userAgent:'OlympusAudit/1.0'});
      page.on('pageerror',e=>result.errors.push(e.message));
      page.on('dialog',async d=>{result.errors.push(d.message());await d.dismiss();});
      await page.route('**/*',async route=>{
        const req=route.request();
        if (!req.url().startsWith(origin) && /^https?:/.test(req.url())) {
          result.network.push({url:new URL(req.url()).origin,method:req.method()});
          if (!['GET','HEAD'].includes(req.method())) {await route.abort();return;}
        }
        await route.continue();
      });
      try {
        await page.goto(`${origin}/tools/${slug}/?audit=1`);
        await page.locator('input[type=file]').setInputFiles(path.join(fixtures,fixture));
        await page.waitForTimeout(700);
        const button = page.locator('#convertBtn, #compressBtn, #resizeBtn').first();
        if (await button.count()) await button.click({timeout:3000});
        const downloadButton = page.locator('#downloadBtn').first();
        await downloadButton.waitFor({state:'visible',timeout:5000});
        const [download] = await Promise.all([page.waitForEvent('download',{timeout:5000}),downloadButton.click()]);
        const file = await download.path();
        const data = fs.readFileSync(file);
        result.download = {name:download.suggestedFilename(),bytes:data.length};
        result.output = await page.evaluate(async base64=>{
          const data=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
          const detected = data[0]===255 && data[1]===216 ? 'image/jpeg' : data[0]===137 && data[1]===80 ? 'image/png' : 'other';
          const bitmap=await createImageBitmap(new Blob([data]));
          const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
          const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);
          return {mime:detected,width:bitmap.width,height:bitmap.height,corner:[...ctx.getImageData(bitmap.width-10,bitmap.height-10,1,1).data]};
        },data.toString('base64'));
        if(mime && result.output.mime!==mime) result.failures.push('Wrong actual output format');
        if(maxBytes && data.length>maxBytes) result.failures.push(`Exceeds advertised ${maxBytes} bytes`);
        if(dimensions && (result.output.width!==dimensions[0] || result.output.height!==dimensions[1])) result.failures.push('Wrong output dimensions');
      } catch(e) {result.failures.push(e.message.split('\n')[0]);}
      if(result.errors.length) result.failures.push('Browser errors or alerts');
      results.push(result); await page.close();
    }
  } finally {await browser.close();server.close();}
  const report={at:new Date().toISOString(),root,results};
  fs.writeFileSync(path.join(__dirname,'converter-functional-results.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e.message);server.close();process.exitCode=1;});
