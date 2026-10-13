# Database attivo D&D 5e 2014

L’app carica `public/data/rules2014/`, derivato dalla release verificata
`candidate-0d0d275e18ee23737904`. Sono inclusi i cataloghi necessari, il riferimento
corretto, la mappa degli ID, la copertura e le licenze dei cataloghi preesistenti.
Il payload è circa 25 MB, distribuito come file statici senza incorporarlo nel
JavaScript. `RELEASE.json` controlla con SHA-256 tutti i file consumati dal loader.
Un file mancante, alterato o di edizione errata interrompe il caricamento; l’app
segnala l’errore e conserva la compilazione manuale.

I 2504 record sono consultabili con nome, fonti, pagine PDF e stato individuale.
2466 record sono completi nel modello; 38 sono parziali o dipendenti. Il bestiario
copre lo scope censito, non tutto il Monster Manual. Le parafrasi italiane sono
traduzioni proprie. Manuali, OCR, render, release storiche e backup privati restano
esclusi da Git. La release sorgente resta immutabile.

## Utilizzo nell’app

- «Manuali e strumenti del DM · 2014»: ricerca nel riferimento, visualizzazione
  delle meccaniche e delle fonti, calcolatori di contese, tesori, follia, Magia
  Selvaggia, inseguimenti, oggetti, punti incantesimo, soffio e Punizione Divina.
- «Regole, scelte e risorse · 2014» nella scheda: livelli per classe, sottoclassi,
  invocazioni, patti, stili, manovre, totem, discipline, metamagia, talenti e scelte
  del mago; prerequisiti e autorizzazioni DM rimangono espliciti.
- Progressione, bonus di competenza, PF medi, dotazioni e privilegi usano i dati
  verificati. Il multiclassamento mantiene competenze iniziali, PF e limiti di
  apprendimento per classe; gli slot condivisi e quelli del Patto sono distinti.
  Gli Attacchi Extra non si sommano.
- Riposi, risorse di classe, dadi vita, conversione dei punti stregoneria, slot
  creati e Arcanum Mistico hanno contatori separati. Il Ki richiede meditazione;
  un riposo breve non ripristina automaticamente PF o slot ordinari.
  I dadi vita si spendono per classe. Nel riposo lungo si recuperano prima i dadi
  più grandi; le schede precedenti con una ripartizione ambigua richiedono di
  indicare i dadi usati per classe, conservando il totale salvato.
- Il lancio verifica accesso alla magia, livello della singola classe,
  preparazione, rituali, materiali, mani, voce, armatura e magia con azione bonus.
  I lanci prolungati si registrano soltanto dopo conferma del completamento.
  La concentrazione precedente richiede conferma prima della sostituzione.
  La cronologia dei lanci viene conservata nel turno e azzerata al cambio di
  turno nel tracker; fuori dal combattimento è disponibile il comando esplicito
  di azzeramento. Le scelte di Segreti Magici conservano il privilegio di origine.
- Gli incantesimi dei domini, giuramenti e del Circolo sono concessi dai privilegi;
  le liste ampliate dei patroni sono possibilità di scelta, senza concessione
  automatica. Le magie parziali non vengono lanciate dal motore verificato.
- Creature, famigli, Forma Selvatica, compagni del ranger e oggetti magici hanno
  controlli dedicati. La sintonia riguarda la copia effettiva nell’inventario;
  cariche, varianti e prerequisiti non si confondono con l’identificazione.
- Le scadenze esplicite nel turno del lanciatore seguono inizio/fine turno;
  i normali timer seguono il round. Le condizioni e i TS ripetuti restano visibili
  nelle meccaniche. Il danno durante concentrazione richiede un TS per fonte,
  risolto esplicitamente dal giocatore/DM.
  L’Ira attivata nel tracker aggiorna la scheda, consuma un uso e termina la
  concentrazione; la fine o la scadenza dell’effetto rimuove lo stato di Ira.

La simulazione dei bersagli, dei tiri, delle posizioni, dei comandi e delle
conseguenze narrative resta responsabilità del tavolo. La consultazione include
anche queste regole: visualizzarle non autorizza ad applicare automaticamente
una voce parziale o opzionale. I benefici condizionali dei talenti, le loro scelte
interne e gli incrementi già registrati nei punteggi richiedono revisione del DM.
I cataloghi aggiuntivi/legacy conservano i loro ID e sono etichettati come tali.
Le schede 2024 usano il catalogo e le tabelle precedenti, senza ereditare
silenziosamente meccaniche verificate esclusivamente per il 2014.

## Backup e compatibilità delle schede

Il vecchio `public/data/` rimane integro. Prima dell’integrazione è stato creato
`database-backups.local/20261012T092014264544Z`: 141 file, impronte verificate,
istruzioni in `RESTORE.md`. È conservato anche il backup originale
`database-backups.local/20261010T155024997638Z` di 112 file.

Prima di modificare le schede o la bozza, l’app conserva le stringhe originali di
localStorage in `dev-and-dice.before-rules2014.0d0d275e18ee23737904`.
Un errore di quota o un backup non valido blocca il salvataggio, senza cancellare
i dati. ID, inventario, note, abilità personali e override vengono conservati.
I vecchi slot consumati del warlock vengono trasferiti nel contatore del Patto;
i valori precedenti restano anche nelle chiavi `rules2014.legacySlotUsed.*`.

Per ripristinare il solo database precedente, impostare in `.env.local`:

```dotenv
VITE_RULES_DATABASE=legacy
```

Riavviare `npm run dev`, oppure ricostruire con `npm run build` per la produzione.
Il loader userà i cataloghi precedenti già conservati. Rimuovere questa variabile
per tornare al database verificato. Account e sessioni non richiedono ripristino.

Per ripristinare anche le schede precedenti, esportare prima lo stato corrente,
attivare il loader legacy e, nella console del browser sull’origine dell’app:

```js
const saved = JSON.parse(localStorage.getItem('dev-and-dice.before-rules2014.0d0d275e18ee23737904'));
if (!saved || saved.schemaVersion !== 1) throw new Error('Backup non disponibile');
for (const [key, value] of [
  ['dev-and-dice.character-sheets.v1', saved.sheets],
  ['dev-and-dice.character-tutorial.v1', saved.tutorial],
]) {
  if (value === null) localStorage.removeItem(key);
  else if (typeof value === 'string') localStorage.setItem(key, value);
  else throw new Error('Backup non valido');
}
location.reload();
```

Per ripristinare file del progetto, seguire `RESTORE.md` del backup dopo averlo
verificato con `python scripts/rules2014/backup.py --verify PERCORSO_BACKUP`.
Il ripristino del database non richiede di sostituire `server/data`.

## Rigenerazione e controlli

```sh
python scripts/rules2014/runtime.py --source rules-database.local/2014/candidate-0d0d275e18ee23737904 --backup database-backups.local/20261012T092014264544Z
python scripts/rules2014/runtime.py --source rules-database.local/2014/candidate-0d0d275e18ee23737904 --backup database-backups.local/20261012T092014264544Z --check
npm run test:rules
npm run build
npm run lint
```

`npm run test:rules` funziona con i file pubblicati nel repository: non richiede
manuali, SQLite o release locali. La rigenerazione richiede invece la release
sorgente e il backup privati. Il manifesto viene scritto per ultimo; una copia
interrotta fallisce il controllo delle impronte e si recupera rieseguendo lo script.

Con Vite su `127.0.0.1:5173`, eseguire anche
`node --experimental-strip-types tests/runtime-database.mjs --browser` per verificare
migrazione, backup, persistenza, riposi, permessi DM e layout mobile in una sessione
Chromium isolata. Il test simula solo l’accesso: non modifica account reali.
