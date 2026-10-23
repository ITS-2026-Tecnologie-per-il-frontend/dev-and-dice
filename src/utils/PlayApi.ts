import type { SpellEffectDetails, WeaponEffectDetails, ResolutionPlan, RollPacket, TargetResolution, SaveAbility, DefenseProfile } from '../domain/dnd/CombatResolution'
import type { AttackAssessment } from '../domain/dnd/CombatActions'
import type { CharacterSheet } from './CharacterSheets'
import type { TrackerState } from '../components/TurnsTracker'
import type { CombatTargetRule } from '../domain/dnd/CombatTargets'
import type { CatalogEntry } from './Catalog'

export type OwnedCharacter = { id:string; ownerId:string; gameId:string|null; revision:number; sheet:CharacterSheet }
export type NotificationSummary = {revision:number;unreadCount:number;newestUnreadRevision?:number}
export type SheetNotification = {id:string;characterId:string;characterName:string;actorName:string;actorRole:'master'|'player';createdAt:string;status:'applied'|'rejected';rejectedAt?:string;read:boolean;canReject:boolean;changes:{path:string[];before:unknown;after:unknown}[]}
export type NotificationPage = {revision:number;items:SheetNotification[];next:string|null}
export type GameSummary = { id:string; name:string; role:'master'|'player'; revision:number }
export type CombatTarget = {id:number;name:string;roll:string;hit?:boolean;attack?:AttackAssessment;resolution?:TargetResolution;damageRoll:string;damage:string}
export type WindSave={mode:'dice'|'manual';die?:number;secondDie?:number;bonuses?:Record<string,number>;success?:boolean}
export type WindReview={candidates:{id:number;name:string;sheetId:string;profile:DefenseProfile}[];selected:number[];saves:Record<string,WindSave>;editable:boolean}
export type CombatRequest = {additionalActionRequired?:boolean;wind?:WindReview;id:string;characterId?:string;characterName:string;actorName:string;actionName:string;createdAt:string;status:'pending'|'approved'|'rejected'|'stale';optionLabel:string;cost:number;spendsResources:boolean;mode:'attack'|'save'|'automatic'|'none';attackDie?:number;packets?:RollPacket[];weaponChoices?:{targetId:number;items:{id:string;name:string;quantity:number}[]}[];resolution?:ResolutionPlan;rollsRevision?:number;damageEnabled:boolean;prolonged:boolean;targets:CombatTarget[];resolvedAt?:string}
export type ReactionEvent={kind:'hit'|'magic-missile'|'spell'|'damage'|'fall'|'other';label:string;targetIds:number[];actorId?:number;requestId?:string}
export type ReactionWindow={id:string;groupId:string;characterId:string;characterName:string;event:ReactionEvent;actionKeys:string[];expiresAt:number;serverNow:number;status:'pending'|'submitted'|'used'|'declined'|'expired';requestId?:string}
type Requests = {reactionWindows?:ReactionWindow[];requestsRevision:number;combatRequests:CombatRequest[];newestPendingRequest?:number}
export type ActionChoices = {revision:number;canPropose:boolean;blockedReason?:string;ownerId:number|null;targets:{id:number;name:string;creatureType?:string;wearingArmor?:boolean}[];actions:{effects?:SpellEffectDetails[];weaponEffects?:WeaponEffectDetails[];lastCast?:{id:string;status:'pending'|'approved';createdAt:string;optionLabel:string;packets?:RollPacket[];temporaryHitPoints?:{roll:number;bonus:number;total:number;keptPrevious:boolean}};additionalActionRequired?:boolean;key:string;displayName?:string;name:string;entry?:CatalogEntry;description:string;attackBonus?:string;resolution?:ResolutionPlan;group:'Incantesimi'|'Attacchi fisici'|'Abilità attivabili';spellLevel?:number;duration:string;remainingTurns:number;active:boolean;options:{id:string;label:string;remaining:number|null;cost?:number;targeting:CombatTargetRule;resolution?:ResolutionPlan}[];error:string;cost:number;damageEnabled:boolean;mode:CombatRequest['mode'];prolonged:boolean;ritual:boolean}[]}
export type MasterGame = GameSummary & Requests & { role:'master'; notifications:NotificationSummary;inviteToken:string; characters:OwnedCharacter[]; state:TrackerState }
export type PrivateNotes = {text:string;revision:number}
export type PlayerEffect = {name:string;duration:string;remainingTurns:number;timed:boolean;concentration:boolean;description?:string;expiresAt?:'start'|'end';repeatSave?:string}
export type PlayerGame = GameSummary & Requests & { role:'player'; rollRequests?:{requestId:string;targetId:number;actionName:string;kind:'save'|'save-second'|'attack'|'bonus-save'|'bonus-attack';label?:string;sides?:number;optional?:boolean;effectId?:number;ability?:SaveAbility;bonus?:number;packet?:number;revision:number}[];notifications:NotificationSummary;character:OwnedCharacter; turns:{name:string;current:boolean}[]; effects:PlayerEffect[]; notes:PrivateNotes }
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
