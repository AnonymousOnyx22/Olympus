
// The showcase panels are the product's own controls, not decoration. A tool row opens, the
// view tabs swap, and an approval is a real answer with a real outcome. With scripting off
// the panels still read: the first view is marked as shown in the markup, and the approval
// simply does nothing.
(function () {
  // tool rows
  for (const row of document.querySelectorAll('.walk .row')) {
    row.addEventListener('click', function () {
      row.setAttribute('aria-expanded', row.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
    });
  }

  // approvals
  function settle(gate, allowed) {
    gate.style.background = allowed ? 'rgba(62,207,114,.10)' : 'rgba(255,255,255,.03)';
    gate.style.borderColor = allowed ? 'rgba(62,207,114,.42)' : '#3a3a44';
    const p = gate.querySelector('p');
    if (p) p.innerHTML = allowed
      ? '<strong>Written to disk.</strong> The agent carries on from here.'
      : '<strong>Refused.</strong> Nothing was written.';
    for (const b of gate.querySelectorAll('button')) b.remove();
  }
  for (const btn of document.querySelectorAll('[data-approve]')) {
    btn.addEventListener('click', function () { const g = btn.closest('.gate'); if (g) settle(g, true); });
  }
  for (const btn of document.querySelectorAll('[data-deny]')) {
    btn.addEventListener('click', function () { const g = btn.closest('.gate'); if (g) settle(g, false); });
  }

  // the view switcher
  for (const group of document.querySelectorAll('[data-views]')) {
    const tabs = [].slice.call(group.querySelectorAll('[role="tab"]'));
    const panels = [].slice.call(document.querySelectorAll('[data-panel]'));
    const show = (name) => {
      for (const t of tabs) {
        const on = t.getAttribute('data-view') === name;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
      }
      for (const p of panels) {
        if (p.getAttribute('data-panel') === name) p.setAttribute('data-shown', '');
        else p.removeAttribute('data-shown');
      }
    };
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { show(tab.getAttribute('data-view')); });
      tab.addEventListener('keydown', function (e) {
        // Left and right step through the tabs, which is what a tablist is expected to do.
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const n = e.key === 'ArrowRight' ? (i + 1) % tabs.length : (i - 1 + tabs.length) % tabs.length;
        tabs[n].focus();
        show(tabs[n].getAttribute('data-view'));
      });
    });
  }
}());
