(() => {
  const root = document.querySelector('[data-workspace-demo]');
  if (!root) return;
  root.querySelector('[data-add-agent]').hidden = false;
  const grid = root.querySelector('[data-agent-grid]');
  const count = root.querySelector('[data-agent-count]');
  const projectList = root.querySelector('[data-project-list]');
  const projects = ['studio-site', 'notes-app', 'weekend-project'];
  const prompts = { 'studio-site': 'What should the home page say first?', 'notes-app': 'How can I make search clearer?', 'weekend-project': 'Plan a useful Sunday view.' };
  const folderIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>';
  const searchIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></svg>';
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  let nextId = 3;
  let activeAgentId = null;
  let pickerPurpose = 'change';
  let returnFocus = null;
  const savedChats = [];
  const agents = [
    { id: 1, project: 'studio-site', messages: [{ role: 'agent', text: 'I can help shape the home page. Give me a task below.' }] },
    { id: 2, project: 'notes-app', messages: [{ role: 'agent', text: 'I can work on notes-app while the other agent handles studio-site.' }] }
  ];

  const dialog = document.createElement('dialog');
  dialog.className = 'workspace-picker';
  dialog.setAttribute('aria-labelledby', 'workspace-picker-title');
  dialog.innerHTML = `<div class="workspace-picker__head"><h2 id="workspace-picker-title">Change agent folder</h2>
    <p>Open this agent window in another example folder. A new conversation starts there; the previous conversation stays in its original project.</p>
    <label class="workspace-picker__search">${searchIcon}<input type="search" placeholder="Search projects" aria-label="Search projects" data-picker-search></label></div>
    <div class="workspace-picker__list" aria-label="Projects" data-picker-list></div>
    <div class="workspace-picker__footer"><button type="button" data-picker-add>+ Add example folder</button><button type="button" data-picker-cancel>Cancel</button></div>`;
  root.append(dialog);
  const search = dialog.querySelector('[data-picker-search]');
  const choices = dialog.querySelector('[data-picker-list]');
  const saved = document.createElement('section');
  saved.className = 'workspace-playground__saved';
  saved.setAttribute('aria-label', 'Saved example conversations');
  root.querySelector('.workspace-playground__layout').after(saved);

  function saveChat(agent) {
    savedChats.push({ ...agent, savedId: crypto.randomUUID(), messages: [...agent.messages] });
  }

  function renderProjects() {
    projectList.innerHTML = projects.map(project => `<span>${escape(project)}</span>`).join('');
  }
  function render() {
    const scrollPositions = new Map([...grid.querySelectorAll('[data-agent-id]')].map(node => [Number(node.dataset.agentId), node.querySelector('.workspace-playground__messages').scrollTop]));
    count.textContent = `${agents.length} agent window${agents.length === 1 ? '' : 's'}`;
    grid.innerHTML = agents.map(agent => `<article class="workspace-playground__agent" data-agent-id="${agent.id}" aria-label="Agent ${agent.id}, ${escape(agent.project)}">
      <header><span class="workspace-playground__dot" aria-hidden="true"></span><strong>${escape(agent.project)} · Agent ${agent.id}</strong><button type="button" data-close="${agent.id}" aria-label="Close Agent ${agent.id}">×</button></header>
      <div class="workspace-playground__messages" aria-live="polite" tabindex="0" aria-label="Conversation with Agent ${agent.id}">${agent.messages.map(message => `<p class="workspace-playground__message workspace-playground__message--${message.role}"><span>${message.role === 'you' ? 'You' : 'Agent'}</span>${escape(message.text)}</p>`).join('')}</div>
      <form data-send="${agent.id}"><label for="demo-prompt-${agent.id}">Give this agent a task</label><input id="demo-prompt-${agent.id}" name="task" value="${escape(agent.draft || '')}" placeholder="${escape(prompts[agent.project] || 'Give this agent a task...')}" required maxlength="180"><button type="submit">Send</button>
        <button class="workspace-playground__folder" type="button" data-folder="${agent.id}" aria-label="Change project folder for Agent ${agent.id}" title="Change project folder">${folderIcon}<span>${escape(agent.project)}</span></button></form>
    </article>`).join('');
    if (!agents.length) grid.innerHTML = '<p class="workspace-playground__empty">No agent windows open. Add an agent to start a conversation.</p>';
    grid.querySelectorAll('[data-agent-id]').forEach(node => { node.querySelector('.workspace-playground__messages').scrollTop = scrollPositions.get(Number(node.dataset.agentId)) || 0; });
    saved.hidden = !savedChats.length;
    saved.innerHTML = '<strong>Saved conversations for this visit</strong>' + savedChats.map(chat => `<button type="button" data-reopen="${chat.savedId}">Reopen ${escape(chat.project)} · Agent ${chat.id}</button>`).join('');
  }
  function renderChoices() {
    const agent = agents.find(item => item.id === activeAgentId);
    const query = search.value.trim().toLowerCase();
    const visible = projects.filter(project => project.toLowerCase().includes(query)).sort((a, b) => a === agent?.project ? -1 : b === agent?.project ? 1 : a.localeCompare(b));
    choices.innerHTML = visible.map(project => {
      const current = project === agent?.project;
      const agentCount = agents.filter(item => item.project === project).length;
      return `<button type="button" class="workspace-picker__choice${current ? ' is-current' : ''}" data-pick-project="${escape(project)}">
        <span class="workspace-picker__initial" aria-hidden="true">${escape(project.charAt(0).toUpperCase())}</span>
        <span class="workspace-picker__choice-body"><span class="workspace-picker__choice-title"><strong>${escape(project)}</strong>${current ? '<em>Current</em>' : ''}${agentCount ? `<small>${agentCount} agent${agentCount === 1 ? '' : 's'}</small>` : ''}</span><span class="workspace-picker__path">Example project folder</span></span>
        ${folderIcon}</button>`;
    }).join('') || `<p class="workspace-picker__empty">No projects match “${escape(search.value.trim())}”.</p>`;
  }
  function openPicker(button) {
    pickerPurpose = button.hasAttribute('data-add-agent') ? 'add' : 'change';
    activeAgentId = pickerPurpose === 'add' ? null : Number(button.dataset.folder);
    returnFocus = button;
    dialog.querySelector('h2').textContent = pickerPurpose === 'add' ? 'New agent' : 'Change agent folder';
    dialog.querySelector('.workspace-picker__head p').textContent = pickerPurpose === 'add'
      ? 'Pick the example folder this agent works in. Its conversation opens alongside the other agents.'
      : 'Open this agent window in another example folder. A new conversation starts there. You can reopen the previous conversation below the workspace during this visit.';
    search.value = '';
    renderChoices();
    dialog.showModal();
    search.focus();
  }

  root.addEventListener('click', event => {
    const add = event.target.closest('[data-add-agent]');
    if (add) { openPicker(add); return; }
    const close = event.target.closest('[data-close]');
    if (close) {
      const index = agents.findIndex(agent => agent.id === Number(close.dataset.close));
      if (index < 0) return;
      saveChat(agents[index]);
      agents.splice(index, 1);
      render();
      (grid.querySelector('[data-close]') || root.querySelector('[data-add-agent]')).focus();
    }
    const reopen = event.target.closest('[data-reopen]');
    if (reopen) {
      const index = savedChats.findIndex(chat => chat.savedId === reopen.dataset.reopen);
      if (index < 0) return;
      agents.push({ ...savedChats.splice(index, 1)[0], id: nextId++ });
      render();
      grid.lastElementChild.querySelector('input').focus();
    }
    const folder = event.target.closest('[data-folder]');
    if (folder) openPicker(folder);
  });
  root.addEventListener('input', event => {
    const form = event.target.closest('[data-send]');
    if (!form) return;
    const agent = agents.find(item => item.id === Number(form.dataset.send));
    if (agent) agent.draft = event.target.value;
  });
  root.addEventListener('submit', event => {
    const form = event.target.closest('[data-send]');
    if (!form) return;
    event.preventDefault();
    const agent = agents.find(item => item.id === Number(form.dataset.send));
    const task = form.elements.task.value.trim();
    if (!agent || !task) return;
    agent.messages.push({ role: 'you', text: task }, { role: 'agent', text: `I would work on “${task}” in ${agent.project}. In Olympus, this agent runs independently and you can follow the result here.` });
    agent.draft = '';
    render();
    const history = grid.querySelector(`[data-agent-id="${agent.id}"] .workspace-playground__messages`);
    history.scrollTop = history.scrollHeight;
    grid.querySelector(`[data-send="${agent.id}"] input`)?.focus();
  });
  search.addEventListener('input', renderChoices);
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && dialog.open) { event.preventDefault(); dialog.close(); }
  }, true);
  dialog.addEventListener('click', event => {
    if (event.target === dialog || event.target.closest('[data-picker-cancel]')) { dialog.close(); return; }
    if (event.target.closest('[data-picker-add]')) {
      const name = `example-project-${projects.length + 1}`;
      projects.push(name);
      search.value = name;
      renderProjects();
      renderChoices();
      choices.querySelector('button')?.focus();
      return;
    }
    const choice = event.target.closest('[data-pick-project]');
    if (!choice) return;
    if (pickerPurpose === 'add') {
      const agent = { id: nextId++, project: choice.dataset.pickProject, messages: [{ role: 'agent', text: 'Ready for a task in this project.' }] };
      agents.push(agent);
      render();
      returnFocus = grid.querySelector(`[data-send="${agent.id}"] input`);
      dialog.close();
      return;
    }
    const agent = agents.find(item => item.id === activeAgentId);
    if (agent && choice.dataset.pickProject !== agent.project) {
      saveChat(agent);
      agent.project = choice.dataset.pickProject;
      agent.draft = '';
      agent.messages = [{ role: 'agent', text: `Now working in ${agent.project}. This window has a fresh conversation for that folder.` }];
      render();
      returnFocus = grid.querySelector(`[data-folder="${agent.id}"]`);
    }
    dialog.close();
  });
  dialog.addEventListener('close', () => { returnFocus?.focus(); activeAgentId = null; });
  renderProjects();
  render();
})();
