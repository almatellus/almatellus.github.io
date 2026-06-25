Aggiornamento Alma Tellus: contatti e footer

File da sostituire nel repository GitHub:
- index.html
- soci.html
- grazie.html
- associazione.html
- contatti.html
- style.css

Non sostituire config.js: contiene gia l'URL della Web App Google configurato.

Passaggi GitHub:
1. Copiare i file HTML e CSS nel repository locale.
2. Aprire GitHub Desktop.
3. Summary: Aggiunti contatti e footer istituzionale
4. Commit to main
5. Push origin

Passaggi Google Apps Script:
1. Aprire Apps Script del modulo soci.
2. Sostituire il contenuto di Code.gs con il file Code.gs incluso in questo pacchetto.
3. Salvare.
4. Eseguire setup.
5. Eseguire testInvioAliasInfo.
6. Distribuisci > Gestisci distribuzioni > Modifica > Nuova versione > Distribuisci.

Perche serve aggiornare Apps Script:
La nuova pagina contatti.html invia i dati alla stessa Web App Google usata dal modulo soci.
Il nuovo Code.gs distingue automaticamente:
- form_type = socio
- form_type = contatto

Il modulo contatti crea un nuovo foglio:
- Contatti sito

e invia:
- email interna all'associazione
- conferma al mittente
