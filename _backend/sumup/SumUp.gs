/**
 * Incassi SumUp per l'area riservata Alma Tellus.
 * Aggiunta al progetto esistente: nessuna modifica ai fogli o ai pagamenti.
 * Credenziali solo nelle proprietà dello script, mai nell'HTML o nel repository.
 */
const SUMUP_AREA_URL_ = 'https://script.google.com/macros/s/AKfycbyJSYfVLex-XdpHHB7pXauZNDvM4Xn6FQJnK8jh-nXBl6TBtjaKAycy4JidEduguU7H4w/exec';

function sumupRichiediAccesso_() {
  if (typeof controllaAccessoRichiesteWeb_ !== 'function') {
    throw new Error('Controllo dell’area riservata non disponibile.');
  }
  controllaAccessoRichiesteWeb_();
}

function paginaWebIncassiSumUp_() {
  try {
    sumupRichiediAccesso_();
  } catch (error) {
    return HtmlService.createHtmlOutput(
      '<!doctype html><html lang="it"><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<body style="font:16px Arial,sans-serif;margin:32px;color:#153a42">' +
      '<h1>Accesso riservato</h1><p>Apri la pagina con l’account Alma Tellus.</p></body></html>'
    ).setTitle('Accesso riservato · Alma Tellus');
  }
  const page = HtmlService.createTemplateFromFile('SumUpIncassi');
  page.areaRiservataUrl = SUMUP_AREA_URL_;
  return page.evaluate().setTitle('Incassi SumUp · Alma Tellus')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function sumupConfigurazione_() {
  const properties = PropertiesService.getScriptProperties();
  const key = String(properties.getProperty('SUMUP_API_KEY') || '').trim();
  const merchant = String(properties.getProperty('SUMUP_MERCHANT_CODE') || '').trim();
  if (!key || !merchant) return null;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(merchant) || /[\r\n]/.test(key)) {
    throw new Error('Configurazione SumUp non valida. Verifica le proprietà dello script.');
  }
  return { key: key, merchant: merchant };
}

function sumupDataValida_(value) {
  const text = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('Indica due date valide.');
  const date = new Date(text + 'T12:00:00Z');
  if (isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    throw new Error('Indica due date valide.');
  }
  return text;
}

function sumupIntervallo_(params) {
  const from = sumupDataValida_(params && params.from);
  const to = sumupDataValida_(params && params.to);
  if (from > to) throw new Error('La data iniziale deve precedere quella finale.');
  if ((Date.parse(to) - Date.parse(from)) / 86400000 > 365) {
    throw new Error('Seleziona un intervallo di massimo 366 giorni.');
  }
  const next = new Date(to + 'T12:00:00Z');
  next.setUTCDate(next.getUTCDate() + 1);
  const midnight = value => Utilities.parseDate(value + ' 00:00', 'Europe/Rome', 'yyyy-MM-dd HH:mm');
  return {
    from: from, to: to,
    oldest: midnight(from).toISOString(),
    newest: midnight(next.toISOString().slice(0, 10)).toISOString()
  };
}

function sumupQuery_(params) {
  return Object.keys(params).map(key => encodeURIComponent(key) + '=' + encodeURIComponent(params[key])).join('&');
}

function sumupApi_(config, path, params) {
  // Il percorso viene scelto sul server; non si accettano URL dal browser.
  const url = 'https://api.sumup.com' + path + '?' + sumupQuery_(params);
  let response;
  try {
    response = UrlFetchApp.fetch(url, {
      method: 'get', headers: { Authorization: 'Bearer ' + config.key, Accept: 'application/json' },
      muteHttpExceptions: true, followRedirects: false
    });
  } catch (error) {
    throw new Error('Impossibile collegarsi a SumUp. Riprova tra poco.');
  }
  const status = response.getResponseCode();
  if (status === 401) throw new Error('SumUp non riconosce la chiave API. Verifica la configurazione.');
  if (status === 403) throw new Error('SumUp non consente la lettura delle transazioni con questo accesso.');
  if (status === 429) throw new Error('SumUp ha ricevuto troppe richieste. Riprova tra poco.');
  if (status < 200 || status >= 300) throw new Error('SumUp non ha restituito i dati richiesti (HTTP ' + status + ').');
  try {
    return JSON.parse(response.getContentText());
  } catch (error) {
    throw new Error('La risposta di SumUp non è leggibile. Riprova tra poco.');
  }
}

function sumupProssimaPagina_(links, path) {
  if (!Array.isArray(links)) return null;
  const link = links.find(value => value && value.rel === 'next');
  if (!link) return null;
  let query = String(link.href || '');
  if (query.indexOf('https://api.sumup.com' + path + '?') === 0) {
    query = query.slice(('https://api.sumup.com' + path + '?').length);
  } else if (query.indexOf(path + '?') === 0) {
    query = query.slice((path + '?').length);
  } else if (query.indexOf('?') === 0) {
    query = query.slice(1);
  }
  // Anche se SumUp inviasse un URL esterno, la chiave non verrà inoltrata.
  if (!query || /[:/?#]/.test(query)) throw new Error('SumUp ha restituito un collegamento di pagina non valido.');
  const cursor = {};
  query.split('&').forEach(pair => {
    const pos = pair.indexOf('=');
    if (pos < 0) return;
    let key, value;
    try {
      key = decodeURIComponent(pair.slice(0, pos));
      value = decodeURIComponent(pair.slice(pos + 1));
    } catch (error) {
      throw new Error('SumUp ha restituito un collegamento di pagina non valido.');
    }
    if (key === 'newest_ref' || key === 'oldest_ref') {
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new Error('Riferimento di pagina SumUp non valido.');
      cursor[key] = value;
    }
  });
  if (Object.keys(cursor).length !== 1) throw new Error('Riferimento di pagina SumUp mancante o ambiguo.');
  return cursor;
}

function sumupCentesimi_(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) : null;
}

function sumupTransazione_(raw) {
  const status = String(raw.simple_status || raw.status || 'UNKNOWN').toUpperCase();
  const amount = sumupCentesimi_(raw.amount);
  if (amount === null || !Number.isFinite(Date.parse(raw.timestamp))) {
    throw new Error('Una transazione SumUp ha importo o data mancanti.');
  }
  const paid = ['SUCCESSFUL', 'PAID_OUT', 'REFUNDED', 'REFUND_FAILED'].includes(status);
  let refund = sumupCentesimi_(raw.refunded_amount);
  if (refund === null && status !== 'REFUNDED') refund = 0;
  if (refund !== null && (refund < 0 || refund > amount)) {
    throw new Error('Importo del rimborso SumUp non valido.');
  }
  return {
    id: String(raw.transaction_id || raw.id || ''),
    code: String(raw.transaction_code || ''), timestamp: String(raw.timestamp),
    description: String(raw.product_summary || ''), currency: String(raw.currency || '').toUpperCase(),
    amountCents: amount, refundedCents: refund,
    retainedCents: paid && refund !== null ? amount - refund : null,
    status: status, type: String(raw.type || 'PAYMENT'), paymentType: String(raw.payment_type || ''),
    paid: paid, payoutDate: String(raw.payout_date || '')
  };
}

function sumupTotali_(items) {
  const groups = {};
  items.filter(item => item.paid).forEach(item => {
    const currency = item.currency;
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Valuta della transazione SumUp mancante o non valida.');
    if (!groups[currency]) groups[currency] = { currency: currency, count: 0, grossCents: 0, refundedCents: 0, retainedCents: 0 };
    const group = groups[currency];
    group.count += 1;
    group.grossCents += item.amountCents;
    if (item.refundedCents === null) {
      group.refundedCents = null;
      group.retainedCents = null;
    } else {
      if (group.refundedCents !== null) group.refundedCents += item.refundedCents;
      if (group.retainedCents !== null) group.retainedCents += item.retainedCents;
    }
  });
  return Object.keys(groups).sort().map(currency => groups[currency]);
}

/** API richiamabile dall'HTML. Autorizzazione prima di leggere credenziali o dati. */
function sumupWebIncassi(params) {
  sumupRichiediAccesso_();
  const range = sumupIntervallo_(params);
  const config = sumupConfigurazione_();
  if (!config) return { configured: false };
  const path = '/v2.1/merchants/' + encodeURIComponent(config.merchant) + '/transactions/history';
  const base = { order: 'descending', limit: 100, oldest_time: range.oldest, newest_time: range.newest };
  let cursor = {}, complete = false;
  const seenPages = new Set(), seenTransactions = new Set(), items = [];
  const start = Date.now();
  for (let page = 0; page < 20 && Date.now() - start < 45000; page += 1) {
    const signature = sumupQuery_(cursor);
    if (seenPages.has(signature)) throw new Error('SumUp ha ripetuto la stessa pagina. Riprova.');
    seenPages.add(signature);
    const result = sumupApi_(config, path, Object.assign({}, base, cursor));
    if (!result || !Array.isArray(result.items)) throw new Error('Elenco transazioni SumUp non valido.');
    result.items.forEach(raw => {
      // Rimborsi/storni come eventi separati non devono duplicare il pagamento originale.
      if (raw.type && raw.type !== 'PAYMENT') return;
      if (raw.payment_type === 'CASH') return;
      const item = sumupTransazione_(raw);
      if (!item.id && !item.code) throw new Error('Identificativo transazione SumUp mancante.');
      const date = Date.parse(item.timestamp);
      if (date < Date.parse(range.oldest) || date >= Date.parse(range.newest)) return;
      const unique = item.id || item.code;
      if (!seenTransactions.has(unique)) { seenTransactions.add(unique); items.push(item); }
    });
    cursor = sumupProssimaPagina_(result.links, path);
    if (!cursor) { complete = true; break; }
  }
  items.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  return { configured: true, complete: complete, items: items, totals: sumupTotali_(items),
    from: range.from, to: range.to, updatedAt: new Date().toISOString() };
}

function sumupWebDettaglio(id) {
  sumupRichiediAccesso_();
  const identifier = String(id || '');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(identifier)) throw new Error('Identificativo transazione non valido.');
  const config = sumupConfigurazione_();
  if (!config) throw new Error('Collegamento SumUp non ancora configurato.');
  const raw = sumupApi_(config, '/v2.1/merchants/' + encodeURIComponent(config.merchant) + '/transactions', { id: identifier });
  const fee = sumupCentesimi_(raw.fee_amount);
  return { code: String(raw.transaction_code || ''), currency: String(raw.currency || ''),
    feeCents: fee, cardType: String(raw.card && raw.card.type || ''),
    lastFour: String(raw.card && raw.card.last_4_digits || ''),
    status: String(raw.simple_status || raw.status || ''),
    payoutDate: String(raw.payout_date || ''),
    payoutsReceived: Number(raw.payouts_received || 0), payoutsTotal: Number(raw.payouts_total || 0) };
}
