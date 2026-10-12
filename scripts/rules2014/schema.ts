/** Reference-only types. These records are never passed directly to CreationData. */
export type Edition2014 = '2014'
export type Ability = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma'
export type PoisonDelivery = 'contact' | 'ingested' | 'inhaled' | 'injury'
export interface FirearmStatistics {
    index:string; nameIt:string; period:'renaissance'|'modern'|'futuristic'; weaponCategory:'martial-ranged'
    costGP:number|null; costStatus:'stated'|'priceless-no-market-price'; weightLb:number
    damage:{dice:string;type:'piercing'|'radiant'|'necrotic'}; rangeFt:{normal:number;long:number}
    twoHanded:boolean; loading:boolean; reloadCapacity:number|null; burstFire:boolean; ammunition:'bullet'|'energy-cell'
}
export interface PoisonMechanics {
    ruleType:'poison';delivery:PoisonDelivery;suggestedCostGPPerDose:number;doseQuantity:1
    saveAbility:'constitution';saveDC:number;damageType:'poison';effect:{[key:string]:Json}
}
export interface DeityEntry {
    index:string;name:string;alignment:'LG'|'NG'|'CG'|'LN'|'N'|'CN'|'LE'|'NE'|'CE'
    suggestedDomains:('knowledge'|'life'|'light'|'nature'|'tempest'|'trickery'|'war'|'death')[]
    clericsSupportedInTable:boolean;portfolioIt:string;symbolIt:string
}
export interface PantheonMechanics {
    ruleType:'pantheon-catalog';setting:string;entries:DeityEntry[]
    requiresDMCampaignAvailability:true;domainsAreSuggestions:true
    characterAlignmentEnforced:false;automaticClassFeaturesGranted:false
}
export interface ObjectStatisticsMechanics {
    ruleType:'object-statistics';suggestedACByMaterial:Record<string,number>
    suggestedHPBySize:Record<'Tiny'|'Small'|'Medium'|'Large',Record<'fragile'|'resilient',{average:number;dice:string}>>
    damageImmunities:('poison'|'psychic')[]
    damageThreshold:{value:string;per:'single-attack-or-effect';belowThreshold:'no-damage';atOrAboveThreshold:'normal-damage-not-minus-threshold'}
}
export interface SpellPointsMechanics {
    ruleType:'spell-points';requiresDMApproval:true;slotCosts:number[]
    levels:{level:number;points:number;maximumSlotLevel:number}[]
    recovery:'all-on-long-rest';oneSlotPerLevelAtLeast6PerLongRest:true
    pactMagicReplaced:false;multiclassAggregation:'not-explicitly-specified-DM-confirm-effective-level'
}
export interface ChaseMechanics {
    ruleType:'chase';requiresDMApproval:true;freeDashUses:'3+constitutionModifier'
    additionalDash:{checkAbility:'constitution';checkDC:10;timing:'end-own-turn';eachAdditionalDashRequiresCheck:true;failureExhaustionLevels:1}
    chaseOnlyExhaustionRecovery:('short-rest'|'long-rest')[]
    complications:{die:20;timing:'end-each-participant-turn';affects:'next-participant-in-initiative';inspirationMayNegateBy:string[];tables:Record<'urban'|'wilderness',TreasureTableRow[]>}
}
export interface StoredSpell {
    spellId:string;slotLevel:number;saveDC:number;attackBonus:number;castingAbility:Ability
}
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
export type CoinDenomination = 'cp'|'sp'|'ep'|'gp'|'pp'
export interface TreasureCoinFormula {dice:string;multiplier:number;average:number}
export interface TreasureTableRow {low:number;high:number;effect:Record<string,Json>;summaryIt:string}
export interface TreasureTableMechanics {
    ruleType:'treasure-table';requiresDMApproval:true;die:number;rows:TreasureTableRow[]
    treasureType:'gem'|'art'|'magic-item'|'individual'|'hoard'
    minimumCR?:number;maximumCR?:number|null;coins?:Partial<Record<CoinDenomination,TreasureCoinFormula>>
    unitValueGP?:number;selection?:string
}
export type EntityId = `${'phb2014' | 'dmg2014' | 'mm2014'}:${string}:${string}`
export type TranslationStatus = 'assistant-translation' | 'verified-local-italian-source' | 'missing'
export interface Source {
    edition: Edition2014
    book: 'phb' | 'dmg' | 'mm' | 'srd51-it' | 'phb-errata' | 'dmg-errata' | 'mm-errata' | 'sac-rulings'
    filename: string
    /** 1-based PDF page numbers, distinct from printed numbers. */
    pdfPages: number[]
    printedPages: number[] | null
    section: string
    verification: 'read-local-text' | 'read-local-render' | 'automated-text-extraction'
}
export interface Money { quantity: number; unit: 'cp' | 'sp' | 'ep' | 'gp' | 'pp' }
export interface Weight { value: number | null; unit: 'lb'; unspecifiedInTable?: boolean }
export interface Distance { value: number; unit: 'ft' }
export interface EquipmentSelection {
    fixed: EquipmentChoiceItem[]
    choices: { choose: number; options: EquipmentChoiceItem[][] }[]
}
export interface EquipmentChoiceItem {
    index?: string
    category?: string
    quantity: number
    requiresProficiency?: boolean
    material?: string
    entityId?: EntityId | null
    quantityUnit?: 'piece' | 'purchase-unit'
    referenceStatus?: 'resolved' | 'unresolved' | 'category-choice'
}
export interface ClassMechanics {
    hitDie: 6 | 8 | 10 | 12
    hitPointsFirstLevel: { base: number; addAbilityModifier: 'constitution' }
    hitPointsHigherLevels: { dice: string; fixedAlternative: number; addAbilityModifier: 'constitution'; minimum?: 1 }
    savingThrowAbilities: Ability[]
    skillChoices: { choose: number; from: string[] }
    armorProficiencies: string[]
    weaponProficiencies: string[]
    toolProficiencies: ({ index: string } | { category: string; choose: number } | { categories: string[]; choose: number })[]
    castingAbility: Ability | null
    subclassMinimumLevel: number
    abilityScoreImprovementLevels: number[]
    startingEquipment: EquipmentSelection
    metalArmorRestriction?: string
}
export interface RaceMechanics {
    fixedAbilityBonuses: Partial<Record<Ability, number>>
    speed: Distance
    size: 'Small' | 'Medium'
    languages: string[]
    darkvision: Distance
    traits: { index: string; mechanics: Record<string, Json> }[]
    age?: { adulthoodYears: number | null; adulthoodBasis: 'cultural' | 'physical'; lifespanYears: number | null; lifespanQualifier: string; ageLimitsEnforced: false }
    alignmentDescription?: { binding: false; status: 'first-printing-narrative-suggestion' }
}
export interface WeaponMechanics {
    cost: Money
    weight: Weight
    weaponCategory: 'simple' | 'martial'
    weaponRange: 'melee' | 'ranged'
    damage: { dice: string | null; type: string | null }
    properties: string[]
    /** For thrown melee weapons this is throw_range in the existing catalog. */
    range: { normal: number; long: number; unit: 'ft' } | null
    versatileDamage: string | null
}
export interface ArmorMechanics {
    cost: Money
    weight: Weight
    armorCategory: 'light' | 'medium' | 'heavy' | 'shield'
    armorClass: { base: number; dexBonus: boolean; maxDexBonus: number | null; isBonus: boolean }
    strengthMinimumToAvoidSpeedPenalty: number
    stealthDisadvantage: boolean
}
export interface ProgressionMechanics {
    level: number
    proficiencyBonus: number
    /** Always nine slots; Pact Magic is a separate pool. */
    spellSlots: number[]
    cantripsKnown: number
    spellsKnown?: number
    pactSlots?: { count: number; level: number; recovery: ('short-rest' | 'long-rest')[] }
    invocationsKnown?: number
    rages?: number | 'unlimited'
    kiPoints?: number
    [key: string]: Json | undefined
}
export interface SpellMechanics {
    level: number | null
    school: string | null
    castingTime: string | null
    casting?: { quantity: number; unit: string }
    castingAlternatives?: { quantity: number; unit: string; effectKey: string }[]
    range: string | null
    components: ('V' | 'S' | 'M')[] | null
    duration: string | null
    ritual: boolean
    concentration: boolean | null
    materialIt?: string | null
    materialCostGP: number | null
    materialConsumed: boolean | null
    materialConsumptionStatus?: 'conditionally-consumed' | 'partially-consumed' | 'explicitly-consumed' | 'not-stated' | 'not-applicable'
    effect: Record<string, Json> | null
    upcast: Record<string, Json> | null
    classes: string[] | null
}
export interface BackgroundTable {
    die: 'd6' | 'd8' | 'd10' | 'd20'
    entries: { roll: number; summaryIt: string; suggestedAlignmentAspect?: 'lawful' | 'chaotic' | 'good' | 'evil' | 'neutral' | 'any' | null }[]
}
export interface BackgroundMechanics {
    skillProficiencies: string[]
    toolProficiencies: string[]
    languageChoice: { choose: number }
    startingGold: { quantity: number; unit: 'gp' }
    startingEquipment: { index: string; quantity: number; kind: string }[]
    feature: { name: string; summaryIt: string; effect: Record<string, Json> }
    alternateFeature?: { name: string; nameIt: string; summaryIt: string; effect: Record<string, Json> }
    personalityTables: Record<'traits' | 'ideals' | 'bonds' | 'flaws', BackgroundTable>
    personalitySelection: { traits: 2; ideals: 1; bonds: 1; flaws: 1; methods: string[]; suggestionsOnly: true; alignmentRestricted: false }
    specialtyChoice?: BackgroundTable & { minimumChoices: number; maximumChoices: number; suggestionsOnly: true }
}
export interface ClassOptionMechanics {
    optionType: 'eldritch-invocation' | 'pact-boon' | 'fighting-style' | 'fighter-maneuver' | 'totem-choice' | 'hunter-choice' | 'monk-discipline' | 'wizard-choice' | 'metamagic' | 'sorcerer-choice'
    prerequisites: {
        minimumWarlockLevelForSelection?: number
        pactOptionId?: EntityId
        knownCantripId?: EntityId
    }
    selectionOrigins?: {
        originId: EntityId
        classId?: EntityId
        minimumClassLevel?: number
        subclassId?: EntityId
        featId?: EntityId
    }[]
    effect: Record<string, Json>
    resourceCost?: { pool: 'superiority-dice'; dice: 1 }
    maximumManeuversPerAttack?: 1
    saveDC?: '8+proficiencyBonus+chosenStrengthOrDexterityModifier'
    maySelectSameStyleTwice?: false
    tier?: 3 | 6 | 7 | 11 | 14 | 15
    animal?: 'bear' | 'eagle' | 'wolf'
    minimumMonkLevel?: number
    baseKiCost?: number
}
export interface TrinketEntry {
    roll: number
    index: string
    summaryIt: string
    sourceIndex: number
    weightLb: number | null
    weightStatus: 'stated' | 'not-stated'
    price: null
    priceStatus: 'not-stated'
    gameStatisticsBeyondDescription: 'not-stated'
}
export interface CreatureAction {
    index: string
    nameIt: string
    activation: 'action' | 'reaction' | 'legendary-action'
    kind: 'melee-weapon-attack' | 'ranged-weapon-attack' | 'melee-or-ranged-weapon-attack' | 'melee-spell-attack' | 'ranged-spell-attack' | 'multiattack' | 'special'
    attackBonus?: number
    reachFt?: number
    rangeFt?: { normal: number; long: number }
    target?: 'one-target' | 'one-creature'
    damage?: { average: number; dice: string | null } & ({ type: string } | { typeChoice: string[] })
    effect: Record<string, Json>
    summaryIt: string
}
export interface CreatureMechanics {
    isSwarm?: boolean
    swarmMemberSize?: 'Tiny'
    size: 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan'
    type: string
    alignment: string
    armorClass: { value: number; source: 'natural-armor' | 'plate' | 'scale-mail' | 'leather-armor' | 'hide-armor' | 'studded-leather' | 'armor-scraps' | 'unspecified'; shieldIncluded?:boolean }
    hitPoints: { average: number; dice: string }
    speedFt: { walk: number; climb?: number; swim?: number; fly?: number; burrow?: number }
    abilities: Record<Ability, number>
    savingThrowBonuses: Partial<Record<Ability, number>>
    skillBonuses: Record<string, number>
    sensesFt: { blindsight?: number; darkvision?: number; tremorsense?: number; truesight?: number }
    passivePerception: number
    languages: string[]
    telepathyFt?: number
    understandsAdditionalLanguages?: string[]
    cannotSpeakAdditionalLanguages?: boolean
    optionalVariants?: { requiresDMApproval: true; nameIt: string; effect: Record<string, Json> }[]
    understandsLanguagesOnly?: boolean
    cannotSpeak?: boolean
    demonType?: 1|2|3|4|5|6|null
    devilRank?: 'lesser'|'greater'|'lemure'
    telepathyRestriction?: string
    creatureTags?: string[]
    additionalCreatureTypes?: string[]
    variantFamilyIndex?: string
    ageColor?: string
    ageRangeYears?: {minimum:number|null;maximum:number|null}
    challengeRating: number
    experiencePoints: number
    damageVulnerabilities: string[]
    damageResistances: string[]
    conditionalDamageResistances?: { types: string[]; condition: 'nonmagical-weapons' | 'nonmagical-attacks' | 'nonmagical-weapons-not-silvered' | 'nonmagical-attacks-not-silvered' | 'nonmagical-weapons-not-adamantine' | 'nonmagical-attacks-not-adamantine' }[]
    conditionalDamageImmunities?: { types: string[]; condition: 'nonmagical-weapons' | 'nonmagical-attacks' | 'nonmagical-weapons-not-adamantine' | 'nonmagical-attacks-not-adamantine' }[]
    damageImmunities: string[]
    conditionImmunities: string[]
    traits: { index: string; nameIt: string; effect: Record<string, Json>; summaryIt: string }[]
    actions: CreatureAction[]
    reactions: CreatureAction[]
    legendaryActions: CreatureAction[]
    legendaryActionEconomy?: { maximum: number; recovery: 'start-of-own-turn'; timing: 'end-of-another-creature-turn'; maximumOptionsPerOpportunity: 1 }
    regionalEffects?: { effect: Record<string, Json>; summaryIt: string; sourceIndex: number }[]
    regionalEffectsEnd?: string
    lair?: { challengeRating: number; experiencePoints: number; initiativeCount: 20; losesInitiativeTies: true; cannotRepeatConsecutiveRounds: boolean; actions: { effect: Record<string, Json>; summaryIt: string }[] }
    alignmentAlternatives?: { alignment: string; percent: number }[]
    languageOrigin?: 'languages-known-in-life'
    blindBeyondBlindsight?: boolean
    canHover?: boolean
}
export interface MechanicsByKind {
    'magic-item': MagicItemMechanics
    creature: CreatureMechanics
    class: ClassMechanics
    race: RaceMechanics
    weapon: WeaponMechanics
    armor: ArmorMechanics
    'class-level': ProgressionMechanics
    spell: SpellMechanics
    subclass: Record<string, Json>
    subrace: Record<string, Json>
    'race-variant': Record<string, Json>
    background: BackgroundMechanics
    'background-variant': Record<string, Json>
    feat: Record<string, Json>
    tool: Record<string, Json>
    gear: Record<string, Json>
    'equipment-pack': Record<string, Json>
    'weapon-property': Record<string, Json>
    'class-feature': Record<string, Json>
    'class-option': ClassOptionMechanics
    'subclass-feature': Record<string, Json>
    advancement: Record<string, Json>
    rule: Record<string, Json>
    action: Record<string, Json>
    skill: { ability: Ability }
    condition: Record<string, Json>
}
export interface MagicItemMechanics {
    category: 'armor' | 'weapon' | 'wondrous' | 'potion' | 'ring' | 'rod' | 'scroll' | 'staff' | 'wand'
    rarity: 'common' | 'uncommon' | 'rare' | 'very-rare' | 'legendary' | 'varies' | 'artifact'
    requiresAttunement: boolean
    attunementPrerequisites?: Record<string, Json>
    activation: string
    usageRequirement: string
    effect: Record<string, Json>
}
export interface SupernaturalGiftMechanics {
    ruleType: 'supernatural-gift'
    giftType: 'blessing' | 'charm' | 'epic-boon'
    requiresDMApproval: true
    requiresAttunement: false
    isObject: false
    minimumTotalLevel?: 20
    repeatable?: false
    effect: Record<string, Json>
}
export type Kind = keyof MechanicsByKind
export interface ReferenceRecord<K extends Kind> {
    id: EntityId
    index: string
    kind: K
    edition: Edition2014
    name: string
    nameIt: string | null
    translation: { language: 'it'; status: TranslationStatus }
    optional: boolean
    sources: Source[]
    mechanics: MechanicsByKind[K]
    summaryIt: string | null
    verification: {
        identity: 'verified' | 'exact-heading' | 'ocr-candidate' | 'heading-inventory-matched' | 'derived-placeholder'
        mechanics: 'verified-fields' | 'ocr-candidate'
        complete: boolean
        missingFields: string[]
    }
    relations?: Record<string, EntityId | EntityId[]>
    fieldSources: Record<string, number[]>
    interpretations: { field: string; kind: string; method: string }[]
    extraction?: {
        headingOCR: string
        schoolOCR: string
        matchingScore: number
        exactHeading: boolean
        blockSHA256: string
        requiresReview: boolean
        fieldStatus: Record<string, string>
        headerOCR: Record<string, string>
    }
}
export type Entity = { [K in Kind]: ReferenceRecord<K> }[Kind]
