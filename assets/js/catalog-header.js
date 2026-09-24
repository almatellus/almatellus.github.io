(() => {
  const button = document.querySelector('.catalog-menu-toggle');
  const nav = document.querySelector('.catalog-site-nav');
  if (!button || !nav) return;
  function close() {
    nav.classList.remove('is-open');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', 'Apri menu');
  }
  button.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Chiudi menu' : 'Apri menu');
  });
  nav.addEventListener('click', e => { if (e.target.closest('a')) close(); });
  document.addEventListener('click', e => { if (!e.target.closest('.catalog-site-header')) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
})();
