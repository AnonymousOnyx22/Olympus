const {chromium}=require('/opt/node22/lib/node_modules/playwright');
const fs=require('fs'),path=require('path'),{execSync}=require('child_process');
const stills=process.argv.slice(2).map(Number);
(async()=>{
  const FPS=30,DUR=35,out=path.join(__dirname,'frames');
  const b=await chromium.launch(),pg=await b.newPage({viewport:{width:1080,height:1920}});
  await pg.goto('file://'+path.join(__dirname,'scene.html'));await pg.evaluate(()=>document.fonts.ready);
  if(stills.length){fs.mkdirSync(path.join(__dirname,'stills'),{recursive:true});
    for(const s of stills){await pg.evaluate(t=>render(t),s);await pg.screenshot({path:path.join(__dirname,'stills',`t${s}.png`)});}
    await b.close();return;}
  fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out);
  const n=Math.round(FPS*DUR);
  for(let i=0;i<n;i++){await pg.evaluate(t=>render(t),i/FPS);
    await pg.screenshot({path:path.join(out,`f${String(i).padStart(4,'0')}.png`),type:'png'});}
  await b.close();
  execSync(`ffmpeg -y -loglevel error -framerate ${FPS} -i ${out}/f%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18 -movflags +faststart reel-2.mp4`,{cwd:__dirname});
  fs.rmSync(out,{recursive:true});console.log('done',n);
})();
