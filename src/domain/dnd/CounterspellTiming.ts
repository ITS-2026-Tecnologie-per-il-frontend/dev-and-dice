// Session policy, separate from the 2014 spell rules. Each cast keeps its original policy.
export type CounterspellSettings={mode:'event'|'timer';seconds:number}
export type CounterspellWindow=CounterspellSettings & {expiresAt:number}
export const defaultCounterspellSettings:CounterspellSettings={mode:'event',seconds:30}
export function validCounterspellSettings(value:unknown):value is CounterspellSettings {
    if(!value||typeof value!=='object'||Array.isArray(value))return false
    const v=value as Record<string,unknown>
    return Object.keys(v).every(k=>k==='mode'||k==='seconds')&&(v.mode==='event'||v.mode==='timer')&&Number.isSafeInteger(v.seconds)&&Number(v.seconds)>=1&&Number(v.seconds)<=3600
}
export function validCounterspellWindow(value:unknown):value is CounterspellWindow {
    if(!value||typeof value!=='object'||Array.isArray(value))return false
    const {expiresAt,...settings}=value as Record<string,unknown>
    return validCounterspellSettings(settings)&&typeof expiresAt==='number'&&Number.isSafeInteger(expiresAt)&&expiresAt>0
}
export function createCounterspellWindow(settings:CounterspellSettings=defaultCounterspellSettings,now=Date.now()):CounterspellWindow{return {...settings,expiresAt:now+settings.seconds*1000}}
export function counterspellWindowOpen(window:CounterspellWindow|undefined,currentEvent:boolean,now=Date.now(),acceptedAt?:string){
    if(window?.mode!=='timer')return currentEvent
    return window.expiresAt>now||acceptedAt!==undefined&&Number.isFinite(Date.parse(acceptedAt))&&Date.parse(acceptedAt)<=window.expiresAt
}
