# Inventario del personaggio

L’inventario è la fonte dei dati degli oggetti posseduti. Le dotazioni strutturate di classe e background, comprese le alternative effettivamente scelte, vengono inserite automaticamente. I pacchetti presenti nel catalogo vengono espansi nei contenuti: si registra, per esempio, lo zaino e il suo contenuto, senza conteggiare anche un secondo peso complessivo del pacchetto.

## Uso

La pagina Inventario mantiene i dodici riquadri originali. «Oggetti precedenti» e «Altri oggetti», sotto il template, permettono di vedere le ulteriori voci. Quantità e pesi si possono modificare nello zaino e nella sezione «Inventario · oggetti e collegamenti», disponibile anche nel passaggio Equipaggiamento del tutorial.

Cliccando su un campo che rappresenta un oggetto, oppure premendo Invio/Spazio quando ha il focus, si apre il selettore dell’inventario. Il selettore identifica anche gli oggetti omonimi come voci distinte. Nei riquadri dell’equipaggiamento indossato si possono selezionare più oggetti. La sezione di gestione offre gli stessi collegamenti e permette di aggiungere oggetti del catalogo o personalizzati, modificarne i dati e rimuoverli.

| Campo | Dati condivisi |
| --- | --- |
| Equipaggiamento | Riepilogo degli oggetti nell’inventario e delle quantità |
| Armatura e scudo | Riferimenti alle voci possedute; CA, requisiti e limitazioni tramite i calcoli esistenti |
| Attacchi | Nome e proprietà dell’arma referenziata; bonus/danni tramite i calcoli condivisi, conservando gli override |
| Munizioni | Riferimento all’oggetto e quantità della stessa voce |
| Oggetti magici / pergamene / pozioni | Nome, descrizione/usi, equipaggiato, necessità di sintonia e sintonia condivisi |
| Equipaggiamento indossato | Uno o più riferimenti agli oggetti, con nomi aggiornati |
| Consumabili e oggetti armonizzati | Riepiloghi delle voci contrassegnate nell’inventario |

Modificare un nome aggiorna i riquadri collegati. La quantità e il peso vengono conteggiati una volta per voce, anche se più riquadri richiamano lo stesso oggetto. Anche il conteggio delle sintonie usa gli oggetti posseduti, senza contare più volte i riferimenti. Se un oggetto viene rimosso o ha quantità zero, i riferimenti non vengono sostituiti con un omonimo: le viste si svuotano e la scheda segnala i collegamenti da correggere. Per un riquadro con più oggetti restano visibili quelli ancora disponibili.

## Dati e recupero

Si riutilizzano `inventory.<riga>.0` (nome), `.1` (peso unitario in kg), `.2` (quantità) e `.3` (totale calcolato). Ogni voce ha `.id`, indipendente dalla riga e dal nome. Catalogo, provenienza, descrizione, stati e modifiche supportate alle proprietà restano associati alla voce. I campi `inventory.ref.<campo>` contengono gli identificativi; per l’equipaggiamento indossato possono contenerne una lista. Le vecchie chiavi dei box restano proiezioni per compatibilità, non fonti modificabili indipendenti.

`applyCreation` riconcilia anche l’inventario delle schede manuali. Il flusso di caricamento/salvataggio esistente e le card del combattimento riutilizzano questi dati. Le dotazioni generate sono tracciate per provenienza: un ricalcolo non le aggiunge nuovamente. Quando cambiano le scelte, le vecchie dotazioni non modificate vengono sostituite; quelle modificate e gli oggetti acquisiti durante il gioco vengono conservati. Un oggetto rimosso intenzionalmente non viene rigenerato al ricalcolo successivo.

Il recupero conserva le righe preesistenti, assegna identificativi e importa l’equipaggiamento testuale e gli oggetti presenti negli altri riquadri. I pacchetti testuali riconoscibili nel catalogo vengono espansi. Si conserva un archivio dei campi precedenti, comprese descrizioni, stati degli oggetti magici e quantità delle munizioni. Quando un testo potrebbe rappresentare un oggetto già presente, viene segnalato nella sezione di gestione: l’utente può collegarlo alla voce esistente o conservarlo come oggetto distinto. Il solo nome non basta per unirli. Una provenienza salvata non leggibile resta conservata e interrompe l’assegnazione automatica delle dotazioni, evitando aggiunte ripetute.

I pesi del catalogo sono in libbre e vengono convertiti in kg durante l’inserimento; i pesi manuali preesistenti non vengono riconvertiti. Quantità vuota significa uno, zero significa esaurito, peso zero è valido e i decimali con virgola sono accettati. Un peso sconosciuto o invalido non produce un totale trasportato apparentemente completo. Gli override manuali già supportati di CA, attacchi e peso complessivo rimangono disponibili.

## Verifica manuale

Passare alla compilazione manuale conserva tutte le dotazioni presenti. Le descrizioni degli oggetti magici si modificano dopo aver collegato un oggetto: cliccando sulla descrizione di un riquadro vuoto si apre il selettore.

Restano da verificare i testi liberi che mescolano oggetti e note, le possibili duplicazioni storiche prive di identificativi/provenienza, i pesi assenti nel catalogo e gli effetti magici descritti soltanto in prosa. I collegamenti non deducono automaticamente bonus magici, cariche o condizioni speciali dal nome. La CA automatica usa i riferimenti Armatura/Scudo e le proprietà strutturate; contrassegnare genericamente un oggetto come equipaggiato non sceglie quale formula di CA applicare.

## Controlli

`node tests/inventory.mjs` verifica dotazioni e contenuti, quantità, identificativi stabili, oggetti omonimi, proprietà e calcoli, riferimenti multipli, rimozione, cambio di classe/template, recupero delle schede, bozze, salvataggio/riapertura e dati delle card del combattimento. Sono coperti pesi decimali, valori zero/invalidi, pacchetti preesistenti, nomi personalizzati e provenienza non leggibile. I test esistenti di creazione, calcoli, tutorial, schede, sintonie e combattimento verificano le regressioni.

Verificato anche nel browser: dotazioni del mago nella pagina Inventario, paginazione con quattordici voci, modifica di nome/quantità/peso, descrizioni condivise fra due box, selezione di più oggetti indossati, tre template, salvataggio/riapertura e pulizia delle viste dopo rimozione. Nessun asset, CSS o disposizione dei template è stato modificato; i controlli aggiuntivi sono esterni al foglio.
