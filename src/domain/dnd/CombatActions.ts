import { castSheetSpell, sheetClassLevels, sheetRuleResources } from './ActiveRules.ts'
import { wildShapeResources } from './VerifiedDatabase.ts'
import { integerValue, type CharacterSheet } from '../../utils/CharacterSheets.ts'
import { durationTurns, hitPointsAfterHealing, hitPointsAfterDamageWithTemporary, type Ability } from '../../utils/Combat.ts'
import { catalogAbilityKind, templateFromCatalog, type Catalog } from '../../utils/Catalog.ts'
import { creationEnabled, type CreationData } from '../../utils/PlayerCreation.ts'
import { spellEdition, classId } from '../../utils/Spellcasting.ts'
import { savedWizardFeatures, featureResourceKey, featureResourceRemaining } from '../../utils/Wizard.ts'
import { assertCombatTargets } from './CombatTargets.ts'
import { sheetCombatAttacks } from '../../utils/PlayerAbilities.ts'

const object=(value:unknown):Record<string,unknown> => value && typeof value==='object' && !Array.isArray(value) ? value as Record<string,unknown> : {}
const normalized=(value:string)=>value.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'')
export function assessAttack(edition:'2014'|'2024',die:number,modifier:number|undefined,armorClass:number|undefined) {
    // 2014: D&D_5_Player_Original_Handbook.pdf, PDF 195, Attack Rolls / Rolling 1 or 20.
    // 2024: D&D_5.5_manuale_compatto_italiano.pdf (SRD 5.2.1), PDF 7–8, Tiri per colpire / Ottenere un 20 o un 1.
    if (!['2014','2024'].includes(edition)||!Number.isInteger(die)||die<1||die>20) throw new Error('Tiro per colpire non valido.')
    const bonus=modifier!==undefined&&Number.isSafeInteger(modifier)?modifier:undefined
    const total=bonus!==undefined&&Number.isSafeInteger(die+bonus)?die+bonus:undefined
    const ac=armorClass!==undefined&&Number.isSafeInteger(armorClass)&&armorClass>=0?armorClass:undefined
    return {edition,die,modifier:bonus,total,armorClass:ac,critical:die===20,hit:die===20?true:die===1?false:total!==undefined&&ac!==undefined?total>=ac:undefined}
}
export type AttackAssessment=ReturnType<typeof assessAttack>
export type UseOption={id:string;label:string;remaining:number|null;cost?:number}

export function combatAbilityInfo(ability:Pick<Ability,'catalogId'|'duration'|'remainingTurns'|'instantaneous'|'damageEnabled'|'spellLevel'|'castingAlternative'|'description'|'section'>,catalog:Catalog) {
    const entry=catalog.abilities.find(entry=>entry.id===ability.catalogId),m=object(entry?.data.mechanics)
    const level=ability.spellLevel ?? (typeof entry?.data.level==='number' ? entry.data.level : undefined)
    // PHB 2014, D&D_5_Player_Original_Handbook.pdf, PDF 260, Mending:
    // repairs a touched object; "former damage" describes the repair, not damage dealt.
    // Keep this verified exception scoped to its edition and identity, including old saved overrides.
    const repairsObject=entry?.data.referenceId==='phb2014:spell:mending' && entry.data.edition==='2014'
    // PHB 2014 PDF 258, 238 and 276: these spells enchant a weapon;
    // their damage bonuses are not damage dealt by casting the spell.
    // PHB 2014 PDF 257: Mage Armor is also a lasting, damage-free benefit.
    const knownPersistentBenefit=entry?.data.edition==='2014'&&['phb2014:spell:magic-weapon','phb2014:spell:elemental-weapon','phb2014:spell:shillelagh','phb2014:spell:mage-armor','phb2014:spell:shield'].includes(String(entry.data.referenceId))
    const {attack,passive}=catalogAbilityKind(entry,ability.section,ability.description ?? entry?.description)
    const instantaneous=!knownPersistentBenefit&&(repairsObject || (ability.instantaneous ?? (m.duration==='Instantaneous' || object(entry?.data.durationInfo).kind==='instantaneous' || entry?.rounds===0 || attack)))
    // ponytail: damage text only suggests a checkbox; the DM confirms targets and final damage, never an inferred dice formula.
    const damage=!knownPersistentBenefit&&!repairsObject && (ability.damageEnabled ?? (attack || /damage|\bdanni\b/i.test(Object.keys(m).length ? JSON.stringify(m) : entry?.description || ability.description || '')))
    const alternatives=Array.isArray(m.castingAlternatives) ? m.castingAlternatives.map(object) : []
    const casting=alternatives[ability.castingAlternative ?? 0] ?? object(m.casting),castingText=String(entry?.data.castingTime ?? '')
    const prolonged=casting.unit==='minute' || casting.unit==='hour' || !casting.unit && /\bminut|\bor[ae]\b|\bhours?\b/i.test(castingText)
    const ritual=m.ritual===true || entry?.data.ritual===true
    const concentration=m.concentration===true || object(entry?.data.durationInfo).concentration===true
    const unit=typeof casting.unit==='string' ? casting.unit : ['action','bonus-action','reaction'].includes(String(m.activation)) ? String(m.activation) : ['action','bonus-action','reaction'].includes(String(object(m.activation).unit)) ? String(object(m.activation).unit) : /bonus/i.test(castingText) ? 'bonus-action' : /reazion|reaction/i.test(castingText) ? 'reaction' : prolonged ? 'minute' : 'action'
    return {entry,level,instantaneous,damage,prolonged,ritual,concentration,unit,alternatives,repairsObject,passive,attack}
}

// D&D_5_Player_Original_Handbook.pdf (2014), PDF 190, 73 and 203: another action spell needs another valid
// action (e.g. Action Surge). The Master confirms availability, not an extra slot.
export function requiresAdditionalSpellAction(sheet:CharacterSheet,ability:Ability,catalog:Catalog) {
    const info=combatAbilityInfo(ability,catalog)
    if(spellEdition(sheet)!=='2014'||info.level===undefined||info.unit!=='action')return false
    const history=JSON.parse(sheet.playerDetails?.['rules2014.spellsThisTurn']??sheet.playerDetails?.['combat.spellsThisTurn']??'[]')
    if(!Array.isArray(history))throw new Error('Cronologia degli incantesimi del turno non valida.')
    return history.some(cast=>cast?.unit==='action')
}

function pool(sheet:CharacterSheet,key:string) {
    for (const suffix of ['total','used']) {
        const raw=sheet.playerDetails?.[key+'.'+suffix]
        if (raw?.trim() && integerValue(raw)===undefined) throw new Error('Contatore delle risorse non valido: correggilo nella scheda.')
    }
    const total=integerValue(sheet.playerDetails?.[key+'.total']) ?? 0,used=integerValue(sheet.playerDetails?.[key+'.used']) ?? 0
    if (total<0 || used<0 || used>total) throw new Error('Contatore delle risorse non valido: correggilo nella scheda.')
    return total-used
}

export function combatUseOptions(sheet:CharacterSheet|undefined,ability:Ability,catalog:Catalog,data?:CreationData):UseOption[] {
    const {entry,level,ritual,passive}=combatAbilityInfo(ability,catalog),d=sheet?.playerDetails ?? {}
    if (passive) return []
    const edition=entry?.data.edition ?? (entry?.data.ruleset==='dnd5e-2024' ? '2024' : ability.ruleId?.includes('2014:') ? '2014' : undefined)
    if (sheet && (edition==='2014' || edition==='2024') && spellEdition(sheet)!==edition) throw new Error(`Questa voce usa regole ${edition}: scegli la voce dell’edizione della scheda.`)
    if (!sheet) return level!==undefined && level>0 && ability.castingSource!=='free' ? [] : [{id:level===0 ? 'cantrip' : 'free',label:'Senza risorse',remaining:null}]
    const verified=spellEdition(sheet)==='2014' && data?.verified && creationEnabled(sheet)
    const resources=verified ? sheetRuleResources(sheet,data.verified!) : []
    for (const resource of resources) if (d['rules2014.used.'+resource.id]?.trim() && integerValue(d['rules2014.used.'+resource.id])===undefined) throw new Error('Consumo della risorsa non valido: '+resource.name+'.')
    const entity=verified ? data.verified!.reviewedEntities.find(entity=>entity.id===ability.ruleId && entity.verification.complete) : undefined,effect=object(entity?.mechanics.effect)
    const resourceCost=object(effect.resourceCost ?? effect.cost)
    const namedPool=typeof resourceCost.pool==='string' ? ({'cleric-channel-divinity':'channel-divinity','paladin-channel-divinity':'channel-divinity','bardic-inspiration':'inspiration'} as Record<string,string>)[resourceCost.pool] ?? resourceCost.pool : undefined
    const costPool=namedPool ?? (typeof effect.kiCost==='number' ? 'ki' : typeof effect.sorceryPointCost==='number' ? 'sorcery' : typeof effect.wildShapeUsesCost==='number' ? 'wild-shape' : undefined)
    if (costPool) {
        const resource=resources.find(resource=>resource.id===costPool),cost=Number(resourceCost.cost ?? resourceCost.uses ?? effect.kiCost ?? effect.sorceryPointCost ?? effect.wildShapeUsesCost)
        if (verified && costPool==='wild-shape' && wildShapeResources(data.verified!,sheetClassLevels(sheet)).maximum==='unlimited') return [{id:'free',label:'Forma Selvatica · utilizzi illimitati',remaining:null,cost}]
        return resource ? [{id:'resource:'+resource.id,label:resource.name,remaining:resource.maximum-resource.used,cost}] : []
    }
    if (effect.cost==='one-spell-slot' || effect.cost==='one-ranger-spell-slot') return Array.from({length:9},(_,i)=>i+1).filter(n=>Number(d[`slots.${n}.total`])>0).map(n=>({id:'slot:'+n,label:`Slot di ${n}º livello`,remaining:pool(sheet,'slots.'+n),cost:1}))
    if (level!==undefined) {
        // ponytail: exceptional casting binds an existing sheet pool with DM confirmation;
        // add a verified grant model before inferring innate/item costs automatically.
        if (ability.castingSource==='free') return [{id:'free',label:'Privilegio senza slot né utilizzi · conferma DM',remaining:null,cost:1}]
        if (ability.castingSource==='resource') return [...resources.filter(resource=>resource.id!=='pact'&&!resource.id.startsWith('arcanum:')).map(resource=>({id:'resource:'+resource.id,label:resource.name,remaining:resource.maximum-resource.used})),
            ...savedWizardFeatures(sheet).filter(feature=>feature.resource).map(feature=>({id:'wizard:'+feature.index,label:feature.name,remaining:featureResourceRemaining(sheet,feature)}))]
        if (level===0) return [{id:'cantrip',label:'Trucchetto · senza slot',remaining:null}]
        const options:UseOption[]=[]
        for (let n=level;n<=9;n++) if ((integerValue(d[`slots.${n}.total`]) ?? 0)>0) options.push({id:'slot:'+n,label:`Slot di ${n}º livello`,remaining:pool(sheet,'slots.'+n),cost:1})
        const pact=resources.find(resource=>resource.id==='pact')
        if (pact && Number(d['rules2014.pact.level'])>=level) options.push({id:'pact',label:`Patto · ${d['rules2014.pact.level']}º livello`,remaining:pact.maximum-pact.used})
        const arcanum=resources.find(resource=>resource.id==='arcanum:'+entry?.data.referenceId)
        if (arcanum) options.push({id:'resource:'+arcanum.id,label:arcanum.name,remaining:arcanum.maximum-arcanum.used})
        if (ritual && (spellEdition(sheet)==='2024' || ['bard','cleric','druid','wizard'].includes(classId(sheet)))) options.push({id:'ritual',label:'Rituale · +10 minuti, senza slot',remaining:null})
        // Innate/item casting must explicitly bind its own pool, rather than silently borrowing class slots.
        return options
    }
    const matched=resources.find(resource=>resource.id===ability.ruleId || normalized(resource.name)===normalized(ability.name))
    if (matched) return [{id:'resource:'+matched.id,label:matched.name,remaining:matched.maximum-matched.used}]
    const feature=savedWizardFeatures(sheet).find(feature=>feature.resource && normalized(feature.name)===normalized(ability.name))
    if (feature) return [{id:'wizard:'+feature.index,label:feature.name,remaining:featureResourceRemaining(sheet,feature)}]
    return [{id:'free',label:'Senza risorse',remaining:null},...resources.map(resource=>({id:'resource:'+resource.id,label:resource.name,remaining:resource.maximum-resource.used}))]
}

export function selectedUseOption(sheet:CharacterSheet|undefined,ability:Ability,catalog:Catalog,data?:CreationData) {
    const options=combatUseOptions(sheet,ability,catalog,data),cost=ability.resourceCost ?? 1
    const available=(option:UseOption)=>option.remaining===null || option.remaining>=(option.cost ?? cost)
    return (ability.execution ? options.find(option=>option.id===ability.execution?.option) : options.find(option=>option.id===ability.useOption && available(option))) ?? options.find(available) ?? options[0]
}

export function combatAbilityStatus(sheet:CharacterSheet|undefined,ability:Ability,catalog:Catalog,data?:CreationData) {
    if (combatAbilityInfo(ability,catalog).passive) return 'Passiva'
    if (ability.execution || ability.active && (ability.timed===false || ability.remainingTurns>0)) return 'In esecuzione'
    const options=combatUseOptions(sheet,ability,catalog,data),cost=ability.resourceCost ?? 1
    return options.every(option=>option.remaining!==null && option.remaining<(option.cost ?? cost)) ? 'Esauriti utilizzi' : 'Usa'
}

export function spendCombatUse(sheet:CharacterSheet,ability:Ability,catalog:Catalog,data:CreationData|undefined,optionId:string,cost=1):CharacterSheet {
    // PHB 2014 PDF 191, Reactions: refresh at the START of the owner's next turn.
    // Revised rule verified separately: D&D_5.5_manuale_compatto_italiano.pdf, PDF 211, Reazione.
    const unit=combatAbilityInfo(ability,catalog).unit,reaction=unit==='reaction'
    if(reaction&&sheet.playerDetails?.['combat.reactionUsed']==='true')throw new Error('Hai già usato la reazione: torna disponibile all’inizio del tuo prossimo turno.')
    if(unit==='bonus-action')spendBonusAction(sheet)
    const next=spendCombatUseUnchecked(sheet,ability,catalog,data,optionId,cost)
    return reaction||unit==='bonus-action'?{...next,playerDetails:{...next.playerDetails,[reaction?'combat.reactionUsed':'combat.bonusActionUsed']:'true'}}:next
}

// D&D_5_Player_Original_Handbook.pdf, PDF 190, Bonus Actions: one per own turn.
// Redirecting Gust of Wind is not a new cast (SRD 5.1 IT, PDF 160).
export function bonusActionUsed(sheet:CharacterSheet):boolean {
    if(sheet.playerDetails?.['combat.bonusActionUsed']==='true')return true
    return ['combat.spellsThisTurn','rules2014.spellsThisTurn'].some(key=>{
        const history:unknown=JSON.parse(sheet.playerDetails?.[key]??'[]')
        return Array.isArray(history)&&history.some(cast=>cast?.unit==='bonus-action')
    })
}

export function spendBonusAction(sheet:CharacterSheet):CharacterSheet {
    if(bonusActionUsed(sheet))throw new Error('Hai già usato l’azione bonus in questo turno.')
    return {...sheet,playerDetails:{...sheet.playerDetails,'combat.bonusActionUsed':'true'}}
}

function spendCombatUseUnchecked(sheet:CharacterSheet,ability:Ability,catalog:Catalog,data:CreationData|undefined,optionId:string,cost=1):CharacterSheet {
    if (/^sheet-attack:[0-5]$/.test(ability.ruleId ?? '') && !sheetCombatAttacks(sheet).some(attack=>attack.ruleId===ability.ruleId)) throw new Error('Arma non più disponibile tra gli attacchi della scheda.')
    assertCombatTargets(ability,catalog,sheet,optionId)
    if (!Number.isSafeInteger(cost) || cost<1) throw new Error('Il costo deve essere un intero positivo.')
    const option=combatUseOptions(sheet,ability,catalog,data).find(option=>option.id===optionId)
    if (!option || option.remaining!==null && option.remaining<cost) throw new Error('Utilizzi esauriti o modalità di utilizzo non disponibile.')
    if (option.cost!==undefined && option.cost!==cost) throw new Error('Il costo deve rispettare il privilegio: '+option.cost+'.')
    const info=combatAbilityInfo(ability,catalog),d=sheet.playerDetails ?? {},next={...sheet,playerDetails:{...d}}
    if (info.level!==undefined) {
        if (ability.castingSource!=='resource' && cost!==1) throw new Error('Un lancio consuma un solo slot o utilizzo.')
        if (d['rules2014.raging']==='true' && spellEdition(sheet)==='2014') throw new Error('Durante l’ira non puoi lanciare incantesimi.')
        const history:unknown=JSON.parse((spellEdition(sheet)==='2014' ? d['rules2014.spellsThisTurn'] ?? d['combat.spellsThisTurn'] : d['combat.spellsThisTurn']) ?? '[]')
        if (!Array.isArray(history) || history.some(cast=>!cast || !Number.isSafeInteger(cast.level) || !['action','bonus-action','reaction','minute','hour'].includes(cast.unit))) throw new Error('Cronologia del turno non valida.')
        const spendingSlot=optionId.startsWith('slot:') || optionId==='pact'
        if ((!ability.castingSource || ability.castingSource==='class') && spellEdition(sheet)==='2014' && data?.verified && creationEnabled(sheet) && info.entry?.data.edition==='2014' && typeof info.entry.data.referenceId==='string') {
            const mode=optionId.startsWith('slot:') ? 'spellcasting-slot' : optionId==='pact' ? 'pact-slot' : optionId.startsWith('resource:arcanum:') ? 'mystic-arcanum' : optionId==='ritual' ? 'ritual' : 'cantrip'
            const cast=castSheetSpell(sheet,data.verified,info.entry.data.referenceId,{mode,spellsThisTurn:history,castingAlternative:ability.castingAlternative ?? 0,
                manualEffectResolution:ability.requirementsConfirmed===true,
                slotLevel:optionId.startsWith('slot:') ? Number(optionId.slice(5)) : optionId==='pact' ? Number(d['rules2014.pact.level']) : undefined,
                armorProficient:true,components:{canSpeak:true,freeSomaticHand:true,materialHand:true,materialSource:'specific',specificMaterialsConfirmed:true},longCastingCompleted:true}).sheet
            return {...cast,playerDetails:{...cast.playerDetails,'combat.spellsThisTurn':JSON.stringify([...history,{level:info.level,unit:info.unit,slot:spendingSlot}])}}
        }
        // PHB 2014 PDF 203; SRD 5.2.1 PDF 119. Unknown spell effects remain a DM resolution.
        if (spellEdition(sheet)==='2024' && spendingSlot && history.some(cast=>cast.slot)) throw new Error('Puoi spendere un solo slot per lanciare incantesimi nello stesso turno (2024).')
        if (spellEdition(sheet)==='2014' && (info.unit==='bonus-action' && history.some(cast=>cast.level!==0 || cast.unit!=='action') || history.some(cast=>cast.unit==='bonus-action') && (info.level!==0 || info.unit!=='action'))) throw new Error('Limitazione degli incantesimi con azione bonus nello stesso turno (2014).')
        next.playerDetails['combat.spellsThisTurn']=JSON.stringify([...history,{level:info.level,unit:info.unit,slot:spendingSlot}])
        if (spellEdition(sheet)==='2014') next.playerDetails['rules2014.spellsThisTurn']=JSON.stringify([...history.map(cast=>({level:cast.level,unit:cast.unit})),{level:info.level,unit:info.unit}])
    }
    if (optionId.startsWith('slot:')) {
        const key=`slots.${Number(optionId.slice(5))}.used`
        next.playerDetails[key]=String((integerValue(d[key]) ?? 0)+1)
    } else if (optionId==='pact' || optionId.startsWith('resource:')) {
        const id=optionId==='pact' ? 'pact' : optionId.slice(9),key='rules2014.used.'+id
        next.playerDetails[key]=String((integerValue(d[key]) ?? 0)+cost)
    } else if (optionId.startsWith('wizard:')) {
        const feature=savedWizardFeatures(sheet).find(feature=>feature.index===optionId.slice(7))
        if (!feature) throw new Error('Privilegio non disponibile.')
        next.playerDetails[featureResourceKey(feature)]=String(featureResourceRemaining(sheet,feature)-cost)
    }
    if (info.concentration) next.playerDetails['rules2014.concentration']=ability.ruleId ?? ability.catalogId ?? ability.name
    return next
}

export function resolvedAbility(ability:Ability,catalog:Catalog,combat:import('../../utils/Combat.ts').Combat|null,participants:{id:number}[]):Ability {
    const info=combatAbilityInfo(ability,catalog)
    const restored=ability.duration==='Personalizzata' && ability.remainingTurns===0 && info.entry ? templateFromCatalog(info.entry) : ability
    const remainingTurns=restored.duration==='Personalizzata' ? restored.remainingTurns ?? 0 : durationTurns[restored.duration]
    const next={...ability,duration:restored.duration,timed:restored.timed,execution:undefined,requirementsConfirmed:false,active:!info.instantaneous,remainingTurns}
    // PHB 2014, D&D_5_Player_Original_Handbook.pdf, PDF 190, 240 and 252:
    // Durations follow the caster’s turn: ten rounds/minute, 600 rounds/hour.
    if(next.active&&['phb2014:spell:hold-person','phb2014:spell:false-life'].includes(next.ruleId??'')&&combat)return {...next,expiresAt:'start',expiryOwnerId:next.ownerId??undefined,expiryRound:combat.round+remainingTurns}
    if (next.active && next.expiresAt && combat) {
        const owner=next.expiryOwnerId ?? next.ownerId,ownerIndex=participants.findIndex(participant=>participant.id===owner),activeIndex=participants.findIndex(participant=>participant.id===combat.activeId)
        next.expiryRound=combat.round+(ownerIndex>activeIndex ? 0 : 1)
    }
    return next
}

export function resolveCombatDamage<T extends {id:number;hitPoints:string;temporaryHitPoints:string;sheet?:CharacterSheet}>(ability:Ability,turns:T[],catalog?:Catalog):T[] {
    if (!ability.execution || ability.execution.phase!=='resolving') throw new Error('Nessun utilizzo da risolvere.')
    if (catalog) assertCombatTargets(ability,catalog,turns.find(turn=>turn.id===ability.ownerId)?.sheet)
    const targets=ability.targets ?? []
    if (new Set(targets.map(target=>target.id)).size!==targets.length) throw new Error('Bersagli duplicati.')
    for (const target of targets) if (!target.resolved || !target.damage.trim() || !Number.isSafeInteger(Number(target.damage)) || Number(target.damage)<0 || !turns.some(turn=>turn.id===target.id)) throw new Error('Conferma i danni finali di ciascun bersaglio (0 se non subisce danni).')
    return turns.map(turn=>{
        const target=targets.find(target=>target.id===turn.id)
        if (!target || Number(target.damage)===0) return turn
        const result=hitPointsAfterDamageWithTemporary(turn.hitPoints,turn.temporaryHitPoints,target.damage)
        if (!result) throw new Error('Punti ferita del bersaglio non validi.')
        return {...turn,...result}
    })
}

// PHB 2014, D&D_5_Player_Original_Handbook.pdf, PDF 198, Healing:
// regained HP cannot exceed the maximum; temporary HP are unaffected.
export function restoreCombatHitPoints<T extends {hitPoints:string;sheet?:CharacterSheet}>(turn:T,amount:number):T {
    const current=integerValue(turn.hitPoints),maximum=integerValue(turn.sheet?.playerDetails?.maxHitPoints)
    if(!Number.isSafeInteger(amount)||amount<0||current===undefined||current<0||maximum===undefined||maximum<0)throw new Error('Guarigione non applicata: verifica i PF attuali e massimi nella scheda del bersaglio.')
    const hitPoints=amount===0?turn.hitPoints:hitPointsAfterHealing(turn.hitPoints,String(amount),String(maximum))
    if(hitPoints===null)throw new Error('Punti ferita del bersaglio non validi.')
    return {...turn,hitPoints,sheet:turn.sheet?{...turn.sheet,hitPoints}:undefined}
}

// PHB 2014, D&D_5_Player_Original_Handbook.pdf, PDF 199: the chosen pool
// replaces the old one, never adds to it and never changes actual HP.
export function grantCombatTemporaryHitPoints<T extends {temporaryHitPoints:string;sheet?:CharacterSheet}>(turn:T,amount:number|undefined,source?:string):T {
    if(amount===undefined||!Number.isSafeInteger(amount)||amount<0)throw new Error('PF temporanei non validi.')
    const temporaryHitPoints=String(amount)
    return {...turn,temporaryHitPoints,sheet:turn.sheet?{...turn.sheet,playerDetails:{...turn.sheet.playerDetails,temporaryHitPoints,'temporaryHitPoints.source':source??''}}:undefined}
}
