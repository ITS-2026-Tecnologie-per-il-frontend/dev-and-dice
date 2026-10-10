Completa il riferimento verificato di D&D 5e 2014 e costruisci un nuovo database locale, basato sui manuali e integrato con i contenuti del database attualmente utilizzato dal programma.
Usa la skill [$dnd-5e-rules](C:\\Users\\utente\\Desktop\\ALESSANDRO\\Script\\dev-and-dice\\.agents\\skills\\dnd-5e-rules\\SKILL.md) e il rapporto di copertura in rules-reference.local/2014/REPORT.md per individuare le lacune. Il database attualmente in funzione deve rimanere invariato durante il lavoro. Le correzioni e le integrazioni devono confluire nel nuovo database.
Procedi nel seguente ordine:
1. Crea e verifica il backup del database attuale.
   - Individua tutti i file, cataloghi, schemi e configurazioni necessari a ripristinare il database effettivamente utilizzato dal programma.
   - Crea una copia completa in una directory locale separata, con data e ora, esclusa da Git.
   - Registra percorsi originali, versione dello schema e impronte SHA-256.
   - Verifica che il backup sia leggibile e identico agli originali; esegui i controlli di integrità pertinenti al formato.
   - Documenta la procedura di ripristino. Conserva il backup senza modificarlo durante estrazione, confronto e integrazione.
2. Verifica fonti, edizioni ed errata.
   - Usa il PHB originale inglese come fonte principale per i contenuti del personaggio, consultando DMG e Monster Manual per le categorie pertinenti.
   - Segui il workflow della skill: cerca con search_rules.py, poi leggi le pagine circostanti e i rimandi.
   - Il PHB locale è della prima stampa: acquisisci e verifica le errata ufficiali 2014 prima di risolvere divergenze riguardanti Lottatore, riposi e altre regole.
   - Conserva separatamente il dato della stampa originale e l’eventuale correzione editoriale, citando entrambe le fonti.
   - Mantieni distinti contenuti 2014, 2024, supplementi, UA e homebrew. Non attribuire un’edizione o una provenienza senza verificarla.
3. Correggi nel nuovo database gli errori già confermati.
   - Per il warlock, le invocazioni conosciute devono essere 2 al livello 4 e 3 al livello 6.
   - Correggi anche la sorgente o il generatore destinato al nuovo database, affinché la rigenerazione conservi questi valori.
   - Verifica l’intera progressione e aggiungi test mirati.
   - Registra per ogni correzione valore precedente, valore verificato, fonte e conseguenza sulle logiche del programma.
4. Completa creazione e progressione del personaggio.
   - Verifica privilegi delle 12 classi e delle 40 sottoclassi PHB, tratti razziali, sottorazze, background e relative scelte.
   - Completa invocazioni, manovre, metamagia, discipline, incantesimi concessi e altre opzioni.
   - Per ogni capacità rappresenta prerequisiti, effetti, quantità, livello, utilizzi, recupero delle risorse e condizioni di applicazione.
   - I 249 eventi di progressione censiti non certificano la completezza dei relativi comportamenti.
5. Verifica integralmente gli incantesimi.
   - Completa le 347 descrizioni ancora da revisionare e conferma le liste di classe.
   - Controlla componenti materiali, concentrazione, bersagli, tiri salvezza, danni, durata e potenziamento.
   - Conserva nomi inglesi, traduzioni italiane e provenienza; separa le spiegazioni dalle meccaniche.
   - Mantieni esplicite anomalie OCR, informazioni mancanti e interpretazioni aperte.
6. Completa le categorie rimanenti e aggiorna il confronto.
   - Verifica equipaggiamento, quantità delle confezioni, veicoli, servizi e regole d’avventura; successivamente oggetti magici DMG e statistiche MM.
   - Anticipa le creature necessarie a capacità come Forma Selvatica e famigli.
   - Valuta le 132 voci mancanti nel catalogo di creazione come possibili aggiunte.
   - Classifica differenze di denominazione, duplicati, supplementi e record non riconosciuti, senza considerarli automaticamente errori.
7. Costruisci il nuovo database mediante un’integrazione tracciabile.
   - Usa il database attuale come ingresso in sola lettura e scrivi il risultato in una directory separata.
   - Integra i contenuti verificati dei manuali con quelli esistenti, conservando i dati utili del programma.
   - Definisci regole esplicite di corrispondenza, deduplicazione e risoluzione dei conflitti.
   - Applica automaticamente soltanto correzioni confermate. I dati OCR e le interpretazioni non verificate devono rimanere candidati separati.
   - Conserva identificatori e relazioni esistenti quando possibile; documenta eventuali nuovi identificatori mediante una mappa di conversione.
   - Mantieni riconoscibili contenuti aggiuntivi, homebrew e altre edizioni.
   - Registra per ogni voce origine, stato di verifica e operazione effettuata: mantenimento, aggiunta, correzione o conflitto irrisolto.
8. Verifica compatibilità e prepara una migrazione reversibile.
   - Realizza un adattatore esplicito tra il nuovo database e i tipi dell’app, ampliando quelli che non rappresentano tutte le regole.
   - Controlla integrità, riferimenti, progressioni e ripetibilità della generazione.
   - Collauda avanzamento, multiclassamento, scelte, recupero delle risorse, equipaggiamento e lancio degli incantesimi.
   - Produci un confronto prima/dopo e verifica che il database operativo sia rimasto invariato.
   - Mantieni separata l’attivazione del nuovo database dalla sua costruzione; documenta il passaggio e il ripristino della versione precedente.
Consegna backup verificato, nuovo database integrato, strumenti di rigenerazione, rapporto delle modifiche e dei conflitti, copertura aggiornata, risultati dei test e procedura di migrazione e ripristino.
Procedi autonomamente. Non dichiarare completa una categoria finché inventario, meccaniche, fonti, traduzioni e relazioni non siano stati verificati. Parafrasa le descrizioni e non incorporare interi manuali o lunghe riproduzioni nel progetto.