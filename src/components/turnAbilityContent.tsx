import {ActionButton} from './ActionButton'
import type { ReactNode } from 'react'
import type { Turn } from './TurnsTracker'
import type { TurnRowActions } from './TurnParticipantRow'
import { ParticipantAbilities } from './ParticipantInspector'
import { type Catalog, catalogAbilityKind } from '../utils/Catalog'
import { findSheetCombatAbility } from '../utils/CharacterSheets'
import { type Ability } from '../utils/Combat'
import { type CreationData } from '../utils/PlayerCreation'
import { catalogForSheet } from '../domain/dnd/ActiveRules'
import { combatAbilityInfo, combatAbilityStatus, combatAvailability } from '../domain/dnd/CombatActions'
import { resolutionPlan, weaponDisplayName } from '../domain/dnd/CombatResolution'

export type TurnAbilityChoicesProps={combat?:import('../utils/Combat').Combat|null;spellOpportunities?:import('../domain/dnd/Counterspell').CounterspellTarget[];reactionWindows?:import('../utils/PlayApi').Game['reactionWindows'];turn:Turn;abilities:Ability[];catalog:Catalog;creationData?:CreationData;search:string;renewed:boolean;catalogLoading:boolean;participants:{id:number;description:string}[];actions:TurnRowActions}

const choiceCache=new WeakMap<Turn,{props:TurnAbilityChoicesProps;content:ReactNode}>()

// Prepare one participant between interactions, and reuse that exact view when their turn starts.
export function prepareTurnAbilityChoices(props:TurnAbilityChoicesProps) {
    const cached=choiceCache.get(props.turn)
    if(cached&&Object.keys(cached.props).length===Object.keys(props).length&&Object.keys(props).every(key=>props[key as keyof TurnAbilityChoicesProps]===cached.props[key as keyof TurnAbilityChoicesProps]))return cached.content
    const content=renderChoices(props)
    choiceCache.set(props.turn,{props,content})
    return content
}


function renderChoices({turn,combat,spellOpportunities,reactionWindows,abilities,catalog,creationData,search,renewed,catalogLoading,participants,actions}:TurnAbilityChoicesProps) {
    function abilityStatus(turn:Turn,ability:Ability) {
        try {return combatAbilityStatus(turn.sheet,ability,turn.sheet ? catalogForSheet(creationData,catalog,turn.sheet) ?? catalog : catalog,creationData)}
        catch {return 'Verifica scheda'}
    }
    const ownerCatalog=turn.sheet ? catalogForSheet(creationData,catalog,turn.sheet) ?? catalog : catalog
    const actionAbilities=abilities.filter(ability=>!ability.readied&&!ability.conditionOrigin&&ability.sourceEffectId===undefined)
    if (!(turn.availableAbilityIndexes?.length ?? turn.sheet?.abilities?.length ?? 0) && !actionAbilities.some(ability => ability.ownerId === turn.id)) return renewed ? <p>Nessuna abilità associata. Puoi aggiungerne una qui sotto.</p> : null
    const controls:ReactNode[]=[],entries:{group:string;level?:number;control:ReactNode}[]=[]
    function add(ability:Ability,control:ReactNode) {
        const info=combatAbilityInfo(ability,ownerCatalog),query=renewed ? search.trim().toLocaleLowerCase() : ''
        if (info.passive || query && !ability.name.toLocaleLowerCase().includes(query) && !info.entry?.name.toLocaleLowerCase().includes(query)) return
        const group=info.level!==undefined ? 'Incantesimi' : catalogAbilityKind(info.entry,ability.section,ability.description ?? info.entry?.description).weaponAttack ? 'Attacchi fisici' : 'Abilità attivabili'
        entries.push({group,level:info.level,control});controls.push(control)
    }
    turn.sheet?.abilities?.forEach((template, index) => {
        const ability = findSheetCombatAbility(actionAbilities,template,turn.id,index)
        const current=ability ?? {...template,id:-1,ownerId:turn.id,remainingTurns:template.remainingTurns ?? 0,active:false}
        if (turn.availableAbilityIndexes && !turn.availableAbilityIndexes.includes(index)) return
        const status=abilityStatus(turn,current)
        const plan=turn.sheet&&creationData&&resolutionPlan(turn.sheet,current,ownerCatalog,'free',{data:creationData,active:abilities})
        const displayName=weaponDisplayName(plan,participants.map(caster=>({id:caster.id,name:caster.description})))
        const consult=status==='In esecuzione',reason=consult?undefined:combatAvailability(turn.sheet,current,ownerCatalog,creationData,{abilities,ownerId:turn.id,combat,reactionAvailable:current.ruleId==='phb2014:spell:counterspell'&&spellOpportunities?.some(t=>t.actorId!==turn.id&&!t.unavailableActors?.includes(turn.id))||reactionWindows?.some(w=>w.characterId===turn.sheet?.id&&w.actionKeys.includes(String(index))&&w.status==='pending'&&w.expiresAt>Date.now())})
        add(current,<ActionButton unavailableReason={reason} className="participant-ability" data-ability-state={consult?'active':reason?'blocked':'available'} type="button" disabled={catalogLoading} key={`sheet-${index}`} onClick={() => actions.openSheetAbility(turn, index)}>
            {displayName||ownerCatalog.abilities.find((entry) => entry.id === current.catalogId)?.name || current.name}{!reason && <> · {status}</>}
        </ActionButton>)
    })
    actionAbilities.filter(ability => ability.ownerId === turn.id && ability.sheetAbilityIndex === undefined&&!turn.sheet?.abilities.some((template,index)=>(!turn.availableAbilityIndexes||turn.availableAbilityIndexes.includes(index))&&findSheetCombatAbility([ability],template,turn.id,index))).forEach(ability=>{
        const running=ability.active&&(ability.remainingTurns>0||ability.timed===false),reason=running?undefined:combatAvailability(turn.sheet,ability,ownerCatalog,creationData,{abilities,ownerId:turn.id,combat,reactionAvailable:ability.ruleId==='phb2014:spell:counterspell'?spellOpportunities?.some(t=>t.actorId!==turn.id&&!t.unavailableActors?.includes(turn.id)):reactionWindows?.some(w=>w.characterId===turn.sheet?.id&&w.status==='pending'&&w.expiresAt>Date.now())})
        add(ability,<ActionButton type="button" className="participant-ability" unavailableReason={reason} key={ability.id} data-ability-state={running?'active':reason?'blocked':'available'} onClick={()=>actions.highlightAbility(ability.id)}>{ownerCatalog.abilities.find(entry=>entry.id===ability.catalogId)?.name||ability.name||'Abilità senza nome'}{!reason && <> · {abilityStatus(turn,ability)}</>}</ActionButton>)
    })
    if (!controls.length) return renewed && search.trim() ? <p>Nessuna abilità corrisponde alla ricerca.</p> : renewed ? <p>Nessuna abilità associata. Puoi aggiungerne una qui sotto.</p> : null
    return renewed ? <ParticipantAbilities entries={entries} search={search} label={`Abilità di ${turn.description || 'creatura'}`} sheet={turn.sheet}/> : <div className="participant-abilities" aria-label={`Abilità di ${turn.description || 'creatura'}`}>{controls}</div>
}
