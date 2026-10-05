const {chromium}=require('C:/Users/Nick/AppData/Local/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright');
(async()=>{const b=await chromium.launch();
for(const w of [1440,1920,2560]){const p=await b.newPage({viewport:{width:w,height:900}});
await p.goto('file:///C:/Users/Nick/Downloads/Project%20-%20Copy/olympus-web/index.html',{waitUntil:'load'});
const r=await p.evaluate(async()=>{const t=document.querySelector('.providers__track');const row=t.parentElement;const a=t.getAnimations()[0];const dur=a.effect.getComputedTiming().duration;
const out={rowW:row.clientWidth,trackW:t.scrollWidth,setW:t.children[0].scrollWidth,sets:t.children.length,dur,css:getComputedStyle(t).animationName+' '+getComputedStyle(t).animationDuration,samples:[]};
a.pause();for(const f of [0,.25,.5,.75,.99]){a.currentTime=dur*f;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const rects=[...t.querySelectorAll('.brand-mark')].map(e=>e.getBoundingClientRect());const rowR=row.getBoundingClientRect();
out.samples.push({f,left:Math.round(rects[0].left),lastRight:Math.round(rects.at(-1).right),rowRight:Math.round(rowR.right)});}
return out});
console.log(w,JSON.stringify(r));await p.close()}
await b.close()})()
