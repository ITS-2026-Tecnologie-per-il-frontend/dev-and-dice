import type { CharacterSheet } from './CharacterSheets'
import type { TrackerState } from '../components/TurnsTracker'

export type OwnedCharacter = { id:string; ownerId:string; gameId:string|null; revision:number; sheet:CharacterSheet }
export type NotificationSummary = {revision:number;unreadCount:number}
export type SheetNotification = {id:string;characterId:string;characterName:string;actorName:string;actorRole:'master'|'player';createdAt:string;status:'applied'|'rejected';rejectedAt?:string;read:boolean;canReject:boolean;changes:{path:string[];before:unknown;after:unknown}[]}
export type NotificationPage = {revision:number;items:SheetNotification[];next:string|null}
export type GameSummary = { id:string; name:string; role:'master'|'player'; revision:number }
export type CombatTarget = {id:number;name:string;roll:string;hit:boolean;damageRoll:string;damage:string}
export type CombatRequest = {id:string;characterName:string;actorName:string;actionName:string;createdAt:string;status:'pending'|'approved'|'rejected'|'stale';optionLabel:string;cost:number;spendsResources:boolean;mode:'attack'|'save'|'automatic'|'none';damageEnabled:boolean;prolonged:boolean;targets:CombatTarget[];resolvedAt?:string}
type Requests = {requestsRevision:number;combatRequests:CombatRequest[]}
export type ActionChoices = {revision:number;targets:{id:number;name:string}[];actions:{key:string;name:string;description:string;options:{id:string;label:string;remaining:number|null;cost?:number}[];error:string;cost:number;damageEnabled:boolean;mode:CombatRequest['mode'];prolonged:boolean;ritual:boolean}[]}
export type MasterGame = GameSummary & Requests & { role:'master'; notifications:NotificationSummary;inviteToken:string; characters:OwnedCharacter[]; state:TrackerState }
export type PrivateNotes = {text:string;revision:number}
export type PlayerEffect = {name:string;duration:string;remainingTurns:number;timed:boolean;concentration:boolean;description?:string;expiresAt?:'start'|'end';repeatSave?:string}
export type PlayerGame = GameSummary & Requests & { role:'player'; notifications:NotificationSummary;character:OwnedCharacter; turns:{name:string;current:boolean}[]; effects:PlayerEffect[]; notes:PrivateNotes }
export type Game = MasterGame | PlayerGame
export type HomeData = { characters:OwnedCharacter[]; games:GameSummary[] }
export class PlayApiError extends Error {
    status:number
    constructor(message:string, status:number) {super(message);this.status=status}
}
export async function playApi<T>(path:string, method='GET', body?:unknown):Promise<T> {
    const signal=method==='GET' ? AbortSignal.timeout(15_000) : undefined
    try {
        const response=await fetch('/api/play'+path,{method,signal,headers:body===undefined ? undefined : {'Content-Type':'application/json'},body:body===undefined ? undefined : JSON.stringify(body)})
        let result
        try {result=await response.json()} catch {throw new PlayApiError('Risposta del server non valida. Le modifiche restano aperte.',response.status)}
        if (!response.ok) throw new PlayApiError(result.error ?? 'Operazione non riuscita.',response.status)
        return result
    } catch(error) {
        if (signal?.aborted) throw new PlayApiError('Il server non ha risposto entro 15 secondi. Controlla la connessione e riprova.',408)
        throw error
    }
}
