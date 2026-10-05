const {chromium}=require('C:/Users/Nick/AppData/Local/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright');
(async()=>{const b=await chromium.launch();const out=__dirname+'/dogear/';
for(const [vw,vh,tag] of [[1440,900,'d'],[390,844,'m']]){const p=await b.newPage({viewport:{width:vw,height:vh}});
for(const [n,u] of [['home','/'],['shop','/shop'],['cart','/cart']]){await p.goto('http://127.0.0.1:4317'+u,{waitUntil:'networkidle'}).catch(()=>{});await p.waitForTimeout(800);await p.screenshot({path:`${out}${tag}-${n}.png`,fullPage:true});}
await p.close()}await b.close()})()
