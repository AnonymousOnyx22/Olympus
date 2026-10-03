const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {_electron}=require('C:/Users/Nick/AppData/Local/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright');
(async()=>{const root=path.resolve(__dirname,'../../lantern'),scratch=fs.mkdtempSync(path.join(os.tmpdir(),'olympus-review-'));const launcher=path.join(scratch,'launch.cjs');
 fs.writeFileSync(path.join(scratch,'settings.json'),JSON.stringify({schemaVersion:1,projectRoots:[],permissionMode:'ask'}));
 fs.writeFileSync(launcher,`const {app}=require('electron');app.setPath('userData',${JSON.stringify(scratch)});app.on('browser-window-created',(_,w)=>{w.show=()=>{};w.setSize(1440,940);w.webContents.setBackgroundThrottling(false)});require(${JSON.stringify(path.join(root,'dist-electron/main.js'))})`);
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:[launcher],cwd:root,env});const results={errors:[],screens:[],scratch};
 try{const page=await app.firstWindow();page.on('pageerror',e=>results.errors.push(e.message));await page.getByRole('button',{name:/^Manage projects/}).waitFor({timeout:30000});
 for(const [name,button]of [['projects','Manage projects'],['workspace','Workspace'],['station','Station'],['connections','Connections']]){try{await page.getByRole('button',{name:new RegExp('^'+button+'(?:\\s+\\d+)?$')}).first().click();await page.waitForTimeout(400);await page.screenshot({path:path.join(__dirname,'screenshots',`desktop-${name}.png`)});results.screens.push({name,text:(await page.locator('body').innerText()).slice(0,12000)});}catch(e){results.errors.push(name+': '+e.message);}}
 await app.evaluate(({BrowserWindow})=>{BrowserWindow.getAllWindows()[0].setSize(960,680)});await page.screenshot({path:path.join(__dirname,'screenshots','desktop-connections-small.png')});
 // No real login or remote provider request: exercise closing a blank sign-in window.
 await app.evaluate(({BrowserWindow})=>{const original=BrowserWindow.prototype.loadURL;BrowserWindow.prototype.loadURL=function(url,...args){return original.call(this,url.startsWith('https://www.etsy.com')?'about:blank':url,...args)}});
 const signIn=page.evaluate(()=>window.electronAPI.openConnectionSignIn('etsy'));
 await page.waitForTimeout(400);
 await app.evaluate(({BrowserWindow})=>{for(const win of BrowserWindow.getAllWindows())if(win.getTitle().startsWith('Sign in to Etsy'))win.close()});
 const states=await signIn;
 results.cancelledLogin={status:states.find(x=>x.id==='etsy'),savedSession:JSON.parse(fs.readFileSync(path.join(scratch,'connection-sessions/etsy.json'),'utf8'))};
 }finally{await app.close();fs.writeFileSync(path.join(__dirname,'desktop-results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));}
})().catch(e=>{console.error(e);process.exitCode=1});

