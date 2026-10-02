/* Scripted project conversations paired with working, local browser apps. */
(() => {
  const demo=document.querySelector('.demo');if(!demo)return;
  const $=s=>demo.querySelector(s);
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const projects=[
    {id:'studio-site',name:'Studio North',description:'Portfolio & case studies',status:'Reviewing the portfolio',request:'Build a portfolio for Studio North. Show three projects, let visitors filter the work, and open a case study without leaving the page.',reply:'I will build a small editorial portfolio with a warm introduction, a filterable collection, and a closer look at each project. The work should do most of the talking.',steps:[
      ['Read(index.html)','Reviewed the page structure, work section, and contact introduction.'],
      ['Plan the first version','Keep the opening short. Give each project its own colour and a clear case-study button. Use All, Brand, and Web filters.'],
      ['Create(styles.css)','Added a cream canvas, navy outlines, gold buttons, and large serif headings. Project artwork uses simple letterforms instead of stock photos.'],
      ['Create(app.js)','Added Helios Coffee, Tide Journal, and Olive & Earth, with a category, visual identity, and case-study description for each.']],
      diff:['+ const work = [heliosCoffee, tideJournal, oliveAndEarth];','+ renderProjects(activeFilter);','+ caseStudy.showModal();'],
      followup:'Make the filters work, and let me open and close the project details.',
      response:'The filters now update the actual project list. Each case study opens a dialog with the project brief and outcome. Closing it returns you to the same collection.',checks:['All shows three projects; Brand shows two; Web shows one.','Each project opens its own case study, with a working close button.','The collection fits a narrow screen without horizontal scrolling.'],next:'Reviewing the final layout, button labels, and case-study copy.',label:'Reviewing'},
    {id:'notes-app',name:'Little Notes',description:'Search, edit & pin notes',status:'Reviewing the note editor',request:'Make a small notes app. I want to write ideas, find them later, and pin the important ones. Keep my notes when I come back.',reply:'I will start with a title and a simple writing area, then put saved notes underneath. Search will cover the title and body, with pinned notes always first.',steps:[
      ['Read(index.html)','Set up the note editor, search field, note count, and a place for saved ideas.'],
      ['Create(app.js)','Added three starter notes so the first visit has something useful to explore. New notes receive their own identifier.'],
      ['Add note editing','Save updates the selected note rather than creating a duplicate. Cancel clears the editor without changing the saved note.'],
      ['Add browser storage','Notes are saved locally after creating, editing, pinning, or deleting. If storage is unavailable, they still work for the current visit.']],
      diff:['+ notes.filter(matchesSearch).sort(pinnedFirst);','+ localStorage.setItem(storageKey, JSON.stringify(notes));','+ noteBody.textContent = note.body;'],
      followup:'Add search and a way to delete old notes. Do not lose a note when I switch projects.',
      response:'Search updates as you type. Pin, Edit, and Delete work on individual notes. Switching projects keeps the app open, and refreshing restores saved notes from this browser.',checks:['Search checks both the title and the full note.','Blank notes are rejected; saved text is displayed as text.','Pinned notes move first; deleting the last note shows an empty state.'],next:'Reviewing the editor, empty states, and keyboard focus.',label:'Reviewing'},
    {id:'weekend-project',name:'Weekend Club',description:'A two-day adventure planner',status:'Reviewing the weekend plan',request:'Build a weekend planner with separate Saturday and Sunday plans. Let me add an activity, choose a time, and tick it off when it is done.',reply:'I will make a two-day itinerary with a short form and a completion count. Plans will be ordered by time so the day is easy to follow.',steps:[
      ['Read(index.html)','Created day tabs, a progress summary, the itinerary, and an activity form.'],
      ['Create(app.js)','Added a market visit, a lakeside walk, a dinner plan, a bookshop stop, and time for sketching.'],
      ['Add day selection','Saturday and Sunday each show their own plans. Switching days also updates the day selected in the form.'],
      ['Add activity controls','Complete and Remove operate on individual activities. The completion count updates immediately, and changes are saved in this browser.']],
      diff:['+ today = plans.filter(plan => plan.day === activeDay);','+ today.sort((a, b) => a.time.localeCompare(b.time));','+ plan.done = !plan.done;'],
      followup:'Let me undo a completion and remove a plan. Keep everything in the right time order.',
      response:'Completed activities can be marked unfinished again. New activities appear on the chosen day in time order, and removing one recalculates progress. Your plans survive a page refresh.',checks:['Saturday and Sunday keep separate itineraries.','Adding an earlier activity places it before later plans.','Mark unfinished restores an activity; Remove updates the count.'],next:'Reviewing the day switcher, saved plans, and completion states.',label:'Reviewing'}
  ];
  let current=projects[0],visible=true,selectedFile='index.html',codeRequest=0;
  $('.demo__sidebar').innerHTML='<p class="demo__label">Your projects</p>'+projects.map(p=>`<button type="button" class="project" data-project="${p.id}" aria-pressed="false"><span class="project-icon" aria-hidden="true">${p.id==='studio-site'?'S':p.id==='notes-app'?'N':'W'}</span><span>${p.id}<small>${p.description}</small></span></button>`).join('')+'<div class="demo__files"><p class="demo__label">Project files</p>'+['index.html','styles.css','app.js'].map(f=>`<button type="button" data-file="${f}" aria-pressed="false">${f}</button>`).join('')+'</div>';
  $('.demo__composer')?.remove();$('.demo__foot')?.remove();$('.demo__status')?.remove();
  $('#view-agent').innerHTML='<div class="demo__heading"><strong data-project-title></strong></div><div class="conversation" data-agent-history aria-label="Project walkthrough"></div>';
  $('#view-thread').innerHTML='<div class="demo__heading"><strong data-thread-title></strong></div><div class="conversation" data-thread-history aria-label="Project conversation"></div>';
  $('.demo__preview').innerHTML='<div class="preview-page live-projects">'+projects.map(p=>`<iframe data-app="${p.id}" title="${p.name} working preview" src="assets/demo-projects/${p.id}/index.html" ${p!==current?'hidden':''}></iframe>`).join('')+'</div>';
  function indicator(p){return `<div class="greek-thinking"><img class="greek-thinking__mark" src="assets/olympus-thinking.svg" width="18" height="18" alt="" aria-hidden="true"><span>${p.label}&#8230;</span></div>`;}
  const conversations={
    'studio-site':[
      ['Can each project have its own personality?', 'Yes. Helios gets a sunny gold identity, Tide uses blue and a wave motif, and Olive & Earth has a soft green palette. Each has its own story in the case study.'],
      ['Keep the collection easy to browse on my phone.', 'The projects stack in one column, and the category buttons stay together above the work. There is no hover-only content, so everything opens with a tap.'],
      ['What happens when I close a case study?', 'You return to the same filtered collection. The dialog closes without navigating away or resetting the category you chose.']
    ],
    'notes-app':[
      ['If I edit a note and change my mind, can I back out?', 'Use Cancel edit. It clears the editor and leaves the saved note exactly as it was. Saving updates that note instead of making a second copy.'],
      ['I want my important ideas at the top.', 'Pin a note and it moves above the others. You can unpin it any time, and search still includes both pinned and unpinned notes.'],
      ['What if my search does not find anything?', 'You get a short message asking you to try another search. Clearing the search brings your notes back; it never deletes or changes them.']
    ],
    'weekend-project':[
      ['Can I add something for Sunday while looking at Saturday?', 'Yes. Choose Sunday in the form and add the activity. The planner switches to Sunday so you can see the new plan in the right place.'],
      ['I might finish something by mistake.', 'Tap Mark unfinished to undo it. The activity stays in the itinerary, its crossed-out title returns to normal, and the completion count updates.'],
      ['Keep the morning plans before the afternoon ones.', 'Every day is sorted by the time you chose. A new 09:00 activity appears before an 11:00 activity, even if you added it later.']
    ]
  };
  function transcript(p){return `<div class="terminal-request">&rsaquo; ${esc(p.request)}</div><div class="terminal-entry terminal-response"><strong><i></i>Olympus</strong><p>${esc(p.reply)}</p></div>${p.steps.map(([title,body])=>`<div class="terminal-entry"><strong><i></i>${esc(title)}</strong><p>${esc(body)}</p></div>`).join('')}<pre class="terminal-diff">${p.diff.map(line=>`<span class="added">${esc(line)}</span>`).join('')}</pre><div class="terminal-request">&rsaquo; ${esc(p.followup)}</div><div class="terminal-entry terminal-response"><strong><i></i>Olympus</strong><p>${esc(p.response)}</p></div>${conversations[p.id].map(([question,answer])=>`<div class="terminal-request">&rsaquo; ${esc(question)}</div><div class="terminal-entry terminal-response"><strong><i></i>Olympus</strong><p>${esc(answer)}</p></div>`).join('')}<div class="terminal-entry"><strong><i></i>Ready to try in the preview</strong><ul class="project-checks">${p.checks.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div><div class="terminal-entry terminal-response"><p>${esc(p.next)}</p></div>${indicator(p)}`;}
  async function renderCode(){const request=++codeRequest;const project=current;const file=selectedFile;$('#view-code').innerHTML=`<div class="demo__heading">${esc(project.id)} / ${esc(file)}<a href="assets/demo-projects/${project.id}/${file}" target="_blank" rel="noopener">Open file</a></div><pre class="code-editor">Loading source...</pre>`;try{const response=await fetch(`assets/demo-projects/${project.id}/${file}`);if(!response.ok)throw Error('Unavailable');const source=await response.text();if(request===codeRequest)$('#view-code .code-editor').textContent=source;}catch{if(request===codeRequest)$('#view-code .code-editor').textContent='Open the file using the link above to inspect the project source.';}}
  function render(){demo.querySelectorAll('[data-project]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.project===current.id)));demo.querySelectorAll('[data-file]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.file===selectedFile)));$('[data-project-title]').textContent=current.name;$('[data-thread-title]').textContent=current.name+' / Build conversation';const html=transcript(current);$('[data-agent-history]').innerHTML=html;$('[data-thread-history]').innerHTML=html;demo.querySelectorAll('[data-app]').forEach(frame=>frame.hidden=frame.dataset.app!==current.id);renderCode();}
  function syncAnimation(){demo.dataset.thinkingPaused=String(!visible||document.hidden);}
  demo.addEventListener('click',e=>{const button=e.target.closest('button');if(!button)return;if(button.dataset.project){current=projects.find(p=>p.id===button.dataset.project);render();}if(button.dataset.file){selectedFile=button.dataset.file;renderCode();demo.querySelectorAll('[data-file]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));$('#tab-code').click();}});
  if('IntersectionObserver' in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;syncAnimation();},{threshold:.01}).observe(demo);
  document.addEventListener('visibilitychange',syncAnimation);
  render();syncAnimation();
})();
