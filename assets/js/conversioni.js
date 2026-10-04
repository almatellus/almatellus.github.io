// Predisposizione: nessun tag Google caricato finché non è collegata una CMP.
(() => {
  const allowed = new Set(['membership_cta', 'b2b_cta', 'mfr_cta', 'membership_request_saved', 'b2b_request_saved']);
  const ids = new Set();
  window.almaTrack = function(event, requestId) {
    if (!allowed.has(event) || window.ALMA_MEASUREMENT_CONSENT !== true) return;
    if (event.endsWith('_saved')) {
      if (!requestId || ids.has(requestId)) return;
      ids.add(requestId);
    }
    window.dataLayer = window.dataLayer || [];
    // Nessun nome, email, testo del modulo o parametro libero.
    window.dataLayer.push({event, alma_path: location.pathname, ...(requestId ? {transaction_id: requestId} : {})});
  };
  document.addEventListener('click', e => {
    const link = e.target.closest('[data-alma-event]');
    if (link) window.almaTrack(link.dataset.almaEvent);
  });
})();
