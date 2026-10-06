const {chromium}=require('C:/Users/Nick/AppData/Local/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright');
const base=process.argv[2], out=process.argv[3];
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:900}});
const bad=[];p.on('response',r=>{if(r.status()>=400)bad.push(r.status()+' '+r.url().replace(base,''))});
await p.goto(base+'/',{waitUntil:'networkidle'});
const links=[...new Set(await p.$$eval('a[href^="/"]',a=>a.map(x=>x.getAttribute('href').split('#')[0]).filter(h=>h&&!/\.(png|svg|jpg)$/.test(h))))].slice(0,40);
const pages=['/',...links.filter(l=>l!=='/')];const rows=[];
const fs=require('fs');fs.mkdirSync(out,{recursive:true});
for(const u of pages){const res=await p.goto(base+u,{waitUntil:'networkidle'}).catch(()=>null);if(!res)continue;
 const t=await p.evaluate(()=>document.body.innerText);
 const imgs=await p.$$eval('img',is=>is.map(i=>({ok:i.complete&&i.naturalWidth>0,src:i.getAttribute('src')})));
 rows.push({u,status:res.status(),chars:t.length,emDash:(t.match(/\u2014/g)||[]).length,enDash:(t.match(/\u2013/g)||[]).length,semi:(t.match(/;/g)||[]).length,fake:(t.match(/best.?seller|popular|trending|\u2605|reviews?\b|\d+ (customers|sold)|only \d+ left|in stock/gi)||[]),brokenImgs:imgs.filter(i=>!i.ok).map(i=>i.src)});
}
const anim=await p.evaluate(()=>{let t=0,a=0;for(const s of document.styleSheets){try{for(const r of s.cssRules){if(r.type===7)a++;if(r.style&&/transition|animation/.test(r.cssText))t++}}catch{}}return {keyframes:a,transitionRules:t}});
console.log(JSON.stringify({pages:rows.length,anim,bad:bad.slice(0,8)}));
for(const r of rows)console.log(r.u.padEnd(28),r.status,'chars',String(r.chars).padStart(5),'em',r.emDash,'en',r.enDash,';',r.semi,r.fake.length?'FAKE:'+[...new Set(r.fake)].join('|'):'',r.brokenImgs.length?'BROKEN:'+r.brokenImgs.join(','):'');
for(const [n,u] of [['home','/'],['shop','/shop']]){await p.goto(base+u,{waitUntil:'networkidle'}).catch(()=>{});await p.waitForTimeout(700);await p.screenshot({path:out+'/'+n+'.png',fullPage:true})}
await b.close()})()
