/* An interactive browser demo. No model calls or changes to visitors' files. */
(() => {
  const demo = document.querySelector('.demo');
  if (!demo) return;
  const projects = [
    {id:'studio-site',brand:'studio.',base:'A creative studio.',suggestion:'Good things start here.',description:'A little space for your next big idea.'},
    {id:'notes-app',brand:'little notes.',base:'Your notes, together.',suggestion:'Make room for a thought.',description:'Capture the small ideas worth keeping.'},
    {id:'weekend-project',brand:'weekend.',base:'Something for Saturday.',suggestion:'Build something just for you.',description:'A place for experiments and happy accidents.'}
  ].map(p => ({...p,title:p.base,proposed:p.suggestion,accepted:false,draft:'',prompt:'Give the home page a clear, welcoming headline.',work:false}));
  let current = projects[0];
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const find = selector => demo.querySelector(selector);
  const sidebar = find('.demo__sidebar');
  sidebar.innerHTML = '<p class="demo__label">Your projects</p>' + projects.map(p=>`<button class="project" type="button" data-project="${p.id}" aria-pressed="false"><span aria-hidden="true">▱</span>${p.id}</button>`).join('') + '<div class="demo__local"><strong>Explore the workspace</strong>Choose a project to get started.</div>';
  find('.demo__composer').outerHTML = '<form class="demo__composer"><label for="demo-prompt">Try a headline for this project</label><textarea id="demo-prompt" maxlength="120" rows="2" placeholder="Type your own headline…" required></textarea><div><span>Your text becomes a proposed edit.</span><button type="submit">Propose edit ↑</button></div></form>';
  find('.demo__foot').innerHTML = '<span data-project-path></span><button type="button" data-reset>Reset project</button>';
  find('.demo__status').innerHTML = '<span class="status-dot" aria-hidden="true"></span> Workspace playground';
  const composer = find('form');
  const input = find('textarea');
  function render() {
    const p=current;
    demo.querySelectorAll('[data-project]').forEach(b=>{b.classList.toggle('is-active',b.dataset.project===p.id);b.setAttribute('aria-pressed',String(b.dataset.project===p.id));});
    const diff = '+ <h1>'+p.proposed+'</h1>\n+ <p>'+p.description+'</p>';
    find('#view-agent').innerHTML = `<div class="demo__heading">${p.id}<span data-demo-count>${p.accepted?'Change accepted':'1 proposed edit'}</span></div><div class="demo__prompt">${escape(p.prompt)}</div><div class="agent-message"><span class="agent-avatar" aria-hidden="true">O</span><div><strong>Olympus</strong><p>${p.accepted?'Your headline is now in the project preview. Try another idea below.':'Here is the proposed headline. Accept it to update the project preview.'}</p></div></div><div class="demo-presets"><button type="button" data-preset="Make something wonderful.">Make it welcoming</button><button type="button" data-preset="Small ideas. Big possibilities.">Try something bold</button></div><div class="diff-card"><div class="diff-card__head"><code>Home page</code><span>Headline and description</span></div><pre>${escape(diff)}</pre><div class="diff-card__action"><span data-demo-result role="status">${p.accepted?'Change applied to preview':'Waiting for your review'}</span><button type="button" class="demo-approve" data-accept>${p.accepted?'Undo edit':'Accept edit'}</button></div></div>`;
    find('#view-code').innerHTML = `<div class="demo__heading">Home page<span>${p.accepted?'Current version':'Proposed changes'}</span></div><pre class="code-editor">${escape('<main>\n  <h1>'+p.proposed+'</h1>\n  <p>'+p.description+'</p>\n</main>')}</pre><p>${p.accepted?'This version is visible in the preview.':'Accept the proposed edit in Agent view to update the preview.'}</p>`;
    find('#view-thread').innerHTML = `<div class="demo__heading">${p.id}<span>Same project, same conversation</span></div><div class="demo__prompt">${escape(p.prompt)}</div><div class="agent-message"><span class="agent-avatar" aria-hidden="true">O</span><div><strong>Olympus</strong><p>Proposed headline: ${escape(p.proposed)}</p></div></div><div class="thread-message"><strong>${p.accepted?'Change accepted':'Ready for review'}</strong><p>${p.accepted?'The preview now shows your headline.':'Switch to Agent view to accept this change.'}</p></div>`;
    find('.preview-url').textContent=p.id;
    find('.preview-page').innerHTML=`<div class="preview-page__nav">${p.brand}<span>Home</span></div><h3>${escape(p.title)}</h3><p>${escape(p.description)}</p><button type="button" class="preview-button" data-preview-work>${p.work?'Back to home':'Explore the project'}</button>${p.work?'<div class="preview-work"><strong>A work in progress</strong><p>Your next idea belongs here. Try a new headline in the workspace.</p></div>':''}`;
    find('[data-project-path]').textContent=p.id+' / main';
    input.value=p.draft;
  }
  function propose(text) {
    current.previousTitle=current.title;
    current.proposed=text.trim(); current.prompt='Use this headline: '+text.trim();current.accepted=false;current.draft='';
    render();demo.querySelector('#tab-agent').click();
  }
  input.addEventListener('input',()=>{current.draft=input.value;});
  composer.addEventListener('submit',e=>{e.preventDefault();if(input.value.trim()){propose(input.value);find('[data-accept]').focus();}});
  input.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();composer.requestSubmit();}});
  demo.addEventListener('click',e=>{
    const button=e.target.closest('button');if(!button)return;
    if(button.dataset.project){current=projects.find(p=>p.id===button.dataset.project);render();}
    if(button.hasAttribute('data-accept')){current.accepted=!current.accepted;current.title=current.accepted?current.proposed:(current.previousTitle||current.base);render();find('[data-accept]').focus();}
    if(button.hasAttribute('data-preset')){current.previousTitle=current.title;propose(button.dataset.preset);find('[data-accept]').focus();}
    if(button.hasAttribute('data-reset')){Object.assign(current,{title:current.base,proposed:current.suggestion,accepted:false,draft:'',work:false,previousTitle:current.base,prompt:'Give the home page a clear, welcoming headline.'});render();}
    if(button.hasAttribute('data-preview-work')){current.work=!current.work;render();find('[data-preview-work]').focus();}
  });
  render();
})();
