import type { Ability, Combat } from '../../utils/Combat.ts'
import type { CharacterSheet } from '../../utils/CharacterSheets.ts'
import { activeEffects, conditionNames } from './CombatResolution.ts'

export function conditionEffectName(effect:Ability,abilities:Ability[]) {
    const condition=effect.resolutionEffects?.find(e=>e.kind==='condition')?.condition
    const source=abilities.find(a=>a.id===effect.sourceEffectId)
    return condition&&source?`${conditionNames[condition as keyof typeof conditionNames]??condition} - ${source.name}`:effect.name
}

export function conditionsFor(abilities:Ability[],targetId:number) {
    return [...new Set(activeEffects(abilities).filter(a=>a.targets?.length?a.targets.some(t=>t.id===targetId):a.ownerId===targetId)
        .flatMap(a=>a.resolutionEffects?.filter(e=>e.kind==='condition').map(e=>conditionNames[e.condition as keyof typeof conditionNames]??e.condition!)??[]))]
}

// PHB 2014, D&D_5_Player_Original_Handbook.pdf, PDF 252, Hold Person:
// a separate Wisdom save at the END of each affected target's turn.
export function pendingRepeatSaves(abilities:Ability[],combat:Combat|null) {
    if(!combat)return []
    const active=activeEffects(abilities)
    // Older Hold Person saves did not store the original DC. Ask the Master for
    // that missing value instead of silently using the caster's current DC.
    return active.map(a=>!a.repeatSaveRoll&&a.repeatSave&&active.some(parent=>parent.id===a.sourceEffectId&&parent.ruleId==='phb2014:spell:hold-person')?{...a,repeatSaveRoll:{ability:'wisdom' as const,timing:'end' as const}}:a)
        .filter(a=>a.ownerId===combat.activeId&&a.repeatSaveRoll?.timing==='end'&&a.repeatSaveRoll.lastRound!==combat.round)
}

// UI policy: when Hold Person has no affected targets, close the cast and release
// its now-unused concentration. PHB 2014 PDF 252 ends the effect on each saved target;
// PDF 204 allows the caster to stop concentrating at any time without an action.
export function finishEmptyHoldPerson<T extends {id:number;sheet?:CharacterSheet;concentrationChecks?:number[]}>(abilities:Ability[],turns:T[]) {
    const active=activeEffects(abilities),participants=new Set(turns.map(t=>t.id))
    // ponytail: O(n²) within the 2,000-effect combat limit; index children by
    // sourceEffectId if larger battles are supported.
    const finished=abilities.filter(a=>a.ruleId==='phb2014:spell:hold-person'&&!a.execution&&(a.active||a.remainingTurns===0)&&!active.some(child=>child.sourceEffectId===a.id&&participants.has(child.ownerId!)&&child.resolutionEffects?.some(e=>e.kind==='condition'&&e.condition==='paralyzed')))
    if(!finished.length)return {abilities,turns}
    const ids=new Set(finished.map(a=>a.id)),stillConcentrating=new Set(active.filter(a=>a.concentration&&!ids.has(a.id)).map(a=>a.ownerId))
    return {
        abilities:abilities.filter(a=>!ids.has(a.id)&&!ids.has(a.sourceEffectId!)),
        turns:turns.map(turn=>!stillConcentrating.has(turn.id)&&finished.some(a=>a.ownerId===turn.id&&turn.sheet?.playerDetails?.['rules2014.concentration']===(a.ruleId??a.catalogId??a.name))?{...turn,concentrationChecks:[],sheet:{...turn.sheet!,playerDetails:{...turn.sheet!.playerDetails,'rules2014.concentration':''}}}:turn),
    }
}

// Same PDF, pp. 204 and 291–292: paralysis incapacitates and breaks concentration.
// Revised rules checked separately: D&D_5.5_manuale_compatto_italiano.pdf
// (SRD 5.2.1), PDF 206 and 208, Concentration / Incapacitated.
export function endIncapacitatedConcentration<T extends {id:number;sheet?:CharacterSheet;concentrationChecks?:number[]}>(abilities:Ability[],turns:T[]) {
    const incapacitated=new Set(activeEffects(abilities).filter(a=>a.resolutionEffects?.some(e=>e.kind==='condition'&&['paralyzed','incapacitated','stunned','unconscious'].includes(e.condition??'')))
        .flatMap(a=>a.targets?.length?a.targets.map(t=>t.id):a.ownerId===null?[]:[a.ownerId]))
    return {
        abilities:abilities.map(a=>incapacitated.has(a.ownerId!)&&(a.concentration||a.execution?.phase==='casting')?{...a,active:false,execution:undefined,remainingTurns:0}:a),
        turns:turns.map(turn=>incapacitated.has(turn.id)&&turn.sheet?.playerDetails?.['rules2014.concentration']?{...turn,concentrationChecks:[],sheet:{...turn.sheet,playerDetails:{...turn.sheet.playerDetails,'rules2014.concentration':''}}}:turn),
    }
}

// PHB 2014 PDF 199, 240: expire only the pool granted by this cast.
// Legacy/manual pools have no source and remain under the Master's control.
export function settleCombatEffects<T extends {id:number;sheet?:CharacterSheet;temporaryHitPoints?:string;concentrationChecks?:number[]}>(abilities:Ability[],turns:T[]) {
    const settled=finishEmptyHoldPerson(abilities,turns)
    const sources=new Set(activeEffects(settled.abilities).map(a=>a.temporaryHitPointsSource).filter(Boolean))
    return {...settled,turns:settled.turns.map(turn=>{
        const source=turn.sheet?.playerDetails?.['temporaryHitPoints.source']
        return source&&!sources.has(source)?{...turn,temporaryHitPoints:'0',sheet:{...turn.sheet!,playerDetails:{...turn.sheet!.playerDetails,temporaryHitPoints:'0','temporaryHitPoints.source':''}}}:turn
    })}
}
