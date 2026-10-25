import type { Ability, Combat } from '../../utils/Combat.ts'
import { integerValue, type CharacterSheet } from '../../utils/CharacterSheets.ts'
import type { CreationData } from '../../utils/PlayerCreation.ts'
import { creatureType } from './CombatTargets.ts'
import { activeEffects, defenseProfile } from './CombatResolution.ts'

export type SleepTarget = { id:number; hitPoints?:number; unavailableReason?:string }
export type SleepReviewData = { candidates:(SleepTarget&{name?:string})[]; area?:number[]; immuneIds?:number[]; selected:number[] }

// D&D_5_Player_Original_Handbook.pdf, PDF 277, Sleep (2014).
export function sleepDice(option:string):number {
    const level=/^slot:([1-9])$/.exec(option)
    return 5+2*(level?Number(level[1])-1:0)
}

export function validSleepRoll(roll:number,dice:number):boolean {
    return Number.isSafeInteger(roll)&&roll>=dice&&roll<=dice*8
}

export function sleepTargetReason(target:SleepTarget,remaining:number):string|undefined {
    if(target.unavailableReason)return target.unavailableReason
    if(target.hitPoints===undefined)return 'PF attuali mancanti: il Master deve completare la scheda.'
    if(target.hitPoints<=0)return 'Creatura già a 0 PF: non viene considerata da Sonno.'
    if(target.hitPoints>remaining)return 'PF attuali superiori alla riserva disponibile.'
}

export function sleepCandidates(participants:{id:number;sheet?:CharacterSheet;hitPoints?:string}[],abilities:Ability[],data?:CreationData):SleepTarget[] {
    const active=activeEffects(abilities)
    return participants.map(turn=>{
        const sheet=turn.sheet,profile=sheet?defenseProfile(sheet,undefined,active,turn.id,undefined,data):undefined
        const race=sheet&&data?.verified?.reviewedEntities.find(e=>e.id==='phb2014:race:'+sheet.playerDetails?.['creation.race']||e.id.startsWith('phb2014:race:')&&[e.name,e.nameIt].some(name=>name?.toLowerCase()===sheet.race?.toLowerCase()))
        const traits=Array.isArray(race?.mechanics.traits)?race.mechanics.traits:[]
        const magicalSleep=traits.some(trait=>{
            const mechanics=trait&&typeof trait==='object'&&!Array.isArray(trait)?trait.mechanics:undefined
            return mechanics&&typeof mechanics==='object'&&!Array.isArray(mechanics)&&Array.isArray(mechanics.immuneTo)&&mechanics.immuneTo.includes('magical-sleep')
        })
        const immune=profile?.conditionImmunities.some(c=>['charmed','affascinato','affascinata','unconscious','privo di sensi','magical-sleep','sonno magico'].includes(c))||profile?.spellImmunities?.includes('phb2014:spell:sleep')
        const unconscious=active.some(a=>(a.targets?.length?a.targets.some(t=>t.id===turn.id):a.ownerId===turn.id)&&(isSleep(a)||a.resolutionEffects?.some(e=>e.kind==='condition'&&e.condition==='unconscious')))
        const hp=integerValue(turn.hitPoints??sheet?.hitPoints)
        return {id:turn.id,hitPoints:hp!==undefined&&hp>=0?hp:undefined,unavailableReason:creatureType(sheet)==='undead'?'I non morti non sono influenzati da Sonno.':magicalSleep||immune?'Immune a Sonno.':unconscious?'Creatura già priva di sensi.':undefined}
    })
}

// Equal-PF priority is a Master's ruling: PHB 2014 does not specify a tie-breaker.
export function sleepAllocation(candidates:SleepTarget[],area:number[],total:number,preferred:number[]=[]):{selected:number[];remaining:number} {
    const included=new Set(area),priority=new Map(preferred.map((id,index)=>[id,index])),selected:number[]=[]
    let remaining=total
    for(const target of candidates.filter(t=>included.has(t.id)).sort((a,b)=>(a.hitPoints??Infinity)-(b.hitPoints??Infinity)||(priority.get(a.id)??Infinity)-(priority.get(b.id)??Infinity)||a.id-b.id)) {
        if(sleepTargetReason(target,remaining))continue
        selected.push(target.id);remaining-=target.hitPoints!
    }
    return {selected,remaining}
}


export const isSleep=(ability:Ability)=>ability.ruleId==='phb2014:spell:sleep'&&!ability.execution

// PHB 2014 PDF 277, 293: Sleep causes unconsciousness and a fall prone.
// Falling prone outlasts waking; it is an independent condition, never a child timer.
export function applySleepConditions(abilities:Ability[],participants:{id:number;description?:string}[],combat?:Combat|null):Ability[] {
    const active=activeEffects(abilities),prone=new Set(active.flatMap(a=>a.resolutionEffects?.some(e=>e.kind==='condition'&&e.condition==='prone')?(a.targets?.length?a.targets.map(t=>t.id):[a.ownerId]):[]))
    let nextId=Math.max(-1,...abilities.map(a=>a.id))+1
    const added:Ability[]=[]
    const updated=abilities.map(ability=>{
        if(!isSleep(ability)||!active.some(a=>a.id===ability.id))return ability
        if(!ability.targets?.length)return {...ability,active:false,remainingTurns:0}
        if(ability.resolutionEffects?.some(e=>e.kind==='condition'&&e.condition==='unconscious'))return ability
        for(const target of ability.targets)if(!prone.has(target.id)) {
            if(abilities.length+added.length>=2000)throw new Error('Limite degli effetti in combattimento raggiunto.')
            added.push({id:nextId++,name:'Prono',ownerId:target.id,active:true,timed:false,duration:'Senza conteggio',remainingTurns:0,conditionOrigin:`${ability.name} · ${participants.find(p=>p.id===ability.ownerId)?.description??'Incantatore'}`,resolutionEffects:[{kind:'condition',condition:'prone',trigger:'always'}]})
            prone.add(target.id)
        }
        return {...ability,...(combat&&!ability.expiresAt?{expiresAt:'start' as const,expiryOwnerId:ability.ownerId??undefined,expiryRound:combat.round+ability.remainingTurns}:{}),resolutionEffects:[...(ability.resolutionEffects??[]),{kind:'condition' as const,condition:'unconscious',trigger:'always' as const}]}
    })
    return added.length?[...updated,...added]:updated
}

export function wakeSleep(abilities:Ability[],targetIds:number[]):Ability[] {
    const waking=new Set(targetIds)
    return abilities.map(ability=>{
        if(!isSleep(ability)||!ability.active||!ability.targets?.some(t=>waking.has(t.id)))return ability
        const targets=ability.targets.filter(t=>!waking.has(t.id))
        return {...ability,targets,active:targets.length>0,remainingTurns:targets.length?ability.remainingTurns:0}
    })
}

export function sleepingTargets(abilities:Ability[]):number[] {
    return [...new Set(activeEffects(abilities).filter(isSleep).flatMap(a=>a.targets?.map(t=>t.id)??[]))]
}

export function wakeWithAction<T extends {id:number;sheet?:CharacterSheet}>(abilities:Ability[],turns:T[],actorId:number,targetId:number) {
    const actor=turns.find(t=>t.id===actorId),target=turns.find(t=>t.id===targetId)
    if(!actor?.sheet||!target||actorId===targetId||!sleepingTargets(abilities).includes(targetId))throw new Error('Scegli un’altra creatura addormentata da svegliare.')
    if(sleepingTargets(abilities).includes(actorId)||activeEffects(abilities).some(a=>(a.targets?.length?a.targets.some(t=>t.id===actorId):a.ownerId===actorId)&&a.resolutionEffects?.some(e=>e.kind==='condition'&&['unconscious','paralyzed','stunned','incapacitated'].includes(e.condition??''))))throw new Error('Chi è incapacitato non può svegliare un’altra creatura.')
    const details=actor.sheet.playerDetails??{},history=JSON.parse(details['rules2014.spellsThisTurn']??details['combat.spellsThisTurn']??'[]')
    if(!Array.isArray(history))throw new Error('Cronologia del turno non valida.')
    if(details['combat.actionUsed']==='true'||history.some(c=>c.unit==='action'))throw new Error('L’azione di questo turno è già utilizzata.')
    const sheet={...actor.sheet,playerDetails:{...details,'combat.actionUsed':'true'}}
    return {abilities:wakeSleep(abilities,[targetId]),turns:turns.map(t=>t.id===actorId?{...t,sheet}:t),sheet}
}
