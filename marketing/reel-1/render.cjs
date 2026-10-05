const {chromium}=require('/opt/node22/lib/node_modules/playwright');
const fs=require('fs'),path=require('path'),{execSync}=require('child_process');
(async()=>{
  const FPS=30,DUR=14.5,out=path.join(__dirname,'frames');
  fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out);
  const b=await chromium.launch(),pg=await b.newPage({viewport:{width:1080,height:1920}});
  await pg.goto('file://'+path.join(__dirname,'scene.html'));await pg.waitForLoadState('load');
  const n=Math.round(FPS*DUR);
  for(let i=0;i<n;i++){await pg.evaluate(t=>render(t),i/FPS);
    await pg.screenshot({path:path.join(out,`f${String(i).padStart(4,'0')}.png`)});}
  await b.close();
  execSync(`ffmpeg -y -loglevel error -framerate ${FPS} -i ${out}/f%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18 -movflags +faststart reel-1.mp4`,{cwd:__dirname});
  fs.copyFileSync(path.join(out,'f0240.png'),path.join(__dirname,'preview-card.png'));
  fs.copyFileSync(path.join(out,'f0258.png'),path.join(__dirname,'preview-hook.png'));
  fs.copyFileSync(path.join(out,`f${String(n-1).padStart(4,'0')}.png`),path.join(__dirname,'preview-end.png'));
  fs.rmSync(out,{recursive:true});console.log('done',n);
})();
