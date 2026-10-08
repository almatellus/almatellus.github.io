# CED in tempo reale

Servizio Cloudflare Worker + Durable Object con storage SQLite (compatibile con il piano Workers Free).
La pagina CED riceve i programmi via WebSocket. Le connessioni inattive possono ibernarsi.
Il servizio trasporta il sorgente; l'esecuzione rimane la demo COBOL nel browser.

## Invio da ChatGPT attraverso il collegamento GitHub

1. ChatGPT aggiorna ced/live.json sul ramo dedicato **ced-live**.
2. Il messaggio del commit contiene il programma dopo il prefisso esatto CED-LIVE/1 seguito da una nuova riga.
3. GitHub invia un webhook push firmato al servizio Cloudflare.
4. Il servizio verifica firma, repository, ramo, formato e ordine, poi invia il programma ai monitor.
5. Nessuna pubblicazione GitHub Pages viene avviata dai nuovi programmi sul ramo ced-live.

Il contenuto del commit è pubblico, come il sorgente già mostrato dalla pagina.
Nel messaggio e nel file si usa lo stesso JSON:

    {"id":"identificatore-unico","createdAt":1791494000000,"request":"Richiesta","code":"Sorgente COBOL"}

createdAt è l'istante di preparazione in millisecondi Unix, preservato quando si riprova lo stesso invio.
Il servizio ignora invii più vecchi e non ritrasmette duplicati. Un ID riusato con un contenuto diverso è rifiutato.

## Attivazione, una volta sola

- Accedere all'account Cloudflare e pubblicare dalla cartella ced-realtime con Wrangler:
  npx wrangler deploy
- Configurare il segreto GITHUB_WEBHOOK_SECRET su Cloudflare:
  npx wrangler secret put GITHUB_WEBHOOK_SECRET
- Creare il ramo ced-live da main. La sorgente GitHub Pages continua a essere main.
- Creare un webhook nel repository almatellus/almatellus.github.io:
  URL del servizio + /github, Content type application/json, stesso segreto, SSL attivo, solo eventi push.
- Verificare che il ping del webhook abbia ricevuto HTTP 200.
- Inviare un programma di prova sul ramo ced-live con il messaggio di commit indicato sopra.
- Verificare il ricevimento su /latest (Origin https://almatellus.it) e una connessione WebSocket a /ws.
- Inserire l'origine HTTPS reale del servizio workers.dev nel campo relayUrl di ced/realtime.json.
- Pubblicare su main la pagina aggiornata e la configurazione una sola volta.
- Con la pagina CED aperta, inviare un secondo programma da ChatGPT e misurare il tempo di comparsa.

Attivare il collegamento sulla pagina pubblica solo dopo aver provato servizio e webhook.
Il segreto non deve comparire nel codice, nella pagina, nei commit o nelle risposte in chat.

## Prove locali

    cd ced-realtime
    npm test

Le prove controllano firma ufficiale GitHub, invii Unicode, firme mancanti/errate,
ramo/repository estranei, duplicati, ordine degli invii, ripresa dell'ultimo programma,
accesso dei lettori e stabilità della pagina. Usano storage e socket simulati:
non sostituiscono il test completo su Cloudflare.

## Stato della preparazione

Il servizio e il client sono preparati nel ramo ced-realtime-setup.
Il servizio non è ancora pubblicato e non è stata effettuata una misura in rete.
Il blocco corrente è l'accesso a Cloudflare: accesso Google interrotto da un errore 502.
