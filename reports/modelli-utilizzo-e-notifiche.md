# Modelli di utilizzo e notifiche al Master

Analisi funzionale del 20 ottobre 2026. Documento di analisi; nessuna modifica al codice applicativo.

Il riferimento principale è **D&D 5e 2014**: è il profilo predefinito del progetto e l'edizione del catalogo verificato. Le regole 2024 già presenti nel motore non convertono il catalogo 2014. Le differenze rilevanti sono riportate separatamente.

**Proposta: cinque procedure elementari di risoluzione, un percorso di arbitraggio e tre form funzionali condivisi.** È una classificazione per progettare l'interfaccia, non un numero di categorie definito dai manuali né la prova di una classificazione completa di ogni voce del catalogo.

## Tabella delle modalità di risoluzione

Tutte le pagine citate sono **pagine PDF**, non numeri stampati. **PHB14** indica [D&D_5_Player_Original_Handbook.pdf](../MANUALI/D&D_5_Player_Original_Handbook.pdf), verificato come prima stampa di agosto 2014 nella pagina PDF 3. **SRD24** indica [D&D_5.5_manuale_compatto_italiano.pdf](../MANUALI/D&D_5.5_manuale_compatto_italiano.pdf), identificato come SRD 5.2.1 nella pagina PDF 1.

| Procedura | Chi tira e contro cosa | Casi verificati 2014 | Conseguenza per il form | Fonte |
| --- | --- | --- | --- | --- |
| **1. Tiro per colpire** | L'attaccante tira contro la CA del bersaglio. | Un attacco con pugnale; ciascun raggio di Raggio rovente. | Un tiro per ogni attacco, poi danni ed eventuali effetti del colpo. Un singolo utilizzo può contenere più attacchi. | PHB14 PDF 150, 194–197, 274. |
| **2. Tiro salvezza** | La creatura interessata tira contro la CD dell'effetto. | Palla di fuoco; Cecità/Sordità; Folata di vento nel momento previsto. | Una risoluzione per ciascuna creatura interessata; successo e fallimento possono produrre esiti diversi e non soltanto danni. | PHB14 PDF 180, 206, 220, 242–243, 249. |
| **3. Effetto senza confronto con un d20** | Nessun tiro per stabilire se colpisce o supera una difesa; possono esserci dadi per determinarne la quantità. | Dardo incantato; Parola guaritrice; Benedizione; Sonno con riserva di PF. | Scelte, distribuzione ed eventuali dadi di quantità. Non richiedere tiro per colpire, TS o conferma «colpito». | PHB14 PDF 220, 251, 258, 277. |
| **4. Prova di caratteristica contro CD** | Il soggetto indicato dalla regola tira una prova, non un TS. | Controincantesimo quando occorre una prova; prova di Saggezza per terminare Punizione collerica. | Caratteristica, eventuale competenza prevista e CD appropriate alla prova; nessun uso automatico del bonus TS. | PHB14 PDF 175, 229, 290. |
| **5. Prova contrapposta** | Due creature effettuano prove e confrontano i totali. | Lottare e Spingere 2014; liberarsi da una lotta. | Due soggetti e due prove; la difesa può prevedere una scelta. Conservare il significato della parità. | PHB14 PDF 175, 196–197. |
| **Arbitraggio del Master** | Il Master stabilisce procedura ed esito quando la voce non li determina o l'app non li rappresenta. | Azioni improvvisate; richieste aperte di Desiderio. | Intento, contesto, eventuali risorse ed esito motivato. Non classificare automaticamente come «nessun effetto» o «colpo automatico». | PHB14 PDF 194, 289–290. |

Le contrapposte sono prove di caratteristica nelle regole: le separiamo funzionalmente perché coinvolgono due risultati e una gestione specifica della parità. Le procedure miste sono sequenze delle cinque precedenti; area, bersagli multipli e persistenza sono altre dimensioni, non ulteriori procedure di risoluzione.

## Correzione dei tre esempi iniziali

**Pugnale 2014.** Un singolo attacco ha un bersaglio; il pugnale può essere usato in mischia oppure lanciato. La scelta cambia distanza e verifiche applicabili. Il danno base è 1d4 perforante, con il modificatore applicabile. Un'azione che permette più attacchi non diventa per questo un solo tiro contro più bersagli. Fonti: PHB14 PDF 147–150, 191, 194–197.

**Folata di vento 2014.** Crea una linea lunga 18 m e larga 3 m, con concentrazione fino a un minuto. La creatura effettua il TS su Forza **quando inizia il proprio turno nella linea**; il fallimento la spinge di 4,5 m lungo la linea, lontano dal lanciatore. Non infligge danni. Il movimento verso il lanciatore ha un costo maggiore a prescindere dall'esito del TS; direzione, gas e fiamme hanno regole ulteriori. Il lanciatore può cambiare direzione con un'azione bonus nei propri turni. **Il lancio può essere completato senza un TS immediato.** Fonte: PHB14 PDF 249.

**Dardo incantato 2014.** Tre dardi al livello base, ciascuno da 1d4 + 1 danni da forza; un dardo aggiuntivo per livello di slot oltre il primo. Si distribuiscono tra creature visibili entro 36 m, anche assegnandone più alla stessa creatura. Colpiscono simultaneamente: non si può attendere il risultato su una creatura per redistribuire i dardi di quel lancio. Nessun tiro per colpire o TS; Scudo può impedire il danno. Fonti: PHB14 PDF 258, 276.

Il numero di dadi di danno condivisi o separati deve essere esplicito nella voce verificata. La regola generale 2014 sui danni simultanei a più bersagli è in PHB14 PDF 197; la descrizione di Dardo incantato non specifica da sola ogni dettaglio della procedura dei dadi per tutte le distribuzioni. Non ricavare una convenzione universale dal solo numero dei dardi; eventuali letture adottate dal tavolo vanno dichiarate come tali.

## Dimensioni da combinare

### Bersagli e posizione

| Configurazione | Scelta del giocatore | Verifica del Master |
| --- | --- | --- |
| Se stessi | Normalmente nessuna selezione del destinatario. | Eventuali requisiti e incompatibilità. |
| Una creatura | Destinatario consentito dalla voce. | Gittata, visibilità, percorso libero, tipo di creatura, consenso se necessario. |
| Più creature scelte | Lista entro i limiti dell'utilizzo effettivo. | Limiti, requisiti e distanze reciproche previste. |
| Colpi o unità distribuite | Assegnazione di ogni attacco, raggio o dardo; stesso destinatario ripetibile quando consentito. | Numero totale, simultaneità o sequenza, vincoli di ciascuna unità. |
| Punto, direzione o area | Origine, orientamento e forma quando selezionabili. | Creature effettivamente coinvolte, inclusi alleati e creature non visibili al giocatore. |
| Oggetto, luogo o effetto esistente | Identità dell'oggetto, luogo, arma o effetto; descrizione se non presente nell'app. | Ammissibilità della scelta e risoluzione appropriata. |

Queste configurazioni possono sovrapporsi: un punto può originare un'area; un effetto centrato sul lanciatore può interessare altre creature. **Gittata «incantatore» non significa sempre «unico bersaglio: incantatore».** Fonti: PHB14 PDF 203, 205–206; Arma magica, PDF 258; Dissolvi magie, PDF 235.

Per un'area, il giocatore dichiara il posizionamento; il Master determina gli interessati. Senza una mappa strutturata, posizione e geometria restano una verifica manuale. Una lista di creature selezionate non dimostra che siano tutte e sole quelle nell'area.

### Esiti

Gli esiti necessari sono combinabili: danni separati per tipo; guarigione; concessione di PF temporanei; applicazione o rimozione di condizioni; bonus o penalità; movimento e posizionamento; modifiche a oggetti o ambiente; creazione di entità; interruzione di altri effetti; risultato narrativo.

**Guarigione e PF temporanei richiedono operazioni distinte.** La prima recupera PF fino al massimo; i secondi costituiscono una riserva separata e normalmente non si sommano tra loro. Non usare danni negativi per rappresentarli. Fonti: PHB14 PDF 198–199.

Il risultato del tiro non coincide con l'applicazione dell'esito. Vanno considerate, quando pertinenti, reazioni, resistenze, immunità, vulnerabilità e altri modificatori. Un successo al TS può dimezzare un danno, annullarlo oppure modificare soltanto alcuni effetti: lo stabilisce la singola voce. Fonti: PHB14 PDF 197–198, 206, 276.

### Tempo, scelte e risorse

Ogni utilizzo deve distinguere:

- azione, azione bonus, reazione o lancio prolungato;
- livello dello slot effettivo e fonte del lancio, inclusi eventuali usi senza slot;
- numero di attacchi, raggi, dardi o destinatari, calcolato con la progressione corretta;
- scelte della singola voce: modalità, tipo di danno, destinatari esclusi, arma interessata, destinazione;
- durata massima e scadenza precisa, distinta dalla concentrazione;
- eventi successivi: inizio o fine del turno di un soggetto preciso, ingresso nell'area, movimento, danno subito, colpo riuscito, azione di mantenimento o di liberazione;
- limiti di frequenza dell'evento: per turno, per round o altro vincolo esplicito;
- costo e momento in cui si consuma ciascuna risorsa.

Non tutti i casi richiedono tutti questi campi. Durata e concentrazione sono indipendenti: un effetto persistente può non richiedere concentrazione. Le scadenze riferite al turno di una creatura non equivalgono a un generico contatore di round. Fonti: PHB14 PDF 191, 194, 202–206, 276, 279–280, 290.

## I tre form funzionali minimi

### Form A — «Usa»: dichiarare o avviare un utilizzo

**Chi lo usa:** il giocatore per il proprio personaggio; il Master per creature e PNG.

**Campi comuni derivati:** utilizzatore, edizione, capacità e fonte, requisiti noti, gittata, tempo, durata, concentrazione, formule, CD e bonus disponibili. Mostrare le informazioni necessarie alle scelte, senza richiedere di ricopiarle.

**Campi compilabili soltanto quando necessari:** modalità della capacità; fonte e livello dello slot; eventuale risorsa alternativa; bersagli o posizionamento; assegnazione delle unità; scelte specifiche; evento che giustifica una reazione; intento e contesto per una voce manuale.

**Varianti:** attacco singolo, attacchi multipli, bersagli scelti, area, oggetto/effetto, procedura manuale. Sono sezioni condizionali dello stesso form.

**Invio al Master:** autore, utilizzatore, capacità ed edizione, scelte, destinatari dichiarati o area, costo previsto e prossima operazione richiesta. Se occorrono tiri successivi, la richiesta deve indicare chi deve effettuarli.

**Completamento:** un effetto immediato passa alla risoluzione; uno prolungato entra nel lancio; un effetto persistente crea la propria istanza quando il lancio è completato. Non consumare risorse o avviare timer soltanto perché il form è stato aperto o una bozza è stata inviata.

### Form B — «Risolvi»: effettuare i tiri e applicare gli esiti

**Chi lo usa:** il controllore della creatura chiamata a tirare; il Master vede e coordina la risoluzione completa. Per i PG si propone che il proprietario inserisca il proprio tiro, con possibilità del Master di registrarlo per suo conto; per creature e PNG provvede il Master. Questa è una scelta di prodotto, non un obbligo dell'interfaccia imposto dal manuale.

**Campi comuni derivati:** utilizzo o evento di origine, soggetto che tira, bersaglio pertinente, tipo di prova, bonus noti, difesa di confronto e formule. CA, CD e statistiche segrete si mostrano solo ai ruoli autorizzati.

**Campi compilabili:** dadi richiesti; secondo d20 per vantaggio/svantaggio; dadi aggiuntivi previsti; decisioni condizionate dall'esito; eventuali correzioni del Master con motivazione.

**Varianti delle cinque procedure:**

| Procedura | Compilazione e ordine | Cosa riceve e fa il Master | Eccezioni da conservare |
| --- | --- | --- | --- |
| Tiro per colpire | Scelta del bersaglio → verifica dei modificatori → d20 → esito, con eventuali reazioni → danni se dovuti → effetti. | Attacco e destinatario, dadi e bonus, esito provvisorio, danni per tipo, costo. Conferma modificatori/reazioni e applicazione. | Critico e 1 naturale; attacco mancato; effetti su colpo riuscito; danni critici aggiuntivi. Non richiedere danni se non dovuti. |
| Tiro salvezza | Area o destinatari verificati → evento che rende dovuto il TS → tiro di ciascuna creatura → ramo di successo/fallimento → effetti. | CD e caratteristica, soggetti chiamati a tirare, stato di ciascun TS, quantità condivise quando previste, esiti individuali. | TS differiti o ripetuti; successi/fallimenti automatici previsti da regole specifiche; effetti diversi dal danno. Non aspettare necessariamente il turno del lanciatore. |
| Senza confronto d20 | Scelte e distribuzione valide → eventuali dadi di quantità → verifiche/reazioni pertinenti → esiti. | Ripartizione delle unità o quantità, beneficiari effettivi, immunità rilevanti e risultato. | Quantità fisse o tirate; riserve come Sonno; guarigione; PF temporanei. «Automatico» non significa sempre «danno» né «nessun dado». |
| Prova contro CD | Determinazione della prova e della CD → tiro del soggetto previsto → confronto → esito. | Tipo di prova, bonus applicabili e CD, eventualmente riservata. Richiede il tiro e risolve il ramo corretto. | In Controincantesimo 2014 la prova può non servire; in Punizione collerica la prova successiva non usa il bonus dei TS su Saggezza. |
| Contrapposta | Scelta della manovra → scelta della difesa consentita → due prove → confronto → esito. | Entrambi i soggetti, opzioni di prova, totali e stato precedente. Determina vincitore o parità. | Una parità mantiene la situazione precedente: nel tentativo iniziale di lotta e nel tentativo di liberarsi produce conseguenze diverse. |

I riferimenti delle procedure sono quelli della tabella iniziale. Vantaggio/svantaggio: PHB14 PDF 174; critici: PDF 195, 197. Non trasferire automaticamente le regole dell'1 e del 20 negli attacchi alle prove e ai TS.

**Percorso manuale:** riusa questo form con descrizione dell'esito, risorse effettivamente consumate e variazioni esplicite da applicare. Una conferma generica non deve dichiarare applicate condizioni, movimenti o guarigioni rimasti soltanto nel testo.

**Applicazione:** separare ciò che è calcolato, ciò che attende una scelta e ciò che è già applicato. Per esiti indipendenti su più creature, consentire l'avanzamento per destinatario quando le regole lo permettono; l'eventuale applicazione separata deve risultare nello storico.

### Form C — «Effetto attivo»: gestire ciò che continua dopo l'utilizzo

**Chi lo usa:** utilizzatore e Master; il proprietario di una creatura interessata compila gli eventuali tiri richiesti attraverso il Form B.

**Dati derivati:** origine e livello del lancio, utilizzatore, concentrazione, scadenza, beneficiari attuali, area o oggetto associato, eventi previsti, azioni successive consentite e relativi costi.

**Campi soltanto quando ammessi:** nuova direzione, posizione o destinatario; scelta di un'attivazione successiva; azione per liberarsi; interruzione volontaria; esito manuale di una condizione non rappresentabile.

**Notifiche:** «inizia il turno nella linea: TS su Forza», «fine turno: puoi ripetere il TS», «attacco riuscito: applica l'effetto collegato», «danno subito: verifica concentrazione», «effetto terminato». Ogni richiesta deve riferirsi alla specifica occorrenza; leggere la notifica non la risolve.

**Ordine:** accade l'evento → si verificano interessati e frequenza → Form B, se necessario → si applicano gli esiti → si aggiorna o termina l'effetto. Non ripagare lo slot del lancio per ogni attivazione successiva, salvo un costo ulteriore esplicitamente previsto.

**Esempi verificati:** Folata di vento, PHB14 PDF 249; Cecità/Sordità, PDF 220; Guardiani spirituali e Arma spirituale, PDF 279; Dardo stregato, PDF 290. La gestione degli eventi va distinta dal conteggio della durata.

I tre form sono **tre compiti dell'interfaccia**, non una prescrizione sul numero di componenti o finestre. Non occorrono cinque form giocatore distinti né una copia del form per ogni combinazione di bersagli e durata.

## Sequenze composte che devono funzionare

| Caso 2014 | Sequenza corretta | Cosa dimostra |
| --- | --- | --- |
| Pugnale | A: dichiara attacco → B: tiro per colpire → eventuale reazione → danni ed effetti. | Caso base senza effetto persistente. |
| Raggio rovente | A: sceglie slot e avvia i raggi → B: un attacco per ogni raggio, con relativo bersaglio e danno. | Più unità e più bersagli non implicano un unico tiro. PHB14 PDF 274. |
| Dardo incantato | A: slot e distribuzione completa → B: quantità, reazioni ed esiti simultanei. | Più bersagli senza tiri per colpire. PHB14 PDF 258, 276. |
| Palla di fuoco | A: punto d'origine → Master verifica l'area → B: danno condiviso e TS individuali → esiti per creatura. | L'area non è una lista scelta liberamente dal lanciatore. PHB14 PDF 197, 205, 242–243. |
| Folata di vento | A: direzione e lancio → C: linea attiva → all'inizio del turno di una creatura nella linea, B: TS → eventuale spinta. | Attivazione e risoluzione differita sono momenti distinti. PHB14 PDF 249. |
| Punizione tonante | A: lancio su se stessi → C: attende il primo colpo in mischia previsto → B: danno aggiuntivo e TS del bersaglio per spinta/caduta. | Un utilizzo può combinare attacco, danno ed esito su TS senza diventare una nuova categoria elementare. PHB14 PDF 283. |
| Tocco del vampiro | A: lancio → B: attacco, danno effettivo, guarigione derivata → C: possibili nuovi attacchi con l'azione nei turni successivi. | Alcuni esiti dipendono dal risultato di altri. PHB14 PDF 286. |
| Dardo stregato | A: lancio → B: attacco iniziale → C: verifiche di mantenimento e, nei propri turni, danno automatico usando l'azione. | La modalità di risoluzione può cambiare durante lo stesso effetto. PHB14 PDF 290. |
| Sonno | A: punto → B: riserva tirata; Master ordina le creature per PF attuali e determina quelle interessate → C: durata e risvegli. | Nessun TS nel 2014; l'assenza di d20 non elimina un algoritmo specifico né autorizza a mostrare i PF segreti. PHB14 PDF 277. |
| Arma magica | A: seleziona arma valida → B: applica modifica → C: conserva durata e collegamento all'arma. | Il bersaglio funzionale può essere un oggetto, non un partecipante al combattimento. PHB14 PDF 258. |

Quando un'azione contiene più attacchi con arma, il 2014 permette anche movimento tra gli attacchi: non bloccare sempre tutti i destinatari prima del primo risultato. Non applicare questa libertà ai dardi simultanei di Dardo incantato. Fonte: PHB14 PDF 191, 258.

## Informazioni e richieste per il Master

Riutilizzare una scheda riepilogativa dell'utilizzo, con richieste operative collegate. Non duplicare l'intero lancio come se ogni TS fosse un nuovo utilizzo.

| Evento dell'app | Contenuto minimo | Azione disponibile |
| --- | --- | --- |
| Nuovo utilizzo dichiarato | Autore, utilizzatore, capacità/edizione, scelte, costo previsto, bersagli o area. | Verifica dei requisiti; avvio o richiesta di correzione. |
| Tiro o scelta dovuti | Utilizzo/evento d'origine, soggetto responsabile, prova richiesta, motivo e dati accessibili al ruolo. | Inserisci tiro, inoltra al proprietario, registra esito manuale. |
| Esiti pronti | Riepilogo dei risultati per destinatario, modificatori e conseguenze previste; effetti ancora manuali. | Conferma l'applicazione o correggi con motivazione. |
| Evento di un effetto attivo | Effetto d'origine, istante del turno, creature coinvolte e operazione dovuta. | Risolvi evento, modifica se consentito, termina effetto. |
| Applicazione o termine | Variazioni effettive, risorse spese, durata/concentrazione e autore della decisione. | Consultazione dello storico. |

Il giocatore riceve gli aggiornamenti che lo riguardano e le proprie richieste di tiro. Le creature nascoste, i loro PF, le CA e le CD riservate non devono comparire nelle notifiche destinate a chi non li conosce.

Occorre distinguere **proposta non avviata**, **utilizzo avviato**, **attesa di tiri/reazioni**, **risolto** ed eventualmente **effetto attivo/terminato**. Sono stati funzionali, non una richiesta di introdurre subito una macchina a stati.

**Rifiutare una proposta non ancora avviata non consuma risorse. Dichiarare inefficace un utilizzo già effettuato non equivale ad annullarne il costo.** Un attacco mancato resta effettuato. Un lancio prolungato interrotto non spende lo slot secondo PHB14 PDF 203; un incantesimo preparato con l'azione Prepararsi è già stato lanciato e mantenuto in concentrazione secondo PDF 194. Servono eventi distinti per evitare rimborsi impropri.

Reazioni come Scudo devono poter intervenire prima dell'applicazione definitiva dei danni, anche fuori dal turno del personaggio che reagisce. Fonti: PHB14 PDF 191, 276.

## Riscontro nel progetto attuale

Verifica effettuata sui file presenti nel workspace, comprese le modifiche locali già esistenti. Nessun file applicativo modificato durante questa analisi.

| Presente | Implicazione o limite |
| --- | --- |
| `src/utils/Spellcasting.ts`, funzione `spellEdition`: edizioni 2014/2024, predefinito 2014. | L'edizione va ricavata dalla scheda e confrontata con quella della voce. Non basta il nome dell'incantesimo. |
| `src/domain/dnd/CombatResolution.ts`, `ResolutionPlan`: `attack`, `save`, `automatic`, `none`; pacchetti per colpo/dardo, danni per tipo, alcuni effetti e difese. | Buona base per i primi tre modelli. Mancano procedure generiche per prova contro CD, contrapposta e sequenze di risoluzione miste. `none` non identifica un esito completo. |
| `src/domain/dnd/CombatTargets.ts`: singolo, multiplo, area, revisione. | Separa già la cardinalità dalla risoluzione, ma non rappresenta una geometria completa o tutti i destinatari oggetto/luogo/effetto. Le voci 2024 richiedono verifica separata. |
| `src/components/CombatRolls.tsx`: sezioni condizionali condivise per i tiri e risoluzione del Master. | Non occorre ripartire da un form nuovo per ogni incantesimo. Il percorso ideale attacco → conferma colpo → danni va distinto dalla raccolta anticipata di tutti i dadi oggi presente in alcuni flussi. |
| Folata di vento: `deferredSave` e `src/components/WindReview.tsx`. | Il caso 2014 distingue già il TS differito; il pannello consente la registrazione manuale. Non è un sistema generale di eventi ripetuti per qualsiasi effetto. |
| `server/combat-requests.mjs`, `actionContext`: proposta consentita sul proprio turno. | Il vincolo non copre genericamente reazioni fuori turno o tiri dovuti al personaggio durante il turno altrui. Questi non sono nuove azioni volontarie del lanciatore. |
| Richieste con revisione, idempotenza, approvazione/rifiuto; consumo e applicazione degli esiti supportati sul server. | Conservare queste protezioni. Con più soggetti che risolvono lo stesso utilizzo, un cambiamento non deve cancellare senza distinzione i tiri validi delle altre creature; i cambiamenti rilevanti richiedono nuova verifica. |
| `EffectSpec` copre alcuni bonus, resistenze, CA e condizioni; i bersagli della richiesta hanno principalmente campi per danni. | Non equivale alla gestione completa di guarigione, PF temporanei, movimento, entità evocate, trasformazioni o risultati narrativi. Non presentare un'approvazione come automazione di tutti gli effetti descritti. |

Il grafo Graphify disponibile è del 10 ottobre e non comprende tutti i file attuali: è stato usato per orientare la lettura, non come certificazione dello stato corrente. Il report preesistente `reports/combat-targets.md` contiene inoltre voci in revisione e fonti legacy: non certifica l'assegnazione completa del catalogo ai modelli qui proposti.

## Separazione dal 2024

Questi cambiamenti verificati mostrano perché l'edizione deve guidare anche il form e gli eventi:

| Voce | 2014 | 2024, SRD 5.2.1 | Fonti PDF |
| --- | --- | --- | --- |
| Folata di vento | TS all'inizio del turno nella linea. | TS iniziale per le creature nella linea e TS per chi vi termina il turno. | PHB14 249; SRD24 148. |
| Controincantesimo | Automatico nei casi previsti; altrimenti prova con caratteristica da incantatore. | TS su Costituzione della creatura che sta lanciando; se interrotto, lo slot del suo incantesimo non viene consumato. | PHB14 229; SRD24 136. |
| Sonno | Riserva di PF tirata, nessun TS. | TS su Saggezza e successivo TS, con concentrazione ed esiti differenti. | PHB14 277; SRD24 191. |

Le cinque procedure restano riutilizzabili. Cambiano però soggetto che tira, tempi, sequenze, costi e risultati. Le descrizioni delle edizioni non sono intercambiabili. Confronto ufficiale aggiuntivo: [regole 2014 di lancio](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/spellcasting) e [regole 2024 degli incantesimi](https://www.dndbeyond.com/sources/dnd/br-2024/spells/).

## Decisioni aperte e confini della copertura

1. **Responsabilità dei tiri.** Proposta: il proprietario tira per il proprio PG, il Master per creature e PNG; il Master può registrare tiri per conto dei giocatori. L'attuale interfaccia assegna al Master diversi tiri difensivi. Occorre decidere se mantenere questa convenzione o abilitare le richieste ai proprietari.
2. **Dadi fisici o generati dall'app.** I form devono distinguere dato del dado, bonus ed esito finale. L'analisi non introduce un generatore né certifica tiri inseriti manualmente.
3. **Conferma del Master.** Per partire, conservare il controllo esistente sugli esiti applicati; separarlo dall'accertamento del colpo e dalle decisioni che avvengono prima. L'approvazione è una scelta dell'app, non una regola di D&D.
4. **Posizione.** In assenza di mappa, il Master conferma area, gittata e spostamenti. L'app non può validare geometricamente una scelta con i soli nomi dei partecipanti.
5. **Risorse e interruzioni.** Definire quando l'utilizzo è iniziato, quando ciascun costo viene applicato e quali interruzioni lo mantengono o lo evitano secondo la regola. Una correzione tecnica non deve diventare automaticamente un rimborso di un'azione già effettuata.
6. **Sequenze e concorrenza.** Distinguere unità simultanee e attacchi successivi; consentire risposte di più proprietari e reazioni senza duplicare consumo o risultati. Ripetere l'invio della stessa occorrenza non deve applicarla due volte.
7. **Voci parziali, legacy e personalizzate.** Mostrare la procedura suggerita come non verificata e usare l'arbitraggio del Master per i dati mancanti. Non dedurre un'automazione certa dal testo libero.
8. **Convenzioni interpretative.** Registrare separatamente le scelte del tavolo, incluse le procedure dei dadi nei casi non risolti univocamente dalle fonti lette. Non etichettarle come RAW verificata.

I tre form possono raccogliere una dichiarazione e un esito manuale anche nei casi seguenti, ma **non bastano a simularli automaticamente senza dati e regole specifici**:

- Sonno 2014 e altri effetti con riserve, ordinamenti, soglie o selezione dei destinatari determinata dalle statistiche.
- Evocazioni e creazione/controllo di entità: servono identità, statistiche, controllo, partecipazione ai turni e condizioni di termine.
- Trasformazioni e sostituzioni delle statistiche: servono stato precedente, riserve appropriate e procedura di ripristino.
- Muri, terreno, teletrasporti e movimento: richiedono geometria oppure decisione manuale esplicita.
- Illusioni, informazioni riservate, comandi e risultati narrativi: serve arbitraggio; un semplice successo/fallimento non descrive necessariamente il risultato.
- Effetti che modificano altri tiri, sostituiscono risultati, cambiano bersagli o intervengono in finestre specifiche: serve collegamento al tiro o evento corretto.
- Sequenze miste e danni collegati alla guarigione: servono passaggi e dipendenze specifici, non soltanto una modalità globale assegnata alla capacità.

La copertura proposta è quindi: **cinque procedure di risoluzione; selezione e distribuzione dei bersagli configurabili; esiti combinabili; eventi successivi; arbitraggio per i casi non rappresentati. Tre form funzionali consentono di gestire questi compiti senza moltiplicare le schermate.** La classificazione completa del catalogo e l'implementazione rimangono lavori successivi.
