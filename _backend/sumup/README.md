# Incassi SumUp nell'area riservata Alma Tellus

Modulo pronto per l'aggiunta al progetto Google Apps Script esistente. **Non ancora installato nel deployment live.**

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
- Chiamate SumUp esclusivamente GET: il modulo non incassa, rimborsa, modifica pagamenti o registra quote nel Libro soci.
- Filtri per date italiane, inclusa l'intera giornata finale; filtri locali per importo 5/15 euro e pagamenti ricevuti/tentativi.
- Esclusione dei contanti registrati e degli eventi di rimborso/storno separati per evitare doppio conteggio. Ogni transazione originale viene conteggiata una sola volta.
- Importi raggruppati per valuta. Rimborsi parziali detratti, se noti; dati mancanti indicati come non disponibili.
- Commissioni lette nel dettaglio, senza stime. Gli incassi non vengono presentati come accrediti bancari.
- Paginazione sul server, massimo 20 pagine e 45 secondi tra le richieste. Risultati incompleti chiaramente segnalati; i totali non vengono presentati come completi.
- Chiavi e risposte di errore grezze non sono restituite al browser. Nessun dato personale o segreto è salvato nel repository.

Il file di gestione recuperato è del 4 ottobre 2026. La modifica va aggiunta al **codice corrente** del progetto, preservando le modifiche successive su soci, email e pagamenti.

Documentazione ufficiale: [SumUp Transactions](https://developer.sumup.com/api/transactions), [SumUp API Keys](https://developer.sumup.com/tools/authorization/api-keys), [Google PropertiesService](https://developers.google.com/apps-script/reference/properties/properties-service).
