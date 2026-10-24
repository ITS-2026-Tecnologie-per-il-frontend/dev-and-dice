import { useRef, useState } from 'react'
import type { Ability } from '../utils/Combat'
import type { CharacterSheet } from '../utils/CharacterSheets'
import type { CreationData } from '../utils/PlayerCreation'
import { conditionEffectName } from '../domain/dnd/CombatConditions'
import { defenseProfile, resolveTarget, type ResolutionPlan, type ResolutionRolls } from '../domain/dnd/CombatResolution'
import { ResolutionDetails, MasterSavingRolls, type ResolutionReview } from './CombatRolls'

export function RepeatSavingThrow({effect,target,abilities,data,onResolve,timing='end'}:{timing?:'start'|'end';effect:Ability;target:{id:number;description:string;sheet:CharacterSheet};abilities:Ability[];data?:CreationData;onResolve:(success:boolean,consumed:number[],dc:number|undefined)=>boolean|void}) {
    const save=effect.repeatSaveRoll!,working=useRef(false)
    const [rolls,setRolls]=useState<ResolutionRolls>({}),[dc,setDC]=useState(save.dc===undefined?'':String(save.dc))
    const validDC=/^\d+$/.test(dc)&&Number.isSafeInteger(Number(dc))
    const plan:ResolutionPlan={edition:'2014',kind:'save',damageTypes:[],damageHint:'',save:{ability:save.ability,dc:validDC?Number(dc):undefined,onSuccess:'none'},maximumPackets:null,sharedDamage:false,magical:true,effects:[],notes:[]}
    const profile=defenseProfile(target.sheet,save.ability,abilities,target.id,undefined,data)
    const result=resolveTarget(plan,[{targetId:target.id,damage:[]}],profile,rolls)
    function finish(success:boolean,consumed:number[]) {
        if(working.current)return
        working.current=true
        if(onResolve(success,consumed,validDC?Number(dc):undefined)===false)working.current=false
    }
    const request:ResolutionReview={id:String(effect.id),status:'pending',mode:'save',damageEnabled:false,resolution:plan,targets:[{id:target.id,name:target.description,roll:'',hit:false,damageRoll:'',damage:'0',resolution:result}]}
    return <section className="combat-request combat-request--review master-spell-review">
        <p>{conditionEffectName(effect,abilities)} · {timing==='start'?'TS di inizio turno. Se fallisce, spingi la creatura di 4,5 m lontano dal lanciatore lungo la linea. Il vento rimane attivo.':'TS di fine turno. Un successo termina questo effetto sul bersaglio.'}</p>
        {save.dc===undefined&&<label>CD dell’incantesimo<input aria-label="CD del tiro salvezza ripetuto" type="number" min="0" step="1" value={dc} onChange={event=>setDC(event.target.value)}/></label>}
        <ResolutionDetails request={request} review renderTarget={()=>null} renderSave={target=><MasterSavingRolls request={request} target={target} disabled={!validDC} onDecide={async(id,decision,body)=>{
            if(id!==request.id||decision!=='roll'||!body||typeof body!=='object')throw new Error('Tiro non valido.')
            const {kind,value,targetId,effectId}=body as Record<string,unknown>
            if(targetId!==target.id||typeof value!=='number'||!Number.isSafeInteger(value)||value<0)throw new Error('Risultato non valido.')
            if(kind==='bonus-save') {
                const die=profile.saveDice?.find(d=>d.id===effectId)
                if(!die||value>die.sides||value<(die.sign===-1?1:0))throw new Error('Dado bonus non valido.')
                setRolls(current=>({...current,saveBonuses:{...current.saveBonuses,[String(effectId)]:value}}))
            } else if((kind==='save'||kind==='save-second')&&value>=1&&value<=20&&(kind==='save'||result.save?.needsSecondDie&&rolls.save!==undefined))setRolls(current=>({...current,[kind==='save'?'save':'saveSecond']:value}))
            else throw new Error('Tiro non previsto.')
        }}/>}/>
        <button className="play-primary" type="button" disabled={!validDC||result.save?.success===undefined||!!result.save.needsSecondDie||!!result.save.needsBonusDice?.length} onClick={()=>finish(result.save!.success!,profile.saveDice?.filter(d=>d.consume&&(rolls.saveBonuses?.[d.id]??0)>0).map(d=>d.id)??[])}>Conferma tiro salvezza</button>
        {timing==='end'&&<button className="play-secondary" type="button" onClick={()=>finish(false,[])}>Non ripetere il TS: mantieni l’effetto</button>}
    </section>
}
