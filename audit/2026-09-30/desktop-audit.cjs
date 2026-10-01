const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { _electron } = require('C:/Users/Nick/AppData/Local/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright');
const root = path.resolve(__dirname, '../../lantern');
(async () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'olympus-desktop-audit-'));
  const launcher = path.join(scratch, 'launch.cjs');
  const electronModule = path.join(root, 'node_modules/electron/dist/electron.exe');
  fs.writeFileSync(launcher, `const {app,shell}=require('electron');app.setPath('userData',${JSON.stringify(scratch)});shell.openExternal=async()=>{};app.on('browser-window-created',(_e,w)=>{w.show=()=>{};});require(${JSON.stringify(path.join(root,'dist-electron/main.js'))});`);
  const env = {...process.env}; delete env.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({ env, executablePath: electronModule, args: [launcher], cwd: root, timeout: 30000 });
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.waitForTimeout(15000);
  fs.writeFileSync(path.join(__dirname,'screenshots/desktop-start.png'),Buffer.from(await app.evaluate(async ({BrowserWindow})=>{const image=await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});return image.toPNG().toString('base64');}),'base64')); 
  const startup = await page.locator('body').innerText();
  const externalLink = await page.evaluate(async () => {
    try { await window.electronAPI.openExternal('https://example.com'); return 'success'; }
    catch (e) { return e.message; }
  });
  const state = await page.evaluate(async () => ({
    environment: await window.electronAPI.opencodeStatus(),
    license: await window.electronAPI.licenseState(),
  }));
  const projectsButton = page.getByRole('button', { name: /Manage projects/ });
  if (await projectsButton.count()) {
    await projectsButton.click();
    await page.waitForTimeout(500);
    fs.writeFileSync(path.join(__dirname,'screenshots/desktop-projects.png'),Buffer.from(await app.evaluate(async ({BrowserWindow})=>{const image=await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});return image.toPNG().toString('base64');}),'base64')); 
  }
  await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].setSize(1100, 640); });
  fs.writeFileSync(path.join(__dirname,'screenshots/desktop-minimum.png'),Buffer.from(await app.evaluate(async ({BrowserWindow})=>{const image=await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});return image.toPNG().toString('base64');}),'base64')); 
  const minimum = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth }));
  await page.evaluate(fs.readFileSync('C:/Users/Nick/AppData/Local/Temp/olympus-audit-tools/node_modules/axe-core/axe.min.js','utf8'));
  const accessibility = await page.evaluate(async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})));
  await page.getByRole('button',{name:'New agent',exact:true}).click();
  let focusEscapesDialog=false;
  for(let i=0;i<20;i++){await page.keyboard.press('Tab');if(await page.evaluate(()=>!document.activeElement.closest('[role="dialog"]')))focusEscapesDialog=true;}
  await page.keyboard.press('Escape');
  const server = http.createServer((_req,res)=>res.end('<html><body>Audit local preview loaded</body></html>')).listen(0,'127.0.0.1');
  await new Promise(r=>server.once('listening',r));
  const previewUrl = `http://127.0.0.1:${server.address().port}`;
  await page.evaluate(url => { const frame=document.createElement('iframe');frame.id='audit-preview';frame.src=url;document.body.append(frame); }, previewUrl);
  await page.waitForTimeout(1000);
  const frames = page.frames().map(f=>f.url());
  await page.locator('#audit-preview').evaluate(el=>el.remove());
  fs.writeFileSync(path.join(__dirname,'desktop-results.json'),JSON.stringify({startup,externalLink,state,minimum,frames,errors,accessibility,focusEscapesDialog},null,2));
  console.log(JSON.stringify({externalLink,state,minimum,frames,errors,accessibility,focusEscapesDialog},null,2));
  server.close();
  await app.evaluate(({app})=>app.quit());
  await app.close().catch(()=>{});
})().catch(e=>{console.error(e);process.exit(1);});
