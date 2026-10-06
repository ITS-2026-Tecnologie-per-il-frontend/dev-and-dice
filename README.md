# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Catalogo JSON da Wikidot

Il file `public/data/wikidot-spells.json` contiene i metadati estratti dall'indice
<https://dnd5e.wikidot.com/spells>: identificativo, nome, livello, scuola, tempo di
lancio, portata, durata, componenti, rituale, materiale UA e URL della fonte.
Non contiene i testi descrittivi delle pagine dei singoli incantesimi.
Le descrizioni italiane degli incantesimi SRD sono in `database.json`.

Per aggiornare il catalogo, con Python 3 e senza installare dipendenze:

```sh
python3 scripts/scrape_wikidot.py
```

Lo script controlla `robots.txt` e scarica soltanto l'indice, senza visitare tutte
le pagine degli incantesimi. Per usare una copia HTML già scaricata:

```sh
python3 scripts/scrape_wikidot.py --html /percorso/spells.html
```

`durationInfo.rounds` indica il numero di round da 6 secondi. Per le durate
"up to" è il massimo; la concentrazione può interromperle prima.
Gli effetti istantanei hanno `rounds: 0`; le durate condizionali, indefinite o
alternative hanno `rounds: null` e richiedono una scelta, senza inventare un
conteggio. `duration` conserva sempre il valore originale del sito.
Il catalogo include anche gli incantesimi UA identificati dal sito.

Il JSON è un catalogo separato: non modifica le schede salvate e non è ancora
collegato ai selettori dell'app. Le durate dell'indice possono essere diverse
dalle cinque opzioni attualmente supportate dalle schede.

### Mostri e PNG

Nella navigazione e nella sitemap delle 2.666 pagine di dnd5e.wikidot.com,
controllate il 6 ottobre 2026, non è stato individuato un catalogo di stat block
per mostri o PNG. Le pagine Goblin/Kobold dell'indice delle razze sono opzioni
per personaggi, non schede dei mostri del bestiario.
Non vengono quindi generati file di mostri vuoti o dati attribuiti a questa
fonte senza averli trovati. Per questa parte serve un URL del bestiario o una
fonte distinta, ad esempio un catalogo SRD 5e pubblico.

Controllo riproducibile dello scraper:

```sh
python3 tests/scrape_wikidot.py
```

La scrittura del JSON avviene sostituendo il file solo dopo un'estrazione valida;
in caso di errore, il catalogo precedente viene conservato.

## Bestiario da Dungeon e Draghi

`public/data/dungeonedraghi-bestiary.json` contiene tutte le 321 creature presenti
nel catalogo <https://dungeonedraghi.it/compendio/bestiario/> al momento
dell'estrazione: 202 mostri, 98 creature varie e 21 PNG.

Per rigenerarlo:

```sh
python3 scripts/scrape_bestiary.py
```

Lo script legge la categoria `bestiario` dalla API pubblica WooCommerce dello
stesso sito. Scarica 100 voci per pagina con una pausa fra le richieste, controlla
`robots.txt`, verifica il totale e gli identificativi, quindi sostituisce il JSON
solo quando tutte le schede sono state estratte correttamente.

Il catalogo ha due liste:

- `creatures`: statistiche, le sei caratteristiche con i modificatori, categoria,
  grado di sfida, PF e CA numerici, URL della fonte e riferimenti alle abilità.
- `abilities`: nomi e descrizioni complete di tratti, azioni, reazioni e azioni leggendarie, identificativo
  della creatura proprietaria e dati meccanici riconosciuti nel testo: bonus a
  colpire, CD e formule di dadi. Le formule non sono automaticamente classificate
  come danno: possono indicare cure o altre quantità.

Le schede e le abilità includono `description`, con il testo completo
dell'SRD pubblicato dal sito, in forma leggibile senza HTML. Le immagini
non vengono copiate. Ogni voce conserva anche `sourceUrl`. La licenza OGL
e le attribuzioni della fonte sono incluse nel catalogo e in `ogl-1.0a.txt`.
`durationRounds` resta `null`: un tratto permanente, un attacco o una menzione di
"1 minuto" nel testo non equivalgono necessariamente a un effetto con timer.
Il JSON alimenta la ricerca del catalogo; le schede personali restano salvate separatamente nel browser.

I dati mancanti non vengono inventati. La Mosca Gigante e l'Avatar della Morte
non riportano il grado di sfida. I PF dell'Avatar dipendono dall'evocatore e
restano un'espressione in `stats.hitPoints`, con `hitPoints: null`. Il Mezzodrago
Rosso Veterano contiene blocchi duplicati per sensi e linguaggi: viene mantenuto
l'ultimo valore della scheda. Questi casi sono segnalati in `warnings`.

È possibile elaborare una risposta già scaricata, nel formato `{total, entries}`:

```sh
python3 scripts/scrape_bestiary.py --input /percorso/risposta.json
python3 tests/scrape_bestiary.py
```

## Database JSON completo

`public/data/database.json` riunisce i cataloghi in un unico file:

- `creatures`: 321 schede con statistiche e descrizione completa.
- `abilities`: 1.534 tratti e azioni con descrizione completa, collegati alle
  creature tramite `creatureId` e `abilityIds`.
- `spells`: 319 incantesimi SRD in italiano da Dungeon e Draghi, con descrizione
  completa, nome inglese, livello, scuola, componenti, durata e sezioni originali
  (effetto, uso ai livelli superiori, tabelle e altre opzioni).
- `spellIndex`: i 574 metadati Wikidot già estratti; i testi completi non sono
  inclusi in questa raccolta. Le due fonti rimangono distinte e non vengono unite
  automaticamente in base a nomi tradotti.
- `sources` e `licenses`: provenienza dei dati e testo completo della OGL 1.0a,
  comprese le attribuzioni della traduzione SRD usata dal sito.

I testi completi sono limitati al materiale SRD distribuito dal sito sotto OGL:
<https://dungeonedraghi.it/licenza-ogl/>. Non includono immagini o Product Identity.
Gli incantesimi mantengono anche i valori originali in `sections`; per le durate
incerte `durationInfo.rounds` è `null`, senza dedurre un timer dal testo dell'effetto.

Per aggiornare i cataloghi e ricostruire il database:

```sh
python3 scripts/scrape_wikidot.py
python3 scripts/scrape_bestiary.py
python3 scripts/build_database.py
```

L'ultimo comando legge i cataloghi locali e scarica gli incantesimi italiani
tramite quattro pagine della API pubblica. Può lavorare senza rete fornendo una
risposta già scaricata nel formato `{total, entries}`:

```sh
python3 scripts/build_database.py --spell-input /percorso/incantesimi.json
python3 tests/scrape_bestiary.py
```

Il database viene scritto solo dopo aver verificato completezza, descrizioni e
collegamenti. I file sono statici: non sostituiscono le schede personali salvate
nel browser. L'interfaccia carica `database.json` per suggerire nomi e compilare i dati.


## Ricerca e dettagli del catalogo

Nei nomi dei partecipanti, delle nuove schede e delle abilità, scrivere anche
solo una parte del nome mostra i risultati del database (senza distinzione di
maiuscole e accenti). Si può scegliere con il mouse oppure con le frecce e
Invio; Esc chiude i suggerimenti. È sempre possibile scrivere nomi personali.
Le abilità omonime indicano la creatura di origine; gli incantesimi italiani e
l'indice inglese sono riconoscibili nell'elenco.

Scegliere una creatura copia PF, CA, caratteristiche, GS, descrizione e abilità.
Per mostri e PNG l'iniziativa resta vuota, anche importando una scheda salvata:
il modificatore di Destrezza compare come suggerimento nel campo, e il risultato
del tiro va inserito manualmente. La finestra Altro mostra entrambi i valori.
Gli incantesimi con durata nota compilano i turni; per durate non definite si
usa `Personalizzata`, con 0 come assenza di conteggio. Le abilità attivate
mantengono l'attivazione definitiva e non possono essere sostituite dal catalogo.

Il pulsante **Altro** nelle card apre una finestra con descrizione, dati e fonte.
Funziona anche per voci personali, mostrando le informazioni compilate. I
riferimenti al catalogo e i turni personalizzati si conservano nelle schede
salvate, senza copiare tutto il database nel localStorage.

Controlli della ricerca, compilazione e compatibilità delle schede salvate:

```sh
node --experimental-strip-types tests/catalog.mjs
node --experimental-strip-types tests/combat.mjs
```
