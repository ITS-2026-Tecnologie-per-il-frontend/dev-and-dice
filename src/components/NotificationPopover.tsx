import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useDialogDismiss } from '../utils/Dialog'

type Props={id:string;title:string;label:string;closeLabel:string;iconPath:string;count?:number;newest?:number;storageKey?:string;open:boolean;onOpenChange:(open:boolean)=>void;children:ReactNode}

export function NotificationPopover({id,title,label,closeLabel,iconPath,count,newest=0,storageKey,open,onOpenChange,children}:Props) {
    const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),dismiss=useDialogDismiss()
    const saved=useMemo(()=>{try{const value=Number(storageKey?localStorage.getItem(storageKey):0);return Number.isSafeInteger(value)&&value>=0?value:0}catch{return 0}},[storageKey])
    const [opened,setOpened]=useState<{key:string;revision:number}>()
    const seen=Math.max(saved,opened?.key===storageKey?opened?.revision??0:0)
    const unseen=!!storageKey&&(count??0)>0&&newest>seen
    const rememberOpening=useCallback(()=>{
        if(!storageKey||newest<=seen)return
        setOpened({key:storageKey,revision:newest})
        // ponytail: remember openings in this browser; cross-device sync needs a server receipt.
        try{localStorage.setItem(storageKey,String(newest))}catch{/* Keep the receipt in memory when storage is unavailable. */}
    },[storageKey,newest,seen])
    // eslint-disable-next-line react/set-state-in-effect -- Persist arrivals from the external feed as opened while its window is visible.
    useEffect(()=>{if(open&&unseen)rememberOpening()},[open,unseen,rememberOpening])
    const placeDialog=useCallback(()=>{
        const element=dialog.current,button=trigger.current
        if (!element || !button) return
        const bounds=button.getBoundingClientRect(),width=Math.min(680,window.innerWidth-32),left=Math.max(16,Math.min(bounds.right-width,window.innerWidth-width-16)),top=bounds.bottom+window.scrollY+14
        element.style.setProperty('--notification-left',`${left+window.scrollX}px`)
        element.style.setProperty('--notification-top',`${top}px`)
        element.style.setProperty('--notification-arrow',`${bounds.left+bounds.width/2-left}px`)
        element.style.setProperty('--notification-height',`${Math.max(0,document.documentElement.scrollHeight-top-12)}px`)
    },[])
    useEffect(()=>{
        if (!open) return
        const observer=new ResizeObserver(placeDialog),root=document.getElementById('root')
        if (root) observer.observe(root)
        window.addEventListener('resize',placeDialog)
        return ()=>{observer.disconnect();window.removeEventListener('resize',placeDialog)}
    },[open,placeDialog])
    return <div className="play-notifications">
        <button ref={trigger} type="button" className="play-secondary play-notification-button" data-new={unseen||undefined} aria-label={label} aria-description={unseen?'Nuove notifiche da aprire':undefined} aria-haspopup="dialog" aria-controls={id} aria-expanded={open} onClick={()=>{
            if (!dialog.current) return
            placeDialog();dialog.current.showModal();rememberOpening();onOpenChange(true)
            const body=dialog.current.querySelector<HTMLElement>('.play-notifications-body')
            if (body) body.scrollTop=0
        }}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={iconPath}/></svg>
            {count!==undefined&&<span className="play-notification-count" data-unread={count>0} aria-hidden="true">{count}</span>}
        </button>
        <dialog ref={dialog} id={id} className="play-notification-dialog" aria-labelledby={id+'-title'} onClose={()=>{onOpenChange(false);trigger.current?.focus({preventScroll:true})}} {...dismiss}>
            <div className="play-notification-heading"><h2 id={id+'-title'}>{title}</h2><button type="button" className="play-secondary play-notification-close" aria-label={closeLabel} onClick={()=>dialog.current?.close()}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div>
            <div className="play-notifications-body">{children}</div>
        </dialog>
    </div>
}
