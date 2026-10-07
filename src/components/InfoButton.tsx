import { useId, useRef } from 'react'
import { useDialogDismiss } from '../utils/Dialog.ts'
import type { CatalogEntry } from '../utils/Catalog'

const labels: Record<string, string> = {
    stats: 'Statistiche', abilityScores: 'Caratteristiche', armorClass: 'Classe armatura', hitPoints: 'Punti ferita',
    challengeRating: 'Grado di sfida', warnings: 'Note sui dati', size: 'Taglia', type: 'Tipo', alignment: 'Allineamento',
    challenge: 'Sfida', speed: 'Velocità', savingThrows: 'Tiri salvezza', skills: 'Abilità', senses: 'Sensi', languages: 'Linguaggi',
    strength: 'Forza', dexterity: 'Destrezza', constitution: 'Costituzione', intelligence: 'Intelligenza', wisdom: 'Saggezza', charisma: 'Carisma',
    score: 'Punteggio', modifier: 'Modificatore', englishName: 'Nome inglese', level: 'Livello', school: 'Scuola', ritual: 'Rituale',
    castingTime: 'Tempo di lancio', range: 'Gittata', components: 'Componenti', duration: 'Durata', durationRounds: 'Durata in turni',
    durationInfo: 'Informazioni sulla durata', rounds: 'Turni', concentration: 'Concentrazione', facts: 'Dati dell’abilità',
    attackBonuses: 'Bonus per colpire', saveDCs: 'CD dei tiri salvezza', diceRolls: 'Tiri di dado', remainingTurns: 'Turni rimanenti',
    active: 'Attivata', owner: 'Proprietario', kind: 'Tipo', fixed: 'Fissa', maximum: 'Massima', instantaneous: 'Istantanea',
    conditional: 'Condizionale', sections: 'Dettagli', playtest: 'Playtest', category: 'Categoria', isNpc: 'PNG',
    language: 'Lingua', it: 'Italiano', trait: 'Tratto', action: 'Azione', reaction: 'Reazione', legendary: 'Azione leggendaria',
    damageResistances: 'Resistenze al danno', damageImmunities: 'Immunità al danno',
    conditionImmunities: 'Immunità alle condizioni', damageVulnerabilities: 'Vulnerabilità al danno',
    initiativeModifier: 'Modificatore iniziativa', initiative: 'Iniziativa inserita',
}
function valueText(value: unknown): string {
    if (value === null || value === undefined) return 'Non disponibile'
    if (typeof value === 'boolean') return value ? 'Sì' : 'No'
    if (Array.isArray(value)) return value.length ? value.map(valueText).join(', ') : '—'
    if (typeof value === 'object') return Object.entries(value).map(([key, item]) => `${labels[key] ?? key}: ${valueText(item)}`).join('\n')
    return labels[String(value)] ?? String(value)
}

function creatureDescription(entry: CatalogEntry): string {
    const normalize = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
    const stats = entry.data.stats as Record<string, string> | undefined
    const scores = entry.data.abilityScores as Record<string, { score: number; modifier: number | null }> | undefined
    const repeated = new Map(Object.entries(stats ?? {}).flatMap(([key, value]) => {
        const title = labels[key] ?? key
        return [title, title.replace(' al danno', ' ai danni')].map((label) => [normalize(label), normalize(value)] as const)
    }))
    const blocks = entry.description.split(/\n\s*\n/)
    const remaining: string[] = []
    for (let index = 0; index < blocks.length; index++) {
        const block = blocks[index]
        const stat = repeated.get(normalize(block))
        if (stat !== undefined) {
            let value = ''
            let end = index + 1
            while (end < blocks.length && value.length < stat.length) value = normalize(`${value} ${blocks[end++]}`)
            if (value === stat) { index = end - 1; continue }
        }
        const cells = block.split('|').map((cell) => normalize(cell))
        if (cells.join('|') === 'caratteristica|punteggio|modificatore') continue
        if (cells.length === 3 && Object.entries(scores ?? {}).some(([key, score]) =>
            normalize(labels[key] ?? key) === cells[0] && Number(cells[1]) === score.score && Number(cells[2].replace('−', '-')) === score.modifier,
        )) continue
        remaining.push(block)
    }
    return remaining.join('\n\n').trim()
}

function creatureSections(entry: CatalogEntry) {
    const headings = ['Azioni', 'Reazioni', 'Azioni leggendarie', 'Azioni bonus', 'Azioni di tana']
    const sections: Record<string, string[]> = { Abilità: [] }
    let section = 'Abilità'
    for (const block of creatureDescription(entry).split(/\n\s*\n/)) {
        const heading = headings.find((title) => title.toLocaleLowerCase('it') === block.trim().toLocaleLowerCase('it'))
        if (heading) {
            section = heading
            sections[section] ??= []
        } else if (block.trim()) sections[section].push(block)
    }
    return Object.entries(sections).filter(([, blocks]) => blocks.length > 0)
}

function InfoFields({ values, scores = false }: { values: Record<string, unknown>; scores?: boolean }) {
    return <dl className={`info-fields${scores ? ' info-scores' : ''}`}>{Object.entries(values).map(([key, value]) => (
        <div key={key} className={typeof value === 'string' && value.length > 100 ? 'info-wide' : undefined}>
            <dt>{labels[key] ?? key}</dt><dd>{scores && value && typeof value === 'object' && 'score' in value && 'modifier' in value
                ? `${value.score} (${Number(value.modifier) >= 0 ? '+' : ''}${value.modifier})` : valueText(value)}</dd>
        </div>
    ))}</dl>
}

type Props = { entry?: CatalogEntry; name: string; description?: string; fields?: Record<string, unknown> }
export function InfoButton({ entry, name, description, fields = {} }: Props) {
    const dismissDialog = useDialogDismiss()
    const dialog = useRef<HTMLDialogElement>(null)
    const heading = useId()
    const details = { ...entry?.data, ...fields }
    const grouped = ['abilityScores', 'stats', 'durationInfo', 'facts', 'sections']
    const summary = Object.fromEntries(Object.entries(details).filter(([key]) => ![
        'id', 'name', 'description', 'sourceUrl', 'srdData', 'slug', 'abilityIds', 'creatureId', 'catalogId', 'licenseId', ...grouped,
    ].includes(key)))
    const text = entry?.description || description
    const sections = entry?.type === 'creature' ? creatureSections(entry) : []
    const isLeftSection = (title: string) => title === 'Abilità' || title === 'Azioni leggendarie'
    const columns = [sections.filter(([title]) => isLeftSection(title)), sections.filter(([title]) => !isLeftSection(title))].filter((column) => column.length)
    return (
        <>
            <button type="button" className="more-info" aria-label={`Altro su ${name || 'questa card'}`} onClick={() => dialog.current?.showModal()}>Altro</button>
            <dialog ref={dialog} className="character-dialog info-dialog" aria-labelledby={heading} {...dismissDialog}>
                <div className="dialog-header"><h2 id={heading}>{name || 'Dettagli'}</h2><button autoFocus type="button" className="delete-turn" aria-label="Chiudi dettagli" onClick={() => dialog.current?.close()}>×</button></div>
                {entry && <p className="library-help">{entry.label}</p>}
                <section className="info-section" aria-label="Dati principali"><InfoFields values={summary} /></section>
                {grouped.map((key) => {
                    const values = details[key]
                    if (!values || typeof values !== 'object' || Array.isArray(values)) return null
                    return <section className={`info-section${key === 'sections' ? ' info-prose' : ''}`} key={key}>
                        <h3>{labels[key]}</h3><InfoFields values={values as Record<string, unknown>} scores={key === 'abilityScores'} />
                    </section>
                })}
                {text && !details.sections && (entry?.type === 'creature' ? (
                    <div className="info-ability-sections">{columns.map((column, index) => (
                        <div className="info-ability-column" key={index}>{column.map(([title, blocks]) => (
                        <section className="info-section info-panel" key={title} aria-label={title}>
                            <h3>{title}</h3><p className="info-description">{blocks.join('\n\n')}</p>
                        </section>
                        ))}</div>
                    ))}</div>
                ) : <section className="info-section"><h3>Descrizione</h3><p className="info-description">{text}</p></section>)}
                {entry && !entry.description && <p>La descrizione completa non è disponibile per questa voce. Puoi consultare la fonte.</p>}
                {entry && <a href={entry.sourceUrl} target="_blank" rel="noreferrer">Apri la fonte originale</a>}
            </dialog>
        </>
    )
}
