const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('C:/Users/Nick/AppData/Local/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright');
const root=path.resolve(__dirname,'../../olympus-web');
const csp=fs.readFileSync(path.join(root,'netlify.toml'),'utf8').match(/Content-Security-Policy = "(.*)"/)[1];
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg'};
(async()=>{
 const server=http.createServer((req,res)=>{let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(name==='/')name='/index.html';if(!path.extname(name))name+='.html';const file=path.join(root,name);res.writeHead(fs.existsSync(file)?200:404,{'Content-Type':types[path.extname(file)]||'text/plain','Content-Security-Policy':csp});res.end(fs.existsSync(file)?fs.readFileSync(file):'Not found');}).listen(0,'127.0.0.1');
 await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch();const results=[];fs.mkdirSync(path.join(__dirname,'screenshots'),{recursive:true});
 try {
 if(process.argv.includes('--interactions')){
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});const checks=[];const assert=require('node:assert/strict');
 const check=async(name,fn)=>{try{await fn();checks.push({name,passed:true})}catch(e){checks.push({name,passed:false,error:e.message})}};
 await check('mobile menu and Escape',async()=>{await page.goto(base+'/features.html');await page.locator('[data-nav-toggle]').click();assert.equal(await page.locator('[data-nav-toggle]').getAttribute('aria-expanded'),'true');await page.keyboard.press('Escape');assert.equal(await page.locator('[data-nav-toggle]').getAttribute('aria-expanded'),'false')});
 await check('FAQ search empty results and recovery',async()=>{await page.goto(base+'/faq.html');await page.locator('[data-faq-search]').fill('zzzz-no-match');assert(await page.locator('[data-faq-empty]').isVisible());await page.locator('[data-faq-search]').fill('models');assert(await page.locator('.faq__item:visible').count()>0);await page.locator('[data-faq-search]').fill('');await page.locator('.faq__item summary').first().click();assert(await page.locator('.faq__item').first().evaluate(n=>n.open))});
 await check('waitlist local feedback',async()=>{await page.goto(base+'/waitlist.html');await page.locator('#waitlist-email').fill('audit@invalid.test');await page.locator('[name=consent]').check();await page.locator('.waitlist-form button[type=submit]').click();assert.match(await page.locator('.form-status').innerText(),/local preview/)});
 await check('homepage project preview and keyboard tabs',async()=>{await page.goto(base);await page.locator('#tab-agent').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#tab-code').getAttribute('aria-selected'),'true');await page.locator('[data-project="notes-app"]').click();const notes=page.frameLocator('iframe[data-app="notes-app"]');await notes.locator('#title').fill('Audit example');await notes.locator('#body').fill('Temporary browser-only note');await notes.getByRole('button',{name:'Save note'}).click();assert(await notes.getByRole('heading',{name:'Audit example',exact:true}).count()>0)});
 fs.writeFileSync(path.join(__dirname,'interactions.json'),JSON.stringify(checks,null,2));console.log(JSON.stringify(checks,null,2));return;
 }
 for(const width of [1440,390,320]){
 const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
 let errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const file of fs.readdirSync(root).filter(f=>f.endsWith('.html'))){errors=[];await page.goto(`${base}/${file}`);await page.evaluate(async()=>{await Promise.all([...document.images].map(async i=>{i.loading='eager';try{await i.decode()}catch{}}))});await page.waitForTimeout(120);
 const state=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,images:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.getAttribute('src')),links:[...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')),headings:[...document.querySelectorAll('h1,h2')].map(a=>a.textContent.trim()),smallText:[...document.querySelectorAll('main p,main button,main label')].filter(e=>parseFloat(getComputedStyle(e).fontSize)<12).length}));
 results.push({file,width,...state,errors:[...errors]});if(width!==320)await page.screenshot({path:path.join(__dirname,'screenshots',`${file.replace('.html','')}-${width}.png`),fullPage:true});}
 await page.close();}
 const broken=[];for(const item of results.filter(r=>r.width===1440)){for(const href of item.links){if(!href||/^(https?:|mailto:|tel:)/.test(href)||href.includes('{{'))continue;const url=new URL(href,`${base}/${item.file}`);let f=path.join(root,decodeURIComponent(url.pathname));if(url.pathname==='/')f=path.join(root,'index.html');if(!path.extname(f))f+='.html';if(!fs.existsSync(f))broken.push({page:item.file,href});else if(url.hash&&!fs.readFileSync(f,'utf8').includes(`id="${decodeURIComponent(url.hash.slice(1))}"`))broken.push({page:item.file,href,reason:'missing fragment'});}}
 fs.writeFileSync(path.join(__dirname,'website-results.json'),JSON.stringify({results,broken},null,2));console.log(JSON.stringify({pages:results.length,issues:results.filter(r=>r.overflow||r.images.length||r.errors.length),broken},null,2));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
