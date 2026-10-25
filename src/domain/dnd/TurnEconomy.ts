import {spellEdition} from '../../utils/Spellcasting.ts'
import type {CharacterSheet} from '../../utils/CharacterSheets.ts'
import type {Ability} from '../../utils/Combat.ts'
import {activeEffects,hasteActionRestriction} from './CombatResolution.ts'

export const turnActionNames={action:'Azione','bonus-action':'Bonus',reaction:'Reazione'} as const
export type TurnAction=keyof typeof turnActionNames
type TurnGrant={unit:TurnAction;amount:number;source:string;restriction?:string}
const keys:Record<TurnAction,string>={action:'action','bonus-action':'bonusAction',reaction:'reaction'}
const count=(value:string|undefined)=>value&&/^\d+$/.test(value)&&Number.isSafeInteger(Number(value))?Number(value):0

function savedGrants(sheet:CharacterSheet):TurnGrant[] {
    try{
        const grants:unknown=JSON.parse(sheet.playerDetails?.['combat.actionGrants']??'[]')
        return Array.isArray(grants)?grants.filter(g=>g&&Object.hasOwn(turnActionNames,g.unit)&&Number.isInteger(g.amount)&&g.amount>=1&&g.amount<=10&&typeof g.source==='string'&&g.source.length<=160&&(g.restriction===undefined||typeof g.restriction==='string'&&g.restriction.length<=500)):[]
    }catch{return []}
}

export function grantTurnActions(sheet:CharacterSheet,grants:TurnGrant[]):CharacterSheet {
    return {...sheet,playerDetails:{...sheet.playerDetails,'combat.actionGrants':JSON.stringify([...savedGrants(sheet),...grants])}}
}

export function turnActionUses(sheet:CharacterSheet,unit:TurnAction):number {
    const d=sheet.playerDetails??{}
    let history:unknown=[]
    try{history=JSON.parse(d['combat.spellsThisTurn']??d['rules2014.spellsThisTurn']??'[]')}catch{/* Legacy malformed histories must not break the inspector. */}
    return Math.max(count(d[`combat.${keys[unit]}Uses`]),d[`combat.${keys[unit]}Used`]==='true'?1:0,Array.isArray(history)?history.filter(c=>c?.unit===unit).length:0)
}

// PHB 2014, PDF 190–191: these resources refresh at the start of their owner's turn.
export const resetTurnEconomy={'combat.actionUsed':'false','combat.bonusActionUsed':'false','combat.reactionUsed':'false','combat.actionUses':'0','combat.bonusActionUses':'0','combat.reactionUses':'0','combat.attackActionRemaining':'0','combat.actionGrants':'[]'}

export function recordTurnAction(sheet:CharacterSheet,unit:TurnAction,previous=sheet,weaponAttack=false):CharacterSheet {
    const d=sheet.playerDetails??{},remaining=count(previous.playerDetails?.['combat.attackActionRemaining'])
    // PHB 2014, PDF 193 (Attack), 73 (Extra Attack): separate attack rolls share one action.
    const continued=weaponAttack&&remaining>0
    return {...sheet,playerDetails:{...d,[`combat.${keys[unit]}Used`]:'true',[`combat.${keys[unit]}Uses`]:String(turnActionUses(previous,unit)+(continued?0:1)),...(weaponAttack?{'combat.attackActionRemaining':String(continued?remaining-1:Math.max(0,count(previous.playerDetails?.['rules2014.attackActionAttacks'])-1))}:{})}}
}

export function turnActionSlots(sheet:CharacterSheet,abilities:Ability[],ownerId:number|undefined,inCombat=true) {
    const grants=new Map<string,TurnGrant&{temporary?:boolean}>((inCombat?savedGrants(sheet):[]).map((g,index)=>[`instant:${index}`,{...g,temporary:true}]))
    for(const ability of inCombat?activeEffects(abilities):[]){
        if(ownerId===undefined||!(ability.targets?.length?ability.targets.some(t=>t.id===ownerId):ability.ownerId===ownerId))continue
        const effects=ability.resolutionEffects??[]
        // PHB 2014, PDF 251: also recognize older manually resolved Haste casts.
        const haste=spellEdition(sheet)==='2014'&&ability.ruleId==='phb2014:spell:haste'&&ability.targets?.some(t=>t.id===ownerId)&&!effects.some(e=>e.kind==='action-grant')
        for(const effect of haste?[...effects,{kind:'action-grant' as const,unit:'action' as const,amount:1,restriction:hasteActionRestriction}]:effects){
            if(effect.kind!=='action-grant'||!effect.unit)continue
            // Same-spell grants do not stack (PHB 2014, PDF 206, Combining Magical Effects).
            const key=`${ability.ruleId??ability.id}:${effect.unit}`,old=grants.get(key)
            if(!old||old.amount<(effect.amount??1))grants.set(key,{unit:effect.unit,amount:effect.amount??1,source:ability.name,restriction:effect.restriction})
        }
    }
    return (Object.keys(turnActionNames) as TurnAction[]).flatMap(unit=>{
        const sources=[{source:'',restriction:undefined as string|undefined,temporary:false},...Array.from(grants.values()).filter(g=>g.unit===unit).flatMap(g=>Array.from({length:g.amount},()=>({source:g.source,restriction:g.restriction,temporary:g.temporary??false})))]
        const uses=inCombat?turnActionUses(sheet,unit):0
        // ponytail: at most 20 inferred legacy boxes; use a numeric badge if larger budgets are needed.
        // Retain extra actions explicitly confirmed by the Master in legacy casting flows.
        while(sources.length<uses&&sources.length<20)sources.push({source:'Azione aggiuntiva confermata dal Master',restriction:undefined,temporary:true})
        return sources.map((grant,index)=>({unit,index,used:index<uses,...grant}))
    })
}

export function turnActionCapacity(sheet:CharacterSheet,abilities:Ability[],ownerId:number|undefined,unit:TurnAction):number {
    return turnActionSlots({...sheet,playerDetails:{...sheet.playerDetails,...resetTurnEconomy,'combat.actionGrants':sheet.playerDetails?.['combat.actionGrants']??'[]','combat.spellsThisTurn':'[]','rules2014.spellsThisTurn':'[]'}},abilities,ownerId).filter(slot=>slot.unit===unit).length
}
