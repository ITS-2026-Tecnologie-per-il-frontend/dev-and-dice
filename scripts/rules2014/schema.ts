/** Reference-only types. These records are never passed directly to CreationData. */
export type Edition2014 = '2014'
export type Ability = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma'
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
export type EntityId = `${'phb2014' | 'dmg2014' | 'mm2014'}:${string}:${string}`
export type TranslationStatus = 'assistant-translation' | 'verified-local-italian-source' | 'missing'
export interface Source {
    edition: Edition2014
    book: 'phb' | 'dmg' | 'mm' | 'srd51-it' | 'phb-errata' | 'dmg-errata' | 'mm-errata'
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
    hitPointsHigherLevels: { dice: string; fixedAlternative: number; addAbilityModifier: 'constitution' }
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
    range: string | null
    components: ('V' | 'S' | 'M')[] | null
    duration: string | null
    ritual: boolean
    concentration: boolean | null
    materialIt?: string | null
    materialCostGP: number | null
    materialConsumed: boolean | null
    effect: Record<string, Json> | null
    upcast: Record<string, Json> | null
    classes: string[] | null
}
export interface MechanicsByKind {
    class: ClassMechanics
    race: RaceMechanics
    weapon: WeaponMechanics
    armor: ArmorMechanics
    'class-level': ProgressionMechanics
    spell: SpellMechanics
    subclass: Record<string, Json>
    subrace: Record<string, Json>
    'race-variant': Record<string, Json>
    background: Record<string, Json>
    'background-variant': Record<string, Json>
    feat: Record<string, Json>
    tool: Record<string, Json>
    gear: Record<string, Json>
    'equipment-pack': Record<string, Json>
    'weapon-property': Record<string, Json>
    'class-feature': Record<string, Json>
    'class-option': Record<string, Json>
    'subclass-feature': Record<string, Json>
    advancement: Record<string, Json>
    rule: Record<string, Json>
    action: Record<string, Json>
    skill: { ability: Ability }
    condition: Record<string, Json>
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
