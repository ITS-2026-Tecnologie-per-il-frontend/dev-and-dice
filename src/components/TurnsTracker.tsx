import { lazy, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from 'react'
import type { MasterView } from '../utils/MasterView'
import { ColumnSeparator } from './ColumnSeparator'
import { ParticipantInspector, ParticipantStats, InspectorNavigation, ParticipantAbilities } from './ParticipantInspector'
import { useDialogDismiss } from '../utils/Dialog'
import { CharacterSheets, type CharacterSheetsHandle } from './CharacterSheets'
import { characterFields, clampHitPointsToMaximum, newCharacterSheet, normalizeHitPoints, turnFromSheet, importSheetAbility, initiativeBonus, syncTurnStats, type CharacterSheet } from '../utils/CharacterSheets'
import { AbilitiesTracker } from './AbilitiesTracker'
import type { ResolvedDamagePackets } from './MasterSpellRolls'
import { nextCombatTurn, sortByInitiative, advanceCombatAbilities, removeParticipantAbilities, hitPointsAfterDamageWithTemporary, hitPointsAfterHealing, type Ability, type Combat } from '../utils/Combat'
import { getDropIndex, getDropTargetId, reorderByDrop, reorderById } from '../utils/Reorder'
import { catalogAbilityKind, refreshCombatSheetAbilities, sheetFromCatalog, sheetWithCombatAbilities, type Catalog, type CatalogEntry } from '../utils/Catalog'
import { RepeatSavingThrow } from './RepeatSavingThrow'
import { activeEffects as effectiveAbilities, conditionNames, resolutionPlan, saveNames } from '../domain/dnd/CombatResolution'
import { conditionEffectName, conditionsFor, pendingRepeatSaves, endIncapacitatedConcentration, settleCombatEffects } from '../domain/dnd/CombatConditions'
import { creatureType, creatureTypeNames, assertTargetTypes, combatTargeting, assertCombatTargets } from '../domain/dnd/CombatTargets'
import { CatalogSearch } from './CatalogSearch'
import { applyCreation, translatedCreationData, patchCalculatedSheetStats, type CreationData } from '../utils/PlayerCreation'
import { loadActiveDatabase, concentrationSave, catalogForSheet } from '../domain/dnd/ActiveRules'
import { combatAbilityInfo, combatAbilityStatus, selectedUseOption, spendCombatUse, resolveCombatDamage, restoreCombatHitPoints, grantCombatTemporaryHitPoints, requiresAdditionalSpellAction, resolvedAbility } from '../domain/dnd/CombatActions'
import { spellEdition } from '../utils/Spellcasting'
import { InfoButton } from './InfoButton'
import { defaultNextTurnShortcut, nextTurnShortcutKey, parseKeyboardShortcut, matchesShortcut, shortcutFromEvent, shortcutLabel, type KeyboardShortcut } from '../utils/KeyboardShortcut'

export type Turn = {
    id: number
    description: string
    initiative: string
    hitPoints: string
    armorClass: string
    temporaryHitPoints: string
    sheet?: CharacterSheet
    availableAbilityIndexes?: number[]
    damage?: string
    concentrationChecks?:number[]
}
const RulesPanel=lazy(()=>import('./RulesPanel'))
export type TrackerState = {turns:Turn[];abilities:Ability[];combat:Combat|null}
export type SessionWorkspace = {state:TrackerState;sheets:CharacterSheet[];storageKey:string;onChange:(state:TrackerState,sheets:CharacterSheet[])=>void;canRemove:(sheet:CharacterSheet)=>boolean;remove:(sheet:CharacterSheet)=>Promise<void>}

export function TurnsTracker({ language, workspace, view = 'original', libraryTools, combatTools }: { language: 'it' | 'en'; workspace?:SessionWorkspace; view?: MasterView; libraryTools?: ReactNode; combatTools?:ReactNode }) {
    const renewed = view === 'renewed'
    const combatFormId=useId()
    const [section, setSection] = useState<'table' | 'library' | 'rules'>('table')
    const [selectedId, setSelectedId] = useState<number | null>(null)
    const [inspectorMode, setInspectorMode] = useState<'participant' | 'all'>('participant')
    const [abilitySearch, setAbilitySearch] = useState('')
    const inspector = useRef<HTMLElement>(null)
    const tableHeading = useRef<HTMLHeadingElement>(null)
    const sheetEditor = useRef<CharacterSheetsHandle>(null)
    const nextTurnButton=useRef<HTMLButtonElement>(null)
    const [shortcut,setShortcut]=useState(()=>{
        try {return parseKeyboardShortcut(localStorage.getItem(nextTurnShortcutKey))}
        catch {return defaultNextTurnShortcut}
    })
    const [shortcutError,setShortcutError]=useState('')
    function saveShortcut(value:KeyboardShortcut) {
        setShortcut(value)
        try {localStorage.setItem(nextTurnShortcutKey,JSON.stringify(value));setShortcutError('')}
        catch {setShortcutError('La scorciatoia funziona per questa visita, ma non è stato possibile salvarla nel browser.')}
    }
    useEffect(()=>{
        const advance=(event:KeyboardEvent)=>{
            if (!nextTurnButton.current || nextTurnButton.current.disabled || !matchesShortcut(event,shortcut)
                || document.querySelector('dialog[open]') || event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"]')) return
            event.preventDefault()
            nextTurnButton.current.click()
        }
        window.addEventListener('keydown',advance)
        return ()=>window.removeEventListener('keydown',advance)
    },[shortcut])
    const dismissRemovalDialog = useDialogDismiss()
    const [libraryWidth, setLibraryWidth] = useState<string>()
    const [abilitiesWidth, setAbilitiesWidth] = useState<string>()
    const [catalogs, setCatalogs] = useState<Record<'it' | 'en', Catalog>>({ it: { creatures: [], abilities: [] }, en: { creatures: [], abilities: [] } })
    const catalog = catalogs[language]
    const [rawCreationData, setCreationData] = useState<CreationData>()
    const creationData = useMemo(() => rawCreationData ? translatedCreationData(rawCreationData, catalog) : undefined, [rawCreationData, catalog])

    const [catalogStatus, setCatalogStatus] = useState('Caricamento del catalogo…')
    const [combatRuleError,setCombatRuleError]=useState('')
    const [abilityError,setAbilityError]=useState<{abilityId:number;message:string}|null>(null)
    const handledExecutions=useRef(new Set<string>())
    const [turns, setTurns] = useState<Turn[]>(workspace?.state.turns ?? [])
    const [abilities, setAbilities] = useState<Ability[]>(workspace?.state.abilities ?? [])
    const [combat, setCombat] = useState<Combat | null>(workspace?.state.combat ?? null)
    const selectedTurn = turns.find(turn => turn.id === selectedId) ?? turns.find(turn => turn.id === combat?.activeId) ?? turns[0]
    const activeEffects = effectiveAbilities(abilities).concat(abilities.filter(a=>!!a.execution))
    const [repeatSaveId,setRepeatSaveId]=useState<number|null>(null)
    const repeatDialog=useRef<HTMLDialogElement>(null),dismissRepeat=useDialogDismiss()
    const repeatEffect=pendingRepeatSaves(abilities,combat).find(a=>a.id===repeatSaveId)
    const repeatTarget=turns.find(t=>t.id===repeatEffect?.ownerId)
    useEffect(()=>{
        if(repeatEffect&&repeatTarget?.sheet){if(!repeatDialog.current?.open)repeatDialog.current?.showModal()}else repeatDialog.current?.close()
    },[repeatEffect,repeatTarget])
    function selectParticipant(id: number) {
        setSelectedId(id)
        setInspectorMode('participant')
        setAbilitySearch('')
    }
    function revealParticipant(id: number) {
        selectParticipant(id)
        if (window.matchMedia('(max-width: 900px)').matches) requestAnimationFrame(() => {
            inspector.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
            inspector.current?.focus({ preventScroll: true })
        })
    }
    const [sessionSheets,setSessionSheets]=useState(workspace?.sheets ?? [])
    const writeSessionSheets=useCallback((sheets:CharacterSheet[])=>setSessionSheets(sheets),[])
    const nextId = useRef(Math.max(-1,...(workspace?.state.turns.map(turn=>turn.id) ?? []))+1)
    const nextAbilityId = useRef(Math.max(-1,...(workspace?.state.abilities.map(ability=>ability.id) ?? []))+1)
    const incoming=JSON.stringify(workspace ? {state:workspace.state,sheets:workspace.sheets} : null)
    const lastSnapshot=useRef(incoming),lastIncoming=useRef(incoming),hydrating=useRef(false)
    useEffect(()=>{
        if (!workspace || incoming===lastIncoming.current) return
        lastIncoming.current=incoming;lastSnapshot.current=incoming;hydrating.current=true
        // eslint-disable-next-line react/set-state-in-effect -- Follow turn changes polled from the shared session.
        if (workspace.state.combat && (workspace.state.combat.activeId!==combat?.activeId || workspace.state.combat.round!==combat?.round)) selectParticipant(workspace.state.combat.activeId)
        setTurns(workspace.state.turns);setAbilities(workspace.state.abilities);setCombat(workspace.state.combat);setSessionSheets(workspace.sheets)
        nextId.current=Math.max(nextId.current,...workspace.state.turns.map(turn=>turn.id+1))
        nextAbilityId.current=Math.max(nextAbilityId.current,...workspace.state.abilities.map(ability=>ability.id+1))
    },[incoming,workspace,combat])
    useEffect(()=>{
        if (!workspace) return
        if (hydrating.current) {hydrating.current=false;return}
        const snapshot=JSON.stringify({state:{turns,abilities,combat},sheets:sessionSheets})
        if (snapshot===lastSnapshot.current) return
        lastSnapshot.current=snapshot
        workspace.onChange({turns,abilities,combat},sessionSheets)
    },[turns,abilities,combat,sessionSheets,incoming,workspace])
    const [pendingRemoval, setPendingRemoval] = useState<number[] | null>(null)
    const removalDialog = useRef<HTMLDialogElement>(null)
    const presentSheetIds = turns.flatMap((turn) => turn.sheet ? [turn.sheet.id] : [])
    const removalAbilities = abilities.filter((ability) => ability.ownerId !== null && pendingRemoval?.includes(ability.ownerId))
    const unexpiredAbilities = removalAbilities.filter((ability) => ability.active && (ability.remainingTurns > 0 || ability.timed === false))

    useEffect(() => {
        if (pendingRemoval && !removalDialog.current?.open) removalDialog.current?.showModal()
    }, [pendingRemoval])

    useEffect(() => {
        let active=true
        loadActiveDatabase().then(({creationData,catalogs}) => {if (active) {setCreationData(creationData);setCatalogs(catalogs);setCatalogStatus('')}})
            .catch((error: unknown) => { if (active) setCatalogStatus(`Catalogo non disponibile: ${error instanceof Error ? error.message : String(error)} Puoi inserire i dati manualmente.`) })
        return () => {active=false}
    }, [])


    function createTurn(): Turn {
        return { id: nextId.current++, description: '', initiative: '', hitPoints: '', armorClass: '', temporaryHitPoints: '' }
    }

    function addTurn() {
        const newTurn = createTurn()
        setTurns((currentTurns) => [...currentTurns, newTurn])
        selectParticipant(newTurn.id)
        setSection('table')
    }

    function openTurnSheet(turn: Turn) {
        const sheet = turn.sheet ?? {...newCharacterSheet(),kind:'Mostro',name:turn.description.trim() || 'Nuovo mostro',
            hitPoints:turn.hitPoints,armorClass:turn.armorClass,initiative:turn.initiative,playerDetails:{temporaryHitPoints:turn.temporaryHitPoints}}
        if (!turn.sheet) setTurns(current => current.map(item => item.id===turn.id ? {...item,sheet} : item))
        sheetEditor.current?.open(sheet)
    }

    function addCharacter(sheet: CharacterSheet) {
        if (combat || presentSheetIds.includes(sheet.id)) return
        const turn = turnFromSheet(sheetWithCombatAbilities(creationData ? applyCreation(sheet, creationData) : sheet, catalogForSheet(creationData,catalog,sheet) ?? catalog), nextId.current++)
        if (sheet.initiative !== turn.initiative && sheetEditor.current?.patchStats(sheet.id, { initiative: turn.initiative }) === false) return
        setTurns((current) => [...current, turn])
        selectParticipant(turn.id)
        setSection('table')
    }

    function syncSavedSheet(sheet: CharacterSheet) {
        setTurns((current) => current.map((turn) => turn.sheet?.id === sheet.id ? { ...syncTurnStats(turn, sheet), ...refreshCombatSheetAbilities(turn.sheet, sheet, catalogForSheet(creationData,catalog,sheet) ?? catalog) } : turn))
    }

    function addAbility() {
        const ability: Ability = { id: nextAbilityId.current++, name: '', duration: '1 minuto', remainingTurns: 10, ownerId: renewed && inspectorMode === 'participant' ? selectedTurn?.id ?? null : null, active: false }
        setAbilities((current) => [...current, ability])
        if (renewed) focusAbility(ability.id)
    }

    function highlightAbility(id: number) {
        if (renewed) {
            const ability = abilities.find(item => item.id === id)
            setSection('table')
            if (ability?.ownerId !== null && ability?.ownerId !== undefined) selectParticipant(ability.ownerId)
            else setInspectorMode('all')
        }
        focusAbility(id)
    }

    function focusAbility(id: number) {
        requestAnimationFrame(() => {
            const element = document.getElementById(`ability-${id}`)
            element?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
            element?.focus({ preventScroll: true })
            const highlight = { boxShadow: '0 0 0 2px #b77908', backgroundColor: 'rgba(183, 121, 8, 0.14)' }
            element?.animate([highlight, highlight], 2000)
        })
    }

    function abilityStatus(turn:Turn,ability:Ability) {
        try {return combatAbilityStatus(turn.sheet,ability,turn.sheet ? catalogForSheet(creationData,catalog,turn.sheet) ?? catalog : catalog,creationData)}
        catch {return 'Verifica scheda'}
    }

    function refreshParticipantAbilities(original:Turn):Turn {
        if(!original.sheet)return original
        const canonical=sessionSheets.find(sheet=>sheet.id===original.sheet!.id)
        const current={...original.sheet,abilities:canonical?.abilities??original.sheet.abilities.filter((_,index)=>!original.availableAbilityIndexes||original.availableAbilityIndexes.includes(index))}
        return {...original,...refreshCombatSheetAbilities(original.sheet,current,catalogForSheet(creationData,catalog,current)??catalog)}
    }

    function openSheetAbility(original: Turn, index: number) {
        if (!original.sheet) return
        const ownerCatalog=catalogForSheet(creationData,catalog,original.sheet) ?? catalog
        const turn=refreshParticipantAbilities(original)
        const sheet=turn.sheet!
        const template=sheet.abilities[index]
        if (!template || catalogAbilityKind(ownerCatalog.abilities.find(entry=>entry.id===template.catalogId),template.section,template.description).passive) return
        const existing = abilities.find((ability) => ability.ownerId === turn.id && ability.sheetAbilityIndex === index)
        if (turn.availableAbilityIndexes && !turn.availableAbilityIndexes.includes(index)) return
        if (existing) { highlightAbility(existing.id); return }
        const id = nextAbilityId.current++
        setTurns(current=>current.map(item=>item.id===turn.id ? {...item,sheet,availableAbilityIndexes:turn.availableAbilityIndexes} : item))
        setAbilities((current) => importSheetAbility(current, sheet, turn.id, index, id))
        if (renewed) focusAbility(id)
    }

    function updateTurn(id: number, field: 'description' | 'initiative' | 'hitPoints' | 'armorClass' | 'temporaryHitPoints' | 'damage', value: string, clearAdjustment?: 'damage', temporaryHitPoints?: string) {
        const turn = turns.find((item) => item.id === id)
        if (!turn) return false
        const normalizedValue = field === 'hitPoints' || field === 'temporaryHitPoints' ? normalizeHitPoints(value) : value
        if (field === 'temporaryHitPoints' && normalizedValue !== '' && (!Number.isSafeInteger(Number(normalizedValue)) || Number(normalizedValue) < 0)) return false
        const updatedValue = field === 'hitPoints' ? clampHitPointsToMaximum(normalizedValue, maximumHitPoints(turn)) : normalizedValue
        const nextTemporaryHitPoints = temporaryHitPoints ?? (field === 'temporaryHitPoints' ? normalizedValue : undefined)
        const isSheetStat = field === 'initiative' || field === 'hitPoints' || field === 'armorClass'
        const stats = isSheetStat || nextTemporaryHitPoints !== undefined
            ? { ...(isSheetStat ? { [field]: updatedValue } : {}), ...(nextTemporaryHitPoints !== undefined ? { temporaryHitPoints: nextTemporaryHitPoints } : {}) }
            : null
        if(field==='temporaryHitPoints'&&turn.sheet&&normalizedValue!==turn.temporaryHitPoints) {
            const sheet={...turn.sheet,playerDetails:{...turn.sheet.playerDetails,temporaryHitPoints:normalizedValue,'temporaryHitPoints.source':''}}
            if(sheetEditor.current?.patchMany([sheet])===false)return false
            setTurns(current=>current.map(item=>item.id===id?{...item,temporaryHitPoints:normalizedValue,sheet}:item))
            return true
        }
        if (stats && turn.sheet) {
            if (!patchCalculatedSheetStats(turn.sheet, stats, creationData) || sheetEditor.current?.patchStats(turn.sheet.id, stats) === false) return false
        }
        setTurns((currentTurns) =>
            currentTurns.map((turn) =>
                turn.id === id ? { ...turn, [field]: updatedValue, ...(nextTemporaryHitPoints !== undefined ? { temporaryHitPoints: nextTemporaryHitPoints } : {}), ...(clearAdjustment ? { [clearAdjustment]: '' } : {}), sheet: turn.sheet
                    ? stats ? patchCalculatedSheetStats(turn.sheet, stats, creationData) ?? turn.sheet : field === 'description' ? { ...turn.sheet, name: value, catalogId: undefined } : turn.sheet
                    : undefined } : turn,
            ),
        )
        return true
    }

    function maximumHitPoints(turn: Turn): string {
        return turn.sheet?.playerDetails?.maxHitPoints?.trim() || String(catalog.creatures.find((entry) => entry.id === turn.sheet?.catalogId)?.data.hitPoints ?? '')
    }

    function applyHealing(id: number) {
        const turn = turns.find((item) => item.id === id)
        if (!turn) return
        const hitPoints = hitPointsAfterHealing(turn.hitPoints, turn.damage ?? '', maximumHitPoints(turn))
        if (hitPoints !== null) updateTurn(id, 'hitPoints', hitPoints, 'damage')
    }

    function applyDamage(id: number) {
        const turn = turns.find((item) => item.id === id)
        if (!turn) return
        const temporaryHitPoints = turn.temporaryHitPoints
        const result = hitPointsAfterDamageWithTemporary(turn.hitPoints, temporaryHitPoints ?? '', turn.damage ?? '')
        if (result !== null && updateTurn(id, 'hitPoints', result.hitPoints, 'damage', temporaryHitPoints === undefined ? undefined : result.temporaryHitPoints)
            && creationData?.verified && turn.sheet && spellEdition(turn.sheet)==='2014' && turn.sheet.playerDetails?.['rules2014.concentration'] && Number(turn.damage)>0) {
            const save=concentrationSave(creationData.verified,Number(turn.damage))
            setTurns((turns)=>turns.map((turn)=>turn.id===id ? {...turn,concentrationChecks:[...(turn.concentrationChecks ?? []),save.dc]} : turn))
        }
    }

    function resolveConcentration(id:number,success:boolean) {
        const turn=turns.find((turn)=>turn.id===id)
        if (!turn?.sheet) return
        if (!success && sheetEditor.current?.patchDetails(turn.sheet.id,{'rules2014.concentration':''})===false) return
        if (!success) setAbilities((abilities)=>abilities.map((ability)=>ability.ownerId===id&&(ability.concentration || ability.execution?.phase==='casting') ? {...ability,active:false,execution:undefined,requirementsConfirmed:false,remainingTurns:0,timed:true} : ability))
        setTurns((turns)=>turns.map((turn)=>turn.id===id ? {...turn,concentrationChecks:success ? turn.concentrationChecks?.slice(1) : [],
            sheet:success || !turn.sheet ? turn.sheet : {...turn.sheet,playerDetails:{...turn.sheet.playerDetails,'rules2014.concentration':''}}} : turn))
    }

    function patchAbilityOwner(ability:Ability,details:Record<string,string>):boolean {
        const turn=turns.find((turn)=>turn.id===ability.ownerId)
        if (!turn?.sheet) return true
        if (sheetEditor.current?.patchDetails(turn.sheet.id,details)===false) return false
        setTurns((turns)=>turns.map((turn)=>turn.id===ability.ownerId&&turn.sheet ? {...turn,sheet:{...turn.sheet,playerDetails:{...turn.sheet.playerDetails,...details}}} : turn))
        return true
    }
    function activateCombatAbility(ability:Ability) {
        setAbilityError(null)
        try {
            if (ability.execution || ability.active && (ability.timed===false || ability.remainingTurns>0) || !ability.name.trim() || ability.ownerId===null) return
            if (catalogStatus==='Caricamento del catalogo…') throw new Error('Attendi il caricamento delle regole prima di usare l’abilità.')
            const original=turns.find(turn=>turn.id===ability.ownerId),turn=original&&refreshParticipantAbilities(original),owner=turn?.sheet,ownerCatalog=owner ? catalogForSheet(creationData,catalog,owner) ?? catalog : catalog
            if (!turn) throw new Error('Seleziona il proprietario dell’abilità.')
            if (turn.availableAbilityIndexes && ability.sheetAbilityIndex!==undefined && !turn.availableAbilityIndexes.includes(ability.sheetAbilityIndex)) throw new Error('Questa abilità non è più disponibile nella scheda.')
            const info=combatAbilityInfo(ability,ownerCatalog),option=selectedUseOption(owner,ability,ownerCatalog,creationData)
            if(conditionsFor(abilities,ability.ownerId!).includes('Paralizzato'))throw new Error('Il personaggio non può agire mentre è paralizzato.')
            assertCombatTargets(ability,ownerCatalog,owner,option?.id)
            assertTargetTypes(combatTargeting(ability,ownerCatalog,owner,option?.id),turns,ability.targets?.map(t=>t.id)??[])
            if (owner && spellEdition(owner)==='2024' && ability.ruleId?.includes('2014:')) throw new Error('Questa voce usa regole 2014: scegli la voce dell’edizione corretta.')
            if ((info.level!==undefined || info.damage) && !ability.requirementsConfirmed) throw new Error('Conferma i requisiti del lancio o dell’azione prima di usarla.')
            if (info.damage && !ability.targets?.length) throw new Error('Seleziona almeno un bersaglio del danno.')
            if (!option || option.remaining!==null && option.remaining<(option.cost ?? ability.resourceCost ?? 1)) throw new Error('Utilizzi esauriti: scegli una modalità disponibile.')
            const prolonged=info.prolonged || option.id==='ritual'
            const execution={id:crypto.randomUUID(),phase:prolonged ? 'casting' as const : 'resolving' as const,option:option.id,cost:option.cost ?? ability.resourceCost ?? 1}
            const next={...ability,...(info.repairsObject ? {damageEnabled:false,instantaneous:true} : {}),active:false,execution,targets:info.damage ? ability.targets?.map(target=>({...target,damage:'',resolved:false})) : ability.ruleId==='phb2014:spell:gust-of-wind' ? ability.targets?.map(target=>({...target,damage:'0',resolved:false})) : []}
            if (!prolonged) completeCombatCast(next)
            else {
                if (owner && !patchAbilityOwner(ability,{'rules2014.concentration':ability.ruleId ?? ability.catalogId ?? ability.name})) throw new Error('Salvataggio del lancio non riuscito.')
                setAbilities(abilities=>abilities.map(item=>item.id===ability.id ? next : item.ownerId===ability.ownerId && (item.concentration || item.execution?.phase==='casting') ? {...item,active:false,execution:undefined,remainingTurns:0} : item))
            }
            setCombatRuleError('')
        } catch (error) {setAbilityError({abilityId:ability.id,message:error instanceof Error ? error.message : 'Utilizzo non riuscito.'})}
    }

    function completeCombatCast(ability:Ability) {
        if (!ability.execution || handledExecutions.current.has('cast:'+ability.execution.id)) return
        const owner=turns.find(turn=>turn.id===ability.ownerId)?.sheet,ownerCatalog=owner ? catalogForSheet(creationData,catalog,owner) ?? catalog : catalog
        const info=combatAbilityInfo(ability,ownerCatalog),rage=ability.ruleId==='phb2014:class-feature:barbarian-1-rage'
        if (owner&&spellEdition(owner)==='2024'&&ability.ruleId?.includes('2014:')) throw new Error('Questa voce usa regole 2014: scegli la voce dell’edizione corretta.')
        if (rage && combat && ability.ownerId!==combat.activeId) throw new Error('L’ira richiede un’azione bonus nel proprio turno.')
        if ((ability.concentration || info.concentration) && owner?.playerDetails?.['rules2014.raging']==='true') throw new Error('Durante l’ira non puoi mantenere concentrazione.')
        const castingOwner=owner && !combat ? {...owner,playerDetails:{...owner.playerDetails,'rules2014.spellsThisTurn':'[]','combat.spellsThisTurn':'[]'}} : owner
        const spent=castingOwner ? spendCombatUse(castingOwner,ability,ownerCatalog,creationData,ability.execution.option,ability.execution.cost) : undefined
        const details={...spent?.playerDetails,...(rage ? {'rules2014.raging':'true','rules2014.concentration':''} : {}),
            ...(ability.concentration || info.concentration ? {'rules2014.concentration':ability.ruleId ?? ability.catalogId ?? ability.name} : {}),
            ...(ability.execution.phase==='casting' && !info.concentration ? {'rules2014.concentration':''} : {})}
        if (owner && !patchAbilityOwner(ability,details)) throw new Error('Salvataggio delle risorse non riuscito.')
        handledExecutions.current.add('cast:'+ability.execution.id)
        const cast={...ability,concentration:ability.concentration || info.concentration,execution:{...ability.execution,phase:'resolving' as const}}
        setAbilities(abilities=>abilities.flatMap(item=>item.id===ability.id ? info.damage ? [cast] : info.instantaneous ? [] : [resolvedAbility(cast,ownerCatalog,combat,turns)]
            : [(rage || info.concentration || ability.concentration) && item.ownerId===ability.ownerId && (item.concentration || item.execution?.phase==='casting') ? {...item,active:false,execution:undefined,remainingTurns:0} : item]))
    }

    function finishCombatAbility(ability:Ability,damagePackets?:ResolvedDamagePackets,additionalActionConfirmed=false) {
        setAbilityError(null)
        try {
            if (!ability.execution || handledExecutions.current.has('finish:'+ability.execution.id)) return false
            if (ability.execution.phase==='casting') {completeCombatCast(ability);setCombatRuleError('');return}
            const owner=turns.find(turn=>turn.id===ability.ownerId)?.sheet,ownerCatalog=owner ? catalogForSheet(creationData,catalog,owner) ?? catalog : catalog
            const info=combatAbilityInfo(ability,ownerCatalog),instantaneous=info.instantaneous
            const alreadyCast=abilities.some(item=>item.id===ability.id&&item.execution?.id===ability.execution?.id)
            let resolvingTurns=turns
            if(owner&&!alreadyCast) {
                if(conditionsFor(abilities,ability.ownerId!).includes('Paralizzato'))throw new Error('Il personaggio non può agire mentre è paralizzato.')
                const turn=refreshParticipantAbilities(turns.find(turn=>turn.id===ability.ownerId)!)
                if(turn.availableAbilityIndexes&&ability.sheetAbilityIndex!==undefined&&!turn.availableAbilityIndexes.includes(ability.sheetAbilityIndex))throw new Error('Questa abilità non è più disponibile nella scheda.')
                if(spellEdition(owner)==='2024'&&ability.ruleId?.includes('2014:'))throw new Error('Questa voce usa regole 2014: scegli la voce dell’edizione corretta.')
                const castingOwner=combat?owner:{...owner,playerDetails:{...owner.playerDetails,'rules2014.spellsThisTurn':'[]','combat.spellsThisTurn':'[]'}}
                if(combat&&requiresAdditionalSpellAction(castingOwner,ability,ownerCatalog)&&!additionalActionConfirmed)throw new Error('Conferma un’altra azione valida per lanciare questo incantesimo.')
                const spent=spendCombatUse(castingOwner,ability,ownerCatalog,creationData,ability.execution.option,ability.execution.cost)
                resolvingTurns=turns.map(turn=>turn.id===ability.ownerId?{...turn,sheet:spent}:turn)
            }
            const resolving=info.repairsObject ? {...ability,targets:[]} : ability
            let updated=resolveCombatDamage(resolving,resolvingTurns,ownerCatalog).map(turn=>{
                const target=resolving.targets?.find(target=>target.id===turn.id),damage=Number(target?.damage ?? 0)
                if (!damage) return turn
                const sheet:CharacterSheet|undefined=turn.sheet ? {...turn.sheet,hitPoints:turn.hitPoints,playerDetails:{...turn.sheet.playerDetails,temporaryHitPoints:turn.temporaryHitPoints}} : undefined
                // PHB 2014, D&D_5_Player_Original_Handbook.pdf, PDF 204, Concentration: one save per damage source.
                const hits=damagePackets?.find(target=>target.id===turn.id)?.damage??[damage]
                const dcs=sheet&&spellEdition(sheet)==='2014'&&sheet.playerDetails?.['rules2014.concentration']&&creationData?.verified?hits.filter(damage=>damage>0).map(damage=>concentrationSave(creationData.verified!,damage).dc):[]
                return {...turn,sheet,...(dcs.length?{concentrationChecks:[...(turn.concentrationChecks??[]),...dcs]}:{})}
            })
            if(damagePackets?.some(target=>target.temporaryHitPoints!==undefined)) {
                const plan=owner&&resolutionPlan(owner,ability,ownerCatalog,ability.execution.option)
                if(!plan?.temporaryHitPoints||damagePackets.some(target=>target.id!==ability.ownerId))throw new Error('I PF temporanei di Vita Falsata si applicano soltanto al lanciatore.')
                updated=updated.map(turn=>{const amount=damagePackets.find(target=>target.id===turn.id)?.temporaryHitPoints;return amount===undefined||damagePackets.find(target=>target.id===turn.id)?.keepTemporaryHitPoints?turn:grantCombatTemporaryHitPoints(turn,amount,ability.execution!.id)})
            }
            if(damagePackets?.some(target=>target.healing!==undefined)) {
                const plan=owner&&resolutionPlan(owner,ability,ownerCatalog,ability.execution.option)
                if(!plan?.healing)throw new Error('Guarigione non prevista per questa azione.')
                assertTargetTypes(combatTargeting(ability,ownerCatalog,owner,ability.execution.option),turns,damagePackets.map(target=>target.id))
                updated=updated.map(turn=>{const healing=damagePackets.find(target=>target.id===turn.id)?.healing;return healing===undefined?turn:restoreCombatHitPoints(turn,healing)})
            }
            const temporary=damagePackets?.find(target=>target.temporaryHitPoints!==undefined)
            const keepPrevious=temporary?.keepTemporaryHitPoints===true
            const parent=resolvedAbility({...ability,...(temporary?{temporaryHitPointsSource:ability.execution.id}:{}),concentration:info.concentration||ability.concentration,useOption:ability.execution.option},ownerCatalog,combat,turns)
            let nextAbilities=abilities.flatMap(item=>item.id===ability.id?keepPrevious?[item]:instantaneous?[]:[parent]:[!alreadyCast&&parent.concentration&&item.ownerId===ability.ownerId&&item.concentration?{...item,active:false,remainingTurns:0}:item])
            const plan=owner&&resolutionPlan(owner,ability,ownerCatalog,ability.execution.option)
            if(plan&&ability.ruleId==='phb2014:spell:hold-person')for(const target of damagePackets??[])for(const effect of target.effects??[]) {
                if(effect.kind!=='condition')continue
                nextAbilities.push({id:Math.max(-1,...nextAbilities.map(a=>a.id))+1,name:(conditionNames[effect.condition as keyof typeof conditionNames]??effect.condition)+' - '+ability.name,ownerId:target.id,active:true,duration:'Personalizzata',remainingTurns:parent.remainingTurns,timed:true,sourceEffectId:parent.id,expiresAt:parent.expiresAt,expiryOwnerId:parent.expiryOwnerId,expiryRound:parent.expiryRound,resolutionEffects:[effect],
                    repeatSave:`Tiro salvezza su ${saveNames[plan.save!.ability]} a fine turno`,repeatSaveRoll:{ability:plan.save!.ability,dc:plan.save!.dc,timing:'end'}})
            }
            const incapacitated=endIncapacitatedConcentration(nextAbilities,updated)
            const settled=settleCombatEffects(incapacitated.abilities,incapacitated.turns)
            updated=settled.turns;nextAbilities=settled.abilities
            const sheets=updated.flatMap(turn=>turn.sheet && turn.sheet!==turns.find(previous=>previous.id===turn.id)?.sheet ? [turn.sheet] : [])
            if (sheets.length && sheetEditor.current?.patchMany(sheets)===false) throw new Error('Salvataggio dei danni non riuscito. Nessun danno applicato.')
            handledExecutions.current.add('finish:'+ability.execution.id)
            setTurns(updated)
            nextAbilityId.current=Math.max(nextAbilityId.current,...nextAbilities.map(a=>a.id+1))
            setAbilities(nextAbilities)
            setCombatRuleError('')
            return true
        } catch (error) {setAbilityError({abilityId:ability.id,message:error instanceof Error ? error.message : 'Risoluzione non riuscita.'});return false}
    }

    function cancelCombatCast(ability:Ability) {
        if (ability.execution?.phase!=='casting') return
        if (!patchAbilityOwner(ability,{'rules2014.concentration':''})) {setAbilityError({abilityId:ability.id,message:'Salvataggio non riuscito.'});return}
        setAbilityError(null)
        setAbilities(abilities=>abilities.map(item=>item.id===ability.id ? {...item,execution:undefined,requirementsConfirmed:false} : item))
    }
    function endCombatAbility(ability:Ability) {
        const owner=turns.find((turn)=>turn.id===ability.ownerId)?.sheet
        const details:Record<string,string>={}
        if (ability.ruleId==='phb2014:class-feature:barbarian-1-rage') details['rules2014.raging']='false'
        if (ability.concentration&&owner?.playerDetails?.['rules2014.concentration']===(ability.ruleId ?? ability.catalogId ?? ability.name)) details['rules2014.concentration']=''
        const currentTurns=turns.map(t=>t.id===ability.ownerId&&t.sheet&&Object.keys(details).length?{...t,sheet:{...t.sheet,playerDetails:{...t.sheet.playerDetails,...details}}}:t)
        const ended=abilities.map(item=>item.id===ability.id?{...item,active:false,remainingTurns:0,timed:true}:item)
        const settled=settleCombatEffects(ended,currentTurns)
        const changed=settled.turns.flatMap(t=>t.sheet&&t.sheet!==turns.find(old=>old.id===t.id)?.sheet?[t.sheet]:[])
        if(changed.length&&sheetEditor.current?.patchMany(changed)===false){setCombatRuleError('Salvataggio delle regole del personaggio non riuscito.');return false}
        setTurns(settled.turns);setAbilities(settled.abilities)
        return true
    }

    function selectCreature(id: number, entry: CatalogEntry) {
        if (combat) return
        if (!turns.some((turn) => turn.id === id)) return
        const sheet = sheetFromCatalog(entry, catalog)
        setTurns((items) => items.map((turn) => turn.id === id ? turnFromSheet(sheet, id) : turn))
        setAbilities((items) => items.map((ability) => ability.ownerId === id && ability.sheetAbilityIndex !== undefined ? { ...ability, sheetAbilityIndex: undefined } : ability))
    }

    function reorderTurn(sourceId: number, targetId: number) {
        setTurns((currentTurns) => reorderById(currentTurns, sourceId, targetId))
    }

    function handleDragStart(event: DragEvent<HTMLButtonElement>, id: number) {
        event.dataTransfer.setData('application/x-dnd-turn', String(id))
        event.dataTransfer.effectAllowed = 'move'
    }

    function handleListDrop(event: DragEvent<HTMLDivElement>) {
        event.preventDefault()
        if (combat) return
        const draggedId = event.dataTransfer.getData('application/x-dnd-turn')
        if (!draggedId) return

        const sourceId = Number(draggedId)
        const targetId = getDropTargetId(event.target)
        const insertionIndex = getDropIndex(event.currentTarget, event.clientY, targetId)
        setTurns((currentTurns) => reorderByDrop(currentTurns, sourceId, targetId, insertionIndex))
    }

    function sortTurns() {
        setTurns(sortByInitiative(turns))
    }

    function startCombat() {
        if (combat) return
        const unnamed = renewed && turns.find(turn => !turn.description.trim())
        if (unnamed) {
            revealParticipant(unnamed.id)
            setCombatRuleError('Inserisci il nome del partecipante selezionato prima di iniziare il combattimento.')
            return
        }
        setCombatRuleError('')
        const orderedTurns = sortByInitiative(turns).map(turn=>turn.sheet ? {...turn,sheet:{...turn.sheet,playerDetails:{...turn.sheet.playerDetails,'rules2014.spellsThisTurn':'[]','combat.spellsThisTurn':'[]'}}} : turn)
        if (orderedTurns.length === 0) return
        if (sheetEditor.current?.patchMany(orderedTurns.flatMap(turn=>turn.sheet ? [turn.sheet] : []))===false) {setCombatRuleError('Salvataggio dell’inizio del combattimento non riuscito.');return}
        setTurns(orderedTurns)
        setCombat({ activeId: orderedTurns[0].id, round: 1 })
        selectParticipant(orderedTurns[0].id)
    }

    function advanceTurn() {
        if (!combat)return
        const due=pendingRepeatSaves(abilities,combat)[0]
        if(due){if(!turns.find(t=>t.id===due.ownerId)?.sheet){setCombatRuleError('Collega la scheda del bersaglio per risolvere il tiro salvezza.');return}setRepeatSaveId(due.id);return}
        completeTurn(abilities)
    }
    function completeTurn(currentAbilities:Ability[],currentTurns=turns) {
        if (!combat) return false
        const next = nextCombatTurn(currentTurns, combat)
        if (next) {
            const advanced=advanceCombatAbilities(currentAbilities,combat,next),settled=settleCombatEffects(advanced,currentTurns)
            const updated=settled.abilities
            const expiredConcentration=new Set(advanced.filter(a=>a.active&&a.concentration&&a.remainingTurns===0&&a.timed!==false&&(currentAbilities.find(previous=>previous.id===a.id)?.remainingTurns??0)>0).map(a=>a.ownerId))
            const reset=settled.turns.map(turn=>turn.sheet ? {...turn,sheet:{...turn.sheet,playerDetails:{...turn.sheet.playerDetails,'rules2014.spellsThisTurn':'[]','combat.spellsThisTurn':'[]',...(expiredConcentration.has(turn.id)?{'rules2014.concentration':''}:{})}}} : turn)
            if (sheetEditor.current?.patchMany(reset.flatMap(turn=>turn.sheet ? [turn.sheet] : []))===false) {setCombatRuleError('Salvataggio della cronologia del turno non riuscito.');return false}
            setTurns(reset)
            for (const ability of updated) if (ability.active&&ability.remainingTurns===0&&ability.timed!==false&&abilities.find((a)=>a.id===ability.id)?.remainingTurns!==0&&ability.ruleId==='phb2014:class-feature:barbarian-1-rage') patchAbilityOwner(ability,{'rules2014.raging':'false'})
            setAbilities(updated)
            selectParticipant(next.activeId)
        }
        setCombat(next)
        return true
    }

    function finishRemoval(ids: number[], removeAbilities: boolean) {
        const remaining = turns.filter((turn) => !ids.includes(turn.id))
        if (combat && ids.includes(combat.activeId)) {
            if (remaining.length === 0) setCombat(null)
            else advanceTurn()
        }
        setTurns(remaining)
        setAbilities(current => removeParticipantAbilities(current, ids, removeAbilities).map(ability => ({
            ...ability, targets: ability.targets?.filter(target => !ids.includes(target.id)),
        })))
        removalDialog.current?.close()
        setPendingRemoval(null)
    }

    function requestRemoval(ids: number[]) {
        if (abilities.some(ability=>ability.execution && (ids.includes(ability.ownerId!) || ability.targets?.some(target=>ids.includes(target.id))))) {setCombatRuleError('Concludi o interrompi prima l’utilizzo che coinvolge questa creatura.');return}
        if (abilities.some((ability) => ability.ownerId !== null && ids.includes(ability.ownerId))) {
            setPendingRemoval(ids)
        } else {
            finishRemoval(ids, false)
        }
    }

    function removeTurn(id: number) {
        requestRemoval([id])
    }

    function clearTurns() {
        requestRemoval(turns.map((turn) => turn.id))
    }

    function participantAbilities(original: Turn) {
        const ownerCatalog=original.sheet ? catalogForSheet(creationData,catalog,original.sheet) ?? catalog : catalog
        const turn=refreshParticipantAbilities(original)
        if (!(turn.availableAbilityIndexes?.length ?? turn.sheet?.abilities?.length ?? 0) && !abilities.some(ability => ability.ownerId === turn.id)) return null
        const controls:ReactNode[]=[],entries:{group:string;level?:number;control:ReactNode}[]=[]
        function add(ability:Ability,control:ReactNode) {
            const info=combatAbilityInfo(ability,ownerCatalog),query=renewed ? abilitySearch.trim().toLocaleLowerCase() : ''
            if (info.passive || query && !ability.name.toLocaleLowerCase().includes(query) && !info.entry?.name.toLocaleLowerCase().includes(query)) return
            const group=info.level!==undefined ? 'Incantesimi' : catalogAbilityKind(info.entry,ability.section,ability.description ?? info.entry?.description).weaponAttack ? 'Attacchi fisici' : 'Abilità attivabili'
            entries.push({group,level:info.level,control});controls.push(control)
        }
        turn.sheet?.abilities?.forEach((template, index) => {
            const ability = abilities.find((item) => item.ownerId === turn.id && item.sheetAbilityIndex === index)
            const current=ability ?? {...template,id:-1,ownerId:turn.id,remainingTurns:template.remainingTurns ?? 0,active:false}
            if (turn.availableAbilityIndexes && !turn.availableAbilityIndexes.includes(index)) return
            const status=abilityStatus(turn,current)
            add(current,<button className="participant-ability" data-ability-state={status==='In esecuzione' ? 'active' : 'available'} type="button" disabled={catalogStatus==='Caricamento del catalogo…'} key={`sheet-${index}`} onClick={() => openSheetAbility(turn, index)}>
                {ownerCatalog.abilities.find((entry) => entry.id === current.catalogId)?.name || current.name} · {status}
            </button>)
        })
        abilities.filter(ability => ability.ownerId === turn.id && ability.sheetAbilityIndex === undefined).forEach(ability => add(ability,
            <a key={ability.id} data-ability-state={ability.active && (ability.remainingTurns > 0 || ability.timed === false) ? 'active' : 'inactive'} href={`#ability-${ability.id}`} onClick={(event) => { event.preventDefault(); highlightAbility(ability.id) }}>
                {ownerCatalog.abilities.find(entry => entry.id === ability.catalogId)?.name || ability.name || 'Abilità senza nome'} · {abilityStatus(turn,ability)}
            </a>))
        if (!controls.length) return renewed && abilitySearch.trim() ? <p>Nessuna abilità corrisponde alla ricerca.</p> : null
        return renewed ? <ParticipantAbilities entries={entries} search={abilitySearch} label={`Abilità di ${turn.description || 'creatura'}`} sheet={turn.sheet}/> : <div className="participant-abilities" aria-label={`Abilità di ${turn.description || 'creatura'}`}>{controls}</div>
    }

    return (
        <div className={renewed ? 'master-renewed' : 'master-original'}>
        {renewed && <nav className="master-workspace-nav" aria-label="Strumenti del Master">
            <button type="button" aria-pressed={section === 'table'} onClick={() => setSection('table')}>Tavolo <span>{turns.length}</span></button>
            <button type="button" aria-pressed={section === 'library'} onClick={() => setSection('library')}>Schede e creature</button>
            <button type="button" aria-pressed={section === 'rules'} onClick={() => setSection('rules')}>Regole</button>
            <span className="master-workspace-caption">{combat ? 'Combattimento in corso' : 'Preparazione del combattimento'}</span>
        </nav>}
        {combatRuleError && <p role="alert">{combatRuleError}</p>}
        <div className="master-rules-area" hidden={renewed && section !== 'rules'}>
            {renewed && <header className="master-section-heading"><h2>Regole e riferimenti</h2><p>Consulta i manuali e gli strumenti del DM.</p></header>}
            {creationData?.verified ? <Suspense fallback={<p role="status">Caricamento del riferimento 2014…</p>}><RulesPanel data={creationData} expanded={renewed && section === 'rules'}/></Suspense> : renewed && <p role="status">{catalogStatus || 'Riferimenti non disponibili.'}</p>}
        </div>
        {renewed && section === 'library' && <header className="master-section-heading"><h2>Schede e creature</h2><p>Prepara i partecipanti e aggiungili al tavolo prima di iniziare il combattimento.</p>{libraryTools}</header>}
        <div className="tracker-layout" data-section={renewed ? section : undefined} style={{ '--library-width': libraryWidth } as CSSProperties}>
            <CharacterSheets libraryHidden={renewed && section !== 'library'} ref={sheetEditor} onAdd={addCharacter} onSaved={syncSavedSheet} combatStarted={combat !== null || catalogStatus === 'Caricamento del catalogo…'} presentSheetIds={presentSheetIds} catalog={catalog} creationData={creationData} repository={workspace ? {sheets:sessionSheets,write:writeSessionSheets,storageKey:workspace.storageKey,canRemove:workspace.canRemove,remove:workspace.remove} : undefined} />
            <ColumnSeparator label="Ridimensiona schede e combattimento" side="left" minimum={160} otherMinimum={600} onResize={setLibraryWidth} />
            <main className="tracker-main" style={{ '--abilities-width': abilitiesWidth } as CSSProperties}>
                <section className="combat-tracker" aria-labelledby="turns-heading">
                    <h2 id="turns-heading" ref={tableHeading} tabIndex={renewed ? -1 : undefined}>{renewed ? "Turni e partecipanti" : "Combattimento · Turni e schede"}</h2>
                    {catalogStatus && <p className="library-help" role="status">{catalogStatus}</p>}
                        <div className="master-combat-header">
                        <div className="turn-actions combat-controls">
                            {combat ? (
                                <>
                                    <button ref={nextTurnButton} className="sort-turns" type="button" onClick={advanceTurn} aria-keyshortcuts={shortcutLabel(shortcut,true)} title={`Turno successivo (${shortcutLabel(shortcut)})`}>
                                        Turno successivo →
                                    </button>
                                    <kbd className="library-help">{shortcutLabel(shortcut)}</kbd>
                                    <button className="end-combat" type="button" onClick={() => setCombat(null)}>
                                        Termina combattimento
                                    </button>
                                </>
                            ) : (
                                <button className="sort-turns" type="submit" form={combatFormId} disabled={turns.length === 0}>
                                    Inizia combattimento
                                </button>
                            )}
                        <div className="combat-management-tools"><details className={renewed ? "master-table-options" : "master-original-options"} open={!renewed}>
                        <summary hidden={!renewed}>Gestisci combattimento</summary>
                        <div className="turn-actions turn-header-actions">
                            <button className="sort-turns" type="button" onClick={sortTurns} disabled={combat !== null || turns.length === 0}>
                                Ordina per iniziativa ↓
                            </button>
                            <button
                                className="clear-turns"
                                type="button"
                                onClick={clearTurns}
                                disabled={turns.length === 0}
                            >
                                Cancella tutti i partecipanti
                            </button>
                        </div>
                        <details className="combat-shortcut-settings"><summary>Scorciatoia del turno</summary>
                            <label><span>Tasto o combinazione per il turno successivo</span><input aria-label="Scorciatoia turno successivo" readOnly value={shortcutLabel(shortcut)} onKeyDown={event=>{
                                if (event.key==='Tab') return
                                const value=shortcutFromEvent(event.nativeEvent)
                                event.preventDefault();event.stopPropagation()
                                if (value) saveShortcut(value)
                            }}/></label>
                            <p className="library-help">Seleziona il campo e premi il tasto o la combinazione desiderata. La scorciatoia è sospesa mentre scrivi o hai una finestra aperta.</p>
                            <button className="end-combat" type="button" onClick={()=>saveShortcut(defaultNextTurnShortcut)}>Ripristina P</button>
                            {shortcutError && <p role="alert">{shortcutError}</p>}
                        </details>
                        </details>
                        {combatTools&&<div className="master-combat-notifications">{combatTools}</div>}</div>
                        </div>
                        <p className="combat-status" role="status">
                            {combat
                                ? `Round ${combat.round} · Tocca a ${turns.find((turn) => turn.id === combat.activeId)?.description}`
                                : 'Aggiungi PG e mostri con la loro iniziativa, poi inizia il combattimento.'}
                        </p>
                        </div>
                    <form id={combatFormId} onSubmit={(event) => { event.preventDefault(); startCombat() }}>
                        {renewed && !turns.length && <div className="master-empty-table"><h3>Il tavolo è pronto. Chi partecipa?</h3><p>Aggiungi una creatura dal catalogo o scegli una delle tue schede.</p><button type="button" onClick={() => setSection('library')}>Scegli dalle schede</button></div>}
                        <div className="turns-list" onDragOver={(event) => event.preventDefault()} onDrop={handleListDrop}>
                            {turns.map((turn, index) => {
                                const conditions=conditionsFor(abilities,turn.id),due=pendingRepeatSaves(abilities,combat).filter(a=>a.ownerId===turn.id)
                                const concentrating=activeEffects.find(a=>a.ownerId===turn.id&&(a.concentration||a.execution?.phase==='casting'))
                                const concentrationKey=turn.sheet?.playerDetails?.['rules2014.concentration']
                                const concentration=concentrating?.name??(concentrationKey?catalog.abilities.find(a=>a.data.referenceId===concentrationKey||a.id===concentrationKey)?.name??'Incantesimo in corso':undefined)
                                const status=(conditions.length>0||due.length>0||!!concentration)&&<div className="turn-statuses">
                                    {(conditions.length>0||!!concentration)&&<div className="turn-condition-pills" aria-label={`Stati di ${turn.description}`}>{conditions.map(condition=><span className="turn-condition-pill" title={condition} key={condition}>{condition}</span>)}{concentration&&<span className="turn-condition-pill" title={`Concentrazione: ${concentration}`}>Concentrazione</span>}</div>}
                                    {due.length>0&&<p className="turn-save-reminder" role="status" title="Da risolvere a fine turno. Premi Turno successivo per risolvere.">{due.map(a=>`TS ${saveNames[a.repeatSaveRoll!.ability]}${a.repeatSaveRoll!.dc===undefined?'':` · CD ${a.repeatSaveRoll!.dc}`}`).join('; ')} · fine turno</p>}
                                </div>
                                return (
                                <div
                                    className={`turn-row${combat?.activeId === turn.id ? ' active-turn' : ''}${renewed && selectedTurn?.id === turn.id ? ' selected-participant' : ''}${due.length||turn.concentrationChecks?.length?' turn-needs-resolution':''}`}
                                    aria-current={combat?.activeId === turn.id ? 'step' : undefined}
                                    onDoubleClick={event => {
                                        const target=event.target as HTMLElement
                                        if (target.closest('input,select,textarea,label,a,summary,button') && !target.closest('.master-participant-identity button')) return
                                        openTurnSheet(turn)
                                    }}
                                    data-reorder-item
                                    data-reorder-id={turn.id}
                                    key={turn.id}
                                >
                                    <button
                                        aria-label={`Trascina per riordinare il turno ${index + 1}`}
                                        className="turn-drag-handle"
                                        disabled={combat !== null}
                                        draggable={combat === null}
                                        onDragStart={(event) => handleDragStart(event, turn.id)}
                                        onKeyDown={(event) => {
                                            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
                                            event.preventDefault()
                                            const targetIndex = index + (event.key === 'ArrowUp' ? -1 : 1)
                                            const targetTurn = turns[targetIndex]
                                            if (targetTurn) reorderTurn(turn.id, targetTurn.id)
                                        }}
                                        title="Trascina per riordinare; usa le frecce per spostare"
                                        type="button"
                                    >
                                        <span aria-hidden="true">↕</span>
                                    </button>
                                    {renewed ? <div className="turn-description master-participant-name"><div className="master-participant-identity"><button type="button" aria-label={`Dettagli di ${turn.description || `partecipante ${index + 1}`}`} aria-pressed={selectedTurn?.id === turn.id} onClick={() => revealParticipant(turn.id)}><strong>{turn.description || 'Partecipante da nominare'}</strong><span>{turn.sheet?.kind || 'Creatura'}{combat?.activeId === turn.id ? ' · Turno attuale' : selectedTurn?.id === turn.id ? ' · Selezionato' : ' · Dettagli'}</span></button>{activeEffects.some(ability => ability.ownerId === turn.id) && <span className="master-participant-effects">{activeEffects.filter(ability => ability.ownerId === turn.id).length} {activeEffects.filter(ability => ability.ownerId === turn.id).length === 1 ? "effetto in corso" : "effetti in corso"}</span>}</div>{status}</div> : <CatalogSearch
                                        aria-label={`Creatura del turno ${index + 1}`}
                                        required
                                        pattern=".*\S.*"
                                        disabled={combat !== null}
                                        className="turn-description"
                                        type="text"
                                        placeholder="PG o mostro"
                                        value={turn.description}
                                        entries={catalog.creatures}
                                        onChange={(value) => updateTurn(turn.id, 'description', value)}
                                        onSelect={(entry) => selectCreature(turn.id, entry)}
                                    />}
                                    <label className="initiative-field">
                                        <span>Iniziativa</span>
                                        <input
                                            aria-label={`Iniziativa del turno ${index + 1}`}
                                            required
                                            step="1"
                                            disabled={combat !== null}
                                            type="number"
                                            value={turn.initiative}
                                            title={initiativeBonus(turn.sheet) ? `Modificatore iniziativa: ${initiativeBonus(turn.sheet)}. Inserisci il risultato del tiro.` : 'Inserisci il risultato del tiro di iniziativa.'}
                                            onChange={(event) => updateTurn(turn.id, 'initiative', event.target.value)}
                                        />
                                    </label>
                                    <label className="turn-stat turn-pf">
                                        <span>PF</span>
                                        <span className="turn-hitpoints">
                                        <input
                                            aria-label={`PF di ${turn.description || `creatura ${index + 1}`}`}
                                            type="number"
                                            step="1"
                                            value={turn.hitPoints}
                                            onChange={(event) => updateTurn(turn.id, 'hitPoints', event.target.value)}
                                        />
                                        <span className="turn-max-hitpoints" aria-label="PF massimi">/{maximumHitPoints(turn) || '—'}</span>
                                        </span>
                                    </label>
                                    <label className="turn-stat turn-temporary-pf">
                                        <span>PF temporanei</span>
                                        <input
                                            aria-label={`PF temporanei di ${turn.description || `creatura ${index + 1}`}`}
                                            type="number"
                                            min="0"
                                            step="1"
                                            value={turn.temporaryHitPoints}
                                            onChange={(event) => updateTurn(turn.id, 'temporaryHitPoints', event.target.value)}
                                        />
                                    </label>
                                    <label className="turn-stat turn-ca">
                                        <span>CA</span>
                                        <input
                                            aria-label={`CA di ${turn.description || `creatura ${index + 1}`}`}
                                            type="number"
                                            step="1"
                                            value={turn.armorClass}
                                            onChange={(event) => updateTurn(turn.id, 'armorClass', event.target.value)}
                                        />
                                    </label>
                                    <div className="card-info">{turn.sheet?.kind === 'PG' || !turn.sheet?.catalogId ? (
                                        <button className="more-info" type="button" aria-label={`Apri scheda di ${turn.description || 'questo mostro'}`} onClick={() => openTurnSheet(turn)}>Scheda</button>
                                    ) : <InfoButton name={turn.description} label="Scheda"
                                        entry={catalog.creatures.find((entry) => entry.id === turn.sheet?.catalogId)}
                                        description={turn.sheet?.notes}
                                        fields={{ ...(turn.sheet?.catalogId ? {} : Object.fromEntries(Object.entries(characterFields).filter(([key]) => !['name', 'notes', 'hitPoints', 'armorClass', 'initiative'].includes(key)).map(([key, label]) => [label, turn.sheet?.[key as keyof typeof characterFields] ?? '']))), hitPoints: turn.hitPoints, armorClass: turn.armorClass, initiativeModifier: initiativeBonus(turn.sheet) || 'Non disponibile', initiative: turn.initiative || 'Da inserire' }} />}</div>
                                    <div className="damage-controls">
                                        <span>Danni - / Cura +</span>
                                        <div className="hitpoint-adjustment">
                                            <input aria-label={`Danni o cura per ${turn.description || `creatura ${index + 1}`}`} type="number" min="1" step="1"
                                                value={turn.damage ?? ''} placeholder="0"
                                                onChange={(event) => updateTurn(turn.id, 'damage', event.target.value)}
                                                onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault() }} />
                                            <div className="hitpoint-buttons">
                                                <button className="apply-damage" type="button" aria-label={`Applica danni a ${turn.description || `creatura ${index + 1}`}`}
                                                    disabled={hitPointsAfterDamageWithTemporary(turn.hitPoints, turn.temporaryHitPoints, turn.damage ?? '') === null} onClick={() => applyDamage(turn.id)}>−</button>
                                                <button className="apply-damage apply-healing" type="button" aria-label={`Applica cura a ${turn.description || `creatura ${index + 1}`}`}
                                                    disabled={hitPointsAfterHealing(turn.hitPoints, turn.damage ?? '', maximumHitPoints(turn)) === null} onClick={() => applyHealing(turn.id)}>+</button>
                                            </div>
                                        </div>
                                    </div>
                                    {!renewed&&status}
                                    {!!turn.concentrationChecks?.length && <p className="master-concentration-check" role="status">Concentrazione · TS Costituzione CD {turn.concentrationChecks[0]} <button type="button" onClick={()=>resolveConcentration(turn.id,true)}>TS riuscito</button><button type="button" onClick={()=>resolveConcentration(turn.id,false)}>TS fallito: termina concentrazione</button></p>}
                                    {!renewed && participantAbilities(turn)}
                                    {combat?.activeId === turn.id && <strong className="active-turn-label">Turno attuale</strong>}
                                    <button
                                        aria-label={`Elimina il turno ${index + 1}`}
                                        className="delete-turn"
                                        onClick={() => removeTurn(turn.id)}
                                        title="Elimina turno"
                                        type="button"
                                    >
                                        <span aria-hidden="true">×</span>
                                    </button>
                                </div>
                            )})}
                            <button
                                className="add-turn"
                                type="button"
                                disabled={combat !== null}
                                onClick={addTurn}
                                aria-label="Aggiungi PG o mostro"
                            >
                                <span aria-hidden="true">+</span>{renewed && ' Aggiungi partecipante'}
                            </button>
                        </div>
                    </form>
                </section>
                <ColumnSeparator label="Ridimensiona combattimento e abilità" side="right" minimum={280} otherMinimum={280} onResize={setAbilitiesWidth} />
                <ParticipantInspector ref={inspector} tabIndex={renewed ? -1 : undefined} aria-label={renewed ? 'Dettagli e abilità del tavolo' : undefined}>
                {renewed && <>
                    <button type="button" className="master-back-to-table" onClick={() => { tableHeading.current?.scrollIntoView({ block: 'start' }); tableHeading.current?.focus({ preventScroll: true }) }}>Torna ai partecipanti</button>
                    <div className="master-inspector-header">
                    <InspectorNavigation mode={inspectorMode} onChange={setInspectorMode}/>
                    {inspectorMode === 'participant' && selectedTurn && <h2 id="master-detail-name">{selectedTurn.description || 'Partecipante da nominare'}</h2>}
                    </div>
                    {inspectorMode === 'participant' && (selectedTurn ? <section className="master-participant-detail" aria-labelledby="master-detail-name">
                        <p className="master-detail-label">Partecipante selezionato</p>
                        <ParticipantStats hitPoints={selectedTurn.hitPoints} maximum={maximumHitPoints(selectedTurn)} armorClass={selectedTurn.armorClass} initiative={selectedTurn.initiative}/>
                        <div className="master-detail-fields"><label><span>Nome / creatura</span><CatalogSearch aria-label="Nome del partecipante selezionato" value={selectedTurn.description} disabled={combat !== null} entries={catalog.creatures} onChange={value => updateTurn(selectedTurn.id, 'description', value)} onSelect={entry => selectCreature(selectedTurn.id, entry)}/></label>
                        <label><span>PF temporanei</span><input aria-label={`PF temporanei di ${selectedTurn.description || 'partecipante selezionato'}`} type="number" min="0" step="1" value={selectedTurn.temporaryHitPoints} onChange={event => updateTurn(selectedTurn.id, 'temporaryHitPoints', event.target.value)}/></label></div>
                        {selectedTurn.sheet&&!creatureType(selectedTurn.sheet)&&<details key={selectedTurn.id} open><summary>Dettagli creatura</summary><label className="master-creature-type">Tipo di creatura<select aria-label={`Tipo di creatura di ${selectedTurn.description}`} value={creatureType(selectedTurn.sheet)??''} onChange={event=>{
                            const type=event.target.value
                            if(type&&!Object.hasOwn(creatureTypeNames,type))return
                            if(sheetEditor.current?.patchDetails(selectedTurn.sheet!.id,{'creature.type':type})===false){setCombatRuleError('Salvataggio del tipo di creatura non riuscito.');return}
                            setTurns(current=>current.map(t=>t.id===selectedTurn.id?{...t,sheet:{...t.sheet!,playerDetails:{...t.sheet!.playerDetails,'creature.type':type}}}:t))
                        }}><option value="">Da specificare</option>{Object.entries(creatureTypeNames).map(([type,label])=><option key={type} value={type}>{label}</option>)}</select></label></details>}
                        <button type="button" className="master-open-sheet" onClick={() => openTurnSheet(selectedTurn)}>Apri scheda completa</button>
                        <div className="master-available-abilities"><h3>Abilità e azioni disponibili</h3><input type="search" aria-label="Cerca abilità del partecipante" placeholder="Cerca un’abilità o un incantesimo…" value={abilitySearch} onChange={event => setAbilitySearch(event.target.value)}/>{participantAbilities(selectedTurn) || <p>Nessuna abilità associata. Puoi aggiungerne una qui sotto.</p>}</div>
                    </section> : <div className="master-inspector-empty"><h2>Dettagli del partecipante</h2><p>Aggiungi un partecipante al tavolo per consultarne scheda e abilità.</p></div>)}
                    {activeEffects.length > 0 && <section className="master-active-effects" aria-labelledby="master-effects-heading"><h3 id="master-effects-heading">Effetti del combattimento <span>{activeEffects.length}</span></h3><ul>{activeEffects.map(ability => <li key={ability.id}><button type="button" onClick={() => highlightAbility(ability.id)}><strong>{conditionEffectName(ability,abilities) || 'Effetto senza nome'}</strong><span>{turns.find(turn => turn.id === ability.ownerId)?.description || 'Senza proprietario'} · {ability.execution ? 'In esecuzione' : ability.timed === false ? 'Senza conteggio' : `${ability.remainingTurns} turni`}</span></button></li>)}</ul></section>}
                </>}
                <div hidden={renewed && inspectorMode === 'participant' && !selectedTurn}>
                <AbilitiesTracker ownerFilter={renewed && inspectorMode === 'participant' ? selectedTurn?.id : undefined} heading={renewed ? inspectorMode === 'participant' ? 'Abilità in uso e da configurare' : 'Tutte le abilità' : undefined} onAdd={addAbility} abilities={abilities} setAbilities={setAbilities} participants={turns.map(refreshParticipantAbilities)} catalog={catalog} catalogForOwner={(id)=>{const sheet=turns.find((turn)=>turn.id===id)?.sheet;return sheet ? catalogForSheet(creationData,catalog,sheet) ?? catalog : catalog}} combat={combat} onActivate={activateCombatAbility} onEnd={endCombatAbility} onResolve={finishCombatAbility} onCancelCast={cancelCombatCast} creationData={creationData} actionError={abilityError} />
                </div>
                </ParticipantInspector>
                <dialog ref={repeatDialog} className="character-dialog repeat-save-dialog" aria-labelledby="repeat-save-heading" {...dismissRepeat} onClose={()=>{setRepeatSaveId(null);nextTurnButton.current?.focus()}}>
                    <div className="dialog-header"><h2 id="repeat-save-heading">Tiro salvezza di fine turno</h2><button type="button" aria-label="Chiudi tiro salvezza di fine turno" onClick={()=>repeatDialog.current?.close()}>×</button></div>
                    {repeatEffect&&repeatTarget?.sheet&&<RepeatSavingThrow key={`${repeatEffect.id}:${combat?.round}:${repeatEffect.repeatSaveRoll?.dc??'unknown'}`} effect={repeatEffect} target={{...repeatTarget,sheet:repeatTarget.sheet}} abilities={abilities} data={creationData} onResolve={(success,consumed,dc)=>{
                        if(!combat)return false
                        const updated=abilities.map(a=>a.id===repeatEffect.id?{...a,active:!success,remainingTurns:success?0:a.remainingTurns,repeatSaveRoll:{...repeatEffect.repeatSaveRoll!,dc,lastRound:combat.round}}:consumed.includes(a.id)?{...a,active:false,remainingTurns:0}:a)
                        const settled=settleCombatEffects(updated,turns),due=pendingRepeatSaves(settled.abilities,combat)[0]
                        if(!due) {
                            if(!completeTurn(settled.abilities,settled.turns))return false
                            setRepeatSaveId(null)
                        } else {
                            const changed=settled.turns.flatMap(t=>t.sheet&&t.sheet!==turns.find(old=>old.id===t.id)?.sheet?[t.sheet]:[])
                            if(changed.length&&sheetEditor.current?.patchMany(changed)===false){setCombatRuleError('Salvataggio della concentrazione non riuscito.');return false}
                            setTurns(settled.turns);setAbilities(settled.abilities);setRepeatSaveId(due.id)
                        }
                        return true
                    }}/> }
                </dialog>
                <dialog ref={removalDialog} className="character-dialog" aria-labelledby="removal-heading" {...dismissRemovalDialog} onClose={() => setPendingRemoval(null)}>
                    {pendingRemoval && (
                        <>
                            <h2 id="removal-heading">Rimuovi dal combattimento</h2>
                            <p>{turns.filter((turn) => pendingRemoval.includes(turn.id)).map((turn) => turn.description || 'Creatura senza nome').join(', ')}</p>
                            <p className="library-help">Vuoi rimuovere anche le {removalAbilities.length} abilità collegate?</p>
                            {unexpiredAbilities.length > 0 && (
                                <div className="removal-warning" role="alert">
                                    <strong>Ci sono abilità attivate che devono ancora scadere:</strong>
                                    <ul>
                                        {unexpiredAbilities.map((ability) => <li key={ability.id}>{catalog.abilities.find((entry) => entry.id === ability.catalogId)?.name || ability.name || 'Abilità senza nome'} · {ability.remainingTurns} turni rimanenti</li>)}
                                    </ul>
                                </div>
                            )}
                            <p className="library-help">Se mantieni le abilità, verranno scollegate dal personaggio e quelle attivate continueranno il conteggio.</p>
                            <div className="turn-actions">
                                <button className="clear-turns" type="button" onClick={() => finishRemoval(pendingRemoval, true)}>Rimuovi anche le abilità</button>
                                <button className="sort-turns" type="button" onClick={() => finishRemoval(pendingRemoval, false)}>Mantieni le abilità</button>
                                <button className="end-combat" type="button" autoFocus onClick={() => removalDialog.current?.close()}>Annulla</button>
                            </div>
                        </>
                    )}
                </dialog>
            </main>
        </div>
        {renewed && section === 'table' && combat && <div className="master-mobile-combat-bar"><span>Round {combat.round}<strong>{turns.find(turn => turn.id === combat.activeId)?.description}</strong></span><button type="button" onClick={advanceTurn}>Turno successivo</button></div>}
        </div>
    )
}
