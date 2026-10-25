export type ReadyCommand={kind:'prepare-sleep'|'prepare-wake'|'release'|'cancel';actorId:number;effectId?:number;trigger?:string;option?:string;targetId?:number;area?:number[];sleepRoll?:number}
export type ReadiedAction={kind:'sleep'|'wake';trigger:string;targetId?:number}
const integer=(n:unknown):n is number=>Number.isSafeInteger(n)&&Number(n)>=0
export function validReadyCommand(value:unknown):value is ReadyCommand {
    if(!value||typeof value!=='object'||Array.isArray(value))return false
    const c=value as Record<string,unknown>
    if(Object.keys(c).some(k=>!['kind','actorId','effectId','trigger','option','targetId','area','sleepRoll'].includes(k))||!integer(c.actorId))return false
    if(c.kind==='prepare-sleep'||c.kind==='prepare-wake')return typeof c.trigger==='string'&&c.trigger.trim().length>0&&c.trigger.length<=500&&c.effectId===undefined&&c.area===undefined&&c.sleepRoll===undefined&&(c.kind==='prepare-sleep'?typeof c.option==='string'&&/^slot:[1-9]$/.test(c.option)&&c.targetId===undefined:integer(c.targetId)&&c.option===undefined)
    if(!['release','cancel'].includes(String(c.kind))||!integer(c.effectId)||c.trigger!==undefined||c.option!==undefined||c.targetId!==undefined)return false
    return c.kind==='cancel'?c.area===undefined&&c.sleepRoll===undefined:(c.area===undefined&&c.sleepRoll===undefined||Array.isArray(c.area)&&c.area.length<=1000&&c.area.every(integer)&&new Set(c.area).size===c.area.length&&integer(c.sleepRoll))
}
export function validReadiedAction(value:unknown):value is ReadiedAction {
    if(!value||typeof value!=='object'||Array.isArray(value))return false
    const r=value as Record<string,unknown>
    return Object.keys(r).every(k=>['kind','trigger','targetId'].includes(k))&&typeof r.trigger==='string'&&r.trigger.trim().length>0&&r.trigger.length<=500&&(r.kind==='sleep'&&r.targetId===undefined||r.kind==='wake'&&integer(r.targetId))
}
