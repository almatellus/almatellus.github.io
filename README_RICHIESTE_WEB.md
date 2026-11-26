# Richieste di adesione · pagina web riservata

Questa pagina legge in sola lettura la scheda `Richieste adesione` del foglio
collegato al progetto Apps Script di Alma Tellus. Non cambia lo stato delle
domande, non modifica le celle e non invia email.

## Installazione nel progetto Apps Script esistente

1. Nell'editor del progetto aggiungere `richieste-web.gs` come **nuovo file di script**
   e incollarne il contenuto.
2. In `Codice.gs` cambiare l'inizio della funzione `doGet` da:

   ```javascript
   function doGet() {
     return htmlOutput_(`
   ```

   a:

   ```javascript
   function doGet(e) {
     if (e && e.parameter && e.parameter.view === 'richieste') {
       return paginaWebRichiesteAdesione_();
     }
     return htmlOutput_(`
   ```

   Il resto di `Codice.gs` resta identico.
3. Salvare il progetto.
4. In **Esegui il deployment → Nuovo deployment → App web**, scegliere
   **Esegui come: Utente che accede all'app web** e **Chi ha accesso: Solo io**;
   distribuire con l'account Alma Tellus. **Non aggiornare** il deployment pubblico
   già usato dal modulo di adesione.
5. Aprire l'URL fornito da Google aggiungendo `?view=richieste` dopo `/exec`.
   La pagina chiede l'accesso con l'account Alma Tellus e legge le domande dal foglio.

Il codice consente solo gli indirizzi `associazione.almatellus@gmail.com` e
`info@almatellus.it`. Se l'account proprietario del foglio usa un altro
indirizzo Google, va aggiunto nell'array `RICHIESTE_WEB_ADMIN_EMAILS_`.

Un URL sul sito pubblico non può leggere direttamente i dati privati dal
foglio; la pagina è ospitata dall'app web Google riservata a chi la distribuisce.
