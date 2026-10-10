/**
 * Pagina web privata, in sola lettura, per le richieste di adesione.
 * Aggiungere questo file al progetto Apps Script collegato al foglio.
 * In Code.gs, come prima istruzione di doGet(e), aggiungere:
 *   if (e && e.parameter && e.parameter.view === 'richieste') return paginaWebRichiesteAdesione_();
 * Creare un NUOVO deployment web con accesso "Solo io" ed esecuzione
 * "Utente che accede all'app web". Il deployment pubblico già in uso per
 * le domande di adesione non va modificato.
 */

const RICHIESTE_WEB_ADMIN_EMAILS_ = [
  'associazione.almatellus@gmail.com',
  'info@almatellus.it'
];

function controllaAccessoRichiesteWeb_() {
  const email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  if (!RICHIESTE_WEB_ADMIN_EMAILS_.includes(email)) {
    throw new Error('Accesso riservato: apri la pagina con l’account Alma Tellus.');
  }
}

function paginaWebRichiesteAdesione_() {
  try {
    controllaAccessoRichiesteWeb_();
  } catch (error) {
    return HtmlService.createHtmlOutput(
      '<!doctype html><html lang="it"><meta charset="utf-8"><title>Accesso riservato</title>' +
      '<body style="font:16px Arial,sans-serif;margin:48px;color:#153a42">' +
      '<h1>Accesso riservato</h1><p>Apri questo indirizzo con l’account Alma Tellus.</p></body></html>'
    ).setTitle('Accesso riservato · Alma Tellus');
  }
  return HtmlService.createHtmlOutput(RICHIESTE_WEB_HTML_)
    .setTitle('Richieste di adesione · Alma Tellus');
}

// Chiamata dalla pagina tramite google.script.run: il controllo di accesso
// va ripetuto qui perché questa funzione è richiamabile dal browser.
function leggiRichiesteAdesioneWeb() {
  controllaAccessoRichiesteWeb_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Il progetto Apps Script non è collegato al foglio delle richieste.');
  const sheet = ss.getSheetByName(CONFIG.SHEET_RICHIESTE);
  if (!sheet) throw new Error('Non trovo la scheda "Richieste adesione".');

  const lastColumn = sheet.getLastColumn();
  if (!lastColumn) throw new Error('La scheda "Richieste adesione" è vuota.');
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0]
    .map(value => String(value).trim());
  const required = ['ID richiesta', 'Data richiesta', 'Stato domanda', 'Nome', 'Cognome', 'Email', 'Tipo socio'];
  const missing = required.filter(name => !headers.includes(name));
  if (missing.length) throw new Error('Mancano le intestazioni: ' + missing.join(', '));

  const columns = {};
  headers.forEach((name, index) => { columns[name] = index; });
  const rows = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, lastColumn).getDisplayValues() : [];
  const fields = [
    ['Codice fiscale', 'Codice fiscale'], ['Data di nascita', 'Data di nascita'],
    ['Luogo di nascita', 'Luogo di nascita'], ['Indirizzo', 'Indirizzo'],
    ['Telefono', 'Telefono'], ['Professione', 'Professione'],
    ['Quota prevista', 'Quota prevista'], ['Validità tessera', 'Validità tessera'],
    ['Modalità pagamento prevista', 'Modalità pagamento prevista'],
    ['Motivazione', 'Motivazione'], ['Data decisione', 'Data decisione'],
    ['Riferimento verbale', 'Riferimento verbale'], ['Note', 'Note']
  ];
  function cell(row, name) {
    return columns[name] === undefined ? '' : String(row[columns[name]] || '').trim();
  }
  return rows.map((row, index) => ({
    row: index + 2,
    id: cell(row, 'ID richiesta'),
    date: cell(row, 'Data richiesta'),
    name: [cell(row, 'Nome'), cell(row, 'Cognome')].filter(Boolean).join(' '),
    email: cell(row, 'Email'),
    type: cell(row, 'Tipo socio'),
    status: cell(row, 'Stato domanda'),
    outcome: cell(row, 'Esito'),
    details: fields.map(([label, name]) => ({ label, value: cell(row, name) }))
      .filter(field => field.value)
  })).filter(item => item.id || item.name).reverse();
}

const RICHIESTE_WEB_HTML_ = `<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#103f4c">
  <style>
    :root{font-family:Arial,Helvetica,sans-serif;color:#183942;background:#f2f6f4}
    *{box-sizing:border-box}body{margin:0;min-height:100vh}
    .topbar{background:#103f4c;color:white;padding:18px clamp(18px,5vw,70px);display:flex;align-items:center;gap:13px}
    .logo{width:38px;height:38px;border-radius:11px;background:#d5f0dc;color:#103f4c;display:grid;place-items:center;font-weight:800;font-size:20px}
    .brand{font-weight:800;letter-spacing:.12em;font-size:13px}.private{margin-left:auto;font-size:12px;color:#d3ece8}
    main{max-width:1080px;margin:auto;padding:34px 20px 68px}
    .eyebrow{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#327d68;font-weight:800;margin:0 0 8px}
    h1{font-size:clamp(28px,5vw,43px);line-height:1.1;margin:0 0 9px;letter-spacing:-.035em}
    .intro{margin:0;color:#617876;line-height:1.55}
    .stats{display:flex;flex-wrap:wrap;gap:12px;margin:27px 0 24px}
    .stat{background:white;border:1px solid #dce8e3;border-radius:14px;min-width:140px;padding:15px 18px;box-shadow:0 5px 20px #123b4310}
    .stat strong{display:block;font-size:29px;color:#103f4c}.stat span{font-size:13px;color:#5e7774}
    .controls{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:12px}
    input,select,button{font:inherit}input,select{padding:12px 14px;background:white;border:1px solid #c9d8d2;border-radius:11px;color:#183942}
    input{flex:1 1 250px;min-width:0}select{flex:0 1 210px}
    button{background:#14664e;color:#fff;border:0;border-radius:11px;padding:12px 17px;cursor:pointer;font-weight:700}
    button:hover{background:#0d4e3a}button:disabled{opacity:.55;cursor:wait}
    input:focus,select:focus,button:focus-visible,summary:focus-visible{outline:3px solid #78bb9b;outline-offset:2px}
    .meta{font-size:13px;color:#647a78;min-height:21px;margin:0 0 17px}
    .error{background:#fff4f0;border:1px solid #e6b4a6;color:#9a3d29;border-radius:12px;padding:14px 16px;margin-bottom:17px}
    .card{background:#fff;border:1px solid #d9e8e2;border-radius:16px;padding:19px 21px;margin:0 0 12px;box-shadow:0 5px 20px #123b4310}
    .card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}
    .card h2{font-size:19px;margin:0 0 5px}.date{font-size:13px;color:#657c79}
    .badge{border-radius:100px;background:#e6f3ec;color:#14533f;padding:6px 11px;font-weight:700;font-size:12px;white-space:nowrap}
    .badge.pending{background:#fff0d7;color:#805516}
    .summary{display:flex;gap:9px;flex-wrap:wrap;margin:16px 0;color:#4d6764;font-size:13px}
    .summary span{background:#f0f5f3;border-radius:7px;padding:6px 9px}
    details{border-top:1px solid #e7efec;padding-top:12px}summary{cursor:pointer;color:#14664e;font-weight:700}
    dl{display:grid;grid-template-columns:minmax(115px,175px) minmax(0,1fr);gap:9px 14px;margin:17px 0 1px}
    dt{color:#6b807d}dd{margin:0;overflow-wrap:anywhere}
    .empty{background:white;border:1px dashed #bdcec7;border-radius:15px;padding:35px;text-align:center;color:#5c7470}
    @media(max-width:600px){.card-head{align-items:flex-start}.badge{white-space:normal;text-align:center}dl{grid-template-columns:1fr}dt{font-weight:700;margin-top:8px}.stat{flex:1 1 130px}}
  </style>
</head>
<body>
  <header class="topbar"><div class="logo" aria-hidden="true">A</div><span class="brand">ALMA TELLUS</span><span class="private">Area riservata</span></header>
  <main>
    <p class="eyebrow">Gestione soci · sola lettura</p>
    <h1>Richieste di adesione</h1>
    <p class="intro">Consulta le domande ricevute, dalla più recente alla meno recente. I dati vengono letti dal foglio Alma Tellus.</p>
    <div class="stats" aria-label="Riepilogo">
      <div class="stat"><strong id="total">—</strong><span>Richieste totali</span></div>
      <div class="stat"><strong id="received">—</strong><span>Da valutare</span></div>
    </div>
    <div class="controls">
      <input id="search" type="search" placeholder="Cerca nome, email, tipo o ID" aria-label="Cerca richieste">
      <select id="status" aria-label="Filtra per stato"><option value="">Tutti gli stati</option></select>
      <button id="refresh" type="button">Aggiorna</button>
    </div>
    <p class="meta" id="message" role="status" aria-live="polite">Caricamento delle richieste…</p>
    <div id="list"></div>
  </main>
  <script>
    (function () {
      'use strict';
      var requests = [];
      var search = document.getElementById('search');
      var status = document.getElementById('status');
      var message = document.getElementById('message');
      var list = document.getElementById('list');
      var refresh = document.getElementById('refresh');
      function el(tag, className, value) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (value !== undefined) node.textContent = value;
        return node;
      }
      function addDetail(dl, key, value) {
        if (!value) return;
        dl.appendChild(el('dt', '', key));
        dl.appendChild(el('dd', '', value));
      }
      function draw() {
        var query = search.value.trim().toLocaleLowerCase('it');
        var chosen = status.value;
        var shown = requests.filter(function (item) {
          var text = [item.name, item.email, item.type, item.status, item.id].join(' ').toLocaleLowerCase('it');
          return (!chosen || item.status === chosen) && text.indexOf(query) !== -1;
        });
        document.getElementById('total').textContent = String(requests.length);
        document.getElementById('received').textContent = String(requests.filter(function (item) {
          return /^(ricevuta|in valutazione)$/i.test(item.status);
        }).length);
        message.textContent = shown.length + ' richieste visualizzate su ' + requests.length;
        list.replaceChildren();
        if (!shown.length) {
          list.appendChild(el('p', 'empty', requests.length ? 'Nessuna richiesta corrisponde alla ricerca.' : 'Non ci sono ancora richieste.'));
          return;
        }
        var fragment = document.createDocumentFragment();
        shown.forEach(function (item) {
          var card = el('article', 'card');
          var head = el('div', 'card-head');
          var identity = el('div');
          identity.appendChild(el('h2', '', item.name || 'Richiesta senza nome'));
          identity.appendChild(el('span', 'date', item.date || 'Data non indicata'));
          head.appendChild(identity);
          head.appendChild(el('span', 'badge' + (/^ricevuta$/i.test(item.status) ? ' pending' : ''), item.status || 'Stato non indicato'));
          card.appendChild(head);
          var summary = el('div', 'summary');
          if (item.type) summary.appendChild(el('span', '', item.type));
          if (item.outcome) summary.appendChild(el('span', '', 'Esito: ' + item.outcome));
          card.appendChild(summary);
          var details = el('details');
          details.appendChild(el('summary', '', 'Mostra dettagli'));
          var dl = el('dl');
          addDetail(dl, 'Email', item.email);
          addDetail(dl, 'ID richiesta', item.id);
          item.details.forEach(function (field) { addDetail(dl, field.label, field.value); });
          details.appendChild(dl);
          card.appendChild(details);
          fragment.appendChild(card);
        });
        list.appendChild(fragment);
      }
      function load() {
        refresh.disabled = true;
        message.textContent = 'Caricamento delle richieste…';
        google.script.run
          .withSuccessHandler(function (data) {
            requests = data;
            refresh.disabled = false;
            var allStates = el('option', '', 'Tutti gli stati');
            allStates.value = '';
            status.replaceChildren(allStates);
            var states = Array.from(new Set(requests.map(function (item) { return item.status; }).filter(Boolean))).sort();
            states.forEach(function (state) {
              var option = el('option', '', state);
              option.value = state;
              status.appendChild(option);
            });
            draw();
          })
          .withFailureHandler(function (error) {
            refresh.disabled = false;
            message.textContent = '';
            list.replaceChildren(el('p', 'error', error.message || 'Non riesco a leggere le richieste.'));
          })
          .leggiRichiesteAdesioneWeb();
      }
      search.addEventListener('input', draw);
      status.addEventListener('change', draw);
      refresh.addEventListener('click', load);
      load();
    }());
  </script>
</body>
</html>`;
