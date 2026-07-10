# Alma Tellus, sito ristrutturato

Questa versione usa Jekyll, supportato nativamente da GitHub Pages.

## Cosa è stato centralizzato

- menu in `_data/navigation.yml`;
- intestazione in `_includes/header.html`;
- footer in `_includes/footer.html`;
- struttura HTML comune in `_layouts/default.html`;
- stile in `assets/css/site.css`;
- JavaScript in `assets/js/site.js`;
- configurazione del modulo in `config.js`.

## Come pubblicare

1. Conservare nel repository i file già presenti che non fanno parte del sito,
   in particolare `Code.gs` e i file README.
2. Caricare nella radice del repository tutto il contenuto di questa cartella.
3. Quando GitHub chiede conferma, sostituire i file HTML omonimi.
4. Non rinominare le cartelle che iniziano con il carattere `_`.
5. Attendere il completamento del deploy di GitHub Pages.

Gli indirizzi pubblici esistenti restano invariati:
`/tesseramento.html`, `/soci.html`, `/contatti.html` e così via.

## Come modificare il menu

Aprire `_data/navigation.yml`. Per aggiungere una pagina:

```yaml
- label: Nome mostrato
  url: /nome-pagina.html
```

La nuova voce apparirà automaticamente in tutte le pagine.

## Come creare una nuova pagina

Creare per esempio `progetti.html`:

```html
---
layout: default
title: Progetti
description: I progetti di Alma Tellus.
permalink: /progetti.html
---

<section class="page-shell">
  <header class="page-heading">
    <p class="eyebrow">Alma Tellus</p>
    <h1>Progetti</h1>
  </header>

  <div class="surface">
    Contenuto della pagina.
  </div>
</section>
```

Poi aggiungere la relativa voce in `_data/navigation.yml`.

## Pagina Sostenitori

La pagina è già presente. Prima di pubblicare il nome o il logo di un donatore
è opportuno acquisire la sua autorizzazione.

## Moduli

I nomi dei campi e l'indirizzo della Web App Google sono stati mantenuti
compatibili con l'impostazione attuale.
