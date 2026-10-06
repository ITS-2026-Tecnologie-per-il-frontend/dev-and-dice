import { type ReactNode } from 'react'
import { characterFields, type CharacterSheet } from '../utils/CharacterSheets'
import { abilityKeys, creationChoices, creationEnabled, labelOf, optionsFor, optionLabel, selectedOrigins, resolveChoice, type Choice, type Option, type CreationData } from '../utils/PlayerCreation'

export function CreationChoices({ sheet, data, change }: { sheet: CharacterSheet; data: CreationData; change: (key: string, value: string) => void }) {
    const d = sheet.playerDetails ?? {}
    function nested(option: Option, path: string): ReactNode {
        if (option.choice) return choiceFields(option.choice, `${path}.nested`, 'Dettaglio della scelta')
        return option.items?.map((item, i) => <div key={i}>{nested(item, `${path}.item.${i}`)}</div>)
    }
    function choiceFields(choice: Choice, path: string, title: string): ReactNode {
        const options = optionsFor(choice, data)
        return <fieldset className="creation-choice" key={path}><legend>{title} — scegli {choice.choose}</legend>
            {Array.from({ length: choice.choose }, (_, i) => {
                const key = `${path}.${i}`
                const selected = options[Number(d[key])]
                const others = Array.from({ length: choice.choose }, (_, j) => j !== i ? d[`${path}.${j}`] : undefined)
                return <div key={key}><label className="player-field"><span>Scelta {i + 1}</span><select value={d[key] ?? ''} onChange={(event) => change(key, event.target.value)}>
                    <option value="">Seleziona…</option>
                    {options.map((option, j) => <option key={j} value={j} disabled={choice.type !== 'equipment' && others.includes(String(j))}>{optionLabel(option)}</option>)}
                </select></label>{d[key] !== undefined && d[key] !== '' && selected && nested(selected, `${key}.option.${d[key]}`)}</div>
            })}
        </fieldset>
    }
    const { characterClass, race, subrace } = selectedOrigins(sheet, data)
    const choices = creationChoices(sheet, data)
    const equipment = [characterClass, selectedOrigins(sheet, data).background].flatMap((x) => x?.starting_equipment?.map((item) => item.equipment.index) ?? [])
    choices.filter((x) => x.choice.type === 'equipment').forEach(({ choice, path }) => equipment.push(...resolveChoice(choice, path, d, data).map((x) => x.ref.index)))
    const armors = data.equipment.filter((x) => equipment.includes(x.index) && x.armor_class && x.armor_category !== 'Shield')
    return <details className="creation-panel" open={!characterClass || !race}>
        <summary>Creazione guidata · caratteristiche e scelte iniziali</summary>
        <p className="player-hint">D&D 5e 2014, opzioni SRD. I punteggi qui sotto sono quelli prima dei bonus razziali; nella scheda compare il totale. PF ai livelli successivi calcolati con il valore fisso. Puoi modificare i campi generati per applicare regole del DM, talenti e privilegi con condizioni particolari.</p>
        <div className="creation-scores">{abilityKeys.map((key) => <label className="player-field" key={key}><span>{characterFields[key]} base</span><input type="number" step="1" min="1" max="30" value={d[`creation.base.${key}`] ?? ''} onChange={(event) => change(`creation.base.${key}`, event.target.value)} /><small>Totale: {sheet[key] || '—'}{race || subrace ? ` (bonus +${Number(sheet[key]) - Number(d[`creation.base.${key}`] || 0)})` : ''}</small></label>)}</div>
        <p className="player-hint">Array standard: 15, 14, 13, 12, 10, 8. Gli incrementi ai livelli superiori e i talenti si applicano ai punteggi base dopo aver scelto con il DM.</p>
        <div className="creation-options">{choices.map(({ choice, path, label }) => choiceFields(choice, path, label))}</div>
        <div className="player-two-fields"><label className="player-field"><span>Armatura indossata (tra gli oggetti iniziali)</span><select value={armors.some((x) => x.index === d['creation.armor']) ? d['creation.armor'] : ''} onChange={(event) => change('creation.armor', event.target.value)}><option value="">Senza armatura</option>{armors.map((x) => <option key={x.index} value={x.index}>{labelOf(x)}</option>)}</select></label>
        <label className="player-check"><input type="checkbox" checked={d['creation.shield'] === 'true' && equipment.includes('shield')} disabled={!equipment.includes('shield')} onChange={(event) => change('creation.shield', String(event.target.checked))} /><span>Scudo equipaggiato (+2 CA)</span></label></div>
        <p className="player-hint">Le scelte incompiute possono essere salvate e completate in seguito. Le competenze duplicate si sostituiscono scegliendone un’altra con il DM. Multiclasse, magie di sottoclasse, tratti condizionali e opzioni fuori SRD si compilano manualmente. I privilegi della sottoclasse scelta compaiono nella scheda; solo Robustezza draconica e competenza nelle armature del Dominio della Vita aggiornano qui i valori.</p>
    </details>
}

export function CreationStatus({ sheet, enable, disable }: { sheet: CharacterSheet; enable: () => void; disable: () => void }) {
    return <div className="creation-status"><span>{creationEnabled(sheet) ? 'Calcoli automatici attivi · D&D 5e 2014' : 'Scheda manuale'}</span>
        <button type="button" onClick={creationEnabled(sheet) ? disable : enable}>{creationEnabled(sheet) ? 'Passa a compilazione manuale' : 'Attiva creazione guidata'}</button>
        {!creationEnabled(sheet) && <small>Alla prima attivazione i punteggi attuali saranno usati come base, prima dei bonus razziali. Controllali se la scheda è già compilata. Riattivando vengono conservati i bonus già applicati.</small>}
    </div>
}
