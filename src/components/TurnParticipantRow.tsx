import { pendingWindSaves, windSaveResults } from '../domain/dnd/WindTurns'
import { memo, type DragEvent } from 'react'
import { TurnAbilityChoices } from './TurnAbilityChoices'
import type { CreationData } from '../utils/PlayerCreation'
import type { Turn } from './TurnsTracker'
import { ParticipantStatIcon } from './ParticipantInspector'
import { CatalogSearch } from './CatalogSearch'
import { InfoButton } from './InfoButton'
import { HelpTooltip } from './HelpTooltip'
import { characterFields, currentArmorClass, initiativeBonus, integerValue } from '../utils/CharacterSheets'
import { type Catalog, type CatalogEntry } from '../utils/Catalog'
import { hitPointsAfterDamageWithTemporary, hitPointsAfterHealing, type Ability } from '../utils/Combat'
import { activeEffects as effectiveAbilities, conditionNames, saveNames } from '../domain/dnd/CombatResolution'
import { conditionsFor, conditionHelp, pendingRepeatSaves } from '../domain/dnd/CombatConditions'
import { spellEdition } from '../utils/Spellcasting'

export type TurnRowActions = {
    openWindSave:(effectId:number)=>void
    resolveWindSave:(effectId:number,success:boolean)=>boolean
    openTurnSheet:(turn:Turn)=>void
    handleDragStart:(event:DragEvent<HTMLButtonElement>,id:number)=>void
    reorderTurn:(source:number,target:number)=>void
    revealParticipant:(id:number)=>void
    updateTurn:(id:number,field:'description'|'initiative'|'hitPoints'|'armorClass'|'temporaryHitPoints'|'damage',value:string)=>void
    selectCreature:(id:number,entry:CatalogEntry)=>void
    applyDamage:(id:number)=>void
    applyHealing:(id:number)=>void
    resolveConcentration:(id:number,success:boolean)=>void
    removeTurn:(id:number)=>void
    openSheetAbility:(turn:Turn,index:number)=>void
    highlightAbility:(id:number)=>void
}

type Props={turn:Turn;index:number;active:boolean;selected:boolean;combatStarted:boolean;round:number;renewed:boolean;abilities:Ability[];participants:{id:number;description:string}[];catalog:Catalog;actions:TurnRowActions;choiceTurn:Turn;creationData?:CreationData;catalogLoading:boolean}

export const TurnParticipantRow=memo(function TurnParticipantRow({turn,index,active,selected,combatStarted,round,renewed,abilities,participants,catalog,actions,choiceTurn,creationData,catalogLoading}:Props) {
    const {openTurnSheet,handleDragStart,reorderTurn,revealParticipant,updateTurn,selectCreature,applyDamage,applyHealing,resolveConcentration,removeTurn,openWindSave,resolveWindSave}=actions
    const combat=combatStarted?{activeId:turn.id,round}:null
    const activeEffects=effectiveAbilities(abilities).concat(abilities.filter(a=>!!a.execution))
    const maximumHitPoints=(turn:Turn)=>turn.sheet?.playerDetails?.maxHitPoints?.trim() || String(catalog.creatures.find(entry=>entry.id===turn.sheet?.catalogId)?.data.hitPoints ?? '')
    const conditions=[...conditionsFor(abilities,turn.id),...(activeEffects.some(ability=>!ability.execution&&ability.ruleId==='phb2014:spell:bless'&&ability.targets?.some(target=>target.id===turn.id))?['Benedetto']:[])],due=active?pendingRepeatSaves(abilities,combat).filter(a=>a.ownerId===turn.id):[]
    const windDue=active?pendingWindSaves(abilities,combat):[],windResults=active?windSaveResults(abilities,combat):[]
    const concentrating=activeEffects.find(a=>a.ownerId===turn.id&&(a.concentration||a.execution?.phase==='casting'))
    const concentrationKey=turn.sheet?.playerDetails?.['rules2014.concentration']
    const concentration=concentrating?.name??(concentrationKey?catalog.abilities.find(a=>a.data.referenceId===concentrationKey||a.id===concentrationKey)?.name??'Incantesimo in corso':undefined)
    const edition=turn.sheet?spellEdition(turn.sheet):'2014'
    // Help summaries: PHB 2014 PDF 219 (Bless), 204 (Concentration);
    // revised concentration: D&D_5.5_manuale_compatto_italiano.pdf, PDF 206.
    const origin=(effect:Ability)=>{
        const source=abilities.find(a=>a.id===effect.sourceEffectId)??effect
        const caster=participants.find(t=>t.id===source.ownerId)?.description
        return <div className="turn-status-origin" key={effect.id}><p><strong>Origine:</strong> {source.name}{caster?` · ${caster}`:''}</p>{effect.repeatSaveRoll&&<p>TS {saveNames[effect.repeatSaveRoll.ability]}{effect.repeatSaveRoll.dc===undefined?' · CD da verificare':` · CD ${effect.repeatSaveRoll.dc}`} a fine turno.</p>}</div>
    }
    const status=(conditions.length>0||due.length>0||windDue.length>0||windResults.length>0||!!concentration)&&<div className="turn-statuses">
        {(conditions.length>0||!!concentration)&&<div className="turn-condition-pills" aria-label={`Stati di ${turn.description}`}>{conditions.map(condition=>{
            const sources=effectiveAbilities(abilities).filter(a=>!a.execution&&(a.targets?.length?a.targets.some(t=>t.id===turn.id):a.ownerId===turn.id)&&(condition==='Benedetto'?a.ruleId==='phb2014:spell:bless':a.resolutionEffects?.some(e=>e.kind==='condition'&&(conditionNames[e.condition as keyof typeof conditionNames]??e.condition)===condition)))
            return <HelpTooltip className="turn-condition-pill" label={condition} triggerContent={condition} key={condition}><div className="turn-status-help"><strong>{condition}</strong><ul>{(condition==='Benedetto'?['Aggiungi 1d4 ai tiri per colpire e ai tiri salvezza. Il bonus non si applica alle prove di caratteristica.']:conditionHelp(condition,edition)).map(text=><li key={text}>{text}</li>)}</ul>{sources.length?sources.map(origin):<p>Origine non disponibile.</p>}</div></HelpTooltip>
        })}{concentration&&<HelpTooltip className="turn-condition-pill" label="Concentrazione" triggerContent="Concentrazione"><div className="turn-status-help"><strong>Concentrazione</strong><ul><li>Mantieni la concentrazione su {concentration}.</li><li>Un altro effetto che richiede concentrazione interrompe quello attuale.</li><li>Se subisci danni, serve un TS su Costituzione per mantenerla.</li><li>Termina se diventi incapacitato, muori o decidi di interromperla.</li></ul>{concentrating?origin(concentrating):<p><strong>Origine:</strong> {concentration} · {turn.description}</p>}</div></HelpTooltip>}</div>}
        {windDue.map(effect=><div key={effect.id} className="master-concentration-check wind-start-save" role="status"><strong>{effect.name} · inizio turno</strong><span>TS Forza{effect.windSave?.dc===undefined?' · CD da verificare':` · CD ${effect.windSave.dc}`}</span><div className="wind-start-save-actions"><button type="button" onClick={()=>openWindSave(effect.id)} aria-label={`Tira TS Forza di ${turn.description} per ${effect.name}`}>Tira TS Forza</button><button type="button" onClick={()=>resolveWindSave(effect.id,true)}>TS superato</button><button type="button" onClick={()=>resolveWindSave(effect.id,false)}>TS fallito</button></div></div>)}
        {windResults.map(effect=><p key={effect.id} className="turn-save-reminder" role="status">{effect.name}: {effect.windSave!.turn!.success?'TS superato · resiste alla spinta.':'TS fallito · spingi la creatura di 4,5 m lungo la linea, lontano dal lanciatore.'}</p>)}
        {due.length>0&&<p className="turn-save-reminder" role="status" title="Da risolvere a fine turno. Premi Turno successivo per risolvere.">{due.map(a=>`TS ${saveNames[a.repeatSaveRoll!.ability]}${a.repeatSaveRoll!.dc===undefined?'':` · CD ${a.repeatSaveRoll!.dc}`}`).join('; ')} · fine turno</p>}
    </div>
    const initiativeField = (<label className="initiative-field">
            <span className="master-stat-initiative">{renewed && <ParticipantStatIcon kind="initiative"/>}Iniziativa</span>
            <input
                aria-label={`Iniziativa del turno ${index + 1}`}
                required
                step="1"
                disabled={combat !== null}
                type="number"
                value={turn.initiative}
                title={initiativeBonus(turn.sheet) ? `Modificatore iniziativa: ${initiativeBonus(turn.sheet)}. Inserisci il risultato del tiro.` : 'Inserisci il risultato del tiro di iniziativa.'}
                onChange={(event) => updateTurn(turn.id, 'initiative', event.target.value)}
            />
        </label>)
    return (
    <div
        className={`turn-row${active ? ' active-turn' : ''}${renewed && selected ? ' selected-participant' : ''}${due.length||windDue.length||turn.concentrationChecks?.length?' turn-needs-resolution':''}`}
        aria-current={active ? 'step' : undefined}
        onDoubleClick={event => {
            const target=event.target as HTMLElement
            if (target.closest('input,select,textarea,label,a,summary,button') && !target.closest('.master-participant-identity button')) return
            openTurnSheet(turn)
        }}
        data-reorder-item
        data-reorder-id={turn.id}
        key={turn.id}
    >
        <button
            aria-label={`Trascina per riordinare il turno ${index + 1}`}
            className="turn-drag-handle"
            disabled={combat !== null}
            draggable={combat === null}
            onDragStart={(event) => handleDragStart(event, turn.id)}
            onKeyDown={(event) => {
                if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
                event.preventDefault()
                const targetIndex = index + (event.key === 'ArrowUp' ? -1 : 1)
                const targetTurn = participants[targetIndex]
                if (targetTurn) reorderTurn(turn.id, targetTurn.id)
            }}
            title="Trascina per riordinare; usa le frecce per spostare"
            type="button"
        >
            <span aria-hidden="true">↕</span>
        </button>
        {renewed && initiativeField}
        {renewed ? <div className="turn-description master-participant-name"><div className="master-participant-identity"><button type="button" aria-label={`Dettagli di ${turn.description || `partecipante ${index + 1}`}`} aria-pressed={selected} onClick={() => revealParticipant(turn.id)}><strong>{turn.description || 'Partecipante da nominare'}</strong><span>{turn.sheet?.kind || 'Creatura'}{active ? ' · Turno attuale' : selected ? ' · Selezionato' : ' · Dettagli'}</span></button>{activeEffects.some(ability => ability.ownerId === turn.id) && <span className="master-participant-effects">{activeEffects.filter(ability => ability.ownerId === turn.id).length} {activeEffects.filter(ability => ability.ownerId === turn.id).length === 1 ? "effetto in corso" : "effetti in corso"}</span>}</div>{status}</div> : <CatalogSearch
            aria-label={`Creatura del turno ${index + 1}`}
            required
            pattern=".*\S.*"
            disabled={combat !== null}
            className="turn-description"
            type="text"
            placeholder="PG o mostro"
            value={turn.description}
            entries={catalog.creatures}
            onChange={(value) => updateTurn(turn.id, 'description', value)}
            onSelect={(entry) => selectCreature(turn.id, entry)}
        />}
        {!renewed && initiativeField}
        <label className="turn-stat turn-pf">
            <span className="master-stat-hp">{renewed && <ParticipantStatIcon kind="hp"/>}{renewed && Number(turn.temporaryHitPoints) > 0 ? 'PF temporanei' : 'PF'}</span>
            <span className="turn-hitpoints">
            <input
                aria-label={`PF di ${turn.description || `creatura ${index + 1}`}`}
                type="number"
                step="1"
                value={turn.hitPoints}
                style={renewed ? {width: `calc(${Math.max(2, turn.hitPoints.length)}ch + 4px)`} : undefined}
                onChange={(event) => updateTurn(turn.id, 'hitPoints', event.target.value)}
            />
            <span className="turn-max-hitpoints" aria-label="PF massimi">/{maximumHitPoints(turn) || '—'}</span>
            </span>
        </label>
        <label className="turn-stat turn-temporary-pf">
            <span>PF temporanei</span>
            <input
                aria-label={`PF temporanei di ${turn.description || `creatura ${index + 1}`}`}
                type="number"
                min="0"
                step="1"
                value={turn.temporaryHitPoints}
                onChange={(event) => updateTurn(turn.id, 'temporaryHitPoints', event.target.value)}
            />
        </label>
        <label className="turn-stat turn-ca">
            <span className="master-stat-ac">{renewed && <ParticipantStatIcon kind="ac"/>}{renewed && integerValue(turn.sheet?.playerDetails?.temporaryAC) !== undefined ? 'CA temporanea' : 'CA'}</span>
            <input
                aria-label={`CA di ${turn.description || `creatura ${index + 1}`}`}
                type="number"
                step="1"
                value={turn.sheet?currentArmorClass(turn.sheet):turn.armorClass}
                readOnly={turn.sheet?.playerDetails?.['temporaryAC.source']==='effects'}
                title={turn.sheet?.playerDetails?.temporaryAC?`CA temporanea · CA base: ${turn.armorClass}`:undefined}
                onChange={(event) => updateTurn(turn.id, 'armorClass', event.target.value)}
            />
        </label>
        <div className="card-info">{turn.sheet?.kind === 'PG' || !turn.sheet?.catalogId ? (
            <button className="more-info" type="button" aria-label={`Apri scheda di ${turn.description || 'questo mostro'}`} onClick={() => openTurnSheet(turn)}>Scheda</button>
        ) : <InfoButton name={turn.description} label="Scheda"
            entry={catalog.creatures.find((entry) => entry.id === turn.sheet?.catalogId)}
            description={turn.sheet?.notes}
            fields={{ ...(turn.sheet?.catalogId ? {} : Object.fromEntries(Object.entries(characterFields).filter(([key]) => !['name', 'notes', 'hitPoints', 'armorClass', 'initiative'].includes(key)).map(([key, label]) => [label, turn.sheet?.[key as keyof typeof characterFields] ?? '']))), hitPoints: turn.hitPoints, armorClass: turn.armorClass, initiativeModifier: initiativeBonus(turn.sheet) || 'Non disponibile', initiative: turn.initiative || 'Da inserire' }} />}</div>
        <div className="damage-controls">
            <span>Danni - / Cura +</span>
            <div className="hitpoint-adjustment">
                <input aria-label={`Danni o cura per ${turn.description || `creatura ${index + 1}`}`} type="number" min="1" step="1"
                    value={turn.damage ?? ''} placeholder="0"
                    onChange={(event) => updateTurn(turn.id, 'damage', event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault() }} />
                <div className="hitpoint-buttons">
                    <button className="apply-damage" type="button" aria-label={`Applica danni a ${turn.description || `creatura ${index + 1}`}`}
                        disabled={hitPointsAfterDamageWithTemporary(turn.hitPoints, turn.temporaryHitPoints, turn.damage ?? '') === null} onClick={() => applyDamage(turn.id)}>−</button>
                    <button className="apply-damage apply-healing" type="button" aria-label={`Applica cura a ${turn.description || `creatura ${index + 1}`}`}
                        disabled={hitPointsAfterHealing(turn.hitPoints, turn.damage ?? '', maximumHitPoints(turn)) === null} onClick={() => applyHealing(turn.id)}>+</button>
                </div>
            </div>
        </div>
        {!renewed&&status}
        {!!turn.concentrationChecks?.length && <p className="master-concentration-check" role="status">Concentrazione · TS Costituzione CD {turn.concentrationChecks[0]} <button type="button" onClick={()=>resolveConcentration(turn.id,true)}>TS riuscito</button><button type="button" onClick={()=>resolveConcentration(turn.id,false)}>TS fallito: termina concentrazione</button></p>}
        {!renewed && <TurnAbilityChoices turn={choiceTurn} abilities={abilities} catalog={catalog} creationData={creationData} search="" renewed={false} catalogLoading={catalogLoading} participants={participants} actions={actions}/>}
        {active && <strong className="active-turn-label">Turno attuale</strong>}
        <button
            aria-label={`Elimina il turno ${index + 1}`}
            className="delete-turn"
            onClick={() => removeTurn(turn.id)}
            title="Elimina turno"
            type="button"
        >
            <span aria-hidden="true">×</span>
        </button>
    </div>
    )
})
