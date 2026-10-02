(() => {
  const form = document.querySelector('.waitlist-form');
  if (!form) return;
  const button = form.querySelector('button[type="submit"]');
  const status = form.querySelector('.form-status');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (button.disabled) return;
    if (!form.reportValidity()) return;
    if (location.protocol === 'file:' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) || location.hostname.endsWith('.localhost')) {
      status.textContent = 'This is a local preview. Signups will open on the published website.';
      return;
    }
    button.disabled = true;
    form.setAttribute('aria-busy', 'true');
    status.textContent = 'Sending your signup…';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('/', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: controller.signal,
        body: new URLSearchParams(new FormData(form)).toString()
      });
      if (!response.ok) throw new Error('Signup failed');
      location.assign(form.getAttribute('action') || '/thanks');
    } catch {
      status.textContent = 'Your signup could not be sent. Please try again. Your email is still here.';
      button.disabled = false;
    } finally {
      clearTimeout(timeout);
      form.removeAttribute('aria-busy');
    }
  });
})();
