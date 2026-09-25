(() => {
  const deck = document.getElementById('future-deck');
  const slides = [...deck.querySelectorAll('.future-slide')];
  const controls = document.querySelector('.future-controls');
  const counter = document.getElementById('future-counter');
  const previous = document.getElementById('future-prev');
  const next = document.getElementById('future-next');
  const exit = document.getElementById('future-exit');
  const start = document.querySelector('[data-start-presentation]');
  let active = 0;

  function update() {
    active = Math.max(0, Math.min(slides.length - 1, Math.round(deck.scrollTop / deck.clientHeight)));
    counter.textContent = `${String(active + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
    previous.disabled = active === 0;
    next.disabled = active === slides.length - 1;
  }
  function go(index) {
    slides[Math.max(0, Math.min(slides.length - 1, index))].scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function startPresentation() {
    document.body.classList.add('future-presenting');
    controls.hidden = false;
    deck.scrollTop = 0;
    update();
    next.focus();
  }
  function stopPresentation() {
    document.body.classList.remove('future-presenting');
    controls.hidden = true;
    slides[active].scrollIntoView({ block: 'start' });
    start.focus();
  }

  start.addEventListener('click', startPresentation);
  exit.addEventListener('click', stopPresentation);
  previous.addEventListener('click', () => go(active - 1));
  next.addEventListener('click', () => go(active + 1));
  deck.addEventListener('scroll', () => { if (document.body.classList.contains('future-presenting')) requestAnimationFrame(update); }, { passive: true });
  document.addEventListener('keydown', event => {
    if (!document.body.classList.contains('future-presenting')) return;
    if (event.key === 'Escape') { event.preventDefault(); stopPresentation(); return; }
    if (['ArrowRight', 'ArrowDown', 'PageDown'].includes(event.key) || (event.key === ' ' && event.target.tagName !== 'BUTTON')) { event.preventDefault(); go(active + 1); }
    if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key)) { event.preventDefault(); go(active - 1); }
  });
})();
