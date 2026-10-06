const {chromium}=require('C:/Users/Nick/AppData/Local/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright');
(async()=>{const b=await chromium.connectOverCDP('http://127.0.0.1:9227');
const page=b.contexts()[0].pages()[0];
for(const id of ['build-a-small-online-murqxud7','harbor-desk-muucj959'].map(n=>'c:'+String.fromCharCode(92)+'users'+String.fromCharCode(92)+'nick'+String.fromCharCode(92)+'downloads'+String.fromCharCode(92)+'stores'+String.fromCharCode(92)+n)){
 const r=await page.evaluate(async(id)=>{try{const list=await window.electronAPI.removeStore(id,true);return {ok:true,left:list.map(s=>s.path)}}catch(e){return {ok:false,error:String(e.message||e)}}},id);
 console.log(id.split(String.fromCharCode(92)).pop(),JSON.stringify(r));}
await b.close()})().catch(e=>console.error('ERR',e.message))
