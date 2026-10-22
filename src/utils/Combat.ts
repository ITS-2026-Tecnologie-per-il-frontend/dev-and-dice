import type { SheetAbility } from './CharacterSheets.ts'

export type Combat = { activeId: number; round: number }

export function hitPointsAfterHealing(hitPoints: string, healing: string, maximum: string): string | null {
    if (!hitPoints.trim() || !healing.trim()) return null
    const hp = Number(hitPoints), amount = Number(healing), max = maximum.trim() ? Number(maximum) : null
    if (!Number.isSafeInteger(hp) || hp < 0 || !Number.isSafeInteger(amount) || amount <= 0
        || (max !== null && (!Number.isSafeInteger(max) || max < 0))) return null
    const result = max === null ? hp + amount : Math.max(hp, hp + Math.min(amount, max - hp))
    return Number.isSafeInteger(result) ? String(result) : null
}

export function hitPointsAfterDamage(hitPoints: string, damage: string): string | null {
    const current = Number(hitPoints)
    const amount = Number(damage)
    if (!hitPoints.trim() || !damage.trim() || !Number.isSafeInteger(current) || current < 0 || !Number.isSafeInteger(amount) || amount <= 0) return null
    return String(Math.max(0, current - amount))
}

export function hitPointsAfterDamageWithTemporary(hitPoints: string, temporaryHitPoints: string, damage: string): { hitPoints: string; temporaryHitPoints: string } | null {
    const current = Number(hitPoints)
    const temporary = temporaryHitPoints.trim() ? Number(temporaryHitPoints) : 0
    const amount = Number(damage)
    if (!hitPoints.trim() || !damage.trim() || !Number.isSafeInteger(current) || current < 0
        || !Number.isSafeInteger(temporary) || temporary < 0 || !Number.isSafeInteger(amount) || amount <= 0) return null
    const temporaryDamage = Math.min(temporary, amount)
    return {
        hitPoints: String(Math.max(0, current - (amount - temporaryDamage))),
        temporaryHitPoints: temporaryHitPoints.trim() ? String(temporary - temporaryDamage) : '',
    }
}

type Participant = { id: number; initiative: string }

export function sortByInitiative<T extends Participant>(participants: T[]): T[] {
    // le parità mantengono l'ordine manuale; nessuno spareggio automatico.
    return [...participants].sort((first, second) => Number(second.initiative) - Number(first.initiative))
}

export function nextCombatTurn(participants: Participant[], combat: Combat): Combat | null {
    if (participants.length === 0) return null
    const nextIndex = (participants.findIndex((participant) => participant.id === combat.activeId) + 1) % participants.length
    return { activeId: participants[nextIndex].id, round: combat.round + (nextIndex === 0 ? 1 : 0) }
}

export const durationTurns = {
    '1 minuto': 10,
    '10 minuti': 100,
    '1 ora': 600,
    '8 ore': 4800,
    '24 ore': 14400,
    'Personalizzata': 0,
    'Senza conteggio': 0,
} as const

export type Ability = {
    id: number
    name: string
    duration: keyof typeof durationTurns
    remainingTurns: number
    ownerId: number | null
    active: boolean
    catalogId?: string
    sheetAbilityIndex?: number
    section?: SheetAbility['section']
    timed?: boolean
    description?: string
    expiresAt?:'start'|'end'
    expiryOwnerId?:number
    expiryRound?:number
    repeatSave?:string
    repeatSaveRoll?:{ability:import('../domain/dnd/CombatResolution.ts').SaveAbility;dc?:number;timing:'end';lastRound?:number}
    ruleId?:string
    concentration?:boolean
    weaponEffects?:import('../domain/dnd/CombatResolution.ts').WeaponEnchantment[]
    temporaryHitPointsSource?:string
    sourceEffectId?:number
    resolutionEffects?:import('../domain/dnd/CombatResolution.ts').EffectSpec[]
    spellLevel?:number
    castingSource?:'class'|'resource'|'free'
    castingAlternative?:number
    useOption?:string
    resourceCost?:number
    damageEnabled?:boolean
    instantaneous?:boolean
    requirementsConfirmed?:boolean
    targets?:{id:number;damage:string;resolved:boolean}[]
    execution?:{id:string;phase:'casting'|'resolving';option:string;cost:number}
}

export function advanceAbilityDurations(abilities: Ability[]): Ability[] {
    return abilities.map((ability) => ability.active && !ability.execution && ability.timed !== false && !ability.expiresAt ? { ...ability, remainingTurns: Math.max(0, ability.remainingTurns - 1) } : ability)
}

export function activateAbility(ability: Ability, combat?:Combat|null, participants:Pick<Participant,'id'>[]=[]): Ability {
    if (ability.active || (ability.remainingTurns === 0 && ability.timed !== false) || !ability.name.trim() || ability.ownerId === null) return ability
    if (ability.expiresAt && combat) {
        const owner=ability.expiryOwnerId ?? ability.ownerId,ownerIndex=participants.findIndex((p)=>p.id===owner),activeIndex=participants.findIndex((p)=>p.id===combat.activeId)
        if (ownerIndex<0 || activeIndex<0) return ability
        return {...ability,active:true,expiryRound:combat.round+(ownerIndex>activeIndex ? 0 : 1)}
    }
    return { ...ability, active: true }
}

export function advanceCombatAbilities(abilities:Ability[],previous:Combat,next:Combat):Ability[] {
    const timed=next.round>previous.round ? advanceAbilityDurations(abilities) : abilities
    const updated=timed.map((ability)=>{
        if (!ability.active || !ability.expiresAt) return ability
        const owner=ability.expiryOwnerId ?? ability.ownerId
        const event=ability.expiresAt==='end' ? previous : next
        if(['phb2014:spell:hold-person','phb2014:spell:false-life'].includes(ability.ruleId??'')&&owner===next.activeId&&ability.expiryRound!==undefined)return {...ability,remainingTurns:Math.max(0,ability.expiryRound-next.round)}
        return owner===event.activeId && event.round>=(ability.expiryRound ?? event.round) ? {...ability,remainingTurns:0} : ability
    })
    const parents=new Map(updated.filter(a=>a.ruleId==='phb2014:spell:hold-person').map(a=>[a.id,a]))
    return updated.map(a=>a.sourceEffectId!==undefined&&parents.has(a.sourceEffectId)?{...a,remainingTurns:parents.get(a.sourceEffectId)!.remainingTurns}:a)
}

export function removeParticipantAbilities(abilities: Ability[], participantIds: number[], remove: boolean): Ability[] {
    return abilities.flatMap((ability) => {
        if (ability.ownerId === null || !participantIds.includes(ability.ownerId)) return [ability]
        return remove ? [] : [{ ...ability, ownerId: null }]
    })
}
