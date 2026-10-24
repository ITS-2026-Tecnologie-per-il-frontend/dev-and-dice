import type { ReactNode } from 'react'
import type { Turn } from './TurnsTracker'
import type { TurnRowActions } from './TurnParticipantRow'
import { ParticipantAbilities } from './ParticipantInspector'
import { type Catalog, catalogAbilityKind } from '../utils/Catalog'
import { findSheetCombatAbility } from '../utils/CharacterSheets'
import { type Ability } from '../utils/Combat'
import { type CreationData } from '../utils/PlayerCreation'
import { catalogForSheet } from '../domain/dnd/ActiveRules'
import { combatAbilityInfo, combatAbilityStatus } from '../domain/dnd/CombatActions'
import { resolutionPlan, weaponDisplayName } from '../domain/dnd/CombatResolution'

export type TurnAbilityChoicesProps={turn:Turn;abilities:Ability[];catalog:Catalog;creationData?:CreationData;search:string;renewed:boolean;catalogLoading:boolean;participants:{id:number;description:string}[];actions:TurnRowActions}

const choiceCache=new WeakMap<Turn,{props:TurnAbilityChoicesProps;content:ReactNode}>()

// Prepare one participant between interactions, and reuse that exact view when their turn starts.
export function prepareTurnAbilityChoices(props:TurnAbilityChoicesProps) {
    const cached=choiceCache.get(props.turn)
    if(cached&&Object.keys(cached.props).length===Object.keys(props).length&&Object.keys(props).every(key=>props[key as keyof TurnAbilityChoicesProps]===cached.props[key as keyof TurnAbilityChoicesProps]))return cached.content
    const content=renderChoices(props)
    choiceCache.set(props.turn,{props,content})
    return content
}


function renderChoices({turn,abilities,catalog,creationData,search,renewed,catalogLoading,participants,actions}:TurnAbilityChoicesProps) {
    function abilityStatus(turn:Turn,ability:Ability) {
        try {return combatAbilityStatus(turn.sheet,ability,turn.sheet ? catalogForSheet(creationData,catalog,turn.sheet) ?? catalog : catalog,creationData)}
        catch {return 'Verifica scheda'}
    }
    const ownerCatalog=turn.sheet ? catalogForSheet(creationData,catalog,turn.sheet) ?? catalog : catalog
    if (!(turn.availableAbilityIndexes?.length ?? turn.sheet?.abilities?.length ?? 0) && !abilities.some(ability => ability.ownerId === turn.id)) return renewed ? <p>Nessuna abilità associata. Puoi aggiungerne una qui sotto.</p> : null
    const controls:ReactNode[]=[],entries:{group:string;level?:number;control:ReactNode}[]=[]
    function add(ability:Ability,control:ReactNode) {
        const info=combatAbilityInfo(ability,ownerCatalog),query=renewed ? search.trim().toLocaleLowerCase() : ''
        if (info.passive || query && !ability.name.toLocaleLowerCase().includes(query) && !info.entry?.name.toLocaleLowerCase().includes(query)) return
        const group=info.level!==undefined ? 'Incantesimi' : catalogAbilityKind(info.entry,ability.section,ability.description ?? info.entry?.description).weaponAttack ? 'Attacchi fisici' : 'Abilità attivabili'
        entries.push({group,level:info.level,control});controls.push(control)
    }
    turn.sheet?.abilities?.forEach((template, index) => {
        const ability = findSheetCombatAbility(abilities,template,turn.id,index)
        const current=ability ?? {...template,id:-1,ownerId:turn.id,remainingTurns:template.remainingTurns ?? 0,active:false}
        if (turn.availableAbilityIndexes && !turn.availableAbilityIndexes.includes(index)) return
        const status=abilityStatus(turn,current)
        const plan=turn.sheet&&creationData&&resolutionPlan(turn.sheet,current,ownerCatalog,'free',{data:creationData,active:abilities})
        const displayName=weaponDisplayName(plan,participants.map(caster=>({id:caster.id,name:caster.description})))
        add(current,<button className="participant-ability" data-ability-state={status==='In esecuzione' ? 'active' : 'available'} type="button" disabled={catalogLoading} key={`sheet-${index}`} onClick={() => actions.openSheetAbility(turn, index)}>
            {displayName||ownerCatalog.abilities.find((entry) => entry.id === current.catalogId)?.name || current.name} · {status}
        </button>)
    })
    abilities.filter(ability => ability.ownerId === turn.id && ability.sheetAbilityIndex === undefined&&!turn.sheet?.abilities.some((template,index)=>(!turn.availableAbilityIndexes||turn.availableAbilityIndexes.includes(index))&&findSheetCombatAbility([ability],template,turn.id,index))).forEach(ability => add(ability,
        <a key={ability.id} data-ability-state={ability.active && (ability.remainingTurns > 0 || ability.timed === false) ? 'active' : 'inactive'} href={`#ability-${ability.id}`} onClick={(event) => { event.preventDefault(); actions.highlightAbility(ability.id) }}>
            {ownerCatalog.abilities.find(entry => entry.id === ability.catalogId)?.name || ability.name || 'Abilità senza nome'} · {abilityStatus(turn,ability)}
        </a>))
    if (!controls.length) return renewed && search.trim() ? <p>Nessuna abilità corrisponde alla ricerca.</p> : renewed ? <p>Nessuna abilità associata. Puoi aggiungerne una qui sotto.</p> : null
    return renewed ? <ParticipantAbilities entries={entries} search={search} label={`Abilità di ${turn.description || 'creatura'}`} sheet={turn.sheet}/> : <div className="participant-abilities" aria-label={`Abilità di ${turn.description || 'creatura'}`}>{controls}</div>
}
