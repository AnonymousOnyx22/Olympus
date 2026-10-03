import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createServer } from '../../lantern/node_modules/vite/dist/node/index.js';
import react from '../../lantern/node_modules/@vitejs/plugin-react/dist/index.js';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/Nick/AppData/Local/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright');
const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'../../lantern');
process.chdir(root);
const server=await createServer({configFile:false,root,plugins:[react(),{
 name:'boot-review',resolveId(id){if(id==='virtual:boot-review')return '\0boot-review'},
 load(id){if(id==='\0boot-review')return `import React from 'react';import {createRoot} from 'react-dom/client';import {AnimatePresence} from 'framer-motion';import Boot from '/src/components/OlympusBoot.tsx';import '/src/index.css';const root=createRoot(document.getElementById('root'));window.showBoot=(progress,visible=true)=>root.render(React.createElement(AnimatePresence,null,visible?React.createElement(Boot,{key:'boot',progress}):null));window.showBoot(0);`},
 configureServer(s){s.middlewares.use('/boot-review',async(_req,res)=>{res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml('/boot-review','<html><head></head><body><div id="root"></div><script type="module" src="/@id/virtual:boot-review"></script></body></html>'))})}
}],server:{host:'127.0.0.1',port:0}});
await server.listen();const browser=await chromium.launch();const results=[];
try{for(const reducedMotion of ['no-preference','reduce']){
 const page=await browser.newPage({viewport:{width:1360,height:860},reducedMotion});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/boot-review`);
 const bar=page.getByRole('progressbar');await bar.waitFor();await page.waitForTimeout(800);
 const geometry=()=>bar.evaluate(e=>{const track=e.getBoundingClientRect(),fill=e.firstElementChild.getBoundingClientRect();return {width:fill.width,track:track.width,right:fill.right,edge:track.right,left:fill.left,value:e.getAttribute('aria-valuenow')}});
 assert.equal((await geometry()).width,0);
 await page.evaluate(()=>window.showBoot(70));const samples=[];
 for(let i=0;i<9;i++){await page.waitForTimeout(90);samples.push(await geometry())}
 for(let i=1;i<samples.length;i++){assert(samples[i].width>=samples[i-1].width-.1);assert(Math.abs(samples[i].right-samples[i].edge)<1)}
 assert(Math.abs(samples.at(-1).width/samples.at(-1).track-.7)<.01);
 await page.screenshot({path:path.join(dir,'screenshots',`boot-${reducedMotion}.png`)});
 await page.evaluate(()=>{window.showBoot(100);setTimeout(()=>window.showBoot(100,false),30)});
 if(reducedMotion==='no-preference'){await page.waitForTimeout(680);assert(await bar.count());const end=await geometry();assert(Math.abs(end.width-end.track)<1)}
 await bar.waitFor({state:'detached'});assert.deepEqual(errors,[]);results.push({reducedMotion,passed:true,samples});await page.close();
}fs.writeFileSync(path.join(dir,'boot-results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results.map(({reducedMotion,passed})=>({reducedMotion,passed}))));}
finally{await browser.close();await server.close()}
