# Controincantesimo: form e verifiche

Riferimento esclusivo: D&D 5e 2014. `D&D_5_Player_Original_Handbook.pdf`: pagine PDF 229 (Counterspell), 194 (Ready), 203 (tempi di lancio), 55 (Factotum) e 116 (Abiurazione Migliorata). Il form non applica la diversa risoluzione del 2024.

## Flusso implementato

- Form dedicato nella sidebar del Master, tra le proposte del giocatore e nel popup di reazione segnalato dal Master.
- Selezione del lancio pendente o in corso, con associazione alla richiesta o all'esecuzione effettiva. Per i lanci non registrati si seleziona la creatura e il Master dichiara nome facoltativo e livello: l'eventuale gestione della risorsa e dell'effetto avversari resta manuale.
- Slot dal 3° livello, requisiti espliciti di visibilità, portata di 18 metri, lancio in corso e componente somatica. La reazione disponibile e le risorse vengono verificate dal server.
- Il giocatore invia l'intenzione senza ricevere livello o nome nascosti del lancio avversario. Il Master vede il livello dello slot effettivamente usato; per un lancio dichiarato lo inserisce.
- Interruzione automatica se il lancio avversario non supera lo slot. Negli altri casi il Master registra il d20 comunicato dal lanciatore, modalità normale/vantaggio/svantaggio ed eventuali altri modificatori con provenienza. Il confronto usa CD 10 + livello effettivo del lancio avversario.
- Modificatore della caratteristica da incantatore con dettaglio in hover. Factotum e Abiurazione Migliorata sono inclusi quando riconosciuti dalla scheda; nessuna competenza automatica negli altri casi e nessun successo/fallimento automatico con 20/1 naturale.
- Nessun danno e nessuna concentrazione da configurare. La concentrazione precedente di chi usa Controincantesimo resta attiva.
- La proposta non spende risorse. L'approvazione consuma slot e reazione anche quando la prova fallisce; richieste rifiutate, non valide o duplicate non applicano un secondo consumo.
- Un lancio collegato non può essere approvato mentre il relativo Controincantesimo è pendente. Al successo vengono consumate le risorse del lancio interrotto senza applicarne gli effetti. Al fallimento la richiesta originale resta approvabile.
- Un Controincantesimo pendente può essere scelto come lancio da interrompere; annullarlo lascia disponibile il suo lancio bersaglio originale. Le finestre di reazione collegate vengono concluse coerentemente.
- Un'esecuzione prolungata interrotta viene chiusa, con fine della concentrazione sul lancio, così non può completarsi successivamente.

## Verifiche riproducibili

- `node tests/counterspell.mjs`: calcolo automatico/prova, soglia esatta, slot superiore, 1/20 naturale, vantaggio/svantaggio, bonus, separazione 2014/2024, proprietà del personaggio, risorse, privacy, mancata applicazione del lancio interrotto, ripresa dopo fallimento, interruzione di un altro Controincantesimo e di un'esecuzione prolungata.
- `node tests/counterspell-ui.mjs`: server e account isolati, form Master e giocatore, livello nascosto, dadi condizionali, hover modificatore, fallimento con consumo, revisione e approvazione, annullamento di una Palla di Fuoco reale senza danni, idempotenza, ricaricamento e popup di reazione. Screenshot desktop/mobile nei temi chiaro e scuro in `.test-runtime.local/counterspell-*`.

## Ambito

Visibilità, distanze e componente somatica richiedono conferma del Master: il tavolo non dispone di dati geometrici sufficienti per verificarli automaticamente. Dal 28 ottobre i lanci registrati, anche diretti del Master, offrono automaticamente il popup e la finestra basata sugli eventi descritti in [registro-eventi-test.md](registro-eventi-test.md). Il popup conserva il timer di 30 secondi; la scadenza da sola non invalida un lancio registrato. Bonus narrativi, risorse di effetti non modellati e lanci non registrati richiedono verifica manuale. Queste prove non certificano ogni privilegio o variante del catalogo.
