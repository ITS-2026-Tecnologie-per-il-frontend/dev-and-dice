/* eslint-disable react/only-export-components -- Shared clock and component stay together for the two reaction forms. */
import {useEffect,useLayoutEffect,useRef,useState} from 'react'
import type {ReactionWindow} from '../utils/PlayApi'

export type ReactionClock={expiresAt:number;deadline:number}
export function syncClock(clock:ReactionClock,expiresAt:number,serverNow:number){
    // Keep the same local deadline across delayed polls and collapsed/expanded panels.
    if(expiresAt<=clock.expiresAt)return
    clock.expiresAt=expiresAt
    clock.deadline=performance.now()+Math.max(0,expiresAt-serverNow)
}


// Keep the shared clock independent from the roll fields and their target lists.
export function ReactionCountdown({window,clock,busy=false,onRestart,compact=false,running=true,seconds=30}:{window:Pick<ReactionWindow,'expiresAt'|'serverNow'>;clock:{current:ReactionClock};busy?:boolean;onRestart?:()=>void;compact?:boolean;running?:boolean;seconds?:number}){
    const [remaining,setRemaining]=useState(seconds)
    useLayoutEffect(()=>{
        syncClock(clock.current,window.expiresAt,window.serverNow)
        // eslint-disable-next-line react/set-state-in-effect -- Synchronize the renewed server deadline before paint.
        setRemaining(Math.max(0,Math.ceil((clock.current.deadline-performance.now())/1000)))
    },[window.expiresAt,window.serverNow,clock])
    useEffect(()=>{
        if(!running)return
        const tick=()=>setRemaining(Math.max(0,Math.ceil((clock.current.deadline-performance.now())/1000)))
        tick()
        const timer=setInterval(tick,250)
        return()=>clearInterval(timer)
    },[running,clock])
    const timer=<strong role="timer" aria-label="Tempo rimasto per reagire">{remaining} s</strong>
    return compact?<>{timer} · In attesa della scelta</>:<div className="reaction-countdown">{timer}<button type="button" className="play-secondary" aria-label="Riavvia timer" disabled={busy||remaining===0} onClick={onRestart}>Riavvia</button><progress max={seconds} value={remaining} aria-label="Tempo rimasto"/></div>
}


/** Same inactivity renewal for reaction popups and the Counterspell sidebar. */
export function useReactionActivity(renew:()=>Promise<void>,enabled:boolean,seconds:number,onError:(message:string)=>void){
    const pending=useRef<Promise<void>>(Promise.resolve()),last=useRef(-Infinity)
    function interact(){
        if(!enabled||performance.now()-last.current<Math.min(1000,seconds*250))return
        last.current=performance.now()
        pending.current=pending.current.catch(()=>{}).then(renew)
        // Report failures without leaving an unhandled rejection; submit still awaits the original promise.
        void pending.current.catch(error=>onError(error instanceof Error?error.message:'Riavvio del timer non riuscito.'))
    }
    return {interact,flush:()=>pending.current}
}
