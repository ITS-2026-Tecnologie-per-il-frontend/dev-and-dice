# Riferimento locale D&D 5e 2014

Estrazione separata dai cataloghi dell’app, con dati meccanici, parafrasi italiane,
provenienza per campo e confronto ripetibile. **Stato parziale**, esplicitato in
ogni record e nel rapporto: l’inventario non equivale alla verifica degli effetti.

## Rigenerazione da PowerShell nella radice del progetto

Richiede Python 3.11 o successivo. Le dipendenze non entrano nel bundle React.

```powershell
python -m pip install -r scripts/rules2014/requirements.txt
python -X utf8 scripts/rules2014/build.py
python -X utf8 scripts/rules2014/test_reference.py -v
```

In questa sessione PyMuPDF è stato installato nella directory locale
`rules-reference.local/python`; gli strumenti cercano prima lì. In una nuova
installazione il comando `pip` sopra rende disponibili entrambe le dipendenze.
La creazione delle liste di classe richiede PyMuPDF. Per ricostruire solo entità,
confronto e rapporto: `python -X utf8 scripts/rules2014/build.py --skip-spell-lists`.
Le eventuali liste già presenti mantengono la loro data e il loro stato di
candidati; questa opzione non le rivalida.

Solo confronto, senza rileggere o cambiare cataloghi:

```powershell
python -X utf8 scripts/rules2014/compare.py
```

`compare.py` accetta `--reference`, `--data-dir` e `--output`; impedisce di scrivere
l’output dentro `public/data`. `build.py` usa sempre la directory separata
`rules-reference.local/2014`. Non modifica codice dell’app, cataloghi o scraper.

## Artefatti generati

| File in `rules-reference.local/2014` | Contenuto |
|---|---|
| `reference.json` | Entità, meccaniche, spiegazioni, relazioni e fonti |
| `reference.sqlite` | Copia interrogabile delle stesse entità e relazioni |
| `source-manifest.json` | Impronte PDF, metadati, pagine senza testo e revisioni |
| `coverage.json` | Inventari, campi mancanti e categorie ancora da censire |
| `comparison.json` | Discrepanze, alias, extra, controlli rinviati e SHA-256 degli ingressi |
| `spell-list-candidates.json` | Relazioni classe/incantesimo OCR, coordinate e righe irrisolte |
| `validation.json` | Integrità delle entità, fonti, relazioni e progressioni |
| `review-queue.json` | Record incompleti, campi da verificare e relative pagine |
| `REPORT.md` | Rapporto leggibile in italiano |

La directory `*.local` è già ignorata dal progetto. Testo grezzo dei PDF e render
restano in `cache/` e `render/` locali: non sono contenuti del programma né asset
pubblici. I sorgenti di questo strumento contengono fatti, nomi e parafrasi, non
riproduzioni integrali dei manuali.

## Fonti e verifica

`source_reviews.json` registra le copie realmente esaminate, con impronta
SHA-256, evidenza nelle pagine iniziali, ruolo ed edizione. Una copia mancante,
illeggibile o cambiata interrompe la rigenerazione dei dati curati: prima occorre
verificare nuovamente edizione, contenuti e paginazione. Il nome del PDF non è una
prova dell’edizione. L’SRD italiano 5.2.1 è censito nel manifesto e **escluso dalle
entità 2014**. Il compatto italiano 5.1 è un supporto SRD, non un PHB completo.

Workflow della skill usata: [.agents/skills/dnd-5e-rules/SKILL.md](../../.agents/skills/dnd-5e-rules/SKILL.md).
Prima si cerca con lo strumento della skill, poi si leggono le pagine e i rimandi.
Esempio dalla radice:

```powershell
python -X utf8 .agents/skills/dnd-5e-rules/scripts/search_rules.py "Channel Divinity" --edition 2014 --book player
```

`pdf_sources.py` estrae il testo con pypdf e riusa la cache solo se l’impronta
corrisponde. L’OCR preesistente nelle scansioni inglesi contiene errori. Tabelle
multi-colonna, slot di alto livello e pesi sono stati controllati anche sui render
del PDF. Le liste degli incantesimi hanno margini alternati: non si possono
ottenere dividendo ogni pagina in quattro rettangoli uguali.

## Schema e uso dei dati

[schema.ts](schema.ts) definisce tipi separati per classi, origini, armi, armature,
progressioni e incantesimi. La struttura segue i JSON già adottati dal progetto,
ma non è un sostituto diretto di `CreationData`.

- ID stabili: `phb2014:class:wizard`, `phb2014:spell:fireball`; opzioni DMG/MM
  hanno namespace distinti. Gli ID SRD rimangono nei risultati del confronto.
- `name` è inglese; `nameIt` è italiano o `null`. Le traduzioni proprie sono
  dichiarate `assistant-translation`, quelle ancora mancanti `missing`.
- `summaryIt` spiega; `mechanics` contiene valori e vincoli. Formule dichiarative
  e selezioni non vanno eseguite con `eval`.
- `sources` cita filename esatto, pagine PDF **a partire da 1**, sezione e metodo
  di verifica. Nel PHB la pagina stampata è la pagina PDF meno uno. Per altre
  fonti non controllate individualmente il numero stampato resta `null`.
- `fieldSources` rinvia agli indici di `sources`; `interpretations` distingue
  calcoli derivati e letture ancora aperte dai dati dichiarati.
- `verification.mechanics = ocr-candidate` impedisce di usare il record come
  correzione verificata. Un nome riconosciuto non verifica la descrizione.
- `complete: false` e `missingFields` conservano le lacune. `null` con uno stato
  `unspecified-in-source` non significa zero. Per i materiali degli incantesimi
  distinguere costo non specificato e valore minimo dichiarato.
- `relations` collega genitori, classi e privilegi; i contenuti delle dotazioni
  hanno `entityId` e quantità. Alcuni oggetti narrativi senza prezzo restano
  espliciti in `additionalContents` anziché ricevere un costo inventato.
- `optional` identifica talenti, multiclassamento, umano variante e opzioni DMG.
  Le opzioni malvagie del DMG richiedono il consenso del DM secondo la fonte.

Esempio SQL:

```sql
SELECT id, name_it
FROM entities
WHERE kind = 'spell' AND complete = 1;
```

I campi verificati di un record incompleto sono utili singolarmente, ma non
autorizzano l’implementazione automatica dell’intera capacità.

## Architettura esistente e compatibilità

`src/utils/PlayerCreation.ts` definisce `Ref`, `Origin`, `Equipment`, `Choice`,
`ClassFeature` e `CreationData`; carica `character-options.json`,
`character-equipment.json`, `character-rules.json` e `wizard-catalog.json`.
`withWizardCatalog()` sovrappone le sottoclassi con lo stesso ID: una voce ripetuta
tra questi file non è necessariamente un duplicato. `Catalog.ts` usa anche il
catalogo inglese/italiano generale in `database.json`.

`Spellcasting.ts` usa progressioni e capacità di classe con una variante 2024
separata; `Wizard.ts` contiene logiche di privilegi e risorse; `Inventory.ts`
gestisce quantità, peso e concessioni dell’equipaggiamento. Le tabelle base sono
principalmente SRD 2014; i dati aggiuntivi del mago includono supplementi e UA.

La futura conversione al modello applicativo deve essere esplicita:

| Riferimento | Campo applicativo | Attenzione |
|---|---|---|
| `hitDie` | `hit_die` | Formula PF al primo livello distinta dai successivi |
| `savingThrowAbilities` | `saving_throws` / campo arricchito | Abilità lunghe vs abbreviazioni SRD |
| `speed.value` | `speed` | Piedi; conversioni metriche sono valori derivati |
| `spellSlots` | `spell_slots_level_1`…`9` | Magia del Patto ha un pool e recupero separati |
| Arma da mischia con lancio, `range` | `throw_range` | `range.normal = 5` può indicare la portata da mischia |
| `armorClass` | `armor_class` | Scudo come bonus, Destrezza ignorata con armatura pesante |
| `purchaseQuantity` | `quantity` o nuovo campo confezione | Costo e peso devono riferirsi alla stessa confezione |
| `startingEquipment.choices` | `starting_equipment_options` | Convertire gruppi, alternative e categorie, non solo nomi |
| `resource` negli effetti | `ClassFeature.resource` | Recupero giornaliero e condizioni non entrano sempre nei tipi attuali |

Nessun adattatore viene collegato all’app in questa fase: alcuni tipi attuali non
rappresentano tutte le condizioni della fonte. Sostituirli implicitamente
perderebbe informazioni. Le differenze 2024 hardcoded richiedono un audit distinto.

## Confronto e limiti

Il confronto controlla identità, traduzioni quando entrambe presenti, relazioni,
valori di classi/origini/equipaggiamento, 240 progressioni, avanzamento, modificatori
di caratteristica, competenza e acquisto a punti. I 17 alias PHB/SRD degli
incantesimi evitano falsi mancanti. Le copie duplicate vengono cercate all’interno
di ciascun array. Supplementi/UA e record non riconosciuti vengono elencati, senza
dedurre automaticamente che siano homebrew o 2024. Gli hash dei cinque cataloghi
prima e dopo la lettura provano che il confronto non li ha modificati.

Due errori verificati nella tabella attuale del warlock: al livello 4 registra tre
invocazioni anziché due; al livello 6 quattro anziché tre (PHB PDF 107). Prezzi di
triboli e chiodi di ferro sono invece una questione di quantità della confezione,
segnalata per revisione. Non vengono applicate correzioni.

Ci sono differenze fra la prima stampa e l’SRD successivo: il terzo beneficio di
Lottatore, recupero minimo dei dadi vita, recupero dell’Eredità infernale e alcune
formulazioni delle proprietà delle armi. Le errata complete non sono disponibili;
il confronto non presenta ogni divergenza di stampa come errore.

Restano da completare effetti e scelte di molti privilegi, sottoclassi, traduzioni
ed effetti di 347 incantesimi, tabelle della personalità, alcuni tratti descrittivi,
veicoli/servizi, altre regole PHB e cataloghi di oggetti DMG/statistiche MM.
L’incantesimo Magic Missile mantiene una lettura del tiro di danno da risolvere.
Le liste OCR includono `Trap the Soul` senza una descrizione corrispondente nel
PHB locale; `Destructive Smite` nella lista del paladino è associato a
`Destructive Wave` soltanto come candidato da controllare. Queste anomalie non
vengono trasformate in nuove voci o regole inventate.

## Verifiche

`validate.py` controlla identificatori, pagine, edizioni, provenienza dei campi,
relazioni, dotazioni e progressioni. I test coprono arrotondamento negativo,
concentrazione, slot di multiclassamento e magia del patto, schema 2014, OCR non
verificato, fonti cambiate, alias, portata/lancio, sovrapposizioni del mago,
immutabilità e ripetibilità del confronto, rigenerazione delle entità, chiavi
esterne e integrità SQLite.

Controllo dei tipi autonomi, usando TypeScript 6 già presente nel progetto:

```powershell
.\node_modules\.bin\tsc.cmd --ignoreConfig --noEmit --strict --target ES2022 --module ESNext scripts/rules2014/schema.ts
```

La copertura completa è determinata dall’inventario e dalla verifica dei rimandi;
non dal solo numero di record o dal superamento dei test.
