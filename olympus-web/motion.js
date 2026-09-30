(() => {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const progress=document.createElement('div');progress.className='reading-progress';progress.setAttribute('aria-hidden','true');document.body.append(progress);
  const back=document.createElement('button');back.className='back-top';back.type='button';back.textContent='↑';back.setAttribute('aria-label','Back to top');back.hidden=true;back.addEventListener('click',()=>{window.scrollTo({top:0,behavior:reduced.matches?'instant':'smooth'});document.querySelector('.lockup')?.focus({preventScroll:true});});document.body.append(back);
  const hero=document.querySelector('.hero');
  if(hero){
    hero.insertAdjacentHTML('afterbegin','<span class="sky-cloud sky-cloud--one" aria-hidden="true"></span><span class="sky-cloud sky-cloud--two" aria-hidden="true"></span><div class="hero-discovery"><button type="button" class="discovery-button" aria-expanded="false" aria-controls="olympus-discovery" aria-label="Discover Olympus">☀</button><div class="discovery-card" id="olympus-discovery" hidden><strong>Your own Olympus</strong>Your tools, your projects, your next big idea. Make yourself at home.<a href="#watch">Take the workspace for a spin ↓</a></div></div>');
    const trigger=hero.querySelector('.discovery-button');const card=hero.querySelector('.discovery-card');
    const close=()=>{card.hidden=true;trigger.setAttribute('aria-expanded','false');};
    trigger.addEventListener('click',()=>{const open=card.hidden;card.hidden=!open;trigger.setAttribute('aria-expanded',String(open));});
    card.querySelector('a').addEventListener('click',close);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!card.hidden){close();trigger.focus();}});
    document.addEventListener('click',e=>{if(!e.target.closest('.hero-discovery'))close();});
    hero.querySelector('.hero__copy').insertAdjacentHTML('beforeend','<a class="scroll-cue" href="#watch"><span aria-hidden="true">↓</span>Step into the workspace</a>');
  }
  let queued=false;
  function scroll(){queued=false;const range=document.documentElement.scrollHeight-innerHeight;progress.style.transform=`scaleX(${range>0?scrollY/range:0})`;back.hidden=scrollY<700;if(hero&&!reduced.matches&&scrollY<hero.offsetHeight)hero.style.setProperty('--hero-drift',`${scrollY*.12}px`);}
  addEventListener('scroll',()=>{if(!queued){queued=true;requestAnimationFrame(scroll);}},{passive:true});addEventListener('resize',scroll);scroll();
  if('IntersectionObserver' in window){
    let lastY=scrollY;
    let direction='down';
    addEventListener('scroll',()=>{direction=scrollY<lastY?'up':'down';lastY=scrollY;},{passive:true});
    const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{
      if(entry.isIntersecting&&!reduced.matches){
        entry.target.style.setProperty('--reveal-y',direction==='up'?'-23px':'23px');
        entry.target.classList.add('motion-reveal');
      }else if(!entry.isIntersecting){entry.target.classList.remove('motion-reveal');}
    });},{threshold:0,rootMargin:'0px 0px 0px 0px'});
    document.querySelectorAll('.pagehead,.sec__head,.split,.cards,.workflow-grid,.demo,.rel__item,.prose,.note,.pager').forEach(el=>observer.observe(el));
    reduced.addEventListener('change',()=>{if(reduced.matches)document.querySelectorAll('.motion-reveal').forEach(el=>el.classList.remove('motion-reveal'));});
  }
  document.querySelectorAll('.workflow-card').forEach((card,i)=>{const modes=['Agent','Code','Thread'];const button=document.createElement('button');button.className='mode-jump';button.type='button';button.textContent=`Try ${modes[i]} view ↗`;button.addEventListener('click',()=>{const tab=document.querySelector(`#tab-${modes[i].toLowerCase()}`);tab.click();document.querySelector('.demo').scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'start'});tab.focus({preventScroll:true});});card.append(button);});
  function animate(el,name){if(!el||reduced.matches)return;el.classList.remove(name);void el.offsetWidth;el.classList.add(name);}
  const demo=document.querySelector('.demo');
  if(demo&&!demo.querySelector('.live-projects')){
    const themes=document.createElement('div');themes.className='preview-themes';themes.innerHTML='<span>Try a colour</span>'+[['blue','#d5eaff'],['gold','#ffdc81'],['mint','#ccebd5']].map(([name,color])=>`<button type="button" data-preview-theme="${name}" style="--swatch:${color}" aria-label="${name} preview theme" aria-pressed="${name==='blue'}"></button>`).join('');demo.querySelector('.demo__preview').append(themes);
    demo.querySelector('.preview-page').dataset.theme='blue';
    demo.addEventListener('click',e=>{
      const theme=e.target.closest('[data-preview-theme]');if(theme){demo.querySelector('.preview-page').dataset.theme=theme.dataset.previewTheme;themes.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===theme)));}
      if(e.target.closest('[data-demo-tab]')){animate(demo.querySelector('[role=tabpanel]:not([hidden])'),'mode-flash');}
      if(e.target.closest('[data-accept]')){animate(demo.querySelector('.preview-page'),'preview-updated');if(!reduced.matches&&demo.querySelector('[data-demo-result]').textContent.includes('applied')){const box=demo.querySelector('.preview-page').getBoundingClientRect();for(let i=0;i<14;i++){const piece=document.createElement('span');piece.className='confetti-bit';piece.setAttribute('aria-hidden','true');piece.style.cssText=`left:${box.left+box.width/2}px;top:${Math.max(0,box.top+80)}px;--dx:${(Math.random()-.5)*220}px;--dy:${Math.random()*150-90}px;--spin:${Math.random()*400}deg;--piece-color:${['#efbb4f','#4b96c8','#709e81'][i%3]}`;document.body.append(piece);setTimeout(()=>piece.remove(),800);}}}
    });
  }
})();
