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
    const submitButton = form.querySelector('button[type="submit"]');
    const memberType = document.getElementById("tipo-socio");
    const preview = document.getElementById("quota-preview");
    const hiddenFee = document.getElementById("quota-socio-hidden");

    const queryValue = new URLSearchParams(window.location.search).get("tipo");
    const typeMap = {
      ordinario: "Socio ordinario",
      sostenitore: "Socio sostenitore",
      benemerito: "Socio benemerito",
      familiare: "Familiare convivente",
      familiare_successivo: "Dal secondo familiare convivente in poi",
      under25: "Under 25",
      over70: "Over 70"
    };

    function updateFee() {
      if (!memberType || !preview || !hiddenFee) return;
      const option = memberType.options[memberType.selectedIndex];
      const fee = option ? option.dataset.quota : "";

      if (fee) {
        hiddenFee.value = fee + " euro";
        preview.textContent =
          "Quota selezionata: " + option.value + " - " + fee +
          " € annui. Validità: 12 mesi dal pagamento.";
      } else {
        hiddenFee.value = "";
        preview.textContent = "Seleziona una tipologia per visualizzare la quota.";
      }
    }

    if (memberType) {
      if (queryValue && typeMap[queryValue]) {
        memberType.value = typeMap[queryValue];
      }
      memberType.addEventListener("change", updateFee);
      updateFee();
    }

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      status.classList.remove("is-error");

      if (!form.reportValidity()) return;

      const honeypot = form.elements.website ? form.elements.website.value.trim() : "";
      if (honeypot) {
        window.location.href = "grazie.html";
        return;
      }

      const webAppUrl = getWebAppUrl();
      if (!webAppUrl) {
        status.textContent = "Modulo momentaneamente non disponibile. Riprova più tardi.";
        status.classList.add("is-error");
        return;
      }

      submitButton.disabled = true;
      status.textContent = "Invio in corso...";

      try {
        await fetch(webAppUrl, {
          method: "POST",
          mode: "no-cors",
          body: new FormData(form)
        });
        window.location.href = "grazie.html";
      } catch (error) {
        status.textContent = "Invio non riuscito. Riprova più tardi.";
        status.classList.add("is-error");
        submitButton.disabled = false;
      }
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
