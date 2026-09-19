# ShareLab — guida operativa

Questa guida permette di riprendere la catalogazione anche in una nuova conversazione.

## Sito e repository

- Catalogo pubblico: https://almatellus.github.io/sharelab/
- Repository: `almatellus/almatellus.github.io`
- Branch: `main`
- Pagina catalogo: `sharelab/index.html`
- Immagini: `assets/sharelab/SL-NNN.jpg`

## Regola di lavoro

1. L'utente invia una o più foto dello stesso oggetto.
2. Identificare nome, categoria, sottocategoria, descrizione, quantità e sacchetto.
3. Se l'identificazione è certa, pubblicare immediatamente immagine e scheda.
4. Se rimane un dubbio sostanziale, non pubblicare: chiedere soltanto la foto o il dettaglio necessario.
5. Comunicare sempre all'utente il sacchetto fisico/virtuale in cui riporre l'oggetto.
6. Oggetti identici già catalogati aggiornano la quantità della scheda esistente; non creare duplicati.
7. I sacchetti devono essere pochi e pratici: la categoria del catalogo può essere più specifica del sacchetto.

## Sacchetti attivi

- `V1.01` — USB e dati
- `V1.02` — Video e TV (comprende anche cavi antenna)
- `V1.03` — Audio
- `V1.04` — Rete
- `V1.06` — Alimentazione 230V
- `V1.07` — Bassa tensione
- `V1.99` — Da identificare (non pubblicare finché permane il dubbio)

Il vecchio `V1.05 — Antenna` non va usato: gli oggetti antenna confluiscono in `V1.02 — Video e TV`.

## Numerazione

Ultimo oggetto pubblicato: `SL-019`.

Prossimo codice disponibile: **`SL-020`**.

## Formato della scheda

```javascript
{
  code: 'SL-NNN',
  name: 'Nome preciso',
  category: 'Categoria',
  subcategory: 'Sottocategoria',
  description: 'Descrizione chiara con connettori, funzione e particolarità visibili.',
  bag: 'V1.XX',
  bagName: 'Nome sacchetto',
  quantity: 1,
  image: '/assets/sharelab/SL-NNN.jpg'
}
```

## Stato al termine della sessione

- Catalogati gli oggetti da `SL-001` a `SL-013`.
- `SL-012` è un cavo antenna TV IEC 9,5 mm, quantità 2, riposto in `V1.02 — Video e TV`.
- `SL-013` è un'interfaccia USB–MIDI IN/OUT, riposta in `V1.03 — Audio`.
- `SL-014` è un cavo audio AUX jack 3,5 mm maschio–maschio, riposto in `V1.03 — Audio`.
- `SL-015` è un cavo FireWire IEEE 1394a 4 poli → 6 poli, riposto in `V1.01 — USB e dati`.
- `SL-016` è un cavo USB-A → Mini-USB Tipo B, quantità 5, riposto in `V1.01 — USB e dati`.
- `SL-017` è un cavo USB-A → Micro-USB Tipo B con ferrite, riposto in `V1.01 — USB e dati`.
- `SL-018` è un cavo USB-A → USB-B per stampante, riposto in `V1.01 — USB e dati`.

- `SL-019` è un cavo USB-A → Micro-USB Tipo B, quantità 4, riposto in `V1.01 — USB e dati`.
