const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {_electron}=require('C:/Users/Nick/AppData/Local/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright');
const out=path.join(__dirname,process.env.OLYMPUS_AUDIT_RUN || 'fresh-run-2');fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const root=path.resolve(__dirname,'../../lantern');
 const original=JSON.parse(fs.readFileSync(path.join(process.env.APPDATA,'Olympus/settings.json'),'utf8'));
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'olympus-observed-'));
 fs.writeFileSync(path.join(profile,'settings.json'),JSON.stringify({schemaVersion:2,projectRoots:original.projectRoots,selectedModel:original.selectedModel,permissionMode:original.permissionMode,customEndpoints:original.customEndpoints||[],selectedVariants:original.selectedVariants||{},projects:[],stores:[],lastSpace:null}));
 const launcher=path.join(profile,'launch.cjs');
 fs.writeFileSync(launcher,`const {app}=require('electron');app.setPath('userData',${JSON.stringify(profile)});app.on('browser-window-created',(_,w)=>{w.setSize(1440,1000);w.webContents.setBackgroundThrottling(false)});require(${JSON.stringify(path.join(root,'dist-electron/main.js'))});`);
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.VITE_DEV_SERVER_URL;
 const app=await _electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:[launcher,'--remote-debugging-port=9227'],cwd:root,env,timeout:60000});
 const page=await app.firstWindow();page.setDefaultTimeout(60000);
 page.on('pageerror',e=>fs.appendFileSync(path.join(out,'renderer-errors.txt'),e.message+'\n'));
 fs.writeFileSync(path.join(out,'run.json'),JSON.stringify({profile,model:original.selectedModel,started:new Date().toISOString(),cdp:9227},null,2));
 try{
  await page.getByRole('button',{name:/^Station(?:\s+\d+)?$/}).click();
  await page.getByRole('button',{name:'New store',exact:true}).click();
  await page.getByLabel('Store name (optional)').fill('Harbor Desk');
  await page.getByLabel('Tell the agent what you want').fill('Build a complete custom local online store called Harbor Desk selling five coastal-themed notebooks. Create original matching product artwork and a logo, product pages, a cart, a working local simulated checkout with successful and declined test payments, and an order confirmation. Include useful shipping and returns information and make the site work on phones. Use local test mode only: do not publish, charge real cards, buy services, or contact external accounts. Make the implementation decisions yourself, run it, and verify the shopping flow before reporting completion.');
  await page.screenshot({path:path.join(out,'request.png')});
  await page.getByRole('button',{name:'Build my store',exact:true}).click();
  let target;
  for(let i=0;i<30;i++){
   target=await page.evaluate(()=>{const entries=Object.entries(JSON.parse(localStorage.getItem('olympus.stationSessions')||'{}'));return entries.length?{space:entries.at(-1)[0],session:entries.at(-1)[1].at(-1)}:null});
   if(target)break;await sleep(2000);
  }
  if(!target)throw Error('No Station session was created within 60 seconds');
  fs.writeFileSync(path.join(out,'target.json'),JSON.stringify(target,null,2));console.log('STARTED',JSON.stringify(target));
  let idle=0,finished=false;
  for(let tick=0;tick<120;tick++){
   const observation=await page.evaluate(async({space,session})=>{
    const [s,m,list]=await Promise.all([window.electronAPI.request(space,'GET','/session/status'),window.electronAPI.request(space,'GET',`/session/${session}/message`),window.electronAPI.request(space,'GET','/session')]);
    const messages=Array.isArray(m.data)?m.data:[];const assistants=messages.filter(m=>m.info.role==='assistant');
    return {at:new Date().toISOString(),statuses:s.data,messages:messages.length,assistantCount:assistants.length,lastAssistant:assistants.at(-1)?.parts.filter(p=>p.type==='text').map(p=>p.text).join('\n'),error:assistants.at(-1)?.info.error,tools:messages.flatMap(m=>m.parts.filter(p=>p.type==='tool').map(p=>({tool:p.tool,status:p.state?.status,title:p.state?.title,time:p.state?.time}))).slice(-8),sessions:(list.data||[]).map(s=>({id:s.id,parentID:s.parentID,title:s.title})),ui:document.body.innerText.slice(-2200)};
   },target);
   fs.writeFileSync(path.join(out,'latest.json'),JSON.stringify(observation,null,2));fs.appendFileSync(path.join(out,'timeline.jsonl'),JSON.stringify(observation)+'\n');
   await page.screenshot({path:path.join(out,`frame-${tick}.png`),timeout:10000}).catch(e=>console.log('Screenshot skipped:',e.message.split('\n')[0]));
   console.log(JSON.stringify({at:observation.at,messages:observation.messages,statuses:observation.statuses,tools:observation.tools.slice(-2).map(t=>({tool:t.tool,status:t.status,title:t.title})),error:observation.error}));
   const running=Object.values(observation.statuses||{}).some(s=>s.type==='busy'||s.type==='retry');
   idle=!running&&observation.assistantCount>0?idle+1:0;
   if(idle>=3){finished=true;fs.writeFileSync(path.join(out,'completed.json'),JSON.stringify(observation,null,2));console.log('OBSERVATION_COMPLETE');break;}
   if(fs.existsSync(path.join(out,'end-observation')))break;
   await sleep(20000);
  }
  fs.writeFileSync(path.join(out,'observer-state.json'),JSON.stringify({finished,waitingForClose:true}));
  // Keep the inspected window available for browser checks; never abort a still-working agent.
  while(!fs.existsSync(path.join(out,'close-window')))await sleep(5000);
 }finally{await app.close();}
})().catch(e=>{console.error(e);fs.writeFileSync(path.join(out,'observer-error.txt'),e.stack);process.exitCode=1});
