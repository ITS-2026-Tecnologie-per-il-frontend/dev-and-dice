import type { Ability, Combat } from '../../utils/Combat.ts'
import { activeEffects } from './CombatResolution.ts'

// 2014: D&D_5e_manuale_compatto_italiano.pdf (SRD 5.1), PDF 160, Folata di vento.
// The line triggers a Strength save only at the START of the creature's own turn.
// Entering the area, casting or redirecting the line later does not trigger it.
export function beginWindTurn(abilities:Ability[],combat:Combat,force=false):Ability[] {
    const active=new Set(activeEffects(abilities).filter(a=>a.ruleId==='phb2014:spell:gust-of-wind'&&!a.execution).map(a=>a.id))
    return abilities.map(a=>{
        if(!active.has(a.id))return a
        const previous=a.windSave?.turn
        if(!force&&previous?.round===combat.round&&previous.targetId===combat.activeId)return a
        return {...a,windSave:{...a.windSave,turn:{targetId:combat.activeId,round:combat.round,inLine:!!a.targets?.some(t=>t.id===combat.activeId)}}}
    })
}

export function pendingWindSaves(abilities:Ability[],combat:Combat|null):Ability[] {
    if(!combat)return []
    return activeEffects(abilities).filter(a=>{
        const turn=a.windSave?.turn
        return a.ruleId==='phb2014:spell:gust-of-wind'&&!a.execution&&turn?.targetId===combat.activeId&&turn.round===combat.round&&turn.inLine&&turn.success===undefined&&a.targets?.some(t=>t.id===combat.activeId)
    })
}

export function windSaveResults(abilities:Ability[],combat:Combat|null):Ability[] {
    if(!combat)return []
    return activeEffects(abilities).filter(a=>a.ruleId==='phb2014:spell:gust-of-wind'&&a.windSave?.turn?.targetId===combat.activeId&&a.windSave.turn.round===combat.round&&a.windSave.turn.inLine&&a.windSave.turn.success!==undefined)
}

export function resolveWindSave(abilities:Ability[],combat:Combat,effectId:number,success:boolean,dc?:number):Ability[] {
    if(!pendingWindSaves(abilities,combat).some(a=>a.id===effectId))return abilities
    return abilities.map(a=>a.id===effectId?{...a,windSave:{...a.windSave,...(dc===undefined?{}:{dc}),turn:{...a.windSave!.turn!,success}}}:a)
}

export function validWindSave(value:unknown):boolean {
    if(!value||typeof value!=='object'||Array.isArray(value))return false
    const save=value as Record<string,unknown>
    if(Object.keys(save).some(k=>!['dc','turn'].includes(k))||save.dc!==undefined&&!Number.isSafeInteger(save.dc))return false
    if(save.turn===undefined)return true
    if(!save.turn||typeof save.turn!=='object'||Array.isArray(save.turn))return false
    const turn=save.turn as Record<string,unknown>
    return Object.keys(turn).every(k=>['targetId','round','inLine','success'].includes(k))&&Number.isSafeInteger(turn.targetId)&&Number(turn.targetId)>=0&&Number.isSafeInteger(turn.round)&&Number(turn.round)>=1&&typeof turn.inLine==='boolean'&&(turn.success===undefined||turn.inLine&&typeof turn.success==='boolean')
}
