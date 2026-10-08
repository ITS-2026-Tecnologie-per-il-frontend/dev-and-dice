# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

## Accesso, registrazione e avvio

L'app usa React Router per le pagine `/login`, `/register` e `/trackers`. Login e
registrazione comunicano con il server Node tramite `/api`; il server memorizza
gli account in `server/data/users.json`, fuori dalla cartella pubblica `public/`.
Nel JSON la password è salvata solo come hash scrypt. I cookie di sessione sono
HttpOnly e le sessioni sono conservate in `server/data/sessions/`.

Per lo sviluppo avvia entrambi i processi con:

```sh
npm run dev
```

Il file utenti e la directory delle sessioni vengono creati al primo avvio e
sono esclusi da Git. Gli account si registrano dalla pagina `/register` usando
un nome utente di 3-24 caratteri e una password di almeno 8 caratteri.

Per una build da distribuire:

```sh
npm run build
```

Imposta `NODE_ENV=production` e `SESSION_SECRET` (almeno 32 byte casuali), poi
avvia il server con `npm start`. In produzione il server serve anche i file
compilati in `dist/`; usa HTTPS per proteggere credenziali e cookie in transito.
Il backend basato su JSON è adatto a un'installazione singola: non avviare più
istanze che scrivono lo stesso file. Per un servizio pubblico o scalabile usa un
database e configura il proxy HTTPS secondo l'hosting.

La registrazione salva l'account sul server, ma le schede dei personaggi restano
nel `localStorage` del browser: non sono ancora sincronizzate con l'account o
con altri dispositivi.

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

## Statistiche collegate tra card e scheda PDF

PF attuali, CA e iniziativa delle card sono sincronizzati con la scheda salvata.
Le modifiche dalla card, compreso Applica danni, vengono salvate anche nella
scheda; Salva scheda aggiorna le card dello stesso personaggio. PF massimi e
altri dati della scheda restano distinti dai PF attuali. Una CA inserita dalla
card viene marcata come modifica manuale, così i calcoli della scheda PDF non
la ripristinano. L'aggiunta iniziale di mostri e PNG mantiene l'iniziativa vuota.

La sincronizzazione non riordina il combattimento e non resetta le abilità già
importate o i loro conteggi. Se il salvataggio nel browser fallisce, la modifica
dalla card non viene applicata e viene mostrato l'errore. Le modifiche nella
finestra PDF si applicano alle card solo quando vengono salvate.

```sh
node --experimental-strip-types tests/stat-sync.mjs
```

## Incantesimi inglesi e traduzioni mancanti

`public/data/wikidot-spells.json` conserva tutti i 574 incantesimi dell'indice
Wikidot in inglese, con livello, scuola, tempo di lancio, gittata, componenti,
durata, concentrazione, rituale, flag UA e URL della fonte.

In `public/data/database.json`:

- `englishSpells` contiene tutte le voci inglesi. Per 319 sono disponibili anche
  descrizioni, testo ai livelli superiori e dati SRD inglesi con licenza aperta,
  provenienti da `character-options.json`, con fonte e licenze esplicite.
  Gli altri incantesimi hanno i metadati e il link Wikidot, senza copia integrale
  dei testi non SRD.
- `spells` conserva i 319 incantesimi italiani originali.
- `spellIndex` contiene solo i 255 incantesimi senza corrispondenza italiana:
  sono disponibili nell'app in inglese, senza duplicare quelli già tradotti.
- `spellComparison` contiene le corrispondenze per ID, l'elenco
  `missingItalian` da usare per cercare le traduzioni e le discrepanze di livello.
  Le traduzioni future vanno aggiunte a `spells` con `language: "it"` e
  `englishName`; la sincronizzazione aggiorna automaticamente il confronto.

Il confronto usa il nome inglese normalizzato e una lista esplicita di varianti
SRD e refusi verificati. Non usa somiglianze approssimative e mantiene distinte
le versioni UA. La fonte italiana indica Danza Irresistibile al livello 8,
mentre quella inglese indica livello 6: il report segnala la differenza e
conserva il dato originale.

```sh
python3 scripts/scrape_wikidot.py
python3 scripts/sync_spells.py
python3 tests/sync_spells.py
```

Anche `scripts/build_database.py` applica lo stesso confronto quando rigenera
il database. La sincronizzazione valida gli input e sostituisce il JSON solo
quando l'elaborazione è terminata, conservando il file precedente in caso di errore.

Il selettore **Lingua** sopra il combattimento permette di
scegliere Italiano o English. Italiano mostra le 319 traduzioni disponibili e
le 255 voci mancanti in inglese; English mostra tutte le 574 voci in inglese.
La preferenza viene salvata in `dev-and-dice.spell-language` nel browser.
La ricerca riconosce anche i nomi dell'altra lingua e le varianti SRD.
Il cambio lingua conserva i collegamenti delle schede, le abilità importate,
il loro stato e i turni rimanenti. I testi inseriti manualmente e le altre
sezioni dell'interfaccia rimangono quelli originali.

## Preparazione e disponibilità degli incantesimi · 2014 e 2024

Le logiche delle due edizioni sono separate in `src/utils/Spellcasting.ts`.
Il profilo 2014 resta quello attivo; il selettore dell'edizione non è ancora
presente. Le tabelle 2024 di trucchetti, preparati e slot, dal livello 1 al 20,
sono in `src/data/Spellcasting2024.ts`, estratte dallo SRD 5.2.1 ufficiale.
`spellProfile(sheet, data, edition)` e `spellRules(sheet, data, edition)`
permettono di verificare entrambe le edizioni; la chiave interna
`playerDetails['rules.edition']` è pronta per la futura impostazione.
Questo profilo riguarda gli incantesimi, non converte tutta la creazione
personaggio né sostituisce i testi 2014 del catalogo con quelli 2024.

Nel 2014 chierico, druido, paladino e mago preparano incantesimi; bardo,
ranger, stregone e warlock utilizzano la lista degli incantesimi conosciuti.
I trucchetti non consumano preparazioni. Le formule sono livello + modificatore
per chierico, druido e mago; metà livello, arrotondata per difetto, + Carisma
per il paladino, minimo uno quando ha accesso agli incantesimi.
Il libro del mago parte da 6 incantesimi e riceve 2 incantesimi per livello
successivo, ma non ha un tetto che impedisca le copie aggiuntive.

Nel 2024 il numero degli incantesimi preparati usa le tabelle, incluso il mago;
paladino e ranger iniziano a lanciare al livello 1 e cambiano un incantesimo
per riposo lungo. Chierico, druido e mago cambiano la lista al riposo lungo;
bardo, stregone e warlock cambiano le scelte con l'aumento di livello.
I profili conservano questa distinzione (`changePolicy`): l'app non registra
ancora i riposi né la cronologia delle sostituzioni.

Le spunte della pagina Incantesimi:

- per le classi che preparano, selezionano i preparati e rispettano il limite;
- per trucchetti e incantesimi conosciuti, risultano automaticamente selezionate;
- per razza/specie, oggetti e privilegi manuali indicano la disponibilità,
  separata dal limite della classe; un campo consente di annotare fonte, usi e cariche;
- gli incantesimi sempre preparati, compresi i privilegi di sottoclasse
  riconosciuti, non consumano il limite delle preparazioni;
- Segreti Magici e Segreti aggiuntivi della Sapienza sono fonti distinte,
  rispettivamente dentro e fuori dal numero degli incantesimi di classe;
- Arcanum Mistico ha una scelta per livello dal 6° al 9°, sbloccata ai livelli
  11, 13, 15 e 17 del warlock, indipendente dagli slot del patto.

Le magie concesse automaticamente sono salvate come dati strutturati in
`playerDetails.spellGrants`: Dominio della Vita, Giuramento di Devozione,
Circolo della Terra con terreno scelto e magie razziali SRD supportate.
Il profilo 2024 comprende anche le liste rivedute di Immondo e Stirpe Draconica
oltre alle magie concesse dalle classi e dai lignaggi implementati.
Gli oggetti non vengono riconosciuti interpretando il testo libero dell'inventario:
la fonte Oggetto e la spunta Disponibile rappresentano la conferma del giocatore
che l'oggetto sia posseduto, utilizzabile e, quando richiesto, sintonizzato.
Slot, usi gratuiti, cariche e condizioni di lancio si gestiscono manualmente;
la spunta non consuma risorse e non rappresenta l'avvenuto lancio.
Multiclasse e privilegi fuori dalle opzioni SRD supportate richiedono compilazione
manuale delle fonti e verifica con il DM.

Quando il personaggio viene aggiunto al combattimento, nella sua lista compaiono
solo gli incantesimi disponibili. Gli altri rimangono nella scheda e nel libro;
i rituali non preparati del mago rimangono consultabili nella scheda. I privilegi
razziali e sempre preparati vengono ricalcolati anche per le schede salvate prima
di questa modifica. Nessun incantesimo viene attivato o importato nella sezione
Abilità senza il clic del giocatore. Gli slot spesi non cancellano la preparazione.

Fonti ufficiali:

- [Classi 2014](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/classes)
- [Razze 2014](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/races)
- [Oggetti magici 2014](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/magic-items)
- [SRD 5.2.1, regole 2024, CC BY 4.0](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf)

This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”)
by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd.
The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International
License, available at https://creativecommons.org/licenses/by/4.0/legalcode.
Le tabelle sono state convertite in dati numerici e le regole in logiche applicative;
queste modifiche non sono opera di Wizards of the Coast.

```sh
node --experimental-strip-types tests/spellcasting.mjs
```

## Salvataggio al clic fuori dalla scheda

Cliccando fuori dalla finestra della scheda, le modifiche vengono validate e
salvate nello stesso modo del pulsante Salva scheda, aggiornando anche le
statistiche del combattimento. Le schede invariate e le nuove schede vuote mai
modificate si chiudono senza scrivere nel browser. Se la validazione o il
salvataggio fallisce, la finestra resta aperta con il messaggio di errore e il
draft viene conservato per correggere o riprovare.

Le finestre informative e quelle di conferma usano la stessa chiusura al clic
fuori; le conferme distruttive richiedono sempre il pulsante dedicato. Le
finestre annidate non chiudono né salvano la scheda sottostante. X, Esc e Annulla
mantengono il comportamento di annullamento esplicito.

```sh
node --experimental-strip-types tests/dialog-autosave.mjs
```

### Libro e privilegi del mago

Nella pagina **Incantesimi** della scheda del mago compare il riquadro **Libro e privilegi del mago**:

- Le righe distinguono scelte iniziali/di avanzamento, copie aggiuntive e scelte gratuite di Evocation Savant 2024. Il libro non ha un tetto di incantesimi; sono segnalati i limiti delle scelte gratuite.
- **Copia nel libro** propone magie SRD da mago di livello disponibile, calcola tempo e costo, controlla le MO e registra la copia senza prepararla. Nel 2014 Evocation Savant dimezza tempo e costo delle copie di evocazione; nel 2024 concede scelte gratuite e non dimezza le copie.
- **Recupero Arcano** permette di scegliere gli slot spesi da recuperare dopo un riposo breve, entro metà livello da mago arrotondato in alto; solo slot 1–5. La conferma registra l'utilizzo. **Riposo lungo / nuova giornata** ripristina gli slot e le risorse del mago; **Riposo breve** ripristina i lanci gratuiti caratteristici. I pulsanti richiedono conferma e non modificano i PF per simulare guarigione da riposo.
- **Spell Mastery** e **Signature Spells** consentono le scelte dal libro ai livelli 18 e 20. I caratteristici sono sempre preparati e fuori dal limite; ciascuno ha un lancio gratuito per riposo breve/lungo. Mastery 2014 richiede preparazione; nel 2024 le scelte sono sempre preparate e richiedono tempo di lancio di un'azione.
- **Conferma lancio** consuma lo slot selezionato oppure applica le eccezioni di trucchetti, rituali, Mastery e Signature. I rituali restano utilizzabili dal libro senza preparazione e richiedono 10 minuti aggiuntivi. I privilegi condizionali sono controllati per classe, sottoclasse, livello e scuola.
- Sculpt Spells registra le creature visibili protette (nomi distinti, massimo 1 + livello del lancio). Empowered Evocation aggiunge Intelligenza a un solo tiro. Potent Cantrip dimezza i danni su TS riuscito, e nel 2024 anche su attacco mancato.
- Overchannel massimizza un tiro di dadi indicato dal giocatore e registra gli utilizzi. Al riutilizzo richiede il risultato dei d12 necrotici e lo applica a PF temporanei/attuali senza resistenze o immunità. Nel 2024 richiede uno slot 1–5 e il massimo vale nel turno del lancio. Per magie con più tiri il giocatore applica il massimo anche agli altri tiri previsti. Il danno ai bersagli si applica dai turni; il riepilogo del lancio resta nella scheda.

Le regole del mago sono separate mediante `rules.edition`: predefinito 2014, alternativa 2024, in attesa del selettore generale. Le descrizioni e i livelli dei privilegi del mago 2024 sono aggiornati; gli effetti usano i metadati strutturati degli incantesimi SRD presenti, senza dedurre automaticamente condizioni dal testo libero. Scelte, bersagli, risultati dei dadi e conferma del riposo restano al giocatore. Le modifiche usano il salvataggio della scheda e la sincronizzazione con il combattimento già presenti.

Fonti: [SRD 5.1](https://media.dndbeyond.com/compendium-images/srd/5.1/SRD-OGL_V5.1.pdf), [SRD 5.2.1](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf), [Wizard](https://dnd5e.wikidot.com/wizard), [Evocation](https://dnd5e.wikidot.com/wizard:evocation). Le regole 2024 riassumono materiale SRD 5.2.1 di Wizards of the Coast LLC, disponibile su https://www.dndbeyond.com/srd, licenza [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); i riassunti italiani e le automazioni sono adattamenti. Per Empowered Evocation si segue il modificatore di Intelligenza dello SRD, senza il minimo +1 riportato da Wikidot.

Verifica: `node tests/wizard.mjs` e `node tests/player-creation-ui.mjs`.

### Integrazione completa della pagina Wizard (2014)

`public/data/wizard-catalog.json` contiene i metadati delle **26 sottoclassi** elencate su Wikidot (13 pubblicate, una UA e 12 UA archiviate), con identificativi distinti, fonti e collegamenti, e la progressione dei 20 livelli. L'estrattore stdlib è `scripts/scrape_wizard.py`: `python scripts/scrape_wizard.py` aggiorna il file; `--input percorso.html` permette l'estrazione senza rete. Il caricamento combina queste opzioni con quelle SRD e conserva l'identificativo esistente di Evocation. Le voci 2014 non diventano automaticamente sottoclassi 2024; Evocation conserva le regole SRD di entrambe le edizioni già implementate.

La tendina mostra anche le opzioni non ancora sbloccate, disabilitate con il livello richiesto. Le sottoclassi della pagina si scelgono al livello 2 del mago 2014. Le UA sono riconoscibili dall'etichetta; la variante pubblicata di Order of Scribes e quella archiviata hanno identificativi separati. La fonte selezionata appare nella scheda. Le pagine collegate sono state lette: il catalogo include **129 privilegi delle altre 25 sottoclassi**, con riassunti italiani originali, livelli, fonte, classificazione attivabile/passiva, durate verificate e risorse. Evocation conserva i privilegi SRD e gli automatismi già presenti. L'estrattore aggiorna i metadati della pagina principale conservando i riassunti revisionati; i cambiamenti alle pagine delle sottoclassi richiedono una nuova revisione delle regole.

Nella pagina delle statistiche, **Regole e avanzamento del mago** riporta i riferimenti per PF, competenze, equipaggiamento, CD, preparazione e requisito di Intelligenza 13 per multiclasse. La progressione multiclasse resta manuale. Gli aumenti ai livelli 4, 8, 12, 16 e 19 del 2014 possono applicare +2 a una caratteristica o +1 a due, con limite 20; in alternativa si annota un talento verificato con il DM. La registrazione impedisce applicazioni ripetute e consente di segnare gli aumenti già inclusi in una scheda esistente. I punteggi base guidati si aggiornano insieme ai valori derivati.

Nella pagina Incantesimi:

- **Cantrip Formulas**, opzionale 2014 dal livello 3, si abilita esplicitamente: dopo la conferma di un riposo lungo permette una sola sostituzione di un trucchetto di classe con uno nuovo della lista del mago. Il privilegio compare anche nella descrizione della scheda quando abilitato.
- Si può annotare l'aspetto del libro. Una copia di sicurezza costa 10 MO e un'ora per livello di ogni magia trascritta e mantiene un elenco salvato, indipendente dall'ultima ricostruzione.
- Ricostruire un libro perduto dai preparati applica lo stesso costo e conserva le altre magie come annotazioni di incantesimi perduti. Queste non si possono preparare, lanciare o importare tra le magie disponibili finché non sono ritrovate e copiate. Recuperare fisicamente una copia di sicurezza ripristina le magie presenti in quella copia senza un'altra spesa di trascrizione; le aggiunte successive rimangono da ritrovare. I nomi originali restano conservati anche quando una magia è perduta.

Verifiche aggiuntive: `python tests/wizard_catalog.py` e `node tests/wizard.mjs`.

### Privilegi specifici delle sottoclassi del mago

Nella scheda, **Privilegi** mostra le capacità sbloccate con descrizione e fonte. Le capacità attivabili seguono l'importazione su richiesta già usata nel combattimento; quelle passive restano nella scheda. Le durate non rappresentabili correttamente come round interi (per esempio “fino alla fine del prossimo turno”) restano descritte senza un timer automatico. I tempi verificati lunghi usano la durata personalizzata.

- Le quattro UA di Strixhaven richiedono una scelta distinta ai livelli 6, 10 e 14, rispettando i prerequisiti di ciascun privilegio. Le scelte di competenze, strumenti, arma, lingua, incantesimi bonus e altre opzioni della sottoclasse sono conservate nella scheda. I domini di Theurgy si annotano con il DM: il catalogo del mago non importa ricorsivamente le pagine dei domini clericali.
- Competenze permanenti, maestrie di Lore Mastery e bonus all'iniziativa di Chronurgy/War Magic vengono calcolati; il risultato del tiro d'iniziativa rimane manuale. Le magie concesse sono aggiunte una sola volta, rispettando preparazione e scelte gratuite. Le righe generate vengono rimosse se non più concesse; le magie già annotate manualmente restano conservate.
- I contatori rispettano recupero breve/lungo, risorse condivise e capacità basate su competenza/Intelligenza. Portent conserva due d20 (tre dal livello 14) e il loro uso singolo. Power Surge riparte da uno dopo un riposo lungo. Manifest Mind distingue gli usi di lancio dalla creazione della mente.
- I lanci gratuiti dei privilegi richiedono conferma delle condizioni e consumano gli usi previsti. Expert Divination recupera uno slot inferiore effettivamente speso; Arcane Ward crea/ricarica una riserva separata di PF; Benign Transportation si ricarica anche con un lancio di conjuration. Rune Maven recupera usi con Recupero Arcano.
- Wizardly Quill distingue la copia pubblicata (2 minuti/livello, costo normale) dalla UA (metà tempo/costo); Awakened Spellbook gestisce il rituale rapido una volta per riposo lungo. Bonus condizionali, concentrazione, bersagli, danni e tabelle speciali sono descritti e si applicano durante il gioco: il programma non simula questi effetti senza conoscerne le condizioni.

Le fonti Wikidot qui integrate sono 2014, incluse le relative UA; non vengono usate come regole 2024. Verifiche: `node tests/wizard.mjs`, `node tests/player-creation-ui.mjs`, `python tests/wizard_catalog.py`.

### Template della scheda Mago

`public/templates/Mago.pdf` conserva il PDF fornito come riferimento. Il modello compilabile **Mago** riproduce le sue quattro sezioni in HTML usando gli stessi dati e controlli della scheda generale. Il selettore **Modello della scheda** permette di scegliere Automatico, Scheda generale o Mago; Automatico usa Mago per la classe Wizard/Mago, anche nelle schede precedenti senza creazione guidata. Il modello è indipendente dall'edizione delle regole e la scelta viene salvata in `playerDetails['sheet.template']`. Cambiare modello conserva tutti i dati.

Le differenze dal modello generale sono le abilità raggruppate per caratteristica, i privilegi ai livelli 2/6/10/14/18/20 (la prima soglia diventa 3 usando le regole 2024), sette annotazioni di incantesimi preferiti, divinità/cicatrici/segni distintivi, dodici oggetti magici con stato di equipaggiamento e sintonia, quantità nell'inventario e una quarta pagina per gli oggetti indossati. Gli incantesimi preferiti sono annotazioni: la preparazione e la disponibilità in combattimento continuano a essere gestite nella pagina Incantesimi. I riquadri dei privilegi modificano lo stesso `classFeatures` usato per individuare le capacità da importare nel combattimento. I campi già presenti mantengono le proprie chiavi; i nuovi usano `favoriteSpell.*`, `magicItem.*` e `worn.*`. Il conteggio delle sintonie legge le spunte degli oggetti magici.

I prossimi PDF di classe si confrontano con questo riferimento: le parti comuni rimangono nella scheda condivisa e si aggiungono solo le differenze del modello specifico. Verifiche: `node tests/player-templates.mjs` e `node tests/player-creation-ui.mjs`.

Il layout del Mago segue l'ordine del PDF: intestazione in tre blocchi; caratteristiche e competenze a sinistra, combattimento e incantesimi preferiti al centro, privilegi e slot a destra. La seconda pagina pone aspetto, talenti, background e alleati/nemici a sinistra, personalità e zaino al centro, oggetti magici a destra; le monete sono sotto lo zaino. Le informazioni e i controlli aggiuntivi restano accessibili nei riquadri espandibili. La quarta pagina usa `public/templates/mago-equipaggiamento.jpg`, renderizzato dalla pagina originale del PDF, con i campi salvati sovrapposti alle rispettive caselle. Le fonti e l'acquisizione delle magie si espandono dal pulsante accanto a ogni riga.
