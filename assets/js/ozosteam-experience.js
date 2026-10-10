(function () {
  "use strict";

  const joinLink = document.querySelector(".ozx-join");
  const promoCopy = document.getElementById("ozx-join-offer");
  const promoHref = joinLink.getAttribute("href");
  const regularHref = joinLink.dataset.regularHref;
  const promoEnds = Date.parse(joinLink.dataset.promoUntil);

  function updateJoinOffer() {
    const inPromotion = Date.now() < promoEnds;
    joinLink.setAttribute("href", inPromotion ? promoHref : regularHref);
    promoCopy.hidden = !inPromotion;
  }
  updateJoinOffer();
  joinLink.addEventListener("click", updateJoinOffer);

  const overlay = document.getElementById("ozx-audio");
  const opener = document.querySelector('[data-open="ozx-audio"]');
  const audios = Array.from(overlay.querySelectorAll("audio"));
  const dialog = overlay.querySelector('[role="dialog"]');
  const closer = overlay.querySelector(".ozx-close");

  function closeAudio() {
    audios.forEach(function (audio) { audio.pause(); });
    overlay.hidden = true;
    document.body.style.overflow = "";
    opener.focus();
  }
  opener.addEventListener("click", function () {
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    audios.forEach(function (audio) { if (audio.readyState === 0) audio.load(); });
    closer.focus();
  });
  closer.addEventListener("click", closeAudio);
  overlay.addEventListener("click", function (event) { if (event.target === overlay) closeAudio(); });
  audios.forEach(function (audio) {
    audio.addEventListener("error", function () {
      audio.closest(".ozx-audio-language").querySelector(".ozx-media-fallback").hidden = false;
    });
    audio.addEventListener("play", function () {
      audios.forEach(function (other) { if (other !== audio) other.pause(); });
    });
  });
  dialog.addEventListener("keydown", function (event) {
    if (event.key === "Escape") { event.preventDefault(); closeAudio(); }
    if (event.key !== "Tab") return;
    const controls = Array.from(dialog.querySelectorAll('button, audio[controls], a[href]')).filter(function (el) { return el.getClientRects().length; });
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  const form = document.getElementById("ozx-verb-form");
  const input = document.getElementById("ozx-verb");
  const button = form.querySelector('button[type="submit"]');
  const status = document.getElementById("ozx-status");
  let attempt = null;
  let pending = false;
  let timeoutId;

  function showError(message) {
    pending = false;
    clearTimeout(timeoutId);
    status.textContent = message;
    status.classList.add("is-error");
    button.disabled = false;
    button.textContent = "Riprova";
    form.removeAttribute("aria-busy");
  }
  function isGoogleScriptOrigin(origin) {
    try {
      const url = new URL(origin);
      return url.protocol === "https:" && (url.hostname === "script.google.com" || url.hostname === "script.googleusercontent.com" || url.hostname.endsWith("-script.googleusercontent.com") || url.hostname.endsWith(".script.googleusercontent.com"));
    } catch (error) { return false; }
  }
  window.addEventListener("message", function (event) {
    const result = event.data;
    if (!pending || !attempt || !isGoogleScriptOrigin(event.origin) || !result || result.type !== "ozosteam:verbo" || result.requestId !== attempt.id) return;
    if (result.saved !== true) { showError(result.message || "La proposta non è stata salvata. Riprova."); return; }
    pending = false;
    clearTimeout(timeoutId);
    status.classList.remove("is-error");
    status.textContent = "Grazie! «" + attempt.verb + "» è stato salvato.";
    form.removeAttribute("aria-busy");
    document.getElementById("ozx-verb-step").hidden = true;
    const joinStep = document.getElementById("ozx-join-step");
    updateJoinOffer();
    joinStep.hidden = false;
    joinStep.querySelector(".ozx-join").focus({ preventScroll: true });
  });
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (pending) return;
    const verb = input.value.trim().replace(/\s+/g, " ");
    input.value = verb;
    if (!form.reportValidity()) return;
    const config = window.ALMA_TELLUS_CONFIG || {};
    const endpoint = String(config.OZOSTEAM_VERBS_URL || config.WEB_APP_URL || "").trim();
    if (!endpoint || config.OZOSTEAM_VERBS_ENABLED !== true) { showError("La raccolta dei verbi è in attivazione. Riprova più tardi."); return; }
    if (navigator.onLine === false) { showError("Serve una connessione per salvare il tuo verbo. Riprova quando sei online."); return; }
    if (!attempt || attempt.verb !== verb) {
      const id = window.crypto && typeof window.crypto.randomUUID === "function" ? window.crypto.randomUUID() : "ozo-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
      attempt = { id: id, verb: verb };
    }
    document.getElementById("ozx-request-id").value = attempt.id;
    document.getElementById("ozx-source-page").value = window.location.pathname;
    form.action = endpoint;
    pending = true;
    status.classList.remove("is-error");
    status.textContent = "Sto salvando il tuo verbo…";
    button.disabled = true;
    button.textContent = "Invio…";
    form.setAttribute("aria-busy", "true");
    timeoutId = window.setTimeout(function () { showError("Non ho ricevuto conferma del salvataggio. Premi Riprova."); }, 25000);
    form.submit();
  });
})();
