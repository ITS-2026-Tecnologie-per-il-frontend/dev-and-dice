import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { characterFields, clampCurrentHitPointsToMaximum, normalizeHitPoints, numericCharacterFields, characterLevel, initiativeBonus, type CharacterSheet } from '../utils/CharacterSheets'
import { applyCreation, translatedCreationData, characterFieldValue, updateCharacterField, creationEnabled, enableCreation, labelOf, loadCreationData, resetCreationOverrides, selectedOrigins, spellRules, spellSelection, spellSelectionBlock, subclassOptions, subclassMinimumLevel, type CreationData, type Origin } from '../utils/PlayerCreation'
import { CreationChoices, CreationStatus } from './PlayerCreation'
import { CharacterTutorial } from './CharacterTutorial'
import { classId, spellCounts, spellRowState, spellSources, savedSpellGrants, landNames2014, landNames2024, type SpellSource } from '../utils/Spellcasting'
import { CatalogSearch } from './CatalogSearch'
import { InventoryEditor, type InventoryTarget } from './InventoryEditor'
import { inventoryItems, inventoryReferenceField, inventoryIssues, ownedInventoryItems, referencedInventoryItem } from '../utils/Inventory'
import { WizardSubclassFeatures } from './WizardSubclassFeatures'
import { WizardSpellcasting, WizardAdvancement } from './WizardSpellcasting'
import { copyCost, wizardRules } from '../utils/Wizard'
import { type Catalog } from '../utils/Catalog'
import { sheetTemplates, playerTemplate, wizardPrivilegeLevels, featuresAtLevel, updateFeaturesAtLevel } from '../utils/PlayerTemplates'
import { printCharacterSheet } from '../utils/PrintCharacterSheet'
import { hasOtherSpell, spellNameLookup, spellNameRoots } from '../utils/SpellPage'
import '../PlayerSheet.css'
import '../WizardPdf.css'

const scores = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const
const skills = [
    ['Acrobazia', 'dexterity'], ['Addestrare animali', 'wisdom'], ['Arcano', 'intelligence'],
    ['Atletica', 'strength'], ['Furtività', 'dexterity'], ['Indagare', 'intelligence'],
    ['Inganno', 'charisma'], ['Intimidire', 'charisma'], ['Intrattenere', 'charisma'],
    ['Intuizione', 'wisdom'], ['Medicina', 'wisdom'], ['Natura', 'intelligence'],
    ['Percezione', 'wisdom'], ['Persuasione', 'charisma'], ['Rapidità di mano', 'dexterity'],
    ['Religione', 'intelligence'], ['Sopravvivenza', 'wisdom'], ['Storia', 'intelligence'],
] as const

export function PlayerSheet({ sheet, catalog, creationData: suppliedData, onChange: emitChange, exportPage, children }: { sheet: CharacterSheet; catalog?: Catalog; creationData?: CreationData; onChange: (sheet: CharacterSheet) => void; exportPage?: number; children?: ReactNode }) {
    const [page, setPage] = useState(0)
    const [exporting, setExporting] = useState(false)
    const [exportError, setExportError] = useState('')
    const exportHost = useRef<HTMLDivElement>(null)
    const exportName = useRef('')
    const [exportWidth, setExportWidth] = useState(1120)
    const [inventoryPage,setInventoryPage] = useState(0)
    const [inventoryTarget,setInventoryTarget] = useState<InventoryTarget>()
    const [portraitError, setPortraitError] = useState('')
    const [rawData, setData] = useState<CreationData>()
    const data = useMemo(() => suppliedData ?? (rawData ? translatedCreationData(rawData, catalog) : undefined), [suppliedData, rawData, catalog])
    const [dataError, setDataError] = useState('')
    const [retry, setRetry] = useState(0)
    useEffect(() => {
        if (suppliedData) return
        let active = true
        loadCreationData().then((value) => { if (active) { setData(value); setDataError('') } }).catch(() => { if (active) setDataError('Impossibile caricare le opzioni di creazione. Puoi continuare a compilare manualmente.') })
        return () => { active = false }
    }, [retry, suppliedData])
    const prefix = useId()
    const details = sheet.playerDetails ?? {}
    const template = playerTemplate(sheet), wizardTemplate = template === 'wizard' || template === 'wizard-pdf'
    const inventoryRowsPerPage = template === 'wizard-pdf' ? 19 : 12
    const inventory = inventoryItems(sheet), inventoryWarnings=inventoryIssues(sheet)
    const occupiedRows=inventory.map((x) => x.row), freeRows:number[]=[]
    for (let row=0;freeRows.length<inventoryRowsPerPage;row++) if (!occupiedRows.includes(row)) freeRows.push(row)
    const inventoryPages=Math.max(1,Math.ceil((occupiedRows.length+1)/inventoryRowsPerPage)), shownInventoryPage=exportPage === undefined ? Math.min(inventoryPage,inventoryPages-1) : 0
    const inventoryRows=[...occupiedRows,...freeRows].slice(shownInventoryPage*inventoryRowsPerPage,shownInventoryPage*inventoryRowsPerPage+inventoryRowsPerPage)
    const pages = sheetTemplates[template].pages
    const visiblePage = exportPage ?? (page < pages.length ? page : 0)
    useEffect(() => {
        if (!exporting || !exportHost.current) return
        let active = true
        printCharacterSheet(exportHost.current, exportName.current).catch(() => {
            if (active) setExportError('Impossibile preparare il PDF. Riprova: i dati della scheda restano invariati.')
        }).finally(() => { if (active) setExporting(false) })
        return () => { active = false }
    // ponytail: uno snapshot per clic; modifiche successive non riavviano la stampa.
    }, [exporting])
    const automatic = creationEnabled(sheet) && !!data
    const subclass = data && subclassOptions(sheet, data).find((x) => x.index === details['creation.subclass'])
    const hasSpellRules = data && characterLevel(sheet) !== undefined && data.classes.some((x) => x.index === classId(sheet))
    const magic = useMemo(() => data && hasSpellRules ? spellRules(sheet, data) : undefined,[sheet,data,hasSpellRules])
    const spellLabel = useMemo(() => spellNameLookup(catalog),[catalog])
    const selectedSpellRoots = useMemo(() => spellNameRoots(sheet,spellLabel),[sheet,spellLabel])
    const selectedMagic = useMemo(() => data && hasSpellRules ? spellSelection({ ...sheet, playerDetails: Object.fromEntries(Object.entries(sheet.playerDetails ?? {}).map(([key, value]) => [key, /^spell\.\d+\.\d+\.name$/.test(key) ? spellLabel(value) : value])) }, data) : undefined,[sheet,data,hasSpellRules,spellLabel])
    // Many rows share identical options. Reuse their elements within this render.
    const spellOptions = new Map<string,ReactNode>()
    function onChange(next: CharacterSheet, clampHitPoints = false) {
        const updated = !suppliedData && data ? applyCreation(next, data) : next
        emitChange(clampHitPoints ? clampCurrentHitPointsToMaximum(updated) : updated)
    }
    function clampHitPointsOnMaximumBlur() {
        emitChange(clampCurrentHitPointsToMaximum(sheet))
    }
    function updateBase(key: string, value: string) {
        onChange(updateCharacterField(sheet, key, value), key === 'hitPoints')
    }
    function originSelect(kind: 'class' | 'race' | 'subrace' | 'subclass' | 'background', label: string, options: Origin[], base?: 'characterClass' | 'race') {
        const key = `creation.${kind}`
        const value = base ? sheet[base] : details[kind] ?? ''
        return <label className="player-field"><span>{label}</span><select value={options.some((x) => x.index === details[key]) ? details[key] : ''} onChange={(event) => {
            const origin = options.find((x) => x.index === event.target.value)
            const nextDetails = { ...details, [key]: event.target.value }
            if (!origin && (kind === 'class' || kind === 'race')) nextDetails['creation.enabled'] = 'false'
            if (kind === 'race') { nextDetails['creation.subrace'] = ''; nextDetails.subrace = '' }
            if (kind === 'class') { nextDetails['creation.subclass'] = ''; nextDetails.subclass = '' }
            if (kind === 'subrace') nextDetails.subrace = origin ? labelOf(origin) : ''
            if (kind === 'subclass') nextDetails.subclass = origin ? labelOf(origin) : ''
            if (kind === 'subclass' && origin?.class) nextDetails['creation.class'] = origin.class.index
            if (kind === 'background') nextDetails.background = origin ? labelOf(origin) : value
            const next = { ...sheet, ...(base ? { [base]: origin ? labelOf(origin) : value } : {}), playerDetails: nextDetails }
            onChange(origin && data ? enableCreation(next, data) : next)
        }}><option value="">{value ? `Personalizzato: ${value}` : 'Seleziona…'}</option>{options.map((x) => <option key={x.index} value={x.index} disabled={kind === 'subclass' && !!data && Number(sheet.level) < subclassMinimumLevel(sheet, x, data)}>{labelOf(x)}{kind === 'subclass' && data && !(template === 'wizard-pdf' && label === 'Tradizione arcana') ? ` · livello ${subclassMinimumLevel(sheet, x, data)}${x.status === 'archived-ua' ? ' · UA archiviata' : x.status === 'ua' ? ' · UA' : ''}` : ''}</option>)}</select>
        {!options.some((x) => x.index === details[key]) && <input aria-label={`${label} personalizzato`} value={value} placeholder="Valore personalizzato" onChange={(event) => base ? updateBase(base, event.target.value) : detail(kind, event.target.value)} />}</label>
    }
    function detail(key: string, value: string) {
        onChange(updateCharacterField(sheet, key, value))
    }
    function modifier(score: typeof scores[number]) {
        return characterFieldValue(sheet, `modifier.${score}`)
    }
    function field(key: string, label: ReactNode, options: { base?: boolean; multiline?: boolean; numeric?: boolean; placeholder?: string; onBlur?: () => void } = {}) {
        const value = options.base ? sheet[key as keyof typeof characterFields] : characterFieldValue(sheet,key)
        const notes=/^magicItem\.(\d+)\.notes$/.exec(key),referenceKey=notes && !referencedInventoryItem(sheet,`magicItem.${notes[1]}.name`) ? `magicItem.${notes[1]}.name` : key
        const reference=inventoryReferenceField(referenceKey),summary=['equipment','consumables','attunedItems'].includes(key) && details['inventory.version']==='1'
        const pick=() => reference ? setInventoryTarget({field:referenceKey,label:typeof label==='string' ? label : 'Oggetto dell’inventario'}) : setPage(1)
        const inventoryProps=reference || summary ? {readOnly:true,'aria-haspopup':reference ? 'dialog' as const : undefined,title:reference ? 'Seleziona dall’inventario' : 'Visualizza nella pagina Inventario',onClick:pick,onKeyDown:(event: React.KeyboardEvent) => {if (event.key==='Enter' || event.key===' ') {event.preventDefault();pick()}}} : {}
        const update = (value: string) => {
            const normalized = ['maxHitPoints', 'hitPoints', 'temporaryHitPoints'].includes(key) ? normalizeHitPoints(value) : value
            return options.base ? updateBase(key, normalized) : detail(key, normalized)
        }
        const numeric = options.numeric || (options.base && (numericCharacterFields as readonly string[]).includes(key))
        return <label data-field={key} className={`player-field${options.multiline ? ' player-field-prose' : ''}`} key={key}>
            <span>{label}</span>
            {options.multiline
                ? <textarea {...inventoryProps} rows={4} value={value} onChange={(event) => update(event.target.value)} placeholder={options.placeholder} />
                : <input {...inventoryProps} type={numeric ? 'number' : 'text'} step={numeric ? '1' : undefined} required={options.base && key === 'name'} pattern={options.base && key === 'name' ? '.*\\S.*' : undefined} value={value} onChange={(event) => update(event.target.value)} onBlur={options.onBlur} placeholder={options.placeholder} />}
        </label>
    }
    function box(title: string, children: ReactNode, className = '') {
        return <section className={`player-box ${className}`} key={title}><h3>{title}</h3>{children}</section>
    }
    function slotCircles(kind: 'total' | 'used') {
        return <div className={`player-wizard-slot-circles player-wizard-slot-${kind}`}>
            {[4, 3, 3, 3, 3, 2, 2, 1, 1].map((capacity, index) => {
                const key = `slots.${index + 1}.${kind}`, count = Number(details[key]) || 0
                return <div className="player-wizard-slot-level" key={key}>
                    {kind === 'total' && <span>{index + 1}{index === 0 ? 'st' : index === 1 ? 'nd' : index === 2 ? 'rd' : 'th'}</span>}
                    {Array.from({ length: capacity }, (_, slot) => <button data-print="value" type="button" key={slot} aria-label={`Slot livello ${index + 1}, ${kind === 'total' ? 'totali' : 'lanciati'}: ${slot + 1}`} aria-pressed={count > slot}
                        onClick={() => detail(key, String(count === slot + 1 ? slot : slot + 1))} />)}
                    {count > capacity && <small aria-label={`Conteggio ${kind === 'total' ? 'totale' : 'lanciato'} livello ${index + 1}`}>{count}</small>}
                </div>
            })}
        </div>
    }
    function selectedSpellCount(kind: 'prepared' | 'cantrips') {
        return (selectedMagic ?? spellCounts(sheet))[kind]
    }
    const attunedCount = ownedInventoryItems(sheet).filter((x) => details[`inventory.${x.row}.attuned`]==='true').length
    function check(key: string, label: string) {
        return <label className="player-check" key={key}><input type="checkbox" aria-label={label} checked={characterFieldValue(sheet,key) === 'true'} disabled={key.startsWith('magicItem.') && !referencedInventoryItem(sheet,key.replace(/\.[^.]+$/,'.name'))} onChange={(event) => detail(key, String(event.target.checked))} /><span>{label}</span></label>
    }
    function spellRow(level: number, index: number) {
        const root = `spell.${level}.${index}`
        const state = spellRowState(sheet, level, index)
        const name = spellLabel(details[`${root}.name`] ?? '')
        const limit = selectedMagic && state.needsPreparation && !state.checked ? spellSelectionBlock(selectedMagic, { level, root, source:state.source, prepare:true, alwaysPrepared:state.alwaysPrepared }) : ''
        const blocked = (learned = details[`${root}.learned`] || 'level', source = state.source, spell?: CreationData['spells'][number]) => selectedMagic ? spellSelectionBlock(selectedMagic,{level,root,source,learned,spell}) : ''
        const choices = state.source === 'arcanum' ? (magic?.arcanumLevels.includes(level) ? data?.spells.filter((x) => x.level === level && x.classes.some((c) => c.index === 'warlock')) ?? [] : [])
            : ['secrets', 'lore'].includes(state.source) ? data?.spells.filter((x) => x.level === level && level <= (magic?.maxLevel ?? 0) && (magic?.edition !== '2024' || state.source === 'lore' || x.classes.some((c) => ['bard', 'cleric', 'druid', 'wizard'].includes(c.index)))) ?? []
            : magic?.spells.filter((x) => x.level === level) ?? []
        const label = state.alwaysPrepared ? 'Sempre preparato' : state.needsPreparation ? 'Preparato' : state.canToggle ? 'Disponibile' : level === 0 ? 'Trucchetto conosciuto' : magic?.edition === '2024' ? 'Preparato nella lista di classe' : 'Conosciuto / sempre disponibile'
        const wizard = wizardRules(sheet)
        const spell = data?.spells.find((x) => x.index === details[`${root}.index`] || labelOf(x) === name || x.name === name)
        return <div className="player-spell-entry" key={index}>
            <div className="player-spell-row">
                <label className="player-check"><input type="checkbox" aria-label={`${label}: livello ${level}, incantesimo ${index + 1}`} title={limit || label}
                    checked={!!name && state.checked} disabled={!name || !state.canToggle || !!limit || state.lost && !state.checked}
                    onChange={(event) => { if (!event.target.checked || !limit) detail(state.checkboxKey, String(event.target.checked)) }} /><span>{label}</span></label>
                {magic && ['class', 'arcanum', 'secrets', 'lore'].includes(state.source) ? <select aria-label={`Incantesimo livello ${level}, ${index + 1}`} disabled={!!details[`${root}.grant`]} value={name}
                    onChange={(event) => {
                        const choice = choices.find((x) => labelOf(x) === event.target.value)
                        if (choice && blocked(undefined,undefined,choice)) return
                        const next = { ...details, [`${root}.name`]: event.target.value, [`${root}.index`]: choice?.index ?? '', [`${root}.prepared`]: 'false', [`${root}.learned`]: details[`${root}.learned`] || 'level', [`${root}.grant`]: '', [`${root}.always`]: 'false', [`${root}.freeFeature`]: '' }
                        for (const key of ['wizard.mastery.1', 'wizard.mastery.2', 'wizard.signature.0', 'wizard.signature.1']) if (next[key] === root) next[key] = ''
                        onChange({ ...sheet, playerDetails: next })
                    }}>
                    <option value="">Seleziona…</option>
                    {name && !choices.some((x) => labelOf(x) === name) && <option value={name}>{name} (verifica con il DM)</option>}
                    {choices.map((x) => {
                        const optionName=labelOf(x),reason=blocked(undefined,undefined,x)
                        const duplicate=hasOtherSpell(selectedSpellRoots.get(state.source)?.get(optionName),root)
                        const disabled=name !== optionName && (duplicate || !!reason)
                        const cacheKey=JSON.stringify([x.index,optionName,reason,disabled])
                        let option=spellOptions.get(cacheKey)
                        if (!option) {
                            option=<option key={x.index} value={optionName} title={reason || undefined} disabled={disabled}>{optionName}</option>
                            spellOptions.set(cacheKey,option)
                        }
                        return option
                    })}
                </select> : <CatalogSearch aria-label={`Incantesimo livello ${level}, ${index + 1}`} value={name}
                    entries={catalog?.abilities.filter((entry) => entry.data.level === level) ?? []}
                    onChange={(value) => detail(`${root}.name`, value)} onSelect={(entry) => detail(`${root}.name`, entry.name)} />}
            </div>
            <details data-print="exclude" className={wizardTemplate ? 'player-spell-metadata' : 'player-spell-metadata player-spell-metadata-open'} open={!wizardTemplate}><summary>Fonte e acquisizione</summary>
            {wizard.wizard && state.source === 'class' && level > 0 && <>
                {state.lost && <small>Libro perduto: ritrova e copia questo incantesimo prima di prepararlo o lanciarlo.</small>}
                <label className="player-field"><span>Acquisizione nel libro</span><select disabled={!!details[`${root}.grant`]} value={details[`${root}.learned`] || 'level'} onChange={(e) => { if (!name || !blocked(e.target.value,undefined,spell)) detail(`${root}.learned`, e.target.value) }}>
                    {Object.entries({ level:'Scelta iniziale / avanzamento', copied:'Copiato durante l’avventura', feature:'Concesso dal privilegio', ...(wizard.savantChoices > 0 || details[`${root}.learned`] === 'savant' ? { savant:'Scelta gratuita · Evocation Savant' } : {}) }).map(([value,label]) => <option key={value} value={value} title={name ? blocked(value,undefined,spell) || undefined : undefined} disabled={!!name && !!blocked(value,undefined,spell)}>{label}</option>)}
                </select></label>
                {spell && <small>{spell.ritual && 'Rituale utilizzabile dal libro anche senza preparazione. '}{spell.school?.index === wizard.savantSchool && wizard.savantDiscount && `Copia: ${copyCost(sheet, spell).gold} MO, ${copyCost(sheet, spell).hours} ore (School Savant).`}</small>}
            </>}
            <div className="player-spell-source">
                <select aria-label={`Fonte dell’incantesimo livello ${level}, ${index + 1}`} value={state.source} disabled={!!details[`${root}.grant`]} onChange={(event) => { if (!name || !blocked(undefined,event.target.value as SpellSource,spell)) detail(`${root}.source`, event.target.value) }}>
                    {Object.entries(spellSources).map(([key, label]) => <option key={key} value={key} disabled={!!name && key !== state.source && !!blocked(undefined,key as SpellSource,spell)} title={name ? blocked(undefined,key as SpellSource,spell) || undefined : undefined}>{label}</option>)}
                </select>
                {!['class', 'arcanum', 'secrets', 'lore'].includes(state.source) && <input aria-label={`Fonte e usi dell’incantesimo ${index + 1} di livello ${level}`} placeholder="Fonte e usi / cariche" value={details[`${root}.note`] ?? ''} onChange={(event) => detail(`${root}.note`, event.target.value)} />}
            </div>
            </details>
        </div>
    }
    // Limite di 500 righe per livello per proteggere il rendering; oltre serve una lista paginata.
    function spellRowCount(level: number) {
        const requested = Number(details[`spell.rows.${level}`])
        return Number.isSafeInteger(requested) && requested > 0 ? Math.min(500, Math.max(level >= 6 ? 6 : 8, requested)) : level >= 6 ? 6 : 8
    }
    function rollRow(key: string, label: string, score: typeof scores[number], mastery = false) {
        return <div className="player-roll" key={key}>
            {check(`${key}.proficient`, `Competenza in ${label}`)}
            {mastery && check(`${key}.expertise`, `Maestria in ${label}`)}
            <input type="number" step="1" aria-label={`Bonus ${label}`} value={details[key] ?? ''} placeholder={modifier(score)} onChange={(event) => detail(key, event.target.value)} />
            <span>{template === 'wizard-pdf' && key.startsWith('save.') ? 'Tiro salvezza' : label} {mastery && <small>({characterFields[score].slice(0, 3)})</small>}</span>
        </div>
    }
    function favoriteComponent(index: number, component: string) {
        const key = `favoriteSpell.${index}.components`, value = details[key] ?? ''
        const token = new RegExp(`\\b${component}\\b`, 'g')
        return <label className="player-wizard-component" key={component}><span>{component}</span><input type="checkbox" aria-label={`Componente ${component}, incantesimo preferito ${index + 1}`} checked={token.test(value)} onChange={(event) => {
            const next = event.target.checked ? `${value.trim()}${value.trim() ? ', ' : ''}${component}`
                : value.replace(token, '').replace(/([,;/])(?:\s*[,;/])+/g, '$1').replace(/^[\s,;/]+|[\s,;/]+$/g, '')
            detail(key, next)
        }} /></label>
    }
    function table(title: string, key: string, columns: string[], count: number) {
        return box(title, <div className="player-table-scroll"><table className="player-table">
            <thead><tr>{columns.map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
            <tbody>{Array.from({ length: count }, (_, i) => {const row=key==='inventory' ? inventoryRows[i] : i;return <tr key={row}>{columns.map((label,column) => {
                const fieldKey=`${key}.${row}.${column}`,reference=inventoryReferenceField(fieldKey)
                return <td key={column}><input aria-label={`${title}: ${label}, riga ${row + 1}`} value={characterFieldValue(sheet,fieldKey)} readOnly={reference} aria-haspopup={reference ? 'dialog' : undefined} title={reference ? 'Seleziona dall’inventario' : undefined} onClick={reference ? () => setInventoryTarget({field:fieldKey,label:`${title}: ${label}, riga ${row+1}`}) : undefined} onKeyDown={reference ? (e) => {if (e.key==='Enter' || e.key===' ') {e.preventDefault();setInventoryTarget({field:fieldKey,label:`${title}: ${label}, riga ${row+1}`})}} : undefined} onChange={(event) => detail(fieldKey,event.target.value)} /></td>
            })}</tr>})}</tbody>
        </table></div>, key === 'attacks' ? 'player-wizard-attacks' : '')
    }
    const slotFields = <div className="player-wizard-slots">{Array.from({length:9},(_,i) => <div key={i}>{field(`slots.${i+1}.total`,`${i+1} · totali`,{numeric:true})}{field(`slots.${i+1}.used`,'Lanciati',{numeric:true})}</div>)}</div>
    const personalityFields = ['Tratti caratteriali','Ideali','Legami','Difetti'].map((label) => box(label,field(`personality.${label}`,label,{multiline:true})))

    if (exportPage === undefined && details['tutorial.active'] === 'true') return <div className="player-sheet">{data ? <CharacterTutorial sheet={sheet} data={data} onChange={onChange}>{children}</CharacterTutorial> : <section className="character-tutorial" aria-label="Caricamento della creazione guidata"><p role="status">{dataError || 'Caricamento delle opzioni per il tutorial…'}{dataError && <button type="button" onClick={() => setRetry(retry + 1)}>Riprova</button>}</p><footer className="tutorial-footer"><div className="tutorial-draft-actions">{children}</div></footer></section>}</div>
    return <div className="player-sheet">
        {exportPage === undefined && <div className="player-sheet-export-controls" data-print="exclude"><button type="button" disabled={exporting || !data} onClick={(event) => { setExportWidth(event.currentTarget.closest('.player-sheet')?.querySelector('.player-paper')?.getBoundingClientRect().width ?? 1120); exportName.current = sheet.name; setExportError(''); setExporting(true) }}>{exporting ? 'Preparazione PDF…' : 'Esporta scheda in PDF'}</button><small>Per scaricarlo, scegli «Salva come PDF» nella finestra di stampa.</small>{exportError && <p role="alert">{exportError}</p>}</div>}
        {inventoryWarnings.length > 0 && <p className="creation-warning" role="status">{inventoryWarnings.join(' ')}</p>}
        {selectedMagic && selectedMagic.issues.length > 0 && <p className="creation-warning" role="alert">{selectedMagic.issues.join(' ')}</p>}
        <div className="player-template-picker"><label className="player-field"><span>Modello della scheda</span><select value={Object.hasOwn(sheetTemplates, details['sheet.template'] ?? '') ? details['sheet.template'] : 'auto'} onChange={(event) => { detail('sheet.template',event.target.value); setPage(0) }}><option value="auto">Automatico in base alla classe</option>{Object.entries(sheetTemplates).map(([id,model]) => <option key={id} value={id}>{model.name}</option>)}</select></label>{wizardTemplate && <a href={`${import.meta.env?.BASE_URL ?? '/'}templates/Mago.pdf`} target="_blank" rel="noreferrer">Apri PDF originale · Mago</a>}</div>
        {data ? <CreationStatus sheet={sheet} enable={() => emitChange(enableCreation(sheet, data))} disable={() => emitChange({ ...sheet, playerDetails: { ...details, 'creation.enabled': 'false' } })} /> : <p className="player-hint" role="status">{dataError || 'Caricamento opzioni del personaggio…'}{dataError && <button type="button" onClick={() => setRetry(retry + 1)}>Riprova</button>}</p>}
        {automatic && data && <button type="button" onClick={() => emitChange(resetCreationOverrides(sheet, data))}>Ripristina i campi generati (annulla le loro modifiche manuali)</button>}
        <div className="player-sheet-tabs" role="tablist" aria-label="Pagine della scheda">
            {pages.map((label, index) => <button
                key={label} type="button" role="tab" id={`${prefix}-tab-${index}`} aria-selected={visiblePage === index} aria-controls={`${prefix}-page`}
                tabIndex={visiblePage === index ? 0 : -1} onClick={() => setPage(index)}
                onKeyDown={(event) => {
                    let next = index
                    if (event.key === 'ArrowRight') next = (index + 1) % pages.length
                    else if (event.key === 'ArrowLeft') next = (index + pages.length - 1) % pages.length
                    else if (event.key === 'Home') next = 0
                    else if (event.key === 'End') next = pages.length - 1
                    else return
                    event.preventDefault(); setPage(next)
                    document.getElementById(`${prefix}-tab-${next}`)?.focus()
                }}
            >{index + 1}. {label}</button>)}
        </div>
        <div className="player-paper-viewport" tabIndex={0}>
        <div className={`player-paper${visiblePage === 0 ? ' player-paper-statistics' : ''}${wizardTemplate ? ' player-paper-wizard' : ''}${template === 'wizard-pdf' ? ' player-paper-wizard-pdf' : ''}`} role="tabpanel" id={`${prefix}-page`} aria-labelledby={`${prefix}-tab-${visiblePage}`}>
            {!wizardTemplate && <header className="player-identity">
                <div className="player-name"><span className="player-brand">DUNGEONS & DRAGONS</span>{field('name', 'Nome personaggio', { base: true })}</div>
                <div className="player-identity-fields">
                    {data ? originSelect('class', 'Classe', data.classes, 'characterClass') : field('characterClass', 'Classe', { base: true })}
                    {data && originSelect('subclass', 'Sottoclasse', subclassOptions(sheet, data))}
                    {automatic ? <label className="player-field"><span>Livello</span><select value={sheet.level} onChange={(event) => updateBase('level', event.target.value)}>{Array.from({ length: 20 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select></label> : field('level', 'Livello', { base: true })}{field('playerName', 'Nome giocatore')}
                    {data ? originSelect('race', 'Razza / specie', data.races, 'race') : field('race', 'Razza / specie', { base: true })}
                    {data && originSelect('subrace', 'Sottorazza', data.subraces.filter((x) => x.race?.index === selectedOrigins(sheet, data).race?.index))}
                    {data ? originSelect('background', 'Background', data.backgrounds) : field('background', 'Background')}
                    {data ? <label className="player-field"><span>Allineamento</span><select value={details.alignment ?? ''} onChange={(event) => detail('alignment', event.target.value)}><option value="">Seleziona…</option>{details.alignment && !data.alignments.some((x) => labelOf(x) === details.alignment) && <option>{details.alignment}</option>}{data.alignments.map((x) => <option key={x.index}>{labelOf(x)}</option>)}</select></label> : field('alignment', 'Allineamento')}
                    {field('sex', 'Sesso')}
                    <label className="player-field"><span>Tipo scheda</span><select value={sheet.kind} onChange={(event) => onChange({ ...sheet, kind: event.target.value })}><option>PG</option><option>Mostro</option><option>PNG</option></select></label>
                </div>
            </header>}
            {wizardTemplate && visiblePage !== 3 && <header className={`player-wizard-identity player-wizard-identity-${visiblePage}`}>
                {visiblePage !== 2 && <div className="player-name">{field('name','Nome del personaggio',{base:true})}</div>}
                {visiblePage === 0 && <>
                    <div className="player-wizard-bio">
                        {data ? originSelect('race','Razza',data.races,'race') : field('race','Razza',{base:true})}
                        {data ? originSelect('background','Background',data.backgrounds) : field('background','Background')}
                        {field('alignment','Allineamento')}{field('playerName','Giocatore')}
                    </div>
                    <div className="player-wizard-class"><strong>{template === 'wizard-pdf' ? <span className="player-wizard-class-title">M<span>ago</span></span> : 'MAGO'}</strong><div className="player-wizard-class-fields">
                        {automatic ? <label className="player-field"><span>{template === 'wizard-pdf' ? 'Liv' : 'Livello'}</span><select value={sheet.level} onChange={(e) => updateBase('level',e.target.value)}>{Array.from({length:20},(_,i) => <option key={i} value={i+1}>{i+1}</option>)}</select></label> : field('level',template === 'wizard-pdf' ? 'Liv' : 'Livello',{base:true})}
                        {data ? originSelect('subclass','Tradizione arcana',subclassOptions(sheet,data)) : field('subclass','Tradizione arcana')}
                    </div></div>
                </>}
                {visiblePage === 1 && <div className="player-wizard-appearance">
                    <div className="player-six-fields">{['Età','Altezza','Peso','Carnagione','Occhi','Capelli'].map((label) => field(`appearance.${label}`,template === 'wizard-pdf' && label === 'Carnagione' ? 'Pelle' : label))}</div>
                    <div className="player-three-fields">{field('deity','Divinità')}{field('scars','Cicatrici')}{field('distinctiveMarks','Segni di riconoscimento')}</div>
                </div>}
                {visiblePage === 2 && <div className="player-casting">{field('castingClass','Classe da incantatore')}{field('castingAbility','Caratteristica da incantatore')}{field('spellDC','CD tiro salvezza incantesimi',{numeric:true})}{field('spellAttackBonus','Bonus attacco incantesimi',{numeric:true})}</div>}
            </header>}
            {!wizardTemplate && automatic && data && <CreationChoices sheet={sheet} data={data} change={detail} />}
            {subclass?.sourceUrl && <p className="player-hint"><strong>{labelOf(subclass)}</strong> · {subclass.sources?.join(', ')} · <a href={subclass.sourceUrl} target="_blank" rel="noreferrer">Regole della sottoclasse</a>{subclass.automationStatus === 'manual-subclass-features' && ' · I privilegi specifici di questa sottoclasse si annotano nei Privilegi di classe; gli automatismi generali del mago restano attivi.'}</p>}
            {!wizardTemplate && visiblePage === 0 && automatic && data && <WizardSubclassFeatures sheet={sheet} data={data} onChange={onChange} />}
            {!wizardTemplate && visiblePage === 0 && <WizardAdvancement sheet={sheet} onChange={onChange} />}
            {visiblePage === 0 && wizardTemplate && <div className="player-stat-page player-wizard-statistics">
                <div className="player-column player-wizard-left">
                    <div className="player-wizard-competence">{field('proficiencyBonus','Competenza',{numeric:true})}</div>
                    <div className="player-two-fields player-wizard-perception">{field('passivePerception','Percezione passiva',{numeric:true})}{check('inspiration','Ispirazione')}</div>
                    <div className="player-wizard-abilities">{scores.map((score) => <section className="player-wizard-score" key={score}>
                        <div className="player-score">{field(score,characterFields[score],{base:true})}<output aria-label={`Modificatore ${characterFields[score]}`}>{modifier(score) || '—'}</output>{template === 'wizard-pdf' && <output className="player-wizard-score-base" aria-label={`Valore base ${characterFields[score]}`}>{(creationEnabled(sheet) ? details[`creation.base.${score}`] : sheet[score]) || '—'}<small>Base</small></output>}</div>
                        <div className="player-column">{rollRow(`save.${score}`,`Tiro salvezza ${characterFields[score]}`,score)}{skills.filter(([,ability]) => ability === score).map(([label]) => rollRow(`skill.${label}`,label,score,true))}</div>
                    </section>)}</div>
                    {box('Linguaggi, tratti e privilegi aggiuntivi',<>{field('languages','Linguaggi',{multiline:true})}{field('racialTraits','Tratti razziali e privilegi da background',{multiline:true})}</>,'player-wizard-traits')}
                    <div className="player-wizard-proficiencies">
                        {box('Competenze',<div className="player-column">{['Leggere','Medie','Pesanti','Armi semplici','Armi da guerra','Scudi'].map((label) => check(`proficiency.${label}`,label))}</div>)}
                        {box('Strumenti e altre competenze',field('tools','Armi aggiuntive e strumenti',{multiline:true}))}
                    </div>
                </div>
                <div className="player-column player-wizard-middle">
                    <section className="player-wizard-combat">
                        <div className="player-combat-top"><div className="player-wizard-ac">{field('armorClass','CA',{base:true})}{field('temporaryAC','CA temporanea',{numeric:true})}{template === 'wizard-pdf' && <div className="player-wizard-defenses"><div className="player-wizard-defense player-wizard-no-armor">{field('unarmoredAC',<>No<br /> armatura</>,{numeric:true})}</div><div className="player-wizard-defense player-wizard-no-shield">{field('unshieldedAC',<>No<br /> scudo</>,{numeric:true})}</div></div>}</div>{field('initiative','Iniziativa',{base:true,placeholder:initiativeBonus(sheet)})}{field('speed','Velocità',{base:true})}</div>
                        <div className="player-wizard-hitpoints">{field('maxHitPoints',template === 'wizard-pdf' ? 'Max' : 'PF massimi',{numeric:true,onBlur:clampHitPointsOnMaximumBlur})}{field('hitPoints',template === 'wizard-pdf' ? <>Punti ferita<small className="player-wizard-hp-caption">Attuali</small></> : 'Punti ferita attuali',{base:true})}{field('temporaryHitPoints',template === 'wizard-pdf' ? <>Punti ferita<br /> temporanei</> : 'PF temporanei',{numeric:true})}</div>
                        <div className="player-wizard-vitality">
                            {box('Dadi vita',<><div className="player-two-fields"><label className="player-field"><span>Totali</span><output>{details.hitDiceTotal || '—'}</output></label>{field('hitDiceUsed','Usati',{numeric:true})}</div><output className="player-wizard-hit-die">{template === 'wizard-pdf' ? (details.hitDice || 'd6').replace(/^1(?=d\d+$)/,'') : details.hitDice || 'd6'}{template === 'wizard-pdf' && <img className="player-wizard-hit-die-frame" src={`${import.meta.env?.BASE_URL ?? '/'}templates/cornicetonda.svg`} alt="" />}</output></>)}
                            <div className="player-column"><div className="player-wizard-exhaustion">{field('exhaustion','Livelli di indebolimento',{numeric:true})}{template === 'wizard-pdf' && <div className="player-wizard-exhaustion-levels" role="group" aria-label="Livelli di indebolimento">{[1,2,3,4,5,6].map((level) => <button data-print="value" key={level} type="button" aria-label={`Indebolimento: livello ${level}`} aria-pressed={Number(details.exhaustion) >= level} title={`Imposta livello ${level}; riclicca sul livello attuale per azzerare`} onClick={() => detail('exhaustion',String(Number(details.exhaustion) === level ? 0 : level))}>{level}</button>)}</div>}</div>{box('Salvezza da morte',<>{['Successi','Fallimenti'].map((label) => <div className="player-death" key={label}><span>{label}</span>{[0,1,2].map((i) => check(`death.${label}.${i}`,`${label} ${i+1}`))}</div>)}</>)}</div>
                        </div>
                    </section>
                    {table('Attacco','attacks',['Attacco','Bonus TpC','Danni','Tipo'],4)}
                    <div className="player-wizard-magic-combat">
                        {field('spellAttackBonus',template === 'wizard-pdf' ? <>Bonus di<br />attacco incantesimi</> : 'Bonus attacco incantesimi',{numeric:true})}
                        {field('spellDC',template === 'wizard-pdf' ? <>CD salvezza<br />incantesimi</> : 'CD salvezza incantesimi',{numeric:true})}
                        {template === 'wizard-pdf' && <section className="player-wizard-tradition-uses">
                            <h3>Utilizzi della<br />tradizione arcana</h3>
                            <div className="player-two-fields">{field('arcaneTradition.total','Totali',{numeric:true})}{field('arcaneTradition.used','Usati',{numeric:true})}</div>
                        </section>}
                        <details><summary>{template === 'wizard-pdf' ? 'Privilegi e tratti limitati' : 'Utilizzi della tradizione arcana'}</summary>{table('Privilegi e tratti limitati','limitedTraits',['Nome','Recupero','Totale','Usi'],6)}</details>
                    </div>
                    {box('Incantesimi preferiti',<>{Array.from({length:7},(_,i) => <section className="player-wizard-favorite" key={i}>
                        <div className="player-wizard-favorite-top">{field(`favoriteSpell.${i}.level`,'Liv.',{numeric:true})}{field(`favoriteSpell.${i}.name`,'Nome')}{field(`favoriteSpell.${i}.attack`,'TS / TpC')}{field(`favoriteSpell.${i}.castingTime`,'Tempo di lancio')}</div>
                        <div className="player-wizard-favorite-extra">
                            {template === 'wizard-pdf' ? <><div className="player-wizard-favorite-components" role="group" aria-label={`Componenti dell’incantesimo preferito ${i + 1}`}>{['M','S','V'].map((component) => favoriteComponent(i,component))}</div><details className="player-wizard-favorite-notes"><summary>Extra</summary>{field(`favoriteSpell.${i}.components`,'Componenti / extra')}</details></> : field(`favoriteSpell.${i}.components`,'Componenti / extra')}
                            {check(`favoriteSpell.${i}.ritual`,'Rit.')}{check(`favoriteSpell.${i}.concentration`,'Conc.')}
                        </div>
                        {field(`favoriteSpell.${i}.effect`,'Effetto',{multiline:true})}
                    </section>)}</>,'player-wizard-favorites')}
                </div>
                <div className="player-column player-wizard-right">
                    {box('Recupero Arcano · livello 1',<p className="player-hint">Durante un riposo breve puoi recuperare slot per un totale massimo di {wizardRules(sheet).recoveryBudget} livelli. Nessuno slot può essere di livello 6 o superiore. Puoi usare questo privilegio una volta {details['rules.edition'] === '2024' ? 'per riposo lungo' : 'al giorno'}. Registri il recupero nella pagina Incantesimi.</p>,'player-wizard-recovery')}
                    {wizardPrivilegeLevels.map((level) => level === 2 && details['rules.edition'] === '2024' ? 3 : level).map((level) => <section className="player-box player-wizard-privilege" key={level}>
                        <h3>{level === 18 ? 'Maestria negli incantesimi' : level === 20 ? 'Incantesimi personali' : 'Privilegi della tradizione arcana'}<span className="player-wizard-level">{level}</span></h3>
                        <label className="player-field"><span>{Number(sheet.level) < level ? `Si sblocca al livello ${level}` : 'Privilegi e descrizione'}</span><textarea rows={5} value={featuresAtLevel(details.classFeatures || '',level)} onChange={(e) => detail('classFeatures',updateFeaturesAtLevel(details.classFeatures || '',level,e.target.value))} /></label>
                    </section>)}
                    {box('Slot incantesimo',<>
                        {template === 'wizard-pdf' && <div className="player-wizard-slot-diagram">
                            <div className="player-wizard-slot-caption">Totali</div>
                            {slotCircles('total')}
                            <div className="player-wizard-slot-caption">Lanciati</div>
                            {slotCircles('used')}
                            <div className="player-wizard-spell-count player-wizard-prepared-count"><span>Incantesimi<br />preparati</span><output aria-label="Incantesimi preparati">{selectedSpellCount('prepared')}</output></div>
                            <div className="player-wizard-spell-count player-wizard-cantrip-count"><span>Trucchetti<br />conosciuti</span><output aria-label="Trucchetti conosciuti">{selectedSpellCount('cantrips')}</output></div>
                        </div>}
                        {template === 'wizard-pdf' ? <details data-print="exclude" className="player-wizard-slot-edit"><summary>Modifica conteggi</summary>{slotFields}</details>
                            : <>{slotFields}{selectedMagic && <p className="player-hint">{selectedMagic.prepared} incantesimi preparati · {selectedMagic.cantrips} trucchetti conosciuti</p>}</>}
                    </>,'player-wizard-slot-box')}
                </div>
            </div>}
            {visiblePage === 0 && !wizardTemplate && <div className="player-stat-page">
                <div className="player-column">
                   <div className="player-score-skills">
                        <div className="player-scores">{scores.map((key) => <div className="player-score" key={key}>
                            {field(key, characterFields[key], { base: true })}<output aria-label={`Modificatore ${characterFields[key]}`}>{modifier(key) || '—'}</output>
                        </div>)}</div>
                        <div className="player-column">
                            {box('Ispirazione', check('inspiration', 'Ispirazione'))}
                            {box('Bonus di competenza', field('proficiencyBonus', 'Bonus', { numeric: true }))}
                            {box('Tiri salvezza', scores.map((key) => rollRow(`save.${key}`, characterFields[key], key)))}
                            {box('Abilità', <><div className="player-roll-legend">Competenza · Maestria · Bonus</div>{skills.map(([label, score]) => rollRow(`skill.${label}`, label, score, true))}<p className="player-hint">{automatic ? 'I bonus includono caratteristica e competenza. Seleziona la maestria solo quando concessa da un privilegio; i valori modificati manualmente restano personalizzati.' : 'Il suggerimento mostra il modificatore della caratteristica. Inserisci il bonus totale, comprese competenza e maestria.'}</p></>)}
                        </div>
                    </div>
                    {box('Saggezza (Percezione) passiva', field('passivePerception', 'Percezione passiva', { numeric: true }))}
                    {box('Competenze', <><div className="player-checks">{['Leggere', 'Medie', 'Pesanti', 'Scudi', 'Armi semplici', 'Armi da guerra'].map((label) => check(`proficiency.${label}`, label))}</div>{field('tools', 'Armi aggiuntive e strumenti', { multiline: true })}</>)}
                    {box('Linguaggi', field('languages', 'Linguaggi conosciuti', { multiline: true }))}
                    {box('Talenti', field('feats', 'Talenti', { multiline: true }))}
                </div>
                <div className="player-column">
                    {box('Combattimento', <>
                        <div className="player-combat-top">{field('armorClass', 'CA', { base: true })}{field('temporaryAC', 'CA temporanea', { numeric: true })}{field('initiative', 'Iniziativa predefinita', { base: true, placeholder: initiativeBonus(sheet) })}</div>
                        <div className="player-hitpoints">{field('maxHitPoints', 'PF massimi', { numeric: true, onBlur: clampHitPointsOnMaximumBlur })}{field('hitPoints', 'PF attuali', { base: true })}{field('temporaryHitPoints', 'PF temporanei', { numeric: true })}</div>
                        <div className="player-three-fields">{field('exhaustion', 'Affaticamento', { numeric: true })}{field('vision', 'Visione')}{field('speed', 'Velocità', { base: true })}</div>
                        {check('darkvision', 'Scurovisione')}
                        <div className="player-two-fields">{box('Dadi vita', <div className="player-three-fields">
                            <div className="player-field"><span>DV</span><output>{details.hitDice || '—'}</output></div>
                            <div className="player-field"><span>Totali</span><output>{details.hitDiceTotal || '—'}</output></div>
                            {field('hitDiceUsed', 'Usati', { numeric: true })}
                        </div>)}
                        {box('TS contro morte', <>{['Successi', 'Fallimenti'].map((label) => <div className="player-death" key={label}><span>{label}</span>{[0, 1, 2].map((index) => check(`death.${label}.${index}`, `${label} ${index + 1}`))}</div>)}</>)}</div>
                    </>)}
                    {table('Attacchi e incantesimi', 'attacks', ['Arma / attacco', 'Bonus att.', 'Danni / tipo'], 6)}
                    {table('Munizioni', 'ammunition', ['Munizioni', 'Quantità'], 3)}
                    {box('Equipaggiamento', <>
                        <div className="player-two-fields">{field('armor', 'Armatura')}{field('shield', 'Scudo')}{field('armorDexMax', 'Des massima')}{field('armorStrength', 'Forza richiesta')}</div>
                        {check('armorStealthDisadvantage', 'Svantaggio in Furtività')}
                        <div className="player-coins">{['MR', 'MA', 'ME', 'MO', 'MP'].map((coin) => field(`coins.${coin}`, coin, { numeric: true }))}</div>
                        {field('equipment', 'Equipaggiamento', { multiline: true })}
                        {field('consumables', 'Consumabili e usi', { multiline: true })}
                        {field('attunedItems', 'Oggetti magici armonizzati (massimo 3)', { multiline: true })}
                    </>)}
                </div>
                <div className="player-column">
                    <div className="player-two-fields">{field('madness', 'Livello di follia')}{field('abilityDC', 'CD prova abilità')}</div>
                    {table('Privilegi e tratti limitati', 'limitedTraits', ['Nome', 'Recupero', 'Totale', 'Usi'], 6)}
                    <p className="player-hint">Recupero: RB = riposo breve, RL = riposo lungo, AL = alba.</p>
                    {box('Tratti razziali e privilegi da background', field('racialTraits', 'Tratti e privilegi', { multiline: true }))}
                    {box('Privilegi di classe',field('classFeatures','Privilegi di classe',{multiline:true}),'player-box-grow')}
                    {box('Note', field('notes', 'Note aggiuntive', { base: true, multiline: true }))}
                </div>
            </div>}
            {visiblePage === 1 && <>
                {!wizardTemplate && <>
                <div className="player-six-fields">{['Età', 'Altezza', 'Peso', 'Occhi', 'Carnagione', 'Capelli'].map((label) => field(`appearance.${label}`, label))}</div>
                </>}
                <div className={`player-story-page${wizardTemplate ? ' player-wizard-story' : ''}`}>
                    <div className="player-column">
                        {box('Aspetto del personaggio', <>
                            <div className="player-wizard-portrait-frame"><div className="player-portrait">{details.portrait ? <img src={details.portrait} alt={`Ritratto di ${sheet.name || 'personaggio'}`} /> : <span>Ritratto del personaggio</span>}</div></div>
                            <details className="player-portrait-controls" open={!wizardTemplate}><summary>Modifica ritratto e aspetto</summary>
                            <label data-print="exclude" className="player-field"><span>Carica ritratto (PNG, JPEG o WebP, massimo 2 MB)</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
                                const file = event.target.files?.[0]
                                event.target.value = ''
                                if (!file) return
                                if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
                                    setPortraitError('Scegli un’immagine PNG, JPEG o WebP fino a 2 MB.'); return
                                }
                                const reader = new FileReader()
                                reader.onload = () => { if (typeof reader.result === 'string') { detail('portrait', reader.result); setPortraitError('') } }
                                reader.onerror = () => setPortraitError('Impossibile leggere questa immagine.')
                                reader.readAsDataURL(file)
                            }} /></label>
                            {portraitError && <p role="alert">{portraitError}</p>}
                            {details.portrait && <button type="button" className="end-combat" onClick={() => detail('portrait', '')}>Rimuovi ritratto</button>}
                            {field('appearanceDescription', 'Aspetto', { multiline: true })}
                            </details>
                        </>,'player-wizard-portrait-box')}
                        {box(wizardTemplate ? 'Talenti e tratti aggiuntivi' : 'Tratti e privilegi aggiuntivi', <>{wizardTemplate && field('feats','Talenti',{multiline:true})}{field('additionalTraits','Tratti e privilegi aggiuntivi',{multiline:true})}</>, 'player-box-grow player-wizard-additional')}
                        {wizardTemplate && <>{box('Background',field('backgroundStory','Storia e background',{multiline:true}),'player-wizard-background')}<div className="player-two-fields player-wizard-allies">{box('Alleati',field('faction','Alleati',{multiline:true}))}{box('Nemici',field('personality.Nemici','Nemici',{multiline:true}))}</div></>}
                    </div>
                    <div className="player-column">
                        {!wizardTemplate && box('Fazione', <>{field('factionName', 'Nome')}{field('factionSymbol', 'Simbolo e descrizione', { multiline: true })}{field('faction', 'Fazione e alleati', { multiline: true })}</>)}
                        {wizardTemplate && (template === 'wizard-pdf' ? <div className="player-wizard-personality">{personalityFields}</div> : personalityFields)}
                        {wizardTemplate ? box('Zaino e borse', <>
                            {inventoryRows.map((row,i) => <div className="player-wizard-inventory-row" key={row}>
                                {field(`inventory.${row}.0`,i === 0 ? 'Oggetto' : `Oggetto ${i+1}`)}
                                {field(`inventory.${row}.2`,i === 0 ? 'Qtà' : `Qtà ${i+1}`,{numeric:true})}
                                {template === 'wizard-pdf' && <>
                                    {field(`inventory.${row}.1`,i === 0 ? 'Peso' : `Peso ${i+1}`)}
                                    <label data-field={`inventory.${row}.3`} className="player-field">
                                        <span>{i === 0 ? 'Peso tot' : `Peso totale ${i+1}`}</span>
                                        <input readOnly value={characterFieldValue(sheet, `inventory.${row}.3`)} />
                                    </label>
                                </>}
                            </div>)}
                            {template === 'wizard-pdf' && <div className="player-wizard-weights">
                                {[['carriedWeight', 'Peso trasportato (kg)'], ['maximumWeight', 'Peso massimo (kg)']].map(([key, label]) => <label data-field={key} className="player-field" key={key}>
                                    <span>{label}</span>
                                    <input type="number" min="0" step="any" value={details[key] ?? ''} onChange={(event) => detail(key, event.target.value)} />
                                </label>)}
                            </div>}
                            <div className="player-coins">{['MR','MA','ME','MO','MP'].map((coin) => field(`coins.${coin}`,coin,{numeric:true}))}</div>
                        </>, 'player-wizard-backpack') : table('Inventario','inventory',['Equipaggiamento','Peso'],12)}
                        {!wizardTemplate && <div className="player-two-fields">{field('carriedWeight', 'Peso trasportato (kg)')}{field('maximumWeight', 'Peso massimo trasportabile (kg)')}</div>}
                    </div>
                    <div className="player-column">{!wizardTemplate && ['Tratti caratteriali', 'Ideali', 'Legami', 'Difetti', 'Nemici'].map((label) => <div key={label}>{box(label, field(`personality.${label}`, label, { multiline: true }))}</div>)}
                    {wizardTemplate && box('Oggetti magici / pergamene / pozioni', <>{Array.from({length:12},(_,i) => <section className="player-wizard-item" key={i}><div className="player-wizard-item-heading">{field(`magicItem.${i}.name`,`Nome ${i+1}`)}<div className="player-checks">{check(`magicItem.${i}.equipped`,'Equipaggiato')}{check(`magicItem.${i}.requiresAttunement`,'Richiede sintonia')}{check(`magicItem.${i}.attuned`,'Sintonia attiva')}</div></div>{field(`magicItem.${i}.notes`,'Descrizione e usi',{multiline:true})}</section>)}</>,'player-wizard-magic-items')}
                    </div>
                </div>
            </>}
            {visiblePage === 2 && <>
                {!wizardTemplate && <div className="player-casting">{field('castingClass', 'Classe da incantatore')}{field('castingAbility', 'Caratteristica da incantatore')}{field('spellDC', 'CD tiro salvezza incantesimi', { numeric: true })}{field('spellAttackBonus', 'Bonus attacco incantesimi', { numeric: true })}</div>}
                {magic && <p data-print="exclude" className="player-hint">Trucchetti conosciuti: {magic.cantrips}. {magic.known !== undefined && `Incantesimi ${details['creation.class'] === 'wizard' ? 'nel libro (minimo senza copie aggiuntive)' : magic.edition === '2024' ? 'nella lista preparata' : 'conosciuti'}: ${magic.known}. `}{magic.prepared && `Preparabili: ${magic.preparedLimit}. `}{details['creation.class'] === 'warlock' && 'Gli slot della magia del patto si recuperano con un riposo breve. '}Gli incantesimi di classe seguono i limiti indicati. Razza, oggetti e privilegi hanno una fonte separata; gli usi e le cariche si annotano nel campo dedicato.</p>}
                {selectedMagic && <div data-print="exclude" className="player-hint">{selectedMagic.limits.filter((x) => !x.minimumLevel && !x.exactLevel && (x.maximum > 0 || x.roots.length > 0)).map((x) => <p key={x.id}>{x.label}: <strong>{x.roots.length}/{x.maximum}</strong>. {x.reason}</p>)}</div>}
                {details['creation.class'] === 'druid' && details['creation.subclass'] === 'land' && <label className="player-field"><span>Terra del Circolo</span><select value={details['creation.land'] ?? ''} onChange={(event) => detail('creation.land', event.target.value)}><option value="">Seleziona…</option>{Object.entries(magic?.edition === '2024' ? landNames2024 : landNames2014).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>}
                {savedSpellGrants(sheet).length > 0 && box('Incantesimi concessi da razza e sottoclasse', <ul>{savedSpellGrants(sheet).map((grant) => <li key={`${grant.source}:${grant.index}`}><strong>{spellLabel(grant.name)}</strong> · {grant.note}</li>)}</ul>)}
                {automatic && details.racialSpells && box('Magie razziali (indipendenti dagli slot di classe)', field('racialSpells', 'Incantesimi e usi', { multiline: true }))}
                {exportPage === undefined && !wizardTemplate && data && <WizardSpellcasting sheet={sheet} data={data} onChange={onChange} />}
                <div className="player-spell-page">{[[0, 1, 2], [3, 4, 5], [6, 7, 8, 9]].map((levels, column) => <div className="player-column" key={column}>
                    {levels.map((level) => <section className="player-box player-spell-level" key={level}>
                        <h3><span>{level}</span>{level === 0 ? 'Trucchetti' : `Incantesimi di livello ${level}`}</h3>
                        {selectedMagic?.limits.filter((x) => x.id === `wizard-level-${level}`).map((x) => <p data-print="exclude" className="player-hint" key={x.id}>{x.label}: {x.roots.length}/{x.maximum}. {x.reason}</p>)}
                        {level > 0 && <div className="player-two-fields">{field(`slots.${level}.total`, 'Slot totali', { numeric: true })}{field(`slots.${level}.used`, 'Slot spesi', { numeric: true })}</div>}
                        {Array.from({ length: spellRowCount(level) }, (_, index) => spellRow(level, index))}
                        <button type="button" disabled={spellRowCount(level) >= 500} onClick={() => detail(`spell.rows.${level}`, String(spellRowCount(level) + 1))}>+ Incantesimo</button>
                    </section>)}
                </div>)}</div>
                <p data-print="exclude" className="player-hint">Le spunte selezionano i preparati per le classi che preparano; trucchetti e incantesimi conosciuti sono disponibili automaticamente. Per le altre fonti la spunta indica disponibilità. Solo le magie disponibili compariranno nella card del combattimento: clicca sul nome per aggiungerle alla sezione Abilità.</p>
            </>}
            {visiblePage === 3 && wizardTemplate && <>
                <div className="player-wizard-worn-page" style={{backgroundImage:`url(${import.meta.env?.BASE_URL ?? '/'}templates/mago-equipaggiamento.jpg)`}}>
                    <div className="player-wizard-worn-name">{field('name','Nome del personaggio',{base:true})}</div>
                    <output className="player-wizard-attunements" aria-label="Sintonie attive">{attunedCount} / 3</output>
                    {['Viso','Testa','Collo','Schiena','Corpo','Torso','Mani','Braccia','Vita','Piedi'].map((part) => <div className={`player-worn-slot player-worn-${part.toLowerCase()}`} key={part}>{field(`worn.${part}`,`Oggetti · ${part}`,{multiline:true})}</div>)}
                    {[0,1].map((i) => <div className={`player-worn-slot player-worn-ring-${i}`} key={`ring-${i}`}>{field(`worn.ring.${i}`,`Anello ${i+1}`,{multiline:true})}</div>)}
                    {[0,1,2].map((i) => <div className={`player-worn-slot player-worn-weapon-${i}`} key={`weapon-${i}`}>{field(`worn.weapon.${i}`,`Arma / bastone / bacchetta / scudo ${i+1}`,{multiline:true})}</div>)}
                    {[0,1,2,3].map((i) => <div className={`player-worn-slot player-worn-other-${i}`} key={`other-${i}`}>{field(`worn.other.${i}`,`Pozioni, pergamene, tratti · ${i+1}`,{multiline:true})}</div>)}
                </div>
                <p data-print="exclude" className="player-hint">Le sintonie si gestiscono negli oggetti magici della pagina Personaggio e inventario.</p>
                {attunedCount > 3 && <p role="alert" className="creation-warning">Sono annotate più di tre sintonie attive: verifica gli oggetti e gli eventuali privilegi che aumentano il limite.</p>}
            </>}
            {wizardTemplate && <details data-print="exclude" className="player-box player-wizard-extra"><summary>{visiblePage === 2 ? 'Libro, lancio e gestione degli incantesimi' : 'Regole e campi aggiuntivi'}</summary>
                {visiblePage === 0 && <>
                    <div className="player-three-fields">{data ? originSelect('class','Classe',data.classes,'characterClass') : field('characterClass','Classe',{base:true})}{data && originSelect('subrace','Sottorazza',data.subraces.filter((x) => x.race?.index === selectedOrigins(sheet,data).race?.index))}{field('sex','Sesso')}</div>
                    {automatic && data && <CreationChoices sheet={sheet} data={data} change={detail} />}
                    {automatic && data && <WizardSubclassFeatures sheet={sheet} data={data} onChange={onChange} />}
                    <WizardAdvancement sheet={sheet} onChange={onChange} />
                    {field('classFeatures','Tutti i privilegi di classe',{multiline:true})}
                    {field('madness','Livello di follia')}{field('abilityDC','CD prova abilità')}{field('vision','Visione')}{check('darkvision','Scurovisione')}
                    {table('Munizioni','ammunition',['Munizioni','Quantità'],3)}
                    <div className="player-two-fields">{field('armor','Armatura')}{field('shield','Scudo')}{field('armorDexMax','Des massima')}{field('armorStrength','Forza richiesta')}</div>{check('armorStealthDisadvantage','Svantaggio in Furtività')}
                    {field('equipment','Equipaggiamento',{multiline:true})}{field('consumables','Consumabili e usi',{multiline:true})}{field('attunedItems','Oggetti magici armonizzati',{multiline:true})}{field('notes','Note aggiuntive',{base:true,multiline:true})}
                </>}
                {visiblePage === 1 && <>{field('factionName','Fazione')}{field('factionSymbol','Simbolo e descrizione',{multiline:true})}{table('Pesi inventario','inventory',['Equipaggiamento','Peso'],12)}{field('carriedWeight','Peso trasportato (kg)')}{field('maximumWeight','Peso massimo trasportabile (kg)')}</>}
                {visiblePage === 2 && data && <WizardSpellcasting sheet={sheet} data={data} onChange={onChange} />}
                {visiblePage === 3 && field('attunedItems','Oggetti armonizzati annotati',{multiline:true})}
            </details>}
        </div>
        </div>
        {exportPage === undefined && visiblePage===1 && <nav className="player-inventory-navigation" data-print="exclude" aria-label="Pagine inventario"><button type="button" disabled={shownInventoryPage===0} onClick={() => setInventoryPage(shownInventoryPage-1)}>Oggetti precedenti</button><span> Inventario {shownInventoryPage+1}/{inventoryPages} · {inventory.length} voci </span><button type="button" disabled={shownInventoryPage+1>=inventoryPages} onClick={() => setInventoryPage(shownInventoryPage+1)}>Altri oggetti</button></nav>}
        {exportPage === undefined && data && <InventoryEditor sheet={sheet} data={data} onChange={onChange} target={inventoryTarget} onClose={() => setInventoryTarget(undefined)} />}
        {exportPage === undefined && exporting && <div ref={exportHost} className="player-sheet-export-source" style={{ width: exportWidth }} aria-hidden="true" inert>
            {pages.map((_, index) => <PlayerSheet key={index} sheet={sheet} catalog={catalog} creationData={data} onChange={() => {}} exportPage={index} />)}
            {inventory.length > inventoryRowsPerPage && <section className="sheet-print-inventory"><h1>Inventario completo</h1><p>{sheet.name}</p><table><thead><tr><th>Oggetto</th><th>Qtà</th><th>Peso (kg)</th><th>Peso tot (kg)</th></tr></thead><tbody>{inventory.map((item) => <tr key={item.id || item.row}><td>{item.name || 'Oggetto da completare'}</td><td>{item.quantity || '1'}</td><td>{item.weight || '—'}</td><td>{characterFieldValue(sheet, `inventory.${item.row}.3`) || '—'}</td></tr>)}</tbody></table></section>}
        </div>}
    </div>
}
