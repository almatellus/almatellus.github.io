/**
 * Vista di sola lettura delle domande di adesione per il foglio Alma Tellus.
 * Aggiungere questo file allo stesso progetto Apps Script che contiene Code.gs.
 * Non esegue setup(), non modifica celle e non invia messaggi.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Alma Tellus')
    .addItem('Visualizza richieste di adesione', 'visualizzaRichiesteAdesione')
    .addToUi();
}

function visualizzaRichiesteAdesione() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss && ss.getSheetByName(CONFIG.SHEET_RICHIESTE);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Non trovo il foglio "Richieste adesione" in questo documento. Non è stato modificato nulla.');
    return;
  }

  const headers = sheet.getLastColumn() > 0
    ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0] : [];
  const required = ['ID richiesta', 'Data richiesta', 'Nome', 'Cognome',
    'Email', 'Tipo socio', 'Stato domanda', 'Esito'];
  const missing = required.filter(name => !headers.includes(name));
  if (missing.length) {
    SpreadsheetApp.getUi().alert('Il foglio non ha le intestazioni attese: ' + missing.join(', ') + '. Non è stato modificato nulla.');
    return;
  }

  const columns = {};
  headers.forEach((name, index) => { columns[name] = index; });
  const values = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getDisplayValues() : [];
  const field = (row, name) => columns[name] === undefined ? '' : String(row[columns[name]] || '').trim();
  const requests = values.map((row, index) => ({
    rowNumber: index + 2,
    id: field(row, 'ID richiesta'),
    date: field(row, 'Data richiesta'),
    name: [field(row, 'Nome'), field(row, 'Cognome')].filter(Boolean).join(' '),
    email: field(row, 'Email'),
    type: field(row, 'Tipo socio'),
    status: field(row, 'Stato domanda'),
    outcome: field(row, 'Esito'),
    phone: field(row, 'Telefono'),
    reason: field(row, 'Motivazione'),
    decision: field(row, 'Data decisione'),
    minutes: field(row, 'Riferimento verbale'),
    notes: field(row, 'Note')
  })).filter(item => item.id || item.name).reverse();

  const escape = value => String(value || '').replace(/&/g, '&amp;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const label = value => escape(value || '—');
  const cards = requests.map(item => {
    const search = escape([item.name, item.email, item.id, item.type, item.status, item.outcome].join(' ').toLowerCase());
    return `<article class="card" data-search="${search}">
      <div class="top"><div><strong>${label(item.name)}</strong><span class="date">${label(item.date)}</span></div>
        <span class="badge">${label(item.status)}</span></div>
      <div class="summary"><span>${label(item.type)}</span><span>${label(item.outcome)}</span></div>
      <details><summary>Mostra dettagli</summary><dl>
        <dt>Email</dt><dd>${label(item.email)}</dd>
        <dt>Telefono</dt><dd>${label(item.phone)}</dd>
        <dt>ID richiesta</dt><dd class="code">${label(item.id)}</dd>
        <dt>Riga del foglio</dt><dd>${item.rowNumber}</dd>
        <dt>Motivazione</dt><dd>${label(item.reason)}</dd>
        <dt>Data decisione</dt><dd>${label(item.decision)}</dd>
        <dt>Riferimento verbale</dt><dd>${label(item.minutes)}</dd>
        <dt>Note</dt><dd>${label(item.notes)}</dd>
      </dl></details></article>`;
  }).join('');

  const html = `<!doctype html><html lang="it"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>
      body{font:15px/1.5 Arial,sans-serif;background:#f5f6f3;color:#173742;margin:0;padding:24px}
      main{max-width:960px;margin:auto}h1{margin:0 0 4px;font-size:27px}p{margin:0 0 18px;color:#526b70}
      input{box-sizing:border-box;width:100%;border:1px solid #b9c9c8;border-radius:10px;padding:12px;font:inherit;margin-bottom:12px}
      .count{font-size:13px;margin-bottom:12px}.card{background:white;border:1px solid #dce5e0;border-radius:12px;padding:16px;margin:0 0 10px}
      .top,.summary{display:flex;justify-content:space-between;gap:12px}.top strong{font-size:17px}.date{display:block;color:#647b7a;font-size:13px}
      .badge{background:#e5f2ed;border-radius:20px;padding:3px 10px;height:max-content;white-space:nowrap}.summary{color:#486166;margin:10px 0}
      details{border-top:1px solid #e8eeeb;padding-top:9px}summary{cursor:pointer;color:#126455;font-weight:bold}
      dl{display:grid;grid-template-columns:160px 1fr;gap:7px 16px;margin:14px 0 0}dt{color:#617877}dd{margin:0;overflow-wrap:anywhere}
      .code{font-family:monospace}@media(max-width:650px){dl{grid-template-columns:1fr}dt{font-weight:bold;margin-top:6px}}
    </style></head><body><main><h1>Richieste di adesione</h1>
    <p>Elenco in sola lettura, dalla più recente alla meno recente.</p>
    <input id="search" type="search" placeholder="Cerca per nome, email, stato o ID" aria-label="Cerca richieste">
    <div id="count" class="count"></div><section id="list">${cards || '<p>Nessuna richiesta registrata.</p>'}</section>
    <script>
      const cards = Array.from(document.querySelectorAll('.card'));
      const search = document.getElementById('search');
      const count = document.getElementById('count');
      function filter() {
        const query = search.value.trim().toLowerCase();
        let visible = 0;
        cards.forEach(card => {
          const show = card.dataset.search.includes(query);
          card.hidden = !show;
          if (show) visible++;
        });
        count.textContent = visible + ' richieste visualizzate su ' + cards.length;
      }
      search.addEventListener('input', filter);
      filter();
    </script></main></body></html>`;

  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(1020).setHeight(680),
    'Richieste di adesione'
  );
}
