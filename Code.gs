const CONFIG = Object.freeze({
  TECH_EMAIL: "associazione.almatellus@gmail.com",
  OFFICIAL_EMAIL: "info@almatellus.it",
  FROM_NAME: "Associazione Alma Tellus",
  WEBSITE: "https://www.almatellus.it",
  SHEET_RICHIESTE: "Richieste adesione",
  SHEET_LIBRO: "Libro soci",
  SHEET_CONTATTI: "Contatti sito",
  CONTACT_NOTIFY_EMAIL: "associazione.almatellus@gmail.com"
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
  "Tipo socio",
  "Quota prevista",
  "Validità tessera",
  "Modalità pagamento prevista",
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
  "Tipo socio",
  "Quota prevista",
  "Quota versata",
  "Data pagamento quota",
  "Scadenza tessera",
  "Stato socio",
  "Data cessazione",
  "Motivo cessazione",
  "Riferimento verbale",
  "Note"
];

const HEADERS_CONTATTI = [
  "ID contatto",
  "Data invio",
  "Nome",
  "Email",
  "Oggetto",
  "Messaggio",
  "Consenso privacy",
  "Invio mail associazione",
  "Data invio mail associazione",
  "Errore mail associazione",
  "Invio mail mittente",
  "Data invio mail mittente",
  "Errore mail mittente"
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
        body {
          font-family: Arial, sans-serif;
          background: #f6f3ec;
          color: #0e2a3a;
          padding: 40px;
          text-align: center;
        }
        .box {
          background: #ffffff;
          max-width: 560px;
          margin: 0 auto;
          padding: 32px;
          border-radius: 20px;
          box-shadow: 0 20px 50px rgba(14, 42, 58, 0.12);
        }
      </style>
    </head>
    <body>
      <div class="box">
        <h1>Associazione Alma Tellus</h1>
        <p>Web App attiva.</p>
      </div>
    </body>
    </html>
  `);
}

function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    const p = e && e.parameter ? e.parameter : {};

    // Honeypot anti-spam field. If a bot fills this hidden field, return a generic success.
    if (p.website) {
      return successPage_("Messaggio ricevuto.", "Grazie.");
    }

    if (isContactForm_(p)) {
      return handleContactPost_(p);
    }

    return handleMemberRequestPost_(p);

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

/* ============================================================
   MODULO RICHIESTA SOCIO
   ============================================================ */

function handleMemberRequestPost_(p) {
  const required = [
    "nome",
    "cognome",
    "codice_fiscale",
    "data_nascita",
    "luogo_nascita",
    "indirizzo",
    "email",
    "tipo_socio",
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
  const tipoSocio = getTipoSocio_(p);
  const quotaSocio = getQuotaSocio_(p, tipoSocio);
  const validitaTessera = getValiditaTessera_(p);
  const modalitaPagamento = getModalitaPagamento_();

  if (!tipoSocio || !quotaSocio) {
    return errorPage_("La tipologia di socio o la quota non risultano valide.");
  }

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
    return warningPage_(
      duplicate.message,
      duplicate.title
    );
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
    tipoSocio,
    quotaSocio,
    validitaTessera,
    modalitaPagamento,
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

  return successPage_(
    "La richiesta di adesione è stata ricevuta correttamente.",
    "Grazie. Riceverai comunicazione dall’Associazione dopo la valutazione della domanda."
  );
}

function trySendInternalNotification_(p, idRichiesta, email, codiceFiscale) {
  try {
    sendInternalNotification_(p, idRichiesta, email, codiceFiscale);

    const found = verifySentInGmail_(CONFIG.TECH_EMAIL, idRichiesta);

    if (found) {
      return {
        status: "OK - presente in Inviati",
        date: new Date(),
        error: ""
      };
    }

    return {
      status: "OK invio - non trovato in Inviati",
      date: new Date(),
      error: "GmailApp non ha restituito errore, ma il messaggio interno non è stato trovato in Inviati dopo il controllo."
    };

  } catch (err) {
    return {
      status: "ERRORE",
      date: new Date(),
      error: String(err && err.message ? err.message : err)
    };
  }
}

function trySendApplicantConfirmation_(p, idRichiesta, email) {
  try {
    sendApplicantConfirmation_(p, idRichiesta, email);

    const found = verifySentInGmail_(email, idRichiesta);

    if (found) {
      return {
        status: "OK - presente in Inviati",
        date: new Date(),
        error: ""
      };
    }

    return {
      status: "OK invio - non trovato in Inviati",
      date: new Date(),
      error: "GmailApp non ha restituito errore, ma il messaggio al richiedente non è stato trovato in Inviati dopo il controllo."
    };

  } catch (err) {
    return {
      status: "ERRORE",
      date: new Date(),
      error: String(err && err.message ? err.message : err)
    };
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
    `Tipo socio: ${getTipoSocio_(p)}\n` +
    `Quota prevista: ${getQuotaSocio_(p, getTipoSocio_(p))}\n` +
    `Validità tessera: ${getValiditaTessera_(p)}\n` +
    `Modalità pagamento prevista: ${getModalitaPagamento_()}\n` +
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
      <tr><td><strong>Tipo socio:</strong></td><td>${esc_(getTipoSocio_(p))}</td></tr>
      <tr><td><strong>Quota prevista:</strong></td><td>${esc_(getQuotaSocio_(p, getTipoSocio_(p)))}</td></tr>
      <tr><td><strong>Validità tessera:</strong></td><td>${esc_(getValiditaTessera_(p))}</td></tr>
      <tr><td><strong>Modalità pagamento prevista:</strong></td><td>${esc_(getModalitaPagamento_())}</td></tr>
    </table>

    <p><strong>Motivazione:</strong><br>${esc_(p.motivazione)}</p>

    <p>La richiesta è stata registrata nel foglio <strong>${esc_(CONFIG.SHEET_RICHIESTE)}</strong>.</p>
  `;

  GmailApp.sendEmail(
    CONFIG.TECH_EMAIL,
    subject,
    plainBody,
    {
      htmlBody: htmlBody,
      name: CONFIG.FROM_NAME,
      from: CONFIG.OFFICIAL_EMAIL,
      replyTo: email
    }
  );
}

function sendApplicantConfirmation_(p, idRichiesta, email) {
  const nome = clean_(p.nome);
  const cognome = clean_(p.cognome);

  const subject = "Richiesta di adesione ricevuta - Alma Tellus";

  const plainBody =
    `Gentile ${nome} ${cognome},\n\n` +
    `la tua richiesta di adesione all’Associazione Alma Tellus è stata ricevuta correttamente.\n\n` +
    `ID richiesta: ${idRichiesta}\n` +
    `Tipo socio richiesto: ${getTipoSocio_(p)}\n` +
    `Quota prevista: ${getQuotaSocio_(p, getTipoSocio_(p))}\n` +
    `Validità tessera: ${getValiditaTessera_(p)}\n\n` +
    `La domanda sarà valutata secondo quanto previsto dallo Statuto dell’Associazione. ` +
    `L’invio della richiesta non comporta automatica ammissione a socio.\n\n` +
    `Il pagamento della quota avverrà solo dopo l’accettazione della richiesta, direttamente al Presidente oppure secondo le modalità successivamente comunicate dall’associazione.\n\n` +
    `Riceverai successiva comunicazione sull’esito della valutazione.\n\n` +
    `Puoi rispondere direttamente a questa email per eventuali comunicazioni.\n\n` +
    `Cordiali saluti,\n` +
    `Associazione Alma Tellus`;

  const htmlBody = `
    <p>Gentile ${esc_(nome)} ${esc_(cognome)},</p>

    <p>la tua richiesta di adesione all’<strong>Associazione Alma Tellus</strong> è stata ricevuta correttamente.</p>

    <p><strong>ID richiesta:</strong> ${esc_(idRichiesta)}</p>

    <table cellpadding="6" cellspacing="0" border="0">
      <tr><td><strong>Tipo socio richiesto:</strong></td><td>${esc_(getTipoSocio_(p))}</td></tr>
      <tr><td><strong>Quota prevista:</strong></td><td>${esc_(getQuotaSocio_(p, getTipoSocio_(p)))}</td></tr>
      <tr><td><strong>Validità tessera:</strong></td><td>${esc_(getValiditaTessera_(p))}</td></tr>
    </table>

    <p>La domanda sarà valutata secondo quanto previsto dallo Statuto dell’Associazione. L’invio della richiesta non comporta automatica ammissione a socio.</p>

    <p>Il pagamento della quota avverrà solo dopo l’accettazione della richiesta, direttamente al Presidente oppure secondo le modalità successivamente comunicate dall’associazione.</p>

    <p>Riceverai successiva comunicazione sull’esito della valutazione.</p>

    <p>Puoi rispondere direttamente a questa email per eventuali comunicazioni.</p>

    <p>Cordiali saluti,<br>
    <strong>Associazione Alma Tellus</strong></p>
  `;

  GmailApp.sendEmail(
    email,
    subject,
    plainBody,
    {
      htmlBody: htmlBody,
      name: CONFIG.FROM_NAME,
      from: CONFIG.OFFICIAL_EMAIL,
      replyTo: CONFIG.OFFICIAL_EMAIL
    }
  );
}

/* ============================================================
   MODULO CONTATTI
   ============================================================ */

function isContactForm_(p) {
  const explicitType = normalizeText_(p.form_type || p.tipo_modulo || p.modulo || p.form || "");

  if (
    explicitType.includes("CONTATT") ||
    explicitType.includes("CONTACT")
  ) {
    return true;
  }

  const hasContactFields =
    Boolean(p.oggetto || p.subject) &&
    Boolean(p.messaggio || p.message) &&
    Boolean(p.email);

  const hasMemberFields =
    Boolean(p.codice_fiscale) ||
    Boolean(p.data_nascita) ||
    Boolean(p.richiesta_adesione) ||
    Boolean(p.presa_visione_statuto);

  return hasContactFields && !hasMemberFields;
}

function handleContactPost_(p) {
  const nome = clean_(p.nome || p.name);
  const email = clean_(p.email).toLowerCase();
  const oggetto = clean_(p.oggetto || p.subject);
  const messaggio = clean_(p.messaggio || p.message);
  const privacy = p.privacy || p.consenso_privacy || p.privacy_contatti;

  if (!nome || !email || !oggetto || !messaggio) {
    return errorPage_("Alcuni campi obbligatori del form contatti non risultano compilati.");
  }

  if (!isValidEmail_(email)) {
    return errorPage_("L’indirizzo email inserito non è formalmente valido.");
  }

  if (!privacy) {
    return errorPage_("Per inviare il messaggio è necessario accettare l’informativa privacy.");
  }

  if (messaggio.length < 10) {
    return errorPage_("Il messaggio è troppo breve.");
  }

  if (looksLikeSpam_(oggetto + " " + messaggio)) {
    return errorPage_("Il messaggio non può essere inviato perché contiene elementi non consentiti.");
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet_(ss, CONFIG.SHEET_CONTATTI);
  prepareHeader_(sheet, HEADERS_CONTATTI);

  const idContatto = Utilities.getUuid();
  const now = new Date();

  const row = [
    idContatto,
    now,
    nome,
    email,
    oggetto,
    messaggio,
    yesNo_(privacy),
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

  const internalResult = trySendContactInternal_(idContatto, nome, email, oggetto, messaggio);
  const senderResult = trySendContactConfirmation_(idContatto, nome, email, oggetto);

  updateContactMailLog_(sheet, rowIndex, internalResult, senderResult);

  if (internalResult.status === "ERRORE" || senderResult.status === "ERRORE") {
    return warningPage_(
      "Il messaggio è stato registrato, ma una o più email non sono state inviate correttamente.",
      "Messaggio registrato"
    );
  }

  return successPage_(
    "Il messaggio è stato inviato correttamente.",
    "Grazie. Ti risponderemo appena possibile."
  );
}

function trySendContactInternal_(idContatto, nome, email, oggetto, messaggio) {
  try {
    sendContactInternal_(idContatto, nome, email, oggetto, messaggio);

    return {
      status: "OK",
      date: new Date(),
      error: ""
    };

  } catch (err) {
    return {
      status: "ERRORE",
      date: new Date(),
      error: String(err && err.message ? err.message : err)
    };
  }
}

function sendContactInternal_(idContatto, nome, email, oggetto, messaggio) {
  const subject = `Nuovo messaggio dal sito - ${oggetto}`;

  const plainBody =
    `È stato ricevuto un nuovo messaggio dal sito Alma Tellus.\n\n` +
    `ID contatto: ${idContatto}\n` +
    `Nome: ${nome}\n` +
    `Email: ${email}\n` +
    `Oggetto: ${oggetto}\n\n` +
    `Messaggio:\n${messaggio}\n\n` +
    `Rispondi direttamente a questa email per contattare il mittente.`;

  const htmlBody = `
    <p>È stato ricevuto un nuovo messaggio dal sito <strong>Alma Tellus</strong>.</p>

    <p><strong>ID contatto:</strong> ${esc_(idContatto)}</p>
    <p><strong>Nome:</strong> ${esc_(nome)}</p>
    <p><strong>Email:</strong> ${esc_(email)}</p>
    <p><strong>Oggetto:</strong> ${esc_(oggetto)}</p>
    <p><strong>Messaggio:</strong><br>${esc_(messaggio).replace(/\n/g, "<br>")}</p>

    <p>Rispondi direttamente a questa email per contattare il mittente.</p>
  `;

  GmailApp.sendEmail(
    CONFIG.CONTACT_NOTIFY_EMAIL,
    subject,
    plainBody,
    {
      htmlBody: htmlBody,
      name: CONFIG.FROM_NAME,
      from: CONFIG.OFFICIAL_EMAIL,
      replyTo: email
    }
  );
}

function trySendContactConfirmation_(idContatto, nome, email, oggetto) {
  try {
    sendContactConfirmation_(idContatto, nome, email, oggetto);

    return {
      status: "OK",
      date: new Date(),
      error: ""
    };

  } catch (err) {
    return {
      status: "ERRORE",
      date: new Date(),
      error: String(err && err.message ? err.message : err)
    };
  }
}

function sendContactConfirmation_(idContatto, nome, email, oggetto) {
  const subject = "Messaggio ricevuto - Alma Tellus";

  const plainBody =
    `Gentile ${nome},\n\n` +
    `abbiamo ricevuto il tuo messaggio tramite il sito dell’Associazione Alma Tellus.\n\n` +
    `Oggetto: ${oggetto}\n` +
    `ID contatto: ${idContatto}\n\n` +
    `Ti risponderemo appena possibile.\n\n` +
    `Cordiali saluti,\n` +
    `Associazione Alma Tellus`;

  const htmlBody = `
    <p>Gentile ${esc_(nome)},</p>

    <p>abbiamo ricevuto il tuo messaggio tramite il sito dell’<strong>Associazione Alma Tellus</strong>.</p>

    <p><strong>Oggetto:</strong> ${esc_(oggetto)}</p>
    <p><strong>ID contatto:</strong> ${esc_(idContatto)}</p>

    <p>Ti risponderemo appena possibile.</p>

    <p>Cordiali saluti,<br>
    <strong>Associazione Alma Tellus</strong></p>
  `;

  GmailApp.sendEmail(
    email,
    subject,
    plainBody,
    {
      htmlBody: htmlBody,
      name: CONFIG.FROM_NAME,
      from: CONFIG.OFFICIAL_EMAIL,
      replyTo: CONFIG.OFFICIAL_EMAIL
    }
  );
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

/* ============================================================
   VERIFICHE E TEST
   ============================================================ */

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

function testMailContatti() {
  GmailApp.sendEmail(
    CONFIG.CONTACT_NOTIFY_EMAIL,
    "Test form contatti Alma Tellus",
    "Se ricevi questa email, l'invio interno del form contatti funziona.",
    {
      name: CONFIG.FROM_NAME,
      from: CONFIG.OFFICIAL_EMAIL,
      replyTo: CONFIG.OFFICIAL_EMAIL
    }
  );
}


function testRichiestaSocioConQuota() {
  const fakePost = {
    nome: "Mario",
    cognome: "Rossi",
    codice_fiscale: "RSSMRA80A01F205X",
    data_nascita: "1980-01-01",
    luogo_nascita: "Milano",
    indirizzo: "Via Test 1",
    email: CONFIG.TECH_EMAIL,
    telefono: "3330000000",
    professione: "Test",
    tipo_socio: "Socio ordinario",
    quota_socio: "20 euro",
    validita_tessera: "12 mesi dal pagamento della quota",
    motivazione: "Test richiesta con quota",
    presa_visione_statuto: "Sì",
    privacy: "Sì",
    richiesta_adesione: "Sì",
    form_type: "socio"
  };

  return handleMemberRequestPost_(fakePost);
}

function testContattoModulo() {
  const fakePost = {
    nome: "Test Alma Tellus",
    email: CONFIG.TECH_EMAIL,
    oggetto: "Test modulo contatti",
    messaggio: "Questo è un messaggio di prova generato da Apps Script per verificare il modulo contatti.",
    privacy: "on",
    form_type: "contatti"
  };

  return handleContactPost_(fakePost);
}

function testAutorizzazioneGmail() {
  testInvioAliasInfo();
}

/* ============================================================
   DUPLICATI SOCI
   ============================================================ */

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
            `${numeroSocio ? " con numero socio " + esc_(numeroSocio) : ""}.`
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
            `ID richiesta: ${idRichiesta}.`
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

  const closedStatuses = [
    "CESSATO",
    "DIMESSO",
    "ESCLUSO",
    "RECESSO",
    "DECADUTO",
    "DECEDUTO"
  ];

  return closedStatuses.some(item => s.includes(item));
}

function isClosedRequestStatus_(statoDomanda, esito) {
  const s = normalizeText_(statoDomanda + " " + esito);

  if (!s) {
    return false;
  }

  const closedWords = [
    "RESPINT",
    "ANNULLAT",
    "RITIRAT",
    "ARCHIVIAT",
    "NON AMMESS",
    "DINIEG"
  ];

  return closedWords.some(item => s.includes(item));
}

/* ============================================================
   LOG EMAIL
   ============================================================ */

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

/* ============================================================
   QUOTE E TIPOLOGIE SOCIO
   ============================================================ */

function getTipoSocio_(p) {
  return clean_(p.tipo_socio || p.tipoSocio || p.tipologia_socio);
}

function getQuotaSocio_(p, tipoSocio) {
  const submittedQuota = normalizeQuota_(p.quota_socio || p.quota || p.quota_prevista);

  if (submittedQuota) {
    return submittedQuota;
  }

  const normalizedType = normalizeText_(tipoSocio);

  const quotaMap = [
    { keys: ["ORDINARIO"], quota: "20 euro" },
    { keys: ["SOSTENITORE"], quota: "50 euro" },
    { keys: ["BENEMERITO"], quota: "100 euro" },
    { keys: ["FAMILIARE CONVIVENTE"], quota: "10 euro" },
    { keys: ["SECONDO FAMILIARE", "DAL SECONDO FAMILIARE"], quota: "5 euro" },
    { keys: ["UNDER 25", "UNDER25"], quota: "10 euro" },
    { keys: ["OVER 70", "OVER70"], quota: "10 euro" }
  ];

  for (const item of quotaMap) {
    if (item.keys.some(key => normalizedType.includes(key))) {
      return item.quota;
    }
  }

  return "";
}

function normalizeQuota_(value) {
  const raw = clean_(value);

  if (!raw) {
    return "";
  }

  const match = raw.match(/\d+(?:[,.]\d+)?/);

  if (!match) {
    return "";
  }

  return match[0].replace(".", ",") + " euro";
}

function getValiditaTessera_(p) {
  return clean_(p.validita_tessera || p.validita || p.scadenza_tessera) || "12 mesi dal pagamento della quota";
}

function getModalitaPagamento_() {
  return "In questa prima fase direttamente al Presidente, oppure secondo le modalità successivamente comunicate dall’associazione";
}

/* ============================================================
   UTILITY
   ============================================================ */

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

function looksLikeSpam_(text) {
  const s = clean_(text).toLowerCase();

  const urlMatches = s.match(/https?:\/\//g) || [];
  if (urlMatches.length > 2) {
    return true;
  }

  const suspiciousWords = [
    "casino",
    "viagra",
    "crypto bonus",
    "forex",
    "loan offer",
    "seo services",
    "backlink"
  ];

  return suspiciousWords.some(word => s.includes(word));
}

/* ============================================================
   OUTPUT HTML
   ============================================================ */

function htmlOutput_(html) {
  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function successPage_(message, detail) {
  return htmlOutput_(`
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Operazione completata</title>
      <style>
        body {
          margin: 0;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f6f3ec;
          color: #0e2a3a;
          font-family: Arial, sans-serif;
          text-align: center;
          padding: 24px;
        }
        .box {
          max-width: 620px;
          background: white;
          border-radius: 24px;
          padding: 36px;
          box-shadow: 0 20px 50px rgba(14, 42, 58, 0.12);
        }
        .line {
          width: 72px;
          height: 3px;
          background: #c8a15a;
          margin: 18px auto;
        }
      </style>
    </head>
    <body>
      <div class="box">
        <h1>${esc_(message)}</h1>
        <div class="line"></div>
        <p>${esc_(detail || "Grazie.")}</p>
      </div>
    </body>
    </html>
  `);
}

function warningPage_(message, title) {
  const safeTitle = title || "Messaggio registrato";

  return htmlOutput_(`
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${esc_(safeTitle)}</title>
      <style>
        body {
          margin: 0;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f6f3ec;
          color: #0e2a3a;
          font-family: Arial, sans-serif;
          text-align: center;
          padding: 24px;
        }
        .box {
          max-width: 620px;
          background: white;
          border-radius: 24px;
          padding: 36px;
          box-shadow: 0 20px 50px rgba(14, 42, 58, 0.12);
        }
        .line {
          width: 72px;
          height: 3px;
          background: #c8a15a;
          margin: 18px auto;
        }
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
        body {
          margin: 0;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f6f3ec;
          color: #0e2a3a;
          font-family: Arial, sans-serif;
          text-align: center;
          padding: 24px;
        }
        .box {
          max-width: 620px;
          background: white;
          border-radius: 24px;
          padding: 36px;
          box-shadow: 0 20px 50px rgba(14, 42, 58, 0.12);
        }
        .line {
          width: 72px;
          height: 3px;
          background: #c8a15a;
          margin: 18px auto;
        }
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
