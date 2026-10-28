# Disponibilità, registro e finestra di Controincantesimo

Aggiornamento del 28 ottobre 2026. Il registro si apre dall’icona del libro «Registro degli eventi», negli strumenti di entrambi i ruoli. Non crea notifiche di approvazione o contatori di non letto. Le azioni dirette del Master aggiornano il registro senza avvisare i giocatori con notifiche di modifica; le modifiche manuali alle schede conservano il flusso precedente.

## Regola e scelta dell’app

`MANUALI/D&D_5_Player_Original_Handbook.pdf`, pagina PDF 229, «Counterspell», richiede una creatura vista entro 18 metri **mentre lancia** e una componente somatica. Non richiede un’azione preparata. La reazione si recupera all’inizio del proprio prossimo turno (pagina PDF 191, «Reactions»). La risoluzione resta quella 2014: interruzione automatica oppure prova di caratteristica contro CD 10 + livello del lancio. Anche gli slot di Magia del Patto già riconosciuti dalla scheda usano il loro livello effettivo (pagina PDF 108, «Pact Magic»).

La finestra retroattiva descritta qui è una **scelta dell’app**, non un’estensione del tempo concessa dal regolamento. Il Master sceglie la modalità in **Impostazioni → Controincantesimo · Sessione**. La modalità iniziale è «Fino al prossimo evento o azione», con popup da 30 secondi. In questa modalità, per i lanci registrati il semplice tempo trascorso non chiude la possibilità di reagire:

| Evento | Effetto sulla finestra |
| --- | --- |
| Scadenza dei secondi configurati o chiusura del popup | Chiude il popup, senza spendere risorse; la card di Controincantesimo resta disponibile sul lancio registrato. |
| Leggere, cercare, aprire o configurare un form inattivo | Non chiude la finestra. |
| Effetti automatici e risoluzione dello stesso lancio | Aggiornano lo stesso evento. |
| Applicare un’altra azione, modificare PF/condizioni/risorse o cambiare turno | Chiude la finestra precedente. |
| Reazione collegata al lancio | È collegata al suo evento; il server ricontrolla comunque risorse e validità. |

La modalità alternativa **Timer di inattività** mantiene contrastabile ciascun lancio fino alla sua scadenza, anche se nel frattempo avvengono altri eventi. Le due modalità sono esclusive; la risoluzione deve comunque poter annullare gli effetti in sicurezza. La durata accetta interi da 1 a 3600 secondi. Ogni lancio conserva modalità e durata in vigore alla sua creazione: cambiare impostazioni riguarda i lanci successivi e non è un evento di gioco.

Il popup viene offerto ai personaggi con una reazione pertinente. Digitare, modificare un campo o premere «Riavvia» nel form di Controincantesimo rinnova il timer condiviso, anche nella sidebar del Master o del giocatore, senza cancellare i dati già compilati. Restare inattivi non lo rinnova. Scudo e le altre reazioni conservano i propri 30 secondi indipendenti. Una proposta inviata entro il termine può essere approvata dal Master anche dopo la scadenza, con nuova verifica di risorse e validità. Eventi dichiarati al tavolo tramite «Segnala una reazione» usano soltanto il timer, con la durata configurata per Controincantesimo: senza un lancio registrato non esiste un insieme di effetti da annullare automaticamente. Distanza, visibilità, componenti e requisiti non rappresentati dal tavolo richiedono conferma del Master. Un personaggio incapacitato prima del lancio non diventa idoneo a contrastarlo solo perché i suoi danni lo hanno svegliato.

## Applicazione e annullamento

Il server assegna sequenze crescenti al momento del salvataggio atomico e collega le reazioni al lancio originale. Il registro conserva autore, personaggio, bersagli, risultati disponibili e differenze effettive tra prima e dopo. I giocatori vedono i dettagli delle proprie modifiche; nome e livello di un incantesimo avversario restano nascosti. I risultati dettagliati dei form del Master sono riservati al Master.

Un lancio ancora proposto viene interrotto prima degli effetti. Per un lancio già applicato vengono ripristinati soltanto i suoi valori ancora corrispondenti al risultato registrato: danni, cure, PF temporanei, condizioni, effetti e potenziamenti. Slot, utilizzo dell’azione e precedente concentrazione interrotta del lanciatore non vengono restituiti. La reazione e lo slot di Controincantesimo si consumano una volta anche al fallimento. Una modifica estranea non viene sovrascritta: se l’inverso non è sicuro, l’intera approvazione fallisce senza consumare risorse. Creazione/rimozione di schede o modifica della struttura del combattimento richiedono risoluzione manuale.

Gli eventi nuovi vengono raccolti da questo aggiornamento; non si ricostruiscono azioni dirette del Master avvenute prima. Le vecchie richieste restano nel loro storico. Lo storage mantiene la coda e il file atomico esistenti per una singola istanza Node; prima di più istanze serve un database transazionale. La cronologia cresce con la partita; l’API restituisce pagine da 50 eventi. La coda locale distingue fino a 30 operazioni non ancora confermate, anche quando vengono salvate insieme; non contiene ritratti ed è eliminata dopo il salvataggio atomico. Nel registro persistono soltanto le differenze, non copie ripetute di tutte le schede.

## Prova manuale

1. In una sessione 2014, assegna Controincantesimo e slot disponibili ad Aster. Apri Master e giocatore in browser/account separati. Senza un lancio, la card deve essere colorata diversamente: il giocatore non la apre, il Master sì. Hover, Tab e tocco devono mostrare il motivo.
2. Dal Master fai lanciare un incantesimo a un NPC su Aster. Apri il registro: devono comparire lanciatore, bersaglio e modifiche; nessuna richiesta da approvare per il lancio diretto.
3. Lascia scadere il popup. Senza applicare altre modifiche, ricarica il giocatore: Controincantesimo resta utilizzabile. Aprire e compilare altri form non deve chiuderlo.
4. Usa Controincantesimo e approvalo. Controlla che l’effetto originale sia annullato, che lo slot dell’NPC resti consumato e che il giocatore consumi una sola reazione e un solo slot. Ricarica entrambi i ruoli e ricontrolla il registro.
5. In un nuovo turno ripeti il lancio, poi applica una modifica indipendente, per esempio un punto di danno a un’altra creatura. Controincantesimo sul lancio precedente deve essere bloccato. Lo stesso controllo deve impedire l’approvazione di una reazione inviata prima della modifica.

6. Nelle impostazioni scegli «Timer di inattività», imposta 60 secondi e salva. Al prossimo lancio, attendi quasi la scadenza e modifica un campo del form, da Master o giocatore: deve ripartire il conto da 60 senza perdere i valori. Ricarica: impostazioni e termine restano condivisi.
7. In modalità timer verifica che una modifica a un’altra creatura non chiuda la finestra; l’annullamento deve conservare quella modifica. Lascia invece scadere il timer senza interagire: non deve più essere possibile reagire o riavviarlo. Invia una nuova reazione prima della scadenza e approvala dopo: deve consumare slot e reazione una sola volta.

## Controlli automatici

- `node tests/game-events.mjs`: server e browser isolati, entrambi i ruoli, hover/focus, popup, scadenza simulata, ricarica, configurazione, consumo unico, approvazioni contemporanee, uso diretto del Master, modifica successiva, inversi di PF/condizioni/PF temporanei, conservazione di dati estranei e azioni raggruppate in un salvataggio.
- `node tests/counterspell.mjs` e `node tests/counterspell-ui.mjs`: risoluzione 2014, privacy, slot normali/Patto, interruzioni annidate, form e temi desktop/mobile.
- `node tests/reactions-ui.mjs`, `node tests/master-weapon-ui.mjs`, `node tests/turn-economy.mjs`, `node tests/sleep.mjs`: regressioni dei flussi condivisi.
- `node tests/counterspell-timing.mjs`: impostazioni e timer condivisi, entrambi i ruoli, rinnovo durante la compilazione, modalità esclusive, scadenza, invio e approvazione differiti; screenshot desktop/mobile.
- `npm run build` e `npm run lint`.

Gli screenshot dei test browser sono locali in `.test-runtime.local/event-*` e `.test-runtime.local/counterspell-*`.
