/** Isolated candidate loader. The running application's loader does not import this module. */
import type { CreationData, Origin } from '../../utils/PlayerCreation.ts'
import type { Ability, BackgroundMechanics, BackgroundTable, CreatureMechanics, MagicItemMechanics, SupernaturalGiftMechanics, TrinketEntry, FirearmStatistics, PoisonMechanics, PoisonDelivery, StoredSpell, TreasureTableMechanics, CoinDenomination, TreasureCoinFormula, ChaseMechanics, ObjectStatisticsMechanics, SpellPointsMechanics } from '../../../scripts/rules2014/schema.ts'

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
export type RuleSource = { edition: '2014'; filename: string; pdfPages: number[]; printedPages: number[] | null; section: string; book: string; url?: string }
export type ReviewedEntity = {
    id: string; index: string; edition: '2014'; kind: string; name: string; nameIt: string | null
    mechanics: { [key: string]: Json }; relations: Record<string, string | string[]>; sources: RuleSource[]
    verification: { identity?: string; mechanics: string; complete: boolean; missingFields: string[] }
    fieldSources?: Record<string, number[]>
}
export type SelectionOrigin = {
    originId: string; classId?: string; minimumClassLevel?: number; subclassId?: string; featId?: string
}
export type FightingStyleEffect = {
    attackBonus?: number; armorClassBonus?: number; damageBonus?: number; requires?: string
    rerollDamageDieResults?: number[]; mustUseNewRoll?: boolean; activation?: 'reaction'
    trigger?: string; effect?: 'attack-disadvantage'; addsAbilityModifierTo?: string
}
export type ManeuverEffect = {
    activation?: string; trigger?: string; target?: string; targetReaction?: string
    superiorityDieAddedTo?: string; save?: 'strength' | 'wisdom'; failedSave?: string
    advantage?: string; expires?: string; advantageExpires?: string | null; reachIncreaseFt?: number
    appliesTo?: string; opportunityAttackImmunity?: string; damageReduction?: string; timing?: string
    sizeForSave?: string; temporaryHitPoints?: string; attack?: string; secondTarget?: string
    requires?: string; secondTargetDamage?: string; damageType?: string
}
type WarlockOptionMechanics = {
    optionType: 'eldritch-invocation' | 'pact-boon'
    prerequisites: { minimumWarlockLevelForSelection: number; pactOptionId?: string; knownCantripId?: string }
    effect: { [key: string]: Json }
}
type FighterOptionMechanics = {
    optionType: 'fighting-style'; prerequisites: Record<string, never>; selectionOrigins: SelectionOrigin[]
    effect: FightingStyleEffect; maySelectSameStyleTwice: false
} | {
    optionType: 'fighter-maneuver'; prerequisites: Record<string, never>; selectionOrigins: SelectionOrigin[]
    effect: ManeuverEffect; resourceCost: { pool: 'superiority-dice'; dice: 1 }
    maximumManeuversPerAttack: 1; saveDC: '8+proficiencyBonus+chosenStrengthOrDexterityModifier'
}
type TotemOptionMechanics = {
    optionType: 'totem-choice'; prerequisites: Record<string, never>; selectionOrigins: SelectionOrigin[]
    tier: 3 | 6 | 14; animal: 'bear' | 'eagle' | 'wolf'; effect: { [key: string]: Json }
}
type HunterOptionMechanics = {
    optionType:'hunter-choice'; prerequisites:Record<string,never>; selectionOrigins:SelectionOrigin[]
    tier:3|7|11|15; effect:{[key:string]:Json}
}
type MonkDisciplineMechanics = {
    optionType:'monk-discipline'; prerequisites:Record<string,never>; selectionOrigins:SelectionOrigin[]
    minimumMonkLevel:number; baseKiCost:number; effect:{[key:string]:Json}
}
type SpellcasterChoiceMechanics = {
    optionType:'wizard-choice' | 'metamagic' | 'sorcerer-choice'; prerequisites:Record<string,never>; selectionOrigins:SelectionOrigin[]; effect:{[key:string]:Json}
}
export type VerifiedOption = Omit<ReviewedEntity, 'mechanics'> & {
    kind: 'class-option'
    mechanics: WarlockOptionMechanics | FighterOptionMechanics | TotemOptionMechanics | HunterOptionMechanics | MonkDisciplineMechanics | SpellcasterChoiceMechanics
}
export type CandidateCreationData = CreationData & {
    edition: '2014'; candidateReleaseId: string; reviewedEntities: ReviewedEntity[]; verifiedOptions: VerifiedOption[]; verifiedCreatures:ReviewedCreature[]; verifiedEquipment:ReviewedEquipment[]; verifiedMagicItems:ReviewedMagicItem[]; verifiedCreationOptions:ReviewedEntity[]
    /** Legacy records remain available, but are not automatically certified by this adapter. */
    legacyVerification: 'preserved-not-fully-reverified'
}
export type ReviewedMagicItem=Omit<ReviewedEntity,'kind'|'mechanics'> & {kind:'magic-item';mechanics:MagicItemMechanics}

export function reviewedMagicItem(data:CandidateCreationData,id:string):ReviewedMagicItem {
    const e=data.verifiedMagicItems.find((e)=>e.id===id)
    if(data.edition!=='2014' || !e?.verification.complete || e.verification.mechanics!=='verified-fields')throw new Error('Oggetto magico non verificato.')
    return structuredClone(e)
}

/** Returns requirements to complete, never treats identification as attunement. */
export function magicItemAttunementPlan(data:CandidateCreationData,id:string,attunedCopies:{instanceId:string;referenceId:string;variantIndex?:string}[],instanceId:string,variantIndex?:string) {
    const item=reviewedMagicItem(data,id),rule=fighterFeature(data,'dmg2014:rule:attunement')
    const conditional=item.mechanics.effect.conditionalAttunement
    if(!item.mechanics.requiresAttunement && !object(conditional))throw new Error('Questo oggetto non richiede sintonia.')
    if(!instanceId.trim() || !Array.isArray(attunedCopies) || attunedCopies.some((e)=>typeof e.instanceId!=='string' || !e.instanceId.trim() || typeof e.referenceId!=='string')
        || new Set(attunedCopies.map((e)=>e.instanceId)).size!==attunedCopies.length)throw new Error('Copie sintonizzate non valide.')
    if(attunedCopies.length>=Number(rule.mechanics.maxItemsPerCreature))throw new Error('Limite di tre oggetti sintonizzati raggiunto.')
    if(attunedCopies.some((e)=>e.instanceId===instanceId || (e.referenceId===id && e.variantIndex===variantIndex)))throw new Error('Sintonia duplicata con una copia dello stesso oggetto.')
    const variants=item.mechanics.effect.variants
    if(Array.isArray(variants) && !variants.some((v)=>object(v) && v.index===variantIndex))throw new Error('Scegliere una variante verificata.')
    if(!Array.isArray(variants) && variantIndex!==undefined)throw new Error('Variante non prevista.')
    const variant=Array.isArray(variants)?variants.find((v)=>object(v) && v.index===variantIndex):undefined
    return {item,instanceId,variantIndex,requiredRest:'uninterrupted-short-rest-in-contact' as const,separateFromIdentification:true as const,
        prerequisites:structuredClone({...item.mechanics.attunementPrerequisites,...(object(variant) && variant.requiresAlignment?{alignment:variant.requiresAlignment}:{}),...(object(conditional)?{requiresWearing:conditional.requiresWearing,endsIf:conditional.endsIf}:{})}),
        conditionalProperty:object(conditional)?conditional.property:null,sources:[...item.sources,...rule.sources]}
}

/** Explicit wearing and attunement evidence; individual curses and triggers remain in the typed plan. */
export type MagicItemProperty='main'|'action'|'pressOnce'|'pressTwice'|'firstLightingAlternative'|'whileScryingAction'|'conditionalAttunement'|'castChoice'|'drainLife'|'paralyze'|'terrify'|'saveConversion'|'reflect'|'powerStrike'|'retributiveStrike'|'insectCloud'|'treeForm'|'lightning'|'thunder'|'lightningStrike'|'thunderclap'|'thunderAndLightning'|'reaction'|'assistedEscape'|'coneOfFear'|'spellAbsorption'|'haste'|'shockWave'|'conjureEarthElemental'|'travelDepths'|'commandEvil'|'darkSpeech'|'xray'|'control'|'detectMagic'|'callDragons'|'callUndead'
export function magicItemUsePlan(data:CandidateCreationData,id:string,context:{edition:'2014'|'2024';attuned:boolean;usageRequirementMet:boolean;commandWordAvailable?:boolean;variantIndex?:string;property?:MagicItemProperty;castChoiceIndex?:number;additionalPropertiesUnlocked?:boolean;inDimLightOrDarkness?:boolean;sentientPermission?:'allowed'|'suppressed'|'against-wielder';itemControlEstablished?:boolean;actorIsOrcusOrBlessedFollower?:boolean}) {
    const item=reviewedMagicItem(data,id),m=item.mechanics
    if(context.edition!=='2014' || context.usageRequirementMet!==true)throw new Error('Edizione o modo d’impiego non valido.')
    if(m.requiresAttunement && context.attuned!==true)throw new Error('Sintonia richiesta per le proprietà magiche.')
    if(m.effect.requiresCommandWord===true && context.commandWordAvailable!==true)throw new Error('Parola di comando non disponibile.')
    const variants=m.effect.variants
    const selectedVariant=Array.isArray(variants) ? variants.find((v)=>object(v) && v.index===context.variantIndex) : undefined
    if(Array.isArray(variants) && !selectedVariant)throw new Error('Scegliere una variante verificata.')
    if(!Array.isArray(variants) && context.variantIndex!==undefined)throw new Error('Variante non prevista.')
    const property=context.property ?? 'main'
    if(property==='conditionalAttunement' && context.attuned!==true)throw new Error('Sintonia richiesta per questa proprietà.')
    const castChoices=(object(selectedVariant) ? selectedVariant.castChoices : undefined) ?? m.effect.castChoices ?? m.effect.lightChoices
    if(property==='castChoice' && (!Array.isArray(castChoices) || !Number.isSafeInteger(context.castChoiceIndex) || context.castChoiceIndex!<0 || context.castChoiceIndex!>=castChoices.length))throw new Error('Scelta di lancio non valida.')
    const effect=property==='main' ? m.effect : property==='castChoice' ? (castChoices as Json[])[context.castChoiceIndex!] : object(selectedVariant) && object(selectedVariant[property]) ? selectedVariant[property] : m.effect[property]
    if(!object(effect))throw new Error('Proprietà dell’oggetto non disponibile.')
    if(object(m.effect.sentience) && property!=='main' && context.sentientPermission!=='allowed')throw new Error('La proprietà attivata è controllata dall’oggetto senziente tramite il DM.')
    if(property!=='control' && (m.effect.requiresControl===true || effect.requiresControl===true) && context.itemControlEstablished!==true)throw new Error('Controllo dell’artefatto non stabilito.')
    if(context.actorIsOrcusOrBlessedFollower!==undefined && typeof context.actorIsOrcusOrBlessedFollower!=='boolean')throw new Error('Qualifica di Orcus o seguace non valida.')
    if(effect.requiresHelpSlayWhileAttuned===true && context.additionalPropertiesUnlocked!==true)throw new Error('La proprietà richiede aver contribuito a uccidere l’elementale durante sintonia.')
    if(effect.requiresDimLightOrDarkness===true && context.inDimLightOrDarkness!==true)throw new Error('Questa proprietà richiede luce fioca o oscurità.')
    const spellId=effect.spellId ?? effect.successCastSpellId ?? effect.castSpellId ?? effect.asIfCastSpellId ?? effect.effectSpellId
    const spell=typeof spellId==='string' ? fighterFeature(data,spellId) : undefined
    const castingRule=spell ? fighterFeature(data,'dmg2014:rule:magic-item-spellcasting') : undefined
    return {item,selectedVariant:structuredClone(selectedVariant ?? null),spell:spell ? structuredClone(spell) : null,
        property,effect:structuredClone(effect),spendsPersonalSpellSlots:false as const,componentsRequired:property==='castChoice' && m.effect.castConsumes!==undefined,
        consumedMaterial:property==='castChoice' ? m.effect.castConsumes ?? null : null,
        concentrationRequired:effect.concentrationMaintainedBy==='item'?false:typeof effect.concentrationRequired==='boolean' ? effect.concentrationRequired : spell?.mechanics.concentration===true,
        concentrationOwner:spell?.mechanics.concentration===true ? effect.concentrationMaintainedBy==='item'?'item' as const:'user' as const:null,
        spellCaster:effect.caster==='item'?'item' as const:'user' as const,
        chargeCost:typeof effect.chargeCost==='number'?id==='dmg2014:magic-item:wand-of-orcus' && context.actorIsOrcusOrBlessedFollower===true?Math.max(0,effect.chargeCost-2):effect.chargeCost:null,
        castSpellLevel:spell ? typeof effect.castSpellLevel==='number' ? effect.castSpellLevel : Number(spell.mechanics.level) : null,
        castSaveDC:spell ? effect.castSaveDC ?? m.effect.castSaveDC ?? null : null,
        castingTime:spell ? typeof effect.activation==='string' && ['action','bonus-action','reaction'].includes(effect.activation) ? {quantity:1,unit:effect.activation} : m.activation==='action'?{quantity:1,unit:'action'}:structuredClone(spell.mechanics.casting) : null,
        spellUse:spell ? effect.effectSpellId ? 'gain-effect' as const : 'cast' as const : null,
        sources:[...item.sources,...(spell?.sources ?? []),...(castingRule?.sources ?? [])]}
}

/** The DM controls the item; this plan never takes control of the player's character by itself. */
export function sentientItemConflictPlan(data:CandidateCreationData,id:string,context:{edition:'2014'|'2024';dmApproved:boolean;controlAttemptUsed:boolean}) {
    const item=reviewedMagicItem(data,id),sentience=item.mechanics.effect.sentience,rule=fighterFeature(data,'dmg2014:rule:sentient-magic-items')
    if(context.edition!=='2014' || context.dmApproved!==true || typeof context.controlAttemptUsed!=='boolean' || !object(sentience)
        || !Number.isSafeInteger(sentience.charisma) || Number(sentience.charisma)<1 || Number(sentience.charisma)>30)throw new Error('Conflitto senziente o Carisma non verificati.')
    return {itemId:id,contestAbility:'charisma' as const,controlSaveAbility:'charisma' as const,controlSaveDC:12+Math.floor((Number(sentience.charisma)-10)/2),
        controlAttemptAllowed:!context.controlAttemptUsed,recovery:'dawn' as const,failedControlDurationHours:'1d12',repeatSave:'after-damage' as const,
        successEndsControl:true,attemptConsumedOnEitherSaveResult:true,commandsChosenBy:'DM' as const,sources:[...item.sources,...rule.sources]}
}

/** A reviewed row can be used without certifying an unresolved row elsewhere in the table. */
export function magicItemPropertyTableEntry(data:CandidateCreationData,index:'magic-item-minor-properties'|'magic-item-quirks'|'magic-item-creators'|'magic-item-history'|'artifact-minor-beneficial'|'artifact-major-beneficial'|'artifact-minor-detrimental'|'artifact-major-detrimental',roll:number,context:{edition:'2014'|'2024';dmApproved:boolean}) {
    const rule=data.reviewedEntities.find((e)=>e.id==='dmg2014:rule:'+index)
    if(data.edition!=='2014' || context.edition!=='2014' || context.dmApproved!==true || rule?.kind!=='rule' || rule.verification.mechanics!=='verified-fields'
        || !['magic-item-property-table','artifact-property-table'].includes(String(rule.mechanics.ruleType)) || !Number.isSafeInteger(roll))throw new Error('Tabella o risultato non autorizzati.')
    const die=/^d(\d+)$/.exec(String(rule.mechanics.die))
    if(!die || roll<1 || roll>Number(die[1]) || !Array.isArray(rule.mechanics.rows))throw new Error('Risultato fuori dal dado della tabella.')
    const row=rule.mechanics.rows.find((r)=>object(r) && roll>=Number(r.minimum) && roll<=Number(r.maximum))
    if(!object(row) || !object(row.effect) || row.effect.openInterpretation)throw new Error('Effetto della riga ancora incompleto.')
    return {entry:structuredClone(row),sources:structuredClone(rule.sources),wholeRuleComplete:rule.verification.complete}
}

/** Probability selection is separate from permission to grant a fully reviewed item. */
export function treasureTableEntry(data:CandidateCreationData,id:string,roll:number,context:{edition:'2014'|'2024';dmApproved:boolean;furtherRolls?:number[]}) {
    const rule=data.reviewedEntities.find((e)=>e.id===id),further=context.furtherRolls ?? []
    if(data.edition!=='2014' || context.edition!=='2014' || context.dmApproved!==true || rule?.kind!=='rule'
        || rule.verification.mechanics!=='verified-fields' || rule.mechanics.ruleType!=='treasure-table'
        || !Array.isArray(further) || further.some((r)=>!Number.isSafeInteger(r)))throw new Error('Tabella dei tesori non verificata o non autorizzata.')
    const m=rule.mechanics as unknown as TreasureTableMechanics
    const select=(die:number,rows:TreasureTableMechanics['rows'],value:number)=>{
        if(!Number.isSafeInteger(die) || die<1 || !Number.isSafeInteger(value) || value<1 || value>die || !Array.isArray(rows))throw new Error('Tiro fuori dalla tabella.')
        const row=rows.find((r)=>value>=r.low && value<=r.high)
        if(!row || !object(row.effect))throw new Error('Riga del tesoro mancante.')
        return structuredClone(row)
    }
    const entry=select(m.die,m.rows,roll)
    let effect=entry.effect,cursor=0
    while(object(effect.furtherRoll)) {
        const nested=effect.furtherRoll
        if(cursor>=further.length || !Array.isArray(nested.rows))throw new Error('Manca il tiro della sottotabella.')
        effect=select(Number(nested.die),nested.rows as unknown as TreasureTableMechanics['rows'],further[cursor++]).effect
    }
    if(cursor!==further.length)throw new Error('Tiri aggiuntivi non previsti dalla riga.')
    const dep=Array.isArray(effect.dependencyIds)?effect.dependencyIds:[]
    if(dep.some((id)=>typeof id!=='string'))throw new Error('Dipendenze del tesoro non valide.')
    const pendingDependencyIds=dep.filter((id)=>!data.reviewedEntities.some((e)=>e.id===id && e.verification.complete && e.verification.mechanics==='verified-fields')) as string[]
    return {entry,effect,treasureType:m.treasureType,pendingDependencyIds,wholeRuleComplete:rule.verification.complete,
        itemGrantAllowed:m.treasureType==='magic-item' && typeof effect.itemId==='string' && pendingDependencyIds.length===0 && !effect.variantChoices,
        sources:structuredClone(rule.sources)}
}

/** Caller supplies dice sums before multiplication; no randomness or database writes. */
export function treasureCoinPlan(data:CandidateCreationData,id:string,roll:number,context:{edition:'2014'|'2024';dmApproved:boolean;mode:'average'|'rolled';diceSums?:Partial<Record<CoinDenomination,number>>}) {
    const selected=treasureTableEntry(data,id,roll,context),rule=data.reviewedEntities.find((e)=>e.id===id)!
    if(!['individual','hoard'].includes(selected.treasureType) || !['average','rolled'].includes(context.mode))throw new Error('Tabella o modalità delle monete non valida.')
    const formulas=(selected.treasureType==='hoard'?rule.mechanics.coins:selected.effect.coins) as unknown as Partial<Record<CoinDenomination,TreasureCoinFormula>>
    const sums=context.diceSums ?? {}
    if(!object(formulas) || !object(sums) || (context.mode==='average' && Object.keys(sums).length)
        || Object.keys(sums).some((k)=>!(k in formulas)))throw new Error('Tiri di monete inattesi.')
    const coins:Partial<Record<CoinDenomination,number>>={}
    for(const [denomination,f] of Object.entries(formulas)) {
        if(!['cp','sp','ep','gp','pp'].includes(denomination) || !object(f))throw new Error('Formula di monete non verificata.')
        const dice=/^(\d+)d(\d+)$/.exec(String(f.dice)),multiplier=Number(f.multiplier)
        if(!dice || !Number.isSafeInteger(multiplier) || multiplier<1)throw new Error('Dadi delle monete non validi.')
        const count=Number(dice[1]),sides=Number(dice[2]),sum=sums[denomination as CoinDenomination]
        if(count<1 || sides<2 || !Number.isSafeInteger(count*sides*multiplier))throw new Error('Formula di monete fuori limite.')
        if(context.mode==='rolled' && (!Number.isSafeInteger(sum) || Number(sum)<count || Number(sum)>count*sides))throw new Error('Somma dei dadi fuori limite.')
        const value=context.mode==='average'?Math.floor(count*(sides+1)*multiplier/2):Number(sum)*multiplier
        if(context.mode==='average' && value!==f.average)throw new Error('Media delle monete incoerente.')
        coins[denomination as CoinDenomination]=value
    }
    return {coins,mode:context.mode,weightLb:Object.values(coins).reduce((a,b)=>a+b,0)/50,
        valuables:selected.effect.valuables ?? null,magicItemRolls:selected.effect.magicItemRolls ?? [],sources:selected.sources}
}

/** DM supplies forms/statistics; upcasting multiplies count, never the chosen CR ceiling. */
export function groupConjurationPlan(data:CandidateCreationData,spellId:string,context:{edition:'2014'|'2024';dmApproved:boolean;slotLevel:number;optionIndex:number;creatureIds:string[]}) {
    if(!['phb2014:spell:conjure-minor-elementals','phb2014:spell:conjure-woodland-beings','phb2014:spell:conjure-animals'].includes(spellId))throw new Error('Magia senza opzioni di gruppo verificate.')
    const spell=fighterFeature(data,spellId),effect=spell.mechanics.effect,upcast=spell.mechanics.upcast
    if(context.edition!=='2014' || context.dmApproved!==true || !Number.isSafeInteger(context.slotLevel) || context.slotLevel<Number(spell.mechanics.level) || context.slotLevel>9
        || !Number.isSafeInteger(context.optionIndex) || context.optionIndex<0 || !object(effect) || !object(upcast)
        || !Array.isArray(effect.summonOptions) || !Array.isArray(upcast.rows) || !Array.isArray(context.creatureIds))throw new Error('Evocazione di gruppo non valida.')
    const option=effect.summonOptions[context.optionIndex],tier=[...upcast.rows].reverse().find((r)=>object(r) && context.slotLevel>=Number(r.minimumSlot))
    if(!object(option) || !object(tier))throw new Error('Opzione o slot di evocazione non verificati.')
    const count=Number(option.count)*Number(tier.multiplier),maximumCR=Number(option.maximumCR)
    if(!Number.isSafeInteger(count) || count<1 || context.creatureIds.length!==count || !Number.isFinite(maximumCR))throw new Error('Numero di creature diverso dalla fascia scelta.')
    const type=spell.index==='conjure-animals'?'beast':effect.summonType
    const creatures=context.creatureIds.map((id)=>{
        if(typeof id!=='string')throw new Error('Identificatore di creatura non valido.')
        const creature=reviewedCreature(data,id)
        if(creature.mechanics.type!==type || creature.mechanics.isSwarm || creature.mechanics.challengeRating>maximumCR)throw new Error('Forma o GS non consentiti dall’evocazione.')
        if(spell.index==='conjure-animals')creature.mechanics.additionalCreatureTypes=['fey']
        return creature
    })
    return {spellId:spell.id,count,maximumCR,creatures,effect:structuredClone(effect),appliedOptionalVariants:[],
        requiresOrdinarySpellValidation:true,concentrationRequired:true,sources:structuredClone(spell.sources)}
}

export function minorElementalConjurationPlan(data:CandidateCreationData,context:Parameters<typeof groupConjurationPlan>[2]) {
    return groupConjurationPlan(data,'phb2014:spell:conjure-minor-elementals',context)
}

export function woodlandConjurationPlan(data:CandidateCreationData,context:Parameters<typeof groupConjurationPlan>[2]) {
    return groupConjurationPlan(data,'phb2014:spell:conjure-woodland-beings',context)
}

export function animalConjurationPlan(data:CandidateCreationData,context:Parameters<typeof groupConjurationPlan>[2]) {
    return groupConjurationPlan(data,'phb2014:spell:conjure-animals',context)
}

export function celestialConjurationPlan(data:CandidateCreationData,context:{edition:'2014'|'2024';dmApproved:boolean;slotLevel:number;creatureId:string}) {
    const spell=fighterFeature(data,'phb2014:spell:conjure-celestial'),effect=spell.mechanics.effect,upcast=spell.mechanics.upcast
    if(context.edition!=='2014' || context.dmApproved!==true || !Number.isSafeInteger(context.slotLevel) || context.slotLevel<7 || context.slotLevel>9
        || !object(effect) || !object(upcast) || !Array.isArray(upcast.rows) || typeof context.creatureId!=='string')throw new Error('Evocazione celestiale non valida.')
    const tier=[...upcast.rows].reverse().find((r)=>object(r) && context.slotLevel>=Number(r.minimumSlot))
    if(!object(tier) || !Number.isFinite(tier.maximumCR))throw new Error('Fascia celestiale non verificata.')
    const creature=reviewedCreature(data,context.creatureId)
    if(creature.mechanics.type!=='celestial' || creature.mechanics.challengeRating>Number(tier.maximumCR))throw new Error('Tipo o GS non consentiti dall’evocazione celestiale.')
    return {spellId:spell.id,count:1,maximumCR:Number(tier.maximumCR),creature,effect:structuredClone(effect),
        requiresOrdinarySpellValidation:true,concentrationRequired:true,sources:structuredClone(spell.sources)}
}

/** PHB PDF 226–227: the DM confirms elemental-area suitability; loss of concentration preserves the summon. */
export function singleConjurationPlan(data:CandidateCreationData,spellId:'phb2014:spell:conjure-elemental'|'phb2014:spell:conjure-fey',context:{edition:'2014'|'2024';dmApproved:boolean;slotLevel:number;creatureId:string;elementalAreaAppropriate?:boolean}) {
    if(!['phb2014:spell:conjure-elemental','phb2014:spell:conjure-fey'].includes(spellId))throw new Error('Magia di evocazione non supportata.')
    const spell=fighterFeature(data,spellId),effect=spell.mechanics.effect,upcast=spell.mechanics.upcast
    if(data.edition!=='2014' || context.edition!=='2014' || context.dmApproved!==true || !Number.isSafeInteger(context.slotLevel)
        || context.slotLevel<Number(spell.mechanics.level) || context.slotLevel>9 || !object(effect) || !object(upcast)
        || typeof context.creatureId!=='string')throw new Error('Evocazione singola non valida.')
    const maximumCR=Number(effect.maximumCR)+(context.slotLevel-Number(upcast.base))*Number(upcast.additionalMaximumCR)
    const creature=reviewedCreature(data,context.creatureId),formType=creature.mechanics.type,elemental=spell.index==='conjure-elemental'
    if(!Number.isFinite(maximumCR) || creature.mechanics.isSwarm || creature.mechanics.challengeRating>maximumCR
        || (elemental ? formType!=='elemental' || context.elementalAreaAppropriate!==true : !['fey','beast'].includes(formType)))throw new Error('Tipo, GS o area elementale non consentiti.')
    // PHB calls the beast-shaped spirit a fey creature, unlike Conjure Animals' explicit dual typing.
    if(!elemental && formType==='beast')creature.mechanics.type='fey'
    return {spellId:spell.id,count:1,maximumCR,creature,sourceFormType:formType,form:!elemental && formType==='beast'?'fey-spirit-in-beast-form':'native-creature',
        effect:structuredClone(effect),requiresOrdinarySpellValidation:true,concentrationRequired:true,
        appliedOptionalVariants:[],sources:structuredClone(spell.sources)}
}

/** Known shared slots may be spent; the unspecified recovery authority is never invented. */
export function hagCovenSpellPlan(data:CandidateCreationData,context:{edition:'2014'|'2024';dmApproved:boolean;members:{instanceId:string;creatureId:string}[];mutualDistancesFt:number[];casterIndex:number;spellId:string;slotLevel:number;sharedSlots:number[]}) {
    const rule=data.reviewedEntities.find((e)=>e.id==='mm2014:rule:hag-covens'),shared=rule?.mechanics.sharedSpellcasting
    if(data.edition!=='2014' || context.edition!=='2014' || context.dmApproved!==true || rule?.verification.mechanics!=='verified-fields'
        || !object(shared) || !Array.isArray(context.members) || context.members.length!==3
        || context.members.some((m)=>!m || typeof m.instanceId!=='string' || !m.instanceId.trim() || typeof m.creatureId!=='string')
        || new Set(context.members.map((m)=>m.instanceId)).size!==3 || !Array.isArray(context.mutualDistancesFt) || context.mutualDistancesFt.length!==3
        || context.mutualDistancesFt.some((d)=>!Number.isFinite(d) || d<0 || d>30)
        || !Number.isSafeInteger(context.casterIndex) || context.casterIndex<0 || context.casterIndex>2)throw new Error('Congrega, membri o distanze non validi.')
    const members=context.members.map((m)=>{
        const e=data.reviewedEntities.find((e)=>e.id===m.creatureId)
        if(!['mm2014:creature:green-hag','mm2014:creature:night-hag','mm2014:creature:sea-hag'].includes(m.creatureId)
            || e?.verification.mechanics!=='verified-fields' || !object(e.mechanics.abilities))throw new Error('Membro della congrega non verificato.')
        return e
    })
    const intelligence=Number((members[context.casterIndex].mechanics.abilities as Record<string,Json>).intelligence)
    if(!Number.isSafeInteger(intelligence) || intelligence<1 || intelligence>30 || !Array.isArray(shared.sharedSlots) || !Array.isArray(shared.spellLevels)
        || !Array.isArray(context.sharedSlots) || context.sharedSlots.length!==9
        || context.sharedSlots.some((n,i)=>!Number.isSafeInteger(n) || n<0 || n>Number((shared.sharedSlots as Json[])[i])))throw new Error('Caratteristica o slot condivisi non validi.')
    const spell=fighterFeature(data,context.spellId),level=Number(spell.mechanics.level)
    const included=shared.spellLevels.some((r)=>object(r) && Array.isArray(r.spellIds) && r.spellIds.includes(context.spellId))
    if(spell.kind!=='spell' || !included || !Number.isSafeInteger(context.slotLevel) || context.slotLevel<level || context.slotLevel>6
        || context.sharedSlots[context.slotLevel-1]<1)throw new Error('Magia o slot non disponibili alla congrega.')
    const after=[...context.sharedSlots];after[context.slotLevel-1]--
    const modifier=Math.floor((intelligence-10)/2)
    return {spell:structuredClone(spell),casterInstanceId:context.members[context.casterIndex].instanceId,casterLevel:12,castingAbility:'intelligence' as const,
        saveDC:12+modifier,attackBonus:4+modifier,castLevel:context.slotLevel,sharedSlotsAfter:after,spendsPersonalSlots:false,
        slotRecoveryRequiresDMAdjudication:true,wholeRuleComplete:rule.verification.complete,requiresOrdinarySpellValidation:true,
        componentsRequired:spell.mechanics.components,concentrationRequired:spell.mechanics.concentration===true,sources:[...rule.sources,...spell.sources,...members[context.casterIndex].sources]}
}

/** Call on completed casting: storing spends the incoming spell even when capacity is insufficient. */
export function storedSpellOperation(data:CandidateCreationData,id:string,stored:StoredSpell[],operation:{kind:'store';spell:StoredSpell}|{kind:'cast';index:number},context:{edition:'2014'|'2024';attuned:boolean;usageRequirementMet:boolean}) {
    if(!['dmg2014:magic-item:ioun-stone','dmg2014:magic-item:ring-of-spell-storing'].includes(id))throw new Error('Oggetto senza accumulo verificato.')
    const use=magicItemUsePlan(data,id,{...context,...(id.endsWith('ioun-stone')?{variantIndex:'reserve'}:{})})
    const effect=(use.selectedVariant ?? use.effect) as Record<string,Json>,maximum=Number(effect.spellLevelCapacity)
    const check=(entry:StoredSpell)=>{
        if(!entry || !Number.isSafeInteger(entry.slotLevel) || entry.slotLevel<1 || entry.slotLevel>maximum || !Number.isSafeInteger(entry.saveDC) || entry.saveDC<0
            || !Number.isSafeInteger(entry.attackBonus) || !['strength','dexterity','constitution','intelligence','wisdom','charisma'].includes(entry.castingAbility))throw new Error('Parametri originali della magia non validi.')
        const spell=fighterFeature(data,entry.spellId),level=Number(spell.mechanics.level)
        if(spell.kind!=='spell' || level<1 || level>entry.slotLevel)throw new Error('Magia incompatibile con il livello accumulato.')
        return spell
    }
    if(!Array.isArray(stored) || !Number.isSafeInteger(maximum) || maximum<1)throw new Error('Accumulo non valido.')
    stored.forEach(check)
    const used=stored.reduce((n,s)=>n+s.slotLevel,0)
    if(used>maximum)throw new Error('Capacità accumulata superata.')
    if(operation.kind==='store') {
        check(operation.spell)
        const fits=used+operation.spell.slotLevel<=maximum
        return {stored:structuredClone(fits?[...stored,operation.spell]:stored),storedSuccessfully:fits,incomingSpellExpended:true,casting:null,maximum,sources:use.sources}
    }
    if(operation.kind!=='cast' || !Number.isSafeInteger(operation.index) || operation.index<0 || operation.index>=stored.length)throw new Error('Magia accumulata non selezionata.')
    const entry=stored[operation.index],spell=check(entry)
    return {stored:structuredClone(stored.filter((_,i)=>i!==operation.index)),storedSuccessfully:false,incomingSpellExpended:false,
        casting:{...structuredClone(entry),spell:structuredClone(spell),spendsPersonalSpellSlots:false,concentrationRequired:spell.mechanics.concentration===true},maximum,sources:[...use.sources,...spell.sources]}
}

/** Absorption stores energy, never the absorbed spell. Validate ordinary casting separately. */
export function absorptionRodOperation(data:CandidateCreationData,state:{lifetimeAbsorbed:number;storedLevels:number},operation:{kind:'absorb';spellLevel:number;targetsOnlyUser:boolean;areaOfEffect:boolean}|{kind:'cast';slotLevel:number;ownSlotLevels:number[];spellId:string;knownOrPrepared:boolean},context:{edition:'2014'|'2024';attuned:boolean;usageRequirementMet:boolean}) {
    const use=magicItemUsePlan(data,'dmg2014:magic-item:rod-of-absorption',context)
    if(!state || !Number.isSafeInteger(state.lifetimeAbsorbed) || state.lifetimeAbsorbed<0 || state.lifetimeAbsorbed>50 || !Number.isSafeInteger(state.storedLevels) || state.storedLevels<0 || state.storedLevels>state.lifetimeAbsorbed)throw new Error('Energia o assorbimento cumulativo non validi.')
    let next={...state},spell:ReviewedEntity|null=null,absorbed=false
    if(operation.kind==='absorb') {
        if(!Number.isSafeInteger(operation.spellLevel) || operation.spellLevel<0 || operation.spellLevel>9 || typeof operation.targetsOnlyUser!=='boolean' || typeof operation.areaOfEffect!=='boolean')throw new Error('Magia bersaglio non valida.')
        absorbed=operation.targetsOnlyUser && !operation.areaOfEffect && state.lifetimeAbsorbed<50 && state.lifetimeAbsorbed+operation.spellLevel<=50
        if(absorbed)next={lifetimeAbsorbed:state.lifetimeAbsorbed+operation.spellLevel,storedLevels:state.storedLevels+operation.spellLevel}
    }else if(operation.kind==='cast') {
        spell=fighterFeature(data,operation.spellId)
        if(spell.kind!=='spell' || !Number.isSafeInteger(operation.slotLevel) || operation.slotLevel<1 || operation.slotLevel>5 || operation.slotLevel<Number(spell.mechanics.level) || Number(spell.mechanics.level)<1
            || !Array.isArray(operation.ownSlotLevels) || !operation.ownSlotLevels.length || operation.ownSlotLevels.some((n)=>!Number.isSafeInteger(n) || n<1 || n>9)
            || operation.slotLevel>Math.max(...operation.ownSlotLevels) || operation.knownOrPrepared!==true || state.storedLevels<operation.slotLevel)throw new Error('Lancio con energia non autorizzato.')
        next.storedLevels-=operation.slotLevel
    }else throw new Error('Operazione della verga non valida.')
    return {state:next,absorbed,spell,spellEffectCancelled:absorbed,nonmagical:next.lifetimeAbsorbed===50 && next.storedLevels===0,
        spendsPersonalSpellSlots:false,requiresOrdinaryCastingValidation:operation.kind==='cast',sources:[...use.sources,...(spell?.sources ?? [])]}
}

/** Reading and copying are separate: a failed copy destroys the scroll; interrupted casting preserves it. */
export function spellScrollPlan(data:CandidateCreationData,spellId:string,context:{edition:'2014'|'2024';classLevels:Record<string,number>;classIndex:string;subclassIds?:string[];mode:'cast'|'copy'}) {
    const scroll=reviewedMagicItem(data,'dmg2014:magic-item:spell-scroll'),spell=fighterFeature(data,spellId),level=Number(spell.mechanics.level)
    const pools=multiclassSpellPools(data,context.classLevels,context.subclassIds),cls=context.classIndex,classList=['fighter','rogue'].includes(cls)?'wizard':cls
    if(context.edition!=='2014' || spell.kind!=='spell' || !Number.isSafeInteger(level) || level<0 || level>9 || (context.classLevels[cls] ?? 0)<1 || !['cast','copy'].includes(context.mode))throw new Error('Lettura della pergamena non valida.')
    if(!(spell.mechanics.classes as string[]).includes(classList) || (cls!=='warlock' && !(cls in pools.ownClassMaximumSpellLevel)))throw new Error('Pergamena fuori dalla lista della propria classe.')
    if(context.mode==='copy' && (cls!=='wizard' || level===0 || level>(pools.ownClassMaximumSpellLevel.wizard ?? 0)))throw new Error('Magia non copiabile nel libro a questo livello di mago.')
    const warlockLevel=context.classLevels.warlock ?? 0
    const maximum=cls==='warlock'?warlockLevel>=11?6+Math.floor((Math.min(17,warlockLevel)-11)/2):pools.pactSlots?.level ?? 0:pools.ownClassMaximumSpellLevel[cls] ?? 0
    const rows=scroll.mechanics.effect.variants as Record<string,Json>[],row=rows.find((r)=>r.spellLevel===level)
    if(!row)throw new Error('Livello di pergamena non verificato.')
    return {spell:structuredClone(spell),parameters:structuredClone(row),check:context.mode==='copy'?{ability:'intelligence',skill:'arcana',dc:10+level}:level>maximum?{ability:data.reviewedEntities.find((e)=>e.id==='phb2014:class:'+cls)?.mechanics.castingAbility ?? 'intelligence',dc:10+level}:null,
        castingTime:context.mode==='cast'?structuredClone(spell.mechanics.casting):null,spendsPersonalSpellSlots:false,requiresMaterialComponents:false,
        concentrationRequired:context.mode==='cast' && spell.mechanics.concentration===true,
        destruction:context.mode==='copy'?'either-check-result':'completed-cast-or-failed-level-check',interruptedCastingPreservesScroll:true,
        sources:[...scroll.sources,...spell.sources,...fighterFeature(data,'dmg2014:rule:magic-item-spellcasting').sources]}
}

/** Duration pools use integer seconds, so separate activations can consume fractions of a minute. */
export function magicItemResource(data:CandidateCreationData,id:string,used:number,event?:'dawn'|'dusk'|'short-rest'|'long-rest'|'unused-twelve-hours',property:Exclude<MagicItemProperty,'castChoice'>='main',recoveryRoll?:number) {
    const item=reviewedMagicItem(data,id)
    const effect=property==='main' ? item.mechanics.effect : item.mechanics.effect[property]
    if(!object(effect))throw new Error('Proprietà dell’oggetto non disponibile.')
    const maximum=typeof effect.durationPoolMinutes==='number' ? effect.durationPoolMinutes*60 : effect.uses
    if(typeof maximum!=='number' || !Number.isSafeInteger(maximum) || maximum<0 || !Number.isSafeInteger(used) || used<0 || used>maximum)throw new Error('Risorsa dell’oggetto non valida.')
    if(typeof effect.durationAccountingMinutes==='number' && used%(effect.durationAccountingMinutes*60)!==0)throw new Error('La durata deve essere contabilizzata negli incrementi prescritti.')
    const recovery=effect.recovery
    const events=['dawn','dusk','short-rest','long-rest','unused-twelve-hours']
    if(typeof recovery!=='string' || ![...events,'none'].includes(recovery))throw new Error('Recupero dell’oggetto non verificato.')
    if(event!==undefined && !events.includes(event))throw new Error('Evento di recupero non valido.')
    const dice=typeof effect.recoveryDice==='string' ? /^([1-9]\d*)d([1-9]\d*)$/.exec(effect.recoveryDice) : null
    if(effect.recoveryDice!==undefined && !dice)throw new Error('Dado di recupero non verificato.')
    if(recoveryRoll!==undefined && (!dice || !Number.isSafeInteger(recoveryRoll) || recoveryRoll<Number(dice[1]) || recoveryRoll>Number(dice[1])*Number(dice[2])))throw new Error('Tiro di recupero non valido.')
    if(recovery===event && dice && recoveryRoll===undefined)throw new Error('Serve il tiro di recupero effettivo.')
    const restored=dice ? (recoveryRoll ?? 0)+Number(effect.recoveryBonus ?? 0) : typeof effect.recoveryAmountMinutes==='number' ? effect.recoveryAmountMinutes*60 : typeof effect.recoveryAmountUses==='number' ? effect.recoveryAmountUses : maximum
    return {maximum,used:recovery===event?Math.max(0,used-restored):used,unit:typeof effect.durationPoolMinutes==='number'?'seconds' as const:'uses' as const,recovery,sources:item.sources}
}

/** One invocation accounts for one flight/activation; the caller records when that activation ends. */
export function spendMagicItemDuration(data:CandidateCreationData,id:string,used:number,elapsedSeconds:number) {
    const item=reviewedMagicItem(data,id),resource=magicItemResource(data,id,used),effect=item.mechanics.effect
    if(resource.unit!=='seconds' || !Number.isSafeInteger(elapsedSeconds) || elapsedSeconds<1)throw new Error('Durata dell’attivazione non valida.')
    const minimum=typeof effect.minimumActivationSeconds==='number'?effect.minimumActivationSeconds:0
    const increment=typeof effect.durationAccountingMinutes==='number'?effect.durationAccountingMinutes*60:1
    const cost=Math.ceil(Math.max(minimum,elapsedSeconds)/increment)*increment
    if(used+cost>resource.maximum)throw new Error('Durata residua insufficiente.')
    return {...resource,used:used+cost,spentSeconds:cost}
}

export function legendaryCreatureActionPlan(data:CandidateCreationData,id:string,index:number,context:{edition:'2014'|'2024';mode:'legendary'|'lair';used:number;incapacitated:boolean;canTakeActions:boolean;surprised:boolean;hasHadFirstTurn:boolean;assumedForm:boolean;atEndOfAnotherCreatureTurn:boolean;inLair:boolean;initiativeCount?:number;previousLairActionIndex?:number}) {
    const creature=reviewedCreature(data,id),rule=fighterFeature(data,'mm2014:rule:legendary-creatures'),m=creature.mechanics
    if(context.edition!=='2014' || !['legendary','lair'].includes(context.mode) || !Number.isSafeInteger(index) || index<0 || !Number.isSafeInteger(context.used) || context.used<0
        || [context.incapacitated,context.canTakeActions,context.surprised,context.hasHadFirstTurn,context.assumedForm,context.atEndOfAnotherCreatureTurn,context.inLair].some((v)=>typeof v!=='boolean'))throw new Error('Contesto di azione leggendaria non valido.')
    if(context.incapacitated || !context.canTakeActions || context.surprised && !context.hasHadFirstTurn || context.assumedForm)throw new Error('Azioni leggendarie o della tana non disponibili in questo stato.')
    if(context.mode==='legendary') {
        const economy=m.legendaryActionEconomy,option=m.legendaryActions[index]
        if(!economy || !option || !context.atEndOfAnotherCreatureTurn || context.used>economy.maximum)throw new Error('Momento o opzione leggendaria non validi.')
        const cost=Number(option.effect.legendaryActionCost ?? 1)
        if(!Number.isSafeInteger(cost) || cost<1 || context.used+cost>economy.maximum)throw new Error('Azioni leggendarie residue insufficienti.')
        return {option:structuredClone(option),used:context.used+cost,recovery:economy.recovery,sources:[...creature.sources,...rule.sources]}
    }
    const lair=m.lair,option=lair?.actions[index]
    if(!lair || !option || !context.inLair || context.initiativeCount!==20 || context.used!==0 || context.previousLairActionIndex!==undefined && (!Number.isSafeInteger(context.previousLairActionIndex) || context.previousLairActionIndex<0 || context.previousLairActionIndex>=lair.actions.length)
        || lair.cannotRepeatConsecutiveRounds && context.previousLairActionIndex===index)throw new Error('Azione della tana, momento o ripetizione non validi.')
    return {option:structuredClone(option),used:1,recovery:'next-round-initiative-twenty',sources:[...creature.sources,...rule.sources]}
}
export type ReviewedEquipment=Omit<ReviewedEntity,'kind'|'mechanics'> & {
    kind:'weapon'|'armor'|'tool'|'gear'|'equipment-pack'
    mechanics:Record<string,Json> & {cost:{quantity:number;unit:'cp'|'sp'|'ep'|'gp'|'pp'};purchaseQuantity?:number;
        weightLb?:number|null;weight?:{value:number|null;unit:'lb'};contents?:{entityId:string;quantity:number}[];
        additionalContents?:{name:string;quantity:number;unit?:string;toolIndex?:string}[]}
}
type Manifest = { schemaVersion: number; releaseId: string; runtimeActivated: boolean; status: string; editionPolicy: string; files: Record<string, string> }
type Fetcher = (url: string) => Promise<Pick<Response, 'ok' | 'text'>>
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const list = (value: unknown): value is Record<string, unknown>[] => Array.isArray(value) && value.every(object)
const stableJson = (value: unknown) => JSON.stringify(value, (_, v: unknown) => object(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v)
function classLevels(levels: Record<string, number>): number {
    const values = Object.values(levels)
    if (values.some((x) => !Number.isInteger(x) || x < 0 || x > 20) || values.reduce((sum, x) => sum + x, 0) > 20) throw new Error('Livelli di classe non validi.')
    return values.reduce((sum, x) => sum + x, 0)
}

/** Verify the exact bytes consumed by the adapter against the immutable release manifest. */
export async function loadCandidateCreationData(baseUrl: string, fetcher: Fetcher = fetch): Promise<CandidateCreationData> {
    if (!baseUrl.trim()) throw new Error('Specificare la directory della release candidata.')
    const base = baseUrl.replace(/\/$/, '')
    const getText = async (file: string) => {
        const response = await fetcher(`${base}/${file}`)
        if (!response.ok) throw new Error(`Impossibile caricare ${file}.`)
        return response.text()
    }
    const manifest: unknown = JSON.parse(await getText('RELEASE.json'))
    if (!object(manifest) || manifest.schemaVersion !== 1 || typeof manifest.releaseId !== 'string'
        || manifest.runtimeActivated !== false || manifest.status !== 'partial-candidate-not-active'
        || manifest.editionPolicy !== '2014-reference-with-separate-unverified-legacy-content' || !object(manifest.files)) throw new Error('Manifesto candidato non valido.')
    const release = manifest as Manifest
    const read = async (file: string): Promise<unknown> => {
        const text = await getText(file)
        const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map((n) => n.toString(16).padStart(2, '0')).join('')
        if (release.files[file] !== hash) throw new Error(`Impronta non valida: ${file}.`)
        return JSON.parse(text)
    }
    const [options, equipment, rules, wizard, choices, reference] = await Promise.all([
        'data/character-options.json', 'data/character-equipment.json', 'data/character-rules.json',
        'data/wizard-catalog.json', 'data/verified-options-2014.json', 'verified-reference.json',
    ].map(read))
    if (![options, equipment, rules, wizard, choices, reference].every(object)) throw new Error('Cataloghi candidati non validi.')
    const catalogs = [options, equipment, rules, wizard, choices, reference] as Record<string, unknown>[]
    const [o, e, r, w, c, ref] = catalogs
    for (const key of ['classes', 'subclasses', 'races', 'subraces', 'backgrounds', 'alignments', 'languages', 'traits', 'features', 'levels', 'spells']) {
        if (!list(o[key])) throw new Error(`Collezione non valida: ${key}.`)
    }
    if (!list(w.subclasses) || !list(e.equipment) || !list(e.equipmentCategories) || !list(r.skills)
        || c.edition !== '2014' || !list(c.options) || ref.edition !== '2014' || !list(ref.entities)) throw new Error('Edizione o collezioni non valide.')
    const entities = ref.entities as unknown as ReviewedEntity[]
    if (entities.some((x) => x.edition !== '2014') || new Set(entities.map((x) => x.id)).size !== entities.length) throw new Error('Entità di riferimento non valide.')
    const equipmentFile='data/verified-equipment-2014.json'
    const equipmentCatalog=release.files[equipmentFile] ? await read(equipmentFile) : {edition:'2014',equipment:[]}
    if (!object(equipmentCatalog) || equipmentCatalog.edition!=='2014' || !list(equipmentCatalog.equipment))throw new Error('Catalogo equipaggiamento non valido.')
    const verifiedEquipment=equipmentCatalog.equipment as unknown as ReviewedEquipment[]
    if (new Set(verifiedEquipment.map((e)=>e.id)).size!==verifiedEquipment.length)throw new Error('Equipaggiamento duplicato.')
    for (const e of verifiedEquipment) {
        const m=e.mechanics
        if (e.edition!=='2014' || !['weapon','armor','tool','gear','equipment-pack'].includes(e.kind)
            || !object(e.verification) || !e.verification.complete || e.verification.mechanics!=='verified-fields'
            || !object(m) || !object(m.cost) || !Number.isFinite(m.cost.quantity) || m.cost.quantity<0
            || !['cp','sp','ep','gp','pp'].includes(m.cost.unit)
            || !entities.some((r)=>r.id===e.id && stableJson(r)===stableJson(e)))throw new Error('Equipaggiamento non verificato.')
    }
    const creatureFile='data/verified-creatures-2014.json'
    const creatureCatalog=release.files[creatureFile] ? await read(creatureFile) : {edition:'2014',creatures:[]}
    if (!object(creatureCatalog) || creatureCatalog.edition!=='2014' || !list(creatureCatalog.creatures)) throw new Error('Catalogo creature non valido.')
    const verifiedCreatures=creatureCatalog.creatures as unknown as ReviewedCreature[]
    if (new Set(verifiedCreatures.map((x)=>x.id)).size!==verifiedCreatures.length) throw new Error('Creature duplicate.')
    for (const e of verifiedCreatures) {
        if (e.edition!=='2014' || e.kind!=='creature' || !object(e.verification) || !e.verification.complete
            || e.verification.mechanics!=='verified-fields' || !object(e.mechanics)
            || !entities.some((x)=>x.id===e.id && stableJson(x)===stableJson(e))) throw new Error('Creatura non verificata.')
        const m=e.mechanics
        if (!object(m.abilities) || !object(m.speedFt) || !object(m.hitPoints) || !object(m.armorClass)
            || !['strength','dexterity','constitution','intelligence','wisdom','charisma'].every((a)=>Number.isInteger((m.abilities as Record<string,Json>)[a]))
            || !Number.isInteger(m.speedFt.walk) || (m.speedFt.walk as number)<0
            || typeof m.challengeRating!=='number' || !Number.isFinite(m.challengeRating) || m.challengeRating<0
            || !list(m.actions) || !list(m.traits) || !list(m.legendaryActions)) throw new Error('Statistiche della creatura non valide.')
    }
    const magicFile='data/verified-magic-items-2014.json'
    const magicCatalog=release.files[magicFile] ? await read(magicFile) : {edition:'2014',magicItems:[]}
    if (!object(magicCatalog) || magicCatalog.edition!=='2014' || !list(magicCatalog.magicItems))throw new Error('Catalogo oggetti magici non valido.')
    const verifiedMagicItems=magicCatalog.magicItems as unknown as ReviewedMagicItem[]
    if(new Set(verifiedMagicItems.map((e)=>e.id)).size!==verifiedMagicItems.length)throw new Error('Oggetti magici duplicati.')
    for(const e of verifiedMagicItems) {
        const m=e.mechanics
        if(e.edition!=='2014' || e.kind!=='magic-item' || !object(e.verification) || !e.verification.complete || e.verification.mechanics!=='verified-fields'
            || !object(m) || !object(m.effect) || typeof m.requiresAttunement!=='boolean'
            || !['armor','weapon','wondrous','potion','ring','rod','scroll','staff','wand'].includes(m.category)
            || !['common','uncommon','rare','very-rare','legendary','varies','artifact'].includes(m.rarity)
            || !entities.some((r)=>r.id===e.id && stableJson(r)===stableJson(e)))throw new Error('Oggetto magico non verificato.')
    }
    const creationFile='data/verified-creation-options-2014.json'
    const creationCatalog=release.files[creationFile] ? await read(creationFile) : {edition:'2014',creationOptions:[]}
    if(!object(creationCatalog) || creationCatalog.edition!=='2014' || !list(creationCatalog.creationOptions))throw new Error('Catalogo scelte di creazione non valido.')
    const verifiedCreationOptions=creationCatalog.creationOptions as unknown as ReviewedEntity[]
    if(new Set(verifiedCreationOptions.map((e)=>e.id)).size!==verifiedCreationOptions.length || verifiedCreationOptions.some((e)=>e.edition!=='2014'
        || !['feat','race-variant','background-variant','weapon-property'].includes(e.kind) || !object(e.verification) || !e.verification.complete
        || e.verification.mechanics!=='verified-fields' || !entities.some((r)=>r.id===e.id && stableJson(r)===stableJson(e))))throw new Error('Scelta di creazione non verificata.')
    const verifiedOptions = c.options as unknown as VerifiedOption[]
    if (new Set(verifiedOptions.map((x) => x.id)).size !== verifiedOptions.length || verifiedOptions.some((x) => {
        if (x.edition !== '2014' || x.kind !== 'class-option' || !object(x.verification) || !x.verification.complete
            || x.verification.mechanics !== 'verified-fields' || !object(x.mechanics) || !object(x.mechanics.prerequisites)
            || !object(x.mechanics.effect) || !entities.some((e) => e.id === x.id && stableJson(e) === stableJson(x))) return true
        const m = x.mechanics
        if (m.optionType === 'pact-boon' || m.optionType === 'eldritch-invocation') {
            return !Number.isInteger(m.prerequisites.minimumWarlockLevelForSelection)
                || m.prerequisites.minimumWarlockLevelForSelection < 1 || m.prerequisites.minimumWarlockLevelForSelection > 20
        }
        if (m.optionType !== 'fighting-style' && m.optionType !== 'fighter-maneuver' && m.optionType !== 'totem-choice' && m.optionType !== 'hunter-choice' && m.optionType !== 'monk-discipline' && m.optionType !== 'wizard-choice' && m.optionType !== 'metamagic' && m.optionType !== 'sorcerer-choice') return true
        if (Object.keys(m.prerequisites).length || !list(m.selectionOrigins) || !m.selectionOrigins.length) return true
        return m.selectionOrigins.some((o) => !entities.some((e) => e.id === o.originId && e.verification.complete)
            || (o.featId ? o.featId !== o.originId : !o.classId || !Number.isInteger(o.minimumClassLevel)
                || (o.minimumClassLevel ?? 0) < 1 || (o.minimumClassLevel ?? 0) > 20))
    })) throw new Error('Opzioni non verificate o non supportate.')
    const data = { ...o, ...e, skills: r.skills, experienceThresholds: r.experienceThresholds } as unknown as CreationData
    // Preserve the existing wizard overlay's identity rules without invoking the
    // active loader or certifying the supplement/UA payloads.
    const wizardSubclasses = w.subclasses as unknown as Origin[]
    const subclasses = [...data.subclasses.map((x) => ({ ...x, ...wizardSubclasses.find((s) => s.index === x.index && s.class?.index === x.class?.index) })),
        ...wizardSubclasses.filter((x) => !data.subclasses.some((s) => s.index === x.index))]
    const features = [...data.features, ...wizardSubclasses.flatMap((x) => x.features ?? []).filter((x) => !data.features.some((f) => f.index === x.index))]
    return { ...data, subclasses, features, edition: '2014', candidateReleaseId: release.releaseId, reviewedEntities: entities,
        verifiedOptions, verifiedCreatures, verifiedEquipment, verifiedMagicItems, verifiedCreationOptions, legacyVerification: 'preserved-not-fully-reverified' }
}

export type ChoiceContext = {
    edition: '2014' | '2024'; classLevels: Record<string, number>; knownCantripIds: string[]; pactOptionId?: string
    subclassIds?: string[]; featIds?: string[]; selectionOriginId?: string
    knownStyleIds?: string[]
}
export function featSelectionIssues(data:CandidateCreationData,id:string,context:{edition:'2014'|'2024';featsEnabled:boolean;abilities:Record<Ability,number>;armorProficiencies:string[];canCastSpell:boolean;selected:{id:string;damageType?:string}[];damageType?:string}) {
    const feat=fighterFeature(data,id)
    if(feat.kind!=='feat')throw new Error('Identificatore non riferito a un talento.')
    if(!object(context.abilities) || !['strength','dexterity','constitution','intelligence','wisdom','charisma'].every((a)=>Number.isInteger(context.abilities[a as Ability]) && context.abilities[a as Ability]>=1 && context.abilities[a as Ability]<=30)
        || !Array.isArray(context.armorProficiencies) || context.armorProficiencies.some((p)=>typeof p!=='string')
        || !Array.isArray(context.selected) || context.selected.some((e)=>!object(e) || typeof e.id!=='string'))throw new Error('Contesto del talento non valido.')
    const issues:string[]=[],p=feat.mechanics.prerequisites
    if(context.edition!=='2014' || data.edition!=='2014')issues.push('Talento delle regole 2014.')
    if(context.featsEnabled!==true)issues.push('I talenti richiedono la regola opzionale autorizzata dal DM.')
    if(!object(p))throw new Error('Prerequisiti del talento non verificati.')
    if(typeof p.ability==='string' && typeof p.minimum==='number' && context.abilities[p.ability as Ability]<p.minimum)issues.push('Caratteristica inferiore al prerequisito.')
    if(typeof p.armorProficiency==='string' && !context.armorProficiencies.includes(p.armorProficiency))issues.push('Competenza nell’armatura richiesta.')
    if(p.canCastSpell===true && context.canCastSpell!==true)issues.push('Richiede la capacità di lanciare almeno un incantesimo.')
    const prior=context.selected.filter((e)=>e.id===id)
    if(feat.mechanics.repeatableWithDistinctChoice===true) {
        const types=feat.mechanics.damageTypeChoice
        if(!Array.isArray(types) || !types.includes(context.damageType ?? ''))issues.push('Scegliere un tipo di danno ammesso.')
        if(prior.some((e)=>e.damageType===context.damageType))issues.push('Questo tipo di danno è già scelto.')
    } else if(prior.length)issues.push('Lo stesso talento può essere scelto una sola volta.')
    return issues
}
export function optionIssues(option: VerifiedOption, context: ChoiceContext): string[] {
    classLevels(context.classLevels)
    const issues: string[] = []
    if (context.edition !== '2014' || option.edition !== '2014') issues.push('Questa opzione richiede le regole 2014.')
    if (!option.verification.complete || option.verification.mechanics !== 'verified-fields') issues.push('Opzione non verificata.')
    const m = option.mechanics
    if (m.optionType === 'fighting-style' || m.optionType === 'fighter-maneuver' || m.optionType === 'totem-choice' || m.optionType === 'hunter-choice' || m.optionType === 'monk-discipline' || m.optionType === 'wizard-choice' || m.optionType === 'metamagic' || m.optionType === 'sorcerer-choice') {
        const available = m.selectionOrigins.filter((o) => !context.selectionOriginId || o.originId === context.selectionOriginId)
            .some((o) => o.featId ? context.featIds?.includes(o.featId)
                : (context.classLevels[o.classId!.split(':').at(-1)!] ?? 0) >= o.minimumClassLevel!
                    && (!o.subclassId || context.subclassIds?.includes(o.subclassId)))
        if (!available) issues.push('Nessuna origine verificata autorizza questa scelta.')
        return issues
    }
    const p = m.prerequisites
    if ((context.classLevels.warlock ?? 0) < p.minimumWarlockLevelForSelection) issues.push(`Richiede il livello ${p.minimumWarlockLevelForSelection} da warlock.`)
    if (p.pactOptionId && p.pactOptionId !== context.pactOptionId) issues.push('Richiede il dono del patto indicato.')
    if (p.knownCantripId && !context.knownCantripIds.includes(p.knownCantripId)) issues.push('Richiede il trucchetto indicato.')
    if (context.pactOptionId && ((context.classLevels.warlock ?? 0) < 3
        || !['phb2014:class-option:pact-of-the-chain', 'phb2014:class-option:pact-of-the-blade', 'phb2014:class-option:pact-of-the-tome'].includes(context.pactOptionId))) issues.push('Dono del patto incoerente con il livello o non riconosciuto.')
    return issues
}

export type ResourcePool = { maximum: number; used: number; recovery: ('short-rest' | 'long-rest')[] }
export function recoverResource(pool: ResourcePool, rest: 'short-rest' | 'long-rest'): ResourcePool {
    if (!Number.isInteger(pool.maximum) || !Number.isInteger(pool.used) || pool.maximum < 0 || pool.used < 0 || pool.used > pool.maximum) throw new Error('Risorsa non valida.')
    return { ...pool, recovery: [...pool.recovery], used: pool.recovery.includes(rest) ? 0 : pool.used }
}

/** Class levels determine Pact Magic; total levels determine proficiency. */
export function warlockProgression(data: CandidateCreationData, levels: Record<string, number>) {
    const total = classLevels(levels), level = levels.warlock ?? 0
    if (data.edition !== '2014' || level < 1) throw new Error('Richiede un livello da warlock 2014.')
    const record = data.reviewedEntities.find((x) => x.id === `phb2014:class-level:warlock-${level}`)
    if (!record || record.verification.mechanics !== 'verified-fields') throw new Error('Progressione non verificata.')
    const m = record.mechanics
    const slots = m.pactSlots as { count: number; level: number; recovery: ('short-rest' | 'long-rest')[] }
    return { level, proficiencyBonus: 2 + Math.floor((total - 1) / 4), invocationsKnown: m.invocationsKnown as number,
        spellsKnown: m.spellsKnown as number, cantripsKnown: m.cantripsKnown as number, pactSlotLevel: slots.level,
        pactSlots: { maximum: slots.count, used: 0, recovery: [...slots.recovery] } satisfies ResourcePool,
        mysticArcanumLevels: m.mysticArcanumLevels as number[] }
}

export function invocationSelectionIssues(data: CandidateCreationData, selectedIds: string[], context: ChoiceContext): string[] {
    const issues: string[] = []
    if (new Set(selectedIds).size !== selectedIds.length) issues.push('Invocazioni duplicate.')
    if (selectedIds.length > warlockProgression(data, context.classLevels).invocationsKnown) issues.push('Numero di invocazioni superiore al limite verificato.')
    for (const id of selectedIds) {
        const option = data.verifiedOptions.find((x) => x.id === id && x.mechanics.optionType === 'eldritch-invocation')
        if (!option) issues.push(`Invocazione non riconosciuta: ${id}.`)
        else issues.push(...optionIssues(option, context))
    }
    return issues
}

/** Expanded patron spells are eligible choices, never automatic grants. */
export function patronExpandedSpellChoices(data: CandidateCreationData, patronId: string, maximumSpellLevel: number): string[] {
    const patron = data.reviewedEntities.find((x) => x.id === patronId && x.kind === 'subclass' && x.relations.classId === 'phb2014:class:warlock')
    if (!patron?.verification.complete) throw new Error('Patrono non verificato.')
    const rows = patron.mechanics.expandedSpellChoices as { spellLevel: number; spellIds: string[]; automaticallyKnown: boolean }[]
    return rows.filter((x) => x.spellLevel <= maximumSpellLevel && x.automaticallyKnown === false).flatMap((x) => x.spellIds)
}

export type FighterCastingRow = { fighterLevel: number; cantripsKnown: number; spellsKnown: number; spellSlots: number[] }
export type FighterCasting = {
    spellList: 'wizard'; castingAbility: 'intelligence'; slotRecovery: ('long-rest')[]
    progression: FighterCastingRow[]; restrictedSchools: string[]; newUnrestrictedSpellAtFighterLevels: number[]
    unrestrictedReplacementForSpellLearnedAtLevels: number[]; unrestrictedReplacementRequiresOriginalUnrestrictedChoice?: boolean
}
const fighterFeature = (data: CandidateCreationData, id: string) => {
    if (data.edition !== '2014') throw new Error('Richiede le regole 2014.')
    const e = data.reviewedEntities.find((x) => x.id === id)
    if (!e?.verification.complete || e.verification.mechanics !== 'verified-fields') throw new Error('Privilegio non verificato.')
    return e
}

/** Optional rules stay outside the PHB defaults until the campaign explicitly enables them. */
export function optionalRulePlan(data:CandidateCreationData,id:string,context:{edition:'2014'|'2024';dmApproved:boolean}) {
    const rule=fighterFeature(data,id)
    if(context.edition!=='2014' || context.dmApproved!==true || rule.kind!=='rule' || rule.mechanics.requiresDMApproval!==true)throw new Error('Opzione del DM 2014 non autorizzata.')
    return structuredClone(rule)
}

export function supernaturalGiftGrantPlan(data:CandidateCreationData,id:string,context:{edition:'2014'|'2024';dmApproved:boolean;classLevels:Record<string,number>;subclassIds?:string[];existingGiftIds:string[]}) {
    const gift=optionalRulePlan(data,id,context),m=gift.mechanics as unknown as SupernaturalGiftMechanics,total=classLevels(context.classLevels)
    if(m.ruleType!=='supernatural-gift' || !['blessing','charm','epic-boon'].includes(m.giftType) || !Array.isArray(context.existingGiftIds)
        || context.existingGiftIds.some((x)=>!data.reviewedEntities.some((e)=>e.id===x && e.mechanics.ruleType==='supernatural-gift'))
        || Object.keys(context.classLevels).some((i)=>!data.reviewedEntities.some((e)=>e.kind==='class' && e.index===i)))throw new Error('Dono o contesto di progressione non validi.')
    if(m.giftType==='epic-boon' && (total!==20 || context.existingGiftIds.includes(id)))throw new Error('Beneficio epico solo al livello venti e una sola volta.')
    if(id==='dmg2014:rule:epic-boon-high-magic' && !multiclassSpellPools(data,context.classLevels,context.subclassIds).spellcastingSlots[8])throw new Error('Alta Magia richiede già uno slot di nono livello; Arcanum Mistico non è uno slot.')
    return {gift:structuredClone(gift),requiresAttunement:false,countsTowardAttunementLimit:false,
        blessingBenefitsStack:false,alreadyGranted:context.existingGiftIds.includes(id),minimumTotalLevel:m.minimumTotalLevel ?? null,
        requiresGodGrantOrDMReward:true,sources:gift.sources}
}

/** Gift casting has explicit overrides; a slot exemption alone never waives components. */
export function supernaturalGiftSpellPlan(data:CandidateCreationData,id:string,context:{edition:'2014'|'2024';dmApproved:boolean;grantedGiftIds:string[];used:number;castChoiceIndex?:number;selectedSpellId?:string;canCastSelectedSpell?:boolean;inAntimagic:boolean}) {
    const gift=optionalRulePlan(data,id,context),m=gift.mechanics as unknown as SupernaturalGiftMechanics,main=m.effect
    if(m.ruleType!=='supernatural-gift' || !Array.isArray(context.grantedGiftIds) || !context.grantedGiftIds.includes(id) || typeof context.inAntimagic!=='boolean'
        || !Number.isSafeInteger(context.used) || context.used<0 || typeof main.uses==='number' && context.used>main.uses)throw new Error('Dono non ricevuto o risorsa non valida.')
    if(m.giftType==='charm' && context.inAntimagic)throw new Error('Il dono minore non funziona nell’antimagia.')
    const choices=main.castChoices
    if(Array.isArray(choices) && (!Number.isSafeInteger(context.castChoiceIndex) || context.castChoiceIndex!<0 || context.castChoiceIndex!>=choices.length)
        || !Array.isArray(choices) && context.castChoiceIndex!==undefined)throw new Error('Scelta di magia non valida.')
    const effect=Array.isArray(choices)?choices[context.castChoiceIndex!]:main
    if(!object(effect))throw new Error('Effetto del dono non verificato.')
    const selected=['epic-boon-quick-casting','epic-boon-spell-mastery','epic-boon-spell-recall'].includes(gift.index)
    const spellId=selected?context.selectedSpellId:effect.castSpellId
    if(typeof spellId!=='string' || selected && context.canCastSelectedSpell!==true || !selected && context.selectedSpellId!==undefined)throw new Error('Magia non scelta o non conosciuta/preparata.')
    const spell=fighterFeature(data,spellId),level=Number(spell.mechanics.level),casting=spell.mechanics.casting
    if(spell.kind!=='spell')throw new Error('Il dono non lancia questa entità.')
    if(gift.index==='epic-boon-spell-mastery' && (level!==1 || !Array.isArray(spell.mechanics.classes) || !spell.mechanics.classes.some((c)=>['sorcerer','warlock','wizard'].includes(String(c)))))throw new Error('Maestria richiede magia di primo di stregone, warlock o mago.')
    if(gift.index==='epic-boon-quick-casting' && (level<1 || level>3 || !object(casting) || casting.quantity!==1 || casting.unit!=='action'))throw new Error('Lancio Rapido richiede magia di primo–terzo con tempo una azione.')
    const cost=typeof effect.chargeCost==='number'?effect.chargeCost:typeof main.uses==='number'?1:0
    if(typeof main.uses==='number' && context.used+cost>main.uses || typeof main.uses!=='number' && context.used!==0)throw new Error('Usi o cariche insufficienti.')
    return {giftId:id,spell:structuredClone(spell),used:context.used+cost,chargeCost:cost,vanishesAtZero:main.vanishesWhenUsedUp===true && context.used+cost===main.uses,
        castSpellLevel:typeof effect.castSpellLevel==='number'?effect.castSpellLevel:level,castSaveDC:effect.castSaveDC ?? null,
        castingTime:gift.index==='epic-boon-quick-casting'?{quantity:1,unit:'bonus-action'}:effect.activation==='action' || main.activation==='action'?{quantity:1,unit:'action'}:structuredClone(casting),
        componentsRequired:m.giftType==='charm'?false:effect.componentsRequired!==false,spendsPersonalSpellSlot:gift.index==='epic-boon-quick-casting',
        concentrationRequired:spell.mechanics.concentration===true,requiresOrdinarySpellValidation:selected,
        sources:[...gift.sources,...spell.sources]}
}

export function firearmUsePlan(data:CandidateCreationData,index:string,context:{edition:'2014'|'2024';dmApproved:boolean;mode:'single'|'burst'|'reload';loadedAmmunition:number;distanceFt:number;shotsAlreadyInActivation:number}) {
    const rule=optionalRulePlan(data,'dmg2014:rule:firearms',context),weapons=rule.mechanics.weapons as unknown as FirearmStatistics[]
    const weapon=weapons.find((w)=>w.index===index)
    if(!weapon || !['single','burst','reload'].includes(context.mode) || !Number.isSafeInteger(context.loadedAmmunition) || context.loadedAmmunition<0
        || !Number.isSafeInteger(context.shotsAlreadyInActivation) || context.shotsAlreadyInActivation<0 || !Number.isFinite(context.distanceFt) || context.distanceFt<0
        || (weapon.reloadCapacity!==null && context.loadedAmmunition>weapon.reloadCapacity))throw new Error('Arma, munizioni o distanza non validi.')
    if(context.mode==='reload') {
        if(weapon.reloadCapacity===null)throw new Error('Questa arma ha Loading, senza caricatore Reload.')
        return {weapon:structuredClone(weapon),activationChoices:['action','bonus-action'],ammunitionRequired:weapon.ammunition==='energy-cell' ? 1 : weapon.reloadCapacity-context.loadedAmmunition,
            loadedAfter:weapon.reloadCapacity,ammunitionSpent:0,sources:rule.sources}
    }
    const burst=context.mode==='burst',cost=burst ? Number((rule.mechanics.burstFire as {ammunitionCost:number}).ammunitionCost) : 1
    if(context.loadedAmmunition<cost || context.distanceFt>(burst ? weapon.rangeFt.normal : weapon.rangeFt.long)
        || (burst && !weapon.burstFire) || (weapon.loading && context.shotsAlreadyInActivation>0))throw new Error('Attacco fuori gittata, raffica non disponibile o munizioni insufficienti.')
    return {weapon:structuredClone(weapon),activationChoices:burst ? ['action'] : ['attack'],ammunitionSpent:cost,loadedAfter:context.loadedAmmunition-cost,
        rangeDisadvantage:!burst && context.distanceFt>weapon.rangeFt.normal,burstEffect:burst ? structuredClone(rule.mechanics.burstFire) : null,
        expendedAmmunitionRecoverable:false,proficiencyDeterminedByDM:true,sources:rule.sources}
}

/** Exposure is distinct from resolving a saving throw or deciding a partial ingested dose. */
export function poisonExposurePlan(data:CandidateCreationData,id:string,context:{edition:'2014'|'2024';delivery:PoisonDelivery;doseFraction:number;exposedSkin:boolean;inReleasedCube:boolean;woundDamageType:'piercing'|'slashing'|'other';holdingBreath:boolean}) {
    const poison=fighterFeature(data,id),m=poison.mechanics as unknown as PoisonMechanics,delivery=fighterFeature(data,'dmg2014:rule:poison-delivery')
    if(context.edition!=='2014' || m.ruleType!=='poison' || !['contact','ingested','inhaled','injury'].includes(context.delivery) || context.delivery!==m.delivery
        || !Number.isFinite(context.doseFraction) || context.doseFraction<=0 || context.doseFraction>1 || !['piercing','slashing','other'].includes(context.woundDamageType)
        || [context.exposedSkin,context.inReleasedCube,context.holdingBreath].some((v)=>typeof v!=='boolean'))throw new Error('Esposizione al veleno non valida.')
    const partial=context.delivery==='ingested' && context.doseFraction<1
    const exposed=context.delivery==='contact' ? context.exposedSkin : context.delivery==='inhaled' ? context.inReleasedCube : context.delivery==='injury' ? context.woundDamageType!=='other' : !partial
    return {exposed,partialDoseRequiresDM:partial,holdingBreathProtects:false,mechanics:structuredClone(m),deliveryMechanics:structuredClone(delivery.mechanics),sources:[...poison.sources,...delivery.sources]}
}

export function madnessTableEntry(data:CandidateCreationData,kind:'short'|'long'|'indefinite',roll:number,context:{edition:'2014'|'2024';dmApproved:boolean}) {
    const rule=data.reviewedEntities.find((e)=>e.id==='dmg2014:rule:madness')
    if(data.edition!=='2014' || context.edition!=='2014' || context.dmApproved!==true || rule?.verification.mechanics!=='verified-fields'
        || !['short','long','indefinite'].includes(kind) || !Number.isInteger(roll) || roll<1 || roll>100)throw new Error('Follia o risultato d100 non autorizzati.')
    const table=(rule.mechanics.tables as unknown as Record<string,{duration:string;rows:{minimum:number;maximum:number;effect:Record<string,Json>;summaryIt:string}[]}>)[kind]
    const row=table.rows.find((r)=>roll>=r.minimum && roll<=r.maximum)
    if(!row || row.effect.openInterpretation)throw new Error('Effetto della riga ancora interpretativamente incompleto.')
    return {duration:table.duration,entry:structuredClone(row),sources:structuredClone(rule.sources),wholeRuleComplete:rule.verification.complete}
}

/** A future unverified feature does not block reviewed lower-level choices. */
export function selectedSubclassFeaturePlan(data:CandidateCreationData,levels:Record<string,number>,subclassId:string,permission:{dmApproved?:boolean;alignment?:string}={}) {
    classLevels(levels)
    const subclass=data.reviewedEntities.find((e)=>e.id===subclassId && e.kind==='subclass')
    const cls=data.reviewedEntities.find((e)=>e.id===subclass?.relations.classId && e.kind==='class')
    if(data.edition!=='2014' || !subclass || subclass.verification.identity!=='verified' || !cls || typeof subclass.mechanics.minimumLevel!=='number' || (levels[cls.index] ?? 0)<subclass.mechanics.minimumLevel)throw new Error('Sottoclasse o livello non valido.')
    if(subclass.mechanics.requiresDMApproval && permission.dmApproved!==true)throw new Error('Questa opzione richiede il consenso esplicito del DM.')
    if(subclass.mechanics.requiresAlignment==='evil' && !['lawful-evil','neutral-evil','chaotic-evil'].includes(permission.alignment ?? ''))throw new Error('L’Apostata richiede allineamento malvagio.')
    const features=data.reviewedEntities.filter((e)=>e.kind==='subclass-feature' && e.relations.subclassId===subclassId && typeof e.mechanics.level==='number' && e.mechanics.level<=(levels[cls.index] ?? 0))
    if(!features.length || features.some((e)=>!e.verification.complete || e.verification.mechanics!=='verified-fields'))throw new Error('Privilegi della sottoclasse a questo livello ancora da verificare.')
    return {subclassId,classId:cls.id,classLevel:levels[cls.index],features:structuredClone(features),laterFeaturesCertified:subclass.verification.complete}
}
export function fighterProgression(data: CandidateCreationData, levels: Record<string, number>, subclassId: string) {
    const total = classLevels(levels), level = levels.fighter ?? 0
    const subclass = data.reviewedEntities.find((x) => x.id === subclassId && x.kind === 'subclass' && x.relations.classId === 'phb2014:class:fighter')
    if (level < 3 || !subclass?.verification.complete || data.edition !== '2014') throw new Error('Archetipo o livello da guerriero non valido.')
    const casting = subclass.index === 'eldritch-knight'
        ? fighterFeature(data, 'phb2014:subclass-feature:eldritch-knight-3-spellcasting').mechanics.effect as unknown as FighterCasting : undefined
    const row = casting?.progression.find((x) => x.fighterLevel === level)
    if (casting && !row) throw new Error('Progressione del Cavaliere Mistico mancante.')
    return { level, proficiencyBonus: 2 + Math.floor((total - 1) / 4),
        ...(row ? { casting: { ...row, spellSlots: [...row.spellSlots], slotRecovery: [...casting!.slotRecovery] } } : {}) }
}

/** Check one choice event against its granting origin; effects have no universal Battle Master prerequisite. */
export function fighterSelectionIssues(data: CandidateCreationData, ids: string[], context: ChoiceContext): string[] {
    classLevels(context.classLevels)
    const issues: string[] = [], origin = context.selectionOriginId, level = context.classLevels.fighter ?? 0
    if (!origin) return ['Specificare l’origine della scelta.']
    let type: 'fighting-style' | 'fighter-maneuver', limit: number
    if (['phb2014:class-feature:fighter-1-fighting-style','phb2014:subclass-feature:champion-10-additional-fighting-style','phb2014:class-feature:paladin-2-fighting-style','phb2014:class-feature:ranger-2-fighting-style'].includes(origin)) {
        type = 'fighting-style'; limit = 1
    } else if (origin === 'phb2014:feat:martial-adept') {
        type = 'fighter-maneuver'; limit = fighterFeature(data, origin).mechanics.maneuversKnown as number
    } else if (origin === 'phb2014:subclass-feature:battle-master-3-combat-superiority') {
        type = 'fighter-maneuver'
        const effect = fighterFeature(data, origin).mechanics.effect as { [key: string]: Json }
        const table = effect.maneuversKnownByFighterLevel as Record<string, number>
        limit = Object.entries(table).filter(([n]) => Number(n) <= level).at(-1)?.[1] ?? 0
    } else return ['Origine della scelta non supportata.']
    if (new Set(ids).size !== ids.length) issues.push('Scelte duplicate.')
    if (ids.length > limit) issues.push('Numero di scelte superiore al limite verificato.')
    for (const id of ids) {
        const option = data.verifiedOptions.find((x) => x.id === id && x.mechanics.optionType === type)
        if (!option) issues.push('Opzione non riconosciuta per questa origine.')
        else issues.push(...optionIssues(option, context))
        if (type === 'fighting-style' && context.knownStyleIds?.includes(id)) issues.push('Stile già conosciuto.')
    }
    return issues
}

export function maneuverResources(data: CandidateCreationData, context: ChoiceContext): (ResourcePool & { originId: string; die: string })[] {
    classLevels(context.classLevels)
    if (context.edition !== '2014') throw new Error('Richiede le regole 2014.')
    const pools: (ResourcePool & { originId: string; die: string })[] = [], level = context.classLevels.fighter ?? 0
    const origin = 'phb2014:subclass-feature:battle-master-3-combat-superiority'
    if (level >= 3 && context.subclassIds?.includes('phb2014:subclass:battle-master')) {
        const effect = fighterFeature(data, origin).mechanics.effect as { [key: string]: Json }
        const atLevel = (table: Json) => Object.entries(table as Record<string, string | number>).filter(([n]) => Number(n) <= level).at(-1)![1]
        pools.push({ originId: origin, die: atLevel(effect.dieByFighterLevel) as string, maximum: atLevel(effect.diceCountByFighterLevel) as number,
            used: 0, recovery: [...effect.recovery as ResourcePool['recovery']] })
    }
    if (context.featIds?.includes('phb2014:feat:martial-adept')) {
        const feat = fighterFeature(data, 'phb2014:feat:martial-adept')
        if (feat.mechanics.superiorityDie !== '1d6') throw new Error('Dado di Adepto Marziale non verificato secondo le errata.')
        pools.push({ originId: feat.id, die: 'd6', maximum: feat.mechanics.superiorityDiceAdded as number, used: 0,
            recovery: [...feat.mechanics.recovery as ResourcePool['recovery']] })
    }
    return pools
}

export function eldritchKnightSpellReplacementIssues(data: CandidateCreationData, levels: Record<string, number>,
    spellId: string, learnedAtFighterLevel: number, originallyUnrestricted: boolean): string[] {
    const row = fighterProgression(data, levels, 'phb2014:subclass:eldritch-knight').casting!
    if (!Number.isInteger(learnedAtFighterLevel) || learnedAtFighterLevel < 3 || learnedAtFighterLevel >= row.fighterLevel) throw new Error('Livello di apprendimento non valido per una sostituzione.')
    const m = fighterFeature(data, 'phb2014:subclass-feature:eldritch-knight-3-spellcasting').mechanics.effect as unknown as FighterCasting
    const spell = data.reviewedEntities.find((e) => e.id === spellId && e.kind === 'spell'), issues: string[] = []
    if (!spell || spell.verification.mechanics !== 'verified-fields' || !spell.verification.complete) return ['Descrizione dell’incantesimo ancora da verificare.']
    const s = spell.mechanics
    if (!(s.classes as string[])?.includes('wizard')) issues.push('Richiede un incantesimo della lista del mago.')
    const maximum = row.spellSlots.reduce((max, count, i) => count > 0 ? i + 1 : max, 0)
    if (typeof s.level !== 'number' || s.level < 1 || s.level > maximum) issues.push('Livello dell’incantesimo non disponibile.')
    const free = m.unrestrictedReplacementForSpellLearnedAtLevels.includes(learnedAtFighterLevel) && originallyUnrestricted
    if (!free && !m.restrictedSchools.includes(s.school as string)) issues.push('Richiede abiurazione o invocazione per questa sostituzione.')
    return issues
}

export type SneakAttackContext = {
    attackRollState: 'advantage' | 'normal' | 'disadvantage'; weapon: 'finesse' | 'ranged' | 'other'
    hitCreature: boolean; alreadyUsedThisTurn: boolean
    otherEnemyOfTarget?: { distanceFt: number; incapacitated: boolean }
}
export function rogueSneakAttack(data: CandidateCreationData, levels: Record<string, number>, context: SneakAttackContext) {
    classLevels(levels)
    const level=levels.rogue ?? 0
    if (level<1) throw new Error('Richiede un livello da ladro.')
    const f=fighterFeature(data,'phb2014:class-feature:rogue-1-sneak-attack')
    const m=f.mechanics.effect as { [key: string]: Json }
    const enemy=context.otherEnemyOfTarget
    if (enemy && (!Number.isFinite(enemy.distanceFt) || enemy.distanceFt<0)) throw new Error('Distanza non valida.')
    const eligible=context.hitCreature && !context.alreadyUsedThisTurn && context.weapon!=='other'
        && (context.attackRollState==='advantage' || context.attackRollState==='normal' && !!enemy && enemy.distanceFt<=5 && !enemy.incapacitated)
    return { eligible, dice:(m.extraDamageDiceByRogueLevel as Record<string,string>)[String(level)], maximumUsesPerTurn:m.maximumUsesPerTurn as number }
}

export function rogueSpellcastingProgression(data: CandidateCreationData, levels: Record<string,number>) {
    const total=classLevels(levels), level=levels.rogue ?? 0
    if (level<3) throw new Error('Richiede il livello 3 da Mistificatore Arcano.')
    const m=fighterFeature(data,'phb2014:subclass-feature:arcane-trickster-3-spellcasting').mechanics.effect as {
        progression: { rogueLevel:number; cantripsKnown:number; spellsKnown:number; spellSlots:number[] }[]
        unrestrictedReplacementForSpellLearnedAtLevels:number[]
    }
    const row=m.progression.find((x)=>x.rogueLevel===level)
    if (!row) throw new Error('Progressione del Mistificatore Arcano mancante.')
    return { ...row, spellSlots:[...row.spellSlots], proficiencyBonus:2+Math.floor((total-1)/4),
        unrestrictedReplacementForSpellLearnedAtLevels:[...m.unrestrictedReplacementForSpellLearnedAtLevels] }
}

export function totemSelectionIssues(data: CandidateCreationData, ids: string[], context: ChoiceContext): string[] {
    classLevels(context.classLevels)
    const issues: string[]=[]
    if (!context.selectionOriginId) return ['Specificare il privilegio totemico che concede la scelta.']
    const origins=['phb2014:subclass-feature:totem-warrior-3-totem-spirit',
        'phb2014:subclass-feature:totem-warrior-6-aspect-of-the-beast','phb2014:subclass-feature:totem-warrior-14-totemic-attunement']
    if (!origins.includes(context.selectionOriginId)) return ['Origine totemica non riconosciuta.']
    if (ids.length>1) issues.push('Il privilegio concede una sola scelta totemica.')
    for (const id of ids) {
        const option=data.verifiedOptions.find((x)=>x.id===id && x.mechanics.optionType==='totem-choice')
        if (!option) issues.push('Opzione totemica non riconosciuta.')
        else issues.push(...optionIssues(option,context))
    }
    return issues
}

export type ReviewedCreature = Omit<ReviewedEntity,'mechanics'> & { kind:'creature'; mechanics:CreatureMechanics }
export function reviewedCreature(data:CandidateCreationData,id:string):ReviewedCreature {
    const e=data.verifiedCreatures.find((x)=>x.id===id)
    if (data.edition!=='2014' || !e || !e.verification.complete || e.verification.mechanics!=='verified-fields') throw new Error('Creatura 2014 ancora da verificare.')
    return structuredClone(e) as unknown as ReviewedCreature
}

/** PHB spirit: optional MM familiar agreements never grant the master resistance here. */
export function familiarStatistics(data:CandidateCreationData,id:string,spiritType:'celestial'|'fey'|'fiend',context?:ChoiceContext) {
    const spell=fighterFeature(data,'phb2014:spell:find-familiar')
    if (!(spell.relations.normalFormIds as string[]|undefined)?.includes(id)) {
        if (!context)throw new Error('Forma speciale richiede il Patto della Catena.')
        const pact=chainPact(data,context)
        if (!(pact.relations.specialFormIds as string[]|undefined)?.includes(id))throw new Error('Forma del famiglio non ammessa o ancora da verificare.')
    }
    const effect=spell.mechanics.effect as Record<string,Json>
    if (!(effect.creatureTypeChoice as string[]).includes(spiritType)) throw new Error('Tipo di spirito non ammesso.')
    const creature=reviewedCreature(data,id)
    creature.mechanics.type=spiritType
    // Retain non-attack actions such as Ink Cloud; no invented attack exemption.
    creature.mechanics.actions=creature.mechanics.actions.filter((a)=>!['melee-weapon-attack','ranged-weapon-attack','melee-or-ranged-weapon-attack','multiattack'].includes(a.kind))
    return { creature, cannotAttack:true as const, ownInitiative:true as const, sources:[...spell.sources,...creature.sources] }
}

function chainPact(data:CandidateCreationData,context:ChoiceContext) {
    classLevels(context.classLevels)
    const pact=fighterFeature(data,'phb2014:class-option:pact-of-the-chain')
    if(context.edition!=='2014' || context.pactOptionId!==pact.id || (context.classLevels.warlock ?? 0)<3)throw new Error('Patto della Catena o livello da warlock non valido.')
    return pact
}

/** Plans the exceptional single attack; the caller spends an own Attack-action attack and the familiar reaction. */
export function chainFamiliarAttackPlan(data:CandidateCreationData,id:string,actionIndex:string,context:ChoiceContext) {
    const pact=chainPact(data,context),spell=fighterFeature(data,'phb2014:spell:find-familiar')
    const forms=[...(spell.relations.normalFormIds as string[] ?? []),...(pact.relations.specialFormIds as string[] ?? [])]
    if(!forms.includes(id))throw new Error('Forma del famiglio non ammessa.')
    const creature=reviewedCreature(data,id),attack=creature.mechanics.actions.find((a)=>a.index===actionIndex && ['melee-weapon-attack','ranged-weapon-attack','melee-or-ranged-weapon-attack'].includes(a.kind))
    if(!attack || !object(pact.mechanics.effect) || pact.mechanics.effect.familiarAttackUsesReaction!==true)throw new Error('Attacco o erratum del famiglio non verificato.')
    return {attack,ownActionRequired:'attack' as const,ownAttacksForgone:1,familiarReactionRequired:true,requiresAvailableFamiliarReaction:true,grantsMasterMagicResistance:false,sources:[...pact.sources,...creature.sources]}
}

/** Reviewed base and Moon limits; unrelated subclass exceptions remain unsupported. */
export function wildShapeIssues(data:CandidateCreationData,id:string,context:{edition:'2014'|'2024';classLevels:Record<string,number>;previouslySeen:boolean;subclassId?:string}):string[] {
    classLevels(context.classLevels)
    const issues:string[]=[],level=context.classLevels.druid ?? 0
    if (context.edition!=='2014' || data.edition!=='2014') issues.push('Forma Selvatica richiede le regole 2014.')
    if (level<2) issues.push('Richiede il livello 2 da druido.')
    const moon=context.subclassId==='phb2014:subclass:moon'
    if (moon && !data.reviewedEntities.some((e)=>e.id==='phb2014:subclass-feature:moon-2-circle-forms' && e.verification.complete)) return [...issues,'Eccezioni del Circolo della Luna ancora da verificare.']
    if (context.subclassId && !['phb2014:subclass:land','phb2014:subclass:moon'].includes(context.subclassId)) issues.push('Eccezioni della sottoclasse ancora da verificare.')
    const creature=reviewedCreature(data,id),m=creature.mechanics
    const rule=fighterFeature(data,'phb2014:class-feature:druid-2-wild-shape').mechanics.effect as Record<string,Json>
    const limits=rule.beastLimitsByClassLevel as Record<string,{maxCR:number;noSpeeds:string[]}>
    const allowed=limits[String(level>=8?8:level>=4?4:2)]!
    if (moon && m.type==='elemental') {
        const f=fighterFeature(data,'phb2014:subclass-feature:moon-10-elemental-wild-shape')
        const effect=f.mechanics.effect as Record<string,Json>
        if (level<10) issues.push('Forma Selvatica Elementale richiede il livello 10 da druido.')
        if (!(effect.formIds as string[]).includes(id)) issues.push('Elementale non ammesso dalla Forma Selvatica Elementale.')
        return issues
    }
    if (m.type!=='beast') issues.push('La forma deve essere una bestia.')
    if (m.isSwarm) issues.push('Forma di sciame non supportata per la selezione automatica: richiede una decisione del DM.')
    if (!context.previouslySeen) issues.push('La forma richiede una bestia già vista.')
    const maxCR=moon ? (fighterFeature(data,'phb2014:subclass-feature:moon-2-circle-forms').mechanics.effect as {
        maximumBeastCRByDruidLevel:Record<string,number> }).maximumBeastCRByDruidLevel[String(Math.max(2,level))]! : allowed.maxCR
    if (m.challengeRating>maxCR) issues.push('Grado di sfida superiore al limite del druido.')
    if (allowed.noSpeeds.some((speed)=>(m.speedFt[speed as keyof CreatureMechanics['speedFt']] ?? 0)>0)) issues.push('Velocità di nuoto o volo non disponibile a questo livello.')
    return issues
}

export type LandTerrain='arctic'|'coast'|'desert'|'forest'|'grassland'|'mountain'|'swamp'|'underdark'
export type DruidCircleGrant={druidLevel:number;spellId:string;alwaysPrepared:true;countsAgainstPreparedLimit:false;countsAsDruidSpell:true}
export function druidCircleSpellGrants(data:CandidateCreationData,levels:Record<string,number>,terrain:LandTerrain) {
    classLevels(levels)
    const level=levels.druid ?? 0
    if (level<2) throw new Error('Richiede il livello 2 del Circolo della Terra.')
    const m=fighterFeature(data,'phb2014:subclass-feature:land-2-circle-spells').mechanics.effect as unknown as {landChoices:Record<LandTerrain,DruidCircleGrant[]>}
    if (!Object.hasOwn(m.landChoices,terrain)) throw new Error('Territorio del circolo non valido.')
    return structuredClone(m.landChoices[terrain].filter((grant)=>grant.druidLevel<=level))
}

/** Resource cost stays separate from form statistics and the character's own HP pool. */
export function wildShapeResources(data:CandidateCreationData,levels:Record<string,number>,subclassId?:string) {
    classLevels(levels)
    const level=levels.druid ?? 0
    if (level<2) throw new Error('Richiede il livello 2 da druido.')
    const base=fighterFeature(data,'phb2014:class-feature:druid-2-wild-shape').mechanics.effect as Record<string,Json>
    const moon=subclassId==='phb2014:subclass:moon'
    if (subclassId && !['phb2014:subclass:land','phb2014:subclass:moon'].includes(subclassId)) throw new Error('Circolo non supportato.')
    const combat=moon ? fighterFeature(data,'phb2014:subclass-feature:moon-2-combat-wild-shape').mechanics.effect as Record<string,Json> : undefined
    const archdruid=level>=20 ? fighterFeature(data,'phb2014:class-feature:druid-20-archdruid').mechanics.effect as Record<string,Json> : undefined
    const resource=base.resource as {uses:number;recovery:('short-rest'|'long-rest')[]}
    const elemental=moon && level>=10 ? fighterFeature(data,'phb2014:subclass-feature:moon-10-elemental-wild-shape').mechanics.effect as Record<string,Json> : undefined
    return { maximum:archdruid?.wildShapeUses==='unlimited' ? 'unlimited' as const : resource.uses,
        recovery:[...resource.recovery],durationHours:Math.floor(level/2),activation:combat?.wildShapeActivation ?? base.activation,
        beastCost:1,elementalCost:elemental?.wildShapeUsesCost ?? null,retainConcentration:base.maintainConcentration,
        useLegendaryOrLairActions:base.useLegendaryOrLairActions }
}

export type DraconicAncestry={index:string;damageType:string;saveAbility:'dexterity'|'constitution';area:{shape:'line';widthFt:5;lengthFt:30}|{shape:'cone';lengthFt:15}}
export function draconicBreath(data:CandidateCreationData,levels:Record<string,number>,ancestry:string,constitutionScore:number) {
    const total=classLevels(levels)
    if (data.edition!=='2014' || total<1 || !Number.isInteger(constitutionScore) || constitutionScore<1 || constitutionScore>30) throw new Error('Statistiche del personaggio non valide.')
    const race=data.reviewedEntities.find((e)=>e.id==='phb2014:race:dragonborn')
    if (!race || race.verification.mechanics!=='verified-fields') throw new Error('Ascendenza draconica ancora da verificare.')
    const traits=race.mechanics.traits as unknown as {index:string;mechanics:Record<string,Json>}[]
    const origins=traits.find((t)=>t.index==='draconic-ancestry')!.mechanics.choices as unknown as DraconicAncestry[]
    const chosen=origins.find((a)=>a.index===ancestry)
    if (!chosen) throw new Error('Ascendenza draconica non valida.')
    const m=traits.find((t)=>t.index==='breath-weapon')!.mechanics
    const dice=m.damageByCharacterLevel as Record<string,string>
    const threshold=Object.keys(dice).map(Number).filter((n)=>n<=total).sort((a,b)=>b-a)[0]!
    return { ...structuredClone(chosen),saveDC:8+Math.floor((constitutionScore-10)/2)+2+Math.floor((total-1)/4),
        dice:dice[String(threshold)],successfulSave:m.successfulSave,activation:m.activation,
        resource:{maximum:m.uses as number,used:0,recovery:[...(m.recovery as ('short-rest'|'long-rest')[])]} }
}

/** Only individually sourced ability bonuses; unresolved Trance/rest interpretations do not enter this calculation. */
export function racialAbilityBonuses(data:CandidateCreationData,context:{raceId:string;subraceId?:string;variantId?:string;chosenAbilities?:Ability[];variantApproved?:boolean;dmApproved?:boolean}) {
    if (data.edition!=='2014') throw new Error('Richiede le razze 2014.')
    const race=data.reviewedEntities.find((e)=>e.id===context.raceId && e.kind==='race')
    if (!race || race.verification.mechanics!=='verified-fields') throw new Error('Razza non verificata.')
    if(race.mechanics.requiresDMApproval && context.dmApproved!==true)throw new Error('Questa razza richiede il consenso del DM.')
    const abilities:Ability[]=['strength','dexterity','constitution','intelligence','wisdom','charisma']
    const bonuses={...(race.mechanics.fixedAbilityBonuses as Partial<Record<Ability,number>>)}
    const choices=context.chosenAbilities ?? []
    if (choices.some((a)=>!abilities.includes(a)) || new Set(choices).size!==choices.length) throw new Error('Scelte di caratteristica non valide o duplicate.')
    const subraces=(race.relations.subraceIds ?? []) as string[]
    if (subraces.length && !context.subraceId) throw new Error('Scegliere una sottorazza.')
    if (context.subraceId) {
        if (!subraces.includes(context.subraceId)) throw new Error('Sottorazza incompatibile con la razza.')
        const sub=data.reviewedEntities.find((e)=>e.id===context.subraceId && e.kind==='subrace')
        if (!sub || sub.verification.mechanics!=='verified-fields') throw new Error('Sottorazza ancora da verificare.')
        if(sub.mechanics.requiresDMApproval && context.dmApproved!==true)throw new Error('Questa sottorazza richiede il consenso del DM.')
        for(const [ability,value] of Object.entries(sub.mechanics.fixedAbilityBonuses as Record<Ability,number>))
            bonuses[ability as Ability]=(bonuses[ability as Ability] ?? 0)+value
    }
    if (context.variantId) {
        const variant=data.reviewedEntities.find((e)=>e.id===context.variantId && e.kind==='race-variant')
        if (!variant?.verification.complete || variant.relations.raceId!==race.id || !context.variantApproved) throw new Error('Variante non autorizzata o incompatibile con la razza.')
        const choice=variant.mechanics.abilityBonusChoice as {choose:number;bonus:number;distinct:boolean}
        if (choices.length!==choice.choose) throw new Error('Numero di caratteristiche della variante non valido.')
        return Object.fromEntries(choices.map((a)=>[a,choice.bonus])) as Partial<Record<Ability,number>>
    }
    const choice=(race.mechanics.traits as unknown as {index:string;mechanics:{choose:number;bonus:number;exclude?:Ability[]}}[])
        .find((t)=>t.index==='ability-choice')?.mechanics
    if (choices.length!==(choice?.choose ?? 0) || choices.some((a)=>choice?.exclude?.includes(a))) throw new Error('Scelte di caratteristica non ammesse per questa razza.')
    for(const a of choices)bonuses[a]=(bonuses[a] ?? 0)+choice!.bonus
    return bonuses
}

export function backgroundTableEntry(data:CandidateCreationData,backgroundId:string,category:'traits'|'ideals'|'bonds'|'flaws'|'specialty',roll:number) {
    const e=fighterFeature(data,backgroundId)
    if (e.kind!=='background' || !Number.isInteger(roll)) throw new Error('Background o tiro non valido.')
    const m=e.mechanics as unknown as BackgroundMechanics
    const table:BackgroundTable|undefined=category==='specialty' ? m.specialtyChoice : Object.hasOwn(m.personalityTables,category) ? m.personalityTables[category] : undefined
    const entry=table?.entries.find((row)=>row.roll===roll)
    if (!entry) throw new Error('Voce della tabella non disponibile.')
    return structuredClone(entry)
}

/** Retainers and Bad Reputation belong to the base backgrounds too. */
export function backgroundFeatureChoice(data:CandidateCreationData,backgroundId:string,choice:'primary'|'alternate'='primary',variantId?:string) {
    const e=fighterFeature(data,backgroundId)
    if (e.kind!=='background' || !['primary','alternate'].includes(choice)) throw new Error('Background o scelta non valida.')
    const m=e.mechanics as unknown as BackgroundMechanics
    const feature=choice==='primary' ? m.feature : m.alternateFeature
    if (!feature) throw new Error('Privilegio alternativo non disponibile.')
    const result=structuredClone(feature)
    if (variantId) {
        const variant=fighterFeature(data,variantId)
        if (variant.kind!=='background-variant' || variant.relations.backgroundId!==backgroundId) throw new Error('Variante incompatibile con il background.')
        if (variant.mechanics.featureReplacement==='retainers') {
            if (choice!=='alternate') throw new Error('Il cavaliere richiede il privilegio Servitori.')
            result.effect.commonerRetainers=variant.mechanics.commonerRetainers!
            result.effect.nobleSquireRetainers=variant.mechanics.nobleSquireRetainers!
        }
        if (variant.index==='gladiator') result.effect.performanceVenue='combat-entertainment'
    }
    return result
}

export type BardCastingRow={bardLevel:number;spellSlots:number[];spellsKnown:number;cantripsKnown:number;bardicInspirationDie:string;songOfRestDie:string|null}
export function bardProgression(data:CandidateCreationData,levels:Record<string,number>,subclassId?:string) {
    const total=classLevels(levels),level=levels.bard ?? 0
    const casting=fighterFeature(data,'phb2014:class-feature:bard-1-spellcasting').mechanics.effect as {
        progression:BardCastingRow[];ability:string }
    const row=casting.progression.find((r)=>r.bardLevel===level)
    if (!row) throw new Error('Livello da bardo non valido.')
    if (subclassId) {
        const subclass=fighterFeature(data,subclassId)
        if (level<3 || subclass.kind!=='subclass' || subclass.relations.classId!=='phb2014:class:bard') throw new Error('Collegio bardico non valido.')
    }
    return { ...structuredClone(row),totalLevel:total,castingAbility:casting.ability,
        maximumBardSpellLevel:row.spellSlots.reduce((maximum,count,i)=>count>0 ? i+1 : maximum,0),
        additionalMagicalSecretSelections:subclassId==='phb2014:subclass:lore' && level>=6 ? 2 : 0 }
}

export function bardInspirationResource(data:CandidateCreationData,levels:Record<string,number>,charismaScore:number) {
    if (!Number.isInteger(charismaScore) || charismaScore<1 || charismaScore>30) throw new Error('Carisma non valido.')
    const row=bardProgression(data,levels)
    const m=fighterFeature(data,'phb2014:class-feature:bard-1-bardic-inspiration').mechanics.effect as {
        durationMinutes:number;resource:{recoveryBeforeBard5:string[];recoveryFromBard5:string[]} }
    return {maximum:Math.max(1,Math.floor((charismaScore-10)/2)),used:0,die:row.bardicInspirationDie,
        durationMinutes:m.durationMinutes,recovery:[...(row.bardLevel<5 ? m.resource.recoveryBeforeBard5 : m.resource.recoveryFromBard5)]}
}

/** Class-list levels may be verified while the spell's effects still await review. */
export function magicalSecretSelectionIssues(data:CandidateCreationData,levels:Record<string,number>,ids:string[],context:{originId:string;subclassId?:string;knownSpellIds?:string[]}) {
    const row=bardProgression(data,levels,context.subclassId)
    const origin=fighterFeature(data,context.originId)
    if (!['Magical Secrets','Additional Magical Secrets'].includes(origin.name) || origin.relations.classId!=='phb2014:class:bard') throw new Error('Origine dei Segreti Magici non valida.')
    const issues:string[]=[]
    if ((origin.mechanics.level as number)>row.bardLevel) issues.push('Livello da bardo insufficiente per questa scelta.')
    if (origin.relations.subclassId && origin.relations.subclassId!==context.subclassId) issues.push('Richiede il Collegio della Sapienza.')
    const effect=origin.mechanics.effect as {choose:number}
    if (ids.length!==effect.choose) issues.push('Scegliere due incantesimi.')
    if (new Set(ids).size!==ids.length) issues.push('Gli incantesimi devono essere distinti.')
    for(const id of ids) {
        const spell=data.reviewedEntities.find((e)=>e.id===id && e.kind==='spell')
        const level=spell?.mechanics.level
        const sourced=spell?.verification.mechanics==='verified-fields' || spell?.fieldSources?.level?.some((i)=>spell.sources[i]?.section==='Spell Lists')
        if (!sourced || typeof level!=='number' || !Number.isInteger(level) || level<0 || level>9) issues.push('Livello dell’incantesimo ancora da verificare: '+id)
        else if (level>row.maximumBardSpellLevel) issues.push('Livello dell’incantesimo superiore alla tabella del bardo: '+id)
        if (context.knownSpellIds?.includes(id)) issues.push('Incantesimo già conosciuto: '+id)
    }
    return issues
}

export type PaladinOathGrant={paladinLevel:number;spellId:string;alwaysPrepared:true;countsAgainstPreparedLimit:false;countsAsPaladinSpell:true}
export function paladinOathSpellGrants(data:CandidateCreationData,levels:Record<string,number>,subclassId:string,permission:{dmApproved?:boolean;alignment?:string}={}) {
    classLevels(levels)
    const level=levels.paladin ?? 0,sub=fighterFeature(data,subclassId)
    if (level<3 || sub.kind!=='subclass' || sub.relations.classId!=='phb2014:class:paladin') throw new Error('Giuramento o livello da paladino non valido.')
    selectedSubclassFeaturePlan(data,levels,subclassId,permission)
    const feature=fighterFeature(data,`${sub.id.split(':')[0]}:subclass-feature:${sub.index}-3-oath-spells`)
    const effect=feature.mechanics.effect as unknown as {grants:PaladinOathGrant[]}
    return structuredClone(effect.grants.filter((g)=>g.paladinLevel<=level))
}

export function paladinResourcePools(data:CandidateCreationData,levels:Record<string,number>,charismaScore:number) {
    classLevels(levels)
    const level=levels.paladin ?? 0
    if (level<1 || !Number.isInteger(charismaScore) || charismaScore<1 || charismaScore>30) throw new Error('Statistiche del paladino non valide.')
    fighterFeature(data,'phb2014:class-feature:paladin-1-divine-sense')
    fighterFeature(data,'phb2014:class-feature:paladin-1-lay-on-hands')
    const modifier=Math.floor((charismaScore-10)/2),rawDivineSenseMaximum=1+modifier
    // ponytail: a negative source expression permits zero uses; preserve the raw value for inspection.
    return {layOnHands:{maximum:5*level,used:0,recovery:['long-rest']},
        divineSense:{maximum:Math.max(0,rawDivineSenseMaximum),rawMaximum:rawDivineSenseMaximum,used:0,recovery:['long-rest']},
        channelDivinity:level<3 ? null : {maximum:1,used:0,recovery:['short-rest','long-rest']},
        cleansingTouch:level<14 ? null : {maximum:Math.max(1,modifier),used:0,recovery:['long-rest']} }
}

/** Damage arithmetic only; the caller must establish the hit and spend the chosen slot. */
export function paladinSmiteDamage(data:CandidateCreationData,levels:Record<string,number>,slotLevel:number,targetType:string) {
    classLevels(levels)
    const level=levels.paladin ?? 0
    if (level<2 || !Number.isInteger(slotLevel) || slotLevel<1 || slotLevel>9) throw new Error('Livello da paladino o slot non valido.')
    const effect=fighterFeature(data,'phb2014:class-feature:paladin-2-divine-smite').mechanics.effect as {extraDieAgainst:string[];cost:string}
    const smiteDice=Math.min(slotLevel+1,5)+(effect.extraDieAgainst.includes(targetType) ? 1 : 0)
    if (level>=11)fighterFeature(data,'phb2014:class-feature:paladin-11-improved-divine-smite')
    return {divineSmite:`${smiteDice}d8`,improvedDivineSmite:level>=11 ? '1d8' : null,damageType:'radiant',slotCost:effect.cost}
}

export function rangerProgression(data:CandidateCreationData,levels:Record<string,number>) {
    const total=classLevels(levels),level=levels.ranger ?? 0
    if (level<1)throw new Error('Richiede livelli da ranger.')
    const effect=fighterFeature(data,'phb2014:class-feature:ranger-2-spellcasting').mechanics.effect as unknown as {
        progression:{rangerLevel:number;spellSlots:number[];spellsKnown:number}[] }
    const row=effect.progression.find((r)=>r.rangerLevel===level)
    if (!row)throw new Error('Progressione del ranger non verificata.')
    return {...structuredClone(row),proficiencyBonus:2+Math.floor((total-1)/4),
        maximumRangerSpellLevel:row.spellSlots.reduce((maximum,count,i)=>count>0 ? i+1 : maximum,0)}
}

export function hunterSelectionIssues(data:CandidateCreationData,ids:string[],context:ChoiceContext):string[] {
    classLevels(context.classLevels)
    const stages=['hunter-3-hunter-s-prey','hunter-7-defensive-tactics','hunter-11-multiattack','hunter-15-superior-hunter-s-defense']
    if (!context.selectionOriginId || !stages.some((s)=>context.selectionOriginId==='phb2014:subclass-feature:'+s))return ['Origine del Cacciatore non valida.']
    const issues:string[]=[]
    if (ids.length>1)issues.push('Il privilegio concede una sola scelta.')
    for (const id of ids) {
        const option=data.verifiedOptions.find((e)=>e.id===id && e.mechanics.optionType==='hunter-choice')
        if (!option)issues.push('Scelta del Cacciatore non riconosciuta.')
        else issues.push(...optionIssues(option,context))
    }
    return issues
}

/** Derived companion values stay separate from the printed stat block and HP dice. */
export function rangerCompanionStatistics(data:CandidateCreationData,id:string,levels:Record<string,number>,subclassId:string) {
    const row=rangerProgression(data,levels),feature=fighterFeature(data,'phb2014:subclass-feature:beast-master-3-ranger-s-companion')
    if (row.rangerLevel<3 || subclassId!=='phb2014:subclass:beast-master')throw new Error('Richiede Signore delle Bestie di livello 3.')
    const creature=reviewedCreature(data,id),m=creature.mechanics,pb=row.proficiencyBonus
    if (m.type!=='beast' || !['Tiny','Small','Medium'].includes(m.size) || m.challengeRating>0.25)throw new Error('Bestia non ammessa come compagno.')
    const bonuses=(values:Record<string,number>)=>Object.fromEntries(Object.entries(values).map(([key,value])=>[key,value+pb]))
    return {creature,derived:{armorClass:m.armorClass.value+pb,maximumHitPoints:Math.max(m.hitPoints.average,4*row.rangerLevel),
        savingThrowBonuses:bonuses(m.savingThrowBonuses),skillBonuses:bonuses(m.skillBonuses),
        passivePerception:m.passivePerception+(Object.hasOwn(m.skillBonuses,'perception') ? pb : 0),
        attackBonuses:Object.fromEntries(m.actions.filter((a)=>a.attackBonus!==undefined).map((a)=>[a.index,a.attackBonus!+pb])),
        additionalDamageRollBonus:pb},commands:structuredClone(feature.mechanics.effect),
        exceptionalTraining:row.rangerLevel>=7 ? structuredClone(fighterFeature(data,'phb2014:subclass-feature:beast-master-7-exceptional-training').mechanics.effect) : null,
        bestialFury:row.rangerLevel>=11 ? structuredClone(fighterFeature(data,'phb2014:subclass-feature:beast-master-11-bestial-fury').mechanics.effect) : null,
        sources:[...creature.sources,...feature.sources]}
}

export function monkResources(data:CandidateCreationData,levels:Record<string,number>,wisdomScore:number) {
    const total=classLevels(levels),level=levels.monk ?? 0
    if (level<1 || !Number.isInteger(wisdomScore) || wisdomScore<1 || wisdomScore>30)throw new Error('Statistiche del monaco non valide.')
    const row=data.reviewedEntities.find((e)=>e.id===`phb2014:class-level:monk-${level}`)
    if (!row || row.verification.mechanics!=='verified-fields')throw new Error('Progressione del monaco non verificata.')
    const ki=fighterFeature(data,'phb2014:class-feature:monk-2-ki').mechanics.effect as {minimumRestMeditationMinutes:number}
    return {monkLevel:level,ki:{maximum:level<2 ? 0 : level,used:0,recovery:['short-rest','long-rest'] as ResourcePool['recovery'],minimumMeditationMinutes:ki.minimumRestMeditationMinutes},
        kiSaveDC:8+2+Math.floor((total-1)/4)+Math.floor((wisdomScore-10)/2),
        martialArtsDie:row.mechanics.martialArtsDie as string,unarmoredMovementBonusFt:row.mechanics.unarmoredMovementBonusFt as number}
}

export function recoverMonkKi(data:CandidateCreationData,levels:Record<string,number>,used:number,rest:'short-rest'|'long-rest',meditationMinutes:number):ResourcePool {
    const {ki}=monkResources(data,levels,10)
    if (!Number.isFinite(meditationMinutes) || meditationMinutes<0 || !Number.isInteger(used) || used<0 || used>ki.maximum)throw new Error('Risorsa o meditazione non valida.')
    return meditationMinutes<ki.minimumMeditationMinutes ? {...ki,used} : recoverResource({...ki,used},rest)
}

export function monkDisciplineSelectionIssues(data:CandidateCreationData,ids:string[],context:ChoiceContext):string[] {
    classLevels(context.classLevels)
    const level=context.classLevels.monk ?? 0,issues:string[]=[]
    if (level<3 || !context.subclassIds?.includes('phb2014:subclass:four-elements'))issues.push('Richiede Quattro Elementi di livello 3.')
    const maximum=level>=17 ? 5 : level>=11 ? 4 : level>=6 ? 3 : 2
    if (ids.length>maximum)issues.push('Numero di discipline superiore al limite del monaco.')
    if (new Set(ids).size!==ids.length)issues.push('Discipline duplicate.')
    if (level<6 && !ids.includes('phb2014:class-option:monk-elemental-attunement'))issues.push('Sintonia Elementale iniziale richiesta prima della prima sostituzione.')
    for (const id of ids) {
        const option=data.verifiedOptions.find((e)=>e.id===id && e.mechanics.optionType==='monk-discipline')
        if (!option)issues.push('Disciplina non riconosciuta.')
        else issues.push(...optionIssues(option,{...context,selectionOriginId:'phb2014:subclass-feature:four-elements-3-disciple-of-the-elements'}))
    }
    return issues
}

/** Cast plan only. Nonspell disciplines have their own ki costs and bypass this spell cap. */
export function monkDisciplineSpellUse(data:CandidateCreationData,id:string,context:ChoiceContext,knownDisciplineIds:string[],extraKi=0) {
    const issues=monkDisciplineSelectionIssues(data,knownDisciplineIds,context)
    const option=data.verifiedOptions.find((e)=>e.id===id && e.mechanics.optionType==='monk-discipline')
    if (issues.length || !knownDisciplineIds.includes(id) || !option || option.mechanics.optionType!=='monk-discipline')throw new Error('Disciplina non appresa o requisiti non soddisfatti.')
    const m=option.mechanics,level=context.classLevels.monk ?? 0
    if (typeof m.effect.spellId!=='string')throw new Error('Questa disciplina non lancia un incantesimo.')
    const spell=fighterFeature(data,m.effect.spellId),upcast=spell.mechanics.upcast as {kind:string}
    if (!Number.isInteger(extraKi) || extraKi<0 || (extraKi>0 && (level<5 || upcast.kind==='not-stated')))throw new Error('Potenziamento della magia non consentito.')
    const cost=m.baseKiCost+extraKi,maximum=level<5 ? m.baseKiCost : level>=17 ? 6 : level>=13 ? 5 : level>=9 ? 4 : 3
    if (cost>maximum || cost>level)throw new Error('Costo ki superiore al limite per incantesimo.')
    return {spellId:spell.id,spellLevel:(spell.mechanics.level as number)+extraKi,kiCost:cost,targetSelfOnly:m.effect.targetSelfOnly===true,
        materialComponentsRequired:false,castingTime:spell.mechanics.casting,concentration:spell.mechanics.concentration}
}

export function wizardProgression(data:CandidateCreationData,levels:Record<string,number>,intelligenceScore:number) {
    const total=classLevels(levels),level=levels.wizard ?? 0
    if (level<1 || !Number.isInteger(intelligenceScore) || intelligenceScore<1 || intelligenceScore>30)throw new Error('Statistiche del mago non valide.')
    const effect=fighterFeature(data,'phb2014:class-feature:wizard-1-spellcasting').mechanics.effect as unknown as {
        progression:{wizardLevel:number;spellSlots:number[];cantripsKnown:number}[] }
    const row=effect.progression.find((r)=>r.wizardLevel===level)
    if (!row)throw new Error('Progressione del mago non verificata.')
    return {...structuredClone(row),proficiencyBonus:2+Math.floor((total-1)/4),preparedLimit:Math.max(1,level+Math.floor((intelligenceScore-10)/2)),
        maximumWizardSpellLevel:row.spellSlots.reduce((maximum,count,i)=>count>0 ? i+1 : maximum,0)}
}

export function wizardChoiceIssues(data:CandidateCreationData,ids:string[],context:ChoiceContext):string[] {
    classLevels(context.classLevels)
    const origins=['phb2014:subclass-feature:wizard-divination-10-the-third-eye','phb2014:subclass-feature:wizard-transmutation-6-transmuter-s-stone']
    if (!context.selectionOriginId || !origins.includes(context.selectionOriginId))return ['Origine della scelta del mago non valida.']
    const issues:string[]=ids.length>1 ? ['Il privilegio permette un solo beneficio alla volta.'] : []
    for (const id of ids) {
        const option=data.verifiedOptions.find((e)=>e.id===id && e.mechanics.optionType==='wizard-choice')
        if (!option)issues.push('Scelta del mago non riconosciuta.')
        else issues.push(...optionIssues(option,context))
    }
    return issues
}

/** Copying spells is separate from preparing or casting them; a Savant discounts copying only. */
export function wizardSpellCopyPlan(data:CandidateCreationData,id:string,levels:Record<string,number>,mode:'new-spell'|'own-book-or-prepared',schoolId?:string) {
    const row=wizardProgression(data,levels,10),spell=data.reviewedEntities.find((e)=>e.id===id && e.kind==='spell')
    const field=spell?.fieldSources?.level?.map((i)=>spell.sources[i]) ?? []
    if (!spell || spell.verification.mechanics!=='verified-fields' && !field.some((s)=>s.section==='Spell Lists'))throw new Error('Livello della magia non verificato.')
    const level=spell.mechanics.level as number
    if (!Number.isInteger(level) || level<1 || level>row.maximumWizardSpellLevel || !(spell.relations.classIds as string[]|undefined)?.includes('phb2014:class:wizard'))throw new Error('Magia non copiabile dal mago a questo livello di classe.')
    let multiplier=1
    if (schoolId) {
        if (row.wizardLevel<2)throw new Error('La scuola richiede livello 2 da mago.')
        if (spell.verification.mechanics!=='verified-fields' && !(spell.fieldSources?.school ?? []).some((i)=>spell.sources[i]?.filename==='PH-Errata.pdf'))throw new Error('Scuola della magia ancora da verificare per lo sconto.')
        const savant=data.reviewedEntities.find((e)=>e.kind==='subclass-feature' && e.relations.subclassId===schoolId && e.name.endsWith(' Savant') && e.verification.complete)
        if (!savant)throw new Error('Beneficio Sapiente della scuola non verificato.')
        if ((savant.mechanics.effect as {copySpellSchool:string}).copySpellSchool===spell.mechanics.school)multiplier=0.5
    }
    if (mode!=='new-spell' && mode!=='own-book-or-prepared')throw new Error('Modalità di copia non valida.')
    return {spellId:id,hours:level*(mode==='new-spell' ? 2 : 1)*multiplier,goldGP:level*(mode==='new-spell' ? 50 : 10)*multiplier,
        requiresSource:mode==='new-spell' ? 'found-wizard-spell' : 'own-book-or-currently-prepared-spell',doesNotPrepareSpell:true}
}

export function wizardOverchannelBacklash(data:CandidateCreationData,levels:Record<string,number>,subclassId:string,spellLevel:number,previousUsesSinceLongRest:number) {
    classLevels(levels)
    const effect=fighterFeature(data,'phb2014:subclass-feature:evocation-14-overchannel').mechanics.effect as {minimumSpellLevel:number;maximumSpellLevel:number}
    if ((levels.wizard ?? 0)<14 || subclassId!=='phb2014:subclass:evocation' || !Number.isInteger(spellLevel)
        || spellLevel<effect.minimumSpellLevel || spellLevel>effect.maximumSpellLevel || !Number.isSafeInteger(previousUsesSinceLongRest) || previousUsesSinceLongRest<0
        || !Number.isSafeInteger((previousUsesSinceLongRest+1)*spellLevel))throw new Error('Sovraccaricare non valido.')
    return {damage:previousUsesSinceLongRest===0 ? '0' : `${(previousUsesSinceLongRest+1)*spellLevel}d12`,damageType:'necrotic',ignoresResistanceAndImmunity:true,
        newUseCount:previousUsesSinceLongRest+1,reset:'long-rest'}
}

export function clericProgression(data:CandidateCreationData,levels:Record<string,number>,wisdomScore:number) {
    const total=classLevels(levels),level=levels.cleric ?? 0
    if (level<1 || !Number.isInteger(wisdomScore) || wisdomScore<1 || wisdomScore>30)throw new Error('Statistiche del chierico non valide.')
    const effect=fighterFeature(data,'phb2014:class-feature:cleric-1-spellcasting').mechanics.effect as unknown as {
        progression:{clericLevel:number;spellSlots:number[];cantripsKnown:number}[] }
    const row=effect.progression.find((r)=>r.clericLevel===level)
    if (!row)throw new Error('Progressione del chierico non verificata.')
    return {...structuredClone(row),preparedLimit:Math.max(1,level+Math.floor((wisdomScore-10)/2)),proficiencyBonus:2+Math.floor((total-1)/4),
        channelDivinity:{maximum:level<2 ? 0 : level>=18 ? 3 : level>=6 ? 2 : 1,recovery:['short-rest','long-rest']},
        destroyUndeadMaximumCR:level<5 ? null : level>=17 ? 4 : level>=14 ? 3 : level>=11 ? 2 : level>=8 ? 1 : 0.5}
}

export function clericDomainSpellGrants(data:CandidateCreationData,domainId:string,levels:Record<string,number>,permission:{dmApproved?:boolean}={}) {
    classLevels(levels)
    selectedSubclassFeaturePlan(data,levels,domainId,permission)
    if ((levels.cleric ?? 0)<1)throw new Error('Il dominio richiede livello 1 da chierico.')
    const origin=data.reviewedEntities.find((e)=>e.kind==='subclass-feature' && e.relations.subclassId===domainId
        && e.relations.classId==='phb2014:class:cleric' && e.name==='Domain Spells')
    if (!origin)throw new Error('Dominio non riconosciuto.')
    const feature=fighterFeature(data,origin.id)
    const effect=feature.mechanics.effect as unknown as {grants:{clericLevel:number;spellId:string;alwaysPrepared:boolean;countsAgainstPreparedLimit:boolean;countsAsClericSpell:boolean}[]}
    return structuredClone(effect.grants.filter((g)=>g.clericLevel<=(levels.cleric ?? 0)))
}

/** Validates the chosen distribution; never increases a creature above half its maximum HP. */
export function preserveLifeAllocation(data:CandidateCreationData,levels:Record<string,number>,targets:{type:string;currentHP:number;maximumHP:number;chosenHealing:number}[]) {
    classLevels(levels)
    if ((levels.cleric ?? 0)<2)throw new Error('Preservare Vita richiede livello 2 da chierico della Vita.')
    fighterFeature(data,'phb2014:subclass-feature:life-2-preserve-life')
    let allocated=0
    for (const t of targets) {
        if (['undead','construct'].includes(t.type) || !Number.isSafeInteger(t.maximumHP) || t.maximumHP<1
            || !Number.isSafeInteger(t.currentHP) || t.currentHP<0 || t.currentHP>t.maximumHP
            || !Number.isSafeInteger(t.chosenHealing) || t.chosenHealing<0
            || t.chosenHealing>Math.max(0,Math.floor(t.maximumHP/2)-t.currentHP))throw new Error('Distribuzione di Preservare Vita non valida.')
        allocated+=t.chosenHealing
    }
    if (allocated>5*(levels.cleric ?? 0))throw new Error('Cura superiore al pool disponibile.')
    return {allocated,unused:5*(levels.cleric ?? 0)-allocated,requires:['life-domain','targets-within-30-ft','one-channel-divinity-use','action-and-holy-symbol']}
}

export function sorcererProgression(data:CandidateCreationData,levels:Record<string,number>) {
    const total=classLevels(levels),level=levels.sorcerer ?? 0
    if (level<1)throw new Error('Livello da stregone richiesto.')
    const effect=fighterFeature(data,'phb2014:class-feature:sorcerer-1-spellcasting').mechanics.effect as unknown as {
        progression:{sorcererLevel:number;spellSlots:number[];cantripsKnown:number;spellsKnown:number;sorceryPoints:number}[] }
    const row=effect.progression.find((r)=>r.sorcererLevel===level)
    if (!row)throw new Error('Progressione dello stregone non verificata.')
    return {...structuredClone(row),proficiencyBonus:2+Math.floor((total-1)/4),metamagicKnown:level<3 ? 0 : level>=17 ? 4 : level>=10 ? 3 : 2}
}

export function metamagicSelectionIssues(data:CandidateCreationData,ids:string[],context:ChoiceContext):string[] {
    const row=sorcererProgression(data,context.classLevels),issues:string[]=[]
    if (ids.length>row.metamagicKnown || new Set(ids).size!==ids.length)issues.push('Limite o duplicato nella scelta della metamagia.')
    for (const id of ids) {
        const option=data.verifiedOptions.find((e)=>e.id===id && e.mechanics.optionType==='metamagic')
        if (!option)issues.push('Metamagia non riconosciuta.')
        else issues.push(...optionIssues(option,{...context,selectionOriginId:'phb2014:class-feature:sorcerer-3-metamagic'}))
    }
    return issues
}

export type SorceryState={points:number;availableSlots:number[];createdSlots:number[]}
/** A created slot is tracked separately so its expiry cannot replenish a normal slot. */
export function sorcererFlexibleCasting(data:CandidateCreationData,levels:Record<string,number>,state:SorceryState,mode:'create-slot'|'sacrifice-slot',slotLevel:number) {
    const row=sorcererProgression(data,levels),maximum=row.sorceryPoints
    if (row.sorcererLevel<2 || !Number.isInteger(slotLevel) || slotLevel<1 || slotLevel>9
        || !Number.isInteger(state.points) || state.points<0 || state.points>maximum
        || state.availableSlots.length!==9 || state.createdSlots.length!==9
        || state.availableSlots.some((n)=>!Number.isSafeInteger(n) || n<0)
        || state.createdSlots.some((n,i)=>!Number.isSafeInteger(n) || n<0 || n>state.availableSlots[i]))throw new Error('Risorse di stregoneria non valide.')
    const effect=fighterFeature(data,'phb2014:class-feature:sorcerer-2-font-of-magic').mechanics.effect as unknown as {
        flexibleCasting:{createSlotPointCostBySlotLevel:Record<string,number>;createdSlotsExpire:string} }
    const result=structuredClone(state),i=slotLevel-1
    if (mode==='create-slot') {
        const cost=effect.flexibleCasting.createSlotPointCostBySlotLevel[String(slotLevel)]
        if (!cost || result.points<cost || !Number.isSafeInteger(result.availableSlots[i]+1))throw new Error('Slot non creabile o punti insufficienti.')
        result.points-=cost;result.availableSlots[i]++;result.createdSlots[i]++
    } else if (mode==='sacrifice-slot') {
        if (result.availableSlots[i]<1)throw new Error('Nessuno slot disponibile da sacrificare.')
        result.availableSlots[i]--;result.createdSlots[i]=Math.max(0,result.createdSlots[i]-1)
        result.points=Math.min(maximum,result.points+slotLevel)
    } else throw new Error('Conversione non riconosciuta.')
    return {...result,activation:'bonus-action-on-own-turn',createdSlotsExpire:effect.flexibleCasting.createdSlotsExpire}
}

/** Lookup only: unresolved spell/creature dependencies remain visible to the caller. */
export function wildMagicTableEntry(data:CandidateCreationData,roll:number) {
    if (!Number.isInteger(roll) || roll<1 || roll>100)throw new Error('Il d100 richiede un risultato da 1 a 100.')
    const feature=data.reviewedEntities.find((e)=>e.id==='phb2014:subclass-feature:wild-magic-1-wild-magic-surge')
    const table=(feature?.mechanics.effect as {table?:{minimumRoll:number;maximumRoll:number;summaryIt:string;effect:Record<string,Json>}[]}|undefined)?.table
    if (!table || feature?.verification.mechanics!=='verified-fields')throw new Error('Tabella di Magia Selvaggia non revisionata.')
    const row=table.find((r)=>roll>=r.minimumRoll && roll<=r.maximumRoll)
    if (!row)throw new Error('Risultato della tabella mancante.')
    return {entry:structuredClone(row),completeDependencies:feature.verification.complete,missingDependencies:[...feature.verification.missingFields]}
}

export function equipmentPurchase(data:CandidateCreationData,id:string,purchaseUnits:number) {
    const e=data.verifiedEquipment.find((e)=>e.id===id)
    if (!e || !Number.isSafeInteger(purchaseUnits) || purchaseUnits<1)throw new Error('Acquisto di equipaggiamento non valido.')
    const m=e.mechanics,conversion={cp:1,sp:10,ep:50,gp:100,pp:1000}
    const costCP=m.cost.quantity*conversion[m.cost.unit]*purchaseUnits,pieces=(m.purchaseQuantity ?? 1)*purchaseUnits
    if (!Number.isSafeInteger(costCP) || !Number.isSafeInteger(pieces))throw new Error('Quantità o costo troppo grande.')
    const weight=m.weight?.value ?? m.weightLb ?? null
    return {entityId:id,purchaseUnits,pieces,costCP,weightLb:weight===null ? null : weight*purchaseUnits,
        priceUnit:m.priceUnit ?? 'purchase',specialEffect:structuredClone(m.effect ?? null)}
}

/** Pack prices are fixed; an incomplete weight estimate is never labelled a total. */
export function equipmentPackContents(data:CandidateCreationData,id:string) {
    const e=data.verifiedEquipment.find((e)=>e.id===id && e.kind==='equipment-pack')
    if (!e?.mechanics.contents || !e.mechanics.additionalContents)throw new Error('Dotazione non verificata.')
    const items=e.mechanics.contents.map((item)=>equipmentPurchase(data,item.entityId,item.quantity))
    const extras=e.mechanics.additionalContents.map((item)=>({name:item.name,quantity:item.quantity,unit:item.unit ?? 'piece',
        weightLb:item.toolIndex ? equipmentPurchase(data,'phb2014:tool:'+item.toolIndex,item.quantity).weightLb : null}))
    const knownWeightLb=[...items,...extras].reduce((sum,item)=>sum+(item.weightLb ?? 0),0)
    const completeWeight=[...items,...extras].every((item)=>item.weightLb!==null)
    return {items,extras,cost:structuredClone(e.mechanics.cost),knownWeightLb,totalWeightLb:completeWeight ? knownWeightLb : null,
        missingWeightNames:[...items.filter((i)=>i.weightLb===null).map((i)=>i.entityId),...extras.filter((i)=>i.weightLb===null).map((i)=>i.name)]}
}

export function trinketTableEntry(data:CandidateCreationData,roll:number):TrinketEntry {
    if(!Number.isInteger(roll) || roll<1 || roll>100)throw new Error('Il d100 richiede un risultato da 1 a 100.')
    const rule=fighterFeature(data,'phb2014:rule:trinkets'),rows=rule.mechanics.rows as unknown as TrinketEntry[]
    const entry=rows.find((r)=>r.roll===roll)
    if(!entry || rows.length!==100)throw new Error('Voce delle cianfrusaglie mancante.')
    return structuredClone(entry)
}

/** SAC 2.7 own-roll clarification; its alternative DM ruling is not applied automatically. */
export function luckyOwnRollChoice(data:CandidateCreationData,rolls:number[],chosenIndex:number,mode:'normal'|'advantage'|'disadvantage',remainingLuckPoints:number) {
    const feat=fighterFeature(data,'phb2014:feat:lucky')
    if(!object(feat.mechanics.advantageInteraction) || feat.mechanics.advantageInteraction.ownRollSelection!=='choose-any-d20-in-mix-including-extra')throw new Error('Interazione di Fortunato non verificata.')
    if(!['normal','advantage','disadvantage'].includes(mode) || rolls.length!==(mode==='normal'?2:3) || rolls.some((r)=>!Number.isInteger(r) || r<1 || r>20) || !Number.isInteger(chosenIndex) || chosenIndex<0 || chosenIndex>=rolls.length || !Number.isInteger(remainingLuckPoints) || remainingLuckPoints<1 || remainingLuckPoints>3)throw new Error('Tiro o punti fortuna non validi.')
    return {selectedD20:rolls[chosenIndex]!,remainingLuckPoints:remainingLuckPoints-1,advantageDisadvantage:mode,hasDisadvantage:mode==='disadvantage',sources:structuredClone(feat.sources)}
}

export function shortRestHitDieHealing(data:CandidateCreationData,dieSize:6|8|10|12,roll:number,constitutionScore:number) {
    const rule=fighterFeature(data,'phb2014:rule:short-rest')
    if(rule.mechanics.minimumHealingPerDie!==0)throw new Error('Minimo di guarigione non verificato.')
    if(![6,8,10,12].includes(dieSize) || !Number.isInteger(roll) || roll<1 || roll>dieSize || !Number.isInteger(constitutionScore) || constitutionScore<1 || constitutionScore>30)throw new Error('Dado vita o Costituzione non validi.')
    return {healing:Math.max(0,roll+Math.floor((constitutionScore-10)/2)),hitDiceSpent:1,requiresCompletedRestHours:1,sources:structuredClone(rule.sources)}
}

/** Class HP only; racial/feat bonuses and later Constitution changes are separate. */
export function levelHitPointGain(data:CandidateCreationData,context:{edition:'2014'|'2024';classId:string;firstCharacterLevel:boolean;constitutionScore:number;rolledHitDie?:number}) {
    const cls=data.reviewedEntities.find(e=>e.id===context.classId && e.kind==='class'),m=cls?.mechanics
    if(context.edition!=='2014' || data.edition!=='2014' || !m || !object(m.hitPointsFirstLevel) || !object(m.hitPointsHigherLevels)
        || typeof context.firstCharacterLevel!=='boolean' || !Number.isSafeInteger(context.constitutionScore) || context.constitutionScore<1 || context.constitutionScore>30
        || typeof m.hitDie!=='number' || ![6,8,10,12].includes(m.hitDie))throw new Error('Classe o incremento di PF non valido.')
    if(context.rolledHitDie!==undefined && (context.firstCharacterLevel || !Number.isSafeInteger(context.rolledHitDie) || context.rolledHitDie<1 || context.rolledHitDie>m.hitDie))throw new Error('Tiro del dado vita non valido.')
    const base=context.firstCharacterLevel ? m.hitPointsFirstLevel.base : context.rolledHitDie ?? m.hitPointsHigherLevels.fixedAlternative
    if(typeof base!=='number' || !Number.isSafeInteger(base) || base<1 || (!context.firstCharacterLevel && m.hitPointsHigherLevels.minimum!==1))throw new Error('Formula dei PF non verificata con errata.')
    const total=base+Math.floor((context.constitutionScore-10)/2)
    return {hitPoints:context.firstCharacterLevel ? total : Math.max(1,total),sources:structuredClone(cls!.sources)}
}

/** PHB PDF 165–166: separate learning limits, shared Spellcasting and Pact pools. */
export function multiclassSpellPools(data:CandidateCreationData,levels:Record<string,number>,subclassIds:string[]=[]){
    const total=classLevels(levels)
    if(data.edition!=='2014' || total<1 || Object.keys(levels).some((cls)=>!data.reviewedEntities.some((e)=>e.id==='phb2014:class:'+cls)))throw new Error('Classi 2014 non valide.')
    const full=['bard','cleric','druid','sorcerer','wizard'],ownSlots:Record<string,number[]>={}
    for(const [cls,level] of Object.entries(levels).filter(([,level])=>level>0)){
        const third=cls==='fighter' ? 'eldritch-knight' : cls==='rogue' ? 'arcane-trickster' : null
        if(third && subclassIds.includes('phb2014:subclass:'+third)){
            if(level<3)throw new Error('Sottoclasse magica prima del livello tre.')
            const effect=fighterFeature(data,`phb2014:subclass-feature:${third}-3-spellcasting`).mechanics.effect as unknown as {progression:Record<string,Json>[]}
            const row=effect.progression.find((r)=>r[cls+'Level']===level)
            if(!row)throw new Error('Progressione magica non verificata.')
            ownSlots[cls]=[...row.spellSlots as number[]]
        }else if(full.includes(cls) || ['paladin','ranger'].includes(cls) && level>=2){
            const row=data.reviewedEntities.find((e)=>e.id===`phb2014:class-level:${cls}-${level}`)
            if(row?.verification.mechanics!=='verified-fields')throw new Error('Tabella slot non verificata.')
            ownSlots[cls]=[...row.mechanics.spellSlots as number[]]
        }
    }
    const eligible=Object.keys(ownSlots)
    const casterLevel=eligible.reduce((n,cls)=>n+(full.includes(cls) ? levels[cls] : Math.floor(levels[cls]/(['paladin','ranger'].includes(cls) ? 2 : 3))),0)
    const shared=eligible.length>1 ? data.reviewedEntities.find((e)=>e.id===`phb2014:class-level:wizard-${casterLevel}`)?.mechanics.spellSlots as number[]|undefined : ownSlots[eligible[0]]
    if(eligible.length>1 && !shared)throw new Error('Tabella multiclassamento non verificata.')
    const pact=levels.warlock ? warlockProgression(data,levels) : null
    return {spellcastingSlots:shared ? [...shared] : Array<number>(9).fill(0),ownClassMaximumSpellLevel:Object.fromEntries(Object.entries(ownSlots).map(([cls,slots])=>[cls,slots.reduce((n,count,i)=>count ? i+1 : n,0)])),
        pactSlots:pact ? {count:pact.pactSlots.maximum,level:pact.pactSlotLevel,recovery:[...pact.pactSlots.recovery]} : null,
        sources:[fighterFeature(data,'phb2014:rule:multiclassing').sources[0]]}
}

export type SpellCastContext={
    edition:'2014'|'2024';classLevels:Record<string,number>;classIndex:string;subclassIds?:string[]
    knownSpellIds:string[];preparedSpellIds:string[];spellbookIds?:string[]
    mode:'cantrip'|'ritual'|'spellcasting-slot'|'pact-slot';slotLevel?:number
    remainingSpellSlots?:number[];remainingPactSlots?:number
    castingAlternative?:number;spellsThisTurn?:{level:number;unit:string}[]
    components:{canSpeak:boolean;freeSomaticHand:boolean;materialHand:boolean;materialSource:'specific'|'pouch'|'focus'|'none';focusClassIndex?:string;specificMaterialsConfirmed:boolean}
    armorProficient:boolean
}
/** Validated cast plan; target/damage resolution and exceptional feature casting stay separate. */
export function spellCastPlan(data:CandidateCreationData,id:string,context:SpellCastContext){
    const pools=multiclassSpellPools(data,context.classLevels,context.subclassIds),spell=fighterFeature(data,id),m=spell.mechanics
    if(context.edition!=='2014' || spell.kind!=='spell' || !context.armorProficient)throw new Error('Lancio 2014 o competenza nell’armatura non validi.')
    const cls=context.classIndex,level=m.level as number,ownLevel=context.classLevels[cls] ?? 0
    const classRow=data.reviewedEntities.find((e)=>e.id==='phb2014:class:'+cls)
    const classList=['fighter','rogue'].includes(cls) ? 'wizard' : cls
    if(ownLevel<1 || !(m.classes as string[]).includes(classList))throw new Error('Incantesimo fuori dalla lista della classe scelta.')
    const maximum=cls==='warlock' ? pools.pactSlots?.level ?? 0 : pools.ownClassMaximumSpellLevel[cls] ?? 0
    if(cls!=='warlock' && !(cls in pools.ownClassMaximumSpellLevel))throw new Error('La classe o sottoclasse non concede Incantesimi.')
    if(level>maximum || level===0 && ['paladin','ranger'].includes(cls))throw new Error('Livello della magia superiore alla progressione della singola classe.')
    const prepared=['cleric','druid','paladin','wizard'].includes(cls),ritual=context.mode==='ritual'
    if(ritual && (level===0 || m.ritual!==true || !['bard','cleric','druid','wizard'].includes(cls)))throw new Error('Rituale non autorizzato dalla classe.')
    const access=ritual && cls==='wizard' ? context.spellbookIds ?? [] : level>0 && prepared ? context.preparedSpellIds : context.knownSpellIds
    if(!access.includes(id))throw new Error('Magia non conosciuta, preparata o presente nel libro per questo lancio.')
    const alternatives=m.castingAlternatives as {quantity:number;unit:string;effectKey:string}[]|undefined
    if(alternatives && (!Number.isInteger(context.castingAlternative) || !alternatives[context.castingAlternative!]))throw new Error('Scegliere la modalità di lancio.')
    const casting=alternatives ? alternatives[context.castingAlternative!] : m.casting as {quantity:number;unit:string}
    const prior=context.spellsThisTurn ?? []
    if(prior.some((p)=>!Number.isInteger(p.level) || p.level<0 || p.level>9 || !['action','bonus-action','reaction','minute','hour'].includes(p.unit)))throw new Error('Cronologia del turno non valida.')
    if(casting.unit==='bonus-action' && prior.some((p)=>p.level!==0 || p.unit!=='action') || prior.some((p)=>p.unit==='bonus-action') && (level!==0 || casting.unit!=='action'))throw new Error('Limitazione della magia con azione bonus nello stesso turno.')
    const c=context.components,components=m.components as string[]
    if(components.includes('V') && !c.canSpeak || components.includes('S') && !c.freeSomaticHand && !(components.includes('M') && c.materialHand))throw new Error('Componenti verbali o somatici non disponibili.')
    if(components.includes('M')){
        if(!c.materialHand || !['specific','pouch','focus'].includes(c.materialSource))throw new Error('Componente materiale non disponibile.')
        if(c.materialSource==='focus' && (c.focusClassIndex!==cls || !['bard','cleric','druid','paladin','sorcerer','warlock','wizard'].includes(cls)))throw new Error('Focus non utilizzabile per questa classe.')
        if((m.materialCostGP!==null || m.materialConsumed===true || m.materialConsumptionStatus==='conditionally-consumed') && (c.materialSource!=='specific' || !c.specificMaterialsConfirmed))throw new Error('Occorrono i componenti specifici costosi o consumabili.')
    }
    let spellSlots=context.remainingSpellSlots ? [...context.remainingSpellSlots] : null,pactSlots=context.remainingPactSlots ?? null
    let castLevel=level
    if(context.mode==='cantrip'){
        if(level!==0 || context.slotLevel!==undefined)throw new Error('Trucchetto senza slot richiesto.')
    }else if(ritual){
        if(context.slotLevel!==undefined)throw new Error('Un rituale non usa slot o potenziamento.')
    }else{
        castLevel=context.slotLevel ?? 0
        if(level===0 || !Number.isInteger(castLevel) || castLevel<level || castLevel>9)throw new Error('Livello slot non valido.')
        if(context.mode==='spellcasting-slot'){
            if(!spellSlots || spellSlots.length!==9 || spellSlots.some((n,i)=>!Number.isSafeInteger(n) || n<0 || n>pools.spellcastingSlots[i]) || spellSlots[castLevel-1]<1)throw new Error('Slot di Incantesimi non disponibile.')
            spellSlots[castLevel-1]-=1
        }else if(context.mode==='pact-slot'){
            if(!pools.pactSlots || castLevel!==pools.pactSlots.level || pactSlots===null || !Number.isSafeInteger(pactSlots) || pactSlots<1 || pactSlots>pools.pactSlots.count)throw new Error('Slot del Patto non disponibile.')
            pactSlots-=1
        }else throw new Error('Modalità di lancio non valida.')
    }
    return {spellId:id,classIndex:cls,castingAbility:['fighter','rogue'].includes(cls) ? 'intelligence' : classRow!.mechanics.castingAbility,
        castLevel,casting:structuredClone(casting),ritualAdditionalMinutes:ritual ? 10 : 0,concentration:m.concentration===true,
        concentrationDuringCasting:ritual || ['minute','hour'].includes(casting.unit),actionEachTurnDuringLongCasting:ritual || ['minute','hour'].includes(casting.unit),
        effect:structuredClone(m.effect),upcast:structuredClone(m.upcast),materialConsumptionStatus:m.materialConsumptionStatus,
        resultingSlots:{spellcasting:spellSlots,pact:pactSlots},slotSpendOccurs:'on-successful-cast-completion' as const,sources:structuredClone(spell.sources)}
}

/** One Attack-action attack, not a 2024 saving throw; exceptions remain in the reviewed record. */
export function combatContestPlan(data:CandidateCreationData,kind:'grapple'|'shove',context:{edition:'2014'|'2024';hasAttackAction:boolean;attackerSize:string;targetSize:string;distanceFt:number;reachFt:number;freeHands:number;targetIncapacitated:boolean}) {
    if(!['grapple','shove'].includes(kind))throw new Error('Contesa non riconosciuta.')
    const rule=fighterFeature(data,'phb2014:rule:'+kind),m=rule.mechanics,sizes=['Tiny','Small','Medium','Large','Huge','Gargantuan']
    if(context.edition!=='2014' || !context.hasAttackAction || !sizes.includes(context.attackerSize) || !sizes.includes(context.targetSize)
        || !Number.isFinite(context.distanceFt) || context.distanceFt<0 || !Number.isFinite(context.reachFt) || context.reachFt<0
        || !Number.isSafeInteger(context.freeHands) || context.freeHands<0 || typeof context.targetIncapacitated!=='boolean')throw new Error('Contesto della contesa non valido.')
    if(context.distanceFt>context.reachFt || sizes.indexOf(context.targetSize)>sizes.indexOf(context.attackerSize)+Number(m.maxSizeDifference))throw new Error('Bersaglio fuori portata o troppo grande.')
    if(kind==='grapple' && context.freeHands<Number(m.freeHands))throw new Error('Serve almeno una mano libera.')
    return {attackActionAttacksReplaced:1,automaticSuccess:context.targetIncapacitated && m.automaticSuccessAgainstIncapacitated===true,
        mechanics:structuredClone(m),sources:structuredClone(rule.sources)}
}

/** Spell energy is held immediately: preparation consumes the slot even when never released. */
export function readiedActionPlan(data:CandidateCreationData,context:{edition:'2014'|'2024';perceivableTrigger:boolean;response:'action'|'move'|'spell';spellId?:string;casting?:SpellCastContext}) {
    const rule=fighterFeature(data,'phb2014:action:ready')
    if(context.edition!=='2014' || context.perceivableTrigger!==true || !['action','move','spell'].includes(context.response))throw new Error('Preparazione o evento non valido.')
    if(rule.mechanics.expiresInLocalPrinting!=='before-start-of-own-next-turn')throw new Error('Scadenza della preparazione ancora da verificare.')
    const cast=context.response==='spell' && context.spellId && context.casting ? spellCastPlan(data,context.spellId,context.casting) : null
    if(context.response==='spell' && (!cast || cast.ritualAdditionalMinutes || cast.casting.unit!=='action' || cast.casting.quantity!==1))throw new Error('Preparare richiede un incantesimo da un’azione.')
    if(context.response!=='spell' && (context.spellId!==undefined || context.casting!==undefined))throw new Error('Lancio non pertinente alla risposta scelta.')
    return {response:context.response,cast,expires:'before-start-of-own-next-turn' as const,reactionRequired:true as const,
        reactionTiming:'after-trigger-finishes' as const,mayIgnoreTrigger:true as const,holdRequiresConcentration:cast!==null,
        existingConcentrationEnds:cast!==null,slotRefundIfNotReleased:false as const,sources:[...rule.sources,...(cast?.sources ?? [])]}
}

/** A verified contents row may be used while another row retains an open interpretation. */
export function ironFlaskContentsPlan(data:CandidateCreationData,roll:number,context:{edition:'2014'|'2024';dmApproved:boolean;selectedCreatureId?:string;nativePlaneConfirmed?:boolean}) {
    const item=data.reviewedEntities.find(e=>e.id==='dmg2014:magic-item:iron-flask')
    if(data.edition!=='2014' || context.edition!=='2014' || context.dmApproved!==true || !item || item.verification.mechanics!=='verified-fields' || !Number.isSafeInteger(roll) || roll<1 || roll>100)throw new Error('Bottiglia: fonte, scelta del DM o tiro non validi.')
    const effect=item.mechanics.effect
    if(!object(effect) || !Array.isArray(effect.contentsRows))throw new Error('Inventario contenuti ancora da verificare.')
    const row=effect.contentsRows.find(r=>object(r) && Number(r.low)<=roll && roll<=Number(r.high))
    if(!object(row))throw new Error('Riga contenuti non verificata.')
    if(row.result==='empty') {
        if(context.selectedCreatureId!==undefined)throw new Error('La bottiglia vuota non contiene una creatura.')
        return {row:structuredClone(row),creature:null,wholeItemComplete:item.verification.complete}
    }
    if(!Array.isArray(row.creatureIds) || !context.selectedCreatureId || !row.creatureIds.includes(context.selectedCreatureId) || context.nativePlaneConfirmed!==true)throw new Error('Scegliere una forma prevista e confermare il piano nativo tramite il DM.')
    return {row:structuredClone(row),creature:reviewedCreature(data,context.selectedCreatureId),wholeItemComplete:item.verification.complete}
}

/** Capture rules are independent of the optional prefilled-contents table. No state is written. */
export function ironFlaskCapturePlan(data:CandidateCreationData,context:{edition:'2014'|'2024';commandWordAvailable:boolean;flaskOccupied:boolean;targetVisible:boolean;distanceFt:number;currentPlane:string;targetNativePlane:string;previouslyCapturedByThisFlask:boolean}) {
    const item=data.reviewedEntities.find(e=>e.id==='dmg2014:magic-item:iron-flask')
    if(data.edition!=='2014' || context.edition!=='2014' || !item || item.verification.mechanics!=='verified-fields')throw new Error('Regola 2014 non verificata.')
    const effect=item.mechanics.effect
    if(!object(effect) || !object(effect.capture))throw new Error('Cattura non verificata.')
    for(const key of ['commandWordAvailable','flaskOccupied','targetVisible','previouslyCapturedByThisFlask'] as const)if(typeof context[key]!=='boolean')throw new Error('Stato della cattura non valido.')
    if(context.commandWordAvailable!==true || context.flaskOccupied || !context.targetVisible || !Number.isFinite(context.distanceFt) || context.distanceFt<0 || context.distanceFt>Number(effect.capture.rangeFt) || typeof context.currentPlane!=='string' || !context.currentPlane.trim() || typeof context.targetNativePlane!=='string' || !context.targetNativePlane.trim() || context.currentPlane.trim().toLocaleLowerCase()===context.targetNativePlane.trim().toLocaleLowerCase())throw new Error('Cattura richiede parola, bottiglia libera, bersaglio visibile entro sessanta e piano nativo diverso.')
    return {activation:'action' as const,save:{ability:effect.capture.saveAbility,dc:effect.capture.saveDC,advantage:context.previouslyCapturedByThisFlask},onFailure:structuredClone(effect.capture),release:structuredClone(effect.release),wholeItemComplete:item.verification.complete}
}

/** Harmless imagery: returns presentation and illusion rules, never a monster stat block. */
export function deckIllusionPlan(data:CandidateCreationData,cardIndex:string,context:{edition:'2014'|'2024';drawWasRandom:boolean;cardAvailable:boolean;throwDistanceFt:number;redDragonAge?:'wyrmling'|'young'|'adult'|'ancient'}) {
    const item=reviewedMagicItem(data,'dmg2014:magic-item:deck-of-illusions'),effect=item.mechanics.effect
    if(context.edition!=='2014' || context.drawWasRandom!==true || context.cardAvailable!==true || !Number.isFinite(context.throwDistanceFt) || context.throwDistanceFt<0 || context.throwDistanceFt>Number(effect.throwRangeFt))throw new Error('Serve una carta disponibile estratta casualmente e lanciata entro trenta piedi.')
    const card=Array.isArray(effect.cards) ? effect.cards.find(c=>object(c) && c.index===cardIndex) : undefined
    if(!object(card) || !Array.isArray(card.figures))throw new Error('Carta non prevista.')
    const figures=structuredClone(card.figures)
    for(const f of figures)if(object(f) && object(f.appearance) && object(f.appearance.sizesByDMAge)) {
        if(!context.redDragonAge || !(context.redDragonAge in f.appearance.sizesByDMAge))throw new Error('Il DM deve specificare l’età apparente del drago.')
        f.appearance.size=f.appearance.sizesByDMAge[context.redDragonAge]
    }
    if(card.image!=='red-dragon' && context.redDragonAge!==undefined)throw new Error('Età del drago non pertinente alla carta.')
    return {activation:'action' as const,figures,harmless:true as const,grantsCreatureStatistics:false as const,movement:structuredClone(effect.movement),physicalInteraction:effect.physicalInteraction,visualInspection:structuredClone(effect.visualInspection),ends:structuredClone(effect.ends),onEnd:effect.onEnd}
}

/** This returns the check due, not its result or a mutation of exhaustion. */
export function chaseDashPlan(data:CandidateCreationData,context:{edition:'2014'|'2024';dmApproved:boolean;constitutionScore:number;previousDashUses:number}) {
    const m=optionalRulePlan(data,'dmg2014:rule:chases',context).mechanics as unknown as ChaseMechanics
    if(!Number.isSafeInteger(context.constitutionScore) || context.constitutionScore<1 || context.constitutionScore>30 || !Number.isSafeInteger(context.previousDashUses) || context.previousDashUses<0 || context.previousDashUses>=Number.MAX_SAFE_INTEGER)throw new Error('Costituzione o conteggio degli Scatti non valido.')
    const freeDashUses=3+Math.floor((context.constitutionScore-10)/2),dashUses=context.previousDashUses+1
    return {dashUses,freeDashUses,checkRequired:dashUses>freeDashUses,check:structuredClone(m.additionalDash),recoveryAppliesToChaseExhaustionOnly:true as const,recovery:structuredClone(m.chaseOnlyExhaustionRecovery)}
}

export function chaseEscapePlan(data:CandidateCreationData,context:{edition:'2014'|'2024';dmApproved:boolean;outOfLeadPursuerSight:boolean;stealthTotal:number;pursuerPassivePerception:number[]}) {
    optionalRulePlan(data,'dmg2014:rule:chases',context)
    if(typeof context.outOfLeadPursuerSight!=='boolean' || !Number.isSafeInteger(context.stealthTotal) || !Array.isArray(context.pursuerPassivePerception) || !context.pursuerPassivePerception.length || context.pursuerPassivePerception.some(p=>!Number.isSafeInteger(p)))throw new Error('Contesto di fuga non valido.')
    const highestPassivePerception=context.pursuerPassivePerception.reduce((a,b)=>Math.max(a,b))
    return {escapes:context.outOfLeadPursuerSight && context.stealthTotal>highestPassivePerception,highestPassivePerception,timing:'end-round-after-all-participants' as const}
}

/** Damage is supplied after the DM resolves suitability and any other modifiers. */
export function objectDamagePlan(data:CandidateCreationData,context:{edition:'2014'|'2024';currentHP:number;resolvedDamage:number;damageType:string;damageThreshold:number;canDamageObject:boolean}) {
    const m=fighterFeature(data,'dmg2014:rule:object-statistics').mechanics as unknown as ObjectStatisticsMechanics
    if(context.edition!=='2014' || [context.currentHP,context.resolvedDamage,context.damageThreshold].some(n=>!Number.isSafeInteger(n)||n<0) || !['acid','bludgeoning','cold','fire','force','lightning','necrotic','piercing','poison','psychic','radiant','slashing','thunder'].includes(context.damageType) || typeof context.canDamageObject!=='boolean')throw new Error('Danno o statistiche dell’oggetto non validi.')
    const immune=(m.damageImmunities as string[]).includes(context.damageType),belowThreshold=context.resolvedDamage<context.damageThreshold
    const damage=immune || belowThreshold || !context.canDamageObject ? 0 : context.resolvedDamage
    return {damage,currentHP:Math.max(0,context.currentHP-damage),immune,belowThreshold}
}

/** The campaign confirms the effective level; the DMG supplies no multiclass aggregation rule. */
export function spellPointSlotPlan(data:CandidateCreationData,context:{edition:'2014'|'2024';dmApproved:boolean;effectiveCasterLevel:number;availablePoints:number;slotLevel:number;highSlotsCreatedSinceLongRest:number[]}) {
    const m=optionalRulePlan(data,'dmg2014:rule:spell-points',context).mechanics as unknown as SpellPointsMechanics
    const row=m.levels.find(r=>r.level===context.effectiveCasterLevel),used=context.highSlotsCreatedSinceLongRest
    if(!row || !Number.isSafeInteger(context.availablePoints) || context.availablePoints<0 || context.availablePoints>row.points || !Number.isSafeInteger(context.slotLevel) || context.slotLevel<1 || context.slotLevel>row.maximumSlotLevel || !Array.isArray(used) || used.some(l=>!Number.isSafeInteger(l)||l<6||l>row.maximumSlotLevel) || new Set(used).size!==used.length)throw new Error('Punti incantesimo o storico degli slot non validi.')
    const cost=m.slotCosts[context.slotLevel-1]
    if(context.availablePoints<cost || (context.slotLevel>=6 && used.includes(context.slotLevel)))throw new Error('Punti insufficienti o slot superiore già creato fra questi riposi lunghi.')
    return {slotLevel:context.slotLevel,cost,remainingPoints:context.availablePoints-cost,highSlotsCreatedSinceLongRest:context.slotLevel>=6?[...used,context.slotLevel]:[...used],operation:'create-slot' as const,recovery:m.recovery,sources:fighterFeature(data,'dmg2014:rule:spell-points').sources}
}
