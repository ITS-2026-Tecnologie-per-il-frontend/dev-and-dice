export type KeyboardShortcut = {key:string;ctrlKey:boolean;altKey:boolean;shiftKey:boolean;metaKey:boolean}
type KeyEvent = Pick<KeyboardEvent,'key'|'ctrlKey'|'altKey'|'shiftKey'|'metaKey'|'repeat'|'isComposing'|'defaultPrevented'>
export const nextTurnShortcutKey='dev-and-dice.next-turn-shortcut.v1'
export const defaultNextTurnShortcut:KeyboardShortcut={key:'p',ctrlKey:false,altKey:false,shiftKey:false,metaKey:false}
const modifiers=['Control','Alt','Shift','Meta','AltGraph','OS','Dead','Unidentified']

export function shortcutFromEvent(event:KeyEvent):KeyboardShortcut|null {
    if (event.repeat || event.isComposing || !event.key || modifiers.includes(event.key)) return null
    return {key:event.key.length===1 ? event.key.toLowerCase() : event.key,ctrlKey:event.ctrlKey,altKey:event.altKey,shiftKey:event.shiftKey,metaKey:event.metaKey}
}

export function parseKeyboardShortcut(raw:string|null):KeyboardShortcut {
    if (raw===null) return defaultNextTurnShortcut
    const value:unknown=JSON.parse(raw)
    if (!value || typeof value!=='object' || Array.isArray(value) || !('key' in value) || typeof value.key!=='string'
        || !value.key || value.key.length>30 || modifiers.map(key=>key.toLowerCase()).includes(value.key.toLowerCase())
        || !['ctrlKey','altKey','shiftKey','metaKey'].every(key=>key in value && typeof value[key as keyof typeof value]==='boolean')) throw new Error('Scorciatoia salvata non valida: scegli nuovamente il tasto.')
    const parsed=value as KeyboardShortcut
    return {key:parsed.key.length===1 ? parsed.key.toLowerCase() : parsed.key,ctrlKey:parsed.ctrlKey,altKey:parsed.altKey,shiftKey:parsed.shiftKey,metaKey:parsed.metaKey}
}

export function matchesShortcut(event:KeyEvent,shortcut:KeyboardShortcut):boolean {
    if (event.defaultPrevented) return false
    const pressed=shortcutFromEvent(event)
    return pressed!==null && (Object.keys(shortcut) as (keyof KeyboardShortcut)[]).every(key=>pressed[key]===shortcut[key])
}

export function shortcutLabel(shortcut:KeyboardShortcut,aria=false):string {
    const key=aria ? shortcut.key===' ' ? 'Space' : shortcut.key : shortcut.key===' ' ? 'Spazio' : shortcut.key.length===1 ? shortcut.key.toUpperCase() : shortcut.key
    return [...(shortcut.ctrlKey ? [aria ? 'Control' : 'Ctrl'] : []),...(shortcut.altKey ? ['Alt'] : []),...(shortcut.shiftKey ? ['Shift'] : []),...(shortcut.metaKey ? ['Meta'] : []),key].join(aria ? '+' : ' + ')
}
