import type { CharacterSheet } from './CharacterSheets'
import type { TrackerState } from '../components/TurnsTracker'

export type OwnedCharacter = { id:string; ownerId:string; gameId:string|null; revision:number; sheet:CharacterSheet }
export type NotificationSummary = {revision:number;unreadCount:number}
export type SheetNotification = {id:string;characterId:string;characterName:string;actorName:string;actorRole:'master'|'player';createdAt:string;status:'applied'|'rejected';rejectedAt?:string;read:boolean;canReject:boolean;changes:{path:string[];before:unknown;after:unknown}[]}
export type NotificationPage = {revision:number;items:SheetNotification[];next:string|null}
export type GameSummary = { id:string; name:string; role:'master'|'player'; revision:number }
export type MasterGame = GameSummary & { role:'master'; notifications:NotificationSummary;inviteToken:string; characters:OwnedCharacter[]; state:TrackerState }
export type PrivateNotes = {text:string;revision:number}
export type PlayerEffect = {name:string;duration:string;remainingTurns:number;timed:boolean;concentration:boolean;description?:string;expiresAt?:'start'|'end';repeatSave?:string}
export type PlayerGame = GameSummary & { role:'player'; notifications:NotificationSummary;character:OwnedCharacter; turns:{name:string;current:boolean}[]; effects:PlayerEffect[]; notes:PrivateNotes }
export type Game = MasterGame | PlayerGame
export type HomeData = { characters:OwnedCharacter[]; games:GameSummary[] }
export class PlayApiError extends Error {
    status:number
    constructor(message:string, status:number) {super(message);this.status=status}
}
export async function playApi<T>(path:string, method='GET', body?:unknown):Promise<T> {
    const response=await fetch('/api/play'+path,{method,headers:body===undefined ? undefined : {'Content-Type':'application/json'},body:body===undefined ? undefined : JSON.stringify(body)})
    let result
    try {result=await response.json()} catch {throw new PlayApiError('Risposta del server non valida. Le modifiche restano aperte.',response.status)}
    if (!response.ok) throw new PlayApiError(result.error ?? 'Operazione non riuscita.',response.status)
    return result
}
