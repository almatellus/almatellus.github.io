(() => {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('b2b-form');
    if (!form) return;
    const status = document.getElementById('b2b-status');
    const button = form.querySelector('button[type=submit]');
    let pending = false, finished = false, timer;
    document.querySelectorAll('[data-interest]').forEach(a => a.addEventListener('click', () => {
      if (!pending && !finished) form.elements.interesse.value = a.dataset.interest;
    }));
    const originOK = origin => {
      try { const u = new URL(origin); return u.protocol === 'https:' &&
        (u.hostname === 'script.google.com' || u.hostname === 'script.googleusercontent.com' || u.hostname.endsWith('.script.googleusercontent.com')); }
      catch (_) { return false; }
    };
    window.addEventListener('message', e => {
      const r = e.data;
      if (!pending || !originOK(e.origin) || !r || r.type !== 'alma:b2b' || r.requestId !== form.elements.request_id.value) return;
      clearTimeout(timer); pending = false;
      if (r.sent === true) {
        finished = true;
        status.textContent = 'Proposta inviata ad Alma Tellus. Grazie, ti contatteremo per un primo confronto.';
        button.textContent = 'Proposta inviata';
        form.querySelectorAll('input,select,textarea').forEach(el => el.disabled = true);
        // Nessuna conversione registrata finché la misurazione non è attivata.
      } else {
        status.textContent = r.message || 'Invio non riuscito. Riprova più tardi.';
        button.disabled = r.uncertain === true;
        if (r.uncertain) button.textContent = 'Invio da verificare';
      }
    });
    form.addEventListener('submit', e => {
      if (pending || finished) { e.preventDefault(); return; }
      if (!form.reportValidity()) { e.preventDefault(); return; }
      if (form.elements.website.value) { e.preventDefault(); return; }
      const url = window.ALMA_TELLUS_CONFIG?.WEB_APP_URL;
      if (!url) { e.preventDefault(); status.textContent = 'Modulo non disponibile. Scrivi a info@almatellus.it.'; return; }
      if (!form.elements.request_id.value) form.elements.request_id.value = crypto.randomUUID();
      form.action = url; pending = true; button.disabled = true;
      status.textContent = 'Invio in corso…';
      timer = setTimeout(() => {
        if (!pending) return;
        status.textContent = 'Non è ancora arrivata la conferma. Per evitare duplicati, non ripetere l’invio. Se il problema persiste scrivi a info@almatellus.it indicando il riferimento ' + form.elements.request_id.value + '.';
      }, 45000);
    });
  });
})();
