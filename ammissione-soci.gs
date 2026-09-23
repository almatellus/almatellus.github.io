/**
 * Modulo da aggiungere al progetto Apps Script collegato al foglio adesioni.
 * Richiede CONFIG, HEADERS_RICHIESTE e HEADERS_LIBRO_SOCI del Code.gs storico.
 * Eseguire ammettiSocioSelezionato dal menu Alma Tellus dopo avere selezionato
 * una cella della domanda. La decisione viene presa dall'operatore, mai dal sito.
 */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Alma Tellus')
    .addItem('Ammetti socio selezionato', 'ammettiSocioSelezionato')
    .addItem('Invia conferma in sospeso', 'inviaConfermaSocioSelezionato')
    .addToUi();
}

function ammettiSocioSelezionato() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSheet();
  const row = sheet.getActiveCell().getRow();
  if (sheet.getName() !== CONFIG.SHEET_RICHIESTE || row < 2) {
    ui.alert('Seleziona una riga nel foglio Richieste adesione.');
    return;
  }
  const map = intestazioniAmmissione_(sheet, HEADERS_RICHIESTE);
  const data = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  const name = String(data[map['Nome'] - 1] || '') + ' ' + String(data[map['Cognome'] - 1] || '');
  const ref = String(data[map['Riferimento verbale'] - 1] || '').trim();
  if (!ref) {
    ui.alert('Inserisci prima il riferimento del verbale nella riga della domanda.');
    return;
  }
  if (ui.alert('Conferma ammissione', 'Ammettere ' + name.trim() + '?\nVerbale: ' + ref,
      ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  try {
    const result = registraAmmissioneSocio_(row);
    ui.alert('Socio n. ' + result.number + '. ' + (result.mailSent ? 'Email inviata.' : 'Email in sospeso: usare il comando di reinvio.'));
  } catch (err) {
    ui.alert('Ammissione non completata: ' + err.message);
  }
}

function registraAmmissioneSocio_(row) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  let result;
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const requests = ss.getSheetByName(CONFIG.SHEET_RICHIESTE);
    const members = ss.getSheetByName(CONFIG.SHEET_LIBRO);
    if (!requests || !members || row < 2 || row > requests.getLastRow()) throw Error('Fogli o riga inesistenti.');
    const r = intestazioniAmmissione_(requests, HEADERS_RICHIESTE);
    const m = intestazioniAmmissione_(members, HEADERS_LIBRO_SOCI);
    const request = requests.getRange(row, 1, 1, requests.getLastColumn()).getValues()[0];
    const get = key => request[r[key] - 1];
    const id = String(get('ID richiesta') || '').trim();
    const cf = String(get('Codice fiscale') || '').replace(/\s+/g, '').toUpperCase();
    const email = String(get('Email') || '').trim();
    const verbale = String(get('Riferimento verbale') || '').trim();
    if (!id || !cf || !verbale || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error('ID, codice fiscale, email o verbale mancanti.');
    if (String(get('Esito') || '').trim() || !/^(RICEVUTA|IN VALUTAZIONE)$/i.test(String(get('Stato domanda') || '').trim())) {
      throw Error('La domanda non è nello stato ammissibile.');
    }
    const existing = members.getLastRow() > 1
      ? members.getRange(2, 1, members.getLastRow() - 1, members.getLastColumn()).getValues() : [];
    if (existing.some(values => String(values[m['Codice fiscale'] - 1] || '').replace(/\s+/g, '').toUpperCase() === cf)) {
      throw Error('Codice fiscale già presente nel Libro soci: verificare manualmente.');
    }
    const requestRows = requests.getLastRow() > 1
      ? requests.getRange(2, 1, requests.getLastRow() - 1, requests.getLastColumn()).getValues() : [];
    if (requestRows.some((values, index) => index + 2 !== row &&
        String(values[r['ID richiesta'] - 1] || '').trim() === id)) throw Error('ID richiesta duplicato.');
    let number = 0;
    existing.forEach(values => {
      const n = Number(values[m['Numero socio'] - 1]);
      if (Number.isSafeInteger(n) && n > number) number = n;
    });
    number++;
    const member = Array(members.getLastColumn()).fill('');
    const copy = ['Nome', 'Cognome', 'Codice fiscale', 'Data di nascita', 'Luogo di nascita',
      'Indirizzo', 'Email', 'Telefono', 'Professione', 'Tipo socio', 'Quota prevista', 'Riferimento verbale', 'Note'];
    copy.forEach(key => { member[m[key] - 1] = get(key); });
    member[m['Numero socio'] - 1] = number;
    member[m['Data ammissione'] - 1] = new Date();
    member[m['Stato socio'] - 1] = 'Ammesso - quota da versare';
    // Nessuna tessera/scadenza finché non viene registrato il pagamento.
    members.getRange(members.getLastRow() + 1, 1, 1, member.length).setValues([member]);
    requests.getRange(row, r['Data decisione']).setValue(new Date());
    requests.getRange(row, r['Esito']).setValue('Accolta');
    requests.getRange(row, r['Stato domanda']).setValue('Ammessa');
    SpreadsheetApp.flush();
    result = {row, number};
  } finally {
    lock.releaseLock();
  }
  result.mailSent = inviaConfermaAmmissione_(result.row, result.number);
  return result;
}

function inviaConfermaSocioSelezionato() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSheet();
  const row = sheet.getActiveCell().getRow();
  if (sheet.getName() !== CONFIG.SHEET_RICHIESTE || row < 2) return ui.alert('Seleziona una domanda.');
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const r = intestazioniAmmissione_(sheet, HEADERS_RICHIESTE);
    const memberSheet = ss.getSheetByName(CONFIG.SHEET_LIBRO);
    const m = intestazioniAmmissione_(memberSheet, HEADERS_LIBRO_SOCI);
    const request = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
    const cf = String(request[r['Codice fiscale'] - 1] || '').trim().toUpperCase();
    if (String(request[r['Esito'] - 1]) !== 'Accolta') throw Error('Domanda non accolta.');
    const rows = memberSheet.getRange(2, 1, Math.max(1, memberSheet.getLastRow() - 1), memberSheet.getLastColumn()).getValues();
    const matches = rows.filter(v => String(v[m['Codice fiscale'] - 1] || '').trim().toUpperCase() === cf);
    if (matches.length !== 1) throw Error('Socio assente o duplicato nel Libro soci.');
    ui.alert(inviaConfermaAmmissione_(row, matches[0][m['Numero socio'] - 1]) ? 'Email inviata.' : 'Invio non riuscito; controlla le note della domanda.');
  } catch (err) { ui.alert(err.message); }
}

function inviaConfermaAmmissione_(row, number) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_RICHIESTE);
  const r = intestazioniAmmissione_(sheet, HEADERS_RICHIESTE);
  const values = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (String(values[r['Invio mail richiedente'] - 1]).startsWith('OK ammissione')) return true;
  const name = String(values[r['Nome'] - 1] || '').trim();
  const email = String(values[r['Email'] - 1] || '').trim();
  const id = String(values[r['ID richiesta'] - 1] || '').trim();
  const body = `Gentile ${name},\n\nla tua domanda di adesione ad Alma Tellus è stata accolta.\nNumero socio: ${number}\nID richiesta: ${id}\n\nLa quota prevista è ${values[r['Quota prevista'] - 1]}. Ti comunicheremo le modalità di versamento. La tessera avrà validità di 12 mesi dal pagamento della quota.\n\nAssociazione Alma Tellus`;
  try {
    GmailApp.sendEmail(email, 'Ammissione ad Alma Tellus - socio n. ' + number, body,
      {name: CONFIG.FROM_NAME, from: CONFIG.OFFICIAL_EMAIL, replyTo: CONFIG.OFFICIAL_EMAIL});
    sheet.getRange(row, r['Invio mail richiedente'], 1, 3)
      .setValues([['OK ammissione n. ' + number, new Date(), '']]);
    return true;
  } catch (err) {
    sheet.getRange(row, r['Invio mail richiedente'], 1, 3)
      .setValues([['ERRORE ammissione', new Date(), String(err.message || err)]]);
    return false;
  }
}

function intestazioniAmmissione_(sheet, required) {
  if (!sheet) throw Error('Foglio mancante.');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};
  required.forEach(name => {
    const index = headers.indexOf(name);
    if (index < 0) throw Error('Colonna mancante: ' + name);
    map[name] = index + 1;
  });
  return map;
}
