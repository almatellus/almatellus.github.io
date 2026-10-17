(function () {
  "use strict";

  const form = document.getElementById("ozx-verb-form");
  if (!form) return;
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
