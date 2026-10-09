# Tutorial di creazione del personaggio

Dalla homepage, nella colonna Schede, scegli **Crea personaggio guidato**. La compilazione normale resta disponibile con Nuova scheda. Il tutorial non cambia cornici, posizione dei campi o pagine dei template.

## Guida di riferimento ed edizioni

La [guida Fandom richiesta](https://dungeonsanddragons.fandom.com/it/wiki/Guida_alla_Creazione_del_Personaggio) è stata letta il 2026-10-08 tramite l’[API pubblica della pagina](https://dungeonsanddragons.fandom.com/it/api.php?action=parse&page=Guida_alla_Creazione_del_Personaggio&prop=wikitext&format=json), perché l’URL principale restituisce 403. Il contenuto descrive il procedimento 2014: bonus razziali ai punteggi, sottorazze, equipaggiamento da classe/background. La verifica è stata fatta sulle [Basic Rules 2014 ufficiali](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/step-by-step-characters).

Le informazioni sono rielaborate, senza copiare la guida integralmente. Questa è la corrispondenza tra la sua procedura e il tutorial:

| Passaggio della guida | Scelte e spiegazioni raccolte | Passaggi del tutorial |
|---|---|---|
| Razza | Identità, tratti, sottorazza, velocità, lingue, bonus da applicare ai punteggi | Origini; Caratteristiche; Competenze e lingue |
| Classe | Ruolo nelle avventure, competenze, privilegi; livello, Dado Vita, PF e bonus di competenza | Classe e livello; Competenze; Riepilogo |
| Caratteristiche | Assegnazione di sei punteggi; array standard, 4d6 scartando il minimo, acquisto con 27 punti; modificatori | Caratteristiche |
| Descrizione | Nome, background, aspetto, allineamento, personalità, ideali, legami e difetti | Iniziamo; Origini; Personalità e gruppo |
| Equipaggiamento | Dotazioni o acquisto concordato; armature effettivamente indossate, CA, competenza nelle armi, attacchi e trasporto | Equipaggiamento; Riepilogo |
| Incontrare gli altri | Motivo per collaborare, legami con gli altri personaggi e obiettivi comuni | Personalità e gruppo |

Si aggiungono un passaggio dedicato agli incantesimi, il riepilogo e il salvataggio. La classe precede l’origine per aiutare a capire il ruolo desiderato; il background precede l’assegnazione dei punteggi, così il percorso funziona anche nel 2024.

Per il 2024 si seguono le [regole ufficiali di creazione](https://www.dndbeyond.com/sources/dnd/br-2024/creating-a-character). La scelta di un’opzione storica è esplicita: i bonus razziali 2014 vengono ignorati; il background storico permette +2/+1 su caratteristiche diverse oppure +1/+1/+1, senza superare 20. Il talento di Origine mancante e i privilegi non presenti nel catalogo richiedono verifica e applicazione manuale con il DM. La sottoclasse viene proposta dal livello 3. Le due lingue standard iniziali aggiuntive sono scelte tra quelle effettivamente disponibili nel catalogo.

## Funzionamento implementato

- Nove passaggi con spiegazioni per principianti, esempi, suggerimenti sulle dodici classi e sulle sei caratteristiche.
- Nome ed edizione obbligatori; livello 1 predefinito; classe, origine, sottorazza/background e sottoclasse dal catalogo, con sblocco per livello/edizione. UA riconoscibili come playtest.
- Array standard senza riuso dei valori; acquisto punti con punteggi 8–15 e budget massimo 27; sei tiri 4d6 conservati nella bozza; inserimento manuale concordato con il DM.
- Scelte annidate di competenze, lingue, bonus e dotazioni tramite il componente esistente. Controllo delle scelte incomplete e delle competenze/lingue duplicate. Maestria solo in abilità già conosciute.
- Le competenze già concesse da altre origini sono riconoscibili nei menu; una vecchia scelta duplicata resta modificabile e l’errore indica l’abilità da correggere. I Presagi sono annotazioni facoltative durante la creazione: risultati uguali sono validi, i campi restano modificabili e i pulsanti per consumare risorse compaiono nella scheda completata. Le bozze del vecchio tutorial recuperano i Presagi erroneamente consumati mantenendo i risultati.
- Scelte dei privilegi SRD strutturati, come stile di combattimento e Maestria, riutilizzate anche fuori dal tutorial; i privilegi alternativi non scelti non vengono più stampati tutti nella scheda. Lo stile Difesa modifica la CA solo se si indossa un’armatura; Tiro con l’arco aggiunge +2 agli attacchi con armi a distanza. Il terreno del Circolo della Terra alimenta le magie concesse. Gli effetti degli altri stili restano da applicare con il DM.
- Selezione di trucchetti, magie di classe e preparazione secondo i limiti condivisi; libro e controlli dedicati per il mago. Le magie dell’origine rimangono separate. Le sottoclassi speciali del mago usano i controlli già presenti.
- Riepilogo di caratteristiche, PF, CA, competenza, iniziativa, percezione, statistiche magiche, lingue, equipaggiamento e privilegi. Il salvataggio finale ricontrolla tutti i passaggi, anche se si è usata la navigazione libera.
- Calcoli affidati a `applyCreation`, `spellRules`, `spellSelection` e ai campi stabili esistenti. Nessuna formula duplicata nei template. Le modifiche manuali dei campi derivati mantengono i loro override.
- Cambio di classe: le magie incompatibili vengono archiviate per configurazione e recuperate tornando alla configurazione precedente. Cambiare livello o edizione conserva le magie annotate: i nuovi limiti e le incompatibilità vengono segnalati e le selezioni restano correggibili. Le scelte annidate restano legate alla loro origine; sottorazze e sottoclassi vengono ricordate e riproposte quando valide.
- Salvataggio automatico della bozza nel browser, separato dalle schede complete, e pulsante Riprendi creazione. Chiudere salva subito; se lo storage non funziona, la finestra resta aperta con l’errore e i dati originali vengono conservati.
- Dati invalidi già presenti nello storage non vengono sovrascritti. La bozza conserva anche campi incompleti; non viene proposta come personaggio utilizzabile in combattimento prima del salvataggio finale.

## Generazione casuale

«Crea personaggio casuale» nella raccolta Schede genera una nuova bozza con le regole 2014. Il livello è selezionabile da 1 a 20 e parte da 1; classe e razza possono essere fissate singolarmente oppure lasciate casuali. Sottorazza, sottoclasse quando prevista al livello scelto, background, assegnazione dell’array standard, competenze, lingue, dotazioni, magie, nome e spunti personali vengono scelti fra le opzioni disponibili. Le opzioni UA non vengono sorteggiate. Il catalogo attuale comprende un solo background: Accolito.

Il generatore riutilizza `creationChoices`, `optionsFor`, `spellRules`, `applyCreation` e `tutorialIssues`: non introduce formule per PF, CA, pesi o limiti degli incantesimi. Evita competenze/lingue duplicate e assegna Maestria solo alle competenze possedute. Le magie razziali e sempre preparate restano separate dalle scelte ordinarie. Le dotazioni entrano nell’inventario e armatura/scudo disponibili e appropriati vengono collegati tramite identificativo.

Al livello 1 la bozza si apre al Riepilogo e usa il salvataggio/ripresa già esistente. Sopra il primo livello si apre a Classe e livello: i PF usano i valori fissi condivisi, la competenza e le magie seguono il livello e gli XP provengono dalla tabella già presente nel catalogo. Aumenti di caratteristica/talenti e avanzamenti non strutturati devono essere verificati nel tutorial; la conferma non viene simulata dal generatore. Si può tornare ai passaggi precedenti, cambiare le scelte o il nome e salvare il personaggio nelle schede normali. Una bozza già presente blocca una nuova generazione per non sovrascriverla. Errori nel catalogo o nel salvataggio vengono mostrati senza sostituire personaggi esistenti.

Il Ranger al livello 1 si apre invece al passaggio Competenze; ai livelli superiori richiede entrambe le verifiche. Nemico prescelto, terreno di Esploratore naturale e l’eventuale lingua non sono ancora collegati nel flusso condiviso. Vanno annotati nei Tratti aggiuntivi, verificati con il DM e confermati prima del salvataggio. Il generatore non simula quella conferma. Nel Dragonide, la Discendenza draconica è ora una scelta condivisa del tutorial e il tratto selezionato compare nella scheda.

Il libro del mago rispetta i limiti cumulativi di acquisizione senza usare gli slot come quote. Segreti Magici del bardo vengono scelti fra le magie disponibili al livello di acquisizione; Arcanum Mistico del warlock resta separato. Spell Mastery e Signature Spells del mago vengono collegate al libro quando previste, distinguendo preparazione normale e sempre preparati. Le dotazioni rimangono quelle iniziali: oro e oggetti aggiuntivi per partire a un livello superiore dipendono dalla campagna.

Le regole 2024 richiedono ancora i dati e le verifiche manuali già indicate per il tutorial. Gli effetti descritti solo in prosa e i pesi mancanti nel catalogo mantengono la gestione esistente. `node tests/random-character.mjs` controlla tutte le 108 combinazioni classe/razza al livello 1 e tutte le dodici classi ai livelli 2–20, casualità totale/parziale, limiti, valori ai bordi, catalogo insufficiente, bozze, riapertura, template e magie nelle card del combattimento.

Verificato nel browser anche il flusso con classe/razza fissate e completamente casuali, la scelta del livello, la conferma degli avanzamenti, la ripresa dopo riapertura dell’app, la protezione delle bozze esistenti, il salvataggio finale con il livello conservato e l’aggiunta al combattimento.

## Limiti condivisi degli incantesimi

`spellSelection` restituisce conteggi, limiti, motivi e problemi; `spellSelectionBlock` stabilisce quali nuove selezioni superarli. Tutorial, scheda normale (anche senza calcoli automatici) e salvataggio usano questi controlli. Le chiavi sono `spell.<livello>.<riga>.*`, indipendenti dal template. Nessuna formula dei limiti nei componenti grafici; nessuna nuova dipendenza.

Regole verificate nelle [Basic Rules 2014 del mago](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/classes#Wizard) e nelle [regole ufficiali 2024](https://www.dndbeyond.com/sources/dnd/br-2024/character-classes#Wizard). Le scelte iniziali/di avanzamento nel libro sono sei al livello 1 e due per ogni livello successivo. I vincoli sui livelli superiori sono cumulativi: un mago di livello 5 può ottenere tramite avanzamento fino a sei magie di livello 2 o superiore, di cui al massimo due di livello 3. Questi vincoli rappresentano quando si sbloccano le magie; non derivano dal numero di slot.

Le copie (`learned=copied`) e le magie concesse (`learned=feature`) hanno acquisizioni separate e non consumano scelte di avanzamento. Le copie non hanno un massimo numerico; la procedura esistente controlla lista, livello di classe e costo in oro, senza usare slot modificati manualmente per sbloccare livelli. L’annotazione manuale «Copiato durante l’avventura» conserva le acquisizioni pregresse: disponibilità della fonte, tempo e spese pregresse richiedono conferma del DM.

Trucchetti e preparati hanno limiti separati: per il mago 2014 i preparati dipendono da livello e Intelligenza (minimo uno); nel 2024 dalla tabella di classe. Non esistono quote separate dei preparati per livello di magia. Le magie sempre preparate, Signature Spells e Spell Mastery 2024 sono escluse dal totale ordinario; Spell Mastery 2014 richiede la preparazione normale. Evocation Savant 2024 ha un conteggio dedicato e controlla scuola e disponibilità delle scelte per avanzamento. Sono riutilizzati anche i conteggi già esistenti delle altre classi, Segreti Magici e Arcanum Mistico.

Alla soglia si disabilitano soltanto nuove selezioni della categoria piena. Le selezioni esistenti restano rimovibili; liberare un posto o cambiare livello/edizione ricalcola subito i controlli. Le vecchie selezioni oltre limite restano nei dati: l’avviso indica categoria, conteggio/massimo, eccedenza e correzione. Una bozza incompleta può essere salvata e ripresa; il salvataggio della scheda completa richiede di correggere i problemi.

Multiclasse, acquisizioni speciali non strutturate nel catalogo e ulteriori scuole del mago 2024 richiedono ancora verifica manuale. Per i privilegi rappresentati nel catalogo si riutilizzano le concessioni esistenti; le opzioni assenti non vengono dedotte dal nome libero di un talento.

## Limiti espliciti e gestione manuale

Il catalogo SRD offre attualmente un solo background, Accolito, nove razze e dodici classi. Le opzioni assenti non vengono inventate né presentate come disponibili.

Il percorso 2024 applica i calcoli e gli adattamenti strutturati già supportati, ma non sostituisce un catalogo completo di classi, specie, background, talenti e incantesimi 2024. Il talento di Origine viene annotato nei tratti aggiuntivi della scheda: scriverne il nome non applica automaticamente tutti i suoi effetti. I privilegi e le versioni aggiornate delle magie devono essere verificati con il DM.

Richiedono ancora compilazione/verifica manuale: multiclasse, acquisto alternativo con oro iniziale, talenti e aumenti di caratteristica ai livelli superiori, PF tirati dopo il livello 1, requisiti/effetti condizionali dei privilegi, scelte non strutturate (per esempio alcune invocazioni), sostituzioni non rappresentate nel catalogo, pesi e contenuti delle dotazioni. L’equipaggiamento iniziale viene registrato nell’inventario, compresi i contenuti delle dotazioni presenti nel catalogo. Il campo Equipaggiamento e gli altri riquadri richiamano quelle voci; i pesi mancanti si completano nella scheda. Vedi [Inventario del personaggio](inventario-personaggio.md).

È conservata una bozza guidata alla volta in questo browser. Il salvataggio completo utilizza l’archivio normale e permette poi di crearne un’altra. Le bozze non sono un servizio di sincronizzazione tra dispositivi.

## Verifiche

Eseguire `node tests/character-tutorial.mjs` per creazione completa del mago, punteggi, scelte dipendenti, distinzione tra edizioni, recupero delle bozze, conservazione degli override, cambio dei tre template, salvataggio/riapertura e magie nelle card del combattimento. I test esistenti di creazione, calcoli, schede e dialoghi coprono le regressioni nei flussi condivisi.

Verificato anche nel browser: completamento dei nove passaggi con un mago di livello 1, tre trucchetti, sei magie nel libro e quattro preparate; aggiornamento di PF, CA e statistiche magiche; ricaricamento della pagina e ripresa al passaggio Competenze; salvataggio finale e apertura nei tre template. Il check dei dialoghi simula inoltre lo storage pieno: la bozza resta aperta, l’archivio normale rimane intatto e il secondo tentativo salva correttamente.

Per i limiti eseguire `node tests/spell-selection-limits.mjs`; `node tests/player-creation-ui.mjs` controlla le caselle del tutorial, compresi i vecchi riferimenti senza ID; `node tests/dialog-autosave.mjs` verifica che una scheda oltre limite non sovrascriva l’archivio, resti aperta e possa essere corretta.

Verificati nel browser anche i limiti al passaggio Incantesimi: selezione e deselezione, preparazione, pausa/ripresa e bozza oltre limite. Nella scheda normale: blocco del salvataggio invalido, aggiunta di una copia a quota di avanzamento piena, cambio dei tre template e salvataggio/riapertura con acquisizione conservata.
