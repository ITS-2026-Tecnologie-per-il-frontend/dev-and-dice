import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { characterFields, numericCharacterFields, type CharacterSheet } from '../utils/CharacterSheets'
import { applyCreation, creationEnabled, enableCreation, labelOf, loadCreationData, resetCreationOverrides, selectedOrigins, spellRules, spellSelection, type CreationData, type Origin } from '../utils/PlayerCreation'
import { CreationChoices, CreationStatus } from './PlayerCreation'
import { spellRowState, spellSources, savedSpellGrants, landNames2014, landNames2024 } from '../utils/Spellcasting'
import { CatalogSearch } from './CatalogSearch'
import { type Catalog } from '../utils/Catalog'
import '../PlayerSheet.css'

const scores = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const
const skills = [
    ['Acrobazia', 'dexterity'], ['Addestrare animali', 'wisdom'], ['Arcano', 'intelligence'],
    ['Atletica', 'strength'], ['Furtività', 'dexterity'], ['Indagare', 'intelligence'],
    ['Inganno', 'charisma'], ['Intimidire', 'charisma'], ['Intrattenere', 'charisma'],
    ['Intuizione', 'wisdom'], ['Medicina', 'wisdom'], ['Natura', 'intelligence'],
    ['Percezione', 'wisdom'], ['Persuasione', 'charisma'], ['Rapidità di mano', 'dexterity'],
    ['Religione', 'intelligence'], ['Sopravvivenza', 'wisdom'], ['Storia', 'intelligence'],
] as const

export function PlayerSheet({ sheet, catalog, onChange: emitChange }: { sheet: CharacterSheet; catalog?: Catalog; onChange: (sheet: CharacterSheet) => void }) {
    const [page, setPage] = useState(0)
    const [portraitError, setPortraitError] = useState('')
    const [rawData, setData] = useState<CreationData>()
    const data = useMemo(() => {
        if (!rawData) return undefined
        const translated = new Map(catalog?.abilities.filter((x) => typeof x.data.level === 'number').flatMap((x) => (Array.isArray(x.data.aliases) ? x.data.aliases : [x.name]).filter((name): name is string => typeof name === 'string').map((name) => [name.toLowerCase(), x.name] as const)))
        return { ...rawData, spells: rawData.spells.map((x) => ({ ...x, nameIt: translated.get(x.name.toLowerCase()) })) }
    }, [rawData, catalog])
    const [dataError, setDataError] = useState('')
    const [retry, setRetry] = useState(0)
    useEffect(() => {
        let active = true
        loadCreationData().then((value) => { if (active) { setData(value); setDataError('') } }).catch(() => { if (active) setDataError('Impossibile caricare le opzioni di creazione. Puoi continuare a compilare manualmente.') })
        return () => { active = false }
    }, [retry])
    const prefix = useId()
    const details = sheet.playerDetails ?? {}
    const automatic = creationEnabled(sheet) && !!data
    const magic = data && automatic ? spellRules(sheet, data) : undefined
    function spellLabel(name: string) {
        return catalog?.abilities.find((entry) => typeof entry.data.level === 'number' && Array.isArray(entry.data.aliases)
            && entry.data.aliases.some((alias) => typeof alias === 'string' && alias.toLowerCase() === name.toLowerCase()))?.name ?? name
    }
    const selectedMagic = data && automatic ? spellSelection({ ...sheet, playerDetails: Object.fromEntries(Object.entries(details).map(([key, value]) => [key, /^spell\.\d+\.\d+\.name$/.test(key) ? spellLabel(value) : value])) }, data) : undefined
    function onChange(next: CharacterSheet) {
        emitChange(data ? applyCreation(next, data) : next)
    }
    function updateBase(key: string, value: string) {
        if (automatic && scores.includes(key as typeof scores[number])) {
            const bonus = Number(sheet[key as typeof scores[number]]) - Number(details[`creation.base.${key}`] || 0)
            onChange({ ...sheet, playerDetails: { ...details, [`creation.base.${key}`]: value === '' ? '' : String(Number(value) - bonus) } })
        } else onChange({ ...sheet, [key]: value, playerDetails: { ...details, ...(automatic && ['armorClass', 'speed'].includes(key) ? { [`creation.override.base.${key}`]: 'true' } : {}) } })
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
            if (kind === 'background') nextDetails.background = origin ? labelOf(origin) : value
            const next = { ...sheet, ...(base ? { [base]: origin ? labelOf(origin) : value } : {}), playerDetails: nextDetails }
            onChange(origin && data ? enableCreation(next, data) : next)
        }}><option value="">{value ? `Personalizzato: ${value}` : 'Seleziona…'}</option>{options.map((x) => <option key={x.index} value={x.index}>{labelOf(x)}</option>)}</select>
        {!options.some((x) => x.index === details[key]) && <input aria-label={`${label} personalizzato`} value={value} placeholder="Valore personalizzato" onChange={(event) => base ? updateBase(base, event.target.value) : detail(kind, event.target.value)} />}</label>
    }
    function detail(key: string, value: string) {
        onChange({ ...sheet, playerDetails: { ...details, [key]: value, ...(automatic && details[`creation.auto.${key}`] !== undefined ? { [`creation.override.${key}`]: 'true' } : {}) } })
    }
    function modifier(score: string) {
        if (!score.trim() || !Number.isSafeInteger(Number(score))) return ''
        const value = Math.floor((Number(score) - 10) / 2)
        return `${value >= 0 ? '+' : ''}${value}`
    }
    function field(key: string, label: string, options: { base?: boolean; multiline?: boolean; numeric?: boolean; placeholder?: string } = {}) {
        const value = options.base ? sheet[key as keyof typeof characterFields] : details[key] ?? ''
        const update = (value: string) => options.base
            ? updateBase(key, value) : detail(key, value)
        const numeric = options.numeric || (options.base && (numericCharacterFields as readonly string[]).includes(key))
        return <label className={`player-field${options.multiline ? ' player-field-prose' : ''}`} key={key}>
            <span>{label}</span>
            {options.multiline
                ? <textarea rows={4} value={value} onChange={(event) => update(event.target.value)} placeholder={options.placeholder} />
                : <input type={numeric ? 'number' : 'text'} step={numeric ? '1' : undefined} required={options.base && key === 'name'} pattern={options.base && key === 'name' ? '.*\\S.*' : undefined} value={value} onChange={(event) => update(event.target.value)} placeholder={options.placeholder} />}
        </label>
    }
    function box(title: string, children: ReactNode, className = '') {
        return <section className={`player-box ${className}`}><h3>{title}</h3>{children}</section>
    }
    function check(key: string, label: string) {
        return <label className="player-check" key={key}><input type="checkbox" aria-label={label} checked={details[key] === 'true'} onChange={(event) => detail(key, String(event.target.checked))} /><span>{label}</span></label>
    }
    function spellRow(level: number, index: number) {
        const root = `spell.${level}.${index}`
        const state = spellRowState(sheet, level, index)
        const name = spellLabel(details[`${root}.name`] ?? '')
        const limit = state.needsPreparation && magic?.prepared && selectedMagic && selectedMagic.prepared >= magic.preparedLimit && !state.checked
        const choices = state.source === 'arcanum' ? (magic?.arcanumLevels.includes(level) ? data?.spells.filter((x) => x.level === level && x.classes.some((c) => c.index === 'warlock')) ?? [] : [])
            : ['secrets', 'lore'].includes(state.source) ? data?.spells.filter((x) => x.level === level && level <= (magic?.maxLevel ?? 0) && (magic?.edition !== '2024' || state.source === 'lore' || x.classes.some((c) => ['bard', 'cleric', 'druid', 'wizard'].includes(c.index)))) ?? []
            : magic?.spells.filter((x) => x.level === level) ?? []
        const fullKnown = state.countsKnown && selectedMagic && selectedMagic.knownLimit !== undefined && details['creation.class'] !== 'wizard'
            && selectedMagic.spells >= selectedMagic.knownLimit
        const fullCantrips = state.countsCantrip && selectedMagic && magic && selectedMagic.cantrips >= magic.cantrips
        const fullLore = state.source === 'lore' && Object.entries(details).filter(([key, value]) => /^spell\.\d+\.\d+\.name$/.test(key) && value.trim() && spellRowState(sheet, Number(key.split('.')[1]), Number(key.split('.')[2])).source === 'lore').length >= 2
        const fullArcanum = state.source === 'arcanum' && Object.entries(details).some(([key, value]) => key.startsWith(`spell.${level}.`) && key.endsWith('.name') && key !== `${root}.name` && value.trim() && spellRowState(sheet, level, Number(key.split('.')[2])).source === 'arcanum')
        const label = state.needsPreparation ? 'Preparato' : state.canToggle ? 'Disponibile' : level === 0 ? 'Trucchetto conosciuto' : magic?.edition === '2024' ? 'Preparato nella lista di classe' : 'Conosciuto / sempre disponibile'
        return <div className="player-spell-entry" key={index}>
            <div className="player-spell-row">
                <label className="player-check"><input type="checkbox" aria-label={`${label}: livello ${level}, incantesimo ${index + 1}`} title={label}
                    checked={!!name && state.checked} disabled={!name || !state.canToggle || !!limit}
                    onChange={(event) => detail(state.checkboxKey, String(event.target.checked))} /><span>{label}</span></label>
                {magic && ['class', 'arcanum', 'secrets', 'lore'].includes(state.source) ? <select aria-label={`Incantesimo livello ${level}, ${index + 1}`} value={name}
                    onChange={(event) => onChange({ ...sheet, playerDetails: { ...details, [`${root}.name`]: event.target.value, [`${root}.index`]: choices.find((x) => labelOf(x) === event.target.value)?.index ?? '', [`${root}.prepared`]: 'false' } })}>
                    <option value="">Seleziona…</option>
                    {name && !choices.some((x) => labelOf(x) === name) && <option value={name}>{name} (verifica con il DM)</option>}
                    {choices.map((x) => <option key={x.index} value={labelOf(x)} disabled={Object.entries(details).some(([key, value]) => key.startsWith('spell.') && key.endsWith('.name') && key !== `${root}.name` && spellLabel(value) === labelOf(x) && spellRowState(sheet, Number(key.split('.')[1]), Number(key.split('.')[2])).source === state.source)
                        || (!name && !!(fullKnown || fullCantrips || fullArcanum || fullLore))}>{labelOf(x)}</option>)}
                </select> : <CatalogSearch aria-label={`Incantesimo livello ${level}, ${index + 1}`} value={name}
                    entries={catalog?.abilities.filter((entry) => entry.data.level === level) ?? []}
                    onChange={(value) => detail(`${root}.name`, value)} onSelect={(entry) => detail(`${root}.name`, entry.name)} />}
            </div>
            <div className="player-spell-source">
                <select aria-label={`Fonte dell’incantesimo livello ${level}, ${index + 1}`} value={state.source} onChange={(event) => detail(`${root}.source`, event.target.value)}>
                    {Object.entries(spellSources).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
                {!['class', 'arcanum', 'secrets', 'lore'].includes(state.source) && <input aria-label={`Fonte e usi dell’incantesimo ${index + 1} di livello ${level}`} placeholder="Fonte e usi / cariche" value={details[`${root}.note`] ?? ''} onChange={(event) => detail(`${root}.note`, event.target.value)} />}
            </div>
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
            <input type="number" step="1" aria-label={`Bonus ${label}`} value={details[key] ?? ''} placeholder={modifier(sheet[score])} onChange={(event) => detail(key, event.target.value)} />
            <span>{label} {mastery && <small>({characterFields[score].slice(0, 3)})</small>}</span>
        </div>
    }
    function table(title: string, key: string, columns: string[], count: number) {
        return box(title, <div className="player-table-scroll"><table className="player-table">
            <thead><tr>{columns.map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
            <tbody>{Array.from({ length: count }, (_, row) => <tr key={row}>{columns.map((label, column) => <td key={column}>
                <input aria-label={`${title}: ${label}, riga ${row + 1}`} value={details[`${key}.${row}.${column}`] ?? ''} onChange={(event) => detail(`${key}.${row}.${column}`, event.target.value)} />
            </td>)}</tr>)}</tbody>
        </table></div>)
    }

    return <div className="player-sheet">
        {data ? <CreationStatus sheet={sheet} enable={() => emitChange(enableCreation(sheet, data))} disable={() => emitChange({ ...sheet, playerDetails: { ...details, 'creation.enabled': 'false' } })} /> : <p className="player-hint" role="status">{dataError || 'Caricamento opzioni del personaggio…'}{dataError && <button type="button" onClick={() => setRetry(retry + 1)}>Riprova</button>}</p>}
        {automatic && data && <button type="button" onClick={() => emitChange(resetCreationOverrides(sheet, data))}>Ripristina i campi generati (annulla le loro modifiche manuali)</button>}
        <div className="player-sheet-tabs" role="tablist" aria-label="Pagine della scheda">
            {['Statistiche e combattimento', 'Personaggio e inventario', 'Incantesimi'].map((label, index) => <button
                key={label} type="button" role="tab" id={`${prefix}-tab-${index}`} aria-selected={page === index} aria-controls={`${prefix}-page`}
                tabIndex={page === index ? 0 : -1} onClick={() => setPage(index)}
                onKeyDown={(event) => {
                    let next = index
                    if (event.key === 'ArrowRight') next = (index + 1) % 3
                    else if (event.key === 'ArrowLeft') next = (index + 2) % 3
                    else if (event.key === 'Home') next = 0
                    else if (event.key === 'End') next = 2
                    else return
                    event.preventDefault(); setPage(next)
                    document.getElementById(`${prefix}-tab-${next}`)?.focus()
                }}
            >{index + 1}. {label}</button>)}
        </div>
        <div className="player-paper-viewport" tabIndex={0}>
        <div className={`player-paper${page === 0 ? ' player-paper-statistics' : ''}`} role="tabpanel" id={`${prefix}-page`} aria-labelledby={`${prefix}-tab-${page}`}>
            <header className="player-identity">
                <div className="player-name"><span className="player-brand">DUNGEONS & DRAGONS</span>{field('name', 'Nome personaggio', { base: true })}</div>
                <div className="player-identity-fields">
                    {data ? originSelect('class', 'Classe', data.classes, 'characterClass') : field('characterClass', 'Classe', { base: true })}
                    {data && originSelect('subclass', 'Sottoclasse SRD', data.subclasses.filter((x) => x.class?.index === details['creation.class'] && data.features.some((f) => f.subclass?.index === x.index && f.level <= Number(sheet.level))))}
                    {automatic ? <label className="player-field"><span>Livello</span><select value={sheet.level} onChange={(event) => updateBase('level', event.target.value)}>{Array.from({ length: 20 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select></label> : field('level', 'Livello', { base: true })}{field('playerName', 'Nome giocatore')}
                    {data ? originSelect('race', 'Razza / specie', data.races, 'race') : field('race', 'Razza / specie', { base: true })}
                    {data && originSelect('subrace', 'Sottorazza', data.subraces.filter((x) => x.race?.index === selectedOrigins(sheet, data).race?.index))}
                    {data ? originSelect('background', 'Background', data.backgrounds) : field('background', 'Background')}
                    {data ? <label className="player-field"><span>Allineamento</span><select value={details.alignment ?? ''} onChange={(event) => detail('alignment', event.target.value)}><option value="">Seleziona…</option>{details.alignment && !data.alignments.some((x) => labelOf(x) === details.alignment) && <option>{details.alignment}</option>}{data.alignments.map((x) => <option key={x.index}>{labelOf(x)}</option>)}</select></label> : field('alignment', 'Allineamento')}
                    {field('sex', 'Sesso')}
                    <label className="player-field"><span>Tipo scheda</span><select value={sheet.kind} onChange={(event) => onChange({ ...sheet, kind: event.target.value })}><option>PG</option><option>Mostro</option><option>PNG</option></select></label>
                </div>
            </header>
            {automatic && data && <CreationChoices sheet={sheet} data={data} change={detail} />}
            {page === 0 && <div className="player-stat-page">
                <div className="player-column">
                    <div className="player-score-skills">
                        <div className="player-scores">{scores.map((key) => <div className="player-score" key={key}>
                            {field(key, characterFields[key], { base: true })}<output aria-label={`Modificatore ${characterFields[key]}`}>{modifier(sheet[key]) || '—'}</output>
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
                        <div className="player-combat-top">{field('armorClass', 'CA', { base: true })}{field('temporaryAC', 'CA temporanea', { numeric: true })}{field('initiative', 'Iniziativa predefinita', { base: true, placeholder: modifier(sheet.dexterity) })}</div>
                        <div className="player-hitpoints">{field('maxHitPoints', 'PF massimi', { numeric: true })}{field('hitPoints', 'PF attuali', { base: true })}{field('temporaryHitPoints', 'PF temporanei', { numeric: true })}</div>
                        <div className="player-three-fields">{field('exhaustion', 'Affaticamento', { numeric: true })}{field('vision', 'Visione')}{field('speed', 'Velocità', { base: true })}</div>
                        {check('darkvision', 'Scurovisione')}
                        <div className="player-two-fields">{box('Dadi vita', <div className="player-three-fields">{field('hitDice', 'DV')}{field('hitDiceTotal', 'Totali', { numeric: true })}{field('hitDiceUsed', 'Usati', { numeric: true })}</div>)}
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
                    {box('Privilegi di classe', field('classFeatures', 'Privilegi di classe', { multiline: true }), 'player-box-grow')}
                    {box('Note', field('notes', 'Note aggiuntive', { base: true, multiline: true }))}
                </div>
            </div>}
            {page === 1 && <>
                <div className="player-six-fields">{['Età', 'Altezza', 'Peso', 'Occhi', 'Carnagione', 'Capelli'].map((label) => field(`appearance.${label}`, label))}</div>
                <div className="player-story-page">
                    <div className="player-column">
                        {box('Aspetto del personaggio', <>
                            <div className="player-portrait">{details.portrait ? <img src={details.portrait} alt={`Ritratto di ${sheet.name || 'personaggio'}`} /> : <span>Ritratto del personaggio</span>}</div>
                            <label className="player-field"><span>Carica ritratto (PNG, JPEG o WebP, massimo 2 MB)</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
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
                        </>)}
                        {box('Tratti e privilegi aggiuntivi', field('additionalTraits', 'Tratti e privilegi aggiuntivi', { multiline: true }), 'player-box-grow')}
                    </div>
                    <div className="player-column">
                        {box('Fazione', <>{field('factionName', 'Nome')}{field('factionSymbol', 'Simbolo e descrizione', { multiline: true })}{field('faction', 'Fazione e alleati', { multiline: true })}</>)}
                        {table('Inventario', 'inventory', ['Equipaggiamento', 'Peso'], 12)}
                        <div className="player-two-fields">{field('carriedWeight', 'Peso trasportato (kg)')}{field('maximumWeight', 'Peso massimo trasportabile (kg)')}</div>
                    </div>
                    <div className="player-column">{['Tratti caratteriali', 'Ideali', 'Legami', 'Difetti', 'Nemici'].map((label) => <div key={label}>{box(label, field(`personality.${label}`, label, { multiline: true }))}</div>)}</div>
                </div>
            </>}
            {page === 2 && <>
                <div className="player-casting">{field('castingClass', 'Classe da incantatore')}{field('castingAbility', 'Caratteristica da incantatore')}{field('spellDC', 'CD tiro salvezza incantesimi', { numeric: true })}{field('spellAttackBonus', 'Bonus attacco incantesimi', { numeric: true })}</div>
                {magic && <p className="player-hint">Trucchetti conosciuti: {magic.cantrips}. {magic.known !== undefined && `Incantesimi ${details['creation.class'] === 'wizard' ? 'nel libro (minimo senza copie aggiuntive)' : magic.edition === '2024' ? 'nella lista preparata' : 'conosciuti'}: ${magic.known}. `}{magic.prepared && `Preparabili: ${magic.preparedLimit}. `}{details['creation.class'] === 'warlock' && 'Gli slot della magia del patto si recuperano con un riposo breve. '}Gli incantesimi di classe seguono i limiti indicati. Razza, oggetti e privilegi hanno una fonte separata; gli usi e le cariche si annotano nel campo dedicato.</p>}
                {selectedMagic && <p className="player-hint">Selezionati: {selectedMagic.cantrips} trucchetti, {selectedMagic.spells} incantesimi, {selectedMagic.prepared} preparati, {selectedMagic.extra} da altre fonti.</p>}
                {selectedMagic && selectedMagic.issues.length > 0 && <p className="creation-warning" role="alert">{selectedMagic.issues.join(' ')}</p>}
                {details['creation.class'] === 'druid' && details['creation.subclass'] === 'land' && <label className="player-field"><span>Terra del Circolo</span><select value={details['creation.land'] ?? ''} onChange={(event) => detail('creation.land', event.target.value)}><option value="">Seleziona…</option>{Object.entries(magic?.edition === '2024' ? landNames2024 : landNames2014).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>}
                {savedSpellGrants(sheet).length > 0 && box('Incantesimi concessi da razza e sottoclasse', <ul>{savedSpellGrants(sheet).map((grant) => <li key={`${grant.source}:${grant.index}`}><strong>{spellLabel(grant.name)}</strong> · {grant.note}</li>)}</ul>)}
                {automatic && details.racialSpells && box('Magie razziali (indipendenti dagli slot di classe)', field('racialSpells', 'Incantesimi e usi', { multiline: true }))}
                <div className="player-spell-page">{[[0, 1, 2], [3, 4, 5], [6, 7, 8, 9]].map((levels, column) => <div className="player-column" key={column}>
                    {levels.map((level) => <section className="player-box player-spell-level" key={level}>
                        <h3><span>{level}</span>{level === 0 ? 'Trucchetti' : `Incantesimi di livello ${level}`}</h3>
                        {level > 0 && <div className="player-two-fields">{field(`slots.${level}.total`, 'Slot totali', { numeric: true })}{field(`slots.${level}.used`, 'Slot spesi', { numeric: true })}</div>}
                        {Array.from({ length: spellRowCount(level) }, (_, index) => spellRow(level, index))}
                        <button type="button" disabled={spellRowCount(level) >= 500} onClick={() => detail(`spell.rows.${level}`, String(spellRowCount(level) + 1))}>+ Incantesimo</button>
                    </section>)}
                </div>)}</div>
                <p className="player-hint">Le spunte selezionano i preparati per le classi che preparano; trucchetti e incantesimi conosciuti sono disponibili automaticamente. Per le altre fonti la spunta indica disponibilità. Solo le magie disponibili compariranno nella card del combattimento: clicca sul nome per aggiungerle alla sezione Abilità.</p>
            </>}
        </div>
        </div>
    </div>
}
