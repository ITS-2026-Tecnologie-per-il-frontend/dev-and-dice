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

## Cataloghi per la creazione dei personaggi

I cataloghi in `public/data` descrivono D&D 5e **2014 / SRD 5.1**. Non vengono
mescolati con bonus di specie e background dell'edizione 2024.

- `character-options.json`: 12 classi, 12 sottoclassi SRD, 290 righe di progressione
  di classe/sottoclasse, 407 privilegi, 9 razze, 4 sottorazze, 38 tratti,
  competenze, linguaggi, allineamenti, il background e il talento SRD, 319
  incantesimi con riferimenti alle classi. Le 12 classi e 9 razze includono
  anche i testi italiani scaricati da Dungeon e Draghi, suddivisi in sezioni
  e tabelle in `localizations.it`.
- `character-equipment.json`: 237 oggetti di equipaggiamento, armi e armature,
  362 oggetti magici, proprietà delle armi, categorie e tipi di danno. Le
  statistiche mantengono le unità originali, piedi e libbre.
- `character-rules.json`: caratteristiche, 18 abilità, condizioni, regole SRD
  in inglese e articoli italiani; 18 formule e 26 interpretazioni strutturate
  di effetti di razza/classe, bonus di competenza per livello, tabella dei
  modificatori, generazione delle caratteristiche, point buy e soglie PE.
- `wiki-character-index.json`: 382 riferimenti alle opzioni del giocatore
  estratti dagli indici di Wikidot e Dungeon e Draghi. Sono **nomi e URL**:
  non contengono i testi integrali delle opzioni non SRD, né bonus validati
  da applicare automaticamente. Varianti, setting, UA e homebrew restano da
  verificare prima di usarli.
- `character-catalog.json`: conteggi, fonti, licenze, checksum dei file,
  copertura italiana e richieste fallite. Le pagine italiane in timeout sono
  segnalate; i relativi argomenti restano disponibili nel catalogo inglese.

La struttura inglese deriva dai file pubblici di `5e-bits/5e-database`:
<https://github.com/5e-bits/5e-database/tree/main/src/2014/en>.
I testi italiani provengono da <https://dungeonedraghi.it/compendio/classi/>,
<https://dungeonedraghi.it/compendio/razze/> e <https://dungeonedraghi.it/regole/>.
Gli indici aggiuntivi provengono da <https://dnd5e.wikidot.com/>. Le regole di
generazione, PE e variazioni dei PF sono state verificate sulle Basic Rules 2014
ufficiali: <https://www.dndbeyond.com/sources/dnd/basic-rules-2014/step-by-step-characters>.
Le attribuzioni OGL sono in `ogl-1.0a.txt`; la licenza della struttura del
database sorgente è in `srd-database-license.txt`. Non vengono copiate immagini.

Per scaricare ed esportare, con Python 3 e senza dipendenze aggiuntive:

```sh
python3 scripts/scrape_character_data.py
python3 scripts/scrape_character_data.py --refresh
```

Lo scraper controlla `robots.txt` per le wiki, limita il crawling alla sezione
delle regole, attende fra le richieste e mantiene una cache in
`character-source.local`, esclusa dal versionamento. Le API italiane possono
andare in timeout: classi, razze e regole vengono quindi lette dalle pagine HTML.
I JSON strutturati SRD vengono scaricati in blocco, senza migliaia di richieste
alle singole voci dell'API. `--download-only` salva soltanto lo snapshot;
`--refresh` aggiorna le risposte memorizzate. Per ricostruire senza rete:

```sh
python3 scripts/scrape_character_data.py --input character-source.local/srd-snapshot.json
python3 tests/character_catalog.py
```

I riferimenti tra i nuovi cataloghi usano identificativi `srd2014:...`; i campi
originali della fonte vengono conservati. `fixedAbilityBonuses` separa i bonus
razziali fissi da `abilityBonusChoices`. Le sottorazze ereditano la razza base.
`levelIds` collega la classe alla sua progressione 1–20 e `hitPoints` riporta
dado vita, valore iniziale e valore fisso dei livelli successivi. I riferimenti
in `proficiency_choices`, equipaggiamento iniziale e multiclassamento conservano
le alternative, senza scegliere al posto del giocatore.

Le formule sono alberi JSON di operazioni aritmetiche, **non codice da eseguire**.
Vantaggio e svantaggio restano stati del tiro; la maestria sostituisce il
moltiplicatore della competenza. Le formule della CA sono alternative e non
vanno sommate. La competenza dipende dal livello totale, mentre privilegi e
slot dipendono dal livello nella classe. Gli effetti condizionali o con scelte
vanno applicati solo quando il contesto è noto. I privilegi non coperti da una
regola strutturata conservano la descrizione e richiedono valutazione manuale.

La scheda PG usa questi cataloghi per la **creazione guidata**. Classe, razza,
sottorazza, sottoclasse SRD, background e allineamento hanno menu a tendina;
sono conservati anche valori personalizzati. Le schede precedenti rimangono
manuali fino all'attivazione esplicita o alla scelta di un'opzione del catalogo.
Alla prima attivazione controllare i punteggi base: i bonus razziali si aggiungono
a questi valori, separati dai totali visualizzati nella scheda. Riattivare
l'automazione conserva i bonus precedenti senza aggiungerli due volte.

Si aggiornano caratteristiche, competenza, tiri salvezza, abilità, Percezione
passiva, DV, PF massimi con valore fisso ai livelli successivi, velocità,
linguaggi, competenze e descrizioni dei privilegi. I PF attuali già danneggiati
rimangono invariati. Le scelte di competenze, linguaggi, bonus variabili e
dotazioni iniziali si compilano nel pannello di creazione, comprese alternative
annidate e quantità. Gli oggetti magici non sono concessi dalle categorie di
equipaggiamento iniziale. Armatura e scudo vanno selezionati come indossati;
aggiornano CA, requisiti e svantaggio in Furtività. Le armi iniziali generano
attacchi con modificatore, competenza e danni ordinari (fino a sei righe).

Gli incantesimi sono filtrati per classe e livello, con nomi italiani quando
presenti nel catalogo esistente; slot, caratteristica magica, CD e bonus di
attacco seguono la progressione. Sono mostrati i limiti di trucchetti,
incantesimi conosciuti e preparati; nuove selezioni oltre il limite vengono
disabilitate. Il Mago può avere copie aggiuntive nel libro. Magie razziali di
Elfo alto e Tiefling sono separate dagli slot di classe. Cambiare classe o
livello conserva le magie già scritte e segnala quelle da verificare: nessuna
selezione viene cancellata senza intervento del giocatore. Le schede incompiute
restano salvabili come bozze.

Le modifiche ai campi generati diventano personalizzazioni persistenti;
**Ripristina i campi generati** riattiva i calcoli per quei campi. Multiclasse,
incrementi di caratteristica/talenti, magie di dominio/sottoclasse, stili di
combattimento e privilegi condizionali richiedono compilazione manuale. Sono
applicati i bonus di Robustezza draconica e la competenza nelle armature pesanti
del Dominio della Vita; gli altri privilegi di sottoclasse conservano il testo.
Il catalogo SRD comprende il solo background Accolito: gli altri si possono
scrivere come personalizzati. `database.json`, il combattimento e le schede
salvate mantengono il formato esistente; configurazione e scelte sono stringhe
in `playerDetails`, compatibili con il salvataggio precedente.

Verifica dell'autocompilazione con cataloghi reali:

```sh
node --experimental-strip-types tests/player-creation.mjs
node --experimental-strip-types tests/player-creation-ui.mjs
node --experimental-strip-types tests/player-sheet.mjs
```

I controlli offline verificano checksum, collegamenti, progressioni per livello,
scelte razziali, casi limite delle formule e conservazione dei file precedenti
in caso di esportazione non valida. Tutti i documenti vengono validati prima
della sostituzione; il manifest viene scritto per ultimo.


Per i PG salvati, l'aggiunta al combattimento elenca abilità e incantesimi della
scheda nella card dei turni, senza riempire subito la sezione Abilità. Il primo
clic su un nome importa solo quella voce, inattiva e collegata al PG; i clic
successivi scorrono alla card e la evidenziano per due secondi, senza duplicare
la voce né azzerarne il conteggio. Se una voce viene eliminata, può essere
importata di nuovo. Le abilità aggiunte direttamente dalla sezione Abilità
restano visibili fra i collegamenti del proprietario.

## Abilità da attivare nella scheda PDF

La colonna Abilità legge `classFeatures`, `racialTraits` e `additionalTraits`
dalla scheda PDF. I testi generati hanno il formato `Nome (livello N)` seguito
dalla descrizione, con una riga vuota tra privilegi; per testi personali usare
lo stesso formato `Nome` + descrizione su righe separate.

Il database possiede descrizioni, `automationStatus` e alcune `effectRules`,
ma non un campo universale di attivazione. `requiresPlayerChoice` non indica
necessariamente un'attivazione: può indicare una scelta di creazione, come uno
stile di combattimento. Le istruzioni sono in `src/utils/PlayerAbilities.ts`:

- Le azioni, azioni bonus, reazioni e alcune spese volontarie di risorse sono
  riconosciute nei testi italiani e inglesi. Le frasi negate vengono escluse.
- Un elenco di privilegi passivi verificati esclude casi come Scurovisione,
  Difesa senza armatura e Stile di combattimento: Difesa.
- I testi senza indizi sufficienti rimangono **da verificare**, senza importazione
  automatica. La conferma o l'esclusione manuale viene salvata in `playerDetails`.
- Solo alcune durate sono state verificate esplicitamente (per esempio Ira:
  1 minuto, 10 turni). Non si ricava una durata da una qualsiasi menzione di
  tempo: potrebbe essere un riposo, un costo o un altro effetto.
- Ogni voce permette di impostare la durata. **Senza conteggio** consente
  l'attivazione definitiva senza timer né scadenza automatica, anche per effetti
  istantanei. Non applica automaticamente danni, cure, risorse o bonus.

Questo riconoscimento è conservativo e non interpreta ogni regola D&D. I casi
ambigui e le durate condizionali richiedono verifica; i testi originali rimangono
consultabili con Altro. Le abilità riconosciute seguono l'importazione al primo
clic dalla card del PG, come le magie. I dati della scheda salvata non vengono
riscritti aggiungendo copie dei privilegi.

```sh
node --experimental-strip-types tests/player-abilities.mjs
```

L'importazione al primo clic si applica anche a mostri e PNG, sia aggiunti dal
catalogo sia dalle schede salvate. Le abilità restano elencate come **Aggiungi**
nella card dei turni, senza crearne tutte le card nella sezione Abilità. I clic
successivi raggiungono la voce già importata e la evidenziano per due secondi.
Scegliendo un'altra creatura sulla stessa card, le abilità precedentemente
importate restano nel combattimento con il loro stato e conteggio, ma non sono
più associate agli indici dei privilegi della nuova scheda.
