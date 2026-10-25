import type { Ability, Combat } from '../../utils/Combat.ts'
import type { CharacterSheet } from '../../utils/CharacterSheets.ts'
import { wearingArmor } from './CombatTargets.ts'
import { activeEffects, defenseProfile, conditionNames } from './CombatResolution.ts'
import { applySleepConditions, isSleep } from './Sleep.ts'

export function conditionEffectName(effect:Ability,abilities:Ability[]) {
    const condition=effect.resolutionEffects?.find(e=>e.kind==='condition')?.condition
    const source=abilities.find(a=>a.id===effect.sourceEffectId)
    return condition&&source?`${conditionNames[condition as keyof typeof conditionNames]??condition} - ${source.name}`:effect.name
}

export function conditionsFor(abilities:Ability[],targetId:number) {
    return [...new Set(activeEffects(abilities).filter(a=>a.targets?.length?a.targets.some(t=>t.id===targetId):a.ownerId===targetId)
        .flatMap(a=>a.resolutionEffects?.filter(e=>e.kind==='condition').map(e=>isSleep(a)&&e.condition==='unconscious'?'Addormentato':conditionNames[e.condition as keyof typeof conditionNames]??e.condition!)??[]))]
}

export function isIncapacitated(abilities:Ability[],targetId:number):boolean {
    return activeEffects(abilities).some(a=>isSleep(a)&&a.targets?.some(t=>t.id===targetId)||(a.targets?.length?a.targets.some(t=>t.id===targetId):a.ownerId===targetId)&&a.resolutionEffects?.some(e=>e.kind==='condition'&&['unconscious','paralyzed','incapacitated','stunned'].includes(e.condition??'')))
}

// D&D_5_Player_Original_Handbook.pdf, PDF 291–293, Conditions; PDF 189, Bonus Actions.
// Revised rules checked separately in D&D_5.5_manuale_compatto_italiano.pdf,
// PDF 202, 204, 208, 210–211, 216, 218. Paralysis also imposes the revised
// Incapacitated penalty to initiative; the other summaries below are shared.
export function conditionHelp(condition:string,edition:'2014'|'2024'):string[] {
    switch(condition){
        case 'Addormentato':return ['Sonno magico: sei privo di sensi. Non puoi muoverti, parlare, compiere azioni, azioni bonus o reazioni. La concentrazione termina.','Lasci cadere ciò che impugni e cadi prono. Fallisci automaticamente i TS su Forza e Destrezza.','Gli attacchi contro di te hanno vantaggio; un attacco che colpisce da entro 1,5 m è critico.','Ti svegli se subisci danni, se qualcuno usa un’azione per scuoterti o schiaffeggiarti, oppure quando termina Sonno. Dopo il risveglio resti prono finché non ti rialzi.']
        case 'Paralizzato':return ['Non puoi muoverti, parlare, compiere azioni, azioni bonus o reazioni. La concentrazione termina.','Fallisci automaticamente i TS su Forza e Destrezza.','Gli attacchi contro di te hanno vantaggio; se chi ti colpisce è entro 1,5 m, il colpo è critico.',...(edition==='2024'?['Svantaggio al tiro di iniziativa.']:[])]
        case 'Trattenuto':return ['Velocità 0; i bonus alla velocità non si applicano.','Svantaggio ai tuoi attacchi e ai TS su Destrezza. Gli attacchi contro di te hanno vantaggio.']
        case 'Spaventato':return ['Svantaggio agli attacchi e alle prove di caratteristica finché vedi la fonte della paura.','Non puoi avvicinarti volontariamente alla fonte della paura.']
        case 'Accecato':return ['Non puoi vedere e fallisci le prove che richiedono la vista.','Svantaggio ai tuoi attacchi; gli attacchi contro di te hanno vantaggio.']
        case 'Avvelenato':return ['Svantaggio agli attacchi e alle prove di caratteristica.']
        case 'Prono':return ['Puoi muoverti strisciando; rialzarti richiede metà della tua velocità e termina lo stato. Con velocità 0 non puoi rialzarti.','Svantaggio ai tuoi attacchi. Gli attacchi contro di te hanno vantaggio entro 1,5 m, svantaggio da più lontano.']
        default:return ['Effetti da verificare nella descrizione della fonte.']
    }
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
export function settleCombatEffects<T extends {id:number;description?:string;sheet?:CharacterSheet;temporaryHitPoints?:string;concentrationChecks?:number[]}>(abilities:Ability[],turns:T[],combat?:Combat|null) {
    abilities=applySleepConditions(abilities,turns,combat)
    // PHB 2014 PDF 257: donning armor ends Mage Armor; removing it does not revive the cast.
    const current=abilities.map(ability=>ability.active&&ability.ruleId==='phb2014:spell:mage-armor'&&ability.targets?.some(target=>{
        const sheet=turns.find(turn=>turn.id===target.id)?.sheet
        return sheet&&wearingArmor(sheet)
    })?{...ability,active:false,execution:undefined,remainingTurns:0}:ability)
    const incapacitated=endIncapacitatedConcentration(current,turns)
    const settled=finishEmptyHoldPerson(incapacitated.abilities,incapacitated.turns)
    const active=activeEffects(settled.abilities)
    const sources=new Set(active.map(a=>a.temporaryHitPointsSource).filter(Boolean))
    return {...settled,turns:settled.turns.map(turn=>{
        let sheet=turn.sheet,temporaryHitPoints=turn.temporaryHitPoints
        const source=sheet?.playerDetails?.['temporaryHitPoints.source']
        if(source&&!sources.has(source)){
            temporaryHitPoints='0'
            sheet={...sheet!,playerDetails:{...sheet!.playerDetails,temporaryHitPoints:'0','temporaryHitPoints.source':''}}
        }
        if(sheet){
            const d=sheet.playerDetails??{},automatic=d['temporaryAC.source']==='effects'
            // ponytail: scan the bounded combat lists; index effects by target for larger battles.
            const affected=active.some(effect=>(effect.targets?.length?effect.targets.some(target=>target.id===turn.id):effect.ownerId===turn.id)&&effect.resolutionEffects?.some(modifier=>modifier.kind==='ac'||modifier.kind==='ac-base'))
            const armorClass=affected?defenseProfile(sheet,undefined,active,turn.id).armorClass:undefined
            const temporary=armorClass===undefined?automatic?d['temporaryAC.previous']??'':d.temporaryAC??'':String(armorClass)
            const marker=armorClass===undefined?'':'effects',previous=armorClass===undefined?'':automatic?d['temporaryAC.previous']??'':d.temporaryAC??''
            if((affected||automatic)&&(d.temporaryAC!==temporary||(d['temporaryAC.source']??'')!==marker||(d['temporaryAC.previous']??'')!==previous))
                sheet={...sheet,playerDetails:{...d,temporaryAC:temporary,'temporaryAC.source':marker,'temporaryAC.previous':previous}}
        }
        return sheet!==turn.sheet?{...turn,sheet,temporaryHitPoints}:turn
    })}
}
