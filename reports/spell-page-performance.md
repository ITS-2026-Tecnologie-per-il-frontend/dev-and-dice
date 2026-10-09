# Rendering della pagina incantesimi

Il blocco è stato riprodotto con i cataloghi locali caricati in memoria, senza
rete: una scheda Mago di livello 17 con 44 incantesimi salvati impiegava circa
3,6–4,1 secondi per il rendering React della terza pagina. La seconda pagina
richiedeva circa 30–70 ms. Il profilo CPU individuava come costo dominante
`spellLabel` e le scansioni anonime delle voci del catalogo.

Ogni opzione di ciascun menu cercava duplicati scorrendo tutti i dati della
scheda. Per ogni nome trovato, cercava ancora la traduzione nell'intero catalogo.
La ricerca veniva ripetuta anche per righe vuote. Il costo cresceva sia con il
numero di incantesimi inseriti sia con le opzioni sbloccate dal livello.

Ora la traduzione usa un indice degli alias, costruito una volta per catalogo,
e i duplicati usano un indice per nome e fonte, ricostruito quando cambia la
scheda. Regole e limiti sono memorizzati tra rendering con gli stessi dati.
Le opzioni con identiche proprietà condividono gli elementi React durante il
rendering, riducendo anche la creazione ripetuta degli stessi elementi.

## Confronto prima/dopo

Mediana di tre rendering della stessa scheda e degli stessi cataloghi,
senza profiler durante il confronto:

| Livello | Modello | Prima | Dopo |
| --- | --- | ---: | ---: |
| 1 | Generico | 269 ms | 63 ms |
| 1 | Mago | 273 ms | 56 ms |
| 1 | Mago stile PDF | 252 ms | 59 ms |
| 17 | Generico | 4.045 ms | 203 ms |
| 17 | Mago | 3.908 ms | 210 ms |
| 17 | Mago stile PDF | 4.121 ms | 210 ms |

I numeri misurano il rendering React sullo stesso computer in modalità sviluppo:
non includono DOM, layout o rete del browser. Il browser integrato non era
disponibile. I risultati variano con macchina e modalità di esecuzione.

L'HTML prima/dopo è risultato identico per i tre modelli ai livelli 1 e 17,
inclusi valori, spunte, slot, menu, opzioni disabilitate e testi. Il confronto
includeva anche nomi inglesi, duplicati, fonti indipendenti, magie personali e
schede con regole 2014 e 2024. Il numero di righe e opzioni non è stato ridotto.
I test verificano modifica e cancellazione delle selezioni, preparazione,
slot spesi, persistenza e disponibilità nel combattimento.

I risultati completi sono in `spell-page-comparison.json`; i profili campionati
sono in `spell-page-before.json` e `spell-page-after.json`.

Per rieseguire il benchmark della versione attuale:

```sh
node scripts/benchmark-spell-page.mjs reports/spell-page-current.json
node tests/spell-page.mjs
```

Il benchmark include Mago ai livelli 1/17 e Chierico al livello 17, il conteggio
di righe/opzioni, il rendering dopo modifiche a preparazione e slot e un profilo
CPU campionato. I suoi tempi, con profiler, sono distinti dal confronto sopra.
