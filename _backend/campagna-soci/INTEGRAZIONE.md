# Campagna nuovi soci: integrazione nel progetto Google corrente

Il sito raccoglie richieste con le categorie e le quote già accettate dal server, aggiungendo le condizioni della campagna nel campo Validità tessera e nella Motivazione. Non modifica i link personali di pagamento esistenti.

Il file email-accettazione.txt è il testo preparato, non una mail già attivata.

Prima di aggiornare il progetto Google occorre recuperarne il codice corrente. La copia Codice.gs del 23 settembre non è utilizzabile come sostituzione: sono intervenute modifiche a soci, pagamenti e email.

Da integrare nel flusso corrente:
1. Applicare la campagna solo alle nuove richieste con il marcatore Campagna nuovi soci: 6 mesi gratuiti, senza modificare i soci già iscritti.
2. Alla decisione di ammissione, salvare in colonne dedicate la data di inizio e la data di fine del periodo gratuito (sei mesi di calendario, con fine mese limitata ai giorni esistenti). Stato socio valido anche con quota non ancora versata.
3. Usare il testo email-accettazione.txt, conservando la generazione e validazione del link personale già presenti, e l’idempotenza dell’invio.
4. Se il pagamento arriva durante il periodo gratuito, calcolare la scadenza annuale dalla fine del periodo gratuito; se arriva dopo, dalla data del pagamento. Aggiornare sia la riconciliazione SumUp sia l’eventuale registrazione manuale.
5. Programmare un promemoria prima della scadenza, una sola volta per socio non già pagante, con data invio registrata e possibilità di ripresa in caso di errore.
6. Allineare le informazioni nella pagina personale di pagamento. Non inviare una seconda richiesta di pagamento a chi ha già pagato.

Stato: integrazione Google non ancora applicata; serve accesso autenticato al progetto corrente. Nessuna email è stata inviata durante il lavoro sul sito.
