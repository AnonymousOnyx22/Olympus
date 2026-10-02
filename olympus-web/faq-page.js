document.querySelector('.faq-search')?.addEventListener('submit', event => event.preventDefault());
(() => {
  const links = [...document.querySelectorAll('[data-faq-rail-link]')];
  const groups = [...document.querySelectorAll('.faq-group')];
  if (!links.length || !groups.length || !('IntersectionObserver' in window)) return;
  const byId = id => links.find(a => a.getAttribute('href') === `#${id}`);
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      links.forEach(a => a.classList.remove('is-active'));
      byId(entry.target.id)?.classList.add('is-active');
    });
  }, { rootMargin: '-15% 0px -70% 0px' });
  groups.forEach(group => observer.observe(group));
})();