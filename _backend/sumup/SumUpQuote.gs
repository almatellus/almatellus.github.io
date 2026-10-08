/** Link permanenti e quote. Credenziali solo nelle proprietà protette. */
const SUMUP_QUOTE_PUBLIC_URL_ = 'https://script.google.com/macros/s/AKfycbzFTVceOvTU8pccpRC-6jXYARFFQvp-HGcPo5jX2VsBCod8490_oR99JZvn-rIKCeWvpQ/exec';
const SUMUP_QUOTE_SITE_URL_ = 'https://almatellus.it/paga.html';
const SUMUP_QUOTE_HEADERS_ = ['ID richiesta','Numero socio','Quota centesimi','Link pagamento','Hash link','Stato','Sessioni','Codice transazione','Data pagamento','Ultima verifica'];

function sumupQuotaHash_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8)
    .map(byte => ('0' + ((byte + 256) % 256).toString(16)).slice(-2)).join('');
}

function sumupQuotaConfigurazione_() {
  const config = sumupConfigurazione_();
  if (!config || PropertiesService.getScriptProperties().getProperty('SUMUP_LINK_PERMANENTI_READY') !== '1') {
    throw new Error('Pagamenti personali non ancora attivi. Ammissione non registrata.');
  }
  return config;
}

function sumupQuotaFoglio_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Pagamenti SumUp');
  if (!sheet) {
    sheet = ss.insertSheet('Pagamenti SumUp');
    sheet.getRange(1,1,1,SUMUP_QUOTE_HEADERS_.length).setValues([SUMUP_QUOTE_HEADERS_]);
    sheet.setFrozenRows(1);
  }
  const map = sociWebMapHeaders_(sheet, SUMUP_QUOTE_HEADERS_);
  return {sheet:sheet,map:map};
}

function sumupQuotaRecord_(store, row, index) {
  const get = name => row[store.map[name]];
  let sessions;
  try { sessions = JSON.parse(String(get('Sessioni') || '[]')); } catch (e) { throw new Error('Registro pagamenti da verificare.'); }
  if (!Array.isArray(sessions)) throw new Error('Registro pagamenti da verificare.');
  return {store:store,row:row,index:index,id:String(get('ID richiesta')),number:String(get('Numero socio') || ''),
    cents:Number(get('Quota centesimi')),url:String(get('Link pagamento')),hash:String(get('Hash link')),
    paid:String(get('Stato')) === 'Pagato',sessions:sessions,code:String(get('Codice transazione') || '')};
}

function sumupQuotaSalva_(invoice) {
  invoice.row[invoice.store.map['Sessioni']] = JSON.stringify(invoice.sessions);
  invoice.store.sheet.getRange(invoice.index,1,1,invoice.row.length).setValues([invoice.row]);
  SpreadsheetApp.flush();
}

/** Chiamata sotto il lock dell'ammissione, prima delle scritture nel Libro soci. */
function sumupQuotaPrepara_(id, rawAmount) {
  sumupQuotaConfigurazione_();
  const amount = sociWebPaidAmount_(rawAmount);
  const cents = Math.round(amount * 100);
  const store = sumupQuotaFoglio_();
  const matches = sociWebData_(store.sheet).map((row,i) => sumupQuotaRecord_(store,row,i+2)).filter(item => item.id === id);
  if (matches.length > 1) throw new Error('Riferimento pagamento duplicato: ammissione non registrata.');
  let invoice = matches[0];
  if (invoice && invoice.cents !== cents) {
    if (invoice.sessions.length || invoice.paid) throw new Error('Esiste già un pagamento con una quota diversa. Verifica il registro.');
    invoice.cents = cents;
    invoice.row[store.map['Quota centesimi']] = cents;
    sumupQuotaSalva_(invoice);
  }
  if (!invoice) {
    const token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g,'').toLowerCase();
    const row = new Array(store.sheet.getLastColumn()).fill('');
    row[store.map['ID richiesta']] = id;
    row[store.map['Quota centesimi']] = cents;
    row[store.map['Link pagamento']] = SUMUP_QUOTE_SITE_URL_ + '#' + token;
    row[store.map['Hash link']] = sumupQuotaHash_(token);
    row[store.map['Stato']] = 'Da pagare';
    row[store.map['Sessioni']] = '[]';
    const index = store.sheet.getLastRow()+1;
    store.sheet.getRange(index,1,1,row.length).setValues([row]);
    SpreadsheetApp.flush();
    invoice = sumupQuotaRecord_(store,row,index);
  }
  return {amount:amount,url:invoice.url};
}

function sumupQuotaTrova_(token) {
  const value = String(token || '');
  if (!/^[a-f0-9]{64}$/.test(value)) throw new Error('Collegamento di pagamento non valido.');
  const store = sumupQuotaFoglio_();
  const hash = sumupQuotaHash_(value);
  const matches = sociWebData_(store.sheet).map((row,i) => sumupQuotaRecord_(store,row,i+2)).filter(item => item.hash === hash);
  if (matches.length !== 1) throw new Error('Collegamento di pagamento non valido.');
  return matches[0];
}

function sumupQuotaSocio_(invoice) {
  const sheets = sociWebSheets_();
  const request = sociWebFindRequest_(sheets,invoice.id);
  if (sociWebValue_(request.row,sheets.r,'Stato domanda') !== 'Accolta') throw new Error('La quota non è ancora disponibile per il pagamento.');
  const members = sociWebData_(sheets.libro).map((row,i) => ({row:row,index:i+2}))
    .filter(item => sociWebValue_(item.row,sheets.l,'ID richiesta origine') === invoice.id);
  if (members.length !== 1) throw new Error('Quota da verificare con l’associazione.');
  const member = members[0];
  const get = name => sociWebValue_(member.row,sheets.l,name);
  if (isClosedMemberStatus_(get('Stato socio'))) throw new Error('Per questa quota contatta l’associazione.');
  const expected = sociWebQuotaNumber_(get('Quota prevista'));
  if (expected === null || Math.round(expected*100) !== invoice.cents) throw new Error('Importo della quota da verificare con l’associazione.');
  const received = sociWebQuotaNumber_(get('Quota versata'));
  member.paid = normalizeText_(get('Stato socio')) === 'PAGATO' || (received !== null && received >= expected);
  member.number = get('Numero socio');
  member.sheets = sheets;
  return member;
}

function sumupQuotaRichiesta_(config, method, path, payload) {
  if (!/^\/v0\.1\/checkouts(?:\/[A-Za-z0-9_-]+)?$/.test(path)) throw new Error('Operazione non valida.');
  const options = {method:method,headers:{Authorization:'Bearer '+config.key,Accept:'application/json'},
    muteHttpExceptions:true,followRedirects:false};
  if (payload) { options.contentType='application/json'; options.payload=JSON.stringify(payload); }
  let response;
  try { response=UrlFetchApp.fetch('https://api.sumup.com'+path,options); }
  catch (e) { throw new Error('Pagamento non disponibile. Riapri questo link fra poco.'); }
  const status=response.getResponseCode();
  if (status < 200 || status >= 300) throw new Error('Pagamento non disponibile (SumUp HTTP '+status+'). Riapri lo stesso link fra poco.');
  try { return JSON.parse(response.getContentText()); }
  catch (e) { throw new Error('Risposta del pagamento da verificare. Riapri questo link fra poco.'); }
}

function sumupQuotaControllaCheckout_(checkout, invoice, session, config) {
  if (!checkout || checkout.checkout_reference !== session.ref || checkout.merchant_code !== config.merchant ||
      checkout.currency !== 'EUR' || sumupCentesimi_(checkout.amount) !== invoice.cents ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(String(checkout.id || ''))) throw new Error('Riferimento del pagamento da verificare.');
  if (session.id && checkout.id !== session.id) throw new Error('Riferimento del pagamento da verificare.');
  session.id=checkout.id;
  session.status=String(checkout.status || '');
  if (checkout.hosted_checkout_url && /^https:\/\/checkout\.sumup\.com\/pay\/[A-Za-z0-9_-]+$/.test(checkout.hosted_checkout_url)) {
    session.url=checkout.hosted_checkout_url;
  }
}

function sumupQuotaRecupera_(invoice, session, config) {
  let checkout;
  if (session.id) checkout=sumupQuotaRichiesta_(config,'get','/v0.1/checkouts/'+encodeURIComponent(session.id));
  else {
    const list=sumupApi_(config,'/v0.1/checkouts',{checkout_reference:session.ref});
    if (!Array.isArray(list) || list.length > 1) throw new Error('Riferimento del pagamento da verificare.');
    if (!list.length) return null;
    checkout=list[0];
  }
  sumupQuotaControllaCheckout_(checkout,invoice,session,config);
  return checkout;
}

/** PAID da solo non basta: si verifica anche la transazione presso SumUp. */
function sumupQuotaRegistra_(invoice, checkout, session, config) {
  if (checkout.status !== 'PAID') return false;
  const transactions=Array.isArray(checkout.transactions) ? checkout.transactions : [];
  for (const transaction of transactions) {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(String(transaction.id || ''))) continue;
    const raw=sumupApi_(config,'/v2.1/merchants/'+encodeURIComponent(config.merchant)+'/transactions',{id:transaction.id});
    const status=String(raw.simple_status || raw.status || '');
    if (!['SUCCESSFUL','PAID_OUT'].includes(status) || raw.id !== transaction.id || raw.merchant_code !== config.merchant ||
        raw.currency !== 'EUR' || sumupCentesimi_(raw.amount) !== invoice.cents || Number(raw.refunded_amount || 0) > 0) continue;
    const date=new Date(raw.timestamp);
    if (isNaN(date.getTime()) || !raw.transaction_code) throw new Error('Dati del pagamento da verificare.');
    const store=invoice.store;
    if (sociWebData_(store.sheet).some(row => String(row[store.map['Codice transazione']] || '') === raw.transaction_code &&
        String(row[store.map['ID richiesta']]) !== invoice.id)) throw new Error('Transazione già associata a un’altra quota.');
    const member=sumupQuotaSocio_(invoice);
    if (!member.paid) {
      const paymentDate=sociWebDate_(Utilities.formatDate(date,'Europe/Rome','yyyy-MM-dd'));
      const map=member.sheets.l;
      member.row[map['Quota versata']]=invoice.cents/100;
      member.row[map['Data pagamento quota']]=paymentDate;
      member.row[map['Scadenza tessera']]=sociWebAnnualExpiry_(paymentDate);
      member.row[map['Stato socio']]='Pagato';
      member.sheets.libro.getRange(member.index,1,1,member.row.length).setValues([member.row]);
      SpreadsheetApp.flush();
    }
    invoice.number=member.number;
    invoice.code=raw.transaction_code;
    invoice.paid=true;
    invoice.row[store.map['Numero socio']]=member.number;
    invoice.row[store.map['Stato']]='Pagato';
    invoice.row[store.map['Codice transazione']]=raw.transaction_code;
    invoice.row[store.map['Data pagamento']]=date;
    sumupQuotaSalva_(invoice);
    return true;
  }
  throw new Error('Pagamento in verifica. Non effettuare un secondo pagamento: riapri questo link fra poco.');
}

function sumupQuotaVerifica_(invoice, config) {
  if (invoice.paid) return true;
  for (const session of invoice.sessions) {
    const checkout=sumupQuotaRecupera_(invoice,session,config);
    if (checkout && sumupQuotaRegistra_(invoice,checkout,session,config)) return true;
    if (checkout && (checkout.status === 'EXPIRED' || checkout.status === 'FAILED' &&
        !(checkout.transactions || []).some(item => item.status === 'PENDING'))) session.expires=0;
  }
  invoice.row[invoice.store.map['Ultima verifica']]=new Date();
  sumupQuotaSalva_(invoice);
  return false;
}

/** API pubblica: solo il token casuale della singola quota permette l'accesso. */
function sumupQuotaAvvia(token) {
  const lock=LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const invoice=sumupQuotaTrova_(token);
    const config=sumupQuotaConfigurazione_();
    const member=sumupQuotaSocio_(invoice);
    if (invoice.paid || member.paid || sumupQuotaVerifica_(invoice,config)) return {paid:true,number:member.number,amount:invoice.cents/100};
    invoice.number=member.number;
    invoice.row[invoice.store.map['Numero socio']]=member.number;
    const now=Date.now();
    let session=invoice.sessions[invoice.sessions.length-1];
    if (!session || now >= session.expires) {
      // Il limite delle sessioni evita creazioni ripetute su un link già noto.
      if (invoice.sessions.filter(item => now-item.created < 86400000).length >= 20) throw new Error('Per completare il pagamento contatta l’associazione.');
      session={ref:'AT-'+Utilities.getUuid(),created:now,expires:now+30*60000,id:'',url:''};
      invoice.sessions.push(session);
      sumupQuotaSalva_(invoice); // Si salva l'intento prima della chiamata per recuperare dopo timeout.
    }
    if (!session.id) {
      let checkout=sumupQuotaRecupera_(invoice,session,config);
      if (!checkout) checkout=sumupQuotaRichiesta_(config,'post','/v0.1/checkouts',{
        amount:invoice.cents/100,currency:'EUR',merchant_code:config.merchant,checkout_reference:session.ref,
        description:'Quota associativa Alma Tellus - socio '+member.number,
        hosted_checkout:{enabled:true},valid_until:new Date(session.expires).toISOString(),
        redirect_url:invoice.url,return_url:SUMUP_QUOTE_PUBLIC_URL_+'?view=sumup-callback'});
      sumupQuotaControllaCheckout_(checkout,invoice,session,config);
      sumupQuotaSalva_(invoice);
    }
    if (session.status === 'PAID' || session.status === 'PENDING' && invoice.sessions.some(item => item.status === 'PAID')) {
      throw new Error('Pagamento in verifica. Riapri questo link fra poco.');
    }
    if (session.status !== 'PENDING' || !session.url) throw new Error('Sessione conclusa. Riapri questo link fra poco per riprovare.');
    return {paid:false,number:member.number,amount:invoice.cents/100,url:session.url};
  } finally { lock.releaseLock(); }
}

function sumupQuotaStato(token) {
  const lock=LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const invoice=sumupQuotaTrova_(token), member=sumupQuotaSocio_(invoice);
    const paid=invoice.paid || member.paid || sumupQuotaVerifica_(invoice,sumupQuotaConfigurazione_());
    const session=invoice.sessions[invoice.sessions.length-1];
    return {paid:paid,number:member.number,amount:invoice.cents/100,expired:!paid && session && session.expires <= Date.now()};
  } finally { lock.releaseLock(); }
}

function paginaWebQuotaSumUp_(token) {
  if (!/^[a-f0-9]{64}$/.test(String(token || ''))) return HtmlService.createHtmlOutput('<h1>Collegamento di pagamento non valido</h1>').setTitle('Quota · Alma Tellus');
  const page=HtmlService.createTemplateFromFile('SumUpQuota');
  page.token=String(token);
  return page.evaluate().setTitle('Quota associativa · Alma Tellus').addMetaTag('viewport','width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Il webhook è solo una notifica: importo ed esito vengono sempre riletti da SumUp. */
function sumupQuotaCallback_(e) {
  let data;
  try { data=JSON.parse(e && e.postData && e.postData.contents || '{}'); } catch (error) { return HtmlService.createHtmlOutput(''); }
  if (data.event_type !== 'CHECKOUT_STATUS_CHANGED' || !/^[A-Za-z0-9_-]{1,128}$/.test(String(data.id || ''))) return HtmlService.createHtmlOutput('');
  const lock=LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const store=sumupQuotaFoglio_();
    const invoices=sociWebData_(store.sheet).map((row,i) => sumupQuotaRecord_(store,row,i+2));
    const invoice=invoices.find(item => item.sessions.some(session => session.id === data.id));
    if (invoice && !invoice.paid) sumupQuotaVerifica_(invoice,sumupQuotaConfigurazione_());
    return HtmlService.createHtmlOutput('');
  } finally { lock.releaseLock(); }
}

/** Anche Aggiorna soci / Aggiorna incassi recuperano eventuali notifiche non consegnate. */
function sumupQuotaSincronizza_() {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName('Pagamenti SumUp') || PropertiesService.getScriptProperties().getProperty('SUMUP_LINK_PERMANENTI_READY') !== '1') return;
  const lock=LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const store=sumupQuotaFoglio_(), config=sumupQuotaConfigurazione_(), started=Date.now();
    const invoices=sociWebData_(store.sheet).map((row,i) => sumupQuotaRecord_(store,row,i+2))
      .filter(item => !item.paid && item.sessions.length).sort((a,b) => new Date(a.row[store.map['Ultima verifica']] || 0)-new Date(b.row[store.map['Ultima verifica']] || 0));
    for (const invoice of invoices) {
      if (Date.now()-started > 15000) break;
      try { sumupQuotaVerifica_(invoice,config); }
      catch (error) {
        invoice.row[store.map['Ultima verifica']]=new Date();
        sumupQuotaSalva_(invoice);
        console.warn('Una quota SumUp richiede una verifica. Il Libro soci non è stato modificato per quella quota.');
      }
    }
  } finally { lock.releaseLock(); }
}

function sumupQuotaAssociaIncassi_(items) {
  if (!SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Pagamenti SumUp')) return;
  const store=sumupQuotaFoglio_(), sheets=sociWebSheets_(), members=sociWebData_(sheets.libro);
  const byCode={};
  sociWebData_(store.sheet).forEach(row => {
    const code=String(row[store.map['Codice transazione']] || '');
    if (!code) return;
    const id=String(row[store.map['ID richiesta']]);
    const member=members.find(value => sociWebValue_(value,sheets.l,'ID richiesta origine') === id);
    if (member) byCode[code]={number:sociWebValue_(member,sheets.l,'Numero socio'),name:[sociWebValue_(member,sheets.l,'Nome'),sociWebValue_(member,sheets.l,'Cognome')].filter(Boolean).join(' ')};
  });
  items.forEach(item => { if (byCode[item.code]) { item.memberNumber=byCode[item.code].number; item.memberName=byCode[item.code].name; } });
}

/** Attivazione amministrativa dopo la prova reale di creazione di un checkout. */
function sumupAttivaLinkPermanenti() {
  sumupRichiediAccesso_();
  const config=sumupConfigurazione_();
  const proof=PropertiesService.getScriptProperties().getProperty('SUMUP_PROVA_CHECKOUT_ID');
  if (!config || !proof) throw new Error('Manca la verifica di creazione del checkout.');
  const checkout=sumupQuotaRichiesta_(config,'get','/v0.1/checkouts/'+encodeURIComponent(proof));
  if (checkout.merchant_code !== config.merchant || !/^AT-VERIFICA-/.test(checkout.checkout_reference || '') ||
      !/^https:\/\/checkout\.sumup\.com\/pay\/[A-Za-z0-9_-]+$/.test(checkout.hosted_checkout_url || '')) throw new Error('Verifica SumUp non completata.');
  sumupQuotaFoglio_();
  PropertiesService.getScriptProperties().setProperty('SUMUP_LINK_PERMANENTI_READY','1');
  console.log('Link permanenti attivi. Nessun socio modificato, nessuna email inviata.');
}
