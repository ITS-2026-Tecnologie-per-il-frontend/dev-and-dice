import { type ReactNode } from 'react'
import { characterFields, type CharacterSheet } from '../utils/CharacterSheets'
import { abilityKeys, creationChoices, creationEnabled, labelOf, optionsFor, optionLabel, selectedOrigins, resolveChoice, type Choice, type Option, type CreationData } from '../utils/PlayerCreation'
import { inventoryEquipment, inventoryReferenceKey, ownedInventoryItems, referencedInventoryItem } from '../utils/Inventory'
import { spellEdition } from '../utils/Spellcasting'

export function CreationChoices({ sheet, data, change, choices: suppliedChoices, section }: { sheet: CharacterSheet; data: CreationData; change: (key: string, value: string) => void; choices?: ReturnType<typeof creationChoices>; section?: 'scores' | 'choices' | 'equipment' }) {
    const d = sheet.playerDetails ?? {}
    function nested(option: Option, path: string, expertise: boolean): ReactNode {
        if (option.choice) return choiceFields(option.choice, `${path}.nested`, 'Dettaglio della scelta', expertise)
        return option.items?.map((item, i) => <div key={i}>{nested(item, `${path}.item.${i}`, expertise)}</div>)
    }
    function choiceFields(choice: Choice, path: string, title: string, expertise = choice.type === 'expertise'): ReactNode {
        const options = optionsFor(choice, data)
        const origins = selectedOrigins(sheet,data)
        const knownSkills = new Set([
            ...[origins.characterClass,origins.race,origins.subrace,origins.background].flatMap((x) => [...(x?.proficiencies ?? []), ...(x?.starting_proficiencies ?? [])]).map((x) => x.index),
            ...[...(origins.race?.traits ?? []), ...(origins.subrace?.racial_traits ?? [])].flatMap((ref) => data.traits.find((x) => x.index === ref.index)?.proficiencies ?? []).map((x) => x.index),
            ...creationChoices(sheet,data).filter((x) => ['proficiencies','proficiency'].includes(x.choice.type) && x.path !== path).flatMap((x) => resolveChoice(x.choice,x.path,d,data).map((r) => r.ref.index)),
        ])
        const knownLanguages = choice.type === 'languages' ? new Set([
            ...(selectedOrigins(sheet,data).race?.languages ?? []).map((x) => x.index),
            ...creationChoices(sheet,data).filter((x) => x.choice.type === 'languages' && x.path !== path).flatMap((x) => resolveChoice(x.choice,x.path,d,data).map((r) => r.ref.index)),
        ]) : new Set<string>()
        return <fieldset className="creation-choice" key={path}><legend>{title} — scegli {choice.choose}</legend>
            {Array.from({ length: choice.choose }, (_, i) => {
                const key = `${path}.${i}`
                const selected = d[key] !== undefined && d[key] !== '' ? options[Number(d[key])] : undefined
                const others = Array.from({ length: choice.choose }, (_, j) => j !== i ? d[`${path}.${j}`] : undefined)
                return <div key={key}><label className="player-field"><span>Scelta {i + 1}</span><select value={d[key] ?? ''} onChange={(event) => change(key, event.target.value)}>
                    <option value="">Seleziona…</option>
                    {options.map((option, j) => {
                        const skill = data.skills.find((x) => option.item?.index === `skill-${x.index}`)
                        if (expertise && skill && d[skill.playerDetailsKeys.proficient] !== 'true' && d[key] !== String(j)) return null
                        const alreadyKnown = !expertise && skill && knownSkills.has(option.item!.index)
                        return <option key={j} value={j} disabled={choice.type !== 'equipment' && others.includes(String(j)) || choice.type === 'languages' && knownLanguages.has(option.item?.index ?? '') && d[key] !== String(j) || !!alreadyKnown && d[key] !== String(j)}>{skill ? labelOf(skill) : optionLabel(option)}{alreadyKnown ? ' · già concessa da un’altra origine' : ''}</option>
                    })}
                </select></label>{!expertise && selected?.item?.index.startsWith('skill-') && knownSkills.has(selected.item.index) && <p className="creation-choice-warning" role="status">Questa abilità è già concessa da un’altra origine. Scegli un’altra abilità dal menu qui sopra.</p>}{d[key] !== undefined && d[key] !== '' && selected && nested(selected, `${key}.option.${d[key]}`, expertise)}</div>
            })}
        </fieldset>
    }
    const { characterClass, race, subrace } = selectedOrigins(sheet, data)
    const choices = suppliedChoices ?? creationChoices(sheet, data)
    const equipment = ownedInventoryItems(sheet)
    const armors = equipment.filter((x) => {const item=inventoryEquipment(x,sheet,data);return item?.armor_class && item.armor_category!=='Shield'})
    const shields=equipment.filter((x) => inventoryEquipment(x,sheet,data)?.armor_category==='Shield')
    const choiceContent = <div className="creation-options">{choices.map(({ choice, path, label }) => choiceFields(choice, path, label))}</div>
    const equipmentContent = <div className="player-two-fields"><label className="player-field"><span>Armatura indossata (dal tuo inventario)</span><select value={referencedInventoryItem(sheet,'armor')?.id ?? ''} onChange={(event) => change(inventoryReferenceKey('armor'),event.target.value)}><option value="">Senza armatura</option>{armors.map((x) => <option key={x.id} value={x.id}>{x.name} · voce {x.row+1}</option>)}</select></label>
        <label className="player-check"><input type="checkbox" checked={!!referencedInventoryItem(sheet,'shield')} disabled={!shields.length} onChange={(event) => change(inventoryReferenceKey('shield'),event.target.checked ? shields[0].id : '')} /><span>Scudo equipaggiato (+2 CA)</span></label></div>
    if (section) return <>{choiceContent}{section === 'equipment' && equipmentContent}</>
    return <details className="creation-panel" open={!characterClass || !race}>
        <summary>Creazione guidata · caratteristiche e scelte iniziali</summary>
        <p className="player-hint">D&D 5e {spellEdition(sheet)}, opzioni del catalogo. I punteggi qui sotto sono quelli prima dei bonus di origine; nella scheda compare il totale. PF ai livelli successivi calcolati con il valore fisso. Puoi modificare i campi generati per applicare regole del DM, talenti e privilegi con condizioni particolari.</p>
        <div className="creation-scores">{abilityKeys.map((key) => <label className="player-field" key={key}><span>{characterFields[key]} base</span><input type="number" step="1" min="1" max="30" value={d[`creation.base.${key}`] ?? ''} onChange={(event) => change(`creation.base.${key}`, event.target.value)} /><small>Totale: {sheet[key] || '—'}{race || subrace ? ` (bonus +${Number(sheet[key]) - Number(d[`creation.base.${key}`] || 0)})` : ''}</small></label>)}</div>
        <p className="player-hint">Array standard: 15, 14, 13, 12, 10, 8. Gli incrementi ai livelli superiori e i talenti si applicano ai punteggi base dopo aver scelto con il DM.</p>
        {choiceContent}{equipmentContent}
        <p className="player-hint">Le scelte incompiute possono essere salvate e completate in seguito. Le competenze duplicate si sostituiscono scegliendone un’altra con il DM. Multiclasse, magie di sottoclasse, tratti condizionali e opzioni fuori SRD si compilano manualmente. I privilegi della sottoclasse scelta compaiono nella scheda; solo Robustezza draconica e competenza nelle armature del Dominio della Vita aggiornano qui i valori.</p>
    </details>
}

export function CreationStatus({ sheet, enable, disable }: { sheet: CharacterSheet; enable: () => void; disable: () => void }) {
    return <div className="creation-status"><span>{creationEnabled(sheet) ? `Calcoli automatici attivi · D&D 5e ${spellEdition(sheet)}` : 'Scheda manuale'}</span>
        <button type="button" onClick={creationEnabled(sheet) ? disable : enable}>{creationEnabled(sheet) ? 'Passa a compilazione manuale' : 'Attiva creazione guidata'}</button>
        {!creationEnabled(sheet) && <small>Alla prima attivazione i punteggi attuali saranno usati come base, prima dei bonus razziali. Controllali se la scheda è già compilata. Riattivando vengono conservati i bonus già applicati.</small>}
    </div>
}
