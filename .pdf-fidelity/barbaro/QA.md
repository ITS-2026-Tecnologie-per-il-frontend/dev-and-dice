# Inventario QA — Barbaro

PDF autorizzato: public/schede_personaggio/Barbaro.pdf. Pagina 1: 595.20 × 841.92 pt, 2480 × 3508 pixel. Fonte scansita senza font, testo nativo o tracciati (PyMuPDF, pdffonts, pdf2svg). Palette grigi/nero/bianco. Potrace ricostruisce i contorni, non recupera vettori originali. Font sostitutivi Carlito (SIL OFL, incluso localmente) e Times/Liberation Serif; geometria in punti PDF.

Implementazione sequenziale: pagina 1 completa prima delle pagine 2 e 3. Controlli esterni alla scheda. Contenuti HTML, decorazioni SVG indipendenti, dati JSON versionati separati.

| Requisito/controllo | Verifica funzionale | Verifica visiva/evidenza |
|---|---|---|
| Proporzioni e decorazioni | dimensioni DOM esatte; asset senza image/text | screenshot 2×, overlay e diff per pagina |
| Testo fedele/selezionabile | trascrizione confrontata con riferimento | titoli, paragrafi e medaglioni ingranditi |
| Nome, numeri, multilinea | compilazione da tastiera | stato compilato e senza focus |
| Checkbox salvezze/maestrie/privilegi | ciclo selezionato/non selezionato | simboli in stato vuoto e compilato |
| Dadi vita | modifica totale/usati/tipo | simbolo originale, valore modificato |
| Equipaggiamento e slot | modifica ogni tipo di slot | pagina 3 compilata |
| Zoom esterno | ciclo Adatta → 200% → Adatta; larghezza esatta | toolbar esterna, proporzioni invarianti |
| Salva | modifica → salva → ricarica | stato ripristinato |
| Esporta JSON | download e verifica contenuti | toolbar esterna |
| Carica JSON | file valido, roundtrip | valori ricompaiono negli stessi campi |
| JSON errato | rifiuto senza perdita dei dati aperti | messaggio di errore |
| Stampa/PDF | attivazione controllo e PDF browser | 3 pagine con dimensioni originali; nessuna toolbar |
| Schermo stretto | nessun overflow orizzontale | screenshot 390×844, pagina proporzionalmente scalata |

Esplorazione: descrizioni lunghe e multilinea; numeri ai limiti; import JSON malformato/versione errata e file eccessivo; checkbox reversibili; selettore dadi vita. Verificare overflow prima di stampare.

Limite della skill Playwright Interactive: js_repl non disponibile. Si usa un processo Node Playwright persistente con gli stessi handle browser/context/page per le iterazioni; nessuna nuova dipendenza. Il server richiede l’eccezione al sandbox per la porta loopback.
