(function () {
  "use strict";

  function initMenu() {
    const button = document.querySelector(".menu-toggle");
    const nav = document.querySelector(".site-nav");

    if (!button || !nav) return;

    function closeMenu() {
      nav.classList.remove("is-open");
      button.setAttribute("aria-expanded", "false");
      document.body.classList.remove("menu-open");
    }

    button.addEventListener("click", function () {
      const isOpen = nav.classList.toggle("is-open");
      button.setAttribute("aria-expanded", String(isOpen));
      document.body.classList.toggle("menu-open", isOpen);
    });

    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) closeMenu();
    });

    document.addEventListener("click", function (event) {
      if (!nav.contains(event.target) && !button.contains(event.target)) {
        closeMenu();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeMenu();
        button.focus();
      }
    });

    const desktopNavigation = window.matchMedia("(min-width: 1500px)");
    desktopNavigation.addEventListener("change", function (event) {
      if (event.matches) closeMenu();
    });
  }

  function getWebAppUrl() {
    const config = window.ALMA_TELLUS_CONFIG || {};
    return String(config.WEB_APP_URL || "").trim();
  }

  function initMemberForm() {
    const form = document.getElementById("socio-form");
    if (!form) return;
    const status = document.getElementById("form-status");
    const errors = document.getElementById("member-errors");
    const button = form.querySelector('button[type="submit"]');
    const type = document.getElementById("tipo-socio");
    const preview = document.getElementById("quota-preview");
    const fee = document.getElementById("quota-socio-hidden");
    const types = { ordinario: "Socio ordinario", sostenitore: "Socio sostenitore", benemerito: "Socio benemerito", under25: "Under 25", over70: "Over 70", ordinario_inaugurazione: "Socio ordinario", under25_inaugurazione: "Under 25", over70_inaugurazione: "Over 70" };
    const query = new URLSearchParams(window.location.search).get("tipo");
    if (types[query]) type.value = types[query];
    let pending = false;
    const campaign = "Campagna nuovi soci: 6 mesi gratuiti dalla data di ammissione. Nessun pagamento richiesto ora. Promemoria email prima della scadenza. Senza conferma, adesione terminata automaticamente senza costi né obblighi. In caso di pagamento anticipato, annualità dal termine dei sei mesi gratuiti.";
    function updateFee() {
      const option = type.options[type.selectedIndex];
      const amount = option && option.dataset.quota;
      fee.value = amount ? amount + " euro" : "";
      preview.textContent = amount ? "Oggi: 0 €. Se scegli di proseguire dopo i sei mesi gratuiti: " + amount + " €/anno." : "Scegli la categoria. Oggi non è richiesto alcun pagamento.";
    }
    type.addEventListener("change", updateFee);
    updateFee();
    function showErrors() {
      if (!errors) return;
      const invalid = Array.from(form.querySelectorAll("[required]")).filter(function (field) { return !field.validity.valid; });
      errors.replaceChildren();
      errors.hidden = invalid.length === 0;
      if (!invalid.length) return;
      const title = document.createElement("strong");
      title.textContent = "Completa o correggi questi campi obbligatori:";
      const list = document.createElement("ul");
      invalid.forEach(function (field) {
        const item = document.createElement("li");
        const link = document.createElement("a");
        link.href = "#" + field.id;
        link.textContent = field.dataset.label || field.name;
        link.addEventListener("click", function (event) { event.preventDefault(); field.focus(); });
        item.appendChild(link); list.appendChild(item);
      });
      errors.append(title, list);
    }
    form.addEventListener("invalid", function (event) {
      event.target.setAttribute("aria-invalid", "true");
      showErrors();
    }, true);
    form.addEventListener("input", function (event) {
      if (event.target.validity && event.target.validity.valid) event.target.removeAttribute("aria-invalid");
      if (errors && !errors.hidden) showErrors();
    });
    form.addEventListener("submit", function (event) {
      if (pending) { event.preventDefault(); return; }
      if (!form.reportValidity()) { event.preventDefault(); showErrors(); return; }
      if (form.elements.website && form.elements.website.value.trim()) { event.preventDefault(); return; }
      const endpoint = getWebAppUrl();
      if (!endpoint) {
        event.preventDefault();
        status.textContent = "Modulo momentaneamente non disponibile. Scrivi a info@almatellus.it.";
        status.classList.add("is-error"); return;
      }
      updateFee();
      // Standard cross-origin POST: Google renders the actual result after saving.
      // An opaque fetch response cannot confirm that the application was saved.
      form.action = endpoint;
      form.method = "post";
      const motivation = form.elements.motivazione;
      if (motivation && !motivation.value.startsWith(campaign)) motivation.value = campaign + (motivation.value.trim() ? "\n\n" + motivation.value.trim() : "");
      pending = true;
      button.disabled = true;
      button.textContent = "Invio in corso…";
      status.textContent = "Attendi l’esito della registrazione: sarai portato alla risposta dell’associazione.";
      form.setAttribute("aria-busy", "true");
      // Do not preventDefault: the browser submits the form and shows the real server response.
    });
    window.addEventListener("pageshow", function () {
      pending = false; button.disabled = false; button.textContent = "Invia richiesta";
      form.removeAttribute("aria-busy"); status.textContent = "";
      const motivation = form.elements.motivazione;
      if (motivation && motivation.value.startsWith(campaign)) motivation.value = motivation.value.slice(campaign.length).replace(/^\s+/, "");
    });
  }

  function initContactForm() {
    const form = document.getElementById("contact-form");
    const frame = document.getElementById("contact-frame");
    if (!form || !frame) return;

    const status = document.getElementById("contact-status");
    const submitButton = document.getElementById("contact-submit");
    const submittedAt = document.getElementById("submitted-at-client");
    const webAppUrl = getWebAppUrl();

    const contactTopic = new URLSearchParams(window.location.search).get("tema");
    const contactSubjects = {
      imprese: "Imprese e professionisti - Proposta di collaborazione",
      "sostegno-fiera": "Sostegno alla Maker Faire Rome 2026",
      benemerito: "Sostegno alla Maker Faire Rome 2026"
    };
    if (Object.prototype.hasOwnProperty.call(contactSubjects, contactTopic)) {
      form.elements.oggetto.value = contactSubjects[contactTopic];
      form.elements.oggetto.defaultValue = contactSubjects[contactTopic];
      form.elements.messaggio.placeholder =
        "Indica la tua società ed un referente.";
    }

    if (contactTopic === "sostegno-fiera" || contactTopic === "benemerito") {
      const heading = document.getElementById("contact-title");
      const intro = document.getElementById("contact-intro");
      if (heading) heading.textContent = "Il tuo contributo per la fiera";
      if (intro) {
        intro.textContent =
          "Puoi sostenere Alma Tellus alla Maker Faire Rome 2026 con un contributo economico, materiali in donazione o attrezzature e materiali in prestito.";
      }
    }

    let submitted = false;
    let completed = false;
    let timeoutId = null;

    if (webAppUrl) {
      form.action = webAppUrl;
    }

    function setStatus(message, isError) {
      status.textContent = message;
      status.classList.toggle("is-error", Boolean(isError));
    }

    function resetButton(text) {
      submitButton.disabled = false;
      submitButton.textContent = text || "Invia messaggio";
    }

    frame.addEventListener("load", function () {
      if (!submitted || completed) return;

      completed = true;
      window.clearTimeout(timeoutId);
      setStatus(
        "Messaggio inviato correttamente. Grazie, ti risponderemo appena possibile.",
        false
      );
      resetButton("Invia un altro messaggio");
      form.reset();
      submitted = false;
    });

    form.addEventListener("submit", function (event) {
      const name = form.elements.nome.value.trim();
      const email = form.elements.email.value.trim();
      const subject = form.elements.oggetto.value.trim();
      const message = form.elements.messaggio.value.trim();
      const privacy = form.elements.privacy.checked;
      const honeypot = form.elements.website.value.trim();

      if (honeypot) {
        event.preventDefault();
        setStatus("Messaggio inviato correttamente. Grazie.", false);
        form.reset();
        return;
      }

      if (!name || !email || !subject || !message || !privacy) {
        event.preventDefault();
        setStatus(
          "Compila tutti i campi obbligatori e conferma la presa visione privacy.",
          true
        );
        return;
      }

      if (!form.elements.email.checkValidity()) {
        event.preventDefault();
        setStatus("Inserisci un indirizzo email valido.", true);
        return;
      }

      if (message.length < 10) {
        event.preventDefault();
        setStatus("Il messaggio è troppo breve.", true);
        return;
      }

      if (!webAppUrl) {
        event.preventDefault();
        setStatus("Modulo momentaneamente non disponibile. Riprova più tardi.", true);
        return;
      }

      submittedAt.value = new Date().toISOString();
      submitted = true;
      completed = false;
      setStatus("Invio in corso...", false);
      submitButton.disabled = true;
      submitButton.textContent = "Invio in corso...";

      timeoutId = window.setTimeout(function () {
        if (completed) return;
        setStatus(
          "Non è stato possibile confermare l'invio. Riprova tra qualche minuto.",
          true
        );
        resetButton("Riprova invio");
        submitted = false;
      }, 15000);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initMenu();
    initMemberForm();
    initContactForm();
  });
})();
