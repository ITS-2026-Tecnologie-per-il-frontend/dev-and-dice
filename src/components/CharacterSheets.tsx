import { durationTurns } from '../utils/Combat'
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react'
import { characterFields, clampCurrentHitPointsToMaximum, characterLevel, numericCharacterFields, newCharacterSheet, parseCharacterSheets, initiativeBonus, type SheetStats, type CharacterSheet, type SheetAbility } from '../utils/CharacterSheets'
import { sheetFromCatalog, sheetWithCombatSpells, templateFromCatalog, type Catalog } from '../utils/Catalog'
import { CatalogSearch } from './CatalogSearch'
import { InfoButton } from './InfoButton'
import { useDialogDismiss } from '../utils/Dialog'
import { PlayerSheet } from './PlayerSheet'
import { pdfAbilities } from '../utils/PlayerAbilities'
import { applyCreation, patchCalculatedSheetStats, characterCalculationIssues, spellSelection, labelOf, type CreationData } from '../utils/PlayerCreation'
import { newTutorial, parseTutorialDraft, tutorialDraftKey, tutorialIssues } from '../utils/CharacterTutorial'
import { classId } from '../utils/Spellcasting'
import { randomCharacter } from '../utils/RandomCharacter'

const storageKey = 'dev-and-dice.character-sheets.v1'

export type CharacterSheetsHandle = { open: (sheet: CharacterSheet) => void; patchStats: (id: string, stats: Partial<SheetStats>) => boolean }
type Props = { onAdd: (sheet: CharacterSheet) => void; onSaved: (sheet: CharacterSheet) => void; combatStarted: boolean; presentSheetIds: string[]; catalog: Catalog; creationData?: CreationData; ref?: Ref<CharacterSheetsHandle> }

export function CharacterSheets({ onAdd, onSaved, combatStarted, presentSheetIds, catalog, creationData, ref }: Props) {
    const [confirmTutorialExit, setConfirmTutorialExit] = useState(false)
    const tutorialExitDialog = useRef<HTMLDialogElement>(null)
    const dismissDialog = useDialogDismiss(() => {
        if (draft?.playerDetails?.['tutorial.active'] === 'true') setConfirmTutorialExit(true)
        else if (draft && JSON.stringify(draft) !== initialDraft.current) saveSheet()
        else closeDialog()
    })
    const dismissDeleteDialog = useDialogDismiss()
    const dismissTutorialExitDialog = useDialogDismiss(closeTutorialExitPrompt)
    const deleteDialog = useRef<HTMLDialogElement>(null)
    const [saved, setSaved] = useState(() => {
        try {
            return { sheets: parseCharacterSheets(localStorage.getItem(storageKey)), error: '', blocked: false }
        } catch (error) {
            return { sheets: [] as CharacterSheet[], error: `Impossibile leggere le schede: ${error instanceof Error ? error.message : String(error)}`, blocked: true }
        }
    })
    const [rawDraft, setDraft] = useState<CharacterSheet | null>(null)
    const draft = useMemo(() => rawDraft && creationData ? applyCreation(rawDraft, creationData) : rawDraft, [rawDraft, creationData])
    const [error, setError] = useState('')
    const [tutorial, setTutorial] = useState(() => {
        try {
            const draft = parseTutorialDraft(localStorage.getItem(tutorialDraftKey))
            return { draft: saved.sheets.some((s) => s.id === draft?.id && s.playerDetails?.['tutorial.completed'] === 'true') ? null : draft, error: '' }
        }
        catch { return { draft: null as CharacterSheet | null, error: 'Impossibile leggere la bozza del tutorial. I dati originali sono conservati; non avviare una nuova creazione prima di recuperarli.' } }
    })
    const guided = draft?.playerDetails?.['tutorial.active'] === 'true'
    const [progressSnapshot, setProgressSnapshot] = useState<CharacterSheet | null>(null)
    const progressSaved = progressSnapshot === draft
    const dialog = useRef<HTMLDialogElement>(null)
    const initialDraft = useRef('')
    const randomDialog=useRef<HTMLDialogElement>(null),dismissRandomDialog=useDialogDismiss()
    const [randomOrigins,setRandomOrigins]=useState({characterClass:'',race:'',level:1})
    const [randomError,setRandomError]=useState('')

    function openDraft(sheet: CharacterSheet) {
        const updated = creationData ? applyCreation(sheet, creationData) : sheet
        initialDraft.current = JSON.stringify(updated)
        setDraft({ ...updated })
    }

    function generateRandom(skipReview = false) {
        if (!creationData || saved.blocked || tutorial.draft || tutorial.error) return
        try {
            const generated=randomCharacter(creationData,{...randomOrigins,skipReview})
            if (skipReview) {
                if (!writeSheets([...saved.sheets,generated])) {
                    setRandomError('Impossibile salvare il personaggio. Libera spazio nel browser e riprova.')
                    return
                }
                randomDialog.current?.close()
                setRandomError('')
                onSaved(generated)
                return
            }
            if (!saveProgress(generated)) {setRandomError('Impossibile salvare la bozza. Libera spazio nel browser e riprova.');return}
            randomDialog.current?.close()
            setRandomError('')
            openDraft(generated)
        } catch (error) {setRandomError(error instanceof Error ? error.message : 'Generazione non riuscita. Nessun personaggio è stato sovrascritto.')}
    }


    useImperativeHandle(ref, () => ({
        open: (sheet) => openDraft(saved.sheets.find((item) => item.id === sheet.id) ?? sheet),
        patchStats: (id, stats) => {
            const sheet = saved.sheets.find((item) => item.id === id)
            if (!sheet) return true
            const updated = patchCalculatedSheetStats(sheet, stats, creationData)
            if (!updated || !writeSheets(saved.sheets.map((item) => item.id === id ? updated : item))) return false
            setDraft((current) => {
                return current?.id === id ? patchCalculatedSheetStats(current, stats, creationData) ?? current : current
            })
            return true
        },
    }))

    useEffect(() => {
        if (draft && !dialog.current?.open) dialog.current?.showModal()
    }, [draft])

    useEffect(() => {
        if (confirmTutorialExit && guided && !tutorialExitDialog.current?.open) tutorialExitDialog.current?.showModal()
        else if ((!confirmTutorialExit || !guided) && tutorialExitDialog.current?.open) tutorialExitDialog.current.close()
    }, [confirmTutorialExit, guided])

    function saveProgress(sheet: CharacterSheet) {
        try {
            localStorage.setItem(tutorialDraftKey, JSON.stringify(sheet))
            setTutorial({ draft: sheet, error: '' }); setProgressSnapshot(sheet); setError('')
            return true
        } catch { setError('Impossibile salvare i progressi. La bozza resta aperta: libera spazio e riprova.'); setProgressSnapshot(null); return false }
    }
    useEffect(() => {
        if (!guided || !draft) return
        const timer = setTimeout(() => saveProgress(draft), 350)
        return () => clearTimeout(timer)
    }, [guided, draft])

    const writeSheets = useCallback((sheets: CharacterSheet[]): boolean => {
        if (saved.blocked) { setError(saved.error); return false }
        try {
            localStorage.setItem(storageKey, JSON.stringify(sheets))
            setSaved({ sheets, error: '', blocked: false })
            setError('')
            return true
        } catch {
            const message = 'Salvataggio non riuscito. Le modifiche sono ancora aperte: riprova senza chiudere la finestra.'
            setError(message)
            setSaved((current) => ({ ...current, error: message }))
            return false
        }
    }, [saved.blocked, saved.error])

    useEffect(() => {
        if (!creationData) return
        const sheets = saved.sheets.map((sheet) => applyCreation(sheet, creationData))
        if (JSON.stringify(sheets) !== JSON.stringify(saved.sheets) && writeSheets(sheets)) {
            for (const sheet of sheets) onSaved(sheet)
        }
    }, [creationData, saved.sheets, writeSheets, onSaved])

    function closeDialog() {
        if (guided && draft && !saveProgress(draft)) return
        dialog.current?.close()
        setDraft(null)
        setError('')
    }

    function closeTutorialExitPrompt() {
        tutorialExitDialog.current?.close()
        setConfirmTutorialExit(false)
    }

    function discardCreation() {
        if (!draft || !guided) return
        closeTutorialExitPrompt()
        const sheets = saved.sheets.filter((sheet) => sheet.id !== draft.id)
        if (sheets.length !== saved.sheets.length && !writeSheets(sheets)) return
        const isStoredDraft = tutorial.draft?.id === draft.id
        try {
            if (isStoredDraft) localStorage.removeItem(tutorialDraftKey)
        } catch {
            setError('Impossibile cancellare la bozza. La scheda resta aperta: riprova.')
            return
        }
        if (isStoredDraft) setTutorial({ draft: null, error: '' })
        setProgressSnapshot(null)
        setRandomOrigins({ characterClass: '', race: '', level: 1 })
        setRandomError('')
        dialog.current?.close()
        setDraft(null)
        setError('')
    }

    function saveSheet() {
        if (!draft) return
        if (draft.kind === 'PG' && classId(draft) === 'wizard' && !creationData && Object.entries(draft.playerDetails ?? {}).some(([key,value]) => /^spell\.\d+\.\d+\.name$/.test(key) && value.trim())) {
            setError('Attendi il caricamento delle regole prima di salvare: serve per verificare i limiti degli incantesimi. Le modifiche restano aperte.'); return
        }
        if (guided) {
            if (!creationData) { setError('Attendi il caricamento delle opzioni prima di completare il tutorial.'); return }
            const required = tutorialIssues(draft, creationData, 8)
            if (required.length) { setError(required.join(' ')); return }
        }
        const calculated = clampCurrentHitPointsToMaximum(creationData ? applyCreation(draft, creationData) : draft)
        const sheet = { ...calculated, ...(guided ? { playerDetails: { ...calculated.playerDetails, 'tutorial.active': 'false', 'tutorial.completed': 'true' } } : {}), name: calculated.name.trim(), abilities: calculated.abilities.map((ability) => ({ ...ability, name: ability.name.trim() })) }
        const issues = sheet.kind === 'PG' ? characterCalculationIssues(sheet) : []
        if (sheet.kind === 'PG' && creationData && characterLevel(sheet) !== undefined && creationData.classes.some((x) => x.index === classId(sheet))) issues.push(...spellSelection(sheet,creationData).issues)
        if (issues.length) { setError(issues.join(' ')); return }
        if (!numericCharacterFields.every((field) => sheet[field] === '' || (sheet[field].trim() !== '' && Number.isSafeInteger(Number(sheet[field]))))) {
            setError('Inserisci numeri interi validi nelle statistiche.')
            return
        }
        if (!sheet.name || sheet.abilities.some((ability) => !ability.name || !Object.hasOwn(durationTurns, ability.duration) || (ability.remainingTurns !== undefined && (!Number.isSafeInteger(ability.remainingTurns) || ability.remainingTurns < 0)))) {
            setError('Inserisci il nome del personaggio e di ogni abilità, con una durata valida.')
            return
        }
        const sheets = saved.sheets.some((item) => item.id === sheet.id)
            ? saved.sheets.map((item) => item.id === sheet.id ? sheet : item)
            : [...saved.sheets, sheet]
        if (writeSheets(sheets)) {
            if (guided) {
                try { localStorage.removeItem(tutorialDraftKey) } catch { /* La scheda completa è già salvata; la bozza residua viene ignorata alla riapertura. */ }
                setTutorial({ draft: null, error: '' })
                dialog.current?.close(); setDraft(null); setError('')
            } else closeDialog()
            onSaved(sheet)
        }
    }

    function abilityRow(ability: SheetAbility, index: number, spell = false) {
        if (!draft) return null
        return (<div className="sheet-ability-row" key={index}>
                                    <label>
                                        <span>{spell ? 'Nome magia' : 'Nome abilità'}</span>
                                        <CatalogSearch
                                            required
                                            pattern={'.*\\S.*'}
                                            value={catalog.abilities.find((entry) => entry.id === ability.catalogId)?.name ?? ability.name}
                                            aria-label={`Nome ${spell ? 'magia' : 'abilità'} ${index + 1} della scheda`}
                                            entries={catalog.abilities}
                                            onChange={(name) => setDraft({ ...draft, abilities: draft.abilities.map((item, i) => i === index ? { ...item, name, catalogId: undefined } : item) })}
                                            onSelect={(entry) => setDraft({ ...draft, abilities: draft.abilities.map((item, i) => i === index ? templateFromCatalog(entry) : item) })}
                                        />
                                    </label>
                                    <label>
                                        <span>Durata</span>
                                        <select
                                            value={ability.duration}
                                            onChange={(event) => setDraft({ ...draft, abilities: draft.abilities.map((item, i) => i === index ? { ...item, duration: event.target.value as keyof typeof durationTurns, remainingTurns: undefined, timed: event.target.value !== 'Senza conteggio' } : item) })}
                                        >
                                            {Object.keys(durationTurns).map((duration) => <option key={duration}>{duration}</option>)}
                                        </select>
                                    </label>
                                    {ability.duration === 'Personalizzata' && <label className="sheet-ability-turns"><span>Turni (0: senza conteggio)</span><input type="number" min="0" step="1" value={ability.remainingTurns ?? 0} onChange={(event) => {
                                        const remainingTurns = event.target.valueAsNumber
                                        if (Number.isSafeInteger(remainingTurns) && remainingTurns >= 0) setDraft({ ...draft, abilities: draft.abilities.map((item, i) => i === index ? { ...item, remainingTurns } : item) })
                                    }} /></label>}
                                    <InfoButton name={catalog.abilities.find((entry) => entry.id === ability.catalogId)?.name ?? ability.name} description={ability.description} entry={catalog.abilities.find((entry) => entry.id === ability.catalogId)} fields={{ duration: ability.duration, remainingTurns: ability.remainingTurns ?? durationTurns[ability.duration] }} />
                                    <button className="delete-turn" type="button" aria-label={`Elimina ${ability.name || `abilità ${index + 1}`} dalla scheda`} onClick={() => setDraft({ ...draft, abilities: draft.abilities.filter((_, i) => i !== index) })}>×</button>
                                </div>)
    }

    const rows = draft?.abilities.map((ability, index) => ({ ability, index, spell: typeof catalog.abilities.find((entry) => entry.id === ability.catalogId)?.data.level === 'number' })) ?? []
    const selectedSpells = draft?.kind === 'PG' ? sheetWithCombatSpells({ ...draft, abilities: [] }, catalog).abilities.filter((spell) => !rows.some((row) => row.spell && (row.ability.name === spell.name || (spell.catalogId && row.ability.catalogId === spell.catalogId)))) : []
    const detected = draft ? pdfAbilities(draft) : []
    const activePdf = detected.filter((item) => item.activation === 'active' && !rows.some((row) => row.ability.name.trim().toLowerCase() === item.name.trim().toLowerCase()))
    const reviewPdf = detected.filter((item) => item.activation === 'review' || draft?.playerDetails?.[item.key] === 'exclude')

    function pdfSetting(key: string, value: string) {
        if (draft) setDraft({ ...draft, playerDetails: { ...draft.playerDetails, [key]: value } })
    }

    return (
        <aside className="character-library" aria-labelledby="characters-heading">
            <h2 id="characters-heading">Schede</h2>
            <p className="library-help">Personaggi e mostri salvati in questo browser.</p>
            {saved.error && <p role="alert">{saved.error}</p>}
            <button className="sort-turns" type="button" disabled={saved.blocked} onClick={() => openDraft(newCharacterSheet())}>+ Nuova scheda</button>
            <button className="sort-turns" type="button" disabled={saved.blocked || !creationData || !!tutorial.draft || !!tutorial.error} onClick={() => openDraft(newTutorial())}>+ Crea personaggio guidato</button>
            <button className="sort-turns" type="button" disabled={saved.blocked || !creationData || !!tutorial.draft || !!tutorial.error} onClick={() => {setRandomError('');randomDialog.current?.showModal()}}>+ Crea personaggio casuale</button>
            {tutorial.error && <p role="alert">{tutorial.error}</p>}
            {tutorial.draft && !saved.sheets.some((s) => s.id === tutorial.draft!.id && s.playerDetails?.['tutorial.completed'] === 'true') && <button className="character-open tutorial-resume" type="button" disabled={!creationData} onClick={() => openDraft(tutorial.draft!)}>Riprendi creazione · {tutorial.draft.name || 'Personaggio senza nome'}</button>}
            {saved.sheets.length === 0 && <p className="library-empty">Crea una scheda e aggiungila al combattimento quando serve.</p>}
            <div className="character-list">
                {saved.sheets.map((sheet) => (
                    <article className="character-card" key={sheet.id}>
                        <button className="character-open" type="button" onClick={() => openDraft(sheet)} aria-label={`Apri scheda di ${sheet.name}`}>
                            <strong>{sheet.name}</strong>
                            <span>{sheet.kind}{sheet.characterClass ? ` · ${sheet.characterClass}` : ''}</span>
                            <span>PF {sheet.hitPoints || '—'} · CA {sheet.armorClass || '—'}</span>
                        </button>
                        <button className="character-add" type="button" disabled={combatStarted || presentSheetIds.includes(sheet.id)} onClick={() => onAdd(sheet)}>
                            {presentSheetIds.includes(sheet.id) ? 'Già in combattimento' : '+ In combattimento'}
                        </button>
                    </article>
                ))}
            </div>
            {combatStarted && <p className="library-help">Termina il combattimento per aggiungere partecipanti.</p>}
            <dialog ref={dialog} className={`character-dialog${draft?.kind === 'PG' ? ' player-sheet-dialog' : ''}${guided ? ' tutorial-dialog' : ''}`} aria-labelledby="character-dialog-heading" {...dismissDialog} onClose={(event) => {
                if (event.target !== event.currentTarget) return
                deleteDialog.current?.close()
                setDraft(null)
                setError('')
            }}>
                {draft && (
                    <form onSubmit={(event) => { event.preventDefault(); saveSheet() }}>
                        <div className={`dialog-header${draft.kind === 'PG' && !guided ? ' player-dialog-header' : ''}`}>
                            <div className="player-dialog-title">
                            <h2 id="character-dialog-heading">{guided ? 'Creazione del personaggio' : draft.name || 'Nuova scheda'}</h2>
                            {draft.kind === 'PG' && !guided && <p>{draft.characterClass || 'Personaggio'}{draft.level && ` di livello ${draft.level}`}</p>}
                            </div>
                            <button className="delete-turn" type="button" aria-label="Chiudi scheda" onClick={() => guided ? setConfirmTutorialExit(true) : closeDialog()}>×</button>
                        </div>
                        {draft.kind === 'PG' ? <PlayerSheet sheet={draft} catalog={catalog} creationData={creationData} onChange={setDraft}>{guided && <><div className="tutorial-utility-buttons"><button type="button" onClick={closeDialog}>Salva e riprendi più tardi</button><button className="tutorial-discard" type="button" onClick={discardCreation} aria-label="Cancella la bozza del personaggio">Cancella</button></div><p className="tutorial-save-status" role="status">{progressSaved ? 'Progressi salvati in questo browser.' : 'Salvataggio dei progressi…'}</p>{error && <p className="tutorial-save-error" role="alert">{error}</p>}</>}</PlayerSheet> : <div className="character-fields">
                            {(Object.entries(characterFields) as [keyof typeof characterFields, string][]).map(([field, label]) => (
                                <label key={field} className={field === 'notes' ? 'character-notes' : undefined}>
                                    <span>{field === 'initiative' && draft.kind !== 'PG' ? 'Iniziativa inserita' : label}</span>
                                    {field === 'kind' ? (
                                        <select value={draft[field]} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}>
                                            <option>PG</option><option>Mostro</option><option>PNG</option>
                                        </select>
                                    ) : field === 'notes' ? (
                                        <textarea rows={5} value={draft[field]} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} />
                                    ) : field === 'name' ? (
                                        <CatalogSearch autoFocus required pattern={'.*\\S.*'} aria-label="Nome della scheda" value={draft.name}
                                            entries={catalog.creatures} onChange={(name) => setDraft({ ...draft, name, catalogId: undefined })}
                                            onSelect={(entry) => setDraft(sheetFromCatalog(entry, catalog, draft))} />
                                    ) : (
                                        <input
                                            type={(numericCharacterFields as readonly string[]).includes(field) ? 'number' : 'text'}
                                            step={(numericCharacterFields as readonly string[]).includes(field) ? '1' : undefined}
                                            value={draft[field]}
                                            placeholder={field === 'initiative' ? initiativeBonus(draft) : undefined}
                                            onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}
                                        />
                                    )}
                                </label>
                            ))}
                        </div>}
                        {!guided && <>
                        <details className="sheet-combat-help"><summary>Come usare abilità e magie in combattimento</summary>
                            <p>Nel combattimento, clicca un nome nella card del personaggio per importarlo; clicca di nuovo per raggiungerlo.</p>
                            {draft.kind === 'PG' && <p>I privilegi con un’attivazione riconoscibile compaiono qui. Per modificarli nella scheda sopra, scrivi nome e descrizione su righe separate e lascia una riga vuota tra privilegi.</p>}
                        </details>
                        <div className={draft.kind === 'PG' ? 'sheet-ability-columns' : undefined}>
                        <section className="sheet-abilities" aria-labelledby="sheet-abilities-heading">
                            <header className="sheet-section-heading"><h3 id="sheet-abilities-heading">Abilità del personaggio</h3><span className="sheet-section-count" aria-label="Numero di abilità">{activePdf.length + rows.filter((row) => draft.kind !== 'PG' || !row.spell).length}</span></header>
                            <p className="library-help sheet-section-intro">Privilegi e abilità da attivare, con la loro durata.</p>
                            {!activePdf.length && !rows.some((row) => draft.kind !== 'PG' || !row.spell) && <p className="library-empty">Nessuna abilità da attivare. Aggiungine una o compila i privilegi nella scheda sopra.</p>}
                            {activePdf.map((item) => <article className="pdf-ability-card" key={item.key}>
                                <strong>{item.name}</strong><p className="library-help">{item.reason}</p>
                                <div className="pdf-ability-controls">
                                <label>Durata<select aria-label={`Durata di ${item.name}`} value={item.template.duration} onChange={(event) => pdfSetting(`${item.key}.duration`, event.target.value)}>{Object.keys(durationTurns).map((duration) => <option key={duration}>{duration}</option>)}</select></label>
                                {item.template.duration === 'Personalizzata' && <label>Turni<input type="number" min="0" step="1" value={item.template.remainingTurns} onChange={(event) => { if (Number.isSafeInteger(event.target.valueAsNumber) && event.target.valueAsNumber >= 0) pdfSetting(`${item.key}.turns`, event.target.value) }} /></label>}
                                <div className="turn-actions"><InfoButton name={item.name} description={item.description} fields={{ Attivazione: item.reason, duration: item.template.duration }} /><button className="more-info" type="button" onClick={() => pdfSetting(item.key, 'exclude')}>Escludi</button></div>
                                </div>
                            </article>)}

                            {rows.filter((row) => draft.kind !== 'PG' || !row.spell).map(({ ability, index }) => abilityRow(ability, index))}
                            <button className="end-combat sheet-add-ability" type="button" onClick={() => setDraft({ ...draft, abilities: [...draft.abilities, { name: '', duration: '1 minuto' }] })}>+ Aggiungi abilità</button>
                            {reviewPdf.length > 0 && <details className="pdf-ability-review"><summary>Privilegi da verificare o esclusi ({reviewPdf.length})</summary>
                                {reviewPdf.map((item) => <article className="pdf-ability-card" key={item.key}><strong>{item.name}</strong><p className="library-help">{item.reason}</p><div className="turn-actions"><InfoButton name={item.name} description={item.description} /><button className="more-info" type="button" onClick={() => pdfSetting(item.key, 'include')}>Includi tra le abilità da attivare</button></div></article>)}
                            </details>}
                        </section>
                        {draft.kind === 'PG' && <section className="sheet-abilities sheet-spells" aria-labelledby="sheet-spells-heading">
                            <header className="sheet-section-heading"><h3 id="sheet-spells-heading">Magie del personaggio</h3><span className="sheet-section-count" aria-label="Numero di magie">{selectedSpells.length + rows.filter((row) => row.spell).length}</span></header>
                            <p className="library-help sheet-section-intro">Le magie della scheda, con livello e durata. Modificale nella pagina Incantesimi sopra.</p>
                            {rows.filter((row) => row.spell).map(({ ability, index }) => abilityRow(ability, index, true))}
                            {selectedSpells.map((spell, index) => {
                                const entry = catalog.abilities.find((item) => item.id === spell.catalogId)
                                return <article className="sheet-spell-card" key={`${spell.catalogId ?? spell.name}-${index}`}>
                                    <div><strong>{spell.name}</strong><div className="sheet-spell-meta"><span className="sheet-spell-level">{entry?.data.level === 0 ? 'Trucchetto' : typeof entry?.data.level === 'number' ? `Livello ${entry.data.level}` : 'Magia personalizzata'}</span><span>{typeof entry?.data.duration === 'string' ? entry.data.duration : 'Durata da impostare'}</span></div></div>
                                    <InfoButton name={spell.name} entry={entry} fields={{ duration: spell.duration, remainingTurns: spell.remainingTurns }} />
                                </article>
                            })}
                            {!selectedSpells.length && !rows.some((row) => row.spell) && <p className="library-empty">Nessuna magia impostata. Scegli i tuoi incantesimi nella pagina Incantesimi della scheda sopra.</p>}
                        </section>}
                        </div>
                        <p className="library-help">Per mostri e PNG l’iniziativa nel combattimento resta vuota: il modificatore è un suggerimento, inserisci tu il risultato del tiro. Per i PG viene copiata l’iniziativa predefinita.</p>
                        </>}
                        {!guided && <>{error && <p role="alert">{error}</p>}
                        <p className="library-help" role="status">Le modifiche si salvano anche cliccando fuori dalla finestra.</p>
                        <div className="turn-actions">
                            <button className="sort-turns" type="submit">Salva scheda</button>
                            <button className="end-combat" type="button" onClick={closeDialog}>Annulla</button>
                            {saved.sheets.some((sheet) => sheet.id === draft.id) && (
                                <button className="clear-turns" type="button" onClick={() => deleteDialog.current?.showModal()}>Elimina scheda</button>
                            )}
                        </div></>}
                    </form>
                )}
            </dialog>
            <dialog ref={deleteDialog} className="character-dialog" aria-labelledby="delete-sheet-heading" {...dismissDeleteDialog}>
                <h2 id="delete-sheet-heading">Elimina scheda</h2>
                <p>Eliminare la scheda di {draft?.name}?</p>
                <div className="turn-actions">
                    <button autoFocus className="end-combat" type="button" onClick={() => deleteDialog.current?.close()}>Annulla</button>
                    <button className="clear-turns" type="button" onClick={() => {
                        if (!draft) return
                        const success = writeSheets(saved.sheets.filter((sheet) => sheet.id !== draft.id))
                        deleteDialog.current?.close()
                        if (success) closeDialog()
                    }}>Elimina scheda</button>
                </div>
            </dialog>
            <dialog ref={tutorialExitDialog} className="character-dialog" aria-labelledby="tutorial-exit-heading" {...dismissTutorialExitDialog} onCancel={(event) => event.preventDefault()}>
                <h2 id="tutorial-exit-heading">Uscire dalla creazione guidata?</h2>
                <div className="turn-actions">
                    <button autoFocus className="end-combat" type="button" onClick={() => { closeTutorialExitPrompt(); closeDialog() }}>Salva e riprendi più tardi</button>
                    <button className="clear-turns" type="button" onClick={discardCreation}>Cancella scheda</button>
                </div>
            </dialog>
            <dialog ref={randomDialog} className="character-dialog" aria-labelledby="random-character-heading" {...dismissRandomDialog}>
                <form onSubmit={(event) => {event.preventDefault();generateRandom()}}>
                    <h2 id="random-character-heading">Personaggio casuale</h2>
                    <p>D&D 5e 2014. Scegli il livello e fissa classe e razza, oppure lascia queste ultime casuali. «Genera e rivedi» apre il tutorial; «Genera veloce» salva direttamente il personaggio tra le schede.</p>
                    <div className="tutorial-grid">
                        <label className="player-field"><span>Classe</span><select value={randomOrigins.characterClass} onChange={(event) => setRandomOrigins({...randomOrigins,characterClass:event.target.value})}><option value="">Casuale</option>{creationData?.classes.filter((x) => !x.editions || x.editions.includes('2014')).map((x) => <option key={x.index} value={x.index}>{labelOf(x)}</option>)}</select></label>
                        <label className="player-field"><span>Razza</span><select value={randomOrigins.race} onChange={(event) => setRandomOrigins({...randomOrigins,race:event.target.value})}><option value="">Casuale</option>{creationData?.races.filter((x) => !x.editions || x.editions.includes('2014')).map((x) => <option key={x.index} value={x.index}>{labelOf(x)}</option>)}</select></label>
                        <label className="player-field"><span>Livello</span><select value={randomOrigins.level} onChange={(event) => setRandomOrigins({...randomOrigins,level:Number(event.target.value)})}>{Array.from({length:20},(_,i) => <option key={i+1} value={i+1}>{i+1}</option>)}</select></label>
                    </div>
                    <p className="player-hint">Caratteristiche: array standard assegnato casualmente. Competenze, lingue, dotazioni e magie usano le opzioni del catalogo. Sopra il livello 1 vanno verificati aumenti di caratteristica/talenti e avanzamenti nel tutorial. Il Ranger richiede ancora alcune scelte manuali. Per le regole 2024 usa la creazione guidata.</p>
                    {randomError && <p role="alert">{randomError}</p>}
                    <div className="turn-actions"><button className="sort-turns" type="submit">Genera e rivedi</button><button className="sort-turns" type="button" onClick={() => generateRandom(true)}>Genera veloce</button><button className="end-combat" type="button" onClick={() => randomDialog.current?.close()}>Annulla</button></div>
                </form>
            </dialog>
        </aside>
    )
}
