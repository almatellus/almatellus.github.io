const CONFIG = Object.freeze({
  TECH_EMAIL: "associazione.almatellus@gmail.com",
  OFFICIAL_EMAIL: "info@almatellus.it",
  FROM_NAME: "Associazione Alma Tellus",
  WEBSITE: "https://www.almatellus.it",
  SHEET_RICHIESTE: "Richieste adesione",
  SHEET_LIBRO: "Libro soci",
  SHEET_CONTATTI: "Contatti sito"
});

const HEADERS_RICHIESTE = [
  "ID richiesta",
  "Data richiesta",
  "Stato domanda",
  "Nome",
  "Cognome",
  "Codice fiscale",
  "Data di nascita",
  "Luogo di nascita",
  "Indirizzo",
  "Email",
  "Telefono",
  "Professione",
  "Motivazione",
  "Presa visione statuto",
  "Consenso privacy",
  "Richiesta adesione",
  "Data decisione",
  "Esito",
  "Riferimento verbale",
  "Note",
  "Invio mail associazione",
  "Data invio mail associazione",
  "Errore mail associazione",
  "Invio mail richiedente",
  "Data invio mail richiedente",
  "Errore mail richiedente"
];

const HEADERS_LIBRO_SOCI = [
  "Numero socio",
  "Data ammissione",
  "Nome",
  "Cognome",
  "Codice fiscale",
  "Data di nascita",
  "Luogo di nascita",
  "Indirizzo",
  "Email",
  "Telefono",
  "Professione",
  "Quota anno",
  "Quota versata",
  "Stato socio",
  "Data cessazione",
  "Motivo cessazione",
  "Riferimento verbale",
  "Note"
];

const HEADERS_CONTATTI = [
  "ID messaggio",
  "Data messaggio",
  "Nome",
  "Email",
  "Telefono",
  "Oggetto",
  "Messaggio",
  "Consenso privacy",
  "Stato",
  "Invio mail associazione",
  "Data invio mail associazione",
  "Errore mail associazione",
  "Invio conferma mittente",
  "Data invio conferma mittente",
  "Errore conferma mittente"
];

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const richieste = getOrCreateSheet_(ss, CONFIG.SHEET_RICHIESTE);
  prepareHeader_(richieste, HEADERS_RICHIESTE);

  const libro = getOrCreateSheet_(ss, CONFIG.SHEET_LIBRO);
  prepareHeader_(libro, HEADERS_LIBRO_SOCI);

  const contatti = getOrCreateSheet_(ss, CONFIG.SHEET_CONTATTI);
  prepareHeader_(contatti, HEADERS_CONTATTI);
}

function doGet() {
  return htmlOutput_(`
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <title>Alma Tellus</title>
      <style>
        body { font-family: Arial, sans-serif; background: #f6f3ec; color: #0e2a3a; padding: 40px; text-align: center; }
        .box { background: #ffffff; max-width: 560px; margin: 0 auto; padding: 32px; border-radius: 20px; box-shadow: 0 20px 50px rgba(14, 42, 58, 0.12); }
      </style>
    </head>
    <body>
      <div class="box">
        <h1>Associazione Alma Tellus</h1>
        <p>Web App attiva.</p>
        <p>Per comunicazioni: <strong>${esc_(CONFIG.OFFICIAL_EMAIL)}</strong></p>
      </div>
    </body>
    </html>
  `);
}

function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);
    const p = e.parameter || {};

    if (p.website) {
      return successPage_("Richiesta ricevuta.");
    }

    if (String(p.form_type || "").toLowerCase() === "contatto") {
      return handleContactPost_(p);
    }

    return handleMembershipPost_(p);

  } catch (err) {
    console.error(err);
    return errorPage_("Si è verificato un errore durante l’invio. Riprovare più tardi.");
  } finally {
    try {
      lock.releaseLock();
    } catch (err) {
      console.error("Lock release error: " + err);
    }
  }
}

function handleMembershipPost_(p) {
  const required = [
    "nome",
    "cognome",
    "codice_fiscale",
    "data_nascita",
    "luogo_nascita",
    "indirizzo",
    "email",
    "presa_visione_statuto",
    "privacy",
    "richiesta_adesione"
  ];

  const missing = required.filter(name => !String(p[name] || "").trim());

  if (missing.length > 0) {
    return errorPage_("Alcuni campi obbligatori non risultano compilati.");
  }

  const email = clean_(p.email).toLowerCase();
  const codiceFiscale = normalizeFiscalCode_(p.codice_fiscale);

  if (!isValidEmail_(email)) {
    return errorPage_("L’indirizzo email inserito non è formalmente valido.");
  }

  if (!codiceFiscale) {
    return errorPage_("Il codice fiscale non risulta compilato correttamente.");
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sheetRichieste = getOrCreateSheet_(ss, CONFIG.SHEET_RICHIESTE);
  prepareHeader_(sheetRichieste, HEADERS_RICHIESTE);

  const sheetLibro = getOrCreateSheet_(ss, CONFIG.SHEET_LIBRO);
  prepareHeader_(sheetLibro, HEADERS_LIBRO_SOCI);

  const duplicate = findExistingPosition_(sheetRichieste, sheetLibro, codiceFiscale);

  if (duplicate) {
    return warningPage_(duplicate.message, duplicate.title);
  }

  const idRichiesta = Utilities.getUuid();
  const now = new Date();

  const row = [
    idRichiesta,
    now,
    "Ricevuta",
    clean_(p.nome),
    clean_(p.cognome),
    codiceFiscale,
    clean_(p.data_nascita),
    clean_(p.luogo_nascita),
    clean_(p.indirizzo),
    email,
    clean_(p.telefono),
    clean_(p.professione),
    clean_(p.motivazione),
    yesNo_(p.presa_visione_statuto),
    yesNo_(p.privacy),
    yesNo_(p.richiesta_adesione),
    "",
    "",
    "",
    "",
    "DA INVIARE",
    "",
    "",
    "DA INVIARE",
    "",
    ""
  ];

  sheetRichieste.appendRow(row);
  SpreadsheetApp.flush();

  const rowIndex = sheetRichieste.getLastRow();

  const internalResult = trySendInternalNotification_(p, idRichiesta, email, codiceFiscale);
  const applicantResult = trySendApplicantConfirmation_(p, idRichiesta, email);

  updateMailLog_(sheetRichieste, rowIndex, internalResult, applicantResult);

  if (internalResult.status === "ERRORE" || applicantResult.status === "ERRORE") {
    return warningPage_(
      "La richiesta è stata registrata, ma una o più email non sono state inviate correttamente. L’associazione verificherà i dettagli.",
      "Richiesta registrata"
    );
  }

  return successPage_("La richiesta di adesione è stata ricevuta correttamente.");
}

function handleContactPost_(p) {
  const required = ["nome", "email", "oggetto", "messaggio", "privacy_contatti"];
  const missing = required.filter(name => !String(p[name] || "").trim());

  if (missing.length > 0) {
    return errorPage_("Alcuni campi obbligatori non risultano compilati.");
  }

  const email = clean_(p.email).toLowerCase();

  if (!isValidEmail_(email)) {
    return errorPage_("L’indirizzo email inserito non è formalmente valido.");
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet_(ss, CONFIG.SHEET_CONTATTI);
  prepareHeader_(sheet, HEADERS_CONTATTI);

  const idMessaggio = Utilities.getUuid();
  const now = new Date();

  const row = [
    idMessaggio,
    now,
    clean_(p.nome),
    email,
    clean_(p.telefono),
    clean_(p.oggetto),
    clean_(p.messaggio),
    yesNo_(p.privacy_contatti),
    "Ricevuto",
    "DA INVIARE",
    "",
    "",
    "DA INVIARE",
    "",
    ""
  ];

  sheet.appendRow(row);
  SpreadsheetApp.flush();
  const rowIndex = sheet.getLastRow();

  const internalResult = trySendContactInternalNotification_(p, idMessaggio, email);
  const senderResult = trySendContactConfirmation_(p, idMessaggio, email);

  updateContactMailLog_(sheet, rowIndex, internalResult, senderResult);

  if (internalResult.status === "ERRORE" || senderResult.status === "ERRORE") {
    return warningPage_(
      "Il messaggio è stato registrato, ma una o più email non sono state inviate correttamente. L’associazione verificherà i dettagli.",
      "Messaggio registrato"
    );
  }

  return successPage_("Il messaggio è stato inviato correttamente.");
}

function trySendInternalNotification_(p, idRichiesta, email, codiceFiscale) {
  try {
    sendInternalNotification_(p, idRichiesta, email, codiceFiscale);
    const found = verifySentInGmail_(CONFIG.TECH_EMAIL, idRichiesta);

    if (found) {
      return { status: "OK - presente in Inviati", date: new Date(), error: "" };
    }

    return {
      status: "OK invio - non trovato in Inviati",
      date: new Date(),
      error: "GmailApp non ha restituito errore, ma il messaggio interno non è stato trovato in Inviati dopo il controllo."
    };
  } catch (err) {
    return { status: "ERRORE", date: new Date(), error: String(err && err.message ? err.message : err) };
  }
}

function trySendApplicantConfirmation_(p, idRichiesta, email) {
  try {
    sendApplicantConfirmation_(p, idRichiesta, email);
    const found = verifySentInGmail_(email, idRichiesta);

    if (found) {
      return { status: "OK - presente in Inviati", date: new Date(), error: "" };
    }

    return {
      status: "OK invio - non trovato in Inviati",
      date: new Date(),
      error: "GmailApp non ha restituito errore, ma il messaggio al richiedente non è stato trovato in Inviati dopo il controllo."
    };
  } catch (err) {
    return { status: "ERRORE", date: new Date(), error: String(err && err.message ? err.message : err) };
  }
}

function sendInternalNotification_(p, idRichiesta, email, codiceFiscale) {
  const nome = clean_(p.nome);
  const cognome = clean_(p.cognome);
  const subject = `Nuova richiesta di adesione - ${nome} ${cognome}`;

  const plainBody =
    `È stata ricevuta una nuova richiesta di adesione ad Alma Tellus.\n\n` +
    `ID richiesta: ${idRichiesta}\n` +
    `Nome: ${nome} ${cognome}\n` +
    `Codice fiscale: ${codiceFiscale}\n` +
    `Data di nascita: ${clean_(p.data_nascita)}\n` +
    `Luogo di nascita: ${clean_(p.luogo_nascita)}\n` +
    `Indirizzo: ${clean_(p.indirizzo)}\n` +
    `Email: ${email}\n` +
    `Telefono: ${clean_(p.telefono)}\n` +
    `Professione: ${clean_(p.professione)}\n` +
    `Motivazione: ${clean_(p.motivazione)}\n\n` +
    `La richiesta è stata registrata nel foglio "${CONFIG.SHEET_RICHIESTE}".`;

  const htmlBody = `
    <p>È stata ricevuta una nuova richiesta di adesione ad <strong>Alma Tellus</strong>.</p>
    <p><strong>ID richiesta:</strong> ${esc_(idRichiesta)}</p>
    <table cellpadding="6" cellspacing="0" border="0">
      <tr><td><strong>Nome:</strong></td><td>${esc_(nome)} ${esc_(cognome)}</td></tr>
      <tr><td><strong>Codice fiscale:</strong></td><td>${esc_(codiceFiscale)}</td></tr>
      <tr><td><strong>Data di nascita:</strong></td><td>${esc_(p.data_nascita)}</td></tr>
      <tr><td><strong>Luogo di nascita:</strong></td><td>${esc_(p.luogo_nascita)}</td></tr>
      <tr><td><strong>Indirizzo:</strong></td><td>${esc_(p.indirizzo)}</td></tr>
      <tr><td><strong>Email:</strong></td><td>${esc_(email)}</td></tr>
      <tr><td><strong>Telefono:</strong></td><td>${esc_(p.telefono)}</td></tr>
      <tr><td><strong>Professione:</strong></td><td>${esc_(p.professione)}</td></tr>
    </table>
    <p><strong>Motivazione:</strong><br>${esc_(p.motivazione)}</p>
    <p>La richiesta è stata registrata nel foglio <strong>${esc_(CONFIG.SHEET_RICHIESTE)}</strong>.</p>
  `;

  GmailApp.sendEmail(CONFIG.TECH_EMAIL, subject, plainBody, {
    htmlBody: htmlBody,
    name: CONFIG.FROM_NAME,
    from: CONFIG.OFFICIAL_EMAIL,
    replyTo: email
  });
}

function sendApplicantConfirmation_(p, idRichiesta, email) {
  const nome = clean_(p.nome);
  const cognome = clean_(p.cognome);
  const subject = "Richiesta di adesione ricevuta - Alma Tellus";

  const plainBody =
    `Gentile ${nome} ${cognome},\n\n` +
    `la tua richiesta di adesione all’Associazione Alma Tellus è stata ricevuta correttamente.\n\n` +
    `ID richiesta: ${idRichiesta}\n\n` +
    `La domanda sarà valutata secondo quanto previsto dallo Statuto dell’Associazione. ` +
    `L’invio della richiesta non comporta automatica ammissione a socio.\n\n` +
    `Riceverai successiva comunicazione sull’esito della valutazione.\n\n` +
    `Per comunicazioni puoi rispondere a questa email oppure scrivere a ${CONFIG.OFFICIAL_EMAIL}.\n\n` +
    `Cordiali saluti,\n` +
    `Associazione Alma Tellus\n` +
    `${CONFIG.OFFICIAL_EMAIL}\n` +
    `${CONFIG.WEBSITE}`;

  const htmlBody = `
    <p>Gentile ${esc_(nome)} ${esc_(cognome)},</p>
    <p>la tua richiesta di adesione all’<strong>Associazione Alma Tellus</strong> è stata ricevuta correttamente.</p>
    <p><strong>ID richiesta:</strong> ${esc_(idRichiesta)}</p>
    <p>La domanda sarà valutata secondo quanto previsto dallo Statuto dell’Associazione. L’invio della richiesta non comporta automatica ammissione a socio.</p>
    <p>Riceverai successiva comunicazione sull’esito della valutazione.</p>
    <p>Per comunicazioni puoi rispondere a questa email oppure scrivere a <strong>${esc_(CONFIG.OFFICIAL_EMAIL)}</strong>.</p>
    <p>Cordiali saluti,<br>
    <strong>Associazione Alma Tellus</strong><br>
    ${esc_(CONFIG.OFFICIAL_EMAIL)}<br>
    ${esc_(CONFIG.WEBSITE)}</p>
  `;

  GmailApp.sendEmail(email, subject, plainBody, {
    htmlBody: htmlBody,
    name: CONFIG.FROM_NAME,
    from: CONFIG.OFFICIAL_EMAIL,
    replyTo: CONFIG.OFFICIAL_EMAIL
  });
}

function trySendContactInternalNotification_(p, idMessaggio, email) {
  try {
    sendContactInternalNotification_(p, idMessaggio, email);
    return { status: "OK", date: new Date(), error: "" };
  } catch (err) {
    return { status: "ERRORE", date: new Date(), error: String(err && err.message ? err.message : err) };
  }
}

function trySendContactConfirmation_(p, idMessaggio, email) {
  try {
    sendContactConfirmation_(p, idMessaggio, email);
    return { status: "OK", date: new Date(), error: "" };
  } catch (err) {
    return { status: "ERRORE", date: new Date(), error: String(err && err.message ? err.message : err) };
  }
}

function sendContactInternalNotification_(p, idMessaggio, email) {
  const nome = clean_(p.nome);
  const oggetto = clean_(p.oggetto);
  const subject = `Nuovo messaggio dal sito - ${oggetto}`;

  const plainBody =
    `È stato ricevuto un nuovo messaggio dal sito Alma Tellus.\n\n` +
    `ID messaggio: ${idMessaggio}\n` +
    `Nome: ${nome}\n` +
    `Email: ${email}\n` +
    `Telefono: ${clean_(p.telefono)}\n` +
    `Oggetto: ${oggetto}\n\n` +
    `Messaggio:\n${clean_(p.messaggio)}\n\n` +
    `Il messaggio è stato registrato nel foglio "${CONFIG.SHEET_CONTATTI}".`;

  const htmlBody = `
    <p>È stato ricevuto un nuovo messaggio dal sito <strong>Alma Tellus</strong>.</p>
    <p><strong>ID messaggio:</strong> ${esc_(idMessaggio)}</p>
    <table cellpadding="6" cellspacing="0" border="0">
      <tr><td><strong>Nome:</strong></td><td>${esc_(nome)}</td></tr>
      <tr><td><strong>Email:</strong></td><td>${esc_(email)}</td></tr>
      <tr><td><strong>Telefono:</strong></td><td>${esc_(p.telefono)}</td></tr>
      <tr><td><strong>Oggetto:</strong></td><td>${esc_(oggetto)}</td></tr>
    </table>
    <p><strong>Messaggio:</strong><br>${esc_(p.messaggio)}</p>
    <p>Il messaggio è stato registrato nel foglio <strong>${esc_(CONFIG.SHEET_CONTATTI)}</strong>.</p>
  `;

  GmailApp.sendEmail(CONFIG.TECH_EMAIL, subject, plainBody, {
    htmlBody: htmlBody,
    name: CONFIG.FROM_NAME,
    from: CONFIG.OFFICIAL_EMAIL,
    replyTo: email
  });
}

function sendContactConfirmation_(p, idMessaggio, email) {
  const nome = clean_(p.nome);
  const subject = "Messaggio ricevuto - Alma Tellus";

  const plainBody =
    `Gentile ${nome},\n\n` +
    `il tuo messaggio è stato ricevuto correttamente dall’Associazione Alma Tellus.\n\n` +
    `ID messaggio: ${idMessaggio}\n\n` +
    `Ti risponderemo appena possibile.\n\n` +
    `Cordiali saluti,\n` +
    `Associazione Alma Tellus\n` +
    `${CONFIG.OFFICIAL_EMAIL}\n` +
    `${CONFIG.WEBSITE}`;

  const htmlBody = `
    <p>Gentile ${esc_(nome)},</p>
    <p>il tuo messaggio è stato ricevuto correttamente dall’<strong>Associazione Alma Tellus</strong>.</p>
    <p><strong>ID messaggio:</strong> ${esc_(idMessaggio)}</p>
    <p>Ti risponderemo appena possibile.</p>
    <p>Cordiali saluti,<br>
    <strong>Associazione Alma Tellus</strong><br>
    ${esc_(CONFIG.OFFICIAL_EMAIL)}<br>
    ${esc_(CONFIG.WEBSITE)}</p>
  `;

  GmailApp.sendEmail(email, subject, plainBody, {
    htmlBody: htmlBody,
    name: CONFIG.FROM_NAME,
    from: CONFIG.OFFICIAL_EMAIL,
    replyTo: CONFIG.OFFICIAL_EMAIL
  });
}

function verifySentInGmail_(recipient, idRichiesta) {
  try {
    Utilities.sleep(2500);
    const safeRecipient = String(recipient || "").trim();
    const safeId = String(idRichiesta || "").trim();

    if (!safeRecipient || !safeId) {
      return false;
    }

    const query = `in:sent to:${safeRecipient} "${safeId}"`;
    const threads = GmailApp.search(query, 0, 5);
    return threads && threads.length > 0;
  } catch (err) {
    console.error("Sent mail verification error: " + err);
    return false;
  }
}

function updateMailLog_(sheet, rowIndex, internalResult, applicantResult) {
  const startCol = HEADERS_RICHIESTE.indexOf("Invio mail associazione") + 1;
  sheet.getRange(rowIndex, startCol, 1, 6).setValues([[
    internalResult.status,
    internalResult.date,
    internalResult.error,
    applicantResult.status,
    applicantResult.date,
    applicantResult.error
  ]]);
}

function updateContactMailLog_(sheet, rowIndex, internalResult, senderResult) {
  const startCol = HEADERS_CONTATTI.indexOf("Invio mail associazione") + 1;
  sheet.getRange(rowIndex, startCol, 1, 6).setValues([[
    internalResult.status,
    internalResult.date,
    internalResult.error,
    senderResult.status,
    senderResult.date,
    senderResult.error
  ]]);
}

function findExistingPosition_(sheetRichieste, sheetLibro, codiceFiscale) {
  const cf = normalizeFiscalCode_(codiceFiscale);
  const libroRows = getDataRows_(sheetLibro, HEADERS_LIBRO_SOCI.length);
  const libroMap = arrayHeaderMap_(HEADERS_LIBRO_SOCI);

  for (let i = libroRows.length - 1; i >= 0; i--) {
    const row = libroRows[i];
    const rowCf = normalizeFiscalCode_(row[libroMap["Codice fiscale"]]);

    if (rowCf === cf) {
      const statoSocio = clean_(row[libroMap["Stato socio"]]);
      const numeroSocio = clean_(row[libroMap["Numero socio"]]);

      if (!isClosedMemberStatus_(statoSocio)) {
        return {
          title: "Richiesta non inserita",
          message:
            `Risulta già presente un socio con questo codice fiscale` +
            `${numeroSocio ? " con numero socio " + esc_(numeroSocio) : ""}. ` +
            `Per chiarimenti scrivere a ${CONFIG.OFFICIAL_EMAIL}.`
        };
      }
    }
  }

  const richiesteRows = getDataRows_(sheetRichieste, HEADERS_RICHIESTE.length);
  const richiesteMap = arrayHeaderMap_(HEADERS_RICHIESTE);

  for (let i = richiesteRows.length - 1; i >= 0; i--) {
    const row = richiesteRows[i];
    const rowCf = normalizeFiscalCode_(row[richiesteMap["Codice fiscale"]]);

    if (rowCf === cf) {
      const idRichiesta = clean_(row[richiesteMap["ID richiesta"]]);
      const statoDomanda = clean_(row[richiesteMap["Stato domanda"]]);
      const esito = clean_(row[richiesteMap["Esito"]]);

      if (!isClosedRequestStatus_(statoDomanda, esito)) {
        return {
          title: "Richiesta già presente",
          message:
            `Risulta già presente una richiesta di adesione con questo codice fiscale. ` +
            `ID richiesta: ${idRichiesta}. ` +
            `Per chiarimenti scrivere a ${CONFIG.OFFICIAL_EMAIL}.`
        };
      }
    }
  }

  return null;
}

function isClosedMemberStatus_(status) {
  const s = normalizeText_(status);
  if (!s) {
    return false;
  }

  const closedStatuses = ["CESSATO", "DIMESSO", "ESCLUSO", "RECESSO", "DECADUTO", "DECEDUTO"];
  return closedStatuses.some(item => s.includes(item));
}

function isClosedRequestStatus_(statoDomanda, esito) {
  const s = normalizeText_(statoDomanda + " " + esito);
  if (!s) {
    return false;
  }

  const closedWords = ["RESPINT", "ANNULLAT", "RITIRAT", "ARCHIVIAT", "NON AMMESS", "DINIEG"];
  return closedWords.some(item => s.includes(item));
}

function testInvioAliasInfo() {
  GmailApp.sendEmail(
    CONFIG.TECH_EMAIL,
    "Test invio da info@almatellus.it - Alma Tellus",
    "Se ricevi questa email, l’alias info@almatellus.it è configurato correttamente in GmailApp.",
    {
      name: CONFIG.FROM_NAME,
      from: CONFIG.OFFICIAL_EMAIL,
      replyTo: CONFIG.OFFICIAL_EMAIL
    }
  );
}

function testAutorizzazioneGmail() {
  testInvioAliasInfo();
}

function htmlOutput_(html) {
  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getOrCreateSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function prepareHeader_(sheet, headers) {
  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

function getDataRows_(sheet, width) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return [];
  }
  return sheet.getRange(2, 1, lastRow - 1, width).getValues();
}

function arrayHeaderMap_(headers) {
  const map = {};
  headers.forEach((header, index) => {
    map[header] = index;
  });
  return map;
}

function clean_(value) {
  return String(value || "").trim();
}

function normalizeFiscalCode_(value) {
  return clean_(value).toUpperCase().replace(/\s+/g, "");
}

function normalizeText_(value) {
  return clean_(value)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function esc_(value) {
  return clean_(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function yesNo_(value) {
  return value ? "Sì" : "No";
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || "").trim());
}

function successPage_(message) {
  return htmlOutput_(`
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Richiesta ricevuta</title>
      <style>
        body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f6f3ec; color: #0e2a3a; font-family: Arial, sans-serif; text-align: center; padding: 24px; }
        .box { max-width: 620px; background: white; border-radius: 24px; padding: 36px; box-shadow: 0 20px 50px rgba(14, 42, 58, 0.12); }
        .line { width: 72px; height: 3px; background: #c8a15a; margin: 18px auto; }
        .small { color: #49606c; font-size: 14px; margin-top: 24px; }
      </style>
    </head>
    <body>
      <div class="box">
        <h1>${esc_(message)}</h1>
        <div class="line"></div>
        <p>Grazie. Riceverai comunicazione dall’Associazione.</p>
        <p class="small">Per comunicazioni: ${esc_(CONFIG.OFFICIAL_EMAIL)}</p>
      </div>
    </body>
    </html>
  `);
}

function warningPage_(message, title) {
  const safeTitle = title || "Richiesta registrata";
  return htmlOutput_(`
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${esc_(safeTitle)}</title>
      <style>
        body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f6f3ec; color: #0e2a3a; font-family: Arial, sans-serif; text-align: center; padding: 24px; }
        .box { max-width: 620px; background: white; border-radius: 24px; padding: 36px; box-shadow: 0 20px 50px rgba(14, 42, 58, 0.12); }
        .line { width: 72px; height: 3px; background: #c8a15a; margin: 18px auto; }
      </style>
    </head>
    <body>
      <div class="box">
        <h1>${esc_(safeTitle)}</h1>
        <div class="line"></div>
        <p>${esc_(message)}</p>
      </div>
    </body>
    </html>
  `);
}

function errorPage_(message) {
  return htmlOutput_(`
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Errore</title>
      <style>
        body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f6f3ec; color: #0e2a3a; font-family: Arial, sans-serif; text-align: center; padding: 24px; }
        .box { max-width: 620px; background: white; border-radius: 24px; padding: 36px; box-shadow: 0 20px 50px rgba(14, 42, 58, 0.12); }
        .line { width: 72px; height: 3px; background: #c8a15a; margin: 18px auto; }
      </style>
    </head>
    <body>
      <div class="box">
        <h1>Invio non completato</h1>
        <div class="line"></div>
        <p>${esc_(message)}</p>
      </div>
    </body>
    </html>
  `);
}
