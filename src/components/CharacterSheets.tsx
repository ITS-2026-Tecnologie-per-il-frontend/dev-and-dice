import { durationTurns } from '../utils/Combat'
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import { characterFields, numericCharacterFields, newCharacterSheet, parseCharacterSheets, initiativeBonus, patchSheetStats, type SheetStats, type CharacterSheet, type SheetAbility } from '../utils/CharacterSheets'
import { sheetFromCatalog, sheetWithCombatSpells, templateFromCatalog, type Catalog } from '../utils/Catalog'
import { CatalogSearch } from './CatalogSearch'
import { InfoButton } from './InfoButton'
import { useDialogDismiss } from '../utils/Dialog'
import { PlayerSheet } from './PlayerSheet'
import { pdfAbilities } from '../utils/PlayerAbilities'

const storageKey = 'dev-and-dice.character-sheets.v1'

export type CharacterSheetsHandle = { open: (sheet: CharacterSheet) => void; patchStats: (id: string, stats: Partial<SheetStats>) => boolean }
type Props = { onAdd: (sheet: CharacterSheet) => void; onSaved: (sheet: CharacterSheet) => void; combatStarted: boolean; presentSheetIds: string[]; catalog: Catalog; ref?: Ref<CharacterSheetsHandle> }

export function CharacterSheets({ onAdd, onSaved, combatStarted, presentSheetIds, catalog, ref }: Props) {
    const dismissDialog = useDialogDismiss(() => {
        if (draft && JSON.stringify(draft) !== initialDraft.current) saveSheet()
        else closeDialog()
    })
    const dismissDeleteDialog = useDialogDismiss()
    const deleteDialog = useRef<HTMLDialogElement>(null)
    const [saved, setSaved] = useState(() => {
        try {
            return { sheets: parseCharacterSheets(localStorage.getItem(storageKey)), error: '', blocked: false }
        } catch (error) {
            return { sheets: [] as CharacterSheet[], error: `Impossibile leggere le schede: ${error instanceof Error ? error.message : String(error)}`, blocked: true }
        }
    })
    const [draft, setDraft] = useState<CharacterSheet | null>(null)
    const [error, setError] = useState('')
    const dialog = useRef<HTMLDialogElement>(null)
    const initialDraft = useRef('')

    function openDraft(sheet: CharacterSheet) {
        initialDraft.current = JSON.stringify(sheet)
        setDraft({ ...sheet })
    }

    useImperativeHandle(ref, () => ({
        open: (sheet) => openDraft(saved.sheets.find((item) => item.id === sheet.id) ?? sheet),
        patchStats: (id, stats) => {
            const sheet = saved.sheets.find((item) => item.id === id)
            if (!sheet) return true
            const updated = patchSheetStats(sheet, stats)
            if (!updated || !writeSheets(saved.sheets.map((item) => item.id === id ? updated : item))) return false
            setDraft((current) => current?.id === id ? patchSheetStats(current, stats) ?? current : current)
            return true
        },
    }))

    useEffect(() => {
        if (draft && !dialog.current?.open) dialog.current?.showModal()
    }, [draft])

    function writeSheets(sheets: CharacterSheet[]): boolean {
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
    }

    function closeDialog() {
        dialog.current?.close()
        setDraft(null)
        setError('')
    }

    function saveSheet() {
        if (!draft) return
        const sheet = { ...draft, name: draft.name.trim(), abilities: draft.abilities.map((ability) => ({ ...ability, name: ability.name.trim() })) }
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
        if (writeSheets(sheets)) { onSaved(sheet); closeDialog() }
    }

    function abilityRow(ability: SheetAbility, index: number) {
        if (!draft) return null
        return (<div className="sheet-ability-row" key={index}>
                                    <label>
                                        <span>Nome abilità</span>
                                        <CatalogSearch
                                            required
                                            pattern={'.*\\S.*'}
                                            value={catalog.abilities.find((entry) => entry.id === ability.catalogId)?.name ?? ability.name}
                                            aria-label={`Nome abilità ${index + 1} della scheda`}
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
            <dialog ref={dialog} className={`character-dialog${draft?.kind === 'PG' ? ' player-sheet-dialog' : ''}`} aria-labelledby="character-dialog-heading" {...dismissDialog} onClose={(event) => {
                if (event.target !== event.currentTarget) return
                deleteDialog.current?.close()
                setDraft(null)
                setError('')
            }}>
                {draft && (
                    <form onSubmit={(event) => { event.preventDefault(); saveSheet() }}>
                        <div className="dialog-header">
                            <h2 id="character-dialog-heading">{draft.name || 'Nuova scheda'}</h2>
                            <button className="delete-turn" type="button" aria-label="Chiudi scheda" onClick={closeDialog}>×</button>
                        </div>
                        {draft.kind === 'PG' ? <PlayerSheet sheet={draft} catalog={catalog} onChange={setDraft} /> : <div className="character-fields">
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
                        <div className={draft.kind === 'PG' ? 'sheet-ability-columns' : undefined}>
                        <section className="sheet-abilities" aria-labelledby="sheet-abilities-heading">
                            <h3 id="sheet-abilities-heading">Abilità del personaggio</h3>
                            <p className="library-help">Abilità e magie sono elencate nella card del combattimento: clicca un nome per importarlo, poi clicca di nuovo per raggiungerlo.</p>
                            {draft.kind === 'PG' && <p className="library-help">Dalla scheda PDF vengono elencati solo i privilegi con attivazione riconoscibile. Modifica i testi sopra usando Nome e descrizione su righe separate, con una riga vuota tra privilegi.</p>}
                            {activePdf.map((item) => <article className="pdf-ability-card" key={item.key}>
                                <strong>{item.name}</strong><p className="library-help">{item.reason}</p>
                                <label>Durata<select aria-label={`Durata di ${item.name}`} value={item.template.duration} onChange={(event) => pdfSetting(`${item.key}.duration`, event.target.value)}>{Object.keys(durationTurns).map((duration) => <option key={duration}>{duration}</option>)}</select></label>
                                {item.template.duration === 'Personalizzata' && <label>Turni<input type="number" min="0" step="1" value={item.template.remainingTurns} onChange={(event) => { if (Number.isSafeInteger(event.target.valueAsNumber) && event.target.valueAsNumber >= 0) pdfSetting(`${item.key}.turns`, event.target.value) }} /></label>}
                                <div className="turn-actions"><InfoButton name={item.name} description={item.description} fields={{ Attivazione: item.reason, duration: item.template.duration }} /><button className="more-info" type="button" onClick={() => pdfSetting(item.key, 'exclude')}>Escludi</button></div>
                            </article>)}
                            {reviewPdf.length > 0 && <details className="pdf-ability-review"><summary>Privilegi da verificare o esclusi ({reviewPdf.length})</summary>
                                {reviewPdf.map((item) => <article className="pdf-ability-card" key={item.key}><strong>{item.name}</strong><p className="library-help">{item.reason}</p><div className="turn-actions"><InfoButton name={item.name} description={item.description} /><button className="more-info" type="button" onClick={() => pdfSetting(item.key, 'include')}>Includi tra le abilità da attivare</button></div></article>)}
                            </details>}
                            {rows.filter((row) => draft.kind !== 'PG' || !row.spell).map(({ ability, index }) => abilityRow(ability, index))}
                            <button className="end-combat" type="button" onClick={() => setDraft({ ...draft, abilities: [...draft.abilities, { name: '', duration: '1 minuto' }] })}>+ Aggiungi abilità</button>
                        </section>
                        {draft.kind === 'PG' && <section className="sheet-abilities sheet-spells" aria-labelledby="sheet-spells-heading">
                            <h3 id="sheet-spells-heading">Magie del personaggio</h3>
                            <p className="library-help">Le magie impostate nella scheda sopra compaiono qui. Per modificarle, usa la pagina Incantesimi della scheda.</p>
                            {rows.filter((row) => row.spell).map(({ ability, index }) => abilityRow(ability, index))}
                            {selectedSpells.map((spell, index) => {
                                const entry = catalog.abilities.find((item) => item.id === spell.catalogId)
                                return <article className="sheet-spell-card" key={`${spell.catalogId ?? spell.name}-${index}`}>
                                    <div><strong>{spell.name}</strong><p className="library-help">{entry?.data.level === 0 ? 'Trucchetto' : entry ? `Livello ${entry.data.level}` : 'Magia personalizzata'} · {typeof entry?.data.duration === 'string' ? entry.data.duration : 'Durata da impostare'}</p></div>
                                    <InfoButton name={spell.name} entry={entry} fields={{ duration: spell.duration, remainingTurns: spell.remainingTurns }} />
                                </article>
                            })}
                            {!selectedSpells.length && !rows.some((row) => row.spell) && <p className="library-empty">Nessuna magia impostata nella scheda.</p>}
                        </section>}
                        </div>
                        <p className="library-help">Per mostri e PNG l’iniziativa nel combattimento resta vuota: il modificatore è un suggerimento, inserisci tu il risultato del tiro. Per i PG viene copiata l’iniziativa predefinita.</p>
                        {error && <p role="alert">{error}</p>}
                        <p className="library-help">Le modifiche si salvano anche cliccando fuori dalla finestra.</p>
                        <div className="turn-actions">
                            <button className="sort-turns" type="submit">Salva scheda</button>
                            <button className="end-combat" type="button" onClick={closeDialog}>Annulla</button>
                            {saved.sheets.some((sheet) => sheet.id === draft.id) && (
                                <button className="clear-turns" type="button" onClick={() => deleteDialog.current?.showModal()}>Elimina scheda</button>
                            )}
                        </div>
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
        </aside>
    )
}
