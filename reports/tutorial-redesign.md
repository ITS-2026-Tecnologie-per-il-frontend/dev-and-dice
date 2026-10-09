# Creazione guidata: riorganizzazione dell'interfaccia

## Scelte grafiche

La precedente interfaccia aveva nove pulsanti senza indicazioni sulle scelte mancanti, campi e spiegazioni sullo stesso piano e un riepilogo senza collegamenti ai singoli argomenti. Le azioni della bozza erano separate dalla navigazione del tutorial.

La nuova interfaccia mantiene il verde petrolio dell'app e le superfici del tema chiaro/scuro. I titoli dei passaggi in Georgia richiamano le schede del personaggio; etichette, controlli e spiegazioni usano il carattere dell'app. Nessun nuovo font, immagine, dipendenza o servizio esterno.

- Desktop: navigazione laterale con numero, passaggio corrente e verifiche pendenti; smartphone: gli stessi nove pulsanti scorrono orizzontalmente. Il cambio di passaggio porta il focus al titolo e rende visibile il pulsante corrente.
- Campi raggruppati per argomento, indicazioni obbligatorio/facoltativo, errori associati tramite `aria-describedby` e `aria-invalid`. Le verifiche in fondo portano al campo o al passaggio da correggere.
- Valori calcolati separati dai controlli modificabili. Informazioni lunghe e fonti sono espandibili.
- Barra delle azioni con Indietro, Continua/Salva personaggio, Salva e riprendi più tardi e Cancella. Stato del salvataggio ed eventuali errori compaiono nella stessa barra. La barra diventa statica sulle finestre basse per lasciare spazio ai campi.
- Riepilogo in otto argomenti con pulsanti Modifica, inclusi aspetto, personalità, competenze e magie preparate.

## Compatibilità e controlli

`TutorialReview.ts` riusa la validazione esistente, senza aggiungere dati di visita o cambiare le condizioni per proseguire/salvare. Regole, calcoli, chiavi di localStorage, migrazioni delle bozze e modelli delle schede sono invariati. Le azioni della bozza usano gli stessi gestori di salvataggio e cancellazione, passati al tutorial tramite `children`.

Verifiche automatiche superate:

- TypeScript, build Vite, oxlint e `git diff --check`.
- `tutorial-interface.mjs`: 54 rendering, nove passaggi per sei casi (bozza vuota, mago livello 1 e 17, Ranger, adattamento 2024 e bozza senza identificativi degli incantesimi). Validazione identica al motore precedente, schema delle bozze, collegamenti ARIA esistenti e univoci, blocco delle azioni, riepilogo e composizione tramite PlayerSheet.
- `tutorial-interactions.mjs`: gestori reali di modifica dei campi, Continua/Indietro, collegamenti del riepilogo, navigazione diretta, rimozione/nuova selezione degli incantesimi e preparazione. Gli hook sono simulati; questo controllo non usa il DOM di un browser.
- `dialog-autosave.mjs`: pause/ripresa, input incompleti, errori di scrittura, salvataggio finale con incantesimi e modello conservati, rimozione della bozza e Cancella senza modificare i personaggi salvati.
- Suite esistenti: character-tutorial, character-calculations, random-character, character-appearance, spellcasting, spell-selection-limits, player-templates, player-sheet, inventory e player-creation-ui. La generazione casuale comprende 108 combinazioni classe/razza e tutte le 12 classi ai livelli 2–20.
- Contrasto calcolato dai colori: pulsante principale 4,99:1; testo secondario chiaro 5,73:1 e scuro 7,04:1; bordi dei controlli chiari 3,61:1 e scuri 5,12:1. Focus visibile, controlli nativi e pulsanti da almeno 44 px.

Il browser integrato non è disponibile: l'inizializzazione restituisce `Browser is not available: iab` e la lista dei browser è vuota. Non sono stati verificati visivamente layout, overflow, posizione della barra durante lo scorrimento, focus effettivo, tastiera, lettore di schermo o interazioni touch su desktop/smartphone. Servono queste prove per completare la verifica visiva e dell'accessibilità.

## Prestazioni

Misurazioni tramite `scripts/benchmark-character-tutorial.mjs`; mediana di tre rendering React lato server, stessi dati e casi. JSON originali in `tutorial-before.json` e `tutorial-after.json`. Escludono DOM, layout, paint, rete e caricamento iniziale del catalogo: non rappresentano la latenza di navigazione nel browser.

| Caso | Passaggio | Prima (ms) | Dopo (ms) |
| --- | --- | ---: | ---: |
| Bozza vuota | Iniziamo | 2,3 | 3,8 |
| Mago 1 | Iniziamo | 5,7 | 11,1 |
| Mago 1 | Caratteristiche | 7,4 | 13,0 |
| Mago 1 | Incantesimi | 30,9 | 34,2 |
| Mago 1 | Personalità | 8,0 | 16,1 |
| Mago 1 | Riepilogo | 15,4 | 20,7 |
| Mago 17 | Iniziamo | 12,3 | 16,6 |
| Mago 17 | Incantesimi | 118,8 | 126,2 |
| Mago 17 | Riepilogo | 27,6 | 13,1 |

I controlli di tutti i passaggi aggiungono alcuni millisecondi ai passaggi iniziali. Il riepilogo riusa gli stessi risultati senza una seconda validazione finale. Non emerge un costo di diversi secondi in questi rendering, ma senza browser non si può escludere un problema di layout o interazione.

Per contenere il costo, i risultati sono memoizzati e i calcoli necessari alla UI degli incantesimi sono eseguiti solo nel relativo passaggio. Una misurazione dedicata sul mago 17 ha rilevato 870 chiamate a `spellRowState` nella ricerca delle magie selezionate (6,35 ms); calcolare lo stato una volta per ciascuna delle 43 righe conserva gli stessi risultati con 43 chiamate (1,25 ms). La UI riusa ora questo stato per selezione, disponibilità e preparazione. Le schede degli incantesimi fuori viewport usano `content-visibility`; il beneficio nel browser non è stato misurato.

La build produce il consueto avviso Vite sul bundle oltre 500 kB; il caricamento iniziale non è stato misurato in questa sessione.
