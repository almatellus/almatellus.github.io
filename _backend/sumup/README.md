# Incassi SumUp nell'area riservata Alma Tellus

Incassi installati nell'area riservata. Il modulo `SumUpQuote.gs` aggiunge link personali permanenti e riconciliazione delle nuove quote.

## Installazione

1. Aggiungere `SumUp.gs` come nuovo file script e `SumUpIncassi.html` come nuovo file HTML (nome nell'editor: `SumUpIncassi`). Non sostituire il codice esistente.
2. All'inizio della funzione `doGet(e)` già presente inserire solo questo ramo, lasciando tutti gli altri:

```javascript
if (e && e.parameter && e.parameter.view === 'incassi-sumup') {
  return paginaWebIncassiSumUp_();
}
```

3. Nel menu dell'area riservata aggiungere **Incassi SumUp**, puntando allo stesso URL del deployment riservato con `?view=incassi-sumup`. Il deployment attuale è già riportato in `SUMUP_AREA_URL_`.
4. In **Impostazioni progetto → Proprietà dello script** aggiungere `SUMUP_API_KEY` (chiave segreta dell'account Alma Tellus) e `SUMUP_MERCHANT_CODE` (codice esercente).
5. Aggiornare la versione del **deployment riservato già esistente**, mantenendo esattamente le sue impostazioni di accesso. Non modificare il deployment pubblico dei moduli del sito. Autorizzare `UrlFetchApp` se richiesto.
6. Aprire la pagina con l'account dell'associazione; confrontare una transazione reale e il totale del periodo con il cruscotto SumUp. Verificare che un account non autorizzato non possa leggere pagina, elenco o dettaglio.

La chiave va generata in **SumUp → Impostazioni → Per sviluppatori → Toolkit → API Keys**, sul profilo reale dell'associazione. Non usare una chiave pubblica o un account di prova. Nessuna chiave deve essere incollata in HTML, in questo repository, nel foglio soci o nella chat.

## Comportamento

- Controllo server di accesso con la funzione esistente `controllaAccessoRichiesteWeb_()` prima di ogni chiamata. In sua assenza l'accesso viene negato.
- Incassi letti via GET; il modulo quote crea checkout via POST senza addebitare carte. Non esegue rimborsi e non riceve dati delle carte.
- Filtri per date italiane, inclusa l'intera giornata finale; filtri locali per importo 5/15 euro e pagamenti ricevuti/tentativi.
- Esclusione dei contanti registrati e degli eventi di rimborso/storno separati per evitare doppio conteggio. Ogni transazione originale viene conteggiata una sola volta.
- Importi raggruppati per valuta. Rimborsi parziali detratti, se noti; dati mancanti indicati come non disponibili.
- Commissioni lette nel dettaglio, senza stime. Gli incassi non vengono presentati come accrediti bancari.
- Paginazione sul server, massimo 20 pagine e 45 secondi tra le richieste. Risultati incompleti chiaramente segnalati; i totali non vengono presentati come completi.
- Chiavi e risposte di errore grezze non sono restituite al browser. Nessun dato personale o segreto è salvato nel repository.

Il file di gestione recuperato è del 4 ottobre 2026. La modifica va aggiunta al **codice corrente** del progetto, preservando le modifiche successive su soci, email e pagamenti.

Documentazione ufficiale: [SumUp Transactions](https://developer.sumup.com/api/transactions), [SumUp API Keys](https://developer.sumup.com/tools/authorization/api-keys), [Google PropertiesService](https://developers.google.com/apps-script/reference/properties/properties-service).

## Link permanenti delle quote

- Il socio riceve `https://almatellus.it/paga.html#TOKEN`, con un token casuale di 64 caratteri e senza scadenza. Token, riferimento della richiesta, quota e sessioni sono conservati nel foglio **Pagamenti SumUp**. Questo foglio contiene dati riservati e segue l'accesso del documento soci.
- All'accettazione si prepara e valida il link prima delle scritture nel Libro soci; la mail parte dal flusso esistente. Non si crea ancora un checkout SumUp.
- Quando il socio apre il link, si crea o riusa un Hosted Checkout di durata 30 minuti. Le successive aperture del link permanente generano una nuova sessione quando la precedente è conclusa. Le sessioni hanno riferimenti univoci salvati prima della richiesta, per recuperare una risposta persa senza creare un secondo pagamento.
- Il webhook, la pagina personale e **Aggiorna** nell'elenco soci o negli incassi verificano le transazioni presso SumUp. Esito, riferimento, commerciante, valuta e importo devono corrispondere. Soltanto una transazione riuscita può aggiornare quota versata, data reale del pagamento e scadenza annuale.
- Un pagamento già registrato, anche manualmente, mostra **Quota già pagata**. Negli incassi compare il socio cui è associata la quota; questo dato non identifica necessariamente il titolare della carta.
- Le mail già inviate con link condivisi conservano il comportamento precedente. I pagamenti precedenti non vengono associati a un socio per supposizione.

### Integrazione con il codice corrente

1. Aggiungere `SumUpQuote.gs` e `SumUpQuota.html` al progetto esistente. Aggiornare `SumUp.gs` e `SumUpIncassi.html` con le integrazioni opzionali presenti in questi file.
2. Esportare il **Codice.gs corrente**, poi applicare `python3 patch-permanent-links.py CURRENT.gs UPDATED.gs`. Il programma controlla ogni punto di integrazione e si interrompe se il codice non coincide. Non usare una vecchia esportazione del progetto.
3. Verificare dal server la creazione di un checkout senza addebito e conservare il suo ID nella proprietà protetta `SUMUP_PROVA_CHECKOUT_ID`; eseguire `sumupAttivaLinkPermanenti` per attivare `SUMUP_LINK_PERMANENTI_READY`.
4. Aggiornare sia il deployment riservato sia il deployment pubblico dei moduli, mantenendo **Solo io** per il primo e le impostazioni già esistenti per il secondo. Il pubblico espone la pagina della singola quota mediante token e il webhook; le funzioni amministrative controllano l'identità sul server.
5. Pubblicare `paga.html` sul sito. Non aggiungere analytics o servizi esterni a questa pagina: il token personale resta nel frammento e non viene inoltrato nei referrer.

Controlli locali: `node --test tests/sumup.test.cjs` e `ALMA_CURRENT_CODE=UPDATED.gs node --test tests/quote.test.cjs`. Una transazione pagata reale richiede una prova del titolare: le verifiche automatiche non addebitano denaro.
