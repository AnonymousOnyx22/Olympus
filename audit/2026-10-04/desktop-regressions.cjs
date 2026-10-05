const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const {_electron}=require('C:/Users/Nick/AppData/Local/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright');
(async()=>{
 const root=path.resolve(__dirname,'../../lantern'),scratch=fs.mkdtempSync(path.join(os.tmpdir(),'olympus-regressions-'));
 const projects=path.join(scratch,'Projects');fs.mkdirSync(projects);
 fs.writeFileSync(path.join(scratch,'settings.json'),JSON.stringify({schemaVersion:2,projectRoots:[projects],permissionMode:'ask',lastSpace:null,projects:[],stores:[]}));
 const launcher=path.join(scratch,'launch.cjs');fs.writeFileSync(launcher,`const {app}=require('electron');app.setPath('userData',${JSON.stringify(scratch)});app.on('browser-window-created',(_,w)=>{w.show=()=>{};w.setSize(1200,900)});require(${JSON.stringify(path.join(root,'dist-electron/main.js'))});`);
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.VITE_DEV_SERVER_URL;
 const app=await _electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:[launcher],cwd:root,env,timeout:60000});
 const results=[];
 try {
  const page=await app.firstWindow();page.setDefaultTimeout(30000);
  await page.getByRole('button',{name:'Connections',exact:true}).click();
  await page.getByRole('searchbox',{name:'Search connection providers'}).fill('Etsy');
  await page.getByRole('button',{name:/Etsy/}).last().click();
  await app.evaluate(({session})=>{session.fromPartition('persist:connection-etsy').webRequest.onBeforeRequest({urls:['*://*.etsy.com/*']},(_details,callback)=>callback({redirectURL:'about:blank'}))});
  const popupPromise=app.waitForEvent('window');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  const popup=await popupPromise;await popup.waitForLoadState('domcontentloaded');
  await app.evaluate(({BrowserWindow})=>{const win=BrowserWindow.getAllWindows().find(w=>w.getTitle().startsWith('Sign in'));if(!win)throw Error('No sign-in window');win.close()});
  await page.getByRole('alert').filter({hasText:'No browser session was saved'}).waitFor();
  assert.equal(await page.evaluate(async()=> (await window.electronAPI.listConnections()).find(c=>c.id==='etsy').browserSessionConnected),false);
  results.push('PASS cancelled empty browser sign-in reports an error and does not mark the account connected.');
  await page.screenshot({path:path.join(__dirname,'connections-cancelled.png')});
  const modes=await page.evaluate(async root=>{
   const a=await window.electronAPI.createProject(root,'Mode A');const b=await window.electronAPI.createProject(root,'Mode B');
   await window.electronAPI.setSettings({permissionMode:'bypass'});const first=await window.electronAPI.openSpace(a.id);
   await window.electronAPI.setSettings({permissionMode:'ask'});const second=await window.electronAPI.openSpace(b.id);
   const again=await window.electronAPI.openSpace(a.id);
   return {first:first.state.permissionMode,second:second.state.permissionMode,again:again.state.permissionMode};
  },projects);
  assert.deepEqual(modes,{first:'bypass',second:'ask',again:'bypass'});
  results.push('PASS two running projects retain and report their own effective permission modes.');
  await page.getByRole('button',{name:'All connections',exact:true}).click();
  await page.getByRole('button',{name:'Saved connections',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:/Etsy/}).count(),0);
  results.push('PASS saved-connections filter excludes unconfigured providers.');
  console.log(results.join('\n'));fs.writeFileSync(path.join(__dirname,'desktop-regressions.json'),JSON.stringify(results,null,2));
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
