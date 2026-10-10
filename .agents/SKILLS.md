# Inventario delle skill

Confronto effettuato il **10 ottobre 2026** sul filesystem Windows e sul catalogo della sessione Codex.

- **27 skill disponibili nel catalogo della sessione**, tutte con `SKILL.md` presente.
- **1 skill locale non elencata nel catalogo corrente**: `review-agent`.
- **26 ulteriori file di skill nella cache dei plugin**: la presenza in cache non dimostra l’attivazione del plugin o la disponibilità nella sessione.
- **Tutte le 18 voci del vecchio documento sono ora presenti in locale**; `pdf-to-react-fidelity` è stata recuperata dallo ZIP fornito dall’utente.

Sono stati verificati **54 file `SKILL.md`** nelle directory skill dell’utente, di sistema, del progetto e nella cache dei plugin. Il conteggio dei file in cache non viene presentato come numero di skill attive. I percorsi precedenti `/home/xlini/...` sono stati sostituiti con percorsi verificati su questa macchina.

## Skill utente disponibili nella sessione

| Skill | Funzione | Istruzioni |
|---|---|---|
| `find-skills` | Cercare skill aggiuntive e relative fonti. | [SKILL.md](C:/Users/utente/.agents/skills/find-skills/SKILL.md) |
| `frontend-design` | Progettare e migliorare l’aspetto delle interfacce. | [SKILL.md](C:/Users/utente/.agents/skills/frontend-design/SKILL.md) |
| `security-best-practices` | Esaminare la sicurezza di codice Python, JavaScript/TypeScript e Go su richiesta esplicita. | [SKILL.md](C:/Users/utente/.agents/skills/security-best-practices/SKILL.md) |
| `vercel-composition-patterns` | Organizzare componenti React e API riutilizzabili. | [SKILL.md](C:/Users/utente/.agents/skills/vercel-composition-patterns/SKILL.md) |
| `vercel-react-best-practices` | Migliorare prestazioni e struttura di applicazioni React e Next.js. | [SKILL.md](C:/Users/utente/.agents/skills/vercel-react-best-practices/SKILL.md) |
| `web-design-guidelines` | Verificare interfacce, accessibilità e usabilità. | [SKILL.md](C:/Users/utente/.agents/skills/web-design-guidelines/SKILL.md) |
| `graphify` | Costruire e interrogare grafi di conoscenza di codice e documenti. | [SKILL.md](C:/Users/utente/.codex/skills/graphify/SKILL.md) |
| `playwright-interactive` | Interagire con browser ed Electron tramite una sessione JavaScript persistente per verifiche funzionali e visive. | [SKILL.md](C:/Users/utente/.codex/skills/playwright-interactive/SKILL.md) |
| `pdf-to-react-fidelity` | Ricostruire PDF in componenti React modificabili con HTML, CSS e SVG e verifica visiva. Installata dallo ZIP fornito e disponibile nel catalogo corrente. | [SKILL.md](C:/Users/utente/.codex/skills/pdf-to-react-fidelity/SKILL.md) |

## Skill di sistema disponibili nella sessione

| Skill | Funzione | Istruzioni |
|---|---|---|
| `imagegen` | Generare e modificare immagini raster. | [SKILL.md](C:/Users/utente/.codex/skills/.system/imagegen/SKILL.md) |
| `openai-docs` | Consultare documentazione e indicazioni sui prodotti OpenAI e Codex. | [SKILL.md](C:/Users/utente/.codex/skills/.system/openai-docs/SKILL.md) |
| `skill-creator` | Creare o aggiornare skill Codex. | [SKILL.md](C:/Users/utente/.codex/skills/.system/skill-creator/SKILL.md) |
| `skill-installer` | Installare skill da cataloghi o repository GitHub. | [SKILL.md](C:/Users/utente/.codex/skills/.system/skill-installer/SKILL.md) |

## Skill del progetto disponibile nella sessione

| Skill | Funzione | Istruzioni |
|---|---|---|
| `dnd-5e-rules` | Verificare le regole D&D nei manuali locali, mantenendo separate le edizioni 2014 e 2024. | [SKILL.md](skills/dnd-5e-rules/SKILL.md) |

## Skill dei plugin disponibili nella sessione

I nomi includono il prefisso del plugin usato dal catalogo corrente.

| Skill | Funzione | Istruzioni |
|---|---|---|
| `browser:control-in-app-browser` | Controllare il browser integrato e verificare pagine web o applicazioni locali. | [SKILL.md](C:/Users/utente/.codex/plugins/cache/openai-bundled/browser/26.721.41059/skills/control-in-app-browser/SKILL.md) |
| `documents:documents` | Creare, modificare e verificare documenti Word/DOCX. | [SKILL.md](C:/Users/utente/.codex/plugins/cache/openai-primary-runtime/documents/26.723.12215/skills/documents/SKILL.md) |
| `pdf:pdf` | Leggere, creare e verificare PDF, compresa la resa visiva. | [SKILL.md](C:/Users/utente/.codex/plugins/cache/openai-primary-runtime/pdf/26.723.12215/skills/pdf/SKILL.md) |
| `plugin-management:plugin-management` | Gestire plugin, connessioni, permessi e dipendenze. | [SKILL.md](C:/Users/utente/.codex/plugins/cache/openai-curated-remote/plugin-management/0.1.0/skills/plugin-management/SKILL.md) |
| `presentations:Presentations` | Creare, modificare e verificare presentazioni PowerPoint. | [SKILL.md](C:/Users/utente/.codex/plugins/cache/openai-primary-runtime/presentations/26.723.12215/skills/presentations/SKILL.md) |
| `sites:sites` | Creare, modificare e pubblicare siti con Sites. | [SKILL.md](C:/Users/utente/.codex/plugins/cache/openai-curated-remote/sites/1.0.1/skills/sites/SKILL.md) |
| `spreadsheets:spreadsheets` | Creare e analizzare fogli di calcolo e file XLSX/CSV. | [SKILL.md](C:/Users/utente/.codex/plugins/cache/openai-primary-runtime/spreadsheets/26.723.12215/skills/spreadsheets/SKILL.md) |
| `spreadsheets:excel-live-control` | Controllare una cartella Excel aperta tramite la sessione connessa. | [SKILL.md](C:/Users/utente/.codex/plugins/cache/openai-primary-runtime/spreadsheets/26.723.12215/skills/excel-live-control/SKILL.md) |
| `template-creator:template-creator` | Creare o aggiornare skill per modelli personali riutilizzabili. | [SKILL.md](C:/Users/utente/.codex/plugins/cache/openai-primary-runtime/template-creator/26.723.12215/skills/template-creator/SKILL.md) |
| `visualize:visualize` | Creare visualizzazioni e strumenti interattivi nella conversazione. | [SKILL.md](C:/Users/utente/.codex/plugins/cache/openai-bundled/visualize/1.0.15/skills/visualize/SKILL.md) |
| `work-pets:create-pet` | Creare e validare pet animati per ChatGPT Work. | [SKILL.md](C:/Users/utente/.codex/plugins/cache/openai-curated-remote/work-pets/0.1.6/skills/create-pet/SKILL.md) |
| `work-pets:pets` | Elencare, selezionare, scaricare o eliminare pet di ChatGPT Work. | [SKILL.md](C:/Users/utente/.codex/plugins/cache/openai-curated-remote/work-pets/0.1.6/skills/pets/SKILL.md) |
| `work-pets:update-pet` | Modificare, riparare e verificare pet di ChatGPT Work. | [SKILL.md](C:/Users/utente/.codex/plugins/cache/openai-curated-remote/work-pets/0.1.6/skills/update-pet/SKILL.md) |

## Skill locali non elencate nel catalogo corrente

| Skill | Stato | Istruzioni |
|---|---|---|
| `review-agent` | Già presente nel filesystem; non elencata nel catalogo della sessione. Non è stata reinstallata. | [SKILL.md](C:/Users/utente/.codex/skills/.system/review-agent/SKILL.md) |

Fonte di `playwright-interactive`: [OpenAI, skills/.curated/playwright-interactive](https://github.com/openai/skills/tree/main/skills/.curated/playwright-interactive).

Comando eseguito per l’installazione:

```powershell
python C:/Users/utente/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py --repo openai/skills --path skills/.curated/playwright-interactive --dest C:/Users/utente/.codex/skills
```

`playwright-interactive` richiede `js_repl`, non disponibile nell’elenco degli strumenti di questa sessione. Le impostazioni Codex e di sandbox non sono state modificate durante questa operazione. L’installazione dei file non certifica il funzionamento del relativo workflow browser.

## Installazione di pdf-to-react-fidelity

La skill è stata recuperata dallo ZIP locale fornito dall’utente, senza modificarne i cinque file originali.

- Archivio: `.agents/skills/dnd-5e-rules/pdf-to-react/pdf-to-react-fidelity.zip`.
- SHA-256 dell’archivio: `a2088fe88bdcced8546322d7b015c01c94318d6aaa0447192036c54a0ad5c610`.
- Destinazione: `C:/Users/utente/.codex/skills/pdf-to-react-fidelity`.
- Ambiente Python dedicato: `C:/Users/utente/.codex/skill-envs/pdf-to-react-fidelity`.
- Dipendenze installate secondo `requirements.txt`: **PyMuPDF 1.28.2** e **Pillow 12.3.0**.

Il vecchio riferimento Linux è stato risolto grazie all’archivio: non rimangono skill mancanti fra i nomi del documento originale.

### Strumenti indicati dall’utente

| Nome | Tipo | Stato verificato |
|---|---|---|
| `playwright-interactive` | Skill Codex | Già installata e presente nel catalogo corrente. Richiede `js_repl` per il suo workflow; l’installazione non equivale alla disponibilità di questo strumento nella sessione. |
| `pdf2svg` | Programma di conversione | Comando non trovato nel PATH. Non richiesto dal `requirements.txt` o dagli script dello ZIP installato. |
| `pdf-extract-svg` | Applicazione esterna | Il [repository fornito](https://github.com/mbrukman/pdf-extract-svg) contiene un’app per selezionare regioni PDF ed esportarle come SVG. La documentazione richiede strumenti Poppler; non è una skill Codex. Il comando `pdf-extract-svg` e i comandi Poppler controllati non sono stati trovati nel PATH. Non installata in questa operazione. |

La skill installata usa **PyMuPDF per l’estrazione SVG** e **Pillow per i confronti delle immagini**. Non richiede l’installazione dei due programmi alternativi sopra elencati. Nel progetto non risultano installati i pacchetti Node `playwright` o `@playwright/test`; il workflow della skill consente anche un’integrazione browser esistente. Le dipendenze del progetto e le impostazioni Codex non sono state modificate.

### Comandi nell’ambiente installato

Eseguire dalla radice del progetto, sostituendo il PDF con il documento autorizzato da elaborare:

```powershell
& C:/Users/utente/.codex/skill-envs/pdf-to-react-fidelity/Scripts/python.exe C:/Users/utente/.codex/skills/pdf-to-react-fidelity/scripts/inspect_pdf.py ./documento.pdf --out pdf-fidelity.local/baseline --dpi 160 --max-pages 1
& C:/Users/utente/.codex/skill-envs/pdf-to-react-fidelity/Scripts/python.exe C:/Users/utente/.codex/skills/pdf-to-react-fidelity/scripts/compare_images.py ./riferimento.png ./screenshot.png --out pdf-fidelity.local/diff.png
```

Verifica dell’installazione eseguita con un PDF sintetico di due pagine: anteprima PNG, SVG, testo, immagine incorporata, geometria vettoriale, limite di una pagina, immagine delle differenze e overlay. Gli artefatti sono in `pdf-fidelity.local/skill-install-check`, directory ignorata da Git. È una verifica degli strumenti di estrazione e confronto; non una ricostruzione React o una prova del workflow browser.

## Ulteriori skill nella cache dei plugin

Queste **26 voci non sono nel catalogo della sessione**. Vengono registrate come file presenti in cache, senza dedurre che i plugin siano abilitati. Il nome nella prima colonna è quello del file `SKILL.md`, senza inventare un identificatore di invocazione.

| Nome nel file | Provenienza della cache | Istruzioni |
|---|---|---|
| `sites-building` | sites 0.1.31 | [SKILL.md](C:/Users/utente/.codex/plugins/cache/openai-bundled/sites/0.1.31/skills/sites-building/SKILL.md) |
| `sites-hosting` | sites 0.1.31 | [SKILL.md](C:/Users/utente/.codex/plugins/cache/openai-bundled/sites/0.1.31/skills/sites-hosting/SKILL.md) |
| `gh-address-comments` | github bd2122cb | [SKILL.md](C:/Users/utente/.codex/plugins/cache/openai-curated/github/bd2122cb/skills/gh-address-comments/SKILL.md) |
| `gh-fix-ci` | github bd2122cb | [SKILL.md](C:/Users/utente/.codex/plugins/cache/openai-curated/github/bd2122cb/skills/gh-fix-ci/SKILL.md) |
| `github` | github bd2122cb | [SKILL.md](C:/Users/utente/.codex/plugins/cache/openai-curated/github/bd2122cb/skills/github/SKILL.md) |
| `yeet` | github bd2122cb | [SKILL.md](C:/Users/utente/.codex/plugins/cache/openai-curated/github/bd2122cb/skills/yeet/SKILL.md) |
| `artifact-template-analytics-dashboard` | openai-templates 0.1.1 | [SKILL.md](C:/Users/utente/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-analytics-dashboard/SKILL.md) |
| `artifact-template-business-review` | openai-templates 0.1.1 | [SKILL.md](C:/Users/utente/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-business-review/SKILL.md) |
| `artifact-template-design-report` | openai-templates 0.1.1 | [SKILL.md](C:/Users/utente/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-design-report/SKILL.md) |
| `artifact-template-experiment-analysis` | openai-templates 0.1.1 | [SKILL.md](C:/Users/utente/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-experiment-analysis/SKILL.md) |
| `artifact-template-financial-budget` | openai-templates 0.1.1 | [SKILL.md](C:/Users/utente/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-financial-budget/SKILL.md) |
| `artifact-template-investment-committee-memo` | openai-templates 0.1.1 | [SKILL.md](C:/Users/utente/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-investment-committee-memo/SKILL.md) |
| `artifact-template-legal-memorandum` | openai-templates 0.1.1 | [SKILL.md](C:/Users/utente/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-legal-memorandum/SKILL.md) |
| `artifact-template-market-trends-report` | openai-templates 0.1.1 | [SKILL.md](C:/Users/utente/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-market-trends-report/SKILL.md) |
| `artifact-template-minimal-letterhead` | openai-templates 0.1.1 | [SKILL.md](C:/Users/utente/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-minimal-letterhead/SKILL.md) |
| `artifact-template-operating-calendar` | openai-templates 0.1.1 | [SKILL.md](C:/Users/utente/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-operating-calendar/SKILL.md) |
| `artifact-template-operating-review` | openai-templates 0.1.1 | [SKILL.md](C:/Users/utente/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-operating-review/SKILL.md) |
| `artifact-template-project-kickoff` | openai-templates 0.1.1 | [SKILL.md](C:/Users/utente/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-project-kickoff/SKILL.md) |
| `artifact-template-project-tracker` | openai-templates 0.1.1 | [SKILL.md](C:/Users/utente/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-project-tracker/SKILL.md) |
| `artifact-template-sales-pipeline` | openai-templates 0.1.1 | [SKILL.md](C:/Users/utente/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-sales-pipeline/SKILL.md) |
| `artifact-template-simple-dark-mode` | openai-templates 0.1.1 | [SKILL.md](C:/Users/utente/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-simple-dark-mode/SKILL.md) |
| `artifact-template-simple-light-mode` | openai-templates 0.1.1 | [SKILL.md](C:/Users/utente/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-simple-light-mode/SKILL.md) |
| `artifact-template-strategy-memorandum` | openai-templates 0.1.1 | [SKILL.md](C:/Users/utente/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-strategy-memorandum/SKILL.md) |
| `artifact-template-system-design` | openai-templates 0.1.1 | [SKILL.md](C:/Users/utente/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-system-design/SKILL.md) |
| `artifact-template-team-alignment` | openai-templates 0.1.1 | [SKILL.md](C:/Users/utente/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-team-alignment/SKILL.md) |
| `artifact-template-three-statement-forecast` | openai-templates 0.1.1 | [SKILL.md](C:/Users/utente/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-three-statement-forecast/SKILL.md) |

## Esito del confronto

Il documento precedente elencava **18 nomi**. Tutte le voci sono state mantenute e i percorsi sono stati aggiornati; la skill inizialmente non reperita è stata installata dallo ZIP successivamente fornito.

Sono state aggiunte **10 skill del catalogo** assenti dal vecchio documento:

- `security-best-practices`
- `graphify`
- `browser:control-in-app-browser`
- `documents:documents`
- `pdf:pdf`
- `presentations:Presentations`
- `spreadsheets:spreadsheets`
- `spreadsheets:excel-live-control`
- `template-creator:template-creator`
- `visualize:visualize`

È stata inoltre aggiunta la sezione delle 26 voci in cache non esposte nella sessione. Le nuove installazioni effettuate nel corso del confronto sono `playwright-interactive` dal repository ufficiale OpenAI e `pdf-to-react-fidelity` dallo ZIP dell’utente. `graphify` era già presente quando è iniziato il confronto.

I percorsi assoluti descrivono questa macchina Windows e le versioni dei plugin rilevate. In un altro ambiente occorre verificarli nuovamente; le directory skill personali e la cache dei plugin non vengono copiate nel repository da questo inventario.
