# Riferimento verificato locale D&D 5e 2014

Strumenti per costruire un riferimento e un database integrato **separati da
`public/data`**. Backup, release precedenti e cataloghi operativi rimangono immutabili.
L’adattatore candidato non è collegato al loader dell’app. Nessun commit o push
fa parte della ripresa.

## Stato attuale

Release collaudata: `rules-database.local/2014/candidate-0d0d275e18ee23737904`.
**2504 entità, 2466 complete nel modello e 38 parziali o dipendenti.** Questo
è il 98,5% dei record dello scope censito, non la percentuale di tutti i testi
contenuti nei manuali. Le questioni aperte impediscono di dichiarare completo
il riferimento complessivo.

- PHB: 12 classi, 40 sottoclassi, 249 eventi base, 207 privilegi di sottoclasse,
  124 opzioni; DMG: due sottoclassi e 13 ulteriori privilegi. Tutti i gruppi
  sono letti e strutturati; le dipendenze incomplete restano esplicite.
- 9 razze PHB, 9 sottorazze, variante umana, 13 background e 5 varianti;
  338 suggerimenti di personalità e 88 specialità. Aasimar ed eladrin del DMG
  sono esempi opzionali distinti da supplementi/2024 e richiedono DM.
- **361 descrizioni di incantesimi lette, 357 complete, quattro interpretazioni
  aperte, zero ancora OCR.** Liste di classe indipendenti: 844 collegamenti
  originali, 845 corretti.
- 277 record di equipaggiamento, sette dotazioni e cento cianfrusaglie;
  confezioni, merci, cavalcature, veicoli, servizi e spese conservano le unità.
- 204 creature: 203 MM e una larva DMG; 201 blocchi completi. Scope: 89 bestie
  individuali MM, sei sciami separati, famigli, Forma Selvatica, evocazioni,
  creature per capacità e oggetti. Non è l’intero bestiario del MM.
- 276 record/famiglie di oggetti DMG PDF 151–228, 267 completi: 264 famiglie
  ordinarie, quattro oggetti senzienti e otto record artefatti. Mazzo delle
  Illusioni completo, 34 carte; Bottiglia di Ferro conserva tre dipendenze
  incomplete. Sintonia, risorse e proprietà sono separate dalle decisioni DM.
- DMG: 28 tabelle di tesoro e assegnazione; sette benedizioni, sette doni minori,
  26 benefici epici; 14 veleni, tre malattie e tre tabelle di follia; ambiente,
  trappole, opzioni di combattimento, piani, incontri, assedi, inseguimenti,
  attività tra avventure e punti magia. Appendici PHB: nove pantheon con 195
  voci, sedici Piani Esterni e 31 rimandi di creature.

L’audit `inventory_audit.json` vincola con SHA-256 le identità di 23 categorie
PHB e registra le pagine lette. **17 categorie risultano complete nella vista
corretta**; le altre conservano i record incompleti. `coverage.json` distingue
inventario, singolo record, dipendenze e scope. Una traduzione mancante o
un’identità cambiata impedisce la certificazione della categoria.

Questioni originarie: Dardo Incantato, Antipatia/Simpatia, Piccola Capanna,
Maschera dell’Aura Magica, tempo di Ripristinare
Vita, ritorno della yochlol mentre incapacitata, recupero della congrega,
gittata della vista pura dell’Occhio di Vecna e procedura di recisione del
cordone nel vento psichico. Le 38 voci includono le dipendenze: non sono 41
nuove descrizioni da scrivere. Non viene inventata una soluzione automatica.

Errata ufficiali disponibili e distinte: PHB/DMG 3.0 e MM 2.0; 270 operazioni
su campi e 17 conferme di formulazioni già presenti nella copia locale.
La coda di 249 intestazioni è un indice, non prova di applicazione completa:
157 intestazioni hanno campi collegati; molte delle altre riguardano mostri o
tabelle narrative fuori dallo scope, altre contenuti non rappresentati. SAC
2.7 su Trance e Fortunato resta una fonte di chiarimenti separata.
Deviare Proiettili usa nella vista verificata la gittata esplicita 20/60 piedi
dell’SRD ufficiale inglese 5.1 PDF 27, concordante con quello italiano PDF 36.
La prima stampa resta priva del dato; `supporting-printing-log.json` distingue
l’integrazione da un erratum. Il PDF inglese è fissato con SHA-256 e pagine,
acquisito in `rules-reference.local/2014/rulings`, escluso da Git.

Test eseguiti: **90 Python**, **42 gruppi obbligatori Node**, schema TypeScript
indipendente e build TypeScript/Vite passati. Merge ripetuto: stessa release.
Backup originale 112 file verificato; tutti gli 11 file operativi conservano
le impronte del trasferimento. Nessuna attivazione, commit o push.

## Rigenerazione dalla radice corrente

Python 3.11 o successivo, Node e le dipendenze del progetto. Creare un ambiente
Python isolato; i requisiti sono fissati e non entrano nel bundle React.

```sh
python -m venv .venv-rules2014.local
.venv-rules2014.local/bin/python -m pip install -r scripts/rules2014/requirements.txt
.venv-rules2014.local/bin/python scripts/rules2014/errata.py --download
.venv-rules2014.local/bin/python scripts/rules2014/build.py
.venv-rules2014.local/bin/python scripts/rules2014/merge.py --backup database-backups.local/20261010T155024997638Z
.venv-rules2014.local/bin/python -m unittest discover -s scripts/rules2014 -p 'test_*.py'
node --experimental-strip-types --experimental-specifier-resolution=node tests/verified-database.mjs PERCORSO_RELEASE
node_modules/.bin/tsc --ignoreConfig --noEmit --strict --target ES2022 --module ESNext scripts/rules2014/schema.ts
npm run build
```

Su Windows l’interprete dell’ambiente è `Scripts/python.exe` e TypeScript è
`node_modules/.bin/tsc.cmd`. I percorsi derivano dalla radice del progetto;
nessun vecchio percorso assoluto è necessario. L’ambiente temporaneo della
ripresa Linux è `/tmp/dev-and-dice-rules2014-venv`, sostituibile senza cambiare i dati.

`build.py --skip-spell-lists` riusa la cache delle liste OCR, applicando sempre
l’inventario curato verificato sui render. `compare.py --reference ... --data-dir ...
--output ...` esegue soltanto il confronto e impedisce output in `public/data`.

## Fonti e workflow

Skill locale installata: [dnd-5e-rules](../../.agents/skills/dnd-5e-rules/SKILL.md).
Prima ricerca letterale con `search_rules.py`, poi lettura integrale dei passaggi
e dei rimandi; tabelle e blocchi statistiche controllati anche sui render.

```sh
python .agents/skills/dnd-5e-rules/scripts/search_rules.py "attunement" --edition 2014 --book master --manuals MANUALI
```

`source_reviews.json` verifica SHA-256, edizione e paginazione dei manuali;
una fonte cambiata interrompe la rigenerazione. Il nome del PDF non prova
l’edizione. SRD italiano 5.1 è supporto distinto; SRD 5.2.1/2024 è escluso.
Supplementi, UA, homebrew e contenuti legacy con provenienza sconosciuta
rimangono riconoscibili e non diventano PHB per somiglianza.

Errata ufficiali acquisite: PHB e DMG versione 3.0, MM versione 2.0, con URL,
impronte e conteggio pagine verificati da `errata.py`. I PDF sono in
`rules-reference.local/2014/errata`. `original-reference.json` conserva la copia
locale; `verified-reference.json` contiene le sole correzioni lette, con
prima/dopo per campo. Un passaggio già corretto nella copia locale non è
attribuito automaticamente alla prima stampa. La coda delle intestazioni non
certifica che tutte le errata siano applicate.

Sage Advice Compendium versione 2.7 è una fonte di chiarimenti ufficiali distinta,
con adozione indicata: non sostituisce le errata e non è la revisione 2024.
Non pubblicare PDF, OCR, render, backup privati o release locali.

## Schema e adattatore

[schema.ts](schema.ts) distingue classi, origini, equipaggiamento, incantesimi,
opzioni, creature e oggetti magici. `mechanics` contiene vincoli e valori;
`summaryIt` contiene parafrasi italiane, dichiarate come traduzioni proprie.
ID stabili nei namespace `phb2014`, `dmg2014`, `mm2014`; ID legacy conservati
nel merge e nella mappa. Formule dichiarative non sono codice da eseguire con eval.

Ogni record conserva fonti, pagine PDF a partire da uno, verifica e provenienza
per campo. PHB/MM: pagina stampata verificata = PDF meno uno; DMG non assume
la stessa regola. `complete: false` e `missingFields` impediscono l’integrazione
automatica dei record incompleti. Null con stato non specificato non è zero.
Materiali magici distinguono costo, consumo parziale, condizionale e non dichiarato.

`src/domain/dnd/VerifiedDatabase.ts` verifica le impronte dei file consumati e
la corrispondenza dei cataloghi tipizzati con il riferimento. Espone controlli
per progressione, multiclassamento, selezioni, recupero, origini, dotazioni,
Forma Selvatica, famigli, compagni, lancio e uso degli oggetti. Le opzioni non
sono concesse tutte insieme. Livelli di classe e livello totale rimangono distinti.

Il lancio separa Magia del Patto dagli slot cumulativi, apprendimento per classe,
preparazione, rituali nel libro del mago, materiali costosi/consumati, mani/voce,
armatura non competente, concentrazione e regola del lancio bonus nel turno.
Non interpreta automaticamente i quattro incantesimi parziali. Le selezioni
speciali di magie concesse richiedono i relativi piani, non una lista di classe estesa
indiscriminatamente. I piani non simulano da soli ogni bersaglio o decisione del DM.

Folklore e tipo non vengono confusi: driade, cane intermittente, pixie, satiro e megere verde/marina sono fey; drago fatato è dragon, megera notturna fiend. Sette colori del drago fatato hanno età, magie cumulative e GS uno/due distinti. Congrega MM PDF 177: tre megere, un pool di slot condiviso; autorità di recupero non specificata e non automatizzata. Equipaggiamento della megera notturna PDF 180 distinto da ricette DMG. La megera resta incompleta per Dardo Incantato, con innato CD/attacco e artigli corretti solo nella vista errata. Magmin Tocco: nella stampa il danno continuato riguarda creatura, nell’erratum PDF 2 il bersaglio; turno degli oggetti non inventato.
Couatl MM PDF 44 e pegaso PDF 251 integrati: componenti solo verbali del couatl, statistiche conservate nella metamorfosi, pegaso che comprende ma non parla. Evoca Celestiale conserva un solo bersaglio e il GS quattro o cinque soltanto con slot nono; i comandi rispettano l’allineamento come indicato nell’effetto.
Azer MM PDF 23 (CA comprende scudo), gargoyle PDF 141 (resistenza con eccezione adamantio) e magmin PDF 213 (combustione a fine turno) aggiunti per elementali minori.
Sei mephit MM PDF 216–218 aggiunti per evocazioni: nessun dimezzamento inventato nell’esplosione del vapore, tempi diversi del TS della polvere, variante di evocazione solo DM e senza catene. Non sono forme della Luna né bestie.

Le 89 bestie individuali MM coprono dinosauri PDF 80–81, stirge PDF 285 e
appendice A PDF 318–342; altri quindici blocchi riguardano elementali, Catena e
Magia Selvaggia. Sei sciami e tre blocchi per oggetti (efreeti, grifone, incubo) sono aggiunti
separatamente. Sciami e varianti restano distinti dalle singole bestie.
Varianti di lucertola, topo malato, orso delle caverne e bardatura non mutano
il blocco base. Bonus degli orsi, danni dell’elefante e attacchi dei cavalli
mantengono originali e correzioni MM separati.

Gli oggetti DMG conservano sintonia, requisiti d’impiego, azioni, maledizioni,
varianti e risorse. Dieci minuti cumulativi degli Stivali della Velocità sono
seicento secondi, recuperati al riposo lungo; i tre usi della Borsa dei Trucchi
ritornano all’alba. Il lancio da oggetti non spende slot personali né componenti,
ma conserva concentrazione e le eccezioni della descrizione, come le gemme
consumate dall’Elmo della Luminosità. Cariche con recupero casuale richiedono il
tiro effettivo; usi totali non recuperabili e recuperi ogni dodici ore senza uso
non vengono convertiti in riposi. Sintonia condizionale del Martello dei Fulmini
resta distinta dal bonus base.

Il combattimento distingue stampe ed errata di Preparare, spazio delle creature,
colpi senz’armi e successo automatico di afferrare/spingere contro incapacitati.
I piani di contesa consumano un attacco dell’azione Attaccare; la preparazione
di magie richiede un’azione e concentrazione immediata senza rimborso dello slot
se non viene liberata. Cavalcature, combattimento sott’acqua, stabilizzazione e
PF temporanei sono rappresentati separatamente. L’adattatore dei PF distingue primo livello totale e livello successivo, tiro e alternativa fissa, minimo uno da errata e guarigione con minimo zero. Punti magia: una creazione di slot per ciascun grado 6–9 fra riposi lunghi; Magia del Patto non è sostituita. Inseguimenti: prova di Costituzione, non TS; fuga oltre la Percezione passiva massima, non a parità. Soglia di danno degli oggetti: sotto soglia nessun danno, sopra danno normale senza sottrarre la soglia.

## Artefatti e audit

| Artefatto | Contenuto |
|---|---|
| `reference.json` / `.sqlite` | Copia locale, entità e relazioni |
| `source-manifest.json` | Impronte e verifica dei manuali |
| `inventory-audit.json` | Inventari PHB, pagine lette e impronte delle identità |
| `supporting-printing-log.json` | Integrazioni da SRD 5.1 distinto da prima stampa ed errata |
| `coverage.json` / `review-queue.json` | Ambiti, stati reali e lacune |
| `comparison.json` | Confronto ripetibile, alias, extra e hash |
| `RELEASE.json` | Manifesto immutabile scritto per ultimo |
| `original-reference.json` / `verified-reference.json` | Testo locale distinto da correzioni e chiarimenti |
| `changes.json` / `id-map.json` | Operazioni prima/dopo e conversione ID |
| `record-audit.json` | Origine e operazione di ogni record del candidato |
| `creation-gap-audit.json` | Valutazione individuale delle 132 lacune iniziali |
| `pending-integration.json` | Record che non possono essere aggiunti automaticamente |
| `comparison-before.json` / `comparison-after.json` | Confronto ingressi e candidato |
| `verified-*-2014.json` in `data/` | Cataloghi separati di opzioni, creature, equipaggiamento, oggetti e scelte di creazione |
| `MIGRATION.md` | Attivazione distinta e ripristino |

Ripetere il merge sugli stessi input e generatori restituisce la stessa release
verificata. Directory interrotte senza `RELEASE.json` non sono sovrascritte.
I 132 mancanti iniziali sono possibilità di aggiunta, non errori automatici.
Nomi abbreviati, alias SRD, duplicati interni e sovrapposizioni fra cataloghi
sono classificati separatamente. Le scelte narrative e le sostituzioni dei
background rimangono nel modello tipizzato, senza diventare dotazioni fisse.

## Backup e migrazione reversibile

Backup originale: `database-backups.local/20261010T155024997638Z`, 112 file.
Release di trasferimento immutabile: `candidate-5234848b05f3a8cca0e2`.

```sh
python scripts/rules2014/backup.py --verify database-backups.local/20261010T155024997638Z
python scripts/rules2014/merge.py --verify rules-database.local/2014/candidate-5234848b05f3a8cca0e2
```

La costruzione confronta tutti i file operativi con il backup prima e dopo.
Per una futura attivazione: esportare le schede, creare un nuovo snapshot,
provare il candidato in una copia isolata, leggere modifiche/ID/lacune, fermare
processi e scegliere esplicitamente il loader candidato. Per ripristinare,
riportare i cataloghi dello snapshot precedente e verificarne gli hash.
Account e sessioni in `server/data` non vanno ripristinati per cambiare le regole.
La ripresa conserva anche le modifiche già presenti prima del trasferimento.

I test controllano campi e riferimenti, originali/errata, ripetibilità, integrità
SQLite, input alterati, limiti e recuperi, quantità delle confezioni, materiali,
selezioni, lancio, origini e nuovi cataloghi. Passare i test non certifica un
inventario o una categoria ancora non revisionati.

Elementali ulteriori MM PDF 140/193/266–267/300: cinque blocchi. Evocazioni singole controllano GS e slot; il DM conferma appropriatezza dell’area elementale, senza perdere i vincoli della forma. Una bestia da Evoca Folletto è restituita come spirito fatato con origine delle statistiche conservata. Perdita di concentrazione mantiene la creatura ostile fino a un’ora dall’evocazione, senza congedo. Galeb duhr mantiene concentrazione sui massi per un minuto; anomalia d’acqua muore fuori dall’acqua vincolata. Il catalogo completo esclude la megera notturna parziale per Dardo Incantato; i suoi campi noti restano nel riferimento e non diventano un blocco completo.

Bottiglia di Ferro, primo ampliamento MM: cambion PDF 37, dao/marid PDF 144/147, quattro yugoloth PDF 312–315. Arcanaloth distingue incantesimi innati Carisma da Incantesimi del mago Intelligenza e resta parziale per Dardo Incantato. Il maglio del dao richiede prova Forza, non TS; ferite del nycaloth accumulano 2d4 e si chiudono con Medicina o guarigione magica. Evocare altri yugoloth è variante del DM: agiscono liberamente salvo evocatore ultroloth, congedo bonus e nessuna catena di evocazioni.

Altri contenuti MM della Bottiglia di Ferro: deva/planetar/solar PDF 16–19, cavaliere githyanki/zerth PDF 161–162, succubo/incubo PDF 286 e xorn PDF 305. Insight del deva e gittata del solar conservano originale ed errata. Soglia arco solar cento PF e Consapevolezza Divina del planetar sono conferme dal render, non errata. Mutaforma del deva sostituisce sensi ma mantiene PF; psioniche gith senza componenti, criticare cordone astrale sostituisce danni, bacio del succubo riduce massimo del danno effettivo, xorn non resiste ai contundenti.

Slaad MM PDF 275/277–278: girino e quattro colori rimanenti, gemma opzionale distinta dalla nascita, parassita rosso e Fago del Caos blu separati. Rosso: un uovo, tre mesi e ultime ventiquattro ore debilitanti; blu: impossibilità di curare PF e riduzione massima 3d6/giorno, trasformazione a zero invertibile solo con Desiderio. Nessuna maturazione automatica verde/grigio a tempo fisso; grigio conserva Percezione sei/passiva sedici originali e sette/diciassette dopo errata MM PDF 1.
