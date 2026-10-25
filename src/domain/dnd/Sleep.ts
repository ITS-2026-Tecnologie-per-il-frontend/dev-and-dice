export type SleepTarget = { id:number; hitPoints?:number; unavailableReason?:string }
export type SleepReviewData = { candidates:(SleepTarget&{name?:string})[]; area?:number[]; selected:number[] }

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
