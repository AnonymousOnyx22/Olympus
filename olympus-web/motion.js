(() => {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const progress=document.createElement('div');progress.className='reading-progress';progress.setAttribute('aria-hidden','true');document.body.append(progress);
  const back=document.createElement('button');back.className='back-top';back.type='button';back.textContent='↑';back.setAttribute('aria-label','Back to top');back.hidden=true;back.addEventListener('click',()=>{window.scrollTo({top:0,behavior:reduced.matches?'instant':'smooth'});document.querySelector('.lockup')?.focus({preventScroll:true});});document.body.append(back);
  const hero=document.querySelector('.hero');
  if(hero){
    hero.insertAdjacentHTML('afterbegin','<span class="sky-cloud sky-cloud--one" aria-hidden="true"></span><span class="sky-cloud sky-cloud--two" aria-hidden="true"></span>');
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
    document.querySelectorAll('.pagehead,.sec__head,.split,.cards,.workflow-grid,.demo,.rel__item,.prose,.note,.pager,.stat-strip,.workspace-mock').forEach(el=>observer.observe(el));
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
  // Count-up stat figures: <span data-count="49" data-prefix="$" data-suffix="%">. Runs once per
  // element on first scroll into view; reduced motion (or no IntersectionObserver) just writes
  // the final value straight away, so the number is never gated behind an animation nobody sees.
  const counters=[...document.querySelectorAll('[data-count]')];
  if(counters.length){
    const write=(el,value)=>{el.textContent=`${el.dataset.prefix||''}${value}${el.dataset.suffix||''}`;};
    if(reduced.matches||!('IntersectionObserver' in window)){
      counters.forEach(el=>write(el,el.dataset.count));
    }else{
      const countIO=new IntersectionObserver(entries=>{
        entries.forEach(entry=>{
          if(!entry.isIntersecting||entry.target.dataset.counted)return;
          entry.target.dataset.counted='1';
          countIO.unobserve(entry.target);
          const target=parseFloat(entry.target.dataset.count);
          if(!isFinite(target)){write(entry.target,entry.target.dataset.count);return;}
          const t0=performance.now();const dur=900;
          const step=t=>{
            const k=Math.min(1,(t-t0)/dur);
            write(entry.target,Math.round(target*(1-Math.pow(1-k,3))));
            if(k<1)requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        });
      },{threshold:0.6});
      counters.forEach(el=>countIO.observe(el));
    }
  }
})();
