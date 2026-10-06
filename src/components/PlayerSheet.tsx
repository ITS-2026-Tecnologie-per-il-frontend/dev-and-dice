import { useId, useState, type ReactNode } from 'react'
import { characterFields, numericCharacterFields, type CharacterSheet } from '../utils/CharacterSheets'
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

export function PlayerSheet({ sheet, onChange }: { sheet: CharacterSheet; onChange: (sheet: CharacterSheet) => void }) {
    const [page, setPage] = useState(0)
    const [portraitError, setPortraitError] = useState('')
    const prefix = useId()
    const details = sheet.playerDetails ?? {}
    function detail(key: string, value: string) {
        onChange({ ...sheet, playerDetails: { ...details, [key]: value } })
    }
    function modifier(score: string) {
        if (!score.trim() || !Number.isSafeInteger(Number(score))) return ''
        const value = Math.floor((Number(score) - 10) / 2)
        return `${value >= 0 ? '+' : ''}${value}`
    }
    function field(key: string, label: string, options: { base?: boolean; multiline?: boolean; numeric?: boolean; placeholder?: string } = {}) {
        const value = options.base ? sheet[key as keyof typeof characterFields] : details[key] ?? ''
        const update = (value: string) => options.base
            ? onChange({ ...sheet, [key]: value }) : detail(key, value)
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
                    {field('characterClass', 'Classe', { base: true })}{field('level', 'Livello', { base: true })}{field('playerName', 'Nome giocatore')}
                    {field('race', 'Razza / specie', { base: true })}{field('background', 'Background')}{field('alignment', 'Allineamento')}
                    {field('sex', 'Sesso')}
                    <label className="player-field"><span>Tipo scheda</span><select value={sheet.kind} onChange={(event) => onChange({ ...sheet, kind: event.target.value })}><option>PG</option><option>Mostro</option><option>PNG</option></select></label>
                </div>
            </header>
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
                            {box('Abilità', <><div className="player-roll-legend">Competenza · Maestria · Bonus</div>{skills.map(([label, score]) => rollRow(`skill.${label}`, label, score, true))}<p className="player-hint">Il suggerimento mostra il modificatore della caratteristica. Inserisci il bonus totale, comprese competenza e maestria.</p></>)}
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
                <div className="player-spell-page">{[[0, 1, 2], [3, 4, 5], [6, 7, 8, 9]].map((levels, column) => <div className="player-column" key={column}>
                    {levels.map((level) => <section className="player-box player-spell-level" key={level}>
                        <h3><span>{level}</span>{level === 0 ? 'Trucchetti' : `Incantesimi di livello ${level}`}</h3>
                        {level > 0 && <div className="player-two-fields">{field(`slots.${level}.total`, 'Slot totali', { numeric: true })}{field(`slots.${level}.used`, 'Slot spesi', { numeric: true })}</div>}
                        {Array.from({ length: level >= 6 ? 6 : 8 }, (_, index) => <div className="player-spell-row" key={index}>
                            {level > 0 && check(`spell.${level}.${index}.prepared`, `Preparato: livello ${level}, incantesimo ${index + 1}`)}
                            <input aria-label={`${level === 0 ? 'Trucchetto' : `Incantesimo livello ${level}`} ${index + 1}`} value={details[`spell.${level}.${index}.name`] ?? ''} onChange={(event) => detail(`spell.${level}.${index}.name`, event.target.value)} />
                        </div>)}
                    </section>)}
                </div>)}</div>
                <p className="player-hint">Spunta gli incantesimi preparati. Le abilità collegate al combattimento si gestiscono nella sezione sotto la scheda.</p>
            </>}
        </div>
        </div>
    </div>
}
