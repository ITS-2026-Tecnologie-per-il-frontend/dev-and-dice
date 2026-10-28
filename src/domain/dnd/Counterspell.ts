import {abilityModifier,characterLevel,integerValue,type CharacterSheet} from '../../utils/CharacterSheets.ts'
import {classId,classLevel,spellEdition} from '../../utils/Spellcasting.ts'
import {spellAttackAbility,saveNames,type SaveAbility} from './CombatResolution.ts'
import type {CreationData} from '../../utils/PlayerCreation.ts'

// 2014 only: D&D_5_Player_Original_Handbook.pdf, PDF 229 Counterspell,
// PDF 55 Jack of All Trades, PDF 116 Improved Abjuration. No attack or save roll.
export const counterspellId='phb2014:spell:counterspell'
export type CounterspellTarget={key:string;actorId:number;casterName:string;name?:string;level?:number;requestId?:string;abilityId?:number;eventId?:string;unavailableActors?:number[]}
export type CounterspellModifier={ability?:SaveAbility;total?:number;sources:{label:string;amount:number}[]}
export type CounterspellDecision={confirmed?:boolean;spellName?:string;level?:number;die?:number;secondDie?:number;rollMode?:'normal'|'advantage'|'disadvantage';bonus?:number;bonusReason?:string;modifierOverride?:number}
export type CounterspellResult={level:number;slotLevel:number;automatic:boolean;success:boolean;dc?:number;die?:number;secondDie?:number;rollMode?:'normal'|'advantage'|'disadvantage';modifier?:number;bonus?:number;bonusReason?:string;total?:number}
export type CounterspellSnapshot={edition:'2014';actorId:number;target:CounterspellTarget;slotLevel:number;modifier:CounterspellModifier;result?:CounterspellResult}
export type CounterspellChoices={revision:number;ownerId:number;blockedReason?:string;modifier:CounterspellModifier;options:{id:string;level?:number;label:string;remaining:number|null;cost?:number}[];targets:CounterspellTarget[]}
export function counterspellModifier(sheet:CharacterSheet,data?:CreationData):CounterspellModifier {
    if(spellEdition(sheet)!=='2014')throw new Error('Controincantesimo: questo form usa soltanto le regole 2014.')
    const ability=spellAttackAbility(sheet,data),value=ability?abilityModifier(sheet[ability]):undefined
    const sources:CounterspellModifier['sources']=[]
    if(value!==undefined&&ability)sources.push({label:saveNames[ability],amount:value})
    const level=(id:string)=>integerValue(sheet.playerDetails?.['rules2014.level.'+id])??(classId(sheet)===id?classLevel(sheet,id):0)
    const proficiency=integerValue(sheet.playerDetails?.proficiencyBonus)??(characterLevel(sheet)?2+Math.floor((characterLevel(sheet)!-1)/4):undefined)
    const abjurer=level('wizard')>=10&&['abjuration','wizard-abjuration'].includes(sheet.playerDetails?.['creation.subclass']??'')
    if(proficiency!==undefined&&abjurer)sources.push({label:'Abiurazione Migliorata',amount:proficiency})
    else if(proficiency!==undefined&&level('bard')>=2)sources.push({label:'Factotum (met\u00e0 competenza)',amount:Math.floor(proficiency/2)})
    return {ability,total:value===undefined?undefined:sources.reduce((n,s)=>n+s.amount,0),sources}
}
const int=(n:unknown,min:number,max:number)=>Number.isSafeInteger(n)&&Number(n)>=min&&Number(n)<=max
export function resolveCounterspell(slotLevel:number,level:number,modifier:number|undefined,decision:CounterspellDecision={}):CounterspellResult {
    if(!int(slotLevel,3,9)||!int(level,0,9))throw new Error('Indica livelli validi: slot dal 3 al 9, lancio avversario da 0 a 9.')
    if(level<=slotLevel)return {level,slotLevel,automatic:true,success:true}
    const mode=decision.rollMode??'normal',die=decision.die,second=decision.secondDie,bonus=decision.bonus??0
    if(!['normal','advantage','disadvantage'].includes(mode)||!int(die,1,20)||mode!=='normal'&&!int(second,1,20)||mode==='normal'&&second!==undefined)throw new Error('Inserisci i d20 richiesti dalla modalit\u00e0 della prova.')
    if(!int(bonus,-100,100)||bonus!==0&&(!decision.bonusReason?.trim()||decision.bonusReason.length>300))throw new Error('Specifica il valore e la provenienza degli altri modificatori.')
    const actual=modifier??decision.modifierOverride
    if(!int(actual,-100,100))throw new Error('Completa la caratteristica da incantatore o indica il modificatore verificato dal Master.')
    const used=mode==='advantage'?Math.max(die!,second!):mode==='disadvantage'?Math.min(die!,second!):die!
    const dc=10+level,total=used+actual!+bonus
    return {level,slotLevel,automatic:false,success:total>=dc,dc,die,secondDie:mode==='normal'?undefined:second,rollMode:mode,modifier:actual,bonus,bonusReason:bonus?decision.bonusReason?.trim():undefined,total}
}
export function validCounterspellIntent(v:unknown):v is {actorId:number;targetKey:string;requirementsConfirmed:true} {
    if(!v||typeof v!=='object'||Array.isArray(v))return false
    const c=v as Record<string,unknown>
    return Object.keys(c).every(k=>['actorId','targetKey','requirementsConfirmed'].includes(k))&&int(c.actorId,0,Number.MAX_SAFE_INTEGER)&&typeof c.targetKey==='string'&&/^((?:request|event):[a-f\d-]{36}|ability:\d+|manual:\d+)$/.test(c.targetKey)&&c.requirementsConfirmed===true
}
export function validCounterspellSnapshot(v:unknown):v is CounterspellSnapshot {
    if(!v||typeof v!=='object'||Array.isArray(v))return false
    const c=v as CounterspellSnapshot
    return c.edition==='2014'&&int(c.actorId,0,Number.MAX_SAFE_INTEGER)&&int(c.slotLevel,3,9)&&!!c.target&&validCounterspellIntent({actorId:c.target.actorId,targetKey:c.target.key,requirementsConfirmed:true})&&typeof c.target.casterName==='string'&&c.target.casterName.length<=20000&&(c.target.name===undefined||typeof c.target.name==='string'&&c.target.name.length<=20000)&&(c.target.level===undefined||int(c.target.level,0,9))&&!!c.modifier&&Array.isArray(c.modifier.sources)&&c.modifier.sources.every(s=>typeof s.label==='string'&&Number.isSafeInteger(s.amount))&&(c.modifier.total===undefined||Number.isSafeInteger(c.modifier.total))&&(!c.result||int(c.result.level,0,9)&&c.result.slotLevel===c.slotLevel&&typeof c.result.success==='boolean'&&typeof c.result.automatic==='boolean')
}
